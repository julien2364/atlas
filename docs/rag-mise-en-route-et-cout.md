# Moteur de réponse prédictive (RAG) — mise en route et coût

Lot MP-4 · rédigé le 07/09/2026 · **révisé le 07/09/2026 après exécution réelle de la chaîne**
Cible : projet Supabase **mutualisé** `cvmsozjxpjzvyhinvooa`

Ce document couvre trois choses : ce que Julien doit exécuter pour rendre le moteur vivant, ce
qu'il doit voir à chaque étape pour savoir que ça a marché, et ce que ça va coûter par mois — avec
les hypothèses de calcul écrites, parce qu'une estimation dont on ne peut pas rejouer le calcul ne
vaut rien.

**Ce qui a changé le 07/09/2026** : toute la chaîne a été exécutée pour de vrai, contre un
PostgreSQL 16.13 avec **le vrai pgvector 0.8.6** (pas un bouchon), sur les 2 847 passages du
corpus. Sept défauts ont été trouvés et corrigés à cette occasion — ils sont listés en annexe. Les
chiffres de coût ont été recalculés sur des mesures et non sur des estimations.

---

## 0. Ce qui est livré, ce qui a été éprouvé, ce qui ne l'a pas été

### Livré

| Fichier | Rôle |
| --- | --- |
| `supabase/schema.sql` | Tables `atlas_rag_passages` et `atlas_rag_cache_reponses`, index vectoriel, 4 fonctions `atlas_rag_*` |
| `scripts/indexer-corpus.mjs` | Découpe le corpus en passages, calcule les embeddings, les écrit — idempotent |
| `lib/rag.ts` | Recherche vectorielle, garde-fous, appel modèle, rattachement des sources réelles |
| `lib/embedding-factice.mjs` | **Nouveau.** Embedding de test déterministe, sans clé — permet la répétition générale décrite en §1 |
| `app/api/question/route.ts` | `POST /api/question` (réponse) et `GET /api/question` (diagnostic de configuration) |
| `components/QuestionLibreClient.tsx` | Champ de question libre sur `/questions` |
| `scripts/comparer-qualite-rag.mjs` | Compare la sortie du moteur aux 4 réponses manuelles, champ par champ |
| `.env.example` | Les 5 variables obligatoires, les 8 réglages facultatifs, le mode de test — tous commentés |

### Éprouvé réellement, sans aucune clé d'API

Environnement de vérification : PostgreSQL **16.13**, **pgvector 0.8.6** installé depuis le dépôt
officiel PostgreSQL (`apt.postgresql.org`, paquet `postgresql-16-pgvector`, empreinte SHA-256
vérifiée contre l'index du dépôt). Ce n'est donc **pas** un bouchon de type `vector` : les types,
l'opérateur `<=>`, l'index HNSW et le planificateur sont les vrais.

- **`supabase/schema.sql`** s'applique sans erreur, deux fois de suite (idempotence vérifiée), dans
  les **deux** configurations d'extension possibles : pgvector dans `public` (PostgreSQL nu) et
  pgvector dans le schéma `extensions` (cas normal d'un projet Supabase). Aucun `drop`, aucun
  `alter` sur un objet non `atlas_`. **Tous** les objets créés portent le préfixe `atlas_` : 8
  tables, 7 index, 1 séquence, 4 fonctions — vérifié par inventaire du catalogue, et vérifié aussi
  que l'extension pgvector ne déverse rien dans `public` quand le schéma `extensions` existe.
- **Une policy modifiée à la main survit à une réexécution du fichier** : `atlas_public_read` a été
  altérée (`using (statut = 'documente')`), le fichier rejoué, la modification est intacte.
- **L'index HNSW est créé** (pgvector ≥ 0.5) et **réellement utilisé** par le planificateur
  (`Index Scan using atlas_rag_passages_embedding_idx`, vérifié par `EXPLAIN`).
- **L'indexation complète a tourné sur les 2 847 passages** : découpage, empreintes, écriture par
  lots, pagination des lectures, reprise, purge, et toutes les options de la CLI. Détail en §3.
- **La recherche vectorielle, les seuils, le cache et `POST /api/question` ont tourné** contre cette
  base, via `npm run dev`, avec de vrais vecteurs de dimension 1024 dans la table.
- `npm run valider`, `npx tsc --noEmit` et `npm run build` passent.

### Comment on a fait sans clé — et ce que ça ne prouve pas

Deux substitutions, toutes deux explicites et bornées :

1. **L'embedding** est remplacé par `lib/embedding-factice.mjs` : un hachage de mots projeté sur
   1 024 dimensions, déterministe, local, gratuit. Il rapproche les textes qui partagent des
   **mots**, jamais ceux qui partagent un **sens**.
   → Il prouve tout le mécanisme (découpage, écriture, idempotence, seuils, plafonds, cache,
   format de réponse). **Il ne prouve rien de la pertinence** : aucun jugement sur la qualité des
   réponses n'a pu être porté, et le seuil de 0,45 reste un point de départ raisonné, pas une
   valeur mesurée (cf. §6).
2. **PostgREST** (la couche HTTP de Supabase) n'était pas installable dans l'environnement de test.
   Un bouchon local a reproduit le SQL que PostgREST construit réellement
   (`json_populate_recordset` pour les insertions, `json_to_recordset` pour les arguments de
   fonction) ainsi que le plafond Supabase de 1 000 lignes par réponse.
   → Le SQL, la base, pgvector et le client `@supabase/supabase-js` sont réels ; **la traduction
   HTTP→SQL faite par PostgREST est simulée**. Le point qui inquiétait (« un tableau JSON
   arrive-t-il bien à se convertir en `vector` ? ») a été vérifié au niveau SQL :
   `json_to_recordset('[{"requete":[…]}]') as _(requete vector(1024))` fonctionne. Ce qui reste non
   prouvé, c'est que PostgREST construise bien cette requête-là — c'est ce qu'il documente et ce
   qu'il fait depuis la v9, mais ce n'est pas vérifié ici.

### Non éprouvé, et non éprouvable sans les clés

- **Aucun appel à Voyage** : ni le nom du modèle `voyage-4-lite`, ni sa dimension de sortie réelle,
  ni son tarif.
- **Aucun appel à Anthropic** : ni le nom `claude-sonnet-4-5`, ni le respect du schéma d'outil par
  le modèle, ni la qualité des perspectives produites. L'appel a été exercé avec une réponse d'outil
  fabriquée (le seul `fetch` sortant a été intercepté) : cela prouve le décodage de la sortie, le
  rattachement des sources et le rejet des identifiants inventés, pas le comportement du modèle.
- **Aucune connexion à un vrai projet Supabase** : ni les policies réellement en place sur le projet
  mutualisé, ni le comportement de PostgREST, ni les quotas.
- **La pertinence sémantique**, donc le réglage du seuil : c'est le seul point qui compte encore et
  il demande de vraies clés. La méthode est en §6.

---

## 1. Répétition générale — sans clé, sans dépense (30 minutes)

**À faire avant d'acheter quoi que ce soit.** Cette séquence rejoue toute la chaîne avec l'embedding
factice ; elle prouve que la base, le schéma, l'indexeur et l'API fonctionnent chez vous. Si elle
échoue, aucune clé n'y changera rien.

```bash
npm install
node scripts/indexer-corpus.mjs --dry-run
```

Sortie attendue (corpus du 07/09/2026) :

```
Corpus : 267 fiches humaines · 44 fiches IA · 201 fiches de gap
Passages construits : 2847 (humaine 1068 · ia 171 · gap 1608)
Volume total : 1 381 451 caractères ≈ 383 736 tokens
Mode --dry-run : aucune API appelée, aucune écriture en base, aucun coût engagé.
```

Ce mode n'appelle rien, n'écrit rien et n'exige aucune variable d'environnement. Si ces chiffres
n'apparaissent pas, inutile d'aller plus loin.

Ensuite, avec une base PostgreSQL locale (ou le projet Supabase de test de votre choix) où
`supabase/schema.sql` a été appliqué :

```bash
export ATLAS_EMBEDDING_FACTICE=1
node scripts/indexer-corpus.mjs --embedding-factice          # ~20 s, 2 847 passages
node scripts/indexer-corpus.mjs --embedding-factice          # doit dire « Rien à faire »
node scripts/indexer-corpus.mjs --etat                       # doit afficher 2 847 vectorisés
ATLAS_EMBEDDING_FACTICE=1 npm run dev
curl -s localhost:3000/api/question | jq .reglages.embedding_factice   # true
```

Le mode factice est **volontairement pénible à activer** : il faut la variable d'environnement
`ATLAS_EMBEDDING_FACTICE=1` **et** le drapeau `--embedding-factice`, et il se refuse à démarrer si
`NODE_ENV=production` ou si `VERCEL` est défini. Les lignes indexées portent
`modele_embedding = 'factice-hachage-1024'`, donc un index factice se repère d'un coup d'œil dans
`select * from atlas_rag_statistiques()`. Enfin, le nom du modèle entre dans l'empreinte SHA-256 des
passages : **repasser au vrai modèle réindexe automatiquement tout le corpus**, il n'y a pas de
mélange possible entre les deux espaces vectoriels.

---

## 2. Mise en route réelle, dans l'ordre

### Étape 1 — Créer les tables (5 minutes, gratuit)

1. Ouvrir <https://supabase.com/dashboard> → projet `cvmsozjxpjzvyhinvooa` → **SQL Editor**.
2. Coller **tout** le contenu de `supabase/schema.sql`, puis « Run ».
3. Vérifier qu'il n'y a pas d'erreur rouge.

Le fichier est idempotent (vérifié) : le rejouer ne casse rien, ne recrée rien, et **n'écrase pas**
une policy que vous auriez modifiée à la main depuis la console.

Ce que ça crée, et rien d'autre :

```
atlas_rag_passages                   table   passages du corpus + vecteurs (vector(1024))
atlas_rag_cache_reponses             table   cache des réponses déjà produites
atlas_rag_passages_embedding_idx     index   HNSW cosinus (repli IVFFlat si pgvector < 0.5)
atlas_rag_passages_fiche_idx         index   (type_fiche, fiche_id)
atlas_rag_passages_empreinte_idx     index   empreinte SHA-256
atlas_rag_rechercher_passages(...)   fonction recherche par similarité, plafonnée à 100 résultats
atlas_rag_cache_lire(...)            fonction lecture du cache + compteur d'usage
atlas_rag_purger_cache(...)          fonction purge des entrées expirées
atlas_rag_statistiques()             fonction volumétrie de l'index
```

Aucun objet sans préfixe `atlas_` n'est touché. Aucun `DROP`. Aucun `ALTER` sur une table
existante. Les tables du RAG ont RLS activée **sans aucune policy** : elles sont donc inaccessibles
aux rôles `anon` et `authenticated`, et seul `service_role` y accède.

Contrôle, dans le même éditeur SQL :

```sql
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like 'atlas_rag%';
-- attendu : atlas_rag_passages, atlas_rag_cache_reponses
```

### Étape 2 — Renseigner les clés (10 minutes)

```bash
cd ~/chemin/vers/Atlas-Humain-IA
cp .env.example .env.local
open -e .env.local
```

Cinq valeurs à remplir, toutes documentées dans le fichier :

| Variable | Où la trouver |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API Keys → *Project URL* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | même écran → clé `anon` / *publishable* |
| `SUPABASE_SERVICE_ROLE_KEY` | même écran → clé `service_role` / *secret* (bouton *Reveal*) |
| `VOYAGE_API_KEY` | <https://dashboard.voyageai.com> → API Keys → *Create Key* |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com> → Settings → API Keys |

> **`SUPABASE_SERVICE_ROLE_KEY` contourne toutes les policies RLS et donne un accès total en
> écriture à une base partagée avec d'autres applications.** Elle ne doit jamais porter le
> préfixe `NEXT_PUBLIC_`, jamais être committée, jamais être collée dans un chat ou une capture.
> `.env.local` est déjà exclu par `.gitignore` ; `.env.example` est la seule exception, et il ne
> contient aucune valeur.

**Avant de continuer, poser deux plafonds de dépense** — c'est la seule protection que le code ne
peut pas assurer à votre place : *spend limit* mensuelle dans la console Anthropic (Plans &
Billing) et dans le dashboard Voyage (Billing).

**Vérifier que les cinq sont bien vues** — cette commande n'appelle rien et ne coûte rien :

```bash
npm run dev
curl -s localhost:3000/api/question | jq
```

Attendu : `"actif": true` et `"cles_manquantes": []`. Sinon, la liste nomme exactement ce qui
manque. Les messages exacts en cas de clé absente sont en §4.

### Étape 3 — Indexer, d'abord 10 passages

```bash
node scripts/indexer-corpus.mjs --limite=10
node scripts/indexer-corpus.mjs --etat
```

Attendu :

```
Modèle d'embedding : voyage-4-lite (dimension attendue 1024)
Passages construits : 2847 (humaine 1068 · ia 171 · gap 1608)

Lecture des empreintes déjà indexées…
  0 passage(s) déjà en base.
  --limite=10 : 10 passage(s) traités sur 2847 à réindexer.
À (ré)indexer : 10 passage(s) · inchangés : 0 · obsolètes en base : 0
  lot 1/1 — 10 passage(s)…

10 passage(s) indexé(s) en … s · … tokens facturés par Voyage.
Index à jour. Le moteur /questions peut être interrogé.

ÉTAT DE L'INDEX VECTORIEL (atlas_rag_passages)
  humaine     10 passages · 3 fiches · 10 vectorisés · modèles : voyage-4-lite
```

(Le nombre de tokens facturés est celui que Voyage renvoie lui-même ; pour 10 passages il doit se
situer autour de 1 300 — 10 × 485 caractères ÷ 3,6. Un chiffre très supérieur signale que le modèle
découpe le français beaucoup plus finement que prévu, donc que H3 du §5 est à revoir.)

Le point à regarder est la colonne **modèles** : elle doit contenir `voyage-4-lite` et **rien
d'autre**. Deux modèles dans la même colonne = deux espaces vectoriels incomparables et une
recherche qui rend du bruit sans lever d'erreur.

### Étape 4 — Indexer tout

```bash
node scripts/indexer-corpus.mjs
```

Une seule fois, quelques minutes selon la latence de Voyage. Puis :

```bash
node scripts/indexer-corpus.mjs        # doit afficher « Rien à faire — l'index est déjà à jour. »
```

Ce comportement est **vérifié** : à corpus inchangé, le second lancement ne crée aucun doublon,
n'appelle aucune API et ne coûte rien. Après modification d'une fiche, seuls les passages dont le
**texte** a changé sont réindexés (vérifié : modifier une thèse centrale réindexe 1 passage sur les
4 de la fiche). En cas d'interruption, relancer la même commande : les lignes écrites sans vecteur
sont reprises automatiquement (vérifié sur 1 500 lignes).

Options utiles, toutes vérifiées :

| Option | Effet mesuré |
| --- | --- |
| `--dry-run` | 0 requête HTTP, 0 écriture, aucune clé requise |
| `--type=humaine\|ia\|gap` | restreint le corpus **et** la détection des passages obsolètes au seul référentiel choisi |
| `--limite=N` | traite les N premiers passages à (ré)indexer, et le dit |
| `--force` | réindexe tout, même l'inchangé (coûteux) |
| `--purger` | supprime les passages qui ne sont plus dans le corpus (vérifié : 8 passages d'une fiche supprimée) |
| `--etat` | volumétrie, sans rien modifier |
| `--json` | stdout = un objet JSON et rien d'autre (le reste part sur stderr) |
| argument inconnu | message d'usage, **code de sortie 2**, rien n'est tenté |

Codes de sortie : `0` succès · `1` échec d'exécution (API ou base) · `2` usage ou configuration
invalide (rien n'a été tenté, rien n'a été dépensé).

### Étape 5 — Essayer

```bash
npm run dev
# puis http://localhost:3000/questions
```

En ligne de commande :

```bash
curl -s localhost:3000/api/question | jq          # diagnostic : clés présentes ?
curl -s localhost:3000/api/question \
  -H 'Content-Type: application/json' \
  -d '{"question":"Les modèles économiques mondiaux actuels sont-ils optimaux ?"}' \
  > /tmp/reponse.json
jq '.diagnostic' /tmp/reponse.json
```

Le champ à lire est `diagnostic.statut` :

- `repondue` — le moteur a répondu ; `perspectives` contient au moins une entrée, `fiches_mobilisees`
  les fiches réellement mobilisées avec leur URL publique ;
- `hors_corpus` — le référentiel ne couvre pas assez la question ; **aucun appel au modèle n'a été
  fait**, seuls les extraits les plus proches sont affichés ;
- `corpus_vide` — aucun passage n'atteint le seuil de similarité. Si c'est le cas sur **toutes** les
  questions, l'index est vide ou vide de vecteurs : revoir l'étape 4.

Rappel : ces trois cas renvoient tous **HTTP 200**. Un refus honnête n'est pas une erreur technique.

### Étape 6 — Contrôler la qualité contre l'étalon

```bash
node scripts/comparer-qualite-rag.mjs                              # contrat + écarts connus
node scripts/comparer-qualite-rag.mjs --reponse=/tmp/reponse.json  # comparaison réelle
```

Le second mode est le seul qui prouve quelque chose. **À faire tourner sur les 4 questions-tests
avant toute publication.**

### Étape 7 — Déployer

Reporter les 5 variables dans Vercel (projet `atlas-humain-ia` → Settings → Environment
Variables), en marquant `SUPABASE_SERVICE_ROLE_KEY`, `VOYAGE_API_KEY` et `ANTHROPIC_API_KEY`
comme *Sensitive*. **Ne jamais y mettre `ATLAS_EMBEDDING_FACTICE`** (le code la refuserait de toute
façon sur Vercel, mais autant ne pas essayer). Puis `git push origin main`.

L'index vit dans Supabase, pas dans le dépôt : il n'y a rien à réindexer après un déploiement.
En revanche, **après chaque réindexation, purger le cache** :

```sql
select atlas_rag_purger_cache(0);   -- 0 = tout, quel que soit l'âge
```

---

## 3. Ce que produit exactement l'indexation — chiffres mesurés

Mesuré le 07/09/2026 sur le corpus complet (512 fiches), par exécution réelle et non par estimation.

| Référentiel | Fiches | Passages | Détail |
| --- | ---: | ---: | --- |
| Humain (A) | 267 | **1 068** | 4 par fiche : thèse centrale, apport, limites critiques, résonance IA |
| IA (B) | 44 | **171** | 44 capacités clés + 44 limites connues + **83 usages sectoriels** |
| Gap analysis | 201 | **1 608** | 8 par fiche : apport IA, mécanisme, amélioration, mode d'interaction, 3 scénarios, axes prospectifs |
| **Total** | **512** | **2 847** | |

Volume : **1 381 451 caractères**, soit **≈ 383 736 tokens** (à 3,6 car./token) et **485 caractères
par passage en moyenne**.

Encombrement réel en base, mesuré : **41 Mo** pour `atlas_rag_passages`, dont **22 Mo d'index
HNSW** et ~12 Mo de vecteurs (2 847 × 1 024 × 4 octets, stockés en TOAST).

> Le chiffre de **2 847** remplace celui de la version précédente de ce document, qui donnait la
> même somme avec une répartition différente (1 066 / 173 / 1 608) : le corpus a été corrigé depuis
> (deux usages sectoriels en doublon supprimés côté IA, deux champs remplis côté humain). La
> répartition ci-dessus est celle du corpus livré. Elle bougera à chaque enrichissement du
> référentiel : `node scripts/indexer-corpus.mjs --dry-run` la redonne en 2 secondes, gratuitement.

---

## 4. Ce que vous verrez exactement si une clé manque

Toutes ces réponses sont **vérifiées**, pas rédigées de mémoire. Aucune n'est une exception nue.

**Indexeur** — `node scripts/indexer-corpus.mjs`, code de sortie **2**, rien n'a été tenté :

```
ÉCHEC : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour écrire l'index.
        Copier .env.example vers .env.local et le renseigner (Supabase → Settings → API Keys),
        ou lancer `node scripts/indexer-corpus.mjs --dry-run` qui n'a besoin d'aucune clé.
```

```
ÉCHEC : VOYAGE_API_KEY manquante. La renseigner dans .env.local (console Voyage AI → API Keys),
        ou utiliser --dry-run pour vérifier le découpage sans clé.
```

Si la table n'existe pas (schéma non appliqué), code de sortie **1** :

```
ÉCHEC : Lecture de atlas_rag_passages impossible : relation "public.atlas_rag_passages" does not exist
        La table existe-t-elle ? Exécuter supabase/schema.sql dans l'éditeur SQL du projet.
```

Et sur un index vide, `--etat` répond `(index vide — l'indexation n'a jamais été lancée)` avec un
code de sortie 0.

**API** — `POST /api/question`, toujours du JSON, jamais une trace de pile :

| Cause | Statut | Corps |
| --- | --- | --- |
| `VOYAGE_API_KEY` absente | 503 | `{"erreur":{"code":"configuration","message":"VOYAGE_API_KEY absente : le moteur de questions est désactivé."}}` |
| `ANTHROPIC_API_KEY` absente | 503 | `{"erreur":{"code":"configuration","message":"ANTHROPIC_API_KEY absente : le moteur de questions est désactivé."}}` |
| `NEXT_PUBLIC_SUPABASE_URL` absente | 503 | `{"erreur":{"code":"configuration","message":"NEXT_PUBLIC_SUPABASE_URL manquant — cf. .env.example."}}` |
| `SUPABASE_SERVICE_ROLE_KEY` absente | 503 | `{"erreur":{"code":"configuration","message":"SUPABASE_SERVICE_ROLE_KEY manquant — requis côté serveur uniquement, cf. .env.example."}}` |
| Schéma non appliqué | 502 | `code: "base"`, message contenant « Vérifier que supabase/schema.sql a bien été exécuté » |
| Question < 10 caractères | 400 | `code: "question_invalide"` |
| Question > 400 caractères | 400 | `code: "question_invalide"` |
| Corps non-JSON | 400 | `code: "corps_invalide"` |
| 6ᵉ question en moins d'une minute | 429 | `code: "trop_de_requetes"` |

`GET /api/question` ne renvoie **jamais** de valeur de clé, seulement la liste des noms manquants.

---

## 5. Estimation de coût mensuel

### Hypothèses — à relire avant de croire le résultat

| # | Hypothèse | Valeur retenue | Solidité |
| --- | --- | --- | --- |
| H1 | Passages indexés | **2 847** | **Mesurée** par indexation réelle du corpus du 07/09/2026 |
| H2 | Volume de l'index | **1 381 451 caractères** | **Mesurée** |
| H3 | Ratio caractères → tokens (français) | **3,6 car./token** ⇒ ~384 000 tokens | Approximation. Fourchette réaliste 3,2 à 4,0, soit 345 000 à 432 000 tokens |
| H4 | Prix embedding Voyage (`voyage-4-lite`) | **0,02 $ / M tokens** | **La plus fragile.** Ordre de grandeur des modèles « lite », **non vérifié** : aucun accès à la grille tarifaire. **À confirmer sur <https://www.voyageai.com/pricing>.** |
| H5 | Volume de questions | **300 questions/mois**, dont **40 % servies par le cache** ⇒ 180 appels payants | Pure hypothèse : la page n'a aucun historique de trafic |
| H6 | Entrée par question | **16 285 caractères ⇒ ~4 520 tokens** | **Mesurée** sur une requête réelle à 18 passages : 12 302 car. de contexte + 1 653 de consigne système + 1 925 de schéma d'outil. Plafond dur : ~21 800 car. ≈ 6 050 tokens |
| H7 | Sortie par question | **~1 400 tokens** (plafond dur 2 600) | Estimée d'après la longueur des 14 perspectives manuelles |
| H8 | Prix Claude Sonnet | **3 $ / M en entrée, 15 $ / M en sortie** | Grille stable depuis plusieurs versions, mais **à confirmer** pour le modèle exact retenu |
| H9 | Supabase | **0 $** | Projet mutualisé déjà payé ; le RAG ajoute **41 Mo mesurés** (table + TOAST + index HNSW) |

> H6 corrige l'estimation précédente, qui retenait 3 500 tokens d'entrée : elle oubliait la consigne
> système et le schéma d'outil, soit ~1 000 tokens par appel, ~30 % du poste. C'est le seul écart
> significatif entre l'estimation d'origine et la mesure.

### Calcul

**Indexation initiale, une seule fois**

```
384 000 tokens ÷ 1 000 000 × 0,02 $  =  0,0077 $        (moins d'un centime)
```

**Réindexation mensuelle** — la veille modifie une poignée de fiches, disons 100 passages/mois :

```
100 × 485 car. ÷ 3,6 = 13 500 tokens → 0,0003 $         (négligeable)
```

**Questions** — 180 appels payants par mois :

```
Embedding des questions : 180 × 30 tokens = 5 400 tokens     → 0,0001 $
Entrée Claude  : 180 × 4 520  =   813 600 tokens × 3 $/M     → 2,44 $
Sortie Claude  : 180 × 1 400  =   252 000 tokens × 15 $/M    → 3,78 $
```

### Résultat

| Poste | Coût mensuel |
| --- | --- |
| Embeddings (indexation + questions) | **< 0,01 $** |
| Génération des réponses (Anthropic) | **≈ 6,20 $** |
| Supabase | **0 $** (mutualisé, déjà payé) |
| **Total** | **≈ 6,20 $/mois**, soit ~5,80 € |

**Coût unitaire d'une question non cachée : ≈ 0,035 $, soit 3,5 centimes.**

### Ce que cette estimation vaut vraiment

Elle est **entièrement pilotée par H5** — le nombre de questions posées, sur lequel il n'existe
aucune donnée. Le reste ne bouge presque pas :

| Trafic mensuel (40 % de cache) | Coût estimé |
| --- | --- |
| 100 questions | ~2,10 $ |
| 300 questions (hypothèse retenue) | ~6,20 $ |
| 1 000 questions | ~21 $ |
| 10 000 questions (page virale) | ~210 $ |

**Ce qui peut faire déraper la facture, par ordre de probabilité :**

1. **Un robot d'indexation qui découvre le champ de question.** Le limiteur (5 questions/minute) est
   **par instance serverless** : sur Vercel, plusieurs instances coexistent, donc le plafond réel
   est un multiple inconnu de 5/min. Ce n'est pas un anti-abus sérieux. Si la page prend du trafic,
   il faut un compteur partagé (table Supabase ou Upstash) — non fait.
2. **Un cache qui ne prend pas.** Les questions étant en texte libre, deux formulations éloignées
   produisent deux entrées. À 0 % de cache, 300 questions coûtent ~10,40 $/mois au lieu de 6,20 $.
   (La normalisation fonctionne bien sur les variantes proches : accents, ponctuation, majuscules et
   espaces multiples partagent la même entrée — vérifié.)
3. **Un `--force` malencontreux** sur l'indexeur : réindexation complète, ~0,008 $. Sans gravité.

Les plafonds *durs*, tous vérifiés par exécution : `MAX_PASSAGES=18` et `MAX_CARACTERES=18000`
(coût d'entrée — le second borne désormais le contexte **réellement envoyé**, en-têtes compris, ce
qui n'était pas le cas avant la correction du 07/09), `MAX_TOKENS=2600` (coût de sortie), le seuil
de pertinence (une question hors sujet ne déclenche **aucun** appel au modèle), et le cache. Tous
réglables dans `.env.local`.

---

## 6. Ce que le moteur refuse de faire — vérifié

1. **Pas de réponse de complaisance.** Vérifié de bout en bout via `POST /api/question` : quand le
   meilleur passage est sous `ATLAS_RAG_SEUIL_PERTINENCE`, le moteur renvoie `statut: "hors_corpus"`,
   `perspectives: []`, **et n'appelle pas le modèle**. Quand rien n'atteint
   `ATLAS_RAG_SEUIL_SIMILARITE`, il renvoie `statut: "corpus_vide"`. Quand il y a moins de
   `ATLAS_RAG_MIN_PASSAGES` extraits au-dessus du seuil, il refuse aussi — et depuis le 07/09 il le
   dit avec un message distinct, car ces trois refus se règlent avec des boutons différents.
2. **Pas de source inventée.** Vérifié : un identifiant de fiche absent du contexte est ignoré, un
   avertissement est émis, et la perspective concernée voit sa confiance ramenée à « hypothèse
   prospective ». Les sources affichées sont lues dans `data/seed/`, jamais produites par le modèle.
   Vérifié aussi : un passage dont la fiche a disparu du corpus (index en retard) est **écarté**, au
   lieu d'être présenté au lecteur comme une source avec un lien mort.
3. **Pas de verdict unique.** La sortie est forcée en appel d'outil structuré (`tool_choice` vérifié
   dans la requête réellement envoyée) : le format n'admet qu'un **tableau** de perspectives. Une
   réponse à perspective unique est affichée avec un avertissement explicite.
4. **Pas de plafond de coût décoratif.** Vérifié sur entrée synthétique : au plus 2 passages par
   fiche, au plus 18 passages, et un contexte qui reste sous 18 000 caractères (17 982 mesurés dans
   le pire cas testé).
5. **Pas de facture doublée pour une question répétée.** Vérifié : deux questions identiques ⇒
   **un seul** appel au modèle ; le TTL expiré rouvre bien un appel ; `atlas_rag_purger_cache(0)`
   vide tout.

---

## 7. Réglage du seuil de pertinence

C'est le seul réglage qui demande un vrai arbitrage, et **il ne peut être fait qu'avec de vraies
clés** : aucun embedding sémantique n'a été produit ici.

- **Trop haut** (0,6+) : le moteur refuse des questions qu'il pourrait traiter. Frustrant, mais
  honnête et gratuit.
- **Trop bas** (0,3-) : il répond à tout, y compris avec des extraits hors sujet, et produit des
  perspectives creuses. C'est le scénario à éviter — il coûte de l'argent ET abîme la crédibilité
  du référentiel.

Méthode : poser les 4 questions-tests, puis 3 questions volontairement hors périmètre (« quelle est
la recette du kouign-amann ? »). Les premières doivent passer, les secondes être refusées. Ajuster
`ATLAS_RAG_SEUIL_PERTINENCE` dans `.env.local` jusqu'à ce que ce soit le cas.

**Le cache tient compte du seuil depuis le 07/09** : changer `ATLAS_RAG_SEUIL_PERTINENCE` produit de
nouvelles réponses au lieu de resservir les anciennes. Sans cette correction, la méthode ci-dessus ne
mesurait rien à partir de la deuxième itération.

La valeur par défaut (0,45) est un point de départ raisonné, **pas** une valeur mesurée.

---

## 8. Ce qui risque encore de casser au premier lancement

Classé par probabilité décroissante. Les points 3, 5, 6 et 8 de la version précédente ont été
**vérifiés ou corrigés** et ne figurent plus ici.

1. **Le nom du modèle d'embedding.** `voyage-4-lite` vient du commentaire d'en-tête de
   `supabase/schema.sql`, pas d'une vérification chez Voyage. Si le modèle n'existe pas ou ne rend
   pas 1 024 dimensions, l'indexeur s'arrête dès le premier lot.
   *Symptôme* : `Voyage a refusé la requête` ou `Dimension inattendue`.
   *Correctif* : ajuster `VOYAGE_MODELE_EMBEDDING` dans `.env.local`. Si le modèle retenu rend une
   autre dimension, il faut **une nouvelle table** (`atlas_rag_passages_v2`), pas un `ALTER COLUMN` :
   altérer le type détruirait tous les vecteurs déjà payés.
2. **Le nom du modèle Anthropic.** `claude-sonnet-4-5` est un défaut raisonnable, non vérifié contre
   la liste des modèles du compte. *Symptôme* : `Anthropic a refusé la requête : model not found`,
   renvoyé tel quel en 502 par `/api/question`. *Correctif* : `ATLAS_MODELE_REPONSE`.
3. **La pertinence de la recherche, et le seuil qui la gouverne.** Point le plus incertain du lot, et
   non détectable techniquement : le pipeline peut fonctionner parfaitement et rendre des réponses
   médiocres. Aucun vecteur sémantique réel n'a été produit. Voir §7.
4. **Le respect du schéma d'outil par le modèle.** Le décodage a été éprouvé avec une réponse
   fabriquée, y compris les cas dégradés (identifiant inventé, perspective vide). Ce qui n'a pas pu
   l'être, c'est que le modèle réel remplisse honnêtement `niveau_confiance` et
   `fiches_mobilisees`.
5. **La traduction HTTP→SQL de PostgREST.** Simulée, pas exécutée (cf. §0). Le cas qui inquiétait —
   un tableau JSON converti en `vector(1024)` — fonctionne au niveau SQL. *Symptôme en cas de
   problème* : erreur de cast sur `atlas_rag_rechercher_passages`. *Correctif de repli* : déclarer le
   paramètre `requete` en `text` et le convertir par `requete::vector(1024)` dans le corps de la
   fonction.
6. **Le plafond de lignes de PostgREST.** L'indexeur pagine par 1 000 lignes et s'arrête quand une
   page est incomplète ; la logique a été éprouvée contre un plafond de 1 000 reproduit
   fidèlement (3 pages pour 2 847 passages), mais pas contre le vrai PostgREST.

---

## 9. Ce qui n'est pas fait

- Les tables `atlas_fiches_*` du Lot 1 restent **vides** : le corpus vit dans `data/seed/*.json` et
  le RAG le lit de là. C'est pourquoi `atlas_rag_passages.fiche_id` n'a **aucune clé étrangère** vers
  elles — en poser une ferait échouer 100 % des insertions. Conséquence assumée : l'index peut
  diverger du corpus, ce que le moteur détecte et signale désormais (cf. §6.2), et que
  `--purger` répare.
- Les colonnes `embedding` de `atlas_fiches_*` (Lot 1) ne sont pas utilisées, et les deux index
  IVFFlat créés sur elles restent inertes. Ils n'ont pas été supprimés : ils appartiennent au
  schéma du Lot 1, et ce fichier ne détruit rien.
- Pas de limitation de débit partagée entre instances (cf. §5).
- Pas d'historique des questions posées visible sur `/questions` : le cache le contient
  (`select question, nb_utilisations from atlas_rag_cache_reponses order by nb_utilisations desc`),
  mais aucune page ne l'affiche.
- Pas de journalisation des coûts réels dans une page d'administration. Les colonnes
  `tokens_entree` / `tokens_sortie` de `atlas_rag_cache_reponses` enregistrent la consommation
  réelle de chaque réponse : c'est la seule mesure fiable, et elle est plus fiable que tout le §5.
- Les réponses de **refus** ne sont pas mises en cache : une question hors sujet posée dix fois coûte
  dix embeddings (quelques millièmes de centime). Volontaire — mettre les refus en cache figerait le
  refus alors que le corpus s'enrichit chaque semaine.

---

## Annexe — défauts trouvés et corrigés le 07/09/2026

Trouvés en faisant tourner la chaîne, pas en la relisant. Aucun n'était visible à la lecture du code.

| # | Où | Défaut | Conséquence si non corrigé |
| --- | --- | --- | --- |
| 1 | `supabase/schema.sql` | `hnsw.ef_search` laissé à 40 alors que la fonction de recherche demande jusqu'à 100 lignes | **Le plus grave.** Un parcours d'index HNSW rend au plus `ef_search` lignes : la route en réclame 54 et n'en recevait que **40**, silencieusement. Invisible tant que la table est petite (le planificateur préfère alors un parcours séquentiel), puis le moteur trouve moins de matière, passe sous `MIN_PASSAGES` et refuse des questions qu'il traitait la veille. Reproduit puis corrigé (`set hnsw.ef_search = 200`, plus `ivfflat.probes = 10` pour le repli) |
| 2 | `supabase/schema.sql` | Le fichier supposait que `vector` était visible dans le `search_path` de la session | Si pgvector est installé dans le schéma `extensions` — cas normal d'un projet Supabase — le fichier échoue dès la **première table** sur `type "vector" does not exist`. Reproduit. Corrigé par un `set search_path = public, extensions` explicite |
| 3 | `supabase/schema.sql` | `create extension if not exists vector` sans schéma | Sur un projet où l'extension n'est pas déjà là, elle atterrit dans `public` et y déverse ~120 fonctions et types sans préfixe `atlas_`, dans une base partagée avec d'autres applications. Corrigé : le schéma `extensions` est préféré s'il existe |
| 4 | `lib/rag.ts` | `MAX_CARACTERES_CONTEXTE` ne comptait que le champ `texte` | Le contexte réellement envoyé dépassait le plafond de ~9 % (19 617 car. pour un plafond de 18 000), en-têtes d'ancrage non comptés. Un plafond de coût qui ne borne pas ce qui part au modèle ne borne rien. Corrigé : la sélection mesure l'extrait tel qu'il sera envoyé |
| 5 | `lib/rag.ts` | La clé de cache ignorait les seuils | Changer `ATLAS_RAG_SEUIL_PERTINENCE` resservait la réponse calculée avec l'ancien seuil : la méthode de réglage du §7 ne mesurait rien à partir de la 2ᵉ itération. Corrigé (la clé inclut désormais seuils, minimum et plafonds, version `v2` — les entrées existantes sont donc invalidées, ce qui est voulu) |
| 6 | `lib/rag.ts` | Un passage dont la fiche a disparu du corpus était affiché comme source | `fiches_mobilisees` contenait une entrée avec `url: ""` — un lien mort présenté au lecteur comme une source, et une fiche que le modèle pouvait citer. Arrive dès qu'une fiche est renommée ou supprimée sans `--purger`. Corrigé : ces passages sont écartés et un avertissement nomme le correctif |
| 7 | `lib/rag.ts` | Un seul message pour deux refus différents | Le refus « pas assez de passages » affichait le seuil de pertinence, donc un message qui se contredit (`meilleure similarité 0.31, seuil 0.2`) et pousse à régler le mauvais bouton. Corrigé : trois refus, trois messages |

Non corrigé, hors périmètre de ce lot : `npm run lint` signale 2 erreurs et 1 avertissement dans
`components/` (`BasculeTheme.tsx`, `VeilleClient.tsx`, `CartographieClient.tsx`), sans rapport avec
le RAG.

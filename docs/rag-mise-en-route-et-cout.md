# Moteur de réponse prédictive (RAG) — mise en route et coût

Lot MP-4 · rédigé le 07/09/2026 · cible : projet Supabase **mutualisé** `cvmsozjxpjzvyhinvooa`

Ce document couvre deux choses : ce que Julien doit exécuter sur son Mac pour rendre le moteur
vivant, et ce que ça va coûter par mois — avec les hypothèses de calcul écrites, parce qu'une
estimation dont on ne peut pas rejouer le calcul ne vaut rien.

---

## 0. Ce qui est livré, ce qui ne l'est pas

Livré et vérifiable hors ligne :

| Fichier | Rôle |
| --- | --- |
| `supabase/schema.sql` | Tables `atlas_rag_passages` et `atlas_rag_cache_reponses`, index vectoriel, 4 fonctions `atlas_rag_*` |
| `scripts/indexer-corpus.mjs` | Découpe le corpus en passages, calcule les embeddings, les écrit — idempotent |
| `lib/rag.ts` | Recherche vectorielle, garde-fous, appel modèle, rattachement des sources réelles |
| `app/api/question/route.ts` | `POST /api/question` (réponse) et `GET /api/question` (diagnostic de configuration) |
| `components/QuestionLibreClient.tsx` | Champ de question libre sur `/questions` |
| `scripts/comparer-qualite-rag.mjs` | Compare la sortie du moteur aux 4 réponses manuelles, champ par champ |
| `.env.example` | Les 5 variables obligatoires, commentées |

**Ce qui a été réellement éprouvé** (sans aucune clé d'API) :

- `supabase/schema.sql` a été **exécuté contre un vrai PostgreSQL 16**, avec un bouchon
  reproduisant le type `vector` et l'opérateur `<=>` de pgvector. Les tables, contraintes,
  fonctions et commentaires s'appliquent sans erreur ; le fichier rejoué deux fois de suite ne
  produit aucune erreur (idempotence vérifiée) ; l'`upsert` sur la clé naturelle met à jour au
  lieu de dupliquer ; les fonctions de cache et de statistiques ont été testées avec des données,
  y compris sur les cas limites (TTL expiré, empreinte inconnue, paramètres `null`) ; et il a été
  vérifié qu'une policy modifiée à la main **survit** à une réexécution du fichier — la garantie
  de non-écrasement qu'impose le projet mutualisé.
- `scripts/indexer-corpus.mjs` et `scripts/comparer-qualite-rag.mjs` tournent réellement :
  découpage du corpus, aide en ligne, codes de sortie, modes `--dry-run` / `--json` / `--type` /
  `--reponse`.

**Ce qui n'a PAS pu être vérifié** : aucun appel à Voyage ni à Anthropic, aucune connexion à un
vrai Supabase, aucun `npm run build` (registre npm inaccessible, `node_modules` absent), et
surtout **aucune recherche vectorielle réelle** — le bouchon de test rend une distance constante,
il valide la syntaxe SQL, pas la pertinence. La liste précise des endroits où ça peut casser au
premier lancement est en section 5 — **la lire avant de lancer**, elle est plus utile que le reste
du document.

---

## 1. Mise en route, dans l'ordre

### Étape 1 — Créer les tables (5 minutes, gratuit)

1. Ouvrir <https://supabase.com/dashboard> → projet `cvmsozjxpjzvyhinvooa` → **SQL Editor**.
2. Coller **tout** le contenu de `supabase/schema.sql`, puis « Run ».
3. Vérifier qu'il n'y a pas d'erreur rouge. Le fichier est idempotent : s'il a déjà été exécuté,
   le rejouer ne casse rien et ne recrée rien.

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
existante. Les tables du RAG ont RLS activée **sans aucune policy** : elles sont donc
inaccessibles aux rôles `anon` et `authenticated`, et seul `service_role` y accède.

Contrôle rapide, dans le même éditeur SQL :

```sql
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like 'atlas_rag%';
```

### Étape 2 — Renseigner les clés (10 minutes)

```bash
cd ~/chemin/vers/Atlas-Humain-IA
cp .env.example .env.local
open -e .env.local          # ou l'éditeur de votre choix
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

### Étape 3 — Simuler l'indexation (gratuit, aucune clé requise)

```bash
npm install                                # une seule fois
node scripts/indexer-corpus.mjs --dry-run
```

Sortie attendue, mesurée sur le corpus du 07/09/2026 :

```
Corpus : 267 fiches humaines · 44 fiches IA · 201 fiches de gap
Passages construits : 2847 (humaine 1066 · ia 173 · gap 1608)
Volume total : 1 342 622 caractères ≈ 372 951 tokens
Mode --dry-run : aucune API appelée, aucune écriture en base, aucun coût engagé.
```

Ce mode n'appelle rien et n'écrit rien. Si ces chiffres n'apparaissent pas, inutile d'aller
plus loin.

### Étape 4 — Indexer pour de vrai

D'abord un test à 10 passages, pour vérifier que la clé Voyage et le nom du modèle sont bons
sans engager la dépense complète :

```bash
node scripts/indexer-corpus.mjs --limite=10
node scripts/indexer-corpus.mjs --etat        # doit afficher 10 passages vectorisés
```

Si c'est propre, l'indexation complète (une seule fois, ~5 à 10 minutes) :

```bash
node scripts/indexer-corpus.mjs
```

Le script est **idempotent** : le relancer sans avoir touché au corpus n'appelle aucune API et
affiche `Rien à faire — l'index est déjà à jour.` Après une modification de fiches, il ne
réindexe que les passages dont le texte a changé. En cas d'interruption (coupure réseau, quota),
relancer la même commande : il reprend exactement là où il s'est arrêté.

Options utiles : `--type=gap`, `--force` (tout réindexer, coûteux), `--purger` (retirer de la
base les passages disparus du corpus), `--json`, `--aide`.

### Étape 5 — Essayer

```bash
npm run dev
# puis http://localhost:3000/questions
```

Le champ « Poser une question au référentiel » est en haut de la page. Les 4 questions manuelles
sont en dessous, inchangées.

En ligne de commande :

```bash
curl -s localhost:3000/api/question | jq          # diagnostic : clés présentes ?
curl -s localhost:3000/api/question \
  -H 'Content-Type: application/json' \
  -d '{"question":"Les modèles économiques mondiaux actuels sont-ils optimaux ?"}' \
  > /tmp/reponse.json
```

### Étape 6 — Contrôler la qualité contre l'étalon

```bash
node scripts/comparer-qualite-rag.mjs                          # contrat + écarts connus
node scripts/comparer-qualite-rag.mjs --reponse=/tmp/reponse.json   # comparaison réelle
```

Le second mode est le seul qui prouve quelque chose. Il compare, champ par champ, la réponse
générée aux 14 perspectives rédigées à la main, et sort en code 1 si elle est en dessous.
**À faire tourner sur les 4 questions-tests avant toute publication.**

### Étape 7 — Déployer

Reporter les 5 variables dans Vercel (projet `atlas-humain-ia` → Settings → Environment
Variables), en marquant `SUPABASE_SERVICE_ROLE_KEY`, `VOYAGE_API_KEY` et `ANTHROPIC_API_KEY`
comme *Sensitive*. Puis `git push origin main`.

L'index vit dans Supabase, pas dans le dépôt : il n'y a rien à réindexer après un déploiement.
En revanche, **après chaque réindexation, purger le cache** pour que les réponses tiennent
compte des fiches modifiées :

```sql
select atlas_rag_purger_cache(0);
```

---

## 2. Estimation de coût mensuel

### Hypothèses — à relire avant de croire le résultat

| # | Hypothèse | Valeur retenue | Solidité |
| --- | --- | --- | --- |
| H1 | Passages indexés | **2 847** | **Mesurée** par `--dry-run` sur le corpus du 07/09/2026 |
| H2 | Volume de l'index | **1 342 622 caractères** | **Mesurée** |
| H3 | Ratio caractères → tokens (français) | **3,6 car./token** ⇒ ~373 000 tokens | Approximation. Le français consomme plus de tokens que l'anglais ; la fourchette réaliste est 3,2 à 4,0, soit 335 000 à 420 000 tokens |
| H4 | Prix embedding Voyage (`voyage-4-lite`) | **0,02 $ / M tokens** | **La plus fragile.** Ordre de grandeur des modèles « lite » de Voyage, non revérifié sur la grille tarifaire du 07/09/2026 — je n'avais pas d'accès réseau pour le confirmer. **À vérifier sur <https://www.voyageai.com/pricing> avant de s'engager.** |
| H5 | Volume de questions | **300 questions/mois**, dont **40 % servies par le cache** ⇒ 180 appels payants | Pure hypothèse : le site n'a aucun historique de trafic sur cette page |
| H6 | Contexte par question | 18 passages × ~470 car. + consigne système ⇒ **~3 500 tokens d'entrée** | Calculée depuis les plafonds du code (`MAX_PASSAGES=18`, `MAX_CARACTERES=18000`) |
| H7 | Sortie par question | **~1 400 tokens** (plafond dur 2 600) | Estimée d'après la longueur des 14 perspectives manuelles (~1 000 car./perspective × 3) |
| H8 | Prix Claude Sonnet | **3 $ / M tokens en entrée, 15 $ / M en sortie** | Grille Sonnet stable depuis plusieurs versions, mais **à confirmer** pour le modèle exact retenu |
| H9 | Supabase | **0 $** | Le projet est mutualisé et déjà payé ; le RAG ajoute ~30 Mo de vecteurs (2 847 × 1024 × 4 octets ≈ 11,7 Mo, ~30 Mo avec l'index HNSW et le texte) |

### Calcul

**Indexation initiale, une seule fois**

```
373 000 tokens ÷ 1 000 000 × 0,02 $  =  0,0075 $        (moins d'un centime)
```

**Réindexation mensuelle** — la veille modifie une poignée de fiches, disons 100 passages/mois :

```
100 × 470 car. ÷ 3,6 = 13 000 tokens → 0,0003 $         (négligeable)
```

**Questions** — 180 appels payants par mois :

```
Embedding des questions : 180 × 30 tokens = 5 400 tokens     → 0,0001 $
Entrée Claude  : 180 × 3 500  =   630 000 tokens × 3 $/M     → 1,89 $
Sortie Claude  : 180 × 1 400  =   252 000 tokens × 15 $/M    → 3,78 $
```

### Résultat

| Poste | Coût mensuel |
| --- | --- |
| Embeddings (indexation + questions) | **< 0,01 $** |
| Génération des réponses (Anthropic) | **≈ 5,70 $** |
| Supabase | **0 $** (mutualisé, déjà payé) |
| **Total** | **≈ 5,70 $/mois**, soit ~5,30 € |

**Coût unitaire d'une question non cachée : ≈ 0,032 $, soit 3 centimes.**

### Ce que cette estimation vaut vraiment

Elle est **entièrement pilotée par H5** — le nombre de questions posées, sur lequel je n'ai
aucune donnée. Le reste ne bouge presque pas :

| Trafic mensuel | Coût estimé |
| --- | --- |
| 100 questions | ~1,90 $ |
| 300 questions (hypothèse retenue) | ~5,70 $ |
| 1 000 questions | ~19 $ |
| 10 000 questions (page virale) | ~190 $ |

Les prix unitaires (H4, H8) n'ont **pas** pu être vérifiés au 07/09/2026, faute d'accès réseau
au moment de la rédaction. Si le prix de Voyage était dix fois supérieur à H4, la conclusion ne
changerait pas (le poste embedding resterait sous 0,10 $/mois). Si le prix d'Anthropic avait
doublé, le total doublerait — c'est le seul poste qui compte.

**Ce qui peut faire déraper la facture, par ordre de probabilité :**

1. **Un robot d'indexation qui découvre le champ de question.** Le limiteur de débit
   (5 questions/minute) est **par instance serverless** : sur Vercel, plusieurs instances
   coexistent, donc le plafond réel est un multiple inconnu de 5/min. Ce n'est pas un anti-abus
   sérieux. Si la page prend du trafic, il faut un compteur partagé (une table Supabase ou
   Upstash) — non fait ici.
2. **Un cache qui ne prend pas.** Les questions étant en texte libre, deux formulations proches
   produisent deux entrées de cache. Le taux de 40 % de H5 est optimiste ; à 0 % de cache, le
   coût monte à ~9,50 $/mois pour 300 questions.
3. **Un `--force` malencontreux** sur l'indexeur : réindexation complète, ~0,008 $. Sans gravité.

Les plafonds *durs* qui protègent réellement : `MAX_PASSAGES=18` et `MAX_CARACTERES=18000`
(coût d'entrée), `MAX_TOKENS=2600` (coût de sortie), le seuil de pertinence (une question hors
sujet ne déclenche **aucun** appel au modèle), et le cache. Tous réglables dans `.env.local`.

---

## 3. Ce que le moteur refuse de faire

Trois garde-fous sont implémentés, pas seulement documentés :

1. **Pas de réponse de complaisance.** Si le meilleur passage du corpus est sous le seuil de
   similarité (`ATLAS_RAG_SEUIL_PERTINENCE`, 0,45 par défaut), ou s'il y a moins de 3 passages
   pertinents, le moteur renvoie un refus explicite et **n'appelle pas le modèle** — donc ne
   paie rien. Les extraits les plus proches sont quand même affichés, pour que le lecteur
   comprenne pourquoi le corpus ne répond pas.
2. **Pas de source inventée.** Le modèle ne produit jamais de bibliographie : il cite des
   `fiche_id` recopiés du contexte, et `lib/rag.ts` reconstruit les sources depuis
   `lib/corpus.ts`. Un identifiant absent du contexte est ignoré et signalé. Une perspective
   qui finit sans aucune source réelle voit sa confiance ramenée à « hypothèse prospective »,
   avec un avertissement affiché.
3. **Pas de verdict unique.** La sortie est forcée en appel d'outil structuré : le format
   n'admet qu'un **tableau** de perspectives. Une réponse à perspective unique est affichée avec
   un avertissement explicite disant qu'elle est en deçà de la règle de neutralité active.

---

## 4. Réglage du seuil de pertinence

C'est le seul réglage qui demande un vrai arbitrage, et il ne peut être fait qu'avec de vraies
réponses sous les yeux.

- **Trop haut** (0,6+) : le moteur refuse des questions qu'il pourrait traiter. Frustrant, mais
  honnête et gratuit.
- **Trop bas** (0,3-) : il répond à tout, y compris avec des extraits hors sujet, et produit des
  perspectives creuses. C'est le scénario à éviter — il coûte de l'argent ET abîme la crédibilité
  du référentiel.

Méthode : poser les 4 questions-tests, puis 3 questions volontairement hors périmètre (« quelle
est la recette du kouign-amann ? »). Les premières doivent passer, les secondes doivent être
refusées. Ajuster `ATLAS_RAG_SEUIL_PERTINENCE` dans `.env.local` jusqu'à ce que ce soit le cas.
La valeur par défaut (0,45) est un point de départ raisonné, **pas** une valeur mesurée : je
n'ai pas pu produire un seul embedding réel.

---

## 5. Ce qui risque de casser au premier lancement

Classé par probabilité décroissante. Aucun de ces points n'a pu être testé.

1. **Le nom du modèle d'embedding.** `voyage-4-lite` vient du commentaire d'en-tête de
   `supabase/schema.sql`, pas d'une vérification chez Voyage. Si le modèle n'existe pas ou ne
   rend pas 1024 dimensions, l'indexeur s'arrête avec un message explicite dès le premier lot.
   *Symptôme* : `Voyage a refusé la requête` ou `Dimension inattendue`.
   *Correctif* : ajuster `VOYAGE_MODELE_EMBEDDING` dans `.env.local`. Si le modèle retenu rend
   une autre dimension, il faut **une nouvelle table** (`atlas_rag_passages_v2`), pas un
   `ALTER COLUMN` : altérer le type détruirait tous les vecteurs déjà payés.
2. **Le nom du modèle Anthropic.** `claude-sonnet-4-5` est un défaut raisonnable, non vérifié
   contre la liste des modèles disponibles sur le compte. *Symptôme* : `Anthropic a refusé la
   requête : model not found`, renvoyé tel quel par `/api/question`. *Correctif* :
   `ATLAS_MODELE_REPONSE` dans `.env.local`.
3. **Le passage du vecteur à PostgREST.** `supabase.rpc()` envoie le vecteur comme tableau JSON,
   que PostgREST doit convertir en type `vector`. C'est le motif documenté par Supabase et il
   fonctionne en principe, mais je n'ai pas pu l'exécuter. *Symptôme* : erreur SQL de cast sur
   `atlas_rag_rechercher_passages`. *Correctif de repli* : déclarer le paramètre `requete` en
   `text` et le convertir par `requete::vector(1024)` dans le corps de la fonction.
4. **La pertinence de la recherche, et le seuil qui la gouverne.** C'est le point le plus
   incertain de tout le lot, et il n'est pas techniquement détectable : le pipeline peut
   fonctionner parfaitement et rendre des réponses médiocres si le seuil est mal réglé ou si les
   embeddings se comportent mal sur du français. Aucun vecteur réel n'a été produit. Voir la
   section 4 pour la méthode de réglage.
5. **L'emplacement de l'extension `vector`.** Selon l'âge du projet Supabase, elle est installée
   dans `public` ou dans `extensions`. Les fonctions déclarent `set search_path = public,
   extensions`, ce qui couvre les deux cas, mais si le projet l'a mise ailleurs, la création des
   fonctions échouera. *Symptôme* : `type "vector" does not exist` à l'exécution du SQL.
6. **L'index HNSW.** Sa création est encadrée par un bloc `DO` avec repli sur IVFFlat si la
   version de pgvector est trop ancienne. Le mécanisme de repli, lui, **a été exécuté et
   fonctionne** (le bouchon de test ne connaissait ni HNSW ni IVFFlat : l'exception a bien été
   rattrapée et le `NOTICE` émis). Ce qui n'a pas pu être testé, c'est la création effective d'un
   index HNSW sur de vrais vecteurs. *Symptôme d'un repli* : un `NOTICE` lors du SQL, puis une
   recherche fonctionnelle mais plus lente.
7. **Le build Next.js.** Ni `npm run build` ni `tsc` complet n'ont pu tourner (registre npm
   inaccessible, `node_modules` absent). Seule la syntaxe a été vérifiée, module par module, avec
   un `tsc` sans résolution de modules. Une erreur de typage à la compilation reste possible.
8. **La pagination PostgREST.** L'indexeur lit les empreintes existantes par pages de 1 000
   lignes, parce que PostgREST plafonne les réponses. Le corpus en produit 2 847. Si ce plafond
   était configuré différemment sur ce projet, la logique de pagination tient quand même (elle
   s'arrête quand une page est incomplète), mais elle n'a pas été éprouvée contre un vrai
   PostgREST.
9. **Deux doublons réels dans le corpus** (trouvés par l'indexeur, sans gravité) : les fiches IA
   `lstm` et `aide-a-la-decision-publique-govtech-ia` ont chacune deux entrées `usages` portant
   le **même** secteur. L'indexeur ignore la seconde et l'affiche en avertissement. À corriger
   dans `data/seed/fiches_ia.json` par le lot qui en a la charge — ce n'est pas un fichier que
   MP-4 est autorisé à toucher.

---

## 6. Ce qui n'est pas fait

- Les tables `atlas_fiches_humaines` / `atlas_fiches_ia` / `atlas_fiches_gap` du Lot 1 restent
  **vides** : le corpus vit dans `data/seed/*.json` et le RAG le lit de là. C'est pourquoi
  `atlas_rag_passages.fiche_id` n'a **aucune clé étrangère** vers elles — en poser une ferait
  échouer 100 % des insertions. Le jour où le corpus sera migré en base, la FK pourra être
  ajoutée.
- Les colonnes `embedding` de `atlas_fiches_*` (Lot 1) ne sont pas utilisées, et les deux index
  IVFFlat créés sur elles restent inertes (un index IVFFlat construit sur une table vide ne sert
  à rien). Ils n'ont pas été supprimés : ils appartiennent au schéma du Lot 1.
- Pas de limitation de débit partagée entre instances (cf. section 2).
- Pas d'historique des questions posées visible sur `/questions` : le cache le contient
  (`select question, nb_utilisations from atlas_rag_cache_reponses order by nb_utilisations desc`),
  mais aucune page ne l'affiche.
- Pas de journalisation des coûts réels dans une page d'administration. Les colonnes
  `tokens_entree` / `tokens_sortie` de `atlas_rag_cache_reponses` enregistrent la consommation
  réelle de chaque réponse : c'est la seule mesure fiable, et elle est plus fiable que tout ce
  qui est écrit en section 2.

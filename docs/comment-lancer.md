# COMMENT LANCER — Atlas Humain × IA

Dernière mise à jour : 06/09/2026 (référentiel de contenu terminé à 100% — 311/311 fiches documentées + 86 fiches de gap ; automatisation qualité : validateur d'intégrité, audit de fraîcheur, cron hebdomadaire ; **boucle de veille de bout en bout collecte → patch → validation → publication, section 7**)

## État actuel du projet

Le projet est un vrai projet Next.js fonctionnel, déjà buildé et testé (npm run build passe sans erreur),
versionné dans git, poussé sur GitHub (`https://github.com/julien2364/atlas`) et **déployé en ligne sur Vercel**
(voir section 0 ci-dessous).
Le site tourne sur des données locales (`data/seed/*.json` : 267 fiches humaines + 44 fiches IA + 86 fiches de gap),
sans avoir besoin de Supabase configuré pour l'instant — pratique pour visualiser tout de suite.
**Le corpus est intégralement documenté depuis le 06/09/2026 : 397/397 fiches au statut `documente`, plus aucune
fiche `a_documenter`.** Chaque fiche porte ses sources et sa date de dernière vérification.

**Le référentiel de contenu est terminé à 100% (311/311 fiches au statut `"documente"`, détail dans
`docs/brief-delegation-documentation.md`).** Les chantiers ouverts restants sont : validation de la file de
veille (184 entrées en attente), audit qualité de second passage, clé API Voyage AI (bloquée côté Julien),
et audit de `questions.json`.

Le comparateur (`/comparateur`) est désormais un vrai sélecteur libre (n'importe quelle paire fiche humaine ×
fiche IA), et la veille (`/veille`) tourne sur un pipeline RSS réel et testé, avec sa file de propositions
en attente de validation visible directement sur la page.

Diffusion : **publique** (`NEXT_PUBLIC_SITE_MODE=public`), décidée par Julien — site accessible à tous sur
l'URL Vercel ci-dessous, en attendant le domaine dédié `atlas.dyonysos.fr`.

## 0. Site en ligne et méthode de déploiement

**URL publique : https://atlas-humain-ia-dyonysos.vercel.app**

Le déploiement se fait désormais via GitHub → Vercel (méthode Git), et non plus par envoi manuel de fichiers :
chaque `git push` sur la branche `main` du repo `julien2364/atlas` déclenche automatiquement un nouveau
build et une mise en ligne sur Vercel (projet `atlas-humain-ia`, équipe Vercel "Dyonysos"). C'est beaucoup
plus fiable que l'ancienne méthode d'upload manuel, qui échouait systématiquement sur ce projet (34 fichiers
à renvoyer intégralement à chaque déploiement).

Pour mettre à jour le site : modifier le code localement, committer, puis :

```bash
git push origin main
```

Le déploiement en production se déclenche automatiquement (suivre l'avancement sur
https://vercel.com/dyonysos/atlas-humain-ia).

### Recevoir le travail d'une session Claude — une seule commande

Le proxy git des sessions Claude refuse de pousser vers `julien2364/atlas` (« not in this session's
authorized repository set ») : le dépôt n'est pas dans l'ensemble autorisé, et aucun jeton n'y change
rien. Le correctif durable est d'ajouter le dépôt aux sources de la session **à sa création**. En
attendant, la session produit un bundle et c'est le Mac qui pousse :

```bash
cd ~/Claude/atlas
./scripts/recevoir-et-pousser.sh
```

Sans argument, le script prend l'incrémental le plus récent de `~/Downloads` (`atlas-lots-*.bundle`),
et à défaut le bundle autonome. Il refuse d'avancer sur un arbre sale, **récupère d'abord ce que les
crons ont poussé**, applique le bundle, rejoue `npm run verifier`, puis pousse — ce qui déclenche Vercel.

Les crons de ce dépôt committent directement sur `main`, ce qui produit deux pannes distinctes, et il
faut les deux réponses :

1. **La copie locale est en retard.** Le bundle réclame un commit de cron que le Mac n'a pas :
   *« Le dépôt ne dispose pas des commits prérequis suivants »*. C'est ce qui s'est produit le
   7 septembre. Réponse : le `git fetch` préalable.
2. **Le bundle est en retard.** Un cron a poussé *après* sa fabrication, donc son sommet n'est plus un
   descendant du sommet local : *« Not possible to fast-forward »*. C'est le cas le plus fréquent,
   la veille tournant tous les jours. Réponse : le script récupère le bundle dans une réf locale et
   **rejoue ses commits par-dessus l'état courant**. En cas de conflit il abandonne proprement — dépôt
   intact, arbre propre, aucun rebase en suspens — et demande un bundle refabriqué.

Un bundle autonome ne sauve pas du second cas : historique complet ne veut pas dire fast-forward
possible. Si les historiques ont vraiment divergé (des commits locaux à toi *et* des commits distants),
le script affiche les deux listes et s'arrête plutôt que de choisir à ta place.

Côté session, le pendant est `npm run livrer` : il produit l'incrémental, un bundle autonome — utile
quand la copie de destination est restée longtemps en arrière — et l'archive complète du dépôt.

Prochaine étape (à faire par Julien dans les réglages Vercel) : ajouter `atlas.dyonysos.fr` comme domaine
personnalisé du projet, puis créer l'enregistrement DNS CNAME correspondant chez le fournisseur DNS de
dyonysos.fr.

## 1. Lancer le site en local (dès maintenant)

Dans le dossier `Atlas-Humain-IA` :

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000 — pages disponibles : accueil, /referentiel-humain, /referentiel-ia,
/cartographie, /comparateur, /questions, /veille, /methodologie.

## 2. État d'avancement par lot (cf. section 9 du mégaprompt)

- **Lot 1 — Architecture** : ✅ terminé (Next.js/Tailwind/TypeScript, modèle de données, schéma Supabase prêt dans `supabase/schema.sql`).
- **Lot 2/3 — Contenu des deux référentiels** : ✅ terminé (05-06/09/2026). Les 267 fiches humaines (philosophique 53, évolution 55, social_1 71, social_2 71, psychologique 12, sérénité 5) et les 44 fiches IA sont documentées, chacune à partir d'une source réellement consultée (articles Wikipédia FR, EN en repli, articles fondateurs arXiv/Nature/NeurIPS et documentation officielle pour les fiches IA) — jamais depuis la seule mémoire d'un modèle. Thèse centrale, apport, limites critiques, résonance IA, sources primaires/secondaires pour les fiches humaines ; capacités clés, usages sectoriels avec TRL, limites connues pour les fiches IA.
  Détail par fichier et méthode de recherche dans `docs/brief-delegation-documentation.md`.
- **Audit QA (05/09/2026)** : 🔍 fait. Julien a jugé la profondeur insuffisante — deux agents indépendants (visiteur/utilisateur + vérificateur professionnel) ont audité le site en conditions réelles. Corrections appliquées : rendu de `/referentiel-humain` réparé (n'affichait jamais le contenu des fiches documentées), garde-fou anti-régression ajouté à `scripts/generate-seed.mjs` (un incident réel pendant l'audit a démontré le risque : le script a écrasé silencieusement 6 fiches documentées avant d'être corrigé et les données restaurées), axes vides comblés. Le projet est maintenant versionné dans git en local.
- **Lot 4 — Moteur de gap analysis** : ✅ terminé (06/09/2026). 86 paires analysées (6 d'amorçage + 80 produites en lot), couvrant 86 capacités humaines distinctes croisées avec 37 fiches IA. Chaque fiche suit la méthodologie §5 du mégaprompt (apport et non-apport de l'IA, mécanisme, amélioration possible, mode d'interaction, substituabilité à 4 niveaux, scénarios présent/5 ans/15-20 ans) et le format enrichi du Lot 9 (sujet, sous-thèmes, axes de recherche, documents clés, trois axes prospectifs nommés avec niveau de confiance). Répartition de la substituabilité : 37 remplaçable avec supervision, 33 non remplaçable, 14 remplaçable avec une autre technologie nommée, 2 remplaçable totalement. Le sélecteur libre de `/comparateur` conserve son repli honnête « à documenter » pour les paires non analysées.
- **Lot 5 — Veille autonome** : 🔄 fonctionnel. Script réel `scripts/veille-rss.mjs` testé en conditions réelles : interroge les sources RSS actives, déduplique, dépose les nouveautés dans une file de validation manuelle affichée sur `/veille`. 5 sources actives sur 8 ; 3 désactivées après échec HTTP confirmé (Anthropic News 404, FMI et OCDE 403 — documenté dans `data/seed/veille_sources.json`). Un scheduled task quotidien (7h UTC) a été créé pour lancer ce script automatiquement, mais **il n'est pas encore lié à ton ordinateur** (approbation à donner côté device pour qu'il puisse s'exécuter — sinon il tourne dans le vide). Spiderfoot (2e canal) reste à intégrer. Depuis le 06/09/2026 la boucle est complète : `scripts/appliquer-veille.mjs` traduit les propositions triées en patchs de fiche relisibles (publiés comme artefact du cron quotidien) et `scripts/appliquer-patchs.mjs` les applique après relecture, avec entrée de changelog et restauration automatique en cas d'échec de validation — voir section 7. Aucune fiche n'est mise à jour automatiquement — validation humaine requise.
- **Lot 6 — Moteur Q&A/RAG** : ⛔ bloqué. Nécessite un projet Supabase (extension `vector`) + une clé API Anthropic configurés. Un compte Supabase existe déjà (org "julien2364's Org", plusieurs projets actifs) — reste à décider si Atlas Humain × IA doit avoir son propre projet Supabase dédié (coût à confirmer) ou être mutualisé dans un projet existant, décision qui te revient. Les 4 questions-tests restent répondues manuellement dans `/questions` en attendant.
- **Lot 7 — Cartographies interactives** : 🔄 fonctionnel. `/cartographie` propose une répartition par axe cliquable (humain et IA, avec liste des fiches et statut) et une matrice de gap cliquable sur les paires documentées, colorée par catégorie de substituabilité. La heatmap TRL par secteur et la frise chronologique (section 8 du mégaprompt) restent en attente : aucune fiche IA n'a encore de données réelles d'usages sectoriels renseignées.
- **Lot 8 — QA finale/publication** : 🔄 outillé (06/09/2026). Deux scripts et un cron hebdomadaire industrialisent le contrôle qualité et l'anti-obsolescence — voir la section 6 ci-dessous. La relecture éditoriale finale fiche par fiche reste à faire.

## 3. Pour activer Supabase (quand la profondeur du contenu le justifiera)

1. Créer un projet sur supabase.com, activer l'extension `vector`.
2. Exécuter `supabase/schema.sql` dans l'éditeur SQL du projet.
3. Copier `.env.example` vers `.env.local` et renseigner les clés.
4. Migrer les seeds JSON vers les tables (script de migration à écrire au Lot 2 avancé).

## 4. Continuer la production

Le mégaprompt (`megaprompt-atlas-humain-ia.md`, section 9 + section 13) reste la référence : les lots s'enchaînent
par itération, sans validation intermédiaire à chaque étape — seuls les jalons finaux sont à valider.

## 5. Emplacement des fichiers

- **Local** : `/Users/juliendaures/Claude/atlas/` (projet Next.js complet, cloné depuis GitHub)
- **GitHub** : `https://github.com/julien2364/atlas` (source de vérité du code, branche `main` = production Vercel)
- **Google Drive** : `megaprompt-atlas-humain-ia.md` et `comment-lancer-atlas-humain-ia.md` synchronisés (le code source du site n'est pas dupliqué sur Drive — seuls les documents de pilotage le sont, conformément aux instructions permanentes).

## 6. Qualité du corpus et anti-obsolescence (automatisé)

Deux scripts, sans dépendance externe ni appel réseau, et un cron hebdomadaire qui les enchaîne.

### `npm run valider` — validateur d'intégrité (`scripts/valider-donnees.mjs`)

Garde-fou anti-régression : il relit tout `data/seed/` et sort en code 1 si le corpus est cassé, ce qui
fait échouer la CI avant toute publication. Contrôles : JSON parsable, unicité des ids, champs obligatoires
selon `lib/types.ts`, enums valides (statuts, axes, secteurs, substituabilité, niveaux de confiance),
dates ISO jamais dans le futur, intégrité référentielle des fiches de gap (les deux fiches citées existent,
pas deux gaps sur la même paire, `technologie_complementaire` présent si et seulement si la substituabilité
le demande), TRL entre 1 et 9, URLs bien formées. Les faiblesses éditoriales (fiche sans source cliquable,
champ trop court, usage sans exemple) sortent en avertissement et ne bloquent pas — sauf avec `--strict`.
`--json` produit une sortie machine.

À lancer avant chaque publication et après toute modification en masse des données.

### `npm run audit-fraicheur` — anti-obsolescence (`scripts/audit-fraicheur.mjs`)

Applique le principe 3 du mégaprompt (aucune fiche n'est définitive) : toute fiche vérifiée il y a plus de
`--seuil` jours (180 par défaut) repasse au statut `a_re_auditer`, sans que son contenu ni sa date de
vérification ne soient touchés. `--dry-run` simule, `--limite=N` borne le nombre de bascules par exécution
(les plus anciennes d'abord) pour éviter un basculement massif d'un coup. Une entrée de changelog est ajoutée
uniquement si au moins une fiche bascule. Le script ne remet jamais une fiche en arrière : seul un travail
de re-documentation la fait repasser en `documente`.

### `npm run verifier-index` — l'index doit couvrir le corpus

`data/index-vectoriel.json` est versionné et sert la page `/questions`. Il se régénère
à la main, et rien ne le liait au corpus. Relevé le 10 septembre 2026 : l'index portait
**2 855 passages pour un corpus de 4 011** — 29 % du référentiel, dont les 300 fiches
de sociologie, psychologie et géopolitique ajoutées la veille, **étaient invisibles au
moteur de réponse**.

Rien ne le signalait : ni erreur, ni page cassée. Seulement des réponses qui ne
citaient jamais un tiers du corpus — le genre de défaut qu'on ne voit qu'en cherchant
ce qui manque.

L'index est régénéré, et le contrôle est désormais dans `npm run verifier`, donc dans
la CI de chaque push. Il distingue trois défauts qu'un simple comptage confondrait : un
passage jamais indexé, un passage indexé puis modifié, et une entrée d'index qui
survit à une fiche disparue. Correctif dans tous les cas : `npm run indexer`.

### Les crons GitHub Actions et la porte de vérification

| Workflow | Fréquence | Rôle |
|---|---|---|
| `verification-ci.yml` | à chaque push et PR sur `main` | validateur → **index** → types → lint → build, en parallèle du déploiement Vercel |
| `veille-cron.yml` | quotidien, 07h00 UTC | veille RSS → file de propositions → **pré-tri automatique** → patchs de fiche proposés, publiés comme artefact du job (section 7) |
| `qualite-cron.yml` | lundi, 06h00 UTC | validation → audit de fraîcheur → re-validation → commit → **liens du corpus** → **rendement de la veille** |
| `documentation-cron.yml` | mercredi, 05h30 UTC | propositions de sources pour les fiches à (re)documenter |

`verification-ci.yml` rejoue exactement `npm run verifier`, la même porte que le script de réception :
le local et la CI ne peuvent pas diverger. Les commits de cron portant `[skip ci]` sont ignorés — ils ne
touchent que la file de propositions, qu'aucune page ne rend.

Le cron documentation tournait toutes les 4 heures pour écluser le backlog initial ; il est passé en
hebdomadaire le 06/09/2026, ce backlog étant vide. Le cron qualité valide **avant et après** l'audit :
un corpus cassé fait échouer le job sans rien committer. Les trois crons sont aussi lançables à la main
depuis l'onglet Actions (`workflow_dispatch`), le cron qualité acceptant un `seuil` et un `dry_run`.


### Le rendement de la veille — `npm run rendement-veille` (`scripts/rendement-veille.mjs`)

Relevé du 10 septembre 2026, sur les 425 propositions accumulées : **6 ont abouti** à un
patch appliqué ou à une fiche créée, soit **1,4 %**. Cinq viennent de deux sources,
`nature-news` et `openai-news`. `anthropic-news` a été jugée 14 fois et rejetée 14 fois ;
`imf-news`, 12 sur 12.

Personne ne pouvait le voir : rien ne mesurait ce que les sources rapportent. Ce script
le fait, et il est branché dans le cron qualité hebdomadaire.

Il sépare deux choses que le total confond : une source **jugée en quantité et stérile**
a eu sa chance, une source **jamais jugée** a un rendement inconnu et non nul. Les 18
flux d'actualité, d'économie et de marchés ajoutés le 07/09 sont dans le second cas —
169 propositions, aucune triée. Le tableau ne les condamne pas, et le script le dit.

**La leçon, et elle vaut au-delà de la veille : une source qui répond n'est pas une
source qui nourrit.** Ces 18 flux avaient tous été vérifiés flux en main — ils
répondent, ils publient, leurs URL sont bonnes. Mais le référentiel documente des
capacités humaines et des systèmes d'IA, pas la conjoncture. C'est la seconde propriété
qui manquait au contrôle.

### Le tri de la file — `scripts/trier-veille.mjs`

C'est le maillon qui manquait. Le ciblage — désigner la fiche que vise une proposition
— n'est faisable ni par la collecte ni par un algorithme (voir plus bas), et il
supposait jusqu'ici d'éditer un JSON de 425 entrées à la main. Personne ne l'a fait,
d'où les 0 patch quotidiens.

```bash
node scripts/trier-veille.mjs --modele > /tmp/tri.txt   # gabarit : un id + un titre par ligne
# remplir /tmp/tri.txt
node scripts/trier-veille.mjs --decisions=/tmp/tri.txt              # simulation
node scripts/trier-veille.mjs --decisions=/tmp/tri.txt --appliquer
npm run veille-patchs                                              # les patchs sortent
```

Le format est volontairement pauvre — un identifiant, une espace, une décision — pour
se remplir dans n'importe quel éditeur : `humaine:<id>`, `ia:<id>`, `gap:<id>`,
`rejet`, ou `nouvelle` pour un sujet réel qu'aucune fiche ne couvre. Un préfixe de huit
caractères suffit. Chaque cible est contrôlée contre le corpus avant toute écriture :
un identifiant de fiche inexistant fait échouer le lot entier, pour qu'on n'applique
jamais un demi-tri.

**Premier passage, 10 septembre 2026 : 197 propositions triées — 187 rejets, 8
rattachements, 2 sujets neufs.** Le taux de rejet n'est pas un échec du tri, c'est la
mesure de ce que la file contenait. La chaîne a produit ses premiers patchs :
`data/patchs/patchs-veille-2026-09-10.json`, 8 patchs dont 2 mécaniques directement
applicables, les 6 autres marqués `a_reformuler` et refusés par
`appliquer-patchs.mjs` tant qu'un humain ne les a pas réécrits.

### Pourquoi le cron ne produisait aucun patch

La boucle annoncée est collecte → ciblage → patch → validation → publication. Elle
s'arrêtait au deuxième maillon, et le job était vert et muet : « 0 au statut
`a_traiter_fiche_existante`, 0 traitée », artefact vide, code de sortie 0, tous les
jours depuis la création du cron.

La cause est structurelle : `veille-rss.mjs` et `documentation-recherche.mjs` sont les
deux seuls producteurs et n'écrivent que `en_attente` ; seul un tri humain pose
`a_traiter_fiche_existante`. Le cron affiche désormais ce compte et cette raison dans
son résumé, au lieu de passer au vert en silence.

Un ciblage automatique a été tenté le 10/09 — recouvrement lexical pondéré par l'IDF,
en réutilisant le tokenizer du moteur de réponse — et **abandonné sur mesure** : sur les
197 propositions en attente, les meilleurs rattachements étaient du bruit (« Why we need
an International Panel on Inequality » vers la fiche d'un psychologue cognitiviste, deux
termes communs). Aucun seuil ne sépare le signal, parce qu'il n'y en a pas : 119 des 197
propositions sont en anglais face à un corpus français, et le reste porte sur la
conjoncture. Le problème n'est pas l'appariement, il est en amont.

### Le pré-tri de la file — `npm run pretri-veille` (`scripts/pretrier-veille.mjs`)

La collecte dépose une trentaine de propositions par jour ; l'arbitrage est humain. Sans contrepoids
l'écart se creuse tout seul : la file est passée de 136 à 238 entrées en attente entre le 7 et le
10 septembre 2026 sans qu'une seule décision ait été prise. Une file qu'on ne lit plus ne protège rien.

Le script écarte sur quatre critères vérifiables sans jugement — agrégateur masquant l'éditeur réel
(`news.google.com`), URL absente, doublon d'une entrée antérieure, URL déjà citée par une fiche — et
laisse tout le reste à la relecture, classé par fiabilité décroissante puis par proximité lexicale au
corpus. Cette proximité **ordonne** la file, elle ne ferme jamais une proposition : un sujet absent du
corpus est peut-être exactement le trou qu'il faut combler, et ce jugement n'appartient pas à un script.

```bash
npm run pretri-veille              # rapport seul, la file n'est pas touchée
node scripts/pretrier-veille.mjs --appliquer
```

Le rapport atterrit dans `docs/veille-pretri.md` — nom fixe, réécrit à chaque passage, l'historique
étant dans git — avec les trente premières propositions à relire,
lien compris. L'étape `--appliquer` tourne dans le cron quotidien, entre la collecte et la préparation
des patchs, avec re-validation du corpus avant commit.

**Pourquoi celle-là peut s'automatiser et pas la suivante.** Écarter une proposition ne modifie aucune
fiche ; l'accepter, si. La dissymétrie est ce qui permet d'automatiser une moitié du tri sans entamer la
règle « aucune fiche modifiée sans validation humaine ». C'est l'option C du point 1 de
`docs/decisions-ouvertes-2026-09-07.md`.

Premier passage, le 10 septembre : 41 des 238 écartées — 23 renvois Google News non attribuables et
18 doublons — 197 restant à relire.

## 7. La boucle de veille de bout en bout (collecte → patch → validation → publication)

C'est le cycle qui rend le référentiel *vivant* : la veille collecte, deux scripts traduisent les
propositions en modifications de fiches concrètes, un humain arbitre, le changelog garde la trace.

> **Règle absolue, sans exception : aucune fiche n'est jamais modifiée automatiquement.**
> `appliquer-veille.mjs` ne fait que **proposer** (il n'écrit qu'un fichier de patchs, jamais une fiche),
> et `appliquer-patchs.mjs` n'applique **que** ce qu'une personne a relu dans ce fichier.
> Aucun cron ne lance jamais l'application. Le script propose, l'humain dispose.

### Le cycle en cinq temps

| # | Étape | Commande | Qui | Écrit dans `data/seed/` ? |
|---|---|---|---|---|
| 1 | Collecte | `node scripts/veille-rss.mjs` · `node scripts/documentation-recherche.mjs` | cron | oui — `veille_queue.json` seulement |
| 2 | Tri / qualification | relecture de la file (statut `a_traiter_fiche_existante`, `a_traiter_nouvelle_fiche`, `rejete`) | humain / session Claude | oui — `veille_queue.json` seulement |
| 3 | **Proposition de patchs** | `npm run veille-patchs -- --limite=20` | cron (artefact) ou humain | **non** |
| 4 | **Relecture et arbitrage** | ouvrir le fichier de patchs, passer `retenu: false` sur ce qui est écarté, réécrire les textes marqués `a_reformuler` | **humain** (obligatoire) | non |
| 5 | **Publication** | `npm run appliquer-patchs -- --patchs=<fichier>` | **humain** | oui — fiches + `changelog.json` + `veille_queue.json` |

### 3. Proposer des patchs — `npm run veille-patchs` (`scripts/appliquer-veille.mjs`)

Lit les propositions de `data/seed/veille_queue.json` au statut voulu et produit, pour chacune, un **patch**
explicite : fiche cible, fichier qui la porte, champ visé, texte proposé, source à ajouter, points à vérifier.
Il n'applique rien et ne touche à aucune fiche.

```bash
npm run veille-patchs                       # toutes les propositions "a_traiter_fiche_existante"
npm run veille-patchs -- --limite=5          # les 5 premières
npm run veille-patchs -- --statut=a_traiter_nouvelle_fiche
npm run veille-patchs -- --sortie=/tmp/patchs.json
node scripts/appliquer-veille.mjs --aide
```

Sortie par défaut : `data/patchs/patchs-veille-AAAA-MM-JJ.json` (hors de `data/seed/`, donc jamais lu par le
site ni par le validateur).

Le script gère les **deux formes** de propositions présentes dans la file, qui ne se traitent pas pareil :

- forme **Wikipédia** (`scripts/documentation-recherche.mjs`) — `{ nom, titre_article_source, langue_source,
  extrait, url, note }`. Le résumé encyclopédique est de la **matière première**, pas un texte de fiche :
  le patch vise le champ rédactionnel (`these_centrale`, ou `limites_connues` pour une fiche IA) et est
  marqué **`a_reformuler`**. Il ne sera jamais appliqué sans drapeau explicite.
- forme **RSS** (`scripts/veille-rss.mjs`) — `{ titre, link, date, resume }`. Le `resume` est de la prose
  d'éditeur, non publiable ; en revanche l'URL datée est un fait vérifiable. Le patch propose donc un simple
  **ajout de source** (`champ: "sources"`), marqué **`sur`** quand la source est primaire et directe.

Chaque patch porte une **nature** :

- **`sur`** — opération mécanique et vérifiable (ajouter une source primaire datée à une fiche existante).
  Rien à réécrire ; il reste à valider.
- **`a_reformuler`** — il y a du texte à produire avant publication : résumé Wikipédia brut, URL d'agrégateur
  Google News à résoudre vers l'éditeur d'origine, titre suffixé du nom du média, source à faible score de
  fiabilité. Le champ `a_verifier` liste précisément ce qui bloque.

### 4. Relire — l'étape humaine, non contournable

Ouvrir le fichier de patchs et, patch par patch :

- passer `"retenu": false` sur ce qu'on écarte (garder la trace de la décision plutôt que supprimer la ligne) ;
- pour les `a_reformuler` : réécrire `texte_propose` au format du référentiel (comparer avec `texte_actuel`,
  qui donne l'existant), nettoyer les titres de source, remplacer les URL d'agrégateur ;
- vérifier les points listés dans `a_verifier`.

### 5. Publier — `npm run appliquer-patchs` (`scripts/appliquer-patchs.mjs`)

```bash
# 1) toujours commencer par une simulation
npm run appliquer-patchs -- --patchs=data/patchs/patchs-veille-2026-09-06.json --dry-run

# 2) application réelle, une fois la simulation relue
npm run appliquer-patchs -- --patchs=data/patchs/patchs-veille-2026-09-06.json

# 3) variantes
npm run appliquer-patchs -- --patchs=... --limite=5                   # borne le lot
npm run appliquer-patchs -- --patchs=... --inclure-a-reformuler       # après réécriture des textes
npm run appliquer-patchs -- --patchs=... --conserver-file             # ne touche pas au statut des propositions
node scripts/appliquer-patchs.mjs --aide
```

Pour chaque patch retenu, le script : ajoute la source (sans doublon), remplace le champ visé si le patch est
un `remplacement_texte`, passe `derniere_verification` à la date du jour et `statut` à `verifie_recemment`,
ajoute **une entrée par fiche touchée** dans `data/seed/changelog.json` (visible sur `/veille`), et bascule la
proposition d'origine au statut `applique` dans la file pour qu'elle ne soit pas re-proposée indéfiniment.

Deux refus par défaut, à connaître :

- un patch `"retenu": false` n'est jamais appliqué ;
- un patch de nature `a_reformuler` est **refusé** tant qu'on ne passe pas `--inclure-a-reformuler`. Ce n'est
  pas une formalité : appliqué tel quel, un résumé Wikipédia remplace une thèse rédigée par un texte
  encyclopédique hors format (constaté en test : une thèse centrale de 265 caractères remplacée par 65
  caractères de définition générique).

### Le garde-fou de restauration

`appliquer-patchs.mjs` est le seul script qui écrit du contenu éditorial dans les fiches, donc le seul qui
puisse casser le corpus. Il est encadré des deux côtés :

1. **avant toute écriture**, il lance `scripts/valider-donnees.mjs` : si le corpus est *déjà* invalide, il
   refuse de démarrer (code 1, rien écrit) — sinon il restaurerait à chaque run et masquerait la vraie panne ;
2. il prend un **instantané octet pour octet** de tous les fichiers qu'il va toucher (fichiers de fiches
   concernés, `changelog.json`, `veille_queue.json`) ;
3. **après écriture**, il relance le validateur. En cas d'échec — ou de toute exception pendant l'écriture —
   il **réécrit les instantanés** et sort en code 1. Le disque revient exactement dans son état d'avant,
   y compris pour les patchs qui, eux, étaient bons : le lot est atomique, on ne laisse jamais un corpus
   à moitié appliqué.

Ce que le garde-fou couvre : tout ce que `npm run valider` sait détecter (JSON illisible, id dupliqué, enum
inconnu, source sans titre ou de type invalide, date impossible ou future, champ obligatoire vide sur une
fiche publiée, référence de gap pendante…) sur **l'ensemble** du corpus, pas seulement sur les fiches
touchées. Ce qu'il ne couvre pas : la qualité éditoriale (un texte hors sujet mais bien formé passe la
validation) et les avertissements non bloquants — c'est précisément le rôle de l'étape 4, la relecture
humaine. Il ne couvre pas non plus les fichiers non suivis par le validateur (`data/patchs/`).

### Ce que fait le cron quotidien

`veille-cron.yml` (07h00 UTC) va désormais jusqu'à l'étape 3 : après la collecte RSS et le commit de la file,
il lance `appliquer-veille.mjs` en écrivant le fichier de patchs dans `RUNNER_TEMP` (**hors du dépôt**) et le
publie comme **artefact du job** (`patchs-veille-<run_id>`, conservé 30 jours), téléchargeable depuis
l'onglet Actions. Une étape de contrôle fait échouer le job si un fichier suivi a été modifié.
Le cron ne va jamais plus loin : l'étape 5 reste manuelle, par construction.

### Vérifier après coup

```bash
npm run valider          # corpus valide ?
npm run audit-fraicheur  # fiches périmées
git diff -- data/seed    # relire ce qui a réellement changé avant de committer
```

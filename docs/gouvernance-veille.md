# Gouvernance de la veille — qui valide quoi, à quelle fréquence, et sur quel seuil

_Rédigé le 07/09/2026, lot « Qualité, sources, liens & gouvernance » (Mégaprompt 3, tâche 5).
Décrit la chaîne telle qu'elle est **réellement codée** au 07/09/2026, puis pose la seule décision
qui reste ouverte : l'auto-validation._

---

## 1. La chaîne existante, en une image

```
  ┌─ COLLECTE ─────────────── automatique, quotidienne ─────────────────┐
  │ veille-rss.mjs            cron GitHub, 07:00 UTC tous les jours     │
  │ documentation-recherche.mjs  cron GitHub, 05:30 UTC le mercredi     │
  │        ↓                                                            │
  │ data/seed/veille_queue.json — statut « en_attente »                 │
  └─────────────────────────────────────────────────────────────────────┘
                                 ↓  TRI HUMAIN  (aucun script)
                    rejete  /  a_traiter_fiche_existante  /  a_traiter_nouvelle_fiche
                                 ↓
  ┌─ PROPOSITION ───────── automatique, quotidienne, sans écriture ─────┐
  │ appliquer-veille.mjs      lancé par le cron de veille               │
  │        ↓                                                            │
  │ data/patchs/patchs-veille-AAAA-MM-JJ.json  (artefact GitHub)        │
  │ AUCUNE FICHE N'EST TOUCHÉE. Le cron vérifie explicitement que       │
  │ data/seed/ n'a pas bougé et échoue sinon.                           │
  └─────────────────────────────────────────────────────────────────────┘
                                 ↓  RELECTURE HUMAINE  (retenu: true/false)
  ┌─ PUBLICATION ────────── manuelle, jamais lancée par un cron ────────┐
  │ appliquer-patchs.mjs --patchs=... [--dry-run]                       │
  │  · instantané octet pour octet de tous les fichiers touchés         │
  │  · refuse de démarrer si le corpus est déjà invalide                │
  │  · écrit, puis relance valider-donnees.mjs                          │
  │  · si la validation échoue → RESTAURATION intégrale, code 1         │
  │  · une entrée changelog.json par fiche touchée                      │
  └─────────────────────────────────────────────────────────────────────┘
                                 ↓
  ┌─ VIEILLISSEMENT ─────── automatique, hebdomadaire ──────────────────┐
  │ audit-fraicheur.mjs      cron qualité, 06:00 UTC le lundi           │
  │ toute fiche « documente » / « verifie_recemment » de plus de        │
  │ 180 jours repasse à « a_re_auditer ». Sens unique : ce script ne    │
  │ requalifie jamais une fiche vers le haut, et ne touche ni le        │
  │ contenu ni derniere_verification — seulement le statut.             │
  └─────────────────────────────────────────────────────────────────────┘
```

**Le principe qui tient toute la chaîne** : les scripts automatiques écrivent dans
`veille_queue.json` et dans `data/patchs/`, jamais dans les fiches. Le seul script qui écrit du
contenu éditorial, `appliquer-patchs.mjs`, n'est lancé par aucun cron — il faut une commande tapée
par une personne. Cette séparation est le garde-fou : elle n'est pas une convention, elle est
vérifiée par l'étape « Vérifier qu'aucune fiche n'a été modifiée » du workflow de veille.

---

## 2. Qui valide

Le projet a un seul responsable éditorial : **Julien**. Il n'y a pas de comité, et il n'en faut pas
à cette échelle — mais il faut nommer les rôles, parce qu'une session Claude peut en tenir certains
et pas d'autres.

| Rôle | Qui | Ce qu'il décide | Ce qu'il ne décide pas |
|---|---|---|---|
| **Collecte** | crons GitHub | rien — remplit la file | tout le reste |
| **Tri de la file** | Julien, ou une session Claude mandatée | `rejete` / `a_traiter_*` + `note_tri` | la rédaction publiée |
| **Rédaction des patchs `a_reformuler`** | session Claude mandatée | le texte proposé | sa publication |
| **Arbitrage des patchs** (`retenu`) | **Julien seul** | ce qui descend dans les fiches | — |
| **Lancement de `appliquer-patchs.mjs`** | Julien, ou une session sur instruction explicite et tracée | — | — |
| **Ligne éditoriale** (questions-tests, axes, schéma) | **Julien seul** | — | — |

Le point non négociable est la ligne 4 : une session Claude peut trier, rédiger, proposer, mais
l'arbitrage `retenu: true` sur un patch de contenu est un acte éditorial. Le champ existe justement
pour que la décision laisse une trace relisible dans le fichier de patchs, et non pour être coché
en masse.

---

## 3. À quelle fréquence

| Rituel | Fréquence | Durée réaliste | Déclencheur |
|---|---|---|---|
| Tri de la file `en_attente` | **hebdomadaire** | 20-30 min | le lundi, après le cron qualité |
| Relecture du fichier de patchs | **hebdomadaire**, groupée | 15-30 min | même séance |
| Lancement de `appliquer-patchs.mjs` | à la suite de la relecture | 2 min | — |
| Revue des fiches `a_re_auditer` | **mensuelle** | variable | volume produit par l'audit de fraîcheur |
| Vérification des liens (`verifier-liens.mjs`) | **trimestrielle** | 5 min de machine | avant une revue de fond |
| Revue de la ligne éditoriale (questions-tests, axes) | **semestrielle** | — | — |

Volume à traiter, mesuré le 07/09/2026 : la file compte **187 propositions**, dont 134 déjà
`rejete`, 51 `a_traiter_fiche_existante` et 2 `a_traiter_nouvelle_fiche`. Le cron quotidien en ajoute
quelques-unes par jour. Un rendez-vous hebdomadaire de 30 minutes suffit largement — la file ne
grossit pas plus vite qu'on ne la vide, et c'est ce qui rend le dispositif tenable par une personne
seule.

**Règle d'hygiène** : ne jamais laisser la file dépasser ~200 items `en_attente`. Au-delà, le tri
cesse d'être une lecture et devient un rejet en bloc — ce qui est pire que pas de veille du tout,
parce que ça donne l'illusion d'une revue.

---

## 4. Les seuils, tels qu'ils sont codés aujourd'hui

Deux barèmes indépendants coexistent, et il vaut mieux le savoir avant d'en parler.

**`score_fiabilite`** — attribué à la collecte, jamais recalculé ensuite :

| Score | Attribué par | À quoi |
|---|---|---|
| **0,9** | `veille-rss.mjs` | source reconnue primaire d'après le **nom du flux** (labs officiels, arXiv, Nature…) |
| **0,6** | `veille-rss.mjs` | tout autre flux RSS |
| **0,5** | `documentation-recherche.mjs` | extrait Wikipédia — encyclopédie collaborative, point de départ, jamais une source primaire |

Répartition réelle dans la file : 28 items à 0,9, 159 à 0,5, aucun à 0,6.

**`SEUIL_SOURCE_PRIMAIRE = 0,8`** dans `appliquer-veille.mjs` — c'est le seul seuil qui a
aujourd'hui une conséquence mécanique. Il décide de deux choses :

1. le `type` de la source écrite dans la fiche : `primaire` si score ≥ 0,8 **et** que l'URL n'est
   pas celle d'un agrégateur, `secondaire` sinon ;
2. la **nature** du patch : `sur` (opération mécanique et vérifiable — ajout d'une source datée) ou
   `a_reformuler` (il y a du texte à écrire avant toute publication).

Et `appliquer-patchs.mjs` **refuse par défaut** tous les patchs `a_reformuler` : il faut le drapeau
explicite `--inclure-a-reformuler` pour les laisser passer. Autrement dit, le dispositif distingue
déjà proprement « ce qui peut être validé d'un coup d'œil » de « ce qui demande un travail
rédactionnel » — ce qui est exactement la matière de la décision ci-dessous.

Limite connue du barème, à garder en tête : le score est déduit du **nom du flux**, pas du contenu
de l'item. Une annonce commerciale publiée sur le blog d'un laboratoire hérite de 0,9 comme un
papier de recherche. La file en donne un exemple net — un communiqué d'engagement financier scoré
0,9, rejeté à la main lors du tri avec la note « annonce commerciale ». **Un score élevé ne dit rien
de la pertinence éditoriale d'un item : il dit seulement d'où il vient.**

---

## 5. La décision à prendre : faut-il une auto-validation ?

La section 7.1 du mégaprompt évoque une « validation automatique si confiance élevée et source
primaire ». Elle n'a **jamais été implémentée**, et ce document ne l'implémente pas non plus. Voici
de quoi trancher.

### Ce que ça voudrait dire concrètement

Ajouter à `appliquer-patchs.mjs` un mode qui applique sans relecture les patchs réunissant **toutes**
les conditions suivantes : `nature: "sur"` (donc `score_fiabilite ≥ 0,8`, URL non-agrégateur), et
`operation: "ajout_source"` — c'est-à-dire l'ajout d'une source datée à une fiche existante, sans
aucun texte rédigé. Puis lancer ce mode depuis le cron de veille.

Périmètre réel si on l'activait aujourd'hui : les 28 items scorés 0,9 de la file, dont une partie
seulement franchit le filtre agrégateur. Ordre de grandeur : **quelques ajouts de source par
semaine**.

### Pour

- **L'opération est mécanique.** Un patch `sur` n'écrit aucune prose : il ajoute
  `{titre, url, date, type}` à un tableau `sources`. Il n'y a rien à arbitrer sur le fond — c'est le
  seul cas de toute la chaîne où la relecture humaine n'apporte pas de jugement, seulement un clic.
- **Le garde-fou technique est déjà là et il est sérieux.** Instantané octet pour octet, validation
  post-écriture par `valider-donnees.mjs`, restauration intégrale en cas d'échec, refus de démarrer
  sur un corpus déjà invalide. Une auto-validation n'ajouterait pas de risque de corruption.
- **La trace resterait publique.** Une entrée `changelog.json` par fiche touchée, plus le commit
  git. Rien ne se ferait en silence, et tout serait révocable par `git revert`.
- **Ça sauve la partie fastidieuse.** Le risque le plus concret pour ce projet n'est pas qu'un
  mauvais lien passe, c'est que Julien cesse de tenir le rituel hebdomadaire parce qu'il consiste à
  cocher trente cases évidentes. Automatiser l'évident protège l'attention pour le reste.

### Contre

- **Le score ne mesure pas ce qu'on croit.** Il est déduit du nom du flux RSS, pas de l'item. Le
  communiqué commercial scoré 0,9 déjà présent dans la file serait passé en auto-validation : la
  source aurait été ajoutée à une fiche, et il aurait fallu la retirer après coup. C'est l'objection
  la plus forte, et elle est factuelle, pas théorique.
- **Ajouter une source n'est pas neutre éditorialement.** Une source dans une fiche, c'est une
  caution. Le projet affiche un sourçage systématique daté comme sa promesse centrale ; laisser un
  script décider de ce qui fait autorité contredit cette promesse plus qu'il ne l'exécute.
- **Le gain est faible.** Quelques ajouts par semaine, sur un rituel qui dure trente minutes. On
  échangerait une garantie forte contre une économie de quelques minutes.
- **Le dispositif perdrait son argument le plus clair.** « Aucune fiche n'est modifiée sans
  validation humaine » est aujourd'hui vrai sans exception, vérifié par la CI, et écrit en tête des
  deux scripts. Une exception, même étroite, transforme une règle en politique à expliquer.

### Trois options, à choisir explicitement

**Option A — Statu quo : pas d'auto-validation.** La règle reste absolue. Coût : trente minutes par
semaine, dont peut-être dix de clics évidents.

**Option B — Auto-validation étroite.** Uniquement `nature: "sur"` **et** `operation: "ajout_source"`
**et** domaine figurant sur une **liste blanche explicite** maintenue à la main (arxiv.org,
nature.com, les domaines des laboratoires que le projet suit) — pas le score seul. Le score reste un
filtre nécessaire mais non suffisant. La liste blanche corrige précisément l'objection la plus
forte : elle déplace la confiance du nom du flux vers un domaine que Julien a validé une fois pour
toutes. À coupler avec une notification (résumé hebdomadaire de ce qui a été auto-appliqué) et un
plafond par run (5 patchs) pour qu'une anomalie de flux ne produise pas cinquante écritures.

**Option C — Pré-validation assistée, sans écriture automatique.** On ne change rien au garde-fou :
`appliquer-patchs.mjs` reste manuel. On ajoute seulement au fichier de patchs un tri par
`nature`/domaine et un mode `--tout-retenir-surs` qui coche les patchs `sur` en une commande, que
Julien lance après avoir survolé la liste. Le clic reste, mais il est unique. Gain de temps réel,
règle intacte.

### Recommandation

**Option C**, et si le rituel se révèle malgré tout trop lourd après un mois d'usage réel, **Option B
avec liste blanche** — jamais l'auto-validation sur le seul `score_fiabilite ≥ 0,8`, parce que ce
score mesure la provenance du flux et non la valeur de l'item, et que la file en fournit déjà le
contre-exemple.

**Ce que ce document demande à Julien** : trancher entre A, B et C. Tant que ce n'est pas tranché,
c'est A qui s'applique — le code n'auto-valide rien aujourd'hui, et ce lot n'a rien codé en ce sens.

---

## 6. Ce qui reste à faire quand la décision sera prise

- Si **B** est retenu : ajouter la liste blanche de domaines à `appliquer-veille.mjs` (à côté de
  `SEUIL_SOURCE_PRIMAIRE`), le plafond par run et le mode auto dans `appliquer-patchs.mjs`, puis
  répercuter la règle sur la page `/methodologie` du site — la promesse publique doit décrire le
  dispositif réel, pas le dispositif souhaité.
- Si **C** est retenu : `--tout-retenir-surs` dans `appliquer-patchs.mjs`, une ligne dans
  `docs/comment-lancer.md`.
- Dans les deux cas : ce fichier fait foi et doit être mis à jour le jour de la décision, avec la
  date et l'option retenue.
- **Point ouvert, indépendant de la décision** : le `score_fiabilite` gagnerait à être recalculé à
  partir du **domaine de l'URL** de l'item plutôt que du nom du flux. C'est une correction de
  quelques lignes dans `veille-rss.mjs` qui rendrait le barème beaucoup plus honnête, et elle est
  utile quelle que soit l'option choisie.

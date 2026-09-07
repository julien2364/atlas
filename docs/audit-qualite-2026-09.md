# Audit qualité — sources, liens et gouvernance documentaire

_07/09/2026. Lot « Qualité, sources, liens & gouvernance documentaire » (Mégaprompt 3).
Rapport de synthèse exigé par la Definition of done du lot._

Ce rapport est un **audit de second regard** : il vérifie ce qui a été produit plutôt qu'il ne
produit du nouveau contenu. Il prolonge `docs/audit-fond-2026-09-07.md` (audit contradictoire du
fond sur 69 fiches) sur le versant technique : les liens répondent-ils, les sources sont-elles
vérifiables, la boucle de veille est-elle gouvernée.

**Aucune fiche n'a été modifiée par ce lot.** Les corrections identifiées sont listées ici avec
leur emplacement exact, prêtes à être appliquées par la session qui a la main sur
`data/seed/fiches_*` — deux autres agents y travaillaient en parallèle pendant cet audit.

---

## 1. Résultat en un coup d'œil

| Contrôle | Résultat |
|---|---|
| Contamination croisée (fichiers Parents Solo) | 15 fichiers retirés, commit dédié réversible, sauvegarde hors dépôt — §2 |
| Disponibilité des URL (1 040 occurrences, 405 URL distinctes) | **3 mortes**, 14 redirections à figer, 5 non concluantes, 383 OK — §3 |
| Vérifiabilité des sources (1 250 entrées) | **30 % sans URL**, dont 350 typées `primaire` ; **1 seule source datée sur 1 250** — §4 |
| Schéma des 4 questions-tests | conforme à `lib/types.ts` sur les 14 perspectives ; réserves de fond — §5 |
| Gouvernance de la veille | documentée ; une décision reste ouverte pour Julien — §6 |
| `npm run valider` | 0 erreur, 0 avertissement sur 512 fiches, avant et après ce lot |

---

## 2. Contamination croisée — 15 fichiers Parents Solo retirés

Le commit `b880774` (06/09/2026, « feat: espace personnel… ») a introduit dans le dépôt Atlas
2 268 lignes appartenant au projet **Parents Solo**. Ces fichiers sont les seuls du dépôt à ne
figurer dans aucun import du code Next.js et à n'entrer dans aucun build : `addons/` n'existe pas
dans la configuration du projet, et les quatre scripts Python/JS de `scripts/` ne sont référencés
par aucun `package.json`, aucun workflow GitHub, aucun autre script.

Retrait effectué dans le commit dédié `fix: retrait de fichiers Parents Solo poussés par erreur
dans le dépôt Atlas`, sans autre modification. L'inventaire complet, avec tailles et résumés, est
dans la réponse de session ; il est reproduit ici pour mémoire :

| Chemin | Octets | Lignes |
|---|---|---|
| `addons/parentsolo_website/README.md` | 4 896 | 55 |
| `addons/parentsolo_website/__init__.py` | 1 640 | 41 |
| `addons/parentsolo_website/__manifest__.py` | 1 826 | 38 |
| `addons/parentsolo_website/controllers/__init__.py` | 43 | 2 |
| `addons/parentsolo_website/controllers/main.py` | 8 390 | 160 |
| `addons/parentsolo_website/static/src/css/mon_espace.css` | 3 889 | 46 |
| `addons/parentsolo_website/static/src/js/mon_espace_app.js` | 38 030 | 444 |
| `addons/parentsolo_website/static/src/js/neutral_language.js` | 9 347 | 173 |
| `addons/parentsolo_website/views/templates.xml` | 4 209 | 58 |
| `docs/LIVRAISON-session2-2026-09-06.md` | 3 842 | 34 |
| `docs/recherche-developpement-8-12-ans-2026-09-05.md` | 10 343 | 61 |
| `scripts/build_espace_backend.py` | 16 775 | 326 |
| `scripts/mon_espace_app.js` | 38 051 | 444 |
| `scripts/neutral_language.js` | 9 347 | 173 |
| `scripts/update_mon_espace.py` | 12 525 | 213 |

**Total : 163 153 octets.** Tous introduits par le même commit, aucun modifié depuis.

Éléments qui établissent qu'aucune copie unique n'est perdue :

1. le module `parentsolo_website` est **installé et vérifié en production** sur l'instance Odoo
   (base `dyonysos`, module id 732, version 19.0.1.0.0, état `installed`), après un `scp` du
   dossier vers `/home/ubuntu/infra/odoo/addons/` — le code source vit donc sur le VPS ;
2. `docs/LIVRAISON-session2-2026-09-06.md` décrit lui-même ces fichiers comme une livraison **à
   intégrer dans le dépôt principal** de Parents Solo, ce qui confirme l'erreur de destination ;
3. ce même document indique que la recherche 8-12 ans est aussi dans le projet Claude
   « relevé 5-09 » ;
4. `scripts/neutral_language.js` est **identique octet pour octet** à sa copie dans `addons/`, et
   `scripts/mon_espace_app.js` n'en diffère que d'une ligne (lecture des données de courbes) : ce
   sont deux versions d'un même fichier, pas deux fichiers ;
5. une copie intégrale des 15 fichiers a été mise de côté hors du dépôt avant le `git rm`.

**Réversibilité** : un `git revert` du commit de retrait restaure tout, à l'octet près.

---

## 3. Vérification des liens — `scripts/verifier-liens.mjs`

Script écrit pour ce lot : Node ESM sans dépendance, même facture que
`scripts/valider-donnees.mjs` (français, `--aide`, codes de sortie explicites,
`--limite` / `--json` / `--seulement-morts` / `--concurrence` / `--delai` / `--tentatives`).
Il parcourt récursivement `data/seed/` et ramasse **toute** entrée portant une `url`, quelle que
soit sa profondeur : `sources` de fiche, `sources` d'usage sectoriel, `documents_cles` de gap,
`sources` de perspective, sources de veille et de changelog.

### Le point de conception qui compte

Un lien mort, un lien bloqué et un lien lent ne sont pas la même chose. Node n'honore pas
`HTTPS_PROXY` tout seul, contrairement à `curl` : un vérificateur naïf lancé dans une session
d'agent aurait rapporté **un millier de faux 404**. Le script ouvre donc lui-même un tunnel
`CONNECT` et isole le refus du proxy (statut `CONNECT` ≠ 200) dans une catégorie
`bloquee_proxy`, qui n'est jamais comptée comme lien mort — pas plus que les 401/403/429
(anti-robot) ni les 5xx. Seuls 404, 410, domaine inexistant et URL inexploitable font échouer le
script.

### Résultat du passage complet, 07/09/2026

**1 040 occurrences d'URL, 405 URL distinctes, 405 testées.**

| Verdict | Nombre |
|---|---|
| OK (2xx) | 383 |
| OK après redirection | 14 |
| **Morte (404)** | **3** |
| Restreinte (403 anti-robot — non concluant) | 5 |
| Invalide / 5xx / délai / bloquée par le proxy | 0 |

Aucune URL n'a été bloquée par le proxy de session sur ce corpus : les 23 domaines cités sont
tous joignables. Le résultat est donc exploitable tel quel.

### Les 3 liens morts, avec leur remplacement vérifié

| URL morte | Remplacement (vérifié 200 le 07/09) | Emplacements |
|---|---|---|
| `https://fr.wikipedia.org/wiki/Autoencodeur` | `https://fr.wikipedia.org/wiki/Auto-encodeur` | `fiches_ia.json#autoencodeurs` (×3, dont usages) et 4 gaps : `boson-de-higgs-vs-autoencodeurs`, `economie-fonctionnalite-vs-autoencodeurs`, `csf-vs-autoencodeurs`, `freud-vs-autoencodeurs` |
| `https://fr.wikipedia.org/wiki/Modèle_ARIMA` | `https://fr.wikipedia.org/wiki/ARIMA` | `fiches_ia.json#series-temporelles-arima-sarima` (×3) et 2 gaps : `opep-vs-arima`, `socialisme-xxie-vs-arima` |
| `https://fr.wikipedia.org/wiki/Capitalisme_de_plateforme` | `https://en.wikipedia.org/wiki/Platform_capitalism` (aucun article francophone n'existe — vérifié : `Économie de plateforme` est également en 404) | `fiches_humaines/social_1.json#economie-de-plateformes-capitalisme-numerique`, `fiches_gap.json#economie-de-plateformes-vs-k-nn` |

Les trois sont des articles Wikipédia dont le titre a été **deviné plutôt que copié** depuis la
page réellement consultée. C'est la même signature que le finding transversal de l'audit de fond :
la source a été écrite de mémoire.

### Les 14 redirections — à figer, sans urgence

Aucune n'est cassée, mais une URL stockée qui redirige est une URL qui mourra un jour.
Trois familles :

- **Anthropic → claude.com** (3 URL, ~15 fiches de gap) : `www.anthropic.com/claude` →
  `claude.com/product/overview`, `docs.claude.com` → `platform.claude.com/docs/fr/home`,
  `www.anthropic.com/education` et `/customers` → `claude.com/…`.
- **OpenAI → developers.openai.com** (2 URL) : `platform.openai.com/docs[/models]`.
- **Éditeurs scientifiques** (7 URL) : `doi.org` et `nature.com` ajoutent un paramètre
  `?error=cookies_not_supported`. **Ne pas figer celles-là** — la redirection est un artefact de
  session, pas un changement d'adresse ; l'URL stockée est la bonne.

À corriger réellement : les 5 URL Anthropic/OpenAI, plus `deepmind.google/discover/blog/…` →
`deepmind.google/blog/…`, `papers.nips.cc/paper/4824-…` → `papers.nips.cc/paper_files/…`, et
`actu.epfl.ch/news/…-nu` → même URL avec la barre oblique finale.

### Les 5 « restreintes » — ne pas les toucher

`openai.com/index/introducing-operator/`, `openai.com/codex`,
`github.com/Significant-Gravitas/AutoGPT`, et les deux flux `export.arxiv.org/rss/cs.{AI,CL}`
répondent 403 à un client automatique. Les pages existent : ce sont des protections anti-robot.
Les qualifier de liens morts serait une erreur — d'où la catégorie séparée. À revérifier
manuellement dans un navigateur si le doute persiste.

### Recommandation d'exploitation

`node scripts/verifier-liens.mjs --seulement-morts` **une fois par trimestre**, avant chaque revue
de fond. Ne pas le brancher sur la CI : 405 requêtes sortantes par commit est disproportionné, et
le taux de faux positifs dû aux anti-robots ferait rougir la CI pour rien.

---

## 4. Audit des sources — la suite directe de l'audit de fond

L'audit de fond concluait : « les sources primaires n'ont presque jamais d'URL […] le validateur
ne le voit pas parce qu'il n'exige une URL que sur la fiche entière, pas par entrée ». Ce lot
chiffre le constat sur **l'intégralité** du corpus, et non plus sur un échantillon.

### Les chiffres

**1 250 entrées de source** au total (473 sur les fiches humaines, 152 sur les fiches IA dont 87
dans les usages sectoriels, 610 dans les `documents_cles` de gap, 15 dans les perspectives des
questions).

| Mesure | Valeur |
|---|---|
| Sources portant une URL | 874 / 1 250 — **69,9 %** |
| Sources typées `primaire` | 667 |
| **Sources primaires portant une URL** | **317 / 667 — 47,5 %** |
| Sources sans URL, typées `primaire` | **350** |
| Sources sans URL, typées `secondaire` | 26 |
| **Sources portant une `date`** | **1 / 1 250 — 0,08 %** |

Deux enseignements, dont un que le mégaprompt n'anticipait pas.

**a) Le problème d'URL est presque entièrement sur les sources primaires, pas secondaires.**
Le mégaprompt visait « les sources de type `secondaire` sans champ `url` ». Le corpus dit
l'inverse : sur les 376 entrées sans URL, **350 sont primaires et 26 secondaires**. Le lien
manquant n'est donc pas un oubli de confort sur des sources d'appoint — il porte précisément sur
ce que le référentiel présente comme sa fondation.

**b) Le sourçage n'est pas daté.** Une seule source du corpus porte un champ `date` : celle de
`fiches_ia.json#ia-pour-le-controle-de-plasma-en-fusion-nucleaire`. La promesse affichée du
projet est un « sourçage systématique **daté** ». À 1 sur 1 250, ce n'est pas une dette de
finition, c'est une promesse non tenue — et c'est le constat le plus lourd de ce lot. Le champ
`date` est optionnel dans `lib/types.ts`, donc le validateur ne dit rien, et il n'y a aucun moyen
pour un lecteur de savoir si la source citée date de 1953 ou de la semaine dernière.

### Typologie des 350 primaires sans URL — trois cas très différents

Les traiter en bloc serait une erreur : un tiers seulement relève d'un oubli.

**Cas 1 — œuvre imprimée sans édition en ligne (≈ 150 entrées, majorité de
`philosophique.json` et `psychologique.json`).** *L'Être et l'Événement*, *Le Mythe de Sisyphe*,
*Totalité et Infini*, *Ainsi parlait Zarathoustra*… L'absence d'URL est **légitime et doit le
rester** : mettre un lien Wikipédia sur *Totalité et Infini* transformerait une source primaire en
source secondaire déguisée. Ce qui manque ici n'est pas une URL, c'est une **année d'édition** —
c'est-à-dire le champ `date`.

**Cas 2 — papier de recherche parfaitement identifiable (≈ 160 entrées, l'essentiel de
`evolution.json` et des `documents_cles` de gap).** *Attention Is All You Need (Vaswani et al.,
2017)*, *Molecular Structure of Nucleic Acids (Watson & Crick, Nature, 1953)*, *DeepSeek-V3
Technical Report*, *Gender Shades*, *A Safe Operating Space for Humanity*… Chacun a un DOI ou un
identifiant arXiv stable. **C'est ici que se trouve le gain, et il est mécanique.** Le corpus
fournit même la démonstration de l'incohérence : le papier AlphaFold de Nature 2021 est cité
**avec** son DOI dans quatre fiches de gap et **sans** URL dans cinq autres — le même document,
deux traitements.

Dix URL vérifiées 200 le 07/09/2026, prêtes à être appliquées :

| Source telle qu'elle est écrite dans le corpus | URL à ajouter |
|---|---|
| Attention Is All You Need (Vaswani et al., 2017) | `https://arxiv.org/abs/1706.03762` |
| Molecular Structure of Nucleic Acids (Watson & Crick, Nature, 1953) | `https://www.nature.com/articles/171737a0` |
| Deep Learning (LeCun, Bengio, Hinton, Nature, 2015) | `https://doi.org/10.1038/nature14539` |
| A Safe Operating Space for Humanity (Rockström et al., Nature, 2009) | `https://doi.org/10.1038/461472a` |
| DeepSeek-V3 Technical Report | `https://arxiv.org/abs/2412.19437` |
| Buolamwini, Gebru — Gender Shades (2018) | `https://proceedings.mlr.press/v81/buolamwini18a.html` |
| Luccioni et al. — Power Hungry Processing (2024) | `https://arxiv.org/abs/2311.16863` |
| Jumper et al. — Highly accurate protein structure prediction with AlphaFold, Nature 2021 | `https://doi.org/10.1038/s41586-021-03819-2` (déjà utilisée ailleurs dans le corpus) |
| DeepMind — Magnetic control of tokamak plasmas (Nature, 2022) | `https://doi.org/10.1038/s41586-021-04301-9` (déjà utilisée ailleurs) |
| Novoselov, Geim et al. — Electric Field Effect in Atomically Thin Carbon Films (2004) | `https://arxiv.org/abs/cond-mat/0410550` |

Quatre autres DOI résolvent correctement mais l'éditeur répond 403 à un client automatique
(Science, APS, PNAS) : `10.1126/science.1225829` (CRISPR, Jinek et al. 2012),
`10.1126/science.adi2336` (GraphCast), `10.1103/PhysRevLett.19.1264` (Weinberg 1967),
`10.1073/pnas.15.3.168` (Hubble 1929). Ils sont valides et citables — simplement non vérifiables
par script.

**Cas 3 — « intention de source » (≈ 40 entrées, presque toutes sur les fiches IA et les gaps).**
« Recherche académique sur l'équité algorithmique (fairness in ML) » (7 occurrences),
« Rapports sur l'empreinte énergétique de l'IA (AIE, études académiques) » (6),
« Systèmes d'aide à la décision publique par IA — documentation GovTech » (4),
« LangChain, CrewAI, AutoGen — documentation des projets » (4),
« Systèmes de tutorat adaptatif — documentation sectorielle EdTech ».
**Ce ne sont pas des sources sans URL : ce sont des sources sans document.** Aucune URL ne peut
être ajoutée, parce qu'aucun texte précis n'est désigné. Deux issues, pas trois : nommer le
document réel (auteur, titre, année, lien) ou retirer l'entrée. Les laisser telles quelles est le
seul cas où le corpus affirme quelque chose qu'il ne peut pas montrer.

### Ce que le validateur ne voit pas, et pourquoi

`scripts/valider-donnees.mjs` avertit quand **aucune** source d'une fiche ne porte d'URL. La
granularité est la fiche, pas l'entrée : une fiche avec une source Wikipédia cliquable et quatre
papiers de recherche sans lien passe sans un mot. C'est exactement ce qui produit
« 0 erreur, 0 avertissement » à côté de 350 primaires non cliquables.

**Ce lot n'a pas modifié le validateur, délibérément.** Ajouter cet avertissement ferait passer
`npm run valider` de 0 à plusieurs centaines d'avertissements pendant que deux autres agents
travaillent sur les fiches et s'appuient sur ce même compteur pour se relire. La modification est
juste, mais elle doit être faite après convergence, pas au milieu. Trois règles à ajouter, par
ordre d'utilité :

1. avertissement **par entrée** quand une source typée `primaire` n'a ni `url` ni `date` — c'est
   la seule combinaison qui rend une source strictement invérifiable ;
2. avertissement quand un titre de source ne désigne aucun document identifiable (cas 3
   ci-dessus) ; une heuristique sur les débuts de titre (« Recherche… », « Rapports sur… »,
   « Documentation… » sans millésime) attrape les 40 cas ;
3. unicité du `secteur` au sein des `usages` d'une fiche IA — défaut déjà signalé par l'audit de
   fond (`lstm`, `aide-a-la-decision-publique-govtech-ia`) et toujours non détecté.

---

## 5. Les 4 questions-tests — schéma conforme, couverture étroite

**Schéma : conforme.** Les 14 perspectives des 4 questions portent les 8 champs obligatoires de
`Perspective` (`modele`, `hypotheses`, `etat_actuel`, `reponse`, `justification`, `limites`,
`sources`, `niveau_confiance`), tous non vides, aucun tableau `sources` vide. Rien à corriger sur
la forme.

**Sur le fond, quatre réserves.**

1. **`futurs-modeles-gouvernance` n'a que deux perspectives réelles.** La troisième s'intitule
   « Neutralité active du référentiel (refus de trancher) ». Ce n'est pas une école de pensée,
   c'est la méthode éditoriale du site présentée comme un troisième camp — le champ `modele` est
   défini dans `lib/types.ts` comme « nom de l'école/du cadre théorique ». L'effet est de gonfler
   la pluralité apparente : il reste deux écoles, toutes deux occidentales et toutes deux issues
   des relations internationales (réalisme, libéralisme institutionnaliste). Manquent au minimum
   le constructivisme, une perspective depuis le Sud global, et le scénario de fragmentation.
   **Recommandation : remplacer cette perspective par une école réelle et déplacer l'énoncé de
   neutralité vers la page `/methodologie`, où il est à sa place.**
2. **`modeles-economiques-optimaux` n'a pas de pôle libéral.** L'éventail va de la
   social-démocratie nordique au capitalisme d'État chinois puis aux critiques hétérodoxes : les
   trois positions sont à gauche du libéralisme de marché, qui est pourtant l'un des camps les
   plus actifs du débat réel. Par ailleurs la troisième perspective agrège trois courants qui se
   contredisent entre eux (économie du donut, théorie monétaire moderne, critique des
   plateformes) — c'est un fourre-tout, pas un modèle.
3. **`philosophie-comparee-bien-vivre` : 4 sources sur 5 sans URL, et toutes les perspectives
   sont occidentales.** Le premier point est le cas 1 du §4 (œuvres imprimées, absence légitime,
   mais l'année manque). Le second est une vraie limite de neutralité : aucune tradition non
   occidentale n'est convoquée sur une question qui en compte plusieurs.
4. **Usage ambigu de `niveau_confiance`.** Les cinq perspectives de la question philosophique sont
   toutes marquées `consensus_scientifique`. Le champ signifie ici « l'exposition de la doctrine
   fait consensus chez les commentateurs », ce qui est défendable, alors que pour la perspective
   TCC il signifie « l'efficacité clinique fait consensus » — deux choses différentes sous la même
   étiquette. À trancher dans la documentation du schéma.

**Extension du corpus de questions : 5 propositions écrites, aucune ajoutée.** Voir
`docs/questions-proposees-2026-09.md`. Le constat qui les motive : les 4 questions ne couvrent que
l'économie, la géopolitique et la philosophie morale. Trois des cinq axes du référentiel humain
(`evolution` 55 fiches, `psychologique` 12, `serenite` 5) ne sont convoqués par aucune question, et
les 44 fiches IA n'apparaissent dans **aucune** perspective. Les questions-tests éprouvent
aujourd'hui la moitié du corpus.

---

## 6. Gouvernance de la veille — une décision attend Julien

Procédure complète dans `docs/gouvernance-veille.md` : rôles, fréquences, seuils tels qu'ils sont
réellement codés. Trois points à retenir ici.

**La boucle est saine et le garde-fou est réel.** `appliquer-veille.mjs` propose sans jamais écrire
dans `data/seed/` (le workflow GitHub le vérifie explicitement) ; `appliquer-patchs.mjs` prend un
instantané octet pour octet, revalide après écriture et **restaure intégralement** si la validation
échoue ; il n'est lancé par aucun cron. « Aucune fiche n'est modifiée sans validation humaine » est
vrai sans exception aujourd'hui.

**Le `score_fiabilite` ne mesure pas ce qu'on croit.** Il est déduit du **nom du flux RSS**, pas du
contenu de l'item : 0,9 pour un flux réputé primaire, 0,6 sinon, 0,5 pour un extrait Wikipédia. Un
communiqué commercial publié sur le blog d'un laboratoire hérite donc de 0,9 comme un papier de
recherche — la file en contient déjà un exemple, rejeté à la main lors du tri. Correction utile
quelle que soit la suite : calculer le score à partir du **domaine de l'URL** de l'item.

**Décision demandée.** La section 7.1 du mégaprompt évoque une « validation automatique si
confiance élevée et source primaire », jamais implémentée. Ce lot ne l'a pas codée. Trois options
sont posées et argumentées dans `docs/gouvernance-veille.md` §5 :
**A** statu quo (aucune auto-validation) · **B** auto-validation étroite sur **liste blanche de
domaines**, jamais sur le score seul · **C** pré-validation assistée (`--tout-retenir-surs`), qui
garde la règle intacte et supprime seulement la répétition du clic.
Recommandation : **C**, avec **B** en repli si le rituel hebdomadaire s'avère trop lourd après un
mois d'usage réel. Tant que Julien n'a pas tranché, **A** s'applique de fait.

---

## 7. Ce qui reste à faire, par ordre de priorité

**À faire par la session qui a la main sur `data/seed/fiches_*`** (ce lot n'y a pas touché) :

1. les **3 URL mortes** du §3, remplacements fournis et vérifiés — 11 emplacements ;
2. les **10 URL de papiers** du §4 cas 2, vérifiées, à ajouter sur les entrées primaires
   correspondantes ;
3. les **~40 « intentions de source »** du §4 cas 3 : nommer le document ou retirer l'entrée ;
4. les **8 redirections** réellement structurelles du §3 (Anthropic, OpenAI, DeepMind, NeurIPS,
   EPFL) — pas les redirections `?error=cookies_not_supported` ;
5. le champ **`date`** sur les sources : commencer par les œuvres imprimées du cas 1, où c'est la
   seule information de traçabilité possible.

**À arbitrer par Julien** :

6. les trois options de gouvernance de la veille (§6) ;
7. les 5 questions proposées (`docs/questions-proposees-2026-09.md`) ;
8. la réserve n°1 du §5 : la « perspective » de neutralité dans `futurs-modeles-gouvernance`.

**À faire après convergence des sessions parallèles** :

9. les trois règles de validation du §4, à ajouter à `scripts/valider-donnees.mjs` ;
10. répercuter la gouvernance sur la page `/methodologie` du site (`app/methodologie/page.tsx`,
    hors périmètre de ce lot) — la promesse publique doit décrire le dispositif réel ;
11. déposer ce rapport, `docs/gouvernance-veille.md` et `docs/questions-proposees-2026-09.md` dans
    le dossier Google Drive du projet, comme l'exige la règle de double emplacement du mégaprompt
    (impossible depuis cette session : aucun accès au Drive).

---

## Annexe — comment reproduire les mesures de ce rapport

```bash
npm run valider                                    # 0 erreur, 0 avertissement, 512 fiches
node scripts/verifier-liens.mjs --seulement-morts  # 405 URL distinctes, 3 mortes
node scripts/verifier-liens.mjs --json > liens.json
node scripts/verifier-liens.mjs --aide
```

Les chiffres de sourçage du §4 (1 250 entrées, 1 seule datée, 350 primaires sans URL) sont obtenus
par parcours direct de `data/seed/` ; ils sont reproductibles avec le même parcours récursif que
celui de `scripts/verifier-liens.mjs`, en comptant les entrées au lieu de les interroger.

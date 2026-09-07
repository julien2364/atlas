# Audit mécanique du corpus — 07/09/2026

> Ce rapport ne corrige rien et ne juge aucun contenu sur le fond. Il constate des
> **régularités anormales mesurables sur les 512 fiches**, chacune reproductible par
> `node scripts/auditer-corpus.mjs`. Chaque heuristique porte ci-dessous son
> intention, sa formulation exacte et son taux de faux positifs.

## Pourquoi cet audit, et ce qu'il ajoute aux trois autres

Le corpus est déjà surveillé par trois dispositifs qui ne se recouvrent pas :

| Dispositif | Ce qu'il voit | Ce qu'il ne voit pas |
|---|---|---|
| `scripts/valider-donnees.mjs` | la forme : schéma, énumérations, intégrité référentielle, unicité des id | tout le reste — il sort à **0 erreur, 0 avertissement** |
| `scripts/verifier-liens.mjs` | si les URL déclarées répondent encore | ce que contient la page |
| `docs/audit-fond-2026-09-07.md` | la fidélité à la source, lue à la main | 87 % du corpus : c'est un échantillon de 69 fiches |

Il manquait la quatrième case. Certains défauts ne sont **ni** une faute de schéma,
**ni** une URL morte, **ni** un contresens de lecture : ce sont des régularités qui
n'apparaissent qu'en tenant les 512 fiches en mémoire en même temps — un gabarit de
rédaction recopié d'une fiche à l'autre, une formule d'attribution vague répétée par
des agents différents, un titre de source qui n'a jamais désigné de document réel.
Aucun de ces défauts n'est visible sur une fiche prise isolément.

C'est ce que fait `scripts/auditer-corpus.mjs` : hors ligne, sans dépendance, 0,3 s
pour les 512 fiches et les 1 235 entrées de source.

```
node scripts/auditer-corpus.mjs              # rapport lisible
node scripts/auditer-corpus.mjs --json       # sortie machine, liste de reprise complète
node scripts/auditer-corpus.mjs --seuil=12   # durcir le seuil de recopie (en mots)
node scripts/auditer-corpus.mjs --section=B --max=50
```

Codes de sortie : `0` rien de bloquant, `1` au moins un défaut bloquant, `2` erreur
d'usage. Le code 1 n'est **pas** un échec de CI : c'est un instrument d'audit, pas un
garde-fou anti-régression — ce rôle reste celui de `valider-donnees.mjs`.

---

## Méthode, et ce que la méthode ne peut pas faire

Toutes les détections sont **syntaxiques**. Le script ne sait pas si une fiche dit
vrai. Il sait dire qu'un passage de 31 mots apparaît mot pour mot dans deux fiches,
que 27 fiches ouvrent leur critique par « jugé par certains », qu'un titre de source
ne porte aucun élément permettant de retrouver un document.

Trois heuristiques demandent une justification explicite.

### 1. « Intention de source » — le titre qui ne désigne aucun document

L'audit de fond a relevé que certains titres décrivent **une catégorie** de documents
et non un document : « Systèmes d'aide à la décision publique par IA — documentation
GovTech », « AlphaFold — impact sur la recherche pharmaceutique ». Personne ne peut
aller les ouvrir.

Le test exige **trois conditions simultanées** :

1. le titre contient un **marqueur de généricité** (`documentation`, `rapports sur`,
   `recherche académique`, `impact sur`, `études sur`, `divers`, `état de l'art`…) ;
2. il ne contient **aucune année** entre 1500 et 2029 — l'année est le marqueur
   d'individuation le plus universel d'une publication ;
3. il ne contient **aucun ancrage éditorial** — ni `et al.`, ni nom de revue ou
   d'éditeur reconnu (*Nature*, *Science*, arXiv, IEEE, ACM, OCDE, GIEC…), ni
   référence de norme, de loi ou de règlement, ni motif « Nom, Nom — Titre ».

Le cumul est ce qui rend le test défendable : il n'attrape que les titres qui ne
portent **aucun** des trois moyens usuels d'identifier un document. « Rapports
d'évaluation du GIEC (depuis 1990) » passe (année + GIEC). « Ji et al., *Survey of
Hallucination in NLG*, ACM Computing Surveys » passe (auteur + revue).

Le résultat est ensuite **scindé selon la présence d'une URL**, parce que le travail
de correction n'est pas le même :

- **sans URL → bloquant** (42 entrées) : la source est réellement introuvable ;
- **avec URL → mineur** (28 entrées) : la source est atteignable, seul l'intitulé
  est à préciser (« Documentation Anthropic » → la page précise).

Le test est **conservateur** : il ne dit rien d'un titre vague qui n'emploie aucune
des tournures listées. Un second niveau (`A4bis`) borne ce reste, mais il est
bruyant et n'est rendu **que comme signal** : 114 détections, dont **79 portent
pourtant une URL**, soit un **taux de faux positifs mesuré de 69 %**. Il est publié
avec ce chiffre, pas comme un résultat.

### 2. Recopie de passages — index inversé puis plus long passage commun

On indexe les n-grammes de N mots (N = `--seuil`, 10 par défaut) de chaque champ vers
les fiches qui les portent ; seules les paires partageant au moins un n-gramme sont
ensuite comparées par plus long passage commun exact. Le résultat est rendu en
**groupes de fiches avec le passage cité**, pas en score : un score ne dirait pas
quoi corriger.

Trois faux positifs sont traités explicitement :

- deux gaps adossés à la **même** fiche IA décrivent le même mécanisme — la
  répétition est attendue. Ces groupes sont classés « intra-famille » et rendus comme
  **signal**, jamais comme défaut ;
- une formule figée du domaine (« les lois de la physique et la vitesse de la
  lumière sont invariantes ») n'est pas une recopie fautive ;
- un gap reprend légitimement le vocabulaire de ses parents — d'où un seuil relevé
  (12 mots minimum) pour la détection de recopie depuis la fiche parente.

Sensibilité du curseur, mesurée :

| `--seuil` (mots) | groupes inter-fiches sans lien | groupes intra-famille | gaps recopiant un parent |
|---|---|---|---|
| 6 | 125 | 162 | 33 |
| 8 | 23 | 79 | 33 |
| **10 (défaut)** | **4** | **45** | **33** |
| 12 | 1 | 27 | 19 |
| 15 | 0 | 8 | 3 |
| 20 | 0 | 2 | 0 |

À 6 mots la détection est du bruit ; à 15 elle ne voit plus rien. Le choix de 10 est
le point où les groupes restants sont tous lisibles et arbitrables un par un.

### 3. Formule creuse — et sa limite honnête

Six familles de tournures attribuant une opinion à un collectif anonyme (« jugé par
certains », « des critiques estiment », « souvent qualifié », « il est admis »…). Le
partage défaut/signal se fait sur la présence d'un mot capitalisé, hors début de
phrase, dans les 160 caractères suivants.

Cet indice est imparfait **dans les deux sens**, et c'est assumé :
« Accusé par certains courants analytiques (dont Searle…) » est bien attribué et un
test plus strict l'aurait manqué ; « jugée par certains trop totalisante ; sa
*Dialectique de la raison*… » ne l'est pas mais porte un titre d'œuvre capitalisé.
D'où deux niveaux : **27 en défaut** (aucune majuscule interne du tout — la formule
est presque sûrement en l'air) et **2 en signal** (`jacques-derrida`, `jacques-lacan`
— à relire).

### Ce que ce script ne fait pas

- **Aucun appel réseau.** La disponibilité des URL est le travail de
  `verifier-liens.mjs`, qui n'est pas dupliqué ici.
- **Aucune modification.** Rien n'est écrit dans `data/seed/`.
- **Aucun jugement de fond.** Une fiche peut passer tous les tests et être fausse.

---

## Les chiffres sur les 512 fiches

**Corpus** : 512 fiches (267 humaines, 44 IA, 201 gaps) + 4 questions,
**1 235 entrées de source**, 355 URL distinctes.

### Traçabilité des sources (section A)

| Code | Gravité | Occurrences | Constat |
|---|---|---|---|
| `A3-source-sans-date` | sérieux | **1 234 / 1 235** | Sources sans date de publication ni de consultation |
| `A1-primaire-sans-url` | sérieux | **346 / 663** | Sources primaires sans URL (52 % des primaires) |
| `A10-moins-de-deux-sources` | sérieux | **95** | Fiches publiées portant moins de 2 sources |
| `A6-source-usage-identique-a-la-fiche` | mineur | 83 | Usage sectoriel IA sans source propre (42 fiches IA sur 44) |
| `A7-url-sous-plusieurs-titres` | mineur | 67 | Même URL citée sous deux titres |
| `A4-intention-de-source` | **bloquant** | **42** | Titre ne désignant aucun document, et sans URL |
| `A4ter-titre-generique-mais-url-presente` | mineur | 28 | Titre générique mais source atteignable |
| `A2-secondaire-sans-url` | sérieux | 26 / 572 | Sources secondaires sans URL |
| `A9-source-agregee` | sérieux | 22 | Plusieurs documents empilés dans un seul `titre` |
| `A8-titre-sous-plusieurs-url` | sérieux | 5 | Même titre, deux URL (double encodage) |
| `A5-doublon-dans-une-liste` | sérieux | 0 | — |
| `A11-aucune-secondaire-cliquable` | sérieux | 0 | — |

Part des entrées de source avec URL : **70 %**. Part datée : **0,1 %**.
Fiches sans aucune URL : **0** (humaines, IA et gaps).

### Recopie entre fiches (section B)

| Code | Gravité | Occurrences | Constat |
|---|---|---|---|
| `B2-passage-recopie-intra-famille` | signal | 45 groupes | Gaps de la même famille partageant ≥ 10 mots (jusqu'à **31 mots**) |
| `B3-gap-recopie-sa-fiche-parente` | sérieux | 33 | Gap reprenant ≥ 12 mots d'une de ses deux fiches |
| `B1-passage-recopie-entre-fiches-sans-lien` | sérieux | **4 groupes** | Passage ≥ 10 mots partagé par des fiches sans rattachement |

### Formules creuses (section C)

| Code | Gravité | Occurrences | Constat |
|---|---|---|---|
| `C1-formule-creuse-non-attribuee` | sérieux | **27** | Opinion attribuée à un collectif anonyme |
| `C2-formule-creuse-mais-nom-propre-proche` | signal | 2 | À relire |

Répartition des 29 détections : « jugé / accusé / critiqué par certains » ×23,
« souvent / parfois qualifié » ×4, « certains estiment (sujet nu) » ×2.
**20 des 26 fiches en défaut sont sur l'axe philosophique** — l'audit de fond en avait
vu 6 sur son échantillon de 15 ; à l'échelle des 53 fiches de l'axe, c'est **38 %**.

### Cohérence des fiches IA (section D)

| Code | Gravité | Occurrences | Constat |
|---|---|---|---|
| `D5-trl-sur-secteur-academique` | sérieux | **28 / 87 usages** | TRL attribué à un secteur `recherche` ou `science` |
| `D1-secteur-duplique` | **bloquant** | **2** | `lstm` (industrie ×2), `aide-a-la-decision-publique-govtech-ia` (gouvernement ×2) |
| `D2-usage-sans-exemple` | sérieux | 0 | — |
| `D3-usage-sans-source` | sérieux | 0 | — |
| `D4-trl-hors-bornes` | bloquant | 0 | — |

Les deux secteurs dupliqués sont exactement ceux qu'avait trouvés l'audit de fond,
incidemment, via l'indexeur RAG. Le test les retrouve mécaniquement — et confirme
qu'il n'y en a **que** deux.

Un TRL sur trois est posé sur un secteur académique. Les deux entrées les plus
discutables sont `alexnet/recherche = 9` et `k-nn/recherche = 9` : une échelle de
maturité de déploiement portée à son maximum pour décrire une adoption
bibliographique.

### Cohérence des gaps (section E)

| Code | Gravité | Occurrences | Constat |
|---|---|---|---|
| `E4-documents-cles-etrangers-sans-url` | sérieux | **30** | Référence absente des deux fiches liées ET sans URL |
| `E1-confiance-elevee-sur-trl-faible` | **bloquant** | **6** | Règle explicite du projet violée |
| `E1bis-confiance-elevee-sur-trl-de-deploiement-faible` | sérieux | 4 | TRL ≥ 7 atteint seulement sur `recherche`/`science` |
| `E2-technologie-complementaire-hors-cas` | bloquant | 0 | — |
| `E3-axes-prospectifs-nombre` | sérieux | 0 | Les 201 gaps portent bien 3 axes |
| `E5-axes-prospectifs-confiance-uniforme` | mineur | 0 | — |
| `E4bis-documents-cles-etrangers-avec-url` | signal | 73 | Le plus souvent un enrichissement légitime |

Note d'honnêteté sur `E4` : sur les 103 `documents_cles` absents des deux fiches
parentes, **73 portent une URL** et sont pour la plupart des *améliorations* (le gap
cite l'article original d'arXiv que la fiche parente ne citait pas). Ils sont rendus
en signal, pas en défaut. Seuls les **30 sans URL** sont retenus comme défaut : ceux-là
sont introuvables depuis le corpus.

### Chronologie et longueurs (section F)

| Code | Gravité | Occurrences | Constat |
|---|---|---|---|
| `F1-dates-heterogenes-dans-un-lot` | mineur | 34 | Reprise partielle non tracée dans un fichier |
| `F3-champ-anormalement-court` | sérieux | 22 | Champ < 60 % de la médiane de son groupe |
| `F2-gap-anterieur-a-sa-fiche-parente` | sérieux | **1** | `tcc-vs-claude-cowork` |

Sensibilité du seuil de champ court : `0,50 → 9` détections, `0,60 → 22`,
`0,70 → 72`, `0,80 → 261`. Le défaut à 0,60 isole une queue de distribution nette ;
au-delà de 0,70 on ne mesure plus qu'une variation de style normale.

Deux champs sont carrément **absents** : `resonance_ia` sur `democratie-liberale` et
sur `economie-du-donut-kate-raworth`.

### Couverture (section G)

- **66 fiches humaines sur 267 (25 %)** ne sont mobilisées dans aucun gap :
  32 sociales, 20 évolution, 13 philosophiques, 1 psychologique.
- **1 fiche IA sur 44** n'est mobilisée dans aucun gap : `rnn`.
- 201 gaps pour 201 couples humaine × IA distincts : aucun doublon de couple.
- Longueurs médianes (caractères) : `these_centrale` 264-293 selon l'axe,
  `apport` 221-270, `limites_critiques` 247-283, `resonance_ia` 235-296 ;
  côté gap, `apport_ia` 449, `mode_interaction` 171.
- Sources par axe humain : social 217 sources dont 199 avec URL ; philosophique
  110 dont 53 ; évolution 110 dont 55 ; psychologique 26 dont 12 ; sérénité 10 dont 5.
  **Le déséquilibre est net** : hors axe social, exactement une source sur deux porte
  une URL — c'est la source secondaire, la primaire n'en a jamais.

---

## Les trois découvertes qui n'étaient pas dans l'audit de fond

### 1. Le corpus n'est daté nulle part : 1 source sur 1 235

La règle éditoriale du projet est un « sourçage systématique **daté** ». Le champ
`date` de `Source` est renseigné sur **une seule entrée de tout le corpus** (0,1 %).
Le validateur ne le voit pas — `date` est optionnel dans `lib/types.ts`. Conséquence
concrète : rien ne permet de savoir à quelle version d'une page Wikipédia une fiche
se réfère, ni si l'agent l'a ouverte le 5 septembre ou jamais. C'est le pendant
exact du finding central de l'audit de fond (« rédaction faite de mémoire puis
habillée d'une source après coup ») — mais mesurable, et à 99,9 %.

### 2. La règle « une primaire + une secondaire » n'est pas tenue sur 95 fiches, et 42 fiches IA sur 44 n'ont pas de source propre au niveau de leurs usages

Le validateur n'exige qu'**au moins une** source. Le référentiel en exige **deux**.
Résultat mesuré : **95 fiches publiées portent moins de deux sources** — 68 sur l'axe
social (les régimes politiques, les modèles économiques et les 20 économistes
n'ont qu'un lien Wikipédia) et **27 fiches IA sur 44 (61 %)**.

Plus révélateur encore : sur les 87 `usages` sectoriels des fiches IA, **83 citent
exactement la source de la fiche mère**, sans rien y ajouter — cela concerne
**42 fiches IA sur 44**. Le champ `sources` d'un usage est structurellement là pour
justifier un TRL et des exemples sectoriels ; il est ici rempli par recopie du niveau
supérieur. Un TRL de 9 sur `alexnet/recherche` n'est adossé à rien d'autre qu'à
l'article Wikipédia général d'AlexNet.

### 3. Le gabarit n'est pas où on le croyait — et l'affirmation la plus sensible de l'audit de fond a été propagée mot pour mot dans un gap

On s'attendait à trouver un gabarit de rédaction dans les 267 fiches humaines. Il
n'y est **pas** : au seuil de 10 mots, **4 groupes seulement**, et les quatre
s'expliquent thématiquement (`albert-einstein` / `relativite-generale-et-restreinte`,
`robert-solow` / `croissance-de-solow-swan`, `linus-pauling` / `marie-curie` sur la
formule « seule personne à ce jour lauréate de deux prix Nobel »). Les agents
rédacteurs n'ont pas copié-collé entre fiches humaines.

Le gabarit est **entièrement concentré dans les gaps** : 45 groupes intra-famille,
dont un passage de **31 mots strictement identique** entre
`dani-rodrik-vs-dependance-energetique-ia` et `peter-singer-vs-dependance-energetique`
(« …fabrication des puces, 800 kg de matières premières pour un ordinateur de 2 kg,
8 à 10 gallons d'eau par puce… »), et 33 cas de recopie littérale depuis une fiche
parente.

Et le cas le plus important est celui-ci : **`tcc-vs-claude-cowork` recopie 15 mots
de `therapies-cognitivo-comportementales-tcc`** — précisément la phrase que l'audit
de fond a désignée comme son *finding le plus sensible* (« facteur le plus prédictif
du résultat clinique selon les méta-analyses toutes approches confondues »,
affirmation d'efficacité clinique sans source). Le même gap est en outre le **seul du
corpus antidaté** par rapport à sa fiche parente (`F2`). Une affirmation non sourcée
sur un sujet de santé mentale ne s'est donc pas contentée d'exister : elle s'est
propagée, et le script montre par quel chemin.

**Découverte annexe, purement technique** : 5 pages Wikipédia sont stockées **deux
fois, sous deux encodages d'URL différents** (`Régression_linéaire` et
`R%C3%A9gression_lin%C3%A9aire`, idem pour la régression logistique, les arbres de
décision, les forêts aléatoires et les k plus proches voisins). Le vérificateur de
liens les teste deux fois, l'indexeur RAG les compte comme deux sources distinctes,
et une correction appliquée à l'une ne touchera pas l'autre.

---

## Liste de reprise — plan de travail pour la vague de correction

**496 fiches sur 512 portent au moins un défaut.**

| Gravité | Fiches | Détail |
|---|---|---|
| **Bloquant** | **35** | 8 fiches IA, 27 gaps, 0 humaine |
| Sérieux (sans bloquant) | **389** | 213 humaines, 36 IA, 140 gaps |
| Mineur seul | **72** | 52 humaines, 20 gaps |

La liste complète et machine-lisible s'obtient par
`node scripts/auditer-corpus.mjs --json` (clé `liste_reprise`, triée par gravité puis
par id).

### A. Les 35 fiches bloquantes, une par une

| # | Fiche | Ce qui cloche | Ce qu'il faut faire |
|---|---|---|---|
| 1 | `aide-a-la-decision-publique-govtech-ia` (IA) | secteur `gouvernement` en double (TRL 6 puis 6) ; source primaire « Systèmes d'aide à la décision publique par IA — documentation GovTech » sans URL, répétée dans les 2 usages | Fusionner les deux usages `gouvernement`. Remplacer la source par les documents réellement décrits par la fiche (dossier SyRI, rapport Ofqual sur les A-levels) avec URL. Réexaminer le TRL 6 : la fiche décrit des déploiements nationaux. |
| 2 | `lstm` (IA) | secteur `industrie` en double (TRL 8 puis 8) ; 1 seule source ; usages sans source propre | Fusionner les deux usages `industrie`. Ajouter une source primaire (Hochreiter & Schmidhuber 1997) avec URL. |
| 3 | `ia-en-genomique-et-drug-discovery` (IA) | source « AlphaFold — impact sur la recherche pharmaceutique » sans URL, en primaire **et** dans 2 usages ; usages sans source propre ; TRL sur `science` | Remplacer par un document réel. Donner à chaque usage une source sectorielle propre. |
| 4 | `criblage-virtuel-de-molecules-ia-pharmaceutique` (IA) | « Criblage virtuel de molécules par IA — documentation sectorielle pharmaceutique » sans URL ×3 ; usages sans source propre ; TRL sur `science` | Idem : nommer les plateformes et publications réelles. |
| 5 | `tutorat-adaptatif-personnalise-edtech-ia` (IA) | « Systèmes de tutorat adaptatif — documentation sectorielle EdTech » sans URL ×3 ; usages sans source propre | Sourcer sur VanLehn 2011 / Kulik & Fletcher 2015, déjà cités (mal) par les gaps qui en dépendent. |
| 6 | `jumeaux-numeriques-industriels-ia` (IA) | « Jumeaux numériques industriels — documentation sectorielle (Siemens, GE, Dassault Systèmes) » sans URL ×3 | Trois éditeurs nommés, trois documentations réelles : les citer séparément avec URL. |
| 7 | `biais-herites-des-donnees-d-entrainement-limite-transversale` (IA) | « Recherche académique sur l'équité algorithmique (fairness in ML) » sans URL ×3 | Citer Buolamwini & Gebru 2018 et Corbett-Davies & Goel 2018 — que 4 gaps citent déjà en aval, en source agrégée. |
| 8 | `dependance-energetique-et-materielle-de-l-ia-limite-transversale` (IA) | « Rapports sur l'empreinte énergétique de l'IA (AIE, études académiques) » sans URL ×3 | Citer les rapports AIE et Luccioni et al. 2024 nommément. |
| 9-14 | `cern-vs-frameworks-multi-agents`, `democratie-liberale-vs-govtech-ia`, `multilateralisme-institutionnel-vs-govtech-ia`, `gouvernance-reseau-multiniveau-vs-frameworks-multi-agents`, `onu-vs-govtech-ia`, `holacratie-vs-frameworks-multi-agents` (gaps) | `confiance: "elevee"` alors que la fiche IA mobilisée plafonne à **TRL 6** — règle explicite du projet | Redescendre à `moyenne`, **ou** justifier le relèvement du TRL de la fiche IA. Ne pas faire les deux séparément : c'est le même arbitrage. 4 de ces 6 cumulent une source agrégée et un `documents_cles` introuvable. |
| 15-24 | `alliance-solaire-vs-dependance-energetique`, `entreprise-a-mission-vs-biais-donnees`, `zizek-vs-dependance-energetique`, `honneth-vs-govtech`, `maoisme-vs-govtech-ia`, `sen-vs-govtech`, `baii-vs-jumeaux-numeriques`, `eco-socialisme-vs-dependance-energetique`, `feynman-vs-dependance-energetique`, `krugman-vs-dependance-materielle` (gaps) | `documents_cles` reprenant une « intention de source » d'une fiche IA (lignes 3-8), donc sans URL | **Corriger d'abord les fiches IA 3-8, puis répercuter.** Aucun de ces gaps ne se corrige isolément. 4 d'entre eux recopient en plus ≥ 12 mots de leur fiche parente. |
| 25-35 | `piaget-vs-tutorat-adaptatif`, `systeme-terre-vs-dependance-energetique`, `tu-youyou-vs-criblage-virtuel`, `ue-cee-vs-decision-publique`, `union-africaine-vs-biais-donnees`, `becker-vs-biais-donnees`, `fanon-vs-biais-donnees`, `laissez-faire-vs-biais-donnees`, `nazisme-vs-biais-donnees`, `rosalind-franklin-vs-biais-donnees`, `watson-vs-ia-genomique` (gaps) | idem : `documents_cles` = intention de source héritée | Même chantier que 15-24. |

**Lecture du tableau** : les 27 gaps bloquants ne portent pas 27 défauts
indépendants. Ils héritent de **6 titres de source fautifs** situés dans 6 fiches IA
(lignes 3-8) et d'**un seul arbitrage TRL/confiance** portant sur 2 fiches IA. Corriger
8 fiches IA et trancher un arbitrage lève **33 des 35 blocages**. Les 2 restants
(`lstm`, `aide-a-la-decision-publique-govtech-ia`) sont les secteurs dupliqués.

### B. Chantiers sérieux, groupés par nature de correction

Les 389 fiches sérieuses se ramènent à neuf chantiers. Les listes d'identifiants
complètes sont dans la sortie `--json`.

| Chantier | Fiches | Périmètre | Action |
|---|---|---|---|
| **S1 — Dater les sources** | tout le corpus | 1 234 entrées sur 1 235 | Décision de méthode avant tout travail de masse : rendre `date` obligatoire à la création, et rattraper au moins les sources primaires. Sans cela le chantier S2 sera à refaire. |
| **S2 — URL sur les sources primaires** | **297** (dont 265 hors bloquantes) | 55 évolution, 53 philosophique, 12 psychologique, 5 sérénité, 17 social, 13 IA, 142 gaps | 100 % des axes évolution, philosophique, psychologique et sérénité sont concernés : **aucune** source primaire de ces axes ne porte d'URL. Beaucoup existent en ligne (Wikisource, archive.org, arXiv, DOI). Priorité aux 55 fiches d'évolution, dont les primaires sont des articles scientifiques tous accessibles par DOI. |
| **S3 — Deuxième source** | **95** (dont 94 hors bloquantes) | 68 axe social (régimes politiques, modèles économiques, 20 économistes), 26 fiches IA | Ajouter la source manquante. Sur l'axe social il manque systématiquement la **primaire** ; sur les fiches IA, la **secondaire**. |
| **S4 — Formules creuses** | 26 | 20 philosophique, 5 social, 1 sérénité | Nommer le critique, ou retirer la critique. Fiches : `albert-camus`, `antonio-negri`, `bruno-latour`, `chantal-mouffe`, `daniel-dennett`, `david-chalmers`, `donna-haraway`, `giorgio-agamben`, `hans-georg-gadamer`, `hilary-putnam`, `jacques-ranciere`, `judith-butler` (×2), `luce-irigaray`, `mauricio-ferraris`, `martha-nussbaum`, `paul-ric-ur`, `quentin-meillassoux`, `slavoj-zizek`, `theodor-adorno`, `tristan-garcia`, `quete-de-sens-spiritualites-et-laicite`, `totalitarisme`, `simon-johnson`, `oea`, `forum-economique-mondial-wef`, `entreprise-a-mission-rse-integree`. |
| **S5 — TRL sur secteur académique** | **28 fiches IA** | 28 usages sur 87 | Arbitrage de gabarit, pas correction fiche par fiche : soit on retire le TRL des secteurs `recherche`/`science`, soit on documente dans `/methodologie` qu'il y désigne autre chose. En l'état, `alexnet/recherche = 9` et `k-nn/recherche = 9` ne sont pas défendables. |
| **S6 — `documents_cles` introuvables** | **30 gaps** (dont 27 hors bloquants) | sans URL et absents des deux fiches parentes | Rattacher à une source réelle. 19 de ces 30 sont aussi des sources agrégées (S7) : même passe. |
| **S7 — Sources agrégées** | **22 gaps** (dont 19 hors bloquants) | 10 titres distincts, réutilisés jusqu'à 5 fois | Éclater chaque `titre` en autant d'entrées `Source` que de documents. Ex. « Programme Adèle (2004) ; Action Publique 2022 — Gouvernement français » → 2 entrées. |
| **S8 — Recopie de gap** | **30 gaps** (dont 23 hors bloquants) | ≥ 12 mots repris d'une fiche parente | Reformuler, en commençant par `tcc-vs-claude-cowork` (voir découverte 3 — c'est une affirmation clinique non sourcée qui a été propagée) et `ludwig-wittgenstein-vs-claude-cowork` / `management-hybride-vs-claude-cowork` (15 mots de `capacites_cles` recopiés tels quels dans `mecanisme`). |
| **S9 — Champs bâclés** | 15 | dont 2 champs absents | `democratie-liberale` et `economie-du-donut-kate-raworth` n'ont **pas** de `resonance_ia`. `codex-famille-gpt` a un `limites_connues` à 32 % de la médiane. `friedrich-nietzsche` (déjà signalé par l'audit de fond) a un `apport` à 42 %. |

À ajouter, hors chantier de masse :

- `A8` — 5 URL en double encodage à unifier : `regression-lineaire`,
  `regression-logistique`, `arbres-de-decision`, `forets-aleatoires`, `k-nn` et les
  17 gaps qui les citent.
- `E1bis` — 4 gaps AlphaFold en confiance `elevee` (`crispr-cas9-vs-alphafold`,
  `pauling-vs-alphafold`, `embl-vs-alphafold`, `solow-vs-alphafold`) : la fiche
  atteint TRL 8, mais seulement sur `recherche`. Arbitrage lié à S5.
- `B1` — 4 groupes à arbitrer : sont-ils une recopie ou une redite thématique
  assumée entre une fiche « personne » et une fiche « théorie » ?

### C. Défauts mineurs (72 fiches sans autre défaut)

- **`A7`, 138 fiches** — même URL sous deux titres, presque toujours « X » vs
  « X — Wikipédia ». Normalisation mécanique, aucun arbitrage éditorial.
- **`A6`, 42 fiches IA sur 44** — usages sans source propre (voir découverte 2). Mineur
  au sens du script, structurant au sens éditorial.
- **`A4ter`, 23 fiches** — « Documentation Anthropic », « LangGraph — Documentation
  officielle » : préciser la page.
- **`F1`, 34 fiches** — dates de vérification hétérogènes dans un lot. Le cas notable
  est `social_2.json` : 21 fiches sur 71 rectifiées le 06/09 sans entrée de changelog.

---

## Ce qu'il faut retenir pour la méthode

Trois règles gagneraient à devenir des contrôles de `valider-donnees.mjs`, parce
qu'elles sont mécaniques et qu'aucune ne l'est aujourd'hui :

1. **URL obligatoire par entrée de source**, et non par fiche — la recommandation
   de l'audit de fond, que ce rapport chiffre à 372 entrées concernées.
2. **Deux sources minimum sur une fiche publiée**, une primaire et une secondaire —
   95 fiches y échoueraient aujourd'hui.
3. **Unicité du secteur au sein d'une fiche IA** — 2 cas, tous deux confirmés ici.

Et une règle de rédaction, qui ne se contrôle pas mais qui se mesure : un champ de
gap ne doit pas reprendre littéralement plus d'une douzaine de mots de ses fiches
parentes. Le script sait le dire ; c'est le seul moyen de repérer qu'une affirmation
non sourcée s'est propagée d'une fiche à une autre.

---

*Généré par `node scripts/auditer-corpus.mjs` le 07/09/2026, seuils par défaut
(recopie ≥ 10 mots, champ court < 60 % de la médiane de groupe). Aucun fichier de
`data/seed/` n'a été modifié.*

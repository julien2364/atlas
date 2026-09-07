# Audit contradictoire du fond — extension aux fiches humaines non auditées (07/09/2026)

> Ce rapport ne corrige rien et ne touche à aucun fichier de `data/seed/`. Il constate.
> Chaque finding porte la citation fautive mot pour mot, ce que dit réellement la source
> consultée, et la correction proposée.

## 1. Pourquoi cet audit, et pourquoi ce périmètre

L'audit du 07/09 (`docs/audit-fond-2026-09-07.md`) a porté sur 69 fiches tirées au sort sur
512, dont 54 humaines. Il reste **213 fiches humaines non auditées sur 267**. Son
enseignement central était que **la neutralité tient mais pas la fidélité à la source** :
des champs entiers, exacts sur le fond, sont absents du document réellement cité.

Le mégaprompt de finalisation (`docs/megaprompts-finalisation.md`, MEGAPROMPT 3, tâche 2)
demande de cibler en priorité **les lots produits le plus vite, par paquets de 10 à 40
fiches d'affilée**, et nomme explicitement le batch des organisations internationales de
`social_2.json`. C'est la question que ce rapport instruit : **les lots produits vite
sont-ils réellement plus fautifs que la moyenne, et de combien ?**

Pour y répondre il faut un témoin. L'échantillon est donc construit en trois lots : deux
lots « suspects » désignés a priori, et un lot tiré au sort qui sert de groupe de contrôle.

## 2. Méthode

### 2.1 Constitution de l'échantillon — 55 fiches

**Exclusion préalable.** Les identifiants des 54 fiches humaines déjà auditées le 07/09 ont
été relevés dans le rapport précédent et exclus par script. Trois d'entre elles tombaient
dans le périmètre visé : `esa`, `laboratoire-cavendish` et `cnrs` (lot institutions). Le lot
institutions ne compte donc que **12 fiches** au lieu des 15 nommées dans la commande ; les
3 fiches manquantes ont été reportées sur le lot tiré au sort, qui passe de 15 à 18. Le
total reste de 55.

| Lot | Contenu | n | Statut |
|---|---|---|---|
| **A** | Organisations internationales de `social_2.json` (`sous_domaine = organisation_internationale`), tirage au sort dans les 35 fiches non déjà auditées sur 37 | 25 | lot suspect désigné |
| **B** | Institutions de recherche de `evolution.json`, exhaustif après exclusion d'ESA, Cavendish et CNRS | 12 | lot suspect désigné |
| **C** | `social_1.json`, tirage au sort dans les 62 fiches non déjà auditées sur 71 | 18 | **groupe de contrôle** |

**Graine et générateur.** Tirage reproductible par générateur congruentiel linéaire
(paramètres glibc), **graine 20260907** :

```js
let x = 20260907;
const rnd = () => { x = (1103515245 * x + 12345) % 2147483648; return x / 2147483648; };
// mélange de Fisher-Yates du pool éligible, puis n premiers éléments
```

Le pool est construit dans l'ordre du fichier JSON, après retrait des fiches déjà auditées.
Rejouer ce générateur sur les mêmes fichiers redonne exactement les 25 et 18 identifiants
listés en annexe A.

### 2.2 Vérification des sources

Les 56 URL distinctes citées par les 55 fiches ont été récupérées **en texte intégral** —
et non en résumé — via l'API MediaWiki (`action=query&prop=extracts&explaintext=1`, suivi
des redirections), puis confrontées champ par champ au contenu des fiches par recherche
littérale sur chaque fait, chiffre, date et nom propre. Cette méthode est plus sévère qu'une
lecture assistée : elle prouve l'**absence** d'un terme dans la source, ce qu'un résumé ne
permet jamais d'affirmer. `WebFetch` a été utilisé en complément pour les vérifications
qualitatives et pour les pages que l'API a refusé de servir (limitation de débit).

**Aucun domaine n'a été bloqué par le proxy.** Les 56 URL ont toutes répondu. La seule
difficulté rencontrée a été une limitation de débit de l'API Wikipédia, contournée par
étalement des requêtes puis par `WebFetch` pour la dernière page (`Technocratie`).

### 2.3 Notation

Quatre axes, de 1 à 5 : fidélité à la source, neutralité, densité, utilité. Comme dans
l'audit précédent, la note de fidélité ne porte que sur ce qui était **vérifiable**,
c'est-à-dire les sources munies d'une URL.

---

## 3. Résultat d'ensemble

| Lot | Fidélité | Neutralité | Densité | Utilité | À reprendre |
|---|---|---|---|---|---|
| **A — organisations internationales (25)** | **3,12** | 3,88 | 3,96 | 3,88 | 8/25 = **32 %** |
| **B — institutions de recherche (12)** | **2,67** | 3,83 | 4,00 | 3,67 | 7/12 = **58 %** |
| **C — `social_1.json`, tiré au sort (18)** | **3,78** | 3,89 | 3,89 | 3,89 | 4/18 = **22 %** |
| **Ensemble (55)** | **3,24** | **3,87** | **3,95** | **3,84** | 19/55 = **35 %** |

**5 findings bloquants, 20 sérieux, 20 mineurs — 45 au total.**

**9 fiches sur 55 (16 %) sont sorties indemnes** : `ligue-arabe`, `sdn`, `giec-ipcc`,
`nasa`, `communisme`, `eco-socialisme`, `junte`, `technocratie`, `thomas-piketty`. C'est un
résultat utile en soi : la production rapide n'a pas tout abîmé, et deux fiches du lot le
plus suspect (Ligue arabe, SDN) sont irréprochables sur chacun de leurs faits vérifiables.

### 3.1 La réponse à la question posée

**Oui, et l'écart est net et mesurable — mais il porte sur la fidélité seule.**

| Comparaison sur l'axe fidélité | Note | Écart vs ensemble 07/09 (3,37) |
|---|---|---|
| Ensemble 07/09 (69 fiches, tous axes) | 3,37 | — |
| **Lot C — tirage au sort `social_1` (témoin)** | **3,78** | **+0,41 (+12 %)** |
| Lot A — organisations internationales | 3,12 | −0,25 (−7 %) |
| **Lot B — institutions de recherche** | **2,67** | **−0,70 (−21 %)** |

Le groupe de contrôle est la mesure qui compte : tiré au sort dans le même axe social, par
la même méthode, il note **3,78** contre **3,12** pour le batch d'organisations
internationales et **2,67** pour le batch d'institutions. **L'écart entre le lot tiré au
sort et le lot d'institutions est de 1,11 point sur 5, soit 29 %.** Le taux de fiches à
reprendre suit : 22 % pour le témoin, 32 % et 58 % pour les lots désignés.

Le lot d'institutions de recherche est, à ce jour, **le lot le plus infidèle mesuré sur ce
corpus**, devant l'échantillon évolution du 07/09 (3,27) et l'échantillon IA (3,10).

Trois précisions d'honnêteté :

1. **La neutralité ne varie pas.** 3,88 / 3,83 / 3,89 : les trois lots sont indiscernables,
   et tous conformes au 4,02 de l'audit précédent. La production rapide n'a pas dégradé le
   ton — elle a dégradé le sourcing. L'enseignement central du 07/09 est donc **confirmé, et
   confirmé plus fortement encore sur les lots rapides**.
2. **La densité et l'utilité non plus** (3,89–4,00 et 3,67–3,89). Les fiches rapides sont
   aussi denses et aussi utiles que les autres. Elles sont simplement moins traçables.
3. **L'intuition du mégaprompt était partiellement fausse dans son classement.** Le batch
   qu'il désignait comme le plus suspect (organisations internationales) est moins fautif
   que celui des institutions de recherche, que personne n'avait désigné et que l'audit du
   07/09 n'avait qu'effleuré (3 fiches sur 15).

---

## 4. Findings transversaux

### T1 — [BLOQUANT] La « source primaire » est la source secondaire, à l'identique — 54 fiches du corpus

Dans **24 des 25 fiches du lot A**, l'entrée `sources[0]` de type `primaire` et l'entrée
`sources[1]` de type `secondaire` portent **exactement la même URL**, le même article de
Wikipédia, sous deux titres légèrement différents. Exemple mot pour mot, fiche `onu` :

```json
{ "titre": "Organisation des Nations unies", "type": "primaire",
  "url": "https://fr.wikipedia.org/wiki/Organisation_des_Nations_unies" },
{ "titre": "Organisation des Nations unies — Wikipédia", "type": "secondaire",
  "url": "https://fr.wikipedia.org/wiki/Organisation_des_Nations_unies" }
```

Ces 24 fiches n'ont donc **aucune source primaire**. La règle 3 du référentiel (« une source
primaire et une secondaire ») est satisfaite dans la forme et vidée dans le fond : le
dispositif de traçabilité est réduit de moitié par un simple relibellé. Une encyclopédie
généraliste est par définition une source tertiaire ; l'étiqueter `primaire` est une
inexactitude méthodologique, pas seulement un doublon.

Balayage du corpus humain entier : **54 fiches sur 267 (20 %)** présentent ce défaut, et
**toutes les 54 sont dans `social_2.json`** :

| Fichier / sous-domaine | Fiches concernées |
|---|---|
| `social_2.json` / `organisation_internationale` | **36 sur 37** |
| `social_2.json` / `management` | 11 sur 16 |
| `social_2.json` / `gouvernance_mondiale` | 7 sur 8 |
| Tous les autres fichiers et sous-domaines | **0** |

C'est la signature la plus nette de la production en série : le défaut est parfaitement
corrélé au fichier et au sous-domaine, jamais dispersé. L'audit du 07/09 l'avait aperçu sur
une fiche (`minilateralisme-et-clubs-g7-g20`, noté « doublon de type » en passant) sans
mesurer qu'il en concernait 54.

**Correction proposée** : soit retirer l'entrée `primaire` et assumer une fiche à source
unique secondaire, soit lui substituer une vraie source primaire (charte, traité, statuts,
rapport annuel de l'organisation — tous en ligne pour ces 36 organisations). Et ajouter au
validateur une règle refusant deux entrées de types différents pointant la même URL.

### T2 — [SÉRIEUX] `resonance_ia` : aucune source ne l'appuie, sur 37 fiches sur 37 des lots A et B

Aucune des 37 sources des lots A et B ne contient les mots « intelligence artificielle »,
« apprentissage automatique » ou « IA » dans un sens pertinent. **100 % des champs
`resonance_ia` de ces deux lots sont donc hors-source**, y compris quand ils avancent des
faits vérifiables présentés comme acquis :

- `conseil-de-stabilite-financiere-csf` : *« Le CSF **a commencé à étudier** les risques
  systémiques que l'usage croissant de l'IA dans le secteur financier […] pourrait faire
  peser sur la stabilité financière mondiale. »* — affirmation d'un fait daté sur une
  institution, absente de la source.
- `ocde` : *« L'OCDE a produit **dès 2019** les premiers Principes sur l'IA adoptés au niveau
  intergouvernemental »* — date et fait absents de la source.
- `universite-de-stanford` : *« Le Stanford Institute for Human-Centered AI (HAI) publie
  chaque année […] (AI Index) »* — ni « HAI » ni « AI Index » n'apparaissent dans la source.
- `embl` : *« L'EMBL-EBI a hébergé et diffusé publiquement les bases de données structurales
  de protéines sur lesquelles DeepMind a entraîné et validé AlphaFold »* — ni « EBI », ni
  « AlphaFold », ni « UniProt » n'apparaissent dans la source.

**Nuance importante, et elle joue en faveur du corpus** : le défaut est de traçabilité, pas
de neutralité. Aucune survalorisation de l'IA n'a été relevée dans les 55 champs
`resonance_ia`. Les formulations restent hypothétiques (« pourrait », « est parfois cité en
analogie », « pose la question ») ; aucun « prouve », « révolutionne » ou « surpasse ». Le
constat du 07/09 sur ce point est confirmé.

**Correction proposée** : accepter explicitement que `resonance_ia` soit un champ d'analyse
et non de report factuel — mais alors lui interdire les faits datés et nommés (« dès 2019 »,
« a commencé à étudier », « publie chaque année ») ; ou lui adjoindre sa propre source.

### T3 — [MINEUR] Recopie de gabarit entre fiches du même lot

- **« part du principe que » ouvre la thèse centrale de 15 des 25 fiches du lot A (60 %)**,
  contre 4 des 30 fiches des lots B et C réunis (13 %). Formule quasi absente ailleurs dans
  le corpus.
- Lot B, gabarit **« date de fondation → réalisations phares → critique budgétaire ou
  d'accès »** appliqué à l'identique sur 8 des 12 fiches : NASA et NIH (budget soumis aux
  aléas politiques), MIT et Caltech (frais de scolarité / diversité sociale du recrutement),
  CERN (coût des grands équipements), Pasteur et EMBL (mode de financement). L'audit du
  07/09 l'avait relevé sur 3 fiches ; il est confirmé sur 8 sur 12.
- Effet de bord de ce gabarit : **le champ `limites_critiques` cesse d'être une critique**.
  `embl` : *« un compromis nécessaire pour atteindre l'échelle critique de moyens que la
  recherche en biologie moléculaire exige »* — la phrase justifie l'institution au lieu de
  la critiquer. `institut-pasteur` et `conseil-de-stabilite-financiere-csf` recourent tous
  deux à l'atténuation « comme d'autres… » qui dilue la critique dans une généralité.
- En revanche, **aucune recopie littérale de `resonance_ia` d'une fiche à l'autre** : la
  similarité lexicale maximale entre deux champs de l'échantillon est de 0,20 (MIT/RIKEN et
  CERN/Fermilab, sur du vocabulaire de domaine partagé, pas des phrases réemployées). Le
  risque de `resonance_ia` interchangeables, redouté par le mégaprompt, **ne s'est pas
  matérialisé**.

### T4 — [MINEUR] Sources primaires sans URL : 13 entrées, toutes dans le lot B (sauf une)

Les 12 fiches d'institutions citent chacune une source `primaire` sans URL, à intitulé
institutionnel (« MIT Charter (1861) », « National Aeronautics and Space Act (1958) »,
« Statuts de la Société Max-Planck (1948) », « History of RIKEN (RIKEN, document
institutionnel) »…). La treizième est `economie-du-donut-kate-raworth` (« Kate Raworth,
*Doughnut Economics* (2017) »). C'est exactement le constat transversal n°2 du 07/09,
inchangé — et il est ici la cause directe de plusieurs findings du lot B : rien ne permet de
distinguer un chiffre lu dans les statuts d'un chiffre écrit de mémoire.

### T5 — [MINEUR] Défaut de forme non détecté par le validateur : `resonance_ia` absent

`npm run valider` sort à 0 erreur et 0 avertissement sur 512 fiches. Il ne détecte pas que
**2 fiches du corpus n'ont aucun champ `resonance_ia`** : `economie-du-donut-kate-raworth`
(dans cet échantillon) et `democratie-liberale`. Sur un projet dont c'est le champ signature,
l'omission mérite une règle. À rapprocher du défaut d'unicité de secteur trouvé
incidemment le 07/09 : le validateur contrôle bien la forme qu'on lui a décrite, et rien de
ce qu'on a oublié de lui décrire.

---

## 5. Les cinq findings bloquants

### B1 — `g7-g8` : les deux sources sont des pages d'homonymie

C'est le piège que le projet redoutait — « OMC » renvoyant vers un groupe de musique — et il
s'est refermé.

- **Sources déclarées** : `primaire` → `https://fr.wikipedia.org/wiki/Groupe_des_sept`,
  `secondaire` → `https://fr.wikipedia.org/wiki/G7`. Ce sont les seules URL de la fiche.
- **Ce que sont réellement ces deux pages** : deux pages de désambiguïsation. `Groupe des
  sept` (585 caractères) liste six entrées : *« un groupe de discussion et de partenariat
  économique de sept pays ; un groupe de peintres canadiens ; un groupe d'activistes
  français anti-indépendantiste secret partisan de l'Algérie française ; un groupe d'artistes
  français nés en Algérie ; organisation intersyndicale regroupant les sept syndicats
  d'enseignement les plus représentatifs au Sénégal ; un groupe d'artistes de Dinan en
  Bretagne »*. `G7` (1 840 caractères) énumère un destroyer canadien (NCSM Athabaskan G07),
  un sous-marin de la Royal Navy, un hiéroglyphe égyptien, les taxis G7, le smartphone
  LG G7 ThinQ, une souris Logitech, un appareil photo Canon PowerShot G7, une voiture de
  course Ford, un BMW X7, l'autoroute chinoise Pékin–Ürümqi, une locomotive à vapeur
  prussienne et un code de la classification internationale des maladies.
- **Citations fautives** (thèse, apport, limites, résonance IA — la fiche entière) :
  *« initialement G6 en 1975, devenu G8 avec la Russie de 1998 à 2014 »*, *« l'exclusion de
  la Russie en 2014 »*, *« sa concurrence croissante avec le G20 et les BRICS »*, *« Le G7 a
  lancé en 2023 le "Processus d'Hiroshima" sur l'IA générative »*. **Aucun** de ces éléments
  — 1975, 1998, 2014, Russie, chocs pétroliers, 2008, Chine, Inde, Brésil, BRICS, 2023,
  Hiroshima — n'apparaît dans l'une ou l'autre des deux pages citées.
- **Gravité** : bloquant. Le sujet entier de la fiche repose sur deux URL qui ne traitent
  d'aucun sujet en particulier. C'est plus grave que le finding `minilateralisme-et-clubs-g7-g20`
  du 07/09, où la source citée était au moins un article de fond hors sujet.
- **Correction proposée** : sourcer sur `fr.wikipedia.org/wiki/Groupe_des_sept_(économie)`
  ou l'article dédié équivalent, plus une source primaire réelle (communiqués finaux des
  sommets, texte du Processus d'Hiroshima publié par le G7). **Et vérifier en priorité les
  35 autres fiches d'organisations internationales dont l'URL a été fabriquée à partir du
  sigle** : c'est le mode de production qui a créé ce finding.

### B2 — `riken` : les travaux de Yamanaka sur les cellules iPS attribués au RIKEN

- **Citation fautive** (`apport`) : *« A hébergé les travaux de Shinya Yamanaka sur les
  cellules souches induites (iPS) »*.
- **Ce que dit réellement la source** (`fr.wikipedia.org/wiki/RIKEN`) : le nom de Yamanaka
  **n'y figure pas une seule fois**. Ce que la source décrit est autre chose : *« Une équipe
  du RIKEN, dirigée par le chercheur Masayo Takahashi, a effectué le 12 septembre 2014 une
  transplantation de cellules de la rétine sur une patiente de 70 ans […] dans la première
  étude clinique du monde, en utilisant des cellules souches pluripotentes induites (CSPi). »*
  Le RIKEN a réalisé la **première application clinique** de cellules iPS, huit ans après
  leur découverte — il n'a pas hébergé les travaux de découverte.
- **Contradiction interne au corpus** : la fiche `shinya-yamanaka` de `evolution.json`
  attribue correctement à Yamanaka le Nobel 2012 partagé avec John Gurdon pour la découverte
  des iPS ; ses travaux ont été menés à l'université de Kyoto. Les deux fiches du même
  corpus se contredisent.
- **Gravité** : bloquant — erreur d'attribution d'une découverte à une institution, de la
  même famille que le finding Jane Goodall du 07/09, et sur un sujet où l'attribution est
  précisément l'enjeu.
- **Correction proposée** : remplacer par « a réalisé en 2014 la première application
  clinique mondiale de cellules iPS (équipe de Masayo Takahashi) », qui est à la fois exact,
  plus intéressant, et littéralement dans la source.

### B3 — Transversal : 54 fiches sans source primaire réelle

Voir T1 ci-dessus.

### B4 — `fermilab` : l'apport et les limites sont intégralement hors-source

- **Citations fautives** (`apport` et `limites_critiques`, soit la totalité des deux champs) :
  *« A découvert le quark top (1995) et le neutrino tau (2000) […] mène aujourd'hui des
  expériences de référence sur les oscillations de neutrinos (DUNE) »* ; *« A perdu son rôle
  de premier plan mondial en physique des très hautes énergies avec l'arrêt de son
  accélérateur Tevatron en 2011 »*. La thèse ajoute *« en particulier des neutrinos et de la
  matière noire »*.
- **Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Fermilab`, 3 894 caractères) :
  ni « quark top », ni « 1995 », ni « neutrino tau », ni « 2000 », ni « DUNE », ni « matière
  noire », ni « 2011 » n'y figurent. Pire, **la source contredit la fiche sur le point
  central** : elle décrit le Tevatron au présent — *« Le Tevatron est aujourd'hui avec ses
  aimants supraconducteurs un des accélérateurs de particules les plus puissants au monde »* —
  et date sa comparaison de « septembre 2008 ». L'article cité est un article obsolète qui
  ignore l'arrêt du Tevatron ; la fiche connaît cet arrêt, donc elle ne l'a pas appris là.
- **Gravité** : bloquant. Deux champs sur trois, plus une partie de la thèse, sont produits
  hors de la source déclarée, sur une fiche dont la source secondaire est par ailleurs
  périmée.
- **Correction proposée** : changer de source secondaire (l'article Wikipédia EN
  « Fermilab » couvre le quark top, le neutrino tau, l'arrêt du Tevatron et DUNE), et ajouter
  une source primaire (communiqués du Fermilab, page DUNE).

### B5 — `ue-cee` : la moitié de la fiche est postérieure au périmètre de la source citée

- **Source déclarée** (primaire et secondaire, même URL — cf. T1) :
  `fr.wikipedia.org/wiki/Communauté_économique_européenne`, article consacré à la CEE, entité
  qui a existé de 1957 à 1993.
- **Citations fautives** : *« un corpus réglementaire influent au niveau mondial (le fameux
  "effet Bruxelles"), notamment en matière de protection des données »* ; *« une monnaie
  commune pour une majorité de ses membres »* ; *« Le déficit démocratique perçu de ses
  institutions […] illustrées par le Brexit en 2020 »* ; *« Le règlement européen sur l'IA
  (AI Act, 2024) […] prolongeant "l'effet Bruxelles" déjà observé avec le RGPD »*.
- **Ce que dit réellement la source** : « effet Bruxelles », « Brexit », « RGPD »,
  « monnaie » et « déficit démocratique » sont **tous absents** de l'article. Seule la thèse
  centrale (CEE 1957, Maastricht 1993, intégration progressive) y est appuyée.
- **Gravité** : bloquant. La fiche s'intitule « UE/CEE » et traite de l'Union européenne
  contemporaine ; sa seule source s'arrête en 1993.
- **Correction proposée** : ajouter `fr.wikipedia.org/wiki/Union_européenne` comme source, et
  une source primaire pour l'AI Act (texte du règlement au Journal officiel de l'UE).

---

## 6. Findings sérieux

Les 20 findings sérieux suivent tous le même schéma — l'énoncé est plausible et le plus
souvent exact dans l'absolu, mais il ne provient pas de la source déclarée. Deux exceptions
notables, signalées comme telles : un chiffre plus élevé que celui de la source (S7) et une
date en désaccord avec la source (S16).

### S1 — `banque-africaine-de-developpement-bafd` : apport, limites et résonance IA hors-source, et une controverse omise
- **Citation fautive** (`apport`) : *« Elle finance des projets d'infrastructure, d'énergie et
  d'intégration régionale à travers le continent africain et constitue, avec la Banque
  mondiale et les banques régionales, l'un des principaux canaux de financement du
  développement en Afrique. »*
- **Ce que dit réellement la source** : « infrastructure », « énergie » et « intégration »
  sont absents de tout l'article. La mission décrite est *« combattre la pauvreté et
  améliorer les conditions de vie […] via la promotion des investissements à capitaux publics
  et privés »*. Et la source **contredit** le cadrage « principal canal » : la part du groupe
  dans les décaissements vers l'Afrique est chiffrée à *« 8,1 % »* en 1992.
- **Autres citations fautives, même fiche** : *« demeure dépendante des contributions des
  pays non-régionaux (Europe, États-Unis, **Chine**) »* — « Chine » est absent, la source
  parle de « 27 pays européens, américains et asiatiques » ; *« La BAfD investit dans les
  infrastructures numériques africaines »* — « numérique » est absent de l'article entier.
- **Neutralité — omission d'une controverse documentée par la source elle-même** :
  `limites_critiques` ignore ce que la source consacre à un rapport de consultation de 1994
  (David Knox) : *« un manque de responsabilité, des querelles au sein du conseil
  d'administration, des accusations de fraude et de corruption, une bureaucratie trop
  lourde »*, la concentration de la moitié des prêts sur sept pays, *« 40 % des projets de la
  banque se sont soldés par un échec »*, et la dégradation de la note par Standard & Poor's
  en 1995. C'est la critique la mieux documentée de la source, et la fiche ne la mentionne
  pas — même mécanisme que le finding Seligman du 07/09.
- **Correction** : reprendre les limites depuis la source, retirer « Chine » et le champ
  `resonance_ia` non sourcé.

### S2 — `nouvelle-banque-de-developpement-nbd` : apport et limites hors-source (l'article cité est une ébauche)
- **Citations fautives** : *« en promouvant un financement moins conditionné politiquement que
  celui des institutions de Bretton Woods »* ; *« Sa capacité de financement reste très
  inférieure à celle de la Banque mondiale, et les sanctions internationales visant la
  Russie […] compliquent son fonctionnement »* ; *« projets d'infrastructure et de
  développement durable »*.
- **Ce que dit réellement la source** (2 797 caractères) : « Bretton », « sanction »,
  « conditionn » et « développement durable » sont absents. L'article se limite à
  l'historique (inauguration 2014 à Fortaleza), à la répartition du capital (Chine 41 Md$,
  Brésil/Russie/Inde 18 Md$, Afrique du Sud 5 Md$) et à la gouvernance. Le seul point de la
  fiche appuyé est « projets d'infrastructure ».
- **Correction** : sourcer les limites, ou les retirer.

### S3 — `ocde` : les trois réalisations citées sont absentes de la source
- **Citation fautive** (`apport`) : *« Elle a standardisé de nombreux indicateurs économiques
  et sociaux comparables entre pays (**PISA** en éducation, comparaisons fiscales), et ses
  travaux sur la fiscalité internationale ont abouti à **l'accord historique de 2021 sur un
  impôt minimum mondial sur les sociétés**. »*
- **Ce que dit réellement la source** : « PISA » et « impôt minimum » sont absents de
  l'article entier. La liste des publications qu'il donne (Economic Outlook, Employment
  Outlook, *Education Outlook*, Main Economic Indicators, Factbook) ne mentionne pas PISA.
  En revanche la thèse (« rôle d'assemblée consultative ») et les limites (recommandations
  non contraignantes) sont, elles, littéralement appuyées.
- **Correction** : sourcer PISA et l'accord de 2021 sur des pages dédiées.

### S4 — `cij` : l'énumération d'arrêts n'est pas dans la source, et un item est contredit
- **Citation fautive** (`apport`) : *« Elle a rendu des arrêts structurants en matière de
  frontières, de **droit de la mer**, d'**immunités étatiques** et, plus récemment, sur des
  accusations de **génocide** ou de violations du droit international humanitaire »*.
- **Ce que dit réellement la source** : « génocide » est absent de tout l'article. Les deux
  autres items sont présents mais dans un sens différent, voire inverse : sur le droit de la
  mer, la source explique que la CIJ **perd** du terrain — *« Le Tribunal international du
  droit de la mer […] empiète directement sur les compétences de la CIJ en matière de
  délimitation maritime »* ; sur les immunités, la seule affaire citée concerne les
  *« privilèges et immunités »* d'un rapporteur de l'ONU (affaire Mazilu), pas des immunités
  étatiques.
- **Correction** : reprendre l'énumération sur les affaires réellement citées par la source,
  ou sourcer les affaires de génocide séparément.

### S5 — `forum-economique-mondial-wef` : rapports et critique hors-source, controverses de la source omises
- **Citations fautives** : *« publie des rapports influents (**risques mondiaux, avenir de
  l'emploi**) »* ; *« Régulièrement critiqué comme un symbole d'entre-soi **élitiste** »*.
- **Ce que dit réellement la source** : « risques mondiaux », « avenir de l'emploi » et
  « élitiste » sont absents. Les critiques que l'article documente réellement sont d'un tout
  autre ordre et **toutes absentes de la fiche** : la démission de Klaus Schwab, *« Schwab est
  accusé par des membres du Forum d'avoir détourné des fonds appartenant à la fondation »*, et
  l'opacité financière relevée par Jürgen Dunsch — *« les rapports financiers du WEF ne sont
  pas très transparents puisque ni les revenus ni les dépenses ne sont ventilés »*.
- **Correction** : remplacer la critique générique par les critiques documentées de la source.

### S6 — `mouvement-des-non-alignes` : la date de fondation ne vient pas de la source
- **Citation fautive** (`these_centrale`) : *« Le Mouvement des non-alignés (né à Bandung en
  1955, **formalisé à Belgrade en 1961**) »*.
- **Ce que dit réellement la source** : ni « Belgrade » ni « 1961 » n'apparaissent. La source
  donne une autre origine : *« La déclaration de Brioni du 19 juillet 1956, proposée par
  Gamal Abdel Nasser, Josip Broz Tito, Soekarno et Jawaharlal Nehru, marque l'origine du
  mouvement »*, Bandung 1955 n'étant qu'*« une étape importante vers la constitution »*.
- **Autres éléments absents** : « désarmement » et « débat Nord-Sud » (`apport`).
- **Note d'honnêteté** : la conférence de Belgrade de 1961 est bien le premier sommet du
  mouvement ; l'erreur est de traçabilité, pas de fait. Mais la source déclarée propose une
  autre date de naissance, et la fiche ne l'a manifestement pas lue.

### S7 — `mit` : nombre de prix Nobel supérieur à celui de la source, et mise en garde de la source supprimée
- **Citation fautive** (`apport`) : *« avec **plus de 100 lauréats du prix Nobel affiliés** »*.
- **Ce que dit réellement la source** : *« Les étudiants du MIT ont été les lauréats de **78
  prix Nobel** parmi 813 lauréats […] ce qui en fait la 5e institution universitaire au niveau
  mondial en matière de prix Nobel. **Cependant, seuls 35 % de ces nobélisés avaient été
  formés au MIT, et seul le quart d'entre eux étaient affiliés au MIT lors de leur
  nobélisation.** »* La fiche annonce donc un chiffre supérieur de 28 % à celui de sa source,
  et supprime la mise en garde que la source prend soin d'ajouter — et qui porte précisément
  sur le mot « affiliés » qu'emploie la fiche.
- **Autres éléments absents de la source, même fiche** : « mens et manus », « Minsky »,
  « McCarthy », « 1959 » (le laboratoire d'IA du MIT), « scolarité » et « aide financière »
  (la totalité de `limites_critiques`).
- **Gravité** : sérieux, avec circonstance aggravante — c'est exactement le finding
  « Laboratoire Cavendish : 30 Nobel au lieu de 29 » du 07/09, en plus large. Le défaut est
  donc **récurrent dans le lot institutions et n'a pas été corrigé**.
- **Correction** : reprendre 78 et restituer la mise en garde, ou sourcer un décompte
  « affiliés » explicite (le MIT en publie un).

### S8 — `caltech` : effectif étudiant en désaccord avec la source, et apport hors-source
- **Citation fautive** (`limites_critiques`) : *« Sa très petite taille (**environ 2 500
  étudiants**) »*.
- **Ce que dit réellement la source** : *« Elle compte près de 500 professeurs et chercheurs
  et de **2 700 étudiants** dans un campus qui accueille aussi le Jet Propulsion Laboratory
  (JPL) de la NASA où travaillent 5 200 personnes. »*
- **Deuxième citation fautive** (`these_centrale`) : *« qui **gère** par ailleurs le Jet
  Propulsion Laboratory de la NASA **responsable de la plupart des missions robotiques
  d'exploration du système solaire** »*. La source dit seulement que le campus « accueille »
  le JPL ; ni la gestion par Caltech ni la part des missions robotiques n'y figurent.
- **Troisième citation fautive** (`apport`) : *« Kip Thorne, colauréat du prix Nobel 2017 pour
  la détection des ondes gravitationnelles […] et en génomique ; ratio de lauréats du prix
  Nobel par rapport à sa taille parmi les plus élevés au monde »* — « Kip Thorne », « 2017 »,
  « ondes gravitationnelles », « génomique » et toute notion de ratio sont absents de la
  source, qui ne cite nommément que Millikan (1923), Gell-Mann et Feynman.

### S9 — `institut-max-planck` : date de fondation contredite et nombre de Nobel absent
- **Citation fautive** (`these_centrale`) : *« La Société Max-Planck (**fondée en 1911 sous le
  nom de Société Kaiser-Wilhelm, renommée en 1948**) »*.
- **Ce que dit réellement la source** : *« Elle a été **créée en 1948** à l'instigation des
  physiciens Werner Heisenberg et Carl Friedrich von Weizsäcker et **succède à** la Société
  Kaiser-Wilhelm. »* « 1911 » n'apparaît pas. La source décrit une succession entre deux
  institutions, la fiche un simple changement de nom — nuance qui n'est pas neutre puisque
  c'est elle qui porte la question du passé nazi.
- **Deuxième citation fautive** (`apport`) : *« **Plus de 30 prix Nobel** attribués à des
  chercheurs de ses instituts »* — le mot « Nobel » **n'apparaît pas une seule fois** dans la
  source (1 572 caractères).
- **Troisième citation fautive** (`limites_critiques`) : *« L'institution a reconnu et
  documenté publiquement le rôle de ses instituts prédécesseurs […] dans des recherches liées
  à l'eugénisme et aux crimes du régime nazi »* — absent de la source, qui ne conserve du
  sujet qu'un lien « Voir aussi » vers « Fritz Haber » et « Arme chimique ».
- **Note** : le fait est réel et documenté par la Société Max-Planck elle-même (programme de
  recherche historique lancé en 1997). Le problème est que la source citée est un article
  squelettique qui ne porte rien de ce que la fiche affirme. « 84 instituts » (février 2025)
  est en revanche bien dans la source et cohérent avec le « plus de 80 » de la fiche.

### S10 — `embl` : la totalité de l'apport et de la résonance IA est hors-source
- **Citation fautive** (`apport`) : *« Héberge l'un des plus importants centres mondiaux de
  bio-informatique (**EMBL-EBI**), qui gère des bases de données biologiques publiques de
  référence mondiale (dont **UniProt** et les données structurales utilisées pour entraîner
  **AlphaFold**). »*
- **Ce que dit réellement la source** : « EBI », « UniProt » et « AlphaFold » sont absents ;
  l'Institut européen de bio-informatique n'apparaît que comme lien « Article connexe ». Ce
  que la source dit de l'EMBL est autre : 24 pays membres, six sites, siège à Heidelberg, et
  *« la quatrième place mondiale (première en Europe) »* dans le classement Thomson Reuters
  des citations en biologie moléculaire et génétique (1999-2009) — un fait précis et
  vérifiable que la fiche n'utilise pas.
- **Neutralité** : `limites_critiques` ne critique pas, il justifie (« un compromis nécessaire
  pour atteindre l'échelle critique de moyens ») — cf. T3.

### S11 — `universite-de-stanford` : trois faits de l'apport et de la résonance IA hors-source
- **Citations fautives** : *« son laboratoire d'intelligence artificielle (SAIL, **fondé en
  1963**) »* ; *« Google, dont le moteur de recherche est **issu d'une thèse Stanford** »* ;
  *« Le **Stanford Institute for Human-Centered AI (HAI)** publie chaque année […] l'**AI
  Index** »*.
- **Ce que dit réellement la source** : « 1963 », « thèse », « HAI » et « AI Index » sont
  absents ; la seule occurrence apparente de « HAI » dans le texte est le mot « Shang**hai** »
  du classement. La source dit de Google : *« Google, 1998, cofondateurs Larry Page (M.S.) et
  Sergey Brin (M.S.) »*.
- **Note** : « SAIL » et « Silicon Valley » sont, eux, bien présents.

### S12 — `autoritarisme-electif` : l'URL redirige vers un autre article, et les auteurs cités n'y figurent pas
- **Source déclarée** : `https://en.wikipedia.org/wiki/Competitive_authoritarianism` — cette
  page **redirige aujourd'hui vers l'article « Hybrid regime »**, de périmètre bien plus large.
- **Citation fautive** (`apport`) : *« Ce concept, développé notamment par les politologues
  **Steven Levitsky et Lucan Way** »*.
- **Ce que dit réellement la source** : « Levitsky » est absent de l'article ; les seules
  occurrences de « Way » sont le mot anglais courant (*« votes the same way »*). La notion de
  *« gray zone »* et les traits descriptifs de la fiche sont, eux, présents.
- **Correction** : citer directement Levitsky & Way (*Competitive Authoritarianism: Hybrid
  Regimes After the Cold War*, 2010) comme source primaire, et stabiliser l'URL secondaire.

### S13 — `national-populisme` : les limites sont hors-source et confondent le concept et son objet
- **Citation fautive** (`limites_critiques`) : *« Le concept est critiqué pour sa rhétorique
  parfois xénophobe et sa tendance à la personnalisation excessive du pouvoir, ainsi que pour
  son caractère englobant… »*
- **Ce que dit réellement la source** : « xénophob » est absent. Surtout, ce que la fiche
  présente comme des critiques *du concept* sont, dans la source, des traits *descriptifs des
  mouvements* : selon Christophe Jaffrelot, *« la défense des hindous face aux minorités
  intérieures et aux puissances étrangères, rejet des élites et concentration du pouvoir sont
  les principales expressions du "national-populisme" exercé par […] Narendra Modi »*.
  Reprocher à un concept d'analyse d'avoir « une rhétorique xénophobe » est une confusion de
  niveau, et elle affaiblit la neutralité dans les deux sens à la fois.
- **Omission** : la source attribue le concept à Gino Germani (années 1970, péronisme) puis à
  Pierre-André Taguieff, et sa diffusion internationale à Goodwin et Eatwell (2018). La fiche
  ne nomme aucun de ces auteurs alors qu'ils occupent la moitié de l'article.

### S14 — `populisme-de-gauche` : la cause avancée est hors-source, et les théoriciens de la source sont omis
- **Citation fautive** (`apport`) : *« Ce courant a permis l'émergence de nouvelles forces
  politiques **en réaction aux politiques d'austérité et aux inégalités croissantes** dans
  plusieurs démocraties occidentales **depuis la crise financière de 2008** »* ;
  (`limites_critiques`) *« Sa dépendance à un **leadership charismatique** »*.
- **Ce que dit réellement la source** : « austérité », « inégalité » et « charismatique » sont
  absents. La source date l'émergence européenne *« au milieu des années 2010 »* et n'avance
  aucune causalité. Elle consacre en revanche une section entière à ce que la fiche ignore :
  *« Le populisme de gauche est théorisé par les politologues **Ernesto Laclau et Chantal
  Mouffe** »*, dont elle discute la logique de *« dichotomisation de l'espace social »* et le
  reflux électoral de 2019.

### S15 — `joseph-schumpeter` : la totalité des limites critiques est hors-source
- **Citation fautive** (`limites_critiques`) : *« Schumpeter lui-même prédisait […] que le
  capitalisme finirait par **s'autodétruire par sa propre bureaucratisation et la
  routinisation de l'innovation** au sein de grandes entreprises »*.
- **Ce que dit réellement la source** : « autodétruire », « bureaucratisation » et
  « routinisation » sont absents. L'article mentionne bien *« Capitalisme, Socialisme et
  Démocratie (1942) qui lui vaudra une réputation d'économiste "hérétique" »* mais n'expose
  jamais la thèse. La destruction créatrice, l'entrepreneur et les cycles sont, eux, largement
  couverts.
- **Note d'honnêteté** : la thèse attribuée à Schumpeter est exacte. C'est un cas manuel de
  l'enseignement n°1 du 07/09 : juste sur le fond, non traçable à la source déclarée.

### S16 — `institut-pasteur` : date de fondation en désaccord avec la source, et un chiffre absent
- **Citation fautive** (`these_centrale`) : *« L'Institut Pasteur (fondation privée à but non
  lucratif **fondée en 1887** à Paris par Louis Pasteur) »*.
- **Ce que dit réellement la source** : *« **Créé en 1888** grâce à une souscription publique
  internationale »* — et non par Pasteur seul ni sur fonds privés au sens de la fiche. L'année
  1885 y désigne le premier vaccin contre la rage. La source primaire déclarée (« Statuts
  fondateurs de l'Institut Pasteur (1887) ») n'a pas d'URL et ne peut pas arbitrer.
- **Deuxième citation fautive** (`apport`) : *« réseau international de **plus de 30 instituts
  Pasteur** dans le monde »* — la source mentionne le « Réseau international des instituts
  Pasteur » comme lien connexe, sans aucun décompte.
- **Point positif** : la découverte du VIH (Montagnier, Barré-Sinoussi, Nobel 2008) est
  littéralement dans la source, y compris l'année 1983.

### S17 — `nih` : l'apport et les limites sont hors-source
- **Citations fautives** : *« dont le **séquençage du génome humain** (Human Genome Project) et
  le développement accéléré des **vaccins à ARNm** »* ; *« tensions récurrentes sur le
  financement de certains domaines (**recherche sur les cellules souches embryonnaires**,
  santé reproductive) »*.
- **Ce que dit réellement la source** : « génome humain », « ARNm » et « cellules souches »
  sont absents. La fondation en 1887 et les « 27 instituts et centres spécialisés » (chiffre
  daté de 2012 dans la source) sont en revanche exacts.

### S18 — `conseil-de-stabilite-financiere-csf` : les deux exemples de l'apport sont hors-source
- **Citation fautive** (`apport`) : *« coordonne les réformes de régulation bancaire et
  financière (**normes de fonds propres, encadrement des institutions « too big to fail »**) »*.
- **Ce que dit réellement la source** (article EN) : « too big to fail » et « capital
  requirement » sont absents. Tout le reste de la fiche est en revanche très bien appuyé —
  sommet du G20 de Pittsburgh 2009, succession au Financial Stability Forum, hébergement et
  financement par la Banque des règlements internationaux à Bâle, absence de base
  conventionnelle : *« the FSB lacks a treaty basis and formal power »*. C'est une bonne fiche
  avec deux exemples ajoutés de mémoire.

### S19 — `socialisme-du-xxie-siecle` : la substance économique de l'apport et des limites est hors-source
- **Citations fautives** : *« politiques de redistribution des richesses tirées des ressources
  naturelles (**pétrole, gaz**) »* ; *« certains régimes s'en réclamant (Venezuela) ont **dérivé
  vers l'autoritarisme** »*.
- **Ce que dit réellement la source** : « pétrole », « matières premières » et « autoritar »
  sont absents. Dieterich, Chávez, Correa, Morales et le Venezuela sont bien présents.
- **Neutralité** : « dérivé vers l'autoritarisme » est un jugement politique fort, non attribué
  et non sourcé.

### S20 — Transversal : `resonance_ia` hors-source sur 37 fiches sur 37 des lots A et B
Voir T2.

---

## 7. Findings mineurs (20)

| # | Fiche | Citation fautive (extrait) | Ce que dit la source |
|---|---|---|---|
| M1 | `conseil-de-l-europe` | « mécanisme de **recours individuel** unique en son genre […] sur des sujets sensibles (**peine de mort**, discriminations, **vie privée**) » | ces trois expressions sont absentes ; la CEDH, la Cour, Strasbourg, les 46 États et l'exclusion de la Russie le 16 mars 2022 sont, eux, littéralement confirmés |
| M2 | `osce` | « impuissante face à l'annexion de la **Crimée en 2014** puis à l'invasion de l'Ukraine en **2022** » | « Crimée » et « 2022 » absents ; la source documente la mission d'observation en Ukraine et le Groupe de contact trilatéral |
| M3 | `otan` | « pendant plus de **75 ans** » ; « dépendante du **financement américain** » ; « **standardisation** des équipements » | les trois expressions sont absentes ; l'article 5, l'élargissement, la Finlande et la Suède sont confirmés |
| M4 | `fmi` | « la **crise grecque** des années 2010 » | absent ; dette latino-américaine, crise asiatique 1997, 191 pays, ajustement structurel et austérité sont confirmés |
| M5 | `cptpp` | « entre **onze** pays » ; « Le **retrait** américain dès 2017 » | la source dit « ces 11 pays » et « sans les États-Unis » — équivalence de fond, écart littéral |
| M6 | `gatt` | « À travers **huit cycles** de négociations » | le décompte n'est pas donné comme tel ; les cycles sont énumérés un à un (Genève 1947, Annecy 1949, Torquay 1951, Kennedy, Tokyo, Uruguay…) |
| M7 | `onu` | « critiquée pour sa **lourdeur bureaucratique**, son **sous-financement chronique** » | « bureaucrat » absent ; critique non attribuée |
| M8 | `pacte-de-varsovie` | « l'alliance **n'a jamais fonctionné sur une base d'adhésion volontaire réelle** » | jugement non attribué et non appuyé littéralement ; Hongrie 1956, Tchécoslovaquie 1968 et la dissolution de 1991 sont confirmés |
| M9 | `banque-asiatique-...-baii` | « **diplomatie de la dette** » ; « la plus grande part de capital et de **droits de vote** » | expressions absentes ; la route de la soie et la concurrence avec le FMI, la Banque mondiale et la BAsD sont confirmées |
| M10 | `organisation-de-cooperation-de-shanghai-ocs` | résonance IA : « la Chine promeut ses standards technologiques et ses solutions d'IA » | hors-source ; les 43 % de la population mondiale et la coopération antiterroriste sont confirmés |
| M11 | `cern` | « des **milliards d'euros** » | la seule occurrence de « milliard » dans la source porte sur des électronvolts ; 1954, le boson de Higgs (2012), le Web et Berners-Lee (1989) sont confirmés |
| M12 | `croissance-de-solow-swan` | « a valu à Robert Solow le prix **Nobel** d'économie en **1987** » ; « a directement motivé […] les modèles de **croissance endogène** » | « Nobel », « 1987 » et « croissance endogène » sont absents de l'article « Modèle de Solow » |
| M13 | `croissance-endogene-romer-lucas` | « l'investissement en recherche et développement, en **éducation** » | « éducation » absent ; Romer, Lucas, capital humain et R&D sont confirmés |
| M14 | `democratie-chretienne` | « s'est progressivement affaibli avec la **sécularisation** des sociétés » | absent ; Adenauer, De Gasperi, Schuman, doctrine sociale et Amérique du Sud sont confirmés |
| M15 | `fascisme` | « ce dernier ayant radicalisé la violence jusqu'au **génocide** » | « génocide » absent de l'article « Fascisme » ; Mussolini, totalitarisme, culte du chef, Lumières et opportunisme sont confirmés |
| M16 | `theorie-moderne-de-la-monnaie-mmt` | « politiques publiques ambitieuses (**transition écologique**, protection sociale) » | absent ; la critique de la Banque de France et le risque d'inflation sont confirmés |
| M17 | `economie-du-donut-kate-raworth` | « un **plancher social** » | la source emploie une autre formulation ; « plafond écologique », « limites planétaires », « PIB » et Amsterdam sont confirmés |
| M18 | `economie-du-donut-kate-raworth` | champ `resonance_ia` **absent** ; quatre champs réduits à une phrase | densité notée 2/5 — voir T5 |
| M19 | Transversal | « part du principe que » ouvre 15 des 25 thèses centrales du lot A | voir T3 |
| M20 | Transversal | 13 entrées `primaire` sans URL (12 institutions + Doughnut Economics) | voir T4 |

---

## 8. Tableau de notation des 55 fiches

*(1 = très faible, 5 = excellent. « Fid. » ne porte que sur ce qui était vérifiable.)*

### Lot A — organisations internationales de `social_2.json` (25)

| Fiche | Fid. | Neu. | Den. | Uti. | Findings | Statut |
|---|:--:|:--:|:--:|:--:|---|---|
| `g7-g8` | **1** | 4 | 4 | 3 | B1 | **à reprendre (bloquant)** |
| `ue-cee` | **1** | 4 | 4 | 4 | B5 | **à reprendre (bloquant)** |
| `nouvelle-banque-de-developpement-nbd` | **1** | 4 | 3 | 3 | S2 | **à reprendre** |
| `banque-africaine-de-developpement-bafd` | 2 | 3 | 4 | 3 | S1 | **à reprendre** |
| `cij` | 2 | 4 | 4 | 4 | S4 | **à reprendre** |
| `forum-economique-mondial-wef` | 2 | 3 | 4 | 3 | S5 | **à reprendre** |
| `mouvement-des-non-alignes` | 2 | 4 | 4 | 4 | S6 | **à reprendre** |
| `ocde` | 2 | 4 | 4 | 4 | S3 | **à reprendre** |
| `banque-asiatique-...-baii` | 3 | 4 | 4 | 4 | M9 | OK avec réserve |
| `conseil-de-l-europe` | 3 | 4 | 4 | 4 | M1 | OK avec réserve |
| `conseil-de-stabilite-financiere-csf` | 3 | 4 | 4 | 4 | S18 | OK avec réserve |
| `osce` | 3 | 4 | 4 | 4 | M2 | OK avec réserve |
| `otan` | 3 | 4 | 4 | 4 | M3 | OK avec réserve |
| `cour-penale-internationale-cpi` | 4 | 4 | 4 | 4 | T1 seul | OK avec réserve |
| `cptpp` | 4 | 4 | 4 | 4 | M5 | OK avec réserve |
| `fmi` | 4 | 4 | 4 | 4 | M4 | OK avec réserve |
| `g20` | 4 | 4 | 4 | 4 | T1, T2 | OK avec réserve |
| `gatt` | 4 | 4 | 4 | 4 | M6 | OK avec réserve |
| `oea` | 4 | 4 | 4 | 4 | T1, T2 | OK avec réserve |
| `onu` | 4 | 4 | 4 | 5 | M7 | OK avec réserve |
| `opep` | 4 | 4 | 4 | 4 | T1, T2 | OK avec réserve |
| `organisation-de-cooperation-de-shanghai-ocs` | 4 | 4 | 4 | 4 | M10 | OK avec réserve |
| `pacte-de-varsovie` | 4 | 3 | 4 | 4 | M8 | OK avec réserve |
| `ligue-arabe` | **5** | 4 | 4 | 4 | aucun (hors T1) | **fiche saine** |
| `sdn` | **5** | 4 | 4 | 4 | aucun (hors T1) | **fiche saine** |
| **Moyenne lot A** | **3,12** | **3,88** | **3,96** | **3,88** | | **8/25 à reprendre** |

### Lot B — institutions de recherche de `evolution.json` (12)

| Fiche | Fid. | Neu. | Den. | Uti. | Findings | Statut |
|---|:--:|:--:|:--:|:--:|---|---|
| `riken` | **1** | 4 | 4 | 3 | B2 | **à reprendre (bloquant)** |
| `fermilab` | **1** | 4 | 4 | 3 | B4 | **à reprendre (bloquant)** |
| `caltech` | 2 | 4 | 4 | 3 | S8 | **à reprendre** |
| `embl` | 2 | 3 | 4 | 3 | S10, T3 | **à reprendre** |
| `institut-max-planck` | 2 | 4 | 4 | 3 | S9 | **à reprendre** |
| `mit` | 2 | 3 | 4 | 4 | S7 | **à reprendre** |
| `universite-de-stanford` | 2 | 4 | 4 | 4 | S11 | **à reprendre** |
| `institut-pasteur` | 3 | 4 | 4 | 4 | S16 | OK avec réserve |
| `nih` | 3 | 4 | 4 | 4 | S17 | OK avec réserve |
| `cern` | 4 | 4 | 4 | 4 | M11 | OK avec réserve |
| `giec-ipcc` | **5** | 4 | 4 | 5 | T2, T4 seuls | **fiche saine** |
| `nasa` | **5** | 4 | 4 | 4 | T2, T4 seuls | **fiche saine** |
| **Moyenne lot B** | **2,67** | **3,83** | **4,00** | **3,67** | | **7/12 à reprendre** |

### Lot C — `social_1.json`, tiré au sort (18) — groupe de contrôle

| Fiche | Fid. | Neu. | Den. | Uti. | Findings | Statut |
|---|:--:|:--:|:--:|:--:|---|---|
| `autoritarisme-electif` | 2 | 4 | 4 | 4 | S12 | **à reprendre** |
| `national-populisme` | 2 | 3 | 4 | 3 | S13 | **à reprendre** |
| `populisme-de-gauche` | 2 | 4 | 4 | 3 | S14 | **à reprendre** |
| `economie-du-donut-kate-raworth` | 4 | 4 | **2** | 3 | M17, M18 | **à reprendre (forme)** |
| `croissance-de-solow-swan` | 3 | 4 | 4 | 4 | M12 | OK avec réserve |
| `joseph-schumpeter` | 3 | 4 | 4 | 4 | S15 | OK avec réserve |
| `socialisme-du-xxie-siecle` | 3 | 3 | 4 | 4 | S19 | OK avec réserve |
| `croissance-endogene-romer-lucas` | 4 | 4 | 4 | 4 | M13 | OK avec réserve |
| `democratie-chretienne` | 4 | 4 | 4 | 4 | M14 | OK avec réserve |
| `fascisme` | 4 | 4 | 4 | 4 | M15 | OK avec réserve |
| `monarchie-constitutionnelle` | 4 | 4 | 4 | 4 | aucun | OK |
| `regime-parlementaire` | 4 | 4 | 4 | 4 | aucun | OK |
| `theorie-moderne-de-la-monnaie-mmt` | 4 | 4 | 4 | 4 | M16 | OK avec réserve |
| `communisme` | **5** | 4 | 4 | 4 | aucun | **fiche saine** |
| `eco-socialisme` | **5** | 4 | 4 | 4 | aucun | **fiche saine** |
| `junte` | **5** | 4 | 4 | 4 | aucun | **fiche saine** |
| `technocratie` | **5** | 4 | 4 | 4 | aucun | **fiche saine** |
| `thomas-piketty` | **5** | 4 | 4 | 5 | aucun | **fiche saine** |
| **Moyenne lot C** | **3,78** | **3,89** | **3,89** | **3,89** | | **4/18 à reprendre** |

---

## 9. Fiches et sources non vérifiables

**Aucune fiche n'est invérifiable pour cause d'accès.** Aucun domaine n'a été bloqué par le
proxy ; les 56 URL distinctes ont toutes répondu. La seule difficulté rencontrée, la
limitation de débit de l'API MediaWiki, a été résolue par étalement des requêtes puis par
`WebFetch` pour `fr.wikipedia.org/wiki/Technocratie`.

Sont en revanche **structurellement invérifiables** les 13 entrées de source `primaire` sans
URL (cf. T4). Deux cas particuliers méritent d'être notés :

| Cas | Raison |
|---|---|
| `g7-g8` (2 URL) | les deux pages répondent, mais ce sont des pages d'homonymie : **rien de la fiche n'est vérifiable sur ses propres sources** (finding B1) |
| `autoritarisme-electif` | l'URL déclarée redirige vers un autre article (« Hybrid regime ») : la source vérifiée n'est plus celle qui a été citée (finding S12) |

Les 24 fiches du lot A affectées par T1 sont vérifiables sur leur source secondaire, mais
**non vérifiables sur leur source primaire, qui n'existe pas**.

---

## 10. Comparaison explicite avec l'audit du 07/09

| | Fidélité | Neutralité | Densité | Utilité | À reprendre |
|---|:--:|:--:|:--:|:--:|:--:|
| **07/09 — ensemble (69 fiches)** | 3,37 | 4,02 | 3,94 | 3,88 | ≈ 45 % |
| 07/09 — social (15) | 3,20 | 4,10 | 4,00 | 3,90 | 53 % |
| 07/09 — évolution (15) | 3,27 | 4,40 | 3,87 | 3,73 | 67 % |
| 07/09 — philosophique (15) | 3,87 | 3,80 | 3,93 | 4,07 | 33 % |
| 07/09 — IA (15) | 3,10 | 4,00 | 3,90 | 3,70 | 29 % |
| | | | | | |
| **07/09 — ce rapport, ensemble (55)** | **3,24** | **3,87** | **3,95** | **3,84** | **35 %** |
| **Lot C — tiré au sort (témoin)** | **3,78** | 3,89 | 3,89 | 3,89 | **22 %** |
| Lot A — organisations internationales | 3,12 | 3,88 | 3,96 | 3,88 | 32 % |
| **Lot B — institutions de recherche** | **2,67** | 3,83 | 4,00 | 3,67 | **58 %** |

**Ce que la comparaison établit :**

1. **L'enseignement central du 07/09 est confirmé, et amplifié sur les lots rapides.** La
   neutralité reste stable partout (3,83–3,89, contre 4,02 le 07/09) ; la fidélité seule
   décroche, et elle décroche d'autant plus que le lot a été produit vite. Sur les 45
   findings de ce rapport, **38 sont des findings de traçabilité** — un fait exact mais absent
   de la source déclarée — et seulement 7 des erreurs de fait au sens strict (B2, S7, S8, S9,
   S16, et les deux contradictions de source de S4 et B4).
2. **Les lots rapides sont mesurablement plus fautifs, mais pas de façon uniforme.** Le lot
   d'institutions perd 1,11 point de fidélité sur le témoin (−29 %) ; le lot d'organisations
   internationales n'en perd que 0,66 (−17 %). Et à l'intérieur du lot A, la dispersion est
   forte : deux fiches à 5/5 (Ligue arabe, SDN) coexistent avec trois fiches à 1/5.
3. **Le taux de reprise global s'améliore : 35 % contre 45 % le 07/09.** Il faut le lire avec
   prudence — les échantillons ne sont pas comparables terme à terme — mais il ne va pas dans
   le sens d'une dégradation générale du corpus.
4. **Deux défauts identifiés le 07/09 se retrouvent inchangés dans les lots non encore
   audités** : le chiffre de prix Nobel supérieur à celui de la source (Cavendish → MIT,
   Max-Planck) et les sources primaires sans URL (100 % du lot institutions). Ils n'ont pas
   été corrigés parce que la première vague ne les avait relevés que sur trois fiches.
5. **Un défaut nouveau, plus large que tout ce que le 07/09 avait vu** : le doublon
   primaire/secondaire sur 54 fiches (20 % du corpus humain), invisible du validateur et
   parfaitement corrélé au fichier `social_2.json`.

**Réponse en une phrase** : oui, les lots produits vite sont réellement plus fautifs — de
0,66 point de fidélité pour les organisations internationales et de **1,11 point (−29 %) pour
les institutions de recherche** par rapport à un tirage au sort dans le même corpus — mais
uniquement sur la fidélité à la source ; leur neutralité, leur densité et leur utilité sont
indiscernables de celles du reste du corpus.

---

## 11. Ce qu'il faut en faire

Par ordre de priorité :

1. **Traiter les 5 bloquants** — `g7-g8`, `riken`, `fermilab`, `ue-cee`, et le doublon
   primaire/secondaire sur 54 fiches.
2. **Vérifier les 35 autres fiches d'organisations internationales dont l'URL a été fabriquée
   à partir du sigle.** Le finding `g7-g8` n'est pas un accident isolé : c'est le mode de
   production qui l'a créé : les cas `omc` (renvoyant vers un groupe de musique) et `junte`
   (vers une chanteuse), déjà documentés et depuis corrigés — `junte` pointe aujourd'hui
   correctement vers « Junte militaire » —, relèvent du même mécanisme.
3. **Reprendre les 19 fiches marquées « à reprendre »**, en commençant par le lot B, le plus
   dégradé.
4. **Deux règles à ajouter au validateur** : refus de deux entrées de sources de types
   différents pointant la même URL ; `resonance_ia` obligatoire (2 fiches manquantes dans le
   corpus).
5. **Une règle de méthode, en complément de celle proposée le 07/09** (URL par entrée de
   source) : **vérifier qu'une URL de source n'est pas une page d'homonymie ni une
   redirection** avant de l'enregistrer. Un contrôle automatisé est possible — l'API
   MediaWiki signale les deux — et il aurait détecté B1 et S12 sans intervention humaine.

---

## Annexe A — les 55 identifiants de l'échantillon

**Lot A (25)** — `banque-africaine-de-developpement-bafd`,
`banque-asiatique-d-investissement-pour-les-infrastructures-baii`, `cij`,
`conseil-de-l-europe`, `conseil-de-stabilite-financiere-csf`, `cour-penale-internationale-cpi`,
`cptpp`, `fmi`, `forum-economique-mondial-wef`, `g20`, `g7-g8`, `gatt`, `ligue-arabe`,
`mouvement-des-non-alignes`, `nouvelle-banque-de-developpement-nbd`, `ocde`, `oea`, `onu`,
`opep`, `organisation-de-cooperation-de-shanghai-ocs`, `osce`, `otan`, `pacte-de-varsovie`,
`sdn`, `ue-cee`.

**Lot B (12)** — `caltech`, `cern`, `embl`, `fermilab`, `giec-ipcc`, `institut-max-planck`,
`institut-pasteur`, `mit`, `nasa`, `nih`, `riken`, `universite-de-stanford`.

**Lot C (18)** — `autoritarisme-electif`, `communisme`, `croissance-de-solow-swan`,
`croissance-endogene-romer-lucas`, `democratie-chretienne`, `eco-socialisme`,
`economie-du-donut-kate-raworth`, `fascisme`, `joseph-schumpeter`, `junte`,
`monarchie-constitutionnelle`, `national-populisme`, `populisme-de-gauche`,
`regime-parlementaire`, `socialisme-du-xxie-siecle`, `technocratie`,
`theorie-moderne-de-la-monnaie-mmt`, `thomas-piketty`.

**Exclues comme déjà auditées le 07/09** (dans le périmètre visé) : `esa`,
`laboratoire-cavendish`, `cnrs` (lot B) ; `union-africaine-ua-oua`, `asean`,
`minilateralisme-et-clubs-g7-g20`, `bipolarite-guerre-froide`, `modele-des-7s-mckinsey`,
`james-a-robinson` (`social_2.json`) ; `social-democratie`, `monarchie-absolue`,
`neoliberalisme-etatique`, `economie-de-marche-regulee-social-democratie`,
`economie-planifiee-modele-sovietique`, `gerard-debreu`, `gary-becker`, `paul-samuelson`,
`amartya-sen` (`social_1.json`).

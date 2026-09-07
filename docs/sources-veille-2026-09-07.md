# Extension des sources de veille — 07/09/2026

_Objet : porter le référentiel de veille au-delà des seules sources techniques et institutionnelles
en ajoutant trois axes demandés par Julien — **actualité, économie, marchés** — et rendre compte
honnêtement de ce qui a été testé, retenu, ou écarté._

Avant ce lot, `data/seed/veille_sources.json` comptait **8 entrées** : deux flux arXiv, le blog
OpenAI, Nature, trois recherches Google News (Anthropic, FMI, OCDE) et une entrée Spiderfoot sans
URL. Après ce lot : **26 entrées, 25 flux RSS actifs**.

---

## 1. Comment les flux ont été choisis

Le critère décisif n'est pas la notoriété de l'éditeur mais **le domaine que portent les liens des
articles**. Depuis la refonte du 07/09/2026 de `scripts/veille-rss.mjs`, le score de fiabilité d'une
proposition est calculé sur l'hôte de SON url — pas sur le nom du flux qui l'a apportée. Un flux dont
les items pointent vers `news.google.com/rss/articles/CBMi…` produit donc des propositions à **0,15**
avec un drapeau `domaine_opaque`, quelle que soit la qualité réelle de l'article derrière.

Chaque candidat a été récupéré avec `rss-parser` — le même client que le script de collecte, pas
`curl` sur la page d'accueil — et retenu seulement si les quatre conditions étaient réunies :

1. le flux répond et rend du **XML effectivement parsable** (plusieurs candidats répondent 200 avec
   du HTML, ou du XML mal formé qui fait échouer le parseur) ;
2. il contient des **items datés récents** ;
3. les liens des items sont **sur le domaine de l'éditeur**, pas derrière un redirecteur ;
4. l'éditeur est identifiable et engage une responsabilité — rédaction, institution, banque centrale,
   institut de recherche.

S'y ajoute un critère de composition : **ne pas empiler quinze rédactions anglophones américaines**.
La liste retenue compte 6 institutions publiques ou banques centrales (zone euro, Royaume-Uni,
États-Unis, Canada, BRI, Commission européenne), 2 instituts de recherche (NBER, Bruegel), 1
organisme public français (France Stratégie), 5 rédactions francophones ou européennes
(Le Monde, La Tribune, RFI, Euronews, Deutsche Welle) et 3 anglophones (FT, WSJ, Guardian).

---

## 2. Sources retenues, et rendement au premier passage

Rendement mesuré au premier `node scripts/veille-rss.mjs` du 07/09/2026. Le script ne retient que
**les 5 premiers items non déjà vus** de chaque flux : « 5 retenus » est donc le plafond, pas une
mesure de la richesse du flux — la colonne « items vus » dit la profondeur réellement disponible.

### 2.1 Économie et institutions (domaine `economie`) — 10 nouvelles sources

| id | items vus | retenus | score | ce qu'elle apporte |
|---|---|---|---|---|
| `bce-communiques` | 15 | 5 | **0,80** | Communiqués et discours de la BCE. `ecb.europa.eu` relève de `europa.eu` dans la table : c'est, avec la Commission, la seule source ajoutée qui atteint le seuil de source primaire sans arbitrage humain. Décisions de taux, projections macroéconomiques. |
| `commission-europeenne-presse` | 20 | 5 | **0,80** | Press corner de la Commission, en français. Réglementation — dont l'AI Act —, chiffres d'exécution des programmes, procédures. Flux très actif (items du jour même). |
| `bri-communiques` | 10 | 5 | 0,40 | Banque des règlements internationaux : rapport trimestriel, statistiques bancaires internationales. Cadence faible et assumée (item le plus récent : 28/06/2026), mais de la donnée consolidée que personne d'autre ne publie. |
| `bri-discours-banques-centrales` | 50 | 5 | 0,40 | Agrégation par la BRI des discours de toutes les banques centrales membres. La source la plus dense de la liste pour suivre la doctrine monétaire hors zone euro. |
| `fed-communiques` | 20 | 5 | 0,40 | Réserve fédérale : décisions du FOMC, mesures prudentielles, publications statistiques. |
| `banque-angleterre-actualites` | 50 | 5 | 0,40 | Banque d'Angleterre. Profondeur d'archive utile (50 items), cadence moyenne. |
| `banque-canada-communiques` | 10 | 5 | 0,40 | Banque du Canada — retenue pour sortir du couple BCE/Fed : une petite économie ouverte, et une institution qui publie largement en français. |
| `nber-documents-travail` | 34 | 5 | 0,40 | NBER : principale source de recherche économique quantitative en accès libre, notamment sur l'effet de l'IA sur l'emploi et la productivité. **Réserve** : les items ne portent aucune date, le champ `date` des propositions est `null` — il faut dater à la revue en ouvrant le lien. |
| `bruegel-publications` | 10 | 5 | 0,40 | Institut de recherche économique bruxellois. **Réserve** : think tank financé par des États membres et des entreprises — le score de 0,40 est cohérent avec cette réserve, à traiter comme une analyse partie prenante et non comme une institution neutre. |
| `france-strategie` | 10 | 5 | 0,40 | Haut-commissariat à la stratégie et au plan. Seule source francophone d'analyse économique publique retenue — la Banque de France et l'INSEE ont toutes deux échoué (§3). Le flux est servi depuis `strategie.gouv.fr` mais ses liens pointent sur `strategie-plan.gouv.fr` (renommage de l'organisme). |

### 2.2 Marchés (domaine `marches`) — 2 nouvelles sources

| id | items vus | retenus | score | ce qu'elle apporte |
|---|---|---|---|---|
| `ft-marches` | 25 | 5 | 0,40 | Financial Times, section Marchés. Palier presse explicite (`ft.com` est dans la table). |
| `wsj-marches` | 60 | 5 | 0,40 | Wall Street Journal, section Marchés. Le flux est servi par `feeds.content.dowjones.io` mais **les liens sont sur `wsj.com`** : ce n'est donc pas un redirecteur opaque au sens du script, et les propositions sont bien scorées au palier presse. |

**Réserve commune** : les deux titres sont payants. Une proposition issue de ces flux vaut comme
signal daté ; la vérification du chiffre devra remonter à la source primaire citée dans l'article.

### 2.3 Actualité (domaine `actualite`) — 6 nouvelles sources

| id | items vus | retenus | score | ce qu'elle apporte |
|---|---|---|---|---|
| `le-monde-economie` | 20 | 5 | 0,40 | Le Monde, section Économie, flux `rss_full` : le résumé est complet, ce qui accélère nettement le tri en file par rapport à un flux tronqué. |
| `la-tribune-actualites` | 20 | 5 | 0,40 | La Tribune. Couverture des entreprises et de l'industrie françaises, peu présente ailleurs dans la liste. Les liens sortent aussi sur des sous-domaines éditoriaux (`air-cosmos.latribune.fr`), correctement reconnus comme suffixe. |
| `rfi-economie` | 30 | 5 | 0,40 | RFI Économie. Retenue pour la couverture des économies africaines et des pays du Sud, absente de tous les autres flux. |
| `euronews-business` | 50 | 5 | 0,40 | Euronews Business en français : angle européen non franco-français. |
| `dw-business` | 20 | 5 | 0,40 | Deutsche Welle Business. Radiodiffuseur public allemand : le point de vue de la première économie de la zone euro sur l'industrie et l'énergie. Flux servi par `rss.dw.com`, liens sur `dw.com`. |
| `guardian-economie` | 20 | 5 | 0,40 | The Guardian, section Economics. Contrepoint anglophone **en accès libre** face au FT et au WSJ, tous deux payants. |

### 2.4 Correction apportée aux flux arXiv existants

Les deux entrées arXiv pointaient sur `http://export.arxiv.org/…`. L'URL en clair fonctionne encore
chez arXiv, mais elle échoue derrière tout proxy qui n'accepte que le CONNECT HTTPS — 403 constaté en
session, les deux flux ne rapportaient rien. Passées en `https://` : la version chiffrée est joignable
partout où l'ancienne l'était, l'inverse n'est pas vrai. Les deux flux rapportent depuis 5 items
chacun, à 0,80 (`arxiv.org`, palier préprint).

---

## 3. Flux testés et écartés, avec la raison

Testés le 07/09/2026 avec `rss-parser`, dans les mêmes conditions que le collecteur. **À ne pas
retester avant plusieurs mois** sauf information contraire.

### 3.1 Refus serveur (403 / 429) — pare-feu applicatif, indépendant du client

| flux testé | résultat |
|---|---|
| `https://www.banque-france.fr/fr/rss.xml` et `/rss.xml` | **403**. Perte réelle : c'est la source française qui aurait scoré 0,80 (`banque-france.fr` est dans la table). À retenter, éventuellement via un miroir. |
| `https://www.oecd.org/en/rss.xml` | **403**, confirme le diagnostic du 05/09/2026. Le repli Google News reste en place. |
| `https://www.imf.org/en/Blogs/rss`, `/en/News/rss`, `/external/rss/feeds.aspx?category=Blog` | **403** sur les trois. Idem OCDE. |
| `https://www.bls.gov/feed/bls_latest.rss` | **403** (Bureau of Labor Statistics). |
| `https://www.iea.org/rss/news` | **403** (Agence internationale de l'énergie). |
| `https://www.eurofound.europa.eu/en/rss.xml` | **429** (limitation de débit). Peut-être joignable avec un rythme plus lent — non retenu faute de garantie. |

### 3.2 URL inexistante (404 / 500) — le flux n'est pas à cette adresse, ou n'existe plus

| flux testé | résultat |
|---|---|
| `https://www.insee.fr/fr/information/rss/actualites` | **500** ; `…/fr/statistiques/rss`, `…/fr/information/rss`, `…/fr/statistiques/fluxRss` → **404**. La page de documentation RSS de l'INSEE (`/fr/information/1405599`) est elle-même en 404. Perte réelle, `insee.fr` est dans la table à 0,80. |
| `https://ec.europa.eu/eurostat/api/dissemination/catalogue/rss/en/euro-indicators-rss.xml` | **404**. Les pages `/eurostat/web/rss` et `/eurostat/web/rss/about-rss` répondent 200 mais n'exposent aucune URL de flux dans le HTML servi (portail rendu côté client). Aucune adresse de flux exploitable trouvée. |
| `https://www.bis.org/list/press_rss.xml`, `/doclist/all_rss.xml` | **404** — mais la page `bis.org/rss/index.htm` donne les bonnes adresses, d'où les deux flux BRI retenus. |
| `https://blogs.worldbank.org/en/rss` | **404**. |
| `https://cepr.org/rss/voxeu.xml` | **404** (VoxEU). |
| `https://www.tresor.economie.gouv.fr/rss` | **404** (DG Trésor). |
| `https://unctad.org/rss.xml`, `https://www.ilo.org/rss.xml` | **404** (CNUCED, OIT). |
| `https://www.ofce.sciences-po.fr/blog/rss.xml`, `https://www.cepii.fr/rss/blog.xml` | **404** (OFCE, CEPII). |
| `https://www.france24.com/fr/économie/rss` | **503**. |
| `https://services.lesechos.fr/rss/les-echos-economie.xml` | **403** (Les Échos). |
| `https://www.francetvinfo.fr/economie.rss` | **403**. |

### 3.3 Répond, mais le contenu est inutilisable

| flux testé | résultat |
|---|---|
| `https://www.ecb.europa.eu/rss/pub.html` (publications BCE) | Répond 200 en `application/rss+xml`, mais **XML mal formé** : « Invalid character in entity name », entité non close ligne 6. `rss-parser` échoue. Le flux presse de la BCE, lui, est propre — c'est celui qui a été retenu. |
| `https://www.vie-publique.fr/rss.xml` | Répond, mais « Feed not recognized as RSS 1 or 2 » — format non reconnu par le parseur. |
| `https://hai.stanford.edu/rss.xml` (Stanford HAI) | Répond, mais XML invalide : « Attribute without value ». |
| `https://feeds.content.dowjones.io/public/rss/mw_marketpulse` (MarketWatch MarketPulse) | Parse correctement, 30 items — mais **l'item le plus récent date du 03/07/2025**, soit plus d'un an. Flux abandonné par l'éditeur. Écarté : un flux figé n'apporte rien et donne l'illusion d'une couverture. |
| `https://feeds.content.dowjones.io/public/rss/mw_topstories` (MarketWatch Top Stories) | Techniquement bon (10 items du jour, liens sur `marketwatch.com`) mais **hors périmètre** : la une mêle marchés et conseils de vie personnelle. Écarté au titre du critère de contenu, pas au titre de la technique. |

---

## 4. L'entrée Spiderfoot

**Décision : désactivée** (`actif: false`), avec la raison écrite dans son champ `note`. L'entrée est
conservée, pas supprimée, pour garder la trace de la décision de canal du mégaprompt v1.1 (§7.1).

Pourquoi. Le schéma **autorisait** cette entrée telle quelle : `scripts/valider-donnees.mjs` n'exige
une URL que pour `type === "rss" && actif`, et l'entrée est de type `spiderfoot`. Le validateur était
donc à 0 erreur. Mais aucun script du dépôt ne lit ce type — `grep -rn spiderfoot scripts/` ne renvoie
que la constante `TYPES_SOURCE_VEILLE` du validateur. Le second canal n'est pas implémenté.

La conséquence n'était pas dans la collecte (`veille-rss.mjs` filtre sur `type === "rss"`, il ne
pouvait rien manquer) mais **dans le compte affiché** : `app/page.tsx` et `app/veille/page.tsx`
comptent les sources sur `s.actif`, sans regarder le type. L'accueil affirmait donc une source active
de plus qu'il n'en existe réellement. Un chiffre faux sur une page qui parle de traçabilité.

Effet de bord utile : `app/veille/page.tsx` n'affiche le champ `note` **que pour les sources
inactives**. La raison de la désactivation est donc désormais lisible sur `/veille`, ce qui n'aurait
pas été le cas d'une note laissée sur une entrée active.

À réactiver le jour où un collecteur Spiderfoot existe, en lui ajoutant l'URL de l'instance.

---

## 5. Rendement global du premier passage et cohérence des scores

`node scripts/veille-rss.mjs`, 07/09/2026 : **25 flux interrogés, 25 joignables, 0 en échec,
113 nouvelles propositions**. La file passe de 187 à 300 entrées, dont **113 au statut `en_attente`**
(elle était à zéro non traitée avant ce lot). Ces 113 propositions ne sont pas triées ici : le tri
relève de la revue humaine.

Répartition des scores attribués, à vérifier contre le barème de `scripts/veille-rss.mjs` :

| score | nb | palier | sources concernées |
|---|---|---|---|
| **0,90** | 5 | revue à comité de lecture | `nature.com` |
| **0,80** | 20 | préprint ou institution publique | `arxiv.org` (10), `ecb.europa.eu` (5), `ec.europa.eu` (5) |
| **0,60** | 3 | éditeur sur son propre produit | `openai.com` |
| **0,40** | 80 | presse, ou domaine absent de la table | voir ci-dessous |
| **0,15** | 5 | redirecteur opaque | `news.google.com` — les 3 replis Anthropic/FMI/OCDE |

**Les scores sont cohérents avec le barème**, avec une nuance qui mérite d'être dite : les 80
propositions à 0,40 recouvrent deux motifs distincts que le score seul ne sépare pas.

- **Palier presse assumé** (`ft.com`, `wsj.com`, `lemonde.fr`, `theguardian.com`) : motif
  « presse généraliste ou spécialisée ». Le score est celui qui était voulu.
- **Défaut prudent** (`bis.org`, `federalreserve.gov`, `bankofengland.co.uk`, `bankofcanada.ca`,
  `nber.org`, `bruegel.org`, `strategie-plan.gouv.fr`, `rfi.fr`, `dw.com`, `fr.euronews.com`,
  `latribune.fr`) : motif « domaine absent de la table ». **Une banque centrale s'y retrouve notée
  comme un site inconnu.** Le champ `score_fiabilite_motif` transporte la distinction, elle est donc
  lisible en revue — mais le score, lui, ne la porte pas.

**Recommandation, hors périmètre de ce lot** (`scripts/veille-rss.mjs` n'a pas été modifié) :
ajouter au palier `preprint_et_institution` (0,80) les domaines `bis.org`, `federalreserve.gov`,
`bankofengland.co.uk`, `bankofcanada.ca` et `nber.org`. Ce sont des institutions publiques et une
archive de documents de travail : le barème les décrit déjà, seule la table ne les nomme pas encore.
`bruegel.org`, `rfi.fr`, `dw.com`, `euronews.com`, `latribune.fr` et `strategie-plan.gouv.fr`
relèveraient plutôt du palier presse à 0,40 — leur score actuel est le bon, seul le motif est
imprécis. La décision revient à la revue : c'est un déplacement de seuil de source primaire.

Aucun flux n'a rapporté zéro article. Les deux seuls points d'attention de rendement sont
`bri-communiques` (cadence trimestrielle : le plafond de 5 items sera rarement atteint aux passages
suivants) et `nber-documents-travail` (items sans date).

---

## 6. Note d'environnement

`rss-parser` appelle `https.get`, qui n'honore pas `HTTPS_PROXY`. Derrière le proxy d'agent de la
session, tous les flux répondaient 403 tant que l'agent HTTPS global n'était pas remplacé par un agent
passant par le `CONNECT` du proxy. Le contournement est resté **hors du dépôt** (module de préchargement
en scratchpad, `node -r …`) : il ne concerne que cette session, `scripts/veille-rss.mjs` n'a pas été
touché, et le cron GitHub n'a pas ce problème puisqu'il sort en direct.

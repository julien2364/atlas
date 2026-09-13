# Moisson de sources

Dernier passage : **2026-09-13** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**38 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-13.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 4 | [Ingénierie de la pauvreté et développement](https://shs.hal.science/halshs-03518844v1) — hal, 2019 |
| Alliance solaire internationale (ASI) | 7 | 2 | [Internationale Seefunksatelliten-Organisation (International Maritime ](https://doi.org/10.1007/978-3-322-86673-8_62) — crossref, 1995 |
| Amartya Sen | 7 | 4 | [Une autre approche du travail en économie : Amartya Sen](https://shs.hal.science/halshs-00421843v1) — hal, 2002 |
| Anarchisme | 7 | 4 | [Landauer : anarchisme, culture et politique](https://hal.science/hal-01169121v1) — hal, 2014 |
| Banque africaine de développement (BAfD) | 7 | 4 | [Scolarisation](https://doi.org/10.1787/aeo-2009-table3_19-fr) — crossref, 2009 |
| Bipolarité (Guerre froide) | 7 | 4 | [Nouveaux regards sur la coopération pour le développement et ses trans](https://doi.org/10.3917/med.165.0007) — openalex, 2014 |
| Black-Scholes | 7 | 4 | [STATIC HEDGING OF BARRIER OPTIONS WITH A SMILE: AN INVERSE PROBLEM](https://hal.science/hal-01477102v1) — hal, 2002 |
| BRICS(+) | 7 | 4 | [Directives Facultatives pour la Conception, la Construction et l’Équip](https://doi.org/10.62454/ea761f) — crossref, 2006 |
| Capitalisme de marché libre (laissez-faire) | 7 | 4 | [Conflit entre marché et État dans la société technicienne](https://doi.org/10.7202/040495ar) — openalex, 1985 |
| CEI | 7 | 4 | [Diplomaţie şi actori geopolitici în epoca interdependenţei complexe, C](https://hal.science/hal-05196295v1) — hal, 2021 |

## Fonds indisponibles sur ce passage

- arxiv / abhijit-banerjee : HTTP 429
- arxiv / alliance-solaire-internationale-asi : This operation was aborted
- arxiv / amartya-sen : This operation was aborted
- arxiv / anarchisme : HTTP 429
- arxiv / banque-africaine-de-developpement-bafd : This operation was aborted
- arxiv / bipolarite-guerre-froide : HTTP 429
- arxiv / black-scholes : HTTP 429
- arxiv / brics : HTTP 429
- doaj / brics : This operation was aborted
- arxiv / capitalisme-de-marche-libre-laissez-faire : HTTP 429
- arxiv / cei : HTTP 429

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


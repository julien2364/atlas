# Moisson de sources

Dernier passage : **2026-09-14** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**21 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-14.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 4 | [Heights and Human Welfare: Recent Developments and New Directions](https://doi.org/10.3386/w14536) — openalex, 2008 |
| Alliance solaire internationale (ASI) | 7 | 0 | — |
| Amartya Sen | 7 | 4 | [Amartya Sen; Nobelprijswinnaar Economie 1998](https://research.tilburguniversity.edu/en/publications/9ff36b64-7af5-4022-80df-db87619fdd4b) — openalex, 1998 |
| Anarchisme | 7 | 4 | [La communication politique : construction d'un modele](https://doi.org/10.4267/2042/15353) — crossref, 1989 |
| Banque africaine de développement (BAfD) | 7 | 0 | — |
| Bipolarité (Guerre froide) | 7 | 0 | — |
| Black-Scholes | 7 | 4 | [Varieties of capitalism en de Nederlandse economie in de periode 1950-](https://doi.org/10.18352/tseg.645) — openalex, 2006 |
| BRICS(+) | 7 | 2 | [A living mapping review for COVID-19 funded research projects: final (](https://doi.org/10.12688/wellcomeopenres.16259.10) — europepmc, 2020 |
| Capitalisme de marché libre (laissez-faire) | 7 | 1 | [O Estado e o processo de globalização*](https://univ-grenoble-alpes.hal.science/hal-05676742v1) — hal, 1998 |
| CEI | 7 | 2 | [Contributions to Software Engineering and to the Development and Deplo](https://theses.hal.science/tel-00483255v1) — hal, 2009 |

## Fonds indisponibles sur ce passage

- arxiv / abhijit-banerjee : This operation was aborted
- arxiv / alliance-solaire-internationale-asi : HTTP 429
- arxiv / amartya-sen : HTTP 429
- arxiv / anarchisme : HTTP 429
- arxiv / bipolarite-guerre-froide : HTTP 429
- arxiv / black-scholes : This operation was aborted
- arxiv / brics : This operation was aborted
- doaj / brics : This operation was aborted
- arxiv / capitalisme-de-marche-libre-laissez-faire : HTTP 429
- arxiv / cei : HTTP 429

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


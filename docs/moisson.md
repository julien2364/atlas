# Moisson de sources

Dernier passage : **2026-10-01** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**1 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-10-01.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 0 | — |
| Alliance solaire internationale (ASI) | 7 | 0 | — |
| Amartya Sen | 7 | 0 | — |
| Anarchisme | 7 | 0 | — |
| Banque africaine de développement (BAfD) | 7 | 0 | — |
| Bipolarité (Guerre froide) | 7 | 0 | — |
| Black-Scholes | 7 | 0 | — |
| BRICS(+) | 7 | 0 | — |
| Capitalisme de marché libre (laissez-faire) | 7 | 1 | [Les chemins sinueux de la pensée économique libérale](https://doi.org/10.3917/leco.044.0042) — openalex, 2009 |
| CEI | 7 | 0 | — |

## Fonds indisponibles sur ce passage

- doaj / amartya-sen : This operation was aborted
- arxiv / anarchisme : This operation was aborted
- arxiv / banque-africaine-de-developpement-bafd : This operation was aborted
- doaj / banque-africaine-de-developpement-bafd : This operation was aborted
- arxiv / bipolarite-guerre-froide : HTTP 429
- arxiv / black-scholes : This operation was aborted
- arxiv / brics : This operation was aborted
- doaj / brics : This operation was aborted
- arxiv / capitalisme-de-marche-libre-laissez-faire : This operation was aborted
- arxiv / cei : HTTP 429

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


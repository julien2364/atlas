# Moisson de sources

Dernier passage : **2026-09-25** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**4 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-25.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 2 | [The Impact of Regulation on Innovation](https://doi.org/10.1257/aer.20210107) — openalex, 2023 |
| Alliance solaire internationale (ASI) | 7 | 1 | [La Mongolie et ses rapports avec le monde et la France depuis 1990 : i](https://doi.org/10.70675/7a7075dazd9c4z47d8zacc4zdfe670e7c337) — openalex, 2017 |
| Amartya Sen | 7 | 0 | — |
| Anarchisme | 7 | 0 | — |
| Banque africaine de développement (BAfD) | 7 | 1 | [Les institutions financières internationales](https://doi.org/10.3917/cris.1601.0001) — openalex, 1998 |
| Bipolarité (Guerre froide) | 7 | 0 | — |
| Black-Scholes | 7 | 0 | — |
| BRICS(+) | 7 | 0 | — |
| Capitalisme de marché libre (laissez-faire) | 7 | 0 | — |
| CEI | 7 | 0 | — |

## Fonds indisponibles sur ce passage

- doaj / brics : This operation was aborted

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


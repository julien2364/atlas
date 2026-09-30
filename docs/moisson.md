# Moisson de sources

Dernier passage : **2026-09-30** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**2 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-30.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 0 | — |
| Alliance solaire internationale (ASI) | 7 | 0 | — |
| Amartya Sen | 7 | 0 | — |
| Anarchisme | 7 | 0 | — |
| Banque africaine de développement (BAfD) | 7 | 1 | [Les principales maladies](https://doi.org/10.1787/aeo-2009-table3_17-fr) — crossref, 2009 |
| Bipolarité (Guerre froide) | 7 | 0 | — |
| Black-Scholes | 7 | 0 | — |
| BRICS(+) | 7 | 0 | — |
| Capitalisme de marché libre (laissez-faire) | 7 | 0 | — |
| CEI | 7 | 1 | [Mobilité internationale en Europe centrale touristes, commerçants et m](https://doi.org/10.4000/remi.1680) — openalex, 2002 |

## Fonds indisponibles sur ce passage

- doaj / brics : This operation was aborted

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


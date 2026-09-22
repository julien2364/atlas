# Moisson de sources

Dernier passage : **2026-09-22** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**2 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-22.json`.

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
| Bipolarité (Guerre froide) | 7 | 1 | [Du tiers-monde au monde multipolaire : l’évolution du paradigme du non](https://doi.org/10.3917/rfhip1.042.0117) — openalex, 2015 |
| Black-Scholes | 7 | 0 | — |
| BRICS(+) | 7 | 0 | — |
| Capitalisme de marché libre (laissez-faire) | 7 | 1 | [Economie de marché et Etat en France : mythes et légendes du colbertis](https://doi.org/10.3917/leco.037.0077) — openalex, 2008 |
| CEI | 7 | 0 | — |

## Fonds indisponibles sur ce passage

- doaj / brics : This operation was aborted
- openalex / cei : HTTP 429

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


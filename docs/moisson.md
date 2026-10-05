# Moisson de sources

Dernier passage : **2026-10-05** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**4 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-10-05.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 1 | [COVID-19 and Change](https://doi.org/10.33423/jabe.v23i3.4353) — openalex, 2021 |
| Alliance solaire internationale (ASI) | 7 | 0 | — |
| Amartya Sen | 7 | 0 | — |
| Anarchisme | 7 | 0 | — |
| Banque africaine de développement (BAfD) | 7 | 0 | — |
| Bipolarité (Guerre froide) | 7 | 0 | — |
| Black-Scholes | 7 | 0 | — |
| BRICS(+) | 7 | 2 | [Le paradoxe pragmatique : les BRICS comme vecteur de la diplomatie d’i](https://doi.org/10.3917/herm.079.0183) — openalex, 2017 |
| Capitalisme de marché libre (laissez-faire) | 7 | 0 | — |
| CEI | 7 | 1 | [Organisations internationales de normalisation électrique](https://doi.org/10.51257/a-v1-d1130) — openalex, 1995 |

## Fonds indisponibles sur ce passage

- doaj / brics : This operation was aborted

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


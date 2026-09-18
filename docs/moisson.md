# Moisson de sources

Dernier passage : **2026-09-18** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**3 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-18.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 0 | — |
| Alliance solaire internationale (ASI) | 7 | 0 | — |
| Amartya Sen | 7 | 1 | [Economie sociale](https://doi.org/10.3917/etu.074.0309) — openalex, 2007 |
| Anarchisme | 7 | 1 | [Recension de The Birth Of Chinese Feminism. Essential Texts in Transna](https://hal.science/hal-01382863v1) — hal, 2015 |
| Banque africaine de développement (BAfD) | 7 | 0 | — |
| Bipolarité (Guerre froide) | 7 | 0 | — |
| Black-Scholes | 7 | 0 | — |
| BRICS(+) | 7 | 0 | — |
| Capitalisme de marché libre (laissez-faire) | 7 | 1 | [L'émergence de la problématique des institutions en économie](https://doi.org/10.3917/cep.044.0019) — openalex, 2003 |
| CEI | 7 | 0 | — |

## Fonds indisponibles sur ce passage

- doaj / brics : This operation was aborted

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


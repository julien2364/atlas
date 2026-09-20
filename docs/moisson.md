# Moisson de sources

Dernier passage : **2026-09-20** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**4 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-20.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 0 | — |
| Alliance solaire internationale (ASI) | 7 | 0 | — |
| Amartya Sen | 7 | 2 | [Amartya Sen : un allié pour l’économie de la personne contre la métriq](https://doi.org/10.3917/rpec.191.0049) — openalex, 2018 |
| Anarchisme | 7 | 0 | — |
| Banque africaine de développement (BAfD) | 7 | 1 | [Le retour de Moscou en Afrique subsaharienne ?](https://doi.org/10.3917/afco.248.0061) — openalex, 2014 |
| Bipolarité (Guerre froide) | 7 | 1 | [Les nouveaux interventionnismes militaires africains](https://doi.org/10.3917/polaf.098.0111) — openalex, 1981 |
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


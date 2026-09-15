# Moisson de sources

Dernier passage : **2026-09-15** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**10 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-15.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 3 | [Corruption](https://doi.org/10.3386/w17968) — crossref, 2012 |
| Alliance solaire internationale (ASI) | 7 | 0 | — |
| Amartya Sen | 7 | 4 | [Les Africains, sont-ils heureux ? « Retour au rire » en temps de guerr](https://doi.org/10.2139/ssrn.4099388) — europepmc, 2022 |
| Anarchisme | 7 | 2 | [L’art public altruiste dans l’Espagne contemporaine: Similitudes avec ](https://hal.science/hal-01390533v1) — hal, 2012 |
| Banque africaine de développement (BAfD) | 7 | 0 | — |
| Bipolarité (Guerre froide) | 7 | 0 | — |
| Black-Scholes | 7 | 1 | [Three Risky Decades: A Time for Econophysics?](https://doi.org/10.3390/e24050627) — europepmc, 2022 |
| BRICS(+) | 7 | 0 | — |
| Capitalisme de marché libre (laissez-faire) | 7 | 0 | — |
| CEI | 7 | 0 | — |

## Fonds indisponibles sur ce passage

- arxiv / abhijit-banerjee : HTTP 429
- arxiv / alliance-solaire-internationale-asi : HTTP 429
- arxiv / amartya-sen : This operation was aborted
- arxiv / anarchisme : HTTP 429
- arxiv / banque-africaine-de-developpement-bafd : This operation was aborted
- arxiv / bipolarite-guerre-froide : HTTP 429
- arxiv / black-scholes : HTTP 429
- arxiv / brics : HTTP 429
- doaj / brics : This operation was aborted
- arxiv / capitalisme-de-marche-libre-laissez-faire : This operation was aborted
- arxiv / cei : This operation was aborted

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


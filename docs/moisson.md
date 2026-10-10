# Moisson de sources

Dernier passage : **2026-10-10** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**0 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-10-10.json`.

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
| Capitalisme de marché libre (laissez-faire) | 7 | 0 | — |
| CEI | 7 | 0 | — |

## Fonds indisponibles sur ce passage

- europepmc / abhijit-banerjee : HTTP 503
- europepmc / alliance-solaire-internationale-asi : HTTP 502
- europepmc / amartya-sen : HTTP 502
- europepmc / anarchisme : HTTP 503
- europepmc / banque-africaine-de-developpement-bafd : HTTP 503
- europepmc / bipolarite-guerre-froide : HTTP 503
- europepmc / black-scholes : HTTP 503
- doaj / brics : This operation was aborted
- europepmc / brics : HTTP 503
- europepmc / capitalisme-de-marche-libre-laissez-faire : HTTP 503
- europepmc / cei : HTTP 503

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


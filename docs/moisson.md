# Moisson de sources

Dernier passage : **2026-09-24** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**0 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-24.json`.

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

- openalex / abhijit-banerjee : HTTP 429
- openalex / alliance-solaire-internationale-asi : HTTP 429
- openalex / anarchisme : HTTP 429
- openalex / banque-africaine-de-developpement-bafd : HTTP 429
- openalex / brics : HTTP 429
- doaj / brics : This operation was aborted
- openalex / capitalisme-de-marche-libre-laissez-faire : HTTP 429

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


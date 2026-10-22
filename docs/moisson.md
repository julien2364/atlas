# Moisson de sources

Dernier passage : **2026-10-22** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**0 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-10-22.json`.

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

- hal / abhijit-banerjee : fetch failed
- doaj / abhijit-banerjee : HTTP 502
- hal / alliance-solaire-internationale-asi : fetch failed
- doaj / alliance-solaire-internationale-asi : HTTP 502
- openalex / amartya-sen : HTTP 429
- hal / amartya-sen : fetch failed
- doaj / amartya-sen : HTTP 502
- openalex / anarchisme : HTTP 429
- hal / anarchisme : fetch failed
- doaj / anarchisme : HTTP 502
- hal / banque-africaine-de-developpement-bafd : fetch failed
- doaj / banque-africaine-de-developpement-bafd : HTTP 502
- hal / bipolarite-guerre-froide : fetch failed
- doaj / bipolarite-guerre-froide : HTTP 502
- hal / black-scholes : fetch failed
- doaj / black-scholes : HTTP 502
- hal / brics : fetch failed
- doaj / brics : HTTP 502
- hal / capitalisme-de-marche-libre-laissez-faire : fetch failed
- doaj / capitalisme-de-marche-libre-laissez-faire : HTTP 502

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


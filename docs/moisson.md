# Moisson de sources

Dernier passage : **2026-09-17** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**4 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-17.json`.

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
| Capitalisme de marché libre (laissez-faire) | 7 | 1 | [Keynes et ses combats](https://doi.org/10.3917/idee.157.0064) — openalex, 2009 |
| CEI | 7 | 3 | [La galaxie CEI 1991-2006](https://doi.org/10.3917/cpe.063.0014) — openalex, 2006 |

## Fonds indisponibles sur ce passage

- hal / abhijit-banerjee : fetch failed
- europepmc / abhijit-banerjee : HTTP 503
- openalex / alliance-solaire-internationale-asi : HTTP 429
- hal / alliance-solaire-internationale-asi : fetch failed
- europepmc / alliance-solaire-internationale-asi : HTTP 503
- hal / amartya-sen : fetch failed
- europepmc / amartya-sen : HTTP 503
- openalex / anarchisme : HTTP 429
- hal / anarchisme : fetch failed
- europepmc / anarchisme : HTTP 503
- openalex / banque-africaine-de-developpement-bafd : HTTP 429
- hal / banque-africaine-de-developpement-bafd : fetch failed
- europepmc / banque-africaine-de-developpement-bafd : HTTP 503
- hal / bipolarite-guerre-froide : fetch failed
- europepmc / bipolarite-guerre-froide : HTTP 503
- openalex / black-scholes : HTTP 429
- hal / black-scholes : fetch failed
- hal / brics : fetch failed
- doaj / brics : This operation was aborted
- hal / capitalisme-de-marche-libre-laissez-faire : fetch failed

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


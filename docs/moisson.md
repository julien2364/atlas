# Moisson de sources

Dernier passage : **2026-10-29** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**18 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-10-29.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 3 | [Abhijit V. BANERJEE et Esther DUFLO Économie utile pour des temps diff](https://doi.org/10.3917/med.192.0181) — openalex, 2020 |
| Alliance solaire internationale (ASI) | 7 | 2 | [Énergies renouvelables en Amérique latine : les apports de l’anthropol](https://doi.org/10.4000/14obf) — openalex, 2019 |
| Amartya Sen | 7 | 4 | [Amartya Sen : économie et justice](https://doi.org/10.3917/sh.169.0026) — openalex, 2006 |
| Anarchisme | 7 | 4 | [10. Protestantisme et anarchisme](https://doi.org/10.13135/2280-8574/2835) — openalex, 2018 |
| Banque africaine de développement (BAfD) | 7 | 0 | — |
| Bipolarité (Guerre froide) | 7 | 0 | — |
| Black-Scholes | 7 | 2 | [La sociologie des sciences et la « nouvelle économie de l'information ](https://doi.org/10.3917/res.122.0167) — openalex, 2003 |
| BRICS(+) | 7 | 0 | — |
| Capitalisme de marché libre (laissez-faire) | 7 | 3 | [« L’hôtesse parfaite » : Mrs Dalloway, le don et la fin du laissez-fai](https://doi.org/10.3917/rdm1.058.0165) — openalex, 2022 |
| CEI | 7 | 0 | — |

## Fonds indisponibles sur ce passage

- hal / abhijit-banerjee : fetch failed
- hal / alliance-solaire-internationale-asi : fetch failed
- hal / amartya-sen : fetch failed
- hal / anarchisme : fetch failed
- hal / banque-africaine-de-developpement-bafd : fetch failed
- hal / bipolarite-guerre-froide : fetch failed
- hal / black-scholes : fetch failed
- hal / brics : fetch failed
- doaj / brics : This operation was aborted
- hal / capitalisme-de-marche-libre-laissez-faire : fetch failed
- hal / cei : fetch failed

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


# Moisson de sources

Dernier passage : **2026-09-12** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**40 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-12.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 4 | [Pinostrobin: for Neuropathic Pain](https://doi.org/10.2139/ssrn.5661330) — crossref, 2025 |
| Alliance solaire internationale (ASI) | 7 | 4 | [Communauté internationale et organisation internationale. The Internat](https://doi.org/10.1163/ej.9789024736584.3-685.2) — crossref |
| Amartya Sen | 7 | 4 | [3 enfants, 1 flûte : le choix des principes de justice chez Amartya Se](https://doi.org/10.3917/leco.083.0086) — crossref, 2019 |
| Anarchisme | 7 | 4 | [Anarchisme et décolonisation en Algérie. Le Mouvement libertaire nord-](https://doi.org/10.4000/histoirepolitique.3268) — crossref, 2019 |
| Banque africaine de développement (BAfD) | 7 | 4 | [Appliquer l'évaluation à l'aide au développement : une solution pour c](https://doi.org/10.3917/edd.264.0125) — openalex, 2013 |
| Bipolarité (Guerre froide) | 7 | 4 | [Penser l'après-guerre froide](https://doi.org/10.4000/conflits.535) — crossref, 1992 |
| Black-Scholes | 7 | 4 | [Black-Scholes-Formel](https://doi.org/10.1007/978-3-658-00988-5_10) — crossref, 2012 |
| BRICS(+) | 7 | 4 | [The BRICS and soft power: an introduction](https://doi.org/10.1080/2158379x.2016.1232284) — openalex, 2016 |
| Capitalisme de marché libre (laissez-faire) | 7 | 4 | [Capitalisme et marché à la Renaissance](https://doi.org/10.3917/leco.030.0087) — crossref, 2006 |
| CEI | 7 | 4 | [Norme de responsabilité et responsabilité des normes : le cas d'ISO 26](https://doi.org/10.3917/mav.023.0091) — openalex, 2009 |

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


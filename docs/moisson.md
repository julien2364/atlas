# Moisson de sources

Dernier passage : **2026-09-11** · fonds interrogés : openalex, crossref, arxiv, hal, doaj, europepmc.

**40 propositions** pour **10 fiches**, écrites dans `../../_temp/moisson-2026-09-11.json`.

Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ
`retenues` de chaque bloc avec les clés choisies, puis lancer
`node scripts/moissonner.mjs --appliquer=<fichier>`.

| Fiche | Besoin | Propositions | Meilleure proposition |
|---|---:|---:|---|
| Abhijit Banerjee | 7 | 4 | [Abhijit V. Banerjee, Esther Duflo, "Repenser la pauvreté](https://hal.science/hal-01519911v1) — hal, 2013 |
| Alliance solaire internationale (ASI) | 7 | 4 | [Recension de l'ouvrage "La France et l’Inde des origines à nos jours. ](https://hal.science/hal-05572502) — openalex, 2023 |
| Amartya Sen | 7 | 4 | [Amartya Sen et l'Ethique du développement.](https://theses.hal.science/tel-03143063v1) — hal, 2020 |
| Anarchisme | 7 | 4 | [Dada ou la boussole folle de l'anarchisme](https://doi.org/10.3917/lignes.016.0148) — openalex, 2005 |
| Banque africaine de développement (BAfD) | 7 | 4 | [Quelle devrait être la mission des banques multilatérales de développe](https://doi.org/10.3917/edd.161.0171) — openalex, 2002 |
| Bipolarité (Guerre froide) | 7 | 4 | [Chapitre 1 : Séries télévisées, Guerre froide et mémoires nationales d](https://doi.org/10.4000/books.septentrion.148368) — crossref, 2023 |
| Black-Scholes | 7 | 4 | [Ansätze in der Optionspreistheorie vor Black und Scholes](https://doi.org/10.1007/978-3-322-89312-3_3) — crossref, 1988 |
| BRICS(+) | 7 | 4 | [BRICS, a Multi-Centre “Legal Network”?](https://doi.org/10.4236/blr.2014.52013) — openalex, 2014 |
| Capitalisme de marché libre (laissez-faire) | 7 | 4 | [Focus – Faire du social dans le cadre du marché de libre concurrence](https://doi.org/10.3917/inso.172.0030) — crossref, 2012 |
| CEI | 7 | 4 | [Manuel IAMSAR, Volume I – Organisation et Gestion](https://doi.org/10.62454/kk960f) — crossref, 2022 |

## Fonds indisponibles sur ce passage

- arxiv / abhijit-banerjee : HTTP 406
- arxiv / alliance-solaire-internationale-asi : HTTP 406
- arxiv / amartya-sen : HTTP 406
- arxiv / anarchisme : HTTP 406
- arxiv / banque-africaine-de-developpement-bafd : HTTP 406
- arxiv / bipolarite-guerre-froide : HTTP 406
- arxiv / black-scholes : HTTP 406
- arxiv / brics : HTTP 406
- doaj / brics : This operation was aborted
- arxiv / capitalisme-de-marche-libre-laissez-faire : HTTP 406
- arxiv / cei : HTTP 406

## Ce que la moisson ne fait pas

Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire
entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être
hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.


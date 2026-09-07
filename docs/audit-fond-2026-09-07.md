# Audit contradictoire du fond — 07/09/2026

> Ce rapport ne corrige rien. Il constate. Chaque finding porte la citation fautive
> mot pour mot, ce que dit réellement la source consultée, et la correction proposée.

## Pourquoi cet audit

512 fiches ont été produites en deux jours, en grande partie par des agents travaillant
en parallèle. `npm run valider` garantit la **forme** — schéma, énumérations, dates,
intégrité référentielle, unicité des identifiants — et il sort aujourd'hui à 0 erreur et
0 avertissement. Il ne dit rien du **fond** : une fiche parfaitement bien formée peut
attribuer une citation au mauvais auteur, avancer un chiffre absent de la source qu'elle
cite, ou présenter comme acquis un point contesté. C'est précisément ce que cet audit
cherche.

## Méthode

Cinq échantillons tirés au sort de façon reproductible (générateur congruentiel, graine
20260906), et non choisis pour leur qualité : 15 fiches philosophiques, 15 fiches
sociales, 15 fiches d'évolution, 15 fiches IA, 9 fiches psychologiques et sérénité —
**69 fiches au total, soit 13 % du corpus**. Quatre auditeurs en posture adverse ont
ouvert et lu par WebFetch chaque URL citée par chaque fiche de leur échantillon, puis
comparé le contenu de la fiche au contenu réel de la source. Aucun domaine n'a été bloqué
par le proxy : la totalité des sources à URL a pu être vérifiée.

Chaque fiche est notée de 1 à 5 sur quatre axes : fidélité à la source, neutralité,
densité, utilité.

## Résultat d'ensemble

| Échantillon | Fidélité | Neutralité | Densité | Utilité | Findings | À reprendre |
|---|---|---|---|---|---|---|
| Philosophique (15) | 3,87 | 3,80 | 3,93 | 4,07 | 22 | 33 % |
| Social (15) | 3,20 | 4,10 | 4,00 | 3,90 | 11 | 53 % |
| Évolution (15) | 3,27 | 4,40 | 3,87 | 3,73 | 17 | 67 % |
| IA (15) | 3,10 | 4,00 | 3,90 | 3,70 | — | 29 % |
| Psycho / sérénité (9) | 3,40 | 3,80 | 4,00 | 4,00 | 16 (cumulé IA) | (cumulé IA) |
| **Ensemble (69)** | **3,37** | **4,02** | **3,94** | **3,88** | **66** | **≈ 45 %** |

**5 findings bloquants, 27 sérieux, 34 mineurs.**

## Les trois enseignements qui comptent

**1. La neutralité tient, la fidélité non.** C'est le résultat le plus net et le plus
contre-intuitif. L'axe qu'on croyait le plus risqué — les régimes politiques, les écoles
économiques — est celui qui note le mieux en neutralité (4,10 et 4,40) : les jugements
sont attribués, les positions concurrentes exposées. Le vrai défaut est ailleurs, et il
est systématique : **des champs `apport` et `limites_critiques` remplis de connaissances
générales plausibles mais absentes du document réellement cité.** Le contenu est le plus
souvent juste sur le fond ; il n'est pas traçable à la source déclarée. C'est exactement
ce que la règle « rien de mémoire » interdit, et c'est la signature d'une rédaction faite
de mémoire puis habillée d'une source après coup.

**2. Les sources primaires n'ont presque jamais d'URL.** Sur l'échantillon philosophique,
aucune des 16 entrées primaires n'en porte. Même constat sur l'évolution (15 sur 15) et
sur 40 % des fiches IA. Une œuvre imprimée n'a pas d'URL, c'est entendu — mais une
« documentation GovTech » ou un « impact sur la recherche pharmaceutique » sans lien n'est
pas une source, c'est une intention de source. Le validateur ne le voit pas parce qu'il
n'exige une URL que sur la fiche entière, pas par entrée.

**3. Le TRL est utilisé pour deux choses différentes.** Un TRL est systématiquement
attribué au secteur « recherche » ou « science » sur les fiches IA, alors que l'échelle
mesure la maturité d'un déploiement, pas l'adoption académique. Et deux TRL sont
franchement sous-évalués : l'aide à la décision publique est donnée à 6 alors que la fiche
décrit elle-même des systèmes déployés à l'échelle nationale — SyRI aux Pays-Bas, la
notation des A-levels au Royaume-Uni — avant d'être annulés pour des motifs juridiques et
non techniques. Les RNN sont à 7 alors qu'ils ont été en production commerciale chez Google
dès 2016.

## Les cinq findings bloquants

1. **Jane Goodall** — la fiche attribue à Goodall une citation qui est en réalité de Louis
   Leakey (« redéfinir l'outil, redéfinir l'homme, ou accepter que les chimpanzés sont des
   hommes »).
2. **Minilatéralisme G7/G20** — la fiche est sourcée sur un article « Gouvernance mondiale »
   qui ne mentionne ni le G7, ni le G20, ni le mot « minilatéralisme ». Le sujet entier est
   hors-source.
3. **Thérapies cognitivo-comportementales** — la fiche affirme sans source que l'alliance
   thérapeutique est « le facteur le plus prédictif du résultat clinique selon les
   méta-analyses toutes approches confondues », et cite Woebot et Wysa. Aucune des trois
   sources citées ne traite de cela. Affirmation d'efficacité clinique non attribuée, sur
   un sujet de santé mentale : c'est le finding le plus sensible du lot.
4. **Martin Seligman** — la fiche omet une controverse documentée par sa propre source :
   le rôle allégué de sa théorie de l'impuissance apprise dans les programmes
   d'interrogatoire de la CIA. Survalorisation par omission.
5. **Traçabilité des sources primaires** — finding transversal, voir l'enseignement 2.

## Défaut de forme non détecté par le validateur

Deux fiches IA portent deux entrées `usages` sur le même secteur : `lstm` (industrie ×2)
et `aide-a-la-decision-publique-govtech-ia` (gouvernement ×2). Le validateur ne contrôle
pas l'unicité du secteur au sein d'une fiche. Trouvé incidemment par l'indexeur du moteur
RAG, qui ignore la seconde entrée. À arbitrer : fusionner les deux usages, ou ajouter la
règle au validateur.

## Ce qu'il faut en faire

Le corpus est publiable — il est juste sur le fond bien plus souvent qu'il n'est traçable.
Le chantier de reprise n'est donc pas une réécriture mais un travail de sourcing : pour
chaque fiche listée ci-dessous, retrouver la source qui porte réellement ce que la fiche
affirme, ou retirer l'affirmation. Par ordre de gravité décroissante, en commençant par
les cinq bloquants.

Une correction de méthode s'impose aussi pour la suite : exiger l'URL **par entrée de
source** et non par fiche, et interdire qu'un champ soit rédigé avant que sa source ait
été ouverte.

---

# Rapports détaillés par échantillon


## Audit contradictoire — axe philosophique (échantillon n=15)

**Auditeur** : Claude (posture adverse, aucune modification du dépôt)
**Échantillon** : `echantillon-philosophique.json`, 15 fiches tirées au sort sur l'axe philosophique
**Méthode** : chaque URL de source secondaire a été ouverte via WebFetch et son contenu confronté phrase par phrase aux fiches ; les sources primaires n'ont pas pu être ouvertes car **aucune ne comporte d'URL** (voir constat transversal n°1). Les 15 URL secondaires (fr.wikipedia.org) ont toutes été accessibles — aucun domaine bloqué par le proxy, aucune fiche invérifiable pour cause d'accès.
**Point positif à noter d'emblée** : sur les 15 URL secondaires vérifiées, aucune n'est une homonymie ou une page hors-sujet — le risque documenté par le projet ne s'est pas matérialisé sur cet échantillon. Aucune survalorisation explicite de l'IA n'a non plus été détectée dans les champs `resonance_ia` (formulations hypothétiques, pas d'affirmations du type « prouve », « révolutionne », « surpasse »).

---

## 1. Constats transversaux (touchent tout ou partie de l'échantillon)

### T1 — Sources primaires sans URL (gravité : **bloquant**, 16 occurrences / 15 fiches, 100 %)
Sur les 15 fiches, les 16 entrées de type `primaire` (Nietzsche en a deux) ne comportent **que** `titre` et `type` — jamais de champ `url`. La règle 3 du référentiel exige « une source primaire et une secondaire, avec URL réelle ». Ici, la moitié du dispositif de traçabilité est structurellement absente sur 100 % de l'échantillon : impossible de vérifier qu'un agent a réellement ouvert *L'Être et le Néant*, *Les Damnés de la terre*, *Recherches philosophiques*, etc., plutôt que de les citer de mémoire — ce que la règle 1 interdit précisément. Beaucoup de ces textes existent pourtant en ligne (Wikisource, archive.org, PUF/Gallica extraits) : l'absence n'est pas une fatalité éditoriale.
Conséquence directe repérée deux fois dans l'échantillon (détaillée en section 2) : des citations/concepts attribués implicitement à l'œuvre citée comme primaire proviennent en réalité d'un **autre** ouvrage du même auteur (Sartre, Fanon) — signe assez net d'une rédaction de mémoire plutôt que d'une lecture de la source déclarée.

### T2 — Format « 1 phrase par champ » au lieu de « 2 à 4 phrases » (gravité : **mineur**, 15/15 fiches)
La règle 4 demande 2 à 4 phrases par champ. Dans l'échantillon, `these_centrale`, `apport`, `limites_critiques` et `resonance_ia` sont systématiquement rédigés comme **une seule phrase** étirée par point-virgules et tirets (ex. Adorno/`these_centrale` : 349 caractères, 0 point final avant la fin). Le contenu est dense, mais le format prescrit n'est respecté nulle part — signe d'un patron de génération unique appliqué uniformément par les agents, plutôt que d'une variation naturelle de rédaction.

### T3 — Formule de sourçage vague et récurrente « jugé/accusé par certains/beaucoup » (gravité : **mineur**, 6/15 fiches = 40 %)
Présente mot pour mot (ou en variante très proche) dans : `theodor-adorno`, `martha-nussbaum`, `jacques-ranciere`, `donna-haraway`, `david-chalmers`, `luce-irigaray`. Aucun de ces six emplois ne nomme le ou les critiques réels. C'est une redite de gabarit entre fiches (probablement produite par des agents différents à partir du même prompt), et c'est aussi un problème de fond : une critique non attribuée n'est pas vérifiable et laisse planer un doute sur son existence réelle vs. une généralisation plausible mais inventée.

---

## 2. Tableau de notation (1 = très faible, 5 = excellent)

| Fiche | Fidélité source | Neutralité | Densité | Utilité | Findings propres | Statut |
|---|---|---|---|---|---|---|
| Theodor Adorno | 4 | 4 | 4 | 4 | 1 mineur | OK avec réserve |
| Karl Popper | 4 | 4 | 4 | 4 | 1 mineur | OK avec réserve |
| Martha Nussbaum | 4 | 4 | 4 | 4 | 1 mineur | OK avec réserve |
| Jacques Rancière | 4 | 4 | 4 | 4 | 1 mineur | OK avec réserve |
| Donna Haraway | 3 | 3 | 4 | 4 | 2 (1 sérieux, 1 mineur) | **à reprendre** |
| Jean-Paul Sartre | 3 | 4 | 4 | 4 | 1 sérieux | **à reprendre** |
| David Chalmers | 3 | 4 | 4 | 5 | 2 mineurs | OK avec réserve |
| John Rawls | 3 | 4 | 4 | 5 | 1 sérieux | **à reprendre** |
| Martin Heidegger | 5 | 4 | 4 | 4 | 0 | Fiche saine |
| Luce Irigaray | 5 | 4 | 4 | 4 | 1 mineur | OK avec réserve |
| Ludwig Wittgenstein | 3 | 3 | 4 | 4 | 1 sérieux | **à reprendre** |
| Frantz Fanon | 3 | 4 | 4 | 4 | 2 sérieux | **à reprendre** |
| Simone de Beauvoir | 4 | 4 | 4 | 4 | 0 | Fiche saine |
| Saul Kripke | 5 | 4 | 4 | 4 | 0 | Fiche saine |
| Friedrich Nietzsche | 4 | 4 | 3 | 3 | 0 (fiche sensiblement plus mince) | OK avec réserve |
| **Moyenne** | **3,87** | **3,80** | **3,93** | **4,07** | — | — |

*(Les notes de « fidélité » ne portent que sur ce qui était vérifiable, c'est-à-dire la source secondaire — voir T1 : aucune fiche n'a pu être confrontée à sa source primaire.)*

---

## 3. Findings détaillés

### FINDING 1 — Jean-Paul Sartre — gravité **sérieux**
- **Citation fautive** (`these_centrale`) : *« l'être humain [...] est donc entièrement responsable de ce qu'il devient — "condamné à être libre" »*
- **Ce que dit réellement la source** : la fiche cite comme unique source primaire *L'Être et le Néant* (1943). Or l'aphorisme « l'homme est condamné à être libre » est spécifiquement associé à la conférence *L'existentialisme est un humanisme* (1945) — la page Wikipédia dédiée à cette conférence la présente explicitement comme l'une des « deux phrases » retenues de ce texte précis, distinct de *L'Être et le Néant*.
- **Correction proposée** : soit ajouter *L'existentialisme est un humanisme* comme source primaire réellement consultée, soit reformuler la thèse centrale sans citer entre guillemets une formule qui n'appartient pas à l'ouvrage cité.
- **Finding secondaire (mineur), même fiche** : `limites_critiques` télescope le compagnonnage avec le PCF (1952-1956) et le soutien maoïste (à partir de 1970) en un seul « soutien tardif à des régimes autoritaires (maoïsme, URSS) », en omettant que Sartre a rompu publiquement avec l'URSS dès 1956 après l'écrasement de l'insurrection de Budapest. L'omission n'est pas fausse mais nuit à la neutralité active (fait établi vs. simplification).

### FINDING 2 — Frantz Fanon — gravité **sérieux** (x2)
- **Citation fautive n°1** (`limites_critiques`) : *« Hannah Arendt la conteste frontalement dans Du mensonge à la violence »*
- **Ce que dit réellement la source** : l'article Wikipédia français sur Fanon, consulté intégralement (recherche ciblée sur « Arendt »), ne mentionne **à aucun endroit** Hannah Arendt, ni *Du mensonge à la violence*, ni *On Violence*. L'affirmation n'est donc appuyée par aucune des deux sources déclarées de la fiche (la primaire n'a pas d'URL, la secondaire ne la contient pas).
- **Correction proposée** : soit sourcer explicitement cette critique (ouvrage d'Arendt cité avec édition/page ou URL), soit la retirer si elle ne peut être adossée à une lecture réelle.
- **Citation fautive n°2** (`these_centrale`) : *« intériorisation du regard raciste, "épidermisation" de l'infériorité »*
- **Ce que dit réellement la source** : la fiche ne cite comme source primaire que *Les Damnés de la terre* (1961). Le concept d'« épidermisation » est classiquement rattaché à *Peau noire, masques blancs* (1952) — livre que l'`apport` mentionne bien par ailleurs, mais qui **n'apparaît pas** dans la liste des sources de la fiche. Ni la source primaire (absente d'URL) ni la source secondaire consultée (qui ne contient pas le mot « épidermisation ») ne permettent de confirmer ce rattachement depuis les sources réellement déclarées.
- **Correction proposée** : ajouter *Peau noire, masques blancs* comme source primaire si c'est elle qui fonde ce passage, ou vérifier/retirer le terme sinon.

### FINDING 3 — John Rawls — gravité **sérieux**
- **Citation fautive** (`limites_critiques`) : *« Critiqué par les libertariens (Nozick) [...] et par les communautariens (Sandel, MacIntyre) »*
- **Ce que dit réellement la source** : recherche ciblée sur « Nozick », « Sandel », « MacIntyre » dans l'intégralité de l'article Wikipédia français consacré à Rawls — **aucun des trois noms n'y apparaît**. L'article mentionne d'autres critiques (Amartya Sen, Francisco Vergara) totalement absentes de la fiche.
- **Note d'honnêteté** : ces critiques (Nozick, Sandel, MacIntyre) sont réelles et bien attestées dans la littérature de philosophie politique — l'erreur n'est pas d'exactitude factuelle mais de traçabilité : rien ne montre qu'elles proviennent de la source citée plutôt que de la mémoire générale de l'agent rédacteur, ce que la règle 1 interdit.
- **Correction proposée** : citer une source (primaire ou secondaire) qui traite effectivement de ces débats, ou a minima une URL renvoyant à un état de l'art académique sur les critiques de *Théorie de la justice*.

### FINDING 4 — Donna Haraway — gravité **sérieux**
- **Citation fautive** (`limites_critiques`) : *« des critiques féministes matérialistes lui reprochent de dissoudre la catégorie politique de "femme" dans un hybridisme trop généralisé »*
- **Ce que dit réellement la source** : l'article Wikipédia consulté rapporte une critique de **sens inverse** — ce sont certaines cyberféministes qui ont détourné Haraway en glorifiant le lien femme-machine et en **mettant à l'écart** ses dimensions féministe-socialiste et antiraciste ; l'article ne rapporte aucune critique matérialiste lui reprochant de dissoudre la catégorie « femme ». La fiche elle-même indique par ailleurs qu'Haraway défend une « politique des affinités » **contre** l'identité figée — ce qui rend la critique attribuée d'autant moins évidente sans source précise.
- **Correction proposée** : retirer cette phrase ou l'étayer avec une référence précise (auteur, ouvrage, année) réellement consultée.
- **Finding secondaire (mineur)** : la fiche partage la formule vague « jugé par certains » (voir constat T3) pour sa première critique (style « poétique-politique »), non attribuée nommément.

### FINDING 5 — Ludwig Wittgenstein — gravité **sérieux**
- **Citation fautive** (`apport`) : *« le Tractatus [...] fondateur[...] du positivisme logique »*, présenté sans réserve comme un fait établi.
- **Ce que dit réellement la source** : l'article Wikipédia précise que le Tractatus a bien *influencé* le Cercle de Vienne, mais que Wittgenstein lui-même considérait que les néopositivistes « commettaient de graves contresens sur la signification de sa pensée », et conclut explicitement que « le Tractatus n'a donc pas fondé intentionnellement le positivisme logique, même s'il l'a fortement influencé ».
- **Analyse** : c'est moins une erreur factuelle brute qu'une violation de la neutralité active (règle 2) — un point que la source elle-même présente comme contesté/nuancé est reformulé en fait plat, sans hedge ni mention du désaccord de Wittgenstein sur sa propre réception.
- **Correction proposée** : reformuler en « a fortement influencé le positivisme logique du Cercle de Vienne, bien que Wittgenstein ait lui-même récusé cette filiation ».

### Findings mineurs ponctuels (par fiche, non détaillés un par un pour éviter la sur-longueur)
- **Adorno** : critique d'« élitisme » non nommée (« jugée par certains » — cf. T3), non retrouvée dans la source secondaire consultée.
- **Popper** : « sa philosophie politique parfois vue comme sous-estimant les inégalités structurelles » — non retrouvé dans la source ; en outre en tension avec ce que dit l'article (Popper défend un social-libéralisme visant explicitement à protéger les plus faibles).
- **Nussbaum** : « accusée par certains théoriciens libéraux » — non nommé, non retrouvé dans la source.
- **Rancière** : « jugé par certains trop indifférencié » — non nommé, non retrouvé dans l'extrait consulté (l'article traite d'autres critiques, adressées par Rancière et non à lui).
- **David Chalmers** : l'`apport` présente le panpsychisme comme une thèse que Chalmers « défend » ; la source dit au contraire qu'il « maintient un agnosticisme formel » sur la question — nuance de degré, pas une erreur nette, mais un cran de trop dans l'affirmation. Critique de Dennett (« réifier le gap explicatif ») plausible mais non retrouvée telle quelle dans l'extrait consulté.

### Fiches saines (0 finding, hors constats transversaux T1/T2)
- **Martin Heidegger** : dates, année d'*Être et Temps*, adhésion au NSDAP (1933), rectorat de Fribourg (21 avril 1933 → démission 23 avril 1934), absence de repentir après-guerre — tout est confirmé précisément par la source. Fiche exemplaire sur un sujet sensible, sans dénigrement ni euphémisme.
- **Simone de Beauvoir** : date du *Deuxième Sexe* (1949) et citation exacte confirmées mot pour mot.
- **Saul Kripke** : dates très précises (1972 conférences / 1980 publication Harvard UP, 1982 pour l'ouvrage sur Wittgenstein) toutes confirmées — la fiche la plus rigoureuse de l'échantillon sur la chronologie.
- **Luce Irigaray** : le fait le plus spécifique de la fiche (perte de poste à Vincennes suite à *Speculum*) est confirmé mot pour mot par la source — bon niveau de vérifiabilité malgré la formule vague déjà signalée en T3.

### Fiche à part — Friedrich Nietzsche
Aucune erreur factuelle relevée, mais la fiche est nettement plus mince que le reste de l'échantillon (`apport` : 110 caractères contre 180-380 ailleurs), ne date pas les deux sources primaires qu'elle cite (*Ainsi parlait Zarathoustra*, *Généalogie de la morale*) alors que la source secondaire donne des éléments de datation précis, et porte une `derniere_verification` (2026-09-06) désynchronisée du reste de l'échantillon (2026-09-05). Pas un finding de contenu, mais un signal de traitement bâclé par rapport aux 14 autres fiches.

---

## 4. Fiches non vérifiables

Aucune. Les 15 URL de sources secondaires (toutes fr.wikipedia.org) ont été ouvertes avec succès via WebFetch, sans blocage proxy. La seule limite de vérifiabilité est structurelle (T1) : aucune source primaire n'a d'URL, donc aucune fiche n'a pu être confrontée à son texte primaire.

---

## 5. Conclusion chiffrée

**Décompte des findings par gravité** (hors constat T2, qui est un problème de forme et non de fond) :

| Gravité | Nombre | Détail |
|---|---|---|
| Bloquant | 1 (transversal) | T1 — absence d'URL sur 100 % des sources primaires (16 occurrences) |
| Sérieux | 6 | Sartre (1), Fanon (2), Rawls (1), Haraway (1), Wittgenstein (1) — répartis sur 5 fiches distinctes |
| Mineur | 15 | 9 findings ponctuels + T3 transversal (6 occurrences) |
| **Total** | **22** | |

**Notes moyennes sur l'échantillon (/5)** : fidélité à la source 3,87 · neutralité 3,80 · densité 3,93 · utilité 4,07.

**Taux de fiches à reprendre** :
- **5 / 15 (33 %)** portent au moins un finding *sérieux* nécessitant une correction de fond avant publication (Sartre, Fanon, Rawls, Haraway, Wittgenstein).
- **15 / 15 (100 %)** sont concernées par le problème transversal bloquant T1 (aucune URL sur les sources primaires) : un minimum de mise en conformité (ajout d'URL ou de référence vérifiable) est dû sur l'ensemble de l'échantillon, indépendamment de la qualité du contenu.
- **3 / 15 (20 %)** ressortent sans aucune réserve de contenu (Heidegger, Beauvoir, Kripke), ce qui montre que la production de qualité est possible avec le même processus — le problème n'est donc pas un plafond de capacité mais une absence de contrôle contradictoire en aval.

Si l'axe philosophique est représentatif des 512 fiches, l'ordre de grandeur à retenir est : **environ un tiers des fiches contient au moins une affirmation spécifique non traçable à la source citée**, et **la totalité du corpus** souffre d'un défaut structurel de traçabilité sur les sources primaires qui rend, en l'état, la règle 1 du projet (« rien de mémoire ») invérifiable de l'extérieur.


## Audit contradictoire — Axe social (échantillon de 15 fiches)

Auditeur : posture adverse, aucune modification du dépôt. Sources vérifiées une à une par récupération directe du contenu (WebFetch + lecture du wikicode brut via curl pour les vérifications littérales). Échantillon : `echantillon-social.json` (15 fiches, sous-domaines : modèle politique, économie, organisation internationale, gouvernance mondiale, management).

## 1. Tableau des notes (1 à 5)

| # | Fiche | Sous-domaine | Fidélité | Neutralité | Densité | Utilité | Statut |
|---|-------|--------------|:---:|:---:|:---:|:---:|---|
| 1 | Minilatéralisme et clubs (G7, G20) | gouvernance_mondiale | **1** | 4 | 4 | 2 | À reprendre (bloquant) |
| 2 | Gérard Debreu | economie | 3 | 4 | 4 | 4 | À corriger (mineur) |
| 3 | Gary Becker | economie | 5 | 5 | 4 | 5 | Conforme |
| 4 | Néolibéralisme étatique | modele_politique | 5 | 5 | 4 | 5 | Conforme (exemplaire) |
| 5 | Social-démocratie | modele_politique | 5 | 5 | 4 | 4 | Conforme (redite avec #12) |
| 6 | Union africaine (UA) / OUA | organisation_internationale | **2** | 4 | 4 | 4 | À reprendre (sérieux) |
| 7 | Paul Samuelson | economie | 3 | 4 | 4 | 4 | À reprendre (sérieux) |
| 8 | Monarchie absolue | modele_politique | 3 | 4 | 4 | 4 | À corriger (mineur) |
| 9 | Économie planifiée (modèle soviétique) | economie | **2** | **2** | 4 | 3 | À reprendre (sérieux) |
| 10 | Bipolarité (Guerre froide) | gouvernance_mondiale | 5 | 5 | 4 | 5 | Conforme |
| 11 | Modèle des 7S (McKinsey) | management | **2** | 4 | 4 | 4 | À reprendre (sérieux) |
| 12 | Économie de marché régulée (social-démocratie) | economie | 3 | 3 | 4 | 3 | À reprendre (sérieux — étiquetage) |
| 13 | Amartya Sen | economie | 5 | 5 | 4 | 5 | Conforme |
| 14 | James A. Robinson | economie | **1** | 4 | 4 | 3 | À reprendre (sérieux) |
| 15 | ASEAN | organisation_internationale | 3 | 4 | 4 | 4 | À reprendre (sérieux) |

**Moyennes sur l'échantillon** : Fidélité **3,2/5** · Neutralité **4,1/5** · Densité **4,0/5** · Utilité **3,9/5**.

Fiches sans aucun défaut relevé : #3 (Becker), #4 (Néolibéralisme), #10 (Bipolarité), #13 (Amartya Sen) — 4/15. Fiche #5 (Social-démocratie) est propre sur le fond mais impliquée dans une redite.

## 2. Findings détaillés

### F1 — [BLOQUANT] Minilatéralisme (G7/G20) : sujet non couvert par la source citée
**Fiche** : `minilateralisme-et-clubs-g7-g20`
**Citation fautive (fiche)** : *« Le minilatéralisme part du principe qu'un petit groupe de pays clés (club restreint comme le G7 ou le G20) peut coordonner plus efficacement des réponses à des enjeux mondiaux... »* ; apport : *« ...crises majeures (crise financière de 2008 via le G20)... »* ; résonance IA : *« Le G7 (Processus d'Hiroshima) et le G20 sont devenus des lieux privilégiés... »*
**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Gouvernance_mondiale`, seule source primaire ET secondaire de la fiche — doublon de type) : la page ne mentionne **ni le G7, ni le G20, ni le mot « minilatéralisme »**. La crise de 2008 n'apparaît qu'en une phrase incidente (« Face à la crise financière de 2008, aux problèmes climatiques... ») sans aucun développement sur le G20. Le « Processus d'Hiroshima » est absent.
**Gravité** : bloquant — c'est le sujet entier de la fiche qui repose sur une source qui n'en parle pas.
**Correction proposée** : sourcer sur une page traitant réellement du G7/G20/minilatéralisme (article Wikipédia « G20 », rapport IFRI/CFR/Brookings sur le minilatéralisme), ou retirer la fiche en attendant.

### F2 — [SÉRIEUX] Économie planifiée : faits inventés + neutralité (thèse causale univoque)
**Fiche** : `economie-planifiee-modele-sovietique`
**Citation fautive** : *« Elle a permis une industrialisation rapide et une mobilisation massive de ressources vers des priorités stratégiques définies par l'État, notamment lors de l'effort de guerre et de la course spatiale soviétiques. »* et *« ...ce qui a largement contribué à l'inefficacité chronique et à l'effondrement final du système soviétique. »*
**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Économie_planifiée`) : aucune mention de la « course spatiale » ni de l'« effort de guerre ». Le seul passage sur l'industrialisation soviétique cité dans l'article (une citation de Trotsky, 1933) est au contraire **critique** : « L'industrialisation exagérée et disproportionnée a miné les fondations de l'économie agricole. » Rien dans la source ne relie explicitement le calcul économique de Mises à l'« effondrement final » de l'URSS — c'est une extrapolation de la fiche.
**Neutralité** : la thèse de Mises (calcul économique impossible) est présentée comme l'explication de l'effondrement soviétique sans mention des explications concurrentes (course aux armements, chute du prix du pétrole, réformes de Gorbatchev), ce qui tranche un débat historiographique contesté.
**Correction proposée** : retirer « effort de guerre » et « course spatiale » (non sourcés) ; reformuler la conclusion pour signaler que le rôle causal du calcul économique dans l'effondrement de l'URSS est une thèse (école autrichienne), pas un fait établi.

### F3 — [SÉRIEUX] James A. Robinson : thèse et critique absentes de la source, source primaire invérifiable
**Fiche** : `james-a-robinson`
**Citation fautive** : thèse centrale entière — *« ...défend avec Daron Acemoglu la thèse selon laquelle ce sont les institutions politiques inclusives, garantissant la propriété privée et l'État de droit, qui permettent la prospérité économique... »* — et limites_critiques entière — *« Sa thèse est critiquée pour minimiser le rôle de facteurs comme la géographie, les ressources naturelles ou les héritages coloniaux spécifiques... »*
**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/James_A._Robinson`) : article-ébauche (« {{ébauche}} ») de 4 phrases utiles. Il dit seulement qu'il est co-lauréat du Nobel 2024 « pour leurs travaux sur la manière dont les institutions se forment et affectent la prospérité » — aucune mention d'« institutions inclusives », de « propriété privée », d'« État de droit », ni d'aucune critique de la thèse.
La source primaire déclarée, *« Why Nations Fail (Acemoglu & Robinson, 2012) »*, **n'a pas d'URL** dans la fiche — invérifiable telle quelle.
**Correction proposée** : sourcer thèse et critique sur une page qui documente réellement le contenu du livre, ou fournir une référence précise et consultable de l'ouvrage ; sinon retirer les affirmations non vérifiées.

### F4 — [SÉRIEUX] Modèle des 7S (McKinsey) : critique intégralement inventée
**Fiche** : `modele-des-7s-mckinsey`
**Citation fautive** : *« Le modèle est critiqué pour sa nature essentiellement descriptive et statique... et pour son origine issue du conseil en stratégie plutôt que d'une recherche académique indépendante. »*
**Ce que dit réellement la source** (`en.wikipedia.org/wiki/McKinsey_7S_Framework`, article de 68 lignes) : aucune section de critique n'existe. L'article précise même que deux des quatre créateurs, Tony Athos et Richard Pascale, étaient des universitaires (« both academics »), ce qui contredit le cadrage « issu du conseil plutôt que de la recherche académique » avancé par la fiche.
**Correction proposée** : retirer cette critique ou la sourcer sur une publication académique de management qui la formule effectivement.

### F5 — [SÉRIEUX] Union africaine : fait absent de la source
**Fiche** : `union-africaine-ua-oua`
**Citation fautive** : *« ...une architecture de sécurité continentale et l'Agenda 2063 de développement... »*
**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Union_africaine`) : aucune occurrence de « Agenda 2063 » dans tout l'article (vérifié par recherche exhaustive dans le texte source).
**Correction proposée** : retirer la mention ou la sourcer sur la page dédiée / le site officiel de l'UA (au.int).

### F6 — [SÉRIEUX] Paul Samuelson : critique post-stagflation non sourcée
**Fiche** : `paul-samuelson`
**Citation fautive** : *« La synthèse néoclassique a été critiquée, notamment après la stagflation des années 1970, pour son incapacité à expliquer la coexistence d'inflation et de chômage élevés, ouvrant la voie aux critiques monétaristes et nouvelles classiques. »*
**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Paul_Samuelson`) : le mot « stagflation » n'apparaît nulle part dans l'article ; aucune critique de ce type n'y figure.
**Correction proposée** : sourcer sur une page traitant spécifiquement de la synthèse néoclassique et de son déclin dans les années 1970, ou retirer le passage.

### F7 — [SÉRIEUX] Économie de marché régulée (« social-démocratie ») : étiquetage trompeur / confusion de courants
**Fiche** : `economie-de-marche-regulee-social-democratie`
**Citation fautive** : titre de la fiche *« Économie de marché régulée (social-démocratie) »* et thèse centrale présentant le modèle allemand comme incarnation de la social-démocratie.
**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Économie_sociale_de_marché`) : *« Elle a été développée et mise en place en Allemagne de l'Ouest par l'Union chrétienne-démocrate, sous la direction du chancelier Konrad Adenauer... Elle est fortement inspirée par l'ordolibéralisme, les idées de la social-démocratie et la doctrine sociale de l'Église catholique. »* La social-démocratie n'est qu'une inspiration parmi trois ; le modèle est porté et institué par la démocratie-chrétienne (CDU), pas par un parti social-démocrate — deux familles politiques distinctes et historiquement concurrentes en Allemagne.
**Gravité** : sérieux — sur l'axe social, c'est précisément le type d'amalgame entre courants politiques contestés que la règle de neutralité active demande d'éviter.
**Correction proposée** : renommer la fiche (ex. « Économie sociale de marché (ordolibéralisme) ») et corriger la thèse centrale pour distinguer clairement ordolibéralisme chrétien-démocrate et social-démocratie.

### F8 — [MINEUR] Monarchie absolue : conflation de deux passages de la source
**Fiche** : `monarchie-absolue`
**Citation fautive** : *« ...dont Louis XIV en France et Frédéric II de Prusse restent les figures les plus représentatives. »*
**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Absolutisme`, redirection depuis « Monarchie absolue ») : *« Au XVIIIe siècle, les monarques les plus représentatifs du pouvoir absolu sont Charles III d'Espagne (1716-1788)... et Frédéric II de Prusse (1712-1786) ».* C'est donc Charles III d'Espagne, pas Louis XIV, que la source associe à Frédéric II dans cette phrase précise. Louis XIV est par ailleurs bien décrit ailleurs dans le même article comme « le modèle des souverains absolus », mais dans un passage distinct consacré au XVIIe siècle français.
**Correction proposée** : ne pas fusionner les deux phrases de la source ; soit garder Louis XIV seul pour le XVIIe siècle, soit citer le duo réel de la source (Charles III d'Espagne / Frédéric II) pour le XVIIIe.

### F9 — [SÉRIEUX] ASEAN : fait daté absent de la source
**Fiche** : `asean`
**Citation fautive** : *« ...son principe strict de non-ingérence... l'a rendue largement impuissante face à des crises internes majeures, notamment la répression militaire en Birmanie depuis le coup d'État de 2021. »*
**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Association_des_nations_de_l'Asie_du_Sud-Est`) : aucune mention du coup d'État de 2021 ni de la répression birmane consécutive dans le texte consulté (vérifié par recherche exhaustive).
**Correction proposée** : sourcer sur un article couvrant spécifiquement la crise birmane 2021 et la réponse de l'ASEAN, ou généraliser sans la date/l'événement précis.

### F10 — [MINEUR] Gérard Debreu : critique générique non sourcée, critique réellement disponible ignorée
**Fiche** : `gerard-debreu`
**Citation fautive** : *« Le modèle... repose sur des hypothèses très restrictives (information parfaite, marchés complets) rarement vérifiées empiriquement... »*
**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Gérard_Debreu`) : cette formulation n'y figure pas. La source contient en revanche une critique sourcée bien plus incisive, ignorée par la fiche : une citation de **Maurice Allais** (prix Nobel 1988) — *« La construction de Debreu n'a aucune valeur scientifique, tant elle est totalement étrangère au monde de l'expérience. »*
**Correction proposée** : remplacer la critique générique par la citation d'Allais, effectivement présente et attribuée dans la source.

### F11 — [MINEUR] Redite entre fiches
**Fiches concernées** : `social-democratie` (#5) et `economie-de-marche-regulee-social-democratie` (#12).
Les deux fiches couvrent un contenu largement superposable (État-providence, articulation marché/redistribution, tension avec la mondialisation) et, du fait de l'étiquetage erroné signalé en F7, sont présentées comme un seul et même courant alors que le corpus documente deux traditions politiques distinctes (social-démocratie nordique/européenne vs ordolibéralisme allemand porté par la démocratie-chrétienne).
**Correction proposée** : clarifier la distinction dans les deux fiches et les faire se référencer mutuellement plutôt que se chevaucher.

## 3. Fiches non vérifiables

- **James A. Robinson** (#14) : la source primaire *« Why Nations Fail (Acemoglu & Robinson, 2012) »* est citée sans URL — impossible de vérifier qu'elle a été réellement consultée (cf. F3).

Aucune autre fiche de l'échantillon ne comportait de source techniquement inaccessible (aucun domaine bloqué par le proxy rencontré) ; toutes les autres URL ont été récupérées et lues intégralement.

## 4. Vérification anti-homonymie

Aucun cas d'homonymie du type « Junte »/« OMC » détecté dans cet échantillon : toutes les URL Wikipédia pointaient vers l'article correspondant au bon sujet (y compris « Monarchie absolue », qui redirige vers « Absolutisme » — redirection légitime, contenu conforme).

## 5. Conclusion chiffrée

- **15 fiches auditées**, 4 URL par sources ouvertes et lues en intégralité (aucune source inaccessible).
- **11 findings** retenus : **1 bloquant**, **7 sérieux**, **3 mineurs**.
- **8 fiches sur 15 (53 %)** comportent au moins un finding sérieux ou bloquant et doivent être reprises : Minilatéralisme G7/G20, Union africaine, Paul Samuelson, Économie planifiée, Modèle des 7S, Économie de marché régulée, James A. Robinson, ASEAN.
- **2 fiches supplémentaires (13 %)** appellent une correction mineure (Gérard Debreu, Monarchie absolue).
- Seules **4 fiches (27 %)** ne présentent aucun défaut relevé (Gary Becker, Néolibéralisme étatique, Bipolarité/Guerre froide, Amartya Sen).
- **Taux global de fiches à reprendre ou corriger : 10/15 (67 %)**, dont **53 % à un niveau sérieux/bloquant**.

Le défaut dominant sur cet échantillon n'est pas la neutralité (les jugements de valeur explicites sont rares et souvent bien attribués — Stiglitz, Bourdieu, Scruton, Allais quand elle est citée) mais la **fidélité à la source** : un schéma récurrent de champs « limites_critiques » ou « apport » remplis avec des connaissances générales plausibles mais absentes du document cité (stagflation de Samuelson, hypothèses de Debreu, critique du 7S, industrialisation/course spatiale soviétique, thèse Acemoglu-Robinson, Agenda 2063 de l'UA, coup d'État birman de 2021 pour l'ASEAN). Cela suggère que plusieurs agents ont rédigé ces champs de mémoire avant, ou sans, relire attentivement la source déjà citée pour les autres champs de la même fiche — exactement le risque que la règle 1 est censée exclure.


## Audit contradictoire — Axe Évolution (sciences, découvertes, institutions)
Échantillon : 15 fiches — `echantillon-evolution.json`
Méthode : lecture intégrale de chaque fiche + WebFetch de chaque source secondaire citée (Wikipédia FR), comparaison ligne à ligne. Aucun fichier du dépôt n'a été modifié. Aucun domaine n'a été bloqué par le proxy — les 15 sources secondaires ont été consultées avec succès.

**Remarque structurelle transversale** : sur les 15 fiches, la source « primaire » n'est jamais accompagnée d'une URL (seulement un titre : article original, décret, thèse...). Elle est donc, par construction, invérifiable en l'état pour un auditeur externe — c'est un problème de traçabilité qui concerne l'intégralité de l'échantillon, pas une fiche en particulier.

---

## 1. Tableau des 15 fiches et notes (/5)

| Fiche | Fidélité source | Neutralité | Densité | Utilité | Constat principal |
|---|---|---|---|---|---|
| Modèle de Bohr | 4 | 5 | 4 | 4 | Fiche solide ; un détail non sourcé (Schrödinger 1926) |
| Vaccins ARNm | 5 | 5 | 4 | 5 | Fiche la plus fidèle de l'échantillon |
| Richard Feynman | 3 | 4 | 4 | 4 | Surattribution sur Challenger |
| ESA | 5 | 5 | 4 | 4 | Fiche solide, tous les chiffres confirmés |
| James Watson | 3 | 5 | 4 | 4 | Bonne neutralité sur le racisme, mais erreur de datation |
| Boson de Higgs | 5 | 5 | 4 | 4 | Fiche solide, aucun problème relevé |
| Emmanuelle Charpentier | 2 | 3 | 4 | 3 | « A fondé » alors que la source dit « dirige » |
| Marie Curie | 5 | 5 | 4 | 4 | Fiche solide, aucun problème relevé |
| Jennifer Doudna | 3 | 4 | 4 | 4 | Majorité des faits de « apport »/« limites » absents de la source citée |
| Informatique quantique | 3 | 4 | 4 | 4 | Date de l'algorithme de Grover en désaccord avec la source |
| Laboratoire Cavendish | 2 | 4 | 3 | 3 | Nombre de Nobel erroné (30 vs 29) ; localisation Watson/Crick douteuse |
| Alan Turing | 3 | 5 | 4 | 4 | « A dirigé » Bletchley Park contredit la source |
| Deep learning | 2 | 4 | 4 | 3 | Quasi-totalité des faits techniques absents de la source citée |
| CNRS | 2 | 4 | 3 | 3 | Confond classement de visibilité web et rang par nombre de chercheurs |
| Jane Goodall | 2 | 4 | 4 | 3 | Citation attribuée à Goodall alors qu'elle est de Louis Leakey |
| **Moyenne** | **3,27** | **4,40** | **3,87** | **3,73** | |

---

## 2. Findings détaillés

### 🔴 Bloquant

**Jane Goodall — citation faussement attribuée**
- Citation fautive (fiche, champ `apport`) : *« A radicalement changé la définition scientifique de l'être humain (« nous devons désormais redéfinir l'outil, redéfinir l'homme, ou accepter que les chimpanzés sont des hommes ») »*
- Ce que dit la source : la page Wikipédia attribue explicitement cette phrase à **Louis Leakey**, mentor de Goodall, et non à Goodall elle-même : *« Maintenant, nous devons redéfinir la notion d'homme, la notion d'outil, ou alors accepter le chimpanzé comme humain »* (attribué à Leakey).
- Correction proposée : soit citer la phrase en l'attribuant nommément à Leakey commentant les travaux de Goodall, soit la retirer et reformuler l'apport sans guillemets usurpés. C'est exactement le type d'erreur d'attribution (qui a dit/découvert quoi) que l'axe évolution est censé surveiller en priorité.

### 🟠 Sérieux

**Emmanuelle Charpentier — « a fondé » vs « dirige »**
- Citation fautive (champ `apport`) : *« a fondé plusieurs instituts de recherche indépendants en Europe (dont l'Unité Max Planck pour la science des pathogènes à Berlin) »*
- Ce que dit la source : Charpentier est *« directrice de l'institut Max-Planck de biologie des infections à Berlin »* (depuis 2015) et *« directrice du Centre de recherche Max Planck pour la science des pathogènes »* (depuis 2018) — des instituts du réseau Max-Planck préexistant, pas des créations personnelles. Le nom cité (« Unité Max Planck pour la science des pathogènes ») diffère en plus du nom réel (« Centre de recherche Max Planck pour la science des pathogènes »).
- Correction proposée : remplacer « a fondé » par « dirige » et corriger l'intitulé exact de l'institut.

**CNRS — classement confondu**
- Citation fautive (champ `apport`) : *« Plus grand organisme de recherche public d'Europe par le nombre de chercheurs »*
- Ce que dit la source : le CNRS est décrit comme *« le plus grand organisme public français de recherche scientifique »*, avec une *« première place au niveau européen »* obtenue via le classement **Webometrics**, qui mesure la **visibilité web**, pas le nombre de chercheurs.
- Correction proposée : soit sourcer un vrai classement par effectifs (Eurostat, OCDE), soit reformuler en « premier organisme de recherche selon le classement de visibilité web Webometrics ».

**Laboratoire Cavendish — chiffre inventé sur les Nobel**
- Citation fautive (champ `apport`) : *« 30 lauréats du prix Nobel y ont travaillé au fil de son histoire »*
- Ce que dit la source : *« En 2005, 29 chercheurs du laboratoire avaient gagné un prix Nobel »* — un chiffre différent (29, pas 30) et daté (2005, pas « au fil de son histoire » présenté comme un décompte à jour).
- Correction proposée : reprendre le chiffre exact de la source (29 en 2005) ou sourcer un chiffre plus récent explicitement daté.

**Laboratoire Cavendish — localisation Watson/Crick**
- Citation fautive (champ `apport`) : *« structure de l'ADN par Watson et Crick (1953, dans un laboratoire associé) »*
- Ce que dit la source : la page Cavendish situe elle-même la découverte de 1953 dans sa propre section, sans évoquer de « laboratoire associé » distinct — Watson et Crick travaillaient au Cavendish même (Cambridge), Rosalind Franklin étant, elle, au King's College de Londres (un laboratoire distinct, mais ce n'est pas ce que la fiche laisse entendre).
- Correction proposée : vérifier avec une source dédiée à Watson/Crick si la parenthèse « laboratoire associé » vise Franklin/King's College ; en l'état elle induit en erreur sur le lieu de la découverte elle-même.

**Alan Turing — « a dirigé » Bletchley Park**
- Citation fautive (champ `apport`) : *« A dirigé le déchiffrement du code Enigma allemand à Bletchley Park »*
- Ce que dit la source : Turing a été *« le facteur le plus important du succès de la Hut 8 »* selon un contemporain, mais *« n'ayant pas d'intérêt pour la direction »*, c'est son adjoint **Hugh Alexander** qui *« devint officiellement directeur »*.
- Correction proposée : remplacer « a dirigé » par une formule du type « a joué un rôle scientifique déterminant dans » ou « a été la figure centrale de ».

**Richard Feynman — surattribution sur Challenger**
- Citation fautive (champ `apport`) : *« a également identifié la cause de l'explosion de la navette Challenger (1986) »*
- Ce que dit la source : Feynman *« démontra à la télévision le rôle crucial joué par les joints des boosters »*, dans le cadre de la commission Rogers, une enquête collective ; la source ne dit pas qu'il a « identifié » seul la cause.
- Correction proposée : « a démontré publiquement, au sein de la commission d'enquête, le rôle des joints toriques dans l'explosion ».

**James Watson — erreur de datation sur les propos racistes**
- Citation fautive (champ `limites_critiques`) : *« a par ailleurs tenu dans les années 2000-2010 des propos publics ouvertement racistes sur l'intelligence, qui lui ont fait perdre ses titres honorifiques »*
- Ce que dit la source : deux épisodes distincts et datés — **2007** (propos au Sunday Times, suspension et mise à la retraite) et **2019** (documentaire, révocation des titres honorifiques). La perte des titres honorifiques date de 2019, hors de la fourchette « 2000-2010 » indiquée.
- Correction proposée : « en 2007 puis en 2019 » plutôt que « dans les années 2000-2010 », et préciser que seul l'épisode de 2019 a entraîné la révocation des titres honorifiques.

**Informatique quantique — date de l'algorithme de Grover**
- Citation fautive (champ `apport`) : *« recherche non structurée (Grover, 1996) »*
- Ce que dit la source citée : *« En 1995, Lov Grover propose un algorithme »* — soit un an d'écart avec la fiche.
- Correction proposée : trancher avec la publication originale (STOC 1996) et aligner fiche et source citée sur une seule date sourcée ; en l'état, fiche et source se contredisent, indépendamment de qui a raison sur le fond.

**Deep learning — contenu majoritairement invérifiable via la source citée**
- Constat : la quasi-totalité des faits factuels de la fiche (AlexNet et 2012, l'article Nature 2015 de LeCun/Bengio/Hinton, rétropropagation, transformers, problème de « boîte noire », coûts énergétiques) sont **absents** de la page Wikipédia FR « Apprentissage profond » citée comme source secondaire.
- Correction proposée : soit citer une source qui couvre effectivement ces éléments (l'article Nature lui-même, une page plus technique), soit retirer les affirmations non couvertes.

### 🟡 Mineur

- **Bohr** : la date « équation de Schrödinger, 1926 » (champ `apport`) est correcte sur le fond mais absente de la source citée, qui ne mentionne que « 1925 » pour l'abandon du modèle.
- **Feynman** : la conférence « Simulating Physics with Computers » est datée 1981 dans la fiche Feynman (`resonance_ia`) mais 1982 dans la source citée par la fiche « Informatique quantique » — incohérence de datation entre deux fiches du même échantillon sur le même événement, non tranchée nulle part.
- **Charpentier** : la « dispute de priorité scientifique et de brevets » avec Feng Zhang (champ `limites_critiques`) est un fait réel et notoire, mais absent de la source Wikipédia FR citée — traçabilité non assurée par la source retenue.
- **Doudna** : le qualificatif « premier prix Nobel scientifique attribué à un duo exclusivement féminin » (champ `apport`), ainsi que les tests diagnostiques Covid et l'affaire He Jiankui (champ `limites_critiques`), sont absents de la source citée.
- **Jane Goodall** : « plus de soixante ans d'observation continue » (champ `these_centrale`) et les critiques méthodologiques sur le nourrissage artificiel/l'attribution de noms (champ `limites_critiques`) ne sont pas confirmés par la source citée.
- **Informatique quantique** : la « suprématie quantique » de Google depuis 2019 et le lien avec l'apprentissage automatique quantique (champs `apport`/`resonance_ia`) ne sont pas développés dans la source citée (seulement une référence en lien externe, non exploitée).

---

## 3. Redites entre fiches de l'échantillon

- Aucune duplication de texte verbatim entre fiches.
- **Incohérence croisée** relevée : la date de la conférence de Feynman « Simulating Physics with Computers » diverge entre la fiche Feynman (1981) et la source citée par la fiche Informatique quantique (1982), sans que l'une ou l'autre ne signale l'écart.
- **Gabarit répétitif** sur les trois fiches d'institutions de l'échantillon (CNRS, ESA, Cavendish) : structure quasi identique (date de fondation → réalisations phares → critique budgétaire/administrative), ce qui n'est pas fautif en soi mais témoigne d'une production probablement très gabarisée plutôt que d'une recherche indépendante par institution — cohérent avec le risque de production en série signalé dans le contexte de l'audit.
- Les fiches Charpentier et Doudna se recoupent logiquement (mêmes co-lauréates du Nobel 2020) sans duplication abusive — traitement complémentaire correct.

---

## 4. Fiches non vérifiables ou partiellement non vérifiables

- **Toutes les sources primaires (15/15)** : citées par titre seul, sans URL — invérifiables en l'état pour un auditeur externe.
- **Deep learning** : la quasi-totalité du contenu factuel technique est absente de la source secondaire citée.
- **Doudna** : plus de la moitié des affirmations des champs `apport`/`limites_critiques` absentes de la source citée.
- **Informatique quantique** : les affirmations sur la suprématie quantique et l'apprentissage automatique quantique ne sont pas couvertes par la source citée.
- **Jane Goodall** : la durée exacte des observations et les critiques méthodologiques ne sont pas couvertes par la source citée.
- Aucun domaine n'a été bloqué par le proxy — l'ensemble des 15 sources secondaires (toutes des URL Wikipédia FR) a pu être consulté.

---

## 5. Conclusion chiffrée

- **Notes moyennes (/5)** : fidélité à la source **3,27** · neutralité **4,40** · densité **3,87** · utilité **3,73**
- **Findings** : 1 bloquant · 8 sérieux · 8 mineurs (17 findings au total)
- **Fiches à reprendre** (≥ 1 finding sérieux ou bloquant) : **10 / 15 = 67 %**
- **Fiches sans problème notable** : Vaccins ARNm, ESA, Boson de Higgs, Marie Curie (4/15 = 27 %), plus Bohr avec une seule réserve mineure (5/15 = 33 % à un détail près).

**Constat global** : la neutralité de ton est globalement bonne (4,40/5) — les rédacteurs évitent la survalorisation ouverte de l'IA et gèrent avec justesse les sujets sensibles (racisme de Watson, persécution de Turing). Le point de rupture est la **fidélité à la source citée** (3,27/5, la plus basse des quatre notes) : sur un axe explicitement identifié comme le plus exposé au risque du chiffre inventé, on trouve un chiffre de lauréats Nobel erroné (Cavendish, 30 vs 29), une date d'algorithme en désaccord avec la source (Grover, 1996 vs 1995), une erreur de datation sur un fait biographique sensible (Watson), une confusion entre deux classements de nature différente (CNRS), une survalorisation d'un rôle (Charpentier « fondatrice » vs « directrice », Turing « a dirigé » vs « facteur le plus important ») et surtout une citation directement mal attribuée (Goodall/Leakey) — soit exactement le type d'erreur d'attribution de découverte que la mission demandait de traquer en priorité.


## Audit contradictoire — échantillons IA et Psychologie/Sérénité

**Corpus audité :** projet Atlas Humain × IA (512 fiches, production accélérée, aucun audit contradictoire préalable).
**Méthode :** tirage aléatoire fourni (15 fiches IA, 9 fiches psycho/sérénité), vérification de chaque source via consultation directe de l'URL citée (WebFetch), comparaison mot à mot entre le contenu de la fiche et le contenu réel de la source. Aucune correction appliquée aux fiches — audit uniquement.
**Sources bloquées par le proxy :** aucune rencontrée dans cet échantillon (tous les domaines Wikipedia FR/EN ont répondu).

---

## 1. Échantillon IA (15 fiches)

### 1.1 Tableau des notes (/5)

| Fiche | Fidélité source | Neutralité | Densité | Utilité |
|---|---|---|---|---|
| rnn | 3 | 4 | 4 | 4 |
| gan | 4 | 4 | 4 | 4 |
| aide-a-la-decision-publique-govtech-ia | 2 | 4 | 4 | 3 |
| yolo | 2 | 4 | 3 | 3 |
| transformers | 4 | 4 | 4 | 5 |
| frameworks-multi-agents (LangGraph/CrewAI/AutoGen) | 2 | 4 | 4 | 3 |
| ia-en-modelisation-climatique-type-graphcast | 2 | 4 | 4 | 3 |
| cnn | 2 | 4 | 4 | 3 |
| arbres-de-decision | 3 | 4 | 4 | 4 |
| llama | 4 | 4 | 4 | 4 |
| alphafold-deepmind | 4 | 4 | 4 | 5 |
| regression-logistique | 4 | 4 | 4 | 4 |
| deepseek | 3 | 4 | 4 | 3 |
| ia-en-genomique-et-drug-discovery | 3 | 4 | 3 | 3 |
| bert | 5 | 4 | 4 | 5 |
| **Moyenne** | **3.1** | **4.0** | **3.9** | **3.7** |

### 1.2 Findings

**F1 — [sérieux] aide-a-la-decision-publique-govtech-ia — TRL en contradiction avec les propres limites de la fiche**
Citation fautive : `usages[0].trl = 6`, description « Ciblage de contrôles et allocation de ressources publiques limitées à partir de modèles de risque ».
Ce que dit réellement la source (*Government by algorithm*, Wikipedia EN) : SyRI (Pays-Bas) « quietly flagged thousands of people to investigators » avant d'être fermé par la justice, et l'algorithme britannique de notation des A-levels (2020) « employed a statistical calculus to assign final grades » à l'échelle nationale. Ce sont des systèmes **pleinement déployés en production**, pas des prototypes en environnement opérationnel.
Correction proposée : TRL 9 pour ces usages historiques (un système annulé après déploiement complet reste TRL 9 sur l'échelle de maturité ; l'annulation est un motif juridique/éthique, non une preuve d'immaturité technique). La fiche elle-même documente ce déploiement complet dans son propre champ `limites_connues` — l'incohérence est interne à la fiche.

**F2 — [bloquant, transversal] Sources « primaires » sans URL vérifiable (violation de la règle de traçabilité)**
6 des 15 fiches de l'échantillon (40 %) citent au moins une source typée `"primaire"` sans URL, avec des intitulés génériques impossibles à retrouver :
- `aide-a-la-decision-publique-govtech-ia` : « Systèmes d'aide à la décision publique par IA — documentation GovTech »
- `frameworks-multi-agents-...` : « LangChain, CrewAI, AutoGen — documentation des projets »
- `ia-en-modelisation-climatique-type-graphcast` : « GraphCast (Google DeepMind, publié dans Science, 2023) »
- `alphafold-deepmind` : « Jumper et al., Nature 2021 » et « Prix Nobel de chimie 2024 »
- `deepseek` : « DeepSeek-V3 Technical Report » et « DeepSeek-R1 : ... »
- `ia-en-genomique-et-drug-discovery` : « AlphaFold — impact sur la recherche pharmaceutique » (titre qui ne correspond à aucune publication identifiable)
Correction proposée : soit fournir l'URL réelle (arXiv, Nature, blog officiel DeepMind, communiqué Nobel), soit rétrograder ces sources en `"secondaire"` avec mention explicite « source non localisée », conformément à la règle 3.

**F3 — [sérieux] yolo — exemples et limites non attestés par l'unique source citée**
Citation fautive : exemples « Vidéosurveillance intelligente en temps réel », « Comptage et suivi d'objets sur chaîne de production », « Détection de véhicules et comptage de trafic routier », limite « moins précis... sur la détection de très petits objets... comparé à Faster R-CNN ».
Ce que dit réellement la source (Wikipedia EN *You Only Look Once*) : uniquement l'historique architectural (v1 à v8+) et le principe « one forward propagation pass ». Aucune mention d'un déploiement réel en vidéosurveillance, trafic ou sécurité urbaine, ni de comparaison avec Faster R-CNN.
Correction proposée : ajouter une source spécifique documentant ces déploiements (études de cas municipales, documentation Ultralytics) ou reformuler ces exemples comme des « usages plausibles génériques » plutôt que des cas réels.

**F4 — [sérieux] cnn — usages sectoriels non attestés par la source citée**
Citation fautive : « Détection de tumeurs sur imagerie radiologique (IRM, scanner) », « Contrôle qualité visuel automatisé en usine », « Perception visuelle des véhicules autonomes ».
Ce que dit réellement la source (Wikipedia FR *Réseau neuronal convolutif*) : seulement « larges applications dans la reconnaissance d'image et vidéo, les systèmes de recommandation et le traitement du langage naturel » — aucun de ces trois cas nommément. La vulnérabilité aux perturbations adversariales, citée en `limites_connues`, est également absente de la source.
Correction proposée : citer une source dédiée à l'imagerie médicale par CNN (ex. publication FDA/radiologie) plutôt que l'article général.

**F5 — [mineur] arbres-de-decision — exemples sectoriels non attestés**
Les usages « éligibilité aux aides sociales », « segmentation marketing », « diagnostic de pannes » sont absents de la source (Wikipedia FR), qui reste méthodologique. Le cœur technique (surapprentissage, instabilité, ID3/C4.5/CART) est en revanche bien confirmé — fiche solide sur le fond, faible sur la traçabilité des exemples.

**F6 — [sérieux] frameworks-multi-agents-langgraph-crewai-autogen — attribution d'éditeurs et usages non vérifiables**
La seule source avec URL (Wikipedia EN *LangChain*) « ne mentionne pas CrewAI ni AutoGen » et ne documente « aucune implémentation métier concrète en production ». Les éditeurs annoncés (« CrewAI Inc. », « Microsoft Research (AutoGen) ») et les usages TRL 6 reposent donc uniquement sur une source primaire sans URL (cf. F2).
Correction proposée : citer les dépôts GitHub officiels ou la documentation CrewAI/Microsoft AutoGen avec URL réelle.

**F7 — [sérieux] ia-en-modelisation-climatique-type-graphcast — confusion possible GraphCast / GenCast**
La source secondaire citée (Wikipedia EN *Weather forecasting*) ne mentionne **jamais** « GraphCast » mais uniquement « **GenCast** », un modèle DeepMind distinct (probabiliste, publié 2024), ainsi que Pangu-Weather, FourCastNet et l'AIFS de l'ECMWF. La source primaire annoncée (GraphCast, *Science*, 2023) n'a pas d'URL et n'a pas pu être vérifiée directement dans cet audit.
Correction proposée : vérifier si la fiche décrit bien GraphCast (Lam et al., *Science*, déc. 2023) et non GenCast, et ajouter l'URL de la publication réelle.

**F8 — [bloquant] therapies-cognitivo-comportementales-tcc — affirmation d'efficacité clinique non attribuée (voir section psycho, détaillée ci-dessous)**

**F9 — [mineur] rnn — TRL incohérent avec le statut historique décrit**
TRL 7 attribué à des usages présentés comme « avant la généralisation des Transformers » (reconnaissance vocale, traduction). Or les systèmes de traduction neuronale à base de RNN/LSTM (ex. Google Neural Machine Translation, 2016-2017) ont été pleinement déployés en production plusieurs années avant leur remplacement — TRL 9 historique, pas TRL 7. La fiche confond « obsolescence actuelle » et « niveau de maturité jamais atteint ».

**F10 — [mineur] gan — affirmation non tracée à la source**
« Largement supplanté depuis 2022 par les modèles de diffusion » (`limites_connues`) : absent de la source Wikipedia EN citée, qui ne traite pas des modèles de diffusion. Fait probablement exact mais non traçable à la source indiquée (entorse à la règle « rien de mémoire »).

**F11 — [mineur] deepseek — couverture incomplète et affirmation non sourcée**
La fiche ne documente qu'un seul usage (« recherche », TRL 7) et omet l'usage grand public le plus notable de DeepSeek (application chatbot, n°1 des téléchargements App Store en janvier 2025), pourtant clairement TRL 9. Par ailleurs, l'affirmation sur la « modération... alignée sur la réglementation chinoise (sujets politiques sensibles) » n'est pas corroborée par la source Wikipedia EN citée.

**F12 — [mineur] ia-en-genomique-et-drug-discovery — redite avec alphafold-deepmind**
Mêmes exemples (Isomorphic Labs, AlphaFold, découverte de médicaments) déjà traités dans la fiche `alphafold-deepmind`, sans apport factuel distinct. Source primaire au titre non identifiable (cf. F2).

**F13 — [mineur] alphafold-deepmind — chiffre non tracé**
« Utilisée par des centaines de milliers de chercheurs dans le monde » (exemple, usage recherche) : la source Wikipedia FR consultée parle de nombre de protéines couvertes (365 000 puis quasi-totalité du protéome), pas de nombre d'utilisateurs. Chiffre plausible (souvent avancé par DeepMind) mais non retrouvé dans la source citée.

**F14 — [mineur, transversal] Conflation méthodologique TRL × secteur « recherche »**
Dans la majorité des fiches de l'échantillon (rnn, gan, transformers, llama, deepseek, graphcast, genomique, alphafold, bert), un secteur « recherche »/« science » se voit attribuer un TRL au sens strict — échelle conçue pour la maturité d'ingénierie d'un système opérationnel — alors que « adopté dans la littérature académique » n'est pas un critère de cette échelle (ex. `transformers`/recherche = TRL 9, alors qu'il s'agit d'un usage de publication, pas d'un système déployé). Défaut probable du gabarit de fiche IA plutôt qu'erreur isolée — à vérifier sur l'ensemble des 512 fiches.

### 1.3 TRL contestés

| Fiche | Secteur | TRL déclaré | TRL défendable | Justification |
|---|---|---|---|---|
| aide-a-la-decision-publique-govtech-ia | gouvernement (x2) | 6 | 9 (historique, avant retrait) | Systèmes réellement déployés en production nationale (SyRI, notation A-levels) selon la source citée par la fiche elle-même ; retirés pour motifs juridiques, non pour immaturité. |
| rnn | industrie / recherche | 7 | 9 (historique) | RNN/LSTM en production commerciale (traduction, reconnaissance vocale) plusieurs années avant 2022, pas seulement « démontrés en environnement opérationnel ». |
| yolo | gouvernement | 7 | non déterminable | Aucun élément dans la source ne permet de fixer un TRL — exemples non attestés (cf. F3). |
| ia-en-modelisation-climatique-type-graphcast | gouvernement / science | 7 | non déterminable en l'état | Source secondaire ne parle pas de GraphCast (confusion GenCast, cf. F7) ; source primaire sans URL. |
| transformers, gan, llama, deepseek, alphafold, bert (secteur « recherche »/« science ») | recherche/science | 7 à 9 | catégorie à retirer ou redéfinir | TRL appliqué à un usage académique n'a pas de sens sur l'échelle de maturité technologique d'origine (cf. F14). |

### 1.4 Fiches non vérifiables (sans URL exploitable pour au moins une source)

`aide-a-la-decision-publique-govtech-ia`, `frameworks-multi-agents-langgraph-crewai-autogen`, `ia-en-modelisation-climatique-type-graphcast`, `alphafold-deepmind` (2 sources sur 3), `deepseek` (2 sources sur 3), `ia-en-genomique-et-drug-discovery`.

### 1.5 Conclusion chiffrée — échantillon IA

- Fiches avec au moins un finding sérieux ou bloquant : **5 / 15 (33 %)** (govtech, yolo, cnn, multi-agents, graphcast).
- Fiches avec au moins un finding (toute gravité confondue, hors défaut transversal F14) : **11 / 15 (73 %)**.
- Fiches sans finding fiche-spécifique (transformers, llama, régression logistique, bert) : **4 / 15 (27 %)** — mais toutes potentiellement concernées par le défaut transversal TRL/recherche (F14).
- Sources primaires non traçables (sans URL) : **6 / 15 fiches (40 %)**.

---

## 2. Échantillon Psychologique / Sérénité (9 fiches)

### 2.1 Tableau des notes (/5)

| Fiche | Fidélité source | Neutralité | Densité | Utilité |
|---|---|---|---|---|
| quete-de-sens-spiritualites-et-laicite | 5 | 4 | 4 | 4 |
| therapies-cognitivo-comportementales-tcc | 2 | 3 | 4 | 3 |
| martin-seligman | 3 | 3 | 4 | 4 |
| abraham-maslow | 3 | 4 | 4 | 4 |
| carl-rogers | 3 | 4 | 4 | 4 |
| daniel-kahneman-amos-tversky-biais-cognitifs | 3 | 4 | 4 | 5 |
| sigmund-freud | 3 | 4 | 4 | 4 |
| b-f-skinner | 4 | 4 | 4 | 4 |
| resilience-civilisationnelle-aux-risques-existentiels | 5 | 4 | 4 | 4 |
| **Moyenne** | **3.4** | **3.8** | **4.0** | **4.0** |

### 2.2 Findings

**F8 — [bloquant] therapies-cognitivo-comportementales-tcc — affirmation d'efficacité thérapeutique non attribuée, sur un sujet de santé mentale**
Citation fautive (`resonance_ia`) : « l'alliance thérapeutique — **le facteur le plus prédictif du résultat clinique selon les méta-analyses toutes approches confondues** — reste débattue quant à sa reproductibilité par une IA sans présence incarnée ni enjeu réciproque » ; et « ce qui en fait le champ psychothérapeutique le plus reproduit par des applications conversationnelles (**chatbots de soutien type Woebot, Wysa**) ».
Ce que disent réellement les sources citées : aucune des trois sources (Beck, *Cognitive Therapy and the Emotional Disorders* ; revues Cochrane sur la TCC ; Wikipedia FR *Thérapie cognitivo-comportementale*) ne traite de l'alliance thérapeutique, de méta-analyses transversales sur les « facteurs communs », ni de Woebot ou Wysa. La revue Wikipedia confirme seulement l'efficacité de la TCC sur des troubles ciblés et la critique de la standardisation.
Pourquoi c'est grave : c'est une affirmation d'efficacité clinique forte (« le facteur le plus prédictif »armé d'une généralité « toutes approches confondues ») présentée sans attribution, sur un sujet touchant directement à la santé mentale — exactement le point de vigilance signalé pour cet axe. Le lecteur ne peut pas vérifier ni pondérer cette affirmation.
Correction proposée : soit sourcer précisément cette affirmation (ex. Wampold, *The Great Psychotherapy Debate*, ou une méta-analyse nommée), soit la reformuler en la qualifiant explicitement d'hypothèse discutée dans la littérature des « common factors », et ajouter une source réelle pour Woebot/Wysa (études cliniques publiées sur ces applications) plutôt que de les citer comme illustration non sourcée.

**F9 — [sérieux] martin-seligman — omission d'une controverse documentée par la source elle-même**
La fiche ne mentionne, en `limites_critiques`, que des critiques académiques feutrées (« optimisme parfois prescriptif », « oubli des déterminants sociaux ») — elles-mêmes non retrouvées telles quelles dans la source Wikipedia consultée. Cette même source documente en revanche « une controverse concernant [le] rôle potentiel [de Seligman] dans les programmes de torture de la CIA », en lien direct avec sa théorie de l'impuissance apprise — élément totalement absent de la fiche.
Pourquoi c'est un problème de neutralité : la fiche retient sélectivement les éléments valorisants (fondation de la psychologie positive, modèle PERMA) et omet un fait controversé documenté et directement lié au concept central de la fiche, ce qui constitue une forme de survalorisation par omission.
Correction proposée : mentionner la controverse (même brièvement, avec la réserve qu'elle reste débattue/contestée par l'intéressé) dans `limites_critiques`.

**F16 — [mineur] abraham-maslow — nuance omise sur l'origine de la pyramide**
La source Wikipedia FR indique explicitement que « la pyramide qui a été attribuée à Maslow représente mal la richesse de son analyse » et n'est pas une création directe de Maslow lui-même — nuance importante et absente de `these_centrale`/`limites_critiques`, qui présentent la hiérarchie pyramidale comme si elle correspondait directement à la théorie de l'auteur.

**F17 — [mineur, groupé] Affirmations non tracées aux sources citées (carl-rogers, daniel-kahneman, sigmund-freud, b-f-skinner)**
- `carl-rogers` : le débat sur l'efficacité de la non-directivité face aux TCC (`limites_critiques`) n'apparaît pas dans la source Wikipedia consultée (qui ne mentionne pas les TCC).
- `daniel-kahneman-...` : la « crise de la réplication en psychologie sociale des années 2010 » (`limites_critiques`) n'est pas mentionnée dans la source Wikipedia FR consultée.
- `sigmund-freud` : les critiques du behaviorisme et des neurosciences cognitives (`limites_critiques`) sont absentes de la source (qui documente plutôt Kraus, Friedell, les « Freud Wars » des années 1990).
- `b-f-skinner` : la date « 1953 » pour *Science and Human Behavior* n'est pas confirmée par la source (qui ne donne que le titre en français, sans date).
Ces affirmations sont vraisemblablement exactes sur le fond (débats réels et documentés dans la littérature académique plus large) mais ne sont pas traçables aux sources précises indiquées dans chaque fiche — entorse répétée à la règle « rien de mémoire ».

### 2.3 TRL contestés

Non applicable — l'axe psychologique/sérénité ne comporte pas de champ TRL.

### 2.4 Fiches non vérifiables

Aucune fiche de cet échantillon n'a de source totalement invérifiable (toutes les URL Wikipedia citées existent et traitent bien du bon sujet). En revanche, les sources primaires « livre » (Beck, Kahneman, Freud, Skinner, Maslow, Rogers, Bostrom) ne sont pas assorties d'URL — conformes à l'usage pour des ouvrages, mais non vérifiables dans le cadre de cet audit à distance.

### 2.5 Conclusion chiffrée — échantillon psycho/sérénité

- Fiches avec un finding bloquant ou sérieux : **2 / 9 (22 %)** (TCC, Seligman).
- Fiches avec au moins un finding (toute gravité) : **7 / 9 (78 %)**.
- Fiches sans finding (quête de sens, résilience civilisationnelle) : **2 / 9 (22 %)** — les deux fiches les mieux sourcées de l'échantillon.

---

## 3. Synthèse globale (24 fiches)

- **Taux de fiches à reprendre en priorité (finding sérieux/bloquant) : 7 / 24 = 29 %.**
- **Taux de fiches avec au moins un défaut de traçabilité/fidélité (toute gravité) : 18 / 24 = 75 %.**
- Findings par gravité : **2 bloquants**, **6 sérieux**, **8 mineurs** (dont 1 mineur transversal touchant potentiellement l'ensemble du référentiel IA).
- Le point de vigilance le plus productif n'a pas été la surestimation isolée d'un TRL, mais (a) l'usage de sources « primaires » sans URL réelle sur 40 % des fiches IA échantillonnées, et (b) une conflation méthodologique du TRL avec l'usage académique, probablement présente dans une large partie des 512 fiches.
- Sur l'axe psychologique, le risque le plus sérieux identifié est une affirmation d'efficacité thérapeutique non attribuée dans la fiche TCC — exactement le type de dérive à surveiller sur un sujet de santé mentale.


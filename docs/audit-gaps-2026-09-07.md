# Audit contradictoire des 201 fiches de gap — 07/09/2026

> Ce rapport ne corrige rien. Il constate. Aucun fichier de `data/seed/` n'a été modifié.
> Chaque finding porte la citation fautive mot pour mot, ce que disent réellement les deux
> fiches sources, et la correction proposée.

## Pourquoi cet audit

Les 201 fiches de gap n'avaient jamais été auditées. L'audit de fond du 06-07/09 n'a porté
que sur 69 fiches humaines et IA. Or les gaps sont, de tout le corpus, la partie dont la
règle de production est la plus stricte **et la plus facile à vérifier** :

> Le contenu d'un gap se déduit exclusivement de ses deux fiches sources. Aucune recherche
> externe, aucun fait, chiffre, date ou nom qui ne figure pas dans l'une des deux fiches liées.

Cette règle est vérifiable sans sortir du corpus : on ouvre le gap, on ouvre ses deux fiches,
on compare. C'est ce que fait ce rapport.

Le validateur (`npm run valider`) sort à **0 erreur, 0 avertissement sur 512 fiches**. Il ne
voit rien de ce qui suit.

## Méthode

**Échantillon.** 40 gaps tirés au sort de façon reproductible, plus les 7 gaps les plus anciens
— soit **47 gaps, 23,4 % du corpus**.

- Tirage : générateur congruentiel linéaire `X ← (1664525·X + 1013904223) mod 2³²`,
  **graine 20260907**, appliqué à la liste des 201 identifiants **triés par ordre alphabétique**,
  tirage sans remise. Script conservé : `sample.js` (reproductible tel quel).
- Les 7 plus anciens : le lot d'amorçage compte en réalité **6** gaps (commit `7c53fcf`,
  antérieurs au 06/09 : `nietzsche`, `capitalisme-etat-chinois`, `taylorisme`, `okr`, `socrate`,
  `tcc` — ce dernier seul porte `derniere_verification: 2026-09-05`). Le 7ᵉ retenu est
  `john-searle-vs-transformers`, premier gap du lot 4. Aucun n'était sorti du tirage aléatoire :
  les deux ensembles sont disjoints, 40 + 7 = 47.

**Procédure.** Pour chaque gap : ouverture des deux fiches liées, confrontation champ par champ
(`apport_ia`, `mecanisme`, `amelioration_possible`, `mode_interaction`, les trois scénarios,
`sous_themes`, `axes_recherche`, `axes_prospectifs`, `documents_cles`), puis relevé de **tout
fait, chiffre, date, nom propre ou technologie nommée** absent des deux fiches. Quatre contrôles
automatiques ont par ailleurs été passés sur les **201** gaps (forme, TRL, traçabilité des
`documents_cles`, recopie inter-gaps) ; leurs résultats sont donnés en population entière et
non extrapolés.

**Notation.** 1 à 5 sur quatre axes : fidélité aux deux fiches sources, respect des règles de
forme, pertinence de l'appariement, neutralité.

**Vérification externe.** Trois URL seulement ont été ouvertes par WebFetch, non pour valider
les fiches mais pour établir *d'où* venait la matière importée. Résultat décisif, voir §4.

---

## 1. Résultat d'ensemble

| Échantillon | Fidélité | Forme | Appariement | Neutralité | Gaps portant ≥ 1 fait absent des deux fiches |
|---|---|---|---|---|---|
| 40 tirés au sort | **3,83** | **3,48** | 4,55 | 4,58 | **17 / 40 — 42,5 %** |
| 7 plus anciens | 4,00 | 3,43 | **3,71** | 4,43 | 5 / 7 |
| **Ensemble (47)** | **3,85** | **3,47** | **4,43** | **4,55** | **22 / 47 — 46,8 %** |

**Trois enseignements.**

**1. La règle « rien hors des deux fiches » est violée par près d'un gap sur deux — mais jamais
par invention.** Tous les faits importés vérifiés se sont révélés **exacts**. Le défaut n'est pas
factuel, il est de traçabilité : c'est exactement le défaut dominant relevé le 07/09 sur les
fiches humaines, reproduit à l'identique sur les gaps.

**2. La forme explicite est parfaite, la forme implicite ne l'est pas.** Sur les **201** gaps :
3 `axes_prospectifs` partout, au moins un `hypothese_prospective` partout,
`technologie_complementaire` présent si et seulement si `substituabilite ===
"remplacable_avec_autre_technologie"` partout — **zéro violation**. En revanche **41 gaps citent
un niveau de TRL que leur fiche IA ne documente pas**, et 99 entrées de `documents_cles` sur 610
ne se rattachent à aucune source des deux fiches.

**3. Il n'y a aucune recopie textuelle entre gaps — mais il y a recopie factuelle.** Sur les 201
gaps, **aucune phrase de plus de 45 caractères n'apparaît dans deux gaps**, et la similarité
maximale entre deux gaps (4-grammes, indice de Jaccard) est de **0,112**. Les 115 gaps produits
le même jour par six agents parallèles ne se sont pas copiés. Ce qui circule d'un gap à l'autre,
ce sont des **dossiers de chiffres hors corpus** partagés entre gaps qui pointent la même fiche
IA (§4.2).

**Bilan : 4 findings bloquants, 11 sérieux, 9 mineurs.**

---

## 2. Tableau de notation des 47 gaps audités

`F` fidélité · `Fo` forme · `A` appariement · `N` neutralité · `✗` = porte au moins un fait,
chiffre, date ou nom absent des deux fiches sources (corps du gap, hors `documents_cles`).

### 2.1 Les 40 tirés au sort (graine 20260907)

| # | Gap | F | Fo | A | N | ✗ |
|---|---|---|---|---|---|---|
| 1 | `peter-singer-vs-dependance-energetique` | 1 | 2 | 4 | 4 | ✗ |
| 2 | `bernard-stiegler-vs-tutorat-adaptatif` | 1 | 2 | 5 | 4 | ✗ |
| 3 | `kate-raworth-vs-graphcast` | 2 | 3 | 4 | 5 | ✗ |
| 4 | `jurgen-habermas-vs-aide-decision-publique` | 2 | 3 | 4 | 4 | ✗ |
| 5 | `democratie-liberale-vs-govtech-ia` | 2 | 1 | 4 | 3 | ✗ |
| 6 | `democratie-illiberale-vs-agents-navigation-web` | 2 | 3 | 4 | 4 | ✗ |
| 7 | `minilateralisme-clubs-vs-agents-navigation-web` | 2 | 2 | 4 | 4 | ✗ |
| 8 | `kahneman-tversky-vs-biais-donnees` | 2 | 2 | 5 | 4 | ✗ |
| 9 | `vaccins-arnm-vs-criblage-virtuel` | 2 | 3 | 5 | 4 | ✗ |
| 10 | `gavi-vs-ia-genomique-drug-discovery` | 2 | 3 | 4 | 4 | ✗ |
| 11 | `gouvernance-reseau-multiniveau-vs-frameworks-multi-agents` | 2 | 1 | 3 | 4 | ✗ |
| 12 | `double-helice-adn-vs-ia-genomique` | 3 | 3 | 5 | 4 | ✗ |
| 13 | `martin-seligman-vs-devin` | 3 | 3 | 4 | 4 | ✗ |
| 14 | `otan-vs-yolo` | 3 | 3 | 4 | 4 | ✗ |
| 15 | `ipbes-vs-cnn` | 3 | 3 | 5 | 5 | ✗ |
| 16 | `geoffrey-hinton-vs-transformers` | 4 | 3 | 5 | 5 | ✗ |
| 17 | `marie-curie-vs-cnn` | 4 | 4 | 5 | 5 | ✗ |
| 18 | `management-hybride-vs-claude-cowork` | 4 | 2 | 3 | 4 | |
| 19 | `risques-existentiels-vs-hallucination` | 4 | 4 | 5 | 5 | |
| 20 | `ludwig-wittgenstein-vs-claude-cowork` | 5 | 3 | 5 | 5 | |
| 21 | `connectome-vs-resnet` | 5 | 4 | 5 | 5 | |
| 22 | `giec-vs-modelisation-climatique-ia` | 5 | 4 | 5 | 5 | |
| 23 | `sdn-vs-frameworks-multi-agents` | 5 | 4 | 4 | 5 | |
| 24 | `honneth-vs-govtech` | 5 | 4 | 5 | 5 | |
| 25 | `union-africaine-vs-biais-donnees` | 5 | 4 | 5 | 5 | |
| 26 | `fanon-vs-biais-donnees` | 5 | 4 | 5 | 5 | |
| 27 | `entreprise-a-mission-vs-biais-donnees` | 5 | 4 | 4 | 5 | |
| 28 | `fonds-mondial-vs-cnn` | 5 | 4 | 5 | 5 | |
| 29 | `mouffe-vs-naive-bayes` | 5 | 4 | 4 | 5 | |
| 30 | `david-chalmers-vs-claude-cowork` | 5 | 4 | 5 | 5 | |
| 31 | `ue-cee-vs-decision-publique` | 5 | 4 | 5 | 4 | |
| 32 | `conseil-europe-vs-arbres-de-decision` | 5 | 4 | 5 | 5 | |
| 33 | `systeme-terre-vs-dependance-energetique` | 5 | 4 | 5 | 5 | |
| 34 | `daron-acemoglu-vs-codex-gpt` | 5 | 4 | 5 | 4 | |
| 35 | `embl-vs-alphafold` | 5 | 5 | 5 | 5 | |
| 36 | `monarchie-absolue-vs-autogpt` | 5 | 5 | 4 | 5 | |
| 37 | `eco-socialisme-vs-dependance-energetique` | 5 | 5 | 5 | 5 | |
| 38 | `kahneman-vs-deepseek` | 5 | 5 | 4 | 5 | |
| 39 | `heisenberg-vs-hallucination` | 5 | 5 | 5 | 5 | |
| 40 | `meillassoux-vs-modelisation-climatique` | 5 | 5 | 5 | 5 | |

### 2.2 Les 7 gaps du lot d'amorçage, jamais relus

| Gap | F | Fo | A | N | ✗ |
|---|---|---|---|---|---|
| `taylorisme-vs-claude-cowork` | 2 | 2 | **1** | 3 | ✗ |
| `capitalisme-etat-chinois-vs-deepseek` | 4 | 2 | 4 | 4 | ✗ |
| `okr-vs-claude-cowork` | 4 | 4 | 4 | 4 | ✗ |
| `john-searle-vs-transformers` | 4 | 4 | 5 | 5 | ✗ |
| `nietzsche-vs-claude-cowork` | 4 | 4 | 4 | 5 | ✗ |
| `socrate-vs-claude-cowork` | 5 | 4 | 4 | 5 | |
| `tcc-vs-claude-cowork` | 5 | 4 | 4 | 5 | |

Le lot d'amorçage n'est pas la partie la plus faible du corpus sur la fidélité (4,00 contre 3,83)
— ses gaps sont courts et restent près des fiches — mais il porte le **seul appariement noté 1**
et les seules fuites de vocabulaire de chantier (« cf. Lot 6 »).

---

## 3. Findings bloquants

### B1 — Attribution mensongère à une fiche source

`bernard-stiegler-vs-tutorat-adaptatif`

> « […] avec des effets mesurés (**aucune différence statistique avec des tuteurs humains experts
> selon une revue de 2011, élèves surpassant les classes conventionnelles dans 46 des 50
> évaluations d'une méta-analyse de 2015**, gains notables pour les élèves en éducation spécialisée
> ou de milieux défavorisés). Ce qu'il ne peut structurellement pas apporter, c'est la transmission
> comme relation : **la fiche IA note que ces systèmes restent moins capables que les tuteurs
> humains en dialogue et en lecture de l'état affectif de l'élève.** »

> « **la fiche IA relève que** les élèves peuvent épuiser les indices ou deviner plutôt que
> réfléchir, et que la plupart des systèmes ne distinguent pas l'apprentissage superficiel. »

**Ce que dit réellement la fiche IA** `tutorat-adaptatif-personnalise-edtech-ia`, en entier, sur
ses limites : « Les études sur l'efficacité pédagogique réelle de ces systèmes à grande échelle
restent mitigées et hétérogènes selon les contextes et les disciplines, et leur généralisation
soulève des questions sur la collecte de données comportementales détaillées d'élèves mineurs et
sur le risque de réduire l'apprentissage à une simple optimisation algorithmique. » **Elle ne
mentionne ni tuteurs humains, ni état affectif, ni indices, ni apprentissage superficiel, ni
aucun des chiffres cités.**

Vérification externe : ces cinq éléments figurent tous, mot pour mot, dans
`https://en.wikipedia.org/wiki/Intelligent_tutoring_system` — qui est bien une source de la fiche
IA, mais pas la fiche. Le gap a été rédigé en lisant la source de la fiche, puis en attribuant à
la fiche ce qu'elle ne dit pas.

**Gravité.** C'est le pire cas possible : un lecteur qui suit la piste de sourçage indiquée par le
gap ne trouvera pas ce qui lui est annoncé. Le mécanisme de traçabilité du référentiel se retourne
contre lui.

**Correction proposée.** Soit remonter ces éléments dans la fiche IA (avec la source), soit les
retirer du gap. Dans tous les cas, supprimer les formules « la fiche IA note/relève que » lorsque
la fiche ne le dit pas. **91 gaps sur 201 emploient la formule « la fiche IA » ou « la fiche
humaine »** : le contrôle doit être systématique.

Même défaut, même formule, dans `double-helice-adn-vs-ia-genomique` : « **la fiche IA rappelant
que** les performances rétrospectives prédisent mal les performances prospectives » — la fiche
`ia-en-genomique-et-drug-discovery` ne contient ni « rétrospectif », ni « prospectif », ni cette
idée sous aucune forme.

---

### B2 — Un gap entièrement rédigé hors corpus, et qui contredit sa propre fiche IA

`peter-singer-vs-dependance-energetique` — note de fidélité 1/5.

> « elle est en partie mesurable (**0,34 Wh par requête ChatGPT selon OpenAI en 2025 ; 552 tonnes
> de CO2 pour l'entraînement de GPT-3 ; projections de 85 à 134 TWh par an d'ici 2027**) »

> « fabrication des puces (**800 kg de matières premières pour un ordinateur de 2 kg ; 8 à 10
> gallons d'eau par puce**) […] avec une concentration documentée des nuisances sur des territoires
> vulnérables (**turbines au méthane sans permis du centre xAI à Memphis, procès SELC/NAACP en
> 2025**) »

> « **En 2026, l'atténuation industrielle est à TRL 6** (refroidissement en boucle fermée,
> implantations en régions froides, **accord Microsoft–Constellation de 2024 sur Three Mile
> Island**), **la métrologie à TRL 4 et la régulation à TRL 3.** »

> « sous l'hypothèse que la croissance des usages continue d'absorber les gains d'efficacité
> (**calcul doublant tous les 3,4 mois**) »

**Ce que disent les deux fiches.** La fiche humaine `peter-singer` porte sur le spécisme, la
sentience et l'altruisme efficace : **aucun chiffre énergétique**. La fiche IA
`dependance-energetique-...` décrit qualitativement une consommation « croissante », une
dépendance à Taïwan et une empreinte en terres rares, **sans un seul chiffre**, et documente
**deux usages, tous deux à TRL 9** (gouvernement, industrie).

Vérification externe : les huit chiffres proviennent tous de
`https://en.wikipedia.org/wiki/Environmental_impact_of_artificial_intelligence` et sont **exacts**.
Cet article est une source de la fiche IA — mais la fiche ne les reprend pas.

**Deux défauts distincts, l'un traçable, l'autre faux.**
- Les chiffres : violation de la règle « rien hors des deux fiches », sans erreur factuelle.
- Les TRL 6 / 4 / 3 : **contradiction directe** avec la fiche IA, qui documente TRL 9. Ces trois
  valeurs ne sont ni dans la fiche, ni dans l'article Wikipédia : elles sont inventées, et elles
  portent tout le `scenario_present`.

**Correction proposée.** Reformuler le `scenario_present` sur les TRL réellement documentés (9),
ou remonter les chiffres et une évaluation TRL argumentée dans la fiche IA elle-même. Le même
dossier de chiffres contamine 3 autres gaps (§4.2).

---

### B3 — `confiance: "elevee"` sur des usages documentés à TRL 6

La règle : `confiance: "elevee"` seulement si l'usage IA mobilisé est documenté à **TRL ≥ 7**
dans la fiche IA.

**Lecture large** (le TRL maximal de la fiche IA, toutes filières confondues) : **6 violations sur
les 201 gaps**, dont 2 dans l'échantillon.

| Gap | Fiche IA | TRL documentés |
|---|---|---|
| `democratie-liberale-vs-govtech-ia` | `aide-a-la-decision-publique-govtech-ia` | 6, 6 |
| `multilateralisme-institutionnel-vs-govtech-ia` | idem | 6, 6 |
| `onu-vs-govtech-ia` | idem | 6, 6 |
| `cern-vs-frameworks-multi-agents` | `frameworks-multi-agents-...` | 6, 6 |
| `gouvernance-reseau-multiniveau-vs-frameworks-multi-agents` | idem | 6, 6 |
| `holacratie-vs-frameworks-multi-agents` | idem | 6, 6 |

**Lecture stricte** (l'usage *effectivement mobilisé* documenté à TRL ≥ 7) : **4 violations sur les
18 gaps `elevee` de l'échantillon, soit 22 %.** S'ajoutent aux deux ci-dessus :

- `taylorisme-vs-claude-cowork` — `elevee`, usage mobilisé = mesure automatisée du geste industriel
  par capteurs et vision. La fiche `claude-anthropic-cowork` ne documente que deux usages :
  éducation TRL 7, recherche TRL 6. **Aucun ne correspond.**
- `management-hybride-vs-claude-cowork` — `elevee`, usage mobilisé = coordination du travail
  distribué et bureautique. Le gap l'admet lui-même en citant « TRL 7 en éducation, TRL 6 en
  recherche documentaire », c'est-à-dire deux usages qui ne sont pas celui qu'il analyse.

Les deux gaps `govtech` et `frameworks` **fabriquent le TRL qui les autorise** :

> `democratie-liberale-vs-govtech-ia` : « Dématérialisation des démarches et partage de données
> entre administrations, **à un niveau de maturité industrielle (TRL 8)** » ; « En 2026, la
> dématérialisation des démarches est déployée à grande échelle **(TRL 8)** […] tandis que
> l'évaluation de ses effets sociaux reste au stade de la recherche **(TRL 5)** »

> `gouvernance-reseau-multiniveau-...` : « ces frameworks sont utilisés en production pour des
> assistants et automatisations d'entreprise **(TRL 7 : chatbots avec récupération augmentée sur
> documents internes, synthèse documentaire)** »

Ni TRL 8, ni TRL 5, ni TRL 7 ne figurent dans les fiches IA concernées, qui documentent 6 partout.

**Test de cohérence interne, décisif.** Trois gaps de l'échantillon pointent la *même* fiche
`aide-a-la-decision-publique-govtech-ia` et lui attribuent trois maturités incompatibles :
- `honneth-vs-govtech` : « Ces systèmes sont déployés à **un niveau de maturité modeste** » — `moyenne`
- `ue-cee-vs-decision-publique` : « à un niveau de maturité **encore modéré** » — `moyenne`
- `democratie-liberale-vs-govtech-ia` : « **maturité industrielle (TRL 8)** » — `elevee`

Les deux premiers sont fidèles à la fiche, le troisième ne l'est pas.

**Correction proposée.** Rétrograder les 6 gaps de la lecture large en `moyenne` ; requalifier
`taylorisme` et `management-hybride` ; et surtout supprimer les mentions de TRL fabriquées, qui
sont le vrai mécanisme de la violation.

---

### B4 — Un appariement qui ne tient pas : `taylorisme-vs-claude-cowork`

Note d'appariement 1/5. `substituabilite: "remplacable_totalement"`, `confiance: "elevee"` —
la combinaison la plus affirmative du schéma, sur la paire la plus mal assortie de l'échantillon.

> « Le cœur du Taylorisme […] est aujourd'hui automatisable de bout en bout : **capteurs + vision
> par ordinateur + modèles de renforcement** peuvent chronométrer, comparer et recommander en
> continu, sans bureau des méthodes humain. »

> « **Instrumentation du poste de travail (capteurs, caméras)** + modèles d'apprentissage
> automatique pour détecter les écarts à la méthode optimale »

**Ce que dit la fiche IA retenue.** `claude-anthropic-cowork` est un modèle de langage :
« Raisonnement et rédaction en langage naturel multi-tour », « usage agentique d'outils »,
« mode Cowork : automatisation de tâches bureautiques/fichiers ». **Ni capteur, ni caméra, ni
vision par ordinateur, ni apprentissage par renforcement, ni usine.** Le gap analyse une capacité
que sa fiche IA ne possède pas. Il tire sa matière de la seule ligne `resonance_ia` de la fiche
humaine — laquelle décrit une technologie qui n'est pas celle de la fiche IA liée.

Le corpus contient `cnn`, `yolo`, `resnet` et `jumeaux-numeriques`, tous documentés en vision
industrielle à TRL 9.

**Correction proposée.** Réapparier sur `cnn` ou `yolo`, et réévaluer `remplacable_totalement`
(4 gaps seulement sur 201 portent cette valeur : elle mérite un contrôle dédié). Retirer par
ailleurs « RGPD », absent des deux fiches.

---

## 4. Findings sérieux

### 4.1 — Un TRL sur deux, parmi ceux qui sont cités, n'est pas dans la fiche IA

Contrôle automatique sur les **201** gaps : **91 gaps citent explicitement au moins un « TRL n »
dans leur texte. 41 d'entre eux — 45,1 % — citent au moins une valeur que leur fiche IA ne
documente pas.** Extraits :

| Gap | Cite | La fiche IA documente |
|---|---|---|
| `peter-singer-vs-dependance-energetique` | TRL 6, 4, 3 | 9 |
| `john-rawls-vs-biais-donnees` | TRL 4, 5 | 9 |
| `kahneman-tversky-vs-biais-donnees` | TRL 4 | 9 |
| `marxisme-leninisme-vs-biais-donnees` | TRL 4 | 9 |
| `gouvernance-multipolaire-vs-biais-donnees` | TRL 4 | 9 |
| `informatique-quantique-vs-dependance-energetique` | TRL 6, 3 | 9 |
| `souverainisme-vs-dependance-energetique-ia` | TRL 3 | 9 |
| `jurgen-habermas-vs-aide-decision-publique` | TRL 8, 5 | 6 |
| `world-happiness-report-vs-govtech` | TRL 8, 5 | 6 |
| `onu-vs-govtech-ia` | TRL 8, 5 | 6 |
| `bernard-stiegler-vs-tutorat-adaptatif` | TRL 8, 7 | 7, 6 |
| `lev-vygotski-vs-tutorat-adaptatif` | TRL 8 | 7, 6 |
| `vaccins-arnm-vs-criblage-virtuel` | TRL 8, 7 | 7, 7 |
| `theorie-du-chaos-vs-lstm` | TRL 8, 9 | 8 |
| `bureaucratie-weberienne-vs-arbres-de-decision` | TRL 9, 8 | 9 |

(liste complète des 41 reproductible par le script de contrôle)

Deux régimes se dessinent. Les gaps `biais-donnees` et `dependance-energetique` **sous-estiment
massivement** (TRL 3-4 pour une fiche à 9) ; les gaps `govtech` et `tutorat` **surestiment**
(TRL 8 pour une fiche à 6-7). Dans les deux cas le TRL n'est pas repris de la fiche : il est
réinventé au fil de la rédaction, et il porte les `scenario_present`.

**Correction proposée.** Le TRL n'est pas un champ des gaps : il est un champ des `usages` de la
fiche IA. Toute mention de TRL dans un gap doit citer la valeur de la fiche, en nommant le secteur
(« TRL 9 en usage gouvernement, selon la fiche IA »), ou disparaître. C'est la correction la plus
mécanisable de ce rapport, et elle touche 41 fiches.

### 4.2 — Des dossiers de chiffres hors corpus, partagés entre gaps

Il n'y a **aucune recopie textuelle** (§1). Mais les mêmes faits absents des fiches réapparaissent
d'un gap à l'autre, toujours entre gaps pointant la même fiche IA :

| Élément absent des fiches | Gaps concernés |
|---|---|
| « 85 à 134 TWh », « 800 kg de matières premières », « 3,4 mois » | 4 gaps `dependance-energetique` |
| « 0,34 Wh », « 552 tonnes de CO2 », « Three Mile Island » | 2 gaps |
| « Adèle », « Action Publique 2022 », « 62 % », « 79 % », Estonie/Finlande | 5 gaps `govtech` |
| « 58,1 % » / « 38,1 % », chronologie Operator, « Computer-Using Agent » | 4 gaps `agents-navigation-web` |
| « HRES », « ECMWF », « ERA5 », « TPU » | 3 gaps `modelisation-climatique` |
| « COMPAS », « Amazon », « Gender Shades », « 99,3 % / 78,7 % » | 4 gaps `biais-donnees` |
| « ACF », « PACF », « AIC », « BIC », « RMSE » | 3-4 gaps `arima` |
| « MatBench Discovery », « Materials Project », « DFT » | 2 gaps `gnome` |

C'est la signature d'un agent qui a ouvert une page externe une fois puis l'a réutilisée sur toute
sa série. Le contre-exemple est parlant : sur la même fiche `biais-herites-des-donnees`,
`fanon`, `union-africaine` et `entreprise-a-mission` **n'importent rien** et notent 5/5 en
fidélité, tandis que `john-rawls`, `kahneman-tversky`, `marxisme-leninisme` et
`gouvernance-multipolaire` importent le même dossier COMPAS/Gender Shades. **La contamination
suit l'agent rédacteur, pas la fiche IA.**

### 4.3 — Les chiffres importés sont exacts, et c'est ce qui rend le défaut coûteux

Vérification par WebFetch de trois pages :

| Affirmation du gap | Source réelle | Verdict |
|---|---|---|
| « 58,1 % sur le web, 38,1 % au niveau système » | `en.wikipedia.org/wiki/OpenAI_Operator` (WebArena 58,1 % ; OSWorld 38,1 %) | exact |
| « lancé en accès limité aux abonnés ChatGPT Pro aux États-Unis en janvier-février 2025 puis […] arrêté le 31 août 2025 » | idem (lancement 23/01/2025, accès Pro US 01/02/2025, retrait 31/08/2025) | exact |
| « 0,34 Wh », « 552 tonnes », « 85–134 TWh », « 800 kg », « 8 à 10 gallons », « 3,4 mois », xAI Memphis / SELC-NAACP, Microsoft–Constellation | `en.wikipedia.org/wiki/Environmental_impact_of_artificial_intelligence` | exact |
| VanLehn 2011, Kulik-Fletcher 46/50, 200-300 h, architecture à 4 composants, épuisement des indices | `en.wikipedia.org/wiki/Intelligent_tutoring_system` | exact |

Aucune hallucination. Le corpus ne raconte pas de faussetés : **il raconte des vérités qu'il ne
peut pas justifier depuis les fiches auxquelles il renvoie.** Un lecteur qui remonte la chaîne
gap → fiche → source trouve un trou au deuxième maillon. La fiche `openai-operator-...` ne cite
que `en.wikipedia.org/wiki/OpenAI`, jamais l'article `OpenAI_Operator` d'où sortent les chiffres
du gap.

**Correction proposée, structurelle.** Deux voies seulement, et il faut choisir : soit **remonter
la matière dans les fiches** (enrichir la fiche IA avec ces chiffres et ces URL, puis laisser le
gap y puiser légitimement) ; soit **appauvrir les gaps** pour les ramener à ce que les fiches
portent. La première est meilleure pour le lecteur, la seconde est plus rapide. La situation
actuelle — gaps riches, fiches pauvres, sourçage rompu entre les deux — est la pire des trois.

### 4.4 — 99 `documents_cles` sur 610 ne se rattachent à aucune source des deux fiches

Contrôle automatique sur les 201 gaps : **16,2 % des entrées de `documents_cles`, réparties sur
69 gaps (34,3 %)**, ne correspondent ni par titre ni par URL à une source des deux fiches liées.
La règle veut qu'elles en soient reprises.

Cas typiques :
- `john-searle-vs-transformers`, `geoffrey-hinton-vs-transformers`, `cyber-socialisme-vs-transformers` :
  « Vaswani et al. — Attention Is All You Need », `https://arxiv.org/abs/1706.03762`. La fiche
  `transformers` **ne cite qu'une seule source** : l'article Wikipédia anglais. (Le *titre* de
  l'article figure dans son champ `editeur` ; l'URL arXiv, nulle part.)
- `daniel-dennett-`, `cern-`, `technocratie-vs-frameworks-multi-agents` : documentations officielles
  LangGraph et Microsoft AutoGen — la fiche ne cite que « documentation des projets » (sans URL) et
  l'article Wikipédia LangChain.
- `ipbes-vs-cnn` : Krizhevsky-Sutskever-Hinton 2012, Fukushima 1980, LeCun 1998 — la fiche `cnn` ne
  cite que l'article Wikipédia français.
- `jurgen-habermas-`, `democratie-liberale-`, `world-happiness-report-vs-govtech` : « Administration
  électronique — Wikipédia » (fr) — la fiche cite « Government by algorithm — Wikipedia » (en).
  Article différent.

**Défaut de typage associé, systématique.** **138 entrées `documents_cles` réparties sur 109 gaps
(54 %) typent un article Wikipédia comme source `primaire`.** Le défaut est hérité : les fiches
sources le commettent 84 fois (57 côté humain, 27 côté IA). Le validateur ne contrôle pas la
cohérence entre `type` et nature de la source.

### 4.5 — 35 scénarios prospectifs sont étiquetés « fait vérifié »

Sur les 201 gaps, la distribution des `niveau_confiance` dans `axes_prospectifs` est :
opinion majoritaire 292, hypothèse prospective 235, consensus scientifique 41, **fait vérifié 35**.

Un `axe_prospectif` est par définition « une branche future nommée parmi plusieurs possibles »
(`lib/types.ts`). L'étiqueter `fait_verifie` revient à présenter un futur comme établi. Les 35 cas
suivent tous le même patron — « la limitation actuelle persiste » :

> `democratie-illiberale-vs-agents-navigation-web`, axe **« Plafond de fiabilité durable »**,
> `fait_verifie` : « Frein observé : difficultés persistantes sur les interfaces complexes et les
> flux longs, avec des produits retirés rapidement du marché. »

> `minilateralisme-clubs-vs-agents-navigation-web`, axe **« Plafond de fiabilité »**,
> `fait_verifie` : « Les taux mesurés — **58,1 % sur les interactions web et 38,1 % au niveau
> système** — restent très en deçà de la précision humaine »

Le second cumule les deux défauts : un chiffre absent des deux fiches sources, étiqueté « fait
vérifié », dans un champ réservé aux futurs possibles.

Autres occurrences dans l'échantillon : `kate-raworth-vs-graphcast` (« Dépendance aux systèmes
physiques »), `geoffrey-hinton-vs-transformers` (« Domination durable du paradigme »),
`otan-vs-yolo` (« Hétérogénéité des lignées de modèles »), `martin-seligman-vs-devin`,
`double-helice-adn-vs-ia-genomique`, `gouvernance-reseau-multiniveau-...`,
`vaccins-arnm-vs-criblage-virtuel`, `jurgen-habermas-...`.

**Correction proposée.** Requalifier ces 35 axes en `consensus_scientifique` (quand la limite
présente est effectivement établie par les fiches) ou en `opinion_majoritaire` (quand c'est sa
*persistance future* qui est affirmée). `fait_verifie` ne devrait pas être une valeur admissible
dans `axes_prospectifs` — c'est une contrainte de schéma à ajouter au validateur.

### 4.6 — `technologie_complementaire` : la règle de présence est parfaite, la règle de contenu non

Contrôle sur les 201 gaps : **32 gaps portent `substituabilite ===
"remplacable_avec_autre_technologie"`, les 32 portent `technologie_complementaire`, et aucun des
169 autres ne la porte. Zéro violation de présence.**

En revanche le champ nomme parfois autre chose qu'une technologie :

> `capitalisme-etat-chinois-vs-deepseek` : `technologie_complementaire`: « **Politique industrielle
> et financement public (levier économique, pas seulement technologique)** »

Le champ se contredit lui-même entre parenthèses. Deux autres cas mixtes :
`mariana-mazzucato-vs-ia-fusion-plasma` (« infrastructures expérimentales […] **et financement
public de la recherche fondamentale** ») et `bipolarite-guerre-froide-vs-transformers`
(« **Dissuasion nucléaire et canaux de communication directs entre capitales (« ligne rouge »)** »
— une doctrine et un canal diplomatique). Un quatrième est une paraphrase plutôt qu'un nom :
`stiglitz-vs-forets-aleatoires` (« Méthodes d'interprétabilité fondées sur l'importance relative
des variables explicatives » — SHAP, LIME et l'importance de permutation ne sont jamais nommées).

**4 cas sur 32, soit 12,5 %.** Les 28 autres nomment une technologie réelle (ERA5, tokamaks,
apprentissage fédéré, chiffrement homomorphe, capteurs IoT, modèles physiques non appris…), même
si la formulation tend partout vers la phrase explicative plutôt que le nom.

---

## 5. Findings mineurs

- **`risques-existentiels-vs-hallucination`** : « cette limite […] **n'a pas d'usage documenté à
  un niveau de maturité technologique donné** ». Faux au regard de la fiche
  `hallucination-et-fiabilite-factuelle`, qui documente trois usages à TRL 9, 8 et 9. Le gap est
  par ailleurs excellent (5/5 partout ailleurs).
- **`okr-vs-claude-cowork`** : « Connexion directe aux outils de suivi (**Asana, Jira**, tableurs) »
  et « effet **Goodhart** » — trois noms absents des deux fiches. Surtout : « Rédaction assistée et
  reporting automatisé déjà réalistes avec les outils actuels (**cf. Lot 6 — moteur Q&A non encore
  branché mais mécanisme équivalent**) ». Une note de chantier interne publiée dans une fiche.
- **`kate-raworth-vs-graphcast`** : « produite en **moins d'une minute sur une seule machine TPU
  v4** ». La fiche IA écrit « en **quelques minutes** sur une seule machine ». Le gap ne se contente
  pas d'ajouter, il resserre le chiffre de la fiche. Idem « supérieure au modèle **HRES de l'ECMWF**
  sur plus de **90 % des 1 380 variables** » là où la fiche dit « supérieure aux modèles physiques
  de référence sur la majorité des variables testées ».
- **`otan-vs-yolo`** : « TRL 9 **en industrie comme en recherche** » — la fiche `yolo` documente
  industrie TRL 9 et **gouvernement** TRL 7, et n'a pas d'usage « recherche ». Ajoute aussi
  « OverFeat » et « versions communautaires jusqu'en 2025 », absents.
- **`geoffrey-hinton-vs-transformers`** : « architecture **encodeur-décodeur** […] avec **connexions
  résiduelles et normalisation à chaque bloc**, résolvant les problèmes de **gradient évanescent** » —
  exact, mais aucun de ces trois éléments n'est dans la fiche `transformers`.
- **`marie-curie-vs-cnn`** : « **contourage** », « **planification dosimétrique** » — vocabulaire de
  radiothérapie absent des deux fiches, qui parlent de diagnostic sur imagerie.
- **`nietzsche-vs-claude-cowork`** et **`socrate-vs-claude-cowork`** : « **RAG** » comme voie
  d'amélioration, « **stoïcisme, TCC, existentialisme** » comme écoles de comparaison, « **Ménon** »
  en `documents_cles` (les sources de la fiche `socrate` sont l'*Apologie* et le *Phédon*). Écarts
  minces, mais ce sont les seuls des deux fiches d'amorçage les mieux notées.
- **`gavi-vs-ia-genomique-drug-discovery`** : « **1,8 milliard de dollars par nouvelle entité
  moléculaire en 2010** », « **100 millions de protéines** », « mesures d'**IC50** » — absents.
- **`ipbes-vs-cnn`** : « accélération décisive par les **GPU** », « changements d'angle de vue ou
  d'échelle que le **pooling** ne permet pas de compenser » — absents de la fiche `cnn`.

---

## 6. Neutralité active — le point qui tient

**Note moyenne 4,55/5, la meilleure des quatre axes**, y compris sur les axes réputés sensibles.
C'est le résultat le plus rassurant de cet audit et il mérite d'être dit.

**Régimes politiques et écoles économiques.** Les positions concurrentes sont exposées, les
jugements attribués, les arbitrages renvoyés au politique plutôt que tranchés :

> `mouffe-vs-naive-bayes` : « les positions en présence **ne sont pas départageables sur un critère
> technique** » — sur un gap qui confronte une théoricienne de la gauche radicale à la modération
> automatisée.

> `eco-socialisme-vs-dependance-energetique` : « Elle **ne conclut pas pour autant contre l'IA** :
> elle qualifie d'incertaine la soutenabilité de la trajectoire actuelle, ce qui est **un constat de
> risque, non un verdict**. »

> `fanon-vs-biais-donnees` : « **Le choix du critère restera politique** ; l'automatisation à grande
> échelle pourrait, **selon les cas, renforcer ou réduire** l'inscription technique de
> discriminations existantes. »

> `ue-cee-vs-decision-publique` : « Le débat restera partagé entre ceux qui voient dans l'effet
> Bruxelles un standard protecteur exporté et **ceux qui y voient un frein à l'innovation** ».

**Psychologie.** Aucune formulation, dans les gaps psychologiques de l'échantillon, ne laisse
entendre qu'un outil remplace une prise en charge. Le cadrage est explicite et répété :

> `tcc-vs-claude-cowork` : « Assistance de premier niveau sous supervision : outil d'accompagnement
> entre les séances ou de premier contact, **jamais substitut à un suivi clinique** pour des troubles
> significatifs » ; `substituabilite: "remplacable_avec_supervision"` et non « totalement » ;
> `amelioration_possible` exige « des garde-fous de détection de situations à risque nécessitant une
> orientation vers un professionnel humain ».

> `martin-seligman-vs-devin` : « **L'IA n'apporte rien pour prévenir l'impuissance apprise qu'elle
> peut susciter** — c'est une variable d'organisation du travail, pas de modèle. »

**Deux réserves, toutes deux mineures.**

- `democratie-liberale-vs-govtech-ia` (note 3/5, la plus basse) est déséquilibré en présentation :
  il importe deux chiffres de perception favorable (« 62 % de perception positive ») tandis que le
  seul contenu critique de sa fiche IA — « plusieurs déploiements […] annulés ou fortement critiqués
  après avoir été jugés discriminatoires envers des populations vulnérables » — se réduit à une
  incise sur les « audits de biais algorithmiques ». Sur la même fiche, `honneth-vs-govtech` en fait
  au contraire son point de départ. Le déséquilibre est un effet du sourçage hors corpus, pas d'une
  intention.
- `taylorisme-vs-claude-cowork` (3/5) qualifie la validation humaine des changements de méthode de
  concession « pour des raisons de sécurité et d'acceptabilité sociale, **pas de nécessité
  technique** », et range l'emploi parmi les « questions résiduelles ». Formulation sèche sur un
  sujet où la fiche humaine parle de « déshumanisation du travail » et d'« aliénation ».

---

## 7. Estimation du taux d'erreur extrapolé aux 201 gaps

### 7.1 Ce qui est mesuré sur la population entière, sans extrapolation

Ces quatre chiffres portent sur les **201** gaps et ne comportent aucune incertitude
d'échantillonnage :

| Contrôle | Résultat sur 201 |
|---|---|
| 3 `axes_prospectifs` dont ≥ 1 `hypothese_prospective` | **0 violation** |
| `technologie_complementaire` présent ssi `remplacable_avec_autre_technologie` | **0 violation** |
| `confiance: elevee` avec TRL max de la fiche IA < 7 | **6 gaps (3,0 %)** |
| TRL cité dans le gap absent de la fiche IA | **41 gaps** (45,1 % des 91 qui citent un TRL) |
| `documents_cles` non rattachables aux deux fiches | **99 entrées / 610 (16,2 %)**, sur **69 gaps (34,3 %)** |
| Wikipédia typé `primaire` dans `documents_cles` | **138 entrées**, sur **109 gaps (54,2 %)** |
| `axes_prospectifs` étiquetés `fait_verifie` | **35 gaps (17,4 %)** |
| Phrase (≥ 45 car.) identique entre deux gaps | **0** |
| Similarité maximale entre deux gaps (Jaccard 4-grammes) | **0,112** |

### 7.2 Ce qui est extrapolé

**Base d'extrapolation : les 40 gaps tirés au sort uniquement.** Les 7 gaps d'amorçage sont un
sous-ensemble choisi (les plus anciens) : les inclure biaiserait l'estimateur. Leur taux
d'infraction est d'ailleurs plus élevé (5/7), ce qui rend l'exclusion prudente.

**Critère.** Un gap est compté en infraction s'il contient, dans le **corps** de la fiche
(`apport_ia`, `mecanisme`, `amelioration_possible`, `mode_interaction`, les trois scénarios,
`sous_themes`, `axes_recherche`, `axes_prospectifs`), **au moins un fait, chiffre, date, nom propre
ou technologie nommée absent des deux fiches sources**. Les défauts limités aux seuls
`documents_cles` ne sont pas comptés ici (ils sont mesurés en population entière, §7.1).

**Résultat : 17 gaps sur 40 — 42,5 %.**

Intervalle de Wilson à 95 % : **[28,5 % ; 57,8 %]**.
Avec correction de population finie (n/N = 0,199) : **[30,0 % ; 56,3 %]**.

**Projection sur les 201 gaps : environ 85 gaps concernés, et honnêtement entre 60 et 113.**

Je retiens l'intervalle **[30 % ; 56 %]** — soit **60 à 113 gaps sur 201**. L'échantillon ne permet
pas d'affirmer mieux. Ce qu'il permet d'affirmer avec certitude, en revanche, c'est que **le taux
n'est ni marginal (la borne basse est à 30 %) ni généralisé (la borne haute reste sous 60 %)** :
le corpus des gaps est franchement scindé en deux populations de qualité, et non uniformément
dégradé.

**Sous-catégorie plus grave** — gaps dont la matière importée est un chiffre, une date, un nom
propre ou un TRL contredisant la fiche, c'est-à-dire une affirmation vérifiable présentée comme
acquise : **15 / 40 = 37,5 %**, IC 95 % [24,2 % ; 53,0 %], soit **49 à 107 gaps**.

**Ce que l'extrapolation ne dit pas.** Le taux mesuré n'est **pas** un taux d'erreur factuelle.
Sur les quatre familles de faits importés vérifiées par WebFetch, **le taux d'erreur factuelle est
de zéro** ; les seules valeurs fausses relevées sont les **TRL fabriqués**, qui contredisent
directement les fiches IA (§4.1) et qui, eux, sont extrapolables à **41 gaps mesurés en population
entière**.

### 7.3 Deux populations, pas un gradient

La distribution des notes de fidélité sur les 40 tirés est bimodale : **19 gaps notés 5/5** et
**11 gaps notés 1 ou 2/5**, avec peu de cas intermédiaires. Certains gaps citent leurs fiches
presque littéralement et signalent eux-mêmes les limites de leur sourçage —

> `kahneman-vs-deepseek` : « **rien dans les fiches mobilisées n'établit** que le mécanisme
> sous-jacent soit de même nature que celui décrit par Kahneman et Tversky. »
> `heisenberg-vs-hallucination` : « **ni la fiche humaine ni la fiche IA ne la valident** comme
> rapprochement formel. »
> `ludwig-wittgenstein-vs-claude-cowork` : « notion que **rien dans les sources ne permet aujourd'hui
> d'étayer**. »
> `connectome-vs-resnet` : « ce que **les deux fiches présentent** aujourd'hui comme hors de portée. »

— tandis que d'autres sont des synthèses documentaires autonomes, rédigées à partir d'une page web
puis raccrochées après coup à la paire. La correction ne doit donc pas viser une amélioration
uniforme : elle doit **identifier et reprendre les 60 à 113 gaps de la seconde population**, en
laissant intacte la première, qui est de bonne qualité.

---

## 8. Ce qu'il faut corriger, par ordre de rendement

1. **Les 41 TRL fabriqués.** Mécanisable, mesurable, et c'est le mécanisme par lequel les
   violations de la règle `confiance: elevee` se produisent. Un contrôle de validateur peut
   l'imposer : tout « TRL n » cité dans un gap doit exister dans les `usages` de sa fiche IA.
2. **Les 91 formules « la fiche IA / la fiche humaine ».** Vérifier une par une que la fiche dit
   bien ce qui lui est attribué. C'est le défaut le plus grave (B1) et le plus insidieux.
3. **Le choix structurel du §4.3** : remonter la matière importée dans les fiches, ou l'ôter des
   gaps. Ne pas trancher, c'est laisser le sourçage rompu.
4. **Les 35 `fait_verifie` dans `axes_prospectifs`**, avec une contrainte de schéma pour empêcher
   la récidive.
5. **`taylorisme-vs-claude-cowork`** : réappariement, et contrôle des 4 gaps portant
   `remplacable_totalement`.
6. **Les 99 `documents_cles` orphelins et les 138 Wikipédia typés `primaire`** — le second point
   demande aussi de corriger 84 entrées dans les fiches sources elles-mêmes.

## 9. Reproductibilité

Tirage : LCG `X ← (1664525·X + 1013904223) mod 2³²`, graine **20260907**, sur les 201 identifiants
triés alphabétiquement, sans remise, 40 tirages. Les 7 gaps du lot d'amorçage sont identifiés par
`git show 7c53fcf:data/seed/fiches_gap.json` (6 entrées) plus `john-searle-vs-transformers`.
Les contrôles automatiques (forme, TRL, `documents_cles`, recopie) portent sur les 201 gaps et sont
rejouables à partir des trois jeux de données `data/seed/fiches_gap.json`, `fiches_ia.json` et les
six fichiers de `data/seed/fiches_humaines/`.

Aucun fichier de `data/seed/` n'a été lu autrement qu'en lecture, ni modifié.

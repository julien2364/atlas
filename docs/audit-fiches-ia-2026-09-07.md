# Audit contradictoire du référentiel IA — 44 fiches, 87 usages, 152 sources

> Deuxième vague, 07/09/2026. Ce rapport ne corrige rien : il constate.
> Aucun fichier de `data/seed/` n'a été modifié.

## Périmètre et méthode

L'audit du 07/09 (`docs/audit-fond-2026-09-07.md`) avait tiré 15 fiches IA au sort. Ce
rapport couvre **la totalité du référentiel : 44 fiches, 87 usages, 152 entrées de source**
(67 sources distinctes, dont 17 sans URL).

- **Les 44 fiches** ont été passées en revue sur le champ `usages[].trl` — les 87 usages
  sont rendus un par un dans le tableau exhaustif ci-dessous.
- **Les 29 fiches jamais relues** ont fait l'objet d'une lecture complète de leurs sources :
  36 URL ouvertes une par une par WebFetch, chaque fait, chiffre, nom et date de la fiche
  confronté au texte réellement servi.
- **Les 15 fiches déjà auditées** ne sont pas réauditées au-delà du TRL ; leurs notes et
  leurs findings sont repris du rapport du 07/09, avec attribution explicite.

**Sources non vérifiables pour cause de proxy** : une seule,
`https://fr.wikipedia.org/wiki/Modèle_ARIMA`, refusée trois fois avec
« *This domain is cache-only and cannot be fetched* » — alors que quatorze autres pages
`fr.wikipedia.org` ont répondu normalement. La fiche `series-temporelles-arima-sarima`
est donc marquée **non vérifiable**, et non fautive. L'homologue anglais a été consulté
à titre de contexte seulement.

**Trois URL du corpus renvoient une redirection 302** et ne servent plus la page annoncée :
`anthropic.com/education` → `claude.com/solutions/education`,
`anthropic.com/customers` → `claude.com/customers`,
`docs.claude.com` → `platform.claude.com/docs/en/home`,
`platform.openai.com/docs/models` → `developers.openai.com/api/docs/models`.
Les cibles ont été suivies et lues ; le constat de fond porte sur elles.

---

## 1. Résultat d'ensemble

| | Fidélité | Neutralité | Densité | Utilité |
|---|---|---|---|---|
| 29 fiches relues ici | **2,66** | **4,00** | **3,45** | **3,55** |
| 15 fiches (rappel 07/09) | 3,10 | 4,00 | 3,90 | 3,70 |
| **Ensemble des 44** | **2,82** | **4,00** | **3,59** | **3,61** |

La fidélité à la source est plus basse sur les 29 fiches non relues que sur l'échantillon
initial. Ce n'est pas un accident d'échantillonnage : le tirage du 07/09 avait pris une
part inhabituelle de fiches à source riche (bert, transformers, llama, alphafold), alors
que le reste du référentiel est composé en majorité de fiches de méthode adossées à un
unique article Wikipédia méthodologique, qui ne peut par construction attester aucun des
usages sectoriels annoncés.

**La neutralité reste bonne (4,00/5)** et le constat du 07/09 tient : aucune survalorisation
ouverte de l'IA, aucun superlatif non tenu. Deux exceptions en sens inverse sont documentées
plus bas (F-S3 et F-S4) : une omission de critique, et une minimisation qui va contre sa
propre source.

### Répartition des 87 usages après revue du TRL

| Verdict | Usages | Part |
|---|---|---|
| TRL à **monter** (sous-évalué, preuve dans la source) | **16** | 18 % |
| TRL à **baisser** (sur-évalué) | **2** | 2 % |
| TRL **défendable en l'état** | **11** | 13 % |
| **Non déterminable** d'après la source (ou non vérifiable) | **37** | 43 % |
| **Catégorie invalide** — le TRL n'a pas de référent | **21** | 24 % |

Le déséquilibre 16 / 2 confirme et généralise le finding F1 du 07/09 : quand le TRL est
faux, il est **presque toujours trop bas**. Le référentiel sous-estime systématiquement
la maturité de ce qu'il décrit, y compris lorsque la source qu'il cite documente
explicitement un déploiement de masse.

---

## 2. Le TRL — les trois défauts de gabarit

L'échelle TRL (NASA 1974, normalisée ISO 16290:2013, reprise en annexe G du programme
Horizon 2020) mesure une seule chose : **le degré auquel un système technologique donné a
été validé dans l'environnement où il est censé opérer**. Ses paliers sont définis par
l'environnement de validation — laboratoire (4), environnement représentatif (5-6),
environnement opérationnel (7-8), service courant avéré (9) — jamais par la valeur, la
nouveauté, l'actualité ou la diffusion de la technique.

Trois emplois du champ `trl` dans ce référentiel sortent de ce cadre. Ils se recoupent
partiellement et couvrent, ensemble, 21 des 87 usages en « catégorie invalide » et une
partie des 37 « non déterminables ».

### 2.1 Défaut A — le TRL attribué à un usage de recherche (28 usages, 32 %)

Déjà identifié comme F14 le 07/09, confirmé sur l'ensemble : **28 des 87 usages portent le
secteur `recherche` (19) ou `science` (9)**, TRL moyen 7,74 et 7,56.

Le champ y porte deux sens incompatibles selon les fiches :

- **`transformers` / recherche = TRL 9** et **`bert` / recherche = TRL 9** mesurent une
  *diffusion bibliographique* : « BERT is a common methodological component in NLP
  research ». Rien n'y est déployé.
- **`autogpt` / recherche = TRL 4** mesure une *fiabilité* : la source décrit des boucles
  infinies et des échecs de tâche.
- **`k-nn` / recherche = TRL 9** mesure une *ancienneté pédagogique* : « baseline de
  comparaison dans les publications ».

Un champ numérique qui signifie tantôt « très cité », tantôt « peu fiable », tantôt « très
ancien » n'est ni comparable ni agrégeable. La moyenne « TRL recherche = 7,74 » est un
nombre sans référent.

### 2.2 Défaut B — le TRL attribué à une méthode et non à un système (21 fiches, 42 usages)

**Vingt et une des 44 fiches décrivent une méthode ou une architecture, pas un système** :
`regression-lineaire`, `regression-logistique`, `arbres-de-decision`, `forets-aleatoires`,
`svm`, `k-nn`, `naive-bayes`, `k-means`, `pca`, `gradient-boosting`,
`series-temporelles-arima-sarima`, `perceptron-multicouche-mlp`, `cnn`, `rnn`, `lstm`,
`autoencodeurs`, `gan`, `transformers`, `alexnet`, `resnet`, `bert`.

La régression linéaire n'a pas de TRL. Une régression linéaire *implémentée dans un système
de prévision de charge déployé chez un opérateur donné* en a un. Le gabarit fait porter
au concept ce qui ne peut se dire que d'un déploiement, ce qui produit mécaniquement les
deux erreurs symétriques du corpus :

- **Vers le haut** : `alexnet` / industrie = TRL 9 (« fondation historique des systèmes de
  vision industriels »). AlexNet est une soumission à un concours de 2012, validée sur un
  benchmark. Le TRL 9 est celui de ses *successeurs*, pas le sien. **Sur-évaluation.**
- **Vers le bas** : `lstm` / industrie = TRL 8, alors que la source citée documente
  Google Translate (2016), Google Voice (2015), Siri, Alexa et 4,5 milliards de traductions
  Facebook par jour en 2017. **Sous-évaluation contredite par sa propre source.**

### 2.3 Défaut C — le TRL attribué à un phénomène (3 fiches, 7 usages)

Les trois fiches d'axe `limites` — `hallucination-et-fiabilite-factuelle`,
`biais-herites-des-donnees-d-entrainement`, `dependance-energetique-et-materielle` —
portent **7 usages assortis d'un TRL, dont cinq à 9**.

« Hallucination et fiabilité factuelle / gouvernement / TRL 9 » n'a littéralement aucun
sens : l'hallucination est un mode de défaillance, pas un système en service. La valeur
9 y traduit sans doute l'idée « le problème est bien réel et observé en conditions
réelles » — mais ce n'est pas ce que l'échelle mesure, et un lecteur qui agrège les TRL
du référentiel additionnera ces 9 aux autres. C'est le seul endroit du corpus où le champ
est non pas discutable mais **vide de référent**.

Aucun des sept ne peut être corrigé : ils sont à supprimer, pas à ajuster.

---

## 3. Recommandation sur le TRL en secteur recherche

**Recommandation : ne pas redéfinir le TRL — le rendre facultatif, et ajouter un indicateur
distinct qui porte ce que le corpus voulait réellement dire.**

### Pourquoi pas « redéfinir »

Redéfinir localement une échelle normalisée est la pire des trois options. Elle conserve
l'autorité empruntée à une norme externe (ISO 16290, Horizon 2020) tout en la vidant de son
contenu. Un lecteur institutionnel — et c'est le public visé par un référentiel qui sert de
socle à 201 fiches de gap — lira « TRL 9 » avec le sens de la norme, quelle que soit la
définition maison inscrite ailleurs dans la documentation. La confusion actuelle vient
précisément de là.

### Pourquoi pas « retirer la catégorie `recherche` »

Parce que le problème n'est pas le secteur, mais l'objet. Certains usages de secteur
`recherche` décrivent bel et bien un système en service opérationnel et méritent un TRL :
la base AlphaFold sert des chercheurs depuis 2021 (TRL 9), le contrôleur DeepMind tourne
sur le tokamak TCV réel (TRL 7). Retirer le secteur ferait perdre ces cas, tout en laissant
intacts les défauts B et C, qui frappent `industrie` autant que `recherche`.

### Ce que je recommande, en trois points

**1. `trl` devient facultatif, et n'est renseigné que pour un système déployé dans un
contexte opérationnel identifiable** — c'est-à-dire quand on peut nommer *qui* l'exploite,
*où*, et *depuis quand*. Le critère est opérationnel et vérifiable : s'il est impossible
d'écrire cette phrase, le champ vaut `null`. Il faut donc que **`null` devienne une valeur
autorisée par le schéma**, avec la sémantique « non déterminable » — 37 des 87 usages, soit
43 %, relèvent aujourd'hui de ce cas et sont pourtant obligés de porter un entier.

**2. Un second champ, `diffusion`, distinct et non numéroté de 1 à 9**, porte ce que les
TRL de secteur `recherche` essayaient de dire. Quatre valeurs ordinales suffisent :
`emergent` / `etabli` / `standard` / `historique`. Le choix de libellés textuels plutôt
que d'une échelle chiffrée est délibéré : il rend impossible la confusion avec le TRL et
interdit l'agrégation abusive. Ce champ résout les cas `transformers`, `bert`, `k-nn`,
`perceptron-multicouche-mlp`, `alexnet`/recherche — soit l'essentiel des 28.

**3. `trl` s'accompagne obligatoirement d'un `trl_justification` d'une phrase citant le
déploiement qui le fonde.** C'est le point qui rend le référentiel auditable. Aujourd'hui
`npm run valider` accepte n'importe quel entier de 1 à 9 sans preuve, et sort à 0 erreur
sur les sept TRL de l'axe `limites` comme sur le TRL 9 d'AlexNet. Une justification
obligatoire aurait rendu ces valeurs impossibles à écrire.

**Effet attendu sur le corpus** : les 21 usages en « catégorie invalide » perdent leur TRL
(7 supprimés définitivement sur l'axe `limites`, 14 basculés vers `diffusion`), les 37
« non déterminables » passent à `null` en attendant une source qui les fonde, et les 29
restants portent un TRL justifié — dont 16 à relever et 2 à abaisser.

---

## 4. Tableau exhaustif des 87 usages

Ordre du fichier `data/seed/fiches_ia.json`. « Catégorie invalide » et « sans objet » renvoient aux défauts A, B et C de la section 2.

| Fiche | Secteur | TRL déclaré | TRL défendable | Justification | Source de l'usage |
|---|---|---|---|---|---|
| `claude-anthropic-cowork` | education | **7** | 9 | Produit commercialisé ; la source (redirigée vers claude.com/solutions/education) affiche dix universités clientes. Les deux exemples (plans différenciés, correction de copies) ne sont pas attestés. | [Anthropic — Claude for Education](https://www.anthropic.com/education) |
| `claude-anthropic-cowork` | recherche | **6** | non déterminable | La source citée (anthropic.com/customers) ne liste **aucun** client de recherche scientifique : Notion, Slack, Figma, Pictet, Doordash, Spotify… L'usage entier est sans support. | [Anthropic — Claude for research use cases](https://www.anthropic.com/customers) |
| `codex-famille-gpt` | industrie | **7** | 9 | La source dit « Now available in the ChatGPT app » et nomme six entreprises utilisatrices (Duolingo, Cisco Meraki, Ramp, Harvey, Sierra, Wonderful). Produit en disponibilité générale et en production chez des clients nommés. | [OpenAI — Codex](https://openai.com/codex) |
| `deepseek` | recherche | **7** | 9 si la catégorie est maintenue | Modèles publiés sous licence MIT depuis janvier 2025 et massivement réutilisés — mais « réutilisé par des chercheurs » n'est pas un niveau TRL. La fiche omet par ailleurs l'usage grand public (n°1 App Store US le 27/01/2025), lui clairement TRL 9. | [DeepSeek — Wikipedia (article en anglais)](https://en.wikipedia.org/wiki/DeepSeek) |
| `alexnet` | industrie | **9** | 4 | AlexNet est une soumission à un concours, validée sur un benchmark de laboratoire (ImageNet). La source ne documente aucun déploiement industriel. Le TRL 9 déclaré porte sur les successeurs d'AlexNet, pas sur AlexNet. | [AlexNet — Wikipedia (EN)](https://en.wikipedia.org/wiki/AlexNet) |
| `alexnet` | recherche | **9** | catégorie invalide | « Architecture de référence ayant déclenché une vague de recherche » décrit une influence bibliographique, pas la maturité d'un système. | [AlexNet — Wikipedia (EN)](https://en.wikipedia.org/wiki/AlexNet) |
| `yolo` | industrie | **9** | non déterminable | Audit 07/09 : source purement architecturale (v1→v8+, « one forward propagation pass »), aucun déploiement décrit. | [You Only Look Once — Wikipedia (EN)](https://en.wikipedia.org/wiki/You_Only_Look_Once) |
| `yolo` | gouvernement | **7** | non déterminable | Audit 07/09 : aucun élément de la source ne permet de fixer un TRL ; exemples de vidéosurveillance non attestés. | [You Only Look Once — Wikipedia (EN)](https://en.wikipedia.org/wiki/You_Only_Look_Once) |
| `resnet` | industrie | **9** | non déterminable | La source ne mentionne « ni reconnaissance faciale, ni système industriel » — uniquement la vision par ordinateur générale et les architectures dérivées. ResNet est en fait un backbone très largement déployé, mais rien dans la source ne le montre. | [Residual neural network — Wikipedia (EN)](https://en.wikipedia.org/wiki/Residual_neural_network) |
| `resnet` | recherche | **9** | catégorie invalide | Usage de publication, pas de système. | [Residual neural network — Wikipedia (EN)](https://en.wikipedia.org/wiki/Residual_neural_network) |
| `bert` | industrie | **9** | 9 | La source documente le déploiement : « October 25, 2019 » sur Google Search US, « over 70 languages » au 09/12/2019, et en octobre 2020 « almost every single English-based query was processed by a BERT model ». Seul TRL 9 pleinement démontré par sa propre source dans tout le corpus. | [BERT (language model) — Wikipedia (EN)](https://en.wikipedia.org/wiki/BERT_(language_model)) |
| `bert` | recherche | **9** | catégorie invalide | « BERT is a common methodological component in NLP research » : diffusion académique, pas maturité de déploiement. | [BERT (language model) — Wikipedia (EN)](https://en.wikipedia.org/wiki/BERT_(language_model)) |
| `llama` | industrie | **9** | 9 | Source : Meta AI construit sur Llama 3 ; Zoom AI Companion sur Llama 2 ; Booz Allen Hamilton déploie Llama 3.2 à bord de l'ISS. Déploiements opérationnels nommés. | [Llama (language model) — Wikipedia (EN)](https://en.wikipedia.org/wiki/Llama_(language_model)) |
| `llama` | recherche | **8** | catégorie invalide | Alpaca, Meditron, dérivés académiques : diffusion, pas maturité. | [Llama (language model) — Wikipedia (EN)](https://en.wikipedia.org/wiki/Llama_(language_model)) |
| `alphago-alphazero-alphafold` | science | **9** | non déterminable | **La source citée ne documente pas l'usage.** Dans l'article AlphaGo, le mot « AlphaFold » n'apparaît que dans la section « See also ». Rien sur le repliement des protéines, la base AlphaFold, ni les maladies négligées. | [AlphaGo — Wikipedia (EN)](https://en.wikipedia.org/wiki/AlphaGo) |
| `alphago-alphazero-alphafold` | pharmaceutique | **7** | non déterminable | Idem. Seule mention voisine : « A 2018 paper in Nature cited AlphaGo's approach as the basis for a new means of computing potential pharmaceutical drug molecules » — ce qui ne concerne pas AlphaFold. | [AlphaGo — Wikipedia (EN)](https://en.wikipedia.org/wiki/AlphaGo) |
| `stable-diffusion-midjourney-dall-e` | industrie | **9** | 9 | Défendable : la source décrit un modèle dont « code and model weights have been released publicly » et qui tourne « on most consumer hardware ». Mais aucun des exemples (agences de design, jeu vidéo, mode) n'est dans la source. | [Stable Diffusion — Wikipedia (EN)](https://en.wikipedia.org/wiki/Stable_Diffusion) |
| `stable-diffusion-midjourney-dall-e` | education | **6** | non déterminable | Aucune mention d'usage pédagogique dans la source. | [Stable Diffusion — Wikipedia (EN)](https://en.wikipedia.org/wiki/Stable_Diffusion) |
| `regression-lineaire` | industrie | **9** | non déterminable | La source ne mentionne aucun exemple de prévision commerciale ou marketing ; ses applications sont scientifiques (rendements de l'éducation, analyse électorale, démographie). | [Régression linéaire — Wikipédia](https://fr.wikipedia.org/wiki/Régression_linéaire) |
| `regression-lineaire` | recherche | **9** | catégorie invalide | La régression linéaire est une méthode, pas un système : elle n'a pas de TRL propre. Les usages de recherche cités par la source sont réels. | [Régression linéaire — Wikipédia](https://fr.wikipedia.org/wiki/Régression_linéaire) |
| `regression-logistique` | industrie | **9** | 9 | La source nomme les domaines : « Dans le domaine bancaire, pour détecter les groupes à risque lors de la souscription d'un crédit », assurance. Générique mais convergent. | [Régression logistique — Wikipédia](https://fr.wikipedia.org/wiki/Régression_logistique) |
| `regression-logistique` | pharmaceutique | **8** | non déterminable | La source reste au niveau générique (« trouver les facteurs qui caractérisent un groupe de sujets malades ») ; aucun score clinique déployé nommé. | [Régression logistique — Wikipédia](https://fr.wikipedia.org/wiki/Régression_logistique) |
| `arbres-de-decision` | gouvernement | **9** | non déterminable | Audit 07/09 confirmé : source purement didactique (ID3, C4.5, CART, outils R/Weka/scikit-learn) ; « éligibilité aux aides sociales » absent. | [Arbre de décision (apprentissage) — Wikipédia](https://fr.wikipedia.org/wiki/Arbre_de_décision_(apprentissage)) |
| `arbres-de-decision` | industrie | **9** | non déterminable | « Segmentation marketing » et « diagnostic de pannes » absents de la source. | [Arbre de décision (apprentissage) — Wikipédia](https://fr.wikipedia.org/wiki/Arbre_de_décision_(apprentissage)) |
| `forets-aleatoires` | industrie | **9** | non déterminable | Le seul cas d'application de la source est le « modèle uplift » (marketing ciblé) ; maintenance prédictive et scoring assurance absents. | [Forêt d'arbres décisionnels — Wikipédia](https://fr.wikipedia.org/wiki/Forêt_d'arbres_décisionnels) |
| `forets-aleatoires` | pharmaceutique | **7** | non déterminable | Réhospitalisation et classification de profils de patients absents de la source. | [Forêt d'arbres décisionnels — Wikipédia](https://fr.wikipedia.org/wiki/Forêt_d'arbres_décisionnels) |
| `svm` | science | **8** | non déterminable | La source cite des domaines (« bio-informatique, recherche d'information, vision par ordinateur, finance ») sans aucun système ni déploiement. | [Machine à vecteurs de support — Wikipédia](https://fr.wikipedia.org/wiki/Machine_à_vecteurs_de_support) |
| `svm` | industrie | **8** | non déterminable | Filtrage de spam et reconnaissance d'écriture manuscrite absents de la source. | [Machine à vecteurs de support — Wikipédia](https://fr.wikipedia.org/wiki/Machine_à_vecteurs_de_support) |
| `k-nn` | industrie | **8** | non déterminable | Systèmes de recommandation et détection d'anomalies absents de la source ; seul exemple donné : « micro-tableau de données génétiques ». | [Méthode des k plus proches voisins — Wikipédia](https://fr.wikipedia.org/wiki/Méthode_des_k_plus_proches_voisins) |
| `k-nn` | recherche | **9** | catégorie invalide | « Baseline pédagogique » n'est pas un niveau de maturité technologique. | [Méthode des k plus proches voisins — Wikipédia](https://fr.wikipedia.org/wiki/Méthode_des_k_plus_proches_voisins) |
| `naive-bayes` | industrie | **9** | 9 | La source atteste le cas principal : « classifier des documents par leur contenu, par exemple des E-mails en spam et non-spam ». Le filtrage bayésien anti-spam est un déploiement de masse historique. | [Classification naïve bayésienne — Wikipédia](https://fr.wikipedia.org/wiki/Classification_naïve_bayésienne) |
| `naive-bayes` | recherche | **8** | catégorie invalide | « Baseline de comparaison » : diffusion académique. | [Classification naïve bayésienne — Wikipédia](https://fr.wikipedia.org/wiki/Classification_naïve_bayésienne) |
| `k-means` | industrie | **9** | non déterminable | Aucun des exemples (segmentation clientèle, marketing ciblé, catalogue produits) n'est dans la source ; son unique application concrète est la réduction du nombre de couleurs d'une image. | [K-moyennes — Wikipédia](https://fr.wikipedia.org/wiki/K-moyennes) |
| `k-means` | recherche | **9** | catégorie invalide | Analyse exploratoire : pratique de recherche, pas système déployé. | [K-moyennes — Wikipédia](https://fr.wikipedia.org/wiki/K-moyennes) |
| `pca` | science | **9** | catégorie invalide | La source atteste l'usage (données climatiques, imagerie scintigraphique) mais l'ACP est une méthode statistique : elle n'a pas de TRL. Génomique et géophysique absentes de la source. | [Analyse en composantes principales — Wikipédia](https://fr.wikipedia.org/wiki/Analyse_en_composantes_principales) |
| `pca` | industrie | **9** | non déterminable | Prétraitement et compression attestés génériquement ; aucun système identifié. | [Analyse en composantes principales — Wikipédia](https://fr.wikipedia.org/wiki/Analyse_en_composantes_principales) |
| `gradient-boosting-xgboost-lightgbm-catboost` | industrie | **9** | non déterminable | **XGBoost, LightGBM et CatBoost — qui donnent son nom à la fiche — sont absents de l'unique source.** Ses seuls cas concrets : « learning to rank » chez Yahoo et Yandex, physique des hautes énergies, « quality evaluation of sandstone reservoir ». Ni scoring de crédit ni détection de fraude. | [Gradient boosting — Wikipedia (EN)](https://en.wikipedia.org/wiki/Gradient_boosting) |
| `gradient-boosting-xgboost-lightgbm-catboost` | gouvernement | **7** | non déterminable | Ciblage de contrôles publics et fraude fiscale/sociale entièrement absents de la source. | [Gradient boosting — Wikipedia (EN)](https://en.wikipedia.org/wiki/Gradient_boosting) |
| `series-temporelles-arima-sarima` | industrie | **9** | non vérifiable | Source `fr.wikipedia.org/wiki/Modèle_ARIMA` non joignable par le proxy (« domain is cache-only »), trois tentatives. L'homologue anglais ne contient aucun exemple d'application (ventes, énergie, macroéconomie). | [Modèle ARIMA — Wikipédia](https://fr.wikipedia.org/wiki/Modèle_ARIMA) |
| `series-temporelles-arima-sarima` | gouvernement | **9** | non vérifiable | Idem. « Prévisions macroéconomiques par les instituts statistiques nationaux » est plausible mais reste à tracer. | [Modèle ARIMA — Wikipédia](https://fr.wikipedia.org/wiki/Modèle_ARIMA) |
| `perceptron-multicouche-mlp` | industrie | **8** | non déterminable | La source est purement théorique (propagation avant/arrière, fonctions d'activation, optimiseurs). Aucune application pratique, aucun exemple de capteurs ni de scoring. | [Perceptron multicouche — Wikipédia](https://fr.wikipedia.org/wiki/Perceptron_multicouche) |
| `perceptron-multicouche-mlp` | recherche | **9** | catégorie invalide | « Brique de base pédagogique et historique » : influence, pas maturité. | [Perceptron multicouche — Wikipédia](https://fr.wikipedia.org/wiki/Perceptron_multicouche) |
| `cnn` | pharmaceutique | **8** | non déterminable | Audit 07/09 confirmé : la source ne nomme que « reconnaissance d'image et vidéo, systèmes de recommandation, traitement du langage naturel ». Aucun système d'imagerie médicale homologué. | [Réseau neuronal convolutif — Wikipédia](https://fr.wikipedia.org/wiki/Réseau_neuronal_convolutif) |
| `cnn` | industrie | **9** | non déterminable | Contrôle qualité en usine et véhicules autonomes absents de la source. | [Réseau neuronal convolutif — Wikipédia](https://fr.wikipedia.org/wiki/Réseau_neuronal_convolutif) |
| `rnn` | industrie | **7** | 9 (historique) | Audit 07/09 : les systèmes de traduction neuronale à base de RNN/LSTM ont été en production commerciale des années avant leur remplacement. La fiche confond « obsolète aujourd'hui » et « jamais mûr ». | [Réseau de neurones récurrents — Wikipédia](https://fr.wikipedia.org/wiki/Réseau_de_neurones_récurrents) |
| `rnn` | recherche | **7** | catégorie invalide | Usage de recherche. | [Réseau de neurones récurrents — Wikipédia](https://fr.wikipedia.org/wiki/Réseau_de_neurones_récurrents) |
| `lstm` | industrie | **8** | 9 | **Contredit par sa propre source**, qui documente : Google Voice (2015), « Google released the Google Neural Machine Translation system for Google Translate which used LSTMs to reduce translation errors by 60% » (2016), Siri/quicktype (Apple), Amazon Polly/Alexa, et « 2017: Facebook performed some 4.5 billion automatic translations every day using long short-term memory networks ». | [Long short-term memory — Wikipedia (EN)](https://en.wikipedia.org/wiki/Long_short-term_memory) |
| `lstm` | industrie | **8** | 8 | « Energy forecasting » et « time series anomaly detection » figurent dans la source comme domaines d'application, sans système ni organisation nommés. 8 est tenable, 9 non démontré. | [Long short-term memory — Wikipedia (EN)](https://en.wikipedia.org/wiki/Long_short-term_memory) |
| `autoencodeurs` | industrie | **8** | non déterminable | La détection d'anomalies et de fraude — l'usage entier — **est absente de la source**, qui traite réduction de dimension, apprentissage génératif et débruitage. | [Autoencodeur — Wikipédia](https://fr.wikipedia.org/wiki/Autoencodeur) |
| `autoencodeurs` | science | **7** | non déterminable | Le débruitage est attesté ; la compression de données génomiques ou d'imagerie scientifique ne l'est pas. | [Autoencodeur — Wikipédia](https://fr.wikipedia.org/wiki/Autoencodeur) |
| `gan` | industrie | **8** | 9 | La source documente des artefacts commerciaux réels : Artbreeder (2020), GameGAN de Nvidia (mai 2020), « This Person Does Not Exist », et une toile GAN vendue « US$432,500 ». Produits publics en service. | [Generative adversarial network — Wikipedia (EN)](https://en.wikipedia.org/wiki/Generative_adversarial_network) |
| `gan` | recherche | **7** | catégorie invalide | Usage de recherche. | [Generative adversarial network — Wikipedia (EN)](https://en.wikipedia.org/wiki/Generative_adversarial_network) |
| `transformers` | industrie | **9** | 9 | La source documente Google Search (BERT, octobre 2019), Google Translate (2020), ChatGPT (fin 2022), Whisper, DALL-E, Stable Diffusion 3, Sora. Déploiement mondial avéré. | [Transformer (deep learning architecture) — Wikipedia (EN)](https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)) |
| `transformers` | recherche | **9** | catégorie invalide | Audit 07/09 : TRL 9 attribué à un usage de publication. | [Transformer (deep learning architecture) — Wikipedia (EN)](https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)) |
| `autogpt` | industrie | **4** | 4 | Cohérent avec la source, qui documente « tendency to get stuck in infinite loops », l'absence de mémoire long terme, la fenêtre de contexte finie et des coûts d'exploitation élevés. **Le seul TRL du corpus dont la valeur basse est explicitement justifiée par la source.** | [AutoGPT — Wikipedia](https://en.wikipedia.org/wiki/AutoGPT) |
| `autogpt` | recherche | **4** | 4 | Idem : ChaosGPT, ChefGPT et l'échec sur l'adresse e-mail sont des expérimentations publiques, pas un déploiement. | [AutoGPT — Wikipedia](https://en.wikipedia.org/wiki/AutoGPT) |
| `openai-operator-agents-de-navigation-web` | industrie | **6** | 8 | La source dit « On January 23, 2025, OpenAI released Operator » et note une disponibilité restreinte (« Pro users in the United States »). Un produit publié en accès restreint est TRL 8, pas 6. | [OpenAI — Wikipedia (EN)](https://en.wikipedia.org/wiki/OpenAI) |
| `openai-operator-agents-de-navigation-web` | gouvernement | **4** | non déterminable | Aucune mention d'assistance aux démarches administratives dans la source. Usage entièrement non attesté. | [OpenAI — Wikipedia (EN)](https://en.wikipedia.org/wiki/OpenAI) |
| `devin-cognition-ai` | industrie | **6** | 5 | La source ne documente que des démonstrations, dont plusieurs critiquées publiquement (« criticized the tool for failing to deliver on the project request »). Ni tickets de bugs, ni suites de tests, ni client. TRL 6 non soutenu. | [Devin AI — Wikipedia (EN)](https://en.wikipedia.org/wiki/Devin_AI) |
| `devin-cognition-ai` | recherche | **6** | non déterminable | **SWE-bench, unique exemple de cet usage, est absent de la source.** Aucun usage de Devin comme objet de benchmarking académique n'y figure. | [Devin AI — Wikipedia (EN)](https://en.wikipedia.org/wiki/Devin_AI) |
| `frameworks-multi-agents-langgraph-crewai-autogen` | industrie | **6** | non déterminable | Audit 07/09 : la seule source à URL (Wikipedia LangChain) « ne mentionne ni CrewAI ni AutoGen » et aucune implémentation en production. | LangChain, CrewAI, AutoGen — documentation des projets *(sans URL)* |
| `frameworks-multi-agents-langgraph-crewai-autogen` | recherche | **6** | non déterminable | Idem ; l'usage repose entièrement sur une source primaire sans URL. | LangChain, CrewAI, AutoGen — documentation des projets *(sans URL)* |
| `alphafold-deepmind` | recherche | **8** | 9 | La source (Wikipédia FR) documente une base publique en service depuis 2021 : « plus de 365 000 protéines humaines », puis en 2024 « presque toutes les protéines connues ». Infrastructure opérationnelle, pas prototype. | Nature — AlphaFold Protein Structure Database *(sans URL)* |
| `alphafold-deepmind` | pharmaceutique | **6** | 8 | La source nomme un usage industriel réel : « L'entreprise Isomorphic Labs a déclaré en mai 2024 qu'elle utilisait déjà AlphaFold 3 avec d'autres modèles d'IA pour automatiser le processus de découverte de médicaments ». TRL 6 sous-évalue nettement. | [AlphaFold — Wikipédia (article en français)](https://fr.wikipedia.org/wiki/AlphaFold) |
| `gnome-decouverte-de-materiaux` | science | **7** | 7 | Soutenable : les sources secondaires attestent « over 2 million new materials », une validation par « autonomous robotic experiments, with a success rate of 71% » et 736 matériaux synthétisés par le MIT. Batteries, supraconducteurs et semi-conducteurs sont en revanche absents des deux sources. | GNoME (Google DeepMind, 2023) *(sans URL)* |
| `gnome-decouverte-de-materiaux` | industrie | **5** | non déterminable | Aucun usage industriel de GNoME attesté ; la source rapporte au contraire une critique de son utilité pratique. | GNoME (Google DeepMind, 2023) *(sans URL)* |
| `ia-pour-le-controle-de-plasma-en-fusion-nucleaire` | science | **6** | 7 | Le billet DeepMind décrit des contrôleurs exécutés sur le tokamak TCV réel de l'EPFL, stabilisant cinq configurations distinctes dont une « close to the proposal for ITER ». Démonstration en environnement opérationnel réel, pas simulation : TRL 7, non 6. | DeepMind — Magnetic control of tokamak plasmas (Nature, 2022) *(sans URL)* |
| `ia-pour-le-controle-de-plasma-en-fusion-nucleaire` | industrie | **4** | 4 | Cohérent : aucun réacteur commercial n'existe. Valeur défendable en l'état. | DeepMind — Magnetic control of tokamak plasmas (Nature, 2022) *(sans URL)* |
| `ia-en-genomique-et-drug-discovery` | pharmaceutique | **7** | non déterminable | Audit 07/09 : redite d'`alphafold-deepmind`, source primaire au titre non identifiable. | AlphaFold — impact sur la recherche pharmaceutique *(sans URL)* |
| `ia-en-genomique-et-drug-discovery` | science | **8** | non déterminable | Idem. | AlphaFold — impact sur la recherche pharmaceutique *(sans URL)* |
| `ia-en-modelisation-climatique-type-graphcast` | gouvernement | **7** | non déterminable | Audit 07/09 : la source secondaire ne parle jamais de GraphCast mais de GenCast ; source primaire sans URL. | GraphCast (Google DeepMind, publié dans Science, 2023) *(sans URL)* |
| `ia-en-modelisation-climatique-type-graphcast` | science | **7** | non déterminable | Idem. | GraphCast (Google DeepMind, publié dans Science, 2023) *(sans URL)* |
| `hallucination-et-fiabilite-factuelle-limite-transversale` | gouvernement | **9** | sans objet | **L'hallucination est un mode de défaillance, pas un système.** « TRL 9 » n'a aucun référent ici. Le contenu de la fiche est par ailleurs le mieux sourcé du corpus. | [Hallucination (intelligence artificielle) — Wikipédia](https://fr.wikipedia.org/wiki/Hallucination_(intelligence_artificielle)) |
| `hallucination-et-fiabilite-factuelle-limite-transversale` | recherche | **8** | sans objet | Idem. | [Hallucination (intelligence artificielle) — Wikipédia](https://fr.wikipedia.org/wiki/Hallucination_(intelligence_artificielle)) |
| `hallucination-et-fiabilite-factuelle-limite-transversale` | industrie | **9** | sans objet | Idem. | [Hallucination (intelligence artificielle) — Wikipédia](https://fr.wikipedia.org/wiki/Hallucination_(intelligence_artificielle)) |
| `biais-herites-des-donnees-d-entrainement-limite-transversale` | gouvernement | **9** | sans objet | Un biais hérité est un phénomène, pas un système déployé. Les exemples (audits imposés par réglementation, contentieux) sont en outre absents de la seule source à URL. | Recherche académique sur l'équité algorithmique (fairness in ML) *(sans URL)* |
| `biais-herites-des-donnees-d-entrainement-limite-transversale` | industrie | **9** | sans objet | Idem. | Recherche académique sur l'équité algorithmique (fairness in ML) *(sans URL)* |
| `dependance-energetique-et-materielle-de-l-ia-limite-transversale` | gouvernement | **9** | sans objet | Une contrainte d'approvisionnement n'a pas de niveau de maturité technologique. | Rapports sur l'empreinte énergétique de l'IA (AIE, études académiques) *(sans URL)* |
| `dependance-energetique-et-materielle-de-l-ia-limite-transversale` | industrie | **9** | sans objet | Idem. | Rapports sur l'empreinte énergétique de l'IA (AIE, études académiques) *(sans URL)* |
| `jumeaux-numeriques-industriels-ia` | industrie | **8** | 9 | La source atteste des déploiements réels : jumeaux de « turbines de production d'énergie, moteurs à réaction et locomotives » (GE), surveillance/diagnostic/pronostic. Produits industriels en service : 9, non 8. | Jumeaux numériques industriels — documentation sectorielle (Siemens, GE, Dassault Systèmes) *(sans URL)* |
| `jumeaux-numeriques-industriels-ia` | gouvernement | **6** | non déterminable | Les infrastructures publiques (réseaux d'eau, d'énergie, transports) sont **absentes** de la source, centrée sur les équipements industriels. | Jumeaux numériques industriels — documentation sectorielle (Siemens, GE, Dassault Systèmes) *(sans URL)* |
| `tutorat-adaptatif-personnalise-edtech-ia` | education | **7** | 9 | La source documente un déploiement de masse : « the Cognitive Tutor has been incorporated into mathematics curricula in a substantial number of United States high schools ». TRL 7 sous-évalue. | Systèmes de tutorat adaptatif — documentation sectorielle EdTech *(sans URL)* |
| `tutorat-adaptatif-personnalise-edtech-ia` | industrie | **6** | 8 | La source dit : « these systems have found homes in the sphere of corporate training and organizational learning ». Déploiement attesté mais non chiffré : 8, non 6. | Systèmes de tutorat adaptatif — documentation sectorielle EdTech *(sans URL)* |
| `criblage-virtuel-de-molecules-ia-pharmaceutique` | pharmaceutique | **7** | 9 | La source décrit le criblage virtuel prospectif comme une pratique établie dont « the resulting hits are subjected to experimental confirmation (e.g., IC50 measurements) » — un procédé de routine dans l'industrie, pas un prototype. La conception *de novo* et les acteurs annoncés sont en revanche absents. | Criblage virtuel de molécules par IA — documentation sectorielle pharmaceutique *(sans URL)* |
| `criblage-virtuel-de-molecules-ia-pharmaceutique` | science | **7** | catégorie invalide | Usage de recherche académique en chimie médicinale. | Criblage virtuel de molécules par IA — documentation sectorielle pharmaceutique *(sans URL)* |
| `aide-a-la-decision-publique-govtech-ia` | gouvernement | **6** | 9 (historique) | Audit 07/09 : SyRI et la notation des A-levels étaient des systèmes déployés à l'échelle nationale ; leur retrait est juridique, non technique. | Systèmes d'aide à la décision publique par IA — documentation GovTech *(sans URL)* |
| `aide-a-la-decision-publique-govtech-ia` | gouvernement | **6** | 9 (historique) | Idem. | Systèmes d'aide à la décision publique par IA — documentation GovTech *(sans URL)* |

---

## 5. Findings par gravité

Numérotation `F-B*` (bloquant), `F-S*` (sérieux), `F-M*` (mineur). Les findings du 07/09
conservent leur numérotation d'origine (F1 à F14) et ne sont pas répétés ici, sauf
extension mesurée.

**Décompte : 4 bloquants, 11 sérieux, 9 mineurs.**

### Bloquants

#### F-B1 — `alphago-alphazero-alphafold` : la source citée ne documente aucun des deux usages

**Citation fautive (fiche)** : usage 0, secteur `science`, TRL 9 — *« Résolution du problème
du repliement des protéines, considéré comme l'un des grands défis non résolus de la
biologie structurale »*, exemples *« Base de données AlphaFold couvrant la quasi-totalité
des protéines connues »* et *« Accélération de la recherche sur les maladies et la
conception de médicaments »*. Usage 1, secteur `pharmaceutique`, TRL 7 — *« Identification
de cibles protéiques pour la conception de nouveaux médicaments »*, *« Étude de protéines
impliquées dans des maladies négligées »*.

**Source unique de la fiche et des deux usages** : `https://en.wikipedia.org/wiki/AlphaGo`.

**Ce que dit réellement la source** : le mot « AlphaFold » **n'apparaît qu'une seule fois,
dans la section « See also »**, sans une ligne de développement. Rien sur le repliement des
protéines, rien sur la base AlphaFold, rien sur les maladies négligées. La seule phrase
voisine du sujet est : *« A 2018 paper in Nature cited AlphaGo's approach as the basis for
a new means of computing potential pharmaceutical drug molecules »* — qui concerne la
méthode d'AlphaGo, pas AlphaFold.

Autrement dit, **une fiche dont deux usages sur deux portent sur AlphaFold est adossée à un
article qui ne parle pas d'AlphaFold**. C'est le cas le plus net du corpus d'un contenu
entièrement non tracé à sa source.

**Correction proposée** : soit citer Jumper et al., *Nature* 2021
(`https://www.nature.com/articles/s41586-021-03819-2`) et la base
`https://alphafold.ebi.ac.uk/` ; soit — plus juste — reconnaître que cette fiche fait
doublon avec `alphafold-deepmind` (qui, elle, cite la bonne source et la respecte) et la
recentrer sur AlphaGo/AlphaZero, dont l'article cité traite effectivement.

#### F-B2 — TRL attribué à un phénomène sur l'axe `limites` (7 usages, 3 fiches)

**Citation fautive** : `hallucination-et-fiabilite-factuelle-limite-transversale`,
usage 0, `"secteur": "gouvernement", "trl": 9` ; usage 1 `recherche`, TRL 8 ; usage 2
`industrie`, TRL 9. Idem `biais-herites-des-donnees-d-entrainement` (9, 9) et
`dependance-energetique-et-materielle` (9, 9).

**Ce qui est en cause** : l'échelle TRL qualifie la maturité d'un système en vue d'une
mission. L'hallucination, le biais hérité et la dépendance énergétique sont des propriétés
et des contraintes, pas des systèmes. Aucune des trois ne peut être « démontrée en
environnement opérationnel ». Le validateur ne détecte rien, puisque 9 est un entier valide.

**Correction proposée** : supprimer le champ `trl` sur l'axe `limites`, ou rendre l'axe
incompatible avec le champ au niveau du schéma. Aucun ajustement de valeur ne sauve ces
sept entrées. Voir la recommandation en 3.

#### F-B3 — Le champ `type` des sources est non informatif (35 fiches sur 44, 80 %)

**Citation fautive** : dans `alexnet`, `https://en.wikipedia.org/wiki/AlexNet` est typé
`"type": "primaire"` au niveau fiche et `"type": "secondaire"` au niveau usage — **la même
URL, dans la même fiche, avec deux types contradictoires**. Le cas se répète à l'identique
sur **35 des 44 fiches**, dont les 27 fiches de méthode et `openai-operator`, `devin`,
`govtech`, `jumeaux`, `tutorat`, `criblage`, `biais`, `dependance-energetique`,
`ia-en-genomique`, `frameworks-multi-agents`.

**Second volet, plus grave** : **27 fiches sur 44 (61 %) typent un article Wikipédia comme
source `primaire`**, et cet article est leur **unique** source de niveau fiche. Wikipédia
est une source tertiaire par construction — c'est une encyclopédie qui synthétise des
sources secondaires. Aucune de ces 27 fiches ne cite donc la moindre source primaire réelle,
alors que le champ affirme le contraire pour chacune.

Sur les 152 entrées de source du référentiel, 57 sont typées `primaire`. En retirant les 27
Wikipédia mal typées et les 17 intitulés sans URL (section 6), **il reste 13 entrées
`primaire` réellement primaires**, toutes concentrées sur 3 fiches (`claude-anthropic-cowork`,
`codex-famille-gpt`, `ia-pour-le-controle-de-plasma`) — et deux d'entre elles sont des pages
marketing d'éditeur (voir F-S1 et F-S10).

**Correction proposée** : (a) retyper les 27 Wikipédia en `tertiaire` — valeur à ajouter à
l'énumération — ou à défaut `secondaire` ; (b) faire du `type` une propriété de la source
et non de son emplacement, pour qu'une même URL ne puisse pas porter deux types dans une
même fiche ; (c) ajouter au validateur un contrôle de cohérence de typage par URL.

#### F-B4 — Sources `primaire` sans URL : 17 intitulés, 39 occurrences, 15 fiches sur 44

Extension confirmée de **F2** (07/09), qui portait sur 6 des 15 fiches échantillonnées.
Sur l'ensemble : **15 fiches sur 44 (34 %) citent au moins une source sans URL**, pour
**39 occurrences** au total. Aucune des 17 n'a pu être localisée, et 11 des 17 sont typées
`primaire`. Liste complète et proposition pour chacune en section 6.

Trois fiches — `gnome-decouverte-de-materiaux`, `ia-pour-le-controle-de-plasma`,
`ia-en-modelisation-climatique-type-graphcast` — font reposer **la totalité de leurs usages**
sur une source sans URL, alors qu'elles disposent par ailleurs de sources à URL au niveau
fiche. Deux d'entre elles renvoient à des publications *Nature* et *Science* parfaitement
identifiables, dont l'URL est fournie en section 6.

### Sérieux

#### F-S1 — `claude-anthropic-cowork` : l'usage `recherche` n'est adossé à rien

**Citation fautive** : usage 1, `recherche`, TRL 6 — *« Revue de littérature assistée,
synthèse de corpus documentaires »*, exemples *« Synthèse comparative de plusieurs papiers
arXiv sur une question de recherche donnée »*, *« Extraction structurée de données depuis
des PDF de publications scientifiques »*. Source : *« Anthropic — Claude for research use
cases »*, `https://www.anthropic.com/customers`, typée `primaire`.

**Ce que dit réellement la source** (suivie jusqu'à `claude.com/customers`) : elle ne
documente **aucun** usage de recherche scientifique et ne nomme **aucun** client de
recherche. Les clients affichés sont Notion, Slack, Figma, HubSpot, Atlassian, Pictet,
Carvana, DoorDash, Spotify, Ramp, Spellbook, EvenUp, Cyera — des entreprises utilisant
Claude pour le codage, le support client et la revue documentaire juridique. Le titre donné
à la source, *« Claude for research use cases »*, ne correspond à aucune page réelle.

**Second point** : la source de niveau fiche intitulée *« Model Card Claude (Anthropic) »*
(`https://www.anthropic.com/claude`) renvoie à `claude.com/product/overview`, **une page
produit** — proposition de valeur, canaux de distribution, liste de produits. Ce n'est pas
une model card : pas de benchmarks, pas de données d'entraînement, pas de section limites.
L'intitulé induit une garantie de rigueur que la page n'offre pas.

**Correction proposée** : supprimer l'usage `recherche` ou l'adosser à une source qui le
documente ; renommer la seconde source *« Claude — page produit (Anthropic) »* et la retyper
`primaire` au sens « document de l'éditeur », ce qu'elle est.

#### F-S2 — `lstm` : TRL 8 contredit par sa propre source, qui documente cinq déploiements de masse

**Citation fautive** : usage 0, `industrie`, **TRL 8** — *« Traduction automatique et
reconnaissance vocale de nouvelle génération (avant les Transformers) »*.

**Ce que dit réellement la source** (`en.wikipedia.org/wiki/Long_short-term_memory`) :
*« 2015: Google started using an LSTM trained by CTC for speech recognition on Google
Voice »* ; *« Google released the Google Neural Machine Translation system for Google
Translate which used LSTMs to reduce translation errors by 60% »* (2016) ; *« Apple
announced… that it would start using the LSTM for quicktype in the iPhone and for Siri »* ;
Amazon Polly, *« which generates the voices behind Alexa »* ; et *« 2017: Facebook performed
some 4.5 billion automatic translations every day using long short-term memory networks »*.

Cinq déploiements commerciaux mondiaux, nommés et datés, dans la source même que la fiche
cite. **TRL 9, sans ambiguïté.** C'est l'exemplaire le plus net du biais de sous-évaluation :
la fiche disposait de la preuve et ne l'a pas utilisée.

**Correction proposée** : TRL 9 pour l'usage 0. Voir aussi F-M4 sur les `limites_connues`
de la même fiche.

#### F-S3 — `gnome-decouverte-de-materiaux` : omission de la critique publiée dans sa propre source

**Citation fautive** (`limites_connues`) : *« Les prédictions de stabilité restent
théoriques (calculs de simulation) et nécessitent une validation expérimentale en
laboratoire, longue et coûteuse […] une partie significative des matériaux prédits stables
n'a pas encore été synthétisée ni confirmée en pratique. »*

**Ce que dit réellement la source** (`en.wikipedia.org/wiki/Google_DeepMind`) : elle
rapporte une critique de fond, bien plus sévère — GNoME *« did not make "a useful, practical
contribution to the experimental materials scientists" »*, et les matériaux découverts sont
*« most being minor variants of already-known materials »*.

La fiche formule une limite de *calendrier* (« pas encore synthétisés ») là où sa source
rapporte une contestation de *valeur scientifique* (« pas de contribution utile », « variantes
mineures de matériaux déjà connus »). C'est une minimisation par omission, du même type que
celle relevée le 07/09 sur la fiche Seligman.

**Correction proposée** : ajouter la critique aux `limites_connues` et la tracer à la source
qui la porte. À noter que l'article `Applications_of_artificial_intelligence`, également cité
par la fiche, apporte à l'inverse un élément favorable non repris : *« The system's
predictions were validated through autonomous robotic experiments, with a success rate of
71% »*. La fiche omet donc les deux extrémités du débat.

#### F-S4 — `tutorat-adaptatif-personnalise-edtech-ia` : l'affirmation d'efficacité va contre sa source

**Citation fautive** (`limites_connues`) : *« Les études sur l'efficacité pédagogique réelle
de ces systèmes à grande échelle restent mitigées et hétérogènes selon les contextes et les
disciplines »*.

**Ce que dit réellement la source** (`en.wikipedia.org/wiki/Intelligent_tutoring_system`) :
*« Students who received intelligent tutoring outperformed students from conventional
classes in 46 (or 92%) of the 50 controlled evaluations »* ; une méta-analyse de 2015 donne
un effet médian de **0,66** sur tests locaux ; et VanLehn (2011) conclut qu'*« there was no
statistical difference in effect size between expert one-on-one human tutors and step-based
ITS »*.

La source décrit un résultat **positif et convergent**, pas un résultat mitigé. La vraie
nuance qu'elle porte — un effet de 0,66 sur les tests locaux mais de **0,13 seulement sur
les tests standardisés** — est bien plus informative que la formule employée, et elle est
absente de la fiche. La fiche minimise donc son sujet en s'écartant de sa source, ce qui est
l'exact symétrique du biais que l'audit cherchait.

**Second point** : **aucun** des acteurs annoncés comme éditeurs — *« Khan Academy/Khanmigo,
Duolingo, Squirrel AI »* — n'apparaît dans la source. Le seul système nommé est **Cognitive
Tutor**, *« incorporated into mathematics curricula in a substantial number of United States
high schools »* — un déploiement de masse qui justifie un TRL 9 et non le 7 déclaré.

#### F-S5 — `alexnet` : TRL 9 industriel attribué à un système jamais déployé

**Citation fautive** : usage 0, `industrie`, **TRL 9** — *« Fondation historique des systèmes
de vision par ordinateur industriels (contrôle qualité visuel, tri automatisé) »*, exemples
*« Inspection visuelle automatisée de pièces manufacturées »*, *« Systèmes de reconnaissance
d'objets en robotique industrielle »*.

**Ce que dit réellement la source** : rien de tout cela. L'article documente exclusivement
la soumission au concours — *« submitted AlexNet in the ImageNet Large Scale Visual
Recognition Challenge on September 30, 2012. The network achieved a top-5 error rate of
15.3% »* — l'architecture, ReLU et le dropout. **Aucun cas d'application industrielle.**

La formule « fondation historique de » signale d'ailleurs elle-même le glissement : la fiche
attribue à AlexNet le TRL de ce qu'il a rendu possible. AlexNet est un prototype de
laboratoire validé sur un benchmark — **TRL 4**.

**Correction proposée** : TRL 4 pour l'usage 0, ou reformuler l'usage pour qu'il porte
explicitement sur les descendants d'AlexNet et cite une source qui les documente.

#### F-S6 — `openai-operator-agents-de-navigation-web` : une phrase de source pour deux usages

**Citation fautive** : usage 0 `industrie` TRL 6 (*« Automatisation de réservations ou de
commandes en ligne »*, *« Extraction et remplissage automatisé de formulaires web »*) et
usage 1 `gouvernement` TRL 4 (*« Aide à la complétion de démarches administratives en ligne
pour des usagers peu à l'aise avec le numérique »*). Source unique et de niveau fiche :
`https://en.wikipedia.org/wiki/OpenAI`, typée `primaire`.

**Ce que dit réellement la source** : une seule phrase — *« On January 23, 2025, OpenAI
released Operator, an AI agent and tool for accessing websites to execute goals defined by
users »* — et la mention d'une disponibilité *« only available to Pro users in the United
States »*. Réservation, formulaires, démarches administratives, injection de prompt,
intervention humaine sur les étapes de paiement : **tout est absent**.

Deux conséquences : l'usage `gouvernement` est intégralement non attesté, et le TRL 6 de
l'usage `industrie` est **sous-évalué** — un produit publié et commercialisé en accès
restreint est TRL 8.

#### F-S7 — `devin-cognition-ai` : SWE-bench, unique exemple de l'usage `recherche`, est absent de la source

**Citation fautive** : usage 1, `recherche`, TRL 6 — exemple unique : *« Utilisation comme
référence dans des benchmarks d'agents de programmation autonomes (ex. SWE-bench) »*.
Usage 0, `industrie`, TRL 6 — *« Résolution automatisée de tickets de bugs simples à
moyens »*, *« Génération et exécution de suites de tests pour du code existant »*.

**Ce que dit réellement la source** (`en.wikipedia.org/wiki/Devin_AI`) : **SWE-bench n'y
figure pas**, ni aucun chiffre de benchmark, ni aucun usage académique. Les seuls éléments
concrets sont des démonstrations (création de sites, Pong, tâches Upwork) et leur
contestation : *« YouTube channels such as Internet of Bugs and Computer Vision Project
criticized the tool for failing to deliver on the project request, instead writing, testing,
and debugging code irrelevant to the Upwork request. »* Les capacités annoncées par la
fiche (terminal, navigateur, éditeur) n'y sont pas davantage : la source dit seulement
*« It searches online resources during the process »*.

Un TRL 6 (« démontré en environnement représentatif ») ne peut se fonder sur des
démonstrations publiquement qualifiées de trompeuses. **TRL 5 au plus** pour l'usage 0,
**non déterminable** pour l'usage 1.

#### F-S8 — `gradient-boosting-xgboost-lightgbm-catboost` : les trois implémentations qui nomment la fiche sont absentes de sa source

**Citation fautive** (`editeur`) : *« Méthode de gradient boosting formalisée par Jerome
Friedman (1999) ; implémentations XGBoost (2014), LightGBM (Microsoft, 2016), CatBoost
(Yandex, 2017) »*. `capacites_cles` : *« Performances de pointe sur données tabulaires
structurées, souvent supérieures aux réseaux de neurones profonds »*, *« Gestion native des
valeurs manquantes et des variables catégorielles (notamment CatBoost) »*.

**Ce que dit réellement la source** (`en.wikipedia.org/wiki/Gradient_boosting`) : Friedman
1999 est confirmé. **XGBoost, LightGBM et CatBoost sont absents**, ainsi que leurs dates et
leurs éditeurs. La comparaison aux réseaux de neurones est absente. La gestion des valeurs
manquantes et des variables catégorielles est absente. Les seuls cas concrets de l'article
sont *« learning to rank »* chez Yahoo et Yandex, la physique des hautes énergies (Higgs) et
*« quality evaluation of sandstone reservoir »* — aucun scoring de crédit, aucune détection
de fraude, aucun ciblage de contrôle public.

Sont en revanche bien attestés : la perte d'interprétabilité (*« sacrifices intelligibility
and interpretability »*) et le besoin de régularisation contre le surapprentissage.

#### F-S9 — `biais-herites-des-donnees-d-entrainement` : l'affirmation la plus forte de la fiche n'est dans aucune source

**Citation fautive** (`limites_connues`) : *« différentes définitions mathématiques de
l'équité (fairness) sont mutuellement incompatibles entre elles, ce qui signifie qu'un choix
de correction reste toujours, in fine, un choix normatif et politique. »*

**Ce que dit réellement la source** (`fr.wikipedia.org/wiki/Biais_algorithmique`, seule
source à URL de la fiche) : elle liste trois définitions de l'équité **sans jamais noter
leur incompatibilité**. Le champ FAccT, revendiqué en `capacites_cles`, n'y figure pas non
plus. Les deux exemples d'usage — *« Audits de biais imposés par certaines réglementations
sur les systèmes de décision automatisée »* et *« Contentieux juridiques liés à des
discriminations algorithmiques documentées »* — sont également absents : l'article cite des
audits académiques (ProPublica), pas des audits réglementaires ni de contentieux.

L'affirmation d'incompatibilité est **exacte** — c'est le résultat de Kleinberg,
Mullainathan et Raghavan (2016) — mais elle n'est tracée à rien, et l'unique source qui
pourrait la porter est l'intitulé sans URL *« Recherche académique sur l'équité algorithmique
(fairness in ML) »*. Sont en revanche bien attestés : Amazon 2015 (CV féminins), Face++
(*« 99,3% des hommes, mais seulement 78,7% des femmes »*), la justice des libertés et de la
détention.

**Correction proposée** : citer `arXiv:1609.05807`, *Inherent Trade-Offs in the Fair
Determination of Risk Scores*, qui est exactement la source de cette affirmation.

#### F-S10 — `codex-famille-gpt` : TRL sous-évalué, source unique marketing, limites non tracées

**Citation fautive** : usage 0, `industrie`, **TRL 7**.

**Ce que dit réellement la source** (`https://openai.com/codex`) : *« Now available in the
ChatGPT app »*, *« Codex reliably completes tasks end to end, like building features,
complex refactors, migrations »*, et six entreprises utilisatrices nommées — Wonderful,
Harvey, Sierra, Ramp, Duolingo, Cisco Meraki — dont un témoignage client (*« Codex PR
reviews catch bugs our team would have missed »*). Disponibilité générale et production
chez des clients nommés : **TRL 9**.

**Second point, de neutralité** : les trois sources de la fiche sont des pages OpenAI, dont
la page produit Codex, qui **ne comporte aucune section de limites** — c'est un document
commercial. Les `limites_connues` de la fiche (*« Hallucination de code plausible mais
incorrect ; dépendance à la qualité des specs fournies »*) sont donc justes mais **non
traçables**, et la fiche n'oppose aucune source indépendante à l'éditeur. C'est la seule
fiche du référentiel entièrement sourcée par le fournisseur du produit qu'elle décrit.

**Troisième point** : avec **un seul usage et trois capacités**, c'est aussi la fiche la
moins dense des 44.

#### F-S11 — Usages sectoriels entiers non attestés : `jumeaux-numeriques` et `criblage-virtuel`

Généralisation de F3/F4 du 07/09 à deux fiches de l'axe `sectoriel`.

`jumeaux-numeriques-industriels-ia`, usage 1, `gouvernement`, TRL 6 — *« Modélisation
d'infrastructures publiques critiques (réseaux d'eau, d'énergie, de transport) »*, exemple
*« Jumeaux numériques de réseaux électriques ou d'infrastructures urbaines »*. La source
(`fr.wikipedia.org/wiki/Jumeau_numérique`) **ne traite que d'équipements industriels** :
*« turbines de production d'énergie, les moteurs à réaction et les locomotives »*. Les
infrastructures publiques sont absentes, de même que la dérive du modèle et le coût de mise
en place, tous deux annoncés en `limites_connues`. Deux des quatre éditeurs annoncés —
Dassault Systèmes et NVIDIA Omniverse — sont également absents (Siemens et GE sont bien
présents). À l'inverse, l'usage 0 est **sous-évalué** : des jumeaux de turbines et de
moteurs en service sont TRL 9, non 8.

`criblage-virtuel-de-molecules-ia-pharmaceutique` : **aucun** des acteurs annoncés —
*« Insilico Medicine, Isomorphic Labs, Recursion Pharmaceuticals »* — n'apparaît dans la
source (`en.wikipedia.org/wiki/Virtual_screening`), pas plus que la conception *de novo*
ni les maladies négligées. La source atteste en revanche que le criblage virtuel prospectif
est une pratique établie dont *« the resulting hits are subjected to experimental
confirmation (e.g., IC50 measurements) »* — soit un procédé de routine, TRL 9, et non le 7
déclaré.

#### F-S12 — Exemples non attestés : 24 fiches sur les 29 relues (83 %)

Généralisation mesurée de **F3, F4 et F5** du 07/09, qui portaient sur trois fiches.
Sur les 29 fiches relues ici, **24 comportent au moins un `exemple` absent de la source
citée** : `claude-anthropic-cowork`, `alexnet`, `resnet`, `alphago-alphazero-alphafold`,
`stable-diffusion-midjourney-dall-e`, `regression-lineaire`, `forets-aleatoires`, `svm`,
`k-nn`, `naive-bayes`, `k-means`, `pca`, `gradient-boosting`, `perceptron-multicouche-mlp`,
`autoencodeurs`, `openai-operator`, `devin-cognition-ai`, `gnome`,
`ia-pour-le-controle-de-plasma`, `biais-herites`, `dependance-energetique`,
`jumeaux-numeriques`, `tutorat-adaptatif`, `criblage-virtuel`.

Cinq fiches seulement ont tous leurs exemples attestés : **`autogpt`**, **`hallucination`**,
`lstm`, `codex-famille-gpt`, et `series-temporelles-arima-sarima` (non vérifiable).

Le mécanisme est le même partout et découle du gabarit : la source explique **comment marche
une méthode**, la fiche demande **deux cas d'usage sectoriels**, et le rédacteur comble avec
des illustrations plausibles. Les exemples sont presque toujours vraisemblables — un k-NN
*sert* effectivement à recommander des produits — mais ils sont produits de mémoire, ce que
la règle du projet interdit. C'est le défaut le plus répandu du référentiel, et la cause
directe de la note de fidélité à 2,66.

### Mineurs

**F-M1 — `resnet` : quatre affirmations non tracées.** *« jusqu'à plus de 150 couches »*
(la source parle de *« 200 to over 1000 layers »* pour la variante pré-activation, sans
donner le compte du ResNet vainqueur de 2015) ; *« adaptée ensuite à d'autres modalités
(audio, texte) »*, absent ; *« EfficientNet, Vision Transformers hybrides »* et
*« transfer learning »*, absents ; *« largement supplanté depuis 2020 par les architectures
Vision Transformer […] tout en restant compétitif à budget de calcul limité »*, absent —
la source n'établit aucune comparaison temporelle ni de performance entre les deux.

**F-M2 — `alexnet` : limites non tracées.** *« Architecture aujourd'hui dépassée en
précision et en efficacité par des réseaux plus profonds (ResNet, Vision Transformers) ;
gourmande en mémoire pour l'époque et peu adaptée aux contraintes actuelles d'inférence
embarquée »* — aucun de ces trois éléments n'est dans la source, qui mentionne ResNet sans
comparaison critique.

**F-M3 — `stable-diffusion-midjourney-dall-e` : les usages ne sont pas attestés, mais les
limites le sont remarquablement.** Les quatre exemples (agences de design, jeu vidéo, mode,
supports de cours) sont absents de la source. En revanche, chacune des trois limites
annoncées y est confirmée : poursuites de trois artistes et de Getty Images en janvier 2023,
*« unable to generate legible ambigrams and some other forms of text »*, et
*« challenge […] in generating human limbs due to poor data quality of limbs in the LAION
database »*. La fiche est plus rigoureuse sur ses limites que sur ses usages — inversion
inhabituelle et à porter à son crédit.

**F-M4 — `lstm` : limite non tracée.** *« son remplacement progressif par ces derniers sur
la plupart des tâches de traitement du langage depuis 2017-2018 »* : la source ne mentionne
les Transformers qu'une fois, en 2020, pour une comparaison de lois d'échelle. Fait exact,
mais non traçable à la source citée.

**F-M5 — `svm` : attribution imprécise.** La fiche écrit *« développée notamment par
Vladimir Vapnik et Corinna Cortes (années 1990) »*. La source distingue deux étapes :
*« Ce n'est toutefois qu'en 1992 que ces idées seront bien comprises et rassemblées par
Boser, Isabelle Guyon et Vapnik »*, puis *« En 1995, Corinna Cortes et Vladimir Vapnik
proposent une technique dite de marge souple »*. Isabelle Guyon, coautrice de l'étape
fondatrice, disparaît. Le « notamment » sauve la formulation, mais l'omission est de même
nature que celles relevées le 07/09 sur l'échantillon Évolution.

**F-M6 — `perceptron-multicouche-mlp` : omission de Werbos.** La fiche attribue la
rétropropagation à *« Rumelhart, Hinton, Williams, 1986 »*. La source précise :
*« proposé par Paul Werbos en 1974 et mis au point douze années plus tard, en 1986 par
David Rumelhart »*. L'antériorité de Werbos, explicitement portée par la source, est omise.

**F-M7 — `k-nn` : datation non tracée.** *« Méthode statistique classique d'apprentissage
non paramétrique (années 1950-1960) »* : la source **ne mentionne aucune origine
historique**. Le fléau de la dimension et le coût de calcul à l'inférence, annoncés en
`limites_connues`, en sont également absents.

**F-M8 — `autogpt` : la source primaire décrit aujourd'hui autre chose que la fiche.** La
fiche décrit à juste titre l'AutoGPT de 2023 comme une preuve de concept (TRL 4), mais sa
source primaire, le dépôt GitHub, présente désormais une *« Managed Platform… publicly
available »* commerciale, avec plans payants et connexion à *« 45+ platforms »*. Le décalage
n'invalide pas la fiche — qui traite bien de l'objet de 2023, richement attesté par la source
Wikipedia — mais il rendra la source primaire de plus en plus contradictoire avec elle. À
signaler à la veille plutôt qu'à corriger.

**F-M9 — `dependance-energetique-et-materielle` : deux affirmations non tracées.** La
concentration géographique des fabricants de semi-conducteurs (*« Taïwan notamment »*) est
**absente** de la source, qui ne traite pas des chaînes d'approvisionnement. L'effet rebond
des `limites_connues` — *« les gains d'efficacité énergétique par unité de calcul sont pour
l'instant largement compensés par la croissance du volume de calcul »* — en est également
absent. Sont en revanche bien attestés : la consommation d'eau (*« evaporated in cooling
towers »*), les terres rares (*« often mined in environmentally destructive ways »*),
l'accord Microsoft–Constellation Energy sur Three Mile Island, et l'AIE.

---

## 6. Sources primaires non identifiables — 17 intitulés, proposition pour chacun

Onze des dix-sept sont typées `primaire`. Aucune n'a d'URL ; aucune n'a pu être localisée à
partir de son seul intitulé. Six renvoient en réalité à une publication parfaitement
identifiable dont l'URL est donnée ci-dessous ; cinq sont des désignations génériques qui
ne correspondent à aucun document et doivent être remplacées ou reformulées.

| # | Intitulé dans la fiche | Fiches | Type | Proposition |
|---|---|---|---|---|
| 1 | *DeepSeek-V3 Technical Report* | `deepseek` | primaire | URL réelle : `https://arxiv.org/abs/2412.19437` |
| 2 | *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via RL* | `deepseek` | primaire | URL réelle : `https://arxiv.org/abs/2501.12948` |
| 3 | *Jumper et al., « Highly accurate protein structure prediction with AlphaFold », Nature 2021* | `alphafold-deepmind` | primaire | URL réelle : `https://www.nature.com/articles/s41586-021-03819-2` |
| 4 | *Prix Nobel de chimie 2024 (Hassabis, Jumper, Baker)* | `alphafold-deepmind` | secondaire | URL réelle : `https://www.nobelprize.org/prizes/chemistry/2024/summary/` |
| 5 | *Nature — AlphaFold Protein Structure Database* | `alphafold-deepmind` | primaire | **Titre erroné** : ce n'est pas une publication *Nature* mais une base de données. Remplacer par « AlphaFold Protein Structure Database (EMBL-EBI / DeepMind) », `https://alphafold.ebi.ac.uk/` |
| 6 | *GraphCast (Google DeepMind, publié dans Science, 2023)* | `ia-en-modelisation-climatique-type-graphcast` | primaire | URL réelle : Lam et al., *Science* 382, 1416-1421 (2023), `https://www.science.org/doi/10.1126/science.adi2336`. **Vérifier au passage qu'il s'agit bien de GraphCast et non de GenCast** (finding F7 du 07/09) |
| 7 | *DeepMind — Magnetic control of tokamak plasmas (Nature, 2022)* | `ia-pour-le-controle-de-plasma` | primaire | URL réelle : Degrave et al., *Nature* 602, 414-419 (2022), `https://www.nature.com/articles/s41586-021-04301-9` |
| 8 | *GNoME (Google DeepMind, 2023)* | `gnome-decouverte-de-materiaux` | primaire | URL réelle : Merchant et al., « Scaling deep learning for materials discovery », *Nature* 624 (2023), `https://www.nature.com/articles/s41586-023-06735-9` |
| 9 | *Synthèses académiques sur l'hallucination des LLM (ex. Ji et al., « Survey of Hallucination in NLG », ACM Computing Surveys)* | `hallucination-et-fiabilite-factuelle` | secondaire | La publication citée entre parenthèses est réelle : `https://dl.acm.org/doi/10.1145/3571730`. Supprimer l'enveloppe « Synthèses académiques… (ex. …) » et ne garder que la référence |
| 10 | *Recherche académique sur l'équité algorithmique (fairness in ML)* | `biais-herites-des-donnees-d-entrainement` | primaire + secondaire | **Ne désigne aucun document.** Remplacer par la source réelle de l'affirmation d'incompatibilité que la fiche avance : Kleinberg, Mullainathan & Raghavan, « Inherent Trade-Offs in the Fair Determination of Risk Scores », `https://arxiv.org/abs/1609.05807` |
| 11 | *Rapports sur l'empreinte énergétique de l'IA (AIE, études académiques)* | `dependance-energetique-et-materielle` | primaire + secondaire | **Ne désigne aucun document.** Le rapport de l'AIE visé est identifiable : *Energy and AI* (2025), `https://www.iea.org/reports/energy-and-ai` |
| 12 | *LangChain, CrewAI, AutoGen — documentation des projets* | `frameworks-multi-agents` | primaire + secondaire | **Ne désigne aucun document.** Éclater en trois sources réelles : `https://python.langchain.com/docs/`, `https://docs.crewai.com/`, `https://microsoft.github.io/autogen/` — ce qui lèverait aussi F6 du 07/09 |
| 13 | *Systèmes de tutorat adaptatif — documentation sectorielle EdTech* | `tutorat-adaptatif` | primaire + secondaire | **Ne désigne aucun document.** La source réelle des chiffres d'efficacité existe : VanLehn (2011), « The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and Other Tutoring Systems », *Educational Psychologist* 46(4), `https://doi.org/10.1080/00461520.2011.611369` |
| 14 | *Systèmes d'aide à la décision publique par IA — documentation GovTech* | `aide-a-la-decision-publique-govtech-ia` | primaire + secondaire | **Ne désigne aucun document.** Les deux cas décrits par la fiche ont des sources primaires réelles : jugement du tribunal de La Haye sur SyRI (5 février 2020) et le rapport Ofqual sur la notation des A-levels 2020 |
| 15 | *Jumeaux numériques industriels — documentation sectorielle (Siemens, GE, Dassault Systèmes)* | `jumeaux-numeriques-industriels-ia` | primaire + secondaire | **Ne désigne aucun document.** Soit citer les trois pages produit nommément, soit reformuler honnêtement en « documentation commerciale des éditeurs, non consultée », typée `secondaire` |
| 16 | *Criblage virtuel de molécules par IA — documentation sectorielle pharmaceutique* | `criblage-virtuel-de-molecules` | primaire + secondaire | **Ne désigne aucun document.** Remplacer par une revue réelle du domaine, ou par les publications des trois acteurs annoncés — dont aucun n'est aujourd'hui attesté (F-S11) |
| 17 | *AlphaFold — impact sur la recherche pharmaceutique* | `ia-en-genomique-et-drug-discovery` | primaire + secondaire | **Ne correspond à aucune publication identifiable** (déjà relevé en F2 le 07/09). La fiche faisant par ailleurs doublon avec `alphafold-deepmind` (F12), la question de la source est seconde par rapport à celle de l'existence de la fiche |

**Règle générale proposée** : une source typée `primaire` sans URL doit être soit complétée
par l'URL du document réel, soit retypée `secondaire` avec la mention explicite « source non
localisée ». Les cinq intitulés « documentation sectorielle X » (#12 à #16) partagent la
même construction et ont manifestement été produits dans un même lot : ils désignent une
catégorie de documents, pas un document. Aucun ne peut être vérifié par un lecteur, ce qui
est la définition même d'une source non traçable.

---

## 7. Recopie entre fiches

Les 44 fiches ont été produites en lots. La recopie **littérale** a été mesurée par
recherche des n-grammes de 7 mots partagés par au moins deux fiches, sur la concaténation
de `capacites_cles`, `limites_connues`, `usages[].description` et `usages[].exemples`.

**Résultat : 5 n-grammes seulement**, tous courts et techniquement banals :

| Formule partagée | Fiches |
|---|---|
| « sur de très grands volumes de données » | `svm`, `naive-bayes`, `gradient-boosting` |
| « moins interprétable qu'un arbre de décision unique » | `forets-aleatoires`, `gradient-boosting` |
| « scoring de crédit et détection de fraude » | `regression-logistique`, `gradient-boosting` |
| « ce qui limite sa capacité à capturer » | `regression-logistique`, `rnn` |

**Il n'y a pas de copier-coller de contenu dans ce référentiel.** C'est un point positif à
enregistrer : le risque le plus visible de la production en lot ne s'est pas matérialisé.

La recopie est ailleurs — dans la **structure**, et elle est totale :

- **41 fiches sur 44 portent exactement 2 usages** (2 en portent 1, une en porte 3) ;
- **75 usages sur 87 portent exactement 2 exemples** ;
- **87 usages sur 87 portent exactement 1 source** — aucun usage du référentiel n'est
  corroboré par deux sources ;
- **27 fiches sur 44 n'ont qu'une seule source de niveau fiche**, et c'est dans les 27 cas
  un article Wikipédia typé `primaire` ;
- la longueur médiane d'une `description` d'usage est de **95 caractères**, avec une seule
  valeur au-dessus de 200 (`autogpt`, 492) — la fiche qui est aussi la mieux notée.

Le moule « 2 usages × 2 exemples × 1 source Wikipédia » est appliqué à 41 fiches sur 44,
quel que soit ce que la source contient réellement. C'est ce moule, et non un défaut de
rédaction, qui produit les 24 fiches à exemples non attestés (F-S12) : quand l'article
explique une méthode et que le gabarit réclame deux cas d'usage sectoriels, la seule issue
est l'illustration plausible.

**Deux fiches sortent du moule, et ce sont les deux mieux notées** : `autogpt` (5/5/5/5,
descriptions longues, trois exemples par usage, tous retrouvés mot pour mot dans la source)
et `hallucination-et-fiabilite-factuelle` (5/5/5/5, trois usages, huit éléments factuels
vérifiés un par un). Toutes deux ont été rédigées *à partir* de leur source plutôt que
*vers* un gabarit. C'est la démonstration, à l'intérieur du corpus lui-même, que le gabarit
est la cause et non une fatalité.

---

## 8. Notation des 44 fiches

Notes de 1 à 5. Les 15 fiches marquées *(07/09)* reprennent les notes du rapport précédent :
elles n'ont été réexaminées ici que sur le TRL, et il aurait été malhonnête de les renoter
sans relire leurs sources.

| Fiche | Fidélité | Neutralité | Densité | Utilité | Note la plus basse — motif |
|---|---|---|---|---|---|
| `autogpt` | 5 | 5 | 5 | 5 | — fiche de référence du corpus |
| `hallucination-et-fiabilite-factuelle` | 5 | 5 | 5 | 5 | — mais TRL sans référent (F-B2) |
| `bert` *(07/09)* | 5 | 4 | 4 | 5 | — |
| `ia-pour-le-controle-de-plasma` | 4 | 5 | 4 | 4 | fidélité : « réduction du temps d'ingénierie » non attesté |
| `transformers` *(07/09)* | 4 | 4 | 4 | 5 | — |
| `alphafold-deepmind` *(07/09)* | 4 | 4 | 4 | 5 | fidélité : chiffre d'utilisateurs non tracé (F13) |
| `llama` *(07/09)* | 4 | 4 | 4 | 4 | — |
| `gan` *(07/09)* | 4 | 4 | 4 | 4 | fidélité : diffusion non tracée (F10) |
| `regression-logistique` *(07/09)* | 4 | 4 | 4 | 4 | — |
| `stable-diffusion-midjourney-dall-e` | 3 | 5 | 4 | 4 | fidélité : quatre exemples absents de la source (F-M3) |
| `dependance-energetique-et-materielle` | 3 | 4 | 4 | 4 | fidélité : Taïwan et effet rebond absents (F-M9) |
| `k-means` | 3 | 4 | 4 | 4 | fidélité : tous les exemples absents ; groupes sphériques absent |
| `pca` | 3 | 4 | 4 | 4 | fidélité : génomique, géophysique, t-SNE/UMAP, interprétabilité absents |
| `svm` | 3 | 4 | 4 | 4 | fidélité : exemples et limites absents ; Guyon omise (F-M5) |
| `arbres-de-decision` *(07/09)* | 3 | 4 | 4 | 4 | fidélité : exemples sectoriels absents (F5) |
| `lstm` | 3 | 4 | 4 | 4 | fidélité : TRL contredit par la source (F-S2) ; limite Transformers non tracée |
| `regression-lineaire` | 3 | 4 | 3 | 4 | fidélité : usages industriels absents de la source |
| `naive-bayes` | 3 | 4 | 3 | 4 | fidélité : seul le spam est attesté |
| `series-temporelles-arima-sarima` | 3\* | 4 | 3 | 4 | *\*provisoire — source non joignable par le proxy* |
| `rnn` *(07/09)* | 3 | 4 | 4 | 4 | fidélité : TRL incohérent avec le statut décrit (F9) |
| `deepseek` *(07/09)* | 3 | 4 | 4 | 3 | densité : un seul usage, l'usage grand public manque (F11) |
| `jumeaux-numeriques-industriels-ia` | 3 | 4 | 3 | 3 | fidélité : infrastructures publiques et deux éditeurs absents (F-S11) |
| `ia-en-genomique-et-drug-discovery` *(07/09)* | 3 | 4 | 3 | 3 | utilité : redite d'`alphafold-deepmind` (F12) |
| `gnome-decouverte-de-materiaux` | 3 | **2** | 4 | 3 | **neutralité : critique de la source omise (F-S3)** |
| `codex-famille-gpt` | 3 | 3 | **2** | 3 | densité : un seul usage ; neutralité : sources 100 % éditeur (F-S10) |
| `claude-anthropic-cowork` | **2** | 3 | 3 | 3 | fidélité : usage `recherche` sans support (F-S1) |
| `alexnet` | 2 | 4 | 3 | 3 | fidélité : usages industriels et limites absents (F-S5, F-M2) |
| `resnet` | 2 | 4 | 3 | 3 | fidélité : quatre affirmations non tracées (F-M1) |
| `forets-aleatoires` | 2 | 4 | 4 | 4 | fidélité : importance des variables, comparaison XGBoost, coût, boîte grise — tous absents |
| `k-nn` | 2 | 4 | 3 | 3 | fidélité : datation, exemples, fléau de la dimension absents (F-M7) |
| `gradient-boosting-xgboost-lightgbm-catboost` | 2 | 4 | 4 | 4 | fidélité : les trois implémentations du titre absentes (F-S8) |
| `perceptron-multicouche-mlp` | 2 | 4 | 3 | 3 | fidélité : source purement théorique, rien d'attesté (F-M6) |
| `autoencodeurs` | 2 | 4 | 3 | 3 | fidélité : l'usage 0 entier absent de la source |
| `openai-operator-agents-de-navigation-web` | 2 | 4 | 3 | 3 | fidélité : une phrase de source pour deux usages (F-S6) |
| `devin-cognition-ai` | 2 | 5 | 3 | 3 | fidélité : SWE-bench absent (F-S7) — neutralité exemplaire en revanche |
| `biais-herites-des-donnees-d-entrainement` | 2 | 4 | 3 | 4 | fidélité : affirmation centrale non tracée (F-S9) |
| `tutorat-adaptatif-personnalise-edtech-ia` | 2 | 3 | 3 | 3 | fidélité et neutralité : va contre sa propre source (F-S4) |
| `criblage-virtuel-de-molecules-ia-pharmaceutique` | 2 | 4 | 3 | 3 | fidélité : aucun acteur annoncé attesté (F-S11) |
| `cnn` *(07/09)* | 2 | 4 | 4 | 3 | fidélité : usages sectoriels non attestés (F4) |
| `yolo` *(07/09)* | 2 | 4 | 3 | 3 | fidélité : exemples et limites non attestés (F3) |
| `aide-a-la-decision-publique-govtech-ia` *(07/09)* | 2 | 4 | 4 | 3 | fidélité : TRL contredit par ses propres limites (F1) |
| `frameworks-multi-agents-langgraph-crewai-autogen` *(07/09)* | 2 | 4 | 4 | 3 | fidélité : éditeurs et usages non vérifiables (F6) |
| `ia-en-modelisation-climatique-type-graphcast` *(07/09)* | 2 | 4 | 4 | 3 | fidélité : confusion GraphCast/GenCast (F7) |
| `alphago-alphazero-alphafold` | **1** | 4 | 3 | 2 | **fidélité : la source ne documente aucun des deux usages (F-B1)** |
| **Moyenne (44)** | **2,82** | **4,00** | **3,59** | **3,61** | |

**Fiches à reprendre en priorité** (au moins un finding bloquant ou sérieux) : 15 sur 44,
soit **34 %** — contre 33 % sur l'échantillon du 07/09. Le taux est stable, ce qui suggère
que l'échantillon initial était représentatif sur ce critère, même s'il l'était moins sur
la fidélité moyenne.

---

## 9. Ce qui va bien

Un audit adverse doit aussi dire ce qu'il n'a pas trouvé.

- **Aucune erreur d'attribution de découverte.** Sur 44 fiches saturées de noms propres et
  de dates, les attributions vérifiables sont exactes : Krizhevsky/Sutskever/Hinton pour
  AlexNet, He et al. pour ResNet, Hochreiter et Schmidhuber 1997 pour LSTM, Breiman et
  Cutler 2001 pour les forêts aléatoires, Friedman 1999 pour le gradient boosting, Pearson
  1901 et Hotelling pour l'ACP, Lloyd et MacQueen pour k-means, Richards et mars 2023 pour
  AutoGPT. Deux imprécisions seulement, toutes deux par omission d'un coauteur
  (F-M5 Guyon, F-M6 Werbos) — aucune attribution fausse.
- **Aucune homonymie, aucune URL hors sujet.** Sur les 36 URL ouvertes, 35 servent bien la
  page annoncée. La seule inadéquation majeure — l'article AlphaGo pour une fiche AlphaFold
  (F-B1) — n'est pas une homonymie mais un mauvais choix de source.
- **Aucune survalorisation de l'IA.** Le constat du 07/09 tient sur les 29 fiches
  supplémentaires : pas de « révolutionne », pas de « prouve », pas de « surpasse » non
  étayé. Les fiches `stable-diffusion` (droit d'auteur, deepfakes), `devin` (démonstrations
  contestées) et `autogpt` (TRL 4 assumé) traitent frontalement ce qui dessert leur sujet.
  Les deux écarts relevés (F-S3, F-S4) vont d'ailleurs dans le sens de la sous-estimation,
  pas de la promotion.
- **Aucune recopie littérale entre fiches** (section 7).
- **Le corpus contient sa propre démonstration** que le gabarit est corrigeable : `autogpt`
  et `hallucination` atteignent 5/5/5/5 sur exactement le même schéma JSON, simplement en
  ayant été écrites depuis la source.

---

## 10. Synthèse

1. **Le TRL est le champ le moins fiable du référentiel.** Sur 87 usages, 11 seulement sont
   défendables en l'état. 16 sont à relever, 2 à abaisser, 37 sont indéterminables faute de
   source, et 21 relèvent d'une catégorie où le champ n'a pas de référent. Quand le TRL est
   faux, il est **huit fois sur neuf trop bas**.
2. **Trois défauts de gabarit distincts** produisent ces 21 cas invalides : le TRL appliqué
   à un usage de recherche (défaut A, 28 usages), à une méthode plutôt qu'à un système
   (défaut B, 21 fiches), à un phénomène (défaut C, 3 fiches). Seul le premier avait été
   identifié le 07/09.
3. **La règle de traçabilité primaire est vide.** 27 fiches sur 44 typent un article
   Wikipédia comme source `primaire` et en font leur unique source ; 35 typent la même URL
   `primaire` et `secondaire` dans la même fiche ; 15 citent au moins une source `primaire`
   sans URL. Sur 57 entrées typées `primaire`, **13 le sont réellement**.
4. **Le moule « 2 usages × 2 exemples × 1 source » est appliqué à 41 fiches sur 44**, et
   c'est lui qui produit le défaut le plus répandu : 24 des 29 fiches relues comportent au
   moins un exemple sectoriel absent de leur source.
5. **La recommandation TRL est en section 3** : rendre le champ facultatif et autoriser
   `null`, ajouter un champ `diffusion` non numérique pour ce que les TRL de recherche
   voulaient dire, et exiger un `trl_justification` d'une phrase citant le déploiement.

Aucun fichier de `data/seed/` n'a été modifié.

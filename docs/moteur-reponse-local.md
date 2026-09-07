# Moteur de réponse — index local, trois modes de génération

Version du 07/09/2026. Ce document remplace la mise en route décrite dans
`docs/rag-mise-en-route-et-cout.md`, qui supposait Supabase, une clé Voyage et une clé Anthropic.
Le document précédent reste au dépôt : il garde l'historique des sept défauts trouvés en faisant
tourner la chaîne, et il décrit le chemin Supabase, qui reste une option (§7).

**Ce qui a changé** : le moteur ne dépend plus d'aucune base de données ni d'aucune clé d'API.
`npm run indexer && npm run dev` suffit, sur une copie fraîche du dépôt, hors ligne.

**Ce qui n'a pas changé** : le découpage du corpus en passages, l'empreinte de contenu qui porte
l'idempotence, les plafonds de coût, le cache, et surtout les refus. Cette logique avait été
éprouvée de bout en bout ; elle est reprise telle quelle.

---

## 0. Démarrer, en trois commandes

```bash
npm install
npm run indexer      # 0,4 s, aucune clé, aucun appel réseau → data/index-vectoriel.json (693 Ko)
npm run dev          # puis http://localhost:3000/questions
```

Il n'y a pas d'étape 4. Aucune variable d'environnement n'est requise pour que le moteur réponde.

Pour vérifier l'état de l'index sans rien modifier :

```bash
node scripts/indexer-corpus.mjs --etat
node scripts/indexer-corpus.mjs --mesurer     # refait toutes les mesures de ce document
```

---

## 1. L'index vectoriel local

### Ce qu'il contient

`data/index-vectoriel.json` — **693 Ko**, versionné au dépôt, chargé comme les JSON de fiches.

| | |
| --- | --- |
| Passages | **2 855** (1 076 humaines · 171 IA · 1 608 gap) |
| Modèle | `lexical-bm25-creux-v1` |
| Vocabulaire | 7 436 termes distincts |
| Composantes non nulles | 106 577, soit 37 par passage en moyenne |
| Vecteurs | 312 Ko en (uint16, int8) — le reste du fichier est le lexique, les clés et les empreintes |
| Temps d'indexation | **0,4 s**, hors ligne |
| Temps de recherche | 3 à 8 ms pour une question, en mémoire |

Il ne contient **aucun texte**. Les textes des passages sont reconstruits au chargement depuis
`data/seed/` par `lib/passages-corpus.mjs` — le même module que celui qu'emploie l'indexeur, ce qui
rend impossible que les deux découpent différemment. Trois conséquences voulues :

1. le fichier reste petit et son diff git ne duplique pas le corpus ;
2. un passage affiché vient forcément du corpus courant : il **ne peut pas** pointer vers une fiche
   disparue, puisqu'il est reconstruit depuis elle ;
3. un décalage index/corpus est détecté (l'empreinte du texte reconstruit doit correspondre à celle
   enregistrée) et **signalé au lecteur**, au lieu de passer inaperçu.

### Pourquoi Supabase a été retiré

Le corpus fait 2 855 passages. En base, cela pesait 41 Mo dont 22 Mo d'index HNSW, pour une
recherche qui se fait en mémoire en quelques millisecondes. Le coût de la base n'était pas
financier — il était opérationnel : trois clés à poser, un schéma SQL à appliquer, un paramètre
`hnsw.ef_search` qui, mal réglé, faisait silencieusement refuser des questions (défaut n°1 de
l'annexe du document précédent). Ce sont ces pannes-là qu'on supprime.

### Pourquoi l'index est CREUX et non projeté

L'intention initiale était de projeter les vecteurs BM25 sur quelques centaines de dimensions par
hachage signé (« count sketch »), puis de quantifier en entiers 8 bits. **Mesuré, c'est un mauvais
échange.** Une question porte 4 à 8 termes, un passage en porte ~42 : avec 512 dimensions, chaque
passage percute par hasard une dimension de la question une fois sur deux, et le bruit de collision
dépasse le signal.

Rappel@10 contre le BM25 exact, mesuré par `--mesurer` :

| Dimensions | Rappel@10 | Taille des vecteurs |
| ---: | ---: | ---: |
| 256 | **0,078** | 714 Ko |
| 512 | **0,189** | 1,39 Mo |
| 1 024 | **0,233** | 2,79 Mo |
| 4 096 | **0,556** | 11,15 Mo |
| **creux (7 436)** | **1,000** | **312 Ko** |

La projection détruit le classement **avant même** de faire gagner de la place : il faudrait 4 096
dimensions et 11 Mo pour approcher — sans l'atteindre — l'exactitude d'un index creux de 312 Ko.
La raison est simple : le vocabulaire du corpus ne fait que 7 436 termes et chaque passage n'en
porte que 37, donc la forme creuse est naturellement compacte.

Les fonctions de projection sont conservées dans `lib/embedding-lexical.mjs` : elles servent à
refaire cette mesure, et au cas où un fournisseur d'embeddings rendrait de vrais vecteurs denses
(auquel cas l'index bascule en `dense-int8`, quantifié lui aussi).

### Perte de la quantification 8 bits

Mesurée contre le même BM25 en flottants 64 bits, sur les 9 questions-tests :

| | |
| --- | --- |
| Rappel@5 | **1,000** |
| Rappel@10 | **1,000** |
| Écart de similarité moyen | **0,000 33** |
| Écart de similarité maximal | **0,001 28** |
| Place gagnée | 312 Ko au lieu de 624 Ko (facteur 2 contre le flottant 32 bits) |

Autrement dit : **la quantification ne coûte rien de mesurable**. Elle ne change aucun classement
sur les questions testées, et déplace la similarité affichée d'un millième au pire. L'échelle de
quantification n'est même pas stockée : le cosinus est invariant par facteur multiplicatif, on
compare donc les entiers directement, sans jamais déquantifier.

### L'idempotence est conservée

Chaque passage porte l'empreinte SHA-256 de son texte, préfixée du nom du modèle d'embedding.

| Situation | Comportement | Vérifié |
| --- | --- | --- |
| Relance sans modification | « Rien à faire », fichier non réécrit, git reste propre | oui |
| Une fiche modifiée | Le passage concerné est détecté par son empreinte | oui (1 passage sur 2 855) |
| Trois fiches supprimées | Leurs 10 passages sont retirés de l'index | oui |
| Changement de modèle d'embedding | Toutes les empreintes changent, tout est réindexé | par construction |

**Nuance à connaître** : les poids lexicaux dépendent de la rareté des mots dans *tout* le corpus
(l'IDF). Dès qu'un passage change, l'IDF bouge, et tous les vecteurs avec. L'indexeur recalcule
donc l'intégralité de l'index lexical dès la moindre modification — c'est gratuit (0,4 s) et c'est
la seule façon de ne pas mélanger deux générations d'IDF dans le même fichier. Les empreintes
gardent leur rôle : décider s'il faut réécrire, et **éviter les appels payants** quand un
fournisseur d'API est branché (là, chaque vecteur est indépendant, on ne repaie que ce qui a changé).

---

## 2. Embeddings sans clé : ce que la recherche lexicale trouve, et ce qu'elle rate

Le modèle par défaut est un **BM25 français** : accents et casse normalisés, mots-outils écartés,
désuffixation légère, pondération par la rareté, saturation de fréquence, normalisation par la
longueur. Aucune clé, aucun réseau, aucune dépendance nouvelle.

### Ce qu'il fait bien

Il retrouve les fiches qui **emploient les mots de la question**, en donnant beaucoup de poids aux
mots rares. Sur « comment comparer l'évolution du capitalisme, du communisme et du modèle
chinois ? », la fiche « Capitalisme d'État (modèle chinois) × DeepSeek » sort à 0,419 et la fiche
« Capitalisme d'État (modèle chinois) » à 0,225 — les deux bonnes réponses, dans le bon ordre.

### Ce qu'il rate, mesuré

Étalon construit **sans jugement de ma part** : pour chaque question-test répondue à la main dans
`data/seed/questions.json`, les fiches du référentiel dont le nom est cité dans l'intitulé d'une
perspective (« Falsificationnisme (Popper) » → fiche « Karl Popper »). Un nom qui désigne plus de
trois fiches est écarté. On compte ensuite combien de ces fiches figurent dans les 18 passages que
le moteur retient réellement.

| Question | Retrouvées | Similarité max | Manquées |
| --- | ---: | ---: | --- |
| modeles-economiques-optimaux | 1/4 | 0,171 | capitalisme-de-marche-libre, economie-de-plateformes, mmt |
| capitalisme-communisme-modele-chinois | 3/4 | 0,438 | communisme |
| philosophie-comparee-bien-vivre | 4/5 | 0,185 | aristote |
| conscience-artificielle-critere | 1/7 | 0,169 | putnam, dennett, turing, chalmers, nagel, penrose |
| limites-ia-generative | 1/2 | 0,325 | karl-popper |
| management-resistant-automatisation | 0/5 | 0,187 | okr, bureaucratie-weberienne, foucault, deleuze, han |
| connaissance-obtenue-par-ia | 0/3 | 0,207 | karl-popper, latour, haraway |
| bien-vivre-mesurable | 2/8 | 0,204 | seligman, tcc, systeme-terre, nietzsche, heidegger, han |
| **TOTAL** | **12/38 = 32 %** | | |

*(la 9ᵉ question, `futurs-modeles-gouvernance`, est exclue : aucune de ses perspectives ne nomme
une fiche identifiable.)*

**32 %. C'est le chiffre le plus important de ce document, et il faut le lire pour ce qu'il dit.**

La colonne « manquées » donne le diagnostic sans ambiguïté : ce sont presque toutes des fiches
nommées d'après un penseur. « À quelles conditions un résultat scientifique obtenu par IA
constitue-t-il une connaissance ? » ne contient ni « Popper », ni « Latour », ni « Haraway ». Un
embedding sémantique rapproche « connaissance scientifique » de « falsifiabilité » et de la fiche
Popper ; un modèle lexical ne le peut pas, par construction — il mesure un recouvrement de
vocabulaire, et il n'y a aucun recouvrement.

Trois familles de manques, du plus au moins grave :

1. **Le nom propre absent de la question.** Popper, Foucault, Nietzsche, Han, Seligman. C'est
   l'essentiel des 26 fiches manquées, et c'est irrattrapable sans embedding sémantique.
2. **Le synonyme.** « bien-vivre » ne rejoint pas « eudémonisme », « encadrement » ne rejoint pas
   « bureaucratie ». Une désuffixation ne fait pas un thésaurus.
3. **La reformulation.** « les limites sont-elles structurelles ou conjoncturelles » ne rejoint pas
   « plafond de la mise à l'échelle ».

En sens inverse, le lexical a une propriété que le sémantique n'a pas : **il ne rapproche jamais
deux textes qui ne partagent rien**. Ses erreurs sont visibles (une fiche « Caltech » qui remonte
parce qu'elle emploie le mot « modèle »), pas subtiles. Et sa réponse est reproductible à
l'identique, sur toute machine et à toute date.

### Ce que ça change pour l'usage

Le moteur est **bon pour retrouver une fiche dont on connaît à peu près le vocabulaire**, et
**faible pour découvrir l'école de pensée qu'on ne savait pas nommer**. C'est un moteur de recherche
documentaire honnête, pas un moteur de découverte conceptuelle.

Si Julien veut le second, c'est exactement ce que sert le §5 : poser une clé d'embeddings. Le code
est prêt, le mécanisme de réindexation automatique aussi. Le coût d'un embedding de 2 855 passages
est de l'ordre de quelques dizaines de centimes chez la plupart des fournisseurs — c'est la seule
dépense qui, mesurée, achèterait un vrai gain.

### Un autre choix mesuré : cosinus plutôt que score BM25 additif

Le score BM25 classique (somme des contributions des termes de la question, sans normalisation par
la norme du document) donne un rappel de **37 %** au lieu de 32 %. Le cosinus a néanmoins été
retenu, pour deux raisons qui ne sont pas de goût :

- il est **borné dans [0, 1]**, ce qui permet des seuils lisibles et transférables ;
- c'est **la même mesure** que celle d'un index dense produit par un fournisseur d'embeddings. Un
  seul chemin de code, un seul jeu de seuils, quel que soit le mode.

Cinq points de rappel pour une architecture qui ne se dédouble pas : le compromis est assumé et
inscrit ici pour pouvoir être rediscuté.

---

## 3. Les seuils, recalibrés — et pourquoi

Les anciennes valeurs (0,35 et 0,45) étaient calées sur l'échelle d'un embedding sémantique. Ce
n'est pas celle d'un cosinus BM25. Les garder aurait fait refuser **toutes** les questions.

Mesuré sur 9 questions du corpus et 6 questions volontairement hors périmètre :

| | Similarité max | Termes de la question retrouvés (au mieux) |
| --- | ---: | ---: |
| **Questions du corpus** (9) | 0,169 à 0,438 | 2 à 6 |
| **Questions hors corpus** (6) | 0,055 à 0,145 | **1**, toujours |

D'où les deux garde-fous :

| Réglage | Ancienne valeur | Nouvelle | Rôle |
| --- | ---: | ---: | --- |
| `ATLAS_RAG_SEUIL_SIMILARITE` | 0,35 | **0,08** | plancher d'entrée d'un passage dans le contexte |
| `ATLAS_RAG_SEUIL_PERTINENCE` | 0,45 | **0,15** | le MEILLEUR passage doit l'atteindre, sinon refus |
| `ATLAS_RAG_MIN_PASSAGES` | 3 | 3 | inchangé |
| `ATLAS_RAG_MIN_TERMES` | — | **2** | **nouveau** : garde-fou lexical |

La marge entre 0,145 (meilleure question hors corpus) et 0,169 (moins bonne question du corpus) est
mince — 0,024. C'est pourquoi un **second garde-fou** a été ajouté, bien plus net : au moins un
passage doit retrouver **2 termes distincts** de la question. Sur les six questions hors périmètre,
aucun passage n'en retrouve jamais plus d'un ; sur les neuf questions-tests, toutes en retrouvent au
moins deux. La séparation est franche là où la similarité seule est ambiguë.

Ce garde-fou ne s'applique **pas** en mode dense (fournisseur d'embeddings) : deux textes peuvent y
être proches sans partager aucun mot, c'est précisément ce qu'on achète.

### Les refus, vérifiés

| Question posée | Réponse du moteur |
| --- | --- |
| « Quelle est la recette du kouign-amann ? » | `hors_corpus`, 0 perspective, similarité 0,123 |
| « Comment soigner une entorse de la cheville ? » | `hors_corpus`, 0 perspective, similarité 0,144 |
| « Combien de temps faut-il cuire un œuf à la coque ? » | `corpus_vide`, aucun passage au-dessus de 0,08 |
| « Quel est le meilleur engrais pour les tomates cerises ? » | `hors_corpus`, 0 perspective, similarité 0,112 |
| Question de moins de 10 caractères | 400 `question_invalide` |
| Question de plus de 400 caractères | 400 `question_invalide` |
| Corps non-JSON | 400 `corps_invalide` |
| 6ᵉ question en moins d'une minute | 429 `trop_de_requetes` |
| Mode `fournisseur` forcé sans clé | 503 `configuration`, message nommant les deux modes sans clé |

Dans tous les cas de refus : `perspectives: []`, les extraits les plus proches affichés à titre
indicatif, et **aucune génération déclenchée** — donc aucun coût, même avec une clé posée.

### Index en retard sur le corpus, vérifié

Une empreinte et une clé ont été volontairement corrompues dans le fichier d'index. Le moteur a
répondu : `nb_passages_absents: 2`, `nb_passages_perimes: 1`, `nb_entrees_orphelines: 1`, deux
avertissements affichés au lecteur nommant `npm run indexer` comme correctif, et **toutes les
fiches affichées avaient une URL valide** — aucune source morte n'est jamais présentée.

---

## 4. Les trois modes de génération

L'interface annonce **toujours** quel mode a produit la réponse affichée, en tête de réponse. Et la
mention de transparence suit le mode : « contenu généré par IA » sur une réponse de modèle,
« aucun modèle génératif n'est intervenu » sur une réponse extractive.

### Mode 3 — extractif, sans aucun modèle (défaut, marche toujours)

C'est le mode qui fonctionne sans rien configurer. Il **ne simule pas** une réponse de modèle : il
n'y a pas de modèle. Chaque perspective est l'assemblage des champs d'une fiche réellement
retrouvée :

| Champ de `Perspective` | Vient de |
| --- | --- |
| `modele` | nom de la fiche (auteur, école, paire humain × IA) + axe et sous-domaine |
| `hypotheses` | thèse centrale (fiche humaine) · mécanisme (gap) · capacités clés (fiche IA) |
| `etat_actuel` | les extraits retrouvés, recopiés — **hors** ceux déjà repris dans les autres champs |
| `reponse` | apport de la fiche · apport de l'IA (gap) |
| `justification` | phrase mécanique : quels champs ont répondu, à quelle proximité |
| `limites` | limites critiques · limites connues · amélioration possible + substituabilité (gap) |
| `sources` | les sources de la fiche, lues dans `data/seed` |
| `niveau_confiance` | déduit du statut documentaire (voir plus bas) |

**Rien n'est reformulé, donc rien ne peut être inventé.** Le seul texte écrit par le moteur est le
tissu conjonctif : étiquettes de champ, phrase de justification, angles morts.

Correspondance statut → confiance, à lire pour ce qu'elle est (elle dit à quel point la fiche a été
relue, pas à quel point la thèse est vraie) :

| Statut de la fiche | Niveau de confiance |
| --- | --- |
| `verifie_recemment` | `consensus_scientifique` |
| `documente`, `a_re_auditer` | `opinion_majoritaire` |
| `a_documenter` | `hypothese_prospective` |
| un champ prospectif retenu (scénario 5 ans / 15-20 ans / axes prospectifs) | `hypothese_prospective`, quel que soit le statut |
| fiche de gap donnée « confiance faible » | `hypothese_prospective` |

`fait_verifie` n'est **jamais** produit par ce mode : il est réservé à une donnée mesurée, et un
assemblage mécanique de champs n'en produit pas.

**Perspectives distinctes** : les passages sont groupés par fiche (sinon quatre extraits du même
auteur deviendraient quatre « écoles »), puis diversifiés par **famille** — axe *et* sous-domaine.
L'axe seul est trop grossier : « social » couvre l'économie, les modèles politiques, la gouvernance
et le management, et plafonner à l'axe écartait « Maoïsme » d'une question sur la comparaison des
systèmes économiques. Une fiche à moins d'un quart de la meilleure similarité ne devient pas une
perspective — elle reste visible dans les extraits.

**Convergence assumée** : si toutes les fiches retenues relèvent du même axe, le moteur le dit —
« elles convergent au lieu de s'opposer, ce n'est pas une controverse » — au lieu de fabriquer un
débat. Vérifié sur « que disent Spinoza et Nietzsche de la béatitude et de la puissance ? », où les
quatre fiches retenues sont philosophiques.

### Mode 2 — prompt à copier, résultat à recoller

Aucune clé. Le moteur cherche, construit le contexte, et rend un prompt **autonome** (13 à 17 000
caractères) contenant la consigne système, la question, les extraits et le gabarit JSON exact. On le
copie, on le colle où l'on veut, on revient avec la réponse, on la recolle.

Le collage de retour est **tolérant par conception**. Réparations appliquées, de la plus fidèle à la
plus intrusive, chacune suivie d'une tentative de lecture :

1. lecture directe ;
2. bloc de code Markdown retiré (``` avec ou sans étiquette de langage, y compris non refermé) ;
3. bavardage écarté — extraction de la structure JSON équilibrée, en respectant les chaînes et les
   échappements (un simple `indexOf("}")` couperait à la première accolade dans une valeur) ;
4. guillemets typographiques `"` `"` redressés — et **eux seuls** : les chevrons français « » et
   l'apostrophe courbe appartiennent au texte de la réponse, les toucher l'abîmerait pour rien ;
5. virgules terminales supprimées.

L'objet complet est essayé **avant** le seul tableau de perspectives : extraire le tableau marche
aussi, mais perd `reformulation` et `angles_morts`.

Vérifié sur un collage volontairement sale — « Bien sûr ! Voici… » + bloc ```json + guillemets
typographiques sur une clé + virgule en trop + un identifiant de fiche inventé : la réponse est lue,
`reformulation` et `angles_morts` conservés, l'identifiant inventé rejeté avec un avertissement
nommé. Vérifié aussi : « Désolé, je ne peux pas répondre » et `{"perspectives":[]}` produisent
chacun un message distinct qui dit quoi faire — **jamais une exception**.

Le texte collé ne franchit pas la validation s'il cite des fiches inventées : les sources affichées
sont toujours celles des fiches réelles, lues dans `data/seed`.

### Mode 1 — fournisseur d'API

Sept entrées derrière une interface unique, dans l'ordre de repli par défaut. Poser la variable
d'environnement suffit : **aucune ligne de code à écrire**.

| Fournisseur | Variable | Où créer la clé | Palier gratuit |
| --- | --- | --- | --- |
| **Générique compatible OpenAI** | `ATLAS_LLM_URL` + `ATLAS_LLM_MODELE` (+ `ATLAS_LLM_CLE`) | selon le fournisseur | couvre tout ce qui expose `POST /v1/chat/completions` : DeepSeek, Fireworks, Nebius, ou un serveur **local** (Ollama, LM Studio, vLLM) où la génération est gratuite et hors ligne |
| **Groq** | `GROQ_API_KEY` | https://console.groq.com/keys | palier gratuit sans carte bancaire, limité en requêtes par minute et par jour selon le modèle. Le plus rapide de la liste |
| **Google AI Studio (Gemini)** | `GOOGLE_API_KEY` | https://aistudio.google.com/apikey | palier gratuit sans carte bancaire sur les modèles Flash. **Attention** : sur le palier gratuit, Google se réserve l'usage des requêtes pour améliorer ses modèles |
| **Mistral AI** | `MISTRAL_API_KEY` | https://console.mistral.ai/api-keys | palier « Expérimenter » gratuit, soumis au partage des données. Seul fournisseur européen de la liste |
| **Cerebras** | `CEREBRAS_API_KEY` | https://cloud.cerebras.ai → « API Keys » | palier gratuit, limites par minute plus basses que les comptes payants |
| **OpenRouter** | `OPENROUTER_API_KEY` | https://openrouter.ai/settings/keys | routeur : les modèles dont l'identifiant finit par `:free` sont gratuits, avec un plafond quotidien. Une seule clé pour essayer plusieurs modèles |
| **Anthropic** | `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys | **aucun palier gratuit** : chaque question est facturée. Conservé parce que c'est le seul de la liste à garantir une sortie structurée par appel d'outil |

Les paliers gratuits changent sans préavis : ces phrases décrivent ce que les fournisseurs
annonçaient à la date de ce document, elles ne valent pas engagement. **Vérifier la page de
tarification avant de compter dessus.**

**Anthropic est délibérément en dernier** : c'est le seul sans palier gratuit. Une réponse doit
coûter de l'argent en dernier recours, jamais en premier. `ATLAS_GENERATION_ORDRE` permet de forcer
un autre ordre (`ATLAS_GENERATION_ORDRE=mistral,groq`) sans retirer les autres clés.

Deux dialectes suffisent à couvrir le marché :

- **Anthropic** : `POST /v1/messages` avec `tools` + `tool_choice`. La sortie structurée est
  **garantie** : le modèle ne peut pas répondre en prose, donc pas en verdict.
- **compatible OpenAI** : `POST /v1/chat/completions` avec `response_format: json_object`. La sortie
  structurée y est demandée, pas garantie — d'où l'analyse tolérante du mode 2, réemployée telle
  quelle. Un refus en HTTP 400 déclenche une seconde tentative sans `response_format`, plutôt que de
  faire échouer le fournisseur pour un paramètre facultatif.

### Le repli

`mode: "auto"` (le défaut) enchaîne : fournisseurs configurés dans l'ordre → si tous échouent, mode
extractif, avec un avertissement qui **nomme chaque échec**. Le mode 2 n'est jamais automatique : il
suppose un aller-retour humain. Il est en revanche toujours proposé, et le prompt est joint à toute
réponse extractive pour qu'on puisse « remonter » d'un mode sans reposer la question.

Les modes `fournisseur`, `prompt` et `extractif` peuvent être forcés depuis l'interface ou par le
champ `mode` de `POST /api/question`.

---

## 5. Brancher un fournisseur d'embeddings (facultatif)

C'est la seule dépense qui achèterait un gain mesuré (cf. §2). Deux façons :

```bash
# API compatible OpenAI (POST /v1/embeddings) — Mistral, Jina, DeepInfra, Ollama local…
ATLAS_EMBEDDINGS_URL=https://api.mistral.ai/v1/embeddings
ATLAS_EMBEDDINGS_MODELE=mistral-embed
ATLAS_EMBEDDINGS_CLE=…

# ou Voyage AI, historique du projet
VOYAGE_API_KEY=…
VOYAGE_MODELE_EMBEDDING=voyage-4-lite
```

Puis `npm run indexer`. Le nom du modèle entre dans l'empreinte de chaque passage : **tout est
réindexé automatiquement**, et le fichier bascule en représentation `dense-int8`. À l'interrogation,
la question est vectorisée par le même fournisseur — sans quoi on comparerait deux espaces
vectoriels sans rapport, et le moteur refuse plutôt que de le faire.

En mode dense, l'index pèse `2 855 × dimension` octets : 2,79 Mo pour 1 024 dimensions, 2,05 Mo pour
768. La quantification 8 bits divise par quatre par rapport aux flottants 32 bits.

---

## 6. Coût

| | |
| --- | --- |
| Indexation | **0 €** (lexical local) · quelques dizaines de centimes une fois avec un fournisseur d'embeddings |
| Recherche | **0 €**, toujours — elle est locale |
| Mode 3 extractif | **0 €**, toujours |
| Mode 2 prompt | **0 €** côté site (le coût est celui du chat que vous utilisez, souvent nul) |
| Mode 1 fournisseur | selon le palier ; nul sur les paliers gratuits du §4 |

Les bornes de coût restent en place et sont toutes effectives : plafond de passages injectés
(`MAX_PASSAGES = 18`), plafond de caractères du contexte (`MAX_CARACTERES = 18 000`, mesuré sur
l'extrait **tel qu'il sera envoyé**, en-têtes compris), plafond de tokens de sortie
(`MAX_TOKENS = 2 600`), cache mémoire, limitation de débit à 5 questions par minute et par adresse.

Et le garde-fou en amont : **une question hors sujet ne déclenche aucune génération**. Elle ne coûte
donc rien, même avec une clé payante posée.

**Limite du cache, à connaître** : il est désormais en mémoire, par instance. Sur un hébergement
serverless, chaque instance a le sien et il disparaît au recyclage. Ce n'est pas une garantie de
« une question posée deux fois = un seul appel », c'est un amortisseur. La recherche étant devenue
gratuite, il ne protège plus que les appels payants — et un vrai cache partagé suppose un stockage
partagé, à faire le jour où le site prendra du trafic *et* où une clé payante sera posée.

---

## 7. L'option Supabase, conservée

`supabase/schema.sql` et `lib/supabase.ts` **ne sont pas supprimés**. Ils décrivent un chemin qui
fonctionne et qui redeviendra pertinent si le corpus décuple.

**Quand y revenir.** L'index local charge tous les vecteurs en mémoire et parcourt la totalité du
corpus à chaque question. À 2 855 passages, cela coûte 3 à 8 ms et 700 Ko de fichier. La règle de
décision, en ordre de grandeur :

| Passages | Fichier d'index | Recherche | Verdict |
| ---: | ---: | ---: | --- |
| 2 855 (aujourd'hui) | 693 Ko | 3-8 ms | fichier local, sans hésitation |
| ~10 000 | ~2,5 Mo | ~25 ms | fichier local, encore confortable |
| ~30 000 | ~7 Mo | ~80 ms | limite : le fichier devient lourd à versionner et le démarrage à froid se sent |
| au-delà | > 15 Mo | > 150 ms | passer à un index approché (HNSW) dans une base — c'est le moment de ressortir `supabase/schema.sql` |

Le seuil réel n'est pas le nombre de passages mais **la taille du fichier au dépôt** : au-delà d'une
dizaine de mégaoctets, chaque réindexation produit un commit lourd, et un hébergement serverless
paie le chargement à chaque démarrage à froid.

Le retour en arrière est possible sans réécriture : `lib/index-vectoriel.ts` expose déjà une
recherche dense sur vecteurs quantifiés, il suffirait d'en faire une variante qui interroge
`atlas_rag_rechercher_passages` au lieu du fichier. Le reste du moteur — découpage, empreintes,
seuils, garde-fous, trois modes — ne bougerait pas d'une ligne.

---

## 8. Ce qui n'est pas fait

- **Aucun test automatisé.** Tout ce qui est écrit ici a été vérifié à la main, par exécution ; rien
  ne garantit qu'une modification future ne casse pas un garde-fou en silence. Le projet n'a pas de
  cadre de test, et en introduire un était hors périmètre de ce lot.
- **`scripts/comparer-qualite-rag.mjs` n'a pas été mis à jour.** Il vérifie le contrat du moteur en
  lisant `lib/rag.ts` (schéma de sortie, `tool_choice`, seuils, plafonds, cache, sources
  reconstruites) et continue de passer, mais il ne connaît pas les trois modes et parle encore de
  « 4 questions-tests » alors qu'il y en a 9.
- **Le mode 2 ne vérifie pas que le texte collé vient bien du prompt fourni.** Un utilisateur peut
  coller n'importe quel JSON conforme au gabarit. Les sources, elles, restent celles du corpus — le
  risque est donc une réponse mal fondée, pas une source inventée.
- **La qualité de la recherche lexicale est ce qu'elle est** : 32 % de rappel sur l'étalon du §2.
  Le chemin pour l'améliorer est identifié et chiffré (§5), il n'a pas été pris parce qu'il suppose
  une clé.
- **Le cache n'est pas partagé** entre instances (§6).

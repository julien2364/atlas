# Questions-tests permanentes — 5 propositions d'extension

_Rédigé le 07/09/2026, lot « Qualité, sources, liens & gouvernance » (Mégaprompt 3, tâche 4)._

**Ce document ne modifie pas `data/seed/questions.json`.** Les questions-tests sont fixées par la
section 7.3 du mégaprompt : elles servent à éprouver en permanence la tenue de la ligne éditoriale
(neutralité active, pluralité de modèles, sourçage daté). Les ajouter engage donc le projet bien
au-delà d'un ajout de contenu — d'où une proposition écrite, à valider par Julien, plutôt qu'un
commit dans le corpus.

Décision demandée : **retenir 0, 1, plusieurs ou les 5 questions ci-dessous**, et pour chaque
question retenue, valider la liste des perspectives avant rédaction (c'est le choix des écoles
convoquées, pas la rédaction, qui fait la neutralité).

---

## Pourquoi étendre maintenant

L'audit des 4 questions existantes (détail dans `docs/audit-qualite-2026-09.md`, §4) conclut que
le schéma `Perspective` de `lib/types.ts` est respecté partout — les 8 champs obligatoires sont
présents et remplis dans les 14 perspectives — mais que la **couverture thématique est étroite** :

| Question existante | Domaine |
|---|---|
| `modeles-economiques-optimaux` | économie |
| `capitalisme-communisme-modele-chinois` | économie |
| `futurs-modeles-gouvernance` | géopolitique |
| `philosophie-comparee-bien-vivre` | philosophie morale |

Trois des cinq axes du référentiel humain (`evolution` — 55 fiches, `psychologique` — 12 fiches,
`serenite` — 5 fiches) ne sont convoqués par **aucune** question, et le référentiel IA n'est
mobilisé nulle part comme objet de question : les 44 fiches IA n'apparaissent dans aucune
perspective. Les questions testent aujourd'hui la moitié du corpus.

Les cinq propositions ci-dessous sont construites pour combler exactement ces trous, en
n'utilisant **que des fiches déjà présentes dans le corpus** — aucune ne demande d'écrire de
nouvelles fiches avant d'être rédigée.

---

## Q5 — Une intelligence artificielle peut-elle être consciente, et à quoi le reconnaîtrait-on ?

_Axe manquant comblé : philosophie de l'esprit. Le mégaprompt la cite explicitement comme absente._

C'est la question où le risque de verdict unique est le plus fort : le débat public tranche
volontiers dans un sens (« ce n'est qu'un perroquet statistique ») ou dans l'autre (« l'étincelle
approche »), alors que la discipline est réellement divisée depuis soixante-dix ans.

| # | Perspective (école) | Réponse en une ligne | Fiches nourricières |
|---|---|---|---|
| 1 | Fonctionnalisme computationnel | Ce qui compte est l'organisation fonctionnelle, pas le substrat : un système qui réalise les bonnes fonctions est conscient au même titre qu'un cerveau. | `hilary-putnam`, `daniel-dennett`, `alan-turing` |
| 2 | Argument de la chambre chinoise | La manipulation de symboles ne produit pas de sémantique : la syntaxe n'est pas l'intentionnalité, quel que soit le niveau de performance. | `john-searle` |
| 3 | Problème difficile de la conscience | Même une réplique fonctionnelle parfaite laisse entière la question du vécu subjectif — la performance ne peut, par construction, pas y répondre. | `david-chalmers`, `thomas-nagel` |
| 4 | Anti-computationnalisme physique | La cognition consciente comporte une part non algorithmique ; aucune machine de Turing ne l'atteindra, indépendamment de sa puissance. | `roger-penrose`, `informatique-quantique` |
| 5 | Position empirique (neurosciences) | La question n'est pas tranchable aujourd'hui faute de critère opérationnel : les corrélats neuronaux étudiés chez l'humain n'ont pas d'équivalent défini pour un transformeur. | `neurosciences-cognitives-et-connectome-humain`, `transformers`, `hallucination-et-fiabilite-factuelle-limite-transversale` |

_Variante à arbitrer_ : ajouter une sixième perspective phénoménologique / incarnée
(`maurice-merleau-ponty`, `bernard-stiegler`) — la conscience suppose un corps et un monde vécu.
Elle est réellement distincte des cinq autres, mais six perspectives allongent beaucoup la page.

**Niveaux de confiance attendus** : `opinion_majoritaire` pour 1 et 2, `hypothese_prospective`
pour 3 et 4, `consensus_scientifique` pour 5 (le constat d'absence de critère, lui, est consensuel).

---

## Q6 — Les limites actuelles de l'IA générative sont-elles structurelles ou conjoncturelles ?

_Axe manquant comblé : limites structurelles de l'IA. Cité par le mégaprompt. Seule question qui
mettrait les 3 fiches de l'axe `limites` en position de sujet, et non de note de bas de page._

L'intérêt de cette question pour le projet est direct : c'est elle qui décide si les fiches de gap
doivent être révisées tous les six mois ou tous les cinq ans.

| # | Perspective | Réponse en une ligne | Fiches nourricières |
|---|---|---|---|
| 1 | Thèse de la mise à l'échelle | Limites conjoncturelles : données, calcul et post-entraînement les ont toutes repoussées jusqu'ici, rien n'indique une asymptote atteinte. | `transformers`, `claude-anthropic-cowork`, `codex-famille-gpt`, `llama` |
| 2 | Limite statistique structurelle | Un modèle qui optimise une vraisemblance ne peut pas garantir la vérité d'un énoncé : l'hallucination est un mode de fonctionnement, pas un défaut à corriger. | `hallucination-et-fiabilite-factuelle-limite-transversale`, `naive-bayes`, `regression-logistique` |
| 3 | Limite des données | Le plafond n'est pas dans l'architecture mais dans le corpus : biais hérités, épuisement des données de qualité, contamination par du texte synthétique. | `biais-herites-des-donnees-d-entrainement-limite-transversale`, `bert` |
| 4 | Limite physique et matérielle | Le verrou est énergétique et industriel avant d'être algorithmique ; il ne se lève pas par la recherche. | `dependance-energetique-et-materielle-de-l-ia-limite-transversale`, `limites-planetaires-stockholm-resilience-centre` |
| 5 | Limite épistémologique | Un système inductif ne produit pas d'énoncé réfutable : le problème est de nature logique, et aucune échelle ne le résout. | `karl-popper`, `noam-chomsky` |

**Niveaux de confiance attendus** : `hypothese_prospective` pour 1, 2 et 3 (aucune des trois n'est
démontrée), `consensus_scientifique` pour 4 sur les ordres de grandeur mesurés, `opinion_majoritaire`
pour 5.

---

## Q7 — Quels modèles de management résistent à l'automatisation d'une partie du travail d'encadrement ?

_Axe manquant comblé : modèles de management. Cité par le mégaprompt. Mobiliserait 16 fiches
`social/management` aujourd'hui documentées mais jamais mises en tension entre elles._

| # | Perspective | Réponse en une ligne | Fiches nourricières |
|---|---|---|---|
| 1 | Rationalisation du travail (OST) | L'IA prolonge Taylor : la mesure et la standardisation s'étendent enfin à l'encadrement lui-même, qui se réduit. | `taylorisme-ost`, `fordisme`, `okr` |
| 2 | Bureaucratie rationnelle-légale | C'est la règle écrite et impersonnelle qui s'automatise le mieux : l'encadrement ne disparaît pas, il se déplace vers le traitement de l'exception. | `bureaucratie-weberienne`, `fayolisme`, `structure-matricielle` |
| 3 | Auto-organisation et autonomie | Ce qui fait la valeur du manager est relationnel et non calculable ; les modèles qui l'avaient déjà admis sont les moins exposés. | `entreprise-liberee`, `holacratie-sociocratie`, `carl-rogers`, `abraham-maslow` |
| 4 | Amélioration continue au poste | Le savoir tacite du terrain ne se capture pas dans un modèle entraîné sur des traces écrites ; l'automatisation s'arrête au seuil de l'atelier. | `toyotisme-lean-management`, `agile-scrum`, `modele-spotify-squads-tribes-chapters-guilds` |
| 5 | Critique du contrôle | La question est mal posée : l'automatisation de l'encadrement n'est pas un gain d'efficacité mais un approfondissement de la société de contrôle. | `byung-chul-han`, `michel-foucault`, `gilles-deleuze`, `openai-operator-agents-de-navigation-web`, `frameworks-multi-agents-langgraph-crewai-autogen` |

**Point de vigilance éditorial** : c'est la question la plus exposée au biais du projet lui-même
(Atlas est produit avec des agents). La perspective 5 n'est pas un ornement — sans elle, la question
devient une brochure.

---

## Q8 — À quelles conditions un résultat scientifique obtenu par IA constitue-t-il une connaissance ?

_Axe manquant comblé : `evolution` (55 fiches — sciences, institutions, chercheurs), aujourd'hui
absent de toute question. Met aussi en jeu les 5 fiches de l'axe IA `scientifique`._

| # | Perspective | Réponse en une ligne | Fiches nourricières |
|---|---|---|---|
| 1 | Falsificationnisme | L'origine d'une hypothèse est indifférente : seule compte la réfutabilité de l'énoncé produit. Le contexte de découverte n'est pas le contexte de justification. | `karl-popper`, `alphafold-deepmind` |
| 2 | Étude sociale des sciences | La connaissance est ce qu'un réseau d'instruments, de laboratoires et de revues stabilise ; l'IA est un actant de plus, ni juge ni oracle. | `bruno-latour`, `donna-haraway`, `cern`, `embl` |
| 3 | Instrumentalisme opératoire | Une prédiction validée expérimentalement est une connaissance, même sans mécanisme explicatif : la structure repliée est juste ou fausse, pas « expliquée ». | `alphafold-deepmind`, `gnome-decouverte-de-materiaux`, `ia-pour-le-controle-de-plasma-en-fusion-nucleaire` |
| 4 | Exigence d'explicabilité | Sans mécanisme causal intelligible, on obtient une corrélation utile, pas une compréhension — et rien qui puisse être enseigné ni transféré. | `forets-aleatoires`, `gradient-boosting-xgboost-lightgbm-catboost`, `hallucination-et-fiabilite-factuelle-limite-transversale` |
| 5 | Institutionnalisme | La connaissance est ce que la revue par les pairs et la reproductibilité valident ; la vraie question est la capacité des institutions à auditer un résultat qu'elles ne peuvent pas recalculer. | `giec-ipcc`, `institut-max-planck`, `nih`, `cnrs`, `ia-en-modelisation-climatique-type-graphcast` |

---

## Q9 — Le bien-vivre est-il mesurable, et faut-il le mesurer ?

_Axe manquant comblé : `serenite` (5 fiches, l'axe le plus mince du référentiel — une question le
mettrait au travail) et `psychologique`. Prolonge la question existante
`philosophie-comparee-bien-vivre` en la déplaçant de « quelle doctrine » vers « quel instrument »,
ce qui évite le doublon._

| # | Perspective | Réponse en une ligne | Fiches nourricières |
|---|---|---|---|
| 1 | Approche par les capabilités | Mesurable, mais pas en utilité : ce qui se mesure, ce sont les libertés réelles d'accomplir ce à quoi on a raison d'accorder de la valeur. | `martha-nussbaum`, `world-happiness-report` |
| 2 | Psychologie positive et psychométrie | Le bien-être déclaré est un fait mesurable, comparable dans le temps et entre pays, et corrélé à des variables objectives. | `martin-seligman`, `therapies-cognitivo-comportementales-tcc`, `world-happiness-report` |
| 3 | Limites bio-physiques | Un bien-vivre non soutenable n'en est pas un : tout indicateur doit être couplé à l'état de la biosphère, sinon il mesure un emprunt. | `limites-planetaires-stockholm-resilience-centre`, `ecologie-globale-et-science-du-systeme-terre` |
| 4 | Refus philosophique de la mesure | Mesurer le bien-vivre, c'est déjà l'avoir manqué : l'indicateur transforme l'existence en performance et produit l'épuisement qu'il prétend constater. | `friedrich-nietzsche`, `byung-chul-han`, `martin-heidegger`, `quete-de-sens-spiritualites-et-laicite` |
| 5 | Quantification algorithmique | Ce que les données massives rendent mesurable, et ce qu'elles déplacent : la mesure devient un instrument de politique publique avant d'être un instrument de connaissance. | `aide-a-la-decision-publique-govtech-ia`, `biais-herites-des-donnees-d-entrainement-limite-transversale`, `global-peace-index` |

---

## Ce que ces cinq questions coûteraient

- **Rédaction** : 24 perspectives à écrire, 8 champs chacune, soit ~192 champs rédigés et sourcés.
  À la cadence observée sur les 4 questions existantes, une demi-journée de travail par question.
- **Sources** : chaque perspective doit porter au moins une source **avec URL** — c'est la faiblesse
  relevée sur la question `philosophie-comparee-bien-vivre`, où 4 sources sur 5 n'ont pas d'URL.
  Prévoir la source primaire (texte de l'auteur, papier de recherche) plutôt qu'une notice
  encyclopédique quand elle existe.
- **Maintenance** : ce sont des questions *permanentes*. Q6 (limites de l'IA) vieillira vite et
  devra être re-auditée à chaque saut de génération de modèle ; les quatre autres sont stables.
- **Aucune nouvelle fiche n'est requise** : les 60 fiches citées ci-dessus existent toutes dans le
  corpus au 07/09/2026.

## Recommandation

Si Julien ne veut en retenir que deux, **Q5 et Q6** : ce sont les deux que le mégaprompt nomme
explicitement, et ce sont les seules qui font du référentiel IA un objet de questionnement plutôt
qu'un catalogue. **Q7** est la plus utile commercialement mais la plus exposée au biais du projet.
**Q8 et Q9** sont les plus utiles à l'équilibre du corpus, parce qu'elles activent des axes entiers
aujourd'hui muets.

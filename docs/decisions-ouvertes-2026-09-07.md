# Décisions ouvertes — Atlas Humain × IA, 7 septembre 2026

> Chaque point est présenté en options A, B, C, avec ce que chacune engage et une recommandation argumentée. Tant que rien n'est tranché, c'est l'option marquée **par défaut** qui s'applique de fait.

---

## 1. La gouvernance de la veille

Le cycle collecte → patch → validation → publication existe et fonctionne. Ce qui n'est pas tranché, c'est si une partie peut se déclencher sans relecture humaine.

**A — Statu quo. Tout patch passe par une relecture humaine.** *(par défaut)*
Aucune fiche ne bouge sans qu'un humain ait lu le patch. Coût : environ 30 minutes par semaine pour tenir la file. Bénéfice : la règle « aucune fiche modifiée sans validation humaine » reste vraie sans exception, ce qui est aujourd'hui l'argument de crédibilité du projet.

**B — Auto-validation étroite sur liste blanche de domaines.**
Un patch s'applique seul si sa source vient d'un domaine explicitement autorisé — comité de lecture, DOI, institution publique — et jamais sur le score seul. Plafonné à cinq patchs par exécution. Gain de temps réel, mais la règle absolue devient une règle avec exceptions, et il faut alors tenir la liste blanche.

**C — Pré-validation assistée.** *(recommandé)*
Le script trie et marque comme sûrs les patchs qui remplissent tous les critères ; l'humain voit une file déjà triée et valide en bloc. La règle reste intacte : rien ne s'applique sans un geste humain, mais le geste passe de trente minutes à quelques minutes.

**Ce qui tranche, factuellement** : le `score_fiabilite` était déduit du **nom du flux RSS**, pas du contenu — c'est pourquoi la file contenait un communiqué commercial scoré 0,9. Il est désormais calculé sur le domaine de l'URL de la proposition : 23 scores sur 187 ont changé, les 23 perdent l'accès automatique au statut de source primaire, aucun ne le gagne. Un déclenchement automatique sur le score seul aurait été fondé sur un chiffre faux. Même corrigé, le score dit d'où vient une information, pas si elle est juste.

---

## 2. Le TRL sur les usages de recherche — **déjà appliqué, à confirmer ou à annuler**

Ce point était ouvert ; il a été tranché dans le sens de la recommandation, parce qu'il bloquait 33 des 35 défauts bloquants du corpus et que les gaps en héritaient. Il reste réversible.

**A — Ne rien changer.** Le TRL restait posé sur tout, y compris sur des méthodes et des phénomènes. AlexNet portait un TRL 9 sur la foi d'un concours, l'hallucination un TRL 9 alors que ce n'est pas un système déployé.

**B — Redéfinir l'échelle TRL localement**, avec une grille propre au projet. Rejetée : redéfinir une norme ISO en gardant son nom lui conserve son autorité tout en la vidant de son sens, ce qui est le pire des deux mondes.

**C — Restreindre le TRL et introduire un second champ.** *(appliqué)*
Le TRL devient facultatif et se réserve aux usages dont on peut nommer l'exploitant, le lieu et la date ; un champ `diffusion` à quatre valeurs textuelles — `emergent`, `etabli`, `standard`, `historique` — prend le relais ailleurs, délibérément non chiffré pour interdire la confusion ; et toute valeur de TRL exige une `trl_justification` nommant le déploiement qui la fonde.

**Effet mesuré** : sur 83 usages, 21 gardent un TRL justifié, 12 sont relevés, 2 abaissés, 55 passent en diffusion textuelle, 7 perdent le champ. Le validateur contrôle les trois règles. Pour annuler : `git revert` des commits `e97590f` et `7800ccf`.

---

## 3. Les cinq nouvelles questions-tests — **écrites, à publier ou à retirer**

Elles engagent la ligne éditoriale, donc elles restent ton arbitrage même une fois écrites.

**A — Les publier toutes les cinq.** *(état actuel du dépôt)*
Conscience artificielle, limites structurelles ou conjoncturelles de l'IA générative, management résistant à l'automatisation, conditions de la connaissance obtenue par IA, mesurabilité du bien-vivre. 25 perspectives, 107 sources, 65 fiches mobilisées dont 28 fiches IA — les 14 perspectives existantes n'en mobilisaient aucune, ce qui laissait la moitié du corpus hors d'épreuve.

**B — N'en garder que deux ou trois.** Les plus solides sur le corpus actuel sont la conscience artificielle et les limites de l'IA générative. Les trois autres sont écrites mais s'appuient sur des zones plus minces, et le disent dans leurs limites.

**C — Les retirer toutes et n'en publier aucune pour l'instant.** Pour annuler : `git revert dd32a23`.

**Ce que tu dois savoir avant de choisir** : quatre perspectives annoncées au moment de la proposition ont été **rétractées ou rétrogradées faute de matière dans le corpus** — l'épuisement des données d'entraînement, le caractère bloquant de la contrainte énergétique, la capacité des institutions à auditer un modèle, et la mesure algorithmique du bien-vivre. L'écart est écrit dans les limites de chaque perspective plutôt que comblé par des faits extérieurs. C'est honnête, et c'est aussi un signal : ces quatre sujets sont des trous du référentiel.

---

## 4. Le champ `resonance_ia` des fiches humaines

Un audit relève que sur 37 fiches de deux lots, la `resonance_ia` avance des affirmations qui ne figurent dans aucune source de la fiche. C'est une décision éditoriale, pas une correction : elle n'a pas été prise.

**A — Traiter `resonance_ia` comme un champ sourcé** au même titre que les autres. Chaque affirmation doit être attestée, sinon retirée. Le champ maigrit beaucoup et devient parfois vide.

**B — Assumer que c'est un champ de mise en relation**, explicitement non sourcé, et le signaler comme tel dans l'interface et dans la méthodologie. Le champ garde sa richesse, le lecteur sait ce qu'il lit. *(recommandé)*

**C — Supprimer le champ.** Il est ce qui fait la singularité du référentiel : le supprimer reviendrait à publier deux encyclopédies côte à côte sans le lien qui les justifie.

---

## 5. Les six fiches de gap mal appariées

L'audit des gaps a identifié des paires où la fiche IA retenue n'éclaire pas réellement la capacité humaine. Elles ont été **réécrites sur ce que les fiches portent vraiment**, ce qui les rend honnêtes mais moins intéressantes. Changer la paire modifierait l'identité du gap, ce qui n'a pas été fait sans ton accord.

**A — Laisser en l'état.** Les six gaps sont exacts, simplement moins éclairants.

**B — Réapparier les six.** *(recommandé pour `taylorisme-vs-claude-cowork`)*
Le cas le plus net : l'organisation scientifique du travail porte sur la mesure du geste, et elle est appariée à un modèle de langage sans capteur ni vision. Le corpus contient `cnn`, `yolo`, `resnet` et `jumeaux-numeriques-industriels-ia`, tous documentés en vision industrielle. Coût : le gap change d'identifiant, donc d'URL.

**C — Créer les fiches IA qui manquent.** Cinq gaps analysaient l'administration électronique, sujet qu'aucune fiche IA du corpus ne traite — celle qui s'en approche documente le ciblage de contrôles sur données administratives, ce qui est autre chose. Une fiche « dématérialisation des démarches publiques » comblerait un vrai trou.

---

## 6. Ce qui attend un accès et non une décision

Ces trois points ne se tranchent pas, ils se débloquent.

**Les clés du moteur RAG.** Tout est éprouvé sauf la pertinence sémantique elle-même. Il te reste à poser quatre valeurs dans `.env.local`, appliquer le SQL et lancer l'indexation : la procédure exacte, avec ce que tu dois voir à chaque étape, est dans `docs/rag-mise-en-route-et-cout.md`. Coût réactualisé après mesure réelle : environ 6,20 $ par mois pour 300 questions, 3,5 centimes par question non cachée.

**Le DNS `atlas.dyonysos.fr`.** Un enregistrement à créer.

**Le dépôt des documents de pilotage sur le Drive.** La règle de double emplacement du mégaprompt est désormais tenue : les rapports d'audit sont dans `docs/` du dépôt **et** dans le dossier Drive du projet.

---

## 7. Ce qui reste ouvert et que personne n'a tranché

- **La dette des sources primaires imprimées.** 229 entrées primaires sans URL subsistent, presque toutes des œuvres — Einstein 1916, Watson et Crick 1953. Le validateur les distingue désormais des vraies sources manquantes, mais retrouver un exemplaire en ligne œuvre par œuvre reste un chantier entier.
- **26 fiches d'organisations internationales sans source primaire réelle**, parce que leur document fondateur est derrière un Cloudflare ou n'existe pas sous forme de texte unique publié.
- **60 références retirées des documents clés des gaps** — Box et Jenkins pour ARIMA, le *Ménon* pour Socrate — parce que la règle veut qu'ils viennent des deux fiches parentes et qu'elles ne les portaient pas. Le chantier symétrique consiste à les remonter dans les fiches sources, puis à les redescendre.
- **`ia-en-genomique-et-drug-discovery` est un doublon d'`alphafold-deepmind`.** Le résoudre suppose de supprimer ou de renommer une fiche, donc de toucher à un champ d'identité.

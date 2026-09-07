# MEGAPROMPTS DE FINALISATION — Atlas Humain × IA

Rédigé le 06/09/2026. Le référentiel de contenu (311/311 fiches) est terminé — voir
`docs/brief-delegation-documentation.md` et `docs/comment-lancer.md`. Ce document contient **3 megaprompts
indépendants**, à coller chacun tel quel en tête d'une nouvelle session Claude (idéalement **Claude Code en
local sur `~/Claude/atlas`**, pour pouvoir committer ET pusher directement — une session cloud n'a pas les
identifiants git et doit passer par un bundle). Ils peuvent être exécutés dans des sessions séparées, en
parallèle ou dans l'ordre qui t'arrange : ils ne se marchent pas dessus (fichiers différents), sauf mention
contraire ci-dessous.

**Rappel permanent (instructions de Julien, valables pour les 3 megaprompts)** :
- Enchaîner les lots/tâches sans redemander d'accord intermédiaire ; ne demander une validation que sur un
  vrai point de décision (ex. choix d'architecture irréversible, coût récurrent à engager).
- Neutralité active sur tout sujet contesté (jamais un seul verdict présenté comme LA vérité), sourçage
  systématique daté, distinction fait vérifié / consensus / opinion / spéculation.
- Tout nouveau document de pilotage (brief, compte-rendu, mode d'emploi) va **à la fois** dans `docs/` du
  dépôt **et** dans le dossier Google Drive du projet (`https://drive.google.com/drive/folders/1bk91_ulOovJaf8Ec3LgdHgI7vg-e_wEO`) —
  jamais l'un sans l'autre.
- Ne jamais livrer de .zip : committer directement dans `~/Claude/atlas`, donner la commande pour visualiser
  (`npm run dev`, ou l'URL Vercel après push).
- Si la session tourne dans un environnement cloud sans identifiants git (le push échoue avec une erreur de
  proxy), ne pas insister : créer un bundle (`git bundle create ... origin/main..main`), le faire suivre à
  Julien, et lui donner la commande de fetch + push à lancer lui-même dans son vrai Terminal (`~/Claude/atlas`).
- **Point de vigilance actuel** : le commit `b880774` sur `main` contient par erreur des fichiers d'un autre
  projet de Julien (Parents Solo — dossier `addons/parentsolo_website/`, `docs/LIVRAISON-session2-2026-09-06.md`,
  `docs/recherche-developpement-8-12-ans-2026-09-05.md`, `scripts/build_espace_backend.py` etc.), probablement
  poussé par erreur depuis le mauvais dossier local. Le nettoyage est traité dans le Megaprompt 3 — ne pas le
  refaire dans les Megaprompts 1 et 2.

Contexte technique commun : dépôt GitHub `julien2364/atlas`, clone local `~/Claude/atlas`, site déployé
`https://atlas-humain-ia-dyonysos.vercel.app` (déploiement automatique à chaque push sur `main`). Stack :
Next.js 16 (Turbopack) / React 19 / TypeScript / Tailwind, données statiques dans `data/seed/*.json`,
schéma complet dans `lib/types.ts`. Spécification maîtresse du projet : `docs/megaprompt.md` (à relire en
entier avant de commencer — sections 7 à 9 en particulier pour situer le lot concerné).

---

## MEGAPROMPT 1 — Fonctionnalités avancées & profondeur analytique

Tu interviens sur le projet "Atlas Humain × IA" (voir contexte technique commun ci-dessus — lis d'abord
`docs/megaprompt.md` en entier, puis `lib/types.ts` pour le schéma exact des données). Le référentiel de
contenu est fini à 100% (311 fiches). Ta mission : faire passer le site du stade "référentiel documenté" au
stade "observatoire réellement analytique", en t'appuyant sur les lots 6 et 7 du mégaprompt qui restent
incomplets, plus des extensions de profondeur qu'ils appellent naturellement.

### État actuel précis (vérifié le 06/09/2026, ne pas re-découvrir ce qui suit)

- `/cartographie` (`components/CartographieClient.tsx`) affiche déjà : un treemap par domaine
  (`components/Treemap.tsx`), un radar de maturité IA **moyenne** par secteur (`components/RadarChart.tsx`,
  calculé en moyennant le `trl` de tous les `usages` de toutes les fiches IA par `secteur`), une frise du
  changelog (`components/FriseChangelog.tsx`), et une matrice de gap cliquable (fiche humaine × fiche IA,
  avec repli honnête si la paire n'est pas documentée). Il **manque** : un vrai graphe de connaissances
  (force-directed, relations entre fiches/gap) annoncé section 8 du mégaprompt, et une heatmap TRL en grille
  (secteur × axe IA), plus fine que la moyenne actuelle du radar.
- `data/seed/fiches_gap.json` ne contient que **6 paires documentées** sur les 311×44 combinaisons possibles
  (le comparateur gère déjà le cas "non documenté" proprement — ce n'est pas un bug, juste un contenu mince).
  Le schéma `FicheGap` (voir `lib/types.ts`) supporte déjà des champs riches ajoutés en Lot 9 (`sujet`,
  `sous_themes`, `axes_recherche`, `documents_cles`, `axes_prospectifs` — plusieurs futurs nommés avec niveau
  de confiance, pas un seul scénario) : les nouvelles fiches de gap doivent les utiliser, pas seulement les
  6 champs de base (Lot 4).
- `/questions` (`components/QuestionsClient.tsx`) affiche 4 questions-tests permanentes (section 7.3 du
  mégaprompt), chacune avec plusieurs `Perspective` structurées (modèle, hypothèses, état actuel, réponse,
  justification, limites, sources, niveau de confiance) — **contenu curé à la main, pas un moteur RAG live**.
  Le Lot 6 (moteur de réponse prédictive par RAG/pgvector, section 7.3 et 8 du mégaprompt) n'a jamais été
  construit : `lib/supabase.ts` existe et pointe vers un client Supabase, mais aucune variable d'env n'est
  renseignée (`.env.example` a les clés vides) et `supabase/schema.sql` n'a jamais été exécuté sur un vrai
  projet Supabase.
- `/veille` (`app/veille/page.tsx`) est un **affichage en lecture seule** de la file de validation
  (`data/seed/veille_queue.json`, 184 entrées) — aucun bouton, aucune action serveur, aucune écriture. La
  validation manuelle promise par le mégaprompt (section 7.1 : "file d'attente de validation") n'existe pas
  encore concrètement.

### Tâches à enchaîner

1. **Décision Supabase (bloquante pour le reste du lot RAG)** : un compte Supabase existe déjà chez Julien
   (org "julien2364's Org"). Avant de coder le RAG, poser la question explicite à Julien (ou la faire
   remonter dans le brief si tu ne peux pas attendre de réponse) : projet Supabase dédié à Atlas, ou
   mutualisé dans un projet existant ? Une fois tranché (ou par défaut si aucune réponse sous 24h : créer un
   projet dédié, c'est plus propre et l'écart de coût est faible), exécuter `supabase/schema.sql`, renseigner
   `.env.local` (jamais commité), et documenter la procédure dans `docs/comment-lancer.md`.
2. **Moteur RAG minimal viable** : indexer les 311 fiches + les fiches de gap dans `pgvector` (embeddings —
   Voyage AI reste bloqué côté clé API selon le brief ; à défaut, utiliser un modèle d'embeddings disponible
   sans blocage, par exemple l'API Anthropic ou un modèle open source local, et documenter ce choix). Route
   API qui reçoit une question libre, récupère les fiches pertinentes, et génère une réponse au **gabarit
   imposé section 7.3** : reformulation, synthèse des positions en présence (jamais une seule école comme
   réponse unique sur un sujet contesté), scénarios/pistes de dépassement si pertinent, sources mobilisées
   avec date de fraîcheur, limites et angles morts explicites. Réutiliser la structure `Perspective` déjà
   définie dans `lib/types.ts` plutôt que d'inventer un nouveau format de réponse.
3. **`/veille` : vraies actions de validation.** Ajouter les server actions Next.js pour approuver/rejeter
   une entrée de la file (184 en attente) : approuver = appliquer la mise à jour proposée à la fiche cible et
   ajouter une entrée `changelog.json` horodatée ; rejeter = marquer l'entrée comme traitée sans y toucher.
   Étant donné le volume, ajouter aussi un mode "revue en lot" (filtrer par score de fiabilité, par domaine,
   par type de proposition) plutôt qu'une seule liste linéaire de 184 items.
4. **Étendre `fiches_gap.json`** : prioriser des paires à forte valeur pédagogique plutôt que l'exhaustivité
   combinatoire — croiser chaque axe IA (`generatif_raisonnement`, `agentique`, `scientifique`, `sectoriel`,
   `limites`, `predictif_data_science`) avec au moins 3-4 fiches humaines représentatives de sous-domaines
   différents. Utiliser systématiquement les champs Lot 9 (`axes_prospectifs` avec plusieurs futurs nommés,
   pas un seul scénario linéaire).
5. **Graphe de connaissances** (composant nouveau, `components/GrapheConnaissances.tsx` ou équivalent) :
   visualisation force-directed des relations fiche humaine ↔ fiche IA ↔ fiche de gap. Pas de nouvelle
   dépendance lourde nécessaire si évitable (le projet n'a actuellement ni D3 ni react-flow en dépendance) —
   évaluer d'abord un rendu SVG fait main dans le même esprit que `Treemap.tsx`/`RadarChart.tsx` avant
   d'ajouter une librairie.
6. **Heatmap TRL réelle** : grille secteur (6) × axe IA (6), cellule = TRL moyen ou distribution, cliquable
   vers les fiches concernées — en complément du radar existant (moyenne globale par secteur), pas en
   remplacement.

### Definition of done

`npx tsc --noEmit` et `npm run build` passent, chaque nouvelle fonctionnalité a une entrée `changelog.json`,
le brief de délégation (`docs/brief-delegation-documentation.md`) est mis à jour pour retirer les points
traités, commit + push (voir contraintes communes en haut de ce document si tu es en session cloud).

---

## MEGAPROMPT 2 — Design & identité visuelle

Tu interviens sur le projet "Atlas Humain × IA" (voir contexte technique commun en tête de ce document —
lis `docs/megaprompt.md` en entier d'abord). Le contenu est fini, les fonctionnalités de base marchent ; ta
mission est purement de **design et d'expérience visuelle** — ne touche pas au contenu des fiches ni à la
logique métier (comparateur, gap analysis, veille) sauf pour l'habiller.

### État actuel précis

- Tailwind CSS, classes `dark:` déjà utilisées ponctuellement dans plusieurs composants (`app/veille/page.tsx`
  par exemple) mais **sans bascule explicite ni cohérence garantie** — pas de vérification que chaque page
  respecte le même système clair/sombre. `app/globals.css` et `app/layout.tsx` sont les points d'entrée du
  thème global.
- Pas de charte graphique formalisée : pas de palette de couleurs documentée, pas de typographie choisie
  au-delà des défauts Next.js/Tailwind, favicon probablement celui par défaut (`app/favicon.ico` à vérifier).
- Le site n'a pas de lien visuel explicite avec l'identité DYONYSOS (l'entité de Julien) — à ne pas confondre
  avec de la marque commerciale appuyée : Atlas est un outil interne/thought-leadership, pas un produit
  vendu, donc sobre et crédible plutôt que "vendeur".
- Les 8 pages existantes (`/`, `/referentiel-humain`, `/referentiel-ia`, `/cartographie`, `/comparateur`,
  `/questions`, `/veille`, `/methodologie`) n'ont probablement pas toutes reçu le même niveau de polish —
  vérifier chacune individuellement plutôt que de supposer une cohérence.

### Tâches à enchaîner

1. **Définir et documenter une charte graphique courte** dans `docs/design-system.md` (nouveau fichier,
   même règle de double emplacement local+Drive que les autres documents de pilotage) : palette (mode clair
   et sombre), échelle typographique, espacements, style des badges de statut (`a_documenter` /
   `documente` / `verifie_recemment` / `a_re_auditer`) et de niveau de confiance
   (`fait_verifie` / `consensus_scientifique` / `opinion_majoritaire` / `hypothese_prospective`) — ces deux
   taxonomies reviennent partout dans le site et méritent un traitement visuel cohérent et immédiatement
   lisible (couleur + icône, pas seulement du texte).
2. **Bascule clair/sombre explicite** (bouton dans `components/NavBar.tsx`), avec persistance du choix côté
   client. Auditer toutes les pages pour vérifier qu'aucune ne casse en mode sombre (contrastes de texte,
   bordures, fonds de carte).
3. **Passe d'accessibilité** : contrastes suffisants (WCAG AA au minimum) sur les badges de statut et de
   confiance en particulier (souvent des couleurs vives sur fond clair/sombre), navigation clavier sur le
   comparateur et la cartographie (actuellement pilotés par clic/état React — vérifier qu'ils restent
   utilisables au clavier), attributs `alt`/`aria` sur les visualisations SVG faites main.
4. **Polish page par page**, dans cet ordre de priorité (page d'entrée du visiteur d'abord) : `/` (page
   d'accueil — doit donner envie d'explorer, présenter la démarche en 2-3 phrases, chiffres clés du
   référentiel type "311 fiches, 8 sources de veille actives"), `/comparateur` (l'outil le plus interactif),
   `/cartographie` (dense en information, doit rester lisible), puis les pages de listing
   (`/referentiel-humain`, `/referentiel-ia`, `/questions`, `/veille`, `/methodologie`).
5. **Responsive mobile** : vérifier chaque page à une largeur d'écran téléphone, en particulier les
   visualisations (treemap, radar, matrice de gap) qui sont probablement pensées desktop-first.
6. **Favicon et métadonnées** (`app/layout.tsx`) : titre de page, description, favicon cohérents avec un
   projet "Atlas Humain × IA — DYONYSOS" plutôt que les valeurs par défaut Next.js.

### Definition of done

Captures d'écran avant/après pour chaque page modifiée (jointes au commit ou au message à Julien),
`npm run build` passe, `docs/design-system.md` créé et synchronisé sur Drive, commit + push.

---

## MEGAPROMPT 3 — Qualité, sources, liens & gouvernance documentaire

Tu interviens sur le projet "Atlas Humain × IA" (contexte technique commun en tête de ce document). Le
référentiel de 311 fiches a été produit en sprint intensif (deux jours, 06-07/09/2026) — ta mission est un
**audit de second regard**, comme demandé explicitement dans `docs/brief-delegation-documentation.md`
("audit qualité de second passage") : vérifier ce qui a été fait plutôt que produire du nouveau contenu.

### Tâches à enchaîner

1. **Nettoyer la contamination croisée sur `main`** : le commit `b880774` a introduit par erreur des fichiers
   d'un autre projet de Julien (Parents Solo) dans le dépôt Atlas — `addons/parentsolo_website/` (module
   Odoo), `docs/LIVRAISON-session2-2026-09-06.md`, `docs/recherche-developpement-8-12-ans-2026-09-05.md`,
   `scripts/build_espace_backend.py`, `scripts/mon_espace_app.js`, `scripts/neutral_language.js`,
   `scripts/update_mon_espace.py`. Confirmer d'abord auprès de Julien (ou vérifier dans le dépôt
   `Parents-Solo-Familles-Monoparentales`) que ce contenu existe bien ailleurs avant de le supprimer ici —
   ne jamais supprimer sans confirmation qu'aucune copie unique n'est perdue. Une fois confirmé : `git rm`
   ces fichiers dans un commit dédié et clairement nommé (`fix: retrait de fichiers Parents Solo poussés par
   erreur dans le dépôt Atlas`), pas mélangé à d'autre travail.
2. **Audit de cohérence éditoriale** sur un échantillon représentatif des 311 fiches (pas nécessairement les
   311 une par une — cibler en priorité les fiches produites le plus vite, notamment les batchs
   `social_2.json` organisations internationales et `fiches_ia.json` axe `predictif_data_science`, produits
   par lots de 10-40 fiches d'affilée) : ton "neutralité active" respecté, pas de jugement de valeur déguisé
   en fait, `resonance_ia` réellement pertinente et pas générique/copiée-collée d'une fiche à l'autre.
3. **Audit des sources** : beaucoup de sources ont été enregistrées sans URL (type `secondaire` sans champ
   `url`, notamment pour les frameworks logiciels et publications sans page Wikipédia dédiée — voir méthode
   documentée dans `docs/brief-delegation-documentation.md`). Repasser sur ces cas pour ajouter une URL
   quand une source primaire identifiable existe (documentation officielle, papier de recherche) plutôt que
   de laisser un champ vide évitable. Pour les sources qui ont une URL, vérifier par échantillonnage qu'elles
   ne sont pas mortes (404) — script Node/Python de vérification HTTP en lot plutôt que clic manuel un par
   un.
4. **`data/seed/questions.json`** (4 entrées) : vérifier que chaque `Perspective` respecte bien le schéma
   complet (`hypotheses`, `etat_actuel`, `reponse`, `justification`, `limites`, `sources`,
   `niveau_confiance`) et couvre un éventail de modèles/écoles réellement contradictoire, pas trois variantes
   du même camp. Évaluer si le corpus de 4 questions-tests permanentes (fixé section 7.3 du mégaprompt)
   mérite d'être étendu maintenant que le référentiel est complet — si oui, proposer 3-5 nouvelles questions
   couvrant des axes non représentés (ex. rien sur la philosophie de l'esprit/conscience de l'IA, sur les
   modèles de management, ou sur les limites structurelles de l'IA) plutôt que de les ajouter toi-même sans
   validation, étant donné que ce sont des questions-tests permanentes qui engagent la ligne éditoriale du
   projet.
5. **Gouvernance du changelog** : une fois le Megaprompt 1 (veille avec vraies actions) en place, documenter
   dans `docs/methodologie` (page du site) et dans un fichier `docs/gouvernance-veille.md` la procédure
   attendue de revue humaine (qui valide, à quelle fréquence, quel seuil de score de fiabilité déclenche une
   validation automatique vs. manuelle — section 7.1 du mégaprompt évoque une "validation automatique si
   confiance élevée et source primaire" jamais implémentée, à trancher explicitement avec Julien avant de
   coder une auto-validation qui toucherait le contenu sans supervision).

### Definition of done

Rapport d'audit synthétique (nouveau fichier `docs/audit-qualite-2026-09.md`, même règle de double
emplacement local+Drive), liste des fiches corrigées avec justification dans `changelog.json`, commit dédié
au nettoyage du commit égaré séparé du reste, commit + push.

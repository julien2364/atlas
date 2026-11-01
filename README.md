# ATLAS Humain × IA

Observatoire comparatif des capacités humaines et des capacités de l'intelligence artificielle.
Spécification complète : [`docs/megaprompt.md`](./docs/megaprompt.md).
Instructions de lancement à jour : [`docs/comment-lancer.md`](./docs/comment-lancer.md).

## Démarrage rapide

\`\`\`bash
npm install
npm run dev
\`\`\`

Ouvrir http://localhost:3000 — le site fonctionne dès maintenant sur les données d'amorçage
(\`data/seed/*.json\`, 580 fiches humaines + 71 fiches IA + 201 fiches de gap), sans avoir besoin de Supabase configuré.

## État du projet (31/10/2026)

Tous les chiffres ci-dessous ont été re-mesurés le 31/10/2026 sur `main`.

- **Corpus : 852 fiches** (580 humaines, 71 IA, 201 gaps), toutes au statut `documente`.
  `scripts/valider-donnees.mjs` : 0 erreur, 532 avertissements de sourcing (sources primaires
  imprimées sans URL — dette assumée et documentée) ; `scripts/verifier-changelog.mjs` : socle 514 + 338 déclarées = 852.
- **Huit portes de vérification passent** (exit 0 le 31/10/2026) : `valider-donnees`, `verifier-index`
  (index de 4 155 passages = 100 % du corpus), `verifier-relations` (813 relations sur 651 fiches),
  `cliquet-qualite` (aucune règle dégradée), `verifier-changelog`, `verifier-workflows`
  (8 workflows), `tsc --noEmit`, plus lint et build via `npm run verifier`.
- **Couverture des attentes du mégaprompt** (sections 3 et 4, 80 items) : **100 %** (79 couverts,
  1 couvert dans l'autre référentiel) — `scripts/detecter-lacunes.mjs`, 31/10/2026.
- **Questions-tests** : 9 dans `data/seed/questions.json` (les 5 proposées le 07/09 y figurent ;
  la décision publier/retirer reste ouverte côté Julien, `docs/decisions-ouvertes-2026-09-07.md` §3).
- **Cartographies** : `/cartographie` intègre la heatmap TRL (fiche IA × secteur), la heatmap
  axe × secteur, le graphe de connaissances (fiche humaine ↔ gap ↔ fiche IA) et la frise du
  changelog — câblés dans `components/CartographieClient.tsx`.
- **Veille** : interface de revue en lot sur `/veille` (filtres statut/cible/source/score + export de
  décisions, aucune écriture serveur) ; la file compte 3 199 propositions dont **2 533 en attente de
  revue humaine**. Aucune fiche n'est modifiée sans validation humaine tracée. Le second canal de
  collecte prévu au mégaprompt v1.1 §13.4 n'est pas activé — son collecteur est maintenu dans un
  dépôt privé (règle 9, voir `docs/gouvernance-veille.md` §7).
- **Moteur de réponse** : moteur local extractif sans clé (`lib/reponse-extractive.ts`) servi par
  `/api/question`, avec un index couvrant 100 % du corpus. Le RAG sémantique pgvector reste
  bloqué en attente de clés — **À DÉCISION JULIEN** (projet Supabase + clé embeddings ; coût
  estimé ~6,20 $/mois d'après `docs/rag-mise-en-route-et-cout.md`). Aucune migration SQL appliquée.
- **Déploiement** : Vercel, projet « atlas-humain-ia » (https://atlas-humain-ia-dyonysos.vercel.app),
  diffusion publique (`NEXT_PUBLIC_SITE_MODE=public`). Domaine `atlas.dyonysos.fr` : non configuré —
  À DÉCISION JULIEN (domaine personnalisé Vercel + enregistrement DNS CNAME).

## État du projet (05/09/2026) — historique

- **Lot 1 (architecture)** : terminé — Next.js/Tailwind, modèle de données, schéma Supabase (`supabase/schema.sql`).
- **Lot 2/3 (amorçage contenu)** : en cours — 12 fiches humaines + 6 fiches IA réellement documentées, 6 fiches de
  gap analysis. Les 5 axes humains et les 6 axes IA du mégaprompt ont désormais chacun au moins une entrée (les axes
  psychologique/sérénité côté humain et agentique/scientifique/sectoriel/limites côté IA étaient à 0 fiche jusqu'au
  05/09/2026 — corrigé après audit QA, voir Lot QA ci-dessous). Reste du corpus (255 fiches humaines, 38 fiches IA)
  au statut "à documenter".
- **Audit QA (05/09/2026)** : suite à un retour de Julien jugeant la profondeur insuffisante, deux agents
  indépendants (testeur visiteur/utilisateur + vérificateur professionnel) ont audité le site. Corrigé : le rendu de
  `/referentiel-humain` qui n'affichait jamais le contenu des fiches documentées ; le risque de régression silencieuse
  dans `scripts/generate-seed.mjs` (démontré par un incident réel pendant l'audit, corrigé par un merge protecteur) ;
  les axes vides. Le projet est désormais versionné dans git en local (aucun commit depuis le scaffold initial
  jusqu'à cet audit) pour se prémunir d'un futur incident de perte de données.
- **Lot 4 (comparateur)** : fonctionnel — sélecteur libre permettant de choisir n'importe quelle paire
  fiche humaine × fiche IA ; affiche l'analyse complète pour les 4 paires documentées, un repli honnête
  "à documenter" sinon (jamais de contenu inventé).
- **Lot 5 (veille autonome)** : pipeline RSS réel et testé (`scripts/veille-rss.mjs`) — interroge les sources
  actives, déduplique, dépose les nouveautés dans une file de validation manuelle (`data/seed/veille_queue.json`,
  visible sur `/veille`). 5 sources actives sur 8 ; 3 désactivées après échec HTTP réel confirmé (documenté dans
  `veille_sources.json`). Spiderfoot (2e canal) reste à intégrer. Aucune fiche n'est mise à jour automatiquement.
- **Lot 6 (Q&A/RAG)** : bloqué — nécessite un projet Supabase (pgvector) + une clé API Anthropic configurés ;
  en attendant, les 4 questions permanentes ont des réponses rédigées manuellement dans `/questions`.
- **Lot 7 (cartographies interactives)** : fonctionnel — `/cartographie` propose une répartition par axe cliquable
  (humain et IA) et une matrice de gap cliquable sur les 4 paires documentées. La heatmap TRL par secteur et la
  frise chronologique restent en attente de données réelles d'usages sectoriels (pas encore renseignées).
- **Lot 8 (QA finale/publication)** : non commencé, cohérent avec la diffusion interne actuelle.

Diffusion à cette date : usage interne uniquement (`NEXT_PUBLIC_SITE_MODE=internal` à l'époque — voir l'état au 31/10/2026 ci-dessus pour la situation actuelle).

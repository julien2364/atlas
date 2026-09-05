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
(\`data/seed/*.json\`, 247 fiches humaines + 28 fiches IA), sans avoir besoin de Supabase configuré.

## État du projet (05/09/2026)

- **Lot 1 (architecture)** : terminé — Next.js/Tailwind, modèle de données, schéma Supabase (`supabase/schema.sql`).
- **Lot 2/3 (amorçage contenu)** : en cours — 6 fiches humaines + 3 fiches IA réellement documentées (Nietzsche,
  Démocratie libérale, Capitalisme d'État chinois, Économie du donut, Taylorisme/OST, OKR côté humain ; Claude/Cowork,
  Codex, DeepSeek côté IA), 4 fiches de gap analysis (une par catégorie de substituabilité), reste du corpus (241
  fiches humaines, 25 fiches IA) au statut "à documenter".
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

Diffusion : usage interne uniquement (`NEXT_PUBLIC_SITE_MODE=internal`).

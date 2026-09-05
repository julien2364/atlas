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

Diffusion : usage interne uniquement (`NEXT_PUBLIC_SITE_MODE=internal`).

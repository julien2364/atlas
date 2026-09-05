# COMMENT LANCER — Atlas Humain × IA

Dernière mise à jour : 05/09/2026 (après Lot 1 + amorçage Lot 2/3 + Lot 4 comparateur + Lot 5 veille RSS)

## État actuel du projet

Le projet est un vrai projet Next.js fonctionnel, déjà buildé et testé (npm run build passe sans erreur).
Le site tourne sur des données d'amorçage locales (`data/seed/*.json` : 247 fiches humaines + 28 fiches IA),
sans avoir besoin de Supabase configuré pour l'instant — pratique pour visualiser tout de suite.

Le comparateur (`/comparateur`) est désormais un vrai sélecteur libre (n'importe quelle paire fiche humaine ×
fiche IA), et la veille (`/veille`) tourne sur un pipeline RSS réel et testé, avec sa file de propositions
en attente de validation visible directement sur la page.

Diffusion : **usage interne uniquement** (`NEXT_PUBLIC_SITE_MODE=internal`), pas de mise en ligne publique.

## 1. Lancer le site en local (dès maintenant)

Dans le dossier `Atlas-Humain-IA` :

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000 — pages disponibles : accueil, /referentiel-humain, /referentiel-ia,
/cartographie, /comparateur, /questions, /veille, /methodologie.

## 2. État d'avancement par lot (cf. section 9 du mégaprompt)

- **Lot 1 — Architecture** : ✅ terminé (Next.js/Tailwind/TypeScript, modèle de données, schéma Supabase prêt dans `supabase/schema.sql`).
- **Lot 2/3 — Amorçage contenu** : 🔄 en cours. 247 fiches humaines + 28 fiches IA générées (statut "à documenter"), dont 6 fiches humaines réellement documentées avec sources (Nietzsche, Démocratie libérale, Capitalisme d'État chinois, Économie du donut, Taylorisme/OST, OKR) et 3 fiches IA (Claude/Cowork, Codex, DeepSeek) + 4 fiches de gap analysis (une par catégorie de substituabilité).
- **Lot 4 — Moteur de gap analysis** : 🔄 fonctionnel. Sélecteur libre de n'importe quelle paire fiche humaine × fiche IA sur `/comparateur`, avec repli honnête "à documenter" pour les paires non encore analysées (4 paires documentées à ce jour).
- **Lot 5 — Veille autonome** : 🔄 fonctionnel. Script réel `scripts/veille-rss.mjs` testé en conditions réelles : interroge les sources RSS actives, déduplique, dépose les nouveautés dans une file de validation manuelle affichée sur `/veille`. 5 sources actives sur 8 ; 3 désactivées après échec HTTP confirmé (Anthropic News 404, FMI et OCDE 403 — documenté dans `data/seed/veille_sources.json`). Spiderfoot (2e canal) reste à intégrer. Aucune fiche n'est mise à jour automatiquement — validation humaine requise.
- **Lot 6 — Moteur Q&A/RAG** : ⛔ bloqué. Nécessite un projet Supabase (extension `vector`) + une clé API Anthropic configurés — aucun des deux n'est encore en place. Les 4 questions-tests restent répondues manuellement dans `/questions` en attendant.
- **Lot 7 — Cartographies interactives** : 🔄 fonctionnel. `/cartographie` propose une répartition par axe cliquable (humain et IA, avec liste des fiches et statut) et une matrice de gap cliquable sur les 4 paires documentées, colorée par catégorie de substituabilité. La heatmap TRL par secteur et la frise chronologique (section 8 du mégaprompt) restent en attente : aucune fiche IA n'a encore de données réelles d'usages sectoriels renseignées.
- **Lot 8 — QA finale/publication** : non commencé (cohérent avec la diffusion interne).

## 3. Pour activer Supabase (quand la profondeur du contenu le justifiera)

1. Créer un projet sur supabase.com, activer l'extension `vector`.
2. Exécuter `supabase/schema.sql` dans l'éditeur SQL du projet.
3. Copier `.env.example` vers `.env.local` et renseigner les clés.
4. Migrer les seeds JSON vers les tables (script de migration à écrire au Lot 2 avancé).

## 4. Continuer la production

Le mégaprompt (`megaprompt-atlas-humain-ia.md`, section 9 + section 13) reste la référence : les lots s'enchaînent
par itération, sans validation intermédiaire à chaque étape — seuls les jalons finaux sont à valider.

## 5. Emplacement des fichiers

- **Local** : `/Users/juliendaures/Claude/Atlas-Humain-IA/` (projet Next.js complet)
- **Google Drive** : `megaprompt-atlas-humain-ia.md` et `comment-lancer-atlas-humain-ia.md` synchronisés (le code source du site n'est pas dupliqué sur Drive — seuls les documents de pilotage le sont, conformément aux instructions permanentes).

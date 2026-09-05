# COMMENT LANCER — Atlas Humain × IA

Dernière mise à jour : 05/09/2026 (après Lot 1 + amorçage Lot 2/3 + Lot 4 comparateur + Lot 5 veille RSS + Lot 7 cartographies + audit QA + mise en ligne publique via GitHub/Vercel)

## État actuel du projet

Le projet est un vrai projet Next.js fonctionnel, déjà buildé et testé (npm run build passe sans erreur),
versionné dans git, poussé sur GitHub (`https://github.com/julien2364/atlas`) et **déployé en ligne sur Vercel**
(voir section 0 ci-dessous).
Le site tourne sur des données d'amorçage locales (`data/seed/*.json` : 267 fiches humaines + 44 fiches IA),
sans avoir besoin de Supabase configuré pour l'instant — pratique pour visualiser tout de suite.

Le comparateur (`/comparateur`) est désormais un vrai sélecteur libre (n'importe quelle paire fiche humaine ×
fiche IA), et la veille (`/veille`) tourne sur un pipeline RSS réel et testé, avec sa file de propositions
en attente de validation visible directement sur la page.

Diffusion : **publique** (`NEXT_PUBLIC_SITE_MODE=public`), décidée par Julien — site accessible à tous sur
l'URL Vercel ci-dessous, en attendant le domaine dédié `atlas.dyonysos.fr`.

## 0. Site en ligne et méthode de déploiement

**URL publique : https://atlas-humain-ia-dyonysos.vercel.app**

Le déploiement se fait désormais via GitHub → Vercel (méthode Git), et non plus par envoi manuel de fichiers :
chaque `git push` sur la branche `main` du repo `julien2364/atlas` déclenche automatiquement un nouveau
build et une mise en ligne sur Vercel (projet `atlas-humain-ia`, équipe Vercel "Dyonysos"). C'est beaucoup
plus fiable que l'ancienne méthode d'upload manuel, qui échouait systématiquement sur ce projet (34 fichiers
à renvoyer intégralement à chaque déploiement).

Pour mettre à jour le site : modifier le code localement, committer, puis :

```bash
git push origin main
```

Le déploiement en production se déclenche automatiquement (suivre l'avancement sur
https://vercel.com/dyonysos/atlas-humain-ia).

Prochaine étape (à faire par Julien dans les réglages Vercel) : ajouter `atlas.dyonysos.fr` comme domaine
personnalisé du projet, puis créer l'enregistrement DNS CNAME correspondant chez le fournisseur DNS de
dyonysos.fr.

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
- **Lot 2/3 — Amorçage contenu** : 🔄 en cours. 267 fiches humaines + 44 fiches IA générées, dont 12 fiches humaines réellement documentées (Nietzsche, Démocratie libérale, Capitalisme d'État chinois, Économie du donut, Taylorisme/OST, OKR, Spinoza, Socrate, Aristote, TCC, Kahneman-Tversky, Limites planétaires) et 6 fiches IA (Claude/Cowork, Codex, DeepSeek, AutoGPT, AlphaFold, Hallucination/fiabilité) + 6 fiches de gap analysis. Les 5 axes humains et les 6 axes IA du mégaprompt ont désormais chacun au moins une entrée (corrigé le 05/09/2026 — 2 axes humains et 4 axes IA étaient à 0 fiche jusque-là).
- **Audit QA (05/09/2026)** : 🔍 fait. Julien a jugé la profondeur insuffisante — deux agents indépendants (visiteur/utilisateur + vérificateur professionnel) ont audité le site en conditions réelles. Corrections appliquées : rendu de `/referentiel-humain` réparé (n'affichait jamais le contenu des fiches documentées), garde-fou anti-régression ajouté à `scripts/generate-seed.mjs` (un incident réel pendant l'audit a démontré le risque : le script a écrasé silencieusement 6 fiches documentées avant d'être corrigé et les données restaurées), axes vides comblés. Le projet est maintenant versionné dans git en local.
- **Lot 4 — Moteur de gap analysis** : 🔄 fonctionnel. Sélecteur libre de n'importe quelle paire fiche humaine × fiche IA sur `/comparateur`, avec repli honnête "à documenter" pour les paires non encore analysées (6 paires documentées à ce jour, dont Socrate × Claude/Cowork et TCC × Claude/Cowork, ajoutées lors de l'audit QA).
- **Lot 5 — Veille autonome** : 🔄 fonctionnel. Script réel `scripts/veille-rss.mjs` testé en conditions réelles : interroge les sources RSS actives, déduplique, dépose les nouveautés dans une file de validation manuelle affichée sur `/veille`. 5 sources actives sur 8 ; 3 désactivées après échec HTTP confirmé (Anthropic News 404, FMI et OCDE 403 — documenté dans `data/seed/veille_sources.json`). Un scheduled task quotidien (7h UTC) a été créé pour lancer ce script automatiquement, mais **il n'est pas encore lié à ton ordinateur** (approbation à donner côté device pour qu'il puisse s'exécuter — sinon il tourne dans le vide). Spiderfoot (2e canal) reste à intégrer. Aucune fiche n'est mise à jour automatiquement — validation humaine requise.
- **Lot 6 — Moteur Q&A/RAG** : ⛔ bloqué. Nécessite un projet Supabase (extension `vector`) + une clé API Anthropic configurés. Un compte Supabase existe déjà (org "julien2364's Org", plusieurs projets actifs) — reste à décider si Atlas Humain × IA doit avoir son propre projet Supabase dédié (coût à confirmer) ou être mutualisé dans un projet existant, décision qui te revient. Les 4 questions-tests restent répondues manuellement dans `/questions` en attendant.
- **Lot 7 — Cartographies interactives** : 🔄 fonctionnel. `/cartographie` propose une répartition par axe cliquable (humain et IA, avec liste des fiches et statut) et une matrice de gap cliquable sur les paires documentées, colorée par catégorie de substituabilité. La heatmap TRL par secteur et la frise chronologique (section 8 du mégaprompt) restent en attente : aucune fiche IA n'a encore de données réelles d'usages sectoriels renseignées.
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

- **Local** : `/Users/juliendaures/Claude/atlas/` (projet Next.js complet, cloné depuis GitHub)
- **GitHub** : `https://github.com/julien2364/atlas` (source de vérité du code, branche `main` = production Vercel)
- **Google Drive** : `megaprompt-atlas-humain-ia.md` et `comment-lancer-atlas-humain-ia.md` synchronisés (le code source du site n'est pas dupliqué sur Drive — seuls les documents de pilotage le sont, conformément aux instructions permanentes).

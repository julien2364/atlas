# COMMENT LANCER — Atlas Humain × IA

Dernière mise à jour : 06/09/2026 (référentiel de contenu terminé à 100% — 311/311 fiches documentées + 86 fiches de gap ; automatisation qualité : validateur d'intégrité, audit de fraîcheur, cron hebdomadaire)

## État actuel du projet

Le projet est un vrai projet Next.js fonctionnel, déjà buildé et testé (npm run build passe sans erreur),
versionné dans git, poussé sur GitHub (`https://github.com/julien2364/atlas`) et **déployé en ligne sur Vercel**
(voir section 0 ci-dessous).
Le site tourne sur des données locales (`data/seed/*.json` : 267 fiches humaines + 44 fiches IA + 86 fiches de gap),
sans avoir besoin de Supabase configuré pour l'instant — pratique pour visualiser tout de suite.
**Le corpus est intégralement documenté depuis le 06/09/2026 : 397/397 fiches au statut `documente`, plus aucune
fiche `a_documenter`.** Chaque fiche porte ses sources et sa date de dernière vérification.

**Le référentiel de contenu est terminé à 100% (311/311 fiches au statut `"documente"`, détail dans
`docs/brief-delegation-documentation.md`).** Les chantiers ouverts restants sont : validation de la file de
veille (184 entrées en attente), audit qualité de second passage, clé API Voyage AI (bloquée côté Julien),
et audit de `questions.json`.

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
- **Lot 2/3 — Contenu des deux référentiels** : ✅ terminé (05-06/09/2026). Les 267 fiches humaines (philosophique 53, évolution 55, social_1 71, social_2 71, psychologique 12, sérénité 5) et les 44 fiches IA sont documentées, chacune à partir d'une source réellement consultée (articles Wikipédia FR, EN en repli, articles fondateurs arXiv/Nature/NeurIPS et documentation officielle pour les fiches IA) — jamais depuis la seule mémoire d'un modèle. Thèse centrale, apport, limites critiques, résonance IA, sources primaires/secondaires pour les fiches humaines ; capacités clés, usages sectoriels avec TRL, limites connues pour les fiches IA.
  Détail par fichier et méthode de recherche dans `docs/brief-delegation-documentation.md`.
- **Audit QA (05/09/2026)** : 🔍 fait. Julien a jugé la profondeur insuffisante — deux agents indépendants (visiteur/utilisateur + vérificateur professionnel) ont audité le site en conditions réelles. Corrections appliquées : rendu de `/referentiel-humain` réparé (n'affichait jamais le contenu des fiches documentées), garde-fou anti-régression ajouté à `scripts/generate-seed.mjs` (un incident réel pendant l'audit a démontré le risque : le script a écrasé silencieusement 6 fiches documentées avant d'être corrigé et les données restaurées), axes vides comblés. Le projet est maintenant versionné dans git en local.
- **Lot 4 — Moteur de gap analysis** : ✅ terminé (06/09/2026). 86 paires analysées (6 d'amorçage + 80 produites en lot), couvrant 86 capacités humaines distinctes croisées avec 37 fiches IA. Chaque fiche suit la méthodologie §5 du mégaprompt (apport et non-apport de l'IA, mécanisme, amélioration possible, mode d'interaction, substituabilité à 4 niveaux, scénarios présent/5 ans/15-20 ans) et le format enrichi du Lot 9 (sujet, sous-thèmes, axes de recherche, documents clés, trois axes prospectifs nommés avec niveau de confiance). Répartition de la substituabilité : 37 remplaçable avec supervision, 33 non remplaçable, 14 remplaçable avec une autre technologie nommée, 2 remplaçable totalement. Le sélecteur libre de `/comparateur` conserve son repli honnête « à documenter » pour les paires non analysées.
- **Lot 5 — Veille autonome** : 🔄 fonctionnel. Script réel `scripts/veille-rss.mjs` testé en conditions réelles : interroge les sources RSS actives, déduplique, dépose les nouveautés dans une file de validation manuelle affichée sur `/veille`. 5 sources actives sur 8 ; 3 désactivées après échec HTTP confirmé (Anthropic News 404, FMI et OCDE 403 — documenté dans `data/seed/veille_sources.json`). Un scheduled task quotidien (7h UTC) a été créé pour lancer ce script automatiquement, mais **il n'est pas encore lié à ton ordinateur** (approbation à donner côté device pour qu'il puisse s'exécuter — sinon il tourne dans le vide). Spiderfoot (2e canal) reste à intégrer. Aucune fiche n'est mise à jour automatiquement — validation humaine requise.
- **Lot 6 — Moteur Q&A/RAG** : ⛔ bloqué. Nécessite un projet Supabase (extension `vector`) + une clé API Anthropic configurés. Un compte Supabase existe déjà (org "julien2364's Org", plusieurs projets actifs) — reste à décider si Atlas Humain × IA doit avoir son propre projet Supabase dédié (coût à confirmer) ou être mutualisé dans un projet existant, décision qui te revient. Les 4 questions-tests restent répondues manuellement dans `/questions` en attendant.
- **Lot 7 — Cartographies interactives** : 🔄 fonctionnel. `/cartographie` propose une répartition par axe cliquable (humain et IA, avec liste des fiches et statut) et une matrice de gap cliquable sur les paires documentées, colorée par catégorie de substituabilité. La heatmap TRL par secteur et la frise chronologique (section 8 du mégaprompt) restent en attente : aucune fiche IA n'a encore de données réelles d'usages sectoriels renseignées.
- **Lot 8 — QA finale/publication** : 🔄 outillé (06/09/2026). Deux scripts et un cron hebdomadaire industrialisent le contrôle qualité et l'anti-obsolescence — voir la section 6 ci-dessous. La relecture éditoriale finale fiche par fiche reste à faire.

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

## 6. Qualité du corpus et anti-obsolescence (automatisé)

Deux scripts, sans dépendance externe ni appel réseau, et un cron hebdomadaire qui les enchaîne.

### `npm run valider` — validateur d'intégrité (`scripts/valider-donnees.mjs`)

Garde-fou anti-régression : il relit tout `data/seed/` et sort en code 1 si le corpus est cassé, ce qui
fait échouer la CI avant toute publication. Contrôles : JSON parsable, unicité des ids, champs obligatoires
selon `lib/types.ts`, enums valides (statuts, axes, secteurs, substituabilité, niveaux de confiance),
dates ISO jamais dans le futur, intégrité référentielle des fiches de gap (les deux fiches citées existent,
pas deux gaps sur la même paire, `technologie_complementaire` présent si et seulement si la substituabilité
le demande), TRL entre 1 et 9, URLs bien formées. Les faiblesses éditoriales (fiche sans source cliquable,
champ trop court, usage sans exemple) sortent en avertissement et ne bloquent pas — sauf avec `--strict`.
`--json` produit une sortie machine.

À lancer avant chaque publication et après toute modification en masse des données.

### `npm run audit-fraicheur` — anti-obsolescence (`scripts/audit-fraicheur.mjs`)

Applique le principe 3 du mégaprompt (aucune fiche n'est définitive) : toute fiche vérifiée il y a plus de
`--seuil` jours (180 par défaut) repasse au statut `a_re_auditer`, sans que son contenu ni sa date de
vérification ne soient touchés. `--dry-run` simule, `--limite=N` borne le nombre de bascules par exécution
(les plus anciennes d'abord) pour éviter un basculement massif d'un coup. Une entrée de changelog est ajoutée
uniquement si au moins une fiche bascule. Le script ne remet jamais une fiche en arrière : seul un travail
de re-documentation la fait repasser en `documente`.

### Les trois crons GitHub Actions

| Workflow | Fréquence | Rôle |
|---|---|---|
| `veille-cron.yml` | quotidien, 07h00 UTC | veille RSS → file de propositions à valider (`/veille`) |
| `qualite-cron.yml` | lundi, 06h00 UTC | validation → audit de fraîcheur → re-validation → commit des bascules |
| `documentation-cron.yml` | mercredi, 05h30 UTC | propositions de sources pour les fiches à (re)documenter |

Le cron documentation tournait toutes les 4 heures pour écluser le backlog initial ; il est passé en
hebdomadaire le 06/09/2026, ce backlog étant vide. Le cron qualité valide **avant et après** l'audit :
un corpus cassé fait échouer le job sans rien committer. Les trois crons sont aussi lançables à la main
depuis l'onglet Actions (`workflow_dispatch`), le cron qualité acceptant un `seuil` et un `dry_run`.

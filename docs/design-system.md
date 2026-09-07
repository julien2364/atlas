# Charte graphique — ATLAS Humain × IA

Version 1.0 — 07/09/2026. Charte **opérationnelle** : ce qui est écrit ici est appliqué dans le code
(`app/globals.css`, `components/Badges.tsx`). Toute divergence entre ce document et le code est un bug de
l'un des deux.

Le site est un outil de thought-leadership, pas un produit vendu : **sobre et crédible**, pas vendeur. Pas
d'illustration décorative, pas de dégradé, pas d'ombre portée gratuite. L'information — le chiffre, la
source, la date — est le seul ornement.

---

## 1. Principe directeur : jamais la couleur seule

Trois taxonomies reviennent sur toutes les pages (statut, niveau de confiance, substituabilité). Chacune est
rendue par **couleur + glyphe + libellé en toutes lettres**. Un lecteur daltonien, une impression noir et
blanc ou une capture en niveaux de gris doivent rester lisibles.

Corollaire pour les visualisations : une cellule de heatmap porte son chiffre, une absence de donnée porte
une hachure et la mention « n. d. » (≠ valeur basse), un nœud de graphe porte une forme (cercle / losange /
rectangle) en plus de sa couleur.

---

## 2. Palette

Définie en variables CSS dans `app/globals.css`. Le thème sombre est piloté par la classe `.dark` posée sur
`<html>` (bascule explicite, cf. §6), pas par la seule préférence système.

| Rôle | Variable | Clair | Sombre |
| --- | --- | --- | --- |
| Fond de page | `--fond` | `#ffffff` | `#0a0a0a` |
| Fond secondaire (encadrés) | `--fond-doux` | `#fafafa` | `#171717` |
| Fond de carte | `--fond-carte` | `#ffffff` | `#0f0f0f` |
| Texte principal | `--texte` | `#171717` | `#ededed` |
| Texte secondaire | `--texte-doux` | `#525252` | `#d4d4d4` |
| Méta / légende | `--texte-tres-doux` | `#737373` | `#a3a3a3` |
| Bordure | `--bordure` | `#e5e5e5` | `#262626` |
| Bordure appuyée | `--bordure-forte` | `#a3a3a3` | `#525252` |
| Accent (liens, actif) | `--accent` | `#4f46e5` | `#a5b4fc` |
| Anneau de focus | `--anneau` | `#171717` | `#ededed` |

`--background` / `--foreground` sont conservés comme alias : `components/GrapheConnaissances.tsx` peint ses
nœuds SVG avec ces deux variables. Ne pas les renommer sans le corriger.

**Plancher de contraste** : AA (4.5:1 pour le texte, 3:1 pour un élément graphique porteur d'information).
`text-neutral-400` sur fond blanc tombe à 3,2:1 — proscrit pour du texte ; le couple utilisé partout est
`text-neutral-500 dark:text-neutral-400` (4,8:1 en clair, 9:1 en sombre).

---

## 3. Typographie

Polices **système** (`--police-texte`) : aucune dépendance, aucun téléchargement, aucun décalage de rendu.
Le projet n'utilise pas `next/font` — ne pas en introduire sans arbitrage explicite.

| Usage | Taille | Classe Tailwind |
| --- | --- | --- |
| Titre d'accueil | 34 px | `text-3xl font-semibold tracking-tight` |
| Titre de page (h1) | 28 px | `text-2xl font-semibold tracking-tight` |
| Titre de section (h2) | 22 px | `text-lg font-medium` |
| Sous-titre de bloc (h3) | 13 px | `text-xs font-semibold uppercase tracking-wide` |
| Corps | 16 px | `text-base` (14 px `text-sm` dans les listes denses) |
| Méta, badge, légende | 11–13 px | `text-[11px]` / `text-xs` |

Longueur de ligne : le texte suivi ne dépasse pas ~75 signes (`max-w-2xl` / `max-w-3xl`).

---

## 4. Espacements

Échelle Tailwind par pas de 4 px, avec trois rythmes seulement :

- **entre sections d'une page** : `space-y-10` (40 px) ;
- **entre blocs d'une section** : `space-y-6` puis `space-y-3` (24 / 12 px) ;
- **intérieur de carte** : `p-4` ou `p-5`, `gap-2` entre badges.

Largeur de contenu : `max-w-6xl` pour la coque, `px-4 sm:px-6` (marge réduite sur téléphone).

---

## 5. Les trois taxonomies

### 5.1 Statut de fiche (nominal — 4 valeurs)

| Valeur | Glyphe | Ton | Lecture |
| --- | --- | --- | --- |
| `a_documenter` | `□` | neutre | rien n'a encore été écrit |
| `documente` | `✓` | vert | rédigé et sourcé |
| `verifie_recemment` | `✓✓` | bleu | rédigé **puis** revérifié |
| `a_re_auditer` | `↻` | ambre | la fraîcheur n'est plus garantie |

### 5.2 Niveau de confiance (ORDINAL — 4 valeurs)

L'échelle étant ordonnée, le glyphe l'est aussi : une jauge de points pleins se range sans connaître le code
couleur.

| Valeur | Glyphe | Ton |
| --- | --- | --- |
| `fait_verifie` | `●●●●` | vert |
| `consensus_scientifique` | `●●●○` | bleu |
| `opinion_majoritaire` | `●●○○` | ambre |
| `hypothese_prospective` | `●○○○` | violet |

### 5.3 Substituabilité d'une paire humain × IA (4 valeurs)

Le disque figure la part que l'IA peut prendre. Le quatrième cas n'est pas sur ce continuum : symbole de
combinaison.

| Valeur | Glyphe | Ton | Aplat SVG |
| --- | --- | --- | --- |
| `remplacable_totalement` | `●` | rouge | `#be123c` |
| `remplacable_avec_supervision` | `◑` | ambre | `#b45309` |
| `non_remplacable` | `○` | vert | `#047857` |
| `remplacable_avec_autre_technologie` | `⊕` | bleu | `#0369a1` |

Implémentation unique : `components/Badges.tsx` (`BadgeStatut`, `BadgeConfiance`, `BadgeSubstituabilite`,
`FONDS_SUBSTITUABILITE` pour les aplats SVG). **Ne pas redéclarer une table de couleurs ailleurs** — c'est
ce qui avait produit quatre variantes du même badge de confiance dans quatre fichiers.

---

## 6. Thème clair / sombre

- Bascule à trois états dans la barre de navigation : **Clair / Sombre / Système**
  (`components/BasculeTheme.tsx`), choix persisté dans `localStorage` sous la clé `atlas-theme`.
- Un script inline en tête de `<body>` (`app/layout.tsx`) pose la classe `.dark` **avant le premier rendu** :
  pas de flash de thème clair à l'ouverture d'une page en mode sombre.
- Le choix stocké n'est **jamais** lu pendant le rendu React (uniquement dans un `useEffect`) : le HTML
  serveur et le premier rendu client restent identiques, donc pas d'erreur d'hydratation.
- `color-scheme` suit le thème, pour que les contrôles natifs (menus déroulants, barres de défilement)
  s'accordent.

---

## 7. Accessibilité — règles non négociables

1. **Focus clavier toujours visible.** Règle globale de spécificité nulle dans `globals.css` ; un composant
   qui définit son propre anneau (`focus-visible:ring-…`) garde le sien.
2. **Tout ce qui se clique est un `<button>` ou un `<a>`** — jamais un `<div onClick>`. Vaut aussi dans les
   SVG : un `<g>` cliquable devient `<a>`/`<g role="button" tabIndex={0}>` avec gestion de `Entrée`/`Espace`.
3. **`aria-pressed`** sur les filtres à bascule, **`aria-current="page"`** sur le lien de navigation actif.
4. **Chaque visualisation** porte `role="img"` + `aria-label` décrivant ce qu'elle montre et ses effectifs,
   ou une structure sémantique (`<table>` + `<caption class="sr-only">`) — et un équivalent textuel navigable
   au clavier quand le dessin ne suffit pas (liste sous le graphe).
5. **Régions vivantes** (`aria-live="polite"`) sur les compteurs de résultats de filtre.
6. **Cible tactile** ≥ 32 px sur téléphone pour les boutons de matrice.

---

## 8. Responsive

- La page ne défile **jamais** horizontalement (`overflow-x: hidden` sur `body`).
- Toute visualisation large défile dans son propre conteneur : classe `.defilement-h` ou
  `overflow-x-auto`, avec `min-w-*` sur l'enfant pour garantir sa lisibilité.
- Les grilles passent en une colonne sous `sm` (640 px). Les tableaux gardent leur première colonne
  `sticky left-0` avec un fond opaque, sinon l'étiquette de ligne disparaît au défilement.

---

## 9. Ce que la charte interdit

- Ajouter une dépendance (police, bibliothèque d'icônes, bibliothèque de thème) : tout est en CSS et en
  glyphes Unicode.
- Encoder une information par la seule couleur.
- Utiliser une couleur vive comme fond de grande surface : les aplats saturés sont réservés aux badges, aux
  cellules de heatmap et aux nœuds du graphe.
- Écrire un chiffre du référentiel en dur dans une page : les compteurs sont calculés depuis `lib/corpus.ts`
  au build, sinon ils mentent dès la prochaine fiche ajoutée.

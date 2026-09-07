/**
 * Badges des trois taxonomies transverses du site — statut de fiche, niveau de
 * confiance, substituabilité d'une paire humain × IA.
 *
 * Règle de la charte (docs/design-system.md) : une taxonomie n'est JAMAIS
 * encodée par la seule couleur. Chaque badge porte un glyphe (lisible en
 * niveaux de gris, en vision daltonienne et en impression noir et blanc) ET
 * son libellé en toutes lettres. La couleur ne fait que renforcer.
 *
 * Composants sans état ni hook : utilisables tels quels dans un Server
 * Component (pages de fiche) comme dans un Client Component (comparateur,
 * cartographie).
 */

import type { NiveauConfiance, Statut, Substituabilite } from "@/lib/types";
import { LABELS_NIVEAU_CONFIANCE, LABELS_STATUT, LABELS_SUBSTITUABILITE } from "@/lib/corpus";

/* -------------------------------------------------------------------------- */
/* Socle commun                                                               */
/* -------------------------------------------------------------------------- */

/** Habillage partagé : contraste vérifié ≥ 4.5:1 dans les deux thèmes. */
const BASE = "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] leading-5 ring-1 ring-inset";

export type Ton = "neutre" | "vert" | "bleu" | "ambre" | "violet" | "rouge";

/** Couples fond / texte / anneau par ton, mode clair puis mode sombre. */
export const TONS: Record<Ton, string> = {
  neutre:
    "bg-neutral-100 text-neutral-700 ring-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-600",
  vert:
    "bg-emerald-50 text-emerald-800 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
  bleu:
    "bg-sky-50 text-sky-800 ring-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-800",
  ambre:
    "bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
  violet:
    "bg-violet-50 text-violet-800 ring-violet-300 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800",
  rouge:
    "bg-rose-50 text-rose-800 ring-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
};

function Badge({ ton, glyphe, texte, titre }: { ton: Ton; glyphe: string; texte: string; titre?: string }) {
  return (
    <span className={`${BASE} ${TONS[ton]}`} title={titre}>
      <span aria-hidden="true" className="font-mono tracking-tighter">
        {glyphe}
      </span>
      <span>{texte}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Statut d'une fiche (4 valeurs, nominal)                                 */
/* -------------------------------------------------------------------------- */

export const GLYPHES_STATUT: Record<Statut, string> = {
  a_documenter: "□", // case vide : rien n'a encore été écrit
  documente: "✓", // rédigé et sourcé
  verifie_recemment: "✓✓", // rédigé PUIS revérifié
  a_re_auditer: "↻", // à repasser : la fraîcheur n'est plus garantie
};

export const TONS_STATUT: Record<Statut, Ton> = {
  a_documenter: "neutre",
  documente: "vert",
  verifie_recemment: "bleu",
  a_re_auditer: "ambre",
};

export function BadgeStatut({ statut }: { statut: Statut | string }) {
  const cle = (statut in GLYPHES_STATUT ? statut : "a_documenter") as Statut;
  return (
    <Badge
      ton={TONS_STATUT[cle]}
      glyphe={GLYPHES_STATUT[cle]}
      texte={LABELS_STATUT[cle]}
      titre={`Statut de la fiche : ${LABELS_STATUT[cle]}`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Niveau de confiance (4 valeurs, ORDINAL)                                */
/* -------------------------------------------------------------------------- */

/* Le niveau de confiance est ordonné : le glyphe l'est aussi (jauge de points
   pleins), pour qu'un lecteur puisse ranger deux affirmations l'une par rapport
   à l'autre sans se souvenir du code couleur. */
export const GLYPHES_CONFIANCE: Record<NiveauConfiance, string> = {
  fait_verifie: "●●●●",
  consensus_scientifique: "●●●○",
  opinion_majoritaire: "●●○○",
  hypothese_prospective: "●○○○",
};

export const TONS_CONFIANCE: Record<NiveauConfiance, Ton> = {
  fait_verifie: "vert",
  consensus_scientifique: "bleu",
  opinion_majoritaire: "ambre",
  hypothese_prospective: "violet",
};

/** Classes de badge de confiance, pour les composants qui composent leur propre balise. */
export const CLASSES_CONFIANCE: Record<NiveauConfiance, string> = {
  fait_verifie: `${BASE} ${TONS.vert}`,
  consensus_scientifique: `${BASE} ${TONS.bleu}`,
  opinion_majoritaire: `${BASE} ${TONS.ambre}`,
  hypothese_prospective: `${BASE} ${TONS.violet}`,
};

export function BadgeConfiance({ niveau }: { niveau: NiveauConfiance | string }) {
  const cle = (niveau in GLYPHES_CONFIANCE ? niveau : "hypothese_prospective") as NiveauConfiance;
  return (
    <Badge
      ton={TONS_CONFIANCE[cle]}
      glyphe={GLYPHES_CONFIANCE[cle]}
      texte={LABELS_NIVEAU_CONFIANCE[cle]}
      titre={`Niveau de confiance : ${LABELS_NIVEAU_CONFIANCE[cle]} (échelle à 4 crans, du fait vérifié à l'hypothèse prospective)`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Substituabilité d'une paire humain × IA (4 valeurs)                     */
/* -------------------------------------------------------------------------- */

/* Le glyphe est un disque dont le remplissage figure la part que l'IA peut
   prendre : plein = tout, moitié = avec supervision, vide = rien.
   Le cas « avec une autre technologie » n'est pas sur ce continuum : il porte
   un symbole de combinaison. */
export const GLYPHES_SUBSTITUABILITE: Record<Substituabilite, string> = {
  remplacable_totalement: "●",
  remplacable_avec_supervision: "◑",
  non_remplacable: "○",
  remplacable_avec_autre_technologie: "⊕",
};

export const TONS_SUBSTITUABILITE: Record<Substituabilite, Ton> = {
  remplacable_totalement: "rouge",
  remplacable_avec_supervision: "ambre",
  non_remplacable: "vert",
  remplacable_avec_autre_technologie: "bleu",
};

/** Aplats utilisés par les visualisations SVG et la matrice de gap.
 *  Contraste vérifié ≥ 3:1 avec le fond de page dans les deux thèmes
 *  (seuil WCAG AA pour un élément graphique porteur d'information). */
export const FONDS_SUBSTITUABILITE: Record<Substituabilite, string> = {
  remplacable_totalement: "#be123c", // rose-700
  remplacable_avec_supervision: "#b45309", // amber-700
  non_remplacable: "#047857", // emerald-700
  remplacable_avec_autre_technologie: "#0369a1", // sky-700
};

export function BadgeSubstituabilite({ valeur }: { valeur: Substituabilite | string }) {
  const cle = (valeur in GLYPHES_SUBSTITUABILITE ? valeur : "non_remplacable") as Substituabilite;
  return (
    <Badge
      ton={TONS_SUBSTITUABILITE[cle]}
      glyphe={GLYPHES_SUBSTITUABILITE[cle]}
      texte={LABELS_SUBSTITUABILITE[cle]}
      titre={`Substituabilité : ${LABELS_SUBSTITUABILITE[cle]}`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Légendes réutilisables                                                     */
/* -------------------------------------------------------------------------- */

/** Rappel de l'échelle de confiance, à poser sous un bloc qui en affiche. */
export function LegendeConfiance() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
      <span className="font-medium">Échelle de confiance :</span>
      {(Object.keys(GLYPHES_CONFIANCE) as NiveauConfiance[]).map((n) => (
        <span key={n} className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="font-mono tracking-tighter">
            {GLYPHES_CONFIANCE[n]}
          </span>
          {LABELS_NIVEAU_CONFIANCE[n]}
        </span>
      ))}
    </p>
  );
}

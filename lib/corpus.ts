// Module de lecture unique du corpus (MP-6).
//
// Les JSON d'amorçage sont importés ICI et nulle part ailleurs dans les nouvelles routes :
// un module ES n'est évalué qu'une fois par processus, donc les ~400 pages statiques
// générées au build partagent la même instance de tableau et les mêmes index Map,
// au lieu de re-parser le corpus une fois par page.
//
// Ne jamais muter les tableaux exportés.

import fichesHumainesRaw from "@/data/seed/fiches_humaines";
import fichesIARaw from "@/data/seed/fiches_ia.json";
import fichesGapRaw from "@/data/seed/fiches_gap.json";
import type {
  AxeHumain,
  AxeIA,
  FicheGap,
  FicheHumaine,
  FicheIA,
  Diffusion,
  NiveauConfiance,
  SecteurUsage,
  Statut,
  Substituabilite,
} from "@/lib/types";

export const fichesHumaines = fichesHumainesRaw as unknown as FicheHumaine[];
export const fichesIA = fichesIARaw as unknown as FicheIA[];
export const fichesGap = fichesGapRaw as unknown as FicheGap[];

export type TypeFiche = "humaine" | "ia";

/* -------------------------------------------------------------------------- */
/* Libellés partagés                                                          */
/* -------------------------------------------------------------------------- */

export const AXES_HUMAINS: Record<AxeHumain, string> = {
  social: "Social",
  psychologique: "Psychologique",
  philosophique: "Philosophique",
  evolution: "Évolution",
  serenite: "Sérénité de l'espèce",
};

export const AXES_IA: Record<AxeIA, string> = {
  generatif_raisonnement: "Génératif / raisonnement",
  agentique: "Agentique",
  scientifique: "Scientifique",
  sectoriel: "Sectoriel",
  limites: "Limites",
  predictif_data_science: "Data science / modèles prédictifs",
};

export const LABELS_STATUT: Record<Statut, string> = {
  a_documenter: "à documenter",
  documente: "documenté",
  verifie_recemment: "vérifié récemment",
  a_re_auditer: "à ré-auditer",
};

export const LABELS_SUBSTITUABILITE: Record<Substituabilite, string> = {
  remplacable_totalement: "Remplaçable totalement",
  remplacable_avec_supervision: "Remplaçable avec supervision humaine",
  non_remplacable: "Non remplaçable à horizon prévisible",
  remplacable_avec_autre_technologie: "Remplaçable combinée à une autre technologie",
};

export const LABELS_SECTEUR: Record<SecteurUsage, string> = {
  science: "Science",
  education: "Éducation",
  recherche: "Recherche",
  industrie: "Industrie",
  pharmaceutique: "Pharmaceutique",
  gouvernement: "Gouvernement",
};

// Diffusion d'un usage IA — échelle textuelle, volontairement non chiffrée pour
// qu'elle ne puisse pas être confondue ni agrégée avec le TRL (cf. lib/types.ts).
export const LABELS_DIFFUSION: Record<Diffusion, string> = {
  emergent: "Diffusion émergente",
  etabli: "Diffusion établie",
  standard: "Diffusion standard",
  historique: "Diffusion historique",
};

export const LABELS_NIVEAU_CONFIANCE: Record<NiveauConfiance, string> = {
  fait_verifie: "Fait vérifié",
  consensus_scientifique: "Consensus scientifique",
  opinion_majoritaire: "Opinion majoritaire",
  hypothese_prospective: "Hypothèse prospective",
};

export const LABELS_CONFIANCE_GAP: Record<"elevee" | "moyenne" | "faible", string> = {
  elevee: "élevée",
  moyenne: "moyenne",
  faible: "faible",
};

export function libelleAxeHumain(axe: string): string {
  return AXES_HUMAINS[axe as AxeHumain] ?? axe.replace(/_/g, " ");
}

export function libelleAxeIA(axe: string): string {
  return AXES_IA[axe as AxeIA] ?? axe.replace(/_/g, " ");
}

export function libelleStatut(statut: string): string {
  return LABELS_STATUT[statut as Statut] ?? statut.replace(/_/g, " ");
}

export function libelleSousDomaine(sousDomaine: string | undefined): string {
  return (sousDomaine ?? "général").replace(/_/g, " ");
}

/* -------------------------------------------------------------------------- */
/* Chemins canoniques                                                         */
/* -------------------------------------------------------------------------- */

export const cheminFicheHumaine = (id: string): string => `/fiche/humaine/${id}`;
export const cheminFicheIA = (id: string): string => `/fiche/ia/${id}`;
export const cheminGap = (id: string): string => `/gap/${id}`;
export const cheminApiFiche = (id: string): string => `/api/fiches/${id}`;
export const cheminApiGap = (id: string): string => `/api/gap/${id}`;

/* -------------------------------------------------------------------------- */
/* Index (construits une seule fois)                                          */
/* -------------------------------------------------------------------------- */

const indexHumaines = new Map<string, FicheHumaine>(fichesHumaines.map((f) => [f.id, f]));
const indexIA = new Map<string, FicheIA>(fichesIA.map((f) => [f.id, f]));
const indexGap = new Map<string, FicheGap>(fichesGap.map((g) => [g.id, g]));

const gapsParHumaine = new Map<string, FicheGap[]>();
const gapsParIA = new Map<string, FicheGap[]>();
for (const gap of fichesGap) {
  const listeH = gapsParHumaine.get(gap.fiche_humaine_id);
  if (listeH) listeH.push(gap);
  else gapsParHumaine.set(gap.fiche_humaine_id, [gap]);

  const listeI = gapsParIA.get(gap.fiche_ia_id);
  if (listeI) listeI.push(gap);
  else gapsParIA.set(gap.fiche_ia_id, [gap]);
}

export function getFicheHumaine(id: string): FicheHumaine | undefined {
  return indexHumaines.get(id);
}

export function getFicheIA(id: string): FicheIA | undefined {
  return indexIA.get(id);
}

export function getFicheGap(id: string): FicheGap | undefined {
  return indexGap.get(id);
}

/** Retourne le type de fiche portant cet identifiant, ou undefined. */
export function typeDeFiche(id: string): TypeFiche | undefined {
  if (indexHumaines.has(id)) return "humaine";
  if (indexIA.has(id)) return "ia";
  return undefined;
}

/** Fiches de gap qui citent cette fiche humaine. */
export function gapsDeFicheHumaine(id: string): FicheGap[] {
  return gapsParHumaine.get(id) ?? [];
}

/** Fiches de gap qui citent cette fiche IA. */
export function gapsDeFicheIA(id: string): FicheGap[] {
  return gapsParIA.get(id) ?? [];
}

/* -------------------------------------------------------------------------- */
/* Fiches connexes                                                            */
/* -------------------------------------------------------------------------- */

const parNom = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, "fr");

/**
 * Fiches humaines connexes : d'abord le même sous-domaine, complété par le même axe
 * si le sous-domaine ne fournit pas assez d'entrées.
 */
export function connexesHumaines(fiche: FicheHumaine, max = 8): FicheHumaine[] {
  const memeSousDomaine = fichesHumaines
    .filter((f) => f.id !== fiche.id && f.sous_domaine && f.sous_domaine === fiche.sous_domaine)
    .sort(parNom);
  if (memeSousDomaine.length >= max) return memeSousDomaine.slice(0, max);

  const dejaPris = new Set(memeSousDomaine.map((f) => f.id));
  const memeAxe = fichesHumaines
    .filter((f) => f.id !== fiche.id && !dejaPris.has(f.id) && f.axe === fiche.axe)
    .sort(parNom);
  return [...memeSousDomaine, ...memeAxe].slice(0, max);
}

/** Fiches IA connexes : même axe. */
export function connexesIA(fiche: FicheIA, max = 8): FicheIA[] {
  return fichesIA.filter((f) => f.id !== fiche.id && f.axe === fiche.axe).sort(parNom).slice(0, max);
}

/* -------------------------------------------------------------------------- */
/* Recherche plein texte simple (sans dépendance)                             */
/* -------------------------------------------------------------------------- */

/** Minuscule + suppression des diacritiques, pour une recherche tolérante aux accents. */
export function normaliserTexte(valeur: string): string {
  return valeur
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function texteIndexeHumaine(f: FicheHumaine): string {
  return normaliserTexte(
    [f.nom, f.axe, f.sous_domaine ?? "", f.these_centrale, f.apport, f.limites_critiques, f.resonance_ia ?? ""].join(" ")
  );
}

export function texteIndexeIA(f: FicheIA): string {
  return normaliserTexte(
    [f.nom, f.axe, f.editeur ?? "", f.architecture ?? "", f.limites_connues, ...f.capacites_cles].join(" ")
  );
}

export function texteIndexeGap(g: FicheGap): string {
  const humaine = indexHumaines.get(g.fiche_humaine_id);
  const ia = indexIA.get(g.fiche_ia_id);
  return normaliserTexte(
    [
      g.id,
      humaine?.nom ?? g.fiche_humaine_id,
      ia?.nom ?? g.fiche_ia_id,
      g.sujet ?? "",
      g.apport_ia,
      g.mecanisme,
      g.amelioration_possible,
      g.mode_interaction,
      g.scenario_present,
      g.scenario_5ans,
      g.scenario_15_20ans,
      ...(g.sous_themes ?? []),
      ...(g.axes_recherche ?? []),
    ].join(" ")
  );
}

/* -------------------------------------------------------------------------- */
/* Descriptions SEO                                                           */
/* -------------------------------------------------------------------------- */

/** Tronque proprement sur une frontière de mot (pour les meta description ~155 signes). */
export function tronquer(texte: string, longueurMax = 155): string {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= longueurMax) return propre;
  const coupe = propre.slice(0, longueurMax);
  const dernierEspace = coupe.lastIndexOf(" ");
  return `${(dernierEspace > 60 ? coupe.slice(0, dernierEspace) : coupe).replace(/[\s,;:.–—-]+$/, "")}…`;
}

export function descriptionFicheHumaine(f: FicheHumaine): string {
  return tronquer(`${f.nom} — ${f.these_centrale}`);
}

export function descriptionFicheIA(f: FicheIA): string {
  const capacites = f.capacites_cles.join(" · ");
  const base = capacites.length > 0 ? capacites : f.limites_connues;
  return tronquer(`${f.nom}${f.editeur ? ` (${f.editeur})` : ""} — ${base}`);
}

export function descriptionGap(g: FicheGap): string {
  const humaine = indexHumaines.get(g.fiche_humaine_id);
  const ia = indexIA.get(g.fiche_ia_id);
  return tronquer(`${humaine?.nom ?? g.fiche_humaine_id} × ${ia?.nom ?? g.fiche_ia_id} — ${g.apport_ia}`);
}

export function titreGap(g: FicheGap): string {
  const humaine = indexHumaines.get(g.fiche_humaine_id);
  const ia = indexIA.get(g.fiche_ia_id);
  return `${humaine?.nom ?? g.fiche_humaine_id} × ${ia?.nom ?? g.fiche_ia_id}`;
}

/* -------------------------------------------------------------------------- */
/* Divers                                                                     */
/* -------------------------------------------------------------------------- */

/** Date de vérification la plus récente du corpus (ISO), utile pour sitemap/API. */
export const derniereMiseAJourCorpus: string = [
  ...fichesHumaines.map((f) => f.derniere_verification),
  ...fichesIA.map((f) => f.derniere_verification),
  ...fichesGap.map((g) => g.derniere_verification),
]
  .filter(Boolean)
  .sort()
  .at(-1) ?? "2026-09-06";

/** Formatage FR déterministe (pas de dépendance à l'ICU du runtime). */
export function formatDateFr(iso: string): string {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!correspondance) return iso;
  return `${correspondance[3]}/${correspondance[2]}/${correspondance[1]}`;
}

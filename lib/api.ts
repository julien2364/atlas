// Contrat de l'API publique en lecture (MP-6) — voir docs/api.md.
//
// Toutes les réponses partagent une enveloppe stable :
//   succès collection : { api_version, corpus_maj, filtres, pagination, donnees: [...] }
//   succès ressource  : { api_version, corpus_maj, donnees: {...} }
//   erreur            : { api_version, erreur: { code, message, ... } }
//
// Les sérialiseurs ci-dessous sont la SEULE source de vérité de la forme publique :
// ajouter un champ est rétrocompatible, en retirer ou en renommer un impose de
// changer API_VERSION.

import { NextResponse } from "next/server";
import type { FicheGap, FicheHumaine, FicheIA, Source, UsageSectoriel } from "@/lib/types";
import { urlAbsolue } from "@/lib/site-config";
import {
  cheminApiFiche,
  cheminApiGap,
  cheminFicheHumaine,
  cheminFicheIA,
  cheminGap,
  derniereMiseAJourCorpus,
  gapsDeFicheHumaine,
  gapsDeFicheIA,
  getFicheHumaine,
  getFicheIA,
  libelleAxeHumain,
  libelleAxeIA,
  libelleSousDomaine,
  libelleStatut,
  LABELS_CONFIANCE_GAP,
  LABELS_SECTEUR,
  LABELS_SUBSTITUABILITE,
  titreGap,
} from "@/lib/corpus";

export const API_VERSION = "1";

/** Collections : filtrables, donc rendues à la demande puis mises en cache par le CDN. */
export const CACHE_COLLECTION = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400";

/** Ressources unitaires : pré-générées au build, contenu très stable. */
export const CACHE_RESSOURCE = "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800";

function entetes(cache: string): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cache,
    // Lecture seule et publique : consommable depuis un autre projet, navigateur compris.
    "Access-Control-Allow-Origin": "*",
    "X-Atlas-Api-Version": API_VERSION,
  };
}

/* -------------------------------------------------------------------------- */
/* Enveloppes                                                                 */
/* -------------------------------------------------------------------------- */

export interface Pagination {
  page: number;
  par_page: number;
  total: number;
  total_pages: number;
}

export function paginer<T>(elements: T[], page: number, parPage: number): { tranche: T[]; pagination: Pagination } {
  const total = elements.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / parPage);
  const debut = (page - 1) * parPage;
  return {
    tranche: elements.slice(debut, debut + parPage),
    pagination: { page, par_page: parPage, total, total_pages: totalPages },
  };
}

export function reponseCollection(
  donnees: unknown[],
  pagination: Pagination,
  filtres: Record<string, string | number | null>
): NextResponse {
  return NextResponse.json(
    { api_version: API_VERSION, corpus_maj: derniereMiseAJourCorpus, filtres, pagination, donnees },
    { status: 200, headers: entetes(CACHE_COLLECTION) }
  );
}

export function reponseRessource(donnees: unknown): NextResponse {
  return NextResponse.json(
    { api_version: API_VERSION, corpus_maj: derniereMiseAJourCorpus, donnees },
    { status: 200, headers: entetes(CACHE_RESSOURCE) }
  );
}

export function reponseErreur(
  code: "ressource_introuvable" | "parametre_invalide",
  message: string,
  statut: 400 | 404,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { api_version: API_VERSION, erreur: { code, message, ...(details ?? {}) } },
    {
      status: statut,
      headers: entetes(
        // Une 404 reste cachable : un identifiant inexistant le restera jusqu'au prochain build.
        statut === 404 ? "public, max-age=60, s-maxage=3600" : "no-store"
      ),
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Sérialiseurs                                                               */
/* -------------------------------------------------------------------------- */

export interface SourceAPI {
  titre: string;
  url: string | null;
  date: string | null;
  type: "primaire" | "secondaire";
}

export interface LienAPI {
  id: string;
  type: "humaine" | "ia" | "gap";
  nom: string;
  url: string;
  api_url: string;
}

export interface FicheHumaineAPI {
  id: string;
  type: "humaine";
  nom: string;
  axe: string;
  axe_libelle: string;
  sous_domaine: string | null;
  sous_domaine_libelle: string;
  periode_courant: string | null;
  these_centrale: string;
  apport: string;
  limites_critiques: string;
  resonance_ia: string | null;
  sources: SourceAPI[];
  statut: string;
  statut_libelle: string;
  derniere_verification: string;
  url: string;
  api_url: string;
  gaps: LienAPI[];
}

export interface UsageAPI {
  secteur: string;
  secteur_libelle: string;
  description: string;
  trl: number;
  exemples: string[];
  sources: SourceAPI[];
}

export interface FicheIAAPI {
  id: string;
  type: "ia";
  nom: string;
  axe: string;
  axe_libelle: string;
  editeur: string | null;
  architecture: string | null;
  capacites_cles: string[];
  usages: UsageAPI[];
  limites_connues: string;
  sources: SourceAPI[];
  statut: string;
  statut_libelle: string;
  derniere_verification: string;
  url: string;
  api_url: string;
  gaps: LienAPI[];
}

export interface AxeProspectifAPI {
  nom: string;
  description: string;
  niveau_confiance: string;
}

export interface FicheGapAPI {
  id: string;
  type: "gap";
  titre: string;
  fiche_humaine: LienAPI | null;
  fiche_ia: LienAPI | null;
  fiche_humaine_id: string;
  fiche_ia_id: string;
  sujet: string | null;
  sous_themes: string[];
  axes_recherche: string[];
  apport_ia: string;
  mecanisme: string;
  amelioration_possible: string;
  mode_interaction: string;
  substituabilite: string;
  substituabilite_libelle: string;
  technologie_complementaire: string | null;
  scenario_present: string;
  scenario_5ans: string;
  scenario_15_20ans: string;
  axes_prospectifs: AxeProspectifAPI[];
  documents_cles: SourceAPI[];
  confiance: string;
  confiance_libelle: string;
  statut: string;
  statut_libelle: string;
  derniere_verification: string;
  url: string;
  api_url: string;
}

export function serialiserSource(source: Source): SourceAPI {
  return {
    titre: source.titre,
    url: source.url ?? null,
    date: source.date ?? null,
    type: source.type,
  };
}

function serialiserUsage(usage: UsageSectoriel): UsageAPI {
  return {
    secteur: usage.secteur,
    secteur_libelle: LABELS_SECTEUR[usage.secteur] ?? usage.secteur,
    description: usage.description,
    trl: usage.trl,
    exemples: usage.exemples ?? [],
    sources: (usage.sources ?? []).map(serialiserSource),
  };
}

export function lienGap(gap: FicheGap): LienAPI {
  return {
    id: gap.id,
    type: "gap",
    nom: titreGap(gap),
    url: urlAbsolue(cheminGap(gap.id)),
    api_url: urlAbsolue(cheminApiGap(gap.id)),
  };
}

export function lienFicheHumaine(id: string): LienAPI | null {
  const fiche = getFicheHumaine(id);
  if (!fiche) return null;
  return {
    id: fiche.id,
    type: "humaine",
    nom: fiche.nom,
    url: urlAbsolue(cheminFicheHumaine(fiche.id)),
    api_url: urlAbsolue(cheminApiFiche(fiche.id)),
  };
}

export function lienFicheIA(id: string): LienAPI | null {
  const fiche = getFicheIA(id);
  if (!fiche) return null;
  return {
    id: fiche.id,
    type: "ia",
    nom: fiche.nom,
    url: urlAbsolue(cheminFicheIA(fiche.id)),
    api_url: urlAbsolue(cheminApiFiche(fiche.id)),
  };
}

export function serialiserFicheHumaine(fiche: FicheHumaine): FicheHumaineAPI {
  return {
    id: fiche.id,
    type: "humaine",
    nom: fiche.nom,
    axe: fiche.axe,
    axe_libelle: libelleAxeHumain(fiche.axe),
    sous_domaine: fiche.sous_domaine ?? null,
    sous_domaine_libelle: libelleSousDomaine(fiche.sous_domaine),
    periode_courant: fiche.periode_courant ?? null,
    these_centrale: fiche.these_centrale,
    apport: fiche.apport,
    limites_critiques: fiche.limites_critiques,
    resonance_ia: fiche.resonance_ia ?? null,
    sources: (fiche.sources ?? []).map(serialiserSource),
    statut: fiche.statut,
    statut_libelle: libelleStatut(fiche.statut),
    derniere_verification: fiche.derniere_verification,
    url: urlAbsolue(cheminFicheHumaine(fiche.id)),
    api_url: urlAbsolue(cheminApiFiche(fiche.id)),
    gaps: gapsDeFicheHumaine(fiche.id).map(lienGap),
  };
}

export function serialiserFicheIA(fiche: FicheIA): FicheIAAPI {
  return {
    id: fiche.id,
    type: "ia",
    nom: fiche.nom,
    axe: fiche.axe,
    axe_libelle: libelleAxeIA(fiche.axe),
    editeur: fiche.editeur ?? null,
    architecture: fiche.architecture ?? null,
    capacites_cles: fiche.capacites_cles ?? [],
    usages: (fiche.usages ?? []).map(serialiserUsage),
    limites_connues: fiche.limites_connues,
    sources: (fiche.sources ?? []).map(serialiserSource),
    statut: fiche.statut,
    statut_libelle: libelleStatut(fiche.statut),
    derniere_verification: fiche.derniere_verification,
    url: urlAbsolue(cheminFicheIA(fiche.id)),
    api_url: urlAbsolue(cheminApiFiche(fiche.id)),
    gaps: gapsDeFicheIA(fiche.id).map(lienGap),
  };
}

export function serialiserFicheGap(gap: FicheGap): FicheGapAPI {
  return {
    id: gap.id,
    type: "gap",
    titre: titreGap(gap),
    fiche_humaine: lienFicheHumaine(gap.fiche_humaine_id),
    fiche_ia: lienFicheIA(gap.fiche_ia_id),
    fiche_humaine_id: gap.fiche_humaine_id,
    fiche_ia_id: gap.fiche_ia_id,
    sujet: gap.sujet ?? null,
    sous_themes: gap.sous_themes ?? [],
    axes_recherche: gap.axes_recherche ?? [],
    apport_ia: gap.apport_ia,
    mecanisme: gap.mecanisme,
    amelioration_possible: gap.amelioration_possible,
    mode_interaction: gap.mode_interaction,
    substituabilite: gap.substituabilite,
    substituabilite_libelle: LABELS_SUBSTITUABILITE[gap.substituabilite] ?? gap.substituabilite,
    technologie_complementaire: gap.technologie_complementaire ?? null,
    scenario_present: gap.scenario_present,
    scenario_5ans: gap.scenario_5ans,
    scenario_15_20ans: gap.scenario_15_20ans,
    axes_prospectifs: (gap.axes_prospectifs ?? []).map((axe) => ({
      nom: axe.nom,
      description: axe.description,
      niveau_confiance: axe.niveau_confiance,
    })),
    documents_cles: (gap.documents_cles ?? []).map(serialiserSource),
    confiance: gap.confiance,
    confiance_libelle: LABELS_CONFIANCE_GAP[gap.confiance] ?? gap.confiance,
    statut: gap.statut,
    statut_libelle: libelleStatut(gap.statut),
    derniere_verification: gap.derniere_verification,
    url: urlAbsolue(cheminGap(gap.id)),
    api_url: urlAbsolue(cheminApiGap(gap.id)),
  };
}

/* -------------------------------------------------------------------------- */
/* Lecture des paramètres de requête                                          */
/* -------------------------------------------------------------------------- */

/** Lit un entier borné ; empile un message dans `erreurs` si la valeur est invalide. */
export function lireEntier(
  parametres: URLSearchParams,
  nom: string,
  defaut: number,
  min: number,
  max: number,
  erreurs: string[]
): number {
  const brut = parametres.get(nom);
  if (brut === null || brut === "") return defaut;
  const valeur = Number(brut);
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) {
    erreurs.push(`Paramètre "${nom}" invalide : attendu un entier entre ${min} et ${max}, reçu "${brut}".`);
    return defaut;
  }
  return valeur;
}

/** Lit une valeur contrainte à une énumération ; empile un message si hors liste. */
export function lireEnum(
  parametres: URLSearchParams,
  nom: string,
  autorisees: readonly string[],
  erreurs: string[]
): string | null {
  const brut = parametres.get(nom);
  if (brut === null || brut === "") return null;
  if (!autorisees.includes(brut)) {
    erreurs.push(`Paramètre "${nom}" invalide : "${brut}". Valeurs acceptées : ${autorisees.join(", ")}.`);
    return null;
  }
  return brut;
}

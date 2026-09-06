// GET /api/meta — dictionnaire du corpus : volumétrie, valeurs autorisées des filtres,
// libellés lisibles. Point d'entrée conseillé pour un client tiers qui découvre l'API.

import type { NextResponse } from "next/server";
import {
  AXES_HUMAINS,
  AXES_IA,
  fichesGap,
  fichesHumaines,
  fichesIA,
  LABELS_CONFIANCE_GAP,
  LABELS_SECTEUR,
  LABELS_STATUT,
  LABELS_SUBSTITUABILITE,
  libelleSousDomaine,
} from "@/lib/corpus";
import { API_VERSION, reponseRessource } from "@/lib/api";
import { urlAbsolue } from "@/lib/site-config";

export const dynamic = "force-static";

function compter(valeurs: string[]): Record<string, number> {
  const compteur: Record<string, number> = {};
  for (const valeur of valeurs) compteur[valeur] = (compteur[valeur] ?? 0) + 1;
  return compteur;
}

function enumeration(libelles: Record<string, string>, valeurs: string[]) {
  const compteur = compter(valeurs);
  return Object.entries(libelles).map(([code, libelle]) => ({ code, libelle, total: compteur[code] ?? 0 }));
}

export async function GET(): Promise<NextResponse> {
  const sousDomaines = compter(fichesHumaines.map((fiche) => fiche.sous_domaine ?? "general"));

  return reponseRessource({
    api_version: API_VERSION,
    totaux: {
      fiches_humaines: fichesHumaines.length,
      fiches_ia: fichesIA.length,
      fiches_gap: fichesGap.length,
    },
    axes_humains: enumeration(
      AXES_HUMAINS,
      fichesHumaines.map((fiche) => fiche.axe)
    ),
    axes_ia: enumeration(
      AXES_IA,
      fichesIA.map((fiche) => fiche.axe)
    ),
    sous_domaines: Object.entries(sousDomaines)
      .map(([code, total]) => ({ code, libelle: libelleSousDomaine(code), total }))
      .sort((a, b) => b.total - a.total),
    statuts: enumeration(LABELS_STATUT, [
      ...fichesHumaines.map((fiche) => fiche.statut),
      ...fichesIA.map((fiche) => fiche.statut),
      ...fichesGap.map((gap) => gap.statut),
    ]),
    substituabilites: enumeration(
      LABELS_SUBSTITUABILITE,
      fichesGap.map((gap) => gap.substituabilite)
    ),
    confiances_gap: enumeration(
      LABELS_CONFIANCE_GAP,
      fichesGap.map((gap) => gap.confiance)
    ),
    secteurs: enumeration(
      LABELS_SECTEUR,
      fichesIA.flatMap((fiche) => (fiche.usages ?? []).map((usage) => usage.secteur))
    ),
    endpoints: [
      { methode: "GET", chemin: "/api/fiches", description: "Collection des fiches humaines et IA (filtrable, paginée)." },
      { methode: "GET", chemin: "/api/fiches/{id}", description: "Une fiche humaine ou IA." },
      { methode: "GET", chemin: "/api/gap", description: "Collection des analyses de gap (filtrable, paginée)." },
      { methode: "GET", chemin: "/api/gap/{id}", description: "Une analyse de gap." },
      { methode: "GET", chemin: "/api/meta", description: "Ce dictionnaire." },
    ],
    documentation: urlAbsolue("/methodologie"),
  });
}

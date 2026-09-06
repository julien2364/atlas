// GET /api/gap — collection filtrable et paginée des fiches de gap analysis.
// Documentation complète : docs/api.md

import type { NextResponse } from "next/server";
import {
  fichesGap,
  LABELS_CONFIANCE_GAP,
  LABELS_STATUT,
  LABELS_SUBSTITUABILITE,
  normaliserTexte,
  texteIndexeGap,
  titreGap,
} from "@/lib/corpus";
import { lireEntier, lireEnum, paginer, reponseCollection, reponseErreur, serialiserFicheGap } from "@/lib/api";

export const dynamic = "force-dynamic";

const SUBSTITUABILITES = Object.keys(LABELS_SUBSTITUABILITE);
const CONFIANCES = Object.keys(LABELS_CONFIANCE_GAP);
const STATUTS = Object.keys(LABELS_STATUT);

// Ordre stable : tri alphabétique sur le titre « fiche humaine × fiche IA ».
const GAPS_TRIES = [...fichesGap].sort((a, b) => titreGap(a).localeCompare(titreGap(b), "fr"));

const INDEX_TEXTE = new Map<string, string>(GAPS_TRIES.map((gap) => [gap.id, texteIndexeGap(gap)]));

export async function GET(request: Request): Promise<NextResponse> {
  const parametres = new URL(request.url).searchParams;
  const erreurs: string[] = [];

  const substituabilite = lireEnum(parametres, "substituabilite", SUBSTITUABILITES, erreurs);
  const confiance = lireEnum(parametres, "confiance", CONFIANCES, erreurs);
  const statut = lireEnum(parametres, "statut", STATUTS, erreurs);
  const ficheHumaine = (parametres.get("fiche_humaine") ?? "").trim() || null;
  const ficheIA = (parametres.get("fiche_ia") ?? "").trim() || null;
  const recherche = (parametres.get("q") ?? "").trim();
  const page = lireEntier(parametres, "page", 1, 1, 10_000, erreurs);
  const parPage = lireEntier(parametres, "par_page", 20, 1, 100, erreurs);

  if (erreurs.length > 0) {
    return reponseErreur("parametre_invalide", erreurs.join(" "), 400);
  }

  const termes = recherche.length > 0 ? normaliserTexte(recherche).split(/\s+/).filter(Boolean) : [];

  const filtres = GAPS_TRIES.filter((gap) => {
    if (substituabilite && gap.substituabilite !== substituabilite) return false;
    if (confiance && gap.confiance !== confiance) return false;
    if (statut && gap.statut !== statut) return false;
    if (ficheHumaine && gap.fiche_humaine_id !== ficheHumaine) return false;
    if (ficheIA && gap.fiche_ia_id !== ficheIA) return false;
    if (termes.length > 0) {
      const texte = INDEX_TEXTE.get(gap.id) ?? "";
      if (!termes.every((terme) => texte.includes(terme))) return false;
    }
    return true;
  });

  const { tranche, pagination } = paginer(filtres, page, parPage);

  return reponseCollection(tranche.map(serialiserFicheGap), pagination, {
    substituabilite,
    confiance,
    statut,
    fiche_humaine: ficheHumaine,
    fiche_ia: ficheIA,
    q: recherche.length > 0 ? recherche : null,
  });
}

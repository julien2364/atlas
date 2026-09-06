// GET /api/fiches — collection filtrable et paginée des fiches humaines et IA.
// Documentation complète : docs/api.md
//
// Route handler dynamique : la réponse dépend de la query string, donc elle ne peut pas
// être figée au build. La mise en cache est déléguée au CDN via l'en-tête Cache-Control
// (s-maxage=3600, stale-while-revalidate=86400) : une requête identique n'atteint la
// fonction qu'une fois par heure.

import type { NextResponse } from "next/server";
import type { FicheHumaine, FicheIA } from "@/lib/types";
import {
  AXES_HUMAINS,
  AXES_IA,
  fichesHumaines,
  fichesIA,
  LABELS_STATUT,
  normaliserTexte,
  texteIndexeHumaine,
  texteIndexeIA,
} from "@/lib/corpus";
import {
  lireEntier,
  lireEnum,
  paginer,
  reponseCollection,
  reponseErreur,
  serialiserFicheHumaine,
  serialiserFicheIA,
} from "@/lib/api";

export const dynamic = "force-dynamic";

const TYPES = ["humaine", "ia"] as const;
const AXES = [...Object.keys(AXES_HUMAINS), ...Object.keys(AXES_IA)];
const STATUTS = Object.keys(LABELS_STATUT);

type Entree = { type: "humaine"; fiche: FicheHumaine } | { type: "ia"; fiche: FicheIA };

// Ordre stable et déterministe : fiches humaines puis fiches IA, chaque bloc trié par nom.
// Indispensable pour que la pagination soit reproductible d'une requête à l'autre.
const ENTREES: Entree[] = [
  ...[...fichesHumaines]
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map((fiche): Entree => ({ type: "humaine", fiche })),
  ...[...fichesIA]
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map((fiche): Entree => ({ type: "ia", fiche })),
];

// Index plein texte construit une seule fois au chargement du module.
const INDEX_TEXTE = new Map<string, string>();
for (const entree of ENTREES) {
  INDEX_TEXTE.set(
    `${entree.type}:${entree.fiche.id}`,
    entree.type === "humaine" ? texteIndexeHumaine(entree.fiche) : texteIndexeIA(entree.fiche)
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  const parametres = new URL(request.url).searchParams;
  const erreurs: string[] = [];

  const type = lireEnum(parametres, "type", TYPES, erreurs);
  const axe = lireEnum(parametres, "axe", AXES, erreurs);
  const statut = lireEnum(parametres, "statut", STATUTS, erreurs);
  const sousDomaine = (parametres.get("sous_domaine") ?? "").trim() || null;
  const recherche = (parametres.get("q") ?? "").trim();
  const page = lireEntier(parametres, "page", 1, 1, 10_000, erreurs);
  const parPage = lireEntier(parametres, "par_page", 20, 1, 100, erreurs);

  if (erreurs.length > 0) {
    return reponseErreur("parametre_invalide", erreurs.join(" "), 400);
  }

  const termes = recherche.length > 0 ? normaliserTexte(recherche).split(/\s+/).filter(Boolean) : [];

  const filtrees = ENTREES.filter((entree) => {
    if (type && entree.type !== type) return false;
    if (axe && entree.fiche.axe !== axe) return false;
    if (statut && entree.fiche.statut !== statut) return false;
    if (sousDomaine) {
      if (entree.type !== "humaine") return false;
      if (entree.fiche.sous_domaine !== sousDomaine) return false;
    }
    if (termes.length > 0) {
      const texte = INDEX_TEXTE.get(`${entree.type}:${entree.fiche.id}`) ?? "";
      if (!termes.every((terme) => texte.includes(terme))) return false;
    }
    return true;
  });

  const { tranche, pagination } = paginer(filtrees, page, parPage);
  const donnees = tranche.map((entree) =>
    entree.type === "humaine" ? serialiserFicheHumaine(entree.fiche) : serialiserFicheIA(entree.fiche)
  );

  return reponseCollection(donnees, pagination, {
    type,
    axe,
    statut,
    sous_domaine: sousDomaine,
    q: recherche.length > 0 ? recherche : null,
  });
}

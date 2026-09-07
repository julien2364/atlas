// Résolution des fiches et de leurs SOURCES RÉELLES.
//
// Point de passage unique et volontairement étroit : c'est ici, et nulle part
// ailleurs, qu'une référence bibliographique est produite. Aucune source
// affichée par le moteur ne vient d'un modèle de langage — elles sont toutes
// lues dans `data/seed/` à partir d'un identifiant de fiche. Conséquence : un
// modèle peut au pire citer une fiche du corpus qui existe ; il ne peut pas
// inventer une référence.
//
// Ce module est partagé par `lib/rag.ts` (validation de la sortie d'un modèle)
// et `lib/reponse-extractive.ts` (mode sans modèle). Le mettre à part évite un
// cycle d'imports entre les deux, et évite surtout d'en écrire deux versions.

import {
  cheminFicheHumaine,
  cheminFicheIA,
  cheminGap,
  getFicheGap,
  getFicheHumaine,
  getFicheIA,
} from "@/lib/corpus";
import type { NiveauConfiance, Source, Statut } from "@/lib/types";

export type TypeFicheRag = "humaine" | "ia" | "gap";

/** Nom lisible + URL publique d'une fiche, ou null si l'identifiant n'existe plus. */
export function resoudreFiche(type: TypeFicheRag, id: string): { nom: string; url: string } | null {
  if (type === "humaine") {
    const fiche = getFicheHumaine(id);
    return fiche ? { nom: fiche.nom, url: cheminFicheHumaine(fiche.id) } : null;
  }
  if (type === "ia") {
    const fiche = getFicheIA(id);
    return fiche ? { nom: fiche.nom, url: cheminFicheIA(fiche.id) } : null;
  }
  const gap = getFicheGap(id);
  if (!gap) return null;
  const humaine = getFicheHumaine(gap.fiche_humaine_id);
  const ia = getFicheIA(gap.fiche_ia_id);
  return {
    nom: `${humaine?.nom ?? gap.fiche_humaine_id} × ${ia?.nom ?? gap.fiche_ia_id}`,
    url: cheminGap(gap.id),
  };
}

/**
 * Sources RÉELLES d'une fiche, lues dans le corpus — jamais générées.
 *
 * Pour une fiche de gap, on remonte ses documents clés puis, à défaut, les
 * sources des deux fiches qu'elle croise : une fiche de gap n'a pas toujours de
 * bibliographie propre, mais elle en hérite toujours une.
 */
export function sourcesDeFiche(type: TypeFicheRag, id: string): Source[] {
  if (type === "humaine") return getFicheHumaine(id)?.sources ?? [];
  if (type === "ia") return getFicheIA(id)?.sources ?? [];
  const gap = getFicheGap(id);
  if (!gap) return [];
  const documents = gap.documents_cles ?? [];
  if (documents.length > 0) return documents;
  return [
    ...(getFicheHumaine(gap.fiche_humaine_id)?.sources ?? []),
    ...(getFicheIA(gap.fiche_ia_id)?.sources ?? []),
  ];
}

/** Déduplique des sources sur (titre, url) en gardant l'ordre d'apparition. */
export function dedupliquerSources(sources: Source[]): Source[] {
  const vues = new Set<string>();
  const resultat: Source[] = [];
  for (const source of sources) {
    if (!source || typeof source.titre !== "string") continue;
    const cle = `${source.titre}|${source.url ?? ""}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    resultat.push(source);
  }
  return resultat;
}

/**
 * Niveau de confiance déduit du STATUT DOCUMENTAIRE de la fiche.
 *
 * À lire pour ce qu'il est : il dit à quel point la fiche a été relue et
 * vérifiée dans ce référentiel, pas à quel point la thèse qu'elle expose est
 * vraie. `fait_verifie` n'est jamais produit ici — il est réservé à une donnée
 * mesurée, et l'assemblage mécanique de champs n'en produit pas.
 */
export function niveauDepuisStatut(statut: Statut | string | undefined): NiveauConfiance {
  switch (statut) {
    case "verifie_recemment":
      return "consensus_scientifique";
    case "documente":
    case "a_re_auditer":
      return "opinion_majoritaire";
    default:
      return "hypothese_prospective";
  }
}

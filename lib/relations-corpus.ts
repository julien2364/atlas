// Graphe de relations entre fiches — la matière du croisement RAISONNÉ.
//
// `data/relations-corpus.json` est produit hors ligne par
// `scripts/tisser-relations.mjs`, versionné au dépôt, et vérifié par
// `npm run verifier` (le graphe doit correspondre au corpus). Ce module ne fait
// que le lire et l'indexer pour interrogation immédiate.
//
// Ce qu'une relation est, et ce qu'elle n'est pas
// ----------------------------------------------
// Chaque relation est adossée à une PREUVE : une phrase du corpus qui la porte.
// Une fiche « conteste » une autre parce que son champ « limites critiques » la
// nomme, pas parce qu'un calcul de distance les a rapprochées. C'est toute la
// différence avec la recherche lexicale : celle-ci dit « ces deux textes
// emploient les mêmes mots », le graphe dit « cette fiche-ci s'oppose à
// celle-là, et voici où c'est écrit ».
//
// Le graphe ne dit pas qui a raison. Il dit qu'il y a débat, et où le lire.

import graphe from "@/data/relations-corpus.json";
import { getFicheGap, getFicheHumaine, getFicheIA, fichesHumaines } from "@/lib/corpus";
import type { TypeFicheRag } from "@/lib/sources-corpus";

export type TypeRelation =
  | "conteste"
  | "mention"
  | "mobilise"
  | "source_commune"
  | "succession"
  | "resonance"
  | "couple";

export interface ExtremiteRelation {
  type: TypeFicheRag;
  id: string;
}

export interface Relation {
  type: TypeRelation;
  de: ExtremiteRelation;
  vers: ExtremiteRelation;
  champ: string;
  designation: string;
  preuve: string;
}

interface GrapheRelations {
  modele: string;
  empreinte_corpus: string;
  genere_le: string;
  nb_fiches: number;
  compte_par_type: Record<string, number>;
  relations: Relation[];
}

const GRAPHE = graphe as unknown as GrapheRelations;

export function cleFiche(type: string, id: string): string {
  return `${type}:${id}`;
}

/**
 * Rôle qu'une fiche joue dans une réponse, par rapport à la fiche pivot.
 * L'ordre de cette liste est l'ordre de PRIORITÉ : une contradiction documentée
 * vaut mieux qu'un appui, qui vaut mieux qu'un simple voisinage de vocabulaire.
 */
export type RoleCroisement =
  | "pivot"
  | "contradiction"
  | "autre_discipline"
  | "appui"
  | "mention_limites"
  | "antecedent"
  | "posterite"
  | "meme_preuve"
  | "couple_ia"
  | "voisinage_lexical";

export interface Voisin {
  cible: ExtremiteRelation;
  role: RoleCroisement;
  /** Preuve textuelle, recopiée du corpus. Vide pour `autre_discipline`, qui se déduit des métadonnées. */
  preuve: string;
  /** Phrase prête à l'emploi, décrivant la relation en clair. */
  enonce: string;
}

/* -------------------------------------------------------------------------- */
/* Index                                                                      */
/* -------------------------------------------------------------------------- */

/** Relations indexées par extrémité, dans les deux sens. */
const PAR_FICHE = new Map<string, { relation: Relation; sortante: boolean }[]>();

for (const relation of GRAPHE.relations) {
  const de = cleFiche(relation.de.type, relation.de.id);
  const vers = cleFiche(relation.vers.type, relation.vers.id);
  if (!PAR_FICHE.has(de)) PAR_FICHE.set(de, []);
  if (!PAR_FICHE.has(vers)) PAR_FICHE.set(vers, []);
  PAR_FICHE.get(de)!.push({ relation, sortante: true });
  PAR_FICHE.get(vers)!.push({ relation, sortante: false });
}

/** Fiches humaines groupées par sous-domaine — sert à « même objet, autre discipline ». */
const PAR_SOUS_DOMAINE = new Map<string, { id: string; axe: string }[]>();
for (const fiche of fichesHumaines) {
  const cle = String(fiche.sous_domaine ?? "");
  if (!cle) continue;
  if (!PAR_SOUS_DOMAINE.has(cle)) PAR_SOUS_DOMAINE.set(cle, []);
  PAR_SOUS_DOMAINE.get(cle)!.push({ id: fiche.id, axe: String(fiche.axe ?? "") });
}

export function etatGraphe(): {
  present: boolean;
  modele: string;
  genere_le: string;
  nb_relations: number;
  compte_par_type: Record<string, number>;
} {
  return {
    present: GRAPHE.relations.length > 0,
    modele: GRAPHE.modele,
    genere_le: GRAPHE.genere_le,
    nb_relations: GRAPHE.relations.length,
    compte_par_type: GRAPHE.compte_par_type,
  };
}

/* -------------------------------------------------------------------------- */
/* Lecture                                                                    */
/* -------------------------------------------------------------------------- */

function nomDe(extremite: ExtremiteRelation): string {
  if (extremite.type === "humaine") return getFicheHumaine(extremite.id)?.nom ?? extremite.id;
  if (extremite.type === "ia") return getFicheIA(extremite.id)?.nom ?? extremite.id;
  return getFicheGap(extremite.id)?.sujet ?? extremite.id;
}

/**
 * Rôle qu'une relation confère à l'autre extrémité, vu depuis `sortante`.
 *
 * `conteste` est le seul type dont le sens compte peu : qu'une fiche en conteste
 * une autre ou soit contestée par elle, il y a désaccord documenté entre les
 * deux — c'est cela qui intéresse la réponse. `succession` au contraire est
 * strictement orientée : l'antécédent et la postérité ne disent pas la même
 * chose sur la question.
 */
function roleDepuis(type: TypeRelation, sortante: boolean): RoleCroisement | null {
  switch (type) {
    case "conteste":
      return "contradiction";
    case "mention":
      return "mention_limites";
    case "mobilise":
      return "appui";
    case "succession":
      return sortante ? "antecedent" : "posterite";
    case "source_commune":
      return "meme_preuve";
    case "couple":
    case "resonance":
      return sortante ? "couple_ia" : null;
    default:
      return null;
  }
}

function enonceDe(role: RoleCroisement, nomSource: string, nomCible: string, sortante: boolean): string {
  switch (role) {
    // Formulations volontairement littérales. Ce que la détection établit, c'est
    // qu'une fiche en NOMME une autre, et dans quel champ. « Réfute » ou
    // « démontre » serait une lecture ; « nomme dans ses limites critiques » est
    // un fait vérifiable dans le texte cité juste après.
    case "contradiction":
      return sortante
        ? `« ${nomSource} » nomme « ${nomCible} » dans le champ « limites critiques » de sa fiche : c'est là que le référentiel situe la discussion.`
        : `« ${nomCible} » nomme « ${nomSource} » dans le champ « limites critiques » de sa fiche : c'est là que le référentiel situe la discussion.`;
    case "appui":
      return sortante
        ? `« ${nomSource} » nomme « ${nomCible} » dans sa thèse ou son apport : elle s'y adosse.`
        : `« ${nomCible} » nomme « ${nomSource} » dans sa thèse ou son apport : elle s'y adosse.`;
    // Nommée dans les limites, sans marque d'opposition. Le lien est réel, le
    // désaccord ne l'est pas : le dire autrement serait fabriquer une
    // controverse.
    case "mention_limites":
      return sortante
        ? `« ${nomSource} » nomme « ${nomCible} » dans ses limites critiques, sans en faire une objection.`
        : `« ${nomCible} » nomme « ${nomSource} » dans ses limites critiques, sans en faire une objection.`;
    case "antecedent":
      return `« ${nomCible} » précède « ${nomSource} » dans le même sous-domaine.`;
    case "posterite":
      return `« ${nomCible} » vient après « ${nomSource} » dans le même sous-domaine.`;
    case "meme_preuve":
      return `« ${nomSource} » et « ${nomCible} » reposent sur au moins une source identique.`;
    case "couple_ia":
      return `Une fiche de gap documente la paire « ${nomSource} » × « ${nomCible} ».`;
    default:
      return "";
  }
}

/**
 * Voisins raisonnés d'une fiche, triés par force de la relation.
 *
 * `autre_discipline` est calculé ici plutôt que stocké : dans un sous-domaine
 * peuplé, matérialiser toutes les paires produirait des milliers d'arêtes qui
 * n'apprennent rien de plus que « même sous-domaine, axe différent ».
 */
export function voisinsRaisonnes(type: TypeFicheRag, id: string): Voisin[] {
  const cle = cleFiche(type, id);
  const source = nomDe({ type, id });
  const voisins: Voisin[] = [];
  const vus = new Set<string>();

  for (const { relation, sortante } of PAR_FICHE.get(cle) ?? []) {
    const role = roleDepuis(relation.type, sortante);
    if (!role) continue;
    const cible = sortante ? relation.vers : relation.de;
    const cleCible = cleFiche(cible.type, cible.id);
    if (cleCible === cle) continue;
    const marque = `${role}|${cleCible}`;
    if (vus.has(marque)) continue;
    vus.add(marque);
    voisins.push({
      cible,
      role,
      preuve: relation.preuve,
      enonce: enonceDe(role, source, nomDe(cible), sortante),
    });
  }

  // Même objet, autre discipline : deux fiches humaines qui partagent le
  // sous-domaine mais pas l'axe regardent le même objet depuis deux savoirs
  // différents. C'est le croisement le plus intéressant après la contradiction,
  // et il n'est porté par aucune phrase — il est porté par la structure.
  if (type === "humaine") {
    const fiche = getFicheHumaine(id);
    const sd = String(fiche?.sous_domaine ?? "");
    for (const autre of PAR_SOUS_DOMAINE.get(sd) ?? []) {
      if (autre.id === id || autre.axe === String(fiche?.axe ?? "")) continue;
      const marque = `autre_discipline|humaine:${autre.id}`;
      if (vus.has(marque)) continue;
      vus.add(marque);
      voisins.push({
        cible: { type: "humaine", id: autre.id },
        role: "autre_discipline",
        preuve: "",
        enonce:
          `« ${nomDe({ type: "humaine", id: autre.id })} » traite le même sous-domaine (${sd}) ` +
          `depuis un autre axe du référentiel.`,
      });
    }
  }

  return voisins;
}

/** Force relative des rôles : sert au tri des candidats. Plus haut = retenu d'abord. */
export const PRIORITE_ROLE: Record<RoleCroisement, number> = {
  pivot: 100,
  contradiction: 90,
  autre_discipline: 70,
  appui: 60,
  mention_limites: 55,
  antecedent: 50,
  posterite: 45,
  couple_ia: 40,
  meme_preuve: 30,
  voisinage_lexical: 10,
};

/** Libellé lisible d'un rôle, pour l'affichage. */
export const LIBELLE_ROLE: Record<RoleCroisement, string> = {
  pivot: "fiche pivot",
  contradiction: "contradiction documentée",
  autre_discipline: "même objet, autre discipline",
  appui: "appui explicite",
  mention_limites: "nommée dans les limites",
  antecedent: "antécédent historique",
  posterite: "postérité",
  couple_ia: "paire humain × IA documentée",
  meme_preuve: "repose sur la même source",
  voisinage_lexical: "voisinage de vocabulaire",
};

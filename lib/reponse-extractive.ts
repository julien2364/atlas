// Mode 3 — RÉPONSE EXTRACTIVE, sans aucun modèle génératif.
//
// C'est le mode qui marche immédiatement, sans rien configurer, et c'est le seul
// des trois qui ne peut RIEN halluciner : tout ce qu'il affiche est recopié du
// corpus. Il ne simule pas une réponse de modèle — il n'y a pas de modèle.
//
// Comment une perspective est composée
// ------------------------------------
// Le référentiel est structuré exactement pour ça : chaque fiche humaine porte
// une thèse centrale, un apport, des limites critiques et ses sources. Une
// perspective est donc l'assemblage des champs d'UNE fiche réellement retrouvée
// par la recherche :
//
//   modele           ← le nom de la fiche (l'auteur, l'école, la paire humain × IA)
//   hypotheses       ← la thèse centrale (fiche humaine) / le mécanisme (gap)
//                      / les capacités clés (fiche IA)
//   etat_actuel      ← les extraits RÉELLEMENT retrouvés, recopiés mot pour mot
//   reponse          ← l'apport de la fiche / l'apport de l'IA (gap)
//   justification    ← pourquoi cette fiche est là : quels champs ont répondu,
//                      à quelle proximité. Phrase mécanique, vérifiable.
//   limites          ← les limites critiques / limites connues / l'amélioration
//                      possible et la substituabilité (gap)
//   sources          ← les sources de la fiche, lues dans data/seed
//   niveau_confiance ← déduit du statut documentaire de la fiche
//
// Aucune de ces valeurs n'est reformulée. Ce qui est écrit ici est le tissu
// conjonctif — des étiquettes de champ et une phrase de justification — jamais
// du contenu de fond.
//
// Perspectives distinctes, et convergence assumée
// -----------------------------------------------
// Les passages sont d'abord regroupés PAR FICHE (sinon quatre extraits du même
// auteur deviendraient quatre « écoles »), puis diversifiés PAR AXE (sinon les
// cinq perspectives viennent toutes de l'axe philosophique). Et si les fiches
// retrouvées convergent malgré tout — un seul axe, un seul sous-domaine — c'est
// DIT, au lieu de fabriquer une controverse qui n'existe pas dans le corpus.

import type { NiveauConfiance, Perspective } from "@/lib/types";
import { fichesGap, fichesHumaines, fichesIA, getFicheGap, getFicheHumaine, getFicheIA, libelleAxeHumain, libelleAxeIA, LABELS_SUBSTITUABILITE } from "@/lib/corpus";
import { dedupliquerSources, niveauDepuisStatut, resoudreFiche, sourcesDeFiche, type TypeFicheRag } from "@/lib/sources-corpus";
import { libelleChamp } from "@/lib/passages-corpus.mjs";

/** Nombre maximal de perspectives composées. Au-delà, la page devient illisible. */
const MAX_PERSPECTIVES = 5;

/** Perspectives issues d'un même axe. Deux au plus : sinon un axe monopolise la réponse. */
const MAX_PAR_AXE = 2;

/** Sources affichées par perspective. */
const MAX_SOURCES = 6;

/** Champs dont le contenu est, par nature, un scénario futur et non un état de fait. */
const CHAMPS_PROSPECTIFS = new Set(["scenario_5ans", "scenario_15_20ans", "axes_prospectifs"]);

export interface PassagePourExtraction {
  type_fiche: TypeFicheRag;
  fiche_id: string;
  champ: string;
  titre_fiche: string;
  texte: string;
  similarite: number;
  metadonnees: Record<string, unknown>;
}

export interface ReponseExtractive {
  reformulation: string;
  perspectives: Perspective[];
  angles_morts: string;
  avertissements: string[];
  /** Vrai quand toutes les fiches retenues relèvent d'un même axe. */
  convergence: boolean;
}

/** Regroupement d'une fiche et de tous ses passages retrouvés. */
interface GroupeFiche {
  type: TypeFicheRag;
  id: string;
  nom: string;
  axe: string;
  sous_domaine: string;
  similarite_max: number;
  passages: PassagePourExtraction[];
}

/**
 * Retire l'en-tête d'ancrage ajouté à l'indexation (« Référentiel A — capacité
 * humaine « X » (…) — thèse centrale : »). Il sert à la recherche ; affiché tel
 * quel dans une réponse, il fait du bruit et répète le nom de la fiche déjà
 * porté par l'onglet.
 */
function sansEntete(texte: string): string {
  const saut = texte.indexOf("\n");
  return (saut === -1 ? texte : texte.slice(saut + 1)).trim();
}

function texteOuVide(valeur: unknown): string {
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** Axe d'une fiche, utilisé pour diversifier les perspectives. */
function axeDeFiche(type: TypeFicheRag, id: string): { axe: string; sous_domaine: string } {
  if (type === "humaine") {
    const fiche = getFicheHumaine(id);
    return { axe: fiche?.axe ?? "inconnu", sous_domaine: fiche?.sous_domaine ?? "" };
  }
  if (type === "ia") {
    const fiche = getFicheIA(id);
    return { axe: fiche?.axe ?? "inconnu", sous_domaine: fiche?.editeur ?? "" };
  }
  const gap = getFicheGap(id);
  // Une fiche de gap hérite de l'axe de sa fiche humaine : c'est cet axe-là qui
  // détermine le point de vue, la fiche IA n'étant que l'outil comparé.
  const humaine = gap ? getFicheHumaine(gap.fiche_humaine_id) : undefined;
  return { axe: humaine?.axe ?? "gap", sous_domaine: gap?.sujet ?? "" };
}

function libelleAxe(type: TypeFicheRag, axe: string): string {
  return type === "ia" ? libelleAxeIA(axe) : libelleAxeHumain(axe);
}

/** Regroupe les passages par fiche, en conservant l'ordre de proximité décroissante. */
function grouperParFiche(passages: PassagePourExtraction[]): GroupeFiche[] {
  const index = new Map<string, GroupeFiche>();
  for (const passage of passages) {
    const cle = `${passage.type_fiche}:${passage.fiche_id}`;
    const existant = index.get(cle);
    if (existant) {
      existant.passages.push(passage);
      existant.similarite_max = Math.max(existant.similarite_max, passage.similarite);
      continue;
    }
    const resolue = resoudreFiche(passage.type_fiche, passage.fiche_id);
    const { axe, sous_domaine } = axeDeFiche(passage.type_fiche, passage.fiche_id);
    index.set(cle, {
      type: passage.type_fiche,
      id: passage.fiche_id,
      nom: resolue?.nom ?? passage.titre_fiche,
      axe,
      sous_domaine,
      similarite_max: passage.similarite,
      passages: [passage],
    });
  }
  return [...index.values()].sort((a, b) => b.similarite_max - a.similarite_max);
}

/**
 * Choisit les fiches qui deviendront des perspectives.
 *
 * Deux passes : la première prend la meilleure fiche de chaque axe, ce qui
 * garantit la diversité même quand un axe domine le classement ; la seconde
 * complète dans l'ordre de proximité, sans dépasser MAX_PAR_AXE.
 */
function choisirFiches(groupes: GroupeFiche[]): GroupeFiche[] {
  const retenus: GroupeFiche[] = [];
  const parAxe = new Map<string, number>();

  for (const groupe of groupes) {
    if (retenus.length >= MAX_PERSPECTIVES) break;
    if ((parAxe.get(groupe.axe) ?? 0) > 0) continue;
    parAxe.set(groupe.axe, 1);
    retenus.push(groupe);
  }
  for (const groupe of groupes) {
    if (retenus.length >= MAX_PERSPECTIVES) break;
    if (retenus.includes(groupe)) continue;
    const deja = parAxe.get(groupe.axe) ?? 0;
    if (deja >= MAX_PAR_AXE) continue;
    parAxe.set(groupe.axe, deja + 1);
    retenus.push(groupe);
  }
  return retenus.sort((a, b) => b.similarite_max - a.similarite_max);
}

/** Extraits retrouvés, recopiés tels quels et étiquetés par leur champ d'origine. */
function extraitsCites(groupe: GroupeFiche, maximum = 3): string {
  return groupe.passages
    .slice(0, maximum)
    .map((p) => `[${libelleChamp(p.champ)}] ${sansEntete(p.texte)}`)
    .join("\n\n");
}

function justification(groupe: GroupeFiche): string {
  const champs = groupe.passages.map((p) => `« ${libelleChamp(p.champ)} » (${p.similarite.toFixed(2)})`);
  const contexte = [libelleAxe(groupe.type, groupe.axe), groupe.sous_domaine].filter(Boolean).join(", ");
  return (
    `Cette perspective n'est pas raisonnée : elle est composée des champs de la fiche « ${groupe.nom} »` +
    `${contexte ? ` (${contexte})` : ""}, retenue parce que ${champs.length === 1 ? "son champ" : "ses champs"} ` +
    `${champs.join(", ")} ${champs.length === 1 ? "ressort" : "ressortent"} sur cette question. ` +
    "La proximité entre parenthèses est un recouvrement de vocabulaire, pas un jugement de pertinence."
  );
}

/** Confiance de la fiche, abaissée d'un cran si un champ prospectif a été retenu. */
function confiance(groupe: GroupeFiche): NiveauConfiance {
  const prospectif = groupe.passages.some((p) => CHAMPS_PROSPECTIFS.has(p.champ));
  if (prospectif) return "hypothese_prospective";

  if (groupe.type === "humaine") return niveauDepuisStatut(getFicheHumaine(groupe.id)?.statut);
  if (groupe.type === "ia") return niveauDepuisStatut(getFicheIA(groupe.id)?.statut);

  const gap = getFicheGap(groupe.id);
  const base = niveauDepuisStatut(gap?.statut);
  // Une fiche de gap porte en plus son propre niveau de confiance : une paire
  // documentée mais donnée « faible » ne doit pas s'afficher comme une opinion
  // majoritaire.
  if (gap?.confiance === "faible") return "hypothese_prospective";
  return base;
}

/** Compose la perspective d'une fiche humaine. */
function perspectiveHumaine(groupe: GroupeFiche): Perspective | null {
  const fiche = getFicheHumaine(groupe.id);
  if (!fiche) return null;
  const contexte = [libelleAxeHumain(fiche.axe), fiche.sous_domaine, fiche.periode_courant].filter(Boolean).join(", ");
  return {
    modele: contexte ? `${fiche.nom} (${contexte})` : fiche.nom,
    hypotheses: texteOuVide(fiche.these_centrale) || "Thèse centrale non renseignée dans la fiche.",
    etat_actuel: extraitsCites(groupe),
    reponse: texteOuVide(fiche.apport) || sansEntete(groupe.passages[0].texte),
    justification: justification(groupe),
    limites: texteOuVide(fiche.limites_critiques) || "Limites critiques non renseignées dans la fiche.",
    sources: dedupliquerSources(sourcesDeFiche("humaine", fiche.id)).slice(0, MAX_SOURCES),
    niveau_confiance: confiance(groupe),
  };
}

/** Compose la perspective d'une fiche IA. */
function perspectiveIA(groupe: GroupeFiche): Perspective | null {
  const fiche = getFicheIA(groupe.id);
  if (!fiche) return null;
  const contexte = [libelleAxeIA(fiche.axe), fiche.editeur, fiche.architecture].filter(Boolean).join(", ");
  return {
    modele: contexte ? `${fiche.nom} (${contexte})` : fiche.nom,
    hypotheses:
      fiche.capacites_cles.length > 0
        ? `Capacités que la fiche attribue à ce système : ${fiche.capacites_cles.join(" ; ")}.`
        : "Capacités clés non renseignées dans la fiche.",
    etat_actuel: extraitsCites(groupe),
    reponse: sansEntete(groupe.passages[0].texte),
    justification: justification(groupe),
    limites: texteOuVide(fiche.limites_connues) || "Limites connues non renseignées dans la fiche.",
    sources: dedupliquerSources(sourcesDeFiche("ia", fiche.id)).slice(0, MAX_SOURCES),
    niveau_confiance: confiance(groupe),
  };
}

/** Compose la perspective d'une fiche de gap analysis. */
function perspectiveGap(groupe: GroupeFiche): Perspective | null {
  const gap = getFicheGap(groupe.id);
  if (!gap) return null;
  const substituabilite =
    LABELS_SUBSTITUABILITE[gap.substituabilite] ?? String(gap.substituabilite).replace(/_/g, " ");
  return {
    modele: gap.sujet ? `${groupe.nom} — ${gap.sujet}` : groupe.nom,
    hypotheses: texteOuVide(gap.mecanisme) || "Mécanisme non renseigné dans la fiche de gap.",
    etat_actuel: extraitsCites(groupe),
    reponse: texteOuVide(gap.apport_ia) || sansEntete(groupe.passages[0].texte),
    justification: `${justification(groupe)} Substituabilité déclarée : ${substituabilite.toLowerCase()} ; confiance de la fiche : ${gap.confiance}.`,
    limites:
      `Ce que cette paire ne règle pas — amélioration possible relevée par la fiche : ` +
      `${texteOuVide(gap.amelioration_possible) || "non renseignée"}. ` +
      `Mode d'interaction retenu : ${texteOuVide(gap.mode_interaction) || "non renseigné"}.`,
    sources: dedupliquerSources(sourcesDeFiche("gap", gap.id)).slice(0, MAX_SOURCES),
    niveau_confiance: confiance(groupe),
  };
}

function composer(groupe: GroupeFiche): Perspective | null {
  if (groupe.type === "humaine") return perspectiveHumaine(groupe);
  if (groupe.type === "ia") return perspectiveIA(groupe);
  return perspectiveGap(groupe);
}

/**
 * Construit la réponse extractive. Ne lève jamais et ne fabrique jamais de
 * contenu : si rien n'est composable, elle rend zéro perspective et
 * `lib/rag.ts` en tire un refus.
 */
export function construireReponseExtractive(
  question: string,
  passages: PassagePourExtraction[]
): ReponseExtractive {
  const groupes = grouperParFiche(passages);
  const choisis = choisirFiches(groupes);
  const perspectives: Perspective[] = [];
  for (const groupe of choisis) {
    const perspective = composer(groupe);
    if (perspective) perspectives.push(perspective);
  }

  const axes = new Set(choisis.map((g) => `${g.type}:${g.axe}`));
  const convergence = perspectives.length > 1 && axes.size === 1;

  const avertissements: string[] = [
    "Réponse EXTRACTIVE : composée depuis les fiches du référentiel, sans modèle génératif. " +
      "Chaque phrase de fond est recopiée d'une fiche — rien n'y est reformulé, donc rien n'y est inventé. " +
      "En contrepartie, elle n'argumente pas et ne répond pas directement à la question : elle expose ce que " +
      "le corpus contient de plus proche.",
  ];

  if (convergence) {
    const axe = choisis[0] ? libelleAxe(choisis[0].type, choisis[0].axe) : "";
    avertissements.push(
      `Les ${perspectives.length} fiches retrouvées relèvent toutes du même axe${axe ? ` (${axe})` : ""} : ` +
        "elles convergent au lieu de s'opposer. Ce n'est pas une controverse, c'est un seul point de vue " +
        "documenté sous plusieurs angles — le corpus ne contient pas (ou la recherche n'a pas trouvé) " +
        "de contradicteur sur cette question."
    );
  }

  const nomsChoisis = choisis.map((g) => g.nom);
  const anglesMorts = [
    `Ce mode assemble des champs de fiches ; il ne raisonne pas. Il ne compare pas les ${perspectives.length} ` +
      "perspectives entre elles, ne tranche pas, et ne dit pas laquelle répond le mieux à la question posée.",
    `${groupes.length} fiche(s) ont été retrouvées, ${perspectives.length} ont été retenues ` +
      `(${nomsChoisis.join(" · ")}) : les autres sont visibles dans les extraits, sans perspective composée.`,
    "La recherche est lexicale : elle retrouve les fiches qui emploient les mots de la question, pas celles " +
      "qui traitent le sujet avec d'autres mots. Une école absente d'ici peut très bien être dans le corpus.",
    `Le référentiel couvre ${fichesHumaines.length} capacités humaines, ${fichesIA.length} capacités IA et ` +
      `${fichesGap.length} paires ; tout ce qui n'y est pas ne peut pas apparaître dans une réponse extractive.`,
  ].join(" ");

  return {
    // Pas de reformulation : reformuler suppose de comprendre, et ce mode ne
    // comprend rien. On rend la question telle qu'elle a été posée.
    reformulation: question,
    perspectives,
    angles_morts: anglesMorts,
    avertissements,
    convergence,
  };
}

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
// auteur deviendraient quatre « écoles »), puis diversifiés PAR FAMILLE — axe et
// sous-domaine (sinon les cinq perspectives viennent toutes de l'économie). Et si les fiches
// retrouvées convergent malgré tout — un seul axe, un seul sous-domaine — c'est
// DIT, au lieu de fabriquer une controverse qui n'existe pas dans le corpus.

import type { NiveauConfiance, Perspective } from "@/lib/types";
import { fichesGap, fichesHumaines, fichesIA, getFicheGap, getFicheHumaine, getFicheIA, libelleAxeHumain, libelleAxeIA, LABELS_SUBSTITUABILITE } from "@/lib/corpus";
import { dedupliquerSources, niveauDepuisStatut, resoudreFiche, sourcesDeFiche, type TypeFicheRag } from "@/lib/sources-corpus";
import { libelleChamp } from "@/lib/passages-corpus.mjs";

/** Nombre maximal de perspectives composées. Au-delà, la page devient illisible. */
const MAX_PERSPECTIVES = 5;

/**
 * Perspectives issues d'une même FAMILLE (axe + sous-domaine). Deux au plus :
 * sinon une famille monopolise la réponse.
 *
 * La famille, et non l'axe seul : l'axe est très grossier — « social » couvre
 * l'économie, les modèles politiques, la gouvernance mondiale et le management.
 * Plafonner à l'axe écartait « Maoïsme » d'une question sur la comparaison des
 * systèmes économiques au profit d'une paire « Nietzsche × Claude » moins bien
 * classée, au seul motif que deux fiches d'économie étaient déjà passées.
 * Mesuré sur les questions-tests : la famille diversifie sans sacrifier la
 * pertinence, l'axe seul sacrifiait les deux.
 */
const MAX_PAR_FAMILLE = 2;

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
  // Une fiche de gap hérite de l'axe ET du sous-domaine de sa fiche humaine :
  // c'est ce point de vue-là qu'elle porte, la fiche IA n'étant que l'outil
  // comparé. Son propre `sujet` ne servirait pas ici — il est quasi unique par
  // paire, donc aucun gap ne serait jamais plafonné.
  const humaine = gap ? getFicheHumaine(gap.fiche_humaine_id) : undefined;
  return { axe: humaine?.axe ?? "gap", sous_domaine: humaine?.sous_domaine ?? "" };
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
 * Fraction de la meilleure similarité en dessous de laquelle une fiche ne
 * devient PAS une perspective.
 *
 * Sans ce plancher, la diversification par axe promeut la meilleure fiche de
 * chaque axe même quand elle est à 0,10 pendant que la première est à 0,42 :
 * sur « comparer capitalisme, communisme et modèle chinois », elle faisait
 * entrer une fiche « Caltech » et une paire « Nietzsche × Claude » comme
 * écoles de pensée, en écartant « Maoïsme ». Une perspective hors sujet
 * décrédibilise les quatre autres. Les fiches sous le plancher restent
 * visibles dans les extraits — elles ne sont simplement pas présentées comme
 * un point de vue sur la question.
 *
 * Un quart, et pas plus : au-dessus, une question dont UNE fiche ressort très
 * fort (« les limites de l'IA générative sont-elles structurelles » : 0,324
 * contre 0,098 pour la suivante) n'obtient plus qu'une seule perspective, ce
 * qui est en deçà de la règle de neutralité active. Les passages retenus sont
 * de toute façon déjà tous au-dessus du seuil de similarité du moteur, et la
 * proximité réelle de chaque perspective est écrite dans sa justification :
 * une perspective faible se voit, elle ne se déguise pas.
 */
const FRACTION_PLANCHER = 0.25;

/**
 * Choisit les fiches qui deviendront des perspectives.
 *
 * Ordre de priorité assumé : la PERTINENCE d'abord, la diversité ensuite.
 *   1. plancher relatif : on écarte ce qui est très loin derrière la première ;
 *   2. passe de diversité : au plus MAX_PAR_FAMILLE fiches d'une même famille
 *      (axe + sous-domaine), pour que cinq fiches d'économie ne deviennent pas
 *      cinq « écoles » différentes ;
 *   3. passe de complément : s'il reste des places, on les donne aux meilleures
 *      candidates restantes, plafond de famille compris. Mieux vaut deux fiches
 *      de plus de la même famille qu'une perspective hors sujet ramassée pour
 *      faire nombre.
 */
function choisirFiches(groupes: GroupeFiche[]): GroupeFiche[] {
  if (groupes.length === 0) return [];
  const plancher = groupes[0].similarite_max * FRACTION_PLANCHER;
  const candidats = groupes.filter((g) => g.similarite_max >= plancher);

  const retenus: GroupeFiche[] = [];
  const parFamille = new Map<string, number>();
  const famille = (g: GroupeFiche) => `${g.axe}/${g.sous_domaine}`;

  for (const groupe of candidats) {
    if (retenus.length >= MAX_PERSPECTIVES) break;
    const deja = parFamille.get(famille(groupe)) ?? 0;
    if (deja >= MAX_PAR_FAMILLE) continue;
    parFamille.set(famille(groupe), deja + 1);
    retenus.push(groupe);
  }
  for (const groupe of candidats) {
    if (retenus.length >= MAX_PERSPECTIVES) break;
    if (retenus.includes(groupe)) continue;
    retenus.push(groupe);
  }
  return retenus.sort((a, b) => b.similarite_max - a.similarite_max);
}

/**
 * Extraits retrouvés, recopiés tels quels et étiquetés par leur champ d'origine.
 *
 * `dejaRepris` liste les champs déjà affichés ailleurs dans la perspective : la
 * thèse centrale est en « hypothèses », l'apport en « réponse », les limites
 * critiques en « limites ». Sans ce filtre, « état actuel » répétait mot pour
 * mot les trois autres champs et la perspective donnait l'impression de tourner
 * en rond. Ce qui reste ici est donc ce que la recherche a trouvé EN PLUS.
 */
function extraitsCites(groupe: GroupeFiche, dejaRepris: string[], maximum = 3): string {
  const exclus = new Set(dejaRepris);
  const restants = groupe.passages.filter((p) => !exclus.has(p.champ)).slice(0, maximum);
  if (restants.length === 0) {
    const champs = groupe.passages.map((p) => `« ${libelleChamp(p.champ)} »`).join(", ");
    return (
      `La recherche n'a retrouvé de cette fiche que ${champs}, déjà repris dans les autres champs ` +
      "de cette perspective. Aucun élément factuel supplémentaire n'a été trouvé."
    );
  }
  return restants.map((p) => `[${libelleChamp(p.champ)}] ${sansEntete(p.texte)}`).join("\n\n");
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
    etat_actuel: extraitsCites(groupe, ["these_centrale", "apport", "limites_critiques"]),
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
    etat_actuel: extraitsCites(groupe, ["capacites_cles", "limites_connues"]),
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
    etat_actuel: extraitsCites(groupe, ["mecanisme", "apport_ia", "amelioration_possible", "mode_interaction"]),
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

  // Convergence : on regarde l'AXE seul, sans le type de fiche. Une fiche de gap
  // hérite de l'axe de sa fiche humaine ; distinguer « humaine:philosophique »
  // de « gap:philosophique » faisait passer pour un débat quatre lectures
  // philosophiques qui disaient toutes la même chose.
  const axes = new Set(choisis.map((g) => g.axe));
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

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
import {
  cleFiche,
  etatGraphe,
  LIBELLE_ROLE,
  PRIORITE_ROLE,
  voisinsRaisonnes,
  type RoleCroisement,
  type Voisin,
} from "@/lib/relations-corpus";

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
  /** Relations qui ont fait entrer chaque perspective, dans l'ordre d'affichage. */
  croisements: { fiche: string; role: string; enonce: string; preuve: string }[];
  /**
   * Mise en tension des perspectives entre elles : qui s'oppose à qui, sur quoi,
   * et ce que le corpus ne tranche pas. Assemblée de phrases du corpus — aucune
   * n'est reformulée — mais ORGANISÉE, ce que le simple empilement de fiches ne
   * faisait pas.
   */
  synthese: string;
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
  /** Rôle joué dans la réponse, par rapport à la fiche pivot. Posé par `choisirFiches`. */
  role?: RoleCroisement;
  /** Phrase décrivant la relation au pivot, et la phrase du corpus qui la porte. */
  relation?: { enonce: string; preuve: string };
  /** Vrai quand la fiche n'a PAS été retrouvée par la recherche : c'est le graphe qui l'a fait entrer. */
  introduite?: boolean;
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
 * Nombre de liens documentés au-delà duquel l'ancrage d'une fiche ne compte plus
 * davantage. Quatre : une fiche reliée à quatre autres du lot est déjà,
 * manifestement, au centre du sujet.
 */
const MAX_ANCRAGE = 4;

/**
 * Poids de l'ancrage relationnel face à la proximité lexicale dans le choix du
 * pivot. À 0,6, une fiche reliée à trois autres l'emporte sur une fiche isolée
 * qui la devance de moins de 45 % en proximité — ce qui était exactement le cas
 * de « Structure matricielle » (0,26) contre « Démocratie libérale » (0,25) sur
 * une question de régime politique. Au-delà de 1, l'ancrage écraserait la
 * pertinence et une fiche très connectée deviendrait le pivot de toutes les
 * questions.
 */
const POIDS_ANCRAGE = 0.6;

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

  /* --- 1. La fiche pivot --------------------------------------------------- */
  // Le pivot n'est PAS simplement la fiche la mieux classée. Sur « la démocratie
  // libérale est-elle encore le meilleur régime », la recherche lexicale plaçait
  // « Structure matricielle » en tête (0,26) — la fiche parle de coordination,
  // de double autorité hiérarchique, de logiques de regroupement : du vocabulaire
  // partagé, aucun rapport avec la question. Une réponse construite autour de ce
  // pivot est fausse dès sa première ligne.
  //
  // On choisit donc le pivot en combinant deux signaux : la proximité lexicale,
  // et le nombre de LIENS DOCUMENTÉS que la fiche entretient avec les AUTRES
  // fiches retrouvées. Une fiche isolée au milieu d'un peloton qui se cite
  // mutuellement est presque toujours un faux ami du vocabulaire ; une fiche que
  // trois des autres nomment est le sujet réel de la question.
  const clesCandidats = new Set(candidats.map((g) => cleFiche(g.type, g.id)));
  const voisinagesParCandidat = new Map<string, Map<string, Voisin>>();
  const degres = new Map<string, number>();
  for (const groupe of candidats) {
    const cle = cleFiche(groupe.type, groupe.id);
    const table = new Map<string, Voisin>();
    let degre = 0;
    for (const voisin of voisinsRaisonnes(groupe.type, groupe.id)) {
      const cleCible = cleFiche(voisin.cible.type, voisin.cible.id);
      const deja = table.get(cleCible);
      if (!deja || PRIORITE_ROLE[voisin.role] > PRIORITE_ROLE[deja.role]) table.set(cleCible, voisin);
      if (clesCandidats.has(cleCible)) degre += 1;
    }
    voisinagesParCandidat.set(cle, table);
    degres.set(cle, degre);
  }

  const meilleure = candidats[0].similarite_max || 1;
  const notePivot = (g: GroupeFiche) => {
    const cle = cleFiche(g.type, g.id);
    const ancrage = Math.min(degres.get(cle) ?? 0, MAX_ANCRAGE) / MAX_ANCRAGE;
    return g.similarite_max / meilleure + POIDS_ANCRAGE * ancrage;
  };
  const pivot = [...candidats].sort((a, b) => notePivot(b) - notePivot(a))[0];
  pivot.role = "pivot";

  /* --- 2. Ce que le graphe dit de la fiche pivot --------------------------- */
  // `voisinsRaisonnes` rend TOUTES les fiches liées au pivot par une relation
  // documentée, qu'elles aient été retrouvées ou non par la recherche. C'est
  // exactement ce qui manquait : la contradiction d'une thèse n'emploie pas
  // forcément les mots de la question.
  const voisins = voisinagesParCandidat.get(cleFiche(pivot.type, pivot.id)) ?? new Map<string, Voisin>();

  /* --- 3. Rôle de chaque candidat retrouvé --------------------------------- */
  for (const groupe of candidats) {
    if (groupe === pivot) continue;
    const voisin = voisins.get(cleFiche(groupe.type, groupe.id));
    groupe.role = voisin ? voisin.role : "voisinage_lexical";
    if (voisin) groupe.relation = { enonce: voisin.enonce, preuve: voisin.preuve };
  }

  /* --- 4. Sélection : la relation d'abord, la proximité ensuite ------------ */
  const retenus: GroupeFiche[] = [pivot];
  const parFamille = new Map<string, number>();
  const famille = (g: GroupeFiche) => `${g.axe}/${g.sous_domaine}`;
  parFamille.set(famille(pivot), 1);

  const restants = candidats
    .filter((g) => g !== pivot)
    .sort(
      (a, b) =>
        PRIORITE_ROLE[b.role ?? "voisinage_lexical"] - PRIORITE_ROLE[a.role ?? "voisinage_lexical"] ||
        b.similarite_max - a.similarite_max
    );

  for (const groupe of restants) {
    if (retenus.length >= MAX_PERSPECTIVES) break;
    // Une contradiction documentée n'est jamais écartée par le plafond de
    // famille : le plafond existe pour éviter cinq fiches d'économie qui disent
    // la même chose, pas pour écarter celle qui dit le contraire.
    const exemptee = groupe.role === "contradiction";
    const deja = parFamille.get(famille(groupe)) ?? 0;
    if (!exemptee && deja >= MAX_PAR_FAMILLE) continue;
    parFamille.set(famille(groupe), deja + 1);
    retenus.push(groupe);
  }

  /* --- 5. Aller chercher la contradiction absente des résultats ------------ */
  // Si aucune fiche retrouvée ne contredit le pivot, on va chercher dans le
  // graphe celle qui le fait. C'est le seul endroit où une fiche entre dans une
  // réponse sans avoir été retrouvée par la recherche — et elle est signalée
  // comme telle, avec la phrase du corpus qui fonde la relation.
  const dejaRetenue = new Set(retenus.map((g) => cleFiche(g.type, g.id)));
  const introduisibles = [...voisins.values()]
    .filter((v) => !dejaRetenue.has(cleFiche(v.cible.type, v.cible.id)))
    .filter((v) => v.role !== "meme_preuve")
    .sort((a, b) => PRIORITE_ROLE[b.role] - PRIORITE_ROLE[a.role]);

  // 5a. Les places prises par un voisinage de vocabulaire FAIBLE sont rendues :
  // une fiche appariée sur un mot ne vaut pas une fiche liée par une relation.
  const seuil = pivot.similarite_max * PLANCHER_VOISINAGE;
  let introduites = 0;
  for (let i = retenus.length - 1; i >= 1 && introduites < MAX_INTRODUITES; i -= 1) {
    const occupant = retenus[i];
    if (occupant.role !== "voisinage_lexical" || occupant.similarite_max >= seuil) continue;
    const voisin = introduisibles.shift();
    if (!voisin) break;
    const groupe = grouperFicheSansPassage(voisin);
    if (!groupe) continue;
    retenus[i] = groupe;
    dejaRetenue.add(cleFiche(groupe.type, groupe.id));
    introduites += 1;
  }

  // 5b. S'il reste des places vides, une relation vaut mieux que rien.
  while (retenus.length < MAX_PERSPECTIVES && introduites < MAX_INTRODUITES) {
    const voisin = introduisibles.shift();
    if (!voisin) break;
    const groupe = grouperFicheSansPassage(voisin);
    if (!groupe) continue;
    dejaRetenue.add(cleFiche(groupe.type, groupe.id));
    retenus.push(groupe);
    introduites += 1;
  }

  // Le pivot reste en tête ; le reste suit l'ordre de la relation, pas celui du
  // score. Une contradiction affichée en cinquième position se lit comme une
  // note de bas de page.
  return retenus;
}

/**
 * Nombre maximal de fiches qu'une relation peut faire entrer dans une réponse
 * alors que la recherche ne les a pas retrouvées.
 *
 * Deux : au-delà, la réponse cesse de porter sur la question posée et devient
 * une promenade dans le graphe.
 */
const MAX_INTRODUITES = 2;

/**
 * Fraction de la proximité du pivot en dessous de laquelle une fiche retenue au
 * seul voisinage de vocabulaire cède sa place à une fiche liée par une relation.
 *
 * Mesuré sur « la démocratie libérale est-elle encore le meilleur régime » : les
 * deux dernières places allaient à « Structure matricielle » et à une paire
 * « Entreprise libérée × XGBoost », appariées sur « libérale » / « libérée ».
 * Aucune des deux ne dit quoi que ce soit du régime politique. Un antécédent
 * historique du pivot, lui, en dit quelque chose.
 */
const PLANCHER_VOISINAGE = 0.5;

/**
 * Construit un groupe pour une fiche que la recherche n'a PAS retrouvée, mais
 * qu'une relation documentée fait entrer. Elle n'a donc aucun passage : sa
 * perspective sera composée de ses seuls champs, et le dire est obligatoire.
 */
function grouperFicheSansPassage(voisin: Voisin): GroupeFiche | null {
  const resolue = resoudreFiche(voisin.cible.type, voisin.cible.id);
  if (!resolue) return null;
  const { axe, sous_domaine } = axeDeFiche(voisin.cible.type, voisin.cible.id);
  return {
    type: voisin.cible.type,
    id: voisin.cible.id,
    nom: resolue.nom,
    axe,
    sous_domaine,
    similarite_max: 0,
    passages: [],
    role: voisin.role,
    relation: { enonce: voisin.enonce, preuve: voisin.preuve },
    introduite: true,
  };
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
  if (groupe.passages.length === 0) {
    return (
      "La recherche n'a retrouvé aucun passage de cette fiche : elle n'emploie pas le vocabulaire de la " +
      "question. Les champs affichés dans cette perspective sont donc ceux de la fiche, pris tels quels, " +
      "et non des extraits sélectionnés par la question."
    );
  }
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

/**
 * Pourquoi cette fiche est là.
 *
 * Trois cas, et trois phrases différentes — parce que les trois situations ne
 * se valent pas et que les confondre serait mentir :
 *
 *   1. la fiche PIVOT : retenue sur la seule proximité de vocabulaire. On le
 *      dit, avec le chiffre ;
 *   2. une fiche liée au pivot par une RELATION DOCUMENTÉE : on énonce la
 *      relation et on cite la phrase du corpus qui la porte. C'est un
 *      croisement raisonné : il tient sur un texte, pas sur un score ;
 *   3. une fiche INTRODUITE par le graphe, que la recherche n'avait pas
 *      retrouvée : même énoncé, plus l'avertissement qu'elle n'emploie pas les
 *      mots de la question.
 */
function justification(groupe: GroupeFiche): string {
  const contexte = [libelleAxe(groupe.type, groupe.axe), groupe.sous_domaine].filter(Boolean).join(", ");
  const situation = contexte ? ` (${contexte})` : "";
  const role = groupe.role ?? "voisinage_lexical";

  if (role === "pivot") {
    const champs = groupe.passages.map((p) => `« ${libelleChamp(p.champ)} » (${p.similarite.toFixed(2)})`);
    return (
      `Fiche pivot : « ${groupe.nom} »${situation} est la fiche que la recherche place en tête sur cette ` +
      `question, ${champs.length === 1 ? "son champ" : "ses champs"} ${champs.join(", ")} ${champs.length === 1 ? "y ressortant" : "y ressortant"}. ` +
      "La proximité entre parenthèses est un recouvrement de vocabulaire, pas un jugement de valeur : c'est le " +
      "point de départ du croisement, pas sa conclusion. Les perspectives suivantes sont choisies par leur " +
      "relation documentée à celle-ci."
    );
  }

  if (groupe.relation) {
    const preuve = groupe.relation.preuve
      ? ` Phrase du corpus qui fonde la relation : « ${groupe.relation.preuve} »`
      : "";
    const origine = groupe.introduite
      ? " Cette fiche n'a PAS été retrouvée par la recherche : elle n'emploie pas le vocabulaire de la question. " +
        "C'est la relation ci-dessus qui la fait entrer — c'est précisément ce qu'un croisement lexical ne sait pas faire."
      : ` Elle a par ailleurs été retrouvée par la recherche (proximité ${groupe.similarite_max.toFixed(2)}).`;
    return (
      `Croisement raisonné — ${LIBELLE_ROLE[role]} : ${groupe.relation.enonce}${preuve}${origine}`
    );
  }

  const champs = groupe.passages.map((p) => `« ${libelleChamp(p.champ)} » (${p.similarite.toFixed(2)})`);
  return (
    `Aucune relation documentée entre « ${groupe.nom} »${situation} et la fiche pivot dans le référentiel. ` +
    `Cette fiche est ici sur le seul voisinage de vocabulaire : ${champs.join(", ")}. ` +
    "La proximité est un recouvrement de mots, pas un jugement de pertinence — à lire comme un rapprochement " +
    "à vérifier, pas comme un point de vue qui répond à la question."
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

/**
 * Premier extrait retrouvé, ou constat d'absence. Une fiche introduite par le
 * graphe n'a aucun passage : lire `passages[0]` y planterait la réponse.
 */
function premierExtrait(groupe: GroupeFiche): string {
  const premier = groupe.passages[0];
  return premier ? sansEntete(premier.texte) : "Champ non renseigné dans la fiche.";
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
    reponse: texteOuVide(fiche.apport) || premierExtrait(groupe),
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
    reponse: premierExtrait(groupe),
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
    reponse: texteOuVide(gap.apport_ia) || premierExtrait(groupe),
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

/** Première phrase d'un texte, pour citer sans noyer. */
function premierePhrase(texte: string, maximum = 320): string {
  const propre = String(texte ?? "").trim();
  if (!propre) return "";
  // On ne coupe qu'à une vraie fin de phrase : un point suivi d'une majuscule ou
  // d'un guillemet ouvrant. Sans ce garde-fou, « (cf. débats Mouffe/Rawls…) »
  // était tronqué à « (cf. » — la citation perdait exactement son contenu.
  const coupe = propre.split(/(?<=[.!?])\s+(?=[«"A-ZÀ-ÖØ-Þ])/)[0] ?? propre;
  return coupe.length > maximum ? `${coupe.slice(0, maximum).trim()}…` : coupe;
}

/** Thèse portée par une fiche, quel que soit son type. */
function theseDe(groupe: GroupeFiche): string {
  if (groupe.type === "humaine") return texteOuVide(getFicheHumaine(groupe.id)?.these_centrale);
  if (groupe.type === "ia") {
    const capacites = getFicheIA(groupe.id)?.capacites_cles ?? [];
    return capacites.length > 0 ? capacites.join(" ; ") : "";
  }
  return texteOuVide(getFicheGap(groupe.id)?.mecanisme);
}

/** Ce que la fiche pose comme limite. */
function limiteDe(groupe: GroupeFiche): string {
  if (groupe.type === "humaine") return texteOuVide(getFicheHumaine(groupe.id)?.limites_critiques);
  if (groupe.type === "ia") return texteOuVide(getFicheIA(groupe.id)?.limites_connues);
  return texteOuVide(getFicheGap(groupe.id)?.amelioration_possible);
}

/**
 * Mise en tension — l'étape qui manquait.
 *
 * Le reproche était juste : empiler cinq fiches, c'est un dictionnaire. Ce
 * paragraphe ne rédige rien de neuf (il ne le peut pas, il n'y a pas de modèle
 * ici), mais il ORGANISE : il dit quelle fiche est au centre, qui la conteste et
 * sur quelle phrase, qui s'y adosse, ce qui précède, et il nomme ce que le
 * corpus laisse ouvert. Chaque citation est recopiée.
 */
function mettreEnTension(choisis: GroupeFiche[]): string {
  const pivot = choisis[0];
  if (!pivot) return "";

  const morceaux: string[] = [];
  const situation = [libelleAxe(pivot.type, pivot.axe), pivot.sous_domaine].filter(Boolean).join(", ");
  const these = premierePhrase(theseDe(pivot));
  morceaux.push(
    `Le corpus place au centre de cette question « ${pivot.nom} »${situation ? ` (${situation})` : ""}` +
      (these ? ` : ${these}` : ".")
  );

  const contradicteurs = choisis.filter((g) => g.role === "contradiction");
  if (contradicteurs.length > 0) {
    const noms = contradicteurs.map((g) => `« ${g.nom} »`).join(" et ");
    const limite = premierePhrase(limiteDe(pivot));
    morceaux.push(
      `${contradicteurs.length === 1 ? "Une fiche s'y oppose" : `${contradicteurs.length} fiches s'y opposent`}, ` +
        `${noms}, et c'est la fiche pivot elle-même qui les nomme dans ses limites` +
        (limite ? ` : « ${limite} »` : ".")
    );
    for (const c of contradicteurs) {
      const contre = premierePhrase(theseDe(c));
      if (contre) morceaux.push(`Ce que ${`« ${c.nom} »`} oppose, dans ses propres termes : « ${contre} »`);
    }
  } else {
    morceaux.push(
      "Aucune des fiches retenues ne conteste nommément la fiche pivot. Sur une question disputée, c'est un " +
        "signe à prendre au sérieux : soit le corpus n'a pas encore le contradicteur, soit la relation existe " +
        "mais n'est écrite dans aucune fiche."
    );
  }

  const mentions = choisis.filter((g) => g.role === "mention_limites");
  if (mentions.length > 0) {
    morceaux.push(
      `${mentions.map((g) => `« ${g.nom} »`).join(" et ")} ${mentions.length === 1 ? "est nommée" : "sont nommées"} ` +
        "dans les limites de la fiche pivot, mais sans objection formulée : le lien est établi, le désaccord ne " +
        "l'est pas."
    );
  }

  const appuis = choisis.filter((g) => g.role === "appui");
  if (appuis.length > 0) {
    morceaux.push(
      `${appuis.map((g) => `« ${g.nom} »`).join(" et ")} ${appuis.length === 1 ? "s'y adosse" : "s'y adossent"} ` +
        "plutôt que de s'y opposer : leur accord ne vaut donc pas confirmation indépendante."
    );
  }

  const anteriorite = choisis.filter((g) => g.role === "antecedent" || g.role === "posterite");
  for (const a of anteriorite) {
    if (a.relation?.enonce) morceaux.push(a.relation.enonce);
  }

  const autres = choisis.filter((g) => g.role === "autre_discipline");
  if (autres.length > 0) {
    morceaux.push(
      `${autres.map((g) => `« ${g.nom} »`).join(" et ")} ${autres.length === 1 ? "regarde" : "regardent"} le même ` +
        "objet depuis un autre axe du référentiel : la divergence y est disciplinaire avant d'être doctrinale."
    );
  }

  const lexicaux = choisis.filter((g) => g.role === "voisinage_lexical");
  if (lexicaux.length > 0) {
    morceaux.push(
      `${lexicaux.map((g) => `« ${g.nom} »`).join(", ")} ${lexicaux.length === 1 ? "n'a" : "n'ont"} aucun lien ` +
        "documenté avec la fiche pivot : à lire comme un rapprochement de vocabulaire à vérifier, pas comme une " +
        "position sur la question."
    );
  }

  morceaux.push(
    "Ce que le corpus ne tranche pas : il expose les positions et leurs oppositions, il ne dit pas qui a raison. " +
      "Aucune de ces phrases n'a été reformulée — elles sont recopiées des fiches citées."
  );

  return morceaux.join(" ");
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

  const croisements = choisis.map((g) => ({
    fiche: g.nom,
    role: LIBELLE_ROLE[g.role ?? "voisinage_lexical"],
    enonce:
      g.relation?.enonce ??
      (g.role === "pivot"
        ? "Point de départ : la fiche que la recherche place en tête. Les suivantes sont choisies par leur relation à celle-ci."
        : ""),
    preuve: g.relation?.preuve ?? "",
  }));
  const nbRaisonnes = choisis.filter((g) => g.relation).length;
  const nbIntroduites = choisis.filter((g) => g.introduite).length;
  const graphe = etatGraphe();

  const avertissements: string[] = [
    "Réponse EXTRACTIVE : composée depuis les fiches du référentiel, sans modèle génératif. " +
      "Chaque phrase de fond est recopiée d'une fiche — rien n'y est reformulé, donc rien n'y est inventé. " +
      "En contrepartie, elle n'argumente pas et ne tranche pas : elle met en regard ce que le corpus contient.",
  ];

  // Le pivot retenu n'est pas toujours la fiche la mieux classée : quand la
  // première du classement lexical n'a aucun lien avec les autres, elle est
  // écartée du rôle de point de départ. Le lecteur doit le savoir.
  if (choisis[0] && groupes[0] && choisis[0].id !== groupes[0].id) {
    avertissements.push(
      `La fiche la mieux classée par la recherche — « ${groupes[0].nom} » — n'a PAS été prise comme point de ` +
        "départ : elle n'entretient aucun lien documenté avec les autres fiches retrouvées, ce qui est la " +
        `signature d'un faux ami du vocabulaire. C'est « ${choisis[0].nom} », reliée aux autres, qui sert de pivot.`
    );
  }

  if (nbRaisonnes > 0) {
    avertissements.push(
      `Croisement raisonné : ${nbRaisonnes} des ${perspectives.length} perspectives sont retenues pour leur ` +
        "RELATION DOCUMENTÉE à la fiche pivot — contradiction, appui explicite, autre discipline sur le même " +
        "objet, antécédent historique — et non pour leur proximité de vocabulaire. Chaque relation est adossée " +
        "à une phrase du corpus, citée dans la justification de la perspective." +
        (nbIntroduites > 0
          ? ` ${nbIntroduites} d'entre elles n'auraient PAS été trouvées par la recherche lexicale : ` +
            "c'est le graphe de relations qui les a fait entrer."
          : "")
    );
  } else if (graphe.present) {
    avertissements.push(
      "Aucune relation documentée n'a été trouvée entre la fiche pivot et les autres fiches retrouvées : " +
        `les perspectives ci-dessous sont rapprochées par le vocabulaire seul. Le graphe compte ` +
        `${graphe.nb_relations} relations sur le corpus — celle qui manque ici reste à établir.`
    );
  }

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
    `Ce mode met en regard des fiches selon des relations écrites dans le corpus ; il ne TRANCHE pas. ` +
      `Il ne dit pas laquelle des ${perspectives.length} perspectives répond le mieux à la question, ni qui a ` +
      "raison dans les oppositions qu'il expose — il montre le débat et où le lire.",
    graphe.present
      ? `Le graphe de relations est incomplet par construction : ${graphe.nb_relations} relations tissées le ` +
        `${graphe.genere_le}, détectées sur les seules mentions explicites d'une fiche par une autre. Deux ` +
        "fiches qui s'opposent sans se nommer restent invisibles l'une à l'autre."
      : "Le graphe de relations est absent : les perspectives ci-dessous ne sont rapprochées que par le vocabulaire.",
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
    croisements,
    synthese: mettreEnTension(choisis),
  };
}

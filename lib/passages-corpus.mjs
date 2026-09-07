/*
 * Découpage du corpus ATLAS en PASSAGES — source unique, partagée.
 *
 * Pourquoi ce module existe
 * -------------------------
 * Le découpage était écrit dans `scripts/indexer-corpus.mjs` seul, parce que
 * l'index vivait dans Supabase : le serveur relisait les textes en base, il
 * n'avait donc jamais à savoir comment ils avaient été découpés.
 *
 * Depuis que l'index est un fichier versionné (data/index-vectoriel.json), il ne
 * contient plus les textes : uniquement des clés, des empreintes et des vecteurs
 * quantifiés. Le serveur reconstruit les textes depuis `data/seed/` — il doit
 * donc découper EXACTEMENT comme l'indexeur. Deux implémentations de la même
 * règle divergeraient au premier ajout de champ, et la divergence serait
 * silencieuse : des clés qui ne se correspondent plus, donc des passages sans
 * vecteur, donc un moteur qui trouve de moins en moins de matière sans rien
 * signaler. D'où ce module unique, importé des deux côtés — même mécanisme que
 * `lib/embedding-factice.mjs`, déjà importé par `lib/rag.ts`.
 *
 * .mjs et non .ts : `scripts/indexer-corpus.mjs` tourne sous Node nu, sans build
 * ni résolution des alias `@/`. Le typage passe par JSDoc, vérifié par `tsc`
 * grâce à `allowJs` (cf. tsconfig.json).
 *
 * Règle de découpage : un passage = UN CHAMP substantiel d'UNE fiche, jamais une
 * fiche entière. La thèse centrale, l'apport et les limites critiques d'un
 * philosophe répondent à trois questions différentes ; les fondre dans un seul
 * vecteur les moyenne et rend la recherche floue.
 */

import { createHash } from "node:crypto";

/** Longueur maximale d'un passage — garde-fou de format et de coût. */
export const MAX_CARACTERES_PASSAGE = 4000;

/**
 * Seuil de substance : en dessous, le champ est un reste de génération ou un
 * placeholder, pas un contenu interrogeable.
 */
export const MIN_CARACTERES_PASSAGE = 40;

/**
 * @typedef {"humaine" | "ia" | "gap"} TypeFiche
 *
 * @typedef {object} Passage
 * @property {TypeFiche} type_fiche
 * @property {string} fiche_id
 * @property {string} champ
 * @property {string} titre_fiche
 * @property {string} texte      Texte réellement vectorisé (en-tête d'ancrage compris).
 * @property {Record<string, unknown>} metadonnees
 *
 * @typedef {object} Corpus
 * @property {any[]} humaines
 * @property {any[]} ia
 * @property {any[]} gap
 */

const LIBELLES_CHAMP = {
  these_centrale: "thèse centrale",
  apport: "apport",
  limites_critiques: "limites critiques",
  resonance_ia: "résonance avec l'IA",
  capacites_cles: "capacités clés",
  limites_connues: "limites connues",
  apport_ia: "apport de l'IA",
  mecanisme: "mécanisme",
  amelioration_possible: "amélioration possible",
  mode_interaction: "mode d'interaction humain-IA",
  scenario_present: "scénario — situation présente",
  scenario_5ans: "scénario — horizon 5 ans",
  scenario_15_20ans: "scénario — horizon 15 à 20 ans",
  axes_prospectifs: "axes prospectifs",
};

/**
 * Libellé lisible d'un champ de fiche.
 * @param {string} champ
 * @returns {string}
 */
export function libelleChamp(champ) {
  if (LIBELLES_CHAMP[/** @type {keyof typeof LIBELLES_CHAMP} */ (champ)]) {
    return LIBELLES_CHAMP[/** @type {keyof typeof LIBELLES_CHAMP} */ (champ)];
  }
  if (champ.startsWith("usage_")) return `usage sectoriel — ${champ.slice(6).replace(/_/g, " ")}`;
  return champ.replace(/_/g, " ");
}

/**
 * @param {unknown} valeur
 * @returns {string}
 */
function nettoyer(valeur) {
  if (typeof valeur !== "string") return "";
  return valeur.replace(/\s+/g, " ").trim();
}

/**
 * Assemble le texte réellement vectorisé : un en-tête d'ancrage puis le contenu.
 * L'en-tête est indispensable — un extrait isolé du type « Reste une dimension
 * irréductiblement humaine » ne veut rien dire hors de sa fiche, et ne
 * remonterait sur aucune question précise. Il pèse ~25 tokens par passage,
 * c'est le meilleur rapport qualité/prix du pipeline.
 *
 * @param {string} entete
 * @param {string} contenu
 * @returns {string}
 */
function composerTexte(entete, contenu) {
  const texte = `${entete}\n${contenu}`;
  return texte.length > MAX_CARACTERES_PASSAGE
    ? `${texte.slice(0, MAX_CARACTERES_PASSAGE).trimEnd()}…`
    : texte;
}

/**
 * Clé naturelle d'un passage. C'est elle qui relie une entrée de l'index
 * vectoriel au passage reconstruit depuis `data/seed/`.
 *
 * @param {{ type_fiche: string, fiche_id: string, champ: string }} passage
 * @returns {string}
 */
export function clePassage(passage) {
  return `${passage.type_fiche}|${passage.fiche_id}|${passage.champ}`;
}

/**
 * Empreinte de contenu d'un passage — c'est elle qui porte l'idempotence.
 *
 * Le nom du modèle en fait partie : changer de modèle d'embedding invalide donc
 * tout l'index, sans quoi le fichier mélangerait deux espaces vectoriels
 * incomparables. Ce mécanisme est celui d'origine, conservé tel quel.
 *
 * @param {string} texte
 * @param {string} modele
 * @returns {string}
 */
export function empreintePassage(texte, modele) {
  return createHash("sha256").update(`${modele}::${texte}`, "utf8").digest("hex");
}

/**
 * @param {Passage[]} liste
 * @param {{ type_fiche: TypeFiche, fiche_id: string, champ: string, titre_fiche: string, entete: string, contenu: unknown, metadonnees: Record<string, unknown> }} entree
 */
function ajouterPassage(liste, { type_fiche, fiche_id, champ, titre_fiche, entete, contenu, metadonnees }) {
  const propre = nettoyer(contenu);
  if (propre.length < MIN_CARACTERES_PASSAGE) return;
  liste.push({
    type_fiche,
    fiche_id,
    champ,
    titre_fiche,
    texte: composerTexte(entete, propre),
    metadonnees,
  });
}

/**
 * 4 passages par fiche humaine : thèse centrale, apport, limites critiques,
 * résonance IA.
 *
 * @param {any[]} fiches
 * @returns {Passage[]}
 */
export function passagesHumaines(fiches) {
  /** @type {Passage[]} */
  const passages = [];
  for (const fiche of fiches) {
    if (!fiche || typeof fiche.id !== "string") continue;
    const nom = fiche.nom ?? fiche.id;
    const metadonnees = {
      axe: fiche.axe ?? null,
      sous_domaine: fiche.sous_domaine ?? null,
      periode_courant: fiche.periode_courant ?? null,
      statut: fiche.statut ?? null,
      derniere_verification: fiche.derniere_verification ?? null,
      nb_sources: Array.isArray(fiche.sources) ? fiche.sources.length : 0,
    };
    const contexte = [fiche.axe, fiche.sous_domaine, fiche.periode_courant].filter(Boolean).join(", ");
    for (const champ of ["these_centrale", "apport", "limites_critiques", "resonance_ia"]) {
      ajouterPassage(passages, {
        type_fiche: "humaine",
        fiche_id: fiche.id,
        champ,
        titre_fiche: nom,
        entete: `Référentiel A — capacité humaine « ${nom} »${contexte ? ` (${contexte})` : ""} — ${libelleChamp(champ)} :`,
        contenu: fiche[champ],
        metadonnees,
      });
    }
  }
  return passages;
}

/**
 * 2 passages par fiche IA (capacités clés, limites connues) + un par usage
 * sectoriel : « que sait faire l'IA en pharmacie ? » est une question à part
 * entière, elle ne doit pas être noyée dans la fiche du modèle.
 *
 * @param {any[]} fiches
 * @returns {Passage[]}
 */
export function passagesIA(fiches) {
  /** @type {Passage[]} */
  const passages = [];
  for (const fiche of fiches) {
    if (!fiche || typeof fiche.id !== "string") continue;
    const nom = fiche.nom ?? fiche.id;
    const contexte = [fiche.axe, fiche.editeur, fiche.architecture].filter(Boolean).join(", ");
    const metadonnees = {
      axe: fiche.axe ?? null,
      editeur: fiche.editeur ?? null,
      architecture: fiche.architecture ?? null,
      statut: fiche.statut ?? null,
      derniere_verification: fiche.derniere_verification ?? null,
      nb_sources: Array.isArray(fiche.sources) ? fiche.sources.length : 0,
    };

    ajouterPassage(passages, {
      type_fiche: "ia",
      fiche_id: fiche.id,
      champ: "capacites_cles",
      titre_fiche: nom,
      entete: `Référentiel B — capacité IA « ${nom} »${contexte ? ` (${contexte})` : ""} — capacités clés :`,
      contenu: Array.isArray(fiche.capacites_cles) ? fiche.capacites_cles.join(" ; ") : "",
      metadonnees,
    });

    ajouterPassage(passages, {
      type_fiche: "ia",
      fiche_id: fiche.id,
      champ: "limites_connues",
      titre_fiche: nom,
      entete: `Référentiel B — capacité IA « ${nom} »${contexte ? ` (${contexte})` : ""} — limites connues :`,
      contenu: fiche.limites_connues,
      metadonnees,
    });

    for (const usage of Array.isArray(fiche.usages) ? fiche.usages : []) {
      if (!usage || typeof usage.secteur !== "string") continue;
      const exemples = Array.isArray(usage.exemples) ? usage.exemples.join(" ; ") : "";
      ajouterPassage(passages, {
        type_fiche: "ia",
        fiche_id: fiche.id,
        champ: `usage_${usage.secteur}`,
        titre_fiche: nom,
        entete:
          `Référentiel B — capacité IA « ${nom} » — usage sectoriel ${usage.secteur}` +
          `${Number.isFinite(usage.trl) ? ` (TRL ${usage.trl})` : ""} :`,
        contenu: [usage.description, exemples].filter(Boolean).join(" Exemples : "),
        metadonnees: { ...metadonnees, secteur: usage.secteur, trl: usage.trl ?? null },
      });
    }
  }
  return passages;
}

/**
 * Jusqu'à 8 passages par fiche de gap.
 *
 * @param {any[]} fiches
 * @param {Map<string, string>} nomsHumaines
 * @param {Map<string, string>} nomsIA
 * @returns {Passage[]}
 */
export function passagesGap(fiches, nomsHumaines, nomsIA) {
  /** @type {Passage[]} */
  const passages = [];
  for (const gap of fiches) {
    if (!gap || typeof gap.id !== "string") continue;
    const nomH = nomsHumaines.get(gap.fiche_humaine_id) ?? gap.fiche_humaine_id;
    const nomI = nomsIA.get(gap.fiche_ia_id) ?? gap.fiche_ia_id;
    const titre = `${nomH} × ${nomI}`;
    const metadonnees = {
      fiche_humaine_id: gap.fiche_humaine_id ?? null,
      fiche_ia_id: gap.fiche_ia_id ?? null,
      sujet: gap.sujet ?? null,
      substituabilite: gap.substituabilite ?? null,
      confiance: gap.confiance ?? null,
      statut: gap.statut ?? null,
      derniere_verification: gap.derniere_verification ?? null,
    };
    /** @param {string} champ */
    const entete = (champ) =>
      `Gap analysis « ${titre} »${gap.sujet ? ` — sujet : ${gap.sujet}` : ""}` +
      `${gap.substituabilite ? ` (substituabilité : ${String(gap.substituabilite).replace(/_/g, " ")})` : ""}` +
      ` — ${libelleChamp(champ)} :`;

    for (const champ of [
      "apport_ia",
      "mecanisme",
      "amelioration_possible",
      "mode_interaction",
      "scenario_present",
      "scenario_5ans",
      "scenario_15_20ans",
    ]) {
      ajouterPassage(passages, {
        type_fiche: "gap",
        fiche_id: gap.id,
        champ,
        titre_fiche: titre,
        entete: entete(champ),
        contenu: gap[champ],
        metadonnees,
      });
    }

    // Les axes prospectifs sont regroupés en un seul passage : pris isolément,
    // chacun fait deux lignes et se distingue mal des autres ; ensemble ils
    // forment l'« éventail des futurs » de la paire, qui est ce qu'on cherche.
    const axes = Array.isArray(gap.axes_prospectifs) ? gap.axes_prospectifs : [];
    if (axes.length > 0) {
      ajouterPassage(passages, {
        type_fiche: "gap",
        fiche_id: gap.id,
        champ: "axes_prospectifs",
        titre_fiche: titre,
        entete: entete("axes_prospectifs"),
        contenu: axes
          .map((a) => `${a.nom} (${a.niveau_confiance ?? "confiance non précisée"}) : ${a.description}`)
          .join(" | "),
        metadonnees: { ...metadonnees, nb_axes_prospectifs: axes.length },
      });
    }
  }
  return passages;
}

/**
 * Construit TOUS les passages du corpus, dans un ordre stable (humaine, ia, gap,
 * chacun dans l'ordre du fichier source). L'ordre compte : c'est lui qui rend le
 * fichier d'index reproductible d'un lancement à l'autre, donc son diff git
 * lisible.
 *
 * @param {Corpus} corpus
 * @param {{ type?: string | null, surDoublon?: (cles: string[]) => void }} [options]
 * @returns {Passage[]}
 */
export function construirePassages(corpus, options = {}) {
  const filtre = options.type ?? null;
  const nomsHumaines = new Map(corpus.humaines.map((f) => [f.id, f.nom ?? f.id]));
  const nomsIA = new Map(corpus.ia.map((f) => [f.id, f.nom ?? f.id]));

  /** @type {Passage[]} */
  let passages = [];
  if (filtre === null || filtre === "humaine") passages.push(...passagesHumaines(corpus.humaines));
  if (filtre === null || filtre === "ia") passages.push(...passagesIA(corpus.ia));
  if (filtre === null || filtre === "gap") passages.push(...passagesGap(corpus.gap, nomsHumaines, nomsIA));

  // Garde-fou : deux fiches ne doivent jamais partager (type, id, champ), sinon
  // deux vecteurs différents porteraient la même clé dans l'index.
  const vues = new Set();
  /** @type {string[]} */
  const doublons = [];
  passages = passages.filter((p) => {
    const cle = clePassage(p);
    if (vues.has(cle)) {
      doublons.push(cle);
      return false;
    }
    vues.add(cle);
    return true;
  });
  if (doublons.length > 0 && options.surDoublon) options.surDoublon(doublons);
  return passages;
}

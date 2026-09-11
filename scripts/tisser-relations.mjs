/*
 * Tisseur de relations — le graphe qui rend le croisement RAISONNÉ.
 *
 * Pourquoi ce script existe
 * -------------------------
 * Jusqu'ici, deux fiches se retrouvaient côte à côte dans une réponse parce que
 * leur vocabulaire recouvrait celui de la question. C'est un croisement
 * MATHÉMATIQUE : rien ne dit que les deux fiches parlent du même objet, ni
 * qu'elles se contredisent, ni que l'une s'appuie sur l'autre. La justification
 * affichée le disait honnêtement — « cette perspective n'est pas raisonnée » —
 * mais l'honnêteté ne remplace pas le raisonnement.
 *
 * Ce script construit la matière qui manque : un graphe de relations TYPÉES
 * entre fiches, chacune adossée à une PREUVE TEXTUELLE prise dans le corpus.
 * Une relation n'existe que si une phrase d'une fiche la porte. Aucune relation
 * n'est inférée d'une proximité de vecteurs.
 *
 * Les six types de relations
 * --------------------------
 *   conteste        A nomme B dans ses LIMITES CRITIQUES, et la phrase porte une
 *                   marque d'opposition (conteste, réfute, en tension, débat…).
 *                   Preuve : la phrase de A qui nomme B.
 *   mention         A nomme B dans ses LIMITES CRITIQUES, mais SANS marque
 *                   d'opposition — ou avec une marque qui la nie
 *                   explicitement (« aucune réfutation… au contraire »).
 *                   Le lien existe, le désaccord n'est pas établi.
 *   mobilise        A nomme B dans sa THÈSE ou son APPORT. A s'appuie sur B.
 *   source_commune  A et B citent la même source. Leur accord éventuel pèse
 *                   moins lourd qu'il n'en a l'air — c'est la même preuve.
 *   succession      A et B traitent le même sous-domaine, à deux périodes
 *                   consécutives. A vient après B.
 *   resonance       une fiche humaine nomme un système d'IA dans son champ
 *                   « résonance IA ».
 *   couple          une fiche de gap relie explicitement une fiche humaine et
 *                   une fiche IA. Relation déclarée, pas détectée.
 *
 * Ce qui n'est PAS matérialisé ici
 * --------------------------------
 * « Même objet vu par une autre discipline » (même sous-domaine, axe différent)
 * se calcule en une passe sur le corpus au moment de répondre : le matérialiser
 * produirait des dizaines de milliers d'arêtes sans rien apprendre.
 *
 * Usage
 * -----
 *   node scripts/tisser-relations.mjs             écrit data/relations-corpus.json
 *   node scripts/tisser-relations.mjs --verifier  ne réécrit rien, sort 1 si le
 *                                                 fichier n'est plus à jour
 *   node scripts/tisser-relations.mjs --montre=democratie-liberale
 *   node scripts/tisser-relations.mjs --json
 *
 * Codes de sortie : 0 tout va bien · 1 graphe périmé (--verifier) · 2 erreur.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const RACINE = new URL("..", import.meta.url).pathname;
const SEED = join(RACINE, "data/seed");
const SORTIE = join(RACINE, "data/relations-corpus.json");

/** Version du tisseur. Change dès que la détection change : le garde-fou le voit. */
export const MODELE_RELATIONS = "relations-corpus-v2";

/* -------------------------------------------------------------------------- */
/* Lecture du corpus                                                          */
/* -------------------------------------------------------------------------- */

function lireJson(chemin) {
  const brut = JSON.parse(readFileSync(chemin, "utf8"));
  return Array.isArray(brut) ? brut : (brut.fiches ?? []);
}

export function lireCorpus(seed = SEED) {
  const dossier = join(seed, "fiches_humaines");
  const humaines = readdirSync(dossier)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => lireJson(join(dossier, f)));
  return {
    humaines,
    ia: lireJson(join(seed, "fiches_ia.json")),
    gaps: lireJson(join(seed, "fiches_gap.json")),
  };
}

/* -------------------------------------------------------------------------- */
/* Normalisation et désignations                                              */
/* -------------------------------------------------------------------------- */

/** Minuscules, sans accents, ponctuation ramenée à l'espace. Sert aux comparaisons. */
export function aplatir(texte) {
  return String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Mots qui ne peuvent JAMAIS servir à reconnaître une fiche, même s'ils
 * composent son nom : trop communs, ils feraient des relations partout.
 * « Démocratie libérale » reste reconnaissable par son nom entier ; c'est le
 * mot « démocratie » seul qui est écarté.
 */
const MOTS_TROP_COMMUNS = new Set(
  (
    "ia intelligence artificielle modele modeles systeme systemes theorie theories ecole ecoles " +
    "approche approches methode methodes science sciences social sociale societe humain humaine " +
    "economie economique politique politiques culture culturelle histoire historique moderne " +
    "contemporain classique general generale grand grande nouveau nouvelle etat etats " +
    "democratie liberalisme capitalisme travail marche croissance developpement education sante " +
    "droit droits pouvoir pouvoirs groupe groupes individu individus reseau reseaux donnees " +
    "apprentissage langue langage texte image agent agents outil outils"
  ).split(" ")
);

/**
 * Désignations par lesquelles une fiche peut être nommée dans le texte d'une
 * autre. Le nom complet toujours ; le patronyme seul quand le nom est un nom de
 * personne (« Friedrich Nietzsche » → « nietzsche ») ; jamais un mot commun.
 *
 * Une désignation doit faire au moins 5 caractères : en dessous, les collisions
 * l'emportent (« Mao » attrape « maoïsme », « chaos », « maori »).
 */
export function designations(nom) {
  const brut = String(nom ?? "").trim();
  const plat = aplatir(brut);
  if (!plat) return [];
  const sorties = new Set();
  if (plat.length >= 5) sorties.add(plat);

  const motsBruts = brut.split(/\s+/).filter(Boolean);
  const motsPlats = plat.split(" ").filter(Boolean);
  if (motsBruts.length > 1 && motsPlats.length === motsBruts.length) {
    const dernierBrut = motsBruts[motsBruts.length - 1];
    const dernierPlat = motsPlats[motsPlats.length - 1];
    // Le dernier mot ne désigne la fiche À LUI SEUL que si c'est un nom propre :
    // majuscule initiale dans le nom d'origine. Sans ce test, « Monarchie
    // constitutionnelle » se reconnaissait dans « protection constitutionnelle »
    // et « Démocratie libérale » dans « l'aile libérale de l'élite » — deux
    // relations fausses, mesurées sur le corpus.
    const nomPropre = dernierBrut[0] === dernierBrut[0].toLocaleUpperCase("fr") && dernierBrut[0] !== dernierBrut[0].toLocaleLowerCase("fr");
    if (nomPropre && dernierPlat.length >= 5 && !MOTS_TROP_COMMUNS.has(dernierPlat)) sorties.add(dernierPlat);
  }
  return [...sorties].filter((d) => !MOTS_TROP_COMMUNS.has(d));
}

/**
 * Cherche une désignation dans un texte, sur frontière de mot.
 * Renvoie la phrase qui la porte — la preuve — ou null.
 */
export function phrasePreuve(texte, designation) {
  const brut = String(texte ?? "");
  if (!brut) return null;
  // Découpage en phrases sur le texte BRUT, pour rendre une preuve lisible.
  const phrases = brut.split(/(?<=[.!?;])\s+/);
  for (let i = 0; i < phrases.length; i += 1) {
    const plat = ` ${aplatir(phrases[i])} `;
    if (!plat.includes(` ${designation} `)) continue;
    let preuve = phrases[i].trim();
    // Le découpage tombe parfois au milieu d'une incise (« …débats Mouffe/Rawls
    // en philosophie politique). »). Une preuve qui commence en minuscule ou qui
    // tient en moins de 60 signes ne se lit pas seule : on lui rend sa phrase
    // précédente.
    if (i > 0 && (preuve.length < 60 || preuve[0] !== preuve[0].toLocaleUpperCase("fr"))) {
      preuve = `${phrases[i - 1].trim()} ${preuve}`;
    }
    return preuve;
  }
  return null;
}

/**
 * Rejette un patronyme porté par quelqu'un d'autre.
 *
 * « Achille Mbembe » nomme « Felix Klein, commissaire du gouvernement fédéral à
 * l'antisémitisme » : le patronyme « klein » rattachait la fiche à « Mélanie
 * Klein », psychanalyste, qui n'a rien à voir. La règle : si l'occurrence est
 * précédée d'un prénom (mot capitalisé) qui n'est PAS celui de la fiche visée,
 * ce n'est pas la bonne personne.
 *
 * Ne s'applique qu'aux désignations par patronyme seul : un nom complet trouvé
 * en entier ne souffre pas de cette ambiguïté.
 */
export function bonPorteur(preuve, designation, nomCible) {
  const motsCible = aplatir(nomCible).split(" ").filter(Boolean);
  if (motsCible.length < 2) return true;
  if (designation === aplatir(nomCible)) return true;
  if (designation !== motsCible[motsCible.length - 1]) return true;

  const prenomsCible = new Set(motsCible.slice(0, -1));
  const mots = String(preuve).split(/\s+/);
  let vuIsole = false;
  for (let i = 0; i < mots.length; i += 1) {
    if (aplatir(mots[i]).replace(/ /g, "") !== designation) continue;
    const precedent = i > 0 ? mots[i - 1].replace(/[^\p{L}'-]/gu, "") : "";
    const platPrecedent = aplatir(precedent);
    const capitalise =
      precedent.length > 1 &&
      precedent[0] === precedent[0].toLocaleUpperCase("fr") &&
      precedent[0] !== precedent[0].toLocaleLowerCase("fr");
    // Précédé d'un prénom étranger à la fiche : mauvais porteur, on continue de
    // chercher une autre occurrence dans la même phrase.
    if (capitalise && platPrecedent && !prenomsCible.has(platPrecedent)) continue;
    vuIsole = true;
    break;
  }
  return vuIsole;
}

/* -------------------------------------------------------------------------- */
/* Périodes                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Année médiane d'un champ `periode_courant` libre (« Proche du
 * post-structuralisme, étiquette qu'il récusait, 1961-1984 »).
 * Renvoie null si aucune année à quatre chiffres n'y figure.
 */
export function anneeMediane(periode) {
  const annees = String(periode ?? "")
    .match(/\b(1[0-9]{3}|20[0-9]{2})\b/g)
    ?.map(Number)
    .filter((a) => a >= 1000 && a <= 2100);
  if (!annees || annees.length === 0) return null;
  annees.sort((a, b) => a - b);
  return Math.round((annees[0] + annees[annees.length - 1]) / 2);
}

/* -------------------------------------------------------------------------- */
/* Sources                                                                    */
/* -------------------------------------------------------------------------- */

/** Clé d'identité d'une source : l'URL normalisée si elle existe, sinon le titre aplati. */
export function cleSource(source) {
  if (!source || typeof source !== "object") return null;
  const url = typeof source.url === "string" ? source.url.trim() : "";
  if (url) {
    try {
      const u = new URL(url);
      return `url:${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
    } catch {
      /* URL malformée : on retombe sur le titre. */
    }
  }
  const titre = aplatir(source.titre);
  return titre.length >= 8 ? `titre:${titre}` : null;
}

/**
 * Une source citée par un très grand nombre de fiches ne prouve pas une parenté :
 * elle prouve qu'elle est générique. Au-delà de ce seuil, elle ne crée plus
 * d'arête.
 */
const MAX_FICHES_PAR_SOURCE = 6;

/* -------------------------------------------------------------------------- */
/* Construction du graphe                                                     */
/* -------------------------------------------------------------------------- */

/** Champs fouillés pour les relations nominatives, et le type qu'ils portent. */
const CHAMPS_NOMINATIFS = [
  { champ: "limites_critiques", type: "conteste" },
  { champ: "these_centrale", type: "mobilise" },
  { champ: "apport", type: "mobilise" },
];

/**
 * Marques d'opposition. Être nommé dans le champ « limites critiques » ne suffit
 * pas à établir un désaccord : la fiche « Aaron Cicourel » y écrit « Aucune
 * réfutation nommément attribuée n'a été trouvée : Robin James Smith et Paul
 * Atkinson présentent AU CONTRAIRE cette critique comme fondatrice ». Classer
 * cela en « conteste » était un contresens — et le plus grave possible, puisque
 * la réponse le présentait ensuite comme la contradiction de la question.
 *
 * Une phrase ne fonde une contestation que si elle porte une de ces marques.
 * Sinon la relation existe quand même, mais comme simple MENTION.
 */
const MARQUES_OPPOSITION = [
  "conteste",
  "contestee",
  "contestation",
  "critique",
  "critiquee",
  "reproche",
  "objecte",
  "objection",
  "refute",
  "refutation",
  "refuse",
  "recuse",
  "s oppose",
  "oppose",
  "en tension",
  "en desaccord",
  "desaccord",
  "controverse",
  "debat",
  "debats",
  "polemique",
  "remet en cause",
  "met en cause",
  "infirme",
  "invalide",
  "limite de",
  "insuffisant",
];

/** Marques qui NIENT l'opposition : elles l'emportent sur les précédentes. */
const MARQUES_NEGATION = [
  "aucune refutation",
  "aucune critique",
  "au contraire",
  "n a ete trouvee",
  "n a pas ete trouvee",
  "fondatrice",
  "prolongee par",
  "prolonge par",
  "dans la continuite",
];

/**
 * Le type réellement porté par une phrase du champ « limites critiques ».
 * Renvoie « conteste » ou « mention ».
 */
export function typeDepuisPreuve(preuve) {
  const p = ` ${aplatir(preuve)} `;
  for (const marque of MARQUES_NEGATION) if (p.includes(` ${marque} `) || p.includes(`${marque} `)) return "mention";
  for (const marque of MARQUES_OPPOSITION) if (p.includes(` ${marque}`)) return "conteste";
  return "mention";
}

/** Plafond d'arêtes nominatives sortantes par fiche et par type. */
const MAX_ARETES_PAR_FICHE = 8;

export function tisser(corpus) {
  const relations = [];
  const ajouter = (r) => relations.push(r);

  const humaines = corpus.humaines;
  const ia = corpus.ia;

  /* --- Index des désignations -------------------------------------------- */
  // Une désignation ambiguë (portée par deux fiches) est écartée : on ne peut
  // pas dire laquelle est nommée, donc on ne dit rien.
  const parDesignation = new Map();
  for (const entree of [
    ...humaines.map((f) => ({ t: "humaine", f })),
    ...ia.map((f) => ({ t: "ia", f })),
  ]) {
    for (const d of designations(entree.f.nom)) {
      if (!parDesignation.has(d)) parDesignation.set(d, []);
      parDesignation.get(d).push({ type: entree.t, id: entree.f.id, nom: entree.f.nom });
    }
  }
  for (const [d, cibles] of [...parDesignation]) if (cibles.length > 1) parDesignation.delete(d);

  /* --- 1 & 2. conteste / mobilise (fiches humaines) ----------------------- */
  for (const fiche of humaines) {
    const comptes = new Map();
    for (const { champ, type } of CHAMPS_NOMINATIFS) {
      const texte = fiche[champ];
      if (typeof texte !== "string" || !texte) continue;
      const plat = ` ${aplatir(texte)} `;
      for (const [designation, cibles] of parDesignation) {
        if (!plat.includes(` ${designation} `)) continue;
        const cible = cibles[0];
        if (cible.type === "humaine" && cible.id === fiche.id) continue;
        const deja = comptes.get(type) ?? 0;
        if (deja >= MAX_ARETES_PAR_FICHE) continue;
        const preuve = phrasePreuve(texte, designation);
        if (!preuve) continue;
        if (!bonPorteur(preuve, designation, cible.nom)) continue;
        comptes.set(type, deja + 1);
        ajouter({
          type: type === "conteste" ? typeDepuisPreuve(preuve) : type,
          de: { type: "humaine", id: fiche.id },
          vers: { type: cible.type, id: cible.id },
          champ,
          designation,
          preuve,
        });
      }
    }
  }

  /* --- 3. resonance (humaine → IA, champ resonance_ia) -------------------- */
  for (const fiche of humaines) {
    const texte = fiche.resonance_ia;
    if (typeof texte !== "string" || !texte) continue;
    const plat = ` ${aplatir(texte)} `;
    let compte = 0;
    for (const [designation, cibles] of parDesignation) {
      if (cibles[0].type !== "ia") continue;
      if (!plat.includes(` ${designation} `)) continue;
      if (compte >= MAX_ARETES_PAR_FICHE) break;
      const preuve = phrasePreuve(texte, designation);
      if (!preuve) continue;
      if (!bonPorteur(preuve, designation, cibles[0].nom)) continue;
      compte += 1;
      ajouter({
        type: "resonance",
        de: { type: "humaine", id: fiche.id },
        vers: { type: "ia", id: cibles[0].id },
        champ: "resonance_ia",
        designation,
        preuve,
      });
    }
  }

  /* --- 4. couple (déclaré par les fiches de gap) -------------------------- */
  for (const gap of corpus.gaps) {
    if (!gap.fiche_humaine_id || !gap.fiche_ia_id) continue;
    ajouter({
      type: "couple",
      de: { type: "humaine", id: gap.fiche_humaine_id },
      vers: { type: "ia", id: gap.fiche_ia_id },
      champ: "fiche_gap",
      designation: gap.id,
      preuve:
        typeof gap.mecanisme === "string" && gap.mecanisme
          ? gap.mecanisme
          : `Paire documentée par la fiche de gap « ${gap.id} ».`,
    });
  }

  /* --- 5. source_commune -------------------------------------------------- */
  const parSource = new Map();
  const toutes = [
    ...humaines.map((f) => ({ type: "humaine", f })),
    ...ia.map((f) => ({ type: "ia", f })),
  ];
  for (const { type, f } of toutes) {
    for (const s of Array.isArray(f.sources) ? f.sources : []) {
      const cle = cleSource(s);
      if (!cle) continue;
      if (!parSource.has(cle)) parSource.set(cle, { titre: s.titre ?? cle, fiches: [] });
      parSource.get(cle).fiches.push({ type, id: f.id });
    }
  }
  for (const [cle, { titre, fiches }] of parSource) {
    const uniques = [...new Map(fiches.map((x) => [`${x.type}:${x.id}`, x])).values()];
    if (uniques.length < 2 || uniques.length > MAX_FICHES_PAR_SOURCE) continue;
    for (let i = 0; i < uniques.length; i += 1) {
      for (let j = i + 1; j < uniques.length; j += 1) {
        ajouter({
          type: "source_commune",
          de: uniques[i],
          vers: uniques[j],
          champ: "sources",
          designation: cle,
          preuve: `Les deux fiches citent « ${titre} ».`,
        });
      }
    }
  }

  /* --- 6. succession (même sous-domaine, périodes consécutives) ----------- */
  const parSousDomaine = new Map();
  for (const f of humaines) {
    const annee = anneeMediane(f.periode_courant);
    if (annee === null) continue;
    const cle = `${f.axe}/${f.sous_domaine}`;
    if (!parSousDomaine.has(cle)) parSousDomaine.set(cle, []);
    parSousDomaine.get(cle).push({ id: f.id, nom: f.nom, annee, periode: f.periode_courant });
  }
  for (const liste of parSousDomaine.values()) {
    if (liste.length < 2) continue;
    liste.sort((a, b) => a.annee - b.annee);
    for (let i = 1; i < liste.length; i += 1) {
      const apres = liste[i];
      const avant = liste[i - 1];
      if (apres.annee === avant.annee) continue;
      ajouter({
        type: "succession",
        de: { type: "humaine", id: apres.id },
        vers: { type: "humaine", id: avant.id },
        champ: "periode_courant",
        designation: `${apres.annee}/${avant.annee}`,
        preuve: `« ${apres.nom} » (${apres.periode}) vient après « ${avant.nom} » (${avant.periode}) dans le même sous-domaine.`,
      });
    }
  }

  return relations;
}

/* -------------------------------------------------------------------------- */
/* Empreinte et écriture                                                      */
/* -------------------------------------------------------------------------- */

const SEP = String.fromCharCode(0);

/** Empreinte du corpus sur les seuls champs qui entrent dans la détection. */
export function empreinteCorpus(corpus) {
  const h = createHash("sha256");
  h.update(MODELE_RELATIONS);
  for (const f of corpus.humaines) {
    h.update(
      [f.id, f.nom, f.axe, f.sous_domaine, f.these_centrale, f.apport, f.limites_critiques, f.resonance_ia, f.periode_courant]
        .map((x) => String(x ?? ""))
        .join(SEP)
    );
    for (const s of Array.isArray(f.sources) ? f.sources : []) h.update(`s:${cleSource(s) ?? ""}`);
  }
  for (const f of corpus.ia) {
    h.update([f.id, f.nom, f.axe].map((x) => String(x ?? "")).join(SEP));
    for (const s of Array.isArray(f.sources) ? f.sources : []) h.update(`s:${cleSource(s) ?? ""}`);
  }
  for (const g of corpus.gaps) h.update(`g:${g.id}:${g.fiche_humaine_id}:${g.fiche_ia_id}`);
  return h.digest("hex").slice(0, 32);
}

function compter(relations) {
  const c = {};
  for (const r of relations) c[r.type] = (c[r.type] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]));
}

/**
 * Une même paire ne porte qu'une arête par type. Deux champs de la même fiche
 * peuvent nommer la même cible (thèse ET apport) : c'est une seule relation,
 * pas deux. On garde la preuve la plus longue — la plus explicite.
 */
export function dedoublonner(relations) {
  const parCle = new Map();
  for (const r of relations) {
    const cle = `${r.type}|${r.de.type}:${r.de.id}|${r.vers.type}:${r.vers.id}`;
    const existante = parCle.get(cle);
    if (!existante || String(r.preuve).length > String(existante.preuve).length) parCle.set(cle, r);
  }
  return [...parCle.values()];
}

function construire() {
  const corpus = lireCorpus();
  const relations = dedoublonner(tisser(corpus));
  return {
    modele: MODELE_RELATIONS,
    empreinte_corpus: empreinteCorpus(corpus),
    genere_le: new Date().toISOString().slice(0, 10),
    nb_fiches: corpus.humaines.length + corpus.ia.length,
    compte_par_type: compter(relations),
    relations: relations.sort(
      (a, b) =>
        a.type.localeCompare(b.type) ||
        `${a.de.type}:${a.de.id}`.localeCompare(`${b.de.type}:${b.de.id}`) ||
        `${a.vers.type}:${a.vers.id}`.localeCompare(`${b.vers.type}:${b.vers.id}`)
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Entrée en ligne de commande                                                */
/* -------------------------------------------------------------------------- */

function principal() {
  const args = process.argv.slice(2);
  const montre = args.find((a) => a.startsWith("--montre="))?.split("=")[1];

  if (montre) {
    if (!existsSync(SORTIE)) {
      console.error("Graphe absent. Lancer : node scripts/tisser-relations.mjs");
      process.exit(2);
    }
    const g = JSON.parse(readFileSync(SORTIE, "utf8"));
    const liees = g.relations.filter((r) => r.de.id === montre || r.vers.id === montre);
    console.log(`${liees.length} relation(s) pour « ${montre} »\n`);
    for (const r of liees) {
      const sens = r.de.id === montre ? `-> ${r.vers.id}` : `<- ${r.de.id}`;
      console.log(`[${r.type}] ${sens}\n    ${r.preuve}\n`);
    }
    return;
  }

  const graphe = construire();

  if (args.includes("--verifier")) {
    if (!existsSync(SORTIE)) {
      console.error("✗ data/relations-corpus.json est absent. Lancer : npm run tisser");
      process.exit(1);
    }
    const enregistre = JSON.parse(readFileSync(SORTIE, "utf8"));
    if (enregistre.modele !== graphe.modele) {
      console.error(
        `✗ Graphe tissé par « ${enregistre.modele} », le tisseur est en « ${graphe.modele} ». Relancer : npm run tisser`
      );
      process.exit(1);
    }
    if (enregistre.empreinte_corpus !== graphe.empreinte_corpus) {
      console.error("✗ Le corpus a changé depuis le dernier tissage. Relancer : npm run tisser");
      process.exit(1);
    }
    console.log(`✓ Graphe de relations à jour : ${enregistre.relations.length} relations sur ${enregistre.nb_fiches} fiches.`);
    return;
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify({ ...graphe, relations: undefined }, null, 2));
    return;
  }

  writeFileSync(SORTIE, `${JSON.stringify(graphe, null, 1)}\n`, "utf8");
  console.log(`✓ ${graphe.relations.length} relations tissées sur ${graphe.nb_fiches} fiches -> data/relations-corpus.json`);
  for (const [type, n] of Object.entries(graphe.compte_par_type)) console.log(`    ${type.padEnd(16)} ${n}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    principal();
  } catch (erreur) {
    console.error(`Erreur : ${erreur.message}`);
    process.exit(2);
  }
}

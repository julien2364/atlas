/*
 * MP-7 — Étape 1 de la boucle de veille : PROPOSER des patchs de fiche.
 *
 * Rôle dans le projet
 * -------------------
 * La promesse du référentiel ATLAS est d'être vivant : la veille collecte, un humain
 * arbitre, les fiches évoluent, le changelog en garde la trace. Jusqu'ici la chaîne
 * s'arrêtait à la collecte — `scripts/veille-rss.mjs` et
 * `scripts/documentation-recherche.mjs` remplissent `data/seed/veille_queue.json`,
 * mais rien ne redescendait jamais dans les fiches. Ce script est le chaînon manquant
 * côté proposition : il traduit chaque proposition qualifiée de la file en un PATCH
 * explicite (quelle fiche, quel champ, quel texte, quelle source), relisible par un
 * humain ou par une session Claude, et applicable ensuite par
 * `scripts/appliquer-patchs.mjs`.
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ AUCUNE FICHE N'EST MODIFIÉE PAR CE SCRIPT. IL N'ÉCRIT QUE LE FICHIER DE     │
 * │ PATCHS. Le script propose, l'humain dispose : rien ne descend dans          │
 * │ data/seed/ sans une relecture puis un lancement explicite de                │
 * │ scripts/appliquer-patchs.mjs.                                              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Usage
 * -----
 *   node scripts/appliquer-veille.mjs
 *   node scripts/appliquer-veille.mjs --limite=5
 *   node scripts/appliquer-veille.mjs --statut=a_traiter_fiche_existante
 *   node scripts/appliquer-veille.mjs --sortie=/tmp/patchs.json
 *   node scripts/appliquer-veille.mjs --aide
 *
 * Code de sortie : 0 même quand aucun patch n'est produit (ce n'est pas une panne,
 * juste une file vide) ; 1 seulement si le corpus ou la file sont illisibles.
 *
 * Les deux formes de `contenu_propose` — c'est le point délicat
 * -------------------------------------------------------------
 * La file mélange deux producteurs, et une proposition ne se lit pas de la même façon
 * selon son origine :
 *
 *   forme « wikipedia » (scripts/documentation-recherche.mjs)
 *     { nom, titre_article_source, langue_source, extrait, url, note }
 *     → un résumé encyclopédique brut, en français ou en anglais, écrit pour une
 *       encyclopédie et pas pour ce référentiel. Il ne se publie JAMAIS tel quel :
 *       ce n'est ni une thèse centrale, ni un apport, ni une limite critique, et il
 *       n'est pas sourcé au niveau d'exigence du projet. Le patch le porte donc en
 *       nature "a_reformuler".
 *
 *   forme « rss » (scripts/veille-rss.mjs)
 *     { titre, link, date, resume }
 *     → une actualité. Le `resume` est de la prose d'éditeur (souvent promotionnelle,
 *       souvent en anglais) : lui non plus ne se publie pas. En revanche l'item porte
 *       une chose parfaitement objective et vérifiable : une URL datée qui documente
 *       un fait nouveau. C'est cela, et cela seul, qui peut descendre dans une fiche
 *       sans réécriture — sous forme d'ajout de source.
 *
 * D'où la distinction structurante du fichier de patchs :
 *
 *   nature "sur"           = l'opération est mécanique et vérifiable (ajout d'une
 *                            source primaire datée à une fiche existante). Un humain
 *                            valide, mais il n'a rien à réécrire.
 *   nature "a_reformuler"  = il y a du texte à produire par un humain (ou une session
 *                            Claude) avant toute publication. Le patch transporte la
 *                            matière première et le champ visé, jamais un texte final.
 *                            scripts/appliquer-patchs.mjs refuse ces patchs sauf
 *                            drapeau explicite --inclure-a-reformuler.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---------------------------------------------------------------------------
// Arguments & configuration
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function argTexte(nom, defaut) {
  const brut = args.find((a) => a.startsWith(`--${nom}=`));
  if (brut === undefined) return defaut;
  return brut.split("=").slice(1).join("=");
}

function argNombre(nom, defaut) {
  const brut = argTexte(nom, undefined);
  if (brut === undefined) return defaut;
  const valeur = Number(brut);
  if (!Number.isFinite(valeur) || valeur <= 0) {
    console.warn(`Valeur invalide pour --${nom} ("${brut}") — valeur par défaut utilisée.`);
    return defaut;
  }
  return valeur;
}

if (args.includes("--aide") || args.includes("-h") || args.includes("--help")) {
  console.log(`
appliquer-veille.mjs — propose des patchs de fiche à partir de la file de veille.

  --limite=N     nombre maximum de propositions traitées (défaut : toutes)
  --statut=...   statut des propositions à lire (défaut : a_traiter_fiche_existante)
  --sortie=...   chemin du fichier de patchs produit
                 (défaut : data/patchs/patchs-veille-AAAA-MM-JJ.json)
  --racine=...   racine du dépôt à lire (défaut : dossier parent de scripts/)
  --aide         ce message

Ce script n'écrit QUE le fichier de patchs. Aucune fiche n'est modifiée : la
publication passe obligatoirement par une relecture humaine puis par
scripts/appliquer-patchs.mjs.
`);
  process.exit(0);
}

// Racine résolue depuis l'emplacement du script (et non depuis le cwd) : les crons
// GitHub ne lancent pas forcément la commande depuis la racine du dépôt.
// Même convention que scripts/valider-donnees.mjs.
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = argTexte("racine", path.resolve(ICI, ".."));
const SEED = path.join(RACINE, "data", "seed");

const STATUT_LU = argTexte("statut", "a_traiter_fiche_existante");
const LIMITE = argNombre("limite", Infinity);
const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const SORTIE = path.resolve(
  RACINE,
  argTexte("sortie", path.join("data", "patchs", `patchs-veille-${AUJOURDHUI}.json`))
);

// Au-delà de ce score, la source est considérée comme primaire (labs officiels,
// arXiv, Nature…) — c'est le barème posé par scripts/veille-rss.mjs (0.9 vs 0.6).
const SEUIL_SOURCE_PRIMAIRE = 0.8;

// Longueur d'extrait de l'existant recopiée dans le patch : assez pour que le
// relecteur voie ce qu'il remplacerait, pas assez pour noyer le fichier de patchs.
const EXTRAIT_ACTUEL = 400;

const RAPPEL_GARDE_FOU =
  "AUCUNE FICHE N'EST MODIFIÉE AUTOMATIQUEMENT. Ce fichier est une PROPOSITION : " +
  "relire, passer `retenu: false` sur ce qui est écarté, corriger les textes marqués " +
  "« a_reformuler », puis lancer scripts/appliquer-patchs.mjs. Le script propose, l'humain dispose.";

// ---------------------------------------------------------------------------
// Lecture du corpus — index id → { fiche, fichier, type }
// ---------------------------------------------------------------------------

function lireJSON(chemin) {
  return JSON.parse(readFileSync(chemin, "utf-8"));
}

/**
 * Index de toutes les fiches par id, pour retrouver en O(1) le fichier qui porte une
 * cible. Les fiches humaines sont éclatées en six fichiers par axe : sans cet index,
 * chaque patch obligerait à rouvrir tout le référentiel.
 */
function indexerCorpus() {
  const index = new Map();

  const dossierHumaines = path.join(SEED, "fiches_humaines");
  if (existsSync(dossierHumaines)) {
    for (const nom of readdirSync(dossierHumaines).filter((f) => f.endsWith(".json")).sort()) {
      const relatif = path.join("data", "seed", "fiches_humaines", nom);
      for (const fiche of lireJSON(path.join(dossierHumaines, nom))) {
        if (fiche?.id && !index.has(fiche.id)) index.set(fiche.id, { fiche, fichier: relatif, type: "fiche_humaine" });
      }
    }
  }

  for (const [nom, type] of [
    ["fiches_ia.json", "fiche_ia"],
    ["fiches_gap.json", "fiche_gap"],
  ]) {
    const chemin = path.join(SEED, nom);
    if (!existsSync(chemin)) continue;
    for (const fiche of lireJSON(chemin)) {
      if (fiche?.id && !index.has(fiche.id)) {
        index.set(fiche.id, { fiche, fichier: path.join("data", "seed", nom), type });
      }
    }
  }

  return index;
}

// ---------------------------------------------------------------------------
// Petits utilitaires
// ---------------------------------------------------------------------------

function chaineRemplie(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function urlValide(v) {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Comparaison d'URL tolérante (schéma, www, slash final) pour détecter un doublon. */
function normaliserUrl(u) {
  if (!chaineRemplie(u)) return "";
  return u.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

/**
 * Une URL d'agrégateur (Google News) n'est pas une source citable : c'est une
 * redirection opaque et périssable vers l'éditeur réel. On peut la proposer, mais
 * jamais comme opération « sûre » — il faut d'abord retrouver l'URL d'origine.
 */
function estAgregateur(u) {
  return /(^|\/\/|\.)news\.google\.com\//i.test(u ?? "");
}

/** Chemin affiché relatif à la racine quand c'est lisible, absolu sinon. */
function afficherChemin(chemin) {
  const relatif = path.relative(RACINE, chemin);
  return relatif.startsWith("..") ? chemin : relatif;
}

function tronquer(texte, n) {
  if (!chaineRemplie(texte)) return null;
  const t = texte.trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

/** Date de source : on garde l'ISO complet quand il est là, jamais de date inventée. */
function dateSource(brut) {
  if (!chaineRemplie(brut)) return undefined;
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? undefined : brut;
}

/** Reconnaissance de la forme de `contenu_propose` — cf. en-tête du fichier. */
function formeProposition(contenu) {
  if (!contenu || typeof contenu !== "object") return "inconnue";
  if (chaineRemplie(contenu.extrait)) return "wikipedia";
  if (chaineRemplie(contenu.link) || chaineRemplie(contenu.titre)) return "rss";
  return "inconnue";
}

/**
 * Champ rédactionnel visé par une reformulation, selon le référentiel de la cible.
 * On vise volontairement le champ le plus structurant de la fiche : c'est celui que
 * le relecteur devra de toute façon reprendre s'il intègre la matière.
 */
function champReformulation(typeFiche) {
  if (typeFiche === "fiche_ia") return "limites_connues";
  if (typeFiche === "fiche_gap") return "apport_ia";
  return "these_centrale";
}

// ---------------------------------------------------------------------------
// Construction d'un patch
// ---------------------------------------------------------------------------

/**
 * Traduit une proposition en patch, ou renvoie { ignoree, raison } quand la
 * proposition n'est pas exploitable telle quelle. Ignorer bruyamment vaut mieux que
 * produire un patch bancal : c'est la file qu'il faudra corriger, pas la fiche.
 */
function construirePatch(proposition, entreeCorpus) {
  const contenu = proposition.contenu_propose;
  const forme = formeProposition(contenu);
  const { fiche, fichier, type } = entreeCorpus;

  if (forme === "inconnue") {
    return { ignoree: true, raison: "contenu_propose d'une forme non reconnue (ni extrait Wikipédia, ni item RSS)" };
  }

  const url = forme === "wikipedia" ? contenu.url : contenu.link;
  if (!chaineRemplie(url) || !urlValide(url)) {
    return { ignoree: true, raison: `aucune url exploitable dans la proposition (${JSON.stringify(url ?? null)})` };
  }

  // Doublon : la source est déjà dans la fiche. Le patch n'apporterait rien et
  // ferait du bruit dans la relecture.
  const urlsExistantes = new Set((fiche.sources ?? []).map((s) => normaliserUrl(s?.url)));
  const dejaSourcee = urlsExistantes.has(normaliserUrl(url));

  const score = typeof proposition.score_fiabilite === "number" ? proposition.score_fiabilite : 0;
  const agregateur = estAgregateur(url);

  const patch = {
    // id lisible et stable : re-générer deux fois la même proposition donne le même
    // id de patch, ce qui permet de comparer deux fichiers de patchs entre eux.
    id: `patch-${proposition.id}`,
    proposition_id: proposition.id,
    forme_source: forme,
    cible_type: type,
    cible_id: fiche.id,
    cible_nom: fiche.nom ?? null,
    fichier,
    statut_fiche_actuel: fiche.statut ?? null,
    derniere_verification_actuelle: fiche.derniere_verification ?? null,
    score_fiabilite: proposition.score_fiabilite ?? null,
    // Case à cocher du relecteur : passer à false écarte le patch sans le supprimer,
    // ce qui laisse une trace de la décision dans le fichier relu.
    retenu: true,
    a_verifier: [],
  };

  if (forme === "rss") {
    // Une actualité : ce qui est objectif, c'est l'URL datée. On ne propose donc
    // aucun texte de fiche, seulement l'ajout d'une source.
    patch.operation = "ajout_source";
    patch.champ = "sources";
    patch.texte_propose = null;
    patch.texte_actuel = null;
    patch.source = {
      titre: contenu.titre?.trim() || "(sans titre)",
      url,
      ...(dateSource(contenu.date) ? { date: dateSource(contenu.date) } : {}),
      type: score >= SEUIL_SOURCE_PRIMAIRE && !agregateur ? "primaire" : "secondaire",
    };
    patch.matiere_brute = tronquer(contenu.resume, EXTRAIT_ACTUEL);
    patch.justification =
      proposition.note_tri?.trim() ||
      `Item de veille rattaché à la fiche ${fiche.id} lors du tri de la file.`;

    if (agregateur) {
      // Cas fréquent dans cette file (flux Google News) : l'ajout reste proposable,
      // mais il demande un travail humain avant citation.
      patch.nature = "a_reformuler";
      patch.a_verifier.push(
        "URL d'agrégateur (Google News) : retrouver et substituer l'URL de l'éditeur d'origine avant citation",
        "Titre suffixé du nom du média par l'agrégateur (« … - Média ») : à nettoyer"
      );
    } else if (score < SEUIL_SOURCE_PRIMAIRE) {
      patch.nature = "a_reformuler";
      patch.a_verifier.push(
        `Score de fiabilité faible (${score}) : recouper la source avant de l'ajouter au référentiel`
      );
    } else {
      patch.nature = "sur";
      patch.a_verifier.push("Vérifier que l'URL est bien vivante et que le titre correspond au document cité");
    }

    if (dejaSourcee) {
      return { ignoree: true, raison: `source déjà présente dans la fiche ${fiche.id} (${url})` };
    }
    return { patch };
  }

  // forme === "wikipedia" : un résumé encyclopédique brut. Jamais publiable tel quel.
  const champ = champReformulation(type);
  patch.operation = "remplacement_texte";
  patch.champ = champ;
  patch.nature = "a_reformuler";
  // `texte_propose` porte la matière première ET le rappel : on ne veut pas qu'un
  // copier-coller distrait fasse passer un résumé Wikipédia pour une thèse rédigée.
  patch.texte_propose = contenu.extrait.trim();
  patch.texte_actuel = tronquer(fiche[champ], EXTRAIT_ACTUEL);
  patch.matiere_brute = contenu.extrait.trim();
  patch.source = dejaSourcee
    ? null
    : {
        titre: `Wikipédia (${contenu.langue_source ?? "fr"}) — ${contenu.titre_article_source ?? contenu.nom ?? fiche.nom}`,
        url,
        type: "secondaire", // encyclopédie collaborative : point de départ, jamais une source primaire
      };
  patch.justification =
    contenu.note?.trim() ||
    "Résumé Wikipédia brut proposé comme matière première pour la rédaction du champ visé.";
  patch.a_verifier.push(
    "Résumé encyclopédique BRUT : à réécrire au format du référentiel avant toute publication",
    `Le champ « ${champ} » de cette fiche est déjà rempli (${(fiche[champ] ?? "").length} car.) : ne pas écraser une rédaction existante sans arbitrage`,
    "Wikipédia est une source secondaire : recouper avec une source primaire avant de la citer seule"
  );
  if (chaineRemplie(contenu.langue_source) && contenu.langue_source !== "fr") {
    patch.a_verifier.push(`Extrait en langue « ${contenu.langue_source} » : à traduire`);
  }

  return { patch };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

function main() {
  const cheminQueue = path.join(SEED, "veille_queue.json");
  if (!existsSync(cheminQueue)) {
    console.error(`File de veille introuvable : ${cheminQueue}`);
    process.exit(1);
  }

  let queue;
  let corpus;
  try {
    queue = lireJSON(cheminQueue);
    if (!Array.isArray(queue)) throw new Error("veille_queue.json doit contenir un tableau JSON à la racine");
    corpus = indexerCorpus();
  } catch (e) {
    console.error(`Corpus ou file illisible — rien n'a été produit. ${e.message}`);
    process.exit(1);
  }

  const candidates = queue.filter((p) => p?.statut === STATUT_LU);
  const retenues = LIMITE === Infinity ? candidates : candidates.slice(0, LIMITE);

  console.log(`Lecture de ${afficherChemin(cheminQueue)} — ${queue.length} proposition(s) au total.`);
  console.log(
    `${candidates.length} au statut « ${STATUT_LU} », ${retenues.length} traitée(s) sur ce run${
      LIMITE === Infinity ? "" : ` (limite ${LIMITE})`
    }.`
  );

  const patchs = [];
  const ignorees = [];

  for (const proposition of retenues) {
    const cible = chaineRemplie(proposition?.cible_id) ? corpus.get(proposition.cible_id) : undefined;
    if (!cible) {
      ignorees.push({
        proposition_id: proposition?.id ?? null,
        cible_id: proposition?.cible_id ?? null,
        raison: chaineRemplie(proposition?.cible_id)
          ? `cible_id « ${proposition.cible_id} » introuvable dans le corpus`
          : "proposition sans cible_id (à requalifier dans la file avant traitement)",
      });
      continue;
    }

    const resultat = construirePatch(proposition, cible);
    if (resultat.ignoree) {
      ignorees.push({ proposition_id: proposition.id, cible_id: proposition.cible_id, raison: resultat.raison });
      continue;
    }
    patchs.push(resultat.patch);
  }

  const nbSurs = patchs.filter((p) => p.nature === "sur").length;
  const nbAReformuler = patchs.length - nbSurs;

  const document = {
    genere_le: new Date().toISOString(),
    genere_par: "scripts/appliquer-veille.mjs",
    rappel: RAPPEL_GARDE_FOU,
    statut_lu: STATUT_LU,
    limite: LIMITE === Infinity ? null : LIMITE,
    compteurs: {
      propositions_au_statut: candidates.length,
      propositions_traitees: retenues.length,
      patchs: patchs.length,
      surs: nbSurs,
      a_reformuler: nbAReformuler,
      ignorees: ignorees.length,
    },
    ignorees,
    patchs,
  };

  mkdirSync(path.dirname(SORTIE), { recursive: true });
  writeFileSync(SORTIE, `${JSON.stringify(document, null, 2)}\n`);

  // Compte rendu lisible : le fichier de patchs est fait pour être relu, la console
  // sert à décider s'il vaut la peine de l'ouvrir.
  console.log("");
  for (const p of patchs) {
    const marque = p.nature === "sur" ? "✓ sûr        " : "~ à reformuler";
    console.log(`  ${marque} ${p.cible_id} · ${p.champ} · ${p.operation}`);
    console.log(`      ${p.source ? `source : ${p.source.titre}` : "pas de source à ajouter"}`);
  }
  for (const i of ignorees) {
    console.log(`  ✗ ignorée     ${i.cible_id ?? "(sans cible)"} — ${i.raison}`);
  }

  console.log(
    `\n${patchs.length} patch(s) proposé(s) — ${nbSurs} sûr(s), ${nbAReformuler} à reformuler, ${ignorees.length} proposition(s) ignorée(s).`
  );
  console.log(`Fichier de patchs écrit : ${afficherChemin(SORTIE)}`);
  console.log("\nAUCUNE FICHE N'A ÉTÉ MODIFIÉE — le script propose, l'humain dispose.");
  console.log("Étapes suivantes : relire le fichier, mettre `retenu: false` sur ce qui est écarté,");
  console.log("puis  node scripts/appliquer-patchs.mjs --patchs=<fichier> --dry-run");
  process.exit(0);
}

main();

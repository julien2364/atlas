/*
 * Indexeur du corpus ATLAS — produit `data/index-vectoriel.json`.
 *
 * Rôle dans le projet
 * -------------------
 * Le référentiel vit dans `data/seed/*.json` (fiches humaines, fiches IA, fiches
 * de gap). Ce script le découpe en PASSAGES (via `lib/passages-corpus.mjs`),
 * calcule un vecteur par passage, et écrit le tout dans UN FICHIER VERSIONNÉ au
 * dépôt. Il n'y a plus ni base de données ni clé d'API dans le chemin par défaut :
 * `npm run indexer` fonctionne sur une copie fraîche du dépôt, hors ligne.
 *
 * Ce qui a changé le 07/09/2026, et pourquoi
 * ------------------------------------------
 * L'index vivait dans Supabase (pgvector). Pour 2 855 passages — 41 Mo en base
 * dont 22 Mo d'index HNSW — une base de données est disproportionnée : la
 * recherche sur 2 855 vecteurs se fait en mémoire en quelques millisecondes, et
 * l'index tient dans un fichier qu'on lit comme les JSON de fiches. Le chemin
 * Supabase reste documenté (`supabase/schema.sql`, `lib/supabase.ts`) comme
 * option pour le jour où le corpus décuplerait — cf. docs/moteur-reponse-local.md §7.
 *
 * Ce qui N'A PAS changé : le découpage en passages, l'empreinte de contenu, et
 * donc l'idempotence.
 *
 * Idempotence — la propriété structurante du script
 * -------------------------------------------------
 * Chaque passage porte l'empreinte SHA-256 de son texte, préfixée du nom du
 * modèle d'embedding. Avant tout calcul, le script compare aux empreintes déjà
 * présentes dans le fichier d'index :
 *   - relancer sans avoir touché au corpus ne réécrit RIEN (le fichier garde son
 *     horodatage, git reste propre, aucune API n'est appelée) ;
 *   - corriger une fiche ne fait recalculer que ses passages en mode fournisseur
 *     d'API — donc ne coûte que ceux-là ;
 *   - une fiche supprimée voit ses passages disparaître de l'index, toujours :
 *     le fichier est réécrit entier à partir du corpus courant, un passage
 *     orphelin n'y survit pas (c'était le rôle de `--purger` en base) ;
 *   - changer de modèle d'embedding change toutes les empreintes, donc réindexe
 *     tout : deux espaces vectoriels ne se comparent pas.
 *
 * Nuance propre au modèle lexical : ses poids dépendent des fréquences de TOUT
 * le corpus (l'IDF). Dès qu'un passage change, l'IDF bouge, et tous les vecteurs
 * avec. Le script recalcule donc l'intégralité de l'index lexical dès qu'il y a
 * la moindre modification — c'est gratuit (≈ 0,4 s) et c'est la seule façon de ne
 * pas mélanger deux générations d'IDF dans le même fichier. Les empreintes
 * gardent leur rôle : décider s'il faut réécrire, et éviter les appels payants
 * quand un fournisseur d'API est branché.
 *
 * Usage
 * -----
 *   node scripts/indexer-corpus.mjs                  # indexation (usage normal, sans clé)
 *   node scripts/indexer-corpus.mjs --dry-run        # simulation : ne calcule rien, n'écrit rien
 *   node scripts/indexer-corpus.mjs --etat           # volumétrie du fichier d'index
 *   node scripts/indexer-corpus.mjs --mesurer        # qualité de la recherche, chiffres à l'appui
 *   node scripts/indexer-corpus.mjs --force          # tout recalculer
 *   node scripts/indexer-corpus.mjs --type=gap       # ne traiter qu'un référentiel
 *   node scripts/indexer-corpus.mjs --aide
 *
 * Codes de sortie
 * ---------------
 *   0 — succès (y compris « rien à faire »)
 *   1 — échec d'exécution : fournisseur d'embeddings en erreur, écriture impossible
 *   2 — usage ou configuration invalide. Rien n'a été tenté, rien n'a été dépensé.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { construirePassages, clePassage, empreintePassage } from "../lib/passages-corpus.mjs";
import {
  MODELE_LEXICAL,
  construireLexique,
  poidsCreux,
  cosinusCreux,
  vecteurDocument,
  vecteurRequete,
  quantifier,
  cosinusInt8,
  normeInt8,
} from "../lib/embedding-lexical.mjs";
import { configEmbeddings, embedderLotDistant } from "../lib/embeddings-fournisseur.mjs";

// ---------------------------------------------------------------------------
// Constantes de pilotage
// ---------------------------------------------------------------------------

/** Nom du fichier d'index, relatif à la racine du dépôt. */
const CHEMIN_INDEX = path.join("data", "index-vectoriel.json");

/** Version du format de fichier. Un écart au chargement = index ignoré, pas de plantage. */
const VERSION_FORMAT = 1;

/** Taille d'un lot d'embeddings distants. */
const TAILLE_LOT_DEFAUT = 96;

/** Pause entre deux lots distants, pour ne pas se faire limiter. */
const PAUSE_ENTRE_LOTS_MS = 400;

/** Longueur d'empreinte conservée dans le fichier (64 bits : assez pour détecter un changement). */
const LONGUEUR_EMPREINTE = 16;

const TYPES_VALIDES = ["humaine", "ia", "gap"];

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

const AIDE = `
INDEXEUR DU CORPUS ATLAS → data/index-vectoriel.json

  node scripts/indexer-corpus.mjs [options]

Sans option et sans aucune clé d'API : indexation complète en local, hors ligne.

Options
  --dry-run          Simulation : découpe le corpus, affiche ce qui serait indexé,
                     ne calcule aucun vecteur et n'écrit aucun fichier.
  --etat             Volumétrie du fichier d'index existant, puis sortie.
  --mesurer          Mesure la qualité de la recherche : perte de la quantification,
                     coût d'une projection dense, rappel sur les questions-tests,
                     séparation des questions hors corpus. N'écrit rien.
  --force            Tout recalculer, même l'inchangé (coûteux avec un fournisseur d'API).
  --type=T           Restreindre à un référentiel : humaine | ia | gap.
  --limite=N         Ne calculer que les N premiers passages à (ré)indexer.
  --lot=N            Taille des lots d'embedding distant (défaut ${TAILLE_LOT_DEFAUT}, max 128).
  --purger           Accepté pour compatibilité : la purge est désormais systématique,
                     le fichier d'index est reconstruit à partir du corpus courant.
  --racine=CHEMIN    Racine du dépôt (défaut : dossier parent de ce script).
  --json             Sortie machine : un objet JSON sur stdout, rien d'autre.
  --aide, -h         Cette aide.

Fournisseur d'embeddings (facultatif — voir .env.example §2)
  Sans clé : embedding lexical local « ${MODELE_LEXICAL} », gratuit, hors ligne.
  Avec ATLAS_EMBEDDINGS_URL + ATLAS_EMBEDDINGS_MODELE, ou VOYAGE_API_KEY :
  les vecteurs sont demandés au fournisseur. Le nom du modèle entre dans
  l'empreinte des passages, donc changer de modèle réindexe tout, automatiquement.

Codes de sortie : 0 succès · 1 échec d'exécution · 2 usage/configuration invalide.
`;

if (args.includes("--aide") || args.includes("-h")) {
  process.stdout.write(`${AIDE}\n`);
  process.exit(0);
}

const OPTIONS_CONNUES = ["--dry-run", "--force", "--purger", "--etat", "--mesurer", "--json", "--aide", "-h"];
const OPTIONS_VALEUR = ["--type=", "--limite=", "--lot=", "--racine="];

const inconnus = args.filter(
  (a) => !OPTIONS_CONNUES.includes(a) && !OPTIONS_VALEUR.some((prefixe) => a.startsWith(prefixe))
);
if (inconnus.length > 0) {
  process.stderr.write(`Argument inconnu : ${inconnus.join(", ")}\n${AIDE}\n`);
  process.exit(2);
}

/** @param {string} prefixe */
function valeurArg(prefixe) {
  const trouve = args.find((a) => a.startsWith(prefixe));
  return trouve === undefined ? null : trouve.slice(prefixe.length);
}

const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const ETAT_SEUL = args.includes("--etat");
const MESURER = args.includes("--mesurer");
const SORTIE_JSON = args.includes("--json");

const TYPE_FILTRE = valeurArg("--type=");
if (TYPE_FILTRE !== null && !TYPES_VALIDES.includes(TYPE_FILTRE)) {
  process.stderr.write(`--type invalide : "${TYPE_FILTRE}". Valeurs acceptées : ${TYPES_VALIDES.join(", ")}.\n`);
  process.exit(2);
}

/**
 * @param {string} prefixe
 * @param {number} min
 * @param {number} max
 * @param {number | null} defaut
 */
function entierArg(prefixe, min, max, defaut) {
  const brut = valeurArg(prefixe);
  if (brut === null) return defaut;
  const valeur = Number.parseInt(brut, 10);
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) {
    process.stderr.write(`${prefixe} invalide : "${brut}". Attendu un entier entre ${min} et ${max}.\n`);
    process.exit(2);
  }
  return valeur;
}

const LIMITE = entierArg("--limite=", 1, 100000, null);
const TAILLE_LOT = entierArg("--lot=", 1, 128, TAILLE_LOT_DEFAUT) ?? TAILLE_LOT_DEFAUT;

// Racine résolue depuis l'emplacement du script : la CI et le cron ne lancent pas
// forcément la commande depuis la racine du dépôt.
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = valeurArg("--racine=") ?? path.resolve(ICI, "..");
const SEED = path.join(RACINE, "data", "seed");
const FICHIER_INDEX = path.join(RACINE, CHEMIN_INDEX);

// ---------------------------------------------------------------------------
// Journalisation
// ---------------------------------------------------------------------------

/** @param {string} message */
function log(message) {
  if (SORTIE_JSON) process.stderr.write(`${message}\n`);
  else process.stdout.write(`${message}\n`);
}

/**
 * @param {number} code
 * @param {string} message
 * @returns {never}
 */
function echec(code, message) {
  process.stderr.write(`\nÉCHEC : ${message}\n`);
  if (SORTIE_JSON) process.stdout.write(`${JSON.stringify({ ok: false, erreur: message }, null, 2)}\n`);
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Chargement de .env.local / .env
// ---------------------------------------------------------------------------

/**
 * Mini-lecteur de fichier d'environnement. Volontairement minimal (pas de dotenv :
 * aucune dépendance nouvelle n'est ajoutée au projet). Ne surcharge JAMAIS une
 * variable déjà présente dans l'environnement réel.
 *
 * @param {string} fichier
 */
function chargerEnv(fichier) {
  if (!existsSync(fichier)) return;
  for (const ligne of readFileSync(fichier, "utf-8").split(/\r?\n/)) {
    const propre = ligne.trim();
    if (propre === "" || propre.startsWith("#")) continue;
    const separateur = propre.indexOf("=");
    if (separateur <= 0) continue;
    const cle = propre.slice(0, separateur).trim();
    let valeur = propre.slice(separateur + 1).trim();
    if (
      (valeur.startsWith('"') && valeur.endsWith('"')) ||
      (valeur.startsWith("'") && valeur.endsWith("'"))
    ) {
      valeur = valeur.slice(1, -1);
    }
    if (process.env[cle] === undefined) process.env[cle] = valeur;
  }
}

chargerEnv(path.join(RACINE, ".env.local"));
chargerEnv(path.join(RACINE, ".env"));

const FOURNISSEUR = configEmbeddings();
const MODELE_EMBEDDING = FOURNISSEUR ? FOURNISSEUR.etiquette : MODELE_LEXICAL;
const REPRESENTATION = FOURNISSEUR ? "dense-int8" : "creuse-int8";

// ---------------------------------------------------------------------------
// Lecture du corpus
// ---------------------------------------------------------------------------
//
// Lecture directe des JSON et non via `lib/corpus.ts` : ce module est du
// TypeScript avec des alias `@/`, que Node ne sait pas charger sans build. Le
// DÉCOUPAGE, lui, n'est pas dupliqué : il vient de `lib/passages-corpus.mjs`,
// importé aussi par `lib/rag.ts`.

/** @param {string} chemin */
function lireJson(chemin) {
  try {
    const contenu = JSON.parse(readFileSync(chemin, "utf-8"));
    if (!Array.isArray(contenu)) echec(2, `${chemin} ne contient pas un tableau JSON à la racine.`);
    return contenu;
  } catch (erreur) {
    echec(2, `Corpus illisible (${chemin}) : ${/** @type {Error} */ (erreur).message}`);
  }
}

function chargerCorpus() {
  const dossierHumaines = path.join(SEED, "fiches_humaines");
  if (!existsSync(dossierHumaines)) echec(2, `Dossier introuvable : ${dossierHumaines}. Vérifier --racine.`);
  const humaines = [];
  for (const fichier of readdirSync(dossierHumaines).filter((f) => f.endsWith(".json")).sort()) {
    humaines.push(...lireJson(path.join(dossierHumaines, fichier)));
  }
  return {
    humaines,
    ia: lireJson(path.join(SEED, "fiches_ia.json")),
    gap: lireJson(path.join(SEED, "fiches_gap.json")),
  };
}

// ---------------------------------------------------------------------------
// Lecture / écriture du fichier d'index
// ---------------------------------------------------------------------------

/**
 * Lit l'index existant. Toute anomalie (fichier absent, JSON cassé, version
 * inconnue) rend `null` : on repart d'un index vide plutôt que d'échouer.
 * @returns {any | null}
 */
function lireIndexExistant() {
  if (!existsSync(FICHIER_INDEX)) return null;
  try {
    const donnees = JSON.parse(readFileSync(FICHIER_INDEX, "utf-8"));
    if (donnees?.version !== VERSION_FORMAT) return null;
    return donnees;
  } catch {
    return null;
  }
}

/**
 * Vecteurs déjà calculés, par clé de passage, quand ils restent réutilisables :
 * même modèle, même représentation, même empreinte.
 *
 * @param {any} index
 * @returns {Map<string, { empreinte: string, vecteur: number[] | null }>}
 */
function vecteursReutilisables(index) {
  /** @type {Map<string, { empreinte: string, vecteur: number[] | null }>} */
  const table = new Map();
  if (!index || index.modele_embedding !== MODELE_EMBEDDING || index.representation !== REPRESENTATION) {
    return table;
  }
  const dimension = index.dimension ?? 0;
  const poids = index.poids_b64 ? Buffer.from(index.poids_b64, "base64") : Buffer.alloc(0);
  for (let i = 0; i < (index.cles ?? []).length; i += 1) {
    /** @type {number[] | null} */
    let vecteur = null;
    if (index.representation === "dense-int8" && poids.length >= (i + 1) * dimension) {
      vecteur = [];
      for (let d = 0; d < dimension; d += 1) vecteur.push(poids.readInt8(i * dimension + d));
    }
    table.set(index.cles[i], { empreinte: index.empreintes[i], vecteur });
  }
  return table;
}

/**
 * Écrit le fichier d'index. Les vecteurs partent en base64 : un tableau JSON de
 * 111 000 nombres pèserait quatre fois plus et n'apporterait rien — personne ne
 * lit un vecteur à l'œil.
 *
 * @param {any} contenu
 * @returns {number} taille du fichier écrit, en octets
 */
function ecrireIndex(contenu) {
  mkdirSync(path.dirname(FICHIER_INDEX), { recursive: true });
  // Une clé par ligne au premier niveau, valeurs compactes : le diff git montre
  // « les vecteurs ont changé » sans dérouler 111 000 nombres.
  const lignes = Object.entries(contenu).map(([cle, valeur]) => `  ${JSON.stringify(cle)}: ${JSON.stringify(valeur)}`);
  const texte = `{\n${lignes.join(",\n")}\n}\n`;
  writeFileSync(FICHIER_INDEX, texte, "utf-8");
  return Buffer.byteLength(texte, "utf-8");
}

/** @param {number} octets */
function taille(octets) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(2)} Mo`;
}

// ---------------------------------------------------------------------------
// Construction de l'index
// ---------------------------------------------------------------------------

/**
 * Index LEXICAL creux. Chaque passage devient une liste (terme, poids int8),
 * triée par terme. Le lexique (fréquences documentaires) part avec l'index :
 * c'est lui qui permet à `lib/rag.ts` de vectoriser une question dans le même
 * espace, sans relire le corpus entier.
 *
 * @param {{ texte: string }[]} passages
 * @param {string[]} cles
 * @param {string[]} empreintes
 */
function construireIndexLexical(passages, cles, empreintes) {
  const lexique = construireLexique(passages);
  const termesTries = [...lexique.df.keys()].sort();
  const rang = new Map(termesTries.map((t, i) => [t, i]));

  /** @type {number[]} */
  const offsets = [0];
  /** @type {number[]} */
  const indices = [];
  /** @type {number[]} */
  const valeurs = [];

  for (const passage of passages) {
    const poids = poidsCreux(passage.texte, lexique, false);
    let maximum = 0;
    for (const valeur of poids.values()) if (valeur > maximum) maximum = valeur;
    /** @type {[number, number][]} */
    const entrees = [];
    if (maximum > 0) {
      for (const [terme, valeur] of poids) {
        const position = rang.get(terme);
        if (position === undefined) continue;
        // Quantification 8 bits, échelle = maximum du passage. L'échelle n'est pas
        // stockée : le cosinus est invariant par facteur multiplicatif, on compare
        // donc les entiers directement, sans jamais déquantifier.
        const quantifie = Math.round((valeur / maximum) * 127);
        if (quantifie <= 0) continue;
        entrees.push([position, quantifie > 127 ? 127 : quantifie]);
      }
    }
    entrees.sort((a, b) => a[0] - b[0]);
    for (const [position, valeur] of entrees) {
      indices.push(position);
      valeurs.push(valeur);
    }
    offsets.push(indices.length);
  }

  const tamponIndices = Buffer.alloc(indices.length * 2);
  for (let i = 0; i < indices.length; i += 1) tamponIndices.writeUInt16LE(indices[i], i * 2);
  const tamponPoids = Buffer.alloc(valeurs.length);
  for (let i = 0; i < valeurs.length; i += 1) tamponPoids.writeInt8(valeurs[i], i);

  return {
    version: VERSION_FORMAT,
    genere_le: new Date().toISOString(),
    modele_embedding: MODELE_EMBEDDING,
    representation: "creuse-int8",
    dimension: termesTries.length,
    nb_passages: passages.length,
    nb_postings: indices.length,
    lexique: {
      nb_documents: lexique.nb_documents,
      longueur_moyenne: Math.round(lexique.longueur_moyenne * 1000) / 1000,
      termes: termesTries.join(" "),
      df: termesTries.map((t) => lexique.df.get(t) ?? 1),
    },
    cles,
    empreintes,
    offsets,
    indices_b64: tamponIndices.toString("base64"),
    poids_b64: tamponPoids.toString("base64"),
  };
}

/**
 * Index DENSE, quantifié 8 bits, pour un fournisseur d'embeddings.
 *
 * @param {number[][]} vecteurs
 * @param {string[]} cles
 * @param {string[]} empreintes
 */
function construireIndexDense(vecteurs, cles, empreintes) {
  const dimension = vecteurs[0].length;
  const tampon = Buffer.alloc(vecteurs.length * dimension);
  for (let i = 0; i < vecteurs.length; i += 1) {
    const vecteur = vecteurs[i];
    let maximum = 0;
    for (const valeur of vecteur) if (Math.abs(valeur) > maximum) maximum = Math.abs(valeur);
    const facteur = maximum === 0 ? 0 : 127 / maximum;
    for (let d = 0; d < dimension; d += 1) {
      const quantifie = Math.round(vecteur[d] * facteur);
      tampon.writeInt8(quantifie > 127 ? 127 : quantifie < -127 ? -127 : quantifie, i * dimension + d);
    }
  }
  return {
    version: VERSION_FORMAT,
    genere_le: new Date().toISOString(),
    modele_embedding: MODELE_EMBEDDING,
    representation: "dense-int8",
    dimension,
    nb_passages: vecteurs.length,
    nb_postings: vecteurs.length * dimension,
    lexique: null,
    cles,
    empreintes,
    offsets: null,
    indices_b64: null,
    poids_b64: tampon.toString("base64"),
  };
}

// ---------------------------------------------------------------------------
// Mesure de qualité (--mesurer)
// ---------------------------------------------------------------------------

/**
 * Questions volontairement hors périmètre. Elles servent à vérifier que le
 * moteur REFUSE : une question à laquelle il répond quand même est un défaut
 * plus grave qu'une question refusée à tort.
 */
const QUESTIONS_HORS_CORPUS = [
  "Quelle est la recette du kouign-amann ?",
  "Comment changer un pneu de vélo crevé ?",
  "Quel est le meilleur engrais pour les tomates cerises ?",
  "Combien de temps faut-il cuire un œuf à la coque ?",
  "Quels sont les horaires du train Paris-Lyon demain matin ?",
  "Comment soigner une entorse de la cheville ?",
];

/** Mots trop génériques pour désigner une fiche : ils feraient un étalon faux. */
const MOTS_NON_DISCRIMINANTS = new Set([
  "approche", "ecole", "modele", "these", "limite", "limites", "position",
  "critique", "argument", "probleme", "refus", "exigence", "etude", "analyse", "theorie",
]);

/** @param {string} s */
const sansAccent = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Étalon de pertinence, construit SANS jugement de ma part : pour chaque
 * question-test répondue à la main dans data/seed/questions.json, les fiches du
 * référentiel dont le NOM est cité dans l'intitulé d'une perspective
 * (« Falsificationnisme (Popper) » → fiche « Karl Popper »). Un nom qui désigne
 * plus de trois fiches est écarté : il ne désigne alors pas une fiche précise.
 *
 * C'est un étalon partiel — il ne voit que les fiches nommées d'après une
 * personne ou une école — mais il n'est pas arbitraire : il vient des réponses
 * que Julien a écrites lui-même.
 *
 * @param {any} question
 * @param {any[]} humaines
 * @param {any[]} ia
 * @returns {Set<string>}
 */
function fichesEtalon(question, humaines, ia) {
  const noms = new Set();
  for (const perspective of question.perspectives ?? []) {
    for (const trouve of String(perspective.modele).matchAll(/\p{Lu}[\p{L}'’-]{2,}/gu)) {
      noms.add(sansAccent(trouve[0]));
    }
  }
  /** @type {Set<string>} */
  const etalon = new Set();
  for (const nom of noms) {
    if (MOTS_NON_DISCRIMINANTS.has(nom)) continue;
    /** @type {string[]} */
    const correspondances = [];
    for (const fiche of humaines) {
      if (sansAccent(fiche.nom ?? "").split(/[^a-z0-9]+/).includes(nom)) correspondances.push(`humaine:${fiche.id}`);
    }
    for (const fiche of ia) {
      if (sansAccent(fiche.nom ?? "").split(/[^a-z0-9]+/).includes(nom)) correspondances.push(`ia:${fiche.id}`);
    }
    if (correspondances.length > 0 && correspondances.length <= 3) {
      for (const c of correspondances) etalon.add(c);
    }
  }
  return etalon;
}

/**
 * Sélection identique à celle de `lib/rag.ts` : au plus 2 passages par fiche,
 * au plus `max` passages. Reproduite ici pour que la mesure porte sur ce que le
 * moteur retient RÉELLEMENT, pas sur le classement brut.
 *
 * @param {[number, number][]} scores
 * @param {any[]} passages
 * @param {number} max
 */
function selectionner(scores, passages, max) {
  /** @type {Map<string, number>} */
  const parFiche = new Map();
  /** @type {[number, number][]} */
  const retenus = [];
  for (const [i, score] of scores) {
    if (retenus.length >= max) break;
    const cle = `${passages[i].type_fiche}:${passages[i].fiche_id}`;
    const deja = parFiche.get(cle) ?? 0;
    if (deja >= 2) continue;
    parFiche.set(cle, deja + 1);
    retenus.push([i, score]);
  }
  return retenus;
}

/**
 * @param {any} corpus
 * @param {any[]} passages
 */
function mesurer(corpus, passages) {
  const debut = Date.now();
  const lexique = construireLexique(passages);
  const dureeLexique = Date.now() - debut;
  const poidsDocs = passages.map((p) => poidsCreux(p.texte, lexique, false));
  const nbPostings = poidsDocs.reduce((total, m) => total + m.size, 0);

  /** Quantification creuse, identique à celle écrite dans le fichier. */
  const quantifierCreux = (/** @type {Map<string, number>} */ m) => {
    let maximum = 0;
    for (const v of m.values()) if (v > maximum) maximum = v;
    /** @type {Map<string, number>} */
    const sortie = new Map();
    if (maximum === 0) return sortie;
    for (const [t, v] of m) {
      const q = Math.round((v / maximum) * 127);
      if (q > 0) sortie.set(t, q);
    }
    return sortie;
  };
  const docsQuantifies = poidsDocs.map(quantifierCreux);

  const questions = lireJson(path.join(SEED, "questions.json"));
  const intitules = questions.map((/** @type {any} */ q) => q.question);

  log("\n════ 1. PERTE DE LA QUANTIFICATION 8 BITS ════");
  let rappel10 = 0;
  let rappel5 = 0;
  let ecartMax = 0;
  let ecartSomme = 0;
  let nbEcarts = 0;
  for (const intitule of intitules) {
    const requete = poidsCreux(intitule, lexique, true);
    const requeteQ = quantifierCreux(requete);
    const reference = poidsDocs.map((d, i) => [i, cosinusCreux(requete, d)]).sort((a, b) => b[1] - a[1]);
    const obtenu = docsQuantifies.map((d, i) => [i, cosinusCreux(requeteQ, d)]).sort((a, b) => b[1] - a[1]);
    const top10 = new Set(reference.slice(0, 10).map((s) => s[0]));
    const top5 = new Set(reference.slice(0, 5).map((s) => s[0]));
    rappel10 += obtenu.slice(0, 10).filter((s) => top10.has(s[0])).length / 10;
    rappel5 += obtenu.slice(0, 5).filter((s) => top5.has(s[0])).length / 5;
    const parIndice = new Map(reference);
    for (const [i, score] of obtenu.slice(0, 60)) {
      const ecart = Math.abs(score - (parIndice.get(i) ?? 0));
      if (ecart > ecartMax) ecartMax = ecart;
      ecartSomme += ecart;
      nbEcarts += 1;
    }
  }
  log(`  Référence : cosinus BM25 en flottants 64 bits, sans quantification.`);
  log(`  Rappel@5  : ${(rappel5 / intitules.length).toFixed(3)}   Rappel@10 : ${(rappel10 / intitules.length).toFixed(3)}`);
  log(`  Écart de similarité : moyen ${(ecartSomme / nbEcarts).toFixed(6)} · maximal ${ecartMax.toFixed(6)}`);
  log(`  Volume : ${nbPostings.toLocaleString("fr-FR")} postings × 3 octets = ${taille(nbPostings * 3)} de vecteurs`);
  log(`           (les mêmes en flottants 32 bits : ${taille(nbPostings * 6)})`);

  log("\n════ 2. COÛT D'UNE PROJECTION DENSE ════");
  log("  Comparaison au même BM25 creux exact. Chaque ligne est un compromis");
  log("  taille/qualité pour l'index dense qui avait été envisagé.");
  const referencesTop10 = intitules.map((/** @type {string} */ intitule) => {
    const requete = poidsCreux(intitule, lexique, true);
    return new Set(
      poidsDocs
        .map((d, i) => [i, cosinusCreux(requete, d)])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map((s) => s[0])
    );
  });
  for (const dimension of [256, 512, 1024, 4096]) {
    const vecteurs = passages.map((p) => quantifier(vecteurDocument(p.texte, lexique, dimension)));
    const normes = vecteurs.map(normeInt8);
    let rappel = 0;
    for (let qi = 0; qi < intitules.length; qi += 1) {
      const requete = quantifier(vecteurRequete(intitules[qi], lexique, dimension));
      const normeRequete = normeInt8(requete);
      const scores = vecteurs
        .map((v, i) => [i, cosinusInt8(requete, v, normeRequete, normes[i])])
        .sort((a, b) => b[1] - a[1]);
      rappel += scores.slice(0, 10).filter((s) => referencesTop10[qi].has(s[0])).length / 10;
    }
    log(
      `  ${String(dimension).padStart(5)} dimensions → rappel@10 = ${(rappel / intitules.length).toFixed(3)}` +
        ` · ${taille(passages.length * dimension)} de vecteurs`
    );
  }
  log(`  (la production n'utilise pas la projection : cf. lib/embedding-lexical.mjs)`);

  log("\n════ 3. RAPPEL SUR LES QUESTIONS-TESTS ════");
  log("  Étalon : les fiches nommées dans les réponses écrites à la main");
  log("  (data/seed/questions.json). Compté sur les 18 passages que le moteur retient.");
  let etalonTotal = 0;
  let trouveTotal = 0;
  for (const question of questions) {
    const etalon = fichesEtalon(question, corpus.humaines, corpus.ia);
    if (etalon.size === 0) {
      log(`  ${question.id.padEnd(46)} — aucune fiche-étalon identifiable, question exclue`);
      continue;
    }
    const requete = quantifierCreux(poidsCreux(question.question, lexique, true));
    const scores = /** @type {[number, number][]} */ (
      docsQuantifies.map((d, i) => [i, cosinusCreux(requete, d)]).sort((a, b) => b[1] - a[1])
    );
    const retenus = selectionner(scores, passages, 18);
    const fiches = new Set(retenus.map(([i]) => `${passages[i].type_fiche}:${passages[i].fiche_id}`));
    const manquees = [...etalon].filter((f) => !fiches.has(f));
    etalonTotal += etalon.size;
    trouveTotal += etalon.size - manquees.length;
    log(
      `  ${question.id.padEnd(46)} ${etalon.size - manquees.length}/${etalon.size} · similarité max ${scores[0][1].toFixed(3)}` +
        (manquees.length > 0 ? `\n      manquées : ${manquees.map((f) => f.split(":")[1]).join(", ")}` : "")
    );
  }
  log(
    `  TOTAL : ${trouveTotal}/${etalonTotal} fiches-étalon retrouvées = ` +
      `${((trouveTotal / etalonTotal) * 100).toFixed(0)} %`
  );

  log("\n════ 4. SÉPARATION DES QUESTIONS HORS CORPUS ════");
  log("  « appariés » = nombre de termes distincts de la question qu'un passage retrouve.");
  /** @param {string} intitule */
  const diagnostiquer = (intitule) => {
    const requete = poidsCreux(intitule, lexique, true);
    const requeteQ = quantifierCreux(requete);
    const scores = docsQuantifies
      .map((d, i) => ({ i, score: cosinusCreux(requeteQ, d), apparies: [...requete.keys()].filter((t) => poidsDocs[i].has(t)).length }))
      .sort((a, b) => b.score - a.score);
    return {
      max: scores[0].score,
      apparies: Math.max(...scores.slice(0, 30).map((s) => s.apparies)),
      au_dessus: scores.filter((s) => s.score >= 0.08).length,
    };
  };
  log("  — questions du corpus —");
  for (const intitule of intitules) {
    const d = diagnostiquer(intitule);
    log(`    max ${d.max.toFixed(3)} · appariés ${d.apparies} · ${String(d.au_dessus).padStart(3)} passages ≥ 0,08 · ${intitule.slice(0, 52)}`);
  }
  log("  — questions hors corpus —");
  for (const intitule of QUESTIONS_HORS_CORPUS) {
    const d = diagnostiquer(intitule);
    log(`    max ${d.max.toFixed(3)} · appariés ${d.apparies} · ${String(d.au_dessus).padStart(3)} passages ≥ 0,08 · ${intitule.slice(0, 52)}`);
  }
  log("");
  log(`  Lexique construit en ${dureeLexique} ms · ${lexique.df.size.toLocaleString("fr-FR")} termes distincts`);
  log(`  Mesure complète en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------

/** @param {number} ms */
const pause = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));

async function main() {
  const debut = Date.now();

  // --- Mode --etat : diagnostic du fichier d'index --------------------------
  if (ETAT_SEUL) {
    const index = lireIndexExistant();
    if (!index) {
      log(`Aucun index exploitable en ${CHEMIN_INDEX} — lancer \`npm run indexer\`.`);
      if (SORTIE_JSON) process.stdout.write(`${JSON.stringify({ ok: true, index: null }, null, 2)}\n`);
      process.exit(0);
    }
    /** @type {Record<string, number>} */
    const parType = {};
    for (const cle of index.cles) {
      const type = cle.split("|")[0];
      parType[type] = (parType[type] ?? 0) + 1;
    }
    const octets = statSync(FICHIER_INDEX).size;
    if (SORTIE_JSON) {
      process.stdout.write(
        `${JSON.stringify(
          {
            ok: true,
            index: {
              modele_embedding: index.modele_embedding,
              representation: index.representation,
              dimension: index.dimension,
              nb_passages: index.nb_passages,
              nb_postings: index.nb_postings,
              genere_le: index.genere_le,
              octets,
              par_type: parType,
            },
          },
          null,
          2
        )}\n`
      );
    } else {
      log(`ÉTAT DE L'INDEX (${CHEMIN_INDEX})`);
      log(`  modèle          ${index.modele_embedding}`);
      log(`  représentation  ${index.representation} · dimension ${index.dimension}`);
      log(`  passages        ${index.nb_passages} (${Object.entries(parType).map(([t, n]) => `${t} ${n}`).join(" · ")})`);
      log(`  composantes     ${Number(index.nb_postings ?? 0).toLocaleString("fr-FR")}`);
      log(`  taille fichier  ${taille(octets)}`);
      log(`  généré le       ${index.genere_le}`);
    }
    process.exit(0);
  }

  // --- Découpage ------------------------------------------------------------
  const corpus = chargerCorpus();
  const passages = construirePassages(corpus, {
    type: TYPE_FILTRE,
    surDoublon: (cles) =>
      log(`⚠ ${cles.length} passage(s) en doublon ignoré(s) — corpus à vérifier : ${cles.slice(0, 5).join(", ")}`),
  });
  if (passages.length === 0) echec(2, "Aucun passage produit — corpus vide ou filtre --type trop restrictif.");

  // --- Mode --mesurer -------------------------------------------------------
  if (MESURER) {
    if (TYPE_FILTRE !== null) echec(2, "--mesurer porte sur le corpus entier : retirer --type.");
    log("MESURE DE QUALITÉ DE LA RECHERCHE LEXICALE");
    log(`Corpus : ${passages.length} passages · ${corpus.humaines.length} fiches humaines · ${corpus.ia.length} fiches IA · ${corpus.gap.length} fiches de gap`);
    mesurer(corpus, passages);
    process.exit(0);
  }

  /** @type {Record<string, number>} */
  const parType = {};
  for (const p of passages) parType[p.type_fiche] = (parType[p.type_fiche] ?? 0) + 1;
  const caracteres = passages.reduce((total, p) => total + p.texte.length, 0);

  log(`INDEXATION DU CORPUS ATLAS → ${CHEMIN_INDEX}`);
  log(`Racine : ${RACINE}`);
  log(
    FOURNISSEUR
      ? `Modèle d'embedding : ${MODELE_EMBEDDING} (fournisseur distant, appels facturés par lui)`
      : `Modèle d'embedding : ${MODELE_EMBEDDING} — local, aucune clé, aucun appel réseau`
  );
  log(`Corpus : ${corpus.humaines.length} fiches humaines · ${corpus.ia.length} fiches IA · ${corpus.gap.length} fiches de gap`);
  log(
    `Passages construits : ${passages.length} ` +
      `(humaine ${parType.humaine ?? 0} · ia ${parType.ia ?? 0} · gap ${parType.gap ?? 0}) · ` +
      `${caracteres.toLocaleString("fr-FR")} caractères`
  );

  const cles = passages.map(clePassage);
  const empreintes = passages.map((p) => empreintePassage(p.texte, MODELE_EMBEDDING).slice(0, LONGUEUR_EMPREINTE));

  const indexExistant = lireIndexExistant();
  const connus = vecteursReutilisables(indexExistant);
  const aRecalculer = passages.filter((p, i) => {
    if (FORCE) return true;
    const connu = connus.get(cles[i]);
    return !connu || connu.empreinte !== empreintes[i];
  });
  const clesCourantes = new Set(cles);
  const obsoletes = [...connus.keys()].filter((cle) => !clesCourantes.has(cle));

  log(
    `À (ré)indexer : ${aRecalculer.length} passage(s)${FORCE ? " (--force)" : ""} · ` +
      `inchangés : ${passages.length - aRecalculer.length} · ` +
      `présents dans l'index mais disparus du corpus : ${obsoletes.length}`
  );

  // --- Mode --dry-run -------------------------------------------------------
  if (DRY_RUN) {
    const echantillon = passages.slice(0, 3).map((p, i) => ({
      cle: cles[i],
      empreinte: empreintes[i],
      taille: p.texte.length,
      apercu: p.texte.slice(0, 180),
    }));
    if (SORTIE_JSON) {
      process.stdout.write(
        `${JSON.stringify(
          { ok: true, dry_run: true, passages: passages.length, par_type: parType, a_recalculer: aRecalculer.length, obsoletes: obsoletes.length, echantillon },
          null,
          2
        )}\n`
      );
    } else {
      log("\nMode --dry-run : aucun vecteur calculé, aucun fichier écrit.");
      log("\nÉchantillon :");
      for (const e of echantillon) {
        log(`  ${e.cle}  [${e.empreinte}]  ${e.taille} car.`);
        log(`    ${e.apercu.replace(/\n/g, " ")}…`);
      }
    }
    process.exit(0);
  }

  // --- Rien à faire ---------------------------------------------------------
  if (aRecalculer.length === 0 && obsoletes.length === 0 && indexExistant) {
    log("\nRien à faire — l'index est déjà à jour. Fichier inchangé, aucun appel réseau.");
    if (SORTIE_JSON) {
      process.stdout.write(`${JSON.stringify({ ok: true, indexes: 0, inchanges: passages.length }, null, 2)}\n`);
    }
    process.exit(0);
  }

  // --- Calcul des vecteurs --------------------------------------------------
  /** @type {string[]} */
  const erreurs = [];
  let contenu;
  let tokensConsommes = 0;

  if (!FOURNISSEUR) {
    // Embedding lexical : les poids dépendent de l'IDF de TOUT le corpus, donc
    // le moindre changement rend obsolètes tous les vecteurs. On recalcule tout
    // — c'est gratuit et c'est la seule façon de ne pas mélanger deux IDF.
    if (aRecalculer.length < passages.length) {
      log(
        `Recalcul intégral : le modèle lexical pondère par la rareté des mots dans TOUT le corpus, ` +
          `${aRecalculer.length} passage(s) modifié(s) déplacent donc les ${passages.length} vecteurs. Coût : nul.`
      );
    }
    const t = Date.now();
    contenu = construireIndexLexical(passages, cles, empreintes);
    log(`Vecteurs lexicaux calculés en ${Date.now() - t} ms · ${contenu.dimension.toLocaleString("fr-FR")} termes distincts`);
  } else {
    // Fournisseur distant : chaque vecteur est indépendant, on ne repaie donc
    // que les passages réellement modifiés.
    let aTraiter = aRecalculer;
    if (LIMITE !== null && aTraiter.length > LIMITE) {
      log(`  --limite=${LIMITE} : ${LIMITE} passage(s) traités sur ${aTraiter.length} à réindexer.`);
      aTraiter = aTraiter.slice(0, LIMITE);
    }
    const indexParCle = new Map(cles.map((c, i) => [c, i]));
    /** @type {(number[] | null)[]} */
    const vecteurs = passages.map((p, i) => connus.get(cles[i])?.vecteur ?? null);
    for (let i = 0; i < passages.length; i += 1) {
      const connu = connus.get(cles[i]);
      if (!connu || connu.empreinte !== empreintes[i] || FORCE) vecteurs[i] = null;
    }

    for (let debutLot = 0; debutLot < aTraiter.length; debutLot += TAILLE_LOT) {
      const lot = aTraiter.slice(debutLot, debutLot + TAILLE_LOT);
      const numero = Math.floor(debutLot / TAILLE_LOT) + 1;
      const total = Math.ceil(aTraiter.length / TAILLE_LOT);
      log(`  lot ${numero}/${total} — ${lot.length} passage(s)…`);
      const resultat = await embedderLotDistant(lot.map((p) => p.texte), FOURNISSEUR, "document");
      if ("erreur" in resultat) {
        // On n'abandonne pas tout le run pour un lot : ce qui est calculé reste
        // valide et le prochain lancement reprendra où ça a coincé — c'est tout
        // l'intérêt de l'idempotence par empreinte.
        erreurs.push(`Lot ${numero} : ${resultat.erreur}`);
        if (erreurs.length >= 3) {
          log("  Trop d'échecs consécutifs — arrêt anticipé pour ne pas brûler du quota.");
          break;
        }
        continue;
      }
      tokensConsommes += resultat.tokens;
      lot.forEach((passage, k) => {
        const position = indexParCle.get(clePassage(passage));
        if (position !== undefined) vecteurs[position] = resultat.vecteurs[k];
      });
      if (debutLot + TAILLE_LOT < aTraiter.length) await pause(PAUSE_ENTRE_LOTS_MS);
    }

    // Un passage sans vecteur ne peut pas entrer dans un index dense : il est
    // omis, et compté. Le moteur signalera au lecteur qu'il manque des passages.
    const gardes = [];
    for (let i = 0; i < passages.length; i += 1) if (vecteurs[i]) gardes.push(i);
    if (gardes.length === 0) echec(1, `Aucun vecteur obtenu. ${erreurs.join(" ")}`);
    const dimensions = new Set(gardes.map((i) => /** @type {number[]} */ (vecteurs[i]).length));
    if (dimensions.size > 1) {
      echec(1, `Dimensions incohérentes rendues par ${MODELE_EMBEDDING} : ${[...dimensions].join(", ")}.`);
    }
    if (gardes.length < passages.length) {
      log(`  ${passages.length - gardes.length} passage(s) sans vecteur, omis de l'index.`);
    }
    contenu = construireIndexDense(
      gardes.map((i) => /** @type {number[]} */ (vecteurs[i])),
      gardes.map((i) => cles[i]),
      gardes.map((i) => empreintes[i])
    );
  }

  const octets = ecrireIndex(contenu);
  const secondes = ((Date.now() - debut) / 1000).toFixed(1);
  const ok = erreurs.length === 0;

  if (SORTIE_JSON) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok,
          fichier: CHEMIN_INDEX,
          octets,
          passages: contenu.nb_passages,
          representation: contenu.representation,
          modele_embedding: contenu.modele_embedding,
          purges: obsoletes.length,
          tokens_consommes: tokensConsommes,
          duree_s: Number(secondes),
          erreurs,
        },
        null,
        2
      )}\n`
    );
  } else {
    log(`\n${"═".repeat(72)}`);
    log(`${contenu.nb_passages} passage(s) indexé(s) en ${secondes} s → ${CHEMIN_INDEX} (${taille(octets)})`);
    if (obsoletes.length > 0) log(`${obsoletes.length} passage(s) disparu(s) du corpus ont été retirés de l'index.`);
    if (tokensConsommes > 0) log(`${tokensConsommes.toLocaleString("fr-FR")} tokens facturés par ${MODELE_EMBEDDING}.`);
    if (erreurs.length > 0) {
      log(`${erreurs.length} erreur(s) :`);
      for (const e of erreurs.slice(0, 10)) log(`  - ${e}`);
      log("Relancer la même commande : seuls les passages manquants seront retraités.");
    } else {
      log("Index à jour. Le moteur /questions peut être interrogé, sans aucune clé.");
    }
    log("═".repeat(72));
  }

  process.exit(ok ? 0 : 1);
}

main().catch((erreur) => {
  echec(1, `exception non rattrapée : ${erreur?.stack ?? erreur}`);
});

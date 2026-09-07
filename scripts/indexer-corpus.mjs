/*
 * Indexeur vectoriel du corpus ATLAS — alimente le moteur de réponse prédictive (MP-4).
 *
 * Rôle dans le projet
 * -------------------
 * Le référentiel vit dans `data/seed/*.json` (267 fiches humaines, 44 fiches IA,
 * 201 fiches de gap). Ce script le découpe en PASSAGES, calcule un embedding par
 * passage chez Voyage AI, et les écrit dans la table `atlas_rag_passages` du projet
 * Supabase mutualisé. C'est la seule opération payante du pipeline hors questions.
 *
 * Découpage : un passage = UN CHAMP substantiel d'UNE fiche, jamais une fiche entière.
 * La thèse centrale, l'apport et les limites critiques d'un philosophe répondent à
 * trois questions différentes ; les fondre dans un seul vecteur les moyenne et rend
 * la recherche floue. Une fiche humaine produit donc jusqu'à 4 passages, une fiche IA
 * 2 + un par usage sectoriel, une fiche de gap jusqu'à 8.
 *
 * Idempotence — c'est la propriété structurante du script
 * -------------------------------------------------------
 * Chaque passage porte l'empreinte SHA-256 de son texte. Avant tout appel payant, le
 * script lit les empreintes déjà en base et ne calcule d'embedding QUE pour les
 * passages nouveaux ou dont le texte a changé. Conséquences voulues :
 *   - relancer le script sans avoir touché au corpus ne crée aucun doublon, ne
 *     déclenche aucun appel d'API, et ne coûte rien ;
 *   - corriger une seule fiche ne réindexe que les 3 ou 4 passages de cette fiche ;
 *   - l'écriture se fait en `upsert` sur la clé naturelle (type_fiche, fiche_id, champ),
 *     donc une interruption en plein lot est rattrapée au run suivant.
 * L'empreinte inclut le nom du modèle d'embedding : changer de modèle force donc un
 * recalcul complet, ce qui est le comportement correct (deux modèles produisent des
 * vecteurs incomparables).
 *
 * Usage
 * -----
 *   node scripts/indexer-corpus.mjs --dry-run        # simulation : n'appelle rien, n'écrit rien
 *   node scripts/indexer-corpus.mjs                  # indexation incrémentale (usage normal)
 *   node scripts/indexer-corpus.mjs --type=gap       # ne traiter qu'un référentiel
 *   node scripts/indexer-corpus.mjs --limite=50      # ne traiter que 50 passages (test de bout en bout)
 *   node scripts/indexer-corpus.mjs --force          # tout réindexer, même l'inchangé (coûteux)
 *   node scripts/indexer-corpus.mjs --purger         # supprimer en base les passages disparus du corpus
 *   node scripts/indexer-corpus.mjs --etat           # volumétrie de l'index, sans rien modifier
 *   node scripts/indexer-corpus.mjs --json           # sortie machine
 *   node scripts/indexer-corpus.mjs --aide
 *
 * Codes de sortie
 * ---------------
 *   0 — succès (y compris « rien à faire »)
 *   1 — échec d'exécution : API d'embedding ou base en erreur, indexation incomplète
 *   2 — usage ou configuration invalide : argument inconnu, variable d'environnement
 *       manquante, corpus illisible. Rien n'a été tenté, rien n'a été dépensé.
 *
 * Variables d'environnement (cf. .env.example)
 * --------------------------------------------
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY
 *   VOYAGE_MODELE_EMBEDDING (défaut voyage-4-lite), VOYAGE_DIMENSION_SORTIE (optionnel)
 * Le script charge `.env.local` puis `.env` s'ils existent — Node ne le fait pas seul
 * et l'auteur n'a pas à exporter ses clés à la main avant chaque lancement.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
// Bouchon d'embedding local, sans clé ni réseau. N'a AUCUNE valeur sémantique ;
// il ne sert qu'à éprouver la chaîne (cf. lib/embedding-factice.mjs). Import
// statique sans risque : ce module ne dépend que de node:crypto.
import {
  MODELE_FACTICE,
  embeddingFactice,
  embeddingFacticeAutorise,
  raisonRefusFactice,
} from "../lib/embedding-factice.mjs";

// `@supabase/supabase-js` est chargé DYNAMIQUEMENT, à la première écriture réelle.
// Raison : `--aide` et surtout `--dry-run` doivent fonctionner sur une copie du dépôt
// sans `npm install` — un import statique ferait échouer le script avec un
// ERR_MODULE_NOT_FOUND avant même d'avoir affiché quoi que ce soit. Le paquet est
// déjà déclaré dans package.json, aucune dépendance n'est ajoutée.

// ---------------------------------------------------------------------------
// Constantes de pilotage
// ---------------------------------------------------------------------------

/** Dimension imposée par supabase/schema.sql. Un écart = arrêt immédiat. */
const DIMENSION_ATTENDUE = 1024;

/** Taille d'un lot d'embeddings. Voyage accepte 128 entrées ; 96 laisse de la marge. */
const TAILLE_LOT_DEFAUT = 96;

/** Pause entre deux lots, pour ne pas se faire limiter par le fournisseur. */
const PAUSE_ENTRE_LOTS_MS = 400;

/** Tentatives par lot avant abandon (erreurs 429/5xx uniquement). */
const TENTATIVES_MAX = 4;

/** Longueur maximale d'un passage envoyé à l'API (garde-fou de coût et de format). */
const MAX_CARACTERES_PASSAGE = 4000;

/** Taille d'un lot d'écriture Supabase. Au-delà, la requête PostgREST devient lourde. */
const TAILLE_LOT_ECRITURE = 200;

const TYPES_VALIDES = ["humaine", "ia", "gap"];

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

const AIDE = `
INDEXEUR VECTORIEL DU CORPUS ATLAS (MP-4)

  node scripts/indexer-corpus.mjs [options]

Options
  --dry-run          Simulation complète : découpe le corpus, affiche ce qui serait
                     indexé, n'appelle AUCUNE API payante et n'écrit rien en base.
                     Ne nécessite aucune clé.
  --type=T           Restreindre à un référentiel : humaine | ia | gap.
  --limite=N         Ne traiter que les N premiers passages à (ré)indexer.
  --force            Réindexer même les passages inchangés (coûteux : tout le corpus).
  --purger           Supprimer de la base les passages qui ne sont plus dans le corpus.
  --etat             Afficher la volumétrie de l'index en base, puis sortir.
  --lot=N            Taille des lots d'embedding (défaut ${TAILLE_LOT_DEFAUT}, max 128).
  --embedding-factice
                     TEST UNIQUEMENT. Remplace l'appel à Voyage par un hachage
                     local déterministe : aucune clé, aucun coût, AUCUNE valeur
                     sémantique. Exige en plus ATLAS_EMBEDDING_FACTICE=1 dans
                     l'environnement, et refuse de démarrer en production.
                     Les lignes écrites portent modele_embedding =
                     « ${MODELE_FACTICE} » : un index factice se voit.
  --racine=CHEMIN    Racine du dépôt (défaut : dossier parent de ce script).
  --json             Sortie machine : un objet JSON sur stdout, rien d'autre.
  --aide, -h         Cette aide.

Codes de sortie : 0 succès · 1 échec d'exécution · 2 usage/configuration invalide.
`;

if (args.includes("--aide") || args.includes("-h")) {
  process.stdout.write(`${AIDE}\n`);
  process.exit(0);
}

const OPTIONS_CONNUES = [
  "--dry-run",
  "--force",
  "--purger",
  "--etat",
  "--json",
  "--embedding-factice",
  "--aide",
  "-h",
];
const OPTIONS_VALEUR = ["--type=", "--limite=", "--lot=", "--racine="];

const inconnus = args.filter(
  (a) => !OPTIONS_CONNUES.includes(a) && !OPTIONS_VALEUR.some((prefixe) => a.startsWith(prefixe))
);
if (inconnus.length > 0) {
  process.stderr.write(`Argument inconnu : ${inconnus.join(", ")}\n${AIDE}\n`);
  process.exit(2);
}

function valeurArg(prefixe) {
  const trouve = args.find((a) => a.startsWith(prefixe));
  return trouve === undefined ? null : trouve.slice(prefixe.length);
}

const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const PURGER = args.includes("--purger");
const ETAT_SEUL = args.includes("--etat");
const SORTIE_JSON = args.includes("--json");
const FACTICE_DEMANDE = args.includes("--embedding-factice");

const TYPE_FILTRE = valeurArg("--type=");
if (TYPE_FILTRE !== null && !TYPES_VALIDES.includes(TYPE_FILTRE)) {
  process.stderr.write(`--type invalide : "${TYPE_FILTRE}". Valeurs acceptées : ${TYPES_VALIDES.join(", ")}.\n`);
  process.exit(2);
}

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
const TAILLE_LOT = entierArg("--lot=", 1, 128, TAILLE_LOT_DEFAUT);

// Racine résolue depuis l'emplacement du script, comme scripts/valider-donnees.mjs :
// le cron et la CI ne lancent pas forcément la commande depuis la racine du dépôt.
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = valeurArg("--racine=") ?? path.resolve(ICI, "..");
const SEED = path.join(RACINE, "data", "seed");

// ---------------------------------------------------------------------------
// Journalisation
// ---------------------------------------------------------------------------

// En mode --json, stdout est réservé à l'objet final : tout le reste part sur stderr.
function log(message) {
  if (SORTIE_JSON) process.stderr.write(`${message}\n`);
  else process.stdout.write(`${message}\n`);
}

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
 * aucune dépendance nouvelle n'est ajoutée au projet) : `CLE=valeur`, guillemets
 * simples ou doubles optionnels, `#` en début de ligne pour un commentaire.
 * Ne surcharge JAMAIS une variable déjà présente dans l'environnement réel.
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

// Mode factice : deux verrous cumulatifs, le drapeau CLI ET la variable
// d'environnement. Une variable oubliée dans un shell ne suffit donc pas, et le
// drapeau seul non plus. Cf. lib/embedding-factice.mjs pour le troisième verrou
// (refus en production).
const FACTICE = FACTICE_DEMANDE && embeddingFacticeAutorise();
if (FACTICE_DEMANDE && !FACTICE) {
  echec(2, `--embedding-factice refusé : ${raisonRefusFactice()}.`);
}

const MODELE_EMBEDDING = FACTICE ? MODELE_FACTICE : process.env.VOYAGE_MODELE_EMBEDDING || "voyage-4-lite";
const DIMENSION_SORTIE = process.env.VOYAGE_DIMENSION_SORTIE
  ? Number.parseInt(process.env.VOYAGE_DIMENSION_SORTIE, 10)
  : null;

// ---------------------------------------------------------------------------
// Lecture du corpus
// ---------------------------------------------------------------------------
//
// Lecture directe des JSON et non via `lib/corpus.ts` : ce module est du TypeScript
// avec des alias de chemin `@/`, que Node ne sait pas charger sans build. La logique
// dupliquée se limite ici à un `JSON.parse` — aucun libellé, aucune règle métier de
// `lib/corpus.ts` n'est recopiée (la route API, elle, l'utilise bien).

function lireJson(chemin) {
  try {
    const contenu = JSON.parse(readFileSync(chemin, "utf-8"));
    if (!Array.isArray(contenu)) {
      echec(2, `${chemin} ne contient pas un tableau JSON à la racine.`);
    }
    return contenu;
  } catch (erreur) {
    echec(2, `Corpus illisible (${chemin}) : ${erreur.message}`);
    return [];
  }
}

function chargerCorpus() {
  const dossierHumaines = path.join(SEED, "fiches_humaines");
  if (!existsSync(dossierHumaines)) {
    echec(2, `Dossier introuvable : ${dossierHumaines}. Vérifier --racine.`);
  }
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
// Découpage en passages
// ---------------------------------------------------------------------------

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

function libelleChamp(champ) {
  if (LIBELLES_CHAMP[champ]) return LIBELLES_CHAMP[champ];
  if (champ.startsWith("usage_")) return `usage sectoriel — ${champ.slice(6).replace(/_/g, " ")}`;
  return champ.replace(/_/g, " ");
}

function nettoyer(valeur) {
  if (typeof valeur !== "string") return "";
  return valeur.replace(/\s+/g, " ").trim();
}

/**
 * Assemble le texte réellement embarqué : un en-tête d'ancrage puis le contenu.
 * L'en-tête est indispensable — un extrait isolé du type « Reste une dimension
 * irréductiblement humaine » ne veut rien dire hors de sa fiche, et son embedding
 * ne remonterait sur aucune question précise. Il coûte ~25 tokens par passage,
 * c'est le meilleur rapport qualité/prix du pipeline.
 */
function composerTexte(entete, contenu) {
  const texte = `${entete}\n${contenu}`;
  return texte.length > MAX_CARACTERES_PASSAGE ? `${texte.slice(0, MAX_CARACTERES_PASSAGE).trimEnd()}…` : texte;
}

function empreinteTexte(texte) {
  // Le modèle fait partie de l'empreinte : changer de modèle d'embedding doit
  // invalider tout l'index, sans quoi la table mélangerait deux espaces vectoriels.
  return createHash("sha256").update(`${MODELE_EMBEDDING}::${texte}`, "utf8").digest("hex");
}

function ajouterPassage(liste, { type_fiche, fiche_id, champ, titre_fiche, entete, contenu, metadonnees }) {
  const propre = nettoyer(contenu);
  // Seuil de substance : en dessous de 40 caractères, le champ est un reste de
  // génération ou un placeholder, pas un contenu interrogeable. L'indexer ferait
  // du bruit dans les résultats de recherche et coûterait un appel pour rien.
  if (propre.length < 40) return;
  const texte = composerTexte(entete, propre);
  liste.push({
    type_fiche,
    fiche_id,
    champ,
    titre_fiche,
    texte,
    empreinte: empreinteTexte(texte),
    metadonnees,
  });
}

function passagesHumaines(fiches) {
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
    for (const champ of ["these_centrale", "apport", "limites_critiques", "resonance_ia"]) {
      const contexte = [fiche.axe, fiche.sous_domaine, fiche.periode_courant].filter(Boolean).join(", ");
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

function passagesIA(fiches) {
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

    // Un passage par usage sectoriel : « que sait faire l'IA en pharmacie ? » est une
    // question à part entière, elle ne doit pas être noyée dans la fiche du modèle.
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

function passagesGap(fiches, nomsHumaines, nomsIA) {
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
    const entete = (champ) =>
      `Gap analysis « ${titre} »${gap.sujet ? ` — sujet : ${gap.sujet}` : ""}` +
      `${gap.substituabilite ? ` (substituabilité : ${gap.substituabilite.replace(/_/g, " ")})` : ""}` +
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

    // Les axes prospectifs sont regroupés en un seul passage : pris isolément, chacun
    // fait deux lignes et se distingue mal des autres ; ensemble ils forment le
    // « éventail des futurs » de la paire, qui est ce qu'on cherche à retrouver.
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

function construirePassages(corpus) {
  const nomsHumaines = new Map(corpus.humaines.map((f) => [f.id, f.nom ?? f.id]));
  const nomsIA = new Map(corpus.ia.map((f) => [f.id, f.nom ?? f.id]));

  let passages = [];
  if (TYPE_FILTRE === null || TYPE_FILTRE === "humaine") passages.push(...passagesHumaines(corpus.humaines));
  if (TYPE_FILTRE === null || TYPE_FILTRE === "ia") passages.push(...passagesIA(corpus.ia));
  if (TYPE_FILTRE === null || TYPE_FILTRE === "gap") passages.push(...passagesGap(corpus.gap, nomsHumaines, nomsIA));

  // Garde-fou : deux fiches ne doivent jamais partager (type, id, champ), sinon
  // l'upsert écraserait silencieusement l'une par l'autre.
  const vues = new Set();
  const doublons = [];
  passages = passages.filter((p) => {
    const cle = `${p.type_fiche}|${p.fiche_id}|${p.champ}`;
    if (vues.has(cle)) {
      doublons.push(cle);
      return false;
    }
    vues.add(cle);
    return true;
  });
  if (doublons.length > 0) {
    log(`⚠ ${doublons.length} passage(s) en doublon ignoré(s) — corpus à vérifier : ${doublons.slice(0, 5).join(", ")}`);
  }
  return passages;
}

// ---------------------------------------------------------------------------
// Client Supabase
// ---------------------------------------------------------------------------

async function clientSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) {
    echec(
      2,
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour écrire l'index.\n" +
        "        Copier .env.example vers .env.local et le renseigner (Supabase → Settings → API Keys),\n" +
        "        ou lancer `node scripts/indexer-corpus.mjs --dry-run` qui n'a besoin d'aucune clé."
    );
  }

  let createClient;
  try {
    ({ createClient } = await import("@supabase/supabase-js"));
  } catch (erreur) {
    echec(
      2,
      `@supabase/supabase-js introuvable (${erreur.message}). Lancer \`npm install\` à la racine du dépôt.`
    );
  }

  // La clé service_role contourne RLS : c'est indispensable ici (les tables
  // atlas_rag_* n'ont aucune policy publique) et strictement réservé à ce script
  // et aux routes serveur — jamais au navigateur.
  return createClient(url, cle, { auth: { persistSession: false } });
}

/**
 * Empreintes déjà en base, par clé naturelle.
 *
 * Deux requêtes plutôt qu'une, volontairement : la colonne `embedding` n'est JAMAIS
 * rapatriée (1024 flottants × ~2 850 lignes ≈ 30 Mo transférés à chaque lancement,
 * pour une information booléenne). On lit d'abord les empreintes, puis la liste
 * courte des lignes dont l'embedding est NULL — cas d'un run précédent interrompu.
 *
 * Pagination obligatoire : PostgREST plafonne une réponse à 1 000 lignes par défaut,
 * et le corpus en produit près du triple. Sans `.range()`, le script croirait
 * silencieusement que seuls 1 000 passages existent et réindexerait tout le reste
 * à chaque lancement — l'erreur la plus coûteuse possible ici.
 */
async function lireEmpreintesExistantes(supabase) {
  const index = new Map();
  const TAILLE_PAGE = 1000;

  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const { data, error } = await supabase
      .from("atlas_rag_passages")
      .select("type_fiche,fiche_id,champ,empreinte")
      .order("id", { ascending: true })
      .range(debut, debut + TAILLE_PAGE - 1);
    if (error) {
      echec(
        1,
        `Lecture de atlas_rag_passages impossible : ${error.message}\n` +
          "        La table existe-t-elle ? Exécuter supabase/schema.sql dans l'éditeur SQL du projet."
      );
    }
    for (const ligne of data ?? []) {
      index.set(`${ligne.type_fiche}|${ligne.fiche_id}|${ligne.champ}`, {
        empreinte: ligne.empreinte,
        aEmbedding: true,
      });
    }
    if (!data || data.length < TAILLE_PAGE) break;
  }

  // Lignes insérées sans vecteur : à retraiter même si leur empreinte n'a pas bougé.
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const { data, error } = await supabase
      .from("atlas_rag_passages")
      .select("type_fiche,fiche_id,champ")
      .is("embedding", null)
      .order("id", { ascending: true })
      .range(debut, debut + TAILLE_PAGE - 1);
    if (error) break; // information de confort : son absence ne justifie pas d'échouer
    for (const ligne of data ?? []) {
      const cle = `${ligne.type_fiche}|${ligne.fiche_id}|${ligne.champ}`;
      const connu = index.get(cle);
      if (connu) connu.aEmbedding = false;
    }
    if (!data || data.length < TAILLE_PAGE) break;
  }

  return index;
}

// ---------------------------------------------------------------------------
// Embeddings (Voyage AI)
// ---------------------------------------------------------------------------

const pause = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));

/**
 * Vectorise un lot de textes. `input_type: "document"` — la route /api/question
 * utilise "query" pour la question : c'est le mode asymétrique recommandé par
 * Voyage, et l'utiliser des deux côtés dégrade nettement le rappel.
 * Réessaie sur 429 et 5xx avec un back-off exponentiel ; échoue immédiatement sur
 * 400/401/403, qui ne se résoudront pas avec de la patience (clé, modèle, format).
 */
async function embedderLot(textes) {
  // Bouchon local : aucun appel réseau, aucun coût, aucune valeur sémantique.
  if (FACTICE) {
    return {
      vecteurs: textes.map((texte) => embeddingFactice(texte, DIMENSION_ATTENDUE)),
      tokens: 0,
    };
  }

  const cle = process.env.VOYAGE_API_KEY;
  const corps = { input: textes, model: MODELE_EMBEDDING, input_type: "document" };
  if (DIMENSION_SORTIE) corps.output_dimension = DIMENSION_SORTIE;

  let derniereErreur = "inconnue";
  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative += 1) {
    let reponse;
    try {
      reponse = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
        body: JSON.stringify(corps),
      });
    } catch (erreur) {
      derniereErreur = `réseau : ${erreur.message}`;
      await pause(1000 * 2 ** tentative);
      continue;
    }

    if (reponse.ok) {
      const donnees = await reponse.json();
      const vecteurs = (donnees.data ?? [])
        .slice()
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((d) => d.embedding);
      if (vecteurs.length !== textes.length) {
        return { erreur: `Voyage a rendu ${vecteurs.length} vecteurs pour ${textes.length} textes.` };
      }
      for (const vecteur of vecteurs) {
        if (!Array.isArray(vecteur) || vecteur.length !== DIMENSION_ATTENDUE) {
          return {
            erreur:
              `Dimension inattendue : ${vecteur?.length} rendu par « ${MODELE_EMBEDDING} », ` +
              `${DIMENSION_ATTENDUE} attendus par atlas_rag_passages. ` +
              "Changer de modèle impose de créer une nouvelle table, pas d'altérer celle-ci.",
          };
        }
      }
      return { vecteurs, tokens: donnees.usage?.total_tokens ?? 0 };
    }

    const texteErreur = await reponse.text().catch(() => "");
    derniereErreur = `HTTP ${reponse.status} ${texteErreur.slice(0, 300)}`;
    if (reponse.status !== 429 && reponse.status < 500) {
      return { erreur: `Voyage a refusé la requête (${derniereErreur}).` };
    }
    await pause(1000 * 2 ** tentative);
  }
  return { erreur: `Voyage injoignable après ${TENTATIVES_MAX} tentatives (${derniereErreur}).` };
}

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------

function repartition(passages) {
  const compteur = {};
  for (const p of passages) compteur[p.type_fiche] = (compteur[p.type_fiche] ?? 0) + 1;
  return compteur;
}

function estimerTokens(passages) {
  // Approximation volontairement grossière : ~3,6 caractères par token en français.
  // Sert à annoncer un ordre de grandeur AVANT de dépenser, pas à facturer.
  const caracteres = passages.reduce((total, p) => total + p.texte.length, 0);
  return { caracteres, tokens: Math.round(caracteres / 3.6) };
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------

async function main() {
  const debut = Date.now();

  // --- Mode --etat : simple diagnostic de l'index en base -------------------
  if (ETAT_SEUL) {
    const supabase = await clientSupabase();
    const { data, error } = await supabase.rpc("atlas_rag_statistiques");
    if (error) echec(1, `atlas_rag_statistiques indisponible : ${error.message}`);
    if (SORTIE_JSON) {
      process.stdout.write(`${JSON.stringify({ ok: true, etat: data ?? [] }, null, 2)}\n`);
    } else {
      log("ÉTAT DE L'INDEX VECTORIEL (atlas_rag_passages)");
      if (!data || data.length === 0) log("  (index vide — l'indexation n'a jamais été lancée)");
      for (const ligne of data ?? []) {
        log(
          `  ${ligne.type_fiche.padEnd(8)} ${String(ligne.nb_passages).padStart(5)} passages · ` +
            `${ligne.nb_fiches} fiches · ${ligne.nb_avec_embedding} vectorisés · modèles : ${(ligne.modeles ?? []).join(", ")}`
        );
      }
    }
    process.exit(0);
  }

  // --- Découpage ------------------------------------------------------------
  const corpus = chargerCorpus();
  const passages = construirePassages(corpus);
  if (passages.length === 0) {
    echec(2, "Aucun passage produit — corpus vide ou filtre --type trop restrictif.");
  }

  const parType = repartition(passages);
  const volume = estimerTokens(passages);
  log("INDEXATION DU CORPUS ATLAS → atlas_rag_passages");
  if (FACTICE) {
    log(
      "⚠ MODE EMBEDDING FACTICE — hachage local déterministe, aucun appel payant.\n" +
        "  L'index produit n'a AUCUNE valeur sémantique : il sert à éprouver la chaîne, pas à répondre.\n" +
        `  Les lignes écrites portent modele_embedding = « ${MODELE_FACTICE} ».\n` +
        "  Pour repasser au vrai modèle : relancer sans --embedding-factice (tout sera réindexé)."
    );
  }
  log(`Racine : ${RACINE}`);
  log(`Modèle d'embedding : ${MODELE_EMBEDDING} (dimension attendue ${DIMENSION_ATTENDUE})`);
  log(
    `Corpus : ${corpus.humaines.length} fiches humaines · ${corpus.ia.length} fiches IA · ${corpus.gap.length} fiches de gap`
  );
  log(
    `Passages construits : ${passages.length} ` +
      `(humaine ${parType.humaine ?? 0} · ia ${parType.ia ?? 0} · gap ${parType.gap ?? 0})`
  );
  log(`Volume total : ${volume.caracteres.toLocaleString("fr-FR")} caractères ≈ ${volume.tokens.toLocaleString("fr-FR")} tokens`);

  // --- Mode --dry-run : aucun appel, aucune écriture ------------------------
  if (DRY_RUN) {
    const echantillon = passages.slice(0, 3).map((p) => ({
      cle: `${p.type_fiche}/${p.fiche_id}/${p.champ}`,
      empreinte: p.empreinte.slice(0, 12),
      taille: p.texte.length,
      apercu: p.texte.slice(0, 180),
    }));
    if (SORTIE_JSON) {
      process.stdout.write(
        `${JSON.stringify(
          { ok: true, dry_run: true, passages: passages.length, par_type: parType, volume, echantillon },
          null,
          2
        )}\n`
      );
    } else {
      log("\nMode --dry-run : aucune API appelée, aucune écriture en base, aucun coût engagé.");
      log("Si l'index est vide, ce sont ces " + passages.length + " passages qui seraient vectorisés.");
      log("\nÉchantillon :");
      for (const e of echantillon) {
        log(`  ${e.cle}  [${e.empreinte}…]  ${e.taille} car.`);
        log(`    ${e.apercu.replace(/\n/g, " ")}…`);
      }
      log("\nPour indexer réellement : retirer --dry-run (les clés de .env.local sont alors requises).");
    }
    process.exit(0);
  }

  // --- Comparaison avec l'existant -----------------------------------------
  if (!process.env.VOYAGE_API_KEY && !FACTICE) {
    echec(
      2,
      "VOYAGE_API_KEY manquante. La renseigner dans .env.local (console Voyage AI → API Keys),\n" +
        "        ou utiliser --dry-run pour vérifier le découpage sans clé."
    );
  }

  const supabase = await clientSupabase();
  log("\nLecture des empreintes déjà indexées…");
  const existantes = await lireEmpreintesExistantes(supabase);
  log(`  ${existantes.size} passage(s) déjà en base.`);

  let aTraiter = passages.filter((p) => {
    if (FORCE) return true;
    const connu = existantes.get(`${p.type_fiche}|${p.fiche_id}|${p.champ}`);
    // Réindexer si : jamais vu · texte modifié · ligne présente mais sans vecteur
    // (cas d'un run précédent interrompu entre l'insertion et l'embedding).
    return !connu || connu.empreinte !== p.empreinte || !connu.aEmbedding;
  });

  const clesCorpus = new Set(passages.map((p) => `${p.type_fiche}|${p.fiche_id}|${p.champ}`));
  const obsoletes = [...existantes.keys()].filter((cle) => {
    if (!clesCorpus.has(cle)) {
      // Un filtre --type restreint le corpus courant : ne jamais considérer comme
      // obsolètes les passages d'un référentiel qu'on n'a pas chargé.
      const type = cle.split("|")[0];
      return TYPE_FILTRE === null || TYPE_FILTRE === type;
    }
    return false;
  });

  const totalACalculer = aTraiter.length;
  if (LIMITE !== null && aTraiter.length > LIMITE) {
    aTraiter = aTraiter.slice(0, LIMITE);
    log(`  --limite=${LIMITE} : ${aTraiter.length} passage(s) traités sur ${totalACalculer} à réindexer.`);
  }

  log(
    `À (ré)indexer : ${aTraiter.length} passage(s)` +
      `${FORCE ? " (--force : tout le corpus)" : ""} · inchangés : ${passages.length - totalACalculer} · ` +
      `obsolètes en base : ${obsoletes.length}`
  );

  if (aTraiter.length === 0 && obsoletes.length === 0) {
    log("\nRien à faire — l'index est déjà à jour. Aucun appel payant effectué.");
    if (SORTIE_JSON) process.stdout.write(`${JSON.stringify({ ok: true, indexes: 0, inchanges: passages.length }, null, 2)}\n`);
    process.exit(0);
  }

  // --- Embedding + écriture par lots ---------------------------------------
  const maintenant = new Date().toISOString();
  let indexes = 0;
  let tokensConsommes = 0;
  const erreurs = [];
  let tampon = [];

  async function viderTampon() {
    if (tampon.length === 0) return;
    for (let i = 0; i < tampon.length; i += TAILLE_LOT_ECRITURE) {
      const tranche = tampon.slice(i, i + TAILLE_LOT_ECRITURE);
      const { error } = await supabase
        .from("atlas_rag_passages")
        .upsert(tranche, { onConflict: "type_fiche,fiche_id,champ" });
      if (error) {
        erreurs.push(`Écriture refusée (${tranche.length} lignes) : ${error.message}`);
      } else {
        indexes += tranche.length;
      }
    }
    tampon = [];
  }

  for (let debutLot = 0; debutLot < aTraiter.length; debutLot += TAILLE_LOT) {
    const lot = aTraiter.slice(debutLot, debutLot + TAILLE_LOT);
    const numero = Math.floor(debutLot / TAILLE_LOT) + 1;
    const total = Math.ceil(aTraiter.length / TAILLE_LOT);
    log(`  lot ${numero}/${total} — ${lot.length} passage(s)…`);

    const resultat = await embedderLot(lot.map((p) => p.texte));
    if (resultat.erreur) {
      // On n'abandonne pas tout le run pour un lot : les lots déjà écrits restent
      // valides et le prochain lancement reprendra exactement là où ça a coincé
      // (c'est tout l'intérêt de l'idempotence par empreinte).
      erreurs.push(`Lot ${numero} : ${resultat.erreur}`);
      if (erreurs.length >= 3) {
        log("  Trop d'échecs consécutifs — arrêt anticipé pour ne pas brûler du quota.");
        break;
      }
      continue;
    }
    tokensConsommes += resultat.tokens;

    lot.forEach((passage, i) => {
      tampon.push({
        type_fiche: passage.type_fiche,
        fiche_id: passage.fiche_id,
        champ: passage.champ,
        titre_fiche: passage.titre_fiche,
        texte: passage.texte,
        empreinte: passage.empreinte,
        embedding: resultat.vecteurs[i],
        modele_embedding: MODELE_EMBEDDING,
        metadonnees: passage.metadonnees,
        updated_at: maintenant,
      });
    });

    if (tampon.length >= TAILLE_LOT_ECRITURE) await viderTampon();
    if (debutLot + TAILLE_LOT < aTraiter.length) await pause(PAUSE_ENTRE_LOTS_MS);
  }
  await viderTampon();

  // --- Purge des passages disparus du corpus -------------------------------
  let purges = 0;
  if (PURGER && obsoletes.length > 0) {
    for (const cle of obsoletes) {
      const [type_fiche, fiche_id, champ] = cle.split("|");
      const { error } = await supabase
        .from("atlas_rag_passages")
        .delete()
        .eq("type_fiche", type_fiche)
        .eq("fiche_id", fiche_id)
        .eq("champ", champ);
      if (error) erreurs.push(`Purge de ${cle} : ${error.message}`);
      else purges += 1;
    }
    log(`Purge : ${purges} passage(s) obsolète(s) supprimé(s).`);
  } else if (obsoletes.length > 0) {
    log(
      `${obsoletes.length} passage(s) sont en base mais plus dans le corpus ` +
        "(fiche supprimée ou champ vidé). Relancer avec --purger pour les retirer."
    );
  }

  // --- Rapport final --------------------------------------------------------
  const secondes = ((Date.now() - debut) / 1000).toFixed(1);
  const ok = erreurs.length === 0;

  if (SORTIE_JSON) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok,
          indexes,
          inchanges: passages.length - totalACalculer,
          obsoletes: obsoletes.length,
          purges,
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
    log(`${indexes} passage(s) indexé(s) en ${secondes} s · ${tokensConsommes.toLocaleString("fr-FR")} tokens facturés par Voyage.`);
    if (erreurs.length > 0) {
      log(`${erreurs.length} erreur(s) :`);
      for (const e of erreurs.slice(0, 10)) log(`  - ${e}`);
      log("Relancer la même commande : seuls les passages manquants seront retraités.");
    } else {
      log("Index à jour. Le moteur /questions peut être interrogé.");
    }
    log("═".repeat(72));
  }

  process.exit(ok ? 0 : 1);
}

main().catch((erreur) => {
  echec(1, `exception non rattrapée : ${erreur?.stack ?? erreur}`);
});

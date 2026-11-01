/*
 * Lot 5 — 2ᵉ canal de collecte : Spiderfoot (mégaprompt v1.1 §13.4 et §7.1).
 *
 * Rôle dans le projet
 * -------------------
 * Ce script alimente `data/seed/veille_queue.json` avec des PROPOSITIONS en attente,
 * exactement comme scripts/veille-rss.mjs (même format, même score de fiabilité
 * importé depuis veille-rss.mjs, même dédoublonnage par URL). Il ne publie rien :
 * aucune fiche du référentiel n'est modifiée ici, et le statut `en_attente` impose
 * une revue humaine (cf. docs/gouvernance-veille.md).
 *
 * Source des données
 * ------------------
 * Aucune instance Spiderfoot n'est déclarée à ce jour dans
 * `data/seed/veille_sources.json` (entrée `spiderfoot-osint`, actif: false). Ce
 * script consomme donc un EXPORT JSON de scan produit depuis l'interface
 * Spiderfoot (résultats du scan → téléchargement JSON) :
 *
 *   node scripts/spiderfoot.mjs --export=/chemin/vers/export-scan.json
 *
 * Format attendu : un objet `{ scan: {...}, events: [...] }` ou un simple tableau
 * d'événements `{ type, module, data, confidence, visibility, ... }`. Seuls les
 * événements dont le champ `data` est une URL http(s) sont retenus — ce sont les
 * seuls citables comme source. Les autres (adresses e-mail, blocs réseau, etc.)
 * sont ignorés : une adresse e-mail découverte par OSINT est une donnée personnelle
 * potentielle, elle n'a rien à faire dans la file.
 *
 * Brancher l'API live d'une instance (éviter l'export manuel) reste un chantier
 * ultérieur : il faudra déclarer l'URL de l'instance dans `veille_sources.json`
 * (et réactiver la source), ce qui est une décision de Julien.
 *
 * Usage
 * -----
 *   node scripts/spiderfoot.mjs --export=<fichier>              # écrit dans la file
 *   node scripts/spiderfoot.mjs --export=<fichier> --simulation # sans rien écrire
 *   node scripts/spiderfoot.mjs --fixture=<dossier> --simulation # hors ligne (tests)
 *   node scripts/spiderfoot.mjs --auto-test                     # assertions sur la fixture
 *   node scripts/spiderfoot.mjs --json ...                      # sortie machine
 *   node scripts/spiderfoot.mjs --aide
 *
 * Codes de sortie : 0 collecte terminée · 1 échec dur (fichiers illisibles) ·
 * 2 erreur d'usage (options manquantes, ou écriture demandée alors que la source
 * spiderfoot est déclarée inactive).
 *
 * Garde-fou d'écriture : en mode réel (sans --simulation), le script refuse
 * d'écrire si la source `spiderfoot` de `veille_sources.json` n'est pas déclarée
 * active — une collecte réelle doit correspondre à une source active, comme pour
 * les flux RSS (cf. note de l'entrée spiderfoot-osint dans veille_sources.json).
 */

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { scoreFiabilite } from "./veille-rss.mjs";

// Ce fichier est à la fois un exécutable et un module : la logique CLI ne tourne
// que si le fichier est lancé directement (même garde que veille-rss.mjs).
const LANCE_DIRECTEMENT = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const args = LANCE_DIRECTEMENT ? process.argv.slice(2) : [];

function valeur(nom, defaut) {
  const i = args.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
  if (i < 0) return defaut;
  const a = args[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : args[i + 1];
}
function a(nom) { return args.includes(`--${nom}`); }

const EXPORT = valeur("export", null);
const FIXTURE = valeur("fixture", null);
const CHEMIN_QUEUE = valeur("queue", null);
const SIMULATION = a("simulation");
const SORTIE_JSON = a("json");
const AUTO_TEST = a("auto-test");

if (LANCE_DIRECTEMENT && (a("aide") || a("h") || a("help"))) {
  console.log(`\nspiderfoot.mjs — 2ᵉ canal de veille (OSINT Spiderfoot) → file de validation.\n\n  --export=<fichier>   export JSON d'un scan Spiderfoot\n  --fixture=<dossier>  lit <dossier>/export-scan-exemple.json (hors ligne)\n  --queue=<chemin>     file cible (défaut : data/seed/veille_queue.json)\n  --simulation         collecte sans rien écrire\n  --json               sortie machine\n  --auto-test          assertions sur la fixture, hors ligne, sans écriture\n  --aide               cet aide\n\nRègle absolue : aucune fiche n'est modifiée automatiquement — statut en_attente.\n`);
  process.exit(0);
}

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHEMIN_SOURCES = path.join(RACINE, "data", "seed", "veille_sources.json");
const QUEUE_PAR_DEFAUT = path.join(RACINE, "data", "seed", "veille_queue.json");
const FIXTURE_PAR_DEFAUT = path.join(RACINE, "data", "fixtures", "spiderfoot");

function lireJSON(chemin, defaut) {
  if (!existsSync(chemin)) return defaut;
  try {
    return JSON.parse(readFileSync(chemin, "utf-8"));
  } catch (e) {
    console.error(`Fichier illisible : ${chemin} — ${e.message}`);
    process.exit(1);
  }
}

/** Extrait les événements d'un export Spiderfoot (objet {events:[...]} ou tableau). */
function extraireEvenements(exportJson) {
  if (Array.isArray(exportJson)) return exportJson;
  if (exportJson && Array.isArray(exportJson.events)) return exportJson.events;
  throw new Error("export Spiderfoot illisible : ni tableau ni objet avec un tableau `events`");
}

/** Garde uniquement les événements citables : data est une URL http(s), sans doublon. */
function urlsCariables(evenements) {
  const vus = new Set();
  const retenus = [];
  for (const ev of evenements) {
    const data = typeof ev?.data === "string" ? ev.data.trim() : "";
    if (!/^https?:\/\//i.test(data)) continue;
    if (vus.has(data)) continue;
    vus.add(data);
    retenus.push({ url: data, type: ev.type ?? "(type inconnu)", module: ev.module ?? "(module inconnu)" });
  }
  return retenus;
}

function construireProposition(sourceId, ev, dejaVues) {
  if (dejaVues.has(ev.url)) return null;
  const fiabilite = scoreFiabilite(ev.url);
  dejaVues.add(ev.url);
  return {
    id: crypto.randomUUID(),
    source_id: sourceId,
    // à requalifier manuellement (fiche_humaine / fiche_ia / gap) à la validation
    cible_type: "nouvelle_categorie",
    cible_id: null,
    contenu_propose: {
      titre: `[${ev.type}] ${ev.url}`,
      link: ev.url,
      date: null,
      resume: `Événement Spiderfoot de type ${ev.type} (module ${ev.module}) — URL découverte par scan OSINT, à ouvrir et à juger avant toute citation.`,
    },
    score_fiabilite: fiabilite.score,
    // Le score seul ne se conteste pas : on transporte ce sur quoi il repose,
    // pour que la revue humaine puisse le contredire en connaissance de cause.
    score_fiabilite_motif: fiabilite.motif,
    domaine_source: fiabilite.domaine,
    domaine_opaque: fiabilite.opaque,
    statut: "en_attente",
    created_at: new Date().toISOString(),
  };
}

function collecter({ cheminExport, cheminQueue, simulation }) {
  const sources = lireJSON(CHEMIN_SOURCES, []);
  const source = sources.find((s) => s.type === "spiderfoot");
  const sourceId = source?.id ?? "spiderfoot-osint";
  const sourceActive = Boolean(source?.actif && source?.url);

  if (!simulation && !sourceActive) {
    console.error(
      "Écriture refusée : la source spiderfoot n'est pas déclarée active dans data/seed/veille_sources.json. " +
      "Réactivation à faire par Julien (url de l'instance + actif: true), comme prévu par la note de l'entrée. " +
      "Relancer avec --simulation pour un essai sans écriture."
    );
    process.exit(2);
  }

  const exportJson = lireJSON(cheminExport, null);
  if (exportJson === null) {
    console.error(`Export illisible ou absent : ${cheminExport}`);
    process.exit(1);
  }
  const evenements = extraireEvenements(exportJson);
  const urls = urlsCariables(evenements);

  const queue = lireJSON(cheminQueue, []);
  const dejaVues = new Set(queue.map((q) => q.contenu_propose?.link).filter(Boolean));
  const nouvelles = urls
    .map((ev) => construireProposition(sourceId, ev, dejaVues))
    .filter(Boolean);

  if (nouvelles.length > 0 && !simulation) {
    writeFileSync(cheminQueue, JSON.stringify([...queue, ...nouvelles], null, 2));
  }

  return {
    source_id: sourceId,
    source_active: sourceActive,
    evenements_lus: evenements.length,
    urls_retenues: urls.length,
    ajoutees: nouvelles.length,
    nouvelles,
  };
}

// ---------------------------------------------------------------------------
// --auto-test : assertions hors ligne sur la fixture (aucune écriture)
// ---------------------------------------------------------------------------

function autoTest() {
  const dir = mkdtempSync(path.join(tmpdir(), "spiderfoot-test-"));
  try {
    const queueTest = path.join(dir, "veille_queue.json");
    writeFileSync(queueTest, "[]");
    const fixture = path.join(FIXTURE_PAR_DEFAUT, "export-scan-exemple.json");
    const bilan = collecter({ cheminExport: fixture, cheminQueue: queueTest, simulation: true });

    const erreurs = [];
    const attendre = (cond, message) => { if (!cond) erreurs.push(message); };

    attendre(bilan.evenements_lus === 6, `6 événements lus attendus, ${bilan.evenements_lus} lus`);
    attendre(bilan.urls_retenues === 3, `3 URL citables attendues (doublon et non-URL ignorés), ${bilan.urls_retenues} retenues`);
    attendre(bilan.ajoutees === 3, `3 propositions attendues, ${bilan.ajoutees} produites`);
    attendre(bilan.nouvelles.every((n) => n.statut === "en_attente"), "toutes les propositions doivent être en_attente");
    attendre(bilan.nouvelles.every((n) => n.source_id === "spiderfoot-osint"), "source_id doit être spiderfoot-osint");
    attendre(bilan.nouvelles.every((n) => typeof n.score_fiabilite === "number" && n.score_fiabilite_motif), "chaque proposition doit porter score + motif");
    const opaque = bilan.nouvelles.find((n) => n.domaine_opaque);
    attendre(Boolean(opaque) && opaque.score_fiabilite <= 0.15, "le redirecteur opaque (news.google.com) doit être drapeauté et scoré au plancher");
    const inconnu = bilan.nouvelles.find((n) => n.contenu_propose.link.includes(".invalid"));
    attendre(Boolean(inconnu) && inconnu.score_fiabilite === 0.4, "domaine hors table (.invalid) doit recevoir le score par défaut 0,4");
    attendre(!bilan.nouvelles.some((n) => n.contenu_propose.link.includes("@")), "aucune adresse e-mail ne doit entrer dans la file");
    // aucune écriture : la file de test doit être restée vide
    attendre(JSON.parse(readFileSync(queueTest, "utf-8")).length === 0, "--auto-test ne doit rien écrire dans la file");

    if (erreurs.length > 0) {
      console.error(`auto-test : ${erreurs.length} assertion(s) en échec`);
      for (const e of erreurs) console.error(`  ✗ ${e}`);
      return 1;
    }
    console.log(`auto-test : ${bilan.ajoutees} proposition(s) produites depuis la fixture, ${bilan.evenements_lus - bilan.urls_retenues} événement(s) ignoré(s) (doublon/non-URL), 0 écriture — toutes les assertions passent.`);
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

function main() {
  if (AUTO_TEST) {
    process.exit(autoTest());
  }

  const cheminExport = EXPORT ?? (FIXTURE ? path.join(FIXTURE, "export-scan-exemple.json") : null);
  if (!cheminExport) {
    console.error("Usage : --export=<fichier> ou --fixture=<dossier> (voir --aide)");
    process.exit(2);
  }
  const cheminQueue = CHEMIN_QUEUE ?? QUEUE_PAR_DEFAUT;

  const bilan = collecter({ cheminExport, cheminQueue, simulation: SIMULATION });

  if (SORTIE_JSON) {
    process.stdout.write(`${JSON.stringify({ simulation: SIMULATION, ...bilan }, null, 2)}\n`);
  } else {
    if (!bilan.source_active) {
      console.warn("Note : la source spiderfoot est déclarée inactive dans veille_sources.json — réactivation à faire par Julien avec l'URL de l'instance.");
    }
    console.log(`${bilan.evenements_lus} événement(s) lu(s), ${bilan.urls_retenues} URL citable(s), ${bilan.ajoutees} nouvelle(s) proposition(s)${SIMULATION ? " (SIMULATION — rien n'a été écrit)" : ` pour ${cheminQueue}`}.`);
    console.log("Rappel : aucune fiche n'est mise à jour automatiquement — validation manuelle requise (statut en_attente).");
  }
}

if (LANCE_DIRECTEMENT) {
  main();
}

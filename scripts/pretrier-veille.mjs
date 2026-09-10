/*
 * MP-7 — Pré-tri de la file de veille : rendre la relecture humaine tenable.
 *
 * Le problème que ce script résout
 * --------------------------------
 * La veille RSS tourne tous les jours à 07h00 UTC sur 26 sources et dépose une
 * trentaine de propositions par jour. Le tri, lui, est humain. L'écart se creuse
 * mécaniquement : entre le 7 et le 10 septembre 2026, la file est passée de 136 à
 * 238 propositions en attente sans qu'aucune décision n'ait été prise. Une file
 * qu'on ne lit plus ne protège plus rien.
 *
 * `docs/decisions-ouvertes-2026-09-07.md`, point 1, posait trois options. Ce script
 * est l'option C — pré-validation assistée : la machine trie, l'humain arbitre une
 * file déjà propre. La règle du projet reste intacte, et c'est le point important :
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ CE SCRIPT NE MODIFIE AUCUNE FICHE. Avec --appliquer, il ne fait qu'ÉCARTER  │
 * │ des propositions, jamais en accepter une. Écarter ne touche pas au corpus ; │
 * │ accepter, si. C'est pourquoi l'un peut s'automatiser et pas l'autre.        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Usage
 * -----
 *   node scripts/pretrier-veille.mjs                 # rapport seul, n'écrit que docs/
 *   node scripts/pretrier-veille.mjs --appliquer     # écarte aussi les cas mécaniques
 *   node scripts/pretrier-veille.mjs --sortie=/tmp/rapport.md
 *   node scripts/pretrier-veille.mjs --aide
 *
 * Les quatre motifs d'écartement, tous vérifiables sans jugement
 * --------------------------------------------------------------
 *   domaine_opaque      L'URL pointe sur un agrégateur qui masque l'éditeur réel
 *                       (news.google.com). On ne peut pas attribuer la source, donc
 *                       on ne peut pas la citer. Le score plancher le dit déjà.
 *   sans_lien           Pas d'URL exploitable : rien à vérifier, rien à citer.
 *   doublon_file        La même URL est déjà portée par une autre entrée. On garde
 *                       la plus ancienne — celle qui a la trace de collecte la plus
 *                       longue — et on écarte les suivantes.
 *   deja_dans_le_corpus L'URL est déjà citée en source par une fiche. La proposition
 *                       n'apporte rien de neuf.
 *
 * Tout le reste part en relecture humaine, classé par score de fiabilité décroissant
 * puis par proximité lexicale au corpus. Cette proximité ORDONNE la file, elle ne
 * ferme jamais une proposition : un sujet absent du corpus est peut-être exactement
 * le trou qu'il faut combler, et c'est un jugement d'humain, pas de script.
 *
 * Code de sortie : 0 en fonctionnement normal, y compris file vide. 1 si la file ou
 * le corpus sont illisibles.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const FILE = path.join(RACINE, "data/seed/veille_queue.json");
const DOSSIER_HUMAINES = path.join(RACINE, "data/seed/fiches_humaines");

const args = process.argv.slice(2);
const veutAide = args.includes("--aide") || args.includes("-h");
const veutAppliquer = args.includes("--appliquer");
const argSortie = args.find((a) => a.startsWith("--sortie="));

if (veutAide) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}

const aujourdhui = new Date().toISOString().slice(0, 10);
// Nom FIXE, réécrit à chaque passage. Un nom daté déposerait un fichier neuf par
// jour dans docs/ — 365 par an — et forcerait un commit quotidien du cron même les
// jours sans rien à écarter, le fichier non suivi rendant la condition toujours
// vraie. Le rapport est un état courant, pas un journal : l'historique est dans git.
const sortie = argSortie
  ? argSortie.slice("--sortie=".length)
  : path.join(RACINE, "docs/veille-pretri.md");

// ─────────────────────────────────────────────────────────────── lecture

function lireJson(chemin) {
  try {
    return JSON.parse(readFileSync(chemin, "utf8"));
  } catch (e) {
    console.error(`✗ Illisible : ${path.relative(RACINE, chemin)} — ${e.message}`);
    process.exit(1);
  }
}

const file = lireJson(FILE);

const fiches = [];
for (const f of readdirSync(DOSSIER_HUMAINES)) {
  if (f.endsWith(".json")) fiches.push(...lireJson(path.join(DOSSIER_HUMAINES, f)));
}
fiches.push(...lireJson(path.join(RACINE, "data/seed/fiches_ia.json")));

// URL déjà citées par une fiche, normalisées pour que
// https://x.org/a/ et http://x.org/a soient reconnues comme la même.
function normaliserUrl(u) {
  if (typeof u !== "string" || !u) return null;
  return u
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#]+$/, "");
}

const urlsDuCorpus = new Set();
for (const fiche of fiches) {
  for (const s of fiche.sources ?? []) {
    const n = normaliserUrl(s.url);
    if (n) urlsDuCorpus.add(n);
  }
}

// Lexique du corpus : les mots des noms de fiche et des sous-domaines. Il sert
// UNIQUEMENT à ordonner la file, jamais à écarter.
const MOTS_VIDES = new Set(
  ("le la les de des du un une et en au aux pour par sur dans avec sans " +
   "the of and to in for on a an is with from as at by").split(" ")
);

const lexique = new Set();
for (const fiche of fiches) {
  for (const champ of [fiche.nom, fiche.sous_domaine, fiche.axe]) {
    if (typeof champ !== "string") continue;
    for (const mot of champ.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (mot.length > 3 && !MOTS_VIDES.has(mot)) lexique.add(mot);
    }
  }
}

// ────────────────────────────────────────────────────────────── pré-tri

function lienDe(entree) {
  const c = entree.contenu_propose;
  if (!c || typeof c !== "object") return null;
  return c.link ?? c.url ?? null;
}

function texteDe(entree) {
  const c = entree.contenu_propose ?? {};
  return [c.titre, c.nom, c.resume, c.extrait, c.note].filter(Boolean).join(" ").toLowerCase();
}

function proximite(entree) {
  const mots = new Set(
    texteDe(entree)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((m) => m.length > 3 && !MOTS_VIDES.has(m))
  );
  let n = 0;
  for (const m of mots) if (lexique.has(m)) n += 1;
  return n;
}

const enAttente = file.filter((e) => e.statut === "en_attente");

// La détection de doublon se fait sur toute la file, pas seulement sur l'attente :
// une proposition déjà arbitrée ailleurs rend la nouvelle inutile.
const premiereOccurrence = new Map();
for (const e of [...file].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
  const n = normaliserUrl(lienDe(e));
  if (n && !premiereOccurrence.has(n)) premiereOccurrence.set(n, e.id);
}

const MOTIFS = {
  domaine_opaque: "Agrégateur masquant l'éditeur réel — source non attribuable",
  sans_lien: "Aucune URL exploitable dans la proposition",
  doublon_file: "URL déjà portée par une entrée antérieure de la file",
  deja_dans_le_corpus: "URL déjà citée en source par une fiche",
};

function motifDEcartement(entree) {
  const lien = lienDe(entree);
  const n = normaliserUrl(lien);
  if (!n) return "sans_lien";
  if (entree.domaine_opaque === true) return "domaine_opaque";
  if (urlsDuCorpus.has(n)) return "deja_dans_le_corpus";
  if (premiereOccurrence.get(n) !== entree.id) return "doublon_file";
  return null;
}

const aEcarter = [];
const aRelire = [];

for (const e of enAttente) {
  const motif = motifDEcartement(e);
  if (motif) aEcarter.push({ entree: e, motif });
  else aRelire.push({ entree: e, proximite: proximite(e) });
}

aRelire.sort(
  (a, b) =>
    (b.entree.score_fiabilite ?? 0) - (a.entree.score_fiabilite ?? 0) ||
    b.proximite - a.proximite ||
    String(a.entree.created_at).localeCompare(String(b.entree.created_at))
);

// ───────────────────────────────────────────────────────────── rapport

const parMotif = {};
for (const { motif } of aEcarter) parMotif[motif] = (parMotif[motif] ?? 0) + 1;

const parScore = {};
for (const { entree } of aRelire) {
  const s = entree.score_fiabilite ?? 0;
  parScore[s] = (parScore[s] ?? 0) + 1;
}

const lignes = [];
lignes.push(`# Pré-tri de la file de veille — ${aujourdhui}`);
lignes.push("");
lignes.push(
  `File complète : **${file.length}** entrées, dont **${enAttente.length}** en attente d'arbitrage.`
);
lignes.push("");
lignes.push(
  `Le pré-tri écarte **${aEcarter.length}** propositions sur des critères mécaniques et ` +
    `en laisse **${aRelire.length}** à la relecture humaine, classées par fiabilité décroissante.`
);
lignes.push("");
lignes.push("## Écartées, et pourquoi");
lignes.push("");
lignes.push("| Motif | Nombre | Ce que ça veut dire |");
lignes.push("|---|---:|---|");
for (const [motif, n] of Object.entries(parMotif).sort((a, b) => b[1] - a[1])) {
  lignes.push(`| \`${motif}\` | ${n} | ${MOTIFS[motif]} |`);
}
lignes.push("");
lignes.push(
  "Aucun de ces motifs ne porte de jugement sur le fond : ils constatent qu'une " +
    "proposition n'est pas citable, pas attribuable, ou déjà connue."
);
lignes.push("");
lignes.push("## À relire");
lignes.push("");
lignes.push("| Score | Nombre |");
lignes.push("|---:|---:|");
for (const [s, n] of Object.entries(parScore).sort((a, b) => Number(b[0]) - Number(a[0]))) {
  lignes.push(`| ${s} | ${n} |`);
}
lignes.push("");
lignes.push("### Les trente premières");
lignes.push("");
for (const { entree, proximite: p } of aRelire.slice(0, 30)) {
  const c = entree.contenu_propose ?? {};
  const titre = (c.titre ?? c.nom ?? "(sans titre)").replace(/\s+/g, " ").trim();
  lignes.push(
    `- **${entree.score_fiabilite}** · ${entree.domaine_source} · ${p} terme(s) du corpus  \n` +
      `  ${titre}  \n` +
      `  <${lienDe(entree)}>  \n` +
      `  \`${entree.id}\``
  );
}
lignes.push("");
lignes.push("---");
lignes.push("");
lignes.push(
  "Produit par `scripts/pretrier-veille.mjs`. Sans `--appliquer`, ce rapport est le " +
    "seul effet du script : la file n'est pas touchée."
);
lignes.push("");

writeFileSync(sortie, lignes.join("\n"), "utf8");

// ──────────────────────────────────────────────────────────── application

if (veutAppliquer && aEcarter.length > 0) {
  const parId = new Map(aEcarter.map(({ entree, motif }) => [entree.id, motif]));
  for (const e of file) {
    const motif = parId.get(e.id);
    if (!motif) continue;
    e.statut = "ecarte_automatique";
    e.ecarte_motif = motif;
    e.ecarte_le = aujourdhui;
  }
  writeFileSync(FILE, JSON.stringify(file, null, 2) + "\n", "utf8");
}

// ─────────────────────────────────────────────────────────────── console

console.log(`File           : ${file.length} entrées, ${enAttente.length} en attente`);
console.log(`Écartées       : ${aEcarter.length}`);
for (const [motif, n] of Object.entries(parMotif).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${motif.padEnd(20)} ${n}`);
}
console.log(`À relire       : ${aRelire.length}`);
const sortieAffichee = sortie.startsWith(RACINE + path.sep)
  ? path.relative(RACINE, sortie)
  : sortie;
console.log(`Rapport        : ${sortieAffichee}`);
console.log(
  veutAppliquer && aEcarter.length > 0
    ? "File mise à jour — les écartées passent en « ecarte_automatique »."
    : "File inchangée (ajouter --appliquer pour écarter les cas mécaniques)."
);

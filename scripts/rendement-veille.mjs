/*
 * MP-7 — Rendement de la veille, source par source.
 *
 * Pourquoi cet outil existe
 * -------------------------
 * La veille tourne tous les jours sur 26 sources et dépose une trentaine de
 * propositions. Personne n'avait jamais mesuré ce qu'elles rapportent. Le relevé du
 * 10/09/2026, sur les 425 propositions accumulées : **6 ont abouti** à un patch
 * appliqué ou à une fiche créée, soit 1,4 %. Deux sources en fournissent cinq —
 * `nature-news` et `openai-news`.
 *
 * Une source qui répond n'est pas une source qui nourrit. Les 18 flux d'actualité,
 * d'économie et de marchés ajoutés le 07/09 avaient tous été vérifiés flux en main :
 * ils répondent, ils publient, leurs URL sont bonnes. Mais le référentiel documente
 * des capacités humaines et des systèmes d'IA, pas la conjoncture — et un communiqué
 * de banque centrale ne parle ni d'Erik Erikson ni de Bruno Latour. Ce contrôle-là
 * manquait, et c'est celui que ce script rend permanent.
 *
 * Trois états, et la distinction compte
 * -------------------------------------
 *   abouti   le patch a été appliqué, ou une fiche a été créée — la seule mesure
 *            de valeur qui ne se discute pas ;
 *   écarté   un humain ou le pré-tri a jugé et rejeté ;
 *   en attente  personne n'a encore jugé. Ce n'est PAS un échec de la source : une
 *            source récente dont rien n'a été trié ne peut pas être condamnée sur
 *            un rendement nul. Le script sépare donc « jugé et stérile » de « jamais
 *            jugé », et ne calcule un rendement que sur ce qui a été jugé.
 *
 * Usage
 * -----
 *   node scripts/rendement-veille.mjs
 *   node scripts/rendement-veille.mjs --json
 *   node scripts/rendement-veille.mjs --seuil-alerte=0
 *
 * Code de sortie : toujours 0. Ce script mesure, il ne juge pas — désactiver une
 * source est une décision de portée éditoriale, elle revient à un humain.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");

const args = process.argv.slice(2);
if (args.includes("--aide") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}
const enJson = args.includes("--json");
const argSeuil = args.find((a) => a.startsWith("--seuil-alerte="));
const SEUIL_ALERTE = argSeuil ? Number(argSeuil.slice("--seuil-alerte=".length)) : 0;

const lire = (p) => JSON.parse(readFileSync(path.join(RACINE, p), "utf8"));

const file = lire("data/seed/veille_queue.json");
const sources = lire("data/seed/veille_sources.json");

const ABOUTI = new Set(["applique", "fiche_creee"]);
const ECARTE = new Set(["rejete", "ecarte_en_relecture", "ecarte_automatique"]);

const parSource = new Map();
for (const e of file) {
  const id = e.source_id || "(origine inconnue)";
  if (!parSource.has(id)) parSource.set(id, { id, total: 0, abouti: 0, ecarte: 0, attente: 0 });
  const s = parSource.get(id);
  s.total += 1;
  if (ABOUTI.has(e.statut)) s.abouti += 1;
  else if (ECARTE.has(e.statut)) s.ecarte += 1;
  else s.attente += 1;
}

const declarees = new Map(sources.map((s) => [s.id, s]));
for (const s of parSource.values()) {
  s.juge = s.abouti + s.ecarte;
  s.rendement = s.juge > 0 ? s.abouti / s.juge : null;
  s.declaree = declarees.has(s.id);
  s.libelle = declarees.get(s.id)?.nom ?? null;
}

const lignes = [...parSource.values()].sort((a, b) => b.total - a.total);
const total = lignes.reduce((a, s) => a + s.total, 0);
const abouti = lignes.reduce((a, s) => a + s.abouti, 0);
const juge = lignes.reduce((a, s) => a + s.juge, 0);

// Une source est « stérile » quand elle a été jugée en quantité suffisante et n'a
// rien produit. Le minimum de 10 évite de condamner une source sur trois items.
const MIN_JUGES = 10;
const steriles = lignes.filter((s) => s.juge >= MIN_JUGES && s.abouti <= SEUIL_ALERTE);
const jamaisJugees = lignes.filter((s) => s.juge === 0 && s.attente > 0);

if (enJson) {
  console.log(JSON.stringify({ total, abouti, juge, sources: lignes, steriles, jamais_jugees: jamaisJugees }, null, 2));
  process.exit(0);
}

console.log(`File : ${total} propositions, ${juge} jugées, ${abouti} abouties`);
console.log(
  juge > 0
    ? `Rendement sur ce qui a été jugé : ${((100 * abouti) / juge).toFixed(1)} %\n`
    : "Rien n'a encore été jugé.\n"
);

const c = (v, n) => String(v).padStart(n);
console.log(
  "source".padEnd(32) + c("total", 6) + c("jugé", 6) + c("abouti", 7) + c("attente", 8) + "  rendement"
);
for (const s of lignes) {
  const r = s.rendement === null ? "—" : `${(100 * s.rendement).toFixed(0)} %`;
  const marque = !s.declaree ? " ·" : "";
  console.log(s.id.padEnd(32) + c(s.total, 6) + c(s.juge, 6) + c(s.abouti, 7) + c(s.attente, 8) + c(r, 11) + marque);
}
console.log("\n· source absente de data/seed/veille_sources.json (collecte antérieure, ou source retirée)");

if (steriles.length > 0) {
  console.log(`\nJugées en quantité et stériles (au moins ${MIN_JUGES} jugées, ${SEUIL_ALERTE} abouti ou moins) :`);
  for (const s of steriles) console.log(`  ${s.id} — ${s.juge} jugées, ${s.abouti} abouti`);
  console.log("  Ces sources ont eu leur chance. Les garder est un choix, pas une évidence.");
}
if (jamaisJugees.length > 0) {
  const n = jamaisJugees.reduce((a, s) => a + s.attente, 0);
  console.log(`\nJamais jugées — ${jamaisJugees.length} sources, ${n} propositions en attente :`);
  console.log(`  ${jamaisJugees.map((s) => s.id).join(", ")}`);
  console.log("  Leur rendement est inconnu, pas nul. Elles ne peuvent pas être condamnées sur ce tableau.");
}

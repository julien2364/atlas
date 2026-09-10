/*
 * Cliquet de qualité — le corpus ne doit pas se dégrader en silence.
 *
 * Le problème
 * -----------
 * `auditer-corpus.mjs` est l'audit le plus profond du dépôt : 34 règles, 614 ms, aucun
 * appel réseau. Il relève aujourd'hui 0 défaut bloquant, 637 sérieux et 35 mineurs sur
 * 814 fiches. Et il **sort en code 0**. Il informe, il ne protège pas : rien
 * n'empêchait le nombre de défauts de doubler d'un commit à l'autre sans que personne
 * le voie. Il n'était d'ailleurs planifié dans aucun cron.
 *
 * Ce script en fait un cliquet. Il enregistre un niveau de référence par règle, et
 * refuse toute aggravation. Le corpus peut s'améliorer librement ; il ne peut plus
 * empirer par accident.
 *
 * Pourquoi un cliquet et pas un seuil absolu
 * ------------------------------------------
 * Exiger zéro défaut condamnerait le dépôt à un rouge permanent : 466 sources
 * primaires sans URL sont des œuvres imprimées — Einstein 1916, Watson et Crick 1953 —
 * et c'est une dette assumée, documentée, pas une négligence. Un cliquet accepte
 * l'état du jour comme point de départ et interdit seulement de reculer. C'est la
 * seule forme de garde-fou qui soit à la fois honnête sur la dette existante et
 * protectrice contre la dette nouvelle.
 *
 * Relever la référence est un geste délibéré : `--figer`. Il doit apparaître dans un
 * commit, avec sa raison. Ajouter 300 fiches fait mécaniquement monter plusieurs
 * compteurs, et c'est normal — mais cela doit être décidé, pas subi.
 *
 * Usage
 * -----
 *   node scripts/cliquet-qualite.mjs              # compare à la référence
 *   node scripts/cliquet-qualite.mjs --figer      # accepte l'état courant comme référence
 *   node scripts/cliquet-qualite.mjs --json
 *
 * Codes de sortie : 0 si rien n'a empiré, 1 sinon.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const REFERENCE = path.join(RACINE, "data/qualite-reference.json");

const args = process.argv.slice(2);
const FIGER = args.includes("--figer");
const JSON_SORTIE = args.includes("--json");

// L'audit écrit son JSON sur stdout ; on le lance en processus séparé plutôt que de le
// réimplémenter, pour qu'il n'existe qu'une définition des 34 règles.
const brut = execFileSync("node", [path.join(ICI, "auditer-corpus.mjs"), "--json"], {
  cwd: RACINE,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const audit = JSON.parse(brut);

const courant = {};
for (const c of audit.constats) courant[c.code] = { total: c.total, gravite: c.gravite };

if (FIGER || !existsSync(REFERENCE)) {
  const contenu = {
    commentaire:
      "Niveau de référence du cliquet de qualité. Chaque nombre est un plafond : une règle qui dépasse le sien fait échouer la CI. Relever un plafond se fait par `npm run cliquet -- --figer`, dans un commit qui en donne la raison.",
    fige_le: new Date().toISOString().slice(0, 10),
    fiches: audit.statistiques.fiches.total,
    plafonds: Object.fromEntries(Object.entries(courant).map(([k, v]) => [k, v.total])),
  };
  writeFileSync(REFERENCE, JSON.stringify(contenu, null, 2) + "\n", "utf8");
  console.log(
    `Référence ${FIGER ? "figée" : "créée"} sur ${audit.statistiques.fiches.total} fiches, ${Object.keys(courant).length} règles.`
  );
  process.exit(0);
}

const reference = JSON.parse(readFileSync(REFERENCE, "utf8"));
const plafonds = reference.plafonds ?? {};

const aggravations = [];
const ameliorations = [];
const nouvelles = [];

for (const [code, { total, gravite }] of Object.entries(courant)) {
  if (!(code in plafonds)) {
    if (total > 0) nouvelles.push({ code, total, gravite });
    continue;
  }
  const plafond = plafonds[code];
  if (total > plafond) aggravations.push({ code, gravite, plafond, total, ecart: total - plafond });
  else if (total < plafond) ameliorations.push({ code, plafond, total, gain: plafond - total });
}

const rapport = {
  ok: aggravations.length === 0 && nouvelles.length === 0,
  reference_fige_le: reference.fige_le,
  fiches_reference: reference.fiches,
  fiches_courant: audit.statistiques.fiches.total,
  aggravations,
  nouvelles,
  ameliorations,
};

if (JSON_SORTIE) {
  console.log(JSON.stringify(rapport, null, 2));
  process.exit(rapport.ok ? 0 : 1);
}

console.log(
  `Référence du ${reference.fige_le} (${reference.fiches} fiches) — corpus actuel : ${audit.statistiques.fiches.total} fiches`
);

if (ameliorations.length > 0) {
  console.log(`\n${ameliorations.length} règle(s) en amélioration :`);
  for (const a of ameliorations.sort((x, y) => y.gain - x.gain).slice(0, 10)) {
    console.log(`  ${a.code.padEnd(46)} ${a.plafond} → ${a.total}  (−${a.gain})`);
  }
}

if (rapport.ok) {
  console.log("\n✓ Aucune règle n'a empiré. Le cliquet tient.");
  if (ameliorations.length > 0) {
    console.log("  Des règles se sont améliorées : `npm run cliquet -- --figer` abaissera les plafonds d'autant.");
  }
  process.exit(0);
}

if (aggravations.length > 0) {
  console.log(`\n✗ ${aggravations.length} règle(s) ont empiré :`);
  for (const a of aggravations.sort((x, y) => y.ecart - x.ecart)) {
    console.log(`  ${a.gravite.padEnd(9)} ${a.code.padEnd(46)} ${a.plafond} → ${a.total}  (+${a.ecart})`);
  }
}
if (nouvelles.length > 0) {
  console.log(`\n✗ ${nouvelles.length} règle(s) absente(s) de la référence et non nulle(s) :`);
  for (const n of nouvelles) console.log(`  ${n.gravite.padEnd(9)} ${n.code.padEnd(46)} ${n.total}`);
}

console.log(
  "\nSoit le défaut est réel et se corrige, soit l'aggravation est assumée et se fige :"
);
console.log("  npm run cliquet -- --figer   (dans un commit qui en donne la raison)");
process.exit(1);

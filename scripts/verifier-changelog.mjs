/*
 * Garde-fou : le corpus ne grandit pas sans laisser de trace.
 *
 * Le défaut qu'il empêche
 * -----------------------
 * Le §10 du mégaprompt exige « un changelog public de toute évolution » et le §7.2
 * précise que chaque évolution doit dire pourquoi, quand et sur quelle observation.
 * `data/seed/changelog.json` existe, il compte des entrées soignées — et il s'est
 * arrêté au 07/09/2026.
 *
 * Entre-temps le corpus est passé de 311 à 828 fiches. Les 300 fiches de sociologie,
 * psychologie et géopolitique n'ont aucune entrée. Les onze fiches IA ajoutées les 10 et
 * 11 septembre non plus. Le référentiel a plus que doublé sans trace, et rien ne l'a
 * signalé — parce que le seul script qui écrivait au changelog était
 * `appliquer-patchs.mjs`, et qu'il n'a pas tourné depuis.
 *
 * Ce contrôle compare le nombre de fiches à ce que le changelog déclare avoir ajouté.
 * Il ne prétend pas juger la qualité d'une entrée : il constate qu'une population a
 * bougé sans qu'on l'écrive.
 *
 * Comment le compte est tenu
 * --------------------------
 * Chaque entrée peut porter un champ `fiches_ajoutees` : le nombre de fiches que ce
 * mouvement a introduites. Les entrées antérieures au 11/09/2026 n'en ont pas — elles
 * ont été écrites avant ce contrôle — et le fichier `data/changelog-socle.json` fixe
 * donc le point de départ : combien de fiches existaient quand le compte a commencé.
 *
 * Écart toléré : aucun. Ajouter des fiches sans l'écrire est précisément ce que le §10
 * interdit, et ce qui s'est produit.
 *
 * Usage
 * -----
 *   node scripts/verifier-changelog.mjs
 *   node scripts/verifier-changelog.mjs --json
 *   node scripts/verifier-changelog.mjs --caler   # aligne le socle sur l'état courant
 *
 * Code de sortie : 0 si le compte tombe juste, 1 sinon.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const SOCLE = path.join(RACINE, "data/changelog-socle.json");

const args = process.argv.slice(2);
if (args.includes("--aide") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}
const JSON_SORTIE = args.includes("--json");
const CALER = args.includes("--caler");

const lire = (p) => JSON.parse(readFileSync(path.join(RACINE, p), "utf8"));

let humaines = 0;
for (const f of readdirSync(path.join(RACINE, "data/seed/fiches_humaines"))) {
  if (f.endsWith(".json")) humaines += lire(`data/seed/fiches_humaines/${f}`).length;
}
const ia = lire("data/seed/fiches_ia.json").length;
const gap = lire("data/seed/fiches_gap.json").length;
const total = humaines + ia + gap;

const changelog = lire("data/seed/changelog.json");
const declarees = changelog.reduce((n, e) => n + (Number(e.fiches_ajoutees) || 0), 0);

if (CALER || !existsSync(SOCLE)) {
  writeFileSync(
    SOCLE,
    JSON.stringify(
      {
        commentaire:
          "Point de départ du compte des fiches. Les entrées de changelog antérieures au 11/09/2026 ne portent pas de champ `fiches_ajoutees` : elles ont été écrites avant ce contrôle. Ce socle dit combien de fiches existaient quand le compte a commencé. Le recaler est un geste délibéré, à faire dans un commit qui en donne la raison.",
        cale_le: new Date().toISOString().slice(0, 10),
        fiches_au_socle: total - declarees,
        detail: { humaines, ia, gap, total, declarees_au_changelog: declarees },
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`Socle calé : ${total - declarees} fiche(s) au départ, ${declarees} déclarée(s) au changelog, ${total} en tout.`);
  process.exit(0);
}

const socle = lire("data/changelog-socle.json");
const attendu = socle.fiches_au_socle + declarees;
const ecart = total - attendu;

const rapport = { total, attendu, ecart, socle: socle.fiches_au_socle, declarees, detail: { humaines, ia, gap } };

if (JSON_SORTIE) {
  console.log(JSON.stringify(rapport, null, 2));
  process.exit(ecart === 0 ? 0 : 1);
}

console.log(`Corpus : ${total} fiches (${humaines} humaines, ${ia} IA, ${gap} gaps)`);
console.log(`Changelog : socle ${socle.fiches_au_socle} + ${declarees} déclarée(s) = ${attendu}`);

if (ecart === 0) {
  console.log("\n✓ Chaque fiche ajoutée depuis le socle est déclarée au changelog.");
  process.exit(0);
}

if (ecart > 0) {
  console.log(`\n✗ ${ecart} fiche(s) ajoutée(s) sans entrée de changelog.`);
  console.log("  Le §10 du mégaprompt exige un changelog public de toute évolution.");
  console.log("  Ajoute une entrée à data/seed/changelog.json portant `fiches_ajoutees`,");
  console.log("  avec ce que ce mouvement apporte et sur quelle observation il repose.");
} else {
  console.log(`\n✗ Le changelog déclare ${-ecart} fiche(s) de plus que le corpus n'en contient.`);
  console.log("  Soit une entrée compte faux, soit des fiches ont été retirées sans être déclarées.");
}
process.exit(1);

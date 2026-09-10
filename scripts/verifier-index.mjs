/*
 * Garde-fou : l'index du moteur de réponse couvre-t-il encore tout le corpus ?
 *
 * Le défaut qu'il empêche
 * -----------------------
 * `data/index-vectoriel.json` est versionné au dépôt et lu par /questions. Il est
 * produit par `npm run indexer`, à la main, et rien ne le régénérait quand le corpus
 * changeait. Relevé le 10/09/2026 : l'index portait 2 855 passages pour un corpus qui
 * en comptait 4 011. **1 156 passages — 29 % du corpus, dont les 300 fiches de
 * sociologie, psychologie et géopolitique — étaient invisibles au moteur de réponse.**
 *
 * Rien ne le signalait. Pas d'erreur, pas de page cassée : simplement des réponses qui
 * ne citaient jamais un tiers du référentiel. C'est le pire genre de défaut, celui qui
 * ne se voit qu'en cherchant ce qui manque.
 *
 * Ce contrôle est le pendant de `valider-donnees.mjs` : celui-ci vérifie la cohérence
 * du corpus avec lui-même, celui-là sa cohérence avec l'index qui le sert.
 *
 * Usage
 * -----
 *   node scripts/verifier-index.mjs            # échoue si l'index est en retard
 *   node scripts/verifier-index.mjs --json
 *
 * Codes de sortie : 0 si l'index couvre exactement le corpus, 1 sinon — c'est voulu,
 * la CI doit rougir. Le correctif tient en une commande : `npm run indexer`.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { construirePassages, clePassage, empreintePassage } from "../lib/passages-corpus.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const CHEMIN_INDEX = path.join(RACINE, "data/index-vectoriel.json");

const enJson = process.argv.includes("--json");
const lire = (p) => JSON.parse(readFileSync(p, "utf8"));

if (!existsSync(CHEMIN_INDEX)) {
  console.error("✗ data/index-vectoriel.json est absent. Lancer : npm run indexer");
  process.exit(1);
}

const dossier = path.join(RACINE, "data/seed/fiches_humaines");
const humaines = [];
for (const f of readdirSync(dossier)) {
  if (f.endsWith(".json")) humaines.push(...lire(path.join(dossier, f)));
}
const passages = construirePassages({
  humaines,
  ia: lire(path.join(RACINE, "data/seed/fiches_ia.json")),
  gap: lire(path.join(RACINE, "data/seed/fiches_gap.json")),
});

const index = lire(CHEMIN_INDEX);
const modele = index.modele_embedding;

// L'index porte, en parallèle, la liste des clés et celle des empreintes. Comparer les
// deux permet de distinguer trois défauts que le seul comptage confondrait : un
// passage jamais indexé, un passage indexé puis modifié, et une entrée qui survit à la
// fiche disparue.
const clesIndex = new Map((index.cles ?? []).map((c, i) => [c, (index.empreintes ?? [])[i]]));

const absents = [];
const perimes = [];
for (const p of passages) {
  const cle = clePassage(p);
  if (!clesIndex.has(cle)) {
    absents.push(cle);
    continue;
  }
  // L'index ne conserve qu'un préfixe de l'empreinte SHA-256 — 64 bits, assez pour
  // détecter un changement de texte. On compare donc sur la longueur réellement
  // stockée plutôt que de redéclarer ici la constante de troncature du script
  // d'indexation : deux définitions de la même valeur finissent toujours par diverger.
  const stockee = clesIndex.get(cle);
  if (stockee !== empreintePassage(p.texte, modele).slice(0, stockee.length)) perimes.push(cle);
}
const clesCorpus = new Set(passages.map(clePassage));
const orphelines = [...clesIndex.keys()].filter((c) => !clesCorpus.has(c));

const aJour = absents.length === 0 && perimes.length === 0 && orphelines.length === 0;
const rapport = {
  a_jour: aJour,
  genere_le: index.genere_le,
  passages_corpus: passages.length,
  passages_index: index.nb_passages,
  absents: absents.length,
  perimes: perimes.length,
  orphelines: orphelines.length,
};

if (enJson) {
  console.log(JSON.stringify({ ...rapport, exemples: { absents: absents.slice(0, 10), perimes: perimes.slice(0, 10), orphelines: orphelines.slice(0, 10) } }, null, 2));
  process.exit(aJour ? 0 : 1);
}

console.log(`Index généré le ${String(index.genere_le).slice(0, 10)} — ${index.nb_passages} passages`);
console.log(`Corpus actuel                  — ${passages.length} passages`);

if (aJour) {
  console.log("\n✓ L'index couvre exactement le corpus. Le moteur de réponse voit tout.");
  process.exit(0);
}

console.log("");
if (absents.length > 0) console.log(`✗ ${absents.length} passage(s) du corpus absent(s) de l'index — invisibles au moteur`);
if (perimes.length > 0) console.log(`✗ ${perimes.length} passage(s) indexé(s) puis modifié(s) — le moteur lit une version ancienne`);
if (orphelines.length > 0) console.log(`✗ ${orphelines.length} entrée(s) d'index sans passage correspondant — fiche supprimée ou renommée`);

const exemples = [...absents.slice(0, 5), ...perimes.slice(0, 3), ...orphelines.slice(0, 3)];
if (exemples.length > 0) {
  console.log("\nExemples :");
  for (const c of exemples) console.log(`  ${c}`);
}
const part = ((100 * (absents.length + perimes.length)) / Math.max(passages.length, 1)).toFixed(1);
console.log(`\n${part} % du corpus n'est pas servi correctement par le moteur de réponse.`);
console.log("Correctif : npm run indexer");
process.exit(1);

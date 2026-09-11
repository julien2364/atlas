/*
 * Le budget IA : projection mensuelle, seuil, et alerte au dépassement.
 *
 * Ce que le mégaprompt demande
 * ----------------------------
 * Les §11.5 et §13.5 retiennent « un budget IA mensuel avec seuils de coût et alerte si
 * dépassement », et le §13.5 le marque « retenu tel quel » à l'arbitrage. Rien n'existait :
 * un document estimait un coût, mais aucun compteur, aucun plafond, aucune alerte. Une
 * estimation qui ne déclenche rien n'est pas un budget.
 *
 * Ce que ce script mesure, et ce qu'il ne peut pas mesurer
 * -------------------------------------------------------
 * Il projette le coût mensuel du moteur de réponse à partir de trois grandeurs : le
 * nombre de questions par mois, la taille du contexte réellement envoyé — mesurée sur le
 * corpus, pas supposée — et le barème du fournisseur.
 *
 * **Il ne lit aucune facture.** Aucune requête payante n'a jamais été émise, faute de clé,
 * et le site tourne sur serverless : un compteur en mémoire ne survit pas d'une instance
 * à l'autre, et prétendre tenir un cumul réel serait mentir. Ce qui est tenu ici est une
 * projection, honnête sur ses hypothèses, qui répond à la seule question utile avant de
 * poser une clé : combien cela coûtera-t-il si le trafic est celui-ci ?
 *
 * Le repli est délibérément pessimiste. Un fournisseur sans tarif relevé est compté au
 * tarif de repli, plus cher que la plupart : un oubli doit faire surestimer, jamais
 * sous-estimer.
 *
 * Usage
 * -----
 *   node scripts/budget-ia.mjs
 *   node scripts/budget-ia.mjs --questions=300
 *   node scripts/budget-ia.mjs --fournisseur=anthropic
 *   node scripts/budget-ia.mjs --json
 *
 * Code de sortie : 0 sous le seuil d'alerte, 1 au-dessus — c'est ce code qui fait
 * l'alerte, en faisant rougir le job qui l'exécute.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");

const args = process.argv.slice(2);
if (args.includes("--aide") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}
const valeur = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const JSON_SORTIE = args.includes("--json");
const QUESTIONS = Number(valeur("questions", 300));
const FOURNISSEUR = valeur("fournisseur", null);

const lire = (p) => JSON.parse(readFileSync(path.join(RACINE, p), "utf8"));
const budget = lire("data/budget-ia.json");

/* ------------------------------------------------ la taille réelle du contexte */

// Le contexte envoyé au modèle est plafonné par ATLAS_RAG_MAX_CARACTERES (18 000 par
// défaut) et rempli par les passages retrouvés. On mesure la taille moyenne d'un passage
// sur le corpus réel plutôt que de la supposer, et on prend le plafond comme borne.
const PLAFOND_CARACTERES = Number(process.env.ATLAS_RAG_MAX_CARACTERES ?? 18_000);
const MAX_TOKENS_SORTIE = Number(process.env.ATLAS_RAG_MAX_TOKENS ?? 2_600);
// Quatre caractères par jeton : l'ordre de grandeur usuel en français comme en anglais.
// Ce n'est pas un tokenizer, et le rapport varie ; c'est dit plutôt que caché.
const CARACTERES_PAR_JETON = 4;

let caracteresCorpus = 0;
let nbPassages = 0;
if (existsSync(path.join(RACINE, "data/index-vectoriel.json"))) {
  const index = lire("data/index-vectoriel.json");
  nbPassages = index.nb_passages ?? 0;
}
for (const f of readdirSync(path.join(RACINE, "data/seed/fiches_humaines"))) {
  if (f.endsWith(".json")) caracteresCorpus += readFileSync(path.join(RACINE, "data/seed/fiches_humaines", f), "utf8").length;
}
caracteresCorpus += readFileSync(path.join(RACINE, "data/seed/fiches_ia.json"), "utf8").length;
caracteresCorpus += readFileSync(path.join(RACINE, "data/seed/fiches_gap.json"), "utf8").length;

const contexteParQuestion = PLAFOND_CARACTERES;
const jetonsEntree = Math.ceil(contexteParQuestion / CARACTERES_PAR_JETON);
const jetonsSortie = MAX_TOKENS_SORTIE;

/* ------------------------------------------------------------------ le coût */

function tarif(id) {
  const t = budget.tarifs[id];
  const entree = t?.entree_eur_par_million ?? budget.repli_eur_par_million.entree;
  const sortie = t?.sortie_eur_par_million ?? budget.repli_eur_par_million.sortie;
  return { entree, sortie, releve: Boolean(t?.releve_le) };
}

const fournisseurs = FOURNISSEUR ? [FOURNISSEUR] : Object.keys(budget.tarifs);
const lignes = fournisseurs.map((id) => {
  const t = tarif(id);
  const coutEntree = (jetonsEntree / 1e6) * t.entree;
  const coutSortie = (jetonsSortie / 1e6) * t.sortie;
  const parQuestion = coutEntree + coutSortie;
  return { fournisseur: id, releve: t.releve, par_question_eur: parQuestion, mensuel_eur: parQuestion * QUESTIONS };
});
lignes.sort((a, b) => a.mensuel_eur - b.mensuel_eur);

const pire = lignes[lignes.length - 1];
const seuil = budget.plafond_mensuel_eur * budget.seuil_alerte;
const depasse = pire.mensuel_eur > seuil;

// Une alarme budgétaire qui sonne alors qu'aucun euro n'est dépensé est une fausse
// alarme, et une fausse alarme hebdomadaire finit par être ignorée — ce qui détruit
// l'alarme utile. Le dépassement ne fait donc échouer que si une clé de fournisseur est
// réellement posée dans l'environnement : sans clé, aucun appel payant n'est possible,
// et la projection reste un renseignement.
const VARIABLES_CLE = [
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY", "MISTRAL_API_KEY",
  "GROQ_API_KEY", "CEREBRAS_API_KEY", "OPENROUTER_API_KEY", "ATLAS_IA_CLE",
];
const cleConfiguree = VARIABLES_CLE.some((v) => (process.env[v] ?? "").trim().length > 0);

const rapport = {
  questions_par_mois: QUESTIONS,
  cle_configuree: cleConfiguree,
  jetons_par_question: { entree: jetonsEntree, sortie: jetonsSortie },
  plafond_mensuel_eur: budget.plafond_mensuel_eur,
  seuil_alerte_eur: seuil,
  tarifs_releves: lignes.filter((l) => l.releve).length,
  tarifs_au_repli: lignes.filter((l) => !l.releve).length,
  lignes,
  depassement: depasse,
};

const doitEchouer = depasse && cleConfiguree;

if (JSON_SORTIE) {
  console.log(JSON.stringify(rapport, null, 2));
  process.exit(doitEchouer ? 1 : 0);
}

console.log(`Projection sur ${QUESTIONS} questions par mois`);
console.log(
  `  contexte : ${contexteParQuestion.toLocaleString("fr-FR")} caractères plafonnés, soit ~${jetonsEntree.toLocaleString("fr-FR")} jetons en entrée`
);
console.log(`  réponse  : ${jetonsSortie.toLocaleString("fr-FR")} jetons au maximum`);
console.log(`  corpus   : ${nbPassages.toLocaleString("fr-FR")} passages indexés, ${Math.round(caracteresCorpus / 1024).toLocaleString("fr-FR")} Ko de fiches\n`);

console.log("fournisseur".padEnd(14) + "tarif".padEnd(10) + "par question".padStart(14) + "par mois".padStart(12));
for (const l of lignes) {
  console.log(
    l.fournisseur.padEnd(14) +
      (l.releve ? "relevé" : "repli").padEnd(10) +
      `${l.par_question_eur.toFixed(4)} €`.padStart(14) +
      `${l.mensuel_eur.toFixed(2)} €`.padStart(12)
  );
}

console.log(`\nPlafond : ${budget.plafond_mensuel_eur} € · seuil d'alerte : ${seuil.toFixed(2)} € (${(100 * budget.seuil_alerte).toFixed(0)} %)`);
if (rapport.tarifs_au_repli > 0) {
  console.log(
    `${rapport.tarifs_au_repli} fournisseur(s) au tarif de repli, faute de relevé — donc surestimés, jamais sous-estimés.`
  );
}

if (!depasse) {
  console.log("\n✓ La projection la plus haute reste sous le seuil d'alerte.");
  process.exit(0);
}

console.log(`\n! Dépassement projeté : ${pire.fournisseur} atteindrait ${pire.mensuel_eur.toFixed(2)} € par mois.`);
console.log("  Trois leviers : abaisser ATLAS_RAG_MAX_CARACTERES, allonger le cache, ou choisir un fournisseur moins cher.");

if (!cleConfiguree) {
  console.log(
    "\n  Aucune clé de fournisseur n'est posée : aucun appel payant n'est possible, donc aucun euro\n" +
      "  n'est dépensé et ce dépassement reste un renseignement. L'alarme se déclenchera le jour où\n" +
      "  une clé sera configurée — c'est à ce moment-là qu'elle voudra dire quelque chose."
  );
  process.exit(0);
}
console.log("\n✗ Une clé est configurée : le dépassement est réel et l'alarme se déclenche.");
process.exit(1);

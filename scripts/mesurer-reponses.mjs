/*
 * Banc d'essai du moteur de réponse — la mesure qui manquait.
 *
 * Pourquoi ce script existe
 * -------------------------
 * Régler un moteur de recherche à l'œil ne marche pas. On change un poids, on
 * relit cinq réponses, on trouve que « c'est mieux », et une fois sur deux c'est
 * pire — mesuré : un premier réglage du poids du cœur de fiche a amélioré cinq
 * questions et dégradé cinq autres, ce qui était invisible sans compter.
 *
 * Ce script compare les réponses du moteur à `data/questions-etalon.json`, qui
 * fixe pour chaque question les fiches qu'une bonne réponse DOIT mobiliser. Deux
 * nombres en sortent :
 *
 *   PIVOT   part des questions dont la fiche pivot est acceptable. C'est le
 *           chiffre qui compte le plus : le pivot détermine tout le croisement.
 *   RAPPEL  part des questions dont au moins une fiche attendue apparaît dans
 *           les cinq perspectives.
 *
 * Il faut un serveur qui tourne (`npm start` ou `npm run dev`). Le plafond de
 * requêtes du site étant de 5 par minute, poser `ATLAS_QUESTIONS_PAR_MINUTE` au
 * lancement du serveur, sans quoi la campagne s'arrête à la sixième question.
 *
 * Usage
 * -----
 *   ATLAS_QUESTIONS_PAR_MINUTE=500 npm start &
 *   node scripts/mesurer-reponses.mjs
 *   node scripts/mesurer-reponses.mjs --url=http://localhost:3001 --json
 *   node scripts/mesurer-reponses.mjs --comparer=data/mesures/2026-09-11.json
 *
 * Codes de sortie : 0 · 1 serveur injoignable ou étalon illisible.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const ETALON = path.join(RACINE, "data/questions-etalon.json");
const DOSSIER = path.join(RACINE, "data/mesures");

const args = process.argv.slice(2);
const valeur = (nom, defaut = null) => {
  const t = args.find((a) => a.startsWith(`--${nom}=`));
  return t ? t.slice(nom.length + 3) : defaut;
};

if (args.includes("--aide")) {
  console.log(`mesurer-reponses.mjs — compare le moteur à data/questions-etalon.json.

  --url=...        base du serveur (défaut http://localhost:3000)
  --comparer=F     compare le résultat à une mesure enregistrée
  --enregistrer    écrit la mesure dans data/mesures/<date>.json
  --json           sortie machine
  --aide`);
  process.exit(0);
}

const BASE = valeur("url", "http://localhost:3000");
const COMPARER = valeur("comparer");

const etalon = JSON.parse(readFileSync(ETALON, "utf8"));

/** Identifiant de fiche depuis le nom affiché : on compare des ids, pas des libellés. */
function idsDeLaReponse(reponse) {
  // `fiches_mobilisees` porte les identifiants ; `croisements` ne porte que les
  // noms. On croise les deux : l'ordre vient des croisements (le pivot est en
  // tête), les identifiants viennent des fiches mobilisées.
  const parNom = new Map();
  for (const f of reponse.fiches_mobilisees ?? []) parNom.set(f.titre ?? f.nom, f.fiche_id ?? f.id);
  const ordre = (reponse.croisements ?? []).map((c) => parNom.get(c.fiche) ?? null);
  return {
    pivot: ordre[0] ?? null,
    tous: ordre.filter(Boolean),
    noms: (reponse.croisements ?? []).map((c) => c.fiche),
  };
}

async function interroger(question) {
  const r = await fetch(`${BASE}/api/question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (r.status === 429) throw new Error("plafond de requêtes atteint — relancer le serveur avec ATLAS_QUESTIONS_PAR_MINUTE=500");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const lignes = [];
let pivotsBons = 0;
let rappels = 0;
let refus = 0;

for (const cas of etalon.questions) {
  let reponse;
  try {
    reponse = await interroger(cas.question);
  } catch (erreur) {
    console.error(`Erreur sur « ${cas.question} » : ${erreur.message}`);
    process.exit(1);
  }
  if (reponse.diagnostic?.statut !== "repondue") {
    refus += 1;
    lignes.push({ question: cas.question, statut: reponse.diagnostic?.statut ?? "inconnu", pivot: null, pivot_bon: false, rappel: false, noms: [] });
    continue;
  }
  const { pivot, tous, noms } = idsDeLaReponse(reponse);
  const pivotBon = pivot !== null && cas.pivot_acceptable.includes(pivot);
  const rappel = tous.some((id) => cas.attendues.includes(id));
  if (pivotBon) pivotsBons += 1;
  if (rappel) rappels += 1;
  lignes.push({ question: cas.question, statut: "repondue", pivot, pivot_bon: pivotBon, rappel, noms });
}

const total = etalon.questions.length;
const mesure = {
  mesure_le: new Date().toISOString().slice(0, 10),
  total,
  pivot_acceptable: pivotsBons,
  rappel_at_5: rappels,
  refus,
  taux_pivot: Math.round((pivotsBons / total) * 1000) / 1000,
  taux_rappel: Math.round((rappels / total) * 1000) / 1000,
  lignes,
};

if (args.includes("--enregistrer")) {
  mkdirSync(DOSSIER, { recursive: true });
  const chemin = path.join(DOSSIER, `${mesure.mesure_le}.json`);
  writeFileSync(chemin, `${JSON.stringify(mesure, null, 1)}\n`, "utf8");
  console.log(`Mesure enregistrée dans ${path.relative(RACINE, chemin)}`);
}

if (args.includes("--json")) {
  console.log(JSON.stringify(mesure, null, 2));
} else {
  for (const l of lignes) {
    const marque = l.statut !== "repondue" ? "REFUS" : l.pivot_bon ? "  ok " : l.rappel ? " ~   " : "  KO ";
    console.log(`${marque} ${l.question}`);
    if (l.noms.length > 0) console.log(`       ${l.noms.join(" · ")}`);
  }
  console.log("");
  console.log(`PIVOT acceptable : ${pivotsBons}/${total}  (${(mesure.taux_pivot * 100).toFixed(0)} %)`);
  console.log(`RAPPEL @5        : ${rappels}/${total}  (${(mesure.taux_rappel * 100).toFixed(0)} %)`);
  if (refus > 0) console.log(`REFUS            : ${refus}/${total}`);
}

if (COMPARER && existsSync(path.resolve(RACINE, COMPARER))) {
  const avant = JSON.parse(readFileSync(path.resolve(RACINE, COMPARER), "utf8"));
  const dPivot = mesure.pivot_acceptable - avant.pivot_acceptable;
  const dRappel = mesure.rappel_at_5 - avant.rappel_at_5;
  const signe = (n) => (n > 0 ? `+${n}` : String(n));
  console.log("");
  console.log(`Contre ${avant.mesure_le} : pivot ${signe(dPivot)}, rappel ${signe(dRappel)}`);
  const avantParQuestion = new Map(avant.lignes.map((l) => [l.question, l]));
  for (const l of lignes) {
    const a = avantParQuestion.get(l.question);
    if (!a) continue;
    if (a.pivot_bon && !l.pivot_bon) console.log(`  RÉGRESSION  ${l.question}\n              pivot : ${a.pivot} → ${l.pivot}`);
    if (!a.pivot_bon && l.pivot_bon) console.log(`  gain        ${l.question}\n              pivot : ${a.pivot} → ${l.pivot}`);
  }
}

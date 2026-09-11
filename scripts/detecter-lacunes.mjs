/*
 * Le premier maillon de l'autonomie : savoir ce qui manque.
 *
 * Pourquoi ce script existe
 * -------------------------
 * Un référentiel qui doit s'incrémenter seul a d'abord besoin de mesurer sa propre
 * incomplétude. Sans cela il ne peut que réagir à ce qu'une source lui apporte — ce
 * que faisait la veille, avec le rendement qu'on sait : 8 aboutissements sur 425
 * propositions, parce que les flux parlaient de ce qu'ils voulaient et non de ce qui
 * manquait au corpus.
 *
 * Ce script inverse la relation. Il compare le corpus à `data/attentes-megaprompt.json`
 * — les exigences des sections 3 et 4 du mégaprompt, encodées sous une forme
 * vérifiable — et produit la liste de ce qui n'est pas couvert, avec pour chaque
 * manque la requête de recherche qui servirait à le combler.
 *
 * L'audit d'écart du 11/09/2026 a montré ce que coûte son absence : une quinzaine
 * d'exigences explicites — Gemini, Mistral et Qwen nommément demandés, trois des six
 * limites transversales, AlphaGenome, le classement des philosophes par courant, les
 * indicateurs World Values Survey et OCDE — n'étaient mentionnées dans aucun document
 * du projet après six lots de production. Personne ne les avait oubliées par
 * négligence : rien ne les rappelait.
 *
 * Comment la couverture est jugée
 * -------------------------------
 * Chaque item porte des `indices` : des fragments de texte, sans accent ni casse, dont
 * la présence dans le corpus atteste qu'il est traité. La recherche porte sur les noms
 * de fiche, les identifiants, les sous-domaines, les périodes et courants, et les
 * champs de contenu. C'est délibérément mécanique et sans jugement : le script signale
 * une absence de trace, pas une absence de qualité. Un item « couvert » peut l'être
 * mal — c'est l'affaire de l'audit de fond, pas de celui-ci.
 *
 * Trois états, et la nuance compte :
 *   couvert   au moins une fiche porte un indice dans son nom ou son identifiant ;
 *   effleure  un indice n'apparaît que dans le corps d'une fiche consacrée à autre
 *             chose — le sujet est mentionné, pas documenté ;
 *   absent    aucune trace.
 *
 * Usage
 * -----
 *   node scripts/detecter-lacunes.mjs
 *   node scripts/detecter-lacunes.mjs --json
 *   node scripts/detecter-lacunes.mjs --requetes      # les requêtes à enquêter
 *   node scripts/detecter-lacunes.mjs --seuil=0.75    # échoue sous ce taux de couverture
 *
 * Code de sortie : 0, sauf si `--seuil` est donné et que la couverture est dessous.
 * Sans seuil, ce script mesure et n'arrête rien : combler une lacune est un travail,
 * pas une correction.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");

const args = process.argv.slice(2);
if (args.includes("--aide") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}
const JSON_SORTIE = args.includes("--json");
const REQUETES = args.includes("--requetes");
const argSeuil = args.find((a) => a.startsWith("--seuil="));
const SEUIL = argSeuil ? Number(argSeuil.slice("--seuil=".length)) : null;

const lire = (p) => JSON.parse(readFileSync(path.join(RACINE, p), "utf8"));

/** Sans accent, sans casse : les indices sont écrits ainsi, les fiches non. */
const plat = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const attentes = lire("data/attentes-megaprompt.json");

const humaines = [];
for (const f of readdirSync(path.join(RACINE, "data/seed/fiches_humaines"))) {
  if (f.endsWith(".json")) humaines.push(...lire(`data/seed/fiches_humaines/${f}`));
}
const ia = lire("data/seed/fiches_ia.json");
const gap = lire("data/seed/fiches_gap.json");

/**
 * Deux surfaces de recherche par fiche, et c'est ce qui distingue « couvert » de
 * « effleuré » : l'identité (nom, id, sous-domaine, courant) dit de quoi la fiche
 * traite ; le corps dit ce qu'elle mentionne.
 */
function surfaces(fiches) {
  return fiches.map((f) => ({
    id: f.id,
    identite: plat([f.nom, f.id, f.sous_domaine, f.periode_courant, f.axe].filter(Boolean).join(" · ")),
    corps: plat(JSON.stringify(f)),
  }));
}
const parReferentiel = { humain: surfaces(humaines), ia: surfaces(ia), gap: surfaces(gap) };
const tout = [...parReferentiel.humain, ...parReferentiel.ia, ...parReferentiel.gap];

function evaluer(item, portee) {
  const indices = item.indices.map(plat);
  const parIdentite = portee.filter((f) => indices.some((i) => f.identite.includes(i)));
  if (parIdentite.length > 0) return { etat: "couvert", fiches: parIdentite.map((f) => f.id).slice(0, 5), nb: parIdentite.length };
  const parCorps = portee.filter((f) => indices.some((i) => f.corps.includes(i)));
  if (parCorps.length > 0) return { etat: "effleure", fiches: parCorps.map((f) => f.id).slice(0, 5), nb: parCorps.length };
  return { etat: "absent", fiches: [], nb: 0 };
}

const resultats = [];
for (const groupe of attentes.attentes) {
  const portee = groupe.referentiel === "ia" ? parReferentiel.ia : groupe.referentiel === "humain" ? parReferentiel.humain : tout;
  for (const item of groupe.items) {
    // Un item d'un référentiel peut être traité dans l'autre : on regarde d'abord
    // chez lui, puis partout, pour ne pas déclarer absent ce qui est mal rangé.
    let r = evaluer(item, portee);
    if (r.etat === "absent") {
      const ailleurs = evaluer(item, tout);
      if (ailleurs.etat !== "absent") r = { ...ailleurs, etat: ailleurs.etat === "couvert" ? "couvert_ailleurs" : "effleure" };
    }
    resultats.push({
      groupe: groupe.id,
      section: groupe.section,
      nature: groupe.nature,
      referentiel: groupe.referentiel,
      nom: item.nom,
      requete: item.requete ?? null,
      ...r,
    });
  }
}

const compte = { couvert: 0, couvert_ailleurs: 0, effleure: 0, absent: 0 };
for (const r of resultats) compte[r.etat] += 1;
const total = resultats.length;
const couverture = (compte.couvert + compte.couvert_ailleurs) / total;

const aCombler = resultats.filter((r) => r.etat === "absent" || r.etat === "effleure");

if (REQUETES) {
  for (const r of aCombler) {
    console.log(`${r.groupe}\t${r.etat}\t${r.requete ?? r.nom}`);
  }
  process.exit(0);
}

if (JSON_SORTIE) {
  console.log(JSON.stringify({ etabli_le: new Date().toISOString().slice(0, 10), total, compte, couverture, resultats }, null, 2));
  process.exit(SEUIL !== null && couverture < SEUIL ? 1 : 0);
}

console.log(`Attentes du mégaprompt : ${total} items (${attentes.attentes.length} groupes, sections 3 et 4)`);
console.log(
  `  couverts ${compte.couvert} · couverts ailleurs ${compte.couvert_ailleurs} · effleurés ${compte.effleure} · absents ${compte.absent}`
);
console.log(`  couverture : ${(100 * couverture).toFixed(1)} %\n`);

const parGroupe = new Map();
for (const r of aCombler) {
  if (!parGroupe.has(r.groupe)) parGroupe.set(r.groupe, []);
  parGroupe.get(r.groupe).push(r);
}
for (const [groupe, items] of parGroupe) {
  const section = items[0].section;
  console.log(`§${section} — ${groupe}`);
  for (const r of items) {
    const marque = r.etat === "absent" ? "absent  " : "effleuré";
    const ou = r.fiches.length ? ` (dans ${r.fiches.slice(0, 2).join(", ")}${r.nb > 2 ? `, +${r.nb - 2}` : ""})` : "";
    console.log(`  ${marque}  ${r.nom}${ou}`);
  }
  console.log("");
}

if (aCombler.length === 0) console.log("✓ Toutes les attentes encodées sont couvertes.");
else console.log(`${aCombler.length} item(s) à combler. Les requêtes d'enquête : --requetes`);

process.exit(SEUIL !== null && couverture < SEUIL ? 1 : 0);

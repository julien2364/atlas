/*
 * Test HTTP du lot MENTIONS-P27 (règle 5, équivalent HttpCase) : vérifie que
 * le site servi contient le bandeau marque exact (année courante calculée) et
 * le lien vers /mentions-legales sur toutes les pages publiques, que la clause
 * anti-reproduction figure sur /mentions-legales, et qu'aucun numéro INPI
 * n'apparaît.
 *
 * Usage :
 *   node scripts/verifier-mentions.mjs --url=http://127.0.0.1:3000
 *   npm run verifier-mentions -- --url=http://127.0.0.1:3000
 *
 * Codes de sortie : 0 si tout passe, 1 sinon.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { bandeauMarque, CHEMIN_MENTIONS_LEGALES, CLAUSE_PROPRIETE_INTELLECTUELLE } from "../lib/mentions.ts";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");

const args = process.argv.slice(2);
const argUrl = args.find((a) => a.startsWith("--url="));
const BASE = (
  argUrl ? argUrl.slice("--url=".length) : process.env.ATLAS_URL || "http://127.0.0.1:3000"
).replace(/\/+$/, "");
const DELAI = 25_000;

/** Identifiants de fiches réels, pris dans le corpus : une page en dur périmerait. */
function temoins() {
  const humaine = JSON.parse(readFileSync(path.join(RACINE, "data/seed/fiches_humaines/philosophique.json"), "utf8"))[0].id;
  const ia = JSON.parse(readFileSync(path.join(RACINE, "data/seed/fiches_ia.json"), "utf8"))[0].id;
  const gap = JSON.parse(readFileSync(path.join(RACINE, "data/seed/fiches_gap.json"), "utf8"))[0].id;
  return { humaine, ia, gap };
}

const { humaine, ia, gap } = temoins();

const PAGES = [
  "/",
  "/referentiel-humain",
  "/referentiel-ia",
  "/comparateur",
  "/cartographie",
  "/questions",
  "/controverses",
  "/veille",
  "/methodologie",
  "/megaprompt",
  "/mentions-legales",
  "/confidentialite",
  `/fiche/humaine/${humaine}`,
  `/fiche/ia/${ia}`,
  `/gap/${gap}`,
];

async function recuperer(chemin) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI);
  try {
    const r = await fetch(BASE + chemin, { signal: controleur.signal, redirect: "follow" });
    return { statut: r.status, texte: await r.text() };
  } finally {
    clearTimeout(minuteur);
  }
}

/** React échappe les apostrophes en &#x27; dans le HTML servi : on normalise. */
function normaliser(html) {
  return html.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

const resultats = [];
const noter = (nom, ok, detail) => resultats.push({ nom, ok, detail: ok ? "" : detail });

const bandeau = bandeauMarque();

for (const page of PAGES) {
  try {
    const { statut, texte } = await recuperer(page);
    const html = normaliser(texte);
    noter(`${page} : HTTP 200`, statut === 200, `statut ${statut}`);
    noter(`${page} : bandeau marque présent`, html.includes(bandeau), `bandeau attendu : ${bandeau}`);
    noter(`${page} : lien vers ${CHEMIN_MENTIONS_LEGALES} présent`, html.includes(`href="${CHEMIN_MENTIONS_LEGALES}"`), "href absent");
    noter(`${page} : aucun numéro INPI`, !/INPI[^<]{0,20}\d{5,}/i.test(texte) && !texte.includes("5111908"), "numéro INPI détecté");
    if (page === CHEMIN_MENTIONS_LEGALES) {
      noter(`${page} : clause anti-reproduction présente`, html.includes(CLAUSE_PROPRIETE_INTELLECTUELLE), "clause absente ou altérée");
    }
  } catch (e) {
    noter(`${page} : requête joignable`, false, String(e));
  }
}

let echecs = 0;
for (const r of resultats) {
  if (r.ok) {
    console.log(`OK   ${r.nom}`);
  } else {
    echecs++;
    console.log(`ECHEC ${r.nom} — ${r.detail}`);
  }
}
console.log(`\n${resultats.length - echecs}/${resultats.length} contrôles réussis — base ${BASE}`);
process.exit(echecs === 0 ? 0 : 1);

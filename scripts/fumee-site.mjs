/*
 * Test de fumée du site déployé.
 *
 * Le trou qu'il bouche
 * --------------------
 * La CI vérifie le dépôt, Vercel construit et déploie, et personne ne vérifiait jamais
 * que le site **servi** fonctionne. Ce sont trois choses différentes : un build qui
 * réussit ne prouve pas qu'une route dynamique répond, et un déploiement qui aboutit ne
 * prouve pas que le moteur de réponse a chargé son index.
 *
 * Le contrôle central est justement là. `GET /api/question` fait dire au moteur, en
 * production, combien de passages du corpus lui manquent. Le 10/09/2026, l'index
 * versionné couvrait 2 855 passages sur 4 011 : 29 % du référentiel était invisible aux
 * réponses, et rien, nulle part, ne le signalait. Ce test l'aurait crié.
 *
 * Usage
 * -----
 *   node scripts/fumee-site.mjs
 *   node scripts/fumee-site.mjs --url=https://atlas.dyonysos.fr
 *   node scripts/fumee-site.mjs --json
 *   node scripts/fumee-site.mjs --sans-question    # saute le POST (quota, rate limit)
 *
 * Codes de sortie : 0 si tout passe, 1 sinon.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");

const args = process.argv.slice(2);
const argUrl = args.find((a) => a.startsWith("--url="));
const BASE = (argUrl ? argUrl.slice("--url=".length) : process.env.ATLAS_URL || "https://atlas-humain-ia-dyonysos.vercel.app").replace(/\/+$/, "");
const JSON_SORTIE = args.includes("--json");
const SANS_QUESTION = args.includes("--sans-question");
const DELAI = 25_000;

/** Un identifiant de fiche réel, pris dans le corpus : une page en dur périmerait. */
function ficheTemoin() {
  const fichier = path.join(RACINE, "data/seed/fiches_humaines/philosophique.json");
  const fiches = JSON.parse(readFileSync(fichier, "utf8"));
  return fiches[0].id;
}
function gapTemoin() {
  return JSON.parse(readFileSync(path.join(RACINE, "data/seed/fiches_gap.json"), "utf8"))[0].id;
}

const controles = [
  { chemin: "/", marqueur: "ATLAS Humain" },
  { chemin: "/referentiel-humain", marqueur: "<html" },
  { chemin: "/referentiel-ia", marqueur: "<html" },
  { chemin: "/questions", marqueur: "<html" },
  { chemin: "/veille", marqueur: "<html" },
  { chemin: "/methodologie", marqueur: "<html" },
  { chemin: "/comparateur", marqueur: "<html" },
  { chemin: `/fiche/humaine/${ficheTemoin()}`, marqueur: "<html" },
  { chemin: `/gap/${gapTemoin()}`, marqueur: "<html" },
  { chemin: "/sitemap.xml", marqueur: "<urlset" },
  { chemin: "/robots.txt", marqueur: "Sitemap" },
];

async function recuperer(chemin, options = {}) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI);
  try {
    const r = await fetch(BASE + chemin, { ...options, signal: controleur.signal, redirect: "follow" });
    const texte = await r.text();
    return { statut: r.status, texte };
  } finally {
    clearTimeout(minuteur);
  }
}

const resultats = [];
const noter = (nom, ok, detail) => resultats.push({ nom, ok, detail });

for (const c of controles) {
  try {
    const { statut, texte } = await recuperer(c.chemin);
    if (statut !== 200) noter(c.chemin, false, `HTTP ${statut}`);
    else if (!texte.includes(c.marqueur)) noter(c.chemin, false, `HTTP 200 mais « ${c.marqueur} » absent du corps`);
    else noter(c.chemin, true, `HTTP 200, ${(texte.length / 1024).toFixed(0)} Ko`);
  } catch (e) {
    noter(c.chemin, false, e.name === "AbortError" ? `pas de réponse en ${DELAI / 1000} s` : e.message.slice(0, 70));
  }
}

/* --- Le contrôle qui compte : l'index vu depuis la production ------------- */

let etatMoteur = null;
try {
  const { statut, texte } = await recuperer("/api/question");
  if (statut !== 200) {
    noter("moteur — état", false, `HTTP ${statut}`);
  } else {
    etatMoteur = JSON.parse(texte);
    const i = etatMoteur.index ?? {};
    if (!i.present) {
      noter("moteur — index chargé", false, "le moteur ne voit aucun index en production");
    } else {
      noter("moteur — index chargé", true, `${i.nb_passages_indexes ?? "?"} passages indexés sur ${i.nb_passages_corpus ?? "?"} du corpus`);
      const manquants = (i.nb_passages_absents ?? 0) + (i.nb_passages_perimes ?? 0);
      noter(
        "moteur — index à jour",
        manquants === 0,
        manquants === 0
          ? "aucun passage absent ni périmé"
          : `${i.nb_passages_absents ?? 0} absent(s), ${i.nb_passages_perimes ?? 0} périmé(s) — le moteur ne voit pas tout le corpus`
      );
    }
    noter("moteur — un mode utilisable", (etatMoteur.modes_disponibles ?? []).length > 0, (etatMoteur.modes_disponibles ?? []).join(", ") || "aucun");
  }
} catch (e) {
  noter("moteur — état", false, e.message.slice(0, 70));
}

/* --- Une vraie question, en mode extractif : il ne demande aucune clé ----- */

if (!SANS_QUESTION && etatMoteur?.index?.present) {
  try {
    const { statut, texte } = await recuperer("/api/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Que disent les fiches du corpus sur le travail et l'automatisation ?", mode: "extractif" }),
    });
    if (statut !== 200) {
      noter("moteur — réponse à une question", false, `HTTP ${statut} — ${texte.slice(0, 120)}`);
    } else {
      const r = JSON.parse(texte);
      // La réponse n'est pas un bloc de texte : elle est faite de perspectives
      // adossées à des passages. Le contrôle porte donc sur les trois grandeurs qui
      // font qu'une réponse est réellement documentée — des perspectives, des
      // passages retrouvés, et les fiches d'où ils viennent.
      const perspectives = r.perspectives ?? [];
      const passages = r.passages_mobilises ?? [];
      const fiches = r.fiches_mobilisees ?? [];
      noter(
        "moteur — réponse à une question",
        perspectives.length > 0 && passages.length > 0 && fiches.length > 0,
        `${perspectives.length} perspective(s), ${passages.length} passage(s), ${fiches.length} fiche(s)`
      );
    }
  } catch (e) {
    noter("moteur — réponse à une question", false, e.message.slice(0, 70));
  }
}

/* --- Sortie -------------------------------------------------------------- */

const echecs = resultats.filter((r) => !r.ok);

if (JSON_SORTIE) {
  console.log(JSON.stringify({ url: BASE, ok: echecs.length === 0, resultats }, null, 2));
  process.exit(echecs.length === 0 ? 0 : 1);
}

console.log(`Test de fumée — ${BASE}\n`);
for (const r of resultats) console.log(`  ${r.ok ? "✓" : "✗"} ${r.nom.padEnd(46)} ${r.detail}`);

if (echecs.length === 0) {
  console.log(`\n✓ ${resultats.length} contrôles passés. Le site servi fonctionne.`);
  process.exit(0);
}
console.log(`\n✗ ${echecs.length} contrôle(s) en échec sur ${resultats.length} :`);
for (const r of echecs) console.log(`    ${r.nom} — ${r.detail}`);
process.exit(1);

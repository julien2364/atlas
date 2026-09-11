/*
 * Deuxième maillon de l'autonomie : aller chercher soi-même.
 *
 * Ce que ce script fait
 * ---------------------
 * `detecter-lacunes.mjs` dit ce qui manque au corpus et fournit, pour chaque manque,
 * une requête. Celui-ci part de ces requêtes et constitue un dossier de sources — sans
 * clé d'API, sans modèle, sans jugement sémantique. Il interroge deux fonds ouverts,
 * normalise ce qu'ils renvoient, ordonne les candidats et écrit un dossier par lacune
 * dans `data/enquetes/`.
 *
 * C'est le renversement que la veille ne faisait pas. Les flux RSS apportaient ce
 * qu'ils publiaient — de la conjoncture, à 8 aboutissements sur 425 propositions.
 * Ici, c'est le corpus qui demande, à partir de son propre écart au mégaprompt.
 *
 * Les deux fonds, et pourquoi ceux-là
 * -----------------------------------
 *   Crossref  https://api.crossref.org — la littérature publiée avec DOI. Aucun jeton,
 *             politique d'accès permissive, et la forme du JSON a été vérifiée le
 *             11/09/2026 : `message.items[]`, `title` en tableau, `issued.date-parts`
 *             en `[[année, mois, jour]]`, `DOI`, `URL`, `type`, `container-title`.
 *   arXiv     https://export.arxiv.org/api/query — les préprints, en Atom. Le dépôt
 *             parle déjà à arXiv en production via `rss-parser`, qui est donc réutilisé
 *             plutôt qu'un second analyseur écrit pour l'occasion.
 *
 * Tous deux demandent une adresse de contact dans l'en-tête ou l'URL : c'est la
 * contrepartie de l'accès libre, et ce script la fournit. Il attend entre deux appels
 * plutôt que de marteler un service gratuit.
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ CE SCRIPT NE JUGE PAS LE FOND. Il rassemble et ordonne des références ;     │
 * │ il n'affirme pas qu'elles répondent à la lacune. Le dossier est une matière │
 * │ première pour la rédaction, jamais une fiche.                              │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Usage
 * -----
 *   node scripts/enqueter.mjs                        # toutes les lacunes qui portent une requête
 *   node scripts/enqueter.mjs --lacune=B5-limites    # un groupe
 *   node scripts/enqueter.mjs --limite=3             # les trois premières
 *   node scripts/enqueter.mjs --fixture=<dossier>    # hors ligne, sur des réponses enregistrées
 *   node scripts/enqueter.mjs --par-requete=8        # candidats retenus par fonds
 *
 * Le bac à sable des sessions Claude n'a pas d'accès sortant : la passerelle refuse le
 * CONNECT vers tout hôte. Ce script tourne donc dans GitHub Actions, et se met à
 * l'épreuve en local par `--fixture`.
 *
 * Code de sortie : 0 si au moins un fonds a répondu, 1 si aucun — une panne de réseau
 * ne doit pas se confondre avec une absence de résultats.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Parser from "rss-parser";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const SORTIE = path.join(RACINE, "data/enquetes");
const CONTACT = "atlas@dyonysos.fr";

const args = process.argv.slice(2);
if (args.includes("--aide") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}
const valeur = (nom, defaut) => {
  const a = args.find((x) => x.startsWith(`--${nom}=`));
  return a ? a.slice(nom.length + 3) : defaut;
};
const FIXTURE = valeur("fixture", null);
const LACUNE = valeur("lacune", null);
const LIMITE = Number(valeur("limite", 0)) || Infinity;
const PAR_REQUETE = Number(valeur("par-requete", 8));
const ATTENTE_MS = Number(valeur("attente", 1200));

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const plat = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* ------------------------------------------------------------------ lacunes */

// Les lacunes viennent du détecteur, lancé en processus séparé : il ne doit exister
// qu'une définition de ce qui manque, et c'est `detecter-lacunes.mjs`.
const lacunes = JSON.parse(
  execFileSync("node", [path.join(ICI, "detecter-lacunes.mjs"), "--json"], {
    cwd: RACINE,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
).resultats.filter((r) => (r.etat === "absent" || r.etat === "effleure") && r.requete);

/* ------------------------------------------------------------------- fonds */

async function lire(url, options = {}) {
  if (FIXTURE) {
    const nom = plat(url).replace(/[^a-z0-9]+/g, "-").slice(0, 120) + ".txt";
    const chemin = path.join(FIXTURE, nom);
    if (!existsSync(chemin)) throw new Error(`fixture absente : ${nom}`);
    return readFileSync(chemin, "utf8");
  }
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 25_000);
  try {
    const r = await fetch(url, {
      ...options,
      signal: controleur.signal,
      headers: { "User-Agent": `atlas-humain-ia/1.0 (mailto:${CONTACT})`, ...(options.headers ?? {}) },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(minuteur);
  }
}

async function crossref(requete) {
  const url =
    "https://api.crossref.org/works?" +
    new URLSearchParams({
      query: requete,
      rows: String(PAR_REQUETE),
      mailto: CONTACT,
      select: "title,author,issued,DOI,URL,type,container-title,abstract",
    });
  const j = JSON.parse(await lire(url));
  return (j?.message?.items ?? []).map((it) => {
    const dp = it.issued?.["date-parts"]?.[0] ?? [];
    const date = dp[0] ? `${dp[0]}-${String(dp[1] ?? 1).padStart(2, "0")}-${String(dp[2] ?? 1).padStart(2, "0")}` : null;
    return {
      fonds: "crossref",
      titre: Array.isArray(it.title) ? it.title[0] : it.title,
      // Une date Crossref n'a pas toujours son jour : on ne garde la date que si
      // elle est complète, la règle du corpus interdisant un jour inventé.
      date: dp.length >= 3 ? date : null,
      annee: dp[0] ?? null,
      url: it.URL ?? (it.DOI ? `https://doi.org/${it.DOI}` : null),
      doi: it.DOI ?? null,
      type: it.type ?? null,
      revue: Array.isArray(it["container-title"]) ? it["container-title"][0] : null,
      auteurs: (it.author ?? []).slice(0, 6).map((a) => [a.given, a.family].filter(Boolean).join(" ")),
      resume: typeof it.abstract === "string" ? it.abstract.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null,
    };
  });
}

async function arxiv(requete) {
  const url =
    "https://export.arxiv.org/api/query?" +
    new URLSearchParams({ search_query: `all:"${requete}"`, max_results: String(PAR_REQUETE), sortBy: "relevance" });
  const flux = await new Parser({ timeout: 25_000 }).parseString(await lire(url));
  return (flux.items ?? []).map((it) => ({
    fonds: "arxiv",
    titre: (it.title ?? "").replace(/\s+/g, " ").trim(),
    date: it.isoDate ? it.isoDate.slice(0, 10) : null,
    annee: it.isoDate ? Number(it.isoDate.slice(0, 4)) : null,
    url: it.link ?? it.id ?? null,
    doi: null,
    type: "preprint",
    revue: "arXiv",
    auteurs: it.creator ? [it.creator] : [],
    resume: (it.contentSnippet ?? it.content ?? "").replace(/\s+/g, " ").trim().slice(0, 1200) || null,
  }));
}

/* ------------------------------------------------------------------ tri */

/**
 * Un score interprétable, et volontairement pauvre : recouvrement des mots de la
 * requête avec le titre et le résumé, prime au titre, et bonus de fraîcheur. Il ne
 * prétend pas mesurer la pertinence — il ordonne une file que quelqu'un lira.
 */
function noter(candidat, requete) {
  const mots = [...new Set(plat(requete).split(/[^a-z0-9]+/).filter((m) => m.length > 3))];
  if (mots.length === 0) return 0;
  const titre = plat(candidat.titre);
  const resume = plat(candidat.resume ?? "");
  // Les auteurs comptent : une requête du corpus nomme souvent les penseurs du
  // débat — « Chalmers Dennett Searle » — et leurs articles ne portent pas leur nom
  // dans le titre. Sans cette surface, « Minds, Brains, and Programs » marquait zéro.
  const auteurs = plat((candidat.auteurs ?? []).join(" "));
  let n = 0;
  for (const m of mots) {
    if (titre.includes(m)) n += 2;
    else if (auteurs.includes(m)) n += 2;
    else if (resume.includes(m)) n += 1;
  }
  const base = n / (2 * mots.length);
  const age = candidat.annee ? new Date().getFullYear() - candidat.annee : 25;
  const fraicheur = age <= 3 ? 0.15 : age <= 8 ? 0.07 : 0;
  return Math.min(1, base + fraicheur);
}

/* ------------------------------------------------------------------ marche */

let aCombler = lacunes;
if (LACUNE) aCombler = aCombler.filter((r) => r.groupe === LACUNE || r.nom === LACUNE);
aCombler = aCombler.slice(0, LIMITE);

if (aCombler.length === 0) {
  console.log("Aucune lacune ne porte de requête d'enquête. Rien à faire.");
  process.exit(0);
}

mkdirSync(SORTIE, { recursive: true });
const aujourdhui = new Date().toISOString().slice(0, 10);
let fondsRepondu = 0;
const resume = [];

for (const lacune of aCombler) {
  const candidats = [];
  const pannes = [];
  for (const [nom, fn] of [
    ["crossref", crossref],
    ["arxiv", arxiv],
  ]) {
    try {
      const r = await fn(lacune.requete);
      candidats.push(...r);
      if (r.length > 0) fondsRepondu += 1;
    } catch (e) {
      pannes.push({ fonds: nom, erreur: e.message.slice(0, 120) });
    }
    if (!FIXTURE) await dormir(ATTENTE_MS);
  }

  // Dédoublonnage sur DOI ET sur titre, pas sur l'un OU l'autre : les deux fonds se
  // recouvrent largement, et un même article y apparaît avec DOI côté Crossref et sans
  // côté arXiv. Une clé choisie selon la présence d'un DOI laisse donc passer le
  // doublon — c'est ce qu'une épreuve sur fixtures a montré. On indexe les deux.
  const vus = new Set();
  const retenus = [];
  for (const c of candidats) {
    const cles = [`t:${plat(c.titre).replace(/[^a-z0-9]+/g, " ").trim().slice(0, 90)}`];
    if (c.doi) cles.push(`doi:${plat(c.doi)}`);
    if (cles.some((k) => vus.has(k))) continue;
    for (const k of cles) vus.add(k);
    retenus.push({ ...c, score: Number(noter(c, lacune.requete).toFixed(3)) });
  }
  retenus.sort((a, b) => b.score - a.score);

  const nom = `${lacune.groupe}--${plat(lacune.nom).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const dossier = {
    lacune: { groupe: lacune.groupe, section: lacune.section, nom: lacune.nom, etat: lacune.etat, nature: lacune.nature, referentiel: lacune.referentiel },
    requete: lacune.requete,
    enquete_le: aujourdhui,
    fonds_interroges: ["crossref", "arxiv"],
    pannes,
    nb_candidats: retenus.length,
    candidats: retenus.slice(0, 20),
    rappel:
      "Ce dossier rassemble des références, il n'affirme pas qu'elles répondent à la lacune. Toute source doit être ouverte et lue avant d'être citée dans une fiche.",
  };
  writeFileSync(path.join(SORTIE, `${nom}.json`), JSON.stringify(dossier, null, 2) + "\n", "utf8");
  resume.push({ nom, candidats: retenus.length, pannes: pannes.length, meilleur: retenus[0]?.score ?? 0 });
  console.log(
    `${lacune.groupe.padEnd(20)} ${lacune.nom.slice(0, 38).padEnd(40)} ${String(retenus.length).padStart(3)} candidat(s)` +
      (pannes.length ? `  ⚠ ${pannes.map((p) => p.fonds).join(", ")}` : "")
  );
}

console.log(`\n${resume.length} dossier(s) écrit(s) dans data/enquetes/`);
if (fondsRepondu === 0) {
  console.error("✗ Aucun fonds n'a répondu — panne de réseau ou d'accès, pas une absence de résultats.");
  process.exit(1);
}

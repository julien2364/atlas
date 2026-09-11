/*
 * Moissonneur de sources — l'enrichissement en masse, en continu.
 *
 * Pourquoi ce script existe
 * -------------------------
 * Le référentiel compte 636 fiches, et une grande partie d'entre elles tient sur
 * deux sources, dont souvent une encyclopédie. Une réponse ne peut pas être plus
 * précise que ses fiches, et une fiche ne peut pas être plus solide que ses
 * sources. `enqueter.mjs` va chercher de la matière pour les LACUNES du
 * mégaprompt — ce qui manque au catalogue. Celui-ci fait l'autre moitié du
 * travail : il va chercher des sources pour les fiches qui EXISTENT DÉJÀ mais
 * qui sont mal étayées.
 *
 * Il y a un second effet, voulu : deux fiches qui finissent par citer la même
 * source deviennent liées dans le graphe de croisement (`tisser-relations.mjs`,
 * relation `source_commune`). Enrichir les sources enrichit donc directement le
 * raisonnement du moteur de réponse, pas seulement sa bibliographie.
 *
 * Ce que le script NE fait PAS
 * ---------------------------
 * Il ne touche à aucune fiche. Il écrit des PROPOSITIONS dans data/moisson/ et
 * un rapport lisible. L'ajout effectif d'une source à une fiche passe par
 * `--appliquer`, lancé à la main après lecture du rapport — et même là, il
 * n'AJOUTE que des sources, il n'en modifie ni n'en supprime aucune.
 *
 * Les fonds interrogés
 * --------------------
 * Tous ouverts, aucun sans clé d'API :
 *   openalex        240 M de travaux, métadonnées riches, filtrage par année
 *   crossref        le registre des DOI
 *   arxiv           préprints (physique, informatique, économie quantitative)
 *   hal             archive ouverte française — indispensable pour un corpus FR
 *   doaj            revues en libre accès, avec le résumé
 *   europepmc       biomédical et sciences de la vie
 *
 * Chaque fonds est interrogé séparément et son échec n'arrête pas les autres :
 * un fonds indisponible fait un rapport plus court, pas un job rouge.
 *
 * Mémoire entre deux passages
 * ---------------------------
 * `data/moisson-index.json` retient ce qui a déjà été proposé (par DOI, sinon
 * par URL normalisée, sinon par titre aplati). Un passage quotidien ne repropose
 * donc pas éternellement les mêmes dix articles : il descend la file.
 *
 * Usage
 * -----
 *   node scripts/moissonner.mjs --cibles=12
 *   node scripts/moissonner.mjs --fiche=democratie-liberale
 *   node scripts/moissonner.mjs --fonds=openalex,hal --cibles=5
 *   node scripts/moissonner.mjs --fixture=data/fixtures/moisson   (hors ligne)
 *   node scripts/moissonner.mjs --appliquer=data/moisson/sources-2026-09-11.json --limite=20
 *   node scripts/moissonner.mjs --aide
 *
 * Codes de sortie : 0 · 1 erreur d'écriture ou corpus invalide · 2 usage.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const SEED = path.join(RACINE, "data/seed");
const DOSSIER_MOISSON = path.join(RACINE, "data/moisson");
const INDEX = path.join(RACINE, "data/moisson-index.json");
const RAPPORT = path.join(RACINE, "docs/moisson.md");
const CONTACT = "atlas@dyonysos.fr";

const args = process.argv.slice(2);
const valeur = (nom, defaut = null) => {
  const trouve = args.find((a) => a.startsWith(`--${nom}=`));
  return trouve ? trouve.slice(nom.length + 3) : defaut;
};

if (args.includes("--aide")) {
  console.log(`moissonner.mjs — cherche des sources pour les fiches mal étayées.

  --cibles=N        nombre de fiches traitées sur ce passage (défaut 10)
  --fiche=ID        ne traiter que cette fiche
  --fonds=a,b       restreindre les fonds (openalex,crossref,arxiv,hal,doaj,europepmc)
  --par-fonds=N     résultats demandés à chaque fonds (défaut 6)
  --garder=N        propositions retenues par fiche (défaut 4)
  --attente=MS      pause entre deux appels réseau (défaut 1200)
  --fixture=DOSSIER lit des réponses enregistrées au lieu du réseau
  --appliquer=F     ajoute aux fiches les sources retenues du fichier F
  --limite=N        avec --appliquer : nombre maximum de sources ajoutées
  --sortie=F        écrit la proposition dans F (défaut data/moisson/sources-<date>.json)
  --json            rapport machine sur la sortie standard
  --aide`);
  process.exit(0);
}

const FIXTURE = valeur("fixture");
const CIBLES = Number(valeur("cibles", "10")) || 10;
const UNE_FICHE = valeur("fiche");
const PAR_FONDS = Number(valeur("par-fonds", "6")) || 6;
const GARDER = Number(valeur("garder", "4")) || 4;
const ATTENTE_MS = Number(valeur("attente", "1200"));
const APPLIQUER = valeur("appliquer");
const LIMITE = Number(valeur("limite", "0")) || Infinity;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const plat = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* -------------------------------------------------------------------------- */
/* Corpus                                                                     */
/* -------------------------------------------------------------------------- */

function lireJson(chemin) {
  const brut = JSON.parse(readFileSync(chemin, "utf8"));
  return Array.isArray(brut) ? brut : (brut.fiches ?? []);
}

function fichiersHumaines() {
  const dossier = path.join(SEED, "fiches_humaines");
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => path.join(dossier, f));
}

function lireHumaines() {
  return fichiersHumaines().flatMap((chemin) =>
    lireJson(chemin).map((fiche) => ({ ...fiche, _fichier: chemin }))
  );
}

/**
 * Besoin de sources d'une fiche, en points. Sert à choisir qui est traité en
 * premier — le budget d'appels réseau est limité, il va là où il manque le plus.
 *
 * Le poids le plus lourd va à l'absence d'URL : une fiche dont toutes les
 * sources sont des ouvrages imprimés sans lien n'est pas vérifiable en ligne.
 * C'est la dette la plus visible du corpus (256 entrées au dernier audit).
 */
export function besoin(fiche) {
  const sources = Array.isArray(fiche.sources) ? fiche.sources : [];
  const avecUrl = sources.filter((s) => typeof s?.url === "string" && s.url.trim()).length;
  const primaires = sources.filter((s) => s?.type === "primaire").length;
  let points = 0;
  if (avecUrl === 0) points += 4;
  else if (avecUrl === 1) points += 2;
  if (sources.length <= 1) points += 3;
  else if (sources.length === 2) points += 1;
  if (primaires === 0) points += 2;
  // Fraîcheur : une fiche non revérifiée depuis longtemps mérite un passage.
  const verif = Date.parse(fiche.derniere_verification ?? "");
  if (Number.isFinite(verif)) {
    const jours = (Date.now() - verif) / 86_400_000;
    if (jours > 180) points += 2;
    else if (jours > 90) points += 1;
  } else {
    points += 1;
  }
  return points;
}

/* -------------------------------------------------------------------------- */
/* Réseau                                                                     */
/* -------------------------------------------------------------------------- */

async function lire(url) {
  if (FIXTURE) {
    const nom = `${plat(url).replace(/[^a-z0-9]+/g, "-").slice(0, 120)}.txt`;
    const chemin = path.join(RACINE, FIXTURE, nom);
    if (!existsSync(chemin)) throw new Error(`fixture absente : ${nom}`);
    return readFileSync(chemin, "utf8");
  }
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 25_000);
  try {
    const r = await fetch(url, {
      signal: controleur.signal,
      headers: { "User-Agent": `atlas-humain-ia/1.0 (mailto:${CONTACT})` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(minuteur);
  }
}

/** Forme commune à tous les fonds. Un fonds qui ne sait pas remplir un champ met null. */
function candidat(base) {
  return {
    fonds: base.fonds,
    titre: (base.titre ?? "").replace(/\s+/g, " ").trim(),
    annee: Number.isFinite(base.annee) ? base.annee : null,
    url: base.url ?? null,
    doi: base.doi ? String(base.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") : null,
    type: base.type ?? null,
    revue: base.revue ?? null,
    auteurs: (base.auteurs ?? []).filter(Boolean).slice(0, 6),
    resume: base.resume ? String(base.resume).replace(/\s+/g, " ").trim().slice(0, 900) : null,
  };
}

const FONDS = {
  async openalex(requete) {
    const url =
      "https://api.openalex.org/works?" +
      new URLSearchParams({
        search: requete,
        per_page: String(PAR_FONDS),
        mailto: CONTACT,
        select: "id,doi,title,publication_year,authorships,primary_location,type,abstract_inverted_index",
      });
    const j = JSON.parse(await lire(url));
    return (j?.results ?? []).map((it) =>
      candidat({
        fonds: "openalex",
        titre: it.title,
        annee: it.publication_year ?? null,
        url: it.doi ?? it.primary_location?.landing_page_url ?? it.id ?? null,
        doi: it.doi ?? null,
        type: it.type ?? null,
        revue: it.primary_location?.source?.display_name ?? null,
        auteurs: (it.authorships ?? []).map((a) => a.author?.display_name),
        // OpenAlex rend le résumé sous forme d'index inversé (mot → positions) :
        // on le remet à plat, sinon on perd le seul texte exploitable pour le tri.
        resume: it.abstract_inverted_index ? depuisIndexInverse(it.abstract_inverted_index) : null,
      })
    );
  },

  async crossref(requete) {
    const url =
      "https://api.crossref.org/works?" +
      new URLSearchParams({
        query: requete,
        rows: String(PAR_FONDS),
        mailto: CONTACT,
        select: "title,author,issued,DOI,URL,type,container-title,abstract",
      });
    const j = JSON.parse(await lire(url));
    return (j?.message?.items ?? []).map((it) =>
      candidat({
        fonds: "crossref",
        titre: Array.isArray(it.title) ? it.title[0] : it.title,
        annee: it.issued?.["date-parts"]?.[0]?.[0] ?? null,
        url: it.URL ?? (it.DOI ? `https://doi.org/${it.DOI}` : null),
        doi: it.DOI ?? null,
        type: it.type ?? null,
        revue: Array.isArray(it["container-title"]) ? it["container-title"][0] : null,
        auteurs: (it.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(" ")),
        resume: typeof it.abstract === "string" ? it.abstract.replace(/<[^>]+>/g, " ") : null,
      })
    );
  },

  async arxiv(requete) {
    const url =
      "https://export.arxiv.org/api/query?" +
      new URLSearchParams({
        search_query: `all:"${requete}"`,
        max_results: String(PAR_FONDS),
        sortBy: "relevance",
      });
    const flux = await new Parser({ timeout: 25_000 }).parseString(await lire(url));
    return (flux.items ?? []).map((it) =>
      candidat({
        fonds: "arxiv",
        titre: it.title,
        annee: it.isoDate ? Number(it.isoDate.slice(0, 4)) : null,
        url: it.link ?? it.id ?? null,
        type: "preprint",
        revue: "arXiv",
        auteurs: it.creator ? [it.creator] : [],
        resume: it.contentSnippet ?? it.content ?? null,
      })
    );
  },

  async hal(requete) {
    const url =
      "https://api.archives-ouvertes.fr/search/?" +
      new URLSearchParams({
        q: requete,
        rows: String(PAR_FONDS),
        wt: "json",
        fl: "title_s,authFullName_s,producedDateY_i,uri_s,doiId_s,docType_s,journalTitle_s,abstract_s",
      });
    const j = JSON.parse(await lire(url));
    return (j?.response?.docs ?? []).map((it) =>
      candidat({
        fonds: "hal",
        titre: Array.isArray(it.title_s) ? it.title_s[0] : it.title_s,
        annee: it.producedDateY_i ?? null,
        url: it.uri_s ?? null,
        doi: it.doiId_s ?? null,
        type: it.docType_s ?? null,
        revue: it.journalTitle_s ?? null,
        auteurs: it.authFullName_s ?? [],
        resume: Array.isArray(it.abstract_s) ? it.abstract_s[0] : it.abstract_s,
      })
    );
  },

  async doaj(requete) {
    const url = `https://doaj.org/api/search/articles/${encodeURIComponent(requete)}?${new URLSearchParams({
      pageSize: String(PAR_FONDS),
    })}`;
    const j = JSON.parse(await lire(url));
    return (j?.results ?? []).map((it) => {
      const b = it.bibjson ?? {};
      const lien = (b.link ?? []).find((l) => l.url)?.url ?? null;
      const doi = (b.identifier ?? []).find((i) => i.type === "doi")?.id ?? null;
      return candidat({
        fonds: "doaj",
        titre: b.title,
        annee: b.year ? Number(b.year) : null,
        url: lien ?? (doi ? `https://doi.org/${doi}` : null),
        doi,
        type: "article",
        revue: b.journal?.title ?? null,
        auteurs: (b.author ?? []).map((a) => a.name),
        resume: b.abstract ?? null,
      });
    });
  },

  async europepmc(requete) {
    const url =
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" +
      new URLSearchParams({
        query: requete,
        format: "json",
        pageSize: String(PAR_FONDS),
        resultType: "lite",
      });
    const j = JSON.parse(await lire(url));
    return (j?.resultList?.result ?? []).map((it) =>
      candidat({
        fonds: "europepmc",
        titre: it.title,
        annee: it.pubYear ? Number(it.pubYear) : null,
        url: it.doi ? `https://doi.org/${it.doi}` : it.fullTextUrlList?.fullTextUrl?.[0]?.url ?? null,
        doi: it.doi ?? null,
        type: it.pubType ?? "article",
        revue: it.journalTitle ?? null,
        auteurs: it.authorString ? [it.authorString] : [],
        resume: null,
      })
    );
  },
};

/** Remet à plat l'index inversé d'OpenAlex : { mot: [positions] } → phrase. */
export function depuisIndexInverse(index) {
  const mots = [];
  for (const [mot, positions] of Object.entries(index ?? {})) {
    for (const p of positions) mots[p] = mot;
  }
  return mots.filter(Boolean).join(" ").slice(0, 900) || null;
}

/* -------------------------------------------------------------------------- */
/* Identité et mémoire                                                        */
/* -------------------------------------------------------------------------- */

/** Clé d'identité d'un candidat, stable entre deux passages. */
export function cleCandidat(c) {
  if (c.doi) return `doi:${c.doi.toLowerCase()}`;
  if (c.url) {
    try {
      const u = new URL(c.url);
      return `url:${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
    } catch {
      /* URL malformée : on retombe sur le titre. */
    }
  }
  const t = plat(c.titre);
  return t.length >= 10 ? `titre:${t}` : null;
}

function lireMemoire() {
  if (!existsSync(INDEX)) return { vus: {}, dernier_passage: null };
  try {
    return JSON.parse(readFileSync(INDEX, "utf8"));
  } catch {
    return { vus: {}, dernier_passage: null };
  }
}

/* -------------------------------------------------------------------------- */
/* Tri                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Score volontairement pauvre et lisible : recouvrement du vocabulaire de la
 * fiche avec le titre (prime) et le résumé, plus un bonus de fraîcheur et un
 * bonus de DOI. Il ORDONNE une file que quelqu'un lira ; il ne décide rien.
 */
export function noter(c, motsFiche, anneeCourante) {
  const titre = plat(c.titre);
  const resume = plat(c.resume ?? "");
  let score = 0;
  for (const mot of motsFiche) {
    if (titre.includes(mot)) score += 3;
    else if (resume.includes(mot)) score += 1;
  }
  if (c.doi) score += 2;
  if (c.annee) {
    const age = anneeCourante - c.annee;
    if (age <= 3) score += 3;
    else if (age <= 8) score += 1;
    else if (age > 30) score -= 1;
  }
  if (!c.resume) score -= 1;
  return score;
}

/* -------------------------------------------------------------------------- */
/* Application (ajout de sources, jamais de modification)                     */
/* -------------------------------------------------------------------------- */

function appliquer(chemin) {
  const proposition = JSON.parse(readFileSync(chemin, "utf8"));
  const fichiers = new Map();
  for (const f of fichiersHumaines()) fichiers.set(f, lireJson(f));

  let ajoutees = 0;
  const touchees = [];
  for (const bloc of proposition.fiches ?? []) {
    if (ajoutees >= LIMITE) break;
    // `retenues` est le champ que la relecture humaine remplit : tant qu'il est
    // absent, rien n'est appliqué. Une proposition non relue ne s'applique pas
    // par inadvertance.
    const retenues = Array.isArray(bloc.retenues) ? bloc.retenues : [];
    if (retenues.length === 0) continue;

    for (const [chemin2, fiches] of fichiers) {
      const fiche = fiches.find((f) => f.id === bloc.fiche_id);
      if (!fiche) continue;
      const avant = Array.isArray(fiche.sources) ? fiche.sources.length : 0;
      const existantes = new Set(
        (Array.isArray(fiche.sources) ? fiche.sources : []).map((s) => cleCandidat({ doi: null, url: s.url, titre: s.titre }))
      );
      for (const cle of retenues) {
        if (ajoutees >= LIMITE) break;
        const source = (bloc.candidats ?? []).find((c) => c.cle === cle);
        if (!source) continue;
        if (existantes.has(cle)) continue;
        fiche.sources = Array.isArray(fiche.sources) ? fiche.sources : [];
        fiche.sources.push({
          titre: source.titre,
          ...(source.url ? { url: source.url } : {}),
          type: "secondaire",
          ...(source.annee ? { date: `${source.annee}-01-01` } : {}),
        });
        existantes.add(cle);
        ajoutees += 1;
      }
      if (avant !== fiche.sources?.length) touchees.push({ fichier: chemin2, fiche: fiche.id });
      break;
    }
  }

  if (ajoutees === 0) {
    console.log("Aucune source retenue dans ce fichier — rien à appliquer.");
    console.log("Remplir le champ « retenues » de chaque bloc avec les clés à ajouter, puis relancer.");
    return;
  }
  const fichiersTouches = new Set(touchees.map((t) => t.fichier));
  for (const chemin2 of fichiersTouches) {
    writeFileSync(chemin2, `${JSON.stringify(fichiers.get(chemin2), null, 2)}\n`, "utf8");
  }
  console.log(`✓ ${ajoutees} source(s) ajoutée(s) à ${new Set(touchees.map((t) => t.fiche)).size} fiche(s).`);
  console.log("Relancer ensuite : npm run indexer && npm run tisser && npm run verifier");
}

/* -------------------------------------------------------------------------- */
/* Passage principal                                                          */
/* -------------------------------------------------------------------------- */

async function moissonner() {
  const humaines = lireHumaines();
  const memoire = lireMemoire();
  const anneeCourante = new Date().getFullYear();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const fondsDemandes = (valeur("fonds") ?? Object.keys(FONDS).join(","))
    .split(",")
    .map((f) => f.trim())
    .filter((f) => f in FONDS);
  if (fondsDemandes.length === 0) {
    console.error("Aucun fonds reconnu. Fonds disponibles : " + Object.keys(FONDS).join(", "));
    process.exit(2);
  }

  const cibles = UNE_FICHE
    ? humaines.filter((f) => f.id === UNE_FICHE)
    : humaines
        .map((f) => ({ fiche: f, points: besoin(f) }))
        .filter((x) => x.points > 0)
        .sort((a, b) => b.points - a.points || a.fiche.id.localeCompare(b.fiche.id))
        .slice(0, CIBLES)
        .map((x) => x.fiche);

  if (cibles.length === 0) {
    console.log("Aucune fiche à enrichir — toutes sont correctement étayées.");
    return;
  }

  const blocs = [];
  const echecs = [];
  for (const fiche of cibles) {
    const requete = [fiche.nom, String(fiche.sous_domaine ?? "").replace(/_/g, " ")].filter(Boolean).join(" ");
    const motsFiche = [
      ...new Set(
        `${plat(fiche.nom)} ${plat(fiche.these_centrale)}`
          .split(" ")
          .filter((m) => m.length > 3)
          .slice(0, 24)
      ),
    ];

    const bruts = [];
    for (const nomFonds of fondsDemandes) {
      try {
        bruts.push(...(await FONDS[nomFonds](requete)));
      } catch (erreur) {
        echecs.push(`${nomFonds} / ${fiche.id} : ${erreur.message}`);
      }
      if (!FIXTURE) await dormir(ATTENTE_MS);
    }

    // Dédoublonnage : même clé venue de deux fonds = un seul candidat, dont on
    // note les fonds d'origine (un article présent dans OpenAlex ET HAL est
    // mieux établi qu'un autre).
    const parCle = new Map();
    for (const c of bruts) {
      const cle = cleCandidat(c);
      if (!cle) continue;
      if (!c.titre || c.titre.length < 8) continue;
      const existant = parCle.get(cle);
      if (existant) {
        if (!existant.fonds.includes(c.fonds)) existant.fonds.push(c.fonds);
        existant.resume = existant.resume ?? c.resume;
        existant.url = existant.url ?? c.url;
        continue;
      }
      parCle.set(cle, { ...c, cle, fonds: [c.fonds] });
    }

    // Ce que la fiche cite déjà, et ce qui a déjà été proposé un autre jour.
    const deja = new Set(
      (Array.isArray(fiche.sources) ? fiche.sources : []).map((s) =>
        cleCandidat({ doi: null, url: s.url, titre: s.titre })
      )
    );
    const retenus = [...parCle.values()]
      .filter((c) => !deja.has(c.cle))
      .filter((c) => !memoire.vus[c.cle])
      .map((c) => ({ ...c, score: noter(c, motsFiche, anneeCourante) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, GARDER);

    for (const c of retenus) memoire.vus[c.cle] = aujourdhui;

    blocs.push({
      fiche_id: fiche.id,
      fiche_nom: fiche.nom,
      axe: fiche.axe,
      sous_domaine: fiche.sous_domaine,
      besoin: besoin(fiche),
      requete,
      nb_candidats_bruts: bruts.length,
      candidats: retenus,
      /* À remplir par la relecture humaine : les clés à ajouter réellement. */
      retenues: [],
    });
  }

  // `--sortie` permet au cron d'écrire la proposition HORS du dépôt (dans
  // RUNNER_TEMP) : le job ne peut alors structurellement pas salir l'arbre de
  // travail, et la proposition est publiée comme artefact à relire. C'est la
  // même discipline que la boucle de veille.
  const sortie = valeur("sortie")
    ? path.resolve(RACINE, valeur("sortie"))
    : path.join(DOSSIER_MOISSON, `sources-${aujourdhui}.json`);
  mkdirSync(path.dirname(sortie), { recursive: true });
  writeFileSync(
    sortie,
    `${JSON.stringify(
      {
        genere_le: aujourdhui,
        fonds: fondsDemandes,
        nb_fiches: blocs.length,
        nb_propositions: blocs.reduce((n, b) => n + b.candidats.length, 0),
        echecs,
        fiches: blocs,
      },
      null,
      1
    )}\n`,
    "utf8"
  );

  memoire.dernier_passage = aujourdhui;
  writeFileSync(INDEX, `${JSON.stringify(memoire, null, 1)}\n`, "utf8");

  const total = blocs.reduce((n, b) => n + b.candidats.length, 0);
  const lignes = [
    "# Moisson de sources",
    "",
    `Dernier passage : **${aujourdhui}** · fonds interrogés : ${fondsDemandes.join(", ")}.`,
    "",
    `**${total} propositions** pour **${blocs.length} fiches**, écrites dans \`${path.relative(RACINE, sortie)}\`.`,
    "",
    "Ce fichier ne modifie aucune fiche. Pour en ajouter une partie au corpus : remplir le champ",
    "`retenues` de chaque bloc avec les clés choisies, puis lancer",
    "`node scripts/moissonner.mjs --appliquer=<fichier>`.",
    "",
    "| Fiche | Besoin | Propositions | Meilleure proposition |",
    "|---|---:|---:|---|",
  ];
  for (const b of blocs) {
    const meilleure = b.candidats[0];
    const cellule = meilleure
      ? `${meilleure.url ? `[${meilleure.titre.slice(0, 70)}](${meilleure.url})` : meilleure.titre.slice(0, 70)} — ${meilleure.fonds.join("/")}${meilleure.annee ? `, ${meilleure.annee}` : ""}`
      : "—";
    lignes.push(`| ${b.fiche_nom} | ${b.besoin} | ${b.candidats.length} | ${cellule} |`);
  }
  if (echecs.length > 0) {
    lignes.push("", "## Fonds indisponibles sur ce passage", "");
    for (const e of echecs.slice(0, 20)) lignes.push(`- ${e}`);
  }
  lignes.push(
    "",
    "## Ce que la moisson ne fait pas",
    "",
    "Elle ne juge pas la qualité d'une source : le score n'est qu'un recouvrement de vocabulaire",
    "entre la fiche et le titre, plus une prime de fraîcheur. Une source bien classée peut être",
    "hors sujet, et une source mal classée peut être la bonne. La lecture reste entière.",
    ""
  );
  writeFileSync(RAPPORT, `${lignes.join("\n")}\n`, "utf8");

  if (args.includes("--json")) {
    console.log(JSON.stringify({ genere_le: aujourdhui, nb_fiches: blocs.length, nb_propositions: total, echecs }, null, 2));
    return;
  }
  console.log(`✓ ${total} proposition(s) pour ${blocs.length} fiche(s) → ${path.relative(RACINE, sortie)}`);
  console.log(`  rapport : ${path.relative(RACINE, RAPPORT)}`);
  if (echecs.length > 0) console.log(`  ${echecs.length} appel(s) en échec — détail dans le rapport.`);
}

/* -------------------------------------------------------------------------- */

try {
  if (APPLIQUER) appliquer(path.resolve(RACINE, APPLIQUER));
  else await moissonner();
} catch (erreur) {
  console.error(`Erreur : ${erreur.message}`);
  process.exit(1);
}

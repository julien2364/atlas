/*
 * Lot 5 — ingestion de veille via RSS (canal prioritaire, cf. mégaprompt v1.1 §7.1).
 *
 * Rôle dans le projet
 * -------------------
 * Ce script alimente `data/seed/veille_queue.json` avec des PROPOSITIONS en attente.
 * Il ne publie rien : aucune fiche du référentiel n'est modifiée ici, et le statut
 * `en_attente` impose une revue humaine (cf. docs/gouvernance-veille.md). Ce qui
 * descend ensuite dans les fiches passe par scripts/appliquer-veille.mjs puis
 * scripts/appliquer-patchs.mjs, tous deux lancés à la main.
 *
 * Usage
 * -----
 *   node scripts/veille-rss.mjs                 # collecte et écrit dans la file
 *   node scripts/veille-rss.mjs --simulation    # collecte sans rien écrire
 *   node scripts/veille-rss.mjs --rescorer      # rescore la file existante, sans écrire
 *   node scripts/veille-rss.mjs --json          # sortie machine
 *   node scripts/veille-rss.mjs --aide
 *
 * Codes de sortie : 0 collecte terminée (même sans nouvelle proposition : une file
 * inchangée n'est pas une panne) · 1 échec dur (file illisible, ou aucun flux
 * joignable alors que des flux actifs sont déclarés) · 2 erreur d'usage.
 *
 * ---------------------------------------------------------------------------
 * LE SCORE DE FIABILITÉ — pourquoi il a été refait le 07/09/2026
 * ---------------------------------------------------------------------------
 * La version précédente lisait le NOM DU FLUX :
 *
 *     const primaires = ["arxiv", "anthropic", "openai", "nature", ...];
 *     return primaires.some((p) => source.nom.toLowerCase().includes(p)) ? 0.9 : 0.6;
 *
 * Elle ne mesurait donc pas la proposition, mais l'intitulé du tuyau par lequel
 * celle-ci est arrivée. Trois défauts, tous constatés dans la file actuelle :
 *
 *   1. Le flux « Anthropic — actualités (via Google News…) » contient « anthropic » :
 *      ses 18 items sont scorés 0,9. Or ce sont des articles de Frandroid, 01net,
 *      ZDNet ou Les Numériques republiés par Google News — pas des documents
 *      d'Anthropic. Le score décrivait un mot dans un nom de flux.
 *   2. Un communiqué commercial publié par un éditeur sur son propre produit
 *      (« Playco cut manual fixes 50 % prototyping games with GPT-6 Astra ») recevait
 *      0,9, le même score qu'un article de Nature à comité de lecture.
 *   3. Le score franchissait le seuil de 0,8 de scripts/appliquer-veille.mjs, qui en
 *      déduit `type: "primaire"`. Une reprise de presse devenait donc une source
 *      primaire du référentiel sans qu'aucun humain ait eu à le décider.
 *
 * Le score est désormais calculé sur le DOMAINE DE L'URL DE LA PROPOSITION, c'est-à-
 * dire sur l'éditeur qui répond réellement de ce texte. C'est la seule propriété
 * objective et vérifiable que porte un item RSS.
 *
 * Ce que le score mesure, et ce qu'il ne mesure pas : il note la FIABILITÉ ÉDITORIALE
 * de l'émetteur — existe-t-il une relecture, une méthode publiée, une responsabilité
 * engagée ? Il ne note ni l'intérêt du contenu, ni sa pertinence pour le référentiel :
 * cela reste le travail de la revue humaine. Un score bas n'est pas un rejet.
 */

import Parser from "rss-parser";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--aide") || args.includes("-h") || args.includes("--help")) {
  console.log(`
veille-rss.mjs — collecte les flux RSS actifs et remplit la file de validation.

  --simulation   collecte et affiche le résultat SANS écrire dans data/seed/
  --rescorer     n'appelle aucun flux : recalcule le score de fiabilité des
                 propositions déjà en file et affiche le tableau des écarts.
                 N'écrit jamais — les scores stockés relèvent d'une décision
                 humaine, pas d'une réécriture silencieuse du passé.
  --json         sortie machine (un seul objet JSON sur stdout)
  --racine=...   racine du dépôt (défaut : dossier parent de scripts/)
  --aide, -h     ce message

Codes de sortie : 0 succès · 1 échec dur · 2 erreur d'usage.
`);
  process.exit(0);
}

const OPTIONS_CONNUES = ["--simulation", "--rescorer", "--json", "--aide", "-h", "--help"];
const inconnues = args.filter((a) => !OPTIONS_CONNUES.includes(a) && !a.startsWith("--racine="));
if (inconnues.length > 0) {
  console.error(`Option inconnue : ${inconnues.join(", ")}. Voir --aide.`);
  process.exit(2);
}

const SIMULATION = args.includes("--simulation");
const RESCORER = args.includes("--rescorer");
const SORTIE_JSON = args.includes("--json");

// Racine résolue depuis l'emplacement du script et non depuis le cwd : le cron
// GitHub ne lance pas forcément la commande depuis la racine du dépôt. Même
// convention que scripts/valider-donnees.mjs.
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = args.find((a) => a.startsWith("--racine="))?.split("=").slice(1).join("=") ?? path.resolve(ICI, "..");
const CHEMIN_SOURCES = path.join(RACINE, "data", "seed", "veille_sources.json");
const CHEMIN_QUEUE = path.join(RACINE, "data", "seed", "veille_queue.json");

const parser = new Parser({ timeout: 15000 });

// ---------------------------------------------------------------------------
// Table de domaines — le cœur du score, donc entièrement explicite ici
// ---------------------------------------------------------------------------

/*
 * Six paliers. Chacun répond à une seule question : QUI RÉPOND DE CE TEXTE, et
 * qu'est-ce que cet émetteur a dû faire avant de le publier ?
 *
 * 0,90 — ÉDITION SCIENTIFIQUE À COMITÉ DE LECTURE, ou registre d'identifiant pérenne.
 *        Relecture par les pairs avant publication, identifiant stable (DOI),
 *        rétractations et errata publiés et traçables. C'est le seul palier où un
 *        tiers indépendant a examiné le texte avant sa mise en ligne.
 *
 * 0,80 — ARCHIVE DE PRÉPRINT, ACTES DE CONFÉRENCE, INSTITUTION PUBLIQUE.
 *        Deux familles réunies au même palier pour deux raisons différentes :
 *        · un préprint arXiv n'est pas relu par les pairs, mais c'est un document
 *          complet, versionné et cité par un identifiant stable — il est
 *          parfaitement identifiable, ce qui est ce que le champ `type` du
 *          référentiel demande ;
 *        · une institution publique ou une organisation internationale engage une
 *          responsabilité publique et publie sa méthode.
 *        C'est le palier du seuil : à 0,80, scripts/appliquer-veille.mjs classera la
 *        source en `primaire`. Rien en dessous n'y accède automatiquement.
 *
 * 0,60 — ÉDITEUR OU LABORATOIRE S'EXPRIMANT SUR SON PROPRE PRODUIT.
 *        Source de première main sur le plan bibliographique, mais partie prenante :
 *        l'annonce technique et l'argumentaire commercial y sont indistincts, et
 *        rien n'oblige l'éditeur à publier ce qui le dessert. C'est ce palier qui
 *        règle le cas des cinq communiqués OpenAI de la file actuelle. Sous le
 *        seuil : un tel document peut devenir une source primaire du référentiel,
 *        mais seulement par une décision humaine explicite.
 *
 * 0,50 — ENCYCLOPÉDIE COLLABORATIVE. Vérifiable et sourcée, mais tertiaire et
 *        modifiable par n'importe qui à n'importe quel moment. Aligné sur le score
 *        déjà utilisé par scripts/documentation-recherche.mjs pour Wikipédia.
 *
 * 0,40 — PRESSE GÉNÉRALISTE ET SPÉCIALISÉE. Il y a une relecture éditoriale, il n'y
 *        a pas de méthode publiée ni de correction traçable. C'est aussi le SCORE
 *        PAR DÉFAUT d'un domaine inconnu : prudent par construction, puisqu'il
 *        laisse la proposition en file sans jamais lui ouvrir le statut de source
 *        primaire.
 *
 * 0,15 — REDIRECTEUR OPAQUE. Voir plus bas : on ne score pas ce qu'on ne peut pas
 *        nommer.
 *
 * La table est volontairement courte et lisible plutôt qu'exhaustive : un domaine
 * absent tombe dans le défaut prudent, ce qui est le bon comportement. On l'étend
 * quand un domaine revient assez souvent en revue pour que la question se pose.
 */
const PALIERS = {
  revue_a_comite_de_lecture: {
    score: 0.9,
    libelle: "édition scientifique à comité de lecture",
    domaines: [
      "nature.com", "science.org", "sciencemag.org", "cell.com", "thelancet.com",
      "pnas.org", "doi.org", "link.springer.com", "sciencedirect.com", "onlinelibrary.wiley.com",
      "journals.plos.org", "ieee.org", "ieeexplore.ieee.org", "dl.acm.org", "jamanetwork.com",
      "bmj.com", "nejm.org", "aps.org", "journals.aps.org", "royalsocietypublishing.org",
    ],
  },
  preprint_et_institution: {
    score: 0.8,
    libelle: "préprint, actes de conférence ou institution publique",
    domaines: [
      // préprints & actes
      "arxiv.org", "export.arxiv.org", "biorxiv.org", "medrxiv.org", "ssrn.com",
      "papers.nips.cc", "proceedings.neurips.cc", "proceedings.mlr.press", "openreview.net",
      "hal.science", "aclanthology.org", "zenodo.org",
      // institutions publiques et organisations internationales
      "oecd.org", "imf.org", "worldbank.org", "un.org", "unesco.org", "who.int",
      "europa.eu", "ec.europa.eu", "eurostat.ec.europa.eu", "insee.fr", "iea.org",
      "ipcc.ch", "nist.gov", "nasa.gov", "nih.gov", "cnrs.fr", "inria.fr", "cern",
      "banque-france.fr", "legifrance.gouv.fr", "vie-publique.fr", "ademe.fr",
    ],
  },
  editeur_sur_son_produit: {
    score: 0.6,
    libelle: "éditeur ou laboratoire s'exprimant sur son propre produit",
    domaines: [
      "openai.com", "anthropic.com", "claude.com", "docs.claude.com", "platform.claude.com",
      "deepmind.google", "ai.googleblog.com", "research.google", "blog.google",
      "ai.meta.com", "about.fb.com", "blogs.microsoft.com", "microsoft.com",
      "mistral.ai", "x.ai", "huggingface.co", "stability.ai", "cohere.com", "nvidia.com",
    ],
  },
  encyclopedie: {
    score: 0.5,
    libelle: "encyclopédie collaborative",
    domaines: ["wikipedia.org", "wikidata.org", "wikisource.org", "britannica.com"],
  },
  presse: {
    score: 0.4,
    libelle: "presse généraliste ou spécialisée",
    domaines: [
      "lemonde.fr", "lesechos.fr", "liberation.fr", "lefigaro.fr", "mediapart.fr",
      "ft.com", "reuters.com", "apnews.com", "bloomberg.com", "economist.com",
      "nytimes.com", "theguardian.com", "wsj.com",
      "technologyreview.com", "wired.com", "theverge.com", "arstechnica.com",
      "zdnet.fr", "01net.com", "frandroid.com", "lesnumeriques.com", "usine-digitale.fr",
      "numerama.com", "clubic.com", "venturebeat.com", "techcrunch.com",
    ],
  },
};

/*
 * Redirecteurs opaques — le cas qui a motivé toute la reprise.
 *
 * `news.google.com/rss/articles/CBMiwgFBVV95cUxPR2JHMkFW…` ne porte PAS le domaine de
 * l'éditeur réel : l'identifiant est opaque, et il faut suivre la redirection en
 * réseau pour savoir de quel site il s'agit. Or ce script est hors ligne côté
 * scoring — il ne suit aucune redirection, par principe : un score qui dépendrait
 * d'un appel réseau ne serait pas reproductible, et 18 requêtes supplémentaires par
 * exécution du cron pour un simple triage ne se justifient pas.
 *
 * On ne score donc pas ce qu'on ne peut pas nommer. Ces propositions reçoivent le
 * score plancher ET un drapeau `domaine_opaque`, pour qu'elles apparaissent
 * explicitement comme « à ouvrir avant tout jugement » dans la revue humaine, plutôt
 * que de se confondre avec une source réellement peu fiable.
 *
 * Rappel de contexte : deux des sept flux actifs sont des agrégations Google News
 * (Anthropic et FMI/OCDE n'exposent pas de flux officiel utilisable — 404 et 403
 * confirmés, cf. les notes de data/seed/veille_sources.json). Ce n'est donc pas un
 * cas marginal : c'est la moitié du volume collecté.
 */
const REDIRECTEURS_OPAQUES = [
  "news.google.com", "news.yahoo.com", "feedproxy.google.com", "feeds.feedburner.com",
  "t.co", "bit.ly", "lnkd.in", "buff.ly", "ow.ly", "tinyurl.com", "dlvr.it", "flip.it",
];

const SCORE_REDIRECTEUR_OPAQUE = 0.15;
const SCORE_PAR_DEFAUT = 0.4;

/** Hôte en minuscules, sans `www.`. `null` si l'url est inexploitable. */
function hote(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Un domaine de la table correspond s'il est égal à l'hôte ou s'il en est un
 * suffixe de domaine (`fr.wikipedia.org` ↦ `wikipedia.org`). La comparaison passe
 * par un point pour éviter le piège classique : `notopenai.com` ne doit pas
 * correspondre à `openai.com`.
 */
function correspond(h, domaine) {
  return h === domaine || h.endsWith(`.${domaine}`);
}

/**
 * Score de fiabilité d'une proposition, calculé sur le domaine de SON url.
 *
 * @param {string|null|undefined} url url de la proposition (item.link)
 * @returns {{score:number, palier:string, motif:string, domaine:string|null, opaque:boolean}}
 */
export function scoreFiabilite(url) {
  const h = hote(url);
  if (!h) {
    return {
      score: SCORE_PAR_DEFAUT,
      palier: "inconnu",
      motif: "aucune url exploitable sur la proposition — score par défaut prudent",
      domaine: null,
      opaque: false,
    };
  }

  if (REDIRECTEURS_OPAQUES.some((d) => correspond(h, d))) {
    return {
      score: SCORE_REDIRECTEUR_OPAQUE,
      palier: "redirecteur_opaque",
      motif: `${h} est un redirecteur : l'url ne porte pas le domaine de l'éditeur réel, la fiabilité ne peut pas être établie sans ouvrir le lien`,
      domaine: h,
      opaque: true,
    };
  }

  for (const [palier, def] of Object.entries(PALIERS)) {
    if (def.domaines.some((d) => correspond(h, d))) {
      return { score: def.score, palier, motif: `${h} — ${def.libelle}`, domaine: h, opaque: false };
    }
  }

  return {
    score: SCORE_PAR_DEFAUT,
    palier: "inconnu",
    motif: `${h} — domaine absent de la table : score par défaut prudent, sous le seuil de source primaire`,
    domaine: h,
    opaque: false,
  };
}

// ---------------------------------------------------------------------------
// Lecture des fichiers
// ---------------------------------------------------------------------------

function lireJSON(chemin, defaut) {
  if (!existsSync(chemin)) return defaut;
  try {
    return JSON.parse(readFileSync(chemin, "utf-8"));
  } catch (e) {
    console.error(`Fichier illisible : ${chemin} — ${e.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Mode --rescorer : ce que la nouvelle table dit de la file existante
// ---------------------------------------------------------------------------

/*
 * Volontairement en LECTURE SEULE. Réécrire les scores stockés reviendrait à
 * modifier a posteriori des propositions déjà arbitrées par un humain (134 des 187
 * sont au statut `rejete`), et à faire disparaître la trace de ce sur quoi
 * l'arbitrage a porté. Le mode rend l'écart ; la décision d'en tirer quelque chose
 * appartient à la revue.
 */
function rescorer() {
  const queue = lireJSON(CHEMIN_QUEUE, []);
  const lignes = queue.map((item) => {
    const url = item?.contenu_propose?.link ?? item?.contenu_propose?.url ?? null;
    const s = scoreFiabilite(url);
    return {
      id: item?.id ?? null,
      source_id: item?.source_id ?? null,
      statut: item?.statut ?? null,
      titre: item?.contenu_propose?.titre ?? item?.contenu_propose?.nom ?? "(sans titre)",
      url,
      score_stocke: typeof item?.score_fiabilite === "number" ? item.score_fiabilite : null,
      score_recalcule: s.score,
      palier: s.palier,
      opaque: s.opaque,
      motif: s.motif,
    };
  });

  const change = lignes.filter((l) => l.score_stocke !== l.score_recalcule);
  const perdent = lignes.filter((l) => (l.score_stocke ?? 0) >= 0.8 && l.score_recalcule < 0.8);
  const gagnent = lignes.filter((l) => (l.score_stocke ?? 0) < 0.8 && l.score_recalcule >= 0.8);

  if (SORTIE_JSON) {
    process.stdout.write(
      `${JSON.stringify({ total: lignes.length, modifies: change.length, perdent_le_statut_primaire: perdent.length, gagnent_le_statut_primaire: gagnent.length, lignes }, null, 2)}\n`
    );
    return;
  }

  console.log(`RESCORAGE DE LA FILE — ${CHEMIN_QUEUE}`);
  console.log("Lecture seule : aucun fichier n'est modifié.\n");

  const parPalier = new Map();
  for (const l of lignes) {
    const cle = `${l.palier} (${l.score_recalcule})`;
    parPalier.set(cle, (parPalier.get(cle) ?? 0) + 1);
  }
  const largeur = Math.max(...[...parPalier.keys()].map((k) => k.length));
  console.log("Répartition après recalcul");
  console.log("─".repeat(largeur + 10));
  for (const [k, n] of [...parPalier.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(largeur)}  ${String(n).padStart(4)}`);
  }

  console.log(`\n${lignes.length} proposition(s) · ${change.length} score(s) modifié(s)`);
  console.log(`  ${perdent.length} perdent l'accès automatique au statut de source primaire (score ≥ 0,8)`);
  console.log(`  ${gagnent.length} le gagnent`);

  const opaques = lignes.filter((l) => l.opaque);
  if (opaques.length > 0) {
    console.log(`\n${opaques.length} proposition(s) derrière un redirecteur opaque — à ouvrir avant tout jugement :`);
    for (const l of opaques.slice(0, 8)) console.log(`  • ${l.titre.slice(0, 90)}`);
    if (opaques.length > 8) console.log(`  … et ${opaques.length - 8} autre(s)`);
  }
}

// ---------------------------------------------------------------------------
// Collecte
// ---------------------------------------------------------------------------

async function collecter() {
  const sources = lireJSON(CHEMIN_SOURCES, []).filter((s) => s.type === "rss" && s.actif && s.url);
  if (sources.length === 0) {
    console.warn("Aucune source RSS active déclarée dans data/seed/veille_sources.json — rien à collecter.");
    return { ajoutees: 0, flux_ok: 0, flux_en_echec: 0, nouvelles: [] };
  }

  const queue = lireJSON(CHEMIN_QUEUE, []);
  const dejaVues = new Set(queue.map((q) => q.contenu_propose?.link).filter(Boolean));

  const nouvelles = [];
  let fluxOk = 0;
  let fluxEchec = 0;

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);
      let ajoutees = 0;
      for (const item of (feed.items ?? []).slice(0, 5)) {
        if (!item.link || dejaVues.has(item.link)) continue;
        const fiabilite = scoreFiabilite(item.link);
        nouvelles.push({
          id: crypto.randomUUID(),
          source_id: source.id,
          // à requalifier manuellement (fiche_humaine / fiche_ia / gap) à la validation
          cible_type: "nouvelle_categorie",
          cible_id: null,
          contenu_propose: {
            titre: item.title ?? "(sans titre)",
            link: item.link,
            date: item.isoDate ?? item.pubDate ?? null,
            resume: (item.contentSnippet ?? "").slice(0, 400),
          },
          score_fiabilite: fiabilite.score,
          // Le score seul ne se conteste pas : on transporte ce sur quoi il repose,
          // pour que la revue humaine puisse le contredire en connaissance de cause.
          score_fiabilite_motif: fiabilite.motif,
          domaine_source: fiabilite.domaine,
          domaine_opaque: fiabilite.opaque,
          statut: "en_attente",
          created_at: new Date().toISOString(),
        });
        dejaVues.add(item.link);
        ajoutees++;
      }
      fluxOk++;
      if (!SORTIE_JSON) console.log(`✓ ${source.nom} — ${feed.items?.length ?? 0} item(s) vu(s), ${ajoutees} retenu(s)`);
    } catch (err) {
      fluxEchec++;
      if (!SORTIE_JSON) {
        console.warn(`✗ ${source.nom} — échec (${err.message}) — à vérifier manuellement (url morte ? réseau ?)`);
      }
    }
  }

  if (nouvelles.length > 0 && !SIMULATION) {
    writeFileSync(CHEMIN_QUEUE, JSON.stringify([...queue, ...nouvelles], null, 2));
  }

  return { ajoutees: nouvelles.length, flux_ok: fluxOk, flux_en_echec: fluxEchec, nouvelles };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

async function main() {
  if (RESCORER) {
    rescorer();
    return;
  }

  const bilan = await collecter();

  if (SORTIE_JSON) {
    process.stdout.write(`${JSON.stringify({ simulation: SIMULATION, ...bilan }, null, 2)}\n`);
  } else {
    const suffixe = SIMULATION ? " (SIMULATION — rien n'a été écrit)" : "";
    console.log(`\n${bilan.ajoutees} nouvelle(s) proposition(s) pour ${CHEMIN_QUEUE}${suffixe}.`);
    const opaques = bilan.nouvelles.filter((n) => n.domaine_opaque).length;
    if (opaques > 0) {
      console.log(`${opaques} d'entre elles passent par un redirecteur opaque : score plancher, à ouvrir avant jugement.`);
    }
    console.log("Rappel : aucune fiche n'est mise à jour automatiquement — validation manuelle requise (statut en_attente).");
  }

  // Tous les flux en échec alors que des flux étaient déclarés : ce n'est pas une
  // file vide, c'est une panne (réseau, proxy, flux tous morts). Le cron doit rougir.
  if (bilan.flux_ok === 0 && bilan.flux_en_echec > 0) {
    console.error("Aucun flux joignable — collecte en échec.");
    process.exitCode = 1;
  }
}

main();

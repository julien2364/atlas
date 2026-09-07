/*
 * Audit mécanique exhaustif du corpus ATLAS Humain × IA — les 512 fiches.
 *
 * Rôle dans le projet
 * -------------------
 * Trois filets existent déjà et ne se recouvrent pas :
 *   - `scripts/valider-donnees.mjs` applique `lib/types.ts` aux données (forme,
 *     énumérations, intégrité référentielle). Il sort à 0 erreur : le corpus est
 *     bien formé.
 *   - `scripts/verifier-liens.mjs` va voir si les URL déclarées répondent encore.
 *     C'est le seul script du lot qui parle au réseau.
 *   - `docs/audit-fond-2026-09-07.md` a lu et confronté 69 fiches à leurs sources.
 *     Un humain (ou un agent en lecture) ne peut pas faire mieux qu'un échantillon.
 *
 * Il manquait la quatrième case : les défauts qui ne sont ni une faute de schéma,
 * ni une URL morte, ni un contresens de lecture, mais des **régularités anormales
 * visibles seulement à l'échelle du corpus entier** — un gabarit de rédaction
 * recopié d'une fiche à l'autre, une formule d'attribution vague répétée par des
 * agents différents, un titre de source qui n'a jamais désigné de document réel.
 * Aucun de ces défauts n'est détectable sur une fiche prise isolément : il faut
 * les 512 en mémoire en même temps. C'est ce que fait ce script.
 *
 * Il est hors ligne, sans dépendance, et il NE CORRIGE RIEN : il produit un constat
 * et une liste de fiches à reprendre triée par gravité. La vérification des URL
 * reste le travail de `scripts/verifier-liens.mjs`, qui n'est pas dupliqué ici.
 *
 * Ce qu'il ne peut pas faire (à lire avant d'exploiter le rapport)
 * ---------------------------------------------------------------
 * Toutes les détections ici sont *syntaxiques*. Le script ne sait pas si une fiche
 * dit vrai — c'est le travail de l'audit de fond. Il sait dire qu'un passage de
 * 17 mots apparaît mot pour mot dans deux fiches sans lien, que 24 fiches ouvrent
 * leur critique par « jugé par certains », ou qu'un titre de source ne contient
 * aucun élément permettant de retrouver un document. Chaque heuristique porte
 * ci-dessous son intention et son taux de faux positifs estimé ; les heuristiques
 * bruyantes sont rapportées comme des *signaux*, pas comme des défauts avérés, et
 * marquées comme telles dans la sortie (elles n'entrent ni dans la liste de reprise
 * ni dans le code de sortie).
 *
 * Usage
 * -----
 *   node scripts/auditer-corpus.mjs                     # rapport lisible en français
 *   node scripts/auditer-corpus.mjs --json              # sortie machine (un seul objet JSON)
 *   node scripts/auditer-corpus.mjs --seuil=12          # longueur mini d'un passage recopié (mots)
 *   node scripts/auditer-corpus.mjs --seuil-court=0.55  # ratio à la médiane d'axe sous lequel
 *                                                       # un champ est jugé anormalement court
 *   node scripts/auditer-corpus.mjs --section=B         # ne détaille qu'une section (A..G)
 *   node scripts/auditer-corpus.mjs --max=50            # nb max de lignes détaillées par catégorie
 *   node scripts/auditer-corpus.mjs --racine=/chemin
 *   node scripts/auditer-corpus.mjs --aide
 *
 * Codes de sortie
 * ---------------
 *   0  aucun défaut de gravité « bloquant »
 *   1  au moins un défaut bloquant (source non identifiable, recopie franche,
 *      règle de confiance des gaps violée, secteur dupliqué dans une fiche IA)
 *   2  erreur d'usage ou corpus introuvable
 *
 * Le code 1 n'est pas un échec de CI : ce script est un instrument d'audit, pas un
 * garde-fou anti-régression. Il est fait pour être lancé à la main avant une revue,
 * et son code de sortie sert à savoir s'il reste du travail bloquant, pas à casser
 * une publication (c'est `valider-donnees.mjs` qui a ce rôle).
 */

import { readFileSync, readdirSync, existsSync, writeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

/**
 * Sortie en erreur. `console.error` puis `process.exit()` peut tronquer le message
 * quand stderr est un tuyau : Node y écrit de façon asynchrone et `exit` ne vide pas
 * le tampon. On écrit donc directement sur le descripteur 2, en synchrone.
 */
function echouer(message, code = 2) {
  writeSync(2, `${message}\n`);
  process.exit(code);
}

const AIDE = `Audit mécanique exhaustif du corpus ATLAS Humain × IA (512 fiches).

  node scripts/auditer-corpus.mjs [options]

Options
  --aide                Affiche cette aide et quitte.
  --json                Sortie machine : un unique objet JSON sur stdout.
  --seuil=N             Longueur minimale, en mots, d'un passage considéré comme
                        recopié d'une fiche à l'autre (défaut 10, bornes 4-60).
  --seuil-court=R       Ratio à la médiane de l'axe sous lequel un champ est jugé
                        anormalement court (défaut 0.60, soit 60 % de la médiane).
  --section=X           Ne détaille que la section X (A, B, C, D, E, F ou G).
  --max=N               Nombre maximal de lignes détaillées par catégorie (défaut 25).
  --racine=CHEMIN       Racine du dépôt (défaut : le parent de scripts/).

Sections du rapport
  A  Traçabilité des sources
  B  Recopie de passages entre fiches
  C  Formules creuses et non attribuées
  D  Cohérence interne des fiches IA
  E  Cohérence des fiches de gap
  F  Cohérence chronologique et longueurs anormales
  G  Statistiques de couverture

Aucun appel réseau : la disponibilité des URL relève de scripts/verifier-liens.mjs.

Codes de sortie : 0 rien de bloquant, 1 au moins un défaut bloquant, 2 erreur d'usage.`;

if (args.includes("--aide") || args.includes("-h") || args.includes("--help")) {
  console.log(AIDE);
  process.exit(0);
}

const OPTIONS_CONNUES = ["--aide", "-h", "--help", "--json"];
const OPTIONS_VALEUR = ["--seuil=", "--seuil-court=", "--section=", "--max=", "--racine="];
for (const a of args) {
  if (OPTIONS_CONNUES.includes(a)) continue;
  if (OPTIONS_VALEUR.some((o) => a.startsWith(o))) continue;
  echouer(`Option inconnue : ${a}\n\n${AIDE}`);
}

function valeur(prefixe, defaut) {
  const brut = args.find((a) => a.startsWith(prefixe));
  return brut === undefined ? defaut : brut.slice(prefixe.length);
}

const SORTIE_JSON = args.includes("--json");
const SEUIL_RECOPIE = Number(valeur("--seuil=", "10"));
const SEUIL_COURT = Number(valeur("--seuil-court=", "0.60"));
const SECTION = (valeur("--section=", "") || "").toUpperCase();
const MAX_LIGNES = Number(valeur("--max=", "25"));

if (!Number.isInteger(SEUIL_RECOPIE) || SEUIL_RECOPIE < 4 || SEUIL_RECOPIE > 60) {
  echouer("--seuil= attend un entier entre 4 et 60 (longueur d'un passage en mots).");
}
if (!(SEUIL_COURT > 0 && SEUIL_COURT < 1)) {
  echouer("--seuil-court= attend un ratio strictement compris entre 0 et 1.");
}
if (!Number.isInteger(MAX_LIGNES) || MAX_LIGNES < 1) {
  echouer("--max= attend un entier positif.");
}
if (SECTION && !"ABCDEFG".includes(SECTION)) {
  echouer("--section= attend une lettre parmi A B C D E F G.");
}

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = valeur("--racine=", path.resolve(ICI, ".."));
const SEED = path.join(RACINE, "data", "seed");
if (!existsSync(SEED)) {
  echouer(`Corpus introuvable : ${SEED}`);
}

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

function lireJSON(chemin) {
  try {
    return JSON.parse(readFileSync(chemin, "utf-8"));
  } catch (e) {
    echouer(`Lecture impossible : ${chemin} — ${e.message}`);
  }
}

const DOSSIER_H = path.join(SEED, "fiches_humaines");
const fichiersH = existsSync(DOSSIER_H)
  ? readdirSync(DOSSIER_H)
      .filter((f) => f.endsWith(".json"))
      .sort()
  : [];

// Les fiches humaines sont réparties en plusieurs fichiers. Ces fichiers sont aussi
// les « lots » de rédaction : c'est à ce niveau que la cohérence chronologique a un
// sens (section F), d'où la mémoire du fichier d'origine sur chaque fiche.
const HUMAINES = [];
const LOTS = new Map(); // nom de lot -> [fiches]
for (const f of fichiersH) {
  const arr = lireJSON(path.join(DOSSIER_H, f));
  if (!Array.isArray(arr)) continue;
  LOTS.set(`fiches_humaines/${f}`, arr);
  for (const fiche of arr) HUMAINES.push({ ...fiche, _lot: `fiches_humaines/${f}` });
}
const IA = lireJSON(path.join(SEED, "fiches_ia.json"));
const GAPS = lireJSON(path.join(SEED, "fiches_gap.json"));
LOTS.set("fiches_ia.json", IA);
LOTS.set("fiches_gap.json", GAPS);
const QUESTIONS = existsSync(path.join(SEED, "questions.json"))
  ? lireJSON(path.join(SEED, "questions.json"))
  : [];

const parIdH = new Map(HUMAINES.map((f) => [f.id, f]));
const parIdIA = new Map(IA.map((f) => [f.id, f]));
const parIdGap = new Map(GAPS.map((g) => [g.id, g]));

// ---------------------------------------------------------------------------
// Collecte des constats
// ---------------------------------------------------------------------------

/**
 * Un constat = une observation reproductible sur une ou plusieurs fiches.
 * `gravite` : bloquant | serieux | mineur | signal.
 *   - « signal » est réservé aux heuristiques dont on sait qu'elles produisent des
 *     faux positifs : elles sont comptées et listées, mais jamais présentées comme
 *     un défaut avéré, et n'entrent ni dans la liste de reprise ni dans le code de
 *     sortie. C'est le prix de l'honnêteté : une heuristique bruyante reste utile
 *     à condition d'être annoncée comme telle.
 * `cibles` : ids de fiches concernées — c'est ce qui alimente la liste de reprise.
 *   Un constat transversal (qui vaut pour tout le corpus) ne renseigne pas `cibles`,
 *   sinon il noierait la liste sous 512 lignes identiques.
 */
const constats = [];
function constat(section, code, gravite, titre, cibles, detail, extra = {}) {
  constats.push({ section, code, gravite, titre, cibles: [...new Set(cibles)], detail, ...extra });
}

// ---------------------------------------------------------------------------
// Outils de texte
// ---------------------------------------------------------------------------

const DIACRITIQUES = /[̀-ͯ]/g;

/**
 * Normalisation : minuscules, accents retirés, apostrophes et guillemets unifiés.
 * On compare du texte rédigé par des agents différents : la casse, l'apostrophe
 * typographique et les guillemets varient sans que le passage change.
 */
function normaliser(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[«»“”"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Découpage en mots pour la comparaison de passages. La ponctuation est écrasée :
 * une recopie reste une recopie si un point-virgule a été changé en virgule.
 */
/**
 * Variante de `normaliser` qui PRÉSERVE les positions de caractères : elle ne
 * touche ni aux espaces ni aux bornes. Indispensable en section C, où l'index d'une
 * correspondance trouvée sur le texte normalisé doit pointer au bon endroit du texte
 * d'origine pour aller y chercher un nom propre. (La décomposition NFD suivie du
 * retrait des diacritiques rend un caractère pour un caractère sur les précomposés
 * du français, donc la longueur est conservée.)
 */
function normaliserAligne(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[«»“”"]/g, " ");
}

function mots(s) {
  return normaliser(s)
    .replace(/[^a-z0-9' ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function ngrammes(liste, k) {
  const out = new Set();
  for (let i = 0; i + k <= liste.length; i++) out.add(liste.slice(i, i + k).join(" "));
  return out;
}

/**
 * Plus longue suite de mots commune à deux textes (programmation dynamique sur une
 * seule ligne de la matrice : les champs font au plus quelques centaines de mots,
 * le coût est négligeable et on évite d'allouer une matrice par paire).
 */
function plusLongPassageCommun(a, b) {
  if (!a.length || !b.length) return { longueur: 0, passage: "" };
  let precedent = new Array(b.length + 1).fill(0);
  let meilleur = 0;
  let finA = 0;
  for (let i = 1; i <= a.length; i++) {
    const courant = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        courant[j] = precedent[j - 1] + 1;
        if (courant[j] > meilleur) {
          meilleur = courant[j];
          finA = i;
        }
      }
    }
    precedent = courant;
  }
  return { longueur: meilleur, passage: a.slice(finA - meilleur, finA).join(" ") };
}

function extrait(s, n = 110) {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

// ---------------------------------------------------------------------------
// Inventaire des sources
// ---------------------------------------------------------------------------

/**
 * Toutes les entrées de source du corpus, à plat, avec leur emplacement exact.
 * `porteur` est l'id de la fiche : c'est lui qui alimente la liste de reprise.
 * `conteneur` distingue la liste `sources` d'une fiche, celle d'un `usage` et les
 * `documents_cles` d'un gap — trois listes que le validateur traite de la même
 * façon mais qui n'ont pas la même exigence éditoriale.
 */
const SOURCES = [];
function collecter(liste, porteur, referentiel, conteneur) {
  if (!Array.isArray(liste)) return;
  liste.forEach((s, i) => SOURCES.push({ ...s, porteur, referentiel, conteneur, rang: i }));
}
for (const f of HUMAINES) collecter(f.sources, f.id, "humaine", "sources");
for (const f of IA) {
  collecter(f.sources, f.id, "ia", "sources");
  for (const u of f.usages ?? []) collecter(u.sources, f.id, "ia", `usages[${u.secteur}]`);
}
for (const g of GAPS) collecter(g.documents_cles, g.id, "gap", "documents_cles");

const STATUTS_PUBLIES = ["documente", "verifie_recemment", "a_re_auditer"];

// ===========================================================================
// SECTION A — Traçabilité des sources
// ===========================================================================

/*
 * Heuristique « intention de source » — le point le plus délicat du script, donc
 * le plus explicité.
 *
 * L'audit de fond a relevé que certains titres de source ne désignent aucun
 * document : « Systèmes d'aide à la décision publique par IA — documentation
 * GovTech », « AlphaFold — impact sur la recherche pharmaceutique ». Personne ne
 * peut aller les ouvrir : ce sont des descriptions de ce qu'on aurait voulu citer.
 *
 * On ne peut pas trancher cela sur le sens. On le tranche sur trois critères
 * conjoints, tous vérifiables mécaniquement :
 *
 *   (1) le titre contient un MARQUEUR DE GÉNÉRICITÉ — une tournure qui décrit une
 *       catégorie de documents et non un document (« documentation sectorielle »,
 *       « rapports sur », « recherche académique sur », « impact sur »…) ;
 *   (2) il ne contient AUCUNE ANNÉE entre 1500 et 2029 — une année est le marqueur
 *       d'individuation le plus fiable et le plus universel d'une publication ;
 *   (3) il ne contient AUCUN ANCRAGE ÉDITORIAL — ni motif d'auteur (« et al. »,
 *       « Nom, Nom — »), ni nom de revue ou d'éditeur scientifique reconnu (Nature,
 *       Science, arXiv, IEEE…), ni référence de norme, de loi ou de règlement.
 *
 * Les trois doivent être vrais simultanément. Un titre générique mais daté
 * (« Rapports d'évaluation du GIEC (depuis 1990) ») reste retrouvable ; un titre
 * générique mais signé (« Ji et al., Survey of Hallucination in NLG, ACM Computing
 * Surveys ») aussi. Ce cumul est ce qui rend l'heuristique défendable : elle
 * n'attrape que les titres qui ne portent simultanément aucun des trois moyens
 * usuels d'identifier un document.
 *
 * Limite assumée : elle est conservatrice, donc silencieuse sur les titres vagues
 * qui n'emploient aucune des tournures listées (« Documentation Anthropic », qui ne
 * dit pas quelle page). Le second niveau ci-dessous — « titre non individuant » —
 * borne ce reste, mais il est bruyant et n'est rendu que comme signal, avec son
 * taux de faux positifs mesuré.
 */

const MARQUEURS_GENERICITE = [
  /\bdocumentations?\b/,
  /\brapports? (sur|d')\b/,
  /\brapports? de (recherche|synthese|veille|marche)\b/,
  /\betudes? (sur|de)\b/,
  /\bsyntheses? (academiques?|sur|de)\b/,
  /\brecherche academique\b/,
  /\btravaux (sur|de recherche)\b/,
  /\bpublications? (sur|academiques?)\b/,
  /\blitterature (scientifique|academique|sur)\b/,
  /\bimpact sur\b/,
  /\bexemples? de\b/,
  /\b(divers|diverses|multiples|varies|variees)\b/,
  /\bsources? (multiples|diverses|ouvertes)\b/,
  /\barticles? de presse\b/,
  /\bsite (officiel|web)\b/,
  /\betat de l'art\b/,
];

const ANNEE = /\b(1[5-9]\d{2}|20[0-2]\d)\b/;
const ANNEE_GLOBALE = /\b(1[5-9]\d{2}|20[0-2]\d)\b/g;

const ANCRAGE_EDITORIAL = [
  /\bet al\.?/,
  /\b(nature|science|cell|pnas|lancet|jama|neurips|icml|iclr|acl|cvpr|arxiv|ieee|acm|springer|elsevier|oecd|ocde|oms|who|onu|unesco|insee|eurostat|nber|giec|ipcc)\b/,
  /\bvol\.?\s*\d|\bno\.?\s*\d|\bpp?\.\s*\d/,
  /\biso\s*\d|\brgpd\b|\bai act\b|\bdirective \d|\breglement \(/,
  /[a-zà-ÿ]+,\s*[a-zà-ÿ]+\s*(—|-|:)/, // motif « Nom, Nom — Titre »
];

function estIntentionDeSource(titre) {
  const t = normaliser(titre);
  if (!t) return false;
  if (!MARQUEURS_GENERICITE.some((r) => r.test(t))) return false;
  if (ANNEE.test(String(titre ?? ""))) return false;
  if (ANCRAGE_EDITORIAL.some((r) => r.test(t))) return false;
  return true;
}

/**
 * Second niveau, bruyant : titre qui ne porte NI année, NI ancrage éditorial, NI
 * majuscule interne — donc rien qui individualise un document — quelle que soit sa
 * tournure. Le taux de faux positifs est mesurable sans arbitrage humain : toute
 * détection portant une URL est un faux positif par construction, puisqu'une source
 * cliquable est individuée par son lien.
 */
function estTitreNonIndividuant(titre) {
  const t = String(titre ?? "").trim();
  if (!t) return true;
  if (ANNEE.test(t)) return false;
  const n = normaliser(t);
  if (ANCRAGE_EDITORIAL.some((r) => r.test(n))) return false;
  const corps = t.replace(/^[^A-Za-zÀ-Þ]*[A-ZÀ-Þ]/, "");
  return !/[A-ZÀ-Þ]/.test(corps);
}

function cleSource(s) {
  return `${(s.url ?? "").trim().toLowerCase()}|${normaliser(s.titre)}`;
}

function auditA() {
  // A1 / A2 — sources sans URL, par type
  const primaires = SOURCES.filter((s) => s.type === "primaire");
  const secondaires = SOURCES.filter((s) => s.type === "secondaire");
  const primairesSansUrl = primaires.filter((s) => !s.url);
  const secondairesSansUrl = secondaires.filter((s) => !s.url);

  constat(
    "A",
    "A1-primaire-sans-url",
    "serieux",
    "Source primaire sans URL — la moitié du dispositif de traçabilité est structurellement absente",
    primairesSansUrl.map((s) => s.porteur),
    primairesSansUrl.map((s) => `${s.porteur} · ${s.conteneur} · ${extrait(s.titre)}`),
    { total: primairesSansUrl.length, sur: primaires.length }
  );
  constat(
    "A",
    "A2-secondaire-sans-url",
    "serieux",
    "Source secondaire sans URL — une source secondaire est censée être la pièce consultable de la paire",
    secondairesSansUrl.map((s) => s.porteur),
    secondairesSansUrl.map((s) => `${s.porteur} · ${s.conteneur} · ${extrait(s.titre)}`),
    { total: secondairesSansUrl.length, sur: secondaires.length }
  );

  // A3 — sources sans date (transversal : ne pas polluer la liste de reprise)
  const sansDate = SOURCES.filter((s) => !s.date);
  constat(
    "A",
    "A3-source-sans-date",
    "serieux",
    "Source sans date de publication ni de consultation",
    [],
    [
      `${sansDate.length} entrées de source sur ${SOURCES.length} n'ont aucun champ « date ».`,
      `Seules ${SOURCES.length - sansDate.length} entrée(s) en portent une.`,
    ],
    { total: sansDate.length, sur: SOURCES.length, transversal: true }
  );

  // A4 — intention de source.
  // On sépare deux cas que le même test attrape mais qui n'appellent pas le même
  // travail : sans URL, la source est INTROUVABLE (c'est le défaut décrit par
  // l'audit de fond, et il est bloquant) ; avec URL, elle est atteignable et seul
  // son intitulé est à préciser (défaut mineur d'étiquetage).
  const intentions = SOURCES.filter((s) => estIntentionDeSource(s.titre));
  const intentionsSansUrl = intentions.filter((s) => !s.url);
  const intentionsAvecUrl = intentions.filter((s) => s.url);
  constat(
    "A",
    "A4-intention-de-source",
    "bloquant",
    "Titre de source qui ne désigne aucun document identifiable et qui ne porte pas d'URL — ni année, ni auteur, ni revue, et une tournure de catégorie : la source est introuvable",
    intentionsSansUrl.map((s) => s.porteur),
    intentionsSansUrl.map((s) => `${s.porteur} · ${s.conteneur} · [${s.type}] ${extrait(s.titre)}`),
    {
      total: intentionsSansUrl.length,
      primaires: intentionsSansUrl.filter((s) => s.type === "primaire").length,
    }
  );
  constat(
    "A",
    "A4ter-titre-generique-mais-url-presente",
    "mineur",
    "Titre de source générique (« Documentation Anthropic », « — Documentation officielle ») mais URL présente — la source est atteignable, seul l'intitulé est à préciser",
    intentionsAvecUrl.map((s) => s.porteur),
    intentionsAvecUrl.map((s) => `${s.porteur} · ${s.conteneur} · [${s.type}] ${extrait(s.titre)}\n      ${s.url}`),
    { total: intentionsAvecUrl.length }
  );

  // A4bis — signal bruyant, avec taux de faux positifs mesuré
  const nonIndividuants = SOURCES.filter((s) => estTitreNonIndividuant(s.titre));
  const fauxPositifs = nonIndividuants.filter((s) => s.url).length;
  constat(
    "A",
    "A4bis-titre-non-individuant",
    "signal",
    "Titre ne portant ni année, ni auteur, ni revue, ni majuscule interne — signal seul",
    [],
    nonIndividuants.map((s) => `${s.porteur} · ${s.conteneur} · ${extrait(s.titre)}`),
    {
      total: nonIndividuants.length,
      faux_positifs_mesures: fauxPositifs,
      taux_faux_positifs: nonIndividuants.length ? Math.round((fauxPositifs / nonIndividuants.length) * 100) : 0,
      transversal: true,
    }
  );

  // A5 — même source répétée dans une même liste
  const doublonsListe = [];
  function scanListe(liste, porteur, conteneur) {
    const vues = new Set();
    for (const s of liste ?? []) {
      const k = cleSource(s);
      if (vues.has(k)) doublonsListe.push(`${porteur} · ${conteneur} · ${extrait(s.titre)}`);
      vues.add(k);
    }
  }
  for (const f of HUMAINES) scanListe(f.sources, f.id, "sources");
  for (const f of IA) {
    scanListe(f.sources, f.id, "sources");
    for (const u of f.usages ?? []) scanListe(u.sources, f.id, `usages[${u.secteur}]`);
  }
  for (const g of GAPS) scanListe(g.documents_cles, g.id, "documents_cles");
  constat(
    "A",
    "A5-doublon-dans-une-liste",
    "serieux",
    "Même source répétée deux fois dans une même liste",
    doublonsListe.map((l) => l.split(" · ")[0]),
    doublonsListe,
    { total: doublonsListe.length }
  );

  // A6 — usage sectoriel dont la source est celle de la fiche
  const redondancesUsage = [];
  for (const f of IA) {
    const auNiveauFiche = new Set((f.sources ?? []).map(cleSource));
    for (const u of f.usages ?? []) {
      for (const s of u.sources ?? []) {
        if (auNiveauFiche.has(cleSource(s))) {
          redondancesUsage.push(`${f.id} · usages[${u.secteur}] · reprend la source de fiche · ${extrait(s.titre)}`);
        }
      }
    }
  }
  constat(
    "A",
    "A6-source-usage-identique-a-la-fiche",
    "mineur",
    "Usage sectoriel dont l'unique source est exactement celle de la fiche — l'usage n'a pas de source propre",
    redondancesUsage.map((l) => l.split(" · ")[0]),
    redondancesUsage,
    { total: redondancesUsage.length }
  );

  // A7 — même URL sous plusieurs titres
  const parUrl = new Map();
  for (const s of SOURCES) {
    if (!s.url) continue;
    const k = s.url.trim();
    if (!parUrl.has(k)) parUrl.set(k, new Map());
    const m = parUrl.get(k);
    const t = String(s.titre ?? "").trim();
    if (!m.has(t)) m.set(t, []);
    m.get(t).push(s.porteur);
  }
  const urlPolyTitre = [...parUrl.entries()].filter(([, m]) => m.size > 1);
  constat(
    "A",
    "A7-url-sous-plusieurs-titres",
    "mineur",
    "Même URL citée sous des titres différents à travers le corpus — le dédoublonnage et l'index RAG comptent deux sources là où il n'y en a qu'une",
    urlPolyTitre.flatMap(([, m]) => [...m.values()].flat()),
    urlPolyTitre.map(([u, m]) => `${u}\n      ${[...m.keys()].map((t) => `« ${t} »`).join("\n      ")}`),
    { total: urlPolyTitre.length }
  );

  // A8 — même titre sous plusieurs URL
  const parTitre = new Map();
  for (const s of SOURCES) {
    if (!s.url) continue;
    const t = normaliser(s.titre);
    if (!parTitre.has(t)) parTitre.set(t, new Map());
    const m = parTitre.get(t);
    const u = s.url.trim();
    if (!m.has(u)) m.set(u, []);
    m.get(u).push(s.porteur);
  }
  const titrePolyUrl = [...parTitre.entries()].filter(([, m]) => m.size > 1);
  constat(
    "A",
    "A8-titre-sous-plusieurs-url",
    "serieux",
    "Même titre de source pointant vers des URL différentes — soit deux documents confondus, soit la même page stockée en deux encodages",
    titrePolyUrl.flatMap(([, m]) => [...m.values()].flat()),
    titrePolyUrl.map(([t, m]) => `« ${t} »\n      ${[...m.keys()].join("\n      ")}`),
    { total: titrePolyUrl.length }
  );

  // A9 — plusieurs documents empilés dans un seul titre
  const agregees = SOURCES.filter((s) => {
    const t = String(s.titre ?? "");
    return t.includes(" ; ") || (t.match(ANNEE_GLOBALE) ?? []).length >= 3;
  });
  constat(
    "A",
    "A9-source-agregee",
    "serieux",
    "Plusieurs documents empilés dans un seul champ « titre » — la référence n'est ni citable ni vérifiable une par une",
    agregees.map((s) => s.porteur),
    agregees.map((s) => `${s.porteur} · ${s.conteneur} · ${extrait(s.titre, 150)}`),
    { total: agregees.length }
  );

  // A10 — fiche publiée avec moins de deux sources
  const maigres = [];
  for (const f of HUMAINES) {
    if (!STATUTS_PUBLIES.includes(f.statut)) continue;
    const n = (f.sources ?? []).length;
    if (n < 2) maigres.push(`${f.id} · axe ${f.axe} · ${n} source(s)`);
  }
  for (const f of IA) {
    if (!STATUTS_PUBLIES.includes(f.statut)) continue;
    const n = (f.sources ?? []).length;
    if (n < 2) maigres.push(`${f.id} · fiche IA · ${n} source(s)`);
  }
  constat(
    "A",
    "A10-moins-de-deux-sources",
    "serieux",
    "Fiche publiée portant moins de deux sources — la règle du référentiel en exige une primaire et une secondaire",
    maigres.map((l) => l.split(" · ")[0]),
    maigres,
    { total: maigres.length }
  );

  // A11 — fiche humaine publiée sans aucune secondaire cliquable
  const sansSecondaireUrl = [];
  for (const f of HUMAINES) {
    if (!STATUTS_PUBLIES.includes(f.statut)) continue;
    if (!(f.sources ?? []).some((s) => s.type === "secondaire" && s.url)) {
      sansSecondaireUrl.push(`${f.id} · axe ${f.axe}`);
    }
  }
  constat(
    "A",
    "A11-aucune-secondaire-cliquable",
    "serieux",
    "Fiche humaine publiée sans aucune source secondaire munie d'une URL",
    sansSecondaireUrl.map((l) => l.split(" · ")[0]),
    sansSecondaireUrl,
    { total: sansSecondaireUrl.length }
  );
}

// ===========================================================================
// SECTION B — Recopie de passages entre fiches
// ===========================================================================

/*
 * Ce que l'on cherche : un gabarit de rédaction. Quand plusieurs agents reçoivent
 * le même prompt, ils produisent parfois la même phrase. Ce n'est pas du plagiat,
 * c'est un signe que le champ n'a pas été rédigé à partir de la source de la fiche
 * mais recopié d'ailleurs — exactement le défaut central relevé par l'audit de fond.
 *
 * Méthode en deux temps, pour ne pas comparer toutes les paires de textes :
 *   1. index inversé des n-grammes de SEUIL_RECOPIE mots vers les fiches qui les
 *      portent. Deux fiches qui ne partagent aucun n-gramme ne peuvent pas partager
 *      de passage plus long : elles ne sont jamais comparées ;
 *   2. pour les seules paires candidates, plus long passage commun exact, en mots.
 *
 * Le résultat est rendu en GROUPES : toutes les fiches partageant le même passage
 * sont réunies, avec le passage cité. Un score seul ne dirait pas quoi corriger ;
 * le passage, si.
 *
 * Faux positifs connus, et traitement :
 *   - deux gaps adossés à la MÊME fiche IA (ou à la même fiche humaine) décrivent
 *     le même mécanisme : la répétition est attendue. Ces groupes sont rangés à
 *     part (« intra-famille ») et notés « signal », pas « défaut » ;
 *   - une formule figée du domaine (« les lois de la physique et la vitesse de la
 *     lumière sont invariantes ») n'est pas une recopie fautive. Le seuil en mots
 *     est l'unique garde-fou, et il est réglable (--seuil=) pour que le lecteur
 *     puisse voir l'effet du curseur avant de conclure.
 */

const CHAMPS_RECOPIE = {
  humaine: ["these_centrale", "apport", "limites_critiques", "resonance_ia"],
  ia: ["limites_connues"],
  gap: [
    "apport_ia",
    "mecanisme",
    "amelioration_possible",
    "mode_interaction",
    "scenario_present",
    "scenario_5ans",
    "scenario_15_20ans",
  ],
};

function grouperRecopies(fiches, champ, memeFamille) {
  const tokens = new Map();
  for (const f of fiches) {
    const m = mots(f[champ]);
    if (m.length >= SEUIL_RECOPIE) tokens.set(f.id, m);
  }
  const index = new Map();
  for (const [id, m] of tokens) {
    for (const g of ngrammes(m, SEUIL_RECOPIE)) {
      if (!index.has(g)) index.set(g, new Set());
      index.get(g).add(id);
    }
  }
  const paires = new Map();
  for (const ids of index.values()) {
    if (ids.size < 2) continue;
    const l = [...ids].sort();
    for (let i = 0; i < l.length; i++) {
      for (let j = i + 1; j < l.length; j++) paires.set(`${l[i]} ${l[j]}`, [l[i], l[j]]);
    }
  }
  const resultats = [];
  for (const [a, b] of paires.values()) {
    const { longueur, passage } = plusLongPassageCommun(tokens.get(a), tokens.get(b));
    if (longueur >= SEUIL_RECOPIE) {
      resultats.push({ a, b, longueur, passage, famille: memeFamille ? memeFamille(a, b) : false });
    }
  }
  // Regroupement par passage : plusieurs paires partageant le même passage forment
  // un seul groupe, ce qui est la forme exploitable pour une vague de correction.
  const parPassage = new Map();
  for (const r of resultats) {
    if (!parPassage.has(r.passage)) {
      parPassage.set(r.passage, { passage: r.passage, longueur: r.longueur, fiches: new Set(), famille: true });
    }
    const g = parPassage.get(r.passage);
    g.fiches.add(r.a);
    g.fiches.add(r.b);
    if (!r.famille) g.famille = false;
  }
  return [...parPassage.values()]
    .map((g) => ({ ...g, fiches: [...g.fiches].sort() }))
    .sort((x, y) => y.longueur - x.longueur || y.fiches.length - x.fiches.length);
}

function auditB() {
  const groupesDefaut = [];
  const groupesFamille = [];

  for (const champ of CHAMPS_RECOPIE.humaine) {
    for (const g of grouperRecopies(HUMAINES, champ, () => false)) {
      groupesDefaut.push({ referentiel: "humaine", champ, ...g });
    }
  }
  for (const champ of CHAMPS_RECOPIE.ia) {
    for (const g of grouperRecopies(IA, champ, () => false)) {
      groupesDefaut.push({ referentiel: "ia", champ, ...g });
    }
  }
  // Deux gaps de la même « famille » (même fiche IA ou même fiche humaine de
  // rattachement) ont une raison légitime de se ressembler.
  const memeFamille = (a, b) => {
    const ga = parIdGap.get(a);
    const gb = parIdGap.get(b);
    if (!ga || !gb) return false;
    return ga.fiche_ia_id === gb.fiche_ia_id || ga.fiche_humaine_id === gb.fiche_humaine_id;
  };
  for (const champ of CHAMPS_RECOPIE.gap) {
    for (const g of grouperRecopies(GAPS, champ, memeFamille)) {
      (g.famille ? groupesFamille : groupesDefaut).push({ referentiel: "gap", champ, ...g });
    }
  }

  groupesDefaut.sort((a, b) => b.longueur - a.longueur);
  groupesFamille.sort((a, b) => b.longueur - a.longueur);

  constat(
    "B",
    "B1-passage-recopie-entre-fiches-sans-lien",
    "serieux",
    `Passage de ${SEUIL_RECOPIE} mots ou plus identique dans plusieurs fiches sans rattachement commun`,
    groupesDefaut.flatMap((g) => g.fiches),
    groupesDefaut.map(
      (g) => `${g.referentiel}.${g.champ} · ${g.longueur} mots · ${g.fiches.join(", ")}\n      « ${g.passage} »`
    ),
    { total: groupesDefaut.length }
  );

  constat(
    "B",
    "B2-passage-recopie-intra-famille",
    "signal",
    `Passage de ${SEUIL_RECOPIE} mots ou plus partagé par des gaps adossés à la même fiche — répétition attendue, mais mesure le degré de gabarit`,
    [],
    groupesFamille.map(
      (g) =>
        `${g.champ} · ${g.longueur} mots · ${g.fiches.length} fiches · ${g.fiches.slice(0, 6).join(", ")}${
          g.fiches.length > 6 ? "…" : ""
        }\n      « ${g.passage} »`
    ),
    { total: groupesFamille.length, transversal: true }
  );

  // B3 — recopie depuis la fiche parente vers le gap.
  // Seuil relevé : un gap reprend légitimement le vocabulaire de ses deux fiches,
  // seule une reprise longue et littérale trahit un copier-coller.
  const SEUIL_PARENT = Math.max(SEUIL_RECOPIE + 2, 12);
  const versParent = [];
  for (const g of GAPS) {
    const parents = [];
    const fi = parIdIA.get(g.fiche_ia_id);
    const fh = parIdH.get(g.fiche_humaine_id);
    if (fi) parents.push(["fiche IA", mots([...(fi.capacites_cles ?? []), fi.limites_connues ?? ""].join(" . "))]);
    if (fh) {
      parents.push([
        "fiche humaine",
        mots([fh.these_centrale, fh.apport, fh.limites_critiques, fh.resonance_ia].filter(Boolean).join(" . ")),
      ]);
    }
    for (const champ of CHAMPS_RECOPIE.gap) {
      const m = mots(g[champ]);
      if (m.length < SEUIL_PARENT) continue;
      for (const [quoi, tokensParent] of parents) {
        const { longueur, passage } = plusLongPassageCommun(m, tokensParent);
        if (longueur >= SEUIL_PARENT) {
          versParent.push(`${g.id} · ${champ} · ${longueur} mots repris de la ${quoi}\n      « ${passage} »`);
        }
      }
    }
  }
  constat(
    "B",
    "B3-gap-recopie-sa-fiche-parente",
    "serieux",
    `Champ de gap reprenant mot pour mot ${SEUIL_PARENT} mots ou plus d'une de ses deux fiches de rattachement`,
    versParent.map((l) => l.split(" · ")[0]),
    versParent,
    { total: versParent.length }
  );
}

// ===========================================================================
// SECTION C — Formules creuses et non attribuées
// ===========================================================================

/*
 * L'audit de fond a relevé six occurrences de « jugé par certains » sur quinze
 * fiches philosophiques et y a vu un problème de fond : une critique non attribuée
 * n'est pas vérifiable, et rien ne distingue une critique réelle d'une
 * généralisation plausible mais inventée.
 *
 * On cherche donc les tournures qui attribuent une opinion à un collectif anonyme.
 * Le piège est le faux positif : « certains travaux montrent que », suivi d'un nom
 * d'auteur, n'est pas fautif. On ne peut pas trancher mécaniquement, alors on
 * sépare deux niveaux :
 *   - défaut : la formule apparaît et AUCUN nom propre composé (deux mots
 *     capitalisés consécutifs, hors début de phrase) ne figure dans les 160
 *     caractères qui suivent ;
 *   - signal : la même formule, mais un nom propre suit de près — la critique est
 *     peut-être attribuée juste après, il faut l'œil d'un relecteur.
 */

const FORMULES = [
  [
    "jugé / accusé / critiqué par certains",
    /\b(juge|jugee|jugees|juges|accuse|accusee|accusees|accuses|critique|critiquee|critiquees|critiques|percu|percue|percus|percues|considere|consideree|consideres|considerees|reproche|reprochee|taxe|taxee|qualifie|qualifiee)\s+(par\s+)?(certains|certaines|beaucoup|de nombreux|de nombreuses|plusieurs|d'aucuns|une partie)/g,
  ],
  [
    "des critiques / observateurs estiment",
    /\b(des|certains|certaines|plusieurs|de nombreux|de nombreuses|quelques)\s+(critiques|observateurs|commentateurs|chercheurs|specialistes|experts|auteurs|analystes|economistes|theoriciens|historiens|sociologues|philosophes|juristes|praticiens)\s+(estiment|jugent|considerent|reprochent|soulignent|denoncent|contestent|pointent|y voient|objectent|accusent|relevent|craignent|doutent)/g,
  ],
  [
    "certains / beaucoup estiment (sujet nu)",
    /\b(certains|certaines|beaucoup|d'aucuns|plusieurs)\s+(estiment|jugent|considerent|reprochent|denoncent|contestent|y voient|soulignent|objectent|accusent|craignent|parlent de)/g,
  ],
  [
    "il est reproché / on lui reproche",
    /\b(il (lui )?est (souvent |parfois |frequemment |regulierement )?(reproche|objecte|conteste)|il lui est fait grief|on (lui )?(reproche|objecte|conteste|critique))/g,
  ],
  [
    "souvent / parfois qualifié, sans auteur",
    /\b(souvent|parfois|frequemment|regulierement|volontiers)\s+(qualifie|qualifiee|decrit|decrite|presente|presentee|juge|jugee|accuse|accusee|critique|critiquee|taxe|taxee)\b/g,
  ],
  [
    "l'opinion dominante / il est admis",
    /\b(l'opinion (dominante|commune)|le sens commun veut|on considere (souvent|generalement)|il est (generalement |communement )?admis)\b/g,
  ],
];

const CHAMPS_TEXTE = {
  humaine: ["these_centrale", "apport", "limites_critiques", "resonance_ia"],
  ia: ["limites_connues"],
  gap: CHAMPS_RECOPIE.gap,
};

/**
 * Cherche un nom propre candidat dans les 160 caractères qui suivent la formule.
 * Un mot capitalisé qui n'ouvre pas une phrase et qui n'est pas un sigle tout en
 * majuscules : c'est le meilleur indice mécanique qu'une critique est attribuée.
 *
 * L'indice est volontairement large, donc imparfait dans les deux sens :
 *   - « Accusé par certains courants analytiques (dont Searle…) » est bien attribué,
 *     et un test exigeant prénom + nom l'aurait manqué ;
 *   - « jugée par certains trop totalisante ; sa Dialectique de la raison… » ne l'est
 *     pas, mais porte un titre d'œuvre capitalisé.
 * D'où la restitution en deux niveaux : sans aucune majuscule interne, la formule
 * est presque sûrement en l'air (défaut) ; avec, elle demande une relecture (signal).
 */
function attributionProche(texteBrut, index) {
  const fenetre = texteBrut.slice(index, index + 160);
  if (!fenetre) return false;
  const candidats = fenetre.match(/(^|[^.!?…]\s)([A-ZÀ-Þ][a-zà-ÿ]{2,})/g) ?? [];
  return candidats.length > 0;
}

function auditC() {
  const defauts = [];
  const signaux = [];
  const parLibelle = new Map();

  function scanner(fiches, champs, referentiel) {
    for (const f of fiches) {
      for (const champ of champs) {
        const brut = String(f[champ] ?? "");
        const norme = normaliserAligne(brut);
        if (!norme.trim()) continue;
        for (const [libelle, regex] of FORMULES) {
          const re = new RegExp(regex.source, "g");
          let m;
          while ((m = re.exec(norme)) !== null) {
            // `normaliserAligne` conserve les positions : l'index de la
            // correspondance vaut aussi bien dans le texte d'origine.
            const attribue = attributionProche(brut, m.index + m[0].length);
            const ligne = `${f.id} · ${referentiel}.${champ} · « …${m[0]}… »`;
            if (attribue) signaux.push(ligne);
            else defauts.push(ligne);
            parLibelle.set(libelle, (parLibelle.get(libelle) ?? 0) + 1);
          }
        }
      }
    }
  }
  scanner(HUMAINES, CHAMPS_TEXTE.humaine, "humaine");
  scanner(IA, CHAMPS_TEXTE.ia, "ia");
  scanner(GAPS, CHAMPS_TEXTE.gap, "gap");

  constat(
    "C",
    "C1-formule-creuse-non-attribuee",
    "serieux",
    "Opinion attribuée à un collectif anonyme, sans le moindre nom propre dans les 160 caractères qui suivent",
    defauts.map((l) => l.split(" · ")[0]),
    defauts,
    { total: defauts.length, par_formule: Object.fromEntries(parLibelle) }
  );
  constat(
    "C",
    "C2-formule-creuse-mais-nom-propre-proche",
    "signal",
    "Même tournure, mais un mot capitalisé figure dans les 160 caractères suivants — l'attribution est peut-être faite (ou c'est un titre d'œuvre) : à relire",
    [],
    signaux,
    { total: signaux.length, transversal: true }
  );
}

// ===========================================================================
// SECTION D — Cohérence interne des fiches IA
// ===========================================================================

function auditD() {
  const secteursDoubles = [];
  const usagesSansExemple = [];
  const usagesSansSource = [];
  const trlAcademique = [];
  const trlHorsBornes = [];
  let totalUsages = 0;

  for (const f of IA) {
    const vus = new Map();
    for (const u of f.usages ?? []) {
      totalUsages++;
      if (vus.has(u.secteur)) {
        secteursDoubles.push(
          `${f.id} · secteur « ${u.secteur} » en double · TRL ${vus.get(u.secteur)} puis ${u.trl}`
        );
      }
      vus.set(u.secteur, u.trl);
      if (!(u.exemples ?? []).length) usagesSansExemple.push(`${f.id} · usages[${u.secteur}] · aucun exemple`);
      if (!(u.sources ?? []).length) usagesSansSource.push(`${f.id} · usages[${u.secteur}] · aucune source`);
      if (typeof u.trl === "number" && (u.trl < 1 || u.trl > 9)) {
        trlHorsBornes.push(`${f.id} · usages[${u.secteur}] · TRL ${u.trl}`);
      }
      if (["recherche", "science"].includes(u.secteur) && typeof u.trl === "number") {
        trlAcademique.push(`${f.id} · secteur « ${u.secteur} » · TRL ${u.trl} · ${extrait(u.description, 80)}`);
      }
    }
  }

  constat(
    "D",
    "D1-secteur-duplique",
    "bloquant",
    "Deux entrées « usages » sur le même secteur dans une même fiche IA — l'indexeur RAG ignore la seconde",
    secteursDoubles.map((l) => l.split(" · ")[0]),
    secteursDoubles,
    { total: secteursDoubles.length }
  );
  constat(
    "D",
    "D2-usage-sans-exemple",
    "serieux",
    "Usage sectoriel sans aucun exemple",
    usagesSansExemple.map((l) => l.split(" · ")[0]),
    usagesSansExemple,
    { total: usagesSansExemple.length, sur: totalUsages }
  );
  constat(
    "D",
    "D3-usage-sans-source",
    "serieux",
    "Usage sectoriel sans aucune source",
    usagesSansSource.map((l) => l.split(" · ")[0]),
    usagesSansSource,
    { total: usagesSansSource.length, sur: totalUsages }
  );
  constat(
    "D",
    "D4-trl-hors-bornes",
    "bloquant",
    "TRL hors de l'échelle 1-9",
    trlHorsBornes.map((l) => l.split(" · ")[0]),
    trlHorsBornes,
    { total: trlHorsBornes.length }
  );
  constat(
    "D",
    "D5-trl-sur-secteur-academique",
    "serieux",
    "TRL attribué à un secteur « recherche » ou « science » — l'échelle mesure la maturité d'un déploiement, pas l'adoption académique",
    trlAcademique.map((l) => l.split(" · ")[0]),
    trlAcademique,
    { total: trlAcademique.length, sur: totalUsages }
  );
}

// ===========================================================================
// SECTION E — Cohérence des fiches de gap
// ===========================================================================

function auditE() {
  // Un usage IA justifie une confiance « elevee » s'il porte soit un TRL ≥ 7,
  // soit — depuis que le TRL est devenu facultatif (lib/types.ts, `Diffusion`) —
  // une diffusion « etabli » ou « standard ». Le TRL n'a de référent que pour un
  // système dont on peut nommer l'exploitant, le lieu et la date ; une méthode
  // mûre (régression linéaire, forêts aléatoires, ACP…) n'en porte plus et
  // s'exprime désormais par `diffusion` : l'absence de TRL n'est donc plus, en
  // elle-même, un signe d'immaturité.
  //
  // Deux lectures de cette maturité, comme avant le changement de schéma :
  //   - qualifiantMax : au moins un usage qualifiant, tous secteurs confondus ;
  //   - qualifiantDeploiement : au moins un usage qualifiant hors « recherche »
  //     et « science » (cf. D5 — le TRL n'y mesure pas l'adoption académique ;
  //     la diffusion, elle, n'a pas cette réserve et compte dans les deux cas).
  const estQualifiant = (u) =>
    (typeof u.trl === "number" && u.trl >= 7) || u.diffusion === "etabli" || u.diffusion === "standard";
  const qualifiantMax = new Map();
  const qualifiantDeploiement = new Map();
  for (const f of IA) {
    const us = f.usages ?? [];
    qualifiantMax.set(f.id, us.some(estQualifiant));
    const dep = us.filter((u) => !["recherche", "science"].includes(u.secteur));
    qualifiantDeploiement.set(f.id, dep.some(estQualifiant));
  }

  const confianceExcessive = [];
  const confianceExcessiveDeploiement = [];
  const techHorsCas = [];
  const axesAnormaux = [];
  const confianceUniforme = [];
  const docsEtrangersSansUrl = [];
  const docsEtrangersAvecUrl = [];

  for (const g of GAPS) {
    const qm = qualifiantMax.get(g.fiche_ia_id) ?? false;
    const qd = qualifiantDeploiement.get(g.fiche_ia_id) ?? false;
    if (g.confiance === "elevee" && !qm) {
      confianceExcessive.push(
        `${g.id} · confiance « elevee » · aucun usage de ${g.fiche_ia_id} n'atteint TRL 7 ni diffusion etabli/standard`
      );
    } else if (g.confiance === "elevee" && qm && !qd) {
      confianceExcessiveDeploiement.push(
        `${g.id} · confiance « elevee » · ${g.fiche_ia_id} n'est qualifiant que sur recherche/science, aucun usage de déploiement ne l'est`
      );
    }
    if (g.technologie_complementaire && g.substituabilite !== "remplacable_avec_autre_technologie") {
      techHorsCas.push(
        `${g.id} · technologie_complementaire renseignée alors que substituabilite = ${g.substituabilite}`
      );
    }
    if (g.substituabilite === "remplacable_avec_autre_technologie" && !g.technologie_complementaire) {
      techHorsCas.push(`${g.id} · substituabilite = remplacable_avec_autre_technologie sans technologie_complementaire`);
    }
    const n = (g.axes_prospectifs ?? []).length;
    if (n !== 3) axesAnormaux.push(`${g.id} · ${n} axe(s) prospectif(s) au lieu de 3`);
    if (n === 3) {
      const niveaux = new Set(g.axes_prospectifs.map((a) => a.niveau_confiance));
      if (niveaux.size === 1) {
        confianceUniforme.push(`${g.id} · les 3 axes prospectifs portent tous « ${[...niveaux][0]} »`);
      }
    }

    // documents_cles : provient-il de l'une des deux fiches liées ?
    const fh = parIdH.get(g.fiche_humaine_id);
    const fi = parIdIA.get(g.fiche_ia_id);
    const pool = new Set();
    const ajouter = (liste) => {
      for (const s of liste ?? []) {
        pool.add(normaliser(s.titre));
        if (s.url) pool.add(s.url.trim().toLowerCase());
      }
    };
    ajouter(fh?.sources);
    ajouter(fi?.sources);
    for (const u of fi?.usages ?? []) ajouter(u.sources);
    for (const s of g.documents_cles ?? []) {
      const connu = pool.has(normaliser(s.titre)) || (s.url && pool.has(s.url.trim().toLowerCase()));
      if (connu) continue;
      const ligne = `${g.id} · absent de ${g.fiche_humaine_id} et de ${g.fiche_ia_id} · ${extrait(s.titre, 130)}`;
      if (s.url) docsEtrangersAvecUrl.push(`${ligne}\n      ${s.url}`);
      else docsEtrangersSansUrl.push(ligne);
    }
  }

  constat(
    "E",
    "E1-confiance-elevee-sur-trl-faible",
    "bloquant",
    "Gap en confiance « elevee » alors qu'aucun usage de la fiche IA mobilisée n'atteint TRL 7 ni diffusion « etabli »/« standard » — règle explicite du projet",
    confianceExcessive.map((l) => l.split(" · ")[0]),
    confianceExcessive,
    { total: confianceExcessive.length }
  );
  constat(
    "E",
    "E1bis-confiance-elevee-sur-trl-de-deploiement-faible",
    "serieux",
    "Gap en confiance « elevee » dont la fiche IA n'est qualifiante (TRL ≥ 7 ou diffusion etabli/standard) que sur un secteur « recherche » ou « science » — aucun usage de déploiement ne l'est",
    confianceExcessiveDeploiement.map((l) => l.split(" · ")[0]),
    confianceExcessiveDeploiement,
    { total: confianceExcessiveDeploiement.length }
  );
  constat(
    "E",
    "E2-technologie-complementaire-hors-cas",
    "bloquant",
    "Champ technologie_complementaire incohérent avec substituabilite",
    techHorsCas.map((l) => l.split(" · ")[0]),
    techHorsCas,
    { total: techHorsCas.length }
  );
  constat(
    "E",
    "E3-axes-prospectifs-nombre",
    "serieux",
    "Nombre d'axes prospectifs différent de 3",
    axesAnormaux.map((l) => l.split(" · ")[0]),
    axesAnormaux,
    { total: axesAnormaux.length }
  );
  constat(
    "E",
    "E4-documents-cles-etrangers-sans-url",
    "serieux",
    "documents_cles ne provenant d'aucune des deux fiches liées ET dépourvu d'URL — la référence est introuvable depuis le corpus",
    docsEtrangersSansUrl.map((l) => l.split(" · ")[0]),
    docsEtrangersSansUrl,
    { total: docsEtrangersSansUrl.length }
  );
  constat(
    "E",
    "E4bis-documents-cles-etrangers-avec-url",
    "signal",
    "documents_cles absent des deux fiches liées mais muni d'une URL — le plus souvent un enrichissement légitime, pas un défaut",
    [],
    docsEtrangersAvecUrl,
    { total: docsEtrangersAvecUrl.length, transversal: true }
  );
  constat(
    "E",
    "E5-axes-prospectifs-confiance-uniforme",
    "mineur",
    "Les trois axes prospectifs portent le même niveau de confiance — le dispositif perd sa fonction de discrimination",
    confianceUniforme.map((l) => l.split(" · ")[0]),
    confianceUniforme,
    { total: confianceUniforme.length }
  );
}

// ===========================================================================
// SECTION F — Chronologie et longueurs anormales
// ===========================================================================

function mediane(nombres) {
  if (!nombres.length) return 0;
  const t = [...nombres].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
}

function auditF() {
  // F1 — hétérogénéité des dates de vérification au sein d'un lot de rédaction
  const heterogenes = [];
  for (const [lot, fiches] of LOTS) {
    const compte = new Map();
    for (const f of fiches) compte.set(f.derniere_verification, (compte.get(f.derniere_verification) ?? 0) + 1);
    if (compte.size <= 1) continue;
    const [dateDominante, nDominante] = [...compte.entries()].sort((a, b) => b[1] - a[1])[0];
    const minoritaires = fiches.filter((f) => f.derniere_verification !== dateDominante);
    heterogenes.push({
      lot,
      dominante: dateDominante,
      part: Math.round((nDominante / fiches.length) * 100),
      minoritaires: minoritaires.map((f) => `${f.id} (${f.derniere_verification})`),
    });
  }
  constat(
    "F",
    "F1-dates-heterogenes-dans-un-lot",
    "mineur",
    "Dates de vérification hétérogènes au sein d'un même fichier de rédaction — une reprise partielle non tracée par le changelog",
    heterogenes.flatMap((h) => h.minoritaires.map((m) => m.split(" ")[0])),
    heterogenes.map(
      (h) =>
        `${h.lot} · dominante ${h.dominante} (${h.part} %) · ${h.minoritaires.length} fiche(s) à une autre date : ${h.minoritaires
          .slice(0, 12)
          .join(", ")}${h.minoritaires.length > 12 ? "…" : ""}`
    ),
    { total: heterogenes.reduce((n, h) => n + h.minoritaires.length, 0) }
  );

  // F2 — gap vérifié avant l'une de ses fiches de rattachement
  const antidates = [];
  for (const g of GAPS) {
    for (const [quoi, p] of [
      ["humaine", parIdH.get(g.fiche_humaine_id)],
      ["IA", parIdIA.get(g.fiche_ia_id)],
    ]) {
      if (p && g.derniere_verification < p.derniere_verification) {
        antidates.push(
          `${g.id} · vérifié le ${g.derniere_verification}, antérieur à sa fiche ${quoi} ${p.id} (${p.derniere_verification})`
        );
      }
    }
  }
  constat(
    "F",
    "F2-gap-anterieur-a-sa-fiche-parente",
    "serieux",
    "Gap dont la date de vérification précède celle d'une de ses fiches de rattachement — le gap n'a pas pu tenir compte de la version révisée",
    antidates.map((l) => l.split(" · ")[0]),
    antidates,
    { total: antidates.length }
  );

  // F3 — champs anormalement courts par rapport à la médiane de leur axe.
  // La médiane, et non la moyenne : elle n'est pas tirée par les quelques champs
  // très longs, et le référentiel n'impose pas une longueur mais une densité.
  const courts = [];
  const distributions = {};
  const groupes = new Map();
  for (const f of HUMAINES) {
    const k = `humaine/${f.axe}`;
    if (!groupes.has(k)) groupes.set(k, { champs: CHAMPS_TEXTE.humaine, fiches: [] });
    groupes.get(k).fiches.push(f);
  }
  groupes.set("ia", { champs: CHAMPS_TEXTE.ia, fiches: IA });
  groupes.set("gap", { champs: CHAMPS_TEXTE.gap, fiches: GAPS });

  for (const [k, { champs, fiches }] of groupes) {
    distributions[k] = {};
    for (const champ of champs) {
      const longueurs = fiches.map((f) => String(f[champ] ?? "").length);
      const med = mediane(longueurs.filter((n) => n > 0));
      const seuil = Math.round(med * SEUIL_COURT);
      distributions[k][champ] = { n: fiches.length, mediane: med, seuil };
      for (const f of fiches) {
        const l = String(f[champ] ?? "").length;
        if (l === 0) {
          courts.push(`${f.id} · ${k} · ${champ} · champ ABSENT ou vide (médiane du groupe ${med})`);
        } else if (l < seuil) {
          courts.push(
            `${f.id} · ${k} · ${champ} · ${l} car. contre ${med} de médiane (${Math.round((l / med) * 100)} %)`
          );
        }
      }
    }
  }
  constat(
    "F",
    "F3-champ-anormalement-court",
    "serieux",
    `Champ dont la longueur est inférieure à ${Math.round(SEUIL_COURT * 100)} % de la médiane de son groupe — signal de traitement bâclé`,
    courts.map((l) => l.split(" · ")[0]),
    courts,
    { total: courts.length }
  );

  return distributions;
}

// ===========================================================================
// SECTION G — Statistiques de couverture
// ===========================================================================

function auditG(distributions) {
  const utiliseesH = new Set(GAPS.map((g) => g.fiche_humaine_id));
  const utiliseesIA = new Set(GAPS.map((g) => g.fiche_ia_id));
  const orphelinesH = HUMAINES.filter((f) => !utiliseesH.has(f.id));
  const orphelinesIA = IA.filter((f) => !utiliseesIA.has(f.id));

  const parAxe = {};
  for (const f of HUMAINES) {
    parAxe[f.axe] ??= { total: 0, sans_url: 0, mobilisees: 0, sources: 0, sources_avec_url: 0 };
    const a = parAxe[f.axe];
    a.total++;
    if (!(f.sources ?? []).some((s) => s.url)) a.sans_url++;
    if (utiliseesH.has(f.id)) a.mobilisees++;
    a.sources += (f.sources ?? []).length;
    a.sources_avec_url += (f.sources ?? []).filter((s) => s.url).length;
  }

  const avecUrl = SOURCES.filter((s) => s.url).length;
  const avecDate = SOURCES.filter((s) => s.date).length;
  const stats = {
    fiches: {
      humaines: HUMAINES.length,
      ia: IA.length,
      gap: GAPS.length,
      questions: QUESTIONS.length,
      total: HUMAINES.length + IA.length + GAPS.length,
    },
    sources: {
      entrees: SOURCES.length,
      primaires: SOURCES.filter((s) => s.type === "primaire").length,
      secondaires: SOURCES.filter((s) => s.type === "secondaire").length,
      avec_url: avecUrl,
      part_avec_url: Math.round((avecUrl / SOURCES.length) * 100),
      avec_date: avecDate,
      part_avec_date: Math.round((avecDate / SOURCES.length) * 1000) / 10,
      url_distinctes: new Set(SOURCES.filter((s) => s.url).map((s) => s.url.trim().toLowerCase())).size,
    },
    fiches_sans_aucune_url: {
      humaines: HUMAINES.filter((f) => !(f.sources ?? []).some((s) => s.url)).length,
      ia: IA.filter(
        (f) => !(f.sources ?? []).some((s) => s.url) && !(f.usages ?? []).some((u) => (u.sources ?? []).some((s) => s.url))
      ).length,
      gap: GAPS.filter((g) => !(g.documents_cles ?? []).some((s) => s.url)).length,
    },
    mobilisation: {
      humaines_jamais_mobilisees: orphelinesH.length,
      part_humaines_jamais_mobilisees: Math.round((orphelinesH.length / HUMAINES.length) * 100),
      liste_humaines_jamais_mobilisees: orphelinesH.map((f) => f.id),
      ia_jamais_mobilisees: orphelinesIA.length,
      liste_ia_jamais_mobilisees: orphelinesIA.map((f) => f.id),
      couples_distincts: new Set(GAPS.map((g) => `${g.fiche_humaine_id}|${g.fiche_ia_id}`)).size,
    },
    par_axe_humain: parAxe,
    longueurs: distributions,
  };

  constat("G", "G1-statistiques", "mineur", "Statistiques de couverture", [], [], { stats, transversal: true });
  return stats;
}

// ===========================================================================
// Exécution
// ===========================================================================

auditA();
auditB();
auditC();
const distributions = auditF();
auditD();
auditE();
const stats = auditG(distributions);

// ---------------------------------------------------------------------------
// Agrégation : la liste de reprise
// ---------------------------------------------------------------------------

// Le score n'est qu'un ordre de passage : un bloquant l'emporte toujours sur
// n'importe quel nombre de sérieux, et un sérieux sur n'importe quel nombre de
// mineurs. C'est ce qui rend la liste utilisable comme plan de travail.
const POIDS = { bloquant: 10000, serieux: 100, mineur: 1 };
const reprise = new Map();
for (const c of constats) {
  if (c.gravite === "signal") continue;
  for (const id of c.cibles) {
    if (!reprise.has(id)) reprise.set(id, { id, bloquant: 0, serieux: 0, mineur: 0, codes: new Set(), score: 0 });
    const r = reprise.get(id);
    r[c.gravite]++;
    r.codes.add(c.code);
    r.score += POIDS[c.gravite];
  }
}
function referentielDe(id) {
  if (parIdH.has(id)) return "humaine";
  if (parIdIA.has(id)) return "ia";
  if (parIdGap.has(id)) return "gap";
  return "inconnu";
}
const listeReprise = [...reprise.values()]
  .map((r) => ({ ...r, codes: [...r.codes].sort(), referentiel: referentielDe(r.id) }))
  .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

const gravitesGlobales = {
  bloquant: listeReprise.filter((r) => r.bloquant > 0).length,
  serieux: listeReprise.filter((r) => r.bloquant === 0 && r.serieux > 0).length,
  mineur: listeReprise.filter((r) => r.bloquant === 0 && r.serieux === 0 && r.mineur > 0).length,
};
const compte = (g) => constats.filter((c) => c.gravite === g && (c.total ?? c.detail.length) > 0).length;

// ---------------------------------------------------------------------------
// Sorties
// ---------------------------------------------------------------------------

if (SORTIE_JSON) {
  const sortie = {
    genere_le: new Date().toISOString().slice(0, 10),
    parametres: { seuil_recopie_mots: SEUIL_RECOPIE, seuil_champ_court: SEUIL_COURT },
    statistiques: stats,
    constats: constats.map((c) => ({
      section: c.section,
      code: c.code,
      gravite: c.gravite,
      titre: c.titre,
      total: c.total ?? c.detail.length,
      sur: c.sur ?? null,
      transversal: c.transversal ?? false,
      fiches: c.cibles,
      detail: c.detail,
      ...(c.par_formule ? { par_formule: c.par_formule } : {}),
      ...(c.taux_faux_positifs !== undefined ? { taux_faux_positifs: c.taux_faux_positifs } : {}),
    })),
    liste_reprise: listeReprise,
    resume_gravite: gravitesGlobales,
  };
  // `process.exitCode` et non `process.exit()` : sur un tuyau, stdout est écrit de
  // façon asynchrone et un exit immédiat tronquerait le JSON en plein milieu.
  process.stdout.write(`${JSON.stringify(sortie, null, 2)}\n`);
  process.exitCode = gravitesGlobales.bloquant > 0 ? 1 : 0;
}

else {
const TITRES_SECTION = {
  A: "TRAÇABILITÉ DES SOURCES",
  B: "RECOPIE DE PASSAGES ENTRE FICHES",
  C: "FORMULES CREUSES ET NON ATTRIBUÉES",
  D: "COHÉRENCE INTERNE DES FICHES IA",
  E: "COHÉRENCE DES FICHES DE GAP",
  F: "CHRONOLOGIE ET LONGUEURS ANORMALES",
  G: "STATISTIQUES DE COUVERTURE",
};
const ETIQUETTE = { bloquant: "BLOQUANT", serieux: "SÉRIEUX ", mineur: "MINEUR  ", signal: "SIGNAL  " };

console.log("AUDIT MÉCANIQUE DU CORPUS ATLAS — data/seed/");
console.log(`Racine : ${RACINE}`);
console.log(
  `Paramètres : recopie ≥ ${SEUIL_RECOPIE} mots, champ court < ${Math.round(SEUIL_COURT * 100)} % de la médiane de son groupe`
);
console.log(
  `Corpus : ${stats.fiches.total} fiches (${stats.fiches.humaines} humaines, ${stats.fiches.ia} IA, ${stats.fiches.gap} gaps) — ${stats.sources.entrees} entrées de source`
);

for (const lettre of "ABCDEF") {
  if (SECTION && SECTION !== lettre) continue;
  const cs = constats.filter((c) => c.section === lettre);
  if (!cs.length) continue;
  console.log(`\n${"=".repeat(76)}\n${lettre} — ${TITRES_SECTION[lettre]}\n${"=".repeat(76)}`);
  for (const c of cs) {
    const n = c.total ?? c.detail.length;
    console.log(`\n[${ETIQUETTE[c.gravite]}] ${c.code} — ${n} occurrence(s)${c.sur ? ` sur ${c.sur}` : ""}`);
    console.log(`  ${c.titre}`);
    if (c.taux_faux_positifs !== undefined) {
      console.log(
        `  Taux de faux positifs mesuré : ${c.taux_faux_positifs} % (${c.faux_positifs_mesures} détections portent pourtant une URL).`
      );
    }
    if (c.par_formule) {
      console.log(
        `  Répartition : ${Object.entries(c.par_formule)
          .map(([k, v]) => `${k} ×${v}`)
          .join(" · ")}`
      );
    }
    const lignes = c.detail.slice(0, MAX_LIGNES);
    for (const l of lignes) console.log(`    - ${l}`);
    if (c.detail.length > lignes.length) {
      console.log(`    … et ${c.detail.length - lignes.length} de plus (--max=${c.detail.length} pour tout voir)`);
    }
  }
}

if (!SECTION || SECTION === "G") {
  console.log(`\n${"=".repeat(76)}\nG — STATISTIQUES DE COUVERTURE\n${"=".repeat(76)}`);
  console.log(`  Entrées de source : ${stats.sources.entrees} (${stats.sources.url_distinctes} URL distinctes)`);
  console.log(
    `  Part avec URL     : ${stats.sources.part_avec_url} %   (primaires ${stats.sources.primaires}, secondaires ${stats.sources.secondaires})`
  );
  console.log(`  Part datée        : ${stats.sources.part_avec_date} % (${stats.sources.avec_date} entrées)`);
  console.log(
    `  Fiches sans aucune URL : ${stats.fiches_sans_aucune_url.humaines} humaines, ${stats.fiches_sans_aucune_url.ia} IA, ${stats.fiches_sans_aucune_url.gap} gaps`
  );
  console.log(
    `  Fiches humaines jamais mobilisées dans un gap : ${stats.mobilisation.humaines_jamais_mobilisees} (${stats.mobilisation.part_humaines_jamais_mobilisees} %)`
  );
  console.log(
    `  Fiches IA jamais mobilisées : ${stats.mobilisation.ia_jamais_mobilisees} — ${stats.mobilisation.liste_ia_jamais_mobilisees.join(", ") || "aucune"}`
  );
  console.log(`  Couples humaine × IA distincts : ${stats.mobilisation.couples_distincts} pour ${stats.fiches.gap} gaps`);
  console.log("\n  Longueurs médianes (caractères) :");
  for (const [k, champs] of Object.entries(stats.longueurs)) {
    console.log(
      `    ${k.padEnd(22)} ${Object.entries(champs)
        .map(([c, d]) => `${c} ${d.mediane}`)
        .join(" · ")}`
    );
  }
  console.log("\n  Couverture par axe humain :");
  for (const [axe, a] of Object.entries(stats.par_axe_humain)) {
    console.log(
      `    ${axe.padEnd(14)} ${String(a.total).padStart(3)} fiches · ${a.sources} sources dont ${a.sources_avec_url} avec URL · ${a.mobilisees} mobilisées en gap`
    );
  }
}

console.log(`\n${"=".repeat(76)}\nLISTE DE REPRISE — ${listeReprise.length} fiches portant au moins un défaut\n${"=".repeat(76)}`);
console.log(`  ${gravitesGlobales.bloquant} fiche(s) avec au moins un défaut BLOQUANT`);
console.log(`  ${gravitesGlobales.serieux} fiche(s) sans bloquant mais avec au moins un défaut SÉRIEUX`);
console.log(`  ${gravitesGlobales.mineur} fiche(s) avec seulement des défauts MINEURS`);
console.log("");
const aAfficher = listeReprise.slice(0, MAX_LIGNES * 4);
for (const r of aAfficher) {
  const g = r.bloquant ? "BLOQUANT" : r.serieux ? "SÉRIEUX" : "MINEUR";
  console.log(`  ${g.padEnd(9)} ${r.id.padEnd(52)} ${r.codes.join(", ")}`);
}
if (listeReprise.length > aAfficher.length) {
  console.log(`  … et ${listeReprise.length - aAfficher.length} de plus (--json pour la liste complète)`);
}

console.log(`\n${"=".repeat(76)}`);
console.log(
  `${compte("bloquant")} catégorie(s) de défaut bloquant, ${compte("serieux")} sérieuse(s), ${compte("mineur")} mineure(s), sur ${stats.fiches.total} fiches.`
);
console.log(
  gravitesGlobales.bloquant > 0
    ? "Il reste du travail bloquant — voir la liste de reprise."
    : "Aucun défaut bloquant."
);
console.log("=".repeat(76));

process.exitCode = gravitesGlobales.bloquant > 0 ? 1 : 0;
}

/*
 * Questionnement du jour — ce que l'actualité pose comme question au référentiel.
 *
 * Pourquoi ce script existe
 * -------------------------
 * La page « Veille » montrait la plomberie : les sources configurées et la file
 * de propositions en attente de tri. C'est utile pour auditer le projet, ça ne
 * sert à rien pour travailler. Ce qu'on attend d'une veille, c'est autre chose :
 * une question par actualité, et ce que le corpus met en tension dessus.
 *
 * Ce script fait ce passage. Pour chaque élément récent des flux, il :
 *   1. RATTACHE l'actualité aux fiches du référentiel qu'elle touche, par
 *      recouvrement de vocabulaire distinctif (pondéré par la rareté du terme
 *      dans le corpus : « intelligence » ne rattache rien, « capabilités » si) ;
 *   2. CHERCHE dans le graphe de relations une tension entre les fiches
 *      rattachées — un désaccord documenté vaut mieux qu'un rapprochement ;
 *   3. FORMULE une question, selon un gabarit choisi par la nature de la
 *      tension trouvée ;
 *   4. LISTE ce qu'il faudrait vérifier : les limites critiques que les fiches
 *      posent déjà, et qui sont précisément ce que l'actualité peut infirmer.
 *
 * Honnêteté sur ce que ça vaut
 * ----------------------------
 * La question est formulée par gabarit, pas rédigée. Le script ne comprend ni
 * l'actualité ni la fiche : il constate un recouvrement de vocabulaire, puis une
 * relation écrite dans le corpus. C'est une AMORCE éditoriale à retravailler,
 * pas un article. Le fichier produit le dit, et la page l'affiche.
 *
 * Usage
 * -----
 *   node scripts/questionnement.mjs
 *   node scripts/questionnement.mjs --jours=60 --max=30
 *   node scripts/questionnement.mjs --json
 *   node scripts/questionnement.mjs --aide
 *
 * Codes de sortie : 0 · 1 erreur.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { termes } from "../lib/embedding-lexical.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const SEED = path.join(RACINE, "data/seed");
const SORTIE = path.join(SEED, "questionnement.json");

const args = process.argv.slice(2);
const valeur = (nom, defaut) => {
  const trouve = args.find((a) => a.startsWith(`--${nom}=`));
  return trouve ? trouve.slice(nom.length + 3) : defaut;
};

if (args.includes("--aide")) {
  console.log(`questionnement.mjs — transforme les flux du jour en questions posées au référentiel.

  --jours=N   fenêtre d'actualité retenue (défaut 60)
  --max=N     nombre d'angles produits (défaut 24)
  --min=N     nombre minimum de termes distinctifs partagés (défaut 2)
  --json      résumé machine
  --aide`);
  process.exit(0);
}

const JOURS = Number(valeur("jours", "60")) || 60;
const MAX = Number(valeur("max", "24")) || 24;
const MIN_TERMES = Number(valeur("min", "3")) || 3;

/**
 * Score minimal de rattachement. Mesuré sur 266 éléments de flux : en dessous de
 * 14, on rattachait « Logement abordable » à « Jacques Ancel » (géopolitique des
 * frontières) sur deux mots croisés dans un paragraphe de limites. Mieux vaut
 * huit angles solides que vingt-quatre dont la moitié sont des faux amis.
 */
const SCORE_MINIMAL = Number(valeur("seuil", "20")) || 20;

/* -------------------------------------------------------------------------- */
/* Corpus et graphe                                                           */
/* -------------------------------------------------------------------------- */

function lireJson(chemin) {
  const brut = JSON.parse(readFileSync(chemin, "utf8"));
  return Array.isArray(brut) ? brut : (brut.fiches ?? brut);
}

const dossierHumaines = path.join(SEED, "fiches_humaines");
const humaines = readdirSync(dossierHumaines)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .flatMap((f) => lireJson(path.join(dossierHumaines, f)));
const fichesIA = lireJson(path.join(SEED, "fiches_ia.json"));
const sources = lireJson(path.join(SEED, "veille_sources.json"));
const queue = lireJson(path.join(SEED, "veille_queue.json"));
const graphe = JSON.parse(readFileSync(path.join(RACINE, "data/relations-corpus.json"), "utf8"));

const nomSource = new Map(sources.map((s) => [s.id, s.nom]));
const parIdHumaine = new Map(humaines.map((f) => [f.id, f]));
const parIdIA = new Map(fichesIA.map((f) => [f.id, f]));

/* -------------------------------------------------------------------------- */
/* Vocabulaire distinctif                                                     */
/* -------------------------------------------------------------------------- */

/** Texte d'une fiche qui sert au rattachement : ce qu'elle dit, pas ses métadonnées. */
function texteFiche(fiche, type) {
  if (type === "humaine") {
    return [fiche.nom, fiche.these_centrale, fiche.apport, fiche.limites_critiques, fiche.resonance_ia]
      .filter(Boolean)
      .join(" ");
  }
  return [fiche.nom, (fiche.capacites_cles ?? []).join(" "), (fiche.usages ?? []).join(" "), fiche.limites_connues]
    .filter(Boolean)
    .join(" ");
}

const documents = [
  ...humaines.map((f) => ({ type: "humaine", id: f.id, nom: f.nom, axe: f.axe, fiche: f })),
  ...fichesIA.map((f) => ({ type: "ia", id: f.id, nom: f.nom, axe: f.axe, fiche: f })),
].map((d) => ({
  ...d,
  termes: new Set(termes(texteFiche(d.fiche, d.type))),
  // Le « cœur » : le nom et la thèse. Un rattachement qui ne touche que les
  // limites ou la résonance IA d'une fiche est presque toujours fortuit —
  // « Logement abordable » tombait sur « Jacques Ancel » par un mot croisé dans
  // un paragraphe de limites.
  coeur: new Set(
    termes(
      d.type === "humaine"
        ? [d.fiche.nom, d.fiche.these_centrale].filter(Boolean).join(" ")
        : [d.fiche.nom, (d.fiche.capacites_cles ?? []).join(" ")].filter(Boolean).join(" ")
    )
  ),
}));

/**
 * Rareté d'un terme dans le corpus. Un terme présent dans la moitié des fiches
 * ne rattache rien : c'est la langue du corpus, pas le sujet de l'actualité.
 */
const frequence = new Map();
for (const d of documents) for (const t of d.termes) frequence.set(t, (frequence.get(t) ?? 0) + 1);
const N = documents.length;
const rarete = (t) => Math.log(N / (1 + (frequence.get(t) ?? 0)));

/** Un terme ne compte que s'il est présent dans moins d'un huitième des fiches. */
const PLAFOND_FREQUENCE = Math.max(3, Math.floor(N / 8));

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

const parPaire = new Map();
for (const r of graphe.relations) {
  const a = `${r.de.type}:${r.de.id}`;
  const b = `${r.vers.type}:${r.vers.id}`;
  for (const cle of [`${a}|${b}`, `${b}|${a}`]) {
    if (!parPaire.has(cle)) parPaire.set(cle, []);
    parPaire.get(cle).push(r);
  }
}

function nomDe(ref) {
  if (ref.type === "humaine") return parIdHumaine.get(ref.id)?.nom ?? ref.id;
  return parIdIA.get(ref.id)?.nom ?? ref.id;
}

function limitesDe(ref) {
  if (ref.type === "humaine") return parIdHumaine.get(ref.id)?.limites_critiques ?? "";
  return parIdIA.get(ref.id)?.limites_connues ?? "";
}

const limiteDate = Date.now() - JOURS * 86_400_000;

const items = queue
  .map((e) => {
    const c = e.contenu_propose ?? {};
    const date = Date.parse(c.date ?? e.created_at ?? "");
    return {
      id: e.id,
      source_id: e.source_id,
      titre: String(c.titre ?? "").trim(),
      lien: c.link ?? null,
      resume: String(c.resume ?? "").trim(),
      date: Number.isFinite(date) ? new Date(date).toISOString().slice(0, 10) : null,
      horodatage: Number.isFinite(date) ? date : 0,
      statut: e.statut,
    };
  })
  .filter((e) => e.titre && e.horodatage >= limiteDate)
  .sort((a, b) => b.horodatage - a.horodatage);

/**
 * Rattachement d'un élément de flux aux fiches, sans filtrage des aimants.
 * Sert deux fois : une passe de mesure, puis la passe qui produit les angles.
 */
function rattacher(item, exclues) {
  const termesItem = new Set(termes(`${item.titre} ${item.resume}`));
  const distinctifs = [...termesItem].filter(
    (t) => (frequence.get(t) ?? 0) > 0 && frequence.get(t) <= PLAFOND_FREQUENCE
  );
  if (distinctifs.length === 0) return [];
  return documents
    .filter((d) => !exclues.has(`${d.type}:${d.id}`))
    .map((d) => {
      const partages = distinctifs.filter((t) => d.termes.has(t));
      return { d, partages, score: partages.reduce((somme, t) => somme + rarete(t), 0) };
    })
    .filter((x) => x.partages.length >= MIN_TERMES)
    // Deux termes du cœur, pas un : sur des titres anglais face à un corpus
    // français, un seul mot partagé avec le nom d'une fiche est presque toujours
    // un homographe (« learning », « agents », « model »).
    .filter((x) => x.partages.filter((t) => x.d.coeur.has(t)).length >= 2)
    .filter((x) => x.score >= SCORE_MINIMAL)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

/**
 * Aimants à bruit : certaines fiches sont si générales qu'elles se rattachent à
 * presque tout. Mesuré sur 266 éléments : deux fiches IA « limite transversale »
 * captaient plus de la moitié des angles et les rendaient tous identiques. Une
 * fiche qui répond à plus d'un rattachement sur cinq ne distingue rien : on la
 * retire du rattachement (elle reste dans le corpus et dans les réponses).
 */
const PART_MAXIMALE = 0.2;
const comptes = new Map();
let rattachements = 0;
for (const item of items) {
  const trouves = rattacher(item, new Set());
  if (trouves.length === 0) continue;
  rattachements += 1;
  for (const x of trouves) {
    const cle = `${x.d.type}:${x.d.id}`;
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
  }
}
const aimants = new Set(
  [...comptes.entries()].filter(([, n]) => n > Math.max(3, rattachements * PART_MAXIMALE)).map(([cle]) => cle)
);

/* -------------------------------------------------------------------------- */
/* Les angles : une tension du corpus, éventuellement accrochée à l'actualité  */
/* -------------------------------------------------------------------------- */

/*
 * Résultat de mesure, à lire avant de juger ce qui suit.
 *
 * La première version partait de l'actualité : pour chaque élément de flux,
 * retrouver les fiches concernées, puis la tension entre elles. Mesuré sur 266
 * éléments des 150 derniers jours, c'est un échec, et il faut le dire : le
 * rattachement lexical d'un titre anglais (« Health Insurance Underwriting and
 * the Heterogeneous Effects of the Affordable Care Act ») à un corpus français
 * produit des liens faux (« AlphaGenome »), et le durcissement des seuils fait
 * tomber le nombre de tensions trouvées à zéro. Rattacher une actualité
 * quelconque à 636 fiches demande de comprendre les deux — c'est précisément ce
 * qu'un recouvrement de vocabulaire ne sait pas faire, et ce qu'un modèle de
 * langue ferait bien.
 *
 * Donc on inverse. Le point de départ devient une tension RÉELLE du corpus —
 * une contestation documentée, avec sa phrase de preuve — et l'actualité vient
 * s'y accrocher quand, et seulement quand, le rattachement est franc. Un angle
 * sans actualité reste un angle : le désaccord existe, il est daté, il est
 * sourcé, et c'est déjà un sujet.
 */

/** Contestations documentées, dédoublonnées par paire non orientée. */
const contestations = [];
const paires = new Set();
for (const r of graphe.relations) {
  if (r.type !== "conteste") continue;
  const a = `${r.de.type}:${r.de.id}`;
  const b = `${r.vers.type}:${r.vers.id}`;
  const cle = [a, b].sort().join("|");
  if (paires.has(cle)) continue;
  paires.add(cle);
  contestations.push(r);
}
contestations.sort((a, b) => `${a.de.id}|${a.vers.id}`.localeCompare(`${b.de.id}|${b.vers.id}`));

/**
 * Rotation déterministe : le même jour rend les mêmes angles, deux jours
 * différents en rendent d'autres. Pas d'aléatoire — une page qui change à chaque
 * rechargement n'est pas consultable.
 */
const jourAbsolu = Math.floor(Date.now() / 86_400_000);
const depart = contestations.length > 0 ? (jourAbsolu * MAX) % contestations.length : 0;

function theseDe(ref) {
  if (ref.type === "humaine") {
    const f = parIdHumaine.get(ref.id);
    return f?.these_centrale ?? "";
  }
  const f = parIdIA.get(ref.id);
  return (f?.capacites_cles ?? []).join(" ; ");
}

function axeDe(ref) {
  if (ref.type === "humaine") return parIdHumaine.get(ref.id)?.axe ?? "";
  return parIdIA.get(ref.id)?.axe ?? "";
}

function sousDomaineDe(ref) {
  return ref.type === "humaine" ? (parIdHumaine.get(ref.id)?.sous_domaine ?? "") : "";
}

function premierePhrase(texte, maximum = 300) {
  const propre = String(texte ?? "").trim();
  if (!propre) return "";
  const coupe = propre.split(/(?<=[.!?])\s+(?=[«"A-ZÀ-ÖØ-Þ])/)[0] ?? propre;
  return coupe.length > maximum ? `${coupe.slice(0, maximum).trim()}…` : coupe;
}

/** Actualités qui se rattachent franchement à l'une des deux fiches de la tension. */
function actualitesPour(refs) {
  const cles = new Set(refs.map((r) => `${r.type}:${r.id}`));
  const trouvees = [];
  for (const item of items) {
    if (trouvees.length >= 3) break;
    const rattachees = rattacher(item, aimants);
    if (!rattachees.some((x) => cles.has(`${x.d.type}:${x.d.id}`))) continue;
    trouvees.push({
      date: item.date,
      source: nomSource.get(item.source_id) ?? item.source_id,
      titre: item.titre,
      lien: item.lien,
      fiche_touchee: rattachees.find((x) => cles.has(`${x.d.type}:${x.d.id}`)).d.nom,
    });
  }
  return trouvees;
}

const angles = [];
for (let i = 0; i < Math.min(MAX, contestations.length); i += 1) {
  const r = contestations[(depart + i) % contestations.length];
  const aRef = r.de;
  const bRef = r.vers;
  const nomA = nomDe(aRef);
  const nomB = nomDe(bRef);

  angles.push({
    id: `${aRef.id}--${bRef.id}`,
    fiches: [
      {
        type: aRef.type,
        id: aRef.id,
        nom: nomA,
        axe: axeDe(aRef),
        sous_domaine: sousDomaineDe(aRef),
        these: premierePhrase(theseDe(aRef)),
        limite: premierePhrase(limitesDe(aRef)),
      },
      {
        type: bRef.type,
        id: bRef.id,
        nom: nomB,
        axe: axeDe(bRef),
        sous_domaine: sousDomaineDe(bRef),
        these: premierePhrase(theseDe(bRef)),
        limite: premierePhrase(limitesDe(bRef)),
      },
    ],
    preuve: r.preuve,
    champ: r.champ,
    // Direction volontairement neutre. La détection établit qu'une fiche en
    // nomme une autre dans ses limites, avec une marque d'opposition — pas qui
    // attaque qui : « Lacan … critiqué pour sa scientificité » nomme Freud sans
    // que Lacan mette Freud en cause.
    question:
      `Le référentiel documente une opposition entre « ${nomA} » et « ${nomB} ». La fiche « ${nomA} » l'écrit ` +
      `ainsi : « ${premierePhrase(r.preuve, 260)} » Sur quoi porte exactement le désaccord, et qu'est-ce qui, ` +
      "aujourd'hui, permettrait de le trancher ?",
    actualites: actualitesPour([aRef, bRef]),
  });
}

const avecActualite = angles.filter((a) => a.actualites.length > 0).length;

const sortie = {
  genere_le: new Date().toISOString().slice(0, 10),
  fenetre_jours: JOURS,
  nb_items_examines: items.length,
  nb_contestations_documentees: contestations.length,
  nb_angles: angles.length,
  nb_avec_actualite: avecActualite,
  fiches_ecartees_pour_bruit: [...aimants],
  avertissement:
    "Chaque angle part d'une contestation ÉCRITE dans le référentiel : une fiche en nomme une autre dans ses " +
    "limites critiques, avec une marque d'opposition, et la phrase est citée. La question, elle, est formulée " +
    "par gabarit — le script ne comprend ni l'une ni l'autre. C'est une amorce de travail, à vérifier et à " +
    "retravailler avant toute publication. Les actualités accrochées le sont par recouvrement de vocabulaire : " +
    "sur des flux majoritairement anglophones face à un corpus français, ce rattachement reste faible, et la " +
    "plupart des angles n'en portent aucune.",
  angles,
};

writeFileSync(SORTIE, `${JSON.stringify(sortie, null, 1)}\n`, "utf8");

if (args.includes("--json")) {
  console.log(JSON.stringify({ ...sortie, angles: undefined }, null, 2));
} else {
  console.log(`✓ ${angles.length} angle(s) depuis ${contestations.length} contestation(s) documentée(s)`);
  console.log(`  ${avecActualite} accroché(s) à une actualité récente → data/seed/questionnement.json`);
  for (const a of angles.slice(0, 4)) {
    console.log(`\n  ${a.fiches[0].nom} × ${a.fiches[1].nom}`);
    console.log(`  → ${a.question.slice(0, 200)}`);
  }
}

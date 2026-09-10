/*
 * MP-7 — Le maillon humain de la boucle de veille, enfin outillé.
 *
 * Ce que ce script débloque
 * -------------------------
 * La boucle est collecte → ciblage → patch → validation → publication. Le ciblage —
 * désigner la fiche que vise une proposition — est la seule étape que ni la collecte
 * ni un algorithme ne savent faire ici : un essai de rattachement lexical pondéré par
 * l'IDF a été mesuré le 10/09/2026 et abandonné, les meilleurs rattachements étant du
 * bruit (119 des 197 propositions sont en anglais face à un corpus français, et le
 * reste porte sur la conjoncture).
 *
 * Le résultat, c'est que le cron produisait 0 patch tous les jours en sortant vert :
 * `appliquer-veille.mjs --statut=a_traiter_fiche_existante` ne trouvait jamais rien,
 * parce que les producteurs n'écrivent que `en_attente` et que poser une cible
 * supposait d'éditer un JSON de 425 entrées à la main. La chaîne n'était pas cassée
 * par un algorithme absent : elle était cassée par l'absence d'un outil.
 *
 * Le format de décision — tenu volontairement pauvre
 * --------------------------------------------------
 * Un fichier texte, une décision par ligne. Ni JSON, ni tableur : il doit se remplir
 * dans n'importe quel éditeur, à côté du rapport de pré-tri qui donne les
 * identifiants, les titres et les liens.
 *
 *   <id> humaine:<fiche-id>     rattacher à une fiche humaine
 *   <id> ia:<fiche-id>          rattacher à une fiche IA
 *   <id> gap:<fiche-id>         rattacher à une fiche de gap
 *   <id> rejet                  écarter — la proposition n'apporte rien au corpus
 *   <id> nouvelle               sujet réel, mais aucune fiche ne le couvre encore
 *
 * Le préfixe d'un identifiant suffit dès qu'il est sans ambiguïté (8 caractères en
 * pratique), pour qu'on puisse recopier une ligne du rapport sans la rallonger.
 * Les lignes vides et celles commençant par # sont ignorées.
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ AUCUNE FICHE N'EST MODIFIÉE ICI. Ce script ne fait que poser une cible ou   │
 * │ un rejet sur la FILE. Le patch reste à produire, puis à appliquer par un    │
 * │ humain. Viser n'est pas écrire.                                            │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Chaque cible est contrôlée contre le corpus : un identifiant de fiche qui n'existe
 * pas fait échouer le lot entier, avant toute écriture. Une décision qui ne
 * correspond à aucune proposition en attente est signalée de même. On ne veut pas
 * d'un demi-tri appliqué.
 *
 * Usage
 * -----
 *   node scripts/trier-veille.mjs --decisions=/tmp/tri.txt            # simulation
 *   node scripts/trier-veille.mjs --decisions=/tmp/tri.txt --appliquer
 *   node scripts/trier-veille.mjs --modele                            # gabarit à remplir
 *   node scripts/trier-veille.mjs --aide
 *
 * Code de sortie : 0 si le lot est cohérent, 1 si une décision est invalide.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const FILE = path.join(RACINE, "data/seed/veille_queue.json");

const args = process.argv.slice(2);
if (args.includes("--aide") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}
const APPLIQUER = args.includes("--appliquer");
const MODELE = args.includes("--modele");
const argDec = args.find((a) => a.startsWith("--decisions="));

const lire = (p) => JSON.parse(readFileSync(p, "utf8"));
const file = lire(FILE);
const enAttente = file.filter((e) => e.statut === "en_attente");

// ─────────────────────────────────────────────── identifiants du corpus

const dossierHumaines = path.join(RACINE, "data/seed/fiches_humaines");
const idsHumaines = new Set();
for (const f of readdirSync(dossierHumaines)) {
  if (f.endsWith(".json")) for (const fiche of lire(path.join(dossierHumaines, f))) idsHumaines.add(fiche.id);
}
const idsIA = new Set(lire(path.join(RACINE, "data/seed/fiches_ia.json")).map((f) => f.id));
const idsGap = new Set(lire(path.join(RACINE, "data/seed/fiches_gap.json")).map((f) => f.id));

const CORPUS = {
  humaine: { ids: idsHumaines, cible: "fiche_humaine" },
  ia: { ids: idsIA, cible: "fiche_ia" },
  gap: { ids: idsGap, cible: "fiche_gap" },
};

// ───────────────────────────────────────────────────────────── gabarit

if (MODELE) {
  console.log("# Tri de la file de veille — une décision par ligne.");
  console.log("# Formes : humaine:<id> | ia:<id> | gap:<id> | rejet | nouvelle");
  console.log(`# ${enAttente.length} propositions en attente au ${new Date().toISOString().slice(0, 10)}.`);
  console.log("#");
  for (const e of enAttente) {
    const c = e.contenu_propose ?? {};
    const titre = (c.titre ?? c.nom ?? "(sans titre)").replace(/\s+/g, " ").trim().slice(0, 100);
    console.log(`# ${e.domaine_source} · ${titre}`);
    console.log(`${e.id.slice(0, 8)} `);
  }
  process.exit(0);
}

if (!argDec) {
  console.error("✗ Indiquer le fichier de décisions : --decisions=<chemin> (ou --modele pour un gabarit).");
  process.exit(1);
}

// ────────────────────────────────────────────────────────── décisions

const brut = readFileSync(argDec.slice("--decisions=".length), "utf8");
const decisions = [];
const erreurs = [];

brut.split("\n").forEach((ligne, i) => {
  const n = i + 1;
  const texte = ligne.split("#")[0].trim();
  if (!texte) return;
  const [prefixe, ...reste] = texte.split(/\s+/);
  const verdict = reste.join(" ").trim();
  if (!verdict) {
    erreurs.push(`ligne ${n} : « ${prefixe} » sans décision`);
    return;
  }

  const vises = enAttente.filter((e) => e.id.startsWith(prefixe));
  if (vises.length === 0) {
    erreurs.push(`ligne ${n} : aucune proposition en attente ne commence par « ${prefixe} »`);
    return;
  }
  if (vises.length > 1) {
    erreurs.push(`ligne ${n} : « ${prefixe} » désigne ${vises.length} propositions — rallonger le préfixe`);
    return;
  }

  if (verdict === "rejet" || verdict === "nouvelle") {
    decisions.push({ entree: vises[0], verdict, ligne: n });
    return;
  }

  const m = verdict.match(/^(humaine|ia|gap):(.+)$/);
  if (!m) {
    erreurs.push(`ligne ${n} : décision « ${verdict} » non reconnue`);
    return;
  }
  const [, famille, ficheId] = m;
  if (!CORPUS[famille].ids.has(ficheId)) {
    erreurs.push(`ligne ${n} : la fiche ${famille} « ${ficheId} » n'existe pas dans le corpus`);
    return;
  }
  decisions.push({ entree: vises[0], verdict, famille, ficheId, ligne: n });
});

const vus = new Set();
for (const d of decisions) {
  if (vus.has(d.entree.id)) erreurs.push(`ligne ${d.ligne} : la proposition ${d.entree.id.slice(0, 8)} est décidée deux fois`);
  vus.add(d.entree.id);
}

if (erreurs.length > 0) {
  console.error(`✗ ${erreurs.length} décision(s) invalide(s) — rien n'a été écrit :`);
  for (const e of erreurs.slice(0, 25)) console.error(`  ${e}`);
  if (erreurs.length > 25) console.error(`  … et ${erreurs.length - 25} autre(s)`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────── application

const aujourdhui = new Date().toISOString().slice(0, 10);
const compte = { cible: 0, rejet: 0, nouvelle: 0 };

if (APPLIQUER) {
  const parId = new Map(decisions.map((d) => [d.entree.id, d]));
  for (const e of file) {
    const d = parId.get(e.id);
    if (!d) continue;
    if (d.verdict === "rejet") {
      e.statut = "rejete";
      e.trie_le = aujourdhui;
    } else if (d.verdict === "nouvelle") {
      e.statut = "a_traiter_nouvelle_fiche";
      e.cible_type = "nouvelle_categorie";
      e.trie_le = aujourdhui;
    } else {
      e.statut = "a_traiter_fiche_existante";
      e.cible_type = CORPUS[d.famille].cible;
      e.cible_id = d.ficheId;
      e.trie_le = aujourdhui;
    }
  }
  writeFileSync(FILE, JSON.stringify(file, null, 2) + "\n", "utf8");
}

for (const d of decisions) {
  if (d.verdict === "rejet") compte.rejet += 1;
  else if (d.verdict === "nouvelle") compte.nouvelle += 1;
  else compte.cible += 1;
}

console.log(`Décisions lues : ${decisions.length} sur ${enAttente.length} propositions en attente`);
console.log(`  rattachées à une fiche : ${compte.cible}`);
console.log(`  rejetées               : ${compte.rejet}`);
console.log(`  sujet neuf à créer     : ${compte.nouvelle}`);
console.log(
  APPLIQUER
    ? "\nFile mise à jour. Étape suivante : npm run veille-patchs"
    : "\nLot cohérent, file inchangée (ajouter --appliquer pour écrire)."
);

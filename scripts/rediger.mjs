/*
 * Troisième maillon de l'autonomie : transformer un dossier d'enquête en instruction
 * de rédaction, complète et autoportante.
 *
 * Pourquoi un brief, et pas un appel à un modèle
 * ---------------------------------------------
 * L'interface à sept fournisseurs de `lib/fournisseurs-generation.ts` existe et
 * fonctionne, mais aucune clé n'est posée, et en dupliquer la logique dans un script
 * créerait une seconde définition de la même chose — ce que le dépôt s'interdit.
 *
 * Surtout, un modèle est déjà disponible sans clé : une tâche planifiée ouvre une
 * session Claude complète, qui lit, ouvre les sources et écrit. La chaîne devient
 * alors :
 *
 *   cron GitHub  →  détecte les lacunes  →  enquête  →  commit les dossiers
 *   tâche planifiée  →  lit les briefs  →  ouvre les sources  →  rédige  →  garde-fous
 *
 * Ce script produit le maillon du milieu : un brief par lacune, qui porte tout ce
 * qu'il faut pour écrire la fiche sans rien redécouvrir — le schéma exact, les
 * conventions du corpus, les règles de sourçage durcies après quatre audits, la règle
 * du TRL, les fiches voisines à imiter, et les candidats trouvés par l'enquête.
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ UN BRIEF N'EST PAS UNE FICHE, ET LES CANDIDATS NE SONT PAS DES SOURCES.     │
 * │ Le rédacteur doit ouvrir chaque référence avant de la citer : l'enquête a   │
 * │ trouvé des titres dans deux fonds, elle n'a rien lu.                        │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Usage
 * -----
 *   node scripts/rediger.mjs                       # un brief par dossier d'enquête
 *   node scripts/rediger.mjs --dossier=<fichier>   # un seul
 *   node scripts/rediger.mjs --min-candidats=3     # ignore les enquêtes trop maigres
 *
 * Code de sortie : 0, sauf si aucun dossier d'enquête n'existe.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const ENQUETES = path.join(RACINE, "data/enquetes");
const SORTIE = path.join(RACINE, "data/briefs");

const args = process.argv.slice(2);
if (args.includes("--aide") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
  process.exit(0);
}
const valeur = (nom, defaut) => {
  const a = args.find((x) => x.startsWith(`--${nom}=`));
  return a ? a.slice(nom.length + 3) : defaut;
};
const UN_DOSSIER = valeur("dossier", null);
const MIN = Number(valeur("min-candidats", 2));

const lire = (p) => JSON.parse(readFileSync(p, "utf8"));

if (!existsSync(ENQUETES)) {
  console.error("✗ Aucun dossier d'enquête. Lancer d'abord : npm run enqueter");
  process.exit(1);
}
const fichiers = UN_DOSSIER
  ? [UN_DOSSIER]
  : readdirSync(ENQUETES).filter((f) => f.endsWith(".json")).map((f) => path.join(ENQUETES, f));

if (fichiers.length === 0) {
  console.error("✗ Aucun dossier d'enquête dans data/enquetes/. Lancer : npm run enqueter");
  process.exit(1);
}

/* --------------------------------------------------- voisinage du corpus */

const humaines = [];
for (const f of readdirSync(path.join(RACINE, "data/seed/fiches_humaines"))) {
  if (f.endsWith(".json")) humaines.push(...lire(path.join(RACINE, "data/seed/fiches_humaines", f)));
}
const ia = lire(path.join(RACINE, "data/seed/fiches_ia.json"));

/**
 * Trois fiches du même voisinage : l'étalon de ton et de densité. Le voisinage se
 * déduit de la NATURE de la lacune, pas de son référentiel — pour une limite
 * transversale, l'étalon est les autres limites, et non les trois premières fiches de
 * modèle du fichier, qui n'ont ni la même forme ni le même propos.
 */
const VOISINAGE = {
  limite_transversale: { corpus: "ia", filtre: (f) => /limite-transversale/.test(f.id) || f.axe === "limites" },
  famille_modele: { corpus: "ia", filtre: (f) => f.axe === "generatif_raisonnement" },
  systeme_scientifique: { corpus: "ia", filtre: (f) => f.axe === "scientifique" },
  usage_sectoriel: { corpus: "ia", filtre: (f) => f.axe === "sectoriel" || (f.usages ?? []).length >= 2 },
  capacite_agentique: { corpus: "ia", filtre: (f) => f.axe === "agentique" },
  indicateur: { corpus: "humain", filtre: (f) => /index|indice|rapport|barometre/i.test(f.nom ?? "") },
  ecole: { corpus: "humain", filtre: (f) => f.axe === "psychologique" },
  courant: { corpus: "humain", filtre: (f) => f.axe === "philosophique" },
  sous_dimension: { corpus: "humain", filtre: null },
};

function voisines(lacune) {
  const regle = VOISINAGE[lacune.nature] ?? { corpus: lacune.referentiel === "ia" ? "ia" : "humain", filtre: null };
  const corpus = regle.corpus === "ia" ? ia : humaines;
  const proches = regle.filtre ? corpus.filter(regle.filtre) : [];
  const base = proches.length >= 3 ? proches : corpus;
  return base.slice(0, 3).map((f) => f.id);
}

const SCHEMA_IA = `id, axe, nom, editeur, architecture, capacites_cles[], usages[], limites_connues (CHAÎNE, pas tableau), sources[], statut, derniere_verification`;
const SCHEMA_HUMAIN = `id, axe, nom, periode_courant?, sous_domaine?, these_centrale, apport, limites_critiques, resonance_ia?, sources[], statut, derniere_verification`;

mkdirSync(SORTIE, { recursive: true });
const aujourdhui = new Date().toISOString().slice(0, 10);
let ecrits = 0;
let ignores = 0;

for (const chemin of fichiers) {
  const d = lire(chemin);
  if ((d.candidats ?? []).length < MIN) {
    ignores += 1;
    continue;
  }
  const estIA = d.lacune.referentiel === "ia";
  const nom = path.basename(chemin, ".json");

  const candidats = d.candidats
    .slice(0, 12)
    .map((c, i) => {
      const qui = c.auteurs?.length ? c.auteurs.slice(0, 3).join(", ") : "auteurs non donnés par le fonds";
      const quand = c.date ?? (c.annee ? `${c.annee} (année seule — donc PAS de champ date)` : "date inconnue");
      return `${i + 1}. **${c.titre}**\n   ${qui} · ${quand} · ${c.revue ?? c.type ?? "—"} · score ${c.score}\n   ${c.url ?? "(pas d'URL)"}${c.resume ? `\n   « ${c.resume.slice(0, 260)}${c.resume.length > 260 ? "…" : ""} »` : ""}`;
    })
    .join("\n\n");

  const brief = `# Brief de rédaction — ${d.lacune.nom}

> Produit par \`scripts/rediger.mjs\` le ${aujourdhui}, à partir de l'enquête du ${d.enquete_le}.
> Ce brief est autoportant : tout ce qu'il faut pour écrire la fiche est dedans.

## La lacune

Le mégaprompt, **§${d.lacune.section}**, exige **${d.lacune.nom}**. Le détecteur classe cet item
**${d.lacune.etat}** dans le corpus — ${d.lacune.etat === "absent" ? "aucune fiche ne le mentionne" : "il n'apparaît que dans le corps de fiches consacrées à autre chose, donc il est mentionné et non documenté"}.

Tu écris **une fiche ${estIA ? "de capacité d'IA" : "de capacité humaine"}** qui le comble.

## Le schéma, à respecter exactement

\`\`\`
${estIA ? SCHEMA_IA : SCHEMA_HUMAIN}
\`\`\`

Charge \`data/seed/${estIA ? "fiches_ia.json" : "fiches_humaines/"}\` par script Node — les
fichiers sont trop gros pour être lus d'un bloc — et **lis d'abord ces trois fiches
voisines**, qui sont ton étalon de ton, de densité et de format :
${voisines(d.lacune).map((i) => `- \`${i}\``).join("\n")}

Écris pour être indiscernable d'elles. \`statut\` : \`"documente"\`. \`derniere_verification\` : la date du jour.
${estIA ? "\n`limites_connues` est une **chaîne**, jamais un tableau : le validateur l'exige et les fiches du corpus sont toutes ainsi.\n" : ""}
## Les règles de sourçage, non négociables

Le corpus a été audité quatre fois. Son défaut dominant était *une affirmation exacte
mais absente de la source citée*. Un contrôleur indépendant rouvrira tes sources.

1. **Ouvre réellement chaque source avant de la citer** et vérifie qu'elle traite du bon
   sujet. Les candidats ci-dessous sont des titres trouvés dans deux fonds documentaires :
   **rien n'a été lu**. Un titre plausible n'est pas une source.
2. **Au moins une source primaire réelle et une secondaire.** La primaire est le document
   d'origine — l'article, le préprint, la publication de l'institution. Une encyclopédie
   ou un article de presse, Nature news compris, est **secondaire**.
3. **Jamais la même URL déclarée primaire et secondaire.**
4. Chaque source porte une \`date\` au format \`AAAA-MM-JJ\` strict. **Si seule l'année est
   établie, pas de date du tout** — un jour inventé est une faute plus grave qu'un champ
   vide, et le cliquet de qualité compte les sources sans date.
5. **N'écris aucun fait, chiffre, date ou nom qui ne figure pas dans une page que tu as lue.**
${estIA ? `
## La règle du TRL, durcie le 07/09/2026 et contrôlée par le validateur

Un \`trl\` ne se pose que sur un usage dont on peut **nommer l'exploitant, le lieu et la
date**, et toute valeur exige une \`trl_justification\` qui nomme le déploiement qui la
fonde. Une disponibilité commerciale mondiale n'est pas un lieu : si la source n'en donne
pas, dis-le dans la justification au lieu de prétendre le contraire.

Sans exploitant réel nommable : **pas de \`trl\`**. Utilise \`diffusion\`, qui vaut
\`emergent\`, \`etabli\`, \`standard\` ou \`historique\`.
` : ""}
## Neutralité

Sur tout sujet contesté, présente les positions en présence sans trancher, et distingue
le fait mesuré de ce qui en est inféré. Attribue chaque critique à quelqu'un de nommé,
avec l'endroit où il l'écrit : « certains chercheurs estiment » est proscrit, le corpus
vient d'être purgé de vingt-deux formules de ce genre.

## Les candidats trouvés par l'enquête

Requête interrogée : \`${d.requete}\`
Fonds : ${d.fonds_interroges.join(", ")} · ${d.nb_candidats} candidat(s), les ${Math.min(12, d.candidats.length)} mieux classés ci-dessous.

Le score n'est qu'un recouvrement de mots entre la requête et le titre, les auteurs et le
résumé, avec une prime de fraîcheur. **Il ne mesure pas la pertinence.** Un candidat bien
classé peut être hors sujet, un mal classé peut être la source fondatrice.

${candidats}

## Avant de rendre

\`\`\`bash
npm run valider          # 0 erreur exigé
npm run verifier-index   # réindexer si tu as touché un champ de contenu
npm run cliquet          # le corpus ne doit pas empirer
\`\`\`

Si le cliquet signale une aggravation : ou bien le défaut est réel et se corrige, ou bien
elle est assumée et se fige par \`npm run cliquet -- --figer\`, dans un commit qui en donne
la raison. Ne fige jamais sans avoir regardé ce qui a bougé.
`;

  writeFileSync(path.join(SORTIE, `${nom}.md`), brief, "utf8");
  ecrits += 1;
  console.log(`${nom.padEnd(56)} ${d.candidats.length} candidat(s)`);
}

console.log(`\n${ecrits} brief(s) écrit(s) dans data/briefs/${ignores > 0 ? ` · ${ignores} enquête(s) ignorée(s), moins de ${MIN} candidats` : ""}`);

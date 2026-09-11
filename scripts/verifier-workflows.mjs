/*
 * Contrôle des workflows : le shell et le JavaScript qu'ils embarquent sont-ils
 * syntaxiquement valides ?
 *
 * Le défaut qu'il empêche
 * -----------------------
 * Les workflows GitHub contiennent des blocs `run:` — du shell, et souvent du
 * JavaScript passé à `node -e` avec deux niveaux d'échappement : celui du YAML et
 * celui des guillemets du shell. Rien ne les vérifie avant qu'ils tournent. Une
 * apostrophe de trop se découvre sur un runner, après un push, quand le job rougit
 * pour une raison qui n'a rien à voir avec le code livré.
 *
 * Le dépôt en comptait sept au 11/09/2026, dont quatre écrits le jour même et jamais
 * exécutés. Ce script les extrait et les passe au vérificateur de syntaxe, en local,
 * en moins d'une seconde.
 *
 * Ce qu'il vérifie, et ce qu'il ne vérifie pas
 * -------------------------------------------
 * Il vérifie la SYNTAXE : que le shell parse, que le JavaScript parse. Il ne vérifie
 * ni la logique, ni les variables d'environnement, ni les actions tierces — un script
 * syntaxiquement correct peut parfaitement se tromper. C'est un filet contre la faute
 * bête, celle qui coûte un aller-retour de push pour rien.
 *
 * Les expressions `${{ … }}` de GitHub sont remplacées par un jeton avant l'analyse :
 * elles ne sont pas du shell, et `bash -n` les rejetterait à tort.
 *
 * Usage
 * -----
 *   node scripts/verifier-workflows.mjs
 *   node scripts/verifier-workflows.mjs --verbeux
 *
 * Codes de sortie : 0 si tout parse, 1 sinon.
 */

import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, "..");
const DOSSIER = path.join(RACINE, ".github/workflows");
const VERBEUX = process.argv.includes("--verbeux");

const temp = mkdtempSync(path.join(tmpdir(), "atlas-wf-"));
const defauts = [];
let nbShell = 0;
let nbJs = 0;

/** Les expressions GitHub ne sont pas du shell : on les neutralise avant analyse. */
const neutraliser = (s) => s.replace(/\$\{\{[^}]*\}\}/g, "JETON_GITHUB");

/**
 * Extrait le JavaScript des appels `node -e "…"`. Le corps est délimité par des
 * guillemets doubles au niveau shell ; les `\"` internes appartiennent au JS.
 */
function extraireJs(script) {
  const blocs = [];
  const re = /node\s+-e\s+"/g;
  let m;
  while ((m = re.exec(script)) !== null) {
    let i = m.index + m[0].length;
    let corps = "";
    let echappe = false;
    for (; i < script.length; i += 1) {
      const c = script[i];
      if (echappe) {
        corps += c === '"' ? '"' : `\\${c}`;
        echappe = false;
        continue;
      }
      if (c === "\\") {
        echappe = true;
        continue;
      }
      if (c === '"') break;
      corps += c;
    }
    blocs.push(corps);
    re.lastIndex = i;
  }
  return blocs;
}

function verifier(fichier, chemin, nom, contenu, mode) {
  const f = path.join(temp, `${fichier}-${nom}.${mode === "js" ? "mjs" : "sh"}`);
  writeFileSync(f, contenu, "utf8");
  try {
    if (mode === "js") execFileSync("node", ["--check", f], { stdio: "pipe" });
    else execFileSync("bash", ["-n", f], { stdio: "pipe" });
    return true;
  } catch (e) {
    const sortie = `${e.stderr ?? ""}${e.stdout ?? ""}`.toString().trim().split("\n").slice(0, 4).join(" | ");
    defauts.push({ fichier, chemin, mode, message: sortie || e.message });
    return false;
  }
}

const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort();

for (const fichier of fichiers) {
  const texte = readFileSync(path.join(DOSSIER, fichier), "utf8");

  // On lit les blocs `run:` au fil du texte plutôt qu'en analysant le YAML : cela
  // évite d'introduire une dépendance à un analyseur, et le repérage par indentation
  // suffit pour la forme employée dans ce dépôt (`run: |` ou `run: <une ligne>`).
  const lignes = texte.split("\n");
  let i = 0;
  let n = 0;
  while (i < lignes.length) {
    const m = lignes[i].match(/^(\s*)- ?name:.*$|^(\s*)run:\s*(\|[-+]?)?\s*(.*)$/);
    if (!m || !/^\s*run:/.test(lignes[i])) {
      i += 1;
      continue;
    }
    const indent = lignes[i].match(/^\s*/)[0].length;
    const pli = /run:\s*\|/.test(lignes[i]);
    let script;
    if (pli) {
      const corps = [];
      i += 1;
      while (i < lignes.length && (lignes[i].trim() === "" || lignes[i].match(/^\s*/)[0].length > indent)) {
        corps.push(lignes[i].slice(indent + 2));
        i += 1;
      }
      script = corps.join("\n");
    } else {
      script = lignes[i].replace(/^\s*run:\s*/, "");
      i += 1;
    }
    n += 1;
    const etiquette = `run-${n}`;
    nbShell += 1;
    verifier(fichier, `${fichier} › bloc run n°${n}`, etiquette, neutraliser(script), "sh");
    extraireJs(script).forEach((js, k) => {
      nbJs += 1;
      verifier(fichier, `${fichier} › bloc run n°${n} › node -e n°${k + 1}`, `${etiquette}-js${k + 1}`, neutraliser(js), "js");
    });
    if (VERBEUX) console.log(`  ${fichier} bloc ${n} — ${script.split("\n").length} ligne(s), ${extraireJs(script).length} script(s) node`);
  }
}

console.log(`${fichiers.length} workflow(s) — ${nbShell} bloc(s) shell, ${nbJs} script(s) node embarqué(s)`);

if (defauts.length === 0) {
  console.log("✓ Tout parse.");
  process.exit(0);
}
console.log(`\n✗ ${defauts.length} défaut(s) de syntaxe :`);
for (const d of defauts) console.log(`  [${d.mode}] ${d.chemin}\n      ${d.message}`);
process.exit(1);

/*
 * Hooks de résolution pour les tests node : traduit l'alias « @/ » du tsconfig vers la
 * racine du dépôt et complète les extensions (.ts, .tsx, .json, /index.ts), comme le fait
 * le bundler Next. Les .json sont chargés au format JSON sans attribut d'import.
 */
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = fileURLToPath(new URL("../../", import.meta.url));
const EXTENSIONS = ["", ".ts", ".tsx", ".json", "/index.ts"];

function completer(chemin) {
  for (const ext of EXTENSIONS) {
    const c = chemin + ext;
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith("@/")) base = RACINE + specifier.slice(2);
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    base = fileURLToPath(new URL(specifier, context.parentURL));
  }
  if (base) {
    const trouve = completer(base);
    if (trouve) return { url: pathToFileURL(trouve).href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith(".json")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${source};`, shortCircuit: true };
  }
  return next(url, context);
}

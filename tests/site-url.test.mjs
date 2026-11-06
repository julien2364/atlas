/*
 * Audit SEO du 06/11/2026 (P0) : sans NEXT_PUBLIC_SITE_URL, la canonique, robots.txt et le
 * sitemap doivent désigner le domaine de production https://atlas.dyonysos.fr, et non plus
 * le déploiement *.vercel.app. La variable, si elle est définie, reste prioritaire.
 *
 * Chaque cas s'exécute dans un processus node séparé : SITE_URL est figée au chargement du
 * module, l'environnement doit donc être posé avant l'import.
 *
 * Usage : npm test   (node --test tests/)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
const LOADER = new URL("./support/alias-loader.mjs", import.meta.url).href;

// Script exécuté dans le processus enfant : charge les vrais modules (site-config, seo,
// robots, sitemap) et renvoie ce qu'ils produisent.
const SONDE = `
  import { register } from "node:module";
  register(${JSON.stringify(LOADER)});
  const { SITE_URL } = await import("@/lib/site-config");
  const seo = await import("@/lib/seo");
  const robots = (await import("@/app/robots")).default();
  const sitemap = (await import("@/app/sitemap")).default();
  // app/layout.tsx déclare metadataBase: new URL(SITE_URL) ; Next résout les canoniques
  // relatives (alternates.canonical: "/…") contre cette base.
  const metadataBase = new URL(SITE_URL);
  process.stdout.write(JSON.stringify({
    SITE_URL,
    canoniqueAccueil: new URL("/", metadataBase).href,
    canoniqueFiche: new URL("/controverses", metadataBase).href,
    jsonLdSite: seo.jsonLdSite(),
    robots,
    sitemap: sitemap.map((e) => e.url),
  }));
`;

function sonder(env) {
  const envEnfant = { ...process.env, NEXT_PUBLIC_SITE_MODE: "public", ...env };
  for (const [k, v] of Object.entries(envEnfant)) if (v === undefined) delete envEnfant[k];
  const sortie = execFileSync(
    process.execPath,
    ["--no-warnings", "--input-type=module", "-e", SONDE],
    { cwd: RACINE, env: envEnfant, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(sortie);
}

const PROD = "https://atlas.dyonysos.fr";

test("app/layout.tsx : metadataBase est bâtie sur SITE_URL", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /metadataBase:\s*new URL\(SITE_URL\)/);
});

test("variable absente : canonique, robots.txt et sitemap désignent atlas.dyonysos.fr", () => {
  const r = sonder({ NEXT_PUBLIC_SITE_URL: undefined });
  assert.equal(r.SITE_URL, PROD);

  // Canoniques (relatives, résolues contre metadataBase) et JSON-LD du site.
  assert.equal(r.canoniqueAccueil, `${PROD}/`);
  assert.equal(r.canoniqueFiche, `${PROD}/controverses`);
  assert.equal(r.jsonLdSite.url, PROD);

  // robots.txt
  assert.equal(r.robots.sitemap, `${PROD}/sitemap.xml`);
  assert.equal(r.robots.host, PROD);

  // sitemap : toutes les URL sur le domaine de production, aucune sur vercel.app.
  assert.ok(r.sitemap.length > 0);
  for (const url of r.sitemap) assert.ok(url.startsWith(`${PROD}/`), url);
  assert.ok(!JSON.stringify(r).includes("vercel.app"));
});

test("variable définie : elle reste prioritaire sur le repli", () => {
  const r = sonder({ NEXT_PUBLIC_SITE_URL: "https://exemple.test/" });
  assert.equal(r.SITE_URL, "https://exemple.test");
  assert.equal(r.robots.sitemap, "https://exemple.test/sitemap.xml");
  for (const url of r.sitemap) assert.ok(url.startsWith("https://exemple.test/"), url);
});

// Lot 5 — ingestion de veille via RSS (canal prioritaire, cf. mégaprompt v1.1 section 7.1).
// Usage : node scripts/veille-rss.mjs
// Lit data/seed/veille_sources.json (sources actives de type "rss"), récupère les derniers items,
// et les ajoute à data/seed/veille_queue.json comme propositions "en_attente" (à valider avant
// publication dans le référentiel — pas de mise à jour automatique de fiche sans validation).
import Parser from "rss-parser";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const parser = new Parser({ timeout: 15000 });

function scoreFiabilite(source) {
  // Heuristique simple de départ (section 7.1) : source primaire officielle (labs IA, arXiv, institutions) = haute confiance.
  const primaires = ["arxiv", "anthropic", "openai", "nature", "fmi", "imf", "ocde", "oecd"];
  return primaires.some((p) => source.toLowerCase().includes(p)) ? 0.9 : 0.6;
}

async function main() {
  const sources = JSON.parse(readFileSync("data/seed/veille_sources.json", "utf-8")).filter(
    (s) => s.type === "rss" && s.actif && s.url
  );

  const queuePath = "data/seed/veille_queue.json";
  const queue = existsSync(queuePath) ? JSON.parse(readFileSync(queuePath, "utf-8")) : [];
  const existingKeys = new Set(queue.map((q) => q.contenu_propose?.link));

  let added = 0;
  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);
      for (const item of (feed.items ?? []).slice(0, 5)) {
        if (!item.link || existingKeys.has(item.link)) continue;
        queue.push({
          id: crypto.randomUUID(),
          source_id: source.id,
          cible_type: "nouvelle_categorie", // à requalifier manuellement (fiche_humaine / fiche_ia / gap) à la validation
          cible_id: null,
          contenu_propose: {
            titre: item.title ?? "(sans titre)",
            link: item.link,
            date: item.isoDate ?? item.pubDate ?? null,
            resume: (item.contentSnippet ?? "").slice(0, 400),
          },
          score_fiabilite: scoreFiabilite(source.nom),
          statut: "en_attente",
          created_at: new Date().toISOString(),
        });
        existingKeys.add(item.link);
        added++;
      }
      console.log(`✓ ${source.nom} — OK (${feed.items?.length ?? 0} items vus)`);
    } catch (err) {
      console.warn(`✗ ${source.nom} — échec (${err.message}) — à vérifier manuellement (url morte ? réseau ?)`);
    }
  }

  writeFileSync(queuePath, JSON.stringify(queue, null, 2));
  console.log(`\n${added} nouvelle(s) proposition(s) ajoutée(s) à la file de validation (${queuePath}).`);
  console.log("Rappel : aucune fiche n'est mise à jour automatiquement — validation manuelle requise (statut en_attente).");
  process.exit(0);
}

main();

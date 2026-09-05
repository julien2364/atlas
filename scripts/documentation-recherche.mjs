// Lot 2/3 (documentation en masse) — recherche documentaire dynamique réelle,
// PAS de génération depuis la mémoire du modèle (correction explicite de Julien,
// 05/09/2026 : "documenter en masse [...] c'est plutôt bibliothèques, archives
// etc, ou recherche dynamique vers ces sources").
//
// Source utilisée : API REST publique de Wikipédia (fr, repli en), qui expose un
// résumé réellement écrit et sourcé, avec l'URL canonique de l'article comme
// source vérifiable — pas un scraping, une API officielle documentée.
// Cf. aussi scripts/veille-rss.mjs pour le même principe appliqué à la veille.
//
// Comportement : pour chaque fiche au statut "a_documenter" (humaine ou IA) pas
// déjà présente dans la file de validation, tente de résoudre un article
// Wikipédia correspondant et propose son résumé + URL dans
// data/seed/veille_queue.json (statut "en_attente", cible_type/cible_id
// renseignés). AUCUNE fiche n'est mise à jour automatiquement : une personne
// doit relire et transformer le résumé en these_centrale/apport/limites_critiques
// avant publication (même garde-fou que pour la veille RSS).
//
// Usage : node scripts/documentation-recherche.mjs [--limite=20]

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const USER_AGENT = "AtlasHumainIA/1.0 (https://atlas-humain-ia-dyonysos.vercel.app; contact: julien.daures@gmail.com)";
const LIMITE_PAR_RUN = Number(process.argv.find((a) => a.startsWith("--limite="))?.split("=")[1] ?? 20);
const DELAI_MS = 250; // politesse envers l'API Wikipédia

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function chargerFichesHumaines() {
  const fichiers = ["philosophique", "social_1", "social_2", "evolution", "psychologique", "serenite"];
  return fichiers.flatMap((f) => JSON.parse(readFileSync(`data/seed/fiches_humaines/${f}.json`, "utf-8")));
}

function chargerFichesIA() {
  return JSON.parse(readFileSync("data/seed/fiches_ia.json", "utf-8"));
}

const MOTS_VIDES = new Set([
  "de", "du", "des", "la", "le", "les", "l", "et", "en", "au", "aux", "un", "une", "d",
  "the", "of", "and", "in", "on", "a", "an", "à",
]);

function motsSignificatifs(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents pour une comparaison robuste
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((m) => m.length > 2 && !MOTS_VIDES.has(m));
}

// Garde-fou qualité (05/09/2026, suite à des faux positifs constatés en conditions
// réelles : ex. "Mauricio Ferraris" -> apparié à tort à une telenovela "Rosa
// salvaje", "Junte" -> à une chanteuse colombienne "La Muchacha" dont le résumé
// mentionne incidemment son groupe "El Propio Junte" — un simple mot en commun
// dans le RÉSUMÉ ne suffit donc pas, trop de coïncidences lexicales possibles).
// v2 (même jour, après un 2e faux positif malgré le 1er garde-fou) : on ne compare
// plus qu'au TITRE de l'article (pas au résumé, trop bruité), et on rejette les
// titres dont la catégorie entre parenthèses trahit un homonyme sans rapport
// (footballeur, chanson, groupe...) — ex. "OMC" -> "OMC (band)", "GAVI" ->
// "Gavi (football)". Un acronyme apparié au nom de famille de quelqu'un (ex.
// "GATT" -> "Joseph Gatt") reste un angle mort connu de cette heuristique simple.
const CATEGORIES_SUSPECTES = [
  "band", "groupe musical", "chanteur", "chanteuse", "singer", "musician", "musicien",
  "footballeur", "football", "footballer", "actor", "actress", "acteur", "actrice",
  "album", "chanson", "song", "telenovela", "série télévisée", "tv series", "wrestler",
];

function correspondancePlausible(titreFiche, titreArticle) {
  const motsFiche = motsSignificatifs(titreFiche);
  if (motsFiche.length === 0) return true; // rien à vérifier (titre trop court)
  const titreArticleBas = titreArticle.toLowerCase();
  if (CATEGORIES_SUSPECTES.some((c) => titreArticleBas.includes(c))) return false;
  const cible = motsSignificatifs(titreArticle);
  return motsFiche.some((m) => cible.includes(m));
}

async function chercherResumeWikipedia(titre) {
  for (const lang of ["fr", "en"]) {
    try {
      // 1) recherche du titre d'article le plus probable
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        titre
      )}&format=json&srlimit=1`;
      const searchRes = await fetch(searchUrl, { headers: { "User-Agent": USER_AGENT } });
      if (!searchRes.ok) continue;
      const searchJson = await searchRes.json();
      const hit = searchJson?.query?.search?.[0];
      if (!hit?.title) continue;

      // 2) résumé de cet article via l'API REST
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        hit.title.replace(/ /g, "_")
      )}`;
      const summaryRes = await fetch(summaryUrl, { headers: { "User-Agent": USER_AGENT } });
      if (!summaryRes.ok) continue;
      const summary = await summaryRes.json();
      if (summary.type === "disambiguation" || !summary.extract) continue;
      if (!correspondancePlausible(titre, summary.title)) continue;

      return {
        langue: lang,
        titre_article: summary.title,
        extrait: summary.extract,
        url: summary.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function main() {
  const humaines = chargerFichesHumaines().filter((f) => f.statut === "a_documenter");
  const ia = chargerFichesIA().filter((f) => f.statut === "a_documenter");

  const queuePath = "data/seed/veille_queue.json";
  const queue = existsSync(queuePath) ? JSON.parse(readFileSync(queuePath, "utf-8")) : [];
  const idsDejaProposes = new Set(queue.map((q) => q.cible_id).filter(Boolean));

  const cibles = [
    ...humaines.filter((f) => !idsDejaProposes.has(f.id)).map((f) => ({ ...f, cible_type: "fiche_humaine" })),
    ...ia.filter((f) => !idsDejaProposes.has(f.id)).map((f) => ({ ...f, cible_type: "fiche_ia" })),
  ].slice(0, LIMITE_PAR_RUN);

  console.log(
    `${humaines.length + ia.length} fiche(s) "à documenter" au total, ${cibles.length} traitée(s) ce run (limite ${LIMITE_PAR_RUN}).`
  );

  let proposees = 0;
  let sansResultat = 0;

  for (const fiche of cibles) {
    const resultat = await chercherResumeWikipedia(fiche.nom);
    if (!resultat) {
      console.warn(`✗ ${fiche.nom} — aucun article Wikipédia exploitable trouvé (à documenter manuellement).`);
      sansResultat++;
      await delay(DELAI_MS);
      continue;
    }

    queue.push({
      id: crypto.randomUUID(),
      source_id: null,
      cible_type: fiche.cible_type,
      cible_id: fiche.id,
      contenu_propose: {
        nom: fiche.nom,
        titre_article_source: resultat.titre_article,
        langue_source: resultat.langue,
        extrait: resultat.extrait,
        url: resultat.url,
        note: "Résumé Wikipédia brut — à reformuler en these_centrale/apport/limites_critiques (fiche humaine) ou capacites_cles/limites_connues (fiche IA) avant validation. Ne jamais publier tel quel sans relecture.",
      },
      score_fiabilite: 0.5, // encyclopédie collaborative : point de départ, pas une source primaire — à recouper avant publication
      statut: "en_attente",
      created_at: new Date().toISOString(),
    });
    console.log(`✓ ${fiche.nom} — résumé ${resultat.langue} trouvé (${resultat.url})`);
    proposees++;
    await delay(DELAI_MS);
  }

  writeFileSync(queuePath, JSON.stringify(queue, null, 2));
  console.log(
    `\n${proposees} nouvelle(s) proposition(s) de documentation ajoutée(s) à la file de validation, ${sansResultat} sans résultat.`
  );
  console.log("Rappel : aucune fiche n'est mise à jour automatiquement — validation manuelle requise (statut en_attente).");
  process.exit(0);
}

main();

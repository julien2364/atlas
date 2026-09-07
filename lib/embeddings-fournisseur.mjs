/*
 * Fournisseur d'embeddings OPTIONNEL.
 *
 * Le moteur fonctionne sans : `lib/embedding-lexical.mjs` calcule les vecteurs
 * localement, sans clé et sans réseau, et c'est le défaut. Ce module ne sert que
 * si l'auteur pose une clé — pour gagner la proximité de SENS que le lexical ne
 * peut pas voir (cf. docs/moteur-reponse-local.md §4).
 *
 * Deux fournisseurs câblés derrière la même fonction :
 *   - Voyage AI, conservé parce que le projet le visait déjà ;
 *   - n'importe quelle API « compatible OpenAI » exposant POST /v1/embeddings,
 *     ce qui couvre Mistral, Jina, DeepInfra, Together, un serveur local
 *     (Ollama, LM Studio, text-embeddings-inference)… et tout ce qui viendra.
 *
 * Le nom du modèle employé entre dans l'empreinte de chaque passage
 * (`lib/passages-corpus.mjs`), donc changer de fournisseur ou de modèle réindexe
 * automatiquement : deux espaces vectoriels ne se comparent pas, et le
 * mécanisme qui l'empêche existait déjà — il est conservé tel quel.
 */

/**
 * @typedef {object} ConfigFournisseur
 * @property {"voyage" | "compatible-openai"} type
 * @property {string} url
 * @property {string} cle
 * @property {string} modele
 * @property {number | null} dimension  Dimension demandée, ou null pour le défaut du modèle.
 * @property {string} etiquette         Nom lisible, affiché dans les diagnostics.
 */

/**
 * Lit la configuration d'embeddings dans l'environnement. Rend `null` quand
 * aucune clé n'est posée — c'est le cas normal, et le moteur bascule alors sur
 * l'embedding lexical local.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {ConfigFournisseur | null}
 */
export function configEmbeddings(env = process.env) {
  // 1. API générique compatible OpenAI — prioritaire, car c'est celle qu'on
  //    pose explicitement quand on veut un fournisseur précis.
  if (env.ATLAS_EMBEDDINGS_URL && env.ATLAS_EMBEDDINGS_MODELE) {
    return {
      type: "compatible-openai",
      url: env.ATLAS_EMBEDDINGS_URL,
      cle: env.ATLAS_EMBEDDINGS_CLE ?? "",
      modele: env.ATLAS_EMBEDDINGS_MODELE,
      dimension: env.ATLAS_EMBEDDINGS_DIMENSION ? Number.parseInt(env.ATLAS_EMBEDDINGS_DIMENSION, 10) : null,
      etiquette: `compatible-openai:${env.ATLAS_EMBEDDINGS_MODELE}`,
    };
  }
  // 2. Voyage AI, historique du projet.
  if (env.VOYAGE_API_KEY) {
    const modele = env.VOYAGE_MODELE_EMBEDDING || "voyage-4-lite";
    return {
      type: "voyage",
      url: "https://api.voyageai.com/v1/embeddings",
      cle: env.VOYAGE_API_KEY,
      modele,
      dimension: env.VOYAGE_DIMENSION_SORTIE ? Number.parseInt(env.VOYAGE_DIMENSION_SORTIE, 10) : null,
      etiquette: `voyage:${modele}`,
    };
  }
  return null;
}

/**
 * Vectorise un lot de textes chez le fournisseur configuré.
 *
 * `usage` vaut "document" à l'indexation et "requete" à l'interrogation : Voyage
 * encode différemment un document et une question (`input_type`), et employer le
 * même des deux côtés dégrade nettement le rappel. Les API compatibles OpenAI
 * n'ont pas cette distinction, le paramètre y est simplement ignoré.
 *
 * Rend `{ vecteurs }` ou `{ erreur }` — jamais d'exception, l'appelant décide.
 *
 * @param {string[]} textes
 * @param {ConfigFournisseur} config
 * @param {"document" | "requete"} usage
 * @param {{ tentatives?: number, delaiMs?: number }} [options]
 * @returns {Promise<{ vecteurs: number[][], tokens: number } | { erreur: string }>}
 */
export async function embedderLotDistant(textes, config, usage, options = {}) {
  const tentativesMax = options.tentatives ?? 4;
  const delaiMs = options.delaiMs ?? 45_000;

  /** @type {Record<string, unknown>} */
  const corps = { input: textes, model: config.modele };
  if (config.type === "voyage") {
    corps.input_type = usage === "requete" ? "query" : "document";
    if (config.dimension) corps.output_dimension = config.dimension;
  } else if (config.dimension) {
    corps.dimensions = config.dimension;
  }

  /** @type {Record<string, string>} */
  const entetes = { "Content-Type": "application/json" };
  if (config.cle) entetes.Authorization = `Bearer ${config.cle}`;

  let derniereErreur = "inconnue";
  for (let tentative = 1; tentative <= tentativesMax; tentative += 1) {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), delaiMs);
    let reponse;
    try {
      reponse = await fetch(config.url, {
        method: "POST",
        headers: entetes,
        body: JSON.stringify(corps),
        signal: controleur.signal,
      });
    } catch (erreur) {
      derniereErreur = `réseau : ${/** @type {Error} */ (erreur).message}`;
      clearTimeout(minuterie);
      await pause(1000 * 2 ** tentative);
      continue;
    }
    clearTimeout(minuterie);

    if (reponse.ok) {
      const donnees = /** @type {any} */ (await reponse.json().catch(() => ({})));
      const vecteurs = (donnees.data ?? [])
        .slice()
        .sort((/** @type {any} */ a, /** @type {any} */ b) => (a.index ?? 0) - (b.index ?? 0))
        .map((/** @type {any} */ d) => d.embedding);
      if (vecteurs.length !== textes.length) {
        return { erreur: `${config.etiquette} a rendu ${vecteurs.length} vecteurs pour ${textes.length} textes.` };
      }
      const dimension = Array.isArray(vecteurs[0]) ? vecteurs[0].length : 0;
      for (const vecteur of vecteurs) {
        if (!Array.isArray(vecteur) || vecteur.length !== dimension || dimension === 0) {
          return { erreur: `${config.etiquette} a rendu des vecteurs de dimensions incohérentes.` };
        }
      }
      return { vecteurs, tokens: donnees.usage?.total_tokens ?? 0 };
    }

    const texteErreur = await reponse.text().catch(() => "");
    derniereErreur = `HTTP ${reponse.status} ${texteErreur.slice(0, 300)}`;
    // 400/401/403/404 ne se résoudront pas avec de la patience : clé, modèle, URL.
    if (reponse.status !== 429 && reponse.status < 500) {
      return { erreur: `${config.etiquette} a refusé la requête (${derniereErreur}).` };
    }
    await pause(1000 * 2 ** tentative);
  }
  return { erreur: `${config.etiquette} injoignable après ${tentativesMax} tentatives (${derniereErreur}).` };
}

/** @param {number} ms */
const pause = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms));

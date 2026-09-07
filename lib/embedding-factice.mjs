/*
 * Embedding FACTICE — bouchon de test déterministe, sans fournisseur ni clé.
 *
 * ⚠️ À QUOI CE FICHIER NE SERT PAS
 * --------------------------------
 * Il ne produit AUCUNE similarité sémantique. C'est un simple hachage de mots
 * projeté sur 1024 dimensions (« hashing trick » signé) : deux textes qui
 * partagent des mots se ressemblent, deux textes qui disent la même chose avec
 * d'autres mots ne se ressemblent pas du tout. Il ne remplace donc jamais un
 * vrai modèle d'embedding, et un index construit avec lui n'a aucune valeur
 * d'usage.
 *
 * À QUOI IL SERT
 * --------------
 * À prouver, sans dépenser un centime et sans aucune clé d'API, que TOUT LE
 * RESTE de la chaîne fonctionne : découpage du corpus en passages, écriture en
 * base, empreintes, idempotence, reprise après interruption, options de la CLI,
 * recherche vectorielle SQL, seuils, plafonds, cache, format de réponse.
 * Autrement dit : le jour où les vraies clés arrivent, il ne reste plus à
 * découvrir que la qualité sémantique, pas la plomberie.
 *
 * COMMENT ON L'ACTIVE — ET POURQUOI C'EST VOLONTAIREMENT PÉNIBLE
 * --------------------------------------------------------------
 * Un index rempli de vecteurs factices qui arriverait en production serait une
 * panne silencieuse : la recherche rendrait des résultats plausibles mais faux,
 * sans lever la moindre erreur. Trois verrous, cumulatifs :
 *   1. la variable d'environnement `ATLAS_EMBEDDING_FACTICE=1` doit être posée
 *      explicitement — rien n'est actif par défaut ;
 *   2. l'indexeur exige EN PLUS le drapeau `--embedding-factice` sur la ligne
 *      de commande : une variable oubliée dans un shell ne suffit pas ;
 *   3. le mode se refuse à démarrer si `NODE_ENV=production` ou si `VERCEL` est
 *      présent dans l'environnement (déploiement Vercel).
 * Et pour que la trace reste visible même après coup, les lignes écrites
 * portent `modele_embedding = 'factice-hachage-1024'` : `atlas_rag_statistiques()`
 * affiche donc en clair qu'un index est factice, et l'empreinte SHA-256 des
 * passages inclut ce nom de modèle — repasser au vrai modèle réindexe tout.
 */

import { createHash } from "node:crypto";

/** Nom stocké dans `atlas_rag_passages.modele_embedding` et dans le diagnostic d'une réponse. */
export const MODELE_FACTICE = "factice-hachage-1024";

/** Dimension imposée par supabase/schema.sql (`vector(1024)`). */
export const DIMENSION_FACTICE = 1024;

/**
 * Le mode factice est-il autorisé par l'environnement ?
 * Rend `false` par défaut, et `false` de force en production.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function embeddingFacticeAutorise(env = process.env) {
  if (env.ATLAS_EMBEDDING_FACTICE !== "1") return false;
  if (env.NODE_ENV === "production") return false;
  if (env.VERCEL) return false;
  return true;
}

/**
 * Raison du refus, à afficher telle quelle. Rend null si le mode est autorisé.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | null}
 */
export function raisonRefusFactice(env = process.env) {
  if (env.ATLAS_EMBEDDING_FACTICE !== "1") {
    return "le mode factice exige ATLAS_EMBEDDING_FACTICE=1 dans l'environnement (il n'est jamais actif par défaut)";
  }
  if (env.NODE_ENV === "production") {
    return "le mode factice est interdit avec NODE_ENV=production";
  }
  if (env.VERCEL) {
    return "le mode factice est interdit sur un déploiement Vercel";
  }
  return null;
}

/**
 * Découpe un texte en jetons comparables : minuscules, sans accents, ≥ 3 caractères.
 *
 * @param {string} texte
 * @returns {string[]}
 */
function jetons(texte) {
  return String(texte)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length >= 3);
}

/**
 * Vecteur déterministe de dimension 1024, normalisé (norme L2 = 1) pour que la
 * distance cosinus de pgvector soit directement exploitable.
 *
 * Même texte ⇒ même vecteur, sur toutes les machines et à toutes les dates :
 * c'est cette propriété qui permet de tester l'idempotence de l'indexeur.
 * Chaque mot DISTINCT compte une fois (pondération booléenne) : sans cela, un
 * passage qui répète dix fois « intelligence » écrase toutes les autres
 * dimensions et remonte sur n'importe quelle question.
 *
 * @param {string} texte
 * @param {number} [dimension]
 * @returns {number[]}
 */
export function embeddingFactice(texte, dimension = DIMENSION_FACTICE) {
  /** @type {number[]} */
  const vecteur = new Array(dimension).fill(0);
  const vus = new Set();
  for (const mot of jetons(texte)) {
    if (vus.has(mot)) continue;
    vus.add(mot);
    const empreinte = createHash("sha256").update(mot, "utf8").digest();
    const index = empreinte.readUInt32BE(0) % dimension;
    const signe = empreinte[4] % 2 === 0 ? 1 : -1;
    vecteur[index] += signe;
  }
  let norme = 0;
  for (const valeur of vecteur) norme += valeur * valeur;
  norme = Math.sqrt(norme);
  if (norme === 0) {
    // Texte sans aucun mot exploitable : vecteur unitaire arbitraire mais stable,
    // plutôt qu'un vecteur nul que pgvector refuserait de comparer en cosinus.
    vecteur[0] = 1;
    return vecteur;
  }
  return vecteur.map((valeur) => valeur / norme);
}

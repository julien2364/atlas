/*
 * Embedding LEXICAL — BM25, sans clé, sans réseau, sans dépendance.
 *
 * Ce que ce module fait, et ne fait pas
 * -------------------------------------
 * Il transforme un texte français en un vecteur pondéré BM25, tel que le cosinus
 * entre deux vecteurs mesure leur proximité. C'est une mesure de RECOUVREMENT DE
 * VOCABULAIRE, pondérée par la rareté des mots : deux textes qui parlent de la
 * même chose avec les mêmes mots se ressemblent. Deux textes qui disent la même
 * chose avec d'AUTRES mots — « connaissance scientifique » et « Karl Popper »,
 * « bien-vivre » et « eudémonisme » — ne se ressemblent PAS. Un embedding
 * sémantique, lui, les rapproche. La limite est structurelle, elle est mesurée
 * (`node scripts/indexer-corpus.mjs --mesurer`) et documentée telle quelle dans
 * docs/moteur-reponse-local.md §4. C'est le prix à payer pour n'avoir ni clé, ni
 * facture, ni appel réseau.
 *
 * Ce n'est PAS le bouchon `lib/embedding-factice.mjs`, qui hache des mots bruts
 * sans pondération ni normalisation et n'a aucune valeur d'usage. Ici :
 *   - accents et casse normalisés (« Modèle » = « modele » = « MODÈLES ») ;
 *   - mots-outils français écartés — mesuré : sans eux, les meilleurs résultats
 *     d'une question sont choisis par « être », « peut » et « faut » ;
 *   - désuffixation légère, pour que « gouvernance » et « gouvernances »,
 *     « artificiel » et « artificielle » tombent sur le même terme ;
 *   - pondération BM25 : un mot présent dans 4 passages sur 2 855 pèse
 *     beaucoup plus qu'un mot présent dans 500 ;
 *   - saturation de fréquence et normalisation par la longueur, pour qu'un
 *     passage bavard ne remonte pas sur tout.
 *
 * Représentation CREUSE, et pourquoi pas une projection dense
 * -----------------------------------------------------------
 * L'intention initiale était de projeter le vecteur BM25 sur quelques centaines
 * de dimensions par hachage signé (« count sketch »), pour tenir dans un fichier
 * versionné. Mesuré, c'est un mauvais échange : une question porte 4 à 8 termes,
 * un passage en porte ~42, et avec 512 dimensions chaque passage percute par
 * hasard une dimension de la question une fois sur deux. Le bruit de collision
 * dépasse le signal — rappel@10 mesuré contre le BM25 exact :
 *
 *   256 dim → 0,078 · 512 dim → 0,189 · 1 024 dim → 0,233 · 4 096 dim → 0,556
 *
 * Autrement dit la projection détruit le classement avant même de faire gagner
 * de la place. Le vecteur BM25 CREUX, lui, est à la fois exact et plus petit :
 * le vocabulaire du corpus ne fait que 7 436 termes et un passage n'en porte que
 * 37 distincts en moyenne, soit 106 577 « composantes » au total — 312 Ko en
 * (uint16, int8), contre 1,39 Mo pour la version dense en 512 dimensions, et
 * 11,15 Mo pour les 4 096 dimensions qu'il faudrait pour approcher (sans
 * l'atteindre) l'exactitude du creux.
 *
 * Les fonctions de projection sont conservées : elles servent à `--mesurer` (qui
 * refait la mesure ci-dessus à la demande) et au cas où un fournisseur
 * d'embeddings, lui, rendrait de vrais vecteurs denses.
 *
 * Déterminisme
 * ------------
 * Même texte + même lexique ⇒ même vecteur, sur toute machine et à toute date.
 * C'est ce qui rend `data/index-vectoriel.json` reproductible, donc son diff git
 * lisible, et ce qui permet à `lib/rag.ts` de vectoriser une question dans le
 * même espace sans rien recalculer.
 */

/** Nom du modèle, écrit dans l'index et dans le diagnostic d'une réponse. */
export const MODELE_LEXICAL = "lexical-bm25-creux-v1";

/**
 * Dimension de la projection dense, utilisée uniquement par la mesure
 * comparative de `--mesurer`. La production n'en dépend pas.
 */
export const DIMENSION_LEXICALE = 512;

/** Paramètres BM25 usuels. b règle la pénalisation des passages longs. */
const BM25_K1 = 1.2;
const BM25_B = 0.75;

/**
 * Mots-outils français. Ils apparaissent dans presque tous les passages : leur
 * IDF est quasi nul, mais ils occupent des dimensions et ajoutent du bruit de
 * collision. On les écarte à la tokenisation.
 *
 * Liste volontairement courte et fermée : pas de mot porteur de sens dedans. En
 * particulier « ia », « ai », « ml », « pib » restent des termes indexables.
 */
const MOTS_OUTILS = new Set(
  (
    // Déterminants, pronoms, prépositions, conjonctions
    "au aux avec ce ces dans de des du elle en et eux il ils je la le les leur leurs lui ma mais me mes moi " +
    "mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos " +
    "votre vous c d j l m n s t y a alors donc car ni or si comme quand lors dont ainsi entre vers chez " +
    "sans sous encore deja cette cet celui celle ceux celles chaque autre autres meme memes aussi tel telle " +
    "tels telles ici apres avant pendant depuis jusqu contre selon malgre outre parmi hors afin " +
    // Interrogatifs — ils ouvrent la question et n'appartiennent à aucun sujet
    "quel quelle quels quelles quoi comment pourquoi combien lequel laquelle lesquels lesquelles ou " +
    // Auxiliaires être / avoir, toutes personnes et temps usuels
    "etre ete etee etees etes etant suis es est sommes sont serai seras sera serons serez seront serais " +
    "serait serions seriez seraient etais etait etions etiez etaient fut furent soit soient sois soyons " +
    "ai as avons avez ont aurai auras aura aurons aurez auront aurais aurait aurions auriez auraient " +
    "avais avait avions aviez avaient eu eue eues eus eut eurent ayant ayons aient " +
    // Semi-auxiliaires et verbes vides : ils sont dans presque tous les passages
    "faire fait faits faites fais font ferai fera feront ferait faudra faut fallait fallu " +
    "pouvoir peut peuvent peux pourra pourront pourrait pourraient pouvait pouvaient pu puisse puissent " +
    "devoir doit doivent devra devront devrait devraient devait devaient du dus " +
    "avoir aller va vont ira iront allait dire dit disent disait " +
    // Adverbes et quantifieurs de haute fréquence, sans contenu propre
    "plus moins tres tout tous toute toutes peu trop assez beaucoup autant tant jamais toujours " +
    "souvent parfois surtout notamment cependant toutefois neanmoins pourtant enfin puis ensuite " +
    "actuel actuelle actuels actuelles actuellement general generale generalement " +
    "grand grande grands grandes petit petite gros nouveau nouvelle nouveaux nouvelles " +
    "cas fois maniere facon sorte"
  )
    .split(/\s+/)
    .filter((mot) => /^[a-z-]+$/.test(mot))
);

/**
 * Désuffixation légère du français. Volontairement conservatrice : elle ne
 * cherche pas la racine linguistique, seulement à faire tomber les variantes
 * les plus fréquentes sur la même dimension. Appliquée des DEUX côtés (corpus et
 * question), une sur-troncature reste cohérente : elle rapproche parfois deux
 * mots distincts, elle ne casse jamais l'appariement d'un mot avec lui-même.
 *
 * Plancher de 4 caractères sur la racine : sans lui, « mesure » → « m ».
 *
 * @param {string} mot
 * @returns {string}
 */
export function racine(mot) {
  // 1. Marque du pluriel. Séparée du reste, et faite EN PREMIER : sans cela
  //    « ethiques » (8 lettres) refuse « iques » faute de plancher, garde son
  //    « s », et ne rejoint jamais « ethique ». Le passage préalable au singulier
  //    ramène les deux formes sur le même chemin.
  let racineCourante = mot;
  if (racineCourante.length > 5 && racineCourante.endsWith("aux")) {
    // nationaux → national, mondiaux → mondial
    racineCourante = `${racineCourante.slice(0, -3)}al`;
  } else if (racineCourante.length > 4 && /[sx]$/.test(racineCourante)) {
    racineCourante = racineCourante.slice(0, -1);
  }

  // 2. Deux passes de désuffixation dérivationnelle. Deux, et pas une :
  //    « gouvernementale » ne perd que « ale » à la première passe et resterait
  //    « gouvernement », donc à distance de « gouvernement » → « gouvern ».
  //    Deux passes les font converger. Une troisième sur-tronque sans rien
  //    rapprocher de plus (mesuré : rappel identique, collisions en hausse).
  for (let passe = 0; passe < 2; passe += 1) {
    const avant = racineCourante;
    for (const suffixe of SUFFIXES) {
      if (racineCourante.length - suffixe.length >= PLANCHER_RACINE && racineCourante.endsWith(suffixe)) {
        racineCourante = racineCourante.slice(0, -suffixe.length);
        break;
      }
    }
    if (racineCourante === avant) break;
  }
  return racineCourante;
}

/**
 * Plancher de longueur de la racine. Sans lui, « mesure » finirait en « m » et
 * entrerait en collision avec la moitié du corpus.
 */
const PLANCHER_RACINE = 4;

/**
 * Suffixes dérivationnels, testés du plus long au plus court — l'ordre est
 * significatif : « ement » doit être essayé avant « ent », sinon « gouvernement »
 * devient « gouvernem ». Les accents sont déjà retirés à ce stade, la liste est
 * donc en ASCII.
 */
const SUFFIXES = [
  "issement",
  "issante",
  "issant",
  "atrice",
  "ateur",
  "ation",
  "ement",
  "ance",
  "ence",
  "isme",
  "iste",
  "ique",
  "able",
  "ible",
  "aire",
  "ite",
  "euse",
  "eur",
  "elle",
  "ent",
  "ale",
  "ive",
  "if",
  "el",
  "ee",
  "e",
];

/**
 * Tokenise : minuscules, sans accents, mots-outils retirés, désuffixation.
 *
 * @param {string} texte
 * @returns {string[]} termes normalisés, doublons conservés (la fréquence compte)
 */
export function termes(texte) {
  const brut = String(texte)
    .toLowerCase()
    .normalize("NFD")
    // Retire les diacritiques (bloc Combining Diacritical Marks U+0300–U+036F).
    .replace(/[̀-ͯ]/g, "")
    // Œ/Æ ne se décomposent pas en NFD : « œuvre » deviendrait « uvre ».
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .split(/[^a-z0-9]+/);

  /** @type {string[]} */
  const sortie = [];
  for (const mot of brut) {
    if (mot.length < 2) continue;
    if (MOTS_OUTILS.has(mot)) continue;
    const r = racine(mot);
    if (r.length < 2 || MOTS_OUTILS.has(r)) continue;
    sortie.push(r);
  }
  return sortie;
}

/**
 * Hachage FNV-1a 32 bits, avec graine. Les termes sont ASCII par construction
 * (accents retirés en amont), `charCodeAt` suffit donc.
 *
 * @param {string} texte
 * @param {number} graine
 * @returns {number}
 */
function fnv1a(texte, graine) {
  let h = graine >>> 0;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Dimension d'accueil d'un terme. */
const GRAINE_INDEX = 0x811c9dc5;
/** Signe (+1/−1) d'un terme — indépendant de sa dimension. */
const GRAINE_SIGNE = 0x9e3779b9;

/**
 * @param {string} terme
 * @param {number} dimension
 * @returns {{ index: number, signe: number }}
 */
function place(terme, dimension) {
  return {
    index: fnv1a(terme, GRAINE_INDEX) % dimension,
    signe: fnv1a(terme, GRAINE_SIGNE) & 1 ? 1 : -1,
  };
}

/**
 * @typedef {object} Lexique
 * @property {number} nb_documents      Nombre de passages ayant servi à le construire.
 * @property {number} longueur_moyenne  Longueur moyenne d'un passage, en termes.
 * @property {Map<string, number>} df   Nombre de passages contenant chaque terme.
 */

/**
 * Construit le lexique (fréquences documentaires) depuis les passages du corpus.
 * C'est la seule statistique globale du modèle : elle doit être identique à
 * l'indexation et à l'interrogation, elle voyage donc dans le fichier d'index.
 *
 * @param {{ texte: string }[]} passages
 * @returns {Lexique}
 */
export function construireLexique(passages) {
  /** @type {Map<string, number>} */
  const df = new Map();
  let total = 0;
  for (const passage of passages) {
    const jetons = termes(passage.texte);
    total += jetons.length;
    for (const terme of new Set(jetons)) {
      df.set(terme, (df.get(terme) ?? 0) + 1);
    }
  }
  return {
    nb_documents: passages.length,
    longueur_moyenne: passages.length > 0 ? total / passages.length : 0,
    df,
  };
}

/**
 * IDF « BM25 » lissé, toujours positif. Un terme inconnu du lexique reçoit l'IDF
 * d'un terme vu une seule fois : c'est le cas d'un mot rare tapé dans une
 * question, il ne doit pas peser zéro.
 *
 * @param {Lexique} lexique
 * @param {string} terme
 * @returns {number}
 */
function idf(lexique, terme) {
  const n = lexique.nb_documents;
  const df = lexique.df.get(terme) ?? 1;
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

/**
 * @param {Float32Array} vecteur
 * @returns {Float32Array} le même tableau, normalisé L2 (norme 1)
 */
function normaliser(vecteur) {
  let norme = 0;
  for (let i = 0; i < vecteur.length; i += 1) norme += vecteur[i] * vecteur[i];
  norme = Math.sqrt(norme);
  if (norme === 0) {
    // Texte sans aucun terme exploitable : vecteur unitaire stable plutôt qu'un
    // vecteur nul, dont le cosinus n'est pas défini.
    vecteur[0] = 1;
    return vecteur;
  }
  for (let i = 0; i < vecteur.length; i += 1) vecteur[i] /= norme;
  return vecteur;
}

/**
 * Vecteur d'un PASSAGE du corpus (pondération BM25 complète, longueur comprise).
 *
 * @param {string} texte
 * @param {Lexique} lexique
 * @param {number} [dimension]
 * @returns {Float32Array}
 */
export function vecteurDocument(texte, lexique, dimension = DIMENSION_LEXICALE) {
  const jetons = termes(texte);
  /** @type {Map<string, number>} */
  const tf = new Map();
  for (const terme of jetons) tf.set(terme, (tf.get(terme) ?? 0) + 1);

  const longueur = jetons.length;
  const moyenne = lexique.longueur_moyenne || 1;
  const vecteur = new Float32Array(dimension);
  for (const [terme, frequence] of tf) {
    const saturation =
      (frequence * (BM25_K1 + 1)) / (frequence + BM25_K1 * (1 - BM25_B + (BM25_B * longueur) / moyenne));
    const poids = idf(lexique, terme) * saturation;
    const { index, signe } = place(terme, dimension);
    vecteur[index] += signe * poids;
  }
  return normaliser(vecteur);
}

/**
 * Vecteur d'une QUESTION. Même espace, même hachage, même IDF — seule la
 * normalisation par la longueur disparaît : une question courte ne doit pas être
 * pénalisée comme un passage court.
 *
 * @param {string} texte
 * @param {Lexique} lexique
 * @param {number} [dimension]
 * @returns {Float32Array}
 */
export function vecteurRequete(texte, lexique, dimension = DIMENSION_LEXICALE) {
  const jetons = termes(texte);
  /** @type {Map<string, number>} */
  const tf = new Map();
  for (const terme of jetons) tf.set(terme, (tf.get(terme) ?? 0) + 1);

  const vecteur = new Float32Array(dimension);
  for (const [terme, frequence] of tf) {
    const saturation = (frequence * (BM25_K1 + 1)) / (frequence + BM25_K1);
    const poids = idf(lexique, terme) * saturation;
    const { index, signe } = place(terme, dimension);
    vecteur[index] += signe * poids;
  }
  return normaliser(vecteur);
}

/* -------------------------------------------------------------------------- */
/* Quantification 8 bits                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Quantifie un vecteur normalisé en entiers signés 8 bits.
 *
 * L'échelle est celle du vecteur lui-même (max |composante|), et elle n'est PAS
 * stockée : le cosinus est invariant par multiplication scalaire, donc
 * `cos(q_a, q_b) ≈ cos(a, b)` sans jamais déquantifier. Un octet par dimension,
 * rien d'autre.
 *
 * @param {Float32Array} vecteur
 * @returns {Int8Array}
 */
export function quantifier(vecteur) {
  let maximum = 0;
  for (let i = 0; i < vecteur.length; i += 1) {
    const absolu = Math.abs(vecteur[i]);
    if (absolu > maximum) maximum = absolu;
  }
  const sortie = new Int8Array(vecteur.length);
  if (maximum === 0) return sortie;
  const facteur = 127 / maximum;
  for (let i = 0; i < vecteur.length; i += 1) {
    // Math.round(-0.5) vaut -0 en JS ; le cadrage à ±127 protège du dépassement
    // d'un octet signé si un arrondi rendait 128.
    const valeur = Math.round(vecteur[i] * facteur);
    sortie[i] = valeur > 127 ? 127 : valeur < -127 ? -127 : valeur;
  }
  return sortie;
}

/**
 * Cosinus entre deux vecteurs quantifiés. `normeB` est passée quand elle a été
 * précalculée une fois pour toutes (cas de la question, comparée à 2 847
 * passages) : c'est ce qui rend la recherche linéaire négligeable.
 *
 * @param {Int8Array} a
 * @param {Int8Array} b
 * @param {number} [normeA]
 * @param {number} [normeB]
 * @returns {number}
 */
export function cosinusInt8(a, b, normeA, normeB) {
  let produit = 0;
  let na = normeA === undefined ? 0 : -1;
  let nb = normeB === undefined ? 0 : -1;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    produit += x * y;
    if (na >= 0) na += x * x;
    if (nb >= 0) nb += y * y;
  }
  const normeFinaleA = normeA === undefined ? Math.sqrt(na) : normeA;
  const normeFinaleB = normeB === undefined ? Math.sqrt(nb) : normeB;
  if (normeFinaleA === 0 || normeFinaleB === 0) return 0;
  return produit / (normeFinaleA * normeFinaleB);
}

/**
 * Norme euclidienne d'un vecteur quantifié.
 * @param {Int8Array} vecteur
 * @returns {number}
 */
export function normeInt8(vecteur) {
  let total = 0;
  for (let i = 0; i < vecteur.length; i += 1) total += vecteur[i] * vecteur[i];
  return Math.sqrt(total);
}

/**
 * Cosinus BM25 EXACT, sans projection ni quantification — la référence contre
 * laquelle on mesure ce que la projection coûte (`--mesurer` de l'indexeur).
 * Jamais utilisé en production : il suppose de garder tout le vocabulaire en
 * mémoire, ce que le fichier d'index évite précisément.
 *
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 * @returns {number}
 */
export function cosinusCreux(a, b) {
  let produit = 0;
  let na = 0;
  let nb = 0;
  const [petit, grand] = a.size <= b.size ? [a, b] : [b, a];
  for (const [terme, poids] of petit) {
    const autre = grand.get(terme);
    if (autre !== undefined) produit += poids * autre;
  }
  for (const poids of a.values()) na += poids * poids;
  for (const poids of b.values()) nb += poids * poids;
  if (na === 0 || nb === 0) return 0;
  return produit / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Poids BM25 creux d'un texte, indexés par terme. Utilisé uniquement par la
 * mesure de qualité ci-dessus.
 *
 * @param {string} texte
 * @param {Lexique} lexique
 * @param {boolean} [estRequete]
 * @returns {Map<string, number>}
 */
export function poidsCreux(texte, lexique, estRequete = false) {
  const jetons = termes(texte);
  /** @type {Map<string, number>} */
  const tf = new Map();
  for (const terme of jetons) tf.set(terme, (tf.get(terme) ?? 0) + 1);
  const longueur = jetons.length;
  const moyenne = lexique.longueur_moyenne || 1;
  /** @type {Map<string, number>} */
  const poids = new Map();
  for (const [terme, frequence] of tf) {
    const denominateur = estRequete
      ? frequence + BM25_K1
      : frequence + BM25_K1 * (1 - BM25_B + (BM25_B * longueur) / moyenne);
    poids.set(terme, idf(lexique, terme) * ((frequence * (BM25_K1 + 1)) / denominateur));
  }
  return poids;
}

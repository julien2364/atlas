// Chargement et interrogation de l'index vectoriel local (data/index-vectoriel.json).
//
// Ce module remplace la recherche `atlas_rag_rechercher_passages` de Supabase.
// Il n'y a plus ni base, ni réseau, ni clé : l'index est un fichier versionné au
// dépôt, importé comme les JSON de fiches, et la recherche sur 2 855 vecteurs se
// fait en mémoire en quelques millisecondes.
//
// Ce que le fichier contient — et ce qu'il ne contient PAS
// --------------------------------------------------------
// Il contient des clés de passage, des empreintes de contenu et des vecteurs
// quantifiés. Il ne contient AUCUN texte : les textes sont reconstruits ici
// depuis `lib/corpus.ts` par `lib/passages-corpus.mjs`, le même module que celui
// qu'utilise l'indexeur. Trois conséquences voulues :
//   1. le fichier reste petit (693 Ko au lieu de ~2 Mo) et son diff git ne
//      duplique pas le corpus ;
//   2. un passage affiché vient forcément du corpus courant : il ne PEUT pas
//      pointer vers une fiche disparue, puisqu'il est reconstruit depuis elle ;
//   3. un décalage entre l'index et le corpus est détectable — l'empreinte du
//      texte reconstruit doit correspondre à celle enregistrée — et il est
//      signalé au lecteur au lieu de passer inaperçu.
//
// Module serveur : il importe l'index et tout le corpus. Ne jamais l'importer
// depuis un composant "use client".

import indexBrut from "@/data/index-vectoriel.json";
import { fichesGap, fichesHumaines, fichesIA } from "@/lib/corpus";
import { construirePassages, clePassage, empreintePassage } from "@/lib/passages-corpus.mjs";
import { MODELE_LEXICAL, construireLexique, poidsCreux, termes } from "@/lib/embedding-lexical.mjs";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type TypeFicheRag = "humaine" | "ia" | "gap";

export interface PassageIndexe {
  type_fiche: TypeFicheRag;
  fiche_id: string;
  champ: string;
  titre_fiche: string;
  texte: string;
  metadonnees: Record<string, unknown>;
}

export interface ResultatRecherche {
  passage: PassageIndexe;
  similarite: number;
  /** Termes distincts de la question réellement retrouvés dans ce passage. */
  termes_apparies: number;
}

export interface EtatIndex {
  /** Faux si le fichier est absent, illisible, ou d'une version inconnue. */
  present: boolean;
  modele_embedding: string;
  representation: "creuse-int8" | "dense-int8";
  lexical: boolean;
  dimension: number;
  genere_le: string;
  /** Passages produits par le corpus courant. */
  nb_passages_corpus: number;
  /** Passages du corpus qui ont bien un vecteur à jour. */
  nb_passages_indexes: number;
  /** Passages du corpus absents de l'index (indexation à relancer). */
  nb_passages_absents: number;
  /** Passages dont le texte a changé depuis l'indexation (vecteur périmé). */
  nb_passages_perimes: number;
  /** Entrées de l'index qui ne correspondent plus à aucun passage du corpus. */
  nb_entrees_orphelines: number;
}

interface FichierIndex {
  version: number;
  genere_le: string;
  modele_embedding: string;
  representation: string;
  dimension: number;
  nb_passages: number;
  nb_postings: number;
  lexique: { nb_documents: number; longueur_moyenne: number; termes: string; df: number[] } | null;
  cles: string[];
  empreintes: string[];
  offsets: number[] | null;
  indices_b64: string | null;
  poids_b64: string | null;
}

/** Version de format acceptée. Un écart ⇒ index ignoré, moteur en mode « index absent ». */
const VERSION_FORMAT = 1;

/** Longueur d'empreinte conservée dans le fichier — doit suivre l'indexeur. */
const LONGUEUR_EMPREINTE = 16;

/* -------------------------------------------------------------------------- */
/* Chargement (une seule fois par processus)                                  */
/* -------------------------------------------------------------------------- */

interface IndexCharge {
  fichier: FichierIndex | null;
  /** Passages du corpus courant, dans l'ordre du fichier d'index. */
  passages: PassageIndexe[];
  /** Poids quantifiés, par passage : indices de terme (index creux) ou dimensions (dense). */
  indices: Uint16Array | null;
  poids: Int8Array | null;
  offsets: Int32Array | null;
  /** Norme euclidienne de chaque vecteur, précalculée. */
  normes: Float64Array;
  /** Rang de chaque terme du lexique, pour vectoriser une question. */
  rangTerme: Map<string, number>;
  lexique: { nb_documents: number; longueur_moyenne: number; df: Map<string, number> } | null;
  etat: EtatIndex;
}

let cache: IndexCharge | null = null;

function etatVide(raison: Partial<EtatIndex> = {}): EtatIndex {
  return {
    present: false,
    modele_embedding: MODELE_LEXICAL,
    representation: "creuse-int8",
    lexical: true,
    dimension: 0,
    genere_le: "",
    nb_passages_corpus: 0,
    nb_passages_indexes: 0,
    nb_passages_absents: 0,
    nb_passages_perimes: 0,
    nb_entrees_orphelines: 0,
    ...raison,
  };
}

function charger(): IndexCharge {
  if (cache) return cache;

  const passagesCorpus = construirePassages({
    humaines: fichesHumaines,
    ia: fichesIA,
    gap: fichesGap,
  }) as PassageIndexe[];

  const fichier = indexBrut as unknown as FichierIndex;
  const utilisable =
    fichier &&
    fichier.version === VERSION_FORMAT &&
    Array.isArray(fichier.cles) &&
    Array.isArray(fichier.empreintes) &&
    typeof fichier.poids_b64 === "string";

  if (!utilisable) {
    cache = {
      fichier: null,
      passages: [],
      indices: null,
      poids: null,
      offsets: null,
      normes: new Float64Array(0),
      rangTerme: new Map(),
      lexique: null,
      etat: etatVide({ nb_passages_corpus: passagesCorpus.length, nb_passages_absents: passagesCorpus.length }),
    };
    return cache;
  }

  // Passages du corpus courant, indexés par clé naturelle.
  const parCle = new Map<string, PassageIndexe>();
  for (const passage of passagesCorpus) parCle.set(clePassage(passage), passage);

  const creux = fichier.representation === "creuse-int8";
  const poidsBruts = new Int8Array(decoder(fichier.poids_b64 as string, 1));
  const indicesBruts = creux && fichier.indices_b64 ? new Uint16Array(decoder(fichier.indices_b64, 2)) : null;
  const offsetsBruts = creux && fichier.offsets ? Int32Array.from(fichier.offsets) : null;

  // On ne retient QUE les entrées dont le passage existe encore ET dont le texte
  // n'a pas bougé. Le reste est compté et signalé, jamais servi : c'est le
  // garde-fou qui rend impossible d'afficher une source pointant vers une fiche
  // disparue, ou un extrait dont le texte ne correspond plus à son vecteur.
  const passages: PassageIndexe[] = [];
  const indices: number[] = [];
  const poids: number[] = [];
  const offsets: number[] = [0];
  let orphelines = 0;
  let perimes = 0;
  const vues = new Set<string>();

  for (let i = 0; i < fichier.cles.length; i += 1) {
    const cle = fichier.cles[i];
    const passage = parCle.get(cle);
    if (!passage) {
      orphelines += 1;
      continue;
    }
    const attendue = empreintePassage(passage.texte, fichier.modele_embedding).slice(0, LONGUEUR_EMPREINTE);
    if (attendue !== fichier.empreintes[i]) {
      perimes += 1;
      continue;
    }
    vues.add(cle);
    passages.push(passage);
    if (creux && offsetsBruts && indicesBruts) {
      for (let k = offsetsBruts[i]; k < offsetsBruts[i + 1]; k += 1) {
        indices.push(indicesBruts[k]);
        poids.push(poidsBruts[k]);
      }
    } else {
      for (let d = 0; d < fichier.dimension; d += 1) poids.push(poidsBruts[i * fichier.dimension + d]);
    }
    offsets.push(poids.length);
  }

  const poidsCompacts = Int8Array.from(poids);
  const indicesCompacts = creux ? Uint16Array.from(indices) : null;
  const offsetsCompacts = Int32Array.from(offsets);

  const normes = new Float64Array(passages.length);
  for (let i = 0; i < passages.length; i += 1) {
    let total = 0;
    for (let k = offsetsCompacts[i]; k < offsetsCompacts[i + 1]; k += 1) total += poidsCompacts[k] * poidsCompacts[k];
    normes[i] = Math.sqrt(total);
  }

  // Lexique : il voyage avec l'index parce que l'IDF d'une question doit être
  // calculée avec EXACTEMENT les fréquences qui ont servi à pondérer les
  // passages. Le recalculer ici depuis le corpus donnerait des poids différents
  // dès qu'une fiche a bougé sans réindexation.
  let lexique: IndexCharge["lexique"] = null;
  const rangTerme = new Map<string, number>();
  if (creux && fichier.lexique) {
    const listeTermes = fichier.lexique.termes.length > 0 ? fichier.lexique.termes.split(" ") : [];
    const df = new Map<string, number>();
    for (let i = 0; i < listeTermes.length; i += 1) {
      rangTerme.set(listeTermes[i], i);
      df.set(listeTermes[i], fichier.lexique.df[i] ?? 1);
    }
    lexique = {
      nb_documents: fichier.lexique.nb_documents,
      longueur_moyenne: fichier.lexique.longueur_moyenne,
      df,
    };
  }

  cache = {
    fichier,
    passages,
    indices: indicesCompacts,
    poids: poidsCompacts,
    offsets: offsetsCompacts,
    normes,
    rangTerme,
    lexique,
    etat: {
      present: true,
      modele_embedding: fichier.modele_embedding,
      representation: creux ? "creuse-int8" : "dense-int8",
      lexical: creux,
      dimension: fichier.dimension,
      genere_le: fichier.genere_le,
      nb_passages_corpus: passagesCorpus.length,
      nb_passages_indexes: passages.length,
      nb_passages_absents: passagesCorpus.length - vues.size,
      nb_passages_perimes: perimes,
      nb_entrees_orphelines: orphelines,
    },
  };
  return cache;
}

/** Décode une chaîne base64 en ArrayBuffer aligné sur `octetsParElement`. */
function decoder(base64: string, octetsParElement: number): ArrayBuffer {
  const tampon = Buffer.from(base64, "base64");
  // `Buffer` peut être une vue sur un pool partagé : on copie pour obtenir un
  // ArrayBuffer dont l'offset est nul, sans quoi la vue typée serait décalée.
  const copie = new ArrayBuffer(tampon.byteLength - (tampon.byteLength % octetsParElement));
  new Uint8Array(copie).set(tampon.subarray(0, copie.byteLength));
  return copie;
}

/** État de l'index — pour le diagnostic de la route et les avertissements affichés. */
export function etatIndex(): EtatIndex {
  return charger().etat;
}

/** Le corpus courant produit-il exactement ce que l'index contient ? */
export function indexAJour(): boolean {
  const etat = charger().etat;
  return etat.present && etat.nb_passages_absents === 0 && etat.nb_passages_perimes === 0 && etat.nb_entrees_orphelines === 0;
}

/* -------------------------------------------------------------------------- */
/* Recherche                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Recherche LEXICALE : la question est vectorisée avec le lexique de l'index,
 * puis comparée par cosinus à chaque passage. Coût mesuré : ~3 ms pour 2 855
 * passages, sans allocation par passage.
 */
export function rechercherLexical(question: string, seuil: number, limite: number): ResultatRecherche[] {
  const index = charger();
  if (!index.fichier || !index.lexique || !index.indices || !index.poids || !index.offsets) return [];

  const poidsQuestion = poidsCreux(question, index.lexique, true) as Map<string, number>;

  // Vecteur de question projeté sur les rangs de termes de l'index : un tableau
  // dense de 7 436 flottants coûte moins qu'une Map interrogée 106 000 fois.
  const parRang = new Float64Array(index.fichier.dimension);
  let normeQuestion = 0;
  let nbTermesQuestion = 0;
  for (const [terme, poids] of poidsQuestion) {
    nbTermesQuestion += 1;
    const rang = index.rangTerme.get(terme);
    // Un terme absent du lexique compte quand même dans la norme de la question :
    // une question dont un seul mot sur six est connu du corpus DOIT obtenir une
    // similarité basse. C'est ce qui sépare « le bien-vivre est-il mesurable »
    // (0,20) de « quelle est la recette du kouign-amann » (0,12).
    normeQuestion += poids * poids;
    if (rang !== undefined) parRang[rang] = poids;
  }
  normeQuestion = Math.sqrt(normeQuestion);
  if (normeQuestion === 0 || nbTermesQuestion === 0) return [];

  const resultats: ResultatRecherche[] = [];
  for (let i = 0; i < index.passages.length; i += 1) {
    let produit = 0;
    let apparies = 0;
    for (let k = index.offsets[i]; k < index.offsets[i + 1]; k += 1) {
      const poidsRequete = parRang[index.indices[k]];
      if (poidsRequete !== 0) {
        produit += poidsRequete * index.poids[k];
        apparies += 1;
      }
    }
    if (produit === 0) continue;
    const similarite = produit / (normeQuestion * index.normes[i]);
    if (similarite < seuil) continue;
    resultats.push({ passage: index.passages[i], similarite, termes_apparies: apparies });
  }

  resultats.sort((a, b) => b.similarite - a.similarite);
  return resultats.slice(0, limite);
}

/**
 * Recherche DENSE : utilisée quand l'index a été construit par un fournisseur
 * d'embeddings. Le vecteur de la question vient du même fournisseur.
 *
 * `termes_apparies` est renseigné lexicalement, à titre indicatif seulement : le
 * garde-fou correspondant ne s'applique pas au mode dense, où deux textes
 * peuvent légitimement ne partager aucun mot.
 */
export function rechercherDense(
  vecteur: number[],
  question: string,
  seuil: number,
  limite: number
): ResultatRecherche[] {
  const index = charger();
  if (!index.fichier || !index.poids || !index.offsets || index.fichier.representation !== "dense-int8") return [];
  const dimension = index.fichier.dimension;
  if (vecteur.length !== dimension) return [];

  let normeQuestion = 0;
  for (const valeur of vecteur) normeQuestion += valeur * valeur;
  normeQuestion = Math.sqrt(normeQuestion);
  if (normeQuestion === 0) return [];

  const motsQuestion = new Set(termes(question) as string[]);
  const resultats: ResultatRecherche[] = [];
  for (let i = 0; i < index.passages.length; i += 1) {
    let produit = 0;
    const debut = index.offsets[i];
    for (let d = 0; d < dimension; d += 1) produit += vecteur[d] * index.poids[debut + d];
    const similarite = produit / (normeQuestion * index.normes[i]);
    if (similarite < seuil) continue;
    const motsPassage = new Set(termes(index.passages[i].texte) as string[]);
    let apparies = 0;
    for (const mot of motsQuestion) if (motsPassage.has(mot)) apparies += 1;
    resultats.push({ passage: index.passages[i], similarite, termes_apparies: apparies });
  }
  resultats.sort((a, b) => b.similarite - a.similarite);
  return resultats.slice(0, limite);
}

/**
 * Recalcule le lexique depuis le corpus courant, sans passer par l'index.
 * Utilisé nulle part en production — exposé pour les diagnostics et les tests.
 */
export function lexiqueDuCorpus() {
  return construireLexique(
    construirePassages({ humaines: fichesHumaines, ia: fichesIA, gap: fichesGap }) as PassageIndexe[]
  );
}

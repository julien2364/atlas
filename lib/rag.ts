// Moteur de réponse prédictive (MP-4 / Lot 6 du mégaprompt, section 7.3).
//
// Ce module orchestre la chaîne complète : recherche dans l'index local,
// garde-fous, génération, validation. La route app/api/question/route.ts se
// contente de le transporter en HTTP.
//
// Refonte du 07/09/2026 — ce qui a changé, et ce qui n'a pas bougé
// ----------------------------------------------------------------
// A CHANGÉ le STOCKAGE : l'index vectoriel ne vit plus dans Supabase mais dans
// `data/index-vectoriel.json`, versionné au dépôt et chargé par
// `lib/index-vectoriel.ts`. Aucune base, aucune clé, aucun appel réseau pour
// chercher. Le chemin Supabase reste documenté comme option de montée en charge
// (supabase/schema.sql, lib/supabase.ts) — cf. docs/moteur-reponse-local.md §7.
//
// A CHANGÉ la GÉNÉRATION : trois modes au lieu d'un seul fournisseur imposé.
//   1. fournisseur d'API — plusieurs, derrière une interface unique, essayés
//      dans l'ordre (lib/fournisseurs-generation.ts) ;
//   2. prompt à copier / résultat à recoller — aucune clé, l'utilisateur fait
//      l'aller-retour lui-même (lib/analyse-sortie.ts pour le retour) ;
//   3. réponse extractive, composée depuis les fiches, sans aucun modèle
//      (lib/reponse-extractive.ts). Marche toujours, ne peut rien halluciner.
//
// N'A PAS BOUGÉ, et c'est délibéré : le découpage en passages, l'empreinte de
// contenu, les seuils, les plafonds, le cache, et surtout les REFUS. Le moteur
// qui refuse de répondre quand le corpus ne suit pas est ce qui a été éprouvé le
// 06/09 (sept défauts trouvés et corrigés, cf. docs/rag-mise-en-route-et-cout.md) :
// cette logique est reprise telle quelle.
//
// ⚠️ Module strictement serveur : il lit des clés d'API et importe tout le
// corpus. Ne jamais l'importer depuis un composant "use client".
//
// Principe directeur, non négociable (mégaprompt §2.1 et §10) : la sortie est
// une LISTE DE PERSPECTIVES, jamais un verdict unique. Quatre mécanismes le
// garantissent, quel que soit le mode :
//   1. le schéma de sortie impose un tableau `perspectives` (minItems), et une
//      réponse à perspective unique est signalée dans `avertissements` ;
//   2. la consigne système interdit explicitement la synthèse surplombante ;
//   3. les sources ne sont PAS produites par le modèle : elles sont
//      reconstruites depuis `lib/sources-corpus.ts` à partir des identifiants de
//      fiches réellement remontés par la recherche ;
//   4. le mode extractif ne produit aucun texte de fond — il recopie des champs.

import { createHash } from "node:crypto";
import type { NiveauConfiance, Perspective, Source } from "@/lib/types";
import { derniereMiseAJourCorpus, fichesGap, fichesHumaines, fichesIA } from "@/lib/corpus";
import {
  dedupliquerSources,
  resoudreFiche,
  sourcesDeFiche,
  type TypeFicheRag,
} from "@/lib/sources-corpus";
import {
  etatIndex,
  rechercherDense,
  rechercherLexical,
  type ResultatRecherche,
} from "@/lib/index-vectoriel";
import { MODELE_LEXICAL } from "@/lib/embedding-lexical.mjs";
import { configEmbeddings, embedderLotDistant } from "@/lib/embeddings-fournisseur.mjs";
import {
  appelerFournisseur,
  fournisseursActifs,
  FOURNISSEURS,
  type ContratGeneration,
  type FournisseurActif,
} from "@/lib/fournisseurs-generation";
import { analyserSortie, type SortieBrute } from "@/lib/analyse-sortie";
import { construireReponseExtractive, type PassagePourExtraction } from "@/lib/reponse-extractive";

export type { TypeFicheRag };

/* -------------------------------------------------------------------------- */
/* Réglages                                                                   */
/* -------------------------------------------------------------------------- */

/** Lit un entier d'environnement en restant dans des bornes sûres. */
function entierEnv(nom: string, defaut: number, min: number, max: number): number {
  const brut = process.env[nom];
  if (!brut) return defaut;
  const valeur = Number.parseInt(brut, 10);
  if (!Number.isFinite(valeur)) return defaut;
  return Math.min(max, Math.max(min, valeur));
}

function nombreEnv(nom: string, defaut: number, min: number, max: number): number {
  const brut = process.env[nom];
  if (!brut) return defaut;
  const valeur = Number.parseFloat(brut);
  if (!Number.isFinite(valeur)) return defaut;
  return Math.min(max, Math.max(min, valeur));
}

/** Modèle d'embedding réellement employé — lu dans l'index, pas deviné. */
export const MODELE_EMBEDDING = etatIndex().present ? etatIndex().modele_embedding : MODELE_LEXICAL;

/**
 * Seuil de similarité en dessous duquel un passage est jugé hors sujet.
 *
 * RECALIBRÉ le 07/09/2026 (0,35 → 0,08). Ce n'est pas un assouplissement : les
 * anciennes valeurs étaient calées sur l'échelle d'un embedding sémantique, qui
 * n'est pas celle d'un cosinus BM25. Mesuré sur les 9 questions-tests, la
 * similarité du meilleur passage va de 0,169 à 0,438 ; sur six questions
 * volontairement hors périmètre, elle plafonne à 0,145. Les deux valeurs
 * ci-dessous se lisent dans ce tableau, reproductible par
 * `node scripts/indexer-corpus.mjs --mesurer`.
 */
export const SEUIL_SIMILARITE = nombreEnv("ATLAS_RAG_SEUIL_SIMILARITE", 0.08, 0, 1);

/** Similarité minimale du MEILLEUR passage pour qu'on accepte de répondre. */
export const SEUIL_PERTINENCE = nombreEnv("ATLAS_RAG_SEUIL_PERTINENCE", 0.15, 0, 1);

/** Nombre minimal de passages pertinents exigé avant toute génération. */
export const MIN_PASSAGES = entierEnv("ATLAS_RAG_MIN_PASSAGES", 3, 1, 20);

/**
 * Termes distincts de la question qu'un passage doit au moins retrouver.
 *
 * Second garde-fou, propre à la recherche lexicale, et le plus discriminant des
 * deux : sur les six questions hors périmètre testées, AUCUN passage ne retrouve
 * plus d'un terme de la question, alors que les neuf questions-tests en
 * retrouvent toutes au moins deux. Une similarité seule ne sépare pas aussi
 * nettement (0,145 contre 0,169). Sans objet en mode dense, où deux textes
 * peuvent légitimement ne partager aucun mot.
 */
export const MIN_TERMES_APPARIES = entierEnv("ATLAS_RAG_MIN_TERMES", 2, 1, 10);

/** Plafond de passages injectés dans le contexte (borne de coût n°1). */
export const MAX_PASSAGES = entierEnv("ATLAS_RAG_MAX_PASSAGES", 18, 3, 60);

/** Plafond de caractères du contexte, indépendant du nombre de passages. */
export const MAX_CARACTERES_CONTEXTE = entierEnv("ATLAS_RAG_MAX_CARACTERES", 18_000, 2_000, 60_000);

/** Plafond de tokens de sortie d'un fournisseur (borne de coût n°2). */
export const MAX_TOKENS_REPONSE = entierEnv("ATLAS_RAG_MAX_TOKENS", 2_600, 500, 8_000);

/** Durée de vie d'une entrée de cache, en heures (30 jours par défaut). */
export const CACHE_TTL_HEURES = entierEnv("ATLAS_RAG_CACHE_TTL_HEURES", 720, 1, 8_760);

/** Nombre d'entrées gardées en cache mémoire (borne de coût n°3). */
const CACHE_MAX_ENTREES = entierEnv("ATLAS_RAG_CACHE_ENTREES", 200, 10, 5_000);

/** Longueurs acceptées pour une question posée par un visiteur. */
export const QUESTION_MIN = 10;
export const QUESTION_MAX = 400;

/** Nombre maximal de sources affichées par perspective (lisibilité). */
const MAX_SOURCES_PAR_PERSPECTIVE = 6;

/** Délai maximal d'un appel réseau sortant, en millisecondes. */
const DELAI_MAX_MS = entierEnv("ATLAS_RAG_TIMEOUT_MS", 45_000, 5_000, 120_000);

const NIVEAUX_CONFIANCE: NiveauConfiance[] = [
  "fait_verifie",
  "consensus_scientifique",
  "opinion_majoritaire",
  "hypothese_prospective",
];

/* -------------------------------------------------------------------------- */
/* Types de sortie                                                            */
/* -------------------------------------------------------------------------- */

/** Mode de génération réellement employé pour la réponse affichée. */
export type ModeReponse = "fournisseur" | "prompt" | "extractif";

/** Mode demandé par l'appelant. « auto » = fournisseurs puis repli extractif. */
export type ModeDemande = "auto" | ModeReponse;

const MODES_DEMANDES: ModeDemande[] = ["auto", "fournisseur", "prompt", "extractif"];

export const LIBELLES_MODE: Record<ModeReponse, string> = {
  fournisseur: "Réponse rédigée par un fournisseur d'API",
  prompt: "Réponse rédigée hors du site, recollée puis relue ici",
  extractif: "Réponse extractive, composée depuis les fiches, sans modèle génératif",
};

/** Un extrait du corpus réellement mobilisé, affiché tel quel au lecteur. */
export interface PassageMobilise {
  type_fiche: TypeFicheRag;
  fiche_id: string;
  champ: string;
  titre_fiche: string;
  extrait: string;
  similarite: number;
  url: string | null;
}

/** Fiche du corpus mobilisée par la réponse (bloc « sources » de l'interface). */
export interface FicheMobilisee {
  id: string;
  type: TypeFicheRag;
  nom: string;
  url: string;
  champs: string[];
  similarite_max: number;
}

export interface DiagnosticReponse {
  statut: "repondue" | "hors_corpus" | "corpus_vide" | "prompt_a_coller";
  mode: ModeReponse | null;
  mode_libelle: string;
  fournisseur: string | null;
  similarite_max: number;
  nb_passages_trouves: number;
  nb_passages_utilises: number;
  termes_apparies_max: number;
  seuil_similarite: number;
  seuil_pertinence: number;
  modele_embedding: string;
  modele_reponse: string | null;
  tokens_entree: number;
  tokens_sortie: number;
  depuis_cache: boolean;
  genere_le: string;
  corpus_maj: string;
}

export interface ReponseQuestion {
  question: string;
  /** Reformulation de la question par le moteur (étape 1 du gabarit §7.3). */
  reformulation: string;
  /** Vide quand `diagnostic.statut !== "repondue"` — le moteur refuse de répondre. */
  perspectives: Perspective[];
  /** Ce que la réponse ne couvre pas (étape 5 du gabarit §7.3). */
  angles_morts: string;
  passages_mobilises: PassageMobilise[];
  fiches_mobilisees: FicheMobilisee[];
  /** Messages honnêtes destinés au lecteur (pluralisme insuffisant, index en retard…). */
  avertissements: string[];
  /** Rempli quand le moteur refuse de répondre, ou quand le collage a échoué. */
  message?: string;
  /** Prompt prêt à copier (mode 2), joint aussi aux réponses extractives. */
  prompt_a_copier?: string;
  diagnostic: DiagnosticReponse;
}

/** Erreur de configuration ou de fournisseur : traduite en 5xx par la route. */
export class ErreurRag extends Error {
  readonly code: "configuration" | "fournisseur" | "index";
  readonly statut: 500 | 502 | 503;

  constructor(code: "configuration" | "fournisseur" | "index", message: string, statut: 500 | 502 | 503) {
    super(message);
    this.name = "ErreurRag";
    this.code = code;
    this.statut = statut;
  }
}

/* -------------------------------------------------------------------------- */
/* Normalisation et empreintes                                                */
/* -------------------------------------------------------------------------- */

/**
 * Normalise une question pour le cache : minuscules, sans accents, sans
 * ponctuation, espaces réduits. « Le capitalisme est-il optimal ? » et
 * « le capitalisme est il optimal » partagent ainsi la même entrée.
 */
export function normaliserQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** SHA-256 hexadécimal — même fonction que celle de scripts/indexer-corpus.mjs. */
export function empreinte(texte: string): string {
  return createHash("sha256").update(texte, "utf8").digest("hex");
}

/**
 * Clé de cache. Elle inclut le mode, le modèle ET TOUS les réglages qui changent
 * la réponse : changer l'un d'eux doit produire une NOUVELLE réponse, pas
 * resservir l'ancienne en prétendant qu'elle vient du nouveau réglage.
 *
 * Les seuils en font partie, et ce n'est pas un détail : la méthode de réglage
 * documentée consiste précisément à poser les mêmes questions en faisant varier
 * `ATLAS_RAG_SEUIL_PERTINENCE`. Sans les seuils dans la clé, la deuxième mesure
 * resservait la réponse de la première et l'auteur réglait à l'aveugle.
 */
export function empreinteCache(question: string, mode: ModeDemande): string {
  return empreinte(
    [
      normaliserQuestion(question),
      mode,
      MODELE_EMBEDDING,
      String(MAX_PASSAGES),
      String(MAX_CARACTERES_CONTEXTE),
      String(SEUIL_SIMILARITE),
      String(SEUIL_PERTINENCE),
      String(MIN_PASSAGES),
      String(MIN_TERMES_APPARIES),
      "v3",
    ].join("|")
  );
}

/** Contrôle de la saisie visiteur. Rend un message d'erreur en français, ou null. */
export function validerQuestion(brut: unknown): { question: string } | { erreur: string } {
  if (typeof brut !== "string") {
    return { erreur: "Le champ « question » est obligatoire et doit être une chaîne de caractères." };
  }
  const question = brut.replace(/\s+/g, " ").trim();
  if (question.length < QUESTION_MIN) {
    return { erreur: `Question trop courte : ${QUESTION_MIN} caractères minimum.` };
  }
  if (question.length > QUESTION_MAX) {
    return { erreur: `Question trop longue : ${QUESTION_MAX} caractères maximum.` };
  }
  return { question };
}

/** Contrôle du mode demandé. Un mode inconnu retombe sur « auto ». */
export function validerMode(brut: unknown): ModeDemande {
  return typeof brut === "string" && (MODES_DEMANDES as string[]).includes(brut) ? (brut as ModeDemande) : "auto";
}

/* -------------------------------------------------------------------------- */
/* Étape 1 — recherche                                                        */
/* -------------------------------------------------------------------------- */

/** Passage remonté par la recherche, forme interne du pipeline. */
interface LignePassage {
  type_fiche: TypeFicheRag;
  fiche_id: string;
  champ: string;
  titre_fiche: string;
  texte: string;
  metadonnees: Record<string, unknown>;
  similarite: number;
  termes_apparies: number;
}

function versLigne(resultat: ResultatRecherche): LignePassage {
  return {
    type_fiche: resultat.passage.type_fiche,
    fiche_id: resultat.passage.fiche_id,
    champ: resultat.passage.champ,
    titre_fiche: resultat.passage.titre_fiche,
    texte: resultat.passage.texte,
    metadonnees: resultat.passage.metadonnees,
    similarite: resultat.similarite,
    termes_apparies: resultat.termes_apparies,
  };
}

/**
 * Cherche dans l'index local. Aucun appel réseau quand l'index est lexical —
 * c'est le cas par défaut. Avec un index construit par un fournisseur
 * d'embeddings, la question doit être vectorisée par le MÊME fournisseur, sans
 * quoi on comparerait deux espaces vectoriels sans rapport.
 */
export async function rechercherPassages(question: string): Promise<LignePassage[]> {
  const etat = etatIndex();
  if (!etat.present) {
    throw new ErreurRag(
      "index",
      "Index vectoriel absent ou illisible (data/index-vectoriel.json). Lancer `npm run indexer` — " +
        "l'opération ne demande aucune clé et prend moins d'une seconde.",
      503
    );
  }

  // On demande plus que le plafond de contexte : le filtrage par fiche
  // (au plus 2 passages de la même fiche) élague ensuite la liste.
  const limite = Math.min(200, MAX_PASSAGES * 6);

  if (etat.lexical) {
    return rechercherLexical(question, SEUIL_SIMILARITE, limite).map(versLigne);
  }

  const config = configEmbeddings();
  if (!config) {
    throw new ErreurRag(
      "configuration",
      `L'index a été construit avec « ${etat.modele_embedding} », mais aucune clé d'embeddings n'est ` +
        "configurée pour vectoriser la question. Poser la clé, ou relancer `npm run indexer` sans clé " +
        "pour reconstruire un index lexical local.",
      503
    );
  }
  const resultat = await embedderLotDistant([question], config, "requete", { delaiMs: DELAI_MAX_MS });
  if ("erreur" in resultat) {
    throw new ErreurRag("fournisseur", `Vectorisation de la question impossible : ${resultat.erreur}`, 502);
  }
  return rechercherDense(resultat.vecteurs[0], question, SEUIL_SIMILARITE, limite).map(versLigne);
}

/**
 * Sélectionne les passages injectés dans le contexte.
 * Deux règles, toutes deux importantes :
 *   - au plus 2 passages par fiche : sans cela une seule fiche bavarde monopolise
 *     le contexte et le moteur ne voit plus qu'une école de pensée, ce qui
 *     détruit mécaniquement le pluralisme de la réponse ;
 *   - double plafond nombre + caractères, pour que le coût d'entrée soit borné
 *     même si le corpus contient un jour des champs beaucoup plus longs.
 */
export function selectionnerPassages(lignes: LignePassage[]): LignePassage[] {
  const parFiche = new Map<string, number>();
  const retenus: LignePassage[] = [];
  let caracteres = 0;

  for (const ligne of lignes) {
    if (retenus.length >= MAX_PASSAGES) break;
    const cle = `${ligne.type_fiche}:${ligne.fiche_id}`;
    const dejaPris = parFiche.get(cle) ?? 0;
    if (dejaPris >= 2) continue;
    // On mesure l'extrait TEL QU'IL SERA ENVOYÉ (en-tête d'ancrage compris), et
    // non le seul champ `texte` : l'en-tête pèse ~15 % du bloc, et le compter
    // pour zéro faisait dépasser le plafond de contexte d'autant. Un plafond de
    // coût qui ne borne pas ce qui part réellement au modèle ne borne rien.
    const taille = rendreExtrait(ligne, retenus.length).length + SEPARATEUR_EXTRAITS.length;
    if (caracteres + taille > MAX_CARACTERES_CONTEXTE && retenus.length > 0) break;
    parFiche.set(cle, dejaPris + 1);
    caracteres += taille;
    retenus.push(ligne);
  }
  return retenus;
}

/* -------------------------------------------------------------------------- */
/* Étape 2 — construction du contexte                                         */
/* -------------------------------------------------------------------------- */

const LIBELLES_TYPE: Record<TypeFicheRag, string> = {
  humaine: "Référentiel A (capacité humaine)",
  ia: "Référentiel B (capacité IA)",
  gap: "Fiche de gap analysis (humain × IA)",
};

const SEPARATEUR_EXTRAITS = "\n\n";

/**
 * Rend UN extrait tel qu'il partira au modèle. Isolé de `construireContexte`
 * pour que `selectionnerPassages` puisse mesurer exactement ce qu'il retient,
 * sans réimplémenter (et donc sans risquer de désynchroniser) le format.
 */
function rendreExtrait(p: LignePassage, index: number): string {
  const meta = p.metadonnees ?? {};
  const complements = [
    typeof meta.axe === "string" ? `axe: ${meta.axe}` : null,
    typeof meta.sous_domaine === "string" ? `sous-domaine: ${meta.sous_domaine}` : null,
    typeof meta.substituabilite === "string" ? `substituabilité: ${meta.substituabilite}` : null,
    typeof meta.derniere_verification === "string" ? `vérifié le ${meta.derniere_verification}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    `[EXTRAIT ${index + 1}]`,
    `type: ${LIBELLES_TYPE[p.type_fiche]}`,
    `fiche_id: ${p.fiche_id}`,
    `fiche: ${p.titre_fiche}`,
    `champ: ${p.champ}`,
    complements ? `contexte: ${complements}` : null,
    `similarité: ${p.similarite.toFixed(3)}`,
    `texte: ${p.texte}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Le contexte est un bloc balisé, un passage par entrée, chaque entrée portant
 * son identifiant de fiche. C'est cet identifiant que le modèle devra citer :
 * il ne peut donc désigner qu'une fiche réellement présente dans le contexte.
 */
export function construireContexte(passages: LignePassage[]): string {
  return passages.map((p, i) => rendreExtrait(p, i)).join(SEPARATEUR_EXTRAITS);
}

/* -------------------------------------------------------------------------- */
/* Le CONTRAT de réponse — commun aux trois modes                             */
/* -------------------------------------------------------------------------- */

export const CONSIGNE_SYSTEME = `Tu es ATLAS, moteur de réponse de l'observatoire « Atlas Humain × IA ».

RÈGLE ABSOLUE — NEUTRALITÉ ACTIVE. Sur toute question politique, économique,
philosophique ou psychologique, plusieurs écoles s'opposent légitimement. Tu ne
tranches JAMAIS. Tu exposes chaque école avec le poids réel de ses arguments, et
tu ne produis aucune synthèse surplombante qui désignerait un gagnant. Une
réponse à une seule perspective est un échec, sauf question purement factuelle.

TU NE RÉPONDS QU'À PARTIR DES EXTRAITS FOURNIS. Tu n'ajoutes aucun fait, aucun
chiffre et aucun nom d'auteur qui ne figure pas dans les extraits. Si les
extraits ne suffisent pas à couvrir un aspect de la question, tu le dis dans le
champ « angles_morts » plutôt que de combler le trou.

DISTINCTION DES REGISTRES. Tu sépares toujours :
  - ce que les faits établis montrent (champ « etat_actuel ») ;
  - ce que le modèle de pensée en déduit (champ « reponse ») ;
  - pourquoi cette déduction tient (champ « justification ») ;
  - ce que ce modèle explique mal (champ « limites »).
Le niveau de confiance est choisi honnêtement : « fait_verifie » seulement pour
une donnée mesurée présente dans les extraits, « hypothese_prospective » dès
qu'il s'agit d'un scénario futur.

CITATION DES FICHES. Chaque perspective liste dans « fiches_mobilisees » les
identifiants (fiche_id) des extraits sur lesquels elle s'appuie, recopiés
exactement. N'invente jamais d'identifiant : seuls ceux du contexte sont admis.
Tu ne produis pas de bibliographie — les sources sont rattachées automatiquement
à partir de ces identifiants.

LANGUE. Français, style sobre et dense, pas de formules de politesse.`;

/**
 * Schéma de la sortie attendue. Il sert :
 *   - de schéma d'outil aux fournisseurs à sortie structurée (dialecte
 *     Anthropic), où il est imposé par `TOOL_CHOICE_REPONSE` ci-dessous ;
 *   - de schéma déclaré dans le message aux fournisseurs compatibles OpenAI ;
 *   - de gabarit inscrit dans le prompt à copier du mode 2.
 * Un seul schéma pour les trois : c'est ce qui rend les trois modes comparables.
 */
export const OUTIL_REPONSE = {
  name: "repondre_par_perspectives",
  description:
    "Rend la réponse structurée en perspectives concurrentes. Au moins deux perspectives dès que la question " +
    "est contestée (politique, économique, philosophique, psychologique).",
  input_schema: {
    type: "object" as const,
    properties: {
      reformulation: {
        type: "string",
        description: "Reformulation en une phrase de la question posée, telle que le moteur l'a comprise.",
      },
      perspectives: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        description:
          "Une entrée par école de pensée / cadre théorique en présence. Deux au minimum sur tout sujet contesté.",
        items: {
          type: "object",
          properties: {
            modele: { type: "string", description: "Nom de l'école ou du cadre théorique." },
            hypotheses: { type: "string", description: "Postulats de départ à accepter pour que la réponse tienne." },
            etat_actuel: { type: "string", description: "Faits établis présents dans les extraits, hors interprétation." },
            reponse: { type: "string", description: "Ce que ce modèle répond à la question." },
            justification: { type: "string", description: "Pourquoi cette réponse découle des hypothèses et des faits." },
            limites: { type: "string", description: "Ce que ce modèle n'explique pas ou explique mal." },
            niveau_confiance: {
              type: "string",
              enum: NIVEAUX_CONFIANCE,
              description: "fait_verifie | consensus_scientifique | opinion_majoritaire | hypothese_prospective",
            },
            fiches_mobilisees: {
              type: "array",
              items: { type: "string" },
              description: "Identifiants fiche_id, recopiés exactement depuis les extraits fournis.",
            },
          },
          required: [
            "modele",
            "hypotheses",
            "etat_actuel",
            "reponse",
            "justification",
            "limites",
            "niveau_confiance",
            "fiches_mobilisees",
          ],
        },
      },
      angles_morts: {
        type: "string",
        description: "Ce que le corpus ne couvre pas sur cette question, et ce que la réponse ne permet pas de conclure.",
      },
    },
    required: ["reformulation", "perspectives", "angles_morts"],
  },
};

/**
 * Forçage de la sortie structurée chez les fournisseurs qui savent le faire.
 * Passé tel quel dans le champ `tool_choice` de l'API : le modèle ne PEUT pas
 * répondre en prose libre, donc pas en verdict. Les fournisseurs compatibles
 * OpenAI n'offrent pas cette garantie — d'où l'analyse tolérante en aval.
 */
export const TOOL_CHOICE_REPONSE = { type: "tool", name: OUTIL_REPONSE.name } as const;

/** Message utilisateur envoyé au modèle (mode 1) ou copié par l'utilisateur (mode 2). */
function messageQuestion(question: string, contexte: string): string {
  return [
    `QUESTION POSÉE :\n${question}`,
    "",
    `EXTRAITS DU CORPUS ATLAS (${contexte.length} caractères, seuls éléments autorisés) :`,
    contexte,
    "",
    "Réponds en respectant strictement le gabarit demandé, et uniquement lui.",
  ].join("\n");
}

/**
 * Prompt COMPLET à copier (mode 2) : consigne système, question, extraits, et
 * le gabarit JSON exigé. Autonome par construction — il doit fonctionner collé
 * dans n'importe quelle interface de chat, sans rien d'autre.
 */
export function construirePromptACopier(question: string, contexte: string): string {
  return [
    CONSIGNE_SYSTEME,
    "",
    "─".repeat(72),
    "",
    messageQuestion(question, contexte),
    "",
    "─".repeat(72),
    "",
    "FORMAT DE SORTIE — impératif, il sera relu par un programme.",
    "Réponds UNIQUEMENT par un objet JSON valide, sans phrase d'introduction, sans",
    "commentaire, et sans bloc de code Markdown autour. Guillemets DROITS (\") uniquement.",
    "",
    "Gabarit exact :",
    JSON.stringify(
      {
        reformulation: "une phrase",
        perspectives: [
          {
            modele: "nom de l'école ou du cadre théorique",
            hypotheses: "postulats de départ",
            etat_actuel: "faits présents dans les extraits",
            reponse: "ce que ce modèle répond",
            justification: "pourquoi cette réponse découle des hypothèses",
            limites: "ce que ce modèle explique mal",
            niveau_confiance: NIVEAUX_CONFIANCE.join(" | "),
            fiches_mobilisees: ["fiche_id recopié depuis les extraits"],
          },
        ],
        angles_morts: "ce que les extraits ne permettent pas de conclure",
      },
      null,
      2
    ),
    "",
    "Deux perspectives au minimum, cinq au maximum. Les identifiants de",
    "« fiches_mobilisees » doivent être recopiés à l'identique depuis les extraits :",
    "tout identifiant inconnu sera ignoré et signalé au lecteur.",
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* Étape 3 — validation de la sortie et rattachement des sources réelles      */
/* -------------------------------------------------------------------------- */

function texteSur(valeur: unknown, defaut = ""): string {
  return typeof valeur === "string" && valeur.trim().length > 0 ? valeur.trim() : defaut;
}

/**
 * Transforme une sortie brute (fournisseur d'API ou texte recollé) en
 * `Perspective[]` conforme à lib/types.ts, en remplaçant les sources déclarées
 * par les sources RÉELLES des fiches du corpus. C'est ici que se joue
 * l'anti-hallucination :
 *   - un identifiant absent des passages remontés est ignoré (le modèle ne peut
 *     pas faire entrer une fiche qu'il n'a pas vue) ;
 *   - une perspective qui se retrouve sans aucune source réelle est conservée
 *     mais son niveau de confiance est rabaissé et un avertissement est émis,
 *     plutôt que d'être affichée comme si elle était sourcée.
 *
 * Vaut aussi pour un texte COLLÉ par l'utilisateur : le collage ne franchit pas
 * cette étape s'il cite des fiches inventées.
 */
export function construirePerspectives(
  sortie: SortieBrute,
  passages: LignePassage[]
): { perspectives: Perspective[]; avertissements: string[] } {
  const avertissements: string[] = [];
  const brutes = Array.isArray(sortie.perspectives) ? sortie.perspectives : [];

  // Fiches réellement présentes dans le contexte, indexées par id.
  const autorisees = new Map<string, TypeFicheRag>();
  for (const p of passages) autorisees.set(p.fiche_id, p.type_fiche);

  // Repli de sourcing : les sources des trois fiches les mieux classées.
  const sourcesDeRepli = dedupliquerSources(
    passages.slice(0, 3).flatMap((p) => sourcesDeFiche(p.type_fiche, p.fiche_id))
  ).slice(0, MAX_SOURCES_PAR_PERSPECTIVE);

  const perspectives: Perspective[] = [];

  for (const brute of brutes) {
    if (typeof brute !== "object" || brute === null) continue;
    const objet = brute as Record<string, unknown>;

    const modele = texteSur(objet.modele);
    const reponse = texteSur(objet.reponse);
    // Une perspective sans nom d'école ni réponse n'a aucune valeur pour le lecteur.
    if (!modele || !reponse) continue;

    const idsDeclares = Array.isArray(objet.fiches_mobilisees)
      ? objet.fiches_mobilisees.filter((v): v is string => typeof v === "string")
      : [];
    const idsRetenus = idsDeclares.filter((id) => autorisees.has(id));
    const idsInventes = idsDeclares.filter((id) => !autorisees.has(id));
    if (idsInventes.length > 0) {
      avertissements.push(
        `Perspective « ${modele} » : ${idsInventes.length} identifiant(s) de fiche cité(s) hors du corpus remonté, ignoré(s).`
      );
    }

    let sources: Source[] = dedupliquerSources(
      idsRetenus.flatMap((id) => sourcesDeFiche(autorisees.get(id) as TypeFicheRag, id))
    ).slice(0, MAX_SOURCES_PAR_PERSPECTIVE);

    let niveau: NiveauConfiance = NIVEAUX_CONFIANCE.includes(objet.niveau_confiance as NiveauConfiance)
      ? (objet.niveau_confiance as NiveauConfiance)
      : "hypothese_prospective";

    if (sources.length === 0) {
      sources = sourcesDeRepli;
      niveau = "hypothese_prospective";
      avertissements.push(
        `Perspective « ${modele} » : aucune fiche du corpus n'a pu être rattachée ; confiance ramenée à « hypothèse prospective ».`
      );
    }

    perspectives.push({
      modele,
      hypotheses: texteSur(objet.hypotheses, "Non explicitées par le moteur."),
      etat_actuel: texteSur(objet.etat_actuel, "Non renseigné à partir des extraits mobilisés."),
      reponse,
      justification: texteSur(objet.justification, "Non explicitée par le moteur."),
      limites: texteSur(objet.limites, "Limites non explicitées — à considérer comme un angle mort de la réponse."),
      sources,
      niveau_confiance: niveau,
    });
  }

  if (perspectives.length === 1) {
    avertissements.push(
      "Une seule perspective a été produite : sur un sujet contesté, c'est en deçà de la règle de neutralité active " +
        "du projet (cf. /methodologie). À lire comme une lecture parmi d'autres, pas comme un verdict."
    );
  }

  return { perspectives, avertissements };
}

/** Regroupe les passages par fiche pour le bloc « sources » de l'interface. */
export function regrouperFiches(passages: LignePassage[]): FicheMobilisee[] {
  const index = new Map<string, FicheMobilisee>();
  for (const passage of passages) {
    const cle = `${passage.type_fiche}:${passage.fiche_id}`;
    const existante = index.get(cle);
    if (existante) {
      if (!existante.champs.includes(passage.champ)) existante.champs.push(passage.champ);
      existante.similarite_max = Math.max(existante.similarite_max, passage.similarite);
      continue;
    }
    const resolue = resoudreFiche(passage.type_fiche, passage.fiche_id);
    index.set(cle, {
      id: passage.fiche_id,
      type: passage.type_fiche,
      nom: resolue?.nom ?? (passage.titre_fiche || passage.fiche_id),
      url: resolue?.url ?? "",
      champs: [passage.champ],
      similarite_max: passage.similarite,
    });
  }
  return [...index.values()].sort((a, b) => b.similarite_max - a.similarite_max);
}

function versPassagesMobilises(passages: LignePassage[]): PassageMobilise[] {
  return passages.map((p) => {
    // Une seule résolution par passage : `resoudreFiche` fait une recherche
    // d'index et était appelée deux fois par ligne dans une version précédente.
    const resolue = resoudreFiche(p.type_fiche, p.fiche_id);
    return {
      type_fiche: p.type_fiche,
      fiche_id: p.fiche_id,
      champ: p.champ,
      titre_fiche: resolue?.nom ?? (p.titre_fiche || p.fiche_id),
      // On tronque l'extrait affiché : la page reste lisible, le lien vers la
      // fiche complète est toujours à côté.
      extrait: p.texte.length > 420 ? `${p.texte.slice(0, 420).trimEnd()}…` : p.texte,
      similarite: Math.round(p.similarite * 1000) / 1000,
      url: resolue?.url ?? null,
    };
  });
}

function versExtraction(passages: LignePassage[]): PassagePourExtraction[] {
  return passages.map((p) => ({
    type_fiche: p.type_fiche,
    fiche_id: p.fiche_id,
    champ: p.champ,
    titre_fiche: p.titre_fiche,
    texte: p.texte,
    similarite: p.similarite,
    metadonnees: p.metadonnees,
  }));
}

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

// Le cache vivait dans Supabase (table atlas_rag_cache_reponses). Il n'a plus
// lieu d'être : la recherche est locale et gratuite, le mode extractif l'est
// aussi. Ce qui reste à ne pas repayer, c'est l'appel à un fournisseur d'API —
// d'où un cache MÉMOIRE, borné, par instance.
//
// Limite assumée et à connaître : sur un hébergement serverless, chaque instance
// a le sien, et il disparaît au recyclage. Ce n'est donc pas une garantie de
// « une question posée deux fois = un seul appel », c'est un amortisseur. Un
// vrai cache partagé suppose un stockage partagé ; le jour où le site prendra
// du trafic ET où une clé payante sera posée, ce sera le moment d'y revenir.

interface EntreeCache {
  reponse: ReponseQuestion;
  expire: number;
}

const cache = new Map<string, EntreeCache>();

/** Lit le cache. Toute anomalie est avalée : un cache en panne ne casse pas la réponse. */
export function lireCache(cle: string): ReponseQuestion | null {
  const entree = cache.get(cle);
  if (!entree) return null;
  if (Date.now() > entree.expire) {
    cache.delete(cle);
    return null;
  }
  // Remise en tête : la Map JavaScript conserve l'ordre d'insertion, ce qui
  // suffit à faire une éviction « le moins récemment utilisé » sans structure
  // supplémentaire.
  cache.delete(cle);
  cache.set(cle, entree);
  return { ...entree.reponse, diagnostic: { ...entree.reponse.diagnostic, depuis_cache: true } };
}

/** Écrit le cache, avec éviction du plus ancien au-delà du plafond d'entrées. */
export function ecrireCache(cle: string, reponse: ReponseQuestion): void {
  cache.set(cle, { reponse, expire: Date.now() + CACHE_TTL_HEURES * 3_600_000 });
  while (cache.size > CACHE_MAX_ENTREES) {
    const premiere = cache.keys().next();
    if (premiere.done) break;
    cache.delete(premiere.value);
  }
}

/** Vide le cache — utile après une réindexation. */
export function viderCache(): number {
  const taille = cache.size;
  cache.clear();
  return taille;
}

/* -------------------------------------------------------------------------- */
/* Orchestration                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Avertissements attachés à TOUTE réponse : ils décrivent l'état de l'index par
 * rapport au corpus. Un index en retard ne fait plus afficher de source morte
 * (les passages sont reconstruits depuis le corpus, donc un passage orphelin
 * n'existe pas), mais il fait chercher dans moins de matière — et ça, le lecteur
 * doit le savoir.
 */
function avertissementsIndex(): string[] {
  const etat = etatIndex();
  const messages: string[] = [];
  if (etat.nb_passages_absents > 0) {
    messages.push(
      `${etat.nb_passages_absents} passage(s) du corpus ne sont pas dans l'index (fiches ajoutées ou modifiées ` +
        "depuis la dernière indexation) : la recherche porte sur moins de matière qu'annoncé. " +
        "Relancer `npm run indexer` — c'est gratuit et immédiat."
    );
  }
  if (etat.nb_entrees_orphelines > 0) {
    messages.push(
      `${etat.nb_entrees_orphelines} entrée(s) de l'index ne correspondent plus à aucune fiche du corpus et ont ` +
        "été ignorées. Aucune source morte n'a donc été affichée, mais l'index mérite d'être reconstruit."
    );
  }
  return messages;
}

function diagnosticDeBase(): DiagnosticReponse {
  return {
    statut: "repondue",
    mode: null,
    mode_libelle: "",
    fournisseur: null,
    similarite_max: 0,
    nb_passages_trouves: 0,
    nb_passages_utilises: 0,
    termes_apparies_max: 0,
    seuil_similarite: SEUIL_SIMILARITE,
    seuil_pertinence: SEUIL_PERTINENCE,
    modele_embedding: MODELE_EMBEDDING,
    modele_reponse: null,
    tokens_entree: 0,
    tokens_sortie: 0,
    depuis_cache: false,
    genere_le: new Date().toISOString(),
    corpus_maj: derniereMiseAJourCorpus,
  };
}

/**
 * Réponse de refus. C'est le garde-fou anti-hallucination de complaisance :
 * aucune génération n'a été faite, aucune perspective n'est inventée, et le
 * lecteur voit quand même les passages les plus proches trouvés (même sous le
 * seuil) pour comprendre POURQUOI le corpus ne répond pas.
 */
function reponseHorsCorpus(
  question: string,
  trouves: LignePassage[],
  similariteMax: number,
  raison: string,
  avertissements: string[] = []
): ReponseQuestion {
  const apercu = trouves.slice(0, 5);
  return {
    question,
    reformulation: question,
    perspectives: [],
    angles_morts:
      "Le référentiel ATLAS ne contient pas (ou pas assez) de matière sur cette question. " +
      `Elle sort du périmètre couvert par les ${fichesHumaines.length} fiches humaines, ${fichesIA.length} fiches IA ` +
      `et ${fichesGap.length} fiches de gap indexées.`,
    passages_mobilises: versPassagesMobilises(apercu),
    fiches_mobilisees: regrouperFiches(apercu),
    avertissements: [...avertissementsIndex(), ...avertissements],
    message: raison,
    diagnostic: {
      ...diagnosticDeBase(),
      statut: trouves.length === 0 ? "corpus_vide" : "hors_corpus",
      similarite_max: Math.round(similariteMax * 1000) / 1000,
      nb_passages_trouves: trouves.length,
      nb_passages_utilises: 0,
      termes_apparies_max: trouves.reduce((m, p) => Math.max(m, p.termes_apparies), 0),
    },
  };
}

/** Contrat passé aux fournisseurs — dérivé du contrat unique ci-dessus. */
function contratPour(question: string, contexte: string): ContratGeneration {
  return {
    systeme: CONSIGNE_SYSTEME,
    schema: OUTIL_REPONSE.input_schema,
    nomOutil: OUTIL_REPONSE.name,
    descriptionOutil: OUTIL_REPONSE.description,
    message: messageQuestion(question, contexte),
    maxTokens: MAX_TOKENS_REPONSE,
    temperature: 0.2,
    delaiMs: DELAI_MAX_MS,
  };
}

interface ResultatGeneration {
  mode: ModeReponse;
  fournisseur: string | null;
  modele: string | null;
  sortie: SortieBrute;
  tokens_entree: number;
  tokens_sortie: number;
  avertissements: string[];
}

/**
 * Mode 1 — les fournisseurs configurés, dans l'ordre. Le premier qui répond
 * gagne ; les échecs sont accumulés et rendus au lecteur, jamais avalés.
 */
async function genererParFournisseur(
  question: string,
  contexte: string,
  fournisseurs: FournisseurActif[]
): Promise<{ resultat: ResultatGeneration } | { echecs: string[] }> {
  const contrat = contratPour(question, contexte);
  const echecs: string[] = [];
  for (const fournisseur of fournisseurs) {
    const resultat = await appelerFournisseur(fournisseur, contrat);
    if (!resultat.ok) {
      echecs.push(resultat.erreur);
      continue;
    }
    return {
      resultat: {
        mode: "fournisseur",
        fournisseur: fournisseur.descripteur.nom,
        modele: fournisseur.modele,
        sortie: resultat.sortie,
        tokens_entree: resultat.tokens_entree,
        tokens_sortie: resultat.tokens_sortie,
        avertissements: [
          ...echecs.map((e) => `Fournisseur écarté : ${e}`),
          ...resultat.reparations.map(
            (r) => `Sortie du fournisseur réparée avant lecture (${r}) : le modèle n'a pas rendu de JSON strict.`
          ),
        ],
      },
    };
  }
  return { echecs };
}

export interface OptionsReponse {
  /** Mode demandé. « auto » enchaîne fournisseurs puis repli extractif. */
  mode?: ModeDemande;
  /** Texte recollé par l'utilisateur (mode 2). */
  retour?: string;
}

/**
 * Pipeline complet.
 *
 * Ordre volontaire : cache → recherche → garde-fous → génération. Chaque étape
 * peut arrêter le traitement AVANT la suivante : une question hors sujet ne
 * déclenche aucune génération, et ne coûte donc rien, même avec une clé posée.
 */
export async function repondreAQuestion(question: string, options: OptionsReponse = {}): Promise<ReponseQuestion> {
  const modeDemande: ModeDemande = options.mode ?? "auto";
  const retourColle = typeof options.retour === "string" ? options.retour : null;

  // Un collage n'est jamais servi depuis le cache : c'est le texte de
  // l'utilisateur qu'on relit, pas une réponse déjà calculée.
  const cle = empreinteCache(question, modeDemande);
  if (!retourColle) {
    const enCache = lireCache(cle);
    if (enCache) return enCache;
  }

  const trouves = await rechercherPassages(question);
  const similariteMax = trouves.length > 0 ? Math.max(...trouves.map((p) => p.similarite)) : 0;
  const termesApparies = trouves.reduce((m, p) => Math.max(m, p.termes_apparies), 0);
  const alertesIndex = avertissementsIndex();

  // --- Garde-fous. Trois refus distincts, trois messages distincts : les
  // confondre conduit à régler le mauvais bouton.
  if (trouves.length === 0) {
    return reponseHorsCorpus(
      question,
      trouves,
      0,
      `Aucun passage du référentiel n'atteint le seuil de similarité (${SEUIL_SIMILARITE}) : le moteur ne répond ` +
        "pas plutôt que d'inventer.",
      alertesIndex
    );
  }

  if (similariteMax < SEUIL_PERTINENCE) {
    return reponseHorsCorpus(
      question,
      trouves,
      similariteMax,
      `Le référentiel ne couvre pas assez cette question pour y répondre honnêtement ` +
        `(meilleure similarité ${similariteMax.toFixed(2)}, seuil de pertinence ${SEUIL_PERTINENCE}). ` +
        "Les extraits les plus proches sont affichés ci-dessous à titre indicatif, sans réponse construite.",
      alertesIndex
    );
  }

  if (trouves.length < MIN_PASSAGES) {
    return reponseHorsCorpus(
      question,
      trouves,
      similariteMax,
      `Seulement ${trouves.length} extrait(s) du référentiel dépassent le seuil de similarité ` +
        `(${SEUIL_SIMILARITE}), alors que ${MIN_PASSAGES} au minimum sont exigés pour construire une réponse ` +
        "à plusieurs perspectives. Les extraits trouvés sont affichés ci-dessous, sans réponse construite.",
      alertesIndex
    );
  }

  if (etatIndex().lexical && termesApparies < MIN_TERMES_APPARIES) {
    return reponseHorsCorpus(
      question,
      trouves,
      similariteMax,
      `Aucun passage du référentiel ne retrouve plus de ${termesApparies} terme(s) de la question, alors que ` +
        `${MIN_TERMES_APPARIES} au minimum sont exigés. Une similarité obtenue sur un seul mot n'est pas un sujet ` +
        "traité : le moteur refuse plutôt que de composer une réponse autour d'une coïncidence de vocabulaire.",
      alertesIndex
    );
  }

  const passages = selectionnerPassages(trouves);
  const contexte = construireContexte(passages);
  const promptACopier = construirePromptACopier(question, contexte);

  /** Fabrique la réponse finale à partir d'une génération réussie. */
  const finaliser = (generation: ResultatGeneration, avecPrompt: boolean): ReponseQuestion => {
    const { perspectives, avertissements } = construirePerspectives(generation.sortie, passages);
    if (perspectives.length === 0) {
      return reponseHorsCorpus(
        question,
        trouves,
        similariteMax,
        "Aucune perspective exploitable n'a survécu à la validation : les entrées produites n'avaient ni nom " +
          "d'école ni réponse. Rien n'est affiché plutôt qu'une réponse vide de sens.",
        [...alertesIndex, ...generation.avertissements]
      );
    }
    return {
      question,
      reformulation: texteSur(generation.sortie.reformulation, question),
      perspectives,
      angles_morts: texteSur(
        generation.sortie.angles_morts,
        "Angles morts non explicités par le moteur — à considérer comme une limite de cette réponse."
      ),
      passages_mobilises: versPassagesMobilises(passages),
      fiches_mobilisees: regrouperFiches(passages),
      avertissements: [...alertesIndex, ...generation.avertissements, ...avertissements],
      prompt_a_copier: avecPrompt ? promptACopier : undefined,
      diagnostic: {
        ...diagnosticDeBase(),
        statut: "repondue",
        mode: generation.mode,
        mode_libelle: LIBELLES_MODE[generation.mode],
        fournisseur: generation.fournisseur,
        similarite_max: Math.round(similariteMax * 1000) / 1000,
        nb_passages_trouves: trouves.length,
        nb_passages_utilises: passages.length,
        termes_apparies_max: termesApparies,
        modele_reponse: generation.modele,
        tokens_entree: generation.tokens_entree,
        tokens_sortie: generation.tokens_sortie,
      },
    };
  };

  /** Mode 3 — toujours disponible, c'est le filet. */
  const repondreExtractif = (avertissementsAmont: string[]): ReponseQuestion => {
    const extractive = construireReponseExtractive(question, versExtraction(passages));
    if (extractive.perspectives.length === 0) {
      return reponseHorsCorpus(
        question,
        trouves,
        similariteMax,
        "Les passages retrouvés n'appartiennent à aucune fiche composable : rien n'a pu être assemblé.",
        [...alertesIndex, ...avertissementsAmont]
      );
    }
    const avertissements = [...alertesIndex, ...avertissementsAmont, ...extractive.avertissements];
    if (extractive.perspectives.length === 1) {
      avertissements.push(
        "Une seule perspective a pu être composée : sur un sujet contesté, c'est en deçà de la règle de " +
          "neutralité active du projet (cf. /methodologie). À lire comme une lecture parmi d'autres."
      );
    }
    return {
      question,
      reformulation: extractive.reformulation,
      perspectives: extractive.perspectives,
      angles_morts: extractive.angles_morts,
      passages_mobilises: versPassagesMobilises(passages),
      fiches_mobilisees: regrouperFiches(passages),
      avertissements,
      prompt_a_copier: promptACopier,
      diagnostic: {
        ...diagnosticDeBase(),
        statut: "repondue",
        mode: "extractif",
        mode_libelle: LIBELLES_MODE.extractif,
        fournisseur: null,
        similarite_max: Math.round(similariteMax * 1000) / 1000,
        nb_passages_trouves: trouves.length,
        nb_passages_utilises: passages.length,
        termes_apparies_max: termesApparies,
        modele_reponse: null,
      },
    };
  };

  /* --- Mode 2 : prompt à copier, puis retour à recoller ------------------- */
  if (modeDemande === "prompt") {
    if (!retourColle) {
      return {
        question,
        reformulation: question,
        perspectives: [],
        angles_morts:
          "Rien n'a encore été rédigé : la recherche a trouvé la matière, la rédaction reste à faire hors du site.",
        passages_mobilises: versPassagesMobilises(passages),
        fiches_mobilisees: regrouperFiches(passages),
        avertissements: alertesIndex,
        message:
          `Prompt prêt (${promptACopier.length.toLocaleString("fr-FR")} caractères, ${passages.length} extraits). ` +
          "Le copier, le coller dans le chat de votre choix, puis recoller ici la réponse obtenue : elle sera " +
          "relue, ses sources vérifiées contre le corpus, et affichée en perspectives.",
        prompt_a_copier: promptACopier,
        diagnostic: {
          ...diagnosticDeBase(),
          statut: "prompt_a_coller",
          mode: "prompt",
          mode_libelle: LIBELLES_MODE.prompt,
          similarite_max: Math.round(similariteMax * 1000) / 1000,
          nb_passages_trouves: trouves.length,
          nb_passages_utilises: passages.length,
          termes_apparies_max: termesApparies,
        },
      };
    }

    const analyse = analyserSortie(retourColle);
    if (!analyse.ok) {
      // Jamais une exception : un collage inexploitable est une situation
      // normale, elle se répond par un message qui dit quoi faire.
      return {
        question,
        reformulation: question,
        perspectives: [],
        angles_morts: "Le retour collé n'a pas pu être relu ; rien n'est affiché plutôt qu'une réponse approximative.",
        passages_mobilises: versPassagesMobilises(passages),
        fiches_mobilisees: regrouperFiches(passages),
        avertissements: alertesIndex,
        message: analyse.message,
        prompt_a_copier: promptACopier,
        diagnostic: {
          ...diagnosticDeBase(),
          statut: "prompt_a_coller",
          mode: "prompt",
          mode_libelle: LIBELLES_MODE.prompt,
          similarite_max: Math.round(similariteMax * 1000) / 1000,
          nb_passages_trouves: trouves.length,
          nb_passages_utilises: passages.length,
          termes_apparies_max: termesApparies,
        },
      };
    }

    return finaliser(
      {
        mode: "prompt",
        fournisseur: null,
        modele: null,
        sortie: analyse.sortie,
        tokens_entree: 0,
        tokens_sortie: 0,
        avertissements: [
          "Réponse rédigée hors du site puis recollée : le moteur n'a pas choisi le modèle qui l'a écrite, " +
            "et ne peut pas garantir qu'il s'est tenu aux extraits. Les sources affichées, elles, sont bien " +
            "celles des fiches du corpus — un identifiant inventé aurait été rejeté ci-dessous.",
          ...analyse.reparations.map((r) => `Texte collé réparé avant lecture : ${r}.`),
        ],
      },
      true
    );
  }

  /* --- Mode 3 forcé ------------------------------------------------------- */
  if (modeDemande === "extractif") {
    const reponse = repondreExtractif([]);
    ecrireCache(cle, reponse);
    return reponse;
  }

  /* --- Mode 1, seul ou en tête du repli automatique ------------------------ */
  const fournisseurs = fournisseursActifs();
  if (fournisseurs.length === 0) {
    if (modeDemande === "fournisseur") {
      throw new ErreurRag(
        "configuration",
        "Aucun fournisseur de génération n'est configuré. Poser une clé (voir .env.example §3), " +
          "ou utiliser le mode « prompt à copier » ou le mode extractif, qui n'en demandent aucune.",
        503
      );
    }
    const reponse = repondreExtractif([
      "Aucun fournisseur de génération n'est configuré : le moteur a répondu en mode extractif. " +
        "C'est le comportement prévu, pas une panne.",
    ]);
    ecrireCache(cle, reponse);
    return reponse;
  }

  const tentative = await genererParFournisseur(question, contexte, fournisseurs);
  if ("resultat" in tentative) {
    const reponse = finaliser(tentative.resultat, false);
    ecrireCache(cle, reponse);
    return reponse;
  }

  if (modeDemande === "fournisseur") {
    throw new ErreurRag(
      "fournisseur",
      `Les ${fournisseurs.length} fournisseur(s) configuré(s) ont tous échoué : ${tentative.echecs.join(" · ")}`,
      502
    );
  }

  // Repli : le mode extractif marche toujours. On dit pourquoi on y est arrivé.
  const reponse = repondreExtractif([
    `Repli automatique : ${tentative.echecs.length} fournisseur(s) ont échoué (${tentative.echecs.join(" · ")}).`,
  ]);
  ecrireCache(cle, reponse);
  return reponse;
}

/* -------------------------------------------------------------------------- */
/* Diagnostic de configuration (GET /api/question)                            */
/* -------------------------------------------------------------------------- */

export interface EtatMoteur {
  actif: boolean;
  index: ReturnType<typeof etatIndex>;
  mode_par_defaut: ModeReponse;
  modes_disponibles: ModeReponse[];
  fournisseurs_configures: { id: string; nom: string; modele: string }[];
  fournisseurs_connus: { id: string; nom: string; variable_cle: string; url_creation_cle: string; palier_gratuit: string }[];
  reglages: Record<string, unknown>;
}

/**
 * État du moteur, sans aucun appel payant et sans jamais exposer une valeur de
 * clé. Sert à l'interface pour afficher honnêtement ce qui est disponible.
 */
export function etatMoteur(): EtatMoteur {
  const index = etatIndex();
  const actifs = fournisseursActifs();
  // Les trois modes sont toujours proposés : le mode 2 ne demande aucune clé et
  // le mode 3 non plus. Seul le mode 1 dépend d'une configuration.
  const modes: ModeReponse[] = actifs.length > 0 ? ["fournisseur", "prompt", "extractif"] : ["prompt", "extractif"];
  return {
    actif: index.present,
    index,
    mode_par_defaut: actifs.length > 0 ? "fournisseur" : "extractif",
    modes_disponibles: modes,
    fournisseurs_configures: actifs.map((f) => ({ id: f.descripteur.id, nom: f.descripteur.nom, modele: f.modele })),
    fournisseurs_connus: FOURNISSEURS.map((f) => ({
      id: f.id,
      nom: f.nom,
      variable_cle: f.variable_cle,
      url_creation_cle: f.url_creation_cle,
      palier_gratuit: f.palier_gratuit,
    })),
    reglages: {
      modele_embedding: MODELE_EMBEDDING,
      seuil_similarite: SEUIL_SIMILARITE,
      seuil_pertinence: SEUIL_PERTINENCE,
      min_passages: MIN_PASSAGES,
      min_termes_apparies: MIN_TERMES_APPARIES,
      max_passages: MAX_PASSAGES,
      max_caracteres_contexte: MAX_CARACTERES_CONTEXTE,
      max_tokens_reponse: MAX_TOKENS_REPONSE,
      cache_ttl_heures: CACHE_TTL_HEURES,
      question_min: QUESTION_MIN,
      question_max: QUESTION_MAX,
    },
  };
}

// Moteur de réponse prédictive (MP-4 / Lot 6 du mégaprompt, section 7.3).
//
// Ce module est le SEUL endroit qui parle aux fournisseurs payants (Voyage pour
// les embeddings, Anthropic pour la génération) et à la base vectorielle. La
// route app/api/question/route.ts se contente de l'orchestrer et de traduire le
// résultat en réponse HTTP.
//
// ⚠️ Module strictement serveur : il lit SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY
// et ANTHROPIC_API_KEY. Ne jamais l'importer depuis un composant "use client" —
// Next embarquerait ces clés dans le bundle du navigateur.
//
// Principe directeur, non négociable (mégaprompt §2.1 et §10) : la sortie est
// une LISTE DE PERSPECTIVES, jamais un verdict unique. Le modèle ne choisit pas
// entre les écoles, il les expose. Trois mécanismes le garantissent réellement :
//   1. le schéma d'outil impose un tableau `perspectives` (min. 2 en pratique,
//      vérifié après coup et signalé dans `avertissements` si le modèle triche) ;
//   2. le prompt système interdit explicitement la synthèse surplombante ;
//   3. les sources ne sont PAS produites par le modèle : elles sont reconstruites
//      depuis `lib/corpus.ts` à partir des identifiants de fiches réellement
//      remontés par la recherche vectorielle. Un modèle ne peut donc pas
//      halluciner une référence — au pire il cite une fiche du corpus qui existe.
//
// Bornes de coût (les trois, effectives) :
//   - cache de réponses en base (atlas_rag_cache_reponses) ;
//   - plafond de passages injectés dans le contexte (MAX_PASSAGES + MAX_CARACTERES) ;
//   - plafond de tokens de sortie (MAX_TOKENS_REPONSE).
// Plus un garde-fou en amont : si la recherche vectorielle ne remonte rien
// au-dessus du seuil de similarité, AUCUN appel au modèle n'est fait — la
// question coûte alors le seul embedding, et la réponse dit franchement qu'elle
// ne sait pas.

import { createHash } from "node:crypto";
import type { NiveauConfiance, Perspective, Source } from "@/lib/types";
import {
  derniereMiseAJourCorpus,
  cheminFicheHumaine,
  cheminFicheIA,
  cheminGap,
  getFicheGap,
  getFicheHumaine,
  getFicheIA,
} from "@/lib/corpus";
import { getSupabaseServiceClient } from "@/lib/supabase";

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

/** Dimension des vecteurs — figée par supabase/schema.sql, ne pas changer sans migration. */
export const DIMENSION_EMBEDDING = 1024;

/** Modèle d'embedding. Doit être IDENTIQUE à celui utilisé par l'indexeur. */
export const MODELE_EMBEDDING = process.env.VOYAGE_MODELE_EMBEDDING || "voyage-4-lite";

/** Modèle de génération. Vérifier le nom exact dans la console Anthropic avant mise en ligne. */
export const MODELE_REPONSE = process.env.ATLAS_MODELE_REPONSE || "claude-sonnet-4-5";

/**
 * Seuil de similarité cosinus en dessous duquel un passage est jugé hors sujet.
 * 0,35 est volontairement bas pour un corpus francophone : les embeddings
 * multilingues rendent rarement plus de 0,6 sur une question ouverte. Le vrai
 * garde-fou est SEUIL_PERTINENCE ci-dessous, qui exige que le MEILLEUR passage
 * dépasse une barre plus haute pour qu'on accepte de répondre.
 */
export const SEUIL_SIMILARITE = nombreEnv("ATLAS_RAG_SEUIL_SIMILARITE", 0.35, 0, 1);

/** Similarité minimale du meilleur passage pour qu'on accepte de répondre. */
export const SEUIL_PERTINENCE = nombreEnv("ATLAS_RAG_SEUIL_PERTINENCE", 0.45, 0, 1);

/** Nombre minimal de passages pertinents exigé avant tout appel au modèle. */
export const MIN_PASSAGES = entierEnv("ATLAS_RAG_MIN_PASSAGES", 3, 1, 20);

/** Plafond de passages injectés dans le contexte (borne de coût n°2). */
export const MAX_PASSAGES = entierEnv("ATLAS_RAG_MAX_PASSAGES", 18, 3, 60);

/** Plafond de caractères du contexte, indépendant du nombre de passages. */
export const MAX_CARACTERES_CONTEXTE = entierEnv("ATLAS_RAG_MAX_CARACTERES", 18_000, 2_000, 60_000);

/** Plafond de tokens de sortie du modèle (borne de coût n°3). */
export const MAX_TOKENS_REPONSE = entierEnv("ATLAS_RAG_MAX_TOKENS", 2_600, 500, 8_000);

/** Durée de vie d'une entrée de cache, en heures (30 jours par défaut). */
export const CACHE_TTL_HEURES = entierEnv("ATLAS_RAG_CACHE_TTL_HEURES", 720, 1, 8_760);

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

export type TypeFicheRag = "humaine" | "ia" | "gap";

/** Un extrait du corpus réellement envoyé au modèle, affiché tel quel au lecteur. */
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
  statut: "repondue" | "hors_corpus" | "corpus_vide";
  similarite_max: number;
  nb_passages_trouves: number;
  nb_passages_utilises: number;
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
  /** Messages honnêtes destinés au lecteur (pluralisme insuffisant, sources absentes…). */
  avertissements: string[];
  /** Rempli seulement quand le moteur refuse de répondre. */
  message?: string;
  diagnostic: DiagnosticReponse;
}

/** Erreur de configuration ou de fournisseur : traduite en 5xx par la route. */
export class ErreurRag extends Error {
  readonly code: "configuration" | "fournisseur" | "base";
  readonly statut: 500 | 502 | 503;

  constructor(code: "configuration" | "fournisseur" | "base", message: string, statut: 500 | 502 | 503) {
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
 * Clé de cache. Elle inclut les modèles et les plafonds : changer de modèle ou
 * de nombre de passages doit produire une NOUVELLE réponse, pas resservir
 * l'ancienne en prétendant qu'elle vient du nouveau réglage.
 */
export function empreinteCache(question: string): string {
  return empreinte(
    [normaliserQuestion(question), MODELE_EMBEDDING, MODELE_REPONSE, String(MAX_PASSAGES), "v1"].join("|")
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

/* -------------------------------------------------------------------------- */
/* Résolution des fiches du corpus                                            */
/* -------------------------------------------------------------------------- */

/** Nom lisible + URL publique d'une fiche, ou null si l'id n'existe plus. */
export function resoudreFiche(type: TypeFicheRag, id: string): { nom: string; url: string } | null {
  if (type === "humaine") {
    const fiche = getFicheHumaine(id);
    return fiche ? { nom: fiche.nom, url: cheminFicheHumaine(fiche.id) } : null;
  }
  if (type === "ia") {
    const fiche = getFicheIA(id);
    return fiche ? { nom: fiche.nom, url: cheminFicheIA(fiche.id) } : null;
  }
  const gap = getFicheGap(id);
  if (!gap) return null;
  const humaine = getFicheHumaine(gap.fiche_humaine_id);
  const ia = getFicheIA(gap.fiche_ia_id);
  return {
    nom: `${humaine?.nom ?? gap.fiche_humaine_id} × ${ia?.nom ?? gap.fiche_ia_id}`,
    url: cheminGap(gap.id),
  };
}

/**
 * Sources RÉELLES d'une fiche, lues dans le corpus — jamais générées.
 * Pour une fiche de gap, on remonte ses documents clés puis, à défaut, les
 * sources des deux fiches qu'elle croise : une fiche de gap n'a pas toujours de
 * bibliographie propre, mais elle en hérite toujours une.
 */
function sourcesDeFiche(type: TypeFicheRag, id: string): Source[] {
  if (type === "humaine") return getFicheHumaine(id)?.sources ?? [];
  if (type === "ia") return getFicheIA(id)?.sources ?? [];
  const gap = getFicheGap(id);
  if (!gap) return [];
  const documents = gap.documents_cles ?? [];
  if (documents.length > 0) return documents;
  return [...(getFicheHumaine(gap.fiche_humaine_id)?.sources ?? []), ...(getFicheIA(gap.fiche_ia_id)?.sources ?? [])];
}

/** Déduplique des sources sur (titre, url) en gardant l'ordre d'apparition. */
function dedupliquerSources(sources: Source[]): Source[] {
  const vues = new Set<string>();
  const resultat: Source[] = [];
  for (const source of sources) {
    if (!source || typeof source.titre !== "string") continue;
    const cle = `${source.titre}|${source.url ?? ""}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    resultat.push(source);
  }
  return resultat;
}

/* -------------------------------------------------------------------------- */
/* Étape 1 — embedding de la question (Voyage)                                */
/* -------------------------------------------------------------------------- */

interface ReponseVoyage {
  data?: { embedding?: number[]; index?: number }[];
  usage?: { total_tokens?: number };
  detail?: string;
  error?: { message?: string };
}

/** Appel HTTP borné dans le temps, sans dépendance externe (fetch natif). */
async function fetchBorne(url: string, init: RequestInit): Promise<Response> {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MAX_MS);
  try {
    return await fetch(url, { ...init, signal: controleur.signal });
  } finally {
    clearTimeout(minuterie);
  }
}

/**
 * Vectorise la question. `input_type: "query"` est important : Voyage encode
 * différemment une question et un document, et l'indexeur utilise "document".
 * Utiliser le même type des deux côtés dégrade nettement le rappel.
 */
export async function embedderQuestion(question: string): Promise<number[]> {
  const cle = process.env.VOYAGE_API_KEY;
  if (!cle) {
    throw new ErreurRag("configuration", "VOYAGE_API_KEY absente : le moteur de questions est désactivé.", 503);
  }

  const corps: Record<string, unknown> = {
    input: [question],
    model: MODELE_EMBEDDING,
    input_type: "query",
  };
  // Certains modèles Voyage acceptent une dimension de sortie explicite, d'autres
  // la refusent. On ne l'envoie donc QUE si l'auteur l'a demandée dans .env.local.
  const dimensionDemandee = process.env.VOYAGE_DIMENSION_SORTIE;
  if (dimensionDemandee) corps.output_dimension = Number.parseInt(dimensionDemandee, 10);

  let reponse: Response;
  try {
    reponse = await fetchBorne("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` },
      body: JSON.stringify(corps),
    });
  } catch (erreur) {
    throw new ErreurRag("fournisseur", `Appel Voyage impossible : ${(erreur as Error).message}`, 502);
  }

  const donnees = (await reponse.json().catch(() => ({}))) as ReponseVoyage;
  if (!reponse.ok) {
    const detail = donnees.error?.message ?? donnees.detail ?? `HTTP ${reponse.status}`;
    throw new ErreurRag("fournisseur", `Voyage a refusé la requête d'embedding : ${detail}`, 502);
  }

  const vecteur = donnees.data?.[0]?.embedding;
  if (!Array.isArray(vecteur) || vecteur.length === 0) {
    throw new ErreurRag("fournisseur", "Voyage n'a rendu aucun vecteur exploitable.", 502);
  }
  if (vecteur.length !== DIMENSION_EMBEDDING) {
    // Erreur silencieuse la plus coûteuse du pipeline : une dimension différente
    // fait échouer la recherche en base avec un message SQL cryptique. On préfère
    // échouer ici, avec la cause exacte.
    throw new ErreurRag(
      "configuration",
      `Dimension d'embedding incohérente : ${vecteur.length} rendu par « ${MODELE_EMBEDDING} », ` +
        `${DIMENSION_EMBEDDING} attendus par atlas_rag_passages. Changer de modèle impose une nouvelle table.`,
      500
    );
  }
  return vecteur;
}

/* -------------------------------------------------------------------------- */
/* Étape 2 — recherche vectorielle                                            */
/* -------------------------------------------------------------------------- */

interface LignePassage {
  id: number;
  type_fiche: TypeFicheRag;
  fiche_id: string;
  champ: string;
  titre_fiche: string;
  texte: string;
  metadonnees: Record<string, unknown> | null;
  similarite: number;
}

export async function rechercherPassages(vecteur: number[]): Promise<LignePassage[]> {
  // La création du client échoue si les variables Supabase manquent : on traduit
  // cette panne de configuration en 503 explicite plutôt qu'en 500 opaque.
  let supabase;
  try {
    supabase = getSupabaseServiceClient();
  } catch (erreur) {
    throw new ErreurRag("configuration", (erreur as Error).message, 503);
  }

  const { data, error } = await supabase.rpc("atlas_rag_rechercher_passages", {
    requete: vecteur,
    seuil: SEUIL_SIMILARITE,
    // On demande un peu plus que le plafond de contexte : le filtrage par fiche
    // (au plus 2 passages de la même fiche) élague ensuite la liste.
    limite: Math.min(100, MAX_PASSAGES * 3),
    types: null,
  });

  if (error) {
    throw new ErreurRag(
      "base",
      `Recherche vectorielle impossible (${error.message}). ` +
        "Vérifier que supabase/schema.sql a bien été exécuté sur le projet mutualisé.",
      502
    );
  }
  return (data ?? []) as LignePassage[];
}

/**
 * Sélectionne les passages injectés dans le contexte.
 * Deux règles, toutes deux importantes :
 *   - au plus 2 passages par fiche : sans cela une seule fiche bavarde monopolise
 *     le contexte et le modèle ne voit plus qu'une école de pensée, ce qui
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
    const taille = (ligne.texte ?? "").length;
    if (caracteres + taille > MAX_CARACTERES_CONTEXTE && retenus.length > 0) break;
    parFiche.set(cle, dejaPris + 1);
    caracteres += taille;
    retenus.push(ligne);
  }
  return retenus;
}

/* -------------------------------------------------------------------------- */
/* Étape 3 — construction du contexte                                         */
/* -------------------------------------------------------------------------- */

const LIBELLES_TYPE: Record<TypeFicheRag, string> = {
  humaine: "Référentiel A (capacité humaine)",
  ia: "Référentiel B (capacité IA)",
  gap: "Fiche de gap analysis (humain × IA)",
};

/**
 * Le contexte est un bloc balisé, un passage par entrée, chaque entrée portant
 * son identifiant de fiche. C'est cet identifiant que le modèle devra citer :
 * il ne peut donc désigner qu'une fiche réellement présente dans le contexte.
 */
export function construireContexte(passages: LignePassage[]): string {
  return passages
    .map((p, i) => {
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
        `[EXTRAIT ${i + 1}]`,
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
    })
    .join("\n\n");
}

/* -------------------------------------------------------------------------- */
/* Étape 4 — appel du modèle                                                  */
/* -------------------------------------------------------------------------- */

const CONSIGNE_SYSTEME = `Tu es ATLAS, moteur de réponse de l'observatoire « Atlas Humain × IA ».

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

const OUTIL_REPONSE = {
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

interface SortieModele {
  reformulation?: unknown;
  angles_morts?: unknown;
  perspectives?: unknown;
}

interface ResultatModele {
  sortie: SortieModele;
  tokens_entree: number;
  tokens_sortie: number;
}

interface ReponseAnthropic {
  content?: { type?: string; name?: string; input?: unknown }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; type?: string };
  stop_reason?: string;
}

export async function appelerModele(question: string, contexte: string): Promise<ResultatModele> {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) {
    throw new ErreurRag("configuration", "ANTHROPIC_API_KEY absente : le moteur de questions est désactivé.", 503);
  }

  const message = [
    `QUESTION POSÉE :\n${question}`,
    "",
    `EXTRAITS DU CORPUS ATLAS (${contexte.length} caractères, seuls éléments autorisés) :`,
    contexte,
    "",
    "Réponds en appelant l'outil repondre_par_perspectives, et uniquement lui.",
  ].join("\n");

  let reponse: Response;
  try {
    reponse = await fetchBorne("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": cle,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELE_REPONSE,
        max_tokens: MAX_TOKENS_REPONSE,
        temperature: 0.2,
        system: CONSIGNE_SYSTEME,
        tools: [OUTIL_REPONSE],
        // Sortie structurée forcée : on n'analyse jamais du texte libre, donc
        // aucune réponse ne peut arriver sous forme de verdict en prose.
        tool_choice: { type: "tool", name: OUTIL_REPONSE.name },
        messages: [{ role: "user", content: message }],
      }),
    });
  } catch (erreur) {
    throw new ErreurRag("fournisseur", `Appel Anthropic impossible : ${(erreur as Error).message}`, 502);
  }

  const donnees = (await reponse.json().catch(() => ({}))) as ReponseAnthropic;
  if (!reponse.ok) {
    const detail = donnees.error?.message ?? `HTTP ${reponse.status}`;
    throw new ErreurRag("fournisseur", `Anthropic a refusé la requête : ${detail}`, 502);
  }

  const bloc = (donnees.content ?? []).find((c) => c.type === "tool_use" && c.name === OUTIL_REPONSE.name);
  if (!bloc || typeof bloc.input !== "object" || bloc.input === null) {
    throw new ErreurRag(
      "fournisseur",
      `Le modèle n'a pas rendu de réponse structurée (stop_reason: ${donnees.stop_reason ?? "inconnu"}).`,
      502
    );
  }

  return {
    sortie: bloc.input as SortieModele,
    tokens_entree: donnees.usage?.input_tokens ?? 0,
    tokens_sortie: donnees.usage?.output_tokens ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Étape 5 — validation de la sortie et rattachement des sources réelles      */
/* -------------------------------------------------------------------------- */

function texteSur(valeur: unknown, defaut = ""): string {
  return typeof valeur === "string" && valeur.trim().length > 0 ? valeur.trim() : defaut;
}

/**
 * Transforme la sortie brute du modèle en `Perspective[]` conforme à
 * lib/types.ts, en remplaçant les sources déclarées par les sources RÉELLES des
 * fiches du corpus. C'est ici que se joue l'anti-hallucination :
 *   - un identifiant absent des passages remontés est ignoré (le modèle ne peut
 *     pas faire entrer une fiche qu'il n'a pas vue) ;
 *   - une perspective qui se retrouve sans aucune source réelle est conservée
 *     mais son niveau de confiance est rabaissé et un avertissement est émis,
 *     plutôt que d'être affichée comme si elle était sourcée.
 */
export function construirePerspectives(
  sortie: SortieModele,
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

    let sources = dedupliquerSources(
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

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

interface LigneCache {
  question: string;
  reponse: ReponseQuestion;
  created_at: string;
  nb_utilisations: number;
}

/** Lit le cache. Toute erreur est avalée : un cache en panne ne doit pas casser la réponse. */
export async function lireCache(cle: string): Promise<ReponseQuestion | null> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.rpc("atlas_rag_cache_lire", {
      p_empreinte: cle,
      p_ttl_heures: CACHE_TTL_HEURES,
    });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const ligne = data[0] as LigneCache;
    const reponse = ligne.reponse;
    if (!reponse || !Array.isArray(reponse.perspectives)) return null;
    return {
      ...reponse,
      diagnostic: { ...reponse.diagnostic, depuis_cache: true },
    };
  } catch {
    return null;
  }
}

/** Écrit le cache. Idem : un échec d'écriture ne doit jamais faire échouer la requête. */
export async function ecrireCache(cle: string, reponse: ReponseQuestion): Promise<void> {
  try {
    const supabase = getSupabaseServiceClient();
    await supabase.from("atlas_rag_cache_reponses").upsert(
      {
        empreinte: cle,
        question: reponse.question,
        reponse,
        modele_reponse: reponse.diagnostic.modele_reponse ?? "",
        modele_embedding: reponse.diagnostic.modele_embedding,
        nb_passages: reponse.diagnostic.nb_passages_utilises,
        tokens_entree: reponse.diagnostic.tokens_entree,
        tokens_sortie: reponse.diagnostic.tokens_sortie,
      },
      { onConflict: "empreinte" }
    );
  } catch {
    // silencieux par conception
  }
}

/* -------------------------------------------------------------------------- */
/* Orchestration                                                              */
/* -------------------------------------------------------------------------- */

function diagnosticDeBase(): DiagnosticReponse {
  return {
    statut: "repondue",
    similarite_max: 0,
    nb_passages_trouves: 0,
    nb_passages_utilises: 0,
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
 * aucun appel au modèle n'a été fait, aucune perspective n'est inventée, et le
 * lecteur voit quand même les passages les plus proches trouvés (même sous le
 * seuil) pour comprendre POURQUOI le corpus ne répond pas.
 */
function reponseHorsCorpus(
  question: string,
  trouves: LignePassage[],
  similariteMax: number,
  raison: string
): ReponseQuestion {
  const apercu = trouves.slice(0, 5);
  return {
    question,
    reformulation: question,
    perspectives: [],
    angles_morts:
      "Le référentiel ATLAS ne contient pas (ou pas assez) de matière sur cette question. " +
      "Elle sort du périmètre couvert par les 267 fiches humaines, 44 fiches IA et 201 fiches de gap indexées.",
    passages_mobilises: versPassagesMobilises(apercu),
    fiches_mobilisees: regrouperFiches(apercu),
    avertissements: [],
    message: raison,
    diagnostic: {
      ...diagnosticDeBase(),
      statut: trouves.length === 0 ? "corpus_vide" : "hors_corpus",
      similarite_max: Math.round(similariteMax * 1000) / 1000,
      nb_passages_trouves: trouves.length,
      nb_passages_utilises: 0,
    },
  };
}

/**
 * Pipeline complet. Ordre volontaire : cache → embedding → recherche → garde-fou
 * de pertinence → modèle. Chaque étape peut arrêter le traitement AVANT la
 * suivante, plus chère : une question hors sujet ne coûte qu'un embedding
 * (quelques millièmes de centime), une question déjà posée ne coûte rien.
 */
export async function repondreAQuestion(question: string): Promise<ReponseQuestion> {
  const cle = empreinteCache(question);

  const enCache = await lireCache(cle);
  if (enCache) return enCache;

  const vecteur = await embedderQuestion(question);
  const trouves = await rechercherPassages(vecteur);
  const similariteMax = trouves.length > 0 ? Math.max(...trouves.map((p) => p.similarite)) : 0;

  if (trouves.length === 0) {
    return reponseHorsCorpus(
      question,
      trouves,
      0,
      "Aucun passage du référentiel ne dépasse le seuil de similarité : le moteur ne répond pas plutôt que d'inventer. " +
        "Si l'index vient d'être créé, vérifier que `node scripts/indexer-corpus.mjs` a bien été lancé."
    );
  }

  if (similariteMax < SEUIL_PERTINENCE || trouves.length < MIN_PASSAGES) {
    return reponseHorsCorpus(
      question,
      trouves,
      similariteMax,
      `Le référentiel ne couvre pas assez cette question pour y répondre honnêtement ` +
        `(meilleure similarité ${similariteMax.toFixed(2)}, seuil ${SEUIL_PERTINENCE}). ` +
        "Les extraits les plus proches sont affichés ci-dessous à titre indicatif, sans réponse construite."
    );
  }

  const passages = selectionnerPassages(trouves);
  const contexte = construireContexte(passages);
  const { sortie, tokens_entree, tokens_sortie } = await appelerModele(question, contexte);
  const { perspectives, avertissements } = construirePerspectives(sortie, passages);

  if (perspectives.length === 0) {
    // Le modèle a répondu mais rien d'exploitable n'a survécu à la validation.
    return reponseHorsCorpus(
      question,
      trouves,
      similariteMax,
      "Le moteur n'a produit aucune perspective exploitable à partir des extraits mobilisés."
    );
  }

  const reponse: ReponseQuestion = {
    question,
    reformulation: texteSur(sortie.reformulation, question),
    perspectives,
    angles_morts: texteSur(
      sortie.angles_morts,
      "Angles morts non explicités par le moteur — à considérer comme une limite de cette réponse."
    ),
    passages_mobilises: versPassagesMobilises(passages),
    fiches_mobilisees: regrouperFiches(passages),
    avertissements,
    diagnostic: {
      ...diagnosticDeBase(),
      statut: "repondue",
      similarite_max: Math.round(similariteMax * 1000) / 1000,
      nb_passages_trouves: trouves.length,
      nb_passages_utilises: passages.length,
      modele_reponse: MODELE_REPONSE,
      tokens_entree,
      tokens_sortie,
    },
  };

  await ecrireCache(cle, reponse);
  return reponse;
}

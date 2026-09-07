// Fournisseurs de génération — mode 1 du moteur de réponse.
//
// Le principe : UNE interface, PLUSIEURS fournisseurs, et rien à recoder le jour
// où Julien crée une clé quelque part. Le moteur n'a pas de fournisseur
// privilégié — il prend le premier configuré, dans l'ordre, et bascule sur le
// suivant si celui-là échoue.
//
// Ce module ne connaît pas le contrat de réponse (consigne système, schéma de
// perspectives) : `lib/rag.ts` le lui passe. C'est voulu — le contrat est le
// cœur du projet et doit rester au même endroit que les garde-fous qui le font
// respecter, pas éparpillé dans les adaptateurs de fournisseurs.
//
// Deux dialectes suffisent à couvrir le marché :
//   - « anthropic » : POST /v1/messages, sortie forcée par appel d'outil ;
//   - « openai » : POST /v1/chat/completions, sortie demandée en JSON. C'est le
//     dialecte de Groq, Google AI Studio, Mistral, Cerebras, OpenRouter,
//     Together, DeepSeek, Fireworks, Ollama, LM Studio… et de tout ce qui
//     s'annonce « compatible OpenAI ». La sortie n'y est pas garantie
//     structurée, d'où l'analyse tolérante de `lib/analyse-sortie.ts`.

import { analyserSortie, type SortieBrute } from "@/lib/analyse-sortie";
import { SITE_URL } from "@/lib/site-config";

export type Dialecte = "anthropic" | "openai";

export interface DescripteurFournisseur {
  id: string;
  nom: string;
  dialecte: Dialecte;
  /** Variable d'environnement portant la clé. Sa présence suffit à activer le fournisseur. */
  variable_cle: string;
  /** Variable facultative pour changer de modèle sans toucher au code. */
  variable_modele: string;
  /** Modèle employé si la variable ci-dessus n'est pas posée. */
  modele_defaut: string;
  /** URL de l'API. Pour le fournisseur générique, elle vient de l'environnement. */
  url: string | null;
  /** Variable d'environnement portant l'URL (fournisseur générique uniquement). */
  variable_url?: string;
  /** Page exacte où l'on crée la clé. */
  url_creation_cle: string;
  /** Ce que le palier gratuit permet réellement, en une phrase, sans promesse. */
  palier_gratuit: string;
}

/**
 * Fournisseurs câblés, dans l'ordre de repli par défaut.
 *
 * L'ordre n'est pas arbitraire : le fournisseur générique passe en premier
 * parce qu'il n'existe que si on l'a explicitement configuré ; viennent ensuite
 * ceux dont le palier gratuit est réel, du plus généreux au plus contraint ;
 * Anthropic est en dernier parce qu'il n'a PAS de palier gratuit et qu'une
 * réponse doit coûter de l'argent en dernier recours, jamais en premier.
 *
 * Les paliers gratuits changent sans préavis : les phrases ci-dessous décrivent
 * ce que le fournisseur annonçait à la date de ce fichier, elles ne valent pas
 * engagement. Vérifier la page de tarification avant de compter dessus.
 */
export const FOURNISSEURS: DescripteurFournisseur[] = [
  {
    id: "generique",
    nom: "Fournisseur compatible OpenAI (configuré à la main)",
    dialecte: "openai",
    variable_cle: "ATLAS_LLM_CLE",
    variable_modele: "ATLAS_LLM_MODELE",
    modele_defaut: "",
    url: null,
    variable_url: "ATLAS_LLM_URL",
    url_creation_cle: "— dépend du fournisseur choisi —",
    palier_gratuit:
      "Couvre tout ce qui expose POST /v1/chat/completions : DeepSeek, Fireworks, Nebius, " +
      "un serveur local (Ollama, LM Studio, vLLM) où la génération est gratuite et hors ligne.",
  },
  {
    id: "groq",
    nom: "Groq",
    dialecte: "openai",
    variable_cle: "GROQ_API_KEY",
    variable_modele: "GROQ_MODELE",
    modele_defaut: "llama-3.3-70b-versatile",
    url: "https://api.groq.com/openai/v1/chat/completions",
    url_creation_cle: "https://console.groq.com/keys",
    palier_gratuit:
      "Palier gratuit sans carte bancaire, limité en requêtes par minute et par jour selon le modèle. " +
      "Le plus rapide des fournisseurs de cette liste.",
  },
  {
    id: "google",
    nom: "Google AI Studio (Gemini)",
    dialecte: "openai",
    variable_cle: "GOOGLE_API_KEY",
    variable_modele: "GOOGLE_MODELE",
    modele_defaut: "gemini-2.5-flash",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    url_creation_cle: "https://aistudio.google.com/apikey",
    palier_gratuit:
      "Palier gratuit sans carte bancaire sur les modèles Flash, limité en requêtes par minute et par jour. " +
      "Attention : sur le palier gratuit, Google se réserve l'usage des requêtes pour améliorer ses modèles — " +
      "à ne pas employer si les questions posées doivent rester confidentielles.",
  },
  {
    id: "mistral",
    nom: "Mistral AI",
    dialecte: "openai",
    variable_cle: "MISTRAL_API_KEY",
    variable_modele: "MISTRAL_MODELE",
    modele_defaut: "mistral-small-latest",
    url: "https://api.mistral.ai/v1/chat/completions",
    url_creation_cle: "https://console.mistral.ai/api-keys",
    palier_gratuit:
      "Palier « Expérimenter » gratuit, limité en requêtes, soumis au partage des données pour " +
      "l'entraînement. Fournisseur européen, hébergement UE — le seul de la liste dans ce cas.",
  },
  {
    id: "cerebras",
    nom: "Cerebras",
    dialecte: "openai",
    variable_cle: "CEREBRAS_API_KEY",
    variable_modele: "CEREBRAS_MODELE",
    modele_defaut: "llama-3.3-70b",
    url: "https://api.cerebras.ai/v1/chat/completions",
    url_creation_cle: "https://cloud.cerebras.ai (menu « API Keys »)",
    palier_gratuit: "Palier gratuit avec des limites par minute plus basses que les comptes payants.",
  },
  {
    id: "openrouter",
    nom: "OpenRouter",
    dialecte: "openai",
    variable_cle: "OPENROUTER_API_KEY",
    variable_modele: "OPENROUTER_MODELE",
    modele_defaut: "meta-llama/llama-3.3-70b-instruct:free",
    url: "https://openrouter.ai/api/v1/chat/completions",
    url_creation_cle: "https://openrouter.ai/settings/keys",
    palier_gratuit:
      "Routeur vers des dizaines de fournisseurs. Les modèles dont l'identifiant se termine par « :free » " +
      "sont gratuits, avec un plafond quotidien de requêtes. Utile pour essayer plusieurs modèles avec une seule clé.",
  },
  {
    id: "anthropic",
    nom: "Anthropic",
    dialecte: "anthropic",
    variable_cle: "ANTHROPIC_API_KEY",
    variable_modele: "ATLAS_MODELE_REPONSE",
    modele_defaut: "claude-sonnet-4-5",
    url: "https://api.anthropic.com/v1/messages",
    url_creation_cle: "https://console.anthropic.com/settings/keys",
    palier_gratuit:
      "AUCUN palier gratuit : chaque question est facturée au token. Conservé parce que c'est le seul " +
      "fournisseur de la liste qui garantit une sortie structurée par appel d'outil. Poser une limite " +
      "de dépense mensuelle dans la console avant de l'activer.",
  },
];

export interface FournisseurActif {
  descripteur: DescripteurFournisseur;
  cle: string;
  modele: string;
  url: string;
}

/**
 * Fournisseurs réellement utilisables, dans l'ordre de repli.
 *
 * `ATLAS_GENERATION_ORDRE` permet de forcer l'ordre (liste d'identifiants séparés
 * par des virgules) : c'est ce qui permet de préférer un fournisseur précis sans
 * retirer la clé des autres.
 */
export function fournisseursActifs(env: NodeJS.ProcessEnv = process.env): FournisseurActif[] {
  const actifs: FournisseurActif[] = [];
  for (const descripteur of FOURNISSEURS) {
    const url = descripteur.url ?? (descripteur.variable_url ? env[descripteur.variable_url] : undefined);
    const cle = env[descripteur.variable_cle];
    const modele = env[descripteur.variable_modele] || descripteur.modele_defaut;
    // Une URL locale (Ollama) n'a pas de clé : pour le fournisseur générique, une
    // URL et un modèle suffisent.
    const cleRequise = descripteur.id !== "generique";
    if (!url || !modele) continue;
    if (cleRequise && !cle) continue;
    actifs.push({ descripteur, cle: cle ?? "", modele, url });
  }

  const ordre = (env.ATLAS_GENERATION_ORDRE ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (ordre.length === 0) return actifs;
  const rang = new Map(ordre.map((id, i) => [id, i]));
  return actifs
    .filter((f) => rang.has(f.descripteur.id))
    .sort((a, b) => (rang.get(a.descripteur.id) ?? 0) - (rang.get(b.descripteur.id) ?? 0));
}

/** Contrat de réponse, fourni par lib/rag.ts — voir CONSIGNE_SYSTEME et OUTIL_REPONSE. */
export interface ContratGeneration {
  systeme: string;
  /** Schéma JSON de la sortie attendue (identique pour les deux dialectes). */
  schema: Record<string, unknown>;
  nomOutil: string;
  descriptionOutil: string;
  message: string;
  maxTokens: number;
  temperature: number;
  delaiMs: number;
}

export type ResultatFournisseur =
  | { ok: true; sortie: SortieBrute; tokens_entree: number; tokens_sortie: number; reparations: string[] }
  | { ok: false; erreur: string };

async function fetchBorne(url: string, init: RequestInit, delaiMs: number): Promise<Response> {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), delaiMs);
  try {
    return await fetch(url, { ...init, signal: controleur.signal });
  } finally {
    clearTimeout(minuterie);
  }
}

/** Dialecte Anthropic : sortie structurée garantie par `tool_choice`. */
async function appelerAnthropic(f: FournisseurActif, contrat: ContratGeneration): Promise<ResultatFournisseur> {
  let reponse: Response;
  try {
    reponse = await fetchBorne(
      f.url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": f.cle, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: f.modele,
          max_tokens: contrat.maxTokens,
          temperature: contrat.temperature,
          system: contrat.systeme,
          tools: [{ name: contrat.nomOutil, description: contrat.descriptionOutil, input_schema: contrat.schema }],
          tool_choice: { type: "tool", name: contrat.nomOutil },
          messages: [{ role: "user", content: contrat.message }],
        }),
      },
      contrat.delaiMs
    );
  } catch (erreur) {
    return { ok: false, erreur: `${f.descripteur.nom} injoignable : ${(erreur as Error).message}` };
  }

  const donnees = (await reponse.json().catch(() => ({}))) as {
    content?: { type?: string; name?: string; input?: unknown }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
    stop_reason?: string;
  };
  if (!reponse.ok) {
    return { ok: false, erreur: `${f.descripteur.nom} a refusé la requête : ${donnees.error?.message ?? `HTTP ${reponse.status}`}` };
  }
  const bloc = (donnees.content ?? []).find((c) => c.type === "tool_use" && c.name === contrat.nomOutil);
  if (!bloc || typeof bloc.input !== "object" || bloc.input === null) {
    return {
      ok: false,
      erreur: `${f.descripteur.nom} n'a pas rendu de réponse structurée (stop_reason : ${donnees.stop_reason ?? "inconnu"}).`,
    };
  }
  return {
    ok: true,
    sortie: bloc.input as SortieBrute,
    tokens_entree: donnees.usage?.input_tokens ?? 0,
    tokens_sortie: donnees.usage?.output_tokens ?? 0,
    reparations: [],
  };
}

/**
 * Dialecte compatible OpenAI. Deux différences avec Anthropic, toutes deux
 * assumées :
 *   - la sortie structurée n'est pas garantie : on la DEMANDE
 *     (`response_format: json_object`) et on ANALYSE tolérament ce qui revient ;
 *   - tous les fournisseurs n'acceptent pas `response_format`. Un refus en 400
 *     déclenche une seconde tentative sans lui, plutôt que de faire échouer le
 *     fournisseur pour un paramètre facultatif.
 */
async function appelerOpenAI(f: FournisseurActif, contrat: ContratGeneration): Promise<ResultatFournisseur> {
  const message = [
    contrat.message,
    "",
    "FORMAT DE SORTIE — impératif. Réponds UNIQUEMENT par un objet JSON valide, sans texte avant",
    "ni après, sans bloc de code Markdown, conforme à ce schéma :",
    JSON.stringify(contrat.schema),
  ].join("\n");

  const corpsDeBase: Record<string, unknown> = {
    model: f.modele,
    max_tokens: contrat.maxTokens,
    temperature: contrat.temperature,
    messages: [
      { role: "system", content: contrat.systeme },
      { role: "user", content: message },
    ],
  };

  for (const avecFormat of [true, false]) {
    const corps = avecFormat ? { ...corpsDeBase, response_format: { type: "json_object" } } : corpsDeBase;
    const entetes: Record<string, string> = { "Content-Type": "application/json" };
    if (f.cle) entetes.Authorization = `Bearer ${f.cle}`;
    // OpenRouter attribue les requêtes au site appelant et s'en sert pour ses
    // classements. Ces deux en-têtes ne conditionnent pas l'accès, mais sans eux
    // l'application apparaît en « anonyme » dans le tableau de bord du compte.
    if (f.descripteur.id === "openrouter") {
      entetes["HTTP-Referer"] = SITE_URL;
      entetes["X-Title"] = "Atlas Humain × IA";
    }

    let reponse: Response;
    try {
      reponse = await fetchBorne(f.url, { method: "POST", headers: entetes, body: JSON.stringify(corps) }, contrat.delaiMs);
    } catch (erreur) {
      return { ok: false, erreur: `${f.descripteur.nom} injoignable : ${(erreur as Error).message}` };
    }

    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      if (avecFormat && reponse.status === 400) continue; // paramètre refusé : on réessaie sans
      return {
        ok: false,
        erreur: `${f.descripteur.nom} a refusé la requête (HTTP ${reponse.status}) : ${detail.slice(0, 200)}`,
      };
    }

    const donnees = (await reponse.json().catch(() => ({}))) as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const contenu = donnees.choices?.[0]?.message?.content;
    const texte = typeof contenu === "string" ? contenu : Array.isArray(contenu) ? contenu.map((c) => (c as { text?: string })?.text ?? "").join("") : "";
    const analyse = analyserSortie(texte);
    if (!analyse.ok) {
      return { ok: false, erreur: `${f.descripteur.nom} a répondu, mais sa sortie n'est pas exploitable : ${analyse.message}` };
    }
    return {
      ok: true,
      sortie: analyse.sortie,
      tokens_entree: donnees.usage?.prompt_tokens ?? 0,
      tokens_sortie: donnees.usage?.completion_tokens ?? 0,
      reparations: analyse.reparations,
    };
  }
  return { ok: false, erreur: `${f.descripteur.nom} a refusé la requête dans les deux formats essayés.` };
}

/** Appelle UN fournisseur. Ne lève jamais : rend `{ ok: false, erreur }`. */
export async function appelerFournisseur(f: FournisseurActif, contrat: ContratGeneration): Promise<ResultatFournisseur> {
  try {
    return f.descripteur.dialecte === "anthropic" ? await appelerAnthropic(f, contrat) : await appelerOpenAI(f, contrat);
  } catch (erreur) {
    return { ok: false, erreur: `${f.descripteur.nom} : ${(erreur as Error).message}` };
  }
}

// POST /api/question — moteur de réponse prédictive (mégaprompt §7.3, MP-4).
//
// GET  /api/question  → état de configuration du moteur (aucun appel payant).
// POST /api/question  → { question: "..." } → réponse structurée en perspectives.
//
// La réponse n'est JAMAIS un verdict unique : c'est un tableau `perspectives`
// conforme au type `Perspective` de lib/types.ts, exactement le même format que
// les 4 questions répondues à la main dans data/seed/questions.json. Toute la
// logique (recherche vectorielle, garde-fous, appel modèle, rattachement des
// sources réelles) vit dans lib/rag.ts ; cette route ne fait que la transporter.
//
// Pourquoi POST et pas GET : la question est une donnée d'entrée libre saisie par
// un visiteur ; on ne veut ni la voir apparaître dans les logs d'URL du CDN, ni
// qu'une page soit mise en cache par le CDN sur la base d'une query string. Le
// cache existe, mais il est en base (atlas_rag_cache_reponses), sous notre contrôle.

import { NextResponse } from "next/server";
import {
  CACHE_TTL_HEURES,
  EMBEDDING_FACTICE,
  ErreurRag,
  MAX_PASSAGES,
  MAX_TOKENS_REPONSE,
  MODELE_EMBEDDING,
  MODELE_REPONSE,
  QUESTION_MAX,
  QUESTION_MIN,
  SEUIL_PERTINENCE,
  SEUIL_SIMILARITE,
  repondreAQuestion,
  validerQuestion,
} from "@/lib/rag";

// Le moteur lit des clés d'API serveur et utilise node:crypto : runtime Node,
// jamais Edge. `force-dynamic` empêche toute tentative de pré-rendu au build,
// qui échouerait faute de variables d'environnement.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTETES: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  // Une réponse RAG ne doit jamais être mise en cache par un intermédiaire :
  // le cache du moteur est en base, avec son TTL et ses compteurs.
  "Cache-Control": "no-store",
};

function erreur(code: string, message: string, statut: number, details?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ erreur: { code, message, ...(details ?? {}) } }, { status: statut, headers: ENTETES });
}

/* -------------------------------------------------------------------------- */
/* Limitation de débit (best effort)                                          */
/* -------------------------------------------------------------------------- */

// Quatrième borne de coût, la plus grossière : empêcher qu'un visiteur (ou un
// robot) enchaîne les questions distinctes et fasse exploser la facture.
// Limite honnête : la mémoire est celle de l'instance serverless courante. Sur
// Vercel, plusieurs instances coexistent, donc le plafond réel est un multiple
// de celui-ci. Ce n'est pas un anti-abus sérieux — c'est un amortisseur. Un vrai
// plafond suppose un compteur partagé (table Supabase ou Upstash), à faire si le
// site prend du trafic.
const FENETRE_MS = 60_000;
const MAX_PAR_FENETRE = 5;
const compteurs = new Map<string, { debut: number; nombre: number }>();

function tropDeRequetes(ip: string): boolean {
  const maintenant = Date.now();
  const entree = compteurs.get(ip);
  if (!entree || maintenant - entree.debut > FENETRE_MS) {
    compteurs.set(ip, { debut: maintenant, nombre: 1 });
    // Purge opportuniste : la Map ne doit pas grandir indéfiniment dans une
    // instance à longue durée de vie.
    if (compteurs.size > 500) {
      for (const [cle, valeur] of compteurs) {
        if (maintenant - valeur.debut > FENETRE_MS) compteurs.delete(cle);
      }
    }
    return false;
  }
  entree.nombre += 1;
  return entree.nombre > MAX_PAR_FENETRE;
}

function adresse(request: Request): string {
  const transmise = request.headers.get("x-forwarded-for");
  if (transmise) return transmise.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "inconnue";
}

/* -------------------------------------------------------------------------- */
/* GET — état du moteur                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Diagnostic sans appel payant : dit si les trois clés attendues sont présentes.
 * Ne renvoie évidemment aucune valeur de clé, seulement des booléens. Sert à
 * l'interface (/questions) pour afficher un message honnête plutôt qu'un champ
 * de saisie qui échouera à la première question.
 */
export async function GET(): Promise<NextResponse> {
  // En mode d'embedding factice (test, cf. lib/embedding-factice.mjs), la clé
  // Voyage n'est ni utilisée ni requise : l'annoncer manquante ferait croire à
  // une configuration cassée alors que le moteur fonctionne.
  const clesManquantes = [
    process.env.NEXT_PUBLIC_SUPABASE_URL ? null : "NEXT_PUBLIC_SUPABASE_URL",
    process.env.SUPABASE_SERVICE_ROLE_KEY ? null : "SUPABASE_SERVICE_ROLE_KEY",
    EMBEDDING_FACTICE || process.env.VOYAGE_API_KEY ? null : "VOYAGE_API_KEY",
    process.env.ANTHROPIC_API_KEY ? null : "ANTHROPIC_API_KEY",
  ].filter(Boolean);

  return NextResponse.json(
    {
      actif: clesManquantes.length === 0,
      cles_manquantes: clesManquantes,
      reglages: {
        modele_embedding: MODELE_EMBEDDING,
        embedding_factice: EMBEDDING_FACTICE,
        modele_reponse: MODELE_REPONSE,
        seuil_similarite: SEUIL_SIMILARITE,
        seuil_pertinence: SEUIL_PERTINENCE,
        max_passages: MAX_PASSAGES,
        max_tokens_reponse: MAX_TOKENS_REPONSE,
        cache_ttl_heures: CACHE_TTL_HEURES,
        question_min: QUESTION_MIN,
        question_max: QUESTION_MAX,
      },
    },
    { status: 200, headers: ENTETES }
  );
}

/* -------------------------------------------------------------------------- */
/* POST — poser une question                                                  */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request): Promise<NextResponse> {
  if (tropDeRequetes(adresse(request))) {
    return erreur(
      "trop_de_requetes",
      `Trop de questions en peu de temps (${MAX_PAR_FENETRE} par minute maximum). Réessayer dans une minute.`,
      429
    );
  }

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return erreur("corps_invalide", "Corps de requête illisible : un objet JSON { \"question\": \"…\" } est attendu.", 400);
  }

  const brut = (corps as { question?: unknown } | null)?.question;
  const controle = validerQuestion(brut);
  if ("erreur" in controle) {
    return erreur("question_invalide", controle.erreur, 400);
  }

  try {
    const reponse = await repondreAQuestion(controle.question);
    // 200 même quand le moteur refuse de répondre : ce n'est pas une erreur
    // technique mais une réponse honnête, et l'interface l'affiche comme telle
    // (diagnostic.statut vaut alors "hors_corpus" ou "corpus_vide").
    return NextResponse.json(reponse, { status: 200, headers: ENTETES });
  } catch (e) {
    if (e instanceof ErreurRag) {
      return erreur(e.code, e.message, e.statut);
    }
    // Message générique côté client, trace complète côté serveur : on ne veut
    // pas qu'une erreur de driver expose l'URL du projet Supabase mutualisé.
    console.error("[/api/question] échec inattendu", e);
    return erreur("erreur_interne", "Le moteur de questions a échoué de façon inattendue.", 500);
  }
}

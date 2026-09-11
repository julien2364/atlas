// POST /api/question — moteur de réponse prédictive (mégaprompt §7.3, MP-4).
//
// GET  /api/question  → état du moteur : index, modes disponibles, fournisseurs.
// POST /api/question  → { question, mode?, retour? } → réponse en perspectives.
//
// La réponse n'est JAMAIS un verdict unique : c'est un tableau `perspectives`
// conforme au type `Perspective` de lib/types.ts, exactement le même format que
// les 9 questions répondues à la main dans data/seed/questions.json. Toute la
// logique (recherche locale, garde-fous, génération, rattachement des sources
// réelles) vit dans lib/rag.ts ; cette route ne fait que la transporter.
//
// Pourquoi POST et pas GET : la question est une donnée d'entrée libre saisie
// par un visiteur ; on ne veut ni la voir apparaître dans les logs d'URL du CDN,
// ni qu'une page soit mise en cache par le CDN sur la base d'une query string.
// Le champ `retour` du mode 2 peut en outre peser plusieurs kilo-octets, ce
// qu'une URL ne porterait pas.

import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ErreurRag,
  QUESTION_MAX,
  QUESTION_MIN,
  etatMoteur,
  repondreAQuestion,
  validerMode,
  validerQuestion,
} from "@/lib/rag";

// Le moteur importe tout le corpus, l'index vectoriel et node:crypto : runtime
// Node, jamais Edge. `force-dynamic` empêche toute tentative de pré-rendu au
// build (la réponse dépend de l'environnement et du corps de la requête).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTETES: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  // Une réponse RAG ne doit jamais être mise en cache par un intermédiaire :
  // le cache du moteur est en mémoire, avec son TTL et son plafond d'entrées.
  "Cache-Control": "no-store",
};

function erreur(code: string, message: string, statut: number, details?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ erreur: { code, message, ...(details ?? {}) } }, { status: statut, headers: ENTETES });
}

/* -------------------------------------------------------------------------- */
/* Limitation de débit (best effort)                                          */
/* -------------------------------------------------------------------------- */

// Amortisseur, pas anti-abus : la mémoire est celle de l'instance serverless
// courante, et plusieurs instances coexistent, donc le plafond réel est un
// multiple de celui-ci. Il compte davantage depuis la refonte : le mode
// extractif et la recherche sont gratuits, mais un fournisseur d'API configuré
// se facture, et rien d'autre n'empêche un robot d'enchaîner les questions.
const FENETRE_MS = 60_000;

/**
 * Questions autorisées par minute et par empreinte d'appelant.
 *
 * Réglable par `ATLAS_QUESTIONS_PAR_MINUTE` : le plafond de 5 protège le site
 * public, mais il rend impossible toute mesure sérieuse du moteur — une
 * campagne de 18 questions met quatre minutes, ou casse à la sixième. Un banc
 * d'essai local pose la variable ; la production ne la pose pas et garde 5.
 */
const MAX_PAR_FENETRE = (() => {
  const brut = Number(process.env.ATLAS_QUESTIONS_PAR_MINUTE);
  return Number.isFinite(brut) && brut >= 1 && brut <= 10_000 ? Math.floor(brut) : 5;
})();
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

/**
 * Empreinte non réversible de l'appelant, pour la limitation de débit.
 *
 * L'adresse IP est une donnée à caractère personnel au sens du RGPD. La conserver en
 * mémoire, même quelques minutes et même sans la journaliser, suppose une base légale
 * et une information du visiteur — et le site n'en avait aucune. Limiter le débit
 * n'exige pourtant pas de savoir QUI appelle : il suffit de distinguer DEUX appelants.
 *
 * L'adresse est donc hachée avec un sel tiré au démarrage du processus et jamais
 * écrit : personne, pas même l'exploitant, ne peut remonter d'une empreinte à une
 * adresse, et le sel disparaît à chaque redéploiement. Le compteur distingue toujours
 * deux visiteurs, ce qui est la seule chose dont il a besoin.
 */
const SEL = randomBytes(32);

function adresse(request: Request): string {
  const transmise = request.headers.get("x-forwarded-for");
  const brute = transmise ? transmise.split(",")[0].trim() : (request.headers.get("x-real-ip") ?? "inconnue");
  if (brute === "inconnue") return "inconnue";
  return createHash("sha256").update(SEL).update(brute, "utf8").digest("hex").slice(0, 32);
}

/* -------------------------------------------------------------------------- */
/* GET — état du moteur                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Diagnostic sans aucun appel payant. Ne renvoie évidemment aucune valeur de
 * clé — seulement des noms de variables, l'état de l'index et la liste des
 * modes réellement utilisables. Sert à l'interface pour afficher un message
 * honnête au lieu d'un champ de saisie qui échouera.
 */
export async function GET(): Promise<NextResponse> {
  const etat = etatMoteur();
  return NextResponse.json(
    {
      actif: etat.actif,
      index: etat.index,
      mode_par_defaut: etat.mode_par_defaut,
      modes_disponibles: etat.modes_disponibles,
      fournisseurs_configures: etat.fournisseurs_configures,
      fournisseurs_connus: etat.fournisseurs_connus,
      reglages: { ...etat.reglages, question_min: QUESTION_MIN, question_max: QUESTION_MAX },
    },
    { status: 200, headers: ENTETES }
  );
}

/* -------------------------------------------------------------------------- */
/* POST — poser une question                                                  */
/* -------------------------------------------------------------------------- */

/** Taille maximale du texte recollé en mode 2 — au-delà, c'est une conversation entière. */
const RETOUR_MAX = 200_000;

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
    return erreur("corps_invalide", 'Corps de requête illisible : un objet JSON { "question": "…" } est attendu.', 400);
  }

  const donnees = (corps ?? {}) as { question?: unknown; mode?: unknown; retour?: unknown };
  const controle = validerQuestion(donnees.question);
  if ("erreur" in controle) {
    return erreur("question_invalide", controle.erreur, 400);
  }

  if (donnees.retour !== undefined && typeof donnees.retour !== "string") {
    return erreur("retour_invalide", "Le champ « retour » doit être une chaîne de caractères.", 400);
  }
  if (typeof donnees.retour === "string" && donnees.retour.length > RETOUR_MAX) {
    return erreur(
      "retour_invalide",
      `Le texte collé dépasse ${RETOUR_MAX.toLocaleString("fr-FR")} caractères : ne coller que la réponse du modèle.`,
      400
    );
  }

  try {
    const reponse = await repondreAQuestion(controle.question, {
      mode: validerMode(donnees.mode),
      retour: typeof donnees.retour === "string" ? donnees.retour : undefined,
    });
    // 200 même quand le moteur refuse de répondre ou attend un collage : ce
    // n'est pas une erreur technique mais une réponse honnête, et l'interface
    // l'affiche comme telle (diagnostic.statut le dit).
    return NextResponse.json(reponse, { status: 200, headers: ENTETES });
  } catch (e) {
    if (e instanceof ErreurRag) {
      return erreur(e.code, e.message, e.statut);
    }
    // Message générique côté client, trace complète côté serveur.
    console.error("[/api/question] échec inattendu", e);
    return erreur("erreur_interne", "Le moteur de questions a échoué de façon inattendue.", 500);
  }
}

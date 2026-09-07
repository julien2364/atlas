// Analyse TOLÉRANTE d'une réponse de modèle rendue en texte libre.
//
// Deux appelants, un seul analyseur :
//   - le mode « prompt sortie / prompt résultat » : l'utilisateur copie un prompt,
//     le colle dans le chat de son choix, et RECOLLE ici ce que le modèle a
//     répondu. Ce qui revient n'est presque jamais du JSON nu : il y a un
//     « Bien sûr, voici : » devant, un bloc ```json autour, des guillemets
//     typographiques à la place des droits, une virgule en trop, un commentaire
//     après. Rien de tout cela ne doit produire une exception ;
//   - les fournisseurs d'API qui ne savent pas forcer une sortie structurée et
//     répondent en prose contenant du JSON.
//
// Principe : une suite de réparations, de la plus conservatrice à la plus
// intrusive, chacune suivie d'une tentative d'analyse. La première qui passe
// gagne, et les réparations appliquées sont rendues à l'appelant pour être
// affichées — l'utilisateur doit savoir que sa réponse a été rafistolée.
//
// Ce module ne connaît RIEN du corpus : il rend une structure brute, que
// `lib/rag.ts` valide ensuite (identifiants de fiches autorisés, sources
// réelles, niveaux de confiance). Un collage malveillant ne peut donc pas
// injecter de source : il ne franchit pas cette seconde étape.

export interface SortieBrute {
  reformulation?: unknown;
  perspectives?: unknown;
  angles_morts?: unknown;
}

export type ResultatAnalyse =
  | { ok: true; sortie: SortieBrute; reparations: string[] }
  | { ok: false; message: string };

/**
 * Extrait le contenu du premier bloc de code Markdown, s'il y en a un.
 * Accepte ```json, ```JSON, ``` nu, et le cas fréquent du bloc non refermé.
 */
function contenuDuBloc(texte: string): string | null {
  const ouverture = /```[a-zA-Z]*\s*\n?/.exec(texte);
  if (!ouverture) return null;
  const debut = ouverture.index + ouverture[0].length;
  const fermeture = texte.indexOf("```", debut);
  return fermeture === -1 ? texte.slice(debut) : texte.slice(debut, fermeture);
}

/**
 * Extrait la plus grande structure JSON équilibrée du texte, en respectant les
 * chaînes et les échappements — un simple `indexOf("}")` couperait au premier
 * accolade fermante rencontrée dans une valeur textuelle.
 */
function structureEquilibree(texte: string, ouvrant: "{" | "["): string | null {
  const fermant = ouvrant === "{" ? "}" : "]";
  const debut = texte.indexOf(ouvrant);
  if (debut === -1) return null;
  let profondeur = 0;
  let dansChaine = false;
  let echappe = false;
  for (let i = debut; i < texte.length; i += 1) {
    const c = texte[i];
    if (echappe) {
      echappe = false;
      continue;
    }
    if (c === "\\") {
      if (dansChaine) echappe = true;
      continue;
    }
    if (c === '"') {
      dansChaine = !dansChaine;
      continue;
    }
    if (dansChaine) continue;
    if (c === ouvrant) profondeur += 1;
    else if (c === fermant) {
      profondeur -= 1;
      if (profondeur === 0) return texte.slice(debut, i + 1);
    }
  }
  return null;
}

/** Retire les virgules terminales avant `}` ou `]` — l'erreur de JSON la plus courante. */
function sansVirgulesTerminales(texte: string): string {
  return texte.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Remplace les guillemets typographiques doubles par des guillemets droits.
 *
 * Volontairement limité à « " » et « " » (U+201C/U+201D) : ce sont ceux qu'un
 * traitement de texte ou une interface de chat substitue AUX DÉLIMITEURS JSON.
 * Les chevrons français « » et l'apostrophe courbe ne cassent aucune analyse et
 * appartiennent au texte de la réponse : les toucher abîmerait le contenu pour
 * rien.
 */
function guillemetsDroits(texte: string): string {
  return texte.replace(/[“”]/g, '"');
}

/** Une tentative d'analyse, avec le nom de la réparation appliquée. */
interface Tentative {
  nom: string | null;
  texte: string;
}

function tentatives(brut: string): Tentative[] {
  const base = brut.trim();
  const bloc = contenuDuBloc(base);

  // Découpes candidates, de la plus fidèle à la plus interventionniste. L'OBJET
  // passe avant le TABLEAU : extraire le seul tableau de perspectives marche
  // aussi, mais perd `reformulation` et `angles_morts` au passage. Ne s'y rabattre
  // que si l'objet entier ne peut vraiment pas être lu.
  const decoupes: Tentative[] = [{ nom: null, texte: base }];
  if (bloc) decoupes.push({ nom: "bloc de code Markdown retiré", texte: bloc.trim() });
  for (const source of bloc ? [bloc, base] : [base]) {
    const objet = structureEquilibree(source, "{");
    if (objet) decoupes.push({ nom: "texte autour du JSON écarté", texte: objet });
  }
  for (const source of bloc ? [bloc, base] : [base]) {
    const tableau = structureEquilibree(source, "[");
    if (tableau) decoupes.push({ nom: "tableau de perspectives extrait", texte: tableau });
  }

  // Pour CHAQUE découpe, ses réparations dans la foulée. Entrelacer ainsi plutôt
  // que de repousser toutes les réparations à la fin est ce qui permet à
  // « objet entier, guillemets redressés » de l'emporter sur « tableau seul,
  // intact » : le premier garde toute la réponse, le second l'ampute.
  const liste: Tentative[] = [];
  for (const decoupe of decoupes) {
    liste.push(decoupe);
    const variantes: [string, string][] = [];
    const droits = guillemetsDroits(decoupe.texte);
    if (droits !== decoupe.texte) variantes.push(["guillemets typographiques redressés", droits]);
    const nettoye = sansVirgulesTerminales(droits);
    if (nettoye !== droits) {
      variantes.push([
        droits === decoupe.texte
          ? "virgules superflues retirées"
          : "guillemets typographiques redressés, virgules superflues retirées",
        nettoye,
      ]);
    }
    for (const [nom, texte] of variantes) {
      liste.push({ nom: [decoupe.nom, nom].filter(Boolean).join(", "), texte });
    }
  }
  return liste;
}

/** Une perspective plausible : au minimum un nom de modèle et une réponse. */
function ressembleAUnePerspective(valeur: unknown): boolean {
  if (typeof valeur !== "object" || valeur === null) return false;
  const objet = valeur as Record<string, unknown>;
  return typeof objet.modele === "string" || typeof objet.reponse === "string";
}

/** Ramène ce qui a été analysé à la forme `{ reformulation, perspectives, angles_morts }`. */
function normaliser(valeur: unknown): SortieBrute | null {
  if (Array.isArray(valeur)) {
    return valeur.some(ressembleAUnePerspective) ? { perspectives: valeur } : null;
  }
  if (typeof valeur !== "object" || valeur === null) return null;
  const objet = valeur as Record<string, unknown>;

  if (Array.isArray(objet.perspectives)) return objet as SortieBrute;

  // Le modèle a rendu UNE perspective au lieu d'un tableau. On l'accepte et on
  // la range dans un tableau : `lib/rag.ts` émettra ensuite l'avertissement
  // « une seule perspective » prévu par la règle de neutralité active.
  if (ressembleAUnePerspective(objet)) return { perspectives: [objet] };

  // Certaines interfaces enveloppent la réponse : { "resultat": { … } }.
  for (const enveloppe of ["resultat", "result", "reponse", "response", "data", "output"]) {
    if (objet[enveloppe] && typeof objet[enveloppe] === "object") {
      const interieur = normaliser(objet[enveloppe]);
      if (interieur) return interieur;
    }
  }
  return null;
}

/**
 * Analyse un retour de modèle. Ne lève JAMAIS : rend un message en français
 * quand rien d'exploitable n'a pu être tiré du texte.
 */
export function analyserSortie(brut: unknown): ResultatAnalyse {
  if (typeof brut !== "string" || brut.trim().length === 0) {
    return { ok: false, message: "Rien n'a été collé : le champ de retour est vide." };
  }
  if (brut.length > 200_000) {
    return {
      ok: false,
      message: "Le texte collé dépasse 200 000 caractères. Ne coller que la réponse du modèle, pas toute la conversation.",
    };
  }

  const essais = tentatives(brut);
  const reparationsTentees = new Set<string>();
  for (const essai of essais) {
    if (essai.nom) reparationsTentees.add(essai.nom);
    let analyse: unknown;
    try {
      analyse = JSON.parse(essai.texte);
    } catch {
      continue;
    }
    const sortie = normaliser(analyse);
    if (!sortie) continue;
    const perspectives = Array.isArray(sortie.perspectives) ? sortie.perspectives : [];
    if (perspectives.length === 0) {
      return {
        ok: false,
        message:
          "Le JSON collé a bien été lu, mais son tableau « perspectives » est vide. " +
          "Le modèle a peut-être refusé de répondre : relire sa réponse avant de la recoller.",
      };
    }
    if (!perspectives.some(ressembleAUnePerspective)) {
      return {
        ok: false,
        message:
          "Le JSON collé contient un tableau « perspectives », mais aucune entrée ne porte de champ " +
          "« modele » ni « reponse ». Le gabarit demandé par le prompt n'a pas été suivi.",
      };
    }
    return { ok: true, sortie, reparations: essai.nom ? essai.nom.split(", ") : [] };
  }

  // Message de diagnostic utile : on dit ce qu'on a vu, pas seulement que ça a raté.
  const apercu = brut.trim().slice(0, 80).replace(/\s+/g, " ");
  const contientAccolade = brut.includes("{");
  return {
    ok: false,
    message: contientAccolade
      ? "Le texte collé contient bien des accolades mais n'a pas pu être lu comme du JSON, même après " +
        "avoir retiré le bloc de code, le texte autour, les guillemets typographiques et les virgules " +
        `superflues. Début du texte reçu : « ${apercu}… ». Recopier la réponse du modèle en entier, ` +
        "du premier « { » au dernier « } »."
      : "Le texte collé ne contient aucun objet JSON. Le prompt demande une réponse au format JSON : " +
        `vérifier que le modèle l'a bien produite. Début du texte reçu : « ${apercu}… ».`,
  };
}

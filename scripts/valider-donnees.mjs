/*
 * Validateur d'intégrité du corpus `data/seed/` — garde-fou anti-régression.
 *
 * Rôle dans le projet
 * -------------------
 * Le référentiel ATLAS Humain × IA est alimenté par plusieurs canaux qui écrivent
 * tous dans les mêmes fichiers JSON : génération initiale (scripts/generate-seed.mjs),
 * documentation en masse (scripts/documentation-recherche.mjs), veille RSS
 * (scripts/veille-rss.mjs) et surtout des éditions humaines à la main. Chacun de ces
 * canaux peut casser silencieusement le corpus : un id dupliqué après un copier-coller,
 * un gap qui pointe vers une fiche renommée, un enum mal orthographié qui fait
 * disparaître une fiche d'une page de filtre sans aucune erreur à l'exécution.
 * Next.js ne lève rien — les fiches sont lues comme du JSON, pas validées par le
 * typage TypeScript de `lib/types.ts`, qui n'existe qu'à la compilation.
 *
 * Ce script est donc la seule vérification qui applique réellement `lib/types.ts`
 * aux données. Il est lancé par le cron qualité et AVANT CHAQUE PUBLICATION : il doit
 * rester hors ligne (aucun appel réseau, même pour vérifier une URL) et rapide, pour
 * pouvoir tourner en CI sur chaque commit sans dépendance ni quota externe.
 *
 * Usage
 * -----
 *   node scripts/valider-donnees.mjs              # rapport lisible en français
 *   node scripts/valider-donnees.mjs --json       # sortie machine, rien d'autre sur stdout
 *   node scripts/valider-donnees.mjs --strict     # les avertissements deviennent bloquants
 *   node scripts/valider-donnees.mjs --racine=/chemin/vers/copie   # valider une copie
 *
 * Code de sortie : 1 s'il existe au moins une ERREUR, 0 sinon. Les AVERTISSEMENTS ne
 * font jamais échouer le run sauf avec `--strict` (utile pour un audit de qualité
 * ponctuel, alors que la CI de tous les jours ne doit bloquer que sur du vrai cassé).
 *
 * Distinction ERREUR / AVERTISSEMENT — c'est le choix structurant du script
 * ------------------------------------------------------------------------
 * ERREUR       = le corpus est *incohérent* : JSON illisible, id dupliqué, référence
 *                pendante, enum inconnu, date impossible ou future, champ obligatoire
 *                absent. Ces cas cassent l'application ou mentent au lecteur ; ils ne
 *                doivent jamais atteindre la production.
 * AVERTISSEMENT = le corpus est *cohérent mais incomplet* : fiche encore à documenter,
 *                sous-objet dont les tableaux d'exemples/sources ne sont pas remplis,
 *                fiche documentée sans aucune source cliquable, contenu très court.
 *                C'est du travail éditorial restant, pas une régression : le signaler
 *                sans bloquer évite que l'équipe prenne l'habitude de contourner la CI.
 *                `--strict` permet de traiter cette dette comme bloquante quand on veut.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration & arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const SORTIE_JSON = args.includes("--json");
const MODE_STRICT = args.includes("--strict");

// La racine est résolue depuis l'emplacement du script et non depuis le cwd :
// le cron qualité et la CI ne lancent pas forcément la commande depuis la racine du
// dépôt. `--racine=` sert aux tests sur une copie jetable (on ne touche jamais
// data/seed/ pour éprouver le validateur).
const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = args.find((a) => a.startsWith("--racine="))?.split("=").slice(1).join("=") ?? path.resolve(ICI, "..");
const SEED = path.join(RACINE, "data", "seed");

// Nombre maximum de lignes affichées par catégorie : au-delà, le rapport devient
// illisible et on perd l'information utile dans le bruit (un renommage d'axe peut
// produire 267 lignes identiques). Le compteur final donne toujours le total exact.
const MAX_LIGNES = 30;

// Seuil de « contenu probablement trop maigre » pour une fiche déclarée documentée.
// 80 caractères ≈ une phrase : en dessous, le champ est presque sûrement un
// placeholder ou un reste de génération automatique, pas une rédaction.
const SEUIL_CONTENU_COURT = 80;

// ---------------------------------------------------------------------------
// Enums — recopiés depuis lib/types.ts, qui reste la source de vérité.
// Toute évolution de type doit être répercutée ici, sinon le validateur rejettera
// des données pourtant légitimes (c'est volontairement un rappel manuel : on veut
// qu'un changement de vocabulaire du référentiel soit un acte conscient).
// ---------------------------------------------------------------------------

const STATUTS = ["a_documenter", "documente", "verifie_recemment", "a_re_auditer"];
const NIVEAUX_CONFIANCE = ["fait_verifie", "consensus_scientifique", "opinion_majoritaire", "hypothese_prospective"];
const AXES_HUMAINS = ["social", "psychologique", "philosophique", "evolution", "serenite"];
const AXES_IA = [
  "generatif_raisonnement",
  "agentique",
  "scientifique",
  "sectoriel",
  "limites",
  "predictif_data_science",
];
const SECTEURS_USAGE = ["science", "education", "recherche", "industrie", "pharmaceutique", "gouvernement"];
const SUBSTITUABILITES = [
  "remplacable_totalement",
  "remplacable_avec_supervision",
  "non_remplacable",
  "remplacable_avec_autre_technologie",
];
const CONFIANCES_GAP = ["elevee", "moyenne", "faible"];
const TYPES_SOURCE = ["primaire", "secondaire"];
const TYPES_CHANGELOG = ["ajout", "mise_a_jour", "correction", "evolution_structurelle"];
const TYPES_SOURCE_VEILLE = ["rss", "spiderfoot"];

// Statuts qui engagent le référentiel vis-à-vis du lecteur : une fiche affichée comme
// documentée doit tenir ses promesses (contenu rempli, au moins une source).
// `a_documenter` est au contraire un aveu explicite d'incomplétude, donc toléré.
const STATUTS_PUBLIES = ["documente", "verifie_recemment", "a_re_auditer"];

// Champs de contenu rédactionnel par référentiel : ce sont eux qui doivent être
// remplis quand le statut est publié, et eux que l'on mesure pour le seuil de 80 car.
const CONTENUS_HUMAINE = ["these_centrale", "apport", "limites_critiques"];
const CONTENUS_IA = ["limites_connues"];
const CONTENUS_GAP = [
  "apport_ia",
  "mecanisme",
  "amelioration_possible",
  "mode_interaction",
  "scenario_present",
  "scenario_5ans",
  "scenario_15_20ans",
];

// ---------------------------------------------------------------------------
// Collecte des constats
// ---------------------------------------------------------------------------

const erreurs = [];
const avertissements = [];
/** Couverture par fichier : total / documentées / à documenter. */
const couverture = {};

function erreur(fichier, id, champ, message) {
  erreurs.push({ fichier, id, champ, message });
}

function avertissement(fichier, id, champ, message) {
  avertissements.push({ fichier, id, champ, message });
}

// ---------------------------------------------------------------------------
// Petits utilitaires de validation
// ---------------------------------------------------------------------------

/** Une chaîne « présente » = string non vide une fois les espaces retirés. */
function chaineRemplie(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function tableauRempli(v) {
  return Array.isArray(v) && v.length > 0;
}

/**
 * Date ISO stricte AAAA-MM-JJ ET réellement existante.
 * On ne se contente pas de la regex : "2026-02-30" la passe alors que la date n'existe
 * pas. Le re-formatage via Date permet de rejeter ces dates fantômes, qui viennent
 * typiquement d'une saisie manuelle ou d'un décalage de fuseau lors d'une génération.
 */
function dateISOValide(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Le changelog mélange historiquement deux formes : date seule ("2026-09-06") et
 * datetime complet ("2026-09-05T00:00:00Z"). Les deux sont de l'ISO 8601 valide et
 * les rejeter reviendrait à signaler comme cassé un corpus qui ne l'est pas — on
 * accepte donc les deux, et on ne compare que la partie jour.
 */
function dateISOSouple(v) {
  if (typeof v !== "string") return false;
  if (dateISOValide(v)) return true;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(v)) return false;
  return !Number.isNaN(new Date(v).getTime()) && dateISOValide(v.slice(0, 10));
}

/** Jour courant en UTC — sert de borne « pas de vérification dans le futur ». */
function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * URL http(s) bien formée. Parsing uniquement : AUCUN appel réseau, le validateur
 * doit rester utilisable hors ligne et en CI sans quota. Une URL morte n'est donc pas
 * détectée ici — c'est le rôle de la veille, pas celui d'un garde-fou de commit.
 */
function urlValide(v) {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------

/**
 * Lit et parse un fichier JSON. Toute défaillance (absence, JSON illisible) est une
 * ERREUR remontée dans le rapport plutôt qu'une exception : on veut le bilan complet
 * du corpus en un seul run, pas un arrêt au premier fichier fautif.
 */
function lireJSON(cheminAbsolu, etiquette) {
  if (!existsSync(cheminAbsolu)) {
    erreur(etiquette, null, null, "fichier introuvable");
    return null;
  }
  try {
    return JSON.parse(readFileSync(cheminAbsolu, "utf-8"));
  } catch (e) {
    erreur(etiquette, null, null, `JSON illisible — ${e.message}`);
    return null;
  }
}

/** Charge un fichier attendu comme tableau ; signale et neutralise le cas contraire. */
function lireTableau(cheminAbsolu, etiquette) {
  const data = lireJSON(cheminAbsolu, etiquette);
  if (data === null) return null;
  if (!Array.isArray(data)) {
    erreur(etiquette, null, null, "le fichier doit contenir un tableau JSON à la racine");
    return null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Contrôles transversaux
// ---------------------------------------------------------------------------

/** Unicité des id à l'intérieur d'un même fichier. */
function verifierUniciteLocale(fichier, entrees) {
  const vus = new Set();
  for (const e of entrees) {
    if (!chaineRemplie(e?.id)) continue; // l'absence d'id est signalée ailleurs
    if (vus.has(e.id)) erreur(fichier, e.id, "id", "id dupliqué dans ce fichier");
    vus.add(e.id);
  }
}

/**
 * Unicité des id à l'échelle d'un référentiel entier. Indispensable pour les fiches
 * humaines, éclatées en six fichiers par axe : un même slug dans social_1.json et
 * social_2.json passerait tous les contrôles locaux tout en rendant les gaps ambigus.
 */
function verifierUniciteGlobale(referentiel, entreesParFichier) {
  const vus = new Map(); // id -> premier fichier où on l'a vu
  for (const { fichier, entrees } of entreesParFichier) {
    for (const e of entrees) {
      if (!chaineRemplie(e?.id)) continue;
      if (vus.has(e.id)) {
        erreur(fichier, e.id, "id", `id déjà utilisé dans ${vus.get(e.id)} (référentiel ${referentiel})`);
      } else {
        vus.set(e.id, fichier);
      }
    }
  }
  return vus;
}

/** Champs communs à toutes les fiches : id, nom, statut, date de vérification. */
function verifierEnteteFiche(fichier, fiche, index, { avecNom = true } = {}) {
  const id = chaineRemplie(fiche?.id) ? fiche.id : `(sans id, position ${index})`;

  if (!chaineRemplie(fiche?.id)) erreur(fichier, id, "id", "id manquant ou vide");
  if (avecNom && !chaineRemplie(fiche?.nom)) erreur(fichier, id, "nom", "nom manquant ou vide");

  if (!STATUTS.includes(fiche?.statut)) {
    erreur(fichier, id, "statut", `statut invalide : ${JSON.stringify(fiche?.statut)} (attendu : ${STATUTS.join(", ")})`);
  }

  if (!dateISOValide(fiche?.derniere_verification)) {
    erreur(
      fichier,
      id,
      "derniere_verification",
      `date invalide : ${JSON.stringify(fiche?.derniere_verification)} (attendu AAAA-MM-JJ, date réelle)`
    );
  } else if (fiche.derniere_verification > aujourdhui()) {
    // Comparaison lexicographique : valide sur du AAAA-MM-JJ zéro-padé.
    // Une date future signale presque toujours une faute de frappe ou une horloge
    // décalée, et fait mentir l'affichage « vérifié le … » pour le lecteur.
    erreur(
      fichier,
      id,
      "derniere_verification",
      `date postérieure à aujourd'hui (${fiche.derniere_verification} > ${aujourdhui()})`
    );
  }

  return id;
}

/** Comptage de couverture, alimenté fiche par fiche pour le tableau d'en-tête. */
function compterCouverture(fichier, fiche) {
  const c = (couverture[fichier] ??= { total: 0, documentees: 0, a_documenter: 0 });
  c.total++;
  if (fiche?.statut === "a_documenter") c.a_documenter++;
  else if (STATUTS_PUBLIES.includes(fiche?.statut)) c.documentees++;
}

/**
 * Valide un tableau de Source (lib/types.ts). `contexte` sert à situer le message
 * quand les sources sont imbriquées (usage sectoriel, perspective d'une question).
 * Retourne true si au moins une source porte une URL exploitable.
 */
function verifierSources(fichier, id, champ, sources, { contexte = "" } = {}) {
  const prefixe = contexte ? `${champ} (${contexte})` : champ;
  if (!Array.isArray(sources)) {
    erreur(fichier, id, prefixe, "les sources doivent être un tableau");
    return false;
  }

  let auMoinsUneUrl = false;
  sources.forEach((s, i) => {
    const emplacement = `${prefixe}[${i}]`;
    if (!chaineRemplie(s?.titre)) erreur(fichier, id, emplacement, "titre de source manquant ou vide");
    if (!TYPES_SOURCE.includes(s?.type)) {
      erreur(fichier, id, emplacement, `type de source invalide : ${JSON.stringify(s?.type)} (attendu primaire|secondaire)`);
    }
    // url est optionnelle dans le type — mais si elle est là, elle doit être exploitable.
    if (s?.url !== undefined && s?.url !== null && s?.url !== "") {
      if (!urlValide(s.url)) erreur(fichier, id, emplacement, `url mal formée : ${JSON.stringify(s.url)}`);
      else auMoinsUneUrl = true;
    }
    if (s?.date !== undefined && s?.date !== null && s?.date !== "" && !dateISOSouple(s.date)) {
      erreur(fichier, id, emplacement, `date de source non ISO 8601 : ${JSON.stringify(s.date)}`);
    }
  });

  return auMoinsUneUrl;
}

/**
 * Contrôles de complétude éditoriale communs aux fiches publiées : champs de contenu
 * remplis (ERREUR — une fiche « documentée » avec un champ vide ment au lecteur) et
 * suffisamment étoffés (AVERTISSEMENT — un champ court reste une information, juste
 * une information pauvre, et c'est du travail restant plutôt qu'une régression).
 */
function verifierContenus(fichier, id, fiche, champs) {
  const publiee = STATUTS_PUBLIES.includes(fiche?.statut);
  for (const champ of champs) {
    const valeur = fiche?.[champ];
    if (!chaineRemplie(valeur)) {
      if (publiee) erreur(fichier, id, champ, `champ de contenu vide alors que le statut est "${fiche?.statut}"`);
      continue;
    }
    if (publiee && valeur.trim().length < SEUIL_CONTENU_COURT) {
      avertissement(
        fichier,
        id,
        champ,
        `contenu très court (${valeur.trim().length} car. < ${SEUIL_CONTENU_COURT}) — probablement à étoffer`
      );
    }
  }
}

/** Une fiche encore à documenter n'est pas une faute : c'est du travail identifié. */
function signalerADocumenter(fichier, id, fiche) {
  if (fiche?.statut === "a_documenter") {
    avertissement(fichier, id, "statut", "fiche encore à documenter (travail restant, non bloquant)");
  }
}

// ---------------------------------------------------------------------------
// Référentiel A — fiches humaines
// ---------------------------------------------------------------------------

function validerFichesHumaines() {
  const dossier = path.join(SEED, "fiches_humaines");
  if (!existsSync(dossier)) {
    erreur("fiches_humaines/", null, null, "dossier introuvable");
    return new Map();
  }

  // Le dossier contient aussi un index.ts : on ne prend que les .json.
  const fichiers = readdirSync(dossier)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const parFichier = [];

  for (const nomFichier of fichiers) {
    const etiquette = `fiches_humaines/${nomFichier}`;
    const fiches = lireTableau(path.join(dossier, nomFichier), etiquette);
    if (!fiches) continue;

    verifierUniciteLocale(etiquette, fiches);
    parFichier.push({ fichier: etiquette, entrees: fiches });

    fiches.forEach((fiche, i) => {
      compterCouverture(etiquette, fiche);
      const id = verifierEnteteFiche(etiquette, fiche, i);
      signalerADocumenter(etiquette, id, fiche);

      if (!AXES_HUMAINS.includes(fiche?.axe)) {
        erreur(etiquette, id, "axe", `axe humain invalide : ${JSON.stringify(fiche?.axe)} (attendu : ${AXES_HUMAINS.join(", ")})`);
      }

      verifierContenus(etiquette, id, fiche, CONTENUS_HUMAINE);

      const publiee = STATUTS_PUBLIES.includes(fiche?.statut);
      if (!tableauRempli(fiche?.sources)) {
        // Une affirmation publiée sans aucune source est le défaut le plus grave d'un
        // référentiel dont l'argument est justement la traçabilité.
        if (publiee) erreur(etiquette, id, "sources", "fiche publiée sans aucune source");
      } else {
        const avecUrl = verifierSources(etiquette, id, "sources", fiche.sources);
        if (publiee && !avecUrl) {
          avertissement(etiquette, id, "sources", "aucune source ne porte d'url — la vérification par le lecteur est impossible en un clic");
        }
      }
    });
  }

  return verifierUniciteGlobale("fiches humaines", parFichier);
}

// ---------------------------------------------------------------------------
// Référentiel B — fiches IA
// ---------------------------------------------------------------------------

function validerFichesIA() {
  const etiquette = "fiches_ia.json";
  const fiches = lireTableau(path.join(SEED, etiquette), etiquette);
  if (!fiches) return new Map();

  verifierUniciteLocale(etiquette, fiches);

  fiches.forEach((fiche, i) => {
    compterCouverture(etiquette, fiche);
    const id = verifierEnteteFiche(etiquette, fiche, i);
    signalerADocumenter(etiquette, id, fiche);

    if (!AXES_IA.includes(fiche?.axe)) {
      erreur(etiquette, id, "axe", `axe IA invalide : ${JSON.stringify(fiche?.axe)} (attendu : ${AXES_IA.join(", ")})`);
    }

    verifierContenus(etiquette, id, fiche, CONTENUS_IA);

    const publiee = STATUTS_PUBLIES.includes(fiche?.statut);

    // capacites_cles / usages : structurellement obligatoires (le type les déclare non
    // optionnels) mais légitimement vides pour certaines fiches — une fiche de l'axe
    // "limites" décrit un phénomène transversal (hallucination, biais), pas un outil
    // qui aurait des capacités ou des déploiements sectoriels. On exige donc le
    // TABLEAU (ERREUR s'il manque ou n'en est pas un) sans exiger son remplissage,
    // signalé en AVERTISSEMENT car c'est de la complétude, pas de l'incohérence.
    if (!Array.isArray(fiche?.capacites_cles)) {
      erreur(etiquette, id, "capacites_cles", "capacites_cles doit être un tableau");
    } else {
      fiche.capacites_cles.forEach((c, j) => {
        if (!chaineRemplie(c)) erreur(etiquette, id, `capacites_cles[${j}]`, "capacité vide");
      });
      if (publiee && fiche.capacites_cles.length === 0) {
        avertissement(etiquette, id, "capacites_cles", "aucune capacité clé listée sur une fiche publiée");
      }
    }

    if (!Array.isArray(fiche?.usages)) {
      erreur(etiquette, id, "usages", "usages doit être un tableau");
    } else {
      if (publiee && fiche.usages.length === 0) {
        avertissement(etiquette, id, "usages", "aucun usage sectoriel documenté sur une fiche publiée");
      }
      fiche.usages.forEach((u, j) => {
        const emplacement = `usages[${j}]`;

        if (!SECTEURS_USAGE.includes(u?.secteur)) {
          erreur(etiquette, id, `${emplacement}.secteur`, `secteur invalide : ${JSON.stringify(u?.secteur)} (attendu : ${SECTEURS_USAGE.join(", ")})`);
        }
        if (!chaineRemplie(u?.description)) {
          erreur(etiquette, id, `${emplacement}.description`, "description d'usage vide");
        }
        // TRL : échelle normalisée 1-9. Un TRL hors bornes ou décimal fausse
        // directement les filtres de maturité de l'application.
        if (!Number.isInteger(u?.trl) || u.trl < 1 || u.trl > 9) {
          erreur(etiquette, id, `${emplacement}.trl`, `TRL invalide : ${JSON.stringify(u?.trl)} (entier attendu entre 1 et 9)`);
        }

        // exemples / sources d'un usage : même logique que ci-dessus — le tableau doit
        // exister (ERREUR sinon), son remplissage est de la dette éditoriale.
        if (!Array.isArray(u?.exemples)) {
          erreur(etiquette, id, `${emplacement}.exemples`, "exemples doit être un tableau");
        } else if (u.exemples.length === 0) {
          avertissement(etiquette, id, `${emplacement}.exemples`, `usage "${u?.secteur}" sans aucun exemple concret`);
        }

        if (!Array.isArray(u?.sources)) {
          erreur(etiquette, id, `${emplacement}.sources`, "sources doit être un tableau");
        } else if (u.sources.length === 0) {
          avertissement(etiquette, id, `${emplacement}.sources`, `usage "${u?.secteur}" sans aucune source`);
        } else {
          verifierSources(etiquette, id, "sources", u.sources, { contexte: emplacement });
        }
      });
    }

    if (!tableauRempli(fiche?.sources)) {
      if (publiee) erreur(etiquette, id, "sources", "fiche publiée sans aucune source");
    } else {
      const avecUrl = verifierSources(etiquette, id, "sources", fiche.sources);
      if (publiee && !avecUrl) {
        avertissement(etiquette, id, "sources", "aucune source ne porte d'url — la vérification par le lecteur est impossible en un clic");
      }
    }
  });

  const vus = new Map();
  for (const f of fiches) if (chaineRemplie(f?.id)) vus.set(f.id, etiquette);
  return vus;
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

function validerFichesGap(idsHumaines, idsIA) {
  const etiquette = "fiches_gap.json";
  const gaps = lireTableau(path.join(SEED, etiquette), etiquette);
  if (!gaps) return;

  verifierUniciteLocale(etiquette, gaps);

  // Une paire (humaine, IA) ne doit être analysée qu'une fois : deux gaps sur la même
  // paire produisent deux verdicts de substituabilité potentiellement contradictoires
  // sur la page de comparaison, sans qu'aucun ne soit désigné comme faisant foi.
  const paires = new Map();

  gaps.forEach((gap, i) => {
    compterCouverture(etiquette, gap);
    // Un gap n'a pas de champ `nom` (cf. lib/types.ts) — il est identifié par sa paire.
    const id = verifierEnteteFiche(etiquette, gap, i, { avecNom: false });
    signalerADocumenter(etiquette, id, gap);

    // --- Intégrité référentielle : le cœur du contrôle pour ce fichier.
    // Un id pendant survit à un `next build` mais casse la page de comparaison à
    // l'exécution, ou pire, affiche un gap orphelin sans contexte.
    if (!chaineRemplie(gap?.fiche_humaine_id)) {
      erreur(etiquette, id, "fiche_humaine_id", "référence vers une fiche humaine manquante");
    } else if (idsHumaines.size > 0 && !idsHumaines.has(gap.fiche_humaine_id)) {
      erreur(etiquette, id, "fiche_humaine_id", `référence pendante : aucune fiche humaine "${gap.fiche_humaine_id}"`);
    }

    if (!chaineRemplie(gap?.fiche_ia_id)) {
      erreur(etiquette, id, "fiche_ia_id", "référence vers une fiche IA manquante");
    } else if (idsIA.size > 0 && !idsIA.has(gap.fiche_ia_id)) {
      erreur(etiquette, id, "fiche_ia_id", `référence pendante : aucune fiche IA "${gap.fiche_ia_id}"`);
    }

    if (chaineRemplie(gap?.fiche_humaine_id) && chaineRemplie(gap?.fiche_ia_id)) {
      const cle = `${gap.fiche_humaine_id}|${gap.fiche_ia_id}`;
      if (paires.has(cle)) {
        erreur(etiquette, id, "fiche_humaine_id/fiche_ia_id", `paire déjà analysée par le gap "${paires.get(cle)}"`);
      } else {
        paires.set(cle, id);
      }
    }

    // --- Enums propres au gap
    if (!SUBSTITUABILITES.includes(gap?.substituabilite)) {
      erreur(etiquette, id, "substituabilite", `substituabilité invalide : ${JSON.stringify(gap?.substituabilite)} (attendu : ${SUBSTITUABILITES.join(", ")})`);
    }
    if (!CONFIANCES_GAP.includes(gap?.confiance)) {
      erreur(etiquette, id, "confiance", `confiance invalide : ${JSON.stringify(gap?.confiance)} (attendu : ${CONFIANCES_GAP.join(", ")})`);
    }

    // --- Cohérence « si et seulement si » entre substituabilité et technologie
    // complémentaire. Les deux sens comptent : dire qu'une capacité est remplaçable
    // « par une autre technologie » sans jamais nommer laquelle est une affirmation
    // creuse ; et nommer une technologie de remplacement sous un autre verdict
    // contredit le verdict affiché.
    const aTechno = chaineRemplie(gap?.technologie_complementaire);
    const attenduTechno = gap?.substituabilite === "remplacable_avec_autre_technologie";
    if (attenduTechno && !aTechno) {
      erreur(etiquette, id, "technologie_complementaire", 'substituabilite "remplacable_avec_autre_technologie" sans technologie nommée');
    }
    if (!attenduTechno && aTechno) {
      erreur(
        etiquette,
        id,
        "technologie_complementaire",
        `technologie complémentaire renseignée alors que substituabilite vaut "${gap?.substituabilite}"`
      );
    }

    verifierContenus(etiquette, id, gap, CONTENUS_GAP);

    // --- Champs optionnels du Lot 9 : validés seulement s'ils sont présents
    // (rétrocompatibilité assumée — un gap antérieur au Lot 9 reste valide).
    if (gap?.documents_cles !== undefined) {
      const avecUrl = verifierSources(etiquette, id, "documents_cles", gap.documents_cles);
      if (STATUTS_PUBLIES.includes(gap?.statut) && Array.isArray(gap.documents_cles) && gap.documents_cles.length > 0 && !avecUrl) {
        avertissement(etiquette, id, "documents_cles", "aucun document clé ne porte d'url");
      }
    }
    if (STATUTS_PUBLIES.includes(gap?.statut) && !tableauRempli(gap?.documents_cles)) {
      // Le type FicheGap ne déclare pas de `sources` obligatoire : l'absence de
      // documents clés reste donc un manque éditorial, pas une incohérence de schéma.
      avertissement(etiquette, id, "documents_cles", "gap publié sans aucun document clé");
    }

    if (gap?.axes_prospectifs !== undefined) {
      if (!Array.isArray(gap.axes_prospectifs)) {
        erreur(etiquette, id, "axes_prospectifs", "axes_prospectifs doit être un tableau");
      } else {
        gap.axes_prospectifs.forEach((a, j) => {
          const emplacement = `axes_prospectifs[${j}]`;
          if (!chaineRemplie(a?.nom)) erreur(etiquette, id, `${emplacement}.nom`, "nom d'axe prospectif vide");
          if (!chaineRemplie(a?.description)) erreur(etiquette, id, `${emplacement}.description`, "description d'axe prospectif vide");
          // Nommer explicitement le degré de certitude est le principe même du Lot 9 :
          // un axe prospectif sans niveau de confiance se lirait comme une prédiction.
          if (!NIVEAUX_CONFIANCE.includes(a?.niveau_confiance)) {
            erreur(etiquette, id, `${emplacement}.niveau_confiance`, `niveau de confiance invalide : ${JSON.stringify(a?.niveau_confiance)}`);
          }
        });
      }
    }

    for (const champTableau of ["sous_themes", "axes_recherche"]) {
      if (gap?.[champTableau] !== undefined && !Array.isArray(gap[champTableau])) {
        erreur(etiquette, id, champTableau, `${champTableau} doit être un tableau`);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Questions & perspectives
// ---------------------------------------------------------------------------

function validerQuestions() {
  const etiquette = "questions.json";
  const questions = lireTableau(path.join(SEED, etiquette), etiquette);
  if (!questions) return;

  verifierUniciteLocale(etiquette, questions);

  questions.forEach((q, i) => {
    const id = chaineRemplie(q?.id) ? q.id : `(sans id, position ${i})`;
    if (!chaineRemplie(q?.id)) erreur(etiquette, id, "id", "id manquant ou vide");
    if (!chaineRemplie(q?.question)) erreur(etiquette, id, "question", "libellé de question manquant ou vide");

    // Le principe de neutralité active impose PLUSIEURS lectures : une question à une
    // seule perspective se lit comme un verdict, ce que le référentiel refuse d'être.
    if (!tableauRempli(q?.perspectives)) {
      erreur(etiquette, id, "perspectives", "aucune perspective — une question sans lecture concurrente se lit comme un verdict");
      return;
    }
    if (q.perspectives.length === 1) {
      avertissement(etiquette, id, "perspectives", "une seule perspective — à compléter par au moins une lecture concurrente");
    }

    q.perspectives.forEach((p, j) => {
      const emplacement = `perspectives[${j}]`;
      for (const champ of ["modele", "hypotheses", "etat_actuel", "reponse", "justification", "limites"]) {
        if (!chaineRemplie(p?.[champ])) erreur(etiquette, id, `${emplacement}.${champ}`, `champ "${champ}" manquant ou vide`);
      }
      if (!NIVEAUX_CONFIANCE.includes(p?.niveau_confiance)) {
        erreur(etiquette, id, `${emplacement}.niveau_confiance`, `niveau de confiance invalide : ${JSON.stringify(p?.niveau_confiance)} (attendu : ${NIVEAUX_CONFIANCE.join(", ")})`);
      }
      if (!Array.isArray(p?.sources)) {
        erreur(etiquette, id, `${emplacement}.sources`, "sources doit être un tableau");
      } else if (p.sources.length === 0) {
        // Certaines perspectives renvoient à la méthodologie du référentiel lui-même
        // (ex. « refus de trancher ») et n'ont pas de source externe : on signale sans
        // bloquer plutôt que d'imposer une source artificielle.
        avertissement(etiquette, id, `${emplacement}.sources`, `perspective "${p?.modele}" sans aucune source`);
      } else {
        verifierSources(etiquette, id, "sources", p.sources, { contexte: emplacement });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Veille (sources & file de validation)
// ---------------------------------------------------------------------------

function validerVeilleSources() {
  const etiquette = "veille_sources.json";
  const sources = lireTableau(path.join(SEED, etiquette), etiquette);
  if (!sources) return;

  verifierUniciteLocale(etiquette, sources);

  sources.forEach((s, i) => {
    const id = chaineRemplie(s?.id) ? s.id : `(sans id, position ${i})`;
    if (!chaineRemplie(s?.id)) erreur(etiquette, id, "id", "id manquant ou vide");
    if (!chaineRemplie(s?.nom)) erreur(etiquette, id, "nom", "nom manquant ou vide");
    if (!chaineRemplie(s?.domaine)) erreur(etiquette, id, "domaine", "domaine manquant ou vide");
    if (!TYPES_SOURCE_VEILLE.includes(s?.type)) {
      erreur(etiquette, id, "type", `type de source de veille invalide : ${JSON.stringify(s?.type)} (attendu : ${TYPES_SOURCE_VEILLE.join(", ")})`);
    }
    if (typeof s?.actif !== "boolean") {
      erreur(etiquette, id, "actif", `actif doit être un booléen (reçu ${JSON.stringify(s?.actif)})`);
    }
    if (s?.url !== undefined && s?.url !== null && s?.url !== "" && !urlValide(s.url)) {
      erreur(etiquette, id, "url", `url mal formée : ${JSON.stringify(s.url)}`);
    }
    // scripts/veille-rss.mjs filtre sur `type === "rss" && actif && url` : une source
    // RSS active sans url est silencieusement ignorée par le cron de veille, ce qui
    // est exactement le genre de panne muette que ce validateur doit rendre visible.
    if (s?.type === "rss" && s?.actif === true && !chaineRemplie(s?.url)) {
      erreur(etiquette, id, "url", "source RSS active sans url — elle sera silencieusement ignorée par scripts/veille-rss.mjs");
    }
  });
}

function validerVeilleQueue() {
  const etiquette = "veille_queue.json";
  const queue = lireTableau(path.join(SEED, etiquette), etiquette);
  if (!queue) return;

  verifierUniciteLocale(etiquette, queue);

  // La file de validation n'est pas du contenu publié : on se limite à ce qui
  // empêcherait un humain de la traiter (identifiant, statut, contenu proposé).
  queue.forEach((item, i) => {
    const id = chaineRemplie(item?.id) ? item.id : `(sans id, position ${i})`;
    if (!chaineRemplie(item?.id)) erreur(etiquette, id, "id", "id manquant ou vide");
    if (!chaineRemplie(item?.statut)) erreur(etiquette, id, "statut", "statut manquant ou vide");
    if (item?.contenu_propose === undefined || item?.contenu_propose === null) {
      erreur(etiquette, id, "contenu_propose", "proposition sans contenu");
    }
    const url = item?.contenu_propose?.link ?? item?.contenu_propose?.url;
    if (chaineRemplie(url) && !urlValide(url)) {
      avertissement(etiquette, id, "contenu_propose.url", `url mal formée dans la proposition : ${JSON.stringify(url)}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

/**
 * @param derniereModifCorpus date AAAA-MM-JJ la plus récente trouvée dans les
 *        `derniere_verification` du corpus, ou null si le corpus est vide.
 */
function validerChangelog(derniereModifCorpus) {
  const etiquette = "changelog.json";
  const entrees = lireTableau(path.join(SEED, etiquette), etiquette);
  if (!entrees) return;

  verifierUniciteLocale(etiquette, entrees);

  const joursCouverts = new Set();

  entrees.forEach((e, i) => {
    const id = chaineRemplie(e?.id) ? e.id : `(sans id, position ${i})`;
    if (!chaineRemplie(e?.id)) erreur(etiquette, id, "id", "id manquant ou vide");
    // `cible` est ce qui rend une entrée exploitable : sans elle, on sait qu'il s'est
    // passé quelque chose mais pas sur quoi — l'entrée devient du bruit.
    if (!chaineRemplie(e?.cible)) erreur(etiquette, id, "cible", "cible manquante ou vide (id de fiche ou nom de section attendu)");
    if (!chaineRemplie(e?.resume)) erreur(etiquette, id, "resume", "résumé manquant ou vide");
    if (!TYPES_CHANGELOG.includes(e?.type)) {
      erreur(etiquette, id, "type", `type d'entrée invalide : ${JSON.stringify(e?.type)} (attendu : ${TYPES_CHANGELOG.join(", ")})`);
    }
    if (!dateISOSouple(e?.date)) {
      erreur(etiquette, id, "date", `date non ISO 8601 : ${JSON.stringify(e?.date)} (AAAA-MM-JJ ou datetime complet)`);
    } else {
      joursCouverts.add(e.date.slice(0, 10));
    }
    if (e?.source !== undefined && e?.source !== null) {
      verifierSources(etiquette, id, "source", [e.source]);
    }
  });

  // Heuristique de traçabilité, volontairement tolérante : si le corpus a été touché
  // le JJ (date de vérification la plus récente) mais qu'aucune entrée de changelog ne
  // porte ce jour-là, une modification est probablement passée sans être journalisée.
  // Simple avertissement : un lot peut légitimement être journalisé le lendemain, et
  // on ne veut pas bloquer une publication pour une question de date d'écriture.
  if (derniereModifCorpus && !joursCouverts.has(derniereModifCorpus)) {
    avertissement(
      etiquette,
      null,
      "date",
      `aucune entrée datée du ${derniereModifCorpus}, qui est pourtant la dernière date de vérification du corpus — modification non journalisée ?`
    );
  }
}

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------

function formaterLigne(c) {
  const cible = [c.id, c.champ].filter(Boolean).join(" · ");
  return cible ? `${cible} — ${c.message}` : c.message;
}

/** Regroupe les constats par fichier pour un rapport lisible fichier par fichier. */
function grouperParFichier(constats) {
  const groupes = new Map();
  for (const c of constats) {
    if (!groupes.has(c.fichier)) groupes.set(c.fichier, []);
    groupes.get(c.fichier).push(c);
  }
  return groupes;
}

function afficherCategorie(titre, constats) {
  if (constats.length === 0) return;
  console.log(`\n${titre} (${constats.length})`);
  console.log("─".repeat(72));

  // Le plafond s'applique à la catégorie entière (et non par fichier) : c'est le
  // volume total affiché qui rend un rapport inexploitable.
  let affichees = 0;
  for (const [fichier, liste] of grouperParFichier(constats)) {
    if (affichees >= MAX_LIGNES) break;
    console.log(`\n  ${fichier}`);
    for (const c of liste) {
      if (affichees >= MAX_LIGNES) break;
      console.log(`    • ${formaterLigne(c)}`);
      affichees++;
    }
  }
  const reste = constats.length - affichees;
  if (reste > 0) console.log(`\n  … et ${reste} autre(s) — relancer avec --json pour la liste complète.`);
}

function afficherCouverture() {
  const lignes = Object.entries(couverture).sort(([a], [b]) => a.localeCompare(b));
  if (lignes.length === 0) return;

  const largeurFichier = Math.max(7, ...lignes.map(([f]) => f.length));
  const enTete = `${"Fichier".padEnd(largeurFichier)}  ${"Total".padStart(6)}  ${"Documentées".padStart(11)}  ${"À documenter".padStart(12)}`;
  console.log("\nCOUVERTURE DU CORPUS");
  console.log("─".repeat(enTete.length));
  console.log(enTete);
  console.log("─".repeat(enTete.length));

  let total = 0;
  let documentees = 0;
  let aDocumenter = 0;
  for (const [fichier, c] of lignes) {
    total += c.total;
    documentees += c.documentees;
    aDocumenter += c.a_documenter;
    console.log(
      `${fichier.padEnd(largeurFichier)}  ${String(c.total).padStart(6)}  ${String(c.documentees).padStart(11)}  ${String(c.a_documenter).padStart(12)}`
    );
  }
  console.log("─".repeat(enTete.length));
  console.log(
    `${"TOTAL".padEnd(largeurFichier)}  ${String(total).padStart(6)}  ${String(documentees).padStart(11)}  ${String(aDocumenter).padStart(12)}`
  );
  return total;
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(SEED)) {
    // Sans corpus il n'y a rien à valider : c'est une erreur de configuration, pas un
    // corpus sain — on sort donc en échec pour ne pas laisser passer une CI mal câblée.
    const message = `Dossier de données introuvable : ${SEED}`;
    if (SORTIE_JSON) console.log(JSON.stringify({ ok: false, erreurs: [{ fichier: null, id: null, champ: null, message }], avertissements: [], couverture: {} }, null, 2));
    else console.error(message);
    process.exit(1);
  }

  const idsHumaines = validerFichesHumaines();
  const idsIA = validerFichesIA();
  validerFichesGap(idsHumaines, idsIA);
  validerQuestions();
  validerVeilleSources();
  validerVeilleQueue();

  // La date de dernière modification du corpus alimente l'heuristique de changelog.
  // On la calcule après coup, à partir des fiches déjà validées, pour ne pas dépendre
  // d'une relecture des fichiers.
  const derniereModifCorpus = derniereDateVerification();
  validerChangelog(derniereModifCorpus);

  const nbFiches = Object.values(couverture).reduce((n, c) => n + c.total, 0);
  // `--strict` ne recatégorise rien dans le rapport (l'information reste lisible telle
  // qu'elle est) : il ne change que la conclusion, donc le code de sortie.
  const ok = erreurs.length === 0 && (!MODE_STRICT || avertissements.length === 0);

  if (SORTIE_JSON) {
    // Contrat de sortie machine : un seul objet JSON sur stdout, rien d'autre — le
    // consommateur (CI, tableau de bord qualité) doit pouvoir faire un JSON.parse brut.
    process.stdout.write(`${JSON.stringify({ ok, erreurs, avertissements, couverture }, null, 2)}\n`);
    process.exit(erreurs.length > 0 || (MODE_STRICT && avertissements.length > 0) ? 1 : 0);
  }

  console.log("VALIDATION DU CORPUS ATLAS — data/seed/");
  console.log(`Racine : ${RACINE}${MODE_STRICT ? "  (mode strict : les avertissements sont bloquants)" : ""}`);
  afficherCouverture();

  afficherCategorie("ERREURS", erreurs);
  afficherCategorie("AVERTISSEMENTS", avertissements);

  console.log("\n" + "═".repeat(72));
  console.log(`${erreurs.length} erreur(s), ${avertissements.length} avertissement(s) sur ${nbFiches} fiche(s).`);
  if (ok) {
    console.log("Corpus valide — publication possible.");
  } else if (erreurs.length > 0) {
    console.log("Corpus invalide — corriger les erreurs avant publication.");
  } else {
    console.log("Aucune erreur, mais des avertissements subsistent (échec dû à --strict).");
  }
  console.log("═".repeat(72));

  process.exit(ok ? 0 : 1);
}

/**
 * Date de vérification la plus récente du corpus, tous référentiels confondus.
 * Relit les fichiers de fiches en se contentant du champ `derniere_verification` :
 * l'opération est négligeable devant la validation elle-même et évite de trimballer
 * tout le corpus en mémoire entre les fonctions.
 */
function derniereDateVerification() {
  const chemins = [];
  const dossierHumaines = path.join(SEED, "fiches_humaines");
  if (existsSync(dossierHumaines)) {
    for (const f of readdirSync(dossierHumaines).filter((f) => f.endsWith(".json"))) {
      chemins.push(path.join(dossierHumaines, f));
    }
  }
  for (const f of ["fiches_ia.json", "fiches_gap.json"]) {
    const p = path.join(SEED, f);
    if (existsSync(p)) chemins.push(p);
  }

  let max = null;
  for (const chemin of chemins) {
    try {
      const data = JSON.parse(readFileSync(chemin, "utf-8"));
      if (!Array.isArray(data)) continue;
      for (const fiche of data) {
        const d = fiche?.derniere_verification;
        if (dateISOValide(d) && (max === null || d > max)) max = d;
      }
    } catch {
      continue; // fichier déjà signalé comme illisible par la passe de validation
    }
  }
  return max;
}

main();

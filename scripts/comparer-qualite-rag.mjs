/*
 * Comparateur de qualité : sortie du moteur RAG vs. réponses rédigées à la main.
 *
 * Pourquoi ce script existe
 * -------------------------
 * Le mégaprompt (section 7.3) impose que le moteur de réponse prédictive soit
 * « au moins aussi nuancé » que les 4 questions-tests répondues à la main dans
 * `data/seed/questions.json`. Cette exigence n'est vérifiable qu'en exécutant le
 * moteur — ce qui suppose une clé Voyage, une clé Anthropic et un index peuplé.
 * Tant que ce n'est pas le cas, on peut quand même vérifier ce qui est
 * vérifiable hors ligne, et c'est ce que fait ce script :
 *
 *   1. il MESURE l'étalon : les 4 réponses manuelles, champ par champ
 *      (nombre de perspectives, longueur de chaque champ, sources, confiance) ;
 *   2. il VÉRIFIE le contrat du pipeline en lisant le code source : chaque champ
 *      du type `Perspective` doit apparaître dans le schéma d'outil de
 *      `lib/rag.ts` ET être affiché par `components/QuestionsClient.tsx`. Si
 *      quelqu'un retire `justification` du schéma, ce script le voit ;
 *   3. il ÉNONCE les écarts structurels connus entre les deux, sans les
 *      minimiser — c'est la partie honnête, celle qui dit où le pipeline est
 *      probablement en dessous de l'étalon ;
 *   4. avec `--reponse=fichier.json`, il compare une VRAIE réponse du moteur
 *      (capturée par curl une fois les clés posées) à l'étalon, champ par champ.
 *      C'est le seul mode qui prouve quelque chose ; les trois autres ne font
 *      qu'instruire le dossier.
 *
 * Usage
 * -----
 *   node scripts/comparer-qualite-rag.mjs
 *   node scripts/comparer-qualite-rag.mjs --reponse=/tmp/reponse.json
 *   node scripts/comparer-qualite-rag.mjs --json
 *   node scripts/comparer-qualite-rag.mjs --aide
 *
 * Capture d'une vraie réponse (après indexation) :
 *   curl -s localhost:3000/api/question -H 'Content-Type: application/json' \
 *     -d '{"question":"Les modèles économiques mondiaux actuels sont-ils optimaux ?"}' \
 *     > /tmp/reponse.json
 *
 * Codes de sortie
 * ---------------
 *   0 — contrat respecté (et, avec --reponse, réponse au niveau de l'étalon)
 *   1 — écart bloquant : un champ du gabarit a disparu du pipeline, ou la réponse
 *       fournie est en dessous de l'étalon sur un critère structurant
 *   2 — usage invalide ou fichier illisible
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);

const AIDE = `
COMPARATEUR DE QUALITÉ RAG vs. RÉPONSES MANUELLES (MP-4)

  node scripts/comparer-qualite-rag.mjs [options]

Options
  --reponse=FICHIER  Comparer une réponse réelle de /api/question (JSON) à l'étalon.
  --racine=CHEMIN    Racine du dépôt (défaut : dossier parent de ce script).
  --json             Sortie machine.
  --aide, -h         Cette aide.

Codes de sortie : 0 conforme · 1 écart bloquant · 2 usage invalide.
`;

if (args.includes("--aide") || args.includes("-h")) {
  process.stdout.write(`${AIDE}\n`);
  process.exit(0);
}

const inconnus = args.filter(
  (a) => !["--json", "--aide", "-h"].includes(a) && !a.startsWith("--reponse=") && !a.startsWith("--racine=")
);
if (inconnus.length > 0) {
  process.stderr.write(`Argument inconnu : ${inconnus.join(", ")}\n${AIDE}\n`);
  process.exit(2);
}

const SORTIE_JSON = args.includes("--json");
const valeurArg = (p) => {
  const t = args.find((a) => a.startsWith(p));
  return t === undefined ? null : t.slice(p.length);
};

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = valeurArg("--racine=") ?? path.resolve(ICI, "..");
const FICHIER_REPONSE = valeurArg("--reponse=");

const lignes = [];
const log = (m = "") => {
  lignes.push(m);
  if (!SORTIE_JSON) process.stdout.write(`${m}\n`);
};

// ---------------------------------------------------------------------------
// Le gabarit commun : les 6 champs du type Perspective (lib/types.ts)
// ---------------------------------------------------------------------------

const CHAMPS_PERSPECTIVE = [
  ["modele", "Nom de l'école / du cadre théorique"],
  ["hypotheses", "Postulats de départ"],
  ["etat_actuel", "Faits établis, hors interprétation"],
  ["reponse", "Ce que ce modèle répond"],
  ["justification", "Pourquoi la réponse découle des hypothèses"],
  ["limites", "Ce que ce modèle explique mal"],
];

// ---------------------------------------------------------------------------
// 1. Mesure de l'étalon
// ---------------------------------------------------------------------------

function chargerEtalon() {
  const chemin = path.join(RACINE, "data", "seed", "questions.json");
  if (!existsSync(chemin)) {
    process.stderr.write(`Étalon introuvable : ${chemin}\n`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(chemin, "utf-8"));
  } catch (e) {
    process.stderr.write(`questions.json illisible : ${e.message}\n`);
    process.exit(2);
    return [];
  }
}

const mediane = (valeurs) => {
  if (valeurs.length === 0) return 0;
  const triees = [...valeurs].sort((a, b) => a - b);
  return triees[Math.floor(triees.length / 2)];
};

function mesurer(questions) {
  const perspectives = questions.flatMap((q) => q.perspectives ?? []);
  const parChamp = {};
  for (const [champ] of CHAMPS_PERSPECTIVE) {
    const longueurs = perspectives.map((p) => (typeof p[champ] === "string" ? p[champ].length : 0));
    parChamp[champ] = {
      renseignes: longueurs.filter((l) => l > 0).length,
      mediane: mediane(longueurs),
      min: Math.min(...longueurs),
      max: Math.max(...longueurs),
    };
  }
  const confiances = {};
  for (const p of perspectives) confiances[p.niveau_confiance] = (confiances[p.niveau_confiance] ?? 0) + 1;

  return {
    nb_questions: questions.length,
    nb_perspectives: perspectives.length,
    perspectives_par_question: questions.map((q) => (q.perspectives ?? []).length),
    min_perspectives: Math.min(...questions.map((q) => (q.perspectives ?? []).length)),
    max_perspectives: Math.max(...questions.map((q) => (q.perspectives ?? []).length)),
    sources_par_perspective: mediane(perspectives.map((p) => (p.sources ?? []).length)),
    perspectives_sans_source: perspectives.filter((p) => (p.sources ?? []).length === 0).length,
    avec_sous_questions: questions.filter((q) => (q.sous_questions ?? []).length > 0).length,
    avec_axes_recherche: questions.filter((q) => (q.axes_recherche ?? []).length > 0).length,
    par_champ: parChamp,
    confiances,
  };
}

// ---------------------------------------------------------------------------
// 2. Vérification du contrat, par lecture du code source
// ---------------------------------------------------------------------------

function lireSource(relatif) {
  const chemin = path.join(RACINE, relatif);
  return existsSync(chemin) ? readFileSync(chemin, "utf-8") : null;
}

function verifierContrat() {
  const constats = [];
  const rag = lireSource("lib/rag.ts");
  const route = lireSource("app/api/question/route.ts");
  const affichage = lireSource("components/QuestionsClient.tsx");
  const libre = lireSource("components/QuestionLibreClient.tsx");

  const exigence = (ok, libelle, detail) => {
    constats.push({ ok, libelle, detail });
  };

  exigence(rag !== null, "lib/rag.ts présent", "moteur introuvable");
  exigence(route !== null, "app/api/question/route.ts présent", "route introuvable");
  exigence(affichage !== null, "components/QuestionsClient.tsx présent", "affichage introuvable");
  exigence(libre !== null, "components/QuestionLibreClient.tsx présent", "champ de question libre introuvable");

  if (rag) {
    // Chaque champ du gabarit doit être exigé du modèle, sinon la réponse générée
    // est structurellement plus pauvre que les réponses manuelles.
    for (const [champ] of CHAMPS_PERSPECTIVE) {
      exigence(
        rag.includes(`${champ}:`) || rag.includes(`"${champ}"`),
        `champ « ${champ} » exigé dans le schéma d'outil de lib/rag.ts`,
        "le modèle n'a pas à le produire : la réponse sera plus pauvre que l'étalon"
      );
    }
    exigence(
      rag.includes("niveau_confiance"),
      "niveau de confiance exigé par perspective",
      "sans lui, un scénario prospectif s'affiche comme un fait"
    );
    exigence(
      /minItems/.test(rag) && /perspectives/.test(rag),
      "sortie contrainte à un TABLEAU de perspectives",
      "le format autorise un verdict unique"
    );
    exigence(
      rag.includes("tool_choice"),
      "sortie structurée forcée (tool_choice)",
      "le modèle peut répondre en prose libre, donc en verdict"
    );
    exigence(
      rag.includes("sourcesDeFiche"),
      "sources reconstruites depuis le corpus, jamais générées",
      "le modèle pourrait inventer ses références"
    );
    exigence(
      rag.includes("SEUIL_PERTINENCE"),
      "garde-fou de similarité minimale avant appel au modèle",
      "le moteur répondrait même sans matière dans le corpus"
    );
    exigence(
      rag.includes("MAX_PASSAGES") && rag.includes("MAX_TOKENS_REPONSE"),
      "plafonds de contexte et de tokens en place",
      "le coût par question n'est pas borné"
    );
    exigence(
      rag.includes("lireCache") && rag.includes("ecrireCache"),
      "cache de réponses branché",
      "chaque question repayée intégralement"
    );
  }

  if (affichage) {
    for (const [champ] of CHAMPS_PERSPECTIVE) {
      if (champ === "modele") continue; // rendu comme libellé d'onglet, pas comme bloc
      exigence(
        affichage.includes(`p.${champ}`),
        `champ « ${champ} » affiché par PerspectivesPanel`,
        "produit mais jamais montré au lecteur"
      );
    }
    exigence(
      affichage.includes("export function PerspectivesPanel"),
      "gabarit d'affichage partagé entre réponses manuelles et RAG",
      "les deux formats peuvent diverger sans que personne le voie"
    );
  }

  if (libre) {
    exigence(
      libre.includes("PerspectivesPanel"),
      "la réponse RAG utilise le même composant que les réponses manuelles",
      "affichage divergent possible"
    );
    exigence(
      libre.includes("fiches_mobilisees"),
      "fiches sources toujours affichées avec la réponse",
      "réponse non traçable par le lecteur"
    );
  }

  return constats;
}

// ---------------------------------------------------------------------------
// 3. Écarts structurels connus — la partie honnête
// ---------------------------------------------------------------------------

const ECARTS_CONNUS = [
  {
    critere: "Nombre de perspectives",
    etalon: "3 à 5, choisies par un humain qui connaît le champ",
    rag: "1 à 5, choisies par le modèle à partir des seuls extraits remontés",
    risque: "ÉLEVÉ",
    detail:
      "Rien ne garantit que la recherche vectorielle remonte des écoles CONCURRENTES : sur une question " +
      "économique, elle peut ne ramener que des fiches keynésiennes et produire deux perspectives qui disent " +
      "la même chose. La limite à 2 passages par fiche diversifie les FICHES, pas les ÉCOLES. Une réponse à " +
      "une seule perspective est signalée dans `avertissements`, mais elle est quand même affichée.",
  },
  {
    critere: "Qualité de l'état actuel (faits chiffrés)",
    etalon:
      "Chiffres précis et vérifiables (« plus de 800 millions de personnes sorties de la pauvreté depuis 1978 »)",
    rag: "Uniquement ce que contient le corpus indexé",
    risque: "ÉLEVÉ",
    detail:
      "Les fiches du référentiel sont qualitatives : elles portent peu de séries chiffrées. Le champ " +
      "`etat_actuel` des réponses générées sera donc structurellement plus pauvre que celui des réponses " +
      "manuelles, sauf à enrichir le corpus en indicateurs (World Values Survey, OCDE, Banque mondiale — " +
      "explicitement demandés en §3 du mégaprompt et absents des fiches).",
  },
  {
    critere: "Sources",
    etalon: "1 source par perspective, choisie à la main pour ce qu'elle démontre",
    rag: "Jusqu'à 6 sources héritées des fiches mobilisées",
    risque: "MOYEN",
    detail:
      "Plus nombreuses mais moins pertinentes : ce sont les sources de la FICHE, pas de l'argument. Elles " +
      "sont en revanche réelles et vérifiables par construction (jamais générées par le modèle), ce que " +
      "l'étalon manuel ne garantit pas mieux.",
  },
  {
    critere: "Sous-questions et axes de recherche",
    etalon: "Présents sur les 4 questions manuelles",
    rag: "Non produits",
    risque: "FAIBLE",
    detail:
      "Le moteur produit `reformulation` et `angles_morts` à la place. C'est un écart de forme assumé : " +
      "décomposer une question en sous-questions demanderait un second appel au modèle, donc de doubler le " +
      "coût par question, pour un gain de lisibilité et non de justesse.",
  },
  {
    critere: "Refus de répondre",
    etalon: "Sans objet — les 4 questions ont été choisies parce qu'elles étaient traitables",
    rag: "Refus explicite sous le seuil de pertinence, sans aucun appel au modèle",
    risque: "AUCUN (avantage du RAG)",
    detail:
      "Le moteur peut dire « je ne sais pas », ce qu'une réponse rédigée à l'avance ne fait jamais. C'est " +
      "le seul point où le pipeline est au-dessus de l'étalon.",
  },
  {
    critere: "Neutralité entre les écoles",
    etalon:
      "Garantie par la rédaction humaine ; l'une des 4 questions va jusqu'à faire du refus de trancher une " +
      "perspective à part entière",
    rag: "Imposée par le prompt système et par le format de sortie, jamais vérifiée sur le fond",
    risque: "MOYEN",
    detail:
      "Aucun mécanisme automatique ne mesure si les perspectives générées sont d'un poids argumentatif " +
      "comparable. Un modèle peut respecter le format et déséquilibrer le fond (une école développée, l'autre " +
      "expédiée). Seule une relecture humaine des premières réponses réelles peut le dire.",
  },
];

// ---------------------------------------------------------------------------
// 4. Comparaison d'une réponse réelle
// ---------------------------------------------------------------------------

function comparerReponse(reponse, etalon) {
  const verdicts = [];
  const juger = (critere, valeur, attendu, ok, commentaire) =>
    verdicts.push({ critere, valeur, attendu, ok, commentaire });

  const perspectives = Array.isArray(reponse.perspectives) ? reponse.perspectives : [];
  const statut = reponse?.diagnostic?.statut ?? "inconnu";

  if (statut !== "repondue") {
    juger(
      "Statut",
      statut,
      "repondue",
      true,
      "Refus assumé du moteur : ce n'est pas un échec de qualité, la comparaison de fond ne s'applique pas."
    );
    return verdicts;
  }

  juger(
    "Nombre de perspectives",
    perspectives.length,
    `≥ ${etalon.min_perspectives}`,
    perspectives.length >= etalon.min_perspectives,
    perspectives.length < etalon.min_perspectives
      ? "En dessous de l'étalon : moins d'écoles exposées que dans la moindre réponse manuelle."
      : "À parité ou au-dessus."
  );

  for (const [champ] of CHAMPS_PERSPECTIVE) {
    const longueurs = perspectives.map((p) => (typeof p[champ] === "string" ? p[champ].length : 0));
    const vides = longueurs.filter((l) => l === 0).length;
    const med = mediane(longueurs);

    // `modele` est un NOM d'école : sa longueur ne dit rien de sa qualité
    // (« Nietzsche » vaut « Critiques hétérodoxes (économie du donut, MMT…) »).
    // On n'y vérifie que la présence, sans quoi le test pénaliserait à tort
    // toute réponse citant des écoles au nom court.
    if (champ === "modele") {
      juger(`Champ « ${champ} »`, `${vides} vide(s)`, "0 vide", vides === 0, vides === 0 ? "Présent partout." : "Perspective sans nom d'école.");
      continue;
    }

    const cible = etalon.par_champ[champ].mediane;
    // Tolérance à 60 % de la médiane de l'étalon : en dessous, le champ est
    // rempli mais expédié, ce qui est une façon polie de ne pas répondre.
    const ok = vides === 0 && med >= cible * 0.6;
    juger(
      `Champ « ${champ} »`,
      `${vides} vide(s), médiane ${med} car.`,
      `0 vide, ≥ ${Math.round(cible * 0.6)} car. (étalon ${cible})`,
      ok,
      ok ? "Comparable à l'étalon." : "Champ absent ou nettement plus court que dans les réponses manuelles."
    );
  }

  const sansSource = perspectives.filter((p) => (p.sources ?? []).length === 0).length;
  juger(
    "Perspectives sourcées",
    `${perspectives.length - sansSource}/${perspectives.length}`,
    "toutes",
    sansSource === 0,
    sansSource === 0 ? "Toutes les perspectives portent des sources réelles." : "Des perspectives sans aucune source."
  );

  const niveauxValides = ["fait_verifie", "consensus_scientifique", "opinion_majoritaire", "hypothese_prospective"];
  const mauvais = perspectives.filter((p) => !niveauxValides.includes(p.niveau_confiance)).length;
  juger(
    "Niveaux de confiance",
    mauvais === 0 ? "tous valides" : `${mauvais} invalide(s)`,
    "conformes à lib/types.ts",
    mauvais === 0,
    mauvais === 0 ? "Conformes." : "Valeur hors énumération : l'affichage cassera."
  );

  const distinctes = new Set(perspectives.map((p) => (p.modele ?? "").toLowerCase().trim())).size;
  juger(
    "Écoles distinctes",
    distinctes,
    `= ${perspectives.length}`,
    distinctes === perspectives.length,
    distinctes === perspectives.length
      ? "Aucun doublon d'école."
      : "Deux perspectives portent le même nom d'école : pluralisme de façade."
  );

  const fiches = Array.isArray(reponse.fiches_mobilisees) ? reponse.fiches_mobilisees.length : 0;
  juger("Fiches du corpus mobilisées", fiches, "≥ 3", fiches >= 3, fiches >= 3 ? "Ancrage suffisant." : "Réponse peu ancrée dans le référentiel.");

  return verdicts;
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------

const questions = chargerEtalon();
const etalon = mesurer(questions);
const contrat = verifierContrat();

let verdicts = null;
let reponseChargee = null;
if (FICHIER_REPONSE) {
  if (!existsSync(FICHIER_REPONSE)) {
    process.stderr.write(`Fichier de réponse introuvable : ${FICHIER_REPONSE}\n`);
    process.exit(2);
  }
  try {
    reponseChargee = JSON.parse(readFileSync(FICHIER_REPONSE, "utf-8"));
  } catch (e) {
    process.stderr.write(`Réponse illisible : ${e.message}\n`);
    process.exit(2);
  }
  verdicts = comparerReponse(reponseChargee, etalon);
}

const contratKO = contrat.filter((c) => !c.ok);
const verdictsKO = (verdicts ?? []).filter((v) => !v.ok);
const ok = contratKO.length === 0 && verdictsKO.length === 0;

if (SORTIE_JSON) {
  process.stdout.write(`${JSON.stringify({ ok, etalon, contrat, ecarts: ECARTS_CONNUS, verdicts }, null, 2)}\n`);
  process.exit(ok ? 0 : 1);
}

log("COMPARAISON QUALITÉ — MOTEUR RAG vs. RÉPONSES MANUELLES");
log("═".repeat(78));

log("\n1. ÉTALON MESURÉ — data/seed/questions.json");
log(
  `   ${etalon.nb_questions} questions · ${etalon.nb_perspectives} perspectives ` +
    `(${etalon.perspectives_par_question.join(", ")} par question)`
);
log(`   Sources par perspective (médiane) : ${etalon.sources_par_perspective} · sans source : ${etalon.perspectives_sans_source}`);
log(`   Niveaux de confiance : ${Object.entries(etalon.confiances).map(([k, v]) => `${k} ×${v}`).join(" · ")}`);
log("   Longueur des champs (caractères) :");
for (const [champ, libelle] of CHAMPS_PERSPECTIVE) {
  const s = etalon.par_champ[champ];
  log(
    `     ${champ.padEnd(14)} médiane ${String(s.mediane).padStart(4)} · min ${String(s.min).padStart(3)} · ` +
      `max ${String(s.max).padStart(4)} · renseigné ${s.renseignes}/${etalon.nb_perspectives}   ${libelle}`
  );
}

log("\n2. CONTRAT DU PIPELINE — vérifié dans le code source");
for (const c of contrat) {
  log(`   ${c.ok ? "✓" : "✗"} ${c.libelle}${c.ok ? "" : `  →  ${c.detail}`}`);
}

log("\n3. OÙ LE PIPELINE RISQUE D'ÊTRE EN DESSOUS DE L'ÉTALON");
for (const e of ECARTS_CONNUS) {
  log(`\n   [${e.risque}] ${e.critere}`);
  log(`     manuel : ${e.etalon}`);
  log(`     RAG    : ${e.rag}`);
  log(`     ${e.detail.replace(/\s+/g, " ")}`);
}

if (verdicts) {
  log(`\n4. RÉPONSE RÉELLE ANALYSÉE — ${FICHIER_REPONSE}`);
  log(`   Question : ${reponseChargee?.question ?? "(absente)"}`);
  for (const v of verdicts) {
    log(`   ${v.ok ? "✓" : "✗"} ${v.critere.padEnd(28)} ${String(v.valeur).padEnd(24)} (attendu ${v.attendu})`);
    if (!v.ok) log(`       ${v.commentaire}`);
  }
} else {
  log("\n4. RÉPONSE RÉELLE — non analysée");
  log("   Aucune réponse fournie. Cette exécution ne prouve RIEN sur la qualité réelle du moteur :");
  log("   elle vérifie seulement que le pipeline est structurellement capable de l'atteindre.");
  log("   Après indexation, relancer avec --reponse=/tmp/reponse.json (cf. en-tête du script).");
}

log(`\n${"═".repeat(78)}`);
log(
  ok
    ? "Contrat structurel respecté."
    : `${contratKO.length} manquement(s) au contrat, ${verdictsKO.length} écart(s) sur la réponse analysée.`
);
log("═".repeat(78));

process.exit(ok ? 0 : 1);

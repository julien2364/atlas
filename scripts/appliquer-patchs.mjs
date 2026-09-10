/*
 * MP-7 — Étape 2 de la boucle de veille : APPLIQUER un fichier de patchs relu.
 *
 * Rôle dans le projet
 * -------------------
 * `scripts/appliquer-veille.mjs` propose ; ce script exécute — mais seulement ce qu'un
 * humain a relu et laissé passer. C'est le seul script du dépôt qui écrit du contenu
 * éditorial dans les fiches à partir de la veille, donc le seul qui puisse casser le
 * référentiel : d'où le garde-fou de restauration décrit plus bas.
 *
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ AUCUNE FICHE N'EST MODIFIÉE SANS VALIDATION HUMAINE. Ce script n'invente    │
 * │ rien : il n'applique que le contenu d'un fichier de patchs qu'une personne  │
 * │ a ouvert, relu et arbitré (`retenu: true/false`). Il n'est jamais lancé par │
 * │ un cron. Le script propose, l'humain dispose.                               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Ce que fait le script pour chaque patch retenu
 * ----------------------------------------------
 *   1. ajoute la source proposée à la fiche cible (si elle n'y est pas déjà) ;
 *   2. remplace le champ visé par le texte du patch, uniquement pour les patchs
 *      "remplacement_texte" ;
 *   3. passe `derniere_verification` à la date du jour et `statut` à
 *      "verifie_recemment" — la fiche vient réellement d'être revue par une personne ;
 *   4. ajoute UNE entrée dans data/seed/changelog.json (une par fiche touchée : le
 *      changelog est public et doit dire quelle fiche a bougé, pas seulement qu'un
 *      lot a tourné) ;
 *   5. bascule la proposition d'origine au statut "applique" dans la file de veille,
 *      pour qu'elle ne soit pas re-proposée indéfiniment (--conserver-file désactive).
 *
 * Le garde-fou de restauration — le point important
 * -------------------------------------------------
 * Avant la première écriture, le script prend un instantané OCTET POUR OCTET de tous
 * les fichiers qu'il est susceptible de toucher. Après écriture, il relance
 * `scripts/valider-donnees.mjs`. Si la validation échoue, il RÉÉCRIT les instantanés
 * et sort en code 1 : le disque est ramené exactement dans son état d'avant, y compris
 * pour les patchs qui, eux, étaient bons. Rien de cassé ne reste sur le disque.
 * Toute exception pendant l'écriture déclenche la même restauration.
 * Le script refuse par ailleurs de démarrer si le corpus est DÉJÀ invalide avant
 * application : sinon il restaurerait systématiquement, en masquant la vraie panne.
 *
 * Usage
 * -----
 *   node scripts/appliquer-patchs.mjs --patchs=data/patchs/patchs-veille-2026-09-06.json --dry-run
 *   node scripts/appliquer-patchs.mjs --patchs=... --limite=5
 *   node scripts/appliquer-patchs.mjs --patchs=... --inclure-a-reformuler
 *   node scripts/appliquer-patchs.mjs --aide
 *
 * Code de sortie : 0 si tout s'est bien passé (y compris « rien à appliquer ») ;
 * 1 si le fichier de patchs est illisible, si le corpus était déjà invalide, ou si la
 * validation post-écriture a échoué (dans ce cas les fichiers ont été restaurés).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ---------------------------------------------------------------------------
// Arguments & configuration
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function argTexte(nom, defaut) {
  const brut = args.find((a) => a.startsWith(`--${nom}=`));
  if (brut === undefined) return defaut;
  return brut.split("=").slice(1).join("=");
}

function argNombre(nom, defaut) {
  const brut = argTexte(nom, undefined);
  if (brut === undefined) return defaut;
  const valeur = Number(brut);
  if (!Number.isFinite(valeur) || valeur <= 0) {
    console.warn(`Valeur invalide pour --${nom} ("${brut}") — valeur par défaut utilisée.`);
    return defaut;
  }
  return valeur;
}

if (args.includes("--aide") || args.includes("-h") || args.includes("--help")) {
  console.log(`
appliquer-patchs.mjs — applique un fichier de patchs de veille RELU par un humain.

  --patchs=...              fichier de patchs à appliquer
                            (défaut : le plus récent de data/patchs/)
  --dry-run                 simulation : n'écrit rien, affiche ce qui serait fait
  --limite=N                nombre maximum de patchs appliqués sur ce run
  --inclure-a-reformuler    applique AUSSI les patchs marqués « a_reformuler »
                            (par défaut ils sont refusés : leur texte n'est pas
                            rédigé pour le référentiel)
  --conserver-file          ne touche pas au statut des propositions dans
                            data/seed/veille_queue.json
  --racine=...              racine du dépôt (défaut : dossier parent de scripts/)
  --aide                    ce message

Garde-fou : validation du corpus avant ET après écriture. Si la validation
post-écriture échoue, tous les fichiers touchés sont restaurés à l'identique et le
script sort en code 1.

Aucune fiche n'est jamais modifiée sans validation humaine : ce script n'applique
que ce qu'une personne a relu et laissé au statut « retenu ».
`);
  process.exit(0);
}

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = argTexte("racine", path.resolve(ICI, ".."));
const SEED = path.join(RACINE, "data", "seed");
const VALIDATEUR = path.join(ICI, "valider-donnees.mjs");

const DRY_RUN = args.includes("--dry-run");
const INCLURE_A_REFORMULER = args.includes("--inclure-a-reformuler");
const CONSERVER_FILE = args.includes("--conserver-file");
const LIMITE = argNombre("limite", Infinity);

const MAINTENANT = new Date();
const AUJOURDHUI = MAINTENANT.toISOString().slice(0, 10);
const STATUT_APRES_VERIFICATION = "verifie_recemment";
const STATUT_PROPOSITION_APPLIQUEE = "applique";

// ---------------------------------------------------------------------------
// Utilitaires fichiers
// ---------------------------------------------------------------------------

function lireJSON(chemin) {
  return JSON.parse(readFileSync(chemin, "utf-8"));
}

function ecrireJSON(chemin, donnees) {
  // Même convention que le reste du dépôt (cf. scripts/audit-fraicheur.mjs) :
  // indentation 2, saut de ligne final — pour ne pas produire un diff cosmétique.
  writeFileSync(chemin, `${JSON.stringify(donnees, null, 2)}\n`);
}

function chaineRemplie(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/** Chemin affiché relatif à la racine quand c'est lisible, absolu sinon. */
function afficherChemin(chemin) {
  const relatif = path.relative(RACINE, chemin);
  return relatif.startsWith("..") ? chemin : relatif;
}

function normaliserUrl(u) {
  if (!chaineRemplie(u)) return "";
  return u.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

/** Dernier fichier de patchs produit, quand --patchs n'est pas donné. */
function dernierFichierPatchs() {
  const dossier = path.join(RACINE, "data", "patchs");
  if (!existsSync(dossier)) return null;
  const candidats = readdirSync(dossier).filter((f) => f.startsWith("patchs-veille-") && f.endsWith(".json")).sort();
  return candidats.length > 0 ? path.join(dossier, candidats[candidats.length - 1]) : null;
}

// ---------------------------------------------------------------------------
// Validation externe — on réutilise le validateur du dépôt plutôt que de
// redupliquer ses règles : une seule source de vérité pour « corpus valide ».
// ---------------------------------------------------------------------------

function validerCorpus(etiquette) {
  const res = spawnSync(process.execPath, [VALIDATEUR, `--racine=${RACINE}`, "--json"], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) {
    return { ok: false, erreurs: [{ message: `impossible de lancer le validateur : ${res.error.message}` }], etiquette };
  }
  let rapport = null;
  try {
    rapport = JSON.parse(res.stdout);
  } catch {
    return {
      ok: false,
      erreurs: [{ message: `sortie du validateur illisible (code ${res.status})` }],
      etiquette,
    };
  }
  return { ok: res.status === 0, erreurs: rapport.erreurs ?? [], etiquette };
}

function afficherErreursValidation(resultat, maxLignes = 10) {
  for (const e of resultat.erreurs.slice(0, maxLignes)) {
    const cible = [e.fichier, e.id, e.champ].filter(Boolean).join(" · ");
    console.error(`    • ${cible ? `${cible} — ` : ""}${e.message}`);
  }
  if (resultat.erreurs.length > maxLignes) {
    console.error(`    … et ${resultat.erreurs.length - maxLignes} autre(s) — voir npm run valider.`);
  }
}

// ---------------------------------------------------------------------------
// Instantané / restauration
// ---------------------------------------------------------------------------

/**
 * Instantané en mémoire des octets bruts des fichiers susceptibles d'être écrits.
 * On garde le Buffer et non l'objet JSON : la restauration rend le fichier à
 * l'identique, indentation et fins de ligne comprises, sans re-sérialisation.
 */
function prendreInstantane(chemins) {
  const instantane = new Map();
  for (const chemin of chemins) {
    if (existsSync(chemin)) instantane.set(chemin, readFileSync(chemin));
  }
  return instantane;
}

function restaurer(instantane) {
  const restaures = [];
  for (const [chemin, contenu] of instantane) {
    writeFileSync(chemin, contenu);
    restaures.push(afficherChemin(chemin));
  }
  return restaures;
}

// ---------------------------------------------------------------------------
// Chargement du corpus (mêmes fichiers que scripts/valider-donnees.mjs)
// ---------------------------------------------------------------------------

function chargerCorpus() {
  const fichiers = new Map(); // chemin absolu -> tableau de fiches (muté en place)
  const index = new Map(); // id de fiche -> { fiche, chemin }

  const dossierHumaines = path.join(SEED, "fiches_humaines");
  const chemins = [];
  if (existsSync(dossierHumaines)) {
    for (const nom of readdirSync(dossierHumaines).filter((f) => f.endsWith(".json")).sort()) {
      chemins.push(path.join(dossierHumaines, nom));
    }
  }
  for (const nom of ["fiches_ia.json", "fiches_gap.json"]) {
    const chemin = path.join(SEED, nom);
    if (existsSync(chemin)) chemins.push(chemin);
  }

  for (const chemin of chemins) {
    const fiches = lireJSON(chemin);
    fichiers.set(chemin, fiches);
    for (const fiche of fiches) {
      if (fiche?.id && !index.has(fiche.id)) index.set(fiche.id, { fiche, chemin });
    }
  }

  return { fichiers, index };
}

// ---------------------------------------------------------------------------
// Application d'un patch (en mémoire)
// ---------------------------------------------------------------------------

/**
 * @returns { applique: boolean, raison?: string, changements: string[] }
 * Le patch est appliqué à l'objet fiche en mémoire ; l'écriture disque n'a lieu
 * qu'une fois tous les patchs traités, pour ne jamais laisser un fichier écrit et
 * un autre non écrit si quelque chose casse en cours de route.
 */
function appliquerPatch(patch, fiche) {
  const changements = [];

  // 1) texte du champ visé — uniquement pour les patchs de remplacement.
  if (patch.operation === "remplacement_texte") {
    if (!chaineRemplie(patch.texte_propose)) {
      return { applique: false, raison: "patch de remplacement sans texte_propose", changements };
    }
    if (!chaineRemplie(patch.champ)) {
      return { applique: false, raison: "patch de remplacement sans champ visé", changements };
    }
    const ancien = fiche[patch.champ];
    if (ancien === patch.texte_propose) {
      changements.push(`${patch.champ} : déjà à jour`);
    } else {
      fiche[patch.champ] = patch.texte_propose;
      changements.push(
        `${patch.champ} : ${chaineRemplie(ancien) ? `remplacé (${ancien.trim().length} → ${patch.texte_propose.trim().length} car.)` : `renseigné (${patch.texte_propose.trim().length} car.)`}`
      );
    }
  }

  // 2) source — ajoutée si elle n'est pas déjà là (le script est idempotent :
  // rejouer un fichier de patchs déjà appliqué ne duplique pas les sources).
  if (patch.source && chaineRemplie(patch.source.url)) {
    fiche.sources = Array.isArray(fiche.sources) ? fiche.sources : [];
    const dejaLa = fiche.sources.some((s) => normaliserUrl(s?.url) === normaliserUrl(patch.source.url));
    if (dejaLa) {
      changements.push(`sources : source déjà présente (${patch.source.url})`);
    } else {
      fiche.sources.push({ ...patch.source });
      changements.push(`sources : + « ${patch.source.titre} »`);
    }
  }

  if (changements.length === 0) {
    return { applique: false, raison: "patch sans effet (ni texte ni source à appliquer)", changements };
  }
  // Rejouer un fichier de patchs déjà appliqué ne doit pas re-dater les fiches ni
  // regonfler le changelog : si rien n'a bougé, on ne compte pas le patch.
  if (changements.every((c) => c.includes("déjà"))) {
    return { applique: false, raison: "aucun changement à apporter (patch déjà appliqué)", changements };
  }

  // 3) fraîcheur : la fiche vient d'être revue par une personne, on le dit.
  // On ne journalise que les bascules réelles — répéter « 2026-09-06 → 2026-09-06 »
  // sur le deuxième patch d'une même fiche ne renseignerait personne.
  if (fiche.statut !== STATUT_APRES_VERIFICATION) {
    changements.push(`statut : ${fiche.statut} → ${STATUT_APRES_VERIFICATION}`);
  }
  if (fiche.derniere_verification !== AUJOURDHUI) {
    changements.push(`derniere_verification : ${fiche.derniere_verification} → ${AUJOURDHUI}`);
  }
  fiche.statut = STATUT_APRES_VERIFICATION;
  fiche.derniere_verification = AUJOURDHUI;

  return { applique: true, changements };
}

/** Id de changelog lisible et unique — le validateur refuse les doublons d'id. */
function idChangelogUnique(cibleId, dejaPris) {
  const base = `veille-${cibleId}-${AUJOURDHUI}`;
  if (!dejaPris.has(base)) {
    dejaPris.add(base);
    return base;
  }
  let n = 2;
  while (dejaPris.has(`${base}-${n}`)) n++;
  dejaPris.add(`${base}-${n}`);
  return `${base}-${n}`;
}

function resumeChangelog(patch, changements) {
  const quoi =
    patch.operation === "remplacement_texte"
      ? `champ « ${patch.champ} » réécrit à partir d'une proposition de veille relue`
      : "nouvelle source ajoutée depuis la veille";
  const source = patch.source ? ` Source : ${patch.source.titre}${patch.source.url ? ` (${patch.source.url})` : ""}.` : "";
  return (
    `Mise à jour de la fiche « ${patch.cible_nom ?? patch.cible_id} » via la boucle de veille : ${quoi}.` +
    `${source} Proposition ${patch.proposition_id} relue et validée manuellement avant application ` +
    `(patch de nature « ${patch.nature} »). Détail : ${changements.join(" ; ")}.`
  );
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

function main() {
  // --- 1. fichier de patchs -------------------------------------------------
  const cheminPatchsBrut = argTexte("patchs", undefined);
  const cheminPatchs = cheminPatchsBrut ? path.resolve(RACINE, cheminPatchsBrut) : dernierFichierPatchs();

  if (!cheminPatchs || !existsSync(cheminPatchs)) {
    console.error(
      cheminPatchsBrut
        ? `Fichier de patchs introuvable : ${cheminPatchsBrut}`
        : "Aucun fichier de patchs trouvé dans data/patchs/ — lancer d'abord node scripts/appliquer-veille.mjs, ou préciser --patchs=."
    );
    process.exit(1);
  }

  let document;
  try {
    document = lireJSON(cheminPatchs);
  } catch (e) {
    console.error(`Fichier de patchs illisible (${cheminPatchs}) — ${e.message}`);
    process.exit(1);
  }

  const tousPatchs = Array.isArray(document) ? document : document.patchs;
  if (!Array.isArray(tousPatchs)) {
    console.error("Le fichier de patchs doit contenir un tableau `patchs` (ou un tableau à la racine).");
    process.exit(1);
  }

  console.log(`Fichier de patchs : ${afficherChemin(cheminPatchs)} — ${tousPatchs.length} patch(s).`);
  console.log(
    `Mode : ${DRY_RUN ? "SIMULATION (--dry-run, aucune écriture)" : "APPLICATION RÉELLE"}` +
      `${INCLURE_A_REFORMULER ? " · patchs « a_reformuler » INCLUS (--inclure-a-reformuler)" : ""}` +
      `${LIMITE === Infinity ? "" : ` · limite ${LIMITE}`}`
  );

  // --- 2. tri des patchs ----------------------------------------------------
  const ecartes = [];
  const eligibles = [];
  for (const patch of tousPatchs) {
    if (patch?.retenu === false) {
      ecartes.push({ patch, raison: "écarté par le relecteur (retenu: false)" });
      continue;
    }
    if (patch?.nature === "a_reformuler" && !INCLURE_A_REFORMULER) {
      // Garde-fou éditorial : ces patchs portent de la matière brute (résumé
      // encyclopédique, URL d'agrégateur), pas un texte rédigé pour le référentiel.
      ecartes.push({ patch, raison: "marqué « a_reformuler » — refusé sans --inclure-a-reformuler" });
      continue;
    }
    eligibles.push(patch);
  }
  const aTraiter = LIMITE === Infinity ? eligibles : eligibles.slice(0, LIMITE);

  // --- 3. validation PRÉALABLE ---------------------------------------------
  // Si le corpus est déjà cassé, on ne touche à rien : sinon le garde-fou
  // post-écriture restaurerait à chaque run et masquerait la vraie panne.
  const avant = validerCorpus("avant");
  if (!avant.ok) {
    console.error("\nCorpus DÉJÀ invalide avant application — rien n'a été écrit.");
    afficherErreursValidation(avant);
    console.error("Corriger le corpus (npm run valider) avant de rejouer ce script.");
    process.exit(1);
  }
  console.log("Validation préalable : corpus valide.");

  if (aTraiter.length === 0) {
    console.log(`\nAucun patch à appliquer (${ecartes.length} écarté(s)).`);
    for (const e of ecartes) console.log(`  ✗ ${e.patch?.cible_id ?? "(?)"} — ${e.raison}`);
    process.exit(0);
  }

  // --- 4. application en mémoire -------------------------------------------
  let corpus;
  try {
    corpus = chargerCorpus();
  } catch (e) {
    console.error(`Corpus illisible — rien n'a été écrit. ${e.message}`);
    process.exit(1);
  }

  const cheminChangelog = path.join(SEED, "changelog.json");
  const cheminQueue = path.join(SEED, "veille_queue.json");
  const changelog = existsSync(cheminChangelog) ? lireJSON(cheminChangelog) : [];
  const queue = existsSync(cheminQueue) ? lireJSON(cheminQueue) : [];
  const idsChangelogPris = new Set(changelog.map((e) => e?.id).filter(Boolean));

  const fichiersTouches = new Set();
  const appliques = [];

  for (const patch of aTraiter) {
    const cible = chaineRemplie(patch?.cible_id) ? corpus.index.get(patch.cible_id) : undefined;
    if (!cible) {
      ecartes.push({ patch, raison: `fiche cible « ${patch?.cible_id ?? "?"} » introuvable dans le corpus` });
      continue;
    }

    const resultat = appliquerPatch(patch, cible.fiche);
    if (!resultat.applique) {
      ecartes.push({ patch, raison: resultat.raison });
      continue;
    }

    fichiersTouches.add(cible.chemin);

    // Une entrée de changelog par fiche touchée : le changelog est public, il doit
    // dire QUELLE fiche a bougé et POURQUOI, pas seulement qu'un lot a tourné.
    changelog.push({
      id: idChangelogUnique(patch.cible_id, idsChangelogPris),
      date: MAINTENANT.toISOString(),
      type: "mise_a_jour",
      cible: patch.cible_id,
      resume: resumeChangelog(patch, resultat.changements),
      ...(patch.source && chaineRemplie(patch.source.titre) ? { source: patch.source } : {}),
    });

    // La proposition d'origine sort de la file de travail : sans cela, le prochain
    // appliquer-veille.mjs la re-proposerait à l'identique, indéfiniment.
    if (!CONSERVER_FILE) {
      const proposition = queue.find((p) => p?.id === patch.proposition_id);
      if (proposition) {
        proposition.statut = STATUT_PROPOSITION_APPLIQUEE;
        proposition.applique_le = AUJOURDHUI;
        proposition.patch_id = patch.id;
      }
    }

    appliques.push({ patch, changements: resultat.changements });
  }

  // --- 5. compte rendu ------------------------------------------------------
  console.log("");
  for (const { patch, changements } of appliques) {
    console.log(`  ${DRY_RUN ? "→ (simulé)" : "✓ appliqué"} ${patch.cible_id} · ${patch.champ} · ${patch.nature}`);
    for (const c of changements) console.log(`      ${c}`);
  }
  for (const e of ecartes) {
    console.log(`  ✗ écarté   ${e.patch?.cible_id ?? "(?)"} — ${e.raison}`);
  }

  if (appliques.length === 0) {
    console.log("\nAucun patch applicable — rien n'a été écrit.");
    process.exit(0);
  }

  // L'index du moteur de réponse est construit sur les champs de CONTENU des fiches —
  // these_centrale, apport, limites_critiques, resonance_ia et leurs équivalents IA et
  // gap. Ajouter une source ne le périme donc pas ; réécrire un de ces champs si.
  // L'oubli ne casse rien de visible : il rend seulement le passage modifié
  // introuvable, ou trouvable dans sa version ancienne. On n'avertit que quand c'est
  // le cas, pour que l'avertissement garde sa valeur — et dès la simulation, qui est
  // l'étape où la personne relit.
  const CHAMPS_INDEXES = new Set([
    "these_centrale", "apport", "limites_critiques", "resonance_ia",
    "capacites_cles", "limites_connues", "mecanisme", "mode_interaction",
    "apport_ia", "amelioration_possible", "axes_prospectifs",
    "scenario_present", "scenario_5ans", "scenario_15_20ans",
  ]);
  function avertirIndex(liste, simulation) {
    // `appliques` porte { patch, changements } — le champ visé est dans `patch`.
    const n = liste.filter((x) => CHAMPS_INDEXES.has(x.patch?.champ ?? x.champ)).length;
    if (n === 0) return;
    console.log(
      `\n${n} patch(s) ${simulation ? "toucheraient" : "ont touché"} un champ indexé : ` +
        `l'index du moteur de réponse ${simulation ? "serait" : "est"} périmé.`
    );
    console.log("  npm run indexer     puis     npm run verifier-index");
  }

  if (DRY_RUN) {
    console.log(
      `\n${appliques.length} patch(s) seraient appliqués sur ${fichiersTouches.size} fichier(s) de fiches, ` +
        `${appliques.length} entrée(s) de changelog seraient ajoutées.`
    );
    console.log("SIMULATION — aucun fichier n'a été écrit, aucune fiche modifiée.");
    avertirIndex(appliques, true);
    process.exit(0);
  }

  // --- 6. écriture, sous garde-fou -----------------------------------------
  const cheminsSauvegardes = [...fichiersTouches, cheminChangelog];
  if (!CONSERVER_FILE) cheminsSauvegardes.push(cheminQueue);
  const instantane = prendreInstantane(cheminsSauvegardes);

  try {
    for (const chemin of fichiersTouches) ecrireJSON(chemin, corpus.fichiers.get(chemin));
    ecrireJSON(cheminChangelog, changelog);
    if (!CONSERVER_FILE) ecrireJSON(cheminQueue, queue);
  } catch (e) {
    console.error(`\nÉchec pendant l'écriture — restauration en cours. ${e.message}`);
    const restaures = restaurer(instantane);
    console.error(`Fichiers restaurés : ${restaures.join(", ")}`);
    process.exit(1);
  }

  // --- 7. validation POSTÉRIEURE, et restauration si elle échoue ------------
  const apres = validerCorpus("apres");
  if (!apres.ok) {
    console.error("\nLa validation post-écriture a ÉCHOUÉ — restauration de l'état d'origine.");
    afficherErreursValidation(apres);
    const restaures = restaurer(instantane);
    console.error(`\nFichiers restaurés à l'identique : ${restaures.join(", ")}`);
    console.error("Aucune modification n'a été conservée. Corriger le fichier de patchs et rejouer.");
    process.exit(1);
  }

  console.log(
    `\n${appliques.length} patch(s) appliqué(s) sur ${fichiersTouches.size} fichier(s), ` +
      `${appliques.length} entrée(s) ajoutée(s) au changelog. Validation post-écriture : corpus valide.`
  );
  console.log(
    `Fichiers modifiés : ${[...cheminsSauvegardes].map(afficherChemin).join(", ")}`
  );
  console.log("\nRappel : ces modifications viennent d'un fichier de patchs relu par une personne.");
  console.log("Aucune fiche n'est jamais modifiée automatiquement sans validation humaine.");

  avertirIndex(appliques, false);
  process.exit(0);
}

main();

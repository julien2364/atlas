// Lot qualité — audit de fraîcheur du corpus (mégaprompt docs/megaprompt.md,
// §2 principe 3 « anti-obsolescence » et §7).
//
// Principe : aucune fiche n'est définitive. Une fiche documentée puis jamais
// revue redevient une fiche à re-vérifier. Ce script fait vieillir explicitement
// le corpus : toute fiche au statut "documente" ou "verifie_recemment" dont la
// derniere_verification remonte à plus de --seuil jours repasse au statut
// "a_re_auditer".
//
// Garde-fous (le script ne fabrique jamais de fraîcheur) :
//   - il ne touche NI au contenu de la fiche NI à derniere_verification, qui
//     doit rester la date du dernier contrôle réellement effectué par un humain ;
//   - il ne va que dans un sens : jamais de "a_re_auditer" -> "documente" ;
//   - il ignore les fiches "a_documenter" (elles ne sont pas encore documentées,
//     c'est le travail de scripts/documentation-recherche.mjs).
//
// Usage : node scripts/audit-fraicheur.mjs [--seuil=180] [--dry-run] [--limite=N]
//   --seuil=N   ancienneté en jours au-delà de laquelle une fiche bascule (défaut 180).
//               --seuil=0 fait basculer tout le corpus documenté (utile en test).
//   --limite=N  nombre maximum de fiches basculées sur ce run (défaut : pas de
//               limite), les plus anciennes d'abord — évite un basculement massif
//               d'un coup qui rendrait le référentiel illisible.
//   --dry-run   n'écrit aucun fichier, affiche seulement ce qui serait fait.

import { readFileSync, writeFileSync } from "node:fs";

const RACINE = "data/seed";
const FICHIERS_HUMAINES = ["philosophique", "social_1", "social_2", "evolution", "psychologique", "serenite"];

const STATUTS_VIEILLISSABLES = new Set(["documente", "verifie_recemment"]);
const STATUT_CIBLE = "a_re_auditer";

function argNombre(nom, defaut) {
  const brut = process.argv.find((a) => a.startsWith(`--${nom}=`))?.split("=")[1];
  if (brut === undefined) return defaut;
  const valeur = Number(brut);
  if (!Number.isFinite(valeur) || valeur < 0) {
    console.warn(`Valeur invalide pour --${nom} ("${brut}") — valeur par défaut utilisée (${defaut}).`);
    return defaut;
  }
  return valeur;
}

const SEUIL_JOURS = argNombre("seuil", 180);
const LIMITE = argNombre("limite", Infinity);
const DRY_RUN = process.argv.includes("--dry-run");

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
const MAINTENANT = new Date();
const AUJOURDHUI_ISO = MAINTENANT.toISOString().slice(0, 10);

// Ancienneté en jours pleins depuis derniere_verification. Une date absente ou
// illisible est traitée comme infiniment ancienne : mieux vaut re-auditer une
// fiche de trop que laisser passer une fiche sans traçabilité.
function ancienneteJours(dateIso) {
  if (!dateIso) return Infinity;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((MAINTENANT.getTime() - d.getTime()) / MS_PAR_JOUR);
}

// Chaque référentiel = un ou plusieurs fichiers JSON, tous des tableaux de fiches.
function chargerReferentiels() {
  return [
    {
      nom: "fiches humaines",
      fichiers: FICHIERS_HUMAINES.map((f) => `${RACINE}/fiches_humaines/${f}.json`),
    },
    { nom: "fiches IA", fichiers: [`${RACINE}/fiches_ia.json`] },
    { nom: "fiches de gap", fichiers: [`${RACINE}/fiches_gap.json`] },
  ].map((ref) => ({
    ...ref,
    contenus: ref.fichiers.map((chemin) => ({ chemin, fiches: JSON.parse(readFileSync(chemin, "utf-8")) })),
  }));
}

function ecrireJson(chemin, donnees) {
  // Même convention que le reste du dépôt : indentation 2, saut de ligne final.
  writeFileSync(chemin, `${JSON.stringify(donnees, null, 2)}\n`);
}

function main() {
  if (LIMITE !== Infinity) {
    console.log(`Audit de fraîcheur — seuil ${SEUIL_JOURS} jour(s), limite ${LIMITE} fiche(s)${DRY_RUN ? " — DRY RUN" : ""}.`);
  } else {
    console.log(`Audit de fraîcheur — seuil ${SEUIL_JOURS} jour(s), sans limite${DRY_RUN ? " — DRY RUN" : ""}.`);
  }

  const referentiels = chargerReferentiels();

  // 1) repérage des candidates, tous référentiels confondus, les plus anciennes d'abord.
  const candidates = [];
  let examinees = 0;
  for (const ref of referentiels) {
    for (const { chemin, fiches } of ref.contenus) {
      for (const fiche of fiches) {
        examinees++;
        if (!STATUTS_VIEILLISSABLES.has(fiche.statut)) continue;
        const age = ancienneteJours(fiche.derniere_verification);
        // >= et non > : --seuil=0 doit pouvoir faire basculer l'ensemble du corpus.
        if (age >= SEUIL_JOURS) {
          candidates.push({ fiche, age, chemin, referentiel: ref.nom });
        }
      }
    }
  }

  candidates.sort((a, b) => b.age - a.age); // les plus anciennes d'abord
  const aBasculer = candidates.slice(0, LIMITE === Infinity ? candidates.length : LIMITE);

  // 2) basculement effectif (en mémoire), et comptage par référentiel.
  const parReferentiel = new Map(referentiels.map((r) => [r.nom, 0]));
  const fichiersModifies = new Set();
  for (const { fiche, chemin, referentiel, age } of aBasculer) {
    fiche.statut = STATUT_CIBLE; // on ne touche ni au contenu ni à derniere_verification
    parReferentiel.set(referentiel, parReferentiel.get(referentiel) + 1);
    fichiersModifies.add(chemin);
    console.log(`  → ${fiche.id} (${referentiel}) — vérifiée le ${fiche.derniere_verification ?? "?"} (${age} j) → ${STATUT_CIBLE}`);
  }

  // 3) écriture des fichiers réellement modifiés + une entrée de changelog.
  if (aBasculer.length > 0 && !DRY_RUN) {
    for (const ref of referentiels) {
      for (const { chemin, fiches } of ref.contenus) {
        if (fichiersModifies.has(chemin)) ecrireJson(chemin, fiches);
      }
    }

    const detail = [...parReferentiel.entries()]
      .filter(([, n]) => n > 0)
      .map(([nom, n]) => `${n} ${nom}`)
      .join(", ");
    const cheminChangelog = `${RACINE}/changelog.json`;
    const changelog = JSON.parse(readFileSync(cheminChangelog, "utf-8"));
    changelog.push({
      id: `audit-fraicheur-${AUJOURDHUI_ISO}`,
      date: MAINTENANT.toISOString(),
      type: "mise_a_jour",
      cible: "referentiel/audit-fraicheur",
      resume: `Audit de fraîcheur automatique (seuil ${SEUIL_JOURS} jours) : ${aBasculer.length} fiche(s) repassée(s) au statut « à ré-auditer » (${detail}). Contenu et date de dernière vérification inchangés — seul le statut évolue, conformément au principe d'anti-obsolescence.`,
    });
    ecrireJson(cheminChangelog, changelog);
  }

  // 4) compte rendu.
  console.log(`\n${examinees} fiche(s) examinée(s), ${aBasculer.length} basculée(s) en « ${STATUT_CIBLE} »${DRY_RUN ? " (simulation, rien écrit)" : ""}.`);
  if (candidates.length > aBasculer.length) {
    console.log(`${candidates.length - aBasculer.length} fiche(s) éligible(s) reportée(s) au prochain run (limite ${LIMITE}).`);
  }

  console.log("\nPlus ancienne vérification restante par référentiel (fiches encore documentées) :");
  for (const ref of referentiels) {
    const restantes = ref.contenus
      .flatMap((c) => c.fiches)
      .filter((f) => STATUTS_VIEILLISSABLES.has(f.statut) && f.derniere_verification);
    if (restantes.length === 0) {
      console.log(`  ${ref.nom} : aucune fiche documentée restante.`);
      continue;
    }
    const plusAncienne = restantes.reduce((a, b) => (a.derniere_verification <= b.derniere_verification ? a : b));
    console.log(
      `  ${ref.nom} : ${plusAncienne.derniere_verification} (${ancienneteJours(plusAncienne.derniere_verification)} j, ${restantes.length} fiche(s))`
    );
  }

  if (aBasculer.length === 0) {
    console.log("\nAucune fiche à basculer — aucune entrée ajoutée au changelog.");
  }

  // Tâche de maintenance, pas un test : on ne fait jamais échouer l'appelant.
  process.exit(0);
}

main();

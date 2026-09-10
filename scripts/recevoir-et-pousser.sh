#!/usr/bin/env bash
#
# Atlas Humain × IA — réception d'un bundle et mise en production, en une commande.
#
#   ./scripts/recevoir-et-pousser.sh [chemin/vers/le.bundle]
#
# Sans argument, le script prend le bundle `atlas-*.bundle` le plus récent de
# ~/Downloads. C'est le cas courant : le fichier vient d'être téléchargé depuis la
# conversation Claude.
#
# Ce que le script fait, dans cet ordre, et pourquoi :
#
#   1. Vérifie que l'arbre de travail est propre. Un `git pull` sur un arbre sale
#      s'arrête à mi-chemin et laisse le dépôt dans un état difficile à lire.
#   2. `git fetch origin` puis avance `main` en fast-forward. C'est l'étape qui
#      manquait le 7 septembre : les crons GitHub (veille quotidienne, qualité
#      hebdomadaire) committent directement sur `main`, donc le dépôt distant a
#      presque toujours un ou deux commits d'avance sur la copie locale, et un
#      bundle incrémental construit sur ce sommet est refusé tant qu'on ne les a
#      pas récupérés — « Le dépôt ne dispose pas des commits prérequis suivants ».
#   3. Contrôle l'intégrité du bundle et l'applique en fast-forward.
#   4. Rejoue la suite de vérification complète, la même que la CI.
#   5. Pousse, ce qui déclenche le déploiement Vercel.
#
# Toute étape qui échoue arrête le script : rien de cassé ne part en production.

set -euo pipefail

DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Le chemin du bundle est résolu AVANT le `cd` : un chemin relatif donné depuis un
# autre répertoire pointerait sinon à côté.
BUNDLE_ARG="${1:-}"
if [ -n "$BUNDLE_ARG" ] && [ -f "$BUNDLE_ARG" ]; then
  BUNDLE_ARG="$(cd "$(dirname "$BUNDLE_ARG")" && pwd)/$(basename "$BUNDLE_ARG")"
fi

cd "$DEPOT"

vert()  { printf '\033[32m%s\033[0m\n' "$*"; }
rouge() { printf '\033[31m%s\033[0m\n' "$*"; }
gras()  { printf '\033[1m%s\033[0m\n' "$*"; }

echec() { rouge "✗ $*"; exit 1; }

# ---------------------------------------------------------------- 0. le bundle

BUNDLE="$BUNDLE_ARG"

if [ -z "$BUNDLE" ]; then
  # Une livraison dépose deux bundles : `atlas-lots-*` (incrémental, léger) et
  # `atlas-complet-*` (historique entier). On prend l'incrémental le plus récent en
  # priorité — le choix ne doit pas dépendre de l'ordre de téléchargement — et on
  # bascule sur l'autre s'il n'y en a pas.
  BUNDLE="$(ls -t "$HOME"/Downloads/atlas-lots-*.bundle 2>/dev/null | head -1 || true)"
  [ -n "$BUNDLE" ] || BUNDLE="$(ls -t "$HOME"/Downloads/atlas-*.bundle 2>/dev/null | head -1 || true)"
  [ -n "$BUNDLE" ] || echec "Aucun bundle trouvé dans ~/Downloads. Passe le chemin en argument."
  gras "Bundle retenu :"
  echo "  $BUNDLE"
fi

[ -f "$BUNDLE" ] || echec "Fichier introuvable : $BUNDLE"

# ------------------------------------------------- 1. l'arbre doit être propre

if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short
  echec "Arbre de travail sale. Committe ou remise ces changements (\`git stash\`) avant de relancer."
fi

BRANCHE="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCHE" = "main" ] || echec "Tu es sur la branche « $BRANCHE ». Bascule sur main : git checkout main"

# ------------------------------------- 2. récupérer ce que les crons ont poussé

gras "→ Récupération de l'état distant"
git fetch origin --quiet

AVANT="$(git rev-parse HEAD)"

if git merge-base --is-ancestor HEAD origin/main; then
  if [ "$AVANT" != "$(git rev-parse origin/main)" ]; then
    git merge --ff-only origin/main --quiet
    RETARD="$(git rev-list --count "$AVANT"..HEAD)"
    echo "  $RETARD commit(s) récupéré(s) depuis origin/main — probablement les crons."
  else
    echo "  Déjà à jour."
  fi
elif git merge-base --is-ancestor origin/main HEAD; then
  echo "  La copie locale est en avance sur origin/main. Rien à récupérer."
else
  rouge "Les historiques ont divergé : tu as des commits locaux qu'origin n'a pas,"
  rouge "et origin en a que tu n'as pas. Le script ne tranche pas ça tout seul."
  echo
  echo "  Locaux non poussés :"
  git log --oneline origin/main..HEAD | sed 's/^/    /'
  echo "  Distants non récupérés :"
  git log --oneline HEAD..origin/main | sed 's/^/    /'
  echo
  echec "Choisis : git rebase origin/main (recommandé) ou git merge origin/main."
fi

# ------------------------------------------------ 3. contrôler puis appliquer

gras "→ Contrôle du bundle"
VERIF="$(mktemp)"
trap 'rm -f "$VERIF"' EXIT
# LC_ALL=C : le git de macOS est souvent en français, et la sortie est filtrée plus bas.
if LC_ALL=C git bundle verify "$BUNDLE" >"$VERIF" 2>&1; then
  if grep -q "complete history" "$VERIF"; then
    echo "  Historique complet — aucun commit prérequis."
  else
    echo "  Incrémental — les commits prérequis sont présents."
  fi
else
  cat "$VERIF"
  echo
  echec "Le bundle réclame des commits absents du dépôt, ou il est corrompu. Demande un bundle autonome (historique complet)."
fi

SOMMET_AVANT="$(git rev-parse HEAD)"

# Le bundle est récupéré dans une réf locale plutôt qu'appliqué par `git pull`.
# Raison : `git pull --ff-only` échoue dès que le sommet du bundle n'est plus un
# descendant de HEAD, ce qui arrive à chaque fois qu'un cron pousse sur `main` entre
# la fabrication du bundle et sa réception — c'est-à-dire presque tous les jours, la
# veille tournant à 07h00 UTC. Le fetch préalable de l'étape 2 réglait la moitié
# « commits prérequis manquants » du problème ; celle-ci règle l'autre moitié.
# Un bundle autonome ne sauve pas de ce cas : historique complet n'est pas
# fast-forward possible.
git fetch "$BUNDLE" main:refs/atlas/lot --force --quiet

gras "→ Application du bundle"
if git merge-base --is-ancestor HEAD refs/atlas/lot; then
  git merge --ff-only refs/atlas/lot --quiet
else
  echo "  Le bundle a été fabriqué avant le dernier passage d'un cron."
  echo "  Rejeu de ses commits par-dessus l'état actuel."
  BASE="$(git merge-base HEAD refs/atlas/lot)"
  if ! git rebase --onto HEAD "$BASE" refs/atlas/lot --quiet; then
    git rebase --abort 2>/dev/null || true
    git checkout -q main
    git update-ref -d refs/atlas/lot 2>/dev/null || true
    echec "Rejeu impossible : conflit entre le bundle et ce que les crons ont poussé. Le dépôt est intact — demande un bundle refabriqué sur le sommet actuel."
  fi
  # Le rebase laisse HEAD détachée sur le résultat : on y amène `main`.
  git branch -f main HEAD
  git checkout -q main
fi
git update-ref -d refs/atlas/lot

NOUVEAUX="$(git rev-list --count "$SOMMET_AVANT"..HEAD)"
if [ "$NOUVEAUX" -eq 0 ]; then
  vert "✓ Rien de nouveau dans ce bundle — le dépôt le contenait déjà."
else
  echo "  $NOUVEAUX commit(s) appliqué(s) :"
  git log --oneline "$SOMMET_AVANT"..HEAD | sed 's/^/    /'
fi

# ------------------------------------------------------- 4. la même porte que la CI

gras "→ Vérification (validateur, types, lint, build)"
npm ci --silent
npm run verifier

# ------------------------------------------------------------------ 5. pousser

A_POUSSER="$(git rev-list --count origin/main..HEAD)"
if [ "$A_POUSSER" -eq 0 ]; then
  vert "✓ Rien à pousser — origin/main est déjà à ce sommet."
  exit 0
fi

gras "→ Envoi de $A_POUSSER commit(s) sur origin/main"
git push origin main

echo
vert "✓ Poussé. Le déploiement Vercel démarre tout seul."
echo "  Avancement : https://vercel.com/dyonysos/atlas-humain-ia"
echo "  Site       : https://atlas-humain-ia-dyonysos.vercel.app"

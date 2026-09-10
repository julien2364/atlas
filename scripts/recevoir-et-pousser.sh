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
cd "$DEPOT"

vert()  { printf '\033[32m%s\033[0m\n' "$*"; }
rouge() { printf '\033[31m%s\033[0m\n' "$*"; }
gras()  { printf '\033[1m%s\033[0m\n' "$*"; }

echec() { rouge "✗ $*"; exit 1; }

# ---------------------------------------------------------------- 0. le bundle

BUNDLE="${1:-}"

if [ -z "$BUNDLE" ]; then
  # Le plus récent, tri par date de modification. `ls -t` suffit et évite les
  # incompatibilités entre le find de macOS et celui de GNU.
  BUNDLE="$(ls -t "$HOME"/Downloads/atlas-*.bundle 2>/dev/null | head -1 || true)"
  [ -n "$BUNDLE" ] || echec "Aucun bundle trouvé dans ~/Downloads. Passe le chemin en argument."
  gras "Bundle retenu (le plus récent de ~/Downloads) :"
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
# LC_ALL=C : le git de macOS est souvent en français, et on filtre la sortie plus bas.
LC_ALL=C git bundle verify "$BUNDLE" >/tmp/atlas-bundle-verif.txt 2>&1 || {
  cat /tmp/atlas-bundle-verif.txt
  echo
  rouge "Le bundle réclame des commits que le dépôt n'a pas, ou il est corrompu."
  echec "Si des commits prérequis manquent malgré le fetch ci-dessus, demande un bundle autonome (historique complet)."
}
grep -E "complete history|requires these" /tmp/atlas-bundle-verif.txt | sed 's/^/  /' || true

SOMMET_AVANT="$(git rev-parse HEAD)"

gras "→ Application du bundle"
git pull --ff-only "$BUNDLE" main --quiet

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

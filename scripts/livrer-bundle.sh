#!/usr/bin/env bash
#
# Atlas Humain × IA — fabrication du bundle de livraison, côté session Claude.
#
#   npm run livrer            → bundle incrémental (léger) + bundle autonome (repli)
#   npm run livrer -- --seul  → bundle autonome uniquement
#
# Pourquoi deux bundles. Le proxy git de la session Claude refuse de pousser vers
# `julien2364/atlas` — le dépôt n'est pas dans l'ensemble autorisé de la session, et
# aucun jeton n'y change rien. La livraison passe donc par bundle, et l'expérience du
# 7 septembre a montré qu'il en faut deux :
#
#   • l'incrémental (`--not origin/main`) ne pèse que les nouveaux commits, mais il
#     réclame que la copie de destination possède déjà le sommet distant connu ici ;
#   • l'autonome embarque tout l'historique : il sert quand ces commits prérequis
#     manquent, par exemple sur une copie restée longtemps en arrière.
#
# Attention : l'autonome ne dispense PAS du rejeu. Quand un cron a avancé `main`
# entre la fabrication du bundle et sa réception, le sommet du bundle n'est plus un
# descendant du sommet local, et aucun des deux bundles ne s'applique en
# fast-forward. C'est `scripts/recevoir-et-pousser.sh` qui règle ce cas, en rejouant
# les commits du bundle par-dessus l'état courant.
#
# Les deux atterrissent dans /mnt/user-data/outputs, d'où ils sont livrés dans la
# conversation.

set -euo pipefail

DEPOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DEPOT"

SORTIE="${ATLAS_SORTIE:-/mnt/user-data/outputs}"
DATE="$(date +%Y-%m-%d)"
SEUL=0
[ "${1:-}" = "--seul" ] && SEUL=1

mkdir -p "$SORTIE"

git fetch origin --quiet 2>/dev/null || echo "· fetch impossible (hors ligne) — on travaille sur origin/main tel qu'il est connu ici."

A_POUSSER="$(git rev-list --count origin/main..HEAD)"
echo "Sommet local : $(git rev-parse --short HEAD) — $A_POUSSER commit(s) non poussé(s)"

# `git bundle create` écrit mal directement dans /mnt/user-data/outputs (pack-objects
# meurt sur un « Bad file descriptor »). On fabrique dans $HOME puis on copie.
TAMPON="$(mktemp -d)"
trap 'rm -rf "$TAMPON"' EXIT

if [ "$SEUL" -eq 0 ] && [ "$A_POUSSER" -gt 0 ]; then
  INC="$TAMPON/atlas-lots-$DATE.bundle"
  git bundle create "$INC" main --not origin/main
  git bundle verify "$INC" >/dev/null 2>&1
  cp "$INC" "$SORTIE/"
  echo "✓ $(basename "$INC") — $(du -h "$INC" | cut -f1), incrémental"
fi

COMPLET="$TAMPON/atlas-complet-$DATE.bundle"
git bundle create "$COMPLET" main
git bundle verify "$COMPLET" >/dev/null 2>&1
cp "$COMPLET" "$SORTIE/"
echo "✓ $(basename "$COMPLET") — $(du -h "$COMPLET" | cut -f1), historique complet"

# Sauvegarde du dépôt entier, .git inclus : c'est elle qui protège vraiment le travail.
ARCHIVE="$TAMPON/atlas-depot-complet-$DATE.tar.gz"
tar czf "$ARCHIVE" -C "$(dirname "$DEPOT")" \
  --exclude=node_modules --exclude=.next --exclude=.turbo "$(basename "$DEPOT")"
cp "$ARCHIVE" "$SORTIE/"
echo "✓ $(basename "$ARCHIVE") — $(du -h "$ARCHIVE" | cut -f1), dépôt entier avec historique"

echo
echo "Côté Mac, une seule commande à lancer dans ~/Claude/atlas :"
echo "  ./scripts/recevoir-et-pousser.sh"

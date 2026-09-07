"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Bascule de thème à trois états — Clair / Sombre / Système.
 *
 * Deux pièges évités ici, explicitement :
 *
 * 1. **Hydratation.** Le choix stocké n'est JAMAIS lu pendant le rendu React :
 *    `useSyncExternalStore` s'en charge lui-même — `getServerSnapshot` rend
 *    "systeme" pour le HTML produit par le serveur et pour le tout premier
 *    rendu du navigateur (identiques, donc), puis React ne bascule sur la
 *    vraie valeur lue par `getSnapshot` qu'une fois l'hydratation terminée,
 *    sans qu'aucun `useEffect` de ce composant n'appelle `setState`.
 * 2. **Flash de thème clair.** Ce composant n'est pas responsable de
 *    l'application initiale du thème : c'est le script inline de
 *    `app/layout.tsx` qui pose la classe `.dark` sur `<html>` avant le premier
 *    rendu. Ici on ne fait que RÉAGIR à un changement de choix.
 *
 * Bénéfice annexe de `useSyncExternalStore` : l'abonnement écoute aussi
 * l'événement natif `storage`, donc un changement de thème dans un onglet se
 * répercute en direct dans les autres onglets ouverts sur le site.
 */

export type ChoixTheme = "clair" | "sombre" | "systeme";

export const CLE_THEME = "atlas-theme";

// Événement synthétique déclenché juste après une écriture locale de
// `localStorage`. L'événement natif "storage" ne se déclenche que dans les
// AUTRES onglets, jamais dans celui qui vient d'écrire — sans ce relais,
// cliquer un bouton ici ne mettrait à jour ni ce composant lui-même.
const EVENEMENT_LOCAL = "atlas-theme-local";

// Dernière lecture de localStorage, mémorisée pour que `getSnapshot` rende une
// valeur STABLE entre deux appels tant que le contenu stocké n'a pas changé —
// sans ça, `useSyncExternalStore` verrait une valeur "neuve" à chaque rendu et
// boucle indéfiniment.
let dernierBrutLu: string | null = null;
let derniereValeurLue: ChoixTheme = "systeme";

// Repli quand `localStorage` est indisponible (navigation privée stricte) : le
// choix reste actif pour la session en cours au lieu de retomber de force sur
// « système » à chaque lecture.
let memoireSansStockage: ChoixTheme = "systeme";

function getSnapshot(): ChoixTheme {
  let brut: string | null;
  try {
    brut = window.localStorage.getItem(CLE_THEME);
  } catch {
    return memoireSansStockage;
  }
  if (brut !== dernierBrutLu) {
    dernierBrutLu = brut;
    derniereValeurLue = brut === "clair" || brut === "sombre" || brut === "systeme" ? brut : "systeme";
  }
  return derniereValeurLue;
}

function getServerSnapshot(): ChoixTheme {
  return "systeme";
}

function souscrire(surChangement: () => void): () => void {
  window.addEventListener("storage", surChangement);
  window.addEventListener(EVENEMENT_LOCAL, surChangement);
  return () => {
    window.removeEventListener("storage", surChangement);
    window.removeEventListener(EVENEMENT_LOCAL, surChangement);
  };
}

const OPTIONS: { valeur: ChoixTheme; libelle: string; glyphe: string; titre: string }[] = [
  { valeur: "clair", libelle: "Clair", glyphe: "☀", titre: "Forcer le thème clair" },
  { valeur: "sombre", libelle: "Sombre", glyphe: "☾", titre: "Forcer le thème sombre" },
  { valeur: "systeme", libelle: "Système", glyphe: "◐", titre: "Suivre la préférence du système d'exploitation" },
];

function estSombre(choix: ChoixTheme): boolean {
  if (choix === "sombre") return true;
  if (choix === "clair") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function appliquer(choix: ChoixTheme): void {
  const racine = document.documentElement;
  const sombre = estSombre(choix);
  racine.classList.toggle("dark", sombre);
  racine.style.colorScheme = sombre ? "dark" : "light";
}

export default function BasculeTheme() {
  const choix = useSyncExternalStore(souscrire, getSnapshot, getServerSnapshot);

  // Application du choix au DOM (système externe à React), et suivi de la
  // préférence système en direct tant qu'on est en mode « système ». Aucun
  // `setState` ici : on ne fait que synchroniser le DOM avec `choix`.
  useEffect(() => {
    appliquer(choix);
    if (choix !== "systeme") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const surChangement = () => appliquer("systeme");
    media.addEventListener("change", surChangement);
    return () => media.removeEventListener("change", surChangement);
  }, [choix]);

  const definirChoix = useCallback((nouveau: ChoixTheme) => {
    try {
      window.localStorage.setItem(CLE_THEME, nouveau);
    } catch {
      // Le choix s'applique quand même pour la session en cours, il n'est
      // simplement pas persisté ni propagé aux autres onglets.
      memoireSansStockage = nouveau;
    }
    window.dispatchEvent(new Event(EVENEMENT_LOCAL));
  }, []);

  return (
    <div
      role="group"
      aria-label="Thème de l'interface"
      className="inline-flex overflow-hidden rounded-full border border-neutral-300 text-[11px] dark:border-neutral-700"
    >
      {OPTIONS.map((option) => {
        const actif = choix === option.valeur;
        return (
          <button
            key={option.valeur}
            type="button"
            onClick={() => definirChoix(option.valeur)}
            aria-pressed={actif}
            title={option.titre}
            className={`px-2.5 py-1 transition-colors ${
              actif
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            <span aria-hidden="true" className="mr-1">
              {option.glyphe}
            </span>
            {option.libelle}
          </button>
        );
      })}
    </div>
  );
}

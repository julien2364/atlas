"use client";

import { useEffect, useState } from "react";

/**
 * Bascule de thème à trois états — Clair / Sombre / Système.
 *
 * Deux pièges évités ici, explicitement :
 *
 * 1. **Hydratation.** Le choix stocké n'est JAMAIS lu pendant le rendu : l'état
 *    part à `null` et n'est renseigné que dans un `useEffect`. Le HTML produit
 *    par le serveur et le premier rendu du navigateur sont donc identiques,
 *    quel que soit le contenu de `localStorage`.
 * 2. **Flash de thème clair.** Ce composant n'est pas responsable de
 *    l'application initiale du thème : c'est le script inline de
 *    `app/layout.tsx` qui pose la classe `.dark` sur `<html>` avant le premier
 *    rendu. Ici on ne fait que RÉAGIR à un changement de choix.
 */

export type ChoixTheme = "clair" | "sombre" | "systeme";

export const CLE_THEME = "atlas-theme";

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
  const [choix, setChoix] = useState<ChoixTheme | null>(null);

  // Lecture du choix persisté — après le montage, jamais pendant le rendu.
  useEffect(() => {
    let initial: ChoixTheme = "systeme";
    try {
      const stocke = window.localStorage.getItem(CLE_THEME);
      if (stocke === "clair" || stocke === "sombre" || stocke === "systeme") initial = stocke;
    } catch {
      /* localStorage indisponible (navigation privée stricte) : on reste sur « système ». */
    }
    setChoix(initial);
  }, []);

  // Application + persistance du choix, et suivi du système tant qu'on est en mode « système ».
  useEffect(() => {
    if (!choix) return;
    appliquer(choix);
    try {
      window.localStorage.setItem(CLE_THEME, choix);
    } catch {
      /* idem */
    }
    if (choix !== "systeme") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const surChangement = () => appliquer("systeme");
    media.addEventListener("change", surChangement);
    return () => media.removeEventListener("change", surChangement);
  }, [choix]);

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
            onClick={() => setChoix(option.valeur)}
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

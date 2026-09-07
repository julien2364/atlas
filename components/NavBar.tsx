"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BasculeTheme from "@/components/BasculeTheme";
import { SITE_MODE } from "@/lib/site-config";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/referentiel-humain", label: "Référentiel humain" },
  { href: "/referentiel-ia", label: "Référentiel IA" },
  { href: "/cartographie", label: "Cartographie" },
  { href: "/comparateur", label: "Comparateur" },
  { href: "/questions", label: "Questions" },
  { href: "/veille", label: "Veille" },
  { href: "/methodologie", label: "Méthodologie" },
];

/** Vrai si le lien correspond à la page courante (ou à sa section). */
function estActif(chemin: string | null, href: string): boolean {
  if (!chemin) return false;
  if (href === "/") return chemin === "/";
  return chemin === href || chemin.startsWith(`${href}/`);
}

export default function NavBar() {
  const chemin = usePathname();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ATLAS <span className="text-neutral-500 dark:text-neutral-400">Humain × IA</span>
        </Link>

        {/* Sur téléphone la barre défile horizontalement dans son propre
            conteneur plutôt que d'imposer un menu déroulant : huit entrées
            restent atteignables d'un geste, et la page ne défile jamais. */}
        <nav aria-label="Navigation principale" className="defilement-h -mx-4 w-full px-4 sm:mx-0 sm:w-auto sm:px-0">
          <ul className="flex w-max gap-x-4 gap-y-1 text-sm sm:w-auto sm:flex-wrap">
            {links.map((l) => {
              const actif = estActif(chemin, l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={actif ? "page" : undefined}
                    className={`whitespace-nowrap rounded py-1 transition-colors ${
                      actif
                        ? "font-medium text-neutral-900 underline decoration-2 underline-offset-4 dark:text-white"
                        : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          {SITE_MODE === "internal" && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Usage interne
            </span>
          )}
          <BasculeTheme />
        </div>
      </div>
    </header>
  );
}

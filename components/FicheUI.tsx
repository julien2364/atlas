// Briques de présentation partagées par les pages de fiche (/fiche/humaine, /fiche/ia, /gap).
// Server Components : aucun hook, aucun état — tout est rendu au build.

import Link from "next/link";
import type { ReactNode } from "react";
import type { Source } from "@/lib/types";
import { formatDateFr } from "@/lib/corpus";
import type { ElementAriane } from "@/lib/seo";

/* Fil d'Ariane visible — le pendant JSON-LD est produit par jsonLdFilAriane(). */
export function FilAriane({ elements }: { elements: ElementAriane[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-xs text-neutral-500">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {elements.map((element, index) => {
          const dernier = index === elements.length - 1;
          return (
            <li key={`${index}-${element.href}`} className="flex items-center gap-1.5">
              {dernier ? (
                <span aria-current="page" className="text-neutral-700 dark:text-neutral-300">
                  {element.nom}
                </span>
              ) : (
                <Link href={element.href} className="hover:text-neutral-900 hover:underline dark:hover:text-white">
                  {element.nom}
                </Link>
              )}
              {dernier ? null : (
                <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* Le badge de statut vit dans components/Badges.tsx (couleur + glyphe, cf.
   docs/design-system.md §5.1). Réexporté ici pour que les pages de fiche
   gardent un point d'import unique. */
export { BadgeStatut, BadgeConfiance, BadgeSubstituabilite } from "@/components/Badges";

export function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-neutral-300 px-2 py-0.5 text-[11px] leading-5 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
      {children}
    </span>
  );
}

/** Section de texte titrée, utilisée pour thèse / apport / limites / scénarios. */
export function Bloc({ titre, children, id }: { titre: string; children: ReactNode; id?: string }) {
  return (
    // La colonne de texte est bornée à ~75 signes (docs/design-system.md §3) :
    // au-delà, l'œil perd la ligne suivante sur un écran large.
    <section id={id} className="space-y-2 scroll-mt-24">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{titre}</h2>
      <div className="max-w-3xl text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{children}</div>
    </section>
  );
}

/** Date de vérification, affichée et lisible par machine. */
export function DateVerification({ date }: { date: string }) {
  return (
    <span className="text-[11px] leading-5 text-neutral-500">
      Vérifié le <time dateTime={date}>{formatDateFr(date)}</time>
    </span>
  );
}

/**
 * Liste de sources cliquables : le type primaire/secondaire est toujours visible,
 * conformément à l'exigence de sourçage du mégaprompt (section 10).
 */
export function ListeSources({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) {
    return <p className="text-sm text-neutral-500">Aucune source enregistrée pour cette entrée.</p>;
  }
  return (
    <ol className="space-y-2 text-sm">
      {sources.map((source, index) => (
        <li key={`${index}-${source.titre}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="tabular-nums text-neutral-500 dark:text-neutral-400">{index + 1}.</span>
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-neutral-300 hover:decoration-neutral-600 dark:decoration-neutral-600 dark:hover:decoration-neutral-300"
            >
              {source.titre}
            </a>
          ) : (
            <span>{source.titre}</span>
          )}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
              source.type === "primaire"
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
            }`}
          >
            {source.type}
          </span>
          {source.date ? (
            <time dateTime={source.date} className="text-xs text-neutral-500 dark:text-neutral-400">
              {formatDateFr(source.date)}
            </time>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Carte de navigation vers une autre fiche (connexes, gaps, fiches liées). */
export function CarteLien({ href, titre, sousTitre }: { href: string; titre: string; sousTitre?: string }) {
  return (
    <Link
      href={href}
      className="block h-full rounded-lg border border-neutral-200 p-3 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <span className="block text-sm font-medium">{titre}</span>
      {sousTitre ? <span className="mt-1 block text-xs text-neutral-500">{sousTitre}</span> : null}
    </Link>
  );
}

"use client";

import type { ChangelogEntry } from "@/lib/types";

// Frise chronologique — Lot 7 / mégaprompt section 8.
// Faute de date d'apparition réelle et sourcée pour chaque fiche IA (l'ajouter
// nécessiterait une recherche documentaire dédiée, cf. chantier "documentation
// en masse depuis des sources réelles"), cette frise trace l'évolution du
// projet lui-même via le changelog — seule série d'événements réellement datée
// et vérifiable disponible aujourd'hui.

const TYPE_LABEL: Record<ChangelogEntry["type"], string> = {
  ajout: "Ajout",
  mise_a_jour: "Mise à jour",
  correction: "Correction",
  evolution_structurelle: "Évolution structurelle",
};

const TYPE_COLOR: Record<ChangelogEntry["type"], string> = {
  ajout: "bg-emerald-500",
  mise_a_jour: "bg-sky-500",
  correction: "bg-amber-500",
  evolution_structurelle: "bg-indigo-500",
};

export default function FriseChangelog({ entries }: { entries: ChangelogEntry[] }) {
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length === 0) {
    return <p className="text-xs text-neutral-500">Aucune entrée de changelog pour l&apos;instant.</p>;
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-0">
        {sorted.map((e, i) => (
          <div key={e.id} className="flex items-start">
            <div className="flex w-56 flex-col items-start px-3">
              <span className="text-[10px] text-neutral-400">
                {new Date(e.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${TYPE_COLOR[e.type]}`} />
              <span className="mt-1 text-xs font-medium">{e.cible}</span>
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">{TYPE_LABEL[e.type]}</span>
              <p className="mt-1 line-clamp-4 text-xs text-neutral-500">{e.resume}</p>
            </div>
            {i < sorted.length - 1 && <div className="mt-[18px] h-px w-8 bg-neutral-300 dark:bg-neutral-700" />}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import type { ChangelogEntry } from "@/lib/types";

// Frise chronologique — Lot 7 / mégaprompt section 8.
// Faute de date d'apparition réelle et sourcée pour chaque fiche IA (l'ajouter
// nécessiterait une recherche documentaire dédiée, cf. chantier "documentation
// en masse depuis des sources réelles"), cette frise trace l'évolution du
// projet lui-même via le changelog — seule série d'événements réellement datée
// et vérifiable disponible aujourd'hui.
//
// Extension (lot cartographies) : les jalons sont regroupés par jour, et
// chaque jour porte le volume de fiches documentées atteint à cette étape.
// Ce volume n'est pas déclaratif : il est recompté à partir des fiches dont la
// date de `derniere_verification` est antérieure ou égale au jalon (cf.
// CartographieClient). Aucune valeur n'est interpolée entre deux jalons.

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

// Volume cumulé de fiches documentées atteint à la date du jalon.
export interface JalonVolume {
  date: string; // jour ISO (AAAA-MM-JJ)
  humaines: number;
  ia: number;
  gaps: number;
}

const SERIES: { cle: keyof Omit<JalonVolume, "date">; label: string; couleur: string }[] = [
  { cle: "humaines", label: "fiches humaines", couleur: "#6366f1" },
  { cle: "ia", label: "fiches IA", couleur: "#14b8a6" },
  { cle: "gaps", label: "fiches de gap", couleur: "#f97316" },
];

const LARGEUR_CARTE = 224; // w-56
const LARGEUR_LIEN = 32; // w-8
const HAUTEUR_VOLUME = 64;

function jour(date: string): string {
  return date.slice(0, 10);
}

function formatJour(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function totalJalon(v: JalonVolume): number {
  return v.humaines + v.ia + v.gaps;
}

export default function FriseChangelog({
  entries,
  volumes = [],
}: {
  entries: ChangelogEntry[];
  volumes?: JalonVolume[];
}) {
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length === 0) {
    return <p className="text-xs text-neutral-500">Aucune entrée de changelog pour l&apos;instant.</p>;
  }

  // Regroupement par jour : plusieurs jalons du changelog partagent la même date.
  const groupes: { jour: string; entrees: ChangelogEntry[] }[] = [];
  sorted.forEach((e) => {
    const j = jour(e.date);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.jour === j) dernier.entrees.push(e);
    else groupes.push({ jour: j, entrees: [e] });
  });

  const volumeParJour = new Map(volumes.map((v) => [jour(v.date), v]));
  const maxTotal = Math.max(1, ...volumes.map(totalJalon));

  return (
    <div className="w-full max-w-full overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch gap-6">
        {groupes.map((groupe, gi) => {
          const largeur = groupe.entrees.length * LARGEUR_CARTE + (groupe.entrees.length - 1) * LARGEUR_LIEN;
          const volume = volumeParJour.get(groupe.jour);
          const precedent = gi > 0 ? volumeParJour.get(groupes[gi - 1].jour) : undefined;
          const delta = volume && precedent ? totalJalon(volume) - totalJalon(precedent) : null;

          return (
            <section
              key={groupe.jour}
              aria-label={`Étape du ${formatJour(groupe.jour)}`}
              className={gi > 0 ? "border-l border-neutral-200 pl-6 dark:border-neutral-800" : ""}
            >
              <div style={{ width: largeur }}>
                <h4 className="text-xs font-medium">{formatJour(groupe.jour)}</h4>
                {volume ? (
                  <p className="mt-0.5 text-[10px] text-neutral-500">
                    {totalJalon(volume)} fiches documentées à cette étape ({volume.humaines} humaines · {volume.ia} IA ·{" "}
                    {volume.gaps} gap)
                    {delta !== null && delta > 0 ? ` — +${delta} depuis l'étape précédente` : ""}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[10px] text-neutral-400">Volume de fiches non recalculable à cette date.</p>
                )}
                {volume && (
                  // Palier de l'aire cumulée : la hauteur est proportionnelle au
                  // volume total, l'empilement montre sa composition. Purement
                  // décoratif — les chiffres sont écrits juste au-dessus.
                  <svg
                    width={largeur}
                    height={HAUTEUR_VOLUME}
                    aria-hidden="true"
                    focusable="false"
                    className="mt-1 block"
                  >
                    {(() => {
                      const hauteurTotale = (totalJalon(volume) / maxTotal) * (HAUTEUR_VOLUME - 2);
                      let y = HAUTEUR_VOLUME;
                      return SERIES.map((s) => {
                        const part = totalJalon(volume) > 0 ? volume[s.cle] / totalJalon(volume) : 0;
                        const h = part * hauteurTotale;
                        y -= h;
                        return <rect key={s.cle} x={0} y={y} width={largeur} height={h} fill={s.couleur} opacity={0.85} />;
                      });
                    })()}
                    <line
                      x1={0}
                      y1={HAUTEUR_VOLUME - 0.5}
                      x2={largeur}
                      y2={HAUTEUR_VOLUME - 0.5}
                      stroke="currentColor"
                      strokeOpacity={0.25}
                    />
                  </svg>
                )}
              </div>

              <div className="mt-3 flex">
                {groupe.entrees.map((e, i) => (
                  <div key={e.id} className="flex items-start">
                    <div className="flex w-56 flex-col items-start px-3">
                      <span className="text-[10px] text-neutral-400">
                        {new Date(e.date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className={`mt-1 inline-block h-2.5 w-2.5 rounded-full ${TYPE_COLOR[e.type]}`} />
                      <span className="mt-1 text-xs font-medium">{e.cible}</span>
                      <span className="text-[10px] uppercase tracking-wide text-neutral-400">{TYPE_LABEL[e.type]}</span>
                      <p className="mt-1 line-clamp-4 text-xs text-neutral-500">{e.resume}</p>
                    </div>
                    {i < groupe.entrees.length - 1 && (
                      <div className="mt-[18px] h-px w-8 bg-neutral-300 dark:bg-neutral-700" />
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-neutral-500">
        {SERIES.map((s) => (
          <span key={s.cle} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.couleur }} />
            Volume — {s.label}
          </span>
        ))}
        {(Object.keys(TYPE_LABEL) as ChangelogEntry["type"][]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${TYPE_COLOR[t]}`} />
            {TYPE_LABEL[t]}
          </span>
        ))}
      </div>
    </div>
  );
}

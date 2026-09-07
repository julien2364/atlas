import type { Metadata } from "next";
import Link from "next/link";
import fiches from "@/data/seed/fiches_humaines";
import type { FicheHumaine } from "@/lib/types";
import { cheminFicheHumaine } from "@/lib/corpus";
import { BadgeStatut } from "@/components/Badges";

const data = fiches as unknown as FicheHumaine[];

export const metadata: Metadata = {
  title: "Référentiel A — capacités humaines",
  description:
    "Les capacités humaines cartographiées par ATLAS : social, psychologique, philosophique, évolution, sérénité de l'espèce. Chaque entrée dispose de sa fiche sourcée et datée.",
  alternates: { canonical: "/referentiel-humain" },
};

const AXES: Record<string, string> = {
  social: "Social",
  psychologique: "Psychologique",
  philosophique: "Philosophique",
  evolution: "Évolution",
  serenite: "Sérénité de l'espèce",
};

function FicheHumaineDetail({ f }: { f: FicheHumaine }) {
  return (
    <details id={f.id} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <summary className="cursor-pointer font-medium">
        {f.nom} {f.periode_courant ? <span className="text-neutral-500 dark:text-neutral-400">— {f.periode_courant}</span> : null}
        <span className="ml-2">
          <BadgeStatut statut={f.statut} />
        </span>
      </summary>
      {f.statut === "documente" ? (
        <div className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <p><strong>Thèse centrale :</strong> {f.these_centrale}</p>
          <p><strong>Apport :</strong> {f.apport}</p>
          <p><strong>Limites et critiques :</strong> {f.limites_critiques}</p>
          {f.resonance_ia && <p><strong>Résonance avec l&apos;IA :</strong> {f.resonance_ia}</p>}
          {f.sources.length > 0 && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Sources : {f.sources.map((s) => s.titre).join(" · ")}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Fiche pas encore documentée.</p>
      )}
      <p className="mt-3 text-sm">
        <Link
          href={cheminFicheHumaine(f.id)}
          className="underline decoration-neutral-300 hover:decoration-neutral-600 dark:decoration-neutral-600 dark:hover:decoration-neutral-300"
        >
          Ouvrir la fiche complète
        </Link>
      </p>
    </details>
  );
}

export default function ReferentielHumainPage() {
  const parAxe = data.reduce<Record<string, FicheHumaine[]>>((acc, f) => {
    (acc[f.axe] ??= []).push(f);
    return acc;
  }, {});

  const nombreDocumentees = data.filter((f) => f.statut === "documente").length;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Référentiel A — capacités humaines</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {data.length} capacités réparties sur cinq axes, dont {nombreDocumentees} documentées et sourcées. Chaque entrée
          se déplie sur sa thèse centrale, son apport et ses limites critiques ; sa fiche complète ajoute les sources
          datées, les analyses de gap qui la citent et les fiches connexes.
        </p>
        <nav aria-label="Axes du référentiel humain" className="mt-4">
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {Object.entries(AXES).map(([axe, label]) => {
              const n = (parAxe[axe] ?? []).length;
              return n === 0 ? null : (
                <li key={axe}>
                  <a
                    href={`#axe-${axe}`}
                    className="rounded-full border border-neutral-300 px-3 py-1 text-neutral-600 transition-colors hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300"
                  >
                    {label} ({n})
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      {Object.entries(AXES).map(([axe, label]) => {
        const entries = parAxe[axe] ?? [];
        if (entries.length === 0) return null;
        const parSousDomaine = entries.reduce<Record<string, FicheHumaine[]>>((acc, f) => {
          const key = f.sous_domaine ?? "général";
          (acc[key] ??= []).push(f);
          return acc;
        }, {});
        return (
          <section key={axe} id={`axe-${axe}`} className="scroll-mt-24">
            <h2 className="text-lg font-medium">
              {label} <span className="text-sm font-normal text-neutral-500">({entries.length})</span>
            </h2>
            <div className="mt-3 space-y-4">
              {Object.entries(parSousDomaine).map(([sd, items]) => {
                const documentees = items.filter((f) => f.statut === "documente");
                const nonDocumentees = items.filter((f) => f.statut !== "documente");
                return (
                  <div key={sd}>
                    <h3 className="text-sm font-medium text-neutral-500">{sd.replace(/_/g, " ")}</h3>
                    {documentees.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {documentees.map((f) => (
                          <FicheHumaineDetail key={f.id} f={f} />
                        ))}
                      </div>
                    )}
                    {nonDocumentees.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {nonDocumentees.map((f) => (
                          <li key={f.id} className="flex items-center gap-2 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-800">
                            <Link
                              href={cheminFicheHumaine(f.id)}
                              className="underline decoration-neutral-300 hover:decoration-neutral-600 dark:decoration-neutral-600 dark:hover:decoration-neutral-300"
                            >
                              {f.nom}
                            </Link>
                            <BadgeStatut statut={f.statut} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

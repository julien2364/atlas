import type { Metadata } from "next";
import Link from "next/link";
import fiches from "@/data/seed/fiches_ia.json";
import type { FicheIA } from "@/lib/types";
import { cheminFicheIA } from "@/lib/corpus";
import { BadgeStatut } from "@/components/Badges";

const data = fiches as unknown as FicheIA[];

export const metadata: Metadata = {
  title: "Référentiel B — capacités IA",
  description:
    "Les capacités de l'IA cartographiées par ATLAS : génératif et raisonnement, agentique, scientifique, sectoriel, limites, data science. Usages documentés par secteur avec niveau de maturité TRL.",
  alternates: { canonical: "/referentiel-ia" },
};

const AXES: Record<string, string> = {
  generatif_raisonnement: "Génératif / raisonnement",
  agentique: "Agentique",
  scientifique: "Scientifique",
  sectoriel: "Sectoriel",
  limites: "Limites",
  predictif_data_science: "Data science / modèles prédictifs",
};

export default function ReferentielIAPage() {
  const parAxe = data.reduce<Record<string, FicheIA[]>>((acc, f) => {
    (acc[f.axe] ??= []).push(f);
    return acc;
  }, {});

  const nombreDocumentees = data.filter((f) => f.statut === "documente").length;
  const nombreUsages = data.reduce((n, f) => n + (f.usages?.length ?? 0), 0);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Référentiel B — capacités IA</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {data.length} capacités réparties sur six axes, dont {nombreDocumentees} documentées, et {nombreUsages}
          {" "}usages sectoriels notés sur l&apos;échelle de maturité TRL (1 à 9). Une même capacité peut être mûre en
          industrie et expérimentale en pharmacie : la <a href="/cartographie" className="underline">cartographie</a>{" "}
          en donne la grille complète.
        </p>
        <nav aria-label="Axes du référentiel IA" className="mt-4">
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
        return (
          <section key={axe} id={`axe-${axe}`} className="scroll-mt-24">
            <h2 className="text-lg font-medium">{label} <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">({entries.length})</span></h2>
            <div className="mt-3 space-y-3">
              {entries.map((f) => (
                <details key={f.id} id={f.id} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
                  <summary className="cursor-pointer font-medium">
                    {f.nom} {f.editeur ? <span className="text-neutral-500 dark:text-neutral-400">— {f.editeur}</span> : null}
                    <span className="ml-2">
                      <BadgeStatut statut={f.statut} />
                    </span>
                  </summary>
                  {f.statut === "documente" && (
                    <div className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                      {f.architecture && <p><strong>Architecture :</strong> {f.architecture}</p>}
                      {f.capacites_cles.length > 0 && (
                        <div>
                          <strong>Capacités clés :</strong>
                          <ul className="ml-4 list-disc">{f.capacites_cles.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </div>
                      )}
                      {f.limites_connues && <p><strong>Limites connues :</strong> {f.limites_connues}</p>}
                      {f.sources.length > 0 && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Sources : {f.sources.map((s) => s.titre).join(" · ")}</p>
                      )}
                    </div>
                  )}
                  <p className="mt-3 text-sm">
                    <Link
                      href={cheminFicheIA(f.id)}
                      className="underline decoration-neutral-300 hover:decoration-neutral-600 dark:decoration-neutral-600 dark:hover:decoration-neutral-300"
                    >
                      Ouvrir la fiche complète
                    </Link>
                  </p>
                </details>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

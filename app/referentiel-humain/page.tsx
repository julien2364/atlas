import fiches from "@/data/seed/fiches_humaines.json";
import type { FicheHumaine } from "@/lib/types";

const data = fiches as unknown as FicheHumaine[];

const AXES: Record<string, string> = {
  social: "Social",
  psychologique: "Psychologique",
  philosophique: "Philosophique",
  evolution: "Évolution",
  serenite: "Sérénité de l'espèce",
};

function StatutBadge({ statut }: { statut: string }) {
  const styles: Record<string, string> = {
    a_documenter: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
    documente: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    verifie_recemment: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    a_re_auditer: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return <span className={`rounded px-2 py-0.5 text-[11px] ${styles[statut] ?? ""}`}>{statut.replace(/_/g, " ")}</span>;
}

function FicheHumaineDetail({ f }: { f: FicheHumaine }) {
  return (
    <details className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <summary className="cursor-pointer font-medium">
        {f.nom} {f.periode_courant ? <span className="text-neutral-400">— {f.periode_courant}</span> : null}
        <span className="ml-2">
          <StatutBadge statut={f.statut} />
        </span>
      </summary>
      {f.statut === "documente" ? (
        <div className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <p><strong>Thèse centrale :</strong> {f.these_centrale}</p>
          <p><strong>Apport :</strong> {f.apport}</p>
          <p><strong>Limites et critiques :</strong> {f.limites_critiques}</p>
          {f.resonance_ia && <p><strong>Résonance avec l&apos;IA :</strong> {f.resonance_ia}</p>}
          {f.sources.length > 0 && (
            <p className="text-xs text-neutral-400">Sources : {f.sources.map((s) => s.titre).join(" · ")}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">Fiche pas encore documentée.</p>
      )}
    </details>
  );
}

export default function ReferentielHumainPage() {
  const parAxe = data.reduce<Record<string, FicheHumaine[]>>((acc, f) => {
    (acc[f.axe] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Référentiel A — Capacités humaines</h1>
        <p className="mt-2 text-sm text-neutral-500">{data.length} entrées amorcées · {data.filter(f=>f.statut==="documente").length} documentées.</p>
      </div>

      {Object.entries(AXES).map(([axe, label]) => {
        const entries = parAxe[axe] ?? [];
        if (entries.length === 0) return null;
        const parSousDomaine = entries.reduce<Record<string, FicheHumaine[]>>((acc, f) => {
          const key = f.sous_domaine ?? "général";
          (acc[key] ??= []).push(f);
          return acc;
        }, {});
        return (
          <section key={axe}>
            <h2 className="text-lg font-medium">{label} <span className="text-sm font-normal text-neutral-400">({entries.length})</span></h2>
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
                            {f.nom} <StatutBadge statut={f.statut} />
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

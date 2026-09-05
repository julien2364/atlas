import fiches from "@/data/seed/fiches_ia.json";
import type { FicheIA } from "@/lib/types";

const data = fiches as unknown as FicheIA[];

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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Référentiel B — Capacités IA</h1>
        <p className="mt-2 text-sm text-neutral-500">{data.length} entrées amorcées · {data.filter(f=>f.statut==="documente").length} documentées.</p>
      </div>

      {Object.entries(AXES).map(([axe, label]) => {
        const entries = parAxe[axe] ?? [];
        if (entries.length === 0) return null;
        return (
          <section key={axe}>
            <h2 className="text-lg font-medium">{label} <span className="text-sm font-normal text-neutral-400">({entries.length})</span></h2>
            <div className="mt-3 space-y-3">
              {entries.map((f) => (
                <details key={f.id} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
                  <summary className="cursor-pointer font-medium">
                    {f.nom} {f.editeur ? <span className="text-neutral-400">— {f.editeur}</span> : null}
                    <span className={`ml-2 rounded px-2 py-0.5 text-[11px] ${f.statut === "documente" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"}`}>
                      {f.statut.replace(/_/g, " ")}
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
                        <p className="text-xs text-neutral-400">Sources : {f.sources.map((s) => s.titre).join(" · ")}</p>
                      )}
                    </div>
                  )}
                </details>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

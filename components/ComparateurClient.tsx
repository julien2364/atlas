"use client";

import { useMemo, useState } from "react";
import type { FicheGap, FicheHumaine, FicheIA } from "@/lib/types";

const SUBSTITUABILITE_LABEL: Record<string, string> = {
  remplacable_totalement: "Remplaçable totalement",
  remplacable_avec_supervision: "Remplaçable avec supervision humaine",
  non_remplacable: "Non remplaçable à horizon prévisible",
  remplacable_avec_autre_technologie: "Remplaçable combinée à une autre technologie",
};

export default function ComparateurClient({
  humaines,
  ia,
  gaps,
}: {
  humaines: FicheHumaine[];
  ia: FicheIA[];
  gaps: FicheGap[];
}) {
  const [humaineId, setHumaineId] = useState<string>(gaps[0]?.fiche_humaine_id ?? humaines[0]?.id ?? "");
  const [iaId, setIaId] = useState<string>(gaps[0]?.fiche_ia_id ?? ia[0]?.id ?? "");

  const gap = useMemo(
    () => gaps.find((g) => g.fiche_humaine_id === humaineId && g.fiche_ia_id === iaId),
    [gaps, humaineId, iaId]
  );

  const humaine = humaines.find((h) => h.id === humaineId);
  const iaFiche = ia.find((f) => f.id === iaId);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-neutral-600 dark:text-neutral-400">Capacité humaine</span>
          <select
            value={humaineId}
            onChange={(e) => setHumaineId(e.target.value)}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {humaines.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-neutral-600 dark:text-neutral-400">Capacité IA</span>
          <select
            value={iaId}
            onChange={(e) => setIaId(e.target.value)}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {ia.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      {gap ? (
        <article className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="font-medium">
            {humaine?.nom} <span className="text-neutral-400">×</span> {iaFiche?.nom}
          </h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-neutral-500">Apport de l&apos;IA</dt>
              <dd>{gap.apport_ia}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Mécanisme</dt>
              <dd>{gap.mecanisme}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Comment mieux</dt>
              <dd>{gap.amelioration_possible}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Mode d&apos;interaction</dt>
              <dd>{gap.mode_interaction}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Substituabilité</dt>
              <dd>
                {SUBSTITUABILITE_LABEL[gap.substituabilite]}
                {gap.technologie_complementaire ? ` — ${gap.technologie_complementaire}` : ""}
              </dd>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="font-medium text-neutral-500">Présent</dt>
                <dd>{gap.scenario_present}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">+5 ans</dt>
                <dd>{gap.scenario_5ans}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">+15/20 ans</dt>
                <dd>{gap.scenario_15_20ans}</dd>
              </div>
            </div>
            <div className="text-xs text-neutral-400">Confiance : {gap.confiance}</div>
          </dl>
        </article>
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 dark:border-neutral-700">
          Cette paire ({humaine?.nom} × {iaFiche?.nom}) n&apos;a pas encore été analysée — statut :
          <strong> à documenter</strong>. Le moteur de génération automatique de fiches de gap (RAG, Lot 6) n&apos;est
          pas encore branché ; en attendant, {gaps.length} paires sont déjà documentées manuellement (menus
          pré-sélectionnés ci-dessus).
        </div>
      )}
    </div>
  );
}

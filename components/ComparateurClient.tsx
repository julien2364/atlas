"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FicheGap, FicheHumaine, FicheIA } from "@/lib/types";
import { BadgeConfiance, BadgeSubstituabilite } from "@/components/Badges";

/* Libellés et habillage : charte unique (docs/design-system.md §5.2 et §5.3).
   Les tables locales de couleurs ont été supprimées — elles divergeaient déjà
   de celles de la cartographie et des pages de fiche. */

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
            {humaine?.nom} <span className="text-neutral-500 dark:text-neutral-400">×</span> {iaFiche?.nom}
          </h2>
          {gap.sujet && <p className="mt-1 text-sm text-neutral-500">{gap.sujet}</p>}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link href={`/gap/${gap.id}`} className="underline decoration-neutral-300 hover:decoration-neutral-600">
              Page dédiée de cette analyse
            </Link>
            <Link
              href={`/fiche/humaine/${gap.fiche_humaine_id}`}
              className="underline decoration-neutral-300 hover:decoration-neutral-600"
            >
              Fiche humaine
            </Link>
            <Link
              href={`/fiche/ia/${gap.fiche_ia_id}`}
              className="underline decoration-neutral-300 hover:decoration-neutral-600"
            >
              Fiche IA
            </Link>
          </p>

          {(gap.sous_themes?.length || gap.axes_recherche?.length) ? (
            <div className="mt-3 grid gap-3 rounded border border-neutral-100 bg-neutral-50 p-3 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 sm:grid-cols-2">
              {gap.sous_themes?.length ? (
                <div>
                  <p className="font-medium text-neutral-500 dark:text-neutral-400">Sous-thèmes</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {gap.sous_themes.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              ) : null}
              {gap.axes_recherche?.length ? (
                <div>
                  <p className="font-medium text-neutral-500 dark:text-neutral-400">Axes de recherche</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {gap.axes_recherche.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

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
                <BadgeSubstituabilite valeur={gap.substituabilite} />
                {gap.technologie_complementaire ? (
                  <span className="ml-2">{gap.technologie_complementaire}</span>
                ) : null}
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
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Confiance : {gap.confiance}</div>

            {gap.documents_cles?.length ? (
              <div>
                <dt className="font-medium text-neutral-500">Documents clés</dt>
                <dd>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {gap.documents_cles.map((d, i) => (
                      <li key={i}>
                        {d.url ? (
                          <a href={d.url} target="_blank" rel="noreferrer" className="underline decoration-neutral-300 hover:decoration-neutral-600">
                            {d.titre}
                          </a>
                        ) : (
                          <span>{d.titre}</span>
                        )}
                        <span className="ml-1 text-neutral-500 dark:text-neutral-400">({d.type})</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}

            {gap.axes_prospectifs?.length ? (
              <div>
                <dt className="font-medium text-neutral-500">Axes possibles (perspectives, pas des prédictions tranchées)</dt>
                <dd className="mt-2 space-y-2">
                  {gap.axes_prospectifs.map((axe, i) => (
                    <div key={i} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{axe.nom}</span>
                        <BadgeConfiance niveau={axe.niveau_confiance} />
                      </div>
                      <p className="mt-1 text-neutral-600 dark:text-neutral-400">{axe.description}</p>
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
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

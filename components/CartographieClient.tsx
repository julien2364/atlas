"use client";

import { useMemo, useState } from "react";
import type { FicheHumaine, FicheIA, FicheGap, AxeHumain, AxeIA, Substituabilite } from "@/lib/types";

const LABELS_AXE_HUMAIN: Record<AxeHumain, string> = {
  social: "Social",
  psychologique: "Psychologique",
  philosophique: "Philosophique",
  evolution: "Évolution",
  serenite: "Sérénité de l'espèce",
};

const LABELS_AXE_IA: Record<AxeIA, string> = {
  generatif_raisonnement: "Génératif / raisonnement",
  agentique: "Agentique",
  scientifique: "Scientifique",
  sectoriel: "Sectoriel",
  limites: "Limites connues",
  predictif_data_science: "Data science / prédictif",
};

const LABELS_SUBSTITUABILITE: Record<Substituabilite, { label: string; color: string }> = {
  remplacable_totalement: { label: "Remplaçable totalement", color: "bg-red-500" },
  remplacable_avec_supervision: { label: "Remplaçable avec supervision", color: "bg-amber-500" },
  non_remplacable: { label: "Non remplaçable", color: "bg-emerald-600" },
  remplacable_avec_autre_technologie: { label: "Remplaçable avec autre technologie", color: "bg-sky-600" },
};

function AxeBar<T extends string>({
  title,
  counts,
  documented,
  labels,
  selected,
  onSelect,
}: {
  title: string;
  counts: Record<string, number>;
  documented: Record<string, number>;
  labels: Record<string, string>;
  selected: string | null;
  onSelect: (axe: string | null) => void;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const palette = ["bg-indigo-500", "bg-teal-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500"];

  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-2 flex h-8 w-full overflow-hidden rounded">
        {Object.entries(counts).map(([axe, count], i) => (
          <button
            key={axe}
            onClick={() => onSelect(selected === axe ? null : axe)}
            title={`${labels[axe] ?? axe} — ${count} fiches (${documented[axe] ?? 0} documentées)`}
            style={{ width: `${(count / total) * 100}%` }}
            className={`${palette[i % palette.length]} h-full transition-opacity ${
              selected && selected !== axe ? "opacity-30" : "opacity-100"
            } hover:opacity-80`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        {Object.entries(counts).map(([axe, count]) => (
          <button
            key={axe}
            onClick={() => onSelect(selected === axe ? null : axe)}
            className={`hover:underline ${selected === axe ? "font-semibold text-neutral-900 dark:text-neutral-100" : ""}`}
          >
            {labels[axe] ?? axe} ({count}, {documented[axe] ?? 0} doc.)
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CartographieClient({
  humaines,
  ia,
  gaps,
}: {
  humaines: FicheHumaine[];
  ia: FicheIA[];
  gaps: FicheGap[];
}) {
  const [axeHumainFiltre, setAxeHumainFiltre] = useState<string | null>(null);
  const [axeIAFiltre, setAxeIAFiltre] = useState<string | null>(null);
  const [gapSelectionne, setGapSelectionne] = useState<string | null>(null);

  const humainesDocumentees = useMemo(() => humaines.filter((f) => f.statut === "documente"), [humaines]);
  const iaDocumentees = useMemo(() => ia.filter((f) => f.statut === "documente"), [ia]);

  const countsHumain = useMemo(() => {
    const c: Record<string, number> = {};
    humaines.forEach((f) => (c[f.axe] = (c[f.axe] ?? 0) + 1));
    return c;
  }, [humaines]);
  const docHumain = useMemo(() => {
    const c: Record<string, number> = {};
    humainesDocumentees.forEach((f) => (c[f.axe] = (c[f.axe] ?? 0) + 1));
    return c;
  }, [humainesDocumentees]);

  const countsIA = useMemo(() => {
    const c: Record<string, number> = {};
    ia.forEach((f) => (c[f.axe] = (c[f.axe] ?? 0) + 1));
    return c;
  }, [ia]);
  const docIA = useMemo(() => {
    const c: Record<string, number> = {};
    iaDocumentees.forEach((f) => (c[f.axe] = (c[f.axe] ?? 0) + 1));
    return c;
  }, [iaDocumentees]);

  const fichesHumainAffichees = axeHumainFiltre ? humaines.filter((f) => f.axe === axeHumainFiltre) : [];
  const fichesIAAffichees = axeIAFiltre ? ia.filter((f) => f.axe === axeIAFiltre) : [];

  const gapParPaire = useMemo(() => {
    const m = new Map<string, FicheGap>();
    gaps.forEach((g) => m.set(`${g.fiche_humaine_id}::${g.fiche_ia_id}`, g));
    return m;
  }, [gaps]);

  const gapAffiche = gapSelectionne ? gaps.find((g) => g.id === gapSelectionne) ?? null : null;

  return (
    <div className="space-y-10">
      <section>
        <AxeBar
          title={`Référentiel humain — répartition par axe (${humaines.length} fiches)`}
          counts={countsHumain}
          documented={docHumain}
          labels={LABELS_AXE_HUMAIN}
          selected={axeHumainFiltre}
          onSelect={setAxeHumainFiltre}
        />
        {axeHumainFiltre && (
          <ul className="mt-3 max-h-56 overflow-y-auto rounded border border-neutral-200 p-2 text-sm dark:border-neutral-800">
            {fichesHumainAffichees.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-2 py-1">
                <span>{f.nom}</span>
                <span className={`text-xs ${f.statut === "documente" ? "text-emerald-600" : "text-neutral-400"}`}>
                  {f.statut === "documente" ? "documentée" : "à documenter"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <AxeBar
          title={`Référentiel IA — répartition par axe (${ia.length} fiches)`}
          counts={countsIA}
          documented={docIA}
          labels={LABELS_AXE_IA}
          selected={axeIAFiltre}
          onSelect={setAxeIAFiltre}
        />
        {axeIAFiltre && (
          <ul className="mt-3 max-h-56 overflow-y-auto rounded border border-neutral-200 p-2 text-sm dark:border-neutral-800">
            {fichesIAAffichees.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-2 py-1">
                <span>{f.nom}</span>
                <span className={`text-xs ${f.statut === "documente" ? "text-emerald-600" : "text-neutral-400"}`}>
                  {f.statut === "documente" ? "documentée" : "à documenter"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium">
          Matrice de gap — {humainesDocumentees.length} fiches humaines × {iaDocumentees.length} fiches IA documentées
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Cellule grise = paire pas encore analysée. Cliquer une cellule colorée affiche le détail de l&apos;analyse.
          Le reste du référentiel (fiches non documentées) n&apos;apparaît pas ici — voir /comparateur pour explorer
          toutes les paires.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-1"></th>
                {iaDocumentees.map((f) => (
                  <th key={f.id} className="max-w-[7rem] p-1 text-left align-bottom font-normal text-neutral-500">
                    <span className="block -rotate-45 whitespace-nowrap">{f.nom}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {humainesDocumentees.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap p-1 pr-3 text-neutral-500">{h.nom}</td>
                  {iaDocumentees.map((f) => {
                    const g = gapParPaire.get(`${h.id}::${f.id}`);
                    return (
                      <td key={f.id} className="p-1">
                        {g ? (
                          <button
                            onClick={() => setGapSelectionne(g.id === gapSelectionne ? null : g.id)}
                            title={LABELS_SUBSTITUABILITE[g.substituabilite].label}
                            className={`h-8 w-8 rounded ${LABELS_SUBSTITUABILITE[g.substituabilite].color} ${
                              gapSelectionne === g.id ? "ring-2 ring-offset-2 ring-neutral-900 dark:ring-offset-neutral-950" : ""
                            } hover:opacity-80`}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-neutral-100 dark:bg-neutral-800" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {Object.entries(LABELS_SUBSTITUABILITE).map(([key, v]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded ${v.color}`} />
              {v.label}
            </span>
          ))}
        </div>
        {gapAffiche && (
          <div className="mt-4 rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <p className="text-xs text-neutral-400">
              {humainesDocumentees.find((h) => h.id === gapAffiche.fiche_humaine_id)?.nom} ×{" "}
              {iaDocumentees.find((f) => f.id === gapAffiche.fiche_ia_id)?.nom} — confiance {gapAffiche.confiance}
            </p>
            <p className="mt-2">{gapAffiche.apport_ia}</p>
          </div>
        )}
      </section>

      <section className="rounded border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        À venir (nécessite des fiches IA documentées avec usages sectoriels renseignés) : heatmap de maturité TRL
        par secteur (science/éducation/recherche/industrie/pharma/gouvernement) et frise chronologique — section 8
        du mégaprompt. Non affichés tant qu&apos;aucune donnée réelle n&apos;existe, pour éviter d&apos;inventer des
        niveaux de maturité.
      </section>
    </div>
  );
}

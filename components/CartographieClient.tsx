"use client";

import { useMemo, useState } from "react";
import type { FicheHumaine, FicheIA, FicheGap, AxeHumain, AxeIA, Substituabilite, ChangelogEntry, SecteurUsage, NiveauConfiance } from "@/lib/types";
import Treemap, { type TreemapItem } from "@/components/Treemap";
import RadarChart, { type RadarAxisDatum } from "@/components/RadarChart";
import FriseChangelog from "@/components/FriseChangelog";

const LABELS_SECTEUR: Record<SecteurUsage, string> = {
  science: "Science",
  education: "Éducation",
  recherche: "Recherche",
  industrie: "Industrie",
  pharmaceutique: "Pharmaceutique",
  gouvernement: "Gouvernement",
};

const TREEMAP_PALETTE = ["#6366f1", "#14b8a6", "#a855f7", "#f97316", "#ec4899", "#06b6d4", "#84cc16"];

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

const LABEL_CONFIANCE: Record<NiveauConfiance, string> = {
  fait_verifie: "Fait vérifié",
  consensus_scientifique: "Consensus scientifique",
  opinion_majoritaire: "Opinion majoritaire",
  hypothese_prospective: "Hypothèse prospective",
};

const COULEUR_CONFIANCE: Record<NiveauConfiance, string> = {
  fait_verifie: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  consensus_scientifique: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  opinion_majoritaire: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  hypothese_prospective: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
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
  changelog,
}: {
  humaines: FicheHumaine[];
  ia: FicheIA[];
  gaps: FicheGap[];
  changelog: ChangelogEntry[];
}) {
  const [axeHumainFiltre, setAxeHumainFiltre] = useState<string | null>(null);
  const [axeIAFiltre, setAxeIAFiltre] = useState<string | null>(null);
  const [gapSelectionne, setGapSelectionne] = useState<string | null>(null);
  const [treemapAxeSelectionne, setTreemapAxeSelectionne] = useState<string | null>(null);
  const [confianceFiltre, setConfianceFiltre] = useState<NiveauConfiance | null>(null);

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

  const treemapItems: TreemapItem[] = useMemo(() => {
    const humainItems = Object.entries(countsHumain).map(([axe, count], i) => ({
      key: `humain:${axe}`,
      label: LABELS_AXE_HUMAIN[axe as AxeHumain] ?? axe,
      value: count,
      color: TREEMAP_PALETTE[i % TREEMAP_PALETTE.length],
    }));
    const iaItems = Object.entries(countsIA).map(([axe, count], i) => ({
      key: `ia:${axe}`,
      label: LABELS_AXE_IA[axe as AxeIA] ?? axe,
      value: count,
      color: TREEMAP_PALETTE[(i + humainItems.length) % TREEMAP_PALETTE.length],
    }));
    return [...humainItems, ...iaItems];
  }, [countsHumain, countsIA]);

  const treemapAffiche = treemapAxeSelectionne
    ? treemapAxeSelectionne.startsWith("humain:")
      ? humaines.filter((f) => f.axe === treemapAxeSelectionne.slice("humain:".length))
      : ia.filter((f) => f.axe === treemapAxeSelectionne.slice("ia:".length))
    : [];

  const prospectifsParSujet = useMemo(() => {
    type Entree = { sujet: string; paire: string; nom: string; description: string; niveau_confiance: NiveauConfiance };
    const entrees: Entree[] = [];
    gaps.forEach((g) => {
      if (!g.axes_prospectifs?.length) return;
      const h = humaines.find((f) => f.id === g.fiche_humaine_id);
      const i = ia.find((f) => f.id === g.fiche_ia_id);
      g.axes_prospectifs.forEach((axe) => {
        entrees.push({
          sujet: g.sujet ?? `${h?.nom ?? g.fiche_humaine_id} × ${i?.nom ?? g.fiche_ia_id}`,
          paire: `${h?.nom ?? g.fiche_humaine_id} × ${i?.nom ?? g.fiche_ia_id}`,
          nom: axe.nom,
          description: axe.description,
          niveau_confiance: axe.niveau_confiance,
        });
      });
    });
    const filtrees = confianceFiltre ? entrees.filter((e) => e.niveau_confiance === confianceFiltre) : entrees;
    const parSujet = new Map<string, Entree[]>();
    filtrees.forEach((e) => {
      const liste = parSujet.get(e.sujet) ?? [];
      liste.push(e);
      parSujet.set(e.sujet, liste);
    });
    return Array.from(parSujet.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [gaps, humaines, ia, confianceFiltre]);

  const radarData: RadarAxisDatum[] = useMemo(() => {
    const bySecteur = new Map<SecteurUsage, { sum: number; count: number }>();
    ia.forEach((f) => {
      f.usages?.forEach((u) => {
        const cur = bySecteur.get(u.secteur) ?? { sum: 0, count: 0 };
        cur.sum += u.trl;
        cur.count += 1;
        bySecteur.set(u.secteur, cur);
      });
    });
    return Array.from(bySecteur.entries())
      .map(([secteur, { sum, count }]) => ({
        key: secteur,
        label: LABELS_SECTEUR[secteur] ?? secteur,
        value: sum / count,
        count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ia]);

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

      <section>
        <h3 className="text-sm font-medium">
          Treemap par domaine — les deux référentiels ({humaines.length + ia.length} fiches)
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Surface proportionnelle au nombre de fiches par axe. Cliquer un bloc liste les fiches de cet axe.
        </p>
        <div className="mt-3">
          <Treemap items={treemapItems} selected={treemapAxeSelectionne} onSelect={setTreemapAxeSelectionne} />
        </div>
        {treemapAxeSelectionne && (
          <ul className="mt-3 max-h-56 overflow-y-auto rounded border border-neutral-200 p-2 text-sm dark:border-neutral-800">
            {treemapAffiche.map((f) => (
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
        <h3 className="text-sm font-medium">Radar de maturité — TRL moyen par secteur d&apos;usage (fiches IA)</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Moyenne des TRL (1-9) renseignés dans les usages sectoriels des fiches IA documentées. Un secteur
          n&apos;apparaît que s&apos;il a au moins une donnée réelle — rien n&apos;est extrapolé.
        </p>
        <div className="mt-3 max-w-md">
          <RadarChart data={radarData} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium">Frise chronologique — évolution du projet</h3>
        <p className="mt-1 text-xs text-neutral-500">
          En attendant des dates d&apos;apparition sourcées pour chaque capacité IA (chantier de documentation en
          cours), cette frise retrace les jalons réels et datés du projet lui-même (changelog).
        </p>
        <div className="mt-3">
          <FriseChangelog entries={changelog} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium">Perspectives prospectives par domaine</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Les axes prospectifs nommés dans le comparateur (section « Axes possibles » de chaque fiche de gap),
          regroupés par sujet plutôt que par paire — pour repérer d&apos;un coup d&apos;œil où le référentiel est
          établi (fait vérifié, consensus) et où il reste spéculatif (hypothèse prospective). Aucune prédiction
          unique n&apos;est présentée comme acquise : ce sont des scénarios nommés, pas des probabilités calculées.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setConfianceFiltre(null)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              confianceFiltre === null
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
            }`}
          >
            Tous
          </button>
          {(Object.keys(LABEL_CONFIANCE) as NiveauConfiance[]).map((nc) => (
            <button
              key={nc}
              onClick={() => setConfianceFiltre(nc)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                confianceFiltre === nc
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
              }`}
            >
              {LABEL_CONFIANCE[nc]}
            </button>
          ))}
        </div>

        {prospectifsParSujet.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Aucun axe prospectif pour ce filtre.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {prospectifsParSujet.map(([sujet, entrees]) => (
              <div key={sujet}>
                <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-400">{sujet}</h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {entrees.map((e, i) => (
                    <div key={i} className="rounded border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{e.nom}</span>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${COULEUR_CONFIANCE[e.niveau_confiance]}`}>
                          {LABEL_CONFIANCE[e.niveau_confiance]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{e.paire}</p>
                      <p className="mt-1 text-neutral-600 dark:text-neutral-400">{e.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

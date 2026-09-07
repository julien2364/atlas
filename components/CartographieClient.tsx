"use client";

import { useMemo, useState } from "react";
import type { FicheHumaine, FicheIA, FicheGap, AxeHumain, AxeIA, Substituabilite, ChangelogEntry, SecteurUsage, NiveauConfiance } from "@/lib/types";
import Treemap, { type TreemapItem } from "@/components/Treemap";
import {
  BadgeConfiance,
  BadgeSubstituabilite,
  FONDS_SUBSTITUABILITE,
  GLYPHES_SUBSTITUABILITE,
} from "@/components/Badges";
import { LABELS_NIVEAU_CONFIANCE, LABELS_SUBSTITUABILITE } from "@/lib/corpus";
import RadarChart, { type RadarAxisDatum } from "@/components/RadarChart";
import FriseChangelog, { type JalonVolume } from "@/components/FriseChangelog";
import HeatmapTRL, { LABELS_SECTEUR, SECTEURS } from "@/components/HeatmapTRL";
import HeatmapAxeSecteur from "@/components/HeatmapAxeSecteur";
import GrapheConnaissances from "@/components/GrapheConnaissances";

// Aplats assez sombres pour que le libellé blanc écrit dans le bloc reste
// lisible (≥ 4.5:1 avec #ffffff) — la version 500 de ces teintes tombait à
// 2,3:1 sur le teal. Cf. docs/design-system.md §2.
const TREEMAP_PALETTE = ["#4f46e5", "#0f766e", "#9333ea", "#c2410c", "#db2777", "#0e7490", "#4d7c0f"];

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

/* Substituabilité et niveau de confiance : charte unique
   (docs/design-system.md §5.2 et §5.3), couleur + glyphe. Les tables locales
   de couleurs ont été supprimées — trois fichiers en portaient une variante. */

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
      <div className="mt-2 flex h-8 w-full overflow-hidden rounded" role="group" aria-label={title}>
        {Object.entries(counts).map(([axe, count], i) => (
          <button
            key={axe}
            type="button"
            onClick={() => onSelect(selected === axe ? null : axe)}
            aria-pressed={selected === axe}
            aria-label={`${labels[axe] ?? axe} : ${count} fiches, dont ${documented[axe] ?? 0} documentées. Afficher la liste.`}
            title={`${labels[axe] ?? axe} — ${count} fiches (${documented[axe] ?? 0} documentées)`}
            style={{ width: `${(count / total) * 100}%` }}
            className={`${palette[i % palette.length]} h-full transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${
              selected && selected !== axe ? "opacity-30" : "opacity-100"
            } hover:opacity-80`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        {Object.entries(counts).map(([axe, count]) => (
          <button
            key={axe}
            type="button"
            onClick={() => onSelect(selected === axe ? null : axe)}
            aria-pressed={selected === axe}
            className={`rounded hover:underline ${
              selected === axe ? "font-semibold text-neutral-900 dark:text-neutral-100" : ""
            }`}
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
  const [axeMatrice, setAxeMatrice] = useState<string>("tous");

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

  // Lignes et colonnes de la matrice de gap : on n'affiche que les fiches qui
  // portent au moins une analyse. Avec 267 × 44 combinaisons théoriques et 201
  // paires documentées, la grille complète serait vide à 98 % et illisible.
  const humainesAvecGap = useMemo(() => {
    const ids = new Set(gaps.map((g) => g.fiche_humaine_id));
    return humaines.filter((h) => ids.has(h.id));
  }, [gaps, humaines]);

  const colonnesMatrice = useMemo(() => {
    const ids = new Set(gaps.map((g) => g.fiche_ia_id));
    return ia.filter((f) => ids.has(f.id));
  }, [gaps, ia]);

  const lignesMatrice = useMemo(
    () => (axeMatrice === "tous" ? humainesAvecGap : humainesAvecGap.filter((h) => h.axe === axeMatrice)),
    [humainesAvecGap, axeMatrice],
  );

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

  // Volume de fiches documentées atteint à chaque jalon du changelog. Recompté
  // depuis les fiches elles-mêmes (date de `derniere_verification` <= jalon)
  // plutôt que lu dans le résumé textuel des entrées : c'est la seule datation
  // réellement vérifiable, et elle reste juste si le corpus évolue.
  const volumesFrise: JalonVolume[] = useMemo(() => {
    const jours = Array.from(new Set(changelog.map((e) => e.date.slice(0, 10)))).sort();
    const compte = (fiches: { statut: string; derniere_verification: string }[], j: string) =>
      fiches.filter((f) => f.statut === "documente" && f.derniere_verification.slice(0, 10) <= j).length;
    return jours.map((j) => ({
      date: j,
      humaines: compte(humaines, j),
      ia: compte(ia, j),
      gaps: compte(gaps, j),
    }));
  }, [changelog, humaines, ia, gaps]);

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
                <span className={`text-xs ${f.statut === "documente" ? "text-emerald-600" : "text-neutral-500 dark:text-neutral-400"}`}>
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
                <span className={`text-xs ${f.statut === "documente" ? "text-emerald-600" : "text-neutral-500 dark:text-neutral-400"}`}>
                  {f.statut === "documente" ? "documentée" : "à documenter"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium">
          Matrice de gap — {lignesMatrice.length} fiches humaines × {colonnesMatrice.length} fiches IA
        </h3>
        <p className="mt-1 max-w-3xl text-xs text-neutral-500">
          Une ligne par fiche humaine <strong>portant au moins une analyse de gap</strong>, une colonne par fiche IA
          citée par au moins une analyse : les {humaines.length} × {ia.length} combinaisons théoriques donneraient une
          grille illisible et presque vide. Cellule vide = paire pas encore analysée (voir /comparateur, qui affiche le
          statut réel de n&apos;importe quelle paire). Chaque cellule analysée porte le glyphe de sa substituabilité en
          plus de sa couleur, et s&apos;active au clavier.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3 text-xs">
          <label className="flex flex-col gap-1 text-neutral-500">
            Restreindre à un axe humain
            <select
              value={axeMatrice}
              onChange={(e) => setAxeMatrice(e.target.value)}
              className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value="tous">tous les axes ({humainesAvecGap.length} fiches)</option>
              {Object.entries(LABELS_AXE_HUMAIN).map(([axe, label]) => {
                const n = humainesAvecGap.filter((h) => h.axe === axe).length;
                return n === 0 ? null : (
                  <option key={axe} value={axe}>
                    {label} ({n})
                  </option>
                );
              })}
            </select>
          </label>
          <p className="text-neutral-500" aria-live="polite">
            {lignesMatrice.length} ligne{lignesMatrice.length > 1 ? "s" : ""} affichée
            {lignesMatrice.length > 1 ? "s" : ""} · {gaps.length} paires documentées au total
          </p>
        </div>
        <div className="defilement-h mt-3 max-h-[32rem] overflow-y-auto rounded border border-neutral-200 dark:border-neutral-800">
          <table className="w-max border-collapse text-xs">
            <caption className="sr-only">
              Matrice des analyses de gap : une ligne par capacité humaine, une colonne par capacité IA. Une cellule
              renseignée est un bouton qui affiche le résumé de l&apos;analyse ; son glyphe et sa couleur donnent le
              verdict de substituabilité.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-20 bg-white p-1 dark:bg-neutral-950">
                  <span className="sr-only">Capacité humaine</span>
                </th>
                {colonnesMatrice.map((f) => (
                  <th
                    key={f.id}
                    scope="col"
                    className="sticky top-0 z-10 h-28 w-9 min-w-9 bg-white p-0 align-bottom font-normal text-neutral-500 dark:bg-neutral-950"
                  >
                    <span className="flex h-28 w-9 items-end justify-center">
                      <span className="origin-bottom -rotate-60 whitespace-nowrap pb-1 text-[10px]" title={f.nom}>
                        {f.nom.length > 26 ? `${f.nom.slice(0, 25)}…` : f.nom}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignesMatrice.map((h) => (
                <tr key={h.id} className="border-t border-neutral-100 dark:border-neutral-900">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[16rem] bg-white p-1 pr-3 text-left font-normal text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300"
                  >
                    <span className="block max-w-[15rem] truncate" title={h.nom}>
                      {h.nom}
                    </span>
                  </th>
                  {colonnesMatrice.map((f) => {
                    const g = gapParPaire.get(`${h.id}::${f.id}`);
                    if (!g) {
                      return (
                        <td key={f.id} className="p-0.5">
                          <div className="h-8 w-8 rounded border border-dashed border-neutral-200 dark:border-neutral-800" />
                          <span className="sr-only">
                            {h.nom} × {f.nom} : paire non analysée.
                          </span>
                        </td>
                      );
                    }
                    const libelle = LABELS_SUBSTITUABILITE[g.substituabilite] ?? g.substituabilite;
                    return (
                      <td key={f.id} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => setGapSelectionne(g.id === gapSelectionne ? null : g.id)}
                          aria-pressed={gapSelectionne === g.id}
                          aria-label={`${h.nom} × ${f.nom} : ${libelle}. Afficher le résumé de l'analyse.`}
                          title={`${h.nom} × ${f.nom} — ${libelle}`}
                          style={{ backgroundColor: FONDS_SUBSTITUABILITE[g.substituabilite] }}
                          className={`flex h-8 w-8 items-center justify-center rounded text-[13px] font-semibold text-white transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-950 ${
                            gapSelectionne === g.id
                              ? "ring-2 ring-neutral-900 ring-offset-2 dark:ring-neutral-100 dark:ring-offset-neutral-950"
                              : ""
                          }`}
                        >
                          <span aria-hidden="true">{GLYPHES_SUBSTITUABILITE[g.substituabilite]}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-500">
          {(Object.keys(FONDS_SUBSTITUABILITE) as Substituabilite[]).map((cle) => (
            <span key={cle} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                style={{ backgroundColor: FONDS_SUBSTITUABILITE[cle] }}
                className="inline-flex h-4 w-4 items-center justify-center rounded text-[11px] font-semibold text-white"
              >
                {GLYPHES_SUBSTITUABILITE[cle]}
              </span>
              {LABELS_SUBSTITUABILITE[cle]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-4 w-4 rounded border border-dashed border-neutral-300 dark:border-neutral-700" />
            paire non analysée
          </span>
        </div>
        {gapAffiche && (
          <div className="mt-4 rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <p className="text-xs text-neutral-500">
              {humaines.find((h) => h.id === gapAffiche.fiche_humaine_id)?.nom} ×{" "}
              {ia.find((f) => f.id === gapAffiche.fiche_ia_id)?.nom} — confiance {gapAffiche.confiance}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <BadgeSubstituabilite valeur={gapAffiche.substituabilite} />
            </p>
            <p className="mt-2 text-neutral-700 dark:text-neutral-300">{gapAffiche.apport_ia}</p>
            <a href={`/gap/${gapAffiche.id}`} className="mt-2 inline-block text-xs underline hover:no-underline">
              Ouvrir l&apos;analyse complète
            </a>
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
                <span className={`text-xs ${f.statut === "documente" ? "text-emerald-600" : "text-neutral-500 dark:text-neutral-400"}`}>
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
        <h3 className="text-sm font-medium">
          Heatmap de maturité — TRL par fiche IA × secteur d&apos;usage ({ia.length} fiches × {SECTEURS.length} secteurs)
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Le détail de ce que le radar résume : une même capacité peut être TRL 9 en industrie et TRL 4 en
          pharmaceutique (mégaprompt §4). Chaque cellule porte son TRL en toutes lettres — la couleur ne fait que le
          renforcer — et une cellule hachurée « n. d. » signale une absence de donnée, ce qui n&apos;est pas la même
          chose qu&apos;une maturité faible. Cliquer (ou activer au clavier) une cellule affiche la description, les
          exemples et les sources de l&apos;usage. Filtrer par axe pour réduire la matrice.
        </p>
        <div className="mt-3">
          <HeatmapTRL fiches={ia} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium">
          Grille de maturité agrégée — TRL par axe IA × secteur d&apos;usage ({SECTEURS.length} secteurs × 6 axes)
        </h3>
        <p className="mt-1 text-xs text-neutral-500">
          Le niveau intermédiaire entre le radar (une valeur par secteur, toutes capacités confondues) et la heatmap
          fiche par fiche : « quelle FAMILLE de capacités IA est mûre dans quel secteur ». Une moyenne calculée sur
          deux observations n&apos;étant pas une mesure, chaque cellule affiche son effectif et l&apos;étendue des TRL
          agrégés, et les cellules sous trois
          observations portent une marque « ! ». Une cellule hachurée « n. d. » ne contient aucun usage
          documenté — ce n&apos;est pas une maturité faible. Activer une cellule affiche la distribution des TRL et la
          liste des fiches qui composent la moyenne.
        </p>
        <div className="mt-3">
          <HeatmapAxeSecteur fiches={ia} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium">Graphe de connaissances — fiche humaine ↔ fiche de gap ↔ fiche IA</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Simulation de forces faite main (SVG, sans librairie), calculée côté navigateur et déterministe. Le corpus
          compte {humaines.length + ia.length + gaps.length} fiches et {gaps.length * 2} arêtes documentées : les
          afficher d&apos;un bloc ne produirait qu&apos;une pelote. L&apos;entrée se fait donc toujours par un filtre —
          autour d&apos;une fiche IA, autour d&apos;une fiche humaine (avec son voisinage à deux pas), par axe IA ou par
          sous-domaine humain. La forme distingue le type de fiche, la couleur ne porte qu&apos;une seule information
          (le verdict de substituabilité de la paire), et le contenu du graphe est repris sous forme de liste
          navigable au clavier.
        </p>
        <div className="mt-3">
          <GrapheConnaissances humaines={humaines} ia={ia} gaps={gaps} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium">Frise chronologique — évolution du corpus dans le temps</h3>
        <p className="mt-1 text-xs text-neutral-500">
          En attendant des dates d&apos;apparition sourcées pour chaque capacité IA (chantier de documentation en
          cours), cette frise retrace les jalons réels et datés du projet lui-même (changelog), regroupés par jour.
          Chaque étape indique le volume de fiches documentées atteint à cette date, recompté depuis la date de
          dernière vérification des fiches — rien n&apos;est interpolé entre deux jalons.
        </p>
        <div className="mt-3">
          <FriseChangelog entries={changelog} volumes={volumesFrise} />
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
            type="button"
            onClick={() => setConfianceFiltre(null)}
            aria-pressed={confianceFiltre === null}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              confianceFiltre === null
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
            }`}
          >
            Tous
          </button>
          {(Object.keys(LABELS_NIVEAU_CONFIANCE) as NiveauConfiance[]).map((nc) => (
            <button
              key={nc}
              type="button"
              onClick={() => setConfianceFiltre(nc === confianceFiltre ? null : nc)}
              aria-pressed={confianceFiltre === nc}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                confianceFiltre === nc
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
              }`}
            >
              {LABELS_NIVEAU_CONFIANCE[nc]}
            </button>
          ))}
        </div>

        {prospectifsParSujet.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Aucun axe prospectif pour ce filtre.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {prospectifsParSujet.map(([sujet, entrees]) => (
              <div key={sujet}>
                <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{sujet}</h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {entrees.map((e, i) => (
                    <div key={i} className="rounded border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{e.nom}</span>
                        <BadgeConfiance niveau={e.niveau_confiance} />
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

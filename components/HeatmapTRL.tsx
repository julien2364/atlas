"use client";

import { useMemo, useState } from "react";
import type { AxeIA, FicheIA, SecteurUsage, UsageSectoriel } from "@/lib/types";

// Heatmap de maturité TRL — mégaprompt section 4 ("échelle inspirée des TRL,
// de 1 à 9, appliquée par capacité ET par secteur d'usage : une même capacité
// peut être TRL 8 en usage grand public et TRL 3 en usage pharmaceutique
// réglementé") et section 8 (/cartographie). Matrice HTML maison, sans
// librairie de graphes : une balise <table> donne gratuitement la sémantique
// ligne/colonne aux lecteurs d'écran, et un <button> par cellule donne le
// focus clavier et l'activation au clavier sans réimplémenter un widget grid.

export const SECTEURS: SecteurUsage[] = [
  "science",
  "education",
  "recherche",
  "industrie",
  "pharmaceutique",
  "gouvernement",
];

export const LABELS_SECTEUR: Record<SecteurUsage, string> = {
  science: "Science",
  education: "Éducation",
  recherche: "Recherche",
  industrie: "Industrie",
  pharmaceutique: "Pharmaceutique",
  gouvernement: "Gouvernement",
};

// Échelle séquentielle « froid → chaud » (type inferno, perceptuellement
// ordonnée : la luminosité croît de façon monotone avec le TRL, donc l'ordre
// reste lisible même en vision daltonienne ou en niveaux de gris). Chaque
// palier embarque la couleur de texte qui garantit un contraste ≥ 4.5:1 avec
// son propre fond ; comme la cellule porte son fond, le rendu est identique en
// thème clair et en thème sombre. La couleur ne fait que renforcer le chiffre,
// qui reste écrit en clair dans la cellule.
const ECHELLE_TRL: { fond: string; texte: string }[] = [
  { fond: "#1b0c41", texte: "#ffffff" }, // TRL 1
  { fond: "#4a0c6b", texte: "#ffffff" }, // TRL 2
  { fond: "#781c6d", texte: "#ffffff" }, // TRL 3
  { fond: "#a52c60", texte: "#ffffff" }, // TRL 4
  { fond: "#cf4446", texte: "#ffffff" }, // TRL 5
  { fond: "#ed6925", texte: "#1c1917" }, // TRL 6
  { fond: "#fb9b06", texte: "#1c1917" }, // TRL 7
  { fond: "#f7d13d", texte: "#1c1917" }, // TRL 8
  { fond: "#fcffa4", texte: "#1c1917" }, // TRL 9
];

const LABELS_AXE_IA: Record<AxeIA, string> = {
  generatif_raisonnement: "Génératif / raisonnement",
  agentique: "Agentique",
  scientifique: "Scientifique",
  sectoriel: "Sectoriel",
  limites: "Limites connues",
  predictif_data_science: "Data science / prédictif",
};

// Hachures diagonales : une cellule sans usage documenté ne doit pas se lire
// comme « un TRL très bas ». Elle change donc de nature, pas seulement de
// teinte — pas de remplissage, bordure pointillée, texture, et la mention
// « n. d. » écrite dans la cellule.
const TEXTURE_NON_DOCUMENTE = {
  backgroundImage: "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 6px)",
};

function paletteTRL(trl: number): { fond: string; texte: string } {
  const index = Math.min(Math.max(Math.round(trl), 1), 9) - 1;
  return ECHELLE_TRL[index];
}

interface Cellule {
  fiche: FicheIA;
  secteur: SecteurUsage;
  usages: UsageSectoriel[]; // plusieurs si une fiche documente deux usages du même secteur
  trl: number; // TRL le plus élevé documenté pour ce couple fiche × secteur
}

export default function HeatmapTRL({ fiches }: { fiches: FicheIA[] }) {
  const [axeFiltre, setAxeFiltre] = useState<AxeIA | null>(null);
  const [celluleSelectionnee, setCelluleSelectionnee] = useState<string | null>(null);

  const axesPresents = useMemo(() => {
    const vus = new Set<AxeIA>();
    fiches.forEach((f) => vus.add(f.axe));
    return (Object.keys(LABELS_AXE_IA) as AxeIA[]).filter((a) => vus.has(a));
  }, [fiches]);

  const lignes = useMemo(() => {
    const retenues = axeFiltre ? fiches.filter((f) => f.axe === axeFiltre) : fiches;
    return retenues
      .map((fiche) => {
        const cellules = new Map<SecteurUsage, Cellule>();
        (fiche.usages ?? []).forEach((u) => {
          const existante = cellules.get(u.secteur);
          if (existante) {
            existante.usages.push(u);
            existante.trl = Math.max(existante.trl, u.trl);
          } else {
            cellules.set(u.secteur, { fiche, secteur: u.secteur, usages: [u], trl: u.trl });
          }
        });
        return { fiche, cellules };
      })
      .sort((a, b) => b.cellules.size - a.cellules.size || a.fiche.nom.localeCompare(b.fiche.nom));
  }, [fiches, axeFiltre]);

  const totalUsages = useMemo(
    () => lignes.reduce((s, l) => s + Array.from(l.cellules.values()).reduce((n, c) => n + c.usages.length, 0), 0),
    [lignes],
  );

  const celluleAffichee = useMemo(() => {
    if (!celluleSelectionnee) return null;
    for (const ligne of lignes) {
      for (const cellule of ligne.cellules.values()) {
        if (`${cellule.fiche.id}::${cellule.secteur}` === celluleSelectionnee) return cellule;
      }
    }
    return null;
  }, [celluleSelectionnee, lignes]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAxeFiltre(null)}
          aria-pressed={axeFiltre === null}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            axeFiltre === null
              ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
              : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
          }`}
        >
          Tous les axes ({fiches.length})
        </button>
        {axesPresents.map((axe) => (
          <button
            key={axe}
            type="button"
            onClick={() => setAxeFiltre(axeFiltre === axe ? null : axe)}
            aria-pressed={axeFiltre === axe}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              axeFiltre === axe
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
            }`}
          >
            {LABELS_AXE_IA[axe]} ({fiches.filter((f) => f.axe === axe).length})
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-neutral-500" aria-live="polite">
        {lignes.length} fiche{lignes.length > 1 ? "s" : ""} affichée{lignes.length > 1 ? "s" : ""} · {totalUsages} usage
        {totalUsages > 1 ? "s" : ""} sectoriel{totalUsages > 1 ? "s" : ""} documenté{totalUsages > 1 ? "s" : ""}
        {axeFiltre ? ` · axe « ${LABELS_AXE_IA[axeFiltre]} »` : ""}
      </p>

      <div className="mt-3 w-full max-w-full overflow-x-auto">
        <table className="w-max border-collapse text-xs">
          <caption className="sr-only">
            Matrice de maturité : une ligne par fiche IA, une colonne par secteur d&apos;usage. Chaque cellule donne
            le niveau de maturité TRL (1 à 9) de cette capacité dans ce secteur, ou « n. d. » quand aucun usage
            n&apos;est documenté. Les cellules renseignées sont des boutons : les activer affiche la description, les
            exemples et les sources de l&apos;usage.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-[15rem] min-w-[15rem] bg-white p-1 pr-3 text-left align-bottom font-medium text-neutral-500 dark:bg-neutral-950"
              >
                Fiche IA
              </th>
              {SECTEURS.map((s) => (
                <th key={s} scope="col" className="min-w-[4.5rem] p-1 pb-2 text-center font-normal text-neutral-500">
                  {LABELS_SECTEUR[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ fiche, cellules }) => (
              <tr key={fiche.id} className="border-t border-neutral-100 dark:border-neutral-900">
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-[15rem] min-w-[15rem] max-w-[15rem] bg-white p-1 pr-3 text-left font-normal dark:bg-neutral-950"
                >
                  <span className="block max-w-[14rem] truncate" title={fiche.nom}>
                    {fiche.nom}
                  </span>
                  <span className="block text-[10px] text-neutral-400">{LABELS_AXE_IA[fiche.axe]}</span>
                </th>
                {SECTEURS.map((secteur) => {
                  const cellule = cellules.get(secteur);
                  if (!cellule) {
                    return (
                      <td key={secteur} className="p-1">
                        <div
                          style={TEXTURE_NON_DOCUMENTE}
                          className="flex h-9 w-full items-center justify-center rounded border border-dashed border-neutral-300 text-neutral-200 dark:border-neutral-700 dark:text-neutral-800"
                        >
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">n. d.</span>
                        </div>
                        <span className="sr-only">
                          {fiche.nom}, {LABELS_SECTEUR[secteur]} : aucun usage documenté.
                        </span>
                      </td>
                    );
                  }
                  const cle = `${fiche.id}::${secteur}`;
                  const palette = paletteTRL(cellule.trl);
                  const selectionnee = celluleSelectionnee === cle;
                  return (
                    <td key={secteur} className="p-1">
                      <button
                        type="button"
                        onClick={() => setCelluleSelectionnee(selectionnee ? null : cle)}
                        aria-pressed={selectionnee}
                        aria-label={`${fiche.nom}, ${LABELS_SECTEUR[secteur]} : TRL ${cellule.trl} sur 9. ${
                          cellule.usages[0].description
                        }. Afficher le détail de l'usage.`}
                        title={`${fiche.nom} — ${LABELS_SECTEUR[secteur]} · TRL ${cellule.trl}/9`}
                        style={{ backgroundColor: palette.fond, color: palette.texte }}
                        className={`flex h-9 w-full items-center justify-center rounded text-xs font-semibold tabular-nums transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-950 ${
                          selectionnee
                            ? "ring-2 ring-neutral-900 ring-offset-2 dark:ring-neutral-100 dark:ring-offset-neutral-950"
                            : ""
                        }`}
                      >
                        {cellule.trl}
                        {cellule.usages.length > 1 && <span className="ml-0.5 text-[9px] font-normal">×{cellule.usages.length}</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span>TRL 1 (preuve de concept)</span>
          {ECHELLE_TRL.map((p, i) => (
            <span
              key={i}
              style={{ backgroundColor: p.fond, color: p.texte }}
              className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-semibold tabular-nums"
            >
              {i + 1}
            </span>
          ))}
          <span>9 (déploiement massif)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            style={TEXTURE_NON_DOCUMENTE}
            className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-dashed border-neutral-300 text-neutral-200 dark:border-neutral-700 dark:text-neutral-800"
          />
          n. d. — aucun usage documenté dans ce secteur (≠ TRL faible)
        </span>
      </div>

      {celluleAffichee ? (
        <div className="mt-4 rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-medium">
              {celluleAffichee.fiche.nom} — {LABELS_SECTEUR[celluleAffichee.secteur]}
            </h4>
            <span className="text-xs text-neutral-400">
              {LABELS_AXE_IA[celluleAffichee.fiche.axe]}
              {celluleAffichee.fiche.editeur ? ` · ${celluleAffichee.fiche.editeur}` : ""} · vérifié le{" "}
              {celluleAffichee.fiche.derniere_verification}
            </span>
          </div>
          {celluleAffichee.usages.map((u, i) => (
            <div key={i} className="mt-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                TRL {u.trl}/9 — {LABELS_SECTEUR[u.secteur]}
              </p>
              <p className="text-neutral-700 dark:text-neutral-300">{u.description}</p>
              {u.exemples.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Exemples documentés</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-neutral-600 dark:text-neutral-400">
                    {u.exemples.map((ex, j) => (
                      <li key={j}>{ex}</li>
                    ))}
                  </ul>
                </div>
              )}
              {u.sources.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Sources</p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {u.sources.map((s, j) => (
                      <li key={j}>
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-neutral-300 hover:decoration-neutral-600"
                          >
                            {s.titre}
                          </a>
                        ) : (
                          <span>{s.titre}</span>
                        )}
                        <span className="ml-1 text-neutral-400">({s.type})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          <p className="mt-3 text-xs text-neutral-400">Limites connues de la fiche : {celluleAffichee.fiche.limites_connues}</p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-neutral-500">
          Aucune cellule sélectionnée — activer une cellule (clic, ou <kbd>Entrée</kbd> / <kbd>Espace</kbd> au clavier)
          pour afficher la description, les exemples et les sources de l&apos;usage.
        </p>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AxeIA, FicheIA, SecteurUsage, UsageSectoriel } from "@/lib/types";
import {
  ECHELLE_TRL,
  LABELS_AXE_IA,
  LABELS_SECTEUR,
  SECTEURS,
  TEXTURE_NON_DOCUMENTE,
  etiquetteMaturite,
  paletteTRL,
} from "@/components/HeatmapTRL";

// Heatmap TRL en grille AXE IA × SECTEUR D'USAGE — mégaprompt section 8, tâche 6
// du MP-1 : « grille secteur (6) × axe IA (6), cellule = TRL moyen ou distribution,
// cliquable vers les fiches concernées ».
//
// Trois vues du même TRL coexistent volontairement, elles ne répondent pas à la
// même question :
//   - RadarChart          : TRL moyen par secteur, toutes fiches confondues
//                           (« quel secteur est globalement le plus mature ? ») ;
//   - HeatmapTRL          : TRL par FICHE × secteur, sans agrégation
//                           (« où en est CETTE capacité dans CE secteur ? ») ;
//   - HeatmapAxeSecteur   : TRL par FAMILLE de capacités × secteur
//                           (« quelle famille d'IA est mûre dans quel secteur ? »).
//
// Précaution statistique assumée : une moyenne sur deux observations n'est pas une
// mesure, c'est une anecdote. Chaque cellule affiche donc TOUJOURS son effectif à
// côté de la valeur, l'étendue min–max des TRL agrégés, et les cellules à effectif
// faible (n ≤ 2) portent une marque explicite « ! » reprise dans la légende et dans
// l'aria-label. Une cellule vide (aucun usage documenté) est distinguée par sa
// NATURE — hachures, bordure pointillée, mention « n. d. » — et jamais par une
// simple teinte froide qui la ferait lire comme un TRL bas.

const AXES: AxeIA[] = Object.keys(LABELS_AXE_IA) as AxeIA[];

// En dessous de ce nombre d'observations, la moyenne est signalée comme fragile.
const SEUIL_EFFECTIF_FAIBLE = 3;

interface Observation {
  fiche: FicheIA;
  usage: UsageSectoriel;
}

interface Cellule {
  axe: AxeIA;
  secteur: SecteurUsage;
  observations: Observation[];
  /** `null` quand aucune observation de la cellule ne porte de TRL chiffré. */
  moyenne: number | null;
  min: number | null;
  max: number | null;
  fiches: number; // nombre de fiches distinctes ayant contribué
}

/** Nombre formaté à une décimale, virgule française, sans dépendance à l'ICU. */
function formaterMoyenne(valeur: number): string {
  return valeur.toFixed(1).replace(".", ",");
}

/** Petite distribution en barres : combien d'observations à chaque TRL de 1 à 9. */
function Distribution({ observations }: { observations: Observation[] }) {
  const chiffrees = observations.filter((o) => typeof o.usage.trl === "number");
  const nonChiffrees = observations.length - chiffrees.length;
  const paliers = Array.from({ length: 9 }, (_, i) =>
    chiffrees.filter((o) => Math.min(Math.max(Math.round(o.usage.trl as number), 1), 9) === i + 1).length,
  );
  const maxi = Math.max(...paliers, 1);
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Distribution des TRL observés</p>
      <div className="mt-1 flex items-end gap-1" aria-hidden="true">
        {paliers.map((n, i) => (
          <div key={i} className="flex w-6 flex-col items-center gap-0.5">
            <span className="text-[9px] tabular-nums text-neutral-500 dark:text-neutral-400">{n > 0 ? n : ""}</span>
            <span
              style={{
                height: `${4 + (n / maxi) * 28}px`,
                backgroundColor: n > 0 ? ECHELLE_TRL[i].fond : "transparent",
              }}
              className={`w-full rounded-sm ${n > 0 ? "" : "border border-dashed border-neutral-300 dark:border-neutral-700"}`}
            />
            <span className="text-[9px] tabular-nums text-neutral-500 dark:text-neutral-400">{i + 1}</span>
          </div>
        ))}
      </div>
      <p className="sr-only">
        {paliers
          .map((n, i) => (n > 0 ? `TRL ${i + 1} : ${n} usage${n > 1 ? "s" : ""}` : null))
          .filter(Boolean)
          .join(" ; ")}
        .
      </p>
      {nonChiffrees > 0 && (
        <p className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
          {nonChiffrees} usage{nonChiffrees > 1 ? "s" : ""} sans TRL déterminable, hors distribution.
        </p>
      )}
    </div>
  );
}

export default function HeatmapAxeSecteur({ fiches }: { fiches: FicheIA[] }) {
  const [selection, setSelection] = useState<string | null>(null);

  const cellules = useMemo(() => {
    const index = new Map<string, Cellule>();
    fiches.forEach((fiche) => {
      (fiche.usages ?? []).forEach((usage) => {
        const cle = `${fiche.axe}::${usage.secteur}`;
        const existante = index.get(cle);
        if (existante) {
          existante.observations.push({ fiche, usage });
        } else {
          index.set(cle, {
            axe: fiche.axe,
            secteur: usage.secteur,
            observations: [{ fiche, usage }],
            moyenne: null,
            min: null,
            max: null,
            fiches: 0,
          });
        }
      });
    });
    index.forEach((cellule) => {
      // Depuis le lot du 07/09/2026, un usage peut être documenté sans TRL
      // (cf. lib/types.ts) : moyenner sur les seuls usages chiffrés, et laisser
      // la cellule à `null` quand aucun ne l'est — un usage non chiffrable ne
      // doit ni tirer la moyenne vers le bas ni disparaître de l'effectif.
      const trls = cellule.observations
        .map((o) => o.usage.trl)
        .filter((t): t is number => typeof t === "number");
      cellule.moyenne = trls.length > 0 ? trls.reduce((s, t) => s + t, 0) / trls.length : null;
      cellule.min = trls.length > 0 ? Math.min(...trls) : null;
      cellule.max = trls.length > 0 ? Math.max(...trls) : null;
      cellule.fiches = new Set(cellule.observations.map((o) => o.fiche.id)).size;
    });
    return index;
  }, [fiches]);

  const totalObservations = useMemo(
    () => Array.from(cellules.values()).reduce((s, c) => s + c.observations.length, 0),
    [cellules],
  );

  const celluleAffichee = selection ? cellules.get(selection) ?? null : null;

  const cellulesRenseignees = cellules.size;
  const cellulesFragiles = useMemo(
    () => Array.from(cellules.values()).filter((c) => c.observations.length < SEUIL_EFFECTIF_FAIBLE).length,
    [cellules],
  );

  return (
    <div>
      <p className="text-xs text-neutral-500" aria-live="polite">
        {cellulesRenseignees} cellule{cellulesRenseignees > 1 ? "s" : ""} renseignée
        {cellulesRenseignees > 1 ? "s" : ""} sur {AXES.length * SECTEURS.length} · {totalObservations} usage
        {totalObservations > 1 ? "s" : ""} sectoriel{totalObservations > 1 ? "s" : ""} agrégé
        {totalObservations > 1 ? "s" : ""} · {cellulesFragiles} cellule{cellulesFragiles > 1 ? "s" : ""} à effectif
        faible (moins de {SEUIL_EFFECTIF_FAIBLE} observations)
      </p>

      <div className="mt-3 w-full max-w-full overflow-x-auto">
        <table className="w-max border-collapse text-xs">
          <caption className="sr-only">
            Grille de maturité agrégée : une ligne par axe (famille de capacités IA), une colonne par secteur
            d&apos;usage. Chaque cellule donne le TRL moyen des usages documentés pour cette famille dans ce secteur,
            suivi du nombre d&apos;observations agrégées et de l&apos;étendue des TRL observés. Une cellule marquée
            d&apos;un point d&apos;exclamation repose sur moins de {SEUIL_EFFECTIF_FAIBLE} observations : la moyenne y
            est indicative, pas mesurée. Une cellule « n. d. » ne contient aucun usage documenté, ce qui est différent
            d&apos;une maturité faible. Les cellules renseignées sont des boutons : les activer affiche le détail des
            fiches agrégées.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-[13rem] min-w-[13rem] bg-white p-1 pr-3 text-left align-bottom font-medium text-neutral-500 dark:bg-neutral-950"
              >
                Axe IA (famille de capacités)
              </th>
              {SECTEURS.map((s) => (
                <th key={s} scope="col" className="min-w-[6rem] p-1 pb-2 text-center font-normal text-neutral-500">
                  {LABELS_SECTEUR[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AXES.map((axe) => {
              const fichesAxe = fiches.filter((f) => f.axe === axe);
              return (
                <tr key={axe} className="border-t border-neutral-100 dark:border-neutral-900">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 w-[13rem] min-w-[13rem] max-w-[13rem] bg-white p-1 pr-3 text-left font-normal dark:bg-neutral-950"
                  >
                    <span className="block">{LABELS_AXE_IA[axe]}</span>
                    <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">
                      {fichesAxe.length} fiche{fichesAxe.length > 1 ? "s" : ""}
                    </span>
                  </th>
                  {SECTEURS.map((secteur) => {
                    const cle = `${axe}::${secteur}`;
                    const cellule = cellules.get(cle);
                    if (!cellule) {
                      return (
                        <td key={secteur} className="p-1">
                          <div
                            style={TEXTURE_NON_DOCUMENTE}
                            className="flex h-14 w-full items-center justify-center rounded border border-dashed border-neutral-300 text-neutral-200 dark:border-neutral-700 dark:text-neutral-800"
                          >
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">n. d.</span>
                          </div>
                          <span className="sr-only">
                            {LABELS_AXE_IA[axe]}, {LABELS_SECTEUR[secteur]} : aucun usage documenté (absence de donnée,
                            pas une maturité faible).
                          </span>
                        </td>
                      );
                    }
                    const n = cellule.observations.length;
                    const fragile = n < SEUIL_EFFECTIF_FAIBLE;
                    const selectionnee = selection === cle;
                    if (cellule.moyenne === null || cellule.min === null || cellule.max === null) {
                      // Croisement documenté, mais aucun de ses usages ne porte de
                      // TRL déterminable : afficher l'effectif sans couleur d'échelle.
                      return (
                        <td key={secteur} className="p-1">
                          <button
                            type="button"
                            onClick={() => setSelection(selectionnee ? null : cle)}
                            aria-pressed={selectionnee}
                            aria-label={`${LABELS_AXE_IA[axe]}, ${LABELS_SECTEUR[secteur]} : ${n} usage${
                              n > 1 ? "s" : ""
                            } documenté${n > 1 ? "s" : ""}, aucun TRL déterminable. Afficher le détail des fiches agrégées.`}
                            title={`${LABELS_AXE_IA[axe]} — ${LABELS_SECTEUR[secteur]} · aucun TRL déterminable sur ${n} usage(s)`}
                            className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded border border-neutral-300 bg-neutral-100 text-neutral-600 transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-950 ${
                              selectionnee
                                ? "ring-2 ring-neutral-900 ring-offset-2 dark:ring-neutral-100 dark:ring-offset-neutral-950"
                                : ""
                            }`}
                          >
                            <span className="text-sm font-semibold">n. c.</span>
                            <span className="text-[10px] tabular-nums opacity-90">n={n}</span>
                          </button>
                        </td>
                      );
                    }
                    const palette = paletteTRL(cellule.moyenne);
                    return (
                      <td key={secteur} className="p-1">
                        <button
                          type="button"
                          onClick={() => setSelection(selectionnee ? null : cle)}
                          aria-pressed={selectionnee}
                          aria-label={`${LABELS_AXE_IA[axe]}, ${LABELS_SECTEUR[secteur]} : TRL moyen ${formaterMoyenne(
                            cellule.moyenne,
                          )} sur 9, calculé sur ${n} usage${n > 1 ? "s" : ""} documenté${n > 1 ? "s" : ""} issu${
                            n > 1 ? "s" : ""
                          } de ${cellule.fiches} fiche${cellule.fiches > 1 ? "s" : ""}, TRL observés de ${cellule.min} à ${
                            cellule.max
                          }.${
                            fragile
                              ? ` Effectif faible : moins de ${SEUIL_EFFECTIF_FAIBLE} observations, moyenne indicative.`
                              : ""
                          } Afficher le détail des fiches agrégées.`}
                          title={`${LABELS_AXE_IA[axe]} — ${LABELS_SECTEUR[secteur]} · TRL moyen ${formaterMoyenne(
                            cellule.moyenne,
                          )}/9 sur ${n} usage(s)`}
                          style={{ backgroundColor: palette.fond, color: palette.texte }}
                          className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 dark:focus-visible:ring-neutral-100 dark:focus-visible:ring-offset-neutral-950 ${
                            selectionnee
                              ? "ring-2 ring-neutral-900 ring-offset-2 dark:ring-neutral-100 dark:ring-offset-neutral-950"
                              : ""
                          } ${fragile ? "border-2 border-dotted" : ""}`}
                        >
                          <span className="text-sm font-semibold tabular-nums">{formaterMoyenne(cellule.moyenne)}</span>
                          <span className="text-[10px] tabular-nums opacity-90">
                            n={n}
                            {fragile ? " !" : ""}
                          </span>
                          <span className="text-[9px] tabular-nums opacity-80">
                            {cellule.min === cellule.max ? `TRL ${cellule.min}` : `${cellule.min}–${cellule.max}`}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span>TRL moyen 1</span>
          {ECHELLE_TRL.map((p, i) => (
            <span
              key={i}
              style={{ backgroundColor: p.fond, color: p.texte }}
              className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-[10px] font-semibold tabular-nums"
            >
              {i + 1}
            </span>
          ))}
          <span>9</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm border-2 border-dotted border-neutral-500 text-[10px] font-semibold">
            !
          </span>
          effectif faible (n &lt; {SEUIL_EFFECTIF_FAIBLE}) — moyenne indicative, pas une mesure
        </span>
        <span className="flex items-center gap-1.5">
          <span
            style={TEXTURE_NON_DOCUMENTE}
            className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-dashed border-neutral-300 text-neutral-200 dark:border-neutral-700 dark:text-neutral-800"
          />
          n. d. — aucun usage documenté pour ce croisement (≠ TRL faible)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-neutral-300 bg-neutral-100 text-[9px] font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            n.&nbsp;c.
          </span>
          n. c. — usages documentés, aucun TRL déterminable (≠ TRL faible)
        </span>
      </div>

      {celluleAffichee ? (
        <div className="mt-4 rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-medium">
              {LABELS_AXE_IA[celluleAffichee.axe]} — {LABELS_SECTEUR[celluleAffichee.secteur]}
            </h4>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {celluleAffichee.moyenne === null
                ? "Aucun TRL déterminable"
                : `TRL moyen ${formaterMoyenne(celluleAffichee.moyenne)}/9`}{" "}
              · {celluleAffichee.observations.length} usage
              {celluleAffichee.observations.length > 1 ? "s" : ""} · {celluleAffichee.fiches} fiche
              {celluleAffichee.fiches > 1 ? "s" : ""}
              {celluleAffichee.moyenne !== null ? ` · étendue ${celluleAffichee.min}–${celluleAffichee.max}` : ""}
            </span>
          </div>

          {celluleAffichee.observations.length < SEUIL_EFFECTIF_FAIBLE && (
            <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Effectif faible : cette moyenne repose sur {celluleAffichee.observations.length} observation
              {celluleAffichee.observations.length > 1 ? "s" : ""}. Elle indique une tendance, elle ne mesure rien —
              lire directement les usages ci-dessous plutôt que la valeur agrégée.
            </p>
          )}

          <div className="mt-3">
            <Distribution observations={celluleAffichee.observations} />
          </div>

          <ul className="mt-3 space-y-3">
            {celluleAffichee.observations
              .slice()
              // Les usages sans TRL déterminable ferment la liste plutôt que de
              // se ranger avec les TRL 0 — ils n'ont pas de rang sur l'échelle.
              .sort(
                (a, b) =>
                  (b.usage.trl ?? -1) - (a.usage.trl ?? -1) || a.fiche.nom.localeCompare(b.fiche.nom, "fr"),
              )
              .map((o, i) => (
                <li key={`${o.fiche.id}-${i}`} className="border-t border-neutral-100 pt-3 dark:border-neutral-900">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/fiche/ia/${o.fiche.id}`} className="font-medium hover:underline">
                      {o.fiche.nom}
                    </Link>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {etiquetteMaturite(o.usage)}
                      {o.fiche.editeur ? ` · ${o.fiche.editeur}` : ""} · vérifié le{" "}
                      {o.fiche.derniere_verification}
                    </span>
                  </div>
                  <p className="mt-1 text-neutral-700 dark:text-neutral-300">{o.usage.description}</p>
                  {o.usage.sources.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                      {o.usage.sources.map((s, j) => (
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
                          <span className="ml-1 text-neutral-500 dark:text-neutral-400">({s.type})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-neutral-500">
          Aucune cellule sélectionnée — activer une cellule (clic, ou <kbd>Entrée</kbd> / <kbd>Espace</kbd> au clavier)
          pour afficher la distribution des TRL agrégés et la liste des fiches qui composent la moyenne.
        </p>
      )}
    </div>
  );
}

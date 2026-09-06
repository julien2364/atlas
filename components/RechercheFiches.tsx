"use client";

import { useMemo, useState } from "react";
import fichesHumaines from "@/data/seed/fiches_humaines";
import fichesIA from "@/data/seed/fiches_ia.json";
import type { FicheHumaine, FicheIA } from "@/lib/types";

const humaines = fichesHumaines as unknown as FicheHumaine[];
const ia = fichesIA as unknown as FicheIA[];

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type Resultat =
  | { type: "humaine"; fiche: FicheHumaine; score: number }
  | { type: "ia"; fiche: FicheIA; score: number };

function scoreFicheHumaine(f: FicheHumaine, q: string): number {
  const champs = [f.nom, f.these_centrale, f.apport, f.limites_critiques, f.resonance_ia ?? ""];
  return champs.reduce((s, c) => (normalise(c).includes(q) ? s + 1 : s), 0);
}

function scoreFicheIA(f: FicheIA, q: string): number {
  const champs = [f.nom, f.editeur ?? "", f.architecture ?? "", f.limites_connues, ...f.capacites_cles];
  return champs.reduce((s, c) => (normalise(c).includes(q) ? s + 1 : s), 0);
}

const StatutLabel: Record<string, string> = {
  a_documenter: "à documenter",
  documente: "documenté",
  verifie_recemment: "vérifié récemment",
  a_re_auditer: "à ré-auditer",
};

export default function RechercheFiches() {
  const [terme, setTerme] = useState("");

  const resultats = useMemo<Resultat[]>(() => {
    const q = normalise(terme.trim());
    if (q.length < 2) return [];
    const rh: Resultat[] = humaines
      .map((fiche) => ({ type: "humaine" as const, fiche, score: scoreFicheHumaine(fiche, q) }))
      .filter((r) => r.score > 0);
    const ria: Resultat[] = ia
      .map((fiche) => ({ type: "ia" as const, fiche, score: scoreFicheIA(fiche, q) }))
      .filter((r) => r.score > 0);
    return [...rh, ...ria].sort((a, b) => b.score - a.score).slice(0, 8);
  }, [terme]);

  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <label htmlFor="recherche-fiches" className="text-sm font-medium">
        Recherche automatique dans le référentiel (267 fiches humaines + 44 fiches IA)
      </label>
      <p className="mt-1 text-xs text-neutral-500">
        Moteur de correspondance en direct, sans intervention manuelle — pas encore un RAG complet (Lot 6, en
        attente de la décision Supabase), mais une automatisation réelle de la recherche dès maintenant.
      </p>
      <input
        id="recherche-fiches"
        type="text"
        value={terme}
        onChange={(e) => setTerme(e.target.value)}
        placeholder="Ex. Nietzsche, capitalisme, DeepSeek, biais cognitifs…"
        className="mt-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      {terme.trim().length >= 2 && (
        <div className="mt-4 space-y-2">
          {resultats.length === 0 && (
            <p className="text-sm text-neutral-500">Aucune fiche correspondante pour l&apos;instant.</p>
          )}
          {resultats.map((r) => (
            <a
              key={`${r.type}-${r.fiche.id}`}
              href={r.type === "humaine" ? `/fiche/humaine/${r.fiche.id}` : `/fiche/ia/${r.fiche.id}`}
              className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              <span>
                <span className="font-medium">{r.fiche.nom}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {r.type === "humaine" ? "référentiel humain" : "référentiel IA"}
                </span>
              </span>
              <span className="text-xs text-neutral-500">{StatutLabel[r.fiche.statut]}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

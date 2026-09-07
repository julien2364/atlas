"use client";

import { useState } from "react";
import type { Perspective, Question } from "@/lib/types";
import { BadgeConfiance } from "@/components/Badges";

/* Le niveau de confiance est rendu par le badge de la charte unique
   (docs/design-system.md §5.2) : couleur + jauge de points + libellé, jamais la
   couleur seule. Ce composant n'a plus sa propre table de correspondance. */

/**
 * Rendu d'un jeu de perspectives : sélecteur d'école puis les six champs du
 * type `Perspective`, plus les sources.
 *
 * Exporté (MP-4) pour être réutilisé tel quel par le moteur RAG
 * (components/QuestionLibreClient.tsx) : une réponse générée s'affiche donc
 * dans EXACTEMENT le même gabarit qu'une réponse rédigée à la main, ce qui rend
 * la comparaison de qualité immédiatement visible pour le lecteur — et rend
 * impossible de « tricher » en affichant moins de champs côté RAG.
 */
export function PerspectivesPanel({ perspectives }: { perspectives: Perspective[] }) {
  const [actif, setActif] = useState(0);
  if (perspectives.length === 0) return null;
  const p = perspectives[Math.min(actif, perspectives.length - 1)];

  return (
    <>
      {/* Sélecteur de modèle/école — jamais un seul verdict (cf. /methodologie) */}
      <div className="mt-4 flex flex-wrap gap-2">
        {perspectives.map((persp, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActif(i)}
            aria-pressed={i === actif}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              i === actif
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
            }`}
          >
            {persp.modele}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <BadgeConfiance niveau={p.niveau_confiance} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Hypothèses de départ</p>
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">{p.hypotheses}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">État actuel</p>
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">{p.etat_actuel}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Réponse</p>
          <p className="mt-1 font-medium text-neutral-800 dark:text-neutral-200">{p.reponse}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Justification</p>
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">{p.justification}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Limites</p>
          <p className="mt-1 text-neutral-700 dark:text-neutral-300">{p.limites}</p>
        </div>
        {p.sources.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Sources</p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {p.sources.map((s, i) => (
                <li key={i}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-neutral-300 hover:decoration-neutral-600">
                      {s.titre}
                    </a>
                  ) : (
                    <span>{s.titre}</span>
                  )}
                  <span className="ml-1 text-neutral-500 dark:text-neutral-400">({s.type})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function QuestionCard({ item }: { item: Question }) {
  return (
    <article className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="font-medium">{item.question}</h2>

      {(item.sous_questions?.length || item.axes_recherche?.length) ? (
        <div className="mt-3 grid gap-3 text-xs text-neutral-500 sm:grid-cols-2">
          {item.sous_questions?.length ? (
            <div>
              <p className="font-medium text-neutral-500 dark:text-neutral-400">Sous-questions</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {item.sous_questions.map((sq, i) => <li key={i}>{sq}</li>)}
              </ul>
            </div>
          ) : null}
          {item.axes_recherche?.length ? (
            <div>
              <p className="font-medium text-neutral-500 dark:text-neutral-400">Axes de recherche</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {item.axes_recherche.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <PerspectivesPanel perspectives={item.perspectives} />
    </article>
  );
}

export default function QuestionsClient({ questions }: { questions: Question[] }) {
  return (
    <div className="space-y-6">
      {questions.map((item) => <QuestionCard key={item.id} item={item} />)}
    </div>
  );
}

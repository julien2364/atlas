"use client";

// Champ de question libre du moteur de réponse prédictive (MP-4, mégaprompt §7.3).
//
// Contrat d'affichage, aligné sur les garde-fous du moteur :
//   - la réponse est TOUJOURS rendue par <PerspectivesPanel>, le même composant
//     que les 4 questions répondues à la main : même gabarit, mêmes six champs,
//     même sélecteur d'école. Aucun format « verdict » n'est même possible ici ;
//   - les fiches sources mobilisées sont affichées systématiquement, y compris
//     quand le moteur refuse de répondre ;
//   - un refus (corpus insuffisant) est affiché comme une réponse légitime, pas
//     comme une erreur : c'est le comportement voulu, pas une panne.

import { useCallback, useEffect, useState } from "react";
import type { Perspective } from "@/lib/types";
import { PerspectivesPanel } from "@/components/QuestionsClient";

interface PassageMobilise {
  type_fiche: "humaine" | "ia" | "gap";
  fiche_id: string;
  champ: string;
  titre_fiche: string;
  extrait: string;
  similarite: number;
  url: string | null;
}

interface FicheMobilisee {
  id: string;
  type: "humaine" | "ia" | "gap";
  nom: string;
  url: string;
  champs: string[];
  similarite_max: number;
}

interface Diagnostic {
  statut: "repondue" | "hors_corpus" | "corpus_vide";
  similarite_max: number;
  nb_passages_trouves: number;
  nb_passages_utilises: number;
  seuil_pertinence: number;
  modele_embedding: string;
  modele_reponse: string | null;
  tokens_entree: number;
  tokens_sortie: number;
  depuis_cache: boolean;
  genere_le: string;
  corpus_maj: string;
}

interface ReponseQuestion {
  question: string;
  reformulation: string;
  perspectives: Perspective[];
  angles_morts: string;
  passages_mobilises: PassageMobilise[];
  fiches_mobilisees: FicheMobilisee[];
  avertissements: string[];
  message?: string;
  diagnostic: Diagnostic;
}

interface EtatMoteur {
  actif: boolean;
  cles_manquantes: string[];
}

const LIBELLE_TYPE: Record<"humaine" | "ia" | "gap", string> = {
  humaine: "Capacité humaine",
  ia: "Capacité IA",
  gap: "Gap analysis",
};

const LIBELLE_CHAMP: Record<string, string> = {
  these_centrale: "thèse centrale",
  apport: "apport",
  limites_critiques: "limites critiques",
  resonance_ia: "résonance IA",
  capacites_cles: "capacités clés",
  limites_connues: "limites connues",
  usages: "usages sectoriels",
  apport_ia: "apport de l'IA",
  mecanisme: "mécanisme",
  amelioration_possible: "amélioration possible",
  mode_interaction: "mode d'interaction",
  scenario_present: "scénario présent",
  scenario_5ans: "scénario à 5 ans",
  scenario_15_20ans: "scénario à 15-20 ans",
  axes_prospectifs: "axes prospectifs",
};

function libelleChamp(champ: string): string {
  return LIBELLE_CHAMP[champ] ?? champ.replace(/_/g, " ");
}

const EXEMPLES = [
  "L'IA peut-elle remplacer le jugement moral humain ?",
  "Quelles capacités humaines résistent le mieux à l'automatisation ?",
  "Comment l'IA transforme-t-elle la recherche scientifique ?",
];

export default function QuestionLibreClient() {
  const [question, setQuestion] = useState("");
  const [chargement, setChargement] = useState(false);
  const [reponse, setReponse] = useState<ReponseQuestion | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etat, setEtat] = useState<EtatMoteur | null>(null);

  // Diagnostic de configuration, sans aucun appel payant : permet d'afficher un
  // message honnête si les clés ne sont pas encore posées, plutôt qu'un champ
  // de saisie qui échouera systématiquement.
  useEffect(() => {
    let annule = false;
    fetch("/api/question")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!annule && d) setEtat({ actif: Boolean(d.actif), cles_manquantes: d.cles_manquantes ?? [] });
      })
      .catch(() => {
        /* diagnostic non bloquant */
      });
    return () => {
      annule = true;
    };
  }, []);

  const envoyer = useCallback(
    async (texte: string) => {
      const propre = texte.trim();
      if (propre.length < 10 || chargement) return;
      setChargement(true);
      setErreur(null);
      setReponse(null);
      try {
        const r = await fetch("/api/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: propre }),
        });
        const donnees = await r.json();
        if (!r.ok) {
          setErreur(donnees?.erreur?.message ?? `Le moteur a répondu ${r.status}.`);
        } else {
          setReponse(donnees as ReponseQuestion);
        }
      } catch {
        setErreur("Le moteur est injoignable. Vérifier la connexion réseau et réessayer.");
      } finally {
        setChargement(false);
      }
    },
    [chargement]
  );

  const repondue = reponse?.diagnostic.statut === "repondue";

  return (
    <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="font-medium">Poser une question au référentiel</h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-500">
        Recherche sémantique dans les 267 fiches humaines, 44 fiches IA et 201 fiches de gap, puis réponse
        construite <strong>en perspectives concurrentes</strong>, jamais en verdict unique. Si le référentiel ne
        couvre pas la question, le moteur le dit et ne répond pas.
      </p>

      {etat && !etat.actif ? (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Moteur non configuré sur ce déploiement : {etat.cles_manquantes.join(", ")} manquante(s). Les questions
          ci-dessous restent consultables. Marche à suivre :{" "}
          <code className="font-mono">docs/rag-mise-en-route-et-cout.md</code>.
        </p>
      ) : null}

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void envoyer(question);
        }}
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={400}
          placeholder="Ex. : l'IA peut-elle remplacer le jugement moral humain ?"
          aria-label="Question libre posée au référentiel"
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={chargement || question.trim().length < 10}
          className="rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white transition-opacity disabled:opacity-40 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {chargement ? "Recherche…" : "Interroger"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-2">
        {EXEMPLES.map((exemple) => (
          <button
            key={exemple}
            type="button"
            onClick={() => {
              setQuestion(exemple);
              void envoyer(exemple);
            }}
            disabled={chargement}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-neutral-500 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400"
          >
            {exemple}
          </button>
        ))}
      </div>

      {chargement ? (
        <p className="mt-4 text-sm text-neutral-500">
          Recherche sémantique dans le corpus, puis construction des perspectives…
        </p>
      ) : null}

      {erreur ? (
        <p className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {erreur}
        </p>
      ) : null}

      {reponse ? (
        <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Question comprise comme</p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{reponse.reformulation}</p>

          {/* Refus assumé : pas de perspectives inventées quand le corpus ne suit pas. */}
          {!repondue ? (
            <p className="mt-4 rounded border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              {reponse.message ?? "Le référentiel ne permet pas de répondre à cette question."}
            </p>
          ) : null}

          {reponse.avertissements.length > 0 ? (
            <ul className="mt-4 space-y-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {reponse.avertissements.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : null}

          {repondue ? (
            <PerspectivesPanel key={reponse.diagnostic.genere_le} perspectives={reponse.perspectives} />
          ) : null}

          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Angles morts de la réponse</p>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{reponse.angles_morts}</p>
          </div>

          {/* Les fiches sources sont affichées quoi qu'il arrive — garde-fou n°2. */}
          {reponse.fiches_mobilisees.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                Fiches du référentiel mobilisées ({reponse.fiches_mobilisees.length})
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {reponse.fiches_mobilisees.map((f) => (
                  <li key={`${f.type}:${f.id}`} className="flex flex-wrap items-baseline gap-x-2">
                    <a href={f.url} className="underline decoration-neutral-300 hover:decoration-neutral-600">
                      {f.nom}
                    </a>
                    <span className="text-neutral-400">{LIBELLE_TYPE[f.type]}</span>
                    <span className="text-neutral-400">
                      {f.champs.map(libelleChamp).join(", ")} · proximité {f.similarite_max.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {reponse.passages_mobilises.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-neutral-500">
                Voir les {reponse.passages_mobilises.length} extraits réellement envoyés au modèle
              </summary>
              <ul className="mt-2 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                {reponse.passages_mobilises.map((p, i) => (
                  <li key={i} className="border-l-2 border-neutral-200 pl-3 dark:border-neutral-800">
                    <span className="text-neutral-400">
                      {p.titre_fiche} · {libelleChamp(p.champ)} · {p.similarite.toFixed(3)}
                    </span>
                    <p className="mt-1">{p.extrait}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <p className="mt-4 text-xs text-neutral-400">
            {reponse.diagnostic.depuis_cache ? "Réponse servie depuis le cache" : "Réponse générée"} ·{" "}
            {reponse.diagnostic.nb_passages_utilises}/{reponse.diagnostic.nb_passages_trouves} extraits retenus ·
            proximité maximale {reponse.diagnostic.similarite_max.toFixed(2)} (seuil{" "}
            {reponse.diagnostic.seuil_pertinence}) ·{" "}
            {reponse.diagnostic.modele_reponse ?? "aucun appel au modèle"} · corpus au{" "}
            {reponse.diagnostic.corpus_maj}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Contenu généré par IA à partir du référentiel ATLAS (transparence AI Act) : à vérifier via les fiches
            sources ci-dessus avant toute réutilisation.
          </p>
        </div>
      ) : null}
    </section>
  );
}

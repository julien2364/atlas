"use client";

// Champ de question libre du moteur de réponse prédictive (MP-4, mégaprompt §7.3).
//
// Contrat d'affichage, aligné sur les garde-fous du moteur :
//   - la réponse est TOUJOURS rendue par <PerspectivesPanel>, le même composant
//     que les 9 questions répondues à la main : même gabarit, mêmes six champs,
//     même sélecteur d'école. Aucun format « verdict » n'est même possible ici ;
//   - les fiches sources mobilisées sont affichées systématiquement, y compris
//     quand le moteur refuse de répondre ;
//   - un refus (corpus insuffisant) est affiché comme une réponse légitime, pas
//     comme une erreur : c'est le comportement voulu, pas une panne ;
//   - LE MODE QUI A PRODUIT LA RÉPONSE EST TOUJOURS ÉCRIT, sans exception. Une
//     réponse extractive et une réponse rédigée par un modèle n'ont ni le même
//     statut ni les mêmes risques : les confondre serait le pire défaut possible
//     de cette page.
//
// Trois modes, décrits à l'écran plutôt que dans la documentation seule :
//   1. fournisseur d'API — n'apparaît que si une clé est configurée ;
//   2. prompt à copier / réponse à recoller — aucune clé, aller-retour manuel ;
//   3. extractif — aucune clé, composé depuis les fiches, ne peut rien inventer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Perspective } from "@/lib/types";
import { PerspectivesPanel } from "@/components/QuestionsClient";

type ModeReponse = "fournisseur" | "prompt" | "extractif";
type ModeDemande = "auto" | ModeReponse;

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
  statut: "repondue" | "hors_corpus" | "corpus_vide" | "prompt_a_coller";
  mode: ModeReponse | null;
  mode_libelle: string;
  fournisseur: string | null;
  similarite_max: number;
  nb_passages_trouves: number;
  nb_passages_utilises: number;
  termes_apparies_max: number;
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
  prompt_a_copier?: string;
  croisements?: { fiche: string; role: string; enonce: string; preuve: string }[];
  diagnostic: Diagnostic;
}

interface EtatIndex {
  present: boolean;
  modele_embedding: string;
  nb_passages_indexes: number;
  nb_passages_absents: number;
  nb_entrees_orphelines: number;
}

interface EtatMoteur {
  actif: boolean;
  index: EtatIndex;
  mode_par_defaut: ModeReponse;
  modes_disponibles: ModeReponse[];
  fournisseurs_configures: { id: string; nom: string; modele: string }[];
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
  if (LIBELLE_CHAMP[champ]) return LIBELLE_CHAMP[champ];
  if (champ.startsWith("usage_")) return `usage ${champ.slice(6).replace(/_/g, " ")}`;
  return champ.replace(/_/g, " ");
}

/** Description de chaque mode, telle qu'elle est présentée au lecteur. */
const MODES: { valeur: ModeDemande; libelle: string; aide: string }[] = [
  {
    valeur: "auto",
    libelle: "Automatique",
    aide: "Essaie les fournisseurs d'API configurés, puis retombe sur la réponse extractive. Marche toujours.",
  },
  {
    valeur: "fournisseur",
    libelle: "Fournisseur d'API",
    aide: "Un modèle de langage rédige les perspectives à partir des extraits. Demande une clé configurée sur le serveur.",
  },
  {
    valeur: "prompt",
    libelle: "Prompt à copier",
    aide: "Aucune clé : le moteur cherche et prépare un prompt. Vous le collez dans le chat de votre choix, et recollez ici la réponse obtenue.",
  },
  {
    valeur: "extractif",
    libelle: "Extractif (sans modèle)",
    aide: "Aucune clé, aucun modèle génératif : chaque perspective est assemblée depuis les champs des fiches retrouvées. Rien n'y est reformulé, donc rien n'y est inventé.",
  },
];

const EXEMPLES = [
  "Le bien-vivre est-il mesurable, et faut-il le mesurer ?",
  "Comment comparer l'évolution du capitalisme, du communisme et du modèle chinois ?",
  "Les limites actuelles de l'IA générative sont-elles structurelles ou conjoncturelles ?",
];

/** Effectifs du corpus, calculés côté serveur et passés en props : ce composant
 *  ne doit surtout pas importer lib/corpus, qui embarquerait les ~1 Mo de JSON
 *  du référentiel dans le bundle du navigateur pour afficher trois nombres. */
export interface EffectifsCorpus {
  humaines: number;
  ia: number;
  gaps: number;
}

export default function QuestionLibreClient({ effectifs }: { effectifs: EffectifsCorpus }) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<ModeDemande>("auto");
  const [chargement, setChargement] = useState(false);
  const [reponse, setReponse] = useState<ReponseQuestion | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etat, setEtat] = useState<EtatMoteur | null>(null);
  const [retour, setRetour] = useState("");
  const [copie, setCopie] = useState<"inactif" | "fait" | "echec">("inactif");
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Diagnostic de configuration, sans aucun appel payant : permet d'annoncer
  // honnêtement ce qui est disponible plutôt que de proposer un mode qui
  // échouera à la première question.
  useEffect(() => {
    let annule = false;
    fetch("/api/question")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (annule || !d) return;
        setEtat(d as EtatMoteur);
      })
      .catch(() => {
        /* diagnostic non bloquant */
      });
    return () => {
      annule = true;
    };
  }, []);

  const modesDisponibles = useMemo(() => {
    const utilisables = new Set<string>(etat?.modes_disponibles ?? ["prompt", "extractif"]);
    return MODES.filter((m) => m.valeur === "auto" || utilisables.has(m.valeur));
  }, [etat]);

  const interroger = useCallback(
    async (texte: string, modeDemande: ModeDemande, texteRetour?: string) => {
      const propre = texte.trim();
      if (propre.length < 10 || chargement) return;
      setChargement(true);
      setErreur(null);
      setCopie("inactif");
      if (!texteRetour) setReponse(null);
      try {
        const r = await fetch("/api/question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: propre, mode: modeDemande, retour: texteRetour }),
        });
        const donnees = await r.json();
        if (!r.ok) {
          setErreur(donnees?.erreur?.message ?? `Le moteur a répondu ${r.status}.`);
        } else {
          setReponse(donnees as ReponseQuestion);
          if ((donnees as ReponseQuestion).diagnostic.statut === "repondue") setRetour("");
        }
      } catch {
        setErreur("Le moteur est injoignable. Vérifier la connexion réseau et réessayer.");
      } finally {
        setChargement(false);
      }
    },
    [chargement]
  );

  const copierPrompt = useCallback(async () => {
    const texte = reponse?.prompt_a_copier;
    if (!texte) return;
    try {
      await navigator.clipboard.writeText(texte);
      setCopie("fait");
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : on sélectionne
      // le texte pour que Ctrl+C fonctionne, plutôt que d'échouer en silence.
      setCopie("echec");
      promptRef.current?.focus();
      promptRef.current?.select();
    }
  }, [reponse]);

  const statut = reponse?.diagnostic.statut;
  const repondue = statut === "repondue";
  const attenteCollage = statut === "prompt_a_coller";
  const extractif = reponse?.diagnostic.mode === "extractif";

  return (
    <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="text-lg font-medium">Poser une question au référentiel</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Recherche dans les {effectifs.humaines} fiches humaines, {effectifs.ia} fiches IA et {effectifs.gaps} fiches
        de gap, puis réponse construite <strong>en perspectives concurrentes</strong>, jamais en verdict unique. Si
        le référentiel ne couvre pas la question, le moteur le dit et ne répond pas.
      </p>

      {/* État réel du moteur : ni promesse, ni alarme. */}
      {etat ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          {etat.index.present
            ? `Index local : ${etat.index.nb_passages_indexes.toLocaleString("fr-FR")} passages · modèle « ${etat.index.modele_embedding} » · aucune base de données, aucun appel réseau pour chercher.`
            : "Index vectoriel absent : lancer « npm run indexer » (aucune clé requise)."}{" "}
          {etat.fournisseurs_configures.length > 0
            ? `Fournisseur${etat.fournisseurs_configures.length > 1 ? "s" : ""} de rédaction : ${etat.fournisseurs_configures.map((f) => `${f.nom} (${f.modele})`).join(", ")}.`
            : "Aucun fournisseur de rédaction configuré : le mode extractif est le mode par défaut. Il compose la réponse depuis les fiches et les croise par leurs relations documentées, sans rien reformuler."}
        </p>
      ) : null}
      {etat && etat.index.nb_passages_absents > 0 ? (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {etat.index.nb_passages_absents.toLocaleString("fr-FR")} passage(s) du corpus ne sont pas dans l&apos;index :
          la recherche porte sur moins de matière qu&apos;annoncé. Relancer{" "}
          <code className="font-mono">npm run indexer</code>.
        </p>
      ) : null}

      {/* Choix du mode. aria-pressed plutôt que des radios : ce sont des bascules
          de configuration, pas un champ de formulaire soumis avec la question. */}
      <fieldset className="mt-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Comment construire la réponse
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {modesDisponibles.map((m) => (
            <button
              key={m.valeur}
              type="button"
              onClick={() => setMode(m.valeur)}
              aria-pressed={mode === m.valeur}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                mode === m.valeur
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
              }`}
            >
              {m.libelle}
            </button>
          ))}
        </div>
        <p className="mt-2 max-w-2xl text-xs text-neutral-500 dark:text-neutral-400" aria-live="polite">
          {MODES.find((m) => m.valeur === mode)?.aide}
        </p>
      </fieldset>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void interroger(question, mode);
        }}
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={400}
          placeholder="Ex. : le bien-vivre est-il mesurable, et faut-il le mesurer ?"
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
              void interroger(exemple, mode);
            }}
            disabled={chargement}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-neutral-500 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400"
          >
            {exemple}
          </button>
        ))}
      </div>

      {chargement ? (
        <p className="mt-4 text-sm text-neutral-500" aria-live="polite">
          Recherche dans le corpus, puis construction des perspectives…
        </p>
      ) : null}

      {erreur ? (
        <p
          role="alert"
          className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {erreur}
        </p>
      ) : null}

      {reponse ? (
        <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800" aria-live="polite">
          {/* Le mode employé, toujours, en tête de réponse. */}
          <p
            className={`inline-block rounded border px-2 py-1 text-xs font-medium ${
              extractif
                ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "border-neutral-300 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            }`}
          >
            {reponse.diagnostic.mode
              ? reponse.diagnostic.mode_libelle
              : "Aucune réponse construite — le moteur a refusé"}
            {reponse.diagnostic.fournisseur ? ` · ${reponse.diagnostic.fournisseur}` : null}
            {reponse.diagnostic.modele_reponse ? ` · ${reponse.diagnostic.modele_reponse}` : null}
          </p>

          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Question comprise comme
          </p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{reponse.reformulation}</p>

          {/* Refus assumé, ou consigne du mode 2 : pas de perspectives inventées. */}
          {!repondue && reponse.message ? (
            <p className="mt-4 rounded border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              {reponse.message}
            </p>
          ) : null}

          {reponse.avertissements.length > 0 ? (
            <ul className="mt-4 space-y-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {reponse.avertissements.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : null}

          {/* Mode 2 — prompt à copier, puis zone de collage du retour. */}
          {reponse.prompt_a_copier && (attenteCollage || mode === "prompt") ? (
            <div className="mt-5 rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  1. Prompt à copier ({reponse.prompt_a_copier.length.toLocaleString("fr-FR")} caractères)
                </h3>
                <button
                  type="button"
                  onClick={() => void copierPrompt()}
                  className="rounded-md border border-neutral-900 px-3 py-1 text-xs text-neutral-900 hover:bg-neutral-900 hover:text-white dark:border-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-100 dark:hover:text-neutral-900"
                >
                  {copie === "fait" ? "Copié ✓" : "Copier le prompt"}
                </button>
              </div>
              {copie === "echec" ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  Le presse-papiers a été refusé par le navigateur. Le texte est sélectionné ci-dessous : le copier
                  au clavier.
                </p>
              ) : null}
              <label className="sr-only" htmlFor="prompt-a-copier">
                Prompt complet à copier dans un chat externe
              </label>
              <textarea
                id="prompt-a-copier"
                ref={promptRef}
                readOnly
                value={reponse.prompt_a_copier}
                rows={8}
                className="mt-2 w-full rounded border border-neutral-300 bg-neutral-50 p-2 font-mono text-[11px] leading-relaxed text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              />

              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                2. Coller ici la réponse obtenue
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Le texte peut contenir du bavardage, un bloc de code ou des guillemets typographiques : il sera
                nettoyé. Les identifiants de fiches cités seront vérifiés contre le corpus, et les sources
                rattachées depuis les fiches réelles — un identifiant inventé est rejeté.
              </p>
              <label className="sr-only" htmlFor="retour-modele">
                Réponse du modèle à analyser
              </label>
              <textarea
                id="retour-modele"
                value={retour}
                onChange={(e) => setRetour(e.target.value)}
                rows={6}
                placeholder="Coller ici la réponse du modèle…"
                className="mt-2 w-full rounded border border-neutral-300 bg-transparent p-2 font-mono text-[11px] leading-relaxed dark:border-neutral-700"
              />
              <button
                type="button"
                disabled={chargement || retour.trim().length === 0}
                onClick={() => void interroger(reponse.question, "prompt", retour)}
                className="mt-2 rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white transition-opacity disabled:opacity-40 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {chargement ? "Lecture…" : "Analyser la réponse collée"}
              </button>
            </div>
          ) : null}

          {repondue ? (
            <PerspectivesPanel key={reponse.diagnostic.genere_le} perspectives={reponse.perspectives} />
          ) : null}

          {/* Le croisement, affiché avant les angles morts : c'est le raisonnement
              de la réponse, pas une note de bas de page. Chaque ligne dit par
              QUELLE relation la fiche est entrée, et cite la phrase du corpus qui
              la fonde — une relation sans preuve ne s'affiche pas. */}
          {repondue && reponse.croisements && reponse.croisements.length > 1 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Comment ces perspectives ont été croisées
              </p>
              <ol className="mt-2 space-y-2">
                {reponse.croisements.map((c, i) => (
                  <li key={`${c.fiche}-${i}`} className="text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="font-medium">{c.fiche}</span>{" "}
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                      {c.role}
                    </span>
                    {c.enonce ? <span className="block text-neutral-600 dark:text-neutral-400">{c.enonce}</span> : null}
                    {c.preuve ? (
                      <span className="mt-0.5 block border-l-2 border-neutral-300 pl-2 text-xs italic text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                        {c.preuve}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Angles morts de la réponse
            </p>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{reponse.angles_morts}</p>
          </div>

          {/* Les fiches sources sont affichées quoi qu'il arrive — garde-fou n°2. */}
          {reponse.fiches_mobilisees.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Fiches du référentiel mobilisées ({reponse.fiches_mobilisees.length})
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {reponse.fiches_mobilisees.map((f) => (
                  <li key={`${f.type}:${f.id}`} className="flex flex-wrap items-baseline gap-x-2">
                    <a href={f.url} className="underline decoration-neutral-300 hover:decoration-neutral-600">
                      {f.nom}
                    </a>
                    <span className="text-neutral-500 dark:text-neutral-400">{LIBELLE_TYPE[f.type]}</span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {f.champs.map(libelleChamp).join(", ")} · proximité {f.similarite_max.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {reponse.passages_mobilises.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-neutral-500 dark:text-neutral-400">
                Voir les {reponse.passages_mobilises.length} extraits du corpus retenus
              </summary>
              <ul className="mt-2 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                {reponse.passages_mobilises.map((p, i) => (
                  <li key={i} className="border-l-2 border-neutral-200 pl-3 dark:border-neutral-800">
                    <span className="text-neutral-500 dark:text-neutral-400">
                      {p.titre_fiche} · {libelleChamp(p.champ)} · {p.similarite.toFixed(3)}
                    </span>
                    <p className="mt-1">{p.extrait}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
            {reponse.diagnostic.depuis_cache ? "Réponse servie depuis le cache" : "Réponse construite"} ·{" "}
            {reponse.diagnostic.nb_passages_utilises}/{reponse.diagnostic.nb_passages_trouves} extraits retenus ·
            proximité maximale {reponse.diagnostic.similarite_max.toFixed(3)} (seuil{" "}
            {reponse.diagnostic.seuil_pertinence}) · {reponse.diagnostic.termes_apparies_max} terme(s) de la question
            retrouvé(s) · recherche « {reponse.diagnostic.modele_embedding} » · corpus au{" "}
            {reponse.diagnostic.corpus_maj}
            {reponse.diagnostic.tokens_sortie > 0
              ? ` · ${reponse.diagnostic.tokens_entree} tokens en entrée, ${reponse.diagnostic.tokens_sortie} en sortie`
              : null}
          </p>

          {/* Transparence : la mention dépend du mode, parce que la réalité en
              dépend. Annoncer « contenu généré par IA » sur une réponse extractive
              serait faux, et l'inverse serait grave. */}
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {extractif
              ? "Aucun modèle génératif n'est intervenu : chaque phrase de fond est recopiée d'une fiche du référentiel. Les fiches sources sont listées ci-dessus."
              : repondue
                ? "Contenu généré par IA à partir du référentiel ATLAS (transparence AI Act) : à vérifier via les fiches sources ci-dessus avant toute réutilisation."
                : "Aucun contenu n'a été généré pour cette question."}
          </p>
        </div>
      ) : null}
    </section>
  );
}

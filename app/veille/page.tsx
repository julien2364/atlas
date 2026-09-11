import type { Metadata } from "next";
import sources from "@/data/seed/veille_sources.json";
import changelog from "@/data/seed/changelog.json";
import queue from "@/data/seed/veille_queue.json";
import questionnement from "@/data/seed/questionnement.json";
import VeilleClient, { type QueueItem } from "@/components/VeilleClient";

type Source = { id: string; nom: string; type: string; domaine: string; actif: boolean; note?: string };

type FicheAngle = {
  type: string;
  id: string;
  nom: string;
  axe: string;
  sous_domaine: string;
  these: string;
  limite: string;
};

type Angle = {
  id: string;
  fiches: FicheAngle[];
  preuve: string;
  champ: string;
  question: string;
  actualites: { date: string | null; source: string; titre: string; lien: string | null; fiche_touchee: string }[];
};

type Questionnement = {
  genere_le: string;
  nb_contestations_documentees: number;
  nb_angles: number;
  nb_avec_actualite: number;
  avertissement: string;
  angles: Angle[];
};

/** Formatage JJ/MM/AAAA déterministe, pour ne pas dépendre de l'ICU du runtime de
 *  rendu (le serveur et le navigateur ne partagent pas forcément la même locale). */
function formatDateFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export const metadata: Metadata = {
  title: "Veille et changelog",
  description:
    "Sources de veille configurées, file de propositions en attente de revue humaine, et journal daté des évolutions du corpus ATLAS. Aucune fiche n'est modifiée sans validation tracée.",
  alternates: { canonical: "/veille" },
};

export default function VeillePage() {
  const typedSources = sources as Source[];
  const activeCount = typedSources.filter((s) => s.actif).length;
  const propositions = queue as unknown as QueueItem[];
  const q = questionnement as unknown as Questionnement;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Questionnement, veille et changelog</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Cette page commence par ce qui se travaille : les désaccords que le référentiel documente, un par
          encadré, avec la phrase du corpus qui les établit. Viennent ensuite les canaux de collecte, la file de
          propositions en attente de revue humaine, et le journal daté des évolutions du corpus.
        </p>
      </header>

      {/* --------------------------------------------------------------------
          Le questionnement, en tête : c'est ce qui sert à travailler. Les
          sources et la file sont de la plomberie — utile à auditer, inutile à
          lire. Chaque angle part d'une opposition ÉCRITE dans une fiche, jamais
          d'un rapprochement calculé.
          ------------------------------------------------------------------ */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">Questionnement du jour</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {q.nb_angles} angles sur {q.nb_contestations_documentees} oppositions documentées · rotation du{" "}
            {formatDateFr(q.genere_le)}
          </p>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          {q.avertissement}
        </p>

        <ul className="mt-4 space-y-4">
          {q.angles.map((angle) => (
            <li key={angle.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm font-medium">
                {angle.fiches[0]?.nom} <span className="text-neutral-400">×</span> {angle.fiches[1]?.nom}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">{angle.question}</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {angle.fiches.map((f) => (
                  <div key={f.id} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      {f.nom}
                    </p>
                    {f.these ? (
                      <p className="mt-1 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">{f.these}</p>
                    ) : null}
                    {f.limite ? (
                      <p className="mt-2 border-l-2 border-neutral-300 pl-2 text-xs italic text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                        Limite posée par la fiche : {f.limite}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {angle.actualites.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Actualités récentes rattachées
                  </p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {angle.actualites.map((a) => (
                      <li key={a.titre} className="text-neutral-600 dark:text-neutral-400">
                        {a.date ? `${formatDateFr(a.date)} · ` : ""}
                        {a.source} —{" "}
                        {a.lien ? (
                          <a href={a.lien} className="underline" rel="noreferrer noopener" target="_blank">
                            {a.titre}
                          </a>
                        ) : (
                          a.titre
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Sources configurées ({activeCount}/{typedSources.length} actives)</h2>
        <p className="mt-1 max-w-2xl text-xs text-neutral-500">
          Canaux de collecte : RSS/Atom en priorité, Spiderfoot en second canal structuré, scraping générique
          exclu. <code>scripts/veille-rss.mjs</code> interroge les sources actives, déduplique par lien et dépose
          les nouveautés dans la file ci-dessous — aucune fiche n&apos;est mise à jour automatiquement.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {typedSources.map((s) => (
            <li key={s.id} className="rounded border border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className={s.actif ? "" : "text-neutral-500 dark:text-neutral-400 line-through"}>{s.nom}</span>
                <span className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <span
                    className={`rounded px-2 py-0.5 ${
                      s.actif
                        ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                        : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                    }`}
                  >
                    {s.actif ? s.type : "désactivée"}
                  </span>
                  <span>{s.domaine}</span>
                </span>
              </div>
              {!s.actif && s.note ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{s.note}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Revue de la file de validation ({propositions.length} propositions)</h2>
        <p className="mt-1 max-w-2xl text-xs text-neutral-500">
          Propositions collectées par les scripts de veille et de documentation, en attente de revue humaine avant
          tout rattachement à une fiche existante ou création d&apos;une nouvelle fiche. La revue se fait par lots
          (filtres par statut, type de cible, source, score de fiabilité) et produit un fichier de décision à
          committer — le détail du raisonnement est expliqué dans l&apos;encadré ci-dessous.
        </p>
        <div className="mt-3">
          <VeilleClient queue={propositions} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Changelog</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {(changelog as { id: string; date: string; type: string; cible: string; resume: string }[]).map((c) => (
            <li key={c.id} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatDateFr(c.date)} — {c.type} — {c.cible}</p>
              <p className="mt-1">{c.resume}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import sources from "@/data/seed/veille_sources.json";
import changelog from "@/data/seed/changelog.json";
import queue from "@/data/seed/veille_queue.json";
import VeilleClient, { type QueueItem } from "@/components/VeilleClient";

type Source = { id: string; nom: string; type: string; domaine: string; actif: boolean; note?: string };

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

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Veille et changelog</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Canaux de collecte (v1.1 du mégaprompt) : RSS/Atom en priorité + Spiderfoot en second canal structuré,
          scraping générique exclu. Le script <code>scripts/veille-rss.mjs</code> (Lot 5) interroge les sources
          actives, déduplique par lien et dépose les nouveautés dans une file de validation manuelle — aucune
          fiche n&apos;est mise à jour automatiquement.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-medium">Sources configurées ({activeCount}/{typedSources.length} actives)</h2>
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

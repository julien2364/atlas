import sources from "@/data/seed/veille_sources.json";
import changelog from "@/data/seed/changelog.json";
import queue from "@/data/seed/veille_queue.json";

type Source = { id: string; nom: string; type: string; domaine: string; actif: boolean; note?: string };
type QueueItem = {
  id: string;
  source_id: string | null;
  cible_type?: string;
  cible_id?: string | null;
  statut: string;
  score_fiabilite: number;
  // Deux formes possibles selon le script d'origine :
  // - veille-rss.mjs (actualités) : { titre, link, date, resume }
  // - documentation-recherche.mjs (fiches "à documenter") : { nom, titre_article_source, url, extrait, langue_source, note }
  contenu_propose: {
    titre?: string;
    link?: string;
    date?: string;
    resume?: string;
    nom?: string;
    titre_article_source?: string;
    url?: string;
    extrait?: string;
    langue_source?: string;
    note?: string;
  };
};

function normaliserProposition(q: QueueItem): { titre: string; href: string | null; dateStr: string | null; texte: string; badge: string } {
  const estDocumentation = q.cible_type === "fiche_humaine" || q.cible_type === "fiche_ia";
  if (estDocumentation) {
    return {
      titre: q.contenu_propose.nom ?? q.contenu_propose.titre_article_source ?? "(sans titre)",
      href: q.contenu_propose.url ?? null,
      dateStr: null,
      texte: q.contenu_propose.extrait ?? "",
      badge: q.cible_type === "fiche_humaine" ? "documentation — fiche humaine" : "documentation — fiche IA",
    };
  }
  return {
    titre: q.contenu_propose.titre ?? "(sans titre)",
    href: q.contenu_propose.link ?? null,
    dateStr: q.contenu_propose.date ? new Date(q.contenu_propose.date).toLocaleDateString("fr-FR") : null,
    texte: q.contenu_propose.resume ?? "",
    badge: "actualité",
  };
}

export default function VeillePage() {
  const typedSources = sources as Source[];
  const activeCount = typedSources.filter((s) => s.actif).length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Veille</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Canaux de collecte (v1.1 du mégaprompt) : RSS/Atom en priorité + Spiderfoot en second canal structuré,
          scraping générique exclu. Le script <code>scripts/veille-rss.mjs</code> (Lot 5) interroge les sources
          actives, déduplique par lien et dépose les nouveautés dans une file de validation manuelle — aucune
          fiche n&apos;est mise à jour automatiquement.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-medium">Sources configurées ({activeCount}/{typedSources.length} actives)</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {typedSources.map((s) => (
            <li key={s.id} className="rounded border border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className={s.actif ? "" : "text-neutral-400 line-through"}>{s.nom}</span>
                <span className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className={`rounded px-2 py-0.5 ${s.actif ? "bg-neutral-100 dark:bg-neutral-800" : "bg-red-50 text-red-600 dark:bg-red-950"}`}>
                    {s.actif ? s.type : "désactivée"}
                  </span>
                  <span>{s.domaine}</span>
                </span>
              </div>
              {!s.actif && s.note ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{s.note}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">File de validation ({(queue as QueueItem[]).length} en attente)</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Propositions collectées par le dernier passage du script, en attente de revue humaine avant tout
          rattachement à une fiche existante ou création d&apos;une nouvelle fiche.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {(queue as QueueItem[]).map((q) => {
            const p = normaliserProposition(q);
            return (
              <li key={q.id} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex items-center justify-between gap-2">
                  {p.href ? (
                    <a href={p.href} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                      {p.titre}
                    </a>
                  ) : (
                    <span className="font-medium">{p.titre}</span>
                  )}
                  <span className="shrink-0 text-xs text-neutral-400">fiabilité {q.score_fiabilite}</span>
                </div>
                {p.texte && <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{p.texte}</p>}
                <p className="mt-1 text-xs text-neutral-500">
                  {p.badge}
                  {p.dateStr ? ` — ${p.dateStr}` : ""} — statut : {q.statut}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Changelog</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {(changelog as { id: string; date: string; type: string; cible: string; resume: string }[]).map((c) => (
            <li key={c.id} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-xs text-neutral-400">{new Date(c.date).toLocaleDateString("fr-FR")} — {c.type} — {c.cible}</p>
              <p className="mt-1">{c.resume}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

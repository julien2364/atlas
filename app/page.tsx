import type { Metadata } from "next";
import Link from "next/link";
import questions from "@/data/seed/questions.json";
import { derniereMiseAJourCorpus, fichesGap, fichesHumaines, fichesIA, formatDateFr } from "@/lib/corpus";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/* Tous les chiffres de cette page sont recomptés depuis le corpus au moment du
   build — jamais écrits en dur (cf. docs/design-system.md §9). Ils restent donc
   justes à la fiche près après chaque ajout. */

const nombreSources = (() => {
  let total = 0;
  for (const f of fichesHumaines) total += f.sources?.length ?? 0;
  for (const f of fichesIA) {
    total += f.sources?.length ?? 0;
    for (const u of f.usages ?? []) total += u.sources?.length ?? 0;
  }
  for (const g of fichesGap) total += g.documents_cles?.length ?? 0;
  return total;
})();

const totalFiches = fichesHumaines.length + fichesIA.length + fichesGap.length;

const CHIFFRES: { valeur: string; libelle: string; href: string }[] = [
  { valeur: String(fichesHumaines.length), libelle: "capacités humaines", href: "/referentiel-humain" },
  { valeur: String(fichesIA.length), libelle: "capacités IA", href: "/referentiel-ia" },
  { valeur: String(fichesGap.length), libelle: "analyses de gap humain × IA", href: "/comparateur" },
  { valeur: String(nombreSources), libelle: "sources citées et datées", href: "/methodologie" },
];

const ENTREES: { href: string; titre: string; desc: string }[] = [
  {
    href: "/referentiel-humain",
    titre: "Référentiel humain",
    desc: "Cinq axes — social, psychologique, philosophique, évolution, sérénité de l'espèce. Une fiche par capacité, avec sa thèse centrale, son apport et ses limites critiques.",
  },
  {
    href: "/referentiel-ia",
    titre: "Référentiel IA",
    desc: "Capacités génératives, agentiques, scientifiques, sectorielles, prédictives — et leurs limites connues. Maturité notée par secteur d'usage sur l'échelle TRL.",
  },
  {
    href: "/comparateur",
    titre: "Comparateur de gap",
    desc: "Croiser une capacité humaine et une capacité IA : apport réel, mécanisme, mode d'interaction, substituabilité, scénarios à 5 et 15-20 ans.",
  },
  {
    href: "/cartographie",
    titre: "Cartographie",
    desc: "Cinq visualisations du corpus : répartition par axe, treemap, matrice de gap, radar et grilles de maturité TRL, graphe de connaissances.",
  },
  {
    href: "/questions",
    titre: "Questions",
    desc: `Question libre sur le référentiel, et ${questions.length} questions-tests permanentes. Chaque réponse est donnée sous plusieurs écoles de pensée, jamais un verdict unique.`,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="max-w-3xl">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Observatoire — DYONYSOS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">ATLAS Humain × IA</h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-700 dark:text-neutral-300">
          Un référentiel comparatif entre ce que l&apos;humain sait faire — social, psychologique, philosophique,
          évolution, sérénité de l&apos;espèce — et ce que l&apos;intelligence artificielle sait faire aujourd&apos;hui,
          poussée à ses usages les plus avancés en science, éducation, recherche, industrie, pharmacie et gouvernement.
        </p>
        <p className="mt-3 text-base leading-relaxed text-neutral-700 dark:text-neutral-300">
          Chaque fiche est sourcée, datée et porte un statut de fraîcheur. Sur tout sujet contesté, plusieurs écoles de
          pensée sont exposées côte à côte plutôt qu&apos;un verdict unique, et le degré de certitude est écrit — fait
          vérifié, consensus, opinion majoritaire ou hypothèse prospective.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link
            href="/comparateur"
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Explorer le comparateur
          </Link>
          <Link
            href="/methodologie"
            className="rounded-md border border-neutral-300 px-4 py-2 font-medium transition hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
          >
            Méthodologie
          </Link>
        </p>
      </section>

      <section aria-labelledby="chiffres">
        <h2 id="chiffres" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Le référentiel aujourd&apos;hui — {totalFiches} fiches
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CHIFFRES.map((c) => (
            <Link
              key={c.libelle}
              href={c.href}
              className="rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <dt className="sr-only">{c.libelle}</dt>
              <dd>
                <span className="block text-2xl font-semibold tabular-nums tracking-tight">{c.valeur}</span>
                <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">{c.libelle}</span>
              </dd>
            </Link>
          ))}
        </dl>
        <p className="mt-2 text-xs text-neutral-500">
          Dernière vérification enregistrée dans le corpus : {formatDateFr(derniereMiseAJourCorpus)}.
        </p>
      </section>

      <section aria-labelledby="entrees">
        <h2 id="entrees" className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Par où entrer
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {ENTREES.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-lg border border-neutral-200 p-5 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <h3 className="font-medium group-hover:underline">{c.titre}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{c.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

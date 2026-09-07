import type { Metadata } from "next";
import changelog from "@/data/seed/changelog.json";
import CartographieClient from "@/components/CartographieClient";
import { fichesGap, fichesHumaines, fichesIA } from "@/lib/corpus";
import type { ChangelogEntry } from "@/lib/types";

export const metadata: Metadata = {
  title: "Cartographie du référentiel",
  description:
    "Six visualisations du corpus ATLAS : répartition par axe, treemap, matrice de gap, radar et grilles de maturité TRL, graphe de connaissances et frise du changelog. Sans dépendance externe, utilisables au clavier.",
  alternates: { canonical: "/cartographie" },
};

export default function CartographiePage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Cartographie</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Sept vues du même corpus, de la plus agrégée à la plus fine : répartition par axe des deux référentiels,
          treemap par domaine, matrice des {fichesGap.length} analyses de gap, radar de maturité TRL par secteur,
          heatmap fiche IA × secteur, grille agrégée axe IA × secteur, graphe de connaissances des paires
          documentées, et frise chronologique du corpus.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Toutes sont faites main, sans bibliothèque de graphes. Elles s&apos;utilisent au clavier, affichent
          l&apos;effectif sur lequel repose chaque valeur agrégée, distinguent une absence de donnée d&apos;une valeur
          basse, et n&apos;encodent jamais une information par la seule couleur. Sur écran étroit, chacune défile
          horizontalement dans son propre cadre.
        </p>
      </header>
      <CartographieClient
        humaines={fichesHumaines}
        ia={fichesIA}
        gaps={fichesGap}
        changelog={changelog as ChangelogEntry[]}
      />
    </div>
  );
}

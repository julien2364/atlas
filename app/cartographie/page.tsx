import type { Metadata } from "next";
import CartographieClient from "@/components/CartographieClient";
import { fichesGap, fichesHumaines, fichesIA } from "@/lib/corpus";

export const metadata: Metadata = {
  title: "Cartographie du référentiel",
  description:
    "Cinq visualisations du corpus ATLAS : répartition par axe, treemap, matrice de gap, radar et grilles de maturité TRL, graphe de connaissances. Utilisables au clavier.",
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
          heatmap fiche IA × secteur, grille agrégée axe IA × secteur, et graphe de connaissances des paires
          documentées.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Elles s&apos;utilisent au clavier. Sur écran étroit, chacune défile horizontalement dans son propre cadre.
        </p>
      </header>
      <CartographieClient humaines={fichesHumaines} ia={fichesIA} gaps={fichesGap} />
    </div>
  );
}

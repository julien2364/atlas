import type { Metadata } from "next";
import ComparateurClient from "@/components/ComparateurClient";
import { fichesGap, fichesHumaines, fichesIA } from "@/lib/corpus";

export const metadata: Metadata = {
  title: "Comparateur de gap humain × IA",
  description:
    "Croiser une capacité humaine et une capacité IA : apport réel, mécanisme, mode d'interaction, substituabilité et scénarios à 5 et 15-20 ans, sur les analyses documentées du référentiel ATLAS.",
  alternates: { canonical: "/comparateur" },
};

export default function ComparateurPage() {
  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Comparateur — analyses de gap</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Sélecteur libre : n&apos;importe laquelle des {fichesHumaines.length} capacités humaines face à
          n&apos;importe laquelle des {fichesIA.length} capacités IA. {fichesGap.length} paires sont analysées selon
          la même grille — apport de l&apos;IA, mécanisme, comment faire mieux, mode d&apos;interaction,
          substituabilité, scénarios présent / +5 ans / +15-20 ans. Les autres combinaisons affichent leur statut
          réel plutôt qu&apos;un contenu inventé.
        </p>
      </header>
      <ComparateurClient humaines={fichesHumaines} ia={fichesIA} gaps={fichesGap} />
    </div>
  );
}

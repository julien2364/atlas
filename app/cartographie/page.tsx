import fichesHumaines from "@/data/seed/fiches_humaines";
import fichesIA from "@/data/seed/fiches_ia.json";
import fichesGap from "@/data/seed/fiches_gap.json";
import CartographieClient from "@/components/CartographieClient";
import type { FicheHumaine, FicheIA, FicheGap } from "@/lib/types";

export default function CartographiePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cartographie</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Répartition par axe des deux référentiels, et matrice de gap cliquable sur les paires déjà analysées.
          Cliquer un segment d&apos;axe liste les fiches qui le composent ; cliquer une cellule de la matrice
          affiche l&apos;analyse complète.
        </p>
      </div>
      <CartographieClient
        humaines={fichesHumaines as FicheHumaine[]}
        ia={fichesIA as FicheIA[]}
        gaps={fichesGap as FicheGap[]}
      />
    </div>
  );
}

import fichesHumaines from "@/data/seed/fiches_humaines";
import fichesIA from "@/data/seed/fiches_ia.json";
import fichesGap from "@/data/seed/fiches_gap.json";
import changelog from "@/data/seed/changelog.json";
import CartographieClient from "@/components/CartographieClient";
import type { FicheHumaine, FicheIA, FicheGap, ChangelogEntry } from "@/lib/types";

export default function CartographiePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cartographie</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Répartition par axe des deux référentiels (barres et treemap), matrice de gap cliquable, radar de
          maturité TRL par secteur, heatmap TRL fiche IA × secteur, grille agrégée TRL axe IA × secteur, et frise
          chronologique de l&apos;évolution du corpus. Cliquer un segment/bloc liste les fiches qui le composent ;
          cliquer une cellule de la matrice de gap affiche l&apos;analyse complète, une cellule de heatmap
          l&apos;usage sectoriel documenté (description, exemples, sources). Toutes les visualisations sont
          utilisables au clavier, affichent l&apos;effectif sur lequel repose chaque valeur agrégée, et
          n&apos;encodent jamais une information par la seule couleur.
        </p>
      </div>
      <CartographieClient
        humaines={fichesHumaines as FicheHumaine[]}
        ia={fichesIA as FicheIA[]}
        gaps={fichesGap as FicheGap[]}
        changelog={changelog as ChangelogEntry[]}
      />
    </div>
  );
}

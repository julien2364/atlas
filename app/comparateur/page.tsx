import gaps from "@/data/seed/fiches_gap.json";
import fichesHumaines from "@/data/seed/fiches_humaines.json";
import fichesIA from "@/data/seed/fiches_ia.json";
import type { FicheGap, FicheHumaine, FicheIA } from "@/lib/types";
import ComparateurClient from "@/components/ComparateurClient";

const gapData = gaps as unknown as FicheGap[];
const humaines = fichesHumaines as unknown as FicheHumaine[];
const ia = fichesIA as unknown as FicheIA[];

export default function ComparateurPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Comparateur — fiches de gap</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Sélecteur libre (Lot 4) : choisissez n&apos;importe quelle capacité humaine et IA. {gapData.length} paires
          sont déjà analysées selon la méthodologie section 5 du mégaprompt (apport, mécanisme, comment mieux, mode
          d&apos;interaction, substituabilité, scénarios temporels) ; les autres combinaisons affichent leur statut
          réel plutôt qu&apos;un contenu inventé.
        </p>
      </div>
      <ComparateurClient humaines={humaines} ia={ia} gaps={gapData} />
    </div>
  );
}

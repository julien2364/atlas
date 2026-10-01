import type { Metadata } from "next";
import { fichesGap, fichesHumaines, fichesIA } from "@/lib/corpus";
import { BadgeConfiance, BadgeStatut, BadgeSubstituabilite } from "@/components/Badges";

export const metadata: Metadata = {
  title: "Méthodologie",
  description:
    "Comment le référentiel ATLAS est produit : neutralité active, sourçage daté, statuts de fraîcheur, niveaux de confiance explicites.",
  alternates: { canonical: "/methodologie" },
};

export default function MethodologiePage() {
  const total = fichesHumaines.length + fichesIA.length + fichesGap.length;

  return (
    <div className="max-w-3xl space-y-10 text-sm">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Méthodologie</h1>
        <p className="mt-3 leading-relaxed text-neutral-600 dark:text-neutral-400">
          {total} fiches — {fichesHumaines.length} capacités humaines, {fichesIA.length} capacités IA et{" "}
          {fichesGap.length} analyses de gap.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Principes</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li>
            <strong>Neutralité active</strong> sur les sujets politiques, économiques et philosophiques contestés :
            plusieurs écoles sont exposées côte à côte, avec leurs hypothèses de départ et leurs limites propres.
            Jamais un verdict unique présenté comme la vérité.
          </li>
          <li>
            <strong>Traçabilité</strong> : chaque affirmation non triviale est sourcée et datée, et le type de source
            (primaire ou secondaire) reste visible sur la fiche.
          </li>
          <li>
            <strong>Anti-obsolescence</strong> : chaque fiche porte un statut de fraîcheur et une date de dernière
            vérification, affichés en tête de fiche.
          </li>
          <li>
            <strong>Auto-extension</strong> : une nouvelle catégorie est créée quand un phénomène n&apos;entre dans
            aucune case existante, plutôt que d&apos;être rangé de force dans la plus proche.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Comment lire les marqueurs</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Trois échelles reviennent sur toutes les pages. Chacune porte une couleur <em>et</em> un glyphe : elles
          restent lisibles en niveaux de gris, en vision daltonienne et à l&apos;impression.
        </p>
        <dl className="space-y-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Statut de fraîcheur d&apos;une fiche
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              <BadgeStatut statut="a_documenter" />
              <BadgeStatut statut="documente" />
              <BadgeStatut statut="verifie_recemment" />
              <BadgeStatut statut="a_re_auditer" />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Niveau de confiance d&apos;une affirmation (échelle ordonnée)
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              <BadgeConfiance niveau="fait_verifie" />
              <BadgeConfiance niveau="consensus_scientifique" />
              <BadgeConfiance niveau="opinion_majoritaire" />
              <BadgeConfiance niveau="hypothese_prospective" />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Substituabilité d&apos;une capacité humaine par l&apos;IA
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              <BadgeSubstituabilite valeur="remplacable_totalement" />
              <BadgeSubstituabilite valeur="remplacable_avec_supervision" />
              <BadgeSubstituabilite valeur="remplacable_avec_autre_technologie" />
              <BadgeSubstituabilite valeur="non_remplacable" />
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Lisibilité et accessibilité</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Contrastes au minimum WCAG AA, navigation clavier sur toutes les visualisations, équivalent textuel sous
          chaque graphique, thème clair/sombre au choix du lecteur, et aucune information portée par la seule couleur.
          La charte est versionnée dans <code className="font-mono text-xs">docs/design-system.md</code>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Documents de référence</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Les données brutes sont exposées par l&apos;
          <a href="/api/meta" className="underline">
            API publique
          </a>
          .
        </p>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Ces données sont réutilisées ailleurs : le référentiel{" "}
          <a href="https://aipm.dyonysos.fr/" className="underline">
            AIPM
          </a>
          , référentiel de gestion de projet à l&apos;ère de l&apos;IA agentique publié par DYONYSOS, s&apos;appuie
          sur les données d&apos;Atlas.
        </p>
      </section>
    </div>
  );
}

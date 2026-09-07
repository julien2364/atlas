import type { Metadata } from "next";
import Link from "next/link";
import { fichesGap, fichesHumaines, fichesIA } from "@/lib/corpus";
import { BadgeConfiance, BadgeStatut, BadgeSubstituabilite } from "@/components/Badges";
import veilleQueue from "@/data/seed/veille_queue.json";
import changelog from "@/data/seed/changelog.json";

type PropositionVeille = { statut: string; score_fiabilite: number };

export const metadata: Metadata = {
  title: "Méthodologie et limites",
  description:
    "Comment le référentiel ATLAS est produit : neutralité active, sourçage daté, statuts de fraîcheur, niveaux de confiance explicites — et ce que le site ne prétend pas faire.",
  alternates: { canonical: "/methodologie" },
};

export default function MethodologiePage() {
  const total = fichesHumaines.length + fichesIA.length + fichesGap.length;
  const propositions = veilleQueue as PropositionVeille[];
  const enAttente = propositions.filter(
    (p) => p.statut === "a_traiter_fiche_existante" || p.statut === "a_traiter_nouvelle_fiche"
  ).length;
  const rejetees = propositions.filter((p) => p.statut === "rejete").length;
  const scoreEleve = propositions.filter((p) => p.score_fiabilite >= 0.8).length;

  return (
    <div className="max-w-3xl space-y-10 text-sm">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Méthodologie et limites</h1>
        <p className="mt-3 leading-relaxed text-neutral-600 dark:text-neutral-400">
          {total} fiches — {fichesHumaines.length} capacités humaines, {fichesIA.length} capacités IA et{" "}
          {fichesGap.length} analyses de gap. Cette page dit comment elles sont écrites, et surtout ce qu&apos;elles ne
          prétendent pas être.
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
        <h2 className="text-lg font-medium">Limites assumées</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li>
            Le corpus a été produit en sprint : sa profondeur est inégale d&apos;un axe à l&apos;autre, et un audit de
            second regard est en cours. Une fiche « documentée » n&apos;est pas une fiche définitive.
          </li>
          <li>
            {fichesGap.length} paires humain × IA sont analysées sur les milliers de combinaisons possibles. Le{" "}
            <Link href="/comparateur" className="underline">
              comparateur
            </Link>{" "}
            affiche le statut réel des autres plutôt que d&apos;improviser une analyse.
          </li>
          <li>
            Les scénarios à +5 et +15-20 ans, et les axes prospectifs, sont des perspectives nommées portant chacune
            son niveau de confiance. Ce ne sont ni des prédictions, ni des probabilités calculées.
          </li>
          <li>
            La veille collecte automatiquement, mais ne publie jamais seule — détail du dispositif et de ce qui
            reste à trancher ci-dessous.
          </li>
          <li>Diffusion publique depuis le 05/09/2026 (décision explicite) — le site n&apos;est plus en accès restreint.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Gouvernance de la veille</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          L&apos;engagement le plus fort du projet tient en une phrase : <strong>rien ne descend dans une fiche
          sans relecture humaine</strong>. Les scripts de veille écrivent uniquement dans une file d&apos;attente
          et dans des fichiers de patchs proposés — jamais dans une fiche. La seule commande qui écrit du contenu
          éditorial n&apos;est déclenchée par aucun automate : il faut un geste humain, tapé et tracé.
        </p>
        <ol className="list-decimal space-y-2 pl-5 leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li>
            <strong>Collecte</strong> — des robots de veille interrogent quotidiennement des flux RSS/Atom et une
            recherche documentaire, et déposent chaque trouvaille dans une file. Aujourd&apos;hui,{" "}
            {propositions.length} propositions y ont transité : {rejetees} écartées au tri, {enAttente} en attente
            de traitement.
          </li>
          <li>
            <strong>Proposition de patch</strong> — pour chaque item retenu au tri, un script rédige une
            modification de fiche sous forme de patch, sans jamais toucher au corpus lui-même.
          </li>
          <li>
            <strong>Relecture</strong> — un humain lit chaque patch et décide, un par un, ce qui est retenu.
          </li>
          <li>
            <strong>Publication</strong> — seuls les patchs retenus sont appliqués, par une commande lancée à la
            main ; le corpus est revalidé aussitôt après, et restauré intégralement si la validation échoue.
          </li>
          <li>
            <strong>Journalisation</strong> — chaque fiche modifiée par la veille laisse une entrée datée au{" "}
            <Link href="/veille" className="underline">
              changelog
            </Link>{" "}
            ({changelog.length} entrées à ce jour), pour que toute évolution du référentiel reste traçable après
            coup.
          </li>
        </ol>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Chaque proposition de la file porte aussi un <strong>score de fiabilité</strong>, calculé sur le{" "}
          <strong>domaine de la source</strong> qui l&apos;a publiée (une revue à comité de lecture ne note pas
          pareil qu&apos;un flux non identifié). Ce score dit d&apos;où vient une information, pas si elle est
          juste : {scoreEleve} des {propositions.length} propositions de la file dépassent aujourd&apos;hui le
          seuil de source primaire, et chacune reste soumise à la même relecture que les autres — un score élevé
          ne dispense de rien.
        </p>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Une question reste <strong>ouverte et non tranchée</strong> : une partie de ce cycle pourrait-elle
          s&apos;appliquer sans relecture humaine, pour les cas les plus mécaniques (un simple ajout de source
          datée, sur un domaine de confiance déjà établie) ? Aucune auto-validation n&apos;est codée aujourd&apos;hui
          — tant que la question n&apos;est pas tranchée, c&apos;est le statu quo qui s&apos;applique : toute
          proposition, quel que soit son score, passe par un humain.
        </p>
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
          La spécification complète du projet — mission, référentiels, méthodologie détaillée, plan de production — est
          versionnée dans <code className="font-mono text-xs">docs/megaprompt.md</code> et lisible en ligne sur la page{" "}
          <Link href="/megaprompt" className="underline">
            mégaprompt
          </Link>
          . Les données brutes sont exposées par l&apos;
          <a href="/api/meta" className="underline">
            API publique
          </a>
          .
        </p>
      </section>
    </div>
  );
}

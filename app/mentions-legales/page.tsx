import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Éditeur, hébergeur, propriété intellectuelle et conditions d'usage du référentiel ATLAS Humain × IA.",
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  return (
    <div className="max-w-3xl space-y-10 text-sm">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Mentions légales</h1>
        <p className="mt-3 leading-relaxed text-neutral-600 dark:text-neutral-400">
          {SITE_NAME} est un référentiel public. Cette page dit qui l&apos;édite, qui l&apos;héberge, et à quelles
          conditions son contenu peut être repris.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Éditeur</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          DYONYSOS, société par actions simplifiée unipersonnelle, 275 chemin de Miquelon, 64990 Mouguerre, France.
          SIREN 999 108 558. Directeur de la publication : Julien Daures. Contact :{" "}
          <a className="underline underline-offset-2" href="mailto:welcome@dyonysos.fr">
            welcome@dyonysos.fr
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Hébergement</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Les pages sont
          servies depuis son réseau de diffusion ; l&apos;emplacement exact du serveur qui répond dépend de la position
          du visiteur.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Ce que ce site est, et ce qu&apos;il n&apos;est pas</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          {SITE_NAME} documente des capacités humaines et des capacités de l&apos;intelligence artificielle, et les met
          en regard. Chaque affirmation est adossée à des sources datées et vérifiables, et la{" "}
          <Link className="underline underline-offset-2" href="/methodologie">
            page méthodologie
          </Link>{" "}
          expose comment les fiches sont écrites et ce qu&apos;elles ne prétendent pas établir.
        </p>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Ce n&apos;est ni un conseil professionnel, ni une expertise, ni une recommandation d&apos;investissement ou
          de choix technologique. Les niveaux de maturité, les scénarios prospectifs et les niveaux de confiance sont
          des lectures documentées à une date donnée, pas des prédictions.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Propriété intellectuelle et citation</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Les fiches sont rédigées par l&apos;éditeur. Les sources citées appartiennent à leurs auteurs et éditeurs
          respectifs : les liens renvoient vers les documents d&apos;origine, jamais vers une copie hébergée ici. Toute
          reprise d&apos;une fiche doit citer {SITE_NAME}, l&apos;URL de la fiche et sa date de dernière vérification —
          sans cette date, la citation perd ce qui la rend vérifiable.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Signaler une erreur</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Une affirmation mal sourcée, une source morte, une attribution erronée : écrire à{" "}
          <a className="underline underline-offset-2" href="mailto:welcome@dyonysos.fr">
            welcome@dyonysos.fr
          </a>{" "}
          en indiquant l&apos;URL de la fiche. Les corrections sont tracées dans le changelog du référentiel, et aucune
          fiche n&apos;est modifiée sans relecture humaine.
        </p>
      </section>

      <footer className="border-t border-neutral-200 pt-6 text-neutral-500 dark:border-neutral-800 dark:text-neutral-500">
        <p>
          Voir aussi la{" "}
          <Link className="underline underline-offset-2" href="/confidentialite">
            politique de confidentialité
          </Link>
          . URL canonique du site : {SITE_URL}.
        </p>
      </footer>
    </div>
  );
}

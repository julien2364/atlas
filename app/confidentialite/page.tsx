import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Quelles données ATLAS Humain × IA traite, pourquoi, combien de temps, et quels droits s'exercent — RGPD.",
  alternates: { canonical: "/confidentialite" },
};

export default function ConfidentialitePage() {
  return (
    <div className="max-w-3xl space-y-10 text-sm">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Politique de confidentialité</h1>
        <p className="mt-3 leading-relaxed text-neutral-600 dark:text-neutral-400">
          {SITE_NAME} est un site de consultation. Il ne demande aucun compte, aucune inscription, aucun formulaire.
          Cette page dit exactement ce qui est traité, et ce qui ne l&apos;est pas.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Ce que le site ne fait pas</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li>Aucun compte utilisateur, aucune inscription, aucun mot de passe.</li>
          <li>Aucun cookie déposé par le site, ni de mesure d&apos;audience, ni de traceur publicitaire.</li>
          <li>Aucun profilage, aucune décision automatisée produisant des effets à l&apos;égard d&apos;une personne.</li>
          <li>Aucune donnée revendue, louée ou transmise à un tiers à des fins commerciales.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Les questions posées au moteur de réponse</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          La page <Link className="underline underline-offset-2" href="/questions">questions</Link> permet
          d&apos;interroger le corpus. Le texte de la question est traité pour construire la réponse, puis mis en cache
          afin qu&apos;une question déjà posée ne soit pas recalculée. <strong>Ne pas y écrire de donnée
          personnelle</strong> : la question n&apos;a aucune raison d&apos;en contenir, et le cache la conserverait.
        </p>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Base légale : l&apos;intérêt légitime de l&apos;éditeur à faire fonctionner le service demandé
          (article 6.1.f du RGPD). Durée : la durée du cache, fixée à trente jours par défaut.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">La limitation de débit, et pourquoi elle ne vous identifie pas</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Le moteur de réponse limite le nombre de questions par minute, pour qu&apos;un robot ne le sature pas. Cela
          suppose de distinguer deux appelants — pas de savoir qui ils sont.
        </p>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          L&apos;adresse IP transmise par l&apos;hébergeur est donc <strong>hachée immédiatement avec un sel tiré au
          hasard au démarrage du serveur et jamais enregistré</strong>. Seule cette empreinte est gardée en mémoire, le
          temps d&apos;une fenêtre de quelques minutes. Elle n&apos;est écrite dans aucun fichier, dans aucun journal,
          dans aucune base. Personne — pas même l&apos;éditeur — ne peut en déduire une adresse, et le sel disparaît à
          chaque redéploiement. Base légale : intérêt légitime à protéger le service (article 6.1.f).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Ce que fait l&apos;hébergeur</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Vercel, qui sert les pages, tient ses propres journaux techniques de connexion, dont des adresses IP. Ce
          traitement relève de l&apos;hébergeur et de sa propre politique, et il est nécessaire au fonctionnement de
          tout site web. L&apos;éditeur n&apos;y ajoute aucune collecte.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Les personnes documentées par le référentiel</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Les fiches documentent des travaux — œuvres, théories, méthodes — à travers les personnes qui les ont
          produits. Les informations retenues sont celles qui concernent la contribution publique, tirées de sources
          publiées et citées. Aucune donnée de vie privée n&apos;y figure.
        </p>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Une personne documentée qui estime qu&apos;une fiche la concernant est inexacte, incomplète ou hors de
          propos peut écrire à{" "}
          <a className="underline underline-offset-2" href="mailto:welcome@dyonysos.fr">
            welcome@dyonysos.fr
          </a>
          . La demande est traitée sous un mois, et la suite donnée est tracée dans le changelog.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Vos droits</h2>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Accès, rectification, effacement, limitation, opposition : ces droits s&apos;exercent auprès de{" "}
          <a className="underline underline-offset-2" href="mailto:welcome@dyonysos.fr">
            welcome@dyonysos.fr
          </a>
          . En pratique, comme aucune donnée permettant de vous identifier n&apos;est conservée par le site, une demande
          d&apos;accès ou d&apos;effacement portant sur votre navigation n&apos;aura rien à rendre ni à supprimer — et
          c&apos;est le résultat recherché.
        </p>
        <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
          Une réclamation peut être adressée à la Commission nationale de l&apos;informatique et des libertés,
          3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07.
        </p>
      </section>

      <footer className="border-t border-neutral-200 pt-6 text-neutral-500 dark:border-neutral-800 dark:text-neutral-500">
        <p>
          Voir aussi les{" "}
          <Link className="underline underline-offset-2" href="/mentions-legales">
            mentions légales
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}

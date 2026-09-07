import type { Metadata } from "next";
import RechercheFiches from "@/components/RechercheFiches";
import QuestionsClient from "@/components/QuestionsClient";
import QuestionLibreClient from "@/components/QuestionLibreClient";
import questions from "@/data/seed/questions.json";
import { fichesGap, fichesHumaines, fichesIA } from "@/lib/corpus";
import type { Question } from "@/lib/types";

export const metadata: Metadata = {
  title: "Questions",
  description:
    `Poser une question au référentiel ATLAS, ou lire les ${questions.length} questions-tests permanentes. Chaque réponse est donnée sous plusieurs écoles de pensée, avec hypothèses, limites, sources et niveau de confiance.`,
  alternates: { canonical: "/questions" },
};

export default function QuestionsPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Questions</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Deux voies sur cette page. Le <strong>champ de question libre</strong> ci-dessous interroge le
          référentiel (moteur RAG, section 7.3 du mégaprompt) et construit une réponse en perspectives
          concurrentes, sourcée sur les fiches réellement mobilisées. Les{" "}
          <strong>questions-tests permanentes</strong> plus bas sont, elles, traitées manuellement : elles servent
          d&apos;étalon de qualité au moteur et ne bougent pas.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Format commun aux deux : plusieurs modèles/écoles sélectionnables, jamais un seul verdict (principe de
          neutralité active, page /methodologie) — hypothèses de départ, état actuel, réponse, justification,
          limites, sources et niveau de confiance pour chaque modèle.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          La recherche se fait dans un index versionné au dépôt, sans base de données et sans clé d&apos;API. La
          rédaction, elle, se fait au choix : par un fournisseur d&apos;API si une clé est configurée, par un
          aller-retour manuel avec le chat de votre choix, ou <strong>sans aucun modèle génératif</strong> — les
          perspectives sont alors composées directement depuis les champs des fiches. Le mode employé est écrit
          au-dessus de chaque réponse.
        </p>
      </header>

      <QuestionLibreClient
        effectifs={{ humaines: fichesHumaines.length, ia: fichesIA.length, gaps: fichesGap.length }}
      />

      <div>
        <h2 className="text-lg font-semibold">Rechercher une fiche</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Recherche par mots-clés dans tout le référentiel, sans passer par le moteur de réponse.
        </p>
        <div className="mt-3">
          <RechercheFiches />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Questions-tests permanentes</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Répondues à la main, rejouées à chaque mise à jour majeure pour vérifier que le moteur reste au moins
          aussi nuancé qu&apos;elles (cf. <code className="font-mono">scripts/comparer-qualite-rag.mjs</code>).
        </p>
        <div className="mt-4">
          <QuestionsClient questions={questions as Question[]} />
        </div>
      </div>
    </div>
  );
}

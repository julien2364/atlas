import RechercheFiches from "@/components/RechercheFiches";
import QuestionsClient from "@/components/QuestionsClient";
import questions from "@/data/seed/questions.json";
import type { Question } from "@/lib/types";

export default function QuestionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Questions</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Les questions-tests permanentes ci-dessous sont traitées manuellement, dans un format pluraliste
          (plusieurs modèles/écoles sélectionnables, jamais un seul verdict — cf. principe de neutralité active,
          page /methodologie) : hypothèses de départ, état actuel, réponse, justification, limites, sources et
          niveau de confiance pour chaque modèle. C&apos;est le gabarit qui alimentera le moteur RAG complet
          (section 7.3 du mégaprompt, Lot 6, en attente de la clé d&apos;embeddings). En attendant, la recherche
          ci-dessous permet d&apos;interroger automatiquement tout le référentiel, pas seulement ces questions.
        </p>
      </div>
      <RechercheFiches />
      <QuestionsClient questions={questions as Question[]} />
    </div>
  );
}

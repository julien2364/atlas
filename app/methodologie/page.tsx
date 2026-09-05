export default function MethodologiePage() {
  return (
    <div className="prose prose-neutral max-w-2xl space-y-6 text-sm dark:prose-invert">
      <h1 className="text-2xl font-semibold">Méthodologie et limites</h1>

      <section>
        <h2 className="text-lg font-medium">Principes</h2>
        <ul className="list-disc pl-5">
          <li>Neutralité active sur les sujets politiques/économiques/philosophiques contestés : plusieurs écoles présentées, jamais de verdict.</li>
          <li>Traçabilité systématique : chaque affirmation non triviale est sourcée et datée.</li>
          <li>Anti-obsolescence : chaque fiche porte un statut et une date de dernière vérification.</li>
          <li>Auto-extension : de nouvelles catégories sont créées quand un phénomène ne rentre dans aucune case existante.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Limites assumées</h2>
        <ul className="list-disc pl-5">
          <li>Le référentiel est en amorçage (Lot 1-2) : la majorité des fiches sont au statut « à documenter ».</li>
          <li>Le moteur de réponse prédictive (Q&amp;A) n&apos;est pas encore automatisé (RAG prévu Lot 6) — les réponses actuelles sont rédigées manuellement selon le même gabarit.</li>
          <li>Diffusion interne uniquement à ce stade — pas de mise en ligne publique décidée.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Document de référence</h2>
        <p>Le mégaprompt complet (mission, référentiels, méthodologie détaillée, plan de production) est versionné dans <code>docs/megaprompt.md</code>.</p>
      </section>
    </div>
  );
}

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
          <li>Le référentiel est en amorçage (Lot 1-2) : la majorité des fiches sont encore au statut « à documenter » — l&apos;enrichissement se poursuit lot après lot, sans coquilles vides ajoutées pour faire nombre.</li>
          <li>Le moteur de réponse prédictive (Q&amp;A) complet (RAG, Lot 6) est en attente d&apos;une décision d&apos;infrastructure (projet Supabase dédié ou mutualisé). En attendant, une recherche automatique en direct sur tout le référentiel est disponible sur la page <a href="/questions">Questions</a>.</li>
          <li>Diffusion publique depuis le 05/09/2026 (décision explicite de Julien) — le site n&apos;est plus en accès interne restreint.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Document de référence</h2>
        <p>
          Le mégaprompt complet (mission, référentiels, méthodologie détaillée, plan de production) est versionné dans <code>docs/megaprompt.md</code> et consultable en ligne sur la page{" "}
          <a href="/megaprompt" className="underline">mégaprompt</a>.
        </p>
      </section>
    </div>
  );
}

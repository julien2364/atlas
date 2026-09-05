const QUESTIONS = [
  {
    q: "Les modèles économiques mondiaux actuels sont-ils optimaux ? Quel modèle pourrait les surpasser ?",
    reponse: [
      "Pas de consensus empirique sur un modèle unique « optimal » : les économies de marché régulées (social-démocraties) obtiennent de bons résultats sur les indices de bien-être et de faible inégalité (pays nordiques), tandis que le capitalisme d'État chinois affiche la réduction de pauvreté la plus rapide de l'histoire récente sur des indicateurs différents.",
      "Les critiques structurées (économie du donut, MMT, économie de plateformes) proposent des alternatives partielles plutôt que des remplacements complets — chacune répond à un défaut spécifique (soutenabilité, marge de manœuvre budgétaire, rente numérique) sans consensus sur une synthèse.",
      "Voir les fiches 12.3 (modèles économiques) et la fiche de gap « Capitalisme d'État chinois × DeepSeek » dans le comparateur pour un exemple concret de lien modèle économique / trajectoire technologique.",
    ],
  },
  {
    q: "Quels futurs modèles de gouvernance nationale et mondiale sont plausibles ?",
    reponse: [
      "Le référentiel section 12.2 (33 modèles politiques) et 12.4 (gouvernance mondiale) servent de base ; la littérature actuelle documente une tension entre multipolarité croissante (montée du G20/BRICS+) et persistance des institutions multilatérales historiques (ONU, FMI, OMC) qui peinent à se réformer.",
      "Aucune réponse tranchée n'est fournie par ce moteur sur « quel modèle gagnera » — c'est un jugement de valeur/pari politique, pas un fait vérifiable (cf. principe de neutralité active, section 2).",
    ],
  },
  {
    q: "Comment comparer l'évolution du capitalisme, du communisme et du modèle chinois (capitalisme d'État) ?",
    reponse: [
      "Capitalisme (marché libre à régulé) : dominant depuis 1991, en tension interne entre versions libérale (US) et régulée (UE/Nordiques).",
      "Communisme / marxisme-léninisme : quasi disparu comme système économique d'État (à l'exception de variantes très hybrides), mais son appareil critique reste actif en sciences sociales (théorie critique, cf. philosophes Honneth/Negri en 12.1).",
      "Capitalisme d'État chinois : synthèse originale testée depuis les années 1980, dont la soutenabilité de long terme (dette, démographie, gouvernance) reste débattue plutôt que tranchée.",
    ],
  },
  {
    q: "Comment se comparent les référentiels psychologiques/philosophiques de Spinoza, Socrate, Aristote, la TCC et Nietzsche ?",
    reponse: [
      "Nietzsche est documenté dans le référentiel (voir /referentiel-humain, axe philosophique) : affirmation de la vie contre le ressentiment moral.",
      "Spinoza, Socrate, Aristote et la TCC ne sont pas encore dans le corpus fourni par Julien — à ajouter en Lot 2 (auto-extension du modèle, section 2.4) plutôt qu'ignorés.",
      "Piste de comparaison à documenter : Aristote (eudaimonia par la vertu et l'habitude) vs. Spinoza (béatitude par la connaissance rationnelle des affects) vs. Nietzsche (affirmation par la volonté de puissance) vs. TCC (restructuration cognitive empiriquement testée) — quatre théories du bien-vivre aux méthodes incompatibles (métaphysique vs. clinique), pas des évidences superposables.",
    ],
  },
];

export default function QuestionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Questions</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Le moteur RAG (section 7.3 du mégaprompt) n&apos;est pas encore branché (prévu Lot 6). Les 4 questions-tests
          permanentes sont traitées ici manuellement, dans le format imposé (synthèse pluraliste, sources, limites),
          pour valider la méthode avant automatisation.
        </p>
      </div>
      {QUESTIONS.map((item, i) => (
        <article key={i} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="font-medium">{item.q}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
            {item.reponse.map((r, j) => <li key={j}>{r}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

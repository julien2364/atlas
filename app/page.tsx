export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">ATLAS Humain × IA</h1>
        <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
          Un observatoire comparatif entre les capacités humaines (social, psychologique,
          philosophique, évolution, sérénité de l&apos;espèce) et les capacités de l&apos;IA
          actuelle (Claude/Cowork, Codex, DeepSeek…) poussée à l&apos;usage le plus avancé :
          sciences, éducation, recherche, industrie, pharmaceutique, gouvernement.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { href: "/referentiel-humain", titre: "Référentiel humain", desc: "5 axes : social, psychologique, philosophique, évolution, sérénité." },
          { href: "/referentiel-ia", titre: "Référentiel IA", desc: "Capacités génératives, agentiques, scientifiques, sectorielles, limites." },
          { href: "/comparateur", titre: "Comparateur de gap", desc: "Croiser une capacité humaine et une capacité IA : apport, mécanisme, substituabilité." },
          { href: "/questions", titre: "Questions", desc: "Moteur de réponse prédictive sur les sujets de fond (économie, gouvernance, écoles de pensée)." },
        ].map((c) => (
          <a key={c.href} href={c.href} className="rounded-lg border border-neutral-200 p-5 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
            <h2 className="font-medium">{c.titre}</h2>
            <p className="mt-1 text-sm text-neutral-500">{c.desc}</p>
          </a>
        ))}
      </div>

      <p className="text-xs text-neutral-400">
        Statut du projet : amorçage (Lot 1 — architecture — terminé). Voir /veille pour le changelog.
      </p>
    </div>
  );
}

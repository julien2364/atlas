import Link from "next/link";
import { derniereMiseAJourCorpus, formatDateFr } from "@/lib/corpus";

/* `brut` : route d'API, donc lien HTML classique — <Link> tenterait une
   navigation côté client vers une route qui ne rend pas de page. */
const LIENS: { href: string; label: string; brut?: boolean }[] = [
  { href: "/methodologie", label: "Méthodologie et limites" },
  { href: "/veille", label: "Veille et changelog" },
  { href: "/megaprompt", label: "Spécification du projet" },
  { href: "/api/meta", label: "API publique", brut: true },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-4 py-8 text-xs text-neutral-500 sm:px-6">
        <p className="max-w-md leading-relaxed">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">ATLAS Humain × IA</span> — observatoire
          comparatif de DYONYSOS. Référentiel vivant, sourcé et daté : dernière vérification enregistrée le{" "}
          <time dateTime={derniereMiseAJourCorpus}>{formatDateFr(derniereMiseAJourCorpus)}</time>.
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {LIENS.map((l) => (
            <li key={l.href}>
              {l.brut ? (
                <a href={l.href} className="underline decoration-neutral-400 underline-offset-2 hover:decoration-current">
                  {l.label}
                </a>
              ) : (
                <Link href={l.href} className="underline decoration-neutral-400 underline-offset-2 hover:decoration-current">
                  {l.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

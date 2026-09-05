import Link from "next/link";
import { SITE_MODE } from "@/lib/site-config";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/referentiel-humain", label: "Référentiel humain" },
  { href: "/referentiel-ia", label: "Référentiel IA" },
  { href: "/cartographie", label: "Cartographie" },
  { href: "/comparateur", label: "Comparateur" },
  { href: "/questions", label: "Questions" },
  { href: "/veille", label: "Veille" },
  { href: "/methodologie", label: "Méthodologie" },
];

export default function NavBar() {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          ATLAS <span className="text-neutral-400">Humain × IA</span>
        </Link>
        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
        {SITE_MODE === "internal" && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Usage interne
          </span>
        )}
      </div>
    </header>
  );
}

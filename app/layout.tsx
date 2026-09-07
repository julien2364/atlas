import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import SiteFooter from "@/components/SiteFooter";
import JsonLd from "@/components/JsonLd";
import { jsonLdSite } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_MODE, SITE_NAME, SITE_URL } from "@/lib/site-config";

const TITRE = "ATLAS Humain × IA — DYONYSOS";

export const metadata: Metadata = {
  // Base de résolution des URLs relatives (canonical, Open Graph) — MP-6.
  // Réglable via NEXT_PUBLIC_SITE_URL, cf. lib/site-config.ts et docs/api.md.
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITRE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "DYONYSOS" }],
  creator: "DYONYSOS",
  publisher: "DYONYSOS",
  // Le site ne demande l'indexation que s'il est explicitement en diffusion publique.
  robots:
    SITE_MODE === "public"
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "fr_FR",
    url: SITE_URL,
    title: TITRE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary", title: TITRE, description: SITE_DESCRIPTION },
  // L'icône vient de la convention de fichier app/icon.svg (SVG fait main,
  // reprise du vocabulaire du graphe : cercle = humain, carré = IA).
};

/**
 * Pose la classe de thème AVANT le premier rendu du contenu.
 * Ce script est délibérément écrit à la main, minifié, et placé en tout premier
 * enfant de <body> : le navigateur l'exécute avant de peindre quoi que ce soit
 * du document, donc pas de flash de thème clair à l'ouverture d'une page en
 * mode sombre. Il est volontairement enveloppé d'un try/catch : en navigation
 * privée stricte, `localStorage` peut lever, et le site doit rester affiché.
 */
// La clé est répétée en dur plutôt qu'importée de components/BasculeTheme.tsx :
// dans un Server Component, tous les exports d'un module "use client" sont des
// références client, pas les valeurs elles-mêmes. Garder les deux en phase.
const SCRIPT_THEME = `(function(){try{var c=localStorage.getItem("atlas-theme");var s=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=c==="sombre"||((c===null||c==="systeme")&&s);var r=document.documentElement;if(d){r.classList.add("dark");}r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning : le script ci-dessous modifie la classe et le
    // style de <html> avant l'hydratation ; React ne doit pas s'en émouvoir.
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
        <a href="#contenu" className="lien-evitement">
          Aller au contenu
        </a>
        <JsonLd donnees={jsonLdSite()} />
        <NavBar />
        <main id="contenu" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}

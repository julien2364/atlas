import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import SiteFooter from "@/components/SiteFooter";
import JsonLd from "@/components/JsonLd";
import { jsonLdSite } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_MODE, SITE_NAME, SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  // Base de résolution des URLs relatives (canonical, Open Graph) — MP-6.
  // Réglable via NEXT_PUBLIC_SITE_URL, cf. lib/site-config.ts et docs/api.md.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ATLAS — Humain × IA",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
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
    title: "ATLAS — Humain × IA",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <JsonLd donnees={jsonLdSite()} />
        <NavBar />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

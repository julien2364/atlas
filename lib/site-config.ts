// Mode de diffusion du site — cf. megaprompt v1.1, section 13.2 et section 10.
// "internal" = accès restreint (usage interne Julien), "public" = ouverture publique décidée explicitement.
export const SITE_MODE: "internal" | "public" =
  (process.env.NEXT_PUBLIC_SITE_MODE as "internal" | "public") ?? "internal";

// Nom canonique du site, réutilisé dans les métadonnées et le JSON-LD.
export const SITE_NAME = "ATLAS Humain × IA";

export const SITE_DESCRIPTION =
  "Observatoire comparatif des capacités humaines et des capacités de l'intelligence artificielle : référentiel sourcé, daté et versionné.";

// URL de base utilisée pour les canonicals, le sitemap, le JSON-LD et l'API publique.
// Réglage : variable d'environnement NEXT_PUBLIC_SITE_URL (à définir dans le projet Vercel
// et dans .env.local pour un domaine propre). Repli sur le déploiement Vercel courant.
// Cf. docs/api.md § « Configuration de l'URL de base ».
const SITE_URL_DEFAUT = "https://atlas-humain-ia-dyonysos.vercel.app";

export const SITE_URL: string = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL_DEFAUT).replace(/\/+$/, "");

/** Transforme un chemin interne ("/fiche/humaine/x") en URL absolue. */
export function urlAbsolue(chemin: string): string {
  return `${SITE_URL}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}

import type { JsonLdObjet } from "@/lib/seo";

/**
 * Injecte un bloc JSON-LD (schema.org). Server Component : le script est écrit
 * dans le HTML statique généré au build, donc lisible par les crawlers sans JS.
 */
export default function JsonLd({ donnees }: { donnees: JsonLdObjet | JsonLdObjet[] }) {
  const json = JSON.stringify(donnees).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

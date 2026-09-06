// robots.txt généré. Le mode de diffusion fait foi : tant que NEXT_PUBLIC_SITE_MODE
// n'est pas "public", le site demande à ne pas être indexé (cf. megaprompt v1.1, 13.2).

import type { MetadataRoute } from "next";
import { SITE_MODE, SITE_URL, urlAbsolue } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  if (SITE_MODE !== "public") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // L'API reste publique et documentée, mais n'a pas vocation à consommer
        // du budget de crawl : les mêmes contenus sont indexables en HTML.
        disallow: ["/api/"],
      },
    ],
    sitemap: urlAbsolue("/sitemap.xml"),
    host: SITE_URL,
  };
}

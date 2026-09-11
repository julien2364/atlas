// Sitemap généré depuis le corpus (MP-6) : les ~400 pages de fiche sont ainsi
// découvrables individuellement, condition pour que le site fonctionne comme actif
// de référencement (cf. docs/megaprompt.md, recommandation 11.2).
//
// L'URL de base vient de NEXT_PUBLIC_SITE_URL (repli : déploiement Vercel courant),
// cf. lib/site-config.ts et docs/api.md.

import type { MetadataRoute } from "next";
import {
  cheminFicheHumaine,
  cheminFicheIA,
  cheminGap,
  derniereMiseAJourCorpus,
  fichesGap,
  fichesHumaines,
  fichesIA,
} from "@/lib/corpus";
import { urlAbsolue } from "@/lib/site-config";

type Entree = MetadataRoute.Sitemap[number];

const PAGES_STATIQUES: { chemin: string; priorite: number }[] = [
  { chemin: "/", priorite: 1 },
  { chemin: "/referentiel-humain", priorite: 0.9 },
  { chemin: "/referentiel-ia", priorite: 0.9 },
  { chemin: "/comparateur", priorite: 0.8 },
  { chemin: "/cartographie", priorite: 0.8 },
  { chemin: "/questions", priorite: 0.7 },
  { chemin: "/veille", priorite: 0.5 },
  { chemin: "/methodologie", priorite: 0.5 },
  { chemin: "/mentions-legales", priorite: 0.2 },
  { chemin: "/confidentialite", priorite: 0.2 },
  { chemin: "/megaprompt", priorite: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const statiques = PAGES_STATIQUES.map(
    (page): Entree => ({
      url: urlAbsolue(page.chemin),
      lastModified: derniereMiseAJourCorpus,
      changeFrequency: "weekly",
      priority: page.priorite,
    })
  );

  const humaines = fichesHumaines.map(
    (fiche): Entree => ({
      url: urlAbsolue(cheminFicheHumaine(fiche.id)),
      lastModified: fiche.derniere_verification,
      changeFrequency: "monthly",
      priority: 0.7,
    })
  );

  const ia = fichesIA.map(
    (fiche): Entree => ({
      url: urlAbsolue(cheminFicheIA(fiche.id)),
      lastModified: fiche.derniere_verification,
      changeFrequency: "monthly",
      priority: 0.7,
    })
  );

  const gaps = fichesGap.map(
    (gap): Entree => ({
      url: urlAbsolue(cheminGap(gap.id)),
      lastModified: gap.derniere_verification,
      changeFrequency: "monthly",
      priority: 0.6,
    })
  );

  return [...statiques, ...humaines, ...ia, ...gaps];
}

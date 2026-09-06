// Constructeurs de JSON-LD (schema.org) pour les pages de fiche — MP-6.
//
// Choix de type : Article plutôt que DefinedTerm comme entité principale, parce que
// `citation` n'est valide que sur un CreativeWork (DefinedTerm est un Intangible).
// La dimension « terme du référentiel » est conservée via la propriété `about`,
// qui porte bien un DefinedTerm rattaché à son DefinedTermSet.

import type { FicheGap, FicheHumaine, FicheIA, Source } from "@/lib/types";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, urlAbsolue } from "@/lib/site-config";
import {
  cheminFicheHumaine,
  cheminFicheIA,
  cheminGap,
  descriptionFicheHumaine,
  descriptionFicheIA,
  descriptionGap,
  libelleAxeHumain,
  libelleAxeIA,
  libelleSousDomaine,
  libelleStatut,
  titreGap,
} from "@/lib/corpus";

export type JsonLdObjet = Record<string, unknown>;

export interface ElementAriane {
  nom: string;
  href: string;
}

/** Retire les clés vides pour ne pas publier de JSON-LD avec des valeurs nulles. */
function sansVides(objet: JsonLdObjet): JsonLdObjet {
  const resultat: JsonLdObjet = {};
  for (const [cle, valeur] of Object.entries(objet)) {
    if (valeur === undefined || valeur === null || valeur === "") continue;
    if (Array.isArray(valeur) && valeur.length === 0) continue;
    resultat[cle] = valeur;
  }
  return resultat;
}

const EDITEUR: JsonLdObjet = {
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
};

const SITE: JsonLdObjet = {
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
};

/** Sources → tableau `citation` (CreativeWork). */
function citations(sources: Source[] | undefined): JsonLdObjet[] {
  if (!sources || sources.length === 0) return [];
  return sources.map((source) =>
    sansVides({
      "@type": "CreativeWork",
      name: source.titre,
      url: source.url,
      datePublished: source.date,
      // « primaire » / « secondaire » : qualification interne du référentiel.
      genre: source.type === "primaire" ? "source primaire" : "source secondaire",
    })
  );
}

function articleDeBase(params: {
  url: string;
  titre: string;
  description: string;
  dateModification: string;
  section: string;
  motsCles: string[];
  sources: Source[];
  termeDefini: JsonLdObjet;
}): JsonLdObjet {
  return sansVides({
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${params.url}#article`,
    url: params.url,
    headline: params.titre,
    name: params.titre,
    description: params.description,
    inLanguage: "fr",
    isAccessibleForFree: true,
    datePublished: params.dateModification,
    dateModified: params.dateModification,
    articleSection: params.section,
    keywords: params.motsCles.filter(Boolean),
    mainEntityOfPage: { "@type": "WebPage", "@id": params.url },
    isPartOf: SITE,
    author: EDITEUR,
    publisher: EDITEUR,
    about: params.termeDefini,
    citation: citations(params.sources),
  });
}

export function jsonLdFicheHumaine(fiche: FicheHumaine): JsonLdObjet {
  const url = urlAbsolue(cheminFicheHumaine(fiche.id));
  return articleDeBase({
    url,
    titre: fiche.nom,
    description: descriptionFicheHumaine(fiche),
    dateModification: fiche.derniere_verification,
    section: libelleAxeHumain(fiche.axe),
    motsCles: [
      fiche.nom,
      libelleAxeHumain(fiche.axe),
      libelleSousDomaine(fiche.sous_domaine),
      "capacité humaine",
      libelleStatut(fiche.statut),
    ],
    sources: fiche.sources,
    termeDefini: sansVides({
      "@type": "DefinedTerm",
      name: fiche.nom,
      description: fiche.these_centrale,
      termCode: fiche.id,
      url,
      inDefinedTermSet: {
        "@type": "DefinedTermSet",
        name: "ATLAS — Référentiel A, capacités humaines",
        url: urlAbsolue("/referentiel-humain"),
      },
    }),
  });
}

export function jsonLdFicheIA(fiche: FicheIA): JsonLdObjet {
  const url = urlAbsolue(cheminFicheIA(fiche.id));
  const sourcesUsages = fiche.usages.flatMap((usage) => usage.sources ?? []);
  return articleDeBase({
    url,
    titre: fiche.nom,
    description: descriptionFicheIA(fiche),
    dateModification: fiche.derniere_verification,
    section: libelleAxeIA(fiche.axe),
    motsCles: [fiche.nom, fiche.editeur ?? "", libelleAxeIA(fiche.axe), "capacité IA", ...fiche.capacites_cles],
    sources: [...fiche.sources, ...sourcesUsages],
    termeDefini: sansVides({
      "@type": "DefinedTerm",
      name: fiche.nom,
      description: fiche.capacites_cles.join(" · ") || fiche.limites_connues,
      termCode: fiche.id,
      url,
      inDefinedTermSet: {
        "@type": "DefinedTermSet",
        name: "ATLAS — Référentiel B, capacités IA",
        url: urlAbsolue("/referentiel-ia"),
      },
    }),
  });
}

export function jsonLdGap(gap: FicheGap): JsonLdObjet {
  const url = urlAbsolue(cheminGap(gap.id));
  const titre = titreGap(gap);
  return articleDeBase({
    url,
    titre: `Gap analysis — ${titre}`,
    description: descriptionGap(gap),
    dateModification: gap.derniere_verification,
    section: "Gap analysis",
    motsCles: [titre, gap.sujet ?? "", "gap analysis", "substituabilité", ...(gap.sous_themes ?? [])],
    sources: gap.documents_cles ?? [],
    termeDefini: sansVides({
      "@type": "DefinedTerm",
      name: titre,
      description: gap.apport_ia,
      termCode: gap.id,
      url,
      inDefinedTermSet: {
        "@type": "DefinedTermSet",
        name: "ATLAS — Gap analysis humain × IA",
        url: urlAbsolue("/comparateur"),
      },
    }),
  });
}

/** Fil d'Ariane en BreadcrumbList — doublon structuré du fil d'Ariane visible. */
export function jsonLdFilAriane(elements: ElementAriane[]): JsonLdObjet {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: elements.map((element, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: element.nom,
      item: urlAbsolue(element.href),
    })),
  };
}

/** JSON-LD global du site, injecté par le layout racine. */
export function jsonLdSite(): JsonLdObjet {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#site`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "fr",
    publisher: EDITEUR,
  };
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { BadgeStatut, Bloc, CarteLien, DateVerification, Etiquette, FilAriane, ListeSources } from "@/components/FicheUI";
import {
  cheminApiFiche,
  cheminFicheHumaine,
  cheminFicheIA,
  cheminGap,
  connexesHumaines,
  descriptionFicheHumaine,
  fichesHumaines,
  gapsDeFicheHumaine,
  getFicheHumaine,
  getFicheIA,
  libelleAxeHumain,
  libelleSousDomaine,
} from "@/lib/corpus";
import { jsonLdFicheHumaine, jsonLdFilAriane, type ElementAriane } from "@/lib/seo";
import { SITE_NAME, urlAbsolue } from "@/lib/site-config";

// 267 pages pré-générées ; tout identifiant hors corpus renvoie un 404 réel (pas de soft-404).
export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return fichesHumaines.map((fiche) => ({ id: fiche.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fiche = getFicheHumaine(id);
  if (!fiche) return { title: "Fiche introuvable" };

  const chemin = cheminFicheHumaine(fiche.id);
  const description = descriptionFicheHumaine(fiche);
  return {
    title: `${fiche.nom} — capacité humaine`,
    description,
    alternates: { canonical: chemin },
    openGraph: {
      type: "article",
      title: `${fiche.nom} — capacité humaine | ${SITE_NAME}`,
      description,
      url: urlAbsolue(chemin),
      siteName: SITE_NAME,
      locale: "fr_FR",
      modifiedTime: fiche.derniere_verification,
    },
    twitter: { card: "summary", title: fiche.nom, description },
  };
}

export default async function PageFicheHumaine({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fiche = getFicheHumaine(id);
  if (!fiche) notFound();

  const axeLibelle = libelleAxeHumain(fiche.axe);
  const gaps = gapsDeFicheHumaine(fiche.id);
  const connexes = connexesHumaines(fiche);

  const ariane: ElementAriane[] = [
    { nom: "Accueil", href: "/" },
    { nom: "Référentiel humain", href: "/referentiel-humain" },
    { nom: axeLibelle, href: `/referentiel-humain#axe-${fiche.axe}` },
    { nom: fiche.nom, href: cheminFicheHumaine(fiche.id) },
  ];

  return (
    <article className="space-y-8">
      <JsonLd donnees={[jsonLdFicheHumaine(fiche), jsonLdFilAriane(ariane)]} />
      <FilAriane elements={ariane} />

      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Référentiel A — capacité humaine</p>
        <h1 className="text-2xl font-semibold tracking-tight">{fiche.nom}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Etiquette>{axeLibelle}</Etiquette>
          <Etiquette>{libelleSousDomaine(fiche.sous_domaine)}</Etiquette>
          {fiche.periode_courant ? <Etiquette>{fiche.periode_courant}</Etiquette> : null}
          <BadgeStatut statut={fiche.statut} />
          <DateVerification date={fiche.derniere_verification} />
        </div>
      </header>

      <Bloc titre="Thèse centrale">
        <p>{fiche.these_centrale}</p>
      </Bloc>

      <Bloc titre="Apport">
        <p>{fiche.apport}</p>
      </Bloc>

      <Bloc titre="Limites et critiques">
        <p>{fiche.limites_critiques}</p>
      </Bloc>

      {fiche.resonance_ia ? (
        <Bloc titre="Résonance avec l'IA">
          <p>{fiche.resonance_ia}</p>
        </Bloc>
      ) : null}

      <Bloc titre="Sources" id="sources">
        <ListeSources sources={fiche.sources ?? []} />
      </Bloc>

      <Bloc titre="Analyses de gap citant cette fiche">
        {gaps.length === 0 ? (
          <p className="text-neutral-500">
            Aucune paire humain × IA documentée pour cette capacité à ce jour. Le{" "}
            <Link href="/comparateur" className="underline">
              comparateur
            </Link>{" "}
            permet de tester la combinaison et affiche son statut réel.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {gaps.map((gap) => {
              const ia = getFicheIA(gap.fiche_ia_id);
              return (
                <li key={gap.id} className="space-y-1">
                  <CarteLien
                    href={cheminGap(gap.id)}
                    titre={`${fiche.nom} × ${ia?.nom ?? gap.fiche_ia_id}`}
                    sousTitre={gap.sujet}
                  />
                  {ia ? (
                    <p className="text-xs text-neutral-500">
                      Fiche IA :{" "}
                      <Link href={cheminFicheIA(ia.id)} className="underline">
                        {ia.nom}
                      </Link>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Bloc>

      <Bloc titre={`Fiches connexes — ${libelleSousDomaine(fiche.sous_domaine)}`}>
        {connexes.length === 0 ? (
          <p className="text-neutral-500">Aucune autre fiche dans ce sous-domaine.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {connexes.map((connexe) => (
              <li key={connexe.id}>
                <CarteLien
                  href={cheminFicheHumaine(connexe.id)}
                  titre={connexe.nom}
                  sousTitre={`${libelleAxeHumain(connexe.axe)} · ${libelleSousDomaine(connexe.sous_domaine)}`}
                />
              </li>
            ))}
          </ul>
        )}
      </Bloc>

      <p className="border-t border-neutral-200 pt-4 text-xs text-neutral-500 dark:border-neutral-800">
        Données brutes de cette fiche :{" "}
        <a href={cheminApiFiche(fiche.id)} className="underline">
          {cheminApiFiche(fiche.id)}
        </a>{" "}
        — voir la <Link href="/methodologie" className="underline">méthodologie</Link>.
      </p>
    </article>
  );
}

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
  connexesIA,
  descriptionFicheIA,
  fichesIA,
  gapsDeFicheIA,
  getFicheHumaine,
  getFicheIA,
  LABELS_DIFFUSION,
  LABELS_SECTEUR,
  libelleAxeIA,
} from "@/lib/corpus";
import { jsonLdFicheIA, jsonLdFilAriane, type ElementAriane } from "@/lib/seo";
import { SITE_NAME, urlAbsolue } from "@/lib/site-config";

// 44 pages pré-générées ; tout identifiant hors corpus renvoie un 404 réel.
export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return fichesIA.map((fiche) => ({ id: fiche.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const fiche = getFicheIA(id);
  if (!fiche) return { title: "Fiche introuvable" };

  const chemin = cheminFicheIA(fiche.id);
  const description = descriptionFicheIA(fiche);
  return {
    title: `${fiche.nom} — capacité IA`,
    description,
    alternates: { canonical: chemin },
    openGraph: {
      type: "article",
      title: `${fiche.nom} — capacité IA | ${SITE_NAME}`,
      description,
      url: urlAbsolue(chemin),
      siteName: SITE_NAME,
      locale: "fr_FR",
      modifiedTime: fiche.derniere_verification,
    },
    twitter: { card: "summary", title: fiche.nom, description },
  };
}

export default async function PageFicheIA({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fiche = getFicheIA(id);
  if (!fiche) notFound();

  const axeLibelle = libelleAxeIA(fiche.axe);
  const gaps = gapsDeFicheIA(fiche.id);
  const connexes = connexesIA(fiche);
  const usages = fiche.usages ?? [];

  const ariane: ElementAriane[] = [
    { nom: "Accueil", href: "/" },
    { nom: "Référentiel IA", href: "/referentiel-ia" },
    { nom: axeLibelle, href: `/referentiel-ia#axe-${fiche.axe}` },
    { nom: fiche.nom, href: cheminFicheIA(fiche.id) },
  ];

  return (
    <article className="space-y-8">
      <JsonLd donnees={[jsonLdFicheIA(fiche), jsonLdFilAriane(ariane)]} />
      <FilAriane elements={ariane} />

      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Référentiel B — capacité IA</p>
        <h1 className="text-2xl font-semibold tracking-tight">{fiche.nom}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Etiquette>{axeLibelle}</Etiquette>
          {fiche.editeur ? <Etiquette>{fiche.editeur}</Etiquette> : null}
          <BadgeStatut statut={fiche.statut} />
          <DateVerification date={fiche.derniere_verification} />
        </div>
      </header>

      {fiche.architecture ? (
        <Bloc titre="Architecture">
          <p>{fiche.architecture}</p>
        </Bloc>
      ) : null}

      <Bloc titre="Capacités clés">
        {fiche.capacites_cles.length === 0 ? (
          <p className="text-neutral-500">Non renseignées.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {fiche.capacites_cles.map((capacite, index) => (
              <li key={index}>{capacite}</li>
            ))}
          </ul>
        )}
      </Bloc>

      <Bloc titre="Usages documentés par secteur">
        {usages.length === 0 ? (
          <p className="text-neutral-500">Aucun usage sectoriel documenté à ce jour.</p>
        ) : (
          <div className="space-y-4">
            {usages.map((usage, index) => (
              <div key={`${usage.secteur}-${index}`} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {LABELS_SECTEUR[usage.secteur] ?? usage.secteur}
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-normal text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {typeof usage.trl === "number" ? `TRL ${usage.trl} / 9` : "TRL non déterminable"}
                  </span>
                  {usage.diffusion ? (
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-[11px] font-normal text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                      {LABELS_DIFFUSION[usage.diffusion]}
                    </span>
                  ) : null}
                </h3>
                {usage.trl_justification ? (
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{usage.trl_justification}</p>
                ) : null}
                <p className="mt-2">{usage.description}</p>
                {usage.exemples && usage.exemples.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-600 dark:text-neutral-400">
                    {usage.exemples.map((exemple, i) => (
                      <li key={i}>{exemple}</li>
                    ))}
                  </ul>
                ) : null}
                {usage.sources && usage.sources.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sources de cet usage</p>
                    <div className="mt-2">
                      <ListeSources sources={usage.sources} />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Bloc>

      <Bloc titre="Limites connues">
        <p>{fiche.limites_connues}</p>
      </Bloc>

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
              const humaine = getFicheHumaine(gap.fiche_humaine_id);
              return (
                <li key={gap.id} className="space-y-1">
                  <CarteLien
                    href={cheminGap(gap.id)}
                    titre={`${humaine?.nom ?? gap.fiche_humaine_id} × ${fiche.nom}`}
                    sousTitre={gap.sujet}
                  />
                  {humaine ? (
                    <p className="text-xs text-neutral-500">
                      Fiche humaine :{" "}
                      <Link href={cheminFicheHumaine(humaine.id)} className="underline">
                        {humaine.nom}
                      </Link>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Bloc>

      <Bloc titre={`Fiches connexes — ${axeLibelle}`}>
        {connexes.length === 0 ? (
          <p className="text-neutral-500">Aucune autre fiche sur cet axe.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {connexes.map((connexe) => (
              <li key={connexe.id}>
                <CarteLien href={cheminFicheIA(connexe.id)} titre={connexe.nom} sousTitre={connexe.editeur} />
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

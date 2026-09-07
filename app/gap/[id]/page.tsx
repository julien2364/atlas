import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { BadgeStatut, Bloc, CarteLien, DateVerification, Etiquette, FilAriane, ListeSources } from "@/components/FicheUI";
import { BadgeConfiance, BadgeSubstituabilite } from "@/components/Badges";
import {
  cheminApiGap,
  cheminFicheHumaine,
  cheminFicheIA,
  cheminGap,
  descriptionGap,
  fichesGap,
  getFicheGap,
  getFicheHumaine,
  getFicheIA,
  LABELS_CONFIANCE_GAP,
  libelleAxeHumain,
  libelleAxeIA,
  titreGap,
} from "@/lib/corpus";
import { jsonLdFilAriane, jsonLdGap, type ElementAriane } from "@/lib/seo";
import { SITE_NAME, urlAbsolue } from "@/lib/site-config";

// Une page pré-générée par analyse de gap ; tout identifiant hors corpus renvoie un 404 réel.
export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return fichesGap.map((gap) => ({ id: gap.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const gap = getFicheGap(id);
  if (!gap) return { title: "Analyse de gap introuvable" };

  const chemin = cheminGap(gap.id);
  const description = descriptionGap(gap);
  const titre = `${titreGap(gap)} — analyse de gap`;
  return {
    title: titre,
    description,
    alternates: { canonical: chemin },
    openGraph: {
      type: "article",
      title: `${titre} | ${SITE_NAME}`,
      description,
      url: urlAbsolue(chemin),
      siteName: SITE_NAME,
      locale: "fr_FR",
      modifiedTime: gap.derniere_verification,
    },
    twitter: { card: "summary", title: titreGap(gap), description },
  };
}

export default async function PageGap({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gap = getFicheGap(id);
  if (!gap) notFound();

  const humaine = getFicheHumaine(gap.fiche_humaine_id);
  const ia = getFicheIA(gap.fiche_ia_id);
  const titre = titreGap(gap);

  const ariane: ElementAriane[] = [
    { nom: "Accueil", href: "/" },
    { nom: "Comparateur", href: "/comparateur" },
    { nom: titre, href: cheminGap(gap.id) },
  ];

  return (
    <article className="space-y-8">
      <JsonLd donnees={[jsonLdGap(gap), jsonLdFilAriane(ariane)]} />
      <FilAriane elements={ariane} />

      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Gap analysis — capacité humaine × capacité IA</p>
        <h1 className="text-2xl font-semibold tracking-tight">{titre}</h1>
        {gap.sujet ? <p className="text-sm text-neutral-500">{gap.sujet}</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <BadgeSubstituabilite valeur={gap.substituabilite} />
          <Etiquette>Confiance {LABELS_CONFIANCE_GAP[gap.confiance] ?? gap.confiance}</Etiquette>
          <BadgeStatut statut={gap.statut} />
          <DateVerification date={gap.derniere_verification} />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <h2 className="sr-only">Fiches comparées</h2>
        {humaine ? (
          <CarteLien
            href={cheminFicheHumaine(humaine.id)}
            titre={humaine.nom}
            sousTitre={`Capacité humaine · ${libelleAxeHumain(humaine.axe)}`}
          />
        ) : null}
        {ia ? (
          <CarteLien
            href={cheminFicheIA(ia.id)}
            titre={ia.nom}
            sousTitre={`Capacité IA · ${libelleAxeIA(ia.axe)}`}
          />
        ) : null}
      </section>

      <Bloc titre="Apport de l'IA">
        <p>{gap.apport_ia}</p>
      </Bloc>

      <Bloc titre="Mécanisme">
        <p>{gap.mecanisme}</p>
      </Bloc>

      <Bloc titre="Comment faire mieux">
        <p>{gap.amelioration_possible}</p>
      </Bloc>

      <Bloc titre="Mode d'interaction recommandé">
        <p>{gap.mode_interaction}</p>
      </Bloc>

      <Bloc titre="Substituabilité">
        <p className="flex flex-wrap items-center gap-2">
          <BadgeSubstituabilite valeur={gap.substituabilite} />
          {gap.technologie_complementaire ? <span>{gap.technologie_complementaire}</span> : null}
        </p>
      </Bloc>

      <Bloc titre="Scénarios temporels">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Présent</h3>
            <p className="mt-1">{gap.scenario_present}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">+5 ans</h3>
            <p className="mt-1">{gap.scenario_5ans}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">+15/20 ans</h3>
            <p className="mt-1">{gap.scenario_15_20ans}</p>
          </div>
        </div>
      </Bloc>

      {gap.axes_prospectifs && gap.axes_prospectifs.length > 0 ? (
        <Bloc titre="Axes possibles (perspectives, pas des prédictions tranchées)">
          <div className="space-y-2">
            {gap.axes_prospectifs.map((axe, index) => (
              <div key={index} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{axe.nom}</h3>
                  <BadgeConfiance niveau={axe.niveau_confiance} />
                </div>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">{axe.description}</p>
              </div>
            ))}
          </div>
        </Bloc>
      ) : null}

      {(gap.sous_themes && gap.sous_themes.length > 0) || (gap.axes_recherche && gap.axes_recherche.length > 0) ? (
        <Bloc titre="Sous-thèmes et axes de recherche">
          <div className="grid gap-4 sm:grid-cols-2">
            {gap.sous_themes && gap.sous_themes.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sous-thèmes</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {gap.sous_themes.map((theme, index) => (
                    <li key={index}>{theme}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {gap.axes_recherche && gap.axes_recherche.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Axes de recherche</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {gap.axes_recherche.map((axe, index) => (
                    <li key={index}>{axe}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Bloc>
      ) : null}

      <Bloc titre="Documents clés" id="sources">
        <ListeSources sources={gap.documents_cles ?? []} />
      </Bloc>

      <p className="border-t border-neutral-200 pt-4 text-xs text-neutral-500 dark:border-neutral-800">
        Données brutes de cette analyse :{" "}
        <a href={cheminApiGap(gap.id)} className="underline">
          {cheminApiGap(gap.id)}
        </a>{" "}
        — méthode de comparaison détaillée dans la{" "}
        <Link href="/methodologie" className="underline">
          méthodologie
        </Link>
        .
      </p>
    </article>
  );
}

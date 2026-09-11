// Toutes les oppositions que le référentiel documente, sur une page.
//
// Le corpus contient des désaccords écrits — une fiche qui en nomme une autre
// dans ses limites critiques, avec une marque d'opposition — mais ils étaient
// enfouis un par un dans 636 fiches. Cette page les sort et les met en liste :
// c'est l'index éditorial du référentiel, et le point d'entrée pour qui cherche
// un sujet plutôt qu'une définition.
//
// Une controverse n'apparaît ici que si une PHRASE du corpus l'établit. La
// phrase est affichée. Rien n'est déduit d'un calcul de proximité.

import type { Metadata } from "next";
import Link from "next/link";
import graphe from "@/data/relations-corpus.json";
import { cheminFicheHumaine, cheminFicheIA, getFicheHumaine, getFicheIA, libelleAxeHumain } from "@/lib/corpus";

export const metadata: Metadata = {
  title: "Controverses documentées",
  description:
    "Les désaccords que le référentiel ATLAS documente nommément : une fiche qui en met une autre en cause, la " +
    "phrase du corpus qui l'établit, et les deux thèses en regard. Index éditorial du référentiel.",
  alternates: { canonical: "/controverses" },
};

interface RelationBrute {
  type: string;
  de: { type: string; id: string };
  vers: { type: string; id: string };
  champ: string;
  preuve: string;
}

interface Bout {
  href: string | null;
  nom: string;
  these: string;
  axe: string;
}

function resoudre(ref: { type: string; id: string }): Bout | null {
  if (ref.type === "humaine") {
    const f = getFicheHumaine(ref.id);
    if (!f) return null;
    return {
      href: cheminFicheHumaine(f.id),
      nom: f.nom,
      these: f.these_centrale ?? "",
      axe: libelleAxeHumain(f.axe),
    };
  }
  if (ref.type === "ia") {
    const f = getFicheIA(ref.id);
    if (!f) return null;
    return {
      href: cheminFicheIA(f.id),
      nom: f.nom,
      these: (f.capacites_cles ?? []).join(" ; "),
      axe: "Référentiel B — capacité IA",
    };
  }
  return null;
}

export default function PageControverses() {
  const relations = (graphe as unknown as { relations: RelationBrute[]; genere_le: string }).relations;
  const genereLe = (graphe as unknown as { genere_le: string }).genere_le;

  // Dédoublonnage par paire non orientée : A conteste B et B conteste A sont
  // une seule controverse, pas deux.
  const vues = new Set<string>();
  const controverses: { cle: string; a: Bout; b: Bout; preuve: string }[] = [];
  for (const r of relations) {
    if (r.type !== "conteste") continue;
    const cle = [`${r.de.type}:${r.de.id}`, `${r.vers.type}:${r.vers.id}`].sort().join("|");
    if (vues.has(cle)) continue;
    const a = resoudre(r.de);
    const b = resoudre(r.vers);
    if (!a || !b) continue;
    vues.add(cle);
    controverses.push({ cle, a, b, preuve: r.preuve });
  }

  const parAxe = new Map<string, typeof controverses>();
  for (const c of controverses) {
    if (!parAxe.has(c.a.axe)) parAxe.set(c.a.axe, []);
    parAxe.get(c.a.axe)!.push(c);
  }
  const axes = [...parAxe.entries()].sort((x, y) => y[1].length - x[1].length);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Controverses documentées</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {controverses.length} désaccords que le référentiel établit nommément : une fiche met une autre en cause
          dans son champ « limites critiques », et la phrase qui le dit est citée sous chaque paire. Aucune
          controverse n&apos;est ici parce qu&apos;un calcul a rapproché deux textes — chacune tient sur une phrase
          écrite dans une fiche. Graphe tissé le {genereLe}.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Ce que cette page ne dit pas : qui a raison. Elle montre où le débat se tient et permet d&apos;aller lire
          les deux fiches. Ce qu&apos;elle rate : deux positions qui s&apos;opposent sans se nommer restent
          invisibles l&apos;une à l&apos;autre — la détection ne lit que les mentions explicites.
        </p>
      </header>

      {axes.map(([axe, liste]) => (
        <section key={axe}>
          <h2 className="text-lg font-medium">
            {axe} <span className="text-sm font-normal text-neutral-500">({liste.length})</span>
          </h2>
          <ul className="mt-3 space-y-4">
            {liste.map((c) => (
              <li key={c.cle} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-sm font-medium">
                  {c.a.href ? (
                    <Link href={c.a.href} className="underline">
                      {c.a.nom}
                    </Link>
                  ) : (
                    c.a.nom
                  )}{" "}
                  <span className="text-neutral-400">×</span>{" "}
                  {c.b.href ? (
                    <Link href={c.b.href} className="underline">
                      {c.b.nom}
                    </Link>
                  ) : (
                    c.b.nom
                  )}
                </p>
                <p className="mt-2 border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                  {c.preuve}
                </p>
                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  {[c.a, c.b].map((bout) => (
                    <div key={bout.nom} className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
                      <p className="font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                        {bout.nom}
                      </p>
                      {bout.these ? (
                        <p className="mt-1 leading-relaxed text-neutral-700 dark:text-neutral-300">{bout.these}</p>
                      ) : (
                        <p className="mt-1 text-neutral-500">Thèse non renseignée dans la fiche.</p>
                      )}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

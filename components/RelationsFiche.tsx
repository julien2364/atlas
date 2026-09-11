// Les débats d'une fiche, tels qu'ils sont ÉCRITS dans le corpus.
//
// Le graphe de relations servait jusqu'ici au seul moteur de réponse. Il est
// pourtant la chose la plus utile du référentiel pour qui le lit : savoir qu'une
// fiche en conteste une autre, et pouvoir aller lire l'autre, vaut mieux que
// n'importe quel « articles similaires ».
//
// Rien n'est affiché sans sa preuve : chaque relation montre la phrase du corpus
// qui la fonde. Une relation sans phrase ne s'affiche pas.

import Link from "next/link";
import { cheminFicheHumaine, cheminFicheIA, getFicheHumaine, getFicheIA } from "@/lib/corpus";
import { LIBELLE_ROLE, voisinsRaisonnes, type RoleCroisement, type Voisin } from "@/lib/relations-corpus";
import type { TypeFicheRag } from "@/lib/sources-corpus";

/**
 * Rôles affichés sur une fiche, dans l'ordre. `autre_discipline` en est absent :
 * le bloc « Fiches connexes » de la page dit déjà la même chose, en mieux.
 */
const ORDRE: { role: RoleCroisement; titre: string; explication: string }[] = [
  {
    role: "contradiction",
    titre: "Ce que cette fiche met en cause, et ce qui la met en cause",
    explication:
      "Une fiche nomme l'autre dans son champ « limites critiques », et la phrase porte une marque " +
      "d'opposition. C'est un désaccord écrit dans le référentiel, pas un rapprochement calculé.",
  },
  {
    role: "mention_limites",
    titre: "Nommée dans les limites, sans objection formulée",
    explication:
      "Le lien est établi — une fiche nomme l'autre en discutant ses limites — mais aucune opposition n'y " +
      "est formulée. Le distinguer d'une contestation évite de fabriquer une controverse.",
  },
  {
    role: "appui",
    titre: "Appuis explicites",
    explication: "Une fiche nomme l'autre dans sa thèse centrale ou son apport : elle s'y adosse.",
  },
  {
    role: "antecedent",
    titre: "Antécédents",
    explication: "Même sous-domaine, période antérieure.",
  },
  {
    role: "posterite",
    titre: "Postérité",
    explication: "Même sous-domaine, période postérieure.",
  },
  {
    role: "meme_preuve",
    titre: "Repose sur la même source",
    explication:
      "Ces fiches citent au moins une source identique : si elles s'accordent, cet accord ne vaut pas " +
      "confirmation indépendante.",
  },
];

function lienVers(voisin: Voisin): { href: string; nom: string } | null {
  if (voisin.cible.type === "humaine") {
    const f = getFicheHumaine(voisin.cible.id);
    return f ? { href: cheminFicheHumaine(f.id), nom: f.nom } : null;
  }
  if (voisin.cible.type === "ia") {
    const f = getFicheIA(voisin.cible.id);
    return f ? { href: cheminFicheIA(f.id), nom: f.nom } : null;
  }
  return null;
}

export default function RelationsFiche({ type, id }: { type: TypeFicheRag; id: string }) {
  const voisins = voisinsRaisonnes(type, id).filter((v) => v.role !== "autre_discipline");
  if (voisins.length === 0) {
    return (
      <p className="text-neutral-500">
        Aucune autre fiche du référentiel ne nomme celle-ci, et celle-ci n&apos;en nomme aucune. Ce n&apos;est pas
        un signe d&apos;accord : c&apos;est un silence documentaire, et il se comble en écrivant les limites de la
        fiche avec des noms.
      </p>
    );
  }

  const parRole = new Map<RoleCroisement, Voisin[]>();
  for (const v of voisins) {
    if (!parRole.has(v.role)) parRole.set(v.role, []);
    parRole.get(v.role)!.push(v);
  }

  return (
    <div className="space-y-5">
      {ORDRE.filter((section) => parRole.has(section.role)).map((section) => (
        <section key={section.role}>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {section.titre} ({parRole.get(section.role)!.length})
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{section.explication}</p>
          <ul className="mt-2 space-y-2">
            {parRole.get(section.role)!.map((voisin) => {
              const lien = lienVers(voisin);
              if (!lien) return null;
              return (
                <li key={`${voisin.role}-${voisin.cible.type}-${voisin.cible.id}`} className="text-sm">
                  <Link href={lien.href} className="font-medium underline">
                    {lien.nom}
                  </Link>
                  <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {LIBELLE_ROLE[voisin.role]}
                  </span>
                  {voisin.preuve ? (
                    <p className="mt-1 border-l-2 border-neutral-300 pl-2 text-xs italic text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                      {voisin.preuve}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AxeHumain, AxeIA, FicheGap, FicheHumaine, FicheIA, Substituabilite } from "@/lib/types";

// Graphe de connaissances — mégaprompt section 8, tâche 5 du MP-1 : « visualisation
// force-directed des relations fiche humaine ↔ fiche IA ↔ fiche de gap ».
//
// Rendu SVG fait main, sans dépendance (même parti pris que Treemap.tsx et
// RadarChart.tsx) : simulation de forces de type Fruchterman-Reingold, répulsion
// entre toutes les paires, ressort sur chaque arête, gravité vers le centre,
// refroidissement linéaire et nombre d'itérations borné. Tout est calculé côté
// client, de façon DÉTERMINISTE (positions initiales sur un cercle + secousse
// dérivée d'un hachage de l'identifiant) : deux rendus successifs du même
// périmètre donnent exactement la même image, et le rendu serveur coïncide avec le
// rendu client (pas de désynchronisation d'hydratation liée à Math.random).
//
// CE QUE LA TOPOLOGIE RÉELLE AUTORISE — à lire avant de juger la visualisation
// -----------------------------------------------------------------------------
// Le corpus compte 512 fiches et 402 arêtes documentées (201 gaps × 2). Mais la
// structure n'est PAS un réseau : chaque fiche humaine n'apparaît que dans UNE
// seule fiche de gap (degré maximal observé : 1), tandis qu'une fiche IA peut en
// porter jusqu'à 16. Le graphe est donc une FORÊT D'ÉTOILES centrée sur les fiches
// IA — aucun cycle, aucun chemin de plus de 4 arêtes entre deux fiches humaines.
// Un rendu global des 512 nœuds ne produirait qu'une pelote décorative sans
// information ; il n'est volontairement pas proposé. L'entrée se fait toujours par
// un filtre, et la vue la plus informative est l'étoile d'une fiche IA : elle
// répond à « quelles capacités humaines cette technologie touche-t-elle, et avec
// quel verdict de substituabilité ».

/* -------------------------------------------------------------------------- */
/* Libellés et palettes                                                       */
/* -------------------------------------------------------------------------- */

const LABELS_AXE_IA: Record<AxeIA, string> = {
  generatif_raisonnement: "Génératif / raisonnement",
  agentique: "Agentique",
  scientifique: "Scientifique",
  sectoriel: "Sectoriel",
  limites: "Limites connues",
  predictif_data_science: "Data science / prédictif",
};

const LABELS_AXE_HUMAIN: Record<AxeHumain, string> = {
  social: "Social",
  psychologique: "Psychologique",
  philosophique: "Philosophique",
  evolution: "Évolution",
  serenite: "Sérénité de l'espèce",
};

// Seule échelle colorée du graphe : le verdict de substituabilité porté par la
// fiche de gap. Les fiches (humaines, IA) restent neutres — c'est la FORME qui les
// distingue, jamais la couleur seule.
const COULEUR_SUBSTITUABILITE: Record<Substituabilite, { fond: string; label: string }> = {
  remplacable_totalement: { fond: "#dc2626", label: "Remplaçable totalement" },
  remplacable_avec_supervision: { fond: "#d97706", label: "Remplaçable avec supervision" },
  non_remplacable: { fond: "#059669", label: "Non remplaçable" },
  remplacable_avec_autre_technologie: { fond: "#0284c7", label: "Remplaçable avec autre technologie" },
};

/* -------------------------------------------------------------------------- */
/* Modèle du graphe                                                           */
/* -------------------------------------------------------------------------- */

type TypeNoeud = "humaine" | "gap" | "ia";

interface Noeud {
  id: string;
  type: TypeNoeud;
  label: string;
  detail: string; // axe / sous-domaine, affiché dans la liste et l'infobulle
  href: string;
  substituabilite?: Substituabilite;
  x: number;
  y: number;
}

interface Arete {
  a: number; // index dans le tableau de nœuds
  b: number;
  nature: "documentee" | "parente";
}

const LARGEUR = 920;
const HAUTEUR = 620;
const MARGE = 46;

// Au-delà, la vue cesse d'être lisible : on refuse de dessiner plutôt que de
// livrer une pelote, et on dit pourquoi.
const MAX_NOEUDS = 240;

/** Hachage déterministe d'une chaîne → entier positif (djb2 tronqué). */
function hacher(valeur: string): number {
  let h = 5381;
  for (let i = 0; i < valeur.length; i += 1) h = ((h << 5) + h + valeur.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Simulation de forces bornée, déterministe, sur place.
 * Répulsion en O(n²) : acceptable jusqu'à quelques centaines de nœuds, ce que
 * MAX_NOEUDS garantit. Aucune animation : on calcule l'état final une fois et on
 * dessine — pas de boucle d'animation qui tournerait en fond.
 */
function simuler(noeuds: Noeud[], aretes: Arete[], iterations: number): void {
  const n = noeuds.length;
  if (n === 0) return;

  const cx = LARGEUR / 2;
  const cy = HAUTEUR / 2;

  // Placement initial déterministe : cercle régulier + décalage radial dérivé de
  // l'identifiant, pour casser la symétrie parfaite sans tirage aléatoire.
  const rayon = Math.min(LARGEUR, HAUTEUR) / 2 - MARGE;
  noeuds.forEach((noeud, i) => {
    const angle = (2 * Math.PI * i) / n;
    const secousse = ((hacher(noeud.id) % 1000) / 1000 - 0.5) * (rayon * 0.35);
    noeud.x = cx + (rayon + secousse) * Math.cos(angle);
    noeud.y = cy + (rayon + secousse) * Math.sin(angle);
  });

  if (n === 1) {
    noeuds[0].x = cx;
    noeuds[0].y = cy;
    return;
  }

  const k = Math.sqrt((LARGEUR * HAUTEUR) / n) * 0.85; // distance d'équilibre
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  let temperature = Math.min(LARGEUR, HAUTEUR) / 8;
  const refroidissement = temperature / (iterations + 1);

  for (let pas = 0; pas < iterations; pas += 1) {
    dx.fill(0);
    dy.fill(0);

    // Répulsion entre toutes les paires.
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        let ex = noeuds[i].x - noeuds[j].x;
        let ey = noeuds[i].y - noeuds[j].y;
        let d = Math.sqrt(ex * ex + ey * ey);
        if (d < 0.01) {
          // Deux nœuds exactement superposés : on les écarte dans une direction
          // déterministe plutôt que de diviser par zéro.
          ex = ((hacher(noeuds[i].id + noeuds[j].id) % 100) / 100 - 0.5) || 0.5;
          ey = ((hacher(noeuds[j].id + noeuds[i].id) % 100) / 100 - 0.5) || 0.5;
          d = Math.sqrt(ex * ex + ey * ey) || 0.01;
        }
        const force = (k * k) / d;
        const ux = (ex / d) * force;
        const uy = (ey / d) * force;
        dx[i] += ux;
        dy[i] += uy;
        dx[j] -= ux;
        dy[j] -= uy;
      }
    }

    // Attraction sur les arêtes. Les arêtes « parenté » (relation dérivée, non
    // documentée) tirent deux fois moins fort : elles rapprochent, elles ne
    // structurent pas.
    for (const arete of aretes) {
      const poids = arete.nature === "documentee" ? 1 : 0.5;
      const ex = noeuds[arete.a].x - noeuds[arete.b].x;
      const ey = noeuds[arete.a].y - noeuds[arete.b].y;
      const d = Math.sqrt(ex * ex + ey * ey) || 0.01;
      const force = ((d * d) / k) * poids;
      const ux = (ex / d) * force;
      const uy = (ey / d) * force;
      dx[arete.a] -= ux;
      dy[arete.a] -= uy;
      dx[arete.b] += ux;
      dy[arete.b] += uy;
    }

    // Gravité : empêche les composantes non reliées de partir à l'infini.
    for (let i = 0; i < n; i += 1) {
      dx[i] += (cx - noeuds[i].x) * 0.06 * k * 0.1;
      dy[i] += (cy - noeuds[i].y) * 0.06 * k * 0.1;
    }

    // Déplacement borné par la température, puis maintien dans le cadre.
    for (let i = 0; i < n; i += 1) {
      const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 0.01;
      const pasX = (dx[i] / d) * Math.min(d, temperature);
      const pasY = (dy[i] / d) * Math.min(d, temperature);
      noeuds[i].x = Math.max(MARGE, Math.min(LARGEUR - MARGE, noeuds[i].x + pasX));
      noeuds[i].y = Math.max(MARGE, Math.min(HAUTEUR - MARGE, noeuds[i].y + pasY));
    }

    temperature = Math.max(temperature - refroidissement, 0.5);
  }

  // Recadrage final : on étale le résultat sur toute la surface disponible, sinon
  // une petite étoile se retrouve tassée au centre d'un grand cadre vide.
  const xs = noeuds.map((p) => p.x);
  const ys = noeuds.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const etendueX = maxX - minX;
  const etendueY = maxY - minY;
  if (etendueX > 1 && etendueY > 1) {
    const echelle = Math.min((LARGEUR - 2 * MARGE) / etendueX, (HAUTEUR - 2 * MARGE) / etendueY);
    const decalageX = (LARGEUR - etendueX * echelle) / 2;
    const decalageY = (HAUTEUR - etendueY * echelle) / 2;
    noeuds.forEach((p) => {
      p.x = (p.x - minX) * echelle + decalageX;
      p.y = (p.y - minY) * echelle + decalageY;
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Composant                                                                  */
/* -------------------------------------------------------------------------- */

/** Une entrée de menu déroulant : toutes les portées partagent la même forme. */
interface Option {
  id: string;
  label: string;
}

type Portee = "ia" | "humaine" | "axe_ia" | "sous_domaine";

const LABELS_PORTEE: Record<Portee, string> = {
  ia: "Autour d'une fiche IA",
  humaine: "Autour d'une fiche humaine",
  axe_ia: "Toutes les paires d'un axe IA",
  sous_domaine: "Toutes les paires d'un sous-domaine humain",
};

export default function GrapheConnaissances({
  humaines,
  ia,
  gaps,
}: {
  humaines: FicheHumaine[];
  ia: FicheIA[];
  gaps: FicheGap[];
}) {
  const indexHumaines = useMemo(() => new Map<string, FicheHumaine>(humaines.map((f) => [f.id, f])), [humaines]);
  const indexIA = useMemo(() => new Map<string, FicheIA>(ia.map((f) => [f.id, f])), [ia]);

  // Options de chaque portée, limitées à ce qui produit un graphe non vide.
  const optionsIA = useMemo<Option[]>(() => {
    const compte = new Map<string, number>();
    gaps.forEach((g) => compte.set(g.fiche_ia_id, (compte.get(g.fiche_ia_id) ?? 0) + 1));
    return ia
      .filter((f) => compte.has(f.id))
      .map((f) => ({ fiche: f, n: compte.get(f.id) ?? 0 }))
      .sort((a, b) => b.n - a.n || a.fiche.nom.localeCompare(b.fiche.nom, "fr"))
      .map(({ fiche, n }) => ({ id: fiche.id, label: `${fiche.nom} (${n} paire${n > 1 ? "s" : ""})` }));
  }, [ia, gaps]);

  const optionsHumaines = useMemo<Option[]>(() => {
    const avecGap = new Set(gaps.map((g) => g.fiche_humaine_id));
    return humaines
      .filter((f) => avecGap.has(f.id))
      .map((f) => ({ id: f.id, label: f.nom }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [humaines, gaps]);

  const optionsAxesIA = useMemo<Option[]>(() => {
    const compte = new Map<AxeIA, number>();
    gaps.forEach((g) => {
      const fiche = indexIA.get(g.fiche_ia_id);
      if (!fiche) return;
      compte.set(fiche.axe, (compte.get(fiche.axe) ?? 0) + 1);
    });
    return (Object.keys(LABELS_AXE_IA) as AxeIA[])
      .filter((a) => compte.has(a))
      .map((a) => ({ id: a as string, label: `${LABELS_AXE_IA[a]} (${compte.get(a) ?? 0} paires)` }));
  }, [gaps, indexIA]);

  const optionsSousDomaines = useMemo<Option[]>(() => {
    const compte = new Map<string, number>();
    gaps.forEach((g) => {
      const fiche = indexHumaines.get(g.fiche_humaine_id);
      if (!fiche) return;
      const cle = fiche.sous_domaine ?? "(sans sous-domaine)";
      compte.set(cle, (compte.get(cle) ?? 0) + 1);
    });
    return Array.from(compte.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
      .map(([id, n]) => ({ id, label: `${id.replace(/_/g, " ")} (${n} paire${n > 1 ? "s" : ""})` }));
  }, [gaps, indexHumaines]);

  const [portee, setPortee] = useState<Portee>("ia");
  const [cible, setCible] = useState<string>(() => optionsIA[0]?.id ?? "");
  const [deuxPas, setDeuxPas] = useState(true);
  const [aretesParente, setAretesParente] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);

  const optionsCourantes =
    portee === "ia"
      ? optionsIA
      : portee === "humaine"
        ? optionsHumaines
        : portee === "axe_ia"
          ? optionsAxesIA
          : optionsSousDomaines;

  function changerPortee(nouvelle: Portee) {
    setPortee(nouvelle);
    setSelection(null);
    const options =
      nouvelle === "ia"
        ? optionsIA
        : nouvelle === "humaine"
          ? optionsHumaines
          : nouvelle === "axe_ia"
            ? optionsAxesIA
            : optionsSousDomaines;
    setCible(options[0]?.id ?? "");
  }

  // Sélection des paires (fiches de gap) qui composent la vue courante.
  const gapsRetenus = useMemo(() => {
    if (!cible) return [];
    if (portee === "ia") return gaps.filter((g) => g.fiche_ia_id === cible);
    if (portee === "axe_ia") return gaps.filter((g) => indexIA.get(g.fiche_ia_id)?.axe === cible);
    if (portee === "sous_domaine")
      return gaps.filter((g) => (indexHumaines.get(g.fiche_humaine_id)?.sous_domaine ?? "(sans sous-domaine)") === cible);
    // portee === "humaine"
    const direct = gaps.filter((g) => g.fiche_humaine_id === cible);
    if (!deuxPas) return direct;
    // Deux pas : la fiche humaine → sa paire → la fiche IA → les autres paires de
    // cette fiche IA → les autres fiches humaines qu'elle touche.
    const idsIA = new Set(direct.map((g) => g.fiche_ia_id));
    return gaps.filter((g) => idsIA.has(g.fiche_ia_id));
  }, [portee, cible, deuxPas, gaps, indexIA, indexHumaines]);

  const { noeuds, aretes, tropGros } = useMemo(() => {
    const listeNoeuds: Noeud[] = [];
    const indexParId = new Map<string, number>();

    const ajouter = (noeud: Noeud): number => {
      const existant = indexParId.get(noeud.id);
      if (existant !== undefined) return existant;
      const position = listeNoeuds.length;
      listeNoeuds.push(noeud);
      indexParId.set(noeud.id, position);
      return position;
    };

    const listeAretes: Arete[] = [];

    for (const gap of gapsRetenus) {
      const ficheH = indexHumaines.get(gap.fiche_humaine_id);
      const ficheI = indexIA.get(gap.fiche_ia_id);

      const iIA = ajouter({
        id: `ia:${gap.fiche_ia_id}`,
        type: "ia",
        label: ficheI?.nom ?? gap.fiche_ia_id,
        detail: ficheI ? LABELS_AXE_IA[ficheI.axe] ?? ficheI.axe : "fiche IA introuvable dans le corpus",
        href: `/fiche/ia/${gap.fiche_ia_id}`,
        x: 0,
        y: 0,
      });
      const iGap = ajouter({
        id: `gap:${gap.id}`,
        type: "gap",
        label: gap.sujet ?? `${ficheH?.nom ?? gap.fiche_humaine_id} × ${ficheI?.nom ?? gap.fiche_ia_id}`,
        detail: `${COULEUR_SUBSTITUABILITE[gap.substituabilite]?.label ?? gap.substituabilite} · confiance ${gap.confiance}`,
        href: `/gap/${gap.id}`,
        substituabilite: gap.substituabilite,
        x: 0,
        y: 0,
      });
      const iHum = ajouter({
        id: `humaine:${gap.fiche_humaine_id}`,
        type: "humaine",
        label: ficheH?.nom ?? gap.fiche_humaine_id,
        detail: ficheH
          ? `${LABELS_AXE_HUMAIN[ficheH.axe] ?? ficheH.axe}${ficheH.sous_domaine ? ` · ${ficheH.sous_domaine.replace(/_/g, " ")}` : ""}`
          : "fiche humaine introuvable dans le corpus",
        href: `/fiche/humaine/${gap.fiche_humaine_id}`,
        x: 0,
        y: 0,
      });

      listeAretes.push({ a: iHum, b: iGap, nature: "documentee" });
      listeAretes.push({ a: iGap, b: iIA, nature: "documentee" });
    }

    // Arêtes de parenté : relation DÉRIVÉE (même sous-domaine humain), pas une
    // relation documentée du référentiel. Elles rendent visible le fait qu'une
    // même fiche IA relie parfois des sous-domaines hétérogènes. Optionnelles,
    // tracées en pointillé, et limitées en nombre pour ne pas saturer la vue.
    if (aretesParente) {
      const parSousDomaine = new Map<string, number[]>();
      listeNoeuds.forEach((noeud, i) => {
        if (noeud.type !== "humaine") return;
        const fiche = indexHumaines.get(noeud.id.slice("humaine:".length));
        const cle = fiche?.sous_domaine ?? "(sans sous-domaine)";
        const liste = parSousDomaine.get(cle) ?? [];
        liste.push(i);
        parSousDomaine.set(cle, liste);
      });
      parSousDomaine.forEach((indices) => {
        // Chaîne, pas clique : n-1 arêtes au lieu de n(n-1)/2, ce qui suffit à
        // regrouper visuellement sans noyer le dessin.
        for (let i = 1; i < indices.length; i += 1) {
          listeAretes.push({ a: indices[i - 1], b: indices[i], nature: "parente" });
        }
      });
    }

    if (listeNoeuds.length > MAX_NOEUDS) {
      return { noeuds: [] as Noeud[], aretes: [] as Arete[], tropGros: listeNoeuds.length };
    }

    const iterations = listeNoeuds.length <= 60 ? 320 : listeNoeuds.length <= 140 ? 220 : 150;
    simuler(listeNoeuds, listeAretes, iterations);

    return { noeuds: listeNoeuds, aretes: listeAretes, tropGros: 0 };
  }, [gapsRetenus, indexHumaines, indexIA, aretesParente]);

  const comptes = useMemo(
    () => ({
      humaines: noeuds.filter((n) => n.type === "humaine").length,
      gaps: noeuds.filter((n) => n.type === "gap").length,
      ia: noeuds.filter((n) => n.type === "ia").length,
    }),
    [noeuds],
  );

  const noeudSelectionne = selection ? noeuds.find((n) => n.id === selection) ?? null : null;
  const gapSelectionne =
    noeudSelectionne?.type === "gap" ? gaps.find((g) => g.id === noeudSelectionne.id.slice("gap:".length)) ?? null : null;

  // Voisinage du nœud sélectionné, pour estomper le reste du dessin.
  const voisins = useMemo(() => {
    if (!selection) return null;
    const position = noeuds.findIndex((n) => n.id === selection);
    if (position < 0) return null;
    const ensemble = new Set<number>([position]);
    aretes.forEach((a) => {
      if (a.a === position) ensemble.add(a.b);
      if (a.b === position) ensemble.add(a.a);
    });
    return ensemble;
  }, [selection, noeuds, aretes]);

  // Étiquettes : toujours pour les fiches IA (peu nombreuses, ce sont les moyeux),
  // pour le nœud sélectionné et ses voisins, et pour tout le monde quand la vue
  // est assez petite pour que ça reste lisible.
  const etiquettesPartout = noeuds.length <= 40;

  const opacite = (i: number) => (voisins ? (voisins.has(i) ? 1 : 0.15) : 1);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Entrée dans le graphe
          <select
            value={portee}
            onChange={(e) => changerPortee(e.target.value as Portee)}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {(Object.keys(LABELS_PORTEE) as Portee[]).map((p) => (
              <option key={p} value={p}>
                {LABELS_PORTEE[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[16rem] flex-col gap-1 text-xs text-neutral-500">
          {portee === "ia"
            ? "Fiche IA"
            : portee === "humaine"
              ? "Fiche humaine"
              : portee === "axe_ia"
                ? "Axe IA"
                : "Sous-domaine humain"}
          <select
            value={cible}
            onChange={(e) => {
              setCible(e.target.value);
              setSelection(null);
            }}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            {optionsCourantes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {portee === "humaine" && (
          <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <input type="checkbox" checked={deuxPas} onChange={(e) => setDeuxPas(e.target.checked)} />
            Voisinage à deux pas (les autres capacités humaines touchées par la même IA)
          </label>
        )}

        <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <input type="checkbox" checked={aretesParente} onChange={(e) => setAretesParente(e.target.checked)} />
          Arêtes de parenté par sous-domaine (relation dérivée, non documentée)
        </label>

        {selection && (
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
          >
            Effacer la sélection
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-500" aria-live="polite">
        {tropGros > 0
          ? `Périmètre trop large : ${tropGros} nœuds (maximum lisible : ${MAX_NOEUDS}). Choisir une entrée plus étroite.`
          : `${comptes.humaines} fiche${comptes.humaines > 1 ? "s" : ""} humaine${comptes.humaines > 1 ? "s" : ""} · ${
              comptes.gaps
            } fiche${comptes.gaps > 1 ? "s" : ""} de gap · ${comptes.ia} fiche${comptes.ia > 1 ? "s" : ""} IA · ${
              aretes.length
            } arête${aretes.length > 1 ? "s" : ""}`}
      </p>

      {tropGros > 0 ? (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Cette vue dépasse ce qu&apos;un graphe de forces reste capable de montrer. Plutôt que d&apos;afficher une
          pelote illisible, le composant s&apos;arrête ici : réduire le périmètre (une fiche IA, un sous-domaine) ou
          décocher les arêtes de parenté.
        </p>
      ) : noeuds.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">Aucune paire documentée pour ce périmètre.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded border border-neutral-200 dark:border-neutral-800">
          <svg
            viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
            width="100%"
            className="h-auto w-full min-w-[40rem]"
            role="img"
            aria-label={`Graphe de connaissances : ${comptes.humaines} fiches humaines, ${comptes.gaps} fiches de gap et ${comptes.ia} fiches IA reliées par ${aretes.length} arêtes. Le contenu détaillé du graphe est repris sous forme de liste navigable au clavier juste après cette image.`}
          >
            {aretes.map((a, i) => {
              const na = noeuds[a.a];
              const nb = noeuds[a.b];
              const active = !voisins || (voisins.has(a.a) && voisins.has(a.b));
              return (
                <line
                  key={i}
                  x1={na.x}
                  y1={na.y}
                  x2={nb.x}
                  y2={nb.y}
                  stroke="currentColor"
                  strokeOpacity={active ? (a.nature === "documentee" ? 0.35 : 0.2) : 0.06}
                  strokeWidth={a.nature === "documentee" ? 1.2 : 1}
                  strokeDasharray={a.nature === "documentee" ? undefined : "4 4"}
                />
              );
            })}

            {noeuds.map((noeud, i) => {
              const estSelectionne = selection === noeud.id;
              const montrerEtiquette =
                noeud.type === "ia" || estSelectionne || etiquettesPartout || (voisins?.has(i) ?? false);
              const couleurGap = noeud.substituabilite
                ? COULEUR_SUBSTITUABILITE[noeud.substituabilite]?.fond ?? "#737373"
                : "#737373";
              return (
                <g
                  key={noeud.id}
                  opacity={opacite(i)}
                  onClick={() => setSelection(estSelectionne ? null : noeud.id)}
                  style={{ cursor: "pointer" }}
                >
                  <title>{`${noeud.label} — ${noeud.detail}`}</title>
                  {noeud.type === "ia" && (
                    <rect
                      x={noeud.x - 11}
                      y={noeud.y - 8}
                      width={22}
                      height={16}
                      rx={3}
                      fill="var(--foreground)"
                      stroke={estSelectionne ? "#f59e0b" : "var(--foreground)"}
                      strokeWidth={estSelectionne ? 3 : 1}
                    />
                  )}
                  {noeud.type === "humaine" && (
                    <circle
                      cx={noeud.x}
                      cy={noeud.y}
                      r={7}
                      fill="var(--background)"
                      stroke={estSelectionne ? "#f59e0b" : "var(--foreground)"}
                      strokeWidth={estSelectionne ? 3 : 1.6}
                    />
                  )}
                  {noeud.type === "gap" && (
                    <polygon
                      points={`${noeud.x},${noeud.y - 8} ${noeud.x + 8},${noeud.y} ${noeud.x},${noeud.y + 8} ${
                        noeud.x - 8
                      },${noeud.y}`}
                      fill={couleurGap}
                      stroke={estSelectionne ? "#f59e0b" : "var(--background)"}
                      strokeWidth={estSelectionne ? 3 : 1}
                    />
                  )}
                  {montrerEtiquette && (
                    <text
                      x={noeud.x}
                      y={noeud.y - 13}
                      fontSize={noeud.type === "ia" ? 12 : 10}
                      fontWeight={noeud.type === "ia" ? 600 : 400}
                      textAnchor="middle"
                      fill="currentColor"
                      pointerEvents="none"
                    >
                      {noeud.label.length > 34 ? `${noeud.label.slice(0, 33)}…` : noeud.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="var(--background)" stroke="var(--foreground)" strokeWidth="1.6" />
          </svg>
          Fiche humaine (cercle)
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <polygon points="8,1 15,8 8,15 1,8" fill="#737373" />
          </svg>
          Fiche de gap (losange), couleur = substituabilité
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
            <rect x="2" y="4" width="14" height="9" rx="2" fill="var(--foreground)" />
          </svg>
          Fiche IA (rectangle)
        </span>
        {(Object.keys(COULEUR_SUBSTITUABILITE) as Substituabilite[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rotate-45"
              style={{ backgroundColor: COULEUR_SUBSTITUABILITE[s].fond }}
              aria-hidden="true"
            />
            {COULEUR_SUBSTITUABILITE[s].label}
          </span>
        ))}
      </div>

      {noeudSelectionne && (
        <div className="mt-4 rounded border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-medium">{noeudSelectionne.label}</h4>
            <span className="text-xs text-neutral-400">{noeudSelectionne.detail}</span>
          </div>
          {gapSelectionne && (
            <>
              <p className="mt-2 text-neutral-700 dark:text-neutral-300">{gapSelectionne.apport_ia}</p>
              <p className="mt-2 text-xs text-neutral-500">
                {indexHumaines.get(gapSelectionne.fiche_humaine_id)?.nom ?? gapSelectionne.fiche_humaine_id} ×{" "}
                {indexIA.get(gapSelectionne.fiche_ia_id)?.nom ?? gapSelectionne.fiche_ia_id} — mode d&apos;interaction :{" "}
                {gapSelectionne.mode_interaction}
              </p>
            </>
          )}
          <Link href={noeudSelectionne.href} className="mt-2 inline-block text-xs underline hover:no-underline">
            Ouvrir la fiche complète
          </Link>
        </div>
      )}

      {noeuds.length > 0 && (
        <details className="mt-4 rounded border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-neutral-500">
            Contenu du graphe sous forme de liste ({noeuds.length} nœuds) — équivalent accessible au clavier
          </summary>
          <p className="mt-2 text-xs text-neutral-500">
            Le dessin SVG est un résumé visuel ; cette liste en est l&apos;équivalent textuel, navigable au clavier et
            lisible par un lecteur d&apos;écran. Chaque paire y est donnée dans l&apos;ordre fiche humaine → fiche de
            gap → fiche IA.
          </p>
          <ul className="mt-2 space-y-2">
            {gapsRetenus.map((gap) => {
              const ficheH = indexHumaines.get(gap.fiche_humaine_id);
              const ficheI = indexIA.get(gap.fiche_ia_id);
              return (
                <li key={gap.id} className="border-t border-neutral-100 pt-2 dark:border-neutral-900">
                  <p className="text-xs">
                    <Link href={`/fiche/humaine/${gap.fiche_humaine_id}`} className="underline hover:no-underline">
                      {ficheH?.nom ?? gap.fiche_humaine_id}
                    </Link>{" "}
                    →{" "}
                    <Link href={`/gap/${gap.id}`} className="underline hover:no-underline">
                      {gap.sujet ?? "analyse de gap"}
                    </Link>{" "}
                    →{" "}
                    <Link href={`/fiche/ia/${gap.fiche_ia_id}`} className="underline hover:no-underline">
                      {ficheI?.nom ?? gap.fiche_ia_id}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {COULEUR_SUBSTITUABILITE[gap.substituabilite]?.label ?? gap.substituabilite} · confiance{" "}
                    {gap.confiance}
                    <button
                      type="button"
                      onClick={() => setSelection(`gap:${gap.id}`)}
                      className="ml-2 underline hover:no-underline"
                    >
                      mettre en évidence dans le graphe
                    </button>
                  </p>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

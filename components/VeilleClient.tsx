"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

// Interface de revue de la file de veille — mégaprompt section 7.1, tâche 3 du MP-1.
//
// POURQUOI UNE REVUE QUI EXPORTE, ET PAS UNE SERVER ACTION QUI ÉCRIT
// -------------------------------------------------------------------
// Les données du référentiel sont des JSON VERSIONNÉS dans le dépôt : c'est le
// commit git qui fait foi, pas une base. Le site est déployé sur Vercel, dont le
// système de fichiers est en lecture seule et éphémère : une server action qui
// écrirait dans data/seed/ réussirait en local et ne persisterait RIEN en
// production — au mieux jusqu'au prochain démarrage d'instance, sans jamais
// remonter dans git. Le pire n'est pas la perte : c'est qu'une écriture qui
// n'apparaît dans aucun diff contourne la règle absolue du projet, « aucune fiche
// n'est modifiée sans validation humaine », en rendant la modification
// invérifiable.
//
// Cette interface fait donc ce que la chaîne existante attend d'elle : elle
// PRODUIT UNE DÉCISION EXPORTABLE, exactement au format que
// scripts/appliquer-veille.mjs sait relire, sans rien écrire nulle part.
//
//   [ici] revue humaine  →  veille_queue.json révisé (téléchargé)
//        → remplacer data/seed/veille_queue.json, committer
//        → node scripts/appliquer-veille.mjs      (propose des patchs)
//        → relire le fichier de patchs, `retenu: false` sur ce qui est écarté
//        → node scripts/appliquer-patchs.mjs      (applique + changelog)
//
// La revue reste donc entièrement dans le flux git : elle est diffable, relisible
// en pull request, réversible d'un `git revert`. Aucune donnée ne quitte le
// navigateur, aucune écriture serveur n'a lieu.

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface ContenuPropose {
  // veille-rss.mjs (actualités)
  titre?: string;
  link?: string;
  date?: string;
  resume?: string;
  // documentation-recherche.mjs (fiches « à documenter »)
  nom?: string;
  titre_article_source?: string;
  url?: string;
  extrait?: string;
  langue_source?: string;
  note?: string;
}

export interface QueueItem {
  id: string;
  source_id: string | null;
  cible_type?: string;
  cible_id?: string | null;
  contenu_propose: ContenuPropose;
  score_fiabilite: number;
  statut: string;
  created_at?: string;
  note_tri?: string;
  [autre: string]: unknown; // les champs inconnus sont recopiés tels quels à l'export
}

type Action = "approuver" | "rejeter";

interface Decision {
  action: Action;
  motif: string;
}

/* -------------------------------------------------------------------------- */
/* Constantes                                                                 */
/* -------------------------------------------------------------------------- */

// Statuts que scripts/appliquer-veille.mjs sait consommer (--statut, défaut
// « a_traiter_fiche_existante »). L'approbation retombe donc sur l'un des deux,
// selon que la proposition vise une fiche existante ou appelle une fiche nouvelle.
const STATUT_FICHE_EXISTANTE = "a_traiter_fiche_existante";
const STATUT_NOUVELLE_FICHE = "a_traiter_nouvelle_fiche";
const STATUT_REJETE = "rejete";

const CLE_STOCKAGE = "atlas.revue-veille.v1";

const LABELS_STATUT: Record<string, string> = {
  en_attente: "en attente de tri",
  a_traiter_fiche_existante: "à traiter — fiche existante",
  a_traiter_nouvelle_fiche: "à traiter — nouvelle fiche",
  rejete: "rejetée",
  applique: "appliquée",
  fiche_creee: "fiche créée",
  ecarte_en_relecture: "écartée en relecture",
  ecarte_automatique: "écartée au pré-tri",
};

const LABELS_CIBLE: Record<string, string> = {
  fiche_humaine: "fiche humaine",
  fiche_ia: "fiche IA",
  fiche_gap: "fiche de gap",
  nouvelle_categorie: "nouvelle catégorie",
};

const PAS_AFFICHAGE = 40;

/* -------------------------------------------------------------------------- */
/* Utilitaires                                                                */
/* -------------------------------------------------------------------------- */

/** Formatage JJ/MM/AAAA déterministe (pas de dépendance à l'ICU du runtime, donc
 *  pas de risque d'écart entre le rendu serveur et le rendu client). */
function formatDateFr(iso: string | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function statutApprobation(item: QueueItem): string {
  const viseUneFicheExistante =
    (item.cible_type === "fiche_humaine" || item.cible_type === "fiche_ia" || item.cible_type === "fiche_gap") &&
    typeof item.cible_id === "string" &&
    item.cible_id.length > 0;
  return viseUneFicheExistante ? STATUT_FICHE_EXISTANTE : STATUT_NOUVELLE_FICHE;
}

function normaliserProposition(q: QueueItem): {
  titre: string;
  href: string | null;
  dateStr: string | null;
  texte: string;
  badge: string;
} {
  const estDocumentation = q.cible_type === "fiche_humaine" || q.cible_type === "fiche_ia";
  if (estDocumentation && q.contenu_propose.extrait !== undefined) {
    return {
      titre: q.contenu_propose.nom ?? q.contenu_propose.titre_article_source ?? "(sans titre)",
      href: q.contenu_propose.url ?? null,
      dateStr: null,
      texte: q.contenu_propose.extrait ?? "",
      badge: q.cible_type === "fiche_humaine" ? "documentation — fiche humaine" : "documentation — fiche IA",
    };
  }
  return {
    titre: q.contenu_propose.titre ?? q.contenu_propose.nom ?? "(sans titre)",
    href: q.contenu_propose.link ?? q.contenu_propose.url ?? null,
    dateStr: formatDateFr(q.contenu_propose.date),
    texte: q.contenu_propose.resume ?? q.contenu_propose.extrait ?? "",
    badge: q.cible_type ? LABELS_CIBLE[q.cible_type] ?? q.cible_type : "sans cible",
  };
}

function telecharger(nomFichier: string, contenu: string): void {
  const blob = new Blob([contenu], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/* Composant                                                                  */
/* -------------------------------------------------------------------------- */

export default function VeilleClient({ queue }: { queue: QueueItem[] }) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [chargeDepuisStockage, setChargeDepuisStockage] = useState(false);

  // Filtres de revue en lot (mégaprompt : « filtrer par score de fiabilité, par
  // domaine, par type de proposition » plutôt qu'une liste linéaire).
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [filtreCible, setFiltreCible] = useState<string>("tous");
  const [filtreSource, setFiltreSource] = useState<string>("toutes");
  const [scoreMin, setScoreMin] = useState<number>(0);
  const [filtreDecision, setFiltreDecision] = useState<"tous" | "non_decides" | "approuves" | "rejetes">("tous");
  const [recherche, setRecherche] = useState("");
  const [limite, setLimite] = useState(PAS_AFFICHAGE);

  // Reprise d'une revue interrompue : 187 propositions ne se traitent pas en une
  // fois, et un rechargement de page ne doit pas effacer le travail fait. Lecture
  // en effet (jamais pendant le rendu) pour ne pas désynchroniser l'hydratation.
  useEffect(() => {
    // La reprise n'est pas une mise à jour urgente (rien à l'écran n'en dépend
    // avant l'interaction de l'utilisateur) : `startTransition` évite d'appeler
    // `setState` de façon synchrone dans l'effet, sans changer le résultat —
    // la revue est bien reprise dès que l'état est disponible.
    startTransition(() => {
      try {
        const brut = window.localStorage.getItem(CLE_STOCKAGE);
        if (brut) {
          const lu = JSON.parse(brut) as Record<string, Decision>;
          if (lu && typeof lu === "object") setDecisions(lu);
        }
      } catch {
        // Stockage indisponible (navigation privée, blocage) : la revue reste
        // possible, elle n'est simplement pas reprise après un rechargement.
      }
      setChargeDepuisStockage(true);
    });
  }, []);

  useEffect(() => {
    if (!chargeDepuisStockage) return;
    try {
      window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(decisions));
    } catch {
      /* idem */
    }
  }, [decisions, chargeDepuisStockage]);

  const statutsPresents = useMemo(
    () => Array.from(new Set(queue.map((q) => q.statut))).sort(),
    [queue],
  );
  const ciblesPresentes = useMemo(
    () => Array.from(new Set(queue.map((q) => q.cible_type ?? "(sans cible)"))).sort(),
    [queue],
  );
  const sourcesPresentes = useMemo(
    () => Array.from(new Set(queue.map((q) => q.source_id ?? "(sans source)"))).sort(),
    [queue],
  );
  const scoresPresents = useMemo(
    () => Array.from(new Set(queue.map((q) => q.score_fiabilite))).sort((a, b) => a - b),
    [queue],
  );

  const filtrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return queue.filter((q) => {
      if (filtreStatut !== "tous" && q.statut !== filtreStatut) return false;
      if (filtreCible !== "tous" && (q.cible_type ?? "(sans cible)") !== filtreCible) return false;
      if (filtreSource !== "toutes" && (q.source_id ?? "(sans source)") !== filtreSource) return false;
      if (q.score_fiabilite < scoreMin) return false;
      const d = decisions[q.id];
      if (filtreDecision === "non_decides" && d) return false;
      if (filtreDecision === "approuves" && d?.action !== "approuver") return false;
      if (filtreDecision === "rejetes" && d?.action !== "rejeter") return false;
      if (terme) {
        const p = normaliserProposition(q);
        const foin = `${p.titre} ${p.texte} ${q.cible_id ?? ""} ${q.note_tri ?? ""}`.toLowerCase();
        if (!foin.includes(terme)) return false;
      }
      return true;
    });
  }, [queue, filtreStatut, filtreCible, filtreSource, scoreMin, filtreDecision, recherche, decisions]);

  const visibles = filtrees.slice(0, limite);

  const compteurs = useMemo(() => {
    const valeurs = Object.values(decisions);
    return {
      approuves: valeurs.filter((d) => d.action === "approuver").length,
      rejetes: valeurs.filter((d) => d.action === "rejeter").length,
      total: valeurs.length,
    };
  }, [decisions]);

  const decider = useCallback((id: string, action: Action) => {
    setDecisions((precedent) => {
      const actuelle = precedent[id];
      // Re-cliquer la même action annule la décision : on peut revenir en arrière
      // sans repartir de zéro.
      if (actuelle?.action === action) {
        const copie = { ...precedent };
        delete copie[id];
        return copie;
      }
      return { ...precedent, [id]: { action, motif: actuelle?.motif ?? "" } };
    });
  }, []);

  const motiver = useCallback((id: string, motif: string) => {
    setDecisions((precedent) => (precedent[id] ? { ...precedent, [id]: { ...precedent[id], motif } } : precedent));
  }, []);

  const deciderEnLot = useCallback(
    (action: Action) => {
      setDecisions((precedent) => {
        const copie = { ...precedent };
        filtrees.forEach((q) => {
          copie[q.id] = { action, motif: copie[q.id]?.motif ?? "" };
        });
        return copie;
      });
    },
    [filtrees],
  );

  const toutEffacer = useCallback(() => setDecisions({}), []);

  /* ---------------------------------------------------------------------- */
  /* Exports                                                                */
  /* ---------------------------------------------------------------------- */

  /** File révisée : même tableau, mêmes objets, seuls `statut` et la trace de revue
   *  changent. Se substitue tel quel à data/seed/veille_queue.json. */
  const construireFileRevisee = useCallback(
    (aujourdhui: string): QueueItem[] =>
      queue.map((q) => {
        const d = decisions[q.id];
        if (!d) return q;
        const nouveauStatut = d.action === "approuver" ? statutApprobation(q) : STATUT_REJETE;
        const motif = d.motif.trim();
        return {
          ...q,
          statut: nouveauStatut,
          note_tri: motif
            ? `${q.note_tri ? `${q.note_tri} ` : ""}[Revue du ${aujourdhui}] ${motif}`
            : q.note_tri,
          revue_le: aujourdhui,
          revue_decision: d.action,
          statut_avant_revue: q.statut,
        };
      }),
    [queue, decisions],
  );

  /** Journal de décisions : ce qui se relit en pull request, sans avoir à parcourir
   *  ligne à ligne un fichier de 225 Ko. */
  const construireJournal = useCallback(
    (aujourdhui: string) => ({
      genere_le: new Date().toISOString(),
      genere_par: "/veille — interface de revue (components/VeilleClient.tsx)",
      rappel:
        "AUCUNE FICHE N'EST MODIFIÉE PAR CETTE REVUE. Ce fichier est une décision humaine exportée : " +
        "remplacer data/seed/veille_queue.json par la file révisée, committer, puis lancer " +
        "scripts/appliquer-veille.mjs et scripts/appliquer-patchs.mjs.",
      date_revue: aujourdhui,
      compteurs: {
        propositions_dans_la_file: queue.length,
        decisions_prises: compteurs.total,
        approuvees: compteurs.approuves,
        rejetees: compteurs.rejetes,
        non_decidees: queue.length - compteurs.total,
      },
      decisions: queue
        .filter((q) => decisions[q.id])
        .map((q) => {
          const d = decisions[q.id];
          return {
            proposition_id: q.id,
            cible_type: q.cible_type ?? null,
            cible_id: q.cible_id ?? null,
            source_id: q.source_id ?? null,
            score_fiabilite: q.score_fiabilite,
            statut_avant: q.statut,
            statut_apres: d.action === "approuver" ? statutApprobation(q) : STATUT_REJETE,
            decision: d.action,
            motif: d.motif.trim() || null,
          };
        }),
    }),
    [queue, decisions, compteurs],
  );

  const exporter = useCallback(
    (quoi: "file" | "journal") => {
      const aujourdhui = new Date().toISOString().slice(0, 10);
      if (quoi === "file") {
        telecharger("veille_queue.json", `${JSON.stringify(construireFileRevisee(aujourdhui), null, 2)}\n`);
      } else {
        telecharger(
          `decisions-veille-${aujourdhui}.json`,
          `${JSON.stringify(construireJournal(aujourdhui), null, 2)}\n`,
        );
      }
    },
    [construireFileRevisee, construireJournal],
  );

  /* ---------------------------------------------------------------------- */
  /* Rendu                                                                  */
  /* ---------------------------------------------------------------------- */

  const classeBouton = (actif: boolean, ton: "vert" | "rouge") =>
    `rounded border px-2 py-1 text-xs transition-colors ${
      actif
        ? ton === "vert"
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-red-600 bg-red-600 text-white"
        : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
    }`;

  return (
    <div>
      <div className="rounded border border-neutral-200 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        <p className="font-medium text-neutral-800 dark:text-neutral-200">
          Cette page ne modifie aucune fiche et n&apos;écrit rien sur le serveur.
        </p>
        <p className="mt-1">
          La revue se fait ici, dans le navigateur ; elle produit un <strong>fichier de décision téléchargeable</strong>{" "}
          qui rejoint le dépôt par un commit relisible. Les données du référentiel sont des JSON versionnés : sur
          Vercel, une écriture serveur ne persisterait pas et, surtout, elle contournerait la règle du projet — aucune
          fiche n&apos;est modifiée sans validation humaine tracée dans git.
        </p>
      </div>

      {/* Filtres de revue en lot */}
      <div className="mt-4 flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1 text-neutral-500">
          Statut actuel
          <select
            value={filtreStatut}
            onChange={(e) => {
              setFiltreStatut(e.target.value);
              setLimite(PAS_AFFICHAGE);
            }}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="tous">tous ({queue.length})</option>
            {statutsPresents.map((s) => (
              <option key={s} value={s}>
                {LABELS_STATUT[s] ?? s} ({queue.filter((q) => q.statut === s).length})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-neutral-500">
          Type de cible
          <select
            value={filtreCible}
            onChange={(e) => {
              setFiltreCible(e.target.value);
              setLimite(PAS_AFFICHAGE);
            }}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="tous">tous</option>
            {ciblesPresentes.map((c) => (
              <option key={c} value={c}>
                {LABELS_CIBLE[c] ?? c} ({queue.filter((q) => (q.cible_type ?? "(sans cible)") === c).length})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-neutral-500">
          Source
          <select
            value={filtreSource}
            onChange={(e) => {
              setFiltreSource(e.target.value);
              setLimite(PAS_AFFICHAGE);
            }}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="toutes">toutes</option>
            {sourcesPresentes.map((s) => (
              <option key={s} value={s}>
                {s} ({queue.filter((q) => (q.source_id ?? "(sans source)") === s).length})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-neutral-500">
          Score de fiabilité minimum
          <select
            value={String(scoreMin)}
            onChange={(e) => {
              setScoreMin(Number(e.target.value));
              setLimite(PAS_AFFICHAGE);
            }}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="0">aucun seuil</option>
            {scoresPresents.map((s) => (
              <option key={s} value={String(s)}>
                ≥ {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-neutral-500">
          Décision de cette revue
          <select
            value={filtreDecision}
            onChange={(e) => {
              setFiltreDecision(e.target.value as typeof filtreDecision);
              setLimite(PAS_AFFICHAGE);
            }}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="tous">toutes</option>
            <option value="non_decides">non encore décidées</option>
            <option value="approuves">approuvées</option>
            <option value="rejetes">rejetées</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-neutral-500">
          Recherche plein texte
          <input
            type="search"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setLimite(PAS_AFFICHAGE);
            }}
            placeholder="titre, extrait, cible, note de tri…"
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </label>
      </div>

      {/* Actions en lot */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-neutral-500" aria-live="polite">
          {filtrees.length} proposition{filtrees.length > 1 ? "s" : ""} dans le filtre courant · {compteurs.total}{" "}
          décision{compteurs.total > 1 ? "s" : ""} prise{compteurs.total > 1 ? "s" : ""} ({compteurs.approuves}{" "}
          approuvée{compteurs.approuves > 1 ? "s" : ""}, {compteurs.rejetes} rejetée
          {compteurs.rejetes > 1 ? "s" : ""})
        </span>
        <button
          type="button"
          onClick={() => deciderEnLot("approuver")}
          disabled={filtrees.length === 0}
          className="rounded border border-emerald-600 px-3 py-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          Approuver les {filtrees.length} du filtre
        </button>
        <button
          type="button"
          onClick={() => deciderEnLot("rejeter")}
          disabled={filtrees.length === 0}
          className="rounded border border-red-600 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950"
        >
          Rejeter les {filtrees.length} du filtre
        </button>
        <button
          type="button"
          onClick={toutEffacer}
          disabled={compteurs.total === 0}
          className="rounded border border-neutral-300 px-3 py-1 text-neutral-600 hover:border-neutral-500 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400"
        >
          Effacer toutes les décisions
        </button>
      </div>

      {/* Export */}
      <div className="mt-4 rounded border border-neutral-200 p-3 dark:border-neutral-800">
        <h3 className="text-sm font-medium">Exporter la décision</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Deux fichiers, deux usages : la <strong>file révisée</strong> remplace{" "}
          <code>data/seed/veille_queue.json</code> et alimente la chaîne de patchs ; le{" "}
          <strong>journal de décisions</strong> ne sert qu&apos;à la relecture (qui a décidé quoi, et pourquoi), il ne
          se substitue à aucun fichier du dépôt.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => exporter("file")}
            disabled={compteurs.total === 0}
            className="rounded border border-neutral-900 bg-neutral-900 px-3 py-1 text-white disabled:opacity-40 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Télécharger veille_queue.json révisé
          </button>
          <button
            type="button"
            onClick={() => exporter("journal")}
            disabled={compteurs.total === 0}
            className="rounded border border-neutral-300 px-3 py-1 text-neutral-600 hover:border-neutral-500 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400"
          >
            Télécharger le journal de décisions
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded bg-neutral-100 p-3 text-[11px] leading-relaxed text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
{`# 1. remplacer la file par le fichier téléchargé, puis vérifier l'intégrité
cp ~/Downloads/veille_queue.json data/seed/veille_queue.json
npm run valider

# 2. traduire les propositions approuvées en patchs (n'écrit AUCUNE fiche)
npm run veille-patchs

# 3. relire data/patchs/patchs-veille-<date>.json, passer \`retenu: false\`
#    sur ce qui est écarté, puis simuler avant d'appliquer
node scripts/appliquer-patchs.mjs --patchs=data/patchs/patchs-veille-<date>.json --dry-run
node scripts/appliquer-patchs.mjs --patchs=data/patchs/patchs-veille-<date>.json`}
        </pre>
      </div>

      {/* Liste des propositions */}
      <ul className="mt-4 space-y-2 text-sm">
        {visibles.map((q) => {
          const p = normaliserProposition(q);
          const d = decisions[q.id];
          return (
            <li
              key={q.id}
              className={`rounded border p-3 ${
                d?.action === "approuver"
                  ? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30"
                  : d?.action === "rejeter"
                    ? "border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30"
                    : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                {p.href ? (
                  <a href={p.href} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {p.titre}
                  </a>
                ) : (
                  <span className="font-medium">{p.titre}</span>
                )}
                <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">fiabilité {q.score_fiabilite}</span>
              </div>

              {p.texte && <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{p.texte}</p>}

              <p className="mt-1 text-xs text-neutral-500">
                {p.badge}
                {q.cible_id ? ` → ${q.cible_id}` : ""}
                {p.dateStr ? ` — ${p.dateStr}` : ""} — statut actuel : {LABELS_STATUT[q.statut] ?? q.statut}
                {q.source_id ? ` — source ${q.source_id}` : ""}
              </p>

              {q.note_tri && <p className="mt-1 text-xs italic text-neutral-500">Note de tri : {q.note_tri}</p>}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => decider(q.id, "approuver")}
                  aria-pressed={d?.action === "approuver"}
                  className={classeBouton(d?.action === "approuver", "vert")}
                >
                  Approuver → {LABELS_STATUT[statutApprobation(q)]}
                </button>
                <button
                  type="button"
                  onClick={() => decider(q.id, "rejeter")}
                  aria-pressed={d?.action === "rejeter"}
                  className={classeBouton(d?.action === "rejeter", "rouge")}
                >
                  Rejeter
                </button>
                {d && (
                  <label className="flex min-w-[16rem] flex-1 items-center gap-2 text-xs text-neutral-500">
                    <span className="sr-only">Motif de la décision pour la proposition {q.id}</span>
                    <input
                      type="text"
                      value={d.motif}
                      onChange={(e) => motiver(q.id, e.target.value)}
                      placeholder="Motif (repris dans note_tri et dans le journal)"
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {filtrees.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">Aucune proposition ne correspond à ce filtre.</p>
      )}

      {filtrees.length > visibles.length && (
        <button
          type="button"
          onClick={() => setLimite((n) => n + PAS_AFFICHAGE)}
          className="mt-3 rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
        >
          Afficher {Math.min(PAS_AFFICHAGE, filtrees.length - visibles.length)} proposition
          {Math.min(PAS_AFFICHAGE, filtrees.length - visibles.length) > 1 ? "s" : ""} de plus ({visibles.length}/
          {filtrees.length} affichées)
        </button>
      )}
    </div>
  );
}

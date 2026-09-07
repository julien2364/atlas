// Types de données du référentiel ATLAS Humain × IA
// Cf. megaprompt (docs/megaprompt.md) sections 3, 4 et 5 pour le détail des formats de fiche.

export type Statut = "a_documenter" | "documente" | "verifie_recemment" | "a_re_auditer";

export type NiveauConfiance = "fait_verifie" | "consensus_scientifique" | "opinion_majoritaire" | "hypothese_prospective";

export interface Source {
  titre: string;
  url?: string;
  date?: string; // ISO 8601
  type: "primaire" | "secondaire";
}

// Référentiel A — capacités humaines (sections 3, axes A1-A5)
export type AxeHumain = "social" | "psychologique" | "philosophique" | "evolution" | "serenite";

export interface FicheHumaine {
  id: string; // slug
  axe: AxeHumain;
  nom: string;
  periode_courant?: string;
  sous_domaine?: string; // ex: "philosophie", "modele_politique", "economie", "gouvernance_mondiale", "sciences", "management"
  these_centrale: string;
  apport: string;
  limites_critiques: string;
  resonance_ia?: string;
  sources: Source[];
  statut: Statut;
  derniere_verification: string; // ISO date
}

// Référentiel B — capacités IA (section 4, axes B1-B5)
export type AxeIA = "generatif_raisonnement" | "agentique" | "scientifique" | "sectoriel" | "limites" | "predictif_data_science";

export type SecteurUsage = "science" | "education" | "recherche" | "industrie" | "pharmaceutique" | "gouvernement";

// Degré de diffusion d'un usage — délibérément NON chiffré (audit du 07/09,
// docs/audit-fiches-ia-2026-09-07.md §3). Le TRL est une norme externe
// (NASA 1974, ISO 16290:2013, annexe G d'Horizon 2020) qui mesure une seule
// chose : le degré auquel un SYSTÈME a été validé dans l'environnement où il
// doit opérer. Le référentiel s'en servait aussi pour dire « très cité », « très
// ancien » ou « très répandu », ce que l'échelle ne mesure pas. Plutôt que de
// redéfinir localement une norme — ce qui lui garderait son autorité en la
// vidant de son contenu —, ces sens-là passent dans un champ distinct, textuel,
// impossible à moyenner avec un TRL.
export type Diffusion =
  | "emergent" // premiers usages publics, pas encore de pratique établie
  | "etabli" // pratique installée dans un milieu professionnel ou académique
  | "standard" // choix par défaut du domaine, présent partout
  | "historique"; // a été standard, remplacé depuis par autre chose

export interface UsageSectoriel {
  secteur: SecteurUsage;
  description: string;
  /**
   * Technology Readiness Level, 1-9. FACULTATIF depuis le lot de correction du
   * 07/09/2026, et `null` explicitement autorisé au sens « non déterminable ».
   *
   * Ne se renseigne QUE pour un usage portant sur un système dont on peut nommer
   * l'exploitant, le lieu et la date. Si cette phrase ne peut pas être écrite, le
   * champ vaut `null` et c'est `diffusion` qui porte l'information. Un phénomène
   * (hallucination, biais, contrainte énergétique) et une méthode considérée en
   * elle-même (régression linéaire, ACP) n'ont pas de TRL : le champ n'y a aucun
   * référent.
   */
  trl?: number | null;
  /**
   * Phrase nommant le déploiement qui fonde le chiffre. Exigible dès qu'un `trl`
   * est posé : c'est ce qui rend la valeur auditable, et ce qui aurait rendu
   * impossible d'écrire « AlexNet, industrie, TRL 9 ».
   */
  trl_justification?: string;
  /** Degré de diffusion, employé là où le TRL n'a pas de référent. */
  diffusion?: Diffusion;
  exemples: string[];
  sources: Source[];
}

export interface FicheIA {
  id: string; // slug
  axe: AxeIA;
  nom: string;
  editeur?: string;
  architecture?: string;
  capacites_cles: string[];
  usages: UsageSectoriel[];
  limites_connues: string;
  sources: Source[];
  statut: Statut;
  derniere_verification: string;
}

// Fiche de gap analysis (section 5)
export type Substituabilite =
  | "remplacable_totalement"
  | "remplacable_avec_supervision"
  | "non_remplacable"
  | "remplacable_avec_autre_technologie";

// Axe prospectif (Lot 9) — une branche future nommée parmi plusieurs possibles,
// plutôt qu'une seule trajectoire linéaire (present/5ans/15_20ans). Même logique
// que Perspective pour les questions : jamais un seul scénario présenté comme
// acquis, chacun porte son propre niveau de confiance.
export interface AxeProspectif {
  nom: string; // ex. "Adoption encadrée", "Rupture réglementaire", "Statu quo"
  description: string;
  niveau_confiance: NiveauConfiance;
}

export interface FicheGap {
  id: string;
  fiche_humaine_id: string;
  fiche_ia_id: string;
  apport_ia: string;
  mecanisme: string;
  amelioration_possible: string;
  mode_interaction: string;
  substituabilite: Substituabilite;
  technologie_complementaire?: string; // si remplacable_avec_autre_technologie
  scenario_present: string;
  scenario_5ans: string;
  scenario_15_20ans: string;
  confiance: "elevee" | "moyenne" | "faible";
  // Lot 9 (comparateur approfondi) — champs optionnels, rétrocompatibles.
  sujet?: string; // thématique large dans laquelle s'inscrit la paire
  sous_themes?: string[];
  axes_recherche?: string[];
  documents_cles?: Source[];
  axes_prospectifs?: AxeProspectif[]; // plusieurs futurs nommés, en plus des scenario_*
  statut: Statut;
  derniere_verification: string;
}

// Veille et changelog (section 7)
export interface SourceVeille {
  id: string;
  nom: string;
  type: "rss" | "spiderfoot";
  url?: string;
  domaine: string; // ex: "IA", "economie", "philosophie"
  actif: boolean;
}

export interface ChangelogEntry {
  id: string;
  date: string;
  type: "ajout" | "mise_a_jour" | "correction" | "evolution_structurelle";
  cible: string; // id de fiche ou nom de section
  resume: string;
  source?: Source;
}

// Questions (section 7.3 / Lot 8) — chaque question peut être lue sous plusieurs
// modèles/écoles de pensée, jamais un seul verdict (cf. principe de neutralité
// active, /methodologie). Même logique que scenario_present/5ans/15_20ans des
// fiches de gap : on nomme explicitement le degré de certitude plutôt que de le
// laisser implicite.
export interface Perspective {
  modele: string; // nom de l'école/du cadre théorique, ex. "Keynésianisme", "École autrichienne"
  hypotheses: string; // postulats de départ du modèle (ce qu'il faut accepter pour que la réponse tienne)
  etat_actuel: string; // ce que les faits/données établies montrent aujourd'hui, indépendamment du modèle
  reponse: string; // ce que ce modèle répond à la question posée
  justification: string; // pourquoi cette réponse découle des hypothèses + de l'état actuel
  limites: string; // ce que ce modèle n'explique pas ou explique mal
  sources: Source[];
  niveau_confiance: NiveauConfiance;
}

export interface Question {
  id: string;
  question: string;
  sous_questions?: string[];
  axes_recherche?: string[];
  perspectives: Perspective[];
}

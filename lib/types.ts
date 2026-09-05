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

export interface UsageSectoriel {
  secteur: SecteurUsage;
  description: string;
  trl: number; // 1-9, Technology Readiness Level
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

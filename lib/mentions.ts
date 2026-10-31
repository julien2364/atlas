// Textes juridiques du lot MENTIONS-P27 — SOURCE UNIQUE (règle 1 du lot) :
// le bandeau de pied de page et la clause anti-reproduction sont définis ici
// et nulle part ailleurs. {ANNEE_COURANTE} est calculée automatiquement à
// l'exécution, jamais écrite en dur. Aucun numéro INPI ni aucune année de
// dépôt ne doit apparaître ici (décision Julien 31/10 13 h 24).

/** Chemin de la page de mentions légales, liée depuis le pied de page. */
export const CHEMIN_MENTIONS_LEGALES = "/mentions-legales";

/** Modèle du bandeau ; {ANNEE_COURANTE} est remplacé à l'exécution. */
export const MODELE_BANDEAU_MARQUE =
  "© {ANNEE_COURANTE} DYONYSOS SASU — Bexo® est une marque déposée. Tous droits réservés.";

/** Bandeau de pied de page, avec l'année courante calculée automatiquement. */
export function bandeauMarque(annee: number = new Date().getFullYear()): string {
  return MODELE_BANDEAU_MARQUE.replace("{ANNEE_COURANTE}", String(annee));
}

/** Paragraphe « Propriété intellectuelle » à afficher dans les mentions légales. */
export const CLAUSE_PROPRIETE_INTELLECTUELLE =
  "Propriété intellectuelle — L'ensemble des éléments de ce site (textes, images, logos, graphismes, mise en page, code source, bases de données) est protégé par le droit d'auteur (articles L.111-1 et suivants du Code de la propriété intellectuelle) et, pour les bases de données, par le droit du producteur (articles L.341-1 et suivants). Toute reproduction, représentation, adaptation, traduction ou extraction, totale ou partielle, par quelque procédé que ce soit, sans l'autorisation écrite préalable de DYONYSOS SASU est interdite et constitue une contrefaçon sanctionnée par les articles L.335-2 et suivants du même code.";

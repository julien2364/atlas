/*
 * Test unitaire du lot MENTIONS-P27 (règle 5) : vérifie la source unique des
 * textes juridiques (lib/mentions.ts) — bandeau avec année courante calculée
 * automatiquement, clause anti-reproduction exacte, chemin des mentions
 * légales, et absence de tout numéro INPI.
 *
 * Usage : npm test   (node --test tests/)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  bandeauMarque,
  CHEMIN_MENTIONS_LEGALES,
  CLAUSE_PROPRIETE_INTELLECTUELLE,
  MODELE_BANDEAU_MARQUE,
} from "../lib/mentions.ts";

const ANNEE = new Date().getFullYear();

test("bandeau : texte exact avec l'année courante calculée automatiquement", () => {
  assert.equal(
    bandeauMarque(),
    `© ${ANNEE} DYONYSOS SASU — Bexo® est une marque déposée. Tous droits réservés.`,
  );
});

test("bandeau : le modèle ne contient aucune année écrite en dur", () => {
  assert.ok(MODELE_BANDEAU_MARQUE.includes("{ANNEE_COURANTE}"));
  assert.equal(bandeauMarque(2031), "© 2031 DYONYSOS SASU — Bexo® est une marque déposée. Tous droits réservés.");
  assert.ok(!/\b(19|20)\d{2}\b/.test(MODELE_BANDEAU_MARQUE));
});

test("bandeau : aucun numéro INPI ni mention INPI", () => {
  assert.ok(!/INPI/i.test(bandeauMarque()));
  assert.ok(!bandeauMarque().includes("5111908"));
});

test("bandeau : le nom du produit n'est jamais associé à Bexo (règle 2)", () => {
  assert.ok(!/ATLAS/i.test(bandeauMarque()));
});

test("clause anti-reproduction : texte exact, tel que transmis", () => {
  assert.equal(
    CLAUSE_PROPRIETE_INTELLECTUELLE,
    "Propriété intellectuelle — L'ensemble des éléments de ce site (textes, images, logos, graphismes, mise en page, code source, bases de données) est protégé par le droit d'auteur (articles L.111-1 et suivants du Code de la propriété intellectuelle) et, pour les bases de données, par le droit du producteur (articles L.341-1 et suivants). Toute reproduction, représentation, adaptation, traduction ou extraction, totale ou partielle, par quelque procédé que ce soit, sans l'autorisation écrite préalable de DYONYSOS SASU est interdite et constitue une contrefaçon sanctionnée par les articles L.335-2 et suivants du même code.",
  );
});

test("clause : aucun numéro INPI ni aucune année de dépôt", () => {
  assert.ok(!/INPI/i.test(CLAUSE_PROPRIETE_INTELLECTUELLE));
  assert.ok(!CLAUSE_PROPRIETE_INTELLECTUELLE.includes("5111908"));
  assert.ok(!/dépôt/i.test(CLAUSE_PROPRIETE_INTELLECTUELLE));
});

test("chemin des mentions légales", () => {
  assert.equal(CHEMIN_MENTIONS_LEGALES, "/mentions-legales");
});

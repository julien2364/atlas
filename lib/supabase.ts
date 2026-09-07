// Clients Supabase du projet (MP-4 : branchés par le moteur de réponse prédictive).
//
// ⚠️ Projet MUTUALISÉ : la base `cvmsozjxpjzvyhinvooa` héberge aussi d'autres
// applications. Toutes les tables d'Atlas y sont préfixées `atlas_`. Ne jamais
// écrire, altérer ou supprimer un objet qui ne porte pas ce préfixe.
//
// Les deux clients sont créés PARESSEUSEMENT, à la première utilisation, et non
// à l'évaluation du module. C'est délibéré : `createClient("", "")` lève
// « supabaseUrl is required » dès l'import. Avec une création à l'import, un
// déploiement sans variables d'environnement faisait planter le chargement de
// app/api/question/route.ts — y compris sa route GET de diagnostic, dont le rôle
// est précisément d'annoncer proprement que les clés manquent. Résultat : une
// erreur 500 opaque au lieu du message « clés manquantes ». La paresse permet à
// chaque appelant de rendre une erreur explicite.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function urlProjet(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

let clientPublic: SupabaseClient | null = null;
let clientService: SupabaseClient | null = null;

/**
 * Client public : soumis aux policies RLS, donc limité à ce que le référentiel
 * expose publiquement en lecture. Utilisable côté navigateur.
 * Il n'a AUCUN accès aux tables `atlas_rag_*`, qui n'ont pas de policy.
 */
export function getSupabaseClient(): SupabaseClient {
  if (clientPublic) return clientPublic;
  const url = urlProjet();
  const cleAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !cleAnon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY manquants — cf. .env.example."
    );
  }
  clientPublic = createClient(url, cleAnon);
  return clientPublic;
}

/**
 * Client serveur (service_role) : contourne toutes les policies RLS.
 *
 * Usage exclusif dans les routes API serveur et les scripts (indexeur, veille).
 * Ne JAMAIS l'appeler depuis un composant "use client" : la clé partirait dans le
 * bundle du navigateur et donnerait un accès total en écriture à une base
 * partagée avec d'autres applications.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (clientService) return clientService;
  const url = urlProjet();
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL manquant — cf. .env.example.");
  }
  if (!cleService) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant — requis côté serveur uniquement, cf. .env.example.");
  }
  // `persistSession: false` : un client serveur est sans état, il ne doit pas
  // tenter d'écrire une session dans un stockage qui n'existe pas.
  clientService = createClient(url, cleService, { auth: { persistSession: false } });
  return clientService;
}

// GET /api/fiches/{id} — une fiche humaine OU une fiche IA (les identifiants ne se
// chevauchent pas entre les deux référentiels ; le champ `type` lève l'ambiguïté).
//
// `force-static` + `generateStaticParams` : les 311 réponses connues sont écrites en
// fichiers au build et servies depuis le CDN, sans exécution de fonction.

import type { NextResponse } from "next/server";
import { fichesHumaines, fichesIA, getFicheHumaine, getFicheIA } from "@/lib/corpus";
import { reponseErreur, reponseRessource, serialiserFicheHumaine, serialiserFicheIA } from "@/lib/api";

export const dynamic = "force-static";

export function generateStaticParams(): { id: string }[] {
  return [...fichesHumaines.map((fiche) => ({ id: fiche.id })), ...fichesIA.map((fiche) => ({ id: fiche.id }))];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const humaine = getFicheHumaine(id);
  if (humaine) return reponseRessource(serialiserFicheHumaine(humaine));

  const ia = getFicheIA(id);
  if (ia) return reponseRessource(serialiserFicheIA(ia));

  return reponseErreur("ressource_introuvable", `Aucune fiche ne porte l'identifiant "${id}".`, 404, {
    ressource: "fiche",
    id,
  });
}

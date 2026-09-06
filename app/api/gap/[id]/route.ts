// GET /api/gap/{id} — une fiche de gap analysis complète, avec les liens vers ses
// deux fiches (humaine et IA). Pré-générée au build pour les 86 identifiants connus.

import type { NextResponse } from "next/server";
import { fichesGap, getFicheGap } from "@/lib/corpus";
import { reponseErreur, reponseRessource, serialiserFicheGap } from "@/lib/api";

export const dynamic = "force-static";

export function generateStaticParams(): { id: string }[] {
  return fichesGap.map((gap) => ({ id: gap.id }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const gap = getFicheGap(id);

  if (!gap) {
    return reponseErreur("ressource_introuvable", `Aucune analyse de gap ne porte l'identifiant "${id}".`, 404, {
      ressource: "gap",
      id,
    });
  }

  return reponseRessource(serialiserFicheGap(gap));
}

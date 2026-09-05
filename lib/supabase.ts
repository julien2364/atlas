import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Client public (lecture, respecte les policies RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client serveur (service role) — usage exclusif dans les routes API / crons de veille,
// jamais exposé côté client.
export function getSupabaseServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant — requis côté serveur uniquement.");
  }
  return createClient(supabaseUrl, serviceKey);
}

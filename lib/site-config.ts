// Mode de diffusion du site — cf. megaprompt v1.1, section 13.2 et section 10.
// "internal" = accès restreint (usage interne Julien), "public" = ouverture publique décidée explicitement.
export const SITE_MODE: "internal" | "public" =
  (process.env.NEXT_PUBLIC_SITE_MODE as "internal" | "public") ?? "internal";

import type { NextConfig } from "next";

// En-têtes de sécurité (audit du 06/11/2026, constat P2 « en-têtes absents »).
//
// CSP établie d'après ce que le site charge réellement :
// - scripts : bundles Next (self) + scripts en ligne (thème sans flash, JSON-LD,
//   données de rendu de Next, radar de visites) → 'unsafe-inline' tant que le
//   site n'a pas de nonce (un nonce imposerait un rendu dynamique de toutes les pages) ;
// - connexions sortantes du navigateur : l'API du site (self) et le radar de visites
//   https://odoo.dyonysos.fr ; Supabase et les fournisseurs d'IA sont appelés côté
//   serveur uniquement, ils n'ont pas à figurer ici ;
// - aucune police, image ou iframe externe.
// En développement, Next a besoin de 'unsafe-eval' et du websocket de rechargement.
// Sur les prévisualisations Vercel, la barre d'outils vient de vercel.live.
const dev = process.env.NODE_ENV !== "production";
const preview = process.env.VERCEL_ENV === "preview";
const vercelLive = preview ? " https://vercel.live" : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${vercelLive}`,
  `style-src 'self' 'unsafe-inline'${vercelLive}`,
  `img-src 'self' data: blob:${preview ? " https://vercel.live https://vercel.com" : ""}`,
  `font-src 'self' data:${preview ? " https://vercel.live https://assets.vercel.com" : ""}`,
  `connect-src 'self' https://odoo.dyonysos.fr${dev ? " ws: wss:" : ""}${preview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
  `frame-src ${preview ? "https://vercel.live" : "'none'"}`,
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const enTetesSecurite = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: enTetesSecurite }];
  },
};

export default nextConfig;

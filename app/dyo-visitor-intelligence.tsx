"use client";
// Radar des visites DYONYSOS (module Odoo Visitor Intelligence) — posé le 23/10/2026.
// Déclare chaque page vue à https://odoo.dyonysos.fr ; aucun cookie ni stockage local.
import Script from "next/script";

export default function DyoVisitorIntelligence() {
  return (
    <Script id="dyo-vi" strategy="afterInteractive">{`
(function () {
  var CIBLE = "https://odoo.dyonysos.fr/dyo_vi/collecte";
  var CLE = "ba75f02f7ca0b704c199b1e46f87626a";
  var derniere = null;
  function envoyer() {
    var u = window.location.href;
    if (u === derniere) { return; }
    derniere = u;
    try {
      fetch(CIBLE, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: null, params: {
          cle: CLE, url: u, referer: document.referrer, titre: document.title
        }})
      }).catch(function () {});
    } catch (e) {}
  }
  function plusTard() { setTimeout(envoyer, 300); }
  ["pushState", "replaceState"].forEach(function (nom) {
    var origine = history[nom];
    history[nom] = function () { var r = origine.apply(this, arguments); plusTard(); return r; };
  });
  window.addEventListener("popstate", plusTard);
  envoyer();
})();
    `}</Script>
  );
}

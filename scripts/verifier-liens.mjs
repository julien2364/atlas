/*
 * Vérificateur de disponibilité des URL du corpus — audit de sourçage.
 *
 * Rôle dans le projet
 * -------------------
 * `scripts/valider-donnees.mjs` vérifie la *structure* du corpus et s'interdit tout
 * appel réseau : il tourne en CI sur chaque commit. Le présent script fait l'inverse
 * et le complète : il ne juge pas la forme des données, il va voir si les `url`
 * déclarées dans les `sources`, les `documents_cles` et les sources de veille
 * répondent encore. C'est la contrepartie technique de l'exigence éditoriale du
 * projet (sourçage systématique daté) : une source dont l'URL est morte n'est plus
 * une source vérifiable, seulement une affirmation.
 *
 * Il n'est donc PAS fait pour tourner à chaque commit (1 000+ requêtes sortantes),
 * mais périodiquement — cron qualité, ou avant une revue de fond.
 *
 * Usage
 * -----
 *   node scripts/verifier-liens.mjs                     # rapport lisible en français
 *   node scripts/verifier-liens.mjs --limite=50         # n'en teste que 50 (mise au point)
 *   node scripts/verifier-liens.mjs --concurrence=8     # nb de requêtes en parallèle (défaut 6)
 *   node scripts/verifier-liens.mjs --delai=12000       # délai d'attente par requête, en ms
 *   node scripts/verifier-liens.mjs --tentatives=3      # essais par URL avant abandon
 *   node scripts/verifier-liens.mjs --seulement-morts   # n'affiche que ce qui ne va pas
 *   node scripts/verifier-liens.mjs --json              # sortie machine, rien d'autre sur stdout
 *   node scripts/verifier-liens.mjs --racine=/chemin    # vérifier une copie du dépôt
 *   node scripts/verifier-liens.mjs --ca=/chemin.pem    # autorité de certification supplémentaire
 *   node scripts/verifier-liens.mjs --aide
 *
 * Codes de sortie
 * ---------------
 *   0  aucune URL morte (le corpus peut contenir des cas non concluants, voir ci-dessous)
 *   1  au moins une URL MORTE avérée (404 / 410 / nom de domaine inexistant)
 *   2  erreur d'usage ou de configuration (option inconnue, corpus introuvable)
 *
 * Un lien mort, un lien bloqué et un lien lent, ce ne sont pas la même chose
 * --------------------------------------------------------------------------
 * C'est le choix structurant du script, et la raison pour laquelle il ne se contente
 * pas d'un `fetch` : dans un environnement d'agent, la sortie HTTPS passe par un proxy
 * d'entreprise qui refuse certains domaines. Un refus du proxy produit une erreur
 * réseau qu'un vérificateur naïf présenterait comme un lien cassé — et on irait
 * corriger des sources parfaitement valides. Chaque URL reçoit donc un verdict parmi :
 *
 *   ok            réponse 2xx (après suivi des redirections)
 *   redirige      2xx atteint après redirection — l'URL stockée gagnerait à être mise à jour
 *   morte         404 ou 410, ou nom de domaine inexistant : à corriger, c'est un vrai défaut
 *   restreinte    401 / 403 / 429 : le serveur répond mais refuse un client automatique
 *                 (paywall, anti-robot). Le lien n'est PAS démontré mort ; vérification humaine.
 *   serveur_ko    5xx : panne côté site, probablement temporaire. Non concluant.
 *   bloquee_proxy le proxy de sortie a refusé le tunnel (CONNECT non-200). Ne dit
 *                 STRICTEMENT RIEN sur l'URL : ce n'est pas un défaut du corpus.
 *   delai         délai d'attente dépassé après toutes les tentatives. Non concluant.
 *   invalide      chaîne qui n'est pas une URL http(s) analysable : défaut de données.
 *
 * Seules `morte` et `invalide` sont des défauts du corpus et font échouer le script.
 * Les autres catégories sont rapportées telles quelles, jamais requalifiées en 404.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

const AIDE = `Vérificateur de disponibilité des URL du corpus ATLAS Humain × IA.

  node scripts/verifier-liens.mjs [options]

Options
  --aide                Affiche cette aide et quitte.
  --limite=N            Ne teste que les N premières URL distinctes (mise au point).
  --concurrence=N       Nombre de requêtes simultanées (défaut 6, max 32).
  --delai=MS            Délai d'attente par tentative, en millisecondes (défaut 15000).
  --tentatives=N        Nombre d'essais par URL avant abandon (défaut 2).
  --seulement-morts     N'affiche que les URL qui ne sont pas en état « ok ».
  --json                Sortie machine : un unique objet JSON sur stdout.
  --racine=CHEMIN       Racine du dépôt à vérifier (défaut : le dépôt de ce script).
  --ca=CHEMIN           Certificat d'autorité supplémentaire (proxy TLS ré-terminé).

Codes de sortie : 0 = aucune URL morte, 1 = au moins une URL morte ou invalide,
2 = erreur d'usage ou de configuration.

Une URL refusée par le proxy de sortie n'est JAMAIS comptée comme morte : elle est
rapportée dans la catégorie « bloquee_proxy », qui ne dit rien du lien lui-même.`;

if (args.includes("--aide") || args.includes("-h") || args.includes("--help")) {
  console.log(AIDE);
  process.exit(0);
}

const OPTIONS_CONNUES = ["--aide", "-h", "--help", "--json", "--seulement-morts"];
const PREFIXES_CONNUS = ["--limite=", "--concurrence=", "--delai=", "--tentatives=", "--racine=", "--ca="];
for (const a of args) {
  if (OPTIONS_CONNUES.includes(a)) continue;
  if (PREFIXES_CONNUS.some((p) => a.startsWith(p))) continue;
  console.error(`Option inconnue : ${a}\n\n${AIDE}`);
  process.exit(2);
}

function valeur(prefixe) {
  const trouve = args.find((a) => a.startsWith(prefixe));
  return trouve === undefined ? undefined : trouve.slice(prefixe.length);
}

function entier(prefixe, defaut, min, max) {
  const brut = valeur(prefixe);
  if (brut === undefined) return defaut;
  const n = Number.parseInt(brut, 10);
  if (!Number.isFinite(n) || n < min || n > max) {
    console.error(`Valeur invalide pour ${prefixe}${brut} (attendu : entier entre ${min} et ${max}).`);
    process.exit(2);
  }
  return n;
}

const SORTIE_JSON = args.includes("--json");
const SEULEMENT_MORTS = args.includes("--seulement-morts");
const LIMITE = entier("--limite=", Infinity, 1, 100000);
const CONCURRENCE = entier("--concurrence=", 6, 1, 32);
const DELAI = entier("--delai=", 15000, 1000, 120000);
const TENTATIVES = entier("--tentatives=", 2, 1, 5);

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = valeur("--racine=") ?? path.resolve(ICI, "..");
const SEED = path.join(RACINE, "data", "seed");

if (!existsSync(SEED)) {
  console.error(`Dossier de données introuvable : ${SEED}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Sortie HTTPS : proxy éventuel + autorité de certification
// ---------------------------------------------------------------------------
//
// Node ne lit PAS HTTPS_PROXY tout seul (contrairement à curl) : sans le code
// ci-dessous, dans une session d'agent, chaque requête échouerait en résolution DNS
// et le rapport annoncerait 1 000 liens morts. On ouvre donc nous-mêmes un tunnel
// CONNECT vers le proxy, et on distingue explicitement son refus (statut CONNECT
// différent de 200) d'une vraie erreur du site visé.

const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || null;

const CHEMINS_CA = [
  valeur("--ca="),
  process.env.NODE_EXTRA_CA_CERTS,
  "/root/.ccr/ca-bundle.crt",
].filter(Boolean);

let AUTORITES;
for (const c of CHEMINS_CA) {
  try {
    if (existsSync(c) && statSync(c).isFile()) {
      AUTORITES = [...tls.rootCertificates, readFileSync(c, "utf-8")];
      break;
    }
  } catch {
    // Un chemin de CA illisible n'est pas fatal : on retombe sur le magasin système.
  }
}

/**
 * Agent HTTPS qui passe par un tunnel CONNECT quand un proxy est configuré.
 * Sans proxy, l'agent standard suffit — le script reste utilisable tel quel sur
 * le poste de Julien, sans variable d'environnement.
 */
class AgentTunnel extends https.Agent {
  createConnection(options, callback) {
    const cible = `${options.host}:${options.port || 443}`;
    const u = new URL(PROXY);
    const requete = http.request({
      host: u.hostname,
      port: Number(u.port) || 80,
      method: "CONNECT",
      path: cible,
      agent: false,
      headers: { Host: cible },
    });
    requete.setTimeout(DELAI, () => requete.destroy(new Error("delai_proxy")));
    requete.on("connect", (reponse, socket) => {
      if (reponse.statusCode !== 200) {
        socket.destroy();
        // Marqueur reconnu plus bas : refus du proxy, verdict « bloquee_proxy ».
        const e = new Error(`PROXY_${reponse.statusCode}`);
        e.code = "PROXY_REFUS";
        callback(e);
        return;
      }
      const chiffre = tls.connect(
        { socket, servername: options.host, ca: AUTORITES },
        () => callback(null, chiffre),
      );
      chiffre.on("error", callback);
    });
    requete.on("error", callback);
    requete.end();
  }
}

const agentHttps = PROXY ? new AgentTunnel({ keepAlive: false }) : new https.Agent({ keepAlive: false, ca: AUTORITES });
const agentHttp = new http.Agent({ keepAlive: false });

// En-tête d'un client identifiable : plusieurs sites (arXiv, éditeurs scientifiques)
// refusent un client anonyme, et un refus mal identifié serait lu comme un lien mort.
const ENTETES = {
  "user-agent": "AtlasHumainIA-VerificateurDeLiens/1.0 (+https://atlas-humain-ia-dyonysos.vercel.app)",
  accept: "*/*",
  "accept-language": "fr,en;q=0.8",
};

// ---------------------------------------------------------------------------
// Collecte des URL du corpus
// ---------------------------------------------------------------------------
//
// On parcourt récursivement chaque JSON de data/seed plutôt que de coder en dur la
// liste des champs : les `sources` sont imbriquées à des profondeurs différentes
// (fiche → sources, fiche IA → usages[] → sources, gap → documents_cles,
// question → perspectives[] → sources, changelog → source). Un parcours générique
// attrape aussi les champs ajoutés plus tard sans qu'il faille modifier ce script.

/** @type {{url:string, fichier:string, id:string|null, champ:string, titre:string|null}[]} */
const occurrences = [];

function fichiersSeed() {
  const liste = [];
  const empiler = (dossier, prefixe) => {
    for (const nom of readdirSync(dossier).sort()) {
      const complet = path.join(dossier, nom);
      if (statSync(complet).isDirectory()) empiler(complet, `${prefixe}${nom}/`);
      else if (nom.endsWith(".json")) liste.push({ chemin: complet, etiquette: `${prefixe}${nom}` });
    }
  };
  empiler(SEED, "");
  return liste;
}

function parcourir(noeud, contexte) {
  if (Array.isArray(noeud)) {
    for (const enfant of noeud) parcourir(enfant, contexte);
    return;
  }
  if (!noeud || typeof noeud !== "object") return;

  // L'id de fiche le plus proche en remontant sert de point d'entrée pour corriger.
  const id = typeof noeud.id === "string" ? noeud.id : contexte.id;

  if (typeof noeud.url === "string" && noeud.url.trim() !== "") {
    occurrences.push({
      url: noeud.url.trim(),
      fichier: contexte.fichier,
      id,
      champ: contexte.champ || "url",
      titre: typeof noeud.titre === "string" ? noeud.titre : typeof noeud.nom === "string" ? noeud.nom : null,
    });
  }

  for (const [cle, valeurEnfant] of Object.entries(noeud)) {
    if (cle === "url") continue;
    parcourir(valeurEnfant, { fichier: contexte.fichier, id, champ: cle });
  }
}

for (const { chemin, etiquette } of fichiersSeed()) {
  let donnees;
  try {
    donnees = JSON.parse(readFileSync(chemin, "utf-8"));
  } catch (e) {
    console.error(`JSON illisible, ignoré : ${etiquette} (${e.message})`);
    continue;
  }
  parcourir(donnees, { fichier: etiquette, id: null, champ: "" });
}

// Une même URL revient des dizaines de fois (Wikipédia surtout) : on ne la teste
// qu'une fois et on rattache toutes ses occurrences au même verdict.
const parUrl = new Map();
for (const o of occurrences) {
  if (!parUrl.has(o.url)) parUrl.set(o.url, []);
  parUrl.get(o.url).push(o);
}

const urlsDistinctes = [...parUrl.keys()];
const aTester = urlsDistinctes.slice(0, LIMITE === Infinity ? urlsDistinctes.length : LIMITE);

// ---------------------------------------------------------------------------
// Test d'une URL
// ---------------------------------------------------------------------------

function requete(urlTexte, methode) {
  return new Promise((resoudre) => {
    let u;
    try {
      u = new URL(urlTexte);
    } catch {
      resoudre({ genre: "invalide", detail: "URL non analysable" });
      return;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      resoudre({ genre: "invalide", detail: `protocole non http(s) : ${u.protocol}` });
      return;
    }

    const transport = u.protocol === "https:" ? https : http;
    const agent = u.protocol === "https:" ? agentHttps : agentHttp;

    const req = transport.request(
      u,
      { method: methode, agent, headers: ENTETES },
      (rep) => {
        // On ne lit jamais le corps : seul le statut nous intéresse, et le lire
        // multiplierait le temps et le volume transféré par un facteur inutile.
        rep.resume();
        resoudre({ genre: "reponse", statut: rep.statusCode, emplacement: rep.headers.location || null });
      },
    );
    req.setTimeout(DELAI, () => req.destroy(new Error("delai")));
    req.on("error", (e) => {
      if (e.code === "PROXY_REFUS" || /^PROXY_\d+$/.test(e.message)) {
        resoudre({ genre: "proxy", detail: e.message });
      } else if (e.message === "delai" || e.message === "delai_proxy" || e.code === "ETIMEDOUT") {
        resoudre({ genre: "delai", detail: "délai d'attente dépassé" });
      } else if (e.code === "ENOTFOUND" && !PROXY) {
        // Sans proxy, un nom de domaine introuvable est un vrai défaut de la source.
        // Avec proxy, la résolution a lieu côté proxy : on ne peut pas conclure.
        resoudre({ genre: "dns", detail: "nom de domaine inexistant" });
      } else {
        resoudre({ genre: "reseau", detail: `${e.code || "erreur"} : ${e.message}` });
      }
    });
    req.end();
  });
}

/**
 * HEAD d'abord (rapide, pas de corps), GET en repli : beaucoup de serveurs
 * répondent 403/405/501 à un HEAD qu'ils honoreraient en GET. Ne pas faire ce repli
 * produirait des faux « liens cassés » sur des sites parfaitement vivants.
 */
async function tester(urlDepart) {
  let url = urlDepart;
  const chemin = [];

  for (let saut = 0; saut <= 5; saut++) {
    let res = null;

    for (let essai = 1; essai <= TENTATIVES; essai++) {
      res = await requete(url, "HEAD");
      if (res.genre === "reponse" && [403, 405, 400, 501, 500].includes(res.statut)) {
        const parGet = await requete(url, "GET");
        if (parGet.genre === "reponse") res = parGet;
      } else if (res.genre === "delai" || res.genre === "reseau") {
        const parGet = await requete(url, "GET");
        if (parGet.genre === "reponse") res = parGet;
      }
      if (res.genre === "reponse" || res.genre === "invalide" || res.genre === "dns" || res.genre === "proxy") break;
      if (essai < TENTATIVES) await new Promise((r) => setTimeout(r, 400 * essai));
    }

    if (res.genre === "invalide") return { etat: "invalide", detail: res.detail, url_finale: url };
    if (res.genre === "proxy") return { etat: "bloquee_proxy", detail: res.detail, url_finale: url };
    if (res.genre === "dns") return { etat: "morte", statut: null, detail: res.detail, url_finale: url };
    if (res.genre === "delai") return { etat: "delai", detail: res.detail, url_finale: url };
    if (res.genre === "reseau") return { etat: "delai", detail: res.detail, url_finale: url };

    const s = res.statut;
    if (s >= 300 && s < 400 && res.emplacement) {
      chemin.push(url);
      try {
        url = new URL(res.emplacement, url).toString();
      } catch {
        return { etat: "invalide", statut: s, detail: `redirection illisible : ${res.emplacement}`, url_finale: url };
      }
      continue;
    }

    const commun = { statut: s, url_finale: url, redirections: chemin.length };
    if (s >= 200 && s < 300) return { ...commun, etat: chemin.length > 0 ? "redirige" : "ok" };
    if (s === 404 || s === 410) return { ...commun, etat: "morte", detail: `HTTP ${s}` };
    if (s === 401 || s === 403 || s === 429) return { ...commun, etat: "restreinte", detail: `HTTP ${s} — le serveur répond mais refuse un client automatique` };
    if (s >= 500) return { ...commun, etat: "serveur_ko", detail: `HTTP ${s}` };
    return { ...commun, etat: "restreinte", detail: `HTTP ${s}` };
  }

  return { etat: "restreinte", detail: "trop de redirections (>5)", url_finale: url };
}

// ---------------------------------------------------------------------------
// Exécution avec concurrence bornée
// ---------------------------------------------------------------------------

const resultats = [];
let faits = 0;

async function ouvrier(file) {
  for (;;) {
    const url = file.shift();
    if (url === undefined) return;
    const debut = Date.now();
    const verdict = await tester(url);
    faits++;
    if (!SORTIE_JSON && process.stderr.isTTY) {
      process.stderr.write(`\r  ${faits}/${aTester.length} testées…`);
    }
    resultats.push({
      url,
      ...verdict,
      ms: Date.now() - debut,
      occurrences: parUrl.get(url).map((o) => ({ fichier: o.fichier, id: o.id, champ: o.champ, titre: o.titre })),
    });
  }
}

const file = [...aTester];
await Promise.all(Array.from({ length: Math.min(CONCURRENCE, file.length) }, () => ouvrier(file)));
if (!SORTIE_JSON && process.stderr.isTTY) process.stderr.write("\r[K");

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------

const ORDRE = ["morte", "invalide", "restreinte", "serveur_ko", "delai", "bloquee_proxy", "redirige", "ok"];
const LIBELLES = {
  ok: "OK (2xx)",
  redirige: "OK après redirection",
  morte: "MORTE (404/410/DNS)",
  invalide: "INVALIDE (pas une URL exploitable)",
  restreinte: "RESTREINTE (401/403/429 — non concluant)",
  serveur_ko: "SERVEUR EN PANNE (5xx — non concluant)",
  delai: "DÉLAI DÉPASSÉ (non concluant)",
  bloquee_proxy: "BLOQUÉE PAR LE PROXY DE SESSION (ne dit rien de l'URL)",
};

const parEtat = {};
for (const r of resultats) (parEtat[r.etat] ??= []).push(r);

const defauts = [...(parEtat.morte ?? []), ...(parEtat.invalide ?? [])];
const nbOccurrencesTestees = resultats.reduce((n, r) => n + r.occurrences.length, 0);

if (SORTIE_JSON) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: defauts.length === 0,
        proxy: PROXY ? "actif" : "aucun",
        total_occurrences: occurrences.length,
        total_urls_distinctes: urlsDistinctes.length,
        urls_testees: resultats.length,
        occurrences_couvertes: nbOccurrencesTestees,
        repartition: Object.fromEntries(ORDRE.map((e) => [e, (parEtat[e] ?? []).length])),
        resultats: SEULEMENT_MORTS ? resultats.filter((r) => r.etat !== "ok" && r.etat !== "redirige") : resultats,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(defauts.length > 0 ? 1 : 0);
}

console.log("VÉRIFICATION DES LIENS DU CORPUS ATLAS — data/seed/");
console.log(`Racine : ${RACINE}`);
console.log(`Sortie HTTPS : ${PROXY ? `via proxy ${PROXY} (tunnel CONNECT)` : "directe"}`);
console.log(
  `${occurrences.length} occurrence(s) d'URL, ${urlsDistinctes.length} URL distincte(s), ${resultats.length} testée(s)` +
    (LIMITE !== Infinity ? ` (--limite=${LIMITE})` : "") +
    ` — concurrence ${CONCURRENCE}, délai ${DELAI} ms, ${TENTATIVES} tentative(s).`,
);

console.log(`\n${"─".repeat(72)}\nRÉPARTITION`);
for (const etat of ORDRE) {
  const n = (parEtat[etat] ?? []).length;
  if (n === 0) continue;
  console.log(`  ${String(n).padStart(5)}  ${LIBELLES[etat]}`);
}

for (const etat of ORDRE) {
  const lot = parEtat[etat] ?? [];
  if (lot.length === 0) continue;
  if (SEULEMENT_MORTS && (etat === "ok" || etat === "redirige")) continue;
  if (etat === "ok") continue; // 900 lignes « ok » n'apprennent rien : le compteur suffit.
  console.log(`\n${"─".repeat(72)}\n${LIBELLES[etat]} — ${lot.length}`);
  for (const r of lot.slice(0, 60)) {
    const où = r.occurrences.slice(0, 3).map((o) => `${o.fichier}${o.id ? `#${o.id}` : ""}`).join(", ");
    const suite = r.occurrences.length > 3 ? ` (+${r.occurrences.length - 3})` : "";
    console.log(`  ${r.url}`);
    console.log(`      ${r.detail ?? ""}${r.etat === "redirige" ? ` → ${r.url_finale}` : ""}`);
    console.log(`      cité par : ${où}${suite}`);
  }
  if (lot.length > 60) console.log(`  … et ${lot.length - 60} autre(s).`);
}

console.log(`\n${"═".repeat(72)}`);
if (defauts.length === 0) {
  console.log("Aucune URL morte détectée parmi les URL réellement testables.");
} else {
  console.log(`${defauts.length} URL en défaut (morte ou invalide) — à corriger dans le corpus.`);
}
const nonConcluants = (parEtat.bloquee_proxy ?? []).length + (parEtat.delai ?? []).length + (parEtat.serveur_ko ?? []).length + (parEtat.restreinte ?? []).length;
if (nonConcluants > 0) {
  console.log(`${nonConcluants} URL non concluantes (proxy, délai, 5xx, anti-robot) : ni saines ni mortes, à revérifier hors session bridée.`);
}
console.log("═".repeat(72));

process.exit(defauts.length > 0 ? 1 : 0);

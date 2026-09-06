# API publique ATLAS Humain × IA (lecture seule)

Version du contrat : **1** (`api_version` dans chaque réponse, en-tête `X-Atlas-Api-Version`).
Lot MP-6 — pages par fiche, SEO et API publique.

L'API expose en JSON le même corpus que le site : **267 fiches humaines**, **44 fiches IA**,
**86 fiches de gap analysis**. Elle est en lecture seule, sans authentification, et destinée à
être consommée par d'autres projets (agrégation, veille, Content Engine, notebooks).

---

## 1. URL de base

| Environnement | URL |
| --- | --- |
| Production Vercel | `https://atlas-humain-ia-dyonysos.vercel.app` |
| Local | `http://localhost:3000` |

L'URL de base utilisée pour construire les champs `url` / `api_url`, les balises canoniques,
le JSON-LD et `sitemap.xml` vient de la variable d'environnement :

```
NEXT_PUBLIC_SITE_URL=https://atlas-humain-ia-dyonysos.vercel.app
```

- Définie dans `lib/site-config.ts` (`SITE_URL`), avec **repli automatique** sur
  `https://atlas-humain-ia-dyonysos.vercel.app` si la variable est absente.
- Préfixe `NEXT_PUBLIC_` obligatoire : la valeur est figée au moment du `next build`, y compris
  dans les pages statiques et le sitemap.
- À renseigner dans les *Environment Variables* du projet Vercel dès qu'un domaine propre est
  branché (sinon toutes les URLs canoniques continueront de pointer vers `*.vercel.app`).
- Les déploiements de *preview* Vercel héritent de la valeur de production : c'est volontaire
  (les canonicals d'une preview doivent désigner la production, pas l'URL éphémère).

Variable liée : `NEXT_PUBLIC_SITE_MODE` (`internal` par défaut, `public` dans `.env.production`).
En mode `internal`, `robots.txt` interdit toute indexation et les métadonnées passent en
`noindex, nofollow`. L'API reste fonctionnelle dans les deux modes.

---

## 2. Forme des réponses

Toutes les réponses sont en `application/json; charset=utf-8`.

### Collection

```json
{
  "api_version": "1",
  "corpus_maj": "2026-09-06",
  "filtres": { "type": "ia", "axe": null, "statut": null, "sous_domaine": null, "q": null },
  "pagination": { "page": 1, "par_page": 20, "total": 44, "total_pages": 3 },
  "donnees": [ { "...": "objet fiche" } ]
}
```

### Ressource unitaire

```json
{
  "api_version": "1",
  "corpus_maj": "2026-09-06",
  "donnees": { "...": "objet fiche" }
}
```

### Erreur

```json
{
  "api_version": "1",
  "erreur": {
    "code": "ressource_introuvable",
    "message": "Aucune fiche ne porte l'identifiant \"foo\".",
    "ressource": "fiche",
    "id": "foo"
  }
}
```

| Code HTTP | `erreur.code` | Cause |
| --- | --- | --- |
| 400 | `parametre_invalide` | Valeur hors énumération, entier hors bornes. Le message liste les valeurs acceptées. |
| 404 | `ressource_introuvable` | Identifiant inconnu. `ressource` vaut `fiche` ou `gap`. |

`corpus_maj` est la date de vérification la plus récente de tout le corpus : elle change à
chaque enrichissement des données, jamais à chaque build. Utilisable comme jeton de fraîcheur.

---

## 3. Cache et CORS

| Type de réponse | En-tête `Cache-Control` |
| --- | --- |
| Collections (`/api/fiches`, `/api/gap`) | `public, max-age=0, s-maxage=3600, stale-while-revalidate=86400` |
| Ressources (`/api/fiches/{id}`, `/api/gap/{id}`, `/api/meta`) | `public, max-age=600, s-maxage=86400, stale-while-revalidate=604800` |
| 404 | `public, max-age=60, s-maxage=3600` |
| 400 | `no-store` |

Le contenu ne change qu'au redéploiement : un cache long côté CDN est sans risque.
`Access-Control-Allow-Origin: *` est envoyé sur toutes les réponses — l'API est appelable
directement depuis un navigateur tiers. Seul `GET` est exposé.

---

## 4. Endpoints

### `GET /api/fiches`

Collection unifiée des fiches humaines et IA, filtrable et paginée.

| Paramètre | Type | Défaut | Détail |
| --- | --- | --- | --- |
| `type` | `humaine` \| `ia` | — | Restreint à un référentiel. |
| `axe` | énum | — | Humain : `social`, `psychologique`, `philosophique`, `evolution`, `serenite`. IA : `generatif_raisonnement`, `agentique`, `scientifique`, `sectoriel`, `limites`, `predictif_data_science`. |
| `statut` | énum | — | `a_documenter`, `documente`, `verifie_recemment`, `a_re_auditer`. |
| `sous_domaine` | chaîne | — | Fiches humaines uniquement (`philosophie`, `economie`, `sciences`, `management`…). Combiné à `type=ia`, renvoie un ensemble vide. |
| `q` | chaîne | — | Recherche plein texte simple. |
| `page` | entier 1–10000 | `1` | |
| `par_page` | entier 1–100 | `20` | |

**Recherche `q`** : la chaîne est mise en minuscules et débarrassée de ses accents, puis
découpée en mots ; une fiche est retenue si **tous** les mots apparaissent dans son texte indexé
(nom, axe, sous-domaine, thèse, apport, limites, résonance IA côté humain ; nom, éditeur,
architecture, capacités clés, limites côté IA). Pas de score, pas de tolérance aux fautes.

**Ordre** : fiches humaines puis fiches IA, chaque bloc trié par nom (`localeCompare` français).
L'ordre est déterministe, donc la pagination est reproductible.

### `GET /api/fiches/{id}`

Une fiche, humaine ou IA. Les identifiants des deux référentiels ne se chevauchent pas ;
le champ `type` de la réponse (`humaine` ou `ia`) lève l'ambiguïté.

### `GET /api/gap`

| Paramètre | Type | Défaut |
| --- | --- | --- |
| `substituabilite` | `remplacable_totalement`, `remplacable_avec_supervision`, `non_remplacable`, `remplacable_avec_autre_technologie` | — |
| `confiance` | `elevee`, `moyenne`, `faible` | — |
| `statut` | énum statut | — |
| `fiche_humaine` | identifiant de fiche humaine | — |
| `fiche_ia` | identifiant de fiche IA | — |
| `q` | chaîne | — |
| `page` / `par_page` | entiers | `1` / `20` |

Ordre : tri alphabétique sur le titre `fiche humaine × fiche IA`.

### `GET /api/gap/{id}`

Une analyse de gap complète, avec les liens vers ses deux fiches.

### `GET /api/meta`

Dictionnaire du corpus : volumétrie, valeurs autorisées de chaque filtre avec leur libellé
français et leur effectif, liste des endpoints. Point d'entrée conseillé pour un client tiers.

---

## 5. Schéma des objets

### Fiche humaine (`type: "humaine"`)

| Champ | Type | Note |
| --- | --- | --- |
| `id` | chaîne | slug, stable, sert d'URL |
| `type` | `"humaine"` | |
| `nom` | chaîne | |
| `axe` / `axe_libelle` | chaîne | code machine / libellé français |
| `sous_domaine` / `sous_domaine_libelle` | chaîne \| null | |
| `periode_courant` | chaîne \| null | |
| `these_centrale`, `apport`, `limites_critiques` | chaîne | |
| `resonance_ia` | chaîne \| null | |
| `sources` | `Source[]` | |
| `statut` / `statut_libelle` | chaîne | |
| `derniere_verification` | date `YYYY-MM-DD` | |
| `url` | chaîne | page HTML de la fiche |
| `api_url` | chaîne | cette ressource |
| `gaps` | `Lien[]` | analyses de gap citant la fiche |

### Fiche IA (`type: "ia"`)

Mêmes champs communs, plus : `editeur`, `architecture` (chaîne \| null), `capacites_cles`
(chaîne[]), `limites_connues` (chaîne), `usages` (`Usage[]`).

`Usage` : `secteur`, `secteur_libelle`, `description`, `trl` (1–9), `exemples` (chaîne[]),
`sources` (`Source[]`).

### Fiche de gap (`type: "gap"`)

`id`, `titre`, `fiche_humaine` / `fiche_ia` (`Lien | null`), `fiche_humaine_id`, `fiche_ia_id`,
`sujet`, `sous_themes[]`, `axes_recherche[]`, `apport_ia`, `mecanisme`, `amelioration_possible`,
`mode_interaction`, `substituabilite` / `substituabilite_libelle`, `technologie_complementaire`,
`scenario_present`, `scenario_5ans`, `scenario_15_20ans`, `axes_prospectifs[]`
(`{nom, description, niveau_confiance}`), `documents_cles` (`Source[]`),
`confiance` / `confiance_libelle`, `statut` / `statut_libelle`, `derniere_verification`,
`url`, `api_url`.

### Types partagés

- `Source` : `{ titre, url: string|null, date: string|null, type: "primaire" | "secondaire" }`
- `Lien` : `{ id, type: "humaine"|"ia"|"gap", nom, url, api_url }`

Les champs optionnels du modèle interne sont **toujours présents** dans la réponse, valorisés à
`null` ou `[]` : un client n'a jamais à tester l'existence d'une clé.

### Règle de compatibilité

Ajouter un champ est rétrocompatible et ne change pas `api_version`. Renommer ou retirer un
champ, ou modifier la forme de l'enveloppe, impose d'incrémenter `api_version`.
Les identifiants (`id`) sont des slugs stables : ils servent d'URL publiques et de clés de
jointure, ils ne doivent pas être réécrits.

---

## 6. Exemples

```bash
BASE=https://atlas-humain-ia-dyonysos.vercel.app

# Les 20 premières fiches, tous référentiels confondus
curl -s "$BASE/api/fiches" | jq '.pagination, .donnees[0].nom'

# Les fiches IA de l'axe agentique
curl -s "$BASE/api/fiches?type=ia&axe=agentique&par_page=50" | jq '.donnees[].nom'

# Recherche plein texte (les accents sont ignorés)
curl -s "$BASE/api/fiches?q=capitalisme%20chinois" | jq '.donnees[].id'

# Une fiche précise
curl -s "$BASE/api/fiches/friedrich-nietzsche" | jq '.donnees.these_centrale'

# Les paires jugées non remplaçables
curl -s "$BASE/api/gap?substituabilite=non_remplacable&par_page=100" | jq '.donnees[].titre'

# Toutes les analyses portant sur une fiche IA
curl -s "$BASE/api/gap?fiche_ia=claude-anthropic-cowork" | jq '.pagination.total'

# Dictionnaire du corpus
curl -s "$BASE/api/meta" | jq '.donnees.totaux'
```

Parcours complet du corpus (JavaScript) :

```js
const BASE = "https://atlas-humain-ia-dyonysos.vercel.app";

async function toutesLesFiches(filtres = {}) {
  const resultats = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ ...filtres, page: String(page), par_page: "100" });
    const reponse = await fetch(`${BASE}/api/fiches?${params}`);
    if (!reponse.ok) throw new Error((await reponse.json()).erreur.message);
    const { donnees, pagination } = await reponse.json();
    resultats.push(...donnees);
    if (page >= pagination.total_pages) return resultats;
  }
}
```

---

## 7. Choix d'implémentation

`next.config.ts` **n'active pas** `output: "export"` : le site est construit en mode Next.js
standard et déployé sur Vercel. Les *route handlers* sont donc disponibles, et c'est ce qui a
été retenu, avec deux régimes distincts :

- **Ressources unitaires** (`/api/fiches/{id}`, `/api/gap/{id}`, `/api/meta`) :
  `export const dynamic = "force-static"` + `generateStaticParams()`. Les 397 réponses connues
  (311 fiches + 86 analyses de gap), plus `/api/meta`, sont écrites en fichiers au build et
  servies depuis le CDN, sans exécution de fonction.
  Un identifiant inconnu est rendu à la demande et renvoie une 404 JSON propre (plutôt que la
  page 404 HTML qu'imposerait `dynamicParams = false`).
- **Collections** (`/api/fiches`, `/api/gap`) : `export const dynamic = "force-dynamic"`.
  La réponse dépend de la *query string*, elle ne peut donc pas être figée au build ; la mise en
  cache est déléguée au CDN par `s-maxage=3600` + `stale-while-revalidate`, ce qui ramène le
  coût à une exécution par heure et par combinaison de filtres.

**Si le projet passait un jour à `output: "export"`** (site 100 % statique, sans fonctions) :
les routes unitaires resteraient valables telles quelles, mais les deux collections devraient
être remplacées, car un export statique ne peut pas lire de query string. Deux options, dans
l'ordre de préférence :

1. générer au build des fichiers figés (`/api/fiches/index.json` complet, plus une variante par
   axe et par statut) et déplacer le filtrage/la pagination côté client ;
2. ou conserver les collections en fonctions et déployer le reste en statique.

Le corpus étant petit (311 fiches, environ 590 Ko de JSON complet), l'option 1 est réaliste.

---

## 8. Ce que l'API ne fait pas

- Aucune écriture, aucune authentification, aucune donnée personnelle (cf. RGPD, mégaprompt §10).
- Pas de recherche sémantique ni de RAG : `q` est une correspondance de sous-chaînes.
  Le moteur vectoriel reste conditionné au Lot 6 (Supabase/pgvector).
- Pas de tri paramétrable : l'ordre est fixe et documenté ci-dessus.
- Pas de webhook ni de flux d'événements ; pour détecter un changement, comparer `corpus_maj`
  ou surveiller `/veille` et `data/seed/changelog.json`.

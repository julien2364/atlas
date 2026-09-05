# Brief à donner à un autre agent Claude (web/desktop/Claude Code local) — documentation du référentiel humain "Atlas Humain × IA"

À coller tel quel comme premier message dans une nouvelle session Claude (idéalement **Claude Code en local sur ton Mac**, ouverte sur `~/Claude/atlas`, car cette session-ci tourne dans un bac à sable cloud qui n'a pas le droit de push sur GitHub — une session locale avec tes propres identifiants git peut committer ET pusher directement, sans le bricolage de bundle qu'on utilise ici).

---

## Contexte du projet

Dépôt GitHub : `julien2364/atlas`. Clone local attendu : `~/Claude/atlas`. Site déployé : `https://atlas-humain-ia-dyonysos.vercel.app`. Stack : Next.js 16 / React 19 / TypeScript, données statiques dans `data/seed/*.json`, importées au build par des Server Components.

Le projet documente deux référentiels en miroir : les capacités humaines (`data/seed/fiches_humaines/*.json`) et les capacités IA (`data/seed/fiches_ia.json`), pour ensuite les comparer (fiches de gap analysis). Chaque "fiche" a un statut `"a_documenter"` ou `"documente"`. Ta mission : faire passer des fiches `"a_documenter"` à `"documente"`, avec un contenu réellement sourcé (pas inventé).

## Ce qu'il reste à documenter (état au 2026-09-05)

- `data/seed/fiches_humaines/social_1.json` — 68 fiches sur 71 à documenter
- `data/seed/fiches_humaines/social_2.json` — 69 fiches sur 71 à documenter
- `data/seed/fiches_humaines/psychologique.json` — 10 fiches sur 12 à documenter
- `data/seed/fiches_humaines/serenite.json` — 4 fiches sur 5 à documenter
- `data/seed/fiches_ia.json` — 38 fiches sur 44 à documenter

(`evolution.json` et `philosophique.json` viennent d'être terminés à 100% dans une autre session — ne pas y toucher.)

Commence par `psychologique.json` et `serenite.json` (petits lots, pour valider ta méthode), puis attaque `social_1.json`/`social_2.json` (le gros du volume), et termine par `fiches_ia.json` si le temps le permet.

## Schéma exact à respecter (`lib/types.ts`)

Pour une fiche humaine (`FicheHumaine`), les champs à remplir sont :

```ts
these_centrale: string;       // la thèse/l'idée centrale de la personne, du courant ou du phénomène
apport: string;               // ce que cet apport a changé / apporté concrètement
limites_critiques: string;    // limites, critiques reçues, controverses
resonance_ia: string;         // en quoi cette fiche résonne avec les questions posées par l'IA (optionnel mais toujours rempli dans ce projet)
sources: Source[];            // voir ci-dessous
statut: "documente";
derniere_verification: string; // date ISO du jour, ex "2026-09-05"
```

```ts
interface Source {
  titre: string;
  url?: string;
  date?: string;
  type: "primaire" | "secondaire";
}
```

Convention établie dans ce projet : une source `"primaire"` (l'œuvre, le concept, l'institution elle-même — pas forcément d'URL) + une source `"secondaire"` (l'article Wikipédia utilisé pour vérifier les faits, avec son URL réelle).

Ne touche à AUCUN autre champ de la fiche (`id`, `axe`, `nom`, `sous_domaine`, etc. restent inchangés).

## Méthode de recherche — obligatoire, pas de contenu de mémoire

**Aucune clé API n'est nécessaire.** Utilise l'API REST publique et gratuite de Wikipédia :

```
https://fr.wikipedia.org/api/rest_v1/page/summary/<Titre_de_la_page>
```

(remplace les espaces par des underscores dans le titre). Cela renvoie un extrait fiable pour fonder `these_centrale`/`apport`/`limites_critiques`. **N'invente jamais de contenu à partir de la seule mémoire du modèle** — chaque fiche doit être fondée sur un extrait réellement récupéré via cette API (ou, à défaut, une recherche web classique si le sujet n'a pas de page Wikipédia).

Deux pièges rencontrés dans cette session, à connaître :
1. **Rate limiting de `fr.wikipedia.org`** : l'API française renvoie parfois `429 Too Many Requests` sous forte cadence. Solution : utiliser `https://en.wikipedia.org/api/rest_v1/page/summary/<Title>` (aucun rate limiting observé) pour la recherche de fond, tout en citant l'URL Wikipédia française correspondante dans la fiche (uniquement pour des personnes/institutions/concepts non ambigus et mondialement connus — voir point 2).
2. **Faux positifs sur noms ambigus/obscurs** : pour un nom peu connu ou ambigu, vérifie via l'API `opensearch` (`https://fr.wikipedia.org/w/api.php?action=opensearch&search=<terme>&format=json`) que le titre de page trouvé correspond bien à la bonne personne avant de citer son URL — ne présume jamais qu'un titre approximatif est le bon.

## Format de traitement par lot (pattern éprouvé dans cette session)

Pour chaque fichier, écris un script Python jetable (ex. `/tmp/doc-batch-xxx.py`) qui :
1. Charge le JSON.
2. Pour chaque fiche à documenter, construit son contenu (`these_centrale`, `apport`, `limites_critiques`, `resonance_ia`, `sources`) à partir de la recherche Wikipédia.
3. Applique les patches, met `statut: "documente"` et `derniere_verification` à la date du jour.
4. Réécrit le fichier avec `json.dump(data, f, ensure_ascii=False, indent=2)` + une ligne vide finale (`f.write("\n")`), pour rester cohérent avec le style du repo.

Après chaque lot :
- Valide le JSON (`python3 -c "import json; json.load(open('...'))"`).
- Lance `npx tsc --noEmit` puis `npm run build` pour vérifier qu'il n'y a pas de régression.
- Ajoute une entrée à `data/seed/changelog.json` (même format que les entrées existantes — regarde les dernières entrées pour le style).
- `git add` + `git commit` (message en français, style `feat(referentiel-humain): ...`).
- `git push origin main` — ça devrait fonctionner directement depuis ta session locale (contrairement à la session cloud qui a produit ce brief).

## Qualité attendue

Reprends le ton "neutralité active" du projet : pas de survalorisation ni de dénigrement, présenter les limites/critiques de façon honnête, et toujours relier la fiche aux enjeux de l'IA dans `resonance_ia` quand c'est pertinent. Regarde quelques fiches déjà documentées dans `philosophique.json` ou `evolution.json` pour t'imprégner du ton et du niveau de détail attendus (2-4 phrases par champ, dense mais pas superficiel).

## Ce que je n'ai pas besoin que tu me redemandes

- Pas de clé API à demander — Wikipédia REST est public et sans authentification.
- Pas besoin de validation intermédiaire de ma part : enchaîne les lots, je vérifierai le résultat final (build + git log + contenu des fiches).

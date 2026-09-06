# Brief à donner à un autre agent Claude (web/desktop/Claude Code local) — projet "Atlas Humain × IA"

> **Mise à jour du 2026-09-06 : le backlog de documentation initial (ci-dessous) est terminé à 100%.** Toutes les fiches (référentiel humain ET référentiel IA) sont désormais au statut `"documente"` : 311/311 fiches au total. Ce document reste utile pour le contexte du projet et pour les tâches suivantes qui, elles, restent ouvertes — voir la section « Ce qu'il reste à faire (mis à jour) » en bas de fichier.

À coller tel quel comme premier message dans une nouvelle session Claude (idéalement **Claude Code en local sur ton Mac**, ouverte sur `~/Claude/atlas`, car la session cloud qui a produit ce brief n'a pas le droit de push sur GitHub — une session locale avec tes propres identifiants git peut committer ET pusher directement, sans le bricolage de bundle utilisé côté cloud).

---

## Contexte du projet

Dépôt GitHub : `julien2364/atlas`. Clone local attendu : `~/Claude/atlas`. Site déployé : `https://atlas-humain-ia-dyonysos.vercel.app`. Stack : Next.js 16 / React 19 / TypeScript, données statiques dans `data/seed/*.json`, importées au build par des Server Components.

Le projet documente deux référentiels en miroir : les capacités humaines (`data/seed/fiches_humaines/*.json`) et les capacités IA (`data/seed/fiches_ia.json`), pour ensuite les comparer (fiches de gap analysis, `data/seed/fiches_gap.json`). Chaque "fiche" a un statut `"a_documenter"` ou `"documente"`.

## État de la documentation (au 2026-09-06)

| Fichier | Statut |
|---|---|
| `fiches_humaines/evolution.json` | 55/55 ✅ |
| `fiches_humaines/philosophique.json` | 53/53 ✅ |
| `fiches_humaines/psychologique.json` | 12/12 ✅ |
| `fiches_humaines/serenite.json` | 5/5 ✅ |
| `fiches_humaines/social_1.json` | 71/71 ✅ |
| `fiches_humaines/social_2.json` | 71/71 ✅ |
| `fiches_ia.json` | 44/44 ✅ |
| `fiches_gap.json` | 6/6 ✅ |

**Le référentiel de contenu est donc terminé à 100%.** Aucune fiche `"a_documenter"` ne subsiste dans le projet.

## Schéma exact à respecter (`lib/types.ts`)

Pour une fiche humaine (`FicheHumaine`) :

```ts
these_centrale: string;
apport: string;
limites_critiques: string;
resonance_ia: string;
sources: Source[];
statut: "documente";
derniere_verification: string; // ISO date
```

Pour une fiche IA (`FicheIA`), le schéma est différent (voir `lib/types.ts`) :

```ts
editeur?: string;
architecture?: string;
capacites_cles: string[];
usages: UsageSectoriel[]; // {secteur, description, trl, exemples, sources}
limites_connues: string;
sources: Source[];
statut: "documente";
derniere_verification: string;
```

```ts
interface Source {
  titre: string;
  url?: string;
  date?: string;
  type: "primaire" | "secondaire";
}
```

## Méthode de recherche utilisée (pour référence / futures mises à jour)

**Aucune clé API n'est nécessaire.** API REST publique et gratuite de Wikipédia :

```
https://fr.wikipedia.org/api/rest_v1/page/summary/<Titre_de_la_page>
```

(remplace les espaces par des underscores). En cas de rate limiting sévère sur `fr.wikipedia.org` (fréquent), basculer sur `https://en.wikipedia.org/api/rest_v1/page/summary/<Title>` ou sur l'outil `WebFetch` directement sur l'URL Wikipédia (chemin de récupération différent, réussit parfois là où curl échoue). Pour les concepts techniques sans page Wikipédia dédiée (ex. certains frameworks logiciels ou publications scientifiques récentes), citer la source primaire (papier de recherche, documentation éditeur) plutôt que de forcer une citation Wikipédia inexistante.

## Format de traitement par lot (pattern éprouvé sur tout le projet)

Pour chaque fichier à mettre à jour, écrire un script Python jetable (`/tmp/doc-batch-xxx.py`) qui charge le JSON, construit le contenu par fiche à partir de la recherche, applique les patches (`statut: "documente"`, `derniere_verification` à la date du jour), et réécrit le fichier avec `json.dump(data, f, ensure_ascii=False, indent=2)` + `f.write("\n")`.

Après chaque lot : valider le JSON, lancer `npx tsc --noEmit` puis `npm run build`, ajouter une entrée à `data/seed/changelog.json`, committer (message en français, style `feat(referentiel-humain): ...` ou `feat(referentiel-ia): ...`), puis `git push origin main`.

## Ce qu'il reste à faire (mis à jour, 2026-09-06)

Le gros du travail de documentation est terminé. Les chantiers ouverts sont maintenant d'une autre nature :

1. **Validation de la file de veille** (`data/seed/veille_queue.json`, 184 entrées en attente) : le pipeline de veille RSS a proposé des mises à jour candidates pour des fiches existantes, mais aucune n'a encore été validée manuellement. Il faudrait soit construire une interface de validation/approbation en masse dans l'app (`/veille`), soit passer en revue ces 184 propositions une à une pour décider lesquelles méritent une mise à jour de fiche.
2. **Audit qualité de second passage** : maintenant que tout est documenté, une relecture croisée (éventuellement par un autre agent Claude, pour un regard neuf) pourrait vérifier la cohérence du ton, la qualité des sources citées, et détecter d'éventuelles approximations à corriger sur les fiches rédigées dans l'urgence de ce sprint de documentation.
3. **Clé API Voyage AI** (embeddings) : toujours bloquée côté Julien — nécessaire si le projet veut activer une recherche sémantique dans le référentiel plutôt qu'une recherche par mots-clés.
4. **Vérifier `questions.json`** (4 entrées) : non auditée dans ce sprint, à vérifier si son contenu suit le même niveau de qualité que le reste.

## Qualité attendue (rappel)

Reprendre le ton "neutralité active" du projet : pas de survalorisation ni de dénigrement, présenter les limites/critiques de façon honnête, et toujours relier la fiche aux enjeux de l'IA dans `resonance_ia` (fiches humaines) quand c'est pertinent. Regarder des fiches déjà documentées (`philosophique.json`, `social_2.json`) pour s'imprégner du ton et du niveau de détail attendus (2-4 phrases par champ, dense mais pas superficiel).

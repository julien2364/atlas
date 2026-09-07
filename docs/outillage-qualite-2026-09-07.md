# Outillage qualité — ce qui a été ajouté le 07/09/2026, et ce qu'il ne voit pas

> Ce document accompagne trois changements d'outillage et un fichier de données :
> quatre contrôles nouveaux dans `scripts/valider-donnees.mjs`, un barème de fiabilité
> refait dans `scripts/veille-rss.mjs`, un durcissement du garde-fou de
> `.github/workflows/veille-cron.yml`, et `docs/correctifs-urls-2026-09-07.json`.
> Chaque règle y est donnée avec ce qu'elle attrape, **ce qu'elle laisse passer**, et
> son taux de faux positifs mesuré. Aucun fichier de `data/seed/` n'a été modifié.

---

## 1. Pourquoi le validateur ne voyait rien

Avant ce lot, `node scripts/valider-donnees.mjs` sortait à **0 erreur, 0 avertissement**
sur un corpus dont quatre audits venaient de montrer qu'il portait 348 sources primaires
sans lien, 70 titres ne désignant aucun document, 2 secteurs dupliqués et 97 fiches où la
même url était déclarée primaire et secondaire.

Le validateur n'était pas laxiste : il regardait au mauvais endroit. Ses contrôles de
sources raisonnaient à la maille de la **fiche** — « au moins une source porte-t-elle une
url ? » — là où le défaut est à la maille de l'**entrée de source**. Une fiche portant un
article Wikipédia cliquable et quatre ouvrages sans lien satisfaisait pleinement la règle,
alors que c'est précisément la fondation revendiquée du référentiel — les sources
primaires — qui n'était pas vérifiable.

Quatre contrôles corrigent cela. Un seul est bloquant, et c'est un choix motivé plus bas.

---

## 2. Les contrôles ajoutés

### État du corpus au moment de la rédaction

Le corpus est corrigé en parallèle par d'autres sessions ; les chiffres bougent d'heure en
heure. Deux relevés, pour que la mesure reste lisible :

| Contrôle | Gravité | À l'introduction des règles | Au dernier relevé |
|---|---|---|---|
| `T1-primaire-sans-url` | avertissement | 274 | **229** |
| `T1-oeuvre-imprimee` | avertissement | 74 | **128** |
| `T2-titre-imprecis` | avertissement | 28 | **26** |
| `T2-source-introuvable` | avertissement | 42 | **21** |
| `T3-secteur-duplique` | **erreur** | **2** | **0** — corrigés depuis |
| `T4-url-primaire-et-secondaire` | avertissement | 97 | **17** |
| `T5-trl-sans-justification` | avertissement | 87 | **0** — refonte des usages appliquée |
| `T5-usage-sans-maturite` | avertissement | — | **11** |
| `T5-diffusion-invalide` | **erreur** | 0 | **0** |
| contrôles historiques (usage sans exemple) | avertissement | 0 | **17** |
| **Total** | | **2 erreurs, 602 avertissements** | **0 erreur, 449 avertissements** |

Les chiffres de la colonne de droite ont bougé quatre fois pendant la rédaction de ce
document : le prendre comme un instantané, pas comme un état. L'écart entre les deux
colonnes n'est pas un réglage de seuil : c'est le travail des autres sessions. Les deux secteurs dupliqués ont été fusionnés, les 87 TRL ont été
repris, 54 fausses sources primaires ont été retirées de `social_2.json`. La bascule de
`T1-primaire-sans-url` vers `T1-oeuvre-imprimee` (+54) vient en revanche d'un
raffinement du tri, décrit au §3.

### T1 — url exigée par entrée de source primaire

**Ce qu'elle fait.** Pour chaque entrée de `Source` typée `primaire` et dépourvue d'url,
un avertissement. Le message diffère selon que l'entrée est une **œuvre imprimée
présumée** — cas où l'absence de lien est légitime — ou un **lien manquant**.

**Ce qu'elle attrape.** Le défaut central du corpus, et le seul que les quatre audits
désignent tous : le référentiel affirme se fonder sur des sources primaires, et une sur
deux n'est pas atteignable. La règle le rend visible entrée par entrée, avec le titre en
clair, donc contestable sans rouvrir le fichier.

**Ce qu'elle laisse passer.**
- Une source primaire **avec** url mais qui ne dit pas ce que la fiche lui fait dire.
  C'est le travail de `docs/audit-fond-2026-09-07.md`, lu à la main.
- Une url **morte** : le validateur est hors ligne par contrat, pour tourner en CI sans
  quota ni réseau. C'est le travail de `scripts/verifier-liens.mjs`.
- L'absence de **date**. Une seule source du corpus sur 1 250 porte un champ `date`, et
  aucune règle n'est ajoutée ici pour cela : 1 249 avertissements noieraient tout le
  reste. C'est le premier candidat pour le lot suivant, une fois T1 résorbé.

### T2 — titre de source ne désignant aucun document

**Ce qu'elle fait.** L'heuristique n'est pas réinventée : elle est reprise à l'identique
de `scripts/auditer-corpus.mjs` (§A4), qui l'a formulée et éprouvée sur les 1 254 entrées.
Trois conditions **simultanées** : un marqueur de généricité (« documentation »,
« rapports sur », « impact sur »…), aucune année entre 1500 et 2029, aucun ancrage
éditorial (« et al. », nom de revue, référence de norme, motif « Nom, Nom — Titre »).

Le résultat est scindé selon la présence d'une url, parce que le travail n'est pas le
même : **sans url** la source est introuvable et doit être remplacée ; **avec url** elle
est atteignable et seul l'intitulé est à préciser.

**Calage du seuil.** L'auditeur mécanique publie un second niveau, `A4bis`, qui borne le
reste des titres vagues : **114 détections pour 69 % de faux positifs mesurés**. Il est
**délibérément écarté** ici. Un garde-fou lancé à chaque commit ne peut pas se permettre
ce bruit — l'auditeur le publie comme signal, c'est sa place, pas celle de la CI.
Le seuil retenu est donc le niveau conjoint, le plus conservateur des deux.

**Ce qu'elle laisse passer.** Exactement ce que `A4bis` visait : « Documentation
Anthropic », « LangGraph — Documentation officielle » sont attrapés parce qu'ils portent
le mot « documentation », mais un titre vague n'employant aucune des tournures listées
passe sans un mot. La règle ne mesure pas le flou d'un titre : elle reconnaît des
tournures.

### T3 — unicité du secteur dans les `usages` d'une fiche IA — **le seul contrôle bloquant**

**Ce qu'elle fait.** Deux usages du même secteur dans une fiche IA sont une **erreur**.

**Pourquoi bloquant, alors que tout le reste ne l'est pas.** Parce que c'est le même
défaut de structure qu'un id dupliqué ou qu'une paire de gap analysée deux fois — deux cas
que ce validateur traite déjà en erreur. Deux usages du même secteur portent deux TRL
concurrents sur la même case de la grille de maturité de `/cartographie` et deux
descriptions concurrentes sur la fiche, sans qu'aucune ne fasse foi. Le coût du blocage
était par ailleurs borné et connu : 2 occurrences, `lstm` et
`aide-a-la-decision-publique-govtech-ia`, avec un correctif d'une ligne — une fusion.
Les deux ont été corrigées depuis, et le contrôle est à zéro.

**Faux positifs : aucun possible.** C'est une comparaison d'égalité sur une valeur d'énum.

**Ce qu'elle laisse passer.** Deux usages de secteurs *différents* qui décrivent le même
déploiement — c'est un jugement de fond, pas une comparaison de chaînes.

### T4 — même url déclarée `primaire` et `secondaire` dans une même fiche

**Est-ce défendable ?** Oui, et c'est le contrôle qui rend son sens au champ `type`. Une
url désigne un document ; un document est primaire ou secondaire selon **ce qu'il est**,
pas selon l'endroit où on le cite. Quand la même page Wikipédia est déclarée primaire au
niveau de la fiche et secondaire au niveau d'un usage, le champ ne code plus une nature de
document mais une position dans le fichier — et l'affichage « source primaire » ment au
lecteur.

**Avertissement et non erreur** : lever la contradiction demande un arbitrage éditorial
— laquelle des deux déclarations est la bonne ? — que le validateur ne peut pas trancher.

**Faux positifs : aucun.** Deux types opposés sur une url strictement identique.
**Ce qu'elle laisse passer** : la même contradiction **entre** deux fiches, où elle est
tout aussi absurde, et deux **encodages différents** de la même page — volontairement,
c'est un autre défaut, traité par le fichier de correctifs.

### T5 — TRL facultatif, justification exigible, diffusion contrainte

Écrit en anticipation de la refonte des usages IA menée en parallèle, et **vérifié depuis
contre `lib/types.ts`**, qui porte désormais `trl?: number | null`, `trl_justification?`
et `Diffusion = emergent | etabli | standard | historique`. Les trois règles sont alignées :

- `trl` absent ou `null` est licite — l'audit des 44 fiches IA a montré qu'un TRL sur
  trois portait sur un secteur académique où une échelle de maturité de déploiement ne
  veut rien dire ;
- un `trl` posé sans `trl_justification` est un **avertissement** — 87 usages étaient dans
  ce cas au moment de l'écriture, en faire une erreur aurait bloqué la publication sur une
  dette éditoriale connue. Les 21 TRL qui subsistent portent tous leur justification ;
- une `diffusion` hors énum est une **erreur** : contrôle strict à coût nul, zéro
  occurrence hier comme aujourd'hui, et c'est le rôle du validateur d'empêcher qu'un
  enum mal orthographié fasse disparaître une fiche d'un filtre sans rien lever ;
- un usage sans `trl` **ni** `diffusion` est un avertissement : rien ne situe alors sa
  maturité. 11 cas, tous sur des fiches de l'axe `limites` et sur deux méthodes
  statistiques — ce sont peut-être des cas légitimes, à trancher éditorialement.

---

## 3. Le tri œuvre imprimée / lien manquant, et son taux de faux positifs

C'est la seule partie réellement heuristique du lot, donc celle qui doit être la plus
explicite. **La règle T1 elle-même n'a pas de faux positif** : « source primaire sans
url » est un fait vérifiable. Ce qui est heuristique, c'est le **tri entre les deux
messages**.

### Le critère

Cumulatif, et volontairement étroit. Une entrée est classée *œuvre imprimée présumée* si
son titre ne porte **aucun marqueur numérique** (arXiv, DOI, « technical report »,
« documentation », « rapport », « publication annuelle », « méta-analyse », « index », nom
de revue ou de conférence, GitHub, Wikipédia), **et** si l'une de ces conditions est
vraie :

1. un **marqueur d'édition** figure dans le titre (« Éditions », « trad. », « coll. »,
   « PUF », « Gallimard », « University Press », « Routledge », motif « 1972 [1949] »…) ;
2. la fiche est sur un axe dont les sources primaires **sont** des ouvrages par
   construction — `philosophique`, `psychologique`, `serenite`.

Et trois exclusions :

- un titre empilant plusieurs documents (« … ; … ») est une **source agrégée**, à éclater,
  pas une œuvre ;
- un titre portant un **ancrage éditorial** (« Nom, Nom — », nom de revue, « et al. »)
  désigne un document publié et citable, donc pourvu d'un identifiant en ligne ;
- un axe est **hérité par les gaps** depuis la fiche humaine du couple. Un gap n'a pas
  d'axe propre : sans ce report, le tri se trompait sur une bonne moitié des 177 entrées
  de `documents_cles` concernées, relevées à la main sur un échantillon de 30.

### Deux mesures, dont une mécanique

**Mesure mécanique, sans arbitrage humain.** Si le *même document* est cité ailleurs dans
le corpus **avec** une url, alors le classer « œuvre imprimée » est faux par construction.
Appariement des titres par recouvrement de mots ≥ 0,8 (l'appariement exact ne trouve
rien : les titres sont réécrits d'une fiche à l'autre).

> **0 faux positif sur 128 entrées.** Le même test appliqué au bucket opposé **confirme**
> 12 entrées « lien manquant » : *Attention Is All You Need*, *DeepSeek-V3 Technical
> Report*, le papier AlphaFold de Jumper et al. sont cités avec leur url dans une fiche et
> sans dans une autre. Ces 12 sont dans le fichier de correctifs.

**Mesure manuelle, exhaustive.** Les 128 entrées se ramènent à **74 titres distincts**,
tous relus un par un — pas un échantillon. **Dix sont mal classés**, soit **17 entrées sur
128 : 13 %**. Les voici, pour qu'on puisse contester :

| Titre classé « œuvre imprimée » | Ce qu'il est en réalité |
|---|---|
| *A Cyborg Manifesto* | essai paru dans *Socialist Review* (1985), en ligne |
| *A Theory of Human Motivation (1943)* | article de *Psychological Review*, domaine public |
| *Psychology as the Behaviorist Views It (1913)* | idem |
| *Minds, Brains, and Programs* | article de *Behavioral and Brain Sciences* (1980), DOI |
| *What Is It Like to Be a Bat?* | article de *The Philosophical Review* (1974), DOI |
| *Kahneman & Tversky — Prospect Theory, Econometrica 1979* | article de revue, DOI |
| *The Meaning of 'Meaning'* | essai en volume collectif — cas limite |
| *GNoME (Google DeepMind, 2023)* | article de *Nature* + page projet |
| *Recherche académique sur l'équité algorithmique (fairness in ML)* | intention de source — **déjà attrapée par T2** |
| *Spiritualité contemporaine et sécularisation* | titre n'identifiant aucun document |

Le motif est net et vaut d'être dit : **le tri échoue sur les articles de revue des axes
philosophique et psychologique**, où l'axe l'emporte sur le fait que le document est un
article. Les corriger demanderait une liste de noms de revues de sciences humaines, que
je n'ai pas voulu inventer sans la mesurer.

**Ce que le tri laisse passer, dans l'autre sens.** Un ouvrage cité sous la forme
« Box, Jenkins — *Time Series Analysis* (1970) » est exclu par l'ancrage éditorial et
classé « lien manquant ». C'est un arbitrage assumé : cette erreur-là **demande une url à
un livre**, l'erreur inverse **dispense d'url un article qui en a une**. La première se
répare en trois secondes à la relecture, la seconde se transmet.

---

## 4. Le barème de fiabilité de la veille

### Ce qui n'allait pas

Le score était déduit du **nom du flux RSS** :

```js
const primaires = ["arxiv", "anthropic", "openai", "nature", "fmi", "imf", "ocde", "oecd"];
return primaires.some((p) => source.nom.toLowerCase().includes(p)) ? 0.9 : 0.6;
```

Il ne mesurait donc pas la proposition, mais l'intitulé du tuyau. Le flux
« Anthropic — actualités (via Google News, faute de flux RSS officiel) » contient
« anthropic » : ses **18 items étaient scorés 0,9** alors que ce sont des reprises de
Frandroid, 01net, ZDNet et Les Numériques. Et cinq communiqués publiés par OpenAI sur son
propre produit — dont deux études de cas clients — portaient le même score qu'un article
de *Nature*.

Ce n'était pas cosmétique : `scripts/appliquer-veille.mjs` classe la source proposée
`primaire` au-delà de 0,8. Une reprise de presse pouvait donc entrer au référentiel comme
source primaire sans qu'aucun humain l'ait décidé.

### La table retenue

Le score est calculé sur le **domaine de l'url de la proposition** — la seule propriété
objective et vérifiable que porte un item RSS. Six paliers, chacun répondant à une seule
question : *qui répond de ce texte, et qu'a-t-il dû faire avant de le publier ?*

| Score | Palier | Justification | Domaines (extrait) |
|---|---|---|---|
| **0,90** | Édition scientifique à comité de lecture, registre DOI | relecture par un tiers indépendant **avant** publication, identifiant stable, errata traçables | `nature.com`, `science.org`, `doi.org`, `cell.com`, `thelancet.com`, `pnas.org`, `dl.acm.org`, `ieee.org` |
| **0,80** | Préprint, actes de conférence, institution publique | un préprint n'est pas relu par les pairs, mais c'est un document **complet, versionné, cité par un identifiant stable** — donc identifiable, ce que le champ `type` demande. Une institution publique engage une responsabilité et publie sa méthode | `arxiv.org`, `openreview.net`, `proceedings.mlr.press`, `hal.science`, `oecd.org`, `imf.org`, `who.int`, `insee.fr`, `ipcc.ch` |
| **0,60** | Éditeur ou laboratoire sur son **propre** produit | source de première main, mais **partie prenante** : annonce technique et argumentaire commercial y sont indistincts, et rien n'oblige l'éditeur à publier ce qui le dessert | `openai.com`, `anthropic.com`, `claude.com`, `deepmind.google`, `mistral.ai`, `huggingface.co` |
| **0,50** | Encyclopédie collaborative | vérifiable et sourcée, mais tertiaire et modifiable ; aligné sur le score déjà utilisé par `documentation-recherche.mjs` | `wikipedia.org`, `wikidata.org` |
| **0,40** | Presse généraliste et spécialisée — **et défaut** | relecture éditoriale, pas de méthode publiée ni de correction traçable | `lemonde.fr`, `reuters.com`, `technologyreview.com`, `zdnet.fr`, `01net.com` |
| **0,15** | Redirecteur opaque | voir ci-dessous | `news.google.com`, `t.co`, `bit.ly`, `feedproxy.google.com` |

**Le seuil est à 0,80**, celui de `appliquer-veille.mjs`. Y accèdent l'édition
scientifique, les préprints et les institutions publiques ; rien d'autre. Un **domaine
inconnu tombe à 0,40** — prudent par construction : il reste en file pour la revue
humaine, mais ne peut jamais devenir automatiquement une source primaire.

**Les redirecteurs opaques.** `news.google.com/rss/articles/CBMiwgFBVV95cUxPR2JHMkFW…` ne
porte pas le domaine de l'éditeur réel. Le score **ne suit pas la redirection**, par
principe : un score qui dépendrait d'un appel réseau ne serait pas reproductible, et
18 requêtes de plus par exécution du cron pour un simple triage ne se justifient pas. On ne
score donc pas ce qu'on ne peut pas nommer : score plancher **et** drapeau
`domaine_opaque`, pour que ces propositions se lisent comme « à ouvrir avant tout
jugement » et non comme « peu fiables ». Ce n'est pas marginal : deux des sept flux actifs
sont des agrégations Google News, faute de flux officiel côté Anthropic (404) et côté
FMI/OCDE (403).

### Effet mesuré sur les 187 propositions en file

`node scripts/veille-rss.mjs --rescorer` — **lecture seule**, aucun fichier n'est réécrit :
les scores stockés sont attachés à des propositions déjà arbitrées par un humain (134 sur
187 sont au statut `rejete`), et les réécrire ferait disparaître ce sur quoi l'arbitrage
a porté.

| Palier après recalcul | Propositions |
|---|---|
| Encyclopédie (0,50) | 159 |
| Redirecteur opaque (0,15) | **18** |
| Éditeur sur son produit (0,60) | **5** |
| Comité de lecture (0,90) | 5 |

**23 scores changent, et les 23 perdent l'accès automatique au statut de source primaire.
Aucun ne le gagne.** Les 18 reprises Google News passent de 0,9 à 0,15, les 5 communiqués
OpenAI de 0,9 à 0,6. Les 5 articles de *Nature* restent à 0,9, les 159 propositions
Wikipédia à 0,5.

**Conséquence concrète, vérifiée.** `appliquer-veille.mjs` recalcule désormais le score
depuis l'url au lieu de lire celui stocké — la valeur en base a été écrite par l'ancien
barème et on la sait fausse. Sur la file actuelle, le fichier de patchs produit passe de
**3 patchs « sûrs » à 1** : les deux annonces produit d'OpenAI qui ajoutaient une source
`primaire` deviennent « à reformuler », et le seul patch sûr restant est un article de
*Nature*. L'écart entre score stocké et score recalculé est porté dans `a_verifier`, à la
vue du relecteur.

### Ce que le barème ne mesure pas

Il note la **fiabilité éditoriale de l'émetteur**, pas l'intérêt ni la pertinence du
contenu : cela reste le travail de la revue humaine, et **un score bas n'est pas un
rejet**. Il ne distingue pas non plus, sur un même domaine, la documentation technique du
communiqué de presse — `openai.com/index/gpt-6-astra` et une page de spécification y ont le
même score. Enfin la table est courte et le restera : un domaine absent tombe dans le
défaut prudent, ce qui est le bon comportement ; on l'étend quand un domaine revient assez
souvent en revue pour que la question se pose.

---

## 5. Le cron de veille

`.github/workflows/veille-cron.yml` reste cohérent. Deux points vérifiés et un durci.

**L'étape de proposition ne peut toujours pas modifier une fiche.** Elle écrit dans
`RUNNER_TEMP`, hors du dépôt, et un garde-fou explicite fait échouer le job si l'arbre de
travail a bougé. Ce garde-fou reposait sur `git diff`, qui ne voit que les fichiers
**suivis** : un script déposant un fichier neuf dans `data/seed/` serait passé inaperçu.
Il porte désormais sur `git status --porcelain`, donc sur l'arbre entier. Vérifié
localement : après `node scripts/appliquer-veille.mjs --sortie=/tmp/…`, l'écart entre le
`git status` avant et après est **vide**.

**Le cron rougit maintenant sur une panne de collecte.** `veille-rss.mjs` sort en code 1
si aucun flux n'est joignable alors que des flux actifs sont déclarés. Une file inchangée
parce que rien de neuf n'a été publié est normale ; une file inchangée parce que le réseau
est tombé ne l'est pas, et les deux se ressemblaient.

**Un point d'attention pour l'autre cron.** `.github/workflows/qualite-cron.yml` lance
`valider-donnees.mjs` **avant** toute écriture, sans `continue-on-error` — c'est voulu.
Toute erreur nouvelle du validateur arrête donc le cron hebdomadaire avant qu'il ne
bascule des fiches en ré-audit. C'est exactement le comportement attendu d'un garde-fou,
mais il faut le savoir : au dernier relevé le corpus est à **0 erreur**, le cron passe.

---

## 6. `docs/correctifs-urls-2026-09-07.json`

**Ce que c'est.** 27 correctifs d'url, **118 emplacements** visés dans `data/seed/`,
chacun désigné par son chemin JSON exact — fichier, id de fiche, chemin dans l'objet
(`sources[0]`, `usages[1].sources[0]`, `documents_cles[2]`) — avec la valeur actuelle, la
valeur cible et la preuve.

| Catégorie | Correctifs | Emplacements |
|---|---|---|
| `url_morte` — 404, remplacement fourni | 3 | 14 |
| `url_absente_document_identifie` — document identifié, lien à poser | 10 | 36 |
| `redirection_structurelle` — à figer, sans urgence | 9 | 40 |
| `double_encodage` — même page Wikipédia stockée deux fois | 5 | 28 |

**Pourquoi 9 redirections et non 8** : `docs/audit-qualite-2026-09.md` §3 regroupe
`anthropic.com/education` et `anthropic.com/customers` sur une même ligne, alors que ce
sont deux urls distinctes à corriger séparément.

**Trois cibles ont été corrigées par rapport à l'audit**, en suivant les chaînes de
redirection jusqu'à leur terme le 07/09 : `claude.com/education` redirige encore vers
`claude.com/solutions/education`, et `developers.openai.com/docs` et `/docs/models` vers
`/api/docs` et `/api/docs/models`. Figer une url qui redirige encore n'aurait servi à rien.

**Comment s'en servir.** Le fichier porte son propre `meta.mode_d_emploi`. En résumé :

1. lire d'abord les correctifs portant une clé `precaution` — ils demandent un arbitrage
   préalable (source agrégée à éclater avant de poser l'url pour *Gender Shades* et *Power
   Hungry Processing* ; bascule fr → en assumée pour *Platform capitalism*, dont aucun
   article francophone n'existe) ;
2. appliquer dans l'ordre `url_morte` (le corpus ment aujourd'hui au lecteur), puis
   `double_encodage` (elle fausse le comptage de sources de l'indexeur RAG et fait tester
   deux fois la même page au vérificateur de liens), puis
   `url_absente_document_identifie`, puis `redirection_structurelle`, sans urgence ;
3. relancer `node scripts/valider-donnees.mjs` après chaque catégorie ;
4. confirmer par `node scripts/verifier-liens.mjs --seulement-morts` et journaliser le lot
   dans `data/seed/changelog.json`.

**Ce qu'il n'est pas.** Il n'est **pas** consommable par `scripts/appliquer-patchs.mjs`,
qui écrit des champs de texte et des sources au niveau de la fiche et ne sait pas viser une
url imbriquée dans un usage sectoriel. L'application se fait à la main ou par un script
dédié. Et les emplacements sont **un relevé daté**, pas une vérité permanente : après toute
écriture dans `data/seed/`, un index de tableau peut avoir bougé — revérifier le chemin
avant d'écrire.

---

## 7. Limites du lot, sans détour

- **Rien n'est corrigé dans les données.** Ce lot produit des instruments et un plan de
  travail ; les 441 avertissements restent à traiter par les sessions qui ont le droit
  d'écrire dans `data/seed/`.
- **La date des sources n'est toujours pas contrôlée**, alors que c'est le constat le plus
  lourd des audits : 1 source sur 1 250. La règle est facile à écrire, ce sont ses
  1 249 avertissements qui sont impraticables tant que T1 n'est pas résorbé.
- **Le tri œuvre imprimée / lien manquant se trompe 13 fois sur 100**, toujours dans le
  même sens et sur le même motif : les articles de revue des axes philosophique et
  psychologique.
- **Aucune de ces règles ne dit si une fiche est vraie.** Une fiche peut passer les neuf
  contrôles, avoir une url vivante sur chaque source primaire, et raconter autre chose que
  ce que ses sources disent. C'est ce que mesure l'audit de fond, à la main, et rien ici ne
  le remplace.
- **Deux contrôles bloquants seulement** (`T3`, `T5-diffusion-invalide`), tous deux à zéro
  occurrence aujourd'hui. Les sept autres sont des avertissements : `--strict` les rend
  bloquants pour une revue de qualité ponctuelle, la CI de tous les jours ne bloque que
  sur du vrai cassé. Ce partage est à réexaminer quand les compteurs auront baissé — T1
  et T2 ont vocation à devenir bloquants.

---

## 8. Commandes

```
node scripts/valider-donnees.mjs            # rapport lisible + synthèse par contrôle
node scripts/valider-donnees.mjs --json     # sortie machine ; chaque constat porte son `code`
node scripts/valider-donnees.mjs --strict   # les avertissements deviennent bloquants
node scripts/valider-donnees.mjs --aide

node scripts/veille-rss.mjs                 # collecte
node scripts/veille-rss.mjs --simulation    # collecte sans écrire
node scripts/veille-rss.mjs --rescorer      # effet du barème sur la file, lecture seule
```

Codes de sortie, pour les deux : `0` succès · `1` échec (erreur de corpus, ou panne de
collecte) · `2` erreur d'usage.

---

*Écrit le 07/09/2026. Chiffres reproductibles par `node scripts/valider-donnees.mjs --json`
et `node scripts/veille-rss.mjs --rescorer`. Aucun fichier de `data/seed/` n'a été modifié
par ce lot.*

-- ATLAS HUMAIN × IA — schéma de données (RAG / Supabase)
-- Cf. docs/megaprompt.md section 8 pour le contexte technique.
--
-- ⚠️ Historique : ce fichier décrivait à l'origine (Lot 1) un projet Supabase
-- dédié, tables sans préfixe, embedding vector(1536).
-- Décision du 05/09/2026 (Julien) : mutualiser le RAG d'Atlas Humain × IA dans
-- le projet Supabase existant "Quizplay & Contacts" (cvmsozjxpjzvyhinvooa,
-- eu-west-1) plutôt que créer un 5e projet dédié, pour des raisons de coût.
-- En conséquence :
--   - toutes les tables sont préfixées `atlas_` pour coexister avec les
--     tables `fs_`/`avatar_` déjà présentes dans la même base partagée ;
--   - la dimension des embeddings est vector(1024) et non vector(1536), pour
--     s'aligner sur le modèle déjà utilisé par ce projet (Voyage voyage-4-lite,
--     cf. avatar_documents.embedding) plutôt que d'introduire un second modèle
--     d'embedding dans la même base.
-- Ce fichier reflète désormais le schéma réellement déployé (vérifié via
-- information_schema le 05/09/2026). Il reste appliqué via
-- mcp__Supabase__apply_migration, en 2 migrations séparées : DDL des tables
-- d'abord, puis CREATE POLICY (CREATE POLICY IF NOT EXISTS n'existe pas en
-- PostgreSQL et fait échouer toute la transaction si combiné au DDL).

create extension if not exists vector;

create table if not exists atlas_fiches_humaines (
  id text primary key,
  axe text not null check (axe in ('social','psychologique','philosophique','evolution','serenite')),
  nom text not null,
  periode_courant text,
  sous_domaine text,
  these_centrale text not null,
  apport text not null,
  limites_critiques text not null,
  resonance_ia text,
  sources jsonb not null default '[]',
  statut text not null default 'a_documenter' check (statut in ('a_documenter','documente','verifie_recemment','a_re_auditer')),
  embedding vector(1024),
  derniere_verification date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas_fiches_ia (
  id text primary key,
  axe text not null check (axe in ('generatif_raisonnement','agentique','scientifique','sectoriel','limites','predictif_data_science')),
  nom text not null,
  editeur text,
  architecture text,
  capacites_cles jsonb not null default '[]',
  usages jsonb not null default '[]', -- UsageSectoriel[]
  limites_connues text,
  sources jsonb not null default '[]',
  statut text not null default 'a_documenter' check (statut in ('a_documenter','documente','verifie_recemment','a_re_auditer')),
  embedding vector(1024),
  derniere_verification date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas_fiches_gap (
  id text primary key,
  fiche_humaine_id text references atlas_fiches_humaines(id) on delete cascade,
  fiche_ia_id text references atlas_fiches_ia(id) on delete cascade,
  apport_ia text not null,
  mecanisme text not null,
  amelioration_possible text not null,
  mode_interaction text not null,
  substituabilite text not null check (substituabilite in (
    'remplacable_totalement','remplacable_avec_supervision','non_remplacable','remplacable_avec_autre_technologie'
  )),
  technologie_complementaire text,
  scenario_present text not null,
  scenario_5ans text not null,
  scenario_15_20ans text not null,
  confiance text not null check (confiance in ('elevee','moyenne','faible')),
  statut text not null default 'a_documenter',
  derniere_verification date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists atlas_veille_sources (
  id text primary key,
  nom text not null,
  type text not null check (type in ('rss','spiderfoot')),
  url text,
  domaine text not null,
  actif boolean not null default true
);

create table if not exists atlas_veille_queue (
  id uuid primary key default gen_random_uuid(),
  source_id text references atlas_veille_sources(id),
  cible_type text not null check (cible_type in ('fiche_humaine','fiche_ia','fiche_gap','nouvelle_categorie')),
  cible_id text,
  contenu_propose jsonb not null,
  score_fiabilite numeric,
  statut text not null default 'en_attente' check (statut in ('en_attente','valide_auto','valide_manuel','rejete')),
  created_at timestamptz not null default now()
);

create table if not exists atlas_changelog (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  type text not null check (type in ('ajout','mise_a_jour','correction','evolution_structurelle')),
  cible text not null,
  resume text not null,
  source jsonb
);

-- Index de recherche sémantique (à activer une fois les embeddings peuplés —
-- bloqué sur le choix d'un fournisseur d'embedding, cf. docs/comment-lancer.md)
create index if not exists atlas_fiches_humaines_embedding_idx on atlas_fiches_humaines using ivfflat (embedding vector_cosine_ops);
create index if not exists atlas_fiches_ia_embedding_idx on atlas_fiches_ia using ivfflat (embedding vector_cosine_ops);

-- RLS : lecture publique (le référentiel est public depuis le 05/09/2026),
-- écriture réservée au rôle service (scripts de veille/documentation, jamais
-- le navigateur du visiteur).
alter table atlas_fiches_humaines enable row level security;
alter table atlas_fiches_ia enable row level security;
alter table atlas_fiches_gap enable row level security;
alter table atlas_veille_sources enable row level security;
alter table atlas_veille_queue enable row level security;
alter table atlas_changelog enable row level security;

-- Création idempotente SANS `drop policy` : dans un projet mutualisé, un `drop`
-- suivi d'un `create` détruit la version en place le temps de la transaction et
-- écrase silencieusement toute modification faite depuis la console Supabase.
-- `CREATE POLICY IF NOT EXISTS` n'existe pas en PostgreSQL : on teste pg_policies.
-- Conséquence assumée : si la policy existe déjà, ce fichier ne la met PAS à jour
-- (il faut alors la modifier explicitement à la main). C'est le comportement voulu.
do $$
declare
  cible text;
begin
  foreach cible in array array[
    'atlas_fiches_humaines',
    'atlas_fiches_ia',
    'atlas_fiches_gap',
    'atlas_veille_sources',
    'atlas_changelog'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = cible and policyname = 'atlas_public_read'
    ) then
      execute format('create policy atlas_public_read on public.%I for select using (true)', cible);
    end if;
  end loop;
end
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- MP-4 — MOTEUR DE RÉPONSE PRÉDICTIVE (RAG)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Contexte d'exécution : projet Supabase MUTUALISÉ `cvmsozjxpjzvyhinvooa`, qui
-- héberge déjà d'autres applications. Règles suivies dans tout ce bloc :
--   1. tout objet créé est préfixé `atlas_` (tables, index, fonctions) ;
--   2. tout est idempotent : `create table if not exists`,
--      `create index if not exists`, `create or replace function` ;
--   3. aucun `drop` destructif, aucun `alter` sur un objet non préfixé `atlas_`,
--      aucun renommage — ce fichier peut être rejoué autant de fois que voulu
--      sans jamais toucher aux tables d'une autre application.
--
-- Choix de conception à connaître avant d'exécuter :
--   - Les passages sont stockés dans UNE table à plat (`atlas_rag_passages`) et
--     non dans les colonnes `embedding` déjà présentes sur `atlas_fiches_*`.
--     Raison : une fiche humaine porte trois contenus distincts (thèse centrale,
--     apport, limites critiques) qui répondent à des questions différentes ;
--     un embedding unique par fiche les moyenne et détruit la précision. Les
--     colonnes `atlas_fiches_*.embedding` restent en place, inutilisées par le
--     RAG (on ne les supprime pas : elles appartiennent au schéma du Lot 1).
--   - AUCUNE clé étrangère de `atlas_rag_passages.fiche_id` vers
--     `atlas_fiches_humaines(id)` : le corpus vit aujourd'hui dans
--     `data/seed/*.json`, PAS dans Postgres (les tables `atlas_fiches_*` sont
--     vides tant que le script de migration du Lot 2 n'a pas été écrit). Une FK
--     ferait échouer 100 % des insertions de l'indexeur. L'intégrité
--     référentielle est vérifiée côté script (`scripts/indexer-corpus.mjs`) et
--     côté route API (résolution de l'id via `lib/corpus.ts`).
--   - Dimension 1024 : imposée par la décision d'en-tête de ce fichier
--     (Voyage, cohérence avec `avatar_documents.embedding` du même projet).
--     Changer de fournisseur d'embedding impose de changer cette dimension,
--     donc de créer une NOUVELLE table (`atlas_rag_passages_v2`) plutôt que
--     d'altérer celle-ci — un `alter column type vector(N)` invalide tous les
--     embeddings déjà calculés et fait perdre l'argent déjà dépensé.

-- ---------------------------------------------------------------------------
-- Table des passages indexés
-- ---------------------------------------------------------------------------
-- Un passage = UN champ substantiel d'UNE fiche. Une fiche humaine produit
-- jusqu'à 4 passages (thèse centrale / apport / limites critiques / résonance
-- IA), une fiche de gap jusqu'à 7 (apport IA, mécanisme, amélioration possible,
-- mode d'interaction, scénario présent, scénario 5 ans, scénario 15-20 ans).
-- Ordre de grandeur mesuré sur le corpus du 06/09/2026 : ~2 650 passages.
create table if not exists atlas_rag_passages (
  -- Identité technique. `generated always as identity` plutôt que `serial` :
  -- pas de séquence orpheline si la table est un jour recréée.
  id bigint generated always as identity primary key,

  -- Référentiel d'origine du passage. Volontairement `text` + contrainte CHECK
  -- et non un type ENUM : dans une base mutualisée, un type nommé est un objet
  -- global de plus à maintenir, et PostgREST passe les valeurs en texte.
  type_fiche text not null check (type_fiche in ('humaine', 'ia', 'gap')),

  -- Identifiant de la fiche dans `data/seed/` (slug), ex. "friedrich-nietzsche".
  -- C'est LUI qui permet à la route API de reconstruire les sources réelles et
  -- le lien public de la fiche : jamais de source inventée par le modèle.
  fiche_id text not null,

  -- Champ d'origine du texte, ex. "these_centrale", "limites_critiques",
  -- "scenario_5ans". Sert à afficher au lecteur d'où vient exactement l'extrait.
  champ text not null,

  -- Nom lisible de la fiche au moment de l'indexation (dénormalisé volontairement :
  -- évite un aller-retour vers le corpus pour afficher un résultat de recherche).
  titre_fiche text not null default '',

  -- Le texte réellement embarqué dans le contexte du modèle. Il contient un
  -- en-tête court (nom de la fiche + champ) suivi du contenu : sans cet en-tête,
  -- un extrait isolé du type « Reste une dimension irréductiblement humaine »
  -- est inexploitable hors de son contexte.
  texte text not null,

  -- Empreinte SHA-256 de `texte`. C'est la clé de l'idempotence : l'indexeur
  -- compare l'empreinte calculée localement à celle stockée ici et n'appelle
  -- l'API d'embedding (payante) que pour les passages nouveaux ou modifiés.
  empreinte text not null,

  -- Vecteur de recherche. Nullable : une ligne peut exister sans embedding si
  -- l'appel au fournisseur a échoué en cours de lot (l'indexeur reprendra).
  embedding vector(1024),

  -- Modèle qui a produit l'embedding. Indispensable pour détecter un mélange de
  -- modèles dans la même table : deux modèles différents produisent des espaces
  -- vectoriels incomparables et la recherche renvoie du bruit sans lever d'erreur.
  modele_embedding text not null default '',

  -- Métadonnées de filtrage et d'affichage : axe, sous-domaine, statut,
  -- derniere_verification, substituabilite/confiance pour les gaps, ids des
  -- fiches croisées. Stockées en jsonb pour ne pas figer le schéma à chaque
  -- évolution du référentiel.
  metadonnees jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Clé naturelle : un seul passage par (référentiel, fiche, champ). C'est elle
  -- qui rend le `upsert` de l'indexeur sûr — relancer l'indexation à vide ne
  -- crée aucun doublon, elle met simplement à jour `updated_at`.
  constraint atlas_rag_passages_cle_naturelle unique (type_fiche, fiche_id, champ)
);

comment on table atlas_rag_passages is
  'ATLAS Humain x IA (MP-4) — passages du corpus decoupes par champ et vectorises pour la recherche semantique du moteur de reponse predictive.';
comment on column atlas_rag_passages.empreinte is
  'SHA-256 du texte : permet de ne re-embedder que ce qui a change (idempotence de scripts/indexer-corpus.mjs).';
comment on column atlas_rag_passages.modele_embedding is
  'Modele ayant produit le vecteur ; deux modeles differents ne sont pas comparables dans le meme index.';

-- Index de recherche par fiche (affichage des sources, réindexation ciblée).
create index if not exists atlas_rag_passages_fiche_idx
  on atlas_rag_passages (type_fiche, fiche_id);

-- Index sur l'empreinte : la passe de comparaison de l'indexeur lit
-- (type_fiche, fiche_id, champ, empreinte) et rien d'autre.
create index if not exists atlas_rag_passages_empreinte_idx
  on atlas_rag_passages (empreinte);

-- Index vectoriel. HNSW est préféré à IVFFlat : il n'a pas besoin d'être
-- « entraîné » sur des données déjà présentes (un index IVFFlat créé sur une
-- table vide dégénère en scan séquentiel silencieux — c'est le défaut des deux
-- index `atlas_fiches_*_embedding_idx` créés plus haut au Lot 1).
-- Repli automatique sur IVFFlat si la version de pgvector du projet est
-- antérieure à 0.5.0 et ne connaît pas la méthode `hnsw`.
do $$
begin
  begin
    create index if not exists atlas_rag_passages_embedding_idx
      on atlas_rag_passages using hnsw (embedding vector_cosine_ops);
  exception
    when others then
      raise notice 'HNSW indisponible (pgvector < 0.5 ?) — repli sur IVFFlat : %', sqlerrm;
      create index if not exists atlas_rag_passages_embedding_idx
        on atlas_rag_passages using ivfflat (embedding vector_cosine_ops) with (lists = 100);
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Table de cache des réponses
-- ---------------------------------------------------------------------------
-- Premier des trois plafonds de coût du moteur (les deux autres — nombre de
-- passages injectés et nombre de tokens de sortie — sont côté application, dans
-- lib/rag.ts). Une question déjà posée ne redéclenche ni embedding ni appel au
-- modèle tant que son entrée de cache n'a pas expiré.
create table if not exists atlas_rag_cache_reponses (
  -- SHA-256 de la question NORMALISÉE (minuscules, accents et ponctuation
  -- retirés, espaces réduits) : « Le capitalisme est-il optimal ? » et
  -- « le capitalisme est il optimal » partagent la même entrée de cache.
  empreinte text primary key,

  -- Question telle que réellement posée par le premier visiteur (pour le journal
  -- de bord et l'audit de neutralité : on doit pouvoir relire ce qui a été demandé).
  question text not null,

  -- Réponse complète sérialisée (perspectives, sources, passages mobilisés,
  -- diagnostic). Format : cf. `ReponseQuestion` dans lib/rag.ts.
  reponse jsonb not null,

  modele_reponse text not null default '',
  modele_embedding text not null default '',

  -- Volumétrie réellement consommée par l'appel qui a rempli cette entrée.
  -- C'est la seule mesure de coût fiable : les estimations de docs/ sont des
  -- hypothèses, ces colonnes sont des faits.
  nb_passages integer not null default 0,
  tokens_entree integer not null default 0,
  tokens_sortie integer not null default 0,

  -- Combien de fois cette réponse a été resservie sans appel payant.
  nb_utilisations integer not null default 0,
  derniere_utilisation timestamptz,

  created_at timestamptz not null default now()
);

comment on table atlas_rag_cache_reponses is
  'ATLAS Humain x IA (MP-4) — cache des reponses du moteur RAG, borne principale du cout d''exploitation.';

-- Purge et statistiques : on lit toujours le cache par date décroissante.
create index if not exists atlas_rag_cache_reponses_date_idx
  on atlas_rag_cache_reponses (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS des tables du RAG
-- ---------------------------------------------------------------------------
-- Contrairement aux tables du référentiel (lecture publique assumée), ces deux
-- tables ne reçoivent AUCUNE policy : RLS activée sans policy = tout accès refusé
-- aux rôles `anon` et `authenticated`. Seul `service_role`, qui contourne RLS par
-- construction, y accède — c'est-à-dire uniquement l'indexeur et la route
-- /api/question, jamais le navigateur du visiteur.
-- Justification : le cache contient les questions posées par les visiteurs
-- (donnée potentiellement personnelle au sens RGPD si quelqu'un y écrit son nom),
-- et les embeddings sont partiellement inversibles vers leur texte source.
alter table atlas_rag_passages enable row level security;
alter table atlas_rag_cache_reponses enable row level security;

-- ---------------------------------------------------------------------------
-- Fonction de recherche par similarité
-- ---------------------------------------------------------------------------
-- Appelée par la route /api/question via `supabase.rpc(...)`. Le vecteur de la
-- question est transmis par PostgREST sous forme de tableau JSON et converti en
-- `vector` par le type d'entrée de pgvector.
--
-- `<=>` est la distance cosinus de pgvector (0 = identique, 2 = opposé) ; la
-- similarité rendue est `1 - distance`, dans [-1, 1], comparable au seuil de
-- lib/rag.ts. Le tri se fait sur la DISTANCE et non sur la similarité, sinon
-- l'index vectoriel n'est pas utilisé par le planificateur.
--
-- `create or replace` ne peut pas changer le type de retour d'une fonction
-- existante : si la liste de colonnes ci-dessous évolue un jour, il faudra
-- `drop function atlas_rag_rechercher_passages(...)` explicitement à la main
-- (seul cas de drop admis, et sur un objet exclusivement `atlas_`).
create or replace function atlas_rag_rechercher_passages(
  requete vector(1024),
  seuil double precision default 0.35,
  limite integer default 24,
  types text[] default null
)
returns table (
  id bigint,
  type_fiche text,
  fiche_id text,
  champ text,
  titre_fiche text,
  texte text,
  metadonnees jsonb,
  similarite double precision
)
language sql
stable
-- search_path figé : `vector` peut être installé dans `public` ou dans
-- `extensions` selon l'âge du projet Supabase. Les deux sont déclarés.
set search_path = public, extensions
as $$
  select
    p.id,
    p.type_fiche,
    p.fiche_id,
    p.champ,
    p.titre_fiche,
    p.texte,
    p.metadonnees,
    (1 - (p.embedding <=> requete))::double precision as similarite
  from atlas_rag_passages p
  where p.embedding is not null
    and (types is null or p.type_fiche = any(types))
    and (1 - (p.embedding <=> requete)) >= seuil
  order by p.embedding <=> requete
  -- Plafond dur : même si l'appelant demande 10 000 passages, on n'en rend
  -- jamais plus de 100. Le contexte envoyé au modèle est ainsi borné côté base
  -- ET côté application, et une erreur d'appel ne peut pas faire exploser la facture.
  limit greatest(1, least(coalesce(limite, 24), 100));
$$;

comment on function atlas_rag_rechercher_passages(vector, double precision, integer, text[]) is
  'ATLAS (MP-4) — recherche des passages les plus proches d''un vecteur de question, filtree par seuil de similarite et bornee a 100 resultats.';

-- ---------------------------------------------------------------------------
-- Lecture du cache (lecture + compteur d'usage, en une seule opération)
-- ---------------------------------------------------------------------------
-- Renvoie zéro ligne si l'entrée n'existe pas OU si elle a dépassé son TTL —
-- l'appelant n'a donc aucune règle de fraîcheur à réimplémenter. Le compteur
-- `nb_utilisations` est incrémenté dans la même instruction : pas de course
-- entre deux visiteurs simultanés, et pas de second aller-retour réseau.
create or replace function atlas_rag_cache_lire(
  p_empreinte text,
  p_ttl_heures integer default 720
)
returns table (
  question text,
  reponse jsonb,
  created_at timestamptz,
  nb_utilisations integer
)
language plpgsql
volatile
set search_path = public
as $$
begin
  return query
  update atlas_rag_cache_reponses c
     set nb_utilisations = c.nb_utilisations + 1,
         derniere_utilisation = now()
   where c.empreinte = p_empreinte
     -- Plancher d'une heure, volontairement différent de atlas_rag_purger_cache :
     -- ici, 0 signifierait « cache désactivé », un réglage qui doit se faire dans
     -- .env.local et pas par un appel isolé. lib/rag.ts borne d'ailleurs le TTL à 1 minimum.
     and c.created_at > now() - make_interval(hours => greatest(1, coalesce(p_ttl_heures, 720)))
  returning c.question, c.reponse, c.created_at, c.nb_utilisations;
end
$$;

comment on function atlas_rag_cache_lire(text, integer) is
  'ATLAS (MP-4) — lit une reponse en cache si elle est encore fraiche et incremente son compteur d''usage.';

-- ---------------------------------------------------------------------------
-- Purge du cache (maintenance manuelle)
-- ---------------------------------------------------------------------------
-- Supprime les entrées expirées et rend le nombre de lignes effacées. Seule
-- suppression de données du fichier, limitée à une table `atlas_rag_*` créée par
-- ce même fichier, et jamais déclenchée automatiquement : c'est l'auteur qui
-- l'appelle quand il veut forcer un recalcul (par exemple après avoir réindexé
-- le corpus, sans quoi les anciennes réponses continueraient d'être servies).
create or replace function atlas_rag_purger_cache(p_ttl_heures integer default 720)
returns integer
language plpgsql
volatile
set search_path = public
as $$
declare
  nb integer;
begin
  -- `greatest(0, ...)` et non `greatest(1, ...)` : passer 0 doit vider TOUT le
  -- cache. C'est le geste attendu après une réindexation du corpus, sans quoi les
  -- anciennes réponses continueraient d'être servies alors que les fiches sur
  -- lesquelles elles s'appuient ont changé. Un `null` retombe sur 30 jours.
  delete from atlas_rag_cache_reponses
   where created_at <= now() - make_interval(hours => greatest(0, coalesce(p_ttl_heures, 720)));
  get diagnostics nb = row_count;
  return nb;
end
$$;

comment on function atlas_rag_purger_cache(integer) is
  'ATLAS (MP-4) — supprime les reponses en cache plus anciennes que le TTL donne et rend le nombre de lignes effacees.';

-- ---------------------------------------------------------------------------
-- État de l'index (diagnostic)
-- ---------------------------------------------------------------------------
-- Utilisée par `node scripts/indexer-corpus.mjs --etat` et par la note de mise
-- en route pour vérifier, sans écrire une ligne de SQL à la main, que
-- l'indexation a bien eu lieu et qu'un seul modèle d'embedding est en jeu.
create or replace function atlas_rag_statistiques()
returns table (
  type_fiche text,
  nb_passages bigint,
  nb_fiches bigint,
  nb_avec_embedding bigint,
  modeles text[]
)
language sql
stable
set search_path = public
as $$
  select
    p.type_fiche,
    count(*)::bigint as nb_passages,
    count(distinct p.fiche_id)::bigint as nb_fiches,
    count(p.embedding)::bigint as nb_avec_embedding,
    array_agg(distinct p.modele_embedding) as modeles
  from atlas_rag_passages p
  group by p.type_fiche
  order by p.type_fiche;
$$;

comment on function atlas_rag_statistiques() is
  'ATLAS (MP-4) — volumetrie de l''index vectoriel par referentiel, et liste des modeles d''embedding presents.';

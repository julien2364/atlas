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

drop policy if exists atlas_public_read on atlas_fiches_humaines;
create policy atlas_public_read on atlas_fiches_humaines for select using (true);
drop policy if exists atlas_public_read on atlas_fiches_ia;
create policy atlas_public_read on atlas_fiches_ia for select using (true);
drop policy if exists atlas_public_read on atlas_fiches_gap;
create policy atlas_public_read on atlas_fiches_gap for select using (true);
drop policy if exists atlas_public_read on atlas_veille_sources;
create policy atlas_public_read on atlas_veille_sources for select using (true);
drop policy if exists atlas_public_read on atlas_changelog;
create policy atlas_public_read on atlas_changelog for select using (true);

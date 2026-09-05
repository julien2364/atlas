-- ATLAS HUMAIN × IA — schéma de données initial (Lot 1)
-- Cf. docs/megaprompt.md section 8 pour le contexte technique.

create extension if not exists vector;

create table if not exists fiches_humaines (
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
  embedding vector(1536),
  derniere_verification date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fiches_ia (
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
  embedding vector(1536),
  derniere_verification date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fiches_gap (
  id text primary key,
  fiche_humaine_id text references fiches_humaines(id) on delete cascade,
  fiche_ia_id text references fiches_ia(id) on delete cascade,
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

create table if not exists veille_sources (
  id text primary key,
  nom text not null,
  type text not null check (type in ('rss','spiderfoot')),
  url text,
  domaine text not null,
  actif boolean not null default true
);

create table if not exists veille_queue (
  id uuid primary key default gen_random_uuid(),
  source_id text references veille_sources(id),
  cible_type text not null check (cible_type in ('fiche_humaine','fiche_ia','fiche_gap','nouvelle_categorie')),
  cible_id text,
  contenu_propose jsonb not null,
  score_fiabilite numeric,
  statut text not null default 'en_attente' check (statut in ('en_attente','valide_auto','valide_manuel','rejete')),
  created_at timestamptz not null default now()
);

create table if not exists changelog (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null default now(),
  type text not null check (type in ('ajout','mise_a_jour','correction','evolution_structurelle')),
  cible text not null,
  resume text not null,
  source jsonb
);

-- Index de recherche sémantique (à activer une fois les embeddings peuplés)
create index if not exists fiches_humaines_embedding_idx on fiches_humaines using ivfflat (embedding vector_cosine_ops);
create index if not exists fiches_ia_embedding_idx on fiches_ia using ivfflat (embedding vector_cosine_ops);

-- Prospecta SC — schema Postgres (Neon / Supabase / Vercel Postgres)
-- Idempotente: pode rodar mais de uma vez.

create extension if not exists pg_trgm;

-- Tabelas de referência da Receita Federal -----------------------------------
create table if not exists municipios (
  codigo  text primary key,          -- código de município da RFB (não é o IBGE)
  nome    text not null,
  uf      text                       -- preenchido pelo ETL para os municípios de SC
);
create index if not exists municipios_uf_idx on municipios (uf);

create table if not exists cnaes (
  codigo    text primary key,        -- 7 dígitos
  descricao text not null
);
create index if not exists cnaes_desc_trgm on cnaes using gin (descricao gin_trgm_ops);

-- Empresas (estabelecimentos) de SC ------------------------------------------
create table if not exists empresas (
  cnpj               text primary key,         -- 14 dígitos
  cnpj_basico        text not null,
  razao_social       text,
  nome_fantasia      text,
  matriz             boolean,
  situacao           text,                     -- 02 = ativa
  data_inicio        date,
  cnae_principal     text,
  cnaes_secundarios  text,                     -- lista separada por vírgula
  natureza_juridica  text,
  porte              text,                     -- 00 n/inf, 01 ME, 03 EPP, 05 demais
  capital_social     numeric,
  tipo_logradouro    text,
  logradouro         text,
  numero             text,
  complemento        text,
  bairro             text,
  cep                text,
  municipio_codigo   text,
  uf                 text,
  telefone1          text,                     -- DDD + número (só dígitos)
  telefone2          text,
  email              text,
  whatsapp           text,                     -- 55DD9XXXXXXXX quando o telefone é celular
  ref_base           text,                     -- mês da base RFB (AAAA-MM)
  -- enriquecimento (Google Maps + site)
  google_place_id    text,
  google_nome        text,
  google_telefone    text,
  google_site        text,
  google_maps_url    text,
  google_rating      numeric,
  google_avaliacoes  integer,
  site_emails        text,                     -- e-mails achados no site, separados por vírgula
  site_whatsapp      text,
  enriquecido_em     timestamptz,
  enriquecimento_status text                   -- ok | nao_encontrado | erro
);
create index if not exists empresas_mun_idx      on empresas (municipio_codigo);
create index if not exists empresas_cnae_idx     on empresas (cnae_principal text_pattern_ops);
create index if not exists empresas_porte_idx    on empresas (porte);
create index if not exists empresas_tel1_idx     on empresas (telefone1);
create index if not exists empresas_tel2_idx     on empresas (telefone2);
create index if not exists empresas_razao_trgm   on empresas using gin (razao_social gin_trgm_ops);
create index if not exists empresas_fantasia_trgm on empresas using gin (nome_fantasia gin_trgm_ops);

-- CRM ------------------------------------------------------------------------
create table if not exists leads (
  id               bigserial primary key,
  cnpj             text unique references empresas(cnpj) on delete set null,
  google_place_id  text unique,
  nome             text not null,
  razao_social     text,
  cidade           text,
  uf               text default 'SC',
  endereco         text,
  telefone         text,
  telefone2        text,
  whatsapp         text,
  email            text,
  site             text,
  segmento         text,
  porte            text,
  origem           text not null,                -- cnpj | google
  etapa            text not null default 'novo', -- novo, contatado, qualificado, proposta, negociacao, ganho, perdido
  valor            numeric,
  responsavel      text,
  observacoes      text,
  proximo_contato  date,
  nao_contatar     boolean not null default false,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
create index if not exists leads_etapa_idx  on leads (etapa);
create index if not exists leads_cidade_idx on leads (cidade);

create table if not exists atividades (
  id         bigserial primary key,
  lead_id    bigint not null references leads(id) on delete cascade,
  tipo       text not null,       -- nota, whatsapp, email, ligacao, etapa, visita
  descricao  text,
  criado_em  timestamptz not null default now()
);
create index if not exists atividades_lead_idx on atividades (lead_id, criado_em desc);

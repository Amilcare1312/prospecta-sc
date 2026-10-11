import { db } from './db';

/**
 * Migrações idempotentes, executadas automaticamente uma vez por instância
 * na primeira requisição. Levam um banco da versão "conta única" para a versão
 * com várias contas (cada cliente com seu próprio CRM).
 */
const SQL = `
create table if not exists contas (
  id            bigserial primary key,
  nome          text not null,
  whatsapp      text,
  plano         text not null default 'teste',      -- teste | mensal | anual | vitalicio
  ativo_ate     timestamptz,                         -- null = sem vencimento
  bloqueada     boolean not null default false,
  ufs           text,                                -- estados liberados (ex.: 'SC,PR'); null = todos
  observacoes   text,
  criado_em     timestamptz not null default now()
);

create table if not exists usuarios (
  id            bigserial primary key,
  conta_id      bigint not null references contas(id) on delete cascade,
  nome          text not null,
  email         text not null,
  senha_hash    text not null,
  papel         text not null default 'dono',        -- dono | membro | superadmin
  ultimo_acesso timestamptz,
  criado_em     timestamptz not null default now()
);
create unique index if not exists usuarios_email_idx on usuarios (lower(email));

create table if not exists uso_mensal (
  conta_id  bigint not null references contas(id) on delete cascade,
  mes       text not null,                            -- AAAA-MM
  google    integer not null default 0,
  primary key (conta_id, mes)
);

-- conta principal (dona dos leads já existentes)
insert into contas (id, nome, plano, ativo_ate)
  select 1, 'Conta principal', 'vitalicio', null
  where not exists (select 1 from contas where id = 1);
select setval(pg_get_serial_sequence('contas', 'id'), greatest((select max(id) from contas), 1));

-- leads passam a pertencer a uma conta
alter table leads add column if not exists conta_id bigint references contas(id) on delete cascade;
update leads set conta_id = 1 where conta_id is null;
alter table leads alter column conta_id set not null;
alter table leads drop constraint if exists leads_cnpj_key;
alter table leads drop constraint if exists leads_google_place_id_key;
create unique index if not exists leads_conta_cnpj_idx on leads (conta_id, cnpj);
create unique index if not exists leads_conta_place_idx on leads (conta_id, google_place_id);
create index if not exists leads_conta_etapa_idx on leads (conta_id, etapa);

create index if not exists empresas_uf_idx on empresas (uf);

-- cobrança (Asaas)
alter table contas add column if not exists asaas_customer_id text;
alter table contas add column if not exists asaas_subscription_id text;
alter table contas add column if not exists asaas_ciclo text;
create table if not exists pagamentos (
  id          text primary key,              -- id do pagamento no Asaas
  conta_id    bigint references contas(id) on delete set null,
  assinatura  text,
  valor       numeric,
  status      text,
  evento      text,
  vencimento  date,
  invoice_url text,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  creditado   boolean not null default false
);
create index if not exists pagamentos_conta_idx on pagamentos (conta_id, criado_em desc);
`;

const g = globalThis as unknown as { __migrado?: Promise<void> };

export function garantirSchema(): Promise<void> {
  if (!g.__migrado) {
    g.__migrado = (async () => {
      const sql = db();
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(424242)`;
        await tx.unsafe(SQL);
      });
    })().catch((e) => {
      g.__migrado = undefined;
      throw e;
    });
  }
  return g.__migrado;
}

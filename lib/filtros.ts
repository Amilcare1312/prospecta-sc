import type postgres from 'postgres';
import { digitos } from './contato';

export type Filtro = {
  municipios: string[]; // códigos RFB
  cnaes: string[]; // prefixos (2 a 7 dígitos)
  secundario: boolean; // procura também nos CNAEs secundários
  portes: string[];
  matriz: boolean;
  email: boolean;
  semContador: boolean;
  whatsapp: boolean;
  telefone: boolean;
  site: boolean;
  q: string;
  desde: string; // data de abertura mínima AAAA-MM-DD
  ate: string;
  capitalMin: number | null;
  foraCrm: boolean;
  enriquecido: '' | 'sim' | 'nao';
};

const lista = (v: string | null) =>
  (v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const bool = (v: string | null) => v === '1' || v === 'true';

export function filtroDeParams(p: URLSearchParams): Filtro {
  return {
    municipios: lista(p.get('municipios')),
    cnaes: lista(p.get('cnaes')).map(digitos).filter((c) => c.length >= 2),
    secundario: bool(p.get('secundario')),
    portes: lista(p.get('portes')),
    matriz: bool(p.get('matriz')),
    email: bool(p.get('email')),
    semContador: bool(p.get('semContador')),
    whatsapp: bool(p.get('whatsapp')),
    telefone: bool(p.get('telefone')),
    site: bool(p.get('site')),
    q: (p.get('q') || '').trim(),
    desde: /^\d{4}-\d{2}-\d{2}$/.test(p.get('desde') || '') ? p.get('desde')! : '',
    ate: /^\d{4}-\d{2}-\d{2}$/.test(p.get('ate') || '') ? p.get('ate')! : '',
    capitalMin: p.get('capitalMin') ? Number(p.get('capitalMin')) || null : null,
    foraCrm: bool(p.get('foraCrm')),
    enriquecido: (['sim', 'nao'].includes(p.get('enriquecido') || '') ? p.get('enriquecido') : '') as Filtro['enriquecido'],
  };
}

export function filtroDeObjeto(o: Record<string, unknown>): Filtro {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o || {})) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v));
  }
  return filtroDeParams(p);
}

const CONTADOR_RE = 'contab|contador|contabil|contábil|escritorio|assessoria|^fiscal@|^dp@|^rh@';

/** Monta o WHERE (alias da tabela empresas = e). */
export function whereEmpresas(sql: postgres.Sql<Record<string, unknown>>, f: Filtro) {
  const c: postgres.PendingQuery<postgres.Row[]>[] = [];
  if (f.municipios.length) c.push(sql`e.municipio_codigo in ${sql(f.municipios)}`);
  if (f.cnaes.length) {
    const ors = f.cnaes.map((cn) =>
      f.secundario
        ? sql`(e.cnae_principal like ${cn + '%'} or e.cnaes_secundarios ~ ${'(^|,)' + cn})`
        : sql`e.cnae_principal like ${cn + '%'}`,
    );
    c.push(sql`(${ors.reduce((a, b) => sql`${a} or ${b}`)})`);
  }
  if (f.portes.length) c.push(sql`e.porte in ${sql(f.portes)}`);
  if (f.matriz) c.push(sql`e.matriz`);
  if (f.email) {
    c.push(sql`(e.email is not null or e.site_emails is not null)`);
    if (f.semContador) c.push(sql`(e.site_emails is not null or e.email !~* ${CONTADOR_RE})`);
  }
  if (f.whatsapp) c.push(sql`coalesce(e.whatsapp, e.site_whatsapp) is not null`);
  if (f.telefone) c.push(sql`coalesce(e.telefone1, e.telefone2, e.google_telefone) is not null`);
  if (f.site) c.push(sql`e.google_site is not null`);
  if (f.q) {
    const d = digitos(f.q);
    c.push(
      d.length >= 8
        ? sql`e.cnpj like ${d + '%'}`
        : sql`(e.razao_social ilike ${'%' + f.q + '%'} or e.nome_fantasia ilike ${'%' + f.q + '%'})`,
    );
  }
  if (f.desde) c.push(sql`e.data_inicio >= ${f.desde}`);
  if (f.ate) c.push(sql`e.data_inicio <= ${f.ate}`);
  if (f.capitalMin) c.push(sql`e.capital_social >= ${f.capitalMin}`);
  if (f.foraCrm) c.push(sql`not exists (select 1 from leads l where l.cnpj = e.cnpj)`);
  if (f.enriquecido === 'sim') c.push(sql`e.enriquecido_em is not null`);
  if (f.enriquecido === 'nao') c.push(sql`e.enriquecido_em is null`);
  return c.reduce((a, b) => sql`${a} and ${b}`, sql`true`);
}

/** Colunas padrão de empresa para listagem/exportação. */
export function colunasEmpresa(sql: postgres.Sql<Record<string, unknown>>) {
  return sql`
    e.cnpj, e.razao_social, e.nome_fantasia, e.matriz, e.porte, e.capital_social, e.data_inicio,
    e.cnae_principal, c.descricao as cnae_descricao,
    e.tipo_logradouro, e.logradouro, e.numero, e.complemento, e.bairro, e.cep,
    m.nome as municipio, e.uf,
    e.telefone1, e.telefone2, e.email, e.whatsapp,
    e.google_telefone, e.google_site, e.google_maps_url, e.google_rating, e.google_avaliacoes,
    e.site_emails, e.site_whatsapp, e.enriquecido_em, e.enriquecimento_status,
    exists (select 1 from leads l where l.cnpj = e.cnpj) as em_crm`;
}

export function fromEmpresas(sql: postgres.Sql<Record<string, unknown>>) {
  return sql`empresas e
    left join municipios m on m.codigo = e.municipio_codigo
    left join cnaes c on c.codigo = e.cnae_principal`;
}

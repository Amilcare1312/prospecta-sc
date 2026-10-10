import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { digitos, ETAPA_IDS, semAcento, whatsappDe } from '@/lib/contato';
import { filtroDeObjeto, whereEmpresas } from '@/lib/filtros';
import { rota } from '@/lib/http';
import { contatosDoSite, emLotes } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CONTADOR = 'contab|contador|contabil|contábil|escritorio|assessoria|^fiscal@|^dp@|^rh@';

export const GET = rota(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const q = (p.get('q') || '').trim();
  const cidade = (p.get('cidade') || '').trim();
  const sql = db();
  const leads = await sql`
    select id, cnpj, nome, cidade, telefone, whatsapp, email, site, segmento, porte, origem, etapa, valor,
           responsavel, proximo_contato, nao_contatar, atualizado_em
    from leads
    where true
      ${q ? sql`and (nome ilike ${'%' + q + '%'} or razao_social ilike ${'%' + q + '%'} or email ilike ${'%' + q + '%'} or cnpj like ${digitos(q) + '%'})` : sql``}
      ${cidade ? sql`and cidade = ${cidade}` : sql``}
    order by proximo_contato asc nulls last, atualizado_em desc
    limit 3000`;
  const cidades = await sql`select distinct cidade from leads where cidade is not null order by cidade`;
  return NextResponse.json({ leads, cidades: cidades.map((c: any) => c.cidade) });
});

type LugarIn = {
  place_id: string; nome: string; endereco?: string | null; telefone?: string | null; site?: string | null;
  cidade?: string | null; cnpj?: string | null; tipo?: string | null; email_receita?: string | null;
};

export const POST = rota(async (req: Request) => {
  const body = (await req.json()) as {
    cnpjs?: string[];
    filtro?: Record<string, unknown>;
    limite?: number;
    lugares?: LugarIn[];
    buscarEmails?: boolean;
  };
  const sql = db();
  let inseridos = 0;

  const insertSelect = (where: any, limite: number) => sql`
    insert into leads (cnpj, google_place_id, nome, razao_social, cidade, uf, endereco, telefone, telefone2,
                       whatsapp, email, site, segmento, porte, origem)
    select e.cnpj, e.google_place_id, coalesce(nullif(e.nome_fantasia, ''), e.razao_social), e.razao_social,
      initcap(m.nome), e.uf,
      concat_ws(', ', nullif(concat_ws(' ', e.tipo_logradouro, e.logradouro, e.numero), ''), nullif(e.complemento, ''),
                nullif(e.bairro, ''), case when e.cep is not null then 'CEP ' || e.cep end),
      coalesce(e.telefone1, e.google_telefone),
      case when e.telefone2 is distinct from e.telefone1 then e.telefone2 end,
      coalesce(e.whatsapp, e.site_whatsapp),
      coalesce(case when e.email !~* ${CONTADOR} then e.email end, nullif(split_part(e.site_emails, ',', 1), ''), e.email),
      e.google_site, c.descricao, e.porte, 'cnpj'
    from empresas e
      left join municipios m on m.codigo = e.municipio_codigo
      left join cnaes c on c.codigo = e.cnae_principal
    where ${where} and not exists (select 1 from leads l where l.cnpj = e.cnpj)
    limit ${limite}
    on conflict do nothing`;

  if (body.cnpjs?.length) {
    const lista = body.cnpjs.map(digitos).filter((c) => c.length === 14).slice(0, 2000);
    if (lista.length) inseridos += (await insertSelect(sql`e.cnpj in ${sql(lista)}`, lista.length)).count;
  }

  if (body.filtro) {
    const limite = Math.min(2000, Math.max(1, Number(body.limite) || 200));
    inseridos += (await insertSelect(whereEmpresas(sql, filtroDeObjeto(body.filtro)), limite)).count;
  }

  if (body.lugares?.length) {
    const lugares = body.lugares.slice(0, 60);
    const extras = body.buscarEmails
      ? await emLotes(lugares, 4, (l) => (l.site ? contatosDoSite(l.site) : Promise.resolve({ emails: [], whatsapp: null })))
      : lugares.map(() => ({ emails: [] as string[], whatsapp: null as string | null }));
    for (let i = 0; i < lugares.length; i++) {
      const l = lugares[i];
      const ex = extras[i];
      const cnpj = l.cnpj && digitos(l.cnpj).length === 14 ? digitos(l.cnpj) : null;
      const r = await sql`
        insert into leads (cnpj, google_place_id, nome, cidade, endereco, telefone, whatsapp, email, site, segmento, origem)
        values (${cnpj}, ${l.place_id}, ${l.nome}, initcap(${l.cidade ? semAcento(l.cidade) : null}), ${l.endereco ?? null}, ${digitos(l.telefone) || null},
                ${ex.whatsapp || whatsappDe(l.telefone) || null}, ${ex.emails[0] || l.email_receita || null}, ${l.site ?? null},
                ${l.tipo ?? null}, 'google')
        on conflict do nothing`;
      inseridos += r.count;
      if (cnpj && ex.emails.length) {
        await sql`update empresas set site_emails = ${ex.emails.join(',')}, google_site = coalesce(google_site, ${l.site ?? null}),
                  google_place_id = coalesce(google_place_id, ${l.place_id}) where cnpj = ${cnpj}`;
      }
    }
  }

  return NextResponse.json({ inseridos, etapas: ETAPA_IDS });
});

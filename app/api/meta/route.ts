import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { placesConfigurado } from '@/lib/places';
import { sessao, ufsPermitidas } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

const g = globalThis as unknown as { __cacheMun?: { em: number; linhas: any[] } };

/** Cidades com empresas na base (cache de 10 min por instância). */
async function cidades() {
  if (g.__cacheMun && Date.now() - g.__cacheMun.em < 600_000) return g.__cacheMun.linhas;
  const linhas = await db()`
    select e.municipio_codigo as codigo, coalesce(m.nome, e.municipio_codigo) as nome, e.uf, count(*)::int as total
    from empresas e left join municipios m on m.codigo = e.municipio_codigo
    group by e.municipio_codigo, m.nome, e.uf
    order by e.uf, nome`;
  g.__cacheMun = { em: Date.now(), linhas };
  return linhas;
}

export const GET = rota(async () => {
  const s = await sessao();
  const permitidas = ufsPermitidas(s);
  const sql = db();
  const todas = await cidades();
  const municipios = permitidas ? todas.filter((m) => permitidas.includes(m.uf)) : todas;
  const ufsMap = new Map<string, number>();
  for (const m of municipios) ufsMap.set(m.uf, (ufsMap.get(m.uf) || 0) + m.total);
  const ufs = [...ufsMap.entries()].map(([uf, total]) => ({ uf, total })).sort((a, b) => a.uf.localeCompare(b.uf));
  const [tot] = await sql`
    select (select count(*) from leads where conta_id = ${s.contaId})::int as leads,
           (select max(ref_base) from empresas) as ref_base`;
  let etl: unknown = null;
  try {
    [etl] = await sql`select status, mensagem, quando from etl_execucoes order by id desc limit 1`;
  } catch {
    /* tabela ainda não existe */
  }
  return NextResponse.json({
    municipios, ufs, empresas: municipios.reduce((a, m) => a + m.total, 0), ...tot,
    etl: s.papel === 'superadmin' ? etl ?? null : null,
    googleConfigurado: placesConfigurado(),
  });
});

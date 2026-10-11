import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { placesConfigurado } from '@/lib/places';

export const dynamic = 'force-dynamic';

export const GET = rota(async () => {
  const sql = db();
  const municipios = await sql`
    select m.codigo, m.nome, count(e.cnpj)::int as total
    from municipios m join empresas e on e.municipio_codigo = m.codigo
    where m.uf = 'SC'
    group by m.codigo, m.nome
    order by m.nome`;
  const [tot] = await sql`
    select (select count(*) from empresas)::int as empresas,
           (select count(*) from leads)::int as leads,
           (select max(ref_base) from empresas) as ref_base`;
  let etl: unknown = null;
  try {
    [etl] = await sql`select status, mensagem, quando from etl_execucoes order by id desc limit 1`;
  } catch {
    /* tabela ainda não existe */
  }
  return NextResponse.json({ municipios, ...tot, etl: etl ?? null, googleConfigurado: placesConfigurado() });
});

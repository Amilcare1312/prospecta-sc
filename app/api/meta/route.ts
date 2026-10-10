import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { placesConfigurado } from '@/lib/places';

export const dynamic = 'force-dynamic';

export const GET = rota(async () => {
  const sql = db();
  const municipios = await sql`select codigo, nome from municipios where uf = 'SC' order by nome`;
  const [tot] = await sql`
    select (select count(*) from empresas)::int as empresas,
           (select count(*) from leads)::int as leads,
           (select max(ref_base) from empresas) as ref_base`;
  return NextResponse.json({ municipios, ...tot, googleConfigurado: placesConfigurado() });
});

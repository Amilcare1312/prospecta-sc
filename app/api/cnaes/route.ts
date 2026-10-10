import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { digitos } from '@/lib/contato';
import { rota } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = rota(async (req: Request) => {
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  const sql = db();
  const d = digitos(q);
  const rows = !q
    ? []
    : d.length >= 2 && d.length === q.replace(/[\s.\-/]/g, '').length
      ? await sql`select codigo, descricao from cnaes where codigo like ${d + '%'} order by codigo limit 30`
      : await sql`select codigo, descricao from cnaes where descricao ilike ${'%' + q + '%'} order by length(descricao) limit 30`;
  return NextResponse.json(rows);
});

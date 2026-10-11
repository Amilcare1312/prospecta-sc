import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { digitos } from '@/lib/contato';
import { rota } from '@/lib/http';
import { sessao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

const COM = 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ';
const SEM = 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC';
const PARADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com']);

/** "têxtil" → "text" (casa com têxteis); "metalúrgica" → "metalurgi". */
function radicais(q: string) {
  const ws = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w && !PARADAS.has(w));
  const r = ws.map((w) => (w.length <= 4 ? w : w.slice(0, Math.max(4, w.length - 2))));
  return r.length ? r : [''];
}

export const GET = rota(async (req: Request) => {
  await sessao();
  const p = new URL(req.url).searchParams;
  const q = (p.get('q') || '').trim();
  const lim = p.get('todos') ? 300 : 30;
  const sql = db();
  const d = digitos(q);
  const rows = !q
    ? []
    : d.length >= 2 && d.length === q.replace(/[\s.\-/]/g, '').length
      ? await sql`select codigo, descricao from cnaes where codigo like ${d + '%'} order by codigo limit ${lim}`
      : await sql`select codigo, descricao from cnaes where ${radicais(q)
          .map((r) => sql`lower(translate(descricao, ${COM}, ${SEM})) like ${'%' + r + '%'}`)
          .reduce((a, b) => sql`${a} and ${b}`)} order by codigo limit ${lim}`;
  return NextResponse.json(rows);
});

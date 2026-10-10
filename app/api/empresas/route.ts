import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { colunasEmpresa, filtroDeParams, fromEmpresas, whereEmpresas } from '@/lib/filtros';
import { rota } from '@/lib/http';

export const dynamic = 'force-dynamic';

const ORDENS: Record<string, string> = {
  nome: 'coalesce(nullif(e.nome_fantasia, \'\'), e.razao_social)',
  abertura: 'e.data_inicio desc nulls last',
  capital: 'e.capital_social desc nulls last',
};

export const GET = rota(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const f = filtroDeParams(p);
  const pagina = Math.max(1, Number(p.get('pagina')) || 1);
  const porPagina = Math.min(200, Math.max(10, Number(p.get('porPagina')) || 50));
  const ordem = ORDENS[p.get('ordem') || 'nome'] || ORDENS.nome;
  const sql = db();
  const where = whereEmpresas(sql, f);
  const [linhas, [{ total }]] = await Promise.all([
    sql`select ${colunasEmpresa(sql)} from ${fromEmpresas(sql)} where ${where}
        order by ${sql.unsafe(ordem)}, e.cnpj
        limit ${porPagina} offset ${(pagina - 1) * porPagina}`,
    sql`select count(*)::int as total from empresas e where ${where}`,
  ]);
  return NextResponse.json({ linhas, total, pagina, porPagina });
});

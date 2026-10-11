import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { exigirAdmin, sessao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const PLANOS = ['teste', 'mensal', 'anual', 'vitalicio'];

/** Ações: { adicionarDias }, { plano }, { bloqueada }, { ufs }, { observacoes }, { semVencimento } */
export const PATCH = rota(async (req: Request, ctx: Ctx) => {
  const s = await sessao();
  exigirAdmin(s);
  const id = Number((await ctx.params).id);
  const b = (await req.json()) as Record<string, unknown>;
  const sql = db();
  if (typeof b.adicionarDias === 'number' && b.adicionarDias !== 0) {
    const d = Math.max(-3650, Math.min(3650, Math.round(b.adicionarDias)));
    await sql`update contas set ativo_ate = greatest(coalesce(ativo_ate, now()), now()) + make_interval(days => ${d}) where id = ${id}`;
  }
  if (b.semVencimento === true) await sql`update contas set ativo_ate = null where id = ${id}`;
  if (typeof b.plano === 'string' && PLANOS.includes(b.plano)) await sql`update contas set plano = ${b.plano} where id = ${id}`;
  if (typeof b.bloqueada === 'boolean') await sql`update contas set bloqueada = ${b.bloqueada} where id = ${id}`;
  if (typeof b.ufs === 'string') {
    const ufs = b.ufs.toUpperCase().split(/[^A-Z]+/).filter((u) => u.length === 2).join(',');
    await sql`update contas set ufs = ${ufs || null} where id = ${id}`;
  }
  if (typeof b.observacoes === 'string') await sql`update contas set observacoes = ${b.observacoes} where id = ${id}`;
  const [conta] = await sql`select * from contas where id = ${id}`;
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 });
  return NextResponse.json({ conta });
});

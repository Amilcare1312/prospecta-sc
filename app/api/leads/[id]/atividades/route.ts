import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { sessao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };
const TIPOS = ['nota', 'whatsapp', 'email', 'ligacao', 'visita'];

export const POST = rota(async (req: Request, ctx: Ctx) => {
  const s = await sessao();
  const id = Number((await ctx.params).id);
  const { tipo, descricao } = (await req.json()) as { tipo: string; descricao?: string };
  if (!TIPOS.includes(tipo)) return NextResponse.json({ erro: 'Tipo inválido' }, { status: 400 });
  const sql = db();
  const [dono] = await sql`select 1 from leads where id = ${id} and conta_id = ${s.contaId}`;
  if (!dono) return NextResponse.json({ erro: 'Lead não encontrado' }, { status: 404 });
  const [atividade] = await sql`insert into atividades (lead_id, tipo, descricao) values (${id}, ${tipo}, ${descricao || null}) returning *`;
  // primeiro contato tira o lead de "Novo"
  const [lead] = await sql`
    update leads set atualizado_em = now(),
      etapa = case when etapa = 'novo' and ${tipo} <> 'nota' then 'contatado' else etapa end
    where id = ${id} and conta_id = ${s.contaId} returning id, etapa`;
  return NextResponse.json({ atividade, lead });
});

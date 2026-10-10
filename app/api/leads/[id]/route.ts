import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { digitos, ETAPA_IDS } from '@/lib/contato';
import { rota } from '@/lib/http';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = rota(async (_req: Request, ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  const sql = db();
  const [lead] = await sql`
    select l.*, e.cnae_principal, e.capital_social, e.data_inicio, e.email as email_receita, e.site_emails,
           e.telefone1 as telefone_receita, e.google_maps_url, e.google_rating, e.google_avaliacoes
    from leads l left join empresas e on e.cnpj = l.cnpj where l.id = ${id}`;
  if (!lead) return NextResponse.json({ erro: 'Lead não encontrado' }, { status: 404 });
  const atividades = await sql`select * from atividades where lead_id = ${id} order by criado_em desc limit 200`;
  return NextResponse.json({ lead, atividades });
});

const EDITAVEIS = ['nome', 'etapa', 'valor', 'responsavel', 'observacoes', 'proximo_contato', 'nao_contatar',
  'telefone', 'telefone2', 'whatsapp', 'email', 'site', 'endereco'] as const;

export const PATCH = rota(async (req: Request, ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  const body = (await req.json()) as Record<string, unknown>;
  const dados: Record<string, unknown> = {};
  for (const k of EDITAVEIS) if (k in body) dados[k] = body[k] === '' ? null : body[k];
  if ('etapa' in dados && !ETAPA_IDS.includes(String(dados.etapa))) return NextResponse.json({ erro: 'Etapa inválida' }, { status: 400 });
  for (const k of ['telefone', 'telefone2', 'whatsapp'] as const) if (dados[k]) dados[k] = digitos(String(dados[k]));
  if (dados.valor !== undefined && dados.valor !== null) dados.valor = Number(String(dados.valor).replace(',', '.')) || null;
  if (!Object.keys(dados).length) return NextResponse.json({ erro: 'Nada para atualizar' }, { status: 400 });
  const sql = db();
  const [antes] = await sql`select etapa from leads where id = ${id}`;
  if (!antes) return NextResponse.json({ erro: 'Lead não encontrado' }, { status: 404 });
  const [lead] = await sql`update leads set ${sql(dados)}, atualizado_em = now() where id = ${id} returning *`;
  if (dados.etapa && dados.etapa !== antes.etapa) {
    await sql`insert into atividades (lead_id, tipo, descricao) values (${id}, 'etapa', ${`${antes.etapa} → ${dados.etapa}`})`;
  }
  return NextResponse.json({ lead });
});

export const DELETE = rota(async (_req: Request, ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  await db()`delete from leads where id = ${id}`;
  return NextResponse.json({ ok: true });
});

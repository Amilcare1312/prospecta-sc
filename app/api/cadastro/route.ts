import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { digitos } from '@/lib/contato';
import { rota } from '@/lib/http';
import { garantirSchema } from '@/lib/migrate';
import { respostaComSessao } from '@/lib/resposta-sessao';
import { hashSenha } from '@/lib/senha';

export const dynamic = 'force-dynamic';

/** Cadastro público: cria a conta com período de teste (TESTE_DIAS, padrão 7). */
export const POST = rota(async (req: Request) => {
  if (process.env.CADASTRO_ABERTO === 'false') {
    return NextResponse.json({ erro: 'Cadastros fechados no momento. Fale com o suporte.' }, { status: 403 });
  }
  await garantirSchema();
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const nome = (b.nome || '').trim();
  const empresa = (b.empresa || '').trim();
  const email = (b.email || '').trim().toLowerCase();
  const whatsapp = digitos(b.whatsapp);
  const senha = b.senha || '';
  if (nome.length < 2 || empresa.length < 2) return NextResponse.json({ erro: 'Informe seu nome e o nome da empresa.' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email === (process.env.ADMIN_EMAIL || 'admin').toLowerCase()) {
    return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
  }
  if (whatsapp.length < 10) return NextResponse.json({ erro: 'Informe um WhatsApp com DDD.' }, { status: 400 });
  if (senha.length < 6) return NextResponse.json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 });

  const sql = db();
  const [existe] = await sql`select 1 from usuarios where lower(email) = ${email}`;
  if (existe) return NextResponse.json({ erro: 'Já existe uma conta com esse e-mail. Faça login.' }, { status: 409 });

  const dias = Math.max(0, Number(process.env.TESTE_DIAS ?? 7) || 0);
  const ufs = (process.env.UFS_TESTE || '').trim() || null;
  const h = await hashSenha(senha);
  const u = await sql.begin(async (tx) => {
    const [c] = await tx`
      insert into contas (nome, whatsapp, plano, ativo_ate, ufs)
      values (${empresa}, ${whatsapp}, 'teste', now() + make_interval(days => ${dias}), ${ufs})
      returning id`;
    const [u] = await tx`
      insert into usuarios (conta_id, nome, email, senha_hash, papel)
      values (${c.id as number}, ${nome}, ${email}, ${h}, 'dono')
      returning id, conta_id, papel`;
    return u;
  });
  return respostaComSessao(u as any, { ok: true, dias });
});

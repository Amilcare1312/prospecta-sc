import { NextResponse } from 'next/server';
import { iguais } from '@/lib/auth';
import { respostaComSessao } from '@/lib/resposta-sessao';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { garantirSchema } from '@/lib/migrate';
import { conferirSenha, hashSenha } from '@/lib/senha';

export const dynamic = 'force-dynamic';

const ADMIN = () => (process.env.ADMIN_EMAIL || 'admin').toLowerCase();

export const POST = rota(async (req: Request) => {
  await garantirSchema();
  const { email, senha } = (await req.json().catch(() => ({}))) as { email?: string; senha?: string };
  const e = (email || '').trim().toLowerCase();
  if (!e || !senha) return NextResponse.json({ erro: 'Informe e-mail e senha.' }, { status: 400 });
  const sql = db();

  // Administrador: e-mail ADMIN_EMAIL (padrão "admin") + APP_PASSWORD
  const senhaAdmin = process.env.APP_PASSWORD || '';
  if (e === ADMIN() && senhaAdmin && iguais(senha, senhaAdmin)) {
    const h = await hashSenha(senha);
    const [u] = await sql`
      insert into usuarios (conta_id, nome, email, senha_hash, papel)
      values (1, 'Administrador', ${e}, ${h}, 'superadmin')
      on conflict (lower(email)) do update set papel = 'superadmin', senha_hash = excluded.senha_hash
      returning id, conta_id, papel`;
    await sql`update usuarios set ultimo_acesso = now() where id = ${u.id as number}`;
    return respostaComSessao(u as any);
  }

  const [u] = await sql`select id, conta_id, papel, senha_hash from usuarios where lower(email) = ${e}`;
  if (!u || !(await conferirSenha(senha, u.senha_hash as string))) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ erro: 'E-mail ou senha incorretos.' }, { status: 401 });
  }
  await sql`update usuarios set ultimo_acesso = now() where id = ${u.id as number}`;
  return respostaComSessao(u as any);
});

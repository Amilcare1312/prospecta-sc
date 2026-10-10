import { NextResponse } from 'next/server';
import { COOKIE, iguais, tokenEsperado } from '@/lib/auth';

export async function POST(req: Request) {
  const senhaConfig = process.env.APP_PASSWORD;
  if (!senhaConfig) return NextResponse.json({ erro: 'Configure APP_PASSWORD nas variáveis de ambiente.' }, { status: 500 });
  const { senha } = (await req.json().catch(() => ({}))) as { senha?: string };
  if (!senha || !iguais(senha, senhaConfig)) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ erro: 'Senha incorreta' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await tokenEsperado(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

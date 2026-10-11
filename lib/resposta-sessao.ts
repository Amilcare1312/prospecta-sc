import { NextResponse } from 'next/server';
import { assinar, COOKIE, DURACAO_S } from './auth';

export async function respostaComSessao(u: { id: number; conta_id: number; papel: string }, corpo: object = { ok: true }) {
  const res = NextResponse.json(corpo);
  res.cookies.set(COOKIE, await assinar({ u: u.id, c: u.conta_id, p: u.papel }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACAO_S,
  });
  return res;
}

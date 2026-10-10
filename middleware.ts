import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, iguais, tokenEsperado } from './lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();
  const c = req.cookies.get(COOKIE)?.value || '';
  if (process.env.APP_PASSWORD && c && iguais(c, await tokenEsperado())) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ erro: 'Sessão expirada. Entre novamente.' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] };

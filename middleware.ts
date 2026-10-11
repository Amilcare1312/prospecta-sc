import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verificar } from './lib/auth';

const PUBLICAS = ['/login', '/cadastro', '/api/login', '/api/cadastro', '/api/webhooks/asaas'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.includes(pathname)) return NextResponse.next();
  const t = await verificar(req.cookies.get(COOKIE)?.value).catch(() => null);
  if (t) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ erro: 'Sessão expirada. Entre novamente.' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] };

// Token de sessão assinado (HMAC-SHA256). Funciona no runtime Edge (middleware) e no Node.
export const COOKIE = 'prospecta_sessao';
export const DURACAO_S = 60 * 60 * 24 * 30;

export type Token = { u: number; c: number; p: string; exp: number };

const enc = new TextEncoder();
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function chave() {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo || segredo.length < 16) throw new Error('Configure AUTH_SECRET (texto aleatório longo)');
  return crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function assinar(t: Omit<Token, 'exp'>): Promise<string> {
  const corpo = b64url(enc.encode(JSON.stringify({ ...t, exp: Math.floor(Date.now() / 1000) + DURACAO_S })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await chave(), enc.encode(corpo)));
  return `${corpo}.${b64url(sig)}`;
}

export async function verificar(token?: string | null): Promise<Token | null> {
  if (!token || !token.includes('.')) return null;
  const [corpo, sig] = token.split('.');
  try {
    const ok = await crypto.subtle.verify('HMAC', await chave(), deB64url(sig), enc.encode(corpo));
    if (!ok) return null;
    const t = JSON.parse(new TextDecoder().decode(deB64url(corpo))) as Token;
    if (!t.exp || t.exp < Date.now() / 1000) return null;
    return t;
  } catch {
    return null;
  }
}

export function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

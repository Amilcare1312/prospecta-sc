// Sessão simples por senha única (APP_PASSWORD). Funciona no runtime Edge (middleware).
export const COOKIE = 'prospecta_sessao';

export async function tokenEsperado(): Promise<string> {
  const segredo = process.env.AUTH_SECRET || 'dev-secret';
  const senha = process.env.APP_PASSWORD || '';
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode('sessao:' + senha));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Lê a página inicial e a de contato do site da empresa e extrai e-mails e WhatsApp.
import { digitos, whatsappDe } from './contato';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const WA_RE = /(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:[^"'<>]*&)?phone=|whatsapp:\/\/send\?phone=)(\+?\d[\d\s-]{9,16})/gi;
const IGNORAR = /\.(png|jpe?g|gif|svg|webp|css|js)$|sentry|wixpress|example\.|seudominio|email@|nome@|@sentry|godaddy|wordpress|w3\.org/i;

async function baixar(url: string, ms = 7000): Promise<string> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProspectaSC/1.0)', Accept: 'text/html' },
      cache: 'no-store',
    });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('html')) return '';
    const txt = await r.text();
    return txt.slice(0, 600_000);
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

export async function contatosDoSite(site: string): Promise<{ emails: string[]; whatsapp: string | null }> {
  let base: URL;
  try {
    base = new URL(site.startsWith('http') ? site : `https://${site}`);
  } catch {
    return { emails: [], whatsapp: null };
  }
  // Redes sociais e marketplaces não têm o e-mail no HTML
  if (/facebook|instagram|linkedin|wa\.me|whatsapp|ifood|mercadolivre|google\./i.test(base.hostname)) {
    return { emails: [], whatsapp: null };
  }
  const paginas = [base.toString()];
  for (const p of ['/contato', '/fale-conosco', '/contact']) paginas.push(new URL(p, base).toString());

  const emails = new Map<string, number>();
  let whatsapp: string | null = null;
  const dominio = base.hostname.replace(/^www\./, '');

  for (const url of paginas) {
    const html = await baixar(url);
    if (!html) continue;
    const texto = html.replace(/&#64;|&commat;|\[at\]|\(at\)/gi, '@');
    for (const m of texto.matchAll(EMAIL_RE)) {
      const e = m[0].toLowerCase().replace(/^mailto:/, '');
      if (IGNORAR.test(e)) continue;
      // e-mails do próprio domínio vêm primeiro
      emails.set(e, (emails.get(e) || 0) + (e.endsWith('@' + dominio) ? 10 : 1));
    }
    if (!whatsapp) {
      for (const m of texto.matchAll(WA_RE)) {
        const n = digitos(m[1]);
        const w = whatsappDe(n.startsWith('55') ? n : '55' + n);
        if (w) {
          whatsapp = w;
          break;
        }
      }
    }
    if (emails.size >= 3 && whatsapp) break;
  }
  return {
    emails: [...emails.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e).slice(0, 3),
    whatsapp,
  };
}

/** Executa tarefas com limite de concorrência. */
export async function emLotes<T, R>(itens: T[], limite: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(itens.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, async () => {
      while (i < itens.length) {
        const k = i++;
        out[k] = await fn(itens[k]);
      }
    }),
  );
  return out;
}

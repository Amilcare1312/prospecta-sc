'use client';
import { useEffect, useState } from 'react';

/* ---------- ícones (traço 1.8, 16px) ---------- */
const P: Record<string, string> = {
  busca: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35',
  mapa: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  funil: 'M3 5h18l-7 8.5V19l-4 2v-7.5L3 5Z',
  tel: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  email: 'M3 6h18v12H3zM3 7l9 6 9-6',
  wa: 'M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3l-4.5 1.5ZM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a4.6 4.6 0 0 1-2.2-2.2l.8-1-1-2L9 8.5Z',
  site: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z',
  mais: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  baixar: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  raio: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  estrela: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z',
  nota: 'M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5',
  sair: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  lixo: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  check: 'M5 12.5 10 17 19 7',
  seta: 'M9 6l6 6-6 6',
  calendario: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  pessoa: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
};
export function Icone({ n, s = 16, className }: { n: keyof typeof P | string; s?: number; className?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={P[n] || ''} />
    </svg>
  );
}

/* ---------- API ---------- */
export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (r.status === 401 && typeof window !== 'undefined' && !url.includes('/api/login')) {
    window.location.href = '/login';
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as any).erro || `Erro ${r.status}`);
  return j as T;
}

/* ---------- toasts ---------- */
type T = { id: number; msg: string; erro?: boolean };
let ouvinte: ((t: T) => void) | null = null;
export function toast(msg: string, erro = false) {
  ouvinte?.({ id: Date.now() + Math.random(), msg, erro });
}
export function Toasts() {
  const [lista, setLista] = useState<T[]>([]);
  useEffect(() => {
    ouvinte = (t) => {
      setLista((l) => [...l, t]);
      setTimeout(() => setLista((l) => l.filter((x) => x.id !== t.id)), t.erro ? 6000 : 3200);
    };
    return () => { ouvinte = null; };
  }, []);
  return (
    <div className="toasts" role="status">
      {lista.map((t) => <div key={t.id} className={`toast ${t.erro ? 'erro' : ''}`}>{t.msg}</div>)}
    </div>
  );
}

export const fmtN = (n?: number | null) => (n ?? 0).toLocaleString('pt-BR');
export const fmtR$ = (n?: number | string | null) =>
  n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const fmtData = (d?: string | null) => (d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '');

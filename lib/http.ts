import { NextResponse } from 'next/server';

export function erro(e: unknown, status = 500) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  return NextResponse.json({ erro: msg }, { status });
}

export function rota<A extends unknown[]>(fn: (...a: A) => Promise<Response>) {
  return async (...a: A) => {
    try {
      return await fn(...a);
    } catch (e) {
      return erro(e);
    }
  };
}

/** CSV com ; e BOM (abre direto no Excel em português). */
export function csv(nome: string, colunas: [string, string][], linhas: Record<string, unknown>[]) {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = [colunas.map((c) => c[1]).join(';'), ...linhas.map((l) => colunas.map(([k]) => esc(l[k])).join(';'))].join('\r\n');
  return new Response('﻿' + corpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
    },
  });
}

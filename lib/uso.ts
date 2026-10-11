import { db } from './db';
import { ErroHttp, type Sessao } from './sessao';

const mesAtual = () => new Date().toISOString().slice(0, 7);
export const limiteGoogle = () => Math.max(0, Number(process.env.GOOGLE_LIMITE_MENSAL ?? 300) || 0);

/** Reserva `n` consultas ao Google para a conta no mês. Lança 429 se passar do limite. */
export async function consumirGoogle(s: Sessao, n: number): Promise<void> {
  const sql = db();
  const mes = mesAtual();
  if (s.papel === 'superadmin') {
    await sql`insert into uso_mensal (conta_id, mes, google) values (${s.contaId}, ${mes}, ${n})
              on conflict (conta_id, mes) do update set google = uso_mensal.google + ${n}`;
    return;
  }
  const lim = limiteGoogle();
  const [r] = await sql`
    insert into uso_mensal (conta_id, mes, google) values (${s.contaId}, ${mes}, ${n})
    on conflict (conta_id, mes) do update set google = uso_mensal.google + ${n}
    where uso_mensal.google + ${n} <= ${lim}
    returning google`;
  if (!r || n > lim) {
    const [u] = await sql`select google from uso_mensal where conta_id = ${s.contaId} and mes = ${mes}`;
    const usado = (u?.google as number) ?? 0;
    throw new ErroHttp(429, `Limite mensal de consultas ao Google atingido (${usado} de ${lim}). Renova no início do próximo mês.`);
  }
}

export async function usoGoogle(contaId: number) {
  const [u] = await db()`select google from uso_mensal where conta_id = ${contaId} and mes = ${mesAtual()}`;
  return { usado: (u?.google as number) ?? 0, limite: limiteGoogle() };
}

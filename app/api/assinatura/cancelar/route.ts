import { NextResponse } from 'next/server';
import { cancelarAssinatura } from '@/lib/asaas';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { ErroHttp, sessao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

/** Cancela a renovação. O acesso continua até o fim do período já pago. */
export const POST = rota(async () => {
  const s = await sessao({ exigirAtiva: false });
  const sql = db();
  const [c] = await sql`select asaas_subscription_id from contas where id = ${s.contaId}`;
  if (!c?.asaas_subscription_id) throw new ErroHttp(400, 'Não há assinatura ativa.');
  await cancelarAssinatura(c.asaas_subscription_id as string);
  await sql`update contas set asaas_subscription_id = null, asaas_ciclo = null where id = ${s.contaId}`;
  return NextResponse.json({ ok: true, acessoAte: s.conta.ativo_ate });
});

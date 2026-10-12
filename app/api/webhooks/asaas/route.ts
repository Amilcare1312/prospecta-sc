import { NextResponse } from 'next/server';
import { diasDoCiclo, precos } from '@/lib/asaas';
import { iguais } from '@/lib/auth';
import { db } from '@/lib/db';
import { garantirSchema } from '@/lib/migrate';
import { enviarEventoMeta } from '@/lib/meta-capi';

export const dynamic = 'force-dynamic';

const PAGO = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
const ESTORNO = ['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED'];

/**
 * Webhook do Asaas. Configure no painel do Asaas (Integrações → Webhooks):
 *   URL: https://SEU-SITE/api/webhooks/asaas   Token: o mesmo valor de ASAAS_WEBHOOK_TOKEN
 *   Eventos: cobranças (PAYMENT_*) e assinaturas (SUBSCRIPTION_*).
 */
export async function POST(req: Request) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const recebido = req.headers.get('asaas-access-token') || '';
  if (!esperado || !iguais(recebido, esperado)) return NextResponse.json({ erro: 'token inválido' }, { status: 401 });

  let ev: any;
  try { ev = await req.json(); } catch { return NextResponse.json({ ok: true }); }
  const evento: string = ev?.event || '';
  try {
    await garantirSchema();
    const sql = db();

    if (evento.startsWith('SUBSCRIPTION_') && ['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'].includes(evento)) {
      const id = ev.subscription?.id;
      if (id) await sql`update contas set asaas_subscription_id = null, asaas_ciclo = null where asaas_subscription_id = ${id}`;
      return NextResponse.json({ ok: true });
    }

    const p = ev?.payment;
    if (!p?.id) return NextResponse.json({ ok: true });

    // conta: pela assinatura, pelo cliente ou pela referência "conta:ID"
    const ref = /^conta:(\d+)$/.exec(p.externalReference || '')?.[1];
    const [conta] = await sql`
      select id, asaas_ciclo from contas
      where (${p.subscription ?? null}::text is not null and asaas_subscription_id = ${p.subscription ?? null})
         or (${p.customer ?? null}::text is not null and asaas_customer_id = ${p.customer ?? null})
         or id = ${ref ? Number(ref) : -1}
      order by (asaas_subscription_id = ${p.subscription ?? ''}) desc
      limit 1`;

    await sql`
      insert into pagamentos (id, conta_id, assinatura, valor, status, evento, vencimento, invoice_url)
      values (${p.id}, ${conta?.id ?? null}, ${p.subscription ?? null}, ${p.value ?? null}, ${p.status ?? null}, ${evento},
              ${p.dueDate ?? null}, ${p.invoiceUrl ?? null})
      on conflict (id) do update set status = excluded.status, evento = excluded.evento,
        conta_id = coalesce(pagamentos.conta_id, excluded.conta_id), atualizado_em = now()`;

    if (conta && PAGO.includes(evento)) {
      // credita uma vez só por pagamento (CONFIRMED e RECEIVED podem chegar os dois)
      const [credito] = await sql`update pagamentos set creditado = true where id = ${p.id} and not creditado returning id`;
      if (credito) {
        const anual = precos().anual;
        const ciclo = (conta.asaas_ciclo as string) || (anual && Number(p.value) >= anual ? 'anual' : 'mensal');
        const dias = diasDoCiclo(ciclo);
        await sql`
          update contas set
            ativo_ate = greatest(coalesce(ativo_ate, now()), now()) + make_interval(days => ${dias}),
            plano = ${ciclo}, bloqueada = false
          where id = ${conta.id as number}`;
        const [dono] = await sql`
          select u.email, c.whatsapp, c.meta_fbp, c.meta_fbc from contas c
          left join usuarios u on u.conta_id = c.id and u.papel = 'dono'
          where c.id = ${conta.id as number} limit 1`;
        await enviarEventoMeta({
          nome: 'Purchase', id: `pagamento-${p.id}`, valor: Number(p.value) || 0,
          url: `${process.env.APP_URL || ''}/assinatura`,
          usuario: { email: dono?.email as string, telefone: dono?.whatsapp as string, externalId: conta.id as number,
            fbp: dono?.meta_fbp as string, fbc: dono?.meta_fbc as string },
        });
      }
    }
    if (conta && ESTORNO.includes(evento)) {
      const [era] = await sql`update pagamentos set creditado = false where id = ${p.id} and creditado returning id`;
      if (era) {
        const dias = diasDoCiclo(conta.asaas_ciclo as string);
        await sql`update contas set ativo_ate = ativo_ate - make_interval(days => ${dias}) where id = ${conta.id as number} and ativo_ate is not null`;
      }
    }
  } catch (e) {
    console.error('webhook asaas', evento, e);
    return NextResponse.json({ erro: 'falha ao processar' }, { status: 500 }); // o Asaas reenvia
  }
  return NextResponse.json({ ok: true });
}

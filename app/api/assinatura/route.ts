import { NextResponse } from 'next/server';
import { asaasConfigurado, cpfCnpjValido, criarAssinatura, criarCliente, atualizarCpfCnpj, faturaPendente, precos, type Ciclo } from '@/lib/asaas';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { ErroHttp, sessao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

export const GET = rota(async () => {
  const s = await sessao({ exigirAtiva: false });
  const sql = db();
  const [c] = await sql`select asaas_subscription_id, asaas_ciclo from contas where id = ${s.contaId}`;
  const pagamentos = await sql`
    select id, valor, status, vencimento, invoice_url, criado_em from pagamentos
    where conta_id = ${s.contaId} order by criado_em desc limit 12`;
  let pendente = null;
  if (asaasConfigurado() && c?.asaas_subscription_id) {
    pendente = await faturaPendente(c.asaas_subscription_id as string).catch(() => null);
  }
  return NextResponse.json({
    configurado: asaasConfigurado(),
    precos: precos(),
    conta: s.conta, ativa: s.ativa, diasRestantes: s.diasRestantes,
    assinatura: c?.asaas_subscription_id ? { id: c.asaas_subscription_id, ciclo: c.asaas_ciclo } : null,
    pendente, pagamentos,
    suporteWhatsapp: process.env.SUPORTE_WHATSAPP || null,
  });
});

/** Cria (ou reaproveita) a assinatura e devolve o link da fatura para pagar. */
export const POST = rota(async (req: Request) => {
  const s = await sessao({ exigirAtiva: false });
  if (s.papel === 'superadmin') throw new ErroHttp(400, 'A conta do administrador não precisa de assinatura.');
  if (!asaasConfigurado()) throw new ErroHttp(503, 'Pagamento online ainda não configurado. Fale com o suporte.');
  const { ciclo, cpfCnpj } = (await req.json()) as { ciclo: Ciclo; cpfCnpj?: string };
  const valor = precos()[ciclo === 'anual' ? 'anual' : 'mensal'];
  if (!valor) throw new ErroHttp(400, 'Plano indisponível.');
  const sql = db();
  const [c] = await sql`select asaas_customer_id, asaas_subscription_id, asaas_ciclo, whatsapp from contas where id = ${s.contaId}`;

  // Já tem assinatura do mesmo ciclo? devolve a fatura em aberto
  if (c.asaas_subscription_id && c.asaas_ciclo === ciclo) {
    const p = await faturaPendente(c.asaas_subscription_id as string);
    if (p) return NextResponse.json({ url: p.url });
  }

  let customer = c.asaas_customer_id as string | null;
  if (!customer || cpfCnpj) {
    if (!cpfCnpj || !cpfCnpjValido(cpfCnpj)) throw new ErroHttp(400, 'Informe um CPF ou CNPJ válido para emitir a cobrança.');
  }
  if (!customer) {
    customer = await criarCliente({ nome: s.conta.nome, email: s.email, cpfCnpj: cpfCnpj!, whatsapp: c.whatsapp as string, contaId: s.contaId });
    await sql`update contas set asaas_customer_id = ${customer} where id = ${s.contaId}`;
  } else if (cpfCnpj) {
    await atualizarCpfCnpj(customer, cpfCnpj);
  }

  const appUrl = process.env.APP_URL || new URL(req.url).origin;
  const sub = await criarAssinatura({ customerId: customer, ciclo, valor, contaId: s.contaId, sucessoUrl: `${appUrl}/assinatura?pago=1` });
  // assinatura antiga de outro ciclo: o webhook/cancelamento cuida; guardamos a nova
  const antiga = c.asaas_subscription_id as string | null;
  await sql`update contas set asaas_subscription_id = ${sub}, asaas_ciclo = ${ciclo} where id = ${s.contaId}`;
  if (antiga && antiga !== sub) {
    const { cancelarAssinatura } = await import('@/lib/asaas');
    await cancelarAssinatura(antiga).catch(() => {});
  }
  // a primeira cobrança é gerada na hora
  let p = null;
  for (let i = 0; i < 4 && !p; i++) {
    p = await faturaPendente(sub);
    if (!p) await new Promise((r) => setTimeout(r, 700));
  }
  if (!p) throw new ErroHttp(502, 'Assinatura criada, mas a fatura ainda não ficou disponível. Tente de novo em instantes.');
  return NextResponse.json({ url: p.url });
});

// Integração com o Asaas (cobrança recorrente: PIX, boleto e cartão).
// Docs: https://docs.asaas.com
import { digitos } from './contato';

export type Ciclo = 'mensal' | 'anual';

export function asaasConfigurado() {
  return !!process.env.ASAAS_API_KEY;
}

function base() {
  if (process.env.ASAAS_BASE_URL) return process.env.ASAAS_BASE_URL.replace(/\/$/, '');
  return process.env.ASAAS_AMBIENTE === 'producao' ? 'https://api.asaas.com' : 'https://api-sandbox.asaas.com';
}

export function precos() {
  const m = Number(String(process.env.PRECO_MENSAL || '').replace(',', '.')) || 0;
  const a = Number(String(process.env.PRECO_ANUAL || '').replace(',', '.')) || 0;
  return { mensal: m > 0 ? m : null, anual: a > 0 ? a : null };
}

export const diasDoCiclo = (c: string | null | undefined) => (c === 'anual' ? 365 : 30);

async function chamar<T = any>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(base() + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ProspectaSC',
      access_token: process.env.ASAAS_API_KEY || '',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: 'no-store',
  });
  const txt = await r.text();
  let j: any = {};
  try { j = txt ? JSON.parse(txt) : {}; } catch { /* resposta não-JSON */ }
  if (!r.ok) {
    const msg = j?.errors?.map((e: any) => e.description).join(' ') || `Asaas ${r.status}`;
    throw new Error(msg);
  }
  return j as T;
}

export async function criarCliente(d: { nome: string; email: string; cpfCnpj: string; whatsapp?: string | null; contaId: number }) {
  const c = await chamar<{ id: string }>('POST', '/v3/customers', {
    name: d.nome,
    email: d.email,
    cpfCnpj: digitos(d.cpfCnpj),
    mobilePhone: d.whatsapp ? digitos(d.whatsapp).replace(/^55(?=\d{10,11}$)/, '') : undefined,
    externalReference: `conta:${d.contaId}`,
    notificationDisabled: false,
  });
  return c.id;
}

export async function atualizarCpfCnpj(customerId: string, cpfCnpj: string) {
  await chamar('PUT', `/v3/customers/${customerId}`, { cpfCnpj: digitos(cpfCnpj) });
}

export async function criarAssinatura(d: { customerId: string; ciclo: Ciclo; valor: number; contaId: number; sucessoUrl?: string }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const s = await chamar<{ id: string }>('POST', '/v3/subscriptions', {
    customer: d.customerId,
    billingType: 'UNDEFINED', // o cliente escolhe PIX, boleto ou cartão na fatura
    value: d.valor,
    nextDueDate: hoje,
    cycle: d.ciclo === 'anual' ? 'YEARLY' : 'MONTHLY',
    description: `Prospecta SC — plano ${d.ciclo}`,
    externalReference: `conta:${d.contaId}`,
    ...(d.sucessoUrl ? { callback: { successUrl: d.sucessoUrl, autoRedirect: true } } : {}),
  });
  return s.id;
}

export async function faturaPendente(subscriptionId: string): Promise<{ id: string; url: string; vencimento: string; valor: number } | null> {
  const r = await chamar<{ data: any[] }>('GET', `/v3/subscriptions/${subscriptionId}/payments`);
  const p = (r.data || []).find((x) => ['PENDING', 'OVERDUE'].includes(x.status));
  return p ? { id: p.id, url: p.invoiceUrl, vencimento: p.dueDate, valor: p.value } : null;
}

export async function cancelarAssinatura(subscriptionId: string) {
  await chamar('DELETE', `/v3/subscriptions/${subscriptionId}`);
}

export function cpfCnpjValido(v: string) {
  const d = digitos(v);
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (n: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (n: number) => {
      const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const s = pesos.reduce((a, p, i) => a + Number(d[i]) * p, 0);
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }
  return false;
}

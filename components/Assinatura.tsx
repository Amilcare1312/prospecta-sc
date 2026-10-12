'use client';
import { useEffect, useState } from 'react';
import { linkWhatsapp } from '@/lib/contato';
import { rastrear } from '@/lib/pixel';
import { api, fmtData, fmtR$, Icone, toast } from './ui';

type Dados = {
  configurado: boolean;
  precos: { mensal: number | null; anual: number | null };
  conta: { nome: string; plano: string; ativo_ate: string | null; bloqueada: boolean };
  ativa: boolean; diasRestantes: number | null;
  assinatura: { id: string; ciclo: string } | null;
  pendente: { url: string; vencimento: string; valor: number } | null;
  pagamentos: { id: string; valor: number; status: string; vencimento: string; invoice_url: string | null; criado_em: string }[];
  suporteWhatsapp: string | null;
};

const STATUS: Record<string, [string, string]> = {
  RECEIVED: ['Pago', 'ok'], CONFIRMED: ['Pago', 'ok'], RECEIVED_IN_CASH: ['Pago', 'ok'],
  PENDING: ['Aguardando', 'warn'], OVERDUE: ['Vencido', 'bad'], REFUNDED: ['Estornado', ''],
};

export default function Assinatura() {
  const [d, setD] = useState<Dados | null>(null);
  const [doc, setDoc] = useState('');
  const [ocupado, setOcupado] = useState('');
  const carregar = () => api<Dados>('/api/assinatura').then(setD).catch((e) => toast(e.message, true));
  useEffect(() => {
    carregar();
    if (new URLSearchParams(window.location.search).get('pago')) toast('Pagamento recebido! A liberação é automática em instantes.');
  }, []);

  async function assinar(ciclo: 'mensal' | 'anual') {
    setOcupado(ciclo);
    rastrear('InitiateCheckout', { currency: 'BRL', value: (ciclo === 'anual' ? d?.precos.anual : d?.precos.mensal) || 0, content_name: `Plano ${ciclo}` });
    try {
      const r = await api<{ url: string }>('/api/assinatura', { method: 'POST', json: { ciclo, cpfCnpj: doc || undefined } });
      window.location.href = r.url;
    } catch (e) {
      toast((e as Error).message, true);
      setOcupado('');
    }
  }
  async function cancelar() {
    if (!confirm('Cancelar a renovação automática? Você continua com acesso até o fim do período já pago.')) return;
    try {
      await api('/api/assinatura/cancelar', { method: 'POST' });
      toast('Renovação cancelada.');
      carregar();
    } catch (e) { toast((e as Error).message, true); }
  }

  if (!d) return <div className="muted">Carregando…</div>;
  const vence = d.conta.ativo_ate ? fmtData(d.conta.ativo_ate) : null;
  const planos = ([['mensal', d.precos.mensal, 'por mês'], ['anual', d.precos.anual, 'por ano']] as const).filter((p) => p[1]);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Minha assinatura</h1>
          <div className="muted small">{d.conta.nome}</div>
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 14, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="secao-titulo" style={{ marginBottom: 4 }}>Situação</div>
          {d.conta.bloqueada ? <span className="badge bad">Bloqueada</span>
            : !d.ativa ? <span className="badge bad">Acesso vencido{vence ? ` em ${vence}` : ''}</span>
            : d.conta.plano === 'teste' ? <span className="badge warn">Teste grátis até {vence}</span>
            : vence ? <span className="badge ok">Ativa até {vence}</span> : <span className="badge ok">Ativa</span>}
          {d.assinatura && <div className="small muted" style={{ marginTop: 6 }}>Renovação automática: plano {d.assinatura.ciclo}</div>}
        </div>
        <div className="linha-acoes">
          {d.pendente && <a className="btn primario" href={d.pendente.url} target="_blank" rel="noreferrer">Pagar fatura de {fmtR$(d.pendente.valor)}</a>}
          {d.assinatura && <button className="btn perigo" onClick={cancelar}>Cancelar renovação</button>}
        </div>
      </div>

      {!d.configurado ? (
        <div className="card pad">
          <p style={{ marginTop: 0 }}>Para assinar, fale com a gente pelo WhatsApp.</p>
          {d.suporteWhatsapp && <a className="btn wa" href={linkWhatsapp(d.suporteWhatsapp, `Olá! Quero assinar o Prospecta. Conta: ${d.conta.nome}.`)} target="_blank" rel="noreferrer"><Icone n="wa" /> Assinar pelo WhatsApp</a>}
        </div>
      ) : !d.assinatura || !d.ativa ? (
        <div className="card pad">
          <div className="secao-titulo">Escolha seu plano</div>
          <label className="campo" style={{ maxWidth: 320, marginBottom: 16 }}>
            CPF ou CNPJ para a cobrança
            <input type="text" inputMode="numeric" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Somente números" />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {planos.map(([ciclo, valor, sufixo]) => (
              <div key={ciclo} style={{ border: '1px solid var(--line-2)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 16, textTransform: 'capitalize' }}>Plano {ciclo}</div>
                <div><span style={{ fontSize: 28, fontWeight: 800 }}>{fmtR$(valor)}</span> <span className="muted">{sufixo}</span></div>
                {ciclo === 'anual' && d.precos.mensal && valor && (
                  <div className="small" style={{ color: 'var(--ok)' }}>Economia de {fmtR$(d.precos.mensal * 12 - valor)} no ano</div>
                )}
                <button className="btn primario" disabled={!!ocupado} onClick={() => assinar(ciclo)}>
                  {ocupado === ciclo ? <span className="spin" /> : 'Assinar'}
                </button>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>Pague com PIX, boleto ou cartão. A liberação é automática quando o pagamento é confirmado. Sem fidelidade.</p>
        </div>
      ) : null}

      {d.pagamentos.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="barra"><b>Pagamentos</b></div>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Vencimento</th><th>Valor</th><th>Situação</th><th></th></tr></thead>
              <tbody>
                {d.pagamentos.map((p) => {
                  const [t, cls] = STATUS[p.status] || [p.status, ''];
                  return (
                    <tr key={p.id}>
                      <td>{fmtData(p.vencimento)}</td>
                      <td>{fmtR$(p.valor)}</td>
                      <td><span className={`badge ${cls}`}>{t}</span></td>
                      <td>{p.invoice_url && <a href={p.invoice_url} target="_blank" rel="noreferrer">Ver fatura</a>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

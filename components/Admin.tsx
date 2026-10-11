'use client';
import { useCallback, useEffect, useState } from 'react';
import { formatarTelefone, linkWhatsapp } from '@/lib/contato';
import { api, fmtData, fmtN, Icone, toast } from './ui';

type Conta = {
  id: number; nome: string; whatsapp: string | null; plano: string; ativo_ate: string | null; bloqueada: boolean;
  ufs: string | null; observacoes: string | null; criado_em: string; leads: number; google_mes: number | null;
  usuarios: { nome: string; email: string; papel: string; ultimo_acesso: string | null }[] | null;
};

const PLANOS: Record<string, string> = { teste: 'Teste', mensal: 'Mensal', anual: 'Anual', vitalicio: 'Vitalício' };

function situacao(c: Conta) {
  if (c.bloqueada) return { t: 'Bloqueada', cls: 'bad' };
  if (!c.ativo_ate) return { t: 'Sem vencimento', cls: 'ok' };
  const dias = Math.ceil((new Date(c.ativo_ate).getTime() - Date.now()) / 86400000);
  if (dias <= 0) return { t: `Vencida há ${-dias} dia(s)`, cls: 'bad' };
  if (dias <= 3) return { t: `Vence em ${dias} dia(s)`, cls: 'warn' };
  return { t: `Até ${fmtData(c.ativo_ate)}`, cls: 'ok' };
}

export default function Admin() {
  const [dados, setDados] = useState<{ contas: Conta[]; limiteGoogle: number } | null>(null);
  const [filtro, setFiltro] = useState('');
  const carregar = useCallback(() => api('/api/admin/contas').then(setDados).catch((e) => toast(e.message, true)), []);
  useEffect(() => { carregar(); }, [carregar]);

  async function acao(id: number, corpo: object, msg: string) {
    try {
      await api(`/api/admin/contas/${id}`, { method: 'PATCH', json: corpo });
      toast(msg);
      carregar();
    } catch (e) { toast((e as Error).message, true); }
  }

  const contas = (dados?.contas || []).filter((c) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return [c.nome, c.whatsapp, ...(c.usuarios || []).flatMap((u) => [u.nome, u.email])].some((x) => (x || '').toLowerCase().includes(q));
  });
  const ativas = (dados?.contas || []).filter((c) => situacao(c).cls !== 'bad' && c.plano !== 'teste').length;
  const testes = (dados?.contas || []).filter((c) => c.plano === 'teste' && situacao(c).cls !== 'bad').length;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Clientes</h1>
          <div className="muted small">Contas cadastradas, vencimentos e liberação de acesso.</div>
        </div>
        <div className="stats">
          <div className="stat"><div className="n">{fmtN(dados?.contas.length)}</div><div className="l">contas</div></div>
          <div className="stat"><div className="n">{fmtN(ativas)}</div><div className="l">pagantes ativas</div></div>
          <div className="stat"><div className="n">{fmtN(testes)}</div><div className="l">em teste</div></div>
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 14 }}>
        <input type="search" placeholder="Buscar por empresa, nome, e-mail ou WhatsApp" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: 420 }} />
      </div>

      <div className="card">
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr><th>Conta</th><th>Plano e situação</th><th>Uso</th><th>Estados</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {contas.map((c) => {
                const st = situacao(c);
                const dono = c.usuarios?.[0];
                return (
                  <tr key={c.id}>
                    <td style={{ minWidth: 220 }}>
                      <div className="nome-emp">{c.nome}</div>
                      {dono && <div className="small">{dono.nome} · {dono.email}</div>}
                      {c.whatsapp && <a className="small" href={linkWhatsapp(c.whatsapp)} target="_blank" rel="noreferrer" style={{ color: 'var(--wa)' }}><Icone n="wa" s={12} /> {formatarTelefone(c.whatsapp)}</a>}
                      <div className="small muted">Desde {fmtData(c.criado_em)}{dono?.ultimo_acesso ? ` · último acesso ${fmtData(dono.ultimo_acesso)}` : ''}</div>
                    </td>
                    <td style={{ minWidth: 190 }}>
                      <select value={c.plano} onChange={(e) => acao(c.id, { plano: e.target.value }, 'Plano alterado')} style={{ width: 'auto', marginBottom: 6 }} aria-label="Plano">
                        {Object.entries(PLANOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <div><span className={`badge ${st.cls}`}>{st.t}</span></div>
                    </td>
                    <td className="small" style={{ minWidth: 120 }}>
                      <div>{fmtN(c.leads)} leads</div>
                      <div className="muted">Google: {fmtN(c.google_mes ?? 0)} / {fmtN(dados?.limiteGoogle)}</div>
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <input type="text" defaultValue={c.ufs || ''} placeholder="Todos" aria-label="Estados liberados"
                        onBlur={(e) => { if ((e.target.value || '') !== (c.ufs || '')) acao(c.id, { ufs: e.target.value }, 'Estados atualizados'); }}
                        style={{ width: 110 }} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn peq" onClick={() => acao(c.id, { adicionarDias: 7 }, '+7 dias')}>+7 dias</button>
                        <button className="btn peq" onClick={() => acao(c.id, { adicionarDias: 30, plano: c.plano === 'teste' ? 'mensal' : c.plano }, '+30 dias')}>+30 dias</button>
                        <button className="btn peq" onClick={() => acao(c.id, { adicionarDias: 365, plano: 'anual' }, '+1 ano')}>+1 ano</button>
                        {c.bloqueada
                          ? <button className="btn peq" onClick={() => acao(c.id, { bloqueada: false }, 'Conta desbloqueada')}>Desbloquear</button>
                          : c.id !== 1 && <button className="btn peq perigo" onClick={() => confirm(`Bloquear ${c.nome}?`) && acao(c.id, { bloqueada: true }, 'Conta bloqueada')}>Bloquear</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {dados && contas.length === 0 && <div className="vazio">Nenhuma conta encontrada.</div>}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        “Estados”: deixe vazio para liberar todos, ou escreva as siglas separadas por vírgula (ex.: SC,PR) para planos por estado.
      </p>
    </>
  );
}

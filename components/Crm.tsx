'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { aplicarModelo, cnaeFormatado, cnpjFormatado, ETAPAS, formatarTelefone, linkWhatsapp, PORTES } from '@/lib/contato';
import { api, fmtData, fmtN, fmtR$, Icone, toast } from './ui';

type Lead = {
  id: number; cnpj: string | null; nome: string; cidade: string | null; telefone: string | null; whatsapp: string | null;
  email: string | null; site: string | null; segmento: string | null; porte: string | null; origem: string; etapa: string;
  valor: string | null; responsavel: string | null; proximo_contato: string | null; nao_contatar: boolean; atualizado_em: string;
};

const CORES: Record<string, string> = {
  novo: '#8a91a0', contatado: '#2563a8', qualificado: '#7c4dca', proposta: '#e8a019', negociacao: '#d9772b', ganho: '#1d8a5b', perdido: '#c2382f',
};
const MODELO_PADRAO =
  'Olá! Tudo bem? Falo com a {nome}? Sou da nossa equipe comercial e atendemos empresas em {cidade}. Posso te enviar uma apresentação rápida?';

function lerModelo() {
  try { return localStorage.getItem('prospecta_modelo') || MODELO_PADRAO; } catch { return MODELO_PADRAO; }
}
function salvarModelo(v: string) {
  try { localStorage.setItem('prospecta_modelo', v); } catch { /* sem storage */ }
}
const hoje = () => new Date().toISOString().slice(0, 10);

export default function Crm() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [cidade, setCidade] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [modelo, setModelo] = useState(MODELO_PADRAO);
  const [editandoModelo, setEditandoModelo] = useState(false);

  useEffect(() => setModelo(lerModelo()), []);

  const carregar = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (q) p.set('q', q);
      if (cidade) p.set('cidade', cidade);
      const r = await api(`/api/leads?${p}`);
      setLeads(r.leads);
      setCidades(r.cidades);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setCarregando(false);
    }
  }, [q, cidade]);

  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  const porEtapa = useMemo(() => {
    const m: Record<string, Lead[]> = Object.fromEntries(ETAPAS.map((e) => [e.id, []]));
    for (const l of leads) (m[l.etapa] ||= []).push(l);
    return m;
  }, [leads]);

  async function mover(id: number, etapa: string) {
    const antes = leads.find((l) => l.id === id);
    if (!antes || antes.etapa === etapa) return;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, etapa } : l)));
    try {
      await api(`/api/leads/${id}`, { method: 'PATCH', json: { etapa } });
    } catch (e) {
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, etapa: antes.etapa } : l)));
      toast((e as Error).message, true);
    }
  }

  const ganhoTotal = (porEtapa.ganho || []).reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const pipeline = leads.filter((l) => !['ganho', 'perdido'].includes(l.etapa)).reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const atrasados = leads.filter((l) => l.proximo_contato && l.proximo_contato.slice(0, 10) <= hoje() && !['ganho', 'perdido'].includes(l.etapa)).length;

  return (
    <>
      <div className="topo">
        <div>
          <h1>CRM de leads</h1>
          <div className="muted small">Arraste os cartões entre as etapas. Clique para ver detalhes e registrar contatos.</div>
        </div>
        <div className="stats">
          <div className="stat"><div className="n">{fmtN(leads.length)}</div><div className="l">leads</div></div>
          <div className="stat"><div className="n">{fmtR$(pipeline) || 'R$ 0'}</div><div className="l">em aberto</div></div>
          <div className="stat"><div className="n">{fmtR$(ganhoTotal) || 'R$ 0'}</div><div className="l">ganho</div></div>
          <div className="stat"><div className="n" style={{ color: atrasados ? 'var(--bad)' : undefined }}>{atrasados}</div><div className="l">contatos p/ hoje</div></div>
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="search" placeholder="Buscar por nome, e-mail ou CNPJ" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <select value={cidade} onChange={(e) => setCidade(e.target.value)} style={{ maxWidth: 220 }} aria-label="Cidade">
          <option value="">Todas as cidades</option>
          {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setEditandoModelo((v) => !v)}><Icone n="wa" /> Mensagem padrão</button>
          <a className="btn" href="/api/leads/export"><Icone n="baixar" /> Exportar CSV</a>
        </div>
        {editandoModelo && (
          <div style={{ width: '100%' }}>
            <label className="campo">
              Mensagem inicial do WhatsApp — use {'{nome}'} e {'{cidade}'}
              <textarea rows={3} value={modelo} onChange={(e) => { setModelo(e.target.value); salvarModelo(e.target.value); }} />
            </label>
          </div>
        )}
      </div>

      {!carregando && leads.length === 0 ? (
        <div className="card vazio">
          Nenhum lead ainda. Vá em <a href="/">Prospectar</a> ou <a href="/google">Google Maps</a> e adicione empresas ao CRM.
        </div>
      ) : (
        <div className="kanban">
          {ETAPAS.map((et) => {
            const lista = porEtapa[et.id] || [];
            const soma = lista.reduce((s, l) => s + (Number(l.valor) || 0), 0);
            return (
              <section key={et.id} className={`coluna ${alvo === et.id ? 'alvo' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setAlvo(et.id); }}
                onDragLeave={() => setAlvo((a) => (a === et.id ? null : a))}
                onDrop={(e) => { e.preventDefault(); setAlvo(null); const id = Number(e.dataTransfer.getData('text/plain')); if (id) mover(id, et.id); }}>
                <div className="coluna-topo">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="ponto" style={{ background: CORES[et.id] }} /> {et.nome}
                    <span className="badge">{lista.length}</span>
                  </span>
                  {soma > 0 && <span className="soma">{fmtR$(soma)}</span>}
                </div>
                <div className="coluna-lista">
                  {lista.slice(0, 300).map((l) => {
                    const atrasado = l.proximo_contato && l.proximo_contato.slice(0, 10) <= hoje();
                    return (
                      <article key={l.id} className={`cartao ${l.nao_contatar ? 'bloqueado' : ''}`} draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', String(l.id))}
                        onClick={() => setAberto(l.id)}>
                        <div className="t">{l.nome}</div>
                        <div className="s">{[l.cidade, l.segmento].filter(Boolean).join(' · ')}</div>
                        <div className="r">
                          {l.whatsapp && <span className="badge ok" title="WhatsApp"><Icone n="wa" s={11} /></span>}
                          {l.email && <span className="badge info" title={l.email}><Icone n="email" s={11} /></span>}
                          {l.telefone && !l.whatsapp && <span className="badge" title={formatarTelefone(l.telefone)}><Icone n="tel" s={11} /></span>}
                          {l.valor && <span className="badge acento">{fmtR$(l.valor)}</span>}
                          {l.proximo_contato && <span className={`badge ${atrasado ? 'bad' : ''}`}><Icone n="calendario" s={11} /> {fmtData(l.proximo_contato)}</span>}
                          {l.nao_contatar && <span className="badge bad">não contatar</span>}
                        </div>
                      </article>
                    );
                  })}
                  {lista.length > 300 && <div className="small muted" style={{ textAlign: 'center' }}>+{lista.length - 300} — use a busca</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {aberto !== null && (
        <LeadPainel id={aberto} modelo={modelo} onFechar={() => setAberto(null)}
          onMudou={(l) => setLeads((ls) => (l ? ls.map((x) => (x.id === l.id ? { ...x, ...l } : x)) : ls.filter((x) => x.id !== aberto)))} />
      )}
    </>
  );
}

/* ---------------------------------------------------------------- painel do lead */
function LeadPainel({ id, modelo, onFechar, onMudou }: { id: number; modelo: string; onFechar: () => void; onMudou: (l: Partial<Lead> | null) => void }) {
  const [dados, setDados] = useState<{ lead: any; atividades: any[] } | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [nota, setNota] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await api(`/api/leads/${id}`);
      setDados(r);
      setForm({
        nome: r.lead.nome || '', etapa: r.lead.etapa, valor: r.lead.valor ?? '', responsavel: r.lead.responsavel || '',
        proximo_contato: r.lead.proximo_contato ? String(r.lead.proximo_contato).slice(0, 10) : '',
        observacoes: r.lead.observacoes || '', telefone: r.lead.telefone || '', whatsapp: r.lead.whatsapp || '',
        email: r.lead.email || '', site: r.lead.site || '', nao_contatar: r.lead.nao_contatar,
      });
    } catch (e) {
      toast((e as Error).message, true);
      onFechar();
    }
  }, [id, onFechar]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    setSalvando(true);
    try {
      const r = await api(`/api/leads/${id}`, { method: 'PATCH', json: form });
      onMudou(r.lead);
      toast('Lead salvo');
      carregar();
    } catch (e) { toast((e as Error).message, true); } finally { setSalvando(false); }
  }

  async function registrar(tipo: string, descricao?: string) {
    try {
      const r = await api(`/api/leads/${id}/atividades`, { method: 'POST', json: { tipo, descricao } });
      if (r.lead) onMudou({ id, etapa: r.lead.etapa });
      carregar();
    } catch (e) { toast((e as Error).message, true); }
  }

  async function excluir() {
    if (!confirm('Excluir este lead do CRM? O histórico de atividades também será apagado.')) return;
    try {
      await api(`/api/leads/${id}`, { method: 'DELETE' });
      onMudou(null);
      onFechar();
      toast('Lead excluído');
    } catch (e) { toast((e as Error).message, true); }
  }

  const l = dados?.lead;
  const msg = l ? aplicarModelo(modelo, l) : '';
  const bloqueado = !!form.nao_contatar;

  return (
    <>
      <div className="veu" onClick={onFechar} />
      <aside className="painel" role="dialog" aria-label="Detalhes do lead">
        <div className="painel-topo">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 17 }}>{l?.nome || 'Carregando…'}</h2>
            {l && (
              <div className="small muted">
                {[l.razao_social !== l.nome ? l.razao_social : null, l.cnpj ? cnpjFormatado(l.cnpj) : null].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <button className="btn icone" onClick={onFechar} aria-label="Fechar"><Icone n="x" /></button>
        </div>

        {l && (
          <div className="painel-corpo">
            <div>
              <div className="secao-titulo">Contato rápido</div>
              {bloqueado && <div className="aviso" style={{ marginBottom: 8 }}>Marcado como “não contatar”.</div>}
              <div className="linha-acoes">
                {form.whatsapp && (
                  <a className="btn wa" href={linkWhatsapp(form.whatsapp, msg)} target="_blank" rel="noreferrer"
                    onClick={(e) => { if (bloqueado) { e.preventDefault(); return; } registrar('whatsapp', msg); }}>
                    <Icone n="wa" /> WhatsApp
                  </a>
                )}
                {form.email && (
                  <a className="btn" href={`mailto:${form.email}?subject=${encodeURIComponent('Apresentação')}&body=${encodeURIComponent(msg)}`}
                    onClick={(e) => { if (bloqueado) { e.preventDefault(); return; } registrar('email', `E-mail para ${form.email}`); }}>
                    <Icone n="email" /> E-mail
                  </a>
                )}
                {form.telefone && (
                  <a className="btn" href={`tel:+55${form.telefone}`} onClick={() => registrar('ligacao', `Ligação para ${formatarTelefone(form.telefone)}`)}>
                    <Icone n="tel" /> {formatarTelefone(form.telefone)}
                  </a>
                )}
                {l.google_maps_url && <a className="btn" href={l.google_maps_url} target="_blank" rel="noreferrer"><Icone n="mapa" /> Maps</a>}
              </div>
            </div>

            <div>
              <div className="secao-titulo">Negócio</div>
              <div className="grade2">
                <label className="campo">Etapa
                  <select value={form.etapa} onChange={(e) => set('etapa', e.target.value)}>
                    {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </label>
                <label className="campo">Valor estimado (R$)
                  <input type="number" min={0} step={1000} value={form.valor} onChange={(e) => set('valor', e.target.value)} />
                </label>
                <label className="campo">Próximo contato
                  <input type="date" value={form.proximo_contato} onChange={(e) => set('proximo_contato', e.target.value)} />
                </label>
                <label className="campo">Responsável
                  <input type="text" value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} />
                </label>
              </div>
              <label className="campo" style={{ marginTop: 10 }}>Observações
                <textarea rows={3} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
              </label>
            </div>

            <div>
              <div className="secao-titulo">Dados de contato</div>
              <div className="grade2">
                <label className="campo">Telefone <input type="text" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} /></label>
                <label className="campo">WhatsApp <input type="text" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="55 + DDD + número" /></label>
                <label className="campo">E-mail <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
                <label className="campo">Site <input type="text" value={form.site} onChange={(e) => set('site', e.target.value)} /></label>
              </div>
              <div className="small muted" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {l.endereco && <span>{l.endereco}{l.cidade ? ` — ${l.cidade}/SC` : ''}</span>}
                {l.segmento && <span>{l.cnae_principal ? `${cnaeFormatado(l.cnae_principal)} · ` : ''}{l.segmento}</span>}
                {(l.porte || l.capital_social) && <span>{PORTES[l.porte] || ''}{l.capital_social ? ` · capital ${fmtR$(l.capital_social)}` : ''}{l.data_inicio ? ` · desde ${fmtData(l.data_inicio)}` : ''}</span>}
                {l.email_receita && l.email_receita !== form.email && <span>E-mail na Receita: {l.email_receita}</span>}
                {l.site_emails && <span>E-mails do site: {String(l.site_emails).replace(/,/g, ', ')}</span>}
              </div>
              <label className="check" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={!!form.nao_contatar} onChange={(e) => set('nao_contatar', e.target.checked)} />
                Não contatar (pediu para sair / LGPD)
              </label>
            </div>

            <div className="linha-acoes">
              <button className="btn primario" onClick={salvar} disabled={salvando}>{salvando ? <span className="spin" /> : <Icone n="check" />} Salvar</button>
              <button className="btn perigo" onClick={excluir}><Icone n="lixo" /> Excluir</button>
            </div>

            <div>
              <div className="secao-titulo">Histórico</div>
              <form style={{ display: 'flex', gap: 8, marginBottom: 12 }} onSubmit={(e) => { e.preventDefault(); if (nota.trim()) { registrar('nota', nota.trim()); setNota(''); } }}>
                <input type="text" placeholder="Anotar algo (ex.: falei com o gerente, pediu proposta)" value={nota} onChange={(e) => setNota(e.target.value)} />
                <button className="btn">Anotar</button>
              </form>
              <div className="timeline">
                {dados.atividades.length === 0 && <span className="small muted">Sem atividades ainda.</span>}
                {dados.atividades.map((a) => (
                  <div className="item" key={a.id}>
                    <span className="ic"><Icone n={{ whatsapp: 'wa', email: 'email', ligacao: 'tel', etapa: 'seta', visita: 'pessoa' }[a.tipo as string] || 'nota'} s={12} /></span>
                    <div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{a.tipo === 'etapa' ? `Etapa: ${a.descricao}` : a.descricao || a.tipo}</div>
                      <div className="small muted">{new Date(a.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="small muted">Origem: {l.origem === 'google' ? 'Google Maps' : 'Base CNPJ'} · criado em {fmtData(l.criado_em)}</div>
          </div>
        )}
      </aside>
    </>
  );
}

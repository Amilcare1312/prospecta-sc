'use client';
import { useEffect, useState } from 'react';
import { cnpjFormatado, formatarTelefone, whatsappDe } from '@/lib/contato';
import { api, fmtN, Icone, toast } from './ui';

type Lugar = {
  place_id: string; nome: string; endereco: string | null; telefone: string | null; site: string | null;
  maps_url: string | null; rating: number | null; avaliacoes: number | null; tipo: string | null; status: string | null;
  cidade: string; cnpj: string | null; razao_social: string | null; email_receita: string | null; em_crm: boolean;
};

const SUGESTOES = ['indústria', 'metalúrgica', 'supermercado', 'hotel', 'frigorífico', 'condomínio', 'hospital', 'posto de combustível', 'cerâmica', 'indústria têxtil'];

const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das)\b/g, (m) => m.toLowerCase());

export default function GoogleBusca() {
  const [cidades, setCidades] = useState<string[]>([]);
  const [configurado, setConfigurado] = useState(true);
  const [termo, setTermo] = useState('');
  const [cidade, setCidade] = useState('');
  const [ufPadrao, setUfPadrao] = useState('SC');
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [buscaAtual, setBuscaAtual] = useState<{ termo: string; cidade: string; uf: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [buscarEmails, setBuscarEmails] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api('/api/meta').then((m) => {
      const multi = (m.ufs?.length || 0) > 1;
      setUfPadrao(m.ufs?.[0]?.uf || 'SC');
      setCidades(m.municipios.map((x: { nome: string; uf: string }) => titulo(x.nome) + (multi ? ` - ${x.uf}` : '')));
      setConfigurado(m.googleConfigurado);
    }).catch(() => {});
  }, []);

  async function buscar(e?: React.FormEvent, mais = false) {
    e?.preventDefault();
    const mUf = cidade.trim().match(/^(.*?)\s*-\s*([A-Za-z]{2})$/);
    const b = mais && buscaAtual ? buscaAtual : { termo, cidade: mUf ? mUf[1] : cidade, uf: mUf ? mUf[2].toUpperCase() : ufPadrao };
    if (!b.termo.trim() || !b.cidade.trim()) return toast('Informe o que procurar e a cidade', true);
    setCarregando(true);
    try {
      const r = await api('/api/google/buscar', { method: 'POST', json: { ...b, pageToken: mais ? token : undefined } });
      setLugares((l) => (mais ? [...l, ...r.lugares] : r.lugares));
      setToken(r.nextPageToken);
      setBuscaAtual(b);
      if (!mais) setSel(new Set());
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setCarregando(false);
    }
  }

  function alternar(id: string) {
    const s = new Set(sel);
    s.has(id) ? s.delete(id) : s.add(id);
    setSel(s);
  }

  async function adicionar() {
    const escolhidos = lugares.filter((l) => sel.has(l.place_id) && !l.em_crm);
    if (!escolhidos.length) return;
    setSalvando(true);
    try {
      const r = await api('/api/leads', { method: 'POST', json: { lugares: escolhidos, buscarEmails } });
      toast(`${r.inseridos} lead(s) adicionados ao CRM`);
      setLugares((ls) => ls.map((l) => (sel.has(l.place_id) ? { ...l, em_crm: true } : l)));
      setSel(new Set());
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setSalvando(false);
    }
  }

  const selecionaveis = lugares.filter((l) => !l.em_crm);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Buscar no Google Maps</h1>
          <div className="muted small">Encontre empresas por segmento e cidade. Telefones são cruzados com a base CNPJ.</div>
        </div>
      </div>

      {!configurado && (
        <div className="aviso" style={{ marginBottom: 14 }}>
          Configure a variável <span className="mono">GOOGLE_PLACES_API_KEY</span> (Places API New) para usar esta tela.
        </div>
      )}

      <form className="card pad" onSubmit={buscar} style={{ marginBottom: 14 }}>
        <div className="filtros" style={{ alignItems: 'end' }}>
          <label className="campo col2">
            O que procurar
            <input type="search" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex.: indústria metalúrgica, supermercado, hotel…" list="sugestoes-termo" />
            <datalist id="sugestoes-termo">{SUGESTOES.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="campo">
            Cidade
            <input type="search" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Blumenau" list="cidades-sc" />
            <datalist id="cidades-sc">{cidades.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <button className="btn primario" disabled={carregando || !configurado}>
            {carregando && !lugares.length ? <span className="spin" /> : <Icone n="busca" />} Buscar
          </button>
        </div>
      </form>

      <div className="card">
        <div className="barra">
          <div>
            {lugares.length ? <><b>{fmtN(lugares.length)}</b> <span className="muted">resultados{buscaAtual ? ` para "${buscaAtual.termo}" em ${buscaAtual.cidade}` : ''}</span></> : <span className="muted">Faça uma busca</span>}
            {sel.size > 0 && <span className="badge acento" style={{ marginLeft: 10 }}>{sel.size} selecionado(s)</span>}
          </div>
          <div className="acoes" style={{ alignItems: 'center' }}>
            {selecionaveis.length > 0 && (
              <button className="btn peq" onClick={() => setSel(sel.size === selecionaveis.length ? new Set() : new Set(selecionaveis.map((l) => l.place_id)))}>
                {sel.size === selecionaveis.length ? 'Desmarcar todos' : 'Marcar todos'}
              </button>
            )}
            <label className="check" title="Abre o site de cada empresa para achar e-mail e WhatsApp (mais lento)">
              <input type="checkbox" checked={buscarEmails} onChange={(e) => setBuscarEmails(e.target.checked)} /> Buscar e-mail no site
            </label>
            <button className="btn acento" disabled={!sel.size || salvando} onClick={adicionar}>
              {salvando ? <span className="spin" /> : <Icone n="mais" />} Adicionar ao CRM
            </button>
          </div>
        </div>

        {lugares.length === 0 ? (
          <div className="vazio">Os resultados aparecem aqui. O Google retorna até 60 empresas por busca — refine o termo para cobrir mais.</div>
        ) : (
          <div className="lugares">
            {lugares.map((l) => {
              const w = whatsappDe(l.telefone);
              return (
                <div key={l.place_id} className={`lugar ${sel.has(l.place_id) ? 'sel' : ''}`} onClick={() => !l.em_crm && alternar(l.place_id)}
                  role="checkbox" aria-checked={sel.has(l.place_id)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === ' ' && !l.em_crm) { e.preventDefault(); alternar(l.place_id); } }}>
                  <div className="cab">
                    <div>
                      <div className="nome-emp">{l.nome}</div>
                      <div className="small muted">{l.tipo || ''}</div>
                    </div>
                    {l.em_crm ? <span className="badge ok"><Icone n="check" s={11} /> No CRM</span>
                      : <input type="checkbox" checked={sel.has(l.place_id)} readOnly tabIndex={-1} style={{ accentColor: 'var(--brand)', width: 16, height: 16 }} />}
                  </div>
                  <div className="small">{l.endereco}</div>
                  <div className="contatos small" onClick={(e) => e.stopPropagation()}>
                    {l.telefone && <a href={`tel:+55${l.telefone}`}><Icone n="tel" s={13} /> {formatarTelefone(l.telefone)}</a>}
                    {w && <a href={`https://wa.me/${w}`} target="_blank" rel="noreferrer" style={{ color: 'var(--wa)' }}><Icone n="wa" s={13} /> WhatsApp</a>}
                    {l.site && <a href={l.site} target="_blank" rel="noreferrer"><Icone n="site" s={13} /> {l.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 36)}</a>}
                    {l.email_receita && <span><Icone n="email" s={13} /> {l.email_receita}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }} onClick={(e) => e.stopPropagation()}>
                    {l.rating !== null && l.maps_url && <a className="badge info" href={l.maps_url} target="_blank" rel="noreferrer"><Icone n="estrela" s={11} /> {l.rating} ({l.avaliacoes})</a>}
                    {l.cnpj ? <span className="badge ok" title={l.razao_social || ''}>CNPJ {cnpjFormatado(l.cnpj)}</span>
                      : <span className="badge">CNPJ não identificado</span>}
                    {l.status && l.status !== 'OPERATIONAL' && <span className="badge bad">Fechado</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {token && (
          <div className="paginacao" style={{ justifyContent: 'center' }}>
            <button className="btn" disabled={carregando} onClick={() => buscar(undefined, true)}>
              {carregando ? <span className="spin" /> : null} Carregar mais resultados
            </button>
          </div>
        )}
      </div>
    </>
  );
}

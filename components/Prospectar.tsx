'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cnaeFormatado, cnpjFormatado, emailDeContador, formatarTelefone, linkWhatsapp, PORTES } from '@/lib/contato';
import { api, fmtData, fmtN, Icone, toast } from './ui';
import SeletorCidades from './SeletorCidades';

type Municipio = { codigo: string; nome: string; total?: number };
type Cnae = { codigo: string; descricao: string };
type Empresa = Record<string, any>;

const PRESETS: { nome: string; cnaes: Cnae[] }[] = [
  {
    nome: 'Indústria de transformação',
    cnaes: Array.from({ length: 24 }, (_, i) => ({ codigo: String(10 + i), descricao: `Divisão ${10 + i}` })),
  },
  { nome: 'Supermercados', cnaes: [{ codigo: '4711', descricao: 'Hipermercados e supermercados' }] },
  { nome: 'Hotéis', cnaes: [{ codigo: '5510', descricao: 'Hotéis e similares' }] },
  { nome: 'Hospitais e clínicas', cnaes: [{ codigo: '8610', descricao: 'Atendimento hospitalar' }, { codigo: '8630', descricao: 'Atividades ambulatoriais' }] },
  { nome: 'Condomínios', cnaes: [{ codigo: '8112', descricao: 'Condomínios prediais' }] },
  { nome: 'Frigoríficos', cnaes: [{ codigo: '1011', descricao: 'Abate de reses' }, { codigo: '1012', descricao: 'Abate de suínos e aves' }] },
  { nome: 'Postos de combustível', cnaes: [{ codigo: '4731', descricao: 'Comércio varejista de combustíveis' }] },
];

const vazio = {
  municipios: [] as Municipio[],
  cnaes: [] as Cnae[],
  secundario: false,
  portes: [] as string[],
  matriz: false,
  telefone: false,
  whatsapp: false,
  email: false,
  semContador: false,
  site: false,
  q: '',
  desde: '',
  capitalMin: '',
  foraCrm: true,
  enriquecido: '' as '' | 'sim' | 'nao',
};
type Filtro = typeof vazio;

function paraParams(f: Filtro) {
  const p = new URLSearchParams();
  if (f.municipios.length) p.set('municipios', f.municipios.map((m) => m.codigo).join(','));
  if (f.cnaes.length) p.set('cnaes', f.cnaes.map((c) => c.codigo).join(','));
  if (f.portes.length) p.set('portes', f.portes.join(','));
  for (const k of ['secundario', 'matriz', 'telefone', 'whatsapp', 'email', 'semContador', 'site', 'foraCrm'] as const)
    if (f[k]) p.set(k, '1');
  if (f.q) p.set('q', f.q);
  if (f.desde) p.set('desde', f.desde);
  if (f.capitalMin) p.set('capitalMin', f.capitalMin);
  if (f.enriquecido) p.set('enriquecido', f.enriquecido);
  return p;
}

function paraObjeto(f: Filtro) {
  return Object.fromEntries(paraParams(f).entries());
}

/* ---------- seletor com sugestões ---------- */
function Seletor<T>({
  placeholder, buscar, rotulo, onEscolher, extra,
}: {
  placeholder: string;
  buscar: (q: string) => Promise<T[]> | T[];
  rotulo: (x: T) => React.ReactNode;
  onEscolher: (x: T) => void;
  extra?: (q: string) => T | null;
}) {
  const [q, setQ] = useState('');
  const [itens, setItens] = useState<T[]>([]);
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(0);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const r = q.trim() ? await buscar(q.trim()) : [];
      const e = extra?.(q.trim());
      if (vivo) { setItens(e ? [e, ...r] : r); setFoco(0); }
    }, 180);
    return () => { vivo = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const escolher = (x: T) => { onEscolher(x); setQ(''); setItens([]); };
  return (
    <div className="rel">
      <input type="search" value={q} placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((f) => Math.min(f + 1, itens.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => Math.max(f - 1, 0)); }
          if (e.key === 'Enter' && itens[foco]) { e.preventDefault(); escolher(itens[foco]); }
        }} />
      {aberto && itens.length > 0 && (
        <div className="card sugestoes">
          {itens.map((x, i) => (
            <button type="button" key={i} className={i === foco ? 'foco' : ''} onMouseDown={(e) => { e.preventDefault(); escolher(x); }}>
              {rotulo(x)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Prospectar() {
  const [meta, setMeta] = useState<{ municipios: Municipio[]; empresas: number; leads: number; ref_base: string | null; googleConfigurado: boolean; etl: { status: string; mensagem: string | null; quando: string } | null } | null>(null);
  const [f, setF] = useState<Filtro>(vazio);
  const [dados, setDados] = useState<{ linhas: Empresa[]; total: number; pagina: number; porPagina: number } | null>(null);
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState('nome');
  const [carregando, setCarregando] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState('');
  const filtroAplicado = useRef<Filtro>(vazio);

  useEffect(() => {
    api('/api/meta').then(setMeta).catch((e) => toast(e.message, true));
  }, []);

  const set = <K extends keyof Filtro>(k: K, v: Filtro[K]) => setF((o) => ({ ...o, [k]: v }));

  const carregar = useCallback(async (filtro: Filtro, pg: number, ord: string) => {
    setCarregando(true);
    try {
      const p = paraParams(filtro);
      p.set('pagina', String(pg));
      p.set('ordem', ord);
      const r = await api(`/api/empresas?${p}`);
      setDados(r);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setCarregando(false);
    }
  }, []);

  function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    filtroAplicado.current = f;
    setPagina(1);
    setSel(new Set());
    carregar(f, 1, ordem);
  }

  useEffect(() => { carregar(vazio, 1, 'nome'); }, [carregar]);

  const irPara = (pg: number) => { setPagina(pg); carregar(filtroAplicado.current, pg, ordem); };

  const todosSel = !!dados?.linhas.length && dados.linhas.every((l) => sel.has(l.cnpj));
  function alternarTodos() {
    const s = new Set(sel);
    if (todosSel) dados?.linhas.forEach((l) => s.delete(l.cnpj));
    else dados?.linhas.forEach((l) => s.add(l.cnpj));
    setSel(s);
  }
  function alternar(c: string) {
    const s = new Set(sel);
    s.has(c) ? s.delete(c) : s.add(c);
    setSel(s);
  }

  async function adicionarSelecionados() {
    setOcupado('crm');
    try {
      const r = await api('/api/leads', { method: 'POST', json: { cnpjs: [...sel] } });
      toast(`${r.inseridos} lead(s) adicionados ao CRM`);
      setSel(new Set());
      carregar(filtroAplicado.current, pagina, ordem);
    } catch (e) { toast((e as Error).message, true); } finally { setOcupado(''); }
  }

  async function adicionarFiltro() {
    const total = dados?.total || 0;
    const sugestao = Math.min(total, 200);
    const resp = window.prompt(`Adicionar ao CRM as empresas do filtro atual (${fmtN(total)} encontradas). Quantas? (máx. 2000)`, String(sugestao));
    const limite = Number(resp);
    if (!resp || !limite) return;
    setOcupado('crm');
    try {
      const r = await api('/api/leads', { method: 'POST', json: { filtro: paraObjeto(filtroAplicado.current), limite } });
      toast(`${r.inseridos} lead(s) adicionados ao CRM`);
      carregar(filtroAplicado.current, pagina, ordem);
    } catch (e) { toast((e as Error).message, true); } finally { setOcupado(''); }
  }

  async function enriquecer() {
    const lista = [...sel];
    setOcupado('enriquecer');
    let ok = 0, nao = 0;
    try {
      for (let i = 0; i < lista.length; i += 20) {
        setOcupado(`enriquecer:${Math.min(i + 20, lista.length)}/${lista.length}`);
        const r = await api('/api/enriquecer', { method: 'POST', json: { cnpjs: lista.slice(i, i + 20) } });
        for (const x of r.resultados) x.status === 'ok' ? ok++ : nao++;
      }
      toast(`Enriquecimento: ${ok} encontradas no Google, ${nao} sem correspondência`);
      carregar(filtroAplicado.current, pagina, ordem);
    } catch (e) { toast((e as Error).message, true); } finally { setOcupado(''); }
  }

  const exportarHref = useMemo(() => `/api/empresas/export?${paraParams(filtroAplicado.current)}`, [dados]);
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Prospectar empresas</h1>
          <div className="muted small">Base CNPJ da Receita Federal — Santa Catarina{meta?.ref_base ? ` · referência ${meta.ref_base}` : ''}</div>
        </div>
        {meta && (
          <div className="stats">
            <div className="stat"><div className="n">{fmtN(meta.empresas)}</div><div className="l">empresas na base</div></div>
            <div className="stat"><div className="n">{fmtN(meta.leads)}</div><div className="l">leads no CRM</div></div>
          </div>
        )}
      </div>

      {meta && meta.etl?.status === 'iniciado' && (
        <div className="aviso" style={{ marginBottom: 14 }}>
          Carga da base da Receita em andamento desde {new Date(meta.etl.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Pode levar de 40 a 90 minutos — recarregue a página depois.
        </div>
      )}
      {meta && meta.etl?.status === 'erro' && (
        <div className="aviso" style={{ marginBottom: 14, background: 'var(--bad-soft)', color: 'var(--bad)' }}>
          A última carga da base falhou ({new Date(meta.etl.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}): <span className="mono">{meta.etl.mensagem}</span>
        </div>
      )}
      {meta && meta.empresas === 0 && !meta.etl && (
        <div className="aviso" style={{ marginBottom: 14 }}>
          A base está vazia. Rode a carga da Receita Federal (GitHub → Actions → "Atualizar base CNPJ (SC)" → Run workflow).
        </div>
      )}

      <form className="card pad" onSubmit={buscar} style={{ marginBottom: 14 }}>
        <div className="filtros">
          <div className="campo">
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Cidades</span>
            <SeletorCidades cidades={meta?.municipios || []} selecionadas={f.municipios} onChange={(m) => set('municipios', m)} />
          </div>
          <label className="campo col2">
            Atividade (CNAE)
            <Seletor<Cnae>
              placeholder="Ex.: metalúrgica, supermercado, 2512…"
              buscar={(q) => api<Cnae[]>(`/api/cnaes?q=${encodeURIComponent(q)}`).catch(() => [])}
              extra={(q) => (/^\d{2,7}$/.test(q.replace(/\D/g, '')) && q.replace(/[\d\s.\-/]/g, '') === ''
                ? { codigo: q.replace(/\D/g, ''), descricao: `Todos os CNAEs que começam com ${q.replace(/\D/g, '')}` }
                : q.length >= 3 ? { codigo: '*' + q, descricao: `Todas as atividades com “${q}”` } : null)}
              rotulo={(c) => c.codigo.startsWith('*') ? <b>{c.descricao}</b> : <><span className="mono">{c.codigo.length === 7 ? cnaeFormatado(c.codigo) : c.codigo}</span> · {c.descricao}</>}
              onEscolher={async (c) => {
                if (c.codigo.startsWith('*')) {
                  const todos = await api<Cnae[]>(`/api/cnaes?todos=1&q=${encodeURIComponent(c.codigo.slice(1))}`).catch(() => []);
                  const novos = todos.filter((t) => !f.cnaes.some((x) => x.codigo === t.codigo));
                  if (!novos.length) return toast('Nenhuma atividade encontrada com esse termo', true);
                  setF((o) => ({ ...o, cnaes: [...o.cnaes, ...novos] }));
                  toast(`${novos.length} atividade(s) adicionada(s)`);
                  return;
                }
                if (!f.cnaes.some((x) => x.codigo === c.codigo)) set('cnaes', [...f.cnaes, c]);
              }}
            />
          </label>
          <label className="campo">
            Nome ou CNPJ
            <input type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Opcional" />
          </label>
        </div>

        {(f.municipios.length > 0 || f.cnaes.length > 0) && (
          <div className="chips" style={{ marginTop: 10 }}>
            {f.municipios.map((m) => (
              <span className="chip" key={m.codigo}>{m.nome}
                <button type="button" aria-label="remover" onClick={() => set('municipios', f.municipios.filter((x) => x.codigo !== m.codigo))}><Icone n="x" s={12} /></button>
              </span>
            ))}
            {f.cnaes.length > 6 ? (
              <span className="chip">{f.cnaes.length} atividades
                <button type="button" aria-label="remover" onClick={() => set('cnaes', [])}><Icone n="x" s={12} /></button>
              </span>
            ) : f.cnaes.map((c) => (
              <span className="chip" key={c.codigo} title={c.descricao} style={{ background: 'var(--accent-soft)', color: 'var(--warn)' }}>
                {c.codigo.length === 7 ? cnaeFormatado(c.codigo) : c.codigo} · {c.descricao.slice(0, 40)}
                <button type="button" aria-label="remover" onClick={() => set('cnaes', f.cnaes.filter((x) => x.codigo !== c.codigo))}><Icone n="x" s={12} /></button>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <span className="small muted">Atalhos:</span>
          {PRESETS.map((p) => (
            <button type="button" key={p.nome} className="btn peq" onClick={() => set('cnaes', p.cnaes)}>{p.nome}</button>
          ))}
        </div>

        <div className="filtros" style={{ marginTop: 14 }}>
          <label className="campo">
            Porte
            <select value={f.portes.join(',')} onChange={(e) => set('portes', e.target.value ? e.target.value.split(',') : [])}>
              <option value="">Todos</option>
              <option value="01">ME</option>
              <option value="03">EPP</option>
              <option value="05">Demais (médio/grande)</option>
              <option value="03,05">EPP + Demais</option>
            </select>
          </label>
          <label className="campo">
            Capital social mínimo (R$)
            <input type="number" min={0} step={10000} value={f.capitalMin} onChange={(e) => set('capitalMin', e.target.value)} placeholder="Ex.: 100000" />
          </label>
          <label className="campo">
            Aberta a partir de
            <input type="date" value={f.desde} onChange={(e) => set('desde', e.target.value)} />
          </label>
          <label className="campo">
            Enriquecimento Google
            <select value={f.enriquecido} onChange={(e) => set('enriquecido', e.target.value as Filtro['enriquecido'])}>
              <option value="">Indiferente</option>
              <option value="nao">Ainda não enriquecidas</option>
              <option value="sim">Já enriquecidas</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="checks">
            <label className="check"><input type="checkbox" checked={f.telefone} onChange={(e) => set('telefone', e.target.checked)} /> Com telefone</label>
            <label className="check"><input type="checkbox" checked={f.whatsapp} onChange={(e) => set('whatsapp', e.target.checked)} /> Com WhatsApp</label>
            <label className="check"><input type="checkbox" checked={f.email} onChange={(e) => set('email', e.target.checked)} /> Com e-mail</label>
            {f.email && <label className="check"><input type="checkbox" checked={f.semContador} onChange={(e) => set('semContador', e.target.checked)} /> Ignorar e-mail de contador</label>}
            <label className="check"><input type="checkbox" checked={f.site} onChange={(e) => set('site', e.target.checked)} /> Com site</label>
            <label className="check"><input type="checkbox" checked={f.matriz} onChange={(e) => set('matriz', e.target.checked)} /> Só matriz</label>
            <label className="check"><input type="checkbox" checked={f.secundario} onChange={(e) => set('secundario', e.target.checked)} /> CNAE secundário também</label>
            <label className="check"><input type="checkbox" checked={f.foraCrm} onChange={(e) => set('foraCrm', e.target.checked)} /> Ocultar quem já está no CRM</label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={() => setF(vazio)}>Limpar</button>
            <button className="btn primario" disabled={carregando}>{carregando ? <span className="spin" /> : <Icone n="busca" />} Buscar</button>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="barra">
          <div>
            {dados ? <><b>{fmtN(dados.total)}</b> <span className="muted">empresas</span></> : <span className="muted">Carregando…</span>}
            {sel.size > 0
              ? <span className="badge acento" style={{ marginLeft: 10 }}>{sel.size} selecionada(s)</span>
              : !!dados?.total && <span className="small muted" style={{ marginLeft: 10 }}>← marque as caixinhas das empresas para adicionar ao CRM</span>}
          </div>
          <div className="acoes">
            <select value={ordem} onChange={(e) => { setOrdem(e.target.value); carregar(filtroAplicado.current, 1, e.target.value); setPagina(1); }} style={{ width: 'auto' }} aria-label="Ordenar">
              <option value="nome">Ordenar por nome</option>
              <option value="capital">Maior capital social</option>
              <option value="abertura">Mais recentes</option>
            </select>
            <button className="btn" disabled={!sel.size || !!ocupado || !meta?.googleConfigurado} onClick={enriquecer}
              title={meta?.googleConfigurado ? 'Busca telefone, site e nota no Google Maps e e-mails/WhatsApp no site' : 'Configure GOOGLE_PLACES_API_KEY'}>
              {ocupado.startsWith('enriquecer') ? <><span className="spin" /> {ocupado.split(':')[1] || ''}</> : <><Icone n="raio" /> Enriquecer</>}
            </button>
            <button className="btn acento" disabled={!sel.size || !!ocupado} onClick={adicionarSelecionados} title={sel.size ? '' : 'Marque as empresas na lista primeiro'}>
              <Icone n="mais" /> Adicionar ao CRM
            </button>
            <button className="btn" disabled={!dados?.total || !!ocupado} onClick={adicionarFiltro}>Adicionar filtro inteiro…</button>
            <a className="btn" href={exportarHref}><Icone n="baixar" /> CSV</a>
          </div>
        </div>

        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th className="chk"><input type="checkbox" checked={todosSel} onChange={alternarTodos} aria-label="Selecionar página" /></th>
                <th>Empresa</th>
                <th>Atividade</th>
                <th>Endereço</th>
                <th>Contatos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dados?.linhas.map((e) => <Linha key={e.cnpj} e={e} sel={sel.has(e.cnpj)} onSel={() => alternar(e.cnpj)} />)}
            </tbody>
          </table>
          {dados && dados.linhas.length === 0 && <div className="vazio">Nenhuma empresa com esses filtros.</div>}
        </div>

        {dados && dados.total > dados.porPagina && (
          <div className="paginacao">
            <span className="muted small">Página {pagina} de {fmtN(totalPaginas)}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn peq" disabled={pagina <= 1 || carregando} onClick={() => irPara(pagina - 1)}>Anterior</button>
              <button className="btn peq" disabled={pagina >= totalPaginas || carregando} onClick={() => irPara(pagina + 1)}>Próxima</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Linha({ e, sel, onSel }: { e: Empresa; sel: boolean; onSel: () => void }) {
  const nome = e.nome_fantasia || e.razao_social;
  const whats = e.whatsapp || e.site_whatsapp;
  const siteEmails: string[] = e.site_emails ? String(e.site_emails).split(',') : [];
  const endereco = [e.tipo_logradouro, e.logradouro, e.numero].filter(Boolean).join(' ');
  return (
    <tr className={sel ? 'sel' : ''}>
      <td className="chk"><input type="checkbox" checked={sel} onChange={onSel} aria-label={`Selecionar ${nome}`} /></td>
      <td style={{ minWidth: 220 }}>
        <div className="nome-emp">{nome}</div>
        {e.nome_fantasia && <div className="small muted">{e.razao_social}</div>}
        <div className="small" style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="mono muted">{cnpjFormatado(e.cnpj)}</span>
          {e.porte && <span className="badge">{PORTES[e.porte] || e.porte}</span>}
          {!e.matriz && <span className="badge">Filial</span>}
        </div>
        {e.data_inicio && <div className="small muted">Desde {fmtData(e.data_inicio)}</div>}
      </td>
      <td style={{ minWidth: 180, maxWidth: 260 }}>
        <div className="small">{e.cnae_descricao || '—'}</div>
        <div className="small mono muted">{cnaeFormatado(e.cnae_principal)}</div>
      </td>
      <td style={{ minWidth: 180 }}>
        <div className="small">{endereco}{e.complemento ? `, ${e.complemento}` : ''}</div>
        <div className="small muted">{[e.bairro, e.municipio].filter(Boolean).join(' · ')}</div>
      </td>
      <td style={{ minWidth: 210 }}>
        <div className="contatos small">
          {e.telefone1 && <a href={`tel:+55${e.telefone1}`}><Icone n="tel" s={13} /> {formatarTelefone(e.telefone1)}</a>}
          {e.telefone2 && e.telefone2 !== e.telefone1 && <a href={`tel:+55${e.telefone2}`}><Icone n="tel" s={13} /> {formatarTelefone(e.telefone2)}</a>}
          {e.google_telefone && ![e.telefone1, e.telefone2].includes(e.google_telefone) && (
            <a href={`tel:+55${e.google_telefone}`} title="Telefone do Google Maps"><Icone n="mapa" s={13} /> {formatarTelefone(e.google_telefone)}</a>
          )}
          {whats && <a href={linkWhatsapp(whats)} target="_blank" rel="noreferrer" style={{ color: 'var(--wa)' }}><Icone n="wa" s={13} /> WhatsApp</a>}
          {e.email && (
            <span>
              <a href={`mailto:${e.email}`}><Icone n="email" s={13} /> {e.email}</a>
              {emailDeContador(e.email) && <span className="badge warn" title="Provável e-mail do escritório de contabilidade">contador?</span>}
            </span>
          )}
          {siteEmails.filter((m) => m !== e.email).map((m) => (
            <a key={m} href={`mailto:${m}`} title="Encontrado no site"><Icone n="email" s={13} /> {m}</a>
          ))}
          {e.google_site && <a href={e.google_site} target="_blank" rel="noreferrer"><Icone n="site" s={13} /> {e.google_site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 32)}</a>}
          {!e.telefone1 && !e.email && !whats && !e.google_telefone && <span className="muted">Sem contato</span>}
        </div>
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {e.em_crm && <span className="badge ok"><Icone n="check" s={11} /> No CRM</span>}
          {e.enriquecimento_status === 'ok' && (
            e.google_maps_url
              ? <a className="badge info" href={e.google_maps_url} target="_blank" rel="noreferrer">
                  <Icone n="estrela" s={11} /> {e.google_rating ?? '–'} ({e.google_avaliacoes ?? 0})
                </a>
              : <span className="badge info">Google</span>
          )}
          {e.enriquecimento_status === 'nao_encontrado' && <span className="badge" title="Não achamos no Google Maps">sem Google</span>}
        </div>
      </td>
    </tr>
  );
}

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icone, fmtN } from './ui';

export type Cidade = { codigo: string; nome: string; total?: number };

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const titulo = (s: string) =>
  s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g, (m) => m.toLowerCase());

/** Lista de cidades com caixas de seleção, busca e quantidade de empresas. */
export default function SeletorCidades({
  cidades, selecionadas, onChange,
}: {
  cidades: Cidade[];
  selecionadas: Cidade[];
  onChange: (c: Cidade[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const busca = useRef<HTMLInputElement>(null);
  const sel = useMemo(() => new Set(selecionadas.map((c) => c.codigo)), [selecionadas]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    setTimeout(() => busca.current?.focus(), 0);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [aberto]);

  const visiveis = useMemo(() => {
    const n = semAcento(q.trim());
    return n ? cidades.filter((c) => semAcento(c.nome).includes(n)) : cidades;
  }, [q, cidades]);

  function alternar(c: Cidade) {
    onChange(sel.has(c.codigo) ? selecionadas.filter((x) => x.codigo !== c.codigo) : [...selecionadas, c]);
  }

  const resumo = selecionadas.length === 0
    ? 'Todas as cidades'
    : selecionadas.length <= 2
      ? selecionadas.map((c) => titulo(c.nome)).join(', ')
      : `${selecionadas.length} cidades selecionadas`;

  return (
    <div className="rel" ref={ref}>
      <button type="button" className="seletor-botao" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span style={{ color: selecionadas.length ? 'var(--ink)' : 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumo}</span>
        <span style={{ transform: aberto ? 'rotate(-90deg)' : 'rotate(90deg)', display: 'inline-flex', color: 'var(--ink-3)' }}><Icone n="seta" s={14} /></span>
      </button>
      {aberto && (
        <div className="card lista-cidades">
          <div style={{ padding: 8, borderBottom: '1px solid var(--line)' }}>
            <input ref={busca} type="search" placeholder="Filtrar cidades…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid var(--line)' }}>
            <button type="button" className="link-btn" onClick={() => {
              const novos = visiveis.filter((c) => !sel.has(c.codigo));
              onChange([...selecionadas, ...novos]);
            }}>Marcar {q ? 'filtradas' : 'todas'} ({visiveis.length})</button>
            {selecionadas.length > 0 && <button type="button" className="link-btn" onClick={() => onChange([])}>Limpar</button>}
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 0' }}>
            {visiveis.length === 0 && <div className="small muted" style={{ padding: 12 }}>Nenhuma cidade com esse nome na base.</div>}
            {visiveis.map((c) => (
              <label key={c.codigo} className="item-cidade">
                <input type="checkbox" checked={sel.has(c.codigo)} onChange={() => alternar(c)} />
                <span style={{ flex: 1 }}>{titulo(c.nome)}</span>
                {c.total !== undefined && <span className="small muted mono">{fmtN(c.total)}</span>}
              </label>
            ))}
          </div>
          <div style={{ padding: 8, borderTop: '1px solid var(--line)', textAlign: 'right' }}>
            <button type="button" className="btn peq primario" onClick={() => setAberto(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

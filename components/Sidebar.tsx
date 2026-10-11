'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, Icone } from './ui';

export type Me = {
  nome: string; email: string; papel: string; ativa: boolean; diasRestantes: number | null; suporteWhatsapp: string | null;
  conta: { id: number; nome: string; plano: string; ativo_ate: string | null; bloqueada: boolean; ufs: string | null };
};

export default function Sidebar() {
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>('/api/me').then(setMe).catch(() => {}); }, []);
  const itens = [
    { href: '/', label: 'Prospectar', icone: 'busca' },
    { href: '/google', label: 'Google Maps', icone: 'mapa' },
    { href: '/crm', label: 'CRM', icone: 'funil' },
    ...(me?.papel === 'superadmin' ? [{ href: '/admin', label: 'Clientes', icone: 'pessoa' }] : [{ href: '/assinatura', label: 'Assinatura', icone: 'calendario' }]),
  ];
  async function sair() {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }
  return (
    <aside className="side">
      <div className="logo">
        <span className="logo-mark"><Icone n="raio" s={16} /></span>
        <span>{process.env.NEXT_PUBLIC_APP_NOME || 'Prospecta SC'}</span>
      </div>
      <nav className="nav">
        {itens.map((i) => (
          <Link key={i.href} href={i.href} className={(i.href === '/' ? path === '/' : path.startsWith(i.href)) ? 'ativo' : ''}>
            <Icone n={i.icone} /> {i.label}
          </Link>
        ))}
      </nav>
      <div className="side-foot">
        {me && (
          <div style={{ marginBottom: 10, lineHeight: 1.35 }}>
            <div style={{ color: '#fff', fontWeight: 600 }}>{me.conta.nome}</div>
            <div>{me.nome}</div>
            {me.conta.plano === 'teste' && me.diasRestantes !== null && me.diasRestantes > 0 && (
              <div style={{ color: 'var(--accent)', marginTop: 4 }}>Teste: {me.diasRestantes} dia(s) restante(s)</div>
            )}
          </div>
        )}
        <button onClick={sair}><Icone n="sair" s={14} /> Sair</button>
      </div>
    </aside>
  );
}

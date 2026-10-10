'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, Icone } from './ui';

const ITENS = [
  { href: '/', label: 'Prospectar', icone: 'busca' },
  { href: '/google', label: 'Google Maps', icone: 'mapa' },
  { href: '/crm', label: 'CRM', icone: 'funil' },
];

export default function Sidebar() {
  const path = usePathname();
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
        {ITENS.map((i) => (
          <Link key={i.href} href={i.href} className={(i.href === '/' ? path === '/' : path.startsWith(i.href)) ? 'ativo' : ''}>
            <Icone n={i.icone} /> {i.label}
          </Link>
        ))}
      </nav>
      <div className="side-foot">
        <button onClick={sair}><Icone n="sair" s={14} /> Sair</button>
      </div>
    </aside>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { linkWhatsapp } from '@/lib/contato';
import { api } from './ui';
import type { Me } from './Sidebar';

/** Faixa no topo quando a conta venceu ou está perto de vencer. */
export default function AvisoConta() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>('/api/me').then(setMe).catch(() => {}); }, []);
  if (!me || me.papel === 'superadmin') return null;
  const wa = me.suporteWhatsapp
    ? linkWhatsapp(me.suporteWhatsapp, `Olá! Quero assinar o Prospecta. Minha conta: ${me.conta.nome} (${me.email}).`)
    : null;
  if (!me.ativa) {
    return (
      <div className="aviso" style={{ marginBottom: 14, background: 'var(--bad-soft)', color: 'var(--bad)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>{me.conta.bloqueada ? 'Conta bloqueada.' : 'Seu período de acesso terminou.'}</b>
        <span>Assine para continuar prospectando. Seus leads continuam guardados.</span>
        {wa && <a className="btn wa peq" href={wa} target="_blank" rel="noreferrer">Assinar pelo WhatsApp</a>}
      </div>
    );
  }
  if (me.conta.plano === 'teste' && me.diasRestantes !== null && me.diasRestantes <= 3) {
    return (
      <div className="aviso" style={{ marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>Seu teste termina em <b>{me.diasRestantes} dia(s)</b>.</span>
        {wa && <a className="btn wa peq" href={wa} target="_blank" rel="noreferrer">Assinar agora</a>}
      </div>
    );
  }
  return null;
}

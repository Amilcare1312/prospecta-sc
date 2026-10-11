'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, Icone } from '@/components/ui';

export default function Cadastro() {
  const [f, setF] = useState({ nome: '', empresa: '', email: '', whatsapp: '', senha: '' });
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    try {
      await api('/api/cadastro', { method: 'POST', json: f });
      window.location.href = '/';
    } catch (err) {
      setErro((err as Error).message);
      setCarregando(false);
    }
  }
  return (
    <div className="login">
      <form className="card" onSubmit={criar} style={{ width: 'min(420px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="logo-mark"><Icone n="raio" s={16} /></span>
          <h1>Criar conta</h1>
        </div>
        <p className="muted" style={{ margin: 0 }}>Teste grátis, sem cartão de crédito.</p>
        <label className="campo">Seu nome<input type="text" autoComplete="name" value={f.nome} onChange={set('nome')} required /></label>
        <label className="campo">Empresa<input type="text" autoComplete="organization" value={f.empresa} onChange={set('empresa')} required /></label>
        <label className="campo">E-mail<input type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></label>
        <label className="campo">WhatsApp (com DDD)<input type="text" inputMode="tel" autoComplete="tel" value={f.whatsapp} onChange={set('whatsapp')} placeholder="(48) 99999-9999" required /></label>
        <label className="campo">Senha (mínimo 6 caracteres)<input type="password" autoComplete="new-password" value={f.senha} onChange={set('senha')} minLength={6} required /></label>
        {erro && <div className="badge bad" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>{erro}</div>}
        <button className="btn primario" disabled={carregando}>{carregando ? <span className="spin" /> : 'Começar teste grátis'}</button>
        <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
          Já tem conta? <Link href="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}

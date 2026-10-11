'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, Icone } from '@/components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    try {
      await api('/api/login', { method: 'POST', json: { email, senha } });
      window.location.href = '/';
    } catch (err) {
      setErro((err as Error).message);
      setCarregando(false);
    }
  }
  return (
    <div className="login">
      <form className="card" onSubmit={entrar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="logo-mark"><Icone n="raio" s={16} /></span>
          <h1>{process.env.NEXT_PUBLIC_APP_NOME || 'Prospecta SC'}</h1>
        </div>
        <p className="muted" style={{ margin: 0 }}>Entre na sua conta.</p>
        <label className="campo">
          E-mail
          <input type="text" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </label>
        <label className="campo">
          Senha
          <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </label>
        {erro && <div className="badge bad" style={{ alignSelf: 'flex-start' }}>{erro}</div>}
        <button className="btn primario" disabled={carregando}>{carregando ? <span className="spin" /> : 'Entrar'}</button>
        <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
          Ainda não tem conta? <Link href="/cadastro">Teste grátis</Link>
        </p>
      </form>
    </div>
  );
}

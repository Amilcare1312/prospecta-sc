'use client';
import { useState } from 'react';
import { api, Icone } from '@/components/ui';

export default function Login() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro('');
    try {
      await api('/api/login', { method: 'POST', json: { senha } });
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
        <p className="muted" style={{ margin: 0 }}>Prospecção de empresas em Santa Catarina.</p>
        <label className="campo">
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus required />
        </label>
        {erro && <div className="badge bad" style={{ alignSelf: 'flex-start' }}>{erro}</div>}
        <button className="btn primario" disabled={carregando}>{carregando ? <span className="spin" /> : 'Entrar'}</button>
      </form>
    </div>
  );
}

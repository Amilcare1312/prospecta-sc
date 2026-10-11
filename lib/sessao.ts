import { cookies } from 'next/headers';
import { COOKIE, verificar } from './auth';
import { db } from './db';
import { garantirSchema } from './migrate';

export type Sessao = {
  usuarioId: number;
  contaId: number;
  papel: string;
  nome: string;
  email: string;
  conta: { id: number; nome: string; plano: string; ativo_ate: string | null; bloqueada: boolean; ufs: string | null };
  ativa: boolean;
  diasRestantes: number | null;
};

export class ErroHttp extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

/** Lê a sessão do cookie e carrega usuário + conta. Lança 401/402 quando não pode usar. */
export async function sessao(opts: { exigirAtiva?: boolean } = { exigirAtiva: true }): Promise<Sessao> {
  await garantirSchema();
  const t = await verificar((await cookies()).get(COOKIE)?.value);
  if (!t) throw new ErroHttp(401, 'Sessão expirada. Entre novamente.');
  const sql = db();
  const [r] = await sql`
    select u.id as usuario_id, u.nome, u.email, u.papel,
           c.id as conta_id, c.nome as conta_nome, c.plano, c.ativo_ate, c.bloqueada, c.ufs
    from usuarios u join contas c on c.id = u.conta_id
    where u.id = ${t.u}`;
  if (!r) throw new ErroHttp(401, 'Usuário não encontrado. Entre novamente.');
  const vence = r.ativo_ate ? new Date(r.ativo_ate as string) : null;
  const superadmin = r.papel === 'superadmin';
  const ativa = superadmin || (!r.bloqueada && (!vence || vence.getTime() > Date.now()));
  const s: Sessao = {
    usuarioId: r.usuario_id as number,
    contaId: r.conta_id as number,
    papel: r.papel as string,
    nome: r.nome as string,
    email: r.email as string,
    conta: {
      id: r.conta_id as number,
      nome: r.conta_nome as string,
      plano: r.plano as string,
      ativo_ate: vence ? vence.toISOString() : null,
      bloqueada: r.bloqueada as boolean,
      ufs: (r.ufs as string) || null,
    },
    ativa,
    diasRestantes: vence ? Math.ceil((vence.getTime() - Date.now()) / 86400000) : null,
  };
  if (opts.exigirAtiva !== false && !ativa) {
    throw new ErroHttp(402, r.bloqueada ? 'Conta bloqueada. Fale com o suporte.' : 'Seu período de acesso terminou. Renove para continuar usando.');
  }
  return s;
}

export function exigirAdmin(s: Sessao) {
  if (s.papel !== 'superadmin') throw new ErroHttp(403, 'Apenas o administrador pode fazer isso.');
}

/** Estados que a conta pode consultar (null = todos). */
export function ufsPermitidas(s: Sessao): string[] | null {
  if (s.papel === 'superadmin' || !s.conta.ufs) return null;
  return s.conta.ufs.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
}

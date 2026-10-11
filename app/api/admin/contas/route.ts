import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { exigirAdmin, sessao } from '@/lib/sessao';
import { limiteGoogle } from '@/lib/uso';

export const dynamic = 'force-dynamic';

export const GET = rota(async () => {
  const s = await sessao();
  exigirAdmin(s);
  const mes = new Date().toISOString().slice(0, 7);
  const contas = await db()`
    select c.*,
      (select json_agg(json_build_object('nome', u.nome, 'email', u.email, 'papel', u.papel, 'ultimo_acesso', u.ultimo_acesso) order by u.id)
         from usuarios u where u.conta_id = c.id) as usuarios,
      (select count(*)::int from leads l where l.conta_id = c.id) as leads,
      (select google from uso_mensal x where x.conta_id = c.id and x.mes = ${mes}) as google_mes
    from contas c
    order by c.criado_em desc`;
  return NextResponse.json({ contas, limiteGoogle: limiteGoogle() });
});

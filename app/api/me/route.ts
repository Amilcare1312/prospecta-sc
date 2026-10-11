import { NextResponse } from 'next/server';
import { rota } from '@/lib/http';
import { sessao } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

export const GET = rota(async () => {
  const s = await sessao({ exigirAtiva: false });
  return NextResponse.json({
    nome: s.nome, email: s.email, papel: s.papel, conta: s.conta, ativa: s.ativa, diasRestantes: s.diasRestantes,
    suporteWhatsapp: process.env.SUPORTE_WHATSAPP || null,
  });
});

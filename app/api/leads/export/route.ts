import { db } from '@/lib/db';
import { cnpjFormatado, ETAPAS, formatarTelefone, PORTES } from '@/lib/contato';
import { csv, rota } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = rota(async () => {
  const rows = await db()`select * from leads order by etapa, nome`;
  const nomeEtapa = Object.fromEntries(ETAPAS.map((e) => [e.id, e.nome]));
  const linhas = rows.map((r: any) => ({
    ...r,
    cnpj: cnpjFormatado(r.cnpj),
    etapa: nomeEtapa[r.etapa] || r.etapa,
    porte: PORTES[r.porte] || r.porte || '',
    telefone: formatarTelefone(r.telefone),
    telefone2: formatarTelefone(r.telefone2),
    nao_contatar: r.nao_contatar ? 'sim' : '',
  }));
  return csv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['nome', 'Empresa'], ['razao_social', 'Razão social'], ['cnpj', 'CNPJ'], ['etapa', 'Etapa'], ['cidade', 'Cidade'],
    ['endereco', 'Endereço'], ['telefone', 'Telefone'], ['telefone2', 'Telefone 2'], ['whatsapp', 'WhatsApp'],
    ['email', 'E-mail'], ['site', 'Site'], ['segmento', 'Segmento'], ['porte', 'Porte'], ['valor', 'Valor (R$)'],
    ['responsavel', 'Responsável'], ['proximo_contato', 'Próximo contato'], ['observacoes', 'Observações'],
    ['origem', 'Origem'], ['nao_contatar', 'Não contatar'], ['criado_em', 'Criado em'],
  ], linhas);
});

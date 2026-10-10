import { db } from '@/lib/db';
import { cnaeFormatado, cnpjFormatado, formatarTelefone, PORTES } from '@/lib/contato';
import { colunasEmpresa, filtroDeParams, fromEmpresas, whereEmpresas } from '@/lib/filtros';
import { csv, rota } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = rota(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const f = filtroDeParams(p);
  const limite = Math.min(50000, Number(p.get('limite')) || 20000);
  const sql = db();
  const rows = await sql`select ${colunasEmpresa(sql)} from ${fromEmpresas(sql)} where ${whereEmpresas(sql, f)}
    order by m.nome, e.razao_social limit ${limite}`;
  const linhas = rows.map((r: any) => ({
    ...r,
    cnpj: cnpjFormatado(r.cnpj),
    cnae: `${cnaeFormatado(r.cnae_principal)} ${r.cnae_descricao || ''}`.trim(),
    porte: PORTES[r.porte] || r.porte,
    endereco: [r.tipo_logradouro, r.logradouro, r.numero, r.complemento].filter(Boolean).join(' '),
    telefone1: formatarTelefone(r.telefone1),
    telefone2: formatarTelefone(r.telefone2),
    google_telefone: formatarTelefone(r.google_telefone),
    whatsapp: r.whatsapp || r.site_whatsapp || '',
  }));
  return csv(`empresas-sc-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['cnpj', 'CNPJ'], ['razao_social', 'Razão social'], ['nome_fantasia', 'Nome fantasia'],
    ['cnae', 'CNAE principal'], ['porte', 'Porte'], ['capital_social', 'Capital social'], ['data_inicio', 'Abertura'],
    ['endereco', 'Endereço'], ['bairro', 'Bairro'], ['cep', 'CEP'], ['municipio', 'Cidade'], ['uf', 'UF'],
    ['telefone1', 'Telefone 1'], ['telefone2', 'Telefone 2'], ['whatsapp', 'WhatsApp (provável)'],
    ['email', 'E-mail (Receita)'], ['site_emails', 'E-mails do site'], ['google_telefone', 'Telefone Google'],
    ['google_site', 'Site'], ['google_maps_url', 'Google Maps'], ['google_rating', 'Nota Google'],
  ], linhas);
});

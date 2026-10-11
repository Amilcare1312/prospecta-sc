import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { digitos, whatsappDe } from '@/lib/contato';
import { rota } from '@/lib/http';
import { localizarEmpresa, placesConfigurado } from '@/lib/places';
import { contatosDoSite, emLotes } from '@/lib/site';
import { sessao, ufsPermitidas } from '@/lib/sessao';
import { consumirGoogle } from '@/lib/uso';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Enriquecimento: Google Maps (telefone, site, nota) + e-mails/WhatsApp do site. Máx. 20 por chamada. */
export const POST = rota(async (req: Request) => {
  const s = await sessao();
  if (!placesConfigurado()) return NextResponse.json({ erro: 'Configure GOOGLE_PLACES_API_KEY para enriquecer.' }, { status: 400 });
  const { cnpjs } = (await req.json()) as { cnpjs: string[] };
  const lista = [...new Set((cnpjs || []).map(digitos).filter((c) => c.length === 14))].slice(0, 20);
  const sql = db();
  const permitidas = ufsPermitidas(s);
  const todas = await sql`
    select e.cnpj, coalesce(nullif(e.nome_fantasia, ''), e.razao_social) as nome, e.razao_social, e.cep, m.nome as cidade,
           e.enriquecido_em, e.enriquecimento_status
    from empresas e left join municipios m on m.codigo = e.municipio_codigo
    where e.cnpj in ${sql(lista.length ? lista : [''])}
      ${permitidas ? sql`and e.uf in ${sql(permitidas.length ? permitidas : ['--'])}` : sql``}`;
  // Enriquecimento é compartilhado: o que já foi consultado nos últimos 90 dias não gasta Google de novo.
  const recente = (e: any) => e.enriquecido_em && e.enriquecimento_status !== 'erro' && Date.now() - new Date(e.enriquecido_em).getTime() < 90 * 86400000;
  const empresas = todas.filter((e) => !recente(e));
  const emCache = todas.filter(recente);
  if (empresas.length) await consumirGoogle(s, empresas.length);
  for (const e of emCache as any[]) {
    await sql`update leads l set
        telefone = coalesce(nullif(l.telefone, ''), x.google_telefone),
        whatsapp = coalesce(nullif(l.whatsapp, ''), x.site_whatsapp),
        email = coalesce(nullif(l.email, ''), nullif(split_part(x.site_emails, ',', 1), '')),
        site = coalesce(nullif(l.site, ''), x.google_site), atualizado_em = now()
      from empresas x where x.cnpj = l.cnpj and l.cnpj = ${e.cnpj} and l.conta_id = ${s.contaId}`;
  }

  const resultados = await emLotes(empresas as any[], 4, async (e) => {
    try {
      let lugar = await localizarEmpresa(e.nome, e.cidade || '', e.cep);
      if (!lugar && e.razao_social && e.razao_social !== e.nome) lugar = await localizarEmpresa(e.razao_social, e.cidade || '', e.cep);
      const site = lugar?.site ? await contatosDoSite(lugar.site) : { emails: [], whatsapp: null };
      const whatsGoogle = whatsappDe(lugar?.telefone);
      await sql`update empresas set
          google_place_id = ${lugar?.place_id ?? null}, google_nome = ${lugar?.nome ?? null},
          google_telefone = ${lugar?.telefone ?? null}, google_site = ${lugar?.site ?? null},
          google_maps_url = ${lugar?.maps_url ?? null}, google_rating = ${lugar?.rating ?? null},
          google_avaliacoes = ${lugar?.avaliacoes ?? null},
          site_emails = ${site.emails.length ? site.emails.join(',') : null},
          site_whatsapp = ${site.whatsapp || whatsGoogle || null},
          enriquecido_em = now(), enriquecimento_status = ${lugar ? 'ok' : 'nao_encontrado'}
        where cnpj = ${e.cnpj}`;
      // propaga para o lead, se já estiver no CRM (só preenche o que está vazio)
      await sql`update leads set
          telefone = coalesce(nullif(telefone, ''), ${lugar?.telefone ?? null}),
          whatsapp = coalesce(nullif(whatsapp, ''), ${site.whatsapp || whatsGoogle || null}),
          email = coalesce(nullif(email, ''), ${site.emails[0] ?? null}),
          site = coalesce(nullif(site, ''), ${lugar?.site ?? null}),
          atualizado_em = now()
        where cnpj = ${e.cnpj} and conta_id = ${s.contaId}`;
      return { cnpj: e.cnpj, status: lugar ? 'ok' : 'nao_encontrado' };
    } catch (err) {
      await sql`update empresas set enriquecimento_status = 'erro', enriquecido_em = now() where cnpj = ${e.cnpj}`;
      return { cnpj: e.cnpj, status: 'erro', erro: err instanceof Error ? err.message : String(err) };
    }
  });
  for (const e of emCache as any[]) resultados.push({ cnpj: e.cnpj, status: e.enriquecimento_status || 'ok' });
  return NextResponse.json({ resultados });
});

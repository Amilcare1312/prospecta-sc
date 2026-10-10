import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { digitos, whatsappDe } from '@/lib/contato';
import { rota } from '@/lib/http';
import { localizarEmpresa, placesConfigurado } from '@/lib/places';
import { contatosDoSite, emLotes } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Enriquecimento: Google Maps (telefone, site, nota) + e-mails/WhatsApp do site. Máx. 20 por chamada. */
export const POST = rota(async (req: Request) => {
  if (!placesConfigurado()) return NextResponse.json({ erro: 'Configure GOOGLE_PLACES_API_KEY para enriquecer.' }, { status: 400 });
  const { cnpjs } = (await req.json()) as { cnpjs: string[] };
  const lista = [...new Set((cnpjs || []).map(digitos).filter((c) => c.length === 14))].slice(0, 20);
  const sql = db();
  const empresas = await sql`
    select e.cnpj, coalesce(nullif(e.nome_fantasia, ''), e.razao_social) as nome, e.razao_social, e.cep, m.nome as cidade
    from empresas e left join municipios m on m.codigo = e.municipio_codigo
    where e.cnpj in ${sql(lista.length ? lista : [''])}`;

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
        where cnpj = ${e.cnpj}`;
      return { cnpj: e.cnpj, status: lugar ? 'ok' : 'nao_encontrado' };
    } catch (err) {
      await sql`update empresas set enriquecimento_status = 'erro', enriquecido_em = now() where cnpj = ${e.cnpj}`;
      return { cnpj: e.cnpj, status: 'erro', erro: err instanceof Error ? err.message : String(err) };
    }
  });
  return NextResponse.json({ resultados });
});

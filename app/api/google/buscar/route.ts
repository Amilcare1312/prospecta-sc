import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rota } from '@/lib/http';
import { buscarLugares, placesConfigurado } from '@/lib/places';
import { ErroHttp, sessao, ufsPermitidas } from '@/lib/sessao';
import { consumirGoogle } from '@/lib/uso';

export const dynamic = 'force-dynamic';

/** Busca no Google Maps (ex.: "metalúrgica" em "Blumenau") e cruza com a base CNPJ pelo telefone. */
export const POST = rota(async (req: Request) => {
  const s = await sessao();
  if (!placesConfigurado()) return NextResponse.json({ erro: 'Configure GOOGLE_PLACES_API_KEY para buscar no Google Maps.' }, { status: 400 });
  const { termo, cidade, pageToken, uf: ufIn } = (await req.json()) as { termo: string; cidade: string; pageToken?: string; uf?: string };
  const uf = /^[A-Za-z]{2}$/.test(ufIn || '') ? ufIn!.toUpperCase() : 'SC';
  const permitidas = ufsPermitidas(s);
  if (permitidas && !permitidas.includes(uf)) throw new ErroHttp(403, `Seu plano não inclui o estado ${uf}.`);
  if (!termo?.trim() || !cidade?.trim()) return NextResponse.json({ erro: 'Informe o que procurar e a cidade.' }, { status: 400 });
  await consumirGoogle(s, 1);
  const { lugares, nextPageToken } = await buscarLugares(`${termo.trim()} em ${cidade.trim()}, ${uf}`, pageToken);

  const sql = db();
  const tels = lugares.map((l) => l.telefone).filter(Boolean) as string[];
  const ids = lugares.map((l) => l.place_id);
  const [porTel, noCrm] = await Promise.all([
    tels.length
      ? sql`select cnpj, razao_social, email, telefone1, telefone2, google_telefone from empresas
            where telefone1 in ${sql(tels)} or telefone2 in ${sql(tels)} or google_telefone in ${sql(tels)}`
      : Promise.resolve([] as any[]),
    sql`select google_place_id, cnpj from leads where conta_id = ${s.contaId} and google_place_id in ${sql(ids.length ? ids : [''])}`,
  ]);
  const crmIds = new Set(noCrm.map((r: any) => r.google_place_id));
  const resultado = lugares.map((l) => {
    const emp: any = l.telefone
      ? porTel.find((e: any) => [e.telefone1, e.telefone2, e.google_telefone].includes(l.telefone))
      : null;
    return {
      ...l,
      cidade: cidade.trim(),
      uf,
      cnpj: emp?.cnpj ?? null,
      razao_social: emp?.razao_social ?? null,
      email_receita: emp?.email ?? null,
      em_crm: crmIds.has(l.place_id),
    };
  });
  return NextResponse.json({ lugares: resultado, nextPageToken });
});

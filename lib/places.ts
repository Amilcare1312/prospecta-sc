// Google Places API (New) — Text Search.
// https://developers.google.com/maps/documentation/places/web-service/text-search
import { digitos, semAcento } from './contato';

export type Lugar = {
  place_id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null; // só dígitos, DDD + número
  site: string | null;
  maps_url: string | null;
  rating: number | null;
  avaliacoes: number | null;
  tipo: string | null;
  status: string | null;
};

const CAMPOS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'nextPageToken',
].join(',');

export function placesConfigurado() {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

export async function buscarLugares(
  textQuery: string,
  pageToken?: string,
  pageSize = 20,
): Promise<{ lugares: Lugar[]; nextPageToken: string | null }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY não configurada');
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': CAMPOS,
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize,
      ...(pageToken ? { pageToken } : {}),
    }),
    cache: 'no-store',
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Google Places ${r.status}: ${txt.slice(0, 300)}`);
  }
  const j = (await r.json()) as {
    places?: Array<Record<string, any>>;
    nextPageToken?: string;
  };
  const lugares: Lugar[] = (j.places || []).map((p) => ({
    place_id: p.id,
    nome: p.displayName?.text || '',
    endereco: p.formattedAddress || null,
    telefone: digitos(p.nationalPhoneNumber).replace(/^0/, '') || null,
    site: p.websiteUri || null,
    maps_url: p.googleMapsUri || null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    avaliacoes: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    tipo: p.primaryTypeDisplayName?.text || null,
    status: p.businessStatus || null,
  }));
  return { lugares, nextPageToken: j.nextPageToken || null };
}

/** Procura a empresa no Google e só aceita se o endereço bater com a cidade (ou CEP). */
export async function localizarEmpresa(nome: string, cidade: string, cep?: string | null): Promise<Lugar | null> {
  const { lugares } = await buscarLugares(`${nome} ${cidade} SC`, undefined, 5);
  const c = semAcento(cidade);
  const cepFmt = cep && cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : null;
  const palavras = semAcento(nome)
    .replace(/\b(LTDA|ME|EPP|EIRELI|S\/?A|SA|COMERCIO|INDUSTRIA|SERVICOS|DE|DA|DO|DOS|DAS|E)\b/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  for (const l of lugares) {
    const end = semAcento(l.endereco || '');
    const cidadeOk = end.includes(c) || (cepFmt && (l.endereco || '').includes(cepFmt));
    if (!cidadeOk) continue;
    const nomeG = semAcento(l.nome);
    const nomeOk = palavras.length === 0 || palavras.some((w) => nomeG.includes(w));
    if (nomeOk) return l;
  }
  return null;
}

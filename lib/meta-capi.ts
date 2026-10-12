// API de Conversões da Meta (servidor). Usada para eventos que acontecem fora do navegador,
// como o pagamento confirmado pelo Asaas. Precisa de META_PIXEL_ID (ou NEXT_PUBLIC_) e META_CAPI_TOKEN.
import { createHash } from 'node:crypto';
import { digitos } from './contato';

const h = (v?: string | null) => (v ? createHash('sha256').update(v.trim().toLowerCase()).digest('hex') : undefined);

export type DadosUsuario = { email?: string | null; telefone?: string | null; externalId?: string | number | null; fbp?: string | null; fbc?: string | null; ip?: string | null; ua?: string | null };

export async function enviarEventoMeta(evento: {
  nome: string; id: string; url?: string; valor?: number; usuario: DadosUsuario;
}): Promise<void> {
  const pixel = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return;
  const tel = digitos(evento.usuario.telefone);
  const user_data: Record<string, unknown> = {
    em: evento.usuario.email ? [h(evento.usuario.email)] : undefined,
    ph: tel ? [h(tel.startsWith('55') ? tel : '55' + tel)] : undefined,
    external_id: evento.usuario.externalId != null ? [h(String(evento.usuario.externalId))] : undefined,
    fbp: evento.usuario.fbp || undefined,
    fbc: evento.usuario.fbc || undefined,
    client_ip_address: evento.usuario.ip || undefined,
    client_user_agent: evento.usuario.ua || undefined,
  };
  const corpo = {
    data: [{
      event_name: evento.nome,
      event_time: Math.floor(Date.now() / 1000),
      event_id: evento.id,
      action_source: 'website',
      event_source_url: evento.url,
      user_data,
      custom_data: evento.valor != null ? { currency: 'BRL', value: evento.valor } : undefined,
    }],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
  };
  const versao = process.env.META_API_VERSION || 'v21.0';
  try {
    const r = await fetch(`https://graph.facebook.com/${versao}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), cache: 'no-store',
    });
    if (!r.ok) console.error('Meta CAPI', r.status, (await r.text()).slice(0, 300));
  } catch (e) {
    console.error('Meta CAPI', e);
  }
}

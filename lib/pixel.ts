// Eventos do Pixel da Meta no navegador. Sem NEXT_PUBLIC_META_PIXEL_ID, não faz nada.
type Fbq = (...args: unknown[]) => void;

export function rastrear(evento: string, params: Record<string, unknown> = {}, eventID?: string) {
  if (typeof window === 'undefined') return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (!fbq) return;
  try {
    fbq('track', evento, params, eventID ? { eventID } : undefined);
  } catch {
    /* ignora */
  }
}

// Utilidades de contato — usadas no servidor e no navegador.

export const digitos = (s?: string | null) => (s || '').replace(/\D/g, '');

/** Formata 4832221111 → (48) 3222-1111 ; 47991234567 → (47) 99123-4567 */
export function formatarTelefone(t?: string | null): string {
  const d = digitos(t).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t || '';
}

/** Número parece celular → retorna 55DD9XXXXXXXX (provável WhatsApp). */
export function whatsappDe(t?: string | null): string | null {
  let d = digitos(t);
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return null;
  const ddd = d.slice(0, 2);
  const num = d.slice(2);
  if (num.length === 9 && num[0] === '9') return '55' + ddd + num;
  if (num.length === 8 && '6789'.includes(num[0])) return '55' + ddd + '9' + num;
  return null;
}

export function linkWhatsapp(numero: string, mensagem?: string) {
  const n = digitos(numero);
  return `https://wa.me/${n}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`;
}

/** Na base da Receita muitas empresas têm o e-mail do escritório de contabilidade. */
export function emailDeContador(email?: string | null): boolean {
  return !!email && /contab|contador|cont[aá]bil|escritorio|assessoria|fiscal@|dp@|rh@/i.test(email);
}

export const PORTES: Record<string, string> = {
  '00': 'Não informado',
  '01': 'ME',
  '03': 'EPP',
  '05': 'Demais',
};

export function cnpjFormatado(c?: string | null) {
  const d = digitos(c);
  if (d.length !== 14) return c || '';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function cnaeFormatado(c?: string | null) {
  const d = digitos(c);
  if (d.length !== 7) return c || '';
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`;
}

export const ETAPAS = [
  { id: 'novo', nome: 'Novo' },
  { id: 'contatado', nome: 'Contatado' },
  { id: 'qualificado', nome: 'Qualificado' },
  { id: 'proposta', nome: 'Proposta' },
  { id: 'negociacao', nome: 'Negociação' },
  { id: 'ganho', nome: 'Ganho' },
  { id: 'perdido', nome: 'Perdido' },
] as const;
export type Etapa = (typeof ETAPAS)[number]['id'];
export const ETAPA_IDS = ETAPAS.map((e) => e.id) as string[];

export function aplicarModelo(modelo: string, lead: { nome?: string | null; cidade?: string | null }) {
  return modelo.replace(/\{nome\}/g, lead.nome || '').replace(/\{cidade\}/g, lead.cidade || '');
}

export function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

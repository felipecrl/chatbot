import type { Property } from '../properties/property.types';
import type {
  IncomingMessage,
  IncomingMessageType,
  WhatsAppWebhookPayload,
} from './whatsapp.types';

const KNOWN_TYPES: ReadonlySet<string> = new Set([
  'text',
  'image',
  'audio',
  'video',
  'document',
  'location',
]);

/** Extracts the first user message from a webhook payload, if any. */
export function extractIncomingMessage(payload: WhatsAppWebhookPayload): IncomingMessage | null {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  const contact = value?.contacts?.[0];
  return {
    messageId: message.id,
    from: message.from,
    timestamp: message.timestamp,
    type: (KNOWN_TYPES.has(message.type) ? message.type : 'unknown') as IncomingMessageType,
    text: message.text?.body ?? '',
    contactName: contact?.profile?.name ?? '',
  };
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Builds a human-friendly WhatsApp caption/message for a property. */
export function formatPropertyMessage(property: Property): string {
  const lines: string[] = [];
  lines.push(
    `🏠 *${property.type ?? 'Imóvel'} - ${property.neighborhood ?? property.city ?? ''}*`.trim(),
  );

  if (property.price != null) {
    const suffix = property.transaction === 'aluguel' ? '/mês' : '';
    lines.push(`💰 ${currencyFormatter.format(property.price)}${suffix}`);
  }

  const details: string[] = [];
  if (property.area != null) details.push(`${property.area}m²`);
  if (property.bedrooms != null) details.push(`${property.bedrooms} quartos`);
  if (property.bathrooms != null) details.push(`${property.bathrooms} banheiros`);
  if (property.parkingSpaces != null) details.push(`${property.parkingSpaces} vaga(s)`);
  if (details.length > 0) lines.push(`📐 ${details.join(' | ')}`);

  if (property.amenities.length > 0) {
    lines.push(`✨ ${property.amenities.slice(0, 4).join(', ')}`);
  }

  if (property.code) lines.push(`🔑 Código: ${property.code}`);

  return lines.join('\n');
}

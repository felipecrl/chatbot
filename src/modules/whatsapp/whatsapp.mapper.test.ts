import { describe, expect, it } from 'vitest';
import type { Property } from '../properties/property.types';
import type { WhatsAppWebhookPayload } from './whatsapp.types';
import { extractIncomingMessage, formatPropertyMessage } from './whatsapp.mapper';

const baseProperty: Property = {
  code: 'AP001',
  type: 'Apartamento',
  transaction: 'venda',
  city: 'Belo Horizonte',
  neighborhood: 'Savassi',
  address: null,
  price: 450_000,
  area: 75,
  bedrooms: 2,
  bathrooms: 2,
  parkingSpaces: 1,
  amenities: ['Academia', 'Piscina', 'Portaria 24h'],
  description: 'Lindo apartamento.',
  photos: [],
};

function payloadWithMessage(overrides: Record<string, unknown> = {}): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'Maria' } }],
              messages: [
                {
                  id: 'wamid.123',
                  from: '5531999999999',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: 'Olá!' },
                  ...overrides,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('extractIncomingMessage', () => {
  it('extracts a text message', () => {
    expect(extractIncomingMessage(payloadWithMessage())).toEqual({
      messageId: 'wamid.123',
      from: '5531999999999',
      timestamp: '1700000000',
      type: 'text',
      text: 'Olá!',
      contactName: 'Maria',
    });
  });

  it('maps unknown message types to "unknown"', () => {
    const message = extractIncomingMessage(
      payloadWithMessage({ type: 'sticker', text: undefined }),
    );
    expect(message?.type).toBe('unknown');
    expect(message?.text).toBe('');
  });

  it('returns null when there is no message (e.g. status updates)', () => {
    expect(
      extractIncomingMessage({
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: {} }] }],
      }),
    ).toBeNull();
    expect(extractIncomingMessage({})).toBeNull();
  });

  it('defaults the contact name to an empty string when no contact is present', () => {
    const message = extractIncomingMessage({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'wamid.1',
                    from: '553199',
                    timestamp: '1',
                    type: 'text',
                    text: { body: 'oi' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(message?.contactName).toBe('');
  });
});

describe('formatPropertyMessage', () => {
  it('includes price, details, amenities and code', () => {
    const text = formatPropertyMessage(baseProperty);
    expect(text).toContain('Apartamento - Savassi');
    expect(text).toContain('R$');
    expect(text).toContain('75m²');
    expect(text).toContain('2 quartos');
    expect(text).toContain('Código: AP001');
  });

  it('adds the /mês suffix for rentals', () => {
    expect(
      formatPropertyMessage({ ...baseProperty, transaction: 'aluguel', price: 2_800 }),
    ).toContain('/mês');
  });

  it('omits missing fields gracefully', () => {
    const text = formatPropertyMessage({
      ...baseProperty,
      price: null,
      area: null,
      bedrooms: null,
      bathrooms: null,
      parkingSpaces: null,
      amenities: [],
    });
    expect(text).toContain('Apartamento - Savassi');
    expect(text).not.toContain('m²');
  });

  it('falls back to "Imóvel" and the city when type/neighborhood are missing', () => {
    const text = formatPropertyMessage({ ...baseProperty, type: null, neighborhood: null });
    expect(text).toContain('Imóvel - Belo Horizonte');
  });

  it('handles a property with no type, neighborhood, city or code', () => {
    const text = formatPropertyMessage({
      ...baseProperty,
      type: null,
      neighborhood: null,
      city: null,
      code: '',
    });
    expect(text).toContain('🏠');
    expect(text).not.toContain('Código');
  });
});

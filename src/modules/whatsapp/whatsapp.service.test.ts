import type { AxiosInstance } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import type { Property } from '../properties/property.types';
import { WhatsAppService } from './whatsapp.service';

function setSkipSend(value: boolean) {
  (config as unknown as { whatsapp: { skipSend: boolean } }).whatsapp.skipSend = value;
}

function clientWith(post: ReturnType<typeof vi.fn>) {
  return { post } as unknown as AxiosInstance;
}

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
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
    amenities: [],
    description: '',
    photos: [],
    ...overrides,
  };
}

afterEach(() => {
  setSkipSend(false);
  vi.useRealTimers();
});

describe('WhatsAppService with SKIP_WHATSAPP_SEND enabled', () => {
  beforeEach(() => setSkipSend(true));

  it('does not send text and works without an injected client', async () => {
    const service = new WhatsAppService();
    await expect(service.sendText('5531999999999', 'oi')).resolves.toBeUndefined();
  });

  it('does not send images', async () => {
    const post = vi.fn();
    await new WhatsAppService(clientWith(post)).sendImage(
      '5531999999999',
      'http://img/1.jpg',
      'cap',
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('skips marking messages as read', async () => {
    const post = vi.fn();
    await new WhatsAppService(clientWith(post)).markAsRead('wamid.1');
    expect(post).not.toHaveBeenCalled();
  });
});

describe('WhatsAppService sending through the API', () => {
  it('sendText posts a text message', async () => {
    const post = vi.fn().mockResolvedValue({ data: { messages: [{ id: 'wamid.out' }] } });
    await new WhatsAppService(clientWith(post)).sendText('5531999999999', 'olá');
    expect(post).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '5531999999999',
      type: 'text',
      text: { body: 'olá' },
    });
  });

  it('sendText tolerates a response without message ids', async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    await expect(new WhatsAppService(clientWith(post)).sendText('x', 'y')).resolves.toBeUndefined();
  });

  it('sendImage posts an image message', async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    await new WhatsAppService(clientWith(post)).sendImage(
      '5531999999999',
      'http://img/1.jpg',
      'legenda',
    );
    expect(post).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '5531999999999',
      type: 'image',
      image: { link: 'http://img/1.jpg', caption: 'legenda' },
    });
  });

  it('sendProperty sends the first photo as an image when available', async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    await new WhatsAppService(clientWith(post)).sendProperty(
      '5531999999999',
      makeProperty({ photos: ['http://img/a.jpg', 'http://img/b.jpg'] }),
    );
    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      type: 'image',
      image: { link: 'http://img/a.jpg' },
    });
  });

  it('sendProperty falls back to a text message when there is no photo', async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    await new WhatsAppService(clientWith(post)).sendProperty('5531999999999', makeProperty());
    expect(post.mock.calls[0]?.[1]).toMatchObject({ type: 'text' });
  });

  it('sendProperties keeps going when one property fails', async () => {
    vi.useFakeTimers();
    const post = vi
      .fn()
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValue({ data: {} });
    const service = new WhatsAppService(clientWith(post));
    const promise = service.sendProperties('5531999999999', [
      makeProperty({ code: 'AP001' }),
      makeProperty({ code: 'AP002' }),
    ]);
    await vi.runAllTimersAsync();
    await promise;
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('markAsRead posts a read receipt', async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    await new WhatsAppService(clientWith(post)).markAsRead('wamid.1');
    expect(post).toHaveBeenCalledWith('/messages', {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.1',
    });
  });

  it('markAsRead swallows errors', async () => {
    const post = vi.fn().mockRejectedValue(new Error('nope'));
    await expect(
      new WhatsAppService(clientWith(post)).markAsRead('wamid.1'),
    ).resolves.toBeUndefined();
  });
});

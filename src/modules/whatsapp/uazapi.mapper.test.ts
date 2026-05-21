import { describe, expect, it } from 'vitest';
import type { UzapiWebhookPayload } from './uazapi.mapper';
import { isUzapiMessageEvent, extractIncomingMessageFromUzapi } from './uazapi.mapper';

function createPayload(messageOverrides: Record<string, unknown> = {}): UzapiWebhookPayload {
  return {
    EventType: 'messages',
    instanceName: 'test-instance',
    token: 'test-token',
    owner: '5531999999999',
    message: {
      messageid: 'msg-123',
      chatid: '5531999999999@s.whatsapp.net',
      sender_pn: '5531999999999@s.whatsapp.net',
      text: 'Olá!',
      fromMe: false,
      isGroup: false,
      wasSentByApi: false,
      type: 'text',
      messageTimestamp: 1700000000,
      senderName: 'João',
      ...messageOverrides,
    },
  };
}

describe('isUzapiMessageEvent', () => {
  it('returns true for a message event', () => {
    const payload = createPayload();
    expect(isUzapiMessageEvent(payload)).toBe(true);
  });

  it('returns false for other event types', () => {
    expect(isUzapiMessageEvent({ EventType: 'connection' } as UzapiWebhookPayload)).toBe(false);
    expect(isUzapiMessageEvent({ EventType: 'ack' } as UzapiWebhookPayload)).toBe(false);
    expect(isUzapiMessageEvent({} as UzapiWebhookPayload)).toBe(false);
  });

  it('returns false for undefined EventType', () => {
    expect(isUzapiMessageEvent({ message: { messageid: '123' } } as UzapiWebhookPayload)).toBe(false);
  });
});

describe('extractIncomingMessageFromUzapi', () => {
  it('extracts a valid incoming message', () => {
    const payload = createPayload();
    const msg = extractIncomingMessageFromUzapi(payload);

    expect(msg).not.toBeNull();
    expect(msg?.messageId).toBe('msg-123');
    expect(msg?.from).toBe('5531999999999');
    expect(msg?.text).toBe('Olá!');
    expect(msg?.contactName).toBe('João');
    expect(msg?.type).toBe('text');
  });

  it('strips @s.whatsapp.net suffix from sender_pn', () => {
    const payload = createPayload({
      sender_pn: '5531999999999@s.whatsapp.net',
      chatid: '5531999999999@s.whatsapp.net',
    });
    const msg = extractIncomingMessageFromUzapi(payload);
    expect(msg?.from).toBe('5531999999999');
  });

  it('strips @c.us suffix from sender_pn', () => {
    const payload = createPayload({
      sender_pn: '5531999999999@c.us',
      chatid: '5531999999999@c.us',
    });
    const msg = extractIncomingMessageFromUzapi(payload);
    expect(msg?.from).toBe('5531999999999');
  });

  it('returns null when messageid is missing', () => {
    const payload = createPayload({
      messageid: undefined,
      sender_pn: '5531999999999@s.whatsapp.net',
    });
    expect(extractIncomingMessageFromUzapi(payload)).toBeNull();
  });

  it('returns null when message is from the user (fromMe=true)', () => {
    const payload = createPayload({
      messageid: 'msg-1',
      fromMe: true,
    });
    expect(extractIncomingMessageFromUzapi(payload)).toBeNull();
  });

  it('returns null when message is from a group', () => {
    const payload = createPayload({
      messageid: 'msg-1',
      isGroup: true,
    });
    expect(extractIncomingMessageFromUzapi(payload)).toBeNull();
  });

  it('returns null when chat is a group (via chat.wa_isGroup)', () => {
    const payload = createPayload({
      messageid: 'msg-1',
      isGroup: false,
    });
    payload.chat = { wa_isGroup: true };
    expect(extractIncomingMessageFromUzapi(payload)).toBeNull();
  });

  it('returns null when message was sent by API', () => {
    const payload = createPayload({
      messageid: 'msg-1',
      wasSentByApi: true,
    });
    expect(extractIncomingMessageFromUzapi(payload)).toBeNull();
  });

  it('uses text field when available', () => {
    const payload = createPayload({
      text: 'Via text',
    });
    const msg = extractIncomingMessageFromUzapi(payload);
    expect(msg?.text).toBe('Via text');
  });

  it('falls back to content field when text is missing', () => {
    const payload = createPayload({
      text: undefined,
      content: 'Via content',
    });
    const msg = extractIncomingMessageFromUzapi(payload);
    expect(msg?.text).toBe('Via content');
  });

  it('defaults text to empty string when both text and content are missing', () => {
    const payload = createPayload({
      text: undefined,
      content: undefined,
    });
    const msg = extractIncomingMessageFromUzapi(payload);
    expect(msg?.text).toBe('');
  });

  it('prefers sender_pn over chatid for extracting the from field', () => {
    const payload = createPayload({
      messageid: 'msg-1',
      sender_pn: '5531111111111@s.whatsapp.net',
      chatid: '5531999999999@s.whatsapp.net',
    });
    const msg = extractIncomingMessageFromUzapi(payload);
    expect(msg?.from).toBe('5531111111111');
  });

  it('falls back to chatid when sender_pn is missing', () => {
    const payload = createPayload({
      messageid: 'msg-1',
      sender_pn: undefined,
      chatid: '5531999999999@s.whatsapp.net',
    });
    const msg = extractIncomingMessageFromUzapi(payload);
    expect(msg?.from).toBe('5531999999999');
  });

  it('returns null when neither sender_pn nor chatid is provided', () => {
    const payload = createPayload({
      messageid: 'msg-1',
      sender_pn: undefined,
      chatid: undefined,
    });
    expect(extractIncomingMessageFromUzapi(payload)).toBeNull();
  });

  it('defaults contactName to empty string when senderName is missing', () => {
    const payload = createPayload({
      messageid: 'msg-1',
      senderName: undefined,
    });
    const msg = extractIncomingMessageFromUzapi(payload);
    expect(msg?.contactName).toBe('');
  });

  it('uses current timestamp when messageTimestamp is missing', () => {
    const payload = createPayload({
      messageid: 'msg-1',
      messageTimestamp: undefined,
    });
    const msg = extractIncomingMessageFromUzapi(payload);
    expect(msg?.timestamp).toBeDefined();
    expect(Number(msg?.timestamp)).toBeGreaterThan(0);
  });
});

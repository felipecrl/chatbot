import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { config } from '../config';
import type { ChatService } from '../modules/chat/chat.service';
import { createApp } from './app';

const { mockCheckDbHealth } = vi.hoisted(() => ({
  mockCheckDbHealth: vi.fn<() => Promise<boolean>>(),
}));

vi.mock('../db/prisma', () => ({
  prisma: {},
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
  logPrismaError: vi.fn(),
  logPrismaWarning: vi.fn(),
  checkDatabaseHealth: mockCheckDbHealth,
}));

function makeApp() {
  const handleIncomingMessage = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue();
  const chatService = { handleIncomingMessage } as unknown as ChatService;
  return { app: createApp({ chatService }), handleIncomingMessage };
}

const VERIFY_TOKEN = config.whatsapp.verifyToken;

beforeEach(() => {
  mockCheckDbHealth.mockReset();
  mockCheckDbHealth.mockResolvedValue(true);
});

afterEach(() => {
  (config as unknown as { openai: { useMock: boolean } }).openai.useMock = true;
  (config as unknown as { imoview: { enabled: boolean } }).imoview.enabled = false;
  (config as unknown as { whatsappProvider: string }).whatsappProvider = 'uazapi';
});

describe('GET /', () => {
  it('returns the service identity', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'whatsapp-chatbot-imobiliaria', status: 'ok' });
  });
});

describe('GET /health', () => {
  it('returns 200 and healthy status when the database is reachable', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'healthy',
      services: { database: 'ok', whatsapp: 'configured', openai: 'mock' },
    });
    expect(res.body.services.imoview).toBe('not_configured');
  });

  it('returns 503 and degraded status when the database is down', async () => {
    mockCheckDbHealth.mockResolvedValue(false);
    const { app } = makeApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', services: { database: 'error' } });
  });

  it('reflects configured integrations', async () => {
    (config as unknown as { openai: { useMock: boolean } }).openai.useMock = false;
    (config as unknown as { imoview: { enabled: boolean } }).imoview.enabled = true;
    const { app } = makeApp();
    const res = await request(app).get('/health');
    expect(res.body.services).toMatchObject({
      openai: 'configured',
      imoview: 'configured',
    });
  });

  it('surfaces a 500 through the error handler when the health probe throws', async () => {
    mockCheckDbHealth.mockRejectedValue(new Error('db exploded'));
    const { app } = makeApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Erro interno do servidor' });
  });
});

describe('GET /webhook (verification handshake — Meta provider)', () => {
  beforeEach(() => {
    (config as unknown as { whatsappProvider: string }).whatsappProvider = 'meta';
  });

  it('echoes the challenge when the token matches', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': '12345',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('rejects a wrong token', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .get('/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '12345' });
    expect(res.status).toBe(403);
  });
});

describe('GET /webhook (uazapi provider — no handshake route)', () => {
  beforeEach(() => {
    (config as unknown as { whatsappProvider: string }).whatsappProvider = 'uazapi';
  });

  it('returns 404 (uazapi does not use GET handshake)', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': '12345',
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /webhook (inbound messages — Meta provider)', () => {
  beforeEach(() => {
    (config as unknown as { whatsappProvider: string }).whatsappProvider = 'meta';
  });

  const messagePayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: 'João' }, wa_id: '5531999999999' }],
              messages: [
                {
                  id: 'wamid.1',
                  from: '5531999999999',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: 'Olá' },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  it('acknowledges and dispatches the message to the chat service', async () => {
    const { app, handleIncomingMessage } = makeApp();
    const res = await request(app).post('/webhook').send(messagePayload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'received' });
    await new Promise((r) => setImmediate(r));
    expect(handleIncomingMessage).toHaveBeenCalledWith(
      expect.objectContaining({ from: '5531999999999', text: 'Olá' }),
    );
  });

  it('ignores payloads that are not from a WhatsApp business account', async () => {
    const { app, handleIncomingMessage } = makeApp();
    await request(app).post('/webhook').send({ object: 'page' });
    await new Promise((r) => setImmediate(r));
    expect(handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('ignores payloads without an extractable message', async () => {
    const { app, handleIncomingMessage } = makeApp();
    await request(app)
      .post('/webhook')
      .send({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {} }] }] });
    await new Promise((r) => setImmediate(r));
    expect(handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('swallows downstream processing failures', async () => {
    const { app, handleIncomingMessage } = makeApp();
    handleIncomingMessage.mockRejectedValueOnce(new Error('processing failed'));
    const res = await request(app).post('/webhook').send(messagePayload);
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));
    expect(handleIncomingMessage).toHaveBeenCalledOnce();
  });
});

describe('POST /webhook (inbound messages — uazapi provider)', () => {
  beforeEach(() => {
    (config as unknown as { whatsappProvider: string }).whatsappProvider = 'uazapi';
  });

  const uzapiPayload = {
    EventType: 'messages',
    instanceName: 'chatbot-dev',
    message: {
      messageid: 'msg-123',
      chatid: '5531999999999@s.whatsapp.net',
      sender_pn: '5531999999999@s.whatsapp.net',
      text: 'Olá',
      fromMe: false,
      isGroup: false,
      wasSentByApi: false,
      messageTimestamp: 1700000000,
      senderName: 'João',
    },
  };

  it('acknowledges and dispatches the message to the chat service', async () => {
    const { app, handleIncomingMessage } = makeApp();
    const res = await request(app).post('/webhook').send(uzapiPayload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'received' });
    await new Promise((r) => setImmediate(r));
    expect(handleIncomingMessage).toHaveBeenCalledWith(
      expect.objectContaining({ from: '5531999999999', text: 'Olá' }),
    );
  });

  it('ignores payloads with wrong EventType', async () => {
    const { app, handleIncomingMessage } = makeApp();
    await request(app).post('/webhook').send({ EventType: 'status' });
    await new Promise((r) => setImmediate(r));
    expect(handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('ignores outgoing messages (fromMe=true)', async () => {
    const { app, handleIncomingMessage } = makeApp();
    await request(app)
      .post('/webhook')
      .send({ ...uzapiPayload, message: { ...uzapiPayload.message, fromMe: true } });
    await new Promise((r) => setImmediate(r));
    expect(handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('ignores group messages', async () => {
    const { app, handleIncomingMessage } = makeApp();
    await request(app)
      .post('/webhook')
      .send({ ...uzapiPayload, message: { ...uzapiPayload.message, isGroup: true } });
    await new Promise((r) => setImmediate(r));
    expect(handleIncomingMessage).not.toHaveBeenCalled();
  });
});

describe('unknown routes', () => {
  it('returns 404', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Recurso não encontrado' });
  });
});

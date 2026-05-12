import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as ConfigModule from './config';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('./config');
  vi.doUnmock('./modules/ai/openai.service');
});

describe('createContainer', () => {
  it('wires every service together (mock AI by default)', async () => {
    const { createContainer } = await import('./container');
    const container = createContainer();

    expect(container.conversations).toBeDefined();
    expect(container.leads).toBeDefined();
    expect(container.properties).toBeDefined();
    expect(container.whatsapp).toBeDefined();
    expect(container.crm).toBeDefined();
    expect(container.chat).toBeDefined();
    expect(container.ai.constructor.name).toBe('MockAiService');
    expect(typeof container.ai.chat).toBe('function');
  });

  it('uses OpenAiService when mock mode is disabled', async () => {
    vi.resetModules();
    vi.doMock('./config', async () => {
      const actual = await vi.importActual<typeof ConfigModule>('./config');
      return {
        ...actual,
        config: {
          ...actual.config,
          openai: { ...actual.config.openai, useMock: false, apiKey: 'sk-test' },
        },
      };
    });
    const openAiInstance = { chat: vi.fn() };
    const OpenAiServiceMock = vi.fn(() => openAiInstance);
    vi.doMock('./modules/ai/openai.service', () => ({ OpenAiService: OpenAiServiceMock }));

    const { createContainer } = await import('./container');
    const container = createContainer();

    expect(OpenAiServiceMock).toHaveBeenCalledOnce();
    expect(container.ai).toBe(openAiInstance);
  });
});

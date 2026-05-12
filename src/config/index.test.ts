import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadConfigWith(envOverrides: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(envOverrides)) vi.stubEnv(key, value);
  const mod = await import('./index');
  return mod.config;
}

describe('config', () => {
  it('exposes the test environment by default', async () => {
    const { config } = await import('./index');
    expect(config.env).toBe('test');
    expect(config.isTest).toBe(true);
    expect(config.isProduction).toBe(false);
    expect(config.chatbot.historyWindowSize).toBe(20);
    expect(config.whatsapp.baseUrl).toContain('graph.facebook.com');
  });

  it('derives a debug log level outside production', async () => {
    const config = await loadConfigWith({ NODE_ENV: 'development' });
    expect(config.logging.level).toBe('debug');
    expect(config.isProduction).toBe(false);
  });

  it('derives an info log level in production', async () => {
    const config = await loadConfigWith({ NODE_ENV: 'production' });
    expect(config.isProduction).toBe(true);
    expect(config.logging.level).toBe('info');
  });

  it('honours an explicit LOG_LEVEL', async () => {
    const config = await loadConfigWith({ NODE_ENV: 'production', LOG_LEVEL: 'warn' });
    expect(config.logging.level).toBe('warn');
  });

  it('flags integrations as enabled only when fully configured', async () => {
    const config = await loadConfigWith({
      SR_PROPRIETARIO_API_URL: 'https://sr.example.com',
      SR_PROPRIETARIO_API_KEY: 'k',
      IMOVIEW_API_URL: 'https://crm.example.com',
      IMOVIEW_API_KEY: 'k',
    });
    expect(config.srProprietario.enabled).toBe(true);
    expect(config.imoview.enabled).toBe(true);
  });

  it('flags integrations as disabled when partially configured', async () => {
    const config = await loadConfigWith({ SR_PROPRIETARIO_API_URL: 'https://sr.example.com' });
    expect(config.srProprietario.enabled).toBe(false);
    expect(config.imoview.enabled).toBe(false);
  });
});

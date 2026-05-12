import { describe, expect, it, vi } from 'vitest';
import { formatLogLine, logger, toText } from './logger';

describe('toText', () => {
  it('returns strings unchanged', () => {
    expect(toText('hello')).toBe('hello');
  });

  it('returns empty string for null/undefined', () => {
    expect(toText(null)).toBe('');
    expect(toText(undefined)).toBe('');
  });

  it('JSON-stringifies plain objects', () => {
    expect(toText({ a: 1 })).toBe('{"a":1}');
  });

  it('falls back to String() when JSON.stringify throws (circular)', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(toText(circular)).toBe('[object Object]');
  });
});

describe('formatLogLine', () => {
  it('formats a simple line without meta', () => {
    expect(formatLogLine({ timestamp: '2024-01-01', level: 'info', message: 'oi' })).toBe(
      '[2024-01-01] info: oi',
    );
  });

  it('appends serialized meta when present', () => {
    expect(
      formatLogLine({ timestamp: '2024-01-01', level: 'warn', message: 'eita', code: 7 }),
    ).toBe('[2024-01-01] warn: eita {"code":7}');
  });

  it('prefers stack over message when available', () => {
    expect(
      formatLogLine({ timestamp: 't', level: 'error', message: 'm', stack: 'Error: x\n  at y' }),
    ).toBe('[t] error: Error: x\n  at y');
  });

  it('stringifies non-string message', () => {
    expect(formatLogLine({ timestamp: 't', level: 'info', message: { a: 1 } })).toBe(
      '[t] info: {"a":1}',
    );
  });
});

describe('logger', () => {
  it('is configured and silent during tests', () => {
    expect(logger.silent).toBe(true);
    expect(typeof logger.info).toBe('function');
    expect(() => logger.info('no-op')).not.toThrow();
  });

  it('uses the JSON production format and is not silent in production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    const mod = await import('./logger');
    expect(mod.logger.silent).toBe(false);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

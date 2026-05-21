import { describe, expect, it } from 'vitest';
import { envSchema, loadEnv } from './env';

const baseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  WHATSAPP_ACCESS_TOKEN: 'token',
  WHATSAPP_PHONE_NUMBER_ID: 'phone',
  WHATSAPP_VERIFY_TOKEN: 'verify',
};

describe('envSchema', () => {
  it('applies defaults for optional fields', () => {
    const parsed = envSchema.parse(baseEnv);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(3000);
    expect(parsed.WHATSAPP_API_VERSION).toBe('v20.0');
    expect(parsed.OPENAI_MODEL).toBe('gpt-4o');
    expect(parsed.SKIP_WHATSAPP_SEND).toBe(false);
    expect(parsed.EMPRESA_NOME).toBe('Imobiliária');
    expect(parsed.MAX_IMOVEIS_POR_RESPOSTA).toBe(3);
  });

  it('defaults USE_MOCK_AI to true when no OPENAI_API_KEY', () => {
    expect(envSchema.parse(baseEnv).USE_MOCK_AI).toBe(true);
  });

  it('defaults USE_MOCK_AI to false when OPENAI_API_KEY is set', () => {
    expect(envSchema.parse({ ...baseEnv, OPENAI_API_KEY: 'sk-x' }).USE_MOCK_AI).toBe(false);
  });

  it('honours an explicit USE_MOCK_AI string', () => {
    expect(envSchema.parse({ ...baseEnv, USE_MOCK_AI: 'true' }).USE_MOCK_AI).toBe(true);
    expect(
      envSchema.parse({ ...baseEnv, OPENAI_API_KEY: 'sk-x', USE_MOCK_AI: 'FALSE' }).USE_MOCK_AI,
    ).toBe(false);
  });

  it('honours an explicit USE_MOCK_AI boolean', () => {
    const parsed = envSchema.parse({ ...baseEnv, USE_MOCK_AI: true });
    expect(parsed.USE_MOCK_AI).toBe(true);
  });

  it('coerces SKIP_WHATSAPP_SEND string', () => {
    expect(envSchema.parse({ ...baseEnv, SKIP_WHATSAPP_SEND: 'true' }).SKIP_WHATSAPP_SEND).toBe(
      true,
    );
  });

  it('rejects a missing required field', () => {
    const result = envSchema.safeParse({ ...baseEnv, DATABASE_URL: undefined });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid DATABASE_URL', () => {
    const result = envSchema.safeParse({ ...baseEnv, DATABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('requires OPENAI_API_KEY when USE_MOCK_AI is false (superRefine)', () => {
    const result = envSchema.safeParse({ ...baseEnv, USE_MOCK_AI: 'false' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('OPENAI_API_KEY'))).toBe(true);
    }
  });

  it('starts without WhatsApp credentials when SKIP_WHATSAPP_SEND=true', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      SKIP_WHATSAPP_SEND: 'true',
      USE_MOCK_AI: 'true',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.WHATSAPP_ACCESS_TOKEN).toBe('');
      expect(result.data.WHATSAPP_VERIFY_TOKEN).toBe('local-dev');
    }
  });

  it('requires WhatsApp credentials when SKIP_WHATSAPP_SEND is false', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      SKIP_WHATSAPP_SEND: 'false',
      USE_MOCK_AI: 'true',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.flatMap((i) => i.path);
      expect(paths).toContain('WHATSAPP_ACCESS_TOKEN');
      expect(paths).toContain('WHATSAPP_PHONE_NUMBER_ID');
    }
  });
});

describe('loadEnv', () => {
  it('returns parsed env for a valid source', () => {
    const env = loadEnv({ ...baseEnv });
    expect(env.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
  });

  it('throws a descriptive error for invalid configuration', () => {
    expect(() => loadEnv({ ...baseEnv, DATABASE_URL: 'nope' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('lists the offending paths in the error message', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('labels root-level issues as (root)', () => {
    expect(() => loadEnv(null as unknown as NodeJS.ProcessEnv)).toThrow(/\(root\)/);
  });
});

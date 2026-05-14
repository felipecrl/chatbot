import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === 'boolean' ? value : value.toLowerCase() === 'true'));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).optional(),

    // Database
    DATABASE_URL: z.string().url(),

    // WhatsApp / Meta Cloud API
    // Credentials are required only when SKIP_WHATSAPP_SEND=false (validated in superRefine).
    // In local dev with SKIP_WHATSAPP_SEND=true, placeholder values are accepted.
    WHATSAPP_ACCESS_TOKEN: z.string().default(''),
    WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
    WHATSAPP_VERIFY_TOKEN: z.string().default('local-dev'),
    WHATSAPP_API_VERSION: z.string().default('v20.0'),
    WHATSAPP_APP_SECRET: z.string().optional(),

    // OpenAI
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default('gpt-4o'),

    // IMOVIEW (catálogo de imóveis + CRM)
    IMOVIEW_API_URL: z.string().url().optional(),
    IMOVIEW_API_KEY: z.string().optional(),
    IMOVIEW_EMPRESA_ID: z.string().optional(),

    // Behaviour toggles (mostly for local testing)
    USE_MOCK_AI: booleanFromString.optional(),
    SKIP_WHATSAPP_SEND: booleanFromString.default(false),
    TOPIC_GUARD_ENABLED: booleanFromString.default(true),

    // Chatbot config
    EMPRESA_NOME: z.string().default('Imobiliária'),
    EMPRESA_CIDADE: z.string().default('Belo Horizonte'),
    MAX_IMOVEIS_POR_RESPOSTA: z.coerce.number().int().positive().default(3),
    CONVERSA_TIMEOUT_MINUTOS: z.coerce.number().int().positive().default(60),
    CONVERSATION_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  })
  .transform((env) => ({
    ...env,
    USE_MOCK_AI: env.USE_MOCK_AI ?? !env.OPENAI_API_KEY,
  }))
  .superRefine((env, ctx) => {
    if (!env.USE_MOCK_AI && !env.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OPENAI_API_KEY'],
        message: 'OPENAI_API_KEY is required unless USE_MOCK_AI=true',
      });
    }
    if (!env.SKIP_WHATSAPP_SEND) {
      if (!env.WHATSAPP_ACCESS_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['WHATSAPP_ACCESS_TOKEN'],
          message: 'WHATSAPP_ACCESS_TOKEN is required unless SKIP_WHATSAPP_SEND=true',
        });
      }
      if (!env.WHATSAPP_PHONE_NUMBER_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['WHATSAPP_PHONE_NUMBER_ID'],
          message: 'WHATSAPP_PHONE_NUMBER_ID is required unless SKIP_WHATSAPP_SEND=true',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export { envSchema };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

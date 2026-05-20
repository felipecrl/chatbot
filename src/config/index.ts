import { env } from './env';

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
  },

  logging: {
    level: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  },

  database: {
    url: env.DATABASE_URL,
  },

  whatsappProvider: env.WHATSAPP_PROVIDER,

  whatsapp: {
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN,
    apiVersion: env.WHATSAPP_API_VERSION,
    appSecret: env.WHATSAPP_APP_SECRET,
    baseUrl: `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}`,
    skipSend: env.SKIP_WHATSAPP_SEND,
  },

  uazapi: {
    baseUrl: env.UAZAPI_BASE_URL ?? 'https://free.uazapi.com',
    instanceToken: env.UAZAPI_INSTANCE_TOKEN ?? '',
  },

  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    useMock: env.USE_MOCK_AI,
  },

  imoview: {
    apiUrl: env.IMOVIEW_API_URL,
    apiKey: env.IMOVIEW_API_KEY,
    empresaId: env.IMOVIEW_EMPRESA_ID,
    enabled: Boolean(env.IMOVIEW_API_URL && env.IMOVIEW_API_KEY),
  },

  chatbot: {
    companyName: env.EMPRESA_NOME,
    companyCity: env.EMPRESA_CIDADE,
    maxPropertiesPerReply: env.MAX_IMOVEIS_POR_RESPOSTA,
    conversationTimeoutMinutes: env.CONVERSA_TIMEOUT_MINUTOS,
    conversationCleanupIntervalMinutes: env.CONVERSATION_CLEANUP_INTERVAL_MINUTES,
    historyWindowSize: 20,
    topicGuardEnabled: env.TOPIC_GUARD_ENABLED,
  },
} as const;

export type AppConfig = typeof config;

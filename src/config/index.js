require('dotenv').config();

const config = {
  server: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    useMockGPT: process.env.USE_MOCK_GPT === 'true' || !process.env.OPENAI_API_KEY,
    skipWhatsappSend: process.env.SKIP_WHATSAPP_SEND === 'true',
  },
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
    apiUrl: `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v20.0'}`,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },
  srProprietario: {
    apiUrl: process.env.SR_PROPRIETARIO_API_URL,
    apiKey: process.env.SR_PROPRIETARIO_API_KEY,
  },
  imoview: {
    apiUrl: process.env.IMOVIEW_API_URL,
    apiKey: process.env.IMOVIEW_API_KEY,
    empresaId: process.env.IMOVIEW_EMPRESA_ID,
  },
  database: {
    connectionString: process.env.DATABASE_URL,
  },
  chatbot: {
    empresaNome: process.env.EMPRESA_NOME || 'Imobiliária',
    empresaCidade: process.env.EMPRESA_CIDADE || 'Belo Horizonte',
    maxImoveisPorResposta: parseInt(process.env.MAX_IMOVEIS_POR_RESPOSTA) || 3,
    conversaTimeoutMinutos: parseInt(process.env.CONVERSA_TIMEOUT_MINUTOS) || 60,
  },
};

function validateConfig() {
  const required = [
    ['WHATSAPP_ACCESS_TOKEN', config.whatsapp.accessToken],
    ['WHATSAPP_PHONE_NUMBER_ID', config.whatsapp.phoneNumberId],
    ['WHATSAPP_VERIFY_TOKEN', config.whatsapp.verifyToken],
    ['OPENAI_API_KEY', config.openai.apiKey],
    ['DATABASE_URL', config.database.connectionString],
  ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias não configuradas: ${missing.join(', ')}`);
  }
}

module.exports = { config, validateConfig };

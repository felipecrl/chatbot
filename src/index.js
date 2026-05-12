require('dotenv').config();

const express = require('express');
const { config, validateConfig } = require('./config');
const { runMigrations } = require('./database/migrations');
const { clearOldConversations } = require('./models/conversation');
const webhookRouter = require('./routes/webhook');
const healthRouter = require('./routes/health');
const logger = require('./utils/logger');

async function bootstrap() {
  validateConfig();

  await runMigrations();

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/webhook', webhookRouter);
  app.use('/health', healthRouter);

  app.use((err, req, res, next) => {
    logger.error('Erro não tratado', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Erro interno do servidor' });
  });

  app.listen(config.server.port, () => {
    logger.info(`Servidor iniciado na porta ${config.server.port}`, {
      env: config.server.nodeEnv,
      empresa: config.chatbot.empresaNome,
    });
  });

  // Limpa conversas inativas a cada hora
  setInterval(
    () => clearOldConversations(config.chatbot.conversaTimeoutMinutos),
    60 * 60 * 1000
  );
}

bootstrap().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err.message);
  process.exit(1);
});

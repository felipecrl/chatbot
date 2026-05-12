import type { Server } from 'node:http';
import { config } from './config';
import { createContainer } from './container';
import { connectDatabase, disconnectDatabase } from './db/prisma';
import { createApp } from './http/app';
import { toErrorMeta } from './lib/errors';
import { logger } from './lib/logger';

const SHUTDOWN_TIMEOUT_MS = 10_000;

export async function startServer(): Promise<Server> {
  await connectDatabase();

  const container = createContainer();
  const app = createApp({ chatService: container.chat });

  const server = app.listen(config.server.port, () => {
    logger.info(`Servidor ouvindo na porta ${config.server.port}`, {
      env: config.env,
      company: config.chatbot.companyName,
      aiMode: config.openai.useMock ? 'mock' : config.openai.model,
    });
  });

  const cleanupTimer = startConversationCleanupJob(container);
  registerShutdownHandlers(server, cleanupTimer);

  return server;
}

function startConversationCleanupJob(
  container: ReturnType<typeof createContainer>,
): NodeJS.Timeout {
  const intervalMs = config.chatbot.conversationCleanupIntervalMinutes * 60_000;
  const timer = setInterval(() => {
    container.conversations
      .closeIdleConversations(config.chatbot.conversationTimeoutMinutes)
      .then((count) => {
        if (count > 0) logger.info('Conversas inativas encerradas', { count });
      })
      .catch((error: unknown) =>
        logger.error('Falha ao encerrar conversas inativas', toErrorMeta(error)),
      );
  }, intervalMs);
  timer.unref();
  return timer;
}

function registerShutdownHandlers(server: Server, cleanupTimer: NodeJS.Timeout): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Recebido ${signal}, encerrando graciosamente…`);

    const forceExit = setTimeout(() => {
      logger.error('Encerramento forçado: timeout excedido');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    clearInterval(cleanupTimer);
    server.close((err) => {
      if (err) logger.error('Erro ao fechar o servidor HTTP', toErrorMeta(err));
      disconnectDatabase()
        .catch((error: unknown) => logger.error('Erro ao desconectar do banco', toErrorMeta(error)))
        .finally(() => process.exit(err ? 1 : 0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', toErrorMeta(reason));
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', toErrorMeta(error));
    shutdown('uncaughtException');
  });
}

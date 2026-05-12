import { logger } from './lib/logger';
import { startServer } from './server';

startServer().catch((error: unknown) => {
  logger.error('Falha ao iniciar a aplicação', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

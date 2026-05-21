import { Router } from 'express';
import { config } from '../../config';
import { checkDatabaseHealth } from '../../db/prisma';
import { asyncHandler } from '../middlewares/async-handler';

export function healthRoutes(): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const databaseOk = await checkDatabaseHealth();
      res.status(databaseOk ? 200 : 503).json({
        status: databaseOk ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        env: config.env,
        services: {
          database: databaseOk ? 'ok' : 'error',
          whatsapp: 'configured',
          openai: config.openai.useMock ? 'mock' : 'configured',
          imoview: config.imoview.enabled ? 'configured' : 'not_configured',
        },
      });
    }),
  );

  return router;
}

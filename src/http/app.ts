import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { requestLogger } from './middlewares/request-logger';
import { buildRoutes, type RouteDeps } from './routes';

const JSON_BODY_LIMIT = '1mb';

export function createApp(deps: RouteDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    express.json({
      limit: JSON_BODY_LIMIT,
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(requestLogger);

  app.get('/', (_req, res) => {
    res.json({ name: 'whatsapp-chatbot-imobiliaria', status: 'ok' });
  });
  app.use(buildRoutes(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

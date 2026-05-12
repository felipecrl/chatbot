import type { ErrorRequestHandler, RequestHandler } from 'express';
import { config } from '../../config';
import { isAppError, toErrorMeta } from '../../lib/errors';
import { logger } from '../../lib/logger';

const log = logger.child({ module: 'http' });

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: 'Recurso não encontrado', path: req.originalUrl });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (isAppError(err) && err.isOperational) {
    if (err.statusCode >= 500) {
      log.error('Erro operacional', { path: req.originalUrl, ...toErrorMeta(err) });
    } else {
      log.warn('Requisição rejeitada', {
        path: req.originalUrl,
        statusCode: err.statusCode,
        message: err.message,
      });
    }
    res
      .status(err.statusCode)
      .json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }

  log.error('Erro não tratado', { path: req.originalUrl, ...toErrorMeta(err) });
  res.status(500).json({
    error: 'Erro interno do servidor',
    ...(config.isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
  });
};

import type { RequestHandler } from 'express';
import { logger } from '../../lib/logger';

const log = logger.child({ module: 'http' });

/** Logs each HTTP request with method, path, status code and latency. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    log.http('request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });
  next();
};

import type { RequestHandler } from 'express';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { verifyWebhookSignature } from '../../modules/whatsapp/whatsapp.signature';

const log = logger.child({ module: 'http' });

/**
 * Validates the `X-Hub-Signature-256` header on incoming WhatsApp webhooks.
 * No-op when `WHATSAPP_APP_SECRET` is not configured (e.g. local development).
 */
export const verifyWhatsAppSignature: RequestHandler = (req, res, next) => {
  const appSecret = config.whatsapp.appSecret;
  if (!appSecret) {
    next();
    return;
  }

  const signature = req.header('x-hub-signature-256') ?? undefined;
  if (!req.rawBody || !verifyWebhookSignature(req.rawBody, signature, appSecret)) {
    log.warn('Assinatura de webhook inválida', { ip: req.ip });
    res.status(401).json({ error: 'Assinatura inválida' });
    return;
  }

  next();
};

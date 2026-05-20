import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { toErrorMeta } from '../../lib/errors';
import type { ChatService } from '../../modules/chat/chat.service';
import {
  extractIncomingMessageFromUzapi,
  isUzapiMessageEvent,
} from '../../modules/whatsapp/uazapi.mapper';
import { extractIncomingMessage } from '../../modules/whatsapp/whatsapp.mapper';
import type { WhatsAppWebhookPayload } from '../../modules/whatsapp/whatsapp.types';
import { verifyWhatsAppSignature } from '../middlewares/verify-whatsapp-signature';

const log = logger.child({ module: 'webhook' });

export function webhookRoutes(chatService: ChatService): Router {
  const router = Router();
  const isUzapi = config.whatsappProvider === 'uazapi';

  // Webhook verification handshake — only used by Meta Cloud API.
  if (!isUzapi) {
    router.get('/', (req, res) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (
        mode === 'subscribe' &&
        token === config.whatsapp.verifyToken &&
        typeof challenge === 'string'
      ) {
        log.info('Webhook verificado pela Meta');
        res.status(200).send(challenge);
        return;
      }

      log.warn('Falha na verificação do webhook (token inválido)');
      res.status(403).json({ error: 'Token de verificação inválido' });
    });
  }

  // Inbound messages. We acknowledge immediately and process asynchronously so
  // the provider does not retry; processing failures are logged, never surfaced.
  const authMiddleware = isUzapi
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : verifyWhatsAppSignature;

  router.post('/', authMiddleware, (req, res) => {
    res.status(200).json({ status: 'received' });

    let message;
    if (isUzapi) {
      if (!isUzapiMessageEvent(req.body)) return;
      message = extractIncomingMessageFromUzapi(req.body);
    } else {
      const payload = req.body as WhatsAppWebhookPayload;
      if (payload.object !== 'whatsapp_business_account') return;
      message = extractIncomingMessage(payload);
    }

    if (!message) return;

    void chatService.handleIncomingMessage(message).catch((error: unknown) => {
      log.error('Falha ao processar mensagem recebida', {
        from: message.from,
        ...toErrorMeta(error),
      });
    });
  });

  return router;
}

import { Router } from 'express';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { toErrorMeta } from '../../lib/errors';
import type { ChatService } from '../../modules/chat/chat.service';
import { extractIncomingMessage } from '../../modules/whatsapp/whatsapp.mapper';
import type { WhatsAppWebhookPayload } from '../../modules/whatsapp/whatsapp.types';
import { verifyWhatsAppSignature } from '../middlewares/verify-whatsapp-signature';

const log = logger.child({ module: 'webhook' });

export function webhookRoutes(chatService: ChatService): Router {
  const router = Router();

  // Webhook verification handshake (Meta sends this once when subscribing).
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

  // Inbound messages. We acknowledge immediately and process asynchronously so
  // Meta does not retry; processing failures are logged, never surfaced.
  router.post('/', verifyWhatsAppSignature, (req, res) => {
    res.status(200).json({ status: 'received' });

    const payload = req.body as WhatsAppWebhookPayload;
    if (payload.object !== 'whatsapp_business_account') return;

    const message = extractIncomingMessage(payload);
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

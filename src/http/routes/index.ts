import { Router } from 'express';
import type { ChatService } from '../../modules/chat/chat.service';
import { healthRoutes } from './health.routes';
import { webhookRoutes } from './webhook.routes';

export interface RouteDeps {
  chatService: ChatService;
}

export function buildRoutes(deps: RouteDeps): Router {
  const router = Router();
  router.use('/health', healthRoutes());
  router.use('/webhook', webhookRoutes(deps.chatService));
  return router;
}

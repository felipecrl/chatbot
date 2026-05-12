import type { AxiosInstance } from 'axios';
import { config } from '../../config';
import { createHttpClient } from '../../lib/http-client';
import { toErrorMeta } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { Property } from '../properties/property.types';
import { formatPropertyMessage } from './whatsapp.mapper';

const log = logger.child({ module: 'whatsapp' });

const SEND_INTERVAL_MS = 500;

interface SendMessageResponse {
  messages?: Array<{ id?: string }>;
}

/** Thin client over the Meta Cloud API for sending outbound WhatsApp messages. */
export class WhatsAppService {
  private readonly client: AxiosInstance;
  private readonly skipSend: boolean;

  constructor(client?: AxiosInstance) {
    this.skipSend = config.whatsapp.skipSend;
    this.client =
      client ??
      createHttpClient({
        serviceName: 'whatsapp',
        baseURL: config.whatsapp.baseUrl,
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
  }

  async sendText(to: string, body: string): Promise<void> {
    if (this.skipSend) {
      log.info('SKIP_WHATSAPP_SEND ativo — texto não enviado', { to, preview: body.slice(0, 100) });
      return;
    }
    const { data } = await this.client.post<SendMessageResponse>('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body },
    });
    log.debug('Texto enviado', { to, messageId: data.messages?.[0]?.id });
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    if (this.skipSend) {
      log.info('SKIP_WHATSAPP_SEND ativo — imagem não enviada', { to, imageUrl });
      return;
    }
    await this.client.post<SendMessageResponse>('/messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: { link: imageUrl, caption },
    });
    log.debug('Imagem enviada', { to, imageUrl });
  }

  async sendProperty(to: string, property: Property): Promise<void> {
    const caption = formatPropertyMessage(property);
    const firstPhoto = property.photos[0];
    if (firstPhoto) {
      await this.sendImage(to, firstPhoto, caption);
    } else {
      await this.sendText(to, caption);
    }
  }

  async sendProperties(to: string, properties: Property[]): Promise<void> {
    for (const property of properties) {
      try {
        await this.sendProperty(to, property);
      } catch (error) {
        log.error('Falha ao enviar imóvel', { to, code: property.code, ...toErrorMeta(error) });
      }
      await delay(SEND_INTERVAL_MS);
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    if (this.skipSend) return;
    try {
      await this.client.post('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });
    } catch (error) {
      // Non-critical: a failed read receipt should never interrupt processing.
      log.debug('Falha ao marcar mensagem como lida', { messageId, ...toErrorMeta(error) });
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

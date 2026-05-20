import type { AxiosInstance } from 'axios';
import { config } from '../../config';
import { createHttpClient } from '../../lib/http-client';
import { toErrorMeta } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { Property } from '../properties/property.types';
import type { IWhatsAppService } from './whatsapp.types';
import { formatPropertyMessage } from './whatsapp.mapper';

const log = logger.child({ module: 'uazapi' });

const SEND_INTERVAL_MS = 1000;

/** Thin client over the uazapi REST API for sending outbound WhatsApp messages. */
export class UzapiWhatsAppService implements IWhatsAppService {
  private readonly client: AxiosInstance;
  private readonly skipSend: boolean;

  constructor(client?: AxiosInstance) {
    this.skipSend = config.whatsapp.skipSend;
    this.client =
      client ??
      createHttpClient({
        serviceName: 'uazapi',
        baseURL: config.uazapi.baseUrl,
        headers: {
          token: config.uazapi.instanceToken,
          'Content-Type': 'application/json',
        },
      });
  }

  async sendText(to: string, body: string): Promise<void> {
    if (this.skipSend) {
      log.info('SKIP_WHATSAPP_SEND ativo — texto não enviado', { to, preview: body.slice(0, 100) });
      return;
    }
    await this.client.post('/send/text', { number: stripJid(to), text: body });
    log.debug('Texto enviado via uazapi', { to });
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    if (this.skipSend) {
      log.info('SKIP_WHATSAPP_SEND ativo — imagem não enviada', { to, imageUrl });
      return;
    }
    // uazapi /send/media requires multipart file upload; fall back to a text link.
    const text = caption ? `${caption}\n${imageUrl}` : imageUrl;
    await this.client.post('/send/text', { number: stripJid(to), text });
    log.debug('Imagem enviada como link de texto via uazapi', { to, imageUrl });
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

  async markAsRead(_messageId: string): Promise<void> {}
}

function stripJid(jidOrNumber: string): string {
  return jidOrNumber.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import type { Property } from '../properties/property.types';

export type IncomingMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'unknown';

export interface IncomingMessage {
  messageId: string;
  from: string;
  timestamp: string;
  type: IncomingMessageType;
  text: string;
  contactName: string;
}

export interface IWhatsAppService {
  sendText(to: string, body: string): Promise<void>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<void>;
  sendProperty(to: string, property: Property): Promise<void>;
  sendProperties(to: string, properties: Property[]): Promise<void>;
  markAsRead(messageId: string): Promise<void>;
}

/** Minimal shape of the Meta Cloud API webhook payload that we rely on. */
export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
        }>;
        statuses?: unknown[];
      };
      field?: string;
    }>;
  }>;
}

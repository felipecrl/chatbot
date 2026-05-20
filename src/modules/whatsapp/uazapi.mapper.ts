import type { IncomingMessage } from './whatsapp.types';

/** Shape of the uazapi webhook payload for incoming messages. */
export interface UzapiWebhookPayload {
  EventType?: string;
  instanceName?: string;
  token?: string;
  owner?: string;
  message?: {
    messageid?: string;
    chatid?: string;
    sender_pn?: string;
    text?: string;
    content?: string;
    fromMe?: boolean;
    isGroup?: boolean;
    wasSentByApi?: boolean;
    type?: string;
    messageType?: string;
    messageTimestamp?: number;
    senderName?: string;
  };
  chat?: {
    wa_isGroup?: boolean;
  };
}

export function isUzapiMessageEvent(body: unknown): body is UzapiWebhookPayload {
  return (body as UzapiWebhookPayload)?.EventType === 'messages';
}

/** Extracts an incoming message from a uazapi webhook payload. */
export function extractIncomingMessageFromUzapi(
  payload: UzapiWebhookPayload,
): IncomingMessage | null {
  const msg = payload.message;
  if (!msg?.messageid) return null;
  if (msg.fromMe) return null;
  if (msg.isGroup || payload.chat?.wa_isGroup) return null;
  if (msg.wasSentByApi) return null;

  // sender_pn carries "5531XXXXX@s.whatsapp.net" — strip the suffix for internal use.
  const rawJid = msg.sender_pn ?? msg.chatid ?? '';
  const from = rawJid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
  if (!from) return null;

  const text = msg.text ?? msg.content ?? '';

  return {
    messageId: msg.messageid,
    from,
    timestamp: String(msg.messageTimestamp ?? Date.now()),
    type: 'text',
    text,
    contactName: msg.senderName ?? '',
  };
}

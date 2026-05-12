import type { Conversation } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { toErrorMeta } from '../../lib/errors';
import type { AiService, ChatMessage } from '../ai/ai.types';
import { buildSystemPrompt } from '../ai/ai.prompts';
import {
  ConversationState,
  type ConversationRepository,
} from '../conversations/conversation.repository';
import type { LeadService } from '../leads/lead.service';
import type { PropertyService } from '../properties/property.service';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';
import type { IncomingMessage } from '../whatsapp/whatsapp.types';
import { buildChatTools } from './chat.tools';

const log = logger.child({ module: 'chat' });

const FALLBACK_REPLY =
  'Desculpe, tive um problema ao processar sua mensagem. Pode tentar novamente?';

export interface ChatServiceDeps {
  conversations: ConversationRepository;
  properties: PropertyService;
  leads: LeadService;
  whatsapp: WhatsAppService;
  ai: AiService;
}

export class ChatService {
  constructor(private readonly deps: ChatServiceDeps) {}

  /** Processes one inbound WhatsApp text message end to end. */
  async handleIncomingMessage(message: IncomingMessage): Promise<void> {
    const { from, text, type, messageId, contactName } = message;

    if (type !== 'text') {
      log.debug('Tipo de mensagem não suportado — ignorando', { from, type });
      return;
    }

    log.info('Mensagem recebida', { from, preview: text.slice(0, 80) });
    await this.deps.whatsapp.markAsRead(messageId);

    const conversation = await this.deps.conversations.getOrCreate(from);

    if (conversation.state === ConversationState.TRANSFERRED) {
      log.info('Conversa em atendimento humano — mensagem ignorada', { from });
      return;
    }

    if (conversation.state === ConversationState.CLOSED) {
      await this.deps.conversations.updateState(from, ConversationState.ACTIVE);
      if (contactName) {
        await this.deps.conversations.updateClientInfo(from, { name: contactName });
      }
    }

    const updated = await this.deps.conversations.appendMessage(from, 'user', text);
    const history = this.toChatHistory(updated);

    try {
      const result = await this.deps.ai.chat({
        systemPrompt: buildSystemPrompt(),
        messages: history,
        tools: buildChatTools(this.deps, from),
      });

      if (result.usage) log.debug('Uso de tokens', result.usage);

      const reply = result.text?.trim();
      if (reply) {
        await this.deps.conversations.appendMessage(from, 'assistant', reply);
        await this.deps.whatsapp.sendText(from, reply);
      }
    } catch (error) {
      log.error('Falha ao processar mensagem com a IA', { from, ...toErrorMeta(error) });
      await this.safeSend(from, FALLBACK_REPLY);
    }
  }

  private toChatHistory(conversation: Conversation): ChatMessage[] {
    return this.deps.conversations
      .getMessages(conversation)
      .slice(-config.chatbot.historyWindowSize)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  private async safeSend(to: string, body: string): Promise<void> {
    try {
      await this.deps.whatsapp.sendText(to, body);
    } catch (error) {
      log.error('Falha ao enviar mensagem de fallback', { to, ...toErrorMeta(error) });
    }
  }
}

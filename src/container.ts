import { config } from './config';
import { prisma } from './db/prisma';
import type { AiService } from './modules/ai/ai.types';
import { MockAiService } from './modules/ai/mock-ai.service';
import { OpenAiService } from './modules/ai/openai.service';
import { ChatService } from './modules/chat/chat.service';
import { ConversationRepository } from './modules/conversations/conversation.repository';
import { CrmService } from './modules/crm/crm.service';
import { LeadRepository } from './modules/leads/lead.repository';
import { LeadService } from './modules/leads/lead.service';
import { PropertyService } from './modules/properties/property.service';
import { UzapiWhatsAppService } from './modules/whatsapp/uazapi.service';
import type { IWhatsAppService } from './modules/whatsapp/whatsapp.types';
import { WhatsAppService } from './modules/whatsapp/whatsapp.service';

export interface Container {
  conversations: ConversationRepository;
  leads: LeadService;
  properties: PropertyService;
  whatsapp: IWhatsAppService;
  crm: CrmService;
  ai: AiService;
  chat: ChatService;
}

/** Wires every service together (poor man's DI container / composition root). */
export function createContainer(): Container {
  const conversations = new ConversationRepository(prisma);
  const leadRepository = new LeadRepository(prisma);
  const crm = new CrmService();
  const leads = new LeadService(leadRepository, crm);
  const properties = new PropertyService();
  const whatsapp: IWhatsAppService =
    config.whatsappProvider === 'uazapi' ? new UzapiWhatsAppService() : new WhatsAppService();
  const ai: AiService = config.openai.useMock ? new MockAiService() : new OpenAiService();
  const chat = new ChatService({ conversations, properties, leads, whatsapp, ai });

  return { conversations, leads, properties, whatsapp, crm, ai, chat };
}

import {
  type Conversation,
  ConversationState,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import type { ChatRole, ClientInfo, StoredMessage } from './conversation.types';

export { ConversationState };

export class ConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreate(phoneNumber: string): Promise<Conversation> {
    return this.prisma.conversation.upsert({
      where: { phoneNumber },
      update: {},
      create: { phoneNumber },
    });
  }

  async findByPhone(phoneNumber: string): Promise<Conversation | null> {
    return this.prisma.conversation.findUnique({ where: { phoneNumber } });
  }

  getMessages(conversation: Conversation): StoredMessage[] {
    return parseMessages(conversation.messages);
  }

  async appendMessage(phoneNumber: string, role: ChatRole, content: string): Promise<Conversation> {
    const conversation = await this.getOrCreate(phoneNumber);
    const messages = parseMessages(conversation.messages);
    messages.push({ role, content, timestamp: new Date().toISOString() });
    return this.prisma.conversation.update({
      where: { phoneNumber },
      data: { messages: messages as unknown as Prisma.InputJsonValue },
    });
  }

  async updateState(phoneNumber: string, state: ConversationState): Promise<void> {
    await this.prisma.conversation.update({ where: { phoneNumber }, data: { state } });
  }

  async updateClientInfo(phoneNumber: string, info: ClientInfo): Promise<void> {
    await this.prisma.conversation.update({
      where: { phoneNumber },
      data: {
        ...(info.name != null ? { clientName: info.name } : {}),
        ...(info.email != null ? { clientEmail: info.email } : {}),
      },
    });
  }

  async addViewedProperty(phoneNumber: string, propertyCode: string): Promise<void> {
    const conversation = await this.getOrCreate(phoneNumber);
    const viewed = parseStringArray(conversation.viewedProperties);
    if (viewed.includes(propertyCode)) return;
    viewed.push(propertyCode);
    await this.prisma.conversation.update({
      where: { phoneNumber },
      data: { viewedProperties: viewed },
    });
  }

  /** Marks long-idle ACTIVE conversations as CLOSED. Returns the number of rows updated. */
  async closeIdleConversations(idleMinutes: number): Promise<number> {
    const threshold = new Date(Date.now() - idleMinutes * 60_000);
    const result = await this.prisma.conversation.updateMany({
      where: { state: ConversationState.ACTIVE, updatedAt: { lt: threshold } },
      data: { state: ConversationState.CLOSED },
    });
    return result.count;
  }
}

function parseMessages(value: Prisma.JsonValue): StoredMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      !Array.isArray(item) &&
      typeof (item as Record<string, unknown>).role === 'string' &&
      typeof (item as Record<string, unknown>).content === 'string',
  ) as unknown as StoredMessage[];
}

function parseStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

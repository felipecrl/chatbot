import type { Conversation, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ConversationRepository, ConversationState } from './conversation.repository';

function makePrisma() {
  return {
    conversation: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 1,
    phoneNumber: '5531999999999',
    messages: [],
    state: ConversationState.ACTIVE,
    clientName: null,
    clientEmail: null,
    viewedProperties: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function repo(prisma: ReturnType<typeof makePrisma>) {
  return new ConversationRepository(prisma as unknown as PrismaClient);
}

describe('ConversationRepository', () => {
  it('getOrCreate upserts by phone number', async () => {
    const prisma = makePrisma();
    const conv = makeConversation();
    prisma.conversation.upsert.mockResolvedValue(conv);
    await expect(repo(prisma).getOrCreate('5531999999999')).resolves.toBe(conv);
    expect(prisma.conversation.upsert).toHaveBeenCalledWith({
      where: { phoneNumber: '5531999999999' },
      update: {},
      create: { phoneNumber: '5531999999999' },
    });
  });

  it('findByPhone delegates to findUnique', async () => {
    const prisma = makePrisma();
    prisma.conversation.findUnique.mockResolvedValue(null);
    await expect(repo(prisma).findByPhone('x')).resolves.toBeNull();
    expect(prisma.conversation.findUnique).toHaveBeenCalledWith({ where: { phoneNumber: 'x' } });
  });

  describe('getMessages', () => {
    it('returns valid stored messages', () => {
      const conv = makeConversation({
        messages: [
          { role: 'user', content: 'oi', timestamp: 't1' },
          { role: 'assistant', content: 'olá', timestamp: 't2' },
        ] as unknown as Conversation['messages'],
      });
      expect(repo(makePrisma()).getMessages(conv)).toHaveLength(2);
    });

    it('filters out malformed entries', () => {
      const conv = makeConversation({
        messages: [
          { role: 'user', content: 'ok', timestamp: 't' },
          { role: 'user' },
          { content: 'missing role' },
          'a string',
          null,
          ['nested'],
          42,
        ] as unknown as Conversation['messages'],
      });
      expect(repo(makePrisma()).getMessages(conv)).toEqual([
        { role: 'user', content: 'ok', timestamp: 't' },
      ]);
    });

    it('returns an empty array when messages is not an array', () => {
      const conv = makeConversation({
        messages: { not: 'array' } as unknown as Conversation['messages'],
      });
      expect(repo(makePrisma()).getMessages(conv)).toEqual([]);
    });
  });

  it('appendMessage loads, pushes and persists', async () => {
    const prisma = makePrisma();
    const existing = makeConversation({
      messages: [
        { role: 'user', content: 'oi', timestamp: 't' },
      ] as unknown as Conversation['messages'],
    });
    prisma.conversation.upsert.mockResolvedValue(existing);
    prisma.conversation.update.mockImplementation(({ data }: { data: unknown }) =>
      makeConversation({
        messages: (data as { messages: unknown }).messages as Conversation['messages'],
      }),
    );
    const result = await repo(prisma).appendMessage('5531999999999', 'assistant', 'olá');
    const messages = result.messages as unknown as Array<{ role: string; content: string }>;
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ role: 'assistant', content: 'olá' });
    expect(prisma.conversation.update).toHaveBeenCalledOnce();
  });

  it('updateState updates the state column', async () => {
    const prisma = makePrisma();
    prisma.conversation.update.mockResolvedValue(makeConversation());
    await repo(prisma).updateState('x', ConversationState.SCHEDULED);
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { phoneNumber: 'x' },
      data: { state: ConversationState.SCHEDULED },
    });
  });

  describe('updateClientInfo', () => {
    it('writes only the provided fields', async () => {
      const prisma = makePrisma();
      prisma.conversation.update.mockResolvedValue(makeConversation());
      await repo(prisma).updateClientInfo('x', { name: 'Maria', email: 'm@e.com' });
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { phoneNumber: 'x' },
        data: { clientName: 'Maria', clientEmail: 'm@e.com' },
      });
    });

    it('writes nothing extra when fields are absent', async () => {
      const prisma = makePrisma();
      prisma.conversation.update.mockResolvedValue(makeConversation());
      await repo(prisma).updateClientInfo('x', {});
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { phoneNumber: 'x' },
        data: {},
      });
    });
  });

  describe('addViewedProperty', () => {
    it('appends a new code', async () => {
      const prisma = makePrisma();
      prisma.conversation.upsert.mockResolvedValue(
        makeConversation({ viewedProperties: ['AP001'] }),
      );
      prisma.conversation.update.mockResolvedValue(makeConversation());
      await repo(prisma).addViewedProperty('x', 'AP002');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { phoneNumber: 'x' },
        data: { viewedProperties: ['AP001', 'AP002'] },
      });
    });

    it('is a no-op when the code is already present', async () => {
      const prisma = makePrisma();
      prisma.conversation.upsert.mockResolvedValue(
        makeConversation({ viewedProperties: ['AP001'] }),
      );
      await repo(prisma).addViewedProperty('x', 'AP001');
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });

    it('handles a non-array viewedProperties column', async () => {
      const prisma = makePrisma();
      prisma.conversation.upsert.mockResolvedValue(
        makeConversation({ viewedProperties: null as unknown as Conversation['viewedProperties'] }),
      );
      prisma.conversation.update.mockResolvedValue(makeConversation());
      await repo(prisma).addViewedProperty('x', 'AP001');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { phoneNumber: 'x' },
        data: { viewedProperties: ['AP001'] },
      });
    });

    it('keeps only string entries from the column', async () => {
      const prisma = makePrisma();
      prisma.conversation.upsert.mockResolvedValue(
        makeConversation({
          viewedProperties: ['AP001', 42, null] as unknown as Conversation['viewedProperties'],
        }),
      );
      prisma.conversation.update.mockResolvedValue(makeConversation());
      await repo(prisma).addViewedProperty('x', 'AP002');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { phoneNumber: 'x' },
        data: { viewedProperties: ['AP001', 'AP002'] },
      });
    });
  });

  it('closeIdleConversations updates idle ACTIVE rows and returns the count', async () => {
    const prisma = makePrisma();
    prisma.conversation.updateMany.mockResolvedValue({ count: 3 });
    const before = Date.now();
    const count = await repo(prisma).closeIdleConversations(30);
    expect(count).toBe(3);
    const arg = prisma.conversation.updateMany.mock.calls[0]?.[0] as {
      where: { state: ConversationState; updatedAt: { lt: Date } };
      data: { state: ConversationState };
    };
    expect(arg.where.state).toBe(ConversationState.ACTIVE);
    expect(arg.data.state).toBe(ConversationState.CLOSED);
    expect(arg.where.updatedAt.lt.getTime()).toBeLessThanOrEqual(before - 30 * 60_000 + 1000);
  });
});

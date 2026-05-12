import { describe, expect, it, vi } from 'vitest';
import { ConversationState } from '../conversations/conversation.repository';
import type { IncomingMessage } from '../whatsapp/whatsapp.types';
import { ChatService, type ChatServiceDeps } from './chat.service';

function makeMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    messageId: 'wamid.1',
    from: '5531999999999',
    timestamp: '1700000000',
    type: 'text',
    text: 'Olá, quero um apartamento',
    contactName: 'Maria',
    ...overrides,
  };
}

function makeDeps(
  conversationState: ConversationState = ConversationState.ACTIVE,
): ChatServiceDeps {
  const conversation = { phoneNumber: '5531999999999', state: conversationState, messages: [] };
  return {
    conversations: {
      getOrCreate: vi.fn().mockResolvedValue(conversation),
      updateState: vi.fn().mockResolvedValue(undefined),
      updateClientInfo: vi.fn().mockResolvedValue(undefined),
      appendMessage: vi.fn().mockResolvedValue(conversation),
      getMessages: vi.fn().mockReturnValue([{ role: 'user', content: 'Olá', timestamp: '' }]),
      addViewedProperty: vi.fn().mockResolvedValue(undefined),
    },
    properties: {},
    leads: {},
    whatsapp: {
      markAsRead: vi.fn().mockResolvedValue(undefined),
      sendText: vi.fn().mockResolvedValue(undefined),
    },
    ai: { chat: vi.fn().mockResolvedValue({ text: 'Olá! Como posso ajudar?' }) },
  } as unknown as ChatServiceDeps;
}

describe('ChatService.handleIncomingMessage', () => {
  it('ignores non-text messages', async () => {
    const deps = makeDeps();
    await new ChatService(deps).handleIncomingMessage(makeMessage({ type: 'image' }));
    expect(deps.whatsapp.markAsRead).not.toHaveBeenCalled();
    expect(deps.ai.chat).not.toHaveBeenCalled();
  });

  it('ignores messages while the conversation is with a human agent', async () => {
    const deps = makeDeps(ConversationState.TRANSFERRED);
    await new ChatService(deps).handleIncomingMessage(makeMessage());
    expect(deps.ai.chat).not.toHaveBeenCalled();
    expect(deps.whatsapp.sendText).not.toHaveBeenCalled();
  });

  it('reopens a closed conversation', async () => {
    const deps = makeDeps(ConversationState.CLOSED);
    await new ChatService(deps).handleIncomingMessage(makeMessage());
    expect(deps.conversations.updateState).toHaveBeenCalledWith(
      '5531999999999',
      ConversationState.ACTIVE,
    );
    expect(deps.conversations.updateClientInfo).toHaveBeenCalledWith('5531999999999', {
      name: 'Maria',
    });
  });

  it('persists the exchange and replies on WhatsApp', async () => {
    const deps = makeDeps();
    await new ChatService(deps).handleIncomingMessage(makeMessage());

    expect(deps.whatsapp.markAsRead).toHaveBeenCalledWith('wamid.1');
    expect(deps.conversations.appendMessage).toHaveBeenCalledWith(
      '5531999999999',
      'user',
      'Olá, quero um apartamento',
    );
    expect(deps.ai.chat).toHaveBeenCalledOnce();
    expect(deps.conversations.appendMessage).toHaveBeenCalledWith(
      '5531999999999',
      'assistant',
      'Olá! Como posso ajudar?',
    );
    expect(deps.whatsapp.sendText).toHaveBeenCalledWith('5531999999999', 'Olá! Como posso ajudar?');
  });

  it('sends a fallback message when the AI call fails', async () => {
    const deps = makeDeps();
    (deps.ai.chat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    await new ChatService(deps).handleIncomingMessage(makeMessage());
    expect(deps.whatsapp.sendText).toHaveBeenCalledOnce();
    expect((deps.whatsapp.sendText as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toMatch(
      /problema/i,
    );
  });

  it('does not throw when even the fallback message fails to send', async () => {
    const deps = makeDeps();
    (deps.ai.chat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    (deps.whatsapp.sendText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('whatsapp down'),
    );
    await expect(
      new ChatService(deps).handleIncomingMessage(makeMessage()),
    ).resolves.toBeUndefined();
  });

  it('does not reply when the AI returns an empty message', async () => {
    const deps = makeDeps();
    (deps.ai.chat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ text: '   ' });
    await new ChatService(deps).handleIncomingMessage(makeMessage());
    expect(deps.whatsapp.sendText).not.toHaveBeenCalled();
    expect(deps.conversations.appendMessage).toHaveBeenCalledTimes(1);
  });

  it('logs token usage when present', async () => {
    const deps = makeDeps();
    (deps.ai.chat as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      text: 'Olá!',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    });
    await new ChatService(deps).handleIncomingMessage(makeMessage());
    expect(deps.whatsapp.sendText).toHaveBeenCalledWith('5531999999999', 'Olá!');
  });
});

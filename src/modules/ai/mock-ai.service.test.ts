import { describe, expect, it } from 'vitest';
import { MockAiService } from './mock-ai.service';
import type { ChatRequest } from './ai.types';

function request(lastUserMessage: string): ChatRequest {
  return {
    systemPrompt: 'system',
    messages: [{ role: 'user', content: lastUserMessage }],
    tools: [],
  };
}

describe('MockAiService', () => {
  const service = new MockAiService();

  it('responds to greetings', async () => {
    const result = await service.chat(request('Oi, tudo bem?'));
    expect(result.text).toMatch(/Bem-vindo/i);
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('responds to apartment queries', async () => {
    const result = await service.chat(request('Quero um apartamento'));
    expect(result.text).toMatch(/apartamento/i);
  });

  it('responds to scheduling intent', async () => {
    const result = await service.chat(request('Posso agendar uma visita?'));
    expect(result.text).toMatch(/agendar/i);
  });

  it('responds to thanks', async () => {
    const result = await service.chat(request('Muito obrigado!'));
    expect(result.text).toMatch(/De nada/i);
  });

  it('responds to price questions', async () => {
    const result = await service.chat(request('Quanto custa?'));
    expect(result.text).toMatch(/faixa/i);
  });

  it('falls back to a generic menu', async () => {
    const result = await service.chat(request('zzz 12345 wxyz'));
    expect(result.text).toMatch(/Busca de imóveis/i);
  });

  it('falls back to a generic menu when there is no user message at all', async () => {
    const result = await service.chat({ systemPrompt: 's', messages: [], tools: [] });
    expect(result.text).toMatch(/Busca de imóveis/i);
  });
});

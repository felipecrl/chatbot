import { logger } from '../../lib/logger';
import type { AiService, ChatRequest, ChatResult } from './ai.types';

const log = logger.child({ module: 'ai.mock' });

const ZERO_USAGE = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

/** Keyword-based fake assistant for local development without OpenAI costs. */
export class MockAiService implements AiService {
  async chat(request: ChatRequest): Promise<ChatResult> {
    const lastUserMessage = [...request.messages].reverse().find((m) => m.role === 'user');
    const text = (lastUserMessage?.content ?? '').toLowerCase();

    log.info('Modo mock — gerando resposta simulada');
    return Promise.resolve({ text: replyFor(text), usage: ZERO_USAGE });
  }
}

function replyFor(text: string): string {
  if (text.includes('apartamento') || text.includes('imóvel') || text.includes('imovel')) {
    return 'Ótimo! Procurando apartamento? 🏠\n\nVou buscar algumas opções para você. Qual é sua faixa de preço e localização preferida?';
  }
  if (text.includes('agendar') || text.includes('visita')) {
    return 'Perfeito! Vou agendar sua visita. Qual é seu nome completo e melhor horário para você?';
  }
  if (text.includes('obrigado') || text.includes('valeu')) {
    return 'De nada! 😊 Qualquer dúvida, é só chamar.';
  }
  if (text.includes('oi') || text.includes('olá') || text.includes('ola')) {
    return 'Olá! 👋 Bem-vindo! Como posso ajudá-lo hoje? Procura algum imóvel específico?';
  }
  if (text.includes('preço') || text.includes('preco') || text.includes('quanto custa')) {
    return 'Temos opções em várias faixas de preço! 💰 Qual sua faixa orçamentária?';
  }
  return 'Posso ajudá-lo com:\n✅ Busca de imóveis\n✅ Agendamento de visitas\n✅ Informações sobre preços\n\nO que você procura?';
}

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { toErrorMeta } from '../../lib/errors';
import type { AiService, ChatRequest, ChatResult, ChatTool, TokenUsage } from './ai.types';

const log = logger.child({ module: 'ai.openai' });

const MAX_TOOL_ITERATIONS = 5;
const MAX_TOKENS = 1_000;
const TEMPERATURE = 0.7;

const CLASSIFIER_MODEL = 'gpt-4o-mini';
const CLASSIFIER_SYSTEM = `Você é um classificador de mensagens para um chatbot de imobiliária.
Determine se a mensagem é relacionada ao mercado imobiliário.
Tópicos permitidos: busca de imóveis, preços, aluguel, compra, venda, visitas, financiamento, bairros, condomínios, características de imóveis, saudações e despedidas.
Responda APENAS com "sim" (dentro do escopo) ou "nao" (fora do escopo).`;

export interface OpenAiServiceOptions {
  client?: OpenAI;
  model?: string;
}

export class OpenAiService implements AiService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAiServiceOptions = {}) {
    this.client = options.client ?? new OpenAI({ apiKey: config.openai.apiKey });
    this.model = options.model ?? config.openai.model;
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const toolsByName = new Map(request.tools.map((tool) => [tool.definition.name, tool]));
    const openAiTools = request.tools.length > 0 ? request.tools.map(toOpenAiTool) : undefined;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      ...request.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    let response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: openAiTools,
      tool_choice: openAiTools ? 'auto' : undefined,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) break;

      const toolCalls = (assistantMessage.tool_calls ?? []).filter(
        (tc): tc is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall =>
          tc.type === 'function',
      );
      if (toolCalls.length === 0) {
        return { text: assistantMessage.content, usage: toUsage(response.usage) };
      }

      messages.push(assistantMessage);

      for (const toolCall of toolCalls) {
        const result = await this.runTool(
          toolsByName,
          toolCall.function.name,
          toolCall.function.arguments,
        );
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }

      response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: openAiTools,
        tool_choice: 'auto',
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      });
    }

    log.warn('Limite de iterações de ferramentas atingido', { max: MAX_TOOL_ITERATIONS });
    return { text: response.choices[0]?.message.content ?? null, usage: toUsage(response.usage) };
  }

  async classify(text: string): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: CLASSIFIER_MODEL,
        messages: [
          { role: 'system', content: CLASSIFIER_SYSTEM },
          { role: 'user', content: text },
        ],
        max_tokens: 5,
        temperature: 0,
      });
      const answer = response.choices[0]?.message.content?.trim().toLowerCase() ?? '';
      if (!answer) return true; // resposta vazia → fail open
      return answer.startsWith('sim');
    } catch (error) {
      log.warn('Falha ao classificar mensagem — permitindo por precaução', toErrorMeta(error));
      return true;
    }
  }

  private async runTool(
    toolsByName: Map<string, ChatTool>,
    name: string,
    rawArguments: string,
  ): Promise<unknown> {
    const tool = toolsByName.get(name);
    if (!tool) {
      log.warn('Ferramenta desconhecida solicitada pelo modelo', { name });
      return { error: `Ferramenta ${name} não implementada` };
    }

    let args: Record<string, unknown>;
    try {
      args = rawArguments ? (JSON.parse(rawArguments) as Record<string, unknown>) : {};
    } catch (error) {
      log.warn('Argumentos de ferramenta inválidos', { name, ...toErrorMeta(error) });
      return { error: 'Argumentos inválidos' };
    }

    log.info('Modelo chamou ferramenta', { name, args });
    try {
      return await tool.handler(args);
    } catch (error) {
      log.error('Erro ao executar ferramenta', { name, ...toErrorMeta(error) });
      return { error: 'Falha ao executar a ferramenta' };
    }
  }
}

function toOpenAiTool(tool: ChatTool): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.definition.name,
      description: tool.definition.description,
      parameters: tool.definition.parameters as unknown as Record<string, unknown>,
    },
  };
}

function toUsage(usage: OpenAI.Completions.CompletionUsage | undefined): TokenUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

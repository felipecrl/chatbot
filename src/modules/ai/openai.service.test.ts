import type OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import type { ChatTool } from './ai.types';
import { OpenAiService } from './openai.service';

function makeClient(create: ReturnType<typeof vi.fn>) {
  return { chat: { completions: { create } } } as unknown as OpenAI;
}

function service(create: ReturnType<typeof vi.fn>) {
  return new OpenAiService({ client: makeClient(create), model: 'gpt-test' });
}

function tool(name: string, handler: ChatTool['handler']): ChatTool {
  return {
    definition: {
      name,
      description: `desc ${name}`,
      parameters: { type: 'object', properties: {} },
    },
    handler,
  };
}

function assistant(
  content: string | null,
  toolCalls?: Array<{ id: string; name: string; args: string }>,
) {
  return {
    choices: [
      {
        message: {
          content,
          tool_calls: toolCalls?.map((c) => ({
            id: c.id,
            function: { name: c.name, arguments: c.args },
          })),
        },
      },
    ],
  };
}

const request = (tools: ChatTool[] = []) => ({
  systemPrompt: 'sistema',
  messages: [{ role: 'user' as const, content: 'oi' }],
  tools,
});

describe('OpenAiService.chat', () => {
  it('returns the assistant text and token usage when there are no tools', async () => {
    const create = vi.fn().mockResolvedValue({
      ...assistant('Olá! Como posso ajudar?'),
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    });
    const result = await service(create).chat(request());
    expect(result).toEqual({
      text: 'Olá! Como posso ajudar?',
      usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 },
    });
    expect(create).toHaveBeenCalledOnce();
    const args = create.mock.calls[0]?.[0] as {
      tools?: unknown;
      tool_choice?: unknown;
      model: string;
    };
    expect(args.model).toBe('gpt-test');
    expect(args.tools).toBeUndefined();
    expect(args.tool_choice).toBeUndefined();
  });

  it('passes tool specs and returns text when the model does not call a tool', async () => {
    const create = vi.fn().mockResolvedValue(assistant('Sem ferramentas hoje'));
    const result = await service(create).chat(request([tool('buscar_imoveis', vi.fn())]));
    expect(result.text).toBe('Sem ferramentas hoje');
    const args = create.mock.calls[0]?.[0] as { tools: unknown[]; tool_choice: string };
    expect(args.tool_choice).toBe('auto');
    expect(args.tools).toHaveLength(1);
  });

  it('executes a requested tool and continues the conversation', async () => {
    const handler = vi.fn().mockResolvedValue({ imoveis: [] });
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        assistant(null, [{ id: 'call-1', name: 'buscar_imoveis', args: '{"cidade":"BH"}' }]),
      )
      .mockResolvedValueOnce(assistant('Encontrei algumas opções'));
    const result = await service(create).chat(request([tool('buscar_imoveis', handler)]));
    expect(handler).toHaveBeenCalledWith({ cidade: 'BH' });
    expect(result.text).toBe('Encontrei algumas opções');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('passes an empty object to the handler when arguments are blank', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        assistant(null, [{ id: 'c', name: 'transferir_para_humano', args: '' }]),
      )
      .mockResolvedValueOnce(assistant('feito'));
    await service(create).chat(request([tool('transferir_para_humano', handler)]));
    expect(handler).toHaveBeenCalledWith({});
  });

  it('reports an error for an unknown tool but keeps going', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        assistant(null, [{ id: 'c', name: 'ferramenta_fantasma', args: '{}' }]),
      )
      .mockResolvedValueOnce(assistant('continuando'));
    const result = await service(create).chat(request([tool('buscar_imoveis', vi.fn())]));
    expect(result.text).toBe('continuando');
  });

  it('reports invalid tool arguments but keeps going', async () => {
    const handler = vi.fn();
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        assistant(null, [{ id: 'c', name: 'buscar_imoveis', args: 'not-json' }]),
      )
      .mockResolvedValueOnce(assistant('ok'));
    const result = await service(create).chat(request([tool('buscar_imoveis', handler)]));
    expect(handler).not.toHaveBeenCalled();
    expect(result.text).toBe('ok');
  });

  it('reports a failing tool handler but keeps going', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('handler exploded'));
    const create = vi
      .fn()
      .mockResolvedValueOnce(assistant(null, [{ id: 'c', name: 'agendar_visita', args: '{}' }]))
      .mockResolvedValueOnce(assistant('seguindo em frente'));
    const result = await service(create).chat(request([tool('agendar_visita', handler)]));
    expect(result.text).toBe('seguindo em frente');
  });

  it('stops after the maximum number of tool iterations', async () => {
    const create = vi
      .fn()
      .mockResolvedValue(assistant(null, [{ id: 'c', name: 'loop', args: '{}' }]));
    const result = await service(create).chat(
      request([tool('loop', vi.fn().mockResolvedValue({}))]),
    );
    expect(result.text).toBeNull();
    // 1 initial call + up to 5 follow-up calls.
    expect(create).toHaveBeenCalledTimes(6);
  });

  it('breaks out when the response has no assistant message', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [] });
    const result = await service(create).chat(request([tool('buscar_imoveis', vi.fn())]));
    expect(result).toEqual({ text: null, usage: undefined });
    expect(create).toHaveBeenCalledOnce();
  });

  it('uses config defaults when no client/model is provided', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-only');
    expect(() => new OpenAiService()).not.toThrow();
    vi.unstubAllEnvs();
  });
});

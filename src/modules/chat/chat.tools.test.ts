import { describe, expect, it, vi } from 'vitest';
import { ConversationState } from '../conversations/conversation.repository';
import type { Property } from '../properties/property.types';
import { buildChatTools, parseBrazilianDateTime, type ChatToolsDeps } from './chat.tools';

function makeDeps(overrides: Partial<Record<keyof ChatToolsDeps, unknown>> = {}): ChatToolsDeps {
  return {
    conversations: {
      addViewedProperty: vi.fn().mockResolvedValue(undefined),
      updateClientInfo: vi.fn().mockResolvedValue(undefined),
      updateState: vi.fn().mockResolvedValue(undefined),
    },
    properties: {
      search: vi.fn().mockResolvedValue([] as Property[]),
      getByCode: vi.fn().mockResolvedValue(null),
    },
    leads: {
      scheduleVisit: vi
        .fn()
        .mockResolvedValue({ leadId: 1, crmLeadId: null, crmAppointmentId: null }),
    },
    whatsapp: { sendProperties: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  } as unknown as ChatToolsDeps;
}

function toolByName(deps: ChatToolsDeps, name: string) {
  const tool = buildChatTools(deps, '5531999999999').find((t) => t.definition.name === name);
  if (!tool) throw new Error(`tool ${name} not found`);
  return tool;
}

describe('parseBrazilianDateTime', () => {
  it('parses date with time', () => {
    expect(parseBrazilianDateTime('25/12/2026 14:30')?.toISOString()).toBe(
      new Date('2026-12-25T14:30:00').toISOString(),
    );
  });

  it('parses date without time (defaults to 10:00)', () => {
    expect(parseBrazilianDateTime('01/01/2027')?.toISOString()).toBe(
      new Date('2027-01-01T10:00:00').toISOString(),
    );
  });

  it('returns null for unparseable input', () => {
    expect(parseBrazilianDateTime('amanhã')).toBeNull();
  });

  it('returns null when the date components are out of range', () => {
    expect(parseBrazilianDateTime('99/99/9999 99:99')).toBeNull();
  });
});

describe('buscar_imoveis tool', () => {
  it('returns a message when nothing matches', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'buscar_imoveis').handler({
      modalidade: 'venda',
    })) as Record<string, unknown>;
    expect(result.imoveis).toEqual([]);
    expect(result.mensagem).toMatch(/Nenhum imóvel/);
  });

  it('records viewed properties and returns digests', async () => {
    const property: Property = {
      code: 'AP001',
      type: 'Apartamento',
      transaction: 'venda',
      city: 'BH',
      neighborhood: 'Savassi',
      address: null,
      price: 450_000,
      area: 75,
      bedrooms: 2,
      bathrooms: 2,
      parkingSpaces: 1,
      amenities: [],
      description: '',
      photos: [],
    };
    const deps = makeDeps({
      properties: { search: vi.fn().mockResolvedValue([property]), getByCode: vi.fn() },
    });
    const result = (await toolByName(deps, 'buscar_imoveis').handler({})) as Record<
      string,
      unknown
    >;
    expect(result.total).toBe(1);
    expect(deps.conversations.addViewedProperty).toHaveBeenCalledWith('5531999999999', 'AP001');
  });

  it('rejects invalid search criteria', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'buscar_imoveis').handler({
      preco_min: 'muito caro',
    })) as Record<string, unknown>;
    expect(result.erro).toMatch(/inválidos/i);
    expect(result.imoveis).toEqual([]);
  });

  it('returns an error when the property search throws', async () => {
    const deps = makeDeps({
      properties: {
        search: vi.fn().mockRejectedValue(new Error('upstream down')),
        getByCode: vi.fn(),
      },
    });
    const result = (await toolByName(deps, 'buscar_imoveis').handler({})) as Record<
      string,
      unknown
    >;
    expect(result.erro).toMatch(/não foi possível/i);
    expect(result.imoveis).toEqual([]);
  });

  it('dispatches property media without failing when sending throws', async () => {
    const property: Property = {
      code: 'AP001',
      type: 'Apartamento',
      transaction: 'venda',
      city: 'BH',
      neighborhood: 'Savassi',
      address: null,
      price: 1,
      area: 1,
      bedrooms: 1,
      bathrooms: 1,
      parkingSpaces: 1,
      amenities: [],
      description: '',
      photos: [],
    };
    const deps = makeDeps({
      properties: { search: vi.fn().mockResolvedValue([property]), getByCode: vi.fn() },
      whatsapp: { sendProperties: vi.fn().mockRejectedValue(new Error('whatsapp down')) },
    });
    const result = (await toolByName(deps, 'buscar_imoveis').handler({})) as Record<
      string,
      unknown
    >;
    expect(result.total).toBe(1);
    // Let the fire-and-forget rejection settle.
    await new Promise((r) => setImmediate(r));
  });
});

describe('obter_detalhes_imovel tool', () => {
  it('rejects an empty code', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'obter_detalhes_imovel').handler({})) as Record<
      string,
      unknown
    >;
    expect(result.erro).toMatch(/código.*inválido/i);
  });

  it('returns a digest when the property is found', async () => {
    const property: Property = {
      code: 'AP001',
      type: 'Apartamento',
      transaction: 'venda',
      city: 'BH',
      neighborhood: 'Savassi',
      address: null,
      price: 450_000,
      area: 75,
      bedrooms: 2,
      bathrooms: 2,
      parkingSpaces: 1,
      amenities: [],
      description: '',
      photos: [],
    };
    const deps = makeDeps({
      properties: { search: vi.fn(), getByCode: vi.fn().mockResolvedValue(property) },
    });
    const result = (await toolByName(deps, 'obter_detalhes_imovel').handler({
      codigo: 'AP001',
    })) as { imovel: { codigo: string } };
    expect(result.imovel.codigo).toBe('AP001');
  });

  it('reports when the property is not found', async () => {
    const deps = makeDeps({
      properties: { search: vi.fn(), getByCode: vi.fn().mockResolvedValue(null) },
    });
    const result = (await toolByName(deps, 'obter_detalhes_imovel').handler({
      codigo: 'ZZZ',
    })) as Record<string, unknown>;
    expect(result.erro).toMatch(/não encontrado/i);
  });

  it('reports an error when the lookup throws', async () => {
    const deps = makeDeps({
      properties: { search: vi.fn(), getByCode: vi.fn().mockRejectedValue(new Error('boom')) },
    });
    const result = (await toolByName(deps, 'obter_detalhes_imovel').handler({
      codigo: 'AP001',
    })) as Record<string, unknown>;
    expect(result.erro).toMatch(/não foi possível/i);
  });
});

describe('agendar_visita tool', () => {
  it('rejects incomplete arguments', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'agendar_visita').handler({
      imovel_codigo: 'AP001',
    })) as Record<string, unknown>;
    expect(result.sucesso).toBe(false);
    expect(deps.leads.scheduleVisit).not.toHaveBeenCalled();
  });

  it('schedules a visit and marks the conversation', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'agendar_visita').handler({
      imovel_codigo: 'AP001',
      cliente_nome: 'Maria Silva',
      cliente_email: 'maria@example.com',
      data_preferida: '20/06/2026 15:00',
    })) as Record<string, unknown>;
    expect(result.sucesso).toBe(true);
    expect(deps.leads.scheduleVisit).toHaveBeenCalledOnce();
    expect(deps.conversations.updateState).toHaveBeenCalledWith(
      '5531999999999',
      ConversationState.SCHEDULED,
    );
  });

  it('schedules with no preferred date and a custom phone number', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'agendar_visita').handler({
      imovel_codigo: 'AP001',
      cliente_nome: 'João',
      cliente_telefone: '5531888888888',
    })) as Record<string, unknown>;
    expect(result.sucesso).toBe(true);
    expect(deps.leads.scheduleVisit).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: '5531888888888', scheduledAt: null }),
    );
  });

  it('treats an unparseable preferred date as no date', async () => {
    const deps = makeDeps();
    await toolByName(deps, 'agendar_visita').handler({
      imovel_codigo: 'AP001',
      cliente_nome: 'João',
      data_preferida: 'semana que vem',
    });
    expect(deps.leads.scheduleVisit).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledAt: null }),
    );
  });

  it('treats an empty e-mail string as no e-mail', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'agendar_visita').handler({
      imovel_codigo: 'AP001',
      cliente_nome: 'João',
      cliente_email: '',
    })) as Record<string, unknown>;
    expect(result.sucesso).toBe(true);
    expect(deps.leads.scheduleVisit).toHaveBeenCalledWith(
      expect.objectContaining({ email: undefined }),
    );
  });

  it('reports failure when scheduling throws', async () => {
    const deps = makeDeps({
      leads: { scheduleVisit: vi.fn().mockRejectedValue(new Error('crm down')) },
    });
    const result = (await toolByName(deps, 'agendar_visita').handler({
      imovel_codigo: 'AP001',
      cliente_nome: 'Maria Silva',
    })) as Record<string, unknown>;
    expect(result.sucesso).toBe(false);
    expect(result.erro).toMatch(/não foi possível/i);
    expect(deps.conversations.updateState).not.toHaveBeenCalled();
  });
});

describe('transferir_para_humano tool', () => {
  it('marks the conversation as transferred', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'transferir_para_humano').handler({
      motivo: 'cliente pediu',
    })) as Record<string, unknown>;
    expect(result.transferido).toBe(true);
    expect(deps.conversations.updateState).toHaveBeenCalledWith(
      '5531999999999',
      ConversationState.TRANSFERRED,
    );
  });

  it('still transfers when the reason argument is invalid', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'transferir_para_humano').handler({
      motivo: 42,
    })) as Record<string, unknown>;
    expect(result.transferido).toBe(true);
    expect(deps.conversations.updateState).toHaveBeenCalledWith(
      '5531999999999',
      ConversationState.TRANSFERRED,
    );
  });
});

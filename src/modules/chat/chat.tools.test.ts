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

const sampleProperty = (code = 'AP001', neighborhood = 'Savassi'): Property => ({
  code,
  type: 'Apartamento',
  transaction: 'venda',
  city: 'São Paulo',
  neighborhood,
  address: null,
  price: 450_000,
  area: 75,
  bedrooms: 2,
  bathrooms: 2,
  parkingSpaces: 1,
  amenities: [],
  description: '',
  photos: [],
});

describe('buscar_imoveis tool', () => {
  it('returns semResultado when nothing matches', async () => {
    const deps = makeDeps();
    const result = (await toolByName(deps, 'buscar_imoveis').handler({
      modalidade: 'venda',
      cidade: 'Manaus',
    })) as Record<string, unknown>;
    expect(result.imoveis).toEqual([]);
    expect(result.semResultado).toBe(true);
  });

  it('relaxes characteristic filters (sugestaoSimilar) when location-exact search is empty', async () => {
    // First call (with characteristics) returns []; second call (location only) returns a property
    const searchMock = vi
      .fn()
      .mockResolvedValueOnce([]) // full search
      .mockResolvedValueOnce([sampleProperty()]); // location-only fallback
    const deps = makeDeps({
      properties: { search: searchMock, getByCode: vi.fn() },
    });
    const result = (await toolByName(deps, 'buscar_imoveis').handler({
      cidade: 'São Paulo',
      bairro: 'Vila Madalena',
      quartos_min: 4,
      preco_max: 200_000,
    })) as Record<string, unknown>;
    expect(result.sugestaoSimilar).toBe(true);
    expect((result.imoveis as unknown[]).length).toBe(1);
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to city search without characteristics (semResultadoNoBairro + sugestaoSimilar)', async () => {
    // 1st: full search empty, 2nd: location-only in neighborhood empty, 3rd: city-only returns property
    const searchMock = vi
      .fn()
      .mockResolvedValueOnce([]) // full search
      .mockResolvedValueOnce([]) // location-only in neighborhood
      .mockResolvedValueOnce([sampleProperty()]); // city-only fallback
    const deps = makeDeps({
      properties: { search: searchMock, getByCode: vi.fn() },
    });
    const result = (await toolByName(deps, 'buscar_imoveis').handler({
      cidade: 'São Paulo',
      bairro: 'Brooklin',
      quartos_min: 5,
    })) as Record<string, unknown>;
    expect(result.semResultadoNoBairro).toBe(true);
    expect(result.sugestaoSimilar).toBe(true);
    expect(result.bairro).toBe('Brooklin');
    expect(result.cidade).toBe('São Paulo');
    expect((result.imoveis as unknown[]).length).toBe(1);
    expect(searchMock).toHaveBeenCalledTimes(3);
  });

  it('falls back to city search when neighborhood has no results and returns semResultadoNoBairro', async () => {
    // No characteristics — 1st: neighborhood empty, 2nd: city-only returns property
    const searchMock = vi
      .fn()
      .mockResolvedValueOnce([]) // neighborhood search
      .mockResolvedValueOnce([sampleProperty()]); // city-only fallback
    const deps = makeDeps({
      properties: { search: searchMock, getByCode: vi.fn() },
    });
    const result = (await toolByName(deps, 'buscar_imoveis').handler({
      cidade: 'São Paulo',
      bairro: 'Brooklin',
    })) as Record<string, unknown>;
    expect(result.semResultadoNoBairro).toBe(true);
    expect(result.sugestaoSimilar).toBe(false);
    expect(result.bairro).toBe('Brooklin');
    expect(result.cidade).toBe('São Paulo');
    expect((result.imoveis as unknown[]).length).toBe(1);
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('returns semResultado when all fallback searches are empty', async () => {
    const searchMock = vi.fn().mockResolvedValue([]);
    const deps = makeDeps({
      properties: { search: searchMock, getByCode: vi.fn() },
    });
    const result = (await toolByName(deps, 'buscar_imoveis').handler({
      cidade: 'São Paulo',
      bairro: 'Brooklin',
      quartos_min: 5,
    })) as Record<string, unknown>;
    expect(result.semResultado).toBe(true);
    expect(result.imoveis).toEqual([]);
    // 3 attempts: full + location-only + city-only
    expect(searchMock).toHaveBeenCalledTimes(3);
  });

  it('records viewed properties and returns digests', async () => {
    const deps = makeDeps({
      properties: { search: vi.fn().mockResolvedValue([sampleProperty()]), getByCode: vi.fn() },
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
    const deps = makeDeps({
      properties: { search: vi.fn().mockResolvedValue([sampleProperty()]), getByCode: vi.fn() },
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

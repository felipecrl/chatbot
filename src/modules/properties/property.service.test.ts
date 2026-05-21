import type { AxiosInstance } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { PropertyService } from './property.service';

function mutateImoview(patch: { enabled?: boolean; apiUrl?: string; apiKey?: string }) {
  Object.assign(config.imoview as unknown as Record<string, unknown>, patch);
}

afterEach(() => {
  mutateImoview({ enabled: false, apiUrl: undefined, apiKey: undefined });
});

function clientWith(post: ReturnType<typeof vi.fn>, get?: ReturnType<typeof vi.fn>) {
  return { post, get: get ?? vi.fn() } as unknown as AxiosInstance;
}

describe('PropertyService falling back to the sample catalogue', () => {
  it('search returns sample properties when Imoview is not configured', async () => {
    const results = await new PropertyService().search({ transaction: 'venda' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.transaction === 'venda')).toBe(true);
  });

  it('getByCode returns a sample property or null', async () => {
    const service = new PropertyService();
    expect(await service.getByCode('AP001')).toMatchObject({ code: 'AP001' });
    expect(await service.getByCode('ZZZ999')).toBeNull();
  });

  it('builds an HTTP client when Imoview is enabled', () => {
    mutateImoview({ enabled: true, apiUrl: 'https://api.imoview.com.br', apiKey: 'k' });
    expect(() => new PropertyService()).not.toThrow();
  });

  it('builds an HTTP client even when the API key is absent', () => {
    mutateImoview({ enabled: true, apiUrl: 'https://api.imoview.com.br', apiKey: undefined });
    expect(() => new PropertyService()).not.toThrow();
  });
});

describe('PropertyService — location code lookup', () => {
  function searchPost(bairros: object[] = [], cidades: object[] = []) {
    return vi.fn().mockImplementation((path: string) => {
      if (path === '/Imovel/PesquisarCidadeEBairrosDisponiveis') {
        return Promise.resolve({ data: { cidades, bairros } });
      }
      return Promise.resolve({ data: { lista: [] } });
    });
  }

  it('calls PesquisarCidadeEBairrosDisponiveis when neighborhood is provided', async () => {
    const post = searchPost([{ codigo: 42, nome: 'Savassi', cidade: 'Belo Horizonte' }]);
    await new PropertyService(clientWith(post)).search({ neighborhood: 'Savassi' });
    expect(post).toHaveBeenCalledWith('/Imovel/PesquisarCidadeEBairrosDisponiveis', {
      finalidade: 2,
      textoPesquisa: 'Savassi',
    });
    const searchCall = post.mock.calls.find(
      ([path]: string[]) => path === '/Imovel/RetornarImoveisDisponiveis',
    );
    expect(searchCall?.[1]).toMatchObject({ codigosbairros: '42' });
    expect(searchCall?.[1]).not.toHaveProperty('codigocidade');
  });

  it('calls PesquisarCidadeEBairrosDisponiveis when city is provided', async () => {
    const post = searchPost([], [{ codigo: 10, nome: 'Belo Horizonte', estado: 'MG' }]);
    await new PropertyService(clientWith(post)).search({ city: 'Belo Horizonte' });
    expect(post).toHaveBeenCalledWith('/Imovel/PesquisarCidadeEBairrosDisponiveis', {
      finalidade: 2,
      textoPesquisa: 'Belo Horizonte',
    });
    const searchCall = post.mock.calls.find(
      ([path]: string[]) => path === '/Imovel/RetornarImoveisDisponiveis',
    );
    expect(searchCall?.[1]).toMatchObject({ codigocidade: 10 });
  });

  it('disambiguates neighborhood by city when multiple bairros share the same name', async () => {
    const post = searchPost([
      { codigo: 1, nome: 'Centro', cidade: 'São Paulo' },
      { codigo: 2, nome: 'Centro', cidade: 'Belo Horizonte' },
    ]);
    await new PropertyService(clientWith(post)).search({
      neighborhood: 'Centro',
      city: 'Belo Horizonte',
    });
    const searchCall = post.mock.calls.find(
      ([path]: string[]) => path === '/Imovel/RetornarImoveisDisponiveis',
    );
    expect(searchCall?.[1]).toMatchObject({ codigosbairros: '2' });
  });

  it('uses the bairro code and skips city lookup when neighborhood is found', async () => {
    const post = searchPost([{ codigo: 42, nome: 'Savassi', cidade: 'Belo Horizonte' }]);
    await new PropertyService(clientWith(post)).search({
      neighborhood: 'Savassi',
      city: 'Belo Horizonte',
    });
    const lookupCalls = post.mock.calls.filter(
      ([path]: string[]) => path === '/Imovel/PesquisarCidadeEBairrosDisponiveis',
    );
    // Only one lookup (neighborhood), no separate city lookup needed
    expect(lookupCalls).toHaveLength(1);
  });

  it('falls back to city lookup when neighborhood search returns no results', async () => {
    const post = searchPost([], [{ codigo: 10, nome: 'Belo Horizonte', estado: 'MG' }]);
    await new PropertyService(clientWith(post)).search({
      neighborhood: 'SemResultado',
      city: 'Belo Horizonte',
    });
    const lookupCalls = post.mock.calls.filter(
      ([path]: string[]) => path === '/Imovel/PesquisarCidadeEBairrosDisponiveis',
    );
    expect(lookupCalls).toHaveLength(2);
    const searchCall = post.mock.calls.find(
      ([path]: string[]) => path === '/Imovel/RetornarImoveisDisponiveis',
    );
    expect(searchCall?.[1]).toMatchObject({ codigocidade: 10 });
    expect(searchCall?.[1]).not.toHaveProperty('codigosbairros');
  });

  it('skips lookup when city and neighborhood are shorter than 3 chars', async () => {
    const post = vi.fn().mockResolvedValue({ data: { lista: [] } });
    await new PropertyService(clientWith(post)).search({ city: 'BH', neighborhood: 'SC' });
    const lookupCalls = post.mock.calls.filter(
      ([path]: string[]) => path === '/Imovel/PesquisarCidadeEBairrosDisponiveis',
    );
    expect(lookupCalls).toHaveLength(0);
  });

  it('proceeds without location filter when lookup throws', async () => {
    const post = vi.fn().mockImplementation((path: string) => {
      if (path === '/Imovel/PesquisarCidadeEBairrosDisponiveis') {
        return Promise.reject(new Error('timeout'));
      }
      return Promise.resolve({ data: { lista: [] } });
    });
    await expect(
      new PropertyService(clientWith(post)).search({ neighborhood: 'Savassi' }),
    ).resolves.toEqual([]);
    const searchCall = post.mock.calls.find(
      ([path]: string[]) => path === '/Imovel/RetornarImoveisDisponiveis',
    );
    expect(searchCall?.[1]).not.toHaveProperty('codigosbairros');
    expect(searchCall?.[1]).not.toHaveProperty('codigocidade');
  });

  it('does not call lookup when neither city nor neighborhood is given', async () => {
    const post = vi.fn().mockResolvedValue({ data: { lista: [] } });
    await new PropertyService(clientWith(post)).search({ transaction: 'venda' });
    const lookupCalls = post.mock.calls.filter(
      ([path]: string[]) => path === '/Imovel/PesquisarCidadeEBairrosDisponiveis',
    );
    expect(lookupCalls).toHaveLength(0);
  });

  it('matches neighborhood case-insensitively and ignoring accents', async () => {
    const post = searchPost([{ codigo: 99, nome: 'Lourdes', cidade: 'Belo Horizonte' }]);
    await new PropertyService(clientWith(post)).search({ neighborhood: 'lourdes' });
    const searchCall = post.mock.calls.find(
      ([path]: string[]) => path === '/Imovel/RetornarImoveisDisponiveis',
    );
    expect(searchCall?.[1]).toMatchObject({ codigosbairros: '99' });
  });

  it('returns [] without calling the main search when city lookup succeeds but city is not in catalog', async () => {
    // Lookup returns empty cidades array — city not in Imoview
    const post = searchPost([], []);
    const results = await new PropertyService(clientWith(post)).search({ city: 'São Paulo' });
    expect(results).toEqual([]);
    const mainSearch = post.mock.calls.find(
      ([path]: string[]) => path === '/Imovel/RetornarImoveisDisponiveis',
    );
    expect(mainSearch).toBeUndefined();
  });

  it('proceeds with search (fail open) when city lookup throws', async () => {
    const post = vi.fn().mockImplementation((path: string) => {
      if (path === '/Imovel/PesquisarCidadeEBairrosDisponiveis') {
        return Promise.reject(new Error('timeout'));
      }
      return Promise.resolve({ data: { lista: [] } });
    });
    const results = await new PropertyService(clientWith(post)).search({ city: 'São Paulo' });
    expect(results).toEqual([]);
    const mainSearch = post.mock.calls.find(
      ([path]: string[]) => path === '/Imovel/RetornarImoveisDisponiveis',
    );
    // Fail open: main search still runs without city filter
    expect(mainSearch).toBeDefined();
  });
});

describe('PropertyService backed by the Imoview API', () => {
  it('search sends a POST with the correct body and normalizes the response', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        quantidade: 1,
        lista: [
          {
            codigo: 100,
            tipo: 'Apartamento',
            finalidade: 'Aluguel',
            cidade: 'Belo Horizonte',
            bairro: 'Lourdes',
            endereco: 'Rua X',
            numero: '10',
            valor: 'R$ 2.500,50',
            areainterna: '80',
            numeroquartos: '3',
            numerobanhos: '2',
            numerovagas: '1',
            piscina: true,
            academia: true,
            descricao: 'Lindo apê',
            fotos: [{ url: 'http://img/1.jpg' }, { url: 'http://img/2.jpg' }],
          },
        ],
      },
    });

    const results = await new PropertyService(clientWith(post)).search({
      transaction: 'aluguel',
      minPrice: 1000,
      maxPrice: 5000,
      minBedrooms: 2,
      minArea: 50,
    });

    expect(post).toHaveBeenCalledWith('/Imovel/RetornarImoveisDisponiveis', {
      finalidade: 1,
      valorde: 1000,
      valorate: 5000,
      numeroquartos: 2,
      areaprincipalde: 50,
      numeroPagina: 1,
      numeroRegistros: config.chatbot.maxPropertiesPerReply,
    });

    expect(results).toEqual([
      {
        code: '100',
        type: 'Apartamento',
        transaction: 'aluguel',
        city: 'Belo Horizonte',
        neighborhood: 'Lourdes',
        address: 'Rua X, 10',
        price: 2500.5,
        area: 80,
        bedrooms: 3,
        bathrooms: 2,
        parkingSpaces: 1,
        amenities: ['Piscina', 'Academia'],
        description: 'Lindo apê',
        photos: ['http://img/1.jpg', 'http://img/2.jpg'],
      },
    ]);
  });

  it('search sends finalidade=2 for venda and omits optional filters when absent', async () => {
    const post = vi.fn().mockResolvedValue({ data: { lista: [] } });
    await new PropertyService(clientWith(post)).search({});
    expect(post).toHaveBeenCalledWith('/Imovel/RetornarImoveisDisponiveis', {
      finalidade: 2,
      numeroPagina: 1,
      numeroRegistros: config.chatbot.maxPropertiesPerReply,
    });
  });

  it('search returns [] for an empty lista', async () => {
    const post = vi.fn().mockResolvedValue({ data: { lista: [] } });
    await expect(new PropertyService(clientWith(post)).search({})).resolves.toEqual([]);
  });

  it('search returns [] for an unrecognised response shape', async () => {
    const post = vi.fn().mockResolvedValue({ data: 'oops' });
    await expect(new PropertyService(clientWith(post)).search({})).resolves.toEqual([]);
  });

  it('normalizes "Venda" finalidade to transaction=venda', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { lista: [{ codigo: 1, finalidade: 'Venda', tipo: 'Casa' }] },
    });
    const [p] = await new PropertyService(clientWith(post)).search({});
    expect(p?.transaction).toBe('venda');
  });

  it('falls back to areaprincipal when areainterna is absent', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { lista: [{ codigo: 2, finalidade: 'Venda', areaprincipal: '120' }] },
    });
    const [p] = await new PropertyService(clientWith(post)).search({});
    expect(p?.area).toBe(120);
  });

  it('parses Brazilian currency format (R$ 1.200,00)', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { lista: [{ codigo: 3, finalidade: 'Venda', valor: 'R$ 1.200,00' }] },
    });
    const [p] = await new PropertyService(clientWith(post)).search({});
    expect(p?.price).toBe(1200);
  });

  it('falls back to urlfotoprincipal when fotos array is absent', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        lista: [{ codigo: 4, finalidade: 'Venda', urlfotoprincipal: 'http://img/main.jpg' }],
      },
    });
    const [p] = await new PropertyService(clientWith(post)).search({});
    expect(p?.photos).toEqual(['http://img/main.jpg']);
  });

  it('normalizes missing/blank fields to null and empty arrays', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { lista: [{ codigo: 'X1', tipo: '', areainterna: 'not-a-number' }] },
    });
    const [p] = await new PropertyService(clientWith(post)).search({});
    expect(p).toEqual({
      code: 'X1',
      type: null,
      transaction: 'venda',
      city: null,
      neighborhood: null,
      address: null,
      price: null,
      area: null,
      bedrooms: null,
      bathrooms: null,
      parkingSpaces: null,
      amenities: [],
      description: '',
      photos: [],
    });
  });

  it('respects the maximum results limit', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ codigo: i + 1, finalidade: 'Venda' }));
    const post = vi.fn().mockResolvedValue({ data: { lista: many } });
    const results = await new PropertyService(clientWith(post)).search({});
    expect(results).toHaveLength(config.chatbot.maxPropertiesPerReply);
  });

  it('getByCode calls GET with codigoImovel param and normalizes the response', async () => {
    const get = vi.fn().mockResolvedValue({
      data: { codigo: 101, tipo: 'Apartamento', finalidade: 'Venda' },
    });
    const result = await new PropertyService(clientWith(vi.fn(), get)).getByCode('101');
    expect(get).toHaveBeenCalledWith('/Imovel/RetornarDetalhesImovelDisponivel', {
      params: { codigoImovel: '101' },
    });
    expect(result).toMatchObject({ code: '101', type: 'Apartamento', transaction: 'venda' });
  });

  it('getByCode returns null for an empty response', async () => {
    const get = vi.fn().mockResolvedValue({ data: null });
    const result = await new PropertyService(clientWith(vi.fn(), get)).getByCode('999');
    expect(result).toBeNull();
  });
});

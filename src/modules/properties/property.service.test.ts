import type { AxiosInstance } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { PropertyService } from './property.service';

function mutateSrp(patch: { enabled?: boolean; apiUrl?: string; apiKey?: string }) {
  Object.assign(config.srProprietario as unknown as Record<string, unknown>, patch);
}

afterEach(() => {
  mutateSrp({ enabled: false, apiUrl: undefined, apiKey: undefined });
});

function clientWith(get: ReturnType<typeof vi.fn>) {
  return { get } as unknown as AxiosInstance;
}

describe('PropertyService falling back to the sample catalogue', () => {
  it('search returns sample properties when the API is not configured', async () => {
    const results = await new PropertyService().search({ transaction: 'venda' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.transaction === 'venda')).toBe(true);
  });

  it('getByCode returns a sample property or null', async () => {
    const service = new PropertyService();
    expect(await service.getByCode('AP001')).toMatchObject({ code: 'AP001' });
    expect(await service.getByCode('ZZZ999')).toBeNull();
  });

  it('builds an HTTP client when SR Proprietário is enabled', () => {
    mutateSrp({ enabled: true, apiUrl: 'https://sr.example.com', apiKey: 'k' });
    expect(() => new PropertyService()).not.toThrow();
  });

  it('builds an HTTP client even when the API key is absent', () => {
    mutateSrp({ enabled: true, apiUrl: 'https://sr.example.com', apiKey: undefined });
    expect(() => new PropertyService()).not.toThrow();
  });
});

describe('PropertyService backed by the API', () => {
  it('search forwards filters and normalizes the response array', async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          codigo: 'AP100',
          tipo: 'Apartamento',
          finalidade: 'aluguel',
          cidade: 'Belo Horizonte',
          bairro: 'Lourdes',
          endereco: 'Rua X, 10',
          valor: '2500.50',
          area: '80',
          quartos: '3',
          banheiros: 2,
          vagas: '1',
          amenidades: ['piscina', 42, 'academia'],
          descricao: 'Lindo apê',
          fotos: ['http://img/1.jpg', null],
        },
      ],
    });
    const results = await new PropertyService(clientWith(get)).search({
      transaction: 'aluguel',
      type: 'apartamento',
      city: 'Belo Horizonte',
      neighborhood: 'Lourdes',
      minPrice: 1000,
      maxPrice: 5000,
      minBedrooms: 2,
      minArea: 50,
    });
    expect(get).toHaveBeenCalledWith('/imoveis', {
      params: expect.objectContaining({
        finalidade: 'aluguel',
        tipo: 'apartamento',
        cidade: 'Belo Horizonte',
        bairro: 'Lourdes',
        valor_min: 1000,
        valor_max: 5000,
        quartos: 2,
        area_min: 50,
        status: 'disponivel',
      }),
    });
    expect(results).toEqual([
      {
        code: 'AP100',
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
        amenities: ['piscina', 'academia'],
        description: 'Lindo apê',
        photos: ['http://img/1.jpg'],
      },
    ]);
  });

  it('search handles an empty filter set and an { imoveis: [] } envelope', async () => {
    const get = vi.fn().mockResolvedValue({ data: { imoveis: [] } });
    await expect(new PropertyService(clientWith(get)).search({})).resolves.toEqual([]);
    expect(get.mock.calls[0]?.[1]).toEqual({ params: { status: 'disponivel', limite: 3 } });
  });

  it('search reads a { data: [] } envelope', async () => {
    const get = vi.fn().mockResolvedValue({ data: { data: [{ id: 7 }] } });
    const results = await new PropertyService(clientWith(get)).search({});
    expect(results[0]).toMatchObject({ code: '7', transaction: 'venda' });
  });

  it('search returns [] for an unrecognised response shape', async () => {
    const get = vi.fn().mockResolvedValue({ data: 'oops' });
    await expect(new PropertyService(clientWith(get)).search({})).resolves.toEqual([]);
  });

  it('falls back to an empty code when no code-like field is present', async () => {
    const get = vi.fn().mockResolvedValue({ data: [{ tipo: 'Apartamento' }] });
    const [property] = await new PropertyService(clientWith(get)).search({});
    expect(property?.code).toBe('');
    expect(property?.type).toBe('Apartamento');
  });

  it('normalizes properties using alternative field names and defaults', async () => {
    const get = vi.fn().mockResolvedValue({
      data: [
        {
          referencia: 'CS200',
          categoria: 'Casa',
          // no finalidade/modalidade -> defaults to 'venda'
          logradouro: 'Av. Y',
          preco: 750000,
          metragem: 120,
          dormitorios: 4,
          garagem: 2,
          caracteristicas: ['quintal'],
          observacao: 'Casa ampla',
          imagens: ['http://img/casa.jpg'],
        },
      ],
    });
    const [property] = await new PropertyService(clientWith(get)).search({});
    expect(property).toMatchObject({
      code: 'CS200',
      type: 'Casa',
      transaction: 'venda',
      city: null,
      address: 'Av. Y',
      price: 750000,
      area: 120,
      bedrooms: 4,
      parkingSpaces: 2,
      amenities: ['quintal'],
      description: 'Casa ampla',
      photos: ['http://img/casa.jpg'],
    });
  });

  it('normalizes missing/blank fields to null and empty arrays', async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ data: [{ codigo: 'X1', tipo: '', area: 'not-a-number' }] });
    const [property] = await new PropertyService(clientWith(get)).search({});
    expect(property).toEqual({
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
    const many = Array.from({ length: 10 }, (_, i) => ({ codigo: `AP${i}` }));
    const get = vi.fn().mockResolvedValue({ data: many });
    const results = await new PropertyService(clientWith(get)).search({});
    expect(results).toHaveLength(config.chatbot.maxPropertiesPerReply);
  });

  it('getByCode reads the { imovel: {...} } envelope', async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ data: { imovel: { codigo: 'AP001', tipo: 'Apartamento' } } });
    await expect(new PropertyService(clientWith(get)).getByCode('AP001')).resolves.toMatchObject({
      code: 'AP001',
      type: 'Apartamento',
    });
    expect(get).toHaveBeenCalledWith('/imoveis/AP001');
  });

  it('getByCode reads a flat response and URL-encodes the code', async () => {
    const get = vi.fn().mockResolvedValue({ data: { id: 555 } });
    await expect(new PropertyService(clientWith(get)).getByCode('A/B 1')).resolves.toMatchObject({
      code: '555',
    });
    expect(get).toHaveBeenCalledWith('/imoveis/A%2FB%201');
  });
});

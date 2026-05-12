import type { AxiosInstance } from 'axios';
import { config } from '../../config';
import { createHttpClient } from '../../lib/http-client';
import { logger } from '../../lib/logger';
import { findSampleProperty, searchSampleProperties } from './property.fixtures';
import type { Property, PropertySearchFilters, PropertyTransaction } from './property.types';

const log = logger.child({ module: 'properties' });

interface RawProperty {
  [key: string]: unknown;
}

/**
 * Property catalogue backed by the SR Proprietário API.
 *
 * When the integration is not configured the service falls back to a small
 * built-in sample catalogue so the chatbot remains usable in demos / local dev.
 *
 * The exact request params and response shape vary by SR Proprietário API
 * version — adjust {@link toSearchParams} and {@link normalizeProperty}.
 */
export class PropertyService {
  private readonly client: AxiosInstance | null;
  private readonly maxResults: number;

  constructor(client?: AxiosInstance) {
    this.maxResults = config.chatbot.maxPropertiesPerReply;
    if (client) {
      this.client = client;
    } else if (config.srProprietario.enabled) {
      this.client = createHttpClient({
        serviceName: 'sr-proprietario',
        baseURL: config.srProprietario.apiUrl,
        headers: {
          Authorization: `Bearer ${config.srProprietario.apiKey ?? ''}`,
          'Content-Type': 'application/json',
        },
      });
    } else {
      this.client = null;
    }
  }

  async search(filters: PropertySearchFilters): Promise<Property[]> {
    if (!this.client) {
      log.warn('SR Proprietário não configurado — usando catálogo de exemplo');
      return searchSampleProperties(filters, this.maxResults);
    }

    const { data } = await this.client.get<unknown>('/imoveis', {
      params: this.toSearchParams(filters),
    });
    const items = extractList(data);
    return items.slice(0, this.maxResults).map((item) => normalizeProperty(item));
  }

  async getByCode(code: string): Promise<Property | null> {
    if (!this.client) {
      return findSampleProperty(code);
    }

    const { data } = await this.client.get<RawProperty>(`/imoveis/${encodeURIComponent(code)}`);
    const raw = (data.imovel as RawProperty | undefined) ?? data;
    return normalizeProperty(raw);
  }

  private toSearchParams(filters: PropertySearchFilters): Record<string, unknown> {
    return {
      ...(filters.transaction && { finalidade: filters.transaction }),
      ...(filters.type && { tipo: filters.type }),
      ...(filters.city && { cidade: filters.city }),
      ...(filters.neighborhood && { bairro: filters.neighborhood }),
      ...(filters.minPrice != null && { valor_min: filters.minPrice }),
      ...(filters.maxPrice != null && { valor_max: filters.maxPrice }),
      ...(filters.minBedrooms != null && { quartos: filters.minBedrooms }),
      ...(filters.minArea != null && { area_min: filters.minArea }),
      status: 'disponivel',
      limite: this.maxResults,
    };
  }
}

function extractList(data: unknown): RawProperty[] {
  if (Array.isArray(data)) return data as RawProperty[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.imoveis)) return obj.imoveis as RawProperty[];
    if (Array.isArray(obj.data)) return obj.data as RawProperty[];
  }
  return [];
}

function normalizeProperty(raw: RawProperty): Property {
  return {
    code: asScalarString(pick(raw, 'codigo', 'id', 'referencia')) ?? '',
    type: asString(pick(raw, 'tipo', 'categoria')),
    transaction:
      (asString(pick(raw, 'finalidade', 'modalidade')) as PropertyTransaction) || 'venda',
    city: asString(raw.cidade),
    neighborhood: asString(raw.bairro),
    address: asString(pick(raw, 'endereco', 'logradouro')),
    price: asNumber(pick(raw, 'valor', 'preco')),
    area: asNumber(pick(raw, 'area', 'metragem', 'area_util')),
    bedrooms: asInt(pick(raw, 'quartos', 'dormitorios')),
    bathrooms: asInt(raw.banheiros),
    parkingSpaces: asInt(pick(raw, 'vagas', 'garagem')),
    amenities: asStringArray(pick(raw, 'amenidades', 'caracteristicas')),
    description: asString(pick(raw, 'descricao', 'observacao')) ?? '',
    photos: asStringArray(pick(raw, 'fotos', 'imagens')),
  };
}

function pick(raw: RawProperty, ...keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] != null) return raw[key];
  }
  return undefined;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asScalarString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  const n =
    typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function asInt(value: unknown): number | null {
  const n = asNumber(value);
  return n == null ? null : Math.trunc(n);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

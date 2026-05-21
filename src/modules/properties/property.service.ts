import type { AxiosInstance } from 'axios';
import { config } from '../../config';
import { createHttpClient } from '../../lib/http-client';
import { toErrorMeta } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { findSampleProperty, searchSampleProperties } from './property.fixtures';
import type { Property, PropertySearchFilters, PropertyTransaction } from './property.types';

const log = logger.child({ module: 'properties' });

interface RawProperty {
  [key: string]: unknown;
}

interface LocationSearchResponse {
  cidades?: Array<{ codigo: number; nome: string; estado: string }>;
  bairros?: Array<{ codigo: number; nome: string; cidade: string; estado: string }>;
}

interface LocationCodes {
  codigocidade?: number;
  codigosbairros?: string;
  /** True when the city lookup ran successfully but the city is not in the Imoview catalog.
   *  Distinct from an API error (which fails open). */
  cityNotInCatalog?: boolean;
}

/**
 * Property catalogue backed by the Imoview API.
 *
 * Search  → POST /Imovel/RetornarImoveisDisponiveis (body JSON)
 * Details → GET  /Imovel/RetornarDetalhesImovelDisponivel?codigoImovel=X
 *
 * City/neighborhood names are resolved to Imoview numeric codes via
 * POST /Imovel/PesquisarCidadeEBairrosDisponiveis before each search.
 * Lookup failures are silent — the search proceeds without location filters.
 *
 * Falls back to a small built-in sample catalogue when the integration is
 * not configured, so the chatbot remains usable in demos / local dev.
 */
export class PropertyService {
  private readonly client: AxiosInstance | null;
  private readonly maxResults: number;

  constructor(client?: AxiosInstance) {
    this.maxResults = config.chatbot.maxPropertiesPerReply;
    if (client) {
      this.client = client;
    } else if (config.imoview.enabled) {
      this.client = createHttpClient({
        serviceName: 'imoview-catalog',
        baseURL: config.imoview.apiUrl,
        headers: {
          chave: config.imoview.apiKey ?? '',
          'Content-Type': 'application/json',
        },
      });
    } else {
      this.client = null;
    }
  }

  async search(filters: PropertySearchFilters): Promise<Property[]> {
    if (!this.client) {
      log.warn('Imoview não configurado — usando catálogo de exemplo');
      return searchSampleProperties(filters, this.maxResults);
    }

    const finalidade: 1 | 2 = filters.transaction === 'aluguel' ? 1 : 2;
    const locationCodes = await this.resolveLocationCodes(filters, finalidade);

    if (locationCodes.cityNotInCatalog) {
      log.debug('Cidade não encontrada no catálogo Imoview — retornando vazio', {
        city: filters.city,
      });
      return [];
    }

    const { data } = await this.client.post<unknown>(
      '/Imovel/RetornarImoveisDisponiveis',
      this.toSearchBody(filters, finalidade, locationCodes),
    );

    const items = extractList(data);
    return items.slice(0, this.maxResults).map((item) => normalizeProperty(item));
  }

  async getByCode(code: string): Promise<Property | null> {
    if (!this.client) {
      return findSampleProperty(code);
    }

    const { data } = await this.client.get<unknown>('/Imovel/RetornarDetalhesImovelDisponivel', {
      params: { codigoImovel: code },
    });

    if (!data || typeof data !== 'object') return null;
    return normalizeProperty(data as RawProperty);
  }

  /**
   * Resolves city/neighborhood text to Imoview numeric codes via
   * PesquisarCidadeEBairrosDisponiveis (text search, min 3 chars).
   *
   * Strategy:
   * 1. If neighborhood provided: search by neighborhood; use city to disambiguate
   *    when multiple matches exist (e.g. "Centro" in several cities).
   * 2. If neighborhood not found or not provided, and city is provided:
   *    search by city and use the city code.
   */
  private async resolveLocationCodes(
    filters: PropertySearchFilters,
    finalidade: 1 | 2,
  ): Promise<LocationCodes> {
    const { city, neighborhood } = filters;
    if (!city && !neighborhood) return {};

    const codes: LocationCodes = {};

    if (neighborhood && neighborhood.length >= 3) {
      try {
        const { data } = await this.client!.post<LocationSearchResponse>(
          '/Imovel/PesquisarCidadeEBairrosDisponiveis',
          { finalidade, textoPesquisa: neighborhood },
        );
        const bairros = data.bairros ?? [];
        const match =
          // exact match + city disambiguation (e.g. "Centro" in "Belo Horizonte")
          (city
            ? bairros.find(
                (b) =>
                  normalizeText(b.nome) === normalizeText(neighborhood) &&
                  normalizeText(b.cidade).includes(normalizeText(city)),
              )
            : undefined) ??
          // exact match without city
          bairros.find((b) => normalizeText(b.nome) === normalizeText(neighborhood)) ??
          // partial match
          bairros.find((b) => normalizeText(b.nome).includes(normalizeText(neighborhood))) ??
          // first result as fallback
          bairros[0];

        if (match) {
          codes.codigosbairros = String(match.codigo);
          log.debug('Bairro resolvido', {
            input: neighborhood,
            match: match.nome,
            codigo: match.codigo,
          });
        }
      } catch (error) {
        log.warn('Falha ao resolver código do bairro', toErrorMeta(error));
      }
    }

    // City lookup: only when no neighborhood code was resolved
    if (city && city.length >= 3 && !codes.codigosbairros) {
      try {
        const { data } = await this.client!.post<LocationSearchResponse>(
          '/Imovel/PesquisarCidadeEBairrosDisponiveis',
          { finalidade, textoPesquisa: city },
        );
        const cidades = data.cidades ?? [];
        const match =
          cidades.find((c) => normalizeText(c.nome) === normalizeText(city)) ??
          cidades.find((c) => normalizeText(c.nome).includes(normalizeText(city))) ??
          cidades[0];

        if (match) {
          codes.codigocidade = match.codigo;
          log.debug('Cidade resolvida', { input: city, match: match.nome, codigo: match.codigo });
        } else {
          // API responded but this city is not in the Imoview catalog.
          // Mark it so the search does not run without a city filter (which would return all cities).
          codes.cityNotInCatalog = true;
          log.debug('Cidade não encontrada no catálogo Imoview', { input: city });
        }
      } catch (error) {
        // API error → fail open: search proceeds without city filter.
        log.warn('Falha ao resolver código da cidade', toErrorMeta(error));
      }
    }

    return codes;
  }

  private toSearchBody(
    filters: PropertySearchFilters,
    finalidade: 1 | 2,
    locationCodes: LocationCodes,
  ): Record<string, unknown> {
    return {
      // 1 = ALUGUEL, 2 = VENDA (required by Imoview)
      finalidade,
      ...(locationCodes.codigocidade != null && { codigocidade: locationCodes.codigocidade }),
      ...(locationCodes.codigosbairros && { codigosbairros: locationCodes.codigosbairros }),
      ...(filters.minBedrooms != null && { numeroquartos: filters.minBedrooms }),
      ...(filters.minPrice != null && { valorde: filters.minPrice }),
      ...(filters.maxPrice != null && { valorate: filters.maxPrice }),
      ...(filters.minArea != null && { areaprincipalde: filters.minArea }),
      numeroPagina: 1,
      numeroRegistros: this.maxResults,
    };
  }
}

/** Lowercase + strip accents for fuzzy comparison. */
function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractList(data: unknown): RawProperty[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.lista)) return obj.lista as RawProperty[];
  if (Array.isArray(obj.data)) return obj.data as RawProperty[];
  if (Array.isArray(data)) return data as RawProperty[];
  return [];
}

function normalizeProperty(raw: RawProperty): Property {
  const codigo = raw.codigo;
  const code = typeof codigo === 'number' ? String(codigo) : (asScalarString(codigo) ?? '');

  const finalidade = asString(raw.finalidade)?.toLowerCase() ?? '';
  const transaction: PropertyTransaction = finalidade.includes('alug') ? 'aluguel' : 'venda';

  const addressParts = [asString(raw.endereco), asString(raw.numero)].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : null;

  return {
    code,
    type: asString(raw.tipo),
    transaction,
    city: asString(raw.cidade),
    neighborhood: asString(raw.bairro),
    address,
    price: parseBrazilianNumber(raw.valor),
    area:
      parseBrazilianNumber(raw.areainterna) ??
      parseBrazilianNumber(raw.areaprincipal) ??
      parseBrazilianNumber(raw.area),
    bedrooms: asInt(raw.numeroquartos),
    bathrooms: asInt(raw.numerobanhos),
    parkingSpaces: asInt(raw.numerovagas),
    amenities: extractAmenities(raw),
    description: asString(raw.descricao) ?? '',
    photos: extractPhotos(raw),
  };
}

const AMENITY_FIELDS: Record<string, string> = {
  piscina: 'Piscina',
  academia: 'Academia',
  churrasqueira: 'Churrasqueira',
  playground: 'Playground',
  quadraesportiva: 'Quadra esportiva',
  salaofestas: 'Salão de festas',
  sauna: 'Sauna',
  portaria24horas: 'Portaria 24h',
  hidromassagem: 'Hidromassagem',
  espacogourmet: 'Espaço gourmet',
  varandagourmet: 'Varanda gourmet',
  mobiliado: 'Mobiliado',
  jardim: 'Jardim',
  wifi: 'Wi-Fi',
};

function extractAmenities(raw: RawProperty): string[] {
  return Object.entries(AMENITY_FIELDS)
    .filter(([key]) => raw[key] === true)
    .map(([, label]) => label);
}

function extractPhotos(raw: RawProperty): string[] {
  const fotos = raw.fotos;
  if (Array.isArray(fotos)) {
    return fotos
      .map((f) => {
        if (typeof f === 'string') return f;
        if (f && typeof f === 'object') {
          const obj = f as Record<string, unknown>;
          return asString(obj.url) ?? asString(obj.urlthumbnail);
        }
        return null;
      })
      .filter((url): url is string => url !== null);
  }
  const main = asString(raw.urlfotoprincipal);
  return main ? [main] : [];
}

/** Parses a Brazilian-formatted number string ("R$ 1.200,50" or "1200.50"). */
function parseBrazilianNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.length === 0) return null;
  const normalized = value
    .replace(/[R$\s]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(',', '.');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asScalarString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === 'string' && value.length > 0) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

import { z } from 'zod';
import { logger } from '../../lib/logger';
import { toErrorMeta } from '../../lib/errors';
import type { ChatTool } from '../ai/ai.types';
import {
  ConversationState,
  type ConversationRepository,
} from '../conversations/conversation.repository';
import type { LeadService } from '../leads/lead.service';
import type { PropertyService } from '../properties/property.service';
import type { Property, PropertySearchFilters } from '../properties/property.types';
import type { WhatsAppService } from '../whatsapp/whatsapp.service';
import { toPropertyDigest } from './chat.types';

const log = logger.child({ module: 'chat.tools' });

export interface ChatToolsDeps {
  conversations: ConversationRepository;
  properties: PropertyService;
  leads: LeadService;
  whatsapp: WhatsAppService;
}

const searchArgsSchema = z.object({
  modalidade: z.enum(['venda', 'aluguel']).optional(),
  tipo: z.string().optional(),
  cidade: z.string().optional(),
  bairro: z.string().optional(),
  preco_min: z.coerce.number().optional(),
  preco_max: z.coerce.number().optional(),
  quartos_min: z.coerce.number().int().optional(),
  metragem_min: z.coerce.number().optional(),
});

const detailsArgsSchema = z.object({ codigo: z.string().min(1) });

const scheduleArgsSchema = z.object({
  imovel_codigo: z.string().min(1),
  cliente_nome: z.string().min(1),
  cliente_telefone: z.string().optional(),
  cliente_email: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().email().optional(),
  ),
  data_preferida: z.string().optional(),
});

const transferArgsSchema = z.object({ motivo: z.string().optional() });

/** Builds the set of tools exposed to the LLM for one inbound conversation turn. */
export function buildChatTools(deps: ChatToolsDeps, phoneNumber: string): ChatTool[] {
  return [
    {
      definition: {
        name: 'buscar_imoveis',
        description: 'Busca imóveis disponíveis com base nos critérios do cliente',
        parameters: {
          type: 'object',
          properties: {
            modalidade: {
              type: 'string',
              enum: ['venda', 'aluguel'],
              description: 'Se o cliente quer comprar ou alugar',
            },
            tipo: {
              type: 'string',
              description: 'Tipo do imóvel: apartamento, casa, comercial, terreno, etc.',
            },
            cidade: { type: 'string', description: 'Cidade onde o cliente quer o imóvel' },
            bairro: { type: 'string', description: 'Bairro específico, se mencionado' },
            preco_min: { type: 'number', description: 'Preço mínimo em reais' },
            preco_max: { type: 'number', description: 'Preço máximo em reais' },
            quartos_min: { type: 'integer', description: 'Número mínimo de quartos' },
            metragem_min: { type: 'number', description: 'Metragem mínima em m²' },
          },
        },
      },
      handler: async (rawArgs) => {
        const parsed = searchArgsSchema.safeParse(rawArgs);
        if (!parsed.success) return { erro: 'Critérios de busca inválidos', imoveis: [] };

        const filters: PropertySearchFilters = {
          transaction: parsed.data.modalidade,
          type: parsed.data.tipo,
          city: parsed.data.cidade,
          neighborhood: parsed.data.bairro,
          minPrice: parsed.data.preco_min,
          maxPrice: parsed.data.preco_max,
          minBedrooms: parsed.data.quartos_min,
          minArea: parsed.data.metragem_min,
        };

        try {
          const properties = await deps.properties.search(filters);

          if (properties.length > 0) {
            for (const p of properties) {
              await deps.conversations.addViewedProperty(phoneNumber, p.code);
            }
            dispatchPropertyMedia(deps.whatsapp, phoneNumber, properties);
            return { imoveis: properties.map(toPropertyDigest), total: properties.length };
          }

          // No results — run a cascade of progressively relaxed searches.
          const hasCharacteristics =
            filters.minBedrooms != null ||
            filters.minPrice != null ||
            filters.maxPrice != null ||
            filters.minArea != null ||
            filters.type != null;

          // Location-only filters (strip price / bedrooms / area / type).
          const locationFilters: PropertySearchFilters = {
            transaction: filters.transaction,
            city: filters.city,
            neighborhood: filters.neighborhood,
          };

          // Step 1: same location, relax characteristic filters.
          if (hasCharacteristics) {
            const similar = await deps.properties.search(locationFilters);
            if (similar.length > 0) {
              for (const p of similar) await deps.conversations.addViewedProperty(phoneNumber, p.code);
              dispatchPropertyMedia(deps.whatsapp, phoneNumber, similar);
              return {
                sugestaoSimilar: true,
                imoveis: similar.map(toPropertyDigest),
                total: similar.length,
              };
            }
          }

          // Step 2: city only (drop neighborhood), keeping characteristics removed.
          if (filters.neighborhood && filters.city) {
            const cityOnly = await deps.properties.search({
              ...locationFilters,
              neighborhood: undefined,
            });
            if (cityOnly.length > 0) {
              for (const p of cityOnly) await deps.conversations.addViewedProperty(phoneNumber, p.code);
              dispatchPropertyMedia(deps.whatsapp, phoneNumber, cityOnly);
              return {
                semResultadoNoBairro: true,
                sugestaoSimilar: hasCharacteristics,
                bairro: filters.neighborhood,
                cidade: filters.city,
                imoveis: cityOnly.map(toPropertyDigest),
                total: cityOnly.length,
              };
            }
          }

          return {
            semResultado: true,
            cidade: filters.city ?? null,
            bairro: filters.neighborhood ?? null,
            imoveis: [],
          };
        } catch (error) {
          log.error('Falha na busca de imóveis', toErrorMeta(error));
          return { erro: 'Não foi possível buscar imóveis no momento.', imoveis: [] };
        }
      },
    },

    {
      definition: {
        name: 'obter_detalhes_imovel',
        description: 'Obtém informações detalhadas de um imóvel específico pelo código',
        parameters: {
          type: 'object',
          properties: { codigo: { type: 'string', description: 'Código do imóvel' } },
          required: ['codigo'],
        },
      },
      handler: async (rawArgs) => {
        const parsed = detailsArgsSchema.safeParse(rawArgs);
        if (!parsed.success) return { erro: 'Código do imóvel inválido' };
        try {
          const property = await deps.properties.getByCode(parsed.data.codigo);
          if (!property) return { erro: 'Imóvel não encontrado' };
          return { imovel: toPropertyDigest(property) };
        } catch (error) {
          log.error('Falha ao obter detalhes do imóvel', toErrorMeta(error));
          return { erro: 'Não foi possível obter os detalhes agora.' };
        }
      },
    },

    {
      definition: {
        name: 'agendar_visita',
        description: 'Agenda uma visita a um imóvel e registra o lead no CRM',
        parameters: {
          type: 'object',
          properties: {
            imovel_codigo: { type: 'string', description: 'Código do imóvel a ser visitado' },
            cliente_nome: { type: 'string', description: 'Nome completo do cliente' },
            cliente_telefone: {
              type: 'string',
              description: 'Número de WhatsApp do cliente (com DDD)',
            },
            cliente_email: { type: 'string', description: 'E-mail do cliente' },
            data_preferida: {
              type: 'string',
              description: 'Data e hora preferida (formato: DD/MM/YYYY HH:MM)',
            },
          },
          required: ['imovel_codigo', 'cliente_nome'],
        },
      },
      handler: async (rawArgs) => {
        const parsed = scheduleArgsSchema.safeParse(rawArgs);
        if (!parsed.success)
          return { sucesso: false, erro: 'Dados do agendamento incompletos ou inválidos.' };

        const { imovel_codigo, cliente_nome, cliente_telefone, cliente_email, data_preferida } =
          parsed.data;
        try {
          await deps.conversations.updateClientInfo(phoneNumber, {
            name: cliente_nome,
            email: cliente_email,
          });
          const scheduledAt = data_preferida ? parseBrazilianDateTime(data_preferida) : null;

          await deps.leads.scheduleVisit({
            phoneNumber: cliente_telefone || phoneNumber,
            name: cliente_nome,
            email: cliente_email,
            propertyCode: imovel_codigo,
            scheduledAt,
          });

          await deps.conversations.updateState(phoneNumber, ConversationState.SCHEDULED);
          log.info('Visita agendada', { phoneNumber, propertyCode: imovel_codigo });

          return {
            sucesso: true,
            mensagem: `Visita agendada com sucesso para ${cliente_nome} ao imóvel ${imovel_codigo}${
              data_preferida ? ` em ${data_preferida}` : ''
            }. Nossa equipe entrará em contato para confirmar.`,
          };
        } catch (error) {
          log.error('Falha ao agendar visita', toErrorMeta(error));
          return {
            sucesso: false,
            erro: 'Não foi possível agendar a visita automaticamente. Nossa equipe entrará em contato.',
          };
        }
      },
    },

    {
      definition: {
        name: 'transferir_para_humano',
        description: 'Transfere o atendimento para um corretor humano',
        parameters: {
          type: 'object',
          properties: { motivo: { type: 'string', description: 'Motivo da transferência' } },
        },
      },
      handler: async (rawArgs) => {
        const parsed = transferArgsSchema.safeParse(rawArgs);
        const motivo = parsed.success ? parsed.data.motivo : undefined;
        await deps.conversations.updateState(phoneNumber, ConversationState.TRANSFERRED);
        log.info('Conversa transferida para humano', { phoneNumber, motivo });
        return {
          transferido: true,
          mensagem:
            'Conversa marcada para atendimento humano. Um corretor entrará em contato em breve.',
        };
      },
    },
  ];
}

/**
 * Fire-and-forget delivery of property photos. The conversation flow does not
 * wait for it, but any failure is contained and logged here.
 */
function dispatchPropertyMedia(
  whatsapp: WhatsAppService,
  phoneNumber: string,
  properties: Property[],
): void {
  void whatsapp.sendProperties(phoneNumber, properties).catch((error: unknown) => {
    log.error('Falha ao enviar mídia dos imóveis', { phoneNumber, ...toErrorMeta(error) });
  });
}

/** Parses "DD/MM/YYYY" or "DD/MM/YYYY HH:MM" into a Date (defaults to 10:00). */
export function parseBrazilianDateTime(value: string): Date | null {
  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour = '10', minute = '00'] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

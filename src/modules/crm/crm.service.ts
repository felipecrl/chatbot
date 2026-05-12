import type { AxiosInstance } from 'axios';
import { config } from '../../config';
import { createHttpClient } from '../../lib/http-client';
import { toErrorMeta } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { CrmAppointmentInput, CrmLeadInput, CrmResult } from './crm.types';

const log = logger.child({ module: 'crm' });

/**
 * Integration with the IMOVIEW CRM.
 *
 * CRM failures must never break the WhatsApp conversation, so every method
 * degrades gracefully: on error it logs and returns `{ id: null }`. Persisting
 * the lead locally is the responsibility of {@link LeadService}.
 *
 * The exact request/response shapes depend on the IMOVIEW API version — adjust
 * the payload fields to match the documentation provided by IMOVIEW.
 */
export class CrmService {
  private readonly client: AxiosInstance | null;

  constructor(client?: AxiosInstance) {
    if (client) {
      this.client = client;
    } else if (config.imoview.enabled) {
      this.client = createHttpClient({
        serviceName: 'imoview',
        baseURL: config.imoview.apiUrl,
        headers: {
          Authorization: `Bearer ${config.imoview.apiKey ?? ''}`,
          'Content-Type': 'application/json',
        },
      });
    } else {
      this.client = null;
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async createLead(input: CrmLeadInput): Promise<CrmResult> {
    if (!this.client) {
      log.warn('IMOVIEW não configurado — lead mantido apenas localmente');
      return { id: null };
    }

    try {
      const { data } = await this.client.post<Record<string, unknown>>('/leads', {
        empresa_id: config.imoview.empresaId,
        nome: input.name,
        telefone: input.phoneNumber,
        email: input.email,
        imovel_codigo: input.propertyCode,
        origem: input.source ?? 'WhatsApp Chatbot',
        canal: 'whatsapp',
      });
      const id = extractId(data);
      log.info('Lead criado no IMOVIEW', { crmLeadId: id, phoneNumber: input.phoneNumber });
      return { id };
    } catch (error) {
      log.error('Falha ao criar lead no IMOVIEW', toErrorMeta(error));
      return { id: null };
    }
  }

  async createAppointment(input: CrmAppointmentInput): Promise<CrmResult> {
    if (!this.client) {
      log.warn('IMOVIEW não configurado — agendamento mantido apenas localmente');
      return { id: null };
    }

    try {
      const { data } = await this.client.post<Record<string, unknown>>('/agendamentos', {
        empresa_id: config.imoview.empresaId,
        lead_id: input.crmLeadId,
        imovel_codigo: input.propertyCode,
        data_visita: input.scheduledAt?.toISOString() ?? null,
        tipo: 'visita',
        observacao: `Agendado via WhatsApp Chatbot${input.clientName ? ` para ${input.clientName}` : ''}`,
      });
      const id = extractId(data);
      log.info('Agendamento criado no IMOVIEW', {
        crmAppointmentId: id,
        propertyCode: input.propertyCode,
      });
      return { id };
    } catch (error) {
      log.error('Falha ao criar agendamento no IMOVIEW', toErrorMeta(error));
      return { id: null };
    }
  }
}

function extractId(data: Record<string, unknown>): string | null {
  const nested = (data.data as Record<string, unknown> | undefined)?.id;
  const candidate = data.id ?? data.lead_id ?? data.agendamento_id ?? nested;
  if (typeof candidate === 'string') return candidate;
  if (typeof candidate === 'number') return String(candidate);
  return null;
}

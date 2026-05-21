import type { AxiosInstance } from 'axios';
import { config } from '../../config';
import { createHttpClient } from '../../lib/http-client';
import { toErrorMeta } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { CrmAppointmentInput, CrmLeadInput, CrmResult } from './crm.types';

const log = logger.child({ module: 'crm' });

/**
 * Integration with the Imoview CRM.
 *
 * Authentication: header "chave" (API key from Universal Software).
 *
 * CRM failures must never break the WhatsApp conversation, so every method
 * degrades gracefully: on error it logs and returns `{ id: null }`. Persisting
 * the lead locally is the responsibility of {@link LeadService}.
 */
export class CrmService {
  private readonly client: AxiosInstance | null;

  constructor(client?: AxiosInstance) {
    if (client) {
      this.client = client;
    } else if (config.imoview.enabled) {
      this.client = createHttpClient({
        serviceName: 'imoview-crm',
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

  get enabled(): boolean {
    return this.client !== null;
  }

  async createLead(input: CrmLeadInput): Promise<CrmResult> {
    if (!this.client) {
      log.warn('IMOVIEW não configurado — lead mantido apenas localmente');
      return { id: null };
    }

    try {
      const { data } = await this.client.post<Record<string, unknown>>('/Lead/IncluirLead', {
        nome: input.name,
        telefone: input.phoneNumber,
        email: input.email ?? undefined,
        midia: input.source ?? 'WhatsApp Chatbot',
        codigoimovel: input.propertyCode ?? undefined,
      });
      const id = extractId(data);
      log.info('Lead criado no IMOVIEW', { crmLeadId: id, phoneNumber: input.phoneNumber });
      return { id };
    } catch (error) {
      log.error('Falha ao criar lead no IMOVIEW', toErrorMeta(error));
      return { id: null };
    }
  }

  /**
   * Creates a lead + visit appointment in Imoview in a single call
   * (POST /Lead/IncluirAgendamentoVisita).
   *
   * The endpoint requires the date formatted as "dd/mm/yyyy hh:mm".
   */
  async createAppointment(input: CrmAppointmentInput): Promise<CrmResult> {
    if (!this.client) {
      log.warn('IMOVIEW não configurado — agendamento mantido apenas localmente');
      return { id: null };
    }

    try {
      const { data } = await this.client.post<Record<string, unknown>>(
        '/Lead/IncluirAgendamentoVisita',
        {
          nome: input.name ?? undefined,
          telefone: input.phoneNumber ?? undefined,
          email: input.email ?? undefined,
          midia: 'WhatsApp Chatbot',
          codigoimovel: input.propertyCode ?? undefined,
          datahoraagendamentovisita: input.scheduledAt
            ? formatImoviewDate(input.scheduledAt)
            : undefined,
        },
      );
      const id = extractId(data);
      log.info('Agendamento criado no IMOVIEW', { propertyCode: input.propertyCode });
      return { id };
    } catch (error) {
      log.error('Falha ao criar agendamento no IMOVIEW', toErrorMeta(error));
      return { id: null };
    }
  }
}

/** Formats a Date to the "dd/mm/yyyy hh:mm" format expected by Imoview. */
function formatImoviewDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function extractId(data: Record<string, unknown>): string | null {
  const nested = (data.data as Record<string, unknown> | undefined)?.id;
  const candidate = data.id ?? data.lead_id ?? data.agendamento_id ?? nested;
  if (typeof candidate === 'string') return candidate;
  if (typeof candidate === 'number') return String(candidate);
  return null;
}

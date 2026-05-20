import { logger } from '../../lib/logger';
import type { CrmService } from '../crm/crm.service';
import type { LeadRepository } from './lead.repository';
import { LeadStatus } from './lead.repository';
import type { ScheduleVisitInput, ScheduleVisitResult } from './lead.types';

const log = logger.child({ module: 'leads' });

export class LeadService {
  constructor(
    private readonly repository: LeadRepository,
    private readonly crm: CrmService,
  ) {}

  /**
   * Persists the lead/appointment locally first (source of truth) and then
   * best-effort syncs it to Imoview via a single IncluirAgendamentoVisita call,
   * which creates both the lead and the appointment in the CRM atomically.
   * CRM failures are logged but never thrown.
   */
  async scheduleVisit(input: ScheduleVisitInput): Promise<ScheduleVisitResult> {
    const lead = await this.repository.create(
      {
        phoneNumber: input.phoneNumber,
        name: input.name,
        email: input.email,
        propertyCode: input.propertyCode,
        propertyDescription: input.propertyDescription ?? `Imóvel ${input.propertyCode}`,
        scheduledAt: input.scheduledAt,
      },
      LeadStatus.SCHEDULED,
    );

    const appointment = await this.crm.createAppointment({
      name: input.name,
      phoneNumber: input.phoneNumber,
      email: input.email,
      propertyCode: input.propertyCode,
      scheduledAt: input.scheduledAt,
    });

    if (appointment.id) {
      await this.repository.setCrmIds(lead.id, null, appointment.id);
    }

    log.info('Visita registrada', {
      leadId: lead.id,
      crmAppointmentId: appointment.id,
      phoneNumber: input.phoneNumber,
      propertyCode: input.propertyCode,
    });

    return { leadId: lead.id, crmLeadId: null, crmAppointmentId: appointment.id };
  }
}

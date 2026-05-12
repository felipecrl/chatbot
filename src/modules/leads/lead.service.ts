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
   * best-effort syncs it to the CRM. CRM failures are logged but never thrown.
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

    const crmLead = await this.crm.createLead({
      name: input.name,
      phoneNumber: input.phoneNumber,
      email: input.email,
      propertyCode: input.propertyCode,
    });

    let crmAppointmentId: string | null = null;
    if (crmLead.id) {
      const appointment = await this.crm.createAppointment({
        crmLeadId: crmLead.id,
        propertyCode: input.propertyCode,
        scheduledAt: input.scheduledAt,
        clientName: input.name,
      });
      crmAppointmentId = appointment.id;
    }

    if (crmLead.id || crmAppointmentId) {
      await this.repository.setCrmIds(lead.id, crmLead.id, crmAppointmentId);
    }

    log.info('Visita registrada', {
      leadId: lead.id,
      crmLeadId: crmLead.id,
      crmAppointmentId,
      phoneNumber: input.phoneNumber,
      propertyCode: input.propertyCode,
    });

    return { leadId: lead.id, crmLeadId: crmLead.id, crmAppointmentId };
  }
}

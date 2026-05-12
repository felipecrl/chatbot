import type { Lead } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { CrmService } from '../crm/crm.service';
import type { LeadRepository } from './lead.repository';
import { LeadStatus } from './lead.repository';
import { LeadService } from './lead.service';

function makeDeps() {
  const repository = {
    create: vi.fn<(...args: unknown[]) => Promise<Lead>>().mockResolvedValue({ id: 42 } as Lead),
    setCrmIds: vi.fn().mockResolvedValue(undefined),
  };
  const crm = {
    createLead: vi.fn().mockResolvedValue({ id: null }),
    createAppointment: vi.fn().mockResolvedValue({ id: null }),
  };
  const service = new LeadService(
    repository as unknown as LeadRepository,
    crm as unknown as CrmService,
  );
  return { service, repository, crm };
}

const baseInput = {
  phoneNumber: '5531999999999',
  name: 'Maria Silva',
  email: 'maria@example.com',
  propertyCode: 'AP001',
};

describe('LeadService.scheduleVisit', () => {
  it('persists the lead locally as SCHEDULED with a default description', async () => {
    const { service, repository } = makeDeps();
    await service.scheduleVisit(baseInput);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '5531999999999',
        propertyCode: 'AP001',
        propertyDescription: 'Imóvel AP001',
      }),
      LeadStatus.SCHEDULED,
    );
  });

  it('keeps a provided property description', async () => {
    const { service, repository } = makeDeps();
    await service.scheduleVisit({ ...baseInput, propertyDescription: 'Apê dos sonhos' });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ propertyDescription: 'Apê dos sonhos' }),
      LeadStatus.SCHEDULED,
    );
  });

  it('does not create a CRM appointment when the CRM lead was not created', async () => {
    const { service, crm, repository } = makeDeps();
    const result = await service.scheduleVisit(baseInput);
    expect(crm.createAppointment).not.toHaveBeenCalled();
    expect(repository.setCrmIds).not.toHaveBeenCalled();
    expect(result).toEqual({ leadId: 42, crmLeadId: null, crmAppointmentId: null });
  });

  it('creates an appointment and stores the CRM ids when the CRM lead is created', async () => {
    const { service, crm, repository } = makeDeps();
    crm.createLead.mockResolvedValue({ id: 'crm-lead-1' });
    crm.createAppointment.mockResolvedValue({ id: 'crm-appt-1' });
    const scheduledAt = new Date('2026-06-20T18:00:00Z');
    const result = await service.scheduleVisit({ ...baseInput, scheduledAt });

    expect(crm.createAppointment).toHaveBeenCalledWith({
      crmLeadId: 'crm-lead-1',
      propertyCode: 'AP001',
      scheduledAt,
      clientName: 'Maria Silva',
    });
    expect(repository.setCrmIds).toHaveBeenCalledWith(42, 'crm-lead-1', 'crm-appt-1');
    expect(result).toEqual({ leadId: 42, crmLeadId: 'crm-lead-1', crmAppointmentId: 'crm-appt-1' });
  });

  it('stores the CRM lead id even when the appointment fails', async () => {
    const { service, crm, repository } = makeDeps();
    crm.createLead.mockResolvedValue({ id: 'crm-lead-1' });
    crm.createAppointment.mockResolvedValue({ id: null });
    const result = await service.scheduleVisit(baseInput);
    expect(repository.setCrmIds).toHaveBeenCalledWith(42, 'crm-lead-1', null);
    expect(result.crmAppointmentId).toBeNull();
  });
});

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

  it('always calls createAppointment (single-step lead+visit in Imoview)', async () => {
    const { service, crm } = makeDeps();
    await service.scheduleVisit(baseInput);
    expect(crm.createAppointment).toHaveBeenCalledWith({
      name: 'Maria Silva',
      phoneNumber: '5531999999999',
      email: 'maria@example.com',
      propertyCode: 'AP001',
      scheduledAt: undefined,
    });
  });

  it('returns { crmLeadId: null } since Imoview does not return a lead id', async () => {
    const { service } = makeDeps();
    const result = await service.scheduleVisit(baseInput);
    expect(result).toEqual({ leadId: 42, crmLeadId: null, crmAppointmentId: null });
  });

  it('stores the appointment id and returns it when Imoview responds with one', async () => {
    const { service, crm, repository } = makeDeps();
    crm.createAppointment.mockResolvedValue({ id: 'crm-appt-1' });
    const scheduledAt = new Date('2026-06-20T18:00:00Z');
    const result = await service.scheduleVisit({ ...baseInput, scheduledAt });

    expect(crm.createAppointment).toHaveBeenCalledWith({
      name: 'Maria Silva',
      phoneNumber: '5531999999999',
      email: 'maria@example.com',
      propertyCode: 'AP001',
      scheduledAt,
    });
    expect(repository.setCrmIds).toHaveBeenCalledWith(42, null, 'crm-appt-1');
    expect(result).toEqual({ leadId: 42, crmLeadId: null, crmAppointmentId: 'crm-appt-1' });
  });

  it('does not call setCrmIds when Imoview returns no appointment id', async () => {
    const { service, crm, repository } = makeDeps();
    crm.createAppointment.mockResolvedValue({ id: null });
    await service.scheduleVisit(baseInput);
    expect(repository.setCrmIds).not.toHaveBeenCalled();
  });
});

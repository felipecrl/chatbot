import type { Lead, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LeadRepository, LeadStatus } from './lead.repository';

function makePrisma() {
  return {
    lead: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

const fakeLead = { id: 7 } as Lead;

function repo(prisma: ReturnType<typeof makePrisma>) {
  return new LeadRepository(prisma as unknown as PrismaClient);
}

describe('LeadRepository', () => {
  it('create maps the input and defaults the status to NEW', async () => {
    const prisma = makePrisma();
    prisma.lead.create.mockResolvedValue(fakeLead);
    const result = await repo(prisma).create({ phoneNumber: '5531999999999' });
    expect(result).toBe(fakeLead);
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: {
        phoneNumber: '5531999999999',
        name: null,
        email: null,
        propertyCode: null,
        propertyDescription: null,
        scheduledAt: null,
        status: LeadStatus.NEW,
      },
    });
  });

  it('create honours all provided fields and an explicit status', async () => {
    const prisma = makePrisma();
    prisma.lead.create.mockResolvedValue(fakeLead);
    const scheduledAt = new Date('2026-06-20T15:00:00Z');
    await repo(prisma).create(
      {
        phoneNumber: '5531999999999',
        name: 'Maria',
        email: 'maria@example.com',
        propertyCode: 'AP001',
        propertyDescription: 'Apê na Savassi',
        scheduledAt,
      },
      LeadStatus.SCHEDULED,
    );
    expect(prisma.lead.create).toHaveBeenCalledWith({
      data: {
        phoneNumber: '5531999999999',
        name: 'Maria',
        email: 'maria@example.com',
        propertyCode: 'AP001',
        propertyDescription: 'Apê na Savassi',
        scheduledAt,
        status: LeadStatus.SCHEDULED,
      },
    });
  });

  it('setCrmIds updates the CRM identifiers', async () => {
    const prisma = makePrisma();
    prisma.lead.update.mockResolvedValue(fakeLead);
    await repo(prisma).setCrmIds(7, 'crm-1', 'appt-1');
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { crmLeadId: 'crm-1', crmAppointmentId: 'appt-1' },
    });
  });

  it('updateStatus updates the status column', async () => {
    const prisma = makePrisma();
    prisma.lead.update.mockResolvedValue(fakeLead);
    await repo(prisma).updateStatus(7, LeadStatus.CONTACTED);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: LeadStatus.CONTACTED },
    });
  });

  it('listByPhone returns leads ordered by creation desc', async () => {
    const prisma = makePrisma();
    prisma.lead.findMany.mockResolvedValue([fakeLead]);
    await expect(repo(prisma).listByPhone('5531999999999')).resolves.toEqual([fakeLead]);
    expect(prisma.lead.findMany).toHaveBeenCalledWith({
      where: { phoneNumber: '5531999999999' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

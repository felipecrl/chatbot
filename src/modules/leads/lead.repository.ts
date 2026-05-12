import { type Lead, LeadStatus, type PrismaClient } from '@prisma/client';
import type { CreateLeadInput } from './lead.types';

export { LeadStatus };

export class LeadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateLeadInput, status: LeadStatus = LeadStatus.NEW): Promise<Lead> {
    return this.prisma.lead.create({
      data: {
        phoneNumber: input.phoneNumber,
        name: input.name ?? null,
        email: input.email ?? null,
        propertyCode: input.propertyCode ?? null,
        propertyDescription: input.propertyDescription ?? null,
        scheduledAt: input.scheduledAt ?? null,
        status,
      },
    });
  }

  async setCrmIds(
    id: number,
    crmLeadId: string | null,
    crmAppointmentId: string | null,
  ): Promise<void> {
    await this.prisma.lead.update({
      where: { id },
      data: { crmLeadId, crmAppointmentId },
    });
  }

  async updateStatus(id: number, status: LeadStatus): Promise<void> {
    await this.prisma.lead.update({ where: { id }, data: { status } });
  }

  async listByPhone(phoneNumber: string): Promise<Lead[]> {
    return this.prisma.lead.findMany({ where: { phoneNumber }, orderBy: { createdAt: 'desc' } });
  }
}

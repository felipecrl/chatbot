import type { AxiosInstance } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { CrmService } from './crm.service';

function mutateImoview(patch: { enabled?: boolean; apiUrl?: string; apiKey?: string }) {
  Object.assign(config.imoview as unknown as Record<string, unknown>, patch);
}

afterEach(() => {
  mutateImoview({ enabled: false, apiUrl: undefined, apiKey: undefined });
});

function clientWith(post: ReturnType<typeof vi.fn>) {
  return { post } as unknown as AxiosInstance;
}

describe('CrmService when not configured', () => {
  it('reports disabled and never persists remotely', async () => {
    const service = new CrmService();
    expect(service.enabled).toBe(false);
    await expect(
      service.createLead({ name: 'Maria', phoneNumber: 'x', propertyCode: 'AP1' }),
    ).resolves.toEqual({
      id: null,
    });
    await expect(
      service.createAppointment({ crmLeadId: 'lead-x', propertyCode: 'AP1' }),
    ).resolves.toEqual({ id: null });
  });

  it('builds an HTTP client when IMOVIEW is enabled', () => {
    mutateImoview({ enabled: true, apiUrl: 'https://crm.example.com', apiKey: 'k' });
    expect(new CrmService().enabled).toBe(true);
  });

  it('builds an HTTP client even when the API key is absent', () => {
    mutateImoview({ enabled: true, apiUrl: 'https://crm.example.com', apiKey: undefined });
    expect(new CrmService().enabled).toBe(true);
  });
});

describe('CrmService.createLead', () => {
  it('posts the lead and returns the extracted id', async () => {
    const post = vi.fn().mockResolvedValue({ data: { id: 'lead-123' } });
    const result = await new CrmService(clientWith(post)).createLead({
      name: 'Maria',
      phoneNumber: '5531999999999',
      email: 'maria@example.com',
      propertyCode: 'AP001',
    });
    expect(result).toEqual({ id: 'lead-123' });
    expect(post).toHaveBeenCalledWith(
      '/leads',
      expect.objectContaining({ nome: 'Maria', canal: 'whatsapp' }),
    );
  });

  it('uses the default source when none is given', async () => {
    const post = vi.fn().mockResolvedValue({ data: { lead_id: 99 } });
    const result = await new CrmService(clientWith(post)).createLead({
      name: 'Maria',
      phoneNumber: 'x',
      propertyCode: 'AP1',
    });
    expect(result).toEqual({ id: '99' });
    expect(post.mock.calls[0]?.[1]).toMatchObject({ origem: 'WhatsApp Chatbot' });
  });

  it('returns { id: null } when the request fails', async () => {
    const post = vi.fn().mockRejectedValue(new Error('502'));
    await expect(
      new CrmService(clientWith(post)).createLead({
        name: 'Maria',
        phoneNumber: 'x',
        propertyCode: 'AP1',
      }),
    ).resolves.toEqual({ id: null });
  });
});

describe('CrmService.createAppointment', () => {
  it('posts the appointment and returns the extracted id (nested data.id)', async () => {
    const post = vi.fn().mockResolvedValue({ data: { data: { id: 'appt-1' } } });
    const result = await new CrmService(clientWith(post)).createAppointment({
      crmLeadId: 'lead-1',
      propertyCode: 'AP001',
      scheduledAt: new Date('2026-06-20T15:00:00Z'),
      clientName: 'Maria',
    });
    expect(result).toEqual({ id: 'appt-1' });
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.lead_id).toBe('lead-1');
    expect(body.data_visita).toBe('2026-06-20T15:00:00.000Z');
    expect(body.observacao).toContain('Maria');
  });

  it('handles a missing scheduled date and client name', async () => {
    const post = vi.fn().mockResolvedValue({ data: { agendamento_id: 'appt-2' } });
    const result = await new CrmService(clientWith(post)).createAppointment({
      crmLeadId: 'lead-1',
      propertyCode: 'AP001',
    });
    expect(result).toEqual({ id: 'appt-2' });
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.data_visita).toBeNull();
    expect(body.observacao).toBe('Agendado via WhatsApp Chatbot');
  });

  it('returns { id: null } when the response carries no usable id', async () => {
    const post = vi.fn().mockResolvedValue({ data: { unrelated: true } });
    await expect(
      new CrmService(clientWith(post)).createAppointment({ crmLeadId: 'l', propertyCode: 'AP1' }),
    ).resolves.toEqual({ id: null });
  });

  it('returns { id: null } when the request fails', async () => {
    const post = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      new CrmService(clientWith(post)).createAppointment({ crmLeadId: 'l', propertyCode: 'AP1' }),
    ).resolves.toEqual({ id: null });
  });

  it('ignores a non-scalar id in the response', async () => {
    const post = vi.fn().mockResolvedValue({ data: { id: { nested: true } } });
    await expect(
      new CrmService(clientWith(post)).createAppointment({ crmLeadId: 'l', propertyCode: 'AP1' }),
    ).resolves.toEqual({ id: null });
  });
});

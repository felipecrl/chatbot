import type { AxiosInstance } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { CrmService } from './crm.service';

function mutateImoview(patch: { enabled?: boolean; apiUrl?: string; apiKey?: string }) {
  Object.assign(config.imoview as unknown as Record<string, unknown>, patch);
}

beforeEach(() => {
  mutateImoview({ enabled: false, apiUrl: undefined, apiKey: undefined });
});

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
    ).resolves.toEqual({ id: null });
    await expect(
      service.createAppointment({ name: 'Maria', phoneNumber: 'x', propertyCode: 'AP1' }),
    ).resolves.toEqual({ id: null });
  });

  it('builds an HTTP client when IMOVIEW is enabled', () => {
    mutateImoview({ enabled: true, apiUrl: 'https://api.imoview.com.br', apiKey: 'k' });
    expect(new CrmService().enabled).toBe(true);
  });

  it('builds an HTTP client even when the API key is absent', () => {
    mutateImoview({ enabled: true, apiUrl: 'https://api.imoview.com.br', apiKey: undefined });
    expect(new CrmService().enabled).toBe(true);
  });
});

describe('CrmService.createLead', () => {
  it('posts to /Lead/IncluirLead and returns the extracted id', async () => {
    const post = vi.fn().mockResolvedValue({ data: { id: 'lead-123' } });
    const result = await new CrmService(clientWith(post)).createLead({
      name: 'Maria',
      phoneNumber: '5531999999999',
      email: 'maria@example.com',
      propertyCode: 'AP001',
    });
    expect(result).toEqual({ id: 'lead-123' });
    expect(post).toHaveBeenCalledWith(
      '/Lead/IncluirLead',
      expect.objectContaining({ nome: 'Maria', midia: 'WhatsApp Chatbot' }),
    );
  });

  it('uses the default midia when no source is given', async () => {
    const post = vi.fn().mockResolvedValue({ data: { lead_id: 99 } });
    const result = await new CrmService(clientWith(post)).createLead({
      name: 'Maria',
      phoneNumber: 'x',
      propertyCode: 'AP1',
    });
    expect(result).toEqual({ id: '99' });
    expect(post.mock.calls[0]?.[1]).toMatchObject({ midia: 'WhatsApp Chatbot' });
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
  it('posts to /Lead/IncluirAgendamentoVisita with correct date format', async () => {
    const post = vi.fn().mockResolvedValue({ data: { data: { id: 'appt-1' } } });
    const result = await new CrmService(clientWith(post)).createAppointment({
      name: 'Maria',
      phoneNumber: '5531999999999',
      email: 'maria@example.com',
      propertyCode: 'AP001',
      scheduledAt: new Date('2026-06-20T15:00:00'),
    });
    expect(result).toEqual({ id: 'appt-1' });
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(post.mock.calls[0]?.[0]).toBe('/Lead/IncluirAgendamentoVisita');
    expect(body.nome).toBe('Maria');
    expect(body.midia).toBe('WhatsApp Chatbot');
    expect(body.codigoimovel).toBe('AP001');
    // Date must be formatted as dd/mm/yyyy hh:mm
    expect(typeof body.datahoraagendamentovisita).toBe('string');
    expect(body.datahoraagendamentovisita).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it('omits datahoraagendamentovisita when scheduledAt is absent', async () => {
    const post = vi.fn().mockResolvedValue({ data: { agendamento_id: 'appt-2' } });
    const result = await new CrmService(clientWith(post)).createAppointment({
      propertyCode: 'AP001',
    });
    expect(result).toEqual({ id: 'appt-2' });
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.datahoraagendamentovisita).toBeUndefined();
  });

  it('returns { id: null } when the response carries no usable id', async () => {
    const post = vi.fn().mockResolvedValue({ data: { unrelated: true } });
    await expect(
      new CrmService(clientWith(post)).createAppointment({ propertyCode: 'AP1' }),
    ).resolves.toEqual({ id: null });
  });

  it('returns { id: null } when the request fails', async () => {
    const post = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      new CrmService(clientWith(post)).createAppointment({ propertyCode: 'AP1' }),
    ).resolves.toEqual({ id: null });
  });

  it('ignores a non-scalar id in the response', async () => {
    const post = vi.fn().mockResolvedValue({ data: { id: { nested: true } } });
    await expect(
      new CrmService(clientWith(post)).createAppointment({ propertyCode: 'AP1' }),
    ).resolves.toEqual({ id: null });
  });
});

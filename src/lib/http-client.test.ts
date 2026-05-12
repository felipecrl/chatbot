import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { ExternalServiceError } from './errors';
import { createHttpClient } from './http-client';

function okAdapter(payload: unknown): AxiosAdapter {
  return (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
    Promise.resolve({
      data: payload,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
}

function errorAdapter(err: Error): AxiosAdapter {
  return () => Promise.reject(err);
}

describe('createHttpClient', () => {
  it('returns data on success (request + response interceptors run)', async () => {
    const client = createHttpClient({ serviceName: 'demo', adapter: okAdapter({ ok: true }) });
    const res = await client.get('/ping');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ ok: true });
  });

  it('uses the provided default timeout', () => {
    const client = createHttpClient({ serviceName: 'demo', adapter: okAdapter(null) });
    expect(client.defaults.timeout).toBe(10_000);
  });

  it('honours a custom timeout', () => {
    const client = createHttpClient({
      serviceName: 'demo',
      timeout: 1234,
      adapter: okAdapter(null),
    });
    expect(client.defaults.timeout).toBe(1234);
  });

  it('normalizes AxiosError into ExternalServiceError (with status)', async () => {
    const axiosError = new AxiosError(
      'Request failed',
      'ERR_BAD_RESPONSE',
      { url: '/boom' } as InternalAxiosRequestConfig,
      undefined,
      {
        status: 503,
        statusText: 'Service Unavailable',
        data: { detail: 'down' },
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      },
    );
    const client = createHttpClient({ serviceName: 'upstream', adapter: errorAdapter(axiosError) });
    await expect(client.get('/boom')).rejects.toMatchObject({
      name: 'ExternalServiceError',
      service: 'upstream',
      statusCode: 502,
    });
    await expect(client.get('/boom')).rejects.toBeInstanceOf(ExternalServiceError);
    await expect(client.get('/boom')).rejects.toThrow(/HTTP 503/);
  });

  it('normalizes AxiosError without a response (no status in message)', async () => {
    const axiosError = new AxiosError('Network Error', 'ECONNABORTED', {
      url: '/timeout',
    } as InternalAxiosRequestConfig);
    const client = createHttpClient({ serviceName: 'upstream', adapter: errorAdapter(axiosError) });
    await expect(client.get('/timeout')).rejects.toThrow(/Falha ao comunicar com upstream$/);
  });

  it('re-throws non-Axios errors untouched', async () => {
    const weird = new Error('not axios');
    const client = createHttpClient({ serviceName: 'upstream', adapter: errorAdapter(weird) });
    await expect(client.get('/x')).rejects.toBe(weird);
  });
});

import { createHmac } from 'node:crypto';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config';
import { verifyWhatsAppSignature } from './verify-whatsapp-signature';

const APP_SECRET = 'top-secret';

function setAppSecret(value: string | undefined) {
  (config as unknown as { whatsapp: { appSecret?: string } }).whatsapp.appSecret = value;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function makeReq(rawBody: Buffer | undefined, signature: string | undefined): Request {
  return {
    rawBody,
    ip: '203.0.113.5',
    header: (name: string) =>
      name.toLowerCase() === 'x-hub-signature-256' ? signature : undefined,
  } as unknown as Request;
}

function sign(body: Buffer, secret = APP_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

afterEach(() => {
  setAppSecret(undefined);
});

describe('verifyWhatsAppSignature', () => {
  it('is a no-op when no app secret is configured', () => {
    setAppSecret(undefined);
    const next = vi.fn();
    const res = makeRes();
    verifyWhatsAppSignature(makeReq(undefined, undefined), res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('accepts a valid signature', () => {
    setAppSecret(APP_SECRET);
    const body = Buffer.from(JSON.stringify({ a: 1 }));
    const next = vi.fn();
    const res = makeRes();
    verifyWhatsAppSignature(makeReq(body, sign(body)), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects when the raw body is missing', () => {
    setAppSecret(APP_SECRET);
    const next = vi.fn();
    const res = makeRes();
    verifyWhatsAppSignature(makeReq(undefined, sign(Buffer.from('x'))), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Assinatura inválida' });
  });

  it('rejects an invalid signature', () => {
    setAppSecret(APP_SECRET);
    const body = Buffer.from('payload');
    const next = vi.fn();
    const res = makeRes();
    verifyWhatsAppSignature(makeReq(body, sign(body, 'wrong-secret')), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rejects when the signature header is absent', () => {
    setAppSecret(APP_SECRET);
    const next = vi.fn();
    const res = makeRes();
    verifyWhatsAppSignature(makeReq(Buffer.from('payload'), undefined), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

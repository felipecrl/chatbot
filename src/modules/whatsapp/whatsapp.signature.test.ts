import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './whatsapp.signature';

const secret = 'super-secret';

function sign(body: Buffer, withSecret = secret): string {
  return `sha256=${createHmac('sha256', withSecret).update(body).digest('hex')}`;
}

describe('verifyWebhookSignature', () => {
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));

  it('accepts a valid signature', () => {
    expect(verifyWebhookSignature(body, sign(body), secret)).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyWebhookSignature(body, sign(body, 'wrong'), secret)).toBe(false);
  });

  it('rejects a tampered body', () => {
    expect(verifyWebhookSignature(Buffer.from('tampered'), sign(body), secret)).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    expect(verifyWebhookSignature(body, undefined, secret)).toBe(false);
    expect(verifyWebhookSignature(body, 'not-a-signature', secret)).toBe(false);
  });

  it('rejects a signature whose digest length does not match', () => {
    expect(verifyWebhookSignature(body, 'sha256=abcd', secret)).toBe(false);
  });
});

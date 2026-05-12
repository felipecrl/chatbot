import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the `X-Hub-Signature-256` header sent by Meta on webhook deliveries.
 * See https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);

  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}

import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requestLogger } from './request-logger';

describe('requestLogger', () => {
  it('calls next immediately and logs on response finish', () => {
    const req = { method: 'POST', originalUrl: '/webhook' } as Request;
    const res = new EventEmitter() as unknown as Response;
    (res as unknown as { statusCode: number }).statusCode = 201;
    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalledOnce();

    // Triggers the 'finish' listener (which computes the latency and logs).
    expect(() => (res as unknown as EventEmitter).emit('finish')).not.toThrow();
  });
});

import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { asyncHandler } from './async-handler';

const req = {} as Request;
const res = {} as Response;

describe('asyncHandler', () => {
  it('does not call next when the handler resolves', async () => {
    const next = vi.fn() as unknown as NextFunction;
    asyncHandler(() => Promise.resolve('ok'))(req, res, next);
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a rejection to next', async () => {
    const error = new Error('boom');
    const next = vi.fn() as unknown as NextFunction;
    asyncHandler(() => Promise.reject(error))(req, res, next);
    await Promise.resolve();
    expect(next).toHaveBeenCalledWith(error);
  });
});

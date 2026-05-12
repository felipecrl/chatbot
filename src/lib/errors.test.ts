import { describe, expect, it } from 'vitest';
import {
  AppError,
  BadRequestError,
  ExternalServiceError,
  NotFoundError,
  UnauthorizedError,
  isAppError,
  toErrorMeta,
} from './errors';

describe('AppError', () => {
  it('applies defaults', () => {
    const err = new AppError('boom');
    expect(err.name).toBe('AppError');
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
    expect(err.details).toBeUndefined();
    expect(err).toBeInstanceOf(Error);
  });

  it('honours provided options including cause', () => {
    const cause = new Error('root');
    const err = new AppError('boom', {
      statusCode: 418,
      isOperational: false,
      details: { foo: 'bar' },
      cause,
    });
    expect(err.statusCode).toBe(418);
    expect(err.isOperational).toBe(false);
    expect(err.details).toEqual({ foo: 'bar' });
    expect(err.cause).toBe(cause);
  });
});

describe('error subclasses', () => {
  it('BadRequestError defaults and custom', () => {
    expect(new BadRequestError().statusCode).toBe(400);
    const err = new BadRequestError('inválido', { field: 'x' });
    expect(err.message).toBe('inválido');
    expect(err.details).toEqual({ field: 'x' });
  });

  it('UnauthorizedError', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(new UnauthorizedError('nope').message).toBe('nope');
  });

  it('NotFoundError', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(new NotFoundError('sumiu').message).toBe('sumiu');
  });

  it('ExternalServiceError', () => {
    const cause = new Error('timeout');
    const err = new ExternalServiceError('whatsapp', 'falhou', { cause, details: { code: 1 } });
    expect(err.statusCode).toBe(502);
    expect(err.service).toBe('whatsapp');
    expect(err.cause).toBe(cause);
    expect(err.details).toEqual({ code: 1 });
    expect(new ExternalServiceError('crm', 'x').details).toBeUndefined();
  });
});

describe('isAppError', () => {
  it('recognises AppError instances', () => {
    expect(isAppError(new AppError('x'))).toBe(true);
    expect(isAppError(new BadRequestError())).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
    expect(isAppError('x')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe('toErrorMeta', () => {
  it('extracts message/stack/cause from Error', () => {
    const cause = { reason: 'x' };
    const err = new Error('falha', { cause });
    const meta = toErrorMeta(err);
    expect(meta.message).toBe('falha');
    expect(typeof meta.stack).toBe('string');
    expect(meta.cause).toBe(cause);
  });

  it('stringifies non-Error values', () => {
    expect(toErrorMeta('texto')).toEqual({ message: 'texto' });
    expect(toErrorMeta(42)).toEqual({ message: '42' });
    expect(toErrorMeta(null)).toEqual({ message: 'null' });
  });
});

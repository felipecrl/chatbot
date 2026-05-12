import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../config';
import { BadRequestError, AppError } from '../../lib/errors';
import { errorHandler, notFoundHandler } from './error-handler';

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

const req = { originalUrl: '/whatever' } as Request;
const next = (() => undefined) as NextFunction;

const setProduction = (value: boolean) => {
  (config as unknown as { isProduction: boolean }).isProduction = value;
};

afterEach(() => {
  setProduction(false);
});

describe('notFoundHandler', () => {
  it('responds 404 with the path', () => {
    const res = makeRes();
    notFoundHandler(req, res, next);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Recurso não encontrado', path: '/whatever' });
  });
});

describe('errorHandler', () => {
  it('handles an operational 5xx AppError', () => {
    const res = makeRes();
    errorHandler(new AppError('falhou', { statusCode: 503 }), req, res, next);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'falhou' });
  });

  it('handles an operational 4xx AppError with details', () => {
    const res = makeRes();
    errorHandler(new BadRequestError('inválido', { campo: 'x' }), req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'inválido', details: { campo: 'x' } });
  });

  it('handles an operational 4xx AppError without details', () => {
    const res = makeRes();
    errorHandler(new BadRequestError('ruim'), req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'ruim' });
  });

  it('handles a non-AppError and exposes the detail outside production', () => {
    const res = makeRes();
    errorHandler(new Error('explodiu'), req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Erro interno do servidor', detail: 'explodiu' });
  });

  it('handles a thrown non-Error value', () => {
    const res = makeRes();
    errorHandler('cru', req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Erro interno do servidor', detail: 'cru' });
  });

  it('hides the detail in production', () => {
    setProduction(true);
    const res = makeRes();
    errorHandler(new Error('segredo'), req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Erro interno do servidor' });
  });

  it('does not treat a non-operational AppError as operational', () => {
    const res = makeRes();
    errorHandler(new AppError('bug interno', { isOperational: false }), req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ error: 'Erro interno do servidor' });
  });
});

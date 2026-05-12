/**
 * Base class for all errors deliberately thrown by the application.
 * `isOperational` distinguishes expected failures (bad input, upstream 4xx, …)
 * from bugs we did not anticipate.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly details?: unknown;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      isOperational?: boolean;
      details?: unknown;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.statusCode = options.statusCode ?? 500;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Requisição inválida', details?: unknown) {
    super(message, { statusCode: 400, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, { statusCode: 401 });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, { statusCode: 404 });
  }
}

/** Failure when talking to a third-party service (WhatsApp, OpenAI, CRM, …). */
export class ExternalServiceError extends AppError {
  readonly service: string;

  constructor(
    service: string,
    message: string,
    options: { cause?: unknown; details?: unknown } = {},
  ) {
    super(message, {
      statusCode: 502,
      isOperational: true,
      cause: options.cause,
      details: options.details,
    });
    this.service = service;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toErrorMeta(error: unknown): { message: string; stack?: string; cause?: unknown } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack, cause: error.cause };
  }
  return { message: String(error) };
}

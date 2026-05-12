import { type Prisma, PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from '../lib/logger';

export const prisma = new PrismaClient({
  log: config.isProduction
    ? [{ level: 'error', emit: 'event' }]
    : [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
});

export function logPrismaError(event: Prisma.LogEvent): void {
  logger.error('Prisma error', { target: event.target, message: event.message });
}

export function logPrismaWarning(event: Prisma.LogEvent): void {
  logger.warn('Prisma warning', { target: event.target, message: event.message });
}

prisma.$on('error', logPrismaError);

if (!config.isProduction) {
  prisma.$on('warn', logPrismaWarning);
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Conexão com PostgreSQL estabelecida');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Conexão com PostgreSQL encerrada');
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Health check do banco falhou', { error: (error as Error).message });
    return false;
  }
}

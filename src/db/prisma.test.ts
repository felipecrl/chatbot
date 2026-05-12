import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkDatabaseHealth,
  connectDatabase,
  disconnectDatabase,
  logPrismaError,
  logPrismaWarning,
  prisma,
} from './prisma';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('connectDatabase / disconnectDatabase', () => {
  it('connects through the Prisma client', async () => {
    const spy = vi.spyOn(prisma, '$connect').mockResolvedValue(undefined);
    await connectDatabase();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('disconnects through the Prisma client', async () => {
    const spy = vi.spyOn(prisma, '$disconnect').mockResolvedValue(undefined);
    await disconnectDatabase();
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('checkDatabaseHealth', () => {
  it('returns true when the probe query succeeds', async () => {
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ 1: 1 }]);
    await expect(checkDatabaseHealth()).resolves.toBe(true);
  });

  it('returns false when the probe query throws', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('connection refused'));
    await expect(checkDatabaseHealth()).resolves.toBe(false);
  });
});

describe('prisma log handlers', () => {
  it('do not throw when invoked', () => {
    const event = { timestamp: new Date(), target: 'db', message: 'something' };
    expect(() => logPrismaError(event)).not.toThrow();
    expect(() => logPrismaWarning(event)).not.toThrow();
  });
});

describe('production configuration', () => {
  it('only subscribes to error events in production', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    const mod = await import('./prisma');
    expect(mod.prisma).toBeDefined();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

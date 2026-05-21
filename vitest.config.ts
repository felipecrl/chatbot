import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      WHATSAPP_ACCESS_TOKEN: 'test-access-token',
      WHATSAPP_PHONE_NUMBER_ID: 'test-phone-id',
      WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
      USE_MOCK_AI: 'true',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/index.ts',
        'src/server.ts',
        'src/**/*.types.ts',
        'src/types/**',
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});

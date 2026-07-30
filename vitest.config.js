import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/tests/**/*.test.js'],
    setupFiles: ['backend/tests/setup.js'],
    // mongodb-memory-server downloads a mongod binary on first run
    hookTimeout: 120_000,
    testTimeout: 30_000,
    environment: 'node',
  },
});

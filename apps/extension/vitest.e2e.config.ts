import { defineConfig } from 'vitest/config';

// Browser tests for the built extension. Run with `pnpm test:e2e`, which builds first.
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

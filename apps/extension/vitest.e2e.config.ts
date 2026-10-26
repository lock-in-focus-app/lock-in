import { defineConfig } from 'vitest/config';

// Browser tests for the built extension. Run with `pnpm test:e2e`, which builds first.
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Each file runs its own Chrome; too many at once makes popups and timers flaky. GitHub's
    // runners for private repos have 2 cores.
    maxWorkers: process.env.CI ? 2 : 3,
  },
});

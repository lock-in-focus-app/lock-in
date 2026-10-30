import { defineConfig } from 'vitest/config';

// Makes the store listing's images (store/screenshots.ts). Run with `pnpm screenshots`, which
// builds first.
export default defineConfig({
  test: {
    include: ['store/**/*.ts'],
  },
});

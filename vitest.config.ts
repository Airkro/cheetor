import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/index.mts'],
    exclude: ['**/node_modules/**', '**/fixture/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['index.mjs', 'lib.mjs'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});

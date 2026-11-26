import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // D1 integration tests run inside workerd via vitest.workers.config.ts.
    exclude: ['test/d1/**', 'node_modules/**'],
    coverage: {
      reporter: ['text', 'json-summary']
    }
  }
});

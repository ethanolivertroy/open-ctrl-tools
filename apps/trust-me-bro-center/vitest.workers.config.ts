import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Runs test/d1/** inside workerd against a real local D1 with every migration
// applied, so repository SQL is exercised the way production runs it.
export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
          // The pool ships its own workerd, which can lag the compatibility_date in
          // wrangler.jsonc by a release or two. Nothing under test depends on the
          // newer date, so pin the newest date this pool's runtime accepts.
          compatibilityDate: '2026-08-22'
        }
      })
    ],
    test: {
      include: ['test/d1/**/*.test.ts'],
      setupFiles: ['./test/d1/setup.ts']
    }
  };
});

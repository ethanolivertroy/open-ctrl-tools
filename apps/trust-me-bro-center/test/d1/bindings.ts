/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { env, type D1Migration } from 'cloudflare:test';

// `cloudflare:test` types env as the global Cloudflare.Env, which this project
// leaves empty so WorkerEnv stays the single source of truth for bindings.
// Narrow it here instead of augmenting the global.
export const bindings = env as unknown as {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  TEST_MIGRATIONS: D1Migration[];
};

import { applyD1Migrations } from 'cloudflare:test';
import { bindings } from './bindings';

// The test database starts as the fully migrated demo dataset.
await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);

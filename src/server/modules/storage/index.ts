import { env } from '@/lib/env';
import { createLocalStorageAdapter } from './local';
import type { StorageAdapter } from './adapter';

/**
 * S3-compatible driver is documented (Architecture §6, .env.example) but not
 * yet implemented — no S3 SDK dependency exists in v0.1 since local storage
 * is sufficient for the current pilot-scale, single-instance dev/test target.
 * Wiring a real S3-compatible adapter is required before any production
 * deployment (STORAGE_DRIVER=local must never run in production).
 */
function buildAdapter(): StorageAdapter {
  if (env.STORAGE_DRIVER === 'local') {
    return createLocalStorageAdapter(env.STORAGE_LOCAL_PATH);
  }
  throw new Error(
    `STORAGE_DRIVER="${env.STORAGE_DRIVER}" has no implementation yet — only "local" is implemented (dev-only).`
  );
}

export const storage = buildAdapter();
export * from './adapter';

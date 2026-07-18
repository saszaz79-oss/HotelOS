import { env } from '@/lib/env';
import { createLocalStorageAdapter } from './local';
import { createR2StorageAdapter } from './r2';
import type { StorageAdapter } from './adapter';

/**
 * `local`: filesystem — dev-only, never valid in production (Cloudflare
 * Workers has no persistent/writable filesystem at all, so this driver
 * would fail immediately in that environment regardless of the "dev-only"
 * label).
 * `r2`: Cloudflare R2 via the native binding (src/server/modules/storage/r2.ts)
 * — the only production-valid driver for a Cloudflare Workers deployment.
 *
 * Lazily constructed (not built eagerly at module load) because the R2
 * adapter needs `getCloudflareContext()`, which is only resolvable within
 * request scope — same reasoning as the Prisma client singleton
 * (src/lib/prisma.ts).
 */
let cached: StorageAdapter | undefined;

function buildAdapter(): StorageAdapter {
  if (env.STORAGE_DRIVER === 'local') {
    return createLocalStorageAdapter(env.STORAGE_LOCAL_PATH);
  }
  return createR2StorageAdapter(env.STORAGE_R2_BINDING);
}

export const storage: StorageAdapter = {
  put: (...args) => (cached ??= buildAdapter()).put(...args),
  get: (...args) => (cached ??= buildAdapter()).get(...args),
  delete: (...args) => (cached ??= buildAdapter()).delete(...args),
};

export * from './adapter';

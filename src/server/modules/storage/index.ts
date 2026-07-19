import { env } from '@/lib/env';
import { createLocalStorageAdapter } from './local';
import { createR2StorageAdapter } from './r2';
import { createSupabaseStorageAdapter } from './supabase';
import type { StorageAdapter } from './adapter';

/**
 * `local`: filesystem — dev-only, never valid in production (no persistent
 * writable filesystem on serverless, Vercel or Cloudflare Workers alike).
 * `r2`: Cloudflare R2 via the native binding — only valid inside a
 * Cloudflare Workers deployment (needs `getCloudflareContext()`).
 * `supabase`: Supabase Storage — the production driver for this deployment
 * (Vercel), using the same Supabase project as the database.
 *
 * Lazily constructed (not built eagerly at module load) because the R2
 * adapter needs `getCloudflareContext()`, which is only resolvable within
 * request scope — same reasoning as the Prisma client singleton
 * (src/lib/prisma.ts).
 */
let cached: StorageAdapter | undefined;

function buildAdapter(): StorageAdapter {
  if (env.STORAGE_DRIVER === 'supabase') {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set. See docs/SUPABASE_SETUP.md.'
      );
    }
    return createSupabaseStorageAdapter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  if (env.STORAGE_DRIVER === 'local') {
    return createLocalStorageAdapter(env.STORAGE_LOCAL_PATH);
  }
  return createR2StorageAdapter(env.STORAGE_R2_BINDING);
}

export const storage: StorageAdapter = {
  put: (...args) => (cached ??= buildAdapter()).put(...args),
  get: (...args) => (cached ??= buildAdapter()).get(...args),
  delete: (...args) => (cached ??= buildAdapter()).delete(...args),
  getSignedUrl: (...args) => (cached ??= buildAdapter()).getSignedUrl(...args),
};

export * from './adapter';

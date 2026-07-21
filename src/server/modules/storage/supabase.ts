import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StorageAdapter } from './adapter';

const BUCKET_NAME = 'hotelos-reports';
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // matches reports/commands.ts MAX_FILE_SIZE_BYTES
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries transient failures (network blips, brief unavailability) with a short backoff. Does not retry validation/auth errors — those fail the same way every time. */
async function withRetry<T>(op: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }
  throw new Error(`${label} failed after ${RETRY_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

let client: SupabaseClient | undefined;
let bucketVerifiedForClient: SupabaseClient | undefined;

function getClient(url: string, serviceRoleKey: string): SupabaseClient {
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * Creates the bucket if it doesn't exist yet — checked once per warm
 * function instance (Vercel serverless reuses instances across requests;
 * a fresh cold start re-verifies, which is correct and cheap). Idempotent:
 * a "bucket already exists" response from a racing concurrent request is
 * treated as success, not an error. Called from put()/delete() only — the
 * read paths (get/getSignedUrl) skip it, see comment at get() below.
 */
async function ensureBucket(supabase: SupabaseClient): Promise<void> {
  if (bucketVerifiedForClient === supabase) return;

  const { data: existing } = await supabase.storage.getBucket(BUCKET_NAME);
  if (existing) {
    bucketVerifiedForClient = supabase;
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: false,
    fileSizeLimit: MAX_FILE_SIZE_BYTES,
    allowedMimeTypes: ['application/pdf'],
  });
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Failed to create Supabase Storage bucket "${BUCKET_NAME}": ${createError.message}`);
  }
  bucketVerifiedForClient = supabase;
}

export function createSupabaseStorageAdapter(url: string, serviceRoleKey: string): StorageAdapter {
  const supabase = getClient(url, serviceRoleKey);

  return {
    async put(key, data, contentType) {
      await ensureBucket(supabase);
      await withRetry(async () => {
        // upsert: true makes a retried put (same key, same bytes) safe to
        // repeat rather than failing on "already exists" if a prior attempt
        // actually succeeded server-side but the response was lost.
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(key, data, {
          contentType,
          upsert: true,
        });
        if (error) {
          throw new Error(`Supabase Storage upload failed for key "${key}": ${error.message}`);
        }
      }, `storage.put(${key})`);
    },

    // No ensureBucket() on the read paths below (get/getSignedUrl) — a
    // readable object can only exist if the bucket was already created by a
    // prior put(), so verifying bucket existence before every read was a
    // wasted Supabase Storage round trip on every report-detail page load
    // (Perf sprint round 2). Only put() still provisions the bucket.
    async get(key) {
      return withRetry(async () => {
        const { data, error } = await supabase.storage.from(BUCKET_NAME).download(key);
        if (error || !data) {
          throw new Error(`Supabase Storage download failed for key "${key}": ${error?.message ?? 'not found'}`);
        }
        return Buffer.from(await data.arrayBuffer());
      }, `storage.get(${key})`);
    },

    async delete(key) {
      await ensureBucket(supabase);
      await withRetry(async () => {
        const { error } = await supabase.storage.from(BUCKET_NAME).remove([key]);
        if (error) {
          throw new Error(`Supabase Storage delete failed for key "${key}": ${error.message}`);
        }
      }, `storage.delete(${key})`);
    },

    async getSignedUrl(key, expiresInSeconds = 3600) {
      return withRetry(async () => {
        const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(key, expiresInSeconds);
        if (error || !data) {
          throw new Error(`Supabase Storage signed URL failed for key "${key}": ${error?.message ?? 'unknown error'}`);
        }
        return data.signedUrl;
      }, `storage.getSignedUrl(${key})`);
    },
  };
}

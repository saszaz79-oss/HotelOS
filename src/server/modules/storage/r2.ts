import type { StorageAdapter } from './adapter';

/**
 * R2 storage adapter (Cloudflare deployment prep). Uses the native R2
 * binding (`env.<BUCKET_BINDING>`) rather than the S3-compatible REST API —
 * no AWS SDK dependency, no request signing, and it's the binding path
 * Cloudflare itself recommends when the calling code already runs inside a
 * Worker (which HotelOS does, via OpenNext).
 *
 * MIME type, file size, hotel ownership, and access authorization are
 * validated one layer up, in `reports/commands.ts` `uploadReport` — before
 * this adapter's `put()` is ever called (Architecture §2: the storage
 * adapter is generic/dumb by design; validation is domain-module
 * responsibility, not storage-layer responsibility). Only metadata and the
 * object key are ever written to Postgres (`ReportUpload.storageKey`) — the
 * file bytes themselves live only in R2.
 *
 * UNVERIFIED against a live R2 bucket (no Cloudflare account available in
 * this environment) — see docs/R2_SETUP.md.
 */

interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
}

async function getBucket(bindingName: string): Promise<R2Bucket> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const context = getCloudflareContext();
  const bucket = (context?.env as Record<string, unknown> | undefined)?.[bindingName] as R2Bucket | undefined;
  if (!bucket) {
    throw new Error(
      `R2 bucket binding "${bindingName}" not found — check the [[r2_buckets]] entry in wrangler.jsonc matches STORAGE_R2_BINDING. See docs/R2_SETUP.md.`
    );
  }
  return bucket;
}

export function createR2StorageAdapter(bindingName: string): StorageAdapter {
  return {
    async put(key, data, contentType) {
      const bucket = await getBucket(bindingName);
      await bucket.put(key, data, { httpMetadata: { contentType } });
    },
    async get(key) {
      const bucket = await getBucket(bindingName);
      const object = await bucket.get(key);
      if (!object) {
        throw new Error(`Object not found in R2: ${key}`);
      }
      const arrayBuffer = await object.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
    async delete(key) {
      const bucket = await getBucket(bindingName);
      await bucket.delete(key);
    },
  };
}

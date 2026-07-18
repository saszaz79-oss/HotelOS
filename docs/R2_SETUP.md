# Cloudflare R2 Setup for HotelOS

Browser-only, in the Cloudflare dashboard. R2 stores original Opera PDF uploads and generated executive PDF exports — never the Worker's own filesystem, which doesn't exist at runtime (`docs/CLOUDFLARE_COMPATIBILITY_REPORT.md`).

## 1. Create the Bucket

1. In the Cloudflare dashboard, go to **R2 Object Storage** in the left sidebar.
2. If this is your first R2 bucket, Cloudflare may ask you to enable R2 on your account (free tier available, no credit card required for the free allocation as of this writing — verify current terms on the pricing page before proceeding, since Cloudflare's billing pages are the authoritative source, not this document).
3. Click **Create bucket**.
4. Name it `hotelos-storage` — this must match the `bucket_name` in `wrangler.jsonc`'s `r2_buckets` entry (already set to this name in the repository; rename both together if you use a different name).
5. Location: **Automatic** is fine unless you have a specific data-residency requirement (see `docs/ARCHITECTURE.md` §16 "Data residency awareness" — flagged there as an open question for legal review, not resolved by this document).
6. Click **Create bucket**.

## 2. Bind the Bucket to Your Worker

This is what lets the deployed Worker access the bucket without any access keys or secrets at all — R2 bindings are authenticated by the Worker's own identity.

**Option A — via `wrangler.jsonc` (already done in this repository)**:

The repository's `wrangler.jsonc` already includes:
```jsonc
"r2_buckets": [
  {
    "binding": "HOTELOS_BUCKET",
    "bucket_name": "hotelos-storage"
  }
]
```
As long as the bucket name matches what you created in step 1, this binding is picked up automatically the next time the Worker is built and deployed — no dashboard action needed for the binding itself.

**Option B — verify/add via the dashboard** (useful to confirm it's live, or if you ever need to add it outside of a code deploy):
1. Go to **Workers & Pages** → select your `hotelos` Worker → **Settings** → **Bindings**.
2. Confirm an **R2 Bucket** binding named `HOTELOS_BUCKET` points at `hotelos-storage`. If it's missing (e.g., you're setting this up before the first deploy), click **Add binding** → **R2 Bucket**, set the variable name to `HOTELOS_BUCKET`, and select the bucket.

## 3. No Access Keys Needed

Unlike a generic S3-compatible setup, you do **not** need to generate R2 API tokens/access keys for the application itself to read and write objects — `src/server/modules/storage/r2.ts` uses the native binding (`env.HOTELOS_BUCKET.put/get/delete`), which Cloudflare authorizes automatically because the code runs inside your own Worker. You would only need R2 API tokens if you wanted to access the bucket from *outside* Cloudflare (e.g., a separate admin script running on your laptop) — not required for HotelOS's current functionality.

## 4. What Gets Validated Before a File Reaches R2

This was already built before Cloudflare-specific work began, and required no changes for R2 compatibility — listed here so you know it's real, not assumed:

- **MIME type**: `src/server/modules/reports/commands.ts` `uploadReport` only accepts `application/pdf`; anything else is rejected before any storage call.
- **File size**: capped at 15MB (matches `next.config.mjs`'s Server Actions body-size limit).
- **Hotel ownership**: `assertHotelAccess(scope, hotelId)` — the uploading user must have an active membership in the target hotel (or be the Platform Owner) before the upload proceeds.
- **Feature flag**: the `reports` module must be enabled for the hotel (`src/server/modules/feature-flags`) — on by default, but toggleable per hotel from `/admin/feature-flags`.

Only after all four checks pass does `storage.put()` — and therefore the R2 adapter — ever get called. Only the resulting object key and file metadata are written to Postgres (`ReportUpload.storageKey`, `originalFilename`, `fileSizeBytes`, `checksumSha256`) — the file bytes themselves live only in R2, never duplicated into the database.

## 5. Future: Hotel Logos and Attachments

`docs/CLOUDFLARE_COMPATIBILITY_REPORT.md` and the main README note that hotel logos currently accept only an external URL (`/admin` "Logo URL" field), not a file upload — this is a known, documented v0.1 simplification, not a Cloudflare limitation. When logo upload is built, it reuses this same R2 adapter and bucket (a `hotels/{hotelId}/logo/{filename}` key convention, matching the existing `reportStorageKey`/`exportStorageKey` pattern in `src/server/modules/storage/adapter.ts`) — no new infrastructure needed, just new application code.

## 6. Verifying It Works (once deployed)

There is no way to verify R2 access from this environment (no live Cloudflare account). Once you have a real deployment (`docs/CLOUDFLARE_DEPLOYMENT.md`):
1. Log in, upload a Manager Flash PDF through the normal Reports Upload screen.
2. In the Cloudflare dashboard, go to your `hotelos-storage` bucket and confirm an object appeared under `hotels/<hotelId>/reports/<reportUploadId>/<filename>`.
3. Open the report's review screen in HotelOS and confirm the extracted fields render — this proves the Worker successfully wrote to and read back from R2 in the same request cycle.

export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Time-limited, tenant-agnostic URL for direct client access. Callers are
   * responsible for their own tenant-scope check before calling this — the
   * storage layer has no concept of hotel membership. */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

/**
 * Never embed the user-supplied filename in a storage key — it's attacker-
 * controlled input and was previously joined directly into the key,
 * letting a filename like `../../whatever` escape the local adapter's base
 * directory (caught by its own path-traversal guard, which is what
 * surfaced as an uncaught "Invalid storage key" exception in production,
 * digest 1047464761). The human-readable original filename is preserved
 * separately in ReportUpload.originalFilename for display; the key only
 * needs a safe extension derived from it.
 */
function safeExtension(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(ext) ? ext : 'bin';
}

/**
 * Per-hotel, per-day key so storage-level access patterns mirror tenant
 * boundaries (Architecture §6) and files are browsable by day. `businessDate`
 * (the date the report's data is actually FOR) isn't known until after
 * extraction runs — it lives on ReportDocument, not at raw-upload time — so
 * this uses `uploadedAt` (the one real date available when the file is
 * written) as the day folder. This is a storage-organization convenience
 * only; the authoritative business date is the DB's ReportDocument field,
 * not the file path. hotelId/reportUploadId are always server-generated
 * (cuid/uuid), never raw user input.
 */
export function reportStorageKey(
  hotelId: string,
  reportUploadId: string,
  filename: string,
  uploadedAt: Date = new Date()
): string {
  const dayFolder = uploadedAt.toISOString().slice(0, 10); // YYYY-MM-DD
  return `hotels/${hotelId}/${dayFolder}/${reportUploadId}/original.${safeExtension(filename)}`;
}

export function exportStorageKey(
  hotelId: string,
  exportedReportId: string,
  filename: string,
  createdAt: Date = new Date()
): string {
  const dayFolder = createdAt.toISOString().slice(0, 10);
  return `hotels/${hotelId}/${dayFolder}/exports/${exportedReportId}/original.${safeExtension(filename)}`;
}

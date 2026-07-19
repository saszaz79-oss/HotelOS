export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
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

/** Per-hotel-prefixed key so storage-level access patterns mirror tenant boundaries (Architecture §6). hotelId/reportUploadId are always server-generated (cuid/uuid), never raw user input. */
export function reportStorageKey(hotelId: string, reportUploadId: string, filename: string): string {
  return `hotels/${hotelId}/reports/${reportUploadId}/original.${safeExtension(filename)}`;
}

export function exportStorageKey(hotelId: string, exportedReportId: string, filename: string): string {
  return `hotels/${hotelId}/exports/${exportedReportId}/original.${safeExtension(filename)}`;
}

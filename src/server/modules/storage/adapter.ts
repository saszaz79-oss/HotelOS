export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Per-hotel-prefixed key so storage-level access patterns mirror tenant boundaries (Architecture §6). */
export function reportStorageKey(hotelId: string, reportUploadId: string, filename: string): string {
  return `hotels/${hotelId}/reports/${reportUploadId}/${filename}`;
}

export function exportStorageKey(hotelId: string, exportedReportId: string, filename: string): string {
  return `hotels/${hotelId}/exports/${exportedReportId}/${filename}`;
}

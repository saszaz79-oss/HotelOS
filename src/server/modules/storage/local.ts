import { promises as fs } from 'fs';
import path from 'path';
import type { StorageAdapter } from './adapter';

/**
 * Local-filesystem storage — dev-only (Architecture §6). Never selected in
 * production; STORAGE_DRIVER=s3 is required there (see src/server/modules/storage/index.ts).
 */
export function createLocalStorageAdapter(basePath: string): StorageAdapter {
  function resolve(key: string): string {
    const full = path.join(basePath, key);
    if (!full.startsWith(path.resolve(basePath))) {
      throw new Error('Invalid storage key: path traversal detected');
    }
    return full;
  }

  return {
    async put(key, data) {
      const full = resolve(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, data);
    },
    async get(key) {
      return fs.readFile(resolve(key));
    },
    async delete(key) {
      await fs.rm(resolve(key), { force: true });
    },
    async getSignedUrl() {
      throw new Error(
        'getSignedUrl is not supported by the local storage adapter (dev-only, no HTTP file server). Use STORAGE_DRIVER=supabase for signed URLs.'
      );
    },
  };
}

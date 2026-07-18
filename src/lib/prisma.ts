import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { resolveDatabaseSsl } from './db-ssl';

/**
 * Prisma 7 requires a driver adapter for every PrismaClient — there is no
 * more Rust query-engine-binary fallback (see prisma/schema.prisma comment,
 * docs/CLOUDFLARE_DEPLOYMENT.md). This is also what makes Prisma usable
 * inside a Cloudflare Worker at all.
 *
 * Connection string resolution, in order:
 *   1. Cloudflare Workers (deployed via @opennextjs/cloudflare) — the
 *      Hyperdrive binding's pooled connection string, read through
 *      `getCloudflareContext()`. Verified empirically (this session) that
 *      calling it outside a Workers request context throws synchronously
 *      and catchably — safe to call eagerly and fall through on failure.
 *   2. Plain Node.js (local dev, `prisma migrate`/seed scripts, CI) —
 *      `process.env.DATABASE_URL`.
 *
 * UNVERIFIED against a live Hyperdrive+Workers deployment (no Cloudflare
 * account available in this environment) — see docs/CLOUDFLARE_DEPLOYMENT.md
 * "What Has Not Been Verified" before trusting this in production.
 */

interface HyperdriveBinding {
  connectionString: string;
}

/**
 * Hyperdrive terminates TLS to Supabase on Cloudflare's own infrastructure
 * — the binding's connection string is a Cloudflare-internal proxy target,
 * not a direct Supabase endpoint, so the DATABASE_CA_CERT handling below
 * (see src/lib/db-ssl.ts) doesn't apply to it. Only the DATABASE_URL
 * fallback path connects to Supabase directly and needs it.
 */
function resolveConnection(): { connectionString: string; ssl?: ReturnType<typeof resolveDatabaseSsl> } {
  try {
    const context = getCloudflareContext();
    const hyperdrive = (context?.env as { HYPERDRIVE?: HyperdriveBinding } | undefined)?.HYPERDRIVE;
    if (hyperdrive?.connectionString) {
      return { connectionString: hyperdrive.connectionString };
    }
  } catch {
    // Not running under OpenNext/Workers, or called outside request scope —
    // fall through to DATABASE_URL below.
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set and no Cloudflare Hyperdrive binding is available. ' +
        'See docs/CLOUDFLARE_DEPLOYMENT.md and docs/SUPABASE_SETUP.md.'
    );
  }
  return { connectionString: url, ssl: resolveDatabaseSsl() };
}

const globalForPrisma = globalThis as unknown as { __hotelosPrisma?: PrismaClient };

/** Constructed once per isolate/process, cached on globalThis — same reuse pattern already documented for the in-process Event Bus (Architecture §17). */
function getRealClient(): PrismaClient {
  if (!globalForPrisma.__hotelosPrisma) {
    const { connectionString, ssl } = resolveConnection();
    const adapter = new PrismaPg(ssl !== undefined ? { connectionString, ssl } : { connectionString });
    globalForPrisma.__hotelosPrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.__hotelosPrisma;
}

/**
 * Call-site-compatible with every existing `import { prisma } from
 * '@/lib/prisma'; prisma.hotel.findMany(...)` usage across the codebase —
 * the Proxy forwards every property access to the lazily-constructed real
 * client, so `prisma.hotel` returns the real model delegate (not a stub),
 * and `.findMany(...)` is then called on that real object directly.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getRealClient();
    return Reflect.get(client as object, prop, client);
  },
});

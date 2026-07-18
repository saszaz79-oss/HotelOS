import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { getCloudflareContext } from '@opennextjs/cloudflare';

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

function resolveConnectionString(): string {
  try {
    const context = getCloudflareContext();
    const hyperdrive = (context?.env as { HYPERDRIVE?: HyperdriveBinding } | undefined)?.HYPERDRIVE;
    if (hyperdrive?.connectionString) {
      return hyperdrive.connectionString;
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
  return url;
}

const globalForPrisma = globalThis as unknown as { __hotelosPrisma?: PrismaClient };

/** Constructed once per isolate/process, cached on globalThis — same reuse pattern already documented for the in-process Event Bus (Architecture §17). */
function getRealClient(): PrismaClient {
  if (!globalForPrisma.__hotelosPrisma) {
    const adapter = new PrismaPg({ connectionString: resolveConnectionString() });
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

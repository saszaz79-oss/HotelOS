import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 CLI/migration configuration (Cloudflare deployment prep).
 *
 * This file is read by `prisma migrate dev/deploy` and `prisma generate` —
 * it is NEVER bundled into the Cloudflare Worker (only `next build` /
 * `opennextjs-cloudflare build` output is deployed). Migrations always run
 * from a real Node.js process (local dev, or a GitHub Actions runner —
 * never from inside the Worker itself, since DDL needs a direct,
 * non-pooled-by-Hyperdrive connection). See docs/CLOUDFLARE_DEPLOYMENT.md
 * and docs/SUPABASE_SETUP.md for which of Supabase's two connection
 * strings (direct vs. pooled) goes where.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});

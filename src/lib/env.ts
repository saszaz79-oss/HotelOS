import { z } from 'zod';

const envSchema = z.object({
  // Optional here (not required) because the Cloudflare Workers runtime
  // resolves the database connection through the Hyperdrive binding
  // instead (see src/lib/prisma.ts) — DATABASE_URL is only mandatory for
  // migrations/seeding, which run in a plain Node.js process (local dev,
  // CI) and are validated separately by prisma.config.ts. Requiring it here
  // would make the whole `env` module throw at Worker cold start on any
  // deployment that relies solely on the Hyperdrive binding.
  DATABASE_URL: z.string().optional(),
  // Unused (session tokens are random bearer tokens stored server-side, not
  // signed cookies — see src/server/modules/auth/session.ts) — kept as an
  // optional reserved field rather than removed outright, in case signed
  // cookies/CSRF tokens need it later; never required, so it never blocks
  // deployment for a value nothing currently reads.
  SESSION_SECRET: z.string().min(16).optional(),
  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./.storage'),
  STORAGE_R2_BINDING: z.string().default('HOTELOS_BUCKET'),
  AI_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  NOTIFICATION_DRIVER: z.enum(['mock']).default('mock'),
});

// Parsed once, server-side only. Never import this file from client components.
export const env = envSchema.parse(process.env);

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
  // 'local': filesystem, dev-only, never persistent on serverless (Vercel or
  // Cloudflare Workers). 'r2': Cloudflare Workers binding, unavailable on
  // Vercel. 'supabase': the only production-valid driver on this
  // deployment — see src/server/modules/storage/supabase.ts. Left
  // defaulting to 'local' for zero-config local dev; production sets this
  // explicitly via the hosting platform's environment variables.
  STORAGE_DRIVER: z.enum(['local', 'r2', 'supabase']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./.storage'),
  STORAGE_R2_BINDING: z.string().default('HOTELOS_BUCKET'),
  // Only required when STORAGE_DRIVER=supabase (validated at adapter
  // construction, not here, for the same reason DATABASE_URL isn't
  // required at this layer — a deployment that doesn't use this driver
  // shouldn't be forced to set it).
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  NOTIFICATION_DRIVER: z.enum(['mock']).default('mock'),
});

// Parsed once, server-side only. Never import this file from client components.
export const env = envSchema.parse(process.env);

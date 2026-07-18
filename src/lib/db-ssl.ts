import type { ConnectionOptions } from 'node:tls';

/**
 * Shared TLS config for every direct (non-Hyperdrive) Postgres connection —
 * used identically by src/lib/prisma.ts's DATABASE_URL fallback path (the
 * app's runtime client when not running behind Cloudflare Hyperdrive, e.g.
 * on Vercel) and prisma/seed.ts (a standalone script, always outside
 * Hyperdrive). Works the same whether DATABASE_URL is Supabase's direct
 * connection or a pooled (Supavisor/PgBouncer) one — same issuing CA either
 * way.
 *
 * Supabase's Postgres presents a certificate chain that includes their own
 * root CA, which is not in Node's default trusted root store — connecting
 * with plain `ssl: true` fails with "Error opening a TLS connection:
 * self-signed certificate in certificate chain" (reproduced locally against
 * a real SSL-enabled Postgres instance presenting an unrecognized root, to
 * confirm this is the actual mechanism, not a guess).
 *
 * `prisma migrate deploy` doesn't hit this: Prisma's migration engine uses
 * libpq-style `sslmode=require` semantics (encrypt only, no chain
 * verification) — that's a weaker guarantee, not something to copy into a
 * runtime client. The correct fix is to trust the actual issuing CA
 * explicitly, so verification is real, not skipped — never
 * `rejectUnauthorized: false`, never `ssl: false`.
 *
 * DATABASE_CA_CERT: the CA certificate (PEM), obtained from the Supabase
 * dashboard — Project Settings -> Database -> SSL Configuration -> download
 * certificate. Not a secret in the confidentiality sense (a CA certificate
 * contains only a public key), but treated as a GitHub Actions secret here
 * for convenience alongside DATABASE_URL. See docs/SUPABASE_SETUP.md.
 */
/**
 * A correctly-pasted PEM already has real line breaks. If the secret was
 * stored or passed through something that collapsed it to a single line
 * with literal `\n` escape sequences instead (common when a multi-line
 * value passes through JSON encoding, a shell variable, or a form that
 * doesn't preserve line breaks), OpenSSL/Node's TLS can't parse it as a
 * certificate at all — it just fails, with no certificate-related error
 * text to point at the real cause. Normalize that back into real newlines.
 * Real PEM bodies never legitimately contain a literal backslash-n
 * sequence, so this is safe to apply whenever there are no real newlines
 * already present.
 */
function normalizePem(value: string): string {
  let normalized = value.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.includes('\n') && normalized.includes('\\n')) {
    normalized = normalized.replace(/\\n/g, '\n');
  }
  return normalized;
}

export function resolveDatabaseSsl(): boolean | ConnectionOptions {
  const raw = process.env.DATABASE_CA_CERT;
  if (raw && raw.trim().length > 0) {
    return { ca: normalizePem(raw), rejectUnauthorized: true };
  }
  // No CA configured: keep Node's default strict verification (never
  // silently weaken it). This fails closed — the same error surfaces until
  // DATABASE_CA_CERT is set — rather than connecting without real
  // verification.
  return true;
}

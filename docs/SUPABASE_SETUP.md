# Supabase PostgreSQL Setup for HotelOS

Browser-only — no local installation required. Read `docs/CLOUDFLARE_COMPATIBILITY_REPORT.md` first if you haven't: it explains why HotelOS needs the specific connection pattern below (Prisma driver adapters + Hyperdrive), not a generic "point Prisma at a URL" setup.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New Project**.
3. Choose or create an organization.
4. Fill in:
   - **Name**: `hotelos` (or `hotelos-production` if you'll also make a staging project later).
   - **Database Password**: generate a strong one and **save it somewhere secure immediately** — Supabase shows it only once.
   - **Region**: pick the region closest to your hotels' users (for GCC/Saudi Arabia, choose the closest available region — Supabase's region list is shown in the dropdown; pick the lowest-latency option available to you).
   - **Pricing Plan**: Free tier is fine to start.
5. Click **Create new project**. Wait a few minutes for provisioning.

**Free tier limitation, stated plainly**: Supabase's free tier **pauses your database after 7 days of inactivity**. For an active pilot this is rarely hit, but if HotelOS goes quiet for a week (e.g., between pilot engagements), the database pauses and needs to be manually resumed from the Supabase dashboard before the app works again. If this is a problem for your timeline, Supabase's paid tier (from $25/month) removes the pause. This is a real, known tradeoff — not hidden.

## 2. Get the Two Connection Strings You Need

Once the project is ready, go to **Project Settings** (gear icon) → **Database**.

Supabase gives you **two different connection strings** — HotelOS uses both, for different purposes. Getting these swapped is the single most common setup mistake, so read this carefully:

### A. Direct connection (for migrations and seeding)

Under **Connection string** → **URI**, with **Connection pooling** toggled **off** (or look for the entry explicitly labeled "Direct connection"). It looks like:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

- **Used for**: `prisma migrate deploy` (schema changes) and `prisma/seed.ts` (initial account creation) — both run from a normal Node.js process on a GitHub Actions runner, never from inside the deployed application itself.
- **Where it goes**: the `DATABASE_URL` GitHub Actions repository secret (`docs/PRODUCTION_ENVIRONMENT.md`).
- **Why direct, not pooled**: schema migrations run DDL (`CREATE TABLE`, `ALTER TABLE`, etc.) that behaves unpredictably or fails outright through a transaction pooler (pgbouncer-style poolers, including Supabase's own, don't support all session-level operations migrations need).
- **Also needed for the seed step (not for migrations)**: Supabase's Postgres presents a certificate chain rooted at a CA that Node doesn't trust by default. `prisma migrate deploy` doesn't hit this (Prisma's migration engine uses looser, libpq-style SSL semantics), but `prisma/seed.ts` and the app's own runtime client (`src/lib/prisma.ts`) do, since they connect via `@prisma/adapter-pg` (Node's `pg` library, which verifies the certificate chain strictly). Download the CA certificate from **Project Settings → Database → SSL Configuration → Download certificate** (`prod-ca-2021.crt`) and set it as the `DATABASE_CA_CERT` GitHub Actions repository secret, pasting the full PEM content (including the `-----BEGIN CERTIFICATE-----`/`-----END CERTIFICATE-----` lines) as-is — GitHub secrets support multi-line values. This is not a confidential value in the usual sense (a CA certificate has no private key), it's just kept as a secret alongside `DATABASE_URL` for convenience. See `src/lib/db-ssl.ts`.

### B. Pooled/Transaction connection (for Cloudflare Hyperdrive)

Same page, with **Connection pooling** toggled **on**, **Mode: Transaction**, usually on port `6543`:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:6543/postgres
```

- **Used for**: configuring the Cloudflare Hyperdrive resource (`docs/CLOUDFLARE_DEPLOYMENT.md` step 3) — this is what the deployed Worker actually queries through at runtime.
- **A nuance worth knowing**: Hyperdrive does its own connection pooling on Cloudflare's side. Pointing Hyperdrive at Supabase's *already-pooled* endpoint means you have two pooling layers stacked — this generally still works, but Cloudflare's own guidance leans toward pointing Hyperdrive at your database's most direct reachable connection when possible. For a pilot-scale deployment, either connection string works with Hyperdrive; if you see unusual connection errors later, try switching Hyperdrive's configured string from the pooled one to the direct one as a first troubleshooting step.

**Both connection strings require SSL** — Supabase enforces this by default; the connection string itself doesn't need an explicit `?sslmode=require` parameter for the standard Supabase-provided strings, but if you ever construct one by hand, include it.

## 3. Running Migrations Safely

**Never run `prisma migrate dev` against production** — that command is for local development schema iteration and can prompt for destructive changes. Production always uses `prisma migrate deploy`, which only applies already-committed, already-reviewed migration files in order — see `docs/ARCHITECTURE.md` §9 "Migration Discipline" and `docs/UPDATE_AND_ROLLBACK.md`.

`prisma/migrations/` (with the baseline `init` migration) is already committed to this repository — no first-time bootstrap step is needed. To apply it: **Actions tab → Database Migration → Run workflow → type "migrate"**. From that point forward, every schema change is a new migration file committed to the repo, applied the same way.

## 4. Connection Pooling and SSL — What HotelOS Already Handles

- **SSL is required, and requires the CA certificate for the direct-connection paths**: `prisma migrate deploy` connects fine without any extra configuration (its migration engine uses looser, libpq-style SSL semantics — encrypts, doesn't verify the chain). `prisma/seed.ts` and `src/lib/prisma.ts`'s DATABASE_URL fallback connect via Node's `pg` library instead, which verifies the certificate chain strictly and fails with `self-signed certificate in certificate chain` unless Supabase's CA is supplied — see §2A above and `src/lib/db-ssl.ts`. This was found and fixed by actually reproducing the failure locally (a real SSL-enabled Postgres instance presenting an untrusted root), not assumed from documentation.
- **Pooling for migrations**: not applicable — migrations run infrequently and briefly, a direct connection is appropriate and correct.
- **Pooling for runtime queries**: handled by Cloudflare Hyperdrive (`docs/CLOUDFLARE_DEPLOYMENT.md` step 3) when deployed there — Hyperdrive terminates TLS to Supabase itself, so the `DATABASE_CA_CERT` handling doesn't apply to that path. On other hosts (e.g. Vercel), the app falls back to `DATABASE_URL` directly and needs `DATABASE_CA_CERT` exactly like the seed script does.

## 5. Never Run Destructive Reset Commands

`prisma migrate reset` (drops and recreates the entire database) must **never** be run against the production Supabase project — it exists for local development only. This document deliberately does not show its usage in any production context. See `docs/UPDATE_AND_ROLLBACK.md` for what "safe update" actually means for HotelOS.

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

- **Used for**: `prisma migrate deploy` (schema changes) and `prisma/seed.ts` (initial account creation) — both run from a normal Node.js process (GitHub Actions), never from inside the Cloudflare Worker.
- **Where it goes**: the `DATABASE_URL_DIRECT` GitHub Actions secret (`docs/PRODUCTION_ENVIRONMENT.md`).
- **Why direct, not pooled**: schema migrations run DDL (`CREATE TABLE`, `ALTER TABLE`, etc.) that behaves unpredictably or fails outright through a transaction pooler (pgbouncer-style poolers, including Supabase's own, don't support all session-level operations migrations need).

### B. Pooled/Transaction connection (for Cloudflare Hyperdrive)

Same page, with **Connection pooling** toggled **on**, **Mode: Transaction**, usually on port `6543`:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:6543/postgres
```

- **Used for**: configuring the Cloudflare Hyperdrive resource (`docs/CLOUDFLARE_DEPLOYMENT.md` step 3) — this is what the deployed Worker actually queries through at runtime.
- **A nuance worth knowing**: Hyperdrive does its own connection pooling on Cloudflare's side. Pointing Hyperdrive at Supabase's *already-pooled* endpoint means you have two pooling layers stacked — this generally still works, but Cloudflare's own guidance leans toward pointing Hyperdrive at your database's most direct reachable connection when possible. For a pilot-scale deployment, either connection string works with Hyperdrive; if you see unusual connection errors later, try switching Hyperdrive's configured string from the pooled one to the direct one as a first troubleshooting step.

**Both connection strings require SSL** — Supabase enforces this by default; the connection string itself doesn't need an explicit `?sslmode=require` parameter for the standard Supabase-provided strings, but if you ever construct one by hand, include it.

## 3. Running Migrations Safely (First Time and Every Time After)

**Never run `prisma migrate dev` against production** — that command is for local development schema iteration and can prompt for destructive changes. Production always uses `prisma migrate deploy`, which only applies already-committed, already-reviewed migration files in order — see `docs/ARCHITECTURE.md` §9 "Migration Discipline" and `docs/UPDATE_AND_ROLLBACK.md`.

**First-time setup** (this repository currently has no `prisma/migrations/` directory — see `docs/CLOUDFLARE_COMPATIBILITY_REPORT.md`):

1. From a machine with Node.js (your own, if you get access to one later, or via a one-off GitHub Actions run — see below), set `DATABASE_URL` to Supabase's **direct** connection string.
2. Run `npx prisma migrate dev --name init` **once**, against a database with no important data yet (this generates the baseline migration files from the current schema and applies them).
3. Commit the generated `prisma/migrations/` folder to your repository — from that point forward, every schema change is a new migration file, applied via `prisma migrate deploy` (the `.github/workflows/migrate.yml` workflow in this repository does exactly this, manually triggered from the GitHub Actions tab in your browser — no local install needed).

If you never get local Node.js access at all: the very first `prisma migrate dev --name init` genuinely needs to run once from *some* real Node.js environment with a network path to Supabase. The cleanest browser-only way to do this is a **temporary GitHub Codespace** (a browser-based VS Code environment, free tier available) — open one on this repository, run the command there once, commit the result, then never need it again (every subsequent migration goes through the committed `migrate deploy` GitHub Actions workflow, which needs no interactive session).

## 4. Connection Pooling and SSL — What HotelOS Already Handles

- **SSL**: enforced by Supabase's connection strings by default; `pg`/`@prisma/adapter-pg` respect the `sslmode` parameter Supabase includes automatically.
- **Pooling for migrations**: not applicable — migrations run infrequently and briefly, a direct connection is appropriate and correct.
- **Pooling for runtime queries**: handled by Cloudflare Hyperdrive (`docs/CLOUDFLARE_DEPLOYMENT.md` step 3), not by application code — `src/lib/prisma.ts` doesn't implement its own pooling because Hyperdrive already does it at the infrastructure layer.

## 5. Never Run Destructive Reset Commands

`prisma migrate reset` (drops and recreates the entire database) must **never** be run against the production Supabase project — it exists for local development only. This document deliberately does not show its usage in any production context. See `docs/UPDATE_AND_ROLLBACK.md` for what "safe update" actually means for HotelOS.

# HotelOS Production Environment Reference

Every configuration value HotelOS needs in production, categorized by **where it lives** and **who can see it** — these are different mechanisms with different security properties, and mixing them up is the most common way to accidentally leak a credential. Read this before touching the Cloudflare or GitHub dashboards.

## The Five Categories

### 1. Public environment variables (Worker `vars`)

Non-secret configuration, safe to appear in `wrangler.jsonc` or the Cloudflare dashboard's plain-text "Variables" section. Visible to anyone with dashboard access to the Worker, and technically visible in the Worker's own runtime — never put anything here you wouldn't want printed in a log.

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | `HotelOS` | Already the default |
| `AI_PROVIDER` | `anthropic` | Which provider `ai-orchestration` uses |
| `NOTIFICATION_DRIVER` | `mock` | Real delivery not built yet (D9) |
| `STORAGE_DRIVER` | `r2` | Must be `r2` in production — `local` has no filesystem to use |
| `STORAGE_R2_BINDING` | `HOTELOS_BUCKET` | Must match the R2 binding name in `wrangler.jsonc` |
| `NODE_ENV` | `production` | Gates `prisma/seed.ts`'s production-safe path |

Set these in the Cloudflare dashboard: **Workers & Pages** → your Worker → **Settings** → **Variables and Secrets** → add as **Text** type (not "Encrypt").

### 2. Encrypted Worker secrets

Values the Worker needs at runtime that must never be visible in the dashboard once set (Cloudflare stores these encrypted and only exposes them to the running Worker).

| Secret | Value | Where it's used |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | `ai-orchestration` — Executive AI Summary. App runs fine without it (shows "not configured"); only needed if you want real AI output. |

Set via: Cloudflare dashboard → **Workers & Pages** → your Worker → **Settings** → **Variables and Secrets** → add as **Secret** type. Or via `wrangler secret put ANTHROPIC_API_KEY` if you ever do get a local/CI shell with wrangler authenticated.

**Notably NOT here**: database credentials. HotelOS's runtime database access goes through the Hyperdrive binding (category 5), not a secret — this is deliberate: Hyperdrive bindings aren't plain connection strings sitting in your Worker's config, they're a managed resource reference, which is a stronger security posture than a secret you have to remember to rotate everywhere.

### 3. Database migration credentials

Used only by `prisma migrate deploy` and `prisma/seed.ts` — both run from a **real Node.js process on a GitHub Actions runner** (`.github/workflows/migrate.yml`, `.github/workflows/seed-production.yml`), never from inside the deployed application itself. This makes these two workflows platform-agnostic: they work identically whether the application is deployed to Cloudflare Workers, Vercel, or anywhere else, because they never go through the application's own runtime or hosting platform at all.

| Secret name | Where | Value |
|---|---|---|
| `DATABASE_URL` | GitHub repository secret (**Settings → Secrets and variables → Actions → New repository secret**) | Supabase's **direct** (non-pooled) connection string — see `docs/SUPABASE_SETUP.md` §2A. Migrations run DDL and need a direct connection, not a connection-pooled one. |
| `DATABASE_CA_CERT` | GitHub repository secret | Supabase's CA certificate PEM (**Project Settings → Database → SSL Configuration → Download certificate**). Only `seed-production.yml` needs this — `migrate.yml` doesn't (see `docs/SUPABASE_SETUP.md` §4 for why the two paths differ). Not confidential (a CA cert has no private key); kept as a secret only for convenience. |

These are the **only** repository secrets required for `migrate.yml` and `seed-production.yml`. They are GitHub secrets, not Vercel or Cloudflare ones.

**Important if deployed anywhere other than Cloudflare Workers (e.g. Vercel)**: `src/lib/prisma.ts` only skips the `DATABASE_CA_CERT` requirement when running behind a Cloudflare Hyperdrive binding, which terminates TLS to Supabase itself. On any other host, the deployed application connects to Supabase the same way `prisma/seed.ts` does, and hits the identical `self-signed certificate in certificate chain` error on its first real query unless that host's own environment variables also include `DATABASE_URL` and `DATABASE_CA_CERT` — set those directly in that platform's dashboard (e.g. Vercel → Project → Settings → Environment Variables), separately from the GitHub secrets above, which only reach GitHub Actions runners.

**`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (Vercel/self-hosted)**: set this to a fixed random value (e.g. `openssl rand -base64 32`) in the hosting platform's environment variables so Server Action identity stays stable across builds. Without it, Next.js generates a fresh key per build, and any cached/prerendered page from an earlier build submits action IDs the newer server bundle rejects with `Failed to find Server Action` (HTTP 500) — observed in production on Vercel when a redeploy reused cached prerendered HTML against a rebuilt server bundle. The login page is prerendered, making it the first place this bites.

### 4. Runtime database credentials

The Worker's actual query-time database access — not a secret string at all, but a **Cloudflare Hyperdrive binding**.

| Binding name | Configured via | Points at |
|---|---|---|
| `HYPERDRIVE` | `wrangler.jsonc` `hyperdrive` array (already present, with a placeholder `id`) | Supabase — created via `npx wrangler hyperdrive create` or the Cloudflare dashboard's Hyperdrive section; see `docs/CLOUDFLARE_DEPLOYMENT.md` step 3 |

You never see or copy a connection string for this into any HotelOS config — Hyperdrive itself holds the real connection details, and `src/lib/prisma.ts` reads `env.HYPERDRIVE.connectionString` at request time (a value Cloudflare injects, not one you type in).

### 5. R2 bindings

Object storage access — also a binding, not a secret, since R2 bindings are authorized by the Worker's identity, not a credential.

| Binding name | Configured via | Points at |
|---|---|---|
| `HOTELOS_BUCKET` | `wrangler.jsonc` `r2_buckets` array (already present) | The `hotelos-storage` bucket — see `docs/R2_SETUP.md` |

## Quick Reference Table

| Name | Category | Set where | Never appears in |
|---|---|---|---|
| `NEXT_PUBLIC_APP_NAME`, `AI_PROVIDER`, `NOTIFICATION_DRIVER`, `STORAGE_DRIVER`, `STORAGE_R2_BINDING`, `NODE_ENV` | Public var | Cloudflare dashboard, Worker Variables (Text) | — (these are non-secret by design) |
| `ANTHROPIC_API_KEY` | Encrypted secret | Cloudflare dashboard, Worker Variables (Secret) | Git, dashboard display after saving, logs |
| `DATABASE_URL` | Migration credential | GitHub Actions repository secret | Git, application code — used only by `migrate.yml` and `seed-production.yml` |
| `HYPERDRIVE` | Runtime DB binding | `wrangler.jsonc` (id) + Cloudflare Hyperdrive resource | Application source (only the binding name appears, never a connection string) |
| `HOTELOS_BUCKET` | R2 binding | `wrangler.jsonc` (bucket name) + Cloudflare R2 resource | Application source (only the binding name appears) |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | CI deploy credential | GitHub Actions repository secrets | Only needed if using the GitHub Actions deploy fallback (`.github/workflows/deploy.yml`) instead of Workers Builds — Workers Builds needs neither, since it authenticates via its own GitHub App connection |

## What Must Never Be Committed to Git

Verified clean in this repository (`.gitignore` covers `.env`, `.dev.vars*` except the `.example` templates, `.wrangler`, `.open-next`): no real secret value has been placed in any committed file. `wrangler.jsonc`'s `hyperdrive` entry contains a literal placeholder string `<YOUR_HYPERDRIVE_ID>` — a Hyperdrive *id* is not itself a secret (it doesn't grant access without also being the authenticated owner of that Cloudflare account), but replace it with your real id after creating the resource regardless, since a placeholder obviously won't route anywhere.

## Production Platform Owner Password

`prisma/seed.ts`'s production path (`NODE_ENV=production`) creates exactly one account, username `superadmin`, with a fixed temporary password (`ChangeMe123!`, documented in `prisma/seed.ts` and `README.md`) and `mustChangePassword: true`. The account is unusable beyond a single login until that password is changed — that forced-change control, not secrecy of the initial password, is what keeps this safe. The seed is idempotent: if `superadmin` already exists, it is left untouched (no password reset, no duplicate account), so `seed-production.yml` is safe to run more than once. Run it via **Actions tab → Seed Production Platform Owner → Run workflow** (browser-only) after the Database Migration workflow has applied `prisma/migrations/` to the production database. Log in and change the password immediately.

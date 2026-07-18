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

Used only by `prisma migrate deploy`, `prisma migrate dev --name init` (one-time bootstrap), and `prisma/seed.ts` — all run from a **real Node.js process**, never from inside the Worker. In this repository, that means GitHub Actions (`.github/workflows/migrate.yml`, `.github/workflows/seed-production.yml`).

| Secret name | Where | Value |
|---|---|---|
| `DATABASE_URL_DIRECT` | GitHub repository secret (**Settings → Secrets and variables → Actions**) | Supabase's **direct** (non-pooled) connection string — see `docs/SUPABASE_SETUP.md` §2A |

This is a GitHub secret, not a Cloudflare one — it has nothing to do with the Worker's own configuration, since the Worker never uses it.

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
| `DATABASE_URL_DIRECT` | Migration credential | GitHub Actions repository secret | Git, Cloudflare dashboard, application code |
| `HYPERDRIVE` | Runtime DB binding | `wrangler.jsonc` (id) + Cloudflare Hyperdrive resource | Application source (only the binding name appears, never a connection string) |
| `HOTELOS_BUCKET` | R2 binding | `wrangler.jsonc` (bucket name) + Cloudflare R2 resource | Application source (only the binding name appears) |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | CI deploy credential | GitHub Actions repository secrets | Only needed if using the GitHub Actions deploy fallback (`.github/workflows/deploy.yml`) instead of Workers Builds — Workers Builds needs neither, since it authenticates via its own GitHub App connection |

## What Must Never Be Committed to Git

Verified clean in this repository (`.gitignore` covers `.env`, `.dev.vars*` except the `.example` templates, `.wrangler`, `.open-next`): no real secret value has been placed in any committed file. `wrangler.jsonc`'s `hyperdrive` entry contains a literal placeholder string `<YOUR_HYPERDRIVE_ID>` — a Hyperdrive *id* is not itself a secret (it doesn't grant access without also being the authenticated owner of that Cloudflare account), but replace it with your real id after creating the resource regardless, since a placeholder obviously won't route anywhere.

## Production Platform Owner Password

Per Constitution §2 rule #10: production must never launch with a known/default Platform Owner password. `prisma/seed.ts`'s production path (`NODE_ENV=production`) creates exactly one account (`admin`) with a cryptographically random password, printed once to the GitHub Actions log, never stored in any file, with `mustChangePassword: true` forcing an immediate change on first login. Run this via `.github/workflows/seed-production.yml` (manual trigger, browser-only — Actions tab → Run workflow) after your first successful deploy and migration.

# HotelOS — Cloudflare Workers Deployment Guide

Browser-only workflow — no Node.js, Docker, PostgreSQL, or Wrangler installation required on your own machine. Read `docs/CLOUDFLARE_COMPATIBILITY_REPORT.md` first for what was changed and why; this document is the step-by-step execution of that preparation.

**Before you start**: this guide describes real steps for a real deployment. Nothing has been deployed on your behalf — no Cloudflare, Supabase, or GitHub credentials exist in the environment that prepared this code. You are the one clicking through the dashboards below.

## Architecture Recap

```
Your browser → GitHub (private repo) → Cloudflare Workers Builds (CI, on push)
                                              │
                                              ▼
                                    @opennextjs/cloudflare build
                                              │
                                              ▼
                                  Cloudflare Worker (Next.js SSR)
                                    │              │            │
                                    ▼              ▼            ▼
                              Hyperdrive        R2 Bucket    Static
                              (binding)      (HOTELOS_BUCKET)  Assets
                                    │
                                    ▼
                              Supabase PostgreSQL
```

Migrations (`prisma migrate deploy`) and initial seeding run separately, via manually-triggered GitHub Actions — never from inside the Worker (`docs/CLOUDFLARE_COMPATIBILITY_REPORT.md` explains why: DDL needs a direct, non-Hyperdrive-pooled connection, and the Worker runtime shouldn't be the thing deciding when to apply schema changes).

## Step 1: Create Your Supabase Project

See `docs/SUPABASE_SETUP.md` in full. Summary: create the project, save the two connection strings (direct + pooled), leave the migration until Step 6.

## Step 2: Create Your R2 Bucket

See `docs/R2_SETUP.md` in full. Summary: create a bucket named `hotelos-storage` in the Cloudflare dashboard (**R2 Object Storage** → **Create bucket**).

## Step 3: Create the Hyperdrive Configuration

1. In the Cloudflare dashboard, go to **Workers & Pages** → **Hyperdrive** (or search "Hyperdrive" in the dashboard search).
2. Click **Create configuration**.
3. Name it `hotelos-db`.
4. Paste in Supabase's connection string (start with the **direct** one from `docs/SUPABASE_SETUP.md` §2A; switch to the pooled one later if you hit connection issues — both work with Hyperdrive).
5. Click **Create**. Cloudflare shows you a Hyperdrive **id** — copy it.
6. Open `wrangler.jsonc` in your repository (via GitHub's web editor, or after cloning in a Codespace) and replace `<YOUR_HYPERDRIVE_ID>` with the real id. Commit this change.

## Step 4: Push This Code to a Private GitHub Repository

If you already have a GitHub account and a private repo ready, skip to Step 5. Otherwise:

1. Go to [github.com](https://github.com) and sign in (or create an account — free).
2. Click the **+** icon (top right) → **New repository**.
3. Name it `hotelos` (or anything you prefer), set **Private**, do **not** initialize with a README (you're uploading an existing project).
4. Click **Create repository**.
5. On the next page, GitHub shows upload options. Since you have no local git/command-line access, use GitHub's **web-based upload**:
   - On the new repo's page, click **uploading an existing file**.
   - Drag the entire project folder's contents in. **Important**: GitHub's drag-and-drop web uploader has file count/size limits and does not preserve folder structure well for very large projects with `node_modules`. Since `node_modules` is already gitignored, exclude it manually before uploading (do not drag the `node_modules` folder at all).
   - If the web uploader struggles with the number of files (this project has several hundred source files across `src/`, `docs/`, `prisma/`), the more reliable browser-only alternative is a **GitHub Codespace**:
     a. On your empty new repo's page, click the green **Code** button → **Codespaces** tab → **Create codespace on main**.
     b. This opens a full VS Code environment in your browser, with a terminal, **with Node.js already available** — this is a genuine, free (with usage limits), zero-install way to get a real shell when you need one (e.g., for Step 6's one-time migration bootstrap).
     c. In the Codespace, you'd normally `git clone` or copy files in — since your code currently lives only in this prepared environment, the practical path is: use the Codespace's file upload (drag files into the VS Code file explorer) or its terminal's `git` commands once the code is present, then `git add -A && git commit -m "Initial commit" && git push`.
6. Confirm the push: refresh your GitHub repo page and confirm you see `package.json`, `src/`, `docs/`, `wrangler.jsonc`, etc.

**A git repository with an initial commit already exists** in the prepared code (created during this session as a safety checkpoint before risky changes) — if you're given direct access to this project's files, look for the `.git` folder; if so, you can push that existing history directly (`git remote add origin <your-repo-url>` then `git push -u origin master`) instead of re-uploading from scratch, which preserves the commit history documenting exactly what changed and why.

## Step 5: Connect Cloudflare Workers Builds (Preference 1 — Recommended)

This is the no-YAML, dashboard-only CI/CD path — Cloudflare builds and deploys automatically whenever you push to GitHub.

1. In the Cloudflare dashboard, go to **Workers & Pages**.
2. Click **Create** → **Workers** → **Import a repository** (or **Connect to Git**, wording may vary slightly by dashboard version).
3. Authorize Cloudflare's GitHub App to access your repository (you'll be redirected to GitHub to approve — grant access to the specific `hotelos` repo only, not all repos, when GitHub's permission screen offers that choice).
4. Select your `hotelos` repository and the `main`/`master` branch.
5. Cloudflare will try to auto-detect a framework preset. Set/confirm:
   - **Build command**: `npm run cf:build`
   - **Deploy command**: `npx wrangler deploy`
   - **Build output / Root directory**: leave as the repository root (where `wrangler.jsonc` lives).
6. Under **Environment variables** (in this same setup flow, or afterward under **Settings → Variables and Secrets**), add every value from `docs/PRODUCTION_ENVIRONMENT.md` categories 1 and 2 (public vars as Text, `ANTHROPIC_API_KEY` as Secret).
7. Under **Bindings** (same Settings page), confirm the Hyperdrive and R2 bindings from `wrangler.jsonc` show up automatically once the first build completes (they're defined in the config file, not manually re-entered here) — if they don't appear, add them manually here as a fallback, matching the binding names in `wrangler.jsonc` exactly (`HYPERDRIVE`, `HOTELOS_BUCKET`).
8. Click **Save and Deploy**. Cloudflare Workers Builds now triggers automatically on every push to your main branch.

## Step 5 (Alternative): GitHub Actions Deploy (Preference 2)

Only use this if you deliberately choose not to use Workers Builds (e.g., you want deploy logic in version-controlled YAML instead of dashboard config). The repository already includes `.github/workflows/deploy.yml`, disabled by default (`if: false`) to avoid double-deploying if you also set up Workers Builds.

To enable it instead of Workers Builds:
1. In GitHub, go to your repo → **Settings** → **Secrets and variables** → **Actions**.
2. Add `CLOUDFLARE_API_TOKEN`: in the Cloudflare dashboard, go to **My Profile** → **API Tokens** → **Create Token** → use the **Edit Cloudflare Workers** template → scope it to your account → **Continue to summary** → **Create Token** → copy it (shown once).
3. Add `CLOUDFLARE_ACCOUNT_ID`: found in the Cloudflare dashboard's right sidebar on almost any Workers/R2 page, or under **Workers & Pages** → **Overview**.
4. Add `DATABASE_URL_DIRECT` (same value as used elsewhere — see `docs/PRODUCTION_ENVIRONMENT.md`).
5. Edit `.github/workflows/deploy.yml` in your repo (GitHub's web editor is fine) and remove the `if: false` line.
6. Push — the workflow now runs on every push to `main`.

## Step 6: Running Migrations Safely (First Time)

1. In GitHub, go to your repo → **Settings** → **Secrets and variables** → **Actions** → add `DATABASE_URL_DIRECT` (Supabase's direct connection string, `docs/SUPABASE_SETUP.md` §2A).
2. **First-time only**: since this repository has no `prisma/migrations/` folder yet, you need one real Node.js session to generate the baseline (`docs/SUPABASE_SETUP.md` §3) — use a GitHub Codespace for this, run `npx prisma migrate dev --name init`, commit the generated `prisma/migrations/` folder, push.
3. **Every time after**: go to your repo's **Actions** tab → **Database Migration** workflow → **Run workflow** → type `migrate` in the confirmation box → **Run workflow**. This applies any new migration files that were committed since the last run. Never destructive, never resets data (`docs/UPDATE_AND_ROLLBACK.md`).

## Step 7: First Deploy

If you set up Workers Builds (Step 5), it already deployed automatically when you pushed in Step 4/6. Otherwise, trigger the GitHub Actions deploy workflow manually from the Actions tab.

## Step 8: Seed the Production Platform Owner Account

1. Repo → **Actions** tab → **Seed Production Platform Owner** workflow → **Run workflow** → type `seed` → **Run workflow**.
2. Open the workflow run's log, find the printed username (`admin`) and temporary password.
3. **Copy it immediately and store it securely** (a password manager, not a chat message) — it is shown exactly once, in this log.
4. Log in to your deployed HotelOS URL with those credentials — you'll be forced to `/change-password` immediately.

## Step 9: Connect Your Existing Cloudflare-Managed Custom Domain

1. In the Cloudflare dashboard, go to **Workers & Pages** → your `hotelos` Worker → **Settings** → **Domains & Routes**.
2. Click **Add** → **Custom Domain**.
3. Enter your domain (e.g., `app.yourhotel.com` or your chosen subdomain) — since it's already managed by Cloudflare, this is typically a one-click confirmation; Cloudflare handles the DNS record and SSL certificate automatically.
4. Wait for DNS propagation (usually near-instant for domains already on Cloudflare) and confirm the domain loads your app.

## Step 10: Creating Preview Deployments

Two options, depending on which CI path you chose:
- **Workers Builds**: every push to a **non-production branch** (configurable in the Workers Builds settings, under **Build configuration** → **Branch control**) automatically creates a preview deployment at a unique `*.workers.dev` URL, without touching your production domain. Push a feature branch, open a pull request, and Cloudflare comments the preview URL on it (if you enable that integration in settings).
- **Manual preview from a Codespace**: `npm run cf:preview` runs a real local Workers runtime (via Miniflare) against your code — useful for testing before pushing, though it needs the same secrets/bindings configured locally (`.dev.vars`, copied from `.dev.vars.example`) — see that file's comments for what it needs, and note it requires a reachable Postgres for Hyperdrive's local emulation (Supabase's direct connection string works for this too).

## Step 11: Updating the Application Without Deleting Hotel Data

See `docs/UPDATE_AND_ROLLBACK.md` in full — the short version: push code changes normally (auto-deploys via Workers Builds); if the change includes a schema migration, run the **Database Migration** GitHub Action *before or immediately after* the deploy (order matters less than making sure it runs at all — see that document for the additive-migration discipline that makes this safe either way).

## Step 12: Rolling Back to a Previous Worker Version

See `docs/UPDATE_AND_ROLLBACK.md` §"Rolling Back a Worker Version" — Cloudflare Workers keeps a version history you can roll back to from the dashboard in a few clicks, entirely separate from any database rollback question.

## Summary: Exact Commands

| Purpose | Command | Runs where |
|---|---|---|
| Local dev (Next.js only, no Workers runtime) | `npm run dev` | Anywhere Node.js exists |
| Build the Worker bundle | `npm run cf:build` | Cloudflare Workers Builds / GitHub Actions / Codespace |
| Preview the built Worker locally | `npm run cf:preview` | Codespace only (needs Node.js + a reachable Postgres) |
| Deploy | `npm run cf:deploy` (or Workers Builds' automatic deploy) | Cloudflare Workers Builds / GitHub Actions |
| Apply migrations | `npx prisma migrate deploy` | GitHub Actions (`migrate.yml`) |
| Seed production Platform Owner | `NODE_ENV=production npx tsx prisma/seed.ts` | GitHub Actions (`seed-production.yml`) |

None of these require anything installed on your restricted Windows machine — every one of them runs in Cloudflare's build infrastructure, GitHub Actions, or a browser-based Codespace.

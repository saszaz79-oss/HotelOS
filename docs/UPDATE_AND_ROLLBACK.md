# HotelOS — Safe Updates and Rollback

Two independent things can go wrong with an update: the **application code** (a Worker deploy) and the **database schema** (a migration). They roll back differently, and this document treats them separately on purpose — conflating them is how deployments accidentally destroy data.

## The One Rule That Makes This Safe

**Constitution §2 rule #9**: Hotels, Users, Reports, AI Conversations, and Audit Logs are never deleted by a schema upgrade. This isn't a promise layered on top of the migration process — it's enforced by the migration *discipline* itself (`docs/ARCHITECTURE.md` §9):

- Every schema change is an **additive** `prisma migrate dev`-generated file, committed to `prisma/migrations/`.
- A column that's no longer used is stopped-being-used by application code first, and only dropped in a **later, separate** migration — never in the same change that stops reading it.
- `prisma migrate reset` (drops and recreates everything) is never run against production — grep your own `prisma/migrations/` history and your GitHub Actions logs if you're ever unsure whether this happened; it should never appear there.

## Updating the Application

### Code-only changes (no schema change)

1. Push to your `main` branch (or merge a PR into it).
2. Workers Builds (or the GitHub Actions fallback) automatically builds and deploys.
3. That's it — no migration step needed, no data at risk.

### Changes that include a schema migration

1. Write and test the migration locally or in a Codespace: `npx prisma migrate dev --name <description>` generates a new file under `prisma/migrations/` and applies it to whatever database `DATABASE_URL` points to in that session (use a disposable/staging database for this, never production).
2. Commit the generated migration file(s) along with your code changes, push.
3. Before (or immediately after — see note below) the code deploy reaches production, run the **Database Migration** GitHub Action (`docs/CLOUDFLARE_DEPLOYMENT.md` Step 6) to apply the new migration to the real Supabase database via `prisma migrate deploy`.

**Why order "matters less than you'd think"**: because migrations are additive-first, new code that expects a new column can tolerate the migration running slightly before the code deploy (the column exists, old code just doesn't use it yet); and a migration that runs slightly after a deploy is safe as long as the new code doesn't *require* the new column to exist before its own first request (a good reason to keep individual deploys small — one migration, one feature, not a backlog of both). If you want zero ambiguity, always run the migration first, then deploy.

### What "safe" does NOT mean

It does not mean every migration is automatically non-disruptive. Adding a `NOT NULL` column without a default to a table with existing rows, for example, would fail against real data — Prisma's own migration generation will warn you about this at generation time, in the same terminal/Codespace session where you run `prisma migrate dev`. Read those warnings; they exist specifically to catch this class of mistake before it reaches the Actions log.

## Rolling Back a Worker Version

Cloudflare Workers keeps a version history independent of your database.

1. Cloudflare dashboard → **Workers & Pages** → your `hotelos` Worker → **Deployments** (or **Versions**, depending on dashboard version).
2. You'll see a list of previous deployments, each tied to a specific build/commit.
3. Click the **...** menu on a previous, known-good deployment → **Rollback** (or **Promote to Production** — wording varies by dashboard version).
4. Confirm. Cloudflare switches production traffic to that previous version, typically within seconds, with zero downtime.

**This does not touch your database.** If the deployment you're rolling back *from* included a schema migration that the old code doesn't understand, rolling back the Worker alone may not fully resolve the issue — see the next section.

## Rolling Back a Database Change

There is no one-click "undo migration" in Prisma — this is intentional (databases with real data don't have a safe generic undo). Your options, in order of preference:

1. **Roll forward, don't roll back**: write a new migration that reverses the problematic change (e.g., a migration that re-adds a column you dropped, or relaxes a constraint you tightened), and deploy that. This preserves the full history and is almost always safer than trying to reverse-apply an old migration file.
2. **Point-in-time recovery**: Supabase's paid tiers include point-in-time recovery (restore the database to a timestamp before the bad migration). The free tier does not — this is a concrete reason to consider Supabase's paid tier once you have real customer data you can't afford to lose, not just a nice-to-have.
3. **Manual SQL fix**: for a small, well-understood mistake (e.g., a wrong default value), it's sometimes safe to write and run a corrective SQL statement directly via Supabase's SQL Editor (dashboard → **SQL Editor**) rather than a full migration — treat this as an exception requiring extra care and a backup of the affected rows first, not a routine practice.

## Never Do These in Production

- `prisma migrate reset`
- `prisma db push --force-reset` (or any `--force-reset` flag)
- Manually running `DROP TABLE`/`TRUNCATE` against Hotels, Users, ReportUpload, ReportDocument, HotelMetric, AIConversation, AuditLog, or any other table holding real operational history — even "just to clean up test data" — without a reviewed migration and a fresh backup confirmation first.
- Deploying a code change that reads a column before the migration adding it has been applied (causes runtime errors on every request touching that code path) — this is why "migrate first, deploy after" is the safer default ordering when in doubt.

## Verifying an Update Didn't Lose Data

After any update that included a migration, a quick sanity check via Supabase's dashboard (**Table Editor**) or SQL Editor:

```sql
select count(*) from "Hotel";
select count(*) from "User";
select count(*) from "ReportUpload";
select count(*) from "AuditLog";
```

Compare against what you expect (or against a note you made before the update) — these counts should never *decrease* as a result of a routine update. A decrease is a signal to stop and investigate before doing anything else, not something to dismiss.

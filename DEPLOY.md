# Deploying to Vercel + Neon

This app deploys to [Vercel](https://vercel.com) (Hobby plan) with [Neon](https://neon.tech) Postgres,
using Vercel's GitHub integration: connect the repo once, and every push to the
default branch auto-deploys (no CLI, no API tokens to manage).

Cover-image uploads use [Vercel Blob](https://vercel.com/docs/vercel-blob) storage instead of local
disk, since Vercel's serverless functions don't have a persistent filesystem — see
["Uploads on Vercel"](#uploads-on-vercel) below.

## 1. Create a Neon project

1. Go to [neon.tech](https://neon.tech) → **New Project** (the free tier is enough).
2. In the project dashboard, copy the **pooled** connection string (the one with
   `-pooler` in the hostname — Neon's PgBouncer endpoint, needed because
   serverless functions open many short-lived connections). It already includes
   `sslmode=require`, which `pg`/Drizzle pass through untouched.
3. Keep this tab open — you'll paste the string into Vercel as `DATABASE_URL` in step 3.

## 2. Import the repo on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick this repo.
2. Framework preset: leave it as **auto-detected** (or "Vite") — the actual build is
   controlled by `vercel.json`'s `buildCommand`, which runs the TanStack Start
   Vercel build (`pnpm build:vercel`, powered by Nitro's `vercel` preset) after
   running migrations. Vercel picks up `pnpm` automatically from `pnpm-lock.yaml`.

## 3. Set environment variables

In the Vercel project → **Settings → Environment Variables**, add these for the
**Production** environment only.

> **Warning — do not set `DATABASE_URL` for Preview deployments by default.**
> The build command runs `pnpm db:migrate` on every build, so a Preview
> environment pointing at the same Neon database would run schema migrations
> from every open PR — concurrently, on every push — against your production
> schema. If you want working preview deployments, use Neon's branch-per-PR
> feature (a separate database branch per preview) instead of sharing the
> production connection string.

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled connection string from step 1 | Needed at **build time** too, since `vercel.json` runs `pnpm db:migrate` as part of the build. |
| `BETTER_AUTH_SECRET` | Output of `pnpm dlx @better-auth/cli secret` | Generate once, keep it stable across deploys. |
| `BETTER_AUTH_URL` | `https://<your-app>.vercel.app` (or your custom domain) | Better Auth reads this automatically; no code change needed. Update it if you later attach a custom domain. |
| `BLOB_READ_WRITE_TOKEN` | From a Vercel Blob store (see below) | Switches cover-image uploads from disk to Vercel Blob automatically. |

To create the Blob store and token: project → **Storage** tab → **Create Database**
→ **Blob** → connect it to this project. Vercel then offers to add
`BLOB_READ_WRITE_TOKEN` to the project's env vars for you — accept that, or copy
the token manually into the table above.

Optional, only if you want auth to also work on Vercel **preview** deployments
(each PR gets a random `*.vercel.app` subdomain, different from the production
`BETTER_AUTH_URL`): set `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated origins,
e.g. `https://*.vercel.app`) — Better Auth reads this env var automatically too,
no code change required.

## 4. Deploy

Click **Deploy**. Vercel will:

1. Install dependencies (`pnpm install`).
2. Run the build command from `vercel.json`: `pnpm db:migrate && pnpm build:vercel`,
   which applies pending Drizzle migrations against `DATABASE_URL` and then builds
   the app with Nitro's `vercel` preset (emits `.vercel/output`, Vercel's
   [Build Output API](https://vercel.com/docs/build-output-api/v3) format — no
   further framework detection needed).

From then on, every push to the connected branch redeploys automatically.

### Running migrations another way

If you'd rather not run migrations as part of the build (e.g. to control exactly
when they run), remove `pnpm db:migrate &&` from `vercel.json`'s `buildCommand`
and instead run `pnpm db:migrate` locally against the Neon connection string
before (or after) triggering a deploy:

```bash
DATABASE_URL="<neon-pooled-connection-string>" pnpm db:migrate
```

## Uploads on Vercel

`src/server/uploads.ts` selects the storage backend per request:

- **Disk** (`diskStorage`, default): writes to `UPLOADS_DIR` and serves files back
  through the `/api/uploads/$` route. This is what local dev and any
  traditional (non-serverless) deployment use.
- **Vercel Blob** (`vercelBlobStorage`): used automatically when
  `BLOB_READ_WRITE_TOKEN` is set. Uploads go straight to Vercel Blob and
  `coverImageUrl` becomes Blob's own absolute URL — the `/api/uploads/$` route
  is simply unused in that case.

No other code needs to know which backend is active: `coverImageUrl` is treated
as an opaque URL everywhere it's read.

## Local parity notes

- Local dev (`pnpm dev`) and `pnpm build` are unaffected by any of this — the
  Vercel/Nitro build only activates in `pnpm build:vercel` (`TARGET=vercel`, see
  `vite.config.ts`), and disk storage stays the default whenever
  `BLOB_READ_WRITE_TOKEN` is unset.
- You can point local dev at the same Neon database by copying the pooled
  connection string into `.env.local`'s `DATABASE_URL` — useful for debugging
  production data, but be careful running `pnpm db:push` against it.
- `pnpm build:vercel` can be run locally to sanity-check the Vercel build
  (`ls .vercel/output` afterwards); actually serving that output requires the
  Vercel CLI (`vercel dev` / `vercel deploy`), which this repo intentionally
  does not depend on for the GitHub-integration deploy flow described above.

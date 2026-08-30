# EduManage (Bachandi) — Render Hosting Design

Date: 2026-08-30

## Goal

Deploy the app (currently local-only: SQLite + local-disk file uploads,
no git repo) to Render as a single publicly reachable production
service, with a real Postgres database and cloud file storage instead
of local disk.

## Decisions

- **Database**: Supabase Postgres (project already created by the user).
- **File storage**: Supabase Storage (S3-compatible), same project.
- **Topology**: one Render Web Service. Express serves both the built
  React client (static files + SPA fallback) and the `/api/*` routes,
  same origin — avoids cross-origin cookie/CORS complexity entirely.
- **Domain**: Render's default subdomain for now, service named
  `edumanage` (branding in the app is "EduManage", not "Bachandi").
  A custom domain can be attached later without re-architecting.
- **Environments**: production only. No staging for this first launch.
- **Data**: production starts empty except the seeded admin account.
  No migration of local dev.db test data (`@test.com` accounts) or
  local `server/uploads/*` test files (~15 files, mostly tiny/synthetic).
- **Admin credentials**: keep the placeholder `admin@bachandi.app` /
  `admin123` seed for the first deploy; user will change it after first
  login. Not blocking launch.
- **Git/GitHub**: repo does not exist yet. User will create an empty
  GitHub repo; we initialize git locally, commit, and push. Render
  deploys from this repo (via `render.yaml` blueprint or manual dashboard
  connection).
- **SMTP**: already configured for local dev via Resend
  (`server/.env`: `SMTP_HOST=smtp.resend.com`, etc. — see
  [mailer.ts](../../../server/src/utils/mailer.ts)). Same env vars carry
  over to Render, no code changes needed. Note: without a verified
  sending domain in Resend, delivery is restricted to the Resend
  account owner's own email — fine for initial smoke-testing, revisit
  before onboarding real users.

## Architecture

```
                    ┌─────────────────────────────┐
GitHub repo  ──push──▶  Render Web Service "edumanage" │
                    │  Express (single process)    │
                    │  ├─ static: client/dist       │
                    │  ├─ SPA fallback → index.html │
                    │  └─ /api/*  routes            │
                    └───────────┬──────────┬────────┘
                                │          │
                     Postgres   │          │  Storage (S3-compatible)
                    (Supabase)  ▼          ▼  (Supabase)
```

Local dev is unaffected: Vite continues to proxy `/api` to
`localhost:4000`, and storage/mailer fall back to local-disk/console
behavior when Supabase/SMTP env vars aren't set — mirroring the
existing dev-fallback pattern already used for SMTP.

## Code changes

### 1. Database provider (SQLite → Postgres)

- [server/prisma/schema.prisma:5](../../../server/prisma/schema.prisma)
  — `datasource db { provider = "sqlite" }` → `"postgresql"`.
- The 11 existing migrations under `server/prisma/migrations/` were
  generated for SQLite and are not guaranteed to replay on Postgres.
  Archive/remove them and generate one fresh `init` migration against
  the real Supabase Postgres connection string (consistent with the
  "start fresh" data decision — there's no production data to preserve
  across a migration history anyway).
- `server/prisma/migration_lock.toml` regenerates automatically for the
  new provider when `prisma migrate dev` runs.

### 2. File storage abstraction

Local disk storage is hard-coded in three places today:

- [server/src/middleware/upload.middleware.ts](../../../server/src/middleware/upload.middleware.ts)
  — `multer.diskStorage` writing into `uploadsDir`.
- [server/src/app.ts:17](../../../server/src/app.ts) — `express.static(uploadsDir)`
  serving `/uploads/*`.
- [server/src/controllers/teacher.controller.ts:308,324,329,342](../../../server/src/controllers/teacher.controller.ts)
  and [server/src/controllers/pupil.controller.ts:93](../../../server/src/controllers/pupil.controller.ts)
  — build `/uploads/${file.filename}` URLs and `fs.unlink` old files
  directly.

Introduce `server/src/utils/storage.ts`:

```ts
saveFile(buffer: Buffer, originalName: string, mimetype: string): Promise<{ url: string; key: string }>
deleteFile(key: string): Promise<void>
```

Behavior mirrors the existing SMTP dev-fallback pattern in
[mailer.ts](../../../server/src/utils/mailer.ts): if
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_STORAGE_BUCKET`
aren't set, `saveFile` writes to local disk (today's behavior,
unchanged for local dev) and `deleteFile` removes the local file. When
configured, both operate against Supabase Storage instead.

Changes required:
- `upload.middleware.ts`: `multer.diskStorage` → `multer.memoryStorage()`
  so the raw buffer is available to pass to `saveFile`.
- The three controller call sites: replace manual URL construction with
  `await saveFile(...)`, and the two delete call sites with
  `await deleteFile(...)`.
- `app.ts`: keep `/uploads` static serving only for the local-disk
  fallback case (dev); when Supabase Storage is configured, uploaded
  file URLs are full Supabase URLs and this route is simply unused
  (no harm leaving the route mounted either way — it's additive).

### 3. Serve the built client from Express

`app.ts` gains, after the existing API routes:

- `express.static(path.join(__dirname, "../../client/dist"))`
- A catch-all route returning `client/dist/index.html` for any
  non-`/api`, non-`/uploads` GET request, so client-side routing
  (React Router) survives a hard refresh on any URL.
- Guarded so it only activates when `client/dist` exists — local dev
  (where Vite serves the client on its own port) is unaffected.

### 4. Env & config

Extend [server/src/utils/env.ts](../../../server/src/utils/env.ts) with
the same "optional, becomes required together" pattern already used for
`SMTP_*`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

`DATABASE_URL` already exists as an env var; only its value changes
(SQLite file path → Postgres connection string).

## Deployment

### Git & GitHub

1. `git init` at the repo root; add a root `.gitignore` covering
   `node_modules/`, `**/dist/`, `.env`, `server/uploads/*` (except
   `.gitkeep`), `server/prisma/dev.db`.
2. Initial commit.
3. User creates an empty GitHub repo and provides the URL; push to it.

### Render

Add `render.yaml` at the repo root defining one web service:

- **Build command**: `npm ci && npm run build && npm run prisma:generate --workspace server && npm run prisma:migrate:deploy --workspace server`
  (new `prisma:migrate:deploy` script wrapping `prisma migrate deploy`
  — safe to re-run on every deploy, only applies pending migrations).
- **Start command**: `node server/dist/server.js`.
- **Env vars**: `DATABASE_URL`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `JWT_SECRET`,
  `CLIENT_ORIGIN` (same Render URL — same-origin, but still used for
  building email links), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`,
  `NODE_ENV=production`. Secrets marked `sync: false` in the blueprint
  so real values are pasted into Render's dashboard, never committed.

### Verification sequence

1. **Local-against-Supabase**: point a local `.env` at the real Supabase
   Postgres connection string, run the fresh migration + seed, smoke-test
   the app locally (register/verify/login/notifications, file upload)
   against real Supabase Postgres + Storage — catches problems while
   iteration is still fast.
2. **Push & connect**: push to GitHub, connect the repo in Render
   (blueprint or dashboard), set env vars, trigger first deploy.
3. **Production smoke test**: repeat the same end-to-end flow
   (register → verify email → admin/teacher approval → class →
   attendance/post/notification) against the live Render URL, the same
   way it was already verified locally in this project.

## Out of scope (for this pass)

- Staging environment.
- Custom domain.
- Migrating existing local dev.db data or local uploaded test files.
- Changing the placeholder admin credentials.
- Verifying a custom sending domain in Resend (email delivery stays
  restricted to the account owner's address until this is done).

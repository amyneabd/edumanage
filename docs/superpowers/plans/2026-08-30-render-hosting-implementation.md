# Render Hosting Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate EduManage (Bachandi) from local-only (SQLite + local-disk uploads, no git repo) to a single Render Web Service backed by Supabase Postgres and Supabase Storage, deployable from a fresh GitHub repo.

**Architecture:** One Express process serves the built React client (static files + SPA fallback) and all `/api/*` routes from the same origin. A new `server/src/utils/storage.ts` abstraction mirrors the existing SMTP dev-fallback pattern in `mailer.ts`: local disk when Supabase env vars are absent (today's dev behavior, unchanged), Supabase Storage when configured. Prisma's datasource provider moves from `sqlite` to `postgresql`, with a single fresh `init` migration replacing the 11 SQLite-era migrations (no production data exists to preserve).

**Tech Stack:** Express 5, Prisma 6.19, TypeScript (NodeNext), Vite/React 19, `@supabase/supabase-js` (new dependency), Vitest, Render Blueprints (`render.yaml`).

**Spec:** [docs/superpowers/specs/2026-08-30-render-hosting-design.md](../specs/2026-08-30-render-hosting-design.md)

## Global Constraints

- Database: Supabase Postgres (project already created by the user).
- File storage: Supabase Storage (S3-compatible), same Supabase project.
- Topology: exactly one Render Web Service — Express serves both the built client and `/api/*`, same origin.
- Domain: Render's default subdomain; service is named `edumanage`.
- Environments: production only — no staging environment.
- Data: production starts empty except the seeded admin account — no migration of local `dev.db` data or local `server/uploads/*` files.
- Admin credentials: keep the placeholder `admin@bachandi.app` / `admin123` seed — do not change as part of this work.
- SMTP is already configured via Resend in `server/.env` — no mailer code changes are in scope.
- Local dev must be unaffected: Vite continues to proxy `/api` to `localhost:4000`; storage and mailer fall back to local-disk/console behavior when Supabase/SMTP env vars aren't set.

---

## File Structure

| File | Change |
|---|---|
| `server/.gitignore` | Modify — add 5 stray debug-script filenames |
| `server/src/utils/storage.ts` | Create — `saveFile`/`deleteFile` abstraction |
| `server/src/utils/storage.local.test.ts` | Create — local-disk fallback tests |
| `server/src/utils/storage.supabase.test.ts` | Create — Supabase Storage backend tests |
| `server/src/utils/env.ts` | Modify — add `supabaseStorage` block |
| `server/package.json` | Modify — add `@supabase/supabase-js` dep, `prisma:migrate:deploy` script |
| `server/src/middleware/upload.middleware.ts` | Modify — `multer.diskStorage` → `multer.memoryStorage()` |
| `server/src/controllers/teacher.controller.ts` | Modify — 3 handlers use `saveFile`/`deleteFile` |
| `server/src/controllers/pupil.controller.ts` | Modify — `submitExam` uses `saveFile` |
| `server/src/app.ts` | Modify — serve `client/dist` + SPA fallback |
| `server/prisma/schema.prisma` | Modify — `provider = "postgresql"` |
| `server/prisma/migrations/` | Replace — 11 SQLite migrations → 1 fresh `init` migration |
| `render.yaml` | Create — Render Blueprint |

---

### Task 1: Git baseline commit

A git repo already exists at the project root (`git init -b main` was run earlier; the only existing commit is `dbac4bb Add Render hosting design spec`). This task commits the actual application on top of that as a clean baseline, excluding local-only artifacts.

**Files:**
- Modify: `server/.gitignore`

**Interfaces:** None (infra-only task, no code).

- [ ] **Step 1: Add the 5 untracked debug scripts to `server/.gitignore`**

Current `server/.gitignore`:
```
node_modules
dist
.env
uploads/*
!uploads/.gitkeep
prisma/dev.db
prisma/migrations/dev
*.log
```

Append these 5 lines (these are one-off manual QA scripts in `server/`, not part of the app — keep them usable locally, keep them out of the new GitHub repo):
```
cleanup-qa-pupils.mjs
qa-setup-gradebook-ledger.mjs
reset-qa-password.mjs
seed-pending-request.mjs
test-notifications.mjs
```

- [ ] **Step 2: Verify the ignore rules take effect**

Run: `git status --porcelain server`
Expected: none of the 5 filenames above, `server/node_modules`, `server/dist`, `server/.env`, `server/uploads/*` (except `.gitkeep`), or `server/prisma/dev.db` appear in the output.

- [ ] **Step 3: Stage only the real application files**

The repo root also has unrelated local artifacts from other tools (`.claude/`, `.impeccable/`, `.playwright-mcp/`, `graphify-out/`, five `*.png` screenshots, an unrelated spec `docs/superpowers/specs/2026-08-28-visual-overhaul-sequencing-design.md`). Stage explicit paths rather than `git add -A` so none of these end up in the new GitHub repo:

```bash
git add .gitignore package.json package-lock.json client server docs/superpowers/specs/2026-08-30-render-hosting-design.md docs/superpowers/plans/2026-08-30-render-hosting-implementation.md
```

- [ ] **Step 4: Verify the staged file list is clean**

Run: `git status --porcelain`
Expected: every line starts with `A ` (staged/added) or `M `; no `node_modules`, `dist`, `.env`, `*.png`, `graphify-out`, `.claude`, `.impeccable`, or `.playwright-mcp` entries appear. If any do, `git reset <path>` them before continuing.

- [ ] **Step 5: Commit**

```bash
git commit -m "Add application baseline (client + server)"
```

---

### Task 2: `storage.ts` file storage abstraction

**Files:**
- Modify: `server/package.json` (add dependency)
- Modify: `server/src/utils/env.ts`
- Create: `server/src/utils/storage.ts`
- Test: `server/src/utils/storage.local.test.ts`
- Test: `server/src/utils/storage.supabase.test.ts`

**Interfaces:**
- Consumes: `env.supabaseStorage: { url: string; serviceRoleKey: string; bucket: string } | null` (new), `uploadsDir: string` from `server/src/middleware/upload.middleware.ts` (existing, unchanged export).
- Produces: `saveFile(buffer: Buffer, originalName: string, mimetype: string): Promise<{ url: string; key: string }>` and `deleteFile(key: string): Promise<void>`, both exported from `server/src/utils/storage.ts`. Task 3's controllers import these two functions.

- [ ] **Step 1: Add the Supabase client dependency**

Run: `npm install @supabase/supabase-js --workspace server`
This adds `@supabase/supabase-js` to `server/package.json` `dependencies` at whatever its current published version is.

- [ ] **Step 2: Extend `env.ts` with the optional `supabaseStorage` block**

Current `server/src/utils/env.ts`:
```ts
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// SMTP is optional: if SMTP_HOST isn't set, mailer.ts falls back to logging
// reset links to the console instead of failing startup. If SMTP_HOST IS
// set, the rest of the SMTP_* vars become required so misconfiguration
// fails fast rather than silently dropping emails.
const smtpHost = process.env.SMTP_HOST;
const smtp = smtpHost
  ? {
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS"),
      from: process.env.SMTP_FROM ?? "Bachandi <no-reply@bachandi.app>",
    }
  : null;

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
  smtp,
  isProduction: process.env.NODE_ENV === "production",
};
```

Replace the whole file with:
```ts
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// SMTP is optional: if SMTP_HOST isn't set, mailer.ts falls back to logging
// reset links to the console instead of failing startup. If SMTP_HOST IS
// set, the rest of the SMTP_* vars become required so misconfiguration
// fails fast rather than silently dropping emails.
const smtpHost = process.env.SMTP_HOST;
const smtp = smtpHost
  ? {
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS"),
      from: process.env.SMTP_FROM ?? "Bachandi <no-reply@bachandi.app>",
    }
  : null;

// Supabase Storage is optional: if SUPABASE_URL isn't set, storage.ts falls
// back to writing uploads to local disk instead of failing startup. If
// SUPABASE_URL IS set, the rest of the SUPABASE_* vars become required so
// misconfiguration fails fast rather than silently dropping uploads.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseStorage = supabaseUrl
  ? {
      url: supabaseUrl,
      serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
      bucket: required("SUPABASE_STORAGE_BUCKET"),
    }
  : null;

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
  smtp,
  supabaseStorage,
  isProduction: process.env.NODE_ENV === "production",
};
```

- [ ] **Step 3: Write the failing tests for the local-disk fallback**

Create `server/src/utils/storage.local.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("./env.js", () => ({
  env: { supabaseStorage: null },
}));

const { uploadsDir } = await import("../middleware/upload.middleware.js");
const { saveFile, deleteFile } = await import("./storage.js");

describe("storage (local disk fallback)", () => {
  it("writes the buffer to uploadsDir and returns a /uploads/ url", async () => {
    const { url, key } = await saveFile(Buffer.from("hello"), "note.pdf", "application/pdf");
    expect(url).toBe(`/uploads/${key}`);
    expect(fs.readFileSync(path.join(uploadsDir, key), "utf8")).toBe("hello");
    await deleteFile(key);
  });

  it("generates distinct keys for successive uploads of the same filename", async () => {
    const a = await saveFile(Buffer.from("a"), "note.pdf", "application/pdf");
    const b = await saveFile(Buffer.from("b"), "note.pdf", "application/pdf");
    expect(a.key).not.toBe(b.key);
    await deleteFile(a.key);
    await deleteFile(b.key);
  });

  it("deleteFile removes the file from uploadsDir", async () => {
    const { key } = await saveFile(Buffer.from("bye"), "note.pdf", "application/pdf");
    const filePath = path.join(uploadsDir, key);
    expect(fs.existsSync(filePath)).toBe(true);
    await deleteFile(key);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
```

- [ ] **Step 4: Run the local-fallback test file to verify it fails**

Run: `npm run test --workspace server -- storage.local.test.ts`
Expected: FAIL — `storage.js` does not exist yet ("Cannot find module './storage.js'" or similar).

- [ ] **Step 5: Write the failing tests for the Supabase Storage backend**

Create `server/src/utils/storage.supabase.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";

const { uploadMock, getPublicUrlMock, removeMock, createClientMock } = vi.hoisted(() => {
  const uploadMock = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrlMock = vi.fn().mockReturnValue({
    data: { publicUrl: "https://supabase.test/storage/v1/object/public/uploads/key.pdf" },
  });
  const removeMock = vi.fn().mockResolvedValue({ error: null });
  const fromMock = vi.fn().mockReturnValue({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
    remove: removeMock,
  });
  const createClientMock = vi.fn().mockReturnValue({ storage: { from: fromMock } });
  return { uploadMock, getPublicUrlMock, removeMock, createClientMock };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("./env.js", () => ({
  env: {
    supabaseStorage: {
      url: "https://supabase.test",
      serviceRoleKey: "service-role-key",
      bucket: "uploads",
    },
  },
}));

const { saveFile, deleteFile } = await import("./storage.js");

describe("storage (Supabase Storage backend)", () => {
  it("uploads the buffer to Supabase Storage and returns the public URL", async () => {
    const { url, key } = await saveFile(Buffer.from("hello"), "note.pdf", "application/pdf");
    expect(createClientMock).toHaveBeenCalledWith("https://supabase.test", "service-role-key");
    expect(uploadMock).toHaveBeenCalledWith(key, expect.any(Buffer), { contentType: "application/pdf" });
    expect(url).toBe("https://supabase.test/storage/v1/object/public/uploads/key.pdf");
  });

  it("deleteFile calls remove with the given key", async () => {
    await deleteFile("some-key.pdf");
    expect(removeMock).toHaveBeenCalledWith(["some-key.pdf"]);
  });

  it("throws when the upload fails", async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: "bucket not found" } });
    await expect(saveFile(Buffer.from("x"), "note.pdf", "application/pdf")).rejects.toThrow("bucket not found");
  });
});
```

- [ ] **Step 6: Run the Supabase-backend test file to verify it fails**

Run: `npm run test --workspace server -- storage.supabase.test.ts`
Expected: FAIL — `storage.js` does not exist yet.

- [ ] **Step 7: Implement `storage.ts`**

Create `server/src/utils/storage.ts`:
```ts
import path from "node:path";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";
import { uploadsDir } from "../middleware/upload.middleware.js";

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!env.supabaseStorage) return null;
  if (!supabase) {
    supabase = createClient(env.supabaseStorage.url, env.supabaseStorage.serviceRoleKey);
  }
  return supabase;
}

function uniqueKey(originalName: string): string {
  const ext = path.extname(originalName);
  return `${Date.now()}-${randomUUID()}${ext}`;
}

/**
 * Saves an uploaded file. Falls back to local disk (server/uploads) when
 * Supabase Storage isn't configured — mirrors mailer.ts's SMTP dev fallback.
 */
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string
): Promise<{ url: string; key: string }> {
  const key = uniqueKey(originalName);
  const client = getSupabase();

  if (!client) {
    await writeFile(path.join(uploadsDir, key), buffer);
    return { url: `/uploads/${key}`, key };
  }

  const { error } = await client.storage
    .from(env.supabaseStorage!.bucket)
    .upload(key, buffer, { contentType: mimetype });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = client.storage.from(env.supabaseStorage!.bucket).getPublicUrl(key);
  return { url: data.publicUrl, key };
}

export async function deleteFile(key: string): Promise<void> {
  const client = getSupabase();

  if (!client) {
    await unlink(path.join(uploadsDir, key)).catch(() => {});
    return;
  }

  const { error } = await client.storage.from(env.supabaseStorage!.bucket).remove([key]);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}
```

- [ ] **Step 8: Run both test files to verify they pass**

Run: `npm run test --workspace server -- storage.local.test.ts storage.supabase.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 9: Run the full server test suite to check for regressions**

Run: `npm run test --workspace server`
Expected: PASS — all pre-existing tests (`password.test.ts`, `jwt.test.ts`, `teacherCode.test.ts`, `period.test.ts`, `auth.service.test.ts`) plus the 2 new files pass.

- [ ] **Step 10: Commit**

```bash
git add server/package.json server/package-lock.json server/src/utils/env.ts server/src/utils/storage.ts server/src/utils/storage.local.test.ts server/src/utils/storage.supabase.test.ts
git commit -m "Add storage.ts abstraction with local-disk/Supabase Storage fallback"
```

---

### Task 3: Wire uploads through `storage.ts`

**Files:**
- Modify: `server/src/middleware/upload.middleware.ts`
- Modify: `server/src/controllers/teacher.controller.ts`
- Modify: `server/src/controllers/pupil.controller.ts`

**Interfaces:**
- Consumes: `saveFile`, `deleteFile` from `server/src/utils/storage.ts` (Task 2).
- Produces: no new exports — `req.file` now carries `file.buffer` instead of `file.filename` throughout the app, since multer switches from disk to memory storage.

- [ ] **Step 1: Switch multer to memory storage**

Replace `server/src/middleware/upload.middleware.ts` in full:
```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type. Only PDF and image files are allowed."));
  },
});
```
`uploadsDir` is kept (and still created on startup) because `storage.ts`'s local-disk fallback still needs it — only the multer storage engine changes.

- [ ] **Step 2: Update `teacher.controller.ts`'s post handlers**

In `server/src/controllers/teacher.controller.ts`, change the top imports. Current (lines 1-6):
```ts
import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { uploadsDir } from "../middleware/upload.middleware.js";
```
Replace with:
```ts
import path from "node:path";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { saveFile, deleteFile } from "../utils/storage.js";
```
(`fs` and `uploadsDir` are no longer used anywhere in this file — both delete call sites move to `deleteFile`. `path` is kept for `path.basename`.)

Replace `createPostHandler` (current lines 288-314):
```ts
export async function createPostHandler(req: Request, res: Response) {
  const { classId, type, content, dueDate, maxGrade } = req.body;
  if (!classId || !type) {
    res.status(400).json({ error: "classId and type are required" });
    return;
  }
  const owns = await prisma.class.findFirst({ where: { id: classId, teacherId: req.user!.id } });
  if (!owns) {
    res.status(404).json({ error: "Class not found." });
    return;
  }

  const file = req.file;
  const saved = file ? await saveFile(file.buffer, file.originalname, file.mimetype) : null;
  const parsedMaxGrade =
    maxGrade !== undefined && maxGrade !== "" ? Number(maxGrade) : null;
  const post = await createPost({
    classId,
    authorId: req.user!.id,
    type,
    content: content || undefined,
    fileUrl: saved?.url,
    fileName: file ? file.originalname : undefined,
    dueDate: dueDate || undefined,
    maxGrade: parsedMaxGrade !== null && !Number.isNaN(parsedMaxGrade) ? parsedMaxGrade : null,
  });
  res.status(201).json(post);
}
```

Replace `updatePostHandler` (current lines 316-336):
```ts
export async function updatePostHandler(req: Request, res: Response) {
  const { content, dueDate, maxGrade } = req.body;
  const file = req.file;
  try {
    const previous = file ? await prisma.post.findUnique({ where: { id: req.params.id as string } }) : null;
    const saved = file ? await saveFile(file.buffer, file.originalname, file.mimetype) : null;
    const post = await updatePost(req.params.id as string, req.user!.id, {
      content: content !== undefined ? content : undefined,
      dueDate: dueDate !== undefined ? dueDate : undefined,
      fileUrl: saved?.url,
      fileName: file ? file.originalname : undefined,
      maxGrade: maxGrade !== undefined ? (maxGrade === "" ? null : Number(maxGrade)) : undefined,
    });
    if (file && previous?.fileUrl && previous.fileUrl !== post.fileUrl) {
      await deleteFile(path.basename(previous.fileUrl));
    }
    res.json(post);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}
```

Replace `deletePostHandler` (current lines 338-349):
```ts
export async function deletePostHandler(req: Request, res: Response) {
  try {
    const post = await deletePost(req.params.id as string, req.user!.id);
    if (post.fileUrl) {
      await deleteFile(path.basename(post.fileUrl));
    }
    res.status(204).send();
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}
```

- [ ] **Step 3: Update `pupil.controller.ts`'s `submitExam`**

In `server/src/controllers/pupil.controller.ts`, add to the top imports (after the existing import block, currently ending at line 12):
```ts
import { saveFile } from "../utils/storage.js";
```

Replace `submitExam` (current lines 83-104):
```ts
export async function submitExam(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "A file is required for submission." });
    return;
  }
  try {
    const saved = await saveFile(file.buffer, file.originalname, file.mimetype);
    const submission = await submitToExam({
      postId: req.params.postId as string,
      pupilId: req.user!.id,
      fileUrl: saved.url,
      fileName: file.originalname,
    });
    res.status(201).json(submission);
  } catch (err) {
    if (err instanceof PostError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}
```

- [ ] **Step 4: Type-check and run the full test suite**

Run: `npm run build --workspace server`
Expected: compiles cleanly — this catches any leftover reference to `file.filename`, `fs`, or `uploadsDir` in the two controller files.

Run: `npm run test --workspace server`
Expected: PASS, no regressions.

- [ ] **Step 5: Manual smoke test against local disk fallback**

With the dev server running (`npm run dev:server`) and no `SUPABASE_URL` set in `server/.env`, use the app in the browser (or `server/test-notifications.mjs`) to: create a class, publish a `FILE` or `EXAM` post with an attached PDF, and have a pupil submit an exam file. Confirm the uploaded file appears under `server/uploads/` and the returned `fileUrl` in the API response is `/uploads/<key>` and opens correctly in the browser.

- [ ] **Step 6: Commit**

```bash
git add server/src/middleware/upload.middleware.ts server/src/controllers/teacher.controller.ts server/src/controllers/pupil.controller.ts
git commit -m "Wire file uploads through the storage.ts abstraction"
```

---

### Task 4: Serve the built client from Express

**Files:**
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a terminal route addition, no other task depends on it.

- [ ] **Step 1: Add static + SPA fallback serving**

Current `server/src/app.ts`:
```ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./utils/env.js";
import { uploadsDir } from "./middleware/upload.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { teacherRouter } from "./routes/teacher.routes.js";
import { pupilRouter } from "./routes/pupil.routes.js";
import { parentRouter } from "./routes/parent.routes.js";

export const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/teacher", teacherRouter);
app.use("/api/pupil", pupilRouter);
app.use("/api/parent", parentRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});
```

Replace with:
```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./utils/env.js";
import { uploadsDir } from "./middleware/upload.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { teacherRouter } from "./routes/teacher.routes.js";
import { pupilRouter } from "./routes/pupil.routes.js";
import { parentRouter } from "./routes/parent.routes.js";

export const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/teacher", teacherRouter);
app.use("/api/pupil", pupilRouter);
app.use("/api/parent", parentRouter);

// Serve the built client (production only — in local dev, Vite serves the
// client on its own port and client/dist doesn't exist).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});
```

- [ ] **Step 2: Run the full test suite to check for regressions**

Run: `npm run test --workspace server`
Expected: PASS, no regressions (no existing test exercises `app.ts` directly).

- [ ] **Step 3: Manual smoke test of the production static-serving path**

```bash
npm run build --workspace client
npm run build --workspace server
node server/dist/server.js
```
Then in a browser, visit `http://localhost:4000/` — expect the React app's login page to load. Visit `http://localhost:4000/teacher/overview` directly (hard refresh / typed URL) — expect the SPA to load (not a 404), proving the catch-all fallback works for client-side routes. Visit `http://localhost:4000/api/health` — expect `{"ok":true}`. Stop the process (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit**

```bash
git add server/src/app.ts
git commit -m "Serve the built client from Express with SPA fallback"
```

---

### Task 5: Prisma provider swap (SQLite → Postgres) + fresh migration

This task requires the user's real Supabase Postgres connection string. It cannot be completed without it — pause and ask the user for it before Step 3 if it hasn't been provided yet.

**Files:**
- Modify: `server/prisma/schema.prisma`
- Replace: `server/prisma/migrations/` (delete the 11 SQLite-era migration folders, generate one fresh `init` migration)

**Interfaces:** None (schema/infra task — no TypeScript signatures change; Prisma Client's generated types are unaffected by the provider swap since the schema's models are unchanged).

- [ ] **Step 1: Change the datasource provider**

In `server/prisma/schema.prisma`, change:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```
to:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 2: Remove the SQLite-era migrations**

```bash
rm -rf server/prisma/migrations
```
These 11 migrations were generated for SQLite's SQL dialect and are not guaranteed to replay on Postgres. There is no production data to preserve across a migration history, per the spec's "start fresh" decision.

- [ ] **Step 3: Obtain the Supabase Postgres connection string**

Ask the user for their Supabase project's connection string (Project Settings → Database → Connection string, "URI" format, using the pooler connection on port 6543 with `?pgbouncer=true` for the app's runtime `DATABASE_URL`, per Supabase's standard guidance for serverless/pooled connections — confirm the exact string with the user rather than guessing).

- [ ] **Step 4: Point local `.env` at Supabase and generate the fresh migration**

Temporarily set `DATABASE_URL` in `server/.env` to the connection string from Step 3, then run:
```bash
npm run prisma:migrate --workspace server -- --name init
```
(`prisma:migrate` is `prisma migrate dev`, which creates `server/prisma/migrations/<timestamp>_init/migration.sql` from the current schema and applies it to the real Supabase database.)

- [ ] **Step 5: Regenerate the Prisma Client and seed the database**

```bash
npm run prisma:generate --workspace server
npm run prisma:seed --workspace server
```
Expected: the seed script creates the placeholder admin account (`admin@bachandi.app` / `admin123`) in the Supabase Postgres database.

- [ ] **Step 6: Smoke-test against real Supabase Postgres**

```bash
npm run dev:server
```
Log in as the admin via the browser or `curl` (`POST /api/auth/login` with the admin credentials) and confirm a 200 response — this proves the app works end-to-end against the real Postgres database before touching Render or Supabase Storage.

- [ ] **Step 7: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "Switch Prisma datasource from SQLite to Postgres with fresh init migration"
```

---

### Task 6: Render deployment config

**Files:**
- Modify: `server/package.json`
- Create: `render.yaml`

**Interfaces:** None.

- [ ] **Step 1: Add the `prisma:migrate:deploy` script**

In `server/package.json`, add a new script alongside the existing `prisma:migrate`:
```json
"prisma:migrate:deploy": "prisma migrate deploy",
```
Full `scripts` block after the change:
```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/server.js",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:migrate:deploy": "prisma migrate deploy",
  "prisma:seed": "tsx prisma/seed.ts",
  "test": "vitest run"
},
```
Unlike `prisma migrate dev` (interactive, dev-only), `prisma migrate deploy` only applies pending migrations non-interactively — safe to run on every Render deploy.

- [ ] **Step 2: Create the Render Blueprint**

Create `render.yaml` at the repo root:
```yaml
services:
  - type: web
    name: edumanage
    env: node
    plan: free
    buildCommand: npm ci && npm run build && npm run prisma:generate --workspace server && npm run prisma:migrate:deploy --workspace server
    startCommand: node server/dist/server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: SUPABASE_STORAGE_BUCKET
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: CLIENT_ORIGIN
        sync: false
      - key: ADMIN_EMAIL
        sync: false
      - key: ADMIN_PASSWORD
        sync: false
      - key: SMTP_HOST
        sync: false
      - key: SMTP_PORT
        sync: false
      - key: SMTP_USER
        sync: false
      - key: SMTP_PASS
        sync: false
      - key: SMTP_FROM
        sync: false
```
`sync: false` means Render will prompt for each value in its dashboard rather than reading it from this file — no secret is committed.

- [ ] **Step 3: Verify the build command locally**

```bash
npm ci && npm run build && npm run prisma:generate --workspace server && npm run prisma:migrate:deploy --workspace server
```
Expected: completes with no errors (this is the exact command Render will run). `prisma:migrate:deploy` should report "No pending migrations to apply" since Task 5 already applied `init` to the same database.

- [ ] **Step 4: Commit**

```bash
git add server/package.json render.yaml
git commit -m "Add Render Blueprint and prisma migrate deploy script"
```

---

### Task 7: Push to GitHub, connect Render, production smoke test

**Files:** None — coordination/deployment task.

**Interfaces:** None.

- [ ] **Step 1: Push to GitHub**

Ask the user for the URL of the empty GitHub repo they created (per the spec's decision that the user creates it). Then:
```bash
git remote add origin <repo-url>
git push -u origin main
```

- [ ] **Step 2: Connect the repo in Render**

In the Render dashboard, create a new Blueprint from the pushed GitHub repo (Render auto-detects `render.yaml` at the root). Render will prompt for each `sync: false` env var from Task 6's `render.yaml` — paste in the real values (Supabase connection string and keys, JWT secret, admin credentials, Resend SMTP credentials from `server/.env`, and `CLIENT_ORIGIN` set to the Render-assigned `https://edumanage.onrender.com` URL once known).

- [ ] **Step 3: Trigger the first deploy and watch the build logs**

Trigger a manual deploy from the Render dashboard. Watch the build logs for the `npm ci && npm run build && ...` sequence from Task 6 completing successfully, then the service reporting as "live".

- [ ] **Step 4: Production smoke test**

Repeat the same end-to-end flow already verified locally against Supabase in Task 5, this time against the live Render URL: register a teacher → verify email (via the real Resend-delivered email, not the dev `devVerifyUrl` shortcut) → admin login and approve the teacher → teacher creates a class → pupil registers and is assigned → parent registers, links, and gets approved → mark an absence and confirm the parent receives both the in-app notification and the Resend email alert.

- [ ] **Step 5: Report completion**

Confirm with the user that the production URL is live and the smoke test passed. No commit for this task — it's deployment activity, not a code change.

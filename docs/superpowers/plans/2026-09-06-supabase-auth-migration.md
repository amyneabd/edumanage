# Supabase Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bachandi's custom bcrypt + JWT-cookie auth (with Prisma-backed email-verification and password-reset tokens) with Supabase Auth, end to end across server and client.

**Architecture:** The server keeps its Express/Prisma structure but delegates credential storage, session issuance, email verification, and password reset to Supabase Auth via `@supabase/supabase-js`. Two httpOnly cookies (`sb-access-token`, `sb-refresh-token`) replace the single custom `token` cookie. `User.supabaseId` links a Prisma `User` row to its Supabase Auth identity. A `createAuthClient()` factory produces call-scoped Supabase clients for any flow that establishes a session and then mutates or ends it (password reset completion, change password, logout), avoiding cross-request session clobbering on a shared client; a module-level `supabaseAuth` singleton is used everywhere else since only return values are consumed. The client swaps `token`/`emailVerified` semantics for `token_hash`/session-implies-confirmed semantics, and gains a `code` field on API errors for branching without message-parsing.

**Tech Stack:** Node.js/Express/Prisma/PostgreSQL server, `@supabase/supabase-js` (already a dependency at `^2.112.4`), React/TanStack Query/React Router/Zod client, Vitest for both.

**Spec:** `docs/superpowers/specs/2026-09-06-supabase-auth-migration-design.md`

## Global Constraints

- Dev/test `User` data is intentionally wiped during migration (`prisma migrate reset --force` then `prisma migrate dev --name supabase_auth`) — no backfill of existing rows.
- `server/src/services/auth.service.test.ts` and `server/src/middleware/auth.middleware.test.ts` MUST mock the Supabase auth client — never hit a real Supabase project.
- `server/src/services/{vacation,attendance,payment,swap}.service.test.ts` are integration tests that hit a real dev Postgres DB via Prisma directly (not mocked) and must keep doing so — only their `User` row creation needs to change (unique `supabaseId` per row instead of a shared `passwordHash`).
- No external contract (route paths, request/response JSON shapes beyond the additive `code` field, cookie names as seen by the browser) changes except where the spec explicitly calls for it (`token` → `token_hash`, `/auth/resend-verification` becoming unauthenticated).
- A full manual end-to-end pass (register → real email → verify → login → reset) against a live, correctly configured Supabase project is required before considering the migration done — this cannot be automated by an agent and is the final task.

---

## Task 1: Prisma schema migration

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `User.supabaseId: string` (unique) consumed by every later server task that creates or looks up a `User`.

- [ ] **Step 1: Edit the `User` model**

In `server/prisma/schema.prisma`, on the `User` model:
- Remove the `passwordHash` field.
- Remove the `emailVerifiedAt` field.
- Remove the `passwordResetTokens` relation field.
- Remove the `emailVerificationTokens` relation field.
- Add `supabaseId String @unique` (place it near `email`).

- [ ] **Step 2: Delete the token models**

Delete the `PasswordResetToken` and `EmailVerificationToken` models entirely from `server/prisma/schema.prisma` (currently around lines 94-116), including any `@@index`/`@@map` blocks that belong only to them.

- [ ] **Step 3: Reset and migrate the dev database**

Run:
```bash
cd server && npx prisma migrate reset --force
```
Expected: dev DB dropped and recreated, existing migrations reapplied minus the two models (this will fail until Step 4 creates the new migration — if `reset` complains about a dirty migration history, proceed to Step 4 first, then re-run `reset`).

```bash
cd server && npx prisma migrate dev --name supabase_auth
```
Expected: a new migration directory is generated under `server/prisma/migrations/`, and it applies cleanly, ending with "Your database is now in sync with your schema."

- [ ] **Step 4: Regenerate the Prisma client**

Run: `cd server && npx prisma generate`
Expected: completes without error; `@prisma/client` types now expose `User.supabaseId` and no longer expose `passwordHash`/`emailVerifiedAt`/`PasswordResetToken`/`EmailVerificationToken`.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "chore(db): replace password/verification-token fields with supabaseId"
```

---

## Task 2: Supabase client utilities

**Files:**
- Create: `server/src/utils/supabaseAuth.ts`
- Create: `server/src/utils/supabaseAdmin.ts`

**Interfaces:**
- Consumes: `env.supabaseUrl`, `env.supabaseAnonKey`, `env.supabaseServiceRoleKey` (produced by Task 4 — for this task, reference `env.ts`'s current shape; Task 4 keeps these three field names).
- Produces: `createAuthClient(): SupabaseClient`, `supabaseAuth: SupabaseClient` (from `supabaseAuth.ts`), `supabaseAdmin: SupabaseClient` (from `supabaseAdmin.ts`) — consumed by auth.service.ts (Task 5), auth.middleware.ts (Task 6), and prisma/seed.ts (Task 10).

- [ ] **Step 1: Create `supabaseAuth.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export function createAuthClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const supabaseAuth = createAuthClient();
```

- [ ] **Step 2: Create `supabaseAdmin.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

- [ ] **Step 3: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: errors only about `env.supabaseUrl`/`env.supabaseAnonKey`/`env.supabaseServiceRoleKey` not existing yet (Task 4 fixes this) — no errors within these two new files themselves regarding syntax or imports.

- [ ] **Step 4: Commit**

```bash
git add server/src/utils/supabaseAuth.ts server/src/utils/supabaseAdmin.ts
git commit -m "feat(auth): add Supabase auth/admin client utilities"
```

---

## Task 3: Auth cookie utilities

**Files:**
- Create: `server/src/utils/authCookies.ts`

**Interfaces:**
- Consumes: `Session` type from `@supabase/supabase-js`.
- Produces: `setAuthCookies(res, session)`, `clearAuthCookies(res)`, `getAuthCookies(req)` returning `{ accessToken?: string; refreshToken?: string }` — consumed by auth.middleware.ts (Task 6) and auth.controller.ts (Task 7).

- [ ] **Step 1: Create the file**

```ts
import type { Response } from "express";
import type { Session } from "@supabase/supabase-js";

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export function setAuthCookies(
  res: Response,
  session: Pick<Session, "access_token" | "refresh_token" | "expires_in">
): void {
  res.cookie(ACCESS_COOKIE, session.access_token, {
    ...baseCookieOptions,
    maxAge: session.expires_in * 1000,
  });
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    ...baseCookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions);
}

export function getAuthCookies(req: {
  cookies?: Record<string, string>;
}): { accessToken?: string; refreshToken?: string } {
  return {
    accessToken: req.cookies?.[ACCESS_COOKIE],
    refreshToken: req.cookies?.[REFRESH_COOKIE],
  };
}
```

- [ ] **Step 2: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no new errors originating from `authCookies.ts`.

- [ ] **Step 3: Commit**

```bash
git add server/src/utils/authCookies.ts
git commit -m "feat(auth): add httpOnly cookie helpers for Supabase sessions"
```

---

## Task 4: `env.ts` rewrite

**Files:**
- Modify: `server/src/utils/env.ts`

**Interfaces:**
- Produces: `env.supabaseUrl: string`, `env.supabaseAnonKey: string`, `env.supabaseServiceRoleKey: string`, `env.supabaseStorage: {url, serviceRoleKey, bucket} | null` (unchanged shape), `env.resend: {apiKey, from} | null` (unchanged). Removes: `env.jwtSecret`, `env.requireEmailVerification`.
- Consumes: nothing new.

- [ ] **Step 1: Rewrite the file**

```ts
import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey
  ? { apiKey: resendApiKey, from: process.env.MAIL_FROM ?? "Bachandi <onboarding@resend.dev>" }
  : null;

const supabaseUrl = required("SUPABASE_URL");
const supabaseAnonKey = required("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");

const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const supabaseStorage = supabaseStorageBucket
  ? { url: supabaseUrl, serviceRoleKey: supabaseServiceRoleKey, bucket: supabaseStorageBucket }
  : null;

export const env = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
  resend,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseStorage,
  isProduction: process.env.NODE_ENV === "production",
};
```

- [ ] **Step 2: Grep for now-removed fields**

Run: `cd server && grep -rn "jwtSecret\|requireEmailVerification" src`
Expected: no matches (Task 6's rewrite removes the one middleware usage; if this greps a stale match before Task 6 runs, that's expected — re-run after Task 6).

- [ ] **Step 3: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: the two client-utility files from Task 2 now compile cleanly against `env`; remaining errors should only be in files this plan hasn't touched yet (auth.service.ts, auth.middleware.ts, storage.ts should show zero new errors since `env.supabaseStorage`'s shape is unchanged).

- [ ] **Step 4: Commit**

```bash
git add server/src/utils/env.ts
git commit -m "feat(env): make Supabase auth vars required, drop JWT/email-verification flags"
```

---

## Task 5: `auth.service.ts` rewrite (TDD)

**Files:**
- Modify: `server/src/services/auth.service.ts`
- Modify: `server/src/services/auth.service.test.ts`

**Interfaces:**
- Consumes: `supabaseAuth`, `createAuthClient` (Task 2), `env.clientOrigin` (Task 4), `prisma` (existing util), `generateTeacherCode`/`generateParentCode` (existing), `createNotification` (existing `notification.service.ts`).
- Produces: `AuthError` (class, `message, status=400, code?`), `registerTeacher`, `registerPupil`, `registerParent`, `login(email, password): Promise<LoginResult>` where `LoginResult = {user: User; session: Session}`, `resendVerification(email)`, `verifyEmail(tokenHash): Promise<VerifiedSession>` where `VerifiedSession = {user: User; session: Session}`, `requestPasswordReset(email)`, `completePasswordReset(tokenHash, newPassword): Promise<Session>`, `logout(accessToken, refreshToken): Promise<void>`, `changePassword(userId, currentPassword, newPassword): Promise<void>` — all consumed by auth.controller.ts (Task 7).

- [ ] **Step 1: Write the mocked test file**

Replace `server/src/services/auth.service.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { signUpMock, signInWithPasswordMock, resendMock, verifyOtpMock, resetPasswordForEmailMock, findUniqueUserMock, createUserMock, findUniqueTeacherProfileMock, findUniqueParentCodeMock, createNotificationMock, scopedSignInMock, scopedUpdateUserMock, scopedVerifyOtpMock, scopedSetSessionMock, scopedSignOutMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  resendMock: vi.fn(),
  verifyOtpMock: vi.fn(),
  resetPasswordForEmailMock: vi.fn(),
  findUniqueUserMock: vi.fn(),
  createUserMock: vi.fn(),
  findUniqueTeacherProfileMock: vi.fn(),
  findUniqueParentCodeMock: vi.fn(),
  createNotificationMock: vi.fn(),
  scopedSignInMock: vi.fn(),
  scopedUpdateUserMock: vi.fn(),
  scopedVerifyOtpMock: vi.fn(),
  scopedSetSessionMock: vi.fn(),
  scopedSignOutMock: vi.fn(),
}));

vi.mock("../utils/supabaseAuth.js", () => ({
  supabaseAuth: {
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
      resend: resendMock,
      verifyOtp: verifyOtpMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
    },
  },
  createAuthClient: () => ({
    auth: {
      signInWithPassword: scopedSignInMock,
      updateUser: scopedUpdateUserMock,
      verifyOtp: scopedVerifyOtpMock,
      setSession: scopedSetSessionMock,
      signOut: scopedSignOutMock,
    },
  }),
}));

vi.mock("../utils/prisma.js", () => ({
  prisma: {
    user: { findUnique: findUniqueUserMock, create: createUserMock },
    teacherProfile: { findUnique: findUniqueTeacherProfileMock },
    pupilProfile: { findUnique: findUniqueParentCodeMock },
  },
}));

vi.mock("./notification.service.js", () => ({
  createNotification: createNotificationMock,
}));

import {
  AuthError,
  registerTeacher,
  login,
  verifyEmail,
  requestPasswordReset,
  completePasswordReset,
  changePassword,
  logout,
} from "./auth.service.js";

const DB_USER = {
  id: "user-1",
  email: "teacher@example.com",
  supabaseId: "sb-user-1",
  name: "Teacher One",
  role: "TEACHER",
  status: "PENDING",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerTeacher", () => {
  it("creates a Supabase user and a Prisma user on happy path", async () => {
    findUniqueUserMock.mockResolvedValueOnce(null);
    signUpMock.mockResolvedValueOnce({ data: { user: { id: "sb-user-1" } }, error: null });
    findUniqueTeacherProfileMock.mockResolvedValueOnce(null);
    createUserMock.mockResolvedValueOnce({ ...DB_USER, teacherProfile: { teacherCode: "ABCD" } });

    const user = await registerTeacher({ email: "teacher@example.com", password: "secret1", name: "Teacher One" });

    expect(signUpMock).toHaveBeenCalledWith({ email: "teacher@example.com", password: "secret1" });
    expect(createUserMock).toHaveBeenCalled();
    expect(user.email).toBe("teacher@example.com");
  });

  it("rejects when a Prisma user with that email already exists", async () => {
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);

    await expect(
      registerTeacher({ email: "teacher@example.com", password: "secret1", name: "Teacher One" })
    ).rejects.toMatchObject({ status: 409 });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("maps a Supabase 'already registered' error to 409", async () => {
    findUniqueUserMock.mockResolvedValueOnce(null);
    signUpMock.mockResolvedValueOnce({ data: null, error: { status: 422, message: "User already registered" } });

    await expect(
      registerTeacher({ email: "teacher@example.com", password: "secret1", name: "Teacher One" })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("login", () => {
  it("returns the Prisma user and Supabase session on success", async () => {
    const session = { access_token: "at", refresh_token: "rt", expires_in: 3600, user: { id: "sb-user-1" } };
    signInWithPasswordMock.mockResolvedValueOnce({ data: { user: { id: "sb-user-1" }, session }, error: null });
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);

    const result = await login("teacher@example.com", "secret1");

    expect(result.user).toEqual(DB_USER);
    expect(result.session).toEqual(session);
  });

  it("throws 401 on wrong credentials", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ data: null, error: { message: "Invalid login credentials" } });

    await expect(login("teacher@example.com", "wrong")).rejects.toMatchObject({ status: 401 });
  });

  it("throws 403 with code EMAIL_NOT_CONFIRMED when email isn't confirmed", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ data: null, error: { message: "Email not confirmed" } });

    await expect(login("teacher@example.com", "secret1")).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_CONFIRMED",
    });
  });

  it("throws 401 when Supabase succeeds but no matching Prisma user exists", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: { id: "sb-orphan" }, session: { access_token: "at", refresh_token: "rt", expires_in: 3600 } },
      error: null,
    });
    findUniqueUserMock.mockResolvedValueOnce(null);

    await expect(login("teacher@example.com", "secret1")).rejects.toMatchObject({ status: 401 });
  });
});

describe("verifyEmail", () => {
  it("returns user and session on success", async () => {
    const session = { access_token: "at", refresh_token: "rt", expires_in: 3600, user: { id: "sb-user-1" } };
    verifyOtpMock.mockResolvedValueOnce({ data: { session }, error: null });
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);

    const result = await verifyEmail("hash-1");

    expect(result.user).toEqual(DB_USER);
    expect(result.session).toEqual(session);
  });

  it("throws 400 on invalid/expired token", async () => {
    verifyOtpMock.mockResolvedValueOnce({ data: { session: null }, error: { message: "invalid" } });

    await expect(verifyEmail("bad-hash")).rejects.toMatchObject({ status: 400 });
  });
});

describe("requestPasswordReset", () => {
  it("calls resetPasswordForEmail with a redirect to the client origin", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: null });

    await requestPasswordReset("teacher@example.com");

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      "teacher@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") })
    );
  });
});

describe("completePasswordReset", () => {
  it("verifies the recovery token then updates the password on a scoped client", async () => {
    const session = { access_token: "at", refresh_token: "rt", expires_in: 3600 };
    scopedVerifyOtpMock.mockResolvedValueOnce({ data: { session }, error: null });
    scopedUpdateUserMock.mockResolvedValueOnce({ error: null });

    const result = await completePasswordReset("hash-1", "newpass1");

    expect(scopedVerifyOtpMock).toHaveBeenCalledWith({ token_hash: "hash-1", type: "recovery" });
    expect(scopedUpdateUserMock).toHaveBeenCalledWith({ password: "newpass1" });
    expect(result).toEqual(session);
  });

  it("throws 400 when the recovery token is invalid", async () => {
    scopedVerifyOtpMock.mockResolvedValueOnce({ data: { session: null }, error: { message: "invalid" } });

    await expect(completePasswordReset("bad-hash", "newpass1")).rejects.toMatchObject({ status: 400 });
    expect(scopedUpdateUserMock).not.toHaveBeenCalled();
  });

  it("throws 400 when updateUser fails", async () => {
    scopedVerifyOtpMock.mockResolvedValueOnce({ data: { session: { access_token: "at" } }, error: null });
    scopedUpdateUserMock.mockResolvedValueOnce({ error: { message: "weak password" } });

    await expect(completePasswordReset("hash-1", "weak")).rejects.toMatchObject({ status: 400 });
  });
});

describe("changePassword", () => {
  it("re-authenticates with the current password then updates it", async () => {
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);
    scopedSignInMock.mockResolvedValueOnce({ data: {}, error: null });
    scopedUpdateUserMock.mockResolvedValueOnce({ error: null });

    await changePassword("user-1", "currentpass", "newpass1");

    expect(scopedSignInMock).toHaveBeenCalledWith({ email: DB_USER.email, password: "currentpass" });
    expect(scopedUpdateUserMock).toHaveBeenCalledWith({ password: "newpass1" });
  });

  it("throws 400 when the current password is wrong", async () => {
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);
    scopedSignInMock.mockResolvedValueOnce({ data: null, error: { message: "invalid" } });

    await expect(changePassword("user-1", "wrong", "newpass1")).rejects.toMatchObject({ status: 400 });
    expect(scopedUpdateUserMock).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("sets the session then signs out on a scoped client", async () => {
    scopedSetSessionMock.mockResolvedValueOnce({ error: null });
    scopedSignOutMock.mockResolvedValueOnce({ error: null });

    await logout("at", "rt");

    expect(scopedSetSessionMock).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
    expect(scopedSignOutMock).toHaveBeenCalled();
  });

  it("is a no-op when tokens are missing", async () => {
    await logout(undefined, undefined);

    expect(scopedSetSessionMock).not.toHaveBeenCalled();
    expect(scopedSignOutMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test file, confirm it fails**

Run: `cd server && npx vitest run src/services/auth.service.test.ts`
Expected: FAIL — current `auth.service.ts` doesn't export these functions with these signatures yet.

- [ ] **Step 3: Rewrite `auth.service.ts`**

```ts
import { prisma } from "../utils/prisma.js";
import { supabaseAuth, createAuthClient } from "../utils/supabaseAuth.js";
import { generateTeacherCode, generateParentCode } from "../utils/teacherCode.js";
import { createNotification } from "./notification.service.js";
import { env } from "../utils/env.js";
import type { ClassType, User } from "@prisma/client";
import type { Session } from "@supabase/supabase-js";

const CLASS_TYPE_LABELS_LOWER: Record<ClassType, string> = {
  SCIENCE: "sciences",
  MATH: "mathématiques",
  INFO: "informatique",
  ECO: "économie",
};

export class AuthError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
  }
}

async function createSupabaseUser(email: string, password: string): Promise<string> {
  const { data, error } = await supabaseAuth.auth.signUp({ email, password });
  if (error) {
    if (error.status === 422 || /already registered/i.test(error.message)) {
      throw new AuthError("Un compte avec cet e-mail existe déjà.", 409);
    }
    throw new AuthError(error.message, 400);
  }
  return data.user!.id;
}

export async function registerTeacher(input: { email: string; password: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("Un compte avec cet e-mail existe déjà.", 409);
  const supabaseId = await createSupabaseUser(input.email, input.password);
  let teacherCode = generateTeacherCode();
  while (await prisma.teacherProfile.findUnique({ where: { teacherCode } })) {
    teacherCode = generateTeacherCode();
  }
  const user = await prisma.user.create({
    data: {
      email: input.email,
      supabaseId,
      name: input.name,
      role: "TEACHER",
      status: "PENDING",
      teacherProfile: { create: { teacherCode } },
    },
    include: { teacherProfile: true },
  });
  return user;
}

export async function registerPupil(input: {
  email: string;
  password: string;
  name: string;
  requestedType: ClassType;
  teacherCode: string;
  phone: string;
  parentPhone: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("Un compte avec cet e-mail existe déjà.", 409);
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { teacherCode: input.teacherCode.toUpperCase() },
    include: { user: true },
  });
  if (!teacherProfile || teacherProfile.user.status !== "ACTIVE") {
    throw new AuthError("Aucun enseignant actif trouvé avec cet identifiant enseignant.", 404);
  }
  const supabaseId = await createSupabaseUser(input.email, input.password);
  let parentCode = generateParentCode();
  while (await prisma.pupilProfile.findUnique({ where: { parentCode } })) {
    parentCode = generateParentCode();
  }
  const user = await prisma.user.create({
    data: {
      email: input.email,
      supabaseId,
      name: input.name,
      role: "PUPIL",
      status: "PENDING",
      pupilProfile: {
        create: {
          requestedType: input.requestedType,
          teacherId: teacherProfile.userId,
          parentCode,
          phone: input.phone,
          parentPhone: input.parentPhone,
        },
      },
    },
    include: { pupilProfile: true },
  });
  await createNotification({
    teacherId: teacherProfile.userId,
    type: "PUPIL_REQUEST",
    title: "Nouvelle demande d'élève",
    body: `${user.name} demande à rejoindre vos classes de ${CLASS_TYPE_LABELS_LOWER[input.requestedType]}.`,
    link: "/teacher/classes",
    dedupeKey: `pupil-request:${user.id}`,
  });
  return user;
}

export async function registerParent(input: { email: string; password: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("Un compte avec cet e-mail existe déjà.", 409);
  const supabaseId = await createSupabaseUser(input.email, input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      supabaseId,
      name: input.name,
      role: "PARENT",
      status: "ACTIVE",
      parentProfile: { create: {} },
    },
    include: { parentProfile: true },
  });
  return user;
}

export interface LoginResult {
  user: User;
  session: Session;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      throw new AuthError("Veuillez vérifier votre e-mail avant de vous connecter.", 403, "EMAIL_NOT_CONFIRMED");
    }
    throw new AuthError("E-mail ou mot de passe invalide.", 401);
  }
  const user = await prisma.user.findUnique({ where: { supabaseId: data.user.id } });
  if (!user) throw new AuthError("E-mail ou mot de passe invalide.", 401);
  return { user, session: data.session };
}

export async function resendVerification(email: string): Promise<void> {
  const { error } = await supabaseAuth.auth.resend({ type: "signup", email });
  if (error) throw new AuthError(error.message, 400);
}

export interface VerifiedSession {
  user: User;
  session: Session;
}

export async function verifyEmail(tokenHash: string): Promise<VerifiedSession> {
  const { data, error } = await supabaseAuth.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });
  if (error || !data.session) throw new AuthError("Ce lien de vérification est invalide ou a expiré.", 400);
  const user = await prisma.user.findUnique({ where: { supabaseId: data.session.user.id } });
  if (!user) throw new AuthError("Utilisateur introuvable.", 404);
  return { user, session: data.session };
}

export async function requestPasswordReset(email: string): Promise<void> {
  await supabaseAuth.auth.resetPasswordForEmail(email, { redirectTo: `${env.clientOrigin}/reset-password` });
}

// Uses a freshly-constructed client (not the shared singleton) so a
// concurrent request's session can't get mixed up with this one between
// verifyOtp and updateUser.
export async function completePasswordReset(tokenHash: string, newPassword: string): Promise<Session> {
  const scoped = createAuthClient();
  const { data, error } = await scoped.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error || !data.session) throw new AuthError("Ce lien de réinitialisation est invalide ou a expiré.", 400);
  const { error: updateError } = await scoped.auth.updateUser({ password: newPassword });
  if (updateError) throw new AuthError(updateError.message, 400);
  return data.session;
}

export async function logout(accessToken: string | undefined, refreshToken: string | undefined): Promise<void> {
  if (!accessToken || !refreshToken) return;
  const scoped = createAuthClient();
  await scoped.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  await scoped.auth.signOut();
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError("Utilisateur introuvable.", 404);
  const scoped = createAuthClient();
  const { error: signInError } = await scoped.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (signInError) throw new AuthError("Le mot de passe actuel est incorrect.", 400);
  const { error } = await scoped.auth.updateUser({ password: newPassword });
  if (error) throw new AuthError(error.message, 400);
}
```

- [ ] **Step 4: Run the test file, confirm it passes**

Run: `cd server && npx vitest run src/services/auth.service.test.ts`
Expected: PASS — all suites green.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/auth.service.ts server/src/services/auth.service.test.ts
git commit -m "feat(auth): rewrite auth.service.ts on Supabase Auth with mocked tests"
```

---

## Task 6: `auth.middleware.ts` rewrite (TDD)

**Files:**
- Modify: `server/src/middleware/auth.middleware.ts`
- Modify: `server/src/middleware/auth.middleware.test.ts`

**Interfaces:**
- Consumes: `supabaseAuth` (Task 2), `getAuthCookies`/`setAuthCookies`/`clearAuthCookies` (Task 3), `prisma`.
- Produces: `AuthedUser {id, role, status, name, email}`, `requireAuth`, `requireRole(...roles)`, `requireActive` — consumed by auth.routes.ts and teacher/pupil/parent routes (Task 7, Task 8). `requireEmailVerified` is removed with no replacement.

- [ ] **Step 1: Write the mocked test file**

Replace `server/src/middleware/auth.middleware.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { getUserMock, refreshSessionMock, findUniqueMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  refreshSessionMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock("../utils/supabaseAuth.js", () => ({
  supabaseAuth: { auth: { getUser: getUserMock, refreshSession: refreshSessionMock } },
}));

vi.mock("../utils/prisma.js", () => ({
  prisma: { user: { findUnique: findUniqueMock } },
}));

import { requireAuth, requireActive, requireRole } from "./auth.middleware.js";

const DB_USER = {
  id: "user-1",
  email: "teacher@example.com",
  name: "Teacher One",
  role: "TEACHER",
  status: "ACTIVE",
};

function makeReq(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

function makeRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAuth", () => {
  it("returns 401 when there is no access-token cookie", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("authenticates and calls next when the access token is valid", async () => {
    const req = makeReq({ "sb-access-token": "at" });
    const res = makeRes();
    const next = vi.fn();
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "sb-user-1" } }, error: null });
    findUniqueMock.mockResolvedValueOnce(DB_USER);

    await requireAuth(req, res, next);

    expect(req.user).toEqual(DB_USER);
    expect(next).toHaveBeenCalled();
  });

  it("refreshes the session when the access token is expired but the refresh token is valid", async () => {
    const req = makeReq({ "sb-access-token": "expired", "sb-refresh-token": "rt" });
    const res = makeRes();
    const next = vi.fn();
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } });
    refreshSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: "new-at", refresh_token: "new-rt", expires_in: 3600, user: { id: "sb-user-1" } } },
      error: null,
    });
    findUniqueMock.mockResolvedValueOnce(DB_USER);

    await requireAuth(req, res, next);

    expect(res.cookie).toHaveBeenCalled();
    expect(req.user).toEqual(DB_USER);
    expect(next).toHaveBeenCalled();
  });

  it("clears cookies and returns 401 when both tokens are invalid", async () => {
    const req = makeReq({ "sb-access-token": "expired", "sb-refresh-token": "expired" });
    const res = makeRes();
    const next = vi.fn();
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } });
    refreshSessionMock.mockResolvedValueOnce({ data: { session: null }, error: { message: "invalid" } });

    await requireAuth(req, res, next);

    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is valid but no matching Prisma user exists", async () => {
    const req = makeReq({ "sb-access-token": "at" });
    const res = makeRes();
    const next = vi.fn();
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "sb-orphan" } }, error: null });
    findUniqueMock.mockResolvedValueOnce(null);

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  it("calls next when the user's role is allowed", () => {
    const req = { user: DB_USER } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireRole("TEACHER")(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when the user's role is not allowed", () => {
    const req = { user: DB_USER } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireRole("PARENT")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireActive", () => {
  it("calls next when the user's status is ACTIVE", () => {
    const req = { user: DB_USER } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireActive(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when the user's status is not ACTIVE", () => {
    const req = { user: { ...DB_USER, status: "PENDING" } } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireActive(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test file, confirm it fails**

Run: `cd server && npx vitest run src/middleware/auth.middleware.test.ts`
Expected: FAIL — current middleware doesn't export this shape.

- [ ] **Step 3: Rewrite `auth.middleware.ts`**

```ts
import type { NextFunction, Request, Response } from "express";
import { supabaseAuth } from "../utils/supabaseAuth.js";
import { prisma } from "../utils/prisma.js";
import { getAuthCookies, setAuthCookies, clearAuthCookies } from "../utils/authCookies.js";
import type { Role, UserStatus } from "@prisma/client";

export interface AuthedUser {
  id: string;
  role: Role;
  status: UserStatus;
  name: string;
  email: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

async function loadAuthedUser(supabaseUserId: string): Promise<AuthedUser | null> {
  const user = await prisma.user.findUnique({ where: { supabaseId: supabaseUserId } });
  if (!user) return null;
  return { id: user.id, role: user.role, status: user.status, name: user.name, email: user.email };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { accessToken, refreshToken } = getAuthCookies(req);
  if (!accessToken) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { data, error } = await supabaseAuth.auth.getUser(accessToken);
  if (!error && data.user) {
    const authedUser = await loadAuthedUser(data.user.id);
    if (!authedUser) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }
    req.user = authedUser;
    next();
    return;
  }

  if (!refreshToken) {
    res.status(401).json({ error: "Session invalide ou expirée" });
    return;
  }

  const { data: refreshed, error: refreshError } = await supabaseAuth.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (refreshError || !refreshed.session) {
    clearAuthCookies(res);
    res.status(401).json({ error: "Session invalide ou expirée" });
    return;
  }

  const authedUser = await loadAuthedUser(refreshed.session.user.id);
  if (!authedUser) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  setAuthCookies(res, refreshed.session);
  req.user = authedUser;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Accès interdit" });
      return;
    }
    next();
  };
}

export function requireActive(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.status !== "ACTIVE") {
    res.status(403).json({ error: "Le compte n'est pas actif", status: req.user?.status });
    return;
  }
  next();
}
```

- [ ] **Step 4: Run the test file, confirm it passes**

Run: `cd server && npx vitest run src/middleware/auth.middleware.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/auth.middleware.ts server/src/middleware/auth.middleware.test.ts
git commit -m "feat(auth): rewrite auth.middleware.ts on Supabase sessions, drop requireEmailVerified"
```

---

## Task 7: `auth.controller.ts` + `auth.routes.ts`

**Files:**
- Modify: `server/src/controllers/auth.controller.ts`
- Modify: `server/src/routes/auth.routes.ts`

**Interfaces:**
- Consumes: everything produced by Task 5 (`AuthError`, `login`, `changePassword`, `completePasswordReset`, `logout as logoutService`, `registerParent`, `registerPupil`, `registerTeacher`, `requestPasswordReset`, `resendVerification`, `verifyEmail`) and Task 3 (`setAuthCookies`, `getAuthCookies`, `clearAuthCookies`).
- Produces: same route handlers as before (`register`, `loginHandler`, `logout`, `forgotPassword`, `resetPasswordHandler`, `verifyEmailHandler`, `resendVerificationHandler`, `changePasswordHandler`, `me`) — no signature changes visible to routes.ts except `/resend-verification` losing its `requireAuth` gate.

- [ ] **Step 1: Rewrite `auth.controller.ts`**

```ts
import type { Request, Response } from "express";
import { z } from "zod";
import {
  AuthError,
  changePassword,
  completePasswordReset,
  login,
  logout as logoutService,
  registerParent,
  registerPupil,
  registerTeacher,
  requestPasswordReset,
  resendVerification,
  verifyEmail,
} from "../services/auth.service.js";
import { prisma } from "../utils/prisma.js";
import { clearAuthCookies, getAuthCookies, setAuthCookies } from "../utils/authCookies.js";

const teacherSchema = z.object({
  role: z.literal("TEACHER"),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});
const pupilSchema = z.object({
  role: z.literal("PUPIL"),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  requestedType: z.enum(["SCIENCE", "MATH", "INFO", "ECO"]),
  teacherCode: z.string().min(4),
  phone: z.string().min(6),
  parentPhone: z.string().min(6),
});
const parentSchema = z.object({
  role: z.literal("PARENT"),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});
const registerSchema = z.discriminatedUnion("role", [teacherSchema, pupilSchema, parentSchema]);

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide", details: parsed.error.flatten() });
    return;
  }
  try {
    const user =
      parsed.data.role === "TEACHER"
        ? await registerTeacher(parsed.data)
        : parsed.data.role === "PARENT"
          ? await registerParent(parsed.data)
          : await registerPupil(parsed.data);
    res.status(201).json({ id: user.id, role: user.role, status: user.status, name: user.name });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  try {
    const { user, session } = await login(parsed.data.email, parsed.data.password);
    setAuthCookies(res, session);
    res.json({ id: user.id, role: user.role, status: user.status, name: user.name });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  const { accessToken, refreshToken } = getAuthCookies(req);
  try {
    await logoutService(accessToken, refreshToken);
  } catch {
    // best-effort revoke
  }
  clearAuthCookies(res);
  res.status(204).send();
}

const GENERIC_RESET_MESSAGE = "Si cet e-mail existe, nous avons envoyé un lien pour réinitialiser votre mot de passe.";
const forgotPasswordSchema = z.object({ email: z.string().email() });

export async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  await requestPasswordReset(parsed.data.email);
  res.json({ message: GENERIC_RESET_MESSAGE });
}

const resetPasswordSchema = z.object({ token_hash: z.string().min(10), password: z.string().min(6) });

export async function resetPasswordHandler(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  try {
    const session = await completePasswordReset(parsed.data.token_hash, parsed.data.password);
    setAuthCookies(res, session);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

const verifyEmailSchema = z.object({ token_hash: z.string().min(10) });

export async function verifyEmailHandler(req: Request, res: Response) {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  try {
    const { session } = await verifyEmail(parsed.data.token_hash);
    setAuthCookies(res, session);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

const resendVerificationSchema = z.object({ email: z.string().email() });

export async function resendVerificationHandler(req: Request, res: Response) {
  const parsed = resendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  await resendVerification(parsed.data.email);
  res.json({ message: "E-mail de vérification envoyé." });
}

const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) });

export async function changePasswordHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  try {
    await changePassword(req.user.id, parsed.data.currentPassword, parsed.data.newPassword);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const teacherProfile =
    req.user.role === "TEACHER" ? await prisma.teacherProfile.findUnique({ where: { userId: req.user.id } }) : null;
  const pupilProfile =
    req.user.role === "PUPIL" ? await prisma.pupilProfile.findUnique({ where: { userId: req.user.id } }) : null;
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    status: req.user.status,
    teacherCode: teacherProfile?.teacherCode ?? null,
    parentCode: pupilProfile?.parentCode ?? null,
  });
}
```

- [ ] **Step 2: Edit `auth.routes.ts`**

In `server/src/routes/auth.routes.ts`, change the `/resend-verification` route registration from gating on `requireAuth` to being open:

```ts
authRouter.post("/resend-verification", authActionRateLimiter, resendVerificationHandler);
```

(Remove `requireAuth` from that line and, if now unused elsewhere in the file, remove its import.)

- [ ] **Step 3: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors in `auth.controller.ts` or `auth.routes.ts`.

- [ ] **Step 4: Manual smoke check**

Run: `cd server && npx vitest run src/services/auth.service.test.ts src/middleware/auth.middleware.test.ts`
Expected: both still PASS (controller doesn't have its own dedicated test file in this codebase; it's covered indirectly by the service/middleware tests plus the final manual e2e pass in Task 22).

- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/auth.controller.ts server/src/routes/auth.routes.ts
git commit -m "feat(auth): rewrite auth.controller.ts for Supabase sessions, open resend-verification"
```

---

## Task 8: Teacher/pupil/parent route cleanup

**Files:**
- Modify: `server/src/routes/teacher.routes.ts`
- Modify: `server/src/routes/pupil.routes.ts`
- Modify: `server/src/routes/parent.routes.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole`, `requireActive` (Task 6) — `requireEmailVerified` no longer exists and must not be imported.

- [ ] **Step 1: Edit `teacher.routes.ts`**

Change the import to:
```ts
import { requireActive, requireAuth, requireRole } from "../middleware/auth.middleware.js";
```
Change the router-level middleware chain to:
```ts
teacherRouter.use(requireAuth, requireRole("TEACHER"), requireActive);
```
(Remove `requireEmailVerified` from both the import and the chain.)

- [ ] **Step 2: Edit `pupil.routes.ts`**

Same pattern:
```ts
import { requireActive, requireAuth, requireRole } from "../middleware/auth.middleware.js";
```
```ts
pupilRouter.use(requireAuth, requireRole("PUPIL"), requireActive);
```

- [ ] **Step 3: Edit `parent.routes.ts`**

```ts
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
```
```ts
parentRouter.use(requireAuth, requireRole("PARENT"));
```
(Parent router never had `requireActive` — leave that out, matching current behavior.)

- [ ] **Step 4: Grep to confirm no stragglers**

Run: `cd server && grep -rn "requireEmailVerified" src`
Expected: no matches anywhere in `server/src`.

- [ ] **Step 5: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors in these three route files.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/teacher.routes.ts server/src/routes/pupil.routes.ts server/src/routes/parent.routes.ts
git commit -m "chore(routes): drop requireEmailVerified from teacher/pupil/parent routers"
```

---

## Task 9: Trim `mailer.ts`

**Files:**
- Modify: `server/src/utils/mailer.ts`

**Interfaces:**
- Produces: `sendMail` (unchanged, generic primitive), `sendParentAlertEmail` (unchanged) — consumed by `notification.service.ts` and wherever parent alerts are sent. Removes: `sendVerificationEmail`, `sendPasswordResetEmail` (no longer called anywhere once Task 5/7 land, since Supabase sends its own emails).

- [ ] **Step 1: Grep to confirm no remaining callers**

Run: `cd server && grep -rn "sendVerificationEmail\|sendPasswordResetEmail" src`
Expected: no matches (auth.service.ts no longer calls these after Task 5).

- [ ] **Step 2: Delete the two functions**

In `server/src/utils/mailer.ts`, delete the `sendVerificationEmail` and `sendPasswordResetEmail` function definitions and their exports. Keep `sendMail` and `sendParentAlertEmail` untouched.

- [ ] **Step 3: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors from `mailer.ts` or its remaining consumers.

- [ ] **Step 4: Commit**

```bash
git add server/src/utils/mailer.ts
git commit -m "chore(mailer): remove verification/reset email senders now handled by Supabase"
```

---

## Task 10: `seed.ts` rewrite

**Files:**
- Modify: `server/prisma/seed.ts`

**Interfaces:**
- Consumes: `supabaseAdmin` (Task 2), `env.adminEmail`/`env.adminPassword` (Task 4, via `process.env` directly as before).

- [ ] **Step 1: Rewrite the file**

```ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { supabaseAdmin } from "../src/utils/supabaseAdmin.js";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account already exists: ${email}`);
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Failed to create Supabase admin user: ${error?.message}`);

  await prisma.user.create({
    data: { email, supabaseId: data.user.id, name: "Admin", role: "ADMIN", status: "ACTIVE" },
  });
  console.log(`Seeded admin account: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no errors; `../src/utils/supabaseAdmin.js` resolves correctly under the existing `rootDir: "src"` / NodeNext config (seed.ts lives outside `src` but is run via `tsx`, not compiled by `tsc` directly, so this is a relative-runtime-resolution check, not a tsc-emit check).

- [ ] **Step 3: Run the seed against the dev DB**

Run: `cd server && npx prisma db seed`
Expected: either "Seeded admin account: <email>" (first run after Task 1's reset) or "Admin account already exists" (if re-run) — no thrown errors. This requires a reachable dev Postgres DB and a correctly configured Supabase project; if it fails on Supabase connectivity, note this as a blocker to resolve before continuing (see Task 22).

- [ ] **Step 4: Commit**

```bash
git add server/prisma/seed.ts
git commit -m "feat(seed): create admin via Supabase Auth admin API with email_confirm"
```

---

## Task 11: Delete `password.ts`/`jwt.ts` and their tests, drop unused deps

**Files:**
- Delete: `server/src/utils/password.ts`
- Delete: `server/src/utils/password.test.ts`
- Delete: `server/src/utils/jwt.ts`
- Delete: `server/src/utils/jwt.test.ts`
- Modify: `server/package.json`

**Interfaces:**
- Consumes: nothing (this task only removes files once Tasks 5-7 have removed all callers).

- [ ] **Step 1: Grep to confirm no remaining callers**

Run: `cd server && grep -rln "utils/password\|utils/jwt" src prisma`
Expected: no matches (Tasks 5, 6, 7, 10 have already removed every import).

- [ ] **Step 2: Delete the four files**

```bash
cd server && rm src/utils/password.ts src/utils/password.test.ts src/utils/jwt.ts src/utils/jwt.test.ts
```

- [ ] **Step 3: Remove unused dependencies from `package.json`**

In `server/package.json`, remove `bcryptjs` and `jsonwebtoken` from `dependencies`, and `@types/jsonwebtoken` from `devDependencies`. Leave `@supabase/supabase-js` as-is (already present).

- [ ] **Step 4: Reinstall to update the lockfile**

Run: `cd server && npm install`
Expected: `server/package-lock.json` updates to drop the removed packages; no errors.

- [ ] **Step 5: Type-check and full server test run**

Run: `cd server && npx tsc --noEmit && npx vitest run`
Expected: `tsc` clean; the full vitest suite may still show failures in the four integration test files (fixed next in Task 12) — that's expected at this point, not a regression from this task.

- [ ] **Step 6: Commit**

```bash
git add -A server/src/utils server/package.json server/package-lock.json
git commit -m "chore(deps): remove bcryptjs/jsonwebtoken and their now-dead utils"
```

---

## Task 12: Fix integration test files' `User` creation

**Files:**
- Modify: `server/src/services/vacation.service.test.ts`
- Modify: `server/src/services/attendance.service.test.ts`
- Modify: `server/src/services/payment.service.test.ts`
- Modify: `server/src/services/swap.service.test.ts`

**Interfaces:**
- Consumes: `randomUUID` from `node:crypto` (new import in each file), `prisma` (existing, unchanged usage).
- Produces: nothing new — these files' own `it()`/`describe()` exports are unchanged; only their `User` fixture creation changes.

- [ ] **Step 1: Edit `vacation.service.test.ts`**

Remove:
```ts
import { hashPassword } from "../utils/password.js";
```
Add:
```ts
import { randomUUID } from "node:crypto";
```
Remove the shared `const passwordHash = await hashPassword("initial-Pass1");` line. In the single `prisma.user.create({ data: {...} })` call (the teacher), replace the `passwordHash,` field with `supabaseId: randomUUID(),`.

- [ ] **Step 2: Run and verify**

Run: `cd server && npx vitest run src/services/vacation.service.test.ts`
Expected: PASS (requires a reachable dev Postgres DB per this repo's existing integration-test setup).

- [ ] **Step 3: Edit `attendance.service.test.ts`**

Remove the same `hashPassword` import, add the same `randomUUID` import. This file has 4 `User` rows total: the shared `beforeAll` teacher + pupil (currently sharing one `const passwordHash`), and two more created inside individual `it()` blocks (parent, pending-parent), each with their own local `const passwordHash`. Replace every one of these 4 `passwordHash,` fields with its own `supabaseId: randomUUID(),` — do not reuse a single UUID across the 4 rows, since `supabaseId` is `@unique`.

- [ ] **Step 4: Run and verify**

Run: `cd server && npx vitest run src/services/attendance.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Edit `payment.service.test.ts`**

Same pattern: remove `hashPassword` import, add `randomUUID` import, remove the shared `const passwordHash`, replace both the teacher's and the pupil's `passwordHash,` field with their own `supabaseId: randomUUID(),`.

- [ ] **Step 6: Run and verify**

Run: `cd server && npx vitest run src/services/payment.service.test.ts`
Expected: PASS.

- [ ] **Step 7: Edit `swap.service.test.ts`**

Same pattern for 3 users (teacher, otherTeacher, pupil): remove `hashPassword` import, add `randomUUID` import, remove the shared `const passwordHash`, give each of the 3 `prisma.user.create` calls its own `supabaseId: randomUUID(),`.

- [ ] **Step 8: Run and verify**

Run: `cd server && npx vitest run src/services/swap.service.test.ts`
Expected: PASS.

- [ ] **Step 9: Full server suite run**

Run: `cd server && npx vitest run`
Expected: PASS across all server test files.

- [ ] **Step 10: Commit**

```bash
git add server/src/services/vacation.service.test.ts server/src/services/attendance.service.test.ts server/src/services/payment.service.test.ts server/src/services/swap.service.test.ts
git commit -m "test(services): use per-row unique supabaseId instead of shared passwordHash fixture"
```

---

## Task 13: Update `.env.example`

**Files:**
- Modify: `server/.env.example`

**Interfaces:**
- None (documentation-only file).

- [ ] **Step 1: Edit the file**

In `server/.env.example`:
- Remove the `JWT_SECRET` section entirely.
- Remove the `REQUIRE_EMAIL_VERIFICATION` section entirely.
- Add a required-vars section:
  ```
  # Required: Supabase Auth (used for all sign-up/sign-in/session/verification/reset flows)
  SUPABASE_URL=
  SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  ```
- Keep the existing optional `SUPABASE_STORAGE_BUCKET` section as-is (separate concern from the auth vars above), reword its comment if needed to make clear it is optional and distinct from the three required vars above it.
- Reword the Resend comment to note it is now used only for parent-alert emails (not verification/reset, which Supabase sends directly).

- [ ] **Step 2: Commit**

```bash
git add server/.env.example
git commit -m "docs(env): document required Supabase auth vars, drop JWT/verification-flag docs"
```

---

## Task 14: Client `api/auth.ts`

**Files:**
- Modify: `client/src/api/auth.ts`

**Interfaces:**
- Produces: `resetPassword(tokenHash: string, password: string)`, `verifyEmail(tokenHash: string)`, `resendVerification(email: string)` — consumed by ResetPasswordPage (Task 21), VerifyEmailPage (Task 19).

- [ ] **Step 1: Edit the file**

Rename the `token` parameter to `token_hash` on the request bodies of `resetPassword` and `verifyEmail` (keep the exported function's own parameter name as `tokenHash` for readability; only the wire field sent to the server changes to `token_hash`, matching the controller's `resetPasswordSchema`/`verifyEmailSchema` from Task 7).

Change `resendVerification` from a no-argument call to:
```ts
export async function resendVerification(email: string) {
  const { data } = await api.post("/auth/resend-verification", { email });
  return data;
}
```

Remove `devVerifyUrl`/`devResetUrl` from any response type generics on `verifyEmail`/`resetPassword`/`forgotPassword` calls in this file (Supabase always sends real emails; there is no dev-mode shortcut URL anymore).

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: errors surface in callers (VerifyEmailPage, ResetPasswordPage, ForgotPasswordPage) until Tasks 19-21 land — that's expected at this point.

- [ ] **Step 3: Commit**

```bash
git add client/src/api/auth.ts
git commit -m "feat(client-api): switch auth.ts to token_hash params and email-based resend"
```

---

## Task 15: Client `api/types.ts`

**Files:**
- Modify: `client/src/api/types.ts`

**Interfaces:**
- Produces: `Me` interface without `emailVerified`/`emailVerificationRequired` — consumed by `useAuth` and route guards (Task 16).

- [ ] **Step 1: Edit the `Me` interface**

In `client/src/api/types.ts` (around lines 20-30), remove the `emailVerified: boolean` and `emailVerificationRequired: boolean` fields from the `Me` interface. Leave every other field untouched.

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: errors surface in `guards.tsx` (Task 16) until that task lands — expected at this point.

- [ ] **Step 3: Commit**

```bash
git add client/src/api/types.ts
git commit -m "feat(client-api): drop emailVerified fields from Me type"
```

---

## Task 16: Client `guards.tsx` + test

**Files:**
- Modify: `client/src/routes/guards.tsx`
- Modify: `client/src/routes/guards.test.tsx`

**Interfaces:**
- Consumes: `Me` (Task 15).
- Produces: `roleHome(user: Me): string`, `RequireRole` component — unchanged signatures, just fewer branches.

- [ ] **Step 1: Rewrite `guards.tsx`**

Remove the `emailVerificationRequired`/`emailVerified` branches entirely from `roleHome` and `RequireRole`. The remaining logic:
```tsx
export function roleHome(user: Me): string {
  if (user.role === "ADMIN") return "/admin";
  if (user.status !== "ACTIVE") return "/pending";
  if (user.role === "TEACHER") return "/teacher/overview";
  if (user.role === "PARENT") return "/parent/home";
  return "/pupil/home";
}
```
Keep `RequireRole`'s existing structure (redirect-if-pending, redirect-if-role-mismatch, render children otherwise), just with the verification checks removed.

- [ ] **Step 2: Write replacement tests in `guards.test.tsx`**

Since the current file only covers the verification-gate branch (which no longer exists), replace its contents with tests for the surviving logic, using the same `vi.hoisted` mock pattern already present in the file:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { roleHome, RequireRole } from "./guards";
import type { Me } from "../api/types";

function makeUser(overrides: Partial<Me> = {}): Me {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "PUPIL",
    status: "ACTIVE",
    teacherCode: null,
    parentCode: null,
    ...overrides,
  } as Me;
}

describe("roleHome", () => {
  it("routes ADMIN to /admin regardless of status", () => {
    expect(roleHome(makeUser({ role: "ADMIN", status: "PENDING" }))).toBe("/admin");
  });

  it("routes any non-ACTIVE non-admin user to /pending", () => {
    expect(roleHome(makeUser({ role: "TEACHER", status: "PENDING" }))).toBe("/pending");
  });

  it("routes an ACTIVE TEACHER to /teacher/overview", () => {
    expect(roleHome(makeUser({ role: "TEACHER", status: "ACTIVE" }))).toBe("/teacher/overview");
  });

  it("routes an ACTIVE PARENT to /parent/home", () => {
    expect(roleHome(makeUser({ role: "PARENT", status: "ACTIVE" }))).toBe("/parent/home");
  });

  it("routes an ACTIVE PUPIL to /pupil/home", () => {
    expect(roleHome(makeUser({ role: "PUPIL", status: "ACTIVE" }))).toBe("/pupil/home");
  });
});

describe("RequireRole", () => {
  function renderWithUser(user: Me, allowedRoles: Me["role"][]) {
    return render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequireRole user={user} roles={allowedRoles}>
                <div>Protected content</div>
              </RequireRole>
            }
          />
          <Route path="/pending" element={<div>Pending page</div>} />
          <Route path="/pupil/home" element={<div>Pupil home</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("redirects a PENDING user to /pending", () => {
    renderWithUser(makeUser({ status: "PENDING" }), ["PUPIL"]);
    expect(screen.getByText("Pending page")).toBeInTheDocument();
  });

  it("renders children when the user's role matches", () => {
    renderWithUser(makeUser({ role: "PUPIL", status: "ACTIVE" }), ["PUPIL"]);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects to the user's role home when the role doesn't match", () => {
    renderWithUser(makeUser({ role: "PUPIL", status: "ACTIVE" }), ["TEACHER"]);
    expect(screen.getByText("Pupil home")).toBeInTheDocument();
  });
});
```

Adjust the exact `RequireRole` prop names/route element structure to match what's actually in `guards.tsx` after Step 1 (the props/route setup above assume the same shape the file already used before this edit — verify against the file's current export signature and reconcile if it differs before finalizing this test).

- [ ] **Step 3: Run the tests**

Run: `cd client && npx vitest run src/routes/guards.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/routes/guards.tsx client/src/routes/guards.test.tsx
git commit -m "feat(client): drop email-verification gating from route guards, add role/status test coverage"
```

---

## Task 17: Client `LoginPage.tsx` + `client.ts` `ApiErrorBody`

**Files:**
- Modify: `client/src/api/client.ts`
- Modify: `client/src/features/auth/LoginPage.tsx`

**Interfaces:**
- Produces: `ApiErrorBody { error: string; code?: string }` — consumed by `LoginPage.tsx` and any future error-code branching.

- [ ] **Step 1: Edit `client.ts`**

In `client/src/api/client.ts`, add an optional `code` field to `ApiErrorBody`:
```ts
export interface ApiErrorBody {
  error: string;
  code?: string;
}
```

- [ ] **Step 2: Edit `LoginPage.tsx`**

Add imports for `axios` and `ApiErrorBody` (from `../../api/client`). On the login `useMutation`, add an `onError` handler:
```tsx
onError: (error) => {
  if (axios.isAxiosError(error) && (error.response?.data as ApiErrorBody)?.code === "EMAIL_NOT_CONFIRMED") {
    navigate("/verify-email", { state: { email: values.email } });
  }
},
```
(Use whatever the existing mutation's `values`/form-values variable is named in this file — check the current `onSubmit`/mutation wiring before finalizing the exact variable reference.)

- [ ] **Step 3: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no errors in `client.ts` or `LoginPage.tsx`.

- [ ] **Step 4: Manual check**

Run: `cd client && npx vitest run` (if `LoginPage` has existing tests, confirm they still pass; this repo's summary didn't note a dedicated LoginPage test file, so this step may simply confirm no regressions elsewhere).

- [ ] **Step 5: Commit**

```bash
git add client/src/api/client.ts client/src/features/auth/LoginPage.tsx
git commit -m "feat(client): redirect to /verify-email on EMAIL_NOT_CONFIRMED login error"
```

---

## Task 18: Client `RegisterPage.tsx`

**Files:**
- Modify: `client/src/features/auth/RegisterPage.tsx`

**Interfaces:**
- None new — internal navigation change only.

- [ ] **Step 1: Edit the `onSuccess` handler**

Change:
```ts
queryClient.invalidateQueries({ queryKey: ["me"] });
navigate("/verify-email");
```
to:
```ts
navigate("/verify-email", { state: { email: values.email } });
```
(matching whatever the actual submitted-values variable is named in this file's mutation). Remove the now-unused `queryClient`/`useQueryClient` import and declaration if nothing else in the file uses them.

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no errors; confirm `queryClient` isn't referenced elsewhere in the file before removing its import (grep the file first if unsure).

- [ ] **Step 3: Commit**

```bash
git add client/src/features/auth/RegisterPage.tsx
git commit -m "feat(client): pass email via navigation state to /verify-email after registration"
```

---

## Task 19: Client `VerifyEmailPage.tsx`

**Files:**
- Modify: `client/src/features/auth/VerifyEmailPage.tsx`

**Interfaces:**
- Consumes: `verifyEmail(tokenHash)` (Task 14), `resendVerification(email)` (Task 14), `useAuth()` (unchanged), `location.state` (from Task 18's navigation).

- [ ] **Step 1: Rewrite the page**

Apply these changes to `VerifyEmailPage.tsx`:
- Read the query param as `token_hash` instead of `token`: `const tokenHash = searchParams.get("token_hash");`.
- Derive the displayed/target email as `const email = user?.email ?? (location.state as { email?: string } | null)?.email ?? null;` (supports a fully logged-out visitor who just registered, via router state, as well as an already-authenticated visitor).
- Change `resendMutation` to call `resendVerification(email!)` instead of a no-arg call, and disable/hide the resend action if `email` is null.
- Remove any `emailVerified` check; replace with an effect that redirects once `isAuthenticated` becomes true (since an authenticated session now always implies a confirmed email):
  ```tsx
  useEffect(() => {
    if (isAuthenticated) {
      navigate(roleHome(user!), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);
  ```
- Change the polling effect's guard condition so it only polls while there's a token to consume or the user isn't yet authenticated (e.g. `if (!tokenHash && isAuthenticated) return;` at the top of the effect, or equivalent — stop polling once authenticated).
- Delete the entire `devVerifyUrl` dev-mode block (Supabase always sends real emails once the project is configured; there is no local shortcut).
- Delete the "else show a link to /login" branch that used to run after a successful verification when the user wasn't authenticated — verifying now always yields a session via `setAuthCookies`, so the new redirect effect above handles it.
- Wrap the "Se déconnecter" button in `{isAuthenticated && (...)}` so it doesn't render for a logged-out visitor who has no session to log out of.

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/auth/VerifyEmailPage.tsx
git commit -m "feat(client): rework VerifyEmailPage for token_hash and session-implies-confirmed flow"
```

---

## Task 20: Client `ForgotPasswordPage.tsx`

**Files:**
- Modify: `client/src/features/auth/ForgotPasswordPage.tsx`

**Interfaces:**
- None new.

- [ ] **Step 1: Remove the dev-mode block**

Inside the `mutation.isSuccess` branch, delete the conditional block that renders `mutation.data.devResetUrl` (there is no dev-mode reset URL anymore — Supabase sends the real email). Keep the rest of the success-state UI (the generic "if this email exists..." message) unchanged.

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/auth/ForgotPasswordPage.tsx
git commit -m "feat(client): drop dev-mode reset URL display from ForgotPasswordPage"
```

---

## Task 21: Client `ResetPasswordPage.tsx`

**Files:**
- Modify: `client/src/features/auth/ResetPasswordPage.tsx`

**Interfaces:**
- Consumes: `resetPassword(tokenHash, password)` (Task 14).

- [ ] **Step 1: Rename the query param and wire it through**

Change:
```ts
const token = searchParams.get("token") ?? "";
```
to:
```ts
const tokenHash = searchParams.get("token_hash") ?? "";
```
Update the mutation function to `mutationFn: (values) => resetPassword(tokenHash, values.password)`, and the invalid-link guard to check `!tokenHash` instead of `!token`. Rename any other local references from `token` to `tokenHash` for consistency.

- [ ] **Step 2: Type-check**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/auth/ResetPasswordPage.tsx
git commit -m "feat(client): switch ResetPasswordPage to token_hash query param"
```

---

## Task 22: Full verification pass

**Files:**
- None modified — verification only.

- [ ] **Step 1: Full server test suite**

Run: `cd server && npx tsc --noEmit && npx vitest run`
Expected: `tsc` clean; every test file passes, including the four integration test files (Task 12) against a reachable dev Postgres DB, and the mocked `auth.service.test.ts`/`auth.middleware.test.ts` (Tasks 5, 6).

- [ ] **Step 2: Full client test suite**

Run: `cd client && npx tsc --noEmit && npx vitest run`
Expected: `tsc` clean; every test file passes, including `guards.test.tsx` (Task 16).

- [ ] **Step 3: Grep sweep for dead references**

Run:
```bash
cd server && grep -rn "passwordHash\|emailVerifiedAt\|requireEmailVerification\|requireEmailVerified\|devVerifyUrl\|devResetUrl\|jwtSecret" src prisma
cd ../client && grep -rn "emailVerified\|devVerifyUrl\|devResetUrl" src
```
Expected: no matches in either.

- [ ] **Step 4: Manual end-to-end pass against a live Supabase project**

This step cannot be automated and requires a real, configured Supabase project (URL/anon key/service-role key set in `server/.env`, "Confirm email" enabled in Supabase Auth settings) plus both dev servers running (`npm run dev` in `server`, `npm run dev` in `client`):
1. Register a new pupil/teacher/parent account with a real, reachable email address.
2. Confirm the verification email arrives, and clicking its link lands on `/verify-email?token_hash=...` and results in an authenticated session that redirects to the correct role home.
3. Log out, then log back in with the same credentials — confirm success.
4. Use "forgot password", confirm the reset email arrives, follow its link to `/reset-password?token_hash=...`, set a new password, confirm it results in an authenticated session.
5. Log out and log back in with the new password only (old password should now fail).
6. From an authenticated session, use the change-password flow with the correct current password (succeeds) and then again with a deliberately wrong current password (fails with a 400 and a French error message, no crash).

Expected: every step above succeeds with no unhandled errors in either server or browser console.

- [ ] **Step 5: Commit (if this step produced any fixup changes)**

If Step 4 surfaces a bug requiring a code fix, make the minimal fix, re-run the affected step, and commit:
```bash
git add -A
git commit -m "fix(auth): <describe the specific fixup>"
```
If no fixes were needed, there is nothing to commit for this task.

---

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-09-06-supabase-auth-migration-design.md` (data model, server changes, client changes, external setup docs via `.env.example`, testing strategy, error handling via the `code` field) maps to a task above (Tasks 1, 2-13, 14-21, 13, 5/6/12, 7/14/17 respectively).
- **Placeholder scan:** no "TBD"/"implement later"/"add appropriate handling" phrases were used; every step contains concrete code, exact commands, or a fully specified manual verification checklist (Task 22, Step 4).
- **Type consistency:** `LoginResult`/`VerifiedSession` are defined once in Task 5 and consumed with identical names in Task 7; `setAuthCookies`/`clearAuthCookies`/`getAuthCookies` are defined once in Task 3 and consumed identically in Tasks 6 and 7; `AuthedUser` is defined once in Task 6 and not redefined elsewhere; `createAuthClient`/`supabaseAuth` are defined once in Task 2 and consumed identically in Tasks 5 and 6; cookie names (`sb-access-token`, `sb-refresh-token`) appear only in Task 3 and are never hardcoded elsewhere.

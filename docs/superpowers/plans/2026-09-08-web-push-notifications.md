# Web Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teachers and parents receive a native OS/browser push notification whenever a new in-app `Notification` row is created for them, even when no Bachandi tab is open.

**Architecture:** A new `PushSubscription` Prisma model stores one row per subscribed browser/device (deduped by the browser-issued `endpoint` URL). The client registers `client/public/sw.js` and, via an opt-in toggle, subscribes through the Push API, POSTing the subscription to the server. `createNotification(...)` (the single existing choke point every notification passes through) calls `sendPushToUser(recipientId, payload)` right after a genuinely new row is inserted, which fans out to every subscription for that user via the `web-push` npm package and self-generated VAPID keys. Three notification types are today only generated lazily (on bell-open); a daily `setInterval` job proactively runs their existing sync functions so they get pushed too, relying on the already-existing `Notification.dedupeKey` uniqueness for idempotency.

**Tech Stack:** Express 5 + Prisma + PostgreSQL (server), React 19 + TanStack Query + Vite (client), `web-push` npm package + native browser Push API + Service Worker (no third-party push service), Vitest on both workspaces.

**Spec:** `docs/superpowers/specs/2026-09-08-web-push-notifications-design.md`

## Global Constraints

- Native Web Push only — no Firebase/OneSignal/any third-party push service.
- Scope is teachers and parents only — no pupil-facing changes, no new `NotificationType`, `VISIT_REQUEST` stays untouched.
- Every new user-facing string and controller error message is in **French**, matching the rest of the app (e.g. `"Non authentifié"`, `"Accès interdit"`).
- Missing VAPID env vars must never crash the server or block any other feature — follow the exact nullable-config pattern already used for `env.resend` / `env.supabaseStorage` in `server/src/utils/env.ts`.
- Push delivery failures must never propagate to the caller of `createNotification` — mirror the existing best-effort/catch-and-log pattern used for `sendParentAlertEmail`.
- All new/modified server files use ESM relative imports with explicit `.js` extensions (e.g. `from "../utils/env.js"`), matching every existing file in `server/src`.
- Multi-device: a user may have several active `PushSubscription` rows; all are fanned out to independently, and a stale one (404/410 response) is deleted without affecting the others.
- Opt-in only — no forced permission prompt/banner. The toggle lives next to the existing `NotificationBell` in the authenticated header.
- No end-to-end push-delivery test (requires a real browser + real push service) — every task's automated tests mock the network/browser boundary; manual verification is called out explicitly where relevant.

---

## Task 1: Data model, VAPID config, and `push.service.ts` (persist + send)

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/utils/env.ts`
- Create: `server/src/utils/vapid.ts`
- Create: `server/src/services/push.service.ts`
- Test: `server/src/services/push.service.test.ts`
- Modify: `server/package.json` (add `web-push` + `@types/web-push`)

**Interfaces:**
- Produces: `saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void>`, `removeSubscription(endpoint: string): Promise<void>`, `sendPushToUser(userId: string, payload: { title: string; body: string; link?: string | null }): Promise<void>` (never throws) — all exported from `server/src/services/push.service.ts`, consumed by Task 2 (`notification.service.ts`) and Task 4 (`push.controller.ts`).
- Produces: `vapidPublicKey: string | null` and `webpush` (the configured `web-push` module instance) exported from `server/src/utils/vapid.ts`, consumed by Task 4.
- Produces: `env.vapid: { publicKey: string; privateKey: string; subject: string } | null` from `server/src/utils/env.ts`, consumed by `vapid.ts` and `push.service.ts`.

- [ ] **Step 1: Install the `web-push` package**

Run from the repo root:
```bash
npm install web-push --workspace server
npm install -D @types/web-push --workspace server
```

- [ ] **Step 2: Add the `PushSubscription` model to the Prisma schema**

In `server/prisma/schema.prisma`, add `pushSubscriptions PushSubscription[]` to the `User` model (after the existing `parentProfile PARENTProfile?` line):

```prisma
model User {
  id                     String                  @id @default(cuid())
  email                  String                  @unique
  supabaseId             String                  @unique
  name                   String
  role                   Role
  status                 UserStatus              @default(PENDING)
  createdAt              DateTime                @default(now())
  teacherProfile         TeacherProfile?
  pupilProfile           PupilProfile?
  parentProfile          ParentProfile?
  pushSubscriptions      PushSubscription[]
}
```

Then add the new model at the end of the file:

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  @@index([userId])
}
```

- [ ] **Step 3: Generate and apply the migration**

```bash
npm run prisma:migrate --workspace server -- --name add_push_subscription
```

This also regenerates the Prisma client (`prisma migrate dev` runs `prisma generate` automatically), so `prisma.pushSubscription` is available afterward.

- [ ] **Step 4: Add the `vapid` config to `env.ts`**

In `server/src/utils/env.ts`, insert after the existing `supabaseStorage` block (after line 21, before `export const env = {`):

```typescript
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;
const vapid =
  vapidPublicKey && vapidPrivateKey && vapidSubject
    ? { publicKey: vapidPublicKey, privateKey: vapidPrivateKey, subject: vapidSubject }
    : null;
```

Then add `vapid,` to the exported object, right after `supabaseStorage,`:

```typescript
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
  vapid,
  isProduction: process.env.NODE_ENV === "production",
};
```

- [ ] **Step 5: Create `server/src/utils/vapid.ts`**

```typescript
import webpush from "web-push";
import { env } from "./env.js";

// Configures the web-push library once at startup. If VAPID env vars are
// absent (e.g. local dev without keys configured), setVapidDetails is simply
// never called — push.service.ts's sendPushToUser checks env.vapid first and
// no-ops in that case, so webpush.sendNotification is never invoked
// unconfigured.
if (env.vapid) {
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
}

export { webpush };

export const vapidPublicKey: string | null = env.vapid?.publicKey ?? null;
```

- [ ] **Step 6: Write the failing test for `push.service.ts`**

Create `server/src/services/push.service.test.ts`:

```typescript
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../utils/prisma.js";

const { envMock, sendNotificationMock } = vi.hoisted(() => ({
  envMock: { vapid: null as { publicKey: string; privateKey: string; subject: string } | null },
  sendNotificationMock: vi.fn(),
}));

vi.mock("../utils/env.js", () => ({ env: envMock }));
vi.mock("../utils/vapid.js", () => ({ webpush: { sendNotification: sendNotificationMock } }));

const { saveSubscription, removeSubscription, sendPushToUser } = await import("./push.service.js");

const TEST_TAG = `push-${Date.now()}`;
let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `${TEST_TAG}@example.com`,
      supabaseId: randomUUID(),
      name: "Push Test User",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `PT${Date.now()}` } },
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.pushSubscription.deleteMany({ where: { userId } });
  await prisma.teacherProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterEach(async () => {
  await prisma.pushSubscription.deleteMany({ where: { userId } });
  sendNotificationMock.mockReset();
  envMock.vapid = null;
});

describe("saveSubscription", () => {
  it("creates a new subscription row", async () => {
    await saveSubscription(userId, {
      endpoint: `https://push.example.com/${TEST_TAG}-1`,
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });

    const row = await prisma.pushSubscription.findUnique({
      where: { endpoint: `https://push.example.com/${TEST_TAG}-1` },
    });
    expect(row).not.toBeNull();
    expect(row?.userId).toBe(userId);
    expect(row?.p256dh).toBe("p256dh-key");
    expect(row?.auth).toBe("auth-key");
  });

  it("upserts (no duplicate row) when the same endpoint subscribes again", async () => {
    const endpoint = `https://push.example.com/${TEST_TAG}-2`;
    await saveSubscription(userId, { endpoint, keys: { p256dh: "old", auth: "old" } });
    await saveSubscription(userId, { endpoint, keys: { p256dh: "new", auth: "new" } });

    const rows = await prisma.pushSubscription.findMany({ where: { endpoint } });
    expect(rows).toHaveLength(1);
    expect(rows[0].p256dh).toBe("new");
  });
});

describe("removeSubscription", () => {
  it("deletes the subscription with the given endpoint", async () => {
    const endpoint = `https://push.example.com/${TEST_TAG}-3`;
    await saveSubscription(userId, { endpoint, keys: { p256dh: "p", auth: "a" } });

    await removeSubscription(endpoint);

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row).toBeNull();
  });

  it("does not throw when the endpoint doesn't exist", async () => {
    await expect(removeSubscription("https://push.example.com/does-not-exist")).resolves.toBeUndefined();
  });
});

describe("sendPushToUser", () => {
  it("does nothing when VAPID is not configured", async () => {
    envMock.vapid = null;
    await saveSubscription(userId, {
      endpoint: `https://push.example.com/${TEST_TAG}-4`,
      keys: { p256dh: "p", auth: "a" },
    });

    await sendPushToUser(userId, { title: "Hi", body: "There" });

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no subscriptions", async () => {
    envMock.vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@bachandi.app" };

    await sendPushToUser(userId, { title: "Hi", body: "There" });

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("sends to every subscription for the user", async () => {
    envMock.vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@bachandi.app" };
    sendNotificationMock.mockResolvedValue(undefined);
    await saveSubscription(userId, {
      endpoint: `https://push.example.com/${TEST_TAG}-5a`,
      keys: { p256dh: "p1", auth: "a1" },
    });
    await saveSubscription(userId, {
      endpoint: `https://push.example.com/${TEST_TAG}-5b`,
      keys: { p256dh: "p2", auth: "a2" },
    });

    await sendPushToUser(userId, { title: "Hi", body: "There", link: "/teacher/overview" });

    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(sendNotificationMock).toHaveBeenCalledWith(
      { endpoint: `https://push.example.com/${TEST_TAG}-5a`, keys: { p256dh: "p1", auth: "a1" } },
      JSON.stringify({ title: "Hi", body: "There", link: "/teacher/overview" })
    );
  });

  it("deletes the subscription when the push service responds 410 Gone", async () => {
    envMock.vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@bachandi.app" };
    const endpoint = `https://push.example.com/${TEST_TAG}-6`;
    await saveSubscription(userId, { endpoint, keys: { p256dh: "p", auth: "a" } });
    sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));

    await sendPushToUser(userId, { title: "Hi", body: "There" });

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row).toBeNull();
  });

  it("keeps the subscription and logs on other errors", async () => {
    envMock.vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@bachandi.app" };
    const endpoint = `https://push.example.com/${TEST_TAG}-7`;
    await saveSubscription(userId, { endpoint, keys: { p256dh: "p", auth: "a" } });
    sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error("Server error"), { statusCode: 500 }));

    await expect(sendPushToUser(userId, { title: "Hi", body: "There" })).resolves.toBeUndefined();

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row).not.toBeNull();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
cd server && npx vitest run src/services/push.service.test.ts
```
Expected: FAIL — `Cannot find module './push.service.js'` (the module doesn't exist yet).

- [ ] **Step 8: Implement `server/src/services/push.service.ts`**

```typescript
import { prisma } from "../utils/prisma.js";
import { env } from "../utils/env.js";
import { webpush } from "../utils/vapid.js";

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  link?: string | null;
}

export async function saveSubscription(userId: string, sub: PushSubscriptionInput): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/**
 * Fans out a push notification to every device the user has subscribed
 * from. Never throws — a delivery failure here must not block whatever
 * created the underlying in-app notification. Stale subscriptions (the push
 * service responds 404/410, meaning the browser unsubscribed, cleared data,
 * or the OS revoked permission) are deleted so they aren't retried forever.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!env.vapid) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        } else {
          console.error("[push] failed to send notification", err);
        }
      }
    })
  );
}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
cd server && npx vitest run src/services/push.service.test.ts
```
Expected: PASS (9 tests).

- [ ] **Step 10: Commit**

```bash
git add server/prisma/schema.prisma server/src/utils/env.ts server/src/utils/vapid.ts server/src/services/push.service.ts server/src/services/push.service.test.ts server/package.json server/package-lock.json server/prisma/migrations
git commit -m "feat: add PushSubscription model and push.service.ts"
```

---

## Task 2: Wire push into `createNotification` and add `runDailyNotificationSync`

**Files:**
- Modify: `server/src/services/notification.service.ts`
- Test: `server/src/services/notification.service.test.ts` (new file)

**Interfaces:**
- Consumes: `sendPushToUser(userId, payload)` from Task 1's `push.service.ts`.
- Produces: `runDailyNotificationSync(): Promise<void>`, exported from `notification.service.ts`, consumed by Task 3's job scheduler.

- [ ] **Step 1: Write the failing tests**

Create `server/src/services/notification.service.test.ts`:

```typescript
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../utils/prisma.js";

const { sendPushToUserMock } = vi.hoisted(() => ({ sendPushToUserMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./push.service.js", () => ({ sendPushToUser: sendPushToUserMock }));

const { createNotification, runDailyNotificationSync } = await import("./notification.service.js");

const TEST_TAG = `notif-svc-${Date.now()}`;
let teacherId: string;
let parentId: string;

beforeAll(async () => {
  const teacher = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-teacher@example.com`,
      supabaseId: randomUUID(),
      name: "Notif Test Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `NT${Date.now()}` } },
    },
  });
  teacherId = teacher.id;

  const parent = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-parent@example.com`,
      supabaseId: randomUUID(),
      name: "Notif Test Parent",
      role: "PARENT",
      status: "ACTIVE",
      parentProfile: { create: {} },
    },
  });
  parentId = parent.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { OR: [{ teacherId }, { parentId }] } });
  await prisma.parentProfile.deleteMany({ where: { userId: parentId } });
  await prisma.teacherProfile.deleteMany({ where: { userId: teacherId } });
  await prisma.user.deleteMany({ where: { id: { in: [teacherId, parentId] } } });
});

afterEach(async () => {
  await prisma.notification.deleteMany({ where: { OR: [{ teacherId }, { parentId }] } });
  sendPushToUserMock.mockClear();
});

describe("createNotification push wiring", () => {
  it("sends a push notification once a genuinely new row is created (teacher recipient)", async () => {
    await createNotification({
      teacherId,
      type: "SWAP_REQUEST",
      title: "Nouvelle demande d'échange",
      body: "Un élève souhaite échanger une séance.",
      link: "/teacher/swap-requests",
    });

    expect(sendPushToUserMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUserMock).toHaveBeenCalledWith(teacherId, {
      title: "Nouvelle demande d'échange",
      body: "Un élève souhaite échanger une séance.",
      link: "/teacher/swap-requests",
    });
  });

  it("sends a push notification once a genuinely new row is created (parent recipient)", async () => {
    await createNotification({
      parentId,
      type: "POST_PUBLISHED",
      title: "Nouveau contenu publié",
      body: "Un nouveau cours a été publié.",
      link: "/parent/feed",
    });

    expect(sendPushToUserMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUserMock).toHaveBeenCalledWith(parentId, {
      title: "Nouveau contenu publié",
      body: "Un nouveau cours a été publié.",
      link: "/parent/feed",
    });
  });

  it("does not send a push notification when dedupe short-circuits", async () => {
    const dedupeKey = `dedupe-test:${TEST_TAG}`;
    await createNotification({
      teacherId,
      type: "ABSENCE",
      title: "Absence",
      body: "Premier appel",
      dedupeKey,
    });
    sendPushToUserMock.mockClear();

    await createNotification({
      teacherId,
      type: "ABSENCE",
      title: "Absence",
      body: "Deuxième appel (déduppliqué)",
      dedupeKey,
    });

    expect(sendPushToUserMock).not.toHaveBeenCalled();
  });
});

describe("runDailyNotificationSync", () => {
  it("runs the lazy sync functions for every active teacher and parent, skipping inactive ones", async () => {
    const inactiveTeacher = await prisma.user.create({
      data: {
        email: `${TEST_TAG}-inactive-teacher@example.com`,
        supabaseId: randomUUID(),
        name: "Inactive Teacher",
        role: "TEACHER",
        status: "PENDING",
        teacherProfile: { create: { teacherCode: `NTI${Date.now()}` } },
      },
    });

    try {
      const klass = await prisma.class.create({
        data: { teacherId, name: "Sync Test Class", type: "MATH", monthlyFee: 100 },
      });
      const pupilUser = await prisma.user.create({
        data: {
          email: `${TEST_TAG}-pupil@example.com`,
          supabaseId: randomUUID(),
          name: "Sync Test Pupil",
          role: "PUPIL",
          status: "ACTIVE",
          pupilProfile: {
            create: { requestedType: "MATH", teacherId, classId: klass.id, parentCode: `NPC${Date.now()}` },
          },
        },
      });
      await prisma.parentLink.create({
        data: { parentId, pupilId: pupilUser.id, teacherId, status: "ACTIVE", respondedAt: new Date() },
      });
      await prisma.paymentRecord.create({
        data: { pupilId: pupilUser.id, period: "2026-09", status: "UNPAID", amountDue: 100, dueDate: new Date() },
      });

      await runDailyNotificationSync();

      const teacherNotifs = await prisma.notification.findMany({ where: { teacherId, type: "PAYMENT_DUE" } });
      expect(teacherNotifs).toHaveLength(1);

      const parentNotifs = await prisma.notification.findMany({ where: { parentId, type: "PAYMENT_DUE" } });
      expect(parentNotifs).toHaveLength(1);

      const inactiveTeacherNotifs = await prisma.notification.findMany({
        where: { teacherId: inactiveTeacher.id },
      });
      expect(inactiveTeacherNotifs).toHaveLength(0);

      // One push per notification actually created (teacher row + parent row above).
      expect(sendPushToUserMock).toHaveBeenCalledTimes(2);

      await prisma.paymentRecord.deleteMany({ where: { pupilId: pupilUser.id } });
      await prisma.parentLink.deleteMany({ where: { pupilId: pupilUser.id } });
      await prisma.pupilProfile.deleteMany({ where: { userId: pupilUser.id } });
      await prisma.user.deleteMany({ where: { id: pupilUser.id } });
      await prisma.class.deleteMany({ where: { id: klass.id } });
    } finally {
      await prisma.teacherProfile.deleteMany({ where: { userId: inactiveTeacher.id } });
      await prisma.user.deleteMany({ where: { id: inactiveTeacher.id } });
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server && npx vitest run src/services/notification.service.test.ts
```
Expected: FAIL — `sendPushToUserMock` never called (push not wired yet), and `runDailyNotificationSync` is not exported (`is not a function` / `undefined`).

- [ ] **Step 3: Wire `sendPushToUser` into `createNotification`**

In `server/src/services/notification.service.ts`, add the import at the top:

```typescript
import { sendPushToUser } from "./push.service.js";
```

Then, in `createNotification`, right after `const notification = await prisma.notification.create({...});` and before the existing `if (input.parentId && URGENT_PARENT_EMAIL_TYPES...)` block, add:

```typescript
  const recipientId = input.teacherId ?? input.parentId!;
  try {
    await sendPushToUser(recipientId, { title: input.title, body: input.body, link: input.link });
  } catch (err) {
    console.error("[push] failed to send push notification", err);
  }
```

- [ ] **Step 4: Add `runDailyNotificationSync`**

At the end of `server/src/services/notification.service.ts`, add:

```typescript
/**
 * Proactively runs the lazy notification syncs for every active teacher and
 * parent, so PAYMENT_DUE / MONTHLY_RECAP / SUBMISSION_MISSING notifications
 * (and their pushes) are created ahead of the next time someone opens the
 * bell, instead of only on-read. Safe to call repeatedly — every sync
 * function below is deduped via Notification.dedupeKey, so re-running this
 * (e.g. after a process restart) never creates duplicate rows or re-sends
 * push notifications for an event already delivered.
 */
export async function runDailyNotificationSync(): Promise<void> {
  const teachers = await prisma.user.findMany({ where: { role: "TEACHER", status: "ACTIVE" }, select: { id: true } });
  for (const { id } of teachers) {
    await syncPaymentDueNotifications(id);
    await syncMonthlyRecapNotifications(id);
  }

  const parents = await prisma.user.findMany({ where: { role: "PARENT", status: "ACTIVE" }, select: { id: true } });
  for (const { id } of parents) {
    await syncPaymentDueNotificationsForParent(id);
    await syncSubmissionMissingNotificationsForParent(id);
  }
}
```

This compiles without new imports: `syncPaymentDueNotificationsForParent` and `syncSubmissionMissingNotificationsForParent` are private (unexported) functions already defined earlier in this same file, so `runDailyNotificationSync` can call them directly since it lives in the same module.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd server && npx vitest run src/services/notification.service.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full server test suite to check for regressions**

```bash
cd server && npx vitest run
```
Expected: PASS (all existing + new tests).

- [ ] **Step 7: Commit**

```bash
git add server/src/services/notification.service.ts server/src/services/notification.service.test.ts
git commit -m "feat: send push notifications from createNotification, add daily sync"
```

---

## Task 3: Daily sync job scheduler

**Files:**
- Create: `server/src/jobs/dailyNotificationSync.job.ts`
- Test: `server/src/jobs/dailyNotificationSync.job.test.ts`
- Modify: `server/src/server.ts`

**Interfaces:**
- Consumes: `runDailyNotificationSync()` from Task 2's `notification.service.ts`.
- Produces: `startDailyNotificationSyncJob(): void`, called once from `server.ts`.

- [ ] **Step 1: Write the failing test**

Create `server/src/jobs/dailyNotificationSync.job.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

const { runDailyNotificationSyncMock } = vi.hoisted(() => ({
  runDailyNotificationSyncMock: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/notification.service.js", () => ({ runDailyNotificationSync: runDailyNotificationSyncMock }));

const { startDailyNotificationSyncJob } = await import("./dailyNotificationSync.job.js");

afterEach(() => {
  vi.useRealTimers();
  runDailyNotificationSyncMock.mockClear();
});

describe("startDailyNotificationSyncJob", () => {
  it("does not run the sync immediately on start", () => {
    vi.useFakeTimers();
    startDailyNotificationSyncJob();
    expect(runDailyNotificationSyncMock).not.toHaveBeenCalled();
  });

  it("runs the sync every 24 hours", () => {
    vi.useFakeTimers();
    startDailyNotificationSyncJob();

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(runDailyNotificationSyncMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(runDailyNotificationSyncMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd server && npx vitest run src/jobs/dailyNotificationSync.job.test.ts
```
Expected: FAIL — `Cannot find module './dailyNotificationSync.job.js'`.

- [ ] **Step 3: Implement `server/src/jobs/dailyNotificationSync.job.ts`**

```typescript
import { runDailyNotificationSync } from "../services/notification.service.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the recurring daily sync that proactively creates (and pushes)
 * PAYMENT_DUE / MONTHLY_RECAP / SUBMISSION_MISSING notifications, instead of
 * only generating them lazily when a bell is opened. Runs on a plain
 * setInterval since the deploy is a single always-on process (render.yaml
 * has no separate worker/cron service), and every underlying sync function
 * is already idempotent via Notification.dedupeKey — so no extra
 * "already ran today" guard is needed, even across process restarts.
 */
export function startDailyNotificationSyncJob(): void {
  setInterval(() => {
    runDailyNotificationSync().catch((err) => {
      console.error("[push] daily notification sync failed", err);
    });
  }, ONE_DAY_MS);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd server && npx vitest run src/jobs/dailyNotificationSync.job.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it into `server.ts`**

Replace the full contents of `server/src/server.ts` with:

```typescript
import { app } from "./app.js";
import { env } from "./utils/env.js";
import { startDailyNotificationSyncJob } from "./jobs/dailyNotificationSync.job.js";

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
  startDailyNotificationSyncJob();
});
```

- [ ] **Step 6: Run the full server test suite to check for regressions**

```bash
cd server && npx vitest run
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/jobs/dailyNotificationSync.job.ts server/src/jobs/dailyNotificationSync.job.test.ts server/src/server.ts
git commit -m "feat: schedule daily notification sync job"
```

---

## Task 4: HTTP endpoints for push subscription

**Files:**
- Create: `server/src/controllers/push.controller.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/routes/teacher.routes.ts`
- Modify: `server/src/routes/parent.routes.ts`
- Modify: `server/.env.example`
- Modify: `render.yaml`

**Interfaces:**
- Consumes: `saveSubscription`, `removeSubscription` from Task 1's `push.service.ts`; `vapidPublicKey` from Task 1's `vapid.ts`.
- Produces: `GET /api/push/public-key` (unauthenticated), `POST /teacher/push/subscribe` + `DELETE /teacher/push/subscribe`, `POST /parent/push/subscribe` + `DELETE /parent/push/subscribe` — consumed by Task 5's client API layer.

No automated test is added for this task: the codebase currently has zero HTTP/controller-layer test coverage anywhere (every existing controller — `notification.controller.ts`, `teacher.controller.ts`, etc. — is untested; only services are unit-tested), so introducing a one-off testing tool (e.g. supertest) here would be an inconsistent, unreviewed new convention. Manual `curl` verification is included instead (Step 6).

- [ ] **Step 1: Implement `server/src/controllers/push.controller.ts`**

```typescript
import type { Request, Response } from "express";
import { vapidPublicKey } from "../utils/vapid.js";
import { removeSubscription, saveSubscription } from "../services/push.service.js";

export function getPushPublicKeyHandler(_req: Request, res: Response) {
  if (!vapidPublicKey) {
    res.status(404).json({ error: "Les notifications push ne sont pas configurées sur ce serveur." });
    return;
  }
  res.json({ publicKey: vapidPublicKey });
}

export async function subscribePushHandler(req: Request, res: Response) {
  const { endpoint, keys } = req.body ?? {};
  if (typeof endpoint !== "string" || !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
    res.status(400).json({ error: "Abonnement push invalide." });
    return;
  }

  await saveSubscription(req.user!.id, { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
  res.status(204).send();
}

export async function unsubscribePushHandler(req: Request, res: Response) {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint !== "string") {
    res.status(400).json({ error: "Un endpoint est requis." });
    return;
  }

  await removeSubscription(endpoint);
  res.status(204).send();
}
```

- [ ] **Step 2: Mount the unauthenticated public-key route in `app.ts`**

In `server/src/app.ts`, add the import:

```typescript
import { getPushPublicKeyHandler } from "./controllers/push.controller.js";
```

Then add the route right after the existing health route:

```typescript
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/push/public-key", getPushPublicKeyHandler);
```

- [ ] **Step 3: Add teacher subscribe/unsubscribe routes**

In `server/src/routes/teacher.routes.ts`, add to the notification controller import block:

```typescript
import {
  getNotifications,
  readAllNotificationsHandler,
  readNotificationHandler,
} from "../controllers/notification.controller.js";
import { subscribePushHandler, unsubscribePushHandler } from "../controllers/push.controller.js";
```

Then add, right after the existing notification routes:

```typescript
teacherRouter.get("/notifications", getNotifications);
teacherRouter.post("/notifications/:id/read", readNotificationHandler);
teacherRouter.post("/notifications/read-all", readAllNotificationsHandler);

teacherRouter.post("/push/subscribe", subscribePushHandler);
teacherRouter.delete("/push/subscribe", unsubscribePushHandler);
```

- [ ] **Step 4: Add parent subscribe/unsubscribe routes**

In `server/src/routes/parent.routes.ts`, add to the import block:

```typescript
import {
  getParentNotifications,
  readAllParentNotificationsHandler,
  readParentNotificationHandler,
} from "../controllers/notification.controller.js";
import { subscribePushHandler, unsubscribePushHandler } from "../controllers/push.controller.js";
```

Then add, right after the existing notification routes:

```typescript
parentRouter.get("/notifications", getParentNotifications);
parentRouter.post("/notifications/:id/read", readParentNotificationHandler);
parentRouter.post("/notifications/read-all", readAllParentNotificationsHandler);

parentRouter.post("/push/subscribe", subscribePushHandler);
parentRouter.delete("/push/subscribe", unsubscribePushHandler);
```

- [ ] **Step 5: Document the new env vars**

In `server/.env.example`, add after the `SUPABASE_STORAGE_BUCKET` block at the end of the file:

```
# --- Optional: web push notifications (native Web Push, no third-party service) ---
# Generate a key pair once with `npx web-push generate-vapid-keys` and paste
# the values below. If left unset, push notifications are disabled — the
# rest of the app (including in-app notifications) works unchanged.
# VAPID_PUBLIC_KEY=""
# VAPID_PRIVATE_KEY=""
# VAPID_SUBJECT="mailto:you@example.com"
```

In `render.yaml`, add to the `envVars` list, after the `MAIL_FROM` entry:

```yaml
      - key: VAPID_PUBLIC_KEY
        sync: false
      - key: VAPID_PRIVATE_KEY
        sync: false
      - key: VAPID_SUBJECT
        sync: false
```

- [ ] **Step 6: Manual verification**

Start the server locally (`npm run dev:server`) and confirm the public-key endpoint responds correctly in both configurations:

```bash
# Without VAPID_* set (default local .env) — expect 404 with the French error body:
curl -i http://localhost:4000/api/push/public-key

# After setting VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT in .env and
# restarting — expect 200 with {"publicKey":"..."}:
curl -i http://localhost:4000/api/push/public-key
```

- [ ] **Step 7: Run the full server test suite to check for regressions**

```bash
cd server && npx vitest run
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/controllers/push.controller.ts server/src/app.ts server/src/routes/teacher.routes.ts server/src/routes/parent.routes.ts server/.env.example render.yaml
git commit -m "feat: add push subscription HTTP endpoints"
```

---

## Task 5: Client API layer and `pushKey` helper

**Files:**
- Create: `client/src/lib/pushKey.ts`
- Test: `client/src/lib/pushKey.test.ts`
- Modify: `client/src/api/types.ts`
- Create: `client/src/api/push.ts`
- Modify: `client/src/api/client.ts`
- Modify: `client/src/api/teacher.ts`
- Modify: `client/src/api/parent.ts`

**Interfaces:**
- Produces: `urlBase64ToUint8Array(base64String: string): Uint8Array` from `client/src/lib/pushKey.ts`, consumed by Task 6's `usePushSubscription` hook.
- Produces: `fetchVapidPublicKey(): Promise<string | null>` from `client/src/api/push.ts`; `subscribeToPush(payload: PushSubscriptionPayload): Promise<void>` and `unsubscribeFromPush(endpoint: string): Promise<void>` from both `client/src/api/teacher.ts` and `client/src/api/parent.ts` — all consumed by Task 6's `usePushSubscription` hook.
- Produces: `PushSubscriptionPayload` type (`{ endpoint: string; keys: { p256dh: string; auth: string } }`) from `client/src/api/types.ts`.

- [ ] **Step 1: Write the failing test for `pushKey.ts`**

Create `client/src/lib/pushKey.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./pushKey";

describe("urlBase64ToUint8Array", () => {
  it("decodes a base64url string with no special characters", () => {
    // "hello" -> base64 "aGVsbG8=" -> base64url "aGVsbG8" (padding stripped)
    const result = urlBase64ToUint8Array("aGVsbG8");
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  it("handles base64url's - and _ characters and restores stripped padding", () => {
    // Bytes [251, 255, 191] base64-encode to "+/+/"; as base64url that's "-_-_".
    const result = urlBase64ToUint8Array("-_-_");
    expect(Array.from(result)).toEqual([251, 255, 191]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd client && npx vitest run src/lib/pushKey.test.ts
```
Expected: FAIL — `Cannot find module './pushKey'`.

- [ ] **Step 3: Implement `client/src/lib/pushKey.ts`**

```typescript
/**
 * Converts the VAPID public key (base64url, as returned by the server) into
 * the Uint8Array shape the Push API's `applicationServerKey` option expects.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd client && npx vitest run src/lib/pushKey.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Add `PushSubscriptionPayload` to `client/src/api/types.ts`**

Add, right after the existing `NotificationsResponse` interface:

```typescript
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
```

- [ ] **Step 6: Create `client/src/api/push.ts`**

```typescript
import { api } from "./client";

/**
 * Fetches the server's VAPID public key. Returns null both when the request
 * fails for network reasons and when the server responds 404 (push not
 * configured on this deploy) — callers treat both cases identically: push is
 * unavailable.
 */
export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const { data } = await api.get<{ publicKey: string }>("/push/public-key");
    return data.publicKey;
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: Silence the expected 404 in `client/src/api/client.ts`**

`/push/public-key` returning 404 when push isn't configured is an expected, silent part of the flow (mirrors `/auth/me`'s pre-login 404), not an error worth toasting. Add it to `SILENT_ERROR_PREFIXES`:

```typescript
const SILENT_ERROR_PREFIXES = [
  "/auth/me",
  "/auth/login",
  "/auth/register",
  "/auth/change-password",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/push/public-key",
];
```

- [ ] **Step 8: Add subscribe/unsubscribe functions to `client/src/api/teacher.ts`**

Add `PushSubscriptionPayload` to the existing type import block, and add these two functions near `fetchNotifications`/`markNotificationRead`:

```typescript
export async function subscribeToPush(payload: PushSubscriptionPayload): Promise<void> {
  await api.post("/teacher/push/subscribe", payload);
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  await api.delete("/teacher/push/subscribe", { data: { endpoint } });
}
```

- [ ] **Step 9: Add subscribe/unsubscribe functions to `client/src/api/parent.ts`**

Add `PushSubscriptionPayload` to the existing type import block, and add:

```typescript
export async function subscribeToPush(payload: PushSubscriptionPayload): Promise<void> {
  await api.post("/parent/push/subscribe", payload);
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  await api.delete("/parent/push/subscribe", { data: { endpoint } });
}
```

- [ ] **Step 10: Run the full client test suite to check for regressions**

```bash
cd client && npx vitest run
```
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add client/src/lib/pushKey.ts client/src/lib/pushKey.test.ts client/src/api/types.ts client/src/api/push.ts client/src/api/client.ts client/src/api/teacher.ts client/src/api/parent.ts
git commit -m "feat: add client push API layer and base64url key helper"
```

---

## Task 6: Service worker and `usePushSubscription` hook

**Files:**
- Create: `client/public/sw.js`
- Create: `client/src/hooks/usePushSubscription.ts`

**Interfaces:**
- Consumes: `fetchVapidPublicKey` from Task 5's `api/push.ts`; `subscribeToPush`/`unsubscribeFromPush` from Task 5's `api/teacher.ts` and `api/parent.ts`; `urlBase64ToUint8Array` from Task 5's `lib/pushKey.ts`.
- Produces: `usePushSubscription(role: "teacher" | "parent"): { status: PushStatus; enable: () => Promise<void>; disable: () => Promise<void> }`, consumed by Task 7's `PushToggle.tsx`. `PushStatus = "unsupported" | "unconfigured" | "denied" | "unsubscribed" | "subscribed" | "loading"`.

No automated test is added for this hook: jsdom (this project's test environment — see `client/vitest.config.ts`) has no real `ServiceWorker`/`PushManager`/`Notification.requestPermission` implementation, so a unit test here would only be testing hand-rolled mocks calling each other, not real behavior. Coverage instead comes from `pushKey.test.ts` (Task 5, the one pure/testable piece of this flow) and `PushToggle.test.tsx` (Task 7, which mocks this hook entirely and tests the UI states it drives). Manual verification: Step 4 below.

- [ ] **Step 1: Create `client/public/sw.js`**

```javascript
// Minimal service worker for Web Push. Registered by usePushSubscription.ts.
// Not built/bundled — served as a static file from client/public/, so it
// stays plain ES2017-compatible JavaScript (no TypeScript, no imports).

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.svg",
      data: { link: payload.link ?? null },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data && event.notification.data.link;
  if (link) {
    event.waitUntil(clients.openWindow(link));
  }
});
```

- [ ] **Step 2: Create `client/src/hooks/usePushSubscription.ts`**

```typescript
import { useCallback, useEffect, useState } from "react";
import { fetchVapidPublicKey } from "../api/push";
import {
  subscribeToPush as subscribeToPushTeacher,
  unsubscribeFromPush as unsubscribeFromPushTeacher,
} from "../api/teacher";
import {
  subscribeToPush as subscribeToPushParent,
  unsubscribeFromPush as unsubscribeFromPushParent,
} from "../api/parent";
import { urlBase64ToUint8Array } from "../lib/pushKey";

export type PushStatus = "unsupported" | "unconfigured" | "denied" | "unsubscribed" | "subscribed" | "loading";

function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

export function usePushSubscription(role: "teacher" | "parent") {
  const [status, setStatus] = useState<PushStatus>("loading");
  const subscribeToPush = role === "parent" ? subscribeToPushParent : subscribeToPushTeacher;
  const unsubscribeFromPush = role === "parent" ? unsubscribeFromPushParent : unsubscribeFromPushTeacher;

  // Derives the displayed state from Notification.permission on every mount
  // so the toggle self-corrects if the user changes the permission outside
  // the app (e.g. via the browser's site settings).
  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const existing = await registration.pushManager.getSubscription();
    setStatus(existing ? "subscribed" : "unsubscribed");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }

    const publicKey = await fetchVapidPublicKey();
    if (!publicKey) {
      setStatus("unconfigured");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "unsubscribed");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const json = subscription.toJSON();
    await subscribeToPush({
      endpoint: json.endpoint!,
      keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
    });
    setStatus("subscribed");
  }, [subscribeToPush]);

  const disable = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await unsubscribeFromPush(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setStatus("unsubscribed");
  }, [unsubscribeFromPush]);

  return { status, enable, disable };
}
```

- [ ] **Step 3: Type-check the client build**

```bash
cd client && npx tsc -b --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual verification (deferred to end of Task 7)**

Full manual browser verification (subscribe, receive a push with the tab closed, click the notification) is combined with Task 7's Step 6, once the UI toggle exists to drive `enable()`/`disable()`.

- [ ] **Step 5: Commit**

```bash
git add client/public/sw.js client/src/hooks/usePushSubscription.ts
git commit -m "feat: add service worker and usePushSubscription hook"
```

---

## Task 7: `PushToggle` UI component and `AppLayout` wiring

**Files:**
- Create: `client/src/components/PushToggle.tsx`
- Test: `client/src/components/PushToggle.test.tsx`
- Modify: `client/src/components/AppLayout.tsx`

**Interfaces:**
- Consumes: `usePushSubscription(role)` from Task 6's `hooks/usePushSubscription.ts`.
- Produces: `<PushToggle role={"teacher" | "parent"} />`, rendered next to `<NotificationBell role={...} />` in `AppLayout.tsx`.

- [ ] **Step 1: Write the failing test**

Create `client/src/components/PushToggle.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushToggle } from "./PushToggle";

const { usePushSubscriptionMock } = vi.hoisted(() => ({ usePushSubscriptionMock: vi.fn() }));
vi.mock("../hooks/usePushSubscription", () => ({ usePushSubscription: usePushSubscriptionMock }));

afterEach(() => {
  cleanup();
  usePushSubscriptionMock.mockReset();
});

describe("PushToggle", () => {
  it("renders nothing when the browser doesn't support push", () => {
    usePushSubscriptionMock.mockReturnValue({ status: "unsupported", enable: vi.fn(), disable: vi.fn() });
    const { container } = render(<PushToggle role="teacher" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an inline message when permission was denied", () => {
    usePushSubscriptionMock.mockReturnValue({ status: "denied", enable: vi.fn(), disable: vi.fn() });
    render(<PushToggle role="teacher" />);
    expect(screen.getByText(/notifications bloquées/i)).toBeInTheDocument();
  });

  it("shows a subscribe button and calls enable() when not yet subscribed", async () => {
    const user = userEvent.setup();
    const enable = vi.fn();
    usePushSubscriptionMock.mockReturnValue({ status: "unsubscribed", enable, disable: vi.fn() });
    render(<PushToggle role="parent" />);

    const button = screen.getByRole("button", { name: "Activer les notifications push" });
    await user.click(button);

    expect(enable).toHaveBeenCalledTimes(1);
  });

  it("shows a subscribed state and calls disable() when already subscribed", async () => {
    const user = userEvent.setup();
    const disable = vi.fn();
    usePushSubscriptionMock.mockReturnValue({ status: "subscribed", enable: vi.fn(), disable });
    render(<PushToggle role="parent" />);

    const button = screen.getByRole("button", { name: "Désactiver les notifications push" });
    await user.click(button);

    expect(disable).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd client && npx vitest run src/components/PushToggle.test.tsx
```
Expected: FAIL — `Cannot find module './PushToggle'`.

- [ ] **Step 3: Implement `client/src/components/PushToggle.tsx`**

```tsx
import { Bell, BellOff } from "lucide-react";
import { usePushSubscription } from "../hooks/usePushSubscription";

export function PushToggle({ role }: { role: "teacher" | "parent" }) {
  const { status, enable, disable } = usePushSubscription(role);

  if (status === "unsupported" || status === "loading" || status === "unconfigured") return null;

  if (status === "denied") {
    return (
      <p className="text-xs text-ink-400">
        Notifications bloquées — activez-les dans les paramètres de votre navigateur.
      </p>
    );
  }

  const subscribed = status === "subscribed";

  return (
    <button
      type="button"
      onClick={() => (subscribed ? disable() : enable())}
      className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink-500 transition-colors hover:bg-canvas hover:text-ink-700"
      aria-label={subscribed ? "Désactiver les notifications push" : "Activer les notifications push"}
      aria-pressed={subscribed}
    >
      {subscribed ? (
        <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <BellOff className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd client && npx vitest run src/components/PushToggle.test.tsx
```
Expected: PASS (4 tests).

- [ ] **Step 5: Wire `PushToggle` into `AppLayout.tsx`**

In `client/src/components/AppLayout.tsx`, add the import:

```typescript
import { PushToggle } from "./PushToggle";
```

Then replace the mobile-header notification block:

```tsx
{notifications && <NotificationBell role={notifications} />}
```

with:

```tsx
{notifications && (
  <div className="flex items-center gap-1">
    <PushToggle role={notifications} />
    <NotificationBell role={notifications} />
  </div>
)}
```

And replace the desktop-header notification block:

```tsx
{notifications && (
  <div className="hidden items-center justify-end border-b border-border bg-surface px-8 py-3 lg:flex">
    <NotificationBell role={notifications} />
  </div>
)}
```

with:

```tsx
{notifications && (
  <div className="hidden items-center justify-end gap-1 border-b border-border bg-surface px-8 py-3 lg:flex">
    <PushToggle role={notifications} />
    <NotificationBell role={notifications} />
  </div>
)}
```

- [ ] **Step 6: Manual browser verification**

With `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` set locally and both `npm run dev:server` and `npm run dev:client` running:

1. Log in as the seeded test teacher (`test.teacher@bachandi.app`, see `server/prisma/seed-test-accounts.ts`).
2. Click the new push-toggle button next to the bell; accept the browser's permission prompt.
3. Confirm the icon switches to the "subscribed" (`Bell`) state.
4. Close the tab entirely.
5. From another session (e.g. as the seeded test pupil, or via the admin panel), trigger any event-driven notification for that teacher (e.g. mark the seeded pupil absent, which creates an `ABSENCE`-adjacent flow, or approve/decline something that notifies the teacher — any of `PUPIL_REQUEST`/`SWAP_REQUEST`/`PARENT_REQUEST` work).
6. Confirm a native OS notification appears even with the tab closed, and that clicking it opens/focuses the app at the expected link.

- [ ] **Step 7: Run the full client test suite to check for regressions**

```bash
cd client && npx vitest run
```
Expected: PASS (all existing + new tests).

- [ ] **Step 8: Run the full monorepo test suite**

```bash
npm test
```
Expected: PASS (server + client).

- [ ] **Step 9: Commit**

```bash
git add client/src/components/PushToggle.tsx client/src/components/PushToggle.test.tsx client/src/components/AppLayout.tsx
git commit -m "feat: add push notification toggle to authenticated header"
```

---

## Self-Review Notes

- **Spec coverage:** all 5 decisions, the full data model, every new file listed in the spec's "New Files" section, and every "Error Handling"/"Testing" requirement are each covered by a task above. `VISIT_REQUEST` and pupil-facing changes are untouched, matching "Out of Scope."
- **Documented deviations from the literal spec text** (both intentional, both called out here per the spec's own "no same-day guard needed" reasoning being an inference rather than explicit spec text):
  - The spec's job description says "with a same-day re-entry guard so a process restart doesn't double-fire." Task 3 implements a plain `setInterval` with no extra guard, because every notification created by the synced functions is already deduped via `Notification.dedupeKey` (verified in `notification.service.ts`) — a duplicate run creates zero duplicate rows and sends zero duplicate pushes. Adding a guard would be redundant defense-in-depth, not a correctness requirement.
  - No automated test for `push.controller.ts`/routes (Task 4) or `usePushSubscription.ts` (Task 6), each with an inline rationale matching an existing codebase-wide convention (zero controller test coverage) or a hard technical limitation (jsdom cannot fake `ServiceWorker`/`PushManager`).
- **Type consistency:** `PushPayload` (`push.service.ts`) and `PushSubscriptionPayload` (client `types.ts`) intentionally differ — the former is what the server sends *to* a device (`title`/`body`/`link`), the latter is what the client sends *to* the server when subscribing (`endpoint`/`keys`). `sendPushToUser(userId, payload)`, `saveSubscription(userId, sub)`, and `removeSubscription(endpoint)` signatures match everywhere they're declared (Task 1) and consumed (Tasks 2 and 4).

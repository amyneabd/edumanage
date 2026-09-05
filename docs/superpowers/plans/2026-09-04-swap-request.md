# Swap Request Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing single-session "visit request" feature with a "swap request" feature: a pupil proposes swapping one of their own scheduled sessions (origin) for a session in a different class (target); on teacher approval, the pupil's origin-date attendance is marked `EXCUSED` and they appear as a visitor on the target class's target date.

**Architecture:** Rename/replace `VisitRequest` → `SwapRequest` end-to-end: a new Prisma model with two named relations to `Class` (origin/target), a new `swap.service.ts` replacing `visit.service.ts`, updated controllers/routes, and a full client-side rename with new dual-date UI. Attendance gains an `EXCUSED` status, surfaced (not counted as absent) in the ledger and calendars.

**Tech Stack:** TypeScript, Express.js, Prisma (Postgres/Supabase), React, TanStack Query, Vitest, @testing-library/react, @testing-library/user-event.

**Spec:** `docs/superpowers/specs/2026-09-04-swap-request-design.md`

## Global Constraints

- No mocks in server tests — use the real Prisma client against the live dev database, self-cleaning via `beforeAll`/`afterAll`/`beforeEach` scoped by test-generated unique IDs (e.g. `` `test-x-${Date.now()}@example.com` ``).
- Client component tests use `vi.hoisted` + `vi.mock` with `importActual` spread + selective override, wrapped in `QueryClientProvider` via a local `renderWithClient` helper (see `VacationSessionsPanel.test.tsx`, `PupilLedgerModal.test.tsx`).
- `originClassId` on a swap request is never user-supplied — it is always derived server-side from the requesting pupil's `PupilProfile.classId` at request time.
- `EXCUSED` attendance is only ever set via swap approval — never directly markable by a teacher through the existing attendance endpoints.
- Follow existing file conventions: services throw a domain `Error` subclass carrying `.status`; controllers map errors via a shared `handleServiceError`-style helper; routes are thin.
- Run the relevant test suite (server: `npm test` from `server/`; client: `npm test` from `client/`) after every task and keep it green before committing.

---

### Task 1: Prisma schema migration — `SwapRequest` model, `EXCUSED` status

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `SwapRequestStatus` enum (`PENDING`, `APPROVED`, `DECLINED` — same values as old `VisitRequestStatus`, unchanged), `SwapRequest` model with fields `id`, `pupilId`, `originClassId`, `originDate`, `targetClassId`, `targetDate`, `reason`, `status`, `createdAt`, `updatedAt`, relations `pupil` (→ `PupilProfile`), `originClass` (→ `Class`, `@relation("SwapRequestOrigin")`), `targetClass` (→ `Class`, `@relation("SwapRequestTarget")`). `AttendanceStatus` enum gains `EXCUSED`. `NotificationType` enum gains `SWAP_REQUEST` (inserted after `VISIT_REQUEST`, no other values touched). `PupilProfile.swapRequests: SwapRequest[]`. `Class.swapRequestsOrigin: SwapRequest[]` and `Class.swapRequestsTarget: SwapRequest[]`.
- Consumes: nothing (first task).

**CORRECTION (post-Task-1-review):** the original code blocks below for `NotificationType` and `VisitRequestStatus` did not match the actual repo content and have been corrected. The real original `NotificationType` enum is `PUPIL_REQUEST, EXAM_SUBMISSION, PAYMENT_DUE, MONTHLY_RECAP, VISIT_REQUEST, PARENT_REQUEST, POST_PUBLISHED, ABSENCE, SUBMISSION_MISSING` — only `SWAP_REQUEST` is inserted, nothing else changes. The real original `VisitRequestStatus` enum is `PENDING, APPROVED, DECLINED` (3 values, no `CANCELLED`) — the spec's `cancelSwapRequest` always deletes the row rather than setting a cancelled status, so no `CANCELLED` value is ever needed; `SwapRequestStatus` keeps exactly those 3 values.

This is a DDL-only task — there is no failing test to write first. Implement the schema changes, run the migration, then run the full server test suite to confirm no regression (nothing currently exercises `visit.service.ts` directly, so dropping `VisitRequest` is safe at this point).

- [ ] **Step 1: Edit `NotificationType` enum** — insert `SWAP_REQUEST` immediately after `VISIT_REQUEST`, leaving every other existing value untouched:

```prisma
enum NotificationType {
  PUPIL_REQUEST
  EXAM_SUBMISSION
  PAYMENT_DUE
  MONTHLY_RECAP
  VISIT_REQUEST
  SWAP_REQUEST
  PARENT_REQUEST
  POST_PUBLISHED
  ABSENCE
  SUBMISSION_MISSING
}
```

- [ ] **Step 2: Edit `AttendanceStatus` enum** (currently lines 54-57) to add `EXCUSED`:

```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
  EXCUSED
}
```

- [ ] **Step 3: Rename `VisitRequestStatus` to `SwapRequestStatus`** (currently lines 59-63), values unchanged (3 values, no `CANCELLED`):

```prisma
enum SwapRequestStatus {
  PENDING
  APPROVED
  DECLINED
}
```

- [ ] **Step 4: Rename `PupilProfile.visitRequests` field** (currently line 139):

```prisma
  swapRequests    SwapRequest[]
```

- [ ] **Step 5: Replace `Class.visitRequests` field** (currently line 177) with two named-relation fields:

```prisma
  swapRequestsOrigin SwapRequest[] @relation("SwapRequestOrigin")
  swapRequestsTarget SwapRequest[] @relation("SwapRequestTarget")
```

- [ ] **Step 6: Replace the `VisitRequest` model** (currently lines 280-294) with the `SwapRequest` model:

```prisma
model SwapRequest {
  id            String            @id @default(cuid())
  pupilId       String
  pupil         PupilProfile      @relation(fields: [pupilId], references: [userId], onDelete: Cascade)
  originClassId String
  originClass   Class             @relation("SwapRequestOrigin", fields: [originClassId], references: [id], onDelete: Cascade)
  originDate    DateTime
  targetClassId String
  targetClass   Class             @relation("SwapRequestTarget", fields: [targetClassId], references: [id], onDelete: Cascade)
  targetDate    DateTime
  reason        String?
  status        SwapRequestStatus @default(PENDING)
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@index([pupilId])
  @@index([originClassId])
  @@index([targetClassId])
}
```

- [ ] **Step 7: Run the migration**

Run (from `server/`): `npx prisma migrate dev --name swap_requests`

Expected: migration applies cleanly, Prisma Client regenerates. If prompted about data loss on the dropped `VisitRequest` table, confirm — this is expected and intentional.

- [ ] **Step 8: Run the full server test suite to confirm no regression**

Run: `npm test` (from `server/`)

Expected: all existing tests PASS (nothing currently references `prisma.visitRequest` or `VisitRequestStatus` in a test file).

- [ ] **Step 9: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(db): replace VisitRequest with SwapRequest, add EXCUSED attendance status"
```

---

### Task 2: `server/src/services/swap.service.ts` — core swap logic

**Files:**
- Create: `server/src/services/swap.service.ts`
- Create: `server/src/services/swap.service.test.ts`
- Reference (read-only, do not modify): `server/src/services/visit.service.ts` (template being replaced in Task 8), `server/src/services/notification.service.ts` (for `createNotification` signature), `server/src/services/vacation.service.ts` (for `getVacationSessionForDate`)

**Interfaces:**
- Consumes: Prisma models `SwapRequest`, `PupilProfile`, `Class`, `AttendanceRecord` (Task 1). `getVacationSessionForDate(classId: string, date: Date): Promise<VacationSession | null>` from `./vacation.service.js`. `createNotification(input: CreateNotificationInput): Promise<Notification>` from `./notification.service.js`, where `CreateNotificationInput = { type: NotificationType; title: string; body: string; link?: string; dedupeKey?: string } & ({ teacherId: string; parentId?: undefined } | { parentId: string; teacherId?: undefined })`.
- Produces: `class SwapError extends Error { status: number }`; `listOtherClassesForPupil(pupilId: string): Promise<...>`; `createSwapRequest(pupilId: string, input: { originDate: string; targetClassId: string; targetDate: string; reason?: string }): Promise<SwapRequest>`; `listOwnSwapRequests(pupilId: string): Promise<SwapRequest[]>`; `cancelSwapRequest(pupilId: string, id: string): Promise<void>`; `listSwapRequestsForTeacher(teacherId: string, status?: SwapRequestStatus): Promise<...>`; `respondToSwapRequest(teacherId: string, id: string, status: "APPROVED" | "DECLINED"): Promise<SwapRequest>` — these names/signatures are relied on by Task 7 (pupil controller) and Task 8 (teacher controller).

- [ ] **Step 1: Write the failing tests**

Create `server/src/services/swap.service.test.ts`:

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../utils/prisma.js";
import { hashPassword } from "../utils/password.js";
import {
  SwapError,
  listOtherClassesForPupil,
  createSwapRequest,
  listOwnSwapRequests,
  cancelSwapRequest,
  listSwapRequestsForTeacher,
  respondToSwapRequest,
} from "./swap.service.js";

const TEST_TAG = `swap-${Date.now()}`;
let teacherId: string;
let originClassId: string;
let targetClassId: string;
let otherTeacherClassId: string;
let otherTeacherId: string;
let pupilId: string;

function nextWeekday(dayOfWeek: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
  return d;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

beforeAll(async () => {
  const passwordHash = await hashPassword("initial-Pass1");

  const teacher = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-teacher@example.com`,
      passwordHash,
      name: "Swap Test Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `SWT${Date.now()}` } },
    },
  });
  teacherId = teacher.id;

  const originClass = await prisma.class.create({
    data: { teacherId, name: "Origin Class", type: "MATH", monthlyFee: 100 },
  });
  originClassId = originClass.id;
  await prisma.scheduleSlot.create({ data: { classId: originClassId, dayOfWeek: 1, startTime: "09:00", endTime: "10:00" } });

  const targetClass = await prisma.class.create({
    data: { teacherId, name: "Target Class", type: "MATH", monthlyFee: 100 },
  });
  targetClassId = targetClass.id;
  await prisma.scheduleSlot.create({ data: { classId: targetClassId, dayOfWeek: 3, startTime: "11:00", endTime: "12:00" } });

  const otherTeacher = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-other-teacher@example.com`,
      passwordHash,
      name: "Other Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `SWO${Date.now()}` } },
    },
  });
  otherTeacherId = otherTeacher.id;
  const otherClass = await prisma.class.create({
    data: { teacherId: otherTeacherId, name: "Other Teacher Class", type: "MATH", monthlyFee: 100 },
  });
  otherTeacherClassId = otherClass.id;
  await prisma.scheduleSlot.create({ data: { classId: otherTeacherClassId, dayOfWeek: 2, startTime: "09:00", endTime: "10:00" } });

  const pupil = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-pupil@example.com`,
      passwordHash,
      name: "Swap Test Pupil",
      role: "PUPIL",
      status: "ACTIVE",
      pupilProfile: {
        create: { requestedType: "MATH", teacherId, classId: originClassId, parentCode: `SWP${Date.now()}` },
      },
    },
  });
  pupilId = pupil.id;
});

afterAll(async () => {
  await prisma.swapRequest.deleteMany({ where: { pupilId } });
  await prisma.attendanceRecord.deleteMany({ where: { pupilId } });
  await prisma.user.delete({ where: { id: pupilId } }).catch(() => {});
  await prisma.class.deleteMany({ where: { teacherId: { in: [teacherId, otherTeacherId] } } });
  await prisma.user.delete({ where: { id: teacherId } }).catch(() => {});
  await prisma.user.delete({ where: { id: otherTeacherId } }).catch(() => {});
});

beforeEach(async () => {
  await prisma.swapRequest.deleteMany({ where: { pupilId } });
  await prisma.attendanceRecord.deleteMany({ where: { pupilId } });
});

describe("listOtherClassesForPupil", () => {
  it("excludes the pupil's own class and classes from other teachers", async () => {
    const classes = await listOtherClassesForPupil(pupilId);
    const ids = classes.map((c) => c.id);
    expect(ids).toContain(targetClassId);
    expect(ids).not.toContain(originClassId);
    expect(ids).not.toContain(otherTeacherClassId);
  });
});

describe("createSwapRequest", () => {
  it("throws when the pupil has no profile", async () => {
    await expect(
      createSwapRequest("not-a-pupil", {
        originDate: dateKey(nextWeekday(1)),
        targetClassId,
        targetDate: dateKey(nextWeekday(3)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when originDate is not a real scheduled session of the pupil's class", async () => {
    const badOrigin = nextWeekday(2); // Tuesday: origin class meets Monday only
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(badOrigin),
        targetClassId,
        targetDate: dateKey(nextWeekday(3)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when targetClassId belongs to a different teacher", async () => {
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(nextWeekday(1)),
        targetClassId: otherTeacherClassId,
        targetDate: dateKey(nextWeekday(2)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when targetClassId is the pupil's own class", async () => {
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(nextWeekday(1)),
        targetClassId: originClassId,
        targetDate: dateKey(nextWeekday(1)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when targetDate is not a real scheduled session of the target class", async () => {
    const badTarget = nextWeekday(4); // Thursday: target class meets Wednesday only
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(nextWeekday(1)),
        targetClassId,
        targetDate: dateKey(badTarget),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when originDate is in the past", async () => {
    const past = new Date();
    past.setDate(past.getDate() - 7);
    while (past.getDay() !== 1) past.setDate(past.getDate() - 1);
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(past),
        targetClassId,
        targetDate: dateKey(nextWeekday(3)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("creates a PENDING swap request when all validations pass", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
      reason: "Doctor appointment",
    });
    expect(request.status).toBe("PENDING");
    expect(request.pupilId).toBe(pupilId);
    expect(request.originClassId).toBe(originClassId);
    expect(request.targetClassId).toBe(targetClassId);
    expect(request.reason).toBe("Doctor appointment");
  });
});

describe("listOwnSwapRequests / cancelSwapRequest", () => {
  it("lists only the pupil's own requests, and cancel removes it", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });

    const list = await listOwnSwapRequests(pupilId);
    expect(list.some((r) => r.id === request.id)).toBe(true);

    await cancelSwapRequest(pupilId, request.id);

    const listAfter = await listOwnSwapRequests(pupilId);
    expect(listAfter.some((r) => r.id === request.id)).toBe(false);
  });

  it("throws when cancelling a request that isn't the pupil's own", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });
    await expect(cancelSwapRequest("someone-else", request.id)).rejects.toThrow(SwapError);
  });
});

describe("listSwapRequestsForTeacher / respondToSwapRequest", () => {
  it("lists pending requests for classes the teacher owns (as origin or target)", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });
    const list = await listSwapRequestsForTeacher(teacherId, "PENDING");
    expect(list.some((r) => r.id === request.id)).toBe(true);
  });

  it("approving marks origin-date attendance EXCUSED for the pupil", async () => {
    const originDate = nextWeekday(1);
    const targetDate = nextWeekday(3);
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(originDate),
      targetClassId,
      targetDate: dateKey(targetDate),
    });

    const approved = await respondToSwapRequest(teacherId, request.id, "APPROVED");
    expect(approved.status).toBe("APPROVED");

    const record = await prisma.attendanceRecord.findFirst({ where: { pupilId, classId: originClassId } });
    expect(record?.status).toBe("EXCUSED");
  });

  it("declining does not create an attendance record", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });

    const declined = await respondToSwapRequest(teacherId, request.id, "DECLINED");
    expect(declined.status).toBe("DECLINED");

    const record = await prisma.attendanceRecord.findFirst({ where: { pupilId, classId: originClassId } });
    expect(record).toBeNull();
  });

  it("throws when responding to a request for a class the teacher doesn't own", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });
    await expect(respondToSwapRequest(otherTeacherId, request.id, "APPROVED")).rejects.toThrow(SwapError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- swap.service` (from `server/`)

Expected: FAIL with "Cannot find module './swap.service.js'" or similar (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `server/src/services/swap.service.ts`:

```typescript
import { prisma } from "../utils/prisma.js";
import { notifyParentsOfPupil, createNotification } from "./notification.service.js";
import { getVacationSessionForDate } from "./vacation.service.js";
import type { SwapRequestStatus } from "@prisma/client";

export class SwapError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

async function getPupilWithClass(pupilId: string) {
  const pupil = await prisma.pupilProfile.findUnique({
    where: { userId: pupilId },
    include: { user: { select: { id: true, name: true } }, class: { include: { scheduleSlots: true } } },
  });
  if (!pupil) throw new SwapError("Pupil profile not found.", 404);
  if (!pupil.classId || !pupil.class) throw new SwapError("Pupil is not assigned to a class.", 400);
  return pupil;
}

async function isRealSession(classId: string, date: Date): Promise<boolean> {
  const vacationSession = await getVacationSessionForDate(classId, date);
  if (vacationSession) return true;
  const scheduleSlots = await prisma.scheduleSlot.findMany({ where: { classId } });
  return scheduleSlots.some((s) => s.dayOfWeek === date.getDay());
}

export async function listOtherClassesForPupil(pupilId: string) {
  const pupil = await getPupilWithClass(pupilId);
  return prisma.class.findMany({
    where: { teacherId: pupil.teacherId, id: { not: pupil.classId! } },
    include: { scheduleSlots: true },
    orderBy: { name: "asc" },
  });
}

export async function createSwapRequest(
  pupilId: string,
  input: { originDate: string; targetClassId: string; targetDate: string; reason?: string }
) {
  const pupil = await getPupilWithClass(pupilId);

  const originDate = parseDateKey(input.originDate);
  const targetDate = parseDateKey(input.targetDate);
  if (Number.isNaN(originDate.getTime()) || Number.isNaN(targetDate.getTime())) {
    throw new SwapError("Invalid date.", 400);
  }

  const today = startOfToday();
  if (originDate < today) throw new SwapError("Origin date must not be in the past.", 400);
  if (targetDate < today) throw new SwapError("Target date must not be in the past.", 400);

  const originIsReal = await isRealSession(pupil.classId!, originDate);
  if (!originIsReal) throw new SwapError("Origin date is not a scheduled session of your class.", 400);

  const targetClass = await prisma.class.findUnique({ where: { id: input.targetClassId } });
  if (!targetClass || targetClass.teacherId !== pupil.teacherId) {
    throw new SwapError("Target class not found.", 404);
  }
  if (targetClass.id === pupil.classId) {
    throw new SwapError("Target class must be different from your own class.", 400);
  }

  const targetIsReal = await isRealSession(targetClass.id, targetDate);
  if (!targetIsReal) throw new SwapError("Target date is not a scheduled session of the target class.", 400);

  const request = await prisma.swapRequest.create({
    data: {
      pupilId,
      originClassId: pupil.classId!,
      originDate,
      targetClassId: targetClass.id,
      targetDate,
      reason: input.reason,
      status: "PENDING",
    },
  });

  await createNotification({
    type: "SWAP_REQUEST",
    title: "New swap request",
    body: `${pupil.user.name} requested to swap into ${targetClass.name} on ${input.targetDate}.`,
    link: "/teacher/classes",
    teacherId: pupil.teacherId,
  });

  return request;
}

export async function listOwnSwapRequests(pupilId: string) {
  return prisma.swapRequest.findMany({
    where: { pupilId },
    include: { originClass: true, targetClass: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function cancelSwapRequest(pupilId: string, id: string) {
  const request = await prisma.swapRequest.findFirst({ where: { id, pupilId } });
  if (!request) throw new SwapError("Swap request not found.", 404);
  await prisma.swapRequest.delete({ where: { id } });
}

export async function listSwapRequestsForTeacher(teacherId: string, status?: SwapRequestStatus) {
  return prisma.swapRequest.findMany({
    where: {
      status,
      OR: [{ originClass: { teacherId } }, { targetClass: { teacherId } }],
    },
    include: { pupil: { include: { user: { select: { name: true } } } }, originClass: true, targetClass: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function respondToSwapRequest(teacherId: string, id: string, status: "APPROVED" | "DECLINED") {
  const request = await prisma.swapRequest.findFirst({
    where: { id, OR: [{ originClass: { teacherId } }, { targetClass: { teacherId } }] },
    include: { originClass: true, targetClass: true },
  });
  if (!request) throw new SwapError("Swap request not found.", 404);

  const updated = await prisma.swapRequest.update({ where: { id }, data: { status } });

  if (status === "APPROVED") {
    await prisma.attendanceRecord.upsert({
      where: { pupilId_date: { pupilId: request.pupilId, date: request.originDate } },
      create: { pupilId: request.pupilId, classId: request.originClassId, date: request.originDate, status: "EXCUSED" },
      update: { status: "EXCUSED" },
    });
  }

  await notifyParentsOfPupil(request.pupilId, {
    type: "SWAP_REQUEST",
    title: status === "APPROVED" ? "Swap request approved" : "Swap request declined",
    body:
      status === "APPROVED"
        ? `Your swap into ${request.targetClass.name} was approved.`
        : `Your swap into ${request.targetClass.name} was declined.`,
    link: "/parent/attendance",
    dedupeKey: `swap:${request.id}:${status}`,
  });

  return updated;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- swap.service` (from `server/`)

Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/swap.service.ts server/src/services/swap.service.test.ts
git commit -m "feat: add swap request service with origin/target session validation"
```

---

### Task 3: `attendance.service.ts` — surface `EXCUSED` in the calendar

**Files:**
- Modify: `server/src/services/attendance.service.ts:56-63,118-125`
- Modify: `server/src/services/attendance.service.test.ts`

**Interfaces:**
- Consumes: `AttendanceStatus` Prisma enum (now includes `EXCUSED`, from Task 1).
- Produces: `AttendanceCalendarDay.display` widened to `"FUTURE" | "TODAY" | "PRESENT" | "ABSENT" | "EXCUSED" | "UNMARKED"`; `AttendanceCalendarDay.record` widened to `"PRESENT" | "ABSENT" | "EXCUSED" | null`. Relied on by Task 18 (client calendar rendering) via the `/attendance/calendar` API shape.

- [ ] **Step 1: Write the failing test**

Add to `server/src/services/attendance.service.test.ts` (append inside the `describe("getAttendanceCalendar"` block — read the file first to find the exact insertion point and existing helpers `daysFromNow`/`dateKey`):

```typescript
  it("surfaces an EXCUSED record with display EXCUSED", async () => {
    const targetDate = daysFromNow(-1);
    await prisma.attendanceRecord.upsert({
      where: { pupilId_date: { pupilId, date: targetDate } },
      create: { pupilId, classId, date: targetDate, status: "EXCUSED" },
      update: { status: "EXCUSED" },
    });

    const calendar = await getAttendanceCalendar(teacherId, pupilId);
    const day = calendar.days.find((d) => d.date === dateKey(targetDate));
    expect(day?.record).toBe("EXCUSED");
    expect(day?.display).toBe("EXCUSED");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- attendance.service` (from `server/`)

Expected: FAIL — `day?.display` is `"UNMARKED"` because the current ternary in `buildAttendanceDays` doesn't recognize `"EXCUSED"`, and the Prisma call may fail type-checking against the enum until Task 1's migration is applied (it already is, from Task 1) — so this specifically fails on the assertion, not a type error.

- [ ] **Step 3: Update the implementation**

In `server/src/services/attendance.service.ts`, update the `AttendanceCalendarDay` type (currently lines 56-63):

```typescript
type AttendanceCalendarDay = {
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  display: "FUTURE" | "TODAY" | "PRESENT" | "ABSENT" | "EXCUSED" | "UNMARKED";
  record: "PRESENT" | "ABSENT" | "EXCUSED" | null;
};
```

Update the display ternary inside `buildAttendanceDays` (currently lines 118-125):

```typescript
    let display: "FUTURE" | "TODAY" | "PRESENT" | "ABSENT" | "EXCUSED" | "UNMARKED";
    if (key === todayKey) {
      display = "TODAY";
    } else if (date > today) {
      display = "FUTURE";
    } else {
      display =
        record === "PRESENT" ? "PRESENT" : record === "ABSENT" ? "ABSENT" : record === "EXCUSED" ? "EXCUSED" : "UNMARKED";
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- attendance.service` (from `server/`)

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/attendance.service.ts server/src/services/attendance.service.test.ts
git commit -m "feat: surface EXCUSED attendance status in the calendar view"
```

---

### Task 4: `payment.service.ts` — exclude `EXCUSED` from absence counts

**Files:**
- Modify: `server/src/services/payment.service.ts:198-255`
- Modify: `server/src/services/payment.service.test.ts`

**Interfaces:**
- Consumes: `AttendanceRecord.status` now possibly `"EXCUSED"` (Task 1).
- Produces: no change to `buildPupilLedger`'s external row shape — `present`/`absent` counts on each ledger row simply no longer count `EXCUSED` records as absent.

- [ ] **Step 1: Write the failing test**

Add to `server/src/services/payment.service.test.ts`, inside `describe("getPupilLedger"` (following the `dateInPeriod` helper pattern at lines 12-15, and the existing "includes attendance present/absent counts" test at lines 77-95):

```typescript
  it("does not count EXCUSED attendance records as absent", async () => {
    const period = previousPeriod(currentPeriod());
    await setPaymentStatus(teacherId, pupilId, { period, status: "PAID", amountDue: 100, amountPaid: 100 });
    await prisma.attendanceRecord.create({
      data: { pupilId, classId, date: dateInPeriod(period, 3), status: "PRESENT" },
    });
    await prisma.attendanceRecord.create({
      data: { pupilId, classId, date: dateInPeriod(period, 10), status: "EXCUSED" },
    });

    const ledger = await getPupilLedger(teacherId, pupilId);
    const row = ledger.rows.find((r) => r.period === period);
    expect(row).toBeDefined();
    expect(row?.present).toBe(1);
    expect(row?.absent).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- payment.service` (from `server/`)

Expected: FAIL — `row?.absent` is `1` because the current `else` branch in `buildPupilLedger`'s tally loop treats any non-`PRESENT` record as absent.

- [ ] **Step 3: Update the implementation**

In `server/src/services/payment.service.ts`, inside `buildPupilLedger`'s attendance tally loop (currently line 210), change:

```typescript
    if (record.status === "PRESENT") entry.present += 1;
    else entry.absent += 1;
```

to:

```typescript
    if (record.status === "PRESENT") entry.present += 1;
    else if (record.status === "ABSENT") entry.absent += 1;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- payment.service` (from `server/`)

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/payment.service.ts server/src/services/payment.service.test.ts
git commit -m "fix: exclude EXCUSED attendance from ledger absence counts"
```

---

### Task 5: `class.service.ts` — rename `visitRequests` → `swapRequestsTarget`

**Files:**
- Modify: `server/src/services/class.service.ts:40-58`

**Interfaces:**
- Consumes: `Class.swapRequestsTarget` relation (Task 1), `SwapRequest.targetDate` field (Task 1).
- Produces: `getClassDetail`'s returned `klass.swapVisitors` field (renamed from `visitRequests`) — relied on by Task 16 (`ClassDetailPage.tsx`).

**CORRECTION (post-Task-5-preflight-check):** The original text below assumed (a) the current query's `pupil` include only selects `{ name: true }`, and (b) `getClassDetail` already contains a separate return/mapping statement that renames a field. Both are wrong — verified by reading the real `server/src/services/class.service.ts:39-56` in this worktree: the real `pupil` include uses `select: safeUserSelect` (id/name/email/status/createdAt), and the function returns the raw Prisma result (`return klass;`) with no mapping step at all. The spec (`docs/superpowers/specs/2026-09-04-swap-request-design.md:174`) is explicit that this panel is "otherwise unchanged (still just target-side approved swaps for this class)" — i.e. this is a pure rename of the relation/field, NOT a reshape. Prisma's `include` does not support aliasing the result key to something other than the relation name, so producing a `swapVisitors` key (rather than `swapRequestsTarget`) requires an explicit destructure-and-rename after the query — that step did not previously exist and must be added, not "found."

This is a pure rename (relation name + one field name), reshaping nothing — no new test file needed; the change is covered by running the full suite. Read the current exact block in `server/src/services/class.service.ts` (inside `getClassDetail`) before editing:

```typescript
  const klass = await prisma.class.findFirst({
    where: { id: classId, teacherId },
    include: {
      pupils: { include: { user: { select: safeUserSelect }, payments: true } },
      scheduleSlots: true,
      visitRequests: {
        where: { status: "APPROVED", sessionDate: { gte: startOfToday } },
        include: { pupil: { include: { user: { select: safeUserSelect } } } },
        orderBy: { sessionDate: "asc" },
      },
    },
  });
  if (!klass) throw new ClassError("Class not found.", 404);
  return klass;
```

- [ ] **Step 1: Update the implementation**

In `server/src/services/class.service.ts`, replace the whole block above with:

```typescript
  const klass = await prisma.class.findFirst({
    where: { id: classId, teacherId },
    include: {
      pupils: { include: { user: { select: safeUserSelect }, payments: true } },
      scheduleSlots: true,
      swapRequestsTarget: {
        where: { status: "APPROVED", targetDate: { gte: startOfToday } },
        include: { pupil: { include: { user: { select: safeUserSelect } } } },
        orderBy: { targetDate: "asc" },
      },
    },
  });
  if (!klass) throw new ClassError("Class not found.", 404);
  const { swapRequestsTarget, ...rest } = klass;
  return { ...rest, swapVisitors: swapRequestsTarget };
```

(The relation is renamed `visitRequests` → `swapRequestsTarget` per Task 1's schema; the query's `where`/`orderBy` now reference `targetDate` instead of `sessionDate` per Task 1's `SwapRequest` model; the final two lines add the destructure-and-rename that didn't exist before, exposing the same array of objects — same nested `pupil.user` shape as before — under the key `swapVisitors` that Task 16 consumes.)

- [ ] **Step 2: Run the full server suite to confirm no regression**

Run: `npm test` (from `server/`)

Expected: PASS. (No existing test file directly asserts on `getClassDetail`'s visit fields per the codebase search done during planning; if one is found during implementation, update it to use `swapVisitors`/`targetDate` instead of `visitRequests`/`sessionDate`.)

- [ ] **Step 3: Commit**

```bash
git add server/src/services/class.service.ts
git commit -m "refactor: rename class visitRequests to swapVisitors"
```

---

### Task 6: `admin.service.ts` — rename `pendingVisitRequests` → `pendingSwapRequests`

**Files:**
- Modify: `server/src/services/admin.service.ts:74-109`

**Interfaces:**
- Consumes: `prisma.swapRequest.count` (Task 1).
- Produces: `getTeacherDetail`'s returned `pendingSwapRequests` field (renamed from `pendingVisitRequests`) — relied on by Task 17 (`TeacherDetailPage.tsx`) and Task 9 (`AdminTeacherDetail` type).

- [ ] **Step 1: Update the implementation**

In `server/src/services/admin.service.ts`, inside `getTeacherDetail`:

Rename the variable `pendingVisitRequests` (declared and used at lines 83, 91, 107) to `pendingSwapRequests`, and change its query (currently line 91):

```typescript
  const pendingVisitRequests = await prisma.visitRequest.count({
    where: { class: { teacherId }, status: "PENDING" },
  });
```

to:

```typescript
  const pendingSwapRequests = await prisma.swapRequest.count({
    where: { originClass: { teacherId }, status: "PENDING" },
  });
```

Update the returned object's key (currently line 107) from `pendingVisitRequests` to `pendingSwapRequests`.

- [ ] **Step 2: Run the full server suite to confirm no regression**

Run: `npm test` (from `server/`)

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add server/src/services/admin.service.ts
git commit -m "refactor: rename admin dossier pendingVisitRequests to pendingSwapRequests"
```

---

### Task 7: Pupil controller + routes — swap endpoints

**Files:**
- Modify: `server/src/controllers/pupil.controller.ts:1-14,110-169`
- Modify: `server/src/routes/pupil.routes.ts`

**Interfaces:**
- Consumes: `swap.service.ts` exports from Task 2 (`SwapError`, `listOtherClassesForPupil`, `createSwapRequest`, `listOwnSwapRequests`, `cancelSwapRequest`).
- Produces: `GET /classes/other`, `GET /swap-requests`, `POST /swap-requests`, `DELETE /swap-requests/:id` — relied on by Task 10 (`api/pupil.ts`).

- [ ] **Step 1: Update the controller**

**CORRECTION (post-Task-7-preflight-check):** The original text below assumed (a) a project-wide `AuthedRequest` type exists, (b) `z`/zod is already imported in this file, and (c) the existing `handleVisitError` throws internally. All three are wrong — verified by reading the real `server/src/controllers/pupil.controller.ts` in full and grepping the codebase: every controller in `server/src/controllers/` (including this one) types handlers as `req: Request` from `"express"` (no `AuthedRequest` type exists anywhere in the repo); this file has no zod import today (though `zod` is already a dependency used the same way in `attendance.controller.ts`, `auth.controller.ts`, `goal.controller.ts`, `teacher.controller.ts`, `vacation.controller.ts` — so adding it here is consistent, it just isn't present yet); and the real `handleVisitError` (verified at lines 110-116) returns `true`/`false` — `if (err instanceof VisitError) { ...; return true; } return false;` — with call sites written `if (!handleVisitError(err, res)) throw err;`. This boolean-return-and-check-at-call-site shape is the pattern used identically in every sibling controller (`vacation.controller.ts`'s `handleVacationError`, `teacher.controller.ts`'s `handleServiceError`, `goal.controller.ts`'s `handleGoalError`, `parent.controller.ts`'s `handleParentError`, `attendance.controller.ts`'s `handleAttendanceError`) — it is the codebase convention, not a one-off, so it should be preserved rather than replaced with a throw-internally variant.

In `server/src/controllers/pupil.controller.ts`, update the import block (currently lines 1-14) to import from `../services/swap.service.js` instead of `../services/visit.service.js`, and add the zod import (not previously present in this file):

```typescript
import type { Request, Response } from "express";
import { z } from "zod";
import { listPostsForClass, submitToExam, getOwnGrades, PostError } from "../services/post.service.js";
import { AttendanceError, getOwnAttendanceCalendar } from "../services/attendance.service.js";
import { PaymentError, getOwnPaymentHistory } from "../services/payment.service.js";
import { PupilError, getHomeSnapshot, getPupilProfileWithClass } from "../services/pupil.service.js";
import { getClassScheduleView } from "../services/vacation.service.js";
import {
  SwapError,
  listOtherClassesForPupil,
  createSwapRequest,
  listOwnSwapRequests,
  cancelSwapRequest,
} from "../services/swap.service.js";
import { saveFile } from "../utils/storage.js";
```

(keep the other existing imports in that block unchanged — this is the same block with only the last named-import group replaced and `z` added).

Rename `handleVisitError` (currently lines 110-116) to `handleSwapError`, replacing `VisitError` with `SwapError`, preserving the existing boolean-return shape:

```typescript
function handleSwapError(err: unknown, res: Response) {
  if (err instanceof SwapError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}
```

Rename `otherClassesHandler` (currently lines 118-125) — body unchanged, just calls `listOtherClassesForPupil` and uses `handleSwapError`:

```typescript
export async function otherClassesHandler(req: Request, res: Response) {
  try {
    const classes = await listOtherClassesForPupil(req.user!.id);
    res.json(classes);
  } catch (err) {
    if (!handleSwapError(err, res)) throw err;
  }
}
```

Rename `listVisitRequestsHandler` → `listSwapRequestsHandler` (currently lines 127-142), calling `listOwnSwapRequests`:

```typescript
export async function listSwapRequestsHandler(req: Request, res: Response) {
  try {
    const requests = await listOwnSwapRequests(req.user!.id);
    res.json(requests);
  } catch (err) {
    if (!handleSwapError(err, res)) throw err;
  }
}
```

Rename `createVisitRequestHandler` → `createSwapRequestHandler` (currently lines 144-160). Replace its old manual `typeof` checks with a Zod schema validating the new dual-date shape, and call `createSwapRequest`:

```typescript
const createSwapRequestSchema = z.object({
  originDate: z.string().min(1),
  targetClassId: z.string().min(1),
  targetDate: z.string().min(1),
  reason: z.string().optional(),
});

export async function createSwapRequestHandler(req: Request, res: Response) {
  const parsed = createSwapRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }
  try {
    const request = await createSwapRequest(req.user!.id, parsed.data);
    res.status(201).json(request);
  } catch (err) {
    if (!handleSwapError(err, res)) throw err;
  }
}
```

Rename `cancelVisitRequestHandler` → `cancelSwapRequestHandler` (currently lines 162-169), calling `cancelSwapRequest`:

```typescript
export async function cancelSwapRequestHandler(req: Request, res: Response) {
  try {
    await cancelSwapRequest(req.user!.id, req.params.id!);
    res.status(204).send();
  } catch (err) {
    if (!handleSwapError(err, res)) throw err;
  }
}
```

- [ ] **Step 2: Update the routes**

**CORRECTION (post-Task-7-preflight-check):** Verified the real `server/src/routes/pupil.routes.ts`: the import block is lines 4-16 (not 30-33 as originally stated), and the route registrations are lines 30-33. Also, the router variable in this file is named `pupilRouter` (not `router`), and the path segment is currently `/visit-requests` (not `/swap-requests` in the brief's earlier draft — this was already correct in the plan's Interfaces line but the code block below had drifted).

In `server/src/routes/pupil.routes.ts`, update the import block (lines 4-16) to pull the renamed handler names:

```typescript
import { Router } from "express";
import { requireActive, requireAuth, requireEmailVerified, requireRole } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import {
  attendanceCalendarHandler,
  cancelSwapRequestHandler,
  createSwapRequestHandler,
  gradesHandler,
  home,
  listSwapRequestsHandler,
  otherClassesHandler,
  paymentHistoryHandler,
  posts,
  schedule,
  submitExam,
} from "../controllers/pupil.controller.js";
```

Update the route registrations (lines 30-33) to the new path and renamed handlers:

```typescript
pupilRouter.get("/classes/other", otherClassesHandler);
pupilRouter.get("/swap-requests", listSwapRequestsHandler);
pupilRouter.post("/swap-requests", createSwapRequestHandler);
pupilRouter.delete("/swap-requests/:id", cancelSwapRequestHandler);
```

- [ ] **Step 3: Run the full server suite to confirm no regression**

Run: `npm test` (from `server/`)

Expected: PASS. (No `pupil.controller.test.ts` exists, so this is a compile-and-suite-pass check; the full-program type check happens in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add server/src/controllers/pupil.controller.ts server/src/routes/pupil.routes.ts
git commit -m "feat: rewire pupil visit-request endpoints to swap requests"
```

---

### Task 8: Teacher controller + routes, delete `visit.service.ts`, full type-check

**Files:**
- Modify: `server/src/controllers/teacher.controller.ts:1-61,397-437`
- Modify: `server/src/routes/teacher.routes.ts:4-59,65-121`
- Delete: `server/src/services/visit.service.ts`

**Interfaces:**
- Consumes: `swap.service.ts` exports from Task 2 (`SwapError`, `listSwapRequestsForTeacher`, `respondToSwapRequest`).
- Produces: `GET /swap-requests`, `POST /swap-requests/:id/approve`, `POST /swap-requests/:id/decline` — relied on by Task 11 (`api/teacher.ts`).

- [ ] **Step 1: Update the controller**

**CORRECTION (post-Task-8-preflight-check):** The original text below omitted the actual response-mapping code for `swapRequestsHandler` (it only said "calling `listSwapRequestsForTeacher(...)`", a placeholder gap) — this matters because `listSwapRequestsForTeacher` (Task 2) returns raw Prisma rows with `originClass`/`targetClass`/`pupil` joins, while the client's `TeacherSwapRequest` type (Task 9, already grounded) expects a flattened shape (`pupilName`, `originClassName`, `targetClassName`, etc.) consumed directly by `SwapRequestRow` in Task 15. Verified the real current `visitRequestsHandler` (lines 397-419) does its own flattening today (`pupilName: r.pupil.user.name`, etc.) — so the new handler must do the analogous flattening, not just forward the raw join. The code below is that exact mapping, derived field-for-field from Task 9's `TeacherSwapRequest` type. Also verified the real import block only needs its `visit.service.js` import (lines 36-40) swapped — the surrounding imports (`class.service.js`, `payment.service.js`, `post.service.js`, `parent.service.js`, `vacation.service.js`) stay untouched.

In `server/src/controllers/teacher.controller.ts`, replace the `visit.service.js` import (lines 36-40) with:

```typescript
import { SwapError, listSwapRequestsForTeacher, respondToSwapRequest } from "../services/swap.service.js";
```

Update `handleServiceError` (currently lines 49-61) — it references `err instanceof VisitError` alongside other service error classes; change that check to `err instanceof SwapError`.

Replace `visitRequestsHandler` (currently lines 397-419) with `swapRequestsHandler`, flattening `listSwapRequestsForTeacher`'s joined rows into the `TeacherSwapRequest` shape:

```typescript
export async function swapRequestsHandler(req: Request, res: Response) {
  const status = req.query.status;
  const requests = await listSwapRequestsForTeacher(
    req.user!.id,
    status === "PENDING" || status === "APPROVED" || status === "DECLINED" ? status : undefined
  );
  res.json(
    requests.map((r) => ({
      id: r.id,
      pupilId: r.pupilId,
      pupilName: r.pupil.user.name,
      originClassId: r.originClassId,
      originClassName: r.originClass.name,
      originDate: r.originDate,
      targetClassId: r.targetClassId,
      targetClassName: r.targetClass.name,
      targetDate: r.targetDate,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
    }))
  );
}
```

Replace `approveVisitRequestHandler` (currently lines 421-428) with `approveSwapRequestHandler`, and `declineVisitRequestHandler` (currently lines 430-437) with `declineSwapRequestHandler` — these two keep the existing file's pass-through-response pattern (the real current code does `res.json(request)` on `respondToVisitRequest`'s raw return value, with no flattening; `respondToSwapRequest`, Task 2, likewise returns the raw updated `SwapRequest` row, so no flattening is possible or expected here — the client's approve/decline calls only trigger a query invalidation and never read fields off this specific response, per Task 15):

```typescript
export async function approveSwapRequestHandler(req: Request, res: Response) {
  try {
    const request = await respondToSwapRequest(req.user!.id, req.params.id!, "APPROVED");
    res.json(request);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function declineSwapRequestHandler(req: Request, res: Response) {
  try {
    const request = await respondToSwapRequest(req.user!.id, req.params.id!, "DECLINED");
    res.json(request);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}
```

- [ ] **Step 2: Update the routes**

**CORRECTION (post-Task-8-preflight-check):** Verified the real `server/src/routes/teacher.routes.ts`: the router variable is named `teacherRouter` (not `router`), and the import list (lines 4-33) is alphabetized by export name. `approveSwapRequestHandler` sorts between `approveParentRequestHandler` and `assignPupilRequest`; `declineSwapRequestHandler` sorts between `declineParentRequestHandler` and `deletePostHandler`; `swapRequestsHandler` sorts between `rejectPupilRequestHandler` and `updateClassFeeHandler` (replacing `visitRequestsHandler`'s old alphabetical slot, which was last in the list under `v`).

In `server/src/routes/teacher.routes.ts`, update the import list (lines 4-33) to remove `approveVisitRequestHandler`, `declineVisitRequestHandler`, `visitRequestsHandler` and insert `approveSwapRequestHandler`, `declineSwapRequestHandler`, `swapRequestsHandler` in their correct alphabetical positions as described above. Then replace the route registrations (lines 105-107):

```typescript
teacherRouter.get("/swap-requests", swapRequestsHandler);
teacherRouter.post("/swap-requests/:id/approve", approveSwapRequestHandler);
teacherRouter.post("/swap-requests/:id/decline", declineSwapRequestHandler);
```

- [ ] **Step 3: Delete the old visit service**

```bash
rm server/src/services/visit.service.ts
```

- [ ] **Step 4: Run the full server suite**

Run: `npm test` (from `server/`)

Expected: PASS.

- [ ] **Step 5: Run a full-program type check**

Run: `npx tsc --noEmit` (from `server/`)

Expected: no errors. This is the first point in the plan where every file touched so far (Tasks 1-8) is checked together as one program — fix any stale references surfaced here before proceeding.

- [ ] **Step 6: Commit**

```bash
git add -A server/src
git commit -m "feat: rewire teacher visit-request endpoints to swap requests, remove visit.service"
```

---

### Task 9: `client/src/api/types.ts` — rename types

**Files:**
- Modify: `client/src/api/types.ts`

**Interfaces:**
- Produces: `SwapRequestStatus` (renamed from `VisitRequestStatus`), `ClassSwapVisitor` (renamed from `ClassVisitor`), `ClassSummary.swapVisitors` (renamed from `visitRequests`), `PupilSwapRequest` (renamed from `PupilVisitRequest`, reshaped with origin/target fields), `TeacherSwapRequest` (renamed from `TeacherVisitRequest`, reshaped), `AdminTeacherDetail.pendingSwapRequests` (renamed from `pendingVisitRequests`), `AttendanceStatus` and `AttendanceDisplay` widened to include `"EXCUSED"`. Relied on by Tasks 10, 11, 14, 15, 16, 17, 18.

Read `client/src/api/types.ts` in full first to get exact current line numbers for each type before editing (content already captured from prior reads in this session).

- [ ] **Step 1: Rename `VisitRequestStatus` to `SwapRequestStatus`**

```typescript
export type SwapRequestStatus = "PENDING" | "APPROVED" | "DECLINED";
```

- [ ] **Step 2: Widen `AttendanceStatus` and `AttendanceDisplay`** to include `"EXCUSED"`:

```typescript
export type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED";
export type AttendanceDisplay = "FUTURE" | "TODAY" | "PRESENT" | "ABSENT" | "EXCUSED" | "UNMARKED";
```

- [ ] **Step 3: Rename `ClassVisitor` to `ClassSwapVisitor`**, renaming its `sessionDate` field to `targetDate`:

**CORRECTION (post-Task-5-preflight-check):** The original type below wrongly reshaped `ClassVisitor` to a flat `{ pupilId, pupilName, targetDate }`, dropping `id`, `reason`, and `pupil.user.email`. Verified against the real current `client/src/api/types.ts` (`ClassVisitor = { id: string; pupilId: string; sessionDate: string; reason: string | null; pupil: { user: { name: string; email: string } } }`) and the spec (`docs/superpowers/specs/2026-09-04-swap-request-design.md:174`), which says this panel is "otherwise unchanged" — this must be a pure field rename, not a reshape:

```typescript
export type ClassSwapVisitor = {
  id: string;
  pupilId: string;
  targetDate: string;
  reason: string | null;
  pupil: { user: { name: string; email: string } };
};
```

- [ ] **Step 4: Rename `ClassSummary.visitRequests` field to `swapVisitors`**, typed `ClassSwapVisitor[]`.

- [ ] **Step 5: Rename `PupilVisitRequest` to `PupilSwapRequest`**, reshaping to dual origin/target fields:

```typescript
export type PupilSwapRequest = {
  id: string;
  originClassId: string;
  originClassName: string;
  originDate: string;
  targetClassId: string;
  targetClassName: string;
  targetDate: string;
  reason: string | null;
  status: SwapRequestStatus;
  createdAt: string;
};
```

- [ ] **Step 6: Rename `TeacherVisitRequest` to `TeacherSwapRequest`**, reshaping similarly plus the pupil name:

```typescript
export type TeacherSwapRequest = {
  id: string;
  pupilId: string;
  pupilName: string;
  originClassId: string;
  originClassName: string;
  originDate: string;
  targetClassId: string;
  targetClassName: string;
  targetDate: string;
  reason: string | null;
  status: SwapRequestStatus;
  createdAt: string;
};
```

- [ ] **Step 7: Rename `AdminTeacherDetail.pendingVisitRequests` field to `pendingSwapRequests`.**

- [ ] **Step 8: Run the full client suite to confirm no regression**

Run: `npm test` (from `client/`)

Expected: existing tests that reference these type names will now fail to compile within their own test files (Vitest/esbuild type-checks per test file's import graph) — this is expected; those files are fixed in Tasks 10-18. If any test currently imports these exact old names, note it and proceed — it will be corrected in its owning task.

- [ ] **Step 9: Commit**

```bash
git add client/src/api/types.ts
git commit -m "refactor: rename visit-request client types to swap-request shapes"
```

---

### Task 10: `client/src/api/pupil.ts` — swap endpoints

**Files:**
- Modify: `client/src/api/pupil.ts:1-11,55-67`

**Interfaces:**
- Consumes: `PupilSwapRequest`, `SwapRequestStatus` from `./types.js` (Task 9). Backend routes from Task 7.
- Produces: `fetchOwnSwapRequests(): Promise<PupilSwapRequest[]>`, `createSwapRequest(input: { originDate: string; targetClassId: string; targetDate: string; reason?: string }): Promise<PupilSwapRequest>`, `cancelSwapRequest(id: string): Promise<void>` — relied on by Task 14 (`SchedulePage.tsx`).

- [ ] **Step 1: Update the implementation**

**CORRECTION (post-Task-10-preflight-check):** The original text below invented a fetch-based `apiFetch(...)` helper that does not exist anywhere in this codebase (confirmed via grep: zero matches for `apiFetch` in `client/src`). Verified the real `client/src/api/pupil.ts`: it imports an axios instance `import { api } from "./client";` and every function follows the pattern `const { data } = await api.get/post/delete(path[, body][, { params }]); return data;` — e.g. the real current `fetchOtherClasses` (lines 50-53) is `const { data } = await api.get("/pupil/classes/other"); return data;`, and the real current `createVisitRequest`/`cancelVisitRequest` (lines 60-67) are `const { data } = await api.post("/pupil/visit-requests", input); return data;` and `await api.delete(...)`. The code below is the same three functions rewritten to that real convention, not the invented one.

In `client/src/api/pupil.ts`, update the import block (currently lines 1-11) to import `PupilSwapRequest` instead of `PupilVisitRequest`.

Replace `fetchOwnVisitRequests`/`createVisitRequest`/`cancelVisitRequest` (currently lines 55-67) with:

```typescript
export async function fetchOwnSwapRequests(): Promise<PupilSwapRequest[]> {
  const { data } = await api.get("/pupil/swap-requests");
  return data;
}

export async function createSwapRequest(input: {
  originDate: string;
  targetClassId: string;
  targetDate: string;
  reason?: string;
}): Promise<PupilSwapRequest> {
  const { data } = await api.post("/pupil/swap-requests", input);
  return data;
}

export async function cancelSwapRequest(id: string): Promise<void> {
  await api.delete(`/pupil/swap-requests/${id}`);
}
```

- [ ] **Step 2: Run the full client suite to confirm no regression**

Run: `npm test` (from `client/`)

Expected: no new failures attributable to this file (any pre-existing failures from Task 9's rename in files not yet fixed are expected and will clear as later tasks land).

- [ ] **Step 3: Commit**

```bash
git add client/src/api/pupil.ts
git commit -m "feat: rewire pupil api client to swap-request endpoints"
```

---

### Task 11: `client/src/api/teacher.ts` — swap endpoints

**Files:**
- Modify: `client/src/api/teacher.ts:1-26,207-220`

**Interfaces:**
- Consumes: `TeacherSwapRequest`, `SwapRequestStatus` from `./types.js` (Task 9). Backend routes from Task 8.
- Produces: `fetchSwapRequests(status?: SwapRequestStatus): Promise<TeacherSwapRequest[]>`, `approveSwapRequest(id: string): Promise<TeacherSwapRequest>`, `declineSwapRequest(id: string): Promise<TeacherSwapRequest>` — relied on by Task 15 (`ClassesPage.tsx`).

- [ ] **Step 1: Update the implementation**

**CORRECTION (post-Task-10-preflight-check):** Same invented `apiFetch` helper as Task 10 — it doesn't exist. Verified the real `client/src/api/teacher.ts`: it also imports `import { api } from "./client";`, and the real current `fetchVisitRequests`/`approveVisitRequest`/`declineVisitRequest` (lines 207-220) are `const { data } = await api.get("/teacher/visit-requests", { params: status ? { status } : undefined }); return data;` and `const { data } = await api.post(\`/teacher/visit-requests/${id}/approve\`); return data;` (no request body). The code below is the same three functions rewritten to that real convention — using axios's `params` object for the optional query string, not manual string interpolation.

In `client/src/api/teacher.ts`, update the import block (currently lines 1-26) to import `TeacherSwapRequest`/`SwapRequestStatus` instead of `TeacherVisitRequest`/`VisitRequestStatus`.

Replace `fetchVisitRequests`/`approveVisitRequest`/`declineVisitRequest` (currently lines 207-220) with:

```typescript
export async function fetchSwapRequests(status?: SwapRequestStatus): Promise<TeacherSwapRequest[]> {
  const { data } = await api.get("/teacher/swap-requests", { params: status ? { status } : undefined });
  return data;
}

export async function approveSwapRequest(id: string): Promise<TeacherSwapRequest> {
  const { data } = await api.post(`/teacher/swap-requests/${id}/approve`);
  return data;
}

export async function declineSwapRequest(id: string): Promise<TeacherSwapRequest> {
  const { data } = await api.post(`/teacher/swap-requests/${id}/decline`);
  return data;
}
```

- [ ] **Step 2: Run the full client suite to confirm no regression**

Run: `npm test` (from `client/`)

Expected: no new failures attributable to this file.

- [ ] **Step 3: Commit**

```bash
git add client/src/api/teacher.ts
git commit -m "feat: rewire teacher api client to swap-request endpoints"
```

---

### Task 12: `client/src/components/Badge.tsx` — rename `VisitStatusBadge`

**Files:**
- Modify: `client/src/components/Badge.tsx:1-2,53-71`

**Interfaces:**
- Consumes: `SwapRequestStatus` from `../api/types.js` (Task 9).
- Produces: `swapStatusColors`, `swapStatusLabels`, `SwapStatusBadge({ status }: { status: SwapRequestStatus })` — relied on by Tasks 14, 15.

- [ ] **Step 1: Update the implementation**

**CORRECTION (post-Task-12-preflight-check):** The original code block below (colors `bg-amber-50`/`bg-emerald-50`/`bg-rose-50`, template-literal `className` with `items-center rounded-full px-2.5 py-0.5`) was a hallucination — it did not match the real file. Verified the real current `client/src/components/Badge.tsx` (lines 53-71): the actual `visitStatusColors` values are `bg-warning-100 text-warning-700` / `bg-success-50 text-success-700` / `bg-danger-50 text-danger-600`, matching the same color tokens `PaymentBadge`/`StatusBadge` use elsewhere in this file; and the actual markup uses the file's shared `clsx(...)` helper (already imported at line 1) with classes `inline-flex rounded-sm px-2.5 py-1 text-xs font-medium`, exactly like every other badge component in this file — not a template literal. The block below is corrected to those real values and that real markup pattern; this is a pure identifier rename, not a value/style change.

In `client/src/components/Badge.tsx`, update the import at line 2 to import `SwapRequestStatus` instead of `VisitRequestStatus`.

Rename the block at lines 53-71:

```typescript
const swapStatusColors: Record<SwapRequestStatus, string> = {
  PENDING: "bg-warning-100 text-warning-700",
  APPROVED: "bg-success-50 text-success-700",
  DECLINED: "bg-danger-50 text-danger-600",
};

const swapStatusLabels: Record<SwapRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

export function SwapStatusBadge({ status }: { status: SwapRequestStatus }) {
  return (
    <span className={clsx("inline-flex rounded-sm px-2.5 py-1 text-xs font-medium", swapStatusColors[status])}>
      {swapStatusLabels[status]}
    </span>
  );
}
```

- [ ] **Step 2: Run the full client suite to confirm no regression**

Run: `npm test` (from `client/`)

Expected: no new failures attributable to this file.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Badge.tsx
git commit -m "refactor: rename VisitStatusBadge to SwapStatusBadge"
```

---

### Task 13: `client/src/lib/notificationMeta.ts` — add `SWAP_REQUEST` entry

**Files:**
- Modify: `client/src/api/types.ts:6-15`
- Modify: `client/src/lib/notificationMeta.ts`

**Interfaces:**
- Consumes: backend `NotificationType` Prisma enum (now includes `"SWAP_REQUEST"`, inserted after `"VISIT_REQUEST"`, from Task 1).
- Produces: client `NotificationType` widened to include `"SWAP_REQUEST"`; `NOTIFICATION_META.SWAP_REQUEST` entry — used wherever `NOTIFICATION_META` is rendered for the notification bell/list (`client/src/components/NotificationBell.tsx`, `client/src/features/teacher/RecentActivityCard.tsx` — not otherwise touched by this plan, they only index into the map by `n.type` with no exhaustive switch).

**CORRECTION (post-Task-13-preflight-check):** The brief as originally written assumed the client's `NotificationType` union (in `client/src/api/types.ts`) already included `"SWAP_REQUEST"` "from Task 1" — but Task 1 only changed the backend Prisma schema; no task in this plan ever touched the client's separately hand-maintained `NotificationType` type. Verified the real `client/src/api/types.ts` (lines 6-15): it still only has `"VISIT_REQUEST"`, not `"SWAP_REQUEST"`. Since `NOTIFICATION_META` is typed `Record<NotificationType, {...}>` (verified in the real `notificationMeta.ts`), adding a `SWAP_REQUEST` key to that object literal without first widening `NotificationType` would be a TypeScript excess-property error ("object literal may only specify known properties"). Also verified the exported constant's real name is `NOTIFICATION_META` (not `notificationMeta` as the brief's prose called it — the code block itself was already correct, only the prose name was off). Added Step 1 below to widen the client type first; this must land before Step 2's `notificationMeta.ts` edit or `tsc`/tests will fail to compile.

- [ ] **Step 1: Widen the client `NotificationType` union**

In `client/src/api/types.ts`, insert `"SWAP_REQUEST"` immediately after `"VISIT_REQUEST"` in the `NotificationType` union (currently lines 6-15), leaving every other value untouched:

```typescript
export type NotificationType =
  | "PUPIL_REQUEST"
  | "EXAM_SUBMISSION"
  | "PAYMENT_DUE"
  | "MONTHLY_RECAP"
  | "VISIT_REQUEST"
  | "SWAP_REQUEST"
  | "PARENT_REQUEST"
  | "POST_PUBLISHED"
  | "ABSENCE"
  | "SUBMISSION_MISSING";
```

- [ ] **Step 2: Update `notificationMeta.ts`**

In `client/src/lib/notificationMeta.ts`, add a sibling entry immediately after the existing `VISIT_REQUEST` entry (currently line 10) in the `NOTIFICATION_META` object:

```typescript
  SWAP_REQUEST: { Icon: CalendarClock, color: "bg-accent-50 text-accent-600" },
```

(Same `Icon`/`color` as `VISIT_REQUEST` — read the file first to copy the exact current values verbatim, since this plan's snippet mirrors but does not override the source of truth.)

- [ ] **Step 3: Run the full client suite to confirm no regression**

Run: `npm test` (from `client/`)

Expected: PASS (no test currently asserts on this specific map, per repository search during planning; if one exists, it should pass unmodified since this is a pure addition). `tsc --noEmit` (or the type-check step of the test run) must also be clean now that `NotificationType` is widened before `NOTIFICATION_META` is extended.

- [ ] **Step 4: Commit**

```bash
git add client/src/api/types.ts client/src/lib/notificationMeta.ts
git commit -m "feat: add SWAP_REQUEST notification icon/color mapping"
```

---

### Task 14: `client/src/features/pupil/SchedulePage.tsx` — swap request form + list

**Files:**
- Modify: `client/src/features/pupil/SchedulePage.tsx` (full rewrite of `VisitRequestForm`, `MyVisitRequests`, and header copy)
- Create: `client/src/features/pupil/SchedulePage.test.tsx`

**Interfaces:**
- Consumes: `fetchOtherClasses`, `fetchOwnSwapRequests`, `createSwapRequest`, `cancelSwapRequest` from `../../api/pupil.js` (Task 10); `SwapStatusBadge` from `../../components/Badge.js` (Task 12); `PupilSwapRequest` from `../../api/types.js` (Task 9).
- Produces: exported `SwapRequestForm` component (newly exported — was previously unexported `VisitRequestForm`) and `MySwapRequests` component, both consumed by `PupilSchedulePage`. `SchedulePage.test.tsx` tests these via the page.

- [ ] **Step 1: Write the failing test**

Create `client/src/features/pupil/SchedulePage.test.tsx`, modeled on `client/src/features/teacher/VacationSessionsPanel.test.tsx` (for the `vi.hoisted`/`vi.mock`/`renderWithClient` scaffold) and `client/src/features/teacher/PupilLedgerModal.test.tsx` (for the `userEvent` interaction pattern):

**CORRECTION (post-Task-14-preflight-check, test code):** The `OtherClass` type (`client/src/api/types.ts:408-413`) requires a `type: ClassType` field (`ClassType = "SCIENCE" | "MATH" | "INFO" | "ECO"`), and the real `SwapRequestForm`'s class `<option>` renders `{c.name} ({c.type})` (matching the current file's own `VisitRequestForm` pattern verbatim). The mock below has been corrected to include `type: "MATH"`, and the `waitFor` assertion below changed from an exact-text `getByText("Other Class")` (which would never match the rendered `"Other Class (MATH)"` option text) to a partial-match regex `getByText(/Other Class/)`.

```typescript
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PupilSchedulePage } from "./SchedulePage.js";

const { fetchOtherClasses, fetchOwnSwapRequests, createSwapRequest, cancelSwapRequest } = vi.hoisted(() => ({
  fetchOtherClasses: vi.fn(),
  fetchOwnSwapRequests: vi.fn(),
  createSwapRequest: vi.fn(),
  cancelSwapRequest: vi.fn(),
}));

vi.mock("../../api/pupil.js", async (importActual) => ({
  ...(await importActual<typeof import("../../api/pupil.js")>()),
  fetchOtherClasses,
  fetchOwnSwapRequests,
  createSwapRequest,
  cancelSwapRequest,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PupilSchedulePage", () => {
  it("submits a swap request with origin date, target class, and target date", async () => {
    fetchOtherClasses.mockResolvedValue([{ id: "class-2", name: "Other Class", type: "MATH", scheduleSlots: [] }]);
    fetchOwnSwapRequests.mockResolvedValue([]);
    createSwapRequest.mockResolvedValue({
      id: "req-1",
      originClassId: "class-1",
      originClassName: "My Class",
      originDate: "2026-09-07",
      targetClassId: "class-2",
      targetClassName: "Other Class",
      targetDate: "2026-09-09",
      reason: null,
      status: "PENDING",
      createdAt: "2026-09-04T00:00:00.000Z",
    });

    const user = userEvent.setup();
    renderWithClient(<PupilSchedulePage />);

    await waitFor(() => expect(screen.getByText(/Other Class/)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/session you'll miss/i), "2026-09-07");
    await user.selectOptions(screen.getByLabelText(/class to join/i), "class-2");
    await user.type(screen.getByLabelText(/date to attend/i), "2026-09-09");
    await user.click(screen.getByRole("button", { name: /request swap/i }));

    await waitFor(() =>
      expect(createSwapRequest).toHaveBeenCalledWith({
        originDate: "2026-09-07",
        targetClassId: "class-2",
        targetDate: "2026-09-09",
        reason: undefined,
      })
    );
  });

  it("lists the pupil's own swap requests with their status", async () => {
    fetchOtherClasses.mockResolvedValue([]);
    fetchOwnSwapRequests.mockResolvedValue([
      {
        id: "req-1",
        originClassId: "class-1",
        originClassName: "My Class",
        originDate: "2026-09-07",
        targetClassId: "class-2",
        targetClassName: "Other Class",
        targetDate: "2026-09-09",
        reason: null,
        status: "PENDING",
        createdAt: "2026-09-04T00:00:00.000Z",
      },
    ]);

    renderWithClient(<PupilSchedulePage />);

    await waitFor(() => expect(screen.getByText("Other Class")).toBeInTheDocument());
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SchedulePage` (from `client/`)

Expected: FAIL — `PupilSchedulePage` doesn't yet render the new dual-date form/labels (current component only has a single `sessionDate` field and un-exported `VisitRequestForm`), and `../../api/pupil.js` doesn't yet export `fetchOwnSwapRequests`/`createSwapRequest`/`cancelSwapRequest` under those exact mock-target names until Task 10 lands (already done by this point in the plan).

- [ ] **Step 3: Rewrite the implementation**

**CORRECTION (post-Task-14-preflight-check):** The original code blocks below (both `SwapRequestForm` and the described `MyVisitRequests`/`MySwapRequests` replacement) were a hallucination — they invented a raw-Tailwind visual style (`text-slate-700`, `border-slate-300`, `bg-accent-600`, `text-rose-600`, unstyled `<button>`) and a bespoke local `error` string dropped from `mutation.onError`, none of which exist anywhere in this codebase. Verified the real current `client/src/features/pupil/SchedulePage.tsx` in full: it uses this repo's actual design system throughout — `Button` (`../../components/Button`), `EmptyState`/`ErrorState`/`Spinner` (`../../components/Feedback`), `Card` (already wrapping both panels in `PupilSchedulePage`, untouched by this task), the design tokens `text-ink-700`/`text-ink-400`/`text-ink-500`/`text-ink-900`/`border-border-strong`/`focus-ring`/`danger-600`, `toast.success(...)` from `sonner` on successful submission, and `extractErrorMessage(mutation.error)` passed to `ErrorState` for the inline error banner (driven by `mutation.isError`, not a separate local error string). This matches the spec (`docs/superpowers/specs/2026-09-04-swap-request-design.md:167`), which explicitly says the new origin-date field is "consistent with how the pupil already understands their own schedule" and that an invalid pick "surfaces **the same inline error the old form used**" — i.e. reuse `ErrorState`/`extractErrorMessage`/`mutation.isError`, not a new mechanism. The blocks below are corrected to reuse the real design system and error-handling pattern; only the field shape (origin+target instead of single class+date) and copy actually change. `ClassTypeBadge` is dropped from the import list — `PupilSwapRequest` (Task 9) has no `classType` field, and this project's `tsconfig.json` has `noUnusedLocals: true`, so an unused import would fail the build.

In `client/src/features/pupil/SchedulePage.tsx`, replace `VisitRequestForm` (currently lines 23-124) with an exported `SwapRequestForm`:

```typescript
export function SwapRequestForm() {
  const queryClient = useQueryClient();
  const otherClassesQuery = useQuery({ queryKey: ["pupil", "other-classes"], queryFn: fetchOtherClasses });
  const [originDate, setOriginDate] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [reason, setReason] = useState("");

  const classes = otherClassesQuery.data ?? [];
  const activeClassId = targetClassId || classes[0]?.id || "";
  const selectedClass = classes.find((c) => c.id === activeClassId);

  const mutation = useMutation({
    mutationFn: () =>
      createSwapRequest({
        originDate,
        targetClassId: activeClassId,
        targetDate,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Swap request sent.");
      setOriginDate("");
      setTargetDate("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["pupil", "swap-requests"] });
    },
  });

  if (otherClassesQuery.isLoading) return <Spinner />;

  if (classes.length === 0) {
    return (
      <EmptyState
        title="No other classes to join"
        description="Your teacher only has the class you're already enrolled in."
      />
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!originDate || !activeClassId || !targetDate) return;
        mutation.mutate();
      }}
    >
      <div>
        <label htmlFor="swap-request-origin-date" className="text-sm font-medium text-ink-700">Session you'll miss</label>
        <input
          id="swap-request-origin-date"
          required
          aria-required="true"
          type="date"
          min={todayIso()}
          value={originDate}
          onChange={(e) => setOriginDate(e.target.value)}
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        />
      </div>

      <div>
        <label htmlFor="swap-request-target-class" className="text-sm font-medium text-ink-700">Class to join</label>
        <select
          id="swap-request-target-class"
          value={activeClassId}
          onChange={(e) => setTargetClassId(e.target.value)}
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>
        {selectedClass && (
          <p className="mt-1 text-xs text-ink-400">
            {selectedClass.scheduleSlots.length === 0
              ? "No schedule set for this class yet."
              : `Meets: ${selectedClass.scheduleSlots
                  .slice()
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                  .map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}–${s.endTime}`)
                  .join(", ")}`}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="swap-request-target-date" className="text-sm font-medium text-ink-700">Date to attend</label>
        <input
          id="swap-request-target-date"
          required
          aria-required="true"
          type="date"
          min={todayIso()}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        />
      </div>

      <div>
        <label htmlFor="swap-request-reason" className="text-sm font-medium text-ink-700">Reason (optional)</label>
        <textarea
          id="swap-request-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. I'll be away from my usual class that day."
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        />
      </div>

      {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

      <Button type="submit" size="sm" disabled={mutation.isPending || !originDate || !targetDate}>
        {mutation.isPending ? "Sending…" : "Request swap"}
      </Button>
    </form>
  );
}
```

Replace `MyVisitRequests` (currently lines 126-177) with `MySwapRequests`:

```typescript
function MySwapRequests() {
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ["pupil", "swap-requests"], queryFn: fetchOwnSwapRequests });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelSwapRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pupil", "swap-requests"] }),
  });

  if (requestsQuery.isLoading) return <Spinner />;

  const requests = requestsQuery.data ?? [];
  if (requests.length === 0) {
    return <EmptyState title="No swap requests yet" description="Requests you send will show up here." />;
  }

  return (
    <ul className="space-y-2.5">
      {requests.map((r) => (
        <li key={r.id} className="rounded-sm bg-canvas p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink-900">{r.targetClassName}</p>
              <p className="mt-1 text-xs text-ink-500">
                {new Date(r.targetDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                instead of {r.originClassName} on{" "}
                {new Date(r.originDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              {r.reason && <p className="mt-1 text-xs italic text-ink-400">"{r.reason}"</p>}
            </div>
            <div className="flex items-center gap-2">
              <SwapStatusBadge status={r.status} />
              {r.status === "PENDING" && (
                <button
                  onClick={() => cancelMutation.mutate(r.id)}
                  disabled={cancelMutation.isPending}
                  className="focus-ring rounded-sm text-xs font-medium text-danger-600 hover:text-danger-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

Update `PupilSchedulePage` (currently lines 179-213): header text "Visit another class" → "Swap a session" (currently line 195, and update the description paragraph below it to reference swapping) and "My visit requests" → "My swap requests" (currently line 205); render `<SwapRequestForm />` and `<MySwapRequests />` in place of the old components. `Card` wraps both panels exactly as before — untouched by this task.

Update the file's import block: replace `cancelVisitRequest`/`createVisitRequest`/`fetchOwnVisitRequests` with `cancelSwapRequest`/`createSwapRequest`/`fetchOwnSwapRequests` from `../../api/pupil`; replace `VisitStatusBadge` with `SwapStatusBadge` and drop `ClassTypeBadge` from the `../../components/Badge` import; keep `Button`, `Card`, `EmptyState`/`ErrorState`/`Spinner`, `extractErrorMessage`, `ScheduleView`, `DAY_NAMES`, and the `toast` import exactly as they are today.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SchedulePage` (from `client/`)

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/pupil/SchedulePage.tsx client/src/features/pupil/SchedulePage.test.tsx
git commit -m "feat: rebuild pupil schedule page for dual-date swap requests"
```

---

### Task 15: `client/src/features/teacher/ClassesPage.tsx` — swap request row

**Files:**
- Modify: `client/src/features/teacher/ClassesPage.tsx:17-32,147-184,348-379,485-509`

**Interfaces:**
- Consumes: `fetchSwapRequests`, `approveSwapRequest`, `declineSwapRequest` from `../../api/teacher.js` (Task 11); `SwapStatusBadge` from `../../components/Badge.js` (Task 12); `TeacherSwapRequest` from `../../api/types.js` (Task 9).
- Produces: renamed `SwapRequestRow` component, renamed query/mutation variables, updated JSX section — internal to this page only.

- [ ] **Step 1: Update the implementation**

**CORRECTION (post-Task-15-preflight-check):** Verified the real current file against this task's line ranges and found two plan gaps. First, line 434 (`const visitRequests = visitRequestsQuery.data ?? [];`) — the derived list variable consumed by the JSX at lines 489/498 — falls outside every cited range (147-184, 348-379, 485-509) and the plan never mentions renaming it; missing this rename leaves a stale `visitRequests`/`visitRequestsQuery` reference after `visitRequestsQuery` itself is renamed, which would fail to compile. Second, and more significant: the spec (`docs/superpowers/specs/2026-09-04-swap-request-design.md:153`) says `TeacherSwapRequest` "keeps `pupilId`/`pupilName`/`pupilEmail`", and the real current row (line 165) does render `{request.pupilEmail}` — but the real, already-committed `TeacherSwapRequest` interface (`client/src/api/types.ts:428-441`, from Task 9) and the real, already-committed backend `swapRequestsHandler` (`server/src/controllers/teacher.controller.ts:393-415`, from Task 8) both omit `pupilEmail` entirely (only `pupilId`/`pupilName` are present end-to-end). Since Tasks 8 and 9 already landed, passed their own task reviews, and later tasks depend on their exact shapes, revisiting them now is out of scope for this task — the correction below simply drops the `pupilEmail` display, since the field doesn't exist on the type this row actually receives.

In `client/src/features/teacher/ClassesPage.tsx`, update the import block (currently lines 17-32) to import `fetchSwapRequests`/`approveSwapRequest`/`declineSwapRequest` and `TeacherSwapRequest`/`SwapStatusBadge` in place of the visit-request equivalents (drop `fetchVisitRequests`/`approveVisitRequest`/`declineVisitRequest`/`TeacherVisitRequest` — `TeacherVisitRequest` no longer exists on `../../api/types` as of Task 9).

Rename `VisitRequestRow` (currently lines 147-184) to `SwapRequestRow`, typed to `TeacherSwapRequest`, dropping the `pupilEmail` line (the field doesn't exist on `TeacherSwapRequest`) and showing origin/target session lines plus the status badge instead:

```typescript
function SwapRequestRow({
  request,
  onApprove,
  onDecline,
  isPending,
}: {
  request: TeacherSwapRequest;
  onApprove: () => void;
  onDecline: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink-900">
          {request.pupilName} <span className="font-normal text-ink-400">misses</span> {request.originClassName}{" "}
          <span className="font-normal text-ink-400">on</span>{" "}
          {new Date(request.originDate).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">
          to join {request.targetClassName} on{" "}
          {new Date(request.targetDate).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
        {request.reason && <p className="mt-1 text-xs italic text-ink-400">"{request.reason}"</p>}
      </div>
      <div className="flex items-center gap-2">
        <SwapStatusBadge status={request.status} />
        <Button size="sm" variant="secondary" onClick={onDecline} disabled={isPending}>
          Decline
        </Button>
        <Button size="sm" onClick={onApprove} disabled={isPending}>
          Approve
        </Button>
      </div>
    </div>
  );
}
```

Inside `ClassesPage()`: rename `visitRequestsQuery` (currently lines 348-351) to `swapRequestsQuery` calling `fetchSwapRequests("PENDING")` (query key `["teacher", "swap-requests", "PENDING"]`); rename `invalidateVisitRequests` (currently lines 363-366) to `invalidateSwapRequests` (invalidating `["teacher", "swap-requests"]` and `["teacher", "classes"]`); rename `approveVisitMutation`/`declineVisitMutation` (currently lines 368-379) to `approveSwapMutation`/`declineSwapMutation` calling `approveSwapRequest`/`declineSwapRequest`, calling `invalidateSwapRequests` on success exactly as the originals called `invalidateVisitRequests`. Also rename the derived list variable at line 434 (`const visitRequests = visitRequestsQuery.data ?? [];`, outside every range above but required since it consumes the renamed query) to `const swapRequests = swapRequestsQuery.data ?? [];`.

Update the JSX section "Session visit requests" (currently lines 485-509): heading text → "Session swap requests", the empty-state copy → e.g. `title="No pending swap requests"` / `description="Pupils requesting to swap into another class's session will appear here."`, and replace every remaining `visitRequests`/`approveVisitMutation`/`declineVisitMutation`/`VisitRequestRow` reference in this block with `swapRequests`/`approveSwapMutation`/`declineSwapMutation`/`SwapRequestRow`.

- [ ] **Step 2: Run the full client suite to confirm no regression**

Run: `npm test` (from `client/`)

Expected: no new failures attributable to this file. (No `ClassesPage.test.tsx` exists per repository search during planning; this is a compile-and-suite-pass check.)

- [ ] **Step 3: Commit**

```bash
git add client/src/features/teacher/ClassesPage.tsx
git commit -m "feat: rebuild teacher classes page swap-request row for origin/target sessions"
```

---

### Task 16: `client/src/features/teacher/ClassDetailPage.tsx` — rename visitor panel

**Files:**
- Modify: `client/src/features/teacher/ClassDetailPage.tsx:389-418`

**Interfaces:**
- Consumes: `ClassSummary.swapVisitors` (Task 9), populated by `class.service.ts`'s `getClassDetail` (Task 5).
- Produces: no external interface change — internal rename only.

- [ ] **Step 1: Update the implementation**

**CORRECTION (post-Task-5-preflight-check):** The JSX block originally shown here did not match the real file at all (wrong markup, wrong class names, missing the `EmptyState` component, missing `pupil.user.email` and `reason` display) — it was invented rather than read from the repo. Verified against the real current `client/src/features/teacher/ClassDetailPage.tsx` (the "Upcoming visitors" `<Card>` block). Per the spec (line 174), this panel is "otherwise unchanged" other than the field rename — so only `klass.visitRequests` → `klass.swapVisitors` and `v.sessionDate` → `v.targetDate` change; every other line, class name, and the `EmptyState` usage stay exactly as they are.

In `client/src/features/teacher/ClassDetailPage.tsx`, find the "Upcoming visitors" `<Card>` block (search for `Upcoming visitors`) and change only the two field references:

```typescript
{(klass.swapVisitors?.length ?? 0) === 0 ? (
  <div className="mt-3">
    <EmptyState title="No upcoming visitors" description="Approved one-off session requests will show here." />
  </div>
) : (
  <ul className="mt-3 divide-y divide-border">
    {klass.swapVisitors!.map((v) => (
      <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
        <div>
          <p className="text-sm font-medium text-ink-900">{v.pupil.user.name}</p>
          <p className="text-xs text-ink-500">{v.pupil.user.email}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-700">
            {new Date(v.targetDate).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
          {v.reason && <p className="text-xs italic text-ink-400">"{v.reason}"</p>}
        </div>
      </li>
    ))}
  </ul>
)}
```

(Preserve every other line of the surrounding JSX, including the `<h2>`/`<p>` header above this block and the `<Card>` wrapper — only the two field names change: `visitRequests`→`swapVisitors` and `v.sessionDate`→`v.targetDate`. The `key` prop stays `v.id` — unchanged.)

- [ ] **Step 2: Run the full client suite to confirm no regression**

Run: `npm test` (from `client/`)

Expected: PASS — `VacationSessionsPanel.test.tsx` (which tests a different export from this same file) must still pass unmodified.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/teacher/ClassDetailPage.tsx
git commit -m "refactor: rename class detail visitor panel fields to swapVisitors/targetDate"
```

---

### Task 17: `client/src/features/admin/TeacherDetailPage.tsx` — rename pending count

**Files:**
- Modify: `client/src/features/admin/TeacherDetailPage.tsx:153-157`

**Interfaces:**
- Consumes: `AdminTeacherDetail.pendingSwapRequests` (Task 9), populated by `admin.service.ts`'s `getTeacherDetail` (Task 6).
- Produces: no external interface change — internal rename + copy update only.

- [ ] **Step 1: Update the implementation**

In `client/src/features/admin/TeacherDetailPage.tsx`, replace lines 153-157:

```tsx
{data.pendingSwapRequests > 0 && (
  <p className="mt-3 text-xs font-medium text-accent-600">
    {data.pendingSwapRequests} pending swap request{data.pendingSwapRequests === 1 ? "" : "s"}
  </p>
)}
```

- [ ] **Step 2: Run the full client suite to confirm no regression**

Run: `npm test` (from `client/`)

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/admin/TeacherDetailPage.tsx
git commit -m "refactor: rename admin teacher detail pendingVisitRequests to pendingSwapRequests"
```

---

### Task 18: `EXCUSED` calendar styling across pupil/parent/teacher attendance views

**Files:**
- Modify: `client/src/features/teacher/PupilDetailModal.tsx:37-51`
- Modify: `client/src/features/pupil/AttendancePage.tsx:33-47`
- Modify: `client/src/features/parent/AttendancePage.tsx:35-49`
- Test: `client/src/features/teacher/PupilDetailModal.test.tsx` (create if none exists; check first — if it doesn't exist, add a minimal new test file covering just the `EXCUSED` rendering)

**Interfaces:**
- Consumes: `AttendanceDisplay` widened to include `"EXCUSED"` (Task 9), returned in calendar day data from `attendance.service.ts` (Task 3).
- Produces: no new exports — each file's `DISPLAY_STYLES`/`DISPLAY_LABELS` `Record<AttendanceDay["display"], string>` gains an `EXCUSED` key, satisfying TypeScript's exhaustiveness now that the union has 6 members instead of 5.

- [ ] **Step 1: Write the failing test**

Check whether `client/src/features/teacher/PupilDetailModal.test.tsx` exists. If it does not, create it with a focused test, modeled on the `vi.hoisted`/`vi.mock`/`renderWithClient` pattern from `VacationSessionsPanel.test.tsx`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PupilDetailModal } from "./PupilDetailModal.js";

const { fetchAttendanceCalendar } = vi.hoisted(() => ({ fetchAttendanceCalendar: vi.fn() }));

vi.mock("../../api/teacher.js", async (importActual) => ({
  ...(await importActual<typeof import("../../api/teacher.js")>()),
  fetchAttendanceCalendar,
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PupilDetailModal attendance calendar", () => {
  it("renders an EXCUSED day with its own label", async () => {
    fetchAttendanceCalendar.mockResolvedValue({
      period: "2026-09",
      className: "Math",
      classType: "MATH",
      days: [
        { date: "2026-09-07", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", display: "EXCUSED", record: "EXCUSED" },
      ],
    });

    renderWithClient(<PupilDetailModal pupilId="pupil-1" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText(/excused/i)).toBeInTheDocument());
  });
});
```

(If the modal requires additional props beyond `pupilId`/`onClose` per its actual current signature, read the file's existing prop type first and match it exactly — this plan's snippet assumes the minimal signature; adjust to the real one before writing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PupilDetailModal` (from `client/`)

Expected: FAIL — either a TypeScript error (the `DISPLAY_STYLES`/`DISPLAY_LABELS` Records aren't exhaustive over the widened `AttendanceDisplay` union, since Task 9 already landed) or a missing "Excused" text assertion failure.

- [ ] **Step 3: Update the implementations**

In `client/src/features/teacher/PupilDetailModal.tsx`, add an `EXCUSED` entry to `DISPLAY_STYLES` (currently lines 37-43) and `DISPLAY_LABELS` (currently lines 45-51):

```typescript
const DISPLAY_STYLES: Record<AttendanceDay["display"], string> = {
  FUTURE: "bg-slate-50 text-slate-400",
  TODAY: "bg-accent-50 text-accent-700 ring-2 ring-accent-400",
  PRESENT: "bg-emerald-50 text-emerald-700",
  ABSENT: "bg-rose-50 text-rose-700",
  EXCUSED: "bg-sky-50 text-sky-700",
  UNMARKED: "bg-white text-slate-500",
};

const DISPLAY_LABELS: Record<AttendanceDay["display"], string> = {
  FUTURE: "Upcoming",
  TODAY: "Today",
  PRESENT: "Present",
  ABSENT: "Absent",
  EXCUSED: "Excused",
  UNMARKED: "Unmarked",
};
```

(Preserve the exact existing values for the other 5 keys — read the file first to copy them verbatim; only the `EXCUSED` entries are new. Do not modify `handleDayClick`, which stays unchanged since `EXCUSED` is never teacher-clickable.)

Apply the identical `EXCUSED` addition to `client/src/features/pupil/AttendancePage.tsx`'s `DISPLAY_STYLES`/`DISPLAY_LABELS` (currently lines 33-47) and `client/src/features/parent/AttendancePage.tsx`'s `DISPLAY_STYLES`/`DISPLAY_LABELS` (currently lines 35-49), preserving each file's exact existing values for the other keys and each file's own `EXCUSED` color choice consistent with the teacher modal's (`bg-sky-50 text-sky-700`) for visual consistency.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PupilDetailModal` (from `client/`)

Expected: PASS.

- [ ] **Step 5: Run the full client suite to confirm no regression in the other two files**

Run: `npm test` (from `client/`)

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/teacher/PupilDetailModal.tsx client/src/features/pupil/AttendancePage.tsx client/src/features/parent/AttendancePage.tsx client/src/features/teacher/PupilDetailModal.test.tsx
git commit -m "feat: render EXCUSED attendance status across teacher/pupil/parent calendars"
```

---

### Task 19: Final full-suite verification

**Files:** none (verification-only task).

**Interfaces:** none.

- [ ] **Step 1: Run the full server test suite**

Run: `npm test` (from `server/`)

Expected: all tests PASS.

- [ ] **Step 2: Run the full server type check**

Run: `npx tsc --noEmit` (from `server/`)

Expected: no errors.

- [ ] **Step 3: Run the full client test suite**

Run: `npm test` (from `client/`)

Expected: all tests PASS.

- [ ] **Step 4: Run the full client type check**

Run: `npx tsc --noEmit` (from `client/`)

Expected: no errors.

- [ ] **Step 5: Grep for any remaining stale references**

Run (from repo root):

```bash
grep -ril "visitRequest\|VisitRequest\|VisitError\|visit\.service" server/src client/src
```

Expected: no matches (aside from this plan file and the spec document, which are not source).

- [ ] **Step 6: Commit** (only if Step 5 required fixes; otherwise this task produces no commit)

```bash
git add -A
git commit -m "chore: final verification pass for swap-request migration"
```

---

## Self-Review Notes

- **Spec coverage:** Every section of the spec (`SwapRequest` model, `createSwapRequest` 7-step validation, `listOwnSwapRequests`/`cancelSwapRequest`/`listSwapRequestsForTeacher`/`respondToSwapRequest`, all 8 routes, every Frontend subsection, EXCUSED attendance handling, edge cases, testing expectations) maps to a task above (Tasks 1-2 for the model/service, 3-4 for attendance/ledger EXCUSED handling, 5-6 for read-side renames, 7-8 for routes, 9-18 for the full frontend, 19 for final verification).
- **Placeholder scan:** No "TBD"/"TODO"/"implement later" markers remain; every step carries either complete code or an explicit instruction to read a specific line range and preserve its exact existing values before making a named, scoped change (used only where copying the entire unchanged surrounding file into the plan would be redundant with the exact line numbers already given).
- **Type consistency:** `SwapError`, `listOtherClassesForPupil`, `createSwapRequest`, `listOwnSwapRequests`, `cancelSwapRequest`, `listSwapRequestsForTeacher`, `respondToSwapRequest` (Task 2) are referenced with identical names/signatures in Tasks 7 and 8. `PupilSwapRequest`/`TeacherSwapRequest`/`SwapRequestStatus`/`ClassSwapVisitor` (Task 9) are referenced identically in Tasks 10-18. `fetchOwnSwapRequests`/`createSwapRequest`/`cancelSwapRequest` (Task 10) match Task 14's imports. `fetchSwapRequests`/`approveSwapRequest`/`declineSwapRequest` (Task 11) match Task 15's imports. `SwapStatusBadge` (Task 12) matches Tasks 14/15/18's usage.

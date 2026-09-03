# Vacation Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher suspend their classes' recurring weekly `ScheduleSlot` pattern for a date window and replace it with hand-picked one-off sessions per class, with the weekly pattern resuming automatically when the window ends.

**Architecture:** Two new Prisma models (`VacationPeriod`, `VacationSession`) sit alongside the untouched `ScheduleSlot`. A new `vacation.service.ts`/`vacation.controller.ts` pair owns CRUD for both. Every existing schedule/attendance read path gets a small vacation-aware branch: attendance calendar and `markAttendance` do a per-date merge (vacation session overrides only its own date, otherwise falls back to the weekday slot), while teacher-overview "upcoming schedule" and pupil/parent "Schedule" page do a wholesale mode switch (if a vacation period is ACTIVE, the whole schedule source becomes `VacationSession` rows for that class, even if empty).

**Tech Stack:** Express 5, Prisma 6.19.3 (PostgreSQL), Zod 4, Vitest 4 (server tests hit the real dev Postgres DB), React 19 + TanStack Query + Tailwind 4 (client).

**Spec:** [docs/superpowers/specs/2026-09-03-vacation-mode-design.md](../specs/2026-09-03-vacation-mode-design.md)

## Global Constraints

- Route param for a class id is always `:id`, never `:classId` (existing convention in `teacher.routes.ts`).
- Every service error class follows: `export class XError extends Error { constructor(message: string, public status = 400) { super(message); } }`.
- Every controller follows the local `handleXError(err, res): boolean` + `if (!handleXError(err, res)) throw err;` pattern.
- Server tests run against the real dev database; use a `Date.now()`-tagged unique email/id and clean up via cascading `prisma.user.delete` (or equivalent) in `afterAll`.
- No hardcoded absolute calendar dates in tests — compute dates relative to `new Date()` at test-run time so tests stay valid indefinitely.
- Do not touch `ScheduleSlot` rows, or any of its existing consumers' read/write logic beyond adding the new vacation branch described above.
- Do not push to the remote GitHub repository at any point in this work — local commits only.

---

## Task 1: Prisma schema — VacationPeriod / VacationSession

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `VacationStatus` enum (`ACTIVE`, `ENDED`); `VacationPeriod` model (`id, teacherId, startDate, endDate, status, createdAt, sessions`); `VacationSession` model (`id, vacationPeriodId, classId, date, startTime, endTime`) with Prisma-generated compound-unique accessor `classId_date` (mirrors `AttendanceRecord`'s `pupilId_date` from `@@unique([pupilId, date])`).

- [ ] **Step 1: Add the `VacationStatus` enum**

Insert immediately after the `ParentLinkStatus` enum (currently ends at line 69) in `server/prisma/schema.prisma`:

```prisma
enum VacationStatus {
  ACTIVE
  ENDED
}
```

- [ ] **Step 2: Add `vacationPeriods` relation to `TeacherProfile`**

Current model (lines 111-118):

```prisma
model TeacherProfile {
  userId        String         @id
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  teacherCode   String         @unique
  classes       Class[]
  notifications Notification[]
  goals         Goal[]
}
```

Change to:

```prisma
model TeacherProfile {
  userId          String            @id
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  teacherCode     String            @unique
  classes         Class[]
  notifications   Notification[]
  goals           Goal[]
  vacationPeriods VacationPeriod[]
}
```

- [ ] **Step 3: Add `vacationSessions` relation to `Class`**

Current model (lines 160-173):

```prisma
model Class {
  id            String         @id @default(cuid())
  teacherId     String
  teacher       TeacherProfile @relation(fields: [teacherId], references: [userId], onDelete: Cascade)
  name          String
  type          ClassType
  monthlyFee    Float?
  pupils        PupilProfile[]
  scheduleSlots ScheduleSlot[]
  posts         Post[]
  attendance    AttendanceRecord[]
  visitRequests VisitRequest[]
  createdAt     DateTime       @default(now())
}
```

Change to:

```prisma
model Class {
  id               String             @id @default(cuid())
  teacherId        String
  teacher          TeacherProfile     @relation(fields: [teacherId], references: [userId], onDelete: Cascade)
  name             String
  type             ClassType
  monthlyFee       Float?
  pupils           PupilProfile[]
  scheduleSlots    ScheduleSlot[]
  posts            Post[]
  attendance       AttendanceRecord[]
  visitRequests    VisitRequest[]
  vacationSessions VacationSession[]
  createdAt        DateTime           @default(now())
}
```

- [ ] **Step 4: Add `VacationPeriod` and `VacationSession` models**

Insert immediately after the `ScheduleSlot` model (currently ends at line 182):

```prisma
model VacationPeriod {
  id        String            @id @default(cuid())
  teacherId String
  teacher   TeacherProfile    @relation(fields: [teacherId], references: [userId], onDelete: Cascade)
  startDate DateTime
  endDate   DateTime
  status    VacationStatus    @default(ACTIVE)
  createdAt DateTime          @default(now())
  sessions  VacationSession[]

  @@index([teacherId, status])
}

model VacationSession {
  id               String         @id @default(cuid())
  vacationPeriodId String
  vacationPeriod   VacationPeriod @relation(fields: [vacationPeriodId], references: [id], onDelete: Cascade)
  classId          String
  class            Class          @relation(fields: [classId], references: [id], onDelete: Cascade)
  date             DateTime
  startTime        String
  endTime          String

  @@unique([classId, date])
  @@index([vacationPeriodId])
}
```

- [ ] **Step 5: Generate and apply the migration**

Run: `cd server && npx prisma migrate dev --name add_vacation_mode`
Expected: migration created under `server/prisma/migrations/`, applies cleanly against the dev database, and `npx prisma generate` runs as part of it (regenerates `@prisma/client` types, including `VacationPeriod`, `VacationSession`, `VacationStatus`, and the `classId_date` compound-unique input type).

- [ ] **Step 6: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(db): add VacationPeriod and VacationSession models"
```

---

## Task 2: `vacation.service.ts` — core CRUD + rules

**Files:**
- Create: `server/src/services/vacation.service.ts`
- Test: `server/src/services/vacation.service.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../utils/prisma.js` (Prisma client singleton, same import used by every other service).
- Produces (used by Task 3's controller, and by Task 7/8/9's cross-service calls):
  - `export class VacationError extends Error { constructor(message: string, public status = 400) }`
  - `getActiveVacationPeriod(teacherId: string): Promise<VacationPeriod | null>`
  - `startVacation(teacherId: string, startDate: string, endDate: string): Promise<VacationPeriod>` — dates are `YYYY-MM-DD` strings.
  - `endVacation(teacherId: string): Promise<VacationPeriod>`
  - `listVacationSessions(teacherId: string, classId: string): Promise<VacationSession[]>`
  - `addVacationSession(teacherId: string, classId: string, date: string, startTime: string, endTime: string): Promise<VacationSession>`
  - `removeVacationSession(teacherId: string, classId: string, sessionId: string): Promise<void>`
  - `getVacationSessionForDate(classId: string, date: Date): Promise<VacationSession | null>` — used directly by `attendance.service.ts` (Task 7), not teacher-scoped since attendance lookups already own-check the pupil/class elsewhere.
  - `getVacationScheduleEntries(teacherId: string): Promise<{ classId: string; className: string; classType: ClassType; date: string; startTime: string; endTime: string }[]>` — future (`date >= today`) sessions across every one of the teacher's classes with an ACTIVE vacation period, used by Task 8.
  - `getClassScheduleView(classId: string, teacherId: string): Promise<{ mode: "weekly"; slots: ScheduleSlotLike[] } | { mode: "vacation"; sessions: VacationSessionLike[] }>` — used by Task 9's pupil/parent schedule endpoints, where `teacherId` is the owning teacher of the pupil's class (not necessarily the requester).

- [ ] **Step 1: Write failing tests for `startVacation`**

Create `server/src/services/vacation.service.test.ts`:

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../utils/prisma.js";
import { hashPassword } from "../utils/password.js";
import {
  VacationError,
  addVacationSession,
  endVacation,
  getActiveVacationPeriod,
  getClassScheduleView,
  getVacationScheduleEntries,
  getVacationSessionForDate,
  listVacationSessions,
  removeVacationSession,
  startVacation,
} from "./vacation.service.js";

const TEST_EMAIL = `test-vacation-service-${Date.now()}@example.com`;
let teacherId: string;
let classId: string;

function isoDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Mirrors vacation.service.ts's internal parseDateOnly (local-midnight, not UTC)
// so lookups agree with how addVacationSession stored the row.
function localDateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

beforeAll(async () => {
  const passwordHash = await hashPassword("initial-Pass1");
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      name: "Vacation Service Test Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `VAC${Date.now()}` } },
    },
  });
  teacherId = user.id;

  const klass = await prisma.class.create({
    data: { teacherId, name: "Vacation Test Class", type: "MATH" },
  });
  classId = klass.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: teacherId } }).catch(() => {});
});

beforeEach(async () => {
  await prisma.vacationPeriod.deleteMany({ where: { teacherId } });
});

describe("startVacation", () => {
  it("creates an ACTIVE period for a valid date range", async () => {
    const period = await startVacation(teacherId, isoDaysFromNow(1), isoDaysFromNow(10));
    expect(period.status).toBe("ACTIVE");
    expect(period.teacherId).toBe(teacherId);
  });

  it("rejects endDate before startDate", async () => {
    await expect(startVacation(teacherId, isoDaysFromNow(10), isoDaysFromNow(1))).rejects.toThrow(VacationError);
  });

  it("rejects starting a second period while one is already ACTIVE", async () => {
    await startVacation(teacherId, isoDaysFromNow(1), isoDaysFromNow(10));
    await expect(startVacation(teacherId, isoDaysFromNow(1), isoDaysFromNow(5))).rejects.toThrow(VacationError);
  });
});

describe("getActiveVacationPeriod", () => {
  it("returns null when no period is active", async () => {
    expect(await getActiveVacationPeriod(teacherId)).toBeNull();
  });

  it("returns the ACTIVE period when one exists", async () => {
    const created = await startVacation(teacherId, isoDaysFromNow(1), isoDaysFromNow(10));
    const found = await getActiveVacationPeriod(teacherId);
    expect(found?.id).toBe(created.id);
  });
});

describe("addVacationSession / listVacationSessions / removeVacationSession", () => {
  it("rejects adding a session when no period is active", async () => {
    await expect(addVacationSession(teacherId, classId, isoDaysFromNow(2), "10:00", "11:00")).rejects.toThrow(
      VacationError
    );
  });

  it("rejects a date outside the active period's window", async () => {
    await startVacation(teacherId, isoDaysFromNow(1), isoDaysFromNow(5));
    await expect(addVacationSession(teacherId, classId, isoDaysFromNow(20), "10:00", "11:00")).rejects.toThrow(
      VacationError
    );
  });

  it("creates, lists, and removes an ad-hoc session inside the window", async () => {
    await startVacation(teacherId, isoDaysFromNow(1), isoDaysFromNow(10));
    const session = await addVacationSession(teacherId, classId, isoDaysFromNow(3), "10:00", "11:00");
    expect(session.classId).toBe(classId);

    const listed = await listVacationSessions(teacherId, classId);
    expect(listed.map((s) => s.id)).toContain(session.id);

    await removeVacationSession(teacherId, classId, session.id);
    const afterRemoval = await listVacationSessions(teacherId, classId);
    expect(afterRemoval.map((s) => s.id)).not.toContain(session.id);
  });

  it("rejects a second session for the same class on the same date", async () => {
    await startVacation(teacherId, isoDaysFromNow(1), isoDaysFromNow(10));
    await addVacationSession(teacherId, classId, isoDaysFromNow(3), "10:00", "11:00");
    await expect(addVacationSession(teacherId, classId, isoDaysFromNow(3), "14:00", "15:00")).rejects.toThrow(
      VacationError
    );
  });
});

describe("endVacation", () => {
  it("rejects when no period is active", async () => {
    await expect(endVacation(teacherId)).rejects.toThrow(VacationError);
  });

  it("marks the period ENDED and deletes future sessions but keeps past ones", async () => {
    await startVacation(teacherId, isoDaysFromNow(-5), isoDaysFromNow(10));
    const past = await addVacationSession(teacherId, classId, isoDaysFromNow(-1), "10:00", "11:00");
    const future = await addVacationSession(teacherId, classId, isoDaysFromNow(2), "10:00", "11:00");

    const ended = await endVacation(teacherId);
    expect(ended.status).toBe("ENDED");

    const remainingPast = await prisma.vacationSession.findUnique({ where: { id: past.id } });
    const remainingFuture = await prisma.vacationSession.findUnique({ where: { id: future.id } });
    expect(remainingPast).not.toBeNull();
    expect(remainingFuture).toBeNull();
  });
});

describe("getVacationSessionForDate", () => {
  it("returns null when there's no session for that class+date", async () => {
    expect(await getVacationSessionForDate(classId, localDateFromKey(isoDaysFromNow(3)))).toBeNull();
  });

  it("returns the session when one exists for that class+date", async () => {
    await startVacation(teacherId, isoDaysFromNow(1), isoDaysFromNow(10));
    const created = await addVacationSession(teacherId, classId, isoDaysFromNow(3), "10:00", "11:00");
    const found = await getVacationSessionForDate(classId, localDateFromKey(isoDaysFromNow(3)));
    expect(found?.id).toBe(created.id);
  });
});

describe("getVacationScheduleEntries", () => {
  it("returns only future sessions for classes under an ACTIVE period", async () => {
    await startVacation(teacherId, isoDaysFromNow(-2), isoDaysFromNow(10));
    await addVacationSession(teacherId, classId, isoDaysFromNow(-1), "09:00", "10:00");
    await addVacationSession(teacherId, classId, isoDaysFromNow(3), "10:00", "11:00");

    const entries = await getVacationScheduleEntries(teacherId);
    expect(entries.map((e) => e.date)).toEqual([isoDaysFromNow(3)]);
    expect(entries[0]?.classId).toBe(classId);
  });

  it("returns an empty list when no period is active", async () => {
    expect(await getVacationScheduleEntries(teacherId)).toEqual([]);
  });
});

describe("getClassScheduleView", () => {
  it("returns weekly mode with the class's slots when no vacation period is active", async () => {
    await prisma.scheduleSlot.create({ data: { classId, dayOfWeek: 2, startTime: "16:00", endTime: "17:00" } });
    const view = await getClassScheduleView(classId, teacherId);
    expect(view.mode).toBe("weekly");
    if (view.mode === "weekly") {
      expect(view.slots.some((s) => s.dayOfWeek === 2)).toBe(true);
    }
    await prisma.scheduleSlot.deleteMany({ where: { classId } });
  });

  it("returns vacation mode with dated sessions when a period is ACTIVE, even if empty", async () => {
    await startVacation(teacherId, isoDaysFromNow(1), isoDaysFromNow(10));
    const view = await getClassScheduleView(classId, teacherId);
    expect(view.mode).toBe("vacation");
    if (view.mode === "vacation") {
      expect(Array.isArray(view.sessions)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/services/vacation.service.test.ts`
Expected: FAIL — `Cannot find module './vacation.service.js'` (file doesn't exist yet).

- [ ] **Step 3: Implement `vacation.service.ts`**

Create `server/src/services/vacation.service.ts`:

```typescript
import { prisma } from "../utils/prisma.js";

export class VacationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function parseDateOnly(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function getActiveVacationPeriod(teacherId: string) {
  return prisma.vacationPeriod.findFirst({ where: { teacherId, status: "ACTIVE" } });
}

async function requireOwnedClass(teacherId: string, classId: string) {
  const klass = await prisma.class.findFirst({ where: { id: classId, teacherId } });
  if (!klass) throw new VacationError("Class not found.", 404);
  return klass;
}

export async function startVacation(teacherId: string, startDateKey: string, endDateKey: string) {
  const startDate = parseDateOnly(startDateKey);
  const endDate = parseDateOnly(endDateKey);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new VacationError("Invalid date.", 400);
  }
  if (endDate < startDate) {
    throw new VacationError("End date must be on or after the start date.", 400);
  }

  const existing = await getActiveVacationPeriod(teacherId);
  if (existing) {
    throw new VacationError("A vacation period is already active. End it before starting a new one.", 400);
  }

  return prisma.vacationPeriod.create({
    data: { teacherId, startDate, endDate, status: "ACTIVE" },
  });
}

export async function endVacation(teacherId: string) {
  const active = await getActiveVacationPeriod(teacherId);
  if (!active) throw new VacationError("No vacation period is currently active.", 400);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.vacationSession.deleteMany({
    where: { vacationPeriodId: active.id, date: { gt: today } },
  });

  return prisma.vacationPeriod.update({
    where: { id: active.id },
    data: { status: "ENDED" },
  });
}

export async function listVacationSessions(teacherId: string, classId: string) {
  await requireOwnedClass(teacherId, classId);
  const active = await getActiveVacationPeriod(teacherId);
  if (!active) return [];
  return prisma.vacationSession.findMany({
    where: { classId, vacationPeriodId: active.id },
    orderBy: { date: "asc" },
  });
}

export async function addVacationSession(
  teacherId: string,
  classId: string,
  dateKey: string,
  startTime: string,
  endTime: string
) {
  await requireOwnedClass(teacherId, classId);
  const active = await getActiveVacationPeriod(teacherId);
  if (!active) throw new VacationError("No vacation period is currently active.", 400);

  const date = parseDateOnly(dateKey);
  if (Number.isNaN(date.getTime())) throw new VacationError("Invalid date.", 400);
  if (date < active.startDate || date > active.endDate) {
    throw new VacationError("Date falls outside the active vacation period.", 400);
  }

  try {
    return await prisma.vacationSession.create({
      data: { vacationPeriodId: active.id, classId, date, startTime, endTime },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      throw new VacationError("This class already has an ad-hoc session on that date.", 409);
    }
    throw err;
  }
}

export async function removeVacationSession(teacherId: string, classId: string, sessionId: string) {
  await requireOwnedClass(teacherId, classId);
  const session = await prisma.vacationSession.findFirst({ where: { id: sessionId, classId } });
  if (!session) throw new VacationError("Vacation session not found.", 404);
  await prisma.vacationSession.delete({ where: { id: sessionId } });
}

export function getVacationSessionForDate(classId: string, date: Date) {
  return prisma.vacationSession.findUnique({ where: { classId_date: { classId, date } } });
}

export async function getVacationScheduleEntries(teacherId: string) {
  const active = await getActiveVacationPeriod(teacherId);
  if (!active) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessions = await prisma.vacationSession.findMany({
    where: { vacationPeriodId: active.id, date: { gte: today } },
    include: { class: true },
    orderBy: { date: "asc" },
  });

  return sessions.map((s) => ({
    classId: s.classId,
    className: s.class.name,
    classType: s.class.type,
    date: s.date.toISOString().slice(0, 10),
    startTime: s.startTime,
    endTime: s.endTime,
  }));
}

export async function getClassScheduleView(classId: string, teacherId: string) {
  const active = await getActiveVacationPeriod(teacherId);
  if (!active) {
    const slots = await prisma.scheduleSlot.findMany({ where: { classId } });
    return {
      mode: "weekly" as const,
      slots: slots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
    };
  }

  const sessions = await prisma.vacationSession.findMany({
    where: { classId, vacationPeriodId: active.id },
    orderBy: { date: "asc" },
  });
  return {
    mode: "vacation" as const,
    sessions: sessions.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run src/services/vacation.service.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/vacation.service.ts server/src/services/vacation.service.test.ts
git commit -m "feat: add vacation.service with start/end/session CRUD and schedule-view helpers"
```

---

## Task 3: `vacation.controller.ts` + route wiring

**Files:**
- Create: `server/src/controllers/vacation.controller.ts`
- Modify: `server/src/routes/teacher.routes.ts`

**Interfaces:**
- Consumes: every export from Task 2's `vacation.service.ts`.
- Produces: `currentVacationHandler, startVacationHandler, endVacationHandler, listVacationSessionsHandler, addVacationSessionHandler, removeVacationSessionHandler` — wired into `teacherRouter` under `/vacation` and `/classes/:id/vacation-sessions`.

- [ ] **Step 1: Implement the controller**

Create `server/src/controllers/vacation.controller.ts`:

```typescript
import type { Request, Response } from "express";
import { z } from "zod";
import {
  VacationError,
  addVacationSession,
  endVacation,
  getActiveVacationPeriod,
  listVacationSessions,
  removeVacationSession,
  startVacation,
} from "../services/vacation.service.js";

function handleVacationError(err: unknown, res: Response) {
  if (err instanceof VacationError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

export async function currentVacationHandler(req: Request, res: Response) {
  const period = await getActiveVacationPeriod(req.user!.id);
  res.json(period);
}

const startSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function startVacationHandler(req: Request, res: Response) {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const period = await startVacation(req.user!.id, parsed.data.startDate, parsed.data.endDate);
    res.status(201).json(period);
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}

export async function endVacationHandler(req: Request, res: Response) {
  try {
    const period = await endVacation(req.user!.id);
    res.json(period);
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}

export async function listVacationSessionsHandler(req: Request, res: Response) {
  try {
    const sessions = await listVacationSessions(req.user!.id, req.params.id as string);
    res.json(sessions);
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}

const addSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function addVacationSessionHandler(req: Request, res: Response) {
  const parsed = addSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const session = await addVacationSession(
      req.user!.id,
      req.params.id as string,
      parsed.data.date,
      parsed.data.startTime,
      parsed.data.endTime
    );
    res.status(201).json(session);
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}

export async function removeVacationSessionHandler(req: Request, res: Response) {
  try {
    await removeVacationSession(req.user!.id, req.params.id as string, req.params.sessionId as string);
    res.status(204).send();
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}
```

- [ ] **Step 2: Wire routes**

In `server/src/routes/teacher.routes.ts`, add the import (after the existing `attendance.controller.js` import block, currently lines 45-50):

```typescript
import {
  addVacationSessionHandler,
  currentVacationHandler,
  endVacationHandler,
  listVacationSessionsHandler,
  removeVacationSessionHandler,
  startVacationHandler,
} from "../controllers/vacation.controller.js";
```

Then add routes after the existing `/classes/:id/parent-requests` line (currently line 64) and before the `/pupils/:pupilId` block:

```typescript
teacherRouter.get("/vacation/current", currentVacationHandler);
teacherRouter.post("/vacation/start", startVacationHandler);
teacherRouter.post("/vacation/end", endVacationHandler);
teacherRouter.get("/classes/:id/vacation-sessions", listVacationSessionsHandler);
teacherRouter.post("/classes/:id/vacation-sessions", addVacationSessionHandler);
teacherRouter.delete("/classes/:id/vacation-sessions/:sessionId", removeVacationSessionHandler);
```

- [ ] **Step 3: Manually verify routes are reachable**

Run: `cd server && npm run dev` (in one terminal), then in another:
`curl -i -X GET http://localhost:3000/teacher/vacation/current -H "Cookie: <a valid session cookie>"`
Expected: `401` without a cookie (auth middleware engages), not a 404 — confirms the route is mounted. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add server/src/controllers/vacation.controller.ts server/src/routes/teacher.routes.ts
git commit -m "feat: add vacation controller and mount routes under /teacher/vacation"
```

---

## Task 4: Client vacation types + API functions

**Files:**
- Modify: `client/src/api/types.ts`
- Modify: `client/src/api/teacher.ts`

**Interfaces:**
- Produces: `VacationStatus`, `VacationPeriod`, `VacationSessionEntry`, `ScheduleViewResponse` types; `fetchCurrentVacation, startVacation, endVacation, fetchVacationSessions, addVacationSession, removeVacationSession` functions — consumed by Tasks 5, 6, 9.
- Also widens `ScheduleEntry` (currently all-required `dayOfWeek/startTime/endTime`) to support the vacation-sourced, date-based shape consumed by Task 8's `UpcomingSchedule.tsx`.

- [ ] **Step 1: Add vacation types to `client/src/api/types.ts`**

Add after the existing `ScheduleSlot` interface (currently lines 31-36):

```typescript
export type VacationStatus = "ACTIVE" | "ENDED";

export interface VacationPeriod {
  id: string;
  teacherId: string;
  startDate: string;
  endDate: string;
  status: VacationStatus;
  createdAt: string;
}

export interface VacationSessionEntry {
  id: string;
  vacationPeriodId: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export type ScheduleViewResponse =
  | { mode: "weekly"; slots: ScheduleSlot[] }
  | { mode: "vacation"; sessions: { date: string; startTime: string; endTime: string }[] };
```

- [ ] **Step 2: Widen `ScheduleEntry` for the vacation-sourced shape**

Replace the current `ScheduleEntry` interface (lines 111-118):

```typescript
export interface ScheduleEntry {
  classId: string;
  className: string;
  classType: ClassType;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
```

with:

```typescript
export interface ScheduleEntry {
  classId: string;
  className: string;
  classType: ClassType;
  startTime: string;
  endTime: string;
  dayOfWeek?: number;
  date?: string;
}
```

- [ ] **Step 3: Add vacation API functions to `client/src/api/teacher.ts`**

Add `VacationPeriod` and `VacationSessionEntry` to the existing type-only import block (currently lines 2-23), and add these functions at the end of the file:

```typescript
export async function fetchCurrentVacation(): Promise<VacationPeriod | null> {
  const { data } = await api.get("/teacher/vacation/current");
  return data;
}

export async function startVacation(startDate: string, endDate: string): Promise<VacationPeriod> {
  const { data } = await api.post("/teacher/vacation/start", { startDate, endDate });
  return data;
}

export async function endVacation(): Promise<VacationPeriod> {
  const { data } = await api.post("/teacher/vacation/end");
  return data;
}

export async function fetchVacationSessions(classId: string): Promise<VacationSessionEntry[]> {
  const { data } = await api.get(`/teacher/classes/${classId}/vacation-sessions`);
  return data;
}

export async function addVacationSession(
  classId: string,
  input: { date: string; startTime: string; endTime: string }
): Promise<VacationSessionEntry> {
  const { data } = await api.post(`/teacher/classes/${classId}/vacation-sessions`, input);
  return data;
}

export async function removeVacationSession(classId: string, sessionId: string) {
  await api.delete(`/teacher/classes/${classId}/vacation-sessions/${sessionId}`);
}
```

- [ ] **Step 4: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no errors (existing `ScheduleEntry` consumer `UpcomingSchedule.tsx` still compiles since it only reads `dayOfWeek`/`startTime`/`endTime`, all still valid optional/required reads — `dayOfWeek` becomes possibly-undefined there, which Task 8 addresses).

Note: this step may show a new error in `UpcomingSchedule.tsx` because `entry.dayOfWeek` is now `number | undefined` and the file does arithmetic on it directly. That's expected — Task 8 fixes `UpcomingSchedule.tsx` itself. Confirm the *only* new errors are in `UpcomingSchedule.tsx`; if there are others, stop and investigate before continuing.

- [ ] **Step 5: Commit**

```bash
git add client/src/api/types.ts client/src/api/teacher.ts
git commit -m "feat: add client vacation types and API functions"
```

---

## Task 5: Classes page vacation toggle UI

**Files:**
- Modify: `client/src/features/teacher/ClassesPage.tsx`
- Test: `client/src/features/teacher/VacationBanner.test.tsx` (new file)

**Interfaces:**
- Consumes: `fetchCurrentVacation, startVacation, endVacation` from `../../api/teacher` (Task 4).
- Produces: `VacationBanner` exported from `ClassesPage.tsx` (exported specifically so `VacationBanner.test.tsx` can import it directly, matching the spec's requirement for a toggle/date-picker component test).

- [ ] **Step 1: Add imports and the `VacationBanner` component**

In `client/src/features/teacher/ClassesPage.tsx`, add to the existing `"../../api/teacher"` import list (currently lines 17-29): `endVacation`, `fetchCurrentVacation`, `startVacation as startVacationApi`.

Add a new component after `ParentRequestRow` (currently ends line 214) and before `export function ClassesPage()`:

```typescript
export function VacationBanner() {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const vacationQuery = useQuery({ queryKey: ["teacher", "vacation"], queryFn: fetchCurrentVacation });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["teacher", "vacation"] });
    queryClient.invalidateQueries({ queryKey: ["teacher", "overview"] });
  };

  const startMutation = useMutation({
    mutationFn: () => startVacationApi(startDate, endDate),
    onSuccess: () => {
      toast.success("Vacation mode started.");
      setPickerOpen(false);
      setStartDate("");
      setEndDate("");
      invalidate();
    },
  });

  const endMutation = useMutation({
    mutationFn: () => endVacation(),
    onSuccess: () => {
      toast.success("Vacation mode ended. Weekly schedules have resumed.");
      invalidate();
    },
  });

  if (vacationQuery.isLoading) return null;
  const period = vacationQuery.data;

  return (
    <Card className="mb-6 p-5">
      {period ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-ink-700">Vacation mode is active</h2>
            <p className="mt-1 text-xs text-ink-500">
              {new Date(period.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
              {new Date(period.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => endMutation.mutate()} disabled={endMutation.isPending}>
            {endMutation.isPending ? "Ending…" : "End vacation mode"}
          </Button>
        </div>
      ) : pickerOpen ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            startMutation.mutate();
          }}
        >
          <div>
            <label htmlFor="vacation-start" className="text-xs font-medium text-ink-700">
              Start date
            </label>
            <input
              id="vacation-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="focus-ring mt-1 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
            />
          </div>
          <div>
            <label htmlFor="vacation-end" className="text-xs font-medium text-ink-700">
              End date
            </label>
            <input
              id="vacation-end"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="focus-ring mt-1 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
            />
          </div>
          <Button size="sm" type="submit" disabled={startMutation.isPending}>
            {startMutation.isPending ? "Starting…" : "Start"}
          </Button>
          <Button size="sm" variant="secondary" type="button" onClick={() => setPickerOpen(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-ink-700">Vacation mode</h2>
            <p className="mt-1 text-xs text-ink-500">
              Suspend the weekly schedule for a date range and pick one-off sessions per class instead.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
            Start vacation mode
          </Button>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Render it above "Pending requests"**

In the `ClassesPage` component's JSX, insert `<VacationBanner />` immediately after the closing `</div>` of the header block (currently line 333, right before `<section className="mt-6">` on line 335):

```tsx
        </div>

        <VacationBanner />

        <section className="mt-6">
```

- [ ] **Step 3: Write a component test for `VacationBanner`**

Create `client/src/features/teacher/VacationBanner.test.tsx`. This is the repo's first TanStack-Query-backed component test, so it wraps renders in a `QueryClientProvider` and mocks the three vacation API functions the component calls:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { VacationBanner } from "./ClassesPage";
import type { VacationPeriod } from "../../api/types";

const { fetchCurrentVacationMock } = vi.hoisted(() => ({
  fetchCurrentVacationMock: vi.fn(),
}));

vi.mock("../../api/teacher", async () => {
  const actual = await vi.importActual<typeof import("../../api/teacher")>("../../api/teacher");
  return { ...actual, fetchCurrentVacation: fetchCurrentVacationMock };
});

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("VacationBanner", () => {
  it("shows the start button when no vacation period is active", async () => {
    fetchCurrentVacationMock.mockResolvedValue(null);
    renderWithClient(<VacationBanner />);
    expect(await screen.findByText("Start vacation mode")).toBeInTheDocument();
  });

  it("opens the date-range form when Start vacation mode is clicked", async () => {
    fetchCurrentVacationMock.mockResolvedValue(null);
    renderWithClient(<VacationBanner />);
    fireEvent.click(await screen.findByText("Start vacation mode"));
    expect(await screen.findByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
  });

  it("shows the active range and an End button when a period is active", async () => {
    const period: VacationPeriod = {
      id: "vp1",
      teacherId: "t1",
      startDate: "2026-09-10",
      endDate: "2026-09-20",
      status: "ACTIVE",
      createdAt: "2026-09-01",
    };
    fetchCurrentVacationMock.mockResolvedValue(period);
    renderWithClient(<VacationBanner />);
    expect(await screen.findByText("Vacation mode is active")).toBeInTheDocument();
    expect(screen.getByText("End vacation mode")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/teacher/VacationBanner.test.tsx`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify in the browser**

Start the client dev server and the API server, log in as a teacher, open Class Management. Confirm: the banner shows "Start vacation mode"; clicking it reveals a date-range form; submitting valid dates flips the banner to "Vacation mode is active" with the chosen range and an "End vacation mode" button; clicking that reverts to the initial state.

- [ ] **Step 7: Commit**

```bash
git add client/src/features/teacher/ClassesPage.tsx client/src/features/teacher/VacationBanner.test.tsx
git commit -m "feat: add vacation mode toggle banner to Classes page"
```

---

## Task 6: Class Detail ad-hoc session builder UI

**Files:**
- Modify: `client/src/features/teacher/ClassDetailPage.tsx`
- Test: `client/src/features/teacher/VacationSessionsPanel.test.tsx` (new file)

**Interfaces:**
- Consumes: `fetchCurrentVacation, fetchVacationSessions, addVacationSession, removeVacationSession` from `../../api/teacher` (Task 4).
- Produces: `VacationSessionsPanel` exported from `ClassDetailPage.tsx` (exported specifically so `VacationSessionsPanel.test.tsx` can import it directly, matching the spec's requirement for a per-class ad-hoc session builder component test).

- [ ] **Step 1: Add imports and the `VacationSessionsPanel` component**

Add to the existing `"../../api/teacher"` import list (currently lines 6-15): `addVacationSession`, `fetchCurrentVacation`, `fetchVacationSessions`, `removeVacationSession`. Add `X` is already imported; also import `VacationSessionEntry` as a type in the existing type-only import (currently line 23: `import type { PaymentStatus, PupilSummary, ScheduleSlot } from "../../api/types";` → add `VacationSessionEntry`).

Add a new component after the closing of the `ClassDetailPage` function's imports section, i.e. as a sibling function before `export function ClassDetailPage()`:

```typescript
export function VacationSessionsPanel({ classId }: { classId: string }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");

  const vacationQuery = useQuery({ queryKey: ["teacher", "vacation"], queryFn: fetchCurrentVacation });
  const sessionsQuery = useQuery({
    queryKey: ["teacher", "classes", classId, "vacation-sessions"],
    queryFn: () => fetchVacationSessions(classId),
    enabled: !!vacationQuery.data,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["teacher", "classes", classId, "vacation-sessions"] });

  const addMutation = useMutation({
    mutationFn: () => addVacationSession(classId, { date, startTime, endTime }),
    onSuccess: () => {
      toast.success("Ad-hoc session added.");
      setDate("");
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (sessionId: string) => removeVacationSession(classId, sessionId),
    onSuccess: invalidate,
  });

  const period = vacationQuery.data;
  if (!period) return null;

  const sessions: VacationSessionEntry[] = sessionsQuery.data ?? [];

  return (
    <Card className="mt-6 p-5">
      <h2 className="text-sm font-medium text-ink-700">Vacation sessions</h2>
      <p className="mt-1 text-xs text-ink-400">
        One-off sessions for this class between{" "}
        {new Date(period.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} and{" "}
        {new Date(period.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.
      </p>

      <div className="mt-3 space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-28 text-xs text-ink-700">
              {new Date(s.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <span className="text-xs text-ink-700">
              {s.startTime}–{s.endTime}
            </span>
            <button
              onClick={() => removeMutation.mutate(s.id)}
              className="focus-ring ml-auto rounded-sm text-ink-400 hover:text-danger-600"
              aria-label={`Remove vacation session on ${s.date}`}
            >
              <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p className="text-xs text-ink-400">No ad-hoc sessions added yet.</p>}
      </div>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addMutation.mutate();
        }}
      >
        <input
          type="date"
          required
          min={period.startDate.slice(0, 10)}
          max={period.endDate.slice(0, 10)}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="focus-ring rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="focus-ring w-24 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="focus-ring w-24 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
        />
        <Button size="sm" type="submit" disabled={addMutation.isPending || !date}>
          {addMutation.isPending ? "Adding…" : "Add session"}
        </Button>
      </form>
    </Card>
  );
}
```

- [ ] **Step 2: Render it in `ClassDetailPage`**

Insert `<VacationSessionsPanel classId={id!} />` right after the closing `</div>` of the two-column grid (currently line 268, before the "Upcoming visitors" `Card` at line 270):

```tsx
      </div>

      <VacationSessionsPanel classId={id!} />

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-medium text-ink-700">Upcoming visitors</h2>
```

- [ ] **Step 3: Write a component test for `VacationSessionsPanel`**

Create `client/src/features/teacher/VacationSessionsPanel.test.tsx`, following the same `QueryClientProvider` + `vi.mock` pattern as `VacationBanner.test.tsx` (Task 5):

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { VacationSessionsPanel } from "./ClassDetailPage";
import type { VacationPeriod, VacationSessionEntry } from "../../api/types";

const { fetchCurrentVacationMock, fetchVacationSessionsMock } = vi.hoisted(() => ({
  fetchCurrentVacationMock: vi.fn(),
  fetchVacationSessionsMock: vi.fn(),
}));

vi.mock("../../api/teacher", async () => {
  const actual = await vi.importActual<typeof import("../../api/teacher")>("../../api/teacher");
  return {
    ...actual,
    fetchCurrentVacation: fetchCurrentVacationMock,
    fetchVacationSessions: fetchVacationSessionsMock,
  };
});

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const activePeriod: VacationPeriod = {
  id: "vp1",
  teacherId: "t1",
  startDate: "2026-09-10",
  endDate: "2026-09-20",
  status: "ACTIVE",
  createdAt: "2026-09-01",
};

describe("VacationSessionsPanel", () => {
  it("renders nothing when no vacation period is active", async () => {
    fetchCurrentVacationMock.mockResolvedValue(null);
    const { container } = renderWithClient(<VacationSessionsPanel classId="c1" />);
    await waitFor(() => expect(fetchCurrentVacationMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows an empty-list message when a period is active with no sessions yet", async () => {
    fetchCurrentVacationMock.mockResolvedValue(activePeriod);
    fetchVacationSessionsMock.mockResolvedValue([]);
    renderWithClient(<VacationSessionsPanel classId="c1" />);
    expect(await screen.findByText("No ad-hoc sessions added yet.")).toBeInTheDocument();
  });

  it("lists existing ad-hoc sessions for the class", async () => {
    fetchCurrentVacationMock.mockResolvedValue(activePeriod);
    const session: VacationSessionEntry = {
      id: "s1",
      vacationPeriodId: "vp1",
      classId: "c1",
      date: "2026-09-12",
      startTime: "10:00",
      endTime: "11:00",
    };
    fetchVacationSessionsMock.mockResolvedValue([session]);
    renderWithClient(<VacationSessionsPanel classId="c1" />);
    expect(await screen.findByText("10:00–11:00")).toBeInTheDocument();
  });
});
```

Note on the first test: `VacationSessionsPanel` returns `null` while `vacationQuery` is loading too, so asserting `toBeEmptyDOMElement()` only after the query settles requires waiting for the mocked promise to resolve first — the `screen.findByText(...).catch(() => {})` line is a lightweight way to flush pending microtasks before the assertion; if this proves flaky in Step 4, replace it with `await waitFor(() => expect(fetchCurrentVacationMock).toHaveBeenCalled())` from `@testing-library/react` instead.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/features/teacher/VacationSessionsPanel.test.tsx`
Expected: PASS (all 3 cases). If the first case is flaky, apply the `waitFor` fix noted in Step 3 and re-run.

- [ ] **Step 5: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify in the browser**

With vacation mode inactive, open a class detail page — confirm no "Vacation sessions" panel appears. Start vacation mode from the Classes page, return to the class detail page, confirm the panel appears with an empty list and a date-constrained form; add a session and confirm it lists; remove it and confirm it disappears.

- [ ] **Step 7: Commit**

```bash
git add client/src/features/teacher/ClassDetailPage.tsx client/src/features/teacher/VacationSessionsPanel.test.tsx
git commit -m "feat: add per-class ad-hoc vacation session builder to Class Detail page"
```

---

## Task 7: `attendance.service.ts` vacation-awareness

**Files:**
- Modify: `server/src/services/attendance.service.ts`
- Test: `server/src/services/attendance.service.test.ts` (new file)

**Interfaces:**
- Consumes: `getVacationSessionForDate` from `./vacation.service.js` (Task 2); Prisma `vacationSession.findMany` for building the per-month map.
- Produces: unchanged public signatures for `getAttendanceCalendar`, `getOwnAttendanceCalendar`, `markAttendance` — behavior only.

- [ ] **Step 1: Write failing tests**

Create `server/src/services/attendance.service.test.ts`. Dates are computed relative to `new Date()` at test-run time, never hardcoded, so the suite stays valid regardless of when it runs:

```typescript
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../utils/prisma.js";
import { hashPassword } from "../utils/password.js";
import { getAttendanceCalendar, markAttendance } from "./attendance.service.js";
import { addVacationSession, startVacation } from "./vacation.service.js";

const TEST_EMAIL = `test-attendance-vacation-${Date.now()}@example.com`;
let teacherId: string;
let pupilId: string;
let classId: string;

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A weekday that currently has no ScheduleSlot for the test class, so we can
// prove vacation sessions work even on days the weekly pattern doesn't cover.
function unscheduledWeekdayOffset(scheduledDay: number): number {
  for (let offset = -3; offset <= 3; offset++) {
    const candidate = daysFromNow(offset);
    if (candidate.getDay() !== scheduledDay) return offset;
  }
  throw new Error("unreachable");
}

beforeAll(async () => {
  const passwordHash = await hashPassword("initial-Pass1");
  const teacher = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      name: "Attendance Vacation Test Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `ATV${Date.now()}` } },
    },
  });
  teacherId = teacher.id;

  const klass = await prisma.class.create({ data: { teacherId, name: "Attendance Vacation Class", type: "MATH" } });
  classId = klass.id;

  const scheduledDay = 1; // Monday — arbitrary fixed weekday for the recurring slot.
  await prisma.scheduleSlot.create({ data: { classId, dayOfWeek: scheduledDay, startTime: "09:00", endTime: "10:00" } });

  const pupil = await prisma.user.create({
    data: {
      email: `test-attendance-vacation-pupil-${Date.now()}@example.com`,
      passwordHash,
      name: "Attendance Vacation Test Pupil",
      role: "PUPIL",
      status: "ACTIVE",
      pupilProfile: {
        create: { requestedType: "MATH", teacherId, classId, parentCode: `PAV${Date.now()}` },
      },
    },
  });
  pupilId = pupil.userId ?? pupil.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: pupilId } }).catch(() => {});
  await prisma.user.delete({ where: { id: teacherId } }).catch(() => {});
});

beforeEach(async () => {
  await prisma.vacationPeriod.deleteMany({ where: { teacherId } });
  await prisma.attendanceRecord.deleteMany({ where: { pupilId } });
});

describe("getAttendanceCalendar with an active vacation period", () => {
  it("surfaces a vacation-day entry using the ad-hoc time even on an otherwise-unscheduled weekday", async () => {
    const targetDate = daysFromNow(unscheduledWeekdayOffset(1));
    await startVacation(teacherId, dateKey(daysFromNow(-3)), dateKey(daysFromNow(10)));
    await addVacationSession(teacherId, classId, dateKey(targetDate), "13:00", "14:30");

    const period = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
    const calendar = await getAttendanceCalendar(teacherId, pupilId, period);
    const day = calendar.days.find((d) => d.date === dateKey(targetDate));

    expect(day).toBeDefined();
    expect(day?.startTime).toBe("13:00");
    expect(day?.endTime).toBe("14:30");
  });
});

describe("markAttendance with an active vacation period", () => {
  it("allows marking attendance on a vacation-day that isn't in the weekly pattern", async () => {
    const safeDate = daysFromNow(unscheduledWeekdayOffset(1));
    await startVacation(teacherId, dateKey(daysFromNow(-3)), dateKey(daysFromNow(10)));
    await addVacationSession(teacherId, classId, dateKey(safeDate), "13:00", "14:30");

    const record = await markAttendance(teacherId, pupilId, dateKey(safeDate), "PRESENT");
    expect(record.status).toBe("PRESENT");
  });

  it("still rejects an unscheduled day with no vacation session", async () => {
    const noSessionDate = daysFromNow(unscheduledWeekdayOffset(1));
    await expect(markAttendance(teacherId, pupilId, dateKey(noSessionDate), "PRESENT")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run src/services/attendance.service.test.ts`
Expected: FAIL — the vacation-day entry's `startTime`/`endTime` come back as the `ScheduleSlot`-derived values (or the day is missing/`markAttendance` throws), not the ad-hoc `13:00`/`14:30`, because the vacation branch doesn't exist yet.

- [ ] **Step 3: Implement the vacation branch in `getAttendanceCalendar` and `getOwnAttendanceCalendar`**

In `server/src/services/attendance.service.ts`, add the import at the top (after line 3):

```typescript
import { getVacationSessionForDate } from "./vacation.service.js";
```

In both `getAttendanceCalendar` (lines 48-110) and `getOwnAttendanceCalendar` (lines 112-179), apply the same diff. Using `getAttendanceCalendar` as the concrete example — replace:

```typescript
  const scheduledDays = new Set(pupil.class.scheduleSlots.map((s) => s.dayOfWeek));
  const slotByDay = new Map(pupil.class.scheduleSlots.map((s) => [s.dayOfWeek, s]));

  const today = new Date();
  const todayKey = toDateKey(today);

  const daysInMonth = new Date(year!, month!, 0).getDate();
  const monthStart = new Date(year!, month! - 1, 1);
  const monthEnd = new Date(year!, month!, 0, 23, 59, 59, 999);

  const records =
    scheduledDays.size > 0
      ? await prisma.attendanceRecord.findMany({
          where: { pupilId, classId: pupil.classId, date: { gte: monthStart, lte: monthEnd } },
        })
      : [];
  const recordByKey = new Map(records.map((r) => [toDateKey(r.date), r.status]));
```

with:

```typescript
  const scheduledDays = new Set(pupil.class.scheduleSlots.map((s) => s.dayOfWeek));
  const slotByDay = new Map(pupil.class.scheduleSlots.map((s) => [s.dayOfWeek, s]));

  const today = new Date();
  const todayKey = toDateKey(today);

  const daysInMonth = new Date(year!, month!, 0).getDate();
  const monthStart = new Date(year!, month! - 1, 1);
  const monthEnd = new Date(year!, month!, 0, 23, 59, 59, 999);

  const vacationSessions = await prisma.vacationSession.findMany({
    where: { classId: pupil.classId, date: { gte: monthStart, lte: monthEnd } },
  });
  const vacationByKey = new Map(vacationSessions.map((v) => [toDateKey(v.date), v]));

  const records =
    scheduledDays.size > 0 || vacationByKey.size > 0
      ? await prisma.attendanceRecord.findMany({
          where: { pupilId, classId: pupil.classId, date: { gte: monthStart, lte: monthEnd } },
        })
      : [];
  const recordByKey = new Map(records.map((r) => [toDateKey(r.date), r.status]));
```

Then replace the day loop:

```typescript
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year!, month! - 1, day);
    const dayOfWeek = date.getDay();
    if (!scheduledDays.has(dayOfWeek)) continue;
    const slot = slotByDay.get(dayOfWeek)!;
    const key = toDateKey(date);
    const record = recordByKey.get(key) ?? null;
```

with:

```typescript
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year!, month! - 1, day);
    const dayOfWeek = date.getDay();
    const key = toDateKey(date);
    const vacationSlot = vacationByKey.get(key);
    if (!vacationSlot && !scheduledDays.has(dayOfWeek)) continue;
    const slot = vacationSlot ?? slotByDay.get(dayOfWeek)!;
    const record = recordByKey.get(key) ?? null;
```

(The rest of each loop body — the `display` computation and `days.push(...)` — is unchanged; `slot.startTime`/`slot.endTime` now correctly resolve from either source.)

Apply the identical diff to `getOwnAttendanceCalendar` (same code shape, lines 126-170 in the pre-change file).

- [ ] **Step 4: Implement the `markAttendance` bypass**

Replace (current lines 216-219):

```typescript
  const scheduledDays = new Set(pupil.class.scheduleSlots.map((s) => s.dayOfWeek));
  if (!scheduledDays.has(date.getDay())) {
    throw new AttendanceError("This pupil's class has no session scheduled on that day.", 400);
  }
```

with:

```typescript
  const vacationSession = await getVacationSessionForDate(pupil.classId, date);
  if (!vacationSession) {
    const scheduledDays = new Set(pupil.class.scheduleSlots.map((s) => s.dayOfWeek));
    if (!scheduledDays.has(date.getDay())) {
      throw new AttendanceError("This pupil's class has no session scheduled on that day.", 400);
    }
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx vitest run src/services/attendance.service.test.ts`
Expected: PASS. Also re-run the full server suite to confirm no regressions: `cd server && npm test`.

- [ ] **Step 6: Commit**

```bash
git add server/src/services/attendance.service.ts server/src/services/attendance.service.test.ts
git commit -m "feat: make attendance calendar and markAttendance vacation-aware"
```

---

## Task 8: Teacher Overview vacation-awareness

**Files:**
- Modify: `server/src/controllers/teacher.controller.ts`
- Modify: `client/src/features/teacher/UpcomingSchedule.tsx`

**Interfaces:**
- Consumes: `getActiveVacationPeriod`, `getVacationScheduleEntries` from `../services/vacation.service.js` (Task 2); `ScheduleEntry`'s widened `dayOfWeek?`/`date?` shape (Task 4).

- [ ] **Step 1: Branch `overview()` on vacation status**

In `server/src/controllers/teacher.controller.ts`, add the import (after line 45's `parent.service.js` import block):

```typescript
import { getActiveVacationPeriod, getVacationScheduleEntries } from "../services/vacation.service.js";
```

Replace the `schedule` computation (current lines 80-89):

```typescript
  const schedule = classes.flatMap((c) =>
    c.scheduleSlots.map((s) => ({
      classId: c.id,
      className: c.name,
      classType: c.type,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }))
  );
```

with:

```typescript
  const activeVacation = await getActiveVacationPeriod(teacherId);
  const schedule = activeVacation
    ? await getVacationScheduleEntries(teacherId)
    : classes.flatMap((c) =>
        c.scheduleSlots.map((s) => ({
          classId: c.id,
          className: c.name,
          classType: c.type,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
        }))
      );
```

- [ ] **Step 2: Rewrite `UpcomingSchedule.tsx` to branch per-entry on `date` vs `dayOfWeek`**

Replace the full contents of `client/src/features/teacher/UpcomingSchedule.tsx`:

```tsx
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { ClassTypeBadge } from "../../components/Badge";
import { EmptyState } from "../../components/Feedback";
import { DAY_NAMES } from "../../lib/period";
import type { ScheduleEntry } from "../../api/types";

function minutesSinceMidnight(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function weeklyDayLabel(offsetDays: number, dayOfWeek: number): string {
  if (offsetDays === 0) return "Today";
  if (offsetDays === 1) return "Tomorrow";
  return DAY_NAMES[dayOfWeek] ?? "";
}

function vacationDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offsetDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (offsetDays === 0) return "Today";
  if (offsetDays === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

interface RankedEntry extends ScheduleEntry {
  sortKey: number;
  label: string;
}

export function UpcomingSchedule({ schedule }: { schedule: ScheduleEntry[] }) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();

  const upcoming: RankedEntry[] = schedule
    .map((entry) => {
      if (entry.date) {
        const entryDate = new Date(`${entry.date}T00:00:00`);
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        const offsetDays = Math.round((entryDate.getTime() - todayMidnight.getTime()) / 86_400_000);
        const sortKey = offsetDays * 1440 + minutesSinceMidnight(entry.startTime);
        return { ...entry, sortKey, label: vacationDayLabel(entry.date) };
      }

      const dayOfWeek = entry.dayOfWeek ?? 0;
      let offsetDays = (dayOfWeek - today + 7) % 7;
      if (offsetDays === 0 && minutesSinceMidnight(entry.endTime) <= nowMinutes) {
        offsetDays = 7;
      }
      const sortKey = offsetDays * 1440 + minutesSinceMidnight(entry.startTime);
      return { ...entry, sortKey, label: weeklyDayLabel(offsetDays, dayOfWeek) };
    })
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 5);

  return (
    <Card className="p-6">
      <h2 className="text-sm font-medium text-ink-700">Upcoming sessions</h2>
      {upcoming.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No scheduled sessions"
            description="Add a weekly schedule from a class's detail page."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {upcoming.map((entry, i) => (
            <li key={`${entry.classId}-${entry.date ?? entry.dayOfWeek}-${entry.startTime}-${i}`}>
              <Link
                to={`/teacher/classes/${entry.classId}`}
                className="focus-ring flex items-center justify-between rounded-sm px-2 py-2 -mx-2 transition-colors hover:bg-canvas"
              >
                <div className="flex items-center gap-3">
                  <div className="flex w-16 flex-col items-center rounded-sm border border-border bg-canvas py-1.5">
                    <span className="text-[11px] font-medium uppercase text-ink-500">{entry.label}</span>
                    <span className="text-xs font-semibold text-ink-900">{entry.startTime}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900">{entry.className}</p>
                    <p className="text-xs text-ink-400">
                      {entry.startTime}–{entry.endTime}
                    </p>
                  </div>
                </div>
                <ClassTypeBadge type={entry.classType} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck both workspaces**

Run: `cd server && npx tsc -p tsconfig.json --noEmit && cd ../client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify in the browser**

Without vacation mode: confirm Teacher Overview's "Upcoming sessions" widget still shows weekday-labeled entries as before. Start vacation mode and add a couple of ad-hoc sessions to a class from Task 6's panel; confirm the widget now shows those sessions with real-date labels ("Today"/"Tomorrow"/"Mon, Oct 5") instead of weekday recurrence.

- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/teacher.controller.ts client/src/features/teacher/UpcomingSchedule.tsx
git commit -m "feat: source teacher overview's upcoming sessions from vacation data when active"
```

---

## Task 9: Pupil/Parent schedule vacation-awareness

**Files:**
- Modify: `server/src/controllers/pupil.controller.ts`
- Modify: `server/src/services/parent.service.ts`
- Modify: `client/src/api/pupil.ts`
- Modify: `client/src/api/parent.ts`
- Create: `client/src/components/ScheduleView.tsx`
- Test: `client/src/components/ScheduleView.test.tsx`
- Modify: `client/src/features/pupil/SchedulePage.tsx`
- Modify: `client/src/features/parent/SchedulePage.tsx`

**Interfaces:**
- Consumes: `getClassScheduleView` from `server/src/services/vacation.service.js` (Task 2); `ScheduleViewResponse` type (Task 4).
- Produces: shared `<ScheduleView data={ScheduleViewResponse} className={string} />` component used by both `SchedulePage.tsx` files.

- [ ] **Step 1: Update `pupil.controller.ts`'s `schedule` handler**

In `server/src/controllers/pupil.controller.ts`, add the import (after line 5):

```typescript
import { getClassScheduleView } from "../services/vacation.service.js";
```

Replace the `schedule` handler (current lines 55-62):

```typescript
export async function schedule(req: Request, res: Response) {
  const profile = await getPupilProfileWithClass(req.user!.id);
  if (!profile?.class) {
    res.status(404).json({ error: "Not yet assigned to a class." });
    return;
  }
  res.json({ className: profile.class.name, slots: profile.class.scheduleSlots });
}
```

with:

```typescript
export async function schedule(req: Request, res: Response) {
  const profile = await getPupilProfileWithClass(req.user!.id);
  if (!profile?.class) {
    res.status(404).json({ error: "Not yet assigned to a class." });
    return;
  }
  const view = await getClassScheduleView(profile.classId!, profile.class.teacher.userId);
  res.json({ className: profile.class.name, ...view });
}
```

- [ ] **Step 2: Update `parent.service.ts`'s `getChildSchedule`**

In `server/src/services/parent.service.ts`, add the import (after line 6):

```typescript
import { getClassScheduleView } from "./vacation.service.js";
```

Replace `getChildSchedule` (current lines 100-105):

```typescript
export async function getChildSchedule(parentId: string, pupilId: string) {
  await assertActiveLink(parentId, pupilId);
  const profile = await getPupilProfileWithClass(pupilId);
  if (!profile?.class) throw new ParentError("Pupil is not yet assigned to a class.", 404);
  return { className: profile.class.name, slots: profile.class.scheduleSlots };
}
```

with:

```typescript
export async function getChildSchedule(parentId: string, pupilId: string) {
  await assertActiveLink(parentId, pupilId);
  const profile = await getPupilProfileWithClass(pupilId);
  if (!profile?.class) throw new ParentError("Pupil is not yet assigned to a class.", 404);
  const view = await getClassScheduleView(profile.classId!, profile.class.teacher.userId);
  return { className: profile.class.name, ...view };
}
```

- [ ] **Step 3: Update client API return types**

In `client/src/api/pupil.ts`, add `ScheduleViewResponse` to the type-only import (currently lines 2-11) and change:

```typescript
export async function fetchPupilSchedule(): Promise<{ className: string; slots: ScheduleSlot[] }> {
  const { data } = await api.get("/pupil/schedule");
  return data;
}
```

to:

```typescript
export async function fetchPupilSchedule(): Promise<{ className: string } & ScheduleViewResponse> {
  const { data } = await api.get("/pupil/schedule");
  return data;
}
```

Remove `ScheduleSlot` from the import if it becomes unused after this change (check the rest of the file — it isn't used elsewhere in `pupil.ts`, so remove it).

In `client/src/api/parent.ts`, add `ScheduleViewResponse` to the type-only import (currently lines 2-12) and change:

```typescript
export async function fetchChildSchedule(pupilId: string): Promise<{ className: string; slots: ScheduleSlot[] }> {
  const { data } = await api.get(`/parent/children/${pupilId}/schedule`);
  return data;
}
```

to:

```typescript
export async function fetchChildSchedule(pupilId: string): Promise<{ className: string } & ScheduleViewResponse> {
  const { data } = await api.get(`/parent/children/${pupilId}/schedule`);
  return data;
}
```

Remove `ScheduleSlot` from the import if unused elsewhere in `parent.ts` (it isn't).

- [ ] **Step 4: Write a failing test for the shared `ScheduleView` component**

Create `client/src/components/ScheduleView.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScheduleView } from "./ScheduleView";

describe("ScheduleView", () => {
  it("renders a weekly 7-day grid when mode is weekly", () => {
    render(
      <ScheduleView data={{ mode: "weekly", slots: [{ dayOfWeek: 1, startTime: "16:00", endTime: "17:00" }] }} />
    );
    expect(screen.getByText("16:00")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });

  it("shows the empty state when weekly mode has no slots", () => {
    render(<ScheduleView data={{ mode: "weekly", slots: [] }} />);
    expect(screen.getByText("No schedule set yet")).toBeInTheDocument();
  });

  it("renders a dated list when mode is vacation", () => {
    render(
      <ScheduleView
        data={{ mode: "vacation", sessions: [{ date: "2026-10-05", startTime: "14:00", endTime: "15:00" }] }}
      />
    );
    expect(screen.getByText("14:00–15:00")).toBeInTheDocument();
  });

  it("shows a vacation-specific empty state when vacation mode has no sessions", () => {
    render(<ScheduleView data={{ mode: "vacation", sessions: [] }} />);
    expect(screen.getByText("No vacation sessions scheduled yet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd client && npx vitest run src/components/ScheduleView.test.tsx`
Expected: FAIL — `Cannot find module './ScheduleView'`.

- [ ] **Step 6: Implement `ScheduleView.tsx`**

Create `client/src/components/ScheduleView.tsx`:

```tsx
import { Card } from "./Card";
import { EmptyState } from "./Feedback";
import { DAY_NAMES } from "../lib/period";
import type { ScheduleViewResponse } from "../api/types";

export function ScheduleView({ data }: { data: ScheduleViewResponse }) {
  if (data.mode === "vacation") {
    if (data.sessions.length === 0) {
      return (
        <Card className="p-5">
          <EmptyState
            title="No vacation sessions scheduled yet"
            description="The teacher hasn't added one-off sessions for this window."
          />
        </Card>
      );
    }
    return (
      <ul className="space-y-2">
        {data.sessions.map((s, i) => (
          <li key={`${s.date}-${i}`} className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2.5">
            <span className="text-sm font-medium text-ink-900">
              {new Date(`${s.date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-sm text-ink-500">
              {s.startTime}–{s.endTime}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const today = new Date().getDay();
  const byDay = Array.from({ length: 7 }, (_, day) =>
    data.slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime))
  );
  const hasAny = data.slots.length > 0;

  if (!hasAny) {
    return (
      <Card className="p-5">
        <EmptyState title="No schedule set yet" description="The teacher hasn't added session times." />
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7 gap-2">
        {DAY_NAMES.map((name, day) => (
          <div
            key={name}
            className={`rounded-sm border p-2.5 ${
              day === today ? "border-accent-600/40 bg-accent-50" : "border-border bg-surface"
            }`}
          >
            <p
              className={`text-center text-xs font-semibold uppercase tracking-wide ${
                day === today ? "text-accent-600" : "text-ink-400"
              }`}
            >
              {name}
              {day === today && <span className="ml-1 font-normal normal-case text-accent-600/60">· today</span>}
            </p>
            <div className="mt-2.5 space-y-1.5">
              {byDay[day]!.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-ink-400">No session</p>
              ) : (
                byDay[day]!.map((s, i) => (
                  <div
                    key={i}
                    className={`rounded-sm px-1.5 py-2 text-center text-[11px] font-medium leading-tight ${
                      day === today ? "bg-accent-100 text-accent-600" : "bg-canvas text-ink-700"
                    }`}
                  >
                    {s.startTime}
                    <br />
                    {s.endTime}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd client && npx vitest run src/components/ScheduleView.test.tsx`
Expected: PASS.

- [ ] **Step 8: Wire `ScheduleView` into `PupilSchedulePage`**

In `client/src/features/pupil/SchedulePage.tsx`, add the import: `import { ScheduleView } from "../../components/ScheduleView";`. Replace the block from `const today = new Date().getDay();` through the closing `)}` of the weekly-grid conditional (current lines 183-238):

```typescript
  const today = new Date().getDay();
  const byDay = Array.from({ length: 7 }, (_, day) =>
    data.slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime))
  );
  const hasAny = data.slots.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Schedule</h1>
      <p className="mt-1 text-sm text-ink-500">{data.className}</p>

      {!hasAny ? (
        <Card className="mt-6 p-5">
          <EmptyState title="No schedule set yet" description="Your teacher hasn't added session times." />
        </Card>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <div className="grid min-w-[700px] grid-cols-7 gap-2">
            {DAY_NAMES.map((name, day) => (
              <div
                key={name}
                className={`rounded-sm border p-2.5 ${
                  day === today ? "border-accent-600/40 bg-accent-50" : "border-border bg-surface"
                }`}
              >
                <p
                  className={`text-center text-xs font-semibold uppercase tracking-wide ${
                    day === today ? "text-accent-600" : "text-ink-400"
                  }`}
                >
                  {name}
                  {day === today && <span className="ml-1 font-normal normal-case text-accent-600/60">· today</span>}
                </p>
                <div className="mt-2.5 space-y-1.5">
                  {byDay[day]!.length === 0 ? (
                    <p className="py-3 text-center text-[11px] text-ink-400">No session</p>
                  ) : (
                    byDay[day]!.map((s, i) => (
                      <div
                        key={i}
                        className={`rounded-sm px-1.5 py-2 text-center text-[11px] font-medium leading-tight ${
                          day === today ? "bg-accent-100 text-accent-600" : "bg-canvas text-ink-700"
                        }`}
                      >
                        {s.startTime}
                        <br />
                        {s.endTime}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

with:

```typescript
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Schedule</h1>
      <p className="mt-1 text-sm text-ink-500">{data.className}</p>

      <div className="mt-6">
        <ScheduleView data={data} />
      </div>
```

`DAY_NAMES` becomes unused for the weekly-grid rendering in this file but stays imported/used elsewhere (the `VisitRequestForm`'s schedule-summary text at line 84 still uses it) — leave the import as-is.

- [ ] **Step 9: Wire `ScheduleView` into `ParentSchedulePage`**

In `client/src/features/parent/SchedulePage.tsx`, add the import: `import { ScheduleView } from "../../components/ScheduleView";`. Replace the entire file body's schedule-rendering logic. Full replacement for the file:

```tsx
import { useQuery } from "@tanstack/react-query";
import { fetchChildSchedule } from "../../api/parent";
import { Card } from "../../components/Card";
import { EmptyState, Spinner } from "../../components/Feedback";
import { ScheduleView } from "../../components/ScheduleView";
import { useSelectedChild } from "./useSelectedChild";
import { ChildSwitcher } from "./ChildSwitcher";

export function ParentSchedulePage() {
  const { pupilId, isLoading: childrenLoading } = useSelectedChild();
  const scheduleQuery = useQuery({
    queryKey: ["parent", "schedule", pupilId],
    queryFn: () => fetchChildSchedule(pupilId!),
    enabled: !!pupilId,
  });

  if (childrenLoading) return <Spinner />;

  const data = scheduleQuery.data;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Schedule</h1>
      <div className="mt-4">
        <ChildSwitcher />
      </div>

      {!pupilId ? (
        <Card className="mt-6 p-5">
          <EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started." />
        </Card>
      ) : scheduleQuery.isLoading || !data ? (
        <Spinner />
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-500">{data.className}</p>
          <div className="mt-6">
            <ScheduleView data={data} />
          </div>
        </>
      )}
    </div>
  );
}
```

(`DAY_NAMES` import is dropped here since it's no longer used directly in this file.)

- [ ] **Step 10: Typecheck both workspaces**

Run: `cd server && npx tsc -p tsconfig.json --noEmit && cd ../client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Run full test suites**

Run: `cd server && npm test` then `cd client && npm test` (or the client's configured vitest script).
Expected: all PASS, including the new `vacation.service.test.ts`, `attendance.service.test.ts`, `VacationBanner.test.tsx`, `VacationSessionsPanel.test.tsx`, and `ScheduleView.test.tsx`.

- [ ] **Step 12: Verify in the browser**

As a pupil (and separately as a parent viewing a linked pupil), open the Schedule page with no vacation active — confirm the weekly grid still renders as before. Start vacation mode as the teacher, add ad-hoc sessions to the pupil's class, reload the Schedule page — confirm it now renders the dated list instead of the grid. End vacation mode and reload — confirm it reverts to the weekly grid automatically.

- [ ] **Step 13: Commit**

```bash
git add server/src/controllers/pupil.controller.ts server/src/services/parent.service.ts \
  client/src/api/pupil.ts client/src/api/parent.ts \
  client/src/components/ScheduleView.tsx client/src/components/ScheduleView.test.tsx \
  client/src/features/pupil/SchedulePage.tsx client/src/features/parent/SchedulePage.tsx
git commit -m "feat: pupil/parent schedule pages switch to dated vacation sessions when active"
```

---

## Final verification

- [ ] Run `cd server && npm test` and `cd client && npm test` one more time after all 9 tasks — full green.
- [ ] Manually walk the full vacation lifecycle in the browser as a teacher: start vacation mode → add ad-hoc sessions to two different classes → confirm Teacher Overview, Class Detail, and (as pupil/parent) Schedule page all reflect it → mark attendance on a vacation-only day → end vacation mode early → confirm future ad-hoc sessions vanish, past ones and their attendance remain, and every surface reverts to the normal weekly pattern with nothing needing to be re-entered.
- [ ] Do not push any of this branch's commits to the remote GitHub repository — local commits only, per the standing constraint, until the user explicitly confirms everything is verified and asks for a push.

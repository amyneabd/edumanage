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

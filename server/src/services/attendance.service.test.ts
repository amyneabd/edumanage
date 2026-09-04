import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../utils/prisma.js";
import { hashPassword } from "../utils/password.js";
import { getAttendanceCalendar, getOwnAttendanceCalendar, getPupilDetail, markAttendance } from "./attendance.service.js";
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

// A day, `monthsBack` calendar months from now, that doesn't fall on the
// class's current weekly `scheduledDay`. Used to prove that the *current*
// schedule shouldn't rewrite what's visible/markable in other periods.
function unscheduledDateInMonth(monthsBack: number, scheduledDay: number): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - monthsBack;
  for (let day = 10; day <= 20; day++) {
    const d = new Date(year, month, day);
    if (d.getDay() !== scheduledDay) return d;
  }
  throw new Error("unreachable");
}

function periodKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
        create: {
          requestedType: "MATH",
          teacherId,
          classId,
          parentCode: `PAV${Date.now()}`,
          phone: "11112222",
          parentPhone: "33334444",
        },
      },
    },
  });
  pupilId = pupil.id;
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

describe("getAttendanceCalendar schedule restriction is period-relative", () => {
  it("includes a day in a past period even though it doesn't match the current weekly schedule", async () => {
    const targetDate = unscheduledDateInMonth(2, 1);
    const calendar = await getAttendanceCalendar(teacherId, pupilId, periodKey(targetDate));
    const day = calendar.days.find((d) => d.date === dateKey(targetDate));
    expect(day).toBeDefined();
    expect(day?.record).toBeNull();
  });

  it("still restricts the current period to days matching the current schedule", async () => {
    const targetDate = unscheduledDateInMonth(0, 1);
    const calendar = await getAttendanceCalendar(teacherId, pupilId, periodKey(targetDate));
    const day = calendar.days.find((d) => d.date === dateKey(targetDate));
    expect(day).toBeUndefined();
  });
});

describe("getOwnAttendanceCalendar schedule restriction is period-relative", () => {
  it("includes a day in a past period even though it doesn't match the current weekly schedule", async () => {
    const targetDate = unscheduledDateInMonth(3, 1);
    const calendar = await getOwnAttendanceCalendar(pupilId, periodKey(targetDate));
    const day = calendar.days.find((d) => d.date === dateKey(targetDate));
    expect(day).toBeDefined();
  });
});

describe("markAttendance schedule restriction is period-relative", () => {
  it("allows marking a day in a past period that doesn't match the current weekly schedule", async () => {
    const targetDate = unscheduledDateInMonth(2, 1);
    const record = await markAttendance(teacherId, pupilId, dateKey(targetDate), "PRESENT");
    expect(record.status).toBe("PRESENT");
  });

  it("still rejects an unscheduled day with no vacation session in the current period", async () => {
    const targetDate = unscheduledDateInMonth(0, 1);
    await expect(markAttendance(teacherId, pupilId, dateKey(targetDate), "PRESENT")).rejects.toThrow();
  });
});

describe("getPupilDetail", () => {
  it("returns the pupil's own and parent-supplied contact phone numbers", async () => {
    const detail = await getPupilDetail(teacherId, pupilId);
    expect(detail.phone).toBe("11112222");
    expect(detail.parentPhone).toBe("33334444");
  });

  it("returns a null parentName when no ACTIVE ParentLink exists for this pupil", async () => {
    const detail = await getPupilDetail(teacherId, pupilId);
    expect(detail.parentName).toBeNull();
  });

  it("returns the linked parent's name once an ACTIVE ParentLink exists", async () => {
    const passwordHash = await hashPassword("initial-Pass1");
    const parent = await prisma.user.create({
      data: {
        email: `test-attendance-vacation-parent-${Date.now()}@example.com`,
        passwordHash,
        name: "Attendance Vacation Test Parent",
        role: "PARENT",
        status: "ACTIVE",
        parentProfile: { create: {} },
      },
    });
    const link = await prisma.parentLink.create({
      data: { parentId: parent.id, pupilId, teacherId, status: "ACTIVE" },
    });

    const detail = await getPupilDetail(teacherId, pupilId);
    expect(detail.parentName).toBe("Attendance Vacation Test Parent");

    await prisma.parentLink.delete({ where: { id: link.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: parent.id } }).catch(() => {});
  });

  it("ignores a PENDING ParentLink when resolving the parent's name", async () => {
    const passwordHash = await hashPassword("initial-Pass1");
    const parent = await prisma.user.create({
      data: {
        email: `test-attendance-vacation-parent-pending-${Date.now()}@example.com`,
        passwordHash,
        name: "Pending Parent",
        role: "PARENT",
        status: "ACTIVE",
        parentProfile: { create: {} },
      },
    });
    const link = await prisma.parentLink.create({
      data: { parentId: parent.id, pupilId, teacherId, status: "PENDING" },
    });

    const detail = await getPupilDetail(teacherId, pupilId);
    expect(detail.parentName).toBeNull();

    await prisma.parentLink.delete({ where: { id: link.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: parent.id } }).catch(() => {});
  });
});

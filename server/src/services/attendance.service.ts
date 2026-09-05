import { prisma } from "../utils/prisma.js";
import { currentPeriod } from "../utils/period.js";
import { notifyParentsOfPupil } from "./notification.service.js";
import { getVacationSessionForDate } from "./vacation.service.js";

export class AttendanceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function getOwnedPupil(teacherId: string, pupilId: string) {
  const pupil = await prisma.pupilProfile.findFirst({
    where: { userId: pupilId, teacherId },
    include: {
      user: { select: { id: true, name: true, email: true, status: true, createdAt: true } },
      class: { include: { scheduleSlots: true } },
    },
  });
  if (!pupil) throw new AttendanceError("Pupil not found.", 404);
  return pupil;
}

export async function getPupilDetail(teacherId: string, pupilId: string) {
  const pupil = await getOwnedPupil(teacherId, pupilId);
  // The parent's display name only comes from a linked (ACTIVE) parent
  // account — a pending or rejected request shouldn't surface a name.
  const parentLink = await prisma.parentLink.findFirst({
    where: { pupilId, status: "ACTIVE" },
    include: { parent: { include: { user: { select: { name: true } } } } },
  });
  return {
    userId: pupil.userId,
    name: pupil.user.name,
    email: pupil.user.email,
    phone: pupil.phone,
    parentPhone: pupil.parentPhone,
    parentName: parentLink?.parent.user.name ?? null,
    status: pupil.user.status,
    classId: pupil.classId,
    className: pupil.class?.name ?? null,
    classType: pupil.class?.type ?? null,
    scheduleSlots: pupil.class?.scheduleSlots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })) ?? [],
  };
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

type AttendanceCalendarDay = {
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  display: "FUTURE" | "TODAY" | "PRESENT" | "ABSENT" | "EXCUSED" | "UNMARKED";
  record: "PRESENT" | "ABSENT" | "EXCUSED" | null;
};

/**
 * Builds the calendar days for a pupil/class/period.
 *
 * The class's *current* weekly schedule only restricts which days are
 * markable/visible for the *current* period. Past periods reflect
 * whatever the schedule was at the time, which we don't track
 * historically — so for any non-current period every day of the month is
 * included (attendance can be recorded on any date), and only vacation
 * sessions or the current schedule narrow things down for the live month.
 */
async function buildAttendanceDays(
  classId: string,
  scheduleSlots: { dayOfWeek: number; startTime: string; endTime: string }[],
  pupilId: string,
  targetPeriod: string,
): Promise<AttendanceCalendarDay[]> {
  const [year, month] = targetPeriod.split("-").map(Number);
  const isCurrentPeriod = targetPeriod === currentPeriod();

  const scheduledDays = new Set(scheduleSlots.map((s) => s.dayOfWeek));
  const slotByDay = new Map(scheduleSlots.map((s) => [s.dayOfWeek, s]));

  const today = new Date();
  const todayKey = toDateKey(today);

  const daysInMonth = new Date(year!, month!, 0).getDate();
  const monthStart = new Date(year!, month! - 1, 1);
  const monthEnd = new Date(year!, month!, 0, 23, 59, 59, 999);

  const vacationSessions = await prisma.vacationSession.findMany({
    where: { classId, date: { gte: monthStart, lte: monthEnd } },
  });
  const vacationByKey = new Map(vacationSessions.map((v) => [toDateKey(v.date), v]));

  const shouldFetchRecords = !isCurrentPeriod || scheduledDays.size > 0 || vacationByKey.size > 0;
  const records = shouldFetchRecords
    ? await prisma.attendanceRecord.findMany({
        where: { pupilId, classId, date: { gte: monthStart, lte: monthEnd } },
      })
    : [];
  const recordByKey = new Map(records.map((r) => [toDateKey(r.date), r.status]));

  const days: AttendanceCalendarDay[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year!, month! - 1, day);
    const dayOfWeek = date.getDay();
    const key = toDateKey(date);
    const vacationSlot = vacationByKey.get(key);
    if (isCurrentPeriod && !vacationSlot && !scheduledDays.has(dayOfWeek)) continue;
    const slot = vacationSlot ?? slotByDay.get(dayOfWeek) ?? { startTime: "", endTime: "" };
    const record = recordByKey.get(key) ?? null;

    let display: "FUTURE" | "TODAY" | "PRESENT" | "ABSENT" | "EXCUSED" | "UNMARKED";
    if (key === todayKey) {
      display = "TODAY";
    } else if (date > today) {
      display = "FUTURE";
    } else {
      display =
        record === "PRESENT" ? "PRESENT" : record === "ABSENT" ? "ABSENT" : record === "EXCUSED" ? "EXCUSED" : "UNMARKED";
    }

    days.push({ date: key, dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, display, record });
  }

  return days;
}

export async function getAttendanceCalendar(teacherId: string, pupilId: string, period?: string) {
  const pupil = await getOwnedPupil(teacherId, pupilId);
  const targetPeriod = period ?? currentPeriod();

  if (!pupil.classId || !pupil.class) {
    return { period: targetPeriod, className: null, classType: null, days: [] };
  }

  const days = await buildAttendanceDays(pupil.classId, pupil.class.scheduleSlots, pupilId, targetPeriod);

  return {
    period: targetPeriod,
    className: pupil.class.name,
    classType: pupil.class.type,
    days,
  };
}

export async function getOwnAttendanceCalendar(pupilId: string, period?: string) {
  const pupil = await prisma.pupilProfile.findUnique({
    where: { userId: pupilId },
    include: { class: { include: { scheduleSlots: true } } },
  });
  if (!pupil) throw new AttendanceError("Pupil profile not found.", 404);

  const targetPeriod = period ?? currentPeriod();

  if (!pupil.classId || !pupil.class) {
    return { period: targetPeriod, className: null, classType: null, days: [] };
  }

  const days = await buildAttendanceDays(pupil.classId, pupil.class.scheduleSlots, pupilId, targetPeriod);

  return {
    period: targetPeriod,
    className: pupil.class.name,
    classType: pupil.class.type,
    days,
  };
}

/** Aggregate attendance rate across every class owned by this teacher for the current period (admin dossier). */
export async function getAttendanceOverviewForTeacher(teacherId: string) {
  const period = currentPeriod();
  const [year, month] = period.split("-").map(Number);
  const monthStart = new Date(year!, month! - 1, 1);
  const monthEnd = new Date(year!, month!, 0, 23, 59, 59, 999);

  const records = await prisma.attendanceRecord.findMany({
    where: { class: { teacherId }, date: { gte: monthStart, lte: monthEnd } },
    select: { status: true },
  });

  const present = records.filter((r) => r.status === "PRESENT").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const total = present + absent;

  return {
    period,
    present,
    absent,
    total,
    rate: total > 0 ? (present / total) * 100 : null,
  };
}

export async function markAttendance(teacherId: string, pupilId: string, dateKey: string, status: "PRESENT" | "ABSENT") {
  const pupil = await getOwnedPupil(teacherId, pupilId);
  if (!pupil.classId || !pupil.class) throw new AttendanceError("Pupil is not assigned to a class.", 400);

  const date = parseDateKey(dateKey);
  if (Number.isNaN(date.getTime())) throw new AttendanceError("Invalid date.", 400);

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) throw new AttendanceError("Cannot record attendance for a future date.", 400);

  const isCurrentPeriod = dateKey.slice(0, 7) === currentPeriod();
  if (isCurrentPeriod) {
    const vacationSession = await getVacationSessionForDate(pupil.classId, date);
    if (!vacationSession) {
      const scheduledDays = new Set(pupil.class.scheduleSlots.map((s) => s.dayOfWeek));
      if (!scheduledDays.has(date.getDay())) {
        throw new AttendanceError("This pupil's class has no session scheduled on that day.", 400);
      }
    }
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { pupilId_date: { pupilId, date } },
    create: { pupilId, classId: pupil.classId, date, status },
    update: { status },
  });

  if (status === "ABSENT") {
    await notifyParentsOfPupil(pupilId, {
      type: "ABSENCE",
      title: "Absence recorded",
      body: `${pupil.user.name} was marked absent on ${dateKey}.`,
      link: "/parent/attendance",
      dedupeKey: `absence:${pupilId}:${dateKey}`,
    });
  }

  return record;
}

export async function clearAttendance(teacherId: string, pupilId: string, dateKey: string) {
  const pupil = await getOwnedPupil(teacherId, pupilId);
  const date = parseDateKey(dateKey);
  if (Number.isNaN(date.getTime())) throw new AttendanceError("Invalid date.", 400);

  await prisma.attendanceRecord.deleteMany({ where: { pupilId, classId: pupil.classId ?? undefined, date } });
}

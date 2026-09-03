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

// Formats a local-midnight Date back to a YYYY-MM-DD key using local date parts.
// Using toISOString() here would convert to UTC and shift the date by one day
// in any timezone ahead of UTC, disagreeing with how parseDateOnly stored it.
function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
    date: formatDateOnly(s.date),
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
      date: formatDateOnly(s.date),
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  };
}

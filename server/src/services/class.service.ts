import { prisma } from "../utils/prisma.js";
import type { ClassType } from "@prisma/client";

export class ClassError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  createdAt: true,
} as const;

export function listClassesForTeacher(teacherId: string) {
  return prisma.class.findMany({
    where: { teacherId },
    include: {
      pupils: { include: { user: { select: safeUserSelect } } },
      scheduleSlots: true,
      _count: { select: { pupils: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function createClass(teacherId: string, name: string, type: ClassType, monthlyFee?: number | null) {
  return prisma.class.create({ data: { teacherId, name, type, monthlyFee: monthlyFee ?? null } });
}

export async function updateClassFee(teacherId: string, classId: string, monthlyFee: number | null) {
  const klass = await prisma.class.findFirst({ where: { id: classId, teacherId } });
  if (!klass) throw new ClassError("Class not found.", 404);
  return prisma.class.update({ where: { id: classId }, data: { monthlyFee } });
}

export async function getClassDetail(teacherId: string, classId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

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
}

export async function updateSchedule(
  teacherId: string,
  classId: string,
  slots: { dayOfWeek: number; startTime: string; endTime: string }[]
) {
  const klass = await prisma.class.findFirst({ where: { id: classId, teacherId } });
  if (!klass) throw new ClassError("Class not found.", 404);

  await prisma.$transaction([
    prisma.scheduleSlot.deleteMany({ where: { classId } }),
    prisma.scheduleSlot.createMany({
      data: slots.map((s) => ({ ...s, classId })),
    }),
  ]);

  return getClassDetail(teacherId, classId);
}

export async function removePupilFromClass(teacherId: string, classId: string, pupilId: string) {
  const klass = await prisma.class.findFirst({ where: { id: classId, teacherId } });
  if (!klass) throw new ClassError("Class not found.", 404);

  const pupil = await prisma.pupilProfile.findFirst({ where: { userId: pupilId, classId } });
  if (!pupil) throw new ClassError("Pupil not found in this class.", 404);

  await prisma.pupilProfile.update({ where: { userId: pupilId }, data: { classId: null } });
}

export function listPupilRequests(teacherId: string) {
  return prisma.pupilProfile.findMany({
    where: { teacherId, classId: null, user: { status: "PENDING" } },
    include: { user: true },
    orderBy: { user: { createdAt: "asc" } },
  });
}

export async function assignPupilToClass(teacherId: string, pupilUserId: string, classId: string) {
  const klass = await prisma.class.findFirst({ where: { id: classId, teacherId } });
  if (!klass) throw new ClassError("Class not found.", 404);

  const pupil = await prisma.pupilProfile.findFirst({
    where: { userId: pupilUserId, teacherId },
  });
  if (!pupil) throw new ClassError("Pupil request not found.", 404);

  await prisma.$transaction([
    prisma.pupilProfile.update({ where: { userId: pupilUserId }, data: { classId } }),
    prisma.user.update({ where: { id: pupilUserId }, data: { status: "ACTIVE" } }),
  ]);
}

export async function rejectPupilRequest(teacherId: string, pupilUserId: string) {
  const pupil = await prisma.pupilProfile.findFirst({ where: { userId: pupilUserId, teacherId } });
  if (!pupil) throw new ClassError("Pupil request not found.", 404);

  await prisma.user.update({ where: { id: pupilUserId }, data: { status: "REJECTED" } });
}

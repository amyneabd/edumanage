import { prisma } from "../utils/prisma.js";
import { createNotification } from "./notification.service.js";
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

  const existingPending = await prisma.swapRequest.findFirst({
    where: { pupilId, originDate, status: "PENDING" },
  });
  if (existingPending) {
    throw new SwapError("You already have a pending swap request for that session.", 409);
  }

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
  if (request.status !== "PENDING") {
    throw new SwapError("Only pending requests can be cancelled.", 400);
  }
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
  if (request.status !== "PENDING") {
    throw new SwapError("This request has already been resolved.", 400);
  }

  const updated = await prisma.swapRequest.update({ where: { id }, data: { status } });

  if (status === "APPROVED") {
    await prisma.attendanceRecord.upsert({
      where: { pupilId_date: { pupilId: request.pupilId, date: request.originDate } },
      create: { pupilId: request.pupilId, classId: request.originClassId, date: request.originDate, status: "EXCUSED" },
      update: { status: "EXCUSED" },
    });
  }

  return updated;
}

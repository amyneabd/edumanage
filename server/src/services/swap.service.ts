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
  if (!pupil) throw new SwapError("Profil élève introuvable.", 404);
  if (!pupil.classId || !pupil.class) throw new SwapError("L'élève n'est assigné à aucune classe.", 400);
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
    throw new SwapError("Date invalide.", 400);
  }

  const today = startOfToday();
  if (originDate < today) throw new SwapError("La date d'origine ne doit pas être dans le passé.", 400);
  if (targetDate < today) throw new SwapError("La date cible ne doit pas être dans le passé.", 400);

  const existingPending = await prisma.swapRequest.findFirst({
    where: { pupilId, originDate, status: "PENDING" },
  });
  if (existingPending) {
    throw new SwapError("Vous avez déjà une demande d'échange en attente pour cette séance.", 409);
  }

  const originIsReal = await isRealSession(pupil.classId!, originDate);
  if (!originIsReal) throw new SwapError("La date d'origine ne correspond pas à une séance programmée de votre classe.", 400);

  const targetClass = await prisma.class.findUnique({ where: { id: input.targetClassId } });
  if (!targetClass || targetClass.teacherId !== pupil.teacherId) {
    throw new SwapError("Classe cible introuvable.", 404);
  }
  if (targetClass.id === pupil.classId) {
    throw new SwapError("La classe cible doit être différente de votre propre classe.", 400);
  }

  const targetIsReal = await isRealSession(targetClass.id, targetDate);
  if (!targetIsReal) throw new SwapError("La date cible ne correspond pas à une séance programmée de la classe cible.", 400);

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
    title: "Nouvelle demande d'échange",
    body: `${pupil.user.name} a demandé un échange vers ${targetClass.name} le ${input.targetDate}.`,
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
  if (!request) throw new SwapError("Demande d'échange introuvable.", 404);
  if (request.status !== "PENDING") {
    throw new SwapError("Seules les demandes en attente peuvent être annulées.", 400);
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
  if (!request) throw new SwapError("Demande d'échange introuvable.", 404);
  if (request.status !== "PENDING") {
    throw new SwapError("Cette demande a déjà été traitée.", 400);
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

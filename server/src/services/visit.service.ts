import { prisma } from "../utils/prisma.js";
import { createNotification } from "./notification.service.js";
import type { VisitRequestStatus } from "@prisma/client";

export class VisitError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Other classes taught by the pupil's own teacher (excluding their current class). */
export async function listOtherClassesForPupil(pupilId: string) {
  const profile = await prisma.pupilProfile.findUnique({ where: { userId: pupilId } });
  if (!profile) throw new VisitError("Pupil profile not found.", 404);

  return prisma.class.findMany({
    where: {
      teacherId: profile.teacherId,
      ...(profile.classId ? { id: { not: profile.classId } } : {}),
    },
    include: { scheduleSlots: true },
    orderBy: { name: "asc" },
  });
}

export async function createVisitRequest(
  pupilId: string,
  input: { classId: string; sessionDate: string; reason?: string | null }
) {
  const profile = await prisma.pupilProfile.findUnique({ where: { userId: pupilId } });
  if (!profile) throw new VisitError("Pupil profile not found.", 404);
  if (!profile.classId) throw new VisitError("You must be assigned to a class first.", 400);
  if (input.classId === profile.classId) {
    throw new VisitError("You're already enrolled in that class.", 400);
  }

  const targetClass = await prisma.class.findFirst({
    where: { id: input.classId, teacherId: profile.teacherId },
  });
  if (!targetClass) throw new VisitError("Class not found.", 404);

  const sessionDate = new Date(input.sessionDate);
  if (Number.isNaN(sessionDate.getTime())) throw new VisitError("Invalid session date.", 400);
  sessionDate.setHours(0, 0, 0, 0);
  if (sessionDate < startOfToday()) throw new VisitError("Session date can't be in the past.", 400);

  const existing = await prisma.visitRequest.findFirst({
    where: { pupilId, classId: input.classId, sessionDate, status: "PENDING" },
  });
  if (existing) {
    throw new VisitError("You already have a pending request for that class and date.", 409);
  }

  const request = await prisma.visitRequest.create({
    data: {
      pupilId,
      classId: input.classId,
      sessionDate,
      reason: input.reason?.trim() || null,
    },
    include: { pupil: { include: { user: { select: { name: true } } } }, class: true },
  });

  await createNotification({
    teacherId: targetClass.teacherId,
    type: "VISIT_REQUEST",
    title: "New session visit request",
    body: `${request.pupil.user.name} wants to attend ${targetClass.name} on ${sessionDate.toLocaleDateString()}.`,
    link: "/teacher/classes",
    dedupeKey: `visit-request:${request.id}`,
  });

  return {
    id: request.id,
    classId: request.classId,
    className: request.class.name,
    classType: request.class.type,
    sessionDate: request.sessionDate,
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    respondedAt: request.respondedAt,
  };
}

export function listOwnVisitRequests(pupilId: string) {
  return prisma.visitRequest.findMany({
    where: { pupilId },
    include: { class: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function cancelVisitRequest(pupilId: string, id: string) {
  const request = await prisma.visitRequest.findFirst({ where: { id, pupilId } });
  if (!request) throw new VisitError("Request not found.", 404);
  if (request.status !== "PENDING") throw new VisitError("Only pending requests can be cancelled.", 400);
  await prisma.visitRequest.delete({ where: { id } });
}

export function listVisitRequestsForTeacher(teacherId: string, status?: VisitRequestStatus) {
  return prisma.visitRequest.findMany({
    where: { class: { teacherId }, ...(status ? { status } : {}) },
    include: { pupil: { include: { user: true } }, class: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function respondToVisitRequest(teacherId: string, id: string, approve: boolean) {
  const request = await prisma.visitRequest.findFirst({
    where: { id, class: { teacherId } },
  });
  if (!request) throw new VisitError("Request not found.", 404);
  if (request.status !== "PENDING") throw new VisitError("This request has already been resolved.", 400);

  return prisma.visitRequest.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "DECLINED", respondedAt: new Date() },
  });
}

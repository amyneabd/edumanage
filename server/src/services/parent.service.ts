import { prisma } from "../utils/prisma.js";
import { createNotification } from "./notification.service.js";
import { getOwnAttendanceCalendar } from "./attendance.service.js";
import { getOwnPaymentHistory } from "./payment.service.js";
import { getOwnGrades, listPostsForClass } from "./post.service.js";
import { getHomeSnapshot, getPupilProfileWithClass } from "./pupil.service.js";

export class ParentError extends Error {
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

export async function requestParentLink(parentId: string, parentCode: string) {
  const pupil = await prisma.pupilProfile.findUnique({
    where: { parentCode: parentCode.toUpperCase() },
    include: { user: true },
  });
  if (!pupil) throw new ParentError("No pupil found with that Parent Code.", 404);

  const existing = await prisma.parentLink.findUnique({
    where: { parentId_pupilId: { parentId, pupilId: pupil.userId } },
  });
  if (existing) {
    if (existing.status === "PENDING") {
      throw new ParentError("You already have a pending request for this pupil.", 409);
    }
    if (existing.status === "ACTIVE") {
      throw new ParentError("This pupil is already linked to your account.", 409);
    }
  }

  const link = existing
    ? await prisma.parentLink.update({
        where: { id: existing.id },
        data: { status: "PENDING", requestedAt: new Date(), respondedAt: null },
      })
    : await prisma.parentLink.create({
        data: { parentId, pupilId: pupil.userId, teacherId: pupil.teacherId },
      });

  const parent = await prisma.user.findUnique({ where: { id: parentId } });

  await createNotification({
    teacherId: pupil.teacherId,
    type: "PARENT_REQUEST",
    title: "New parent link request",
    body: `${parent?.name ?? "A parent"} wants to be linked to ${pupil.user.name}.`,
    link: pupil.classId ? `/teacher/classes/${pupil.classId}` : "/teacher/classes",
    dedupeKey: `parent-request:${link.id}`,
  });

  return link;
}

export function listChildrenForParent(parentId: string) {
  return prisma.parentLink.findMany({
    where: { parentId, status: "ACTIVE" },
    include: {
      pupil: {
        include: { user: { select: safeUserSelect }, class: true },
      },
    },
    orderBy: { requestedAt: "asc" },
  });
}

export function listOwnLinks(parentId: string) {
  return prisma.parentLink.findMany({
    where: { parentId },
    include: {
      pupil: { include: { user: { select: safeUserSelect } } },
    },
    orderBy: { requestedAt: "desc" },
  });
}

async function assertActiveLink(parentId: string, pupilId: string) {
  const link = await prisma.parentLink.findUnique({
    where: { parentId_pupilId: { parentId, pupilId } },
  });
  if (!link || link.status !== "ACTIVE") {
    throw new ParentError("You don't have access to this pupil.", 403);
  }
}

export async function getChildHome(parentId: string, pupilId: string) {
  await assertActiveLink(parentId, pupilId);
  return getHomeSnapshot(pupilId);
}

export async function getChildSchedule(parentId: string, pupilId: string) {
  await assertActiveLink(parentId, pupilId);
  const profile = await getPupilProfileWithClass(pupilId);
  if (!profile?.class) throw new ParentError("Pupil is not yet assigned to a class.", 404);
  return { className: profile.class.name, slots: profile.class.scheduleSlots };
}

export async function getChildAttendance(parentId: string, pupilId: string, period?: string) {
  await assertActiveLink(parentId, pupilId);
  return getOwnAttendanceCalendar(pupilId, period);
}

export async function getChildPayments(parentId: string, pupilId: string) {
  await assertActiveLink(parentId, pupilId);
  return getOwnPaymentHistory(pupilId);
}

export async function getChildGrades(parentId: string, pupilId: string) {
  await assertActiveLink(parentId, pupilId);
  return getOwnGrades(pupilId);
}

export async function getChildPosts(parentId: string, pupilId: string) {
  await assertActiveLink(parentId, pupilId);
  const profile = await getPupilProfileWithClass(pupilId);
  if (!profile?.classId) throw new ParentError("Pupil is not yet assigned to a class.", 404);
  const items = await listPostsForClass(profile.classId);
  return items.map((p) => ({
    ...p,
    mySubmission: p.submissions.find((s) => s.pupilId === pupilId) ?? null,
    submissions: undefined,
  }));
}

// --- Teacher-side approval ---

export function listParentRequestsForClass(teacherId: string, classId: string) {
  return prisma.parentLink.findMany({
    where: { teacherId, status: "PENDING", pupil: { classId } },
    include: {
      parent: { include: { user: { select: safeUserSelect } } },
      pupil: { include: { user: { select: safeUserSelect } } },
    },
    orderBy: { requestedAt: "asc" },
  });
}

// All pending parent-link requests for this teacher, regardless of whether the
// pupil has been assigned to a class yet. listParentRequestsForClass alone would
// leave requests for not-yet-assigned pupils with nowhere to be approved.
export function listAllParentRequests(teacherId: string) {
  return prisma.parentLink.findMany({
    where: { teacherId, status: "PENDING" },
    include: {
      parent: { include: { user: { select: safeUserSelect } } },
      pupil: { include: { user: { select: safeUserSelect }, class: true } },
    },
    orderBy: { requestedAt: "asc" },
  });
}

export async function respondToParentLink(teacherId: string, linkId: string, approve: boolean) {
  const link = await prisma.parentLink.findFirst({ where: { id: linkId, teacherId } });
  if (!link) throw new ParentError("Request not found.", 404);
  if (link.status !== "PENDING") throw new ParentError("This request has already been resolved.", 400);

  return prisma.parentLink.update({
    where: { id: linkId },
    data: { status: approve ? "ACTIVE" : "REJECTED", respondedAt: new Date() },
  });
}

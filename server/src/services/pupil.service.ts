import { prisma } from "../utils/prisma.js";
import { currentPeriod } from "../utils/period.js";
import { getOwnAttendanceCalendar } from "./attendance.service.js";

export class PupilError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function getPupilProfileWithClass(pupilId: string) {
  return prisma.pupilProfile.findUnique({
    where: { userId: pupilId },
    include: {
      class: { include: { scheduleSlots: true, teacher: { include: { user: true } } } },
    },
  });
}

export function getNextSession(
  scheduleSlots: { dayOfWeek: number; startTime: string; endTime: string }[],
  from = new Date()
) {
  if (scheduleSlots.length === 0) return null;

  const fromDay = from.getDay();
  let bestDiff = Infinity;
  let candidates: typeof scheduleSlots = [];
  for (const slot of scheduleSlots) {
    let diff = slot.dayOfWeek - fromDay;
    if (diff < 0) diff += 7;
    if (diff < bestDiff) {
      bestDiff = diff;
      candidates = [slot];
    } else if (diff === bestDiff) {
      candidates.push(slot);
    }
  }
  candidates.sort((a, b) => a.startTime.localeCompare(b.startTime));
  const slot = candidates[0]!;
  return { dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, daysUntil: bestDiff };
}

/** Builds the same home-dashboard snapshot used by the pupil's own Home page. */
export async function getHomeSnapshot(pupilId: string) {
  const profile = await getPupilProfileWithClass(pupilId);
  if (!profile?.class) throw new PupilError("Not yet assigned to a class.", 404);

  const period = currentPeriod();

  const [payment, recentPosts, examPosts, calendar] = await Promise.all([
    prisma.paymentRecord.findUnique({ where: { pupilId_period: { pupilId, period } } }),
    prisma.post.findMany({
      where: { classId: profile.classId! },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.post.findMany({
      where: { classId: profile.classId!, type: "EXAM", dueDate: { not: null } },
      include: { submissions: { where: { pupilId } } },
      orderBy: { dueDate: "asc" },
    }),
    getOwnAttendanceCalendar(pupilId, period),
  ]);

  const now = new Date();
  const upcomingExams = examPosts
    .filter((p) => p.submissions.length === 0)
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      content: p.content,
      dueDate: p.dueDate,
      isOverdue: p.dueDate ? p.dueDate < now : false,
    }));

  let present = 0;
  let absent = 0;
  let unmarked = 0;
  for (const d of calendar.days) {
    if (d.display === "PRESENT") present++;
    else if (d.display === "ABSENT") absent++;
    else if (d.display === "UNMARKED") unmarked++;
  }
  const markedTotal = present + absent;
  const attendanceRate = markedTotal > 0 ? Math.round((present / markedTotal) * 100) : null;

  return {
    className: profile.class.name,
    classType: profile.class.type,
    teacherName: profile.class.teacher.user.name,
    scheduleSlots: profile.class.scheduleSlots,
    payment: {
      status: payment?.status ?? "UNPAID",
      dueDate: payment?.dueDate ?? null,
      period,
      amountDue: payment?.amountDue ?? profile.class.monthlyFee ?? null,
      amountPaid: payment?.amountPaid ?? 0,
    },
    nextSession: getNextSession(profile.class.scheduleSlots),
    attendance: { present, absent, unmarked, rate: attendanceRate, period },
    upcomingExams,
    recentPosts,
  };
}

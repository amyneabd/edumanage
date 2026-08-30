import { prisma } from "../utils/prisma.js";
import { currentPeriod } from "../utils/period.js";
import { getLedger, getLedgerSummary } from "./payment.service.js";
import { listClassesForTeacher } from "./class.service.js";
import { listPostsForTeacher } from "./post.service.js";
import { getAttendanceOverviewForTeacher } from "./attendance.service.js";

export class AdminError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Platform-wide directory of every teacher account, with lightweight KPIs per row. */
export async function listAllTeachers() {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    include: {
      teacherProfile: {
        include: {
          classes: { include: { _count: { select: { pupils: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const period = currentPeriod();

  return Promise.all(
    teachers.map(async (t) => {
      const classes = t.teacherProfile?.classes ?? [];
      const classCount = classes.length;
      const pupilCount = classes.reduce((sum, c) => sum + c._count.pupils, 0);

      let expected = 0;
      let collected = 0;
      let outstanding = 0;
      let overdueCount = 0;
      let pendingPupilRequests = 0;

      if (t.teacherProfile) {
        const [summary, pending] = await Promise.all([
          getLedgerSummary(t.id, period),
          prisma.pupilProfile.count({ where: { teacherId: t.id, classId: null, user: { status: "PENDING" } } }),
        ]);
        expected = summary.expected;
        collected = summary.collected;
        outstanding = summary.outstanding;
        overdueCount = summary.overdueCount;
        pendingPupilRequests = pending;
      }

      return {
        id: t.id,
        name: t.name,
        email: t.email,
        status: t.status,
        createdAt: t.createdAt,
        teacherCode: t.teacherProfile?.teacherCode ?? null,
        classCount,
        pupilCount,
        pendingPupilRequests,
        expected,
        collected,
        outstanding,
        overdueCount,
      };
    })
  );
}

/** Full read-only dossier for a single teacher: classes, ledger, feed, attendance. */
export async function getTeacherDetail(teacherId: string) {
  const user = await prisma.user.findFirst({
    where: { id: teacherId, role: "TEACHER" },
    include: { teacherProfile: true },
  });
  if (!user || !user.teacherProfile) throw new AdminError("Teacher not found.", 404);

  const period = currentPeriod();

  const [classes, ledger, ledgerSummary, posts, attendance, pendingPupilRequests, pendingVisitRequests] =
    await Promise.all([
      listClassesForTeacher(teacherId),
      getLedger(teacherId, { period }),
      getLedgerSummary(teacherId, period),
      listPostsForTeacher(teacherId),
      getAttendanceOverviewForTeacher(teacherId),
      prisma.pupilProfile.count({ where: { teacherId, classId: null, user: { status: "PENDING" } } }),
      prisma.visitRequest.count({ where: { class: { teacherId }, status: "PENDING" } }),
    ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt,
    teacherCode: user.teacherProfile.teacherCode,
    classes,
    ledger,
    ledgerSummary,
    posts,
    attendance,
    pendingPupilRequests,
    pendingVisitRequests,
  };
}

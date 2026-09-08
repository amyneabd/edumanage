import { prisma } from "../utils/prisma.js";
import type { NotificationType } from "@prisma/client";
import { currentPeriod, previousPeriod } from "../utils/period.js";
import { sendParentAlertEmail } from "../utils/mailer.js";
import { sendPushToUser } from "./push.service.js";

// Urgent for a parent to know about right away — these also trigger an email.
// POST_PUBLISHED is informational only and stays in-app.
const URGENT_PARENT_EMAIL_TYPES: NotificationType[] = ["ABSENCE", "PAYMENT_DUE", "SUBMISSION_MISSING"];

type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  dedupeKey?: string;
} & ({ teacherId: string; parentId?: undefined } | { parentId: string; teacherId?: undefined });

export async function createNotification(input: CreateNotificationInput) {
  if (input.dedupeKey) {
    const existing = input.teacherId
      ? await prisma.notification.findUnique({
          where: { teacherId_dedupeKey: { teacherId: input.teacherId, dedupeKey: input.dedupeKey } },
        })
      : await prisma.notification.findUnique({
          where: { parentId_dedupeKey: { parentId: input.parentId!, dedupeKey: input.dedupeKey } },
        });
    if (existing) return existing;
  }

  const notification = await prisma.notification.create({
    data: {
      teacherId: input.teacherId ?? null,
      parentId: input.parentId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      dedupeKey: input.dedupeKey ?? null,
    },
  });

  const recipientId = input.teacherId ?? input.parentId!;
  try {
    await sendPushToUser(recipientId, { title: input.title, body: input.body, link: input.link });
  } catch (err) {
    console.error("[push] failed to send push notification", err);
  }

  if (input.parentId && URGENT_PARENT_EMAIL_TYPES.includes(input.type)) {
    const parent = await prisma.user.findUnique({ where: { id: input.parentId } });
    if (parent) {
      try {
        await sendParentAlertEmail(parent.email, input.title, input.body, input.link);
      } catch (err) {
        console.error("[notification] failed to send parent alert email", err);
      }
    }
  }

  return notification;
}

/**
 * Scans for active, unpaid payment records whose due date has arrived (or passed)
 * and creates a PAYMENT_DUE notification for each one, if it doesn't already exist.
 * Deduped per (teacher, pupil, period) so re-running this doesn't spam duplicates.
 */
export async function syncPaymentDueNotifications(teacherId: string) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const dueRecords = await prisma.paymentRecord.findMany({
    where: {
      status: { not: "PAID" },
      dueDate: { not: null, lte: endOfToday },
      pupil: { teacherId, classId: { not: null }, user: { status: "ACTIVE" } },
    },
    include: { pupil: { include: { user: true } } },
  });

  for (const record of dueRecords) {
    const overdue = record.dueDate! < new Date(new Date().setHours(0, 0, 0, 0));
    await createNotification({
      teacherId,
      type: "PAYMENT_DUE",
      title: overdue ? "Paiement en retard" : "Paiement dû aujourd'hui",
      body: `Le paiement de ${record.pupil.user.name} pour ${record.period} est ${overdue ? "en retard" : "dû aujourd'hui"}.`,
      link: "/teacher/ledger",
      dedupeKey: `payment-due:${record.pupilId}:${record.period}`,
    });
  }
}

/**
 * Once a new month begins, checks whether the just-finished month had any goals
 * set and, if so, creates a one-time "recap ready" notification pointing back
 * at that month's goals section on the Overview page. Deduped per (teacher, period)
 * so it only ever fires once per month, the first time this runs after rollover.
 */
export async function syncMonthlyRecapNotifications(teacherId: string) {
  const finishedPeriod = previousPeriod(currentPeriod());

  const goals = await prisma.goal.findMany({ where: { teacherId, period: finishedPeriod } });
  if (goals.length === 0) return;

  const achieved = goals.filter((g) => g.achieved).length;
  await createNotification({
    teacherId,
    type: "MONTHLY_RECAP",
    title: "Récapitulatif mensuel disponible",
    body: `Vous avez atteint ${achieved} objectif(s) sur ${goals.length} pour ${finishedPeriod}.`,
    link: `/teacher/overview?period=${finishedPeriod}`,
    dedupeKey: `monthly-recap:${finishedPeriod}`,
  });
}

export async function listNotifications(teacherId: string) {
  await syncPaymentDueNotifications(teacherId);
  await syncMonthlyRecapNotifications(teacherId);

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { teacherId, read: false } }),
  ]);

  return { items, unreadCount };
}

export async function markNotificationRead(teacherId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, teacherId }, data: { read: true } });
}

export async function markAllNotificationsRead(teacherId: string) {
  await prisma.notification.updateMany({ where: { teacherId, read: false }, data: { read: true } });
}

// --- Parent-facing notifications ---

/** Same payment-due scan as the teacher version, but scoped to one parent's actively linked children. */
async function syncPaymentDueNotificationsForParent(parentId: string) {
  const links = await prisma.parentLink.findMany({ where: { parentId, status: "ACTIVE" }, select: { pupilId: true } });
  if (links.length === 0) return;

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const dueRecords = await prisma.paymentRecord.findMany({
    where: {
      status: { not: "PAID" },
      dueDate: { not: null, lte: endOfToday },
      pupilId: { in: links.map((l) => l.pupilId) },
    },
    include: { pupil: { include: { user: true } } },
  });

  for (const record of dueRecords) {
    const overdue = record.dueDate! < new Date(new Date().setHours(0, 0, 0, 0));
    await createNotification({
      parentId,
      type: "PAYMENT_DUE",
      title: overdue ? "Paiement en retard" : "Paiement dû aujourd'hui",
      body: `Le paiement de ${record.pupil.user.name} pour ${record.period} est ${overdue ? "en retard" : "dû aujourd'hui"}.`,
      link: "/parent/payments",
      dedupeKey: `payment-due:${record.pupilId}:${record.period}`,
    });
  }
}

/** Flags exam posts past their due date with no submission yet, for each of this parent's actively linked children. */
async function syncSubmissionMissingNotificationsForParent(parentId: string) {
  const links = await prisma.parentLink.findMany({ where: { parentId, status: "ACTIVE" }, select: { pupilId: true } });
  if (links.length === 0) return;

  const now = new Date();

  for (const { pupilId } of links) {
    const pupil = await prisma.pupilProfile.findUnique({ where: { userId: pupilId }, include: { user: true } });
    if (!pupil?.classId) continue;

    const overdueExams = await prisma.post.findMany({
      where: { classId: pupil.classId, type: "EXAM", dueDate: { not: null, lt: now } },
      include: { submissions: { where: { pupilId } } },
    });

    for (const exam of overdueExams) {
      if (exam.submissions.length > 0) continue;
      await createNotification({
        parentId,
        type: "SUBMISSION_MISSING",
        title: "Soumission manquante",
        body: `${pupil.user.name} n'a pas encore soumis "${exam.content?.slice(0, 60) ?? "un examen"}".`,
        link: "/parent/feed",
        dedupeKey: `submission-missing:${pupilId}:${exam.id}`,
      });
    }
  }
}

export async function listNotificationsForParent(parentId: string) {
  await syncPaymentDueNotificationsForParent(parentId);
  await syncSubmissionMissingNotificationsForParent(parentId);

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { parentId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { parentId, read: false } }),
  ]);

  return { items, unreadCount };
}

export async function markParentNotificationRead(parentId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, parentId }, data: { read: true } });
}

export async function markAllParentNotificationsRead(parentId: string) {
  await prisma.notification.updateMany({ where: { parentId, read: false }, data: { read: true } });
}

/** Notifies every actively-linked parent of a pupil. Used for instant, event-driven alerts (absence, new post). */
export async function notifyParentsOfPupil(
  pupilId: string,
  input: { type: NotificationType; title: string; body: string; link?: string; dedupeKey?: string }
) {
  const links = await prisma.parentLink.findMany({ where: { pupilId, status: "ACTIVE" }, select: { parentId: true } });
  for (const { parentId } of links) {
    await createNotification({ ...input, parentId });
  }
}

/**
 * Proactively runs the lazy notification syncs for every active teacher and
 * parent, so PAYMENT_DUE / MONTHLY_RECAP / SUBMISSION_MISSING notifications
 * (and their pushes) are created ahead of the next time someone opens the
 * bell, instead of only on-read. Safe to call repeatedly — every sync
 * function below is deduped via Notification.dedupeKey, so re-running this
 * (e.g. after a process restart) never creates duplicate rows or re-sends
 * push notifications for an event already delivered.
 */
export async function runDailyNotificationSync(): Promise<void> {
  const teachers = await prisma.user.findMany({ where: { role: "TEACHER", status: "ACTIVE" }, select: { id: true } });
  for (const { id } of teachers) {
    await syncPaymentDueNotifications(id);
    await syncMonthlyRecapNotifications(id);
  }

  const parents = await prisma.user.findMany({ where: { role: "PARENT", status: "ACTIVE" }, select: { id: true } });
  for (const { id } of parents) {
    await syncPaymentDueNotificationsForParent(id);
    await syncSubmissionMissingNotificationsForParent(id);
  }
}

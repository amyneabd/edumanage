import { prisma } from "../utils/prisma.js";
import { currentPeriod } from "../utils/period.js";
import type { PaymentStatus } from "@prisma/client";

export class PaymentError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function isOverdue(status: PaymentStatus, dueDate: Date | null): boolean {
  if (status === "PAID" || !dueDate) return false;
  return dueDate < new Date(new Date().setHours(0, 0, 0, 0));
}

export async function getLedger(
  teacherId: string,
  filters: { search?: string; status?: PaymentStatus; classId?: string; period?: string }
) {
  const period = filters.period ?? currentPeriod();

  const pupils = await prisma.pupilProfile.findMany({
    where: {
      teacherId,
      classId: filters.classId ? filters.classId : { not: null },
      user: filters.search
        ? { name: { contains: filters.search }, status: "ACTIVE" }
        : { status: "ACTIVE" },
    },
    include: {
      user: true,
      class: true,
      payments: { where: { period } },
    },
  });

  const rows = pupils.map((p) => {
    const payment = p.payments[0];
    const amountDue = payment?.amountDue ?? p.class?.monthlyFee ?? null;
    const amountPaid = payment?.amountPaid ?? 0;
    const status = payment?.status ?? "UNPAID";
    const dueDate = payment?.dueDate ?? null;
    return {
      pupilId: p.userId,
      name: p.user.name,
      email: p.user.email,
      classId: p.classId,
      className: p.class?.name ?? null,
      classType: p.class?.type ?? null,
      status,
      amountDue,
      amountPaid,
      dueDate,
      period,
      isOverdue: isOverdue(status, dueDate),
    };
  });

  return filters.status ? rows.filter((r) => r.status === filters.status) : rows;
}

export async function getLedgerSummary(teacherId: string, period?: string) {
  const targetPeriod = period ?? currentPeriod();
  const rows = await getLedger(teacherId, { period: targetPeriod });

  let expected = 0;
  let collected = 0;
  let outstanding = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  const counts: Record<PaymentStatus, number> = { PAID: 0, UNPAID: 0, INCOMPLETE: 0 };

  for (const r of rows) {
    counts[r.status] += 1;
    const due = r.amountDue ?? 0;
    expected += due;
    collected += r.amountPaid;
    if (r.status !== "PAID") outstanding += Math.max(0, due - r.amountPaid);
    if (r.isOverdue) {
      overdueCount += 1;
      overdueAmount += Math.max(0, due - r.amountPaid);
    }
  }

  return {
    period: targetPeriod,
    pupilCount: rows.length,
    expected,
    collected,
    outstanding,
    overdueCount,
    overdueAmount,
    counts,
  };
}

export async function getPupilPaymentHistory(teacherId: string, pupilId: string, take = 6) {
  const pupil = await prisma.pupilProfile.findFirst({ where: { userId: pupilId, teacherId }, include: { class: true } });
  if (!pupil) throw new PaymentError("Pupil not found.", 404);

  const records = await prisma.paymentRecord.findMany({
    where: { pupilId },
    orderBy: { period: "desc" },
    take,
  });

  return records.map((r) => ({
    period: r.period,
    status: r.status,
    amountDue: r.amountDue ?? pupil.class?.monthlyFee ?? null,
    amountPaid: r.amountPaid,
    dueDate: r.dueDate,
    paidAt: r.paidAt,
    isOverdue: isOverdue(r.status, r.dueDate),
  }));
}

export async function getOwnPaymentHistory(pupilId: string, take = 12) {
  const pupil = await prisma.pupilProfile.findUnique({ where: { userId: pupilId }, include: { class: true } });
  if (!pupil) throw new PaymentError("Pupil profile not found.", 404);

  const records = await prisma.paymentRecord.findMany({
    where: { pupilId },
    orderBy: { period: "desc" },
    take,
  });

  return records.map((r) => ({
    period: r.period,
    status: r.status,
    amountDue: r.amountDue ?? pupil.class?.monthlyFee ?? null,
    amountPaid: r.amountPaid,
    dueDate: r.dueDate,
    paidAt: r.paidAt,
    isOverdue: isOverdue(r.status, r.dueDate),
  }));
}

export async function setPaymentStatus(
  teacherId: string,
  pupilId: string,
  input: {
    status?: PaymentStatus;
    period?: string;
    dueDate?: string | null;
    amountDue?: number | null;
    amountPaid?: number;
  }
) {
  const pupil = await prisma.pupilProfile.findFirst({ where: { userId: pupilId, teacherId }, include: { class: true } });
  if (!pupil) throw new PaymentError("Pupil not found.", 404);

  const period = input.period ?? currentPeriod();
  const existing = await prisma.paymentRecord.findUnique({ where: { pupilId_period: { pupilId, period } } });

  const status = input.status ?? existing?.status ?? "UNPAID";
  const dueDate = input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : existing?.dueDate ?? null;
  const amountDue =
    input.amountDue !== undefined ? input.amountDue : existing?.amountDue ?? pupil.class?.monthlyFee ?? null;
  const amountPaid = input.amountPaid !== undefined ? input.amountPaid : existing?.amountPaid ?? 0;

  return prisma.paymentRecord.upsert({
    where: { pupilId_period: { pupilId, period } },
    create: {
      pupilId,
      period,
      status,
      dueDate,
      amountDue,
      amountPaid,
      paidAt: status === "PAID" ? new Date() : null,
    },
    update: {
      status,
      dueDate,
      amountDue,
      amountPaid,
      paidAt: status === "PAID" ? existing?.paidAt ?? new Date() : null,
    },
  });
}

export async function getPaymentSummary(teacherId: string) {
  const period = currentPeriod();
  const pupils = await prisma.pupilProfile.findMany({
    where: { teacherId, classId: { not: null }, user: { status: "ACTIVE" } },
    include: { payments: { where: { period } } },
  });

  const summary = { PAID: 0, UNPAID: 0, INCOMPLETE: 0 };
  for (const p of pupils) {
    const status = p.payments[0]?.status ?? "UNPAID";
    summary[status] += 1;
  }
  return summary;
}

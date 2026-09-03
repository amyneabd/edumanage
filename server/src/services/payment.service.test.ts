import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../utils/prisma.js";
import { hashPassword } from "../utils/password.js";
import { currentPeriod, previousPeriod } from "../utils/period.js";
import { PaymentError, getPupilLedger, setPaymentStatus } from "./payment.service.js";

const TEST_EMAIL = `test-pupil-ledger-${Date.now()}@example.com`;
let teacherId: string;
let pupilId: string;
let classId: string;

function dateInPeriod(period: string, day: number): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(y!, m! - 1, day);
}

beforeAll(async () => {
  const passwordHash = await hashPassword("initial-Pass1");
  const teacher = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      name: "Pupil Ledger Test Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `PLT${Date.now()}` } },
    },
  });
  teacherId = teacher.id;

  const klass = await prisma.class.create({
    data: { teacherId, name: "Pupil Ledger Class", type: "MATH", monthlyFee: 100 },
  });
  classId = klass.id;

  const pupil = await prisma.user.create({
    data: {
      email: `test-pupil-ledger-pupil-${Date.now()}@example.com`,
      passwordHash,
      name: "Pupil Ledger Test Pupil",
      role: "PUPIL",
      status: "ACTIVE",
      pupilProfile: {
        create: { requestedType: "MATH", teacherId, classId, parentCode: `PLP${Date.now()}` },
      },
    },
  });
  pupilId = pupil.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: pupilId } }).catch(() => {});
  await prisma.user.delete({ where: { id: teacherId } }).catch(() => {});
});

beforeEach(async () => {
  await prisma.paymentRecord.deleteMany({ where: { pupilId } });
  await prisma.attendanceRecord.deleteMany({ where: { pupilId } });
});

describe("getPupilLedger", () => {
  it("throws when the pupil does not belong to this teacher", async () => {
    await expect(getPupilLedger("not-a-teacher", pupilId)).rejects.toThrow(PaymentError);
  });

  it("always includes a row for the current period, defaulting to the class fee when unbilled", async () => {
    const ledger = await getPupilLedger(teacherId, pupilId);
    const row = ledger.rows.find((r) => r.period === currentPeriod());
    expect(row).toBeDefined();
    expect(row?.status).toBe("UNPAID");
    expect(row?.amountDue).toBe(100);
    expect(row?.amountPaid).toBe(0);
  });

  it("includes attendance present/absent counts scoped to each period", async () => {
    const period = previousPeriod(currentPeriod());
    await setPaymentStatus(teacherId, pupilId, { period, status: "PAID", amountDue: 100, amountPaid: 100 });
    await prisma.attendanceRecord.create({
      data: { pupilId, classId, date: dateInPeriod(period, 3), status: "PRESENT" },
    });
    await prisma.attendanceRecord.create({
      data: { pupilId, classId, date: dateInPeriod(period, 10), status: "ABSENT" },
    });
    await prisma.attendanceRecord.create({
      data: { pupilId, classId, date: dateInPeriod(period, 17), status: "PRESENT" },
    });

    const ledger = await getPupilLedger(teacherId, pupilId);
    const row = ledger.rows.find((r) => r.period === period);
    expect(row).toBeDefined();
    expect(row?.present).toBe(2);
    expect(row?.absent).toBe(1);
  });

  it("computes an all-time balance that goes negative when the pupil has paid in advance / has credit", async () => {
    const period = previousPeriod(currentPeriod());
    await setPaymentStatus(teacherId, pupilId, { period, status: "PAID", amountDue: 100, amountPaid: 150 });

    const ledger = await getPupilLedger(teacherId, pupilId);
    // last period: due 100, paid 150 => -50 credit. Current period (unbilled fallback): due 100, paid 0 => +100.
    expect(ledger.balance).toBe(50);
  });

  it("does not clamp outstanding amounts, so unpaid periods increase balance owed", async () => {
    const period = previousPeriod(currentPeriod());
    await setPaymentStatus(teacherId, pupilId, { period, status: "UNPAID", amountDue: 100, amountPaid: 0 });

    const ledger = await getPupilLedger(teacherId, pupilId);
    expect(ledger.balance).toBe(200); // 100 last period + 100 current (unbilled fallback)
  });
});

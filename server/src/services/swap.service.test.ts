import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../utils/prisma.js";
import { hashPassword } from "../utils/password.js";
import {
  SwapError,
  listOtherClassesForPupil,
  createSwapRequest,
  listOwnSwapRequests,
  cancelSwapRequest,
  listSwapRequestsForTeacher,
  respondToSwapRequest,
} from "./swap.service.js";

const TEST_TAG = `swap-${Date.now()}`;
let teacherId: string;
let originClassId: string;
let targetClassId: string;
let otherTeacherClassId: string;
let otherTeacherId: string;
let pupilId: string;

function nextWeekday(dayOfWeek: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
  return d;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

beforeAll(async () => {
  const passwordHash = await hashPassword("initial-Pass1");

  const teacher = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-teacher@example.com`,
      passwordHash,
      name: "Swap Test Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `SWT${Date.now()}` } },
    },
  });
  teacherId = teacher.id;

  const originClass = await prisma.class.create({
    data: { teacherId, name: "Origin Class", type: "MATH", monthlyFee: 100 },
  });
  originClassId = originClass.id;
  await prisma.scheduleSlot.create({ data: { classId: originClassId, dayOfWeek: 1, startTime: "09:00", endTime: "10:00" } });

  const targetClass = await prisma.class.create({
    data: { teacherId, name: "Target Class", type: "MATH", monthlyFee: 100 },
  });
  targetClassId = targetClass.id;
  await prisma.scheduleSlot.create({ data: { classId: targetClassId, dayOfWeek: 3, startTime: "11:00", endTime: "12:00" } });

  const otherTeacher = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-other-teacher@example.com`,
      passwordHash,
      name: "Other Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `SWO${Date.now()}` } },
    },
  });
  otherTeacherId = otherTeacher.id;
  const otherClass = await prisma.class.create({
    data: { teacherId: otherTeacherId, name: "Other Teacher Class", type: "MATH", monthlyFee: 100 },
  });
  otherTeacherClassId = otherClass.id;
  await prisma.scheduleSlot.create({ data: { classId: otherTeacherClassId, dayOfWeek: 2, startTime: "09:00", endTime: "10:00" } });

  const pupil = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-pupil@example.com`,
      passwordHash,
      name: "Swap Test Pupil",
      role: "PUPIL",
      status: "ACTIVE",
      pupilProfile: {
        create: { requestedType: "MATH", teacherId, classId: originClassId, parentCode: `SWP${Date.now()}` },
      },
    },
  });
  pupilId = pupil.id;
});

afterAll(async () => {
  await prisma.swapRequest.deleteMany({ where: { pupilId } });
  await prisma.attendanceRecord.deleteMany({ where: { pupilId } });
  await prisma.user.delete({ where: { id: pupilId } }).catch(() => {});
  await prisma.class.deleteMany({ where: { teacherId: { in: [teacherId, otherTeacherId] } } });
  await prisma.user.delete({ where: { id: teacherId } }).catch(() => {});
  await prisma.user.delete({ where: { id: otherTeacherId } }).catch(() => {});
});

beforeEach(async () => {
  await prisma.swapRequest.deleteMany({ where: { pupilId } });
  await prisma.attendanceRecord.deleteMany({ where: { pupilId } });
});

describe("listOtherClassesForPupil", () => {
  it("excludes the pupil's own class and classes from other teachers", async () => {
    const classes = await listOtherClassesForPupil(pupilId);
    const ids = classes.map((c) => c.id);
    expect(ids).toContain(targetClassId);
    expect(ids).not.toContain(originClassId);
    expect(ids).not.toContain(otherTeacherClassId);
  });
});

describe("createSwapRequest", () => {
  it("throws when the pupil has no profile", async () => {
    await expect(
      createSwapRequest("not-a-pupil", {
        originDate: dateKey(nextWeekday(1)),
        targetClassId,
        targetDate: dateKey(nextWeekday(3)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when originDate is not a real scheduled session of the pupil's class", async () => {
    const badOrigin = nextWeekday(2); // Tuesday: origin class meets Monday only
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(badOrigin),
        targetClassId,
        targetDate: dateKey(nextWeekday(3)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when targetClassId belongs to a different teacher", async () => {
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(nextWeekday(1)),
        targetClassId: otherTeacherClassId,
        targetDate: dateKey(nextWeekday(2)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when targetClassId is the pupil's own class", async () => {
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(nextWeekday(1)),
        targetClassId: originClassId,
        targetDate: dateKey(nextWeekday(1)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when targetDate is not a real scheduled session of the target class", async () => {
    const badTarget = nextWeekday(4); // Thursday: target class meets Wednesday only
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(nextWeekday(1)),
        targetClassId,
        targetDate: dateKey(badTarget),
      })
    ).rejects.toThrow(SwapError);
  });

  it("throws when originDate is in the past", async () => {
    const past = new Date();
    past.setDate(past.getDate() - 7);
    while (past.getDay() !== 1) past.setDate(past.getDate() - 1);
    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(past),
        targetClassId,
        targetDate: dateKey(nextWeekday(3)),
      })
    ).rejects.toThrow(SwapError);
  });

  it("creates a PENDING swap request when all validations pass", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
      reason: "Doctor appointment",
    });
    expect(request.status).toBe("PENDING");
    expect(request.pupilId).toBe(pupilId);
    expect(request.originClassId).toBe(originClassId);
    expect(request.targetClassId).toBe(targetClassId);
    expect(request.reason).toBe("Doctor appointment");
  });

  it("throws when the pupil already has a PENDING request for the same originDate", async () => {
    const originDate = nextWeekday(1);
    await createSwapRequest(pupilId, {
      originDate: dateKey(originDate),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });

    await expect(
      createSwapRequest(pupilId, {
        originDate: dateKey(originDate),
        targetClassId,
        targetDate: dateKey(nextWeekday(3)),
      })
    ).rejects.toThrow(SwapError);
  });
});

describe("listOwnSwapRequests / cancelSwapRequest", () => {
  it("lists only the pupil's own requests, and cancel removes it", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });

    const list = await listOwnSwapRequests(pupilId);
    expect(list.some((r) => r.id === request.id)).toBe(true);

    await cancelSwapRequest(pupilId, request.id);

    const listAfter = await listOwnSwapRequests(pupilId);
    expect(listAfter.some((r) => r.id === request.id)).toBe(false);
  });

  it("throws when cancelling a request that isn't the pupil's own", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });
    await expect(cancelSwapRequest("someone-else", request.id)).rejects.toThrow(SwapError);
  });

  it("throws when cancelling a request that has already been approved", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });

    await respondToSwapRequest(teacherId, request.id, "APPROVED");

    await expect(cancelSwapRequest(pupilId, request.id)).rejects.toThrow(SwapError);
  });
});

describe("listSwapRequestsForTeacher / respondToSwapRequest", () => {
  it("lists pending requests for classes the teacher owns (as origin or target)", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });
    const list = await listSwapRequestsForTeacher(teacherId, "PENDING");
    expect(list.some((r) => r.id === request.id)).toBe(true);
  });

  it("approving marks origin-date attendance EXCUSED for the pupil", async () => {
    const originDate = nextWeekday(1);
    const targetDate = nextWeekday(3);
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(originDate),
      targetClassId,
      targetDate: dateKey(targetDate),
    });

    const approved = await respondToSwapRequest(teacherId, request.id, "APPROVED");
    expect(approved.status).toBe("APPROVED");

    const record = await prisma.attendanceRecord.findFirst({ where: { pupilId, classId: originClassId } });
    expect(record?.status).toBe("EXCUSED");
  });

  it("declining does not create an attendance record", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });

    const declined = await respondToSwapRequest(teacherId, request.id, "DECLINED");
    expect(declined.status).toBe("DECLINED");

    const record = await prisma.attendanceRecord.findFirst({ where: { pupilId, classId: originClassId } });
    expect(record).toBeNull();
  });

  it("throws when responding to a request for a class the teacher doesn't own", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });
    await expect(respondToSwapRequest(otherTeacherId, request.id, "APPROVED")).rejects.toThrow(SwapError);
  });

  it("throws when responding to a request that has already been resolved", async () => {
    const request = await createSwapRequest(pupilId, {
      originDate: dateKey(nextWeekday(1)),
      targetClassId,
      targetDate: dateKey(nextWeekday(3)),
    });

    await respondToSwapRequest(teacherId, request.id, "APPROVED");

    await expect(respondToSwapRequest(teacherId, request.id, "DECLINED")).rejects.toThrow(SwapError);
  });
});

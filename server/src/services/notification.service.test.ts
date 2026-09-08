import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../utils/prisma.js";

const { sendPushToUserMock } = vi.hoisted(() => ({ sendPushToUserMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./push.service.js", () => ({ sendPushToUser: sendPushToUserMock }));

const { createNotification, runDailyNotificationSync } = await import("./notification.service.js");

const TEST_TAG = `notif-svc-${Date.now()}`;
let teacherId: string;
let parentId: string;

beforeAll(async () => {
  const teacher = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-teacher@example.com`,
      supabaseId: randomUUID(),
      name: "Notif Test Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `NT${Date.now()}` } },
    },
  });
  teacherId = teacher.id;

  const parent = await prisma.user.create({
    data: {
      email: `${TEST_TAG}-parent@example.com`,
      supabaseId: randomUUID(),
      name: "Notif Test Parent",
      role: "PARENT",
      status: "ACTIVE",
      parentProfile: { create: {} },
    },
  });
  parentId = parent.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { OR: [{ teacherId }, { parentId }] } });
  await prisma.parentProfile.deleteMany({ where: { userId: parentId } });
  await prisma.teacherProfile.deleteMany({ where: { userId: teacherId } });
  await prisma.user.deleteMany({ where: { id: { in: [teacherId, parentId] } } });
});

afterEach(async () => {
  await prisma.notification.deleteMany({ where: { OR: [{ teacherId }, { parentId }] } });
  sendPushToUserMock.mockClear();
});

describe("createNotification push wiring", () => {
  it("sends a push notification once a genuinely new row is created (teacher recipient)", async () => {
    await createNotification({
      teacherId,
      type: "SWAP_REQUEST",
      title: "Nouvelle demande d'échange",
      body: "Un élève souhaite échanger une séance.",
      link: "/teacher/swap-requests",
    });

    expect(sendPushToUserMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUserMock).toHaveBeenCalledWith(teacherId, {
      title: "Nouvelle demande d'échange",
      body: "Un élève souhaite échanger une séance.",
      link: "/teacher/swap-requests",
    });
  });

  it("sends a push notification once a genuinely new row is created (parent recipient)", async () => {
    await createNotification({
      parentId,
      type: "POST_PUBLISHED",
      title: "Nouveau contenu publié",
      body: "Un nouveau cours a été publié.",
      link: "/parent/feed",
    });

    expect(sendPushToUserMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUserMock).toHaveBeenCalledWith(parentId, {
      title: "Nouveau contenu publié",
      body: "Un nouveau cours a été publié.",
      link: "/parent/feed",
    });
  });

  it("does not send a push notification when dedupe short-circuits", async () => {
    const dedupeKey = `dedupe-test:${TEST_TAG}`;
    await createNotification({
      teacherId,
      type: "ABSENCE",
      title: "Absence",
      body: "Premier appel",
      dedupeKey,
    });
    sendPushToUserMock.mockClear();

    await createNotification({
      teacherId,
      type: "ABSENCE",
      title: "Absence",
      body: "Deuxième appel (déduppliqué)",
      dedupeKey,
    });

    expect(sendPushToUserMock).not.toHaveBeenCalled();
  });
});

describe("runDailyNotificationSync", () => {
  it("runs the lazy sync functions for every active teacher and parent, skipping inactive ones", async () => {
    const inactiveTeacher = await prisma.user.create({
      data: {
        email: `${TEST_TAG}-inactive-teacher@example.com`,
        supabaseId: randomUUID(),
        name: "Inactive Teacher",
        role: "TEACHER",
        status: "PENDING",
        teacherProfile: { create: { teacherCode: `NTI${Date.now()}` } },
      },
    });

    try {
      const klass = await prisma.class.create({
        data: { teacherId, name: "Sync Test Class", type: "MATH", monthlyFee: 100 },
      });
      const pupilUser = await prisma.user.create({
        data: {
          email: `${TEST_TAG}-pupil@example.com`,
          supabaseId: randomUUID(),
          name: "Sync Test Pupil",
          role: "PUPIL",
          status: "ACTIVE",
          pupilProfile: {
            create: { requestedType: "MATH", teacherId, classId: klass.id, parentCode: `NPC${Date.now()}` },
          },
        },
      });
      await prisma.parentLink.create({
        data: { parentId, pupilId: pupilUser.id, teacherId, status: "ACTIVE", respondedAt: new Date() },
      });
      await prisma.paymentRecord.create({
        data: { pupilId: pupilUser.id, period: "2026-09", status: "UNPAID", amountDue: 100, dueDate: new Date() },
      });

      await runDailyNotificationSync();

      const teacherNotifs = await prisma.notification.findMany({ where: { teacherId, type: "PAYMENT_DUE" } });
      expect(teacherNotifs).toHaveLength(1);

      const parentNotifs = await prisma.notification.findMany({ where: { parentId, type: "PAYMENT_DUE" } });
      expect(parentNotifs).toHaveLength(1);

      const inactiveTeacherNotifs = await prisma.notification.findMany({
        where: { teacherId: inactiveTeacher.id },
      });
      expect(inactiveTeacherNotifs).toHaveLength(0);

      // One push per notification actually created (teacher row + parent row above).
      expect(sendPushToUserMock).toHaveBeenCalledTimes(2);

      await prisma.paymentRecord.deleteMany({ where: { pupilId: pupilUser.id } });
      await prisma.parentLink.deleteMany({ where: { pupilId: pupilUser.id } });
      await prisma.pupilProfile.deleteMany({ where: { userId: pupilUser.id } });
      await prisma.user.deleteMany({ where: { id: pupilUser.id } });
      await prisma.class.deleteMany({ where: { id: klass.id } });
    } finally {
      await prisma.teacherProfile.deleteMany({ where: { userId: inactiveTeacher.id } });
      await prisma.user.deleteMany({ where: { id: inactiveTeacher.id } });
    }
  });
});

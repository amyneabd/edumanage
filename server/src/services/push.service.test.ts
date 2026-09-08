import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../utils/prisma.js";

const { envMock, sendNotificationMock } = vi.hoisted(() => ({
  envMock: { vapid: null as { publicKey: string; privateKey: string; subject: string } | null },
  sendNotificationMock: vi.fn(),
}));

vi.mock("../utils/env.js", () => ({ env: envMock }));
vi.mock("../utils/vapid.js", () => ({ webpush: { sendNotification: sendNotificationMock } }));

const { saveSubscription, removeSubscription, sendPushToUser } = await import("./push.service.js");

const TEST_TAG = `push-${Date.now()}`;
let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `${TEST_TAG}@example.com`,
      supabaseId: randomUUID(),
      name: "Push Test User",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode: `PT${Date.now()}` } },
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.pushSubscription.deleteMany({ where: { userId } });
  await prisma.teacherProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

afterEach(async () => {
  await prisma.pushSubscription.deleteMany({ where: { userId } });
  sendNotificationMock.mockReset();
  envMock.vapid = null;
});

describe("saveSubscription", () => {
  it("creates a new subscription row", async () => {
    await saveSubscription(userId, {
      endpoint: `https://push.example.com/${TEST_TAG}-1`,
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });

    const row = await prisma.pushSubscription.findUnique({
      where: { endpoint: `https://push.example.com/${TEST_TAG}-1` },
    });
    expect(row).not.toBeNull();
    expect(row?.userId).toBe(userId);
    expect(row?.p256dh).toBe("p256dh-key");
    expect(row?.auth).toBe("auth-key");
  });

  it("upserts (no duplicate row) when the same endpoint subscribes again", async () => {
    const endpoint = `https://push.example.com/${TEST_TAG}-2`;
    await saveSubscription(userId, { endpoint, keys: { p256dh: "old", auth: "old" } });
    await saveSubscription(userId, { endpoint, keys: { p256dh: "new", auth: "new" } });

    const rows = await prisma.pushSubscription.findMany({ where: { endpoint } });
    expect(rows).toHaveLength(1);
    expect(rows[0].p256dh).toBe("new");
  });
});

describe("removeSubscription", () => {
  it("deletes the subscription with the given endpoint", async () => {
    const endpoint = `https://push.example.com/${TEST_TAG}-3`;
    await saveSubscription(userId, { endpoint, keys: { p256dh: "p", auth: "a" } });

    await removeSubscription(endpoint);

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row).toBeNull();
  });

  it("does not throw when the endpoint doesn't exist", async () => {
    await expect(removeSubscription("https://push.example.com/does-not-exist")).resolves.toBeUndefined();
  });
});

describe("sendPushToUser", () => {
  it("does nothing when VAPID is not configured", async () => {
    envMock.vapid = null;
    await saveSubscription(userId, {
      endpoint: `https://push.example.com/${TEST_TAG}-4`,
      keys: { p256dh: "p", auth: "a" },
    });

    await sendPushToUser(userId, { title: "Hi", body: "There" });

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no subscriptions", async () => {
    envMock.vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@bachandi.app" };

    await sendPushToUser(userId, { title: "Hi", body: "There" });

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("sends to every subscription for the user", async () => {
    envMock.vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@bachandi.app" };
    sendNotificationMock.mockResolvedValue(undefined);
    await saveSubscription(userId, {
      endpoint: `https://push.example.com/${TEST_TAG}-5a`,
      keys: { p256dh: "p1", auth: "a1" },
    });
    await saveSubscription(userId, {
      endpoint: `https://push.example.com/${TEST_TAG}-5b`,
      keys: { p256dh: "p2", auth: "a2" },
    });

    await sendPushToUser(userId, { title: "Hi", body: "There", link: "/teacher/overview" });

    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(sendNotificationMock).toHaveBeenCalledWith(
      { endpoint: `https://push.example.com/${TEST_TAG}-5a`, keys: { p256dh: "p1", auth: "a1" } },
      JSON.stringify({ title: "Hi", body: "There", link: "/teacher/overview" })
    );
  });

  it("deletes the subscription when the push service responds 410 Gone", async () => {
    envMock.vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@bachandi.app" };
    const endpoint = `https://push.example.com/${TEST_TAG}-6`;
    await saveSubscription(userId, { endpoint, keys: { p256dh: "p", auth: "a" } });
    sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));

    await sendPushToUser(userId, { title: "Hi", body: "There" });

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row).toBeNull();
  });

  it("keeps the subscription and logs on other errors", async () => {
    envMock.vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:test@bachandi.app" };
    const endpoint = `https://push.example.com/${TEST_TAG}-7`;
    await saveSubscription(userId, { endpoint, keys: { p256dh: "p", auth: "a" } });
    sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error("Server error"), { statusCode: 500 }));

    await expect(sendPushToUser(userId, { title: "Hi", body: "There" })).resolves.toBeUndefined();

    const row = await prisma.pushSubscription.findUnique({ where: { endpoint } });
    expect(row).not.toBeNull();
  });
});

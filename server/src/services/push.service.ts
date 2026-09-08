import { prisma } from "../utils/prisma.js";
import { env } from "../utils/env.js";
import { webpush } from "../utils/vapid.js";

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  link?: string | null;
}

export async function saveSubscription(userId: string, sub: PushSubscriptionInput): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/**
 * Fans out a push notification to every device the user has subscribed
 * from. Never throws — a delivery failure here must not block whatever
 * created the underlying in-app notification. Stale subscriptions (the push
 * service responds 404/410, meaning the browser unsubscribed, cleared data,
 * or the OS revoked permission) are deleted so they aren't retried forever.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!env.vapid) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        } else {
          console.error("[push] failed to send notification", err);
        }
      }
    })
  );
}

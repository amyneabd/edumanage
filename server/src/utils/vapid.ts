import webpush from "web-push";
import { env } from "./env.js";

// Configures the web-push library once at startup. If VAPID env vars are
// absent (e.g. local dev without keys configured), setVapidDetails is simply
// never called — push.service.ts's sendPushToUser checks env.vapid first and
// no-ops in that case, so webpush.sendNotification is never invoked
// unconfigured.
if (env.vapid) {
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
}

export { webpush };

export const vapidPublicKey: string | null = env.vapid?.publicKey ?? null;

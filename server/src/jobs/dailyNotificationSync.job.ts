import { runDailyNotificationSync } from "../services/notification.service.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Starts the recurring daily sync that proactively creates (and pushes)
 * PAYMENT_DUE / MONTHLY_RECAP / SUBMISSION_MISSING notifications, instead of
 * only generating them lazily when a bell is opened. Runs on a plain
 * setInterval since the deploy is a single always-on process (render.yaml
 * has no separate worker/cron service), and every underlying sync function
 * is already idempotent via Notification.dedupeKey — so no extra
 * "already ran today" guard is needed, even across process restarts.
 */
export function startDailyNotificationSyncJob(): void {
  setInterval(() => {
    runDailyNotificationSync().catch((err) => {
      console.error("[push] daily notification sync failed", err);
    });
  }, ONE_DAY_MS);
}

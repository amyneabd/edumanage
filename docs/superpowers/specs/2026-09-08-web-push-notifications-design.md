# Web Push Notifications — Design Spec

**Date:** 2026-09-08
**Status:** Approved, ready for implementation planning

## Goal

Extend the existing in-app `Notification` system so teachers and parents also
receive a native OS/browser push notification when a new notification is
created for them — even when the Bachandi tab/app is closed.

## Background

Today, notifications are 100% pull-based: `NotificationBell.tsx` polls
`GET /teacher/notifications` or `GET /parent/notifications` every 15 seconds
via TanStack Query, and nothing is delivered while no tab is open. There is
no WebSocket/SSE/push mechanism anywhere in the codebase, and no PWA
scaffolding (no service worker, no manifest).

The existing `Notification` Prisma model (`server/prisma/schema.prisma`) has
9 types in `NotificationType`. Six are event-driven (created the moment the
underlying action happens): `PUPIL_REQUEST`, `PARENT_REQUEST`,
`POST_PUBLISHED`, `EXAM_SUBMISSION`, `SWAP_REQUEST`, `ABSENCE`. Three are
lazily generated — created only when `listNotifications`/
`listNotificationsForParent` is called (i.e., when someone opens the bell):
`PAYMENT_DUE`, `MONTHLY_RECAP`, `SUBMISSION_MISSING`. (`VISIT_REQUEST` exists
in the enum but has no call site — out of scope, untouched.)

Every creation path funnels through one function:
`createNotification(...)` in `server/src/services/notification.service.ts`.

## Decisions (from brainstorming)

1. **Native Web Push**, not a third-party service (Firebase/OneSignal). Use
   the `web-push` npm package + self-generated VAPID keys. No vendor
   lock-in, no external account, works on the existing single always-on
   Render Express process.
2. **Lazy notification types get a daily scheduled job** so push works for
   them too, instead of staying purely on-read. Reuses the existing sync
   functions (`syncPaymentDueNotifications`, `syncMonthlyRecapNotifications`,
   `syncSubmissionMissingNotificationsForParent`).
3. **Scope: teachers and parents only**, matching exactly who receives
   notifications today. No new notification types, no pupil-facing changes.
4. **Multi-device**: a user may have multiple active push subscriptions
   (e.g. phone + laptop). All are fanned out to; each is independently
   removed if it goes stale.
5. **Opt-in UX**: a toggle placed next to the existing `NotificationBell` in
   the authenticated header. No forced prompt/banner on login.

## Architecture

The client registers a service worker (`client/public/sw.js`) that listens
for `push` and `notificationclick` events. When a user enables notifications
via the new bell-toggle, the browser grants a `PushSubscription` (an
endpoint URL + encryption keys), which is POSTed to the server and stored.

Whenever `createNotification(...)` successfully inserts a new (non-deduped)
row, it also calls `sendPushToUser(recipientUserId, payload)`, which loads
all `PushSubscription` rows for that user and calls `web-push`'s
`sendNotification` for each. The browser vendor's push infrastructure
delivers the encrypted payload and wakes the service worker even if the tab
is closed, which calls `showNotification(...)` to render a native OS
notification.

This gives all 9 notification types push delivery through one integration
point — no changes needed at any of the individual `createNotification`
call sites (`auth.service.ts:97`, `parent.service.ts:53`, `post.service.ts`,
`swap.service.ts:98`, `attendance.service.ts:229`).

`teacherId`/`parentId` on `Notification` are already `User.id` values (FKs to
`TeacherProfile.userId`/`ParentProfile.userId`, which are themselves
`User.id`), so no ID-translation lookup is needed to resolve which
`PushSubscription` rows belong to a recipient.

## Data Model

New Prisma model, one row per subscribed browser/device:

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
}
```

`endpoint` is a full URL issued by the browser vendor's push service, so it
is globally unique and doubles as the natural dedupe key — resubscribing the
same browser upserts rather than duplicating.

## New Files

**Server:**
- `server/src/utils/vapid.ts` — configures the `web-push` library with
  `env.vapid.publicKey/privateKey/subject` once at startup. Exports the
  public key. If VAPID env vars are absent, exports a no-op sender (same
  optional-integration pattern as `env.ts`'s `resend`/`supabaseStorage`) so
  local dev without keys configured doesn't crash — push is simply
  disabled, everything else works unchanged.
- `server/src/services/push.service.ts`:
  - `saveSubscription(userId, sub)` — upsert by `endpoint`.
  - `removeSubscription(endpoint)` — delete by endpoint (used by the
    client's explicit "disable" action).
  - `sendPushToUser(userId, payload)` — fetch all subscriptions for
    `userId`, call `web-push`'s `sendNotification` for each. On a `404`/
    `410` response from the push service (subscription is dead — user
    uninstalled, cleared browser data, or revoked OS-level permission),
    delete that row. Other errors are logged, row kept. Never throws to the
    caller.
  - `runDailyNotificationSync()` — iterates all `ACTIVE` teachers and
    parents, calling the existing sync functions for each, so
    `PAYMENT_DUE`/`MONTHLY_RECAP`/`SUBMISSION_MISSING` get created (and
    thus pushed) proactively instead of only on next bell-open.
- `server/src/controllers/push.controller.ts` + routes:
  - `GET /push/public-key` — unauthenticated (the VAPID public key is
    public by design).
  - `POST /push/subscribe` — authenticated, `TEACHER`/`PARENT` roles only.
  - `DELETE /push/subscribe` — authenticated, same roles.
- `server.ts`: a `setInterval` (24h, with a same-day re-entry guard so a
  process restart doesn't double-fire) calling `runDailyNotificationSync()`.
  No separate worker/cron service exists in `render.yaml`, so this reuses
  the one always-on process rather than introducing new infrastructure.
- `notification.service.ts`: `createNotification` calls `sendPushToUser`
  right after a genuinely new row is inserted (not on a deduped no-op
  return).

**Client:**
- `client/public/sw.js` — minimal service worker:
  - `push` event → `self.registration.showNotification(title, { body, icon, data: { link } })`
  - `notificationclick` event → `clients.openWindow(event.notification.data.link)`
- `client/src/hooks/usePushSubscription.ts` — checks `Notification.permission`
  and `registration.pushManager.getSubscription()` on mount; exposes
  `enable()`/`disable()` that register the service worker, request
  permission, subscribe/unsubscribe via `pushManager`, and call
  `POST`/`DELETE /push/subscribe`.
- A bell-toggle UI component placed next to `NotificationBell.tsx` in the
  authenticated header.

## Error Handling

- Push failures never propagate to the caller of `createNotification` — a
  teacher marking a pupil absent must succeed even if the parent's push
  delivery fails, matching the existing pattern where email failures in
  `createNotification` are caught and logged, not thrown.
- Stale subscriptions (410/404) are deleted automatically so they aren't
  retried forever.
- Missing VAPID configuration disables push entirely (no-op sender);
  subscribe endpoints return a clear "push not configured" error; the rest
  of the app is unaffected.
- Client: if `Notification.requestPermission()` resolves to `"denied"`, show
  an inline message directing the user to their browser's site settings.
  The toggle's displayed state is derived from `Notification.permission` on
  every mount, so it self-corrects if the user changes the permission
  outside the app.

## Testing

- Server: unit tests for `push.service.ts` (fan-out to N subscriptions,
  deletion on 410, no-op with zero subscriptions, no-op when VAPID
  unconfigured), mocking the `web-push` module — no real network calls.
- Server: extend `notification.service` tests to confirm `sendPushToUser` is
  called exactly once per newly-created (non-deduped) notification row, and
  not at all when dedupe short-circuits.
- Server: unit test for `runDailyNotificationSync`'s iteration logic.
- Client: unit test for the bell-toggle component's three states
  (unsupported browser / permission not yet granted / subscribed), mocking
  `navigator.serviceWorker` and `Notification`.
- No end-to-end push-delivery test (requires a real browser + real push
  service — out of scope); manual verification during implementation is the
  practical check.

## Out of Scope

- Pupil-facing push/notifications (pupils receive no notifications today;
  unchanged).
- `VISIT_REQUEST` notification type (unused, no call site).
- Any third-party push service (Firebase/OneSignal) — native Web Push only.
- Forced permission-prompt banners — opt-in toggle only.
- Multi-instance VAPID key coordination beyond storing keys in env vars
  (current deploy is single-instance).

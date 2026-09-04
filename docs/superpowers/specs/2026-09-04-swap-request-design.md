# Swap Request — Design

## Context

Today, a pupil who wants to attend a different class session uses "visit requests" (`VisitRequest`): they pick a target class + date, the teacher approves or declines, and that's the end of it — nothing else in the app reacts. In particular, the pupil's *own* scheduled session for that day is untouched: their attendance calendar still shows it as a normal upcoming/unmarked session, even though they've said they won't be there.

The actual need is a **swap**, not a one-way visit: the pupil is trading one of their own sessions for a session in another class. Both sides of the trade should be explicit and both should be reflected in their calendar — the origin session they're skipping should show as excused, not silently vanish or stay unmarked/absent.

This spec replaces `VisitRequest` entirely with `SwapRequest`. There is no dual-running period and no migration of existing rows — the existing feature has zero production usage patterns worth preserving (confirmed: no test coverage, no pupil-facing notification on resolution, no integration with attendance or vacation logic), so the cleanest path is a straight replacement. Existing `VisitRequest` rows are dropped.

## Data model

`VisitRequest` and `VisitRequestStatus` are removed. `SwapRequest` replaces them, with two named relations to `Class` since a swap always references two classes — the pupil's own class (origin, being skipped) and the class they're attending instead (target):

```prisma
enum SwapRequestStatus {
  PENDING
  APPROVED
  DECLINED
}

model SwapRequest {
  id            String            @id @default(cuid())
  pupilId       String
  pupil         PupilProfile      @relation(fields: [pupilId], references: [userId], onDelete: Cascade)
  originClassId String
  originClass   Class             @relation("SwapRequestOrigin", fields: [originClassId], references: [id], onDelete: Cascade)
  originDate    DateTime
  targetClassId String
  targetClass   Class             @relation("SwapRequestTarget", fields: [targetClassId], references: [id], onDelete: Cascade)
  targetDate    DateTime
  reason        String?
  status        SwapRequestStatus @default(PENDING)
  createdAt     DateTime          @default(now())
  respondedAt   DateTime?

  @@index([originClassId, status])
  @@index([targetClassId, status])
  @@index([pupilId])
}
```

- `PupilProfile.visitRequests` → `PupilProfile.swapRequests SwapRequest[]`.
- `Class.visitRequests` → two back-relations: `Class.swapRequestsOrigin SwapRequest[] @relation("SwapRequestOrigin")` and `Class.swapRequestsTarget SwapRequest[] @relation("SwapRequestTarget")`.
- `originClassId` is always the pupil's own class at request time (not user-entered — the service fills it in from `PupilProfile.classId`). It's stored explicitly, not just implied by `pupil.classId`, so a request stays meaningful even if the pupil later changes class.

**`AttendanceStatus` gains a third value:**

```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
  EXCUSED
}
```

`EXCUSED` means "this pupil had a scheduled session here but was approved to be elsewhere" — set automatically when a swap is approved (see Backend behavior). It is never set by direct teacher action; there's no manual "mark excused" button in this spec (see Non-goals).

**`NotificationType` gains a value and keeps the old one:**

```prisma
enum NotificationType {
  PUPIL_REQUEST
  EXAM_SUBMISSION
  PAYMENT_DUE
  MONTHLY_RECAP
  VISIT_REQUEST   // retained, unused going forward — existing Notification rows reference it
  SWAP_REQUEST
  PARENT_REQUEST
  POST_PUBLISHED
  ABSENCE
  SUBMISSION_MISSING
}
```

`VISIT_REQUEST` stays in the enum so historical `Notification` rows that reference it don't break; nothing new is ever created with that value after this change ships.

**Migration:** drop the `VisitRequest` table and `VisitRequestStatus` enum. This is a destructive migration (existing visit-request rows are lost) — approved: the feature has no data worth preserving.

## Backend behavior

`server/src/services/visit.service.ts` is deleted; `server/src/services/swap.service.ts` replaces it, following the same shape and error-handling convention (`SwapError extends Error` with a `status`, mirroring `VisitError`):

- `listOtherClassesForPupil(pupilId)` — **unchanged**, carried over as-is. Still needed to populate the "attend this class instead" picker.

- `createSwapRequest(pupilId, input: { originDate: string; targetClassId: string; targetDate: string; reason?: string | null })`:
  1. Load `PupilProfile`; 404 if missing. 400 "You must be assigned to a class first." if `classId` is null. `originClassId = profile.classId`.
  2. `targetClassId` must resolve to a `Class` taught by `profile.teacherId`; 404 otherwise. 400 "You're already enrolled in that class." if `targetClassId === originClassId`.
  3. Parse both `originDate` and `targetDate`; 400 "Invalid date." if either fails to parse. Both are normalized to midnight and must not be before today (400 "Session date can't be in the past.") — same rule the old `sessionDate` check used.
  4. **Origin must be a real session of the pupil's own class**: valid if either (a) `originDate`'s weekday matches one of the origin class's `ScheduleSlot`s, or (b) `getVacationSessionForDate(originClassId, originDate)` (from `vacation.service.ts`) returns a session. Otherwise 400 "That's not one of your scheduled sessions."
  5. **Target must be a real session of the target class**, validated the same way against the target class's schedule/vacation sessions. Otherwise 400 "That class doesn't have a session on that date."
  6. Reject if the pupil already has a `PENDING` swap request for the same `originDate` (409 "You already have a pending swap request for that session.") — a pupil can only be mid-swap for a given session once at a time.
  7. Create the `SwapRequest` row, then notify the teacher (reusing `createNotification` exactly as `visit.service.ts` does today):
     ```ts
     await createNotification({
       teacherId: targetClass.teacherId,
       type: "SWAP_REQUEST",
       title: "New session swap request",
       body: `${pupilName} wants to attend ${targetClass.name} on ${targetDate.toLocaleDateString()} instead of their ${originClass.name} session on ${originDate.toLocaleDateString()}.`,
       link: "/teacher/classes",
       dedupeKey: `swap-request:${request.id}`,
     });
     ```

- `listOwnSwapRequests(pupilId)` — same pattern as `listOwnVisitRequests`, including both `originClass` and `targetClass`.

- `cancelSwapRequest(pupilId, id)` — same as `cancelVisitRequest`: 404 if not found/not owned, 400 "Only pending requests can be cancelled." if not `PENDING`, else delete. No attendance side effect (nothing was ever written for a still-pending request).

- `listSwapRequestsForTeacher(teacherId, status?)` — filters `where: { originClass: { teacherId }, ...(status ? { status } : {}) }` (equivalent to the old `class: { teacherId }` filter; `originClass` is always the teacher's own class since a pupil's class always belongs to their own teacher).

- `respondToSwapRequest(teacherId, id, approve: boolean)`:
  1. Find the request where `id` and `originClass: { teacherId }`; 404 otherwise. 400 "This request has already been resolved." if not `PENDING`.
  2. Update `status` to `APPROVED`/`DECLINED`, `respondedAt: new Date()`.
  3. **On approve only**, upsert the pupil's `AttendanceRecord` for `(pupilId, originDate)`:
     ```ts
     await prisma.attendanceRecord.upsert({
       where: { pupilId_date: { pupilId: request.pupilId, date: request.originDate } },
       create: { pupilId: request.pupilId, classId: request.originClassId, date: request.originDate, status: "EXCUSED" },
       update: { status: "EXCUSED", classId: request.originClassId },
     });
     ```
     This overwrites any prior mark (unmarked, or even an already-recorded ABSENT/PRESENT) for that day — approving a swap is the teacher's explicit statement that the pupil's absence from the origin session is excused.
  4. On decline, no attendance side effect.
  5. No pupil-facing notification on either outcome — matches today's `VisitRequest` behavior (see Non-goals).

**Existing service/route touch points**, renamed and adjusted, no behavior change beyond the rename:

- `admin.service.ts`: `pendingVisitRequests` (via `prisma.visitRequest.count(...)`) → `pendingSwapRequests` (via `prisma.swapRequest.count({ where: { originClass: { teacherId }, status: "PENDING" } })`).
- `class.service.ts` `getClassDetail`: the `visitRequests: { where: { status: "APPROVED", sessionDate: { gte: startOfToday } }, ... }` include (used to list upcoming approved visitors for a class) becomes `swapRequestsTarget: { where: { status: "APPROVED", targetDate: { gte: startOfToday } }, ... }` — same "who's visiting this class soon" purpose, now unambiguously scoped to the target side.
- `attendance.service.ts`: the calendar builder (`buildAttendanceDays`) and its `display`/`record` typing need `"EXCUSED"` added alongside `"PRESENT" | "ABSENT" | null` for `record`, and a corresponding calendar `display` value (see Frontend). No change to the PRESENT/ABSENT/FUTURE/TODAY/UNMARKED branching logic itself — `EXCUSED` is just another possible stored `status`, surfaced the same way `PRESENT`/`ABSENT` already are.

**Routes**, renamed 1:1 from the old 7:

Pupil (`pupil.routes.ts` / `pupil.controller.ts`):
- `GET /pupil/classes/other` — unchanged (still backed by `listOtherClassesForPupil`).
- `GET /pupil/swap-requests` — `listOwnSwapRequests`.
- `POST /pupil/swap-requests` — `createSwapRequest`, body `{ originDate, targetClassId, targetDate, reason? }`.
- `DELETE /pupil/swap-requests/:id` — `cancelSwapRequest`.

Teacher (`teacher.routes.ts` / `teacher.controller.ts`):
- `GET /teacher/swap-requests` — `listSwapRequestsForTeacher`, optional `?status=`.
- `POST /teacher/swap-requests/:id/approve` — `respondToSwapRequest(..., true)`.
- `POST /teacher/swap-requests/:id/decline` — `respondToSwapRequest(..., false)`.

Handler names follow the existing convention (`visitRequestsHandler` → `swapRequestsHandler`, etc.) and the shared error-mapping helper (`handleVisitError` → `handleSwapError`) is renamed but otherwise identical.

## Frontend

**Types (`api/types.ts`):**
- `VisitRequestStatus` → `SwapRequestStatus` (same three values).
- `ClassVisitor` / `ClassSummary.visitRequests` → the "upcoming visitors" shape used by `ClassDetailPage`, renamed to reflect it's now target-side swaps (e.g. `ClassSwapVisitor`, `ClassSummary.swapVisitors`).
- `PupilVisitRequest` → `PupilSwapRequest`, gains `originClassId`, `originClassName`, `originDate` alongside the renamed `targetClassId`/`targetClassName`/`targetClassType`/`targetDate` (previously just `classId`/`className`/`classType`/`sessionDate`).
- `TeacherVisitRequest` → `TeacherSwapRequest`, same origin/target field split, keeps `pupilId`/`pupilName`/`pupilEmail`.
- `AdminTeacherDetail.pendingVisitRequests` → `pendingSwapRequests`.
- `AttendanceStatus` → `"PRESENT" | "ABSENT" | "EXCUSED"`.
- `AttendanceDisplay` gains `"EXCUSED"` alongside the existing `"FUTURE" | "TODAY" | "PRESENT" | "ABSENT" | "UNMARKED"`.

**`api/pupil.ts`:** `fetchOwnVisitRequests`/`createVisitRequest`/`cancelVisitRequest` → `fetchOwnSwapRequests`/`createSwapRequest`/`cancelSwapRequest`, hitting the renamed routes; `createSwapRequest`'s input becomes `{ originDate: string; targetClassId: string; targetDate: string; reason?: string }`.

**`api/teacher.ts`:** `fetchVisitRequests`/`approveVisitRequest`/`declineVisitRequest` → `fetchSwapRequests`/`approveSwapRequest`/`declineSwapRequest`.

**`components/Badge.tsx`:** `VisitStatusBadge` → `SwapStatusBadge`, same color/label maps, retyped to `SwapRequestStatus`.

**`lib/notificationMeta.ts`:** add a `SWAP_REQUEST` entry (same `CalendarClock` icon/color the old `VISIT_REQUEST` entry used); leave the `VISIT_REQUEST` entry in place so any old, still-unread notification renders correctly.

**`features/pupil/SchedulePage.tsx`:** `VisitRequestForm` → `SwapRequestForm`, `MyVisitRequests` → `MySwapRequests`. The form changes shape — it currently only collects a target class + date; it now needs to collect **both**:
- **"Session you'll miss"** — a date input for `originDate`. To keep this simple and consistent with how the pupil already understands their own schedule (the existing weekly grid / vacation list on this same page), it's a plain date input rather than a computed dropdown of upcoming sessions — YAGNI: the server already validates the date is a real session of their class, and an invalid pick surfaces the same inline error the old form used for bad target dates.
- **"Class + date you'll attend instead"** — unchanged from today: a class picker sourced from `fetchOtherClasses` plus a date input for `targetDate`.
- Optional reason field, unchanged.
- `MySwapRequests` list gains an "instead of <origin class> on <origin date>" line per row (previously just showed the target class/date), and uses `SwapStatusBadge`.

**`features/teacher/ClassesPage.tsx`:** `VisitRequestRow` → `SwapRequestRow`, gains the origin-session line to match; approve/decline buttons call the renamed teacher API functions.

**`features/teacher/ClassDetailPage.tsx`:** the "upcoming visitors" panel switches from `ClassSummary.visitRequests` to `ClassSummary.swapVisitors`, otherwise unchanged (still just target-side approved swaps for this class).

**`features/admin/TeacherDetailPage.tsx`:** `pendingVisitRequests` → `pendingSwapRequests` field read, label text updated from "visit requests" to "swap requests".

**`PupilDetailModal` attendance calendar (teacher) and the pupil/parent attendance views:** the calendar's per-day status rendering (wherever `PRESENT`/`ABSENT` badges/colors are defined — the calendar cell component) gains an `EXCUSED` case, rendered distinctly from both (e.g. a neutral/blue "Excused (swapped)" cell) so it's visually clear this isn't a plain absence. This is the only UI change to the calendar itself; no new interaction is added — `EXCUSED` is set exclusively by swap approval, never by a click in the calendar.

## Edge cases

- A pupil with no class assigned yet cannot create a swap request (400, same as today's "must be assigned to a class first").
- Origin date or target date in the past: rejected.
- Origin date not a real session (no matching `ScheduleSlot` weekday, no `VacationSession`): rejected — this includes days that used to be scheduled but no longer are, consistent with how `markAttendance` already treats unscheduled days for the *current* period.
- Target date not a real session of the target class: rejected, same logic.
- Target class same as origin class: rejected ("You're already enrolled in that class.").
- A second swap request for the same origin session while one is already `PENDING`: rejected (409). A pupil *can*, however, have multiple `PENDING` requests for *different* origin sessions simultaneously — nothing in this spec limits that.
- Approving a swap when the origin day already has an `AttendanceRecord` (e.g., teacher had already marked it ABSENT before the pupil's request was approved): the upsert overwrites it to `EXCUSED`. This is intentional — approval is the source of truth once it happens.
- Declining a swap, or cancelling a still-pending one: no attendance side effect, ever.
- A `SwapRequest` whose origin or target `Class` is later deleted: cascades away via `onDelete: Cascade`, same as `VisitRequest` did. Any `AttendanceRecord` already written by an earlier approval is untouched (it belongs to the pupil, not the request).
- Ledger present/absent tallies (`PupilLedgerRow.present`/`.absent`, `AdminAttendanceOverview`): `EXCUSED` days are counted in neither `present` nor `absent` — they're a third bucket, simply not summed by either existing counter. No new ledger column is added for it (see Non-goals).

## Non-goals

- No pupil-facing notification when a swap is approved/declined — matches the old `VisitRequest` behavior exactly; out of scope for this change.
- No automatic `AttendanceRecord` written for the *target* session — attending a swapped-into class is still marked by the teacher of that class through the normal attendance flow, same as any visitor today. This spec only writes the `EXCUSED` record on the origin side.
- No manual "mark as excused" control anywhere in the UI — `EXCUSED` is only ever set by swap approval.
- No ledger UI changes to surface `EXCUSED` as its own summary metric (e.g. no "N excused" count) — it's visible per-day in the calendar; aggregate reporting is out of scope.
- No data migration from `VisitRequest` to `SwapRequest` — existing rows are dropped, approved.
- No limit on how many `PENDING` swap requests a pupil can have open across different origin sessions.
- No changes to `vacation.service.ts` beyond reusing its existing `getVacationSessionForDate` export — vacation-day sessions are just another valid session source for both origin and target validation.

## Testing

- Server: new `swap.service.test.ts` (there was no `visit.service.test.ts` to carry over — clean slate) covering: origin/target session-date validation (schedule-matched, vacation-matched, and rejected-unscheduled cases), same-class rejection, past-date rejection, duplicate-pending-for-same-origin rejection, approve → `AttendanceRecord` upsert to `EXCUSED` (including the overwrite-existing-record case), decline → no attendance side effect, cancel → only while `PENDING`. Extend `attendance.service.test.ts` (or a calendar-focused test) to confirm a day with `status: EXCUSED` surfaces correctly through `getAttendanceCalendar`/`getOwnAttendanceCalendar`.
- Client: component test for `SwapRequestForm` (both date fields present, submit calls `createSwapRequest` with `{ originDate, targetClassId, targetDate }`), and for the calendar cell rendering covering the new `EXCUSED` case — consistent with this repo's existing light Vitest coverage per area.

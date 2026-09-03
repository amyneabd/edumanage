# Vacation Mode — Design

## Context

A teacher's weekly schedule is currently fully recurring: `ScheduleSlot` rows (`classId, dayOfWeek, startTime, endTime`) define a permanent weekly pattern per class, and every schedule/attendance surface in the app (attendance calendars, the teacher's "Upcoming sessions" widget, pupil/parent Schedule pages) derives its dates from that weekday pattern.

The client (a teacher) wants a "Vacation Mode" toggle: for a defined date window (typically ~15 days), the normal weekly pattern is set aside and replaced with a one-off, hand-picked set of sessions per class. When vacation mode ends, the normal weekly pattern resumes automatically — nothing about it should need to be re-entered.

This is a teacher-level (not per-class) toggle: activating it affects every class the teacher runs.

## Data model

Two new models; `ScheduleSlot` and all its existing consumers are untouched.

```prisma
enum VacationStatus {
  ACTIVE
  ENDED
}

model VacationPeriod {
  id        String          @id @default(cuid())
  teacherId String
  teacher   TeacherProfile  @relation(fields: [teacherId], references: [userId], onDelete: Cascade)
  startDate DateTime
  endDate   DateTime
  status    VacationStatus  @default(ACTIVE)
  createdAt DateTime        @default(now())
  sessions  VacationSession[]

  @@index([teacherId, status])
}

model VacationSession {
  id               String         @id @default(cuid())
  vacationPeriodId String
  vacationPeriod   VacationPeriod @relation(fields: [vacationPeriodId], references: [id], onDelete: Cascade)
  classId          String
  class            Class          @relation(fields: [classId], references: [id], onDelete: Cascade)
  date             DateTime
  startTime        String
  endTime          String

  @@unique([classId, date])
  @@index([vacationPeriodId])
}
```

- Only one `VacationPeriod` per teacher may have `status: ACTIVE` at a time.
- `VacationSession` is scoped to a class, not a pupil — same shape as `ScheduleSlot`, just dated instead of recurring.
- `@@unique([classId, date])` enforces at most one ad-hoc session per class per day, mirroring the one-slot-per-weekday assumption `ScheduleSlot` consumers already make, and matching `AttendanceRecord`'s `@@unique([pupilId, date])`.

**Rendering rule, used everywhere a date needs a session:** look up `VacationSession` for that class+date first. If found, use it. Otherwise fall back to the existing `ScheduleSlot` weekday-derived logic. `ScheduleSlot` rows are never read, written, or deleted as part of this feature — they're simply superseded for any date that has a matching `VacationSession`. This is what makes the normal schedule "come back automatically": there's nothing to restore.

## Backend behavior

New `vacation.service.ts` / `vacation.controller.ts` / routes mounted under the teacher router:

- `POST /teacher/vacation/start { startDate, endDate }` — creates a `VacationPeriod` with `status: ACTIVE`. Rejects (400) if the teacher already has an `ACTIVE` period. `endDate` must be `>= startDate`.
- `POST /teacher/vacation/end` — sets the current `ACTIVE` period to `ENDED` and deletes its `VacationSession` rows with `date > today` (future, now-skipped sessions). Past sessions and their `AttendanceRecord`s are untouched. No-op error (400) if no period is active.
- `GET /teacher/vacation/current` — returns the `ACTIVE` period (or `null`), so the UI knows toggle state and the date range to constrain the session builder to.
- `POST /teacher/classes/:classId/vacation-sessions { date, startTime, endTime }` — creates one ad-hoc session for that class, under the currently `ACTIVE` period. Rejects if no period is active, or if `date` falls outside `[period.startDate, period.endDate]`.
- `DELETE /teacher/classes/:classId/vacation-sessions/:id` — removes one ad-hoc session.
- `GET /teacher/classes/:classId/vacation-sessions` — lists a class's ad-hoc sessions for the active period (drives the builder UI).

**Existing service changes:**

- `attendance.service.ts` (`getAttendanceCalendar`, `getOwnAttendanceCalendar`): inside the per-day loop that currently checks `scheduledDays.has(dayOfWeek)`, check for a `VacationSession` on that class+date first; if present, use its `startTime`/`endTime` instead of the `ScheduleSlot`-derived ones. The rest of the PRESENT/ABSENT/FUTURE/TODAY/UNMARKED logic is unchanged since it already operates per-date.
- `attendance.service.ts` (`markAttendance`): currently rejects marking attendance on a date whose weekday isn't in the class's `scheduleSlots`. Add a bypass — if a `VacationSession` exists for that class+date, allow marking regardless of weekday.
- Teacher "upcoming schedule" data (`teacher.controller.ts` / wherever `ScheduleEntry` list is built): when a class has an `ACTIVE` vacation period, its upcoming entries come from that class's future `VacationSession` rows (real dates) instead of weekday-recurrence projection.
- `pupil.service.ts` / `parent.service.ts` schedule endpoints: when the pupil's class has an `ACTIVE` vacation period, return the class's `VacationSession` list (dated) instead of `scheduleSlots` (weekly). Response shape gets a `mode: "weekly" | "vacation"` discriminator so the client knows which shape it received.

## Frontend

- **Classes page (teacher):** a "Vacation Mode" toggle/banner. Off → button to start, opens a start/end date picker. On → shows the active date range and an "End vacation mode" button. No "N sessions still unscheduled" nudge (see Non-goals).
- **Class Detail page (teacher):** when a vacation period is active, a new panel lists that class's ad-hoc sessions (date + time) with add/remove controls, constrained to the active period's date range.
- **Teacher Overview "Upcoming sessions" widget:** unchanged component, just fed vacation-sourced entries (real dates, no "Today"/"Tomorrow"/weekday-offset guessing needed since dates are absolute) when applicable.
- **`PupilDetailModal` attendance calendar:** no shape change. It's already a per-date month grid; vacation days simply appear using the ad-hoc time via the updated `attendance.service` logic.
- **Pupil/Parent Schedule page:** currently a fixed Sun–Sat weekly grid built from `scheduleSlots`. When `mode: "vacation"` is returned, render a dated list instead ("Mon, Oct 5 · 14:00–15:00") for the window; reverts to the weekly grid once the period ends and `mode` goes back to `"weekly"`.

## Edge cases

- Starting a period while one is already active: rejected, must end the current one first.
- Ad-hoc session dates outside `[startDate, endDate]`: rejected.
- At most one `VacationSession` per class per day (`@@unique([classId, date])`).
- A class with zero ad-hoc sessions during an active vacation period simply has no sessions that window — no fallback to its old weekly pattern for those dates.
- Early end (`POST /teacher/vacation/end` before `endDate`): future `VacationSession` rows for the ended period are deleted; past ones and their attendance stay.
- `VisitRequest` (pupil requests to sit in on another class on a specific date) is already date-based and independent of `ScheduleSlot`/`VacationSession` — no changes needed.
- Deleting a `Class` cascades to its `VacationSession` rows via the existing `onDelete: Cascade` pattern.

## Non-goals

- No validation nudging the teacher to schedule vacation sessions for every class ("N unscheduled" warnings) — purely opt-in per class.
- No support for multiple ad-hoc sessions per class per day.
- No historical "past vacations" browsing UI — `VacationPeriod`/`VacationSession` rows persist in the database for data integrity (past attendance stays queryable), but nothing in this spec surfaces a list of past vacation periods to the teacher.
- No interaction with payment/billing logic (`PaymentRecord`, `Class.monthlyFee`) — that's covered separately by the pupil ledger spec.

## Testing

- Server: unit tests for `vacation.service` (start/end validation, single-active-period rule, ad-hoc session CRUD, date-window rejection, early-end future-session cleanup) and extended `attendance.service` tests covering the vacation-day branch in calendar generation and the `markAttendance` weekday-bypass.
- Client: component tests for the vacation toggle + date picker, the per-class ad-hoc session builder, and the pupil/parent Schedule page's grid↔list swap — consistent with this repo's existing light Vitest coverage (zod schemas, hooks, a rendered component per area).

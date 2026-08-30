# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Four roles, each with their own login and section of the app:

- **Teachers** — the primary paying users. They run their own classes/tutoring business: manage a roster of pupils, schedule, attendance, payment status, grades, and class communication. Each teacher's data (classes, pupils, payments) is scoped to them — the product is multi-tenant across many independent teachers, not built for a single school.
- **Pupils** — students enrolled in a teacher's classes. Self-register by picking a class type and entering their teacher's code; pending the teacher's approval. Check their own schedule, attendance, payment status, grades, and class feed/exams.
- **Parents** — linked to their child's pupil account (pending approval via a parent-pupil link). Read-mostly visibility mirroring the pupil's view: schedule, attendance, payments, grades, class feed.
- **Admins** — platform operators (seeded account) who approve or reject new teacher signups, gating who can onboard as a tenant.

## Product Purpose

An all-in-one class-operations tool for independent teachers/tutoring businesses. It replaces juggling several disconnected tools (a payment spreadsheet, a WhatsApp group for announcements, a paper attendance sheet, a separate gradebook) with one login per role that covers the full lifecycle of running a class: roster, schedule, attendance, payments, grades, and communication. Success means a teacher can operate their entire class business from EduManage alone, and pupils/parents can self-serve their own status without asking the teacher directly.

## Positioning

Unlike single-purpose tools (a payment tracker, a group chat, a paper roster), EduManage combines roster management, scheduling, attendance, manual payment tracking, gradebook, and class-channel communication (including exam posting/submission) under one login per role — with built-in approval gating (admin approves teachers, teachers approve pupils and parent links) so rosters stay trustworthy without manual vetting overhead outside the product.

## Operating Context

Many independent teachers sign up and wait for admin approval before operating. Once active, a teacher creates classes and shares their teacher code; pupils self-register against that code and wait for the teacher's approval before being assigned to a class (currently via drag-and-drop or a keyboard-accessible select fallback). Parents self-register and link to their child's pupil account, also pending approval. Day to day: teachers mark attendance, payment status (paid/unpaid/incomplete), and grades, and post text/file/exam content to a class feed; pupils view their status and submit exam files; parents view the same status read-mostly for their linked child(ren). Payments are tracked manually — the teacher records that a payment happened; there is no payment gateway or online transaction.

## Capabilities and Constraints

- Auth: JWT in httpOnly cookies, rate-limited login, self-service password reset via emailed link (dev-mode fallback displays the link directly), account-settings change-password flow.
- Backend: Express + Prisma ORM on SQLite (swappable to Postgres via connection string), npm-workspaces monorepo (`client` + `server`).
- File uploads (posts, exam submissions) stored on local disk, served statically — no cloud storage integration.
- Teacher surfaces: Overview, Class Management (create classes, assign pending pupils via drag-and-drop or select), Class Detail, Ledger (payment status across pupils), Gradebook, Communication/Feed (post text/file/exam to a class channel).
- Pupil surfaces: Home, Schedule, Attendance, Payments, Grades, Class Feed (view + exam submission).
- Parent surfaces: same shape as pupil surfaces, read-mostly, scoped to their linked child(ren).
- Admin surface: pending-teacher queue with approve/reject.
- Automated test coverage exists for both workspaces (Vitest): server unit + integration tests (password hashing, JWT, teacher/parent code generation, period math, auth service against the real dev DB), client unit/component tests (zod schemas, pagination hook, a rendered component).

## Brand Commitments

**EduManage** (renamed from Bachandi, 2026-08-30) is the fixed product name — appears in the UI: sign-in heading, sidebar, document title, and any future marketing surface. A full visual identity is now binding, recorded in [DESIGN.md](DESIGN.md) with source materials under `design-reference/`: Midnight Navy (`#102A56`) / Royal Blue (`#2563EB`) / Soft Emerald (`#20B26B`) on a white/Ice Blue ground, Inter typeface, Lucide line icons, soft 12–24px radii, near-shadowless cards, direction name "Calm Premium SaaS." English-primary — the source reference sheet was drafted in Arabic/RTL by the designer, but no localization is in scope from this brief. This supersedes the prior Phase 1–8 visual-overhaul tokens (Geist Sans, amber accent, zinc neutrals, still in `client/src/index.css`); those are incumbent evidence only, not the design of record going forward. The brief targets a broader "private school" narrative for marketing copy and dashboard mocks (principal/finance-officer language); per product decision this is a visual/brand-voice adoption only — it does not redefine Users/Purpose/Positioning above, which stay scoped to the real Teacher/Pupil/Parent/Admin model.

## Evidence on Hand

None. No real customer content, testimonials, case studies, or press exist yet — future work must not fabricate any. The redesign brief is explicit on this point: no invented school logos, testimonials, statistics, or unimplemented technical claims (e.g. a future marketing Security section) — ship any such slot clearly marked as a placeholder instead.

## Product Principles

1. One login covers the full lifecycle of running a class business — roster, schedule, attendance, payments, grades, and communication — so a teacher never has to leave the product to run their operation.
2. Every relationship (teacher↔pupil, parent↔pupil) is gated by an explicit approval step, not open self-service, so rosters stay trustworthy without manual vetting outside the product.
3. Multi-tenant by teacher: each teacher's classes, pupils, and payment records are scoped to them; the product must scale to many independent teachers, not just one school.
4. Manual-first where trust matters: payments are recorded, not processed — the product reflects reality (cash paid, marked by the teacher) rather than intermediating money.
5. Read-mostly parity for dependents: parents get the same visibility pupils get (schedule, attendance, payments, grades, feed) without needing to go through the teacher or the pupil.

## Accessibility & Inclusion

Core workflows must remain operable without pointer-based drag interaction. Established precedent: pupil-to-class assignment supports drag-and-drop (dnd-kit, with a keyboard sensor registered) alongside a plain `<select>` fallback per pending-pupil card, so the workflow completes without any drag gesture.

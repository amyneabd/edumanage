# Design

<!-- impeccable:design-schema 1 -->

## Status

This is the **as-shipped design record**, trued up against the built code in `client/src` after all 10 redesign tasks landed. It supersedes the pre-build spec that previously occupied this file (a redesign brief carried forward verbatim before implementation). The pre-build brief and its source materials remain useful provenance but are no longer the ground truth — where the brief and the shipped app disagree, the shipped app is recorded here.

Source materials, kept for provenance:
- [`design-reference/redesign-brief.md`](design-reference/redesign-brief.md) — original brief (54 sections)
- [`design-reference/design-system-reference.jpg`](design-reference/design-system-reference.jpg) — reference sheet the brief was drawn from (Arabic/RTL draft; EduManage ships English-primary, tokens/composition only were adopted)

Product decisions that resolved conflicts between the brief and the app (full rationale in [PRODUCT.md](PRODUCT.md)):
- **Name:** EduManage (renamed from Bachandi).
- **Language:** English-primary; no RTL work shipped.
- **Roles/scope:** visual system only — Teacher/Pupil/Parent/Admin stayed exactly as implemented; no marketing site was built (app is auth + role dashboards only).

## Design Direction

**Name:** Calm Premium SaaS — Stripe-level simplicity + Linear-level polish, restrained color, near-shadowless surfaces, one accent (Royal Blue) for interaction and one accent (Soft Emerald) reserved for success/positive states.

**Priorities, in order, when two goals conflict:** ease of use over beauty; clarity over feature count; performance over animation. This shows up directly in the build: no marketing-site motion work, no illustration, no photography — every surface is real dashboard UI.

## Color System (as shipped, `client/src/index.css` `@theme` block)

| Token | Hex | Usage as shipped |
|---|---|---|
| `--color-canvas` | `#f4f8fc` | Page/body background (Ice Blue), disabled input fill, empty-state fill |
| `--color-surface` | `#ffffff` | Cards, inputs, modals, navbar |
| `--color-border` | `#e5eaf0` | Default hairline borders, dividers |
| `--color-border-strong` | `#cbd5e1` | Input borders, dashed empty-state borders, spinner ring |
| `--color-ink-900` | `#172033` | Primary text (body copy on `body`) |
| `--color-ink-700` | `#667085` | Secondary text — **note:** `ink-500` is set to the identical `#667085`; the two tokens are not visually distinct in this build, `ink-700` is the one actually used for secondary text/labels |
| `--color-ink-500` | `#667085` | Alias of `ink-700` (see above) — present in the theme but not meaningfully differentiated in usage |
| `--color-ink-400` | `#98a2b3` | Muted text, placeholders, disabled text |
| `--color-navy` | `#102a56` | Sidebar background, brand mark |
| `--color-navy-700` | `#1b3a6b` | Navy hover/active shade |
| `--color-navy-800` | `#16305c` | Navy pressed/deepest shade |
| `--color-accent-50` | `#eff4fe` | Royal Blue tint background |
| `--color-accent-100` | `#dce7fd` | Royal Blue tint, stronger |
| `--color-accent-600` | `#2563eb` | Royal Blue — links, active nav state, focus ring, primary interactive color |
| `--color-accent-700` | `#1d4ed8` | Royal Blue hover/pressed shade |
| `--color-success-50` | `#e6f7ee` | Success chip background (Soft Emerald tint) |
| `--color-success-600` | `#20b26b` | Soft Emerald — success text/icons, PAID chips, present-attendance, primary CTA fill |
| `--color-success-700` | `#189659` | Soft Emerald hover/pressed shade |
| `--color-warning-50` | `#fffbeb` | Warning tint (lightest, sparingly used) |
| `--color-warning-100` | `#fef3c7` | Warning chip background — PENDING/INCOMPLETE status chips |
| `--color-warning-600` | `#d97706` | Amber — general warning accents (icons, non-chip warning text) |
| `--color-warning-700` | `#b45309` | Amber, darker — **chip text tier**, see two-tier rule below |
| `--color-danger-50` | `#fef2f2` | Danger chip/alert background |
| `--color-danger-600` | `#dc2626` | Red — danger text/icons, UNPAID/DECLINED chips, error borders |
| `--color-danger-700` | `#b91c1c` | Red hover/pressed shade |

**Radius:** `--radius-sm: 12px` (buttons, inputs, chips, table cells), `--radius-lg: 20px` (cards), `--radius-xl: 24px` (large containers/modals). No smaller/larger radius values are used anywhere in the app — this is the full ramp.

**Shadow:** one token, `--shadow-elevated: 0 8px 30px rgba(16, 42, 86, 0.06)`. Cards and surfaces otherwise rely on a 1px `border-border` rather than a shadow — confirmed still true in the shipped components (cards use border + optional `shadow-elevated`, never a heavier shadow).

**Ratio:** navy is confined to the sidebar/brand; the vast majority of every screen is white/canvas; accent-600 (blue) carries interaction; success-600 (green) is reserved for positive/paid/present states and the primary CTA — never used as a general accent. This restraint held through the build; no screen uses green decoratively.

## Typography

**Font:** Inter, declared as `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif` in `index.css`, applied via Tailwind's default sans stack (no separate display face was introduced — confirmed no second font family exists anywhere in the shipped CSS).

Type ramp as actually used across pages (Tailwind utility classes observed in components, not a separate CSS type-scale — the app uses Tailwind's default `text-*` steps directly):
- Page/section headings: `text-lg`–`text-2xl`, `font-semibold`
- Card headings / KPI labels: `text-sm font-medium` label + a large `text-2xl`/`text-3xl font-semibold` number (stat-card pattern)
- Body: `text-sm` is the dominant body size in the dashboard (the brief's 16–18px body did not carry over — the shipped app is a dense data product, not a marketing page, and settled on `text-sm`/`text-xs` for tables, chips, and most copy)
- Captions / chip text: `text-xs font-medium`

This is a deliberate divergence from the pre-build spec's marketing-oriented type ramp (32–56px hero, 16–18px body): the shipped surfaces are all dashboard/table-dense, so the type ramp that actually exists is smaller and denser throughout. Recorded as the real ramp, not the brief's.

## Icons

**Set:** Lucide (`lucide-react`), line style only, confirmed as the only icon set imported anywhere in `client/src`.

**Stroke width:** `strokeWidth={1.8}` is the single, universal value — confirmed by grep across every icon usage in the codebase (`AppLayout`, all feature pages, `Modal`, `NotificationBell`, badges/cards). No other stroke-width value appears anywhere.

**Sizing convention:** `h-4 w-4` (16px) for inline/button icons, `h-[18px] w-[18px]` for stat-card icons, `h-3.5 w-3.5`/`h-3 w-3` for small inline chip icons (file-type markers, chevrons in compact rows), `h-5 w-5` for nav-level icons (menu, bell).

**Concept-to-icon mapping, confirmed via `App.tsx` nav config and feature-page imports:**
| Concept | Icon |
|---|---|
| Overview/Home (dashboard root) | `LayoutDashboard` |
| Class Management / roster | `Users2` |
| Schedule | `CalendarDays` |
| Attendance | `ClipboardCheck` |
| Payments / Ledger / Wallet-style stats | `Wallet` |
| Grades / Gradebook | `GraduationCap` |
| Communication / Feed | `MessageSquare` |
| Admin (Teachers queue) | `UserCog` |
| Present / success confirmation | `CheckCircle2` |
| Absent / failure | `XCircle` |
| Pending / awaiting | `Hourglass` |
| Overdue / risk | `AlertTriangle` |
| Average/aggregate stat | `Sigma` |
| Exam/assignment content | `ClipboardList` |
| File attachment | `Paperclip`, `FileText` |
| Pagination | `ChevronLeft` / `ChevronRight` |
| Stepper / toggle controls | `Check`, `Minus`, `Plus`, `X` |
| Notifications bell | `Bell` |
| Sidebar collapse/open (mobile) | `Menu`, `X` |
| Back navigation | `ArrowLeft` |
| Sort indicators | `ChevronUp`, `ChevronDown` |
| Notification-type icons (`lib/notificationMeta.ts`) | `UserPlus`, `FileText`, `CreditCard`, `Trophy`, `CalendarClock`, `Users` |

No 3D, flat-fill, emoji, or mixed icon styles found anywhere in the build — the single-line-set rule held.

## Components (as shipped)

- **Badge system** (`components/Badge.tsx`) — four badge families, each a `Record<Enum, string>` color map rendering `inline-flex rounded-sm px-2.5 py-1 text-xs font-medium`:
  - `PaymentBadge` (`PaymentStatus`): `PAID` → `bg-success-50 text-success-600`; `UNPAID` → `bg-danger-50 text-danger-600`; `INCOMPLETE` → `bg-warning-100 text-warning-700`.
  - `StatusBadge` (`UserStatus`): `PENDING` → `bg-warning-100 text-warning-700`; `ACTIVE` → `bg-success-50 text-success-600`; `REJECTED` → `bg-canvas text-ink-700 border border-border`.
  - `VisitStatusBadge` (`VisitRequestStatus`): `PENDING` → `bg-warning-100 text-warning-700`; `APPROVED` → `bg-success-50 text-success-600`; `DECLINED` → `bg-danger-50 text-danger-600`.
  - `ClassTypeBadge` (`ClassType`): all four values share one neutral style, `bg-canvas text-ink-700 border border-border` — class type is informational, not status, so it never takes a semantic color.

  **Two-tier warning rule (confirmed intentional, not an inconsistency):** every `-100`-background warning chip (`PENDING`, `INCOMPLETE`) pairs with `text-warning-700`, not `text-warning-600` — `-700` is reserved for text laid directly on a `-100` fill, where it clears contrast; `-600` is reserved for warning icons/accents on `surface`/`canvas` backgrounds (e.g. `AlertTriangle` in overdue-ledger and payments KPI cards) where the lighter tone reads fine. This pairing is consistent everywhere warning color appears — record it as the house rule, not a bug.

- **Attendance status is binary** — `AttendanceStatus` in `client/src/api/types.ts` is `"PRESENT" | "ABSENT"` only; there is no third "late" state in the data model. Both Pupil and Parent attendance pages map `PRESENT` → `success-600`/`CheckCircle2` and `ABSENT` → `danger-600`/`XCircle`, identically. (`AttendanceDisplay`, a separate calendar-cell type, adds `FUTURE`/`TODAY`/`UNMARKED` for calendar rendering only — these are display states, not attendance outcomes, and don't carry a third semantic color.)

- **`Input` component** (`components/Input.tsx`) — a `forwardRef` wrapper around `<input>`: `mt-1 w-full rounded-sm border bg-surface px-3 py-3 text-sm`, `invalid` prop swaps border to `border-danger-600` (default `border-border-strong`), disabled state is flat (`disabled:bg-canvas disabled:text-ink-400`, never just lower opacity). Used in auth flows (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`), `SettingsPage`, and one teacher form (`ClassesPage`) — i.e. block-level, one-field-per-line forms.
  **Deliberately not used:** inline/compact editors — the per-pupil payment-status `<select>` and per-slot schedule-time `<select>`s in `LedgerPage`/`ClassDetailPage` use native `<select>` with a compact inline class (`rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs`, no `mt-1`/block sizing), because `Input`'s block-level layout (full-width, `py-3`, top-margin) doesn't fit a table cell or an inline row. Same for the raw `<input type="file">` in `FeedPage`'s exam-submission control — file inputs aren't styled through the shared component. This is a real, confirmed structural pattern, not an oversight.

- **`EmptyState` / `ErrorState` / `Spinner`** (`components/Feedback.tsx`, not a separate `EmptyState.tsx`) —
  - `EmptyState`: `rounded-lg border border-dashed border-border-strong bg-canvas p-8 text-center`, a `font-medium text-ink-700` title, optional `text-sm text-ink-500` description, optional `Button size="sm"` primary action. Matches the brief's pattern (headline + supporting line + one action) and is reused across every list/table page.
  - `ErrorState`: `role="alert"`, `border-danger-600/20 bg-danger-50 text-danger-600`, message + optional underlined `Retry` button — human copy, no raw technical error ever surfaced (confirmed no `error.message`/stack text passed directly to this component in any feature page reviewed).
  - `Spinner`: a single spinning-ring div (`border-2 border-border-strong border-t-success-600`) — confirms the brief's "skeleton over spinner" preference did **not** fully ship; the shipped loading primitive is a spinner, not skeleton screens. Recorded as the real pattern; skeleton loading is not implemented anywhere in `client/src`.

- **Focus ring** — one shared utility, `.focus-ring` (`outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2 focus-visible:ring-offset-surface`), applied consistently to every interactive element (buttons, inputs, selects, icon-buttons, links) — this is the app's entire focus-visibility system, confirmed as the only focus-ring implementation in the CSS.

- **Reduced motion** — `index.css` scopes `prefers-reduced-motion: reduce` narrowly to `.transition-transform` (the off-canvas mobile sidebar), leaving color/opacity hover/focus transitions untouched elsewhere. This is a deliberate, evidenced choice (commented in the source), not an incomplete a11y pass.

## Layout (as shipped)

- **Shell:** `AppLayout` — Navy sidebar with nav items (icon + label, `Menu`/`X` for mobile off-canvas toggle), white topbar with `NotificationBell` (teacher role only, gated by the `notifications` prop on the route's `AppLayout`), canvas/white main content.
- **Role-scoped nav sets**, defined once in `App.tsx`: Admin (Teachers only), Teacher (Overview, Class Management, Ledger, Gradebook, Communication), Pupil/Parent (Home, Schedule, Attendance, Payments, Grades, Class Feed) — Pupil and Parent share an identical nav shape and icon set, differing only in data scope, matching PRODUCT.md's "read-mostly parity for dependents" principle.
- **Stat-card pattern**: an `icon` prop (Lucide icon at `h-[18px] w-[18px]`, `strokeWidth={1.8}`) + label + large number, repeated identically across every Overview/Home/Ledger/Gradebook/Attendance page — this is the one KPI-card shape used everywhere, not a per-page bespoke card.
- **Pagination**: `ChevronLeft`/`ChevronRight` icon-only buttons, `h-4 w-4`, consistent across `LedgerPage`, `AttendancePage` (pupil + parent), `GoalsPanel`, `PupilDetailModal`.

## Not Canonized

The pre-build brief's marketing-site spec (hero, trust strip, feature sections, pricing, testimonials, etc.) was never built — no marketing surface exists in `client/src`. It is not carried forward into this record as a shipped system; it remains only as forward-looking provenance in the brief file itself, not as a DESIGN.md rule. Likewise, "skeleton loading" from the brief did not ship (the app uses a spinner) and is recorded above as the real, current pattern rather than defended as still-planned.

## Accessibility

Confirmed still true in the build: a single shared `.focus-ring` utility on every interactive element, `aria-hidden="true"` on all decorative icons, `role="alert"` on `ErrorState`, status never conveyed by color alone (every badge/attendance state pairs a color with text or an icon). Additive to PRODUCT.md's keyboard-operable pupil-assignment fallback (drag-and-drop plus a native `<select>` per pending-pupil card) — unaffected by the visual redesign.

## Responsive

Mobile sidebar is off-canvas via `.transition-transform` on `AppLayout`, toggled by `Menu`/`X`. No separate breakpoint-specific type scale or component variants were found beyond Tailwind's default responsive utilities used ad hoc per page — the brief's explicit four-breakpoint verification matrix (1440/1280/768/375–430) is not independently evidenced as a systemized rule in the code; it reads as standard Tailwind responsive classes rather than a named system, so it is not re-asserted here as a confirmed named rule beyond "the layout is responsive via Tailwind breakpoints."

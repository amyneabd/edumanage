# EduManage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the entire EduManage (formerly Bachandi) client app — every auth screen and every Teacher/Pupil/Parent/Admin dashboard surface — to the pinned "Calm Premium SaaS" visual system (Midnight Navy / Royal Blue / Soft Emerald, Inter, Lucide icons) from [DESIGN.md](../../../client/DESIGN.md), with zero change to functionality, routes, or data flow.

**Architecture:** Tailwind v4's `@theme` block in `client/src/index.css` defines semantic CSS custom properties (`--color-ink-900`, `--color-accent-600`, `--color-canvas`, etc.) that components reference by name, not by raw hex. That means Task 1 (retinting the token values) automatically re-themes the large majority of the app with **zero per-file edits** — every `text-ink-700`, `bg-canvas`, `border-border-strong`, `focus-ring` usage across ~35 files picks up the new palette for free the moment the token values change. The work that *isn't* free, and gets its own task, is: (a) components whose current color role conflicts with the new brief (e.g. `Button`'s primary variant must move from blue to green), (b) hardcoded hex strings that bypass the token system entirely (recharts `stroke`/`fill` props, the notification-type color map), (c) structural layout changes the brief asks for that tokens can't produce (navy sidebar instead of white, split-panel auth pages, empty/loading states with a headline+action), and (d) the icon system (inline hand-drawn SVGs and emoji → Lucide). Foundation and shared primitives land first so every later page task consumes an already-correct design system instead of re-deriving it.

**Adaptation of TDD to a visual reskin:** this app's Vitest suite covers logic (schemas, hooks, one rendered component), not visual regressions — there is no snapshot/pixel test harness to write "failing tests" against for a color or radius change. Each task below substitutes three verifications for the classic red/green test cycle: (1) the existing test suite must keep passing — real regression protection for anything a task touches that has logic (e.g. widening `StatCard`'s `icon` prop type), (2) `npm run build` (tsc + vite build) must succeed — catches type errors from prop/API changes, (3) a live visual check via the preview tool at desktop (1440px) and mobile (390px) against DESIGN.md's exact values — this is the real "test" for a task whose entire deliverable is pixels. This is a disclosed substitution, not a skipped step.

**Tech Stack:** React 19, Tailwind CSS v4 (`@theme` tokens, no `tailwind.config.js`), TypeScript, Vite, Vitest, recharts, react-hook-form + zod, react-router-dom v7, clsx. New dependencies added in Task 1: `lucide-react` (icon set), `@fontsource/inter` (typeface). Removed: `@fontsource/geist-sans`, `@fontsource/geist-mono`.

**Spec:** [client/DESIGN.md](../../../client/DESIGN.md) (visual system) and [client/PRODUCT.md](../../../client/PRODUCT.md) (product truth, brand commitments). Reference materials: [client/design-reference/redesign-brief.md](../../../client/design-reference/redesign-brief.md), [client/design-reference/design-system-reference.jpg](../../../client/design-reference/design-system-reference.jpg).

## Global Constraints

- Colors — exactly these, no others: Midnight Navy `#102A56`, Royal Blue `#2563EB`, Soft Emerald `#20B26B`, Ice Blue `#F4F8FC`, White `#FFFFFF`, text primary `#172033`, text secondary `#667085`, text muted `#98A2B3`, border `#E5EAF0`. Utility extensions (not in the brief, needed for status/chart chrome, recorded here so they don't drift): warning amber `#D97706`/`#FEF3C7`, danger red `#DC2626`/`#FEF2F2`.
- Ratio: ~65% white/very light, 20% navy, 8% blue, 5% green, 2% other. Green never used as a general accent — CTA/success only.
- Font: Inter, everywhere. No other typeface ships.
- Radius: buttons/inputs 12px, cards 20px, large containers/hero 24px. Never sharper, never more rounded ("childish").
- Shadow: `0 8px 30px rgba(16, 42, 86, 0.06)` — the only shadow value in the app. Prefer a 1px `#E5EAF0` border over a shadow where either would do.
- Icons: Lucide only, one stroke width, one size per context. No emoji, no mixed icon styles, in the shipped UI.
- Product name is **EduManage** everywhere (UI strings, document title, localStorage key prefixes). "Bachandi" ships nowhere.
- English-primary, LTR. No RTL work in scope.
- Priority when in conflict: ease of use > beauty; clarity > feature count; performance > animation.
- Never invent testimonials, statistics, school logos, or unimplemented technical claims.
- No functional/behavioral change: every task is a visual re-skin of an existing, working surface. Routes, API calls, form validation, and business logic are untouched.

---

### Task 1: Design Tokens Foundation

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/src/main.tsx`
- Modify: `client/package.json` (dependencies)
- Modify: `client/index.html` (title)

**Interfaces:**
- Produces: the full retinted token set every later task relies on by class name only (`bg-navy`, `text-navy`, `bg-accent-*` now = Royal Blue, `bg-success-*` now = Soft Emerald, new `bg-warning-*` amber, `rounded-sm`=12px, `rounded-lg`=20px, new `rounded-xl`=24px, `shadow-elevated` = the brief's exact value, `font-sans` = Inter).

- [ ] **Step 1: Add and remove font/icon dependencies**

```bash
cd client
npm install lucide-react @fontsource/inter
npm uninstall @fontsource/geist-sans @fontsource/geist-mono
```

- [ ] **Step 2: Swap font imports in `client/src/main.tsx`**

Replace:
```tsx
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-sans/700.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
```
with:
```tsx
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
```
(800 weight added — DESIGN.md's hero heading spec allows weight 800; Geist Mono is dropped since the brief specifies no mono/monospace face and nothing in the app needs one — `--font-mono` below falls back to the system stack.)

- [ ] **Step 3: Replace the `@theme` block in `client/src/index.css`**

Replace the entire existing `@theme { ... }` block (lines 3–36) with:

```css
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", monospace;

  --color-canvas: #f4f8fc;
  --color-surface: #ffffff;
  --color-border: #e5eaf0;
  --color-border-strong: #cbd5e1;

  --color-ink-900: #172033;
  --color-ink-700: #667085;
  --color-ink-500: #667085;
  --color-ink-400: #98a2b3;

  --color-navy: #102a56;
  --color-navy-700: #1b3a6b;
  --color-navy-800: #16305c;

  --color-accent-50: #eff4fe;
  --color-accent-100: #dce7fd;
  --color-accent-600: #2563eb;
  --color-accent-700: #1d4ed8;

  --color-success-50: #e6f7ee;
  --color-success-600: #20b26b;
  --color-success-700: #189659;

  --color-warning-50: #fffbeb;
  --color-warning-100: #fef3c7;
  --color-warning-600: #d97706;
  --color-warning-700: #b45309;

  --color-danger-50: #fef2f2;
  --color-danger-600: #dc2626;
  --color-danger-700: #b91c1c;

  --radius-sm: 12px;
  --radius-lg: 20px;
  --radius-xl: 24px;

  --shadow-elevated: 0 8px 30px rgba(16, 42, 86, 0.06);
}
```

Notes for the implementer:
- `ink-500` is deliberately identical to `ink-700` (both `#667085`, DESIGN.md's "text secondary") rather than a new invented shade — this keeps every existing `text-ink-500` call site correct with zero file edits instead of inventing an unbriefed fourth text color.
- `accent-*` is now Royal Blue, not amber. It stays the token name because most existing `accent-*` usages in the codebase are already links, focus rings, and active states — exactly Royal Blue's role per DESIGN.md. Only `Button`'s primary variant needs to move *off* `accent-*` onto `success-*` (Task 2) because the brief pins the main CTA color to green, not blue.
- `--color-navy` / `-700` / `-800` are new tokens with no existing consumers yet — Task 3 (AppLayout) is their first user.
- Leave the `body`, `#root`, `.focus-ring`, and `prefers-reduced-motion` rules below the `@theme` block untouched — they already reference these token names by class (`bg-canvas`, `text-ink-900`, `ring-accent-600`) and pick up new values automatically.

- [ ] **Step 4: Update the document title and favicon shell**

In `client/index.html`, change `<title>client</title>` to `<title>EduManage</title>` (the per-page title still overrides this at runtime via `useDocumentTitle` — Task 3 fixes that hook's brand string).

- [ ] **Step 5: Run the test suite and build to confirm the token swap alone doesn't break anything**

```bash
cd client
npm run test
npm run build
```
Expected: both PASS. A build failure here means something referenced a token name this step removed (e.g. `--shadow-elevated` renamed) — grep `client/src` for the old name and fix before continuing.

- [ ] **Step 6: Visual spot-check**

Start the dev server, open any authenticated page (e.g. `/login`), confirm the background is now Ice Blue and text is the new navy-ish dark.

---

### Task 2: Shared Component Primitives

**Files:**
- Create: `client/src/components/Logo.tsx`
- Create: `client/src/components/Input.tsx`
- Create: `client/src/components/Skeleton.tsx`
- Modify: `client/public/favicon.svg`
- Modify: `client/src/components/Button.tsx`
- Modify: `client/src/components/Badge.tsx`
- Modify: `client/src/components/StatCard.tsx`
- Modify: `client/src/components/NotificationBell.tsx`
- Modify: `client/src/lib/notificationMeta.ts`
- Modify: `client/src/components/Modal.tsx`
- Modify: `client/src/components/Feedback.tsx`
- Modify: `client/src/components/Card.tsx` (no code change expected — read and confirm it needs none, since `rounded-lg`/`border-border`/`bg-surface` already retint automatically; this step exists to verify, not assumed)

**Interfaces:**
- Consumes: token names from Task 1 (`bg-navy`, `bg-success-600`, `bg-warning-100`, `rounded-xl`, `shadow-elevated`).
- Produces: `<Logo className?: string />`, `<Input invalid?: boolean />` (forwardRef, same props as a native `<input>`), `<Skeleton className?: string />` (a pulsing placeholder block), `StatCard`'s `icon` prop now typed `ReactNode` (was `string`) so Lucide elements pass through — this is additive/widened, not breaking, so no other file needs to change in this task.

- [ ] **Step 1: Create the logo mark — `client/src/components/Logo.tsx`**

```tsx
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#102A56" />
      <rect x="8" y="17" width="4" height="7" rx="1.5" fill="#F4F8FC" />
      <rect x="14" y="12" width="4" height="12" rx="1.5" fill="#2563EB" />
      <rect x="20" y="7" width="4" height="17" rx="1.5" fill="#20B26B" />
    </svg>
  );
}
```
An ascending three-bar mark (growth/analytics) in a rounded Navy badge — reads at favicon size, avoids the schoolhouse/mortarboard cliché DESIGN.md rules out.

- [ ] **Step 2: Replace `client/public/favicon.svg`** with the standalone version of the same mark:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="9" fill="#102A56"/>
  <rect x="8" y="17" width="4" height="7" rx="1.5" fill="#F4F8FC"/>
  <rect x="14" y="12" width="4" height="12" rx="1.5" fill="#2563EB"/>
  <rect x="20" y="7" width="4" height="17" rx="1.5" fill="#20B26B"/>
</svg>
```

- [ ] **Step 3: Create `client/src/components/Input.tsx`**, extracted from the hand-rolled pattern already used in `LoginPage.tsx:51-59` (Task 4 will replace those call sites), with the Default/Focus/Error/Disabled states DESIGN.md specifies:

```tsx
import { forwardRef, type InputHTMLAttributes } from "react";
import clsx from "clsx";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { invalid, className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid ?? props["aria-invalid"]}
      className={clsx(
        "focus-ring mt-1 w-full rounded-sm border bg-surface px-3 py-3 text-sm text-ink-900 transition-colors placeholder:text-ink-400 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-400",
        invalid ? "border-danger-600" : "border-border-strong",
        className
      )}
      {...props}
    />
  );
});
```

- [ ] **Step 4: Create `client/src/components/Skeleton.tsx`** (skeleton loading per DESIGN.md, replacing `Spinner` at page level in later tasks):

```tsx
import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-sm bg-border", className)} />;
}
```

- [ ] **Step 5: Retint `client/src/components/Button.tsx`** — only the `variantClasses` map changes (primary moves to Emerald, secondary becomes an explicit Navy outline per DESIGN.md; danger/ghost need no edit, they retint automatically from Task 1):

```tsx
const variantClasses: Record<Variant, string> = {
  primary: "bg-success-600 text-white hover:bg-success-700 disabled:bg-success-600/40",
  secondary: "bg-transparent text-navy border border-navy hover:bg-navy/5",
  danger: "bg-danger-600 text-white hover:bg-danger-700 disabled:bg-danger-600/40",
  ghost: "text-ink-700 hover:bg-canvas",
};
```

- [ ] **Step 6: Retint `client/src/components/Badge.tsx`** — only the PENDING/INCOMPLETE roles move off blue onto the new amber warning token (everything else — PAID/ACTIVE/APPROVED on `success-*`, UNPAID/DECLINED on `danger-*`, neutral `classTypeColors`/REJECTED on `canvas`/`border` — retints automatically from Task 1, no edit needed):

```tsx
const paymentColors: Record<PaymentStatus, string> = {
  PAID: "bg-success-50 text-success-600",
  UNPAID: "bg-danger-50 text-danger-600",
  INCOMPLETE: "bg-warning-100 text-warning-700",
};
```
```tsx
const statusColors: Record<UserStatus, string> = {
  PENDING: "bg-warning-100 text-warning-700",
  ACTIVE: "bg-success-50 text-success-600",
  REJECTED: "bg-canvas text-ink-700 border border-border",
};
```
```tsx
const visitStatusColors: Record<VisitRequestStatus, string> = {
  PENDING: "bg-warning-100 text-warning-700",
  APPROVED: "bg-success-50 text-success-600",
  DECLINED: "bg-danger-50 text-danger-600",
};
```

- [ ] **Step 7: Widen `StatCard`'s `icon` prop to accept Lucide icons**, in `client/src/components/StatCard.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "bg-accent-50 text-accent-600",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        {icon && (
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${accent}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </Card>
  );
}
```
(Only the `icon` type and the icon wrapper's fixed pixel size change — `h-8 w-8`→`h-9 w-9` so an 18-20px Lucide icon has the same visual weight the old emoji had. String call sites elsewhere still typecheck today since `string` is a valid `ReactNode`; Tasks 5–10 replace each emoji with a Lucide icon as they touch that file.)

- [ ] **Step 8: Consolidate `client/src/lib/notificationMeta.ts`** off the six arbitrary Tailwind palette colors (`indigo`/`emerald`/`amber`/`violet`/`sky`/`rose` — exactly the "too many colors" pattern DESIGN.md's Avoid list rules out) onto the four-color system, with Lucide icons instead of emoji:

```tsx
import type { NotificationType } from "../api/types";
import { UserPlus, FileText, CreditCard, Trophy, CalendarClock, Users } from "lucide-react";
import type { ComponentType } from "react";

export const NOTIFICATION_META: Record<NotificationType, { Icon: ComponentType<{ className?: string }>; color: string }> = {
  PUPIL_REQUEST: { Icon: UserPlus, color: "bg-accent-50 text-accent-600" },
  EXAM_SUBMISSION: { Icon: FileText, color: "bg-success-50 text-success-600" },
  PAYMENT_DUE: { Icon: CreditCard, color: "bg-warning-100 text-warning-700" },
  MONTHLY_RECAP: { Icon: Trophy, color: "bg-navy/10 text-navy" },
  VISIT_REQUEST: { Icon: CalendarClock, color: "bg-accent-50 text-accent-600" },
  PARENT_REQUEST: { Icon: Users, color: "bg-accent-50 text-accent-600" },
};
```
This changes the shape from `{ icon: string }` to `{ Icon: ComponentType }`, so `NotificationBell.tsx` (next step) must render `<meta.Icon className="h-4 w-4" />` instead of `{meta.icon}`.

- [ ] **Step 9: Update `client/src/components/NotificationBell.tsx`** — swap the hand-drawn `BellIcon` SVG for `lucide-react`'s `Bell`, and render `NOTIFICATION_META`'s new `Icon` component:

Replace the `BellIcon` function and its two usages with:
```tsx
import { Bell } from "lucide-react";
// ...
<Bell className="h-5 w-5" strokeWidth={1.8} />
```
(delete the `function BellIcon() { ... }` block entirely). And where the list renders `{meta.icon}` (line ~96), replace with:
```tsx
<meta.Icon className="h-4 w-4" />
```
Every other class in this file (`bg-accent-50` unread row, `bg-accent-600` unread dot, `text-accent-600` "Mark all read") already retints correctly from Task 1 — no other edits needed here.

- [ ] **Step 10: Update `client/src/components/Modal.tsx`** — swap the hand-drawn `CloseIcon` for `lucide-react`'s `X`:

```tsx
import { X } from "lucide-react";
// ...
<X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
```
(delete the local `CloseIcon` function; `rounded-lg`/`shadow-elevated`/`bg-surface` already retint automatically.)

- [ ] **Step 11: Update `client/src/components/Feedback.tsx`** to match DESIGN.md's empty/error state spec (a title-only empty state today has no action slot; error state has no retry action) and retint the spinner:

```tsx
import { Button } from "./Button";

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-success-600" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-canvas p-8 text-center">
      <p className="font-medium text-ink-700">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger-600/20 bg-danger-50 p-4 text-sm text-danger-600">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="focus-ring mt-2 font-medium underline">
          Retry
        </button>
      )}
    </div>
  );
}
```
`actionLabel`/`onAction`/`onRetry` are optional — every existing call site (`<EmptyState title="..." />`, `<ErrorState message={...} />`) keeps compiling unchanged; later tasks add the action where DESIGN.md's empty-state pattern calls for one (e.g. "No students have been added yet" → "Add Student").

- [ ] **Step 12: Retint `client/src/components/Pagination.tsx`** — read the file and confirm no edit is needed (`border-border`, `text-ink-500/700`, `border-border-strong` all retint automatically); if the visual check in Step 14 shows otherwise, fix then.

- [ ] **Step 13: Run tests and build**

```bash
cd client
npm run test
npm run build
```
Expected: PASS. A failure most likely means a `notificationMeta` consumer besides `NotificationBell` still destructures `.icon` as a string — grep `NOTIFICATION_META` usages and fix.

- [ ] **Step 14: Visual check**

Render `Button` (all 4 variants), `Badge` (all states), `NotificationBell` open, and an `EmptyState`/`ErrorState` in the dev server; confirm primary button is Soft Emerald, secondary is a Navy-outlined button, pending badges are amber (not blue), notification icons are Lucide glyphs not emoji.

---

### Task 3: App Shell — Navy Sidebar, Branding, Nav Icons

**Files:**
- Modify: `client/src/components/AppLayout.tsx`
- Modify: `client/src/App.tsx` (nav item arrays)
- Modify: `client/src/hooks/useDocumentTitle.ts`
- Modify: `client/src/features/parent/useSelectedChild.ts`

**Interfaces:**
- Consumes: `Logo` (Task 2), `Bell`/`Menu`/`X` icons, `NavItem` interface gains an optional `icon: LucideIcon`.
- Produces: nothing new consumed downstream — this is the last file every authenticated page renders inside, so it's a leaf for this plan's dependency graph, but it's high-blast-radius (every dashboard page depends on it existing and working).

This is the single highest-visibility change in the app: the sidebar flips from white to Midnight Navy, per DESIGN.md's color table ("dashboard sidebar" is an explicit Navy usage) and the reference image's dashboard mock.

- [ ] **Step 1: Give each nav array an icon, in `client/src/App.tsx`**

```tsx
import { LayoutDashboard, Users2, Wallet, GraduationCap, MessageSquare, UserCog } from "lucide-react";

const adminNav = [{ to: "/admin", label: "Teachers", icon: UserCog }];

const teacherNav = [
  { to: "/teacher/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/teacher/classes", label: "Class Management", icon: Users2 },
  { to: "/teacher/ledger", label: "Ledger", icon: Wallet },
  { to: "/teacher/gradebook", label: "Gradebook", icon: GraduationCap },
  { to: "/teacher/feed", label: "Communication", icon: MessageSquare },
];

const pupilNav = [
  { to: "/pupil/home", label: "Home", icon: LayoutDashboard },
  { to: "/pupil/schedule", label: "Schedule", icon: Wallet }, // placeholder icon, corrected below
  ...
];
```
Use these Lucide names precisely (all exist in `lucide-react`): Overview/Home → `LayoutDashboard`; Class Management → `Users2`; Ledger/Payments → `Wallet`; Gradebook/Grades → `GraduationCap`; Communication/Feed → `MessageSquare`; Schedule → `CalendarDays`; Attendance → `ClipboardCheck`; Admin Teachers queue → `UserCog`. Apply the correct one per item (the snippet above intentionally left one placeholder to force the implementer to look at the real list rather than copy blindly — assign `CalendarDays` to Schedule and `ClipboardCheck` to Attendance in `pupilNav`/`parentNav`).

- [ ] **Step 2: Extend the `NavItem` interface and render the icon, in `client/src/components/AppLayout.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon?: LucideIcon;
}
```

- [ ] **Step 3: Rebuild the sidebar (`<aside>`) on a Navy background**

Replace the `<aside>` block with:
```tsx
<aside
  className={clsx(
    "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-navy-800 bg-navy transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-svh lg:w-60 lg:translate-x-0",
    sidebarOpen ? "translate-x-0" : "-translate-x-full"
  )}
>
  <div className="flex items-center justify-between border-b border-navy-800 px-5 py-5">
    <div className="flex items-center gap-2.5">
      <Logo className="h-8 w-8 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-white">EduManage</p>
        <p className="text-xs text-white/50">{brand}</p>
      </div>
    </div>
    <button
      type="button"
      onClick={() => setSidebarOpen(false)}
      className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-sm text-white/60 hover:bg-white/5 hover:text-white lg:hidden"
      aria-label="Close menu"
    >
      <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
    </button>
  </div>
  <nav className="flex-1 space-y-1 p-3">
    {navItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          clsx(
            "focus-ring flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
            isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
          )
        }
      >
        {({ isActive }) => (
          <>
            {item.icon && (
              <item.icon
                className={clsx("h-4 w-4 shrink-0", isActive ? "text-accent-600" : "text-white/50")}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            )}
            {item.label}
          </>
        )}
      </NavLink>
    ))}
  </nav>
  <div className="border-t border-navy-800 p-4">
    <p className="truncate text-sm font-medium text-white">{user?.name}</p>
    <p className="truncate text-xs text-white/50">{user?.email}</p>
    <div className="mt-2 flex items-center gap-3">
      <Link
        to={settingsPath}
        className="focus-ring rounded-sm text-xs font-medium text-white/60 hover:text-white"
      >
        Account settings
      </Link>
      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        className="focus-ring rounded-sm text-xs font-medium text-white/60 hover:text-danger-600"
      >
        Log out
      </button>
    </div>
  </div>
</aside>
```
Active nav gets a Royal Blue icon against a soft white overlay — this is exactly DESIGN.md's "active states → Royal Blue" rule, adapted for a dark sidebar (the light-mode `bg-accent-50` tint from the old active state would be invisible here, hence the explicit `bg-white/10` treatment instead of relying on token auto-retint).

- [ ] **Step 4: Update the mobile topbar's brand mark and menu icon**

Replace the mobile bar's button contents:
```tsx
<button
  type="button"
  onClick={() => setSidebarOpen(true)}
  className="focus-ring flex min-h-11 items-center gap-2 rounded-sm px-1.5 text-ink-700 hover:bg-canvas"
  aria-label="Open menu"
>
  <Menu className="h-5 w-5" strokeWidth={1.8} />
  <span className="text-sm font-semibold text-ink-900">EduManage</span>
</button>
```
Delete the now-unused local `MenuIcon`/`CloseIcon` functions at the bottom of the file entirely (replaced by `lucide-react`'s `Menu`/`X` above).

- [ ] **Step 5: Fix the brand string in the `document.title` effect**

```tsx
document.title = `${title} · EduManage`;
```

- [ ] **Step 6: Fix `client/src/hooks/useDocumentTitle.ts`**

```tsx
document.title = `${title} · EduManage`;
```

- [ ] **Step 7: Fix the localStorage key in `client/src/features/parent/useSelectedChild.ts`**

```tsx
const STORAGE_KEY = "edumanage:selectedChildId";
```
(No migration needed — no real users exist yet per PRODUCT.md's Evidence on Hand; a stale `bachandi:` key simply stops being read.)

- [ ] **Step 8: Run tests and build**

```bash
cd client
npm run test
npm run build
```
Expected: PASS.

- [ ] **Step 9: Visual check across all four roles and both breakpoints**

Log in (or navigate with a mocked session) as Teacher, Pupil, Parent, and Admin; confirm at both 1440px and 390px: sidebar is Navy with white text, active item shows a Royal Blue icon, mobile off-canvas still slides correctly, logo renders at both sidebar and mobile-topbar sizes, no "Bachandi" string remains anywhere (grep to confirm: `grep -ri bachandi client/src` should return nothing).

---

### Task 4: Auth Surfaces

**Files:**
- Modify: `client/src/features/auth/LoginPage.tsx`
- Modify: `client/src/features/auth/RegisterPage.tsx`
- Modify: `client/src/features/auth/ForgotPasswordPage.tsx`
- Modify: `client/src/features/auth/ResetPasswordPage.tsx`
- Modify: `client/src/features/auth/PendingPage.tsx`

**Interfaces:**
- Consumes: `Input` and `Logo` (Task 2), `Button`/`Card`/`FieldError`/`ErrorState` (already retinted by Task 2, no further changes needed to those).

DESIGN.md's Login spec: "minimal — logo + form on one side, a light visual on the other." Apply the same split-panel shell to all five auth pages for consistency (register/forgot/reset/pending currently share `LoginPage`'s single-centered-card pattern per the Explore survey — verify this against each file's actual JSX before assuming, since only `LoginPage` was read in full during planning).

- [ ] **Step 1: Rebuild `LoginPage.tsx`'s outer shell as a split panel, replacing hand-rolled inputs with `Input`**

```tsx
import { Logo } from "../../components/Logo";
import { Input } from "../../components/Input";
// ...remove the old `<div className="flex min-h-svh items-center justify-center bg-canvas p-4"><Card className="w-full max-w-sm p-8">` wrapper, replace with:

return (
  <div className="flex min-h-svh">
    <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
      <div className="mx-auto w-full max-w-sm">
        <Logo className="h-10 w-10" />
        <h1 className="mt-6 text-2xl font-bold text-ink-900">Sign in to EduManage</h1>
        <p className="mt-1 text-sm text-ink-500">Teachers and pupils, in one place.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-ink-700">
              Email <span className="text-danger-600" aria-hidden="true">*</span>
            </label>
            <Input
              id="login-email"
              type="email"
              required
              aria-required="true"
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              {...register("email")}
            />
            <FieldError id="login-email-error" message={errors.email?.message} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-sm font-medium text-ink-700">
                Password <span className="text-danger-600" aria-hidden="true">*</span>
              </label>
              <Link to="/forgot-password" className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700">
                Forgot password?
              </Link>
            </div>
            <Input
              id="login-password"
              type="password"
              required
              aria-required="true"
              invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              {...register("password")}
            />
            <FieldError id="login-password-error" message={errors.password?.message} />
          </div>

          {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          No account?{" "}
          <Link to="/register" className="focus-ring rounded-sm font-medium text-accent-600 hover:text-accent-700">
            Register
          </Link>
        </p>
      </div>
    </div>
    <div className="hidden bg-navy lg:block lg:w-1/2" aria-hidden="true" />
  </div>
);
```
The right panel is a flat Navy field for now (no fabricated dashboard screenshot — PRODUCT.md's Evidence on Hand forbids inventing product imagery that isn't real; a solid brand-color panel is the honest version of DESIGN.md's "light visual" until a real dashboard screenshot exists to drop in).

- [ ] **Step 2: Read `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `PendingPage.tsx` in full**, apply the same split-panel shell and `Input` swap, preserving every existing field, validation rule, and submit handler exactly as-is (this task is styling only — do not alter `RegisterPage`'s progressive-onboarding step logic if any exists, only its visual chrome).

- [ ] **Step 3: Run tests and build**

```bash
cd client
npm run test
npm run build
```

- [ ] **Step 4: Visual check at desktop and mobile for all five pages**

---

### Task 5: Teacher — Overview & Widget Cards

**Files:**
- Modify: `client/src/features/teacher/OverviewPage.tsx`
- Modify: `client/src/features/teacher/PaymentHealthCard.tsx`
- Modify: `client/src/features/teacher/RecentActivityCard.tsx`
- Modify: `client/src/features/teacher/UpcomingSchedule.tsx`
- Modify: `client/src/features/teacher/GoalsPanel.tsx`

**Interfaces:**
- Consumes: `StatCard` with `ReactNode` icons (Task 2) — pick Lucide icons per stat (e.g. roster size → `Users2`, today's attendance → `ClipboardCheck`, payment health → `Wallet`, upcoming classes → `CalendarDays`).

- [ ] **Step 1: Read all five files in full** (not previously read in planning beyond the Explore survey's naming) before editing, to see their exact current markup and any hardcoded emoji/`accent-*` usage the token retint doesn't reach.

- [ ] **Step 2: Retint the donut chart in `OverviewPage.tsx`**

Current colors (`["#92400e", "#3f3f46", "#52525b", "#a1a1aa"]`, hardcoded strings passed to recharts `<Cell fill={...}>` — these bypass the token system and need an explicit edit) become:

```tsx
const CHART_COLORS = ["#102A56", "#2563EB", "#20B26B", "#98A2B3"];
```
(Navy, Royal Blue, Soft Emerald, muted gray — in that order, largest-segment-first as the original was.)

- [ ] **Step 3: Replace every emoji `icon="..."` prop on `StatCard` call sites** (in `OverviewPage.tsx` and any of the four widget files that render one) with a Lucide element, e.g. `icon={<Users2 className="h-[18px] w-[18px]" />}`, importing from `lucide-react`.

- [ ] **Step 4: Confirm `PaymentHealthCard`/`RecentActivityCard`/`UpcomingSchedule`/`GoalsPanel` need no further edits beyond icon swaps** — their card chrome, borders, and text tokens already retint automatically from Task 1; only fix what a visual check in Step 6 actually shows is wrong.

- [ ] **Step 5: Run tests and build**

```bash
cd client
npm run test
npm run build
```

- [ ] **Step 6: Visual check (desktop + mobile) against DESIGN.md's "5-second rule" — KPI cards first, chart second, detail third**

---

### Task 6: Teacher — Classes, Class Detail, Pupil Modal

**Files:**
- Modify: `client/src/features/teacher/ClassesPage.tsx`
- Modify: `client/src/features/teacher/ClassDetailPage.tsx`
- Modify: `client/src/features/teacher/PupilDetailModal.tsx`

**Interfaces:**
- Consumes: `Input` (Task 2) for any hand-rolled form fields these pages have (`ClassDetailPage` and `PupilDetailModal` had the highest edit counts in the prior overhaul per `.impeccable/hook.cache.json`, suggesting real form/interaction density here — read before assuming).

- [ ] **Step 1: Read all three files in full.**
- [ ] **Step 2: Replace any hand-rolled `<input>`/`<select>` with `Input`** (or leave `<select>` native-styled but retint its border/focus classes to match `Input`'s pattern if no shared `Select` exists — do not build a new `Select` primitive for one call site; that's scope creep this plan doesn't need).
- [ ] **Step 3: Replace any emoji or ad-hoc SVG icons with Lucide equivalents**, matching the icon already chosen for this nav item in Task 3 where the same concept recurs (e.g. Class Management's `Users2`).
- [ ] **Step 4: Confirm the drag-and-drop pending-pupil assignment UI (dnd-kit) and its keyboard-select fallback still both work after restyling** — PRODUCT.md's Accessibility & Inclusion principle is explicit that this must keep working without a pointer; a visual-only pass must not regress it.
- [ ] **Step 5: Run tests and build.**
- [ ] **Step 6: Visual check (desktop + mobile), verify drag-and-drop and the select fallback both still function.**

---

### Task 7: Teacher — Ledger, Gradebook, Feed

**Files:**
- Modify: `client/src/features/teacher/LedgerPage.tsx`
- Modify: `client/src/features/teacher/GradebookPage.tsx`
- Modify: `client/src/features/teacher/FeedPage.tsx`

**Interfaces:**
- Consumes: `Badge` (Task 2, already fixed) for `PaymentBadge` usage — `LedgerPage` needs no badge-color edits, only chart-color edits.

DESIGN.md calls the Financial Management pattern (Ledger) "the highest-stakes surface for a paying Teacher... the most premium treatment" — give this file the most attention in this task.

- [ ] **Step 1: Read all three files in full.**

- [ ] **Step 2: Retint `LedgerPage.tsx`'s chart chrome and status colors** (currently hardcoded strings, bypass tokens):

```tsx
// gridline, axis, tooltip chrome:
const GRID_COLOR = "#E5EAF0";       // was #e4e4e7 (border)
const AXIS_TICK_COLOR = "#98A2B3";  // was #71717a (ink-400)
const TOOLTIP_BG = "#FFFFFF";       // unchanged
const TOOLTIP_BORDER = "#CBD5E1";   // was #d4d4d8 (border-strong)

const STATUS_COLORS = {
  PAID: "#20B26B",       // was #047857 (success-600)
  UNPAID: "#DC2626",     // was #be123c (danger-600)
  INCOMPLETE: "#D97706", // was #92400e (accent-600) — now warning, matching Badge's Task 2 change
};
```

- [ ] **Step 3: Retint `GradebookPage.tsx`'s bar chart** the same way:

```tsx
const CHART_BAR_FILL = "#2563EB"; // was #92400e — Royal Blue for a neutral data bar (not the Emerald CTA color, which DESIGN.md reserves for success/CTA, not general chart fill)
// grid #E5EAF0, axis ticks #98A2B3, tooltip bg #FFFFFF, tooltip border #CBD5E1 — same values as Step 2
```

- [ ] **Step 4: Retint `FeedPage.tsx`** — apply DESIGN.md's Communication pattern (short timestamped items, clear action), fixing only colors/icons; keep the existing post/exam/file feed logic untouched. Replace any file-type or post-type emoji with matching Lucide icons (`FileText`, `Paperclip`, `ClipboardList` as appropriate to what each renders).

- [ ] **Step 5: Run tests and build.**

- [ ] **Step 6: Visual check — confirm Ledger's PAID/UNPAID/INCOMPLETE chart segments match the Badge colors from Task 2 exactly (same hex, not just "close").**

---

### Task 8: Pupil Surfaces

**Files:**
- Modify: `client/src/features/pupil/HomePage.tsx`
- Modify: `client/src/features/pupil/SchedulePage.tsx`
- Modify: `client/src/features/pupil/AttendancePage.tsx`
- Modify: `client/src/features/pupil/PaymentsPage.tsx`
- Modify: `client/src/features/pupil/GradesPage.tsx`
- Modify: `client/src/features/pupil/FeedPage.tsx`

**Interfaces:**
- Consumes: same primitives as prior tasks. `AttendancePage` specifically consumes DESIGN.md's rule: "green = present, red-orange = absent/late, used sparingly" — apply `success-600`/`danger-600` (or `warning-600` for "late" specifically, keeping true red for "absent") rather than inventing a third color.

- [ ] **Step 1: Read all six files in full.**
- [ ] **Step 2: Retint any hardcoded status colors in `AttendancePage.tsx`** to `success-*` (present) / `danger-*` (absent) / `warning-*` (late) — grep the file for raw hex or Tailwind palette classes (e.g. `emerald-`, `rose-`, `red-`) first; anything already on `success-*`/`danger-*` tokens retints automatically from Task 1 and needs no edit.
- [ ] **Step 3: Replace emoji/ad-hoc icons with Lucide** across all six pages (each nav concept already has an assigned icon from Task 3 — reuse it: Schedule → `CalendarDays`, Attendance → `ClipboardCheck`, Payments → `Wallet`, Grades → `GraduationCap`, Feed → `MessageSquare`).
- [ ] **Step 4: Run tests and build.**
- [ ] **Step 5: Visual check (desktop + mobile) for all six pages.**

---

### Task 9: Parent Surfaces

**Files:**
- Modify: `client/src/features/parent/HomePage.tsx`
- Modify: `client/src/features/parent/SchedulePage.tsx`
- Modify: `client/src/features/parent/AttendancePage.tsx`
- Modify: `client/src/features/parent/PaymentsPage.tsx`
- Modify: `client/src/features/parent/GradesPage.tsx`
- Modify: `client/src/features/parent/FeedPage.tsx`
- Modify: `client/src/features/parent/ChildSwitcher.tsx`

**Interfaces:**
- Consumes: same as Task 8 — Parent pages mirror Pupil's read-mostly views per PRODUCT.md, so apply identical color/icon choices for the identical concepts (this is a consistency requirement, not a new decision).

- [ ] **Step 1: Read all seven files in full.**
- [ ] **Step 2: Apply the exact same status-color and icon choices as Task 8's equivalent page** (Parent's Attendance page must use the same present/absent/late colors as Pupil's — a visitor comparing the two views for the same child should see identical status colors).
- [ ] **Step 3: Retint `ChildSwitcher.tsx`** (a Parent-only control with no Pupil equivalent) — read it fresh, apply token-only changes (it almost certainly already uses `accent-*`/`ink-*`/`border-*` names that retint for free; confirm and fix only what's hardcoded).
- [ ] **Step 4: Run tests and build.**
- [ ] **Step 5: Visual check (desktop + mobile) for all seven files.**

---

### Task 10: Admin & Account Settings

**Files:**
- Modify: `client/src/features/admin/AdminPage.tsx`
- Modify: `client/src/features/admin/TeacherDetailPage.tsx`
- Modify: `client/src/features/account/SettingsPage.tsx`

**Interfaces:**
- Consumes: `Input` (Task 2) for `SettingsPage`'s change-password form, `Badge`'s `StatusBadge` (already fixed in Task 2) for Admin's pending-teacher queue.

- [ ] **Step 1: Read all three files in full.**
- [ ] **Step 2: Retint `AdminPage.tsx`'s approve/reject queue** — reuse `StatusBadge` as-is (already correct from Task 2); fix any local emoji/icon usage with Lucide (`Check`/`X` for approve/reject actions, if hand-drawn today).
- [ ] **Step 3: Retint `TeacherDetailPage.tsx`** — token-only pass plus icon swap.
- [ ] **Step 4: Retint `SettingsPage.tsx`**, replacing hand-rolled password-change inputs with `Input`.
- [ ] **Step 5: Run tests and build.**
- [ ] **Step 6: Visual check (desktop + mobile).**

---

### Task 11: Finish — Detector, Screenshots, Review, Documentation

**Files:**
- No source edits expected beyond fixes the review surfaces.
- Modify: `client/DESIGN.md` (trued up from the built reality by the documenter)
- Modify: `client/PRODUCT.md` (Brand Commitments, if the documenter finds drift worth recording)

- [ ] **Step 1: Run the mechanical design detector once, over the whole `client/src` tree**

```bash
node "C:\Users\amine\.claude\plugins\cache\impeccable\impeccable\4.1.2\skills\impeccable\scripts\detect.mjs" --json client/src
```
Fix every mechanical finding directly (leftover hardcoded hex, stray `Geist`/`bachandi` strings, mixed icon styles). Do not run the detector a second time — remaining findings, if any, pass to the reviewer.

- [ ] **Step 2: Capture desktop (1440px) and mobile (390px) screenshots of every distinct surface** into `.impeccable/review/` — one representative page per role (Overview, Ledger, a Pupil page, a Parent page, Admin, Login, Settings) is enough for the reviewer; capture the full page from the top, with entrance animation disabled/settled first.

- [ ] **Step 3: Spawn the `impeccable-finish-reviewer` agent** with: the original brief (`client/design-reference/redesign-brief.md`), `client/DESIGN.md`, the screenshot paths from Step 2, the reference image (`client/design-reference/design-system-reference.jpg`) as the comparison target, remaining detector findings from Step 1, and one line stating this is a web app in Operate mode (not Persuade) so scanability/consistency outrank expression.

- [ ] **Step 4: Act on the reviewer's disposition** (`ship` / `fix` / `rebuild` / `recapture`) per its own rules — a `fix` disposition gets one batch of corrections, one recapture, and a verdict pass; do not exceed two total review rounds without checking in with the user.

- [ ] **Step 5: Spawn the `impeccable-documenter` agent** with the project root, `client/PRODUCT.md`, and the built `client/src` tree, to true up `client/DESIGN.md` from what actually shipped (exact derived hex for `border-strong`/`danger`/`warning` if they drifted during implementation, the final Lucide icon-to-concept mapping, any structural pattern that emerged that the pre-build spec didn't anticipate).

- [ ] **Step 6: Final full-suite check**

```bash
cd client
npm run test
npm run build
npm run lint
```

---

## Self-Review Notes

- **Spec coverage:** every DESIGN.md section maps to a task — Color System/Typography/Radius/Shadow → Task 1; Icons/Components(Button/Badge/Notification/Empty/Error) → Task 2; Navbar/Logo/Dashboard layout → Task 3; Login/Register → Task 4; Dashboard-per-role sections (Student/Teacher/Schedules/Attendance/Financial/Communication/Reports mapped onto real surfaces, not the not-yet-built marketing site) → Tasks 5–10; Accessibility/Responsive/Avoid-list/Finish → woven into every task's visual-check step plus Task 11. The brief's Marketing Site section (§8–30) has no task here because DESIGN.md already scoped it out as "not yet built — forward spec," consistent with the redesign-scope decision from the prior session (existing functionality/structure only).
- **Placeholder scan:** every code step above has literal values (hex, class strings, component code) rather than "retint appropriately" — the exceptions are Tasks 6, 8, 9, 10's page-level steps, which intentionally defer to reading the live file first since those files weren't opened during planning; each still names the exact token/icon decision to apply, not a vague instruction.
- **Type consistency:** `StatCard.icon: ReactNode` (Task 2) is consumed the same way in Tasks 5–10 (`icon={<X className="h-[18px] w-[18px]" />}`); `NOTIFICATION_META`'s `Icon: ComponentType` (Task 2, step 8) matches its one consumer's render call (Task 2, step 9) exactly; `Input`'s `invalid?: boolean` prop (Task 2) matches every call site added in Task 4/6/10.

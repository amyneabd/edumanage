# French Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate the entire application (client UI + client-visible server text) from English to French, permanently and in place, with no toggle or i18n library.

**Architecture:** Direct string replacement across client and server source files. Centralize repeated enum-to-label mappings and date formatting into two shared modules (`client/src/lib/labels.ts` new, `client/src/lib/period.ts` modified) first, since every later client task depends on their exports. Then translate file-by-file, grouped by feature directory, ending with server-side services/controllers that have no client dependents. Update test assertions wherever a test checks exact rendered French text.

**Tech Stack:** React + TypeScript + Vite (client), Express + TypeScript + Prisma/PostgreSQL (server), Tailwind CSS v4, Zod, `sonner` toasts, `date-fns@^4.4.0` (+ `date-fns/locale` for `fr`), Recharts, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-french-localization-design.md`

## Global Constraints

- No i18n library, no language toggle — all text is permanently replaced with French text in source.
- Brand names "Bachandi" and "EduManage" are proper nouns and must NOT be translated anywhere they appear.
- Raw enum values (`ClassType`, `PaymentStatus`, `UserStatus`, `Role`, `SwapRequestStatus`, `ParentLinkStatus`, `AttendanceDisplay`) must never be rendered as visible text directly — always render through the corresponding `*_LABELS` map from `client/src/lib/labels.ts`. Enum arrays/types themselves (used for `value=` attributes and logic) stay untouched.
- All date formatting via `new Date(...).toLocaleDateString(...)` must go through the new `formatDate()` helper in `client/src/lib/period.ts`, which locks the locale to `"fr-FR"`. `.toLocaleString()` calls (a different method) are explicitly OUT of scope — leave them as-is, but translate any static surrounding text.
- `date-fns`'s `formatDistanceToNow` must be called with `{ addSuffix: true, locale: fr }` and `import { fr } from "date-fns/locale";` wherever used.
- Gender/number agreement is handled per-instance, not via a shared utility (e.g. "Excusé" not "Excusée", "notée(s)", "suivi(s)").
- Only update a test's exact-string assertions when the test asserts exact rendered text; tests that only check `.success`/`.error.issues[...].path`/error class instances need no changes.
- Task 1 (centralization) must be completed and committed before any other client task begins, since every subsequent client task imports from its exports.
- Tasks 5-9 each reference a companion file under `.tmp-plan-drafts/` containing the exact, line-numbered, verbatim old→new string replacements, structural-change instructions, and test-assertion updates for every file in that task (produced by prior research against the actual current source — not invented). These companion files are the authoritative source of exact content for those tasks: **read the referenced file in full before making any edit**, and apply every replacement, structural change, and test update it lists. Do not skip any item in a referenced file and do not invent replacements not listed there — if the current source no longer matches a quoted "Old" snippet exactly (e.g. line numbers drifted from earlier edits), locate the equivalent text by context and apply the same "New" replacement. The `.tmp-plan-drafts/` directory must remain in place until Task 11 Step 8 deletes it — never delete or move it early.

---

### Task 1: Centralized labels & date formatting

**Files:**
- Create: `client/src/lib/labels.ts`
- Modify: `client/src/lib/period.ts` (full-file replacement)
- Test: none (no existing test files for these modules)

**Interfaces:**
- Consumes: types `ClassType`, `PaymentStatus`, `UserStatus`, `Role`, `SwapRequestStatus`, `ParentLinkStatus`, `AttendanceDisplay` from `../api/types` (relative to `client/src/lib/labels.ts`, i.e. `client/src/api/types`).
- Produces: `CLASS_TYPE_LABELS`, `PAYMENT_STATUS_LABELS`, `USER_STATUS_LABELS`, `ROLE_LABELS`, `SWAP_REQUEST_STATUS_LABELS`, `PARENT_LINK_STATUS_LABELS`, `ATTENDANCE_DISPLAY_LABELS` (all `Record<Enum, string>`) from `client/src/lib/labels.ts`; `formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string`, `formatPeriodLabel(period: string): string`, `DAY_NAMES: string[]`, `currentPeriod`, `shiftPeriod` (unchanged signatures) from `client/src/lib/period.ts`. Every later task in this plan relies on these exact export names.

- [ ] **Step 1: Create `client/src/lib/labels.ts` with this exact content**

```ts
import type {
  ClassType,
  PaymentStatus,
  UserStatus,
  Role,
  SwapRequestStatus,
  ParentLinkStatus,
  AttendanceDisplay,
} from "../api/types";

export const CLASS_TYPE_LABELS: Record<ClassType, string> = {
  SCIENCE: "Sciences",
  MATH: "Mathématiques",
  INFO: "Informatique",
  ECO: "Économie",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PAID: "Payé",
  UNPAID: "Non payé",
  INCOMPLETE: "Incomplet",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: "En attente",
  ACTIVE: "Actif",
  REJECTED: "Rejeté",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  TEACHER: "Enseignant",
  PUPIL: "Élève",
  PARENT: "Parent",
};

export const SWAP_REQUEST_STATUS_LABELS: Record<SwapRequestStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvée",
  DECLINED: "Refusée",
};

export const PARENT_LINK_STATUS_LABELS: Record<ParentLinkStatus, string> = {
  PENDING: "En attente",
  ACTIVE: "Active",
  REJECTED: "Rejetée",
};

export const ATTENDANCE_DISPLAY_LABELS: Record<AttendanceDisplay, string> = {
  FUTURE: "À venir",
  TODAY: "Aujourd'hui",
  PRESENT: "Présent",
  ABSENT: "Absent",
  EXCUSED: "Excusé",
  UNMARKED: "Non marqué",
};
```

- [ ] **Step 2: Verify the import path resolves**

Run: `ls client/src/api/types.ts` (or the equivalent types file/dir) to confirm the relative import `../api/types` from `client/src/lib/labels.ts` resolves, and confirm each of the 7 named types is exported from it (`grep -n "export type ClassType\|export type PaymentStatus\|export type UserStatus\|export type Role\|export type SwapRequestStatus\|export type ParentLinkStatus\|export type AttendanceDisplay" client/src/api/types.ts`). If any type has a different exact name, adjust the import in Step 1 to match — do not invent new types.

- [ ] **Step 3: Replace the full content of `client/src/lib/period.ts`**

```ts
export function currentPeriod(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function shiftPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year!, month! - 1 + delta, 1);
  return currentPeriod(d);
}

export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year!, month! - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString("fr-FR", options);
}

export const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
```

Note: `currentPeriod` and `shiftPeriod` are unchanged from the original file — only `formatPeriodLabel`'s locale argument changes from `undefined` to `"fr-FR"`, `formatDate` is a new export, and `DAY_NAMES` values change to French abbreviations.

- [ ] **Step 4: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors introduced by these two files (pre-existing unrelated errors, if any, are not this task's concern).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/labels.ts client/src/lib/period.ts
git commit -m "feat(i18n): add centralized French label maps and date formatting"
```

---

### Task 2: Auth validation messages

**Files:**
- Modify: `client/src/lib/authSchemas.ts`
- Test: `client/src/lib/authSchemas.test.ts` (no changes needed — verified it only checks `.success` and `.error.issues[...].path`, never exact message text)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing new consumed by later tasks (validation messages are leaf-level strings).

- [ ] **Step 1: Apply these exact string replacements in `client/src/lib/authSchemas.ts`**

| Old | New |
|---|---|
| `"Enter your full name."` | `"Entrez votre nom complet."` |
| `"Email is required."` | `"L'e-mail est requis."` |
| `"Enter a valid email address."` | `"Entrez une adresse e-mail valide."` |
| `"Password must be at least 6 characters."` | `"Le mot de passe doit contenir au moins 6 caractères."` |
| `"Confirm your password."` (all occurrences — use `replace_all`) | `"Confirmez votre mot de passe."` |
| `"Enter a valid phone number."` | `"Entrez un numéro de téléphone valide."` |
| `"Choose a class type."` | `"Choisissez un type de classe."` |
| `"Enter your teacher's ID."` | `"Entrez l'identifiant de votre enseignant."` |
| `"Passwords don't match."` (all occurrences — use `replace_all`) | `"Les mots de passe ne correspondent pas."` |
| `"Password is required."` | `"Le mot de passe est requis."` |
| `"Enter your current password."` | `"Entrez votre mot de passe actuel."` |
| `"Confirm your new password."` | `"Confirmez votre nouveau mot de passe."` |
| `"New password must be different from your current password."` | `"Le nouveau mot de passe doit être différent de votre mot de passe actuel."` |

- [ ] **Step 2: Run the existing test file to confirm it still passes**

Run: `cd client && npx vitest run src/lib/authSchemas.test.ts`
Expected: PASS, no changes needed (test does not assert message text).

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/authSchemas.ts
git commit -m "feat(i18n): translate auth validation messages to French"
```

---

### Task 3: Shared components

**Files:**
- Modify: `client/src/components/AppLayout.tsx`
- Modify: `client/src/components/Badge.tsx`
- Modify: `client/src/components/ConfirmDialog.tsx`
- Modify: `client/src/components/Feedback.tsx`
- Modify: `client/src/components/Modal.tsx`
- Modify: `client/src/components/NotificationBell.tsx`
- Modify: `client/src/components/Pagination.tsx`
- Modify: `client/src/components/ScheduleView.tsx`
- Modify: `client/src/App.tsx`
- Test: `client/src/components/ScheduleView.test.tsx`

**Interfaces:**
- Consumes: `CLASS_TYPE_LABELS`, `USER_STATUS_LABELS` from `client/src/lib/labels.ts` (Task 1); `DAY_NAMES`, `formatDate` from `client/src/lib/period.ts` (Task 1).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: `client/src/components/AppLayout.tsx` — apply these exact replacements**

| Old | New |
|---|---|
| `"Close menu"` | `"Fermer le menu"` |
| `"Account settings"` (both occurrences) | `"Paramètres du compte"` |
| `"Log out"` | `"Se déconnecter"` |
| `` `Open menu, EduManage` `` or `"Open menu, EduManage"` (aria-label; keep "EduManage" untranslated) | `"Ouvrir le menu, EduManage"` |

Do NOT translate "EduManage" anywhere in this file — it is the product's brand name.

- [ ] **Step 2: `client/src/components/Badge.tsx` — structural change to fix raw-enum-render bugs**

This file has inline `paymentLabels` and `swapStatusLabels` objects, and separately renders raw enum values directly as visible text in `ClassTypeBadge` and `StatusBadge` (pre-existing bugs). Fix as follows:

1. Remove the inline `paymentLabels` object and the inline `swapStatusLabels` object entirely.
2. Add this consolidated import: `import { PAYMENT_STATUS_LABELS, CLASS_TYPE_LABELS, USER_STATUS_LABELS, SWAP_REQUEST_STATUS_LABELS } from "../lib/labels";`
3. Wherever `paymentLabels[...]` was used, replace with `PAYMENT_STATUS_LABELS[...]`.
4. Wherever `swapStatusLabels[...]` was used, replace with `SWAP_REQUEST_STATUS_LABELS[...]`.
5. In `ClassTypeBadge`, the raw class-type value is currently rendered directly as visible text (bug) — change it to render `CLASS_TYPE_LABELS[classType]` (use the component's actual prop name for the class-type value; read the file to confirm it).
6. In `StatusBadge`, the raw status value is currently rendered directly as visible text (bug) — change it to render `USER_STATUS_LABELS[status]` (use the component's actual prop name; read the file to confirm it).

Read the file first to confirm exact prop/variable names before editing — the structural fix must preserve the existing component API (props in, JSX out), changing only the label source. Do not rename any exported component or prop.

- [ ] **Step 3: `client/src/components/ConfirmDialog.tsx` — apply these exact replacements**

| Old | New |
|---|---|
| `"Confirm"` | `"Confirmer"` |
| `"Cancel"` | `"Annuler"` |
| `"Working…"` | `"Chargement…"` |

- [ ] **Step 4: `client/src/components/Feedback.tsx` — apply this exact replacement**

| Old | New |
|---|---|
| `"Retry"` | `"Réessayer"` |

- [ ] **Step 5: `client/src/components/Modal.tsx` — apply this exact replacement**

| Old | New |
|---|---|
| `"Close"` (aria-label) | `"Fermer"` |

- [ ] **Step 6: `client/src/components/NotificationBell.tsx` — apply replacements and fix date-fns locale**

| Old | New |
|---|---|
| `"Mark all read"` | `"Tout marquer comme lu"` |
| `"You're all caught up."` | `"Vous êtes à jour."` |

Also fix the `formatDistanceToNow` call: add `import { fr } from "date-fns/locale";` at the top, and change the call to pass `{ addSuffix: true, locale: fr }` (merge `locale: fr` into whatever options object is already passed — do not remove `addSuffix: true` if already present).

- [ ] **Step 7: `client/src/components/Pagination.tsx` — apply these exact replacements**

| Old | New |
|---|---|
| `"Showing "` | `"Affichage de "` |
| `" of "` | `" sur "` |
| `"Previous"` | `"Précédent"` |
| `"Page "` + page + `" of "` + total (i.e. the "Page X of Y" template) | `"Page "` + page + `" sur "` + total |
| `"Next"` | `"Suivant"` |

Apply directly to the template literal/JSX text nodes as they appear in the file — the table above gives the substring-level old→new mapping.

- [ ] **Step 8: `client/src/components/ScheduleView.tsx` — apply replacements and switch to centralized date helpers**

1. Replace the import of the local day-names array / any bare date formatting with: `import { DAY_NAMES, formatDate } from "../lib/period";` (adjust relative path as needed) and use `DAY_NAMES` and `formatDate(...)` in place of the previous local equivalents.
2. Convert the one bare `new Date(...).toLocaleDateString(...)` call in this file (with weekday/month/day options) to `formatDate(date, { weekday: ..., month: ..., day: ... })`, preserving the exact same options object.
3. Apply these exact text replacements (6 total):

| Old | New |
|---|---|
| `"No schedule set yet"` (EmptyState title) | `"Aucun emploi du temps défini pour l'instant"` |
| (EmptyState description accompanying the title above) | translate to natural French consistent with the rest of the app, e.g. "Ajoutez un emploi du temps pour cette classe." (read the exact original string in the file before writing the translation) |
| `"No vacation sessions scheduled yet"` (EmptyState title) | `"Aucune session de vacances programmée pour l'instant"` |
| (EmptyState description accompanying the title above) | translate to natural French consistent with the rest of the app (read the exact original string in the file before writing the translation) |
| `"· today"` | `"· aujourd'hui"` |
| `"No session"` | `"Aucune séance"` |

- [ ] **Step 9: Update `client/src/components/ScheduleView.test.tsx` to match new French text**

Change assertions:
- `"Mon"` → `"Lun"` (from `DAY_NAMES`)
- `"No schedule set yet"` → `"Aucun emploi du temps défini pour l'instant"`
- `"No vacation sessions scheduled yet"` → `"Aucune session de vacances programmée pour l'instant"`

- [ ] **Step 10: `client/src/App.tsx` — translate all navigation labels and brand strings**

Apply French translations to the nav-label strings across `adminNav`, `teacherNav`, `pupilNav`, `parentNav` arrays (19 nav-label sites total). These exact mappings are required wherever the corresponding English label appears in any of the 4 nav arrays:

| Old | New |
|---|---|
| `"Teachers"` | `"Enseignants"` |
| `"Overview"` | `"Aperçu"` |
| `"Class Management"` | `"Gestion des classes"` |
| `"Ledger"` | `"Registre"` |
| `"Gradebook"` | `"Carnet de notes"` |
| `"Communication"` | (unchanged — do not translate) |
| `"Home"` | `"Accueil"` |
| `"Schedule"` | `"Emploi du temps"` |
| `"Attendance"` | `"Présences"` |
| `"Payments"` | `"Paiements"` |
| `"Grades"` | `"Notes"` |
| `"Class Feed"` | `"Publications de la classe"` |

Read the file to find the exact remaining nav-label strings not listed above (the 4 arrays together contain 19 label sites) and translate each to its natural French equivalent, staying consistent with the vocabulary established by this table and by the rest of this plan (e.g. any "Users"/"Pupils"/"Settings"/"Goals"/"Feed" style label follows the same glossary used elsewhere: "Élèves" for pupils, "Paramètres" for settings, "Objectifs" for goals).

Also update the 4 `brand` prop occurrences — these are exact string replacements:

| Old | New |
|---|---|
| `"Admin"` (brand prop) | `"Administrateur"` |
| `"Teacher"` (brand prop) | `"Enseignant"` |
| `"Pupil"` (brand prop) | `"Élève"` |
| `"Parent"` (brand prop) | (unchanged — do not translate) |

Do NOT translate "EduManage" anywhere in this file — it is the product's brand name.

- [ ] **Step 11: Typecheck and run tests**

Run: `cd client && npx tsc --noEmit && npx vitest run src/components/ScheduleView.test.tsx`
Expected: no new type errors; `ScheduleView.test.tsx` passes with updated French assertions.

- [ ] **Step 12: Commit**

```bash
git add client/src/components/ client/src/App.tsx
git commit -m "feat(i18n): translate shared components and navigation to French"
```

---

### Task 4: Auth pages

**Files:**
- Modify: `client/src/features/auth/LoginPage.tsx`
- Modify: `client/src/features/auth/RegisterPage.tsx`
- Modify: `client/src/features/auth/ForgotPasswordPage.tsx`
- Modify: `client/src/features/auth/PendingPage.tsx`
- Modify: `client/src/features/auth/ResetPasswordPage.tsx`
- Modify: `client/src/features/auth/VerifyEmailPage.tsx`
- Test: none exist for these 6 files

**Interfaces:**
- Consumes: `CLASS_TYPE_LABELS` from `client/src/lib/labels.ts` (Task 1) — used in `RegisterPage.tsx` for `<option>` text.
- Produces: nothing new consumed by later tasks.

All 6 files live directly under `client/src/features/auth/` (there is no `pages/` subdirectory). No test files exist for any of these 6 files. Use "E-mail" (not "Email") consistently for every field-label/heading occurrence of the word across all 6 files.

- [ ] **Step 1: `client/src/features/auth/LoginPage.tsx` — translate all 10 user-visible strings**

Read the file and apply French translations to all 10 identified user-visible strings (headings, field labels, button text, links). Use "E-mail" for the email field label, "Mot de passe" for password, "Se connecter" for the submit button, "Vous n'avez pas de compte ?" / "S'inscrire" for the sign-up prompt/link, and "Mot de passe oublié ?" for the forgot-password link — translate every remaining identified string in the file to natural, consistent French using this same vocabulary.

- [ ] **Step 2: `client/src/features/auth/RegisterPage.tsx` — translate all 21 strings plus structural class-type fix**

1. Add import: `import { CLASS_TYPE_LABELS } from "../../lib/labels";`
2. Replace the class-type `<option>` rendering so each option's visible text uses `CLASS_TYPE_LABELS[type]` instead of the raw enum value, while keeping `value={type}` as the raw enum.
3. Translate all remaining 21 user-visible strings: field labels ("Full name"→"Nom complet", "E-mail" for the email label, "Password"→"Mot de passe", "Confirm password"→"Confirmer le mot de passe", "Phone number"→"Numéro de téléphone", "Class type"→"Type de classe", "Teacher ID"→"Identifiant enseignant"), role-selection labels ("Pupil"→"Élève", "Teacher"→"Enseignant", "Parent" unchanged), submit button ("Register"/"Sign up"→"S'inscrire"), footer link ("Already have an account?"→"Vous avez déjà un compte ?", "Log in"→"Se connecter"), and every other identified string site in the file, translated consistently with this vocabulary.

- [ ] **Step 3: `client/src/features/auth/ForgotPasswordPage.tsx` — translate all 11 strings**

Translate heading, description text, the "E-mail" field label, submit button ("Send reset link"→"Envoyer le lien de réinitialisation"), back-to-login link ("Back to login"→"Retour à la connexion"), and any success/error inline text — covering all 11 identified sites in the file.

- [ ] **Step 4: `client/src/features/auth/PendingPage.tsx` — translate all 7 strings including the composed conditional sentence**

Translate the heading ("Account pending approval"→"Compte en attente d'approbation"), description text, and the composed conditional sentence that varies based on role/state — read the file for the exact original template and produce the equivalent French sentence preserving the same interpolation/branching (translate every branch's text, not just the wrapper). Cover all 7 identified string sites.

- [ ] **Step 5: `client/src/features/auth/ResetPasswordPage.tsx` — translate all 10 strings**

Translate heading, "New password"→"Nouveau mot de passe", "Confirm new password"→"Confirmer le nouveau mot de passe", submit button ("Reset password"→"Réinitialiser le mot de passe"), success/error messages, and back-to-login link — covering all 10 identified sites.

- [ ] **Step 6: `client/src/features/auth/VerifyEmailPage.tsx` — translate all 16 strings including the composed sentence with email fallback**

Translate heading, description, and the composed sentence that interpolates `user?.email` with a fallback string (read the file for the exact original template, e.g. of the shape `` `We sent a verification link to ${user?.email ?? "your email"}.` ``, and produce the French equivalent translating both the static text and the fallback, e.g. `` `Nous avons envoyé un lien de vérification à ${user?.email ?? "votre e-mail"}.` ``), plus the resend-link button text ("Resend verification email"→"Renvoyer l'e-mail de vérification") and all other identified strings (16 total).

- [ ] **Step 7: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add client/src/features/auth/
git commit -m "feat(i18n): translate auth pages to French"
```

---

### Task 5: Account & admin pages

**Files:**
- Modify: `client/src/features/account/SettingsPage.tsx` (or wherever `SettingsPage.tsx` lives per repo structure — confirm path with `find`/`Glob` before editing)
- Modify: `client/src/features/admin/AdminPage.tsx`
- Modify: `client/src/features/admin/TeacherDetailPage.tsx`
- Test: none exist for these 3 files

**Interfaces:**
- Consumes: `ROLE_LABELS`, `USER_STATUS_LABELS` from `client/src/lib/labels.ts` (Task 1); `formatDate` from `client/src/lib/period.ts` (Task 1).
- Produces: nothing new consumed by later tasks.
- Exact content source: `.tmp-plan-drafts/account-admin-pages.md` (read in full before starting this task — see Global Constraints).

- [ ] **Step 1: `SettingsPage.tsx` — structural fix + 13 replacements**

Confirm the file's actual path first (`Glob "**/SettingsPage.tsx"` under `client/src/features/`). Open `.tmp-plan-drafts/account-admin-pages.md` and locate the `SettingsPage.tsx` section. Apply exactly what it specifies:
1. Add the `ROLE_LABELS` import from `client/src/lib/labels.ts` and fix the raw-enum-render bug where the user's role is currently printed as the bare enum value — render it through `ROLE_LABELS[role]` instead.
2. Apply all 13 exact string replacements listed in that section (page heading, section headings, field labels, button text, toast text) verbatim as written there.

- [ ] **Step 2: `AdminPage.tsx` — structural fix + 31 replacements**

Open `.tmp-plan-drafts/account-admin-pages.md` and locate the `AdminPage.tsx` section. Apply exactly what it specifies:
1. Add the `formatDate` import from `client/src/lib/period.ts` and the `USER_STATUS_LABELS` import from `client/src/lib/labels.ts`.
2. Fix the status-filter raw-enum-render bug: render `USER_STATUS_LABELS[status]` for the visible text, keeping `value={status}` as the raw enum.
3. Convert every bare `new Date(...).toLocaleDateString(...)` call in this file to `formatDate(...)`, preserving each call's existing options argument exactly.
4. Apply all remaining exact string replacements listed in that section (31 sites total, including the two structural sites above).

- [ ] **Step 3: `TeacherDetailPage.tsx` — structural fix + 35 replacements + pluralization fix**

Open `.tmp-plan-drafts/account-admin-pages.md` and locate the `TeacherDetailPage.tsx` section. Apply exactly what it specifies:
1. Add the `formatDate` import from `client/src/lib/period.ts`. Keep the file's local `POST_TYPE_LABELS` object local (it is NOT centralized into `labels.ts`) but translate its values to French exactly as specified in that section.
2. Convert all 4 bare `new Date(...).toLocaleDateString(...)` call sites to `formatDate(...)`, preserving each call's existing options argument exactly.
3. Fix the exam-submissions summary pluralization exactly as specified there — the key requirement is that "notée(s)" (or the equivalent past participle used) agrees in gender and number with the submission count, using the exact template given in the file.
4. Apply all remaining exact string replacements listed in that section (35 sites total).

- [ ] **Step 4: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/account/ client/src/features/admin/
git commit -m "feat(i18n): translate account and admin pages to French"
```

---

### Task 6: Teacher pages (classes, feed, goals)

**Files:**
- Modify: `client/src/features/teacher/ClassesPage.tsx`
- Modify: `client/src/features/teacher/ClassDetailPage.tsx`
- Modify: `client/src/features/teacher/FeedPage.tsx`
- Modify: `client/src/features/teacher/GoalsPanel.tsx`
- Test: `client/src/features/teacher/VacationBanner.test.tsx`
- Test: `client/src/features/teacher/VacationSessionsPanel.test.tsx`

**Interfaces:**
- Consumes: `CLASS_TYPE_LABELS`, `PAYMENT_STATUS_LABELS` from `client/src/lib/labels.ts` (Task 1); `formatDate` from `client/src/lib/period.ts` (Task 1).
- Produces: nothing new consumed by later tasks.
- Exact content source: `.tmp-plan-drafts/teacher-pages-1.md` (read in full before starting this task — see Global Constraints). It documents, per file, a "Replacements" list (numbered, each with exact Old/New snippets and line numbers), a "Structural changes" section, and (where applicable) a "Test assertion updates" section.

- [ ] **Step 1: `ClassesPage.tsx` — structural imports + 34 replacements (includes `RequestCard`, `ClassCard`, `SwapRequestRow`, `ParentRequestRow`, `VacationBanner`)**

Open `.tmp-plan-drafts/teacher-pages-1.md`, section "File: client/src/features/teacher/ClassesPage.tsx". Apply exactly what it specifies:
1. Add `import { formatDate } from "../../lib/period";` and `import { CLASS_TYPE_LABELS } from "../../lib/labels";`.
2. Apply all 34 numbered replacements verbatim (covering the co-located `RequestCard`, `ClassCard`, `SwapRequestRow`, `ParentRequestRow`, and `VacationBanner` sub-components, plus the page-level heading, toasts, and the new-class modal).
3. Apply the structural change: convert the `CLASS_TYPES.map` `<option>` rendering to use `CLASS_TYPE_LABELS[t]` for the visible text while keeping `value={t}` as the raw enum, and convert the 4 bare `new Date(...).toLocaleDateString(undefined, {...})` call sites (items 6, 7, 15 in that file's list) to `formatDate(...)`, preserving each call's exact existing options object.

- [ ] **Step 2: `ClassDetailPage.tsx` — structural import + 25 replacements (includes `VacationSessionsPanel`)**

Open `.tmp-plan-drafts/teacher-pages-1.md`, section "File: client/src/features/teacher/ClassDetailPage.tsx". Apply exactly what it specifies:
1. Add `import { PAYMENT_STATUS_LABELS } from "../../lib/labels";` and extend the existing `import { currentPeriod, DAY_NAMES } from "../../lib/period";` to also import `formatDate`.
2. Apply all 25 numbered replacements verbatim (covering the co-located `VacationSessionsPanel` sub-component and the page-level members table, schedule editor, visitors list, and parent-request list).
3. Apply the structural change: convert the `PAYMENT_STATUSES.map` `<option>` rendering to use `PAYMENT_STATUS_LABELS[s]` for the visible text while keeping `value={s}` as the raw enum (do NOT add a separate label lookup for the `DAY_NAMES.map` day-of-week `<select>` — it becomes French automatically via Task 1's `DAY_NAMES` change), and convert the 4 bare `new Date(...).toLocaleDateString(undefined, {...})` call sites (items 3, 4, 21 in that file's list) to `formatDate(...)`, preserving each call's exact existing options object.

- [ ] **Step 3: `FeedPage.tsx` (teacher) — structural formatDate import (2 of 4 date-like sites) + 31 replacements**

Open `.tmp-plan-drafts/teacher-pages-1.md`, section "File: client/src/features/teacher/FeedPage.tsx". Apply exactly what it specifies:
1. Add `import { formatDate } from "../../lib/period";` (this file currently has no import from that module).
2. Convert exactly 2 of the 4 date-like call sites — `post.dueDate` (item 21) and `submission.submittedAt` (item 25), both bare `.toLocaleDateString()` calls with no options argument — to `formatDate(post.dueDate)` and `formatDate(submission.submittedAt)` respectively. Leave the other 2 sites (`post.editedAt`'s title attribute, `post.createdAt`'s display), which use `.toLocaleString()`, unconverted per Global Constraints — only their surrounding static words are translated (item 14).
3. Apply all remaining numbered replacements verbatim (31 total, covering the `TYPE_LABELS`/`TYPE_FILTERS` maps, composer, post cards, edit form, and `ExamSubmissions`/`SubmissionGradeRow` sub-components).

- [ ] **Step 4: `GoalsPanel.tsx` — 7 replacements, no structural changes**

Open `.tmp-plan-drafts/teacher-pages-1.md`, section "File: client/src/features/teacher/GoalsPanel.tsx". Apply all 7 numbered replacements verbatim (panel heading/subheading, previous/next month buttons, achieved/total summary line with plural agreement on "objectif(s) atteint(s)", empty-goals copy, new-goal form, and the two `GoalRow` aria-label sites). No imports or structural changes — `goal.title` is user-generated content and must never be translated, only the static text around it.

- [ ] **Step 5: Update `VacationBanner.test.tsx` — 6 assertion updates**

Open `.tmp-plan-drafts/teacher-pages-1.md`, section "Test assertion updates" under `ClassesPage.tsx`. Apply all 6 listed assertion changes verbatim (they match the French strings introduced in Step 1's `VacationBanner` sub-component translations: "Start vacation mode"→"Activer le mode vacances" ×2, "Start date"→"Date de début", "End date"→"Date de fin", "Vacation mode is active"→"Mode vacances actif", "End vacation mode"→"Désactiver le mode vacances").

- [ ] **Step 6: Update `VacationSessionsPanel.test.tsx` — 1 assertion update, 1 explicit no-change**

Open `.tmp-plan-drafts/teacher-pages-1.md`, section "Test assertion updates" under `ClassDetailPage.tsx`. Update the "No ad-hoc sessions added yet." assertion to "Aucune séance ponctuelle ajoutée pour le moment." (matching Step 2's `VacationSessionsPanel` translation). Leave the `"10:00–11:00"` raw time-string assertion unchanged — it asserts a raw `HH:mm–HH:mm` string built from `s.startTime`/`s.endTime`, which per spec §4 displays unchanged with no locale formatting.

- [ ] **Step 7: Run tests and typecheck**

Run: `cd client && npx tsc --noEmit && npx vitest run src/features/teacher/VacationBanner.test.tsx src/features/teacher/VacationSessionsPanel.test.tsx`
Expected: no new type errors; both test files pass.

- [ ] **Step 8: Commit**

```bash
git add client/src/features/teacher/ClassesPage.tsx client/src/features/teacher/ClassDetailPage.tsx client/src/features/teacher/FeedPage.tsx client/src/features/teacher/GoalsPanel.tsx client/src/features/teacher/VacationBanner.test.tsx client/src/features/teacher/VacationSessionsPanel.test.tsx
git commit -m "feat(i18n): translate teacher classes/feed/goals pages to French"
```

---

### Task 7: Teacher pages (gradebook, ledger, modals)

**Files:**
- Modify: `client/src/features/teacher/GradebookPage.tsx`
- Modify: `client/src/features/teacher/LedgerPage.tsx`
- Modify: `client/src/features/teacher/OverviewPage.tsx`
- Modify: `client/src/features/teacher/PaymentHealthCard.tsx`
- Modify: `client/src/features/teacher/RecentActivityCard.tsx`
- Modify: `client/src/features/teacher/UpcomingSchedule.tsx`
- Modify: `client/src/features/teacher/PupilContactModal.tsx`
- Modify: `client/src/features/teacher/PupilDetailModal.tsx`
- Modify: `client/src/features/teacher/PupilLedgerModal.tsx`
- Test: `client/src/features/teacher/PupilContactModal.test.tsx`
- Test: `client/src/features/teacher/PupilDetailModal.test.tsx`
- Test: `client/src/features/teacher/PupilLedgerModal.test.tsx`

**Interfaces:**
- Consumes: `PAYMENT_STATUS_LABELS`, `ATTENDANCE_DISPLAY_LABELS` from `client/src/lib/labels.ts` (Task 1); `formatDate`, `formatPeriodLabel` from `client/src/lib/period.ts` (Task 1).
- Produces: nothing new consumed by later tasks.
- Exact content source: `.tmp-plan-drafts/teacher-pages-2-modals.md` (read in full before starting this task — see Global Constraints).

- [ ] **Step 1: `GradebookPage.tsx` — CSV headers + 14 UI replacements, no structural changes**

Open `.tmp-plan-drafts/teacher-pages-2-modals.md`, section `GradebookPage.tsx`. Apply the exact CSV export header array translation and all 14 UI replacements it lists, including the "Exam" fallback→"Examen", "Ungraded"→"Non noté", and the page heading "Gradebook"→"Carnet de notes". No imports or structural changes.

- [ ] **Step 2: `LedgerPage.tsx` (teacher) — structural fix + full page translation**

Open `.tmp-plan-drafts/teacher-pages-2-modals.md`, section `LedgerPage.tsx`. Apply exactly what it specifies:
1. Remove the inline `STATUS_LABELS` const (keep the `PAYMENT_STATUSES` array itself untouched).
2. Add `import { PAYMENT_STATUS_LABELS } from "../../lib/labels";` and replace every `STATUS_LABELS` usage with `PAYMENT_STATUS_LABELS` (including the Recharts `name: STATUS_LABELS[s]` site).
3. Fix the 2 raw-enum-render bugs — the top filter `<select>` and the per-row status `<select>` — so visible option text reads `{PAYMENT_STATUS_LABELS[s]}` while `value={s}` stays the raw enum.
4. Update the CSV export row builder so the status cell uses `PAYMENT_STATUS_LABELS[r.status]` instead of the raw value; leave the CSV filename unchanged; translate the CSV header array and the `r.isOverdue ? "Yes" : "No"` cell to `"Oui"`/`"Non"` exactly as specified.
5. Apply every remaining text replacement listed for this file: h1 "Ledger"→"Registre", subtitle, prev/next-month controls, "Today" button, all 4 StatCards (Collected/Outstanding/Overdue/Expected) with their pluralized hint text, "Payment status breakdown", "By class", the `"Unassigned"`→`"Non assigné"` chart-category fallback, search/filter controls, "Export CSV", the EmptyState, table headers, the "{n} day{s} overdue" pluralization, and the "Mark as paid in full"/"Mark paid" buttons. There are no bare `toLocaleDateString` sites in this file.

- [ ] **Step 3: `OverviewPage.tsx` — full page translation, no structural changes**

Open `.tmp-plan-drafts/teacher-pages-2-modals.md`, section `OverviewPage.tsx`. Apply every listed replacement verbatim: "Overview"→"Aperçu", the subtitle, "Active pupils"→"Élèves actifs", "Pending requests"→"Demandes en attente" with its hint, "Paid this month"→"Payé ce mois-ci", "Class distribution"→"Répartition des classes" with its empty-state copy, "Teacher ID"→"Identifiant enseignant" with its share-copy sentence, and "Copied!"/"Copy"→"Copié !"/"Copier". No imports or structural changes.

- [ ] **Step 4: `PaymentHealthCard.tsx` — structural fix + 4 replacements**

Open `.tmp-plan-drafts/teacher-pages-2-modals.md`, section `PaymentHealthCard.tsx`. Apply exactly what it specifies:
1. Remove the inline `LABELS` map.
2. Add `import { PAYMENT_STATUS_LABELS } from "../../lib/labels";` and replace both `LABELS[...]` usages (the tooltip title and the legend text) with `PAYMENT_STATUS_LABELS[...]`.
3. Translate the remaining strings: "Payment health this month"→"Santé des paiements ce mois-ci", "View ledger"→"Voir le registre", "No active pupils to bill yet."→"Aucun élève actif à facturer pour l'instant.", "paid up"→"payé".

- [ ] **Step 5: `RecentActivityCard.tsx` — 2 replacements + date-fns locale fix**

Open `.tmp-plan-drafts/teacher-pages-2-modals.md`, section `RecentActivityCard.tsx`. Translate "Recent activity"→"Activité récente" and the EmptyState ("Nothing yet"/"Pupil requests, submissions, and payment alerts show up here."→"Rien pour l'instant"/"Les demandes des élèves, les soumissions et les alertes de paiement s'affichent ici."). Add `import { formatDistanceToNow } from "date-fns"; import { fr } from "date-fns/locale";` and pass `{ addSuffix: true, locale: fr }` to the existing `formatDistanceToNow` call.

- [ ] **Step 6: `UpcomingSchedule.tsx` — structural formatDate import + 6 replacements**

Open `.tmp-plan-drafts/teacher-pages-2-modals.md`, section `UpcomingSchedule.tsx`. Add `formatDate` to the file's existing `DAY_NAMES` import from `../../lib/period`, and convert the 1 bare `toLocaleDateString(undefined, { weekday, month, day })` call to `formatDate(date, { weekday, month, day })` preserving the options object. Translate "Today"→"Aujourd'hui" (2 sites: weekly-day label and vacation-day label), "Tomorrow"→"Demain" (2 sites), "Upcoming sessions"→"Séances à venir", and the EmptyState ("No scheduled sessions"/"Add a weekly schedule from a class's detail page."→"Aucune séance programmée"/"Ajoutez un emploi du temps hebdomadaire depuis la page de détail d'une classe.").

- [ ] **Step 7: `PupilContactModal.tsx` — 6 replacements, no structural changes**

Open `.tmp-plan-drafts/teacher-pages-2-modals.md`, section `PupilContactModal.tsx`. Translate: modal title "Contact info"→"Coordonnées"; "Full name"→"Nom complet"; "Class"→"Classe"; fallback "Not assigned yet"→"Pas encore assignée" (feminine agreement — refers to "la classe"); "Phone"→"Téléphone"; "No linked parent account"→"Aucun compte parent lié". Leave "Email" and "Parent" unchanged.

- [ ] **Step 8: Update `PupilContactModal.test.tsx` — 1 assertion update**

Update the assertion for "No linked parent account" to "Aucun compte parent lié". All other assertions in this test check fixture data (names/emails/phones) and are unchanged.

- [ ] **Step 9: `PupilDetailModal.tsx` — structural fix + formatDate import + full translation**

Open `.tmp-plan-drafts/teacher-pages-2-modals.md`, section `PupilDetailModal.tsx`. Apply exactly what it specifies:
1. Remove the inline `DISPLAY_LABELS` const and add `import { ATTENDANCE_DISPLAY_LABELS } from "../../lib/labels";`. Replace the legend's hardcoded literals with `ATTENDANCE_DISPLAY_LABELS.PRESENT`/`ABSENT`/`EXCUSED`/`UNMARKED`/`FUTURE`/`TODAY` references — this intentionally shortens the old richer English phrasing (e.g. "Not marked yet — click to record") to the short centralized French terms; this is expected, not a regression.
2. Extend the existing `import { DAY_NAMES, currentPeriod, formatPeriodLabel, shiftPeriod } from "../../lib/period";` to also import `formatDate`, and convert the 1 bare `toLocaleDateString` site (`entry.dueDate`) to `formatDate(...)`.
3. Translate every remaining listed string: modal title fallback "Pupil"→"Élève"; "View contact info"→"Voir les coordonnées"; "Attendance"→"Présences"; "Previous month"/"Next month"→"Mois précédent"/"Mois suivant"; the two "not assigned"/"no sessions scheduled" sentences; the instruction sentence about clicking a session to cycle its status; "Payment history"→"Historique des paiements"; "Full ledger"→"Registre complet"; "No payment records yet."→"Aucun paiement enregistré pour l'instant."; table headers "Period"/"Status"/"Paid / Due"/"Due date"→"Période"/"Statut"/"Payé / Dû"/"Date d'échéance"; "overdue"→"en retard".

- [ ] **Step 10: Update `PupilDetailModal.test.tsx` — regex update**

Change the regex `/excused/i` to `/excusé/i` — the legend now renders "Excusé (1)" (masculine, no trailing "d"), which breaks the old English-derived regex.

- [ ] **Step 11: `PupilLedgerModal.tsx` — structural fix + full translation**

Open `.tmp-plan-drafts/teacher-pages-2-modals.md`, section `PupilLedgerModal.tsx`. Apply exactly what it specifies:
1. Fix the raw-enum-render bug in the per-row status `<option>`: add `import { PAYMENT_STATUS_LABELS } from "../../lib/labels";` and render `{PAYMENT_STATUS_LABELS[s]}` for the visible text (the `PAYMENT_STATUSES` array itself is unchanged). There are no bare `toLocaleDateString` sites in this file.
2. Translate every remaining listed string: the title template `` `${pupilName} — Full ledger}` `` and standalone "Full ledger"→`` `${pupilName} — Registre complet` ``/"Registre complet"; the balance-banner sentences ("Owes {amt} overall"→"Doit {amt} au total"; the credit sentence with "about {n} session{s} ahead"→"soit environ {n} séance{s} d'avance"; "All settled"→"Tout est réglé"); table headers "Period"/"Present"/"Status"/"Amount due"/"Amount paid"/"Due date"→"Période"/"Présent"/"Statut"/"Montant dû"/"Montant payé"/"Date d'échéance" (leave "Absent" unchanged); the 4 per-period aria-labels; "Mark as paid in full"/"Mark paid"→"Marquer comme payé intégralement"/"Marquer payé".

- [ ] **Step 12: Update `PupilLedgerModal.test.tsx` — 5 assertion updates including month names**

Update all 5 assertions exactly: "owes 50 TND overall"→"doit 50 TND au total"; "September 2026"→"septembre 2026" and "August 2026"→"août 2026" (both from `formatPeriodLabel`'s Task-1 locale change); "25 TND credit (paid in advance) — about 3 sessions ahead"→"25 TND de crédit (payé en avance) — soit environ 3 séances d'avance"; the aria-label lookup "Amount paid for September 2026"→"Montant payé pour septembre 2026". The `updatePaymentStatusMock` call-args assertion is unchanged — it checks the raw API payload, not display text.

- [ ] **Step 13: Run tests and typecheck**

Run: `cd client && npx tsc --noEmit && npx vitest run src/features/teacher/PupilContactModal.test.tsx src/features/teacher/PupilDetailModal.test.tsx src/features/teacher/PupilLedgerModal.test.tsx`
Expected: no new type errors; all 3 test files pass.

- [ ] **Step 14: Commit**

```bash
git add client/src/features/teacher/GradebookPage.tsx client/src/features/teacher/LedgerPage.tsx client/src/features/teacher/OverviewPage.tsx client/src/features/teacher/PaymentHealthCard.tsx client/src/features/teacher/RecentActivityCard.tsx client/src/features/teacher/UpcomingSchedule.tsx client/src/features/teacher/PupilContactModal.tsx client/src/features/teacher/PupilDetailModal.tsx client/src/features/teacher/PupilLedgerModal.tsx client/src/features/teacher/PupilContactModal.test.tsx client/src/features/teacher/PupilDetailModal.test.tsx client/src/features/teacher/PupilLedgerModal.test.tsx
git commit -m "feat(i18n): translate teacher gradebook/ledger/modals to French"
```

---

### Task 8: Pupil pages

**Files:**
- Modify: `client/src/features/pupil/AttendancePage.tsx`
- Modify: `client/src/features/pupil/FeedPage.tsx`
- Modify: `client/src/features/pupil/GradesPage.tsx`
- Modify: `client/src/features/pupil/HomePage.tsx`
- Modify: `client/src/features/pupil/PaymentsPage.tsx`
- Modify: `client/src/features/pupil/SchedulePage.tsx`
- Test: `client/src/features/pupil/SchedulePage.test.tsx`

**Interfaces:**
- Consumes: `ATTENDANCE_DISPLAY_LABELS`, `CLASS_TYPE_LABELS` from `client/src/lib/labels.ts` (Task 1); `formatDate` from `client/src/lib/period.ts` (Task 1). Also depends on `Badge.tsx`'s `StatusBadge` translation from Task 3 for the `"Pending"` → `"En attente"` swap-status assertion in `SchedulePage.test.tsx`.
- Produces: nothing new consumed by later tasks.
- Exact content source: `.tmp-plan-drafts/pupil-pages.md` (read in full before starting this task — see Global Constraints). Only `SchedulePage.test.tsx` exists as a test file among these 6 pages.

- [ ] **Step 1: `AttendancePage.tsx` (pupil) — structural import + full translation**

Open `.tmp-plan-drafts/pupil-pages.md`, section `AttendancePage.tsx`. Add `import { ATTENDANCE_DISPLAY_LABELS } from "../../lib/labels";`, delete the local `DISPLAY_LABELS` map, and replace the tooltip usage with `ATTENDANCE_DISPLAY_LABELS[cell.entry.display]` (leave the `DISPLAY_STYLES` color map untouched). Translate: "Attendance"→"Présences"; fallback "Your class"→"Votre classe"; "Attendance rate"→"Taux de présence"; "Present"→"Présent" (leave "Absent" unchanged); "Previous month"→"Mois précédent"; "Next month"→"Mois suivant"; "Calendar"→"Calendrier"; "You're not assigned to a class yet."→"Vous n'êtes pas encore affecté(e) à une classe."; "No sessions scheduled for this class."→"Aucune séance programmée pour cette classe."; legend lines "Present ({n})"→"Présent ({n})" (leave "Absent ({n})" unchanged), "Excused ({n})"→"Excusé ({n})", "Not marked ({n})"→"Non marqué ({n})", "Upcoming ({n})"→"À venir ({n})", "Today"→"Aujourd'hui".

- [ ] **Step 2: `FeedPage.tsx` (pupil) — structural formatDate for 2 of 4 date-like calls + full translation**

Open `.tmp-plan-drafts/pupil-pages.md`, section `FeedPage.tsx`. Add `import { formatDate } from "../../lib/period";` and convert 2 bare `toLocaleDateString` sites (`post.dueDate`, `post.mySubmission.submittedAt`) to `formatDate(...)`; leave the 2 `toLocaleString()` sites (`post.editedAt`, `post.createdAt`) unconverted per Global Constraints. Translate: `TYPE_LABELS` map values `{TEXT:"Post",FILE:"File",EXAM:"Exam"}`→`{TEXT:"Publication",FILE:"Fichier",EXAM:"Examen"}`; `TYPE_FILTERS` "All"/"Posts"/"Files"/"Exams"→"Tous"/"Publications"/"Fichiers"/"Examens"; `DueBadge` ternary "Overdue"/"Due today"/"Due tomorrow"→"En retard"/"À rendre aujourd'hui"/"À rendre demain", and `` `Due in ${diff}d` ``→`` `À rendre dans ${diff} j` ``; toast "Exam submitted."→"Examen soumis."; "Submitting…"/"Submit"→"Soumission en cours…"/"Soumettre"; "Class feed"→"Publications de la classe"; placeholder "Search posts…"→"Rechercher des publications…"; EmptyState "No posts yet"/"Your teacher hasn't posted anything."→"Aucune publication pour le moment"/"Votre enseignant n'a encore rien publié."; EmptyState "No posts match your filters"→"Aucune publication ne correspond à vos filtres"; "Edited {date}" title→"Modifié le {date}" (word only, the `toLocaleString()` call itself stays); "· edited"→"· modifié"; "Due {date}"→"À rendre le {formatDate result}"; "Submitted: {file} on {date}"→"Soumis : {file} le {formatDate result}"; "Awaiting grade"→"En attente de note".

- [ ] **Step 3: `GradesPage.tsx` (pupil) — structural formatDate + 8 replacements**

Open `.tmp-plan-drafts/pupil-pages.md`, section `GradesPage.tsx`. Add `import { formatDate } from "../../lib/period";` and convert 1 bare `toLocaleDateString` site (`g.gradedAt`) to `formatDate(...)`. Translate: "Grades"→"Notes"; "Your exam results and teacher feedback."→"Vos résultats d'examens et les retours de votre enseignant."; "Average score"→"Moyenne"; "Graded exams"→"Examens notés" (2 sites: StatCard + h2); "Awaiting grade"→"En attente de note"; EmptyState "No grades yet"/"Your submitted exams will show grades here once your teacher reviews them."→"Aucune note pour le moment"/"Vos examens soumis afficheront une note ici une fois que votre enseignant les aura corrigés."; fallback "Exam"→"Examen"; " · Graded {date}"→" · Noté le {formatDate result}".

- [ ] **Step 4: `HomePage.tsx` (pupil) — structural formatDate (3 sites) + full translation**

Open `.tmp-plan-drafts/pupil-pages.md`, section `HomePage.tsx`. Add `formatDate` alongside the existing `DAY_NAMES` import from `../../lib/period` and convert 3 bare `toLocaleDateString` sites (`e.dueDate`, `payment.dueDate`, `p.createdAt`) to `formatDate(...)`. Keep the local `TYPE_LABELS` object local (translate its values the same as `FeedPage.tsx`'s). Translate every listed string: the welcome-back greeting template; "{class} with {teacher}"→"{class} avec {teacher}"; "Attendance rate"→"Taux de présence" with its hint; "Next session"→"Prochaine séance" with its "Today"/"Tomorrow"/"In {n} days" ternary→"Aujourd'hui"/"Demain"/"Dans {n} jours"; fallback "No schedule set yet"→"Aucun emploi du temps défini pour l'instant"; "Pending exams"→"Examens en attente" with its ternary "{n} overdue"/"Due soon"/"All caught up"→"{n} en retard"/"À rendre bientôt"/"Tout est à jour"; "Payment status"→"Statut du paiement" with its "Paid"/"Partial"/"Unpaid"→"Payé"/"Partiel"/"Non payé" ternary and "{amt} settled" hint→"{amt} réglé"; "Action needed"→"Action requise"; "Go to feed →"→"Aller aux publications →"; fallback "Exam submission"→"Soumission d'examen"; badge ternary "Overdue"/"Due {date}"/"No due date"→"En retard"/"À rendre le {formatDate result}"/"Aucune date d'échéance"; "Payment ({period})"→"Paiement ({period})" with "View history →"→"Voir l'historique →", "Due {date}"→"Échéance le {formatDate result}", "{paid} paid of {due}"→"{paid} payé sur {due}"; "Attendance"→"Présences" with "View calendar →"→"Voir le calendrier →" and its present/absent/not-marked summary sentence; "Latest from your class"→"Dernières publications de votre classe" with "View all →"→"Voir tout →" and EmptyState "No posts yet"→"Aucune publication pour le moment"; "Parent Code"→"Code parent" with its share-copy sentence and "Copied!"/"Copy"→"Copié !"/"Copier".

- [ ] **Step 5: `PaymentsPage.tsx` (pupil) — structural formatDate + full translation**

Open `.tmp-plan-drafts/pupil-pages.md`, section `PaymentsPage.tsx`. Add `formatDate` alongside the existing `currentPeriod, formatPeriodLabel` import from `../../lib/period` and convert 1 bare `toLocaleDateString` site (`entry.dueDate`) to `formatDate(...)`. Translate: "Payments"→"Paiements"; "Your tuition payment status and history."→"Le statut et l'historique de vos paiements de scolarité."; "This month"→"Ce mois-ci"; "No record yet"→"Aucun enregistrement pour le moment"; "Total paid"→"Total payé"; "Overdue periods"→"Périodes en retard"; "History"→"Historique"; EmptyState "No payment records yet"/"Your teacher hasn't recorded any payments yet."→"Aucun paiement enregistré"/"Votre enseignant n'a encore enregistré aucun paiement."; table headers "Period"/"Status"/"Paid / Due"/"Due date"→"Période"/"Statut"/"Payé / Dû"/"Date d'échéance"; "overdue"→"en retard" (the "—" placeholder stays unchanged).

- [ ] **Step 6: `SchedulePage.tsx` (pupil) — structural formatDate (2 sites) + CLASS_TYPE_LABELS import + full translation**

Open `.tmp-plan-drafts/pupil-pages.md`, section `SchedulePage.tsx`. Add `formatDate` alongside the existing `DAY_NAMES` import, and add `import { CLASS_TYPE_LABELS } from "../../lib/labels";`. Fix the raw-enum-render bug in the target-class `<select>` option text (`{c.name} ({c.type})`→`{c.name} ({CLASS_TYPE_LABELS[c.type]})`). Convert both bare `toLocaleDateString(undefined, {weekday,month,day})` sites to `formatDate(...,{weekday,month,day})` preserving the options object. Translate: toast "Swap request sent."→"Demande d'échange envoyée."; EmptyState "No other classes to join"/"Your teacher only has the class you're already enrolled in."→"Aucune autre classe à rejoindre"/"Votre enseignant ne propose que la classe où vous êtes déjà inscrit(e)."; label "Session you'll miss"→"Séance que vous allez manquer"; label "Class to join"→"Classe à rejoindre"; "No schedule set for this class yet."→"Aucun emploi du temps défini pour cette classe."; "Meets: {schedule}"→"Horaires : {schedule}"; label "Date to attend"→"Date à laquelle assister"; label "Reason (optional)"→"Motif (optionnel)"; placeholder "e.g. I'll be away from my usual class that day."→"ex. : je serai absent(e) de ma classe habituelle ce jour-là."; button "Sending…"/"Request swap"→"Envoi…"/"Demander un échange"; EmptyState "No swap requests yet"/"Requests you send will show up here."→"Aucune demande d'échange pour le moment"/"Les demandes que vous envoyez s'afficheront ici."; "instead of {class} on {date}"→"à la place de {class} le {formatDate result}"; "Cancel"→"Annuler"; "Schedule"→"Emploi du temps"; "Swap a session"→"Échanger une séance"; the modal description sentence→"Besoin d'échanger votre classe habituelle contre une autre à une date précise ? Faites votre demande ici."; "My swap requests"→"Mes demandes d'échange".

- [ ] **Step 7: Update `SchedulePage.test.tsx` — 5 assertion updates**

Open `.tmp-plan-drafts/pupil-pages.md`, section "Test file `SchedulePage.test.tsx` updates" under `SchedulePage.tsx`. Update: `/session you'll miss/i`→`/séance que vous allez manquer/i`; `/class to join/i`→`/classe à rejoindre/i`; `/date to attend/i`→`/date à laquelle assister/i`; the `/request swap/i` role-name query→`/demander un échange/i`; and `"Pending"`→`"En attente"` (this depends on `Badge.tsx`'s `SwapStatusBadge` translation already landed in Task 3). Leave the mock data ("Other Class"/"My Class") and other fixture values unchanged.

- [ ] **Step 8: Run tests and typecheck**

Run: `cd client && npx tsc --noEmit && npx vitest run src/features/pupil/SchedulePage.test.tsx`
Expected: no new type errors; test passes.

- [ ] **Step 9: Commit**

```bash
git add client/src/features/pupil/
git commit -m "feat(i18n): translate pupil pages to French"
```

---

### Task 9: Parent pages

**Files:**
- Modify: `client/src/features/parent/AttendancePage.tsx`
- Modify: `client/src/features/parent/ChildSwitcher.tsx`
- Modify: `client/src/features/parent/FeedPage.tsx`
- Modify: `client/src/features/parent/GradesPage.tsx`
- Modify: `client/src/features/parent/HomePage.tsx`
- Modify: `client/src/features/parent/LedgerPage.tsx`
- Modify: `client/src/features/parent/PaymentsPage.tsx`
- Modify: `client/src/features/parent/SchedulePage.tsx`
- Verify (no changes): `client/src/features/parent/useSelectedChild.ts`
- Test: none exist for these files

**Interfaces:**
- Consumes: `ATTENDANCE_DISPLAY_LABELS`, `PAYMENT_STATUS_LABELS` from `client/src/lib/labels.ts` (Task 1); `formatDate` from `client/src/lib/period.ts` (Task 1).
- Produces: nothing new consumed by later tasks.
- Exact content source: `.tmp-plan-drafts/parent-pages.md` (read in full before starting this task — see Global Constraints). No test files exist for any of these 9 files.

- [ ] **Step 1: Shared "no linked children" EmptyState text — apply across 7 of these 9 files**

In each of the 7 files that render this empty state (identify which via `grep -rln "No linked children" client/src/features/parent/`), translate exactly:

| Old | New |
|---|---|
| `"No linked children yet"` | `"Aucun enfant associé pour le moment"` |
| `"Add a child using their Parent Code to get started."` | `"Ajoutez un enfant à l'aide de son code parent pour commencer."` |

- [ ] **Step 2: `AttendancePage.tsx` (parent) — structural import + full translation**

Open `.tmp-plan-drafts/parent-pages.md`, section `AttendancePage.tsx`. Remove the local `DISPLAY_LABELS` map, add `import { ATTENDANCE_DISPLAY_LABELS } from "../../lib/labels";`, and use it in the tooltip template. No bare `toLocaleDateString` sites (this file already uses `formatPeriodLabel`/`DAY_NAMES`, covered by Task 1). Translate: "Attendance"→"Présences" plus the shared EmptyState from Step 1; fallback "Class"→"Classe"; "Attendance rate"→"Taux de présence"; "Present"→"Présent" (leave "Absent" unchanged); "Previous month"→"Mois précédent"; "Next month"→"Mois suivant"; "Calendar"→"Calendrier"; "Not assigned to a class yet."→"Pas encore affecté à une classe."; "No sessions scheduled for this class."→"Aucune séance programmée pour cette classe."; legend "Present ("→"Présent (" (leave "Absent (" unchanged), "Excused ("→"Excusé (", "Not marked ("→"Non marqué (", "Upcoming ("→"À venir (", "Today"→"Aujourd'hui".

- [ ] **Step 3: `ChildSwitcher.tsx` — full translation, no structural changes**

Open `.tmp-plan-drafts/parent-pages.md`, section `ChildSwitcher.tsx`. Translate: toast "Link request sent — waiting on the teacher's approval."→"Demande de liaison envoyée — en attente de l'approbation de l'enseignant."; modal title "Link a child"→"Associer un enfant"; label "Parent Code"→"Code parent"; placeholder "e.g. PFBV9U"→"ex. PFBV9U"; "Ask your child for their Parent Code, shown on their Home page."→"Demandez à votre enfant son code parent, affiché sur sa page d'accueil."; "Sending request…"/"Send request"→"Envoi de la demande…"/"Envoyer la demande"; "Add a child"→"Ajouter un enfant"; "Link requests"→"Demandes de liaison"; ternary "Awaiting teacher approval"/"Declined"→"En attente de l'approbation de l'enseignant"/"Refusée". The `linkStatusColors` map is CSS-only and stays untouched.

- [ ] **Step 4: `FeedPage.tsx` (parent) — structural formatDate (2 sites) + full translation**

Open `.tmp-plan-drafts/parent-pages.md`, section `FeedPage.tsx`. Add `import { formatDate } from "../../lib/period";` and convert 2 bare `toLocaleDateString` sites (post due date, submission date) to `formatDate(...)`; leave the 2 `toLocaleString()` sites unchanged. `TYPE_LABELS` stays local — translate its values the same pattern as the pupil pages. Translate: `TYPE_FILTERS` "All"/etc.→"Tous"/etc.; "Class feed"→"Publications de la classe" plus the shared EmptyState from Step 1; placeholder "Search posts…"→"Rechercher des publications…"; `DueBadge` ternary same pattern as pupil `FeedPage.tsx`; EmptyState "No posts yet"/"The teacher hasn't posted anything."→"Aucune publication pour le moment"/"L'enseignant n'a encore rien publié."; EmptyState "No posts match your filters"→"Aucune publication ne correspond à vos filtres"; "· edited"→"· modifié"; "Edited {date}" (the `toLocaleString()` call itself unconverted)→"Modifié {date}"; "Due {date}"→"Échéance {formatDate result}"; "Submitted: {file} on {date}"→"Soumis : {file} le {formatDate result}"; "Awaiting grade"→"En attente de note"; "Not yet submitted"→"Pas encore soumis".

- [ ] **Step 5: `GradesPage.tsx` (parent) — structural formatDate + full translation**

Open `.tmp-plan-drafts/parent-pages.md`, section `GradesPage.tsx`. Add `import { formatDate } from "../../lib/period";` and convert 1 bare `toLocaleDateString` site (`g.gradedAt`) to `formatDate(...)`. Translate: "Grades"→"Notes" plus the shared EmptyState from Step 1; "Exam results and teacher feedback."→"Résultats des examens et retours de l'enseignant."; "Average score"→"Moyenne"; "Graded exams"→"Examens corrigés" (2 sites — note this file uses "corrigés", NOT "notés" like the pupil GradesPage; do not "fix" this to match, it is a deliberate independent wording choice); "Awaiting grade"→"En attente de note"; EmptyState "No grades yet"/"Submitted exams will show grades here once the teacher reviews them."→"Aucune note pour le moment"/"Les notes des examens soumis s'afficheront ici une fois que l'enseignant les aura corrigés."; fallback "Exam"→"Examen"; " · Graded {date}"→" · Corrigé le {formatDate result}" (again "Corrigé", not "Noté"). Quoted feedback text is user content and stays untouched.

- [ ] **Step 6: `HomePage.tsx` (parent) — structural formatDate (3 sites) + PAYMENT_STATUS_LABELS import + full translation**

Open `.tmp-plan-drafts/parent-pages.md`, section `HomePage.tsx`. Add `import { formatDate } from "../../lib/period";` and convert 3 bare `toLocaleDateString` sites (`e.dueDate`, `payment.dueDate`, `p.createdAt`) to `formatDate(...)`. Add `import { PAYMENT_STATUS_LABELS } from "../../lib/labels";` and replace the Payment-status StatCard's bespoke "Paid"/"Partial"/"Unpaid" ternary entirely with `PAYMENT_STATUS_LABELS[payment.status]` (this yields "Payé"/"Incomplet"/"Non payé" — "Incomplet" replaces the old "Partial"; this is the file the design spec explicitly calls out for centralization). `TYPE_LABELS` stays local (same translation pattern as elsewhere). Translate every remaining listed string: "Your children"→"Vos enfants" plus the shared EmptyState from Step 1; "Attendance rate"→"Taux de présence" with its hint; "Next session"→"Prochaine séance" with "Today"/"Tomorrow"/"In {n} days"→"Aujourd'hui"/"Demain"/"Dans {n} jours"; fallback "No schedule set yet"→"Aucun horaire défini pour le moment" (note: "horaire", not "emploi du temps" — this file's own original wording differs slightly from the pupil HomePage's equivalent string; keep as specified); "Pending exams"→"Examens en attente" with its "{n} overdue"/"Due soon"/"All caught up" hint→"{n} en retard"/"À rendre bientôt"/"Tout est à jour"; "Action needed"→"Action requise"; "Go to feed →"→"Aller aux publications →"; fallback "Exam submission"→"Soumission d'examen"; status-span ternary "Overdue"/"Due {date}"/"No due date"→"En retard"/"Échéance {formatDate result}"/"Aucune date d'échéance"; "Payment ({period})"→"Paiement ({period})" with "View history →"→"Voir l'historique →", "Due {date}"→"Échéance {formatDate result}", "{paid} paid of {due}"→"{paid} payé sur {due}"; "Attendance"→"Présences" with "View calendar →"→"Voir le calendrier →" and its present/absent/not-marked summary sentence; "Latest from the class"→"Dernières publications de la classe" (note: "the class", not "your class" — this file's own original wording, keep as-is) with "View all →"→"Voir tout →" and EmptyState "No posts yet"→"Aucune publication pour le moment"; the recent-posts date converted via `formatDate`.

- [ ] **Step 7: `LedgerPage.tsx` (parent) — structural formatDate + full translation**

Open `.tmp-plan-drafts/parent-pages.md`, section `LedgerPage.tsx`. Add `import { formatDate } from "../../lib/period";` and convert 1 bare `toLocaleDateString` site (`row.dueDate`) to `formatDate(...)`. This file has no inline `STATUS_LABELS` map (it uses the shared `<PaymentBadge>` component, out of scope). Translate: "Ledger"→"Registre" plus the shared EmptyState from Step 1; "Full attendance and payment history, period by period."→"Historique complet des présences et paiements, période par période."; balance banner: "Owes {amt} overall"→"Doit {amt} au total"; "{amt} credit (paid in advance)"→"{amt} de crédit (payé d'avance)" (note: "payé d'avance", not "payé en avance" as in the teacher `PupilLedgerModal` — keep this file's own wording, do not unify); "— about {n} session{s} ahead"→"— environ {n} séance{s} d'avance"; "All settled"→"Tout est réglé"; "History"→"Historique"; EmptyState "No ledger records yet"/"The teacher hasn't recorded any attendance or payments yet."→"Aucun enregistrement dans le registre pour le moment"/"L'enseignant n'a encore enregistré aucune présence ni aucun paiement."; table headers "Period"/"Present"/"Status"/"Paid / Due"/"Due date"→"Période"/"Présent"/"Statut"/"Payé / Dû"/"Date d'échéance" (leave "Absent" unchanged).

- [ ] **Step 8: `PaymentsPage.tsx` (parent) — structural formatDate + full translation**

Open `.tmp-plan-drafts/parent-pages.md`, section `PaymentsPage.tsx`. Add `import { formatDate } from "../../lib/period";` and convert 1 bare `toLocaleDateString` site (`entry.dueDate`) to `formatDate(...)`. Translate: "Payments"→"Paiements" plus the shared EmptyState from Step 1; "Tuition payment status and history."→"Statut et historique des paiements de scolarité."; "This month"→"Ce mois-ci"; "No record yet"→"Aucun enregistrement pour le moment"; "Total paid"→"Total payé"; "Overdue periods"→"Périodes en retard"; "History"→"Historique"; EmptyState "No payment records yet"/"The teacher hasn't recorded any payments yet."→"Aucun paiement enregistré pour le moment"/"L'enseignant n'a encore enregistré aucun paiement."; table headers same pattern as pupil `PaymentsPage.tsx`; "overdue"→"en retard".

- [ ] **Step 9: `SchedulePage.tsx` (parent) — 2 replacements only, no structural changes**

Open `.tmp-plan-drafts/parent-pages.md`, section `SchedulePage.tsx`. Translate "Schedule"→"Emploi du temps" plus the shared EmptyState from Step 1. This page delegates rendering to the shared `ScheduleView` component (translated in Task 3) — no other changes, no bare date calls here.

- [ ] **Step 10: Verify `useSelectedChild.ts` needs no changes**

Open `.tmp-plan-drafts/parent-pages.md`, section `useSelectedChild.ts` — it documents that this hook was read and confirmed to contain no user-visible text: it only manages a `localStorage` key (`STORAGE_KEY = "edumanage:selectedChildId"`, an internal identifier, not client-visible) and query state, plus one internal code comment. No edits — this step exists to document that verification, not to skip it.

- [ ] **Step 11: Typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 12: Commit**

```bash
git add client/src/features/parent/
git commit -m "feat(i18n): translate parent pages to French"
```

---

### Task 10: Server services & controllers

**Files:**
- Modify: `server/src/services/auth.service.ts`
- Modify: `server/src/services/swap.service.ts`
- Modify: `server/src/services/attendance.service.ts`
- Modify: `server/src/services/payment.service.ts`
- Modify: `server/src/services/class.service.ts`
- Modify: `server/src/services/parent.service.ts`
- Modify: `server/src/services/admin.service.ts`
- Modify: `server/src/controllers/auth.controller.ts`
- Modify: `server/src/controllers/pupil.controller.ts`
- Modify: `server/src/controllers/teacher.controller.ts`
- Modify: `server/src/controllers/parent.controller.ts`
- Modify: `server/src/controllers/admin.controller.ts`
- Test: none affected (all tests use `.rejects.toThrow(ErrorClass)` or check error class instances, never exact message text)

**Interfaces:**
- Consumes: nothing from client tasks (server-side, independent).
- Produces: nothing consumed by other tasks (this and Task 11 are the terminal server tasks).

- [ ] **Step 1: `server/src/services/auth.service.ts` — 10 replacements in `AuthError` throws**

| Old | New |
|---|---|
| `"An account with this email already exists."` (×3: registerTeacher/registerPupil/registerParent) | `"Un compte avec cet e-mail existe déjà."` |
| `"No active teacher found with that Teacher ID."` | `"Aucun enseignant actif trouvé avec cet identifiant enseignant."` |
| `"Invalid email or password."` (×2) | `"E-mail ou mot de passe invalide."` |
| `"This reset link is invalid or has expired."` | `"Ce lien de réinitialisation est invalide ou a expiré."` |
| `"This verification link is invalid or has expired."` | `"Ce lien de vérification est invalide ou a expiré."` |
| `"User not found."` | `"Utilisateur introuvable."` |
| `"Current password is incorrect."` | `"Le mot de passe actuel est incorrect."` |

- [ ] **Step 2: `server/src/services/swap.service.ts` — 13 replacements in `SwapError` throws**

| Old | New |
|---|---|
| `"Pupil profile not found."` | `"Profil élève introuvable."` |
| `"Pupil is not assigned to a class."` | `"L'élève n'est assigné à aucune classe."` |
| `"Invalid date."` (×2) | `"Date invalide."` |
| `"Origin date must not be in the past."` | `"La date d'origine ne doit pas être dans le passé."` |
| `"Target date must not be in the past."` | `"La date cible ne doit pas être dans le passé."` |
| `"You already have a pending swap request for that session."` | `"Vous avez déjà une demande d'échange en attente pour cette séance."` |
| `"Origin date is not a scheduled session of your class."` | `"La date d'origine ne correspond pas à une séance programmée de votre classe."` |
| `"Target class not found."` | `"Classe cible introuvable."` |
| `"Target class must be different from your own class."` | `"La classe cible doit être différente de votre propre classe."` |
| `"Target date is not a scheduled session of the target class."` | `"La date cible ne correspond pas à une séance programmée de la classe cible."` |
| `"Swap request not found."` (×2) | `"Demande d'échange introuvable."` |
| `"Only pending requests can be cancelled."` | `"Seules les demandes en attente peuvent être annulées."` |
| `"This request has already been resolved."` | `"Cette demande a déjà été traitée."` |

- [ ] **Step 3: `server/src/services/attendance.service.ts` — 6 replacements in `AttendanceError` throws**

| Old | New |
|---|---|
| `"Pupil not found."` | `"Élève introuvable."` |
| `"Pupil profile not found."` | `"Profil élève introuvable."` |
| `"Invalid date."` (×2) | `"Date invalide."` |
| `"Cannot record attendance for a future date."` | `"Impossible d'enregistrer une présence pour une date future."` |
| `"This pupil's class has no session scheduled on that day."` | `"La classe de cet élève n'a aucune séance programmée ce jour-là."` |

Note: `getOwnAttendanceCalendar`'s error propagates through `parent.service.ts` → `parent.controller.ts`'s `handleParentError`, which only checks `instanceof ParentError`. This is a known edge case (the message may not surface correctly through that path), but the message is still independently client-visible via the pupil's own route, so translate it regardless — no code-path fix is in scope here.

- [ ] **Step 4: `server/src/services/payment.service.ts` — 5 replacements in `PaymentError` throws**

| Old | New |
|---|---|
| `"Pupil not found."` (×2) | `"Élève introuvable."` |
| `"Pupil profile not found."` (×2) | `"Profil élève introuvable."` |

(Total 5 occurrences across the 2 distinct messages — apply `replace_all` per message as needed based on actual occurrence count in file.)

- [ ] **Step 5: `server/src/services/class.service.ts` — 8 replacements in `ClassError` throws (no test file)**

| Old | New |
|---|---|
| `"Class not found."` (×4) | `"Classe introuvable."` |
| `"Pupil not found in this class."` | `"Élève introuvable dans cette classe."` |
| `"Pupil request not found."` (×2) | `"Demande d'élève introuvable."` |

- [ ] **Step 6: `server/src/services/parent.service.ts` — 8 replacements in `ParentError` throws (no test file)**

| Old | New |
|---|---|
| `"No pupil found with that Parent Code."` | `"Aucun élève trouvé avec ce code parent."` |
| `"You already have a pending request for this pupil."` | `"Vous avez déjà une demande en attente pour cet élève."` |
| `"This pupil is already linked to your account."` | `"Cet élève est déjà lié à votre compte."` |
| `"You don't have access to this pupil."` | `"Vous n'avez pas accès à cet élève."` |
| `"Pupil is not yet assigned to a class."` (×2) | `"L'élève n'est pas encore assigné à une classe."` |
| `"Request not found."` | `"Demande introuvable."` |
| `"This request has already been resolved."` | `"Cette demande a déjà été traitée."` |

- [ ] **Step 7: `server/src/services/admin.service.ts` — 1 replacement in `AdminError` throw (no test file)**

| Old | New |
|---|---|
| `"Teacher not found."` | `"Enseignant introuvable."` |

- [ ] **Step 8: `server/src/controllers/auth.controller.ts` — 12 replacements (no test file)**

| Old | New |
|---|---|
| `"Invalid input"` (×6 sites) | `"Entrée invalide"` |
| `"If that email exists, we've sent a link to reset your password."` (the `GENERIC_RESET_MESSAGE` const) | `"Si cet e-mail existe, nous avons envoyé un lien pour réinitialiser votre mot de passe."` |
| `"Not authenticated"` (×3) | `"Non authentifié"` |
| `"Verification email sent."` (×2) | `"E-mail de vérification envoyé."` |

Excluded (internal-only, stays English): the `console.error` call using a template like `` `[mailer] failed to send ${context}:` `` — this is a server log, not client-visible.

- [ ] **Step 9: `server/src/controllers/pupil.controller.ts` — 4 replacements (no test file)**

| Old | New |
|---|---|
| `"Not yet assigned to a class."` (×2) | `"Pas encore assigné à une classe."` |
| `"A file is required for submission."` | `"Un fichier est requis pour la soumission."` |
| `"Invalid request body."` | `"Corps de requête invalide."` |

Note: `PostError`/`PupilError` pass-through messages thrown deeper in the service layer belong to Task 11 — do not translate those here, only this controller's own literal strings.

- [ ] **Step 10: `server/src/controllers/teacher.controller.ts` — 12 replacements (no test file)**

| Old | New |
|---|---|
| `"Invalid input"` (×5) | `"Entrée invalide"` |
| `"classId is required"` (×2) | `"classId est requis"` |
| `"Class not found."` (×3) | `"Classe introuvable."` |
| `"classId and type are required"` | `"classId et type sont requis"` |

Keep the field names `classId` and `type` untranslated (they are API/code identifiers referenced in error text, not prose).

- [ ] **Step 11: `server/src/controllers/parent.controller.ts` — 1 replacement (no test file)**

| Old | New |
|---|---|
| `"A valid Parent Code is required."` | `"Un code parent valide est requis."` |

- [ ] **Step 12: `server/src/controllers/admin.controller.ts` — 2 replacements (no test file)**

| Old | New |
|---|---|
| `"Teacher not found."` (×2) | `"Enseignant introuvable."` |

- [ ] **Step 13: Run server test suite**

Run: `cd server && npm test`
Expected: PASS — no test in this suite asserts exact error message text for any of the files touched in this task (all use `.rejects.toThrow(ErrorClass)` or `instanceof` checks).

- [ ] **Step 14: Commit**

```bash
git add server/src/services/auth.service.ts server/src/services/swap.service.ts server/src/services/attendance.service.ts server/src/services/payment.service.ts server/src/services/class.service.ts server/src/services/parent.service.ts server/src/services/admin.service.ts server/src/controllers/auth.controller.ts server/src/controllers/pupil.controller.ts server/src/controllers/teacher.controller.ts server/src/controllers/parent.controller.ts server/src/controllers/admin.controller.ts
git commit -m "feat(i18n): translate server service and controller error messages to French"
```

---

### Task 11: Server notifications, emails & post/pupil errors

**Files:**
- Modify: `server/src/services/notification.service.ts`
- Modify: `server/src/utils/mailer.ts`
- Modify: `server/src/services/post.service.ts`
- Modify: `server/src/services/pupil.service.ts`
- Test: none affected

**Interfaces:**
- Consumes: nothing from other tasks (server-side, independent, terminal task).
- Produces: nothing (final task).

- [ ] **Step 1: `server/src/services/notification.service.ts` — 6 replacements (2 via `replace_all` for duplicated teacher/parent sync functions)**

| Old | New |
|---|---|
| `title: overdue ? "Payment overdue" : "Payment due today"` | `title: overdue ? "Paiement en retard" : "Paiement dû aujourd'hui"` |
| body template containing `"overdue"` / `"due today"` (duplicated across teacher/parent sync functions — use `replace_all`) | replace `"overdue"` → `"en retard"`, `"due today"` → `"dû aujourd'hui"` in the body template string, preserving interpolation |
| `"Monthly recap ready"` | `"Récapitulatif mensuel disponible"` |
| body `` `You achieved ${x} of ${y} goals in ${z}` `` (or equivalent) | `` `Vous avez atteint ${x} objectif(s) sur ${y} pour ${z}` `` |
| `"Missing submission"` | `"Soumission manquante"` |
| body fallback `"an exam"` | `"un examen"` |

- [ ] **Step 2: `server/src/utils/mailer.ts` — 8 replacements**

Translate the reset-password email subject, plain-text body, and HTML body; the verify-email subject, plain-text body, and HTML body; and the generic alert plain-text/HTML body's `"View details"` → `"Voir les détails"` link text. Keep the brand name "Bachandi" untranslated everywhere it appears in subjects/text/HTML. Keep any `logLabel` parameter values as-is (internal/English, not client-visible). Read the file first to get each exact string, and translate all 8 identified sites while preserving all interpolation (`${...}`) and HTML structure exactly.

- [ ] **Step 3: `server/src/services/post.service.ts` — 12 replacements in `PostError` throws / notification text**

| Old | New |
|---|---|
| `"Post not found."` | `"Publication introuvable."` |
| `"Exam post not found."` | `"Examen introuvable."` |
| `"New class post"` | `"Nouvelle publication"` |
| kind ternary: `"a new exam"` / `"a new file"` / `"a new post"` | `"un nouvel examen"` / `"un nouveau fichier"` / `"une nouvelle publication"` |
| body `"shared "` + content (the "shared X" template) | `"a partagé "` + content |
| `"Submission not found."` | `"Soumission introuvable."` |
| `"Only exam submissions can be graded."` | `"Seules les soumissions d'examen peuvent être notées."` |
| `"Grade must be a non-negative number."` | `"La note doit être un nombre positif ou nul."` |
| `"Grade cannot exceed the maximum of "` + max (template) | `"La note ne peut pas dépasser le maximum de "` + max |
| `"Exam resubmitted"` / `"Exam submitted"` | `"Examen re-soumis"` / `"Examen soumis"` |
| body fallback: `"A pupil"` / `"resubmitted"` / `"submitted"` / `"an exam"` | `"Un élève"` / `"re-soumis"` / `"soumis"` / `"un examen"` |
| `"Class not found."` | `"Classe introuvable."` |

- [ ] **Step 4: `server/src/services/pupil.service.ts` — 1 replacement in `PupilError` throw**

| Old | New |
|---|---|
| `"Not yet assigned to a class."` | `"Pas encore affecté à une classe."` |

- [ ] **Step 5: Run server test suite**

Run: `cd server && npm test`
Expected: PASS — no test asserts exact message text for these 4 files.

- [ ] **Step 6: Full-repo verification**

Run: `cd client && npx tsc --noEmit && npx vitest run` then `cd server && npx tsc --noEmit && npm test`
Expected: both client and server typecheck clean and all test suites pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/notification.service.ts server/src/utils/mailer.ts server/src/services/post.service.ts server/src/services/pupil.service.ts
git commit -m "feat(i18n): translate server notifications, emails, and post/pupil errors to French"
```

- [ ] **Step 8: Delete scratch plan-drafts directory**

The `.tmp-plan-drafts/` directory was scratch work used to draft this plan and must never ship. Run:

```bash
git status .tmp-plan-drafts/
```

Confirm it is untracked (not committed at any point), then:

```bash
rm -rf .tmp-plan-drafts/
```

This is a workspace cleanup step, not part of any git commit.

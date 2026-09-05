# French Localization — self-authored batch (centralization + server notifications/emails + authSchemas + post/pupil errors)

This batch covers the 4 areas reserved for direct authorship (not dispatched to a research
agent) because they required reading full source files anyway: the new centralized labels file,
`period.ts` date helpers, `authSchemas.ts` validation messages, `notification.service.ts` +
`mailer.ts` static copy, and the `post.service.ts` / `pupil.service.ts` client-visible errors gap
found during batch coordination (both files were outside every other batch's assigned scope, and
neither has a test file, confirmed via Glob).

**Ordering note:** the labels.ts / period.ts task MUST run before any task that imports from
`client/src/lib/labels.ts` or calls `formatDate` (i.e. before every other client-side batch in
this plan). It has no dependency on any other task.

---

### File: client/src/lib/labels.ts (NEW FILE)
Test file: none (new file, no existing test references `lib/labels`)

This file does not exist yet. Create it with exactly this content:

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

These 7 exported maps are the canonical label lookups every other batch in this plan imports
from (`import { X_LABELS } from "../../lib/labels";` or `"../lib/labels"` depending on file
depth). Every other task in this plan that references one of these 7 names depends on this
exact export list — do not rename any of them.

Structural changes: none (new file).

Test assertion updates: none.

---

### File: client/src/lib/period.ts
Test file: none found (no `period.test.*` under `client/src`)

Replace the entire file content with:

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

Changes from the current file: (1) `formatPeriodLabel`'s `toLocaleDateString(undefined, {...})`
call becomes `toLocaleDateString("fr-FR", {...})`; (2) a new exported `formatDate()` helper is
added — every other batch in this plan that currently calls bare
`new Date(x).toLocaleDateString(...)` replaces that call with `formatDate(x, ...)` (same
`options` argument, if any) and adds `formatDate` to its existing `"../lib/period"` /
`"../../lib/period"` import; (3) `DAY_NAMES` changes from
`["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]` to
`["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]`. `currentPeriod` and `shiftPeriod` are
unchanged (they never touch display text).

**Interfaces produced (for every other batch in this plan):**
- `formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string` — new export.
- `DAY_NAMES: string[]` — same name, now French values, index 0 = Sunday ("Dim") through index 6
  = Saturday ("Sam"), unchanged ordering.
- `formatPeriodLabel(period: string): string` — same signature, now renders e.g. `"septembre 2026"`
  instead of `"September 2026"`.

Structural changes: full-file replacement, see above.

Test assertion updates: none (no test file for `period.ts` itself; test files in other batches
that assert on `DAY_NAMES` or `formatPeriodLabel` output are covered in each of those batches).

---

### File: client/src/lib/authSchemas.ts
Test file: client/src/lib/authSchemas.test.ts (read in full — asserts only `.success`
true/false and `issues[...].path`, never asserts exact message text; no test assertion changes
needed in this file)

Replacements (exact old → new; `replace_all` noted where the identical string appears more than
once with the same translation each time):

1. `"Enter your full name."` → `"Entrez votre nom complet."` (line 5)
2. `"Email is required."` → `"L'e-mail est requis."` (line 6)
3. `"Enter a valid email address."` → `"Entrez une adresse e-mail valide."` (line 6)
4. `"Password must be at least 6 characters."` → `"Le mot de passe doit contenir au moins 6 caractères."` (line 7)
5. `"Confirm your password."` → `"Confirmez votre mot de passe."` (lines 14, 22, 32 — identical string, three occurrences, `replace_all`)
6. `"Enter a valid phone number."` → `"Entrez un numéro de téléphone valide."` (line 25)
7. `{ message: "Choose a class type." }` → `{ message: "Choisissez un type de classe." }` (line 33)
8. `"Enter your teacher's ID."` → `"Entrez l'identifiant de votre enseignant."` (line 34)
9. `"Passwords don't match."` → `"Les mots de passe ne correspondent pas."` (lines 42, 67 — identical string, two occurrences, `replace_all`)
10. `"Password is required."` → `"Le mot de passe est requis."` (line 50)
11. `"Enter your current password."` → `"Entrez votre mot de passe actuel."` (line 75)
12. `"Confirm your new password."` → `"Confirmez votre nouveau mot de passe."` (line 77)
13. `"New password must be different from your current password."` → `"Le nouveau mot de passe doit être différent de votre mot de passe actuel."` (line 84)

Structural changes: none — only the string literals inside `.min(...)`, `.email(...)`, `{ message: ... }`, and `.refine(..., { message: ... })` calls change; schema shapes, field names, and exported type names are unchanged.

Test assertion updates: none (confirmed above).

---

### File: server/src/services/notification.service.ts
Test file: none found (no `.test.ts`/`.spec.ts` references `notification.service`; the only
related file, `server/test-notifications.mjs`, is a dev/QA script excluded by spec §8 and left
untouched)

Replacements (exact old → new; each pair below appears twice in the file with byte-identical
text — once in `syncPaymentDueNotifications`, once in `syncPaymentDueNotificationsForParent` —
apply `replace_all` for both):

1. `title: overdue ? "Payment overdue" : "Payment due today",` → `title: overdue ? "Paiement en retard" : "Paiement dû aujourd'hui",` (lines 79 and 158)
2. `` body: `${record.pupil.user.name}'s payment for ${record.period} is ${overdue ? "overdue" : "due today"}.`, `` → `` body: `Le paiement de ${record.pupil.user.name} pour ${record.period} est ${overdue ? "en retard" : "dû aujourd'hui"}.`, `` (lines 80 and 159)

Single-occurrence replacements:

3. `title: "Monthly recap ready",` → `title: "Récapitulatif mensuel disponible",` (line 103)
4. `` body: `You achieved ${achieved} of ${goals.length} goals in ${finishedPeriod}.`, `` → `` body: `Vous avez atteint ${achieved} objectif(s) sur ${goals.length} pour ${finishedPeriod}.`, `` (line 104)
5. `title: "Missing submission",` → `title: "Soumission manquante",` (line 187)
6. `` body: `${pupil.user.name} hasn't submitted "${exam.content?.slice(0, 60) ?? "an exam"}" yet.`, `` → `` body: `${pupil.user.name} n'a pas encore soumis "${exam.content?.slice(0, 60) ?? "un examen"}".`, `` (line 188)

Not translated (per spec §1/§5): the fallback string `"an exam"` inside item 6 becomes `"un examen"` as shown (it's part of the static template, not user data); the pupil name, period string, and goal counts interpolated into every body above are user/data values and are left as-is (already correctly placed in the New column above — only the surrounding static words changed).

Structural changes: none.

Test assertion updates: none (confirmed above).

---

### File: server/src/utils/mailer.ts
Test file: none found (no `.test.ts`/`.spec.ts` references `mailer`)

Replacements (exact old → new):

1. `subject: "Reset your Bachandi password",` → `subject: "Réinitialisez votre mot de passe Bachandi",` (line 67 — "Bachandi" is the brand name, stays untranslated per spec §1)
2. `` text: `We received a request to reset your Bachandi password. This link expires in 1 hour:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`, `` → `` text: `Nous avons reçu une demande de réinitialisation de votre mot de passe Bachandi. Ce lien expire dans 1 heure :\n\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.`, `` (line 68)
3. `` html: `<p>We received a request to reset your Bachandi password. This link expires in 1 hour:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`, `` → `` html: `<p>Nous avons reçu une demande de réinitialisation de votre mot de passe Bachandi. Ce lien expire dans 1 heure :</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.</p>`, `` (line 69)
4. `subject: "Verify your Bachandi email address",` → `subject: "Vérifiez votre adresse e-mail Bachandi",` (line 81)
5. `` text: `Welcome to Bachandi! Please verify your email address. This link expires in 24 hours:\n\n${verifyUrl}\n\nIf you didn't create this account, you can safely ignore this email.`, `` → `` text: `Bienvenue sur Bachandi ! Veuillez vérifier votre adresse e-mail. Ce lien expire dans 24 heures :\n\n${verifyUrl}\n\nSi vous n'êtes pas à l'origine de la création de ce compte, vous pouvez ignorer cet e-mail en toute sécurité.`, `` (line 82)
6. `` html: `<p>Welcome to Bachandi! Please verify your email address. This link expires in 24 hours:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If you didn't create this account, you can safely ignore this email.</p>`, `` → `` html: `<p>Bienvenue sur Bachandi ! Veuillez vérifier votre adresse e-mail. Ce lien expire dans 24 heures :</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>Si vous n'êtes pas à l'origine de la création de ce compte, vous pouvez ignorer cet e-mail en toute sécurité.</p>`, `` (line 83)
7. `` text: `${body}${fullLink ? `\n\nView details: ${fullLink}` : ""}`, `` → `` text: `${body}${fullLink ? `\n\nVoir les détails : ${fullLink}` : ""}`, `` (line 104)
8. `` html: `<p>${body}</p>${fullLink ? `<p><a href="${fullLink}">View details</a></p>` : ""}`, `` → `` html: `<p>${body}</p>${fullLink ? `<p><a href="${fullLink}">Voir les détails</a></p>` : ""}`, `` (line 105)

Not translated (per spec §1/§8, internal/log-only, never reaches a client): `logLabel` parameter
values passed at each `sendMail(...)` call site (line 70's `` `Password reset link for ${to}:\n  ${resetUrl}` ``, line 84's `` `Verification link for ${to}:\n  ${verifyUrl}` ``, line 106's `` `Alert for ${to}: ${subject} — ${body}${fullLink ? ` (${fullLink})` : ""}` ``) — these only ever reach `console.warn` inside `sendMail` (line 25), never an HTTP response or UI. Also not translated: `subject: \`Bachandi: ${subject}\`` (line 103) — this is just the brand-name prefix plus an already-translated dynamic `subject` value passed in by the caller (`notification.service.ts`), no static English words to translate.

Structural changes: none.

Test assertion updates: none (confirmed above).

---

### File: server/src/services/post.service.ts
Test file: none found (confirmed via Glob — no `post.service.test.ts`)

Replacements (exact old → new):

1. `throw new PostError("Post not found.", 404);` → `throw new PostError("Publication introuvable.", 404);` (line 42)
2. `throw new PostError("Exam post not found.", 404);` → `throw new PostError("Examen introuvable.", 404);` (line 127)
3. `title: "New class post",` → `title: "Nouvelle publication",` (line 110)
4. `const kind = input.type === "EXAM" ? "a new exam" : input.type === "FILE" ? "a new file" : "a new post";` → `const kind = input.type === "EXAM" ? "un nouvel examen" : input.type === "FILE" ? "un nouveau fichier" : "une nouvelle publication";` (line 106)
5. `` body: `${pupil.user.name}'s teacher shared ${kind}${input.content ? `: "${input.content.slice(0, 60)}"` : "."}`, `` → `` body: `L'enseignant de ${pupil.user.name} a partagé ${kind}${input.content ? `: "${input.content.slice(0, 60)}"` : "."}`, `` (line 111)
6. `throw new PostError("Submission not found.", 404);` → `throw new PostError("Soumission introuvable.", 404);` (line 180)
7. `throw new PostError("Only exam submissions can be graded.", 400);` → `throw new PostError("Seules les soumissions d'examen peuvent être notées.", 400);` (line 182)
8. `throw new PostError("Grade must be a non-negative number.", 400);` → `throw new PostError("La note doit être un nombre positif ou nul.", 400);` (line 186)
9. `` throw new PostError(`Grade cannot exceed the maximum of ${submission.post.maxGrade}.`, 400); `` → `` throw new PostError(`La note ne peut pas dépasser le maximum de ${submission.post.maxGrade}.`, 400); `` (line 189)
10. `title: isResubmission ? "Exam resubmitted" : "Exam submitted",` → `title: isResubmission ? "Examen re-soumis" : "Examen soumis",` (line 160)
11. `` body: `${pupil?.user.name ?? "A pupil"} ${isResubmission ? "resubmitted" : "submitted"} "${post.content?.slice(0, 60) ?? "an exam"}".`, `` → `` body: `${pupil?.user.name ?? "Un élève"} a ${isResubmission ? "re-soumis" : "soumis"} "${post.content?.slice(0, 60) ?? "un examen"}".`, `` (lines 161–163)
12. `throw new PostError("Class not found.", 404);` → `throw new PostError("Classe introuvable.", 404);` (line 205)

Confirmed client-visible: `PostError` is imported and checked via `instanceof PostError` in both
`server/src/controllers/pupil.controller.ts` (line 3) and
`server/src/controllers/teacher.controller.ts` (lines ~28/49), where its `.message` is
serialized directly into the JSON error response sent to the client — these are genuine
user-facing error messages, not internal-only.

Structural changes: none.

Test assertion updates: none (confirmed above).

---

### File: server/src/services/pupil.service.ts
Test file: none found (confirmed via Glob — no `pupil.service.test.ts`)

Replacements (exact old → new):

1. `throw new PupilError("Not yet assigned to a class.", 404);` → `throw new PupilError("Pas encore affecté à une classe.", 404);` (line 47)

Confirmed client-visible: `PupilError` is imported and checked via `instanceof PupilError` in
`server/src/controllers/pupil.controller.ts` (line 6, `instanceof` check around line 22), where
its `.message` is serialized directly into the JSON error response.

Structural changes: none.

Test assertion updates: none (confirmed above).

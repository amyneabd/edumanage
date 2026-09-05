# French Localization — Batch Draft: client/src/features/pupil/*

Batch files (confirmed via Glob):
- `client/src/features/pupil/AttendancePage.tsx`
- `client/src/features/pupil/FeedPage.tsx`
- `client/src/features/pupil/GradesPage.tsx`
- `client/src/features/pupil/HomePage.tsx`
- `client/src/features/pupil/PaymentsPage.tsx`
- `client/src/features/pupil/SchedulePage.tsx`

Corresponding test files found under `client/src/features/pupil/`: only `SchedulePage.test.tsx` exists. No test file exists for AttendancePage, FeedPage, GradesPage, HomePage, or PaymentsPage (confirmed via glob for `*.test.tsx` in this directory).

Depends on centralization work (§3 of spec) landing first:
- `client/src/lib/labels.ts` (does not yet exist — must export `ATTENDANCE_DISPLAY_LABELS` and `CLASS_TYPE_LABELS` before this batch's imports resolve).
- `client/src/lib/period.ts` gets `DAY_NAMES` translated to French and gains an exported `formatDate(value, options?)` helper (file currently only has `currentPeriod`, `shiftPeriod`, `formatPeriodLabel`, `DAY_NAMES` — no `formatDate` yet).

---

### File: client/src/features/pupil/AttendancePage.tsx

**Structural changes:**
- Add `import { ATTENDANCE_DISPLAY_LABELS } from "../../lib/labels";` to the import block.
- Delete the local map entirely:
  ```ts
  const DISPLAY_LABELS: Record<AttendanceDay["display"], string> = {
    FUTURE: "Upcoming session",
    TODAY: "Today's session",
    PRESENT: "Present",
    ABSENT: "Absent",
    EXCUSED: "Excused",
    UNMARKED: "Not marked yet",
  };
  ```
- Replace the single usage site (tooltip `title` attribute) `DISPLAY_LABELS[cell.entry.display]` → `ATTENDANCE_DISPLAY_LABELS[cell.entry.display]`.
- Note: this changes the tooltip wording from the old bespoke English ("Upcoming session", "Today's session") to the centralized short labels ("À venir", "Aujourd'hui") — this is the intended effect of switching to the shared map, per the task's explicit instruction to replace `DISPLAY_LABELS` with `ATTENDANCE_DISPLAY_LABELS`.
- `DISPLAY_STYLES` (the color map) is untouched — it's CSS class values, not text.

**Replacements** (exact old → new):
- `"Attendance"` (h1) → `"Présences"`
- `"Your class"` (fallback for `data?.className`) → `"Votre classe"`
- `label="Attendance rate"` (StatCard) → `"Taux de présence"`
- `label="Present"` (StatCard) → `"Présent"`
- `label="Absent"` (StatCard) → `"Absent"`
- `title="Previous month"` (button) → `"Mois précédent"`
- `title="Next month"` (button) → `"Mois suivant"`
- `"Calendar"` (h2) → `"Calendrier"`
- `"You're not assigned to a class yet."` → `"Vous n'êtes pas encore affecté(e) à une classe."`
- `"No sessions scheduled for this class."` → `"Aucune séance programmée pour cette classe."`
- Legend line `Present ({stats.present})` → `Présent ({stats.present})`
- Legend line `Absent ({stats.absent})` → `Absent ({stats.absent})`
- Legend line `Excused ({stats.excused})` → `Excusé ({stats.excused})`
- Legend line `Not marked (\n{stats.unmarked})` (the JSX text is split across lines: `Not marked (` … `{stats.unmarked})`) → `Non marqué ({stats.unmarked})`
- Legend line `Upcoming ({stats.upcoming})` → `À venir ({stats.upcoming})`
- Legend line `Today` (last legend swatch, standalone) → `Aujourd'hui`

**Test assertion updates:** none — no test file exists for this page.

---

### File: client/src/features/pupil/FeedPage.tsx

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` to the import block.
- Replace the two bare `toLocaleDateString()` call sites with `formatDate(...)`:
  - `new Date(post.dueDate).toLocaleDateString()` → `formatDate(post.dueDate)`
  - `new Date(post.mySubmission.submittedAt).toLocaleDateString()` → `formatDate(post.mySubmission.submittedAt)`
- Note (flag for plan author, not auto-resolved here): this file also has two bare `toLocaleString()` calls (not `toLocaleDateString()`) — `new Date(post.editedAt).toLocaleString()` (line ~144, in the "Edited ..." tooltip) and `new Date(post.createdAt).toLocaleString()` (line ~151, post timestamp). The design spec's §3 enumerated conversion list and this task's instruction only cover `toLocaleDateString()`; these `toLocaleString()` sites are technically still browser-locale-dependent, which arguably conflicts with §4's "locale hardcoded to fr-FR regardless of browser" principle. Left unchanged pending a decision — `formatDate()` as specified only wraps `toLocaleDateString`, not `toLocaleString`.

**Replacements:**
- `TYPE_LABELS` map (local to this file, not centralized — `PostType` labels are not among the §3 centralized enum maps):
  - `TEXT: "Post"` → `TEXT: "Publication"`
  - `FILE: "File"` → `FILE: "Fichier"`
  - `EXAM: "Exam"` → `EXAM: "Examen"`
- `TYPE_FILTERS` labels:
  - `{ value: "ALL", label: "All" }` → `label: "Tous"`
  - `{ value: "TEXT", label: "Posts" }` → `label: "Publications"`
  - `{ value: "FILE", label: "Files" }` → `label: "Fichiers"`
  - `{ value: "EXAM", label: "Exams" }` → `label: "Examens"`
- `DueBadge` label ternary:
  - `"Overdue"` → `"En retard"`
  - `"Due today"` → `"À rendre aujourd'hui"`
  - `"Due tomorrow"` → `"À rendre demain"`
  - `` `Due in ${diff}d` `` → `` `À rendre dans ${diff} j` ``
- `toast.success("Exam submitted.")` → `toast.success("Examen soumis.")`
- `mutation.isPending ? "Submitting…" : "Submit"` → `mutation.isPending ? "Soumission en cours…" : "Soumettre"`
- `"Class feed"` (h1) → `"Publications de la classe"`
- `placeholder="Search posts…"` → `"Rechercher des publications…"`
- `<EmptyState title="No posts yet" description="Your teacher hasn't posted anything." />` → `title="Aucune publication pour le moment"` `description="Votre enseignant n'a encore rien publié."`
- `<EmptyState title="No posts match your filters" />` → `title="Aucune publication ne correspond à vos filtres"`
- Template literal `` `Edited ${new Date(post.editedAt).toLocaleString()}` `` (title attr) → `` `Modifié le ${new Date(post.editedAt).toLocaleString()}` `` (only the word "Edited" translates; see structural-changes note above re: the date call itself)
- Visible text `· edited` → `· modifié`
- `Due {new Date(post.dueDate).toLocaleDateString()}` → `À rendre le {formatDate(post.dueDate)}`
- `Submitted: {post.mySubmission.fileName} on{" "}` … `{new Date(post.mySubmission.submittedAt).toLocaleDateString()}` (renders as "Submitted: <file> on <date>") → `Soumis : {post.mySubmission.fileName} le{" "}` … `{formatDate(post.mySubmission.submittedAt)}` (renders as "Soumis : <file> le <date>")
- `"Awaiting grade"` → `"En attente de note"`

**Test assertion updates:** none — no test file exists for this page.

---

### File: client/src/features/pupil/GradesPage.tsx

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` to the import block.
- Replace the one bare `toLocaleDateString()` call site:
  - `new Date(g.gradedAt).toLocaleDateString()` → `formatDate(g.gradedAt)`

**Replacements:**
- `"Grades"` (h1) → `"Notes"`
- `"Your exam results and teacher feedback."` → `"Vos résultats d'examens et les retours de votre enseignant."`
- `label="Average score"` (StatCard) → `"Moyenne"`
- `label="Graded exams"` (StatCard) → `"Examens notés"`
- `label="Awaiting grade"` (StatCard) → `"En attente de note"`
- `"Graded exams"` (h2) → `"Examens notés"`
- `<EmptyState title="No grades yet" description="Your submitted exams will show grades here once your teacher reviews them." />` → `title="Aucune note pour le moment"` `description="Vos examens soumis afficheront une note ici une fois que votre enseignant les aura corrigés."`
- `g.examTitle ?? "Exam"` (fallback) → `g.examTitle ?? "Examen"`
- ` · Graded {new Date(g.gradedAt).toLocaleDateString()}` (renders as "· Graded <date>") → ` · Noté le {formatDate(g.gradedAt)}` (renders as "· Noté le <date>")

**Test assertion updates:** none — no test file exists for this page.

---

### File: client/src/features/pupil/HomePage.tsx

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` to the import block (alongside the existing `import { DAY_NAMES } from "../../lib/period";`).
- Replace three bare `toLocaleDateString()` call sites:
  - `` `Due ${new Date(e.dueDate).toLocaleDateString()}` `` → `` `À rendre le ${formatDate(e.dueDate)}` ``
  - `Due {new Date(payment.dueDate).toLocaleDateString()}` → `Échéance le {formatDate(payment.dueDate)}`
  - `{new Date(p.createdAt).toLocaleDateString()}` → `{formatDate(p.createdAt)}`
- Note: this file's local `TYPE_LABELS` (for `PostType`) is a near-duplicate of the one in `FeedPage.tsx`. Per §3, only the enums explicitly listed there (`ATTENDANCE_DISPLAY_LABELS` etc.) are centralized; `PostType` labels are not in that list, so this map stays local to `HomePage.tsx` and is translated in place (same values as FeedPage's, kept in sync manually).

**Replacements:**
- `TYPE_LABELS` map:
  - `TEXT: "Post"` → `TEXT: "Publication"`
  - `FILE: "File"` → `FILE: "Fichier"`
  - `EXAM: "Exam"` → `EXAM: "Examen"`
- `` `Welcome back${firstName ? `, ${firstName}` : ""}` `` (h1) → `` `Ravi de vous revoir${firstName ? `, ${firstName}` : ""}` ``
- `{data.className} with {data.teacherName}` → `{data.className} avec {data.teacherName}`
- `label="Attendance rate"` (StatCard) → `"Taux de présence"`
- `` hint={`${attendance.present} present · ${attendance.absent} absent this month`} `` → `` hint={`${attendance.present} présent · ${attendance.absent} absent ce mois-ci`} ``
- `label="Next session"` (StatCard) → `"Prochaine séance"`
- Hint ternary: `"Today"` → `"Aujourd'hui"`; `"Tomorrow"` → `"Demain"`; `` `In ${nextSession.daysUntil} days` `` → `` `Dans ${nextSession.daysUntil} jours` ``
- `"No schedule set yet"` (hint fallback) → `"Aucun emploi du temps défini pour l'instant"`
- `label="Pending exams"` (StatCard) → `"Examens en attente"`
- Hint ternary: `` `${overdueCount} overdue` `` → `` `${overdueCount} en retard` ``; `"Due soon"` → `"À rendre bientôt"`; `"All caught up"` → `"Tout est à jour"`
- `label="Payment status"` (StatCard) → `"Statut du paiement"`
- Value ternary: `"Paid"` → `"Payé"`; `"Partial"` → `"Partiel"`; `"Unpaid"` → `"Non payé"`
- Hint ternary: `` `${formatCurrency(payment.amountPaid)} settled` `` → `` `${formatCurrency(payment.amountPaid)} réglé` `` (the else-branch `"${amountPaid} / ${amountDue}"` has no literal text to translate)
- `"Action needed"` (h2) → `"Action requise"`
- `"Go to feed →"` (link) → `"Aller aux publications →"`
- `e.content || "Exam submission"` (fallback) → `e.content || "Soumission d'examen"`
- Badge ternary: `"Overdue"` → `"En retard"`; `` `Due ${...}` `` → `` `À rendre le ${formatDate(e.dueDate)}` `` (see structural changes); `"No due date"` → `"Aucune date d'échéance"`
- `` `Payment (${payment.period})` `` (h2) → `` `Paiement (${payment.period})` ``
- `"View history →"` (link) → `"Voir l'historique →"`
- `Due {formatDate(payment.dueDate)}` (see structural changes) → `Échéance le {formatDate(payment.dueDate)}`
- `{formatCurrency(payment.amountPaid)} paid of {formatCurrency(payment.amountDue)}` → `{formatCurrency(payment.amountPaid)} payé sur {formatCurrency(payment.amountDue)}`
- `"Attendance"` (h2) → `"Présences"`
- `"View calendar →"` (link) → `"Voir le calendrier →"`
- `{attendance.present} present, {attendance.absent} absent, {attendance.unmarked} not yet marked this month.` → `{attendance.present} présent, {attendance.absent} absent, {attendance.unmarked} non marqué ce mois-ci.`
- `"Latest from your class"` (h2) → `"Dernières publications de votre classe"`
- `"View all →"` (link) → `"Voir tout →"`
- `<EmptyState title="No posts yet" />` → `title="Aucune publication pour le moment"`
- `"Parent Code"` (h2) → `"Code parent"`
- `"Share this with a parent so they can request to follow your progress."` → `"Partagez ce code avec un parent afin qu'il puisse demander à suivre votre progression."`
- Button text ternary: `"Copied!"` → `"Copié !"`; `"Copy"` → `"Copier"`

**Test assertion updates:** none — no test file exists for this page.

---

### File: client/src/features/pupil/PaymentsPage.tsx

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` to the import block (alongside the existing `import { currentPeriod, formatPeriodLabel } from "../../lib/period";`).
- Replace the one bare `toLocaleDateString()` call site:
  - `entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "—"` → `entry.dueDate ? formatDate(entry.dueDate) : "—"`

**Replacements:**
- `"Payments"` (h1) → `"Paiements"`
- `"Your tuition payment status and history."` → `"Le statut et l'historique de vos paiements de scolarité."`
- `"This month"` (Card label) → `"Ce mois-ci"`
- `"No record yet"` → `"Aucun enregistrement pour le moment"`
- `label="Total paid"` (StatCard) → `"Total payé"`
- `label="Overdue periods"` (StatCard) → `"Périodes en retard"`
- `"History"` (h2) → `"Historique"`
- `<EmptyState title="No payment records yet" description="Your teacher hasn't recorded any payments yet." />` → `title="Aucun paiement enregistré"` `description="Votre enseignant n'a encore enregistré aucun paiement."`
- Table header `"Period"` → `"Période"`
- Table header `"Status"` → `"Statut"`
- Table header `"Paid / Due"` → `"Payé / Dû"`
- Table header `"Due date"` → `"Date d'échéance"`
- Inline text `overdue` (next to `PaymentBadge`, lowercase, standalone span) → `en retard`
- `"—"` (em-dash placeholder when no due date) — unchanged, not translatable text

**Test assertion updates:** none — no test file exists for this page.

---

### File: client/src/features/pupil/SchedulePage.tsx

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` to the import block (alongside the existing `import { DAY_NAMES } from "../../lib/period";`).
- Add `import { CLASS_TYPE_LABELS } from "../../lib/labels";` to the import block.
- In the target-class `<select>`, the option text currently renders the raw enum value: `{c.name} ({c.type})`. Since `c.type` (`ClassType`) is rendered directly as client-visible text (not just used as a logic value), replace with the centralized label: `{c.name} ({CLASS_TYPE_LABELS[c.type]})`.
- Replace the two `toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })` call sites with `formatDate(..., { weekday: "short", month: "short", day: "numeric" })`:
  - `new Date(r.targetDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })` → `formatDate(r.targetDate, { weekday: "short", month: "short", day: "numeric" })`
  - `new Date(r.originDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })` → `formatDate(r.originDate, { weekday: "short", month: "short", day: "numeric" })`

**Replacements:**
- `toast.success("Swap request sent.")` → `toast.success("Demande d'échange envoyée.")`
- `<EmptyState title="No other classes to join" description="Your teacher only has the class you're already enrolled in." />` → `title="Aucune autre classe à rejoindre"` `description="Votre enseignant ne propose que la classe où vous êtes déjà inscrit(e)."`
- `label htmlFor="swap-request-origin-date"` text `"Session you'll miss"` → `"Séance que vous allez manquer"`
- `label htmlFor="swap-request-target-class"` text `"Class to join"` → `"Classe à rejoindre"`
- Option text `{c.name} ({c.type})` → `{c.name} ({CLASS_TYPE_LABELS[c.type]})` (see structural changes — value changes from raw enum to French label)
- `"No schedule set for this class yet."` → `"Aucun emploi du temps défini pour cette classe."`
- `` `Meets: ${selectedClass.scheduleSlots...join(", ")}` `` → `` `Horaires : ${selectedClass.scheduleSlots...join(", ")}` `` (only the leading "Meets:" literal translates; the day/time values inside the template come from `DAY_NAMES`, already French via centralization, and raw `HH:mm` strings, unchanged per §4)
- `label htmlFor="swap-request-target-date"` text `"Date to attend"` → `"Date à laquelle assister"`
- `label htmlFor="swap-request-reason"` text `"Reason (optional)"` → `"Motif (optionnel)"`
- `placeholder="e.g. I'll be away from my usual class that day."` → `"ex. : je serai absent(e) de ma classe habituelle ce jour-là."`
- Button text: `mutation.isPending ? "Sending…" : "Request swap"` → `mutation.isPending ? "Envoi…" : "Demander un échange"`
- `<EmptyState title="No swap requests yet" description="Requests you send will show up here." />` → `title="Aucune demande d'échange pour le moment"` `description="Les demandes que vous envoyez s'afficheront ici."`
- `instead of {r.originClassName} on{" "}` … `{new Date(r.originDate).toLocaleDateString(...)}` (renders "instead of <class> on <date>") → `à la place de {r.originClassName} le{" "}` … `{formatDate(r.originDate, {...})}` (renders "à la place de <class> le <date>")
- Cancel button text `"Cancel"` → `"Annuler"`
- `"Schedule"` (h1) → `"Emploi du temps"`
- `"Swap a session"` (h2) → `"Échanger une séance"`
- `"Need to swap your usual class for a different one on a particular day? Request it here."` → `"Besoin d'échanger votre classe habituelle contre une autre à une date précise ? Faites votre demande ici."`
- `"My swap requests"` (h2) → `"Mes demandes d'échange"`

**Test assertion updates** (`client/src/features/pupil/SchedulePage.test.tsx`):
- `screen.getByLabelText(/session you'll miss/i)` → `screen.getByLabelText(/séance que vous allez manquer/i)`
- `screen.getByLabelText(/class to join/i)` → `screen.getByLabelText(/classe à rejoindre/i)`
- `screen.getByLabelText(/date to attend/i)` → `screen.getByLabelText(/date à laquelle assister/i)`
- `screen.getByRole("button", { name: /request swap/i })` → `screen.getByRole("button", { name: /demander un échange/i })`
- `expect(screen.getByText("Pending")).toBeInTheDocument();` → `expect(screen.getByText("En attente")).toBeInTheDocument();`
  - Note: `"Pending"` here is rendered by `<SwapStatusBadge status={r.status} />` (from `client/src/components/Badge.tsx`), not by `SchedulePage.tsx` itself. Its label comes from that component's own `swapStatusLabels`/future `SWAP_REQUEST_STATUS_LABELS` map, which is out of this batch's file scope but will change to `"En attente"` per the glossary (SwapRequestStatus PENDING → "En attente") when `Badge.tsx` is translated. This test assertion must be updated in lockstep with that change, since it lives in this batch's test file even though the source string doesn't live in this batch's page file.
  - `screen.getByText(/Other Class/)` and `screen.getByText("Other Class")` — unchanged; `"Other Class"`/`"My Class"` are mock class names (user/test data), not app copy.
  - Mock data field values (`"weekly"`, `"MATH"`, IDs, ISO dates, etc.) — unchanged, not client-visible display text, just test fixture values.

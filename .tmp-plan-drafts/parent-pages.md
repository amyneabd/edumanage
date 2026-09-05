# French Localization — Draft Plan Section: `client/src/features/parent/*`

Batch: AttendancePage.tsx, ChildSwitcher.tsx, FeedPage.tsx, GradesPage.tsx, HomePage.tsx, LedgerPage.tsx, PaymentsPage.tsx, SchedulePage.tsx, useSelectedChild.ts

No `*.test.tsx` (or any other test) files exist for any of these 8 components/hooks (confirmed via glob across the repo — only `client/src/features/pupil/SchedulePage.test.tsx` exists, which is a different feature area and out of this batch). Every "Test assertion updates" section below is therefore empty by inspection, not by omission.

A shared empty-state block (`EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started."`) is repeated verbatim in all 7 page files (every file except `useSelectedChild.ts`). Canonical translation, used identically everywhere it appears:
- `"No linked children yet"` → `"Aucun enfant associé pour le moment"`
- `"Add a child using their Parent Code to get started."` → `"Ajoutez un enfant à l'aide de son code parent pour commencer."`

---

### File: client/src/features/parent/AttendancePage.tsx

**Replacements:**
- `<h1 ...>Attendance</h1>` → `Présences`
- `EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started."` → `title="Aucun enfant associé pour le moment" description="Ajoutez un enfant à l'aide de son code parent pour commencer."`
- `data?.className ?? "Class"` → `data?.className ?? "Classe"`
- `<StatCard label="Attendance rate" ...>` → `label="Taux de présence"`
- `<StatCard label="Present" ...>` (the "Present" stat card) → `label="Présent"`
- `<StatCard label="Absent" ...>` → `label="Absent"` (identical spelling in French — no textual change, keep as-is)
- `title="Previous month"` → `title="Mois précédent"`
- `title="Next month"` → `title="Mois suivant"`
- `<h2 ...>Calendar</h2>` → `Calendrier`
- `<p ...>Not assigned to a class yet.</p>` → `Pas encore affecté à une classe.`
- `<p ...>No sessions scheduled for this class.</p>` → `Aucune séance programmée pour cette classe.`
- Legend line `<span .../> Present ({stats.present})` → text node `Present (` → `Présent (`
- Legend line `<span .../> Absent ({stats.absent})` → text node `Absent (` stays `Absent (` (no change, identical word)
- Legend line `<span .../> Excused ({stats.excused})` → text node `Excused (` → `Excusé (`
- Legend line `<span .../> Not marked ({stats.unmarked})` → text node `Not marked (` → `Non marqué (`
- Legend line `<span .../> Upcoming ({stats.upcoming})` → text node `Upcoming (` → `À venir (`
- Legend line `<span .../> Today` → text node `Today` → `Aujourd'hui`
- `DISPLAY_LABELS` map values (see Structural changes — map itself is removed and replaced by the centralized `ATTENDANCE_DISPLAY_LABELS`, which supplies): `FUTURE: "À venir"`, `TODAY: "Aujourd'hui"`, `PRESENT: "Présent"`, `ABSENT: "Absent"`, `EXCUSED: "Excusé"`, `UNMARKED: "Non marqué"` (these replace the current local values `"Upcoming session"`, `"Today's session"`, `"Present"`, `"Absent"`, `"Excused"`, `"Not marked yet"` used in the grid-cell `title` tooltip)

**Structural changes:**
- Remove the local `DISPLAY_LABELS` constant (lines 44–51). Add `import { ATTENDANCE_DISPLAY_LABELS } from "../../lib/labels";` and use `ATTENDANCE_DISPLAY_LABELS[cell.entry.display]` in place of `DISPLAY_LABELS[cell.entry.display]` inside the grid-cell `title` template (`` `${cell.entry.startTime}–${cell.entry.endTime} · ${ATTENDANCE_DISPLAY_LABELS[cell.entry.display]}` ``). `DISPLAY_STYLES` (the color-class map) is unaffected — it holds Tailwind classes, not text.
- No bare `toLocaleDateString()` calls in this file — date display goes through `formatPeriodLabel` (already covered by the centralized `period.ts` change) and `DAY_NAMES`. No local change needed here beyond what centralization already provides.

**Test assertion updates:**
- None — no test file exists for this component.

---

### File: client/src/features/parent/ChildSwitcher.tsx

**Replacements:**
- `toast.success("Link request sent — waiting on the teacher's approval.")` → `toast.success("Demande de liaison envoyée — en attente de l'approbation de l'enseignant.")`
- `<Modal ... title="Link a child">` → `title="Associer un enfant"`
- `<label htmlFor="add-child-parent-code" ...>Parent Code</label>` → `Code parent`
- `placeholder="e.g. PFBV9U"` → `placeholder="ex. PFBV9U"`
- `<p ...>Ask your child for their Parent Code, shown on their Home page.</p>` → `Demandez à votre enfant son code parent, affiché sur sa page d'accueil.`
- `{mutation.isPending ? "Sending request…" : "Send request"}` → `{mutation.isPending ? "Envoi de la demande…" : "Envoyer la demande"}`
- Button text `Add a child` (next to the `Plus` icon) → `Ajouter un enfant`
- `<p ...>Link requests</p>` → `Demandes de liaison`
- `{l.status === "PENDING" ? "Awaiting teacher approval" : "Declined"}` → `{l.status === "PENDING" ? "En attente de l'approbation de l'enseignant" : "Refusée"}`

**Structural changes:**
- None. `linkStatusColors` is a styling-only `Record<string, string>` keyed by raw status values (`PENDING`/`ACTIVE`/`REJECTED`) mapped to Tailwind classes — not a text label map, so it is not a centralization candidate and is left untouched.
- No bare `toLocaleDateString()` calls in this file.

**Test assertion updates:**
- None — no test file exists for this component.

---

### File: client/src/features/parent/FeedPage.tsx

**Replacements:**
- `TYPE_LABELS: Record<PostType, string> = { TEXT: "Post", FILE: "File", EXAM: "Exam" }` → `{ TEXT: "Publication", FILE: "Fichier", EXAM: "Examen" }`
- `TYPE_FILTERS` labels: `"All"` → `"Tous"`, `"Posts"` → `"Publications"`, `"Files"` → `"Fichiers"`, `"Exams"` → `"Examens"`
- `<h1 ...>Class feed</h1>` → `Publications de la classe`
- `EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started."` → shared translation (see top)
- `placeholder="Search posts…"` → `placeholder="Rechercher des publications…"`
- `DueBadge` label logic: `overdue ? "Overdue" : diff === 0 ? "Due today" : diff === 1 ? "Due tomorrow" : \`Due in ${diff}d\`` → `overdue ? "En retard" : diff === 0 ? "À rendre aujourd'hui" : diff === 1 ? "À rendre demain" : \`À rendre dans ${diff} j\``
- `EmptyState title="No posts yet" description="The teacher hasn't posted anything."` → `title="Aucune publication pour le moment" description="L'enseignant n'a encore rien publié."`
- `EmptyState title="No posts match your filters"` → `title="Aucune publication ne correspond à vos filtres"`
- text node `· edited` (next to the edited-post marker) → `· modifié`
- `title={\`Edited ${new Date(post.editedAt).toLocaleString()}\`}` → `title={\`Modifié ${new Date(post.editedAt).toLocaleString()}\`}` (only the static word `Edited` translates; the `toLocaleString()` call itself is left as-is — it is not in the `toLocaleDateString` scope covered by `formatDate()`)
- `<p ...>Due {new Date(post.dueDate).toLocaleDateString()}</p>` → `<p ...>Échéance {formatDate(post.dueDate)}</p>`
- `Submitted: {post.mySubmission.fileName} on {new Date(post.mySubmission.submittedAt).toLocaleDateString()}` → `Soumis : {post.mySubmission.fileName} le {formatDate(post.mySubmission.submittedAt)}`
- `<p ...>Awaiting grade</p>` → `En attente de note`
- `<p ...>Not yet submitted</p>` → `Pas encore soumis`

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` and replace the two bare `toLocaleDateString()` call sites (post due date, submission date) with `formatDate(...)`.
- Leave the two `toLocaleString()` call sites (`post.editedAt`, `post.createdAt` — the latter rendered as `{new Date(post.createdAt).toLocaleString()}` with no other static text around it, so nothing to translate there) unchanged — per spec §3/§5, only `toLocaleDateString()` sites are in scope for the `formatDate()` swap.
- `TYPE_LABELS` stays a local `Record<PostType, string>` in this file — it is not one of the enums centralized in `client/src/lib/labels.ts` (§3 list has no `POST_TYPE_LABELS`), so only its string values are translated in place; no import change.

**Test assertion updates:**
- None — no test file exists for this component.

---

### File: client/src/features/parent/GradesPage.tsx

**Replacements:**
- `<h1 ...>Grades</h1>` → `Notes`
- `EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started."` → shared translation (see top)
- `<p ...>Exam results and teacher feedback.</p>` → `Résultats des examens et retours de l'enseignant.`
- `<StatCard label="Average score" ...>` → `label="Moyenne"`
- `<StatCard label="Graded exams" ...>` → `label="Examens corrigés"`
- `<StatCard label="Awaiting grade" ...>` → `label="En attente de note"`
- `<h2 ...>Graded exams</h2>` → `Examens corrigés`
- `EmptyState title="No grades yet" description="Submitted exams will show grades here once the teacher reviews them."` → `title="Aucune note pour le moment" description="Les notes des examens soumis s'afficheront ici une fois que l'enseignant les aura corrigés."`
- `g.examTitle ?? "Exam"` → `g.examTitle ?? "Examen"`
- `<span> · Graded {new Date(g.gradedAt).toLocaleDateString()}</span>` → `<span> · Corrigé le {formatDate(g.gradedAt)}</span>`

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` and replace the single bare `toLocaleDateString()` call site (`g.gradedAt`) with `formatDate(g.gradedAt)`.
- The quoted feedback text `"{g.feedback}"` is user-generated content — not translated, left as-is (surrounding straight quotes `"..."` are punctuation, not translatable copy).

**Test assertion updates:**
- None — no test file exists for this component.

---

### File: client/src/features/parent/HomePage.tsx

**Replacements:**
- `TYPE_LABELS: Record<string, string> = { TEXT: "Post", FILE: "File", EXAM: "Exam" }` → `{ TEXT: "Publication", FILE: "Fichier", EXAM: "Examen" }`
- `<h1 ...>Your children</h1>` → `Vos enfants`
- `EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started."` → shared translation (see top)
- `<StatCard label="Attendance rate" ...>` → `label="Taux de présence"`
- `hint={\`${attendance.present} present · ${attendance.absent} absent this month\`}` → `hint={\`${attendance.present} présent · ${attendance.absent} absent ce mois-ci\`}`
- `<StatCard label="Next session" ...>` → `label="Prochaine séance"`
- hint ternary `nextSession.daysUntil === 0 ? "Today" : nextSession.daysUntil === 1 ? "Tomorrow" : \`In ${nextSession.daysUntil} days\`` → `"Aujourd'hui" : "Demain" : \`Dans ${nextSession.daysUntil} jours\``
- `: "No schedule set yet"` (fallback when there is no `nextSession`) → `: "Aucun horaire défini pour le moment"`
- `<StatCard label="Pending exams" ...>` → `label="Examens en attente"`
- hint `overdueCount > 0 ? \`${overdueCount} overdue\` : upcomingExams.length > 0 ? "Due soon" : "All caught up"` → `\`${overdueCount} en retard\` : "À rendre bientôt" : "Tout est à jour"`
- `<StatCard label="Payment status" ...>` → `label="Statut de paiement"`
- value ternary `payment.status === "PAID" ? "Paid" : payment.status === "INCOMPLETE" ? "Partial" : "Unpaid"` → replaced entirely by `PAYMENT_STATUS_LABELS[payment.status]` (see Structural changes) — resulting displayed values: `"Payé"`, `"Incomplet"`, `"Non payé"` (note: `"Incomplet"` replaces the previous bespoke wording `"Partial"` to stay consistent with the canonical `PaymentStatus` glossary)
- `<h2 ...>Action needed</h2>` → `Action requise`
- `<Link ...>Go to feed →</Link>` → `Aller aux publications →`
- `e.content || "Exam submission"` → `e.content || "Soumission d'examen"`
- status span ternary: `e.isOverdue ? "Overdue" : \`Due ${new Date(e.dueDate).toLocaleDateString()}\`` → `e.isOverdue ? "En retard" : \`Échéance ${formatDate(e.dueDate)}\``, and its outer fallback `: "No due date"` → `: "Aucune date d'échéance"`
- `<h2 ...>Payment ({payment.period})</h2>` → `Paiement ({payment.period})` (only the word `Payment` translates; `payment.period` is raw data, left untouched)
- `<Link ...>View history →</Link>` → `Voir l'historique →`
- `<span ...>Due {new Date(payment.dueDate).toLocaleDateString()}</span>` → `<span ...>Échéance {formatDate(payment.dueDate)}</span>`
- `<p ...>{formatCurrency(payment.amountPaid)} paid of {formatCurrency(payment.amountDue)}</p>` → `{formatCurrency(payment.amountPaid)} payé sur {formatCurrency(payment.amountDue)}`
- `<h2 ...>Attendance</h2>` → `Présences`
- `<Link ...>View calendar →</Link>` → `Voir le calendrier →`
- `<p ...>{attendance.present} present, {attendance.absent} absent, {attendance.unmarked} not yet marked this month.</p>` → `{attendance.present} présent, {attendance.absent} absent, {attendance.unmarked} non marqué ce mois-ci.`
- `<h2 ...>Latest from the class</h2>` → `Dernières publications de la classe`
- `<Link ...>View all →</Link>` → `Voir tout →`
- `EmptyState title="No posts yet"` → `title="Aucune publication pour le moment"`
- `{new Date(p.createdAt).toLocaleDateString()}` (recent-posts list) → `{formatDate(p.createdAt)}`

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` and replace all three bare `toLocaleDateString()` call sites (`e.dueDate`, `payment.dueDate`, `p.createdAt`) with `formatDate(...)`.
- Add `import { PAYMENT_STATUS_LABELS } from "../../lib/labels";` and replace the inline `payment.status === "PAID" ? ... : ...` ternary (used only for the "Payment status" `StatCard` value) with `PAYMENT_STATUS_LABELS[payment.status]`. This is the file the design spec calls out under §3 ("`HomePage.tsx` in pupil/parent" switches an inline status map to the centralized import).
- `TYPE_LABELS` (post type) stays local, same rationale as `FeedPage.tsx` — no centralized `POST_TYPE_LABELS` exists per §3.

**Test assertion updates:**
- None — no test file exists for this component.

---

### File: client/src/features/parent/LedgerPage.tsx

No inline `STATUS_LABELS` map was found in this file — payment status is rendered via the shared `<PaymentBadge status={row.status} />` component (imported from `../../components/Badge`), which is out of this batch's scope and centralizes its own label lookup elsewhere.

**Replacements:**
- `<h1 ...>Ledger</h1>` → `Registre`
- `EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started."` → shared translation (see top)
- `<p ...>Full attendance and payment history, period by period.</p>` → `Historique complet des présences et paiements, période par période.`
- Balance banner ternary:
  - `` `Owes ${formatCurrency(balance)} overall` `` → `` `Doit ${formatCurrency(balance)} au total` ``
  - `` `${formatCurrency(Math.abs(balance))} credit (paid in advance)` `` → `` `${formatCurrency(Math.abs(balance))} de crédit (payé d'avance)` ``
  - `` ` — about ${sessionsInAdvance} session${sessionsInAdvance === 1 ? "" : "s"} ahead` `` → `` ` — environ ${sessionsInAdvance} séance${sessionsInAdvance === 1 ? "" : "s"} d'avance` `` (hand-translated plural, same shape as the existing English pattern per spec §8/non-goals)
  - `"All settled"` → `"Tout est réglé"`
- `<h2 ...>History</h2>` → `Historique`
- `EmptyState title="No ledger records yet" description="The teacher hasn't recorded any attendance or payments yet."` → `title="Aucun enregistrement dans le registre pour le moment" description="L'enseignant n'a encore enregistré aucune présence ni aucun paiement."`
- Table header `<th ...>Period</th>` → `Période`
- Table header `<th ...>Present</th>` → `Présent`
- Table header `<th ...>Absent</th>` → `Absent` (unchanged, identical word)
- Table header `<th ...>Status</th>` → `Statut`
- Table header `<th ...>Paid / Due</th>` → `Payé / Dû`
- Table header `<th ...>Due date</th>` → `Date d'échéance`
- `{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "—"}` → `{row.dueDate ? formatDate(row.dueDate) : "—"}`

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` and replace the single bare `toLocaleDateString()` call site (`row.dueDate`) with `formatDate(row.dueDate)`.

**Test assertion updates:**
- None — no test file exists for this component.

---

### File: client/src/features/parent/PaymentsPage.tsx

**Replacements:**
- `<h1 ...>Payments</h1>` → `Paiements`
- `EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started."` → shared translation (see top)
- `<p ...>Tuition payment status and history.</p>` → `Statut et historique des paiements de scolarité.`
- `<p ...>This month</p>` → `Ce mois-ci`
- `<p ...>No record yet</p>` → `Aucun enregistrement pour le moment`
- `<StatCard label="Total paid" ...>` → `label="Total payé"`
- `<StatCard label="Overdue periods" ...>` → `label="Périodes en retard"`
- `<h2 ...>History</h2>` → `Historique`
- `EmptyState title="No payment records yet" description="The teacher hasn't recorded any payments yet."` → `title="Aucun paiement enregistré pour le moment" description="L'enseignant n'a encore enregistré aucun paiement."`
- Table header `<th ...>Period</th>` → `Période`
- Table header `<th ...>Status</th>` → `Statut`
- Table header `<th ...>Paid / Due</th>` → `Payé / Dû`
- Table header `<th ...>Due date</th>` → `Date d'échéance`
- `<span ...>overdue</span>` (inline marker next to `PaymentBadge` when `entry.isOverdue`) → `en retard`
- `{entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "—"}` → `{entry.dueDate ? formatDate(entry.dueDate) : "—"}`

**Structural changes:**
- Add `import { formatDate } from "../../lib/period";` and replace the single bare `toLocaleDateString()` call site (`entry.dueDate`) with `formatDate(entry.dueDate)`.

**Test assertion updates:**
- None — no test file exists for this component.

---

### File: client/src/features/parent/SchedulePage.tsx

**Replacements:**
- `<h1 ...>Schedule</h1>` → `Emploi du temps`
- `EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started."` → shared translation (see top)

**Structural changes:**
- None. `data.className` is raw server data (not a static string) and `<ScheduleView data={data} />` is a shared component out of this batch's scope. No bare `toLocaleDateString()` calls in this file.

**Test assertion updates:**
- None — no test file exists for this component.

---

### File: client/src/features/parent/useSelectedChild.ts — no user-visible text, no changes needed.

Verified by full read: this hook only manages `localStorage` persistence (`STORAGE_KEY = "edumanage:selectedChildId"`, an internal storage key, not user-visible) and query state; it renders nothing and contains no strings shown to a user. The one comment block (lines 7–11) is a code comment, out of scope per spec §1/§6.

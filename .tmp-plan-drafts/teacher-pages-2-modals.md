# French Localization — Draft Section: teacher pages/modals batch 2

Files covered (all under `client/src/features/teacher/`):
GradebookPage.tsx, LedgerPage.tsx, OverviewPage.tsx, PaymentHealthCard.tsx, RecentActivityCard.tsx,
UpcomingSchedule.tsx, PupilContactModal.tsx, PupilDetailModal.tsx, PupilLedgerModal.tsx.

No `pages/`/`components/` subfolders exist for this feature — all files live flat under `client/src/features/teacher/`.

---

### File: client/src/features/teacher/GradebookPage.tsx

**Replacements:**

- Line 38, `truncate()` fallback: `return "Exam";` → `return "Examen";`
  (this fallback feeds the chart bar name, the table column header title, and the CSV export column labels — all client-visible.)
- Line 43, CSV header array (literal, exact array): `const header = ["Pupil", "Email", ...examLabels, "Average %"];` → `const header = ["Élève", "Email", ...examLabels, "Moyenne %"];`
  - "Pupil" → "Élève"
  - "Email" stays "Email" (per glossary judgment call — proper technical term used as-is in French business software)
  - `examLabels` entries are exam content typed by the teacher (user-generated) — not translated
  - "Average %" → "Moyenne %"
- Line 48, CSV cell value: `g.submitted ? "Ungraded" : "—"` → `g.submitted ? "Non noté" : "—"` (mirrors the on-screen badge text below, so the CSV and the UI stay consistent)
- Line 110: `<h1 className="text-2xl font-semibold text-ink-900">Gradebook</h1>` → `Carnet de notes`
- Line 112: `<EmptyState title="Create a class first" description="Grades appear here once you post exams to a class." />` → `title="Créez d'abord une classe"` / `description="Les notes apparaîtront ici une fois que vous aurez publié des examens dans une classe."`
- Line 122: `<h1 ...>Gradebook</h1>` (main view heading, duplicate of line 110) → `Carnet de notes`
- Line 123: `<p ...>Track exam grades across every pupil in a class.</p>` → `Suivez les notes d'examen de tous les élèves d'une classe.`
- Line 128: `aria-label="Select class"` → `aria-label="Sélectionner une classe"`
- Line 146–148: `<EmptyState title="No exams yet" description="Create an exam post with a max grade in Communication to start tracking grades." />` →
  - title: `Aucun examen pour l'instant`
  - description: `Créez une publication de type examen avec une note maximale dans Communication pour commencer à suivre les notes.`
  - Note: "Communication" here is a literal reference to the nav item labelled "Communication" in `App.tsx` (the teacher Feed page's nav label). "Communication" is spelled identically in French, so no change to that word itself — only the surrounding sentence is translated.
- Line 154: `label="Class average"` → `label="Moyenne de la classe"`
- Line 156: `hint={`${gradebook.pupils.length} pupil${gradebook.pupils.length === 1 ? "" : "s"} tracked`}` → `hint={`${gradebook.pupils.length} élève${gradebook.pupils.length === 1 ? "" : "s"} suivi${gradebook.pupils.length === 1 ? "" : "s"}`}`
- Line 160: `label="Exams tracked"` → `label="Examens suivis"`
- Line 162: `hint="Posts of type exam"` → `hint="Publications de type examen"`
- Line 166: `label="Graded"` → `label="Notées"`
- Line 168: `hint={`out of ${totalSubmitted} submissions`}` → `hint={`sur ${totalSubmitted} soumissions`}`
- Line 172: `label="Pending grading"` → `label="En attente de notation"`
- Line 174: `hint="Submitted but not yet graded"` → `hint="Soumis mais pas encore noté"`
- Line 180: `<h2 ...>Average score per exam</h2>` → `Note moyenne par examen`
- Line 187: `<Tooltip formatter={(value) => [`${value}%`, "Average"]} .../>` → `[`${value}%`, "Moyenne"]`
- Line 201: `<Button ...>Export CSV</Button>` → `Exporter en CSV`
- Line 207: `<EmptyState title="No active pupils in this class" />` → `title="Aucun élève actif dans cette classe"`
- Line 212: `<th ...>Pupil</th>` → `Élève`
- Line 214: `title={e.content ?? "Exam"}` → `title={e.content ?? "Examen"}` (same fallback as `truncate()`, applied directly here too)
- Line 219: `<th ...>Average</th>` → `Moyenne`
- Line 240: `<span ...>Ungraded</span>` (badge shown when a pupil submitted but isn't graded yet) → `Non noté`

**Structural changes:**

- None beyond the text edits above — this file has no inline status-label map to centralize (grades are numeric, not an enum with a shared label table).
- No bare `new Date(...).toLocaleDateString(...)` call sites in this file — nothing to switch to `formatDate()`.
- CSV/download filename `gradebook-${className.replace(...)}.csv` (line 59) is left unchanged — it's a machine-facing filename with the teacher's own class name in it, not app copy, and the design spec does not call for filename translation.

**Test assertion updates:**

- No test file exists for `GradebookPage.tsx` (confirmed via glob for `GradebookPage.test.tsx` and `**/*GradebookPage*` — only the source file exists). No assertions to update.

---

### File: client/src/features/teacher/LedgerPage.tsx

**Replacements:**

- Line 61, CSV header array (literal, exact array): `const header = ["Name", "Email", "Class", "Status", "Amount due", "Amount paid", "Due date", "Overdue"];` → `const header = ["Nom", "Email", "Classe", "Statut", "Montant dû", "Montant payé", "Date d'échéance", "En retard"];`
  ("Email" stays "Email" per glossary judgment call, same as Gradebook.)
- Line 71, CSV cell value: `r.isOverdue ? "Yes" : "No"` → `r.isOverdue ? "Oui" : "Non"`
- Line 142: `<h1 ...>Ledger</h1>` → `Registre`
- Line 143: `<p ...>Every pupil, their class, and payment status by month.</p>` → `Chaque élève, sa classe et son statut de paiement par mois.`
- Line 149–150: `aria-label="Previous month"` / `title="Previous month"` → `aria-label="Mois précédent"` / `title="Mois précédent"`
- Line 157: `<span ...>(current)</span>` → `(actuel)`
- Line 162–163: `aria-label="Next month"` / `title="Next month"` → `aria-label="Mois suivant"` / `title="Mois suivant"`
- Line 174: `<button ...>Today</button>` (jump back to current month) → `Aujourd'hui`
- Line 182: `label="Collected"` → `label="Encaissé"`
- Line 184: `hint={`${summary?.counts.PAID ?? 0} paid this month`}` → `hint={`${summary?.counts.PAID ?? 0} payé${(summary?.counts.PAID ?? 0) === 1 ? "" : "s"} ce mois-ci`}`
- Line 188: `label="Outstanding"` → `label="Restant dû"`
- Line 190: `hint={`${(summary?.counts.UNPAID ?? 0) + (summary?.counts.INCOMPLETE ?? 0)} not yet paid`}` → `hint={`${(summary?.counts.UNPAID ?? 0) + (summary?.counts.INCOMPLETE ?? 0)} pas encore payé${((summary?.counts.UNPAID ?? 0) + (summary?.counts.INCOMPLETE ?? 0)) === 1 ? "" : "s"}`}`
- Line 194: `label="Overdue"` → `label="En retard"`
- Line 196: `hint={`${summary?.overdueCount ?? 0} pupil${(summary?.overdueCount ?? 0) === 1 ? "" : "s"} past due date`}` → `hint={`${summary?.overdueCount ?? 0} élève${(summary?.overdueCount ?? 0) === 1 ? "" : "s"} en retard de paiement`}`
- Line 200: `label="Expected this month"` → `label="Attendu ce mois-ci"`
- Line 202: `hint={`${summary?.pupilCount ?? 0} pupils billed`}` → `hint={`${summary?.pupilCount ?? 0} élève${(summary?.pupilCount ?? 0) === 1 ? "" : "s"} facturé${(summary?.pupilCount ?? 0) === 1 ? "" : "s"}`}`
- Line 209: `<h2 ...>Payment status breakdown</h2>` → `Répartition des statuts de paiement`
- Line 226: `<h2 ...>By class</h2>` → `Par classe`
- Line 131: `const key = r.className ?? "Unassigned";` → `const key = r.className ?? "Non assigné";` (shows up as an axis/legend category in the "By class" chart — client-visible)
- Line 248: `placeholder="Search pupil name…"` / `aria-label="Search pupil name"` → `placeholder="Rechercher un nom d'élève…"` / `aria-label="Rechercher un nom d'élève"`
- Line 255: `aria-label="Filter by payment status"` → `aria-label="Filtrer par statut de paiement"`
- Line 258: `<option value="">All statuses</option>` → `Tous les statuts`
- Line 268: `aria-label="Filter by class"` → `aria-label="Filtrer par classe"`
- Line 271: `<option value="">All classes</option>` → `Toutes les classes`
- Line 280: `<Button ...>Export CSV</Button>` → `Exporter en CSV`
- Line 288: `<EmptyState title="No pupils match these filters" />` → `title="Aucun élève ne correspond à ces filtres"`
- Line 293: `<th ...>Pupil</th>` → `Élève`
- Line 294: `<th ...>Class</th>` → `Classe`
- Line 295: `<th ...>Status</th>` → `Statut`
- Line 296: `<th ...>Amount due</th>` → `Montant dû`
- Line 297: `<th ...>Amount paid</th>` → `Montant payé`
- Line 298: `<th ...>Due date</th>` → `Date d'échéance`
- Line 314: `{daysOverdue(r.dueDate)} day{daysOverdue(r.dueDate) === 1 ? "" : "s"} overdue` → `{daysOverdue(r.dueDate)} jour{daysOverdue(r.dueDate) === 1 ? "" : "s"} de retard`
- Line 369: `title="Mark as paid in full"` → `title="Marquer comme payé intégralement"`
- Line 371: `<button ...>Mark paid</button>` → `Marquer payé`

**Structural changes:**

- Lines 18–20: remove the inline map
  ```
  const PAYMENT_STATUSES: PaymentStatus[] = ["PAID", "UNPAID", "INCOMPLETE"];
  const STATUS_LABELS: Record<PaymentStatus, string> = { PAID: "Paid", UNPAID: "Unpaid", INCOMPLETE: "Incomplete" };
  ```
  Keep `PAYMENT_STATUSES` (it's an ordering/logic array, not display text). Delete the `STATUS_LABELS` const and its comment line 19, and instead:
  ```
  import { PAYMENT_STATUS_LABELS } from "../../lib/labels";
  ```
  Then replace every use of `STATUS_LABELS` with `PAYMENT_STATUS_LABELS` (currently only line 125: `name: STATUS_LABELS[s]` → `name: PAYMENT_STATUS_LABELS[s]`).
- Line 261 (status filter `<select>`): currently renders the **raw enum value** as the visible option text:
  ```
  {PAYMENT_STATUSES.map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
  ))}
  ```
  This is a pre-existing bug from the teacher's point of view (shows "PAID"/"UNPAID"/"INCOMPLETE" verbatim) that becomes obviously wrong once the rest of the page is French. Fix by displaying the label instead of the raw value:
  ```
  {PAYMENT_STATUSES.map((s) => (
    <option key={s} value={s}>
      {PAYMENT_STATUS_LABELS[s]}
    </option>
  ))}
  ```
- Line 379–383 (per-row status `<select>` in the table): same issue, same fix — `{s}` → `{PAYMENT_STATUS_LABELS[s]}`.
- Line 68 (CSV export row builder): `r.status` is written into the CSV "Status" column as the raw enum value. Since the teacher opens this CSV file, translate it too: change `r.status` to `PAYMENT_STATUS_LABELS[r.status]` in the array passed to `.map()` inside `exportCsv`.
- CSV/download filename `ledger-${period}.csv` (line 81) left unchanged — machine-facing filename, not app copy.
- No bare `new Date(...).toLocaleDateString(...)` call sites in this file (the file already imports and uses `formatPeriodLabel`/`shiftPeriod`/`currentPeriod` from `lib/period`, and `toDateInputValue`/`daysOverdue` only use `new Date` for arithmetic, never `.toLocaleDateString()`). Note: `client/src/lib/period.ts`'s own centralization (§3, a different task) is what makes `formatPeriodLabel` render French month names here — no direct edit needed in this file for that.

**Test assertion updates:**

- No test file exists for `LedgerPage.tsx` (confirmed via glob for `LedgerPage.test.tsx` under `features/teacher/` and broader `**/*LedgerPage*` — only `client/src/features/teacher/LedgerPage.tsx` and the unrelated `client/src/features/parent/LedgerPage.tsx` exist, the latter out of this batch's scope). No assertions to update.

---

### File: client/src/features/teacher/OverviewPage.tsx

**Replacements:**

- Line 29: `<h1 ...>Overview</h1>` → `Aperçu`
- Line 30: `<p ...>A snapshot of your classes and pupils.</p>` → `Un aperçu de vos classes et de vos élèves.`
- Line 33: `label="Active pupils"` → `label="Élèves actifs"`
- Line 34: `label="Classes"` → `label="Classes"` (identical word in French — no change)
- Line 36: `label="Pending requests"` → `label="Demandes en attente"`
- Line 38: `hint="Waiting to be assigned"` → `hint="En attente d'affectation"`
- Line 41: `label="Paid this month"` → `label="Payé ce mois-ci"`
- Line 56: `<h2 ...>Class distribution</h2>` → `Répartition des classes`
- Line 58: `<p ...>Create a class to see distribution.</p>` → `Créez une classe pour voir la répartition.`
- Line 79: `<h2 ...>Teacher ID</h2>` → `Identifiant enseignant`
- Line 80: `<p ...>Share this with pupils so they can request to join your classes.</p>` → `Partagez-le avec les élèves pour qu'ils puissent demander à rejoindre vos classes.`
- Line 93: `{copied ? "Copied!" : "Copy"}` → `{copied ? "Copié !" : "Copier"}`

**Structural changes:**

- None. No inline status/enum label maps, no bare `toLocaleDateString()` call sites.

**Test assertion updates:**

- No test file exists for `OverviewPage.tsx` (confirmed via glob). No assertions to update.

---

### File: client/src/features/teacher/PaymentHealthCard.tsx

**Replacements:**

- Line 25: `<h2 ...>Payment health this month</h2>` → `Santé des paiements ce mois-ci`
- Line 30: `<Link ...>View ledger</Link>` → `Voir le registre`
- Line 35: `<p ...>No active pupils to bill yet.</p>` → `Aucun élève actif à facturer pour l'instant.`
- Line 40: `<span ...>paid up</span>` (renders "`{percentPaid}%` paid up") → `payé` (renders "`{percentPaid}%` payé")

**Structural changes:**

- Lines 11–15: remove the inline map
  ```
  const LABELS: Record<PaymentStatus, string> = {
    PAID: "Paid",
    INCOMPLETE: "Incomplete",
    UNPAID: "Unpaid",
  };
  ```
  Replace with:
  ```
  import { PAYMENT_STATUS_LABELS } from "../../lib/labels";
  ```
  Then replace all `LABELS[...]` usages with `PAYMENT_STATUS_LABELS[...]`:
  - Line 50: `title={`${LABELS[status]}: ${summary[status]}`}` → `title={`${PAYMENT_STATUS_LABELS[status]}: ${summary[status]}`}`
  - Line 60: `{LABELS[status]} · {summary[status]}` → `{PAYMENT_STATUS_LABELS[status]} · {summary[status]}`

**Test assertion updates:**

- No test file exists for `PaymentHealthCard.tsx` (confirmed via glob). No assertions to update.

---

### File: client/src/features/teacher/RecentActivityCard.tsx

**Replacements:**

- Line 34: `<h2 ...>Recent activity</h2>` → `Activité récente`
- Line 37: `<EmptyState title="Nothing yet" description="Pupil requests, submissions, and payment alerts show up here." />` →
  - title: `Rien pour l'instant`
  - description: `Les demandes des élèves, les soumissions et les alertes de paiement s'affichent ici.`

**Structural changes:**

- Line 63: `{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}` renders relative times like "5 minutes ago" using date-fns' default (English) locale. This is client-visible copy that the design spec's centralization section doesn't explicitly enumerate, but it falls under the general principle (§1) that any client-visible text becomes French. Recommend:
  ```
  import { formatDistanceToNow } from "date-fns";
  import { fr } from "date-fns/locale";
  ...
  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
  ```
  `date-fns` is already at `^4.4.0` in `client/package.json`, which ships `date-fns/locale` subpath exports, so `fr` is available with no new dependency.
  - Note for the plan author (not part of this file's task): `client/src/components/NotificationBell.tsx` (a shared component, out of this batch) has the exact same `formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })` call site and will need the identical `locale: fr` fix — flagging so it isn't missed when that file's batch is planned.
- `NOTIFICATION_META` (imported from `../../lib/notificationMeta`) supplies `meta.Icon`/`meta.color` only, no text — out of scope here, and not part of this batch's file list.

**Test assertion updates:**

- No test file exists for `RecentActivityCard.tsx` (confirmed via glob). No assertions to update.

---

### File: client/src/features/teacher/UpcomingSchedule.tsx

**Replacements:**

- Line 14: `if (offsetDays === 0) return "Today";` (in `weeklyDayLabel`) → `"Aujourd'hui"`
- Line 15: `if (offsetDays === 1) return "Tomorrow";` (in `weeklyDayLabel`) → `"Demain"`
- Line 24: `if (offsetDays === 0) return "Today";` (in `vacationDayLabel`) → `"Aujourd'hui"`
- Line 25: `if (offsetDays === 1) return "Tomorrow";` (in `vacationDayLabel`) → `"Demain"`
- Line 67: `<h2 ...>Upcoming sessions</h2>` → `Séances à venir`
- Line 70–73: `<EmptyState title="No scheduled sessions" description="Add a weekly schedule from a class's detail page." />` →
  - title: `Aucune séance programmée`
  - description: `Ajoutez un emploi du temps hebdomadaire depuis la page de détail d'une classe.`

**Structural changes:**

- Line 26: `return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });` is a bare `toLocaleDateString()` call site (not explicitly named in spec §3's illustrative list, but it matches the rule verbatim: "Any bare `new Date(...).toLocaleDateString(...)` must switch to `formatDate(...)`"). Change to:
  ```
  import { DAY_NAMES, formatDate } from "../../lib/period";
  ...
  return formatDate(date, { weekday: "short", month: "short", day: "numeric" });
  ```
  (add `formatDate` to the existing `DAY_NAMES` import from `../../lib/period`.)

**Test assertion updates:**

- No test file exists for `UpcomingSchedule.tsx` (confirmed via glob). No assertions to update.

---

### File: client/src/features/teacher/PupilContactModal.tsx

**Replacements:**

- Line 7: `<Modal ... title="Contact info" ...>` → `title="Coordonnées"`
- Line 11: `<dt ...>Full name</dt>` → `Nom complet`
- Line 15: `<dt ...>Class</dt>` → `Classe`
- Line 18: `<span>{pupil.className ?? "Not assigned yet"}</span>` → `{pupil.className ?? "Pas encore assignée"}` (feminine agreement with "classe")
- Line 22: `<dt ...>Email</dt>` → `Email` (unchanged — proper technical term used as-is in French)
- Line 26: `<dt ...>Phone</dt>` → `Téléphone`
- Line 30: `<dt ...>Parent</dt>` → `Parent` (identical word in French — no change)
- Line 34: `<dd ...>No linked parent account</dd>` → `Aucun compte parent lié`

**Structural changes:**

- None. No enum/status labels, no dates.

**Test assertion updates** (`client/src/features/teacher/PupilContactModal.test.tsx`):

- Line 44: `expect(screen.getByText("No linked parent account")).toBeInTheDocument();` → `expect(screen.getByText("Aucun compte parent lié")).toBeInTheDocument();`
- All other assertions in this test file check data values (`"Ada Lovelace"`, `"Advanced Math"`, `"ada@example.com"`, `"12345678"`, `"Byron Lovelace"`, `"87654321"`), which are fixture/user data, not app copy — no change needed for those.

---

### File: client/src/features/teacher/PupilDetailModal.tsx

**Replacements:**

- Line 132: `<Modal ... title={pupil?.name ?? "Pupil"} ...>` → fallback `"Pupil"` → `"Élève"`
- Line 152–153: `title="View contact info"` / `aria-label="View contact info"` → `title="Voir les coordonnées"` / `aria-label="Voir les coordonnées"` (matches the "Coordonnées" title chosen for `PupilContactModal.tsx`)
- Line 159: `<h3 ...>Attendance</h3>` → `Présences`
- Line 165–166: `title="Previous month"` / `aria-label="Previous month"` → `title="Mois précédent"` / `aria-label="Mois précédent"`
- Line 175–176: `title="Next month"` / `aria-label="Next month"` → `title="Mois suivant"` / `aria-label="Mois suivant"`
- Line 184: `<p ...>This pupil isn't assigned to a class yet.</p>` → `Cet élève n'est pas encore assigné à une classe.`
- Line 186: `<p ...>No sessions scheduled for this class yet.</p>` → `Aucune séance programmée pour cette classe pour l'instant.`
- Legend block, lines 230–249 (currently hardcoded literal strings, not pulled from `DISPLAY_LABELS`):
  - Line 232: `Present ({stats.present})` → `{ATTENDANCE_DISPLAY_LABELS.PRESENT} ({stats.present})` → renders `Présent ({stats.present})`
  - Line 235: `Absent ({stats.absent})` → `{ATTENDANCE_DISPLAY_LABELS.ABSENT} ({stats.absent})` → renders `Absent ({stats.absent})` (identical word)
  - Line 238: `Excused ({stats.excused})` → `{ATTENDANCE_DISPLAY_LABELS.EXCUSED} ({stats.excused})` → renders `Excusé ({stats.excused})`
  - Line 241: `Not marked ({stats.unmarked})` → `{ATTENDANCE_DISPLAY_LABELS.UNMARKED} ({stats.unmarked})` → renders `Non marqué ({stats.unmarked})`
  - Line 244: `Upcoming ({stats.upcoming})` → `{ATTENDANCE_DISPLAY_LABELS.FUTURE} ({stats.upcoming})` → renders `À venir ({stats.upcoming})`
  - Line 247: `Today` (no count) → `{ATTENDANCE_DISPLAY_LABELS.TODAY}` → renders `Aujourd'hui`
- Line 251–252: `<p ...>Click a past or today's session to cycle it between present, absent, and not marked.</p>` → `Cliquez sur une séance passée ou d'aujourd'hui pour la faire passer entre présent, absent et non marqué.`
- Line 258: `<h3 ...>Payment history</h3>` → `Historique des paiements`
- Line 260: `<Button ...>Full ledger</Button>` → `Registre complet`
- Line 266: `<p ...>No payment records yet.</p>` → `Aucun paiement enregistré pour l'instant.`
- Line 272: `<th ...>Period</th>` → `Période`
- Line 273: `<th ...>Status</th>` → `Statut`
- Line 274: `<th ...>Paid / Due</th>` → `Payé / Dû`
- Line 275: `<th ...>Due date</th>` → `Date d'échéance`
- Line 284: `<span ...>overdue</span>` → `en retard`

**Structural changes:**

- Lines 46–53: remove the inline map
  ```
  const DISPLAY_LABELS: Record<AttendanceDay["display"], string> = {
    FUTURE: "Upcoming session",
    TODAY: "Today's session",
    PRESENT: "Present",
    ABSENT: "Absent",
    EXCUSED: "Excused",
    UNMARKED: "Not marked yet — click to record",
  };
  ```
  Per the task brief, replace with the centralized map:
  ```
  import { ATTENDANCE_DISPLAY_LABELS } from "../../lib/labels";
  ```
  Note this changes the actual displayed copy, not just its language: the calendar-cell tooltip/aria-label currently show the richer descriptive phrases ("Upcoming session", "Today's session", "Not marked yet — click to record"); after switching to the shared `ATTENDANCE_DISPLAY_LABELS` map (per glossary §2) they become the plain single/short terms ("À venir", "Aujourd'hui", "Non marqué"). This is an intentional simplification directed by centralization, not a fidelity loss to flag as a bug — but call it out explicitly in review since the French text is shorter than the English it replaces.
  - Line 206: `title={`${cell.entry.startTime}–${cell.entry.endTime} · ${DISPLAY_LABELS[cell.entry.display]}`}` → `${ATTENDANCE_DISPLAY_LABELS[cell.entry.display]}`
  - Line 207: `aria-label={`${cell.dayNumber} ${formatPeriodLabel(period)}, ${cell.entry.startTime}–${cell.entry.endTime}, ${DISPLAY_LABELS[cell.entry.display]}`}` → `${ATTENDANCE_DISPLAY_LABELS[cell.entry.display]}`
  - `DISPLAY_STYLES` (lines 37–44) is unchanged — it's a CSS-class map, not text.
- Line 290: `entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "—"` — bare `toLocaleDateString()` call site, switch to the centralized helper:
  ```
  import { DAY_NAMES, currentPeriod, formatDate, formatPeriodLabel, shiftPeriod } from "../../lib/period";
  ...
  entry.dueDate ? formatDate(entry.dueDate) : "—"
  ```
  (add `formatDate` to the existing `../../lib/period` import.)

**Test assertion updates** (`client/src/features/teacher/PupilDetailModal.test.tsx`):

- Line 48: `await waitFor(() => expect(screen.getByText(/excused/i)).toBeInTheDocument());` → `await waitFor(() => expect(screen.getByText(/excusé/i)).toBeInTheDocument());`
  (The test seeds one `EXCUSED` day; the visible text this regex currently matches is the legend line "Excused (1)" rendered from `stats.excused`. After translation this line renders "Excusé (1)" — the English regex `/excused/i` would no longer match since "Excusé" doesn't contain a trailing "d".)

---

### File: client/src/features/teacher/PupilLedgerModal.tsx

**Replacements:**

- Line 58: `title={pupilName ? `${pupilName} — Full ledger` : "Full ledger"}` → `title={pupilName ? `${pupilName} — Registre complet` : "Registre complet"}`
- Line 76: `Owes ${formatCurrency(balance)} overall` → `Doit ${formatCurrency(balance)} au total`
- Line 78: `${formatCurrency(Math.abs(balance))} credit (paid in advance)` → `${formatCurrency(Math.abs(balance))} de crédit (payé en avance)`
- Line 80: ` — about ${sessionsInAdvance} session${sessionsInAdvance === 1 ? "" : "s"} ahead` → ` — soit environ ${sessionsInAdvance} séance${sessionsInAdvance === 1 ? "" : "s"} d'avance`
- Line 82: `"All settled"` → `"Tout est réglé"`
- Line 89: `<th ...>Period</th>` → `Période`
- Line 90: `<th ...>Present</th>` → `Présent`
- Line 91: `<th ...>Absent</th>` → `Absent` (identical word)
- Line 92: `<th ...>Status</th>` → `Statut`
- Line 93: `<th ...>Amount due</th>` → `Montant dû`
- Line 94: `<th ...>Amount paid</th>` → `Montant payé`
- Line 95: `<th ...>Due date</th>` → `Date d'échéance`
- Line 133: `aria-label={`Amount due for ${periodLabel}`}` → `aria-label={`Montant dû pour ${periodLabel}`}`
- Line 147: `aria-label={`Amount paid for ${periodLabel}`}` → `aria-label={`Montant payé pour ${periodLabel}`}`
- Line 160: `aria-label={`Due date for ${periodLabel}`}` → `aria-label={`Date d'échéance pour ${periodLabel}`}`
- Line 175: `title="Mark as paid in full"` → `title="Marquer comme payé intégralement"`
- Line 177: `<button ...>Mark paid</button>` → `Marquer payé`
- Line 182: `aria-label={`Status for ${periodLabel}`}` → `aria-label={`Statut pour ${periodLabel}`}`

**Structural changes:**

- Lines 186–190 (per-row status `<select>`) currently renders the raw enum value as option text:
  ```
  {PAYMENT_STATUSES.map((s) => (
    <option key={s} value={s}>
      {s}
    </option>
  ))}
  ```
  Fix (same issue/fix as `LedgerPage.tsx`):
  ```
  import { PAYMENT_STATUS_LABELS } from "../../lib/labels";
  ...
  {PAYMENT_STATUSES.map((s) => (
    <option key={s} value={s}>
      {PAYMENT_STATUS_LABELS[s]}
    </option>
  ))}
  ```
  `PAYMENT_STATUSES` (line 10) stays as-is — it's an ordering array, not display text.
- No bare `toLocaleDateString()` call sites in this file (`formatPeriodLabel` from `../../lib/period` is already used for period display; date inputs use raw ISO slicing via `toDateInputValue`, not locale formatting).

**Test assertion updates** (`client/src/features/teacher/PupilLedgerModal.test.tsx`):

- Line 49: `expect(await screen.findByText(/owes 50 TND overall/i)).toBeInTheDocument();` → `expect(await screen.findByText(/doit 50 TND au total/i)).toBeInTheDocument();`
- Line 51: `const septRow = screen.getByText("September 2026").closest("tr")!;` → `const septRow = screen.getByText("septembre 2026").closest("tr")!;`
  (This month name comes from `formatPeriodLabel()` in `client/src/lib/period.ts`. It isn't this file's own text, but changes as a direct consequence of the §3 centralization task switching `formatPeriodLabel`'s locale argument from `undefined` to `"fr-FR"` — flagging here since this test's assertion breaks as a result and must be updated in the same overall effort.)
- Line 55: `const augRow = screen.getByText("August 2026").closest("tr")!;` → `const augRow = screen.getByText("août 2026").closest("tr")!;` (same `formatPeriodLabel` locale change as above)
- Line 62: `expect(await screen.findByText(/25 TND credit \(paid in advance\) — about 3 sessions ahead/i)).toBeInTheDocument();` → `expect(await screen.findByText(/25 TND de crédit \(payé en avance\) — soit environ 3 séances d'avance/i)).toBeInTheDocument();`
- Line 71: `const input = await screen.findByLabelText("Amount paid for September 2026");` → `const input = await screen.findByLabelText("Montant payé pour septembre 2026");`
  (Combines this file's own `aria-label` translation with the `formatPeriodLabel` locale change noted above.)
- Line 77: `expect(updatePaymentStatusMock).toHaveBeenCalledWith("p1", { period: "2026-09", amountPaid: 80 });` — unchanged. This asserts the API call payload (a raw period string `"2026-09"` and a number), not any display text.


# Shared components batch — French localization

Batch scope (per task instructions): `AppLayout.tsx`, `Badge.tsx`, `ConfirmDialog.tsx`, `Feedback.tsx`, `Modal.tsx`,
`NotificationBell.tsx`, `Pagination.tsx`, `ScheduleView.tsx`, `App.tsx`. All 9 files were located under
`client/src` (paths confirmed via Glob) and all 9 exist.

**Note on "EduManage":** `AppLayout.tsx` renders the literal string `"EduManage"` (sidebar header, mobile header,
and `document.title` suffix `` `${title} · EduManage` ``). This is the in-app product name (a coined portmanteau,
not an English sentence/phrase), used the same way the spec treats the brand name "Bachandi" (§1, "never
translated"). Treating it as a second proper-noun/brand string, it is left untranslated below. Flagging this
explicitly since the spec's glossary/boundary sections don't name "EduManage" directly — confirm this reading
before the implementation task executes.

---

### File: client/src/components/AppLayout.tsx
Test file: none found (no `AppLayout.test.*` under `client/src`)

Replacements:
- Old: `"Close menu"` → New: `"Fermer le menu"` (line 86, `aria-label` on mobile sidebar close button)
- Old: `"Account settings"` → New: `"Paramètres du compte"` (line 53, fallback `document.title` value when route ends in `/settings`)
- Old: `"Account settings"` → New: `"Paramètres du compte"` (line 126, sidebar footer link text)
- Old: `"Log out"` → New: `"Se déconnecter"` (line 133, sidebar footer button text)
- Old: `"Open menu, EduManage"` → New: `"Ouvrir le menu, EduManage"` (line 145, `aria-label` on mobile hamburger button — "EduManage" kept untranslated per the brand-name note above)

Not translated (brand name, see note above):
- `"EduManage"` (line 78, sidebar header text)
- `"EduManage"` (line 148, mobile header text)
- `` `${title} · EduManage` `` (line 55, `document.title` template — only the `title` variable's contents are French, per the two "Account settings" replacements above and per each page's own nav `label`, which is translated in `App.tsx` below)

Structural changes: none (no inline enum-label map in this file).

Test assertion updates: none (no test file).

---

### File: client/src/components/Badge.tsx
Test file: none found (no `Badge.test.*` under `client/src`)

Replacements: none as literal JSX strings — all visible text in this file comes from lookup objects, handled as structural changes below.

Structural changes:
- Remove the inline `paymentLabels` object (lines 10–14). Add `import { PAYMENT_STATUS_LABELS } from "../lib/labels";`. In `PaymentBadge` (line 19), change `{paymentLabels[status]}` to `{PAYMENT_STATUS_LABELS[status]}`. (`paymentColors` / `STATUS_COLORS`-style color map on lines 4–8 is unaffected and stays as-is.) Resulting labels: PAID → "Payé", UNPAID → "Non payé", INCOMPLETE → "Incomplet" (per spec §2 table; this changes the current English copy from "Sessions incomplete" to the canonical "Incomplet").
- `ClassTypeBadge` (lines 24–37) currently renders the raw enum value directly: `{type}` (line 34), e.g. literally shows "SCIENCE"/"MATH"/"INFO"/"ECO" to the user. Add `import { CLASS_TYPE_LABELS } from "../lib/labels";` and change `{type}` to `{CLASS_TYPE_LABELS[type]}`. Resulting labels: SCIENCE → "Sciences", MATH → "Mathématiques", INFO → "Informatique", ECO → "Économie". (`classTypeColors` map, lines 24–29, is unaffected.)
- `StatusBadge` (lines 39–51) currently renders the raw enum value directly: `{status}` (line 48), e.g. literally shows "PENDING"/"ACTIVE"/"REJECTED". Add `import { USER_STATUS_LABELS } from "../lib/labels";` (can be combined into the same import statement as `PAYMENT_STATUS_LABELS`/`CLASS_TYPE_LABELS`) and change `{status}` to `{USER_STATUS_LABELS[status]}`. Resulting labels: PENDING → "En attente", ACTIVE → "Actif", REJECTED → "Rejeté". (`statusColors` map, lines 39–43, is unaffected.)
- Remove the inline `swapStatusLabels` object (lines 59–63). Add `import { SWAP_REQUEST_STATUS_LABELS } from "../lib/labels";` (combine into the same import line). In `SwapStatusBadge` (line 68), change `{swapStatusLabels[status]}` to `{SWAP_REQUEST_STATUS_LABELS[status]}`. Resulting labels: PENDING → "En attente", APPROVED → "Approuvée", DECLINED → "Refusée". (`swapStatusColors` map, lines 53–57, is unaffected.)
- Net result: a single consolidated import at the top of the file, e.g. `import { PAYMENT_STATUS_LABELS, CLASS_TYPE_LABELS, USER_STATUS_LABELS, SWAP_REQUEST_STATUS_LABELS } from "../lib/labels";`, and all four inline label objects (`paymentLabels`, and the two previously-missing label lookups for `ClassTypeBadge`/`StatusBadge`, and `swapStatusLabels`) removed/replaced.

Test assertion updates: none (no test file).

---

### File: client/src/components/ConfirmDialog.tsx
Test file: none found (no `ConfirmDialog.test.*` under `client/src`)

Replacements:
- Old: `"Confirm"` → New: `"Confirmer"` (line 20, `confirmLabel` prop default value)
- Old: `"Cancel"` → New: `"Annuler"` (line 21, `cancelLabel` prop default value)
- Old: `"Working…"` → New: `"Chargement…"` (line 40, button text shown while `isPending` is true, replacing `confirmLabel`)

Structural changes: none.

Test assertion updates: none (no test file).

---

### File: client/src/components/Feedback.tsx
Test file: none found (no `Feedback.test.*` under `client/src`)

Replacements:
- Old: `"Retry"` → New: `"Réessayer"` (line 42, `ErrorState` retry button text)

Not translated: `title`, `description`, `actionLabel` (in `EmptyState`) and `message` (in `ErrorState`) are all caller-supplied props with no literal default value in this file — the strings passed in by call sites are translated in each caller's own file/batch, not here. `Spinner` has no text content.

Structural changes: none.

Test assertion updates: none (no test file).

---

### File: client/src/components/Modal.tsx
Test file: none found (no `Modal.test.*` under `client/src`)

Replacements:
- Old: `"Close"` → New: `"Fermer"` (line 88, `aria-label` on the modal's close button)

Not translated: `title` is a caller-supplied prop, translated at each call site's own file.

Structural changes: none.

Test assertion updates: none (no test file).

---

### File: client/src/components/NotificationBell.tsx
Test file: none found (no `NotificationBell.test.*` under `client/src`)

Replacements:
- Old: `"Notifications"` → New: `"Notifications"` (line 80, `aria-label` on the bell trigger button — identical spelling in French, no change to the literal, kept for completeness)
- Old: `"Notifications"` → New: `"Notifications"` (line 103, panel header text — identical spelling in French, no change to the literal, kept for completeness)
- Old: `"Mark all read"` → New: `"Tout marquer comme lu"` (line 110, button shown when `unreadCount > 0`)
- Old: `"You're all caught up."` → New: `"Vous êtes à jour."` (line 116, empty-list message)

Not translated: `{unreadCount > 9 ? "9+" : unreadCount}` (line 87) is a numeric badge, not translatable text. `n.title` / `n.body` (lines 141, 144) are server-supplied notification content, already covered by the server-side notification-service translation task (spec §5), not this file. `formatDistanceToNow` (line 146, from `date-fns`) renders relative-time text (e.g. "5 minutes ago") in English by default — flagging this as a likely gap: `date-fns`'s `formatDistanceToNow` needs a `locale: fr` option (from `date-fns/locale`) to render French relative times; this file's task should add `import { fr } from "date-fns/locale";` and pass `{ addSuffix: true, locale: fr }` to `formatDistanceToNow` at line 146, since this call site is out of the literal-string-replacement pattern but is still client-visible text this batch is responsible for.

Structural changes: none (no inline enum-label map in this file).

Test assertion updates: none (no test file).

---

### File: client/src/components/Pagination.tsx
Test file: none found (no `Pagination.test.*` under `client/src`)

Replacements:
- Old: `"Showing "` (text node before the start–end span, line 18) → New: `"Affichage de "`
- Old: `" of "` (text node between the start–end span and the total span, line 18, note the `{" "}` JSX whitespace-preserving expression before the closing text) → New: `" sur "`
- Old: `"Previous"` → New: `"Précédent"` (line 28, pagination button text)
- Old: `"Page "` / `" of "` (template text around `{page}` and `{totalPages}`, line 31: `Page {page} of {totalPages}`) → New: `"Page {page} sur {totalPages}"` (i.e. replace the literal word `of` with `sur`, keeping the `{page}`/`{totalPages}` expressions in place)
- Old: `"Next"` → New: `"Suivant"` (line 39, pagination button text)

Resulting line 17–20 JSX (for implementer reference, not verbatim required):
```
Affichage de <span ...>{start}–{end}</span> sur{" "}
<span ...>{total}</span>
```

Structural changes: none.

Test assertion updates: none (no test file).

---

### File: client/src/components/ScheduleView.tsx
Test file: client/src/components/ScheduleView.test.tsx

Replacements:
- Old: `"No vacation sessions scheduled yet"` → New: `"Aucune session de vacances programmée pour l'instant"` (line 12, `EmptyState` title, vacation-mode empty state)
- Old: `"The teacher hasn't added one-off sessions for this window."` → New: `"L'enseignant n'a pas encore ajouté de sessions ponctuelles pour cette période."` (line 13, `EmptyState` description, vacation-mode empty state)
- Old: `"No schedule set yet"` → New: `"Aucun emploi du temps défini pour l'instant"` (line 47, `EmptyState` title, weekly-mode empty state)
- Old: `"The teacher hasn't added session times."` → New: `"L'enseignant n'a pas encore ajouté d'horaires de séances."` (line 47, `EmptyState` description, weekly-mode empty state)
- Old: `"· today"` → New: `"· aujourd'hui"` (line 68, suffix shown next to the current day's column header)
- Old: `"No session"` → New: `"Aucune séance"` (line 72, shown in a day column with zero slots)

Structural changes:
- Line 3 import: change `import { DAY_NAMES } from "../lib/period";` to `import { DAY_NAMES, formatDate } from "../lib/period";` (per spec §3, `formatDate` is the new helper exported from `client/src/lib/period.ts`).
- Lines 23–27: replace the bare `toLocaleDateString` call with the shared helper. Change:
  ```
  {new Date(`${s.date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}
  ```
  to:
  ```
  {formatDate(`${s.date}T00:00:00`, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}
  ```
  This is not one of the ~11 files explicitly named in spec §3's bare-`toLocaleDateString` list, but it is the same pattern (bare call, `undefined` locale) and falls under the "~15 call sites" the spec says exist in total — it must be migrated to `formatDate()` for the same reason (locale must be hardcoded `fr-FR`, not browser-derived).
- `DAY_NAMES` (imported, used at line 55) requires no per-file change here — it already becomes the French abbreviation array (`["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]`) once the centralization task (spec §3) updates `client/src/lib/period.ts`. This file's task only needs to confirm the import still resolves; no edit to the `DAY_NAMES` usage itself.

Test assertion updates:
- Old: `expect(screen.getByText("Mon")).toBeInTheDocument();` → New: `expect(screen.getByText("Lun")).toBeInTheDocument();` (test file line 11 — depends on `DAY_NAMES` centralization landing first; `dayOfWeek: 1` is Monday, which is `"Lun"` in the French `DAY_NAMES` array)
- Old: `expect(screen.getByText("No schedule set yet")).toBeInTheDocument();` → New: `expect(screen.getByText("Aucun emploi du temps défini pour l'instant")).toBeInTheDocument();` (test file line 16)
- Old: `expect(screen.getByText("No vacation sessions scheduled yet")).toBeInTheDocument();` → New: `expect(screen.getByText("Aucune session de vacances programmée pour l'instant")).toBeInTheDocument();` (test file line 30)
- Unaffected (no change needed): `expect(screen.getByText("16:00")).toBeInTheDocument();` (test file line 10, raw `HH:mm` time string, no locale formatting applied) and `expect(screen.getByText("14:00–15:00")).toBeInTheDocument();` (test file line 25, same reason)

---

### File: client/src/App.tsx
Test file: none found (no `App.test.*` under `client/src`)

Replacements — nav item `label` values:
- Old: `"Teachers"` → New: `"Enseignants"` (line 89, `adminNav`)
- Old: `"Overview"` → New: `"Aperçu"` (line 92, `teacherNav`)
- Old: `"Class Management"` → New: `"Gestion des classes"` (line 93, `teacherNav`)
- Old: `"Ledger"` → New: `"Registre"` (line 94, `teacherNav`)
- Old: `"Gradebook"` → New: `"Carnet de notes"` (line 95, `teacherNav`)
- Old: `"Communication"` → New: `"Communication"` (line 96, `teacherNav` — identical spelling in French, no change to the literal, kept for completeness; this label is used for the teacher's feed route but the product copy says "Communication", not "Feed", so the glossary's Feed→Publications mapping does not apply here)
- Old: `"Home"` → New: `"Accueil"` (line 100, `pupilNav`)
- Old: `"Schedule"` → New: `"Emploi du temps"` (line 101, `pupilNav`)
- Old: `"Attendance"` → New: `"Présences"` (line 102, `pupilNav`)
- Old: `"Payments"` → New: `"Paiements"` (line 103, `pupilNav`)
- Old: `"Grades"` → New: `"Notes"` (line 104, `pupilNav`)
- Old: `"Class Feed"` → New: `"Publications de la classe"` (line 105, `pupilNav`)
- Old: `"Home"` → New: `"Accueil"` (line 109, `parentNav`)
- Old: `"Schedule"` → New: `"Emploi du temps"` (line 110, `parentNav`)
- Old: `"Attendance"` → New: `"Présences"` (line 111, `parentNav`)
- Old: `"Payments"` → New: `"Paiements"` (line 112, `parentNav`)
- Old: `"Ledger"` → New: `"Registre"` (line 113, `parentNav`)
- Old: `"Grades"` → New: `"Notes"` (line 114, `parentNav`)
- Old: `"Class Feed"` → New: `"Publications de la classe"` (line 115, `parentNav`)

Replacements — `AppLayout` `brand` prop values (rendered client-side in `AppLayout.tsx`'s sidebar, under the "EduManage" logo text, and used as the `document.title` fallback when no nav item matches):
- Old: `brand="Admin"` → New: `brand="Administrateur"` (line 136, admin `AppLayout` route)
- Old: `brand="Teacher"` → New: `brand="Enseignant"` (line 144, teacher `AppLayout` route)
- Old: `brand="Pupil"` → New: `brand="Élève"` (line 156, pupil `AppLayout` route)
- Old: `brand="Parent"` → New: `brand="Parent"` (line 168, parent `AppLayout` route — identical spelling in French per glossary, no change to the literal, kept for completeness)

Structural changes: none (no inline enum-label map in this file; nav arrays and route `brand` props are plain string literals).

Test assertion updates: none (no test file).

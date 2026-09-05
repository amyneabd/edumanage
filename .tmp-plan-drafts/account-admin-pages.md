# French Localization — Batch: account + admin pages

Files covered:
- `client/src/features/account/SettingsPage.tsx`
- `client/src/features/admin/AdminPage.tsx`
- `client/src/features/admin/TeacherDetailPage.tsx`

No test files exist for any of these three components (`Glob` for `SettingsPage*`, `AdminPage*`, `TeacherDetailPage*`, and `client/src/features/**/*.test.*` confirms only `teacher/VacationBanner.test.tsx`, `teacher/VacationSessionsPanel.test.tsx`, `pupil/SchedulePage.test.tsx`, `teacher/PupilContactModal.test.tsx`, `teacher/PupilDetailModal.test.tsx`, `teacher/PupilLedgerModal.test.tsx` exist — none for this batch). So there are no "Test assertion updates" for this batch; each file section says so explicitly.

---

### File: `client/src/features/account/SettingsPage.tsx`

**Structural changes:**
- Add import: `import { ROLE_LABELS } from "../../lib/labels";`
- Line 57 currently renders the raw enum value directly: `<dd className="font-medium text-ink-900">{user?.role}</dd>`. This shows an untranslated raw value (e.g. literally `TEACHER`) to the user. Change to: `<dd className="font-medium text-ink-900">{user?.role ? ROLE_LABELS[user.role] : null}</dd>`.

**Replacements** (exact old → new; all other JSX/text in the file, in file order):
1. `toast.success("Password updated.")` → `toast.success("Mot de passe mis à jour.")`
2. `<h1 className="text-2xl font-semibold text-ink-900">Account settings</h1>` → `<h1 className="text-2xl font-semibold text-ink-900">Paramètres du compte</h1>`
3. `<p className="mt-1 text-sm text-ink-500">Manage your profile and security.</p>` → `<p className="mt-1 text-sm text-ink-500">Gérez votre profil et votre sécurité.</p>`
4. `<h2 className="text-sm font-medium text-ink-700">Profile</h2>` → `<h2 className="text-sm font-medium text-ink-700">Profil</h2>`
5. `<dt className="text-ink-400">Name</dt>` → `<dt className="text-ink-400">Nom</dt>`
6. `<dt className="text-ink-400">Email</dt>` → `<dt className="text-ink-400">E-mail</dt>`
7. `<dt className="text-ink-400">Role</dt>` → `<dt className="text-ink-400">Rôle</dt>`
8. `<h2 className="text-sm font-medium text-ink-700">Change password</h2>` → `<h2 className="text-sm font-medium text-ink-700">Modifier le mot de passe</h2>`
9. `<p className="mt-1 text-xs text-ink-400">Choose a strong password you don't use elsewhere.</p>` → `<p className="mt-1 text-xs text-ink-400">Choisissez un mot de passe fort que vous n'utilisez pas ailleurs.</p>`
10. `<label htmlFor="settings-current-password" className="text-sm font-medium text-ink-700">\n                Current password\n              </label>` → `<label htmlFor="settings-current-password" className="text-sm font-medium text-ink-700">\n                Mot de passe actuel\n              </label>`
11. `<label htmlFor="settings-new-password" className="text-sm font-medium text-ink-700">\n                New password\n              </label>` → `<label htmlFor="settings-new-password" className="text-sm font-medium text-ink-700">\n                Nouveau mot de passe\n              </label>`
12. `<label htmlFor="settings-confirm-new-password" className="text-sm font-medium text-ink-700">\n                Confirm new password\n              </label>` → `<label htmlFor="settings-confirm-new-password" className="text-sm font-medium text-ink-700">\n                Confirmer le nouveau mot de passe\n              </label>`
13. `{mutation.isPending ? "Updating…" : "Update password"}` → `{mutation.isPending ? "Mise à jour…" : "Mettre à jour le mot de passe"}`

**Not translated (per scope rules):**
- `<ErrorState message={extractErrorMessage(mutation.error)} />` — renders the server's error message; covered by the server-side error-message task, not this one.
- `<FieldError ... message={errors.currentPassword?.message} />` (and the two sibling `FieldError` usages) — messages come from `changePasswordSchema` in `client/src/lib/authSchemas.ts`, translated by a separate task covering that file.
- `id="settings-current-password"` / `id="settings-new-password"` / `id="settings-confirm-new-password"` / `aria-describedby` id references — internal DOM ids, not visible text.

**Test assertion updates:** none — no test file exists for `SettingsPage.tsx`.

---

### File: `client/src/features/admin/AdminPage.tsx`

**Structural changes:**
- Add import: `import { formatDate } from "../../lib/period";`
- Add import: `import { USER_STATUS_LABELS } from "../../lib/labels";`
- Line 247, the bare date call site: `<td className="py-3 pr-4 text-ink-500">{new Date(t.createdAt).toLocaleDateString()}</td>` → `<td className="py-3 pr-4 text-ink-500">{formatDate(t.createdAt)}</td>` (no `options` argument was passed originally, so none is passed to `formatDate`).
- Lines 195–199, the status filter `<select>` renders the raw `UserStatus` enum value as the option label for non-"ALL" entries: `{s === "ALL" ? "All statuses" : s}`. This shows an untranslated raw value (e.g. literally `PENDING`) to the user. Change to `{s === "ALL" ? "Tous les statuts" : USER_STATUS_LABELS[s]}`. (The `value={s}` attribute itself stays the raw enum value — it's logic, not visible text.)

**Replacements** (exact old → new, in file order):
1. `toast.success("Teacher approved.")` → `toast.success("Enseignant approuvé.")`
2. `toast.success("Teacher application rejected.")` → `toast.success("Candidature d'enseignant rejetée.")`
3. `<h1 className="text-2xl font-semibold text-ink-900">Admin</h1>` → `<h1 className="text-2xl font-semibold text-ink-900">Administration</h1>`
4. `<p className="mt-1 text-sm text-ink-500">Every teacher account on the platform, at a glance.</p>` → `<p className="mt-1 text-sm text-ink-500">Tous les comptes enseignants de la plateforme, en un coup d'œil.</p>`
5. `label="Teachers"` (first `StatCard`) → `label="Enseignants"`
6. `hint={`${kpis.active} active`}` → `hint={`${kpis.active} actifs`}`
7. `label="Pending approvals"` → `label="Approbations en attente"`
8. `hint={kpis.pending > 0 ? "Waiting on you" : "All caught up"}` → `hint={kpis.pending > 0 ? "En attente de votre action" : "Tout est à jour"}`
9. `label="Total pupils"` → `label="Total des élèves"`
10. `label="Collected this month"` → `label="Encaissé ce mois-ci"`
11. `hint={`${formatCurrency(kpis.outstanding)} outstanding`}` → `hint={`${formatCurrency(kpis.outstanding)} restant dû`}`
12. `<h2 className="text-sm font-medium text-ink-700">Teacher directory</h2>` → `<h2 className="text-sm font-medium text-ink-700">Répertoire des enseignants</h2>`
13. `placeholder="Search name or email…"` → `placeholder="Rechercher un nom ou un e-mail…"`
14. `aria-label="Search teachers"` → `aria-label="Rechercher des enseignants"`
15. `aria-label="Filter by status"` → `aria-label="Filtrer par statut"`
16. `{s === "ALL" ? "All statuses" : s}` → `{s === "ALL" ? "Tous les statuts" : USER_STATUS_LABELS[s]}` (see Structural changes above)
17. `<EmptyState title="No teachers match these filters" />` → `<EmptyState title="Aucun enseignant ne correspond à ces filtres" />`
18. `<SortHeader label="Teacher" ... />` → `<SortHeader label="Enseignant" ... />`
19. `<SortHeader label="Status" ... />` → `<SortHeader label="Statut" ... />`
20. `<SortHeader label="Classes" ... />` → `<SortHeader label="Classes" ... />` (unchanged — same spelling in French)
21. `<SortHeader label="Pupils" ... />` → `<SortHeader label="Élèves" ... />`
22. `<SortHeader label="Collected / Expected" ... />` → `<SortHeader label="Encaissé / Attendu" ... />`
23. `<SortHeader label="Joined" ... />` → `<SortHeader label="Inscrit le" ... />`
24. `{t.pendingPupilRequests} pupil request{t.pendingPupilRequests === 1 ? "" : "s"}` → `{t.pendingPupilRequests} demande{t.pendingPupilRequests === 1 ? "" : "s"} d'élève{t.pendingPupilRequests === 1 ? "" : "s"}`
25. `{t.overdueCount} overdue` → `{t.overdueCount} en retard`
26. `<Button variant="secondary" size="sm" onClick={() => setRejectTarget(t)}>\n                            Reject\n                          </Button>` → `<Button variant="secondary" size="sm" onClick={() => setRejectTarget(t)}>\n                            Rejeter\n                          </Button>`
27. `<Button size="sm" onClick={() => approveMutation.mutate(t.id)}>\n                            Approve\n                          </Button>` → `<Button size="sm" onClick={() => approveMutation.mutate(t.id)}>\n                            Approuver\n                          </Button>`
28. `<span className="text-xs font-medium text-accent-600">View →</span>` → `<span className="text-xs font-medium text-accent-600">Voir →</span>`
29. `title="Reject this teacher?"` (ConfirmDialog) → `title="Rejeter cet enseignant ?"`
30. `` `${rejectTarget.name} (${rejectTarget.email}) will be denied access to the platform.` `` → `` `${rejectTarget.name} (${rejectTarget.email}) se verra refuser l'accès à la plateforme.` ``
31. `confirmLabel="Reject"` → `confirmLabel="Rejeter"`

**Not translated (per scope rules):**
- `STATUS_FILTERS`, `t.status`, `sortKeyValue`, `key`, `value={s}` — raw enum values used only as logic/value attributes, never rendered as label text directly (after fix #16 above).
- Comments, `data-testid`-style identifiers (none present), CSS classes.

**Test assertion updates:** none — no test file exists for `AdminPage.tsx`.

---

### File: `client/src/features/admin/TeacherDetailPage.tsx`

**Structural changes:**
- Change the existing import line `import { DAY_NAMES } from "../../lib/period";` to `import { DAY_NAMES, formatDate } from "../../lib/period";`.
- The inline `POST_TYPE_LABELS` map (line 17) is **not** one of the enums centralized in `client/src/lib/labels.ts` per the design spec (`PostType` is not in that list), and it does not exactly duplicate the similarly-named `TYPE_LABELS` map in `client/src/features/teacher/FeedPage.tsx` (that map translates `TEXT` as `"Post"`, this one translates it as `"Note"` — different values, different local meaning). Keep this map local to this file; just translate its string values in place (see Replacements #1 below). Do not import from `lib/labels.ts` for this one.
- Four bare `new Date(...).toLocaleDateString()` call sites, none of which pass an `options` argument, all become `formatDate(...)` calls using the already-updated import:
  - Line 81: `new Date(data.createdAt).toLocaleDateString()` → `formatDate(data.createdAt)`
  - Line 215: `new Date(r.dueDate).toLocaleDateString()` → `formatDate(r.dueDate)`
  - Line 242: `new Date(p.createdAt).toLocaleDateString()` → `formatDate(p.createdAt)`
  - Line 249: `new Date(p.dueDate).toLocaleDateString()` (inside the template literal) → `formatDate(p.dueDate)`

**Replacements** (exact old → new, in file order):
1. `const POST_TYPE_LABELS: Record<PostType, string> = { TEXT: "Note", FILE: "File", EXAM: "Exam" };` → `const POST_TYPE_LABELS: Record<PostType, string> = { TEXT: "Note", FILE: "Fichier", EXAM: "Examen" };` (`TEXT: "Note"` is unchanged — "Note" is already the correct French word for this post type.)
2. `if (slots.length === 0) return "No schedule set";` → `if (slots.length === 0) return "Aucun horaire défini";`
3. `Back to directory` (inside the `<Link to="/admin">` in `<ArrowLeft ... /> Back to directory`) → `Retour au répertoire`
4. `<p className="mt-1 text-xs text-ink-400">Joined {new Date(data.createdAt).toLocaleDateString()}</p>` → `<p className="mt-1 text-xs text-ink-400">Inscrit le {formatDate(data.createdAt)}</p>`
5. `{copied ? "Copied!" : "Copy code"}` → `{copied ? "Copié !" : "Copier le code"}`
6. `<Button variant="secondary" onClick={() => setRejectOpen(true)}>\n              Reject\n            </Button>` → `<Button variant="secondary" onClick={() => setRejectOpen(true)}>\n              Rejeter\n            </Button>`
7. `<Button onClick={() => approveMutation.mutate()}>Approve</Button>` → `<Button onClick={() => approveMutation.mutate()}>Approuver</Button>`
8. `title="Reject this teacher?"` (ConfirmDialog) → `title="Rejeter cet enseignant ?"`
9. `` description={`${data.name} (${data.email}) will be denied access to the platform.`} `` → `` description={`${data.name} (${data.email}) se verra refuser l'accès à la plateforme.`} ``
10. `confirmLabel="Reject"` → `confirmLabel="Rejeter"`
11. `label="Classes"` (first `StatCard`) → `label="Classes"` (unchanged — same spelling in French)
12. `label="Pupils"` (second `StatCard`) → `label="Élèves"`
13. `` hint={data.pendingPupilRequests > 0 ? `${data.pendingPupilRequests} pending request${data.pendingPupilRequests === 1 ? "" : "s"}` : undefined} `` → `` hint={data.pendingPupilRequests > 0 ? `${data.pendingPupilRequests} demande${data.pendingPupilRequests === 1 ? "" : "s"} en attente` : undefined} ``
14. `label="Collected this month"` → `label="Encaissé ce mois-ci"`
15. `` hint={`${formatCurrency(data.ledgerSummary.outstanding)} outstanding`} `` → `` hint={`${formatCurrency(data.ledgerSummary.outstanding)} restant dû`} ``
16. `label="Attendance rate"` → `label="Taux de présence"`
17. `` hint={`${data.attendance.present}/${data.attendance.total} this month`} `` → `` hint={`${data.attendance.present}/${data.attendance.total} ce mois-ci`} ``
18. `{data.pendingSwapRequests} pending swap request{data.pendingSwapRequests === 1 ? "" : "s"}` → `{data.pendingSwapRequests} demande{data.pendingSwapRequests === 1 ? "" : "s"} d'échange en attente`
19. `<h2 className="text-sm font-medium text-ink-700">Classes</h2>` → `<h2 className="text-sm font-medium text-ink-700">Classes</h2>` (unchanged — same spelling in French)
20. `<EmptyState title="No classes yet" />` → `<EmptyState title="Aucune classe pour le moment" />`
21. `<p className="mt-2 text-sm text-ink-500">{c._count?.pupils ?? c.pupils.length} pupils</p>` → `<p className="mt-2 text-sm text-ink-500">{c._count?.pupils ?? c.pupils.length} élèves</p>` (kept always-plural, matching the original's shape — the English text is not count-sensitive either)
22. `` {c.monthlyFee !== null ? `${formatCurrency(c.monthlyFee)}/month` : "No fee set"} `` → `` {c.monthlyFee !== null ? `${formatCurrency(c.monthlyFee)}/mois` : "Aucun tarif défini"} ``
23. `<h2 className="text-sm font-medium text-ink-700">Ledger — {data.ledgerSummary.period}</h2>` → `<h2 className="text-sm font-medium text-ink-700">Registre — {data.ledgerSummary.period}</h2>`
24. `<EmptyState title="No pupils billed this period" />` → `<EmptyState title="Aucun élève facturé pour cette période" />`
25. `<th scope="col" className="pb-2 pr-4 font-medium">Pupil</th>` → `<th scope="col" className="pb-2 pr-4 font-medium">Élève</th>`
26. `<th scope="col" className="pb-2 pr-4 font-medium">Class</th>` → `<th scope="col" className="pb-2 pr-4 font-medium">Classe</th>`
27. `<th scope="col" className="pb-2 pr-4 font-medium">Status</th>` → `<th scope="col" className="pb-2 pr-4 font-medium">Statut</th>`
28. `<th scope="col" className="pb-2 pr-4 font-medium">Due</th>` → `<th scope="col" className="pb-2 pr-4 font-medium">Dû</th>`
29. `<th scope="col" className="pb-2 pr-4 font-medium">Paid</th>` → `<th scope="col" className="pb-2 pr-4 font-medium">Payé</th>`
30. `<th scope="col" className="pb-2 font-medium">Due date</th>` → `<th scope="col" className="pb-2 font-medium">Date d'échéance</th>`
31. `{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—"}` → `{r.dueDate ? formatDate(r.dueDate) : "—"}`
32. `<h2 className="text-sm font-medium text-ink-700">Recent feed activity</h2>` → `<h2 className="text-sm font-medium text-ink-700">Activité récente des publications</h2>`
33. `<EmptyState title="No posts yet" />` → `<EmptyState title="Aucune publication pour le moment" />`
34. `<span className="text-xs text-ink-400">{new Date(p.createdAt).toLocaleDateString()}</span>` → `<span className="text-xs text-ink-400">{formatDate(p.createdAt)}</span>`
35. The exam-submissions summary paragraph:
    Old:
    ```
    {p.submissions?.length ?? 0} submission{(p.submissions?.length ?? 0) === 1 ? "" : "s"} ·{" "}
    {p.submissions?.filter((s) => s.grade !== null).length ?? 0} graded
    {p.dueDate && ` · due ${new Date(p.dueDate).toLocaleDateString()}`}
    ```
    New:
    ```
    {p.submissions?.length ?? 0} soumission{(p.submissions?.length ?? 0) === 1 ? "" : "s"} ·{" "}
    {p.submissions?.filter((s) => s.grade !== null).length ?? 0} notée{(p.submissions?.filter((s) => s.grade !== null).length ?? 0) === 1 ? "" : "s"}
    {p.dueDate && ` · échéance : ${formatDate(p.dueDate)}`}
    ```
    (The "graded"→"notée(s)" ternary is added because French adjective agreement requires a plural `-s` that English "graded" doesn't need; this is a per-instance hand fix for grammar, not a new shared pluralization utility, consistent with §8 of the design spec.)

**Not translated (per scope rules):**
- `data.teacherCode` displayed verbatim — user data, not app copy.
- `p.content` displayed verbatim — user-generated content.
- `c.name`, `data.name`, `data.email`, `r.name`, `r.email`, `p.class.name` — user data.
- `<StatusBadge status={data.status} />`, `<ClassTypeBadge type={c.type} />`, `<PaymentBadge status={r.status} />` — shared `Badge.tsx` component internals, out of scope for this file (covered by the shared-components batch).
- `type PostType` import and `Record<PostType, string>` type annotation — type-level code, not visible text.

**Test assertion updates:** none — no test file exists for `TeacherDetailPage.tsx`.

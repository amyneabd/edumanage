# French Localization — Batch: teacher-pages-1

Files covered:
- `client/src/features/teacher/ClassesPage.tsx` (includes co-located `VacationBanner` component)
- `client/src/features/teacher/ClassDetailPage.tsx` (includes co-located `VacationSessionsPanel` component)
- `client/src/features/teacher/FeedPage.tsx`
- `client/src/features/teacher/GoalsPanel.tsx`

Test files found for this batch: `client/src/features/teacher/VacationBanner.test.tsx`, `client/src/features/teacher/VacationSessionsPanel.test.tsx`. No dedicated test files exist for `ClassesPage.tsx`, `ClassDetailPage.tsx`, `FeedPage.tsx`, or `GoalsPanel.tsx` themselves (confirmed via glob — only the two Vacation sub-component test files exist).

Depends on centralization work (§3 of the design spec) already having landed: `client/src/lib/labels.ts` exporting `CLASS_TYPE_LABELS`, `PAYMENT_STATUS_LABELS`, etc.; `client/src/lib/period.ts` exporting `formatDate()` and a French `DAY_NAMES` array.

---

### File: client/src/features/teacher/ClassesPage.tsx

**New imports needed:**
```ts
import { formatDate } from "../../lib/period";
import { CLASS_TYPE_LABELS } from "../../lib/labels";
```

**Replacements:**

1. `RequestCard` — drag handle aria-label (line 75):
   - Old: `` aria-label={`Drag ${request.name} onto a class to enroll, or use the assign menu below`} ``
   - New: `` aria-label={`Faites glisser ${request.name} sur une classe pour l'inscrire, ou utilisez le menu d'affectation ci-dessous`} ``

2. `RequestCard` — sr-only label (line 85):
   - Old: `<span className="sr-only">Assign {request.name} to a class</span>`
   - New: `<span className="sr-only">Affecter {request.name} à une classe</span>`

3. `RequestCard` — select placeholder option (lines 94-96):
   - Old:
     ```
     <option value="" disabled>
       Assign to class…
     </option>
     ```
   - New:
     ```
     <option value="" disabled>
       Affecter à une classe…
     </option>
     ```
   (Not an enum-option site — this is a plain placeholder string, not backed by `CLASS_TYPES`/`ClassType`. Straight text replacement.)

4. `ClassCard` — pupil count with hand-rolled pluralization (line 138):
   - Old: `<p className="text-sm text-ink-500">{pupilCount} pupil{pupilCount === 1 ? "" : "s"}</p>`
   - New: `<p className="text-sm text-ink-500">{pupilCount} élève{pupilCount === 1 ? "" : "s"}</p>`

5. `ClassCard` — monthly fee unit (line 139):
   - Old: `{monthlyFee != null && <p className="text-sm font-medium text-ink-700">{monthlyFee} TND/mo</p>}`
   - New: `{monthlyFee != null && <p className="text-sm font-medium text-ink-700">{monthlyFee} TND/mois</p>}`

6. `SwapRequestRow` — "misses ... on <date>" sentence (lines 161-169):
   - Old:
     ```
     <p className="text-sm font-medium text-ink-900">
       {request.pupilName} <span className="font-normal text-ink-400">misses</span> {request.originClassName}{" "}
       <span className="font-normal text-ink-400">on</span>{" "}
       {new Date(request.originDate).toLocaleDateString(undefined, {
         weekday: "short",
         month: "short",
         day: "numeric",
       })}
     </p>
     ```
   - New:
     ```
     <p className="text-sm font-medium text-ink-900">
       {request.pupilName} <span className="font-normal text-ink-400">manque</span> {request.originClassName}{" "}
       <span className="font-normal text-ink-400">le</span>{" "}
       {formatDate(request.originDate, {
         weekday: "short",
         month: "short",
         day: "numeric",
       })}
     </p>
     ```

7. `SwapRequestRow` — "to join ... on <date>" sentence (lines 170-177):
   - Old:
     ```
     <p className="mt-0.5 text-xs text-ink-500">
       to join {request.targetClassName} on{" "}
       {new Date(request.targetDate).toLocaleDateString(undefined, {
         weekday: "short",
         month: "short",
         day: "numeric",
       })}
     </p>
     ```
   - New:
     ```
     <p className="mt-0.5 text-xs text-ink-500">
       pour rejoindre {request.targetClassName} le{" "}
       {formatDate(request.targetDate, {
         weekday: "short",
         month: "short",
         day: "numeric",
       })}
     </p>
     ```

8. `SwapRequestRow` — buttons (lines 182-187):
   - Old: `Decline` → New: `Refuser`
   - Old: `Approve` → New: `Approuver`

9. `ParentRequestRow` — "wants to link to" sentence (lines 206-209):
   - Old:
     ```
     <p className="text-sm font-medium text-ink-900">
       {request.parentName} <span className="font-normal text-ink-400">wants to link to</span> {request.pupilName}
     </p>
     ```
   - New:
     ```
     <p className="text-sm font-medium text-ink-900">
       {request.parentName} <span className="font-normal text-ink-400">veut se lier à</span> {request.pupilName}
     </p>
     ```

10. `ParentRequestRow` — fallback class name (line 211):
    - Old: `{request.parentEmail} · {request.className ?? "Not yet assigned to a class"}`
    - New: `{request.parentEmail} · {request.className ?? "Pas encore affecté à une classe"}`

11. `ParentRequestRow` — buttons (lines 215-220):
    - Old: `Decline` → New: `Refuser`
    - Old: `Approve` → New: `Approuver`

12. `VacationBanner` — start mutation toast (line 242):
    - Old: `toast.success("Vacation mode started.");`
    - New: `toast.success("Mode vacances activé.");`

13. `VacationBanner` — end mutation toast (line 253):
    - Old: `toast.success("Vacation mode ended. Weekly schedules have resumed.");`
    - New: `toast.success("Mode vacances désactivé. Les emplois du temps hebdomadaires ont repris.");`

14. `VacationBanner` — active-period heading (line 266):
    - Old: `<h2 className="text-sm font-medium text-ink-700">Vacation mode is active</h2>`
    - New: `<h2 className="text-sm font-medium text-ink-700">Mode vacances actif</h2>`

15. `VacationBanner` — active-period date range (lines 267-277):
    - Old:
      ```
      <p className="mt-1 text-xs text-ink-500">
        {new Date(`${period.startDate.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}{" "}
        –{" "}
        {new Date(`${period.endDate.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </p>
      ```
    - New:
      ```
      <p className="mt-1 text-xs text-ink-500">
        {formatDate(`${period.startDate.slice(0, 10)}T00:00:00`, {
          month: "short",
          day: "numeric",
        })}{" "}
        –{" "}
        {formatDate(`${period.endDate.slice(0, 10)}T00:00:00`, {
          month: "short",
          day: "numeric",
        })}
      </p>
      ```

16. `VacationBanner` — end button (lines 279-281):
    - Old: `{endMutation.isPending ? "Ending…" : "End vacation mode"}`
    - New: `{endMutation.isPending ? "Désactivation…" : "Désactiver le mode vacances"}`

17. `VacationBanner` — date-range form labels (lines 292-293, 305-306):
    - Old: `Start date` → New: `Date de début`
    - Old: `End date` → New: `Date de fin`

18. `VacationBanner` — submit/cancel buttons in the form (lines 317-322):
    - Old: `{startMutation.isPending ? "Starting…" : "Start"}`
    - New: `{startMutation.isPending ? "Activation…" : "Activer"}`
    - Old: `Cancel` → New: `Annuler`

19. `VacationBanner` — idle heading + copy (lines 326-330):
    - Old:
      ```
      <h2 className="text-sm font-medium text-ink-700">Vacation mode</h2>
      <p className="mt-1 text-xs text-ink-500">
        Suspend the weekly schedule for a date range and pick one-off sessions per class instead.
      </p>
      ```
    - New:
      ```
      <h2 className="text-sm font-medium text-ink-700">Mode vacances</h2>
      <p className="mt-1 text-xs text-ink-500">
        Suspendez l'emploi du temps hebdomadaire pour une période donnée et choisissez des séances ponctuelles pour chaque classe à la place.
      </p>
      ```

20. `VacationBanner` — start button (line 333):
    - Old: `Start vacation mode` → New: `Activer le mode vacances`

21. `ClassesPage` — page heading + intro copy (lines 449-452):
    - Old:
      ```
      <h1 className="text-2xl font-semibold text-ink-900">Class management</h1>
      <p className="mt-1 text-sm text-ink-500">
      Drag a pupil request onto a class to enroll them, or use the assign menu on each card.
      </p>
      ```
    - New:
      ```
      <h1 className="text-2xl font-semibold text-ink-900">Gestion des classes</h1>
      <p className="mt-1 text-sm text-ink-500">
      Faites glisser une demande d'élève sur une classe pour l'inscrire, ou utilisez le menu d'affectation sur chaque carte.
      </p>
      ```

22. `ClassesPage` — "New class" button (lines 454-457):
    - Old: `New class` (button text next to `<Plus>` icon)
    - New: `Nouvelle classe`

23. `ClassesPage` — swap-request mutation toast (line 378):
    - Old: `toast.success("Swap request approved.");`
    - New: `toast.success("Demande d'échange approuvée.");`

24. `ClassesPage` — parent-request mutation toast (line 397):
    - Old: `toast.success("Parent link approved.");`
    - New: `toast.success("Lien parent approuvé.");`

25. `ClassesPage` — class-creation toast (line 410):
    - Old: `toast.success("Class created.");`
    - New: `toast.success("Classe créée.");`

26. `ClassesPage` — pupil-assignment toast (line 421):
    - Old: `toast.success("Pupil enrolled.");`
    - New: `toast.success("Élève inscrit.");`

27. "Pending requests" section (lines 463-467):
    - Old: `<h2 className="text-sm font-medium text-ink-700">Pending requests</h2>`
    - New: `<h2 className="text-sm font-medium text-ink-700">Demandes en attente</h2>`
    - Old: `<EmptyState title="No pending pupil requests" description="New sign-ups will appear here." />`
    - New: `<EmptyState title="Aucune demande d'élève en attente" description="Les nouvelles inscriptions apparaîtront ici." />`

28. Reject-request icon button (lines 478-484):
    - Old: `title="Reject request"` / `` aria-label={`Reject ${r.name}'s request`} ``
    - New: `title="Rejeter la demande"` / `` aria-label={`Rejeter la demande de ${r.name}`} ``

29. "Session swap requests" section (lines 493-502):
    - Old: `<h2 className="text-sm font-medium text-ink-700">Session swap requests</h2>`
    - New: `<h2 className="text-sm font-medium text-ink-700">Demandes d'échange de séance</h2>`
    - Old:
      ```
      <EmptyState
        title="No pending swap requests"
        description="Pupils requesting to swap into another class's session will appear here."
      />
      ```
    - New:
      ```
      <EmptyState
        title="Aucune demande d'échange en attente"
        description="Les élèves demandant à échanger vers la séance d'une autre classe apparaîtront ici."
      />
      ```

30. "Parent link requests" section (lines 519-526):
    - Old: `<h2 className="text-sm font-medium text-ink-700">Parent link requests</h2>`
    - New: `<h2 className="text-sm font-medium text-ink-700">Demandes de lien parent</h2>`
    - Old:
      ```
      <EmptyState
        title="No pending parent requests"
        description="Parents requesting to link to a pupil account will appear here."
      />
      ```
    - New:
      ```
      <EmptyState
        title="Aucune demande de parent en attente"
        description="Les parents demandant à se lier à un compte élève apparaîtront ici."
      />
      ```

31. "Classes" section (lines 545-548):
    - Old: `<h2 className="text-sm font-medium text-ink-700">Classes</h2>`
    - New: unchanged, `Classes` (glossary term, identical in French)
    - Old: `<EmptyState title="No classes yet" description="Create your first class to get started." />`
    - New: `<EmptyState title="Aucune classe pour le moment" description="Créez votre première classe pour commencer." />`

32. New-class modal title (line 567):
    - Old: `<Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New class">`
    - New: `<Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle classe">`

33. New-class form fields (lines 576-611):
    - Old: `<label htmlFor="new-class-name" className="text-sm font-medium text-ink-700">Class name</label>`
    - New: `<label htmlFor="new-class-name" className="text-sm font-medium text-ink-700">Nom de la classe</label>`
    - Old: `placeholder="e.g. Math A - Evenings"`
    - New: `placeholder="ex. Maths A - Soirs"`
    - Old: `<label htmlFor="new-class-type" className="text-sm font-medium text-ink-700">Type</label>`
    - New: unchanged, `Type` (identical in French)
    - Old: `<label htmlFor="new-class-monthly-fee" className="text-sm font-medium text-ink-700">Monthly fee (optional)</label>`
    - New: `<label htmlFor="new-class-monthly-fee" className="text-sm font-medium text-ink-700">Frais mensuels (facultatif)</label>`
    - Old: `placeholder="e.g. 150"`
    - New: `placeholder="ex. 150"`
    - Old: `<p className="mt-1 text-xs text-ink-400">Used as the default amount due each month in the Ledger.</p>`
    - New: `<p className="mt-1 text-xs text-ink-400">Utilisé comme montant dû par défaut chaque mois dans le Registre.</p>`

34. New-class submit button (line 614):
    - Old: `{createMutation.isPending ? "Creating…" : "Create class"}`
    - New: `{createMutation.isPending ? "Création…" : "Créer la classe"}`

**Structural changes:**

- Enum-as-`<option>`-text site — `CLASS_TYPES.map` in the new-class Type `<select>` (lines 594-598). Do NOT change the `CLASS_TYPES` array or the `type`/`ClassType` state — only the rendered option text:
  - Old:
    ```
    {CLASS_TYPES.map((t) => (
      <option key={t} value={t}>
        {t}
      </option>
    ))}
    ```
  - New:
    ```
    {CLASS_TYPES.map((t) => (
      <option key={t} value={t}>
        {CLASS_TYPE_LABELS[t]}
      </option>
    ))}
    ```
- Add `import { CLASS_TYPE_LABELS } from "../../lib/labels";` alongside the existing `../../api/teacher` and `../../api/types` imports.
- Add `import { formatDate } from "../../lib/period";` (this file currently has no import from `../../lib/period` at all) and replace the four bare `new Date(...).toLocaleDateString(undefined, {...})` call sites listed in items 6, 7, 15 above with `formatDate(...)` calls, preserving the existing `options` objects (`{ weekday: "short", month: "short", day: "numeric" }` and `{ month: "short", day: "numeric" }`) exactly as-is.

**Test assertion updates:** (`client/src/features/teacher/VacationBanner.test.tsx`)

1. Line 26: `expect(await screen.findByText("Start vacation mode")).toBeInTheDocument();` → `expect(await screen.findByText("Activer le mode vacances")).toBeInTheDocument();`
2. Line 32: `fireEvent.click(await screen.findByText("Start vacation mode"));` → `fireEvent.click(await screen.findByText("Activer le mode vacances"));`
3. Line 33: `expect(await screen.findByLabelText("Start date")).toBeInTheDocument();` → `expect(await screen.findByLabelText("Date de début")).toBeInTheDocument();`
4. Line 34: `expect(screen.getByLabelText("End date")).toBeInTheDocument();` → `expect(screen.getByLabelText("Date de fin")).toBeInTheDocument();`
5. Line 48: `expect(await screen.findByText("Vacation mode is active")).toBeInTheDocument();` → `expect(await screen.findByText("Mode vacances actif")).toBeInTheDocument();`
6. Line 49: `expect(screen.getByText("End vacation mode")).toBeInTheDocument();` → `expect(screen.getByText("Désactiver le mode vacances")).toBeInTheDocument();`

---

### File: client/src/features/teacher/ClassDetailPage.tsx

**New imports needed:**
```ts
import { currentPeriod, DAY_NAMES, formatDate } from "../../lib/period"; // add formatDate to the existing import
import { PAYMENT_STATUS_LABELS } from "../../lib/labels";
```

**Replacements:**

1. `VacationSessionsPanel` — add-session toast (line 50):
   - Old: `toast.success("Ad-hoc session added.");`
   - New: `toast.success("Séance ponctuelle ajoutée.");`

2. `VacationSessionsPanel` — panel heading (line 68):
   - Old: `<h2 className="text-sm font-medium text-ink-700">Vacation sessions</h2>`
   - New: `<h2 className="text-sm font-medium text-ink-700">Séances de vacances</h2>`

3. `VacationSessionsPanel` — date-range description (lines 69-81):
   - Old:
     ```
     <p className="mt-1 text-xs text-ink-400">
       One-off sessions for this class between{" "}
       {new Date(`${period.startDate.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
         month: "short",
         day: "numeric",
       })}{" "}
       and{" "}
       {new Date(`${period.endDate.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
         month: "short",
         day: "numeric",
       })}
       .
     </p>
     ```
   - New:
     ```
     <p className="mt-1 text-xs text-ink-400">
       Séances ponctuelles pour cette classe entre{" "}
       {formatDate(`${period.startDate.slice(0, 10)}T00:00:00`, {
         month: "short",
         day: "numeric",
       })}{" "}
       et{" "}
       {formatDate(`${period.endDate.slice(0, 10)}T00:00:00`, {
         month: "short",
         day: "numeric",
       })}
       .
     </p>
     ```

4. `VacationSessionsPanel` — session row date (lines 86-91):
   - Old:
     ```
     <span className="w-28 text-xs text-ink-700">
       {new Date(`${s.date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
         weekday: "short",
         month: "short",
         day: "numeric",
       })}
     </span>
     ```
   - New:
     ```
     <span className="w-28 text-xs text-ink-700">
       {formatDate(`${s.date.slice(0, 10)}T00:00:00`, {
         weekday: "short",
         month: "short",
         day: "numeric",
       })}
     </span>
     ```

5. `VacationSessionsPanel` — remove-session button (lines 96-99):
   - Old: `` aria-label={`Remove vacation session on ${s.date}`} ``
   - New: `` aria-label={`Supprimer la séance de vacances du ${s.date}`} ``

6. `VacationSessionsPanel` — empty state (line 105):
   - Old: `{sessions.length === 0 && <p className="text-xs text-ink-400">No ad-hoc sessions added yet.</p>}`
   - New: `{sessions.length === 0 && <p className="text-xs text-ink-400">Aucune séance ponctuelle ajoutée pour le moment.</p>}`

7. `VacationSessionsPanel` — submit button (line 137):
   - Old: `{addMutation.isPending ? "Adding…" : "Add session"}`
   - New: `{addMutation.isPending ? "Ajout…" : "Ajouter une séance"}`

8. `ClassDetailPage` — back link (lines 219-225):
   - Old: `Back to classes` (text node after the `ArrowLeft` icon)
   - New: `Retour aux classes`

9. `ClassDetailPage` — monthly fee label (lines 230-231):
   - Old: `<label className="flex items-center gap-1.5 text-sm text-ink-500">\n  Monthly fee`
   - New: `<label className="flex items-center gap-1.5 text-sm text-ink-500">\n  Frais mensuels`

10. Pupil removal toast (line 168):
    - Old: `toast.success("Pupil removed from class.");`
    - New: `toast.success("Élève retiré de la classe.");`

11. Schedule-save toast (line 183):
    - Old: `toast.success("Schedule saved.");`
    - New: `toast.success("Emploi du temps enregistré.");`

12. "Members" card heading + empty state (lines 252-255):
    - Old: `<h2 className="text-sm font-medium text-ink-700">Members ({klass.pupils.length})</h2>`
    - New: `<h2 className="text-sm font-medium text-ink-700">Membres ({klass.pupils.length})</h2>`
    - Old: `<EmptyState title="No pupils yet" description="Drag a request into this class from Class Management." />`
    - New: `<EmptyState title="Aucun élève pour le moment" description="Faites glisser une demande dans cette classe depuis la Gestion des classes." />`

13. Members table headers (lines 262-264):
    - Old: `<th scope="col" className="pb-2 font-medium">Name</th>`
    - New: `<th scope="col" className="pb-2 font-medium">Nom</th>`
    - Old: `<th scope="col" className="pb-2 font-medium">Payment ({period})</th>`
    - New: `<th scope="col" className="pb-2 font-medium">Paiement ({period})</th>`

14. Pupil name button title (lines 273-278):
    - Old: `title="View pupil details and attendance"`
    - New: `title="Voir les détails et les présences de l'élève"`

15. Remove-from-class button (lines 302-307):
    - Old: `Remove`
    - New: `Retirer`

16. "Class schedule" card heading + hint (lines 319-320):
    - Old:
      ```
      <h2 className="text-sm font-medium text-ink-700">Class schedule</h2>
      <p className="mt-1 text-xs text-ink-400">Shared with pupils in this class.</p>
      ```
    - New:
      ```
      <h2 className="text-sm font-medium text-ink-700">Emploi du temps de la classe</h2>
      <p className="mt-1 text-xs text-ink-400">Partagé avec les élèves de cette classe.</p>
      ```

17. Remove-time-slot button aria-label (lines 361-365):
    - Old: `` aria-label={`Remove ${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime} time slot`} ``
    - New: `` aria-label={`Supprimer le créneau du ${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime}`} ``

18. "Add time slot" button (lines 373-379):
    - Old: `Add time slot`
    - New: `Ajouter un créneau`

19. Save-schedule button (lines 380-382):
    - Old: `{scheduleMutation.isPending ? "Saving…" : "Save schedule"}`
    - New: `{scheduleMutation.isPending ? "Enregistrement…" : "Enregistrer l'emploi du temps"}`

20. "Upcoming visitors" card (lines 390-394):
    - Old:
      ```
      <h2 className="text-sm font-medium text-ink-700">Upcoming visitors</h2>
      <p className="mt-1 text-xs text-ink-400">Pupils approved to sit in on a future session of this class.</p>
      ```
    - New:
      ```
      <h2 className="text-sm font-medium text-ink-700">Visiteurs à venir</h2>
      <p className="mt-1 text-xs text-ink-400">Élèves autorisés à assister à une prochaine séance de cette classe.</p>
      ```
    - Old: `<EmptyState title="No upcoming visitors" description="Approved one-off session requests will show here." />`
    - New: `<EmptyState title="Aucun visiteur à venir" description="Les demandes de séance ponctuelle approuvées s'afficheront ici." />`

21. Visitor row date (lines 404-411):
    - Old:
      ```
      <p className="text-sm text-ink-700">
        {new Date(v.targetDate).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </p>
      ```
    - New:
      ```
      <p className="text-sm text-ink-700">
        {formatDate(v.targetDate, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </p>
      ```

22. "Parent link requests" card (lines 420-425):
    - Old:
      ```
      <h2 className="text-sm font-medium text-ink-700">Parent link requests</h2>
      <p className="mt-1 text-xs text-ink-400">Parents requesting to follow a pupil in this class.</p>
      ```
    - New:
      ```
      <h2 className="text-sm font-medium text-ink-700">Demandes de lien parent</h2>
      <p className="mt-1 text-xs text-ink-400">Parents demandant à suivre un élève dans cette classe.</p>
      ```
    - Old: `<EmptyState title="No pending requests" description="Parent link requests for this class will show here." />`
    - New: `<EmptyState title="Aucune demande en attente" description="Les demandes de lien parent pour cette classe s'afficheront ici." />`

23. Parent-request row buttons (lines 444, 452):
    - Old: `Decline` → New: `Refuser`
    - Old: `Approve` → New: `Approuver`

24. Parent-link toast (line 205):
    - Old: `toast.success("Parent link approved.");`
    - New: `toast.success("Lien parent approuvé.");`

25. Confirm-remove dialog (lines 462-468):
    - Old: `title="Remove pupil from class?"`
    - New: `title="Retirer l'élève de la classe ?"`
    - Old: `` description={removeTarget ? `${removeTarget.user.name} will lose access to this class's feed and schedule.` : undefined} ``
    - New: `` description={removeTarget ? `${removeTarget.user.name} perdra l'accès aux publications et à l'emploi du temps de cette classe.` : undefined} ``
    - Old: `confirmLabel="Remove"`
    - New: `confirmLabel="Retirer"`

**Structural changes:**

- Enum-as-`<option>`-text site — `PAYMENT_STATUSES.map` in the per-pupil payment-status `<select>` (lines 291-295). Do NOT change the `PAYMENT_STATUSES` array or the `PaymentStatus` type usage — only the rendered option text:
  - Old:
    ```
    {PAYMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
    ```
  - New:
    ```
    {PAYMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {PAYMENT_STATUS_LABELS[s]}
                            </option>
                          ))}
    ```
- `DAY_NAMES.map` in the schedule-slot day `<select>` (lines 334-338) needs NO per-file change — `DAY_NAMES` itself becomes the French array (`["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]`) via the centralization task on `client/src/lib/period.ts`, so this file automatically renders French day abbreviations once that lands. Do not add a separate label lookup for it.
- Add `import { PAYMENT_STATUS_LABELS } from "../../lib/labels";`.
- Extend the existing `import { currentPeriod, DAY_NAMES } from "../../lib/period";` to also import `formatDate`, and replace the four bare `new Date(...).toLocaleDateString(undefined, {...})` call sites listed in items 3, 4, 21 above with `formatDate(...)`, preserving the existing `options` objects exactly.

**Test assertion updates:** (`client/src/features/teacher/VacationSessionsPanel.test.tsx`)

1. Line 48: `expect(await screen.findByText("No ad-hoc sessions added yet.")).toBeInTheDocument();` → `expect(await screen.findByText("Aucune séance ponctuelle ajoutée pour le moment.")).toBeInTheDocument();`
2. Line 63: `expect(await screen.findByText("10:00–11:00")).toBeInTheDocument();` — no change. This asserts a raw `HH:mm–HH:mm` time string built from `s.startTime`/`s.endTime`, which per design spec §4 is displayed unchanged (24-hour raw strings, no locale formatting applied).

---

### File: client/src/features/teacher/FeedPage.tsx

**Replacements:**

1. Post-type label map (line 13):
   - Old: `const TYPE_LABELS: Record<PostType, string> = { TEXT: "Post", FILE: "File", EXAM: "Exam" };`
   - New: `const TYPE_LABELS: Record<PostType, string> = { TEXT: "Publication", FILE: "Fichier", EXAM: "Examen" };`
   (Not the enum-option issue — `TYPE_LABELS` is already a display-only lookup rendered via `{TYPE_LABELS[post.type]}`, never used as a raw enum value in an `<option>`. Just translate the values in place; keep the object keys `TEXT`/`FILE`/`EXAM` untouched.)

2. Post-type filter buttons (lines 14-19):
   - Old:
     ```
     const TYPE_FILTERS: { value: PostType | "ALL"; label: string }[] = [
       { value: "ALL", label: "All" },
       { value: "TEXT", label: "Posts" },
       { value: "FILE", label: "Files" },
       { value: "EXAM", label: "Exams" },
     ];
     ```
   - New:
     ```
     const TYPE_FILTERS: { value: PostType | "ALL"; label: string }[] = [
       { value: "ALL", label: "Tout" },
       { value: "TEXT", label: "Publications" },
       { value: "FILE", label: "Fichiers" },
       { value: "EXAM", label: "Examens" },
     ];
     ```
   (Also not the enum-option issue — these render via `{f.label}` on plain `<button>` elements, not `<option>` text, and `label` is already a display-only field decoupled from `value`.)

3. Empty-classes state (lines 112-116):
   - Old:
     ```
     <h1 className="text-2xl font-semibold text-ink-900">Communication</h1>
     <div className="mt-6">
       <EmptyState title="Create a class first" description="Posts and exams live inside a class channel." />
     </div>
     ```
   - New:
     ```
     <h1 className="text-2xl font-semibold text-ink-900">Communication</h1>
     <div className="mt-6">
       <EmptyState title="Créez d'abord une classe" description="Les publications et examens se trouvent dans le canal d'une classe." />
     </div>
     ```
   ("Communication" is unchanged — identical spelling/meaning in French, not an English word needing translation.)

4. Page heading, second occurrence (line 135):
   - Old: `<h1 className="text-2xl font-semibold text-ink-900">Communication</h1>`
   - New: unchanged, `Communication`

5. Post composer placeholder (lines 160-166):
   - Old: `` placeholder={`Post something to ${classes.find((c) => c.id === classId)?.name ?? "this class"}…`} ``
   - New: `` placeholder={`Publiez quelque chose dans ${classes.find((c) => c.id === classId)?.name ?? "cette classe"}…`} ``

6. "This is an exam" checkbox label (lines 175-183):
   - Old: `This is an exam`
   - New: `Ceci est un examen`

7. Max-grade input placeholder, composer (line 198):
   - Old: `placeholder="Max grade"`
   - New: `placeholder="Note maximale"`

8. Post submit button (lines 204-206):
   - Old: `{createMutation.isPending ? "Posting…" : "Post"}`
   - New: `{createMutation.isPending ? "Publication…" : "Publier"}`

9. Post-created toast (line 65):
   - Old: `toast.success(isExam ? "Exam posted." : "Posted to class feed.");`
   - New: `toast.success(isExam ? "Examen publié." : "Publié dans les publications de la classe.");`

10. Search input placeholder (lines 213-218):
    - Old: `placeholder="Search posts…"`
    - New: `placeholder="Rechercher des publications…"`

11. Posts empty state (line 241):
    - Old: `<EmptyState title={posts.length ? "No posts match your filters" : "No posts yet"} />`
    - New: `<EmptyState title={posts.length ? "Aucune publication ne correspond à vos filtres" : "Aucune publication pour le moment"} />`

12. Delete-post confirm dialog (lines 262-271):
    - Old: `title="Delete this post?"`
    - New: `title="Supprimer cette publication ?"`
    - Old:
      ```
      description={
              deleteTarget?.type === "EXAM"
                ? "This exam and every pupil submission and grade attached to it will be permanently deleted."
                : "This can't be undone."
            }
      ```
    - New:
      ```
      description={
              deleteTarget?.type === "EXAM"
                ? "Cet examen ainsi que toutes les soumissions et notes des élèves qui y sont associées seront définitivement supprimés."
                : "Cette action est irréversible."
            }
      ```
    - Old: `confirmLabel="Delete"`
    - New: `confirmLabel="Supprimer"`

13. Post-deleted toast (line 99):
    - Old: `toast.success("Post deleted.");`
    - New: `toast.success("Publication supprimée.");`

14. `PostCard` — "edited" marker (lines 313-317):
    - Old:
      ```
      {post.editedAt && (
              <span className="text-xs italic text-ink-400" title={`Edited ${new Date(post.editedAt).toLocaleString()}`}>
                · edited
              </span>
            )}
      ```
    - New:
      ```
      {post.editedAt && (
              <span className="text-xs italic text-ink-400" title={`Modifié le ${new Date(post.editedAt).toLocaleString()}`}>
                · modifié
              </span>
            )}
      ```
    - Note: `new Date(post.editedAt).toLocaleString()` is a `toLocaleString()` call, not `toLocaleDateString()`. It is out of scope for the `formatDate()` conversion described in design spec §3/§4 (which only names bare `toLocaleDateString()` sites). Left as-is — only the surrounding static text ("Edited " → "Modifié le ", "edited" → "modifié") is translated. This does mean the timestamp itself will still render in the browser's default locale rather than forced `fr-FR`; flagging for awareness but not changing per the given conversion rule's scope.

15. `PostCard` — created-at display (line 320):
    - Old: `<span className="text-xs text-ink-400">{new Date(post.createdAt).toLocaleString()}</span>`
    - New: unchanged — same `toLocaleString()` out-of-scope note as item 14 applies; no static text to translate here (it's a bare date/time render).

16. `PostCard` — edit/delete buttons (lines 323-337):
    - Old: `Edit` → New: `Modifier`
    - Old: `{deleting ? "Deleting…" : "Delete"}` → New: `{deleting ? "Suppression…" : "Supprimer"}`

17. `PostEditForm` — "Replace file" label (lines 416-424):
    - Old:
      ```
      <label className="flex items-center gap-1 text-xs text-ink-500">
            Replace file
      ```
    - New:
      ```
      <label className="flex items-center gap-1 text-xs text-ink-500">
            Remplacer le fichier
      ```

18. `PostEditForm` — max-grade placeholder (line 410):
    - Old: `placeholder="Max grade"`
    - New: `placeholder="Note maximale"`

19. `PostEditForm` — cancel/save buttons (lines 427-444):
    - Old: `Cancel` → New: `Annuler`
    - Old: `{saving ? "Saving…" : "Save"}` → New: `{saving ? "Enregistrement…" : "Enregistrer"}`

20. `ExamSubmissions` — grade-saved toast (line 473):
    - Old: `toast.success("Grade saved.");`
    - New: `toast.success("Note enregistrée.");`

21. `ExamSubmissions` — due-date + submission counts (lines 480-486):
    - Old:
      ```
      <div className="text-xs text-ink-500">
              {post.dueDate && <span>Due {new Date(post.dueDate).toLocaleDateString()} · </span>}
              {submissions.length} of {activeRoster.length} submitted
              {submissions.length > 0 && <span> · {gradedCount} of {submissions.length} graded</span>}
              {post.maxGrade != null && <span> · out of {post.maxGrade}</span>}
            </div>
      ```
    - New:
      ```
      <div className="text-xs text-ink-500">
              {post.dueDate && <span>Échéance : {formatDate(post.dueDate)} · </span>}
              {submissions.length} sur {activeRoster.length} soumises
              {submissions.length > 0 && <span> · {gradedCount} sur {submissions.length} notées</span>}
              {post.maxGrade != null && <span> · sur {post.maxGrade}</span>}
            </div>
      ```
    (This converts one of the two bare `toLocaleDateString()` sites in this file — see Structural changes below for the required import.)

22. `ExamSubmissions` — expand/collapse button (lines 487-493):
    - Old: `{expanded ? "Hide roster" : "View & grade"}`
    - New: `{expanded ? "Masquer la liste" : "Voir et noter"}`

23. `ExamSubmissions` — submitted/missing headings and empty copy (lines 498-529):
    - Old: `<p className="text-xs font-medium text-ink-500">Submitted ({submissions.length})</p>`
    - New: `<p className="text-xs font-medium text-ink-500">Soumissions ({submissions.length})</p>`
    - Old: `<p className="mt-1 text-xs text-ink-400">No submissions yet.</p>`
    - New: `<p className="mt-1 text-xs text-ink-400">Aucune soumission pour le moment.</p>`
    - Old: `<p className="text-xs font-medium text-ink-500">Missing ({missing.length})</p>`
    - New: `<p className="text-xs font-medium text-ink-500">Manquants ({missing.length})</p>`
    - Old: `<p className="mt-1 text-xs text-ink-400">Everyone has submitted.</p>`
    - New: `<p className="mt-1 text-xs text-ink-400">Tout le monde a soumis son travail.</p>`

24. `SubmissionGradeRow` — pupil-name fallback, read view (line 563):
    - Old: `{submission.pupil?.user.name ?? "Pupil"}`
    - New: `{submission.pupil?.user.name ?? "Élève"}`

25. `SubmissionGradeRow` — submitted-at date (line 565):
    - Old: `<span className="text-ink-400"> · {new Date(submission.submittedAt).toLocaleDateString()}</span>`
    - New: `<span className="text-ink-400"> · {formatDate(submission.submittedAt)}</span>`
    (Second of the two bare `toLocaleDateString()` sites in this file.)

26. `SubmissionGradeRow` — grade badge / grade button (lines 568-581):
    - Old: `<span className="rounded-full bg-accent-100 px-2 py-0.5 font-semibold text-accent-600">Ungraded</span>`
    - New: `<span className="rounded-full bg-accent-100 px-2 py-0.5 font-semibold text-accent-600">Non noté</span>`
    - Old: `{isGraded ? "Edit grade" : "Grade"}`
    - New: `{isGraded ? "Modifier la note" : "Noter"}`

27. `SubmissionGradeRow` — pupil-name fallback, edit view (line 592):
    - Old: `<span className="font-medium text-ink-900">{submission.pupil?.user.name ?? "Pupil"}</span>`
    - New: `<span className="font-medium text-ink-900">{submission.pupil?.user.name ?? "Élève"}</span>`

28. `SubmissionGradeRow` — "View file" link (lines 593-600):
    - Old: `View file`
    - New: `Voir le fichier`

29. `SubmissionGradeRow` — grade input placeholder (lines 603-611):
    - Old: `placeholder="Grade"`
    - New: `placeholder="Note"`

30. `SubmissionGradeRow` — feedback textarea placeholder (lines 616-621):
    - Old: `placeholder="Feedback (optional)"`
    - New: `placeholder="Commentaire (facultatif)"`

31. `SubmissionGradeRow` — cancel/save-grade buttons (lines 624-637):
    - Old: `Cancel` → New: `Annuler`
    - Old: `{saving ? "Saving…" : "Save grade"}` → New: `{saving ? "Enregistrement…" : "Enregistrer la note"}`

**Structural changes:**

- No enum-as-`<option>`-text sites in this file. `TYPE_LABELS` and `TYPE_FILTERS` are both already display-only lookups separate from raw enum values (see notes on replacements 1-2) — just translate the label strings in place, no map/import restructuring needed.
- Add `import { formatDate } from "../../lib/period";` (this file currently imports nothing from `../../lib/period`).
- Convert the two bare `new Date(...).toLocaleDateString()` call sites (item 21: `post.dueDate`; item 25: `submission.submittedAt`) to `formatDate(...)`. Both currently pass no `options` argument, so the replacement is `formatDate(post.dueDate)` and `formatDate(submission.submittedAt)` respectively.
- Do NOT convert the two `new Date(...).toLocaleString()` sites (`post.editedAt` title attribute, `post.createdAt` display) — `toLocaleString()` is a different method than `toLocaleDateString()` and is not covered by the `formatDate()` helper as specified (`formatDate()` wraps `toLocaleDateString` only). Only their surrounding static English words were translated per item 14.

**Test assertion updates:** No test file exists for this component (`client/src/features/teacher/FeedPage.test.tsx` not found via glob). No assertions to update.

---

### File: client/src/features/teacher/GoalsPanel.tsx

**Replacements:**

1. Panel heading + subheading (lines 167-170):
   - Old:
     ```
     <h2 className="text-sm font-medium text-ink-700">Monthly goals</h2>
     <p className="mt-0.5 text-xs text-ink-400">
       {isCurrent ? "Set what you want to get done this month." : "Recap of what got done."}
     </p>
     ```
   - New:
     ```
     <h2 className="text-sm font-medium text-ink-700">Objectifs mensuels</h2>
     <p className="mt-0.5 text-xs text-ink-400">
       {isCurrent ? "Définissez ce que vous souhaitez accomplir ce mois-ci." : "Récapitulatif de ce qui a été accompli."}
     </p>
     ```

2. Previous/next month buttons (lines 173-193):
   - Old: `title="Previous month"` / `aria-label="Previous month"`
   - New: `title="Mois précédent"` / `aria-label="Mois précédent"`
   - Old: `title="Next month"` / `aria-label="Next month"`
   - New: `title="Mois suivant"` / `aria-label="Mois suivant"`

3. Achieved/total summary line (lines 204-208):
   - Old:
     ```
     <span className="text-2xl font-semibold text-ink-900">{percent}%</span>
     <span className="text-sm text-ink-500">
       {achieved} of {total} goal{total === 1 ? "" : "s"} achieved
     </span>
     ```
   - New:
     ```
     <span className="text-2xl font-semibold text-ink-900">{percent}%</span>
     <span className="text-sm text-ink-500">
       {achieved} sur {total} objectif{total === 1 ? "" : "s"} atteint{total === 1 ? "" : "s"}
     </span>
     ```

4. Empty-goals copy (lines 211-214):
   - Old:
     ```
     <p className="mt-6 text-center text-sm text-ink-400">
       {isCurrent ? "No goals yet — add your first one below." : "No goals were set for this month."}
     </p>
     ```
   - New:
     ```
     <p className="mt-6 text-center text-sm text-ink-400">
       {isCurrent ? "Aucun objectif pour le moment — ajoutez le premier ci-dessous." : "Aucun objectif n'a été défini pour ce mois."}
     </p>
     ```

5. New-goal form (lines 232-262):
   - Old: `placeholder="e.g. Enroll 5 new pupils"`
   - New: `placeholder="ex. Inscrire 5 nouveaux élèves"`
   - Old: `Add` (submit button text)
   - New: `Ajouter`
   - Old: `Track as a number (e.g. reach a target count)` (checkbox label)
   - New: `Suivre sous forme de nombre (ex. atteindre un objectif chiffré)`

6. `GoalRow` — increase/decrease progress buttons (lines 83-100):
   - Old: `` aria-label={`Decrease progress for "${goal.title}"`} ``
   - New: `` aria-label={`Diminuer la progression de « ${goal.title} »`} ``
   - Old: `` aria-label={`Increase progress for "${goal.title}"`} ``
   - New: `` aria-label={`Augmenter la progression de « ${goal.title} »`} ``

7. `GoalRow` — remove-goal button (lines 109-119):
   - Old: `title="Remove goal"` / `` aria-label={`Remove goal "${goal.title}"`} ``
   - New: `title="Supprimer l'objectif"` / `` aria-label={`Supprimer l'objectif « ${goal.title} »`} ``

**Structural changes:**

- None needed. No raw enum arrays, no `<option>` elements, no bare `new Date(...).toLocaleDateString()` calls in this file — it only uses the already-imported `formatPeriodLabel(period)` (line 183), which becomes French automatically once the `client/src/lib/period.ts` centralization (§3 of the design spec — `formatPeriodLabel` passing `"fr-FR"` as locale) lands. No import changes required in this file.
- `goal.title` is user-generated content (a teacher-typed goal name) — never translate it; only the surrounding static aria-labels/titles that reference it via template literals were changed above.

**Test assertion updates:** No test file exists for this component (`client/src/features/teacher/GoalsPanel.test.tsx` not found via glob). No assertions to update.

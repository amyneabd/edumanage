# Server services & controllers — French translation plan (batch: auth/swap/attendance/payment/class/parent/admin)

Scope note: this batch covers exactly the 7 services and 5 controllers listed in the task. Two error
classes referenced by the in-scope controllers — `PostError` (`post.service.ts`) and `PupilError`
(`pupil.service.ts`) — are thrown by services **outside** this batch. Their `err.message` values are
serialized to the client the same way (via `handleServiceError`/inline `instanceof` checks), so they
are genuinely client-visible, but translating their text belongs to whichever batch covers
`post.service.ts` / `pupil.service.ts`. They are called out below wherever they appear so that batch
isn't missed, but no translation is proposed for them here to avoid conflicting edits.

Also note: `attendance.controller.ts`, `goal.controller.ts`, `vacation.controller.ts`, and
`notification.controller.ts` exist in the repo but are not part of this batch's file list; they were
read only as needed to confirm client-visibility of `attendance.service.ts` messages (specifically
`attendance.controller.ts`, which also calls `getPupilDetail`/`getAttendanceCalendar`/`markAttendance`/
`clearAttendance` and serializes `AttendanceError.message` via its own `handleAttendanceError` helper).

---

## Services

### File: server/src/services/auth.service.ts
Test file: server/src/services/auth.service.test.ts

Client-visible error messages to translate (all thrown as `new AuthError(...)`, caught in
`auth.controller.ts` via `if (err instanceof AuthError) { res.status(err.status).json({ error: err.message }); }`):

- Old: `"An account with this email already exists."` → New: `"Un compte avec cet e-mail existe déjà."` (line ~27, `registerTeacher`)
- Old: `"An account with this email already exists."` → New: `"Un compte avec cet e-mail existe déjà."` (line ~61, `registerPupil`)
- Old: `"No active teacher found with that Teacher ID."` → New: `"Aucun enseignant actif trouvé avec cet identifiant enseignant."` (line ~68, `registerPupil`)
- Old: `"An account with this email already exists."` → New: `"Un compte avec cet e-mail existe déjà."` (line ~112, `registerParent`)
- Old: `"Invalid email or password."` → New: `"E-mail ou mot de passe invalide."` (line ~133, `login` — no such user)
- Old: `"Invalid email or password."` → New: `"E-mail ou mot de passe invalide."` (line ~136, `login` — wrong password)
- Old: `"This reset link is invalid or has expired."` → New: `"Ce lien de réinitialisation est invalide ou a expiré."` (line ~166, `resetPassword`)
- Old: `"This verification link is invalid or has expired."` → New: `"Ce lien de vérification est invalide ou a expiré."` (line ~193, `verifyEmail`)
- Old: `"User not found."` → New: `"Utilisateur introuvable."` (line ~213, `changePassword`)
- Old: `"Current password is incorrect."` → New: `"Le mot de passe actuel est incorrect."` (line ~216, `changePassword`)

Internal-only messages excluded (stay English) — with reasoning:
- None. Every `AuthError` thrown in this file is caught by a controller handler that serializes
  `err.message` straight into the JSON response (`register`, `loginHandler`, `resetPasswordHandler`,
  `verifyEmailHandler`, `changePasswordHandler` in `auth.controller.ts`).

Test assertion updates:
- None needed. Every assertion in `auth.service.test.ts` that checks these throws uses
  `.rejects.toThrow(AuthError)` (the error *class*, e.g. lines ~35, 46, 66, 70, 80, 94) — it does not
  assert the message text, so no test edits are required by this translation.

---

### File: server/src/services/swap.service.ts
Test file: server/src/services/swap.service.test.ts

Client-visible error messages to translate (all thrown as `new SwapError(...)`; caught either by
`pupil.controller.ts`'s `handleSwapError` or `teacher.controller.ts`'s `handleServiceError`, both of
which do `res.status(err.status).json({ error: err.message })`):

- Old: `"Pupil profile not found."` → New: `"Profil élève introuvable."` (line ~28, `getPupilWithClass`)
- Old: `"Pupil is not assigned to a class."` → New: `"L'élève n'est assigné à aucune classe."` (line ~29, `getPupilWithClass`)
- Old: `"Invalid date."` → New: `"Date invalide."` (line ~58, `createSwapRequest`)
- Old: `"Origin date must not be in the past."` → New: `"La date d'origine ne doit pas être dans le passé."` (line ~62, `createSwapRequest`)
- Old: `"Target date must not be in the past."` → New: `"La date cible ne doit pas être dans le passé."` (line ~63, `createSwapRequest`)
- Old: `"You already have a pending swap request for that session."` → New: `"Vous avez déjà une demande d'échange en attente pour cette séance."` (line ~69, `createSwapRequest`)
- Old: `"Origin date is not a scheduled session of your class."` → New: `"La date d'origine ne correspond pas à une séance programmée de votre classe."` (line ~73, `createSwapRequest`)
- Old: `"Target class not found."` → New: `"Classe cible introuvable."` (line ~77, `createSwapRequest`)
- Old: `"Target class must be different from your own class."` → New: `"La classe cible doit être différente de votre propre classe."` (line ~80, `createSwapRequest`)
- Old: `"Target date is not a scheduled session of the target class."` → New: `"La date cible ne correspond pas à une séance programmée de la classe cible."` (line ~84, `createSwapRequest`)
- Old: `"Swap request not found."` → New: `"Demande d'échange introuvable."` (line ~119, `cancelSwapRequest`)
- Old: `"Only pending requests can be cancelled."` → New: `"Seules les demandes en attente peuvent être annulées."` (line ~121, `cancelSwapRequest`)
- Old: `"Swap request not found."` → New: `"Demande d'échange introuvable."` (line ~142, `respondToSwapRequest`)
- Old: `"This request has already been resolved."` → New: `"Cette demande a déjà été traitée."` (line ~144, `respondToSwapRequest`)

Internal-only messages excluded (stay English) — with reasoning:
- None. Every `SwapError` throw site is on a code path reachable from `pupil.controller.ts` or
  `teacher.controller.ts`, both of which serialize `err.message` to the client.

Test assertion updates:
- None needed. All swap-related assertions in `swap.service.test.ts` use `.rejects.toThrow(SwapError)`
  (the error class, e.g. lines ~125, 136, 146, 156, 167, 180, 211, 238, 250, 301, 313) — no message-text
  assertions exist.

---

### File: server/src/services/attendance.service.ts
Test file: server/src/services/attendance.service.test.ts

Client-visible error messages to translate (all thrown as `new AttendanceError(...)`; caught in
`pupil.controller.ts`'s `attendanceCalendarHandler` and in `attendance.controller.ts`'s
`handleAttendanceError` helper, both serializing `err.message`):

- Old: `"Pupil not found."` → New: `"Élève introuvable."` (line ~20, `getOwnedPupil` — used by `getPupilDetail`, `getAttendanceCalendar`, `markAttendance`, `clearAttendance`)
- Old: `"Pupil profile not found."` → New: `"Profil élève introuvable."` (line ~157, `getOwnAttendanceCalendar`)
- Old: `"Invalid date."` → New: `"Date invalide."` (line ~205, `markAttendance`)
- Old: `"Cannot record attendance for a future date."` → New: `"Impossible d'enregistrer une présence pour une date future."` (line ~209, `markAttendance`)
- Old: `"This pupil's class has no session scheduled on that day."` → New: `"La classe de cet élève n'a aucune séance programmée ce jour-là."` (line ~217, `markAttendance`)
- Old: `"Invalid date."` → New: `"Date invalide."` (line ~244, `clearAttendance`)

Internal-only messages excluded (stay English) — with reasoning:
- None. Note: `getOwnAttendanceCalendar`'s error also propagates through `parent.service.ts`'s
  `getChildAttendance` → `parent.controller.ts`'s `childAttendanceHandler`, whose `handleParentError`
  only checks `instanceof ParentError` (not `AttendanceError`) — on that specific call path an
  `AttendanceError` would fall through to the global error handler instead of being serialized with
  its own message. This doesn't change the translate decision (the message is still client-visible via
  the pupil's own `/pupil/attendance` route and via the teacher-facing `attendance.controller.ts`
  routes), but is worth flagging in case the global error handler's fallback text also needs French
  wording (out of scope for this batch — not one of the 7 services/5 controllers assigned).

Test assertion updates:
- None needed. All relevant assertions use `.rejects.toThrow()` with no argument (e.g. lines ~159, 198)
  or check return-value fields (`day?.record`, `overview.present`, etc.), never the error message text.

---

### File: server/src/services/payment.service.ts
Test file: server/src/services/payment.service.test.ts

Client-visible error messages to translate (all thrown as `new PaymentError(...)`; caught in
`pupil.controller.ts`'s `paymentHistoryHandler` and in `teacher.controller.ts`'s `handleServiceError`,
both serializing `err.message`):

- Old: `"Pupil not found."` → New: `"Élève introuvable."` (line ~99, `getPupilPaymentHistory`)
- Old: `"Pupil profile not found."` → New: `"Profil élève introuvable."` (line ~120, `getOwnPaymentHistory`)
- Old: `"Pupil not found."` → New: `"Élève introuvable."` (line ~151, `setPaymentStatus`)
- Old: `"Pupil not found."` → New: `"Élève introuvable."` (line ~262, `getPupilLedger`)
- Old: `"Pupil profile not found."` → New: `"Profil élève introuvable."` (line ~273, `getOwnLedger`)

Internal-only messages excluded (stay English) — with reasoning:
- None. `getOwnLedger`'s `PaymentError` is also reachable via `parent.service.ts`'s `getChildLedger` →
  `parent.controller.ts`'s `childLedgerHandler`, which only checks `instanceof ParentError` — same
  caveat as noted for `attendance.service.ts` above, but the message is independently client-visible
  via `pupil.controller.ts`'s direct `PaymentError` handling for `getOwnPaymentHistory`, so it's still
  in scope to translate here.

Test assertion updates:
- None needed. `payment.service.test.ts` only asserts `.rejects.toThrow(PaymentError)` (lines ~65, 181)
  — the error class, not the message text.

---

### File: server/src/services/class.service.ts
Test file: none found.

Client-visible error messages to translate (all thrown as `new ClassError(...)`; caught in
`teacher.controller.ts`'s `handleServiceError`, which serializes `err.message`):

- Old: `"Class not found."` → New: `"Classe introuvable."` (line ~36, `updateClassFee`)
- Old: `"Class not found."` → New: `"Classe introuvable."` (line ~56, `getClassDetail`)
- Old: `"Class not found."` → New: `"Classe introuvable."` (line ~67, `updateSchedule`)
- Old: `"Class not found."` → New: `"Classe introuvable."` (line ~81, `removePupilFromClass`)
- Old: `"Pupil not found in this class."` → New: `"Élève introuvable dans cette classe."` (line ~84, `removePupilFromClass`)
- Old: `"Class not found."` → New: `"Classe introuvable."` (line ~99, `assignPupilToClass`)
- Old: `"Pupil request not found."` → New: `"Demande d'élève introuvable."` (line ~104, `assignPupilToClass`)
- Old: `"Pupil request not found."` → New: `"Demande d'élève introuvable."` (line ~114, `rejectPupilRequest`)

Internal-only messages excluded (stay English) — with reasoning:
- None. Every `ClassError` throw site here is reachable through `teacher.controller.ts` handlers that
  route through `handleServiceError`.

Test assertion updates:
- N/A — no test file exists for this service.

---

### File: server/src/services/parent.service.ts
Test file: none found.

Client-visible error messages to translate (all thrown as `new ParentError(...)`; caught in
`parent.controller.ts`'s `handleParentError` and in `teacher.controller.ts`'s `handleServiceError`,
both serializing `err.message`):

- Old: `"No pupil found with that Parent Code."` → New: `"Aucun élève trouvé avec ce code parent."` (line ~28, `requestParentLink`)
- Old: `"You already have a pending request for this pupil."` → New: `"Vous avez déjà une demande en attente pour cet élève."` (line ~35, `requestParentLink`)
- Old: `"This pupil is already linked to your account."` → New: `"Cet élève est déjà lié à votre compte."` (line ~38, `requestParentLink`)
- Old: `"You don't have access to this pupil."` → New: `"Vous n'avez pas accès à cet élève."` (line ~92, `assertActiveLink`)
- Old: `"Pupil is not yet assigned to a class."` → New: `"L'élève n'est pas encore assigné à une classe."` (line ~104, `getChildSchedule`)
- Old: `"Pupil is not yet assigned to a class."` → New: `"L'élève n'est pas encore assigné à une classe."` (line ~132, `getChildPosts`)
- Old: `"Request not found."` → New: `"Demande introuvable."` (line ~170, `respondToParentLink`)
- Old: `"This request has already been resolved."` → New: `"Cette demande a déjà été traitée."` (line ~171, `respondToParentLink`)

Internal-only messages excluded (stay English) — with reasoning:
- None. Every `ParentError` throw site is reachable through either `parent.controller.ts` (all its
  handlers use `handleParentError`) or `teacher.controller.ts`'s `handleServiceError` (for
  `respondToParentLink`, called by `approveParentRequestHandler`/`declineParentRequestHandler`).

Test assertion updates:
- N/A — no test file exists for this service.

---

### File: server/src/services/admin.service.ts
Test file: none found.

Client-visible error messages to translate (thrown as `new AdminError(...)`; caught in
`admin.controller.ts`'s `getTeacherDetailHandler`, which serializes `err.message`):

- Old: `"Teacher not found."` → New: `"Enseignant introuvable."` (line ~79, `getTeacherDetail`)

Internal-only messages excluded (stay English) — with reasoning:
- None. The only throw site in this file is on the `getTeacherDetail` path, which is caught and
  serialized by `admin.controller.ts`.

Test assertion updates:
- N/A — no test file exists for this service.

---

## Controllers

### File: server/src/controllers/auth.controller.ts
Test file: none found.

Client-visible error messages to translate (inline `res.status(...).json({ error/message: "..." })`
literals defined in this file; `AuthError`-derived messages passed through via `err.message` here are
not re-listed — see `auth.service.ts` above for their translations):

- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~72, `register` — also carries `details: parsed.error.flatten()`, which is left untouched since it's Zod's structured field-path output, not app copy)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~115, `loginHandler`)
- Old: `"If that email exists, we've sent a link to reset your password."` → New: `"Si cet e-mail existe, nous avons envoyé un lien pour réinitialiser votre mot de passe."` (line ~138, `GENERIC_RESET_MESSAGE` constant, used at lines ~159 and ~166 in `forgotPassword`)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~145, `forgotPassword`)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~177, `resetPasswordHandler`)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~198, `verifyEmailHandler`)
- Old: `"Not authenticated"` → New: `"Non authentifié"` (line ~216, `resendVerificationHandler`)
- Old: `"Verification email sent."` → New: `"E-mail de vérification envoyé."` (line ~225, `resendVerificationHandler`, dev branch with `devVerifyUrl`)
- Old: `"Verification email sent."` → New: `"E-mail de vérification envoyé."` (line ~230, `resendVerificationHandler`, default branch)
- Old: `"Not authenticated"` → New: `"Non authentifié"` (line ~240, `changePasswordHandler`)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~246, `changePasswordHandler`)
- Old: `"Not authenticated"` → New: `"Non authentifié"` (line ~264, `me`)

Internal-only messages excluded (stay English) — with reasoning:
- `` `[mailer] failed to send ${context}:` `` (line ~65, inside `sendMailBestEffort`) — passed only to
  `console.error` alongside the caught `err`; never serialized into any HTTP response. Stays English
  per spec §1 (console/log output is out of scope) regardless of translation status elsewhere.

Test assertion updates:
- N/A — no controller test file exists.

---

### File: server/src/controllers/pupil.controller.ts
Test file: none found.

Client-visible error messages to translate (inline literals defined in this file only; `AttendanceError`,
`PaymentError`, and `SwapError` pass-throughs are covered under their respective service sections above.
`PostError`/`PupilError` pass-throughs at lines ~22, ~103 originate in `post.service.ts`/`pupil.service.ts`,
which are outside this batch — flagged for whichever batch covers those files, not translated here):

- Old: `"Not yet assigned to a class."` → New: `"Pas encore assigné à une classe."` (line ~60, `schedule`)
- Old: `"Not yet assigned to a class."` → New: `"Pas encore assigné à une classe."` (line ~70, `posts`)
- Old: `"A file is required for submission."` → New: `"Un fichier est requis pour la soumission."` (line ~90, `submitExam`)
- Old: `"Invalid request body."` → New: `"Corps de requête invalide."` (line ~147, `createSwapRequestHandler`)

Internal-only messages excluded (stay English) — with reasoning:
- None found in this file.

Test assertion updates:
- N/A — no controller test file exists.

---

### File: server/src/controllers/teacher.controller.ts
Test file: none found.

Client-visible error messages to translate (inline literals defined in this file only; `ClassError`,
`PaymentError`, `SwapError`, and `ParentError` pass-throughs via `handleServiceError` are covered under
their respective service sections above. `PostError` pass-through (also routed through
`handleServiceError`) originates in `post.service.ts`, outside this batch — flagged, not translated here):

- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~122, `createClassHandler`)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~134, `updateClassFeeHandler`)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~167, `updateScheduleHandler`)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~205, `assignPupilRequest`)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~253, `updatePayment`)
- Old: `"classId is required"` → New: `"classId est requis"` (line ~285, `listPosts` — `classId` is a request-param/field name, left untranslated per spec's "API JSON keys are not translated"; only the surrounding words change)
- Old: `"Class not found."` → New: `"Classe introuvable."` (line ~291, `listPosts`)
- Old: `"classId and type are required"` → New: `"classId et type sont requis"` (line ~300, `createPostHandler` — same `classId`/`type` field-name rationale as above)
- Old: `"Class not found."` → New: `"Classe introuvable."` (line ~305, `createPostHandler`)
- Old: `"Invalid input"` → New: `"Entrée invalide"` (line ~368, `gradeSubmissionHandler`)
- Old: `"classId is required"` → New: `"classId est requis"` (line ~383, `gradebookHandler`)
- Old: `"Class not found."` → New: `"Classe introuvable."` (line ~438, `parentRequestsHandler`)

Internal-only messages excluded (stay English) — with reasoning:
- None found in this file.

Test assertion updates:
- N/A — no controller test file exists.

---

### File: server/src/controllers/parent.controller.ts
Test file: none found.

Client-visible error messages to translate (inline literal defined in this file; `ParentError`
pass-through via `handleParentError` is covered under `parent.service.ts` above):

- Old: `"A valid Parent Code is required."` → New: `"Un code parent valide est requis."` (line ~27, `requestLinkHandler`)

Internal-only messages excluded (stay English) — with reasoning:
- None found in this file.

Test assertion updates:
- N/A — no controller test file exists.

---

### File: server/src/controllers/admin.controller.ts
Test file: none found.

Client-visible error messages to translate (inline literals defined in this file; `AdminError`
pass-through via `getTeacherDetailHandler` is covered under `admin.service.ts` above):

- Old: `"Teacher not found."` → New: `"Enseignant introuvable."` (line ~23, `approveTeacher`)
- Old: `"Teacher not found."` → New: `"Enseignant introuvable."` (line ~33, `rejectTeacher`)

Internal-only messages excluded (stay English) — with reasoning:
- None found in this file.

Test assertion updates:
- N/A — no controller test file exists.

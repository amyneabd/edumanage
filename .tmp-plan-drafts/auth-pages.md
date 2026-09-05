# French Localization — `client/src/features/auth/` batch

Note on file layout: there is no `pages/` subdirectory under `client/src/features/auth/` — all
six files live directly in `client/src/features/auth/`. Paths below reflect the actual layout.

Note on brand name: the app's UI-visible product name is **"EduManage"** (see
`client/src/hooks/useDocumentTitle.ts` and `client/src/components/AppLayout.tsx`), not
"Bachandi" (which only appears as the repo/folder name, never in UI copy). Per the spec's
principle that brand/product names are proper nouns and are never translated, "EduManage" is
left untouched everywhere it appears below, exactly like "Bachandi" would be.

Note on label consistency: "Email" is translated as **"E-mail"** everywhere in this batch (form
labels), for consistency across all six files.

---

### File: client/src/features/auth/LoginPage.tsx
Test file: none found (no test file references LoginPage anywhere in the repo)

Replacements:
- Old: `"Sign in"` → New: `"Se connecter"` (line 18, `useDocumentTitle("Sign in")` — browser tab title)
- Old: `"Sign in to EduManage"` → New: `"Se connecter à EduManage"` (line 46, h1 heading; "EduManage" brand name stays untranslated)
- Old: `"Teachers and pupils, in one place."` → New: `"Enseignants et élèves, réunis au même endroit."` (line 47, subheading paragraph)
- Old: `"Email"` → New: `"E-mail"` (line 52, label text for `login-email`, asterisk span unchanged)
- Old: `"Password"` → New: `"Mot de passe"` (line 68, label text for `login-password`, asterisk span unchanged)
- Old: `"Forgot password?"` → New: `"Mot de passe oublié ?"` (line 74, link text)
- Old: `"Signing in…"` → New: `"Connexion…"` (line 92, submit button pending-state text)
- Old: `"Sign in"` → New: `"Se connecter"` (line 92, submit button default text)
- Old: `"No account?"` (text node before the link, line 97) → New: `"Pas de compte ?"`
- Old: `"Register"` → New: `"S'inscrire"` (line 99, link text)

Not translated (server-derived / not client copy):
- `extractErrorMessage(mutation.error)` rendered via `<ErrorState message={...}>` (line 89) — server error message, out of scope for this task.

Structural changes: none.

Test assertion updates: none (no test file exists for this component).

---

### File: client/src/features/auth/RegisterPage.tsx
Test file: none found (no test file references RegisterPage anywhere in the repo)

Replacements:
- Old: `"Create account"` → New: `"Créer un compte"` (line 20, `useDocumentTitle("Create account")` — browser tab title)
- Old: `"Create your account"` → New: `"Créez votre compte"` (line 65, h1 heading)
- Old: `"Choose the account type that fits you."` → New: `"Choisissez le type de compte qui vous correspond."` (line 66, subheading paragraph)
- Old: `aria-label="Account type"` → New: `aria-label="Type de compte"` (line 68, radiogroup wrapper div)
- Old: `"Pupil"` → New: `"Élève"` (line 83, role-selector button label, `r === "PUPIL"` branch)
- Old: `"Teacher"` → New: `"Enseignant"` (line 83, role-selector button label, `r === "TEACHER"` branch)
- Old: `"Parent"` → New: `"Parent"` (line 83, role-selector button label, else branch — unchanged, glossary maps Parent→Parent)
- Old: `"Full name"` → New: `"Nom complet"` (line 91, label for `register-name`, asterisk span unchanged)
- Old: `"Email"` → New: `"E-mail"` (line 105, label for `register-email`, asterisk span unchanged)
- Old: `"Password"` → New: `"Mot de passe"` (line 120, label for `register-password`, asterisk span unchanged)
- Old: `"Confirm password"` → New: `"Confirmer le mot de passe"` (line 135, label for `register-confirm-password`, asterisk span unchanged)
- Old: `"Class type"` → New: `"Type de classe"` (line 153, label for `register-class-type`)
- Old: `"Teacher ID"` → New: `"Identifiant enseignant"` (line 169, label for `register-teacher-code`, asterisk span unchanged)
- Old: `placeholder="e.g. PFBV9U"` → New: `placeholder="ex. PFBV9U"` (line 173, `Input` for `register-teacher-code`)
- Old: `"Ask your teacher for their Teacher ID."` → New: `"Demandez à votre enseignant son identifiant."` (line 182, hint paragraph `#register-teacher-code-hint`)
- Old: `"Phone number"` → New: `"Numéro de téléphone"` (line 188, label for `register-phone`, asterisk span unchanged)
- Old: `"Parent's phone number"` → New: `"Numéro de téléphone du parent"` (line 203, label for `register-parent-phone`, asterisk span unchanged)
- Old: `"Creating account…"` → New: `"Création du compte…"` (line 222, submit button pending-state text)
- Old: `"Create account"` → New: `"Créer un compte"` (line 222, submit button default text)
- Old: `"Already have an account?"` (text node before the link, line 227) → New: `"Vous avez déjà un compte ?"`
- Old: `"Sign in"` → New: `"Se connecter"` (line 229, link text)

Not translated (server-derived / not client copy):
- `extractErrorMessage(mutation.error)` rendered via `<ErrorState message={...}>` (line 219) — server error message, out of scope.
- Raw `ClassType` enum values (`"SCIENCE"`, `"MATH"`, `"INFO"`, `"ECO"`) used as `value={t}` in the `<option>` — kept as-is per spec, only the displayed label text changes (see Structural changes below).

Structural changes:
- Add import: `import { CLASS_TYPE_LABELS } from "../../lib/labels";` (new line near line 15, alongside the existing `import type { ClassType } from "../../api/types";`).
- Change the `<option>` rendering at lines 160–164 from:
  ```tsx
  {CLASS_TYPES.map((t) => (
    <option key={t} value={t}>
      {t}
    </option>
  ))}
  ```
  to:
  ```tsx
  {CLASS_TYPES.map((t) => (
    <option key={t} value={t}>
      {CLASS_TYPE_LABELS[t]}
    </option>
  ))}
  ```
  This gives the option elements French display text ("Sciences", "Mathématiques", "Informatique", "Économie") while the `value` attribute keeps submitting the raw enum (`SCIENCE`/`MATH`/`INFO`/`ECO`) unchanged for form submission.

Test assertion updates: none (no test file exists for this component).

---

### File: client/src/features/auth/ForgotPasswordPage.tsx
Test file: none found (no test file references ForgotPasswordPage anywhere in the repo)

Replacements:
- Old: `"Reset your password"` → New: `"Réinitialiser votre mot de passe"` (line 16, `useDocumentTitle("Reset your password")` — browser tab title)
- Old: `"Check your email"` → New: `"Vérifiez votre e-mail"` (line 39, h1 heading, success state)
- Old: `"Dev mode — no SMTP configured"` → New: `"Mode développement — SMTP non configuré"` (line 43, dev-only helper text)
- Old: `"Back to sign in"` → New: `"Retour à la connexion"` (line 56, link text)
- Old: `"Forgot your password?"` → New: `"Mot de passe oublié ?"` (line 61, h1 heading, default state)
- Old: `"Enter your email and we'll send you a link to reset it."` → New: `"Saisissez votre e-mail et nous vous enverrons un lien pour le réinitialiser."` (lines 62–64, subheading paragraph)
- Old: `"Email"` → New: `"E-mail"` (line 69, label for `forgot-email`)
- Old: `"Sending…"` → New: `"Envoi…"` (line 84, submit button pending-state text)
- Old: `"Send reset link"` → New: `"Envoyer le lien de réinitialisation"` (line 84, submit button default text)
- Old: `"Remembered it?"` (text node before the link, line 89) → New: `"Vous vous en souvenez ?"`
- Old: `"Sign in"` → New: `"Se connecter"` (line 91, link text)

Not translated (server-derived / not client copy):
- `mutation.data.message` (line 40) — message string returned by the server API response, out of scope for this task.
- `mutation.data.devResetUrl` (lines 45, 48) — a raw URL, not translatable copy.
- `extractErrorMessage(mutation.error)` rendered via `<ErrorState message={...}>` (line 81) — server error message, out of scope.

Structural changes: none.

Test assertion updates: none (no test file exists for this component).

---

### File: client/src/features/auth/PendingPage.tsx
Test file: none found (no test file references PendingPage anywhere in the repo)

Replacements:
- Old: `"Pending approval"` → New: `"En attente d'approbation"` (line 11, `useDocumentTitle("Pending approval")` — browser tab title)
- Old: `"Request not approved"` → New: `"Demande non approuvée"` (line 43, h1 heading, rejected state)
- Old (composed sentence, lines 44–47):
  ```tsx
  Your account request was declined. Please contact
  {user?.role === "TEACHER" ? " the site admin" : " your teacher"} for details.
  ```
  → New:
  ```tsx
  Votre demande de compte a été refusée. Veuillez contacter
  {user?.role === "TEACHER" ? " l'administrateur du site" : " votre enseignant"} pour plus de détails.
  ```
  (i.e. static text `"Your account request was declined. Please contact"` → `"Votre demande de compte a été refusée. Veuillez contacter"`; conditional fragment `" the site admin"` → `" l'administrateur du site"`; conditional fragment `" your teacher"` → `" votre enseignant"`; trailing static text `" for details."` → `" pour plus de détails."`)
- Old: `"Waiting for approval"` → New: `"En attente d'approbation"` (line 51, h1 heading, default state)
- Old: `"An admin needs to approve your teacher account before you can sign in."` → New: `"Un administrateur doit approuver votre compte enseignant avant que vous puissiez vous connecter."` (line 54, conditional paragraph, `user?.role === "TEACHER"` branch)
- Old: `"Your teacher needs to accept your request and assign you to a class."` → New: `"Votre enseignant doit accepter votre demande et vous assigner à une classe."` (line 55, conditional paragraph, else branch)
- Old: `"Log out"` → New: `"Se déconnecter"` (line 60, button text)

Structural changes: none.

Test assertion updates: none (no test file exists for this component).

---

### File: client/src/features/auth/ResetPasswordPage.tsx
Test file: none found (no test file references ResetPasswordPage anywhere in the repo)

Replacements:
- Old: `"Set a new password"` → New: `"Définir un nouveau mot de passe"` (line 16, `useDocumentTitle("Set a new password")` — browser tab title)
- Old: `"Invalid reset link"` → New: `"Lien de réinitialisation invalide"` (line 44, h1 heading, missing-token state)
- Old: `"This password reset link is missing its token."` → New: `"Ce lien de réinitialisation de mot de passe est invalide : le jeton est manquant."` (line 45, paragraph)
- Old: `"Request a new link"` → New: `"Demander un nouveau lien"` (line 50, link text)
- Old: `"Set a new password"` → New: `"Définir un nouveau mot de passe"` (line 64, h1 heading, main form state)
- Old: `"Choose a new password for your account."` → New: `"Choisissez un nouveau mot de passe pour votre compte."` (line 65, subheading paragraph)
- Old: `"New password"` → New: `"Nouveau mot de passe"` (line 69, label for `reset-password`, asterisk span unchanged)
- Old: `"Confirm new password"` → New: `"Confirmer le nouveau mot de passe"` (line 84, label for `reset-confirm-password`, asterisk span unchanged)
- Old: `"Resetting…"` → New: `"Réinitialisation…"` (line 102, submit button pending-state text)
- Old: `"Reset password"` → New: `"Réinitialiser le mot de passe"` (line 102, submit button default text)

Not translated (server-derived / not client copy):
- `extractErrorMessage(mutation.error)` rendered via `<ErrorState message={...}>` (line 99) — server error message, out of scope.

Structural changes: none.

Test assertion updates: none (no test file exists for this component).

---

### File: client/src/features/auth/VerifyEmailPage.tsx
Test file: none found (no test file references VerifyEmailPage anywhere in the repo)

Replacements:
- Old: `"Verify your email"` → New: `"Vérifiez votre e-mail"` (line 14, `useDocumentTitle("Verify your email")` — browser tab title)
- Old: `"Verifying your email…"` → New: `"Vérification de votre e-mail…"` (line 60, h1 heading, pending state)
- Old: `"Email verified"` → New: `"E-mail vérifié"` (line 64, h1 heading, success state)
- Old: `"Redirecting you now…"` → New: `"Redirection en cours…"` (line 66, conditional paragraph, `isAuthenticated` true branch)
- Old: `"You can now sign in to your account."` → New: `"Vous pouvez maintenant vous connecter à votre compte."` (line 66, conditional paragraph, else branch)
- Old: `"Go to sign in"` → New: `"Aller à la connexion"` (line 73, link text)
- Old: `"Verification failed"` → New: `"Échec de la vérification"` (line 80, h1 heading, error state)
- Old: `"Request a new link"` → New: `"Demander un nouveau lien"` (line 86, link text)
- Old: `"Verify your email"` → New: `"Vérifiez votre e-mail"` (line 102, h1 heading, no-token/default state)
- Old (composed sentence, lines 103–106):
  ```tsx
  We sent a verification link to {user?.email ?? "your email address"}. Click the link to activate your
  account.
  ```
  → New:
  ```tsx
  Nous avons envoyé un lien de vérification à {user?.email ?? "votre adresse e-mail"}. Cliquez sur le lien pour
  activer votre compte.
  ```
  (i.e. leading text `"We sent a verification link to"` → `"Nous avons envoyé un lien de vérification à"`; fallback string `"your email address"` → `"votre adresse e-mail"`; trailing text `". Click the link to activate your account."` → `". Cliquez sur le lien pour activer votre compte."`)
- Old: `"Sending…"` → New: `"Envoi…"` (line 114, resend button pending-state text)
- Old: `"Resend verification email"` → New: `"Renvoyer l'e-mail de vérification"` (line 114, resend button default text)
- Old: `"Verification email sent."` → New: `"E-mail de vérification envoyé."` (line 117, success confirmation paragraph)
- Old: `"Dev mode — no SMTP configured"` → New: `"Mode développement — SMTP non configuré"` (line 120, dev-only helper text)
- Old: `"Log out"` → New: `"Se déconnecter"` (line 131, button text)

Not translated (server-derived / not client copy):
- `extractErrorMessage(verifyMutation.error)` rendered via `<ErrorState message={...}>` (line 81) — server error message, out of scope.
- `resendMutation.data?.devVerifyUrl` (lines 122, 125) — a raw URL, not translatable copy.

Structural changes: none.

Test assertion updates: none (no test file exists for this component).

# Supabase Auth Migration — Design

## Context

Email verification is fully implemented today (Prisma models, service logic,
endpoints) but practically dead: emails are sent via Resend's HTTP API, and
Resend's sandbox sender can't deliver to arbitrary recipients without a
verified custom domain, which the project doesn't have. Rather than acquire
a domain, we're replacing the custom credential/session/verification system
with Supabase Auth, which provides working email verification and password
reset out of the box with no custom domain required.

Supabase is already a dependency (`@supabase/supabase-js`) but is currently
only used for optional file storage (`server/src/utils/storage.ts`). This
migration makes it the identity/session/credential provider as well.

Existing user rows in the database are dev/test data and will be wiped
rather than migrated — no backfill script is in scope.

## Goals

- Supabase Auth becomes the source of truth for credentials, sessions, and
  email verification/password-reset for all three roles (teacher, pupil,
  parent).
- The client's existing cookie-only session model (`axios` +
  `withCredentials`, `GET /auth/me`, React Query `["me"]`, route guards)
  keeps working with no changes, except the password-reset page.
- Resend is removed from the auth flow only. `sendParentAlertEmail` and the
  core `mailer.ts` sending primitive are out of scope and stay as-is.
- App-level role/status logic (PENDING vs ACTIVE, teacher/pupil/parent
  profile creation) is unchanged.

## Non-goals

- Migrating existing production user accounts (none exist worth preserving;
  data will be wiped).
- Replacing Resend for non-auth notification emails (parent alerts).
- Any change to authorization/role logic beyond swapping the credential
  layer.

## Data model changes (`server/prisma/schema.prisma`)

- `User`:
  - Remove `passwordHash`.
  - Remove `emailVerifiedAt` (superseded by Supabase's `email_confirmed_at`,
    read live from Supabase on each request — not mirrored into Postgres).
  - Add `supabaseId String @unique` — the linked `auth.users.id`.
  - `id` (cuid) remains the primary key referenced by
    `TeacherProfile`/`PupilProfile`/`ParentProfile` — no changes to those
    tables or any other foreign keys in the schema.
- Remove `PasswordResetToken` model entirely.
- Remove `EmailVerificationToken` model entirely.
- Migration wipes the `User` table (cascades to profile tables via existing
  FKs) since current rows are dev/test data with no real credentials worth
  preserving.

## Server changes

### New: `server/src/utils/supabaseAuth.ts`
A Supabase client constructed with the **anon key** (not the service-role
key used by `storage.ts`), used for all auth operations: `signUp`,
`signInWithPassword`, `getUser`, `refreshSession`, `resend`,
`resetPasswordForEmail`, `updateUser`, `signOut`.

### `server/src/services/auth.service.ts`
- `registerTeacher` / `registerPupil` / `registerParent`: replace password
  hashing + Prisma-only user creation with
  `supabaseAuth.auth.signUp({ email, password })`, then create the Prisma
  `User` row with `supabaseId: data.user.id`. Role-specific profile creation
  and initial `status` (PENDING for teacher/pupil, ACTIVE for parent) are
  unchanged.
- `login`: replace bcrypt compare + custom JWT issuance with
  `supabaseAuth.auth.signInWithPassword({ email, password })`. On success,
  look up the Prisma `User` by `supabaseId` to attach role/status/profile
  data to the response, matching today's response shape.
- Remove `issueEmailVerificationToken`, `resendVerificationEmail`
  (token-table-based); replace with a thin `resendVerification(email)`
  that calls `supabaseAuth.auth.resend({ type: 'signup', email })`.
- `verifyEmail(tokenHash)` → calls
  `supabaseAuth.auth.verifyOtp({ token_hash: tokenHash, type: "signup" })`
  and returns the resulting Supabase session (`{ access_token,
  refresh_token }`) for the controller to set as cookies.
- Remove custom password-reset token issuance/consumption; replace with:
  - `requestPasswordReset(email)` →
    `supabaseAuth.auth.resetPasswordForEmail(email, { redirectTo: <CLIENT_URL>/reset-password })`.
  - `completePasswordReset(tokenHash, newPassword)` → calls
    `supabaseAuth.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })`
    to obtain a session, then `supabaseAuth.auth.updateUser({ password: newPassword })`
    against that session, and returns the session for the controller to
    set as cookies.
- `logout`: `supabaseAuth.auth.signOut()`, then clear cookies.

### `server/src/controllers/auth.controller.ts` / `server/src/routes/auth.routes.ts`
- `/register`, `/login`, `/logout`: same paths, bodies backed by the new
  Supabase-based service methods.
- `/resend-verification`: same path, but no longer requires
  `requireAuth` — an unconfirmed user has no session cookie yet (Supabase
  doesn't issue one pre-confirmation), so the request body must carry the
  email directly: `{ email }` instead of relying on `req.user`.
- Supabase's confirmation and recovery emails link to
  `<CLIENT_URL>/verify-email?token_hash=...&type=signup` and
  `<CLIENT_URL>/reset-password?token_hash=...&type=recovery` respectively
  (configured as custom email redirect templates in the Supabase
  dashboard, since the default templates link to Supabase's own hosted
  confirmation endpoint). This keeps the existing app pattern of
  "query-param + POST to our server" instead of switching to Supabase's
  implicit hash-fragment session flow, which would require adding
  `@supabase/supabase-js` as a client dependency.
- `POST /verify-email` is kept, but its body changes from `{ token }` to
  `{ token_hash }`. Handler calls
  `supabaseAuth.auth.verifyOtp({ token_hash, type: "signup" })`, which
  both confirms the email and returns a Supabase session on success. The
  route then sets `sb-access-token`/`sb-refresh-token` cookies from that
  session, so the user is logged in immediately after verifying (matching
  today's behavior where `VerifyEmailPage` polls `/me` while
  authenticated).
- Existing forgot-password/reset-request route is repointed to
  `requestPasswordReset`; same path, same request shape (`{ email }`).
- `POST /reset-password` is kept, but its body changes from
  `{ token, password }` to `{ token_hash, password }`. Handler calls
  `supabaseAuth.auth.verifyOtp({ token_hash, type: "recovery" })` to
  obtain a session, then `supabaseAuth.auth.updateUser({ password })`
  using that session to set the new password, then sets the same two
  session cookies (the user ends up logged in post-reset, same as
  today's flow ends with a valid session cookie).

### `server/src/middleware/auth.middleware.ts`
- Read `sb-access-token` cookie, validate via
  `supabaseAuth.auth.getUser(token)`.
- On expiry/invalid: attempt silent refresh using `sb-refresh-token` cookie
  via `refreshSession`; reissue both cookies on success.
- On total failure: 401, same as today (client already handles this via a
  global response interceptor that clears the cached `me` query and
  redirects to `/login`).
- Loads the Prisma `User` via `supabaseId` for role/status checks (PENDING
  gate, etc.) exactly as before.
- `requireEmailVerified` and `REQUIRE_EMAIL_VERIFICATION` are removed as
  dead code: with "Confirm email" enabled in Supabase, `signUp` issues no
  session until the address is confirmed and `signInWithPassword` itself
  rejects unconfirmed users. By the time `requireAuth` succeeds (a valid
  `sb-access-token`/`sb-refresh-token` pair exists), the email is
  necessarily already confirmed, so a separate verification gate can
  never fire. This also removes `emailVerified` /
  `emailVerificationRequired` from the `/auth/me` response and the
  client's `Me` type, and the corresponding branch in
  `client/src/routes/guards.tsx`.

### Cookies
- Two httpOnly cookies replace the single custom JWT cookie:
  `sb-access-token` (short-lived, matches Supabase access token TTL) and
  `sb-refresh-token` (long-lived). Same `secure`/`sameSite`/`httpOnly` flags
  as the current cookie.

### Removed
- `passwordHash` handling in `server/src/utils/password.ts` call sites
  within auth (file itself removed if nothing else uses bcrypt).
- `sendVerificationEmail` / `sendPasswordResetEmail` in
  `server/src/utils/mailer.ts` and their Resend calls.
- `RESEND_API_KEY` / `MAIL_FROM` env vars become unused for auth (left
  alone if still referenced by `sendParentAlertEmail`).

## Client changes

- **`VerifyEmailPage`**: reads `token_hash` (not `token`) from the query
  string and posts `{ token_hash }` to `POST /verify-email`. Must also
  work for a logged-out visitor: registration no longer yields a session
  cookie for unconfirmed users, so the page can't rely on `useAuth()`'s
  `user.email` — the email is passed via router state from
  `RegisterPage`/`LoginPage` instead. The `devVerifyUrl` dev-mode block is
  removed (Supabase sends real emails in every environment once
  configured).
- **`ResetPasswordPage`**: reads `token_hash` (not `token`) from the query
  string and posts `{ token_hash, password }` to `POST /reset-password`
  (same path as today, changed body).
- **`RegisterPage`**: on success, no session cookie exists yet for
  unconfirmed users, so instead of invalidating `["me"]` and navigating to
  `/verify-email`, it navigates to `/verify-email` passing the registered
  email via router state (`navigate("/verify-email", { state: { email } })`).
- **`LoginPage`**: `onError` gains a branch that detects Supabase's
  "email not confirmed" error and redirects to `/verify-email` with the
  submitted email via router state, instead of showing a generic error.
- **`ForgotPasswordPage`**: drop the `devResetUrl` dev-mode block; no
  other change (still posts `{ email }`).
- **`api/auth.ts`**: `resendVerification()` becomes
  `resendVerification(email: string)` (posts `{ email }`, no auth cookie
  required); `verifyEmail`/`resetPassword` take `tokenHash` instead of
  `token`.
- **`api/types.ts`**: `Me` drops `emailVerified` and
  `emailVerificationRequired`.
- **`routes/guards.tsx`**: drop the branch keyed on
  `emailVerificationRequired`/`emailVerified` (see the `requireEmailVerified`
  removal above) — role/status gating is otherwise unchanged.
- No other client changes: `client/src/api/client.ts` (axios,
  `withCredentials: true`) and `client/src/hooks/useAuth.ts`
  (`GET /auth/me`) continue to work unmodified because the session
  remains an opaque httpOnly cookie pair.

## External setup (outside this codebase, user-performed)

- In the Supabase dashboard: enable "Confirm email" under Auth settings so
  `signUp` triggers a confirmation email.
- Confirm the Supabase project URL + anon key are available as env vars
  (`SUPABASE_URL`, `SUPABASE_ANON_KEY` — new; distinct from the existing
  `SUPABASE_SERVICE_ROLE_KEY` used by `storage.ts`).
- Default Supabase email sending has low rate limits (a handful of emails/hour
  on the free tier) — acceptable for current dev/test scale, called out here
  so it isn't a surprise later.

## Testing

- `server/src/services/auth.service.test.ts` and
  `server/src/middleware/auth.middleware.test.ts`: rewrite to mock the
  Supabase auth client instead of bcrypt/JWT.
- `client/src/lib/authSchemas.test.ts`: expected to need no changes (same
  request/response contracts), verify during implementation.
- `client/src/routes/guards.test.tsx`: cases exercising the
  `emailVerificationRequired`/`emailVerified` bypass branch are removed
  along with that branch; other cases (role/status gating) are unchanged.
- Manual end-to-end pass required (register → check inbox for Supabase's
  confirmation email → verify → login → reset password) since it depends on
  live Supabase project configuration that can't be fully mocked.

## Error handling

- Supabase error responses (invalid credentials, unconfirmed email, rate
  limiting) get mapped to the same error shapes/status codes the client
  already expects from the current auth endpoints, to avoid client-side
  changes.
- Cookie refresh failures fall back to the existing 401 → "session expired"
  client behavior; no new client-side error states needed.

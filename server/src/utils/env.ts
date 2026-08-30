import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Outbound mail goes through Resend's HTTP API (not SMTP): many PaaS hosts
// (Render included) block or silently drop outbound SMTP connections, while
// a plain HTTPS call is unaffected. Optional, same pattern as before: if
// RESEND_API_KEY isn't set, mailer.ts falls back to logging links to the
// console instead of failing startup.
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey
  ? {
      apiKey: resendApiKey,
      // "bachandi.app" isn't a verified sending domain in Resend, so Resend
      // hard-rejects (403) any `from` address on it. Their default sandbox
      // sender works today without domain verification, at the cost of the
      // documented sandbox restriction (delivery limited to the Resend
      // account owner's own email until a real domain is verified).
      from: process.env.MAIL_FROM ?? "Bachandi <onboarding@resend.dev>",
    }
  : null;

// Supabase Storage is optional: if SUPABASE_URL isn't set, storage.ts falls
// back to writing uploads to local disk instead of failing startup. If
// SUPABASE_URL IS set, the rest of the SUPABASE_* vars become required so
// misconfiguration fails fast rather than silently dropping uploads.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseStorage = supabaseUrl
  ? {
      url: supabaseUrl,
      serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
      bucket: required("SUPABASE_STORAGE_BUCKET"),
    }
  : null;

// Email verification enforcement is temporarily disabled by setting this to
// "false" — Resend's sandbox sender only delivers to the Resend account
// owner's own email until a sending domain is verified, so requiring
// verification would lock every other registrant out. Defaults to required
// (true) so this stays opt-out, not opt-in: unset behaves exactly as before.
const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION !== "false";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
  resend,
  supabaseStorage,
  requireEmailVerification,
  isProduction: process.env.NODE_ENV === "production",
};

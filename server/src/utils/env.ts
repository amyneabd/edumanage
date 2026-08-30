import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// SMTP is optional: if SMTP_HOST isn't set, mailer.ts falls back to logging
// reset links to the console instead of failing startup. If SMTP_HOST IS
// set, the rest of the SMTP_* vars become required so misconfiguration
// fails fast rather than silently dropping emails.
const smtpHost = process.env.SMTP_HOST;
const smtp = smtpHost
  ? {
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS"),
      from: process.env.SMTP_FROM ?? "Bachandi <no-reply@bachandi.app>",
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

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
  smtp,
  supabaseStorage,
  isProduction: process.env.NODE_ENV === "production",
};

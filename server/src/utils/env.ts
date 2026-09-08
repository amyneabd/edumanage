import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey
  ? { apiKey: resendApiKey, from: process.env.MAIL_FROM ?? "Bachandi <onboarding@resend.dev>" }
  : null;

const supabaseUrl = required("SUPABASE_URL");
const supabaseAnonKey = required("SUPABASE_ANON_KEY");
const supabaseServiceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");

const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const supabaseStorage = supabaseStorageBucket
  ? { url: supabaseUrl, serviceRoleKey: supabaseServiceRoleKey, bucket: supabaseStorageBucket }
  : null;

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;
const vapid =
  vapidPublicKey && vapidPrivateKey && vapidSubject
    ? { publicKey: vapidPublicKey, privateKey: vapidPrivateKey, subject: vapidSubject }
    : null;

export const env = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
  resend,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseStorage,
  vapid,
  isProduction: process.env.NODE_ENV === "production",
};

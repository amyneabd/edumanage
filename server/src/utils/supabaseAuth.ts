import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export function createAuthClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const supabaseAuth = createAuthClient();

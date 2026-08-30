import path from "node:path";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";
import { uploadsDir } from "../middleware/upload.middleware.js";

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!env.supabaseStorage) return null;
  if (!supabase) {
    supabase = createClient(env.supabaseStorage.url, env.supabaseStorage.serviceRoleKey);
  }
  return supabase;
}

function uniqueKey(originalName: string): string {
  const ext = path.extname(originalName);
  return `${Date.now()}-${randomUUID()}${ext}`;
}

/**
 * Saves an uploaded file. Falls back to local disk (server/uploads) when
 * Supabase Storage isn't configured — mirrors mailer.ts's SMTP dev fallback.
 */
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string
): Promise<{ url: string; key: string }> {
  const key = uniqueKey(originalName);
  const client = getSupabase();

  if (!client) {
    await writeFile(path.join(uploadsDir, key), buffer);
    return { url: `/uploads/${key}`, key };
  }

  const { error } = await client.storage
    .from(env.supabaseStorage!.bucket)
    .upload(key, buffer, { contentType: mimetype });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = client.storage.from(env.supabaseStorage!.bucket).getPublicUrl(key);
  return { url: data.publicUrl, key };
}

export async function deleteFile(key: string): Promise<void> {
  const client = getSupabase();

  if (!client) {
    await unlink(path.join(uploadsDir, key)).catch(() => {});
    return;
  }

  const { error } = await client.storage.from(env.supabaseStorage!.bucket).remove([key]);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

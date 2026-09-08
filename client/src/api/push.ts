import { api } from "./client";

/**
 * Fetches the server's VAPID public key. Returns null both when the request
 * fails for network reasons and when the server responds 404 (push not
 * configured on this deploy) — callers treat both cases identically: push is
 * unavailable.
 */
export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const { data } = await api.get<{ publicKey: string }>("/push/public-key");
    return data.publicKey;
  } catch {
    return null;
  }
}

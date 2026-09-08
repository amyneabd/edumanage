import type { Request, Response } from "express";
import { vapidPublicKey } from "../utils/vapid.js";
import { removeSubscription, saveSubscription } from "../services/push.service.js";

export function getPushPublicKeyHandler(_req: Request, res: Response) {
  if (!vapidPublicKey) {
    res.status(404).json({ error: "Les notifications push ne sont pas configurées sur ce serveur." });
    return;
  }
  res.json({ publicKey: vapidPublicKey });
}

export async function subscribePushHandler(req: Request, res: Response) {
  const { endpoint, keys } = req.body ?? {};
  if (typeof endpoint !== "string" || !keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
    res.status(400).json({ error: "Abonnement push invalide." });
    return;
  }

  await saveSubscription(req.user!.id, { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } });
  res.status(204).send();
}

export async function unsubscribePushHandler(req: Request, res: Response) {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint !== "string") {
    res.status(400).json({ error: "Un endpoint est requis." });
    return;
  }

  await removeSubscription(endpoint);
  res.status(204).send();
}

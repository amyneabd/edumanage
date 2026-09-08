import { useCallback, useEffect, useState } from "react";
import { fetchVapidPublicKey } from "../api/push";
import {
  subscribeToPush as subscribeToPushTeacher,
  unsubscribeFromPush as unsubscribeFromPushTeacher,
} from "../api/teacher";
import {
  subscribeToPush as subscribeToPushParent,
  unsubscribeFromPush as unsubscribeFromPushParent,
} from "../api/parent";
import { urlBase64ToUint8Array } from "../lib/pushKey";

export type PushStatus = "unsupported" | "unconfigured" | "denied" | "unsubscribed" | "subscribed" | "loading";

function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

export function usePushSubscription(role: "teacher" | "parent") {
  const [status, setStatus] = useState<PushStatus>("loading");
  const subscribeToPush = role === "parent" ? subscribeToPushParent : subscribeToPushTeacher;
  const unsubscribeFromPush = role === "parent" ? unsubscribeFromPushParent : unsubscribeFromPushTeacher;

  // Derives the displayed state from Notification.permission on every mount
  // so the toggle self-corrects if the user changes the permission outside
  // the app (e.g. via the browser's site settings).
  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const existing = await registration.pushManager.getSubscription();
    setStatus(existing ? "subscribed" : "unsubscribed");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }

    const publicKey = await fetchVapidPublicKey();
    if (!publicKey) {
      setStatus("unconfigured");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "unsubscribed");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const json = subscription.toJSON();
    await subscribeToPush({
      endpoint: json.endpoint!,
      keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
    });
    setStatus("subscribed");
  }, [subscribeToPush]);

  const disable = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await unsubscribeFromPush(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setStatus("unsubscribed");
  }, [unsubscribeFromPush]);

  return { status, enable, disable };
}

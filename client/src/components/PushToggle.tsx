import { Bell, BellOff } from "lucide-react";
import { usePushSubscription } from "../hooks/usePushSubscription";

export function PushToggle({ role }: { role: "teacher" | "parent" }) {
  const { status, enable, disable } = usePushSubscription(role);

  if (status === "unsupported" || status === "loading" || status === "unconfigured") return null;

  if (status === "denied") {
    return (
      <p className="text-xs text-ink-400">
        Notifications bloquées — activez-les dans les paramètres de votre navigateur.
      </p>
    );
  }

  const subscribed = status === "subscribed";

  return (
    <button
      type="button"
      onClick={() => (subscribed ? disable() : enable())}
      className="focus-ring flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink-500 transition-colors hover:bg-canvas hover:text-ink-700"
      aria-label={subscribed ? "Désactiver les notifications push" : "Activer les notifications push"}
      aria-pressed={subscribed}
    >
      {subscribed ? (
        <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      ) : (
        <BellOff className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}

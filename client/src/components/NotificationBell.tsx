import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "../api/teacher";
import {
  fetchParentNotifications,
  markAllParentNotificationsRead,
  markParentNotificationRead,
} from "../api/parent";
import type { NotificationItem } from "../api/types";
import { NOTIFICATION_META } from "../lib/notificationMeta";

export function NotificationBell({ role }: { role: "teacher" | "parent" }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const queryKey = [role, "notifications"];
  const fetchFn = role === "parent" ? fetchParentNotifications : fetchNotifications;
  const readFn = role === "parent" ? markParentNotificationRead : markNotificationRead;
  const readAllFn = role === "parent" ? markAllParentNotificationsRead : markAllNotificationsRead;

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const { data } = useQuery({
    queryKey,
    queryFn: fetchFn,
    refetchInterval: 15_000,
  });

  const readMutation = useMutation({
    mutationFn: readFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const readAllMutation = useMutation({
    mutationFn: readAllFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  function handleSelect(n: NotificationItem) {
    if (!n.read) readMutation.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="focus-ring relative flex min-h-11 min-w-11 items-center justify-center rounded-sm text-ink-500 transition-colors hover:bg-canvas hover:text-ink-700"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-elevated outline-none"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p id={titleId} className="text-sm font-semibold text-ink-900">Notifications</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => readAllMutation.mutate()}
                  className="focus-ring rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-400">You're all caught up.</p>
              ) : (
                items.map((n) => {
                  const meta = NOTIFICATION_META[n.type];
                  return (
                    <button
                      type="button"
                      key={n.id}
                      onClick={() => handleSelect(n)}
                      className={clsx(
                        "focus-ring flex w-full gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-canvas",
                        !n.read && "bg-accent-50"
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm",
                          meta.color
                        )}
                        aria-hidden="true"
                      >
                        <meta.Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink-900">{n.title}</span>
                          {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600" />}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-500">{n.body}</span>
                        <span className="mt-0.5 block text-[11px] text-ink-400">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fetchNotifications, markNotificationRead } from "../../api/teacher";
import { NOTIFICATION_META } from "../../lib/notificationMeta";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/Feedback";
import type { NotificationItem } from "../../api/types";

export function RecentActivityCard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["teacher", "notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 15_000,
  });

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["teacher", "notifications"] }),
  });

  const items = (data?.items ?? []).slice(0, 5);

  function handleSelect(n: NotificationItem) {
    if (!n.read) readMutation.mutate(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <Card className="p-6">
      <h2 className="text-sm font-medium text-ink-700">Recent activity</h2>
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nothing yet" description="Pupil requests, submissions, and payment alerts show up here." />
        </div>
      ) : (
        <ul className="mt-4 space-y-1">
          {items.map((n) => {
            const meta = NOTIFICATION_META[n.type];
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(n)}
                  className="focus-ring flex w-full items-start gap-3 rounded-sm px-2 py-2 -mx-2 text-left transition-colors hover:bg-canvas"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${meta.color}`}
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
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

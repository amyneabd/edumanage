import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cancelSwapRequest,
  createSwapRequest,
  fetchOtherClasses,
  fetchOwnSwapRequests,
  fetchPupilSchedule,
} from "../../api/pupil";
import { extractErrorMessage } from "../../api/client";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { SwapStatusBadge } from "../../components/Badge";
import { EmptyState, ErrorState, Spinner } from "../../components/Feedback";
import { ScheduleView } from "../../components/ScheduleView";
import { DAY_NAMES } from "../../lib/period";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SwapRequestForm() {
  const queryClient = useQueryClient();
  const otherClassesQuery = useQuery({ queryKey: ["pupil", "other-classes"], queryFn: fetchOtherClasses });
  const [originDate, setOriginDate] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [reason, setReason] = useState("");

  const classes = otherClassesQuery.data ?? [];
  const activeClassId = targetClassId || classes[0]?.id || "";
  const selectedClass = classes.find((c) => c.id === activeClassId);

  const mutation = useMutation({
    mutationFn: () =>
      createSwapRequest({
        originDate,
        targetClassId: activeClassId,
        targetDate,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Swap request sent.");
      setOriginDate("");
      setTargetDate("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["pupil", "swap-requests"] });
    },
  });

  if (otherClassesQuery.isLoading) return <Spinner />;

  if (classes.length === 0) {
    return (
      <EmptyState
        title="No other classes to join"
        description="Your teacher only has the class you're already enrolled in."
      />
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!originDate || !activeClassId || !targetDate) return;
        mutation.mutate();
      }}
    >
      <div>
        <label htmlFor="swap-request-origin-date" className="text-sm font-medium text-ink-700">Session you'll miss</label>
        <input
          id="swap-request-origin-date"
          required
          aria-required="true"
          type="date"
          min={todayIso()}
          value={originDate}
          onChange={(e) => setOriginDate(e.target.value)}
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        />
      </div>

      <div>
        <label htmlFor="swap-request-target-class" className="text-sm font-medium text-ink-700">Class to join</label>
        <select
          id="swap-request-target-class"
          value={activeClassId}
          onChange={(e) => setTargetClassId(e.target.value)}
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>
        {selectedClass && (
          <p className="mt-1 text-xs text-ink-400">
            {selectedClass.scheduleSlots.length === 0
              ? "No schedule set for this class yet."
              : `Meets: ${selectedClass.scheduleSlots
                  .slice()
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                  .map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}–${s.endTime}`)
                  .join(", ")}`}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="swap-request-target-date" className="text-sm font-medium text-ink-700">Date to attend</label>
        <input
          id="swap-request-target-date"
          required
          aria-required="true"
          type="date"
          min={todayIso()}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        />
      </div>

      <div>
        <label htmlFor="swap-request-reason" className="text-sm font-medium text-ink-700">Reason (optional)</label>
        <textarea
          id="swap-request-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. I'll be away from my usual class that day."
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        />
      </div>

      {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

      <Button type="submit" size="sm" disabled={mutation.isPending || !originDate || !targetDate}>
        {mutation.isPending ? "Sending…" : "Request swap"}
      </Button>
    </form>
  );
}

function MySwapRequests() {
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ["pupil", "swap-requests"], queryFn: fetchOwnSwapRequests });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelSwapRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pupil", "swap-requests"] }),
  });

  if (requestsQuery.isLoading) return <Spinner />;

  const requests = requestsQuery.data ?? [];
  if (requests.length === 0) {
    return <EmptyState title="No swap requests yet" description="Requests you send will show up here." />;
  }

  return (
    <ul className="space-y-2.5">
      {requests.map((r) => (
        <li key={r.id} className="rounded-sm bg-canvas p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink-900">{r.targetClassName}</p>
              <p className="mt-1 text-xs text-ink-500">
                {new Date(r.targetDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                instead of {r.originClassName} on{" "}
                {new Date(r.originDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              {r.reason && <p className="mt-1 text-xs italic text-ink-400">"{r.reason}"</p>}
            </div>
            <div className="flex items-center gap-2">
              <SwapStatusBadge status={r.status} />
              {r.status === "PENDING" && (
                <button
                  onClick={() => cancelMutation.mutate(r.id)}
                  disabled={cancelMutation.isPending}
                  className="focus-ring rounded-sm text-xs font-medium text-danger-600 hover:text-danger-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PupilSchedulePage() {
  const { data, isLoading } = useQuery({ queryKey: ["pupil", "schedule"], queryFn: fetchPupilSchedule });

  if (isLoading || !data) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Schedule</h1>
      <p className="mt-1 text-sm text-ink-500">{data.className}</p>

      <div className="mt-6">
        <ScheduleView data={data} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-medium text-ink-700">Swap a session</h2>
          <p className="mt-1 text-xs text-ink-400">
            Need to swap your usual class for a different one on a particular day? Request it here.
          </p>
          <div className="mt-3">
            <SwapRequestForm />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium text-ink-700">My swap requests</h2>
          <div className="mt-3">
            <MySwapRequests />
          </div>
        </Card>
      </div>
    </div>
  );
}

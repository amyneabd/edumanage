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
import { DAY_NAMES, formatDate } from "../../lib/period";
import { CLASS_TYPE_LABELS } from "../../lib/labels";

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
      toast.success("Demande d'échange envoyée.");
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
        title="Aucune autre classe à rejoindre"
        description="Votre enseignant ne propose que la classe où vous êtes déjà inscrit(e)."
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
        <label htmlFor="swap-request-origin-date" className="text-sm font-medium text-ink-700">Séance que vous allez manquer</label>
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
        <label htmlFor="swap-request-target-class" className="text-sm font-medium text-ink-700">Classe à rejoindre</label>
        <select
          id="swap-request-target-class"
          value={activeClassId}
          onChange={(e) => setTargetClassId(e.target.value)}
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({CLASS_TYPE_LABELS[c.type]})
            </option>
          ))}
        </select>
        {selectedClass && (
          <p className="mt-1 text-xs text-ink-400">
            {selectedClass.scheduleSlots.length === 0
              ? "Aucun emploi du temps défini pour cette classe."
              : `Horaires : ${selectedClass.scheduleSlots
                  .slice()
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                  .map((s) => `${DAY_NAMES[s.dayOfWeek]} ${s.startTime}–${s.endTime}`)
                  .join(", ")}`}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="swap-request-target-date" className="text-sm font-medium text-ink-700">Date à laquelle assister</label>
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
        <label htmlFor="swap-request-reason" className="text-sm font-medium text-ink-700">Motif (optionnel)</label>
        <textarea
          id="swap-request-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="ex. : je serai absent(e) de ma classe habituelle ce jour-là."
          className="mt-1 w-full rounded-sm border border-border-strong px-3 py-2 text-sm focus-ring"
        />
      </div>

      {mutation.isError && <ErrorState message={extractErrorMessage(mutation.error)} />}

      <Button type="submit" size="sm" disabled={mutation.isPending || !originDate || !targetDate}>
        {mutation.isPending ? "Envoi…" : "Demander un échange"}
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
    return <EmptyState title="Aucune demande d'échange pour le moment" description="Les demandes que vous envoyez s'afficheront ici." />;
  }

  return (
    <ul className="space-y-2.5">
      {requests.map((r) => (
        <li key={r.id} className="rounded-sm bg-canvas p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink-900">{r.targetClassName}</p>
              <p className="mt-1 text-xs text-ink-500">
                {formatDate(r.targetDate, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                à la place de {r.originClassName} le{" "}
                {formatDate(r.originDate, {
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
                  Annuler
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
      <h1 className="text-2xl font-semibold text-ink-900">Emploi du temps</h1>
      <p className="mt-1 text-sm text-ink-500">{data.className}</p>

      <div className="mt-6">
        <ScheduleView data={data} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-medium text-ink-700">Échanger une séance</h2>
          <p className="mt-1 text-xs text-ink-400">
            Besoin d'échanger votre classe habituelle contre une autre à une date précise ? Faites votre demande ici.
          </p>
          <div className="mt-3">
            <SwapRequestForm />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium text-ink-700">Mes demandes d'échange</h2>
          <div className="mt-3">
            <MySwapRequests />
          </div>
        </Card>
      </div>
    </div>
  );
}

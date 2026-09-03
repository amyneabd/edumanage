import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, X } from "lucide-react";
import {
  addVacationSession,
  approveParentRequest,
  declineParentRequest,
  deletePupilFromClass,
  fetchClassDetail,
  fetchCurrentVacation,
  fetchParentRequests,
  fetchVacationSessions,
  removeVacationSession,
  updateClassFee,
  updatePaymentStatus,
  updateSchedule,
} from "../../api/teacher";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ClassTypeBadge, PaymentBadge } from "../../components/Badge";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState, Spinner } from "../../components/Feedback";
import { currentPeriod, DAY_NAMES } from "../../lib/period";
import { PupilDetailModal } from "./PupilDetailModal";
import type { PaymentStatus, PupilSummary, ScheduleSlot, VacationSessionEntry } from "../../api/types";

const PAYMENT_STATUSES: PaymentStatus[] = ["PAID", "UNPAID", "INCOMPLETE"];

export function VacationSessionsPanel({ classId }: { classId: string }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");

  const vacationQuery = useQuery({ queryKey: ["teacher", "vacation"], queryFn: fetchCurrentVacation });
  const sessionsQuery = useQuery({
    queryKey: ["teacher", "classes", classId, "vacation-sessions"],
    queryFn: () => fetchVacationSessions(classId),
    enabled: !!vacationQuery.data,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["teacher", "classes", classId, "vacation-sessions"] });

  const addMutation = useMutation({
    mutationFn: () => addVacationSession(classId, { date, startTime, endTime }),
    onSuccess: () => {
      toast.success("Ad-hoc session added.");
      setDate("");
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (sessionId: string) => removeVacationSession(classId, sessionId),
    onSuccess: invalidate,
  });

  const period = vacationQuery.data;
  if (!period) return null;

  const sessions: VacationSessionEntry[] = sessionsQuery.data ?? [];

  return (
    <Card className="mt-6 p-5">
      <h2 className="text-sm font-medium text-ink-700">Vacation sessions</h2>
      <p className="mt-1 text-xs text-ink-400">
        One-off sessions for this class between{" "}
        {new Date(`${period.startDate.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}{" "}
        and{" "}
        {new Date(`${period.endDate.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
        .
      </p>

      <div className="mt-3 space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-28 text-xs text-ink-700">
              {new Date(`${s.date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-xs text-ink-700">
              {s.startTime}–{s.endTime}
            </span>
            <button
              onClick={() => removeMutation.mutate(s.id)}
              className="focus-ring ml-auto rounded-sm text-ink-400 hover:text-danger-600"
              aria-label={`Remove vacation session on ${s.date}`}
            >
              <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p className="text-xs text-ink-400">No ad-hoc sessions added yet.</p>}
      </div>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          addMutation.mutate();
        }}
      >
        <input
          type="date"
          required
          min={period.startDate.slice(0, 10)}
          max={period.endDate.slice(0, 10)}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="focus-ring rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="focus-ring w-24 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="focus-ring w-24 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
        />
        <Button size="sm" type="submit" disabled={addMutation.isPending || !date}>
          {addMutation.isPending ? "Adding…" : "Add session"}
        </Button>
      </form>
    </Card>
  );
}

export function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const period = currentPeriod();

  const { data: klass, isLoading } = useQuery({
    queryKey: ["teacher", "classes", id],
    queryFn: () => fetchClassDetail(id!),
    enabled: !!id,
  });

  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [selectedPupilId, setSelectedPupilId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PupilSummary | null>(null);

  useEffect(() => {
    if (klass) setSlots(klass.scheduleSlots.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })));
  }, [klass]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["teacher", "classes", id] });

  const removeMutation = useMutation({
    mutationFn: (pupilId: string) => deletePupilFromClass(id!, pupilId),
    onSuccess: () => {
      toast.success("Pupil removed from class.");
      setRemoveTarget(null);
      invalidate();
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ pupilId, status }: { pupilId: string; status: PaymentStatus }) =>
      updatePaymentStatus(pupilId, { status }),
    onSuccess: invalidate,
  });

  const scheduleMutation = useMutation({
    mutationFn: () => updateSchedule(id!, slots),
    onSuccess: () => {
      toast.success("Schedule saved.");
      invalidate();
    },
  });

  const feeMutation = useMutation({
    mutationFn: (fee: number | null) => updateClassFee(id!, fee),
    onSuccess: invalidate,
  });

  const parentRequestsQuery = useQuery({
    queryKey: ["teacher", "classes", id, "parent-requests"],
    queryFn: () => fetchParentRequests(id!),
    enabled: !!id,
  });

  const invalidateParentRequests = () =>
    queryClient.invalidateQueries({ queryKey: ["teacher", "classes", id, "parent-requests"] });

  const approveParentMutation = useMutation({
    mutationFn: (requestId: string) => approveParentRequest(requestId),
    onSuccess: () => {
      toast.success("Parent link approved.");
      invalidateParentRequests();
    },
  });

  const declineParentMutation = useMutation({
    mutationFn: (requestId: string) => declineParentRequest(requestId),
    onSuccess: invalidateParentRequests,
  });

  if (isLoading || !klass) return <Spinner />;

  return (
    <div>
      <Link
        to="/teacher/classes"
        className="focus-ring inline-flex items-center gap-1 rounded-sm text-sm font-medium text-accent-600 hover:text-accent-700"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        Back to classes
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink-900">{klass.name}</h1>
        <ClassTypeBadge type={klass.type} />
        <label className="flex items-center gap-1.5 text-sm text-ink-500">
          Monthly fee
          <span className="flex items-center rounded-sm border border-border-strong px-2 py-1 focus-within:ring-2 focus-within:ring-accent-600 focus-within:ring-offset-2 focus-within:ring-offset-surface">
            <span className="text-ink-400">$</span>
            <input
              type="number"
              min={0}
              key={`fee-${klass.monthlyFee}`}
              defaultValue={klass.monthlyFee ?? ""}
              placeholder="—"
              onBlur={(e) => {
                const val = e.target.value === "" ? null : Number(e.target.value);
                if (val !== klass.monthlyFee) feeMutation.mutate(val);
              }}
              className="w-16 border-none p-0 text-sm text-ink-900 focus:outline-none focus:ring-0"
            />
          </span>
        </label>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-medium text-ink-700">Members ({klass.pupils.length})</h2>
          {klass.pupils.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No pupils yet" description="Drag a request into this class from Class Management." />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th scope="col" className="pb-2 font-medium">Name</th>
                  <th scope="col" className="pb-2 font-medium">Payment ({period})</th>
                  <th scope="col" className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {klass.pupils.map((p) => {
                  const payment = p.payments?.find((pay) => pay.period === period);
                  return (
                    <tr key={p.userId}>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPupilId(p.userId)}
                          className="focus-ring rounded-sm text-left hover:opacity-80"
                          title="View pupil details and attendance"
                        >
                          <p className="font-medium text-accent-600 hover:text-accent-700">{p.user.name}</p>
                          <p className="text-xs text-ink-500">{p.user.email}</p>
                        </button>
                      </td>
                      <td className="py-3">
                        <select
                          value={payment?.status ?? "UNPAID"}
                          onChange={(e) =>
                            paymentMutation.mutate({ pupilId: p.userId, status: e.target.value as PaymentStatus })
                          }
                          className="focus-ring rounded-sm border border-border-strong bg-surface px-2 py-1 text-xs text-ink-700"
                        >
                          {PAYMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <span className="ml-2">
                          <PaymentBadge status={payment?.status ?? "UNPAID"} />
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setRemoveTarget(p)}
                          className="focus-ring rounded-sm text-xs font-medium text-danger-600 hover:text-danger-700"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium text-ink-700">Class schedule</h2>
          <p className="mt-1 text-xs text-ink-400">Shared with pupils in this class.</p>

          <div className="mt-3 space-y-2">
            {slots.map((slot, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={slot.dayOfWeek}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = { ...next[i], dayOfWeek: Number(e.target.value) };
                    setSlots(next);
                  }}
                  className="focus-ring rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
                >
                  {DAY_NAMES.map((d, idx) => (
                    <option key={d} value={idx}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = { ...next[i], startTime: e.target.value };
                    setSlots(next);
                  }}
                  className="focus-ring w-24 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
                />
                <span className="text-xs text-ink-400">–</span>
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = { ...next[i], endTime: e.target.value };
                    setSlots(next);
                  }}
                  className="focus-ring w-24 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
                />
                <button
                  onClick={() => setSlots(slots.filter((_, idx) => idx !== i))}
                  className="focus-ring rounded-sm text-ink-400 hover:text-danger-600"
                  aria-label={`Remove ${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime} time slot`}
                >
                  <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setSlots([...slots, { dayOfWeek: 1, startTime: "16:00", endTime: "17:00" }])}
              className="focus-ring inline-flex items-center gap-1 rounded-sm text-xs font-medium text-accent-600 hover:text-accent-700"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
              Add time slot
            </button>
            <Button size="sm" onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        </Card>
      </div>

      <VacationSessionsPanel classId={id!} />

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-medium text-ink-700">Upcoming visitors</h2>
        <p className="mt-1 text-xs text-ink-400">Pupils approved to sit in on a future session of this class.</p>
        {(klass.visitRequests?.length ?? 0) === 0 ? (
          <div className="mt-3">
            <EmptyState title="No upcoming visitors" description="Approved one-off session requests will show here." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {klass.visitRequests!.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink-900">{v.pupil.user.name}</p>
                  <p className="text-xs text-ink-500">{v.pupil.user.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-ink-700">
                    {new Date(v.sessionDate).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {v.reason && <p className="text-xs italic text-ink-400">"{v.reason}"</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-medium text-ink-700">Parent link requests</h2>
        <p className="mt-1 text-xs text-ink-400">Parents requesting to follow a pupil in this class.</p>
        {!parentRequestsQuery.data || parentRequestsQuery.data.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No pending requests" description="Parent link requests for this class will show here." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {parentRequestsQuery.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {r.parentName} <span className="font-normal text-ink-400">→</span> {r.pupilName}
                  </p>
                  <p className="text-xs text-ink-500">{r.parentEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => declineParentMutation.mutate(r.id)}
                    disabled={declineParentMutation.isPending || approveParentMutation.isPending}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveParentMutation.mutate(r.id)}
                    disabled={declineParentMutation.isPending || approveParentMutation.isPending}
                  >
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PupilDetailModal pupilId={selectedPupilId} onClose={() => setSelectedPupilId(null)} />

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove pupil from class?"
        description={removeTarget ? `${removeTarget.user.name} will lose access to this class's feed and schedule.` : undefined}
        confirmLabel="Remove"
        isPending={removeMutation.isPending}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.userId)}
      />
    </div>
  );
}

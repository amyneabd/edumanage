import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import clsx from "clsx";
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
import { currentPeriod, DAY_NAMES, formatDate } from "../../lib/period";
import { PupilDetailModal } from "./PupilDetailModal";
import type { PaymentStatus, PupilSummary, ScheduleSlot, VacationSessionEntry } from "../../api/types";
import { PAYMENT_STATUS_LABELS } from "../../lib/labels";

const PAYMENT_STATUSES: PaymentStatus[] = ["PAID", "UNPAID", "INCOMPLETE"];

interface DraftVacationSession {
  date: string;
  startTime: string;
  endTime: string;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateOnly(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function VacationSessionsPanel({ classId }: { classId: string }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<DraftVacationSession[]>([]);

  const vacationQuery = useQuery({ queryKey: ["teacher", "vacation"], queryFn: fetchCurrentVacation });
  const sessionsQuery = useQuery({
    queryKey: ["teacher", "classes", classId, "vacation-sessions"],
    queryFn: () => fetchVacationSessions(classId),
    enabled: !!vacationQuery.data,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["teacher", "classes", classId, "vacation-sessions"] });

  const addAllMutation = useMutation({
    mutationFn: (entries: DraftVacationSession[]) =>
      Promise.allSettled(entries.map((entry) => addVacationSession(classId, entry))),
    onSuccess: (results) => {
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (succeeded > 0 && failed === 0) {
        toast.success(`${succeeded} séance${succeeded > 1 ? "s" : ""} ajoutée${succeeded > 1 ? "s" : ""}.`);
      } else if (succeeded > 0 && failed > 0) {
        toast.success(`${succeeded} séance${succeeded > 1 ? "s" : ""} ajoutée${succeeded > 1 ? "s" : ""}, ${failed} déjà existante${failed > 1 ? "s" : ""} ignorée${failed > 1 ? "s" : ""}.`);
      } else {
        toast.error("Aucune séance n'a pu être ajoutée.");
      }
      setDrafts([]);
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
  const bookedDates = new Set(sessions.map((s) => s.date.slice(0, 10)));
  const draftByDate = new Map(drafts.map((d) => [d.date, d]));

  const startDate = parseDateOnly(period.startDate.slice(0, 10));
  const endDate = parseDateOnly(period.endDate.slice(0, 10));
  const gridStart = new Date(startDate);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(endDate);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const cells: { key: string; dayNumber: number; inRange: boolean; booked: boolean; selected: boolean }[] = [];
  for (const d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    const key = dateKey(d);
    const inRange = d >= startDate && d <= endDate;
    cells.push({
      key,
      dayNumber: d.getDate(),
      inRange,
      booked: bookedDates.has(key),
      selected: draftByDate.has(key),
    });
  }

  function toggleDay(key: string) {
    setDrafts((prev) => {
      if (prev.some((d) => d.date === key)) return prev.filter((d) => d.date !== key);
      return [...prev, { date: key, startTime: "16:00", endTime: "17:00" }].sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  function updateDraft(key: string, field: "startTime" | "endTime", value: string) {
    setDrafts((prev) => prev.map((d) => (d.date === key ? { ...d, [field]: value } : d)));
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d.date !== key));
  }

  return (
    <Card className="mt-6 p-5">
      <h2 className="text-sm font-medium text-ink-700">Séances de vacances</h2>
      <p className="mt-1 text-xs text-ink-400">
        Séances ponctuelles pour cette classe entre{" "}
        {formatDate(`${period.startDate.slice(0, 10)}T00:00:00`, {
          month: "short",
          day: "numeric",
        })}{" "}
        et{" "}
        {formatDate(`${period.endDate.slice(0, 10)}T00:00:00`, {
          month: "short",
          day: "numeric",
        })}
        .
      </p>

      <div className="mt-3 space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-28 text-xs text-ink-700">
              {formatDate(`${s.date.slice(0, 10)}T00:00:00`, {
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
              aria-label={`Supprimer la séance de vacances du ${s.date}`}
            >
              <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        ))}
        {sessions.length === 0 && <p className="text-xs text-ink-400">Aucune séance ponctuelle ajoutée pour le moment.</p>}
      </div>

      <p className="mt-4 text-xs font-medium text-ink-500">Sélectionnez les jours à ajouter</p>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {DAY_NAMES.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => (
          <button
            key={cell.key}
            type="button"
            disabled={!cell.inRange || cell.booked}
            aria-pressed={cell.selected}
            aria-label={`${formatDate(`${cell.key}T00:00:00`, { day: "numeric", month: "long" })}${
              cell.booked ? " (déjà programmée)" : ""
            }`}
            onClick={() => toggleDay(cell.key)}
            className={clsx(
              "focus-ring rounded-sm py-1.5 text-xs",
              !cell.inRange && "cursor-not-allowed text-ink-200",
              cell.inRange && cell.booked && "cursor-not-allowed bg-ink-100 text-ink-300",
              cell.inRange && !cell.booked && cell.selected && "bg-accent-600 text-white",
              cell.inRange && !cell.booked && !cell.selected && "text-ink-700 hover:bg-surface-muted"
            )}
          >
            {cell.dayNumber}
          </button>
        ))}
      </div>

      {drafts.length > 0 && (
        <div className="mt-3 space-y-2">
          {drafts.map((d) => (
            <div key={d.date} className="flex items-center gap-2">
              <span className="w-28 text-xs text-ink-700">
                {formatDate(`${d.date}T00:00:00`, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <input
                type="time"
                value={d.startTime}
                onChange={(e) => updateDraft(d.date, "startTime", e.target.value)}
                className="focus-ring w-24 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
              />
              <input
                type="time"
                value={d.endTime}
                onChange={(e) => updateDraft(d.date, "endTime", e.target.value)}
                className="focus-ring w-24 rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-xs text-ink-700"
              />
              <button
                onClick={() => removeDraft(d.date)}
                className="focus-ring ml-auto rounded-sm text-ink-400 hover:text-danger-600"
                aria-label={`Retirer le ${d.date} de la sélection`}
              >
                <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          ))}
          <Button size="sm" onClick={() => addAllMutation.mutate(drafts)} disabled={addAllMutation.isPending}>
            {addAllMutation.isPending
              ? "Ajout…"
              : `Ajouter les ${drafts.length} séance${drafts.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
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
      toast.success("Élève retiré de la classe.");
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
      toast.success("Emploi du temps enregistré.");
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
      toast.success("Lien parent approuvé.");
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
        Retour aux classes
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-ink-900">{klass.name}</h1>
        <ClassTypeBadge type={klass.type} />
        <label className="flex items-center gap-1.5 text-sm text-ink-500">
          Frais mensuels
          <span className="flex items-center rounded-sm border border-border-strong px-2 py-1 focus-within:ring-2 focus-within:ring-accent-600 focus-within:ring-offset-2 focus-within:ring-offset-surface">
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
            <span className="text-ink-400">TND</span>
          </span>
        </label>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-medium text-ink-700">Membres ({klass.pupils.length})</h2>
          {klass.pupils.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="Aucun élève pour le moment" description="Faites glisser une demande dans cette classe depuis la Gestion des classes." />
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th scope="col" className="pb-2 font-medium">Nom</th>
                  <th scope="col" className="pb-2 font-medium">Paiement ({period})</th>
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
                          title="Voir les détails et les présences de l'élève"
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
                              {PAYMENT_STATUS_LABELS[s]}
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
                          Retirer
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
          <h2 className="text-sm font-medium text-ink-700">Emploi du temps de la classe</h2>
          <p className="mt-1 text-xs text-ink-400">Partagé avec les élèves de cette classe.</p>

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
                  aria-label={`Supprimer le créneau du ${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime}`}
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
              Ajouter un créneau
            </button>
            <Button size="sm" onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? "Enregistrement…" : "Enregistrer l'emploi du temps"}
            </Button>
          </div>
        </Card>
      </div>

      <VacationSessionsPanel classId={id!} />

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-medium text-ink-700">Visiteurs à venir</h2>
        <p className="mt-1 text-xs text-ink-400">Élèves autorisés à assister à une prochaine séance de cette classe.</p>
        {(klass.swapVisitors?.length ?? 0) === 0 ? (
          <div className="mt-3">
            <EmptyState title="Aucun visiteur à venir" description="Les demandes de séance ponctuelle approuvées s'afficheront ici." />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {klass.swapVisitors!.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="text-sm font-medium text-ink-900">{v.pupil.user.name}</p>
                  <p className="text-xs text-ink-500">{v.pupil.user.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-ink-700">
                    {formatDate(v.targetDate, {
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
        <h2 className="text-sm font-medium text-ink-700">Demandes de lien parent</h2>
        <p className="mt-1 text-xs text-ink-400">Parents demandant à suivre un élève dans cette classe.</p>
        {!parentRequestsQuery.data || parentRequestsQuery.data.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Aucune demande en attente" description="Les demandes de lien parent pour cette classe s'afficheront ici." />
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
                    Refuser
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveParentMutation.mutate(r.id)}
                    disabled={declineParentMutation.isPending || approveParentMutation.isPending}
                  >
                    Approuver
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
        title="Retirer l'élève de la classe ?"
        description={removeTarget ? `${removeTarget.user.name} perdra l'accès aux publications et à l'emploi du temps de cette classe.` : undefined}
        confirmLabel="Retirer"
        isPending={removeMutation.isPending}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.userId)}
      />
    </div>
  );
}

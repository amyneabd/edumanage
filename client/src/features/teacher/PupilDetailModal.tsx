import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clearAttendance, fetchAttendanceCalendar, fetchPupilDetail, fetchPupilPayments, markAttendance } from "../../api/teacher";
import { Modal } from "../../components/Modal";
import { ClassTypeBadge, PaymentBadge } from "../../components/Badge";
import { Spinner } from "../../components/Feedback";
import { DAY_NAMES, currentPeriod, formatPeriodLabel, shiftPeriod } from "../../lib/period";
import { formatCurrency } from "../../lib/currency";
import type { AttendanceDay, AttendanceStatus } from "../../api/types";

interface GridCell {
  dayNumber: number;
  entry: AttendanceDay | null;
}

function buildGrid(period: string, days: AttendanceDay[]): (GridCell | null)[] {
  const [year, month] = period.split("-").map(Number);
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const firstWeekday = new Date(year!, month! - 1, 1).getDay();
  const daysInMonth = new Date(year!, month!, 0).getDate();

  const cells: (GridCell | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ dayNumber: day, entry: dayMap.get(key) ?? null });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const DISPLAY_STYLES: Record<AttendanceDay["display"], string> = {
  FUTURE: "bg-canvas text-ink-400",
  TODAY: "bg-accent-600 text-white ring-2 ring-accent-100",
  PRESENT: "bg-success-600 text-white hover:bg-success-700",
  ABSENT: "bg-danger-600 text-white hover:bg-danger-700",
  UNMARKED: "border-2 border-dashed border-border-strong text-ink-500 hover:border-accent-600 hover:text-accent-600",
};

const DISPLAY_LABELS: Record<AttendanceDay["display"], string> = {
  FUTURE: "Upcoming session",
  TODAY: "Today's session",
  PRESENT: "Present",
  ABSENT: "Absent",
  UNMARKED: "Not marked yet — click to record",
};

export function PupilDetailModal({ pupilId, onClose }: { pupilId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());

  useEffect(() => {
    if (pupilId) setPeriod(currentPeriod());
  }, [pupilId]);

  const detailQuery = useQuery({
    queryKey: ["teacher", "pupil-detail", pupilId],
    queryFn: () => fetchPupilDetail(pupilId!),
    enabled: !!pupilId,
  });

  const calendarQuery = useQuery({
    queryKey: ["teacher", "pupil-attendance", pupilId, period],
    queryFn: () => fetchAttendanceCalendar(pupilId!, period),
    enabled: !!pupilId,
  });

  const paymentsQuery = useQuery({
    queryKey: ["teacher", "pupil-payments", pupilId],
    queryFn: () => fetchPupilPayments(pupilId!),
    enabled: !!pupilId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["teacher", "pupil-attendance", pupilId] });

  const markMutation = useMutation({
    mutationFn: ({ date, status }: { date: string; status: AttendanceStatus }) => markAttendance(pupilId!, date, status),
    onSuccess: invalidate,
  });

  const clearMutation = useMutation({
    mutationFn: (date: string) => clearAttendance(pupilId!, date),
    onSuccess: invalidate,
  });

  const days = calendarQuery.data?.days ?? [];
  const grid = useMemo(() => buildGrid(period, days), [period, days]);

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let upcoming = 0;
    let unmarked = 0;
    for (const d of days) {
      if (d.display === "PRESENT") present++;
      else if (d.display === "ABSENT") absent++;
      else if (d.display === "FUTURE") upcoming++;
      else if (d.display === "UNMARKED") unmarked++;
    }
    return { present, absent, upcoming, unmarked };
  }, [days]);

  function handleDayClick(day: AttendanceDay) {
    if (day.display === "FUTURE") return;
    if (day.record === null) markMutation.mutate({ date: day.date, status: "PRESENT" });
    else if (day.record === "PRESENT") markMutation.mutate({ date: day.date, status: "ABSENT" });
    else clearMutation.mutate(day.date);
  }

  const pupil = detailQuery.data;

  return (
    <Modal open={!!pupilId} onClose={onClose} title={pupil?.name ?? "Pupil"} maxWidthClassName="max-w-lg">
      {!pupil || calendarQuery.isLoading ? (
        <Spinner />
      ) : (
        <div>
          <p className="text-sm text-ink-500">{pupil.email}</p>
          {pupil.classId && (
            <div className="mt-2 flex items-center gap-2">
              {pupil.classType && <ClassTypeBadge type={pupil.classType} />}
              <span className="text-sm text-ink-700">{pupil.className}</span>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink-700">Attendance</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPeriod(shiftPeriod(period, -1))}
                className="focus-ring flex h-11 w-11 items-center justify-center rounded-sm border border-border-strong text-ink-500 hover:bg-canvas"
                title="Previous month"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              </button>
              <span className="w-28 text-center text-sm font-medium text-ink-700">{formatPeriodLabel(period)}</span>
              <button
                type="button"
                onClick={() => setPeriod(shiftPeriod(period, 1))}
                className="focus-ring flex h-11 w-11 items-center justify-center rounded-sm border border-border-strong text-ink-500 hover:bg-canvas"
                title="Next month"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </div>

          {!pupil.classId ? (
            <p className="mt-6 text-center text-sm text-ink-400">This pupil isn't assigned to a class yet.</p>
          ) : days.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink-400">No sessions scheduled for this class yet.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink-400">
                {DAY_NAMES.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {grid.map((cell, i) =>
                  !cell ? (
                    <div key={i} />
                  ) : !cell.entry ? (
                    <div key={i} className="flex h-9 items-center justify-center rounded-sm text-xs text-ink-400">
                      {cell.dayNumber}
                    </div>
                  ) : (
                    <button
                      key={i}
                      type="button"
                      title={`${cell.entry.startTime}–${cell.entry.endTime} · ${DISPLAY_LABELS[cell.entry.display]}`}
                      aria-label={`${cell.dayNumber} ${formatPeriodLabel(period)}, ${cell.entry.startTime}–${cell.entry.endTime}, ${DISPLAY_LABELS[cell.entry.display]}`}
                      disabled={cell.entry.display === "FUTURE"}
                      onClick={() => handleDayClick(cell.entry!)}
                      className={clsx(
                        "focus-ring relative flex h-9 items-center justify-center rounded-sm text-xs font-medium transition-colors",
                        DISPLAY_STYLES[cell.entry.display],
                        cell.entry.display !== "FUTURE" && "cursor-pointer"
                      )}
                    >
                      {cell.dayNumber}
                      {cell.entry.display === "TODAY" && cell.entry.record && (
                        <span
                          className={clsx(
                            "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white",
                            cell.entry.record === "PRESENT" ? "bg-success-600" : "bg-danger-600"
                          )}
                        />
                      )}
                    </button>
                  )
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-success-600" /> Present ({stats.present})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger-600" /> Absent ({stats.absent})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-border-strong" /> Not marked ({stats.unmarked})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-border" /> Upcoming ({stats.upcoming})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-600" /> Today
                </span>
              </div>
              <p className="mt-3 text-[11px] text-ink-400">
                Click a past or today's session to cycle it between present, absent, and not marked.
              </p>
            </>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <h3 className="text-sm font-medium text-ink-700">Payment history</h3>
            {paymentsQuery.isLoading ? (
              <Spinner />
            ) : !paymentsQuery.data || paymentsQuery.data.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">No payment records yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                    <th scope="col" className="pb-1.5 font-medium">Period</th>
                    <th scope="col" className="pb-1.5 font-medium">Status</th>
                    <th scope="col" className="pb-1.5 font-medium">Paid / Due</th>
                    <th scope="col" className="pb-1.5 font-medium">Due date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paymentsQuery.data.map((entry) => (
                    <tr key={entry.period}>
                      <td className="py-1.5 font-medium text-ink-700">{formatPeriodLabel(entry.period)}</td>
                      <td className="py-1.5">
                        <PaymentBadge status={entry.status} />
                        {entry.isOverdue && <span className="ml-1.5 text-[11px] font-medium text-danger-600">overdue</span>}
                      </td>
                      <td className="py-1.5 text-ink-500">
                        {formatCurrency(entry.amountPaid)} / {formatCurrency(entry.amountDue)}
                      </td>
                      <td className="py-1.5 text-ink-500">
                        {entry.dueDate ? new Date(entry.dueDate).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

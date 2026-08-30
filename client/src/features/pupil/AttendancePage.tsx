import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ClipboardCheck, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchPupilAttendance } from "../../api/pupil";
import { Card } from "../../components/Card";
import { StatCard } from "../../components/StatCard";
import { Spinner } from "../../components/Feedback";
import { DAY_NAMES, currentPeriod, formatPeriodLabel, shiftPeriod } from "../../lib/period";
import type { AttendanceDay } from "../../api/types";

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
  PRESENT: "bg-success-600 text-white",
  ABSENT: "bg-danger-600 text-white",
  UNMARKED: "border-2 border-dashed border-border-strong text-ink-500",
};

const DISPLAY_LABELS: Record<AttendanceDay["display"], string> = {
  FUTURE: "Upcoming session",
  TODAY: "Today's session",
  PRESENT: "Present",
  ABSENT: "Absent",
  UNMARKED: "Not marked yet",
};

export function PupilAttendancePage() {
  const [period, setPeriod] = useState(currentPeriod());

  const { data, isLoading } = useQuery({
    queryKey: ["pupil", "attendance", period],
    queryFn: () => fetchPupilAttendance(period),
  });

  const days = data?.days ?? [];
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
    const marked = present + absent;
    const rate = marked > 0 ? Math.round((present / marked) * 100) : null;
    return { present, absent, upcoming, unmarked, rate };
  }, [days]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900">Attendance</h1>
      <p className="mt-1 text-sm text-ink-500">{data?.className ?? "Your class"}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Attendance rate"
          value={stats.rate !== null ? `${stats.rate}%` : "—"}
          icon={<ClipboardCheck className="h-[18px] w-[18px]" strokeWidth={1.8} />}
        />
        <StatCard
          label="Present"
          value={stats.present}
          icon={<CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-success-50 text-success-600"
        />
        <StatCard
          label="Absent"
          value={stats.absent}
          icon={<XCircle className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          accent="bg-danger-50 text-danger-600"
        />
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-700">Calendar</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPeriod(shiftPeriod(period, -1))}
              className="focus-ring flex h-11 w-11 items-center justify-center rounded-sm border border-border text-ink-500 hover:bg-canvas"
              title="Previous month"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <span className="w-28 text-center text-sm font-medium text-ink-700">{formatPeriodLabel(period)}</span>
            <button
              type="button"
              onClick={() => setPeriod(shiftPeriod(period, 1))}
              className="focus-ring flex h-11 w-11 items-center justify-center rounded-sm border border-border text-ink-500 hover:bg-canvas"
              title="Next month"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <Spinner />
        ) : !data?.className ? (
          <p className="mt-6 text-center text-sm text-ink-700">You're not assigned to a class yet.</p>
        ) : days.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-700">No sessions scheduled for this class.</p>
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
                  <div
                    key={i}
                    title={`${cell.entry.startTime}–${cell.entry.endTime} · ${DISPLAY_LABELS[cell.entry.display]}`}
                    className={clsx(
                      "flex h-9 items-center justify-center rounded-sm text-xs font-medium",
                      DISPLAY_STYLES[cell.entry.display]
                    )}
                  >
                    {cell.dayNumber}
                  </div>
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
                <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-border-strong" /> Not marked (
                {stats.unmarked})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-border-strong" /> Upcoming ({stats.upcoming})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-accent-600" /> Today
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

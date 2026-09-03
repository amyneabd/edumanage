import { Card } from "./Card";
import { EmptyState } from "./Feedback";
import { DAY_NAMES } from "../lib/period";
import type { ScheduleViewResponse } from "../api/types";

export function ScheduleView({ data }: { data: ScheduleViewResponse }) {
  if (data.mode === "vacation") {
    if (data.sessions.length === 0) {
      return (
        <Card className="p-5">
          <EmptyState
            title="No vacation sessions scheduled yet"
            description="The teacher hasn't added one-off sessions for this window."
          />
        </Card>
      );
    }
    return (
      <ul className="space-y-2">
        {data.sessions.map((s, i) => (
          <li key={`${s.date}-${i}`} className="flex items-center gap-3 rounded-sm border border-border bg-surface px-3 py-2.5">
            <span className="text-sm font-medium text-ink-900">
              {new Date(`${s.date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-sm text-ink-500">
              {s.startTime}–{s.endTime}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const today = new Date().getDay();
  const byDay = Array.from({ length: 7 }, (_, day) =>
    data.slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime))
  );
  const hasAny = data.slots.length > 0;

  if (!hasAny) {
    return (
      <Card className="p-5">
        <EmptyState title="No schedule set yet" description="The teacher hasn't added session times." />
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[700px] grid-cols-7 gap-2">
        {DAY_NAMES.map((name, day) => (
          <div
            key={name}
            className={`rounded-sm border p-2.5 ${
              day === today ? "border-accent-600/40 bg-accent-50" : "border-border bg-surface"
            }`}
          >
            <p
              className={`text-center text-xs font-semibold uppercase tracking-wide ${
                day === today ? "text-accent-600" : "text-ink-400"
              }`}
            >
              {name}
              {day === today && <span className="ml-1 font-normal normal-case text-accent-600/60">· today</span>}
            </p>
            <div className="mt-2.5 space-y-1.5">
              {byDay[day]!.length === 0 ? (
                <p className="py-3 text-center text-[11px] text-ink-400">No session</p>
              ) : (
                byDay[day]!.map((s, i) => (
                  <div
                    key={i}
                    className={`rounded-sm px-1.5 py-2 text-center text-[11px] font-medium leading-tight ${
                      day === today ? "bg-accent-100 text-accent-600" : "bg-canvas text-ink-700"
                    }`}
                  >
                    <span className="block">{s.startTime}</span>
                    <span className="block">{s.endTime}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

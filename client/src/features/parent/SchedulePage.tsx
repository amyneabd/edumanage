import { useQuery } from "@tanstack/react-query";
import { fetchChildSchedule } from "../../api/parent";
import { Card } from "../../components/Card";
import { EmptyState, Spinner } from "../../components/Feedback";
import { DAY_NAMES } from "../../lib/period";
import { useSelectedChild } from "./useSelectedChild";
import { ChildSwitcher } from "./ChildSwitcher";

export function ParentSchedulePage() {
  const { pupilId, isLoading: childrenLoading } = useSelectedChild();
  const scheduleQuery = useQuery({
    queryKey: ["parent", "schedule", pupilId],
    queryFn: () => fetchChildSchedule(pupilId!),
    enabled: !!pupilId,
  });

  if (childrenLoading) return <Spinner />;

  const data = scheduleQuery.data;
  const today = new Date().getDay();
  const byDay = Array.from({ length: 7 }, (_, day) =>
    (data?.slots ?? []).filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime))
  );
  const hasAny = (data?.slots.length ?? 0) > 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Schedule</h1>
      <div className="mt-4">
        <ChildSwitcher />
      </div>

      {!pupilId ? (
        <Card className="mt-6 p-5">
          <EmptyState title="No linked children yet" description="Add a child using their Parent Code to get started." />
        </Card>
      ) : scheduleQuery.isLoading ? (
        <Spinner />
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-500">{data?.className}</p>

          {!hasAny ? (
            <Card className="mt-6 p-5">
              <EmptyState title="No schedule set yet" description="The teacher hasn't added session times." />
            </Card>
          ) : (
            <div className="mt-6 overflow-x-auto">
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
                            {s.startTime}
                            <br />
                            {s.endTime}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

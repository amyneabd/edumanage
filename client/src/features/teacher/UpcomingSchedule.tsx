import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { ClassTypeBadge } from "../../components/Badge";
import { EmptyState } from "../../components/Feedback";
import { DAY_NAMES } from "../../lib/period";
import type { ScheduleEntry } from "../../api/types";

function minutesSinceMidnight(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function weeklyDayLabel(offsetDays: number, dayOfWeek: number): string {
  if (offsetDays === 0) return "Today";
  if (offsetDays === 1) return "Tomorrow";
  return DAY_NAMES[dayOfWeek] ?? "";
}

function vacationDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const offsetDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (offsetDays === 0) return "Today";
  if (offsetDays === 1) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

interface RankedEntry extends ScheduleEntry {
  sortKey: number;
  label: string;
}

export function UpcomingSchedule({ schedule }: { schedule: ScheduleEntry[] }) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();

  const upcoming: RankedEntry[] = schedule
    .map((entry) => {
      if (entry.date) {
        const entryDate = new Date(`${entry.date}T00:00:00`);
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        const offsetDays = Math.round((entryDate.getTime() - todayMidnight.getTime()) / 86_400_000);
        const sortKey = offsetDays * 1440 + minutesSinceMidnight(entry.startTime);
        return { ...entry, sortKey, label: vacationDayLabel(entry.date) };
      }

      const dayOfWeek = entry.dayOfWeek ?? 0;
      let offsetDays = (dayOfWeek - today + 7) % 7;
      if (offsetDays === 0 && minutesSinceMidnight(entry.endTime) <= nowMinutes) {
        offsetDays = 7;
      }
      const sortKey = offsetDays * 1440 + minutesSinceMidnight(entry.startTime);
      return { ...entry, sortKey, label: weeklyDayLabel(offsetDays, dayOfWeek) };
    })
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 5);

  return (
    <Card className="p-6">
      <h2 className="text-sm font-medium text-ink-700">Upcoming sessions</h2>
      {upcoming.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No scheduled sessions"
            description="Add a weekly schedule from a class's detail page."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {upcoming.map((entry, i) => (
            <li key={`${entry.classId}-${entry.date ?? entry.dayOfWeek}-${entry.startTime}-${i}`}>
              <Link
                to={`/teacher/classes/${entry.classId}`}
                className="focus-ring flex items-center justify-between rounded-sm px-2 py-2 -mx-2 transition-colors hover:bg-canvas"
              >
                <div className="flex items-center gap-3">
                  <div className="flex w-16 flex-col items-center rounded-sm border border-border bg-canvas py-1.5">
                    <span className="text-[11px] font-medium uppercase text-ink-500">{entry.label}</span>
                    <span className="text-xs font-semibold text-ink-900">{entry.startTime}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900">{entry.className}</p>
                    <p className="text-xs text-ink-400">
                      {entry.startTime}–{entry.endTime}
                    </p>
                  </div>
                </div>
                <ClassTypeBadge type={entry.classType} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

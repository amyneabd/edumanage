import { useQuery } from "@tanstack/react-query";
import { fetchChildSchedule } from "../../api/parent";
import { Card } from "../../components/Card";
import { EmptyState, Spinner } from "../../components/Feedback";
import { ScheduleView } from "../../components/ScheduleView";
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
      ) : scheduleQuery.isLoading || !data ? (
        <Spinner />
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-500">{data.className}</p>
          <div className="mt-6">
            <ScheduleView data={data} />
          </div>
        </>
      )}
    </div>
  );
}

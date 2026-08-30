import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import {
  adjustGoalProgress,
  createGoal,
  deleteGoal,
  fetchGoals,
  toggleGoal,
} from "../../api/teacher";
import { currentPeriod, formatPeriodLabel, shiftPeriod } from "../../lib/period";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Feedback";
import type { Goal } from "../../api/types";

function GoalRow({ goal, editable }: { goal: Goal; editable: boolean }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["teacher", "goals"] });

  const progressMutation = useMutation({
    mutationFn: (delta: number) => adjustGoalProgress(goal.id, delta),
    onSuccess: invalidate,
  });
  const toggleMutation = useMutation({
    mutationFn: () => toggleGoal(goal.id),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onSuccess: invalidate,
  });

  const numeric = goal.targetCount != null;

  return (
    <li className="group flex items-center gap-3 rounded-sm px-2 py-2.5 -mx-2 hover:bg-canvas">
      {!numeric && (
        <button
          type="button"
          disabled={!editable}
          onClick={() => toggleMutation.mutate()}
          className={clsx(
            "focus-ring flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition-colors",
            goal.achieved
              ? "border-success-600 bg-success-600 text-white"
              : "border-border-strong text-transparent hover:border-accent-600",
            !editable && "cursor-default opacity-70"
          )}
        >
          <Check className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "truncate text-sm font-medium",
            goal.achieved ? "text-ink-400 line-through" : "text-ink-900"
          )}
        >
          {goal.title}
        </p>
        {numeric && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className={clsx("h-full rounded-full", goal.achieved ? "bg-success-600" : "bg-accent-600")}
                style={{ width: `${Math.min(100, (goal.currentCount / (goal.targetCount ?? 1)) * 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-ink-400">
              {goal.currentCount}/{goal.targetCount}
            </span>
          </div>
        )}
      </div>

      {numeric && editable && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => progressMutation.mutate(-1)}
            disabled={goal.currentCount <= 0}
            aria-label={`Decrease progress for "${goal.title}"`}
            className="focus-ring relative flex h-6 w-6 items-center justify-center rounded-sm border border-border-strong text-ink-500 after:absolute after:inset-x-0 after:-top-[10px] after:-bottom-[10px] after:content-[''] hover:bg-canvas disabled:opacity-30"
          >
            <Minus className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => progressMutation.mutate(1)}
            disabled={goal.currentCount >= (goal.targetCount ?? 0)}
            aria-label={`Increase progress for "${goal.title}"`}
            className="focus-ring relative flex h-6 w-6 items-center justify-center rounded-sm border border-border-strong text-ink-500 after:absolute after:inset-x-0 after:-top-[10px] after:-bottom-[10px] after:content-[''] hover:bg-canvas disabled:opacity-30"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      )}
      {numeric && goal.achieved && (
        <span className="text-success-600">
          <Check className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}

      {editable && (
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          className="focus-ring hidden h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-danger-50 hover:text-danger-600 group-hover:flex"
          title="Remove goal"
          aria-label={`Remove goal "${goal.title}"`}
        >
          <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export function GoalsPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get("period") ?? currentPeriod();

  const [title, setTitle] = useState("");
  const [hasTarget, setHasTarget] = useState(false);
  const [targetCount, setTargetCount] = useState(5);

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["teacher", "goals", period],
    queryFn: () => fetchGoals(period),
  });

  const createMutation = useMutation({
    mutationFn: () => createGoal(title.trim(), hasTarget ? targetCount : undefined),
    onSuccess: () => {
      setTitle("");
      setHasTarget(false);
      setTargetCount(5);
      queryClient.invalidateQueries({ queryKey: ["teacher", "goals"] });
    },
  });

  function goToPeriod(p: string) {
    if (p === currentPeriod()) {
      searchParams.delete("period");
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ period: p }, { replace: true });
    }
  }

  const isCurrent = data?.isCurrent ?? period === currentPeriod();
  const goals = data?.goals ?? [];
  const achieved = data?.achieved ?? 0;
  const total = data?.total ?? 0;
  const percent = total === 0 ? 0 : Math.round((achieved / total) * 100);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-ink-700">Monthly goals</h2>
          <p className="mt-0.5 text-xs text-ink-400">
            {isCurrent ? "Set what you want to get done this month." : "Recap of what got done."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPeriod(shiftPeriod(period, -1))}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-sm border border-border-strong text-ink-500 hover:bg-canvas"
            title="Previous month"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <span className="w-32 text-center text-sm font-medium text-ink-700">
            {formatPeriodLabel(period)}
          </span>
          <button
            type="button"
            onClick={() => goToPeriod(shiftPeriod(period, 1))}
            disabled={isCurrent}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-sm border border-border-strong text-ink-500 hover:bg-canvas disabled:opacity-30"
            title="Next month"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {total > 0 && (
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-2xl font-semibold text-ink-900">{percent}%</span>
              <span className="text-sm text-ink-500">
                {achieved} of {total} goal{total === 1 ? "" : "s"} achieved
              </span>
            </div>
          )}

          {goals.length === 0 ? (
            <p className="mt-6 text-center text-sm text-ink-400">
              {isCurrent ? "No goals yet — add your first one below." : "No goals were set for this month."}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {goals.map((g) => (
                <GoalRow key={g.id} goal={g} editable={isCurrent} />
              ))}
            </ul>
          )}

          {isCurrent && (
            <form
              className="mt-5 space-y-2 border-t border-border pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!title.trim()) return;
                createMutation.mutate();
              }}
            >
              <div className="flex gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Enroll 5 new pupils"
                  className="focus-ring flex-1 rounded-sm border border-border-strong bg-surface px-3 py-2 text-sm text-ink-900"
                />
                {hasTarget && (
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={targetCount}
                    onChange={(e) => setTargetCount(Number(e.target.value))}
                    className="focus-ring w-20 rounded-sm border border-border-strong bg-surface px-2 py-2 text-sm text-ink-900"
                  />
                )}
                <Button type="submit" size="sm" disabled={createMutation.isPending || !title.trim()}>
                  Add
                </Button>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-ink-500">
                <input
                  type="checkbox"
                  checked={hasTarget}
                  onChange={(e) => setHasTarget(e.target.checked)}
                  className="focus-ring h-3.5 w-3.5 rounded border-border-strong"
                />
                Track as a number (e.g. reach a target count)
              </label>
            </form>
          )}
        </>
      )}
    </Card>
  );
}

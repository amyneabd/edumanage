import { prisma } from "../utils/prisma.js";
import { currentPeriod } from "../utils/period.js";

export class GoalError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function listGoals(teacherId: string, period?: string) {
  const targetPeriod = period ?? currentPeriod();
  const goals = await prisma.goal.findMany({
    where: { teacherId, period: targetPeriod },
    orderBy: { createdAt: "asc" },
  });
  const achieved = goals.filter((g) => g.achieved).length;
  return {
    period: targetPeriod,
    isCurrent: targetPeriod === currentPeriod(),
    goals,
    total: goals.length,
    achieved,
  };
}

export async function createGoal(teacherId: string, title: string, targetCount?: number) {
  return prisma.goal.create({
    data: {
      teacherId,
      period: currentPeriod(),
      title,
      targetCount: targetCount ?? null,
    },
  });
}

async function getOwnedGoal(teacherId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, teacherId } });
  if (!goal) throw new GoalError("Goal not found.", 404);
  if (goal.period !== currentPeriod()) throw new GoalError("Cannot edit a past month's goals.", 400);
  return goal;
}

export async function adjustGoalProgress(teacherId: string, goalId: string, delta: number) {
  const goal = await getOwnedGoal(teacherId, goalId);
  if (!goal.targetCount) throw new GoalError("This goal has no numeric target.", 400);

  const nextCount = Math.max(0, Math.min(goal.targetCount, goal.currentCount + delta));
  const achieved = nextCount >= goal.targetCount;

  return prisma.goal.update({
    where: { id: goalId },
    data: {
      currentCount: nextCount,
      achieved,
      achievedAt: achieved ? goal.achievedAt ?? new Date() : null,
    },
  });
}

export async function toggleGoal(teacherId: string, goalId: string) {
  const goal = await getOwnedGoal(teacherId, goalId);
  if (goal.targetCount) throw new GoalError("Use progress tracking for goals with a target.", 400);

  const achieved = !goal.achieved;
  return prisma.goal.update({
    where: { id: goalId },
    data: { achieved, achievedAt: achieved ? new Date() : null },
  });
}

export async function deleteGoal(teacherId: string, goalId: string) {
  await getOwnedGoal(teacherId, goalId);
  await prisma.goal.delete({ where: { id: goalId } });
}

import type { Request, Response } from "express";
import { z } from "zod";
import {
  GoalError,
  adjustGoalProgress,
  createGoal,
  deleteGoal,
  listGoals,
  toggleGoal,
} from "../services/goal.service.js";

function handleGoalError(err: unknown, res: Response) {
  if (err instanceof GoalError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

export async function getGoals(req: Request, res: Response) {
  const period = req.query.period;
  const result = await listGoals(req.user!.id, typeof period === "string" ? period : undefined);
  res.json(result);
}

const createSchema = z.object({
  title: z.string().min(1).max(120),
  targetCount: z.number().int().min(1).max(9999).optional(),
});

export async function createGoalHandler(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const goal = await createGoal(req.user!.id, parsed.data.title, parsed.data.targetCount);
  res.status(201).json(goal);
}

const progressSchema = z.object({ delta: z.number().int() });

export async function progressGoalHandler(req: Request, res: Response) {
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const goal = await adjustGoalProgress(req.user!.id, req.params.id as string, parsed.data.delta);
    res.json(goal);
  } catch (err) {
    if (!handleGoalError(err, res)) throw err;
  }
}

export async function toggleGoalHandler(req: Request, res: Response) {
  try {
    const goal = await toggleGoal(req.user!.id, req.params.id as string);
    res.json(goal);
  } catch (err) {
    if (!handleGoalError(err, res)) throw err;
  }
}

export async function deleteGoalHandler(req: Request, res: Response) {
  try {
    await deleteGoal(req.user!.id, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    if (!handleGoalError(err, res)) throw err;
  }
}

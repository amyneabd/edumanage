import type { Request, Response } from "express";
import { z } from "zod";
import {
  VacationError,
  addVacationSession,
  endVacation,
  getActiveVacationPeriod,
  listVacationSessions,
  removeVacationSession,
  startVacation,
} from "../services/vacation.service.js";

function handleVacationError(err: unknown, res: Response) {
  if (err instanceof VacationError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

export async function currentVacationHandler(req: Request, res: Response) {
  const period = await getActiveVacationPeriod(req.user!.id);
  res.json(period);
}

const startSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function startVacationHandler(req: Request, res: Response) {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const period = await startVacation(req.user!.id, parsed.data.startDate, parsed.data.endDate);
    res.status(201).json(period);
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}

export async function endVacationHandler(req: Request, res: Response) {
  try {
    const period = await endVacation(req.user!.id);
    res.json(period);
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}

export async function listVacationSessionsHandler(req: Request, res: Response) {
  try {
    const sessions = await listVacationSessions(req.user!.id, req.params.id as string);
    res.json(sessions);
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}

const addSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function addVacationSessionHandler(req: Request, res: Response) {
  const parsed = addSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const session = await addVacationSession(
      req.user!.id,
      req.params.id as string,
      parsed.data.date,
      parsed.data.startTime,
      parsed.data.endTime
    );
    res.status(201).json(session);
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}

export async function removeVacationSessionHandler(req: Request, res: Response) {
  try {
    await removeVacationSession(req.user!.id, req.params.id as string, req.params.sessionId as string);
    res.status(204).send();
  } catch (err) {
    if (!handleVacationError(err, res)) throw err;
  }
}

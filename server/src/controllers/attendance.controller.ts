import type { Request, Response } from "express";
import { z } from "zod";
import {
  AttendanceError,
  clearAttendance,
  getAttendanceCalendar,
  getPupilDetail,
  markAttendance,
} from "../services/attendance.service.js";

function handleAttendanceError(err: unknown, res: Response) {
  if (err instanceof AttendanceError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

export async function pupilDetailHandler(req: Request, res: Response) {
  try {
    const pupil = await getPupilDetail(req.user!.id, req.params.pupilId as string);
    res.json(pupil);
  } catch (err) {
    if (!handleAttendanceError(err, res)) throw err;
  }
}

export async function attendanceCalendarHandler(req: Request, res: Response) {
  const period = typeof req.query.period === "string" ? req.query.period : undefined;
  try {
    const calendar = await getAttendanceCalendar(req.user!.id, req.params.pupilId as string, period);
    res.json(calendar);
  } catch (err) {
    if (!handleAttendanceError(err, res)) throw err;
  }
}

const markSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PRESENT", "ABSENT"]),
});

export async function markAttendanceHandler(req: Request, res: Response) {
  const parsed = markSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const record = await markAttendance(req.user!.id, req.params.pupilId as string, parsed.data.date, parsed.data.status);
    res.json(record);
  } catch (err) {
    if (!handleAttendanceError(err, res)) throw err;
  }
}

const clearSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function clearAttendanceHandler(req: Request, res: Response) {
  const parsed = clearSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    await clearAttendance(req.user!.id, req.params.pupilId as string, parsed.data.date);
    res.status(204).send();
  } catch (err) {
    if (!handleAttendanceError(err, res)) throw err;
  }
}

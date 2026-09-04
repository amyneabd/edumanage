import type { Request, Response } from "express";
import { z } from "zod";
import { listPostsForClass, submitToExam, getOwnGrades, PostError } from "../services/post.service.js";
import { AttendanceError, getOwnAttendanceCalendar } from "../services/attendance.service.js";
import { PaymentError, getOwnPaymentHistory } from "../services/payment.service.js";
import { PupilError, getHomeSnapshot, getPupilProfileWithClass } from "../services/pupil.service.js";
import { getClassScheduleView } from "../services/vacation.service.js";
import {
  SwapError,
  listOtherClassesForPupil,
  createSwapRequest,
  listOwnSwapRequests,
  cancelSwapRequest,
} from "../services/swap.service.js";
import { saveFile } from "../utils/storage.js";

export async function home(req: Request, res: Response) {
  try {
    const snapshot = await getHomeSnapshot(req.user!.id);
    res.json(snapshot);
  } catch (err) {
    if (err instanceof PupilError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

export async function attendanceCalendarHandler(req: Request, res: Response) {
  const period = typeof req.query.period === "string" ? req.query.period : undefined;
  try {
    const calendar = await getOwnAttendanceCalendar(req.user!.id, period);
    res.json(calendar);
  } catch (err) {
    if (err instanceof AttendanceError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

export async function paymentHistoryHandler(req: Request, res: Response) {
  try {
    const history = await getOwnPaymentHistory(req.user!.id);
    res.json(history);
  } catch (err) {
    if (err instanceof PaymentError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

export async function schedule(req: Request, res: Response) {
  const profile = await getPupilProfileWithClass(req.user!.id);
  if (!profile?.class) {
    res.status(404).json({ error: "Not yet assigned to a class." });
    return;
  }
  const view = await getClassScheduleView(profile.classId!, profile.class.teacher.userId);
  res.json({ className: profile.class.name, ...view });
}

export async function posts(req: Request, res: Response) {
  const profile = await getPupilProfileWithClass(req.user!.id);
  if (!profile?.classId) {
    res.status(404).json({ error: "Not yet assigned to a class." });
    return;
  }
  const items = await listPostsForClass(profile.classId);
  const withOwnSubmission = items.map((p) => ({
    ...p,
    mySubmission: p.submissions.find((s) => s.pupilId === req.user!.id) ?? null,
    submissions: undefined,
  }));
  res.json(withOwnSubmission);
}

export async function gradesHandler(req: Request, res: Response) {
  const grades = await getOwnGrades(req.user!.id);
  res.json(grades);
}

export async function submitExam(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "A file is required for submission." });
    return;
  }
  try {
    const saved = await saveFile(file.buffer, file.originalname, file.mimetype);
    const submission = await submitToExam({
      postId: req.params.postId as string,
      pupilId: req.user!.id,
      fileUrl: saved.url,
      fileName: file.originalname,
    });
    res.status(201).json(submission);
  } catch (err) {
    if (err instanceof PostError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

function handleSwapError(err: unknown, res: Response) {
  if (err instanceof SwapError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

export async function otherClassesHandler(req: Request, res: Response) {
  try {
    const classes = await listOtherClassesForPupil(req.user!.id);
    res.json(classes);
  } catch (err) {
    if (!handleSwapError(err, res)) throw err;
  }
}

export async function listSwapRequestsHandler(req: Request, res: Response) {
  try {
    const requests = await listOwnSwapRequests(req.user!.id);
    res.json(requests);
  } catch (err) {
    if (!handleSwapError(err, res)) throw err;
  }
}

const createSwapRequestSchema = z.object({
  originDate: z.string().min(1),
  targetClassId: z.string().min(1),
  targetDate: z.string().min(1),
  reason: z.string().optional(),
});

export async function createSwapRequestHandler(req: Request, res: Response) {
  const parsed = createSwapRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }
  try {
    const request = await createSwapRequest(req.user!.id, parsed.data);
    res.status(201).json(request);
  } catch (err) {
    if (!handleSwapError(err, res)) throw err;
  }
}

export async function cancelSwapRequestHandler(req: Request, res: Response) {
  try {
    await cancelSwapRequest(req.user!.id, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    if (!handleSwapError(err, res)) throw err;
  }
}

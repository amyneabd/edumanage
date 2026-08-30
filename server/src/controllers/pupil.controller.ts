import type { Request, Response } from "express";
import { listPostsForClass, submitToExam, getOwnGrades, PostError } from "../services/post.service.js";
import { AttendanceError, getOwnAttendanceCalendar } from "../services/attendance.service.js";
import { PaymentError, getOwnPaymentHistory } from "../services/payment.service.js";
import { PupilError, getHomeSnapshot, getPupilProfileWithClass } from "../services/pupil.service.js";
import {
  VisitError,
  cancelVisitRequest,
  createVisitRequest,
  listOtherClassesForPupil,
  listOwnVisitRequests,
} from "../services/visit.service.js";

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
  res.json({ className: profile.class.name, slots: profile.class.scheduleSlots });
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
    const submission = await submitToExam({
      postId: req.params.postId as string,
      pupilId: req.user!.id,
      fileUrl: `/uploads/${file.filename}`,
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

function handleVisitError(err: unknown, res: Response) {
  if (err instanceof VisitError) {
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
    if (!handleVisitError(err, res)) throw err;
  }
}

export async function listVisitRequestsHandler(req: Request, res: Response) {
  const requests = await listOwnVisitRequests(req.user!.id);
  res.json(
    requests.map((r) => ({
      id: r.id,
      classId: r.classId,
      className: r.class.name,
      classType: r.class.type,
      sessionDate: r.sessionDate,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
    }))
  );
}

export async function createVisitRequestHandler(req: Request, res: Response) {
  const { classId, sessionDate, reason } = req.body ?? {};
  if (typeof classId !== "string" || typeof sessionDate !== "string") {
    res.status(400).json({ error: "classId and sessionDate are required" });
    return;
  }
  try {
    const request = await createVisitRequest(req.user!.id, {
      classId,
      sessionDate,
      reason: typeof reason === "string" ? reason : null,
    });
    res.status(201).json(request);
  } catch (err) {
    if (!handleVisitError(err, res)) throw err;
  }
}

export async function cancelVisitRequestHandler(req: Request, res: Response) {
  try {
    await cancelVisitRequest(req.user!.id, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    if (!handleVisitError(err, res)) throw err;
  }
}

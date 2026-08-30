import type { Request, Response } from "express";
import {
  ParentError,
  getChildAttendance,
  getChildGrades,
  getChildHome,
  getChildPayments,
  getChildPosts,
  getChildSchedule,
  listChildrenForParent,
  listOwnLinks,
  requestParentLink,
} from "../services/parent.service.js";

function handleParentError(err: unknown, res: Response) {
  if (err instanceof ParentError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

export async function requestLinkHandler(req: Request, res: Response) {
  const { parentCode } = req.body ?? {};
  if (typeof parentCode !== "string" || parentCode.trim().length < 4) {
    res.status(400).json({ error: "A valid Parent Code is required." });
    return;
  }
  try {
    const link = await requestParentLink(req.user!.id, parentCode.trim());
    res.status(201).json(link);
  } catch (err) {
    if (!handleParentError(err, res)) throw err;
  }
}

export async function childrenHandler(req: Request, res: Response) {
  const links = await listChildrenForParent(req.user!.id);
  res.json(
    links.map((l) => ({
      pupilId: l.pupilId,
      name: l.pupil.user.name,
      className: l.pupil.class?.name ?? null,
      classType: l.pupil.class?.type ?? l.pupil.requestedType,
    }))
  );
}

export async function linksHandler(req: Request, res: Response) {
  const links = await listOwnLinks(req.user!.id);
  res.json(
    links.map((l) => ({
      id: l.id,
      pupilId: l.pupilId,
      pupilName: l.pupil.user.name,
      status: l.status,
      requestedAt: l.requestedAt,
      respondedAt: l.respondedAt,
    }))
  );
}

export async function childHomeHandler(req: Request, res: Response) {
  try {
    const snapshot = await getChildHome(req.user!.id, req.params.pupilId as string);
    res.json(snapshot);
  } catch (err) {
    if (!handleParentError(err, res)) throw err;
  }
}

export async function childScheduleHandler(req: Request, res: Response) {
  try {
    const schedule = await getChildSchedule(req.user!.id, req.params.pupilId as string);
    res.json(schedule);
  } catch (err) {
    if (!handleParentError(err, res)) throw err;
  }
}

export async function childAttendanceHandler(req: Request, res: Response) {
  const period = typeof req.query.period === "string" ? req.query.period : undefined;
  try {
    const calendar = await getChildAttendance(req.user!.id, req.params.pupilId as string, period);
    res.json(calendar);
  } catch (err) {
    if (!handleParentError(err, res)) throw err;
  }
}

export async function childPaymentsHandler(req: Request, res: Response) {
  try {
    const history = await getChildPayments(req.user!.id, req.params.pupilId as string);
    res.json(history);
  } catch (err) {
    if (!handleParentError(err, res)) throw err;
  }
}

export async function childGradesHandler(req: Request, res: Response) {
  try {
    const grades = await getChildGrades(req.user!.id, req.params.pupilId as string);
    res.json(grades);
  } catch (err) {
    if (!handleParentError(err, res)) throw err;
  }
}

export async function childPostsHandler(req: Request, res: Response) {
  try {
    const posts = await getChildPosts(req.user!.id, req.params.pupilId as string);
    res.json(posts);
  } catch (err) {
    if (!handleParentError(err, res)) throw err;
  }
}

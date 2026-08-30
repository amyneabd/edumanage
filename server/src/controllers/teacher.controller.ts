import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma.js";
import { uploadsDir } from "../middleware/upload.middleware.js";
import {
  ClassError,
  assignPupilToClass,
  createClass,
  getClassDetail,
  listClassesForTeacher,
  listPupilRequests,
  rejectPupilRequest,
  removePupilFromClass,
  updateClassFee,
  updateSchedule,
} from "../services/class.service.js";
import {
  PaymentError,
  getLedger,
  getLedgerSummary,
  getPaymentSummary,
  getPupilPaymentHistory,
  setPaymentStatus,
} from "../services/payment.service.js";
import {
  PostError,
  createPost,
  deletePost,
  getGradebook,
  gradeSubmission,
  listPostsForClass,
  updatePost,
} from "../services/post.service.js";
import {
  VisitError,
  listVisitRequestsForTeacher,
  respondToVisitRequest,
} from "../services/visit.service.js";
import {
  ParentError,
  listAllParentRequests,
  listParentRequestsForClass,
  respondToParentLink,
} from "../services/parent.service.js";

function handleServiceError(err: unknown, res: Response) {
  if (
    err instanceof ClassError ||
    err instanceof PaymentError ||
    err instanceof PostError ||
    err instanceof VisitError ||
    err instanceof ParentError
  ) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

export async function overview(req: Request, res: Response) {
  const teacherId = req.user!.id;

  const [classes, pupilCount, teacherProfile] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId },
      include: { _count: { select: { pupils: true } }, scheduleSlots: true },
    }),
    prisma.pupilProfile.count({ where: { teacherId, classId: { not: null }, user: { status: "ACTIVE" } } }),
    prisma.teacherProfile.findUnique({ where: { userId: teacherId } }),
  ]);

  const distribution = classes.map((c) => ({
    classId: c.id,
    name: c.name,
    type: c.type,
    pupilCount: c._count.pupils,
  }));

  const schedule = classes.flatMap((c) =>
    c.scheduleSlots.map((s) => ({
      classId: c.id,
      className: c.name,
      classType: c.type,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }))
  );

  const paymentSummary = await getPaymentSummary(teacherId);
  const pendingRequests = await prisma.pupilProfile.count({
    where: { teacherId, classId: null, user: { status: "PENDING" } },
  });

  res.json({
    teacherCode: teacherProfile?.teacherCode,
    pupilCount,
    classCount: classes.length,
    distribution,
    schedule,
    paymentSummary,
    pendingRequests,
  });
}

export async function listClasses(req: Request, res: Response) {
  const classes = await listClassesForTeacher(req.user!.id);
  res.json(classes);
}

const createClassSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["SCIENCE", "MATH", "INFO", "ECO"]),
  monthlyFee: z.number().min(0).max(100000).nullable().optional(),
});

export async function createClassHandler(req: Request, res: Response) {
  const parsed = createClassSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const klass = await createClass(req.user!.id, parsed.data.name, parsed.data.type, parsed.data.monthlyFee);
  res.status(201).json(klass);
}

const feeSchema = z.object({ monthlyFee: z.number().min(0).max(100000).nullable() });

export async function updateClassFeeHandler(req: Request, res: Response) {
  const parsed = feeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const klass = await updateClassFee(req.user!.id, req.params.id as string, parsed.data.monthlyFee);
    res.json(klass);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function classDetail(req: Request, res: Response) {
  try {
    const klass = await getClassDetail(req.user!.id, req.params.id as string);
    res.json(klass);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

const scheduleSchema = z.object({
  slots: z.array(
    z.object({
      dayOfWeek: z.number().min(0).max(6),
      startTime: z.string(),
      endTime: z.string(),
    })
  ),
});

export async function updateScheduleHandler(req: Request, res: Response) {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const klass = await updateSchedule(req.user!.id, req.params.id as string, parsed.data.slots);
    res.json(klass);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function deletePupilFromClass(req: Request, res: Response) {
  try {
    await removePupilFromClass(req.user!.id, req.params.id as string, req.params.pupilId as string);
    res.status(204).send();
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function pupilRequests(req: Request, res: Response) {
  const requests = await listPupilRequests(req.user!.id);
  res.json(
    requests.map((r) => ({
      pupilId: r.userId,
      name: r.user.name,
      email: r.user.email,
      requestedType: r.requestedType,
      createdAt: r.user.createdAt,
    }))
  );
}

const assignSchema = z.object({ classId: z.string().min(1) });

export async function assignPupilRequest(req: Request, res: Response) {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    await assignPupilToClass(req.user!.id, req.params.pupilId as string, parsed.data.classId);
    res.status(204).send();
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function rejectPupilRequestHandler(req: Request, res: Response) {
  try {
    await rejectPupilRequest(req.user!.id, req.params.pupilId as string);
    res.status(204).send();
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function ledger(req: Request, res: Response) {
  const { search, status, classId, period } = req.query;
  const rows = await getLedger(req.user!.id, {
    search: typeof search === "string" ? search : undefined,
    status: typeof status === "string" ? (status as any) : undefined,
    classId: typeof classId === "string" ? classId : undefined,
    period: typeof period === "string" ? period : undefined,
  });
  res.json(rows);
}

export async function ledgerSummary(req: Request, res: Response) {
  const period = req.query.period;
  const summary = await getLedgerSummary(req.user!.id, typeof period === "string" ? period : undefined);
  res.json(summary);
}

const paymentSchema = z.object({
  status: z.enum(["PAID", "UNPAID", "INCOMPLETE"]).optional(),
  period: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  amountDue: z.number().min(0).max(100000).nullable().optional(),
  amountPaid: z.number().min(0).max(100000).optional(),
});

export async function updatePayment(req: Request, res: Response) {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const record = await setPaymentStatus(req.user!.id, req.params.pupilId as string, parsed.data);
    res.json(record);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function pupilPaymentHistoryHandler(req: Request, res: Response) {
  try {
    const history = await getPupilPaymentHistory(req.user!.id, req.params.pupilId as string);
    res.json(history);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function listPosts(req: Request, res: Response) {
  const classId = req.query.classId;
  if (typeof classId !== "string") {
    res.status(400).json({ error: "classId is required" });
    return;
  }
  const owns = await prisma.class.findFirst({ where: { id: classId, teacherId: req.user!.id } });
  if (!owns) {
    res.status(404).json({ error: "Class not found." });
    return;
  }
  const posts = await listPostsForClass(classId);
  res.json(posts);
}

export async function createPostHandler(req: Request, res: Response) {
  const { classId, type, content, dueDate, maxGrade } = req.body;
  if (!classId || !type) {
    res.status(400).json({ error: "classId and type are required" });
    return;
  }
  const owns = await prisma.class.findFirst({ where: { id: classId, teacherId: req.user!.id } });
  if (!owns) {
    res.status(404).json({ error: "Class not found." });
    return;
  }

  const file = req.file;
  const parsedMaxGrade =
    maxGrade !== undefined && maxGrade !== "" ? Number(maxGrade) : null;
  const post = await createPost({
    classId,
    authorId: req.user!.id,
    type,
    content: content || undefined,
    fileUrl: file ? `/uploads/${file.filename}` : undefined,
    fileName: file ? file.originalname : undefined,
    dueDate: dueDate || undefined,
    maxGrade: parsedMaxGrade !== null && !Number.isNaN(parsedMaxGrade) ? parsedMaxGrade : null,
  });
  res.status(201).json(post);
}

export async function updatePostHandler(req: Request, res: Response) {
  const { content, dueDate, maxGrade } = req.body;
  const file = req.file;
  try {
    const previous = file ? await prisma.post.findUnique({ where: { id: req.params.id as string } }) : null;
    const post = await updatePost(req.params.id as string, req.user!.id, {
      content: content !== undefined ? content : undefined,
      dueDate: dueDate !== undefined ? dueDate : undefined,
      fileUrl: file ? `/uploads/${file.filename}` : undefined,
      fileName: file ? file.originalname : undefined,
      maxGrade: maxGrade !== undefined ? (maxGrade === "" ? null : Number(maxGrade)) : undefined,
    });
    if (file && previous?.fileUrl && previous.fileUrl !== post.fileUrl) {
      const oldPath = path.join(uploadsDir, path.basename(previous.fileUrl));
      fs.unlink(oldPath, () => {});
    }
    res.json(post);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function deletePostHandler(req: Request, res: Response) {
  try {
    const post = await deletePost(req.params.id as string, req.user!.id);
    if (post.fileUrl) {
      const filePath = path.join(uploadsDir, path.basename(post.fileUrl));
      fs.unlink(filePath, () => {});
    }
    res.status(204).send();
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

const gradeSchema = z.object({
  grade: z.number().min(0).max(100000).nullable(),
  feedback: z.string().max(4000).nullable().optional(),
});

export async function gradeSubmissionHandler(req: Request, res: Response) {
  const parsed = gradeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  try {
    const submission = await gradeSubmission(req.user!.id, req.params.id as string, parsed.data);
    res.json(submission);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function gradebookHandler(req: Request, res: Response) {
  const classId = req.query.classId;
  if (typeof classId !== "string") {
    res.status(400).json({ error: "classId is required" });
    return;
  }
  try {
    const gradebook = await getGradebook(req.user!.id, classId);
    res.json(gradebook);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function visitRequestsHandler(req: Request, res: Response) {
  const status = req.query.status;
  const requests = await listVisitRequestsForTeacher(
    req.user!.id,
    status === "PENDING" || status === "APPROVED" || status === "DECLINED" ? status : undefined
  );
  res.json(
    requests.map((r) => ({
      id: r.id,
      classId: r.classId,
      className: r.class.name,
      classType: r.class.type,
      pupilId: r.pupilId,
      pupilName: r.pupil.user.name,
      pupilEmail: r.pupil.user.email,
      sessionDate: r.sessionDate,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      respondedAt: r.respondedAt,
    }))
  );
}

export async function approveVisitRequestHandler(req: Request, res: Response) {
  try {
    const request = await respondToVisitRequest(req.user!.id, req.params.id as string, true);
    res.json(request);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function declineVisitRequestHandler(req: Request, res: Response) {
  try {
    const request = await respondToVisitRequest(req.user!.id, req.params.id as string, false);
    res.json(request);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function parentRequestsHandler(req: Request, res: Response) {
  const owns = await prisma.class.findFirst({ where: { id: req.params.id as string, teacherId: req.user!.id } });
  if (!owns) {
    res.status(404).json({ error: "Class not found." });
    return;
  }
  const requests = await listParentRequestsForClass(req.user!.id, req.params.id as string);
  res.json(
    requests.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      parentName: r.parent.user.name,
      parentEmail: r.parent.user.email,
      pupilId: r.pupilId,
      pupilName: r.pupil.user.name,
      requestedAt: r.requestedAt,
    }))
  );
}

export async function allParentRequestsHandler(req: Request, res: Response) {
  const requests = await listAllParentRequests(req.user!.id);
  res.json(
    requests.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      parentName: r.parent.user.name,
      parentEmail: r.parent.user.email,
      pupilId: r.pupilId,
      pupilName: r.pupil.user.name,
      className: r.pupil.class?.name ?? null,
      requestedAt: r.requestedAt,
    }))
  );
}

export async function approveParentRequestHandler(req: Request, res: Response) {
  try {
    const link = await respondToParentLink(req.user!.id, req.params.id as string, true);
    res.json(link);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

export async function declineParentRequestHandler(req: Request, res: Response) {
  try {
    const link = await respondToParentLink(req.user!.id, req.params.id as string, false);
    res.json(link);
  } catch (err) {
    if (!handleServiceError(err, res)) throw err;
  }
}

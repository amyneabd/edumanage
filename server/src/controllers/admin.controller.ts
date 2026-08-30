import type { Request, Response } from "express";
import { prisma } from "../utils/prisma.js";
import { AdminError, getTeacherDetail, listAllTeachers } from "../services/admin.service.js";

export async function listPendingTeachers(_req: Request, res: Response) {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER", status: "PENDING" },
    include: { teacherProfile: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(teachers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    teacherCode: t.teacherProfile?.teacherCode,
    createdAt: t.createdAt,
  })));
}

export async function approveTeacher(req: Request, res: Response) {
  const user = await prisma.user.findFirst({ where: { id: req.params.id as string, role: "TEACHER" } });
  if (!user) {
    res.status(404).json({ error: "Teacher not found." });
    return;
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
  res.json({ id: updated.id, status: updated.status });
}

export async function rejectTeacher(req: Request, res: Response) {
  const user = await prisma.user.findFirst({ where: { id: req.params.id as string, role: "TEACHER" } });
  if (!user) {
    res.status(404).json({ error: "Teacher not found." });
    return;
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { status: "REJECTED" } });
  res.json({ id: updated.id, status: updated.status });
}

export async function listTeachersHandler(_req: Request, res: Response) {
  const teachers = await listAllTeachers();
  res.json(teachers);
}

export async function getTeacherDetailHandler(req: Request, res: Response) {
  try {
    const detail = await getTeacherDetail(req.params.id as string);
    res.json(detail);
  } catch (err) {
    if (err instanceof AdminError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

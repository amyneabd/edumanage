import { Router } from "express";
import {
  approveTeacher,
  getTeacherDetailHandler,
  listPendingTeachers,
  listTeachersHandler,
  rejectTeacher,
} from "../controllers/admin.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/teachers/pending", listPendingTeachers);
adminRouter.get("/teachers", listTeachersHandler);
adminRouter.post("/teachers/:id/approve", approveTeacher);
adminRouter.post("/teachers/:id/reject", rejectTeacher);
adminRouter.get("/teachers/:id", getTeacherDetailHandler);

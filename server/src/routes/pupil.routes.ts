import { Router } from "express";
import { requireActive, requireAuth, requireEmailVerified, requireRole } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import {
  attendanceCalendarHandler,
  cancelSwapRequestHandler,
  createSwapRequestHandler,
  gradesHandler,
  home,
  listSwapRequestsHandler,
  otherClassesHandler,
  paymentHistoryHandler,
  posts,
  schedule,
  submitExam,
} from "../controllers/pupil.controller.js";

export const pupilRouter = Router();

pupilRouter.use(requireAuth, requireRole("PUPIL"), requireEmailVerified, requireActive);

pupilRouter.get("/home", home);
pupilRouter.get("/schedule", schedule);
pupilRouter.get("/attendance", attendanceCalendarHandler);
pupilRouter.get("/payments", paymentHistoryHandler);
pupilRouter.get("/grades", gradesHandler);
pupilRouter.get("/posts", posts);
pupilRouter.post("/posts/:postId/submit", upload.single("file"), submitExam);

pupilRouter.get("/classes/other", otherClassesHandler);
pupilRouter.get("/swap-requests", listSwapRequestsHandler);
pupilRouter.post("/swap-requests", createSwapRequestHandler);
pupilRouter.delete("/swap-requests/:id", cancelSwapRequestHandler);

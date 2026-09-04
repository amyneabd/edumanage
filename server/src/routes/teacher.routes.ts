import { Router } from "express";
import { requireActive, requireAuth, requireEmailVerified, requireRole } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import {
  allParentRequestsHandler,
  approveParentRequestHandler,
  approveSwapRequestHandler,
  assignPupilRequest,
  classDetail,
  createClassHandler,
  createPostHandler,
  declineParentRequestHandler,
  declineSwapRequestHandler,
  deletePostHandler,
  deletePupilFromClass,
  gradebookHandler,
  gradeSubmissionHandler,
  ledger,
  ledgerSummary,
  listClasses,
  listPosts,
  overview,
  parentRequestsHandler,
  pupilLedgerHandler,
  pupilPaymentHistoryHandler,
  pupilRequests,
  rejectPupilRequestHandler,
  swapRequestsHandler,
  updateClassFeeHandler,
  updatePayment,
  updatePostHandler,
  updateScheduleHandler,
} from "../controllers/teacher.controller.js";
import {
  getNotifications,
  readAllNotificationsHandler,
  readNotificationHandler,
} from "../controllers/notification.controller.js";
import {
  createGoalHandler,
  deleteGoalHandler,
  getGoals,
  progressGoalHandler,
  toggleGoalHandler,
} from "../controllers/goal.controller.js";
import {
  attendanceCalendarHandler,
  clearAttendanceHandler,
  markAttendanceHandler,
  pupilDetailHandler,
} from "../controllers/attendance.controller.js";
import {
  addVacationSessionHandler,
  currentVacationHandler,
  endVacationHandler,
  listVacationSessionsHandler,
  removeVacationSessionHandler,
  startVacationHandler,
} from "../controllers/vacation.controller.js";

export const teacherRouter = Router();

teacherRouter.use(requireAuth, requireRole("TEACHER"), requireEmailVerified, requireActive);

teacherRouter.get("/overview", overview);

teacherRouter.get("/classes", listClasses);
teacherRouter.post("/classes", createClassHandler);
teacherRouter.get("/classes/:id", classDetail);
teacherRouter.patch("/classes/:id/schedule", updateScheduleHandler);
teacherRouter.patch("/classes/:id/fee", updateClassFeeHandler);
teacherRouter.delete("/classes/:id/pupils/:pupilId", deletePupilFromClass);
teacherRouter.get("/classes/:id/parent-requests", parentRequestsHandler);

teacherRouter.get("/vacation/current", currentVacationHandler);
teacherRouter.post("/vacation/start", startVacationHandler);
teacherRouter.post("/vacation/end", endVacationHandler);
teacherRouter.get("/classes/:id/vacation-sessions", listVacationSessionsHandler);
teacherRouter.post("/classes/:id/vacation-sessions", addVacationSessionHandler);
teacherRouter.delete("/classes/:id/vacation-sessions/:sessionId", removeVacationSessionHandler);

teacherRouter.get("/pupils/:pupilId", pupilDetailHandler);
teacherRouter.get("/pupils/:pupilId/attendance", attendanceCalendarHandler);
teacherRouter.put("/pupils/:pupilId/attendance", markAttendanceHandler);
teacherRouter.delete("/pupils/:pupilId/attendance", clearAttendanceHandler);
teacherRouter.get("/pupils/:pupilId/payments", pupilPaymentHistoryHandler);
teacherRouter.get("/pupils/:pupilId/ledger", pupilLedgerHandler);

teacherRouter.get("/pupil-requests", pupilRequests);
teacherRouter.post("/pupil-requests/:pupilId/assign", assignPupilRequest);
teacherRouter.post("/pupil-requests/:pupilId/reject", rejectPupilRequestHandler);

teacherRouter.get("/ledger", ledger);
teacherRouter.get("/ledger/summary", ledgerSummary);
teacherRouter.patch("/ledger/:pupilId/payment", updatePayment);

teacherRouter.get("/posts", listPosts);
teacherRouter.post("/posts", upload.single("file"), createPostHandler);
teacherRouter.patch("/posts/:id", upload.single("file"), updatePostHandler);
teacherRouter.delete("/posts/:id", deletePostHandler);

teacherRouter.get("/gradebook", gradebookHandler);
teacherRouter.patch("/submissions/:id/grade", gradeSubmissionHandler);

teacherRouter.get("/swap-requests", swapRequestsHandler);
teacherRouter.post("/swap-requests/:id/approve", approveSwapRequestHandler);
teacherRouter.post("/swap-requests/:id/decline", declineSwapRequestHandler);

teacherRouter.get("/parent-requests", allParentRequestsHandler);
teacherRouter.post("/parent-requests/:id/approve", approveParentRequestHandler);
teacherRouter.post("/parent-requests/:id/decline", declineParentRequestHandler);

teacherRouter.get("/notifications", getNotifications);
teacherRouter.post("/notifications/:id/read", readNotificationHandler);
teacherRouter.post("/notifications/read-all", readAllNotificationsHandler);

teacherRouter.get("/goals", getGoals);
teacherRouter.post("/goals", createGoalHandler);
teacherRouter.patch("/goals/:id/progress", progressGoalHandler);
teacherRouter.patch("/goals/:id/toggle", toggleGoalHandler);
teacherRouter.delete("/goals/:id", deleteGoalHandler);

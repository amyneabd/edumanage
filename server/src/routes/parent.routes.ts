import { Router } from "express";
import { requireAuth, requireEmailVerified, requireRole } from "../middleware/auth.middleware.js";
import {
  childAttendanceHandler,
  childGradesHandler,
  childHomeHandler,
  childPaymentsHandler,
  childPostsHandler,
  childScheduleHandler,
  childrenHandler,
  linksHandler,
  requestLinkHandler,
} from "../controllers/parent.controller.js";
import {
  getParentNotifications,
  readAllParentNotificationsHandler,
  readParentNotificationHandler,
} from "../controllers/notification.controller.js";

export const parentRouter = Router();

parentRouter.use(requireAuth, requireRole("PARENT"), requireEmailVerified);

parentRouter.get("/children", childrenHandler);
parentRouter.get("/links", linksHandler);
parentRouter.post("/links", requestLinkHandler);

parentRouter.get("/children/:pupilId/home", childHomeHandler);
parentRouter.get("/children/:pupilId/schedule", childScheduleHandler);
parentRouter.get("/children/:pupilId/attendance", childAttendanceHandler);
parentRouter.get("/children/:pupilId/payments", childPaymentsHandler);
parentRouter.get("/children/:pupilId/grades", childGradesHandler);
parentRouter.get("/children/:pupilId/posts", childPostsHandler);

parentRouter.get("/notifications", getParentNotifications);
parentRouter.post("/notifications/:id/read", readParentNotificationHandler);
parentRouter.post("/notifications/read-all", readAllParentNotificationsHandler);

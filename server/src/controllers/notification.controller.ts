import type { Request, Response } from "express";
import {
  listNotifications,
  listNotificationsForParent,
  markAllNotificationsRead,
  markAllParentNotificationsRead,
  markNotificationRead,
  markParentNotificationRead,
} from "../services/notification.service.js";

export async function getNotifications(req: Request, res: Response) {
  const data = await listNotifications(req.user!.id);
  res.json(data);
}

export async function readNotificationHandler(req: Request, res: Response) {
  await markNotificationRead(req.user!.id, req.params.id as string);
  res.status(204).send();
}

export async function readAllNotificationsHandler(req: Request, res: Response) {
  await markAllNotificationsRead(req.user!.id);
  res.status(204).send();
}

export async function getParentNotifications(req: Request, res: Response) {
  const data = await listNotificationsForParent(req.user!.id);
  res.json(data);
}

export async function readParentNotificationHandler(req: Request, res: Response) {
  await markParentNotificationRead(req.user!.id, req.params.id as string);
  res.status(204).send();
}

export async function readAllParentNotificationsHandler(req: Request, res: Response) {
  await markAllParentNotificationsRead(req.user!.id);
  res.status(204).send();
}

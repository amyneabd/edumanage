import { api } from "./client";
import type {
  AttendanceCalendar,
  NotificationsResponse,
  ParentChild,
  ParentLink,
  PaymentHistoryEntry,
  Post,
  PupilGrades,
  PupilHome,
  ScheduleViewResponse,
} from "./types";

export async function fetchChildren(): Promise<ParentChild[]> {
  const { data } = await api.get("/parent/children");
  return data;
}

export async function fetchOwnLinks(): Promise<ParentLink[]> {
  const { data } = await api.get("/parent/links");
  return data;
}

export async function requestParentLink(parentCode: string) {
  const { data } = await api.post("/parent/links", { parentCode });
  return data;
}

export async function fetchChildHome(pupilId: string): Promise<PupilHome> {
  const { data } = await api.get(`/parent/children/${pupilId}/home`);
  return data;
}

export async function fetchChildSchedule(pupilId: string): Promise<{ className: string } & ScheduleViewResponse> {
  const { data } = await api.get(`/parent/children/${pupilId}/schedule`);
  return data;
}

export async function fetchChildAttendance(pupilId: string, period?: string): Promise<AttendanceCalendar> {
  const { data } = await api.get(`/parent/children/${pupilId}/attendance`, {
    params: period ? { period } : undefined,
  });
  return data;
}

export async function fetchChildPayments(pupilId: string): Promise<PaymentHistoryEntry[]> {
  const { data } = await api.get(`/parent/children/${pupilId}/payments`);
  return data;
}

export async function fetchChildGrades(pupilId: string): Promise<PupilGrades> {
  const { data } = await api.get(`/parent/children/${pupilId}/grades`);
  return data;
}

export async function fetchChildPosts(pupilId: string): Promise<Post[]> {
  const { data } = await api.get(`/parent/children/${pupilId}/posts`);
  return data;
}

export async function fetchParentNotifications(): Promise<NotificationsResponse> {
  const { data } = await api.get("/parent/notifications");
  return data;
}

export async function markParentNotificationRead(id: string) {
  await api.post(`/parent/notifications/${id}/read`);
}

export async function markAllParentNotificationsRead() {
  await api.post("/parent/notifications/read-all");
}

import { api } from "./client";
import type {
  AttendanceCalendar,
  OtherClass,
  PaymentHistoryEntry,
  Post,
  PupilGrades,
  PupilHome,
  PupilVisitRequest,
  ScheduleViewResponse,
} from "./types";

export async function fetchPupilHome(): Promise<PupilHome> {
  const { data } = await api.get("/pupil/home");
  return data;
}

export async function fetchPupilSchedule(): Promise<{ className: string } & ScheduleViewResponse> {
  const { data } = await api.get("/pupil/schedule");
  return data;
}

export async function fetchPupilAttendance(period?: string): Promise<AttendanceCalendar> {
  const { data } = await api.get("/pupil/attendance", { params: period ? { period } : undefined });
  return data;
}

export async function fetchPupilPayments(): Promise<PaymentHistoryEntry[]> {
  const { data } = await api.get("/pupil/payments");
  return data;
}

export async function fetchPupilGrades(): Promise<PupilGrades> {
  const { data } = await api.get("/pupil/grades");
  return data;
}

export async function fetchPupilPosts(): Promise<Post[]> {
  const { data } = await api.get("/pupil/posts");
  return data;
}

export async function submitExam(postId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/pupil/posts/${postId}/submit`, form);
  return data;
}

export async function fetchOtherClasses(): Promise<OtherClass[]> {
  const { data } = await api.get("/pupil/classes/other");
  return data;
}

export async function fetchOwnVisitRequests(): Promise<PupilVisitRequest[]> {
  const { data } = await api.get("/pupil/visit-requests");
  return data;
}

export async function createVisitRequest(input: { classId: string; sessionDate: string; reason?: string }) {
  const { data } = await api.post("/pupil/visit-requests", input);
  return data;
}

export async function cancelVisitRequest(id: string) {
  await api.delete(`/pupil/visit-requests/${id}`);
}

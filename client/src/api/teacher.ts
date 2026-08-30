import { api } from "./client";
import type {
  AttendanceCalendar,
  AttendanceStatus,
  ClassSummary,
  ClassType,
  Goal,
  GoalsResponse,
  Gradebook,
  LedgerRow,
  LedgerSummary,
  NotificationsResponse,
  OverviewData,
  PaymentHistoryEntry,
  PaymentStatus,
  Post,
  PupilDetail,
  PupilRequest,
  ScheduleSlot,
  TeacherParentRequest,
  TeacherVisitRequest,
  VisitRequestStatus,
} from "./types";

export async function fetchOverview(): Promise<OverviewData> {
  const { data } = await api.get("/teacher/overview");
  return data;
}

export async function fetchClasses(): Promise<ClassSummary[]> {
  const { data } = await api.get("/teacher/classes");
  return data;
}

export async function createClass(name: string, type: ClassType, monthlyFee?: number | null): Promise<ClassSummary> {
  const { data } = await api.post("/teacher/classes", { name, type, monthlyFee });
  return data;
}

export async function fetchClassDetail(id: string): Promise<ClassSummary> {
  const { data } = await api.get(`/teacher/classes/${id}`);
  return data;
}

export async function updateSchedule(classId: string, slots: ScheduleSlot[]): Promise<ClassSummary> {
  const { data } = await api.patch(`/teacher/classes/${classId}/schedule`, { slots });
  return data;
}

export async function updateClassFee(classId: string, monthlyFee: number | null): Promise<ClassSummary> {
  const { data } = await api.patch(`/teacher/classes/${classId}/fee`, { monthlyFee });
  return data;
}

export async function deletePupilFromClass(classId: string, pupilId: string) {
  await api.delete(`/teacher/classes/${classId}/pupils/${pupilId}`);
}

export async function fetchParentRequests(classId: string): Promise<TeacherParentRequest[]> {
  const { data } = await api.get(`/teacher/classes/${classId}/parent-requests`);
  return data;
}

export async function fetchAllParentRequests(): Promise<TeacherParentRequest[]> {
  const { data } = await api.get("/teacher/parent-requests");
  return data;
}

export async function approveParentRequest(id: string) {
  const { data } = await api.post(`/teacher/parent-requests/${id}/approve`);
  return data;
}

export async function declineParentRequest(id: string) {
  const { data } = await api.post(`/teacher/parent-requests/${id}/decline`);
  return data;
}

export async function fetchPupilDetail(pupilId: string): Promise<PupilDetail> {
  const { data } = await api.get(`/teacher/pupils/${pupilId}`);
  return data;
}

export async function fetchAttendanceCalendar(pupilId: string, period?: string): Promise<AttendanceCalendar> {
  const { data } = await api.get(`/teacher/pupils/${pupilId}/attendance`, { params: period ? { period } : undefined });
  return data;
}

export async function markAttendance(pupilId: string, date: string, status: AttendanceStatus) {
  const { data } = await api.put(`/teacher/pupils/${pupilId}/attendance`, { date, status });
  return data;
}

export async function clearAttendance(pupilId: string, date: string) {
  await api.delete(`/teacher/pupils/${pupilId}/attendance`, { params: { date } });
}

export async function fetchPupilRequests(): Promise<PupilRequest[]> {
  const { data } = await api.get("/teacher/pupil-requests");
  return data;
}

export async function assignPupilRequest(pupilId: string, classId: string) {
  await api.post(`/teacher/pupil-requests/${pupilId}/assign`, { classId });
}

export async function rejectPupilRequest(pupilId: string) {
  await api.post(`/teacher/pupil-requests/${pupilId}/reject`);
}

export async function fetchLedger(filters: {
  search?: string;
  status?: PaymentStatus;
  classId?: string;
  period?: string;
}): Promise<LedgerRow[]> {
  const { data } = await api.get("/teacher/ledger", { params: filters });
  return data;
}

export async function fetchLedgerSummary(period?: string): Promise<LedgerSummary> {
  const { data } = await api.get("/teacher/ledger/summary", { params: period ? { period } : undefined });
  return data;
}

export async function updatePaymentStatus(
  pupilId: string,
  input: {
    status?: PaymentStatus;
    period?: string;
    dueDate?: string | null;
    amountDue?: number | null;
    amountPaid?: number;
  }
) {
  const { data } = await api.patch(`/teacher/ledger/${pupilId}/payment`, input);
  return data;
}

export async function fetchPupilPayments(pupilId: string): Promise<PaymentHistoryEntry[]> {
  const { data } = await api.get(`/teacher/pupils/${pupilId}/payments`);
  return data;
}

export async function fetchPosts(classId: string): Promise<Post[]> {
  const { data } = await api.get("/teacher/posts", { params: { classId } });
  return data;
}

export async function createPost(input: {
  classId: string;
  type: "TEXT" | "FILE" | "EXAM";
  content?: string;
  dueDate?: string;
  maxGrade?: number | null;
  file?: File | null;
}): Promise<Post> {
  const form = new FormData();
  form.append("classId", input.classId);
  form.append("type", input.type);
  if (input.content) form.append("content", input.content);
  if (input.dueDate) form.append("dueDate", input.dueDate);
  if (input.maxGrade !== undefined && input.maxGrade !== null) form.append("maxGrade", String(input.maxGrade));
  if (input.file) form.append("file", input.file);
  const { data } = await api.post("/teacher/posts", form);
  return data;
}

export async function updatePost(
  id: string,
  input: { content?: string; dueDate?: string | null; maxGrade?: number | null; file?: File | null }
): Promise<Post> {
  const form = new FormData();
  if (input.content !== undefined) form.append("content", input.content);
  if (input.dueDate !== undefined) form.append("dueDate", input.dueDate ?? "");
  if (input.maxGrade !== undefined) form.append("maxGrade", input.maxGrade === null ? "" : String(input.maxGrade));
  if (input.file) form.append("file", input.file);
  const { data } = await api.patch(`/teacher/posts/${id}`, form);
  return data;
}

export async function deletePost(id: string) {
  await api.delete(`/teacher/posts/${id}`);
}

export async function gradeSubmission(
  submissionId: string,
  input: { grade: number | null; feedback?: string | null }
) {
  const { data } = await api.patch(`/teacher/submissions/${submissionId}/grade`, input);
  return data;
}

export async function fetchGradebook(classId: string): Promise<Gradebook> {
  const { data } = await api.get("/teacher/gradebook", { params: { classId } });
  return data;
}

export async function fetchVisitRequests(status?: VisitRequestStatus): Promise<TeacherVisitRequest[]> {
  const { data } = await api.get("/teacher/visit-requests", { params: status ? { status } : undefined });
  return data;
}

export async function approveVisitRequest(id: string) {
  const { data } = await api.post(`/teacher/visit-requests/${id}/approve`);
  return data;
}

export async function declineVisitRequest(id: string) {
  const { data } = await api.post(`/teacher/visit-requests/${id}/decline`);
  return data;
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  const { data } = await api.get("/teacher/notifications");
  return data;
}

export async function markNotificationRead(id: string) {
  await api.post(`/teacher/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.post("/teacher/notifications/read-all");
}

export async function fetchGoals(period?: string): Promise<GoalsResponse> {
  const { data } = await api.get("/teacher/goals", { params: period ? { period } : undefined });
  return data;
}

export async function createGoal(title: string, targetCount?: number): Promise<Goal> {
  const { data } = await api.post("/teacher/goals", { title, targetCount });
  return data;
}

export async function adjustGoalProgress(id: string, delta: number): Promise<Goal> {
  const { data } = await api.patch(`/teacher/goals/${id}/progress`, { delta });
  return data;
}

export async function toggleGoal(id: string): Promise<Goal> {
  const { data } = await api.patch(`/teacher/goals/${id}/toggle`);
  return data;
}

export async function deleteGoal(id: string) {
  await api.delete(`/teacher/goals/${id}`);
}

import { api } from "./client";
import type { AdminTeacherDetail, AdminTeacherSummary, PendingTeacher } from "./types";

export async function fetchPendingTeachers(): Promise<PendingTeacher[]> {
  const { data } = await api.get("/admin/teachers/pending");
  return data;
}

export async function fetchAllTeachers(): Promise<AdminTeacherSummary[]> {
  const { data } = await api.get("/admin/teachers");
  return data;
}

export async function fetchTeacherDetail(id: string): Promise<AdminTeacherDetail> {
  const { data } = await api.get(`/admin/teachers/${id}`);
  return data;
}

export async function approveTeacher(id: string) {
  const { data } = await api.post(`/admin/teachers/${id}/approve`);
  return data;
}

export async function rejectTeacher(id: string) {
  const { data } = await api.post(`/admin/teachers/${id}/reject`);
  return data;
}

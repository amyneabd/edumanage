import { api } from "./client";
import type { Me, ClassType } from "./types";

export interface TeacherRegisterInput {
  role: "TEACHER";
  name: string;
  email: string;
  password: string;
}

export interface PupilRegisterInput {
  role: "PUPIL";
  name: string;
  email: string;
  password: string;
  requestedType: ClassType;
  teacherCode: string;
  phone: string;
  parentPhone: string;
}

export interface ParentRegisterInput {
  role: "PARENT";
  name: string;
  email: string;
  password: string;
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>("/auth/me");
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function register(input: TeacherRegisterInput | PupilRegisterInput | ParentRegisterInput) {
  const { data } = await api.post<{ id: string; role: string; status: string; name: string; devVerifyUrl?: string }>(
    "/auth/register",
    input,
  );
  return data;
}

export async function logout() {
  await api.post("/auth/logout");
}

export async function forgotPassword(email: string) {
  const { data } = await api.post<{ message: string; devResetUrl?: string }>("/auth/forgot-password", { email });
  return data;
}

export async function resetPassword(token: string, password: string) {
  await api.post("/auth/reset-password", { token, password });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await api.post("/auth/change-password", { currentPassword, newPassword });
}

export async function verifyEmail(token: string) {
  await api.post("/auth/verify-email", { token });
}

export async function resendVerification() {
  const { data } = await api.post<{ message: string; devVerifyUrl?: string }>("/auth/resend-verification");
  return data;
}

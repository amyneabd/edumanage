import { prisma } from "../utils/prisma.js";
import { supabaseAuth, createAuthClient } from "../utils/supabaseAuth.js";
import { generateTeacherCode, generateParentCode } from "../utils/teacherCode.js";
import { createNotification } from "./notification.service.js";
import { env } from "../utils/env.js";
import type { ClassType, User } from "@prisma/client";
import type { Session } from "@supabase/supabase-js";

const CLASS_TYPE_LABELS_LOWER: Record<ClassType, string> = {
  SCIENCE: "sciences",
  MATH: "mathématiques",
  INFO: "informatique",
  ECO: "économie",
};

export class AuthError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
  }
}

async function createSupabaseUser(email: string, password: string): Promise<string> {
  const { data, error } = await supabaseAuth.auth.signUp({ email, password });
  if (error) {
    if (error.status === 422 || /already registered/i.test(error.message)) {
      throw new AuthError("Un compte avec cet e-mail existe déjà.", 409);
    }
    throw new AuthError(error.message, 400);
  }
  return data.user!.id;
}

export async function registerTeacher(input: { email: string; password: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("Un compte avec cet e-mail existe déjà.", 409);
  const supabaseId = await createSupabaseUser(input.email, input.password);
  let teacherCode = generateTeacherCode();
  while (await prisma.teacherProfile.findUnique({ where: { teacherCode } })) {
    teacherCode = generateTeacherCode();
  }
  const user = await prisma.user.create({
    data: {
      email: input.email,
      supabaseId,
      name: input.name,
      role: "TEACHER",
      status: "PENDING",
      teacherProfile: { create: { teacherCode } },
    },
    include: { teacherProfile: true },
  });
  return user;
}

export async function registerPupil(input: {
  email: string;
  password: string;
  name: string;
  requestedType: ClassType;
  teacherCode: string;
  phone: string;
  parentPhone: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("Un compte avec cet e-mail existe déjà.", 409);
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { teacherCode: input.teacherCode.toUpperCase() },
    include: { user: true },
  });
  if (!teacherProfile || teacherProfile.user.status !== "ACTIVE") {
    throw new AuthError("Aucun enseignant actif trouvé avec cet identifiant enseignant.", 404);
  }
  const supabaseId = await createSupabaseUser(input.email, input.password);
  let parentCode = generateParentCode();
  while (await prisma.pupilProfile.findUnique({ where: { parentCode } })) {
    parentCode = generateParentCode();
  }
  const user = await prisma.user.create({
    data: {
      email: input.email,
      supabaseId,
      name: input.name,
      role: "PUPIL",
      status: "PENDING",
      pupilProfile: {
        create: {
          requestedType: input.requestedType,
          teacherId: teacherProfile.userId,
          parentCode,
          phone: input.phone,
          parentPhone: input.parentPhone,
        },
      },
    },
    include: { pupilProfile: true },
  });
  await createNotification({
    teacherId: teacherProfile.userId,
    type: "PUPIL_REQUEST",
    title: "Nouvelle demande d'élève",
    body: `${user.name} demande à rejoindre vos classes de ${CLASS_TYPE_LABELS_LOWER[input.requestedType]}.`,
    link: "/teacher/classes",
    dedupeKey: `pupil-request:${user.id}`,
  });
  return user;
}

export async function registerParent(input: { email: string; password: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("Un compte avec cet e-mail existe déjà.", 409);
  const supabaseId = await createSupabaseUser(input.email, input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      supabaseId,
      name: input.name,
      role: "PARENT",
      status: "ACTIVE",
      parentProfile: { create: {} },
    },
    include: { parentProfile: true },
  });
  return user;
}

export interface LoginResult {
  user: User;
  session: Session;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      throw new AuthError("Veuillez vérifier votre e-mail avant de vous connecter.", 403, "EMAIL_NOT_CONFIRMED");
    }
    throw new AuthError("E-mail ou mot de passe invalide.", 401);
  }
  const user = await prisma.user.findUnique({ where: { supabaseId: data.user.id } });
  if (!user) throw new AuthError("E-mail ou mot de passe invalide.", 401);
  return { user, session: data.session };
}

export async function resendVerification(email: string): Promise<void> {
  const { error } = await supabaseAuth.auth.resend({ type: "signup", email });
  if (error) throw new AuthError(error.message, 400);
}

export interface VerifiedSession {
  user: User;
  session: Session;
}

export async function verifyEmail(tokenHash: string): Promise<VerifiedSession> {
  const { data, error } = await supabaseAuth.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });
  if (error || !data.session) throw new AuthError("Ce lien de vérification est invalide ou a expiré.", 400);
  const user = await prisma.user.findUnique({ where: { supabaseId: data.session.user.id } });
  if (!user) throw new AuthError("Utilisateur introuvable.", 404);
  return { user, session: data.session };
}

export async function requestPasswordReset(email: string): Promise<void> {
  await supabaseAuth.auth.resetPasswordForEmail(email, { redirectTo: `${env.clientOrigin}/reset-password` });
}

// Uses a freshly-constructed client (not the shared singleton) so a
// concurrent request's session can't get mixed up with this one between
// verifyOtp and updateUser.
export async function completePasswordReset(tokenHash: string, newPassword: string): Promise<Session> {
  const scoped = createAuthClient();
  const { data, error } = await scoped.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
  if (error || !data.session) throw new AuthError("Ce lien de réinitialisation est invalide ou a expiré.", 400);
  const { error: updateError } = await scoped.auth.updateUser({ password: newPassword });
  if (updateError) throw new AuthError(updateError.message, 400);
  return data.session;
}

export async function logout(accessToken: string | undefined, refreshToken: string | undefined): Promise<void> {
  if (!accessToken || !refreshToken) return;
  const scoped = createAuthClient();
  await scoped.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  await scoped.auth.signOut();
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError("Utilisateur introuvable.", 404);
  const scoped = createAuthClient();
  const { error: signInError } = await scoped.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (signInError) throw new AuthError("Le mot de passe actuel est incorrect.", 400);
  const { error } = await scoped.auth.updateUser({ password: newPassword });
  if (error) throw new AuthError(error.message, 400);
}

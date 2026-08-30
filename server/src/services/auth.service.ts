import crypto from "node:crypto";
import { prisma } from "../utils/prisma.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateTeacherCode, generateParentCode } from "../utils/teacherCode.js";
import { createNotification } from "./notification.service.js";
import type { ClassType, User } from "@prisma/client";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashVerificationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class AuthError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function registerTeacher(input: { email: string; password: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("An account with this email already exists.", 409);

  const passwordHash = await hashPassword(input.password);

  let teacherCode = generateTeacherCode();
  while (await prisma.teacherProfile.findUnique({ where: { teacherCode } })) {
    teacherCode = generateTeacherCode();
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
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
  if (existing) throw new AuthError("An account with this email already exists.", 409);

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { teacherCode: input.teacherCode.toUpperCase() },
    include: { user: true },
  });
  if (!teacherProfile || teacherProfile.user.status !== "ACTIVE") {
    throw new AuthError("No active teacher found with that Teacher ID.", 404);
  }

  const passwordHash = await hashPassword(input.password);

  let parentCode = generateParentCode();
  while (await prisma.pupilProfile.findUnique({ where: { parentCode } })) {
    parentCode = generateParentCode();
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
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
    title: "New pupil request",
    body: `${user.name} requested to join your ${input.requestedType.toLowerCase()} classes.`,
    link: "/teacher/classes",
    dedupeKey: `pupil-request:${user.id}`,
  });

  return user;
}

export async function registerParent(input: { email: string; password: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("An account with this email already exists.", 409);

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: "PARENT",
      status: "ACTIVE",
      parentProfile: { create: {} },
    },
    include: { parentProfile: true },
  });

  return user;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AuthError("Invalid email or password.", 401);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new AuthError("Invalid email or password.", 401);

  return user;
}

/**
 * Issues a password reset token for the given email, if an account with
 * that email exists. Callers must respond identically whether or not a
 * user was found, to avoid leaking which emails are registered.
 */
export async function requestPasswordReset(email: string): Promise<{ token: string; user: User } | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  // Invalidate any previously issued, still-outstanding tokens for this user.
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  return { token: rawToken, user };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AuthError("This reset link is invalid or has expired.", 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}

/** Issues a fresh email verification token for a user, invalidating any previously issued ones. */
export async function issueEmailVerificationToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await prisma.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });

  return rawToken;
}

export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = hashVerificationToken(token);
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AuthError("This verification link is invalid or has expired.", 400);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}

/** Re-issues a verification token for the given user, unless they're already verified. */
export async function resendVerificationEmail(userId: string): Promise<{ token: string; email: string } | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerifiedAt) return null;

  const token = await issueEmailVerificationToken(userId);
  return { token, email: user.email };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AuthError("User not found.", 404);

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new AuthError("Current password is incorrect.", 400);

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

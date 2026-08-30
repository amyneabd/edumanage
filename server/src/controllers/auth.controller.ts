import type { Request, Response } from "express";
import { z } from "zod";
import {
  AuthError,
  changePassword,
  issueEmailVerificationToken,
  login,
  registerParent,
  registerPupil,
  registerTeacher,
  requestPasswordReset,
  resendVerificationEmail,
  resetPassword,
  verifyEmail,
} from "../services/auth.service.js";
import { signToken } from "../utils/jwt.js";
import { prisma } from "../utils/prisma.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/mailer.js";
import { env } from "../utils/env.js";

const COOKIE_NAME = "token";
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const teacherSchema = z.object({
  role: z.literal("TEACHER"),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const pupilSchema = z.object({
  role: z.literal("PUPIL"),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  requestedType: z.enum(["SCIENCE", "MATH", "INFO", "ECO"]),
  teacherCode: z.string().min(4),
  phone: z.string().min(6),
  parentPhone: z.string().min(6),
});

const parentSchema = z.object({
  role: z.literal("PARENT"),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.discriminatedUnion("role", [teacherSchema, pupilSchema, parentSchema]);

/**
 * Fires off a mail-sending call without awaiting it. Auth flows must never
 * let a slow or unreachable SMTP relay stall (or fail) an HTTP response for
 * work that has already succeeded (account creation, token issuance) —
 * mirrors the existing best-effort pattern used by sendParentAlertEmail.
 * Failures are logged so they're still visible in server logs.
 */
function sendMailBestEffort(promise: Promise<{ delivered: boolean }>, context: string): void {
  promise.catch((err) => {
    console.error(`[mailer] failed to send ${context}:`, err);
  });
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }

  try {
    const user =
      parsed.data.role === "TEACHER"
        ? await registerTeacher(parsed.data)
        : parsed.data.role === "PARENT"
          ? await registerParent(parsed.data)
          : await registerPupil(parsed.data);

    const verificationToken = await issueEmailVerificationToken(user.id);
    const verifyUrl = `${env.clientOrigin}/verify-email?token=${verificationToken}`;
    sendMailBestEffort(sendVerificationEmail(user.email, verifyUrl), `verification email to ${user.email}`);

    const token = signToken({ userId: user.id, role: user.role });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.status(201).json({
      id: user.id,
      role: user.role,
      status: user.status,
      name: user.name,
      // Dev convenience only: surface the link when there's no SMTP to deliver it.
      devVerifyUrl: !env.smtp && !env.isProduction ? verifyUrl : undefined,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  try {
    const user = await login(parsed.data.email, parsed.data.password);
    const token = signToken({ userId: user.id, role: user.role });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({ id: user.id, role: user.role, status: user.status, name: user.name });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.status(204).send();
}

const GENERIC_RESET_MESSAGE = "If that email exists, we've sent a link to reset your password.";

const forgotPasswordSchema = z.object({ email: z.string().email() });

export async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const result = await requestPasswordReset(parsed.data.email);

  if (result) {
    const resetUrl = `${env.clientOrigin}/reset-password?token=${result.token}`;
    sendMailBestEffort(sendPasswordResetEmail(result.user.email, resetUrl), `password reset email to ${result.user.email}`);

    // Dev convenience only: when there's no SMTP to actually deliver the
    // email, surface the link in the response so local testing doesn't
    // require reading server logs. Never done in production.
    if (!env.smtp && !env.isProduction) {
      res.json({ message: GENERIC_RESET_MESSAGE, devResetUrl: resetUrl });
      return;
    }
  }

  // Identical response whether or not the account exists, so this endpoint
  // can't be used to enumerate registered emails.
  res.json({ message: GENERIC_RESET_MESSAGE });
}

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

export async function resetPasswordHandler(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.password);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

const verifyEmailSchema = z.object({ token: z.string().min(10) });

export async function verifyEmailHandler(req: Request, res: Response) {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  try {
    await verifyEmail(parsed.data.token);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

export async function resendVerificationHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const result = await resendVerificationEmail(req.user.id);
  if (result) {
    const verifyUrl = `${env.clientOrigin}/verify-email?token=${result.token}`;
    sendMailBestEffort(sendVerificationEmail(result.email, verifyUrl), `verification email to ${result.email}`);
    if (!env.smtp && !env.isProduction) {
      res.json({ message: "Verification email sent.", devVerifyUrl: verifyUrl });
      return;
    }
  }

  res.json({ message: "Verification email sent." });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function changePasswordHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  try {
    await changePassword(req.user.id, parsed.data.currentPassword, parsed.data.newPassword);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const teacherProfile =
    req.user.role === "TEACHER"
      ? await prisma.teacherProfile.findUnique({ where: { userId: req.user.id } })
      : null;

  const pupilProfile =
    req.user.role === "PUPIL"
      ? await prisma.pupilProfile.findUnique({ where: { userId: req.user.id } })
      : null;

  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    status: req.user.status,
    emailVerified: Boolean(req.user.emailVerifiedAt),
    teacherCode: teacherProfile?.teacherCode ?? null,
    parentCode: pupilProfile?.parentCode ?? null,
  });
}

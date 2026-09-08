import type { Request, Response } from "express";
import { z } from "zod";
import {
  AuthError,
  changePassword,
  completePasswordReset,
  login,
  logout as logoutService,
  registerParent,
  registerPupil,
  registerTeacher,
  requestPasswordReset,
  resendVerification,
  verifyEmail,
} from "../services/auth.service.js";
import { prisma } from "../utils/prisma.js";
import { clearAuthCookies, getAuthCookies, setAuthCookies } from "../utils/authCookies.js";

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

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide", details: parsed.error.flatten() });
    return;
  }
  try {
    const user =
      parsed.data.role === "TEACHER"
        ? await registerTeacher(parsed.data)
        : parsed.data.role === "PARENT"
          ? await registerParent(parsed.data)
          : await registerPupil(parsed.data);
    res.status(201).json({ id: user.id, role: user.role, status: user.status, name: user.name });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  try {
    const { user, session } = await login(parsed.data.email, parsed.data.password);
    setAuthCookies(res, session);
    res.json({ id: user.id, role: user.role, status: user.status, name: user.name });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  const { accessToken, refreshToken } = getAuthCookies(req);
  try {
    await logoutService(accessToken, refreshToken);
  } catch {
    // best-effort revoke
  }
  clearAuthCookies(res);
  res.status(204).send();
}

const GENERIC_RESET_MESSAGE = "Si cet e-mail existe, nous avons envoyé un lien pour réinitialiser votre mot de passe.";
const forgotPasswordSchema = z.object({ email: z.string().email() });

export async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  await requestPasswordReset(parsed.data.email);
  res.json({ message: GENERIC_RESET_MESSAGE });
}

const resetPasswordSchema = z.object({ token_hash: z.string().min(10), password: z.string().min(6) });

export async function resetPasswordHandler(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  try {
    const session = await completePasswordReset(parsed.data.token_hash, parsed.data.password);
    setAuthCookies(res, session);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

const verifyEmailSchema = z.object({ token_hash: z.string().min(10) });

export async function verifyEmailHandler(req: Request, res: Response) {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  try {
    const { session } = await verifyEmail(parsed.data.token_hash);
    setAuthCookies(res, session);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

const resendVerificationSchema = z.object({ email: z.string().email() });

export async function resendVerificationHandler(req: Request, res: Response) {
  const parsed = resendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  await resendVerification(parsed.data.email);
  res.json({ message: "E-mail de vérification envoyé." });
}

const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) });

export async function changePasswordHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Entrée invalide" });
    return;
  }
  try {
    await changePassword(req.user.id, parsed.data.currentPassword, parsed.data.newPassword);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
}

export async function me(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const teacherProfile =
    req.user.role === "TEACHER" ? await prisma.teacherProfile.findUnique({ where: { userId: req.user.id } }) : null;
  const pupilProfile =
    req.user.role === "PUPIL" ? await prisma.pupilProfile.findUnique({ where: { userId: req.user.id } }) : null;
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    status: req.user.status,
    teacherCode: teacherProfile?.teacherCode ?? null,
    parentCode: pupilProfile?.parentCode ?? null,
  });
}

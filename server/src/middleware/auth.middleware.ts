import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../utils/prisma.js";
import { env } from "../utils/env.js";
import type { Role, UserStatus } from "@prisma/client";

export interface AuthedUser {
  id: string;
  role: Role;
  status: UserStatus;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }
    req.user = {
      id: user.id,
      role: user.role,
      status: user.status,
      name: user.name,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
    };
    next();
  } catch {
    res.status(401).json({ error: "Session invalide ou expirée" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Accès interdit" });
      return;
    }
    next();
  };
}

export function requireActive(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.status !== "ACTIVE") {
    res.status(403).json({ error: "Le compte n'est pas actif", status: req.user?.status });
    return;
  }
  next();
}

export function requireEmailVerified(req: Request, res: Response, next: NextFunction) {
  if (!env.requireEmailVerification) {
    next();
    return;
  }
  if (!req.user || !req.user.emailVerifiedAt) {
    res.status(403).json({ error: "L'adresse e-mail n'est pas vérifiée" });
    return;
  }
  next();
}

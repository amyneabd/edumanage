import type { NextFunction, Request, Response } from "express";
import { supabaseAuth } from "../utils/supabaseAuth.js";
import { prisma } from "../utils/prisma.js";
import { getAuthCookies, setAuthCookies, clearAuthCookies } from "../utils/authCookies.js";
import type { Role, UserStatus } from "@prisma/client";

export interface AuthedUser {
  id: string;
  role: Role;
  status: UserStatus;
  name: string;
  email: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

async function loadAuthedUser(supabaseUserId: string): Promise<AuthedUser | null> {
  const user = await prisma.user.findUnique({ where: { supabaseId: supabaseUserId } });
  if (!user) return null;
  return { id: user.id, role: user.role, status: user.status, name: user.name, email: user.email };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { accessToken, refreshToken } = getAuthCookies(req);
  if (!accessToken) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { data, error } = await supabaseAuth.auth.getUser(accessToken);
  if (!error && data.user) {
    const authedUser = await loadAuthedUser(data.user.id);
    if (!authedUser) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }
    req.user = authedUser;
    next();
    return;
  }

  if (!refreshToken) {
    res.status(401).json({ error: "Session invalide ou expirée" });
    return;
  }

  const { data: refreshed, error: refreshError } = await supabaseAuth.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (refreshError || !refreshed.session) {
    clearAuthCookies(res);
    res.status(401).json({ error: "Session invalide ou expirée" });
    return;
  }

  const authedUser = await loadAuthedUser(refreshed.session.user.id);
  if (!authedUser) {
    clearAuthCookies(res);
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  setAuthCookies(res, refreshed.session);
  req.user = authedUser;
  next();
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

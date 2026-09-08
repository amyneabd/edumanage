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

  // The access-token cookie expires after 1 hour (its Max-Age tracks the
  // Supabase session's expires_in) while the refresh-token cookie lives for
  // 30 days. So once an hour has passed since login — including the very
  // common case of closing the browser/tab and reopening it later — the
  // browser has already dropped the access-token cookie but still holds the
  // refresh-token cookie. That must fall through to the refresh flow below
  // instead of failing fast, otherwise every session silently expires after
  // an hour even though the refresh token is still valid.
  if (accessToken) {
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

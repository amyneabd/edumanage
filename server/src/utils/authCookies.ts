import type { Response } from "express";
import type { Session } from "@supabase/supabase-js";

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export function setAuthCookies(
  res: Response,
  session: Pick<Session, "access_token" | "refresh_token" | "expires_in">
): void {
  res.cookie(ACCESS_COOKIE, session.access_token, {
    ...baseCookieOptions,
    maxAge: session.expires_in * 1000,
  });
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    ...baseCookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions);
}

export function getAuthCookies(req: {
  cookies?: Record<string, string>;
}): { accessToken?: string; refreshToken?: string } {
  return {
    accessToken: req.cookies?.[ACCESS_COOKIE],
    refreshToken: req.cookies?.[REFRESH_COOKIE],
  };
}

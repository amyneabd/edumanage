import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { getUserMock, refreshSessionMock, findUniqueMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  refreshSessionMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock("../utils/supabaseAuth.js", () => ({
  supabaseAuth: { auth: { getUser: getUserMock, refreshSession: refreshSessionMock } },
}));

vi.mock("../utils/prisma.js", () => ({
  prisma: { user: { findUnique: findUniqueMock } },
}));

import { requireAuth, requireActive, requireRole } from "./auth.middleware.js";

const DB_USER = {
  id: "user-1",
  email: "teacher@example.com",
  name: "Teacher One",
  role: "TEACHER",
  status: "ACTIVE",
};

function makeReq(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

function makeRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAuth", () => {
  it("returns 401 when there is no access-token cookie", async () => {
    const req = makeReq();
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("authenticates and calls next when the access token is valid", async () => {
    const req = makeReq({ "sb-access-token": "at" });
    const res = makeRes();
    const next = vi.fn();
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "sb-user-1" } }, error: null });
    findUniqueMock.mockResolvedValueOnce(DB_USER);

    await requireAuth(req, res, next);

    expect(req.user).toEqual(DB_USER);
    expect(next).toHaveBeenCalled();
  });

  it("refreshes the session when the access token is expired but the refresh token is valid", async () => {
    const req = makeReq({ "sb-access-token": "expired", "sb-refresh-token": "rt" });
    const res = makeRes();
    const next = vi.fn();
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } });
    refreshSessionMock.mockResolvedValueOnce({
      data: { session: { access_token: "new-at", refresh_token: "new-rt", expires_in: 3600, user: { id: "sb-user-1" } } },
      error: null,
    });
    findUniqueMock.mockResolvedValueOnce(DB_USER);

    await requireAuth(req, res, next);

    expect(res.cookie).toHaveBeenCalled();
    expect(req.user).toEqual(DB_USER);
    expect(next).toHaveBeenCalled();
  });

  it("clears cookies and returns 401 when both tokens are invalid", async () => {
    const req = makeReq({ "sb-access-token": "expired", "sb-refresh-token": "expired" });
    const res = makeRes();
    const next = vi.fn();
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } });
    refreshSessionMock.mockResolvedValueOnce({ data: { session: null }, error: { message: "invalid" } });

    await requireAuth(req, res, next);

    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when the token is valid but no matching Prisma user exists", async () => {
    const req = makeReq({ "sb-access-token": "at" });
    const res = makeRes();
    const next = vi.fn();
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "sb-orphan" } }, error: null });
    findUniqueMock.mockResolvedValueOnce(null);

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireRole", () => {
  it("calls next when the user's role is allowed", () => {
    const req = { user: DB_USER } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireRole("TEACHER")(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when the user's role is not allowed", () => {
    const req = { user: DB_USER } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireRole("PARENT")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireActive", () => {
  it("calls next when the user's status is ACTIVE", () => {
    const req = { user: DB_USER } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireActive(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when the user's status is not ACTIVE", () => {
    const req = { user: { ...DB_USER, status: "PENDING" } } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireActive(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

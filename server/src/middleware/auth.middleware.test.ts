import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

function makeReq(emailVerifiedAt: Date | null): Request {
  return { user: { id: "u1", role: "PUPIL", status: "ACTIVE", name: "A", email: "a@test.com", emailVerifiedAt } } as unknown as Request;
}

function makeRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("requireEmailVerified", () => {
  it("blocks an unverified user when verification is required", async () => {
    vi.resetModules();
    vi.doMock("../utils/env.js", () => ({ env: { requireEmailVerification: true } }));
    const { requireEmailVerified } = await import("./auth.middleware.js");

    const req = makeReq(null);
    const res = makeRes();
    const next = vi.fn();

    requireEmailVerified(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a verified user through when verification is required", async () => {
    vi.resetModules();
    vi.doMock("../utils/env.js", () => ({ env: { requireEmailVerification: true } }));
    const { requireEmailVerified } = await import("./auth.middleware.js");

    const req = makeReq(new Date());
    const res = makeRes();
    const next = vi.fn();

    requireEmailVerified(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows an unverified user through when verification is not required", async () => {
    vi.resetModules();
    vi.doMock("../utils/env.js", () => ({ env: { requireEmailVerification: false } }));
    const { requireEmailVerified } = await import("./auth.middleware.js");

    const req = makeReq(null);
    const res = makeRes();
    const next = vi.fn();

    requireEmailVerified(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

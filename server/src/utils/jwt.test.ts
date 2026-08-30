import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { signToken, verifyToken, type AuthTokenPayload } from "./jwt.js";
import { env } from "./env.js";

describe("jwt sign/verify", () => {
  it("round-trips a payload through sign then verify", () => {
    const payload: AuthTokenPayload = { userId: "user_123", role: "TEACHER" };
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(payload.role);
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ userId: "attacker", role: "ADMIN" }, "wrong-secret", { expiresIn: "7d" });
    expect(() => verifyToken(forged)).toThrow();
  });

  it("rejects a tampered token", () => {
    const token = signToken({ userId: "user_123", role: "PUPIL" });
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(() => verifyToken(tampered)).toThrow();
  });

  it("rejects an already-expired token", () => {
    const expired = jwt.sign({ userId: "user_123", role: "PUPIL" }, env.jwtSecret, { expiresIn: -10 });
    expect(() => verifyToken(expired)).toThrow();
  });
});

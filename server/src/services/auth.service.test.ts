import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../utils/prisma.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { AuthError, changePassword, requestPasswordReset, resetPassword } from "./auth.service.js";

// These tests run against the real dev SQLite database (there is no separate
// test DB configured). They use a unique, clearly-tagged email and clean up
// via a cascading `user.delete` in `afterAll`, which is safe because every
// child table (ParentProfile, PasswordResetToken, etc.) declares
// `onDelete: Cascade` on its User-referencing foreign key.
const TEST_EMAIL = `test-auth-service-${Date.now()}@example.com`;
let userId: string;

beforeAll(async () => {
  const passwordHash = await hashPassword("initial-Pass1");
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      name: "Auth Service Test User",
      role: "PARENT",
      status: "ACTIVE",
      parentProfile: { create: {} },
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("changePassword", () => {
  it("rejects an incorrect current password", async () => {
    await expect(changePassword(userId, "wrong-password", "New-Pass2")).rejects.toThrow(AuthError);
  });

  it("updates the password hash when the current password is correct", async () => {
    await changePassword(userId, "initial-Pass1", "New-Pass2");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await expect(verifyPassword("New-Pass2", user.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("initial-Pass1", user.passwordHash)).resolves.toBe(false);
  });

  it("throws for a user id that does not exist", async () => {
    await expect(changePassword("does-not-exist", "whatever", "New-Pass3")).rejects.toThrow(AuthError);
  });
});

describe("requestPasswordReset / resetPassword", () => {
  it("returns null for an email with no account, without revealing that", async () => {
    const result = await requestPasswordReset("no-such-account-xyz@example.com");
    expect(result).toBeNull();
  });

  it("issues a token that resets the password, and cannot be replayed", async () => {
    const issued = await requestPasswordReset(TEST_EMAIL);
    expect(issued).not.toBeNull();
    const { token } = issued!;

    await resetPassword(token, "Reset-Pass9");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await expect(verifyPassword("Reset-Pass9", user.passwordHash)).resolves.toBe(true);

    // Using the same token again must fail (single-use).
    await expect(resetPassword(token, "Another-Pass1")).rejects.toThrow(AuthError);
  });

  it("rejects an unknown/garbage token", async () => {
    await expect(resetPassword("not-a-real-token", "Whatever-Pass1")).rejects.toThrow(AuthError);
  });

  it("invalidates a previously issued token once a new one is requested", async () => {
    const first = await requestPasswordReset(TEST_EMAIL);
    const second = await requestPasswordReset(TEST_EMAIL);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    // The first token was superseded and deleted, so it must fail even though it hasn't expired.
    await expect(resetPassword(first!.token, "Whatever-Pass2")).rejects.toThrow(AuthError);

    // The latest token should still work.
    await resetPassword(second!.token, "Whatever-Pass2");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await expect(verifyPassword("Whatever-Pass2", user.passwordHash)).resolves.toBe(true);
  });

  it("rejects an expired token", async () => {
    const issued = await requestPasswordReset(TEST_EMAIL);
    await prisma.passwordResetToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(resetPassword(issued!.token, "Expired-Pass1")).rejects.toThrow(AuthError);
  });
});

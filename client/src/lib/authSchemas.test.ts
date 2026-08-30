import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./authSchemas";

describe("registerSchema", () => {
  it("accepts a valid TEACHER submission", () => {
    const result = registerSchema.safeParse({
      role: "TEACHER",
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "secret1",
      confirmPassword: "secret1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid PUPIL submission with requestedType and teacherCode", () => {
    const result = registerSchema.safeParse({
      role: "PUPIL",
      name: "Grace Hopper",
      email: "grace@example.com",
      password: "secret1",
      confirmPassword: "secret1",
      requestedType: "MATH",
      teacherCode: "ABC123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a PUPIL submission missing teacherCode", () => {
    const result = registerSchema.safeParse({
      role: "PUPIL",
      name: "Grace Hopper",
      email: "grace@example.com",
      password: "secret1",
      confirmPassword: "secret1",
      requestedType: "MATH",
      teacherCode: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched password/confirmPassword and flags the confirmPassword field", () => {
    const result = registerSchema.safeParse({
      role: "TEACHER",
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "secret1",
      confirmPassword: "different",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["confirmPassword"]);
    }
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      role: "TEACHER",
      name: "Ada Lovelace",
      email: "not-an-email",
      password: "secret1",
      confirmPassword: "secret1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 6 characters", () => {
    const result = registerSchema.safeParse({
      role: "TEACHER",
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "abc",
      confirmPassword: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid email/password pair", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "secret1", confirmPassword: "secret1" }).success
    ).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({ password: "secret1", confirmPassword: "other1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["confirmPassword"]);
    }
  });
});

describe("changePasswordSchema", () => {
  it("accepts a valid change with a genuinely new password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old-secret",
      newPassword: "new-secret",
      confirmNewPassword: "new-secret",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when the new password and confirmation don't match", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old-secret",
      newPassword: "new-secret",
      confirmNewPassword: "different",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "confirmNewPassword")).toBe(true);
    }
  });

  it("rejects when the new password equals the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "same-secret",
      newPassword: "same-secret",
      confirmNewPassword: "same-secret",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "newPassword")).toBe(true);
    }
  });
});

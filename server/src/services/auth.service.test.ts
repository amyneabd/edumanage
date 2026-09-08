import { describe, it, expect, vi, beforeEach } from "vitest";

const { signUpMock, signInWithPasswordMock, resendMock, verifyOtpMock, resetPasswordForEmailMock, findUniqueUserMock, createUserMock, findUniqueTeacherProfileMock, findUniqueParentCodeMock, createNotificationMock, scopedSignInMock, scopedUpdateUserMock, scopedVerifyOtpMock, scopedSetSessionMock, scopedSignOutMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  resendMock: vi.fn(),
  verifyOtpMock: vi.fn(),
  resetPasswordForEmailMock: vi.fn(),
  findUniqueUserMock: vi.fn(),
  createUserMock: vi.fn(),
  findUniqueTeacherProfileMock: vi.fn(),
  findUniqueParentCodeMock: vi.fn(),
  createNotificationMock: vi.fn(),
  scopedSignInMock: vi.fn(),
  scopedUpdateUserMock: vi.fn(),
  scopedVerifyOtpMock: vi.fn(),
  scopedSetSessionMock: vi.fn(),
  scopedSignOutMock: vi.fn(),
}));

vi.mock("../utils/supabaseAuth.js", () => ({
  supabaseAuth: {
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
      resend: resendMock,
      verifyOtp: verifyOtpMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
    },
  },
  createAuthClient: () => ({
    auth: {
      signInWithPassword: scopedSignInMock,
      updateUser: scopedUpdateUserMock,
      verifyOtp: scopedVerifyOtpMock,
      setSession: scopedSetSessionMock,
      signOut: scopedSignOutMock,
    },
  }),
}));

vi.mock("../utils/prisma.js", () => ({
  prisma: {
    user: { findUnique: findUniqueUserMock, create: createUserMock },
    teacherProfile: { findUnique: findUniqueTeacherProfileMock },
    pupilProfile: { findUnique: findUniqueParentCodeMock },
  },
}));

vi.mock("./notification.service.js", () => ({
  createNotification: createNotificationMock,
}));

import {
  AuthError,
  registerTeacher,
  login,
  verifyEmail,
  requestPasswordReset,
  completePasswordReset,
  changePassword,
  logout,
} from "./auth.service.js";

const DB_USER = {
  id: "user-1",
  email: "teacher@example.com",
  supabaseId: "sb-user-1",
  name: "Teacher One",
  role: "TEACHER",
  status: "PENDING",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerTeacher", () => {
  it("creates a Supabase user and a Prisma user on happy path", async () => {
    findUniqueUserMock.mockResolvedValueOnce(null);
    signUpMock.mockResolvedValueOnce({ data: { user: { id: "sb-user-1" } }, error: null });
    findUniqueTeacherProfileMock.mockResolvedValueOnce(null);
    createUserMock.mockResolvedValueOnce({ ...DB_USER, teacherProfile: { teacherCode: "ABCD" } });

    const user = await registerTeacher({ email: "teacher@example.com", password: "secret1", name: "Teacher One" });

    expect(signUpMock).toHaveBeenCalledWith({ email: "teacher@example.com", password: "secret1" });
    expect(createUserMock).toHaveBeenCalled();
    expect(user.email).toBe("teacher@example.com");
  });

  it("rejects when a Prisma user with that email already exists", async () => {
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);

    await expect(
      registerTeacher({ email: "teacher@example.com", password: "secret1", name: "Teacher One" })
    ).rejects.toMatchObject({ status: 409 });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("maps a Supabase 'already registered' error to 409", async () => {
    findUniqueUserMock.mockResolvedValueOnce(null);
    signUpMock.mockResolvedValueOnce({ data: null, error: { status: 422, message: "User already registered" } });

    await expect(
      registerTeacher({ email: "teacher@example.com", password: "secret1", name: "Teacher One" })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("login", () => {
  it("returns the Prisma user and Supabase session on success", async () => {
    const session = { access_token: "at", refresh_token: "rt", expires_in: 3600, user: { id: "sb-user-1" } };
    signInWithPasswordMock.mockResolvedValueOnce({ data: { user: { id: "sb-user-1" }, session }, error: null });
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);

    const result = await login("teacher@example.com", "secret1");

    expect(result.user).toEqual(DB_USER);
    expect(result.session).toEqual(session);
  });

  it("throws 401 on wrong credentials", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ data: null, error: { message: "Invalid login credentials" } });

    await expect(login("teacher@example.com", "wrong")).rejects.toMatchObject({ status: 401 });
  });

  it("throws 403 with code EMAIL_NOT_CONFIRMED when email isn't confirmed", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({ data: null, error: { message: "Email not confirmed" } });

    await expect(login("teacher@example.com", "secret1")).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_CONFIRMED",
    });
  });

  it("throws 401 when Supabase succeeds but no matching Prisma user exists", async () => {
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: { id: "sb-orphan" }, session: { access_token: "at", refresh_token: "rt", expires_in: 3600 } },
      error: null,
    });
    findUniqueUserMock.mockResolvedValueOnce(null);

    await expect(login("teacher@example.com", "secret1")).rejects.toMatchObject({ status: 401 });
  });
});

describe("verifyEmail", () => {
  it("returns user and session on success", async () => {
    const session = { access_token: "at", refresh_token: "rt", expires_in: 3600, user: { id: "sb-user-1" } };
    verifyOtpMock.mockResolvedValueOnce({ data: { session }, error: null });
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);

    const result = await verifyEmail("hash-1");

    expect(result.user).toEqual(DB_USER);
    expect(result.session).toEqual(session);
  });

  it("throws 400 on invalid/expired token", async () => {
    verifyOtpMock.mockResolvedValueOnce({ data: { session: null }, error: { message: "invalid" } });

    await expect(verifyEmail("bad-hash")).rejects.toMatchObject({ status: 400 });
  });
});

describe("requestPasswordReset", () => {
  it("calls resetPasswordForEmail with a redirect to the client origin", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: null });

    await requestPasswordReset("teacher@example.com");

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
      "teacher@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") })
    );
  });
});

describe("completePasswordReset", () => {
  it("verifies the recovery token then updates the password on a scoped client", async () => {
    const session = { access_token: "at", refresh_token: "rt", expires_in: 3600 };
    scopedVerifyOtpMock.mockResolvedValueOnce({ data: { session }, error: null });
    scopedUpdateUserMock.mockResolvedValueOnce({ error: null });

    const result = await completePasswordReset("hash-1", "newpass1");

    expect(scopedVerifyOtpMock).toHaveBeenCalledWith({ token_hash: "hash-1", type: "recovery" });
    expect(scopedUpdateUserMock).toHaveBeenCalledWith({ password: "newpass1" });
    expect(result).toEqual(session);
  });

  it("throws 400 when the recovery token is invalid", async () => {
    scopedVerifyOtpMock.mockResolvedValueOnce({ data: { session: null }, error: { message: "invalid" } });

    await expect(completePasswordReset("bad-hash", "newpass1")).rejects.toMatchObject({ status: 400 });
    expect(scopedUpdateUserMock).not.toHaveBeenCalled();
  });

  it("throws 400 when updateUser fails", async () => {
    scopedVerifyOtpMock.mockResolvedValueOnce({ data: { session: { access_token: "at" } }, error: null });
    scopedUpdateUserMock.mockResolvedValueOnce({ error: { message: "weak password" } });

    await expect(completePasswordReset("hash-1", "weak")).rejects.toMatchObject({ status: 400 });
  });
});

describe("changePassword", () => {
  it("re-authenticates with the current password then updates it", async () => {
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);
    scopedSignInMock.mockResolvedValueOnce({ data: {}, error: null });
    scopedUpdateUserMock.mockResolvedValueOnce({ error: null });

    await changePassword("user-1", "currentpass", "newpass1");

    expect(scopedSignInMock).toHaveBeenCalledWith({ email: DB_USER.email, password: "currentpass" });
    expect(scopedUpdateUserMock).toHaveBeenCalledWith({ password: "newpass1" });
  });

  it("throws 400 when the current password is wrong", async () => {
    findUniqueUserMock.mockResolvedValueOnce(DB_USER);
    scopedSignInMock.mockResolvedValueOnce({ data: null, error: { message: "invalid" } });

    await expect(changePassword("user-1", "wrong", "newpass1")).rejects.toMatchObject({ status: 400 });
    expect(scopedUpdateUserMock).not.toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("sets the session then signs out on a scoped client", async () => {
    scopedSetSessionMock.mockResolvedValueOnce({ error: null });
    scopedSignOutMock.mockResolvedValueOnce({ error: null });

    await logout("at", "rt");

    expect(scopedSetSessionMock).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
    expect(scopedSignOutMock).toHaveBeenCalled();
  });

  it("is a no-op when tokens are missing", async () => {
    await logout(undefined, undefined);

    expect(scopedSetSessionMock).not.toHaveBeenCalled();
    expect(scopedSignOutMock).not.toHaveBeenCalled();
  });
});

import { z } from "zod";

const CLASS_TYPE_VALUES = ["SCIENCE", "MATH", "INFO", "ECO"] as const;

const name = z.string().trim().min(2, "Enter your full name.");
const email = z.string().trim().min(1, "Email is required.").email("Enter a valid email address.");
const password = z.string().min(6, "Password must be at least 6 characters.");

const teacherFields = z.object({
  role: z.literal("TEACHER"),
  name,
  email,
  password,
  confirmPassword: z.string().min(1, "Confirm your password."),
});

const parentFields = z.object({
  role: z.literal("PARENT"),
  name,
  email,
  password,
  confirmPassword: z.string().min(1, "Confirm your password."),
});

const phone = z.string().trim().min(6, "Enter a valid phone number.");

const pupilFields = z.object({
  role: z.literal("PUPIL"),
  name,
  email,
  password,
  confirmPassword: z.string().min(1, "Confirm your password."),
  requestedType: z.enum(CLASS_TYPE_VALUES, { message: "Choose a class type." }),
  teacherCode: z.string().trim().min(1, "Enter your teacher's ID."),
  phone,
  parentPhone: phone,
});

export const registerSchema = z
  .discriminatedUnion("role", [teacherFields, parentFields, pupilFields])
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: password,
    confirmNewPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match.",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from your current password.",
    path: ["newPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

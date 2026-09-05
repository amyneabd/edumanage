import { z } from "zod";

const CLASS_TYPE_VALUES = ["SCIENCE", "MATH", "INFO", "ECO"] as const;

const name = z.string().trim().min(2, "Entrez votre nom complet.");
const email = z.string().trim().min(1, "L'e-mail est requis.").email("Entrez une adresse e-mail valide.");
const password = z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères.");

const teacherFields = z.object({
  role: z.literal("TEACHER"),
  name,
  email,
  password,
  confirmPassword: z.string().min(1, "Confirmez votre mot de passe."),
});

const parentFields = z.object({
  role: z.literal("PARENT"),
  name,
  email,
  password,
  confirmPassword: z.string().min(1, "Confirmez votre mot de passe."),
});

const phone = z.string().trim().min(6, "Entrez un numéro de téléphone valide.");

const pupilFields = z.object({
  role: z.literal("PUPIL"),
  name,
  email,
  password,
  confirmPassword: z.string().min(1, "Confirmez votre mot de passe."),
  requestedType: z.enum(CLASS_TYPE_VALUES, { message: "Choisissez un type de classe." }),
  teacherCode: z.string().trim().min(1, "Entrez l'identifiant de votre enseignant."),
  phone,
  parentPhone: phone,
});

export const registerSchema = z
  .discriminatedUnion("role", [teacherFields, parentFields, pupilFields])
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Le mot de passe est requis."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, "Confirmez votre mot de passe."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Entrez votre mot de passe actuel."),
    newPassword: password,
    confirmNewPassword: z.string().min(1, "Confirmez votre nouveau mot de passe."),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Le nouveau mot de passe doit être différent de votre mot de passe actuel.",
    path: ["newPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

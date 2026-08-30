import nodemailer from "nodemailer";
import { env } from "./env.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!env.smtp) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
      // Without explicit timeouts, nodemailer's defaults (multi-minute) let a
      // slow or unreachable SMTP relay hang for a very long time. These
      // sends are fire-and-forget from the caller's perspective (see
      // auth.controller.ts), so failing fast just means a quicker retry/log
      // rather than a stalled connection.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
  }
  return transporter;
}

/**
 * Sends a password reset email. If SMTP isn't configured (no SMTP_HOST env
 * var), logs the reset link to the server console instead of throwing —
 * this keeps local/dev environments usable without mail infrastructure.
 * Returns whether the email was actually delivered via SMTP.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ delivered: boolean }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(`[mailer] SMTP not configured. Password reset link for ${to}:\n  ${resetUrl}`);
    return { delivered: false };
  }

  await transport.sendMail({
    from: env.smtp!.from,
    to,
    subject: "Reset your Bachandi password",
    text: `We received a request to reset your Bachandi password. This link expires in 1 hour:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your Bachandi password. This link expires in 1 hour:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
  return { delivered: true };
}

/**
 * Sends an email verification link for a newly created (or not-yet-verified)
 * account. Same SMTP-optional dev fallback as the password reset email.
 */
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<{ delivered: boolean }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(`[mailer] SMTP not configured. Verification link for ${to}:\n  ${verifyUrl}`);
    return { delivered: false };
  }

  await transport.sendMail({
    from: env.smtp!.from,
    to,
    subject: "Verify your Bachandi email address",
    text: `Welcome to Bachandi! Please verify your email address. This link expires in 24 hours:\n\n${verifyUrl}\n\nIf you didn't create this account, you can safely ignore this email.`,
    html: `<p>Welcome to Bachandi! Please verify your email address. This link expires in 24 hours:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If you didn't create this account, you can safely ignore this email.</p>`,
  });
  return { delivered: true };
}

/**
 * Sends an urgent alert email to a parent (absence, payment due, missing
 * submission). Best-effort: callers should not let a delivery failure here
 * block the underlying in-app notification from being created.
 */
export async function sendParentAlertEmail(
  to: string,
  subject: string,
  body: string,
  link?: string | null
): Promise<{ delivered: boolean }> {
  const transport = getTransporter();
  const fullLink = link ? `${env.clientOrigin}${link}` : null;

  if (!transport) {
    console.warn(`[mailer] SMTP not configured. Alert for ${to}: ${subject} — ${body}${fullLink ? ` (${fullLink})` : ""}`);
    return { delivered: false };
  }

  await transport.sendMail({
    from: env.smtp!.from,
    to,
    subject: `Bachandi: ${subject}`,
    text: `${body}${fullLink ? `\n\nView details: ${fullLink}` : ""}`,
    html: `<p>${body}</p>${fullLink ? `<p><a href="${fullLink}">View details</a></p>` : ""}`,
  });
  return { delivered: true };
}

import { env } from "./env.js";

const RESEND_API_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Sends one email via Resend's HTTP API. A plain HTTPS POST, deliberately
 * not SMTP: many PaaS hosts (Render included) block or silently drop
 * outbound SMTP connections, which previously caused registration and
 * password-reset emails to hang or fail to send with no visible error.
 * HTTPS on port 443 doesn't have that problem.
 *
 * If RESEND_API_KEY isn't configured, logs the content to the console
 * instead of throwing — keeps local/dev environments usable without mail
 * infrastructure. Returns whether the email was actually accepted by Resend.
 */
async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  logLabel: string;
}): Promise<{ delivered: boolean }> {
  if (!env.resend) {
    console.warn(`[mailer] RESEND_API_KEY not configured. ${params.logLabel}`);
    return { delivered: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.resend.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Resend API responded ${response.status}: ${body}`);
    }

    return { delivered: true };
  } finally {
    clearTimeout(timeout);
  }
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
  const fullLink = link ? `${env.clientOrigin}${link}` : null;

  return sendMail({
    to,
    subject: `Bachandi: ${subject}`,
    text: `${body}${fullLink ? `\n\nVoir les détails : ${fullLink}` : ""}`,
    html: `<p>${body}</p>${fullLink ? `<p><a href="${fullLink}">Voir les détails</a></p>` : ""}`,
    logLabel: `Alert for ${to}: ${subject} — ${body}${fullLink ? ` (${fullLink})` : ""}`,
  });
}

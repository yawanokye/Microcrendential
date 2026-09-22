import nodemailer from "nodemailer";

const APP_NAME = "UCC Growth+";

type EmailProvider = "gmail" | "resend" | "unconfigured";

export class EmailDeliveryError extends Error {
  constructor(public readonly status: number, public readonly providerMessage = "") {
    super(`Email delivery failed with status ${status}.`);
    this.name = "EmailDeliveryError";
  }
}

export function emailDeliveryUserMessage(error: unknown) {
  if (error instanceof EmailDeliveryError && error.status === 403) {
    return "Resend rejected this recipient. The resend.dev test sender can email only the address registered to the Resend account. Keep the platform in Demonstration mode or verify an approved sending domain.";
  }
  return "Secure email delivery is temporarily unavailable. Contact the platform administrator.";
}

export function transactionalEmailProvider(): EmailProvider {
  const requested = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (requested === "gmail" || requested === "google") return "gmail";
  if (requested === "resend") return "resend";
  if (process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()) return "gmail";
  if (process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()) return "resend";
  return "unconfigured";
}

export function transactionalEmailConfigured() {
  const provider = transactionalEmailProvider();
  if (provider === "gmail") return Boolean(process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim());
  if (provider === "resend") return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
  return false;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character] ?? character));

export async function sendTransactionalEmail(input: { to: string; subject: string; heading: string; text: string; actionUrl?: string; actionLabel?: string }) {
  const provider = transactionalEmailProvider();
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || (gmailUser ? `${APP_NAME} <${gmailUser}>` : "");
  if (provider === "gmail" && (!gmailUser || !gmailAppPassword)) throw new Error("Google Mail is not configured.");
  if (provider === "resend" && (!apiKey || !from)) throw new Error("Resend is not configured.");
  if (provider === "unconfigured") throw new Error("Transactional email is not configured.");
  const senderAddress = from.match(/<([^>]+)>/)?.[1] || from;
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || senderAddress;
  const action = input.actionUrl && input.actionLabel
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#173b57;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(input.actionLabel)}</a></p>`
    : "";
  const text = `${input.heading}\n\n${input.text}\n\nSupport: ${supportEmail}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17324a"><div style="padding:18px 22px;background:#173b57;color:#fff"><strong>${APP_NAME}</strong><br><span style="font-size:12px">University of Cape Coast</span></div><div style="padding:26px 22px;border:1px solid #d8e1e8;border-top:0"><h1 style="font-size:22px">${escapeHtml(input.heading)}</h1><p style="line-height:1.65;white-space:pre-line">${escapeHtml(input.text)}</p>${action}<p style="font-size:12px;color:#5c6e7b">If you did not request this message, contact ${escapeHtml(supportEmail)}.</p></div></div>`;

  if (provider === "gmail") {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailAppPassword },
    });
    await transporter.sendMail({ from, to: input.to, subject: input.subject, text, html });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text,
      html,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    let providerMessage = "";
    try {
      const failure = await response.json() as { message?: string };
      providerMessage = String(failure.message ?? "").slice(0, 500);
    } catch { providerMessage = ""; }
    throw new EmailDeliveryError(response.status, providerMessage);
  }
}

export async function sendSecurityCode(to: string, code: string, purpose: "email_verification" | "staff_mfa" | "password_reset") {
  const labels = {
    email_verification: { subject: "Verify your UCC Growth+ email", heading: "Verify your email address", description: "Use this code to confirm your learner email." },
    staff_mfa: { subject: "UCC Growth+ security code", heading: "Confirm your secure sign-in", description: "Use this code to complete your staff sign-in." },
    password_reset: { subject: "Reset your UCC Growth+ password", heading: "Reset your password", description: "Use this code to choose a new password." },
  }[purpose];
  await sendTransactionalEmail({
    to,
    subject: labels.subject,
    heading: labels.heading,
    text: `${labels.description}\n\nSecurity code: ${code}\n\nThis code expires in 10 minutes and can be used only once.`,
  });
}

const APP_NAME = "UCC Growth+";

export function transactionalEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
}[character] ?? character));

export async function sendTransactionalEmail(input: { to: string; subject: string; heading: string; text: string; actionUrl?: string; actionLabel?: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Transactional email is not configured.");
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || from.replace(/^.*<|>$/g, "");
  const action = input.actionUrl && input.actionLabel
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#173b57;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(input.actionLabel)}</a></p>`
    : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: `${input.heading}\n\n${input.text}\n\nSupport: ${supportEmail}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#17324a"><div style="padding:18px 22px;background:#173b57;color:#fff"><strong>${APP_NAME}</strong><br><span style="font-size:12px">University of Cape Coast</span></div><div style="padding:26px 22px;border:1px solid #d8e1e8;border-top:0"><h1 style="font-size:22px">${escapeHtml(input.heading)}</h1><p style="line-height:1.65;white-space:pre-line">${escapeHtml(input.text)}</p>${action}<p style="font-size:12px;color:#5c6e7b">If you did not request this message, contact ${escapeHtml(supportEmail)}.</p></div></div>`,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Email delivery failed with status ${response.status}.`);
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

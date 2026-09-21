import { PolicyPage } from "@/components/policy-page";

export default function SupportPage() {
  const supportEmail = process.env.SUPPORT_EMAIL?.trim();
  return <PolicyPage eyebrow="HELP AND INCIDENTS" title="UCC Growth+ support" summary="Use the signed-in support form when possible. It creates a traceable reference for technical, learning, assessment and account issues.">
    <section><h2>Before contacting support</h2><p>Record the page, course code, date and time, device or browser, and the exact message shown. Do not send passwords, full identity numbers, payment card information or unnecessary identity images by email.</p></section>
    <section><h2>Urgent security or privacy issue</h2><p>Report suspected account compromise, unintended disclosure, fraudulent certificates or payment discrepancies immediately. Sign out of shared devices and reset your password if you believe it has been exposed.</p></section>
    <section><h2>Contact</h2><p>{supportEmail ? <>Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> when you cannot sign in. Include your name and the email used for your account.</> : <>The UCC support email must be configured before the official pilot opens.</>}</p></section>
  </PolicyPage>;
}

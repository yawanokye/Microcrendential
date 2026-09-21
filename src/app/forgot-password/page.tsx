"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { UccBrandLockup } from "@/components/ucc-brand";

export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<"request" | "confirm" | "done">("request");
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "request", email }) });
      const result = await response.json() as { challengeId?: string; error?: string };
      if (!response.ok || !result.challengeId) throw new Error(result.error ?? "A reset code could not be requested.");
      setChallengeId(result.challengeId); setStage("confirm");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "A reset code could not be requested."); }
    finally { setSaving(false); }
  };
  const reset = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (password !== confirmation) return setError("The passwords do not match.");
    setSaving(true);
    try {
      const response = await fetch("/api/auth/password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confirm", challengeId, code, password }) });
      const result = await response.json() as { reset?: boolean; error?: string };
      if (!response.ok || !result.reset) throw new Error(result.error ?? "The password could not be reset.");
      setStage("done");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The password could not be reset."); }
    finally { setSaving(false); }
  };

  return <main className="recovery-shell"><section className="recovery-card"><a className="signin-back" href="/"><ArrowLeft /> Public website</a><UccBrandLockup subtitle="Secure account recovery" />{stage === "done" ? <div className="recovery-complete"><CheckCircle2 /><h1>Password updated</h1><p>Your new password is active. Staff accounts will still complete the emailed security-code step during sign-in.</p><a href="/student-signin">Return to sign in</a></div> : <><div className="recovery-heading"><ShieldCheck /><p className="eyebrow">PROTECTED ACCOUNT RECOVERY</p><h1>{stage === "request" ? "Reset your password" : "Enter your security code"}</h1><p>{stage === "request" ? "Use the email associated with your UCC Growth+ account." : `Enter the six-digit code sent to ${email}.`}</p></div>{stage === "request" ? <form onSubmit={requestCode}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>{error && <div className="auth-error" role="alert">{error}</div>}<button disabled={saving}><KeyRound /> {saving ? "Sending code…" : "Send reset code"}</button></form> : <form onSubmit={reset}><label>Six-digit code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" required /></label><label>New password<input type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /><span>Use at least 12 characters.</span></label><label>Confirm new password<input type="password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required /></label>{error && <div className="auth-error" role="alert">{error}</div>}<button disabled={saving}><KeyRound /> {saving ? "Updating password…" : "Update password"}</button></form>}</>}</section></main>;
}

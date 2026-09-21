"use client";

import { useState } from "react";
import { ArrowLeft, BookOpen, GraduationCap, KeyRound, ShieldCheck, Users } from "lucide-react";
import { UccBrandLockup } from "@/components/ucc-brand";

type AuthMode = "login" | "admin_setup" | "facilitator_setup";
type AuthPortal = "admin" | "facilitator" | "learner";
type ChallengePurpose = "email_verification" | "staff_mfa";
type AuthFormProps = { returnTo: string; portal?: AuthPortal; inviteToken?: string };

export default function AuthForm({ returnTo, portal: requestedPortal, inviteToken = "" }: AuthFormProps) {
  const portal = requestedPortal ?? (() => {
    try {
      const value = new URL(returnTo, "https://app.local").searchParams.get("portal");
      return value === "admin" || value === "facilitator" || value === "learner" ? value : "learner";
    } catch { return "learner"; }
  })();
  const [mode, setMode] = useState<AuthMode>(portal === "facilitator" && inviteToken ? "facilitator_setup" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<{ id: string; purpose: ChallengePurpose; emailHint: string; returnTo: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = portal === "admin";
  const isFacilitator = portal === "facilitator";
  const portalName = isAdmin ? "System Administration" : isFacilitator ? "Facilitator Portal" : "Learner Portal";
  const PortalIcon = isAdmin ? Users : isFacilitator ? ShieldCheck : BookOpen;
  const isSetup = mode === "admin_setup" || mode === "facilitator_setup";
  const heading = mode === "admin_setup"
    ? "Create the first administrator account."
    : mode === "facilitator_setup"
      ? "Activate your invited facilitator access."
      : isAdmin
        ? "Govern the platform securely."
        : isFacilitator
          ? "Welcome back, facilitator."
          : "Continue your learning journey.";
  const description = mode === "admin_setup"
    ? "Use the exact email configured as INITIAL_ADMIN_EMAIL. This one-time action creates the platform’s first governed administrator."
    : mode === "facilitator_setup"
      ? "Use the professional email named in your one-time invitation and create a permanent password for this portal."
      : isAdmin ? "Access identity, academic-quality, credential and platform-governance controls."
        : isFacilitator ? "Open course authoring, cohort intelligence, assessment queues and quality duties."
          : "Open your microcredentials, assessments, skills passport and credential wallet.";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/render-auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, portal, fullName, email, password, inviteToken: inviteToken || undefined }) });
      const result = await response.json() as { error?: string; returnTo?: string; challengeRequired?: ChallengePurpose; challengeId?: string; emailHint?: string };
      if (!response.ok) throw new Error(result.error ?? "Authentication failed.");
      if (result.challengeRequired && result.challengeId) {
        setChallenge({ id: result.challengeId, purpose: result.challengeRequired, emailHint: result.emailHint ?? email, returnTo: result.returnTo ?? returnTo });
        setPassword("");
        return;
      }
      window.location.assign(result.returnTo ?? returnTo);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Authentication failed."); }
    finally { setLoading(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); if (!challenge) return; setError(""); setLoading(true);
    try {
      const response = await fetch("/api/render-auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "verify_challenge", portal, challengeId: challenge.id, code, inviteToken: inviteToken || undefined }) });
      const result = await response.json() as { error?: string; returnTo?: string };
      if (!response.ok) throw new Error(result.error ?? "The security code could not be verified.");
      window.location.assign(result.returnTo ?? challenge.returnTo);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The security code could not be verified."); }
    finally { setLoading(false); }
  };

  return <main className={`access-shell render-auth-shell commercial-signin ${portal}`}><section className="commercial-signin-card"><aside><a className="signin-brand" href="/"><UccBrandLockup inverse /></a><div className="signin-value"><p className="eyebrow">{portalName.toUpperCase()}</p><h1>{challenge ? "One final security check." : heading}</h1><p>{challenge ? "A short-lived code protects your account even if a password is exposed." : description}</p></div><div className="signin-signals"><span><ShieldCheck /><b>Role-bound gateway</b><small>Only the matching account role can establish a session here.</small></span><span><GraduationCap /><b>Verified achievement</b><small>Learning evidence and credential decisions remain governed.</small></span></div><small>Secure session · Salted password hash · Email security code</small></aside><section><a className="signin-back" href="/"><ArrowLeft /> Public website</a><div className={`auth-portal-badge ${portal}`}><PortalIcon /><span>{portalName.toUpperCase()}</span></div>{challenge ? <><h2>{challenge.purpose === "staff_mfa" ? "Two-step staff sign-in" : "Verify your email"}</h2><p>Enter the six-digit code sent to <b>{challenge.emailHint}</b>. It expires in 10 minutes.</p><form className="render-auth-form" onSubmit={verify}><label>Security code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" required /></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className={`access-primary ${isAdmin ? "admin-submit" : ""}`} disabled={loading || code.length !== 6}><KeyRound /> {loading ? "Checking code…" : "Verify and continue"}</button><button className="auth-secondary-action" type="button" onClick={() => { setChallenge(null); setCode(""); setError(""); }}>Return to sign in</button></form></> : <><h2>{mode === "admin_setup" ? "Initial administrator setup" : mode === "facilitator_setup" ? "Invited facilitator activation" : "Sign in securely"}</h2><p>{mode === "admin_setup" ? "Create permanent credentials for the configured administrator email." : mode === "facilitator_setup" ? "This gateway validates both the invited email and its one-time invitation." : `Enter the credentials associated with your ${portalName} account.`}</p>{isAdmin && <div className="auth-mode"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Admin sign in</button><button type="button" className={mode === "admin_setup" ? "active" : ""} onClick={() => { setMode("admin_setup"); setError(""); }}>First admin setup</button></div>}<form className="render-auth-form" onSubmit={submit}>{mode === "admin_setup" && <label>Full legal name<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></label>}<label>{isAdmin ? "Administrator email" : isFacilitator ? "Professional or work email" : "Learner email"}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>{isSetup ? "Create or confirm password" : "Password"}<input type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSetup ? "new-password" : "current-password"} required /><span>Use at least 12 characters.</span></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className={`access-primary ${isAdmin ? "admin-submit" : ""}`} disabled={loading}><PortalIcon /> {loading ? "Verifying access…" : mode === "admin_setup" ? "Create administrator access" : mode === "facilitator_setup" ? "Activate facilitator access" : `Open ${portalName}`}</button><a className="forgot-password-link" href="/forgot-password">Forgot your password?</a></form>{!isAdmin && !isFacilitator && <div className="student-register-prompt"><div><b>New to UCC Growth+?</b><span>Create a verified learner profile in the dedicated registration portal.</span></div><a href="/student-registration">Register as a learner</a></div>}{isFacilitator && !inviteToken && <p className="signin-help">A system administrator must issue your one-time facilitator setup invitation before first sign-in.</p>}{isFacilitator && inviteToken && <p className="signin-help invited">Invitation detected. Use the exact professional email named by the administrator.</p>}</>}</section></section></main>;
}

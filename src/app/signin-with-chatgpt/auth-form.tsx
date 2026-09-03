"use client";

import { useState } from "react";
import { ArrowLeft, BookOpen, GraduationCap, ShieldCheck, Users } from "lucide-react";

type AuthMode = "login" | "admin_setup";
type AuthPortal = "admin" | "facilitator" | "learner";
type AuthFormProps = { returnTo: string; portal?: AuthPortal; inviteToken?: string };

export default function AuthForm({ returnTo, portal: requestedPortal, inviteToken = "" }: AuthFormProps) {
  const portal = requestedPortal ?? (() => {
    try {
      const value = new URL(returnTo, "https://app.local").searchParams.get("portal");
      return value === "admin" || value === "facilitator" || value === "learner" ? value : "learner";
    } catch { return "learner"; }
  })();
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const isAdmin = portal === "admin"; const isFacilitator = portal === "facilitator";
  const portalName = isAdmin ? "System Administration" : isFacilitator ? "Facilitator Portal" : "Student Portal";
  const PortalIcon = isAdmin ? Users : isFacilitator ? ShieldCheck : BookOpen;
  const heading = mode === "admin_setup" ? "Create the first administrator account." : isAdmin ? "Govern the platform securely." : isFacilitator ? "Welcome back, facilitator." : "Continue your learning journey.";
  const description = mode === "admin_setup"
    ? "Use the exact email configured as INITIAL_ADMIN_EMAIL. This one-time action creates the platform’s first governed administrator."
    : isAdmin ? "Access identity, academic-quality, credential and platform-governance controls."
      : isFacilitator ? "Open course authoring, cohort intelligence, assessment queues and quality duties."
        : "Open your microcredentials, assessments, skills passport and credential wallet.";
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/render-auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, fullName, email, password, returnTo, inviteToken: inviteToken || undefined }) });
      const result = await response.json() as { error?: string; returnTo?: string };
      if (!response.ok) throw new Error(result.error ?? "Authentication failed.");
      window.location.assign(result.returnTo ?? "/");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Authentication failed."); }
    finally { setLoading(false); }
  };
  return <main className={`access-shell render-auth-shell commercial-signin ${portal}`}><section className="commercial-signin-card"><aside><a className="signin-brand" href="/"><GraduationCap /><div><b>UCC Microcredentials</b><span>University of Cape Coast</span></div></a><div className="signin-value"><p className="eyebrow">{portalName.toUpperCase()}</p><h1>{heading}</h1><p>{description}</p></div><div className="signin-signals"><span><ShieldCheck /><b>Role-protected access</b><small>Permissions are checked on every protected action.</small></span><span><GraduationCap /><b>Verified achievement</b><small>Learning evidence and credential decisions remain governed.</small></span></div><small>Secure session · Salted password hash · Identity-controlled profile</small></aside><section><a className="signin-back" href="/"><ArrowLeft /> All portals</a><div className={`auth-portal-badge ${portal}`}><PortalIcon /><span>{portalName.toUpperCase()}</span></div><h2>{mode === "admin_setup" ? "Initial administrator setup" : "Sign in securely"}</h2><p>{mode === "admin_setup" ? "Create the permanent credentials for the configured administrator email." : `Enter the credentials associated with your ${portalName} account.`}</p>{isAdmin && <div className="auth-mode"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Admin sign in</button><button type="button" className={mode === "admin_setup" ? "active" : ""} onClick={() => { setMode("admin_setup"); setError(""); }}>First admin setup</button></div>}<form className="render-auth-form" onSubmit={submit}>{mode === "admin_setup" && <label>Full legal name<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></label>}<label>{isAdmin ? "Administrator email" : isFacilitator ? "Institutional email" : "Student email"}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>{mode === "admin_setup" ? "Create password" : "Password"}<input type="password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required /><span>Minimum 10 characters</span></label>{error && <div className="auth-error">{error}</div>}<button className={`access-primary ${isAdmin ? "admin-submit" : ""}`} disabled={loading}><PortalIcon /> {loading ? "Verifying access…" : mode === "admin_setup" ? "Create administrator access" : `Open ${portalName}`}</button></form>{!isAdmin && !isFacilitator && <div className="student-register-prompt"><div><b>New to UCC Microcredentials?</b><span>Create a verified student profile in the dedicated registration portal.</span></div><a href="/student-registration">Register as a student</a></div>}{isFacilitator && <p className="signin-help">A system administrator must issue your one-time facilitator setup invitation before first sign-in.</p>}</section></section></main>;
}

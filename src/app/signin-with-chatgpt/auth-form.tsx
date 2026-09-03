"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Award, BookOpen, CheckCircle2, Clock3, GraduationCap, ShieldCheck, Sparkles, Users } from "lucide-react";

type PortalRole = "learner" | "facilitator" | "admin";
type AuthMode = "login" | "admin_setup" | "facilitator_setup";

export default function AuthForm({ portal, returnTo, inviteToken = "" }: { portal: PortalRole; returnTo: string; inviteToken?: string }) {
  const [mode, setMode] = useState<AuthMode>(portal === "facilitator" && inviteToken ? "facilitator_setup" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = portal === "admin";
  const isFacilitator = portal === "facilitator";
  const portalName = isAdmin ? "System Administration" : isFacilitator ? "Facilitator Portal" : "Student Portal";
  const PortalIcon = isAdmin ? Users : isFacilitator ? ShieldCheck : BookOpen;
  const isSetup = mode === "admin_setup" || mode === "facilitator_setup";
  const heading = mode === "admin_setup"
    ? "Create the first administrator account."
    : mode === "facilitator_setup"
      ? "Activate your invited facilitator access."
      : isAdmin
        ? "Govern the platform securely."
        : "Welcome back, facilitator.";
  const description = mode === "admin_setup"
    ? "Use the exact email configured as INITIAL_ADMIN_EMAIL. This one-time action creates the platform’s first governed administrator."
    : mode === "facilitator_setup"
      ? "Use the institutional email named in your one-time invitation and create a permanent password for this portal."
      : isAdmin
        ? "Access identity, academic-quality, credential and platform-governance controls."
        : "Open course authoring, cohort intelligence, assessment queues and quality duties.";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/render-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, portal, fullName, email, password, returnTo, inviteToken }),
      });
      const result = await response.json() as { error?: string; returnTo?: string };
      if (!response.ok) throw new Error(result.error ?? "Authentication failed.");
      window.location.assign(result.returnTo ?? `/?portal=${portal}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const credentialForm = (
    <form className="render-auth-form" onSubmit={submit}>
      {mode === "admin_setup" && <label>Full legal name<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></label>}
      <label>
        {isAdmin ? "Administrator email" : isFacilitator ? "Institutional email" : "Student email"}
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </label>
      <label>
        {isSetup ? "Create or confirm password" : "Password"}
        <input type="password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSetup ? "new-password" : "current-password"} required />
        <span>{isSetup ? "Use at least 10 characters; returning invitees must enter the password already created." : "Minimum 10 characters"}</span>
      </label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className={`access-primary ${isAdmin ? "admin-submit" : ""}`} disabled={loading}>
        <PortalIcon /> {loading ? "Verifying this portal…" : mode === "admin_setup" ? "Create administrator access" : mode === "facilitator_setup" ? "Activate facilitator access" : `Open ${portalName}`}
      </button>
    </form>
  );

  if (portal === "learner") {
    return (
      <main className="student-login-shell">
        <section className="student-login-product">
          <header>
            <a className="student-login-brand" href="/"><GraduationCap /><div><b>UCC Microcredentials</b><span>University of Cape Coast</span></div></a>
            <span className="student-login-role"><BookOpen /> Student learning portal</span>
          </header>
          <div className="student-login-copy">
            <p className="eyebrow">LEARN · DEMONSTRATE · EARN</p>
            <h1>Turn focused learning into verified progress.</h1>
            <p>Return to your active microcredentials, practical activities, feedback and portable UCC achievement record.</p>
          </div>
          <div className="student-path-preview">
            <div><span><Sparkles /></span><div><small>YOUR LEARNING PATH</small><b>Build career-relevant capability</b></div><em>Flexible</em></div>
            <ol>
              <li className="complete"><CheckCircle2 /><span><b>Learn</b><small>Accessible, structured content</small></span></li>
              <li><Clock3 /><span><b>Practise</b><small>Virtual labs and authentic tasks</small></span></li>
              <li><Award /><span><b>Earn</b><small>Verifiable UCC credentials</small></span></li>
            </ol>
          </div>
          <footer><ShieldCheck /><span>Your student record is private. Credentials become shareable only when you choose.</span></footer>
        </section>
        <section className="student-login-card">
          <a className="signin-back" href="/"><ArrowLeft /> All role portals</a>
          <div className="student-welcome-icon"><BookOpen /></div>
          <p className="eyebrow">STUDENT SIGN IN</p>
          <h2>Welcome back to your learning.</h2>
          <p>Only registered learner accounts can enter here. Facilitator and administrator credentials are blocked at this gateway.</p>
          {credentialForm}
          <div className="student-register-prompt commercial">
            <div><b>Starting your first microcredential?</b><span>Create your verified learner profile and student number.</span></div>
            <a href="/student-registration">Register now <ArrowRight /></a>
          </div>
          <div className="portal-boundary-note"><ShieldCheck /><span>Using a staff account? Return to <a href="/">all role portals</a> and choose the correct protected gateway.</span></div>
        </section>
      </main>
    );
  }

  return (
    <main className={`access-shell render-auth-shell commercial-signin ${portal}`}>
      <section className="commercial-signin-card">
        <aside>
          <a className="signin-brand" href="/"><GraduationCap /><div><b>UCC Microcredentials</b><span>University of Cape Coast</span></div></a>
          <div className="signin-value"><p className="eyebrow">{portalName.toUpperCase()}</p><h1>{heading}</h1><p>{description}</p></div>
          <div className="signin-signals">
            <span><ShieldCheck /><b>Role-bound gateway</b><small>Only {isAdmin ? "administrator" : "facilitator"} accounts can establish a session here.</small></span>
            <span><GraduationCap /><b>Governed achievement</b><small>Learning evidence and credential decisions remain protected.</small></span>
          </div>
          <small>Secure session · Salted password hash · Identity-controlled profile</small>
        </aside>
        <section>
          <a className="signin-back" href="/"><ArrowLeft /> All role portals</a>
          <div className={`auth-portal-badge ${portal}`}><PortalIcon /><span>{portalName.toUpperCase()}</span></div>
          <h2>{mode === "admin_setup" ? "Initial administrator setup" : mode === "facilitator_setup" ? "Invited facilitator activation" : "Sign in securely"}</h2>
          <p>{mode === "admin_setup" ? "Create permanent credentials for the configured administrator email." : mode === "facilitator_setup" ? "This gateway validates both the invited email and its one-time invitation." : `Enter the credentials assigned to your ${portalName} account.`}</p>
          {isAdmin && (
            <div className="auth-mode">
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Admin sign in</button>
              <button type="button" className={mode === "admin_setup" ? "active" : ""} onClick={() => { setMode("admin_setup"); setError(""); }}>First admin setup</button>
            </div>
          )}
          {credentialForm}
          {isFacilitator && !inviteToken && <p className="signin-help">A system administrator must issue your one-time facilitator setup invitation before first sign-in.</p>}
          {isFacilitator && inviteToken && <p className="signin-help invited">Invitation detected. Sign in with the exact institutional email named by the administrator.</p>}
        </section>
      </section>
    </main>
  );
}

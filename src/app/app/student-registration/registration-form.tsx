"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Camera, CheckCircle2, FileText, GraduationCap,
  LockKeyhole, ShieldCheck, Sparkles, Upload, UserRound, Video,
} from "lucide-react";

type Stage = "loading" | "account" | "profile" | "identity" | "review" | "pending" | "existing";
type SessionProfile = { fullName: string; email: string; role: string; status: string; identityStatus?: string; studentNumber?: string };
type Session = { authenticated: boolean; identity?: { email: string; fullName: string }; profile?: SessionProfile | null };

const interestOptions = [
  "Education", "Humanities & Social Sciences", "Business & Management", "Science",
  "Technology & Engineering", "Health Sciences", "Agriculture & Natural Resources",
  "Creative Arts & Design", "Interdisciplinary",
];

function RegistrationSelfie({ ready, uploading, onCaptured }: { ready: boolean; uploading: boolean; onCaptured: (file: File) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<"idle" | "camera" | "preview">("idle");
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const stop = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  useEffect(() => () => stop(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const open = async () => {
    setError(""); setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview("");
    if (!navigator.mediaDevices?.getUserMedia) return setError("This device cannot open a camera. Use the image upload option instead.");
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream; setMode("camera");
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); } });
    } catch { setError("Camera permission was blocked. Allow access or upload a recent front-facing image."); }
  };
  const capture = () => {
    const video = videoRef.current; if (!video?.videoWidth) return setError("Wait for the camera preview before taking the photo.");
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setError("The photo could not be captured.");
      const captured = new File([blob], `ucc-student-selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
      setFile(captured); setPreview(URL.createObjectURL(blob)); stop(); setMode("preview");
    }, "image/jpeg", .9);
  };
  const accept = async () => { if (!file) return; await onCaptured(file); setMode("idle"); setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(""); };
  return <div className={`registration-upload-card selfie ${ready ? "ready" : ""}`}><Camera /><div><b>{ready ? "Live selfie secured" : "Take a current live selfie"}</b><span>Face forward in good light; no filters or group photos.</span></div>{mode === "idle" && <button type="button" onClick={open}><Video /> Open camera</button>}{mode === "camera" && <div className="registration-camera"><video ref={videoRef} muted autoPlay playsInline /><div><button type="button" onClick={() => { stop(); setMode("idle"); }}>Cancel</button><button type="button" onClick={capture}><Camera /> Capture</button></div></div>}{mode === "preview" && preview && <div className="registration-camera"><img src={preview} alt="Live selfie preview" /><div><button type="button" onClick={open}>Retake</button><button type="button" disabled={uploading} onClick={accept}><CheckCircle2 /> {uploading ? "Securing…" : "Use photo"}</button></div></div>}<label>Camera unavailable? Upload a JPG or PNG<input type="file" accept="image/jpeg,image/png" onChange={(event) => event.target.files?.[0] && onCaptured(event.target.files[0])} /></label>{error && <em>{error}</em>}</div>;
}

export default function StudentRegistrationForm() {
  const [stage, setStage] = useState<Stage>("loading");
  const [identity, setIdentity] = useState({ email: "", fullName: "" });
  const [account, setAccount] = useState({ fullName: "", email: "", password: "", confirmPassword: "", terms: false });
  const [profile, setProfile] = useState({ dateOfBirth: "", gender: "", nationality: "Ghanaian", phone: "", address: "", educationLevel: "", occupation: "", organisation: "", preferredLanguage: "English", accessibilityNeeds: "" });
  const [interests, setInterests] = useState<string[]>([]);
  const [idType, setIdType] = useState("Ghana Card"); const [idNumber, setIdNumber] = useState("");
  const [idDocumentKey, setIdDocumentKey] = useState(""); const [selfieKey, setSelfieKey] = useState("");
  const [identityConsent, setIdentityConsent] = useState(false); const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [uploading, setUploading] = useState<"id" | "selfie" | null>(null); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [studentNumber, setStudentNumber] = useState("");

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then((session: Session) => {
      if (!session.authenticated) return setStage("account");
      if (session.profile) {
        setIdentity({ email: session.profile.email, fullName: session.profile.fullName }); setStudentNumber(session.profile.studentNumber ?? "");
        setStage(session.profile.status === "pending_verification" ? "pending" : "existing"); return;
      }
      setIdentity({ email: session.identity?.email ?? "", fullName: session.identity?.fullName ?? "" }); setAccount((current) => ({ ...current, fullName: session.identity?.fullName ?? "", email: session.identity?.email ?? "" })); setStage("profile");
    }).catch(() => setStage("account"));
  }, []);

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (account.password !== account.confirmPassword) return setError("The passwords do not match.");
    if (!account.terms) return setError("Accept the student-account terms to continue.");
    setSaving(true);
    try {
      const response = await fetch("/api/render-auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "register", portal: "learner", fullName: account.fullName, email: account.email, password: account.password, termsAccepted: account.terms }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The student account could not be created.");
      setIdentity({ email: account.email.trim().toLowerCase(), fullName: account.fullName.trim() }); setStage("profile");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The student account could not be created."); }
    finally { setSaving(false); }
  };

  const validateProfile = () => {
    const required = [identity.fullName, profile.dateOfBirth, profile.gender, profile.nationality, profile.phone, profile.address, profile.educationLevel, profile.preferredLanguage];
    if (required.some((value) => !value.trim())) return setError("Complete every required student-profile field.");
    setError(""); setStage("identity");
  };
  const upload = async (file: File, kind: "id" | "selfie") => {
    setUploading(kind); setError("");
    try {
      const body = new FormData(); body.append("file", file); body.append("kind", kind === "id" ? "national-id" : "selfie");
      const response = await fetch("/api/identity-uploads", { method: "POST", body }); const result = await response.json() as { key?: string; error?: string };
      if (!response.ok || !result.key) throw new Error(result.error ?? "The identity file could not be secured.");
      if (kind === "id") setIdDocumentKey(result.key); else setSelfieKey(result.key);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The identity file could not be secured."); }
    finally { setUploading(null); }
  };
  const validateIdentity = () => {
    if (!idNumber.trim() || !idDocumentKey || !selfieKey || !identityConsent || !privacyAccepted) return setError("Complete both identity checks and accept the consent statements.");
    setError(""); setStage("review");
  };
  const submit = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: identity.fullName, ...profile, interests, idType, idLast4: idNumber.slice(-4), idDocumentKey, selfieKey, consent: identityConsent, termsAccepted: true, privacyAccepted }) });
      const result = await response.json() as { profile?: SessionProfile; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error ?? "Student registration could not be submitted.");
      setStudentNumber(result.profile.studentNumber ?? ""); setStage("pending");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Student registration could not be submitted."); }
    finally { setSaving(false); }
  };
  const toggleInterest = (item: string) => setInterests((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  const stepIndex = stage === "account" ? 0 : stage === "profile" ? 1 : stage === "identity" ? 2 : stage === "review" ? 3 : 4;

  if (stage === "loading") return <main className="student-registration-shell"><section className="registration-loading"><GraduationCap /><h1>Opening student registration</h1><span /></section></main>;
  if (stage === "pending") return <main className="student-registration-shell"><section className="registration-complete"><div className="registration-brand"><GraduationCap /><div><b>UCC Microcredentials</b><span>Student Registration Portal</span></div></div><div className="complete-mark"><ShieldCheck /></div><p className="eyebrow">REGISTRATION RECEIVED</p><h1>Your student profile is awaiting identity review.</h1><p>Your account and evidence are secure. An authorised reviewer must verify the ID portrait against the live selfie before learning access opens.</p>{studentNumber && <div className="student-number"><span>Student number</span><b>{studentNumber}</b></div>}<div className="registration-status-list"><span className="done">1</span><b>Secure account created</b><span className="done">2</span><b>Student profile received</b><span className="done">3</span><b>Identity evidence secured</b><span>4</span><b>Reviewer decision pending</b></div><a className="registration-primary" href="/signout-with-chatgpt?return_to=%2F">Finish and sign out</a></section></main>;
  if (stage === "existing") return <main className="student-registration-shell"><section className="registration-complete"><div className="registration-brand"><GraduationCap /><div><b>UCC Microcredentials</b><span>Student Registration Portal</span></div></div><div className="complete-mark active"><CheckCircle2 /></div><p className="eyebrow">ACCOUNT ALREADY REGISTERED</p><h1>Your UCC student profile is already available.</h1><p>Continue to the Student Portal to access learning, assessments, your skills passport and verifiable credentials.</p>{studentNumber && <div className="student-number"><span>Student number</span><b>{studentNumber}</b></div>}<a className="registration-primary" href="/student-signin">Open Student Portal <ArrowRight /></a></section></main>;

  return <main className="student-registration-shell"><section className="student-registration-card"><header><div className="registration-brand"><GraduationCap /><div><b>UCC Microcredentials</b><span>Student Registration Portal</span></div></div><a href="/">Return to portal selection</a></header><div className="registration-layout"><aside><p className="eyebrow">STUDENT ONBOARDING</p><h1>Build your verified learning identity.</h1><p>Create one profile for enrolment, assessment evidence, stackable credentials and lifelong achievement records.</p><div className="registration-benefits"><span><LockKeyhole /><b>Secure account</b><small>Protected password and role checks</small></span><span><ShieldCheck /><b>Verified identity</b><small>Restricted ID and selfie review</small></span><span><Sparkles /><b>Skills passport</b><small>Portable evidence of achievement</small></span><span><BookOpen /><b>Flexible learning</b><small>Online courses and practicals</small></span></div><small>Your full ID number is never written into the learner database; only the final four characters are retained for reference.</small></aside><section className="registration-workspace"><div className="registration-stepper">{["Account", "Profile", "Identity", "Review"].map((label, index) => <span key={label} className={stepIndex === index ? "active" : stepIndex > index ? "complete" : ""}><b>{stepIndex > index ? "✓" : index + 1}</b>{label}</span>)}</div>
    {stage === "account" && <form className="registration-stage" onSubmit={createAccount}><div><p className="eyebrow">STEP 1 OF 4</p><h2>Create your student sign-in</h2><p>Use an email address you can access throughout your learning journey.</p></div><div className="registration-grid"><label>Full legal name<input value={account.fullName} onChange={(event) => setAccount({ ...account, fullName: event.target.value })} autoComplete="name" required /></label><label>Email address<input type="email" value={account.email} onChange={(event) => setAccount({ ...account, email: event.target.value })} autoComplete="email" required /></label><label>Create password<input type="password" minLength={10} value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} autoComplete="new-password" required /><span>At least 10 characters</span></label><label>Confirm password<input type="password" minLength={10} value={account.confirmPassword} onChange={(event) => setAccount({ ...account, confirmPassword: event.target.value })} autoComplete="new-password" required /></label></div><label className="registration-consent"><input type="checkbox" checked={account.terms} onChange={(event) => setAccount({ ...account, terms: event.target.checked })} /><span>I agree to create a UCC Microcredentials student account and to follow the platform’s academic-integrity and acceptable-use requirements.</span></label>{error && <div className="registration-error">{error}</div>}<div className="registration-actions"><a href="/signin-with-chatgpt?return_to=%2F%3Fportal%3Dlearner">Already registered? Student sign in</a><button disabled={saving}>{saving ? "Creating account…" : "Create account and continue"} <ArrowRight /></button></div></form>}
    {stage === "profile" && <div className="registration-stage"><div><p className="eyebrow">STEP 2 OF 4</p><h2>Complete your student profile</h2><p>This information supports enrolment, learner services and appropriate accessibility support.</p></div><div className="signed-student"><UserRound /><div><b>{identity.fullName}</b><span>{identity.email}</span></div></div><div className="registration-grid"><label>Date of birth<input type="date" value={profile.dateOfBirth} onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value })} /></label><label>Gender<select value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })}><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label><label>Nationality<input value={profile.nationality} onChange={(event) => setProfile({ ...profile, nationality: event.target.value })} /></label><label>Phone number<input type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="+233…" /></label><label>Highest education level<select value={profile.educationLevel} onChange={(event) => setProfile({ ...profile, educationLevel: event.target.value })}><option value="">Select</option><option>Senior high / secondary</option><option>Technical or vocational</option><option>Diploma</option><option>Bachelor’s degree</option><option>Postgraduate degree</option><option>Professional qualification</option><option>Other</option></select></label><label>Preferred language<select value={profile.preferredLanguage} onChange={(event) => setProfile({ ...profile, preferredLanguage: event.target.value })}><option>English</option><option>French</option><option>Twi</option><option>Fante</option><option>Other</option></select></label><label>Occupation or current role<input value={profile.occupation} onChange={(event) => setProfile({ ...profile, occupation: event.target.value })} placeholder="Optional" /></label><label>Organisation or school<input value={profile.organisation} onChange={(event) => setProfile({ ...profile, organisation: event.target.value })} placeholder="Optional" /></label><label className="full">Residential address<textarea value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></label><label className="full">Accessibility or learning support needs<textarea value={profile.accessibilityNeeds} onChange={(event) => setProfile({ ...profile, accessibilityNeeds: event.target.value })} placeholder="Optional — tell us about captions, screen-reader, mobility, timing or other support needs" /></label></div><fieldset className="interest-picker"><legend>Learning interests <span>Choose any that apply</span></legend>{interestOptions.map((item) => <button type="button" key={item} className={interests.includes(item) ? "selected" : ""} onClick={() => toggleInterest(item)}>{interests.includes(item) && <CheckCircle2 />}{item}</button>)}</fieldset>{error && <div className="registration-error">{error}</div>}<div className="registration-actions"><a href="/signout-with-chatgpt?return_to=%2Fstudent-registration">Cancel registration</a><button onClick={validateProfile}>Continue to identity <ArrowRight /></button></div></div>}
    {stage === "identity" && <div className="registration-stage"><div><p className="eyebrow">STEP 3 OF 4</p><h2>Verify your learning identity</h2><p>Evidence is restricted to authorised UCC reviewers and is not shown in your public credential.</p></div><div className="registration-grid"><label>ID type<select value={idType} onChange={(event) => setIdType(event.target.value)}><option>Ghana Card</option><option>Passport</option><option>National ID</option></select></label><label>ID number<input value={idNumber} onChange={(event) => setIdNumber(event.target.value)} placeholder="Only the final four characters are retained" /></label></div><div className="registration-evidence"><label className={`registration-upload-card ${idDocumentKey ? "ready" : ""}`}><FileText /><div><b>{idDocumentKey ? "Identity document secured" : "Upload identity document"}</b><span>Clear JPG, PNG or PDF · maximum 8 MB</span></div><span className="upload-action"><Upload /> {uploading === "id" ? "Securing…" : "Choose file"}</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], "id")} /></label><RegistrationSelfie ready={Boolean(selfieKey)} uploading={uploading === "selfie"} onCaptured={(file) => upload(file, "selfie")} /></div><label className="registration-consent"><input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} /><span>I have read and accept the privacy notice governing my student profile and learning records.</span></label><label className="registration-consent"><input type="checkbox" checked={identityConsent} onChange={(event) => setIdentityConsent(event.target.checked)} /><span>I consent to restricted processing of my identity document and facial image solely for identity verification and academic-integrity controls.</span></label>{error && <div className="registration-error">{error}</div>}<div className="registration-actions"><button className="back" onClick={() => setStage("profile")}><ArrowLeft /> Back</button><button disabled={Boolean(uploading)} onClick={validateIdentity}>Review registration <ArrowRight /></button></div></div>}
    {stage === "review" && <div className="registration-stage"><div><p className="eyebrow">STEP 4 OF 4</p><h2>Review and submit</h2><p>Confirm the information below before sending the profile for verification.</p></div><div className="registration-review"><section><span>Student</span><b>{identity.fullName}</b><small>{identity.email}</small></section><section><span>Profile</span><b>{profile.educationLevel}</b><small>{profile.nationality} · {profile.phone}</small></section><section><span>Learning interests</span><b>{interests.length || "None selected"}</b><small>{interests.join(" · ") || "You can discover all disciplines"}</small></section><section><span>Identity evidence</span><b>{idType} ending {idNumber.slice(-4)}</b><small>ID document and live selfie received</small></section><section><span>Accessibility support</span><b>{profile.accessibilityNeeds ? "Support information supplied" : "No needs supplied"}</b><small>Can be updated later in your profile</small></section><section><span>Credential readiness</span><b>Skills passport enabled</b><small>Achievements become shareable only after assessment</small></section></div>{error && <div className="registration-error">{error}</div>}<div className="registration-actions"><button className="back" onClick={() => setStage("identity")}><ArrowLeft /> Back</button><button disabled={saving} onClick={submit}><ShieldCheck /> {saving ? "Submitting securely…" : "Submit student registration"}</button></div></div>}
  </section></div></section></main>;
}

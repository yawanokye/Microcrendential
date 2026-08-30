"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity, Award, Beaker, Bell, BookOpen, CalendarDays, CheckCircle2, ChevronRight, CirclePlay, ClipboardCheck, Clock3,
  Code2, Eye, FileCheck2, FileText, FlaskConical, Gauge, GraduationCap, GripVertical, HeartPulse, ImageIcon, LayoutDashboard, Menu,
  MessageSquareText, Microscope, Pencil, QrCode, RotateCcw, Search, Settings, ShieldCheck, Sigma, Stethoscope, Undo2, Upload, Users, Video, Wrench, X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { labDisciplines, virtualPracticals, type LabDiscipline, type VirtualPractical } from "@/lib/virtual-labs";

type PairItem = { left: string; right: string; image?: string };
type AssessmentQuestion = { id: string; type: string; prompt: string; options: string[]; correctAnswer: string; points: number; scheme: string; feedbackCorrect: string; feedbackIncorrect: string; learnerAdvice: string; pairs?: PairItem[]; videoUrl?: string; videoMode?: "whole" | "part" | "pause"; videoStart?: number; videoEnd?: number; whiteboardEnabled?: boolean };
type CourseMaterial = { title: string; kind: string; source: string; url?: string; externalUrl?: string; transcript?: string; transcriptLanguage?: string; transcriptSource?: string; transcriptPublished?: boolean };
type CourseActivity = { id: string; kind: "colab" | "virtual_lab"; title: string; instructions: string; required: boolean; passMark: number; attemptsAllowed: number; maxMark?: number; dueAt?: string; rubric?: string; notebookKey?: string; notebookFileName?: string; templateUrl?: string; practicalId?: string; discipline?: string };
type Course = { code: string; title: string; school: string; progress: number; modules: string; accent: string; next: string; discipline?: string; published?: boolean; description?: string; materials?: CourseMaterial[]; activities?: CourseActivity[]; assessmentConfig?: { passMark?: number; attempts?: string; questions?: AssessmentQuestion[] }; facilitatorName?: string; certificateEnabled?: boolean; status?: string; id?: number };
type ColabAssignment = { id: number; courseCode: string; courseTitle: string; title: string; instructions: string; templateFileName: string; templateUrl?: string | null; openUrl: string; directOpen: boolean; rubric: string; maxMark: number; passMark: number; attemptsAllowed: number; dueAt?: string | null; status: string; createdByEmail: string; createdAt: string; latestSubmission?: { id: number; status: string; mark?: number | null; passed: boolean; attemptNumber: number; feedback: string } | null };
type ColabSubmission = { id: number; assignmentId: number; assignmentTitle: string; courseCode: string; courseTitle: string; learnerEmail: string; learnerName: string; attemptNumber: number; submissionType: "file" | "link"; notebookFileName?: string | null; notebookUrl?: string | null; status: string; mark?: number | null; passed: boolean; feedback: string; maxMark: number; passMark: number; submittedAt: string; assessedAt?: string | null };
type VirtualLabSubmission = { id: number; practicalId: string; discipline: string; practicalTitle: string; learnerEmail: string; learnerName: string; attemptNumber: number; observations: { trial?: string; input?: number; result?: number; note?: string }[]; answers: Record<string, unknown>; report: string; evidenceFileName?: string | null; status: string; mark?: number | null; passed: boolean; feedback: string; competencyNote: string; submittedAt: string; assessedAt?: string | null };
type LabObservation = { trial: string; input: number; result: number; note: string };

const disciplines = ["Education", "Humanities & Social Sciences", "Business & Management", "Science", "Technology & Engineering", "Health Sciences", "Agriculture & Natural Resources", "Creative Arts & Design", "Interdisciplinary"];

const courses: Course[] = [
  { code: "UCC-MC 204", title: "Digital Pedagogy for Flexible Learning", school: "College of Education Studies", discipline: "Education", progress: 68, modules: "8 of 12 modules", accent: "gold", next: "Complete Module 9" },
  { code: "UCC-MC 118", title: "Data Analytics for Public Decisions", school: "College of Humanities & Legal Studies", discipline: "Business & Management", progress: 42, modules: "5 of 12 modules", accent: "teal", next: "Continue data lab" },
  { code: "UCC-MC 310", title: "Coastal Resilience & Community Practice", school: "School of Biological Sciences", discipline: "Science", progress: 83, modules: "10 of 12 modules", accent: "blue", next: "Submit field reflection" },
  { code: "DEMO 101", title: "Mixed-Media Learning Sandbox", school: "Platform Testing Unit", discipline: "Interdisciplinary", progress: 25, modules: "1 of 4 test activities", accent: "gold", next: "Test watch, read & code" },
  { code: "DEMO 202", title: "Synchronous Facilitation Lab", school: "Platform Testing Unit", discipline: "Education", progress: 50, modules: "2 of 4 test activities", accent: "teal", next: "Test live classroom" },
  { code: "DEMO 303", title: "Assessment & Progression Gate", school: "Platform Testing Unit", discipline: "Science", progress: 75, modules: "3 of 4 test activities", accent: "blue", next: "Test assessment gate" },
];

const liveSessions = [
  { day: "27", month: "AUG", title: "Designing authentic online assessment", course: "Digital Pedagogy", time: "10:00–11:30 GMT", host: "Dr. E. A. Mensah", status: "Tomorrow" },
  { day: "29", month: "AUG", title: "Applied data clinic", course: "Data Analytics", time: "14:00–15:00 GMT", host: "Prof. K. O. Arthur", status: "In 3 days" },
  { day: "02", month: "SEP", title: "Community evidence review", course: "Coastal Resilience", time: "09:00–10:30 GMT", host: "Dr. Aba Quansah", status: "Next week" },
];

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "learning", label: "My learning", icon: BookOpen },
  { id: "certificates", label: "Certificates", icon: Award },
  { id: "live", label: "Live sessions", icon: Video },
  { id: "assessments", label: "Assessments", icon: FileCheck2 },
  { id: "colab", label: "Colab coding", icon: Code2 },
  { id: "virtual_labs", label: "Virtual labs", icon: FlaskConical },
  { id: "discussions", label: "Discussions", icon: MessageSquareText },
  { id: "facilitator", label: "Facilitator studio", icon: ShieldCheck },
  { id: "verification", label: "Identity register", icon: FileCheck2 },
  { id: "admin", label: "System administration", icon: Users },
  { id: "course_admin", label: "Course approvals", icon: CheckCircle2 },
  { id: "testing", label: "Testing sandbox", icon: Settings },
];

type LearningResource = { type: "Watch" | "Read" | "Code"; title: string; source: string; license: string; url: string; externalUrl: string; transcript?: string; transcriptLanguage?: string };
type PortalRole = "learner" | "facilitator" | "admin";
type AccountProfile = { email: string; fullName: string; role: PortalRole; status: string; identityStatus?: string; dateOfBirth?: string; gender?: string; nationality?: string; phone?: string; address?: string; idType?: string; idLast4?: string };
type AccountSession = { authenticated: boolean; identity?: { email: string; fullName: string }; profile?: AccountProfile | null; enrollments?: string[] };

const openResources: LearningResource[] = [
  { type: "Watch", title: "But what is a neural network?", source: "3Blue1Brown · YouTube", license: "YouTube", url: "https://www.youtube-nocookie.com/embed/aircAruvnKk", externalUrl: "https://www.youtube.com/watch?v=aircAruvnKk" },
  { type: "Read", title: "Introduction to web APIs", source: "MDN Web Docs", license: "CC BY-SA 2.5", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Client-side_APIs/Introduction", externalUrl: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Client-side_APIs/Introduction" },
  { type: "Code", title: "JavaScript starter workspace", source: "StackBlitz", license: "Open workspace", url: "https://stackblitz.com/edit/js?embed=1&file=index.js&hideNavigation=1", externalUrl: "https://stackblitz.com/edit/js" },
  { type: "Read", title: "MIT OpenCourseWare learning collection", source: "MIT OpenCourseWare", license: "CC BY-NC-SA", url: "https://ocw.mit.edu/", externalUrl: "https://ocw.mit.edu/" },
];

function downloadCalendar() {
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//UCC//Microcredentials//EN\nBEGIN:VEVENT\nUID:ucc-mc-live-1\nDTSTART:20260827T100000Z\nDTEND:20260827T113000Z\nSUMMARY:Designing authentic online assessment\nEND:VEVENT\nEND:VCALENDAR`;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const link = document.createElement("a");
  link.href = url; link.download = "ucc-microcredential-calendar.ics"; link.click(); URL.revokeObjectURL(url);
  toast.success("Calendar feed downloaded");
}

export default function Home() {
  const [account, setAccount] = useState<AccountSession | undefined>(undefined);
  const [inviteToken, setInviteToken] = useState("");
  const [requestedPortal, setRequestedPortal] = useState<PortalRole | null>(null);
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [publishedCourses, setPublishedCourses] = useState<Course[]>([]);
  const [selectedSession, setSelectedSession] = useState<(typeof liveSessions)[number] | null>(null);
  const [completed, setCompleted] = useState([true, true, false, false]);
  const [resourceQuery, setResourceQuery] = useState("");
  const [lessonStage, setLessonStage] = useState<"content" | "check" | "complete">("content");
  const [answer, setAnswer] = useState("");
  const [answerState, setAnswerState] = useState<"idle" | "correct" | "incorrect">("idle");
  const [activityMode, setActivityMode] = useState<"watch" | "read" | "code">("watch");
  const [utility, setUtility] = useState<"notifications" | "support" | "preferences" | "profile" | "assessment" | null>(null);
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    setInviteToken(parameters.get("invite") ?? "");
    const portal = parameters.get("portal");
    setRequestedPortal(portal === "learner" || portal === "facilitator" || portal === "admin" ? portal : null);
    fetch("/api/auth/session").then((response) => response.json()).then((data: AccountSession) => setAccount(data)).catch(() => setAccount({ authenticated: false }));
  }, []);
  const role: PortalRole = account?.profile?.role ?? "learner";
  useEffect(() => { if (role === "facilitator") setActive("facilitator"); if (role === "admin") setActive("admin"); }, [role]);
  useEffect(() => {
    if (account?.profile?.status !== "active") return;
    fetch("/api/courses").then((response) => response.json()).then((result: { courses?: { id: number; code: string; title: string; discipline: string; description: string; materials: Course["materials"]; activities: Course["activities"]; assessmentConfig: Course["assessmentConfig"]; questionLimit: number; certificateEnabled: boolean; status: string; facilitatorName: string }[] }) => setPublishedCourses((result.courses ?? []).filter((course) => course.status === "active").map((course, index) => ({ id: course.id, code: course.code, title: course.title, discipline: course.discipline, description: course.description, materials: course.materials, activities: course.activities, assessmentConfig: course.assessmentConfig, certificateEnabled: course.certificateEnabled, status: course.status, facilitatorName: course.facilitatorName, school: `Facilitator: ${course.facilitatorName}`, progress: 0, modules: `${(course.materials?.length ?? 0) + (course.activities?.length ?? 0)} learning activities`, accent: ["teal", "blue", "gold"][index % 3], next: "Open active course", published: true })))).catch(() => setPublishedCourses([]));
  }, [account?.profile?.email, account?.profile?.status]);
  const enrolledCodes = account?.enrollments ?? [];
  const allCourses = [...courses, ...publishedCourses.filter((course) => !courses.some((existing) => existing.code === course.code))];
  const visibleCourses = role === "learner" ? allCourses.filter((course) => enrolledCodes.includes(course.code)) : allCourses;
  const filteredCourses = visibleCourses.filter((course) => `${course.title} ${course.code}`.toLowerCase().includes(query.toLowerCase()));
  const selectView = (id: string) => { setActive(id); setMobileOpen(false); };
  const enrolCourse = async (courseCode: string) => {
    const response = await fetch("/api/enrollments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseCode }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return toast.error(result.error ?? "Enrolment could not be completed.");
    setAccount((current) => current ? ({ ...current, enrollments: [...new Set([...(current.enrollments ?? []), courseCode])] }) : current);
    toast.success("Enrolment confirmed", { description: `${courseCode} is now in your learning portal.` });
  };

  if (!account) return <PortalLoading />;
  if (!account.authenticated) return <PortalAccess inviteToken={inviteToken} />;
  if (!account.profile && requestedPortal === "admin") return <PortalRoleMismatch requestedRole="admin" email={account.identity?.email ?? ""} />;
  if (!account.profile && requestedPortal === "facilitator" && !inviteToken) return <PortalRoleMismatch requestedRole="facilitator" email={account.identity?.email ?? ""} />;
  if (!account.profile) return <IdentityRegistration role="learner" initialName={account.identity?.fullName ?? ""} email={account.identity?.email ?? ""} onComplete={(profile) => setAccount((current) => ({ authenticated: true, identity: current?.identity, profile, enrollments: [] }))} />;
  if (account.profile.role === "facilitator" && account.profile.status === "pending_setup") return <IdentityRegistration role="facilitator" initialName={account.profile.fullName} email={account.profile.email} inviteToken={inviteToken} onComplete={(profile) => setAccount((current) => ({ authenticated: true, identity: current?.identity, profile, enrollments: [] }))} />;
  if (requestedPortal === "admin" && account.profile.role !== "admin") return <PortalRoleMismatch requestedRole="admin" email={account.profile.email} />;
  if (requestedPortal === "facilitator" && account.profile.role !== "facilitator" && account.profile.role !== "admin") return <PortalRoleMismatch requestedRole="facilitator" email={account.profile.email} />;
  if (account.profile.status === "pending_verification") return <VerificationPending role={account.profile.role} email={account.profile.email} />;
  if (account.profile.status !== "active") return <SuspendedAccess email={account.profile.email} status={account.profile.status} />;
  const displayName = account.profile.fullName;
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const allowedNav = nav.filter((item) => {
    if (item.id === "facilitator") return role === "facilitator" || role === "admin";
    if (item.id === "certificates") return role === "learner";
    if (item.id === "verification") return role === "facilitator" || role === "admin";
    if (item.id === "admin") return role === "admin";
    if (item.id === "course_admin") return role === "admin";
    if (item.id === "testing") return role !== "learner";
    return true;
  });

  return (
    <main className="portal-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><GraduationCap size={25} /></div><div><strong>UCC Microcredentials</strong><span>Learn · Demonstrate · Progress</span></div></div>
        <div className="top-actions">
          <label className="searchbox"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your learning" aria-label="Search your learning" /></label>
          <button className="icon-button" aria-label="Notifications" onClick={() => setUtility("notifications")}><Bell size={19} /><i /></button>
          <span className={`account-role ${role}`}><ShieldCheck /> {role === "admin" ? "System admin" : role}</span>
          <button className="profile-chip" onClick={() => setUtility("profile")}><span>{initials || "UC"}</span><b>{displayName}</b></button>
          <a className="signout-link" href="/signout-with-chatgpt?return_to=%2F">Sign out</a>
          <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open navigation">{mobileOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <aside className={`side-nav ${mobileOpen ? "open" : ""}`}>
        <p className="nav-label">LEARNING SPACE</p>
        <nav aria-label="Learning portal navigation">{allowedNav.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => selectView(item.id)} className={active === item.id ? "active" : ""}><Icon size={19} /><span>{item.label}</span></button>; })}</nav>
        <div className="nav-divider" /><p className="nav-label">SUPPORT</p>
        <nav><button onClick={() => setUtility("support")}><Users size={19} /><span>Learning support</span></button><button onClick={() => setUtility("preferences")}><Settings size={19} /><span>Preferences</span></button></nav>
        <button className="qa-card" onClick={() => toast.success("Quality controls active", { description: "Assessment, progression and records checks are enabled." })}><FileCheck2 size={20} /><div><b>UCC quality assured</b><span>Verified learning and assessment</span></div></button>
      </aside>

      <section className="workspace">
        <div className="welcome-row"><div><p className="eyebrow">{role.toUpperCase()} PORTAL · WEDNESDAY, 26 AUGUST 2026</p><h1>Good morning, {displayName.split(" ")[0]}</h1><p>{role === "learner" ? "Enrol in an open microcredential or continue your current learning." : role === "facilitator" ? "Develop courses, guide learners and manage assessment evidence." : "Manage platform users, facilitator access and institutional operations."}</p></div><button className="primary-action" onClick={() => selectView(role === "admin" ? "admin" : role === "facilitator" ? "facilitator" : "learning")}><CirclePlay size={18} /> Open {role === "admin" ? "administration" : role === "facilitator" ? "studio" : "learning"}</button></div>

        <div className="stat-grid">
          <button onClick={() => selectView("learning")}><span className="stat-icon navy"><BookOpen /></span><div><strong>{role === "learner" ? enrolledCodes.length : 6}</strong><span>{role === "learner" ? "My enrolments" : "Active microcredentials"}</span></div><small>{role === "learner" ? "Instant access to open courses" : "3 sandbox courses included"}</small></button>
          <button onClick={() => toast.info("Weekly activity report opened", { description: "4 hours 30 minutes across three microcredentials." })}><span className="stat-icon gold"><Clock3 /></span><div><strong>4.5h</strong><span>Learning this week</span></div><small>+45 min from last week</small></button>
          <button onClick={() => selectView("assessments")}><span className="stat-icon teal"><FileCheck2 /></span><div><strong>2</strong><span>Assessments due</span></div><small>Next due 28 Aug</small></button>
          <button onClick={() => selectView("live")}><span className="stat-icon sky"><CalendarDays /></span><div><strong>3</strong><span>Live sessions</span></div><small>One tomorrow</small></button>
        </div>

        <Tabs value={active} onValueChange={setActive} className="content-tabs">
          <TabsList variant="line" className="mobile-tabs" aria-label="Dashboard sections"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="learning">Learning</TabsTrigger><TabsTrigger value="live">Live</TabsTrigger><TabsTrigger value="assessments">Tasks</TabsTrigger></TabsList>
          <TabsContent value="overview"><div className="main-grid">
            <div className="panel course-panel"><div className="panel-heading"><div><p className="eyebrow">CURRENT ENROLMENTS</p><h2>Continue learning</h2></div><button onClick={() => selectView("learning")}>View all <ChevronRight size={16} /></button></div><div className="course-list">{filteredCourses.map((course) => <CourseRow key={course.code} course={course} onOpen={() => setSelectedCourse(course)} />)}{filteredCourses.length === 0 && <div className="empty-state">No enrolled microcredentials match “{query}”.</div>}</div></div>
            <div className="panel schedule-panel"><div className="panel-heading"><div><p className="eyebrow">UPCOMING</p><h2>Live learning</h2></div><button onClick={() => selectView("live")}>Calendar <ChevronRight size={16} /></button></div><div className="session-list">{liveSessions.slice(0, 2).map((session) => <SessionRow key={session.title} session={session} />)}</div></div>
          </div></TabsContent>
          <TabsContent value="learning"><div className="learning-stack"><div className="page-panel"><div className="page-title"><div><p className="eyebrow">ASYNCHRONOUS LEARNING</p><h2>{role === "learner" ? "My microcredentials" : "Microcredential catalogue"}</h2><p>Work through course materials, activities and assessments at your pace.</p></div><label className="inline-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a course" /></label></div><div className="course-card-grid">{filteredCourses.map((course) => <CourseCard key={course.code} course={course} onOpen={() => setSelectedCourse(course)} />)}{filteredCourses.length === 0 && <div className="empty-state wide">{role === "learner" ? "You have not enrolled in a course yet. Choose an open course below." : "No course matches your search."}</div>}</div></div>{role === "learner" && <OpenCourseCatalog courses={allCourses} enrolledCodes={enrolledCodes} query={query} onEnrol={enrolCourse} onOpen={setSelectedCourse} />}</div></TabsContent>
          <TabsContent value="certificates"><CertificateWallet /></TabsContent>
          <TabsContent value="live"><div className="page-panel"><div className="page-title"><div><p className="eyebrow">SYNCHRONOUS LEARNING</p><h2>Live sessions</h2><p>Join scheduled classes, clinics and academic discussions.</p></div><button className="secondary-action" onClick={downloadCalendar}><CalendarDays size={17} /> Add calendar feed</button></div><div className="live-grid">{liveSessions.map((session) => <LiveCard key={session.title} session={session} onOpen={() => setSelectedSession(session)} />)}</div></div></TabsContent>
          <TabsContent value="assessments"><Assessments onOpen={() => setUtility("assessment")} /></TabsContent>
          <TabsContent value="colab"><ColabWorkspace role={role} email={account.profile.email} /></TabsContent>
          <TabsContent value="virtual_labs"><VirtualLabsWorkspace role={role} /></TabsContent>
          <TabsContent value="discussions"><Discussions /></TabsContent>
          <TabsContent value="facilitator"><FacilitatorStudio query={resourceQuery} setQuery={setResourceQuery} /></TabsContent>
          <TabsContent value="verification"><IdentityRegister /></TabsContent>
          <TabsContent value="admin"><AdminPortal onOpenRegister={() => selectView("verification")} /></TabsContent>
          <TabsContent value="course_admin"><CourseApprovalPanel /></TabsContent>
          <TabsContent value="testing"><TestingSandbox onCourse={(course) => { setSelectedCourse(course); setLessonStage("content"); }} onLive={() => setSelectedSession(liveSessions[0])} onAssessment={() => setUtility("assessment")} onFacilitator={() => selectView("facilitator")} /></TabsContent>
        </Tabs>

        <Dialog open={Boolean(selectedCourse)} onOpenChange={(open) => !open && setSelectedCourse(null)}>
          <DialogContent className="learning-dialog">
            <DialogHeader><p className="eyebrow">{selectedCourse?.code}</p><DialogTitle>{selectedCourse?.title}</DialogTitle><DialogDescription>{selectedCourse?.school}</DialogDescription></DialogHeader>
            {selectedCourse?.published ? <PublishedCourseExperience course={selectedCourse} learner={account.profile} onOpenActivity={(activity) => { if (activity.kind === "virtual_lab" && activity.practicalId) sessionStorage.setItem("ucc-open-practical", activity.practicalId); setSelectedCourse(null); selectView(activity.kind === "colab" ? "colab" : "virtual_labs"); }} /> : <>
            <div className="module-progress"><div><span>Course progress</span><b>{selectedCourse?.progress}%</b></div><Progress value={selectedCourse?.progress ?? 0} /></div>
            {lessonStage === "content" && <><div className="lesson-tabs"><button className={activityMode === "watch" ? "active" : ""} onClick={() => setActivityMode("watch")}><Video /> Watch</button><button className={activityMode === "read" ? "active" : ""} onClick={() => setActivityMode("read")}><FileText /> Read</button><button className={activityMode === "code" ? "active" : ""} onClick={() => setActivityMode("code")}><Code2 /> Code</button></div>{activityMode === "watch" && <div className="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/aircAruvnKk" title="Open learning video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>}{activityMode === "read" && <article className="reading-frame"><p className="eyebrow">OPEN READING</p><h3>Assessment-led certification</h3><p>A credible microcredential certifies demonstrated learning rather than attendance. Learning outcomes, authentic assessment and recorded decisions provide the evidence needed for recognition and progression.</p></article>}{activityMode === "code" && <div className="code-frame"><span>practice.js</span><textarea defaultValue={'const credential = {\n  outcomes: true,\n  assessed: true,\n  stackable: true\n};\n\nconsole.log(credential);'} aria-label="Practice code editor" /></div>}<p className="activity-note">Pause, replay and take notes as needed. The short knowledge check must be passed before the next activity unlocks.</p><button className="dialog-primary" onClick={() => setLessonStage("check")}><FileCheck2 size={17} /> Pause and check understanding</button></>}
            {lessonStage === "check" && <div className="knowledge-check"><span className="check-count">REQUIRED CHECK · 1 OF 1</span><h3>Which feature makes a microcredential academically trustworthy?</h3>{["A short completion time", "Assessed learning outcomes", "A social-media badge", "An unrestricted open link"].map((option) => <label key={option} className={answer === option ? "chosen" : ""}><input type="radio" name="knowledge-check" value={option} checked={answer === option} onChange={(event) => { setAnswer(event.target.value); setAnswerState("idle"); }} />{option}</label>)}{answerState === "incorrect" && <p className="feedback error">Not quite. Review the role of assessment and try again.</p>}{answerState === "correct" && <p className="feedback success">Correct. The next learning activity is now unlocked.</p>}<button className="dialog-primary" disabled={!answer} onClick={() => { if (answer === "Assessed learning outcomes") { setAnswerState("correct"); setLessonStage("complete"); } else setAnswerState("incorrect"); }}><FileCheck2 size={17} /> Submit answer</button><details><summary>Optional essay reflection</summary><textarea placeholder="Explain how authentic assessment could work in your professional context…" /></details></div>}
            {lessonStage === "complete" && <div className="lesson-complete"><CheckCircle2 /><h3>Checkpoint passed</h3><p>Your result has been recorded. You may now continue to the next learning activity.</p><button className="dialog-primary" onClick={() => { setLessonStage("content"); setAnswer(""); setAnswerState("idle"); setCompleted((items) => items.map((item, index) => index === 2 ? true : item)); }}><CirclePlay size={17} /> Continue to next activity</button></div>}</>}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(selectedSession)} onOpenChange={(open) => !open && setSelectedSession(null)}>
          <DialogContent className="session-dialog">
            <DialogHeader><p className="eyebrow">LIVE LEARNING ROOM</p><DialogTitle>{selectedSession?.title}</DialogTitle><DialogDescription>{selectedSession?.course}</DialogDescription></DialogHeader>
            <div className="session-summary"><CalendarDays /><div><b>{selectedSession?.day} {selectedSession?.month} 2026</b><span>{selectedSession?.time}</span></div></div>
            <div className="session-summary"><Users /><div><b>{selectedSession?.host}</b><span>Session facilitator</span></div></div>
            <p className="room-note">The session room opens 15 minutes before the scheduled start. Attendance is recorded after you join.</p>
            <button className="dialog-primary" onClick={() => toast.success("Live classroom launched", { description: "Attendance tracking is now active." })}><Video size={17} /> Join live classroom</button>
          </DialogContent>
        </Dialog>

        <UtilityDialog value={utility} profile={account.profile} onProfileUpdated={(profile) => setAccount((current) => current ? ({ ...current, profile }) : current)} onClose={() => setUtility(null)} />
        <Toaster position="top-right" richColors />
      </section>
    </main>
  );
}

type CertificateRecord = { certificate_code: string; learner_name: string; course_code: string; course_title: string; issued_at: string };

function makeQrMatrix(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value)).slice(0, 17); const data: number[] = [];
  const bits: number[] = [0,1,0,0]; for (let i = 7; i >= 0; i--) bits.push((bytes.length >>> i) & 1); bytes.forEach((byte) => { for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1); });
  for (let i = 0; i < 4 && bits.length < 152; i++) bits.push(0); while (bits.length % 8) bits.push(0);
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((sum, bit) => (sum << 1) | bit, 0));
  for (let pad = 0; data.length < 19; pad++) data.push(pad % 2 ? 0x11 : 0xec);
  const multiply = (x: number, y: number) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
  const divisor = Array(7).fill(0); divisor[6] = 1; let root = 1;
  for (let i = 0; i < 7; i++) { for (let j = 0; j < 7; j++) { divisor[j] = multiply(divisor[j], root); if (j + 1 < 7) divisor[j] ^= divisor[j + 1]; } root = multiply(root, 2); }
  const ecc = Array(7).fill(0); data.forEach((byte) => { const factor = byte ^ ecc.shift()!; ecc.push(0); for (let i = 0; i < 7; i++) ecc[i] ^= multiply(divisor[i], factor); });
  const codeBits = [...data, ...ecc].flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1));
  const size = 21; const modules = Array.from({ length: size }, () => Array(size).fill(false)); const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) { modules[y][x] = dark; reserved[y][x] = true; } };
  const finder = (left: number, top: number) => { for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) set(left + x, top + y, x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4))); };
  finder(0,0); finder(14,0); finder(0,14); for (let i = 8; i <= 12; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const format = 0x77c4; const formatBit = (i: number) => Boolean((format >>> i) & 1);
  for (let i = 0; i <= 5; i++) set(8, i, formatBit(i)); set(8, 7, formatBit(6)); set(8, 8, formatBit(7)); set(7, 8, formatBit(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, formatBit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, formatBit(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, formatBit(i)); set(8, size - 8, true);
  let bitIndex = 0; let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) { const y = upward ? size - 1 - vert : vert; for (let j = 0; j < 2; j++) { const x = right - j; if (!reserved[y][x]) { let dark = Boolean(codeBits[bitIndex++] ?? 0); if ((x + y) % 2 === 0) dark = !dark; modules[y][x] = dark; } } } upward = !upward; }
  return modules;
}

function VerificationQr({ code }: { code: string }) {
  const matrix = makeQrMatrix(code); return <svg className="certificate-qr" viewBox="0 0 29 29" role="img" aria-label={`Verification QR for ${code}`}><rect width="29" height="29" fill="white" />{matrix.flatMap((row, y) => row.map((dark, x) => dark ? <rect key={`${x}-${y}`} x={x + 4} y={y + 4} width="1" height="1" fill="#062f49" /> : null))}</svg>;
}

function CertificateCard({ certificate }: { certificate: CertificateRecord }) {
  return <article className="certificate-card"><div className="certificate-seal"><GraduationCap /><span>UNIVERSITY OF CAPE COAST</span></div><p className="eyebrow">DIGITAL MICROCREDENTIAL CERTIFICATE</p><h2>Certificate of Completion</h2><p>This certifies that</p><h3>{certificate.learner_name}</h3><p>has successfully completed all required learning activities and assessments for</p><h4>{certificate.course_title}</h4><div className="certificate-meta"><span><b>Course code</b>{certificate.course_code}</span><span><b>Issued</b>{new Date(certificate.issued_at).toLocaleDateString()}</span><span><b>Verification</b>{certificate.certificate_code}</span></div><div className="certificate-verify"><VerificationQr code={certificate.certificate_code} /><div><QrCode /><b>Scan or record verification code</b><span>{certificate.certificate_code}</span></div></div><button className="secondary-action certificate-print" onClick={() => window.print()}><Award /> Print certificate</button></article>;
}

function CertificateWallet() {
  const [items, setItems] = useState<CertificateRecord[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/certificates").then((response) => response.json()).then((result: { certificates?: CertificateRecord[] }) => setItems(result.certificates ?? [])).finally(() => setLoading(false)); }, []);
  return <section className="page-panel certificate-wallet"><div className="page-title"><div><p className="eyebrow">VERIFIABLE ACHIEVEMENT</p><h2>My certificates</h2><p>Certificates appear automatically after all required course assessments are passed.</p></div><span className="access-badge"><Award /> {items.length} earned</span></div>{loading && <div className="empty-state">Loading certificates…</div>}<div className="certificate-grid">{items.map((certificate) => <CertificateCard key={certificate.certificate_code} certificate={certificate} />)}{!loading && items.length === 0 && <div className="empty-state">No certificates yet. Complete an active microcredential assessment to earn one.</div>}</div></section>;
}

function youtubeEmbed(url: string, start = 0) { const match = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/); return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?start=${Math.max(0, start)}&autoplay=1` : url; }

function VideoQuestionGate({ question, onReady }: { question: AssessmentQuestion; onReady: () => void }) {
  const [remaining, setRemaining] = useState<number | null>(null); const duration = Math.max(5, Math.min(600, (question.videoEnd ?? 30) - (question.videoStart ?? 0)));
  useEffect(() => { if (remaining === null || remaining <= 0) return; const timer = window.setInterval(() => setRemaining((value) => value === null ? null : value - 1), 1000); return () => window.clearInterval(timer); }, [remaining]);
  useEffect(() => { if (remaining === 0) onReady(); }, [remaining, onReady]);
  return <div className="video-question-gate"><iframe src={youtubeEmbed(question.videoUrl ?? "", question.videoStart)} title={question.prompt} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /><div><b>{question.videoMode === "whole" ? "Watch the required video" : `Watch the required segment: ${question.videoStart ?? 0}s–${question.videoEnd ?? 30}s`}</b><span>{remaining === null ? "Questions remain hidden until the required viewing begins." : remaining > 0 ? `${remaining} seconds remaining before questions open` : "Required viewing completed"}</span><button onClick={() => setRemaining(duration)} disabled={remaining !== null && remaining > 0}><CirclePlay /> {remaining && remaining > 0 ? "Viewing in progress…" : "Start required viewing"}</button></div></div>;
}

function PairAnswer({ question, value, onChange }: { question: AssessmentQuestion; value: Record<string, string>; onChange: (value: Record<string, string>) => void }) {
  const choices = [...(question.pairs ?? []).map((pair) => pair.right)].reverse();
  if (question.type === "Drag and drop") return <div className="drag-question"><div className="drag-options">{choices.map((choice) => <button key={choice} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", choice)}><GripVertical />{choice}</button>)}</div>{(question.pairs ?? []).map((pair) => <div key={pair.left} className="drop-pair"><b>{pair.left}</b><span onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onChange({ ...value, [pair.left]: event.dataTransfer.getData("text/plain") }); }}>{value[pair.left] || "Drop the matching answer here"}</span></div>)}</div>;
  return <div className="matching-question">{(question.pairs ?? []).map((pair) => <label key={pair.left}>{question.type === "Picture matching" && pair.image ? <img src={pair.image} alt="Question matching prompt" /> : <b>{pair.left}</b>}<select value={value[pair.left] ?? ""} onChange={(event) => onChange({ ...value, [pair.left]: event.target.value })}><option value="">Choose match</option>{choices.map((choice) => <option key={choice}>{choice}</option>)}</select></label>)}</div>;
}

type WhiteboardPoint = { x: number; y: number; t: number };
type HandwritingStrokeApi = { addPoint: (point: WhiteboardPoint) => void };
type HandwritingDrawingApi = { addStroke: (stroke: HandwritingStrokeApi) => void; getPrediction: () => Promise<{ text: string }[]> };
type HandwritingRecognizerApi = { startDrawing: (hints?: { recognitionType?: "text" }) => HandwritingDrawingApi; finish: () => void };

function MathWhiteboard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<WhiteboardPoint[][]>([]);
  const activeStrokeRef = useRef<WhiteboardPoint[] | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [recognising, setRecognising] = useState(false);
  const [message, setMessage] = useState("Write your mathematical working with a mouse, finger or stylus.");
  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rectangle = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(rectangle.width * ratio) || canvas.height !== Math.round(rectangle.height * ratio)) { canvas.width = Math.round(rectangle.width * ratio); canvas.height = Math.round(rectangle.height * ratio); }
    const context = canvas.getContext("2d"); if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, rectangle.width, rectangle.height);
    context.strokeStyle = "#082f44"; context.lineWidth = 2.4; context.lineCap = "round"; context.lineJoin = "round";
    strokesRef.current.forEach((stroke) => { if (stroke.length < 2) return; context.beginPath(); context.moveTo(stroke[0].x, stroke[0].y); stroke.slice(1).forEach((point) => context.lineTo(point.x, point.y)); context.stroke(); });
  };
  useEffect(() => { draw(); const resize = () => draw(); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): WhiteboardPoint => { const rectangle = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rectangle.left, y: event.clientY - rectangle.top, t: performance.now() }; };
  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const stroke = [pointFromEvent(event)]; strokesRef.current.push(stroke); activeStrokeRef.current = stroke; draw(); };
  const extendStroke = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!activeStrokeRef.current) return; event.preventDefault(); activeStrokeRef.current.push(pointFromEvent(event)); draw(); };
  const finishStroke = () => { if (!activeStrokeRef.current) return; activeStrokeRef.current = null; setStrokeCount(strokesRef.current.length); };
  const undo = () => { strokesRef.current.pop(); setStrokeCount(strokesRef.current.length); draw(); setMessage("Last stroke removed."); };
  const clear = () => { strokesRef.current = []; activeStrokeRef.current = null; setStrokeCount(0); onChange(""); draw(); setMessage("Whiteboard cleared."); };
  const recognise = async () => {
    if (!strokesRef.current.length) return setMessage("Write on the whiteboard before converting it to text.");
    const handwritingNavigator = navigator as Navigator & { createHandwritingRecognizer?: (constraints: { languages: string[] }) => Promise<HandwritingRecognizerApi> };
    const strokeConstructor = (window as unknown as { HandwritingStroke?: new () => HandwritingStrokeApi }).HandwritingStroke;
    if (!handwritingNavigator.createHandwritingRecognizer || !strokeConstructor) { setMessage("Automatic handwriting recognition is not available in this browser. Type the transcription below while keeping your written working visible."); return; }
    setRecognising(true); setMessage("Converting handwriting to editable text…");
    let recognizer: HandwritingRecognizerApi | null = null;
    try {
      recognizer = await handwritingNavigator.createHandwritingRecognizer({ languages: ["en"] });
      const drawing = recognizer.startDrawing({ recognitionType: "text" });
      strokesRef.current.forEach((points) => { const stroke = new strokeConstructor(); points.forEach((point) => stroke.addPoint(point)); drawing.addStroke(stroke); });
      const predictions = await drawing.getPrediction(); const transcription = predictions[0]?.text?.trim() ?? "";
      if (transcription) { onChange(transcription); setMessage("Handwriting converted. Check and correct the transcription before submitting."); }
      else setMessage("No reliable transcription was returned. Type the mathematical answer below.");
    } catch { setMessage("This device could not convert the handwriting. Type the transcription below while keeping your working visible."); }
    finally { recognizer?.finish(); setRecognising(false); }
  };
  return <section className="math-whiteboard"><header><div><span><Sigma /></span><div><b>Mathematical working whiteboard</b><p>Show each step, then convert the handwriting into an editable answer.</p></div></div><small>{strokeCount} stroke{strokeCount === 1 ? "" : "s"}</small></header><div className="whiteboard-canvas-wrap"><canvas ref={canvasRef} aria-label="Whiteboard for handwritten mathematical working" onPointerDown={beginStroke} onPointerMove={extendStroke} onPointerUp={finishStroke} onPointerCancel={finishStroke} onPointerLeave={finishStroke} /></div><div className="whiteboard-tools"><button type="button" onClick={undo} disabled={!strokeCount}><Undo2 /> Undo</button><button type="button" onClick={clear} disabled={!strokeCount}>Clear board</button><button type="button" className="recognise" onClick={recognise} disabled={recognising}><Pencil /> {recognising ? "Converting…" : "Convert handwriting to text"}</button></div><p className="whiteboard-message" aria-live="polite">{message}</p><label>Editable mathematical answer / transcription<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Converted handwriting appears here. You can also type or correct symbols and equations." /></label></section>;
}

function VideoTranscriptDialog({ material, onClose }: { material: CourseMaterial | null; onClose: () => void }) {
  if (!material) return null;
  const showTranscript = Boolean(material.transcript && material.transcriptPublished !== false);
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="video-transcript-dialog"><DialogHeader><p className="eyebrow">VIDEO LEARNING MATERIAL</p><DialogTitle>{material.title}</DialogTitle><DialogDescription>{material.source}{showTranscript ? ` · Transcript language: ${material.transcriptLanguage ?? "Not specified"}` : " · Video only"}</DialogDescription></DialogHeader><div className={showTranscript ? "video-transcript-layout" : "video-transcript-layout video-only"}><div className="transcript-video"><iframe src={material.url} title={material.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /><button className="frame-fallback" onClick={() => material.externalUrl && window.open(material.externalUrl, "_blank", "noopener,noreferrer")}>Open video on YouTube</button></div>{showTranscript && <section className="learner-transcript"><header><div><FileText /><b>Facilitator-reviewed transcript</b></div><span>{material.transcript?.split(/\s+/).filter(Boolean).length ?? 0} words</span></header><pre>{material.transcript}</pre></section>}</div></DialogContent></Dialog>;
}

function PublishedCourseExperience({ course, learner, onOpenActivity }: { course: Course; learner: AccountProfile; onOpenActivity: (activity: CourseActivity) => void }) {
  const questions = course.assessmentConfig?.questions ?? []; const [stage, setStage] = useState<"materials" | "assessment" | "result">("materials"); const [answers, setAnswers] = useState<Record<string, unknown>>({}); const [videoReady, setVideoReady] = useState<Record<string, boolean>>({}); const [score, setScore] = useState<number | null>(null); const [certificate, setCertificate] = useState<CertificateRecord | null>(null); const [submitting, setSubmitting] = useState(false); const [selectedMaterial, setSelectedMaterial] = useState<CourseMaterial | null>(null);
  const submit = async () => { setSubmitting(true); try { const response = await fetch("/api/assessments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseCode: course.code, answers }) }); const result = await response.json() as { score?: number; passed?: boolean; certificate?: CertificateRecord; error?: string }; if (!response.ok) throw new Error(result.error ?? "Assessment could not be submitted."); setScore(result.score ?? 0); setCertificate(result.certificate ?? null); setStage("result"); toast[result.passed ? "success" : "error"](result.passed ? "Assessment passed" : "Pass mark not reached", { description: `Score: ${result.score ?? 0}%` }); } catch (error) { toast.error(error instanceof Error ? error.message : "Assessment could not be submitted."); } finally { setSubmitting(false); } };
  if (stage === "result") return <div className="published-course-result">{certificate ? <CertificateCard certificate={certificate} /> : <div className="lesson-complete"><FileCheck2 /><h3>Assessment result: {score}%</h3><p>Review the learning materials and try the assessment again when ready.</p><button className="dialog-primary" onClick={() => setStage("assessment")}>Try assessment again</button></div>}</div>;
  if (stage === "materials") return <div className="published-course"><div className="published-intro"><p>{course.description}</p><span><BookOpen /> {course.discipline ?? "Interdisciplinary"}</span><span><Users /> {course.facilitatorName}</span></div><div className="published-materials">{(course.materials ?? []).map((material, index) => { const transcriptIncluded = Boolean(material.transcript && material.transcriptPublished !== false); return <article key={`${material.title}-${index}`}><span>{index + 1}</span><div><b>{material.kind}{transcriptIncluded ? " · Transcript included" : ""}</b><h3>{material.title}</h3><p>{material.source}</p></div>{material.kind === "Watch" && material.url ? <button onClick={() => setSelectedMaterial(material)}><CirclePlay /> {transcriptIncluded ? "Open video & transcript" : "Open video"}</button> : <CheckCircle2 />}</article>; })}{(course.activities ?? []).map((activity, index) => <article className="published-programme-activity" key={activity.id}><span>{(course.materials?.length ?? 0) + index + 1}</span><div><b>{activity.kind === "colab" ? "COLAB CODING ACTIVITY" : "INTERACTIVE VIRTUAL PRACTICAL"}{activity.required ? " · Required" : " · Optional"}</b><h3>{activity.title}</h3><p>{activity.instructions} · Pass mark {activity.passMark}% · {activity.attemptsAllowed} attempt{activity.attemptsAllowed === 1 ? "" : "s"}</p></div><button onClick={() => onOpenActivity(activity)}>{activity.kind === "colab" ? <Code2 /> : <FlaskConical />} Open activity</button></article>)}</div><button className="dialog-primary" disabled={!questions.length} onClick={() => setStage("assessment")}><FileCheck2 /> {questions.length ? `Begin ${questions.length}-question assessment` : "Assessment awaiting facilitator"}</button><VideoTranscriptDialog material={selectedMaterial} onClose={() => setSelectedMaterial(null)} /></div>;
  return <div className="published-assessment"><div className="assessment-heading"><span>{questions.length} QUESTIONS</span><h3>Complete every assessment activity</h3><p>Video-gated questions open only after the required whole video or selected segment finishes. Mathematical questions may include a handwriting-enabled working board.</p></div>{questions.map((question, index) => { const isVideo = question.type === "Video question"; const unlocked = !isVideo || videoReady[question.id]; return <article className="learner-question" key={question.id}><span className="question-number">{index + 1}</span><div><small>{question.type} · {question.points} point{question.points === 1 ? "" : "s"}{question.whiteboardEnabled ? " · Whiteboard enabled" : ""}</small>{isVideo && <VideoQuestionGate question={question} onReady={() => setVideoReady((items) => ({ ...items, [question.id]: true }))} />}{unlocked ? <><h3>{question.prompt}</h3>{["Multiple choice", "True / false"].includes(question.type) || (isVideo && question.options.length) ? <div className="learner-options">{question.options.map((option) => <label key={option}><input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswers((items) => ({ ...items, [question.id]: option }))} />{option}</label>)}</div> : ["Matching", "Drag and drop", "Picture matching"].includes(question.type) ? <PairAnswer question={question} value={(answers[question.id] as Record<string,string>) ?? {}} onChange={(value) => setAnswers((items) => ({ ...items, [question.id]: value }))} /> : question.whiteboardEnabled ? <MathWhiteboard value={String(answers[question.id] ?? "")} onChange={(value) => setAnswers((items) => ({ ...items, [question.id]: value }))} /> : <textarea value={String(answers[question.id] ?? "")} onChange={(event) => setAnswers((items) => ({ ...items, [question.id]: event.target.value }))} placeholder={question.type === "Fill in" ? "Type the missing word or phrase" : "Enter your answer"} />}</> : <div className="question-locked"><Video /> Complete the required viewing to reveal this question.</div>}</div></article>; })}<button className="dialog-primary" disabled={submitting || questions.some((question) => answers[question.id] === undefined) || questions.some((question) => question.type === "Video question" && !videoReady[question.id])} onClick={submit}><Award /> {submitting ? "Checking assessment…" : "Submit all assessments"}</button></div>;
}

function PortalLoading() {
  return <main className="access-shell"><section className="access-card loading-card"><div className="brand-mark"><GraduationCap size={28} /></div><p className="eyebrow">UCC MICROCREDENTIALS</p><h1>Opening your learning portal</h1><p>Checking your account and access permissions…</p><div className="loading-bar"><span /></div></section></main>;
}

function PortalAccess({ inviteToken }: { inviteToken: string }) {
  const signInUrl = (portal: PortalRole) => {
    const returnTo = inviteToken ? `/?invite=${encodeURIComponent(inviteToken)}` : `/?portal=${portal}`;
    return `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
  };
  return <main className="access-shell"><section className="access-card access-selector"><div className="access-brand"><div className="brand-mark"><GraduationCap size={28} /></div><div><strong>UCC Microcredentials</strong><span>University of Cape Coast</span></div></div><p className="eyebrow">SECURE PORTAL ACCESS</p><h1>{inviteToken ? "Complete your facilitator invitation." : "Choose your portal."}</h1><p>{inviteToken ? "Sign in with the exact email address invited by the UCC administrator. You will then complete permanent biodata and identity verification." : "Each account opens only the tools permitted for its assigned role. Choose the appropriate access point below."}</p>{inviteToken ? <a className="portal-access-card facilitator invited" href={signInUrl("facilitator")} target="_top"><span className="portal-access-icon"><ShieldCheck /></span><span><b>Complete facilitator setup</b><small>Use the institutional email address named in your invitation.</small></span><ChevronRight /></a> : <div className="portal-role-grid"><a className="portal-access-card learner" href={signInUrl("learner")} target="_top"><span className="portal-access-icon"><BookOpen /></span><span><b>Learner portal</b><small>Create an account, verify your identity and enrol in open courses.</small></span><em>Register or sign in <ChevronRight /></em></a><a className="portal-access-card facilitator" href={signInUrl("facilitator")} target="_top"><span className="portal-access-icon"><ShieldCheck /></span><span><b>Facilitator portal</b><small>Sign in with an administrator-created facilitator account.</small></span><em>Facilitator sign in <ChevronRight /></em></a><a className="portal-access-card admin" href={signInUrl("admin")} target="_top"><span className="portal-access-icon"><Users /></span><span><b>System administrator</b><small>Manage accounts, verification, approvals and platform controls.</small></span><em>Administrator sign in <ChevronRight /></em></a></div>}<small>Role permissions are checked after sign-in. Selecting a portal does not grant access to it.</small></section></main>;
}

function PortalRoleMismatch({ requestedRole, email }: { requestedRole: "facilitator" | "admin"; email: string }) {
  const title = requestedRole === "admin" ? "System administrator access required." : "Facilitator access required.";
  const guidance = requestedRole === "admin" ? "This email is not assigned to an active system-administrator account. Sign out and use the administrator email configured for this platform." : "This email is not assigned to an active facilitator account. Ask a system administrator to create your facilitator account and send the setup link.";
  return <main className="access-shell"><section className="access-card role-mismatch"><div className="pending-ring"><ShieldCheck /></div><p className="eyebrow">ROLE-PROTECTED PORTAL</p><h1>{title}</h1><p>{guidance}</p><div className="signed-email"><b>Signed-in email</b><span>{email || "Unavailable"}</span></div><a className="access-primary" href="/signout-with-chatgpt?return_to=%2F">Sign out and use another account</a><a className="access-secondary" href="/">Return to portal selection</a></section></main>;
}

function LiveSelfieCapture({ ready, uploading, onCaptured }: { ready: boolean; uploading: boolean; onCaptured: (file: File) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<"idle" | "camera" | "preview">("idle");
  const [preview, setPreview] = useState("");
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const stopStream = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  useEffect(() => () => stopStream(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const startCamera = async () => {
    setError(""); setCapturedFile(null); if (preview) URL.revokeObjectURL(preview); setPreview("");
    if (!navigator.mediaDevices?.getUserMedia) return setError("This browser cannot access a webcam. Use the image-file fallback below.");
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream; setMode("camera");
      requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => setError("The camera preview could not start.")); } });
    } catch { setMode("idle"); setError("Camera access was blocked. Allow webcam permission in the browser, then try again."); }
  };
  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return setError("Wait for the camera image to appear before capturing.");
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setError("The photo could not be captured. Please try again.");
      const file = new File([blob], `ucc-live-selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
      setCapturedFile(file); setPreview(URL.createObjectURL(blob)); stopStream(); setMode("preview");
    }, "image/jpeg", 0.9);
  };
  const closeCamera = () => { stopStream(); setMode("idle"); setCapturedFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(""); };
  const usePhoto = async () => { if (!capturedFile) return; await onCaptured(capturedFile); closeCamera(); };
  const useFileFallback = async (file: File | undefined) => { if (!file) return; setError(""); await onCaptured(file); };
  return <div className={`live-selfie-capture ${ready ? "evidence-ready" : ""}`}><Users /><b>{ready ? "Live selfie received" : "Take a live selfie"}</b><span>The webcam opens here—face forward in good lighting and do not use filters.</span>{mode === "idle" && <button type="button" className="camera-open" onClick={startCamera}><Video /> Open webcam</button>}{mode === "camera" && <div className="camera-stage"><video ref={videoRef} autoPlay muted playsInline aria-label="Live front-camera preview" /><div className="camera-actions"><button type="button" className="camera-cancel" onClick={closeCamera}>Cancel</button><button type="button" className="camera-capture" onClick={capture}><Video /> Capture photo</button></div></div>}{mode === "preview" && preview && <div className="camera-stage"><img src={preview} alt="Captured live selfie preview" /><div className="camera-actions"><button type="button" className="camera-cancel" onClick={startCamera}>Retake</button><button type="button" className="camera-capture" disabled={uploading} onClick={usePhoto}><CheckCircle2 /> {uploading ? "Securing photo…" : "Use this photo"}</button></div></div>}{error && <em className="camera-error">{error}</em>}<label className="selfie-fallback">Camera unavailable? Upload an image instead<input type="file" accept="image/jpeg,image/png" onChange={(event) => useFileFallback(event.target.files?.[0])} /></label></div>;
}

function IdentityRegistration({ role, initialName, email, inviteToken = "", onComplete }: { role: "learner" | "facilitator"; initialName: string; email: string; inviteToken?: string; onComplete: (profile: AccountProfile) => void }) {
  const [form, setForm] = useState({ fullName: initialName, dateOfBirth: "", gender: "", nationality: "Ghanaian", phone: "", address: "", idType: "Ghana Card", idNumber: "", consent: false });
  const [idDocumentKey, setIdDocumentKey] = useState("");
  const [selfieKey, setSelfieKey] = useState("");
  const [uploading, setUploading] = useState<"id" | "selfie" | null>(null);
  const [saving, setSaving] = useState(false);
  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const uploadIdentityFile = async (file: File | undefined, kind: "id" | "selfie") => {
    if (!file) return;
    setUploading(kind);
    const body = new FormData(); body.append("file", file); body.append("kind", kind === "id" ? "national-id" : "selfie");
    try {
      const response = await fetch("/api/identity-uploads", { method: "POST", body });
      const result = await response.json() as { key?: string; error?: string };
      if (!response.ok || !result.key) throw new Error(result.error ?? "Identity evidence could not be uploaded.");
      if (kind === "id") setIdDocumentKey(result.key); else setSelfieKey(result.key);
      toast.success(kind === "id" ? "National ID uploaded" : "Live photo captured", { description: "The file is ready for restricted UCC verification." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Identity evidence could not be uploaded."); }
    finally { setUploading(null); }
  };
  const submit = async () => {
    const required = [form.fullName, form.dateOfBirth, form.gender, form.nationality, form.phone, form.address, form.idType, form.idNumber, idDocumentKey, selfieKey];
    if (required.some((value) => !value.trim()) || !form.consent) return toast.error("Complete every field, both identity uploads and consent.");
    if (role === "facilitator" && !inviteToken) return toast.error("Open the original facilitator setup link before continuing.");
    setSaving(true);
    const endpoint = role === "learner" ? "/api/auth/session" : "/api/auth/facilitator-onboarding";
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, token: inviteToken, idLast4: form.idNumber.slice(-4), idDocumentKey, selfieKey }) });
      const result = await response.json() as { profile?: AccountProfile; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error ?? "Identity registration could not be completed.");
      onComplete(result.profile);
      toast.success("Identity evidence submitted", { description: "UCC verification is required before portal access is activated." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Identity registration could not be completed."); }
    finally { setSaving(false); }
  };
  return <main className="access-shell identity-access"><section className="access-card identity-card"><div className="access-brand"><div className="brand-mark"><GraduationCap size={28} /></div><div><strong>{role === "learner" ? "Create learner account" : "Complete facilitator setup"}</strong><span>Identity-protected UCC access</span></div></div><p className="eyebrow">BIO DATA AND IDENTITY VERIFICATION</p><h1>Confirm who you are.</h1><p>Enter permanent biographical details, upload a valid national ID and take a current front-facing photo. Only authorised UCC reviewers can compare the evidence.</p><div className="identity-form"><section><h2>1 · Personal information</h2><div className="identity-grid"><label>Full legal name<input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} /></label><label>Verified sign-in email<input value={email} readOnly /></label><label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} /></label><label>Gender<select value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label><label>Nationality<input value={form.nationality} onChange={(event) => update("nationality", event.target.value)} /></label><label>Phone number<input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+233…" /></label><label className="full-field">Residential address<textarea value={form.address} onChange={(event) => update("address", event.target.value)} /></label></div></section><section><h2>2 · National identification</h2><div className="identity-grid"><label>ID type<select value={form.idType} onChange={(event) => update("idType", event.target.value)}><option>Ghana Card</option><option>Passport</option><option>National ID</option></select></label><label>ID number<input value={form.idNumber} onChange={(event) => update("idNumber", event.target.value)} placeholder="Stored only as the final four digits" /></label></div><div className="evidence-grid"><label className={idDocumentKey ? "evidence-ready" : ""}><FileText /><b>{idDocumentKey ? "National ID received" : "Upload national ID"}</b><span>Clear front image or PDF · maximum 8 MB</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => uploadIdentityFile(event.target.files?.[0], "id")} />{uploading === "id" && <em>Uploading securely…</em>}</label><LiveSelfieCapture ready={Boolean(selfieKey)} uploading={uploading === "selfie"} onCaptured={(file) => uploadIdentityFile(file, "selfie")} /></div></section>{role === "facilitator" && <section className="signin-security"><ShieldCheck /><div><h2>Permanent sign-in security</h2><p>Your permanent profile is bound to <b>{email}</b>. Password and account recovery remain with the verified sign-in provider, so the platform never stores a readable password.</p></div></section>}<label className="identity-consent"><input type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)} /><span>I consent to restricted processing of my ID and facial image for UCC identity verification. I understand that access remains pending until an authorised reviewer records a decision.</span></label><button className="access-primary" disabled={saving || Boolean(uploading)} onClick={submit}><ShieldCheck /> {saving ? "Submitting for verification…" : `Submit ${role} identity for review`}</button></div></section></main>;
}

function VerificationPending({ role, email }: { role: PortalRole; email: string }) {
  return <main className="access-shell"><section className="access-card verification-wait"><div className="pending-ring"><ShieldCheck /></div><p className="eyebrow">IDENTITY REVIEW PENDING</p><h1>Your {role} details were submitted.</h1><p>An authorised UCC administrator must compare the national-ID portrait with the live photo before access is activated for <b>{email}</b>.</p><div className="verification-steps"><span className="done">1</span><b>Bio data received</b><span className="done">2</span><b>ID and live photo secured</b><span>3</span><b>UCC reviewer decision pending</b></div><a className="access-primary" href="/signout-with-chatgpt?return_to=%2F">Sign out</a></section></main>;
}

function SuspendedAccess({ email, status }: { email: string; status: string }) {
  return <main className="access-shell"><section className="access-card"><ShieldCheck className="suspended-icon" /><p className="eyebrow">ACCOUNT RESTRICTED</p><h1>{status === "rejected" ? "Identity verification was not approved." : "This portal account is suspended."}</h1><p>Contact the UCC Microcredentials system administrator for assistance with <b>{email}</b>.</p><a className="access-primary" href="/signout-with-chatgpt?return_to=%2F">Sign out</a></section></main>;
}

function OpenCourseCatalog({ courses: catalogue, enrolledCodes, query, onEnrol, onOpen }: { courses: Course[]; enrolledCodes: string[]; query: string; onEnrol: (code: string) => void; onOpen: (course: Course) => void }) {
  const [selectedDiscipline, setSelectedDiscipline] = useState("All disciplines");
  const presentDisciplines = disciplines.filter((discipline) => catalogue.some((course) => (course.discipline ?? "Interdisciplinary") === discipline));
  const available = catalogue.filter((course) => {
    const matchesSearch = `${course.title} ${course.code} ${course.facilitatorName ?? ""} ${course.discipline ?? "Interdisciplinary"}`.toLowerCase().includes(query.toLowerCase());
    return matchesSearch && (selectedDiscipline === "All disciplines" || (course.discipline ?? "Interdisciplinary") === selectedDiscipline);
  });
  return <section className="page-panel open-catalog"><div className="page-title"><div><p className="eyebrow">OPEN SELF-ENROLMENT</p><h2>Available courses and programmes</h2><p>Browse active offerings by discipline and enrol immediately. No administrator approval is required.</p></div><span className="open-badge"><CheckCircle2 /> {available.length} open now</span></div><div className="discipline-filter" aria-label="Filter programmes by discipline"><button className={selectedDiscipline === "All disciplines" ? "active" : ""} onClick={() => setSelectedDiscipline("All disciplines")}>All disciplines <span>{catalogue.length}</span></button>{presentDisciplines.map((discipline) => <button key={discipline} className={selectedDiscipline === discipline ? "active" : ""} onClick={() => setSelectedDiscipline(discipline)}>{discipline} <span>{catalogue.filter((course) => (course.discipline ?? "Interdisciplinary") === discipline).length}</span></button>)}</div><div className="catalog-grid">{available.map((course) => { const enrolled = enrolledCodes.includes(course.code); return <article key={course.code}><div className={`catalog-icon ${course.accent}`}><BookOpen /></div><div><span>{course.code}</span><h3>{course.title}</h3><p>{course.school}</p><small><b>{course.discipline ?? "Interdisciplinary"}</b> · Open course · Self-paced access</small></div><button className={enrolled ? "enrolled" : ""} onClick={() => enrolled ? onOpen(course) : onEnrol(course.code)}>{enrolled ? <><CheckCircle2 /> Enrolled — open course</> : <><CirclePlay /> Enrol now</>}</button></article>; })}{available.length === 0 && <div className="empty-state catalog-empty">No open programmes match this discipline and search.</div>}</div></section>;
}

type FacilitatorRecord = { email: string; full_name: string; status: string; identity_status: string; created_at: string };
type VerificationRecord = { email: string; full_name: string; role: string; date_of_birth: string; gender: string; nationality: string; phone: string; address?: string; id_type: string; id_last4: string; status: string; verifier_email?: string | null; created_at: string };
type ReviewerRecord = { email: string; full_name: string; role: string };
type CourseReviewRecord = { id: number; code: string; title: string; discipline: string; description: string; status: string; facilitatorName: string; questionLimit: number; certificateEnabled: boolean; activities?: CourseActivity[] };

function CourseApprovalPanel() {
  const [items, setItems] = useState<CourseReviewRecord[]>([]); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const response = await fetch("/api/courses"); const result = await response.json() as { courses?: CourseReviewRecord[]; error?: string }; if (!response.ok) throw new Error(result.error ?? "Courses could not be loaded."); setItems(result.courses ?? []); } catch (error) { toast.error(error instanceof Error ? error.message : "Courses could not be loaded."); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const review = async (id: number, status: "active" | "rejected") => { const response = await fetch("/api/courses", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) }); const result = await response.json() as { error?: string }; if (!response.ok) return toast.error(result.error ?? "The course decision could not be saved."); toast.success(status === "active" ? "Course activated for learner discovery" : "Course returned to facilitator"); await load(); };
  return <section className="page-panel course-approval-panel"><div className="page-title"><div><p className="eyebrow">ACADEMIC ACTIVATION</p><h2>Facilitator course approvals</h2><p>Review submissions from every facilitator. Only active courses appear in the learner self-enrolment catalogue.</p></div><span className="access-badge"><BookOpen /> {items.filter((course) => course.status === "pending_review").length} pending</span></div>{loading && <div className="empty-state">Loading facilitator courses…</div>}<div className="course-approval-list">{items.map((course) => <article key={course.id}><div><span>{course.code} · {course.discipline} · {course.status.replaceAll("_", " ")}</span><h3>{course.title}</h3><p>{course.facilitatorName} · {course.activities?.length ?? 0} programme activities · up to {course.questionLimit} questions · {course.certificateEnabled ? "QR certificate enabled" : "certificate disabled"}</p></div><div><button className="reject" onClick={() => review(course.id, "rejected")}>Return</button><button className="approve" onClick={() => review(course.id, "active")}><CheckCircle2 /> Activate</button></div></article>)}{!loading && items.length === 0 && <div className="empty-state">No facilitator courses have been submitted.</div>}</div></section>;
}

function AdminPortal({ onOpenRegister }: { onOpenRegister: () => void }) {
  const [facilitators, setFacilitators] = useState<FacilitatorRecord[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invite, setInvite] = useState<{ url: string; email: string; expiresAt: string } | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/facilitators");
      const result = await response.json() as { facilitators?: FacilitatorRecord[]; verifications?: VerificationRecord[]; reviewers?: ReviewerRecord[]; counts?: Record<string, number>; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load administrator records.");
      setFacilitators(result.facilitators ?? []); setVerifications(result.verifications ?? []); setReviewers(result.reviewers ?? []); setCounts(result.counts ?? {});
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load administrator records."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const createFacilitator = async () => {
    if (!fullName.trim() || !email.trim()) return toast.error("Enter the facilitator’s full name and email address.");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/facilitators", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName, email }) });
      const result = await response.json() as { error?: string; inviteUrl?: string; expiresAt?: string };
      if (!response.ok) throw new Error(result.error ?? "The facilitator account could not be created.");
      if (result.inviteUrl && result.expiresAt) setInvite({ url: result.inviteUrl, email, expiresAt: result.expiresAt });
      setFullName(""); setEmail(""); await load();
      toast.success("Facilitator setup link created", { description: "Send the one-time link to the approved facilitator email." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "The facilitator account could not be created."); }
    finally { setSaving(false); }
  };
  const decide = async (emailAddress: string, decision: "approve" | "reject") => {
    const response = await fetch("/api/admin/identity-verifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: emailAddress, decision }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return toast.error(result.error ?? "The verification decision could not be saved.");
    toast.success(decision === "approve" ? "Identity verified and access activated" : "Identity submission rejected");
    await load();
  };
  const copyInvite = async () => { if (!invite) return; await navigator.clipboard.writeText(invite.url); toast.success("Setup link copied"); };
  const assign = async (learnerEmail: string, verifierEmail: string) => {
    if (!verifierEmail) return;
    const response = await fetch("/api/admin/identity-assignments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ learnerEmail, verifierEmail }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return toast.error(result.error ?? "The reviewer could not be assigned.");
    toast.success("Identity case assigned"); await load();
  };
  return <div className="admin-layout"><div className="admin-main-stack"><section className="page-panel"><div className="page-title"><div><p className="eyebrow">SYSTEM ADMINISTRATION</p><h2>User and access management</h2><p>Learners submit identity evidence. Facilitators begin with a one-time administrator invitation.</p></div><span className="access-badge"><ShieldCheck /> Admin protected</span></div><div className="admin-stats"><article><Users /><div><b>{counts.learner ?? 0}</b><span>Learners</span></div></article><article><ShieldCheck /><div><b>{counts.facilitator ?? 0}</b><span>Facilitators</span></div></article><article><FileCheck2 /><div><b>{verifications.length}</b><span>Pending ID reviews</span></div></article></div><div className="admin-table"><div className="admin-table-head"><span>Facilitator</span><span>Status</span><span>Created</span></div>{loading && <div className="empty-state">Loading facilitator accounts…</div>}{!loading && facilitators.map((facilitator) => <article key={facilitator.email}><div><b>{facilitator.full_name}</b><span>{facilitator.email}</span></div><em>{facilitator.status.replaceAll("_", " ")}</em><time>{new Date(facilitator.created_at).toLocaleDateString()}</time></article>)}{!loading && facilitators.length === 0 && <div className="empty-state">No facilitator accounts have been created yet.</div>}</div></section><section className="page-panel verification-panel"><div className="page-title"><div><p className="eyebrow">VERIFICATION ASSIGNMENTS</p><h2>Assign each identity case</h2><p>Only the assigned facilitator—and system administrators—can open the protected ID and live photo.</p></div></div><div className="verification-queue assignment-queue">{verifications.map((record) => <article key={record.email}><div className="verification-person"><span>{record.full_name.split(/\s+/).map((part) => part[0]).slice(0,2).join("")}</span><div><b>{record.full_name}</b><p>{record.role} · {record.email}</p><small>{record.id_type} ending {record.id_last4}</small></div></div><label className="reviewer-select">Assigned reviewer<select value={record.verifier_email ?? ""} onChange={(event) => assign(record.email, event.target.value)}><option value="">Select administrator or facilitator</option>{reviewers.map((reviewer) => <option key={reviewer.email} value={reviewer.email}>{reviewer.full_name} · {reviewer.role}</option>)}</select></label><button className="open-register" onClick={onOpenRegister}><FileCheck2 /> Open identity register</button></article>)}{!loading && verifications.length === 0 && <div className="empty-state">No identity submissions are awaiting assignment.</div>}</div></section></div><aside className="admin-create"><p className="eyebrow">INVITE FACILITATOR</p><h2>Create one-time setup link</h2><p>The facilitator must sign in with this exact email, complete permanent biodata, and submit ID plus a live photo.</p><label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Dr. Esi Mensah" /></label><label>Institutional email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@ucc.edu.gh" /></label><div className="registration-rule"><ShieldCheck /><p><b>Secure sign-in</b>Password and recovery remain with the verified sign-in provider; no readable password is stored here.</p></div><button className="dialog-primary" disabled={saving} onClick={createFacilitator}><Users /> {saving ? "Creating invitation…" : "Create setup invitation"}</button>{invite && <div className="invite-result"><CheckCircle2 /><div><b>Invitation ready for {invite.email}</b><span>Expires {new Date(invite.expiresAt).toLocaleString()}</span></div><button onClick={copyInvite}>Copy link</button><a href={`mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent("UCC Microcredentials facilitator setup")}&body=${encodeURIComponent(`Complete your permanent facilitator profile using this one-time link:\n\n${invite.url}`)}`}>Email link</a></div>}</aside></div>;
}

function CourseRow({ course, onOpen }: { course: Course, onOpen: () => void }) { return <article className="course-row"><div className={`course-swatch ${course.accent}`}><BookOpen size={21} /></div><div className="course-copy"><span>{course.code}</span><h3>{course.title}</h3><small>{course.school}</small></div><div className="course-progress"><div><span>{course.modules}</span><b>{course.progress}%</b></div><Progress value={course.progress} /><button onClick={onOpen}>{course.next} <ChevronRight size={15} /></button></div></article>; }
function CourseCard({ course, onOpen }: { course: Course, onOpen: () => void }) { return <article className="course-card"><div className={`course-card-top ${course.accent}`}><span>{course.code}</span><BookOpen /></div><div className="course-card-body"><small>{course.school}</small><h3>{course.title}</h3><div className="progress-meta"><span>{course.modules}</span><b>{course.progress}%</b></div><Progress value={course.progress} /><button onClick={onOpen}>{course.next}<ChevronRight size={16} /></button></div></article>; }
function SessionRow({ session }: { session: typeof liveSessions[number] }) { return <article className="session-row"><div className="date-tile"><b>{session.day}</b><span>{session.month}</span></div><div><span>{session.status} · {session.time}</span><h3>{session.title}</h3><small>{session.course}</small></div></article>; }
function LiveCard({ session, onOpen }: { session: typeof liveSessions[number], onOpen: () => void }) { return <article className="live-card"><div className="live-meta"><span>{session.status}</span><b>{session.time}</b></div><h3>{session.title}</h3><p>{session.course}</p><small>Facilitator: {session.host}</small><button onClick={onOpen}><Video size={17} /> View session room</button></article>; }

function LearnerColabAssignment({ assignment, onSubmitted }: { assignment: ColabAssignment; onSubmitted: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [sharingLink, setSharingLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const latest = assignment.latestSubmission;
  const attemptsUsed = latest?.attemptNumber ?? 0;
  const attemptsRemaining = Math.max(0, assignment.attemptsAllowed - attemptsUsed);
  const downloadAndOpen = () => {
    window.open(assignment.openUrl, "_blank", "noopener,noreferrer");
    if (!assignment.directOpen) {
      const link = document.createElement("a");
      link.href = `/api/colab/files?assignmentId=${assignment.id}`;
      link.download = assignment.templateFileName;
      link.click();
      toast.info("Notebook downloaded", { description: "In Colab, choose File → Upload notebook and select the downloaded .ipynb file." });
    }
  };
  const submit = async () => {
    if (!file && !sharingLink.trim()) return toast.error("Upload the completed notebook or paste its Colab sharing link.");
    if (file && sharingLink.trim()) return toast.error("Choose one submission method: file or sharing link.");
    setSubmitting(true);
    try {
      const body = new FormData(); body.append("assignmentId", String(assignment.id));
      if (file) body.append("notebook", file); else body.append("sharingLink", sharingLink.trim());
      const response = await fetch("/api/colab/submissions", { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The notebook could not be submitted.");
      setFile(null); setSharingLink("");
      toast.success("Colab work submitted", { description: "Your facilitator can now assess the saved notebook evidence." });
      await onSubmitted();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The notebook could not be submitted."); }
    finally { setSubmitting(false); }
  };
  return <article className="colab-assignment-card"><header><span className="colab-mark"><Code2 /></span><div><small>{assignment.courseCode} · FREE GOOGLE COLAB</small><h3>{assignment.title}</h3><p>{assignment.courseTitle}</p></div><em className={latest?.passed ? "passed" : latest ? latest.status : "not-started"}>{latest?.passed ? "Passed" : latest ? latest.status.replaceAll("_", " ") : "Not submitted"}</em></header><p className="colab-instructions">{assignment.instructions}</p><div className="colab-meta"><span><b>Due</b>{assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : "No deadline"}</span><span><b>Pass requirement</b>{assignment.passMark}%</span><span><b>Attempts</b>{attemptsUsed} used · {attemptsRemaining} remaining</span><span><b>Template</b>{assignment.templateFileName}</span></div><details className="colab-rubric"><summary>Assessment rubric</summary><p>{assignment.rubric}</p></details><div className="colab-launch"><a href={`/api/colab/files?assignmentId=${assignment.id}`} download><FileText /> Download template</a><button onClick={downloadAndOpen}><CirclePlay /> {assignment.directOpen ? "Open directly in free Colab" : "Download & open free Colab"}</button></div>{!assignment.directOpen && <p className="colab-notice">The notebook opens through Colab’s upload screen. Use your personal Google account and select the downloaded template.</p>}{latest && <div className={`colab-result ${latest.passed ? "passed" : ""}`}><FileCheck2 /><div><b>Attempt {latest.attemptNumber} · {latest.mark === null || latest.mark === undefined ? "Awaiting assessment" : `${latest.mark}/${assignment.maxMark}`}</b><p>{latest.feedback || "The facilitator has not provided feedback yet."}</p></div></div>}{attemptsRemaining > 0 && !latest?.passed && <section className="colab-submit"><div><p className="eyebrow">SUBMIT COMPLETED WORK</p><h4>Choose one submission method</h4></div><label className={file ? "selected" : ""}><FileText /><div><b>{file?.name || "Upload completed .ipynb"}</b><span>Maximum 10 MB · permanent assessment copy</span></div><input type="file" accept=".ipynb,application/x-ipynb+json,application/json" onChange={(event) => { setFile(event.target.files?.[0] ?? null); if (event.target.files?.[0]) setSharingLink(""); }} /></label><div className="submission-divider"><span>OR</span></div><label className="colab-link-field"><span>Google Colab or Drive sharing link</span><input type="url" value={sharingLink} onChange={(event) => { setSharingLink(event.target.value); if (event.target.value) setFile(null); }} placeholder="https://colab.research.google.com/drive/…" /></label><p className="colab-notice">For a link submission, set the notebook to “Anyone with the link can view” or share it with your facilitator.</p><button className="dialog-primary" disabled={submitting || (!file && !sharingLink.trim())} onClick={submit}><FileCheck2 /> {submitting ? "Submitting notebook…" : `Submit attempt ${attemptsUsed + 1}`}</button></section>}</article>;
}

function ColabSubmissionReview({ submission, onAssessed }: { submission: ColabSubmission; onAssessed: () => Promise<void> }) {
  const [mark, setMark] = useState(submission.mark === null || submission.mark === undefined ? "" : String(submission.mark));
  const [feedback, setFeedback] = useState(submission.feedback);
  const [saving, setSaving] = useState(false);
  const decide = async (decision: "assessed" | "resubmit") => {
    setSaving(true);
    try {
      const response = await fetch("/api/colab/submissions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: submission.id, mark: Number(mark), feedback, decision }) });
      const result = await response.json() as { error?: string; passed?: boolean; courseCompleted?: boolean };
      if (!response.ok) throw new Error(result.error ?? "The assessment decision could not be saved.");
      toast.success(decision === "resubmit" ? "Resubmission requested" : result.passed ? "Notebook passed" : "Assessment recorded", { description: result.courseCompleted ? "All Colab requirements are complete and the course completion record was updated." : "The learner’s mark and feedback are now available." });
      await onAssessed();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The assessment decision could not be saved."); }
    finally { setSaving(false); }
  };
  return <article className="colab-review-row"><header><div><small>{submission.courseCode} · ATTEMPT {submission.attemptNumber}</small><h3>{submission.learnerName || submission.learnerEmail}</h3><p>{submission.assignmentTitle}</p></div><em className={submission.passed ? "passed" : submission.status}>{submission.passed ? "Passed" : submission.status}</em></header><div className="colab-evidence"><span><b>Submitted</b>{new Date(submission.submittedAt).toLocaleString()}</span>{submission.submissionType === "file" ? <a href={`/api/colab/files?submissionId=${submission.id}`} download><FileText /> Download {submission.notebookFileName}</a> : <a href={submission.notebookUrl ?? "#"} target="_blank" rel="noreferrer"><CirclePlay /> Open sharing link</a>}</div><div className="colab-grading"><label>Mark<input type="number" min="0" max={submission.maxMark} value={mark} onChange={(event) => setMark(event.target.value)} /><span>out of {submission.maxMark} · pass threshold {submission.passMark}%</span></label><label>Feedback to learner<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Explain what was demonstrated and what the learner should improve next…" /></label></div><footer><button disabled={saving} className="secondary-action" onClick={() => decide("resubmit")}>Request resubmission</button><button disabled={saving} className="dialog-primary" onClick={() => decide("assessed")}><CheckCircle2 /> {saving ? "Saving…" : "Save assessment"}</button></footer></article>;
}

function ColabWorkspace({ role, email }: { role: PortalRole; email: string }) {
  const [assignments, setAssignments] = useState<ColabAssignment[]>([]);
  const [submissions, setSubmissions] = useState<ColabSubmission[]>([]);
  const [courseOptions, setCourseOptions] = useState<{ code: string; title: string; status: string; createdByEmail: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ courseCode: "", title: "", instructions: "", rubric: "", templateUrl: "", dueAt: "", maxMark: "100", passMark: "60", attemptsAllowed: "2" });
  const [notebook, setNotebook] = useState<File | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const requests: Promise<Response>[] = [fetch("/api/colab/assignments"), fetch("/api/colab/submissions")];
      if (role !== "learner") requests.push(fetch("/api/courses"));
      const responses = await Promise.all(requests);
      const assignmentResult = await responses[0].json() as { assignments?: ColabAssignment[]; error?: string };
      const submissionResult = await responses[1].json() as { submissions?: ColabSubmission[]; error?: string };
      if (!responses[0].ok) throw new Error(assignmentResult.error ?? "Colab assignments could not be loaded.");
      if (!responses[1].ok) throw new Error(submissionResult.error ?? "Colab submissions could not be loaded.");
      setAssignments(assignmentResult.assignments ?? []); setSubmissions(submissionResult.submissions ?? []);
      if (responses[2]) {
        const courseResult = await responses[2].json() as { courses?: { code: string; title: string; status: string; createdByEmail: string }[] };
        const options = (courseResult.courses ?? []).filter((course) => course.status === "active" && (role === "admin" || course.createdByEmail === email));
        setCourseOptions(options); setForm((current) => current.courseCode || !options[0] ? current : ({ ...current, courseCode: options[0].code }));
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "The Colab workspace could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { queueMicrotask(() => void load()); }, [role, email]);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const create = async () => {
    if (!notebook) return toast.error("Upload the facilitator’s .ipynb notebook template.");
    setSaving(true);
    try {
      const body = new FormData(); Object.entries(form).forEach(([key, value]) => body.append(key, value)); body.append("notebook", notebook);
      const response = await fetch("/api/colab/assignments", { method: "POST", body });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The Colab assignment could not be published.");
      setForm((current) => ({ ...current, title: "", instructions: "", rubric: "", templateUrl: "", dueAt: "" })); setNotebook(null);
      toast.success("Colab assignment published", { description: "Enrolled learners can now open the notebook in free Colab and submit their work." });
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The Colab assignment could not be published."); }
    finally { setSaving(false); }
  };
  if (role === "learner") return <section className="page-panel colab-workspace"><div className="page-title"><div><p className="eyebrow">FREE GOOGLE COLAB</p><h2>Coding assignments</h2><p>Open your own notebook copy, run the code in Colab, then return here to submit the completed file or sharing link.</p></div><span className="access-badge"><Code2 /> {assignments.length} assignments</span></div>{loading && <div className="empty-state">Loading coding assignments…</div>}<div className="colab-assignment-list">{assignments.map((assignment) => <LearnerColabAssignment key={assignment.id} assignment={assignment} onSubmitted={load} />)}{!loading && assignments.length === 0 && <div className="empty-state">No Colab assignments are available in your enrolled courses yet.</div>}</div></section>;
  return <div className="colab-admin-layout"><section className="page-panel colab-workspace"><div className="page-title"><div><p className="eyebrow">FREE COLAB ASSIGNMENT AUTHORING</p><h2>Publish a notebook activity</h2><p>Learners receive separate Google Colab copies while UCC retains the assessment evidence, marks and completion records.</p></div><span className="access-badge"><Code2 /> Facilitator controlled</span></div><div className="colab-authoring"><div className="form-grid"><label>Active course<select value={form.courseCode} onChange={(event) => update("courseCode", event.target.value)}><option value="">Select your active course</option>{courseOptions.map((course) => <option key={course.code} value={course.code}>{course.code} · {course.title}</option>)}</select></label><label>Assignment title<input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Python data-cleaning notebook" /></label><label>Due date and time<input type="datetime-local" value={form.dueAt} onChange={(event) => update("dueAt", event.target.value)} /></label><label>Permitted attempts<select value={form.attemptsAllowed} onChange={(event) => update("attemptsAllowed", event.target.value)}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label><label>Maximum mark<input type="number" min="1" max="1000" value={form.maxMark} onChange={(event) => update("maxMark", event.target.value)} /></label><label>Pass mark (%)<input type="number" min="1" max="100" value={form.passMark} onChange={(event) => update("passMark", event.target.value)} /></label></div><label>Learner instructions<textarea value={form.instructions} onChange={(event) => update("instructions", event.target.value)} placeholder="Explain what to run, change, interpret and submit…" /></label><label>Assessment rubric<textarea value={form.rubric} onChange={(event) => update("rubric", event.target.value)} placeholder="Allocate marks for correctness, interpretation, code quality and documentation…" /></label><div className="colab-template-grid"><label className={notebook ? "upload-zone selected" : "upload-zone"}><Code2 /><b>{notebook?.name || "Upload master .ipynb notebook"}</b><span>Required · maximum 10 MB</span><input type="file" accept=".ipynb,application/x-ipynb+json,application/json" onChange={(event) => setNotebook(event.target.files?.[0] ?? null)} /></label><label>Optional direct-open link<input type="url" value={form.templateUrl} onChange={(event) => update("templateUrl", event.target.value)} placeholder="GitHub .ipynb or Colab URL" /><span>When omitted, learners download the notebook and upload it into free Colab.</span></label></div><button className="dialog-primary" disabled={saving || !courseOptions.length} onClick={create}><CheckCircle2 /> {saving ? "Publishing assignment…" : "Publish Colab assignment"}</button>{!courseOptions.length && !loading && <p className="colab-notice">An administrator must activate at least one of your courses before a Colab assignment can be published.</p>}</div></section><section className="page-panel colab-register"><div className="page-title"><div><p className="eyebrow">ASSESSMENT REGISTER</p><h2>Learner notebook submissions</h2><p>Review the submitted file or sharing link, apply the rubric and return recorded feedback.</p></div><span className="access-badge"><FileCheck2 /> {submissions.filter((item) => item.status === "submitted").length} awaiting review</span></div>{loading && <div className="empty-state">Loading Colab submissions…</div>}<div className="colab-review-list">{submissions.map((submission) => <ColabSubmissionReview key={submission.id} submission={submission} onAssessed={load} />)}{!loading && submissions.length === 0 && <div className="empty-state">Learner submissions will appear here after the first notebook is submitted.</div>}</div></section><section className="page-panel"><div className="page-title"><div><p className="eyebrow">PUBLISHED NOTEBOOKS</p><h2>Active Colab assignments</h2></div></div><div className="colab-mini-list">{assignments.map((assignment) => <article key={assignment.id}><Code2 /><div><b>{assignment.title}</b><span>{assignment.courseCode} · {assignment.templateFileName}</span></div><em>{assignment.status}</em></article>)}{!loading && assignments.length === 0 && <div className="empty-state">No Colab assignments have been published.</div>}</div></section></div>;
}

function VirtualLabIcon({ discipline }: { discipline: string }) {
  const Icon = discipline === "Nursing Skills" ? HeartPulse : discipline === "Medicine" ? Stethoscope : discipline === "Engineering" ? Wrench : discipline === "Biology" ? Microscope : discipline === "Chemistry" ? Beaker : discipline === "Physics" ? Gauge : FlaskConical;
  return <Icon />;
}

function getLabScene(discipline: string) {
  if (discipline === "Nursing Skills" || discipline === "Medicine") return { src: "/labs/clinical-simulation-room.webp", alt: "University clinical simulation room with a training mannequin, monitor and skills trolley" };
  if (discipline === "Engineering") return { src: "/labs/engineering-electronics-bench.webp", alt: "University engineering laboratory bench with electronic instruments and a training circuit" };
  return { src: "/labs/science-lab-workbench.webp", alt: "University science laboratory bench with glassware, microscope and measurement equipment" };
}

const labHotspots = [{ left: 18, top: 62 }, { left: 43, top: 40 }, { left: 68, top: 63 }, { left: 84, top: 34 }];

function LabEquipmentScene({ practical, selected, onToggle }: { practical: VirtualPractical; selected: string[]; onToggle: (item: string) => void }) {
  const scene = getLabScene(practical.discipline);
  const current = practical.equipment.find((item) => selected.includes(item)) ?? practical.equipment[0];
  return <div className="lab-equipment-scene"><figure className="lab-scene-frame"><img src={scene.src} alt={scene.alt} />{practical.equipment.map((item, index) => { const point = labHotspots[index % labHotspots.length]; const active = selected.includes(item); return <button key={item} type="button" className={active ? "lab-hotspot active" : "lab-hotspot"} style={{ left: `${point.left}%`, top: `${point.top}%` }} onClick={() => onToggle(item)} aria-pressed={active} aria-label={`${active ? "Remove" : "Identify"} ${item}`}><span>{active ? "✓" : index + 1}</span></button>; })}<figcaption>Interactive workstation · select the numbered apparatus</figcaption></figure><aside><p className="eyebrow">APPARATUS INSPECTOR</p><h4>{current}</h4><p>Use the image hotspots or the equipment list. Every required item must be identified before the simulation opens.</p><div className="apparatus-progress"><span style={{ width: `${(selected.length / practical.equipment.length) * 100}%` }} /></div><b>{selected.length} of {practical.equipment.length} identified</b></aside></div>;
}

function LabMeasurementDiagram({ practical, observations, input, output }: { practical: VirtualPractical; observations: LabObservation[]; input: number; output: number }) {
  const samples = [...observations, { trial: "Live", input, result: output, note: "Current model position" }];
  const maxOutput = Math.max(1, practical.parameterMax * practical.resultFactor, ...samples.map((item) => item.result));
  const points = samples.map((item) => { const x = 46 + ((item.input - practical.parameterMin) / Math.max(1, practical.parameterMax - practical.parameterMin)) * 430; const y = 145 - (item.result / maxOutput) * 112; return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ");
  return <div className="lab-data-diagram"><div className="diagram-heading"><div><span>LIVE RESPONSE DIAGRAM</span><b>{practical.parameterLabel} vs {practical.resultLabel}</b></div><em>{observations.length} recorded trial{observations.length === 1 ? "" : "s"}</em></div><svg viewBox="0 0 520 175" role="img" aria-label={`Interactive graph of ${practical.parameterLabel} against ${practical.resultLabel}`}><line x1="46" y1="20" x2="46" y2="145" /><line x1="46" y1="145" x2="490" y2="145" />{[0,1,2,3,4].map((tick) => <line className="grid-line" key={tick} x1="46" y1={145 - tick * 28} x2="490" y2={145 - tick * 28} />)}<polyline points={points} />{samples.map((item, index) => { const [cx, cy] = points.split(" ")[index].split(","); return <circle key={`${item.trial}-${index}`} cx={cx} cy={cy} r={item.trial === "Live" ? 6 : 4} className={item.trial === "Live" ? "live-point" : ""} />; })}<text x="260" y="168">{practical.parameterLabel} ({practical.parameterUnit})</text><text transform="rotate(-90 13 90)" x="13" y="90">{practical.resultLabel} ({practical.resultUnit})</text></svg><div className="diagram-readout"><span><b>{input}</b>{practical.parameterUnit} input</span><ChevronRight /><span><b>{output}</b>{practical.resultUnit} response</span></div></div>;
}

function LabProcedureScene({ practical, sequenceIndex }: { practical: VirtualPractical; sequenceIndex: number }) {
  const scene = getLabScene(practical.discipline);
  return <figure className="procedure-scene-photo"><img src={scene.src} alt={scene.alt} /><div><span>SIMULATED STATION</span><b>{Math.round((sequenceIndex / practical.procedureSteps.length) * 100)}% complete</b></div><ol>{practical.procedureSteps.map((step, index) => <li key={step} className={index < sequenceIndex ? "complete" : index === sequenceIndex ? "current" : ""}><span>{index < sequenceIndex ? "✓" : index + 1}</span>{step}</li>)}</ol></figure>;
}

function VirtualPracticalRunner({ practical, latest, onSubmitted, preview = false, onPreviewComplete }: { practical: VirtualPractical; latest?: VirtualLabSubmission; onSubmitted: () => Promise<void>; preview?: boolean; onPreviewComplete?: () => void }) {
  const initialStage = preview ? 1 : latest?.status === "submitted" ? 8 : latest?.status === "assessed" ? 9 : 1;
  const [stage, setStage] = useState(initialStage);
  const [safetyAnswer, setSafetyAnswer] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [parameter, setParameter] = useState(practical.parameterDefault);
  const [ran, setRan] = useState(false);
  const [checkpointAnswer, setCheckpointAnswer] = useState("");
  const [observations, setObservations] = useState<LabObservation[]>([]);
  const [note, setNote] = useState("");
  const [report, setReport] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const result = Number((parameter * practical.resultFactor).toFixed(2));
  const orderedChoices = [practical.procedureSteps[2], practical.procedureSteps[0], practical.procedureSteps[3], practical.procedureSteps[1]].filter(Boolean);
  const advanceSafety = () => { if (safetyAnswer !== practical.safetyAnswer) return toast.error("Review the safety briefing and try again."); setStage(3); };
  const toggleEquipment = (item: string) => setEquipment((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  const runMeasurement = () => { setRan(true); setObservations((current) => [...current, { trial: `Trial ${current.length + 1}`, input: parameter, result, note: note || "Virtual model run completed" }]); setNote(""); toast.success("Virtual observation recorded"); };
  const chooseProcedureStep = (item: string) => {
    if (item !== practical.procedureSteps[sequenceIndex]) return toast.error("That is not the safest next step. Review the sequence and try again.");
    const next = sequenceIndex + 1; setSequenceIndex(next);
    if (next === practical.procedureSteps.length) { setRan(true); setObservations([{ trial: "Scenario 1", input: parameter, result, note: "Approved sequence completed in the virtual scenario" }]); toast.success("Simulation sequence completed"); }
  };
  const advanceCheckpoint = () => { if (checkpointAnswer !== practical.checkpointAnswer) return toast.error("Not yet. Review the simulation evidence and try again."); setStage(6); };
  const submit = async () => {
    if (report.trim().length < 40) return toast.error("Add a practical report of at least 40 characters.");
    if (!observations.length) return toast.error("Record at least one simulation observation.");
    if (preview) {
      setStage(9);
      onPreviewComplete?.();
      toast.success("Facilitator preview completed", { description: "No learner submission, mark or competency record was created." });
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData(); body.append("practicalId", practical.id); body.append("observations", JSON.stringify(observations)); body.append("answers", JSON.stringify({ safetyAnswer, checkpointAnswer, equipment, sequenceCompleted: ran })); body.append("report", report.trim()); if (evidence) body.append("evidence", evidence);
      const response = await fetch("/api/virtual-labs", { method: "POST", body }); const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The practical could not be submitted.");
      setStage(8); toast.success("Virtual practical submitted", { description: "The facilitator can now review your data, report and optional supervised evidence." }); await onSubmitted();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The practical could not be submitted."); }
    finally { setSubmitting(false); }
  };
  const reset = () => { setStage(1); setSafetyAnswer(""); setEquipment([]); setSequenceIndex(0); setParameter(practical.parameterDefault); setRan(false); setCheckpointAnswer(""); setObservations([]); setNote(""); setReport(""); setEvidence(null); };
  return <div className="practical-runner">{preview && <div className="lab-preview-banner"><Eye /><div><b>Facilitator preview mode</b><p>Work through the activity exactly as a learner would. Nothing entered here is submitted, graded or added to a competency record.</p></div></div>}<div className="lab-disclaimer"><ShieldCheck /><div><b>Complementary virtual practice</b><p>This simulation supports preparation, repetition and assessment. It does not replace required physical laboratory work, clinical placement, supervision or regulatory competency assessment.</p></div></div><div className="lab-stage-track">{["Brief", "Safety", "Equipment", "Simulate", "Checkpoint", "Data", "Report", preview ? "Review" : "Grade", "Debrief"].map((label, index) => <span key={label} className={stage === index + 1 ? "active" : stage > index + 1 ? "complete" : ""}><b>{stage > index + 1 ? "✓" : index + 1}</b>{label}</span>)}</div>
    {stage === 1 && <section className="lab-stage"><p className="eyebrow">OBJECTIVES AND PRE-LAB BRIEFING</p><h3>{practical.title}</h3><p>{practical.focus}</p><ul>{practical.objectives.map((item) => <li key={item}>{item}</li>)}</ul><div className="prelab-note"><ClipboardCheck /><p>Complete the stages in order. Unexpected results must be recorded—not hidden or altered.</p></div><button className="dialog-primary" onClick={() => setStage(2)}>Begin safety assessment <ChevronRight /></button></section>}
    {stage === 2 && <section className="lab-stage"><p className="eyebrow">SAFETY ASSESSMENT</p><h3>{practical.safetyQuestion}</h3><div className="lab-answer-list">{practical.safetyOptions.map((option) => <label key={option} className={safetyAnswer === option ? "selected" : ""}><input type="radio" name={`safety-${practical.id}`} checked={safetyAnswer === option} onChange={() => setSafetyAnswer(option)} />{option}</label>)}</div><button className="dialog-primary" disabled={!safetyAnswer} onClick={advanceSafety}><ShieldCheck /> Check safety decision</button></section>}
    {stage === 3 && <section className="lab-stage"><p className="eyebrow">EQUIPMENT IDENTIFICATION</p><h3>Inspect the workstation and identify every required item</h3><LabEquipmentScene practical={practical} selected={equipment} onToggle={toggleEquipment} /><div className="equipment-grid">{practical.equipment.map((item) => <button key={item} className={equipment.includes(item) ? "selected" : ""} onClick={() => toggleEquipment(item)}><VirtualLabIcon discipline={practical.discipline} /><span>{item}</span>{equipment.includes(item) && <CheckCircle2 />}</button>)}</div><button className="dialog-primary" disabled={equipment.length !== practical.equipment.length} onClick={() => setStage(4)}>Open interactive simulation <ChevronRight /></button></section>}
    {stage === 4 && <section className="lab-stage"><p className="eyebrow">INTERACTIVE SIMULATION</p><h3>{practical.mode === "measurement" ? "Operate the virtual instrument and observe the live response" : "Complete the safest procedure at the simulated station"}</h3>{practical.mode === "measurement" ? <div className="virtual-instrument"><div className="instrument-screen"><Activity /><span>{practical.resultLabel}</span><strong>{result} {practical.resultUnit}</strong></div><label>{practical.parameterLabel}: <b>{parameter} {practical.parameterUnit}</b><input type="range" min={practical.parameterMin} max={practical.parameterMax} value={parameter} onChange={(event) => setParameter(Number(event.target.value))} /></label><label>Observation note<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed and what did you notice?" /></label><button className="secondary-action" onClick={runMeasurement}><Gauge /> Run and record trial</button><LabMeasurementDiagram practical={practical} observations={observations} input={parameter} output={result} /></div> : <div className="procedure-simulator"><LabProcedureScene practical={practical} sequenceIndex={sequenceIndex} /><p>Select the next safest step:</p><div>{orderedChoices.filter((item) => !practical.procedureSteps.slice(0, sequenceIndex).includes(item)).map((item) => <button key={item} onClick={() => chooseProcedureStep(item)}>{item}<ChevronRight /></button>)}</div></div>}<button className="dialog-primary" disabled={!ran} onClick={() => setStage(5)}>Pause and assess understanding <FileCheck2 /></button></section>}
    {stage === 5 && <section className="lab-stage"><p className="eyebrow">PAUSE-AND-ANSWER CHECKPOINT</p><h3>{practical.checkpointQuestion}</h3><div className="lab-answer-list">{practical.checkpointOptions.map((option) => <label key={option} className={checkpointAnswer === option ? "selected" : ""}><input type="radio" name={`checkpoint-${practical.id}`} checked={checkpointAnswer === option} onChange={() => setCheckpointAnswer(option)} />{option}</label>)}</div><button className="dialog-primary" disabled={!checkpointAnswer} onClick={advanceCheckpoint}><FileCheck2 /> Submit checkpoint answer</button></section>}
    {stage === 6 && <section className="lab-stage"><p className="eyebrow">DATA COLLECTION AND CALCULATIONS</p><h3>Recorded observations and response diagram</h3>{practical.mode === "measurement" && <LabMeasurementDiagram practical={practical} observations={observations} input={parameter} output={result} />}<div className="observation-table"><div><b>Trial</b><b>Input</b><b>Result</b><b>Observation</b></div>{observations.map((row, index) => <div key={`${row.trial}-${index}`}><span>{row.trial}</span><span>{row.input} {practical.parameterUnit}</span><span>{row.result} {practical.resultUnit}</span><span>{row.note}</span></div>)}</div>{practical.mode === "measurement" && <button className="secondary-action" onClick={() => setStage(4)}><RotateCcw /> Run another trial</button>}<button className="dialog-primary" onClick={() => setStage(7)}>Prepare practical report <ChevronRight /></button></section>}
    {stage === 7 && <section className="lab-stage"><p className="eyebrow">PRACTICAL REPORT AND EVIDENCE</p><h3>Explain the result and its limitations</h3><label className="lab-report-field">Report<textarea value={report} onChange={(event) => setReport(event.target.value)} placeholder="State the objective, method, observations, calculation or reasoning, conclusion, limitations and what must be confirmed in a real supervised laboratory…" /><span>{report.trim().length} characters · minimum 40</span></label>{!preview && <label className={evidence ? "lab-evidence selected" : "lab-evidence"}><Upload /><div><b>{evidence?.name || "Optional supervised skills evidence"}</b><span>Video, image or PDF · maximum 25 MB</span></div><input type="file" accept="video/*,image/*,application/pdf" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} /></label>}<button className="dialog-primary" disabled={submitting || report.trim().length < 40} onClick={submit}><FileCheck2 /> {preview ? "Complete preview and open debrief" : submitting ? "Submitting practical…" : "Submit for facilitator grading"}</button></section>}
    {stage === 8 && <section className="lab-stage lab-waiting"><Clock3 /><h3>Facilitator assessment pending</h3><p>Your simulation data, checkpoint responses, report and optional supervised evidence are securely recorded. Return after the facilitator has marked the practical.</p>{latest?.status === "resubmit" && <><div className="lab-feedback"><b>Resubmission requested</b><p>{latest.feedback}</p></div><button className="dialog-primary" onClick={reset}>Start resubmission</button></>}</section>}
    {stage === 9 && <section className="lab-stage lab-debrief"><CheckCircle2 /><h3>{preview ? "Facilitator preview completed" : latest?.passed ? "Competency evidence accepted" : "Assessment completed"}</h3>{preview ? <div className="lab-feedback"><b>Design review prompt</b><p>Confirm that the objectives, safety check, equipment, interaction, decision point, data output, learner report and debrief align with your programme outcomes and assessment plan.</p><b>Preview status</b><p>This review was not saved as learner evidence and created no mark or competency decision.</p></div> : <><div className="lab-grade"><strong>{latest?.mark ?? 0}%</strong><span>{latest?.passed ? "Competent in this virtual activity" : "Further development required"}</span></div><div className="lab-feedback"><b>Facilitator feedback</b><p>{latest?.feedback || "No feedback recorded."}</p><b>Competency note</b><p>{latest?.competencyNote || "No competency note recorded."}</p></div></>}<details open><summary>Debriefing guidance</summary><p>{practical.debrief}</p></details><p className="lab-notice">Completion of this virtual activity does not certify independent physical or clinical competence.</p>{(preview || !latest?.passed) && <button className="secondary-action" onClick={reset}><RotateCcw /> {preview ? "Repeat preview" : "Repeat virtual practical"}</button>}</section>}
  </div>;
}

function VirtualLabSubmissionReview({ submission, onUpdated }: { submission: VirtualLabSubmission; onUpdated: () => Promise<void> }) {
  const [mark, setMark] = useState(submission.mark === null || submission.mark === undefined ? "" : String(submission.mark)); const [feedback, setFeedback] = useState(submission.feedback); const [competencyNote, setCompetencyNote] = useState(submission.competencyNote); const [saving, setSaving] = useState(false);
  const decide = async (decision: "competent" | "developing" | "resubmit") => { setSaving(true); try { const response = await fetch("/api/virtual-labs", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: submission.id, mark: Number(mark), feedback, competencyNote, decision }) }); const payload = await response.json() as { error?: string; passed?: boolean }; if (!response.ok) throw new Error(payload.error ?? "The practical assessment could not be saved."); toast.success(decision === "resubmit" ? "Resubmission requested" : payload.passed ? "Competency accepted" : "Development decision recorded"); await onUpdated(); } catch (error) { toast.error(error instanceof Error ? error.message : "The practical assessment could not be saved."); } finally { setSaving(false); } };
  return <article className="lab-review-card"><header><div><small>{submission.discipline} · ATTEMPT {submission.attemptNumber}</small><h3>{submission.learnerName}</h3><p>{submission.practicalTitle}</p></div><em className={submission.passed ? "passed" : submission.status}>{submission.passed ? "competent" : submission.status}</em></header><div className="lab-review-evidence"><span><b>Submitted</b>{new Date(submission.submittedAt).toLocaleString()}</span><span><b>Recorded trials</b>{submission.observations.length}</span>{submission.evidenceFileName && <a href={`/api/virtual-labs/evidence?submissionId=${submission.id}`} target="_blank" rel="noreferrer"><Video /> Open supervised evidence</a>}</div><details><summary>Learner report and observations</summary><p>{submission.report}</p><div className="observation-table compact">{submission.observations.map((row, index) => <div key={index}><span>{row.trial}</span><span>{row.input}</span><span>{row.result}</span><span>{row.note}</span></div>)}</div></details><div className="lab-grading"><label>Mark (%)<input type="number" min="0" max="100" value={mark} onChange={(event) => setMark(event.target.value)} /></label><label>Feedback<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Explain strengths, errors and the next improvement…" /></label><label>Competency note<textarea value={competencyNote} onChange={(event) => setCompetencyNote(event.target.value)} placeholder="State what this virtual evidence demonstrates and what still requires supervised physical assessment…" /></label></div><footer><button disabled={saving} onClick={() => decide("resubmit")}>Request resubmission</button><button disabled={saving} onClick={() => decide("developing")}>Record developing</button><button disabled={saving} className="dialog-primary" onClick={() => decide("competent")}><CheckCircle2 /> Accept competency evidence</button></footer></article>;
}

function VirtualLabsWorkspace({ role }: { role: PortalRole }) {
  const [discipline, setDiscipline] = useState<LabDiscipline | "All">("All"); const [query, setQuery] = useState(""); const [selected, setSelected] = useState<VirtualPractical | null>(null); const [submissions, setSubmissions] = useState<VirtualLabSubmission[]>([]); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const response = await fetch("/api/virtual-labs"); const payload = await response.json() as { submissions?: VirtualLabSubmission[]; error?: string }; if (!response.ok) throw new Error(payload.error ?? "Virtual laboratories could not be loaded."); setSubmissions(payload.submissions ?? []); } catch (error) { toast.error(error instanceof Error ? error.message : "Virtual laboratories could not be loaded."); } finally { setLoading(false); } };
  useEffect(() => { queueMicrotask(() => void load()); }, [role]);
  useEffect(() => { if (role !== "learner") return; const practicalId = sessionStorage.getItem("ucc-open-practical"); if (!practicalId) return; sessionStorage.removeItem("ucc-open-practical"); const practical = virtualPracticals.find((item) => item.id === practicalId); if (practical) { setDiscipline(practical.discipline); setSelected(practical); } }, [role]);
  const filtered = virtualPracticals.filter((item) => (discipline === "All" || item.discipline === discipline) && `${item.title} ${item.discipline} ${item.focus}`.toLowerCase().includes(query.toLowerCase()));
  const latest = selected ? submissions.find((item) => item.practicalId === selected.id) : undefined;
  if (role !== "learner") return <div className="virtual-lab-admin"><section className="page-panel facilitator-lab-catalogue"><div className="virtual-lab-hero"><div><p className="eyebrow">FACILITATOR PRACTICAL PREVIEW</p><h2>Experience every simulation before using it</h2><p>Search, open and complete the learner pathway in non-recorded preview mode. Use the objectives, safety gate, interaction, data and debrief to judge whether the practical fits your programme.</p></div><div className="lab-hero-meter"><Eye /><strong>{virtualPracticals.length}</strong><span>practicals to preview</span></div></div><div className="lab-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search practicals to preview" /></label><div><button className={discipline === "All" ? "active" : ""} onClick={() => setDiscipline("All")}>All</button>{labDisciplines.map((item) => <button key={item} className={discipline === item ? "active" : ""} onClick={() => setDiscipline(item)}>{item} ({virtualPracticals.filter((practical) => practical.discipline === item).length})</button>)}</div></div><div className="virtual-lab-grid">{filtered.map((practical) => <article key={practical.id}><header><span><VirtualLabIcon discipline={practical.discipline} /></span><em>{practical.discipline}</em><b>preview</b></header><h3>{practical.title}</h3><p>{practical.focus}</p><div><span><ShieldCheck /> Safety gate</span><span><Activity /> Interactive</span><span><ClipboardCheck /> Debrief</span></div><button onClick={() => setSelected(practical)}><Eye /> Preview full practical <ChevronRight /></button></article>)}{filtered.length === 0 && <div className="empty-state wide">No practical matches this search or discipline.</div>}</div><Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="virtual-lab-dialog"><DialogHeader><p className="eyebrow">{selected?.discipline} · FACILITATOR PREVIEW</p><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Non-recorded nine-stage learner simulation preview</DialogDescription></DialogHeader>{selected && <VirtualPracticalRunner key={`preview-${selected.id}`} practical={selected} preview onSubmitted={async () => {}} />}</DialogContent></Dialog></section><section className="page-panel"><div className="page-title"><div><p className="eyebrow">PRACTICAL ASSESSMENT REGISTER</p><h2>Learner evidence and competency decisions</h2><p>Grade the virtual evidence while clearly recording what still requires physical supervision.</p></div><span className="access-badge"><ClipboardCheck /> {submissions.filter((item) => item.status === "submitted").length} awaiting review</span></div>{loading && <div className="empty-state">Loading practical submissions…</div>}<div className="lab-review-list">{submissions.map((submission) => <VirtualLabSubmissionReview key={submission.id} submission={submission} onUpdated={load} />)}{!loading && submissions.length === 0 && <div className="empty-state">Learner practical submissions will appear here.</div>}</div></section></div>;
  return <section className="page-panel virtual-lab-workspace"><div className="virtual-lab-hero"><div><p className="eyebrow">INTERACTIVE VIRTUAL PRACTICALS</p><h2>Prepare, practise and reflect safely</h2><p>Use these browser simulations to complement—never replace—approved physical laboratories, clinical placements and supervised skills assessment.</p></div><div className="lab-hero-meter"><FlaskConical /><strong>{virtualPracticals.length}</strong><span>guided practicals</span></div></div><div className="lab-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search practicals" /></label><div><button className={discipline === "All" ? "active" : ""} onClick={() => setDiscipline("All")}>All</button>{labDisciplines.map((item) => <button key={item} className={discipline === item ? "active" : ""} onClick={() => setDiscipline(item)}>{item}</button>)}</div></div>{loading && <div className="empty-state">Loading your practical record…</div>}<div className="virtual-lab-grid">{filtered.map((practical) => { const record = submissions.find((item) => item.practicalId === practical.id); return <article key={practical.id}><header><span><VirtualLabIcon discipline={practical.discipline} /></span><em>{practical.discipline}</em>{record && <b className={record.passed ? "passed" : record.status}>{record.passed ? "competent" : record.status}</b>}</header><h3>{practical.title}</h3><p>{practical.focus}</p><div><span><ShieldCheck /> Safety gate</span><span><Activity /> Interactive</span><span><ClipboardCheck /> Graded</span></div><button onClick={() => setSelected(practical)}>{record?.passed ? "Review debrief" : record?.status === "submitted" ? "View submission" : "Start practical"}<ChevronRight /></button></article>; })}{filtered.length === 0 && <div className="empty-state wide">No virtual practical matches this search.</div>}</div><Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="virtual-lab-dialog"><DialogHeader><p className="eyebrow">{selected?.discipline}</p><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Nine-stage complementary virtual practical</DialogDescription></DialogHeader>{selected && <VirtualPracticalRunner key={`${selected.id}-${latest?.id ?? 0}-${latest?.status ?? "new"}`} practical={selected} latest={latest} onSubmitted={load} />}</DialogContent></Dialog></section>;
}

function Assessments({ onOpen }: { onOpen: () => void }) {
  const tasks = [["Authentic assessment design brief", "Digital Pedagogy", "28 Aug 2026", "Due soon"], ["Clean and interpret a public dataset", "Data Analytics", "31 Aug 2026", "In progress"], ["Community field reflection", "Coastal Resilience", "04 Sep 2026", "Not started"]];
  return <div className="page-panel"><div className="page-title"><div><p className="eyebrow">EVIDENCE OF LEARNING</p><h2>Assessments</h2><p>Track submissions, feedback and competence decisions.</p></div></div><div className="task-table"><div className="task-head"><span>Assessment</span><span>Due date</span><span>Status</span><span /></div>{tasks.map((task) => <div className="task-row" key={task[0]}><div><b>{task[0]}</b><small>{task[1]}</small></div><span>{task[2]}</span><em className={task[3].replace(" ", "-").toLowerCase()}>{task[3]}</em><button onClick={onOpen}>Open <ChevronRight size={15} /></button></div>)}</div></div>;
}

function Discussions() {
  const posts = [["How can we verify authentic assessment online?", "Digital Pedagogy", "18 replies", "Dr. E. A. Mensah"], ["Choosing useful indicators for district planning", "Data Analytics", "11 replies", "Kojo B."], ["Community consent in coastal fieldwork", "Coastal Resilience", "7 replies", "Adwoa S."]];
  return <div className="page-panel"><div className="page-title"><div><p className="eyebrow">LEARNING COMMUNITY</p><h2>Discussions</h2><p>Continue course conversations with facilitators and peers.</p></div><button className="primary-action" onClick={() => toast.success("Discussion composer opened", { description: "Your draft is ready for a title and message." })}><MessageSquareText size={17} /> New post</button></div><div className="discussion-list">{posts.map((item) => <button key={item[0]} onClick={() => toast.info(item[0], { description: `${item[2]} · ${item[1]}` })}><span className="avatar">{item[3][0]}</span><div><h3>{item[0]}</h3><p>{item[1]} · Started by {item[3]}</p></div><b>{item[2]}</b><ChevronRight size={18} /></button>)}</div></div>;
}

function FacilitatorStudio({ query, setQuery }: { query: string, setQuery: (value: string) => void }) {
  type Material = CourseMaterial;
  const [step, setStep] = useState<"details" | "content" | "activities" | "assessment" | "review">("details");
  const [courseTitle, setCourseTitle] = useState("Community Data Skills for Decision-Making");
  const [courseCode, setCourseCode] = useState("DRAFT-MC 001");
  const [description, setDescription] = useState("A practical microcredential that develops evidence-based decision skills through guided learning and authentic assessment.");
  const [discipline, setDiscipline] = useState("Humanities & Social Sciences");
  const [type, setType] = useState("All");
  const [previewResource, setPreviewResource] = useState<LearningResource | null>(null);
  const [onlineResources, setOnlineResources] = useState<LearningResource[]>(openResources);
  const [searching, setSearching] = useState(false);
  const [youtubeSearchUrl, setYoutubeSearchUrl] = useState("https://www.youtube.com/results");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [resourceTranscript, setResourceTranscript] = useState("");
  const [transcriptLanguage, setTranscriptLanguage] = useState("English");
  const [transcriptFileName, setTranscriptFileName] = useState("");
  const [transcriptSource, setTranscriptSource] = useState("");
  const [publishTranscript, setPublishTranscript] = useState(true);
  const [extractingTranscript, setExtractingTranscript] = useState(false);
  const [files, setFiles] = useState<{ name: string; size: string; type: string }[]>([]);
  const [materials, setMaterials] = useState<Material[]>([
    { title: "Welcome and learning outcomes", kind: "Read", source: "Course author" },
    { title: "Core concept explainer", kind: "Watch", source: "YouTube" },
  ]);
  const [courseActivities, setCourseActivities] = useState<CourseActivity[]>([]);
  const [activityKind, setActivityKind] = useState<"colab" | "virtual_lab">("virtual_lab");
  const [activityTitle, setActivityTitle] = useState("Guided virtual practical");
  const [activityInstructions, setActivityInstructions] = useState("Complete every guided stage, record observations and submit the practical report for facilitator assessment.");
  const [activityRequired, setActivityRequired] = useState(true);
  const [activityPassMark, setActivityPassMark] = useState(60);
  const [activityAttempts, setActivityAttempts] = useState(2);
  const [activityMaxMark, setActivityMaxMark] = useState(100);
  const [activityDueAt, setActivityDueAt] = useState("");
  const [activityRubric, setActivityRubric] = useState("Assess completion, accuracy, interpretation, documentation and reflection.");
  const [activityTemplateUrl, setActivityTemplateUrl] = useState("");
  const [activityNotebook, setActivityNotebook] = useState<File | null>(null);
  const [activityDiscipline, setActivityDiscipline] = useState<LabDiscipline | "All">("All");
  const [selectedPracticalId, setSelectedPracticalId] = useState(virtualPracticals[0]?.id ?? "");
  const [previewPractical, setPreviewPractical] = useState<VirtualPractical | null>(null);
  const [previewedPracticalIds, setPreviewedPracticalIds] = useState<string[]>([]);
  const [addingActivity, setAddingActivity] = useState(false);
  const [assessmentModes, setAssessmentModes] = useState(["Objective quiz", "Pause check"]);
  const [gateRequired, setGateRequired] = useState(true);
  const [passMark, setPassMark] = useState(80);
  const [attempts, setAttempts] = useState("3");
  const [questionFiles, setQuestionFiles] = useState<{ name: string; size: string; type: string }[]>([]);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [questionType, setQuestionType] = useState("Multiple choice");
  const [whiteboardEnabled, setWhiteboardEnabled] = useState(false);
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState(["", "", "", ""]);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [pairRows, setPairRows] = useState<PairItem[]>([{ left: "", right: "", image: "" }, { left: "", right: "", image: "" }]);
  const [questionLimit, setQuestionLimit] = useState(10);
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  const [questionVideoUrl, setQuestionVideoUrl] = useState("");
  const [videoMode, setVideoMode] = useState<"whole" | "part" | "pause">("part");
  const [videoStart, setVideoStart] = useState(0);
  const [videoEnd, setVideoEnd] = useState(30);
  const [questionPoints, setQuestionPoints] = useState(1);
  const [markingScheme, setMarkingScheme] = useState("");
  const [feedbackCorrect, setFeedbackCorrect] = useState("Well done. You have demonstrated the required understanding.");
  const [feedbackIncorrect, setFeedbackIncorrect] = useState("Review the relevant learning material and try again.");
  const [learnerAdvice, setLearnerAdvice] = useState("Focus on the key concept, compare it with the examples, and use the feedback before your next attempt.");
  const [saving, setSaving] = useState(false);
  const resources = onlineResources.filter((resource) => type === "All" || resource.type === type);
  const toggleMode = (mode: string) => setAssessmentModes((items) => items.includes(mode) ? items.filter((item) => item !== mode) : [...items, mode]);
  const selectActivityKind = (kind: "colab" | "virtual_lab") => { setActivityKind(kind); if (kind === "colab") { setActivityTitle("Guided Colab notebook activity"); setActivityInstructions("Open the notebook in free Google Colab, complete the required code and submit the notebook file or sharing link."); setActivityRubric("Assess correctness, reproducibility, interpretation, code quality and documentation."); } else { setActivityTitle("Guided virtual practical"); setActivityInstructions("Complete every guided stage, record observations and submit the practical report for facilitator assessment."); setActivityRubric("Assess completion, accuracy, interpretation, documentation and reflection."); } };
  const addVirtualActivity = () => {
    const practical = virtualPracticals.find((item) => item.id === selectedPracticalId); if (!practical) return toast.error("Choose a virtual practical.");
    if (courseActivities.some((item) => item.kind === "virtual_lab" && item.practicalId === practical.id)) return toast.error("That virtual practical is already in the programme.");
    setCourseActivities((items) => [...items, { id: crypto.randomUUID(), kind: "virtual_lab", title: activityTitle.trim() || practical.title, instructions: activityInstructions.trim() || practical.focus, required: activityRequired, passMark: activityPassMark, attemptsAllowed: activityAttempts, maxMark: activityMaxMark, dueAt: activityDueAt || undefined, rubric: activityRubric.trim(), practicalId: practical.id, discipline: practical.discipline }]);
    toast.success("Virtual practical added to the programme sequence");
  };
  const addColabActivity = async () => {
    if (!activityTitle.trim() || !activityInstructions.trim() || !activityRubric.trim()) return toast.error("Enter the Colab activity title, instructions and rubric.");
    if (!activityNotebook) return toast.error("Upload the facilitator's .ipynb notebook template.");
    if (!activityNotebook.name.toLowerCase().endsWith(".ipynb") || activityNotebook.size > 10 * 1024 * 1024) return toast.error("Choose a valid .ipynb notebook no larger than 10 MB.");
    try { const parsed = JSON.parse(await activityNotebook.text()) as { cells?: unknown[]; nbformat?: number }; if (!Array.isArray(parsed.cells) || !Number.isInteger(parsed.nbformat)) throw new Error(); } catch { return toast.error("The uploaded file is not a readable Jupyter notebook."); }
    if (activityTemplateUrl) { try { const url = new URL(activityTemplateUrl); if (!['github.com','colab.research.google.com'].includes(url.hostname) || (url.hostname === 'github.com' && !url.pathname.toLowerCase().endsWith('.ipynb'))) throw new Error(); } catch { return toast.error("Use a GitHub .ipynb or Google Colab direct-open URL."); } }
    setAddingActivity(true);
    try {
      const body = new FormData(); body.append("file", activityNotebook); const response = await fetch("/api/uploads", { method: "POST", body }); const stored = await response.json() as { key?: string; name?: string; error?: string };
      if (!response.ok || !stored.key || !stored.name) throw new Error(stored.error ?? "The notebook could not be stored.");
      setCourseActivities((items) => [...items, { id: crypto.randomUUID(), kind: "colab", title: activityTitle.trim(), instructions: activityInstructions.trim(), required: activityRequired, passMark: activityPassMark, attemptsAllowed: activityAttempts, maxMark: activityMaxMark, dueAt: activityDueAt || undefined, rubric: activityRubric.trim(), notebookKey: stored.key, notebookFileName: stored.name, templateUrl: activityTemplateUrl.trim() || undefined }]);
      setActivityNotebook(null); setActivityTemplateUrl(""); toast.success("Colab activity added to the programme sequence");
    } catch (error) { toast.error(error instanceof Error ? error.message : "The Colab activity could not be added."); }
    finally { setAddingActivity(false); }
  };
  const moveActivity = (index: number, direction: -1 | 1) => setCourseActivities((items) => { const target = index + direction; if (target < 0 || target >= items.length) return items; const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const openResourcePreview = (resource: LearningResource) => { setPreviewResource(resource); setResourceTranscript(resource.transcript ?? ""); setTranscriptLanguage(resource.transcriptLanguage ?? "English"); setTranscriptFileName(""); setTranscriptSource(resource.transcript ? "Supplied transcript" : ""); setPublishTranscript(true); };
  const addResource = (resource: LearningResource) => {
    const transcript = resourceTranscript.trim() || resource.transcript?.trim() || "";
    if (publishTranscript && resource.source.includes("YouTube") && !transcript) return toast.error("Extract, paste or upload a transcript before choosing to publish it with the video.");
    setMaterials((items) => [...items, { title: resource.title, kind: resource.type, source: resource.source, url: resource.url, externalUrl: resource.externalUrl, transcript: transcript || undefined, transcriptLanguage: transcript ? transcriptLanguage : undefined, transcriptSource: transcript ? transcriptSource || "Facilitator supplied" : undefined, transcriptPublished: Boolean(transcript && publishTranscript) }]);
    setPreviewResource(null); setYoutubeUrl(""); setResourceTranscript(""); setTranscriptFileName(""); setTranscriptSource("");
    toast.success("Approved resource embedded", { description: transcript && publishTranscript ? `${resource.title} and its reviewed transcript were published together.` : `${resource.title} was added without a learner-visible transcript.` });
  };
  const searchOnline = async () => {
    if (query.trim().length < 2) return toast.error("Enter at least two search characters");
    setSearching(true);
    try {
      const response = await fetch(`/api/resource-search?q=${encodeURIComponent(query.trim())}`);
      const result = await response.json() as { resources?: LearningResource[]; youtubeSearchUrl?: string; error?: string; errors?: string[] };
      if (!response.ok) throw new Error(result.error ?? "Online search could not be completed.");
      setOnlineResources(result.resources?.length ? result.resources : openResources);
      setYoutubeSearchUrl(result.youtubeSearchUrl ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`);
      toast.success(`${result.resources?.length ?? 0} live open resources found`, { description: result.errors?.length ? "Some sources were temporarily unavailable." : "Review and approve a result before embedding." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Online search could not be completed.");
    } finally { setSearching(false); }
  };
  const previewYoutube = async () => {
    if (!youtubeUrl.trim()) return toast.error("Paste a YouTube video URL");
    try {
      const response = await fetch(`/api/resource-search?youtubeUrl=${encodeURIComponent(youtubeUrl.trim())}`);
      const result = await response.json() as { resource?: LearningResource; error?: string };
      if (!response.ok || !result.resource) throw new Error(result.error ?? "That YouTube video could not be reviewed.");
      openResourcePreview(result.resource);
    } catch (error) { toast.error(error instanceof Error ? error.message : "That YouTube video could not be reviewed."); }
  };
  const handleTranscriptFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(txt|srt|vtt)$/i.test(file.name)) return toast.error("Choose a TXT, SRT or VTT transcript file.");
    if (file.size > 2 * 1024 * 1024) return toast.error("Transcript files must be 2 MB or smaller.");
    try { const text = await file.text(); if (!text.trim()) throw new Error("The transcript file is empty."); setResourceTranscript(text); setTranscriptFileName(file.name); setTranscriptSource(`Imported from ${file.name}`); toast.success("Transcript imported", { description: "Review and correct it before embedding the video." }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "The transcript could not be read."); }
  };
  const extractYoutubeTranscript = async () => {
    if (!previewResource?.externalUrl) return;
    setExtractingTranscript(true);
    try {
      const response = await fetch("/api/youtube-transcript", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ youtubeUrl: previewResource.externalUrl, language: transcriptLanguage }) });
      const result = await response.json() as { transcript?: string; languageCode?: string; source?: string; error?: string };
      if (!response.ok || !result.transcript) throw new Error(result.error ?? "No transcript could be extracted.");
      setResourceTranscript(result.transcript); setTranscriptSource(result.source ?? "YouTube captions"); setTranscriptFileName("");
      toast.success("Transcript extracted for review", { description: `${result.languageCode?.toUpperCase() ?? transcriptLanguage} captions are ready to edit before publishing.` });
    } catch (error) { toast.error(error instanceof Error ? error.message : "No transcript could be extracted."); }
    finally { setExtractingTranscript(false); }
  };
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const uploaded: { name: string; size: string; type: string }[] = [];
    for (const file of Array.from(fileList)) {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      if (!response.ok) { toast.error(`Could not upload ${file.name}`); continue; }
      const stored = await response.json() as { name: string; size: number; type: string };
      uploaded.push({ name: stored.name, size: `${Math.max(1, Math.round(stored.size / 1024))} KB`, type: stored.type });
    }
    if (uploaded.length === 0) return;
    setFiles((items) => [...items, ...uploaded]);
    setMaterials((items) => [...items, ...uploaded.map((file) => ({ title: file.name, kind: "Upload", source: "Facilitator file" }))]);
    toast.success(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} added`);
  };
  const handleQuestionFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const uploaded: { name: string; size: string; type: string }[] = [];
    for (const file of Array.from(fileList)) {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      if (!response.ok) { toast.error(`Could not upload ${file.name}`); continue; }
      const stored = await response.json() as { name: string; size: number; type: string };
      uploaded.push({ name: stored.name, size: `${Math.max(1, Math.round(stored.size / 1024))} KB`, type: stored.type });
    }
    if (uploaded.length) { setQuestionFiles((items) => [...items, ...uploaded]); toast.success(`${uploaded.length} question file${uploaded.length === 1 ? "" : "s"} uploaded`); }
  };
  const addQuestion = () => {
    if (!questionPrompt.trim()) return toast.error("Enter the assessment question");
    if (questions.length >= questionLimit) return toast.error(`This assessment is limited to ${questionLimit} questions.`);
    const usesOptions = questionType === "Multiple choice" || questionType === "True / false" || questionType === "Video question";
    const options = questionType === "True / false" ? ["True", "False"] : questionOptions.map((item) => item.trim()).filter(Boolean);
    const selectedAnswer = questionType === "Multiple choice" || (questionType === "Video question" && options.length) ? (correctOptionIndex === null ? "" : questionOptions[correctOptionIndex]?.trim()) : correctAnswer.trim();
    const usesPairs = ["Matching", "Drag and drop", "Picture matching"].includes(questionType);
    const pairs = pairRows.map((pair) => ({ left: pair.left.trim(), right: pair.right.trim(), image: pair.image?.trim() })).filter((pair) => pair.left && pair.right);
    if (usesOptions && options.length < 2) return toast.error("Add at least two answer options");
    if (usesOptions && !selectedAnswer) return toast.error("Use the button beside an option to select the correct answer");
    if (usesPairs && pairs.length < 2) return toast.error("Add at least two complete matching pairs");
    if (questionType === "Video question" && !questionVideoUrl.trim()) return toast.error("Paste the video link for this question");
    const question: AssessmentQuestion = { id: crypto.randomUUID(), type: questionType, prompt: questionPrompt.trim(), options: usesPairs ? [] : options, correctAnswer: selectedAnswer, points: questionPoints, scheme: markingScheme.trim(), feedbackCorrect: feedbackCorrect.trim(), feedbackIncorrect: feedbackIncorrect.trim(), learnerAdvice: learnerAdvice.trim(), pairs: usesPairs ? pairs : undefined, videoUrl: questionType === "Video question" ? questionVideoUrl.trim() : undefined, videoMode: questionType === "Video question" ? videoMode : undefined, videoStart: questionType === "Video question" ? videoStart : undefined, videoEnd: questionType === "Video question" ? videoEnd : undefined, whiteboardEnabled };
    setQuestions((items) => [...items, question]);
    setQuestionPrompt(""); setQuestionOptions(["", "", "", ""]); setCorrectOptionIndex(null); setCorrectAnswer(""); setPairRows([{ left: "", right: "", image: "" }, { left: "", right: "", image: "" }]); setQuestionVideoUrl(""); setMarkingScheme(""); setWhiteboardEnabled(false);
    toast.success("Assessment question added");
  };
  const saveCourse = async () => {
    if (!courseTitle.trim() || !courseCode.trim() || !discipline) return toast.error("Course title, code and discipline are required");
    setSaving(true);
    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: courseCode, title: courseTitle, discipline, description, materials, activities: courseActivities, assessmentModes, gateRequired, questionLimit, certificateEnabled, assessmentConfig: { passMark, attempts, questions: questions.slice(0, questionLimit), questionFiles } }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save the course draft.");
      toast.success("Course draft created", { description: `${courseTitle} was saved for academic and quality review.` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the course draft.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="authoring-shell">
    <section className="authoring-main page-panel">
      <div className="page-title"><div><p className="eyebrow">FACILITATOR COURSE AUTHORING</p><h2>Create a microcredential course</h2><p>Design, source, assess and publish a gated learning experience.</p></div><span className="access-badge"><ShieldCheck /> Facilitator access</span></div>
      <div className="authoring-steps">{[["details", "1", "Course details"], ["content", "2", "Learning materials"], ["activities", "3", "Programme activities"], ["assessment", "4", "Assessment rules"], ["review", "5", "Review & publish"]].map(([id, number, label]) => <button key={id} className={step === id ? "active" : ""} onClick={() => setStep(id as typeof step)}><span>{number}</span>{label}</button>)}</div>

      {step === "details" && <div className="authoring-form"><div className="form-grid"><label>Course title<input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} /></label><label>Provisional code<input value={courseCode} onChange={(event) => setCourseCode(event.target.value)} /></label><label>Discipline of learning<select value={discipline} onChange={(event) => setDiscipline(event.target.value)}>{disciplines.map((item) => <option key={item}>{item}</option>)}</select></label><label>Microcredential category<select defaultValue="credit"><option value="credit">Credit-bearing microcredential</option><option value="professional">Professional development</option><option value="rpl">Advanced standing / RPL</option></select></label><label>Delivery pattern<select defaultValue="blended"><option value="asynchronous">Asynchronous</option><option value="synchronous">Synchronous</option><option value="blended">Blended</option></select></label><label>Competence band<select defaultValue="applied"><option value="foundation">Foundation practitioner</option><option value="applied">Applied practitioner</option><option value="advanced">Advanced practitioner</option></select></label></div><label>Course description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="form-grid"><label>Expected learning hours<input type="number" defaultValue="24" min="1" /></label></div><button className="dialog-primary align-right" onClick={() => setStep("content")}>Save details and add materials <ChevronRight /></button></div>}

      {step === "content" && <div className="content-authoring"><div className="authoring-tabs"><section><p className="eyebrow">UPLOAD COURSE FILES</p><h3>Documents and media</h3><p>Upload PDF, Word, PowerPoint, image, audio or video learning material.</p><label className="upload-zone"><FileText /><b>Choose files to upload</b><span>Multiple files supported · stored securely</span><input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.mp3,.mp4" onChange={(event) => handleFiles(event.target.files)} /></label>{files.length > 0 && <div className="uploaded-files">{files.map((file, index) => <article key={`${file.name}-${index}`}><FileText /><div><b>{file.name}</b><span>{file.size} · {file.type}</span></div><button onClick={() => { setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index)); toast.success("File removed"); }}>Remove</button></article>)}</div>}</section>
        <section><p className="eyebrow">YOUTUBE DISCOVERY</p><h3>Find, preview and approve video</h3><p>Search YouTube by the course keywords, then paste a selected video URL to review it in-frame before embedding.</p><div className="youtube-actions"><button onClick={() => window.open(youtubeSearchUrl, "_blank", "noopener,noreferrer")}><Search /> Search YouTube for “{query || "course topic"}”</button><div className="url-adder"><input value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="Paste selected YouTube URL" /><button onClick={previewYoutube}><Video /> Review</button></div></div></section></div>
        <section className="online-library"><div><p className="eyebrow">LIVE OPEN-RESOURCE SEARCH</p><h3>Search the web, then review before embedding</h3><p>Search live open-access research and public learning collections. Results open in a frame for quality, relevance, licence and accessibility judgement.</p></div><div className="oer-search"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchOnline()} placeholder="Type keywords, e.g. climate adaptation" /></label><button disabled={searching} onClick={searchOnline}><Search /> {searching ? "Searching…" : "Search online"}</button></div><div className="filter-row">{["All", "Watch", "Read", "Code"].map((filter) => <button key={filter} className={type === filter ? "active" : ""} onClick={() => setType(filter)}>{filter}</button>)}</div><div className="resource-results compact">{resources.map((resource) => { const Icon = resource.type === "Watch" ? Video : resource.type === "Code" ? Code2 : FileText; return <article key={`${resource.title}-${resource.url}`}><span className={`resource-type ${resource.type.toLowerCase()}`}><Icon /></span><div><small>{resource.type} · {resource.license}</small><h3>{resource.title}</h3><p>{resource.source}</p></div><button onClick={() => openResourcePreview(resource)}>Review <ChevronRight /></button></article>; })}{!searching && resources.length === 0 && <div className="empty-state">No results in this category. Try different keywords or select All.</div>}</div></section><button className="dialog-primary align-right" onClick={() => setStep("activities")}>Continue to programme activities <ChevronRight /></button></div>}

      {step === "activities" && <div className="programme-activities-builder">
        <div className="programme-activity-heading"><div><p className="eyebrow">PROGRAMME ACTIVITY DESIGN</p><h3>Add coding and interactive practical activities</h3><p>Attach each activity to this microcredential, configure its progression requirements and position it in the learner sequence.</p></div><span><Code2 /> Colab <b>+</b> <FlaskConical /> Virtual labs</span></div>
        <div className="activity-kind-tabs"><button className={activityKind === "virtual_lab" ? "active" : ""} onClick={() => selectActivityKind("virtual_lab")}><FlaskConical /><div><b>Interactive virtual practical</b><p>Select from approved science, nursing, medicine and engineering simulations.</p></div></button><button className={activityKind === "colab" ? "active" : ""} onClick={() => selectActivityKind("colab")}><Code2 /><div><b>Google Colab coding activity</b><p>Upload a notebook template for Python, R or data-analysis work.</p></div></button></div>
        <div className="activity-design-grid"><section className="activity-config"><div className="form-grid"><label>Activity title<input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} /></label><label>Required activity<select value={activityRequired ? "required" : "optional"} onChange={(event) => setActivityRequired(event.target.value === "required")}><option value="required">Required for completion</option><option value="optional">Optional enrichment</option></select></label><label>Pass mark (%)<input type="number" min="1" max="100" value={activityPassMark} onChange={(event) => setActivityPassMark(Math.min(100, Math.max(1, Number(event.target.value))))} /></label><label>Permitted attempts<select value={activityAttempts} onChange={(event) => setActivityAttempts(Number(event.target.value))}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label><label>Maximum mark<input type="number" min="1" max="1000" value={activityMaxMark} onChange={(event) => setActivityMaxMark(Math.min(1000, Math.max(1, Number(event.target.value))))} /></label><label>Due date and time<input type="datetime-local" value={activityDueAt} onChange={(event) => setActivityDueAt(event.target.value)} /></label></div><label>Learner instructions<textarea value={activityInstructions} onChange={(event) => setActivityInstructions(event.target.value)} placeholder="Explain what the learner must complete and submit…" /></label><label>Marking rubric<textarea value={activityRubric} onChange={(event) => setActivityRubric(event.target.value)} placeholder="State the evidence and allocation of marks…" /></label>
          {activityKind === "virtual_lab" ? <div className="virtual-practical-picker"><div className="form-grid"><label>Laboratory discipline<select value={activityDiscipline} onChange={(event) => { const value = event.target.value as LabDiscipline | "All"; setActivityDiscipline(value); const first = virtualPracticals.find((item) => value === "All" || item.discipline === value); if (first) { setSelectedPracticalId(first.id); setActivityTitle(first.title); setActivityInstructions(first.focus); } }}><option>All</option>{labDisciplines.map((item) => <option key={item}>{item}</option>)}</select></label><label>Approved practical<select value={selectedPracticalId} onChange={(event) => { setSelectedPracticalId(event.target.value); const practical = virtualPracticals.find((item) => item.id === event.target.value); if (practical) { setActivityTitle(practical.title); setActivityInstructions(practical.focus); } }}>{virtualPracticals.filter((item) => activityDiscipline === "All" || item.discipline === activityDiscipline).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>{(() => { const practical = virtualPracticals.find((item) => item.id === selectedPracticalId); const reviewed = practical ? previewedPracticalIds.includes(practical.id) : false; return practical ? <article className="practical-design-preview"><VirtualLabIcon discipline={practical.discipline} /><div><b>{practical.discipline} · {practical.mode} simulation</b><p>{practical.focus}</p><span>{practical.objectives.length} objectives · safety gate · data report · debrief</span></div><button className={reviewed ? "previewed" : ""} onClick={() => setPreviewPractical(practical)}>{reviewed ? <CheckCircle2 /> : <Eye />} {reviewed ? "Preview reviewed" : "Preview full practical"}</button></article> : null; })()}</div> : <div className="colab-course-activity"><label className={activityNotebook ? "upload-zone selected" : "upload-zone"}><Code2 /><b>{activityNotebook?.name || "Upload master .ipynb notebook"}</b><span>Required · maximum 10 MB · stored with the course draft</span><input type="file" accept=".ipynb,application/x-ipynb+json,application/json" onChange={(event) => setActivityNotebook(event.target.files?.[0] ?? null)} /></label><label>Optional GitHub or Colab direct-open URL<input type="url" value={activityTemplateUrl} onChange={(event) => setActivityTemplateUrl(event.target.value)} placeholder="https://github.com/…/notebook.ipynb" /></label></div>}
          <button className="dialog-primary" disabled={addingActivity} onClick={activityKind === "colab" ? addColabActivity : addVirtualActivity}>{activityKind === "colab" ? <Code2 /> : <FlaskConical />} {addingActivity ? "Storing notebook…" : `Add ${activityKind === "colab" ? "Colab" : "virtual-lab"} activity`}</button></section>
          <section className="programme-activity-sequence"><div><p className="eyebrow">PROGRAMME SEQUENCE</p><h3>{courseActivities.length} designed activit{courseActivities.length === 1 ? "y" : "ies"}</h3><p>Activities become part of the course approval record. Colab assignments are activated automatically when the programme is approved.</p></div>{courseActivities.map((activity, index) => <article key={activity.id}><span className={activity.kind}><GripVertical /></span><div><small>{index + 1} · {activity.kind === "colab" ? "COLAB CODING" : `${activity.discipline?.toUpperCase()} VIRTUAL PRACTICAL`}</small><h4>{activity.title}</h4><p>{activity.required ? "Required" : "Optional"} · pass {activity.passMark}% · {activity.attemptsAllowed} attempt{activity.attemptsAllowed === 1 ? "" : "s"}</p></div><div className="sequence-actions"><button disabled={index === 0} onClick={() => moveActivity(index, -1)}>Move up</button><button disabled={index === courseActivities.length - 1} onClick={() => moveActivity(index, 1)}>Move down</button><button className="remove" onClick={() => setCourseActivities((items) => items.filter((item) => item.id !== activity.id))}>Remove</button></div></article>)}{courseActivities.length === 0 && <div className="empty-state">No programme activities yet. Add a Colab notebook or approved virtual practical.</div>}</section></div>
        <button className="dialog-primary align-right" onClick={() => setStep("assessment")}>Continue to assessment design <ChevronRight /></button>
      </div>}

      {step === "assessment" && <div className="assessment-builder">
        <div><p className="eyebrow">ASSESSMENT MODES</p><h3>Select one or more evidence methods</h3><p>Objective checks can automatically control progression. Essays and assignments use the facilitator’s marking scheme.</p></div>
        <div className="mode-grid">{[["Objective quiz", "Multiple choice with automatic scoring"], ["True / false", "Quick automated understanding check"], ["Pause check", "Interrupt content and assess before continuing"], ["Short answer", "Brief typed response for facilitator review"], ["Essay optional", "Optional reflective or analytical essay"], ["Practical assignment", "Upload evidence, project or workplace output"]].map(([mode, detail]) => <button key={mode} className={assessmentModes.includes(mode) ? "selected" : ""} onClick={() => toggleMode(mode)}><span>{assessmentModes.includes(mode) ? <CheckCircle2 /> : <FileCheck2 />}</span><div><b>{mode}</b><p>{detail}</p></div></button>)}</div>
        <div className="gate-settings"><div><ShieldCheck /><div><b>Pause, assess understanding and continue</b><p>Stop the lesson at the checkpoint. Unlock the next activity only after the learner meets the pass mark.</p></div></div><Switch checked={gateRequired} onCheckedChange={setGateRequired} /><label>Pass mark<input type="number" value={passMark} onChange={(event) => setPassMark(Number(event.target.value))} min="1" max="100" /><span>%</span></label><label>Attempts<select value={attempts} onChange={(event) => setAttempts(event.target.value)}><option>1</option><option>2</option><option>3</option><option>Unlimited</option></select></label></div>
        <div className="assessment-publish-settings"><label>Number of questions to set<input type="number" min="1" max="100" value={questionLimit} onChange={(event) => setQuestionLimit(Math.min(100, Math.max(1, Number(event.target.value))))} /><span>{questions.length} of {questionLimit} created</span></label><label className="certificate-setting"><Award /><div><b>Generate QR certificate after completion</b><span>The learner receives a named, verifiable certificate after passing every required assessment.</span></div><Switch checked={certificateEnabled} onCheckedChange={setCertificateEnabled} /></label></div>

        <div className="assessment-source-grid"><section><p className="eyebrow">UPLOAD QUESTION BANK</p><h3>Import test questions or marking material</h3><p>Upload CSV, Excel, Word, PDF or text files. The files are retained with the draft for facilitator and quality review.</p><label className="upload-zone compact-upload"><FileCheck2 /><b>Choose assessment files</b><span>CSV · XLSX · DOCX · PDF · TXT</span><input type="file" multiple accept=".csv,.xls,.xlsx,.doc,.docx,.pdf,.txt" onChange={(event) => handleQuestionFiles(event.target.files)} /></label>{questionFiles.length > 0 && <div className="uploaded-files">{questionFiles.map((file, index) => <article key={`${file.name}-${index}`}><FileCheck2 /><div><b>{file.name}</b><span>{file.size} · assessment source</span></div><button onClick={() => setQuestionFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></article>)}</div>}</section>
        <section className="question-bank-summary"><p className="eyebrow">QUESTION BANK</p><h3>{questions.length} authored question{questions.length === 1 ? "" : "s"}</h3><p>Every question can carry a correct answer, grading scheme, feedback and learner advice.</p>{questions.map((question, index) => <article key={question.id}><span>{index + 1}</span><div><b>{question.type} · {question.points} point{question.points === 1 ? "" : "s"}{question.whiteboardEnabled ? " · Mathematical whiteboard" : ""}</b><p>{question.prompt}</p></div><button onClick={() => setQuestions((items) => items.filter((item) => item.id !== question.id))}>Remove</button></article>)}{questions.length === 0 && <div className="empty-state">No typed questions yet. Use the editor below or upload a question bank.</div>}</section></div>

        <section className="question-editor"><div className="editor-heading"><div><p className="eyebrow">QUESTION EDITOR</p><h3>Write a question and its grading guidance</h3></div><label>Question type<select value={questionType} onChange={(event) => { setQuestionType(event.target.value); setCorrectAnswer(""); setCorrectOptionIndex(null); }}><option>Multiple choice</option><option>True / false</option><option>Fill in</option><option>Matching</option><option>Drag and drop</option><option>Picture matching</option><option>Video question</option><option>Short answer</option><option>Essay</option><option>Practical assignment</option></select></label></div><label>Question or task<textarea value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} placeholder="Enter the question exactly as the learner should see it…" /></label>
        {(questionType === "Multiple choice" || questionType === "Video question") && <div className="option-editor correct-option-editor">{questionOptions.map((option, index) => <label key={index}><span><input type="radio" name="correct-option" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} /> Correct</span>Option {String.fromCharCode(65 + index)}<input value={option} onChange={(event) => setQuestionOptions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Answer option ${index + 1}`} /></label>)}</div>}
        {questionType === "True / false" && <div className="truth-selector"><label><input type="radio" name="correct-truth" checked={correctAnswer === "True"} onChange={() => setCorrectAnswer("True")} /> True is correct</label><label><input type="radio" name="correct-truth" checked={correctAnswer === "False"} onChange={() => setCorrectAnswer("False")} /> False is correct</label></div>}
        {["Fill in", "Short answer", "Essay", "Practical assignment"].includes(questionType) && <label>{questionType === "Fill in" ? "Exact accepted answer" : "Model answer / key points"}<textarea value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} placeholder={questionType === "Fill in" ? "Type the word or phrase accepted as correct" : "Enter the correct response or model answer…"} /></label>}
        {["Matching", "Drag and drop", "Picture matching"].includes(questionType) && <div className="pair-editor"><div><b>Matching pairs</b><span>Enter the prompt and its correct match. Picture matching also accepts an image URL.</span></div>{pairRows.map((pair, index) => <article key={index}>{questionType === "Picture matching" && <label>Picture URL<input value={pair.image ?? ""} onChange={(event) => setPairRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, image: event.target.value } : row))} placeholder="https://…/image.jpg" /></label>}<label>{questionType === "Picture matching" ? "Picture label" : "Prompt"}<input value={pair.left} onChange={(event) => setPairRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, left: event.target.value } : row))} /></label><label>Correct match<input value={pair.right} onChange={(event) => setPairRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, right: event.target.value } : row))} /></label><button onClick={() => setPairRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></article>)}<button className="secondary-action" onClick={() => setPairRows((rows) => [...rows, { left: "", right: "", image: "" }])}>Add matching pair</button></div>}
        {questionType === "Video question" && <div className="video-question-editor"><label>Video link<input value={questionVideoUrl} onChange={(event) => setQuestionVideoUrl(event.target.value)} placeholder="Paste YouTube or direct video link" /></label><label>Required viewing<select value={videoMode} onChange={(event) => setVideoMode(event.target.value as typeof videoMode)}><option value="whole">Whole video</option><option value="part">Selected part</option><option value="pause">Pause and answer</option></select></label><label>Start at second<input type="number" min="0" value={videoStart} onChange={(event) => setVideoStart(Math.max(0, Number(event.target.value)))} /></label><label>Questions appear at second<input type="number" min="1" value={videoEnd} onChange={(event) => setVideoEnd(Math.max(videoStart + 1, Number(event.target.value)))} /></label><p><Video /> The learner must finish the configured whole video or segment before this question becomes visible.</p></div>}
        <div className={`whiteboard-setting ${whiteboardEnabled ? "enabled" : ""}`}><span><Sigma /></span><div><b>Mathematical working whiteboard</b><p>Add a drawing board to this question. Learners can write calculations, convert supported handwriting to editable text and correct the transcription before submitting.</p></div><Switch checked={whiteboardEnabled} onCheckedChange={setWhiteboardEnabled} /></div>
        <label className="points-field">Marks / points<input type="number" value={questionPoints} onChange={(event) => setQuestionPoints(Math.max(1, Number(event.target.value)))} min="1" /></label>
        <label>Marking scheme or rubric<textarea value={markingScheme} onChange={(event) => setMarkingScheme(event.target.value)} placeholder="State the criteria, expected evidence and allocation of marks…" /></label><div className="editor-form-grid"><label>Feedback when correct<textarea value={feedbackCorrect} onChange={(event) => setFeedbackCorrect(event.target.value)} /></label><label>Feedback when incorrect<textarea value={feedbackIncorrect} onChange={(event) => setFeedbackIncorrect(event.target.value)} /></label></div><label>Learner advice and next-step guidance<textarea value={learnerAdvice} onChange={(event) => setLearnerAdvice(event.target.value)} placeholder="Explain what the learner should review or practise next…" /></label><button className="secondary-action add-question" disabled={questions.length >= questionLimit} onClick={addQuestion}><FileCheck2 /> {questions.length >= questionLimit ? `Question limit reached (${questionLimit})` : `Add question ${questions.length + 1} of ${questionLimit}`}</button></section>
        <button className="dialog-primary align-right" onClick={() => setStep("review")}>Review course structure <ChevronRight /></button>
      </div>}

      {step === "review" && <div className="course-review"><div className="review-hero"><span>{courseCode}</span><h3>{courseTitle}</h3><p>{description}</p><div><b>{materials.length}</b> learning materials <b>{courseActivities.length}</b> programme activities <b>{questions.length}</b> authored questions <b>{questionFiles.length}</b> uploaded question files <b>{gateRequired ? "Active" : "Off"}</b> progression gate</div></div><div className="review-columns"><section><p className="eyebrow">LEARNING AND ACTIVITY SEQUENCE</p>{materials.map((material, index) => <article key={`${material.title}-${index}`}><span>{index + 1}</span><div><b>{material.title}</b><p>{material.kind} · {material.source}</p></div><button onClick={() => setMaterials((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></article>)}{courseActivities.map((activity, index) => <article className="review-programme-activity" key={activity.id}><span>{materials.length + index + 1}</span><div><b>{activity.title}</b><p>{activity.kind === "colab" ? "Colab coding" : `${activity.discipline} virtual practical`} · {activity.required ? "required" : "optional"} · pass {activity.passMark}%</p></div><button onClick={() => setCourseActivities((items) => items.filter((item) => item.id !== activity.id))}>Remove</button></article>)}</section><section><p className="eyebrow">ASSESSMENT PLAN</p>{assessmentModes.map((mode) => <article key={mode}><span><FileCheck2 /></span><div><b>{mode}</b><p>{mode === "Pause check" && gateRequired ? `${passMark}% required before continuation` : "Included in course"}</p></div></article>)}<article><span><FileCheck2 /></span><div><b>{questions.length} typed questions</b><p>{questionFiles.length} uploaded question-bank files · {attempts} attempts</p></div></article></section></div><div className="publish-actions"><button className="secondary-action" onClick={() => setStep("activities")}>Return to editing</button><button className="dialog-primary" disabled={saving} onClick={saveCourse}><ShieldCheck /> {saving ? "Saving course…" : "Create course for approval"}</button></div></div>}
    </section>

    <aside className="builder-panel persistent-sequence"><p className="eyebrow">LIVE COURSE OUTLINE</p><h2>{courseTitle || "Untitled course"}</h2><div className="sequence-list">{materials.map((material, index) => <article key={`${material.title}-${index}`} className={material.kind.includes("check") ? "gate" : ""}><span>{material.kind === "Watch" ? <Video /> : material.kind === "Code" ? <Code2 /> : <FileText />}</span><div><b>{index + 1} · {material.kind}</b><p>{material.title}</p></div><CheckCircle2 /></article>)}{courseActivities.map((activity, index) => <article key={activity.id} className="programme-activity"><span>{activity.kind === "colab" ? <Code2 /> : <FlaskConical />}</span><div><b>{materials.length + index + 1} · {activity.kind === "colab" ? "Colab" : "Virtual lab"}</b><p>{activity.title}</p></div>{activity.required ? <ShieldCheck /> : <CheckCircle2 />}</article>)}{assessmentModes.length > 0 && <article className="gate"><span><FileCheck2 /></span><div><b>{materials.length + courseActivities.length + 1} · Assessment</b><p>{assessmentModes.join(" · ")}</p></div><ShieldCheck /></article>}</div><div className="release-rule"><ShieldCheck /><p><b>Progress rule</b>{gateRequired ? "Learners must meet the pass mark before the next activity unlocks." : "Activities are available without a required assessment gate."}</p></div><button className="dialog-primary" onClick={() => setStep("review")}>Review draft course</button></aside>

    <Dialog open={Boolean(previewPractical)} onOpenChange={(open) => !open && setPreviewPractical(null)}><DialogContent className="virtual-lab-dialog"><DialogHeader><p className="eyebrow">PROGRAMME DESIGN · FACILITATOR PREVIEW</p><DialogTitle>{previewPractical?.title}</DialogTitle><DialogDescription>Test the complete learner activity before adding it to this programme</DialogDescription></DialogHeader>{previewPractical && <VirtualPracticalRunner key={`studio-preview-${previewPractical.id}`} practical={previewPractical} preview onSubmitted={async () => {}} onPreviewComplete={() => setPreviewedPracticalIds((items) => items.includes(previewPractical.id) ? items : [...items, previewPractical.id])} />}</DialogContent></Dialog>

    <Dialog open={Boolean(previewResource)} onOpenChange={(open) => { if (!open) { setPreviewResource(null); setResourceTranscript(""); setTranscriptFileName(""); setTranscriptSource(""); } }}><DialogContent className="resource-dialog"><DialogHeader><p className="eyebrow">QUALITY, LICENCE AND TRANSCRIPT REVIEW</p><DialogTitle>{previewResource?.title}</DialogTitle><DialogDescription>{previewResource?.source} · {previewResource?.license}</DialogDescription></DialogHeader><div className={previewResource?.type === "Watch" ? "resource-transcript-layout" : ""}><div><div className="resource-frame"><iframe src={previewResource?.url} title={previewResource?.title ?? "Open resource review"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div><button className="frame-fallback" onClick={() => previewResource && window.open(previewResource.externalUrl, "_blank", "noopener,noreferrer")}>{previewResource?.source.includes("YouTube") ? "Open on YouTube and select Show transcript" : "Open original source if the frame is restricted"}</button></div>{previewResource?.type === "Watch" && <section className="transcript-authoring"><div><p className="eyebrow">ACCESSIBLE VIDEO TRANSCRIPT</p><h3>Extract, review and decide whether to publish</h3><p>Retrieve an available YouTube caption track, correct it for accuracy, then publish it with the video or keep it facilitator-only.</p></div>{previewResource.source.includes("YouTube") && <button className="extract-transcript" disabled={extractingTranscript} onClick={extractYoutubeTranscript}><FileText /> {extractingTranscript ? "Extracting captions…" : "Extract available YouTube transcript"}</button>}<div className="transcript-actions"><label>Transcript language<select value={transcriptLanguage} onChange={(event) => setTranscriptLanguage(event.target.value)}><option>English</option><option>French</option><option>Akan</option><option>Other</option></select></label><label className="transcript-upload"><FileText /> {transcriptFileName || "Import TXT, SRT or VTT"}<input type="file" accept=".txt,.srt,.vtt,text/plain,text/vtt,application/x-subrip" onChange={(event) => handleTranscriptFile(event.target.files?.[0])} /></label></div><label>Editable transcript for facilitator review<textarea value={resourceTranscript} onChange={(event) => { setResourceTranscript(event.target.value); if (!transcriptSource) setTranscriptSource("Facilitator edited"); }} placeholder="Extract available captions, paste a transcript, or import a caption file. Keep useful timestamps, for example: 00:01:15 — Key concept…" /></label><div className={`transcript-publish-choice ${publishTranscript ? "enabled" : ""}`}><div><b>Publish transcript with this video</b><span>{publishTranscript ? "Learners will see the reviewed transcript beside the embedded video." : "The transcript remains in the facilitator course record and learners see the video only."}</span></div><Switch checked={publishTranscript} onCheckedChange={setPublishTranscript} /></div><footer><span>{resourceTranscript.split(/\s+/).filter(Boolean).length} words · {transcriptSource || "No source yet"}</span><b>{resourceTranscript.trim() ? "Ready for facilitator decision" : publishTranscript ? "Transcript required to publish" : "Video-only publishing selected"}</b></footer></section>}</div><div className="judgement-grid"><label><input type="checkbox" defaultChecked /> Relevant to learning outcomes</label><label><input type="checkbox" defaultChecked /> Appropriate academic quality</label><label><input type="checkbox" defaultChecked /> Licence and attribution checked</label><label><input type="checkbox" defaultChecked /> Transcript reviewed for accuracy</label></div><div className="publish-actions"><button className="secondary-action" onClick={() => setPreviewResource(null)}>Reject resource</button><button className="dialog-primary" onClick={() => previewResource && addResource(previewResource)}><CheckCircle2 /> {publishTranscript ? "Publish video with transcript" : "Publish video only"}</button></div></DialogContent></Dialog>
  </div>;
}

function IdentityRegister() {
  const [cases, setCases] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/identity-register");
      const result = await response.json() as { cases?: VerificationRecord[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "The identity register could not be loaded.");
      setCases(result.cases ?? []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "The identity register could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const decide = async (email: string, decision: "approve" | "reject") => {
    const response = await fetch("/api/admin/identity-verifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, decision }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return toast.error(result.error ?? "The verification decision could not be saved.");
    toast.success(decision === "approve" ? "Identity verified" : "Identity not verified"); await load();
  };
  return <section className="page-panel identity-register"><div className="page-title"><div><p className="eyebrow">RESTRICTED VERIFICATION REGISTER</p><h2>National ID and live-photo album</h2><p>Compare each assigned pair side by side. Access is recorded and restricted to authorised reviewers.</p></div><span className="access-badge"><ShieldCheck /> {cases.length} assigned</span></div>{loading && <div className="empty-state">Loading protected identity cases…</div>}<div className="identity-album">{cases.map((record) => <article key={record.email}><header><div className="verification-person"><span>{record.full_name.split(/\s+/).map((part) => part[0]).slice(0,2).join("")}</span><div><b>{record.full_name}</b><p>{record.role} · {record.email}</p><small>{record.nationality} · {record.gender} · Born {record.date_of_birth} · {record.id_type} ending {record.id_last4}</small></div></div><em>Pending comparison</em></header><div className="album-pair"><section><b>National ID</b><iframe src={`/api/admin/identity-file?email=${encodeURIComponent(record.email)}&kind=id`} title={`${record.full_name} national ID`} /></section><section><b>Live selfie</b><img src={`/api/admin/identity-file?email=${encodeURIComponent(record.email)}&kind=selfie`} alt={`Live verification selfie submitted by ${record.full_name}`} /></section></div><div className="album-bio"><span><b>Date of birth</b>{record.date_of_birth}</span><span><b>Phone</b>{record.phone}</span><span><b>Address</b>{record.address || "Not provided"}</span></div><footer><button className="reject" onClick={() => decide(record.email, "reject")}>Not verified</button><button className="approve" onClick={() => decide(record.email, "approve")}><CheckCircle2 /> Verify identity</button></footer></article>)}{!loading && cases.length === 0 && <div className="empty-state">No identity cases are assigned to you.</div>}</div></section>;
}

function TestingSandbox({ onCourse, onLive, onAssessment, onFacilitator }: { onCourse: (course: Course) => void, onLive: () => void, onAssessment: () => void, onFacilitator: () => void }) {
  const demoCourses = courses.filter((course) => course.code.startsWith("DEMO"));
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const mark = (key: string, action: () => void) => { setChecks((items) => ({ ...items, [key]: true })); action(); };
  const tests = [
    { key: "mixed", label: "Watch, read and code", detail: "Open DEMO 101 and switch between all three activity modes.", action: () => onCourse(demoCourses[0]) },
    { key: "gate", label: "Objective progression gate", detail: "Pause the lesson, answer the compulsory item and unlock progression.", action: () => onCourse(demoCourses[2]) },
    { key: "live", label: "Live classroom room", detail: "Open the scheduled-room details and launch attendance tracking.", action: onLive },
    { key: "assessment", label: "Objective and optional essay", detail: "Open a dummy assessment attempt and save a response.", action: onAssessment },
    { key: "facilitator", label: "Facilitator publishing", detail: "Search resources, preview an iframe and publish the dummy module.", action: onFacilitator },
  ];
  return <div className="testing-layout">
    <section className="page-panel"><div className="page-title"><div><p className="eyebrow">SAFE TEST DATA</p><h2>Feature testing sandbox</h2><p>Use these dummy courses to test platform behaviour without affecting academic records.</p></div><button className="secondary-action" onClick={() => { setChecks({}); toast.success("Sandbox progress reset"); }}><Settings size={17} /> Reset tests</button></div>
      <div className="demo-course-grid">{demoCourses.map((course) => <article key={course.code}><div className={`demo-icon ${course.accent}`}><BookOpen /></div><span>{course.code} · TEST COURSE</span><h3>{course.title}</h3><p>{course.school}</p><Progress value={course.progress} /><button onClick={() => onCourse(course)}>Open dummy course <ChevronRight /></button></article>)}</div>
    </section>
    <aside className="test-checklist"><div className="test-header"><div><p className="eyebrow">INTERACTION CHECKLIST</p><h2>{Object.values(checks).filter(Boolean).length} of {tests.length} tested</h2></div><Progress value={(Object.values(checks).filter(Boolean).length / tests.length) * 100} /></div>
      <div className="test-items">{tests.map((test, index) => <button key={test.key} className={checks[test.key] ? "passed" : ""} onClick={() => mark(test.key, test.action)}><span>{checks[test.key] ? <CheckCircle2 /> : index + 1}</span><div><b>{test.label}</b><p>{test.detail}</p></div><ChevronRight /></button>)}</div>
      <div className="sandbox-note"><ShieldCheck /><p><b>Testing mode</b>All results are dummy interactions. Resetting removes only the checklist indicators.</p></div>
    </aside>
  </div>;
}

function ProfileEditor({ profile, onUpdated }: { profile: AccountProfile; onUpdated: (profile: AccountProfile) => void }) {
  const [form, setForm] = useState({ fullName: profile.fullName, dateOfBirth: profile.dateOfBirth ?? "", gender: profile.gender ?? "", nationality: profile.nationality ?? "Ghanaian", phone: profile.phone ?? "", address: profile.address ?? "", idType: profile.idType ?? "Ghana Card", idNumber: "", consent: false });
  const [idDocumentKey, setIdDocumentKey] = useState("");
  const [selfieKey, setSelfieKey] = useState("");
  const [uploading, setUploading] = useState<"id" | "selfie" | null>(null);
  const [saving, setSaving] = useState(false);
  const replacingIdentity = Boolean(idDocumentKey || selfieKey);
  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const upload = async (file: File | undefined, kind: "id" | "selfie") => {
    if (!file) return;
    setUploading(kind);
    const body = new FormData(); body.append("file", file); body.append("kind", kind === "id" ? "national-id" : "selfie");
    try {
      const response = await fetch("/api/identity-uploads", { method: "POST", body });
      const result = await response.json() as { key?: string; error?: string };
      if (!response.ok || !result.key) throw new Error(result.error ?? "Identity evidence could not be uploaded.");
      if (kind === "id") setIdDocumentKey(result.key); else setSelfieKey(result.key);
      toast.success(kind === "id" ? "National ID ready" : "Live selfie ready", { description: "Submit the profile to send both items for restricted verification." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Identity evidence could not be uploaded."); }
    finally { setUploading(null); }
  };
  const save = async () => {
    const required = [form.fullName, form.dateOfBirth, form.gender, form.nationality, form.phone, form.address];
    if (required.some((value) => !value.trim())) return toast.error("Complete every required biodata field.");
    if (replacingIdentity && (!idDocumentKey || !selfieKey || !form.idNumber.trim() || !form.consent)) return toast.error("Upload both identity images, enter the ID number and confirm consent.");
    setSaving(true);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: form.fullName, dateOfBirth: form.dateOfBirth, gender: form.gender, nationality: form.nationality, phone: form.phone, address: form.address, ...(replacingIdentity ? { idType: form.idType, idLast4: form.idNumber.slice(-4), idDocumentKey, selfieKey } : {}) }) });
      const result = await response.json() as { profile?: { email: string; full_name: string; role: PortalRole; status: string; identity_status?: string; date_of_birth?: string; gender?: string; nationality?: string; phone?: string; address?: string; id_type?: string; id_last4?: string }; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error ?? "The profile could not be saved.");
      onUpdated({ email: result.profile.email, fullName: result.profile.full_name, role: result.profile.role, status: result.profile.status, identityStatus: result.profile.identity_status, dateOfBirth: result.profile.date_of_birth, gender: result.profile.gender, nationality: result.profile.nationality, phone: result.profile.phone, address: result.profile.address, idType: result.profile.id_type, idLast4: result.profile.id_last4 });
      setIdDocumentKey(""); setSelfieKey(""); setForm((current) => ({ ...current, idNumber: "", consent: false }));
      toast.success(replacingIdentity ? "Profile saved and identity review requested" : "Profile details saved", { description: replacingIdentity ? "An assigned UCC reviewer will compare the national ID and live selfie." : "Your permanent biodata is up to date." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "The profile could not be saved."); }
    finally { setSaving(false); }
  };
  const status = (profile.identityStatus ?? "not_submitted").replaceAll("_", " ");
  return <div className="profile-editor"><div className="profile-summary"><span className="avatar large">{profile.fullName.split(/\s+/).map((part) => part[0]).slice(0,2).join("")}</span><div><h3>{profile.fullName}</h3><p>{profile.email} · {profile.role}</p><span className={`identity-status ${profile.identityStatus ?? "not_submitted"}`}><ShieldCheck /> Identity {status}</span></div></div><section><p className="eyebrow">PERMANENT BIO DATA</p><div className="profile-form-grid"><label>Full legal name<input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} /></label><label>Verified sign-in email<input value={profile.email} readOnly /></label><label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} /></label><label>Gender<select value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label><label>Nationality<input value={form.nationality} onChange={(event) => update("nationality", event.target.value)} /></label><label>Phone number<input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label><label className="full-field">Residential address<textarea value={form.address} onChange={(event) => update("address", event.target.value)} /></label></div></section><section className="profile-evidence"><div><p className="eyebrow">IDENTITY EVIDENCE</p><h3>Submit new evidence for verification</h3><p>Your current ID is recorded as {profile.idType ?? "national ID"}{profile.idLast4 ? ` ending ${profile.idLast4}` : ""}. Uploading new evidence requires both the ID and a current live selfie.</p></div><div className="identity-grid"><label>ID type<select value={form.idType} onChange={(event) => update("idType", event.target.value)}><option>Ghana Card</option><option>Passport</option><option>National ID</option></select></label><label>ID number<input value={form.idNumber} onChange={(event) => update("idNumber", event.target.value)} placeholder="Only the last four digits are retained" /></label></div><div className="evidence-grid"><label className={idDocumentKey ? "evidence-ready" : ""}><FileText /><b>{idDocumentKey ? "National ID ready" : "Upload national ID"}</b><span>Clear front image or PDF · maximum 8 MB</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => upload(event.target.files?.[0], "id")} />{uploading === "id" && <em>Uploading securely…</em>}</label><LiveSelfieCapture ready={Boolean(selfieKey)} uploading={uploading === "selfie"} onCaptured={(file) => upload(file, "selfie")} /></div>{replacingIdentity && <label className="identity-consent"><input type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)} /><span>I consent to restricted UCC processing of my national ID and facial image for identity verification.</span></label>}</section><button className="dialog-primary profile-save" disabled={saving || Boolean(uploading)} onClick={save}><ShieldCheck /> {saving ? "Saving profile…" : replacingIdentity ? "Save and submit for verification" : "Save profile details"}</button></div>;
}

function UtilityDialog({ value, profile, onProfileUpdated, onClose }: { value: "notifications" | "support" | "preferences" | "profile" | "assessment" | null; profile: AccountProfile; onProfileUpdated: (profile: AccountProfile) => void; onClose: () => void }) {
  const title = value === "notifications" ? "Notifications" : value === "support" ? "Learning support" : value === "preferences" ? "Preferences" : value === "profile" ? `${profile.role === "learner" ? "Learner" : profile.role === "facilitator" ? "Facilitator" : "Administrator"} profile` : "Assessment attempt";
  return <Dialog open={Boolean(value)} onOpenChange={(open) => !open && onClose()}><DialogContent className={value === "profile" ? "utility-dialog profile-dialog" : "utility-dialog"}><DialogHeader><p className="eyebrow">UCC MICROCREDENTIALS</p><DialogTitle>{title}</DialogTitle><DialogDescription>{value === "assessment" ? "Complete the objective item and optional essay response." : value === "profile" ? "Complete biodata and submit current identity evidence for restricted UCC verification." : "Manage this area without leaving your learning workspace."}</DialogDescription></DialogHeader>
    {value === "notifications" && <div className="utility-list"><button onClick={() => toast.success("Marked as read")}><FileCheck2 /><div><b>Assessment due Friday</b><span>Digital Pedagogy · 28 August</span></div></button><button onClick={() => toast.success("Reminder saved")}><Video /><div><b>Live session tomorrow</b><span>10:00 GMT · Join from Live sessions</span></div></button></div>}
    {value === "support" && <div className="support-form"><label>How can we help?<select defaultValue="learning"><option value="learning">Learning activity</option><option value="assessment">Assessment or feedback</option><option value="technical">Technical access</option></select></label><label>Message<textarea placeholder="Describe the issue and the support team will respond." /></label><button className="dialog-primary" onClick={() => { toast.success("Support request submitted"); onClose(); }}>Send support request</button></div>}
    {value === "preferences" && <div className="preference-list"><label><div><b>Assessment reminders</b><span>Notify me 48 hours before a deadline</span></div><Switch defaultChecked /></label><label><div><b>Live-class reminders</b><span>Notify me 15 minutes before a session</span></div><Switch defaultChecked /></label><label><div><b>Weekly progress email</b><span>Receive a summary every Monday</span></div><Switch /></label><button className="dialog-primary" onClick={() => { toast.success("Preferences saved"); onClose(); }}>Save preferences</button></div>}
    {value === "profile" && <ProfileEditor profile={profile} onUpdated={onProfileUpdated} />}
    {value === "assessment" && <div className="knowledge-check"><span className="check-count">OBJECTIVE QUESTION · REQUIRED</span><h3>Which element must be approved before a UCC microcredential is delivered?</h3>{["Programme title only", "Learning outcomes and assessment", "Social media campaign", "External logo"].map((option) => <label key={option}><input type="radio" name="assessment-dialog" />{option}</label>)}<details><summary>Optional essay question</summary><textarea placeholder="Explain how quality assurance supports learner trust…" /></details><button className="dialog-primary" onClick={() => { toast.success("Assessment response saved"); onClose(); }}>Save response</button></div>}
  </DialogContent></Dialog>;
}

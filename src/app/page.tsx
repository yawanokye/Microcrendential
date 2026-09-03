"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Activity, Award, Beaker, Bell, BookOpen, CalendarDays, CheckCircle2, ChevronRight, CirclePlay, ClipboardCheck, Clock3,
  Code2, Eye, FileCheck2, FileText, FlaskConical, Gauge, GraduationCap, GripVertical, HeartPulse, LayoutDashboard, Menu,
  MessageSquareText, Microscope, Pencil, QrCode, RotateCcw, Search, Settings, ShieldCheck, Sigma, Stethoscope, Undo2, Upload, Users, Video, Wrench, X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { defaultCourseDesign, evaluateCourseQuality, type CourseDesign, type CourseMaterialRecord } from "@/lib/course-design";
import { labDisciplines, virtualPracticals, type LabDiscipline, type VirtualPractical } from "@/lib/virtual-labs";

type PairItem = { left: string; right: string; image?: string };
type AssessmentQuestion = { id: string; type: string; prompt: string; options: string[]; correctAnswer: string; points: number; scheme: string; feedbackCorrect: string; feedbackIncorrect: string; learnerAdvice: string; outcomeIds?: string[]; pairs?: PairItem[]; videoUrl?: string; videoMode?: "whole" | "part" | "pause"; videoStart?: number; videoEnd?: number; whiteboardEnabled?: boolean };
type CourseMaterial = CourseMaterialRecord;
type CourseActivity = { id: string; kind: "colab" | "virtual_lab"; title: string; instructions: string; required: boolean; passMark: number; attemptsAllowed: number; maxMark?: number; dueAt?: string; rubric?: string; notebookKey?: string; notebookFileName?: string; templateUrl?: string; practicalId?: string; discipline?: string };
type Course = { code: string; title: string; school: string; progress: number; modules: string; accent: string; next: string; discipline?: string; published?: boolean; description?: string; materials?: CourseMaterial[]; activities?: CourseActivity[]; assessmentConfig?: { passMark?: number; attempts?: string; questions?: AssessmentQuestion[] }; design?: CourseDesign; facilitatorName?: string; createdByEmail?: string; certificateEnabled?: boolean; status?: string; id?: number; versionNumber?: number; updatedAt?: string };
type ColabAssignment = { id: number; courseCode: string; courseTitle: string; title: string; instructions: string; templateFileName: string; templateUrl?: string | null; openUrl: string; directOpen: boolean; rubric: string; maxMark: number; passMark: number; attemptsAllowed: number; dueAt?: string | null; status: string; createdByEmail: string; createdAt: string; latestSubmission?: { id: number; status: string; mark?: number | null; passed: boolean; attemptNumber: number; feedback: string } | null };
type ColabSubmission = { id: number; assignmentId: number; assignmentTitle: string; courseCode: string; courseTitle: string; learnerEmail: string; learnerName: string; attemptNumber: number; submissionType: "file" | "link"; notebookFileName?: string | null; notebookUrl?: string | null; status: string; mark?: number | null; passed: boolean; feedback: string; maxMark: number; passMark: number; submittedAt: string; assessedAt?: string | null };
type VirtualLabSubmission = { id: number; practicalId: string; discipline: string; practicalTitle: string; learnerEmail: string; learnerName: string; attemptNumber: number; observations: { trial?: string; input?: number; result?: number; note?: string }[]; answers: Record<string, unknown>; report: string; evidenceFileName?: string | null; status: string; mark?: number | null; passed: boolean; feedback: string; competencyNote: string; submittedAt: string; assessedAt?: string | null };
type LabObservation = { trial: string; input: number; result: number; note: string };
type PortalRole = "learner" | "facilitator" | "admin";

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

type PortalNavItem = { id: string; label: string; icon: typeof LayoutDashboard };
type PortalNavGroup = { label: string; items: PortalNavItem[] };

const roleNavigation: Record<PortalRole, PortalNavGroup[]> = {
  learner: [
    { label: "My journey", items: [
      { id: "overview", label: "Learning home", icon: LayoutDashboard },
      { id: "learning", label: "My microcredentials", icon: BookOpen },
      { id: "passport", label: "Skills passport", icon: ShieldCheck },
      { id: "assessments", label: "Assessments", icon: FileCheck2 },
      { id: "certificates", label: "Credential wallet", icon: Award },
    ] },
    { label: "Learning activities", items: [
      { id: "live", label: "Live sessions", icon: Video },
      { id: "colab", label: "Colab activities", icon: Code2 },
      { id: "virtual_labs", label: "Virtual practicals", icon: FlaskConical },
      { id: "discussions", label: "Learning community", icon: MessageSquareText },
    ] },
  ],
  facilitator: [
    { label: "Teaching", items: [
      { id: "overview", label: "Teaching home", icon: LayoutDashboard },
      { id: "facilitator", label: "Course studio", icon: BookOpen },
      { id: "colab", label: "Colab assessment", icon: Code2 },
      { id: "virtual_labs", label: "Practical assessment", icon: FlaskConical },
      { id: "live", label: "Live facilitation", icon: Video },
      { id: "discussions", label: "Learner community", icon: MessageSquareText },
      { id: "cohorts", label: "Cohort intelligence", icon: Activity },
    ] },
    { label: "Quality duties", items: [
      { id: "verification", label: "Assigned ID reviews", icon: ShieldCheck },
      { id: "testing", label: "Course testing", icon: Settings },
    ] },
  ],
  admin: [
    { label: "Governance", items: [
      { id: "overview", label: "Operations home", icon: LayoutDashboard },
      { id: "admin", label: "Users & access", icon: Users },
      { id: "course_admin", label: "Course approvals", icon: CheckCircle2 },
      { id: "verification", label: "Identity governance", icon: ShieldCheck },
      { id: "credential_registry", label: "Credential registry", icon: Award },
    ] },
    { label: "Quality oversight", items: [
      { id: "colab", label: "Assessment oversight", icon: Code2 },
      { id: "virtual_labs", label: "Practical oversight", icon: FlaskConical },
      { id: "analytics", label: "Platform analytics", icon: Activity },
      { id: "testing", label: "Platform assurance", icon: Settings },
    ] },
  ],
};

type LearningResource = { type: "Watch" | "Read" | "Code"; title: string; source: string; license: string; url: string; externalUrl: string; transcript?: string; transcriptLanguage?: string };
type AccountProfile = { email: string; fullName: string; role: PortalRole; status: string; identityStatus?: string; dateOfBirth?: string; gender?: string; nationality?: string; phone?: string; address?: string; idType?: string; idLast4?: string; studentNumber?: string; educationLevel?: string; occupation?: string; organisation?: string; interests?: string[]; preferredLanguage?: string; accessibilityNeeds?: string };
type AccountSession = { authenticated: boolean; identity?: { email: string; fullName: string }; profile?: AccountProfile | null; enrollments?: string[] };
type DashboardSummary = { role: PortalRole; metrics: Record<string, number> };

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
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [selectedSession, setSelectedSession] = useState<(typeof liveSessions)[number] | null>(null);
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
  useEffect(() => { setActive("overview"); }, [role]);
  useEffect(() => {
    if (account?.profile?.status !== "active") return;
    fetch("/api/courses").then((response) => response.json()).then((result: { courses?: { id: number; code: string; title: string; discipline: string; description: string; materials: Course["materials"]; activities: Course["activities"]; assessmentConfig: Course["assessmentConfig"]; design: CourseDesign; questionLimit: number; certificateEnabled: boolean; status: string; facilitatorName: string; createdByEmail: string; versionNumber: number; updatedAt: string }[] }) => setPublishedCourses((result.courses ?? []).filter((course) => course.status === "active").map((course, index) => ({ id: course.id, code: course.code, title: course.title, discipline: course.discipline, description: course.description, materials: course.materials, activities: course.activities, assessmentConfig: course.assessmentConfig, design: course.design, certificateEnabled: course.certificateEnabled, status: course.status, facilitatorName: course.facilitatorName, createdByEmail: course.createdByEmail, versionNumber: course.versionNumber, updatedAt: course.updatedAt, school: `Facilitator: ${course.facilitatorName}`, progress: 0, modules: `${(course.materials?.length ?? 0) + (course.activities?.length ?? 0)} learning activities`, accent: ["teal", "blue", "gold"][index % 3], next: "Open active course", published: true })))).catch(() => setPublishedCourses([]));
    fetch("/api/dashboard/summary").then((response) => response.json()).then((result: DashboardSummary) => setDashboardSummary(result)).catch(() => setDashboardSummary(null));
  }, [account?.profile?.email, account?.profile?.status]);
  const enrolledCodes = account?.enrollments ?? [];
  // Production learners see only administrator-approved database courses.
  // Static demonstration courses remain isolated inside the staff testing area.
  const allCourses = publishedCourses;
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
  if (!account.authenticated) return <PublicLanding inviteToken={inviteToken} />;
  if (!account.profile && requestedPortal === "admin") return <PortalRoleMismatch requestedRole="admin" email={account.identity?.email ?? ""} />;
  if (!account.profile && requestedPortal === "facilitator" && !inviteToken) return <PortalRoleMismatch requestedRole="facilitator" email={account.identity?.email ?? ""} />;
  if (!account.profile) return <StudentRegistrationHandoff email={account.identity?.email ?? ""} />;
  if (account.profile.role === "facilitator" && account.profile.status === "pending_setup") return <IdentityRegistration role="facilitator" initialName={account.profile.fullName} email={account.profile.email} inviteToken={inviteToken} onComplete={(profile) => setAccount((current) => ({ authenticated: true, identity: current?.identity, profile, enrollments: [] }))} />;
  if (requestedPortal === "admin" && account.profile.role !== "admin") return <PortalRoleMismatch requestedRole="admin" email={account.profile.email} />;
  if (requestedPortal === "facilitator" && account.profile.role !== "facilitator" && account.profile.role !== "admin") return <PortalRoleMismatch requestedRole="facilitator" email={account.profile.email} />;
  if (account.profile.status === "pending_verification") return <VerificationPending role={account.profile.role} email={account.profile.email} />;
  if (account.profile.status !== "active") return <SuspendedAccess email={account.profile.email} status={account.profile.status} />;
  const displayName = account.profile.fullName;
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const navigationGroups = roleNavigation[role];
  const allowedNav = navigationGroups.flatMap((group) => group.items);
  const todayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  const roleLabel = role === "admin" ? "System administrator" : role === "facilitator" ? "Facilitator" : "Student";
  const roleMessage = role === "learner"
    ? "Build your skills passport, continue an active microcredential, or discover your next career-relevant course."
    : role === "facilitator"
      ? "Design quality-assured learning, guide participants, and assess authentic evidence."
      : "Govern access, approve academic offerings, and monitor institutional quality.";
  const primaryDestination = role === "learner" ? "learning" : role === "facilitator" ? "facilitator" : "admin";

  return (
    <main className="portal-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><GraduationCap size={25} /></div><div><strong>UCC Microcredentials</strong><span>{roleLabel} Portal · Learn · Demonstrate · Progress</span></div></div>
        <div className="top-actions">
          {role !== "admin" && <label className="searchbox"><Search size={18} /><input value={role === "facilitator" ? resourceQuery : query} onChange={(event) => role === "facilitator" ? setResourceQuery(event.target.value) : setQuery(event.target.value)} placeholder={role === "facilitator" ? "Search teaching resources" : "Search your learning"} aria-label={role === "facilitator" ? "Search teaching resources" : "Search your learning"} /></label>}
          <button className="icon-button" aria-label="Notifications" onClick={() => setUtility("notifications")}><Bell size={19} /><i /></button>
          <span className={`account-role ${role}`}><ShieldCheck /> {roleLabel}</span>
          <button className="profile-chip" onClick={() => setUtility("profile")}><span>{initials || "UC"}</span><b>{displayName}</b></button>
          <a className="signout-link" href="/signout-with-chatgpt?return_to=%2F">Sign out</a>
          <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open navigation">{mobileOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <aside className={`side-nav ${mobileOpen ? "open" : ""}`}>
        {navigationGroups.map((group, index) => <div className="nav-group" key={group.label}>{index > 0 && <div className="nav-divider" />}<p className="nav-label">{group.label}</p><nav aria-label={`${group.label} navigation`}>{group.items.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => selectView(item.id)} className={active === item.id ? "active" : ""}><Icon size={19} /><span>{item.label}</span></button>; })}</nav></div>)}
        <div className="nav-divider" /><p className="nav-label">Help & account</p>
        <nav><button onClick={() => setUtility("support")}><Users size={19} /><span>{role === "learner" ? "Student support" : role === "facilitator" ? "Teaching support" : "Platform support"}</span></button><button onClick={() => setUtility("preferences")}><Settings size={19} /><span>Preferences</span></button></nav>
        <button className="qa-card" onClick={() => toast.success("Quality controls active", { description: role === "learner" ? "Your assessed learning and credential records are protected." : "Role permissions, evidence controls and academic review are enabled." })}><FileCheck2 size={20} /><div><b>{role === "learner" ? "Verified achievement" : role === "facilitator" ? "Assessment integrity" : "Governance controls"}</b><span>{role === "learner" ? "Assessment-backed credentials" : "UCC quality assurance active"}</span></div></button>
      </aside>

      <section className="workspace">
        <div className={`welcome-row role-welcome ${role}`}><div><p className="eyebrow">{roleLabel.toUpperCase()} PORTAL · {todayLabel.toUpperCase()}</p><h1>Welcome back, {displayName.split(" ")[0]}</h1><p>{roleMessage}</p></div><button className="primary-action" onClick={() => selectView(primaryDestination)}><CirclePlay size={18} /> {role === "learner" ? "Resume learning" : role === "facilitator" ? "Open course studio" : "Open administration"}</button></div>

        <Tabs value={active} onValueChange={setActive} className="content-tabs">
          <TabsList variant="line" className="mobile-tabs" aria-label="Dashboard sections">{allowedNav.slice(0, 4).map((item) => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList>
          <TabsContent value="overview"><RoleOverview role={role} summary={dashboardSummary} courses={filteredCourses} onNavigate={selectView} onCourse={setSelectedCourse} onSession={setSelectedSession} /></TabsContent>
          {role === "learner" && <TabsContent value="learning"><div className="learning-stack"><div className="page-panel"><div className="page-title"><div><p className="eyebrow">ASYNCHRONOUS LEARNING</p><h2>My microcredentials</h2><p>Work through course materials, activities and assessments at your pace.</p></div><label className="inline-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a course" /></label></div><div className="course-card-grid">{filteredCourses.map((course) => <CourseCard key={course.code} course={course} onOpen={() => setSelectedCourse(course)} />)}{filteredCourses.length === 0 && <div className="empty-state wide">You have not enrolled in an active microcredential yet. Choose an open course below.</div>}</div></div><OpenCourseCatalog courses={allCourses} enrolledCodes={enrolledCodes} query={query} onEnrol={enrolCourse} onOpen={setSelectedCourse} /></div></TabsContent>}
          {role === "learner" && <TabsContent value="passport"><SkillsPassport /></TabsContent>}
          {role === "learner" && <TabsContent value="certificates"><CertificateWallet /></TabsContent>}
          {(role === "learner" || role === "facilitator") && <TabsContent value="live"><div className="page-panel"><div className="page-title"><div><p className="eyebrow">SYNCHRONOUS LEARNING</p><h2>{role === "learner" ? "Live sessions" : "Live facilitation"}</h2><p>{role === "learner" ? "Join scheduled classes, clinics and academic discussions." : "Prepare and host scheduled learner sessions and academic clinics."}</p></div><button className="secondary-action" onClick={downloadCalendar}><CalendarDays size={17} /> Add calendar feed</button></div><div className="live-grid">{liveSessions.map((session) => <LiveCard key={session.title} session={session} onOpen={() => setSelectedSession(session)} />)}</div></div></TabsContent>}
          {role === "learner" && <TabsContent value="assessments"><Assessments onOpen={() => setUtility("assessment")} /></TabsContent>}
          <TabsContent value="colab"><ColabWorkspace role={role} email={account.profile.email} /></TabsContent>
          <TabsContent value="virtual_labs"><VirtualLabsWorkspace role={role} /></TabsContent>
          {(role === "learner" || role === "facilitator") && <TabsContent value="discussions"><Discussions /></TabsContent>}
          {role === "facilitator" && <TabsContent value="facilitator"><FacilitatorStudio email={account.profile.email} query={resourceQuery} setQuery={setResourceQuery} /></TabsContent>}
          {role === "facilitator" && <TabsContent value="cohorts"><CohortAnalytics role="facilitator" /></TabsContent>}
          {(role === "facilitator" || role === "admin") && <TabsContent value="verification"><IdentityRegister /></TabsContent>}
          {role === "admin" && <TabsContent value="admin"><AdminPortal onOpenRegister={() => selectView("verification")} /></TabsContent>}
          {role === "admin" && <TabsContent value="course_admin"><CourseApprovalPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="credential_registry"><CredentialRegistry /></TabsContent>}
          {role === "admin" && <TabsContent value="analytics"><CohortAnalytics role="admin" /></TabsContent>}
          {role !== "learner" && <TabsContent value="testing"><TestingSandbox onCourse={(course) => { setSelectedCourse(course); setLessonStage("content"); }} onLive={() => setSelectedSession(liveSessions[0])} onAssessment={() => role === "facilitator" ? setUtility("assessment") : selectView("course_admin")} onFacilitator={() => selectView(role === "facilitator" ? "facilitator" : "course_admin")} /></TabsContent>}
        </Tabs>

        <Dialog open={Boolean(selectedCourse)} onOpenChange={(open) => !open && setSelectedCourse(null)}>
          <DialogContent className="learning-dialog">
            <DialogHeader><p className="eyebrow">{selectedCourse?.code}</p><DialogTitle>{selectedCourse?.title}</DialogTitle><DialogDescription>{selectedCourse?.school}</DialogDescription></DialogHeader>
            {selectedCourse?.published ? <PublishedCourseExperience course={selectedCourse} onOpenActivity={(activity) => { if (activity.kind === "virtual_lab" && activity.practicalId) sessionStorage.setItem("ucc-open-practical", activity.practicalId); setSelectedCourse(null); selectView(activity.kind === "colab" ? "colab" : "virtual_labs"); }} /> : <>
            <div className="module-progress"><div><span>Course progress</span><b>{selectedCourse?.progress}%</b></div><Progress value={selectedCourse?.progress ?? 0} /></div>
            {lessonStage === "content" && <><div className="lesson-tabs"><button className={activityMode === "watch" ? "active" : ""} onClick={() => setActivityMode("watch")}><Video /> Watch</button><button className={activityMode === "read" ? "active" : ""} onClick={() => setActivityMode("read")}><FileText /> Read</button><button className={activityMode === "code" ? "active" : ""} onClick={() => setActivityMode("code")}><Code2 /> Code</button></div>{activityMode === "watch" && <div className="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/aircAruvnKk" title="Open learning video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>}{activityMode === "read" && <article className="reading-frame"><p className="eyebrow">OPEN READING</p><h3>Assessment-led certification</h3><p>A credible microcredential certifies demonstrated learning rather than attendance. Learning outcomes, authentic assessment and recorded decisions provide the evidence needed for recognition and progression.</p></article>}{activityMode === "code" && <div className="code-frame"><span>practice.js</span><textarea defaultValue={'const credential = {\n  outcomes: true,\n  assessed: true,\n  stackable: true\n};\n\nconsole.log(credential);'} aria-label="Practice code editor" /></div>}<p className="activity-note">Pause, replay and take notes as needed. The short knowledge check must be passed before the next activity unlocks.</p><button className="dialog-primary" onClick={() => setLessonStage("check")}><FileCheck2 size={17} /> Pause and check understanding</button></>}
            {lessonStage === "check" && <div className="knowledge-check"><span className="check-count">REQUIRED CHECK · 1 OF 1</span><h3>Which feature makes a microcredential academically trustworthy?</h3>{["A short completion time", "Assessed learning outcomes", "A social-media badge", "An unrestricted open link"].map((option) => <label key={option} className={answer === option ? "chosen" : ""}><input type="radio" name="knowledge-check" value={option} checked={answer === option} onChange={(event) => { setAnswer(event.target.value); setAnswerState("idle"); }} />{option}</label>)}{answerState === "incorrect" && <p className="feedback error">Not quite. Review the role of assessment and try again.</p>}{answerState === "correct" && <p className="feedback success">Correct. The next learning activity is now unlocked.</p>}<button className="dialog-primary" disabled={!answer} onClick={() => { if (answer === "Assessed learning outcomes") { setAnswerState("correct"); setLessonStage("complete"); } else setAnswerState("incorrect"); }}><FileCheck2 size={17} /> Submit answer</button><details><summary>Optional essay reflection</summary><textarea placeholder="Explain how authentic assessment could work in your professional context…" /></details></div>}
            {lessonStage === "complete" && <div className="lesson-complete"><CheckCircle2 /><h3>Checkpoint passed</h3><p>Your result has been recorded. You may now continue to the next learning activity.</p><button className="dialog-primary" onClick={() => { setLessonStage("content"); setAnswer(""); setAnswerState("idle"); }}><CirclePlay size={17} /> Continue to next activity</button></div>}</>}
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

function RoleOverview({ role, summary, courses: activeCourses, onNavigate, onCourse, onSession }: {
  role: PortalRole;
  summary: DashboardSummary | null;
  courses: Course[];
  onNavigate: (view: string) => void;
  onCourse: (course: Course) => void;
  onSession: (session: (typeof liveSessions)[number]) => void;
}) {
  const metric = (key: string) => summary ? String(summary.metrics[key] ?? 0) : "—";
  const cards = role === "learner" ? [
    { key: "activeEnrolments", label: "Active microcredentials", detail: "Courses currently in progress", icon: BookOpen, tone: "navy", target: "learning" },
    { key: "completedCourses", label: "Completed courses", detail: "Learning requirements completed", icon: CheckCircle2, tone: "teal", target: "certificates" },
    { key: "certificates", label: "Verified credentials", detail: "Available in your wallet", icon: Award, tone: "gold", target: "certificates" },
    { key: "pendingFeedback", label: "Awaiting feedback", detail: "Submitted practical or coding work", icon: Clock3, tone: "sky", target: "colab" },
  ] : role === "facilitator" ? [
    { key: "activeCourses", label: "Active courses", detail: "Approved learner offerings", icon: BookOpen, tone: "navy", target: "facilitator" },
    { key: "coursesInReview", label: "In academic review", detail: "Awaiting administrator decision", icon: FileCheck2, tone: "gold", target: "facilitator" },
    { key: "markingQueue", label: "Evidence to assess", detail: "Coding and practical submissions", icon: ClipboardCheck, tone: "teal", target: "colab" },
    { key: "identityReviews", label: "Assigned ID reviews", detail: "Restricted verification cases", icon: ShieldCheck, tone: "sky", target: "verification" },
  ] : [
    { key: "learners", label: "Registered learners", detail: "Across the credential portfolio", icon: GraduationCap, tone: "navy", target: "admin" },
    { key: "facilitators", label: "Facilitators", detail: "Teaching and assessment accounts", icon: Users, tone: "teal", target: "admin" },
    { key: "identityReviews", label: "Identity decisions", detail: "Awaiting assignment or review", icon: ShieldCheck, tone: "gold", target: "verification" },
    { key: "courseApprovals", label: "Course approvals", detail: "Academic activation required", icon: FileCheck2, tone: "sky", target: "course_admin" },
  ];

  return <div className={`role-overview ${role}`}>
    <div className="stat-grid role-stats">{cards.map((card) => { const Icon = card.icon; return <button key={card.key} onClick={() => onNavigate(card.target)}><span className={`stat-icon ${card.tone}`}><Icon /></span><div><strong>{metric(card.key)}</strong><span>{card.label}</span></div><small>{card.detail}</small></button>; })}</div>

    {role === "learner" && <div className="main-grid learner-home-grid">
      <section className="panel course-panel"><div className="panel-heading"><div><p className="eyebrow">PERSONALISED LEARNING PATH</p><h2>Continue where you stopped</h2></div><button onClick={() => onNavigate("learning")}>View my learning <ChevronRight size={16} /></button></div><div className="course-list">{activeCourses.slice(0, 3).map((course) => <CourseRow key={course.code} course={course} onOpen={() => onCourse(course)} />)}{activeCourses.length === 0 && <div className="empty-state action-empty"><BookOpen /><b>Your learning space is ready</b><span>Browse approved UCC microcredentials and enrol in the course that matches your goals.</span><button onClick={() => onNavigate("learning")}>Browse open courses</button></div>}</div></section>
      <section className="panel schedule-panel"><div className="panel-heading"><div><p className="eyebrow">NEXT ON YOUR SCHEDULE</p><h2>Live learning</h2></div><button onClick={() => onNavigate("live")}>Full calendar <ChevronRight size={16} /></button></div><div className="session-list">{liveSessions.slice(0, 2).map((session) => <button className="session-button" key={session.title} onClick={() => onSession(session)}><SessionRow session={session} /></button>)}</div><button className="learner-focus-card passport" onClick={() => onNavigate("passport")}><ShieldCheck /><div><b>Skills passport</b><span>Track stackable pathways and portable achievement evidence.</span></div><ChevronRight /></button><button className="learner-focus-card" onClick={() => onNavigate("assessments")}><FileCheck2 /><div><b>Assessment centre</b><span>Review requirements, submit work and track feedback.</span></div><ChevronRight /></button></section>
    </div>}

    {role === "facilitator" && <div className="role-priority-grid">
      <section className="page-panel role-command-panel"><div className="page-title"><div><p className="eyebrow">TEACHING OPERATIONS</p><h2>Your priority workspaces</h2><p>Move from course design to facilitation, assessment and feedback without entering learner-only areas.</p></div><span className="access-badge"><ShieldCheck /> Facilitator protected</span></div><div className="role-action-grid">
        <button onClick={() => onNavigate("facilitator")}><span><BookOpen /></span><div><b>Design a microcredential</b><p>Author outcomes, accessible resources, programme activities and assessment gates.</p></div><ChevronRight /></button>
        <button onClick={() => onNavigate("colab")}><span><Code2 /></span><div><b>Assess coding evidence</b><p>Review notebook submissions, apply rubrics and return actionable feedback.</p></div><ChevronRight /></button>
        <button onClick={() => onNavigate("virtual_labs")}><span><FlaskConical /></span><div><b>Review practical evidence</b><p>Assess only practicals connected to courses you facilitate.</p></div><ChevronRight /></button>
        <button onClick={() => onNavigate("cohorts")}><span><Activity /></span><div><b>Monitor cohort progress</b><p>Use completion, scores and evidence queues to target learner support.</p></div><ChevronRight /></button>
        <button onClick={() => onNavigate("verification")}><span><ShieldCheck /></span><div><b>Complete assigned ID reviews</b><p>Open only the restricted cases assigned by a system administrator.</p></div><ChevronRight /></button>
      </div></section>
      <aside className="page-panel contemporary-panel"><p className="eyebrow">CONTEMPORARY DELIVERY STANDARD</p><h2>Design for completion</h2><ul><li><CheckCircle2 /> Short, outcome-led learning sequences</li><li><CheckCircle2 /> Captions and reviewed transcripts</li><li><CheckCircle2 /> Authentic coding or practical evidence</li><li><CheckCircle2 /> Timely, criterion-based feedback</li><li><CheckCircle2 /> Assessment-backed credentials</li></ul><button onClick={() => onNavigate("testing")}><Settings /> Test the learner experience</button></aside>
    </div>}

    {role === "admin" && <div className="role-priority-grid">
      <section className="page-panel role-command-panel"><div className="page-title"><div><p className="eyebrow">INSTITUTIONAL OPERATIONS</p><h2>Govern the platform by exception</h2><p>Prioritise access, academic activation and evidence integrity. Learner delivery tools remain outside the administrator workspace.</p></div><span className="access-badge"><ShieldCheck /> Administrator only</span></div><div className="role-action-grid">
        <button onClick={() => onNavigate("admin")}><span><Users /></span><div><b>Manage users and access</b><p>Invite facilitators, review account status and assign verification work.</p></div><ChevronRight /></button>
        <button onClick={() => onNavigate("course_admin")}><span><FileCheck2 /></span><div><b>Review course submissions</b><p>Check academic readiness before learner discovery and enrolment.</p></div><ChevronRight /></button>
        <button onClick={() => onNavigate("verification")}><span><ShieldCheck /></span><div><b>Govern identity evidence</b><p>Resolve pending decisions with restricted, role-checked access.</p></div><ChevronRight /></button>
        <button onClick={() => onNavigate("credential_registry")}><span><Award /></span><div><b>Govern issued credentials</b><p>Verify, revoke or restore achievement records in the live register.</p></div><ChevronRight /></button>
        <button onClick={() => onNavigate("analytics")}><span><Activity /></span><div><b>Review platform analytics</b><p>Monitor delivery scale, completions, assessment demand and performance.</p></div><ChevronRight /></button>
      </div></section>
      <aside className="page-panel contemporary-panel admin"><p className="eyebrow">QUALITY SIGNALS</p><h2>Trust by design</h2><ul><li><CheckCircle2 /> Least-privilege role access</li><li><CheckCircle2 /> Verified learner identity</li><li><CheckCircle2 /> Academic course activation</li><li><CheckCircle2 /> Recorded assessment decisions</li><li><CheckCircle2 /> Verifiable credential codes</li></ul><button onClick={() => onNavigate("course_admin")}><CheckCircle2 /> Open approval queue</button></aside>
    </div>}
  </div>;
}

type CertificateRecord = { certificate_code: string; learner_name: string; course_code: string; course_title: string; issuer_name?: string; credential_type?: string; status?: string; issued_at: string; expires_at?: string | null; revoked_at?: string | null; revocation_reason?: string | null; requirements?: { id?: string; type?: string; label?: string; complete?: boolean; evidence?: string }[]; sharePath?: string };

function VerificationQr({ code }: { code: string }) {
  return <Image unoptimized width={150} height={150} className="certificate-qr" src={`/api/certificates/qr?code=${encodeURIComponent(code)}`} alt={`Scan to verify certificate ${code}`} />;
}

function CertificateCard({ certificate }: { certificate: CertificateRecord }) {
  const active = (certificate.status ?? "active") === "active";
  const verificationPath = certificate.sharePath ?? `/verify-credential?code=${encodeURIComponent(certificate.certificate_code)}`;
  const copyVerification = async () => {
    await navigator.clipboard.writeText(new URL(verificationPath, window.location.origin).toString());
    toast.success("Verification link copied");
  };
  return <article className={`certificate-card ${active ? "" : "revoked"}`}>
    <div className="certificate-seal"><GraduationCap /><span>UNIVERSITY OF CAPE COAST</span></div>
    <span className={`credential-state ${active ? "active" : "revoked"}`}><ShieldCheck /> {active ? "Active verified credential" : "Revoked credential"}</span>
    <p className="eyebrow">DIGITAL MICROCREDENTIAL CERTIFICATE</p><h2>Certificate of Achievement</h2><p>This certifies that</p><h3>{certificate.learner_name}</h3>
    <p>has fulfilled the identity, learning-activity and assessment requirements for</p><h4>{certificate.course_title}</h4>
    <div className="certificate-meta"><span><b>Course code</b>{certificate.course_code}</span><span><b>Issued</b>{new Date(certificate.issued_at).toLocaleDateString()}</span><span><b>Issuer</b>{certificate.issuer_name ?? "University of Cape Coast"}</span><span><b>Verification</b>{certificate.certificate_code}</span></div>
    {certificate.requirements?.length ? <div className="certificate-requirements">{certificate.requirements.map((requirement) => <span key={requirement.id ?? requirement.label}><CheckCircle2 /> {requirement.label}</span>)}</div> : null}
    {!active && <div className="credential-revocation"><ShieldCheck /><div><b>This credential is not currently valid</b><span>{certificate.revocation_reason || "Contact the issuing institution for details."}</span></div></div>}
    <div className="certificate-verify"><VerificationQr code={certificate.certificate_code} /><div><QrCode /><b>Scan to verify with UCC</b><span>{certificate.certificate_code}</span><a href={verificationPath} target="_blank" rel="noreferrer">Verify online</a></div></div>
    <div className="certificate-actions"><button className="secondary-action certificate-print" onClick={() => window.print()}><Award /> Print certificate</button><button className="secondary-action" onClick={copyVerification}><QrCode /> Copy verification link</button></div>
  </article>;
}

function CertificateWallet() {
  const [items, setItems] = useState<CertificateRecord[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/certificates").then((response) => response.json()).then((result: { certificates?: CertificateRecord[] }) => setItems(result.certificates ?? [])).finally(() => setLoading(false)); }, []);
  return <section className="page-panel certificate-wallet"><div className="page-title"><div><p className="eyebrow">VERIFIABLE ACHIEVEMENT</p><h2>My certificates</h2><p>A UCC certificate is generated only after verified identity, the course assessment and every required practical or Colab activity are complete.</p></div><span className="access-badge"><Award /> {items.length} earned</span></div>{loading && <div className="empty-state">Loading certificates…</div>}<div className="certificate-grid">{items.map((certificate) => <CertificateCard key={certificate.certificate_code} certificate={certificate} />)}{!loading && items.length === 0 && <div className="empty-state">No certificates yet. Complete every requirement in an active microcredential to earn one.</div>}</div></section>;
}

type SkillsPassportData = {
  student: { studentNumber?: string | null; fullName: string; email: string; educationLevel?: string | null; occupation?: string | null; organisation?: string | null; interests: string[]; preferredLanguage: string };
  credentials: (CertificateRecord & { discipline?: string | null; description?: string | null })[];
  enrolments: { course_code: string; title: string; discipline: string; status: string; enrolled_at: string }[];
  competencies: { practical_id: string; discipline: string; practical_title: string; mark: number | null; competency_note: string; assessed_at: string | null }[];
  pathways: { discipline: string; earned: number; inProgress: number; required: number; progress: number; nextMilestone: string }[];
  generatedAt: string;
};

function SkillsPassport() {
  const [passport, setPassport] = useState<SkillsPassportData | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/learner/passport").then((response) => response.json()).then((result: SkillsPassportData) => setPassport(result)).finally(() => setLoading(false)); }, []);
  const exportPassport = () => {
    if (!passport) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(passport, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `UCC-skills-passport-${passport.student.studentNumber || "student"}.json`; link.click(); URL.revokeObjectURL(url);
  };
  if (loading) return <section className="page-panel passport-loading"><ShieldCheck /><h2>Building your skills passport…</h2></section>;
  if (!passport) return <section className="page-panel"><div className="empty-state">Your skills passport could not be loaded.</div></section>;
  const activeCredentials = passport.credentials.filter((item) => (item.status ?? "active") === "active");
  return <div className="skills-passport"><section className="passport-hero"><div><p className="eyebrow">PRIVATE LIFELONG LEARNING RECORD</p><h2>{passport.student.fullName}’s Skills Passport</h2><p>Bring together verified credentials, assessed practical competencies and progress towards stackable learning pathways.</p><div className="passport-identity"><span><b>Student number</b>{passport.student.studentNumber || "Pending"}</span><span><b>Profile</b>{passport.student.educationLevel || "Student"}</span><span><b>Preferred language</b>{passport.student.preferredLanguage}</span></div></div><div className="passport-score"><ShieldCheck /><strong>{activeCredentials.length}</strong><span>verified credential{activeCredentials.length === 1 ? "" : "s"}</span><button onClick={exportPassport}>Export private record</button></div></section><section className="page-panel passport-pathways"><div className="page-title"><div><p className="eyebrow">STACKABLE PATHWAYS</p><h2>Progress towards broader recognition</h2><p>Three verified microcredentials in one discipline form a visible pathway milestone.</p></div><span className="access-badge"><Award /> {passport.pathways.filter((item) => item.progress >= 100).length} achieved</span></div><div className="pathway-grid">{passport.pathways.map((pathway) => <article key={pathway.discipline}><header><span><BookOpen /></span><div><b>{pathway.discipline}</b><small>{pathway.earned} earned · {pathway.inProgress} in progress</small></div><em>{pathway.progress}%</em></header><Progress value={pathway.progress} /><p>{pathway.nextMilestone}</p></article>)}{passport.pathways.length === 0 && <div className="empty-state">Choose learning interests or enrol in a course to start a pathway.</div>}</div></section><div className="passport-columns"><section className="page-panel"><div className="page-title"><div><p className="eyebrow">VERIFIED ACHIEVEMENTS</p><h2>Portable credentials</h2></div></div><div className="passport-achievements">{passport.credentials.map((credential) => <article key={credential.certificate_code} className={(credential.status ?? "active") !== "active" ? "revoked" : ""}><Award /><div><b>{credential.course_title}</b><span>{credential.discipline || "Interdisciplinary"} · {new Date(credential.issued_at).toLocaleDateString()}</span><small>{credential.certificate_code}</small></div><a href={credential.sharePath} target="_blank">Verify</a></article>)}{passport.credentials.length === 0 && <div className="empty-state">Passed course credentials will appear here.</div>}</div></section><section className="page-panel"><div className="page-title"><div><p className="eyebrow">ASSESSED COMPETENCIES</p><h2>Practical evidence</h2></div></div><div className="passport-competencies">{passport.competencies.map((item) => <article key={item.practical_id}><span><FlaskConical /></span><div><b>{item.practical_title}</b><small>{item.discipline} · {item.mark ?? 0}%</small><p>{item.competency_note || "Competency evidence accepted by a facilitator."}</p></div></article>)}{passport.competencies.length === 0 && <div className="empty-state">Accepted practical competencies will appear here.</div>}</div></section></div><section className="passport-privacy"><ShieldCheck /><div><b>Your passport is private by default.</b><p>Only individual credential-verification links are public. Personal profile data, identity evidence and practical reports remain protected.</p></div></section></div>;
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
  const protectedFile = material.fileKey ? `/api/course-materials?key=${encodeURIComponent(material.fileKey)}` : "";
  const isMediaFile = Boolean(protectedFile && /^(video|audio)\//.test(material.mimeType ?? ""));
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="video-transcript-dialog commercial-content-dialog"><DialogHeader><p className="eyebrow">{material.kind.toUpperCase()} · {material.sectionTitle ?? "COURSE CONTENT"}</p><DialogTitle>{material.title}</DialogTitle><DialogDescription>{material.source} · {material.estimatedMinutes ?? 5} estimated minutes · {material.license ?? "Course material"}</DialogDescription></DialogHeader>
    <div className={showTranscript ? "video-transcript-layout" : "video-transcript-layout video-only"}>
      <div className="commercial-content-body">
        {material.readableHtml ? <article className="readable-course-document" dangerouslySetInnerHTML={{ __html: material.readableHtml }} /> : null}
        {!material.readableHtml && material.kind === "Watch" && material.url ? <div className="transcript-video"><iframe src={material.url} title={material.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div> : null}
        {!material.readableHtml && isMediaFile ? material.mimeType?.startsWith("audio/") ? <audio controls src={protectedFile} /> : <video controls src={protectedFile} /> : null}
        {!material.readableHtml && material.kind === "Embed" && material.url ? <iframe className="sandboxed-resource" src={material.url} title={material.title} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" /> : null}
        {!material.readableHtml && !isMediaFile && protectedFile ? <div className="download-material"><FileText /><h3>{material.fileName ?? material.title}</h3><p>Open or download the protected original supplied for this course.</p><a href={protectedFile} target="_blank" rel="noreferrer">Open original file</a></div> : null}
        {material.externalUrl ? <a className="frame-fallback" href={material.externalUrl} target="_blank" rel="noreferrer">Open cited source in a new tab</a> : null}
      </div>
      {showTranscript && <section className="learner-transcript"><header><div><FileText /><b>Facilitator-reviewed transcript</b></div><span>{material.transcript?.split(/\s+/).filter(Boolean).length ?? 0} words</span></header><pre>{material.transcript}</pre></section>}
    </div>
  </DialogContent></Dialog>;
}

function PublishedCourseExperience({ course, onOpenActivity, preview = false }: { course: Course; onOpenActivity: (activity: CourseActivity) => void; preview?: boolean }) {
  type Completion = { complete: boolean; requirements: { id: string; label: string; complete: boolean; evidence?: string }[] };
  const questions = course.assessmentConfig?.questions ?? []; const [stage, setStage] = useState<"materials" | "assessment" | "result">("materials"); const [answers, setAnswers] = useState<Record<string, unknown>>({}); const [videoReady, setVideoReady] = useState<Record<string, boolean>>({}); const [score, setScore] = useState<number | null>(null); const [passed, setPassed] = useState(false); const [certificate, setCertificate] = useState<CertificateRecord | null>(null); const [completion, setCompletion] = useState<Completion | null>(null); const [submitting, setSubmitting] = useState(false); const [selectedMaterial, setSelectedMaterial] = useState<CourseMaterial | null>(null);
  const submit = async () => { if (preview) { setScore(100); setPassed(true); setCertificate(null); setCompletion(null); setStage("result"); toast.success("Preview assessment completed", { description: "No learner record or certificate was created." }); return; } setSubmitting(true); try { const response = await fetch("/api/assessments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseCode: course.code, answers }) }); const result = await response.json() as { score?: number; passed?: boolean; certificate?: CertificateRecord; completion?: Completion; error?: string }; if (!response.ok) throw new Error(result.error ?? "Assessment could not be submitted."); setScore(result.score ?? 0); setPassed(Boolean(result.passed)); setCertificate(result.certificate ?? null); setCompletion(result.completion ?? null); setStage("result"); toast[result.passed ? "success" : "error"](result.passed ? "Assessment passed" : "Pass mark not reached", { description: result.certificate ? "Your verified UCC certificate is ready." : `Score: ${result.score ?? 0}%` }); } catch (error) { toast.error(error instanceof Error ? error.message : "Assessment could not be submitted."); } finally { setSubmitting(false); } };
  if (stage === "result") return <div className="published-course-result">{certificate ? <CertificateCard certificate={certificate} /> : <div className="completion-result"><span className={passed ? "passed" : "retry"}>{passed ? <CheckCircle2 /> : <FileCheck2 />}</span><h3>{passed ? "Assessment passed" : `Assessment result: ${score}%`}</h3><p>{passed ? "Your result is recorded. Complete every remaining required activity below to unlock the UCC digital certificate." : "Review the learning materials and try the assessment again when ready."}</p>{completion?.requirements?.length ? <div className="completion-checklist">{completion.requirements.map((requirement) => <article className={requirement.complete ? "complete" : "pending"} key={requirement.id}>{requirement.complete ? <CheckCircle2 /> : <Clock3 />}<div><b>{requirement.label}</b><span>{requirement.complete ? "Requirement complete" : "Still required"}</span></div></article>)}</div> : null}<button className="dialog-primary" onClick={() => setStage(passed ? "materials" : "assessment")}>{passed ? "Return to course activities" : "Try assessment again"}</button></div>}</div>;
  if (stage === "materials") {
    const design = course.design ?? defaultCourseDesign();
    const sections = design.sections.length ? design.sections : [{ id: "section-1", title: "Course learning", description: "Guided microcredential content" }];
    return <div className="published-course commercial-learner-course"><section className="learner-course-hero"><div><p className="eyebrow">{design.category.toUpperCase()} MICROCREDENTIAL</p><h2>{course.title}</h2><p>{course.description}</p><div><span><Gauge /> {design.level}</span><span><Clock3 /> {design.expectedHours} hours</span><span><BookOpen /> {design.deliveryPattern}</span><span><Users /> {course.facilitatorName}</span></div></div><Award /></section>
      <div className="learner-blueprint"><section><p className="eyebrow">WHAT YOU WILL LEARN</p><h3>Course objectives</h3><ul>{design.objectives.map((objective) => <li key={objective}><CheckCircle2 /> {objective}</li>)}</ul></section><section><p className="eyebrow">MEASURABLE ACHIEVEMENT</p><h3>Learning outcomes</h3>{design.outcomes.map((outcome, index) => <article key={outcome.id}><span>{index + 1}</span><div><b>{outcome.statement}</b><small>{outcome.skill} · {outcome.assessmentMethod}</small></div></article>)}</section></div>
      <div className="published-syllabus">{sections.map((section, sectionIndex) => { const sectionMaterials = (course.materials ?? []).filter((material) => material.sectionId === section.id || (!material.sectionId && sectionIndex === 0)); if (!sectionMaterials.length) return null; return <section key={section.id}><header><span>{sectionIndex + 1}</span><div><p className="eyebrow">COURSE SECTION</p><h3>{section.title}</h3><p>{section.description}</p></div></header><div className="published-materials">{sectionMaterials.map((material, index) => { const transcriptIncluded = Boolean(material.transcript && material.transcriptPublished !== false); return <article key={material.id ?? `${material.title}-${index}`}><span>{index + 1}</span><div><b>{material.unitTitle ?? material.kind}{transcriptIncluded ? " · Transcript included" : ""}</b><h3>{material.title}</h3><p>{material.source} · {material.estimatedMinutes ?? 5} min</p>{material.outcomeIds?.length ? <small>{material.outcomeIds.length} outcome{material.outcomeIds.length === 1 ? "" : "s"} aligned</small> : null}</div><button onClick={() => setSelectedMaterial(material)}>{material.kind === "Watch" ? <CirclePlay /> : <FileText />} {material.kind === "Download" ? "Open file" : material.kind === "Embed" ? "Launch resource" : material.kind === "Watch" ? "Watch" : "Read lesson"}</button></article>; })}</div></section>; })}</div>
      <section className="required-course-work"><header><div><p className="eyebrow">AUTHENTIC EVIDENCE</p><h3>Required programme activities</h3></div><span><ShieldCheck /> Included in certificate gate</span></header><div className="published-materials">{(course.activities ?? []).map((activity, index) => <article className="published-programme-activity" key={activity.id}><span>{index + 1}</span><div><b>{activity.kind === "colab" ? "COLAB CODING ACTIVITY" : "INTERACTIVE VIRTUAL PRACTICAL"}{activity.required ? " · Required" : " · Optional"}</b><h3>{activity.title}</h3><p>{activity.instructions} · Pass mark {activity.passMark}% · {activity.attemptsAllowed} attempt{activity.attemptsAllowed === 1 ? "" : "s"}</p></div><button onClick={() => onOpenActivity(activity)}>{activity.kind === "colab" ? <Code2 /> : <FlaskConical />} Open activity</button></article>)}</div></section>
      <div className="certificate-gate-note"><Award /><div><b>UCC digital certificate</b><p>Issued automatically with a scannable verification QR only after verified identity, the course assessment and every required programme activity are complete.</p></div></div>
      <button className="dialog-primary" disabled={!questions.length} onClick={() => setStage("assessment")}><FileCheck2 /> {questions.length ? `Begin ${questions.length}-question assessment` : "Assessment awaiting facilitator"}</button><VideoTranscriptDialog material={selectedMaterial} onClose={() => setSelectedMaterial(null)} />
    </div>;
  }
  return <div className="published-assessment"><div className="assessment-heading"><span>{questions.length} QUESTIONS</span><h3>Complete every assessment activity</h3><p>Video-gated questions open only after the required whole video or selected segment finishes. Mathematical questions may include a handwriting-enabled working board.</p></div>{questions.map((question, index) => { const isVideo = question.type === "Video question"; const unlocked = !isVideo || videoReady[question.id]; return <article className="learner-question" key={question.id}><span className="question-number">{index + 1}</span><div><small>{question.type} · {question.points} point{question.points === 1 ? "" : "s"}{question.whiteboardEnabled ? " · Whiteboard enabled" : ""}</small>{isVideo && <VideoQuestionGate question={question} onReady={() => setVideoReady((items) => ({ ...items, [question.id]: true }))} />}{unlocked ? <><h3>{question.prompt}</h3>{["Multiple choice", "True / false"].includes(question.type) || (isVideo && question.options.length) ? <div className="learner-options">{question.options.map((option) => <label key={option}><input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswers((items) => ({ ...items, [question.id]: option }))} />{option}</label>)}</div> : ["Matching", "Drag and drop", "Picture matching"].includes(question.type) ? <PairAnswer question={question} value={(answers[question.id] as Record<string,string>) ?? {}} onChange={(value) => setAnswers((items) => ({ ...items, [question.id]: value }))} /> : question.whiteboardEnabled ? <MathWhiteboard value={String(answers[question.id] ?? "")} onChange={(value) => setAnswers((items) => ({ ...items, [question.id]: value }))} /> : <textarea value={String(answers[question.id] ?? "")} onChange={(event) => setAnswers((items) => ({ ...items, [question.id]: event.target.value }))} placeholder={question.type === "Fill in" ? "Type the missing word or phrase" : "Enter your answer"} />}</> : <div className="question-locked"><Video /> Complete the required viewing to reveal this question.</div>}</div></article>; })}<button className="dialog-primary" disabled={submitting || questions.some((question) => answers[question.id] === undefined) || questions.some((question) => question.type === "Video question" && !videoReady[question.id])} onClick={submit}><Award /> {submitting ? "Checking assessment…" : "Submit all assessments"}</button></div>;
}

function PortalLoading() {
  return <main className="access-shell"><section className="access-card loading-card"><div className="brand-mark"><GraduationCap size={28} /></div><p className="eyebrow">UCC MICROCREDENTIALS</p><h1>Opening your learning portal</h1><p>Checking your account and access permissions…</p><div className="loading-bar"><span /></div></section></main>;
}

function PublicLanding({ inviteToken }: { inviteToken: string }) {
  type PublicCourse = { id:number; code:string; title:string; discipline:string; description:string; design:CourseDesign; materials:CourseMaterial[]; activities:unknown[]; facilitatorName:string };
  const [catalogue, setCatalogue] = useState<PublicCourse[]>([]); const [query, setQuery] = useState("");
  useEffect(() => { fetch("/api/courses/public").then((response) => response.json()).then((result:{ courses?:PublicCourse[] }) => setCatalogue(result.courses ?? [])).catch(() => setCatalogue([])); }, []);
  if (inviteToken) return <PortalAccess inviteToken={inviteToken} />;
  const filtered = catalogue.filter((course) => `${course.title} ${course.code} ${course.discipline} ${course.description}`.toLowerCase().includes(query.toLowerCase()));
  const signInUrl = (portal: PortalRole) => `/signin-with-chatgpt?return_to=${encodeURIComponent(`/?portal=${portal}`)}`;
  return <main className="public-micro-site"><header className="public-header"><div className="public-brand"><span><GraduationCap /></span><div><b>UCC Microcredentials</b><small>University of Cape Coast</small></div></div><nav><a href="#courses">Explore courses</a><a href="/verify-credential">Verify credential</a><a href="/fsadmin">Facilitator & admin</a></nav><div className="public-auth"><a href={signInUrl("learner")}>Log in</a><a className="public-register" href="/student-registration">Register</a></div></header>
    <section className="public-hero"><div><p className="eyebrow">UNIVERSITY OF CAPE COAST · FLEXIBLE PROFESSIONAL LEARNING</p><h1>Build career-relevant skills with trusted UCC microcredentials.</h1><p>Explore short, outcome-led courses, understand what you will be able to do, and register when you are ready to learn.</p><div className="public-hero-actions"><a href="#courses">Explore courses <ChevronRight /></a><a href="/student-registration">Create student account</a></div></div><aside><ShieldCheck /><b>Learn. Demonstrate. Progress.</b><p>Approved courses combine measurable outcomes, accessible learning activities, authentic assessment and verifiable achievement.</p></aside></section>
    <section className="public-promo"><article><Award /><div><b>UCC-recognised achievement</b><span>Earn verifiable digital credentials after meeting course requirements.</span></div></article><article><FlaskConical /><div><b>Applied learning</b><span>Courses may include virtual practicals, coding, projects and workplace evidence.</span></div></article><article><Video /><div><b>Flexible participation</b><span>Study asynchronously, join live sessions, and complete guided media-based activities.</span></div></article></section>
    <section id="courses" className="public-catalogue"><div className="public-section-title"><div><p className="eyebrow">EXPLORE UCC MICROCREDENTIALS</p><h2>Find the right course for your next capability</h2><p>Open a course to review its objectives, learning outcomes, expected effort and assessment approach before registering.</p></div><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses, disciplines or skills" /></label></div><div className="public-course-grid">{filtered.map((course) => <article key={course.id}><header><span>{course.code}</span><em>{course.discipline}</em></header><h3>{course.title}</h3><p>{course.description}</p><div className="public-course-meta"><span>{course.design?.expectedHours ?? 0} learning hours</span><span>{course.design?.outcomes?.length ?? 0} outcomes</span><span>{course.materials?.length ?? 0} learning blocks</span></div><details><summary>Objectives & outcomes</summary><div><b>Course objectives</b><ul>{(course.design?.objectives ?? []).slice(0,4).map((item) => <li key={item}>{item}</li>)}</ul><b>By the end, you should be able to:</b><ul>{(course.design?.outcomes ?? []).slice(0,5).map((item) => <li key={item.id}>{item.statement}</li>)}</ul></div></details><footer><small>Facilitated by {course.facilitatorName}</small><a href="/student-registration">Register to enrol <ChevronRight /></a></footer></article>)}{filtered.length === 0 && <div className="empty-state wide">No approved public courses match your search yet.</div>}</div></section>
    <section className="public-staff-entry"><div><p className="eyebrow">UCC STAFF ACCESS</p><h2>Facilitator and system administration</h2><p>Course authors and system administrators use the protected staff gateway. It is visible publicly, but role permissions are enforced after sign-in.</p></div><a href="/fsadmin"><ShieldCheck /> Open /fsadmin <ChevronRight /></a></section>
    <footer className="public-footer"><b>UCC Microcredentials</b><span>University of Cape Coast · Quality-assured flexible learning</span></footer></main>;
}

function PortalAccess({ inviteToken }: { inviteToken: string }) {
  const signInUrl = (portal: PortalRole) => {
    const returnTo = inviteToken ? `/?invite=${encodeURIComponent(inviteToken)}` : `/?portal=${portal}`;
    return `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`;
  };
  return <main className="access-shell commercial-access"><section className="access-card access-selector"><div className="access-brand"><div className="brand-mark"><GraduationCap size={28} /></div><div><strong>UCC Microcredentials</strong><span>University of Cape Coast</span></div></div><div className="access-product-heading"><div><p className="eyebrow">SECURE ROLE PORTALS</p><h1>{inviteToken ? "Complete your facilitator invitation." : "One platform. Three focused workspaces."}</h1><p>{inviteToken ? "Sign in with the exact institutional email invited by the system administrator, then complete permanent biodata and identity verification." : "Students learn and earn. Facilitators design and assess. Administrators govern quality and trust."}</p></div>{!inviteToken && <a href="/verify-credential"><QrCode /> Verify a credential</a>}</div>{inviteToken ? <a className="portal-access-card facilitator invited" href={signInUrl("facilitator")} target="_top"><span className="portal-access-icon"><ShieldCheck /></span><span><b>Complete facilitator setup</b><small>Use the institutional email address named in your invitation.</small></span><ChevronRight /></a> : <div className="commercial-role-grid"><article className="commercial-role-card student"><header><span><BookOpen /></span><em>FOR LEARNERS</em></header><h2>Student Portal</h2><p>Discover courses, complete authentic assessments, build a private skills passport and share verified credentials.</p><ul><li><CheckCircle2 /> Stackable microcredentials</li><li><CheckCircle2 /> Virtual labs and Colab</li><li><CheckCircle2 /> Portable credential wallet</li></ul><div><a className="role-primary" href="/student-registration">Register as a student <ChevronRight /></a><a className="role-secondary" href={signInUrl("learner")}>Student sign in</a></div></article><article className="commercial-role-card facilitator"><header><span><ShieldCheck /></span><em>FOR EDUCATORS</em></header><h2>Facilitator Portal</h2><p>Author quality-assured programmes, facilitate cohorts and assess authentic evidence in one workspace.</p><ul><li><CheckCircle2 /> Course and activity studio</li><li><CheckCircle2 /> Marking and competency decisions</li><li><CheckCircle2 /> Cohort intelligence</li></ul><div><a className="role-primary" href={signInUrl("facilitator")}>Facilitator sign in <ChevronRight /></a><small>Administrator invitation required</small></div></article><article className="commercial-role-card admin"><header><span><Users /></span><em>FOR GOVERNANCE</em></header><h2>System Administration</h2><p>Control identities, academic approvals, credential status and institutional performance.</p><ul><li><CheckCircle2 /> User and access governance</li><li><CheckCircle2 /> Credential registry</li><li><CheckCircle2 /> Platform analytics</li></ul><div><a className="role-primary" href={signInUrl("admin")}>Administrator sign in <ChevronRight /></a><small>Restricted system role</small></div></article></div>}<footer className="access-trust"><ShieldCheck /><span>Role permissions are enforced after sign-in. Portal selection never grants access.</span></footer></section></main>;
}

function PortalRoleMismatch({ requestedRole, email }: { requestedRole: "facilitator" | "admin"; email: string }) {
  const title = requestedRole === "admin" ? "System administrator access required." : "Facilitator access required.";
  const guidance = requestedRole === "admin" ? "This email is not assigned to an active system-administrator account. Sign out and use the administrator email configured for this platform." : "This email is not assigned to an active facilitator account. Ask a system administrator to create your facilitator account and send the setup link.";
  return <main className="access-shell"><section className="access-card role-mismatch"><div className="pending-ring"><ShieldCheck /></div><p className="eyebrow">ROLE-PROTECTED PORTAL</p><h1>{title}</h1><p>{guidance}</p><div className="signed-email"><b>Signed-in email</b><span>{email || "Unavailable"}</span></div><a className="access-primary" href="/signout-with-chatgpt?return_to=%2F">Sign out and use another account</a><a className="access-secondary" href="/">Return to portal selection</a></section></main>;
}

function StudentRegistrationHandoff({ email }: { email: string }) {
  return <main className="access-shell"><section className="access-card registration-handoff"><div className="pending-ring student"><BookOpen /></div><p className="eyebrow">STUDENT REGISTRATION REQUIRED</p><h1>Finish setting up your Student Portal.</h1><p>Your secure sign-in is ready for <b>{email}</b>. Continue in the dedicated registration portal to complete your profile, learning interests, accessibility preferences and identity verification.</p><div className="registration-handoff-features"><span><CheckCircle2 /> Personal student number</span><span><CheckCircle2 /> Verified learning identity</span><span><CheckCircle2 /> Skills passport and credential wallet</span></div><a className="access-primary" href="/student-registration">Continue student registration <ChevronRight /></a><a className="access-secondary" href="/signout-with-chatgpt?return_to=%2F">Sign out and use another account</a></section></main>;
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
  const uploadFileFallback = async (file: File | undefined) => { if (!file) return; setError(""); await onCaptured(file); };
  return <div className={`live-selfie-capture ${ready ? "evidence-ready" : ""}`}><Users /><b>{ready ? "Live selfie received" : "Take a live selfie"}</b><span>The webcam opens here—face forward in good lighting and do not use filters.</span>{mode === "idle" && <button type="button" className="camera-open" onClick={startCamera}><Video /> Open webcam</button>}{mode === "camera" && <div className="camera-stage"><video ref={videoRef} autoPlay muted playsInline aria-label="Live front-camera preview" /><div className="camera-actions"><button type="button" className="camera-cancel" onClick={closeCamera}>Cancel</button><button type="button" className="camera-capture" onClick={capture}><Video /> Capture photo</button></div></div>}{mode === "preview" && preview && <div className="camera-stage"><img src={preview} alt="Captured live selfie preview" /><div className="camera-actions"><button type="button" className="camera-cancel" onClick={startCamera}>Retake</button><button type="button" className="camera-capture" disabled={uploading} onClick={usePhoto}><CheckCircle2 /> {uploading ? "Securing photo…" : "Use this photo"}</button></div></div>}{error && <em className="camera-error">{error}</em>}<label className="selfie-fallback">Camera unavailable? Upload an image instead<input type="file" accept="image/jpeg,image/png" onChange={(event) => uploadFileFallback(event.target.files?.[0])} /></label></div>;
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
  const openCount = available.filter((course) => (course.design?.enrolmentMode ?? "open") === "open" && (course.design?.priceGhs ?? 0) === 0).length;
  return <section className="page-panel open-catalog"><div className="page-title"><div><p className="eyebrow">MICROCREDENTIAL CATALOGUE</p><h2>Available courses and programmes</h2><p>Compare workload, level, delivery and enrolment route before adding a governed offering to your learning plan.</p></div><span className="open-badge"><CheckCircle2 /> {openCount} open now</span></div><div className="discipline-filter" aria-label="Filter programmes by discipline"><button className={selectedDiscipline === "All disciplines" ? "active" : ""} onClick={() => setSelectedDiscipline("All disciplines")}>All disciplines <span>{catalogue.length}</span></button>{presentDisciplines.map((discipline) => <button key={discipline} className={selectedDiscipline === discipline ? "active" : ""} onClick={() => setSelectedDiscipline(discipline)}>{discipline} <span>{catalogue.filter((course) => (course.discipline ?? "Interdisciplinary") === discipline).length}</span></button>)}</div><div className="catalog-grid">{available.map((course) => { const enrolled = enrolledCodes.includes(course.code); const design = course.design ?? defaultCourseDesign(); const selfEnrol = design.enrolmentMode === "open" && design.priceGhs === 0; const actionLabel = design.priceGhs > 0 ? `GHS ${design.priceGhs.toLocaleString()} · Admissions` : design.enrolmentMode === "application" ? "Application required" : design.enrolmentMode === "invitation" ? "Invitation only" : "Enrol now"; return <article key={course.code}><div className={`catalog-icon ${course.accent}`}><BookOpen /></div><div><span>{course.code}</span><h3>{course.title}</h3><p>{course.school}</p><small><b>{course.discipline ?? "Interdisciplinary"}</b> · {design.level} · {design.expectedHours} hours · {design.deliveryPattern}</small></div><button className={enrolled ? "enrolled" : selfEnrol ? "" : "restricted-enrolment"} onClick={() => enrolled ? onOpen(course) : selfEnrol ? onEnrol(course.code) : toast.info(actionLabel, { description: "This offering requires the configured UCC admissions or authorised enrolment route." })}>{enrolled ? <><CheckCircle2 /> Enrolled — open course</> : selfEnrol ? <><CirclePlay /> Enrol now</> : <><ShieldCheck /> {actionLabel}</>}</button></article>; })}{available.length === 0 && <div className="empty-state catalog-empty">No programmes match this discipline and search.</div>}</div></section>;
}

type FacilitatorRecord = { email: string; full_name: string; status: string; identity_status: string; created_at: string };
type VerificationRecord = { email: string; full_name: string; role: string; date_of_birth: string; gender: string; nationality: string; phone: string; address?: string; id_type: string; id_last4: string; status: string; verifier_email?: string | null; created_at: string };
type ReviewerRecord = { email: string; full_name: string; role: string };
type CourseReviewRecord = { id: number; code: string; title: string; discipline: string; description: string; design: CourseDesign; materials: CourseMaterial[]; assessmentConfig?: { questions?: AssessmentQuestion[] }; status: string; facilitatorName: string; questionLimit: number; certificateEnabled: boolean; activities?: CourseActivity[]; versionNumber: number; submittedAt?: string | null; reviewComment?: string | null; reviewedByEmail?: string | null; reviewedAt?: string | null };

type CohortAnalyticsData = { role: PortalRole; totals: { courses: number; enrolled: number; completed: number; pendingEvidence: number }; courses: { code: string; title: string; discipline: string; status: string; enrolled: number; activeLearners: number; completed: number; averageScore: number | null; passRate: number | null; pendingEvidence: number }[] };

function CohortAnalytics({ role }: { role: "facilitator" | "admin" }) {
  const [data, setData] = useState<CohortAnalyticsData | null>(null); const [loading, setLoading] = useState(true); const [query, setQuery] = useState("");
  useEffect(() => { fetch("/api/analytics/cohorts").then((response) => response.json()).then((result: CohortAnalyticsData) => setData(result)).finally(() => setLoading(false)); }, []);
  const filtered = (data?.courses ?? []).filter((item) => `${item.code} ${item.title} ${item.discipline}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="commercial-analytics"><section className={`analytics-hero ${role}`}><div><p className="eyebrow">{role === "admin" ? "INSTITUTIONAL INTELLIGENCE" : "COHORT INTELLIGENCE"}</p><h2>{role === "admin" ? "Platform performance at a glance" : "Turn learner activity into timely support"}</h2><p>{role === "admin" ? "Monitor delivery scale, completions, assessment demand and course performance across the institution." : "See participation, completion, scores and evidence queues for only the courses you facilitate."}</p></div><Activity /></section>{loading && <section className="page-panel"><div className="empty-state">Loading governed analytics…</div></section>}{data && <><section className="analytics-metrics"><article><BookOpen /><div><strong>{data.totals.courses}</strong><span>Courses in scope</span></div></article><article><Users /><div><strong>{data.totals.enrolled}</strong><span>Total enrolments</span></div></article><article><Award /><div><strong>{data.totals.completed}</strong><span>Completions</span></div></article><article><ClipboardCheck /><div><strong>{data.totals.pendingEvidence}</strong><span>Evidence awaiting review</span></div></article></section><section className="page-panel analytics-table-panel"><div className="page-title"><div><p className="eyebrow">COURSE PERFORMANCE</p><h2>Completion and assessment signals</h2></div><label className="inline-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a course or discipline" /></label></div><div className="analytics-table"><div className="analytics-table-head"><span>Course</span><span>Learners</span><span>Completion</span><span>Average</span><span>Pass rate</span><span>Evidence</span></div>{filtered.map((course) => { const completion = course.enrolled ? Math.round((course.completed / course.enrolled) * 100) : 0; return <article key={course.code}><div><b>{course.title}</b><span>{course.code} · {course.discipline}</span><em>{course.status.replaceAll("_", " ")}</em></div><strong>{course.enrolled}</strong><div className="completion-cell"><b>{completion}%</b><Progress value={completion} /></div><strong>{course.averageScore === null ? "—" : `${course.averageScore}%`}</strong><strong>{course.passRate === null ? "—" : `${course.passRate}%`}</strong><span className={course.pendingEvidence ? "attention" : "clear"}>{course.pendingEvidence ? `${course.pendingEvidence} pending` : "Clear"}</span></article>})}{filtered.length === 0 && <div className="empty-state">No courses match this search.</div>}</div></section></>}</div>;
}

type CredentialRegistryRecord = CertificateRecord & { user_email: string };

function CredentialRegistry() {
  const [items, setItems] = useState<CredentialRegistryRecord[]>([]); const [loading, setLoading] = useState(true); const [query, setQuery] = useState(""); const [reasons, setReasons] = useState<Record<string, string>>({}); const [saving, setSaving] = useState("");
  const load = async () => { setLoading(true); try { const response = await fetch("/api/certificates?scope=registry"); const result = await response.json() as { credentials?: CredentialRegistryRecord[]; error?: string }; if (!response.ok) throw new Error(result.error ?? "Credential registry could not be loaded."); setItems(result.credentials ?? []); } catch (error) { toast.error(error instanceof Error ? error.message : "Credential registry could not be loaded."); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const govern = async (code: string, action: "revoke" | "restore") => { setSaving(code); try { const response = await fetch("/api/certificates", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, action, reason: reasons[code] ?? "" }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error ?? "The credential status could not be changed."); toast.success(action === "revoke" ? "Credential revoked" : "Credential restored"); await load(); } catch (error) { toast.error(error instanceof Error ? error.message : "The credential status could not be changed."); } finally { setSaving(""); } };
  const filtered = items.filter((item) => `${item.certificate_code} ${item.learner_name} ${item.user_email} ${item.course_title}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="credential-registry"><section className="registry-hero"><div><p className="eyebrow">DIGITAL CREDENTIAL GOVERNANCE</p><h2>Credential registry</h2><p>Search every issued credential, verify its public record, and record a controlled revocation or restoration decision.</p></div><div><Award /><strong>{items.filter((item) => (item.status ?? "active") === "active").length}</strong><span>active credentials</span></div></section><section className="page-panel"><div className="page-title"><div><p className="eyebrow">ISSUANCE REGISTER</p><h2>Governed achievement records</h2></div><label className="inline-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Code, student, email or award" /></label></div>{loading && <div className="empty-state">Loading credential register…</div>}<div className="registry-list">{filtered.map((credential) => { const active = (credential.status ?? "active") === "active"; return <article key={credential.certificate_code} className={active ? "" : "revoked"}><header><span><Award /></span><div><small>{credential.course_code} · {credential.credential_type ?? "microcredential"}</small><h3>{credential.course_title}</h3><p>{credential.learner_name} · {credential.user_email}</p></div><em className={active ? "active" : "revoked"}>{active ? "active" : "revoked"}</em></header><div className="registry-meta"><span><b>Credential code</b>{credential.certificate_code}</span><span><b>Issued</b>{new Date(credential.issued_at).toLocaleDateString()}</span><span><b>Public record</b><a href={`/verify-credential?code=${encodeURIComponent(credential.certificate_code)}`} target="_blank">Open verifier</a></span></div>{active ? <div className="registry-action"><label>Governance reason<input value={reasons[credential.certificate_code] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [credential.certificate_code]: event.target.value }))} placeholder="Required before revocation" /></label><button disabled={saving === credential.certificate_code} onClick={() => govern(credential.certificate_code, "revoke")}>Revoke credential</button></div> : <div className="registry-action restore"><div><b>Revocation reason</b><span>{credential.revocation_reason || "No reason recorded"}</span></div><button disabled={saving === credential.certificate_code} onClick={() => govern(credential.certificate_code, "restore")}><CheckCircle2 /> Restore credential</button></div>}</article>})}{!loading && filtered.length === 0 && <div className="empty-state">No credential records match this search.</div>}</div></section></div>;
}

function CourseApprovalPanel() {
  const [items, setItems] = useState<CourseReviewRecord[]>([]); const [loading, setLoading] = useState(true); const [comments, setComments] = useState<Record<number,string>>({});
  const load = async () => { setLoading(true); try { const response = await fetch("/api/courses"); const result = await response.json() as { courses?: CourseReviewRecord[]; error?: string }; if (!response.ok) throw new Error(result.error ?? "Courses could not be loaded."); setItems(result.courses ?? []); setComments(Object.fromEntries((result.courses ?? []).map((course) => [course.id, course.reviewComment ?? ""]))); } catch (error) { toast.error(error instanceof Error ? error.message : "Courses could not be loaded."); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const review = async (id: number, status: "active" | "rejected") => { const comment = comments[id]?.trim() ?? ""; if (status === "rejected" && !comment) return toast.error("Add comments explaining the required changes before returning the course."); const response = await fetch("/api/courses", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status, comment }) }); const result = await response.json() as { error?: string }; if (!response.ok) return toast.error(result.error ?? "The course decision could not be saved."); toast.success(status === "active" ? "Course activated and now live for learner discovery" : "Course returned with comments to the facilitator"); await load(); };
  return <section className="page-panel course-approval-panel"><div className="page-title"><div><p className="eyebrow">ACADEMIC ACTIVATION</p><h2>Facilitator course approvals</h2><p>Review the learner experience, outcomes, accessibility and assessment. Returned courses require comments so the facilitator knows exactly what to revise.</p></div><span className="access-badge"><BookOpen /> {items.filter((course) => course.status === "pending_review").length} pending</span></div>{loading && <div className="empty-state">Loading facilitator courses…</div>}<div className="course-approval-list commercial-approval-list">{items.map((course) => { const quality = evaluateCourseQuality({ title: course.title, description: course.description, design: course.design ?? defaultCourseDesign(), materials: course.materials ?? [], questionCount: course.assessmentConfig?.questions?.length ?? 0 }); return <article key={course.id}><div><span>{course.code} · {course.discipline} · version {course.versionNumber} · {course.status.replaceAll("_", " ")}</span><h3>{course.title}</h3><p>{course.facilitatorName} · {course.design?.outcomes?.length ?? 0} outcomes · {course.materials?.length ?? 0} learning blocks · {course.activities?.length ?? 0} applied activities</p><div className="admin-quality-meter"><Progress value={quality.score} /><b>{quality.score}% quality readiness</b></div><div className="admin-course-facts"><span>{course.design?.expectedHours ?? 0} hours</span><span>{course.design?.level ?? "level not set"}</span><span>{course.certificateEnabled ? "UCC QR certificate" : "certificate disabled"}</span></div>{course.reviewComment && course.status !== "pending_review" && <p className="admin-existing-comment"><MessageSquareText /> {course.reviewComment}</p>}</div><div className="approval-decision"><label>Review comments<textarea value={comments[course.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [course.id]: event.target.value }))} placeholder="Required when returning. Optional approval note when activating." /></label><div><button className="reject" disabled={course.status === "active"} onClick={() => review(course.id, "rejected")}>Return with comments</button><button className="approve" disabled={course.status !== "pending_review" || !quality.ready} onClick={() => review(course.id, "active")}><CheckCircle2 /> Approve & publish</button></div></div></article>; })}{!loading && items.length === 0 && <div className="empty-state">No facilitator courses have been submitted.</div>}</div></section>;
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
      if (result.inviteUrl && result.expiresAt) setInvite({ url: new URL(result.inviteUrl, window.location.origin).toString(), email, expiresAt: result.expiresAt });
      setFullName(""); setEmail(""); await load();
      toast.success("Facilitator setup link created", { description: "Send the one-time link to the approved facilitator email." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "The facilitator account could not be created."); }
    finally { setSaving(false); }
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
  if (discipline === "Nursing Skills" || discipline === "Medicine") return { src: "/labs/clinical-simulation-room.webp", alt: "University clinical simulation room with a training mannequin, monitor and skills trolley", station: "Clinical simulation room" };
  if (discipline === "Engineering") return { src: "/labs/engineering-electronics-bench.webp", alt: "University engineering laboratory bench with electronic instruments and a training circuit", station: "Engineering instrumentation bench" };
  return { src: "/labs/science-lab-workbench.webp", alt: "University science laboratory bench with glassware, microscope and measurement equipment", station: "Science laboratory workbench" };
}

const labHotspots = {
  clinical: [{ left: 13, top: 38 }, { left: 46, top: 42 }, { left: 79, top: 52 }, { left: 64, top: 17 }],
  engineering: [{ left: 17, top: 55 }, { left: 43, top: 41 }, { left: 57, top: 72 }, { left: 84, top: 57 }],
  science: [{ left: 15, top: 64 }, { left: 43, top: 46 }, { left: 65, top: 62 }, { left: 86, top: 61 }],
};

function getLabHotspots(discipline: string) {
  if (discipline === "Nursing Skills" || discipline === "Medicine") return labHotspots.clinical;
  if (discipline === "Engineering") return labHotspots.engineering;
  return labHotspots.science;
}

function LabCatalogueScene({ practical }: { practical: VirtualPractical }) {
  const scene = getLabScene(practical.discipline);
  return <figure className="lab-card-scene"><img src={scene.src} alt="" loading="lazy" /><figcaption><span>SIMULATED WORKSTATION</span><b>{scene.station}</b></figcaption></figure>;
}

function LabBriefingScene({ practical }: { practical: VirtualPractical }) {
  const scene = getLabScene(practical.discipline);
  return <figure className="lab-briefing-scene"><img src={scene.src} alt={scene.alt} /><figcaption><span>{practical.discipline} · PRE-LAB ORIENTATION</span><b>{scene.station}</b><small>Inspect the room, controls and apparatus before beginning the safety gate.</small></figcaption><em><span /> Simulation environment ready</em></figure>;
}

function LabEquipmentScene({ practical, selected, onToggle }: { practical: VirtualPractical; selected: string[]; onToggle: (item: string) => void }) {
  const scene = getLabScene(practical.discipline);
  const hotspots = getLabHotspots(practical.discipline);
  const current = practical.equipment.find((item) => selected.includes(item)) ?? practical.equipment[0];
  return <div className="lab-equipment-scene"><figure className="lab-scene-frame"><img src={scene.src} alt={scene.alt} />{practical.equipment.map((item, index) => { const point = hotspots[index % hotspots.length]; const active = selected.includes(item); return <button key={item} type="button" className={active ? "lab-hotspot active" : "lab-hotspot"} style={{ left: `${point.left}%`, top: `${point.top}%` }} onClick={() => onToggle(item)} aria-pressed={active} aria-label={`${active ? "Remove" : "Identify"} ${item}`}><span>{active ? "✓" : index + 1}</span><em>{item}</em></button>; })}<figcaption>{scene.station} · select the numbered apparatus</figcaption></figure><aside><p className="eyebrow">APPARATUS INSPECTOR</p><h4>{current}</h4><p>Use the image hotspots or the equipment list. Every required item must be identified before the simulation opens.</p><div className="apparatus-progress"><span style={{ width: `${(selected.length / practical.equipment.length) * 100}%` }} /></div><b>{selected.length} of {practical.equipment.length} identified</b></aside></div>;
}

function LabInstrumentConsole({ practical, observations, input, output, note, onInput, onNote, onRun }: { practical: VirtualPractical; observations: LabObservation[]; input: number; output: number; note: string; onInput: (value: number) => void; onNote: (value: string) => void; onRun: () => void }) {
  const scene = getLabScene(practical.discipline);
  return <div className="lab-instrument-console"><figure className="lab-console-scene"><img src={scene.src} alt={scene.alt} /><div className="lab-console-readout"><span>LIVE {practical.resultLabel}</span><strong>{output} <small>{practical.resultUnit}</small></strong><em>Model output</em></div><div className="lab-console-ready"><i /> BENCH ONLINE</div><figcaption>{scene.station} · supervised digital twin</figcaption></figure><aside className="lab-control-rack"><header><div><span>INSTRUMENT CONTROL</span><b>{practical.title}</b></div><Gauge /></header><div className="lab-console-values"><span><small>SETPOINT</small><b>{input} {practical.parameterUnit}</b></span><ChevronRight /><span><small>OUTPUT</small><b>{output} {practical.resultUnit}</b></span></div><label>{practical.parameterLabel}<b>{input} {practical.parameterUnit}</b><input type="range" min={practical.parameterMin} max={practical.parameterMax} value={input} onChange={(event) => onInput(Number(event.target.value))} /></label><label>Observation note<input value={note} onChange={(event) => onNote(event.target.value)} placeholder="What changed and what did you notice?" /></label><button className="secondary-action" onClick={onRun}><Activity /> Run instrument and record trial</button></aside><LabMeasurementDiagram practical={practical} observations={observations} input={input} output={output} /></div>;
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
    {stage === 1 && <section className="lab-stage"><p className="eyebrow">OBJECTIVES AND PRE-LAB BRIEFING</p><h3>{practical.title}</h3><LabBriefingScene practical={practical} /><p>{practical.focus}</p><ul>{practical.objectives.map((item) => <li key={item}>{item}</li>)}</ul><div className="prelab-note"><ClipboardCheck /><p>Complete the stages in order. Unexpected results must be recorded—not hidden or altered.</p></div><button className="dialog-primary" onClick={() => setStage(2)}>Begin safety assessment <ChevronRight /></button></section>}
    {stage === 2 && <section className="lab-stage"><p className="eyebrow">SAFETY ASSESSMENT</p><h3>{practical.safetyQuestion}</h3><div className="lab-answer-list">{practical.safetyOptions.map((option) => <label key={option} className={safetyAnswer === option ? "selected" : ""}><input type="radio" name={`safety-${practical.id}`} checked={safetyAnswer === option} onChange={() => setSafetyAnswer(option)} />{option}</label>)}</div><button className="dialog-primary" disabled={!safetyAnswer} onClick={advanceSafety}><ShieldCheck /> Check safety decision</button></section>}
    {stage === 3 && <section className="lab-stage"><p className="eyebrow">EQUIPMENT IDENTIFICATION</p><h3>Inspect the workstation and identify every required item</h3><LabEquipmentScene practical={practical} selected={equipment} onToggle={toggleEquipment} /><div className="equipment-grid">{practical.equipment.map((item) => <button key={item} className={equipment.includes(item) ? "selected" : ""} onClick={() => toggleEquipment(item)}><VirtualLabIcon discipline={practical.discipline} /><span>{item}</span>{equipment.includes(item) && <CheckCircle2 />}</button>)}</div><button className="dialog-primary" disabled={equipment.length !== practical.equipment.length} onClick={() => setStage(4)}>Open interactive simulation <ChevronRight /></button></section>}
    {stage === 4 && <section className="lab-stage"><p className="eyebrow">INTERACTIVE SIMULATION</p><h3>{practical.mode === "measurement" ? "Operate the virtual instrument and observe the live response" : "Complete the safest procedure at the simulated station"}</h3>{practical.mode === "measurement" ? <LabInstrumentConsole practical={practical} observations={observations} input={parameter} output={result} note={note} onInput={setParameter} onNote={setNote} onRun={runMeasurement} /> : <div className="procedure-simulator"><LabProcedureScene practical={practical} sequenceIndex={sequenceIndex} /><p>Select the next safest step:</p><div>{orderedChoices.filter((item) => !practical.procedureSteps.slice(0, sequenceIndex).includes(item)).map((item) => <button key={item} onClick={() => chooseProcedureStep(item)}>{item}<ChevronRight /></button>)}</div></div>}<button className="dialog-primary" disabled={!ran} onClick={() => setStage(5)}>Pause and assess understanding <FileCheck2 /></button></section>}
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
  if (role !== "learner") return <div className="virtual-lab-admin"><section className="page-panel facilitator-lab-catalogue"><div className="virtual-lab-hero"><div><p className="eyebrow">FACILITATOR PRACTICAL PREVIEW</p><h2>Experience every simulation before using it</h2><p>Search, open and complete the learner pathway in non-recorded preview mode. Use the objectives, safety gate, interaction, data and debrief to judge whether the practical fits your programme.</p></div><div className="lab-hero-meter"><Eye /><strong>{virtualPracticals.length}</strong><span>practicals to preview</span></div></div><div className="lab-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search practicals to preview" /></label><div><button className={discipline === "All" ? "active" : ""} onClick={() => setDiscipline("All")}>All</button>{labDisciplines.map((item) => <button key={item} className={discipline === item ? "active" : ""} onClick={() => setDiscipline(item)}>{item} ({virtualPracticals.filter((practical) => practical.discipline === item).length})</button>)}</div></div><div className="virtual-lab-grid">{filtered.map((practical) => <article key={practical.id}><header><span><VirtualLabIcon discipline={practical.discipline} /></span><em>{practical.discipline}</em><b>preview</b></header><LabCatalogueScene practical={practical} /><h3>{practical.title}</h3><p>{practical.focus}</p><div><span><ShieldCheck /> Safety gate</span><span><Activity /> Interactive</span><span><ClipboardCheck /> Debrief</span></div><button onClick={() => setSelected(practical)}><Eye /> Preview full practical <ChevronRight /></button></article>)}{filtered.length === 0 && <div className="empty-state wide">No practical matches this search or discipline.</div>}</div><Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="virtual-lab-dialog"><DialogHeader><p className="eyebrow">{selected?.discipline} · FACILITATOR PREVIEW</p><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Non-recorded nine-stage learner simulation preview</DialogDescription></DialogHeader>{selected && <VirtualPracticalRunner key={`preview-${selected.id}`} practical={selected} preview onSubmitted={async () => {}} />}</DialogContent></Dialog></section><section className="page-panel"><div className="page-title"><div><p className="eyebrow">PRACTICAL ASSESSMENT REGISTER</p><h2>Learner evidence and competency decisions</h2><p>Grade the virtual evidence while clearly recording what still requires physical supervision.</p></div><span className="access-badge"><ClipboardCheck /> {submissions.filter((item) => item.status === "submitted").length} awaiting review</span></div>{loading && <div className="empty-state">Loading practical submissions…</div>}<div className="lab-review-list">{submissions.map((submission) => <VirtualLabSubmissionReview key={submission.id} submission={submission} onUpdated={load} />)}{!loading && submissions.length === 0 && <div className="empty-state">Learner practical submissions will appear here.</div>}</div></section></div>;
  return <section className="page-panel virtual-lab-workspace"><div className="virtual-lab-hero"><div><p className="eyebrow">INTERACTIVE VIRTUAL PRACTICALS</p><h2>Prepare, practise and reflect safely</h2><p>Use these browser simulations to complement—never replace—approved physical laboratories, clinical placements and supervised skills assessment.</p></div><div className="lab-hero-meter"><FlaskConical /><strong>{virtualPracticals.length}</strong><span>guided practicals</span></div></div><div className="lab-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search practicals" /></label><div><button className={discipline === "All" ? "active" : ""} onClick={() => setDiscipline("All")}>All</button>{labDisciplines.map((item) => <button key={item} className={discipline === item ? "active" : ""} onClick={() => setDiscipline(item)}>{item}</button>)}</div></div>{loading && <div className="empty-state">Loading your practical record…</div>}<div className="virtual-lab-grid">{filtered.map((practical) => { const record = submissions.find((item) => item.practicalId === practical.id); return <article key={practical.id}><header><span><VirtualLabIcon discipline={practical.discipline} /></span><em>{practical.discipline}</em>{record && <b className={record.passed ? "passed" : record.status}>{record.passed ? "competent" : record.status}</b>}</header><LabCatalogueScene practical={practical} /><h3>{practical.title}</h3><p>{practical.focus}</p><div><span><ShieldCheck /> Safety gate</span><span><Activity /> Interactive</span><span><ClipboardCheck /> Graded</span></div><button onClick={() => setSelected(practical)}>{record?.passed ? "Review debrief" : record?.status === "submitted" ? "View submission" : "Start practical"}<ChevronRight /></button></article>; })}{filtered.length === 0 && <div className="empty-state wide">No virtual practical matches this search.</div>}</div><Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="virtual-lab-dialog"><DialogHeader><p className="eyebrow">{selected?.discipline}</p><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Nine-stage complementary virtual practical</DialogDescription></DialogHeader>{selected && <VirtualPracticalRunner key={`${selected.id}-${latest?.id ?? 0}-${latest?.status ?? "new"}`} practical={selected} latest={latest} onSubmitted={load} />}</DialogContent></Dialog></section>;
}

function Assessments({ onOpen }: { onOpen: () => void }) {
  const tasks = [["Authentic assessment design brief", "Digital Pedagogy", "28 Aug 2026", "Due soon"], ["Clean and interpret a public dataset", "Data Analytics", "31 Aug 2026", "In progress"], ["Community field reflection", "Coastal Resilience", "04 Sep 2026", "Not started"]];
  return <div className="page-panel"><div className="page-title"><div><p className="eyebrow">EVIDENCE OF LEARNING</p><h2>Assessments</h2><p>Track submissions, feedback and competence decisions.</p></div></div><div className="task-table"><div className="task-head"><span>Assessment</span><span>Due date</span><span>Status</span><span /></div>{tasks.map((task) => <div className="task-row" key={task[0]}><div><b>{task[0]}</b><small>{task[1]}</small></div><span>{task[2]}</span><em className={task[3].replace(" ", "-").toLowerCase()}>{task[3]}</em><button onClick={onOpen}>Open <ChevronRight size={15} /></button></div>)}</div></div>;
}

function Discussions() {
  const posts = [["How can we verify authentic assessment online?", "Digital Pedagogy", "18 replies", "Dr. E. A. Mensah"], ["Choosing useful indicators for district planning", "Data Analytics", "11 replies", "Kojo B."], ["Community consent in coastal fieldwork", "Coastal Resilience", "7 replies", "Adwoa S."]];
  return <div className="page-panel"><div className="page-title"><div><p className="eyebrow">LEARNING COMMUNITY</p><h2>Discussions</h2><p>Continue course conversations with facilitators and peers.</p></div><button className="primary-action" onClick={() => toast.success("Discussion composer opened", { description: "Your draft is ready for a title and message." })}><MessageSquareText size={17} /> New post</button></div><div className="discussion-list">{posts.map((item) => <button key={item[0]} onClick={() => toast.info(item[0], { description: `${item[2]} · ${item[1]}` })}><span className="avatar">{item[3][0]}</span><div><h3>{item[0]}</h3><p>{item[1]} · Started by {item[3]}</p></div><b>{item[2]}</b><ChevronRight size={18} /></button>)}</div></div>;
}

function FacilitatorStudio({ email, query, setQuery }: { email: string; query: string, setQuery: (value: string) => void }) {
  type Material = CourseMaterial;
  type StudioDraft = { id: number; code: string; title: string; discipline: string; description: string; design: CourseDesign; materials: Material[]; activities: CourseActivity[]; assessmentModes: string[]; assessmentConfig: { passMark?: number; attempts?: string; questions?: AssessmentQuestion[]; questionFiles?: { name: string; size: string; type: string }[] }; gateRequired: boolean; questionLimit: number; certificateEnabled: boolean; status: string; createdByEmail: string; versionNumber: number; updatedAt?: string; reviewComment?: string | null; reviewedAt?: string | null };
  const [step, setStep] = useState<"details" | "outcomes" | "content" | "activities" | "assessment" | "review">("details");
  const [courseTitle, setCourseTitle] = useState("Community Data Skills for Decision-Making");
  const [courseCode, setCourseCode] = useState("DRAFT-MC 001");
  const [description, setDescription] = useState("A practical microcredential that develops evidence-based decision skills through guided learning and authentic assessment.");
  const [discipline, setDiscipline] = useState("Humanities & Social Sciences");
  const [design, setDesign] = useState<CourseDesign>(() => defaultCourseDesign());
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftVersion, setDraftVersion] = useState(1);
  const [draftStatus, setDraftStatus] = useState("new");
  const [drafts, setDrafts] = useState<StudioDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
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
    { id: "starter-orientation", title: "Welcome and learning outcomes", kind: "Read", source: "Course author", readableHtml: "<h2>Welcome</h2><p>Start with the course purpose, the expected evidence and the learning pathway.</p>", plainText: "Welcome. Start with the course purpose, the expected evidence and the learning pathway.", sectionId: "section-1", sectionTitle: "Orientation and foundations", unitTitle: "Orientation", estimatedMinutes: 5, outcomeIds: ["outcome-1"], accessibilityChecked: true, license: "Course-authored content" },
    { id: "starter-concepts", title: "Core concept explainer", kind: "Read", source: "Course author", readableHtml: "<h2>Core concepts</h2><p>Use this editable lesson to explain the central concepts, worked examples and the first authentic application.</p>", plainText: "Core concepts. Explain the central concepts, worked examples and the first authentic application.", sectionId: "section-1", sectionTitle: "Orientation and foundations", unitTitle: "Foundation lesson", estimatedMinutes: 8, outcomeIds: ["outcome-2"], accessibilityChecked: true, license: "Course-authored content" },
  ]);
  const [contentMode, setContentMode] = useState<"text" | "file" | "url">("text");
  const [contentTitle, setContentTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [contentUrl, setContentUrl] = useState("");
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [contentFormat, setContentFormat] = useState<"text" | "html">("text");
  const [contentEmbedOnly, setContentEmbedOnly] = useState(false);
  const [contentSectionId, setContentSectionId] = useState("section-1");
  const [contentUnitTitle, setContentUnitTitle] = useState("Learning unit");
  const [contentOutcomeIds, setContentOutcomeIds] = useState<string[]>(["outcome-1"]);
  const [contentSource, setContentSource] = useState("Course author");
  const [contentLicense, setContentLicense] = useState("Course-authored content");
  const [importingContent, setImportingContent] = useState(false);
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
  const [questionOutcomeIds, setQuestionOutcomeIds] = useState<string[]>(["outcome-1"]);
  const [markingScheme, setMarkingScheme] = useState("");
  const [feedbackCorrect, setFeedbackCorrect] = useState("Well done. You have demonstrated the required understanding.");
  const [feedbackIncorrect, setFeedbackIncorrect] = useState("Review the relevant learning material and try again.");
  const [learnerAdvice, setLearnerAdvice] = useState("Focus on the key concept, compare it with the examples, and use the feedback before your next attempt.");
  const [saving, setSaving] = useState(false);
  const [learnerPreviewOpen, setLearnerPreviewOpen] = useState(false);
  const refreshDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const response = await fetch("/api/courses"); const result = await response.json() as { courses?: StudioDraft[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Course drafts could not be loaded.");
      setDrafts((result.courses ?? []).filter((course) => course.createdByEmail === email));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Course drafts could not be loaded."); }
    finally { setLoadingDrafts(false); }
  }, [email]);
  useEffect(() => { void refreshDrafts(); }, [refreshDrafts]);
  const loadDraft = (course: StudioDraft) => {
    if (course.status === "active") return toast.info("Active courses are locked. Use the current version as the basis for a governed future revision.");
    setDraftId(course.id); setDraftVersion(course.versionNumber); setDraftStatus(course.status); setCourseCode(course.code); setCourseTitle(course.title); setDiscipline(course.discipline); setDescription(course.description);
    setDesign(course.design ?? defaultCourseDesign()); setMaterials(course.materials ?? []); setCourseActivities(course.activities ?? []); setAssessmentModes(course.assessmentModes ?? []);
    setGateRequired(course.gateRequired); setQuestionLimit(course.questionLimit); setCertificateEnabled(course.certificateEnabled); setPassMark(course.assessmentConfig?.passMark ?? 70); setAttempts(course.assessmentConfig?.attempts ?? "3"); setQuestions(course.assessmentConfig?.questions ?? []); setQuestionFiles(course.assessmentConfig?.questionFiles ?? []);
    setContentSectionId(course.design?.sections?.[0]?.id ?? "section-1"); setContentOutcomeIds(course.design?.outcomes?.[0]?.id ? [course.design.outcomes[0].id] : []); setStep("details");
    toast.success(`Loaded version ${course.versionNumber}`, { description: course.title });
  };
  const importCourseContent = async () => {
    if (contentMode === "text" && contentText.trim().length < 20) return toast.error("Enter at least 20 characters of lesson content.");
    if (contentMode === "file" && !contentFile) return toast.error("Choose a document or media file.");
    if (contentMode === "url" && !contentUrl.trim()) return toast.error("Paste a public resource link.");
    const section = design.sections.find((item) => item.id === contentSectionId) ?? design.sections[0];
    setImportingContent(true);
    try {
      const body = new FormData(); body.append("mode", contentMode); body.append("title", contentTitle); body.append("source", contentSource); body.append("license", contentLicense); body.append("sectionId", section?.id ?? "section-1"); body.append("sectionTitle", section?.title ?? "Course content"); body.append("unitTitle", contentUnitTitle); body.append("outcomeIds", contentOutcomeIds.join(","));
      if (contentMode === "text") { body.append("text", contentText); body.append("inputFormat", contentFormat); }
      if (contentMode === "file" && contentFile) body.append("file", contentFile);
      if (contentMode === "url") { body.append("url", contentUrl); body.append("embedOnly", String(contentEmbedOnly)); }
      const response = await fetch("/api/content/ingest", { method: "POST", body }); const result = await response.json() as { material?: Material; conversionNote?: string; error?: string };
      if (!response.ok || !result.material) throw new Error(result.error ?? "The learning block could not be created.");
      setMaterials((items) => [...items, result.material!]); setContentTitle(""); setContentText(""); setContentUrl(""); setContentFile(null);
      toast.success("Learning block added", { description: result.conversionNote ?? "Placed in the structured course outline." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "The learning block could not be created."); }
    finally { setImportingContent(false); }
  };
  const quality = evaluateCourseQuality({ title: courseTitle, description, design, materials, questionCount: questions.slice(0, questionLimit).length });
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
    const section = design.sections.find((item) => item.id === contentSectionId) ?? design.sections[0];
    setMaterials((items) => [...items, { id: crypto.randomUUID(), title: resource.title, kind: resource.type, source: resource.source, url: resource.url, externalUrl: resource.externalUrl, sectionId: section?.id, sectionTitle: section?.title, unitTitle: contentUnitTitle, estimatedMinutes: 10, outcomeIds: contentOutcomeIds, accessibilityChecked: resource.type !== "Watch" || Boolean(transcript && publishTranscript), license: resource.license, transcript: transcript || undefined, transcriptLanguage: transcript ? transcriptLanguage : undefined, transcriptSource: transcript ? transcriptSource || "Facilitator supplied" : undefined, transcriptPublished: Boolean(transcript && publishTranscript) }]);
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
      const section = design.sections.find((item) => item.id === contentSectionId) ?? design.sections[0];
      const body = new FormData(); body.append("mode", "file"); body.append("file", file); body.append("title", file.name.replace(/\.[^.]+$/, "")); body.append("source", contentSource); body.append("license", contentLicense); body.append("sectionId", section?.id ?? "section-1"); body.append("sectionTitle", section?.title ?? "Course content"); body.append("unitTitle", contentUnitTitle); body.append("outcomeIds", contentOutcomeIds.join(","));
      const response = await fetch("/api/content/ingest", { method: "POST", body });
      if (!response.ok) { toast.error(`Could not upload ${file.name}`); continue; }
      const stored = await response.json() as { material?: Material; error?: string };
      if (!stored.material) continue;
      uploaded.push({ name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB`, type: file.type || "file" });
      setMaterials((items) => [...items, stored.material!]);
    }
    if (uploaded.length === 0) return;
    setFiles((items) => [...items, ...uploaded]);
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
    const question: AssessmentQuestion = { id: crypto.randomUUID(), type: questionType, prompt: questionPrompt.trim(), options: usesPairs ? [] : options, correctAnswer: selectedAnswer, points: questionPoints, scheme: markingScheme.trim(), feedbackCorrect: feedbackCorrect.trim(), feedbackIncorrect: feedbackIncorrect.trim(), learnerAdvice: learnerAdvice.trim(), outcomeIds: questionOutcomeIds, pairs: usesPairs ? pairs : undefined, videoUrl: questionType === "Video question" ? questionVideoUrl.trim() : undefined, videoMode: questionType === "Video question" ? videoMode : undefined, videoStart: questionType === "Video question" ? videoStart : undefined, videoEnd: questionType === "Video question" ? videoEnd : undefined, whiteboardEnabled };
    setQuestions((items) => [...items, question]);
    setQuestionPrompt(""); setQuestionOptions(["", "", "", ""]); setCorrectOptionIndex(null); setCorrectAnswer(""); setPairRows([{ left: "", right: "", image: "" }, { left: "", right: "", image: "" }]); setQuestionVideoUrl(""); setMarkingScheme(""); setWhiteboardEnabled(false);
    toast.success("Assessment question added");
  };
  const saveCourse = async (submissionMode: "draft" | "review") => {
    if (!courseTitle.trim() || !courseCode.trim() || !discipline) return toast.error("Course title, code and discipline are required");
    if (submissionMode === "review" && !quality.ready) return toast.error("Complete every publish-readiness check before submitting for academic review.");
    setSaving(true);
    try {
      const response = await fetch("/api/courses", {
        method: draftId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: draftId, expectedVersion: draftVersion, submissionMode, code: courseCode, title: courseTitle, discipline, description, design, materials, activities: courseActivities, assessmentModes, gateRequired, questionLimit, certificateEnabled, assessmentConfig: { passMark, attempts, questions: questions.slice(0, questionLimit), questionFiles } }),
      });
      const result = await response.json() as { error?: string; course?: { id: number; status: string; versionNumber: number } };
      if (!response.ok) throw new Error(result.error ?? "Could not save the course draft.");
      if (result.course) { setDraftId(result.course.id); setDraftVersion(result.course.versionNumber); setDraftStatus(result.course.status); }
      await refreshDrafts();
      toast.success(submissionMode === "review" ? "Submitted for academic review" : "Draft saved", { description: submissionMode === "review" ? `${courseTitle} is now locked into the UCC quality-review queue.` : `Version ${result.course?.versionNumber ?? draftVersion} is safely stored.` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the course draft.");
    } finally {
      setSaving(false);
    }
  };
  const startNewCourse = () => {
    const nextDesign = defaultCourseDesign(); setDraftId(null); setDraftVersion(1); setDraftStatus("new"); setCourseTitle(""); setCourseCode(""); setDescription(""); setDiscipline("Interdisciplinary"); setDesign(nextDesign); setMaterials([]); setCourseActivities([]); setQuestions([]); setQuestionFiles([]); setAssessmentModes(["Objective quiz"]); setContentSectionId(nextDesign.sections[0].id); setContentOutcomeIds([nextDesign.outcomes[0].id]); setStep("details");
  };

  return <div className="authoring-shell">
    <section className="authoring-main page-panel">
      <div className="page-title commercial-studio-title"><div><p className="eyebrow">UCC COMMERCIAL COURSE STUDIO</p><h2>Design an outcome-led microcredential</h2><p>Build a structured syllabus, convert source material into accessible lessons, align assessment and submit a governed version for publication.</p></div><div><span className={`draft-state ${draftStatus}`}>v{draftVersion} · {draftStatus.replaceAll("_", " ")}</span><button className="secondary-action" disabled={saving} onClick={() => void saveCourse("draft")}><FileCheck2 /> Save draft</button></div></div>
      <section className="course-portfolio"><header><div><p className="eyebrow">MY COURSE PORTFOLIO</p><h3>Drafts, reviews and live offerings</h3></div><button onClick={startNewCourse}><BookOpen /> New course</button></header>{loadingDrafts ? <div className="empty-state">Loading course versions…</div> : <div>{drafts.map((course) => <article key={course.id} className={draftId === course.id ? "selected" : ""}><span className={`portfolio-status ${course.status}`}>{course.status.replaceAll("_", " ")}</span><div><b>{course.title}</b><small>{course.code} · version {course.versionNumber} · {course.updatedAt ? new Date(course.updatedAt).toLocaleDateString() : "recently updated"}</small></div><div className="portfolio-actions"><button onClick={() => loadDraft(course)}>{course.status === "active" ? "View status" : "Continue editing"}</button></div>{course.reviewComment && <p className="review-feedback"><MessageSquareText /> <span><b>{course.status === "rejected" ? "Changes requested" : "Review note"}</b>{course.reviewComment}</span></p>}</article>)}{drafts.length === 0 && <div className="empty-state">Your first commercial course draft will appear here after saving.</div>}</div>}</section>
      <div className="authoring-steps commercial-steps">{[["details", "1", "Blueprint"], ["outcomes", "2", "Outcomes"], ["content", "3", "Content"], ["activities", "4", "Activities"], ["assessment", "5", "Assessment"], ["review", "6", "Quality & submit"]].map(([id, number, label]) => <button key={id} className={step === id ? "active" : ""} onClick={() => setStep(id as typeof step)}><span>{number}</span>{label}</button>)}</div>

      {step === "details" && <div className="authoring-form commercial-blueprint-form">
        <div className="studio-section-heading"><div><p className="eyebrow">PRODUCT BLUEPRINT</p><h3>Position the learning offer</h3><p>Define the audience, workload, access model and institutional promise before authoring content.</p></div><Gauge /></div>
        <div className="form-grid"><label>Course title<input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="A clear, market-facing course title" /></label><label>Unique course code<input value={courseCode} onChange={(event) => setCourseCode(event.target.value.toUpperCase())} placeholder="UCC-MC-101" /></label><label>Discipline of learning<select value={discipline} onChange={(event) => setDiscipline(event.target.value)}>{disciplines.map((item) => <option key={item}>{item}</option>)}</select></label><label>Microcredential category<select value={design.category} onChange={(event) => setDesign((current) => ({ ...current, category: event.target.value as CourseDesign["category"] }))}><option value="credit">Credit-bearing microcredential</option><option value="professional">Professional development</option><option value="rpl">Advanced standing / RPL</option></select></label><label>Delivery pattern<select value={design.deliveryPattern} onChange={(event) => setDesign((current) => ({ ...current, deliveryPattern: event.target.value as CourseDesign["deliveryPattern"] }))}><option value="asynchronous">Asynchronous</option><option value="synchronous">Synchronous</option><option value="blended">Blended</option></select></label><label>Competence band<select value={design.level} onChange={(event) => setDesign((current) => ({ ...current, level: event.target.value as CourseDesign["level"] }))}><option value="foundation">Foundation practitioner</option><option value="applied">Applied practitioner</option><option value="advanced">Advanced practitioner</option></select></label><label>Expected learning hours<input type="number" value={design.expectedHours} min="1" max="500" onChange={(event) => setDesign((current) => ({ ...current, expectedHours: Math.max(1, Number(event.target.value)) }))} /></label><label>Primary language<input value={design.language} onChange={(event) => setDesign((current) => ({ ...current, language: event.target.value }))} /></label><label>Enrolment mode<select value={design.enrolmentMode} onChange={(event) => setDesign((current) => ({ ...current, enrolmentMode: event.target.value as CourseDesign["enrolmentMode"] }))}><option value="open">Open self-enrolment</option><option value="application">Application and review</option><option value="invitation">Invitation only</option></select></label><label>Price (GHS)<input type="number" min="0" value={design.priceGhs} onChange={(event) => setDesign((current) => ({ ...current, priceGhs: Math.max(0, Number(event.target.value)) }))} /></label></div>
        <label>Commercial course description <span>{description.length}/5000</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the value, capability and evidence a learner will gain." /></label>
        <div className="editor-form-grid"><label>Intended audience<textarea value={design.intendedAudience} onChange={(event) => setDesign((current) => ({ ...current, intendedAudience: event.target.value }))} /></label><label>Prerequisites and entry guidance<textarea value={design.prerequisites} onChange={(event) => setDesign((current) => ({ ...current, prerequisites: event.target.value }))} /></label></div>
        <label>Accessibility commitment<textarea value={design.accessibilityStatement} onChange={(event) => setDesign((current) => ({ ...current, accessibilityStatement: event.target.value }))} /></label>
        <button className="dialog-primary align-right" onClick={() => setStep("outcomes")}>Define objectives and outcomes <ChevronRight /></button>
      </div>}

      {step === "outcomes" && <div className="outcome-authoring">
        <div className="studio-section-heading"><div><p className="eyebrow">OUTCOME-LED DESIGN</p><h3>Connect purpose, evidence and curriculum</h3><p>Every outcome carries a skill and assessment method, then maps to learning blocks in the next step.</p></div><ShieldCheck /></div>
        <section className="objective-builder"><header><div><h3>Course objectives</h3><p>What the course is designed to accomplish.</p></div><button onClick={() => setDesign((current) => ({ ...current, objectives: [...current.objectives, ""] }))}>Add objective</button></header>{design.objectives.map((objective, index) => <article key={index}><span>{index + 1}</span><textarea value={objective} onChange={(event) => setDesign((current) => ({ ...current, objectives: current.objectives.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} placeholder="Build, develop or enable…" /><button onClick={() => setDesign((current) => ({ ...current, objectives: current.objectives.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button></article>)}</section>
        <section className="outcome-builder"><header><div><h3>Measurable course outcomes</h3><p>Use observable verbs and name the evidence that proves achievement.</p></div><button onClick={() => setDesign((current) => ({ ...current, outcomes: [...current.outcomes, { id: crypto.randomUUID(), statement: "", assessmentMethod: "", skill: "" }] }))}>Add outcome</button></header>{design.outcomes.map((outcome, index) => <article key={outcome.id}><span>{index + 1}</span><div><label>Outcome statement<textarea value={outcome.statement} onChange={(event) => setDesign((current) => ({ ...current, outcomes: current.outcomes.map((item) => item.id === outcome.id ? { ...item, statement: event.target.value } : item) }))} placeholder="By the end, learners can…" /></label><div><label>Skill / capability<input value={outcome.skill} onChange={(event) => setDesign((current) => ({ ...current, outcomes: current.outcomes.map((item) => item.id === outcome.id ? { ...item, skill: event.target.value } : item) }))} /></label><label>Assessment method<input value={outcome.assessmentMethod} onChange={(event) => setDesign((current) => ({ ...current, outcomes: current.outcomes.map((item) => item.id === outcome.id ? { ...item, assessmentMethod: event.target.value } : item) }))} /></label></div></div><button onClick={() => setDesign((current) => ({ ...current, outcomes: current.outcomes.filter((item) => item.id !== outcome.id) }))}>Remove</button></article>)}</section>
        <section className="skill-builder"><header><h3>Skills tags</h3><button onClick={() => setDesign((current) => ({ ...current, skills: [...current.skills, ""] }))}>Add skill</button></header><div>{design.skills.map((skill, index) => <label key={index}><input value={skill} onChange={(event) => setDesign((current) => ({ ...current, skills: current.skills.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} /><button onClick={() => setDesign((current) => ({ ...current, skills: current.skills.filter((_, itemIndex) => itemIndex !== index) }))}><X /></button></label>)}</div></section>
        <section className="section-builder"><header><div><h3>Course sections</h3><p>Organise the learner journey into clear syllabus sections.</p></div><button onClick={() => setDesign((current) => ({ ...current, sections: [...current.sections, { id: crypto.randomUUID(), title: "New section", description: "" }] }))}>Add section</button></header>{design.sections.map((section, index) => <article key={section.id}><span>{index + 1}</span><label>Section title<input value={section.title} onChange={(event) => setDesign((current) => ({ ...current, sections: current.sections.map((item) => item.id === section.id ? { ...item, title: event.target.value } : item) }))} /></label><label>Purpose<input value={section.description} onChange={(event) => setDesign((current) => ({ ...current, sections: current.sections.map((item) => item.id === section.id ? { ...item, description: event.target.value } : item) }))} /></label><button onClick={() => setDesign((current) => ({ ...current, sections: current.sections.filter((item) => item.id !== section.id) }))}>Remove</button></article>)}</section>
        <button className="dialog-primary align-right" onClick={() => { if (!design.sections.some((item) => item.id === contentSectionId)) setContentSectionId(design.sections[0]?.id ?? "section-1"); setStep("content"); }}>Build learning content <ChevronRight /></button>
      </div>}

      {step === "content" && <div className="content-authoring commercial-content-authoring">
        <section className="content-ingestion-studio"><div className="studio-section-heading"><div><p className="eyebrow">MULTI-FORMAT CONTENT INGESTION</p><h3>Turn sources into readable learning blocks</h3><p>Author text, upload protected originals or import a public link. PDF, DOCX, HTML, Markdown, TXT and RTF sources are converted to learner-readable HTML where possible.</p></div><FileText /></div>
          <div className="content-mode-tabs">{(["text", "file", "url"] as const).map((mode) => <button key={mode} className={contentMode === mode ? "active" : ""} onClick={() => setContentMode(mode)}>{mode === "text" ? <Pencil /> : mode === "file" ? <Upload /> : <Search />}<span>{mode === "text" ? "Write or paste" : mode === "file" ? "Upload document" : "Import public link"}</span></button>)}</div>
          <div className="content-placement-grid"><label>Learning-block title<input value={contentTitle} onChange={(event) => setContentTitle(event.target.value)} placeholder="A concise learner-facing title" /></label><label>Course section<select value={contentSectionId} onChange={(event) => setContentSectionId(event.target.value)}>{design.sections.map((section) => <option value={section.id} key={section.id}>{section.title}</option>)}</select></label><label>Unit / lesson label<input value={contentUnitTitle} onChange={(event) => setContentUnitTitle(event.target.value)} /></label><label>Author or source<input value={contentSource} onChange={(event) => setContentSource(event.target.value)} /></label><label>Licence / rights note<input value={contentLicense} onChange={(event) => setContentLicense(event.target.value)} /></label></div>
          <div className="outcome-mapping"><b>Align to learning outcomes</b><div>{design.outcomes.map((outcome, index) => <label key={outcome.id} className={contentOutcomeIds.includes(outcome.id) ? "selected" : ""}><input type="checkbox" checked={contentOutcomeIds.includes(outcome.id)} onChange={() => setContentOutcomeIds((items) => items.includes(outcome.id) ? items.filter((id) => id !== outcome.id) : [...items, outcome.id])} /><span>LO {index + 1}</span>{outcome.statement}</label>)}</div></div>
          {contentMode === "text" && <div className="text-content-editor"><label>Input format<select value={contentFormat} onChange={(event) => setContentFormat(event.target.value as "text" | "html")}><option value="text">Plain text / Markdown-style</option><option value="html">Sanitised HTML</option></select></label><label>Lesson content<textarea value={contentText} onChange={(event) => setContentText(event.target.value)} placeholder="# Lesson heading&#10;&#10;Paste or write the complete lesson. Headings, lists and emphasis become readable HTML." /></label></div>}
          {contentMode === "file" && <label className="upload-zone commercial-single-upload"><Upload /><b>{contentFile?.name ?? "Choose PDF, DOCX or learning media"}</b><span>Protected original · automatic readable-text conversion where supported · 25 MB maximum</span><input type="file" accept=".pdf,.doc,.docx,.txt,.md,.html,.htm,.rtf,.ppt,.pptx,.csv,.jpg,.jpeg,.png,.webp,.mp3,.wav,.mp4,.webm" onChange={(event) => setContentFile(event.target.files?.[0] ?? null)} /></label>}
          {contentMode === "url" && <div className="url-content-import"><label>Public source URL<input type="url" value={contentUrl} onChange={(event) => setContentUrl(event.target.value)} placeholder="https://…" /></label><label className="embed-choice"><Switch checked={contentEmbedOnly} onCheckedChange={setContentEmbedOnly} /><span><b>Embed rather than convert</b>Use for interactive tools or pages whose content should remain at the source.</span></label></div>}
          <button className="dialog-primary" disabled={importingContent || contentOutcomeIds.length === 0} onClick={() => void importCourseContent()}><FileText /> {importingContent ? "Building readable lesson…" : "Add learning block to course"}</button>
        </section>
        <section className="structured-content-outline"><header><div><p className="eyebrow">STRUCTURED COURSE OUTLINE</p><h3>{materials.length} learning block{materials.length === 1 ? "" : "s"}</h3></div><span>{design.sections.length} section{design.sections.length === 1 ? "" : "s"}</span></header>{design.sections.map((section) => <article key={section.id}><div className="outline-section-title"><BookOpen /><div><b>{section.title}</b><span>{section.description}</span></div></div>{materials.filter((material) => material.sectionId === section.id).map((material) => <div className="outline-material" key={material.id ?? material.title}><span>{material.kind}</span><div><b>{material.title}</b><small>{material.unitTitle} · {material.estimatedMinutes ?? 5} min · {(material.outcomeIds ?? []).length} outcomes</small></div>{material.kind === "Watch" ? <details className="outline-transcript"><summary>{material.transcriptPublished && material.transcript ? "Transcript ready" : "Add transcript"}</summary><textarea value={material.transcript ?? ""} onChange={(event) => setMaterials((items) => items.map((item) => item === material ? { ...item, transcript: event.target.value, transcriptLanguage: item.transcriptLanguage ?? "English", transcriptSource: "Facilitator supplied" } : item))} placeholder="Paste or type the complete reviewed transcript…" /><label><input type="checkbox" checked={Boolean(material.transcriptPublished)} onChange={(event) => setMaterials((items) => items.map((item) => item === material ? { ...item, transcriptPublished: event.target.checked } : item))} /> Publish reviewed transcript</label></details> : <label title="Confirm the material has been reviewed for accessibility"><input type="checkbox" checked={Boolean(material.accessibilityChecked)} onChange={(event) => setMaterials((items) => items.map((item) => item === material ? { ...item, accessibilityChecked: event.target.checked } : item))} /> Accessible</label>}<button onClick={() => setMaterials((items) => items.filter((item) => item !== material))}>Remove</button></div>)}</article>)}</section>
        <div className="authoring-tabs"><section><p className="eyebrow">BATCH FILE IMPORT</p><h3>Documents and media</h3><p>Add several files using the placement and outcome settings above.</p><label className="upload-zone"><FileText /><b>Choose files to upload</b><span>Multiple files supported · protected delivery</span><input type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.html,.rtf,.csv,.jpg,.jpeg,.png,.mp3,.mp4" onChange={(event) => handleFiles(event.target.files)} /></label>{files.length > 0 && <div className="uploaded-files">{files.map((file, index) => <article key={`${file.name}-${index}`}><FileText /><div><b>{file.name}</b><span>{file.size} · {file.type}</span></div><button onClick={() => { setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index)); toast.success("File removed from import summary"); }}>Remove</button></article>)}</div>}</section>
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
        <div className="mode-grid">{[["Objective quiz", "Multiple choice, fill-in and randomized knowledge checks"], ["Video watch + answer", "Require viewing before a question unlocks"], ["Pause check", "Pause the video or lesson at a checkpoint and answer before continuing"], ["Short answer", "Brief constructed response with rubric"], ["Essay / reflection", "Analytical response tied to a local case or personal evidence"], ["Practical assignment", "Upload project, workplace, lab or portfolio evidence"], ["Viva / oral defence", "Facilitator-led oral verification of the learner's submitted work"], ["Authentic evidence", "Require calculations, screenshots, field data, source files or process evidence"]].map(([mode, detail]) => <button key={mode} className={assessmentModes.includes(mode) ? "selected" : ""} onClick={() => toggleMode(mode)}><span>{assessmentModes.includes(mode) ? <CheckCircle2 /> : <FileCheck2 />}</span><div><b>{mode}</b><p>{detail}</p></div></button>)}</div>
        <div className="gate-settings"><div><ShieldCheck /><div><b>Pause, assess understanding and continue</b><p>Stop the lesson at the checkpoint. Unlock the next activity only after the learner meets the pass mark.</p></div></div><Switch checked={gateRequired} onCheckedChange={setGateRequired} /><label>Pass mark<input type="number" value={passMark} onChange={(event) => setPassMark(Number(event.target.value))} min="1" max="100" /><span>%</span></label><label>Attempts<select value={attempts} onChange={(event) => setAttempts(event.target.value)}><option>1</option><option>2</option><option>3</option><option>Unlimited</option></select></label></div>
        <div className="assessment-publish-settings"><label>Number of questions to set<input type="number" min="1" max="100" value={questionLimit} onChange={(event) => setQuestionLimit(Math.min(100, Math.max(1, Number(event.target.value))))} /><span>{questions.length} of {questionLimit} created</span></label><label className="certificate-setting"><Award /><div><b>Generate UCC QR certificate after completion</b><span>Issued only after verified identity, the course assessment and every activity marked required are complete.</span></div><Switch checked={certificateEnabled} onCheckedChange={setCertificateEnabled} /></label></div>

        <section className="assessment-integrity-panel"><div><p className="eyebrow">ASSESSMENT INTEGRITY</p><h3>Design for demonstrated performance, not answer recall</h3><p>No online assessment can be made completely AI-proof. Use a mix of controlled video checkpoints, randomized questions, local scenarios, practical evidence, handwritten workings and short oral verification so the learner must demonstrate how the answer was produced.</p></div><div className="integrity-grid"><article><Video /><b>Watch → pause → answer</b><span>Unlock questions only after the configured video segment is viewed.</span></article><article><RotateCcw /><b>Question variation</b><span>Build a larger bank than the displayed question limit and vary prompts, data or cases.</span></article><article><Sigma /><b>Show working</b><span>Require calculations, whiteboard workings, annotated evidence or intermediate steps.</span></article><article><MessageSquareText /><b>Oral verification</b><span>Use a short viva for high-stakes tasks or suspicious/exceptional submissions.</span></article><article><FlaskConical /><b>Authentic task</b><span>Assess a practical, workplace, lab, coding or locally grounded deliverable.</span></article><article><ShieldCheck /><b>Evidence chain</b><span>Require source files, timestamps, drafts, screenshots or process notes where appropriate.</span></article></div></section>

        <div className="assessment-source-grid"><section><p className="eyebrow">UPLOAD QUESTION BANK</p><h3>Import test questions or marking material</h3><p>Upload CSV, Excel, Word, PDF or text files. The files are retained with the draft for facilitator and quality review.</p><label className="upload-zone compact-upload"><FileCheck2 /><b>Choose assessment files</b><span>CSV · XLSX · DOCX · PDF · TXT</span><input type="file" multiple accept=".csv,.xls,.xlsx,.doc,.docx,.pdf,.txt" onChange={(event) => handleQuestionFiles(event.target.files)} /></label>{questionFiles.length > 0 && <div className="uploaded-files">{questionFiles.map((file, index) => <article key={`${file.name}-${index}`}><FileCheck2 /><div><b>{file.name}</b><span>{file.size} · assessment source</span></div><button onClick={() => setQuestionFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></article>)}</div>}</section>
        <section className="question-bank-summary"><p className="eyebrow">QUESTION BANK</p><h3>{questions.length} authored question{questions.length === 1 ? "" : "s"}</h3><p>Every question can carry a correct answer, grading scheme, feedback and learner advice.</p>{questions.map((question, index) => <article key={question.id}><span>{index + 1}</span><div><b>{question.type} · {question.points} point{question.points === 1 ? "" : "s"}{question.whiteboardEnabled ? " · Mathematical whiteboard" : ""}</b><p>{question.prompt}</p></div><button onClick={() => setQuestions((items) => items.filter((item) => item.id !== question.id))}>Remove</button></article>)}{questions.length === 0 && <div className="empty-state">No typed questions yet. Use the editor below or upload a question bank.</div>}</section></div>

        <section className="question-editor"><div className="editor-heading"><div><p className="eyebrow">QUESTION EDITOR</p><h3>Write a question and its grading guidance</h3></div><label>Question type<select value={questionType} onChange={(event) => { setQuestionType(event.target.value); setCorrectAnswer(""); setCorrectOptionIndex(null); }}><option>Multiple choice</option><option>True / false</option><option>Fill in</option><option>Matching</option><option>Drag and drop</option><option>Picture matching</option><option>Video question</option><option>Short answer</option><option>Essay</option><option>Scenario response</option><option>Oral defence prompt</option><option>Evidence upload prompt</option><option>Practical assignment</option></select></label></div><label>Question or task<textarea value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} placeholder="Enter the question exactly as the learner should see it…" /></label><div className="outcome-mapping compact"><b>Outcomes assessed by this question</b><div>{design.outcomes.map((outcome, index) => <label key={outcome.id} className={questionOutcomeIds.includes(outcome.id) ? "selected" : ""}><input type="checkbox" checked={questionOutcomeIds.includes(outcome.id)} onChange={() => setQuestionOutcomeIds((items) => items.includes(outcome.id) ? items.filter((id) => id !== outcome.id) : [...items, outcome.id])} /><span>LO {index + 1}</span>{outcome.statement}</label>)}</div></div>
        {(questionType === "Multiple choice" || questionType === "Video question") && <div className="option-editor correct-option-editor">{questionOptions.map((option, index) => <label key={index}><span><input type="radio" name="correct-option" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} /> Correct</span>Option {String.fromCharCode(65 + index)}<input value={option} onChange={(event) => setQuestionOptions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Answer option ${index + 1}`} /></label>)}</div>}
        {questionType === "True / false" && <div className="truth-selector"><label><input type="radio" name="correct-truth" checked={correctAnswer === "True"} onChange={() => setCorrectAnswer("True")} /> True is correct</label><label><input type="radio" name="correct-truth" checked={correctAnswer === "False"} onChange={() => setCorrectAnswer("False")} /> False is correct</label></div>}
        {["Fill in", "Short answer", "Essay", "Scenario response", "Oral defence prompt", "Evidence upload prompt", "Practical assignment"].includes(questionType) && <label>{questionType === "Fill in" ? "Exact accepted answer" : "Model answer / key points"}<textarea value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} placeholder={questionType === "Fill in" ? "Type the word or phrase accepted as correct" : "Enter the correct response or model answer…"} /></label>}
        {["Matching", "Drag and drop", "Picture matching"].includes(questionType) && <div className="pair-editor"><div><b>Matching pairs</b><span>Enter the prompt and its correct match. Picture matching also accepts an image URL.</span></div>{pairRows.map((pair, index) => <article key={index}>{questionType === "Picture matching" && <label>Picture URL<input value={pair.image ?? ""} onChange={(event) => setPairRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, image: event.target.value } : row))} placeholder="https://…/image.jpg" /></label>}<label>{questionType === "Picture matching" ? "Picture label" : "Prompt"}<input value={pair.left} onChange={(event) => setPairRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, left: event.target.value } : row))} /></label><label>Correct match<input value={pair.right} onChange={(event) => setPairRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, right: event.target.value } : row))} /></label><button onClick={() => setPairRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></article>)}<button className="secondary-action" onClick={() => setPairRows((rows) => [...rows, { left: "", right: "", image: "" }])}>Add matching pair</button></div>}
        {questionType === "Video question" && <div className="video-question-editor"><label>Video link<input value={questionVideoUrl} onChange={(event) => setQuestionVideoUrl(event.target.value)} placeholder="Paste YouTube or direct video link" /></label><label>Required viewing<select value={videoMode} onChange={(event) => setVideoMode(event.target.value as typeof videoMode)}><option value="whole">Whole video</option><option value="part">Selected part</option><option value="pause">Pause and answer</option></select></label><label>Start at second<input type="number" min="0" value={videoStart} onChange={(event) => setVideoStart(Math.max(0, Number(event.target.value)))} /></label><label>Questions appear at second<input type="number" min="1" value={videoEnd} onChange={(event) => setVideoEnd(Math.max(videoStart + 1, Number(event.target.value)))} /></label><p><Video /> The learner must finish the configured whole video or segment before this question becomes visible.</p></div>}
        <div className={`whiteboard-setting ${whiteboardEnabled ? "enabled" : ""}`}><span><Sigma /></span><div><b>Mathematical working whiteboard</b><p>Add a drawing board to this question. Learners can write calculations, convert supported handwriting to editable text and correct the transcription before submitting.</p></div><Switch checked={whiteboardEnabled} onCheckedChange={setWhiteboardEnabled} /></div>
        <label className="points-field">Marks / points<input type="number" value={questionPoints} onChange={(event) => setQuestionPoints(Math.max(1, Number(event.target.value)))} min="1" /></label>
        <label>Marking scheme or rubric<textarea value={markingScheme} onChange={(event) => setMarkingScheme(event.target.value)} placeholder="State the criteria, expected evidence and allocation of marks…" /></label><div className="editor-form-grid"><label>Feedback when correct<textarea value={feedbackCorrect} onChange={(event) => setFeedbackCorrect(event.target.value)} /></label><label>Feedback when incorrect<textarea value={feedbackIncorrect} onChange={(event) => setFeedbackIncorrect(event.target.value)} /></label></div><label>Learner advice and next-step guidance<textarea value={learnerAdvice} onChange={(event) => setLearnerAdvice(event.target.value)} placeholder="Explain what the learner should review or practise next…" /></label><button className="secondary-action add-question" disabled={questions.length >= questionLimit} onClick={addQuestion}><FileCheck2 /> {questions.length >= questionLimit ? `Question limit reached (${questionLimit})` : `Add question ${questions.length + 1} of ${questionLimit}`}</button></section>
        <button className="dialog-primary align-right" onClick={() => setStep("review")}>Review course structure <ChevronRight /></button>
      </div>}

      {step === "review" && <div className="course-review commercial-quality-review">
        <div className="review-hero"><span>{courseCode || "COURSE CODE"} · VERSION {draftVersion}</span><h3>{courseTitle || "Untitled microcredential"}</h3><p>{description || "Add a learner-facing course description."}</p><div><b>{design.outcomes.length}</b> learning outcomes <b>{design.sections.length}</b> syllabus sections <b>{materials.length}</b> learning blocks <b>{courseActivities.filter((activity) => activity.required).length}</b> required activities <b>{questions.length}</b> scored questions</div></div>
        <section className={`quality-score-card ${quality.ready ? "ready" : "needs-work"}`}><div><span>{quality.score}%</span><Progress value={quality.score} /></div><div><p className="eyebrow">PUBLISH READINESS</p><h3>{quality.ready ? "Ready for UCC academic review" : "Complete the remaining quality checks"}</h3><p>{quality.ready ? "The blueprint, alignment, accessibility and assessment checks are complete." : "Save this version as a draft or return to the indicated studio step."}</p></div>{quality.ready ? <CheckCircle2 /> : <Gauge />}</section>
        <div className="quality-check-grid">{quality.checks.map((check) => <article className={check.passed ? "passed" : "missing"} key={check.id}>{check.passed ? <CheckCircle2 /> : <Clock3 />}<div><b>{check.label}</b><p>{check.passed ? "Quality check complete" : check.detail}</p></div></article>)}</div>
        <div className="review-columns"><section><p className="eyebrow">LEARNER PREVIEW · COURSE OUTLINE</p>{design.sections.map((section, sectionIndex) => <div className="review-section" key={section.id}><h3>{sectionIndex + 1}. {section.title}</h3>{materials.filter((material) => material.sectionId === section.id).map((material, index) => <article key={material.id ?? `${material.title}-${index}`}><span>{index + 1}</span><div><b>{material.title}</b><p>{material.kind} · {material.unitTitle} · {(material.outcomeIds ?? []).length} mapped outcomes</p></div><button onClick={() => setMaterials((items) => items.filter((item) => item !== material))}>Remove</button></article>)}</div>)}{courseActivities.map((activity, index) => <article className="review-programme-activity" key={activity.id}><span>{materials.length + index + 1}</span><div><b>{activity.title}</b><p>{activity.kind === "colab" ? "Colab coding" : `${activity.discipline} virtual practical`} · {activity.required ? "required" : "optional"} · pass {activity.passMark}%</p></div><button onClick={() => setCourseActivities((items) => items.filter((item) => item.id !== activity.id))}>Remove</button></article>)}</section><section><p className="eyebrow">ASSESSMENT & CREDENTIAL GATE</p>{design.outcomes.map((outcome, index) => <article key={outcome.id}><span>{index + 1}</span><div><b>{outcome.statement}</b><p>{outcome.skill} · {outcome.assessmentMethod}</p></div></article>)}<article><span><FileCheck2 /></span><div><b>{questions.length} scored questions</b><p>{questionFiles.length} source files · {attempts} attempts · pass mark {passMark}%</p></div></article><article className="ucc-certificate-review"><span><Award /></span><div><b>University of Cape Coast digital certificate</b><p>{certificateEnabled ? "Generated only after verified identity, assessment pass and every required activity. Includes a live verification QR." : "Certificate generation is disabled for this course."}</p></div></article></section></div>
        <div className="publish-actions"><button className="secondary-action" onClick={() => setStep("assessment")}>Return to editing</button><button className="secondary-action" disabled={saving} onClick={() => void saveCourse("draft")}><FileCheck2 /> {saving ? "Saving…" : "Save as draft"}</button><button className="dialog-primary" disabled={saving || !quality.ready} onClick={() => void saveCourse("review")}><ShieldCheck /> {saving ? "Submitting…" : "Submit version for UCC review"}</button></div>
      </div>}
    </section>

    <aside className="builder-panel persistent-sequence"><p className="eyebrow">LIVE COURSE OUTLINE</p><h2>{courseTitle || "Untitled course"}</h2><div className="sequence-list">{materials.map((material, index) => <article key={`${material.title}-${index}`} className={material.kind.includes("check") ? "gate" : ""}><span>{material.kind === "Watch" ? <Video /> : material.kind === "Code" ? <Code2 /> : <FileText />}</span><div><b>{index + 1} · {material.kind}</b><p>{material.title}</p></div><CheckCircle2 /></article>)}{courseActivities.map((activity, index) => <article key={activity.id} className="programme-activity"><span>{activity.kind === "colab" ? <Code2 /> : <FlaskConical />}</span><div><b>{materials.length + index + 1} · {activity.kind === "colab" ? "Colab" : "Virtual lab"}</b><p>{activity.title}</p></div>{activity.required ? <ShieldCheck /> : <CheckCircle2 />}</article>)}{assessmentModes.length > 0 && <article className="gate"><span><FileCheck2 /></span><div><b>{materials.length + courseActivities.length + 1} · Assessment</b><p>{assessmentModes.join(" · ")}</p></div><ShieldCheck /></article>}</div><div className="release-rule"><ShieldCheck /><p><b>Progress rule</b>{gateRequired ? "Learners must meet the pass mark before the next activity unlocks." : "Activities are available without a required assessment gate."}</p></div><button className="secondary-action" onClick={() => setLearnerPreviewOpen(true)}><Eye /> Preview as student</button><button className="dialog-primary" onClick={() => setStep("review")}>Review draft course</button></aside>

    <Dialog open={learnerPreviewOpen} onOpenChange={setLearnerPreviewOpen}><DialogContent className="learner-preview-dialog"><DialogHeader><p className="eyebrow">STUDENT PORTAL PREVIEW</p><DialogTitle>{courseTitle || "Untitled microcredential"}</DialogTitle><DialogDescription>This is the learner-facing experience using the current unsaved studio state. Test the flow before submission.</DialogDescription></DialogHeader><PublishedCourseExperience course={{ code: courseCode || "DRAFT", title: courseTitle || "Untitled microcredential", school: "Facilitator preview", progress: 0, modules: `${materials.length + courseActivities.length} learning activities`, accent: "teal", next: "Preview", discipline, description, materials, activities: courseActivities, assessmentConfig: { passMark, attempts, questions }, design, certificateEnabled, status: "preview", facilitatorName: "Course facilitator" }} onOpenActivity={() => toast.info("Programme activity preview", { description: "Use the dedicated activity preview in the Activities step to test the full practical or Colab workflow." })} preview /></DialogContent></Dialog>

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
  const [form, setForm] = useState({ fullName: profile.fullName, dateOfBirth: profile.dateOfBirth ?? "", gender: profile.gender ?? "", nationality: profile.nationality ?? "Ghanaian", phone: profile.phone ?? "", address: profile.address ?? "", educationLevel: profile.educationLevel ?? "", occupation: profile.occupation ?? "", organisation: profile.organisation ?? "", interests: (profile.interests ?? []).join(", "), preferredLanguage: profile.preferredLanguage ?? "English", accessibilityNeeds: profile.accessibilityNeeds ?? "", idType: profile.idType ?? "Ghana Card", idNumber: "", consent: false });
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
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: form.fullName, dateOfBirth: form.dateOfBirth, gender: form.gender, nationality: form.nationality, phone: form.phone, address: form.address, educationLevel: form.educationLevel, occupation: form.occupation, organisation: form.organisation, interests: form.interests.split(",").map((item) => item.trim()).filter(Boolean), preferredLanguage: form.preferredLanguage, accessibilityNeeds: form.accessibilityNeeds, ...(replacingIdentity ? { idType: form.idType, idLast4: form.idNumber.slice(-4), idDocumentKey, selfieKey } : {}) }) });
      const result = await response.json() as { profile?: { email: string; full_name: string; role: PortalRole; status: string; identity_status?: string; date_of_birth?: string; gender?: string; nationality?: string; phone?: string; address?: string; id_type?: string; id_last4?: string; student_number?: string; education_level?: string; occupation?: string; organisation?: string; interests_json?: string; preferred_language?: string; accessibility_needs?: string }; error?: string };
      if (!response.ok || !result.profile) throw new Error(result.error ?? "The profile could not be saved.");
      onUpdated({ email: result.profile.email, fullName: result.profile.full_name, role: result.profile.role, status: result.profile.status, identityStatus: result.profile.identity_status, dateOfBirth: result.profile.date_of_birth, gender: result.profile.gender, nationality: result.profile.nationality, phone: result.profile.phone, address: result.profile.address, idType: result.profile.id_type, idLast4: result.profile.id_last4, studentNumber: result.profile.student_number, educationLevel: result.profile.education_level, occupation: result.profile.occupation, organisation: result.profile.organisation, interests: (() => { try { return JSON.parse(result.profile!.interests_json || "[]") as string[]; } catch { return []; } })(), preferredLanguage: result.profile.preferred_language, accessibilityNeeds: result.profile.accessibility_needs });
      setIdDocumentKey(""); setSelfieKey(""); setForm((current) => ({ ...current, idNumber: "", consent: false }));
      toast.success(replacingIdentity ? "Profile saved and identity review requested" : "Profile details saved", { description: replacingIdentity ? "An assigned UCC reviewer will compare the national ID and live selfie." : "Your permanent biodata is up to date." });
    } catch (error) { toast.error(error instanceof Error ? error.message : "The profile could not be saved."); }
    finally { setSaving(false); }
  };
  const status = (profile.identityStatus ?? "not_submitted").replaceAll("_", " ");
  return <div className="profile-editor"><div className="profile-summary"><span className="avatar large">{profile.fullName.split(/\s+/).map((part) => part[0]).slice(0,2).join("")}</span><div><h3>{profile.fullName}</h3><p>{profile.email} · {profile.role}</p><span className={`identity-status ${profile.identityStatus ?? "not_submitted"}`}><ShieldCheck /> Identity {status}</span></div></div><section><p className="eyebrow">PERMANENT BIO DATA</p><div className="profile-form-grid"><label>Full legal name<input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} /></label><label>Verified sign-in email<input value={profile.email} readOnly /></label><label>Date of birth<input type="date" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} /></label><label>Gender<select value={form.gender} onChange={(event) => update("gender", event.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label><label>Nationality<input value={form.nationality} onChange={(event) => update("nationality", event.target.value)} /></label><label>Phone number<input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label>{profile.role === "learner" && <label>Student number<input value={profile.studentNumber ?? "Pending"} readOnly /></label>}{profile.role === "learner" && <label>Education level<input value={form.educationLevel} onChange={(event) => update("educationLevel", event.target.value)} /></label>}{profile.role === "learner" && <label>Occupation or role<input value={form.occupation} onChange={(event) => update("occupation", event.target.value)} /></label>}{profile.role === "learner" && <label>Organisation or school<input value={form.organisation} onChange={(event) => update("organisation", event.target.value)} /></label>}{profile.role === "learner" && <label>Preferred language<input value={form.preferredLanguage} onChange={(event) => update("preferredLanguage", event.target.value)} /></label>}{profile.role === "learner" && <label className="full-field">Learning interests<input value={form.interests} onChange={(event) => update("interests", event.target.value)} placeholder="Comma-separated disciplines" /></label>}<label className="full-field">Residential address<textarea value={form.address} onChange={(event) => update("address", event.target.value)} /></label>{profile.role === "learner" && <label className="full-field">Accessibility and learning support<textarea value={form.accessibilityNeeds} onChange={(event) => update("accessibilityNeeds", event.target.value)} placeholder="Optional support needs" /></label>}</div></section><section className="profile-evidence"><div><p className="eyebrow">IDENTITY EVIDENCE</p><h3>Submit new evidence for verification</h3><p>Your current ID is recorded as {profile.idType ?? "national ID"}{profile.idLast4 ? ` ending ${profile.idLast4}` : ""}. Uploading new evidence requires both the ID and a current live selfie.</p></div><div className="identity-grid"><label>ID type<select value={form.idType} onChange={(event) => update("idType", event.target.value)}><option>Ghana Card</option><option>Passport</option><option>National ID</option></select></label><label>ID number<input value={form.idNumber} onChange={(event) => update("idNumber", event.target.value)} placeholder="Only the last four digits are retained" /></label></div><div className="evidence-grid"><label className={idDocumentKey ? "evidence-ready" : ""}><FileText /><b>{idDocumentKey ? "National ID ready" : "Upload national ID"}</b><span>Clear front image or PDF · maximum 8 MB</span><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => upload(event.target.files?.[0], "id")} />{uploading === "id" && <em>Uploading securely…</em>}</label><LiveSelfieCapture ready={Boolean(selfieKey)} uploading={uploading === "selfie"} onCaptured={(file) => upload(file, "selfie")} /></div>{replacingIdentity && <label className="identity-consent"><input type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)} /><span>I consent to restricted UCC processing of my national ID and facial image for identity verification.</span></label>}</section><button className="dialog-primary profile-save" disabled={saving || Boolean(uploading)} onClick={save}><ShieldCheck /> {saving ? "Saving profile…" : replacingIdentity ? "Save and submit for verification" : "Save profile details"}</button></div>;
}

function UtilityDialog({ value, profile, onProfileUpdated, onClose }: { value: "notifications" | "support" | "preferences" | "profile" | "assessment" | null; profile: AccountProfile; onProfileUpdated: (profile: AccountProfile) => void; onClose: () => void }) {
  const roleName = profile.role === "learner" ? "Student" : profile.role === "facilitator" ? "Facilitator" : "Administrator";
  const title = value === "notifications" ? "Notifications" : value === "support" ? `${roleName} support` : value === "preferences" ? "Preferences" : value === "profile" ? `${roleName} profile` : "Assessment attempt";
  const notificationItems = profile.role === "learner"
    ? [{ title: "Assessment due Friday", detail: "Open Assessments to review the requirements", icon: FileCheck2 }, { title: "Live session tomorrow", detail: "Open Live sessions for the room and calendar", icon: Video }]
    : profile.role === "facilitator"
      ? [{ title: "Evidence awaiting assessment", detail: "Open the coding and practical assessment queues", icon: ClipboardCheck }, { title: "Course review status available", detail: "Open Course studio to review the decision", icon: BookOpen }]
      : [{ title: "Identity decisions require attention", detail: "Open Identity governance to review the queue", icon: ShieldCheck }, { title: "Courses await academic activation", detail: "Open Course approvals to record a decision", icon: FileCheck2 }];
  const preferenceItems = profile.role === "learner"
    ? [{ title: "Assessment reminders", detail: "Notify me 48 hours before a deadline", checked: true }, { title: "Live-class reminders", detail: "Notify me 15 minutes before a session", checked: true }, { title: "Weekly progress email", detail: "Receive a learning summary every Monday", checked: false }]
    : profile.role === "facilitator"
      ? [{ title: "Marking-queue alerts", detail: "Notify me when new evidence is submitted", checked: true }, { title: "Course review decisions", detail: "Notify me when an administrator records a decision", checked: true }, { title: "Weekly teaching digest", detail: "Receive a summary of active delivery and feedback", checked: false }]
      : [{ title: "Access and identity alerts", detail: "Notify me when governance action is required", checked: true }, { title: "Course approval alerts", detail: "Notify me when a course enters academic review", checked: true }, { title: "Weekly operations digest", detail: "Receive an institutional activity summary", checked: false }];
  return <Dialog open={Boolean(value)} onOpenChange={(open) => !open && onClose()}><DialogContent className={value === "profile" ? "utility-dialog profile-dialog" : "utility-dialog"}><DialogHeader><p className="eyebrow">UCC MICROCREDENTIALS</p><DialogTitle>{title}</DialogTitle><DialogDescription>{value === "assessment" ? "Complete the objective item and optional essay response." : value === "profile" ? "Complete biodata and submit current identity evidence for restricted UCC verification." : "Manage this area without leaving your role-protected workspace."}</DialogDescription></DialogHeader>
    {value === "notifications" && <div className="utility-list">{notificationItems.map((item) => { const Icon = item.icon; return <button key={item.title} onClick={() => toast.success("Marked as read")}><Icon /><div><b>{item.title}</b><span>{item.detail}</span></div></button>; })}</div>}
    {value === "support" && <div className="support-form"><label>How can we help?<select defaultValue="technical">{profile.role === "learner" ? <><option value="learning">Learning activity</option><option value="assessment">Assessment or feedback</option><option value="technical">Technical access</option></> : profile.role === "facilitator" ? <><option value="course">Course design or publishing</option><option value="assessment">Assessment workflow</option><option value="technical">Technical access</option></> : <><option value="access">User or access governance</option><option value="quality">Academic quality workflow</option><option value="technical">Platform operations</option></>}</select></label><label>Message<textarea placeholder="Describe the issue and the support team will respond." /></label><button className="dialog-primary" onClick={() => { toast.success("Support request submitted"); onClose(); }}>Send support request</button></div>}
    {value === "preferences" && <div className="preference-list">{preferenceItems.map((item) => <label key={item.title}><div><b>{item.title}</b><span>{item.detail}</span></div><Switch defaultChecked={item.checked} /></label>)}<button className="dialog-primary" onClick={() => { toast.success("Preferences saved"); onClose(); }}>Save preferences</button></div>}
    {value === "profile" && <ProfileEditor profile={profile} onUpdated={onProfileUpdated} />}
    {value === "assessment" && <div className="knowledge-check"><span className="check-count">OBJECTIVE QUESTION · REQUIRED</span><h3>Which element must be approved before a UCC microcredential is delivered?</h3>{["Programme title only", "Learning outcomes and assessment", "Social media campaign", "External logo"].map((option) => <label key={option}><input type="radio" name="assessment-dialog" />{option}</label>)}<details><summary>Optional essay question</summary><textarea placeholder="Explain how quality assurance supports learner trust…" /></details><button className="dialog-primary" onClick={() => { toast.success("Assessment response saved"); onClose(); }}>Save response</button></div>}
  </DialogContent></Dialog>;
}

export const programmeAwards = { certificate: "Certificate", advanced_certificate: "Advanced certificate", diploma: "Diploma", postgraduate_diploma: "Postgraduate diploma", bachelors: "Bachelor’s degree", masters: "Master’s degree", doctorate: "Doctoral degree" } as const;
export type ProgrammeAward = keyof typeof programmeAwards;
export type ProgrammeTerm = { id: string; title: string };
export type ProgrammeCourse = { code: string; title: string; termId: string; credits: number; required: boolean; groupId: string; prerequisites: string[]; passMark: number; category: "taught" | "project" | "practicum" | "thesis" };
export type ElectiveGroup = { id: string; title: string; minimumCredits: number };
export type ProgrammeConfig = {
  code: string; title: string; qualificationTitle: string; award: ProgrammeAward; academicUnit: string; description: string; entryRequirements: string; duration: string; delivery: string; minimumCredits: number;
  terms: ProgrammeTerm[]; courses: ProgrammeCourse[]; electiveGroups: ElectiveGroup[];
  enforceTermProgression: boolean; allowPriorPlatformResults: boolean; allowCreditRecognition: boolean; maximumRecognisedCredits: number;
  certificate: { enabled: boolean; release: "registry" | "automatic"; includeAcademicLead: boolean };
  grading: { enabled: boolean; minimumGpa: number; bands: { minimum: number; grade: string; points: number }[] };
};
export type ProgrammeResult = { code: string; mark: number | null; complete: boolean; registered: boolean; recognised: boolean; evidence: string };
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, max = 4000) => String(v ?? "").trim().slice(0, max);
const number = (v: unknown, fallback = 0) => v === undefined ? fallback : Number(v);
const list = (v: unknown, maximum: number) => Array.isArray(v) ? v.slice(0, maximum) : [];
export function emptyProgramme(): ProgrammeConfig {
  return { code: "", title: "", qualificationTitle: "", award: "certificate", academicUnit: "", description: "", entryRequirements: "", duration: "", delivery: "Fully online", minimumCredits: 0, terms: [{ id: "term-1", title: "Semester 1" }], courses: [], electiveGroups: [], enforceTermProgression: false, allowPriorPlatformResults: false, allowCreditRecognition: false, maximumRecognisedCredits: 0, certificate: { enabled: false, release: "registry", includeAcademicLead: false }, grading: { enabled: false, minimumGpa: 0, bands: [] } };
}
export function normalizeProgramme(value: unknown): ProgrammeConfig {
  const v = object(value), g = object(v.grading), cert = object(v.certificate);
  if (Array.isArray(v.courses) && v.courses.length > 200 || Array.isArray(v.terms) && v.terms.length > 30 || Array.isArray(v.electiveGroups) && v.electiveGroups.length > 40) throw new Error("Use at most 200 courses, 30 terms and 40 elective groups per curriculum.");
  return {
    code: text(v.code, 60).toUpperCase(), title: text(v.title, 240), qualificationTitle: text(v.qualificationTitle, 240), award: text(v.award, 40) as ProgrammeAward, academicUnit: text(v.academicUnit, 240), description: text(v.description, 8000), entryRequirements: text(v.entryRequirements, 8000), duration: text(v.duration, 240), delivery: text(v.delivery, 240), minimumCredits: number(v.minimumCredits),
    terms: list(v.terms, 30).map(raw => { const t = object(raw); return { id: text(t.id, 80), title: text(t.title, 160) }; }),
    electiveGroups: list(v.electiveGroups, 40).map(raw => { const e = object(raw); return { id: text(e.id, 80), title: text(e.title, 160), minimumCredits: number(e.minimumCredits) }; }),
    courses: list(v.courses, 200).map(raw => { const c = object(raw); return { code: text(c.code, 120).toUpperCase(), title: text(c.title, 240), termId: text(c.termId, 80), credits: number(c.credits), required: c.required !== false, groupId: text(c.groupId, 80), prerequisites: list(c.prerequisites, 30).map(x => text(x, 120).toUpperCase()).filter(Boolean), passMark: number(c.passMark, 50), category: text(c.category || "taught", 40) as ProgrammeCourse["category"] }; }),
    enforceTermProgression: v.enforceTermProgression === true, allowPriorPlatformResults: v.allowPriorPlatformResults === true, allowCreditRecognition: v.allowCreditRecognition === true, maximumRecognisedCredits: number(v.maximumRecognisedCredits),
    certificate: { enabled: cert.enabled === true, release: cert.release === "automatic" ? "automatic" : "registry", includeAcademicLead: cert.includeAcademicLead === true },
    grading: { enabled: g.enabled === true, minimumGpa: number(g.minimumGpa), bands: list(g.bands, 20).map(raw => { const b = object(raw); return { minimum: number(b.minimum), grade: text(b.grade, 12), points: number(b.points) }; }) },
  };
}
export function programmeIssues(c: ProgrammeConfig): string[] {
  const issues: string[] = [], terms = new Map(c.terms.map((t, i) => [t.id, i])), courses = new Map(c.courses.map(x => [x.code, x]));
  if (!/^[A-Z0-9][A-Z0-9 ._/-]{1,59}$/.test(c.code)) issues.push("Provide a programme code using 2–60 letters, numbers or ordinary code separators.");
  if (!c.title || !c.qualificationTitle || !Object.hasOwn(programmeAwards, c.award) || !c.academicUnit || c.description.length < 20 || !c.entryRequirements || !c.duration || !c.delivery) issues.push("Complete the title, exact qualification title, award level, academic unit, description, admission requirements, duration and delivery mode.");
  if (!c.terms.length || terms.size !== c.terms.length || c.terms.some(t => !t.id || !t.title)) issues.push("Give each semester or term a distinct identifier and a title.");
  if (!c.courses.length || courses.size !== c.courses.length) issues.push("Add courses once each. A course cannot be counted twice towards the same programme.");
  if (c.terms.some(t => !c.courses.some(x => x.termId === t.id))) issues.push("Every planned term needs at least one course.");
  const groups = new Map(c.electiveGroups.map(g => [g.id, g]));
  if (groups.size !== c.electiveGroups.length || c.electiveGroups.some(g => !g.id || !g.title || !Number.isFinite(g.minimumCredits) || g.minimumCredits <= 0)) issues.push("Give each elective group a distinct identifier, title and positive credit requirement.");
  for (const x of c.courses) {
    if (!x.code || !x.title || !terms.has(x.termId) || !Number.isFinite(x.credits) || x.credits <= 0 || x.credits > 300 || !Number.isFinite(x.passMark) || x.passMark < 1 || x.passMark > 100 || !["taught", "project", "practicum", "thesis"].includes(x.category)) issues.push("Check the title, term, credits, pass mark and category for " + (x.code || "each course") + ".");
    if (x.required && x.groupId || !x.required && !groups.has(x.groupId)) issues.push("Assign every elective to a group and keep core courses outside elective groups.");
    if (new Set(x.prerequisites).size !== x.prerequisites.length || x.prerequisites.some(p => p === x.code || !courses.has(p) || (terms.get(courses.get(p)!.termId) ?? 999) > (terms.get(x.termId) ?? -1))) issues.push("Prerequisites for " + x.code + " must be distinct curriculum courses in the same or an earlier term.");
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const cyclic = (code: string): boolean => { if (visiting.has(code)) return true; if (visited.has(code)) return false; visiting.add(code); for (const p of courses.get(code)?.prerequisites || []) if (cyclic(p)) return true; visiting.delete(code); visited.add(code); return false; };
  if (c.courses.some(x => cyclic(x.code))) issues.push("Remove circular prerequisites so a learner can begin the curriculum.");
  for (const g of c.electiveGroups) {
    const members = c.courses.filter(x => !x.required && x.groupId === g.id);
    if (!members.length || members.reduce((s, x) => s + x.credits, 0) < g.minimumCredits) issues.push("Elective group “" + g.title + "” cannot supply its required credits.");
    if (new Set(members.map(x => x.termId)).size > 1) issues.push("Keep elective group “" + g.title + "” in one term so progression can be checked consistently.");
  }
  const required = c.courses.filter(x => x.required).reduce((s, x) => s + x.credits, 0) + c.electiveGroups.reduce((s, g) => s + g.minimumCredits, 0), available = c.courses.reduce((s, x) => s + x.credits, 0);
  if (!Number.isFinite(c.minimumCredits) || c.minimumCredits <= 0 || c.minimumCredits < required || c.minimumCredits > available) issues.push("The total credit requirement must cover all core and elective-group requirements and be achievable from the curriculum.");
  if (!Number.isFinite(c.maximumRecognisedCredits) || c.maximumRecognisedCredits < 0 || c.maximumRecognisedCredits > c.minimumCredits || c.allowCreditRecognition && c.maximumRecognisedCredits <= 0) issues.push("Set an achievable recognised-credit limit when credit recognition is enabled.");
  if (c.grading.enabled) {
    const bands = c.grading.bands;
    if (!bands.length || !bands.some(b => b.minimum === 0) || new Set(bands.map(b => b.minimum)).size !== bands.length || bands.some(b => !b.grade || !Number.isFinite(b.minimum) || b.minimum < 0 || b.minimum > 100 || !Number.isFinite(b.points) || b.points < 0 || b.points > 10) || !Number.isFinite(c.grading.minimumGpa) || c.grading.minimumGpa < 0 || c.grading.minimumGpa > Math.max(...bands.map(b => b.points))) issues.push("Supply the approved grading bands, including a zero-mark band, and a valid minimum GPA.");
    const ordered = [...bands].sort((a, b) => a.minimum - b.minimum); if (ordered.some((b, i) => i > 0 && b.points < ordered[i - 1].points)) issues.push("Grade points must not decrease as marks increase.");
  }
  return [...new Set(issues)];
}
export function programmeProgress(config: ProgrammeConfig, results: ProgrammeResult[]) {
  const byCode = new Map(results.map(r => [r.code, r]));
  const rows = config.courses.map(course => { const result = byCode.get(course.code), passed = Boolean(result?.complete && (result.registered || result.recognised) && (result.recognised && result.mark === null || result.mark !== null && result.mark !== undefined && result.mark >= course.passMark)); const band = config.grading.enabled && result?.mark !== null && result?.mark !== undefined ? [...config.grading.bands].sort((a, b) => b.minimum - a.minimum).find(b => result.mark! >= b.minimum) : undefined; return { ...course, ...result, code: course.code, mark: result?.mark ?? null, complete: passed, registered: result?.registered ?? false, recognised: result?.recognised ?? false, evidence: result?.evidence || "Not registered", grade: band?.grade || "", gradePoints: band?.points ?? null }; });
  const earnedCredits = rows.filter(r => r.complete).reduce((s, r) => s + r.credits, 0), recognisedCredits = rows.filter(r => r.complete && r.recognised).reduce((s, r) => s + r.credits, 0);
  const electiveGroups = config.electiveGroups.map(g => ({ ...g, earnedCredits: rows.filter(r => r.complete && !r.required && r.groupId === g.id).reduce((s, r) => s + r.credits, 0) }));
  const terms = config.terms.map(t => ({ ...t, complete: rows.filter(r => r.termId === t.id && r.required).every(r => r.complete) && electiveGroups.filter(g => rows.some(r => r.termId === t.id && r.groupId === g.id)).every(g => g.earnedCredits >= g.minimumCredits) }));
  const graded = rows.filter(r => r.gradePoints !== null && r.registered && !r.recognised), gradedCredits = graded.reduce((s, r) => s + r.credits, 0);
  const gpa = config.grading.enabled && gradedCredits ? graded.reduce((s, r) => s + r.credits * r.gradePoints!, 0) / gradedCredits : null;
  const blockers: string[] = [];
  if (rows.some(r => r.required && !r.complete)) blockers.push("Pass every core, project, practicum and thesis requirement selected as core.");
  if (electiveGroups.some(g => g.earnedCredits < g.minimumCredits)) blockers.push("Complete the minimum credits in each elective group.");
  if (earnedCredits < config.minimumCredits) blockers.push("Earn at least " + config.minimumCredits + " programme credits.");
  if (recognisedCredits > (config.allowCreditRecognition ? config.maximumRecognisedCredits : 0)) blockers.push("Recognised credits exceed the approved curriculum policy.");
  if (config.grading.enabled && config.grading.minimumGpa > 0 && (gpa === null || gpa < config.grading.minimumGpa)) blockers.push("Meet the approved minimum GPA.");
  if (programmeIssues(config).length) blockers.push("The curriculum needs academic correction.");
  return { rows, terms, electiveGroups, earnedCredits, recognisedCredits, gradedCredits, gpa, eligible: blockers.length === 0, blockers };
}
export function programmeRegistrationIssues(config: ProgrammeConfig, progress: ReturnType<typeof programmeProgress>, code: string, currentTerm: number) {
  const course = config.courses.find(x => x.code === code); if (!course) return ["Choose a course in the admitted curriculum."];
  const issues: string[] = [];
  if (course.prerequisites.some(p => !progress.rows.find(r => r.code === p)?.complete)) issues.push("Pass the listed prerequisites before registering for this course.");
  const term = config.terms.findIndex(t => t.id === course.termId) + 1;
  if (config.enforceTermProgression && term > currentTerm) issues.push("The registry must release this term after the required earlier work is complete.");
  return issues;
}

export function programmeEvidenceFingerprint(rows: {code:string;mark:number|null;complete:boolean;recognised:boolean;registered:boolean;credits:number}[]) { return JSON.stringify(rows.map(r => [r.code,r.mark,r.complete,r.recognised,r.registered,r.credits]).sort((a,b) => String(a[0]).localeCompare(String(b[0])))); }

/** Public discovery metadata only. Lesson files and answer keys stay in the learner portal. */
export const learningRoutes = [
  { id: "microcredential", title: "Microcredentials and short courses", summary: "Focused skills and stackable learning." },
  { id: "cpd", title: "Continuing professional development", summary: "Professional learning and approved CPD awards." },
  { id: "certificate", title: "Full certificates and diplomas", summary: "Complete credit-bearing programmes." },
  { id: "degree", title: "Degree programmes", summary: "Bachelor’s, master’s and doctoral study." },
] as const;
export type LearningRoute = typeof learningRoutes[number]["id"];
export type DiscoveryOffering = {
  id: number; kind?: "course" | "programme"; route?: string; code: string; title: string; discipline: string; description: string;
  termCount?: number; credits?: number; duration?: string; entryRequirements?: string; qualificationTitle?: string;
  facilitatorName?: string; materials?: { id?: string; title: string; sectionTitle?: string }[];
  design?: { expectedHours?: number; level?: string; deliveryPattern?: string; priceGhs?: number; certificateFeeGhs?: number; outcomes?: { id: string; statement: string }[]; certificate?: { awardType?: string; partnerName?: string; cpdHours?: number; cpdPoints?: number } };
  billing?: { enrollmentPesewas: number; certificatePesewas: number; enrollmentPayer: string; certificatePayer: string };
};
export type DiscoveryFilters = { type?: string; subject?: string; award?: string; provider?: string; q?: string };
export function offeringRoute(kind: string | undefined, award: string | undefined): LearningRoute {
  if (kind === "programme") return ["bachelors", "masters", "doctorate"].includes(award || "") ? "degree" : "certificate";
  return award?.startsWith("cpd_") ? "cpd" : "microcredential";
}
export function discoveryLink(filters: DiscoveryFilters & { offering?: string } = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && value !== "All") query.set(key, value);
  return "/explore" + (query.size ? "?" + query.toString() : "");
}
const normal = (value: string) => value.toLocaleLowerCase("en").replace(/[’']/g, "").replace(/\s+/g, " ").trim();
export function filterOfferings(offerings: DiscoveryOffering[], filters: DiscoveryFilters) {
  return offerings.filter(o => {
    const award = o.design?.certificate?.awardType || "", route = offeringRoute(o.kind, award);
    if (filters.type && filters.type !== "All" && route !== filters.type) return false;
    if (filters.subject && o.discipline !== filters.subject) return false;
    if (filters.award && award !== filters.award) return false;
    if (filters.provider && filters.provider !== "University of Cape Coast" && o.design?.certificate?.partnerName !== filters.provider) return false;
    const query = normal(filters.q || ""); if (!query) return true;
    const text = normal([o.title, o.code, o.discipline, o.description, o.qualificationTitle, ...(o.design?.outcomes || []).map(x => x.statement)].join(" "));
    const related: Record<string, string[]> = {
      "artificial intelligence": ["artificial intelligence", "machine learning", "generative ai", " ai "],
      "data science": ["data science", "data analysis", "data analytics", "statistics"],
      "coding": ["coding", "programming", "python", "javascript", "software development"],
      "cybersecurity": ["cybersecurity", "cyber security", "information security"],
    };
    if (related[query]) return related[query].some(term => (" " + text + " ").includes(term));
    return query.split(" ").every(term => term.length < 3 ? text.split(/[^a-z0-9]+/).includes(term) : text.includes(term));
  });
}
export function awardLabel(award: string = "") {
  const labels: Record<string, string> = { microcredential: "Microcredential", microcredential_achievement: "Microcredential achievement", attendance: "Attendance award", professional_certification: "Professional certification", cpd_achievement: "CPD achievement", cpd_participation: "CPD participation", certificate: "Certificate", advanced_certificate: "Advanced certificate", diploma: "Diploma", postgraduate_diploma: "Postgraduate diploma", bachelors: "Bachelor’s degree", masters: "Master’s degree", doctorate: "Doctoral degree" };
  return labels[award] || award.replaceAll("_", " ") || "Short course";
}

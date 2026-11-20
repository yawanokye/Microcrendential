export type GradeActivity = { id: string; title: string; kind: string };
export type GradeActivityStatus = { status: string; mark: number | null; maximum?: number; feedback?: string };
export type GradeAssessment = { id: number; attemptNumber?: number; status: string; finalScore: number | null; markerFeedback?: string; automaticFeedback?: { earned?: number; available?: number; feedback?: string; learnerAdvice?: string }[] };
export type GradeRow = { key: string; title: string; status: string; earned: number | null; maximum: number | null; percentage: number | null; feedback: string };

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildLearnerGradeRows(activities: GradeActivity[], statuses: Record<string, GradeActivityStatus>, submissions: GradeAssessment[], hasAssessment: boolean, previousPass?: { score?: number | null; passed?: boolean } | null): GradeRow[] {
  const rows: GradeRow[] = activities.map(activity => {
    const state = statuses[activity.id];
    const mark = state?.status === "assessed" ? asNumber(state.mark) : null;
    const max = state ? asNumber(state.maximum) : null;
    return {
      key: `activity-${activity.id}`,
      title: activity.title,
      status: state?.status === "assessed" ? "Assessed" : state?.status === "not_started" || !state ? "Not started" : state.status === "submitted" || state.status === "awaiting_marking" ? "Awaiting marking" : state.status === "resubmit" ? "Revision requested" : "In progress",
      earned: mark,
      maximum: max && max > 0 ? max : null,
      percentage: mark !== null && max && max > 0 ? Math.round(mark / max * 1000) / 10 : null,
      feedback: state?.feedback?.trim() || "",
    };
  });
  if (submissions.length) {
    for (const submission of submissions) {
      const mark = submission.status === "marked" ? asNumber(submission.finalScore) : null;
      const itemFeedback = submission.status === "marked" && Array.isArray(submission.automaticFeedback)
        ? submission.automaticFeedback.map((item, index) => {
            const earned = asNumber(item.earned), available = asNumber(item.available);
            const points = earned !== null && available !== null ? ` (${earned}/${available})` : "";
            const detail = [item.feedback, item.learnerAdvice].filter((text): text is string => typeof text === "string" && Boolean(text.trim())).join(" ");
            return detail ? `Question ${index + 1}${points}: ${detail}` : "";
          }).filter(Boolean)
        : [];
      const feedback = [submission.markerFeedback?.trim() || "", ...itemFeedback].filter(Boolean).join("\n\n");
      rows.push({ key: `assessment-${submission.id}`, title: `Course assessment${submission.attemptNumber ? ` · attempt ${submission.attemptNumber}` : ""}`,
        status: submission.status === "marked" ? "Marked" : submission.status === "resubmit" ? "Revision requested" : "Awaiting marking",
        earned: mark, maximum: 100, percentage: mark, feedback });
    }
  } else if (previousPass?.passed && asNumber(previousPass.score) !== null) {
    const mark = asNumber(previousPass.score);
    rows.push({key:"assessment-previous",title:"Course assessment",status:"Passed",earned:mark,maximum:100,percentage:mark,feedback:""});
  } else if (hasAssessment) {
    rows.push({ key: "assessment-not-started", title: "Course assessment", status: "Not started", earned: null, maximum: 100, percentage: null, feedback: "" });
  }
  return rows;
}

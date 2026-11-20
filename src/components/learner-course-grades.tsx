"use client";

import { useCallback, useEffect, useState } from "react";
import { buildLearnerGradeRows, type GradeActivity, type GradeActivityStatus, type GradeAssessment } from "@/lib/learner-grade-display";

type ResultData = { statuses: Record<string, GradeActivityStatus>; submissions: GradeAssessment[]; passedAssessment?: { score?: number | null; passed?: boolean } | null };

export function LearnerCourseGrades({ code, title, activities, hasAssessment }: { code: string; title: string; activities: GradeActivity[]; hasAssessment: boolean }) {
  const [data, setData] = useState<ResultData | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const query = encodeURIComponent(code);
    async function load() {
      setError(""); setData(null);
      try {
        const responses = await Promise.all([
          fetch(`/api/course-activity-status?courseCode=${query}`, { cache: "no-store", signal: controller.signal }),
          fetch(`/api/assessments?courseCode=${query}`, { cache: "no-store", signal: controller.signal }),
        ]);
        if (responses.some(response => !response.ok)) throw new Error("Your results could not be loaded. Please try again.");
        const [activity, assessment] = await Promise.all(responses.map(response => response.json()));
        if (!controller.signal.aborted) setData({ statuses: activity.statuses ?? {}, submissions: assessment.submissions ?? [], passedAssessment: assessment.passedAssessment });
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Your results could not be loaded.");
      }
    }
    void load();
    return () => controller.abort();
  }, [code, version]);
  const rows = data ? buildLearnerGradeRows(activities, data.statuses, data.submissions, hasAssessment, data.passedAssessment) : [];
  return <section className="course-gradebook" aria-labelledby="course-grade-title">
    <p className="course-workspace-eyebrow">YOUR LEARNING RECORD</p><h2 id="course-grade-title">Grades and feedback</h2>
    <p>{title} · {code}</p>
    <p className="course-grade-note">These are your recorded activity and assessment results. Existing completion and award rules still apply. Weighted contributions to a course total are not available yet.</p>
    {error ? <div role="alert"><p>{error}</p><button onClick={retry}>Try again</button></div> : !data ? <p role="status">Loading your results…</p> : !rows.length ? <p>No assessable activities have been added to this course yet.</p> :
      <div className="course-grade-table-wrap"><table><caption className="sr-only">Your assessment results and feedback</caption><thead><tr><th scope="col">Activity or assessment</th><th scope="col">Status</th><th scope="col">Points earned</th><th scope="col">Percentage</th><th scope="col">Course contribution</th><th scope="col">Feedback</th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.title}</th><td>{row.status}</td><td>{row.earned === null ? "—" : row.earned}{row.maximum !== null ? ` / ${row.maximum}` : ""}</td><td>{row.percentage === null ? "—" : `${row.percentage}%`}</td><td>—</td><td>{row.feedback ? <details><summary>View feedback</summary><p>{row.feedback}</p></details> : "—"}</td></tr>)}</tbody></table></div>}
  </section>;
}

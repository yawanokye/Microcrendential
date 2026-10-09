"use client";
import { useEffect, useRef, useState } from "react";
import type { StructuredLearningActivity } from "@/lib/structured-learning-activities";
export type ExternalActivityStatus = { passed: boolean; status: string; mark: number | null; feedback: string; assessedAt: string | null; maximum?: number; passMark?: number };
export function ExternalActivityPlayer({ courseCode, activity, preview, status, onStatus }: { courseCode: string; activity: StructuredLearningActivity; preview?: boolean; status?: ExternalActivityStatus | null; onStatus?: (status: ExternalActivityStatus) => void }) {
  const [busy, setBusy] = useState(false), [opened, setOpened] = useState(false), [message, setMessage] = useState("");
  const callback=useRef(onStatus);useEffect(()=>{callback.current=onStatus;},[onStatus]);
  useEffect(() => {
    if (!opened || preview) return;
    const refresh = async () => { try { const response = await fetch(`/api/course-activity-status?courseCode=${encodeURIComponent(courseCode)}`); if (!response.ok) return; const data = await response.json(), status = data.statuses?.[activity.id]; if (status) { callback.current?.(status); if (status.status === "assessed") setMessage("Your result has been received from the connected tool."); } } catch {} };
    const timer = setInterval(() => void refresh(), 4000); window.addEventListener("focus", refresh); void refresh();
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [opened, preview, courseCode, activity.id]);
  const launch = async () => {
    const windowRef = window.open("about:blank", "_blank");
    if (!windowRef) return setMessage("Allow this activity to open in a new tab, then try again.");
    windowRef.opener = null; setBusy(true); setMessage("");
    try { const response = await fetch("/api/lti/launch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseCode, activityId: activity.id, ...(preview ? { previewActivity: activity } : {}) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); windowRef.location.href = data.url; setOpened(true); setMessage(preview ? "The facilitator preview is open. It cannot create learner grades." : "The activity is open. Return to this lesson after completing it. Your result is checked automatically."); } catch (e) { windowRef.close(); setMessage(e instanceof Error ? e.message : "The activity could not open."); } finally { setBusy(false); }
  };
  return <div className="native-practice external-activity-player"><h4>{activity.title}</h4><p>{activity.instructions}</p><p>{preview ? "Test the registered external activity before publishing." : "Complete the activity in the connected learning tool. Only a completed, fully graded result can count toward this lesson."}</p><button type="button" onClick={() => void launch()} disabled={busy}>{busy ? "Opening activity" : preview ? "Preview external activity" : "Open interactive activity"}</button>{status?.status==="assessed"&&<div className="inline-activity-feedback"><b>{status.passed?"Activity passed":"Activity not yet passed"} · {status.mark}/{status.maximum??activity.maxMark??100}</b><p>{status.feedback}</p></div>}<p role="status">{message}</p></div>;
}

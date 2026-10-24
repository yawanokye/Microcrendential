"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, FileSearch, FileText, LoaderCircle, ShieldCheck, Sparkles, Upload, WandSparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { ManualCourseProposal, ManualImportGroup, ManualImportStatus } from "@/lib/manual-course-import";

type ImportSelection = Record<ManualImportGroup, boolean>;

const groups: { id: ManualImportGroup; title: string; description: string }[] = [
  { id: "blueprint", title: "Blueprint", description: "Title, code, audience, delivery, workload and access." },
  { id: "outcomes", title: "Outcomes", description: "Objectives, measurable outcomes, skills and sections." },
  { id: "content", title: "Learning content", description: "Original manual and structured readable lesson blocks." },
  { id: "assessment", title: "Assessment & credential", description: "Evidence methods, draft questions, pass rules and certificate gate." },
];

const statusLabels: Record<ManualImportStatus, string> = {
  confirmed: "Found in manual",
  suggested: "Suggested",
  needs_review: "Review required",
  missing: "Missing",
};

export function ManualCourseImporter({
  onApply,
}: {
  onApply: (proposal: ManualCourseProposal, selectedGroups: ManualImportGroup[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [proposal, setProposal] = useState<ManualCourseProposal | null>(null);
  const [phase, setPhase] = useState<"upload" | "review" | "applied">("upload");
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [selection, setSelection] = useState<ImportSelection>({ blueprint: true, outcomes: true, content: true, assessment: true });

  const chooseFile = (nextFile?: File | null) => {
    if (!nextFile) return;
    setFile(nextFile);
    setProposal(null);
    setPhase("upload");
    setConfirmed(false);
    setError("");
  };

  const reset = () => {
    setFile(null);
    setProposal(null);
    setPhase("upload");
    setConfirmed(false);
    setError("");
    setSelection({ blueprint: true, outcomes: true, content: true, assessment: true });
    if (inputRef.current) inputRef.current.value = "";
  };

  const analyse = async () => {
    if (!file) return setError("Choose a learning manual first.");
    setAnalysing(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/course-import/manual", { method: "POST", body });
      const result = await response.json() as { proposal?: ManualCourseProposal; error?: string };
      if (!response.ok || !result.proposal) throw new Error(result.error ?? "The manual could not be analysed.");
      setProposal(result.proposal);
      setPhase("review");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The manual could not be analysed.");
    } finally {
      setAnalysing(false);
    }
  };

  const apply = () => {
    if (!proposal || !confirmed) return;
    const selectedGroups = groups.filter((group) => selection[group.id]).map((group) => group.id);
    if (!selectedGroups.length) return setError("Select at least one part of the proposed course.");
    onApply(proposal, selectedGroups);
    setPhase("applied");
  };

  return <>
    <section className="manual-import-card">
      <span className="manual-import-icon"><WandSparkles /></span>
      <div>
        <p className="eyebrow">MANUAL-TO-COURSE IMPORT</p>
        <h2>Turn a learning manual into a structured course draft</h2>
        <p>Upload a searchable PDF or Word manual. The Studio proposes the blueprint, outcomes, syllabus, readable lessons and assessment—then shows what was found, inferred or still needs your judgement.</p>
        <div className="manual-import-assurances"><span><ShieldCheck /> Facilitator review required</span><span><FileText /> Original retained</span><span><Sparkles /> Unsaved draft only</span></div>
      </div>
      <button className="dialog-primary" type="button" onClick={() => setOpen(true)}><Upload /> Import learning manual</button>
    </section>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="manual-import-dialog">
        <DialogHeader>
          <p className="eyebrow">FACILITATOR COURSE BUILDER</p>
          <DialogTitle>Import a learning manual</DialogTitle>
          <DialogDescription>The importer extracts evidence from the document, marks uncertain fields, and applies only the sections you approve to a new unsaved draft.</DialogDescription>
        </DialogHeader>

        <nav className="manual-import-steps" aria-label="Manual import progress">
          {[{ id: "upload", number: 1, label: "Upload" }, { id: "review", number: 2, label: "Review proposal" }, { id: "applied", number: 3, label: "Apply to Studio" }].map((item) => {
            const order = { upload: 0, review: 1, applied: 2 };
            const complete = order[phase] > order[item.id as keyof typeof order];
            const active = phase === item.id;
            return <span key={item.id} className={`${complete ? "complete" : ""} ${active ? "active" : ""}`}><b>{complete ? <CheckCircle2 /> : item.number}</b>{item.label}</span>;
          })}
        </nav>

        {phase === "upload" && <div className="manual-upload-stage">
          <button
            type="button"
            className={`manual-drop-zone ${file ? "has-file" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files?.[0]); }}
          >
            <span>{file ? <FileSearch /> : <Upload />}</span>
            <b>{file?.name ?? "Choose or drop a learning manual"}</b>
            <small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB · ready to analyse` : "Searchable PDF, DOCX, TXT, Markdown, HTML or RTF · maximum 25 MB"}</small>
          </button>
          <input ref={inputRef} hidden type="file" accept=".pdf,.docx,.txt,.md,.html,.htm,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/html" onChange={(event) => chooseFile(event.target.files?.[0])} />
          <section className="manual-import-explanation"><AlertTriangle /><div><b>Before you import</b><p>Use a searchable document. A scanned PDF needs OCR first. The importer will not invent Colab notebooks, practical evidence, copyright permission or UCC approval.</p></div></section>
          {error && <p className="manual-import-error" role="alert"><AlertTriangle /> {error}</p>}
          <footer className="manual-import-footer"><button type="button" className="secondary-action" onClick={reset}>Clear</button><button type="button" className="dialog-primary" disabled={!file || analysing} onClick={() => void analyse()}>{analysing ? <LoaderCircle className="spin" /> : <WandSparkles />} {analysing ? "Reading and structuring…" : "Analyse manual"}</button></footer>
        </div>}

        {phase === "review" && proposal && <div className="manual-review-stage">
          <section className="manual-import-summary">
            <div><p className="eyebrow">PROPOSED COURSE</p><h3>{proposal.course.title}</h3><p>{proposal.course.code} · {proposal.course.discipline} · {proposal.source.wordCount.toLocaleString()} source words</p></div>
            <span><b>{proposal.coverageScore}%</b> extraction coverage</span>
            <Progress value={proposal.coverageScore} />
            <div className="manual-summary-counts"><span><b>{proposal.counts.outcomes}</b> outcomes</span><span><b>{proposal.counts.sections}</b> sections</span><span><b>{proposal.counts.learningBlocks}</b> blocks</span><span><b>{proposal.counts.questions}</b> questions</span></div>
          </section>

          <section className="manual-group-selector">
            <header><div><p className="eyebrow">CHOOSE WHAT TO APPLY</p><h3>Import groups</h3></div><small>Clear a group to keep that part of the current editor.</small></header>
            <div>{groups.map((group) => <label key={group.id} className={selection[group.id] ? "selected" : ""}><input type="checkbox" checked={selection[group.id]} onChange={(event) => setSelection((current) => ({ ...current, [group.id]: event.target.checked }))} /><span><b>{group.title}</b><small>{group.description}</small></span><CheckCircle2 /></label>)}</div>
          </section>

          <section className="manual-review-list">
            <header><div><p className="eyebrow">EVIDENCE REVIEW</p><h3>Check every extracted field</h3></div><div className="manual-status-key"><span className="confirmed">{proposal.counts.confirmed} found</span><span className="suggested">{proposal.counts.suggested} suggested</span><span className="needs_review">{proposal.counts.needsReview} review</span><span className="missing">{proposal.counts.missing} missing</span></div></header>
            {groups.map((group) => <details key={group.id} open={group.id === "blueprint" || proposal.reviews.some((item) => item.group === group.id && (item.status === "missing" || item.status === "needs_review"))}>
              <summary><span><b>{group.title}</b><small>{proposal.reviews.filter((item) => item.group === group.id).length} fields</small></span><ChevronDown /></summary>
              <div>{proposal.reviews.filter((item) => item.group === group.id).map((item) => <article key={item.id}>
                <header><div><b>{item.label}</b><p>{item.value}</p></div><span className={item.status}>{statusLabels[item.status]} · {Math.round(item.confidence * 100)}%</span></header>
                <p>{item.guidance}</p>
                {item.sourceExcerpt && <details><summary>Show source evidence <ChevronDown /></summary><blockquote>{item.sourceExcerpt}</blockquote></details>}
              </article>)}</div>
            </details>)}
          </section>

          <section className="manual-warning-list"><AlertTriangle /><div><b>Facilitator checks still required</b>{proposal.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></section>
          <label className={`manual-apply-confirmation ${confirmed ? "confirmed" : ""}`}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><b>I have reviewed the proposed fields</b><small>I understand that this creates a new unsaved draft and that suggested, missing and review-required items must be corrected before UCC submission.</small></span></label>
          {error && <p className="manual-import-error" role="alert"><AlertTriangle /> {error}</p>}
          <footer className="manual-import-footer"><button type="button" className="secondary-action" onClick={() => setPhase("upload")}>Replace manual</button><button type="button" className="dialog-primary" disabled={!confirmed || !Object.values(selection).some(Boolean)} onClick={apply}><CheckCircle2 /> Apply selected groups</button></footer>
        </div>}

        {phase === "applied" && proposal && <div className="manual-applied-stage">
          <span><CheckCircle2 /></span><h3>Course proposal applied</h3><p><b>{proposal.course.title}</b> is now in the Studio as an unsaved draft. Work through the six stages, resolve every amber or red check, preview as a student, then save.</p>
          <div><button type="button" className="secondary-action" onClick={reset}>Import another manual</button><button type="button" className="dialog-primary" onClick={() => setOpen(false)}>Continue in Course Studio</button></div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}

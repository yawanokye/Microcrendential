"use client";
import { useEffect, useRef, useState } from "react";
import { describeLabColumn, exportLabCsv, fitLabModel, investigateLabLogs, labKinds, ohmsLawTrial, parseLabCsv, readLabWork, type LabRecord, type LabWork, type LearningLab } from "@/lib/learning-labs";

export function downloadLabFile(name: string, body: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function LearningLabPlayer({ lab, value, onChange }: { lab: LearningLab; value: string; onChange: (value: string) => void }) {
  const work = readLabWork(lab, value), latest = useRef(work), frame = useRef<HTMLIFrameElement>(null);
  const update = useRef(onChange);
  useEffect(() => { latest.current = readLabWork(lab, value); update.current = onChange; }, [lab, value, onChange]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [ready, setReady] = useState(false), [runState, setRunState] = useState("");
  const [column, setColumn] = useState(lab.yColumn), [xColumn, setXColumn] = useState(lab.xColumn), [yColumn, setYColumn] = useState(lab.yColumn);
  const [threshold, setThreshold] = useState(3), [voltage, setVoltage] = useState(6), [resistance, setResistance] = useState(100);
  const pending = useRef<{ token: string; timeout: ReturnType<typeof setTimeout>; code: string; dataCsv: string; language: "python" | "javascript" } | null>(null);
  const change = (next: LabWork) => onChange(JSON.stringify(next));
  const saveRun = (operation: string, settings: Record<string, string | number>, result: unknown, dataCsv = latest.current.dataCsv) => {
    const datasetFingerprint = Array.from(dataCsv).reduce((hash, c) => Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261).toString(16);
    const next = { ...latest.current, dataCsv, runs: [...latest.current.runs, { at: new Date().toISOString(), operation, settings: { ...settings, datasetFingerprint }, result, ...(dataCsv.length <= 6000 ? { inputDataCsv: dataCsv } : {}) }].slice(-12) };
    const serialized = JSON.stringify(next);
    if (serialized.length > 115_000) throw new Error("The lab record is too large. Export it, then reset the run history or use a smaller dataset.");
    update.current(serialized); setError("");
  };
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!pending.current || event.source !== frame.current?.contentWindow || !["ucc-lab-result", "ucc-lab-progress"].includes(event.data?.type) || event.data.token !== pending.current.token) return;
      if (event.data.type === "ucc-lab-progress") { setRunState(String(event.data.message).slice(0, 200)); return; }
      const request = pending.current; pending.current = null; clearTimeout(request.timeout); setBusy(false);
      if (event.data.error) { setError(String(event.data.error).slice(0, 1000)); return; }
      try {
        const result = event.data.result;
        if (JSON.stringify(result).length > 24_000) throw new Error("The programme result is too large.");
        saveRun(request.language === "python" ? "Python programme" : "JavaScript programme", { code: request.code, dataset: "Dataset saved with this lab record" }, result, request.dataCsv);
      } catch (e) { setError(e instanceof Error ? e.message : "The result could not be recorded."); }
    };
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); if (pending.current) clearTimeout(pending.current.timeout); };
  // The listener reads current work through a ref, preserving edits after saved-draft recovery.
  }, []);
  const execute = (action: () => void) => { try { action(); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "The experiment could not run."); } };
  const runCode = () => execute(() => {
    if (!ready || !frame.current?.contentWindow) throw new Error("The isolated runner is still loading. Try again shortly.");
    const data = parseLabCsv(work.dataCsv), token = crypto.randomUUID();
    if (!work.code.trim()) throw new Error("Write a programme before running it.");
    setBusy(true); setRunState(lab.language === "python" ? "Loading Python, then running your programme" : "Running your programme");
    pending.current = { token, language: lab.language, code: work.code, dataCsv: work.dataCsv, timeout: setTimeout(() => { pending.current = null; setBusy(false); setError("The runner did not respond. Reload the lesson to restart it."); }, lab.language === "python" ? 75000 : 5000) };
    frame.current.contentWindow.postMessage({ type: "ucc-lab-run", token, language: lab.language, code: work.code, data: data.rows }, "*");
  });
  let data: { columns: string[]; rows: LabRecord[] } = { columns: [], rows: [] }, dataError = "";
  try { data = parseLabCsv(work.dataCsv); } catch (e) { dataError = e instanceof Error ? e.message : "Invalid data"; }
  const last = work.runs.at(-1), codeMode = ["coding", "data_science", "cybersecurity", "ai"].includes(lab.kind);
  return <section className="learning-lab" aria-label={`${labKinds[lab.kind] || "Working"} workspace`}>
    <header><div><p className="eyebrow">WORKING LEARNING LAB</p><h3>{labKinds[lab.kind]}</h3></div><span>Results and evidence are saved with your response</span></header>
    <p className="lab-task">{lab.task}</p>
    <p><b>Evidence to submit</b> {lab.expectedEvidence}</p>
    {codeMode && <iframe ref={frame} src="/api/learning-labs/runtime" title="Isolated programme runner" sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={() => setReady(true)} className="lab-runner-frame" />}
    <fieldset disabled={busy} className="lab-controls"><legend>Data and experiment controls</legend>
      <label>Working dataset CSV<textarea aria-label="Working dataset CSV" value={work.dataCsv} maxLength={60_000} rows={7} onChange={e => change({ ...work, dataCsv: e.target.value })} /></label>
      {lab.allowDataUpload && <label>Import a CSV dataset<input type="file" accept=".csv,text/csv" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 60_000) throw new Error("Use a CSV file no larger than 60 KB."); const csv = await file.text(); parseLabCsv(csv); change({ ...latest.current, dataCsv: csv }); setError(""); } catch (err) { setError(err instanceof Error ? err.message : "The file could not load."); } e.target.value = ""; }} /><small>Use only data you are authorised to use for this exercise.</small></label>}
      {dataError ? <p role="alert">{dataError}</p> : <><p>{data.rows.length} rows · {data.columns.length} columns</p><div className="lab-table-scroll" tabIndex={0}><table><caption>First 20 records in the current dataset</caption><thead><tr>{data.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{data.rows.slice(0, 20).map((row, i) => <tr key={i}>{data.columns.map(c => <td key={c}>{row[c]}</td>)}</tr>)}</tbody></table></div></>}
      {codeMode && <><label>{lab.language === "python" ? "Python programme" : "JavaScript programme"}<textarea className="lab-code" aria-label={lab.language === "python" ? "Python programme" : "JavaScript programme"} spellCheck={false} rows={10} maxLength={20_000} value={work.code} onChange={e => change({ ...work, code: e.target.value })} /></label><p>The <code>data</code> variable contains the dataset records. {lab.language === "python" ? <>Use <code>print()</code> for output and assign a JSON-compatible value to <code>result</code>. Python, NumPy and pandas run locally in your browser. The first run downloads the bundled runtime. Other packages, network calls, servers and GPU workloads use Colab or a specialist tool.</> : <>Use <code>console.log</code> and return a result. JavaScript runs without network access or installed packages.</>} The runner has no access to your account.</p><button type="button" disabled={!ready || Boolean(dataError)} onClick={runCode}>Run code</button></>}
      {lab.kind === "data_science" && <div className="lab-action-row"><label>Numeric column<select aria-label="Numeric column" value={column} onChange={e => setColumn(e.target.value)}>{data.columns.map(c => <option key={c}>{c}</option>)}</select></label><button type="button" disabled={Boolean(dataError)} onClick={() => execute(() => saveRun("Descriptive statistics", { column }, describeLabColumn(data.rows, column)))}>Calculate statistics</button></div>}
      {(lab.kind === "ai" || lab.kind === "experiment") && <div className="lab-action-row"><label>Input column X<select aria-label="Input column X" value={xColumn} onChange={e => setXColumn(e.target.value)}>{data.columns.map(c => <option key={c}>{c}</option>)}</select></label><label>Outcome column Y<select aria-label="Outcome column Y" value={yColumn} onChange={e => setYColumn(e.target.value)}>{data.columns.map(c => <option key={c}>{c}</option>)}</select></label><button type="button" disabled={Boolean(dataError)} onClick={() => execute(() => saveRun(lab.kind === "ai" ? "Train and evaluate regression" : "Fit observation trend", { xColumn, yColumn }, fitLabModel(data.rows, xColumn, yColumn, lab.kind === "ai")))}>{lab.kind === "ai" ? "Train and evaluate model" : "Fit observation trend"}</button><LabPlot rows={data.rows} xColumn={xColumn} yColumn={yColumn} /></div>}
      {lab.kind === "cybersecurity" && <div className="lab-action-row"><label>Failure threshold<input type="number" aria-label="Failure threshold" min={1} max={100} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></label><button type="button" disabled={Boolean(dataError)} onClick={() => execute(() => saveRun("Authentication rule investigation", { threshold }, investigateLabLogs(data.rows, threshold)))}>Run detection rule</button><p>This lab investigates supplied logs. Live hosts, shells and attack targets are provided only through separately configured specialist tools.</p></div>}
      {lab.kind === "experiment" && lab.experimentMode === "ohms_law" && <div className="lab-action-row"><label>Voltage V<input type="number" aria-label="Voltage V" min={0} max={24} step={0.5} value={voltage} onChange={e => setVoltage(Number(e.target.value))} /></label><label>Resistance Ω<input type="number" aria-label="Resistance Ω" min={10} max={1000} step={10} value={resistance} onChange={e => setResistance(Number(e.target.value))} /></label><button type="button" onClick={() => execute(() => { const trial = { ...ohmsLawTrial(voltage, resistance), trial: data.rows.length + 1 }; const csv = exportLabCsv(["trial", "voltage", "resistance", "current", "power"], [...data.rows, trial]); saveRun("Ideal resistor trial", { voltage, resistance }, trial, csv); })}>Record measurement</button><p>Ideal model, I = V / R and P = V² / R. Keep resistance fixed when estimating the current–voltage relationship. Record at least three observations.</p></div>}
    </fieldset>
    {busy && <div><p role="status">{runState}</p><button type="button" onClick={() => { if (pending.current) frame.current?.contentWindow?.postMessage({ type: "ucc-lab-cancel", token: pending.current.token }, "*"); }}>Stop run</button></div>}{error && <p className="lab-error" role="alert">{error}</p>}
    {last && <section className="lab-output"><h4>Latest result</h4><p>{last.operation}</p><pre aria-label="Lab output">{JSON.stringify(last.result, null, 2)}</pre></section>}
    <details className="lab-history"><summary>Run and experiment history, {work.runs.length} saved</summary>{work.runs.map((run, i) => <article key={`${run.at}-${i}`}><b>{i + 1}. {run.operation}</b><small>{run.at}</small><pre>{JSON.stringify(run, null, 2)}</pre></article>)}<button type="button" disabled={busy || !work.runs.length} onClick={() => change({ ...work, runs: [] })}>Clear run history</button></details>
    <label>Findings and limitations<textarea aria-label="Findings and limitations" value={work.reflection} rows={5} maxLength={8000} onChange={e => change({ ...work, reflection: e.target.value })} placeholder="Explain what you changed, what the results show, how you checked them and what remains uncertain. At least 40 characters." /></label>
    <div className="lab-action-row"><button type="button" onClick={() => downloadLabFile("learning-lab-data.csv", exportLabCsv(data.columns, data.rows), "text/csv") } disabled={Boolean(dataError)}>Download dataset</button><button type="button" onClick={() => downloadLabFile("learning-lab-record.json", JSON.stringify(work, null, 2))}>Export lab record</button>{lab.language === "python" && <button type="button" disabled={Boolean(dataError)} onClick={() => downloadLabFile("learning-lab.ipynb", JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { display_name: "Python 3", language: "python", name: "python3" } }, cells: [{ cell_type: "markdown", id: "task", metadata: {}, source: [lab.task, "\n\n", lab.expectedEvidence] }, { cell_type: "code", id: "programme", metadata: {}, execution_count: null, source: ["import json\n", "data = json.loads(" + JSON.stringify(JSON.stringify(data.rows)) + ")\n", work.code], outputs: [] }, { cell_type: "markdown", id: "reflection", metadata: {}, source: ["## Findings and limitations\n", work.reflection] }, { cell_type: "markdown", id: "history", metadata: {}, source: ["## Recorded run history\n```json\n", JSON.stringify(work.runs, null, 2), "\n```"] }] }, null, 2))}>Download Python notebook</button>}</div>
    <p className="lab-review-note">Submit the lab record using the activity button below. The facilitator reviews your code, data, results and explanation. Running a programme or recording a trial does not award a grade.</p>
  </section>;
}

function LabPlot({ rows, xColumn, yColumn }: { rows: LabRecord[]; xColumn: string; yColumn: string }) {
  const points = rows.filter(r => typeof r[xColumn] === "number" && typeof r[yColumn] === "number").map(r => ({ x: Number(r[xColumn]), y: Number(r[yColumn]) })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!points.length) return <p>No complete numeric observations to plot yet.</p>;
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  return <figure className="lab-plot"><svg viewBox="0 0 440 260" role="img" aria-label={`Scatter plot of ${yColumn} against ${xColumn}, ${points.length} observations. Values are also available in the dataset table.`}><path d="M55 20 V215 H420" fill="none" stroke="currentColor" /><text x="225" y="252" textAnchor="middle">{xColumn}</text><text x="10" y="15">{yColumn}</text><text x="55" y="234">{minX.toPrecision(3)}</text><text x="390" y="234">{maxX.toPrecision(3)}</text><text x="2" y="215">{minY.toPrecision(3)}</text><text x="2" y="35">{maxY.toPrecision(3)}</text>{points.map((p, i) => <circle key={i} cx={55 + (p.x - minX) / (maxX - minX || 1) * 345} cy={215 - (p.y - minY) / (maxY - minY || 1) * 180} r={4} fill="#128b83"><title>{xColumn}: {p.x}, {yColumn}: {p.y}</title></circle>)}</svg><figcaption>{points.length} observations. Edit the dataset to investigate another condition.</figcaption></figure>;
}

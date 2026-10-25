/** Working browser labs. Results are learner evidence, never a trusted grade. */
export const labKinds = {
  coding: "Coding",
  data_science: "Data science",
  ai: "AI and model experiments",
  cybersecurity: "Cybersecurity investigation",
  experiment: "Scientific experiment and measurements",
} as const;
export type LabKind = keyof typeof labKinds;
export type LabRecord = Record<string, string | number>;
export type LearningLab = {
  kind: LabKind;
  language: "javascript" | "python";
  task: string;
  expectedEvidence: string;
  dataCsv: string;
  starterCode: string;
  allowDataUpload: boolean;
  xColumn: string;
  yColumn: string;
  experimentMode: "measurements" | "ohms_law";
  reviewed: boolean;
};
export type LabRun = { at: string; operation: string; settings: Record<string, string | number>; result: unknown };
export type LabWork = {
  version: 1;
  kind: LabKind;
  language: "javascript" | "python";
  dataCsv: string;
  code: string;
  reflection: string;
  runs: LabRun[];
};
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};

export function normalizeLearningLab(value: unknown): LearningLab | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = record(value);
  return {
    kind: (Object.hasOwn(labKinds, String(v.kind)) ? v.kind : "") as LabKind,
    language: v.language === "python" ? "python" : "javascript",
    task: clip(v.task, 8000), expectedEvidence: clip(v.expectedEvidence, 4000),
    dataCsv: clip(v.dataCsv, 60_000), starterCode: clip(v.starterCode, 20_000),
    allowDataUpload: v.allowDataUpload === true,
    xColumn: clip(v.xColumn, 100), yColumn: clip(v.yColumn, 100),
    experimentMode: v.experimentMode === "ohms_law" ? "ohms_law" : "measurements",
    reviewed: v.reviewed === true,
  };
}

/** RFC-style quoted fields, including escaped quotes and embedded newlines. */
export function parseLabCsv(csv: string): { columns: string[]; rows: LabRecord[] } {
  if (typeof csv !== "string" || csv.length > 60_000) throw new Error("Use a CSV dataset no larger than 60,000 characters.");
  const table: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const pushField = () => { if (field.length > 4000) throw new Error("A data cell exceeds 4,000 characters."); row.push(field.trim()); field = ""; closed = false; };
  const pushRow = () => { pushField(); if (row.some(Boolean)) table.push(row); row = []; if (table.length > 1001) throw new Error("Use at most 1,000 data rows."); };
  const text = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') { quoted = false; closed = true; } else field += c; }
    else if (c === ',' || c === '\n' || c === '\r') { if (c === ',') pushField(); else { if (c === '\r' && text[i + 1] === '\n') i++; pushRow(); } }
    else if (c === '"' && !field && !closed) quoted = true;
    else if (closed && !/\s/.test(c)) throw new Error("Unexpected text after a quoted CSV field.");
    else if (!closed) field += c;
  }
  if (quoted) throw new Error("A quoted CSV field is unfinished.");
  if (field || row.length || closed) pushRow();
  const columns = table.shift() || [];
  if (!columns.length || columns.length > 24 || columns.some(c => !c || c.length > 100) || new Set(columns).size !== columns.length) throw new Error("Use 1–24 distinct column names, each no longer than 100 characters.");
  const numeric = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
  const rows = table.map(cells => {
    if (cells.length !== columns.length) throw new Error("Every CSV row must have the same number of fields as the header.");
    return Object.fromEntries(columns.map((c, i) => [c, numeric.test(cells[i]) && Number.isFinite(Number(cells[i])) ? Number(cells[i]) : cells[i]]));
  });
  return { columns, rows };
}
export function exportLabCsv(columns: string[], rows: LabRecord[]) {
  const cell = (v: unknown) => { let text = String(v ?? ""); if (/^[=+\-@\t\r]/.test(text) && !(text.trim() && Number.isFinite(Number(text)))) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
  return [columns, ...rows.map(r => columns.map(c => r[c] ?? ""))].map(r => r.map(cell).join(',')).join('\r\n');
}
export function describeLabColumn(rows: LabRecord[], column: string) {
  const values = rows.map(r => r[column]).filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!values.length) throw new Error("Choose a column containing numeric measurements.");
  if (values.some(v => Math.abs(v) > 1e100)) throw new Error("Rescale extremely large measurements before calculating statistics.");
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { column, count: values.length, missingOrNonNumeric: rows.length - values.length, mean, median: (values[Math.floor((values.length - 1) / 2)] + values[Math.ceil((values.length - 1) / 2)]) / 2, minimum: values[0], maximum: values.at(-1)!, sampleStandardDeviation: values.length > 1 ? Math.sqrt(values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (values.length - 1)) : null };
}
export function fitLabModel(rows: LabRecord[], xColumn: string, yColumn: string, holdout = true) {
  if (!xColumn || xColumn === yColumn) throw new Error("Select different input and outcome columns.");
  const points = rows.filter(r => typeof r[xColumn] === "number" && typeof r[yColumn] === "number").map(r => ({ x: Number(r[xColumn]), y: Number(r[yColumn]) })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (points.length < (holdout ? 8 : 3)) throw new Error(holdout ? "Use at least eight complete numeric rows for a training/test split." : "Record at least three complete numeric observations.");
  if (points.some(p => Math.abs(p.x) > 1e100 || Math.abs(p.y) > 1e100)) throw new Error("Rescale extremely large values before fitting a model.");
  const training = holdout ? points.filter((_, i) => i % 4 !== 0) : points;
  const testing = holdout ? points.filter((_, i) => i % 4 === 0) : points;
  const meanX = training.reduce((s, p) => s + p.x, 0) / training.length, meanY = training.reduce((s, p) => s + p.y, 0) / training.length;
  const denominator = training.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
  if (!denominator) throw new Error("The input column needs variation to fit a model.");
  const slope = training.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / denominator, intercept = meanY - slope * meanX;
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) throw new Error("Rescale the measurements before fitting this model.");
  const actualMean = testing.reduce((s, p) => s + p.y, 0) / testing.length;
  const squaredError = testing.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0), total = testing.reduce((s, p) => s + (p.y - actualMean) ** 2, 0);
  return { xColumn, yColumn, trainingRows: training.length, testRows: testing.length, split: holdout ? "Every fourth complete row held out for evaluation" : "Fit to all observations, no independent test set", slope, intercept, meanAbsoluteError: testing.reduce((s, p) => s + Math.abs(p.y - (intercept + slope * p.x)), 0) / testing.length, rootMeanSquaredError: Math.sqrt(squaredError / testing.length), rSquared: total ? 1 - squaredError / total : null, points: testing.map(p => ({ ...p, prediction: intercept + slope * p.x })) };
}
export function investigateLabLogs(rows: LabRecord[], threshold: number) {
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) throw new Error("Choose a failed-login threshold from 1 to 100.");
  if (!rows.every(r => "source" in r && "result" in r)) throw new Error("Log data needs source and result columns.");
  const sources = new Map<string, { source: string; failures: number; successes: number; successAfterThreshold: boolean }>();
  for (const row of rows) {
    const source = String(row.source), item = sources.get(source) || { source, failures: 0, successes: 0, successAfterThreshold: false };
    if (String(row.result).toLowerCase() === "failure") item.failures++;
    if (String(row.result).toLowerCase() === "success") { item.successes++; if (item.failures >= threshold) item.successAfterThreshold = true; }
    sources.set(source, item);
  }
  return { threshold, eventsExamined: rows.length, sources: [...sources.values()], alerts: [...sources.values()].filter(s => s.failures >= threshold), interpretation: "A threshold alert is a lead for investigation, not proof of a compromise. Event order follows the supplied dataset." };
}
export function ohmsLawTrial(voltage: number, resistance: number): LabRecord {
  if (!Number.isFinite(voltage) || voltage < 0 || voltage > 24 || !Number.isFinite(resistance) || resistance < 10 || resistance > 1000) throw new Error("Use voltage from 0–24 V and resistance from 10–1,000 Ω.");
  return { trial: 0, voltage, resistance, current: voltage / resistance, power: voltage * voltage / resistance };
}
export function learningLabIssues(lab: LearningLab) {
  const issues: string[] = [];
  if (!Object.hasOwn(labKinds, lab.kind)) issues.push("Choose a supported working lab.");
  if (lab.task.length < 30) issues.push("Explain the practical task in at least 30 characters.");
  if (lab.expectedEvidence.length < 20) issues.push("Describe the evidence learners must submit.");
  try { const data = parseLabCsv(lab.dataCsv); if (!data.rows.length && !(lab.kind === "experiment" && lab.experimentMode === "ohms_law")) issues.push("Supply at least one data row."); if (lab.kind === "ai" && (!data.columns.includes(lab.xColumn) || !data.columns.includes(lab.yColumn))) issues.push("Select valid model input and outcome columns."); }
  catch (e) { issues.push(e instanceof Error ? e.message : "The dataset is invalid."); }
  if (["coding", "data_science", "cybersecurity"].includes(lab.kind) && lab.starterCode.length < 10) issues.push("Provide editable starter code for the selected programming language.");
  return issues;
}
export function initialLabWork(lab: LearningLab): LabWork { return { version: 1, kind: lab.kind, language: lab.language, dataCsv: lab.dataCsv, code: lab.starterCode, reflection: "", runs: [] }; }
export function readLabWork(lab: LearningLab, value: string): LabWork {
  try { const v = JSON.parse(value); if (v.version !== 1 || v.kind !== lab.kind || v.language && v.language !== lab.language) return initialLabWork(lab); return { version: 1, kind: lab.kind, language: lab.language, dataCsv: typeof v.dataCsv === "string" ? v.dataCsv.slice(0, 60_000) : lab.dataCsv, code: typeof v.code === "string" ? v.code.slice(0, 20_000) : lab.starterCode, reflection: typeof v.reflection === "string" ? v.reflection.slice(0, 8000) : "", runs: Array.isArray(v.runs) ? v.runs.slice(-12) : [] }; } catch { return initialLabWork(lab); }
}
export function labSubmissionIssues(lab: LearningLab, value: unknown) {
  const v = record(value), issues: string[] = [];
  if (v.version !== 1 || v.kind !== lab.kind) issues.push("The lab evidence does not match this activity.");
  if (v.language && v.language !== lab.language) issues.push("Use the programming language configured for this lab.");
  if (typeof v.dataCsv !== "string") issues.push("Include the dataset used for the work."); else try { parseLabCsv(v.dataCsv); } catch (e) { issues.push(e instanceof Error ? e.message : "The dataset is invalid."); }
  if (typeof v.code !== "string" || v.code.length > 20_000) issues.push("The saved code is missing or too long.");
  if (typeof v.reflection !== "string" || v.reflection.trim().length < 40 || v.reflection.length > 8000) issues.push("Explain the findings and limitations in at least 40 characters.");
  if (!Array.isArray(v.runs) || !v.runs.length || v.runs.length > 12 || v.runs.some(r => { const run = record(r); return typeof run.at !== "string" || !Number.isFinite(Date.parse(run.at)) || typeof run.operation !== "string" || run.operation.length > 100 || !run.settings || typeof run.settings !== "object" || !("result" in run); })) issues.push("Run the lab and include its experiment history.");
  if (lab.kind === "experiment") try { if (parseLabCsv(String(v.dataCsv || "")).rows.length < 3) issues.push("Record at least three observations before submitting."); } catch { /* Already reported. */ }
  return issues;
}

export function learningLabTemplate(kind: LabKind) {
  const common = { language: "javascript" as const, allowDataUpload: false, reviewed: false, experimentMode: "measurements" as const, xColumn: "x", yColumn: "y" };
  const templates: Record<LabKind, { title: string; instructions: string; rubric: string; minutes: number; lab: LearningLab }> = {
    coding: { title: "Write, run and explain a working programme", instructions: "Use the coding workspace to implement the task, test a changed input and explain what the output demonstrates.", rubric: "Correct solution and reasoning: 40 marks. Meaningful test cases and edge cases: 30 marks. Clear code and documentation: 20 marks. Limitations and reflection: 10 marks.", minutes: 45, lab: { ...common, kind, task: "Calculate the total and average cost from the supplied records. Change an input, run the code again, and explain how you checked the result.", expectedEvidence: "Submit the edited code, data, run results and an explanation of the tests and limitations.", dataCsv: "item,cost\nBooks,120\nTransport,50\nMaterials,80", starterCode: "// data is an array of records from the dataset.\nconst total = data.reduce((sum, row) => sum + Number(row.cost), 0);\nconsole.log('Records examined:', data.length);\nreturn { total, average: total / data.length };" } },
    data_science: { title: "Investigate, clean and explain a dataset", instructions: "Inspect the data, explain quality issues, edit the dataset or code and compare the results of at least two investigations.", rubric: "Inspection and documented cleaning: 30 marks. Correct calculations and visualisation: 30 marks. Evidence-based interpretation: 25 marks. Reproducibility and limitations: 15 marks.", minutes: 60, lab: { ...common, kind, task: "Investigate the fictional service records. Identify a missing measurement and inconsistent categories. Summarise resolution times and justify a cleaning rule before comparing results.", expectedEvidence: "Submit the working dataset, code, summary statistics, run history and a justified interpretation.", dataCsv: "case_id,channel,minutes\nA01,Email,42\nA02,Chat,18\nA03,email,55\nA04,Phone,\nA05,Chat,15\nA06,Phone,71\nA07,Email,36\nA08,Chat,24", starterCode: "const numeric = data.filter(row => typeof row.minutes === 'number');\nconst mean = numeric.reduce((sum, row) => sum + row.minutes, 0) / numeric.length;\nreturn { rows: data.length, missing: data.length - numeric.length, mean };", xColumn: "case_id", yColumn: "minutes" } },
    ai: { title: "Train and evaluate a regression model", instructions: "Choose input and outcome columns, train the model, inspect independent test metrics, change the data and compare experiments. Explain what the model cannot establish.", rubric: "Appropriate data and variables: 25 marks. Correct experiment and test interpretation: 35 marks. Comparison and reproducible evidence: 25 marks. Limits, fairness and reflection: 15 marks.", minutes: 60, lab: { ...common, kind, task: "Fit a simple linear regression to this fictional dataset. Inspect held-out predictions, change one observation and compare the model coefficients and test error. Do not interpret correlation as causation.", expectedEvidence: "Submit the dataset, model settings, training/test metrics, comparison of experiments and limitations.", dataCsv: "study_hours,score\n1,31\n2,37\n3,39\n4,47\n5,48\n6,57\n7,59\n8,66\n9,67\n10,76\n11,78\n12,86", starterCode: "", xColumn: "study_hours", yColumn: "score" } },
    cybersecurity: { title: "Investigate authentication logs and tune a detection rule", instructions: "Analyse the supplied synthetic event records, change the alert threshold, inspect the flagged sources and explain false positives and the next evidence required.", rubric: "Accurate log analysis and detection logic: 35 marks. Threshold comparison and evidence: 30 marks. Incident reasoning and proportionate response: 25 marks. Documentation and limitations: 10 marks.", minutes: 60, lab: { ...common, kind, task: "Investigate these synthetic authentication events. Identify repeated failures and any later success. Compare two thresholds and explain why an alert alone does not prove an intrusion. This workspace analyses supplied records and does not connect to real targets.", expectedEvidence: "Submit the detection code or rule settings, alert results, data, comparison history and a reasoned incident assessment.", dataCsv: "time,source,result\n09:00,192.0.2.10,failure\n09:01,192.0.2.10,failure\n09:02,198.51.100.7,success\n09:03,192.0.2.10,failure\n09:04,192.0.2.10,success\n09:05,203.0.113.8,failure\n09:06,203.0.113.8,success", starterCode: "const failures = {};\nfor (const row of data) {\n  if (row.result === 'failure') failures[row.source] = (failures[row.source] || 0) + 1;\n}\nreturn { failures, alerts: Object.entries(failures).filter(([, count]) => count >= 3) };", xColumn: "source", yColumn: "result" } },
    experiment: { title: "Investigate Ohm’s law with repeated measurements", instructions: "Choose voltage and resistance, record at least three trials, keep one variable controlled when comparing a relationship, plot the observations and explain the model assumptions.", rubric: "Experiment design and controlled variables: 25 marks. Recorded observations and calculations: 30 marks. Plot and interpretation: 30 marks. Model assumptions and limitations: 15 marks.", minutes: 45, lab: { ...common, kind, task: "Investigate how current changes with voltage and resistance in an ideal resistor model. Choose your own inputs, record repeated trials and compare the observations with I = V / R. The ideal model excludes instrument error, temperature effects and component tolerances.", expectedEvidence: "Submit at least three observations, the plot, analysis history and an explanation of the controlled variables and model limitations.", dataCsv: "trial,voltage,resistance,current,power", starterCode: "", xColumn: "voltage", yColumn: "current", experimentMode: "ohms_law" } },
  };
  return structuredClone(templates[kind]);
}

export function labStarterCode(kind: LabKind, language: "python" | "javascript") {
  if (language === "javascript") return learningLabTemplate(kind).lab.starterCode || "const x = data.map(row => Number(Object.values(row)[0]));\nreturn { rows: data.length, inputMean: x.reduce((a,b) => a+b,0) / x.length };";
  const starters: Record<LabKind, string> = {
    coding: "# data is a list of records from the dataset.\ncosts = [float(row['cost']) for row in data]\nresult = {'total': sum(costs), 'average': sum(costs) / len(costs)}\nprint('Records examined:', len(data))",
    data_science: "import pandas as pd\nimport numpy as np\ndf = pd.DataFrame(data)\ndf['minutes'] = pd.to_numeric(df['minutes'], errors='coerce')\nresult = {'rows': len(df), 'missing': int(df['minutes'].isna().sum()), 'mean': float(np.nanmean(df['minutes']))}\nprint(df.describe().to_string())",
    ai: "import numpy as np\npoints = np.array([[float(row['study_hours']), float(row['score'])] for row in data])\nmask = np.arange(len(points)) % 4 != 0\ntrain, test = points[mask], points[~mask]\nslope, intercept = np.polyfit(train[:, 0], train[:, 1], 1)\npredictions = slope * test[:, 0] + intercept\nresult = {'slope': float(slope), 'intercept': float(intercept), 'test_rmse': float(np.sqrt(np.mean((test[:, 1] - predictions) ** 2)))}",
    cybersecurity: "from collections import Counter\nfailures = Counter(row['source'] for row in data if row['result'] == 'failure')\nthreshold = 3\nresult = {'failures': dict(failures), 'alerts': [source for source, count in failures.items() if count >= threshold]}\nprint('Events investigated:', len(data))",
    experiment: "import statistics\nvalues = [float(row['measurement']) for row in data]\nresult = {'count': len(values), 'mean': statistics.mean(values), 'sample_sd': statistics.stdev(values)}",
  };
  return starters[kind];
}

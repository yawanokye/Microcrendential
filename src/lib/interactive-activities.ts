/** Native formative practice. Answer keys are retained on the server. */
export type InteractiveKind = "knowledge_check" | "matching" | "sequencing" | "flashcards" | "scenario";
export type InteractiveItem = { id: string; prompt: string; choices: string[]; answer?: string; explanation?: string };
export type InteractiveActivity = { kind: InteractiveKind; items: InteractiveItem[]; order?: string[] };
export type InteractiveResponse = { selections?: Record<string, string>; order?: string[]; reviewed?: string[] };
export const interactiveLabels: Record<InteractiveKind, string> = { knowledge_check: "Knowledge check", matching: "Matching", sequencing: "Sequencing", flashcards: "Flashcards", scenario: "Decision scenario" };
const text = (v: unknown, max = 1500) => String(v ?? "").trim().slice(0, max);
const array = (v: unknown) => Array.isArray(v) ? v : [];
export function normalizeInteractive(value: unknown): InteractiveActivity | undefined {
  if (!value || typeof value !== "object") return;
  const input = value as Partial<InteractiveActivity>;
  if (!Object.keys(interactiveLabels).includes(String(input.kind))) return;
  const items = array(input.items).slice(0, 16).map((raw, i) => {
    const item = raw && typeof raw === "object" ? raw as InteractiveItem : {} as InteractiveItem;
    return { id: text(item.id, 80) || `item-${i + 1}`, prompt: text(item.prompt), choices: array(item.choices).map(v => text(v, 600)).filter(Boolean).slice(0, 8), answer: text(item.answer, 2000), explanation: text(item.explanation, 2000) };
  });
  return { kind: input.kind!, items, ...(input.kind === "sequencing" ? { order: array(input.order).map(v => text(v, 80)).slice(0, 16) } : {}) };
}
export function interactiveIssues(value: unknown): string[] {
  const a = normalizeInteractive(value);
  if (!a) return ["Choose a supported interactive format."];
  const issues: string[] = [];
  const raw=value as Partial<InteractiveActivity>;
  if(Array.isArray(raw.items)&&raw.items.length>16)issues.push("Use no more than sixteen items per activity.");
  if(Array.isArray(raw.items)&&raw.items.some(i=>Array.isArray(i.choices)&&i.choices.length>8))issues.push("Use no more than eight choices per item.");
  if (a.items.length < 2) issues.push("Provide at least two items.");
  if (new Set(a.items.map(i => i.id)).size !== a.items.length) issues.push("Item identifiers must be unique.");
  if (a.items.some(i => !i.prompt.trim())) issues.push("Every item needs a prompt.");
  if (["knowledge_check", "scenario"].includes(a.kind) && a.items.some(i => i.choices.length < 2 || new Set(i.choices).size !== i.choices.length || !i.choices.includes(i.answer ?? ""))) issues.push("Each question needs distinct choices and an answer that matches one choice exactly.");
  if (["matching", "flashcards"].includes(a.kind) && a.items.some(i => !i.answer?.trim())) issues.push("Each pair or card needs an answer.");
  if (a.kind === "matching" && new Set(a.items.map(i => i.answer)).size !== a.items.length) issues.push("Matching answers must be distinct.");
  if (a.kind === "sequencing" && (a.order?.length !== a.items.length || new Set(a.order).size !== a.items.length || a.order.some(id => !a.items.some(i => i.id === id)))) issues.push("The answer order must contain every item exactly once.");
  if (a.kind !== "sequencing" && a.items.some(i => !i.explanation?.trim())) issues.push("Add feedback explaining every answer.");
  return issues;
}
export function learnerInteractive(a: InteractiveActivity): InteractiveActivity {
  // Authoring stores steps in their correct order. Do not expose that array order.
  const items = a.kind === "sequencing" ? [...a.items].sort((x, y) => x.prompt.localeCompare(y.prompt) || x.id.localeCompare(y.id)) : a.items;
  return { kind: a.kind, items: items.map(i => ({ id: i.id, prompt: i.prompt, choices: a.kind === "matching" ? a.items.map(p => p.answer!).sort() : i.choices, ...(a.kind === "flashcards" ? { answer: i.answer, explanation: i.explanation } : {}) })) };
}
export function gradeInteractive(a: InteractiveActivity, response: unknown, maximum: number) {
  const issues = interactiveIssues(a);
  if (issues.length) throw new Error(issues.join(" "));
  if (!response || typeof response !== "object" || Array.isArray(response)) throw new Error("Submit a structured activity response.");
  const r = response as InteractiveResponse;
  let correct = 0;
  const criteria = a.items.map((item, index) => {
    const passed = a.kind === "sequencing" ? Array.isArray(r.order) && r.order.length === a.items.length && new Set(r.order).size === a.items.length && r.order[index] === a.order![index]
      : a.kind === "flashcards" ? Array.isArray(r.reviewed) && r.reviewed.includes(item.id)
      : r.selections?.[item.id] === item.answer;
    if (passed) correct++;
    return { criterion: a.kind === "sequencing" ? `Position ${index + 1}` : item.prompt, score: passed ? 1 : 0, maximum: 1, feedback: a.kind === "sequencing" ? (passed ? "Correct position." : "Review the order of the process.") : item.explanation || (passed ? "Reviewed." : "Review this item.") };
  });
  const mark = Math.round(maximum * correct / a.items.length * 100) / 100;
  return { mark, feedback: `${correct} of ${a.items.length} ${a.kind === "flashcards" ? "cards reviewed" : "items correct"}. ${correct === a.items.length ? "Practice completed." : "Review the feedback before another attempt."}`, criteria };
}

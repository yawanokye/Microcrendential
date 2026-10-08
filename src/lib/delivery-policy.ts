export type DeliveryPolicy = {
  identityRequired: "before_award" | "before_learning";
  markingMode: "automatic" | "human" | "assisted";
  attendancePercent: number;
  requiredPracticalIds: string[];
  assessmentDueAt: string;
  feedbackDays: number;
  refundDays: number;
  refundPolicy: string;
};
export const defaultDeliveryPolicy = (): DeliveryPolicy => ({ identityRequired: "before_award", markingMode: "automatic", attendancePercent: 80, requiredPracticalIds: [], assessmentDueAt: "", feedbackDays: 7, refundDays: 14, refundPolicy: "Refund requests are reviewed by UCC under the published course terms. Submitting a request does not approve a refund." });
export function normalizeDeliveryPolicy(value: unknown): DeliveryPolicy {
  const input = value && typeof value === "object" ? value as Partial<DeliveryPolicy> : {};
  const fallback = defaultDeliveryPolicy();
  const due = String(input.assessmentDueAt || "");
  return { identityRequired: input.identityRequired === "before_learning" ? "before_learning" : "before_award", markingMode: input.markingMode === "human" || input.markingMode === "assisted" ? input.markingMode : "automatic", attendancePercent: Math.min(100, Math.max(0, Number(input.attendancePercent ?? 80))), requiredPracticalIds: Array.isArray(input.requiredPracticalIds) ? input.requiredPracticalIds.map(String).slice(0,100) : [], assessmentDueAt: due && Number.isFinite(Date.parse(due)) ? new Date(due).toISOString() : "", feedbackDays: Math.min(60, Math.max(1, Number(input.feedbackDays) || 7)), refundDays: Math.min(90, Math.max(0, Number(input.refundDays ?? 14))), refundPolicy: String(input.refundPolicy || fallback.refundPolicy).trim().slice(0,2000) };
}
export function assessmentRequired(awardType: string) { return !["attendance", "cpd_participation"].includes(awardType); }

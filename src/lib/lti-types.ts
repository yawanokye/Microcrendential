export type ExternalActivity = { toolId: string; launchUrl: string; custom: Record<string, string> };
export const ltiClaim = "https://purl.imsglobal.org/spec/lti/claim/";
export const ltiDlClaim = "https://purl.imsglobal.org/spec/lti-dl/claim/";
export const ltiAgsClaim = "https://purl.imsglobal.org/spec/lti-ags/claim/";
export const ltiScopes = {
  score: "https://purl.imsglobal.org/spec/lti-ags/scope/score",
  lineitems: "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly",
  results: "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
};
export function normalizeExternalActivity(value: unknown): ExternalActivity | undefined {
  if (!value || typeof value !== "object") return;
  const input = value as Partial<ExternalActivity>;
  const custom: Record<string, string> = {};
  if (input.custom && typeof input.custom === "object") for (const [key, v] of Object.entries(input.custom).slice(0, 20)) {
    if (/^[a-zA-Z0-9_.-]{1,80}$/.test(key)) custom[key] = String(v).slice(0, 3000);
  }
  return { toolId: String(input.toolId || "").slice(0, 100), launchUrl: String(input.launchUrl || "").trim().slice(0, 3000), custom };
}
export function externalActivityIssues(value: unknown) {
  const activity = normalizeExternalActivity(value);
  if (!activity?.toolId) return ["Choose a registered external learning tool."];
  try { const url = new URL(activity.launchUrl); if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error(); }
  catch { return ["Use the tool's complete HTTPS activity launch URL."]; }
  return [];
}

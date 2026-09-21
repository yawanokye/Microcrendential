import type { Instrumentation } from "next";

export async function register() {}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Unhandled request error", { message, routePath: request.path, method: request.method, routerKind: context.routerKind });
  const webhook = process.env.MONITORING_WEBHOOK_URL?.trim();
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: "ucc-growthplus", event: "request_error", message: message.slice(0, 500), routePath: request.path, method: request.method, routerKind: context.routerKind, occurredAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (reportingError) { console.error("Monitoring webhook failed", reportingError); }
};

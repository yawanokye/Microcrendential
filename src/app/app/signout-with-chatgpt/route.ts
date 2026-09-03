import { NextResponse } from "next/server";
import { safeRelativeReturnPath, SESSION_COOKIE } from "@/app/chatgpt-auth";

export async function GET(request: Request) {
  const returnTo = safeRelativeReturnPath(new URL(request.url).searchParams.get("return_to") ?? "/");
  // Keep the Location header relative. Render's internal request URL uses
  // 0.0.0.0:10000, which must never be exposed to the learner's browser.
  const response = new NextResponse(null, { status: 303, headers: { location: returnTo } });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

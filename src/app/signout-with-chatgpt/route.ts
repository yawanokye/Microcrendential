import { NextResponse } from "next/server";
import { safeRelativeReturnPath, SESSION_COOKIE } from "@/app/chatgpt-auth";

export async function GET(request: Request) {
  const returnTo = safeRelativeReturnPath(new URL(request.url).searchParams.get("return_to") ?? "/");
  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

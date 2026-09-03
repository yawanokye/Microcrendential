import { redirect } from "next/navigation";
import { safeRelativeReturnPath } from "@/app/chatgpt-auth";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const parameters = await searchParams;
  const returnTo = safeRelativeReturnPath(parameters.return_to ?? "/");
  const url = new URL(returnTo, "https://app.local");
  const value = url.searchParams.get("portal");
  const portal = value === "admin" || value === "facilitator" || value === "learner" ? value : "learner";
  const invite = url.searchParams.get("invite") ?? "";
  if (portal === "admin") redirect("/admin-signin");
  if (portal === "facilitator") redirect(invite ? `/facilitator-signin?invite=${encodeURIComponent(invite)}` : "/facilitator-signin");
  redirect("/student-signin");
}

import AuthForm from "./auth-form";
import { safeRelativeReturnPath } from "@/app/chatgpt-auth";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const parameters = await searchParams;
  return <AuthForm returnTo={safeRelativeReturnPath(parameters.return_to ?? "/")} />;
}

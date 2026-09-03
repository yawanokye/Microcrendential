import AuthForm from "@/app/signin-with-chatgpt/auth-form";

export default async function FacilitatorSignInPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite = "" } = await searchParams;
  const returnTo = invite ? `/?portal=facilitator&invite=${encodeURIComponent(invite)}` : "/?portal=facilitator";
  return <AuthForm portal="facilitator" returnTo={returnTo} inviteToken={invite} />;
}

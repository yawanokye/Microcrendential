import AuthForm from "@/app/signin-with-chatgpt/auth-form";

export default async function FacilitatorSignInPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite = "" } = await searchParams;
  const returnTo = invite ? `/facilitator-studio?invite=${encodeURIComponent(invite)}` : "/facilitator-studio";
  return <AuthForm portal="facilitator" returnTo={returnTo} inviteToken={invite} />;
}

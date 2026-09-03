import AuthForm from "@/app/signin-with-chatgpt/auth-form";

export default function StudentSignInPage() {
  return <AuthForm portal="learner" returnTo="/?portal=learner" />;
}

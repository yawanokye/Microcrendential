import AuthForm from "@/app/signin-with-chatgpt/auth-form";

export default function AdminSignInPage() {
  return <AuthForm portal="admin" returnTo="/?portal=admin" />;
}

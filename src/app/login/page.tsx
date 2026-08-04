import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login/login-form";
import { getCurrentSession, getCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session.role && session.mobile) {
    const user = await getCurrentUser(session.role);
    if (user) {
      redirect(roleHome[session.role]);
    }
  }

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

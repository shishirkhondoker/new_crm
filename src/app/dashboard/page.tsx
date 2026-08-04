import { redirect } from "next/navigation";
import { getCurrentSession, getCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session.role || !session.mobile) {
    redirect("/login");
  }

  const user = await getCurrentUser(session.role);
  if (!user) {
    redirect("/login");
  }

  redirect(roleHome[session.role]);
}


import { redirect } from "next/navigation";
import { getCurrentSession, getCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (session.role && session.mobile) {
    const user = await getCurrentUser(session.role);
    if (user) {
      redirect(roleHome[session.role]);
    }
  }

  redirect("/login");
}

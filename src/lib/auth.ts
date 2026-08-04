import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { roleHome, type Role, type ShellUser } from "@/lib/utils";

const roles: Role[] = ["ADMIN", "SUPERVISOR", "MARKETER"];

function isRole(value: string | undefined): value is Role {
  return !!value && roles.includes(value as Role);
}

export function toShellUser(user: {
  id: string;
  name: string;
  email?: string | null;
  mobile?: string | null;
  role: Role;
  designation?: string | null;
  avatar?: string | null;
}): ShellUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile ?? undefined,
    role: user.role,
    designation: user.designation,
    avatar: user.avatar,
  };
}

export async function getCurrentSession() {
  const store = await cookies();
  const role = store.get("crm_role")?.value;
  const mobile = store.get("crm_mobile")?.value;

  return {
    role: isRole(role) ? role : undefined,
    mobile,
  };
}

export async function getCurrentUser(preferredRole?: Role): Promise<ShellUser | null> {
  const session = await getCurrentSession();
  const role = preferredRole ?? session.role;

  if (!session.mobile) return null;

  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: {
      mobile: session.mobile,
      ...(role ? { role } : {}),
      status: "ACTIVE",
    },
  });

  if (!user) return null;
  return toShellUser(user);
}

export async function requireCurrentUser(role: Role) {
  const session = await getCurrentSession();

  if (session.role && session.role !== role) {
    redirect(roleHome[session.role]);
  }

  const user = await getCurrentUser(role);
  if (!user) redirect("/login");
  return user;
}

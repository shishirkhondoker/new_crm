import { getCurrentSession } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import type { Role } from "@/lib/utils";

export async function getRequestUser() {
  const session = await getCurrentSession();
  if (!session.mobile || !session.role) return null;

  const prisma = getPrisma();
  return prisma.user.findFirst({
    where: {
      mobile: session.mobile,
      role: session.role,
      status: "ACTIVE",
    },
    select: {
      id: true,
      role: true,
      name: true,
      mobile: true,
    },
  });
}

export async function requireRequestUser(allowedRoles?: Role[]) {
  const user = await getRequestUser();
  if (!user) return { ok: false as const, status: 401, message: "Unauthorized" };
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { ok: false as const, status: 403, message: "You are not allowed to perform this action." };
  }

  return { ok: true as const, user };
}

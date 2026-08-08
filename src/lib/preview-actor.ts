import "server-only";

import { getPrisma } from "@/lib/prisma";
import { getMarketerScopeUserIds } from "@/lib/customer-ownership";
import type { Role } from "@/lib/utils";

export type PreviewCapableActor = {
  id: string;
  role: Role;
  name?: string;
};

/**
 * Lets ADMIN/SUPERVISOR viewers of the read-only marketer preview scope
 * generic list endpoints (leads/customers/tasks) to the marketer being
 * previewed instead of themselves. Any invalid or unauthorized use of
 * `previewMarketerId` silently falls back to the real caller — no error,
 * no behavior change for the many existing callers that never pass it.
 */
export async function resolvePreviewActor(
  authUser: PreviewCapableActor,
  previewMarketerId: string | null | undefined,
): Promise<PreviewCapableActor> {
  if (!previewMarketerId) return authUser;
  if (authUser.role !== "ADMIN" && authUser.role !== "SUPERVISOR") return authUser;

  const prisma = getPrisma();

  if (authUser.role === "SUPERVISOR") {
    const scopeIds = await getMarketerScopeUserIds(prisma, { id: authUser.id, role: authUser.role });
    if (scopeIds && !scopeIds.includes(previewMarketerId)) return authUser;
  }

  const marketer = await prisma.user.findUnique({
    where: { id: previewMarketerId },
    select: { id: true, name: true, role: true, status: true },
  });

  if (!marketer || marketer.role !== "MARKETER" || marketer.status !== "ACTIVE") return authUser;

  return { id: marketer.id, role: "MARKETER", name: marketer.name };
}

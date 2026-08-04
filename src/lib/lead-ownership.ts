import "server-only";

import { getPrisma } from "@/lib/prisma";
import { getMarketerScopeUserIds, resolveScopedMarketerOwnerId, type MarketerScopedActor } from "@/lib/customer-ownership";

export type LeadScopeActor = MarketerScopedActor;

export async function getScopedLeadUserIds(
  prisma: ReturnType<typeof getPrisma>,
  actor?: LeadScopeActor,
) {
  if (!actor) return undefined;
  return getMarketerScopeUserIds(prisma, actor);
}

export async function resolveLeadOwnerId(
  prisma: ReturnType<typeof getPrisma>,
  actor: LeadScopeActor,
  requestedAssignedToId?: string | null,
) {
  return resolveScopedMarketerOwnerId(prisma, actor, requestedAssignedToId, {
    requireSelectionForElevated: actor.role !== "MARKETER",
    allowSupervisorSelfFallback: true,
    adminMissingSelectionMessage: "Select a marketer for this lead.",
    supervisorMissingSelectionMessage: "Select a marketer for this lead.",
    adminInvalidSelectionMessage: "Selected marketer was not found.",
    supervisorInvalidSelectionMessage: "Selected marketer was not found.",
  });
}

export async function buildLeadScopeWhere(
  prisma: ReturnType<typeof getPrisma>,
  actor?: LeadScopeActor,
  filters?: {
    leadId?: string;
    assignedToId?: string;
    search?: string;
    status?: string;
    priority?: string;
  },
) {
  const scopedUserIds = await getScopedLeadUserIds(prisma, actor);
  const conditions: Record<string, unknown>[] = [];

  if (scopedUserIds) {
    conditions.push({
      OR: [
        { assignedToId: { in: scopedUserIds } },
        {
          AND: [
            { assignedToId: null },
            { createdById: { in: scopedUserIds } },
          ],
        },
      ],
    });
  }

  if (filters?.leadId?.trim()) {
    conditions.push({ id: filters.leadId.trim() });
  }

  if (filters?.assignedToId?.trim() && filters.assignedToId !== "all") {
    const assignedToId = filters.assignedToId.trim();
    if (!scopedUserIds || scopedUserIds.includes(assignedToId)) {
      conditions.push({ assignedToId });
    } else {
      conditions.push({ id: "__forbidden__" });
    }
  }

  const search = filters?.search?.trim();
  if (search) {
    conditions.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { company: { name: { contains: search, mode: "insensitive" } } },
        { interestedProduct: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  if (filters?.status && filters.status !== "all") {
    conditions.push({ status: filters.status });
  }

  if (filters?.priority && filters.priority !== "all") {
    conditions.push({ priority: filters.priority });
  }

  return conditions.length ? { AND: conditions } : {};
}

export async function hasLeadAccess(
  prisma: ReturnType<typeof getPrisma>,
  actor: LeadScopeActor,
  leadId: string,
) {
  const record = await prisma.lead.findFirst({
    where: await buildLeadScopeWhere(prisma, actor, { leadId }),
    select: { id: true },
  });

  return Boolean(record);
}

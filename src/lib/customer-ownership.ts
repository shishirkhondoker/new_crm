import "server-only";

import { getPrisma } from "@/lib/prisma";
import type * as Prisma from "@prisma/client";
import type { Role } from "@/lib/utils";

export type CustomerOwnerActor = {
  id: string;
  role: Role;
};

export type MarketerScopedActor = CustomerOwnerActor;

async function getSupervisorFallbackMarketers(
  prisma: ReturnType<typeof getPrisma>,
) {
  return prisma.user.findMany({
    where: {
      role: "MARKETER",
      status: "ACTIVE",
      supervisorId: null,
      supervisorAssignmentsAsMarketer: { none: {} },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

async function getAllActiveMarketers(
  prisma: ReturnType<typeof getPrisma>,
) {
  return prisma.user.findMany({
    where: {
      role: "MARKETER",
      status: "ACTIVE",
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

async function getSupervisorAssignedMarketers(
  prisma: ReturnType<typeof getPrisma>,
  supervisorId: string,
) {
  return prisma.user.findMany({
    where: {
      role: "MARKETER",
      status: "ACTIVE",
      OR: [
        { supervisorId },
        { supervisorAssignmentsAsMarketer: { some: { supervisorId } } },
      ],
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function getSupervisorsForMarketer(
  prisma: ReturnType<typeof getPrisma>,
  marketerId: string,
) {
  const marketer = await prisma.user.findUnique({
    where: { id: marketerId },
    select: {
      supervisorId: true,
      supervisorAssignmentsAsMarketer: { select: { supervisorId: true } },
    },
  });

  if (!marketer) return [];

  const supervisorIds = new Set<string>();
  if (marketer.supervisorId) supervisorIds.add(marketer.supervisorId);
  for (const assignment of marketer.supervisorAssignmentsAsMarketer) {
    supervisorIds.add(assignment.supervisorId);
  }

  return Array.from(supervisorIds);
}

export async function getMarketerScopeUserIds(
  prisma: ReturnType<typeof getPrisma>,
  actor: MarketerScopedActor,
) {
  if (actor.role === "ADMIN") return undefined;
  if (actor.role === "MARKETER") return [actor.id];

  const marketers = await getSupervisorAssignedMarketers(prisma, actor.id);
  return [actor.id, ...marketers.map((member) => member.id)];
}

export async function getAssignableMarketerOwners(
  prisma: ReturnType<typeof getPrisma>,
  actor: MarketerScopedActor,
  options?: {
    allowSupervisorSelfFallback?: boolean;
  },
) {
  if (actor.role === "MARKETER") {
    const self = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, name: true, role: true },
    });
    return self ? [self] : [];
  }

  if (actor.role === "SUPERVISOR") {
    const marketers = await getSupervisorAssignedMarketers(prisma, actor.id);
    if (marketers.length) return marketers;

    const fallbackMarketers = await getSupervisorFallbackMarketers(prisma);
    if (fallbackMarketers.length) return fallbackMarketers;

    if (options?.allowSupervisorSelfFallback) {
      const self = await prisma.user.findUnique({
        where: { id: actor.id },
        select: { id: true, name: true, role: true },
      });
      return self ? [self] : [];
    }

    return [];
  }

  return prisma.user.findMany({
    where: {
      role: "MARKETER",
      status: "ACTIVE",
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function resolveScopedMarketerOwnerId(
  prisma: ReturnType<typeof getPrisma>,
  actor: MarketerScopedActor,
  requestedAssignedToId?: string | null,
  options?: {
    requireSelectionForElevated?: boolean;
    allowSupervisorSelfFallback?: boolean;
    adminMissingSelectionMessage?: string;
    supervisorMissingSelectionMessage?: string;
    adminInvalidSelectionMessage?: string;
    supervisorInvalidSelectionMessage?: string;
  },
) {
  const requestedId = requestedAssignedToId?.trim() || "";
  if (actor.role === "MARKETER") {
    return actor.id;
  }

  const requireSelection = options?.requireSelectionForElevated ?? true;
  const assignableOwners = await getAssignableMarketerOwners(prisma, actor, {
    allowSupervisorSelfFallback: options?.allowSupervisorSelfFallback,
  });

  if (!requestedId) {
    if (actor.role === "SUPERVISOR" && assignableOwners.length === 1 && assignableOwners[0]?.id === actor.id) {
      return actor.id;
    }

    if (requireSelection) {
      throw new Error(
        actor.role === "ADMIN"
          ? options?.adminMissingSelectionMessage ?? "Select a marketer."
          : options?.supervisorMissingSelectionMessage ?? "Select a marketer.",
      );
    }

    return undefined;
  }

  const matchedOwner = assignableOwners.find((owner) => owner.id === requestedId);
  if (!matchedOwner) {
    throw new Error(
      actor.role === "ADMIN"
        ? options?.adminInvalidSelectionMessage ?? "Selected marketer was not found."
        : options?.supervisorInvalidSelectionMessage ?? "Selected marketer was not found.",
    );
  }

  return matchedOwner.id;
}

export async function getCustomerScopeUserIds(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
) {
  return getMarketerScopeUserIds(prisma, actor);
}

export async function getCustomerAssignableOwners(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
) {
  return getAssignableMarketerOwners(prisma, actor, {
    allowSupervisorSelfFallback: true,
  });
}

export async function resolveCustomerOwnerId(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
  requestedAssignedToId?: string | null,
  options?: {
    requireSelectionForElevated?: boolean;
  },
) {
  return resolveScopedMarketerOwnerId(prisma, actor, requestedAssignedToId, {
    requireSelectionForElevated: options?.requireSelectionForElevated,
    allowSupervisorSelfFallback: true,
    adminMissingSelectionMessage: "Select a marketer for this customer.",
    supervisorMissingSelectionMessage: "Select a marketer for this customer.",
    adminInvalidSelectionMessage: "Selected marketer was not found.",
    supervisorInvalidSelectionMessage: "Selected marketer was not found.",
  });
}

export async function buildCustomerScopeWhere(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
  filters?: {
    search?: string;
    city?: string;
    industry?: string;
    assignedToId?: string;
    customerId?: string;
    /**
     * Only browse/list views should set this. Leaving it unset means "don't
     * filter by parked status at all" — required so a direct customerId
     * lookup, task/follow-up creation, or the un-park action can still reach
     * a parked customer even though it's hidden from the main list.
     */
    parkedView?: "exclude" | "only";
  },
) {
  const scopeIds = await getMarketerScopeUserIds(prisma, actor);
  const conditions: Prisma.Prisma.CustomerCompanyWhereInput[] = [];

  if (filters?.parkedView === "exclude") {
    conditions.push({ isParked: false });
  } else if (filters?.parkedView === "only") {
    conditions.push({ isParked: true });
  }

  const normalizeSearchKeyword = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const buildInsensitiveContains = (value: string) => ({ contains: value, mode: "insensitive" as const });

  if (scopeIds) {
    conditions.push({ assignedToId: { in: scopeIds } });
  }

  if (filters?.customerId?.trim()) {
    conditions.push({ id: filters.customerId.trim() });
  }

  if (filters?.assignedToId?.trim() && filters.assignedToId !== "all") {
    const assignedToId = filters.assignedToId.trim();
    if (!scopeIds || scopeIds.includes(assignedToId)) {
      conditions.push({ assignedToId });
    } else {
      conditions.push({ id: "__forbidden__" });
    }
  }

  if (filters?.search?.trim()) {
    const search = filters.search.trim();
    const normalizedSearch = normalizeSearchKeyword(search);
    const normalizedPhoneSearch = search.replace(/\D+/g, "");
    const isCallSearch = /\b(call|phone|dial|calling)\b/.test(normalizedSearch);
    const isFollowUpSearch = /\bfollow[\s-]?up\b|\bfollowup\b/.test(normalizedSearch);
    const isQuotationSearch = /\b(quotation|quote|quatation)\b/.test(normalizedSearch);
    const isDemoSearch = /\bdemo\b/.test(normalizedSearch);
    const isWonSearch = /\b(win|won|sale won|converted)\b/.test(normalizedSearch);
    const isLostSearch = /\b(lost|lose|failed|rejected)\b/.test(normalizedSearch);
    const basicText = buildInsensitiveContains(search);

    conditions.push({
      OR: [
        { name: basicText },
        { contactPerson: basicText },
        { phone: basicText },
        { phone2: basicText },
        { city: basicText },
        { industry: basicText },
        { address: basicText },
        { website: basicText },
        { notes: basicText },
        {
          contacts: {
            some: {
              OR: [
                { name: basicText },
                { designation: basicText },
                { email: basicText },
                { mobile: basicText },
                { whatsapp: basicText },
              ],
            },
          },
        },
        {
          phoneNumbers: {
            some: {
              OR: [
                { label: basicText },
                { number: basicText },
              ],
            },
          },
        },
        {
          leads: {
            some: {
              OR: [
                { title: basicText },
                { customerName: basicText },
                { phone: basicText },
                { email: basicText },
                { notes: basicText },
              ],
            },
          },
        },
        {
          tasks: {
            some: {
              OR: [
                { title: basicText },
                { description: basicText },
                { notes: basicText },
                { companyName: basicText },
                { leadName: basicText },
              ],
            },
          },
        },
        {
          followUps: {
            some: {
              OR: [
                { method: basicText },
                { note: basicText },
                { nextDiscussionPlan: basicText },
              ],
            },
          },
        },
        {
          communications: {
            some: {
              OR: [
                { method: basicText },
                { note: basicText },
                { discussionTopic: basicText },
                { productDiscussed: basicText },
                { outcome: basicText },
                { followUpNote: basicText },
              ],
            },
          },
        },
        {
          quotations: {
            some: {
              OR: [
                { quoteNumber: basicText },
                { notes: basicText },
              ],
            },
          },
        },
        ...(normalizedPhoneSearch
          ? [
              { phone: { contains: normalizedPhoneSearch } },
              { phone2: { contains: normalizedPhoneSearch } },
              { contacts: { some: { OR: [{ mobile: { contains: normalizedPhoneSearch } }, { whatsapp: { contains: normalizedPhoneSearch } }] } } },
              { phoneNumbers: { some: { number: { contains: normalizedPhoneSearch } } } },
              { leads: { some: { phone: { contains: normalizedPhoneSearch } } } },
            ]
          : []),
        ...(isCallSearch
          ? [
              { communications: { some: { OR: [{ method: { contains: "call", mode: "insensitive" as const } }, { method: { contains: "phone", mode: "insensitive" as const } }] } } },
              { followUps: { some: { OR: [{ method: { contains: "call", mode: "insensitive" as const } }, { method: { contains: "phone", mode: "insensitive" as const } }] } } },
              { tasks: { some: { OR: [{ title: { contains: "call", mode: "insensitive" as const } }, { description: { contains: "call", mode: "insensitive" as const } }, { notes: { contains: "call", mode: "insensitive" as const } }] } } },
            ]
          : []),
        ...(isFollowUpSearch
          ? [
              { followUps: { some: {} } },
              { communications: { some: { followUpNote: { not: null } } } },
            ]
          : []),
        ...(isQuotationSearch
          ? [
              { quotations: { some: {} } },
              { tasks: { some: { OR: [{ title: { contains: "quotation", mode: "insensitive" as const } }, { description: { contains: "quotation", mode: "insensitive" as const } }, { notes: { contains: "quotation", mode: "insensitive" as const } }] } } },
            ]
          : []),
        ...(isDemoSearch
          ? [
              { communications: { some: { OR: [{ discussionTopic: { contains: "demo", mode: "insensitive" as const } }, { note: { contains: "demo", mode: "insensitive" as const } }] } } },
              { followUps: { some: { OR: [{ note: { contains: "demo", mode: "insensitive" as const } }, { nextDiscussionPlan: { contains: "demo", mode: "insensitive" as const } }] } } },
              { tasks: { some: { OR: [{ title: { contains: "demo", mode: "insensitive" as const } }, { description: { contains: "demo", mode: "insensitive" as const } }, { notes: { contains: "demo", mode: "insensitive" as const } }] } } },
            ]
          : []),
        ...(isWonSearch
          ? [
              { communications: { some: { OR: [{ outcome: { contains: "won", mode: "insensitive" as const } }, { outcome: { contains: "sale", mode: "insensitive" as const } }] } } },
            ]
          : []),
        ...(isLostSearch
          ? [
              { communications: { some: { OR: [{ outcome: { contains: "lost", mode: "insensitive" as const } }, { outcome: { contains: "failed", mode: "insensitive" as const } }, { outcome: { contains: "rejected", mode: "insensitive" as const } }] } } },
            ]
          : []),
      ],
    });
  }

  if (filters?.city?.trim()) {
    conditions.push({ city: { contains: filters.city.trim(), mode: "insensitive" } });
  }

  if (filters?.industry?.trim()) {
    conditions.push({ industry: { contains: filters.industry.trim(), mode: "insensitive" } });
  }

  return conditions.length ? { AND: conditions } : {};
}

export async function hasCustomerAccess(
  prisma: ReturnType<typeof getPrisma>,
  actor: CustomerOwnerActor,
  customerId: string,
) {
  const where = await buildCustomerScopeWhere(prisma, actor, { customerId });
  const record = await prisma.customerCompany.findFirst({
    where,
    select: { id: true },
  });

  return Boolean(record);
}

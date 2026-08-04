import "server-only";

import { getPrisma } from "@/lib/prisma";
import { getMarketerScopeUserIds } from "@/lib/customer-ownership";
import type { Role } from "@/lib/utils";

export type SuggestionActor = {
  id: string;
  role: Role;
};

export class SuggestionInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SuggestionInputError";
    this.status = status;
  }
}

export async function createMarketerSuggestion(
  sender: SuggestionActor,
  recipientId: string,
  message: string,
) {
  if (!["ADMIN", "SUPERVISOR"].includes(sender.role)) {
    throw new SuggestionInputError("Only admin and supervisor can send suggestions.", 403);
  }

  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    throw new SuggestionInputError("Suggestion message is required.");
  }

  const prisma = getPrisma();
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, role: true, status: true },
  });

  if (!recipient || recipient.role !== "MARKETER" || recipient.status !== "ACTIVE") {
    throw new SuggestionInputError("Marketer not found.", 404);
  }

  if (sender.role === "SUPERVISOR") {
    const scopeIds = await getMarketerScopeUserIds(prisma, sender);
    if (scopeIds && !scopeIds.includes(recipientId)) {
      throw new SuggestionInputError("You do not have access to this marketer.", 403);
    }
  }

  return prisma.marketerSuggestion.create({
    data: {
      senderId: sender.id,
      recipientId,
      message: trimmedMessage,
    },
  });
}

export async function getMarketerSuggestions(marketerId: string, take = 100) {
  const prisma = getPrisma();
  return prisma.marketerSuggestion.findMany({
    where: { recipientId: marketerId },
    include: { sender: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function markSuggestionRead(marketerId: string, suggestionId: string) {
  const prisma = getPrisma();
  const suggestion = await prisma.marketerSuggestion.findFirst({
    where: { id: suggestionId, recipientId: marketerId },
    select: { id: true },
  });

  if (!suggestion) return false;

  await prisma.marketerSuggestion.update({
    where: { id: suggestion.id },
    data: { readAt: new Date() },
  });

  return true;
}

export async function getUnreadSuggestionCount(marketerId: string) {
  const prisma = getPrisma();
  return prisma.marketerSuggestion.count({
    where: { recipientId: marketerId, readAt: null },
  });
}

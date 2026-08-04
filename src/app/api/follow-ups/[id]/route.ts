import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpdateFollowUpBody = {
  method?: string;
  note?: string;
  nextDiscussionPlan?: string;
  followUpDate?: string;
  followUpTime?: string;
  followUpDateTzOffset?: number;
};

function parseFollowUpDate(dateValue?: string, timeValue?: string, offsetRaw?: number) {
  const normalizedDate = dateValue?.trim();
  if (!normalizedDate) return null;

  const normalizedDateTime = normalizedDate.includes("T")
    ? normalizedDate
    : `${normalizedDate}T${(timeValue?.trim() || "10:00")}:00`;

  const offsetMinutes = Number.isFinite(offsetRaw) ? offsetRaw : undefined;
  const match = normalizedDateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match || offsetMinutes === undefined) {
    const parsed = new Date(normalizedDateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");
  const parsed = new Date(Date.UTC(year, month, day, hour, minute, second) + offsetMinutes * 60 * 1000);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function visibleFollowUpWhere(user: { id: string; role: "ADMIN" | "SUPERVISOR" | "MARKETER" }, id: string): Promise<Prisma.FollowUpWhereInput> {
  if (user.role === "ADMIN") {
    return { id };
  }

  if (user.role === "MARKETER") {
    return {
      id,
      OR: [
        { assignedToId: user.id },
        { assignedToId: null, task: { is: { assignedToId: user.id } } },
        { assignedToId: null, lead: { is: { assignedToId: user.id } } },
        { assignedToId: null, company: { is: { assignedToId: user.id } } },
      ],
    };
  }

  const prisma = getPrisma();
  const team = await prisma.user.findMany({
    where: {
      role: "MARKETER",
      status: "ACTIVE",
      OR: [
        { supervisorId: user.id },
        { supervisorAssignmentsAsMarketer: { some: { supervisorId: user.id } } },
      ],
    },
    select: { id: true },
  });
  const scopedUserIds = [user.id, ...team.map((member) => member.id)];

  return {
    id,
    OR: [
      { assignedToId: { in: scopedUserIds } },
      { assignedToId: null, task: { is: { assignedToId: { in: scopedUserIds } } } },
      { assignedToId: null, lead: { is: { assignedToId: { in: scopedUserIds } } } },
      { assignedToId: null, company: { is: { assignedToId: { in: scopedUserIds } } } },
    ],
  };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { id } = await context.params;
    const body = (await request.json()) as UpdateFollowUpBody;
    const followUpDate = parseFollowUpDate(body.followUpDate, body.followUpTime, body.followUpDateTzOffset);

    if (!followUpDate) {
      return NextResponse.json({ success: false, message: "Follow-up date is required." }, { status: 400 });
    }

    const existing = await prisma.followUp.findFirst({
      where: await visibleFollowUpWhere({ id: auth.user.id, role: auth.user.role }, id),
      select: {
        id: true,
        companyId: true,
        leadId: true,
        completedAt: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: "Follow-up not found or you do not have access." }, { status: 404 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextStatus = followUpDate < today ? "OVERDUE" : followUpDate < tomorrow ? "TODAY" : "UPCOMING";
    const isCompleted = Boolean(existing.completedAt || existing.status === "COMPLETED");

    const updated = await prisma.followUp.update({
      where: { id: existing.id },
      data: {
        method: body.method?.trim() || "Phone Call",
        note: body.note?.trim() || "Follow-up",
        nextDiscussionPlan: body.nextDiscussionPlan?.trim() || null,
        followUpDate,
        ...(isCompleted ? {} : { status: nextStatus, reminderSentAt: null }),
      },
      select: { id: true, followUpDate: true },
    });

    await prisma.activityTimeline.create({
      data: {
        title: isCompleted ? "Completed Follow-up Updated" : "Follow-up Updated",
        description: body.note?.trim() || (isCompleted ? "Completed follow-up updated" : "Follow-up updated"),
        entity: "FollowUp",
        entityId: updated.id,
        userId: auth.user.id,
        companyId: existing.companyId ?? undefined,
        leadId: existing.leadId ?? undefined,
        followUpId: updated.id,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: isCompleted ? "Completed Follow-up Updated" : "Follow-up Updated",
        entity: "FollowUp",
        entityId: updated.id,
      },
    });

    return NextResponse.json({ success: true, row: { id: updated.id, followUpDate: updated.followUpDate.toISOString() } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Follow-up update failed." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { id } = await context.params;

    const existing = await prisma.followUp.findFirst({
      where: await visibleFollowUpWhere({ id: auth.user.id, role: auth.user.role }, id),
      select: {
        id: true,
        companyId: true,
        leadId: true,
        completedAt: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ success: false, message: "Follow-up not found or you do not have access." }, { status: 404 });
    }

    if (existing.completedAt || existing.status === "COMPLETED") {
      return NextResponse.json({ success: false, message: "Completed follow-up cannot be deleted." }, { status: 400 });
    }

    await prisma.followUp.delete({ where: { id: existing.id } });

    await prisma.activityLog.create({
      data: {
        userId: auth.user.id,
        action: "Follow-up Deleted",
        entity: "FollowUp",
        entityId: existing.id,
      },
    });

    return NextResponse.json({ success: true, id: existing.id });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Follow-up delete failed." },
      { status: 500 },
    );
  }
}

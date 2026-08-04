import { NextResponse } from "next/server";
import { buildCustomerScopeWhere, resolveCustomerOwnerId } from "@/lib/customer-ownership";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BulkAssignPayload = {
  customerIds?: unknown;
  assignedToId?: unknown;
};

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(ids));
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const payload = (await request.json()) as BulkAssignPayload;
    const customerIds = normalizeIdList(payload.customerIds);
    const assignedToId = normalizeText(payload.assignedToId);

    if (!customerIds.length) {
      return NextResponse.json({ success: false, message: "Select at least one customer." }, { status: 400 });
    }

    if (!assignedToId) {
      return NextResponse.json({ success: false, message: "Select a marketer to assign." }, { status: 400 });
    }

    const prisma = getPrisma();
    const nextOwnerId = await resolveCustomerOwnerId(
      prisma,
      { id: auth.user.id, role: auth.user.role },
      assignedToId,
      { requireSelectionForElevated: true },
    );

    if (!nextOwnerId) {
      return NextResponse.json({ success: false, message: "Selected marketer was not found." }, { status: 400 });
    }

    const scopeWhere = await buildCustomerScopeWhere(prisma, { id: auth.user.id, role: auth.user.role });
    const visibleRows = await prisma.customerCompany.findMany({
      where: {
        AND: [
          scopeWhere,
          { id: { in: customerIds } },
        ],
      },
      select: { id: true },
    });

    if (visibleRows.length !== customerIds.length) {
      return NextResponse.json({ success: false, message: "Some selected customers are no longer available for assignment." }, { status: 403 });
    }

    await prisma.customerCompany.updateMany({
      where: { id: { in: customerIds } },
      data: { assignedToId: nextOwnerId },
    });

    return NextResponse.json({
      success: true,
      assignedToId: nextOwnerId,
      updatedCount: customerIds.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Customer bulk assignment failed.",
      },
      { status: 500 },
    );
  }
}

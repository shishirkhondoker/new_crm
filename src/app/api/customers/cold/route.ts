import { NextResponse } from "next/server";
import { buildCustomerScopeWhere } from "@/lib/customer-ownership";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim();

    const where = await buildCustomerScopeWhere(
      prisma,
      { id: auth.user.id, role: auth.user.role },
      { search, parkedView: "only" },
    );

    const rows = await prisma.customerCompany.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        parkedBy: { select: { id: true, name: true } },
      },
      orderBy: { parkedUntil: "asc" },
      take: 2000,
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        industry: row.industry,
        city: row.city,
        phone: row.phone,
        assignedToId: row.assignedToId,
        assignedTo: row.assignedTo?.name ?? "-",
        parkedUntil: row.parkedUntil ? row.parkedUntil.toISOString() : null,
        parkedNote: row.parkedNote ?? "",
        parkedAt: row.parkedAt ? row.parkedAt.toISOString() : null,
        parkedById: row.parkedById,
        parkedBy: row.parkedBy?.name ?? "-",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load cold customers." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { buildCustomerScopeWhere } from "@/lib/customer-ownership";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 100);
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const limit = normalizeLimit(searchParams.get("limit"));
    const where = await buildCustomerScopeWhere(
      prisma,
      { id: auth.user.id, role: auth.user.role },
      { search: query },
    );

    const rows = await prisma.customerCompany.findMany({
      where,
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({ value: row.id, label: row.name })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to search companies.",
      },
      { status: 500 },
    );
  }
}

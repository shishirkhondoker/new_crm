import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { buildCustomerScopeWhere } from "@/lib/customer-ownership";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const companyListSelect = {
  id: true,
  name: true,
  contactPerson: true,
  phone: true,
  city: true,
  industry: true,
} satisfies Prisma.CustomerCompanySelect;

type CompanyListRow = Prisma.CustomerCompanyGetPayload<{
  select: typeof companyListSelect;
}>;

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 500;
  return Math.min(parsed, 2000);
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") ?? searchParams.get("search") ?? searchParams.get("name") ?? "").trim();
    const city = (searchParams.get("city") ?? searchParams.get("zila") ?? "").trim();
    const industry = (searchParams.get("industry") ?? "").trim();
    const limit = parseLimit(searchParams.get("limit"));

    const where = await buildCustomerScopeWhere(
      prisma,
      { id: auth.user.id, role: auth.user.role },
      {
        search: query,
        city,
        industry,
      },
    );
    const rows = await prisma.customerCompany.findMany({
      where,
      select: companyListSelect,
      orderBy: { name: "asc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row: CompanyListRow) => ({
        id: row.id,
        name: row.name,
        companyName: row.name,
        contactPerson: row.contactPerson,
        phone: row.phone,
        city: row.city,
        industry: row.industry,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load companies.",
      },
      { status: 500 },
    );
  }
}

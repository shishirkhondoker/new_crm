import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { buildCustomerScopeWhere } from "@/lib/customer-ownership";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const customerListSelect = {
  id: true,
  name: true,
  contactPerson: true,
  phone: true,
  city: true,
  address: true,
  rawData: true,
} satisfies Prisma.CustomerCompanySelect;

type CustomerListRow = Prisma.CustomerCompanyGetPayload<{
  select: typeof customerListSelect;
}>;

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 100);
}

function readRawString(row: Record<string, unknown>, keys: string[]) {
  const normalizeKey = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\s*\/\s*/g, " / ").toLowerCase();
  const normalized = new Map<string, unknown>();
  for (const [rawKey, rawValue] of Object.entries(row)) {
    normalized.set(normalizeKey(rawKey), rawValue);
  }

  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") {
      const normalizedValue = value.trim();
      if (normalizedValue) return normalizedValue;
    } else if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  for (const key of keys) {
    const value = normalized.get(normalizeKey(key));
    if (typeof value === "string") {
      const normalizedValue = value.trim();
      if (normalizedValue) return normalizedValue;
    } else if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return "";
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const prisma = getPrisma();
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const limit = parseLimit(searchParams.get("limit"));

    const where = await buildCustomerScopeWhere(
      prisma,
      { id: auth.user.id, role: auth.user.role },
      { search },
    );

    const rows = await prisma.customerCompany.findMany({
      where,
      select: customerListSelect,
      orderBy: { name: "asc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      rows: rows.map((row: CustomerListRow) => {
        const raw = (row.rawData && typeof row.rawData === "object" && !Array.isArray(row.rawData))
          ? row.rawData as Record<string, unknown>
          : {};

        return {
          id: row.id,
          companyName: row.name,
          contactPerson: row.contactPerson,
          phone: row.phone,
          cityOrZilla: row.city || readRawString(raw, ["City / Zilla", "City/Zilla", "City", "Zilla"]) || null,
          address: row.address || readRawString(raw, ["Address", "Company Address", "Full Address", "Location"]) || null,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load customers.",
      },
      { status: 500 },
    );
  }
}

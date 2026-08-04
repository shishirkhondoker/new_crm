import { NextResponse } from "next/server";
import { getFollowUpPageData } from "@/lib/crm-data";
import { requireRequestUser } from "@/lib/request-user";
import type { ShellUser } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const pendingOnly = searchParams.get("pendingOnly") === "true";
    const pageSize = Number(searchParams.get("pageSize") ?? "500");
    const page = Number(searchParams.get("page") ?? "1");
    const dateFilter = searchParams.get("dateFilter") ?? "all";
    const search = searchParams.get("search") ?? "";
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";

    const user: ShellUser = {
      id: auth.user.id,
      name: auth.user.name,
      mobile: auth.user.mobile ?? undefined,
      role: auth.user.role,
    };

    const data = await getFollowUpPageData(auth.user.role, user, {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 1000) : 500,
      dateFilter: dateFilter as "all" | "today" | "tomorrow" | "week" | "month" | "custom" | "overdue" | "completed",
      search,
      from,
      to,
    });

    const rows = pendingOnly ? data.rows.filter((row) => row.bucket !== "Completed") : data.rows;

    return NextResponse.json({
      success: true,
      rows,
      summary: data.summary,
      total: pendingOnly ? data.summary.actionable : data.total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load follow-ups." },
      { status: 500 },
    );
  }
}

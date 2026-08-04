import { NextResponse } from "next/server";
import { exportLeads, type LeadExportFormat } from "@/lib/lead-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const format: LeadExportFormat = searchParams.get("format") === "csv" ? "csv" : "xlsx";
    const visibleColumns = searchParams.get("columns")?.split(",").map((item) => item.trim()).filter(Boolean);
    const result = await exportLeads(
      { id: auth.user.id, role: auth.user.role },
      format,
      visibleColumns,
      {
        search: searchParams.get("search") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        priority: searchParams.get("priority") ?? undefined,
        assignedToId: searchParams.get("assignedToId") ?? undefined,
      },
    );

    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lead export failed." },
      { status: 500 },
    );
  }
}

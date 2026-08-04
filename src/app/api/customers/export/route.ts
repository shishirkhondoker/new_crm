import { NextResponse } from "next/server";
import { exportCustomers, type CustomerExportFormat } from "@/lib/customer-transfer";
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
    const requestedFormat = searchParams.get("format");
    const format: CustomerExportFormat = requestedFormat === "csv" ? "csv" : "xlsx";
    const search = searchParams.get("search")?.trim() ?? undefined;
    const city = searchParams.get("city")?.trim() ?? undefined;
    const industry = searchParams.get("industry")?.trim() ?? undefined;
    const assignedToId = searchParams.get("assignedToId")?.trim() ?? undefined;

    const result = await exportCustomers(
      {
        id: auth.user.id,
        role: auth.user.role,
      },
      format,
      {
        search,
        city,
        industry,
        assignedToId,
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
      {
        success: false,
        message: error instanceof Error ? error.message : "Customer export failed.",
      },
      { status: 500 },
    );
  }
}

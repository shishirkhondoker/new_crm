import { NextResponse } from "next/server";
import { exportAllCrmData, type FullExportFormat } from "@/lib/full-export";
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
    const format: FullExportFormat = requestedFormat === "csv" ? "csv" : "xlsx";

    const result = await exportAllCrmData(
      {
        id: auth.user.id,
        role: auth.user.role,
      },
      format,
    );

    return new NextResponse(Buffer.from(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename=\"${result.fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Full export failed.",
      },
      { status: 500 },
    );
  }
}

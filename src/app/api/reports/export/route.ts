import { ImportExportFormat } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { canWriteLegacyReportLog, generateReportExport, type ReportFilters } from "@/lib/report-center";
import { requireRequestUser } from "@/lib/request-user";
import { type ReportFormat, type ReportTypeKey, getReportDefinition } from "@/lib/report-definitions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFormat(value: string | null): ReportFormat {
  if (value === "csv" || value === "xlsx" || value === "print") return value;
  return "pdf";
}

function parseReportType(value: string | null): ReportTypeKey | null {
  if (!value) return null;
  return getReportDefinition(value)?.type ?? null;
}

function parseFilters(searchParams: URLSearchParams): ReportFilters {
  return {
    datePreset: (searchParams.get("datePreset") ?? "month") as ReportFilters["datePreset"],
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    customerId: searchParams.get("customerId") ?? undefined,
    communicationType: searchParams.get("communicationType") ?? undefined,
    leadStatus: searchParams.get("leadStatus") ?? undefined,
    followUpStatus: searchParams.get("followUpStatus") ?? undefined,
    taskStatus: searchParams.get("taskStatus") ?? undefined,
    productId: searchParams.get("productId") ?? undefined,
  };
}

function toImportExportFormat(format: ReportFormat): ImportExportFormat {
  if (format === "xlsx") return "EXCEL";
  if (format === "csv") return "CSV";
  if (format === "print") return "PRINT";
  return "PDF";
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const reportType = parseReportType(searchParams.get("reportType"));
    if (!reportType) {
      return NextResponse.json({ success: false, message: "Invalid report type." }, { status: 400 });
    }

    const format = parseFormat(searchParams.get("format"));
    const filters = parseFilters(searchParams);
    const result = await generateReportExport(
      {
        id: auth.user.id,
        role: auth.user.role,
        name: auth.user.name,
      },
      reportType,
      format,
      filters,
    );

    const prisma = getPrisma();
    await prisma.importExportLog.create({
      data: {
        type: "EXPORT",
        module: "REPORTS",
        format: toImportExportFormat(format),
        requestedById: auth.user.id,
        fileName: result.reportTitle,
        fileUrl: result.fileName,
        status: "COMPLETED",
        processedRows: result.rowCount,
        completedAt: new Date(),
      },
    });

    if (canWriteLegacyReportLog(reportType)) {
      await prisma.reportLog.create({
        data: {
          reportType,
          format: toImportExportFormat(format),
          requestedById: auth.user.id,
          filters,
          fileUrl: result.fileName,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report export failed.";
    const status = message === "No data found for selected filters." ? 404 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

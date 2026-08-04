import { NextResponse } from "next/server";
import {
  CUSTOMER_IMPORT_MAX_BYTES,
  importCustomersFromFile,
  importCustomersFromPdfAssignments,
  importCustomersWithAssignments,
  previewCustomerImportFile,
  type CustomerPdfAssignmentInput,
} from "@/lib/customer-transfer";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const mode = typeof formData.get("mode") === "string" ? String(formData.get("mode") ?? "").trim() : "";
    const assignLater = typeof formData.get("assignLater") === "string" && String(formData.get("assignLater") ?? "").trim() === "true";
    const assignedToId = typeof formData.get("assignedToId") === "string" ? String(formData.get("assignedToId") ?? "").trim() : undefined;
    const assignmentsJson = typeof formData.get("assignmentsJson") === "string" ? String(formData.get("assignmentsJson") ?? "") : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "A valid import file is required." }, { status: 400 });
    }

    const fileName = file.name || "customers-import.xlsx";
    const lowerName = fileName.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    const isSpreadsheet = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv");

    if (!isPdf && !isSpreadsheet) {
      return NextResponse.json({ success: false, message: "Only .xlsx, .xls, .csv, and .pdf files are supported." }, { status: 400 });
    }

    if (file.size > CUSTOMER_IMPORT_MAX_BYTES) {
      return NextResponse.json({ success: false, message: "File size exceeds the 10MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const actor = {
      id: auth.user.id,
      role: auth.user.role,
      assignedToId,
      importToSelf: assignLater,
    };

    if (mode === "preview" || mode === "pdf-preview") {
      const result = await previewCustomerImportFile(buffer, fileName);
      return NextResponse.json(result);
    }

    if (mode === "assigned-import" || mode === "pdf-import") {
      if (assignLater) {
        const result = await importCustomersFromFile(buffer, fileName, actor);
        return NextResponse.json(result);
      }

      let assignments: CustomerPdfAssignmentInput[] = [];
      if (assignmentsJson.trim()) {
        const parsed = JSON.parse(assignmentsJson) as unknown;
        if (!Array.isArray(parsed)) {
          return NextResponse.json({ success: false, message: "Invalid marketer assignment payload." }, { status: 400 });
        }
        assignments = parsed.map((item) => {
          const entry = item as { assignedToId?: unknown; count?: unknown };
          return {
            assignedToId: typeof entry.assignedToId === "string" ? entry.assignedToId : undefined,
            count: typeof entry.count === "number" ? entry.count : Number(entry.count ?? 0),
          };
        });
      }

      const result = mode === "pdf-import"
        ? await importCustomersFromPdfAssignments(buffer, fileName, actor, assignments)
        : await importCustomersWithAssignments(buffer, fileName, actor, assignments);
      return NextResponse.json(result);
    }

    if (!isSpreadsheet) {
      return NextResponse.json({ success: false, message: "Use the PDF import button for PDF customer files." }, { status: 400 });
    }

    const result = await importCustomersFromFile(buffer, fileName, actor);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Customer import failed.",
      },
      { status: 500 },
    );
  }
}

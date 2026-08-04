import { NextResponse } from "next/server";
import { importLeadsFromFile, LEAD_IMPORT_MAX_BYTES } from "@/lib/lead-center";
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
    const assignedToId = typeof formData.get("assignedToId") === "string" ? String(formData.get("assignedToId") ?? "").trim() : undefined;
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "CSV or Excel file is required." }, { status: 400 });
    }

    const fileName = file.name || "leads-import.xlsx";
    const lowerName = fileName.toLowerCase();
    if (!(lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv"))) {
      return NextResponse.json({ success: false, message: "Only .xlsx, .xls, and .csv files are supported." }, { status: 400 });
    }

    if (file.size > LEAD_IMPORT_MAX_BYTES) {
      return NextResponse.json({ success: false, message: "File size exceeds the 10MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importLeadsFromFile(buffer, fileName, { id: auth.user.id, role: auth.user.role, assignedToId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lead import failed." },
      { status: 500 },
    );
  }
}

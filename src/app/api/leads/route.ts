import { NextResponse } from "next/server";
import { createLeadEntry, LeadInputError, listLeads, type LeadInput } from "@/lib/lead-center";
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
    const result = await listLeads({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      assignedToId: searchParams.get("assignedToId") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 10),
    }, { id: auth.user.id, role: auth.user.role });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load leads." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const body = (await request.json()) as LeadInput;
    const row = await createLeadEntry(
      { id: auth.user.id, role: auth.user.role },
      body,
    );

    return NextResponse.json({ success: true, row }, { status: 201 });
  } catch (error) {
    const status = error instanceof LeadInputError ? error.status : 500;
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lead creation failed." },
      { status },
    );
  }
}

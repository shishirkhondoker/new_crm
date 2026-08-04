import { NextResponse } from "next/server";
import { deleteLeadEntry, getLeadById, LeadInputError, updateLeadEntry, type LeadInput } from "@/lib/lead-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    const row = await getLeadById(id, { id: auth.user.id, role: auth.user.role });
    if (!row) {
      return NextResponse.json({ success: false, message: "Lead not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, row });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load lead." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = (await request.json()) as LeadInput;
    const row = await updateLeadEntry(
      { id: auth.user.id, role: auth.user.role },
      id,
      body,
    );

    return NextResponse.json({ success: true, row });
  } catch (error) {
    const status = error instanceof LeadInputError ? error.status : 500;
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lead update failed." },
      { status },
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    const result = await deleteLeadEntry({ id: auth.user.id, role: auth.user.role }, id);
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    const status = error instanceof LeadInputError ? error.status : 500;
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Lead delete failed." },
      { status },
    );
  }
}

import { NextResponse } from "next/server";
import { updateFollowUpStatusById } from "@/lib/crm-actions";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Follow-up id is required." }, { status: 400 });
    }

    const followUp = await updateFollowUpStatusById(
      { id: auth.user.id, role: auth.user.role },
      id,
      "COMPLETED",
    );

    return NextResponse.json({ success: true, row: { id: followUp.id } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to complete follow-up.",
      },
      { status: 500 },
    );
  }
}

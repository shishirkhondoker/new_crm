import { NextResponse } from "next/server";
import { completeTaskEntry } from "@/lib/task-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Task id is required." }, { status: 400 });
    }

    const row = await completeTaskEntry(
      {
        id: auth.user.id,
        role: auth.user.role,
        name: auth.user.name,
      },
      id,
    );

    return NextResponse.json({ success: true, row });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Task completion failed.",
      },
      { status: 500 },
    );
  }
}

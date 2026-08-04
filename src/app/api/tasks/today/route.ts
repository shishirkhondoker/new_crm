import { NextResponse } from "next/server";
import { getTodayWorkQueue, type TaskPriorityFilter } from "@/lib/task-center";
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
    const company = searchParams.get("company") ?? undefined;
    const rawPriority = searchParams.get("priority");
    const priority = rawPriority === "IMPORTANT" || rawPriority === "HIGH" || rawPriority === "MEDIUM" || rawPriority === "LOW" || rawPriority === "ALL"
      ? rawPriority as TaskPriorityFilter
      : "ALL";

    const rows = await getTodayWorkQueue(
      {
        id: auth.user.id,
        role: auth.user.role,
        name: auth.user.name,
      },
      {
        company,
        priority,
      },
    );

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load today tasks.",
      },
      { status: 500 },
    );
  }
}

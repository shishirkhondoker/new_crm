import { NextResponse } from "next/server";
import { searchCrmActivities } from "@/lib/crm-data";
import { requireRequestUser } from "@/lib/request-user";
import { rolePath } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 8;
  return Math.min(parsed, 24);
}

function extractCustomerId(href?: string | null) {
  if (!href) return undefined;
  const match = href.match(/\/customers\/([^/?#]+)/i);
  return match?.[1];
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const limit = normalizeLimit(searchParams.get("limit"));

    const rows = await searchCrmActivities({
      role: auth.user.role,
      user: auth.user,
      query,
      limit,
    });

    const tasksPageHref = rolePath(auth.user.role, "tasks");

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        customerId: extractCustomerId(row.customerHref ?? row.relatedCustomerHref ?? row.href),
        id: row.id,
        href: row.href ?? row.customerHref ?? row.relatedCustomerHref,
        actionHref:
          row.followUpId && (row.category === "FOLLOW_UP" || row.badgeLabel?.toUpperCase().includes("FOLLOW"))
            ? `${tasksPageHref}?editFollowUpId=${encodeURIComponent(row.followUpId)}`
            : row.taskId
              ? `${tasksPageHref}?editTaskId=${encodeURIComponent(row.taskId)}`
              : row.followUpId
                ? `${tasksPageHref}?editFollowUpId=${encodeURIComponent(row.followUpId)}`
                : row.href ?? row.customerHref ?? row.relatedCustomerHref,
        title: row.title,
        detail: row.detail,
        badgeLabel: row.badgeLabel ?? "Activity",
        category: row.category ?? "OTHER",
        customerName: row.customerName ?? "-",
        employeeName: row.employeeName ?? row.createdBy ?? "-",
        discussionSummary: row.discussionSummary ?? row.notes ?? "",
        time: row.time,
        taskId: row.taskId,
        followUpId: row.followUpId,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to search activities.",
      },
      { status: 500 },
    );
  }
}

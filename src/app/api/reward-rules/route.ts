import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RewardRuleBody = {
  name?: string;
  trigger?: string;
  points?: number | string;
  active?: boolean;
};

const triggerOptions = new Set([
  "LEAD_CREATED",
  "FOLLOW_UP_COMPLETED",
  "MEETING_SCHEDULED",
  "WON_SALE",
  "TASK_COMPLETED",
  "MANUAL_ADJUSTMENT",
]);

function formatRule(rule: {
  id: string;
  name: string;
  trigger: string;
  points: number;
  active: boolean;
  createdAt: Date;
}) {
  return {
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    points: rule.points,
    active: rule.active,
    createdAt: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(rule.createdAt),
  };
}

export async function GET() {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const rows = await getPrisma().rewardRule.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json({ success: true, rows: rows.map(formatRule) });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load reward rules." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const body = (await request.json()) as RewardRuleBody;
    const name = body.name?.trim() ?? "";
    const trigger = body.trigger?.trim() ?? "";
    const points = Number(body.points);

    if (!name) {
      return NextResponse.json({ success: false, message: "Rule name is required." }, { status: 400 });
    }
    if (!triggerOptions.has(trigger)) {
      return NextResponse.json({ success: false, message: "Trigger/Event is required." }, { status: 400 });
    }
    if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) {
      return NextResponse.json({ success: false, message: "Points must be a positive integer." }, { status: 400 });
    }

    const rule = await getPrisma().rewardRule.create({
      data: {
        name,
        trigger,
        points,
        active: body.active ?? true,
      },
    });

    return NextResponse.json({ success: true, row: formatRule(rule) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create reward rule." },
      { status: 500 },
    );
  }
}

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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = (await request.json()) as RewardRuleBody;
    const rule = await getPrisma().rewardRule.findUnique({ where: { id } });

    if (!rule) {
      return NextResponse.json({ success: false, message: "Reward rule not found." }, { status: 404 });
    }

    const name = body.name?.trim() ?? rule.name;
    const trigger = body.trigger?.trim() ?? rule.trigger;
    const points = body.points === undefined ? rule.points : Number(body.points);
    const active = body.active ?? rule.active;

    if (!name) {
      return NextResponse.json({ success: false, message: "Rule name is required." }, { status: 400 });
    }
    if (!triggerOptions.has(trigger)) {
      return NextResponse.json({ success: false, message: "Trigger/Event is required." }, { status: 400 });
    }
    if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) {
      return NextResponse.json({ success: false, message: "Points must be a positive integer." }, { status: 400 });
    }

    const updated = await getPrisma().rewardRule.update({
      where: { id },
      data: { name, trigger, points, active },
    });

    return NextResponse.json({ success: true, row: formatRule(updated) });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to update reward rule." },
      { status: 500 },
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    const existing = await getPrisma().rewardRule.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ success: false, message: "Reward rule not found." }, { status: 404 });
    }

    await getPrisma().rewardRule.delete({ where: { id } });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to delete reward rule." },
      { status: 500 },
    );
  }
}

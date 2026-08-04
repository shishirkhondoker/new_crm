import { NextResponse } from "next/server";
import { sendMarketerSuggestionById } from "@/lib/crm-actions";
import { getMarketerScopeUserIds } from "@/lib/customer-ownership";
import { getPrisma } from "@/lib/prisma";
import { getMarketerSuggestions, SuggestionInputError } from "@/lib/suggestion-center";
import { requireRequestUser } from "@/lib/request-user";
import type { Role } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ marketerId: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { marketerId } = await context.params;
    if (!marketerId) {
      return NextResponse.json({ success: false, message: "Marketer id is required." }, { status: 400 });
    }

    const prisma = getPrisma();
    if (auth.user.role === "SUPERVISOR") {
      const scopeIds = await getMarketerScopeUserIds(prisma, { id: auth.user.id, role: auth.user.role as Role });
      if (scopeIds && !scopeIds.includes(marketerId)) {
        return NextResponse.json({ success: false, message: "You do not have access to this marketer." }, { status: 403 });
      }
    }

    const suggestions = await getMarketerSuggestions(marketerId, 5);
    return NextResponse.json({
      success: true,
      rows: suggestions.map((item) => ({
        id: item.id,
        message: item.message,
        senderName: item.sender.name,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load suggestions." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ marketerId: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { marketerId } = await context.params;
    if (!marketerId) {
      return NextResponse.json({ success: false, message: "Marketer id is required." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message : "";

    const suggestion = await sendMarketerSuggestionById(
      { id: auth.user.id, role: auth.user.role as Role },
      marketerId,
      message,
    );

    return NextResponse.json({ success: true, suggestion }, { status: 201 });
  } catch (error) {
    const status = error instanceof SuggestionInputError ? error.status : 500;
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to send suggestion." },
      { status },
    );
  }
}

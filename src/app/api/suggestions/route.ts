import { NextResponse } from "next/server";
import { getMarketerSuggestions } from "@/lib/suggestion-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireRequestUser(["MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const suggestions = await getMarketerSuggestions(auth.user.id);
    return NextResponse.json({
      success: true,
      rows: suggestions.map((item) => ({
        id: item.id,
        message: item.message,
        senderName: item.sender.name,
        senderRole: item.sender.role,
        read: Boolean(item.readAt),
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

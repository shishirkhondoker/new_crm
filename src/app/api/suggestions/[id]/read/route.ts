import { NextResponse } from "next/server";
import { markSuggestionRead } from "@/lib/suggestion-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Suggestion id is required." }, { status: 400 });
    }

    const updated = await markSuggestionRead(auth.user.id, id);
    if (!updated) {
      return NextResponse.json({ success: false, message: "Suggestion not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to mark suggestion read." },
      { status: 500 },
    );
  }
}

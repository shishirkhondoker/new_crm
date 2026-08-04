import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notification-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => null) as { id?: string } | null;
  const id = body?.id?.trim();
  if (!id) {
    return NextResponse.json({ success: false, message: "Notification id is required." }, { status: 400 });
  }

  const ok = await markNotificationRead(
    { id: auth.user.id, role: auth.user.role, name: auth.user.name },
    id,
  );

  if (!ok) {
    return NextResponse.json({ success: false, message: "Notification not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

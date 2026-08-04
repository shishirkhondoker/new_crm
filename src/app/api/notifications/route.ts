import { NextResponse } from "next/server";
import { getHeaderNotifications } from "@/lib/notification-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const payload = await getHeaderNotifications({
    id: auth.user.id,
    role: auth.user.role,
    name: auth.user.name,
  });

  return NextResponse.json({ success: true, ...payload });
}

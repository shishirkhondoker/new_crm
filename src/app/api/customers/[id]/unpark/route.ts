import { NextResponse } from "next/server";
import { unparkCustomerById } from "@/lib/crm-actions";
import { requireRequestUser } from "@/lib/request-user";
import type { Role } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Customer id is required." }, { status: 400 });
    }

    const customer = await unparkCustomerById({ id: auth.user.id, role: auth.user.role as Role }, id);
    return NextResponse.json({ success: true, customer });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to bring back customer." },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { createProductEntry, listProducts, ProductInputError } from "@/lib/product-center";
import { parseProductInputRequest } from "@/lib/product-request";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const rows = await listProducts();
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load products." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const input = await parseProductInputRequest(request);
    const created = await createProductEntry(
      { id: auth.user.id, role: auth.user.role, name: auth.user.name },
      { ...input, status: input.status ?? "ACTIVE" },
    );

    return NextResponse.json({ success: true, row: created.row }, { status: 201 });
  } catch (error) {
    const status = error instanceof ProductInputError ? error.status : 500;
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Product creation failed." },
      { status },
    );
  }
}

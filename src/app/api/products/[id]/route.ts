import { NextResponse } from "next/server";
import { deleteProductEntry, getProductById, ProductInputError, updateProductEntry } from "@/lib/product-center";
import { parseProductInputRequest } from "@/lib/product-request";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ success: false, message: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, row: product });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to load product." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const input = await parseProductInputRequest(request);
    const { id } = await context.params;

    const updated = await updateProductEntry(
      { id: auth.user.id, role: auth.user.role, name: auth.user.name },
      id,
      { ...input, status: input.status ?? "ACTIVE" },
    );

    return NextResponse.json({ success: true, row: updated.row });
  } catch (error) {
    const status = error instanceof ProductInputError ? error.status : 500;
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Product update failed." },
      { status },
    );
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { id } = await context.params;
    const deleted = await deleteProductEntry(
      { id: auth.user.id, role: auth.user.role, name: auth.user.name },
      id,
    );

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (error) {
    const status = error instanceof ProductInputError ? error.status : 500;
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Product delete failed." },
      { status },
    );
  }
}

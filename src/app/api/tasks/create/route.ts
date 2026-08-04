import { NextResponse } from "next/server";
import { POST as createTask } from "@/app/api/tasks/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return createTask(request);
}

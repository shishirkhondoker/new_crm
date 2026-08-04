import { NextResponse } from "next/server";
import {
  createTaskEntry,
  parseTaskDateTimeInput,
  TaskInputError,
  type TaskPriorityFilter,
} from "@/lib/task-center";
import { requireRequestUser } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateTaskBody = {
  title?: string;
  companyId?: string;
  companyName?: string;
  description?: string;
  notes?: string;
  reminder?: string;
  priority?: TaskPriorityFilter;
  taskDateTime?: string;
  taskDate?: string;
  assignedToId?: string;
  productId?: string;
  customerContactPerson?: string;
  customerPhone?: string;
  customerCity?: string;
  customerAddress?: string;
  taskDateTimeTzOffset?: number;
};

function parsePriority(value: unknown): TaskPriorityFilter {
  if (value === "IMPORTANT" || value === "HIGH" || value === "MEDIUM" || value === "LOW") {
    return value;
  }
  return "MEDIUM";
}

function parseTaskDateTimeWithOffset(value: string, offsetMinutes?: number) {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match || !Number.isFinite(offsetMinutes)) {
    return parseTaskDateTimeInput(value);
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const parsed = new Date(Date.UTC(year, month, day, hour, minute) + Number(offsetMinutes) * 60 * 1000);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const body = (await request.json()) as CreateTaskBody;
    const title = body.title?.trim();
    const companyId = body.companyId?.trim();
    const companyName = body.companyName?.trim();
    const description = body.description?.trim();
    const notes = body.notes?.trim();
    const reminder = body.reminder?.trim();
    const assignedToId = body.assignedToId?.trim();
    const productId = body.productId?.trim();
    const customerContactPerson = body.customerContactPerson?.trim();
    const customerPhone = body.customerPhone?.trim();
    const customerCity = body.customerCity?.trim();
    const customerAddress = body.customerAddress?.trim();
    const priority = parsePriority(body.priority);
    const dateInput = body.taskDateTime?.trim() || body.taskDate?.trim() || "";
    const taskDateTime = dateInput ? parseTaskDateTimeWithOffset(dateInput, Number(body.taskDateTimeTzOffset)) : null;

    if (!title) {
      return NextResponse.json({ success: false, message: "Task title is required." }, { status: 400 });
    }

    if (!companyId && !companyName) {
      return NextResponse.json({ success: false, message: "Company name is required." }, { status: 400 });
    }

    if (!taskDateTime) {
      return NextResponse.json({ success: false, message: "Task date and time are required." }, { status: 400 });
    }

    const row = await createTaskEntry(
      {
        id: auth.user.id,
        role: auth.user.role,
        name: auth.user.name,
      },
      {
        title,
        companyId,
        companyName,
        description,
        notes,
        reminder,
        priority,
        taskDateTime,
        assignedToId,
        productId,
        customerContactPerson,
        customerPhone,
        customerCity,
        customerAddress,
      },
    );

    return NextResponse.json({ success: true, row });
  } catch (error) {
    const status = error instanceof TaskInputError ? error.status : 500;
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Task creation failed.",
      },
      { status },
    );
  }
}

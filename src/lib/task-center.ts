import { FollowUpStatus, Priority, TaskStatus } from "@prisma/client";
import { buildCustomerScopeWhere, hasCustomerAccess } from "@/lib/customer-ownership";
import { formatCrmDate, getCrmDayWindow, startOfCrmDay } from "@/lib/crm-time";
import { getPrisma } from "@/lib/prisma";
import { normalizeTaskReminderValue } from "@/lib/task-reminders";
import { rolePath, type Role } from "@/lib/utils";

export type TaskActor = {
  id: string;
  role: Role;
  name?: string;
};

export type TaskPriorityFilter = "ALL" | "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";

export type TaskFilters = {
  priority?: TaskPriorityFilter;
  company?: string;
};

export type TaskListItem = {
  id: string;
  title: string;
  companyName: string;
  companyPrimaryPhone: string;
  companyCity?: string | null;
  companyId?: string | null;
  productId?: string | null;
  companyHref?: string | null;
  description: string;
  notes: string;
  reminder: string;
  productName: string;
  assignedToId: string;
  assignedTo: string;
  assignedById: string;
  assignedBy: string;
  assignedByRole: string;
  assignedAtIso: string;
  assignedAtLabel: string;
  priority: "Important" | "High" | "Medium" | "Low";
  priorityKey: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  status: "Pending" | "Completed";
  statusKey: "PENDING" | "COMPLETED";
  taskDateIso: string;
  taskDateLabel: string;
  timeLabel: string;
  isPrevious: boolean;
  completedAtIso?: string | null;
  completedAtLabel: string;
  completedBy: string;
};

export type TodayWorkQueueType = "TASK" | "DUE_FOLLOW_UP" | "OVERDUE" | "CARRY_FORWARD";

export type WorkStepNote = {
  id: string;
  stepLabel: string;
  note: string;
  createdAtIso: string;
  createdAtLabel: string;
  source: "TASK" | "COMMUNICATION";
  actorName?: string | null;
};

export type TodayWorkQueueItem = {
  id: string;
  sourceId: string;
  sourceType: "TASK" | "FOLLOW_UP";
  taskId?: string | null;
  linkedTaskTitle?: string | null;
  linkedTaskDescription?: string | null;
  linkedTaskNotes?: string | null;
  linkedTaskReminder?: string | null;
  linkedTaskProductId?: string | null;
  linkedTaskProductName?: string | null;
  linkedTaskPriorityKey?: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  linkedTaskDateIso?: string | null;
  queueType: TodayWorkQueueType;
  queueLabel: "Task" | "Follow-up" | "Overdue" | "Carry Forward";
  title: string;
  companyName: string;
  companyPrimaryPhone: string;
  companyCity?: string | null;
  companyId?: string | null;
  productId?: string | null;
  companyHref?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  description: string;
  notes: string;
  reminder: string;
  productName: string;
  method: string;
  assignedToId: string;
  assignedTo: string;
  assignedById: string;
  assignedBy: string;
  assignedByRole: string;
  assignedAtIso: string;
  assignedAtLabel: string;
  priority: "Important" | "High" | "Medium" | "Low";
  priorityKey: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  status: "Pending";
  statusKey: "PENDING";
  taskDateIso: string;
  taskDateLabel: string;
  timeLabel: string;
  stepNotes: WorkStepNote[];
  isPrevious: boolean;
  isOverdue: boolean;
  isDueFollowUp: boolean;
  completedAtIso?: string | null;
  completedAtLabel: string;
  completedBy: string;
};

export type CompletedWorkItem = {
  id: string;
  sourceId: string;
  sourceType: "TASK" | "FOLLOW_UP";
  taskId?: string | null;
  linkedTaskTitle?: string | null;
  linkedTaskDescription?: string | null;
  linkedTaskNotes?: string | null;
  linkedTaskReminder?: string | null;
  linkedTaskProductId?: string | null;
  linkedTaskProductName?: string | null;
  linkedTaskAssignedToId?: string | null;
  linkedTaskAssignedTo?: string | null;
  linkedTaskPriorityKey?: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  linkedTaskDateIso?: string | null;
  title: string;
  companyName: string;
  companyPrimaryPhone: string;
  companyCity?: string | null;
  companyId?: string | null;
  productId?: string | null;
  companyHref?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  description: string;
  notes: string;
  reminder: string;
  productName: string;
  method: string;
  assignedToId: string;
  assignedTo: string;
  assignedById: string;
  assignedBy: string;
  assignedByRole: string;
  assignedAtIso: string;
  assignedAtLabel: string;
  priority: "Important" | "High" | "Medium" | "Low";
  priorityKey: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  status: "Completed";
  statusKey: "COMPLETED";
  taskDateIso: string;
  taskDateLabel: string;
  timeLabel: string;
  stepNotes: WorkStepNote[];
  completedAtIso: string;
  completedAtLabel: string;
  completedBy: string;
};

const taskQueryInclude = {
  company: true,
  product: { select: { name: true } },
  assignedTo: true,
  assignedBy: true,
  completedBy: true,
} as const;

type TaskQueryRecord = {
  id: string;
  title: string;
  companyName: string | null;
  description: string | null;
  reminder: string | null;
  notes: string | null;
  companyId: string | null;
  productId: string | null;
  taskTime: Date | null;
  assignedToId: string | null;
  assignedById: string | null;
  completedById: string | null;
  priority: Priority;
  status: TaskStatus;
  taskDate: Date;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isPrevious: boolean;
  company: { name: string; phone: string | null; city: string | null } | null;
  product: { name: string } | null;
  assignedTo: { name: string; role: string | null } | null;
  assignedBy: { name: string; role: string | null } | null;
  completedBy: { name: string } | null;
};

type FollowUpQueryRecord = {
  id: string;
  leadId: string | null;
  companyId: string | null;
  assignedToId: string | null;
  method: string;
  note: string | null;
  nextDiscussionPlan: string | null;
  status: FollowUpStatus;
  priority: Priority;
  followUpDate: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  company: { name: string; phone: string | null; city: string | null } | null;
  lead: {
    id: string;
    title: string | null;
    customerName: string | null;
    company: { id: string; name: string; phone: string | null } | null;
  } | null;
  assignedTo: { name: string; role: string | null } | null;
};

type TaskStepHistoryTaskRecord = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  taskDate: Date;
  taskTime: Date | null;
  createdAt: Date;
};

type TaskStepHistoryCommunicationRecord = {
  id: string;
  taskId: string | null;
  method: string;
  note: string;
  discussionTopic: string | null;
  followUpNote: string | null;
  communicationAt: Date;
  user: { name: string } | null;
};

export class TaskInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TaskInputError";
    this.status = status;
  }
}

function startOfToday() {
  return startOfCrmDay(new Date());
}

function startOfTomorrow() {
  return getCrmDayWindow(new Date()).to;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function formatDate(date: Date | null | undefined) {
  return formatCrmDate(date, "dd MMM yyyy");
}

function formatDateTime(date: Date | null | undefined) {
  return formatCrmDate(date, "dd MMM yyyy hh:mm a");
}

function hasExplicitTime(date: Date | null | undefined) {
  if (!date) return false;
  return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0 || date.getMilliseconds() !== 0;
}

function formatTime(date: Date | null | undefined) {
  if (!hasExplicitTime(date)) return "";
  return formatCrmDate(date, "hh:mm a");
}

function toPriorityLabel(priority: Priority): TaskListItem["priority"] {
  if (priority === "URGENT") return "Important";
  if (priority === "HIGH") return "High";
  if (priority === "LOW") return "Low";
  return "Medium";
}

function toPriorityKey(priority: Priority): TaskListItem["priorityKey"] {
  if (priority === "URGENT") return "IMPORTANT";
  return priority;
}

function toPrismaPriority(priority: TaskPriorityFilter | undefined) {
  if (!priority || priority === "ALL") return undefined;
  if (priority === "IMPORTANT") return "URGENT" as const;
  return priority;
}

function taskDisplayStatus(status: TaskStatus): TaskListItem["status"] {
  return status === "COMPLETED" ? "Completed" : "Pending";
}

function taskStatusKey(status: TaskStatus): TaskListItem["statusKey"] {
  return status === "COMPLETED" ? "COMPLETED" : "PENDING";
}

function getEffectiveTaskDateTime(task: Pick<TaskQueryRecord, "taskTime" | "taskDate">) {
  return task.taskTime ?? task.taskDate;
}

function startOfDay(date: Date) {
  return startOfCrmDay(date);
}

function effectiveTaskDate(task: Pick<TaskQueryRecord, "taskDate" | "dueDate" | "createdAt" | "taskTime">) {
  return getEffectiveTaskDateTime(task);
}

function companyDisplayName(task: TaskQueryRecord) {
  return task.company?.name ?? task.companyName ?? "Unknown Company";
}

function normalizeQueuePhone(phone: string | null | undefined) {
  const trimmed = typeof phone === "string" ? phone.trim() : "";
  return trimmed.length ? trimmed : "No phone number";
}

function roleLabel(role: string | null | undefined) {
  if (!role) return "-";
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanQueueText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length ? normalized : "";
}

function buildEmptyStepNoteMap(taskIds: string[]) {
  return new Map<string, WorkStepNote[]>(taskIds.map((taskId) => [taskId, []]));
}

async function buildTaskStepNoteMap(prisma: ReturnType<typeof getPrisma>, taskIds: string[]) {
  const uniqueTaskIds = Array.from(new Set(taskIds.filter(Boolean)));
  const stepNoteMap = buildEmptyStepNoteMap(uniqueTaskIds);

  if (!uniqueTaskIds.length) {
    return stepNoteMap;
  }

  const [tasks, communications] = await Promise.all([
    prisma.task.findMany({
      where: { id: { in: uniqueTaskIds } },
      select: {
        id: true,
        title: true,
        description: true,
        notes: true,
        taskDate: true,
        taskTime: true,
        createdAt: true,
      },
    }) as Promise<TaskStepHistoryTaskRecord[]>,
    prisma.communicationLog.findMany({
      where: { taskId: { in: uniqueTaskIds } },
      select: {
        id: true,
        taskId: true,
        method: true,
        note: true,
        discussionTopic: true,
        followUpNote: true,
        communicationAt: true,
        user: { select: { name: true } },
      },
      orderBy: [
        { communicationAt: "asc" },
        { createdAt: "asc" },
      ],
    }) as Promise<TaskStepHistoryCommunicationRecord[]>,
  ]);

  for (const task of tasks) {
    const baseNote = cleanQueueText(task.notes) || cleanQueueText(task.description);
    if (!baseNote) continue;

    const createdAt = task.taskTime ?? task.taskDate ?? task.createdAt;
    stepNoteMap.get(task.id)?.push({
      id: `task-${task.id}`,
      stepLabel: cleanQueueText(task.title) || "Task",
      note: baseNote,
      createdAtIso: createdAt.toISOString(),
      createdAtLabel: formatDateTime(createdAt),
      source: "TASK",
    });
  }

  for (const communication of communications) {
    if (!communication.taskId) continue;

    const stepLabel = cleanQueueText(communication.discussionTopic) || cleanQueueText(communication.method) || "Follow-up";
    const note = cleanQueueText(communication.followUpNote) || cleanQueueText(communication.note);
    if (!note) continue;

    stepNoteMap.get(communication.taskId)?.push({
      id: `communication-${communication.id}`,
      stepLabel,
      note,
      createdAtIso: communication.communicationAt.toISOString(),
      createdAtLabel: formatDateTime(communication.communicationAt),
      source: "COMMUNICATION",
      actorName: communication.user?.name ?? null,
    });
  }

  for (const [taskId, entries] of stepNoteMap) {
    stepNoteMap.set(
      taskId,
      entries.sort((left, right) => new Date(left.createdAtIso).getTime() - new Date(right.createdAtIso).getTime()),
    );
  }

  return stepNoteMap;
}

function normalizePipelineStep(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "call" || normalized === "phone call") return "Call";
  if (normalized === "follow-up" || normalized === "follow up") return "Follow-up";
  if (normalized === "demo send" || normalized === "demo") return "Demo Send";
  if (normalized === "quotation" || normalized === "quote" || normalized === "quatation") return "Quotation";
  if (normalized === "sale" || normalized === "sale won" || normalized === "won" || normalized === "conversion") return "Sale Won";
  if (normalized === "lead lost" || normalized === "lost") return "Lead Lost";
  return null;
}

function followUpDisplayTitle(input: {
  note?: string | null;
  nextDiscussionPlan?: string | null;
  method: string;
}) {
  const note = cleanQueueText(input.note);
  const nextPlan = cleanQueueText(input.nextDiscussionPlan);
  const pipelineStep = normalizePipelineStep(nextPlan);
  if (pipelineStep) return pipelineStep;
  return note || nextPlan || `${input.method} follow-up`;
}

function followUpDisplayDescription(input: {
  note?: string | null;
  nextDiscussionPlan?: string | null;
  method: string;
}) {
  const note = cleanQueueText(input.note);
  const nextPlan = cleanQueueText(input.nextDiscussionPlan);
  return note || nextPlan || input.method;
}

function inferTaskMethod(title: string | null | undefined, description: string | null | undefined) {
  const haystack = `${title ?? ""} ${description ?? ""}`.toLowerCase();
  if (haystack.includes("whatsapp")) return "WhatsApp";
  if (haystack.includes("meeting")) return "Meeting";
  if (haystack.includes("email")) return "Email";
  if (haystack.includes("call") || haystack.includes("phone")) return "Phone Call";
  return "Task";
}

function dashboardReturnHref(role: Role, baseHref?: string | null) {
  if (!baseHref) return null;
  const joiner = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${joiner}returnTo=${encodeURIComponent(rolePath(role, "dashboard"))}`;
}

function mapTaskRecord(task: TaskQueryRecord, role: Role): TaskListItem {
  const today = startOfToday();
  const baseDate = effectiveTaskDate(task);
  const isPrevious = task.status !== "COMPLETED" && (task.isPrevious || baseDate < today);

  return {
    id: task.id,
    title: task.title,
    companyName: companyDisplayName(task),
    companyPrimaryPhone: normalizeQueuePhone(task.company?.phone),
    companyCity: task.company?.city?.trim() || null,
    companyId: task.companyId,
    productId: task.productId,
    companyHref: dashboardReturnHref(role, task.companyId ? `/customers/${task.companyId}` : null),
    description: task.description ?? "-",
    notes: task.notes ?? "-",
    reminder: task.reminder ?? "-",
    productName: task.product?.name ?? "-",
    assignedToId: task.assignedToId ?? "",
    assignedTo: task.assignedTo?.name ?? "-",
    assignedById: task.assignedById ?? "",
    assignedBy: task.assignedBy?.name ?? "-",
    assignedByRole: roleLabel(task.assignedBy?.role),
    assignedAtIso: task.createdAt.toISOString(),
    assignedAtLabel: formatDateTime(task.createdAt),
    priority: toPriorityLabel(task.priority),
    priorityKey: toPriorityKey(task.priority),
    status: taskDisplayStatus(task.status),
    statusKey: taskStatusKey(task.status),
    taskDateIso: baseDate.toISOString(),
    taskDateLabel: formatDate(baseDate),
    timeLabel: formatTime(task.taskTime),
    isPrevious,
    completedAtIso: task.updatedAt.toISOString(),
    completedAtLabel: formatDateTime(task.updatedAt),
    completedBy: task.completedBy?.name ?? "-",
  };
}

function parseCompanyFilter(company?: string) {
  const value = company?.trim();
  if (!value) return undefined;

  return {
    OR: [
      { companyName: { contains: value, mode: "insensitive" as const } },
      { company: { is: { name: { contains: value, mode: "insensitive" as const } } } },
    ],
  } as Record<string, unknown>;
}

export function parseTaskDateInput(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = normalized.includes("T") ? new Date(normalized) : new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseTaskDateTimeInput(value: string) {
  return parseTaskDateInput(value);
}

function isTaskVisibleInTodayList(task: TaskQueryRecord, now = new Date()) {
  if (task.status === "COMPLETED") return false;
  if (effectiveTaskDate(task).getTime() < startOfDay(now).getTime()) return true;
  return Boolean(task.taskTime);
}

async function getTaskScopeUserIds(prisma: ReturnType<typeof getPrisma>, actor: TaskActor) {
  if (actor.role === "ADMIN") return undefined;
  if (actor.role === "MARKETER") return [actor.id];

  const team = await prisma.user.findMany({
    where: { role: "MARKETER", status: "ACTIVE" },
    select: { id: true },
  });

  return [actor.id, ...team.map((member) => member.id)];
}

async function scopedTaskWhere(prisma: ReturnType<typeof getPrisma>, actor: TaskActor) {
  if (actor.role === "ADMIN") return {};
  if (actor.role === "MARKETER") return { assignedToId: actor.id };

  const scopedIds = await getTaskScopeUserIds(prisma, actor);
    return {
      OR: [
        { assignedToId: { in: scopedIds } },
        { assignedById: actor.id },
      ],
    };
}

async function scopedFollowUpWhere(prisma: ReturnType<typeof getPrisma>, actor: TaskActor) {
  if (actor.role === "ADMIN") return {};
  if (actor.role === "MARKETER") return { assignedToId: actor.id };

  const scopedIds = await getTaskScopeUserIds(prisma, actor);
  return { assignedToId: { in: scopedIds } };
}

async function resolveAssignedTaskUser(prisma: ReturnType<typeof getPrisma>, actor: TaskActor, assignedToId?: string) {
  if (actor.role === "MARKETER") {
    return actor.id;
  }

  if (actor.role === "SUPERVISOR" && (!assignedToId || assignedToId === actor.id)) {
    return actor.id;
  }

  if (!assignedToId) {
    throw new TaskInputError("Assigned user is required.");
  }

  const assignee = await prisma.user.findFirst({
    where: {
      id: assignedToId,
      status: "ACTIVE",
      ...(actor.role === "SUPERVISOR"
        ? {
          role: "MARKETER",
          }
        : {
            role: { in: ["SUPERVISOR", "MARKETER"] },
          }),
    },
    select: { id: true, role: true },
  });

  if (!assignee) {
    throw new TaskInputError(
      actor.role === "SUPERVISOR"
        ? "Selected user must be you or an active marketer."
        : "Selected assignee must be an active supervisor or marketer.",
      403,
    );
  }

  return assignee.id;
}

async function addTaskActivity(prisma: ReturnType<typeof getPrisma>, input: {
  userId: string;
  taskId: string;
  companyId?: string | null;
  title: string;
  taskTitle?: string;
  description: string;
}) {
  await prisma.activityTimeline.create({
    data: {
      title: input.title,
      description: input.description,
      entity: "Task",
      entityId: input.taskId,
      userId: input.userId,
      taskId: input.taskId,
      companyId: input.companyId ?? undefined,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      action: input.title,
      entity: "Task",
      entityId: input.taskId,
      metadata: {
        taskId: input.taskId,
        taskTitle: input.taskTitle ?? input.title,
      },
    },
  });
}

export async function syncPreviousTaskFlags() {
  const prisma = getPrisma();
  const today = startOfToday();

  await prisma.task.updateMany({
    where: {
      status: { not: "COMPLETED" },
      taskDate: { lt: today },
      isPrevious: false,
    },
    data: {
      isPrevious: true,
    },
  });

  await prisma.task.updateMany({
    where: {
      isPrevious: true,
      OR: [
        { status: "COMPLETED" },
        { taskDate: { gte: today } },
      ],
    },
    data: {
      isPrevious: false,
    },
  });
}

async function resolveTaskCompanyRecord(
  prisma: ReturnType<typeof getPrisma>,
  actor: TaskActor,
  assignedToId: string,
  input: {
    title: string;
    companyId?: string;
    companyName?: string;
    description?: string;
    notes?: string;
    customerContactPerson?: string;
    customerPhone?: string;
    customerCity?: string;
    customerAddress?: string;
  },
) {
  const companyId = input.companyId?.trim();
  const companyName = input.companyName?.trim();

  if (companyId) {
    if (!(await hasCustomerAccess(prisma, { id: actor.id, role: actor.role }, companyId))) {
      throw new TaskInputError("You are not allowed to use this customer record.", 403);
    }

    const company = await prisma.customerCompany.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });

    if (!company) {
      throw new TaskInputError("Selected company was not found.");
    }

    return {
      companyId: company.id,
      companyName: company.name,
      createdCustomer: false,
    };
  }

  if (!companyName) {
    throw new TaskInputError("Company is required.");
  }

  const normalizedCompanyName = normalizeText(companyName);
  const matchedCompany = await prisma.customerCompany.findFirst({
    where: {
      AND: [
        await buildCustomerScopeWhere(prisma, { id: actor.id, role: actor.role }),
        { name: { equals: normalizedCompanyName, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  if (matchedCompany) {
    return {
      companyId: matchedCompany.id,
      companyName: matchedCompany.name,
      createdCustomer: false,
    };
  }

  const customerPhone = input.customerPhone?.trim() ?? "";
  const customerContactPerson = input.customerContactPerson?.trim();
  const customerCity = input.customerCity?.trim();
  const customerAddress = input.customerAddress?.trim();
  const taskNotes = [
    `Auto-created from task: ${normalizeText(input.title)}`,
    input.description?.trim() ? normalizeText(input.description) : "",
    input.notes?.trim() ? `Task note: ${normalizeText(input.notes)}` : "",
  ].filter(Boolean);

  const createdCustomer = await prisma.customerCompany.create({
    data: {
      name: normalizedCompanyName,
      contactPerson: customerContactPerson ? normalizeText(customerContactPerson) : undefined,
      phone: customerPhone,
      city: customerCity ? normalizeText(customerCity) : undefined,
        address: customerAddress ? normalizeText(customerAddress) : undefined,
      industry: "General",
      notes: taskNotes.join("\n\n"),
      rawData: {
        "Lead Source": "Task Auto Create",
        "Primary Phone": customerPhone,
        "Contact Person 1 Name": customerContactPerson ?? "",
        "City / Zilla": customerCity ?? "",
          "Address": customerAddress ?? "",
      },
      assignedTo: { connect: { id: assignedToId } },
    },
    select: { id: true, name: true },
  });

  return {
    companyId: createdCustomer.id,
    companyName: createdCustomer.name,
    createdCustomer: true,
  };
}

export async function getTodayTasks(actor: TaskActor, filters: TaskFilters = {}) {
  const prisma = getPrisma();

  const { to: tomorrow } = getCrmDayWindow(new Date());
  const where: Record<string, unknown> = {
    AND: [
      await scopedTaskWhere(prisma, actor),
      { status: "PENDING" },
      { taskDate: { lt: tomorrow } },
      ...(toPrismaPriority(filters.priority) ? [{ priority: toPrismaPriority(filters.priority) }] : []),
      ...(parseCompanyFilter(filters.company) ? [parseCompanyFilter(filters.company)!] : []),
    ],
  };

  const tasks = await prisma.task.findMany({
    where,
    include: taskQueryInclude,
    orderBy: [
      { taskDate: "asc" },
      { taskTime: "asc" },
      { updatedAt: "desc" },
    ],
  });

  const now = new Date();
  return tasks.filter((task) => isTaskVisibleInTodayList(task, now)).map((task) => mapTaskRecord(task, actor.role));
}

export async function getUpcomingTasks(actor: TaskActor, filters: TaskFilters = {}) {
  const prisma = getPrisma();

  const { to: tomorrow } = getCrmDayWindow(new Date());
  const where: Record<string, unknown> = {
    AND: [
      await scopedTaskWhere(prisma, actor),
      { status: "PENDING" },
      { taskDate: { gte: tomorrow } },
      ...(toPrismaPriority(filters.priority) ? [{ priority: toPrismaPriority(filters.priority) }] : []),
      ...(parseCompanyFilter(filters.company) ? [parseCompanyFilter(filters.company)!] : []),
    ],
  };

  const tasks = await prisma.task.findMany({
    where,
    include: taskQueryInclude,
    orderBy: [
      { taskDate: "asc" },
      { taskTime: "asc" },
      { updatedAt: "desc" },
    ],
  });

  return tasks.map((task) => mapTaskRecord(task, actor.role));
}

export async function getTodayWorkQueue(actor: TaskActor, filters: TaskFilters = {}) {
  const prisma = getPrisma();

  const { from: today, to: tomorrow } = getCrmDayWindow(new Date());
  const priorityFilter = filters.priority ? toPrismaPriority(filters.priority) : undefined;
  const companyQuery = filters.company?.trim().toLowerCase() ?? "";

  const [taskRows, followUpRows] = await Promise.all([
    prisma.task.findMany({
      where: {
        AND: [
          await scopedTaskWhere(prisma, actor),
          { status: "PENDING" },
          { taskDate: { lt: tomorrow } },
          ...(priorityFilter ? [{ priority: priorityFilter }] : []),
        ],
      },
      include: taskQueryInclude,
      orderBy: [
        { taskDate: "asc" },
        { taskTime: "asc" },
        { updatedAt: "desc" },
      ],
    }),
    prisma.followUp.findMany({
      where: {
        AND: [
          await scopedFollowUpWhere(prisma, actor),
          { status: { not: "COMPLETED" } },
          { followUpDate: { lt: tomorrow } },
          ...(priorityFilter ? [{ priority: priorityFilter }] : []),
        ],
      },
      include: {
        company: { select: { id: true, name: true, phone: true, city: true } },
        lead: {
          select: {
            id: true,
            title: true,
            customerName: true,
            company: { select: { id: true, name: true, phone: true, city: true } },
          },
        },
        assignedTo: { select: { name: true, role: true } },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            notes: true,
            reminder: true,
            priority: true,
            productId: true,
            taskDate: true,
            taskTime: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { followUpDate: "asc" },
        { updatedAt: "desc" },
      ],
    }),
  ]);

  const stepNoteMap = await buildTaskStepNoteMap(
    prisma,
    [
      ...taskRows.map((task) => task.id),
      ...followUpRows.map((followUp) => followUp.task?.id).filter((value): value is string => Boolean(value)),
    ],
  );

  const mappedTasks: TodayWorkQueueItem[] = taskRows
    .filter((task) => task.status !== "COMPLETED")
    .map((task) => {
      const mapped = mapTaskRecord(task, actor.role);
      const baseDate = new Date(mapped.taskDateIso);
      const pipelineStep = normalizePipelineStep(task.title);
      const isCarryForward = baseDate.getTime() < today.getTime();
      const isDueFollowUpTask = pipelineStep === "Follow-up" && !isCarryForward;
      const queueType: TodayWorkQueueType = isCarryForward ? "CARRY_FORWARD" : isDueFollowUpTask ? "DUE_FOLLOW_UP" : "TASK";
      const queueLabel: TodayWorkQueueItem["queueLabel"] = isCarryForward ? "Carry Forward" : isDueFollowUpTask ? "Follow-up" : "Task";

      return {
        id: `task-${mapped.id}`,
        sourceId: mapped.id,
        sourceType: "TASK",
        queueType,
        queueLabel,
        title: mapped.title,
        companyName: mapped.companyName,
        companyPrimaryPhone: normalizeQueuePhone(task.company?.phone),
        companyCity: task.company?.city?.trim() || null,
        companyId: mapped.companyId,
        productId: mapped.productId,
        companyHref: mapped.companyHref,
        leadId: null,
        leadName: null,
        description: mapped.description,
        notes: mapped.notes,
        reminder: mapped.reminder,
        productName: mapped.productName,
        method: inferTaskMethod(task.title, task.description),
        assignedToId: mapped.assignedToId,
        assignedTo: mapped.assignedTo,
        assignedById: mapped.assignedById,
        assignedBy: mapped.assignedBy,
        assignedByRole: mapped.assignedByRole,
        assignedAtIso: mapped.assignedAtIso,
        assignedAtLabel: mapped.assignedAtLabel,
        priority: mapped.priority,
        priorityKey: mapped.priorityKey,
        status: "Pending",
        statusKey: "PENDING",
        taskDateIso: mapped.taskDateIso,
        taskDateLabel: mapped.taskDateLabel,
        timeLabel: mapped.timeLabel,
        stepNotes: stepNoteMap.get(mapped.id) ?? [],
        isPrevious: isCarryForward,
        isOverdue: isCarryForward,
        isDueFollowUp: isDueFollowUpTask,
        completedAtIso: null,
        completedAtLabel: "",
        completedBy: "-",
      };
    });

  const mappedFollowUps: TodayWorkQueueItem[] = followUpRows
    .map((followUp) => {
    const followUpDate = followUp.followUpDate;
    const isOverdue = followUp.status === "OVERDUE" || followUpDate.getTime() < today.getTime();
    const company = followUp.company ?? followUp.lead?.company ?? null;
    const companyName = company?.name ?? followUp.lead?.customerName ?? "Unknown Company";
    const companyId = company?.id ?? followUp.companyId ?? followUp.lead?.company?.id ?? null;
    const companyPrimaryPhone = normalizeQueuePhone(company?.phone);
    const note = cleanQueueText(followUp.note);
    const nextPlan = cleanQueueText(followUp.nextDiscussionPlan);
    const leadName = cleanQueueText(followUp.lead?.title);
    const title = followUpDisplayTitle({
      note: followUp.note,
      nextDiscussionPlan: followUp.nextDiscussionPlan,
      method: followUp.method,
    });
    const description = followUpDisplayDescription({
      note: followUp.note,
      nextDiscussionPlan: followUp.nextDiscussionPlan,
      method: followUp.method,
    });

    return {
      id: `follow-up-${followUp.id}`,
      sourceId: followUp.id,
      sourceType: "FOLLOW_UP",
      taskId: followUp.task?.id ?? null,
      linkedTaskTitle: followUp.task?.title ?? null,
      linkedTaskDescription: cleanQueueText(followUp.task?.description) || null,
      linkedTaskNotes: cleanQueueText(followUp.task?.notes) || null,
      linkedTaskReminder: cleanQueueText(followUp.task?.reminder) || null,
      linkedTaskProductId: followUp.task?.productId ?? null,
      linkedTaskProductName: cleanQueueText(followUp.task?.product?.name) || null,
      linkedTaskPriorityKey: followUp.task?.priority ? toPriorityKey(followUp.task.priority) : undefined,
      linkedTaskDateIso: (followUp.task?.taskTime ?? followUp.task?.taskDate)?.toISOString() ?? null,
      queueType: isOverdue ? "OVERDUE" : "DUE_FOLLOW_UP",
      queueLabel: isOverdue ? "Overdue" : "Follow-up",
      title: cleanQueueText(followUp.task?.title) || title,
      companyName,
      companyPrimaryPhone,
      companyCity: company?.city?.trim() || null,
      companyId,
      companyHref: companyId ? dashboardReturnHref(actor.role, `/customers/${companyId}`) : followUp.leadId ? `/leads/${followUp.leadId}` : null,
      leadId: followUp.leadId,
      leadName: leadName || null,
      description,
      notes: nextPlan || "-",
      reminder: "-",
      productName: cleanQueueText(followUp.task?.product?.name) || "-",
      method: cleanQueueText(followUp.method) || "Follow-up",
      assignedToId: followUp.assignedToId ?? "",
      assignedTo: followUp.assignedTo?.name ?? "-",
      assignedById: "",
      assignedBy: "-",
      assignedByRole: "-",
      assignedAtIso: followUp.createdAt.toISOString(),
      assignedAtLabel: formatDateTime(followUp.createdAt),
      priority: toPriorityLabel(followUp.priority),
      priorityKey: toPriorityKey(followUp.priority),
      status: "Pending",
      statusKey: "PENDING",
      taskDateIso: followUpDate.toISOString(),
      taskDateLabel: formatDate(followUpDate),
      timeLabel: formatTime(followUpDate),
      stepNotes: followUp.task?.id ? stepNoteMap.get(followUp.task.id) ?? [] : [],
      isPrevious: false,
      isOverdue,
      isDueFollowUp: !isOverdue,
      completedAtIso: null,
      completedAtLabel: "",
      completedBy: "-",
    };
  });

  const filteredRows = [...mappedTasks, ...mappedFollowUps].filter((item) => {
    if (!companyQuery) return true;

    const haystack = [
      item.title,
      item.companyName,
      item.description,
      item.method,
      item.leadName ?? "",
    ].join(" ").toLowerCase();
    return haystack.includes(companyQuery);
  });

  return filteredRows.sort((left, right) => {
    const leftTime = new Date(left.taskDateIso).getTime();
    const rightTime = new Date(right.taskDateIso).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.title.localeCompare(right.title);
  });
}

export async function getCompletedTasks(actor: TaskActor, filters: TaskFilters = {}) {
  const prisma = getPrisma();

  const where: Record<string, unknown> = {
    AND: [
      await scopedTaskWhere(prisma, actor),
      { status: "COMPLETED" },
      ...(toPrismaPriority(filters.priority) ? [{ priority: toPrismaPriority(filters.priority) }] : []),
      ...(parseCompanyFilter(filters.company) ? [parseCompanyFilter(filters.company)!] : []),
    ],
  };

  const tasks = await prisma.task.findMany({
    where,
    include: taskQueryInclude,
    orderBy: [
      { completedAt: "desc" },
      { updatedAt: "desc" },
    ],
  });

  return tasks.map((task) => mapTaskRecord(task, actor.role));
}

export async function getCompletedWorkItems(actor: TaskActor, filters: TaskFilters = {}) {
  const prisma = getPrisma();

  const priorityFilter = filters.priority ? toPrismaPriority(filters.priority) : undefined;
  const companyQuery = filters.company?.trim().toLowerCase() ?? "";

  const [tasks, followUps] = await Promise.all([
    prisma.task.findMany({
      where: {
        AND: [
          await scopedTaskWhere(prisma, actor),
          { status: "COMPLETED" },
          ...(priorityFilter ? [{ priority: priorityFilter }] : []),
        ],
      },
      include: taskQueryInclude,
      orderBy: [
        { completedAt: "desc" },
        { updatedAt: "desc" },
      ],
    }),
    prisma.followUp.findMany({
      where: {
        AND: [
          await scopedFollowUpWhere(prisma, actor),
          { status: "COMPLETED" },
          ...(priorityFilter ? [{ priority: priorityFilter }] : []),
        ],
      },
      include: {
        company: { select: { id: true, name: true, phone: true, city: true } },
        lead: {
          select: {
            id: true,
            title: true,
            customerName: true,
            company: { select: { id: true, name: true, phone: true, city: true } },
          },
        },
        assignedTo: { select: { name: true, role: true } },
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            notes: true,
            productId: true,
            product: { select: { name: true } },
            assignedToId: true,
            assignedTo: { select: { name: true } },
            priority: true,
            reminder: true,
            taskDate: true,
            taskTime: true,
            assignedById: true,
            assignedBy: { select: { name: true, role: true } },
            createdAt: true,
          },
        },
        timelineItems: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: [
        { completedAt: "desc" },
        { updatedAt: "desc" },
      ],
    }),
  ]);

  const stepNoteMap = await buildTaskStepNoteMap(
    prisma,
    [
      ...tasks.map((task) => task.id),
      ...followUps.map((followUp) => followUp.task?.id).filter((value): value is string => Boolean(value)),
    ],
  );

  const taskItems: CompletedWorkItem[] = tasks.map((task) => {
    const mapped = mapTaskRecord(task, actor.role);
    return {
      id: `task-${mapped.id}`,
      sourceId: mapped.id,
      sourceType: "TASK",
      taskId: mapped.id,
      title: mapped.title,
      companyName: mapped.companyName,
      companyPrimaryPhone: mapped.companyPrimaryPhone,
      companyCity: mapped.companyCity ?? null,
      companyId: mapped.companyId,
      productId: mapped.productId,
      companyHref: mapped.companyHref,
      leadId: null,
      leadName: null,
      description: mapped.description,
      notes: mapped.notes,
      reminder: mapped.reminder,
      productName: mapped.productName,
      method: inferTaskMethod(task.title, task.description),
      assignedToId: mapped.assignedToId,
      assignedTo: mapped.assignedTo,
      assignedById: mapped.assignedById,
      assignedBy: mapped.assignedBy,
      assignedByRole: mapped.assignedByRole,
      assignedAtIso: mapped.assignedAtIso,
      assignedAtLabel: mapped.assignedAtLabel,
      priority: mapped.priority,
      priorityKey: mapped.priorityKey,
      status: "Completed",
      statusKey: "COMPLETED",
      taskDateIso: mapped.taskDateIso,
      taskDateLabel: mapped.taskDateLabel,
      timeLabel: mapped.timeLabel,
      stepNotes: stepNoteMap.get(mapped.id) ?? [],
      completedAtIso: mapped.completedAtIso ?? mapped.assignedAtIso,
      completedAtLabel: mapped.completedAtLabel,
      completedBy: mapped.completedBy,
    };
  });

  const followUpItems: CompletedWorkItem[] = followUps.map((followUp) => {
    const company = followUp.company ?? followUp.lead?.company ?? null;
    const companyName = company?.name ?? followUp.lead?.customerName ?? "Unknown Company";
    const companyPrimaryPhone = normalizeQueuePhone(company?.phone);
    const companyId = company?.id ?? followUp.companyId ?? followUp.lead?.company?.id ?? null;
    const leadName = cleanQueueText(followUp.lead?.title) || cleanQueueText(followUp.lead?.customerName) || null;
    const linkedTaskTitle = cleanQueueText(followUp.task?.title);
    const title = followUpDisplayTitle({
      note: followUp.note,
      nextDiscussionPlan: followUp.nextDiscussionPlan,
      method: followUp.method,
    });
    const note = cleanQueueText(followUp.note);
    const nextPlan = cleanQueueText(followUp.nextDiscussionPlan);
    const completedAt = followUp.completedAt ?? followUp.updatedAt;
    const completedBy = followUp.timelineItems[0]?.user?.name ?? followUp.assignedTo?.name ?? "-";

    return {
      id: `follow-up-${followUp.id}`,
      sourceId: followUp.id,
      sourceType: "FOLLOW_UP",
      taskId: followUp.task?.id ?? null,
      linkedTaskTitle: followUp.task?.title ?? null,
      linkedTaskDescription: cleanQueueText(followUp.task?.description) || null,
      linkedTaskNotes: cleanQueueText(followUp.task?.notes) || null,
      linkedTaskReminder: cleanQueueText(followUp.task?.reminder) || null,
      linkedTaskProductId: followUp.task?.productId ?? null,
      linkedTaskProductName: cleanQueueText(followUp.task?.product?.name) || null,
      linkedTaskAssignedToId: followUp.task?.assignedToId ?? null,
      linkedTaskAssignedTo: cleanQueueText(followUp.task?.assignedTo?.name) || null,
      linkedTaskPriorityKey: followUp.task?.priority ? toPriorityKey(followUp.task.priority) : undefined,
      linkedTaskDateIso: (followUp.task?.taskTime ?? followUp.task?.taskDate)?.toISOString() ?? null,
      title: linkedTaskTitle || title,
      companyName,
      companyPrimaryPhone,
      companyCity: company?.city?.trim() || null,
      companyId,
      productId: followUp.task?.productId ?? null,
      companyHref: companyId ? dashboardReturnHref(actor.role, `/customers/${companyId}`) : followUp.leadId ? `/leads/${followUp.leadId}` : null,
      leadId: followUp.leadId,
      leadName,
      description: note || followUpDisplayDescription({
        note: followUp.note,
        nextDiscussionPlan: followUp.nextDiscussionPlan,
        method: followUp.method,
      }),
      notes: nextPlan || "-",
      reminder: "-",
      productName: cleanQueueText(followUp.task?.product?.name) || "-",
      method: cleanQueueText(followUp.method) || "Follow-up",
      assignedToId: followUp.assignedToId ?? "",
      assignedTo: followUp.assignedTo?.name ?? "-",
      assignedById: followUp.task?.assignedById ?? "",
      assignedBy: followUp.task?.assignedBy?.name ?? "-",
      assignedByRole: roleLabel(followUp.task?.assignedBy?.role),
      assignedAtIso: followUp.createdAt.toISOString(),
      assignedAtLabel: formatDateTime(followUp.createdAt),
      priority: toPriorityLabel(followUp.priority),
      priorityKey: toPriorityKey(followUp.priority),
      status: "Completed",
      statusKey: "COMPLETED",
      taskDateIso: followUp.followUpDate.toISOString(),
      taskDateLabel: formatDate(followUp.followUpDate),
      timeLabel: formatTime(followUp.followUpDate),
      stepNotes: followUp.task?.id ? stepNoteMap.get(followUp.task.id) ?? [] : [],
      completedAtIso: completedAt.toISOString(),
      completedAtLabel: formatDateTime(completedAt),
      completedBy,
    };
  });

  const rows = [...taskItems, ...followUpItems].filter((item) => {
    if (!companyQuery) return true;
    const haystack = [
      item.title,
      item.companyName,
      item.companyPrimaryPhone,
      item.companyCity ?? "",
      item.description,
      item.method,
      item.leadName ?? "",
      item.completedBy,
    ].join(" ").toLowerCase();
    return haystack.includes(companyQuery);
  });

  return rows.sort((left, right) => new Date(right.completedAtIso).getTime() - new Date(left.completedAtIso).getTime());
}

export async function createTaskEntry(actor: TaskActor, input: {
  title: string;
  companyId?: string;
  companyName?: string;
  description?: string;
  notes?: string;
  reminder?: string;
  priority: TaskPriorityFilter;
  taskDateTime: Date;
  assignedToId?: string;
  productId?: string;
  customerContactPerson?: string;
  customerPhone?: string;
  customerCity?: string;
  customerAddress?: string;
}) {
  const prisma = getPrisma();
  const today = startOfToday();
  const normalizedTitle = normalizeText(input.title);
  const taskDateTime = new Date(input.taskDateTime);
  const taskDate = startOfCrmDay(taskDateTime);
  const assignedToId = await resolveAssignedTaskUser(prisma, actor, input.assignedToId);
  const companyRecord = await resolveTaskCompanyRecord(prisma, actor, assignedToId, {
    title: normalizedTitle,
    companyId: input.companyId,
    companyName: input.companyName,
    description: input.description,
    notes: input.notes,
    customerContactPerson: input.customerContactPerson,
    customerPhone: input.customerPhone,
    customerCity: input.customerCity,
    customerAddress: input.customerAddress,
  });
  const companyId = companyRecord.companyId;
  const companyName = companyRecord.companyName;
  const productId = input.productId?.trim();
  const reminder = normalizeTaskReminderValue(input.reminder);

  if (productId) {
    const product = await prisma.productService.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new TaskInputError("Selected product was not found.");
    }
  }

  const task = await prisma.task.create({
    data: {
      title: normalizedTitle,
      description: input.description ? normalizeText(input.description) : undefined,
      notes: input.notes ? normalizeText(input.notes) : undefined,
      companyName: normalizeText(companyName),
      priority: toPrismaPriority(input.priority) ?? "MEDIUM",
      status: "PENDING",
      taskDate,
      taskTime: taskDateTime,
      dueDate: taskDateTime,
      reminder: reminder || null,
      isPrevious: taskDate < today,
      assignedBy: { connect: { id: actor.id } },
      assignedTo: { connect: { id: assignedToId } },
      ...(companyId ? { company: { connect: { id: companyId } } } : {}),
      ...(productId ? { product: { connect: { id: productId } } } : {}),
    },
    include: taskQueryInclude,
  });

  await addTaskActivity(prisma, {
    userId: actor.id,
    taskId: task.id,
    companyId: task.companyId,
    title: "Task Created",
    taskTitle: task.title,
    description: `${task.title} assigned to ${task.assignedTo?.name ?? "marketer"}`,
  });

  if (companyRecord.createdCustomer && task.companyId) {
    await prisma.activityTimeline.create({
      data: {
        title: "Customer Created",
        description: `${task.companyName ?? companyName} was added from task planning.`,
        entity: "CustomerCompany",
        entityId: task.companyId,
        userId: actor.id,
        companyId: task.companyId,
        taskId: task.id,
      },
    });
  }

  if (assignedToId !== actor.id) {
    await prisma.notification.create({
      data: {
        recipientId: assignedToId,
        title: "Task Assigned",
        message: task.title,
        type: "TASK_ASSIGNED",
        entity: "Task",
        entityId: task.id,
      },
    });
  }

  return mapTaskRecord(task, actor.role);
}

export async function updateTaskEntry(actor: TaskActor, taskId: string, input: {
  title: string;
  companyId?: string;
  companyName?: string;
  description?: string;
  notes?: string;
  reminder?: string;
  priority: TaskPriorityFilter;
  taskDateTime: Date;
  assignedToId?: string;
  productId?: string;
  customerContactPerson?: string;
  customerPhone?: string;
  customerCity?: string;
  customerAddress?: string;
}) {
  const prisma = getPrisma();
  await syncPreviousTaskFlags();

  const existing = await prisma.task.findFirst({
    where: {
      AND: [
        await scopedTaskWhere(prisma, actor),
        { id: taskId },
      ],
    },
    include: taskQueryInclude,
  });

  if (!existing) {
    throw new TaskInputError("Task not found or you do not have access.", 404);
  }

  if (existing.status === "COMPLETED") {
    const trimmedNote = input.notes?.trim();
    const updatedCompleted = await prisma.task.update({
      where: { id: taskId },
      data: {
        notes: existing.notes,
      },
      include: taskQueryInclude,
    });

    if (trimmedNote) {
      await prisma.communicationLog.create({
        data: {
          ...(updatedCompleted.companyId ? { company: { connect: { id: updatedCompleted.companyId } } } : {}),
          task: { connect: { id: updatedCompleted.id } },
          user: { connect: { id: actor.id } },
          method: "Task Note",
          note: normalizeText(trimmedNote),
          discussionTopic: updatedCompleted.title,
          followUpNote: normalizeText(trimmedNote),
          communicationAt: new Date(),
        },
      });
    }

    await addTaskActivity(prisma, {
      userId: actor.id,
      taskId: updatedCompleted.id,
      companyId: updatedCompleted.companyId,
      title: "Completed Task Note Updated",
      taskTitle: updatedCompleted.title,
      description: `${updatedCompleted.title} note updated`,
    });

    return mapTaskRecord(updatedCompleted, actor.role);
  }

  const taskDateTime = new Date(input.taskDateTime);
  const taskDate = startOfCrmDay(taskDateTime);
  const assignedToId = await resolveAssignedTaskUser(prisma, actor, input.assignedToId || existing.assignedToId || undefined);
  const requestedCompanyName = input.companyName?.trim();
  const companyRecord = await resolveTaskCompanyRecord(prisma, actor, assignedToId, {
    title: input.title,
    companyId: input.companyId?.trim() || (!requestedCompanyName ? existing.companyId || undefined : undefined),
    companyName: requestedCompanyName || existing.companyName || undefined,
    description: input.description,
    notes: input.notes,
    customerContactPerson: input.customerContactPerson,
    customerPhone: input.customerPhone,
    customerCity: input.customerCity,
    customerAddress: input.customerAddress,
  });
  const companyId = companyRecord.companyId;
  const companyName = companyRecord.companyName;
  const productId = input.productId?.trim();
  const reminder = normalizeTaskReminderValue(input.reminder);

  if (productId) {
    const product = await prisma.productService.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new TaskInputError("Selected product was not found.");
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: normalizeText(input.title),
      description: input.description ? normalizeText(input.description) : undefined,
      notes: input.notes ? normalizeText(input.notes) : null,
      companyName: normalizeText(companyName),
      priority: toPrismaPriority(input.priority) ?? "MEDIUM",
      taskDate,
      taskTime: taskDateTime,
      dueDate: taskDateTime,
      reminder: reminder || null,
      isPrevious: taskDate < startOfCrmDay(new Date()),
      assignedTo: { connect: { id: assignedToId } },
      ...(companyId ? { company: { connect: { id: companyId } } } : { company: { disconnect: true } }),
      ...(productId ? { product: { connect: { id: productId } } } : { product: { disconnect: true } }),
    },
    include: taskQueryInclude,
  });

  await addTaskActivity(prisma, {
    userId: actor.id,
    taskId: updated.id,
    companyId: updated.companyId,
    title: "Task Updated",
    taskTitle: updated.title,
    description: `${updated.title} updated`,
  });

  if (companyRecord.createdCustomer && updated.companyId) {
    await prisma.activityTimeline.create({
      data: {
        title: "Customer Created",
        description: `${updated.companyName ?? companyName} was added from task planning.`,
        entity: "CustomerCompany",
        entityId: updated.companyId,
        userId: actor.id,
        companyId: updated.companyId,
        taskId: updated.id,
      },
    });
  }

  return mapTaskRecord(updated, actor.role);
}

export async function deleteTaskEntry(actor: TaskActor, taskId: string) {
  const prisma = getPrisma();
  await syncPreviousTaskFlags();

  const existing = await prisma.task.findFirst({
    where: {
      AND: [
        await scopedTaskWhere(prisma, actor),
        { id: taskId },
      ],
    },
    select: {
      id: true,
      title: true,
      companyId: true,
    },
  });

  if (!existing) {
    throw new TaskInputError("Task not found or you do not have access.", 404);
  }

  await prisma.task.delete({ where: { id: taskId } });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "Task Deleted",
      entity: "Task",
      entityId: existing.id,
    },
  });

  return existing;
}

export async function completeTaskEntry(actor: TaskActor, taskId: string) {
  const prisma = getPrisma();
  await syncPreviousTaskFlags();

  const task = await prisma.task.findFirst({
    where: {
      AND: [
        await scopedTaskWhere(prisma, actor),
        { id: taskId },
      ],
    },
    include: taskQueryInclude,
  });

  if (!task) {
    throw new Error("Task not found or you do not have access.");
  }

  if (task.status === "COMPLETED") {
    throw new Error("This task is already completed.");
  }

  const completedAt = new Date();
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt,
      completedById: actor.id,
      isPrevious: false,
    },
    include: taskQueryInclude,
  });

  await addTaskActivity(prisma, {
    userId: actor.id,
    taskId: updated.id,
    companyId: updated.companyId,
    title: "Task Completed",
    taskTitle: updated.title,
    description: `${updated.title} marked completed`,
  });

  if (updated.assignedById) {
    await prisma.notification.create({
      data: {
        recipientId: updated.assignedById,
        title: "Task Completed",
        message: updated.title,
        type: "TASK_COMPLETED",
        entity: "Task",
        entityId: updated.id,
      },
    });
  }

  return mapTaskRecord(updated, actor.role);
}

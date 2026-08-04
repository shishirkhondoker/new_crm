import { NextResponse } from "next/server";

import { formatCrmDate, getCrmDayWindow, getCrmPeriodWindow, type CrmPeriod } from "@/lib/crm-time";
import { getPrisma } from "@/lib/prisma";
import { requireRequestUser } from "@/lib/request-user";
import { getMarketerScopeUserIds } from "@/lib/customer-ownership";

export const dynamic = "force-dynamic";

type TeamPerformancePeriod = CrmPeriod;
type MetricType =
  | "overview"
  | "leads"
  | "calls"
  | "whatsapp"
  | "meetings"
  | "followUps"
  | "pendingTasks"
  | "overdueFollowUps"
  | "sales"
  | "conversion"
  | "score";

type DrilldownStepNote = {
  id: string;
  stepLabel: string;
  note: string;
  createdAtIso: string;
  createdAtLabel: string;
  source: "TASK" | "FOLLOW_UP" | "COMMUNICATION";
  actorName?: string | null;
};

function pickPhone(value?: string | null) {
  if (!value) return "-";
  const [first] = value.split(/[;,|]/);
  return first?.trim() || "-";
}

type MethodBucketClause = { method: { contains: string; mode: "insensitive" } };

function withMethodBuckets(kind: "calls" | "whatsapp" | "meetings") {
  if (kind === "calls") {
    return {
      leadClause: [
        { method: { contains: "phone", mode: "insensitive" as const } },
        { method: { contains: "call", mode: "insensitive" as const } },
      ] as MethodBucketClause[],
    };
  }

  if (kind === "whatsapp") {
    return { leadClause: [{ method: { contains: "whatsapp", mode: "insensitive" as const } }] as MethodBucketClause[] };
  }

  return { leadClause: [{ method: { contains: "meeting", mode: "insensitive" as const } }] as MethodBucketClause[] };
}

function normalizeContactPerson(name: string | null | undefined) {
  return name?.trim() || "-";
}

function normalizeLeadTitle(value: string | null | undefined, fallbackCustomer: string | null | undefined) {
  return value?.trim() || fallbackCustomer?.trim() || "Lead";
}

function cleanText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized !== "-" ? normalized : "";
}

function normalizePipelineStepLabel(value?: string | null) {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return "";
  if (normalized === "call" || normalized === "phone call") return "Call";
  if (normalized === "follow-up" || normalized === "follow up") return "Follow-up";
  if (normalized === "demo send" || normalized === "demo") return "Demo Send";
  if (normalized === "quotation" || normalized === "quote" || normalized === "quatation") return "Quotation";
  if (normalized === "sale" || normalized === "sale won" || normalized === "won" || normalized === "conversion") return "Sale Won";
  if (normalized === "lead lost" || normalized === "lost") return "Lead Lost";
  return value?.trim() || "";
}

function formatTaskDetails(description?: string | null) {
  return cleanText(description) || "-";
}

function formatTaskDetailAndNote(description?: string | null, notes?: string | null) {
  const sections = [
    description?.trim() ? `Task Details: ${description.trim()}` : "",
    notes?.trim() ? `Task Note: ${notes.trim()}` : "",
  ].filter(Boolean);

  return sections.join("\n\n") || "-";
}

async function buildTaskStepNoteMap(
  prisma: ReturnType<typeof getPrisma>,
  taskIds: Array<string | null | undefined>,
  formatDisplayDate: (value: Date) => string,
) {
  const uniqueTaskIds = Array.from(new Set(taskIds.filter((taskId): taskId is string => Boolean(taskId))));
  const stepNoteMap = new Map<string, DrilldownStepNote[]>(uniqueTaskIds.map((taskId) => [taskId, []]));

  if (!uniqueTaskIds.length) {
    return stepNoteMap;
  }

  const [tasks, followUps, communications] = await Promise.all([
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
    }),
    prisma.followUp.findMany({
      where: { taskId: { in: uniqueTaskIds } },
      select: {
        id: true,
        taskId: true,
        method: true,
        note: true,
        nextDiscussionPlan: true,
        followUpDate: true,
        assignedTo: { select: { name: true } },
      },
      orderBy: [
        { followUpDate: "asc" },
        { createdAt: "asc" },
      ],
    }),
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
    }),
  ]);

  for (const task of tasks) {
    const note = cleanText(task.notes) || cleanText(task.description);
    if (!note) continue;

    const createdAt = task.taskTime ?? task.taskDate ?? task.createdAt;
    stepNoteMap.get(task.id)?.push({
      id: `task-${task.id}`,
      stepLabel: normalizePipelineStepLabel(task.title) || "Task",
      note,
      createdAtIso: createdAt.toISOString(),
      createdAtLabel: formatDisplayDate(createdAt),
      source: "TASK",
    });
  }

  for (const followUp of followUps) {
    if (!followUp.taskId) continue;
    const note = cleanText(followUp.nextDiscussionPlan) || cleanText(followUp.note);
    if (!note) continue;

    stepNoteMap.get(followUp.taskId)?.push({
      id: `followup-${followUp.id}`,
      stepLabel: normalizePipelineStepLabel(followUp.nextDiscussionPlan) || normalizePipelineStepLabel(followUp.note) || normalizePipelineStepLabel(followUp.method) || "Follow-up",
      note,
      createdAtIso: followUp.followUpDate.toISOString(),
      createdAtLabel: formatDisplayDate(followUp.followUpDate),
      source: "FOLLOW_UP",
      actorName: followUp.assignedTo?.name ?? null,
    });
  }

  for (const communication of communications) {
    if (!communication.taskId) continue;
    const note = cleanText(communication.followUpNote) || cleanText(communication.note);
    if (!note) continue;

    stepNoteMap.get(communication.taskId)?.push({
      id: `communication-${communication.id}`,
      stepLabel: normalizePipelineStepLabel(communication.discussionTopic) || normalizePipelineStepLabel(communication.method) || "Update",
      note,
      createdAtIso: communication.communicationAt.toISOString(),
      createdAtLabel: formatDisplayDate(communication.communicationAt),
      source: "COMMUNICATION",
      actorName: communication.user?.name ?? null,
    });
  }

  for (const [taskId, entries] of stepNoteMap) {
    const seen = new Set<string>();
    const normalizedEntries = entries
      .sort((left, right) => new Date(left.createdAtIso).getTime() - new Date(right.createdAtIso).getTime())
      .filter((entry) => {
        const key = `${entry.stepLabel.toLowerCase()}::${entry.note.toLowerCase()}::${entry.createdAtIso}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    stepNoteMap.set(taskId, normalizedEntries);
  }

  return stepNoteMap;
}

export async function GET(request: Request) {
  try {
    const auth = await requireRequestUser(["ADMIN", "SUPERVISOR", "MARKETER"]);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const marketerId = searchParams.get("marketerId")?.trim();
    const metricType = searchParams.get("metricType")?.trim();
    const rawPeriod = searchParams.get("period")?.trim();
    const rawFrom = searchParams.get("from")?.trim() || searchParams.get("fromDate")?.trim();
    const rawTo = searchParams.get("to")?.trim() || searchParams.get("toDate")?.trim();

    if (!marketerId) {
      return NextResponse.json({ success: false, message: "marketerId is required." }, { status: 400 });
    }

    const period: TeamPerformancePeriod = (rawPeriod === "today" || rawPeriod === "yesterday" || rawPeriod === "week" || rawPeriod === "month" || rawPeriod === "year" || rawPeriod === "custom")
      ? rawPeriod
      : "month";
    const metric = (metricType === "overview" || metricType === "leads" || metricType === "calls" || metricType === "whatsapp" || metricType === "meetings" || metricType === "followUps" || metricType === "pendingTasks"
      || metricType === "overdueFollowUps" || metricType === "sales" || metricType === "conversion" || metricType === "score")
      ? metricType
      : undefined;

    if (!metric) {
      return NextResponse.json({ success: false, message: "Invalid metricType." }, { status: 400 });
    }

    const prisma = getPrisma();
    const scopeIds = await getMarketerScopeUserIds(prisma, { id: auth.user.id, role: auth.user.role });
    if (scopeIds && !scopeIds.includes(marketerId)) {
      return NextResponse.json({ success: false, message: "No access to this marketer." }, { status: 403 });
    }

    const window = getCrmPeriodWindow(new Date(), {
      period,
      from: period === "custom" ? rawFrom ?? undefined : undefined,
      to: period === "custom" ? rawTo ?? undefined : undefined,
    });
    const { from: today } = getCrmDayWindow(new Date());
    const overdueTo = window.to.getTime() < today.getTime() ? window.to : today;

    const formatDisplayDate = (value: Date) => formatCrmDate(value, "dd/MM/yyyy hh:mm a");

    type DrilldownDetailRow = {
      id: string;
      type: "Lead" | "Task" | "Follow-up" | "Communication" | "Conversion" | "Sales" | "Quotation";
      customerOrCompany: string;
      companyId?: string | null;
      companyHref?: string | null;
      leadId?: string | null;
      taskId?: string | null;
      leadName: string;
      contactPerson: string;
      phone: string;
      method: string;
      title: string;
      dateTime: string;
      sortDate: number;
      sortDateValue: string;
      status: string;
      note: string;
      taskDetail?: string;
      latestNote?: string;
      stepNotes?: DrilldownStepNote[];
    };

    let rows: DrilldownDetailRow[] = [];
    let count = 0;
    const companyHrefFromId = (companyId?: string | null) => (companyId ? `/customers/${companyId}` : null);

    if (metric === "leads") {
      const leads = await prisma.lead.findMany({
        where: {
          assignedToId: marketerId,
          createdAt: { gte: window.from, lt: window.to },
        },
        select: {
          id: true,
          companyId: true,
          title: true,
          customerName: true,
          phone: true,
          email: true,
          status: true,
          notes: true,
          createdAt: true,
          company: {
            select: {
              name: true,
              contactPerson: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      rows = leads.map((lead) => ({
        id: lead.id,
        type: "Lead",
        customerOrCompany: lead.company?.name || lead.customerName,
        companyId: lead.companyId,
        companyHref: companyHrefFromId(lead.companyId),
        leadId: lead.id,
        leadName: normalizeLeadTitle(lead.title, lead.customerName),
        contactPerson: normalizeContactPerson(lead.company?.contactPerson),
        phone: pickPhone(lead.phone || lead.company?.phone),
        method: "Lead",
        title: normalizeLeadTitle(lead.title, lead.customerName),
        dateTime: formatDisplayDate(lead.createdAt),
        sortDate: lead.createdAt.getTime(),
        sortDateValue: lead.createdAt.toISOString(),
        status: lead.status,
        note: lead.notes ?? "-",
      }));
    }

    if (metric === "overview") {
      const [leads, tasks, completedTasks, followUps, completedFollowUps, communications, quotations, sales] = await Promise.all([
        prisma.lead.findMany({
          where: {
            assignedToId: marketerId,
            createdAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            title: true,
            customerName: true,
            phone: true,
            status: true,
            notes: true,
            createdAt: true,
            company: {
              select: {
                name: true,
                contactPerson: true,
                phone: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.task.findMany({
          where: {
            assignedToId: marketerId,
            status: { not: "COMPLETED" },
            dueDate: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            title: true,
            description: true,
            notes: true,
            status: true,
            dueDate: true,
            updatedAt: true,
            leadName: true,
            companyName: true,
            company: { select: { name: true, contactPerson: true, phone: true } },
            lead: { select: { id: true, title: true, customerName: true, phone: true, companyId: true } },
          },
          orderBy: { dueDate: "desc" },
        }),
        prisma.task.findMany({
          where: {
            assignedToId: marketerId,
            status: "COMPLETED",
            completedAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            title: true,
            description: true,
            notes: true,
            status: true,
            dueDate: true,
            updatedAt: true,
            completedAt: true,
            leadName: true,
            companyName: true,
            company: { select: { name: true, contactPerson: true, phone: true } },
            lead: { select: { id: true, title: true, customerName: true, phone: true, companyId: true } },
          },
          orderBy: { completedAt: "desc" },
        }),
        prisma.followUp.findMany({
          where: {
            assignedToId: marketerId,
            followUpDate: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            method: true,
            note: true,
            nextDiscussionPlan: true,
            status: true,
            followUpDate: true,
            taskId: true,
            lead: {
              select: {
                id: true,
                title: true,
                companyId: true,
                customerName: true,
                phone: true,
                company: { select: { name: true, contactPerson: true, phone: true } },
              },
            },
            company: { select: { name: true, contactPerson: true, phone: true } },
            task: { select: { id: true, title: true, description: true, notes: true } },
          },
          orderBy: { followUpDate: "desc" },
        }),
        prisma.followUp.findMany({
          where: {
            assignedToId: marketerId,
            status: "COMPLETED",
            completedAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            method: true,
            note: true,
            nextDiscussionPlan: true,
            status: true,
            followUpDate: true,
            completedAt: true,
            taskId: true,
            lead: {
              select: {
                id: true,
                title: true,
                companyId: true,
                customerName: true,
                phone: true,
                company: { select: { name: true, contactPerson: true, phone: true } },
              },
            },
            company: { select: { name: true, contactPerson: true, phone: true } },
            task: { select: { id: true, title: true, description: true, notes: true } },
          },
          orderBy: { completedAt: "desc" },
        }),
        prisma.communicationLog.findMany({
          where: {
            userId: marketerId,
            communicationAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            method: true,
            note: true,
            discussionTopic: true,
            communicationAt: true,
            taskId: true,
            lead: {
              select: {
                id: true,
                title: true,
                companyId: true,
                customerName: true,
                phone: true,
                company: { select: { name: true, contactPerson: true, phone: true } },
              },
            },
            company: { select: { name: true, contactPerson: true, phone: true } },
            task: { select: { id: true, title: true, description: true, notes: true } },
            followUpNote: true,
            productDiscussed: true,
          },
          orderBy: { communicationAt: "desc" },
        }),
        prisma.quotation.findMany({
          where: {
            createdById: marketerId,
            createdAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            quoteNumber: true,
            companyId: true,
            leadId: true,
            status: true,
            notes: true,
            createdAt: true,
            totalAmount: true,
            company: { select: { name: true, contactPerson: true, phone: true } },
            lead: {
              select: {
                id: true,
                title: true,
                customerName: true,
                phone: true,
                companyId: true,
                company: { select: { name: true, contactPerson: true, phone: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.lead.findMany({
          where: {
            assignedToId: marketerId,
            status: "WON_SALE",
            updatedAt: { gte: window.from, lt: window.to },
          },
          select: {
            id: true,
            companyId: true,
            title: true,
            customerName: true,
            phone: true,
            status: true,
            notes: true,
            updatedAt: true,
            company: {
              select: {
                name: true,
                contactPerson: true,
                phone: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        }),
      ]);

      const merged: DrilldownDetailRow[] = [];

      for (const lead of leads) {
        merged.push({
          id: `lead-${lead.id}`,
          type: "Lead",
          customerOrCompany: lead.company?.name || lead.customerName,
          companyId: lead.companyId,
          companyHref: companyHrefFromId(lead.companyId),
          leadId: lead.id,
          taskId: null,
          leadName: normalizeLeadTitle(lead.title, lead.customerName),
          contactPerson: normalizeContactPerson(lead.company?.contactPerson),
          phone: pickPhone(lead.phone || lead.company?.phone),
          method: "Lead",
          title: normalizeLeadTitle(lead.title, lead.customerName),
          dateTime: formatDisplayDate(lead.createdAt),
          sortDate: lead.createdAt.getTime(),
          sortDateValue: lead.createdAt.toISOString(),
          status: lead.status,
          note: lead.notes ?? "-",
          taskDetail: "-",
          latestNote: lead.notes ?? "-",
          stepNotes: [],
        });
      }

      for (const task of tasks) {
        const companyId = task.companyId ?? task.lead?.companyId ?? null;
        const taskDate = task.dueDate ?? task.updatedAt;
        const taskDetail = formatTaskDetails(task.description);
        const latestNote = cleanText(task.notes) || "-";
        merged.push({
          id: `task-${task.id}`,
          type: "Task",
          customerOrCompany: task.company?.name || task.companyName || task.lead?.customerName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: task.lead?.id ?? null,
          taskId: task.id,
          leadName: task.leadName || task.lead?.title || "-",
          contactPerson: normalizeContactPerson(task.company?.contactPerson),
          phone: pickPhone(task.company?.phone || task.lead?.phone),
          method: "Task",
          title: task.title,
          dateTime: formatDisplayDate(taskDate),
          sortDate: taskDate.getTime(),
          sortDateValue: taskDate.toISOString(),
          status: task.status,
          note: formatTaskDetailAndNote(task.description, task.notes),
          taskDetail,
          latestNote,
          stepNotes: [],
        });
      }

      for (const task of completedTasks) {
        const companyId = task.companyId ?? task.lead?.companyId ?? null;
        const completedAt = task.completedAt ?? task.updatedAt;
        const taskDetail = formatTaskDetails(task.description);
        const latestNote = cleanText(task.notes) || "-";
        merged.push({
          id: `completed-task-${task.id}`,
          type: "Task",
          customerOrCompany: task.company?.name || task.companyName || task.lead?.customerName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: task.lead?.id ?? null,
          taskId: task.id,
          leadName: task.leadName || task.lead?.title || "-",
          contactPerson: normalizeContactPerson(task.company?.contactPerson),
          phone: pickPhone(task.company?.phone || task.lead?.phone),
          method: task.title || "Task",
          title: task.title,
          dateTime: formatDisplayDate(completedAt),
          sortDate: completedAt.getTime(),
          sortDateValue: completedAt.toISOString(),
          status: "COMPLETED",
          note: formatTaskDetailAndNote(task.description, task.notes),
          taskDetail,
          latestNote,
          stepNotes: [],
        });
      }

      for (const followUp of followUps) {
        const companyId = followUp.companyId ?? followUp.lead?.companyId ?? null;
        const taskDetail = formatTaskDetails(followUp.task?.description);
        const latestNote = cleanText(followUp.nextDiscussionPlan) || cleanText(followUp.note) || "-";
        merged.push({
          id: `followup-${followUp.id}`,
          type: "Follow-up",
          customerOrCompany: followUp.company?.name || followUp.lead?.company?.name || followUp.lead?.customerName || "Customer",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: followUp.lead?.id ?? null,
          taskId: followUp.taskId ?? followUp.task?.id ?? null,
          leadName: normalizeLeadTitle(followUp.lead?.title, followUp.lead?.customerName),
          contactPerson: normalizeContactPerson(followUp.company?.contactPerson || followUp.lead?.company?.contactPerson),
          phone: pickPhone(followUp.lead?.phone || followUp.company?.phone),
          method: followUp.method || "Follow-up",
          title: followUp.task?.title || followUp.nextDiscussionPlan || followUp.note || "Follow-up",
          dateTime: formatDisplayDate(followUp.followUpDate),
          sortDate: followUp.followUpDate.getTime(),
          sortDateValue: followUp.followUpDate.toISOString(),
          status: followUp.status,
          note: latestNote,
          taskDetail,
          latestNote,
          stepNotes: [],
        });
      }

      for (const followUp of completedFollowUps) {
        const companyId = followUp.companyId ?? followUp.lead?.companyId ?? null;
        const completedAt = followUp.completedAt ?? followUp.followUpDate;
        const taskDetail = formatTaskDetails(followUp.task?.description);
        const latestNote = cleanText(followUp.nextDiscussionPlan) || cleanText(followUp.note) || "-";
        merged.push({
          id: `completed-followup-${followUp.id}`,
          type: "Follow-up",
          customerOrCompany: followUp.company?.name || followUp.lead?.company?.name || followUp.lead?.customerName || "Customer",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: followUp.lead?.id ?? null,
          taskId: followUp.taskId ?? followUp.task?.id ?? null,
          leadName: normalizeLeadTitle(followUp.lead?.title, followUp.lead?.customerName),
          contactPerson: normalizeContactPerson(followUp.company?.contactPerson || followUp.lead?.company?.contactPerson),
          phone: pickPhone(followUp.lead?.phone || followUp.company?.phone),
          method: "Follow-up",
          title: followUp.task?.title || followUp.nextDiscussionPlan || followUp.note || "Follow-up",
          dateTime: formatDisplayDate(completedAt),
          sortDate: completedAt.getTime(),
          sortDateValue: completedAt.toISOString(),
          status: "COMPLETED",
          note: latestNote,
          taskDetail,
          latestNote,
          stepNotes: [],
        });
      }

      for (const communication of communications) {
        const companyId = communication.companyId ?? communication.lead?.companyId ?? null;
        const taskDetail = formatTaskDetails(communication.task?.description);
        const latestNote = cleanText(communication.followUpNote) || cleanText(communication.note) || "-";
        merged.push({
          id: `communication-${communication.id}`,
          type: "Communication",
          customerOrCompany: communication.company?.name || communication.lead?.company?.name || communication.lead?.customerName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: communication.lead?.id ?? null,
          taskId: communication.taskId ?? communication.task?.id ?? null,
          leadName: normalizeLeadTitle(communication.lead?.title, communication.lead?.customerName),
          contactPerson: normalizeContactPerson(communication.company?.contactPerson || communication.lead?.company?.contactPerson),
          phone: pickPhone(communication.lead?.phone || communication.company?.phone),
          method: communication.method || "Communication",
          title: communication.task?.title || communication.discussionTopic || communication.productDiscussed || communication.followUpNote || "Communication",
          dateTime: formatDisplayDate(communication.communicationAt),
          sortDate: communication.communicationAt.getTime(),
          sortDateValue: communication.communicationAt.toISOString(),
          status: "COMPLETED",
          note: latestNote,
          taskDetail,
          latestNote,
          stepNotes: [],
        });
      }

      for (const quotation of quotations) {
        const companyId = quotation.companyId ?? quotation.lead?.companyId ?? null;
        merged.push({
          id: `quotation-${quotation.id}`,
          type: "Quotation",
          customerOrCompany: quotation.company?.name || quotation.lead?.company?.name || quotation.lead?.customerName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: quotation.leadId ?? quotation.lead?.id ?? null,
          taskId: null,
          leadName: normalizeLeadTitle(quotation.lead?.title, quotation.lead?.customerName),
          contactPerson: normalizeContactPerson(quotation.company?.contactPerson || quotation.lead?.company?.contactPerson),
          phone: pickPhone(quotation.lead?.phone || quotation.company?.phone),
          method: "Quotation",
          title: quotation.quoteNumber || "Quotation",
          dateTime: formatDisplayDate(quotation.createdAt),
          sortDate: quotation.createdAt.getTime(),
          sortDateValue: quotation.createdAt.toISOString(),
          status: quotation.status,
          note: quotation.notes || `Amount: ${quotation.totalAmount.toString()}`,
          taskDetail: "-",
          latestNote: quotation.notes || `Amount: ${quotation.totalAmount.toString()}`,
          stepNotes: [],
        });
      }

      for (const lead of sales) {
        merged.push({
          id: `sale-${lead.id}`,
          type: "Sales",
          customerOrCompany: lead.company?.name || lead.customerName,
          companyId: lead.companyId,
          companyHref: companyHrefFromId(lead.companyId),
          leadId: lead.id,
          taskId: null,
          leadName: normalizeLeadTitle(lead.title, lead.customerName),
          contactPerson: normalizeContactPerson(lead.company?.contactPerson),
          phone: pickPhone(lead.phone || lead.company?.phone),
          method: "Won Lead",
          title: normalizeLeadTitle(lead.title, lead.customerName),
          dateTime: formatDisplayDate(lead.updatedAt),
          sortDate: lead.updatedAt.getTime(),
          sortDateValue: lead.updatedAt.toISOString(),
          status: lead.status,
          note: lead.notes || "-",
          taskDetail: "-",
          latestNote: lead.notes || "-",
          stepNotes: [],
        });
      }

      rows = merged.sort((left, right) => right.sortDate - left.sortDate);
    }

    if (metric === "followUps" || metric === "overdueFollowUps") {
      const whereBase = {
        assignedToId: marketerId,
        followUpDate: { gte: window.from, lt: metric === "overdueFollowUps" ? overdueTo : window.to },
      };

      const followUps = await prisma.followUp.findMany({
        where: metric === "overdueFollowUps"
          ? { ...whereBase, status: { not: "COMPLETED" } }
          : whereBase,
        select: {
          id: true,
          companyId: true,
          method: true,
          note: true,
          nextDiscussionPlan: true,
          status: true,
          followUpDate: true,
          createdAt: true,
          taskId: true,
          lead: {
            select: {
              id: true,
              title: true,
              companyId: true,
              customerName: true,
              phone: true,
              company: { select: { name: true, contactPerson: true, phone: true } },
            },
          },
          company: { select: { name: true, contactPerson: true, phone: true } },
          task: { select: { id: true, title: true, description: true, notes: true } },
        },
        orderBy: { followUpDate: "desc" },
      });

      rows = followUps.map((followUp) => {
        const companyId = followUp.companyId ?? followUp.lead?.companyId ?? null;
        const taskDetail = formatTaskDetails(followUp.task?.description);
        const latestNote = cleanText(followUp.nextDiscussionPlan) || cleanText(followUp.note) || "-";

        return {
          id: followUp.id,
          type: "Follow-up",
          customerOrCompany: followUp.company?.name || followUp.lead?.company?.name || followUp.lead?.customerName || "Customer",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: followUp.lead?.id ?? null,
          taskId: followUp.taskId ?? followUp.task?.id ?? null,
          leadName: normalizeLeadTitle(followUp.lead?.title, followUp.lead?.customerName),
          contactPerson: normalizeContactPerson(followUp.company?.contactPerson || followUp.lead?.company?.contactPerson),
          phone: pickPhone(followUp.lead?.phone || followUp.company?.phone),
          method: followUp.method || "Follow-up",
          title: followUp.task?.title || followUp.nextDiscussionPlan || followUp.note || "Follow-up",
          dateTime: formatDisplayDate(followUp.followUpDate),
          sortDate: followUp.followUpDate.getTime(),
          sortDateValue: followUp.followUpDate.toISOString(),
          status: followUp.status,
          note: latestNote,
          taskDetail,
          latestNote,
          stepNotes: [],
        };
      });
    }

    if (metric === "pendingTasks") {
      const tasks = await prisma.task.findMany({
        where: {
          assignedToId: marketerId,
          status: { not: "COMPLETED" },
          dueDate: { gte: window.from, lt: window.to },
        },
        select: {
          id: true,
          companyId: true,
          title: true,
          description: true,
          notes: true,
          status: true,
          dueDate: true,
          updatedAt: true,
          leadName: true,
          companyName: true,
          company: { select: { name: true, contactPerson: true, phone: true } },
          lead: { select: { id: true, title: true, customerName: true, phone: true, companyId: true } },
        },
        orderBy: { dueDate: "desc" },
      });

      rows = tasks.map((task): DrilldownDetailRow => {
        const companyId = task.companyId ?? task.lead?.companyId ?? null;
        const taskDate = task.dueDate ?? task.updatedAt;
        const taskDetail = formatTaskDetails(task.description);
        const latestNote = cleanText(task.notes) || "-";

        return {
          id: task.id,
          type: "Task",
          customerOrCompany: task.company?.name || task.companyName || task.lead?.customerName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: task.lead?.id ?? null,
          taskId: task.id,
          leadName: task.leadName || task.lead?.title || "-",
          contactPerson: normalizeContactPerson(task.company?.contactPerson),
          phone: pickPhone(task.company?.phone || task.lead?.phone),
          method: "Task",
          title: task.title,
          dateTime: formatDisplayDate(taskDate),
          sortDate: taskDate.getTime(),
          sortDateValue: taskDate.toISOString(),
          status: task.status,
          note: formatTaskDetailAndNote(task.description, task.notes),
          taskDetail,
          latestNote,
          stepNotes: [],
        };
      }).sort((left, right) => right.sortDate - left.sortDate);
    }

    if (metric === "sales" || metric === "conversion") {
      const leads = await prisma.lead.findMany({
        where: {
          assignedToId: marketerId,
          status: "WON_SALE",
          updatedAt: { gte: window.from, lt: window.to },
        },
        select: {
          id: true,
          companyId: true,
          title: true,
          customerName: true,
          phone: true,
          status: true,
          notes: true,
          updatedAt: true,
          company: {
            select: {
              name: true,
              contactPerson: true,
              phone: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      rows = leads.map((lead) => ({
        id: lead.id,
        type: metric === "sales" ? "Sales" : "Conversion",
        customerOrCompany: lead.company?.name || lead.customerName,
        companyId: lead.companyId,
        companyHref: companyHrefFromId(lead.companyId),
        leadId: lead.id,
        taskId: null,
        leadName: normalizeLeadTitle(lead.title, lead.customerName),
        contactPerson: normalizeContactPerson(lead.company?.contactPerson),
        phone: pickPhone(lead.phone || lead.company?.phone),
        method: "Won Lead",
        title: normalizeLeadTitle(lead.title, lead.customerName),
        dateTime: formatDisplayDate(lead.updatedAt),
        sortDate: lead.updatedAt.getTime(),
        sortDateValue: lead.updatedAt.toISOString(),
        status: lead.status,
        note: lead.notes || "-",
        taskDetail: "-",
        latestNote: lead.notes || "-",
        stepNotes: [],
      }));
    }

    if (metric === "score") {
      rows = [];
    }

    if (metric === "calls" || metric === "whatsapp" || metric === "meetings") {
      const methodBuckets = withMethodBuckets(metric);

      const communications = await prisma.communicationLog.findMany({
        where: {
          userId: marketerId,
          communicationAt: { gte: window.from, lt: window.to },
          OR: methodBuckets.leadClause,
        },
        select: {
          id: true,
          companyId: true,
          method: true,
          note: true,
          discussionTopic: true,
          communicationAt: true,
          taskId: true,
          lead: {
            select: {
              id: true,
              title: true,
              companyId: true,
              customerName: true,
              phone: true,
              company: { select: { name: true, contactPerson: true, phone: true } },
            },
          },
          company: { select: { name: true, contactPerson: true, phone: true } },
          task: { select: { id: true, title: true, description: true, notes: true } },
          followUpNote: true,
          productDiscussed: true,
        },
        orderBy: { communicationAt: "desc" },
      });

      const merged: DrilldownDetailRow[] = [];

      for (const communication of communications) {
        const companyName = communication.company?.name || communication.lead?.company?.name || communication.lead?.customerName;
        const companyId = communication.companyId ?? communication.lead?.companyId ?? null;
        const taskDetail = formatTaskDetails(communication.task?.description);
        const latestNote = cleanText(communication.followUpNote) || cleanText(communication.note) || "-";
        merged.push({
          id: communication.id,
          type: "Communication",
          customerOrCompany: companyName || "Company",
          companyId,
          companyHref: companyHrefFromId(companyId),
          leadId: communication.lead?.id ?? null,
          taskId: communication.taskId ?? communication.task?.id ?? null,
          leadName: normalizeLeadTitle(communication.lead?.title, communication.lead?.customerName),
          contactPerson: normalizeContactPerson(communication.company?.contactPerson || communication.lead?.company?.contactPerson),
          phone: pickPhone(communication.lead?.phone || communication.company?.phone),
          method: communication.method || "Communication",
          title: communication.task?.title || communication.discussionTopic || communication.productDiscussed || communication.followUpNote || "Communication",
          dateTime: formatDisplayDate(communication.communicationAt),
          sortDate: communication.communicationAt.getTime(),
          sortDateValue: communication.communicationAt.toISOString(),
          status: "COMPLETED",
          note: latestNote,
          taskDetail,
          latestNote,
          stepNotes: [],
        });
      }

      rows = merged.sort((left, right) => right.sortDate - left.sortDate);
    }

    const taskStepNoteMap = await buildTaskStepNoteMap(prisma, rows.map((row) => row.taskId), formatDisplayDate);
    rows = rows.map((row) => {
      const stepNotes = row.taskId ? taskStepNoteMap.get(row.taskId) ?? [] : [];
      const latestStepNote = stepNotes.at(-1)?.note ?? "";
      const latestNote = cleanText(row.latestNote) || latestStepNote || "-";

      return {
        ...row,
        latestNote,
        note: row.note && row.note !== "-"
          ? row.note
          : (row.taskDetail && row.taskDetail !== "-"
            ? formatTaskDetailAndNote(row.taskDetail, latestNote === "-" ? "" : latestNote)
            : latestNote),
        stepNotes,
      };
    });

    count = rows.length;

    const labelByMetric: Record<MetricType, string> = {
      overview: "Activity Overview",
      leads: "Leads",
      calls: "Calls",
      whatsapp: "WhatsApp",
      meetings: "Meetings",
      followUps: "Follow-ups",
      pendingTasks: "Pending Tasks",
      overdueFollowUps: "Overdue Follow-ups",
      sales: "Sales",
      conversion: "Conversion",
      score: "Score",
    };

    return NextResponse.json({
      success: true,
      period: window.period,
      from: formatCrmDate(window.from, "yyyy-MM-dd"),
      to: formatCrmDate(new Date(window.to.getTime() - 1), "yyyy-MM-dd"),
      marketerId,
      metric: metricType,
      metricLabel: labelByMetric[metric],
      count,
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load team performance drill-down records.",
      },
      { status: 500 },
    );
  }
}

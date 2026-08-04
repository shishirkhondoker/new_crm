import "server-only";

import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import {
  FollowUpStatus,
  LeadStatus,
  Priority,
  TaskStatus,
} from "@prisma/client";
import type * as PrismaTypes from "@prisma/client";
import { getMarketerScopeUserIds } from "@/lib/customer-ownership";
import { formatCrmDate, getCrmPeriodWindow, startOfCrmDay } from "@/lib/crm-time";
import { getPrisma } from "@/lib/prisma";
import {
  getReportDefinition,
  type ReportDatePreset,
  type ReportFormat,
  type ReportTypeKey,
} from "@/lib/report-definitions";
import { summarizeCommunicationReport } from "@/lib/communication-report-summary";
import type { Role } from "@/lib/utils";

type JsonObject = Record<string, unknown>;

type ReportActor = {
  id: string;
  role: Role;
  name: string;
};

export type ReportFilters = {
  datePreset?: ReportDatePreset;
  from?: string;
  to?: string;
  userId?: string;
  customerId?: string;
  communicationType?: string;
  leadStatus?: string;
  followUpStatus?: string;
  taskStatus?: string;
  productId?: string;
};

type ReportDocument = {
  title: string;
  slug: string;
  companyTitle: string;
  generatedAt: Date;
  generatedBy: string;
  filters: Array<{ label: string; value: string }>;
  columns: string[];
  rows: string[][];
};

type ReportExportResult = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  rowCount: number;
  reportTitle: string;
};

const SUPPORTED_REPORT_LOG_TYPES = new Set([
  "CUSTOMER_COMMUNICATION",
  "FOLLOW_UP",
  "EMPLOYEE_PERFORMANCE",
  "SALES",
  "REWARD",
  "LEAD_CONVERSION",
]);
const PDF_PAGE_WIDTH = 841.89;
const PDF_PAGE_HEIGHT = 595.28;
const PDF_MARGIN = 36;
const PDF_TABLE_CELL_PADDING_X = 8;
const PDF_TABLE_CELL_PADDING_Y = 6;
const PDF_BODY_FONT_SIZE = 9;
const PDF_HEADER_FONT_SIZE = 9.5;
const PDF_TITLE_FONT_SIZE = 18;
const PDF_META_FONT_SIZE = 10;
const PDF_LINE_HEIGHT = 11;
const PDF_TABLE_HEADER_HEIGHT = 28;
const PDF_MAX_CELL_LINES = 8;
const PDF_CUSTOMER_COMMUNICATION_COLUMN_WIDTHS = [0.13, 0.19, 0.14, 0.1, 0.08, 0.19, 0.09, 0.08];
const REPORT_PDF_FONT_CANDIDATES = [
  path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "fonts", "Nirmala.ttf"),
  path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "fonts", "NotoSansBengali-Regular.ttf"),
  path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "fonts", "NotoSerifBengali-Regular.ttf"),
  "C:\\Windows\\Fonts\\Nirmala.ttf",
  "C:\\Windows\\Fonts\\kalpurush.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSerifBengali-Regular.ttf",
];

const nodeRequire = createRequire(import.meta.url);

let reportPdfFontBytesPromise: Promise<Uint8Array | null> | null = null;
let reportPdfFontkitPromise: Promise<unknown | null> | null = null;

async function loadReportPdfFontkit() {
  if (!reportPdfFontkitPromise) {
    reportPdfFontkitPromise = (async () => {
      try {
        const loaded = nodeRequire("@pdf-lib/fontkit");
        return loaded?.default ?? loaded ?? null;
      } catch {
        return null;
      }
    })();
  }

  return reportPdfFontkitPromise;
}

function stringify(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "toNumber" in (value as Record<string, unknown>) && typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return String((value as { toNumber: () => number }).toNumber());
  }
  return String(value);
}

function labelize(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function communicationTypeLabel(value?: string) {
  if (!value) return "-";
  if (value === "WHATSAPP") return "WhatsApp";
  if (value === "CALL") return "Call";
  if (value === "EMAIL") return "Email";
  if (value === "MEETING") return "Meeting";
  return labelize(value);
}

function escapeCsvValue(value: unknown) {
  const normalized = stringify(value).replace(/"/g, "\"\"");
  return `"${normalized}"`;
}

function clampPdfLines(
  lines: string[],
  maxLines: number,
  measure: (value: string) => number,
  maxWidth: number,
) {
  if (lines.length <= maxLines) return lines;

  const trimmed = lines.slice(0, maxLines);
  let lastLine = trimmed[maxLines - 1] ?? "";
  while (lastLine && measure(`${lastLine}...`) > maxWidth) {
    lastLine = Array.from(lastLine).slice(0, -1).join("");
  }
  trimmed[maxLines - 1] = lastLine ? `${lastLine}...` : "...";
  return trimmed;
}

function wrapPdfText(
  value: string,
  measure: (text: string) => number,
  maxWidth: number,
) {
  const normalized = value.replace(/\r/g, "");
  const paragraphs = normalized.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let currentLine = "";

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (measure(nextLine) <= maxWidth) {
        currentLine = nextLine;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      if (measure(word) <= maxWidth) {
        currentLine = word;
        continue;
      }

      let chunk = "";
      for (const character of Array.from(word)) {
        const nextChunk = `${chunk}${character}`;
        if (measure(nextChunk) <= maxWidth) {
          chunk = nextChunk;
          continue;
        }

        if (chunk) {
          lines.push(chunk);
        }
        chunk = character;
      }
      currentLine = chunk;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length ? lines : [""];
}

async function loadReportPdfFontBytes() {
  if (!reportPdfFontBytesPromise) {
    reportPdfFontBytesPromise = (async () => {
      for (const candidate of REPORT_PDF_FONT_CANDIDATES) {
        try {
          await access(candidate);
          return new Uint8Array(await readFile(candidate));
        } catch {
          continue;
        }
      }
      return null;
    })();
  }

  return reportPdfFontBytesPromise;
}

function buildDateRange(filters: ReportFilters) {
  const preset = filters.datePreset ?? "month";
  const range = getCrmPeriodWindow(new Date(), {
    period: preset === "custom" ? "custom" : preset,
    from: filters.from,
    to: filters.to,
  });

  return {
    from: range.from,
    to: new Date(range.to.getTime() - 1),
  };
}

function withinRange(dateField: string, range: { from: Date | null; to: Date | null }) {
  if (!range.from && !range.to) return undefined;

  const condition: Record<string, Date> = {};
  if (range.from) condition.gte = range.from;
  if (range.to) condition.lte = range.to;
  return { [dateField]: condition };
}

async function getScopedUserIds(prisma: ReturnType<typeof getPrisma>, actor: ReportActor) {
  return getMarketerScopeUserIds(prisma, actor);
}

async function getCompanyTitle(prisma: ReturnType<typeof getPrisma>) {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "company.profile" },
    select: { value: true },
  });

  const rawValue = setting?.value as JsonObject | null | undefined;
  return typeof rawValue?.company === "string" && rawValue.company.trim() ? rawValue.company.trim() : "Mugnee CRM";
}

async function resolveFilterLabels(
  prisma: ReturnType<typeof getPrisma>,
  filters: ReportFilters,
) {
  const labels: Array<{ label: string; value: string }> = [];
  const range = buildDateRange(filters);

  labels.push({
    label: "Date Range",
    value:
      filters.datePreset === "custom"
        ? `${range.from ? formatCrmDate(range.from, "dd MMM yyyy") : "-"} to ${range.to ? formatCrmDate(range.to, "dd MMM yyyy") : "-"}`
        : labelize(filters.datePreset ?? "month"),
  });

  if (filters.userId) {
    const user = await prisma.user.findUnique({ where: { id: filters.userId }, select: { name: true } });
    labels.push({ label: "Employee", value: user?.name ?? filters.userId });
  }

  if (filters.customerId) {
    const customer = await prisma.customerCompany.findUnique({ where: { id: filters.customerId }, select: { name: true } });
    labels.push({ label: "Customer", value: customer?.name ?? filters.customerId });
  }

  if (filters.productId) {
    const product = await prisma.productService.findUnique({ where: { id: filters.productId }, select: { name: true } });
    labels.push({ label: "Product", value: product?.name ?? filters.productId });
  }

  if (filters.communicationType) labels.push({ label: "Communication Type", value: communicationTypeLabel(filters.communicationType) });
  if (filters.leadStatus) labels.push({ label: "Lead Status", value: labelize(filters.leadStatus) });
  if (filters.followUpStatus) labels.push({ label: "Follow-up Status", value: labelize(filters.followUpStatus) });
  if (filters.taskStatus) labels.push({ label: "Task Status", value: labelize(filters.taskStatus) });

  return labels;
}

function priorityLabel(priority: Priority | null | undefined) {
  if (!priority) return "-";
  if (priority === "URGENT") return "Important";
  return labelize(priority);
}

function dateLabel(value: Date | null | undefined, pattern = "dd MMM yyyy hh:mm a") {
  return value ? formatCrmDate(value, pattern as Parameters<typeof formatCrmDate>[1]) : "-";
}

function jsonDetail(value: PrismaTypes.Prisma.JsonValue | null | undefined) {
  if (!value) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function reportDocumentBase(
  reportType: ReportTypeKey,
  actor: ReportActor,
  companyTitle: string,
  filters: Array<{ label: string; value: string }>,
  columns: string[],
  rows: string[][],
): ReportDocument {
  const definition = getReportDefinition(reportType);
  if (!definition) {
    throw new Error("Unsupported report type.");
  }

  return {
    title: definition.title,
    slug: definition.slug,
    companyTitle,
    generatedAt: new Date(),
    generatedBy: actor.name,
    filters,
    columns,
    rows,
  };
}

async function buildCustomerCommunicationReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const productName = filters.productId
    ? (await prisma.productService.findUnique({ where: { id: filters.productId }, select: { name: true } }))?.name ?? null
    : null;
  const communicationTypeFilter =
    filters.communicationType === "CALL"
      ? {
          OR: [
            { method: { contains: "phone", mode: "insensitive" as const } },
            { method: { contains: "call", mode: "insensitive" as const } },
          ],
        }
      : filters.communicationType === "WHATSAPP"
        ? { method: { contains: "whatsapp", mode: "insensitive" as const } }
        : filters.communicationType === "EMAIL"
          ? { method: { contains: "email", mode: "insensitive" as const } }
          : filters.communicationType === "MEETING"
            ? { method: { contains: "meeting", mode: "insensitive" as const } }
            : {};

  const where: PrismaTypes.Prisma.CommunicationLogWhereInput = {
    AND: [
      withinRange("communicationAt", range) ?? {},
      scopedUserIds ? { userId: { in: scopedUserIds } } : {},
      filters.userId ? { userId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      communicationTypeFilter,
      filters.productId
        ? {
            OR: [
              { task: { is: { productId: filters.productId } } },
              { lead: { is: { productInterestId: filters.productId } } },
              ...(productName ? [{ productDiscussed: { contains: productName, mode: "insensitive" as const } }] : []),
            ],
          }
        : {},
      filters.leadStatus ? { lead: { is: { status: filters.leadStatus as LeadStatus } } } : {},
    ],
  };

  const rows = await prisma.communicationLog.findMany({
    where,
    include: {
      company: { select: { name: true } },
      lead: { select: { title: true, customerName: true } },
      user: { select: { name: true } },
    },
    orderBy: { communicationAt: "desc" },
  });

  const groupedRows = summarizeCommunicationReport(
    rows.map((row) => ({
      id: row.id,
      customerKey: row.companyId ?? row.company?.name ?? row.lead?.customerName ?? row.leadId ?? row.id,
      customerName: row.company?.name ?? row.lead?.customerName ?? "-",
      marketerName: row.user?.name ?? "-",
      occurredAt: row.communicationAt,
      method: row.method,
      note: row.note,
      outcome: row.outcome,
      nextFollowUpAt: row.nextFollowUpDate,
    })),
  );

  const filterLabels = await resolveFilterLabels(prisma, filters);
  filterLabels.push({ label: "Counting Mode", value: "Unique companies reached" });

  return reportDocumentBase(
    "CUSTOMER_COMMUNICATION",
    actor,
    companyTitle,
    filterLabels,
    ["Last Contact", "Customer / Company", "Marketer", "Latest Method", "Follow-up Count", "Latest Note", "Outcome", "Next Follow-up"],
    groupedRows.map((row) => [
      dateLabel(row.latestContactAt),
      row.customerName,
      row.marketerNames.join(", ") || "-",
      row.latestMethod,
      String(row.followUpCount),
      row.latestNote,
      row.latestOutcome,
      dateLabel(row.nextFollowUpAt),
    ]),
  );
}

async function buildFollowUpReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.FollowUpWhereInput = {
    AND: [
      withinRange("followUpDate", range) ?? {},
      scopedUserIds ? { assignedToId: { in: scopedUserIds } } : {},
      filters.userId ? { assignedToId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.followUpStatus ? { status: filters.followUpStatus as FollowUpStatus } : {},
      filters.productId
        ? {
            OR: [
              { task: { is: { productId: filters.productId } } },
              { lead: { is: { productInterestId: filters.productId } } },
            ],
          }
        : {},
      filters.leadStatus ? { lead: { is: { status: filters.leadStatus as LeadStatus } } } : {},
    ],
  };

  const rows = await prisma.followUp.findMany({
    where,
    include: {
      company: { select: { name: true } },
      lead: { select: { title: true, customerName: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { followUpDate: "asc" },
  });

  return reportDocumentBase(
    "FOLLOW_UP",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Follow-up Date", "Customer / Company", "Lead", "Assigned To", "Method", "Priority", "Status", "Note", "Next Action"],
    rows.map((row) => [
      dateLabel(row.followUpDate),
      row.company?.name ?? row.lead?.customerName ?? "-",
      row.lead?.title ?? "-",
      row.assignedTo?.name ?? "-",
      row.method,
      priorityLabel(row.priority),
      labelize(row.status),
      row.note ?? "-",
      row.nextDiscussionPlan ?? "-",
    ]),
  );
}

async function buildTaskReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const taskScope: PrismaTypes.Prisma.TaskWhereInput =
    actor.role === "ADMIN"
      ? {}
      : actor.role === "MARKETER"
        ? { assignedToId: actor.id }
        : {
            OR: [
              { assignedToId: { in: scopedUserIds ?? [actor.id] } },
              { assignedById: actor.id },
            ],
          };

  const where: PrismaTypes.Prisma.TaskWhereInput = {
    AND: [
      taskScope,
      withinRange("taskDate", range) ?? {},
      filters.userId ? { assignedToId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.taskStatus ? { status: filters.taskStatus as TaskStatus } : {},
      filters.productId ? { productId: filters.productId } : {},
    ],
  };

  const rows = await prisma.task.findMany({
    where,
    include: {
      company: { select: { name: true } },
      assignedTo: { select: { name: true } },
      assignedBy: { select: { name: true } },
      product: { select: { name: true } },
    },
    orderBy: [{ taskDate: "asc" }, { taskTime: "asc" }],
  });

  return reportDocumentBase(
    "TASK",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Due Date", "Company", "Task Title", "Assigned To", "Assigned By", "Priority", "Status", "Product", "Details"],
    rows.map((row) => [
      dateLabel(row.taskTime ?? row.taskDate),
      row.company?.name ?? row.companyName ?? "-",
      row.title,
      row.assignedTo.name,
      row.assignedBy.name,
      priorityLabel(row.priority),
      labelize(row.status),
      row.product?.name ?? "-",
      row.description ?? row.notes ?? "-",
    ]),
  );
}

async function buildEmployeePerformanceReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const userWhere: PrismaTypes.Prisma.UserWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { id: { in: scopedUserIds ?? [actor.id] } },
      filters.userId ? { id: filters.userId } : {},
      { status: "ACTIVE" },
    ],
  };

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, role: true, designation: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    users.map(async (user) => {
      const [leadCount, callCount, whatsappCount, meetingCount, followUpCount, pendingTaskCount, overdueFollowUpCount, salesCount] = await Promise.all([
        prisma.lead.count({
          where: {
            assignedToId: user.id,
            ...(withinRange("createdAt", range) ?? {}),
            ...(filters.customerId ? { companyId: filters.customerId } : {}),
            ...(filters.productId ? { productInterestId: filters.productId } : {}),
            ...(filters.leadStatus ? { status: filters.leadStatus as LeadStatus } : {}),
          },
        }),
        prisma.communicationLog.count({
          where: {
            userId: user.id,
            ...(withinRange("communicationAt", range) ?? {}),
            method: { in: ["Phone", "Phone Call", "Call"] },
          },
        }),
        prisma.communicationLog.count({
          where: {
            userId: user.id,
            ...(withinRange("communicationAt", range) ?? {}),
            method: { contains: "whatsapp", mode: "insensitive" },
          },
        }),
        prisma.communicationLog.count({
          where: {
            userId: user.id,
            ...(withinRange("communicationAt", range) ?? {}),
            method: { contains: "meeting", mode: "insensitive" },
          },
        }),
        prisma.followUp.count({
          where: {
            assignedToId: user.id,
            ...(withinRange("followUpDate", range) ?? {}),
          },
        }),
        prisma.task.count({
          where: {
            assignedToId: user.id,
            status: { not: "COMPLETED" },
            ...(withinRange("taskDate", range) ?? {}),
          },
        }),
        prisma.followUp.count({
          where: {
            assignedToId: user.id,
            status: { not: "COMPLETED" },
            followUpDate: { lt: startOfCrmDay(new Date()) },
          },
        }),
        prisma.quotation.count({
          where: {
            OR: [
              { createdById: user.id },
              { lead: { is: { assignedToId: user.id } } },
            ],
            status: "CONVERTED_TO_SALE",
            ...(withinRange("createdAt", range) ?? {}),
          },
        }),
      ]);

      const conversion = leadCount ? `${Math.round((salesCount / leadCount) * 100)}%` : "0%";
      return [
        user.name,
        labelize(user.role),
        String(leadCount),
        String(callCount),
        String(whatsappCount),
        String(meetingCount),
        String(followUpCount),
        String(pendingTaskCount),
        String(overdueFollowUpCount),
        String(salesCount),
        conversion,
      ];
    }),
  );

  return reportDocumentBase(
    "EMPLOYEE_PERFORMANCE",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Employee", "Role", "Leads", "Calls", "WhatsApp", "Meetings", "Follow-ups", "Pending Tasks", "Overdue Follow-ups", "Sales", "Conversion"],
    rows,
  );
}

async function buildLeadConversionReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.LeadWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { assignedToId: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { assignedToId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.leadStatus ? { status: filters.leadStatus as LeadStatus } : {},
      filters.productId ? { productInterestId: filters.productId } : {},
    ],
  };

  const rows = await prisma.lead.findMany({
    where,
    include: {
      company: { select: { name: true } },
      assignedTo: { select: { name: true } },
      interestedProduct: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "LEAD_CONVERSION",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Created At", "Lead", "Customer", "Company", "Product Interest", "Status", "Lead Score", "Probability", "Assigned To", "Follow-up Date"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.title,
      row.customerName,
      row.company?.name ?? "-",
      row.interestedProduct?.name ?? "-",
      labelize(row.status),
      String(row.score),
      `${row.purchaseProbability}%`,
      row.assignedTo?.name ?? "-",
      dateLabel(row.followUpDate),
    ]),
  );
}

async function buildSalesReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.QuotationWhereInput = {
    AND: [
      actor.role === "ADMIN"
        ? {}
        : {
            OR: [
              { createdById: { in: scopedUserIds ?? [actor.id] } },
              { lead: { is: { assignedToId: { in: scopedUserIds ?? [actor.id] } } } },
            ],
          },
      withinRange("createdAt", range) ?? {},
      filters.userId
        ? {
            OR: [
              { createdById: filters.userId },
              { lead: { is: { assignedToId: filters.userId } } },
            ],
          }
        : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.productId ? { items: { some: { productId: filters.productId } } } : {},
      filters.leadStatus ? { lead: { is: { status: filters.leadStatus as LeadStatus } } } : {},
    ],
  };

  const rows = await prisma.quotation.findMany({
    where,
    include: {
      company: { select: { name: true } },
      lead: { select: { title: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "SALES",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Quote Date", "Quote No", "Customer", "Lead", "Created By", "Status", "Subtotal", "Discount", "Total", "Valid Until"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.quoteNumber,
      row.company?.name ?? "-",
      row.lead?.title ?? "-",
      row.createdBy?.name ?? "-",
      labelize(row.status),
      stringify(row.subtotal),
      stringify(row.discount),
      stringify(row.totalAmount),
      dateLabel(row.validUntil, "dd MMM yyyy"),
    ]),
  );
}

async function buildQuotationReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.QuotationWhereInput = {
    AND: [
      actor.role === "ADMIN"
        ? {}
        : {
            OR: [
              { createdById: { in: scopedUserIds ?? [actor.id] } },
              { lead: { is: { assignedToId: { in: scopedUserIds ?? [actor.id] } } } },
            ],
          },
      withinRange("createdAt", range) ?? {},
      filters.userId
        ? {
            OR: [
              { createdById: filters.userId },
              { lead: { is: { assignedToId: filters.userId } } },
            ],
          }
        : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.productId ? { items: { some: { productId: filters.productId } } } : {},
    ],
  };

  const rows = await prisma.quotation.findMany({
    where,
    include: {
      company: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "QUOTATION",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Quote Date", "Quote No", "Customer", "Created By", "Status", "Products", "Items", "Total"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.quoteNumber,
      row.company?.name ?? "-",
      row.createdBy?.name ?? "-",
      labelize(row.status),
      row.items.map((item) => item.product?.name ?? item.description).filter(Boolean).join(", ") || "-",
      String(row.items.length),
      stringify(row.totalAmount),
    ]),
  );
}

async function buildProductInterestReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.ProductInterestWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { userId: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { userId: filters.userId } : {},
      filters.customerId ? { companyId: filters.customerId } : {},
      filters.productId ? { productId: filters.productId } : {},
      filters.leadStatus ? { lead: { is: { status: filters.leadStatus as LeadStatus } } } : {},
    ],
  };

  const rows = await prisma.productInterest.findMany({
    where,
    include: {
      product: { select: { name: true } },
      company: { select: { name: true } },
      lead: { select: { title: true, status: true, customerName: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "PRODUCT_INTEREST",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Created At", "Product", "Customer / Company", "Lead", "Assigned User", "Score", "Lead Status"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.product.name,
      row.company?.name ?? row.lead?.customerName ?? "-",
      row.lead?.title ?? "-",
      row.user?.name ?? "-",
      String(row.score),
      row.lead?.status ? labelize(row.lead.status) : "-",
    ]),
  );
}

async function buildCustomerGrowthReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const visibilityWhere: PrismaTypes.Prisma.CustomerCompanyWhereInput =
    actor.role === "ADMIN"
      ? {}
      : {
          OR: [
            { assignedToId: { in: scopedUserIds ?? [actor.id] } },
            { leads: { some: { assignedToId: { in: scopedUserIds ?? [actor.id] } } } },
            { followUps: { some: { assignedToId: { in: scopedUserIds ?? [actor.id] } } } },
            { communications: { some: { userId: { in: scopedUserIds ?? [actor.id] } } } },
          ],
        };

  const where: PrismaTypes.Prisma.CustomerCompanyWhereInput = {
    AND: [
      visibilityWhere,
      withinRange("createdAt", range) ?? {},
      filters.customerId ? { id: filters.customerId } : {},
      filters.userId ? { assignedToId: filters.userId } : {},
    ],
  };

  const rows = await prisma.customerCompany.findMany({
    where,
    include: {
      assignedTo: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "CUSTOMER_GROWTH",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Created At", "Company Name", "Industry", "City / Zilla", "Address", "Assigned To", "Total Leads", "Last Communication"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.name,
      row.industry || "-",
      row.city || "-",
      row.address || "-",
      row.assignedTo?.name ?? "-",
      String(row.totalLeads),
      dateLabel(row.lastCommunication),
    ]),
  );
}

async function buildRewardReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.RewardHistoryWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { userId: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { userId: filters.userId } : {},
    ],
  };

  const rows = await prisma.rewardHistory.findMany({
    where,
    include: {
      user: { select: { name: true } },
      rule: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "REWARD",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Date", "Employee", "Points", "Rule", "Source", "Reason", "Entity", "Entity Id"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.user.name,
      String(row.points),
      row.rule?.name ?? "-",
      row.source,
      row.reason,
      row.entity ?? "-",
      row.entityId ?? "-",
    ]),
  );
}

async function buildDailyWorkSummaryReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const users = await prisma.user.findMany({
    where: {
      AND: [
        actor.role === "ADMIN" ? {} : { id: { in: scopedUserIds ?? [actor.id] } },
        filters.userId ? { id: filters.userId } : {},
        { status: "ACTIVE" },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    users.map(async (user) => {
      const [tasksCompleted, dueFollowUps, communications, leadsAdded, rewardsEarned] = await Promise.all([
        prisma.task.count({
          where: {
            assignedToId: user.id,
            status: "COMPLETED",
            ...(withinRange("completedAt", range) ?? {}),
          },
        }),
        prisma.followUp.count({
          where: {
            assignedToId: user.id,
            ...(withinRange("followUpDate", range) ?? {}),
          },
        }),
        prisma.communicationLog.count({
          where: {
            userId: user.id,
            ...(withinRange("communicationAt", range) ?? {}),
          },
        }),
        prisma.lead.count({
          where: {
            assignedToId: user.id,
            ...(withinRange("createdAt", range) ?? {}),
          },
        }),
        prisma.rewardHistory.aggregate({
          where: {
            userId: user.id,
            ...(withinRange("createdAt", range) ?? {}),
          },
          _sum: { points: true },
        }),
      ]);

      return [
        user.name,
        filters.datePreset === "custom"
          ? `${range.from ? formatCrmDate(range.from, "dd MMM yyyy") : "-"} to ${range.to ? formatCrmDate(range.to, "dd MMM yyyy") : "-"}`
          : labelize(filters.datePreset ?? "month"),
        String(tasksCompleted),
        String(dueFollowUps),
        String(communications),
        String(leadsAdded),
        String(rewardsEarned._sum.points ?? 0),
      ];
    }),
  );

  return reportDocumentBase(
    "DAILY_WORK_SUMMARY",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Employee", "Period", "Tasks Completed", "Follow-ups", "Communications", "Leads Added", "Reward Points"],
    rows,
  );
}

async function buildActivityLogReport(
  prisma: ReturnType<typeof getPrisma>,
  actor: ReportActor,
  filters: ReportFilters,
  companyTitle: string,
  scopedUserIds?: string[],
) {
  const range = buildDateRange(filters);
  const where: PrismaTypes.Prisma.ActivityLogWhereInput = {
    AND: [
      actor.role === "ADMIN" ? {} : { userId: { in: scopedUserIds ?? [actor.id] } },
      withinRange("createdAt", range) ?? {},
      filters.userId ? { userId: filters.userId } : {},
    ],
  };

  const rows = await prisma.activityLog.findMany({
    where,
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return reportDocumentBase(
    "ACTIVITY_LOG",
    actor,
    companyTitle,
    await resolveFilterLabels(prisma, filters),
    ["Date", "User", "Action", "Entity", "Entity Id", "Metadata"],
    rows.map((row) => [
      dateLabel(row.createdAt),
      row.user?.name ?? "-",
      row.action,
      row.entity,
      row.entityId ?? "-",
      jsonDetail(row.metadata),
    ]),
  );
}

export async function buildReportDocument(actor: ReportActor, reportType: ReportTypeKey, filters: ReportFilters) {
  const prisma = getPrisma();
  const scopedUserIds = await getScopedUserIds(prisma, actor);
  const companyTitle = await getCompanyTitle(prisma);

  switch (reportType) {
    case "CUSTOMER_COMMUNICATION":
      return buildCustomerCommunicationReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "FOLLOW_UP":
      return buildFollowUpReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "TASK":
      return buildTaskReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "EMPLOYEE_PERFORMANCE":
      return buildEmployeePerformanceReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "LEAD_CONVERSION":
      return buildLeadConversionReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "SALES":
      return buildSalesReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "QUOTATION":
      return buildQuotationReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "PRODUCT_INTEREST":
      return buildProductInterestReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "CUSTOMER_GROWTH":
      return buildCustomerGrowthReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "REWARD":
      return buildRewardReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "DAILY_WORK_SUMMARY":
      return buildDailyWorkSummaryReport(prisma, actor, filters, companyTitle, scopedUserIds);
    case "ACTIVITY_LOG":
      return buildActivityLogReport(prisma, actor, filters, companyTitle, scopedUserIds);
    default:
      throw new Error("Unsupported report type.");
  }
}

function metadataRows(document: ReportDocument) {
  return [
    [document.companyTitle],
    [document.title],
    [`Generated: ${formatCrmDate(document.generatedAt, "dd MMM yyyy hh:mm a")}`],
    [`Generated By: ${document.generatedBy}`],
    ...document.filters.map((item) => [`${item.label}: ${item.value}`]),
    [""],
  ];
}

function buildCsvBuffer(document: ReportDocument) {
  const lines = [
    ...metadataRows(document).map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")),
    document.columns.map((header) => escapeCsvValue(header)).join(","),
    ...document.rows.map((row) => row.map((cell) => escapeCsvValue(cell)).join(",")),
  ];

  return Buffer.from(`\uFEFF${lines.join("\n")}`, "utf8");
}

function buildWorkbookBuffer(document: ReportDocument) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ...metadataRows(document),
    document.columns,
    ...document.rows,
  ]);

  XLSX.utils.book_append_sheet(workbook, sheet, "Report");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function buildPrintHtml(document: ReportDocument) {
  const filterMarkup = document.filters
    .map((item) => `<li><strong>${item.label}:</strong> ${item.value}</li>`)
    .join("");
  const headerCells = document.columns.map((column) => `<th>${column}</th>`).join("");
  const bodyRows = document.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell || "-"}</td>`).join("")}</tr>`)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${document.title}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: "Segoe UI", "Nirmala UI", Arial, sans-serif; background: #eef4ff; color: #0f172a; margin: 0; padding: 24px; }
      .page { max-width: 1400px; margin: 0 auto; }
      .hero { border: 1px solid #cbd5e1; border-radius: 18px; background: linear-gradient(135deg, #eff6ff, #ffffff); padding: 20px 24px; }
      h1 { font-size: 14px; margin: 0; color: #475569; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      h2 { font-size: 28px; margin: 8px 0 12px; color: #0f172a; line-height: 1.15; }
      .meta { display: flex; flex-wrap: wrap; gap: 12px 18px; margin: 0; font-size: 13px; color: #334155; }
      .meta strong { color: #0f172a; }
      ul { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 18px 0 0; padding: 0; }
      li { border: 1px solid #bfdbfe; border-radius: 999px; background: rgba(255,255,255,0.95); padding: 7px 12px; font-size: 12px; color: #1e3a8a; }
      .table-shell { margin-top: 18px; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 18px; background: #ffffff; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 9px 10px; text-align: left; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }
      th { background: #dbeafe; color: #0f172a; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
      tr:nth-child(even) td { background: #f8fafc; }
      .empty { margin-top: 24px; padding: 18px; border: 1px dashed #cbd5e1; border-radius: 18px; background: #f8fafc; font-weight: 600; }
      @media print {
        body { padding: 0; background: #ffffff; }
        .page { max-width: none; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="hero">
        <h1>${document.companyTitle}</h1>
        <h2>${document.title}</h2>
        <p class="meta">
          <span><strong>Generated:</strong> ${formatCrmDate(document.generatedAt, "dd MMM yyyy hh:mm a")}</span>
          <span><strong>Generated By:</strong> ${document.generatedBy}</span>
        </p>
        <ul>${filterMarkup}</ul>
      </section>
      ${
        document.rows.length
          ? `<div class="table-shell"><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`
          : `<div class="empty">No data found for selected filters.</div>`
      }
    </div>
    <script>window.onload = () => window.print();</script>
  </body>
</html>`;
}

async function buildPdfBufferWithStrategy(document: ReportDocument, preferUnicodeFont: boolean) {
  const pdfDocument = await PDFDocument.create();
  const embeddedFontBytes = preferUnicodeFont ? await loadReportPdfFontBytes() : null;
  const fontkit = embeddedFontBytes ? await loadReportPdfFontkit() : null;
  const supportsUnicodePdf = Boolean(embeddedFontBytes && fontkit);
  if (fontkit) {
    pdfDocument.registerFontkit(fontkit as never);
  }
  const bodyFont = supportsUnicodePdf
    ? await pdfDocument.embedFont(embeddedFontBytes as Uint8Array, { subset: true })
    : await pdfDocument.embedFont(StandardFonts.Helvetica);
  const normalizePdfValue = (value: string) => (
    supportsUnicodePdf
      ? value
      : value.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?")
  );

  const pageSize: [number, number] = [PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT];
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const tableWidth = contentWidth - 36;
  const columnWidths =
    document.columns.length === PDF_CUSTOMER_COMMUNICATION_COLUMN_WIDTHS.length
      ? PDF_CUSTOMER_COMMUNICATION_COLUMN_WIDTHS.map((ratio) => ratio * tableWidth)
      : document.columns.map(() => tableWidth / document.columns.length);
  const textMeasure = (value: string, fontSize: number) => bodyFont.widthOfTextAtSize(normalizePdfValue(value), fontSize);
  const filterSummary = document.filters.map((item) => `${item.label}: ${item.value}`).join(" | ");

  const preparedRows = document.rows.map((row) => {
    const values = document.columns.map((_, index) => {
      const cell = row[index];
      return normalizePdfValue(cell && cell.trim() ? cell.trim() : "-");
    });
    const wrappedCells = values.map((value, index) => {
      const usableWidth = Math.max(columnWidths[index] - PDF_TABLE_CELL_PADDING_X * 2, 24);
      const wrapped = wrapPdfText(value, (text) => textMeasure(text, PDF_BODY_FONT_SIZE), usableWidth);
      return clampPdfLines(
        wrapped,
        PDF_MAX_CELL_LINES,
        (text) => textMeasure(text, PDF_BODY_FONT_SIZE),
        usableWidth,
      );
    });
    const maxLineCount = Math.max(...wrappedCells.map((cell) => Math.max(cell.length, 1)));

    return {
      wrappedCells,
      height: Math.max(
        maxLineCount * PDF_LINE_HEIGHT + PDF_TABLE_CELL_PADDING_Y * 2,
        PDF_TABLE_HEADER_HEIGHT,
      ),
    };
  });

  let rowIndex = 0;
  const hasPreparedRows = preparedRows.length > 0;

  while (hasPreparedRows ? rowIndex < preparedRows.length : rowIndex === 0) {
    const page = pdfDocument.addPage(pageSize);

    let cursorY = PDF_PAGE_HEIGHT - PDF_MARGIN;
    page.drawRectangle({
      x: PDF_MARGIN,
      y: PDF_MARGIN,
      width: contentWidth,
      height: PDF_PAGE_HEIGHT - PDF_MARGIN * 2,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.87, 0.9, 0.96),
      borderWidth: 1,
    });

    page.drawText(normalizePdfValue(document.companyTitle), {
      x: PDF_MARGIN + 18,
      y: cursorY - 2,
      size: PDF_META_FONT_SIZE,
      font: bodyFont,
      color: rgb(0.32, 0.39, 0.5),
    });
    cursorY -= 24;

    page.drawText(normalizePdfValue(document.title), {
      x: PDF_MARGIN + 18,
      y: cursorY,
      size: PDF_TITLE_FONT_SIZE,
      font: bodyFont,
      color: rgb(0.06, 0.09, 0.16),
    });
    cursorY -= 24;

    page.drawText(normalizePdfValue(`Generated: ${formatCrmDate(document.generatedAt, "dd MMM yyyy hh:mm a")}   Generated By: ${document.generatedBy}`), {
      x: PDF_MARGIN + 18,
      y: cursorY,
      size: PDF_META_FONT_SIZE,
      font: bodyFont,
      color: rgb(0.2, 0.27, 0.36),
    });
    cursorY -= 18;

    const wrappedFilters = filterSummary
      ? wrapPdfText(
          normalizePdfValue(`Filters: ${filterSummary}`),
          (text) => textMeasure(text, PDF_META_FONT_SIZE),
          contentWidth - 36,
        )
      : [normalizePdfValue("Filters: Default")];

    for (const line of wrappedFilters) {
      page.drawText(line, {
        x: PDF_MARGIN + 18,
        y: cursorY,
        size: PDF_META_FONT_SIZE,
        font: bodyFont,
        color: rgb(0.12, 0.23, 0.54),
      });
      cursorY -= 14;
    }

    cursorY -= 12;

    const tableLeft = PDF_MARGIN + 18;
    const tableHeaderY = cursorY - PDF_TABLE_HEADER_HEIGHT;

    page.drawRectangle({
      x: tableLeft,
      y: tableHeaderY,
      width: tableWidth,
      height: PDF_TABLE_HEADER_HEIGHT,
      color: rgb(0.86, 0.92, 1),
      borderColor: rgb(0.73, 0.82, 0.95),
      borderWidth: 1,
    });

    let columnX = tableLeft;
    document.columns.forEach((column, index) => {
      const width = columnWidths[index];
      page.drawText(normalizePdfValue(column), {
        x: columnX + PDF_TABLE_CELL_PADDING_X,
        y: tableHeaderY + 9,
        size: PDF_HEADER_FONT_SIZE,
        font: bodyFont,
        color: rgb(0.06, 0.09, 0.16),
      });
      if (index < document.columns.length - 1) {
        page.drawLine({
          start: { x: columnX + width, y: tableHeaderY },
          end: { x: columnX + width, y: tableHeaderY + PDF_TABLE_HEADER_HEIGHT },
          color: rgb(0.73, 0.82, 0.95),
          thickness: 1,
        });
      }
      columnX += width;
    });

    cursorY = tableHeaderY;
    const minRowY = PDF_MARGIN + 26;
    let pageRowCount = 0;

    if (!hasPreparedRows) {
      const emptyHeight = 92;
      const emptyBottom = Math.max(minRowY, cursorY - emptyHeight);
      page.drawRectangle({
        x: tableLeft,
        y: emptyBottom,
        width: tableWidth,
        height: cursorY - emptyBottom,
        color: rgb(0.985, 0.99, 1),
        borderColor: rgb(0.88, 0.91, 0.95),
        borderWidth: 1,
      });
      page.drawText(normalizePdfValue("No data found for selected filters."), {
        x: tableLeft + 16,
        y: emptyBottom + 42,
        size: 12,
        font: bodyFont,
        color: rgb(0.32, 0.39, 0.5),
      });
      rowIndex = 1;
      continue;
    }

    while (rowIndex < preparedRows.length) {
      const row = preparedRows[rowIndex];
      if (cursorY - row.height < minRowY && pageRowCount > 0) {
        break;
      }

      const rowTop = cursorY;
      const rowBottom = cursorY - row.height;
      page.drawRectangle({
        x: tableLeft,
        y: rowBottom,
        width: tableWidth,
        height: row.height,
        color: pageRowCount % 2 === 0 ? rgb(1, 1, 1) : rgb(0.97, 0.98, 1),
        borderColor: rgb(0.88, 0.91, 0.95),
        borderWidth: 1,
      });

      let cellX = tableLeft;
      row.wrappedCells.forEach((cellLines, index) => {
        const width = columnWidths[index];
        let lineY = rowTop - PDF_TABLE_CELL_PADDING_Y - PDF_BODY_FONT_SIZE;
        cellLines.forEach((line) => {
          page.drawText(normalizePdfValue(line || "-"), {
            x: cellX + PDF_TABLE_CELL_PADDING_X,
            y: lineY,
            size: PDF_BODY_FONT_SIZE,
            font: bodyFont,
            color: rgb(0.15, 0.18, 0.24),
          });
          lineY -= PDF_LINE_HEIGHT;
        });

        if (index < row.wrappedCells.length - 1) {
          page.drawLine({
            start: { x: cellX + width, y: rowBottom },
            end: { x: cellX + width, y: rowTop },
            color: rgb(0.88, 0.91, 0.95),
            thickness: 1,
          });
        }
        cellX += width;
      });

      cursorY = rowBottom;
      rowIndex += 1;
      pageRowCount += 1;
    }
  }

  pdfDocument.getPages().forEach((page, index, allPages) => {
    page.drawText(`Page ${index + 1} of ${allPages.length}`, {
      x: PDF_PAGE_WIDTH - PDF_MARGIN - 86,
      y: PDF_MARGIN - 10,
      size: 9,
      font: bodyFont,
      color: rgb(0.4, 0.47, 0.58),
    });
  });

  return Buffer.from(await pdfDocument.save());
}

async function buildPdfBuffer(document: ReportDocument) {
  try {
    return await buildPdfBufferWithStrategy(document, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF export error";
    console.warn(`[report-export] Falling back to standard PDF font: ${message}`);
    return buildPdfBufferWithStrategy(document, false);
  }
}

export async function generateReportExport(actor: ReportActor, reportType: ReportTypeKey, formatType: ReportFormat, filters: ReportFilters): Promise<ReportExportResult> {
  const document = await buildReportDocument(actor, reportType, filters);
  const fileDate = formatCrmDate(document.generatedAt, "yyyy-MM-dd");
  const fileName = `${document.slug}-${fileDate}.${formatType === "print" ? "html" : formatType}`;

  if (formatType === "csv") {
    return {
      buffer: buildCsvBuffer(document),
      contentType: "text/csv; charset=utf-8",
      fileName,
      rowCount: document.rows.length,
      reportTitle: document.title,
    };
  }

  if (formatType === "xlsx") {
    return {
      buffer: buildWorkbookBuffer(document),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName,
      rowCount: document.rows.length,
      reportTitle: document.title,
    };
  }

  if (formatType === "print") {
    return {
      buffer: Buffer.from(buildPrintHtml(document), "utf8"),
      contentType: "text/html; charset=utf-8",
      fileName,
      rowCount: document.rows.length,
      reportTitle: document.title,
    };
  }

  return {
    buffer: await buildPdfBuffer(document),
    contentType: "application/pdf",
    fileName,
    rowCount: document.rows.length,
    reportTitle: document.title,
  };
}

export function canWriteLegacyReportLog(reportType: ReportTypeKey): reportType is Extract<ReportTypeKey, "CUSTOMER_COMMUNICATION" | "FOLLOW_UP" | "EMPLOYEE_PERFORMANCE" | "SALES" | "REWARD" | "LEAD_CONVERSION"> {
  return SUPPORTED_REPORT_LOG_TYPES.has(reportType);
}

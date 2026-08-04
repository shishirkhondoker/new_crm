import * as XLSX from "xlsx";
import type * as Prisma from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import type { LeadRow } from "@/lib/crm-data";
import { buildCustomerScopeWhere } from "@/lib/customer-ownership";
import { buildLeadScopeWhere, getScopedLeadUserIds, resolveLeadOwnerId } from "@/lib/lead-ownership";
import type { Role } from "@/lib/utils";

export const LEAD_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export type LeadActor = {
  id: string;
  role: Role;
  assignedToId?: string;
};

type LeadStatusValue =
  | "NEW_LEAD"
  | "CONTACTED"
  | "INTERESTED"
  | "FOLLOW_UP_REQUIRED"
  | "QUOTATION_SENT"
  | "NEGOTIATION"
  | "WON_SALE"
  | "LOST_SALE"
  | "ON_HOLD";

type PriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type LeadInput = {
  customerName: string;
  companyId?: string;
  phoneNumbers: string[];
  emails: string[];
  productInterestId?: string;
  assignedToId?: string;
  priority?: PriorityValue;
  score?: number;
  purchaseProbability?: number;
  followUpDate?: string | null;
  notes?: string;
  status?: LeadStatusValue;
};

export type LeadListQuery = {
  search?: string;
  status?: string;
  priority?: string;
  assignedToId?: string;
  page?: number;
  pageSize?: number;
};

export type LeadListResult = {
  rows: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LeadImportFailure = {
  row: number;
  reason: string;
};

export type LeadImportResult = {
  success: true;
  inserted: number;
  updated: number;
  failed: LeadImportFailure[];
};

export type LeadExportFormat = "xlsx" | "csv";

type LeadRecord = Prisma.Prisma.LeadGetPayload<{
  include: {
    company: { select: { id: true; name: true } };
    interestedProduct: { select: { id: true; name: true } };
    assignedTo: { select: { id: true; name: true } };
    communications: { select: { id: true } };
    followUps: { select: { id: true } };
    quotations: { select: { id: true } };
  };
}>;

type ParsedLeadRow = {
  row: number;
  customerName: string;
  companyName?: string;
  phoneNumbers: string[];
  emails: string[];
  productName?: string;
  assignedMarketer?: string;
  priority?: PriorityValue;
  score?: number;
  purchaseProbability?: number;
  followUpDate?: Date;
  notes?: string;
};

export class LeadInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const leadInclude = {
  company: { select: { id: true, name: true } },
  interestedProduct: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  communications: { select: { id: true } },
  followUps: { select: { id: true } },
  quotations: { select: { id: true } },
} satisfies Prisma.Prisma.LeadInclude;

function splitMultiValue(value?: string | null) {
  if (!value) return [];
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinMultiValue(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(" | ");
}

function primaryValue(value?: string | null) {
  return splitMultiValue(value)[0] ?? "-";
}

function labelize(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase()) || "-";
}

function formatDate(value?: Date | null, pattern: "date" | "datetime" = "datetime") {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", pattern === "date"
    ? { day: "2-digit", month: "2-digit", year: "numeric" }
    : { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}

function parseIntSafe(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function parseDate(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  const text = String(value).trim();
  if (!text) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizePriority(value?: string | null): PriorityValue {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH" || normalized === "URGENT") return normalized;
  if (normalized === "IMPORTANT") return "URGENT";
  return "MEDIUM";
}

function normalizeStatus(value?: string | null): LeadStatusValue {
  const normalized = (value ?? "").trim().toUpperCase();
  if (
    normalized === "NEW_LEAD" ||
    normalized === "CONTACTED" ||
    normalized === "INTERESTED" ||
    normalized === "FOLLOW_UP_REQUIRED" ||
    normalized === "QUOTATION_SENT" ||
    normalized === "NEGOTIATION" ||
    normalized === "WON_SALE" ||
    normalized === "LOST_SALE" ||
    normalized === "ON_HOLD"
  ) {
    return normalized as LeadStatusValue;
  }

  if (normalized === "LOST") return "LOST_SALE";

  return "NEW_LEAD";
}

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizePhone(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function dedupe(values: string[]) {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}

function mapLeadRow(lead: LeadRecord): LeadRow {
  return {
    id: lead.id,
    companyId: lead.companyId,
    title: lead.title || lead.customerName,
    customerName: lead.customerName,
    company: lead.company?.name ?? lead.customerName,
    phone: primaryValue(lead.phone),
    phones: splitMultiValue(lead.phone),
    email: primaryValue(lead.email),
    emails: splitMultiValue(lead.email),
    productInterestId: lead.productInterestId,
    productInterest: lead.interestedProduct?.name ?? "-",
    status: labelize(lead.status),
    score: lead.score,
    priority: labelize(lead.priority),
    assignedToId: lead.assignedToId,
    assignedTo: lead.assignedTo?.name ?? "-",
    followUpDate: formatDate(lead.followUpDate),
    purchaseProbability: lead.purchaseProbability,
    communicationCount: lead.communications.length,
    followUpCount: lead.followUps.length,
    salesProgress: labelize(lead.status),
    notes: lead.notes ?? "-",
    createdAt: formatDate(lead.createdAt),
  };
}

async function resolveAssignedToId(prisma: ReturnType<typeof getPrisma>, actor: LeadActor, requestedAssignedToId?: string) {
  try {
    return await resolveLeadOwnerId(prisma, actor, requestedAssignedToId);
  } catch (error) {
    throw new LeadInputError(error instanceof Error ? error.message : "Selected marketer was not found.");
  }
}

function validateLeadInput(input: LeadInput) {
  const customerName = input.customerName.trim();
  const phoneNumbers = dedupe(input.phoneNumbers.map(normalizePhone).filter(Boolean));
  const emails = dedupe(input.emails.map(normalizeEmail).filter(Boolean));

  if (!customerName) {
    throw new LeadInputError("Customer Name is required.");
  }

  if (!phoneNumbers.length && !emails.length) {
    throw new LeadInputError("At least one Phone or Email is required.");
  }

  const score = parseIntSafe(input.score, 0);
  const purchaseProbability = parseIntSafe(input.purchaseProbability, 0);

  if (!Number.isFinite(score)) {
    throw new LeadInputError("Lead Score must be a number.");
  }

  if (!Number.isFinite(purchaseProbability) || purchaseProbability < 0 || purchaseProbability > 100) {
    throw new LeadInputError("Probability must be between 0 and 100.");
  }

  return {
    customerName,
    phone: joinMultiValue(phoneNumbers),
    email: joinMultiValue(emails),
    phoneNumbers,
    emails,
    score,
    purchaseProbability,
    priority: normalizePriority(input.priority),
    status: normalizeStatus(input.status),
    followUpDate: parseDate(input.followUpDate),
    notes: input.notes?.trim() || undefined,
    productInterestId: input.productInterestId?.trim() || undefined,
    companyId: input.companyId?.trim() || undefined,
  };
}

function buildLeadWhere(query: LeadListQuery, scopedUserIds?: string[]): Prisma.Prisma.LeadWhereInput {
  const search = query.search?.trim();
  return {
    ...(scopedUserIds
      ? {
          OR: [
            { assignedToId: { in: scopedUserIds } },
            {
              AND: [
                { assignedToId: null },
                { createdById: { in: scopedUserIds } },
              ],
            },
          ],
        }
      : {}),
    ...(search
      ? {
          AND: [
            {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { company: { name: { contains: search, mode: "insensitive" } } },
                { interestedProduct: { name: { contains: search, mode: "insensitive" } } },
              ],
            },
          ],
        }
      : {}),
    ...(query.status && query.status !== "all"
      ? { status: normalizeStatus(query.status) }
      : {}),
    ...(query.priority && query.priority !== "all"
      ? { priority: normalizePriority(query.priority) }
      : {}),
    ...(query.assignedToId && query.assignedToId !== "all"
      ? { assignedToId: query.assignedToId }
      : {}),
  };
}

export async function listLeadLookupOptions({
  actor,
  search,
  limit,
}: {
  actor?: LeadActor;
  search?: string;
  limit: number;
}) {
  const prisma = getPrisma();
  const scopedUserIds = await getScopedLeadUserIds(prisma, actor);
  const where = buildLeadWhere({ search }, scopedUserIds);

  return prisma.lead.findMany({
    where,
    select: {
      id: true,
      title: true,
      customerName: true,
      email: true,
      phone: true,
      company: {
        select: { name: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function listLeads(query: LeadListQuery, actor?: LeadActor): Promise<LeadListResult> {
  const prisma = getPrisma();
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
  const scopedUserIds = await getScopedLeadUserIds(prisma, actor);
  const where = buildLeadWhere(query, scopedUserIds);

  const [rows, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: leadInclude,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    rows: rows.map(mapLeadRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getLeadById(id: string, actor?: LeadActor) {
  const prisma = getPrisma();
  const row = await prisma.lead.findFirst({
    where: await buildLeadScopeWhere(prisma, actor, { leadId: id }),
    include: leadInclude,
  });
  return row ? mapLeadRow(row) : null;
}

export async function createLeadEntry(actor: LeadActor, input: LeadInput) {
  const prisma = getPrisma();
  const normalized = validateLeadInput(input);
  const assignedToId = await resolveAssignedToId(prisma, actor, input.assignedToId);

  if (normalized.companyId && !(await hasCustomerAccessForLead(prisma, actor, normalized.companyId))) {
    throw new LeadInputError("You are not allowed to use this customer record.", 403);
  }

  const created = await prisma.lead.create({
    data: {
      title: normalized.customerName,
      customerName: normalized.customerName,
      phone: normalized.phone,
      email: normalized.email || undefined,
      companyId: normalized.companyId,
      productInterestId: normalized.productInterestId,
      assignedToId,
      createdById: actor.id,
      status: normalized.status,
      priority: normalized.priority,
      score: normalized.score,
      purchaseProbability: normalized.purchaseProbability,
      followUpDate: normalized.followUpDate,
      notes: normalized.notes,
    },
    include: leadInclude,
  });

  return mapLeadRow(created);
}

export async function updateLeadEntry(actor: LeadActor, id: string, input: LeadInput) {
  const prisma = getPrisma();
  const existing = await prisma.lead.findFirst({
    where: await buildLeadScopeWhere(prisma, actor, { leadId: id }),
    select: { id: true, createdById: true },
  });
  if (!existing) {
    throw new LeadInputError("Lead not found.", 404);
  }

  const normalized = validateLeadInput(input);
  const assignedToId = await resolveAssignedToId(prisma, actor, input.assignedToId);

  if (normalized.companyId && !(await hasCustomerAccessForLead(prisma, actor, normalized.companyId))) {
    throw new LeadInputError("You are not allowed to use this customer record.", 403);
  }

  const updated = await prisma.lead.update({
    where: { id },
    data: {
      title: normalized.customerName,
      customerName: normalized.customerName,
      phone: normalized.phone,
      email: normalized.email || undefined,
      companyId: normalized.companyId,
      productInterestId: normalized.productInterestId,
      assignedToId,
      status: normalized.status,
      priority: normalized.priority,
      score: normalized.score,
      purchaseProbability: normalized.purchaseProbability,
      followUpDate: normalized.followUpDate,
      notes: normalized.notes,
    },
    include: leadInclude,
  });

  return mapLeadRow(updated);
}

export async function deleteLeadEntry(actor: LeadActor, id: string) {
  const prisma = getPrisma();
  const existing = await prisma.lead.findFirst({
    where: await buildLeadScopeWhere(prisma, actor, { leadId: id }),
    select: { id: true },
  });
  if (!existing) {
    throw new LeadInputError("Lead not found.", 404);
  }

  await prisma.lead.delete({ where: { id } });
  return { id };
}

function readWorkbookRows(buffer: Buffer, fileName: string) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    throw new LeadInputError("The uploaded file does not contain any sheets.");
  }

  const sheet = workbook.Sheets[firstSheet];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

function valueByAliases(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const key = Object.keys(row).find((item) => item.trim().toLowerCase() === alias.trim().toLowerCase());
    if (!key) continue;
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return undefined;
}

function mapImportedLeadRow(row: Record<string, unknown>, rowNumber: number): ParsedLeadRow {
  const companyName = normalizeText(valueByAliases(row, ["Company", "Company Name", "Customer / Company", "Customer Company"]));
  const primaryContactName = normalizeText(valueByAliases(row, [
    "Customer Name",
    "Lead Name",
    "Name",
    "Customer",
    "Contact Person",
    "Contact Person Name",
    "Contact Person 1 Name",
    "Primary Contact",
  ]));
  const phoneNumbers = dedupe([
    normalizePhone(valueByAliases(row, ["Phone", "Primary Phone", "Phone 1"])),
    normalizePhone(valueByAliases(row, ["Phone 2", "Secondary Phone"])),
    normalizePhone(valueByAliases(row, ["Phone 3"])),
  ].filter(Boolean));
  const emails = dedupe([
    normalizeEmail(valueByAliases(row, ["Email", "Primary Email", "Email 1"])),
    normalizeEmail(valueByAliases(row, ["Email 2", "Secondary Email"])),
  ].filter(Boolean));

  return {
    row: rowNumber,
    customerName: primaryContactName ?? companyName ?? "",
    companyName,
    phoneNumbers,
    emails,
    productName: normalizeText(valueByAliases(row, ["Interested Product", "Product Interest", "Product"])),
    assignedMarketer: normalizeText(valueByAliases(row, ["Assigned Marketer", "Assigned To", "Assigned"])),
    priority: normalizePriority(normalizeText(valueByAliases(row, ["Priority"]))),
    score: parseIntSafe(valueByAliases(row, ["Lead Score", "Score"]), 0),
    purchaseProbability: parseIntSafe(valueByAliases(row, ["Probability", "Probability %", "Purchase Probability"]), 0),
    followUpDate: parseDate(valueByAliases(row, ["Follow-up Date", "Follow Up Date"])),
    notes: normalizeText(valueByAliases(row, ["Notes", "Note", "Remarks"])),
  };
}

export async function importLeadsFromFile(buffer: Buffer, fileName: string, actor: LeadActor): Promise<LeadImportResult> {
  const prisma = getPrisma();
  const scopedLeadUsers = await getScopedLeadUserIds(prisma, actor);
  if (actor.role !== "MARKETER" && !actor.assignedToId?.trim()) {
    throw new LeadInputError("Select a marketer before importing leads.");
  }
  const rows = readWorkbookRows(buffer, fileName);
  const failed: LeadImportFailure[] = [];
  let inserted = 0;
  let updated = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const parsed = mapImportedLeadRow(rows[index] ?? {}, index + 2);

    if (!parsed.customerName) {
      failed.push({ row: parsed.row, reason: "Customer Name is required." });
      continue;
    }

    if (!parsed.phoneNumbers.length && !parsed.emails.length) {
      failed.push({ row: parsed.row, reason: "At least one Phone or Email is required." });
      continue;
    }

    const company = parsed.companyName
      ? await prisma.customerCompany.findFirst({
          where: {
            AND: [
              await buildCustomerScopeWhere(prisma, actor),
              { name: { equals: parsed.companyName, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        })
      : null;
    const product = parsed.productName
      ? await prisma.productService.findFirst({ where: { name: { equals: parsed.productName, mode: "insensitive" } }, select: { id: true } })
      : null;
    const assigned = actor.role === "MARKETER"
      ? { id: actor.id }
      : actor.assignedToId
        ? { id: actor.assignedToId }
        : null;

    const payload: LeadInput = {
      customerName: parsed.customerName,
      companyId: company?.id,
      phoneNumbers: parsed.phoneNumbers,
      emails: parsed.emails,
      productInterestId: product?.id,
      assignedToId: assigned?.id,
      priority: parsed.priority,
      score: parsed.score,
      purchaseProbability: parsed.purchaseProbability,
      followUpDate: parsed.followUpDate?.toISOString(),
      notes: parsed.notes,
    };

    try {
      const existing = await prisma.lead.findFirst({
        where: {
          AND: [
            buildLeadWhere({}, scopedLeadUsers),
            {
              customerName: { equals: parsed.customerName, mode: "insensitive" },
              ...(company?.id ? { companyId: company.id } : {}),
            },
          ],
        },
        select: { id: true },
      });

      if (existing) {
        await updateLeadEntry(actor, existing.id, payload);
        updated += 1;
      } else {
        await createLeadEntry(actor, payload);
        inserted += 1;
      }
    } catch (error) {
      failed.push({ row: parsed.row, reason: error instanceof Error ? error.message : "Lead import failed." });
    }
  }

  return { success: true, inserted, updated, failed };
}

function pickVisibleValue(row: LeadRow, key: string) {
  switch (key) {
    case "title":
    case "customerName":
      return row.customerName;
    case "company":
      return row.company;
    case "phone":
      return row.phones.join(" | ");
    case "email":
      return row.emails.join(" | ");
    case "productInterest":
      return row.productInterest;
    case "status":
      return row.status;
    case "score":
      return row.score;
    case "purchaseProbability":
      return row.purchaseProbability;
    case "assignedTo":
      return row.assignedTo;
    case "priority":
      return row.priority;
    case "followUpDate":
      return row.followUpDate;
    case "createdAt":
      return row.createdAt;
    default:
      return "";
  }
}

async function hasCustomerAccessForLead(
  prisma: ReturnType<typeof getPrisma>,
  actor: LeadActor,
  customerId: string,
) {
  const record = await prisma.customerCompany.findFirst({
    where: await buildCustomerScopeWhere(prisma, actor, { customerId }),
    select: { id: true },
  });

  return Boolean(record);
}

export async function exportLeads(
  actor: LeadActor,
  format: LeadExportFormat,
  visibleColumns?: string[],
  query?: LeadListQuery,
) {
  const prisma = getPrisma();
  const scopedUserIds = await getScopedLeadUserIds(prisma, actor);
  const where = buildLeadWhere(query ?? {}, scopedUserIds);
  const leads = await prisma.lead.findMany({
    where,
    include: leadInclude,
    orderBy: { updatedAt: "desc" },
  });

  const rows = leads.map(mapLeadRow);
  const selectedColumns = (visibleColumns?.length ? visibleColumns : [
    "customerName",
    "company",
    "phone",
    "email",
    "productInterest",
    "status",
    "score",
    "purchaseProbability",
    "assignedTo",
    "priority",
    "followUpDate",
    "createdAt",
  ]).filter((column) => column !== "action");

  const labelMap: Record<string, string> = {
    customerName: "Lead Name / Customer Name",
    title: "Lead Name / Customer Name",
    company: "Company",
    phone: "Phone",
    email: "Email",
    productInterest: "Product Interest",
    status: "Status",
    score: "Lead Score",
    purchaseProbability: "Probability",
    assignedTo: "Assigned To",
    priority: "Priority",
    followUpDate: "Follow-up Date",
    createdAt: "Created At",
  };

  const exportRows = rows.map((row) => {
    const output: Record<string, string | number> = {};
    for (const column of selectedColumns) {
      output[labelMap[column] ?? column] = pickVisibleValue(row, column) as string | number;
    }
    return output;
  });

  const safeDate = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const buffer = Buffer.from(csv, "utf8");
    return {
      buffer,
      fileName: `leads-export-${safeDate}.csv`,
      contentType: "text/csv; charset=utf-8",
    };
  }

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return {
    buffer,
    fileName: `leads-export-${safeDate}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

import * as XLSX from "xlsx";
import type * as PrismaTypes from "@prisma/client";
import { buildCustomerScopeWhere } from "@/lib/customer-ownership";
import { getScopedLeadUserIds } from "@/lib/lead-ownership";
import { getPrisma } from "@/lib/prisma";
import { type Role } from "@/lib/utils";
import { CUSTOMER_TEMPLATE_RAW_KEYS } from "@/lib/customer-transfer";

export type FullExportActor = {
  id: string;
  role: Role;
};

export type FullExportFormat = "xlsx" | "csv";

type FullExportResult = {
  buffer: Buffer;
  fileName: string;
  rowCount: number;
  contentType: string;
};

interface JsonLikeRecord {
  [key: string]: JsonLike;
}

type JsonLike = string | number | boolean | null | JsonLike[] | JsonLikeRecord;

type FullExportCustomerRecord = {
  id: string;
  name: string;
  industry: string | null;
  phone: string;
  city: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  contactPerson?: string | null;
  phone2?: string | null;
  status?: string | null;
  assignedTo?: { name: string } | null;
  contacts: Array<{
    name: string;
    isPrimary: boolean | null;
    mobile: string | null;
    email: string | null;
    designation?: string | null;
    department?: string | null;
  }>;
  phoneNumbers: Array<{ number: string | null }>;
  rawData?: PrismaTypes.Prisma.JsonValue | null;
};

const CUSTOMER_EXPORT_TEMPLATE_KEYS = CUSTOMER_TEMPLATE_RAW_KEYS.map((column) => column as string);

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toString();
}

function normalizeDate(value: Date | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString();
}

function normalizeNumber(value: number | string | undefined) {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return value;
}

function normalizeRawJson(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeDecimal(value: unknown) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof value.toNumber === "function") {
    return String((value as { toNumber: () => number }).toNumber());
  }
  return "";
}

function toCsvValue(raw: unknown) {
  const value = raw == null ? "" : typeof raw === "string" ? raw : String(raw);
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function mapCustomerRows(
  customers: FullExportCustomerRecord[],
) {
  return customers.map((customer) => {
    const raw = normalizeRawJson(customer.rawData);
    const primaryContact = customer.contacts.find((contact) => contact.isPrimary) ?? customer.contacts[0];
    const secondaryContact = customer.contacts.find((contact) => contact !== primaryContact);
    const fallbackPrimaryEmail = primaryContact?.email ?? "";
    const fallbackPrimaryPhone = primaryContact?.mobile ?? customer.phone ?? "";
    const phoneValues = customer.phoneNumbers.map((item) => normalizeText(item.number)).filter((value): value is string => Boolean(value));

    const normalized: Record<string, unknown> = {};
    for (const key of CUSTOMER_EXPORT_TEMPLATE_KEYS) {
      const value = normalizeText(raw[key] as string | null | undefined);
      normalized[key] = value;
    }

    normalized["SL"] = normalized["SL"] || "";
    normalized["Industry"] = normalized["Industry"] || customer.industry || "";
    normalized["Company Name"] = normalized["Company Name"] || customer.name;
    normalized["City/Zilla"] = normalized["City/Zilla"] || customer.city || "";
    normalized["Address"] = normalized["Address"] || customer.address || "";
    normalized["Primary Phone"] = normalized["Primary Phone"] || fallbackPrimaryPhone || phoneValues[0] || "";
    normalized["Phone 2"] = normalized["Phone 2"] || phoneValues[1] || customer.phone2 || "";
    normalized["Phone 3"] = normalized["Phone 3"] || phoneValues[2] || "";
    normalized["Primary Email"] = normalized["Primary Email"] || fallbackPrimaryEmail || "";
    normalized["Email 2"] = normalized["Email 2"] || (raw["Email 2"] as string | undefined) || "";
    normalized["Website"] = normalized["Website"] || customer.website || "";
    normalized["Note"] = normalized["Note"] || customer.notes || "";
    normalized["Contact Person 1 Name"] = normalized["Contact Person 1 Name"] || raw["Contact Person"] || customer.contactPerson || "";
    normalized["Contact Person 1 Designation"] = normalized["Contact Person 1 Designation"] || "";
    normalized["Contact Person 1 Department"] = normalized["Contact Person 1 Department"] || "";
    normalized["Contact Person 1 Phone 1"] = normalized["Contact Person 1 Phone 1"] || fallbackPrimaryPhone || "";
    normalized["Contact Person 1 Phone 2"] = normalized["Contact Person 1 Phone 2"] || "";
    normalized["Contact Person 1 Email 1"] = normalized["Contact Person 1 Email 1"] || fallbackPrimaryEmail || "";
    normalized["Contact Person 1 Email 2"] = normalized["Contact Person 1 Email 2"] || "";
    normalized["Contact Person 2 Name"] = normalized["Contact Person 2 Name"] || secondaryContact?.name || "";
    normalized["Contact Person 2 Designation"] = normalized["Contact Person 2 Designation"] || secondaryContact?.designation || "";
    normalized["Contact Person 2 Department"] = normalized["Contact Person 2 Department"] || "";
    normalized["Contact Person 2 Phone 1"] = normalized["Contact Person 2 Phone 1"] || secondaryContact?.mobile || "";
    normalized["Contact Person 2 Phone 2"] = normalized["Contact Person 2 Phone 2"] || "";
    normalized["Contact Person 2 Email 1"] = normalized["Contact Person 2 Email 1"] || secondaryContact?.email || "";
    normalized["Contact Person 2 Email 2"] = normalized["Contact Person 2 Email 2"] || "";
    normalized["Lead Source"] = normalized["Lead Source"] || "";

    return normalized;
  });
}

function mapLeadRows(
  leads: Array<{
    title: string;
    phone: string;
    email: string | null;
    company: { name: string } | null;
    customerName: string;
    status: string;
    assignedTo: { name: string } | null;
  }>,
) {
  return leads.map((lead) => ({
    Name: lead.title,
    Phone: lead.phone,
    Email: normalizeText(lead.email),
    Company: normalizeText(lead.company?.name ?? lead.customerName),
    Status: normalizeText(lead.status),
    "Assigned To": lead.assignedTo?.name ?? "",
  }));
}

function mapProductRows(
  products: Array<{ name: string; category: string; price: unknown; stock?: number | null }>,
) {
  return products.map((product) => ({
    "Product Name": product.name,
    Category: normalizeText(product.category),
    Price: normalizeDecimal(product.price),
    Stock: product.stock == null ? "" : normalizeNumber(product.stock),
  }));
}

function mapFollowUpRows(
  followUps: Array<{
    id: string;
    note: string | null;
    nextDiscussionPlan: string | null;
    method: string;
    followUpDate: Date;
    company: { name: string } | null;
    lead: { title: string; customerName: string | null } | null;
    assignedTo: { name: string } | null;
  }>,
) {
  return followUps.map((followUp) => ({
    Title: normalizeText(followUp.note || followUp.nextDiscussionPlan || `${followUp.method} follow-up`),
    "Company / Customer": normalizeText((followUp.company?.name ?? "") || followUp.lead?.customerName),
    Lead: normalizeText(followUp.lead?.title),
    "Assigned To": followUp.assignedTo?.name ?? "",
    Method: followUp.method,
    Date: normalizeDate(followUp.followUpDate),
    Notes: normalizeText(followUp.note || followUp.nextDiscussionPlan),
  }));
}

function toCsvSection(title: string, rows: Array<Record<string, unknown>>, headers: string[]) {
  const lines: string[] = [];
  lines.push(`"${title}"`);
  lines.push(headers.map((header) => toCsvValue(header)).join(","));
  for (const row of rows) {
        lines.push(headers.map((header) => toCsvValue(row[header])).join(","));
  }
  lines.push("");
  return lines.join("\n");
}

export async function exportAllCrmData(
  actor: FullExportActor,
  format: FullExportFormat,
): Promise<FullExportResult> {
  const prisma = getPrisma();
  const scopedUserIds = await getScopedLeadUserIds(prisma, actor);
  const customerWhere = await buildCustomerScopeWhere(prisma, actor);
  const leadWhere = scopedUserIds
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
    : {};
  const followUpWhere = scopedUserIds ? { assignedToId: { in: scopedUserIds } } : {};

  const today = new Date();
  const fileDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const fileName = format === "csv" ? `crm_full_export_${fileDate}.csv` : `crm_full_export_${fileDate}.xlsx`;

  const [rawCustomers, rawLeads, rawProducts, rawFollowUps] = await Promise.all([
    prisma.customerCompany.findMany({
      where: customerWhere,
      orderBy: { name: "asc" },
      include: {
        assignedTo: { select: { name: true } },
        contacts: true,
        phoneNumbers: true,
        leads: true,
        communications: { orderBy: { communicationAt: "desc" }, take: 1 },
      },
    }),
    prisma.lead.findMany({
      where: leadWhere,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.productService.findMany({ orderBy: { name: "asc" } }),
    prisma.followUp.findMany({
      where: followUpWhere,
      orderBy: { followUpDate: "desc" },
      include: {
        company: { select: { name: true } },
        lead: { select: { id: true, title: true, customerName: true } },
        assignedTo: { select: { name: true } },
      },
    }),
  ]);

  const customerRows = mapCustomerRows(rawCustomers);
  const leadRows = mapLeadRows(rawLeads);
  const productRows = mapProductRows(rawProducts);
  const followUpRows = mapFollowUpRows(rawFollowUps);
  const totalRows = customerRows.length + leadRows.length + productRows.length + followUpRows.length;

  if (format === "csv") {
    const customerHeaders = [...CUSTOMER_EXPORT_TEMPLATE_KEYS];
    const leadHeaders = ["Name", "Phone", "Email", "Company", "Status", "Assigned To"];
    const productHeaders = ["Product Name", "Category", "Price", "Stock"];
    const followUpHeaders = ["Title", "Company / Customer", "Lead", "Assigned To", "Method", "Date", "Notes"];

    const csv = [
      toCsvSection("Customers", customerRows, customerHeaders),
      toCsvSection("Leads", leadRows, leadHeaders),
      toCsvSection("Products", productRows, productHeaders),
      toCsvSection("Follow-ups", followUpRows, followUpHeaders),
    ].join("\n");

    await prisma.importExportLog.create({
      data: {
        type: "EXPORT",
        module: "IMPORT_EXPORT",
        format: "CSV",
        requestedById: actor.id,
        fileName,
        status: "COMPLETED",
        processedRows: totalRows,
        failedRows: 0,
        completedAt: new Date(),
      },
    });

    return {
      buffer: Buffer.from(`\uFEFF${csv}`),
      fileName,
      rowCount: totalRows,
      contentType: "text/csv; charset=utf-8",
    };
  }

  const workbook = XLSX.utils.book_new();
  const customerHeaderList = [...CUSTOMER_EXPORT_TEMPLATE_KEYS].filter((header) => header.length > 0);
  const customerSheet = XLSX.utils.json_to_sheet(customerRows, { header: customerHeaderList });
  XLSX.utils.book_append_sheet(workbook, customerSheet, "Customers");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(leadRows), "Leads");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(productRows), "Products");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(followUpRows), "Follow-ups");

  await prisma.importExportLog.create({
    data: {
      type: "EXPORT",
      module: "IMPORT_EXPORT",
      format: "EXCEL",
      requestedById: actor.id,
      fileName,
      status: "COMPLETED",
      processedRows: totalRows,
      failedRows: 0,
      completedAt: new Date(),
    },
  });

  const output = Buffer.from(
    XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }),
  );

  return {
    buffer: output,
    fileName,
    rowCount: totalRows,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

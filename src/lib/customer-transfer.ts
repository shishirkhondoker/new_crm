import * as XLSX from "xlsx";
import { buildCustomerScopeWhere, resolveCustomerOwnerId } from "@/lib/customer-ownership";
import { getPrisma } from "@/lib/prisma";
import type { Role } from "@/lib/utils";
import { ImportExportFormat } from "@prisma/client";
import type * as Prisma from "@prisma/client";

export const CUSTOMER_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export const CUSTOMER_TEMPLATE_COLUMNS = [
  "SL",
  "Industry",
  "Company Name",
  "City/Zilla",
  "Address",
  "Primary Phone",
  "Phone 2",
  "Phone 3",
  "Primary Email",
  "Email 2",
  "Website",
  "Note",
  "Contact Person 1 Name",
  "Contact Person 1 Designation",
  "Contact Person 1 Department",
  "Contact Person 1 Phone 1",
  "Contact Person 1 Phone 2",
  "Contact Person 1 Email 1",
  "Contact Person 1 Email 2",
  "Contact Person 2 Name",
  "Contact Person 2 Designation",
  "Contact Person 2 Department",
  "Contact Person 2 Phone 1",
  "Contact Person 2 Phone 2",
  "Contact Person 2 Email 1",
  "Contact Person 2 Email 2",
  "Lead Source",
] as const;

export type CustomerTemplateColumn = (typeof CUSTOMER_TEMPLATE_COLUMNS)[number];

export const CUSTOMER_TEMPLATE_RAW_KEYS: readonly string[] = [
  "SL",
  "Industry",
  "Company Name",
  "City/Zilla",
  "Address",
  "Primary Phone",
  "Phone 2",
  "Phone 3",
  "Primary Email",
  "Email 2",
  "Website",
  "Note",
  "Contact Person 1 Name",
  "Contact Person 1 Designation",
  "Contact Person 1 Department",
  "Contact Person 1 Phone 1",
  "Contact Person 1 Phone 2",
  "Contact Person 1 Email 1",
  "Contact Person 1 Email 2",
  "Contact Person 2 Name",
  "Contact Person 2 Designation",
  "Contact Person 2 Department",
  "Contact Person 2 Phone 1",
  "Contact Person 2 Phone 2",
  "Contact Person 2 Email 1",
  "Contact Person 2 Email 2",
  "Lead Source",
] as const;

const CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN = CUSTOMER_TEMPLATE_COLUMNS.length;

export type CustomerTransferActor = {
  id: string;
  role: Role;
  assignedToId?: string;
  importToSelf?: boolean;
};

export type CustomerImportFailure = {
  row: number;
  reason: string;
};

export type CustomerImportResult = {
  success: true;
  inserted: number;
  updated: number;
  failed: CustomerImportFailure[];
};

export type CustomerImportPreviewRow = {
  companyName: string;
  primaryPhone: string;
  city?: string;
  address?: string;
  industry?: string;
};

export type CustomerImportPreviewResult = {
  success: true;
  format: "EXCEL" | "CSV" | "PDF";
  totalRows: number;
  failed: CustomerImportFailure[];
  previewRows: CustomerImportPreviewRow[];
  context?: {
    division?: string;
    district?: string;
    thana?: string;
    industry?: string;
  };
};

export type CustomerPdfAssignmentInput = {
  assignedToId?: string;
  count: number;
};

export type CustomerDistributionSummary = {
  assignedToId: string;
  requestedCount: number;
  inserted: number;
  updated: number;
  failed: number;
};

export type CustomerDistributedImportResult = CustomerImportResult & {
  distribution: CustomerDistributionSummary[];
  heldForLaterCount?: number;
};

export type CustomerExportFormat = "xlsx" | "csv";
type CustomerImportFormat = "EXCEL" | "CSV" | "PDF";

type ParsedCustomerImportPayload = {
  format: CustomerImportFormat;
  rows: ParsedCustomerRow[];
  failed: CustomerImportFailure[];
};

type ParsedCustomerRow = {
  row: number;
  companyName: string;
  primaryPhone: string;
  phone2?: string;
  phone3?: string;
  contactPerson?: string;
  industry?: string;
  address?: string;
  city?: string;
  website?: string;
  note?: string;
  leadSource?: string;
  primaryEmail?: string;
  email2?: string;
  designation1?: string;
  department1?: string;
  phone11?: string;
  phone12?: string;
  email11?: string;
  email12?: string;
  contactPerson2?: string;
  designation2?: string;
  department2?: string;
  phone21?: string;
  phone22?: string;
  email21?: string;
  email22?: string;
  rawData: Record<string, unknown>;
  totalLeads: number;
  lastCommunication?: Date;
};

interface JsonLikeRecord {
  [key: string]: JsonLike;
}

type JsonLike = string | number | boolean | null | JsonLike[] | JsonLikeRecord;
type ExistingCustomerRecord = {
  id: string;
  name: string;
  industry: string | null;
  phone: string;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  contactPerson?: string | null;
  phone2?: string | null;
  rawData?: Prisma.Prisma.JsonValue | null;
  contacts: Array<{
    id: string;
    name: string;
    designation: string | null;
    department?: string | null;
    email: string | null;
    mobile: string | null;
    isPrimary: boolean | null;
  }>;
  phoneNumbers: Array<{
    id: string;
    label: string | null;
    number: string;
    whatsapp: boolean | null;
  }>;
  leads: Array<{ id: string }>;
  communications: Array<{ createdAt: Date }>;
};

function normalizeCompanyKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .toLowerCase();
}

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  return undefined;
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function normalizeRawJson(value: Prisma.Prisma.JsonValue | undefined | null): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value) && value !== null) return value as Record<string, unknown>;
  return {};
}

function uniquePhones(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const value of values) {
    const phone = normalizePhone(value);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    phones.push(phone);
  }
  return phones;
}

function normalizeJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeJsonValue(item));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = normalizeJsonValue(nestedValue);
    }
    return output;
  }
  return String(value);
}

function toDate(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = normalizeText(value);
  if (!text) return undefined;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function exportDate(value?: Date | null) {
  if (!value) return "";
  return value.toISOString();
}

function rowIndexFromTemplate(index: number) {
  const safe = Number.isFinite(index) ? index : 0;
  return safe + 2;
}

function mapTemplateRow(rawRow: Record<string, unknown>, rowNumber: number): ParsedCustomerRow {
  const get = (key: string) => normalizeText(rawRow[key]);

  const city = get("City/Zilla") ?? get("City / Zilla");
  const address = get("Address");
  const companyName = get("Company Name");
  const primaryPhone = normalizePhone(get("Primary Phone"));

  return {
    row: rowNumber,
    companyName: companyName ?? "",
    primaryPhone,
    phone2: get("Phone 2"),
    phone3: get("Phone 3"),
    contactPerson: get("Contact Person 1 Name"),
    industry: get("Industry"),
    address,
    city,
    website: get("Website"),
    note: get("Note"),
    leadSource: get("Lead Source"),
    primaryEmail: get("Primary Email"),
    email2: get("Email 2"),
    designation1: get("Contact Person 1 Designation"),
    department1: get("Contact Person 1 Department"),
    phone11: get("Contact Person 1 Phone 1"),
    phone12: get("Contact Person 1 Phone 2"),
    email11: get("Contact Person 1 Email 1"),
    email12: get("Contact Person 1 Email 2"),
    contactPerson2: get("Contact Person 2 Name"),
    designation2: get("Contact Person 2 Designation"),
    department2: get("Contact Person 2 Department"),
    phone21: get("Contact Person 2 Phone 1"),
    phone22: get("Contact Person 2 Phone 2"),
    email21: get("Contact Person 2 Email 1"),
    email22: get("Contact Person 2 Email 2"),
    rawData: rawRow,
    totalLeads: 0,
  };
}

function buildContactCreates(row: ParsedCustomerRow): Prisma.Prisma.ContactPersonCreateWithoutCompanyInput[] | undefined {
  const contacts: Prisma.Prisma.ContactPersonCreateWithoutCompanyInput[] = [];

  if (row.contactPerson || row.primaryPhone) {
    contacts.push({
      name: row.contactPerson ?? row.companyName,
      designation: row.designation1,
      email: row.primaryEmail,
      mobile: row.primaryPhone,
      isPrimary: true,
    });
  }

  if (row.contactPerson2) {
    contacts.push({
      name: row.contactPerson2,
      designation: row.designation2,
      email: row.email21 ?? row.email22 ?? undefined,
      mobile: row.phone21 ?? row.phone22 ?? undefined,
      isPrimary: false,
    });
  }

  return contacts.length ? contacts : undefined;
}

function buildPhoneCreates(row: ParsedCustomerRow): Prisma.Prisma.PhoneNumberCreateWithoutCompanyInput[] {
  return uniquePhones([row.primaryPhone, row.phone2, row.phone3, row.phone11, row.phone12, row.phone21, row.phone22]).map((number, index) => ({
    label: index === 0 ? "Primary" : `Phone ${index + 1}`,
    number,
    whatsapp: false,
  }));
}

function hasMatchingContact(existing: ExistingCustomerRecord, contact: NonNullable<ParsedCustomerRow["contactPerson2"]>) {
  const normalizedName = normalizeCompanyKey(contact);
  const normalizedEmail = normalizedText(contact.toLowerCase());
  const normalizedPhone = normalizePhone(contact);

  return existing.contacts.some((person) =>
    normalizeCompanyKey(person.name) === normalizedName
    || (person.email && person.email.toLowerCase() === normalizedEmail)
    || (person.mobile && normalizePhone(person.mobile) === normalizedPhone),
  );
}

function normalizedText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildContactUpdateMutation(row: ParsedCustomerRow, existing: ExistingCustomerRecord): Prisma.Prisma.ContactPersonUpdateManyWithoutCompanyNestedInput | undefined {
  const primaryContact = existing.contacts.find((contact) => contact.isPrimary) ?? existing.contacts[0];
  const secondaryCreates = row.contactPerson2 && (!primaryContact || !hasMatchingContact(existing, row.contactPerson2))
    ? [{
      name: row.contactPerson2,
      designation: row.designation2,
      email: row.email21 ?? row.email22 ?? "",
      mobile: row.phone21 ?? row.phone22 ?? "",
      isPrimary: false,
    } satisfies Prisma.Prisma.ContactPersonCreateWithoutCompanyInput]
    : undefined;

  if (primaryContact) {
    return {
      update: [{
        where: { id: primaryContact.id },
        data: {
          name: row.contactPerson ?? primaryContact.name,
          designation: row.designation1 ?? primaryContact.designation,
          email: row.primaryEmail ?? primaryContact.email,
          mobile: row.primaryPhone,
          isPrimary: true,
        },
      }],
      ...(secondaryCreates ? { create: secondaryCreates } : {}),
    };
  }

  const contactCreates = buildContactCreates(row);
  if (!contactCreates) return undefined;
  return { create: contactCreates };
}

function buildContactCreateMutation(row: ParsedCustomerRow): Prisma.Prisma.ContactPersonCreateNestedManyWithoutCompanyInput | undefined {
  const contactCreates = buildContactCreates(row);
  return contactCreates ? { create: contactCreates } : undefined;
}

function buildPhoneUpdateMutation(row: ParsedCustomerRow, existing: ExistingCustomerRecord): Prisma.Prisma.PhoneNumberUpdateManyWithoutCompanyNestedInput {
  const primaryPhone = existing.phoneNumbers[0];
  const existingPhones = new Set(existing.phoneNumbers.map((item) => normalizePhone(item.number)).filter(Boolean));
  const createPhones = uniquePhones([row.phone2, row.phone3, row.phone11, row.phone12, row.phone21, row.phone22])
    .filter((phone) => !existingPhones.has(phone))
    .map((phone, index) => ({
      label: `Phone ${index + 2}`,
      number: phone,
      whatsapp: false,
    } satisfies Prisma.Prisma.PhoneNumberCreateWithoutCompanyInput));

  if (primaryPhone) {
    return {
      update: [{
        where: { id: primaryPhone.id },
        data: {
          label: primaryPhone.label || "Primary",
          number: row.primaryPhone,
          whatsapp: primaryPhone.whatsapp ?? false,
        },
      }],
      ...(createPhones.length ? { create: createPhones } : {}),
    };
  }

  return { create: buildPhoneCreates(row) };
}

function buildPhoneCreateMutation(row: ParsedCustomerRow): Prisma.Prisma.PhoneNumberCreateNestedManyWithoutCompanyInput {
  return {
    create: buildPhoneCreates(row),
  };
}

function parseWorkbookRows(buffer: Buffer, fileName: string) {
  const format = fileName.toLowerCase().endsWith(".csv") ? "CSV" : "EXCEL";
  const workbook = format === "CSV"
    ? XLSX.read(buffer.toString("utf8"), { type: "string", cellDates: true })
    : XLSX.read(buffer, { type: "buffer", cellDates: true });

  const [firstSheetName] = workbook.SheetNames;
  if (!firstSheetName) {
    return {
      rows: [] as ParsedCustomerRow[],
      failed: [{ row: 1, reason: "Workbook is empty." }] as CustomerImportFailure[],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  if (!rows.length) {
    return { rows: [] as ParsedCustomerRow[], failed: [{ row: 1, reason: "No rows found." }] as CustomerImportFailure[] };
  }

  const headers = rows[0] as unknown[];
  const failed: CustomerImportFailure[] = [];
  const fileHeaders = headers.map((value) => normalizeHeader(String(value ?? "")));
  const expectedHeaders = CUSTOMER_TEMPLATE_COLUMNS.map(normalizeHeader);

  for (let index = 0; index < CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN; index += 1) {
    if (fileHeaders[index] !== expectedHeaders[index]) {
      failed.push({ row: 1, reason: `Template mismatch at column ${index + 1}. Expected "${CUSTOMER_TEMPLATE_COLUMNS[index]}".` });
      break;
    }
  }

  if (failed.length) {
    return { rows: [] as ParsedCustomerRow[], failed };
  }

  const parsed: ParsedCustomerRow[] = [];
  const seenNames = new Set<string>();

  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index] as Array<unknown>;
    const rowNumber = index + 1;
    const rawData: Record<string, unknown> = {};

    for (let column = 0; column < CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN; column += 1) {
      rawData[CUSTOMER_TEMPLATE_RAW_KEYS[column]] = normalizeJsonValue(values[column]);
    }

    const templateRow = mapTemplateRow(rawData, rowNumber);
    if (!templateRow.companyName) {
      failed.push({ row: rowIndexFromTemplate(index), reason: "Company Name is required." });
      continue;
    }

    if (!templateRow.primaryPhone) {
      failed.push({ row: rowIndexFromTemplate(index), reason: "Primary Phone is required." });
      continue;
    }

    const existingKey = normalizeCompanyKey(templateRow.companyName);
    if (seenNames.has(existingKey)) {
      failed.push({ row: rowIndexFromTemplate(index), reason: "Duplicate company name found in uploaded file." });
      continue;
    }

    seenNames.add(existingKey);
    parsed.push(templateRow);
  }

  return { rows: parsed, failed };
}

function parseCsvLine(line: string) {
  const output: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";
    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === ",") {
      output.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  output.push(current.trim());
  return output;
}

const CUSTOMER_TEMPLATE_LABEL_ALIASES: Record<string, string[]> = {
  "SL": ["SL", "Serial", "Serial No", "Serial Number"],
  "Industry": ["Industry", "Business Type"],
  "Company Name": ["Company Name", "Company", "Customer / Company", "Customer Company", "Organization Name", "Organization"],
  "City/Zilla": ["City/Zilla", "City / Zilla", "City", "Zilla", "District", "City or Zilla"],
  "Address": ["Address", "Full Address", "Location"],
  "Primary Phone": ["Primary Phone", "Phone", "Phone 1", "Mobile", "Mobile Number", "Primary Mobile"],
  "Phone 2": ["Phone 2", "Secondary Phone", "Alternate Phone"],
  "Phone 3": ["Phone 3", "Third Phone"],
  "Primary Email": ["Primary Email", "Email", "Email 1"],
  "Email 2": ["Email 2", "Secondary Email"],
  "Website": ["Website", "Web Site", "Site"],
  "Note": ["Note", "Notes", "Remarks", "Comment"],
  "Contact Person 1 Name": ["Contact Person 1 Name", "Contact Person", "Primary Contact", "Contact Name", "Person Name"],
  "Contact Person 1 Designation": ["Contact Person 1 Designation", "Designation", "Primary Designation"],
  "Contact Person 1 Department": ["Contact Person 1 Department", "Department", "Primary Department"],
  "Contact Person 1 Phone 1": ["Contact Person 1 Phone 1", "Contact Phone 1", "Primary Contact Phone"],
  "Contact Person 1 Phone 2": ["Contact Person 1 Phone 2", "Contact Phone 2"],
  "Contact Person 1 Email 1": ["Contact Person 1 Email 1", "Contact Email 1", "Primary Contact Email"],
  "Contact Person 1 Email 2": ["Contact Person 1 Email 2", "Contact Email 2"],
  "Contact Person 2 Name": ["Contact Person 2 Name", "Secondary Contact", "Contact Person 2"],
  "Contact Person 2 Designation": ["Contact Person 2 Designation", "Secondary Designation"],
  "Contact Person 2 Department": ["Contact Person 2 Department", "Secondary Department"],
  "Contact Person 2 Phone 1": ["Contact Person 2 Phone 1", "Secondary Contact Phone 1"],
  "Contact Person 2 Phone 2": ["Contact Person 2 Phone 2", "Secondary Contact Phone 2"],
  "Contact Person 2 Email 1": ["Contact Person 2 Email 1", "Secondary Contact Email 1"],
  "Contact Person 2 Email 2": ["Contact Person 2 Email 2", "Secondary Contact Email 2"],
  "Lead Source": ["Lead Source", "Source", "Lead From"],
};

function findTemplateKeyFromLabel(label: string) {
  const normalizedLabel = normalizeHeader(label);
  for (const [templateKey, aliases] of Object.entries(CUSTOMER_TEMPLATE_LABEL_ALIASES)) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalizedLabel)) {
      return templateKey;
    }
  }
  return undefined;
}

function finalizeParsedCustomerRows(rawRows: Record<string, unknown>[]) {
  const rows: ParsedCustomerRow[] = [];
  const failed: CustomerImportFailure[] = [];
  const seenNames = new Set<string>();

  rawRows.forEach((rawData, index) => {
    const rowNumber = index + 2;
    const templateRow = mapTemplateRow(rawData, rowNumber);
    const fallbackPhone = normalizePhone(
      normalizeText(rawData["Contact Person 1 Phone 1"])
      ?? normalizeText(rawData["Contact Person 1 Phone 2"])
      ?? normalizeText(rawData["Phone 2"])
      ?? normalizeText(rawData["Phone 3"]),
    );
    if (!templateRow.primaryPhone && fallbackPhone) {
      templateRow.primaryPhone = fallbackPhone;
      templateRow.rawData["Primary Phone"] = fallbackPhone;
    }

    if (!templateRow.companyName) {
      failed.push({ row: rowNumber, reason: "Company Name is required." });
      return;
    }
    if (!templateRow.primaryPhone) {
      failed.push({ row: rowNumber, reason: "Primary Phone is required." });
      return;
    }

    const existingKey = normalizeCompanyKey(templateRow.companyName);
    if (seenNames.has(existingKey)) {
      failed.push({ row: rowNumber, reason: "Duplicate company name found in uploaded file." });
      return;
    }

    seenNames.add(existingKey);
    rows.push(templateRow);
  });

  return { rows, failed };
}

function parsePdfLabelValueRows(rawLines: string[]) {
  const rows: Record<string, unknown>[] = [];
  let current: Record<string, unknown> = {};

  const flushCurrent = () => {
    if (!Object.keys(current).length) return;
    rows.push(current);
    current = {};
  };

  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index] ?? "";
    const line = rawLine.trim();

    if (!line) {
      flushCurrent();
      continue;
    }
    if (/^page\s+\d+$/i.test(line)) continue;

    let matchedKey: string | undefined;
    let value = "";

    for (const [templateKey, aliases] of Object.entries(CUSTOMER_TEMPLATE_LABEL_ALIASES)) {
      for (const alias of aliases) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const withValue = new RegExp(`^${escaped}\\s*(?:[:\\-]|\\|)\\s*(.+)$`, "i");
        const directMatch = line.match(withValue);
        if (directMatch?.[1]) {
          matchedKey = templateKey;
          value = directMatch[1].trim();
          break;
        }

        if (normalizeHeader(line) === normalizeHeader(alias)) {
          matchedKey = templateKey;
          let nextIndex = index + 1;
          while (nextIndex < rawLines.length) {
            const nextLine = (rawLines[nextIndex] ?? "").trim();
            if (!nextLine) {
              nextIndex += 1;
              continue;
            }
            value = nextLine;
            index = nextIndex;
            break;
          }
          break;
        }
      }
      if (matchedKey) break;
    }

    if (!matchedKey) continue;

    if (
      current["Company Name"]
      && matchedKey === "Company Name"
      && normalizeText(current["Company Name"]) !== normalizeText(value)
    ) {
      flushCurrent();
    }

    current[matchedKey] = value;
  }

  flushCurrent();
  return finalizeParsedCustomerRows(rows);
}

function parsePdfMadrashaRows(rawLines: string[]) {
  let division = "";
  let district = "";
  let thana = "";
  let headerSeen = false;
  let pendingLine = "";
  const rawRows: Record<string, unknown>[] = [];

  const tryParseRow = (line: string) => {
    const normalized = line.trim();
    if (!normalized) return null;

    const match = normalized.match(/^(\d+)\s+(\d{4,})\s+(.+)$/);
    if (!match) return null;

    const [, sl, eiin, remainder] = match;
    const segments = remainder.split(/\s{2,}/).map((item) => item.trim()).filter(Boolean);
    if (segments.length < 3) return null;

    const mobile = normalizePhone(segments[segments.length - 1]);
    if (!/^\d{7,15}$/.test(mobile)) return null;

    const village = segments[segments.length - 2] ?? "";
    const companyName = segments.slice(0, -2).join(" ").trim();
    if (!companyName || !village) return null;

    const address = [village, thana, district, division].filter(Boolean).join(", ");
    const note = [
      `EIIN: ${eiin}`,
      thana ? `Thana: ${thana}` : "",
      district ? `District: ${district}` : "",
      division ? `Division: ${division}` : "",
    ].filter(Boolean).join(" | ");

    return {
      "SL": sl,
      "Industry": "Madrasha",
      "Company Name": companyName,
      "City/Zilla": district || thana || division,
      "Address": address,
      "Primary Phone": mobile,
      "Phone 2": "",
      "Phone 3": "",
      "Primary Email": "",
      "Email 2": "",
      "Website": "",
      "Note": note,
      "Contact Person 1 Name": "",
      "Contact Person 1 Designation": "",
      "Contact Person 1 Department": "",
      "Contact Person 1 Phone 1": "",
      "Contact Person 1 Phone 2": "",
      "Contact Person 1 Email 1": "",
      "Contact Person 1 Email 2": "",
      "Contact Person 2 Name": "",
      "Contact Person 2 Designation": "",
      "Contact Person 2 Department": "",
      "Contact Person 2 Phone 1": "",
      "Contact Person 2 Phone 2": "",
      "Contact Person 2 Email 1": "",
      "Contact Person 2 Email 2": "",
      "Lead Source": "PDF Import",
      "EIIN": eiin,
      "Village/Road": village,
      "Division": division,
      "District": district,
      "Thana": thana,
    } satisfies Record<string, unknown>;
  };

  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index] ?? "";
    const line = rawLine.replace(/\r/g, "").trim();
    if (!line) continue;
    if (/^page\s+\d+$/i.test(line)) continue;

    const divisionMatch = line.match(/^division\s+(.+)$/i);
    if (divisionMatch?.[1]) {
      division = divisionMatch[1].trim();
      continue;
    }

    const districtMatch = line.match(/^district\s+(.+)$/i);
    if (districtMatch?.[1]) {
      district = districtMatch[1].trim();
      continue;
    }

    const thanaMatch = line.match(/^thana\s+(.+)$/i);
    if (thanaMatch?.[1]) {
      thana = thanaMatch[1].trim();
      continue;
    }

    if (!headerSeen) {
      if (/^sl\s+/i.test(line) && /eiin/i.test(line) && /village\/road/i.test(line) && /mobile/i.test(line)) {
        headerSeen = true;
      }
      continue;
    }

    pendingLine = pendingLine ? `${pendingLine} ${line}` : line;
    const parsedRow = tryParseRow(pendingLine);
    if (!parsedRow) continue;
    rawRows.push(parsedRow);
    pendingLine = "";
  }

  if (!rawRows.length) {
    return { rows: [] as ParsedCustomerRow[], failed: [] as CustomerImportFailure[] };
  }

  return finalizeParsedCustomerRows(rawRows);
}

function parsePdfMadrashaColumnRows(rawLines: string[]) {
  let division = "";
  let district = "";
  let thana = "";
  let serials: string[] = [];
  let eiins: string[] = [];
  let companyNames: string[] = [];
  let villages: string[] = [];
  let mobiles: string[] = [];
  let activeColumn: "serials" | "eiins" | "names" | "villages" | "mobiles" | null = null;
  const rawRows: Record<string, unknown>[] = [];

  const normalizeInlineValue = (value: string) => value.replace(/\s+/g, " ").trim();
  const hasPageData = () => serials.length || eiins.length || companyNames.length || villages.length || mobiles.length;
  const resetPageData = () => {
    serials = [];
    eiins = [];
    companyNames = [];
    villages = [];
    mobiles = [];
    activeColumn = null;
  };

  const flushPage = () => {
    const rowCount = Math.max(serials.length, eiins.length, companyNames.length, villages.length, mobiles.length);
    for (let index = 0; index < rowCount; index += 1) {
      const sl = normalizeInlineValue(serials[index] ?? "");
      const eiin = normalizeInlineValue(eiins[index] ?? "");
      const companyName = normalizeInlineValue(companyNames[index] ?? "");
      const village = normalizeInlineValue(villages[index] ?? "");
      const mobile = normalizePhone(mobiles[index] ?? "");

      if (!sl && !eiin && !companyName && !village && !mobile) continue;

      const address = [village, thana, district, division].filter(Boolean).join(", ");
      const note = [
        eiin ? `EIIN: ${eiin}` : "",
        thana ? `Thana: ${thana}` : "",
        district ? `District: ${district}` : "",
        division ? `Division: ${division}` : "",
      ].filter(Boolean).join(" | ");

      rawRows.push({
        "SL": sl,
        "Industry": "Madrasha",
        "Company Name": companyName,
        "City/Zilla": district || thana || division,
        "Address": address,
        "Primary Phone": mobile,
        "Phone 2": "",
        "Phone 3": "",
        "Primary Email": "",
        "Email 2": "",
        "Website": "",
        "Note": note,
        "Contact Person 1 Name": "",
        "Contact Person 1 Designation": "",
        "Contact Person 1 Department": "",
        "Contact Person 1 Phone 1": "",
        "Contact Person 1 Phone 2": "",
        "Contact Person 1 Email 1": "",
        "Contact Person 1 Email 2": "",
        "Contact Person 2 Name": "",
        "Contact Person 2 Designation": "",
        "Contact Person 2 Department": "",
        "Contact Person 2 Phone 1": "",
        "Contact Person 2 Phone 2": "",
        "Contact Person 2 Email 1": "",
        "Contact Person 2 Email 2": "",
        "Lead Source": "PDF Import",
        "EIIN": eiin,
        "Village/Road": village,
        "Division": division,
        "District": district,
        "Thana": thana,
      } satisfies Record<string, unknown>);
    }
    resetPageData();
  };

  for (let index = 0; index < rawLines.length; index += 1) {
    const line = (rawLines[index] ?? "").replace(/\r/g, "").trim();
    if (!line) continue;
    if (/^list of madrasha$/i.test(line)) continue;
    if (/^page\s+\d+$/i.test(line)) continue;

    const divisionMatch = line.match(/^(.*?)(?:\s*)Division$/i);
    if (divisionMatch?.[1]) {
      if (hasPageData()) flushPage();
      division = normalizeInlineValue(divisionMatch[1]);
      continue;
    }

    const districtMatch = line.match(/^(.*?)(?:\s*)District$/i);
    if (districtMatch?.[1]) {
      district = normalizeInlineValue(districtMatch[1]);
      continue;
    }

    const thanaMatch = line.match(/^(.*?)(?:\s*)Thana$/i);
    if (thanaMatch?.[1]) {
      thana = normalizeInlineValue(thanaMatch[1]);
      activeColumn = "serials";
      continue;
    }

    if (/^Sl$/i.test(line)) {
      activeColumn = "eiins";
      continue;
    }

    if (/^Eiin$/i.test(line)) {
      activeColumn = "names";
      continue;
    }

    if (/^Name$/i.test(line)) {
      activeColumn = "villages";
      continue;
    }

    if (/^Village\/Road$/i.test(line)) {
      activeColumn = "mobiles";
      continue;
    }

    if (/^Mobile$/i.test(line)) {
      flushPage();
      continue;
    }

    if (activeColumn === "serials") {
      serials.push(line);
      continue;
    }
    if (activeColumn === "eiins") {
      eiins.push(line);
      continue;
    }
    if (activeColumn === "names") {
      companyNames.push(line);
      continue;
    }
    if (activeColumn === "villages") {
      villages.push(line);
      continue;
    }
    if (activeColumn === "mobiles") {
      mobiles.push(line);
    }
  }

  if (hasPageData()) flushPage();

  if (!rawRows.length) {
    return { rows: [] as ParsedCustomerRow[], failed: [] as CustomerImportFailure[] };
  }

  return finalizeParsedCustomerRows(rawRows);
}

async function parsePdfRows(buffer: Buffer) {
  const expectedHeaders = CUSTOMER_TEMPLATE_COLUMNS.map(normalizeHeader);

  const pdfModule = await import("pdf-parse");
  const pdfParse = (pdfModule as unknown as { default?: (buffer: Buffer) => Promise<{ text?: string }> }).default ?? (pdfModule as unknown as (buffer: Buffer) => Promise<{ text?: string }>);
  const result = await pdfParse(buffer);
  const text = String(result?.text ?? "");
  const rawLines = text.replace(/\r/g, "").split("\n");
  const lines = rawLines.map((line) => line.trim()).filter(Boolean);

  if (!lines.length) {
    return { rows: [] as ParsedCustomerRow[], failed: [{ row: 1, reason: "PDF has no readable text. If this is a scanned PDF, convert to Excel/CSV first." }] as CustomerImportFailure[] };
  }

  type Delimiter = "csv" | "pipe" | "tab";
  const parseLine = (line: string, delimiter: Delimiter) => {
    if (delimiter === "csv") return parseCsvLine(line);
    if (delimiter === "tab") return line.split("\t").map((item) => item.trim());
    return line.split("|").map((item) => item.trim());
  };

  const matchesHeader = (cells: string[]) => {
    if (cells.length < CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN) return false;
    for (let index = 0; index < CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN; index += 1) {
      if (normalizeHeader(cells[index] ?? "") !== expectedHeaders[index]) return false;
    }
    return true;
  };

  let headerIndex = -1;
  let delimiter: Delimiter | null = null;

  const scanLimit = Math.min(lines.length, 80);
  for (let index = 0; index < scanLimit; index += 1) {
    const line = lines[index] ?? "";
    const csv = parseLine(line, "csv");
    if (matchesHeader(csv)) {
      headerIndex = index;
      delimiter = "csv";
      break;
    }
    const pipe = parseLine(line, "pipe");
    if (matchesHeader(pipe)) {
      headerIndex = index;
      delimiter = "pipe";
      break;
    }
    const tab = parseLine(line, "tab");
    if (matchesHeader(tab)) {
      headerIndex = index;
      delimiter = "tab";
      break;
    }
  }

  if (headerIndex < 0 || !delimiter) {
    const madrashaColumnParsed = parsePdfMadrashaColumnRows(rawLines);
    if (madrashaColumnParsed.rows.length) {
      return madrashaColumnParsed;
    }
    const madrashaParsed = parsePdfMadrashaRows(rawLines);
    if (madrashaParsed.rows.length) {
      return madrashaParsed;
    }
    const labelValueParsed = parsePdfLabelValueRows(rawLines);
    if (labelValueParsed.rows.length) {
      return labelValueParsed;
    }
    return {
      rows: [] as ParsedCustomerRow[],
      failed: labelValueParsed.failed.length
        ? labelValueParsed.failed
        : [{
          row: 1,
          reason: "PDF template mismatch. Use the CRM customer template headers or a label/value PDF with readable text.",
        }] as CustomerImportFailure[],
    };
  }

  const rawRows: Record<string, unknown>[] = [];
  let accumulator = "";

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line) continue;
    if (/^page\s+\d+$/i.test(line)) continue;

    accumulator = accumulator ? `${accumulator} ${line}` : line;
    const cells = parseLine(accumulator, delimiter);
    if (cells.length < CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN) continue;

    const rawData: Record<string, unknown> = {};
    for (let column = 0; column < CUSTOMER_IMPORT_TEMPLATE_HEADER_LEN; column += 1) {
      rawData[CUSTOMER_TEMPLATE_RAW_KEYS[column]] = normalizeJsonValue(cells[column]);
    }
    rawRows.push(rawData);
    accumulator = "";
  }

  const finalized = finalizeParsedCustomerRows(rawRows);
  if (!finalized.rows.length && !finalized.failed.length) {
    const labelValueParsed = parsePdfLabelValueRows(rawLines);
    if (labelValueParsed.rows.length || labelValueParsed.failed.length) {
      return labelValueParsed;
    }
    return { rows: [] as ParsedCustomerRow[], failed: [{ row: 2, reason: "No data rows found in PDF." }] as CustomerImportFailure[] };
  }

  return finalized;
}

async function parseImportRows(buffer: Buffer, fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const parsed = await parsePdfRows(buffer);
    return { ...parsed, format: "PDF" as const };
  }
  const parsed = parseWorkbookRows(buffer, fileName);
  return { ...parsed, format: lower.endsWith(".csv") ? ("CSV" as const) : ("EXCEL" as const) };
}

function readTemplateField(rawData: Record<string, unknown>, candidates: string[], fallback: string | undefined) {
  for (const key of candidates) {
    const value = normalizeText(rawData[key]);
    if (value) return value;
  }
  return fallback;
}

function buildTemplateRaw(company: ExistingCustomerRecord): Record<string, unknown> {
  const raw = normalizeRawJson((company as { rawData?: Prisma.Prisma.JsonValue }).rawData);
  const primaryContact = company.contacts.find((contact) => contact.isPrimary) ?? company.contacts[0];
  const companyCity = (company as { city?: string | null }).city;

  return {
    "SL": raw["SL"] ?? "",
    "Industry": raw["Industry"] ?? company.industry,
    "Company Name": raw["Company Name"] ?? raw["name"] ?? raw["customer"] ?? company.name,
    "City/Zilla": raw["City/Zilla"] ?? raw["City / Zilla"] ?? companyCity ?? "",
    "Address": raw["Address"] ?? company.address ?? "",
    "Primary Phone": raw["Primary Phone"] ?? company.phone,
    "Phone 2": raw["Phone 2"] ?? "",
    "Phone 3": raw["Phone 3"] ?? "",
    "Primary Email": readTemplateField(raw, ["Primary Email", "Email"], ""),
    "Email 2": readTemplateField(raw, ["Email 2"], ""),
    "Website": raw["Website"] ?? company.website ?? "",
    "Note": raw["Note"] ?? company.notes ?? "",
    "Contact Person 1 Name": raw["Contact Person 1 Name"] ?? company.contactPerson ?? primaryContact?.name ?? "",
    "Contact Person 1 Designation": raw["Contact Person 1 Designation"] ?? raw["Designation"] ?? "",
    "Contact Person 1 Department": raw["Contact Person 1 Department"] ?? raw["Department"] ?? "",
    "Contact Person 1 Phone 1": raw["Contact Person 1 Phone 1"] ?? "",
    "Contact Person 1 Phone 2": raw["Contact Person 1 Phone 2"] ?? "",
    "Contact Person 1 Email 1": raw["Contact Person 1 Email 1"] ?? primaryContact?.email ?? "",
    "Contact Person 1 Email 2": raw["Contact Person 1 Email 2"] ?? "",
    "Contact Person 2 Name": raw["Contact Person 2 Name"] ?? "",
    "Contact Person 2 Designation": raw["Contact Person 2 Designation"] ?? "",
    "Contact Person 2 Department": raw["Contact Person 2 Department"] ?? "",
    "Contact Person 2 Phone 1": raw["Contact Person 2 Phone 1"] ?? "",
    "Contact Person 2 Phone 2": raw["Contact Person 2 Phone 2"] ?? "",
    "Contact Person 2 Email 1": raw["Contact Person 2 Email 1"] ?? "",
    "Contact Person 2 Email 2": raw["Contact Person 2 Email 2"] ?? "",
    "Lead Source": raw["Lead Source"] ?? "",
  };
}

function mapExportRow(company: ExistingCustomerRecord) {
  const baseRaw = normalizeRawJson((company as { rawData?: Prisma.Prisma.JsonValue }).rawData);
  const primaryContact = company.contacts.find((contact) => contact.isPrimary) ?? company.contacts[0];
  const rawData = buildTemplateRaw({
    ...company,
    rawData: baseRaw,
    contacts: company.contacts,
    phoneNumbers: company.phoneNumbers,
    communications: company.communications,
    leads: company.leads,
  } as ExistingCustomerRecord);
  return CUSTOMER_TEMPLATE_RAW_KEYS.map((key) => normalizeText(rawData[key]) ?? "");
}

function readRawValue(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const found = raw[key];
    if (found === undefined || found === null) continue;
    const value = normalizeText(found);
    if (value) return value;
  }
  return "";
}

function buildCustomerImportLogData(input: {
  actorId: string;
  fileName: string;
  format: CustomerImportFormat;
  inserted: number;
  updated: number;
  failed: CustomerImportFailure[];
}) {
  const format: ImportExportFormat = input.format === "PDF" ? "PDF" : input.format === "CSV" ? "CSV" : "EXCEL";

  return {
    type: "IMPORT" as const,
    module: "CUSTOMERS" as const,
    format,
    requestedById: input.actorId,
    fileName: input.fileName,
    status: input.failed.length ? ("FAILED" as const) : ("COMPLETED" as const),
    processedRows: input.inserted + input.updated,
    failedRows: input.failed.length,
    errorMessage: input.failed.length ? input.failed.map((item) => `Row ${item.row}: ${item.reason}`).join("; ") : undefined,
    completedAt: new Date(),
  };
}

async function applyCustomerImportRows(
  prisma: ReturnType<typeof getPrisma>,
  rows: ParsedCustomerRow[],
  actor: CustomerTransferActor,
  ownerId: string,
  initialFailures: CustomerImportFailure[] = [],
) {
  const failed = [...initialFailures];
  if (!rows.length) {
    return { inserted: 0, updated: 0, failed };
  }

  const normalizeExistingCompanyKey = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  const normalizeRawJsonRecord = (value: Prisma.Prisma.JsonValue | null | undefined) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, unknown>;
    return value as Record<string, unknown>;
  };

  const companyNames = rows.map((row) => row.companyName);
  const existingCompanies = await prisma.customerCompany.findMany({
    where: {
      OR: companyNames.map((name) => ({ name: { equals: name, mode: "insensitive" } })),
    },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      phoneNumbers: { orderBy: { createdAt: "asc" } },
      leads: true,
      communications: { orderBy: { communicationAt: "desc" }, take: 1 },
    },
  });

  const existingByName = new Map<string, ExistingCustomerRecord>();
  const duplicateExistingKeys = new Set<string>();
  for (const company of existingCompanies) {
    const key = normalizeCompanyKey(company.name);
    if (existingByName.has(key)) {
      duplicateExistingKeys.add(key);
      continue;
    }
    existingByName.set(key, company);
  }

  const operations: Prisma.Prisma.PrismaPromise<unknown>[] = [];
  let inserted = 0;
  let updated = 0;

  const mergeRawData = (existing: Prisma.Prisma.JsonValue | null | undefined, incoming: Record<string, unknown>) => {
    const base = normalizeRawJson(existing);
    const merged = { ...base };
    const templateEntries = Object.entries(incoming);

    for (const [key, value] of templateEntries) {
      const asString = normalizeText(value);
      if (asString === undefined) continue;
      if (key === "SL") continue;
      if (["Created By", "Created By Role", "Created At"].includes(key) && normalizeText(base[key])) continue;
      merged[key] = asString;
    }

    for (const alias of ["Contact Person 1 Designation", "Designation"]) {
      const value = normalizeText(incoming[alias]);
      if (value) merged["Contact Person 1 Designation"] = value;
    }
    for (const alias of ["Contact Person 2 Designation"]) {
      const value = normalizeText(incoming[alias]);
      if (value) merged["Contact Person 2 Designation"] = value;
    }

    return merged;
  };

  for (const row of rows) {
    const rowKey = normalizeCompanyKey(row.companyName);
    if (duplicateExistingKeys.has(rowKey)) {
      failed.push({ row: row.row, reason: `Multiple existing records match "${row.companyName}".` });
      continue;
    }

    const existing = existingByName.get(rowKey);
    const existingAssignedToId = (existing as (ExistingCustomerRecord & { assignedToId?: string | null }) | undefined)?.assignedToId;
    const assignedRelation = existingAssignedToId ? {} : { assignedTo: { connect: { id: ownerId } } };

    const mergedRawData = existing
      ? mergeRawData((existing as { rawData?: Prisma.Prisma.JsonValue }).rawData, row.rawData)
      : row.rawData;

    const companyPayload = {
      name: row.companyName,
      contactPerson: row.contactPerson ?? null,
      phone: row.primaryPhone,
      industry: row.industry ?? "General",
      phone2: row.phone2 || readRawValue(row.rawData, ["Phone 2"]) || undefined,
      city: row.city,
      address: row.address,
      website: row.website,
      notes: row.note ? row.note : undefined,
      totalLeads: row.totalLeads,
      lastCommunication: row.lastCommunication ?? undefined,
      rawData: mergedRawData,
      ...(assignedRelation ? assignedRelation : {}),
    } as Prisma.Prisma.CustomerCompanyUpdateInput & { rawData?: Prisma.Prisma.JsonValue };

    if (existing) {
      const contactCreateMutation = buildContactCreateMutation(row);
      const phoneCreateMutation = buildPhoneCreateMutation(row);
      const contactCreateItems = Array.isArray(contactCreateMutation?.create) ? contactCreateMutation.create : [];
      const phoneCreateItems = Array.isArray(phoneCreateMutation.create) ? phoneCreateMutation.create : [];
      const existingContactSignatures = new Set(
        existing.contacts.map((contact) => `${(contact.name ?? "").trim().toLowerCase()}|${(contact.email ?? "").trim().toLowerCase()}|${(contact.mobile ?? "").trim()}`),
      );
      const newContacts = contactCreateItems.filter((contact) => {
        const signature = `${(contact.name ?? "").trim().toLowerCase()}|${(contact.email ?? "").trim().toLowerCase()}|${(contact.mobile ?? "").trim()}`;
        return signature !== "||" && !existingContactSignatures.has(signature);
      });
      const existingNumbers = new Set(existing.phoneNumbers.map((phoneNumber) => normalizeExistingCompanyKey(phoneNumber.number)));
      const newPhoneNumbers = phoneCreateItems.filter((phoneNumber) => !existingNumbers.has(normalizeExistingCompanyKey(phoneNumber.number)));
      const existingRaw = normalizeRawJsonRecord((existing as { rawData?: Prisma.Prisma.JsonValue }).rawData);
      const existingCreatedBy = normalizeText(existingRaw["Created By"]);
      const existingCreatedAt = normalizeText(existingRaw["Created At"]);

      updated += 1;
      operations.push(prisma.customerCompany.update({
        where: { id: existing.id },
        data: {
          ...companyPayload,
          contactPerson: row.contactPerson ?? existing.contactPerson ?? companyPayload.contactPerson,
          phone: row.primaryPhone || existing.phone || companyPayload.phone,
          industry: row.industry ?? existing.industry ?? companyPayload.industry,
          phone2: row.phone2 || existing.phone2 || companyPayload.phone2,
          city: row.city ?? existing.city ?? companyPayload.city,
          address: row.address ?? existing.address ?? companyPayload.address,
          website: row.website ?? existing.website ?? companyPayload.website,
          notes: row.note || existing.notes || companyPayload.notes,
          rawData: {
            ...mergedRawData,
            ...(existingCreatedBy ? { "Created By": existingCreatedBy } : {}),
            ...(normalizeText(existingRaw["Created By Role"]) ? { "Created By Role": existingRaw["Created By Role"] } : {}),
            ...(existingCreatedAt ? { "Created At": existingCreatedAt } : {}),
          } as Prisma.Prisma.InputJsonValue,
          contacts: newContacts.length ? { create: newContacts } : undefined,
          phoneNumbers: newPhoneNumbers.length ? { create: newPhoneNumbers } : undefined,
        },
      }));
      continue;
    }

    inserted += 1;
    operations.push(prisma.customerCompany.create({
      data: {
        ...companyPayload,
        contacts: buildContactCreateMutation(row),
        phoneNumbers: buildPhoneCreateMutation(row),
      } as any,
    }));
  }

  if (operations.length) {
    await prisma.$transaction(operations);
  }

  return { inserted, updated, failed };
}

export async function previewCustomerImportFile(buffer: Buffer, fileName: string): Promise<CustomerImportPreviewResult> {
  const parsed = await parseImportRows(buffer, fileName);
  const firstRow = parsed.rows[0];

  return {
    success: true,
    format: parsed.format,
    totalRows: parsed.rows.length,
    failed: parsed.failed,
    previewRows: parsed.rows.slice(0, 5).map((row) => ({
      companyName: row.companyName,
      primaryPhone: row.primaryPhone,
      city: row.city,
      address: row.address,
      industry: row.industry,
    })),
    context: firstRow ? {
      division: readRawValue(firstRow.rawData, ["Division"]),
      district: readRawValue(firstRow.rawData, ["District"]),
      thana: readRawValue(firstRow.rawData, ["Thana"]),
      industry: firstRow.industry,
    } : undefined,
  };
}

export async function importCustomersFromFile(buffer: Buffer, fileName: string, actor: CustomerTransferActor): Promise<CustomerImportResult> {
  const prisma = getPrisma();
  const fileLower = fileName.toLowerCase();
  const format: CustomerImportFormat = fileLower.endsWith(".csv") ? "CSV" : fileLower.endsWith(".pdf") ? "PDF" : "EXCEL";
  const ownerId = actor.role !== "MARKETER" && actor.importToSelf
    ? actor.id
    : await resolveCustomerOwnerId(
        prisma,
        { id: actor.id, role: actor.role },
        actor.assignedToId,
        { requireSelectionForElevated: true },
      );
  if (!ownerId) {
    throw new Error("A marketer is required for customer import.");
  }
  const parsed = await parseImportRows(buffer, fileName);
  const result = await applyCustomerImportRows(prisma, parsed.rows, actor, ownerId, parsed.failed);

  await prisma.importExportLog.create({
    data: buildCustomerImportLogData({
      actorId: actor.id,
      fileName,
      format,
      inserted: result.inserted,
      updated: result.updated,
      failed: result.failed,
    }),
  });

  return {
    success: true,
    inserted: result.inserted,
    updated: result.updated,
    failed: result.failed,
  };
}

export async function importCustomersFromPdfAssignments(
  buffer: Buffer,
  fileName: string,
  actor: CustomerTransferActor,
  assignments: CustomerPdfAssignmentInput[],
): Promise<CustomerDistributedImportResult> {
  return importCustomersWithAssignments(buffer, fileName, actor, assignments);
}

export async function importCustomersWithAssignments(
  buffer: Buffer,
  fileName: string,
  actor: CustomerTransferActor,
  assignments: CustomerPdfAssignmentInput[],
): Promise<CustomerDistributedImportResult> {
  const prisma = getPrisma();
  const parsed = await parseImportRows(buffer, fileName);

  if (!parsed.rows.length) {
    await prisma.importExportLog.create({
      data: buildCustomerImportLogData({
        actorId: actor.id,
        fileName,
        format: parsed.format,
        inserted: 0,
        updated: 0,
        failed: parsed.failed,
      }),
    });

    return {
      success: true,
      inserted: 0,
      updated: 0,
      failed: parsed.failed,
      distribution: [],
    };
  }

  const normalizedAssignments = actor.role === "MARKETER"
    ? [{ assignedToId: actor.id, count: parsed.rows.length }]
    : assignments
      .map((assignment) => ({
        assignedToId: assignment.assignedToId?.trim() ?? "",
        count: Math.max(0, Math.floor(assignment.count)),
      }))
      .filter((assignment): assignment is { assignedToId: string; count: number } => Boolean(assignment.assignedToId) && assignment.count > 0);

  const assignedTotal = normalizedAssignments.reduce((sum, item) => sum + item.count, 0);
  if (assignedTotal > parsed.rows.length) {
    throw new Error(`Assigned quantity exceeds available rows. Total rows: ${parsed.rows.length}, assigned: ${assignedTotal}.`);
  }

  const distribution: CustomerDistributionSummary[] = [];
  const combinedFailed = [...parsed.failed];
  let inserted = 0;
  let updated = 0;
  let offset = 0;
  const heldForLaterCount = actor.role !== "MARKETER" ? Math.max(parsed.rows.length - assignedTotal, 0) : 0;

  for (const assignment of normalizedAssignments) {
    const ownerId = await resolveCustomerOwnerId(
      prisma,
      { id: actor.id, role: actor.role },
      assignment.assignedToId,
      { requireSelectionForElevated: true },
    );
    if (!ownerId) {
      throw new Error("A marketer is required for each PDF assignment.");
    }
    const chunk = parsed.rows.slice(offset, offset + assignment.count);
    const chunkResult = await applyCustomerImportRows(prisma, chunk, actor, ownerId, []);
    inserted += chunkResult.inserted;
    updated += chunkResult.updated;
    combinedFailed.push(...chunkResult.failed);
    distribution.push({
      assignedToId: ownerId,
      requestedCount: assignment.count,
      inserted: chunkResult.inserted,
      updated: chunkResult.updated,
      failed: chunkResult.failed.length,
    });
    offset += assignment.count;
  }

  if (heldForLaterCount > 0) {
    const holdChunk = parsed.rows.slice(offset);
    const holdResult = await applyCustomerImportRows(prisma, holdChunk, actor, actor.id, []);
    inserted += holdResult.inserted;
    updated += holdResult.updated;
    combinedFailed.push(...holdResult.failed);
  }

  await prisma.importExportLog.create({
    data: buildCustomerImportLogData({
      actorId: actor.id,
      fileName,
      format: parsed.format,
      inserted,
      updated,
      failed: combinedFailed,
    }),
  });

  return {
    success: true,
    inserted,
    updated,
    failed: combinedFailed,
    distribution,
    heldForLaterCount,
  };
}

export async function exportCustomers(
  actor: CustomerTransferActor,
  format: CustomerExportFormat,
  filters?: {
    search?: string;
    city?: string;
    industry?: string;
    assignedToId?: string;
  },
) {
  const prisma = getPrisma();
  const where = await buildCustomerScopeWhere(prisma, { id: actor.id, role: actor.role }, filters);
  const companies = await prisma.customerCompany.findMany({
    where,
    include: {
      assignedTo: true,
      contacts: { orderBy: { createdAt: "asc" } },
      phoneNumbers: { orderBy: { createdAt: "asc" } },
      leads: true,
      communications: { orderBy: { communicationAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const rows = companies.map((company) => mapExportRow(company));
  const worksheet = XLSX.utils.aoa_to_sheet([[...CUSTOMER_TEMPLATE_COLUMNS], ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

  const output = format === "csv"
    ? Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8")
    : Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  await prisma.importExportLog.create({
    data: {
      type: "EXPORT",
      module: "CUSTOMERS",
      format: format === "csv" ? "CSV" : "EXCEL",
      requestedById: actor.id,
      fileName: format === "csv" ? "customers-export.csv" : "customers-export.xlsx",
      status: "COMPLETED",
      processedRows: rows.length,
      failedRows: 0,
      completedAt: new Date(),
    },
  });

  return {
    buffer: output,
    rowCount: rows.length,
    fileName: format === "csv" ? "customers-export.csv" : "customers-export.xlsx",
    contentType: format === "csv"
      ? "text/csv; charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}



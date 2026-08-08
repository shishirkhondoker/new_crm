"use server";

import { format } from "date-fns";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type * as Prisma from "@prisma/client";
import { getCurrentSession } from "@/lib/auth";
import { createProductEntry, deleteProductEntry, updateProductEntry } from "@/lib/product-center";
import type { EmployeeRow } from "@/lib/crm-data";
import { createSetupToken, hashPassword, verifyPassword } from "@/lib/password-auth";
import { getPrisma } from "@/lib/prisma";
import { normalizeTaskReminderValue } from "@/lib/task-reminders";
import { buildCustomerScopeWhere, hasCustomerAccess, resolveCustomerOwnerId } from "@/lib/customer-ownership";
import { hasLeadAccess, resolveLeadOwnerId } from "@/lib/lead-ownership";
import { createMarketerSuggestion, markSuggestionRead } from "@/lib/suggestion-center";
import { roleHome, type Role } from "@/lib/utils";

const DEFAULT_ADMIN_EMAIL = "shajib.mugnee@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "Crm@admin1234";
const DEFAULT_ADMIN_MOBILE = "01700000001";
const AUTH_SETUP_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_OTP_WINDOW_MS = 5 * 60 * 1000;

type OtpPurpose = "FIRST_LOGIN" | "PASSWORD_RESET";

function resolveAdminEmail() {
  return DEFAULT_ADMIN_EMAIL.trim().toLowerCase();
}

function isPrimaryAdminEmail(value?: string | null) {
  return normalizeEmail(value ?? null) === resolveAdminEmail();
}

function isAuthUpgradeUnavailable(error: unknown) {
  const message = String((error as { message?: string })?.message ?? "");
  const code = String((error as { code?: string })?.code ?? "");

  return (
    code === "P2021" ||
    code === "P2022" ||
    message.includes("Unknown argument `firstLogin`") ||
    message.includes("Unknown argument `passwordNotSet`") ||
    message.includes("Unknown argument `lastLoginAt`") ||
    message.includes("Unknown argument `authSetupToken`") ||
    message.includes("Unknown argument `purpose`") ||
    message.includes("does not exist in the current database")
  );
}

function isDatabaseConnectionIssue(error: unknown) {
  const message = String((error as { message?: string })?.message ?? "");
  const code = String((error as { code?: string })?.code ?? "");

  return (
    code === "P1000" ||
    code === "P1001" ||
    code === "P1002" ||
    message.includes("Authentication failed against the database server") ||
    message.includes("password authentication failed") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connect ECONNREFUSED") ||
    message.includes("getaddrinfo ENOTFOUND")
  );
}

function databaseConnectionMessage(error: unknown) {
  const message = String((error as { message?: string })?.message ?? "");

  if (message.includes("Authentication failed against the database server") || message.includes("password authentication failed")) {
    return "Database connection issue detected. Check the database configuration and restart the server.";
  }

  return "Database connection issue detected. Ensure Postgres is running and the database configuration is correct.";
}

function authUpgradeMessage() {
  return "Database auth upgrade is pending. Run prisma migrate deploy and restart the app.";
}

function normalizeMobile(value: FormDataEntryValue | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("88") ? digits.slice(2) : digits;
}

function normalizeEmail(value: FormDataEntryValue | null) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function normalizeLoginIdentifier(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (raw.includes("@")) return raw.toLowerCase();
  return normalizeMobile(raw);
}

function internalMobileForEmail(email: string) {
  return `email:${email}`;
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function intValue(formData: FormData, key: string, fallback = 0) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value ? new Date(value) : undefined;
}

function parseDateTimeInput(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return undefined;

  const parsed = new Date(value);
  return validDate(parsed);
}

function dateTimeWithClientOffset(formData: FormData, key: string, offsetKey: string) {
  const value = text(formData, key);
  if (!value) return undefined;

  const offsetRaw = Number(formData.get(offsetKey));
  const offsetMinutes = Number.isFinite(offsetRaw) ? offsetRaw : undefined;
  const datetime = value;
  const isoLike = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
  const match = datetime.match(isoLike);

  if (offsetMinutes === undefined || !match) {
    return parseDateTimeInput(formData, key);
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  return validDate(new Date(Date.UTC(year, month, day, hour, minute, second) + offsetMinutes * 60 * 1000));
}

function dateTimeFromDateAndTimeWithClientOffset(formData: FormData, dateKey: string, timeKey: string, offsetKey: string) {
  const date = text(formData, dateKey);
  if (!date) return undefined;

  const time = text(formData, timeKey) ?? "10:00";

  const offsetRaw = Number(formData.get(offsetKey));
  const offsetMinutes = Number.isFinite(offsetRaw) ? offsetRaw : undefined;
  const datetime = `${date}T${time}`;
  const isoLike = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
  const match = datetime.match(isoLike);

  if (offsetMinutes === undefined || !match) {
    return validDate(new Date(datetime));
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  return validDate(new Date(Date.UTC(year, month, day, hour, minute, second) + offsetMinutes * 60 * 1000));
}

function validDate(value: Date | undefined) {
  if (!value) return undefined;
  return Number.isNaN(value.getTime()) ? undefined : value;
}

function cleanText(value: FormDataEntryValue | null) {
  const nextText = textValue(value);
  return nextText ?? "";
}

function textValue(value: FormDataEntryValue | null) {
  if (value === null) return "";
  const nextValue = String(value).trim();
  return nextValue || "";
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function readTemplateText(formData: FormData, key: string) {
  return cleanText(formData.get(key));
}

function readTemplateNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : 0;
}

function readTemplateTextList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0);
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function buildCustomerTemplateRaw(formData: FormData) {
  const sl = readTemplateText(formData, "sl");
  const industry = readTemplateText(formData, "industry");
  const companyName = readTemplateText(formData, "companyName");
  const cityOrZilla = readTemplateText(formData, "cityOrZilla");
  const address = readTemplateText(formData, "address");
  const phoneNumbers = readTemplateTextList(formData, "phoneNumbers");
  const emailAddresses = readTemplateTextList(formData, "emailAddresses");
  const primaryPhone = readTemplateText(formData, "primaryPhone") || phoneNumbers[0] || "";
  const phone2 = readTemplateText(formData, "phone2") || phoneNumbers[1] || "";
  const phone3 = readTemplateText(formData, "phone3") || phoneNumbers[2] || "";
  const primaryEmail = readTemplateText(formData, "primaryEmail") || emailAddresses[0] || "";
  const email2 = readTemplateText(formData, "email2") || emailAddresses[1] || "";
  const website = readTemplateText(formData, "website");
  const note = readTemplateText(formData, "note");
  const cp1Name = readTemplateText(formData, "contactPerson1Name");
  const cp1Designation = readTemplateText(formData, "designation1");
  const cp1Department = readTemplateText(formData, "department1");
  const cp1Phone1 = readTemplateText(formData, "cp1Phone1");
  const cp1Phone2 = readTemplateText(formData, "cp1Phone2");
  const cp1Email1 = readTemplateText(formData, "cp1Email1");
  const cp1Email2 = readTemplateText(formData, "cp1Email2");
  const cp2Name = readTemplateText(formData, "contactPerson2Name");
  const cp2Designation = readTemplateText(formData, "designation2");
  const cp2Department = readTemplateText(formData, "department2");
  const cp2Phone1 = readTemplateText(formData, "cp2Phone1");
  const cp2Phone2 = readTemplateText(formData, "cp2Phone2");
  const cp2Email1 = readTemplateText(formData, "cp2Email1");
  const cp2Email2 = readTemplateText(formData, "cp2Email2");
  const leadSource = readTemplateText(formData, "leadSource");
  const contactsJson = readTemplateText(formData, "contactsJson");
  const contacts = contactsJson ? safeJsonParse(contactsJson) : undefined;

  return {
    "SL": sl,
    "Industry": industry,
    "Company Name": companyName,
    "City/Zilla": cityOrZilla,
    "Address": address,
    "Primary Phone": primaryPhone,
    "Phone 2": phone2,
    "Phone 3": phone3,
    "Primary Email": primaryEmail,
    "Email 2": email2,
    "Website": website,
    "Note": note,
    "Phone Numbers": phoneNumbers,
    "Email Addresses": emailAddresses,
    "Contacts": Array.isArray(contacts) ? contacts : [],
    "Contact Person 1 Name": cp1Name,
    "Contact Person 1 Designation": cp1Designation,
    "Contact Person 1 Department": cp1Department,
    "Contact Person 1 Phone 1": cp1Phone1,
    "Contact Person 1 Phone 2": cp1Phone2,
    "Contact Person 1 Email 1": cp1Email1,
    "Contact Person 1 Email 2": cp1Email2,
    "Contact Person 2 Name": cp2Name,
    "Contact Person 2 Designation": cp2Designation,
    "Contact Person 2 Department": cp2Department,
    "Contact Person 2 Phone 1": cp2Phone1,
    "Contact Person 2 Phone 2": cp2Phone2,
    "Contact Person 2 Email 1": cp2Email1,
    "Contact Person 2 Email 2": cp2Email2,
    "Lead Source": leadSource,
  };
}

function buildCustomerTemplateContactPayload(formData: FormData) {
  const raw = buildCustomerTemplateRaw(formData);
  const primaryPhone = raw["Primary Phone"];
  const contactPerson = raw["Contact Person 1 Name"] || "Primary Contact";
  const primaryEmail = raw["Primary Email"] || raw["Contact Person 1 Email 1"] || raw["Contact Person 1 Email 2"] || "";
  const cp1Phone = raw["Contact Person 1 Phone 1"] || "";

  const secondaryContact = raw["Contact Person 2 Name"]
    ? {
      name: raw["Contact Person 2 Name"],
      designation: raw["Contact Person 2 Designation"] || undefined,
      department: raw["Contact Person 2 Department"] || undefined,
      email: raw["Contact Person 2 Email 1"] || raw["Contact Person 2 Email 2"] || undefined,
      mobile: raw["Contact Person 2 Phone 1"] || raw["Contact Person 2 Phone 2"] || undefined,
      isPrimary: false,
    }
    : undefined;

  return {
    rawData: raw,
    primaryPhone,
    contactPerson,
    primaryEmail: primaryEmail || undefined,
    cp1Phone,
    secondaryContact,
  };
}

function normalizeCustomerContactName(value?: string) {
  return value && value.trim().length ? value.trim() : null;
}

function buildCustomerCreateContacts(raw: ReturnType<typeof buildCustomerTemplateRaw>) {
  const contacts = [];
  const primaryContact = {
    name: normalizeCustomerContactName(raw["Contact Person 1 Name"]) || "Primary Contact",
    designation: normalizeCustomerContactName(raw["Contact Person 1 Designation"]) || undefined,
    email: normalizeCustomerContactName(raw["Contact Person 1 Email 1"]) || normalizeCustomerContactName(raw["Contact Person 1 Email 2"]) || normalizeCustomerContactName(raw["Primary Email"]) || undefined,
    mobile: normalizeCustomerContactName(raw["Contact Person 1 Phone 1"]) || normalizeCustomerContactName(raw["Contact Person 1 Phone 2"]) || normalizeCustomerContactName(raw["Primary Phone"]) || undefined,
    isPrimary: true,
} satisfies Prisma.Prisma.ContactPersonCreateWithoutCompanyInput;

  if (primaryContact.mobile || primaryContact.email || primaryContact.designation || primaryContact.name !== "Primary Contact") {
    contacts.push(primaryContact);
  }

  const secondaryContactName = normalizeCustomerContactName(raw["Contact Person 2 Name"]);
  if (secondaryContactName) {
    contacts.push({
      name: secondaryContactName,
      designation: normalizeCustomerContactName(raw["Contact Person 2 Designation"]) || undefined,
      email: normalizeCustomerContactName(raw["Contact Person 2 Email 1"]) || normalizeCustomerContactName(raw["Contact Person 2 Email 2"]) || undefined,
      mobile: normalizeCustomerContactName(raw["Contact Person 2 Phone 1"]) || normalizeCustomerContactName(raw["Contact Person 2 Phone 2"]) || undefined,
      isPrimary: false,
    } satisfies Prisma.Prisma.ContactPersonCreateWithoutCompanyInput);
  }

  return contacts;
}

function buildCustomerCreatePhoneNumbers(raw: ReturnType<typeof buildCustomerTemplateRaw>) {
  const ordered = [
    ["Primary", raw["Primary Phone"]],
    ["Phone 2", raw["Phone 2"]],
    ["Phone 3", raw["Phone 3"]],
    ["Phone 1", raw["Contact Person 1 Phone 1"]],
    ["Phone 2", raw["Contact Person 1 Phone 2"]],
    ["Phone 1", raw["Contact Person 2 Phone 1"]],
    ["Phone 2", raw["Contact Person 2 Phone 2"]],
  ];

  const seen = new Set<string>();
  const creates: Prisma.Prisma.PhoneNumberCreateWithoutCompanyInput[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const [label, rawValue] = ordered[index] ?? [];
    const number = readTemplateTextFromString(rawValue);
    if (!number) continue;
    if (seen.has(number)) continue;

    seen.add(number);
    creates.push({
      label: index === 0 ? "Primary" : `${label} ${creates.length}`,
      number,
      whatsapp: false,
    });
  }

  if (!creates.length) {
    // Keep fallback to avoid invalid empty phone inserts.
  }

  return creates;
}

function readTemplateTextFromString(value: string) {
  const sanitized = value.replace(/\s+/g, "").trim();
  return sanitized || "";
}

function normalizePhoneCandidate(value: unknown) {
  const text = typeof value === "string" ? value : "";
  return readTemplateTextFromString(text);
}

function normalizeEmailCandidate(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.includes("@") ? text : "";
}

function dedupeTextValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function normalizeCompanyNameKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeRawCustomerJson(value: Prisma.Prisma.JsonValue | undefined | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, unknown>;
  return value as Record<string, unknown>;
}

function startOfCurrentDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toTaskDate(value: Date | undefined) {
  const date = validDate(value) ?? new Date();
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function followUpStatusForDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date < today) return "OVERDUE" as const;
  if (date < tomorrow) return "TODAY" as const;
  return "UPCOMING" as const;
}

const quickCommunicationMethodLabels = {
  CALL: "Phone Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
} as const;

type QuickCommunicationMethod = keyof typeof quickCommunicationMethodLabels;

function isQuickCommunicationMethod(value: string): value is QuickCommunicationMethod {
  return value in quickCommunicationMethodLabels;
}

function quickCommunicationLabel(method: QuickCommunicationMethod) {
  return quickCommunicationMethodLabels[method];
}

function revalidateCustomerViews(customerId?: string) {
  [
    "/admin/customers",
    "/supervisor/customers",
    "/marketer/customers",
    "/admin/cold-customers",
    "/supervisor/cold-customers",
    "/marketer/cold-customers",
    customerId ? `/customers/${customerId}` : undefined,
  ].filter((path): path is string => Boolean(path)).forEach((path) => revalidatePath(path));
}

async function actionUser() {
  const session = await getCurrentSession();
  if (!session.mobile) throw new Error("You must be logged in.");

  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: {
      mobile: session.mobile,
      ...(session.role ? { role: session.role } : {}),
      status: "ACTIVE",
    },
  });

  if (!user) throw new Error("Active user session was not found.");
  return user;
}

function canManage(role: Role) {
  return role === "ADMIN" || role === "SUPERVISOR";
}

const REWARD_TRIGGER_OPTIONS = ["LEAD_CREATED", "FOLLOW_UP_COMPLETED", "MEETING_SCHEDULED", "WON_SALE", "TASK_COMPLETED", "MANUAL_ADJUSTMENT"] as const;

function normalizeRewardTrigger(value?: string) {
  if (!value) return undefined;

  const nextValue = value.trim();
  return REWARD_TRIGGER_OPTIONS.includes(nextValue as (typeof REWARD_TRIGGER_OPTIONS)[number]) ? nextValue : undefined;
}

function formatRewardRuleDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function revalidateRewardViews() {
  [
    "/admin/rewards",
    "/supervisor/rewards",
    "/marketer/rewards",
    "/admin/dashboard",
    "/supervisor/dashboard",
    "/marketer/dashboard",
    "/admin/team",
    "/supervisor/team",
  ].forEach((path) => revalidatePath(path));
}

function revalidateProductViews(productId?: string) {
  [
    "/admin/products",
    "/supervisor/products",
    "/marketer/products",
    "/admin/dashboard",
    "/supervisor/dashboard",
    "/marketer/dashboard",
    "/admin/leads",
    "/supervisor/leads",
    "/marketer/leads",
  ].forEach((path) => revalidatePath(path));

  if (productId) {
    revalidatePath(`/products/${productId}`);
  }
}

function revalidateUserViews() {
  [
    "/admin/users",
    "/admin/team",
    "/supervisor/team",
    "/admin/dashboard",
    "/supervisor/dashboard",
  ].forEach((path) => revalidatePath(path));
}

function mapEmployeeActionRow(user: {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
  designation: string | null;
  supervisorId?: string | null;
  supervisorIds?: string[];
}): EmployeeRow {
  const supervisorIds = Array.from(
    new Set([
      ...(user.supervisorIds ?? []),
      ...(user.supervisorId ? [user.supervisorId] : []),
    ]),
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email ?? "-",
    mobile: user.mobile.startsWith("email:") ? "-" : user.mobile,
    role: user.role === "ADMIN" ? "Admin" : user.role === "SUPERVISOR" ? "Supervisor" : "Marketer",
    roleKey: user.role,
    status: user.status === "ACTIVE" ? "Active" : "Inactive",
    statusKey: user.status,
    designation: user.designation ?? "-",
    supervisorId: user.supervisorId ?? null,
    supervisorIds,
    leads: 0,
    calls: 0,
    whatsapp: 0,
    emails: 0,
    meetings: 0,
    followUps: 0,
    pendingTasks: 0,
    overdueFollowUps: 0,
    sales: 0,
    rewardPoints: 0,
    conversionRate: "0%",
  };
}

function normalizeUserRole(value?: string) {
  if (value === "ADMIN" || value === "SUPERVISOR" || value === "MARKETER") return value;
  return undefined;
}

function normalizeUserStatus(value?: string) {
  if (value === "ACTIVE" || value === "INACTIVE") return value;
  return undefined;
}

async function resolveTaskAssignee(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, requestedAssignedToId?: string) {
  if (!canManage(user.role)) return user.id;

  if (user.role === "SUPERVISOR" && (!requestedAssignedToId || requestedAssignedToId === user.id)) {
    return user.id;
  }

  if (!requestedAssignedToId) {
    throw new Error("Assigned user is required.");
  }

  const assignee = await prisma.user.findFirst({
    where: {
      id: requestedAssignedToId,
      status: "ACTIVE",
      ...(user.role === "SUPERVISOR"
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
    throw new Error(
      user.role === "SUPERVISOR"
        ? "Selected user must be you or an active marketer."
        : "Selected assignee must be an active supervisor or marketer.",
    );
  }

  return assignee.id;
}

async function resolveOptionalMarketerAssignee(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, requestedAssignedToId?: string) {
  if (user.role === "MARKETER") return user.id;
  if (!requestedAssignedToId) return undefined;
  if (user.role === "SUPERVISOR" && requestedAssignedToId === user.id) return user.id;

  const assignee = await prisma.user.findFirst({
    where: {
      id: requestedAssignedToId,
      status: "ACTIVE",
      ...(user.role === "SUPERVISOR"
        ? {
            role: "MARKETER",
          }
        : {
            role: { in: ["SUPERVISOR", "MARKETER"] },
          }),
    },
    select: { id: true },
  });

  if (!assignee) {
    throw new Error(
      user.role === "SUPERVISOR"
        ? "Selected user must be you or an active marketer."
        : "Selected assignee must be an active supervisor or marketer.",
    );
  }

  return assignee.id;
}

function clampEngagementRating(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(10, Math.round(parsed)));
}

async function getTaskScopeUserIds(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: string }) {
  if (user.role === "ADMIN") return undefined;
  if (user.role === "MARKETER") return [user.id];

  const team = await prisma.user.findMany({
    where: { role: "MARKETER", status: "ACTIVE" },
    select: { id: true },
  });

  return [user.id, ...team.map((member) => member.id)];
}

async function hasTaskAccess(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { assignedToId: true, assignedById: true } });
  if (!task) return false;

  if (user.role === "ADMIN") return true;

  const scopeIds = await getTaskScopeUserIds(prisma, user);
  if (!scopeIds) return false;

  return scopeIds.includes(task.assignedToId ?? "") || scopeIds.includes(task.assignedById ?? "");
}

async function hasFollowUpAccess(prisma: ReturnType<typeof getPrisma>, user: { id: string; role: Role }, followUpId: string) {
  const followUp = await prisma.followUp.findUnique({
    where: { id: followUpId },
    select: {
      assignedToId: true,
      task: { select: { assignedToId: true, assignedById: true } },
      lead: { select: { assignedToId: true } },
      company: { select: { assignedToId: true } },
    },
  });
  if (!followUp) return false;

  if (user.role === "ADMIN") return true;

  const scopeIds = await getTaskScopeUserIds(prisma, user);
  if (!scopeIds) return false;

  return (
    scopeIds.includes(followUp.assignedToId ?? "") ||
    scopeIds.includes(followUp.task?.assignedToId ?? "") ||
    scopeIds.includes(followUp.task?.assignedById ?? "") ||
    scopeIds.includes(followUp.lead?.assignedToId ?? "") ||
    scopeIds.includes(followUp.company?.assignedToId ?? "")
  );
}

async function addTimeline(input: {
  title: string;
  description?: string;
  entity: string;
  entityId?: string;
  userId?: string;
  companyId?: string;
  leadId?: string;
  taskId?: string;
  followUpId?: string;
  communicationLogId?: string;
}) {
  const prisma = getPrisma();
  await prisma.activityTimeline.create({ data: input });
  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      action: input.title,
      entity: input.entity,
      entityId: input.entityId,
    },
  });
}

async function applyReward(trigger: string, userId: string, entity: string, entityId: string) {
  const prisma = getPrisma();
  const rule = await prisma.rewardRule.findFirst({ where: { trigger, active: true } });
  if (!rule) return;

  const eventKey = `${trigger}:${entity}:${entityId}`;
  const existing = await prisma.rewardExecutionLog.findUnique({
    where: { ruleId_eventKey: { ruleId: rule.id, eventKey } },
  });
  if (existing) return;

  await prisma.$transaction([
    prisma.rewardExecutionLog.create({
      data: {
        ruleId: rule.id,
        userId,
        eventKey,
        entity,
        entityId,
        points: rule.points,
      },
    }),
    prisma.rewardHistory.create({
      data: {
        userId,
        ruleId: rule.id,
        points: rule.points,
        reason: rule.name,
        source: "AUTO",
        entity,
        entityId,
      },
    }),
    prisma.reward.create({
      data: {
        userId,
        ruleId: rule.id,
        eventKey,
        points: rule.points,
        reason: rule.name,
        source: "AUTO",
      },
    }),
    prisma.notification.create({
      data: {
        recipientId: userId,
        title: "Reward Earned",
        message: `${rule.points} points earned for ${rule.name}.`,
        type: "REWARD_EARNED",
        entity,
        entityId,
      },
    }),
  ]);
}

async function sendLoginOtpEmail(to: string, otp: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? process.env.EMAIL_FROM;
  const appUrl = (process.env.AUTH_EMAIL_REDIRECT_TO ?? "https://crm.mugnee.com").replace(/\/$/, "");

  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Your Mugnee CRM login OTP",
        html: `<p>Your Mugnee CRM login OTP is <strong>${otp}</strong>.</p><p>This code will expire in 5 minutes.</p><p><a href="${appUrl}/login">Open Mugnee CRM</a></p>`,
        text: `Your Mugnee CRM login OTP is ${otp}. This code will expire in 5 minutes. Open CRM: ${appUrl}/login`,
      }),
    });

    if (!response.ok) {
      console.warn("OTP email provider returned an error.", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.warn("OTP email could not be sent.", error);
    return false;
  }
}

async function ensureOfficeAdmin(prisma = getPrisma()) {
  const adminEmail = resolveAdminEmail();
  const adminMobile = process.env.CRM_ADMIN_MOBILE ?? DEFAULT_ADMIN_MOBILE;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { mobile: adminMobile },
        { role: "ADMIN" },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    const canonicalName = existing.name?.trim() ? existing.name : "CRM Admin";
    const canonicalDesignation = existing.designation ?? "Administrator";
    const requiresSync =
      existing.name !== canonicalName ||
      existing.email !== adminEmail ||
      existing.mobile !== adminMobile ||
      existing.role !== "ADMIN" ||
      existing.status !== "ACTIVE" ||
      existing.designation !== canonicalDesignation;

    if (!requiresSync) {
      return existing;
    }

    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: canonicalName,
        email: adminEmail,
        mobile: adminMobile,
        role: "ADMIN",
        status: "ACTIVE",
        designation: canonicalDesignation,
      },
    });
  }

  return prisma.user.create({
    data: {
      name: "CRM Admin",
      email: adminEmail,
      mobile: adminMobile,
      role: "ADMIN",
      status: "ACTIVE",
      designation: "Administrator",
    },
  });
}

export async function adminPasswordLoginAction(formData: FormData) {
  try {
    const login = normalizeLoginIdentifier(formData.get("login") ?? formData.get("email") ?? formData.get("mobile"));
    const password = String(formData.get("password") ?? "");
    const adminEmail = resolveAdminEmail();
    const adminPassword = process.env.CRM_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
    const prisma = getPrisma();

    if (login !== adminEmail) {
      return { ok: false, message: "Admin email or password is incorrect." };
    }

    const admin = await ensureOfficeAdmin(prisma);
    const hasAccountPassword = Boolean(admin.passwordHash && !admin.firstLogin && !admin.passwordNotSet);
    const matched = hasAccountPassword
      ? verifyPassword(password, admin.passwordHash)
      : password === adminPassword;

    if (!matched) {
      return { ok: false, message: "Admin email or password is incorrect." };
    }

    await safeUpdateLastLogin(prisma, admin.id);
    await setSessionCookies("ADMIN", admin.mobile);

    return { ok: true, redirectTo: roleHome.ADMIN };
  } catch (error) {
    if (isAuthUpgradeUnavailable(error)) {
      return { ok: false, message: authUpgradeMessage() };
    }
    if (isDatabaseConnectionIssue(error)) {
      return { ok: false, message: databaseConnectionMessage(error) };
    }
    throw error;
  }
}

export async function sendOtpAction(formData: FormData) {
  try {
    const login = normalizeLoginIdentifier(formData.get("login") ?? formData.get("mobile"));
    const purpose = normalizeOtpPurpose(formData.get("purpose"));
    const prisma = getPrisma();
    const user = await findActiveUserByLogin(prisma, login);

    if (!user || user.status !== "ACTIVE") {
      return { ok: false, message: "No active CRM user exists for this email or mobile number." };
    }

    if (purpose === "FIRST_LOGIN" && !user.firstLogin && !user.passwordNotSet && user.passwordHash) {
      return { ok: false, message: "Password is already set. Use your password to log in." };
    }

    return issueTeamOtp({ prisma, user, login, purpose });
  } catch (error) {
    if (isAuthUpgradeUnavailable(error)) {
      return { ok: false, message: authUpgradeMessage() };
    }
    if (isDatabaseConnectionIssue(error)) {
      return { ok: false, message: databaseConnectionMessage(error) };
    }
    throw error;
  }
}

export async function verifyOtpAction(formData: FormData) {
  try {
    const login = normalizeLoginIdentifier(formData.get("login") ?? formData.get("mobile"));
    const otp = text(formData, "otp");
    const purpose = normalizeOtpPurpose(formData.get("purpose"));
    const prisma = getPrisma();

    if (!otp) return { ok: false, message: "Enter the OTP." };

    const record = await prisma.oTP.findFirst({
      where: {
        mobile: login,
        otp,
        purpose,
        used: false,
        expiresAt: { gt: new Date() },
        user: { status: "ACTIVE" },
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    if (!record?.user) {
      return { ok: false, message: "OTP is invalid or expired." };
    }

    await prisma.oTP.updateMany({
      where: {
        userId: record.user.id,
        mobile: login,
        purpose,
        used: false,
      },
      data: {
        used: true,
        expiresAt: new Date(),
      },
    });
    const setupToken = createSetupToken();
    await prisma.user.update({
      where: { id: record.user.id },
      data: {
        authSetupToken: setupToken,
        authSetupPurpose: purpose,
        authSetupExpiresAt: new Date(Date.now() + AUTH_SETUP_WINDOW_MS),
      },
    });

    return {
      ok: true,
      setupToken,
      message: purpose === "PASSWORD_RESET" ? "OTP verified. Set your new password." : "OTP verified. Set your password to continue.",
      nextStep: "SET_PASSWORD",
    };
  } catch (error) {
    if (isAuthUpgradeUnavailable(error)) {
      return { ok: false, message: authUpgradeMessage() };
    }
    if (isDatabaseConnectionIssue(error)) {
      return { ok: false, message: databaseConnectionMessage(error) };
    }
    throw error;
  }
}

export async function teamPasswordLoginAction(formData: FormData) {
  try {
    const login = normalizeLoginIdentifier(formData.get("login") ?? formData.get("email") ?? formData.get("mobile"));
    const password = String(formData.get("password") ?? "");
    const prisma = getPrisma();

    if (!login) {
      return { ok: false, message: "Enter your email or mobile number." };
    }

    if (!password.trim()) {
      return { ok: false, message: "Enter your password." };
    }

    const user = await findActiveUserByLogin(prisma, login);
    if (!user) {
      return { ok: false, message: "No active CRM user exists for this email or mobile number." };
    }

    if (user.firstLogin || user.passwordNotSet || !user.passwordHash) {
      return { ok: false, message: "Password is not set for this account yet. Use First Login to get an OTP." };
    }

    const matched = verifyPassword(password, user.passwordHash);
    if (!matched) {
      return { ok: false, message: "Email/mobile or password is incorrect." };
    }

    await safeUpdateLastLogin(prisma, user.id);
    await setSessionCookies(user.role as Role, user.mobile);
    return { ok: true, redirectTo: roleHome[user.role as Role] };
  } catch (error) {
    if (isAuthUpgradeUnavailable(error)) {
      return { ok: false, message: authUpgradeMessage() };
    }
    if (isDatabaseConnectionIssue(error)) {
      return { ok: false, message: databaseConnectionMessage(error) };
    }
    throw error;
  }
}

export async function completeTeamPasswordSetupAction(formData: FormData) {
  try {
    const login = normalizeLoginIdentifier(formData.get("login") ?? formData.get("mobile") ?? formData.get("email"));
    const purpose = normalizeOtpPurpose(formData.get("purpose"));
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const setupToken = text(formData, "setupToken");
    const prisma = getPrisma();

    if (!login) {
      return { ok: false, message: "Login identifier is required." };
    }

    if (!setupToken) {
      return { ok: false, message: "Your setup session expired. Please request a new OTP." };
    }

    const passwordError = validateTeamPassword(password);
    if (passwordError) {
      return { ok: false, message: passwordError };
    }

    if (password !== confirmPassword) {
      return { ok: false, message: "Password and confirm password do not match." };
    }

    const user = await findActiveUserByLogin(prisma, login);
    if (!user) {
      return { ok: false, message: "No active CRM user exists for this email or mobile number." };
    }

    if (
      user.authSetupToken !== setupToken ||
      user.authSetupPurpose !== purpose ||
      !user.authSetupExpiresAt ||
      user.authSetupExpiresAt <= new Date()
    ) {
      return { ok: false, message: "Your setup session expired. Please verify OTP again." };
    }

    const passwordHash = hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        firstLogin: false,
        passwordNotSet: false,
        authSetupToken: null,
        authSetupPurpose: null,
        authSetupExpiresAt: null,
        lastLoginAt: new Date(),
      },
    });

    await prisma.oTP.updateMany({
      where: {
        userId: user.id,
        mobile: login,
        purpose,
        used: false,
      },
      data: {
        used: true,
        expiresAt: new Date(),
      },
    });

    await setSessionCookies(user.role as Role, user.mobile);
    return {
      ok: true,
      message: purpose === "PASSWORD_RESET" ? "Password updated successfully." : "Password set successfully.",
      redirectTo: roleHome[user.role as Role],
    };
  } catch (error) {
    if (isAuthUpgradeUnavailable(error)) {
      return { ok: false, message: authUpgradeMessage() };
    }
    if (isDatabaseConnectionIssue(error)) {
      return { ok: false, message: databaseConnectionMessage(error) };
    }
    throw error;
  }
}

export async function createLeadAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const assignedToId = await resolveOptionalMarketerAssignee(prisma, { id: user.id, role: user.role as Role }, text(formData, "assignedToId"));
  const companyId = text(formData, "companyId");
  const productInterestId = text(formData, "productId");

  const lead = await prisma.lead.create({
    data: {
      title: text(formData, "title") ?? "New Lead",
      customerName: text(formData, "customerName") ?? "New Customer",
      phone: text(formData, "phone") ?? "",
      email: text(formData, "email"),
      companyId,
      productInterestId,
      assignedToId,
      createdById: user.id,
      status: "NEW_LEAD",
      priority: (text(formData, "priority") ?? "MEDIUM") as never,
      score: intValue(formData, "score", 10),
      purchaseProbability: intValue(formData, "purchaseProbability", 10),
      followUpDate: dateValue(formData, "followUpDate"),
      notes: text(formData, "notes"),
    },
  });

  await addTimeline({
    title: "Lead Created",
    description: lead.title,
    entity: "Lead",
    entityId: lead.id,
    userId: user.id,
    companyId,
    leadId: lead.id,
  });
  if (assignedToId && assignedToId !== user.id) {
    await prisma.notification.create({
      data: {
        recipientId: assignedToId,
        title: "New Lead Assigned",
        message: `${lead.title} has been assigned to you.`,
        type: "NEW_LEAD_ASSIGNED",
        entity: "Lead",
        entityId: lead.id,
      },
    });
  }
  await applyReward("LEAD_CREATED", assignedToId ?? user.id, "Lead", lead.id);
  revalidatePath("/");
  return { ok: true, id: lead.id };
}

export async function assignProductCompaniesAction(formData: FormData) {
  const user = await actionUser();
  if (!canManage(user.role as Role)) {
    return { ok: false, message: "Only admin or supervisor can assign companies from product view." };
  }

  const prisma = getPrisma();
  const productId = text(formData, "productId");
  const assignedToIdInput = text(formData, "assignedToId");
  const companyIdsRaw = text(formData, "companyIdsJson");

  if (!productId) return { ok: false, message: "Product is required." };
  if (!assignedToIdInput) return { ok: false, message: "Select a marketer first." };
  if (!companyIdsRaw) return { ok: false, message: "Select at least one company." };

  const requestedCompanyIds = safeJsonParse(companyIdsRaw);
  const companyIds = Array.isArray(requestedCompanyIds)
    ? requestedCompanyIds.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];

  if (!companyIds.length) {
    return { ok: false, message: "Select at least one company." };
  }

  const assignedToId = await resolveLeadOwnerId(prisma, { id: user.id, role: user.role as Role }, assignedToIdInput);
  if (!assignedToId) {
    return { ok: false, message: "Selected marketer is not available for this assignment." };
  }
  const product = await prisma.productService.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  });
  if (!product) {
    return { ok: false, message: "Product was not found." };
  }

  const customerScopeWhere = await buildCustomerScopeWhere(prisma, { id: user.id, role: user.role as Role });
  const companies = await prisma.customerCompany.findMany({
    where: {
      AND: [
        customerScopeWhere,
        { id: { in: companyIds } },
      ],
    },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      phoneNumbers: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!companies.length) {
    return { ok: false, message: "No accessible companies were selected." };
  }

  const existingLeads = await prisma.lead.findMany({
    where: {
      companyId: { in: companies.map((company) => company.id) },
      productInterestId: product.id,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      companyId: true,
      assignedToId: true,
      phone: true,
      email: true,
      customerName: true,
    },
  });
  const existingLeadByCompanyId = new Map<string, (typeof existingLeads)[number]>();
  for (const lead of existingLeads) {
    if (!lead.companyId || existingLeadByCompanyId.has(lead.companyId)) continue;
    existingLeadByCompanyId.set(lead.companyId, lead);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const company of companies) {
    const raw = normalizeRawCustomerJson(company.rawData);
    const phoneValues = dedupeTextValues([
      company.phone,
      company.phone2,
      ...company.phoneNumbers.map((item) => item.number),
      ...company.contacts.map((item) => item.mobile),
      typeof raw["Primary Phone"] === "string" ? raw["Primary Phone"] : undefined,
      typeof raw["Phone 2"] === "string" ? raw["Phone 2"] : undefined,
    ]);
    const emailValues = dedupeTextValues([
      ...company.contacts.map((item) => item.email),
      typeof raw["Primary Email"] === "string" ? raw["Primary Email"] : undefined,
      typeof raw["Email 1"] === "string" ? raw["Email 1"] : undefined,
      typeof raw["Email 2"] === "string" ? raw["Email 2"] : undefined,
    ]);

    const existingLead = existingLeadByCompanyId.get(company.id);
    if (existingLead) {
      await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          assignedToId,
          customerName: existingLead.customerName || company.name,
          phone: existingLead.phone || phoneValues.join(" | "),
          email: existingLead.email || (emailValues.join(" | ") || undefined),
          companyId: company.id,
          productInterestId: product.id,
        },
      });
      updated += 1;
      continue;
    }

    if (!phoneValues.length && !emailValues.length) {
      skipped += 1;
      continue;
    }

    const createdLead = await prisma.lead.create({
      data: {
        title: `${product.name} - ${company.name}`,
        customerName: company.name,
        phone: phoneValues.join(" | "),
        email: emailValues.join(" | ") || undefined,
        companyId: company.id,
        productInterestId: product.id,
        assignedToId,
        createdById: user.id,
        status: "NEW_LEAD",
        priority: "MEDIUM",
        score: 0,
        purchaseProbability: 0,
        notes: `Assigned from product ${product.name}`,
      },
    });

    await addTimeline({
      title: "Lead Created",
      description: createdLead.title,
      entity: "Lead",
      entityId: createdLead.id,
      userId: user.id,
      companyId: company.id,
      leadId: createdLead.id,
    });
    created += 1;
  }

  if (assignedToId !== user.id && created + updated > 0) {
    await prisma.notification.create({
      data: {
        recipientId: assignedToId,
        title: "Product Contact List Assigned",
        message: `${created + updated} company record${created + updated === 1 ? "" : "s"} have been assigned to you for ${product.name}.`,
        type: "NEW_LEAD_ASSIGNED",
        entity: "ProductService",
        entityId: product.id,
      },
    });
  }

  revalidateProductViews(product.id);
  revalidatePath("/");
  return {
    ok: true,
    created,
    updated,
    skipped,
    message: `${created} created, ${updated} updated, ${skipped} skipped.`,
  };
}

export async function createCustomerAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const rawData = buildCustomerTemplateRaw(formData);
  const rawDataMeta = rawData as unknown as Record<string, unknown>;
  rawDataMeta["Created By"] = user.name?.trim() || user.mobile || "Unknown User";
  rawDataMeta["Created By Role"] = user.role;
  rawDataMeta["Created At"] = new Date().toISOString();
  const assignedToId = await resolveCustomerOwnerId(prisma, { id: user.id, role: user.role as Role }, text(formData, "assignedToId"), {
    requireSelectionForElevated: true,
  });
  const companyName = rawData["Company Name"]?.trim() || "New Company";
  const existingSl = rawData["SL"]?.trim?.() || "";
  const nextSl = existingSl || String((await prisma.customerCompany.count()) + 1);
  rawData["SL"] = nextSl;

  if (!rawData["Company Name"]?.trim()) {
    return { ok: false, message: "Company Name is required." };
  }

  const contacts = buildCustomerCreateContacts(rawData);
  const phoneNumbers = buildCustomerCreatePhoneNumbers(rawData);

  const rawContacts = Array.isArray(rawData["Contacts"]) ? rawData["Contacts"] : [];
  for (let index = 2; index < rawContacts.length; index += 1) {
    const entry = rawContacts[index] as Record<string, unknown>;
    const name = normalizeCustomerContactName(typeof entry.name === "string" ? entry.name : undefined) || `Contact ${index + 1}`;
    const designation = normalizeCustomerContactName(typeof entry.designation === "string" ? entry.designation : undefined) || undefined;
    const emails = Array.isArray(entry.emails) ? entry.emails.map(normalizeEmailCandidate).filter(Boolean) : [];
    const phones = Array.isArray(entry.phones) ? entry.phones.map(normalizePhoneCandidate).filter(Boolean) : [];
    const email = emails[0] || undefined;
    const mobile = phones[0] || undefined;
    if (!email && !mobile && !designation && name === `Contact ${index + 1}`) continue;
    contacts.push({
      name,
      designation,
      email,
      mobile,
      isPrimary: false,
    } satisfies Prisma.Prisma.ContactPersonCreateWithoutCompanyInput);
  }

  const phoneFromRaw = normalizePhoneCandidate(rawData["Primary Phone"]);
  const phoneCandidates = [
    ...(Array.isArray(rawData["Phone Numbers"]) ? rawData["Phone Numbers"] : []),
    ...rawContacts.flatMap((item) => {
      const entry = item as Record<string, unknown>;
      return Array.isArray(entry.phones) ? entry.phones : [];
    }),
  ].map(normalizePhoneCandidate).filter(Boolean);

  const existingNumbers = new Set(phoneNumbers.map((item) => item.number));
  for (const number of phoneCandidates) {
    if (existingNumbers.has(number)) continue;
    existingNumbers.add(number);
    phoneNumbers.push({
      label: phoneNumbers.length === 0 && number === phoneFromRaw ? "Primary" : `Phone ${phoneNumbers.length + 1}`,
      number,
      whatsapp: false,
    } satisfies Prisma.Prisma.PhoneNumberCreateWithoutCompanyInput);
  }

  const contactPerson = rawData["Contact Person 1 Name"] || contacts[0]?.name || null;
  const phone = phoneFromRaw || "";
  const existingCompany = await prisma.customerCompany.findFirst({
    where: {
      name: {
        equals: companyName,
        mode: "insensitive",
      },
    },
    include: {
      contacts: { orderBy: { createdAt: "asc" } },
      phoneNumbers: { orderBy: { createdAt: "asc" } },
    },
  });

  const mergedRawData = (() => {
    if (!existingCompany) return rawData as Prisma.Prisma.JsonValue;
    const base = normalizeRawCustomerJson(existingCompany.rawData);
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(rawDataMeta)) {
      if (key === "SL") continue;
      if (["Created By", "Created By Role", "Created At"].includes(key) && base[key]) continue;
      merged[key] = value;
    }
    return merged as Prisma.Prisma.JsonValue;
  })();

  const contactCreates = existingCompany
    ? contacts
      .filter((contact) => {
        const signature = `${(contact.name ?? "").trim().toLowerCase()}|${(contact.email ?? "").trim().toLowerCase()}|${(contact.mobile ?? "").trim()}`;
        const existingSignatures = new Set(existingCompany.contacts.map((item) => `${(item.name ?? "").trim().toLowerCase()}|${(item.email ?? "").trim().toLowerCase()}|${(item.mobile ?? "").trim()}`));
        return signature !== "||" && !existingSignatures.has(signature);
      })
      .map((contact) => ({ ...contact, whatsapp: undefined }))
    : contacts.map((contact) => ({ ...contact, whatsapp: undefined }));

  const phoneCreates = existingCompany
    ? phoneNumbers.filter((item) => {
      const existingNumbers = new Set(existingCompany.phoneNumbers.map((phoneNumber) => normalizeCompanyNameKey(phoneNumber.number)));
      return !existingNumbers.has(normalizeCompanyNameKey(item.number));
    })
    : phoneNumbers;

  const company = existingCompany
    ? await prisma.customerCompany.update({
      where: { id: existingCompany.id },
      data: {
        industry: rawData["Industry"] || existingCompany.industry || "",
        contactPerson: contactPerson ?? existingCompany.contactPerson,
        phone: phone || existingCompany.phone,
        address: rawData["Address"] || existingCompany.address || undefined,
        website: rawData["Website"] || existingCompany.website || undefined,
        notes: rawData["Note"] || existingCompany.notes || undefined,
        rawData: mergedRawData,
        assignedToId: existingCompany.assignedToId ?? assignedToId,
        contacts: contactCreates.length ? { create: contactCreates } : undefined,
        phoneNumbers: phoneCreates.length ? { create: phoneCreates } : undefined,
      } as any,
    })
    : await prisma.customerCompany.create({
      data: {
        name: companyName,
        industry: rawData["Industry"] || "",
        contactPerson,
        phone,
        totalLeads: 0,
        address: rawData["Address"] || undefined,
        website: rawData["Website"] || undefined,
        notes: rawData["Note"] || undefined,
        rawData,
        assignedToId,
        contacts: contactCreates.length ? { create: contactCreates } : undefined,
        phoneNumbers: phoneCreates.length ? { create: phoneCreates } : undefined,
      } as any,
    });

  await addTimeline({
    title: existingCompany ? "Customer Updated" : "Customer Created",
    description: company.name,
    entity: "CustomerCompany",
    entityId: company.id,
    userId: user.id,
    companyId: company.id,
  });

  const productId = text(formData, "productId");
  if (productId) {
    const product = await prisma.productService.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (product) {
      const normalizedRaw = normalizeRawCustomerJson(company.rawData);
      const contactRows = await prisma.contactPerson.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: "asc" },
        select: { email: true, mobile: true },
      });
      const phoneRows = await prisma.phoneNumber.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: "asc" },
        select: { number: true },
      });

      const phoneValues = dedupeTextValues([
        company.phone,
        company.phone2,
        ...phoneRows.map((item) => item.number),
        ...contactRows.map((item) => item.mobile),
        typeof normalizedRaw["Primary Phone"] === "string" ? normalizedRaw["Primary Phone"] : undefined,
        typeof normalizedRaw["Phone 2"] === "string" ? normalizedRaw["Phone 2"] : undefined,
      ]);
      const emailValues = dedupeTextValues([
        ...contactRows.map((item) => item.email),
        typeof normalizedRaw["Primary Email"] === "string" ? normalizedRaw["Primary Email"] : undefined,
        typeof normalizedRaw["Email 1"] === "string" ? normalizedRaw["Email 1"] : undefined,
        typeof normalizedRaw["Email 2"] === "string" ? normalizedRaw["Email 2"] : undefined,
      ]);

      const existingLead = await prisma.lead.findFirst({
        where: {
          companyId: company.id,
          productInterestId: product.id,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          assignedToId: true,
          customerName: true,
          phone: true,
          email: true,
        },
      });

      if (existingLead) {
        await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            assignedToId,
            customerName: existingLead.customerName || company.name,
            phone: existingLead.phone || phoneValues.join(" | "),
            email: existingLead.email || (emailValues.join(" | ") || undefined),
            companyId: company.id,
            productInterestId: product.id,
          },
        });
      } else if (phoneValues.length || emailValues.length) {
        const createdLead = await prisma.lead.create({
          data: {
            title: `${product.name} - ${company.name}`,
            customerName: company.name,
            phone: phoneValues.join(" | "),
            email: emailValues.join(" | ") || undefined,
            companyId: company.id,
            productInterestId: product.id,
            assignedToId,
            createdById: user.id,
            status: "NEW_LEAD",
            priority: "MEDIUM",
            score: 0,
            purchaseProbability: 0,
            notes: `Assigned from product ${product.name}`,
          },
        });

        await addTimeline({
          title: "Lead Created",
          description: createdLead.title,
          entity: "Lead",
          entityId: createdLead.id,
          userId: user.id,
          companyId: company.id,
          leadId: createdLead.id,
        });
      }

      if (assignedToId && assignedToId !== user.id) {
        await prisma.notification.create({
          data: {
            recipientId: assignedToId,
            title: "Product Contact Company Assigned",
            message: `${company.name} has been assigned to you for ${product.name}.`,
            type: "NEW_LEAD_ASSIGNED",
            entity: "ProductService",
            entityId: product.id,
          },
        });
      }

      revalidateProductViews(product.id);
    }
  }

  revalidateCustomerViews(company.id);
  revalidatePath("/");
  return { ok: true, id: company.id };
}

export async function createProductAction(formData: FormData) {
  const user = await actionUser();
  const name = text(formData, "name");
  const category = text(formData, "category");
  const price = Number(formData.get("price"));

  if (!name) return { ok: false, message: "Product name is required." };
  if (!category) return { ok: false, message: "Category is required." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, message: "Valid price is required." };

  const created = await createProductEntry(
    { id: user.id, role: user.role as Role, name: user.name ?? undefined },
    {
      name,
      category,
      brand: text(formData, "brand"),
      price,
      imageUrl: text(formData, "imageUrl"),
      description: text(formData, "description"),
      specification: text(formData, "specification"),
    },
  );

  revalidateProductViews(created.product.id);
  return { ok: true, id: created.product.id, row: created.row };
}

export async function updateProductAction(formData: FormData) {
  const user = await actionUser();
  const id = text(formData, "id");
  const name = text(formData, "name");
  const category = text(formData, "category");
  const price = Number(formData.get("price"));

  if (!id) return { ok: false, message: "Product id is required." };
  if (!name) return { ok: false, message: "Product name is required." };
  if (!category) return { ok: false, message: "Category is required." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, message: "Valid price is required." };

  const updated = await updateProductEntry(
    { id: user.id, role: user.role as Role, name: user.name ?? undefined },
    id,
    {
      name,
      category,
      brand: text(formData, "brand"),
      price,
      imageUrl: text(formData, "imageUrl"),
      description: text(formData, "description"),
      specification: text(formData, "specification"),
      status: (text(formData, "status") as "ACTIVE" | "INACTIVE" | undefined) ?? "ACTIVE",
    },
  );

  revalidateProductViews(updated.product.id);
  return { ok: true, id: updated.product.id, row: updated.row };
}

export async function deleteProductAction(formData: FormData) {
  const user = await actionUser();
  const id = text(formData, "id");
  if (!id) return { ok: false, message: "Product id is required." };

  const deleted = await deleteProductEntry(
    { id: user.id, role: user.role as Role, name: user.name ?? undefined },
    id,
  );

  revalidateProductViews(deleted.id);
  return { ok: true, id: deleted.id };
}

export async function createTaskAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const assignedToId = await resolveTaskAssignee(prisma, { id: user.id, role: user.role as Role }, text(formData, "assignedToId"));
  const status = (text(formData, "status") ?? "PENDING") as never;
  const taskDate = toTaskDate(dateValue(formData, "taskDate") ?? dateValue(formData, "dueDate") ?? dateValue(formData, "taskTime"));

  const task = await prisma.task.create({
    data: {
      title: text(formData, "title") ?? "New Task",
      description: text(formData, "description"),
      assignedById: user.id,
      assignedToId,
      companyName: text(formData, "companyName"),
      leadName: text(formData, "leadName"),
      productId: text(formData, "productId"),
      taskDate,
      isPrevious: status !== "COMPLETED" && taskDate < startOfCurrentDay(),
      dueDate: dateValue(formData, "dueDate"),
      taskTime: dateValue(formData, "taskTime"),
      priority: (text(formData, "priority") ?? "MEDIUM") as never,
      status,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
      completedById: status === "COMPLETED" ? user.id : undefined,
      reminder: normalizeTaskReminderValue(text(formData, "reminder")),
      notes: text(formData, "notes"),
    },
  });

  await addTimeline({
    title: "Task Created",
    description: task.title,
    entity: "Task",
    entityId: task.id,
    userId: user.id,
    taskId: task.id,
  });
  if (assignedToId) {
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
  revalidatePath("/");
  return { ok: true, id: task.id };
}

export async function completeTaskFromTodayAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const status = text(formData, "status");

  if (!id || status !== "COMPLETED") {
    return { ok: false, message: "Invalid completion request." };
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      companyId: true,
      leadId: true,
      assignedToId: true,
      assignedById: true,
    },
  });
  if (!task) return { ok: false, message: "Task not found." };
  if (!(await hasTaskAccess(prisma, user, id))) {
    return { ok: false, message: "You are not allowed to complete this task." };
  }

  const completedAt = new Date();
  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt,
      completedById: user.id,
      isPrevious: false,
    },
  });
  await addTimeline({
    title: "Task Completed",
    description: `${updatedTask.title} marked completed`,
    entity: "Task",
    entityId: updatedTask.id,
    userId: user.id,
    companyId: updatedTask.companyId ?? undefined,
    leadId: updatedTask.leadId ?? undefined,
    taskId: updatedTask.id,
  });

  if (updatedTask.assignedById) {
    await prisma.notification.create({
      data: {
        recipientId: updatedTask.assignedById,
        title: "Task Completed",
        message: updatedTask.title,
        type: "TASK_COMPLETED",
        entity: "Task",
        entityId: updatedTask.id,
      },
    });
  }

  revalidatePath("/");
  return { ok: true, task: updatedTask };
}

export async function completeTaskWithFollowUpAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const method = text(formData, "method") ?? "Phone Call";
  const conversationSummary = text(formData, "conversationSummary");
  const discussionTopic = text(formData, "discussionTopic");
  const productDiscussed = text(formData, "productDiscussed");
  const outcome = text(formData, "outcome");
  const notes = text(formData, "notes");
  const requestedNextFollowUpDate = dateTimeFromDateAndTimeWithClientOffset(formData, "nextFollowUpDate", "nextFollowUpTime", "nextFollowUpDateTzOffset");
  const nextFollowUpDate = discussionTopic === "Follow-up" ? requestedNextFollowUpDate : undefined;
  const rating = formData.has("rating") ? clampEngagementRating(formData.get("rating")) : undefined;

  if (!id) {
    return { ok: false, message: "Task reference is missing." };
  }

  if (!(await hasTaskAccess(prisma, user, id))) {
    return { ok: false, message: "You are not allowed to complete this task." };
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      completedAt: true,
      companyId: true,
      companyName: true,
      leadId: true,
      leadName: true,
      assignedToId: true,
      assignedById: true,
      product: { select: { name: true } },
    },
  });

  if (!task) {
    return { ok: false, message: "Task not found." };
  }

  if (task.status === "COMPLETED" || task.completedAt) {
    return { ok: false, message: "This task has already been completed." };
  }

  const resolvedConversationSummary = conversationSummary || notes || discussionTopic || task.title;

  const [resolvedCompany, resolvedLead] = await Promise.all([
    task.companyId
      ? Promise.resolve({ id: task.companyId })
      : task.companyName
        ? prisma.customerCompany.findFirst({
            where: { name: { equals: task.companyName, mode: "insensitive" } },
            select: { id: true },
          })
        : Promise.resolve(null),
    task.leadId
      ? Promise.resolve({ id: task.leadId })
      : task.leadName
        ? prisma.lead.findFirst({
            where: {
              OR: [
                { title: { equals: task.leadName, mode: "insensitive" } },
                { customerName: { equals: task.leadName, mode: "insensitive" } },
              ],
            },
            select: { id: true },
          })
        : Promise.resolve(null),
  ]);

  const completedAt = new Date();
  const shouldCreateFollowUp = Boolean(nextFollowUpDate);
  const scheduledFollowUpDate = nextFollowUpDate;

  const result = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        completedAt,
        completedById: user.id,
        isPrevious: false,
      },
    });

    const communication = await tx.communicationLog.create({
      data: {
        ...(resolvedCompany ? { company: { connect: { id: resolvedCompany.id } } } : {}),
        ...(resolvedLead ? { lead: { connect: { id: resolvedLead.id } } } : {}),
        task: { connect: { id: task.id } },
        user: { connect: { id: user.id } },
        method,
        note: resolvedConversationSummary,
        discussionTopic,
        productDiscussed: productDiscussed ?? task.product?.name ?? undefined,
        communicationAt: completedAt,
        outcome,
        ...(typeof rating === "number" ? { rating } : {}),
        ...(nextFollowUpDate ? { nextFollowUpDate } : {}),
        followUpNote: notes,
      },
    });

    const followUp = shouldCreateFollowUp
      ? await tx.followUp.create({
          data: {
            ...(resolvedCompany ? { company: { connect: { id: resolvedCompany.id } } } : {}),
            ...(resolvedLead ? { lead: { connect: { id: resolvedLead.id } } } : {}),
        ...(task.assignedToId ? { assignedTo: { connect: { id: task.assignedToId } } } : { assignedTo: { connect: { id: user.id } } }),
        task: { connect: { id: task.id } },
        method,
        note: resolvedConversationSummary,
        nextDiscussionPlan: notes ?? discussionTopic,
        priority: "MEDIUM",
        followUpDate: scheduledFollowUpDate!,
        status: followUpStatusForDate(scheduledFollowUpDate!),
            ...(typeof rating === "number" ? { rating } : {}),
          },
        })
      : null;

    await tx.activityTimeline.create({
      data: {
        title: "Task Completed",
        description: "Task completed with follow-up details",
        entity: "task",
        entityId: updatedTask.id,
        userId: user.id,
        companyId: resolvedCompany?.id ?? updatedTask.companyId ?? undefined,
        leadId: resolvedLead?.id ?? updatedTask.leadId ?? undefined,
        taskId: updatedTask.id,
        communicationLogId: communication.id,
        ...(followUp ? { followUpId: followUp.id } : {}),
      },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "Task Completed",
        entity: "task",
        entityId: updatedTask.id,
      },
    });

    if (updatedTask.assignedById) {
      await tx.notification.create({
        data: {
          recipientId: updatedTask.assignedById,
          title: "Task Completed",
          message: updatedTask.title,
          type: "TASK_COMPLETED",
          entity: "Task",
          entityId: updatedTask.id,
        },
      });
    }

    return { updatedTask, communication, followUp };
  });

  if (task.leadId && typeof rating === "number" && rating > 0) {
    await prisma.lead.update({
      where: { id: task.leadId },
      data: { score: { increment: rating } },
    });
  }

  revalidatePath("/");
  if (resolvedCompany?.id ?? task.companyId) revalidatePath(`/customers/${resolvedCompany?.id ?? task.companyId}`);
  if (resolvedLead?.id ?? task.leadId) revalidatePath(`/leads/${resolvedLead?.id ?? task.leadId}`);

  return {
    ok: true,
    taskId: result.updatedTask.id,
    followUpId: result.followUp?.id,
    nextFollowUpDate: result.followUp?.followUpDate.toISOString(),
    communicationId: result.communication.id,
  };
}

export async function completeFollowUpWithCommunicationAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const method = text(formData, "method") ?? "Phone Call";
  const conversationSummary = text(formData, "conversationSummary");
  const discussionTopic = text(formData, "discussionTopic");
  const productDiscussed = text(formData, "productDiscussed");
  const outcome = text(formData, "outcome");
  const notes = text(formData, "notes");
  const requestedNextFollowUpDate = dateTimeFromDateAndTimeWithClientOffset(formData, "nextFollowUpDate", "nextFollowUpTime", "nextFollowUpDateTzOffset");
  const nextFollowUpDate = discussionTopic === "Follow-up" ? requestedNextFollowUpDate : undefined;
  const rating = formData.has("rating") ? clampEngagementRating(formData.get("rating")) : undefined;

  if (!id) {
    return { ok: false, message: "Follow-up reference is missing." };
  }

  if (!(await hasFollowUpAccess(prisma, user, id))) {
    return { ok: false, message: "You are not allowed to complete this follow-up." };
  }

  const followUp = await prisma.followUp.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      completedAt: true,
      companyId: true,
      leadId: true,
      assignedToId: true,
      taskId: true,
      method: true,
      priority: true,
    },
  });

  if (!followUp) {
    return { ok: false, message: "Follow-up not found." };
  }

  if (followUp.status === "COMPLETED" || followUp.completedAt) {
    return { ok: false, message: "This follow-up has already been completed." };
  }

  const resolvedConversationSummary = notes || conversationSummary || discussionTopic || followUp.method || "Follow-up";
  const completedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updatedFollowUp = await tx.followUp.update({
      where: { id: followUp.id },
      data: {
        status: "COMPLETED",
        completedAt,
      },
    });

    const communication = await tx.communicationLog.create({
      data: {
        ...(followUp.companyId ? { company: { connect: { id: followUp.companyId } } } : {}),
        ...(followUp.leadId ? { lead: { connect: { id: followUp.leadId } } } : {}),
        ...(followUp.taskId ? { task: { connect: { id: followUp.taskId } } } : {}),
        user: { connect: { id: user.id } },
        method,
        note: resolvedConversationSummary,
        discussionTopic,
        productDiscussed,
        communicationAt: completedAt,
        outcome,
        ...(typeof rating === "number" ? { rating } : {}),
        ...(nextFollowUpDate ? { nextFollowUpDate } : {}),
        followUpNote: notes,
      },
    });

    const nextFollowUp = nextFollowUpDate
      ? await tx.followUp.create({
          data: {
            ...(followUp.companyId ? { company: { connect: { id: followUp.companyId } } } : {}),
            ...(followUp.leadId ? { lead: { connect: { id: followUp.leadId } } } : {}),
            ...(followUp.assignedToId ? { assignedTo: { connect: { id: followUp.assignedToId } } } : { assignedTo: { connect: { id: user.id } } }),
            ...(followUp.taskId ? { task: { connect: { id: followUp.taskId } } } : {}),
            method,
            note: notes ?? resolvedConversationSummary,
            nextDiscussionPlan: discussionTopic ?? notes,
            priority: followUp.priority,
            followUpDate: nextFollowUpDate,
            status: followUpStatusForDate(nextFollowUpDate),
            ...(typeof rating === "number" ? { rating } : {}),
          },
        })
      : null;

    await tx.activityTimeline.create({
      data: {
        title: "Follow-up Completed",
        description: "Follow-up completed with communication details",
        entity: "FollowUp",
        entityId: updatedFollowUp.id,
        userId: user.id,
        companyId: updatedFollowUp.companyId ?? undefined,
        leadId: updatedFollowUp.leadId ?? undefined,
        taskId: updatedFollowUp.taskId ?? undefined,
        followUpId: updatedFollowUp.id,
        communicationLogId: communication.id,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "Follow-up Completed",
        entity: "FollowUp",
        entityId: updatedFollowUp.id,
      },
    });

    return { updatedFollowUp, communication, nextFollowUp };
  });

  if (followUp.leadId && typeof rating === "number" && rating > 0) {
    await prisma.lead.update({
      where: { id: followUp.leadId },
      data: { score: { increment: rating } },
    });
  }

  await applyReward("FOLLOW_UP_COMPLETED", followUp.assignedToId ?? user.id, "FollowUp", followUp.id);

  revalidatePath("/");
  if (followUp.companyId) revalidatePath(`/customers/${followUp.companyId}`);
  if (followUp.leadId) revalidatePath(`/leads/${followUp.leadId}`);

  return {
    ok: true,
    followUpId: result.updatedFollowUp.id,
    nextFollowUpId: result.nextFollowUp?.id,
    nextFollowUpDate: result.nextFollowUp?.followUpDate.toISOString(),
    communicationId: result.communication.id,
  };
}

export async function updateTaskStatusAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !status) return;

  const task = await prisma.task.update({
    where: { id },
    data: {
      status: status as never,
      completedAt: status === "COMPLETED" ? new Date() : null,
      completedById: status === "COMPLETED" ? user.id : null,
      isPrevious: status === "COMPLETED" ? false : undefined,
    },
  });
  await addTimeline({
    title: "Task Status Updated",
    description: `${task.title} marked ${status.replace(/_/g, " ")}`,
    entity: "Task",
    entityId: task.id,
    userId: user.id,
    taskId: task.id,
  });
  if (status === "COMPLETED" && task.assignedById) {
    await prisma.notification.create({
      data: {
        recipientId: task.assignedById,
        title: "Task Completed",
        message: task.title,
        type: "TASK_COMPLETED",
        entity: "Task",
        entityId: task.id,
      },
    });
  }
  revalidatePath("/");
}

export async function createTodayPlanAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const plan = await prisma.todayPlan.create({
    data: {
      userId: user.id,
      title: text(formData, "title") ?? "Daily Plan",
      plannedAt: dateValue(formData, "plannedAt") ?? new Date(),
      priority: (text(formData, "priority") ?? "MEDIUM") as never,
      status: (text(formData, "status") ?? "TODO") as never,
      note: text(formData, "note"),
      companyId: text(formData, "companyId"),
      leadId: text(formData, "leadId"),
      productId: text(formData, "productId"),
    },
  });

  await addTimeline({
    title: "Plan Added",
    description: plan.title,
    entity: "TodayPlan",
    entityId: plan.id,
    userId: user.id,
    companyId: plan.companyId ?? undefined,
    leadId: plan.leadId ?? undefined,
  });
  revalidatePath("/");
  return { ok: true, id: plan.id };
}

export async function createFollowUpAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const actor = { id: user.id, role: user.role as Role };
  const linkedTaskId = text(formData, "taskId");
  if (linkedTaskId && !(await hasTaskAccess(prisma, user, linkedTaskId))) {
    return { ok: false, message: "You are not allowed to create follow-up for this task." };
  }

  const companyId = text(formData, "companyId");
  if (companyId && !(await hasCustomerAccess(prisma, actor, companyId))) {
    return { ok: false, message: "You are not allowed to use this customer record." };
  }
  let requestedAssignedToId = text(formData, "assignedToId");
  const followUpDateTime = dateTimeFromDateAndTimeWithClientOffset(formData, "followUpDate", "followUpTime", "followUpDateTzOffset");
  if (!followUpDateTime) {
    return { ok: false, message: "Follow-up date is required." };
  }

  const method = text(formData, "method") ?? "Phone Call";
  const note = text(formData, "note") ?? "";
  const nextDiscussionPlan = text(formData, "nextDiscussionPlan") ?? "";
  const requestedTaskTitle = text(formData, "taskTitle");
  const allowedTaskTitles = new Set(["Call", "Follow-up", "Demo Send", "Quotation", "Sale Won", "Lead Lost"]);
  const taskTitle = requestedTaskTitle && allowedTaskTitles.has(requestedTaskTitle) ? requestedTaskTitle : "Follow-up";

  const [company, linkedTask] = await Promise.all([
    companyId ? prisma.customerCompany.findUnique({ where: { id: companyId }, select: { id: true, name: true } }) : Promise.resolve(null),
    linkedTaskId
      ? prisma.task.findUnique({
          where: { id: linkedTaskId },
          select: {
            id: true,
            title: true,
            companyId: true,
            companyName: true,
            leadId: true,
            assignedToId: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (companyId && !company) {
    return { ok: false, message: "Selected company was not found." };
  }

  if (linkedTaskId && !linkedTask) {
    return { ok: false, message: "Linked task was not found." };
  }

  if (!requestedAssignedToId && linkedTask?.assignedToId) {
    requestedAssignedToId = linkedTask.assignedToId;
  }

  const assignedToId = await resolveOptionalMarketerAssignee(
    prisma,
    { id: user.id, role: user.role as Role },
    requestedAssignedToId,
  ) ?? linkedTask?.assignedToId ?? user.id;

  const created = await prisma.followUp.create({
    data: {
      ...(company?.id || companyId || linkedTask?.companyId
        ? { company: { connect: { id: company?.id ?? companyId ?? linkedTask?.companyId ?? "" } } }
        : {}),
      ...(linkedTask?.leadId ? { lead: { connect: { id: linkedTask.leadId } } } : {}),
      ...(assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : {}),
      ...(linkedTask?.id ? { task: { connect: { id: linkedTask.id } } } : {}),
      method,
      note: note || `${taskTitle} scheduled`,
      nextDiscussionPlan: nextDiscussionPlan || null,
      priority: "MEDIUM",
      followUpDate: followUpDateTime,
      status: followUpStatusForDate(followUpDateTime),
    },
    select: {
      id: true,
      followUpDate: true,
      companyId: true,
      leadId: true,
    },
  });

  await addTimeline({
    title: "Follow-up Created",
    description: note || nextDiscussionPlan || `${method} ${taskTitle}`,
    entity: "FollowUp",
    entityId: created.id,
    userId: user.id,
    companyId: created.companyId ?? undefined,
    leadId: created.leadId ?? undefined,
    followUpId: created.id,
  });

  revalidatePath("/");
  if (created.companyId) revalidatePath(`/customers/${created.companyId}`);
  if (created.leadId) revalidatePath(`/leads/${created.leadId}`);
  return { ok: true, id: created.id, followUpDate: created.followUpDate.toISOString() };
}

export async function updateFollowUpStatusById(user: { id: string; role: Role }, id: string, status: string) {
  const prisma = getPrisma();
  const visible = await prisma.followUp.findFirst({
    where: user.role === "ADMIN"
      ? { id }
      : user.role === "MARKETER"
        ? { id, assignedToId: user.id }
        : {
            id,
            assignedTo: {
              is: {
                OR: [
                  { id: user.id },
                  { role: "MARKETER", status: "ACTIVE" },
                ],
              },
            },
          },
    select: { id: true },
  });

  if (!visible) {
    throw new Error("Follow-up not found or you do not have access.");
  }

  const followUp = await prisma.followUp.update({
    where: { id },
    data: {
      status: status as never,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
  });

  await addTimeline({
    title: "Follow-up Updated",
    description: `Marked ${status.replace(/_/g, " ")}`,
    entity: "FollowUp",
    entityId: followUp.id,
    userId: user.id,
    companyId: followUp.companyId ?? undefined,
    leadId: followUp.leadId ?? undefined,
    followUpId: followUp.id,
  });

  if (status === "COMPLETED") {
    await applyReward("FOLLOW_UP_COMPLETED", followUp.assignedToId ?? user.id, "FollowUp", followUp.id);
  }

  revalidatePath("/");
  return followUp;
}

export async function updateFollowUpStatusAction(formData: FormData) {
  const user = await actionUser();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!id || !status) return;
  await updateFollowUpStatusById({ id: user.id, role: user.role as Role }, id, status);
}

export async function parkCustomerById(
  user: { id: string; role: Role },
  customerId: string,
  input: { until: string; note?: string },
) {
  const prisma = getPrisma();
  const allowed = await hasCustomerAccess(prisma, { id: user.id, role: user.role }, customerId);
  if (!allowed) {
    throw new Error("Customer not found or you do not have access.");
  }

  const parkedUntil = new Date(input.until);
  if (Number.isNaN(parkedUntil.getTime())) {
    throw new Error("Enter a valid date to park this customer until.");
  }

  const note = input.note?.trim() || undefined;
  const customer = await prisma.customerCompany.update({
    where: { id: customerId },
    data: {
      isParked: true,
      parkedUntil,
      parkedNote: note ?? null,
      parkedAt: new Date(),
      parkedById: user.id,
    },
  });

  await addTimeline({
    title: "Customer Parked",
    description: `Moved to Cold Customers until ${format(parkedUntil, "dd MMM yyyy")}${note ? ` — ${note}` : ""}`,
    entity: "CustomerCompany",
    entityId: customer.id,
    userId: user.id,
    companyId: customer.id,
  });

  revalidateCustomerViews(customer.id);
  return customer;
}

export async function unparkCustomerById(user: { id: string; role: Role }, customerId: string) {
  const prisma = getPrisma();
  const allowed = await hasCustomerAccess(prisma, { id: user.id, role: user.role }, customerId);
  if (!allowed) {
    throw new Error("Customer not found or you do not have access.");
  }

  const customer = await prisma.customerCompany.update({
    where: { id: customerId },
    data: { isParked: false },
  });

  await addTimeline({
    title: "Customer Un-parked",
    description: "Brought back to the active customer list.",
    entity: "CustomerCompany",
    entityId: customer.id,
    userId: user.id,
    companyId: customer.id,
  });

  revalidateCustomerViews(customer.id);
  return customer;
}

export async function sendMarketerSuggestionById(
  sender: { id: string; role: Role },
  recipientId: string,
  message: string,
) {
  const suggestion = await createMarketerSuggestion(sender, recipientId, message);

  await addTimeline({
    title: "Suggestion Sent",
    description: suggestion.message,
    entity: "MarketerSuggestion",
    entityId: suggestion.id,
    userId: sender.id,
  });

  revalidatePath(`/marketer/suggestions`);
  return suggestion;
}

export async function sendMarketerSuggestionAction(formData: FormData) {
  const user = await actionUser();
  const recipientId = text(formData, "recipientId");
  const message = text(formData, "message");
  if (!recipientId || !message) return;

  await sendMarketerSuggestionById({ id: user.id, role: user.role as Role }, recipientId, message);
}

export async function markSuggestionReadAction(formData: FormData) {
  const user = await actionUser();
  const id = text(formData, "id");
  if (!id) return;

  await markSuggestionRead(user.id, id);
  revalidatePath("/marketer/suggestions");
}

export async function createCommunicationAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const companyId = text(formData, "companyId");
  const leadId = text(formData, "leadId");
  if (companyId && !(await hasCustomerAccess(prisma, { id: user.id, role: user.role as Role }, companyId))) {
    return { ok: false, message: "You are not allowed to use this customer record." };
  }
  if (leadId && !(await hasLeadAccess(prisma, { id: user.id, role: user.role as Role }, leadId))) {
    return { ok: false, message: "You are not allowed to use this lead record." };
  }
  const nextFollowUpDate = dateTimeFromDateAndTimeWithClientOffset(formData, "nextFollowUpDate", "nextFollowUpTime", "nextFollowUpDateTzOffset");
  const taskId = text(formData, "taskId");
  if (taskId && !(await hasTaskAccess(prisma, user, taskId))) {
    return { ok: false, message: "You are not allowed to use this task record." };
  }
  const log = await prisma.communicationLog.create({
    data: {
      ...(companyId ? { company: { connect: { id: companyId } } } : {}),
      ...(leadId ? { lead: { connect: { id: leadId } } } : {}),
      ...(taskId ? { task: { connect: { id: taskId } } } : {}),
      user: { connect: { id: user.id } },
      method: text(formData, "method") ?? "Phone Call",
      note: text(formData, "note") ?? "Customer contacted.",
      discussionTopic: text(formData, "discussionTopic"),
      productDiscussed: text(formData, "productDiscussed"),
      communicationAt: dateTimeWithClientOffset(formData, "communicationAt", "communicationAtTzOffset") ?? new Date(),
      outcome: text(formData, "outcome"),
      rating: intValue(formData, "rating", 0),
      nextFollowUpDate,
      followUpNote: text(formData, "followUpNote"),
    },
  });

  await addTimeline({
    title: `${log.method} Logged`,
    description: log.note,
    entity: "CommunicationLog",
    entityId: log.id,
    userId: user.id,
    companyId: log.companyId ?? undefined,
    leadId: log.leadId ?? undefined,
    communicationLogId: log.id,
  });

  if (nextFollowUpDate) {
    await prisma.followUp.create({
      data: {
        companyId: log.companyId,
        leadId: log.leadId,
        assignedToId: user.id,
        method: log.method,
        note: log.followUpNote ?? "Next follow-up",
        followUpDate: nextFollowUpDate,
        status: "UPCOMING",
      },
    });
  }
  revalidatePath("/");
  return { ok: true, id: log.id };
}

export async function logCustomerCommunicationShortcutAction(input: {
  customerId: string;
  customerName: string;
  method: string;
  action: string;
}) {
  const user = await actionUser();
  const customerId = input.customerId.trim();
  const customerName = input.customerName.trim();
  const action = input.action.trim();
  const method = input.method.trim().toUpperCase();

  if (!customerId) {
    return { ok: false, message: "Customer id is required." };
  }

  if (!action) {
    return { ok: false, message: "Action text is required." };
  }

  if (!isQuickCommunicationMethod(method)) {
    return { ok: false, message: "Unsupported communication method." };
  }

  const prisma = getPrisma();
  const createdAt = new Date();
  const methodLabel = quickCommunicationLabel(method);
  const metadata = {
    customerId,
    customerName,
    userId: user.id,
    userName: user.name,
    method,
    action,
    createdAt: createdAt.toISOString(),
  };

  const result = await prisma.$transaction(async (tx) => {
    await tx.customerCompany.update({
      where: { id: customerId },
      data: { lastCommunication: createdAt },
    });

    const communication = await tx.communicationLog.create({
      data: {
        company: { connect: { id: customerId } },
        user: { connect: { id: user.id } },
        method: methodLabel,
        note: action,
        communicationAt: createdAt,
        outcome: "Opened",
      },
    });

    const timeline = await tx.activityTimeline.create({
      data: {
        title: `${methodLabel} Opened`,
        description: action,
        entity: "CommunicationLog",
        entityId: communication.id,
        userId: user.id,
        companyId: customerId,
        communicationLogId: communication.id,
        metadata,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action,
        entity: "CommunicationLog",
        entityId: communication.id,
        metadata,
      },
    });

    return {
      communicationId: communication.id,
      timelineId: timeline.id,
    };
  });

  revalidateCustomerViews(customerId);
  revalidatePath("/");

  const time = format(createdAt, "dd/MM/yyyy hh:mm a");

  return {
    ok: true,
    communication: {
      id: result.communicationId,
      href: `/customers/${customerId}`,
      method: methodLabel,
      summary: action,
      subject: "-",
      fromEmail: "-",
      toEmail: "-",
      discussionTopic: "-",
      productDiscussed: "-",
      outcome: "Opened",
      rating: "-",
      nextFollowUpDate: "-",
      notes: "-",
      createdBy: user.name,
      time,
    },
    activity: {
      id: result.timelineId,
      href: `/customers/${customerId}`,
      title: `${methodLabel} Opened`,
      detail: `${action} by ${user.name}`,
      time,
    },
  };
}

export async function createUserAction(formData: FormData) {
  const user = await actionUser();
  if (!["ADMIN", "SUPERVISOR"].includes(user.role)) {
    return { ok: false, message: "Only Admin or Supervisor can create users." };
  }

  const prisma = getPrisma();
  const requestedRole = text(formData, "role") ?? "MARKETER";
  const email = normalizeEmail(formData.get("email"));
  const typedMobile = normalizeMobile(formData.get("mobile"));
  const mobile = typedMobile || internalMobileForEmail(email);

  if (!email) {
    return { ok: false, message: "Valid email is required." };
  }

  if (user.role === "SUPERVISOR" && requestedRole !== "MARKETER") {
    return { ok: false, message: "Supervisor can create Marketer users only." };
  }

  if (user.role === "ADMIN" && !["SUPERVISOR", "MARKETER"].includes(requestedRole)) {
    return { ok: false, message: "Admin can create Supervisor or Marketer users." };
  }

  const rawSupervisorIds: string[] = [];
  for (const value of formData.getAll("supervisorIds")) {
    if (typeof value === "string" && value.trim()) rawSupervisorIds.push(value.trim());
  }
  const legacySupervisorId = text(formData, "supervisorId")?.trim();
  if (legacySupervisorId) rawSupervisorIds.push(legacySupervisorId);

  const supervisorIds = user.role === "SUPERVISOR"
    ? [user.id]
    : requestedRole === "MARKETER"
      ? Array.from(new Set(rawSupervisorIds))
      : [];

  const supervisorId = supervisorIds[0] ?? undefined;

  if (supervisorIds.length) {
    const supervisors = await prisma.user.findMany({
      where: { id: { in: supervisorIds }, role: "SUPERVISOR", status: "ACTIVE" },
      select: { id: true },
    });

    if (supervisors.length !== supervisorIds.length) {
      return { ok: false, message: "Selected supervisor was not found." };
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.create({
        data: {
          name: text(formData, "name") ?? "CRM User",
          mobile,
          email,
          role: requestedRole as never,
          designation: text(formData, "designation"),
          supervisorId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          role: true,
          status: true,
          designation: true,
          supervisorId: true,
        },
      });

      if (requestedRole === "MARKETER" && supervisorIds.length) {
        await tx.userSupervisorAssignment.createMany({
          data: supervisorIds.map((id) => ({ supervisorId: id, marketerId: nextUser.id })),
          skipDuplicates: true,
        });
      }

      return nextUser;
    });
    await addTimeline({
      title: "User Created",
      description: created.name,
      entity: "User",
      entityId: created.id,
      userId: user.id,
    });
    revalidateUserViews();
    return { ok: true, id: created.id, row: mapEmployeeActionRow({ ...created, supervisorIds }) };
  } catch (error) {
    try {
      const { PrismaClientKnownRequestError } = await import("@prisma/client/runtime/client");
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "mobile or email";
        return { ok: false, message: `A user with this ${target} already exists.` };
      }
    } catch {
      // If dynamic import fails, fall through and rethrow the original error below.
    }

    throw error;
  }
}

function normalizeOtpPurpose(value: FormDataEntryValue | null): OtpPurpose {
  return value === "PASSWORD_RESET" ? "PASSWORD_RESET" : "FIRST_LOGIN";
}

function validateTeamPassword(password: string) {
  if (password.trim().length < 8) {
    return "Password must be at least 8 characters long.";
  }

  return "";
}

async function setSessionCookies(role: Role, mobile: string) {
  const store = await cookies();
  store.set("crm_role", role, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });
  store.set("crm_mobile", mobile, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax" });
}

async function safeUpdateLastLogin(prisma: ReturnType<typeof getPrisma>, userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  } catch (error) {
    if (!isAuthUpgradeUnavailable(error)) {
      throw error;
    }
  }
}

async function findActiveUserByLogin(prisma: ReturnType<typeof getPrisma>, login: string) {
  const isEmailLogin = login.includes("@");
  const adminEmail = resolveAdminEmail();
  const adminMobile = process.env.CRM_ADMIN_MOBILE ?? DEFAULT_ADMIN_MOBILE;

  if (login === adminEmail || login === adminMobile || login === internalMobileForEmail(adminEmail)) {
    await ensureOfficeAdmin(prisma);
  }

  return prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      OR: isEmailLogin ? [{ email: login }, { mobile: internalMobileForEmail(login) }] : [{ mobile: login }],
    },
  });
}

async function issueTeamOtp(params: {
  prisma: ReturnType<typeof getPrisma>;
  user: {
    id: string;
    email?: string | null;
  };
  login: string;
  purpose: OtpPurpose;
}) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const emailTarget = params.user.email;

  if (!emailTarget) {
    return { ok: false as const, message: "This user account does not have an email address for OTP delivery." };
  }

  const emailSent = await sendLoginOtpEmail(emailTarget, otp);
  const shouldShowOtp = process.env.CRM_SHOW_LOGIN_OTP === "true" || (!emailSent && process.env.CRM_SHOW_LOGIN_OTP !== "false");

  try {
    await params.prisma.oTP.create({
      data: {
        mobile: params.login,
        otp,
        purpose: params.purpose,
        userId: params.user.id,
        expiresAt: new Date(Date.now() + LOGIN_OTP_WINDOW_MS),
      },
    });
  } catch (error) {
    if (isAuthUpgradeUnavailable(error)) {
      return { ok: false as const, message: authUpgradeMessage() };
    }
    throw error;
  }

  return {
    ok: true as const,
    message: emailSent ? `OTP sent to ${emailTarget}.` : shouldShowOtp ? `Login OTP: ${otp}` : "OTP sent to your account.",
    otp: shouldShowOtp ? otp : undefined,
  };
}

export async function updateUserAction(formData: FormData) {
  const actor = await actionUser();
  if (!["ADMIN", "SUPERVISOR"].includes(actor.role)) {
    return { ok: false, message: "You are not allowed to update users." };
  }

  const prisma = getPrisma();
  const userId = text(formData, "userId");
  if (!userId) {
    return { ok: false, message: "User id is required." };
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: true,
      status: true,
      designation: true,
      supervisorId: true,
    },
  });

  if (!existing) {
    return { ok: false, message: "User not found." };
  }

  const requestedRole = normalizeUserRole(text(formData, "role")) ?? existing.role;
  const requestedStatus = normalizeUserStatus(text(formData, "status")) ?? existing.status;
  const email = normalizeEmail(formData.get("email"));
  const typedMobile = normalizeMobile(formData.get("mobile"));
  const mobile = typedMobile || internalMobileForEmail(email);
  const isPrimaryAdminUser = existing.role === "ADMIN" && isPrimaryAdminEmail(existing.email);

  if (!email) {
    return { ok: false, message: "Valid email is required." };
  }

  if (isPrimaryAdminUser) {
    if (requestedRole !== "ADMIN") {
      return { ok: false, message: "Primary admin role cannot be changed." };
    }

    if (requestedStatus !== "ACTIVE") {
      return { ok: false, message: "Primary admin must stay active." };
    }

    if (!isPrimaryAdminEmail(email)) {
      return { ok: false, message: `Primary admin email must remain ${resolveAdminEmail()}.` };
    }
  }

  if (actor.role === "SUPERVISOR") {
    const hasAccess = existing.role === "MARKETER" && (
      existing.supervisorId === actor.id ||
      Boolean(await prisma.userSupervisorAssignment.findFirst({
        where: { supervisorId: actor.id, marketerId: existing.id },
        select: { id: true },
      }))
    );

    if (!hasAccess) {
      return { ok: false, message: "Supervisor can update only their marketers." };
    }

    if (requestedRole !== existing.role) {
      return { ok: false, message: "Supervisor cannot change user roles." };
    }
  }

  if (actor.role === "ADMIN") {
    const allowedRoles = existing.role === "ADMIN"
      ? ["ADMIN", "SUPERVISOR", "MARKETER"]
      : ["SUPERVISOR", "MARKETER"];

    if (!allowedRoles.includes(requestedRole)) {
      return { ok: false, message: "Selected role is not allowed for this user." };
    }

    if (existing.role === "ADMIN" && requestedRole !== "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return { ok: false, message: "Last remaining Admin role cannot be changed." };
      }
    }
  }

  const rawSupervisorIds: string[] = [];
  for (const value of formData.getAll("supervisorIds")) {
    if (typeof value === "string" && value.trim()) rawSupervisorIds.push(value.trim());
  }
  const legacySupervisorId = text(formData, "supervisorId")?.trim();
  if (legacySupervisorId) rawSupervisorIds.push(legacySupervisorId);

  const supervisorIds = actor.role === "ADMIN" && requestedRole === "MARKETER"
    ? Array.from(new Set(rawSupervisorIds))
    : [];

  const supervisorId = actor.role === "ADMIN"
    ? requestedRole === "MARKETER"
      ? (supervisorIds[0] ?? null)
      : null
    : existing.supervisorId ?? null;

  if (actor.role === "ADMIN" && supervisorIds.length) {
    const supervisors = await prisma.user.findMany({
      where: { id: { in: supervisorIds }, role: "SUPERVISOR", status: "ACTIVE" },
      select: { id: true },
    });

    if (supervisors.length !== supervisorIds.length) {
      return { ok: false, message: "Selected supervisor was not found." };
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: existing.id },
        data: {
          name: text(formData, "name") ?? existing.name,
          email,
          mobile,
          designation: text(formData, "designation") ?? null,
          role: requestedRole as never,
          status: requestedStatus as never,
          supervisorId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          role: true,
          status: true,
          designation: true,
          supervisorId: true,
        },
      });

      if (actor.role === "ADMIN") {
        await tx.userSupervisorAssignment.deleteMany({
          where: { marketerId: nextUser.id },
        });

        if (requestedRole === "MARKETER" && supervisorIds.length) {
          await tx.userSupervisorAssignment.createMany({
            data: supervisorIds.map((id) => ({ supervisorId: id, marketerId: nextUser.id })),
            skipDuplicates: true,
          });
        }
      }

      return nextUser;
    });

    await addTimeline({
      title: "User Updated",
      description: `${updated.name} profile updated`,
      entity: "User",
      entityId: updated.id,
      userId: actor.id,
    });

    revalidateUserViews();
    return { ok: true, id: updated.id, row: actor.role === "ADMIN" ? mapEmployeeActionRow({ ...updated, supervisorIds }) : mapEmployeeActionRow(updated) };
  } catch (error) {
    try {
      const { PrismaClientKnownRequestError } = await import("@prisma/client/runtime/client");
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "mobile or email";
        return { ok: false, message: `A user with this ${target} already exists.` };
      }
    } catch {
      // Fall through to the generic error below.
    }

    throw error;
  }
}

export async function deleteUserAction(formData: FormData) {
  const actor = await actionUser();
  if (actor.role !== "ADMIN") {
    return { ok: false, message: "Only Admin can delete users." };
  }

  const prisma = getPrisma();
  const userId = text(formData, "userId");
  if (!userId) {
    return { ok: false, message: "User id is required." };
  }

  if (userId === actor.id) {
    return { ok: false, message: "You cannot delete your own account." };
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!existing) {
    return { ok: false, message: "User not found." };
  }

  if (existing.role === "ADMIN" && isPrimaryAdminEmail(existing.email)) {
    return { ok: false, message: "Primary admin account cannot be deleted." };
  }

  if (existing.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return { ok: false, message: "Last remaining Admin cannot be deleted." };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { supervisorId: existing.id },
        data: { supervisorId: null },
      });

      await tx.userSupervisorAssignment.deleteMany({
        where: {
          OR: [{ supervisorId: existing.id }, { marketerId: existing.id }],
        },
      });

      await tx.user.delete({
        where: { id: existing.id },
      });
    });

    await addTimeline({
      title: "User Deleted",
      description: existing.name,
      entity: "User",
      entityId: existing.id,
      userId: actor.id,
    });

    revalidateUserViews();
    return { ok: true, id: existing.id };
  } catch (error) {
    try {
      const { PrismaClientKnownRequestError } = await import("@prisma/client/runtime/client");
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2003") {
        return { ok: false, message: "This user has linked CRM records and cannot be deleted yet." };
      }
    } catch {
      // Fall through to the generic error below.
    }

    throw error;
  }
}

export async function saveSettingsAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, message: "Only Admin can update settings." };

  const prisma = getPrisma();
  const companyProfile = {
    company: text(formData, "company"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    address: text(formData, "address"),
  };

  await prisma.systemSetting.upsert({
    where: { key: "company.profile" },
    update: { value: companyProfile },
    create: {
      key: "company.profile",
      group: "company",
      value: companyProfile,
    },
  });
  revalidatePath("/");
  return { ok: true };
}

export async function giveManualRewardAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, status: 403, message: "Forbidden: Only Admin can give rewards." };

  const prisma = getPrisma();
  const userId = text(formData, "userId");
  if (!userId) return { ok: false, message: "Employee is required." };
  const points = intValue(formData, "points", 0);
  const reason = text(formData, "reason") ?? "Manual reward";

  const reward = await prisma.reward.create({
    data: { userId, points, reason, source: "MANUAL" },
  });
  await prisma.rewardHistory.create({
    data: { userId, points, reason, source: "MANUAL", entity: "Reward", entityId: reward.id },
  });
  await prisma.notification.create({
    data: {
      recipientId: userId,
      title: "Reward Earned",
      message: `${points} points: ${reason}`,
      type: "REWARD_EARNED",
      entity: "Reward",
      entityId: reward.id,
    },
  });
  revalidateRewardViews();
  return { ok: true, id: reward.id };
}

export async function createRewardRuleAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, status: 403, message: "Forbidden: Only Admin can manage reward rules." };
  const prisma = getPrisma();
  const name = text(formData, "name");
  const trigger = normalizeRewardTrigger(text(formData, "trigger"));
  const points = intValue(formData, "points", 0);

  if (!name) return { ok: false, message: "Rule name is required." };
  if (!trigger) return { ok: false, message: "Trigger/Event is required." };
  if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) return { ok: false, message: "Points must be a positive integer." };

  const rule = await prisma.rewardRule.create({
    data: {
      name,
      trigger,
      points,
      active: formData.get("active") !== "false",
    },
  });
  revalidateRewardViews();
  return {
    ok: true,
    id: rule.id,
    rule: {
      id: rule.id,
      name: rule.name,
      trigger: rule.trigger,
      points: rule.points,
      active: rule.active,
      createdAt: formatRewardRuleDate(rule.createdAt),
    },
  };
}

export async function updateRewardRuleAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, status: 403, message: "Forbidden: Only Admin can manage reward rules." };

  const prisma = getPrisma();
  const ruleId = text(formData, "id");
  const name = text(formData, "name");
  const trigger = normalizeRewardTrigger(text(formData, "trigger"));
  const points = intValue(formData, "points", 0);
  const active = formData.get("active") !== "false";

  if (!ruleId) return { ok: false, message: "Rule id is required." };
  if (!name) return { ok: false, message: "Rule name is required." };
  if (!trigger) return { ok: false, message: "Trigger/Event is required." };
  if (!Number.isFinite(points) || !Number.isInteger(points) || points <= 0) return { ok: false, message: "Points must be a positive integer." };

  const updated = await prisma.rewardRule.update({
    where: { id: ruleId },
    data: { name, trigger, points, active },
  });

  revalidateRewardViews();
  return {
    ok: true,
    id: updated.id,
    rule: {
      id: updated.id,
      name: updated.name,
      trigger: updated.trigger,
      points: updated.points,
      active: updated.active,
      createdAt: formatRewardRuleDate(updated.createdAt),
    },
  };
}

export async function deleteRewardRuleAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") return { ok: false, status: 403, message: "Forbidden: Only Admin can manage reward rules." };

  const prisma = getPrisma();
  const ruleId = text(formData, "id");
  if (!ruleId) return { ok: false, message: "Rule id is required." };

  await prisma.rewardRule.delete({ where: { id: ruleId } });
  revalidateRewardViews();
  return { ok: true, id: ruleId };
}

export async function toggleRewardRuleStatusAction(formData: FormData) {
  const user = await actionUser();
  if (user.role !== "ADMIN") {
    return { ok: false, status: 403, message: "Forbidden: Only Admin can manage reward rules." };
  }
  const prisma = getPrisma();
  const ruleId = text(formData, "id");
  if (!ruleId) {
    return { ok: false, message: "Rule id is required." };
  }

  const rule = await prisma.rewardRule.findUnique({ where: { id: ruleId } });
  if (!rule) {
    return { ok: false, message: "Reward rule not found." };
  }

  const updated = await prisma.rewardRule.update({
    where: { id: ruleId },
    data: { active: !rule.active },
  });

  revalidateRewardViews();
  return {
    ok: true,
    id: updated.id,
    rule: {
      id: updated.id,
      name: updated.name,
      trigger: updated.trigger,
      points: updated.points,
      active: updated.active,
      createdAt: formatRewardRuleDate(updated.createdAt),
    },
  };
}

export async function createImportExportLogAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  const log = await prisma.importExportLog.create({
    data: {
      type: (text(formData, "type") ?? "IMPORT") as never,
      module: (text(formData, "module") ?? "CUSTOMERS") as never,
      format: (text(formData, "format") ?? "CSV") as never,
      requestedById: user.id,
      fileName: text(formData, "fileName"),
      status: "COMPLETED",
      processedRows: intValue(formData, "processedRows", 0),
    },
  });
  revalidatePath("/");
  return { ok: true, id: log.id };
}

export async function createReportLogAction(formData: FormData) {
  const user = await actionUser();
  const prisma = getPrisma();
  await prisma.reportLog.create({
    data: {
      reportType: (text(formData, "reportType") ?? "SALES") as never,
      format: (text(formData, "format") ?? "PDF") as never,
      requestedById: user.id,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  revalidatePath("/");
}

export async function markNotificationReadAction(formData: FormData) {
  await actionUser();
  const id = text(formData, "id");
  if (!id) return;
  await getPrisma().notification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/");
}

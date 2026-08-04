import type * as Prisma from "@prisma/client";
import { addDays, isBefore } from "date-fns";
import { formatCrmDate, getCrmDayWindow, getCrmPeriodWindow, isBeforeCrmDay, isSameCrmDay, type CrmPeriod } from "@/lib/crm-time";
import { buildCustomerScopeWhere, getMarketerScopeUserIds } from "@/lib/customer-ownership";
import { getScopedLeadUserIds } from "@/lib/lead-ownership";
import { getPrisma } from "@/lib/prisma";
import { getCompletedWorkItems, getTodayWorkQueue, type CompletedWorkItem, type TodayWorkQueueItem } from "@/lib/task-center";
import { type Role, type ShellUser } from "@/lib/utils";

type TeamPerformancePeriod = CrmPeriod;

type TeamPerformanceOptions = {
  period?: TeamPerformancePeriod;
  from?: string;
  to?: string;
};

export type CrmStat = {
  title: string;
  value: string;
  helper: string;
  tone: string;
};

export type LeadRow = {
  id: string;
  companyId?: string | null;
  title: string;
  customerName: string;
  company: string;
  phone: string;
  phones: string[];
  email: string;
  emails: string[];
  productInterestId?: string | null;
  productInterest: string;
  status: string;
  score: number;
  priority: string;
  assignedToId?: string | null;
  assignedTo: string;
  followUpDate: string;
  followUpDateValue?: string;
  purchaseProbability: number;
  communicationCount: number;
  followUpCount: number;
  salesProgress: string;
  notes: string;
  createdAt: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  activityLabel?: string;
  activityTone?: "blue" | "green" | "amber" | "slate";
  contactPerson: string;
  email: string;
  emailOptions: string[];
  phone: string;
  phone2: string;
  whatsapp: string;
  cityOrZilla: string;
  industry: string;
  address: string;
  website: string;
  assignedToId?: string | null;
  assignedTo: string;
  createdBy?: string;
  createdByRole?: string;
  createdAtLabel?: string;
  status: string;
  totalLeads: number;
  lastCommunication: string;
  notes: string;
  rawData: Prisma.Prisma.JsonValue;
};

export type TaskRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  companyName?: string | null;
  leadName?: string | null;
  productId?: string | null;
  assignedToId?: string | null;
  href?: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedBy: string;
  relatedTo: string;
  product: string;
  taskDate: string;
  taskDateIso: string;
  dueDate: string;
  time: string;
  priority: string;
  priorityKey: "URGENT" | "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  status: string;
  statusKey: string;
  isPrevious: boolean;
  completedAt: string;
  completedBy: string;
  reminder: string;
  notes: string;
};

export type TodayPlanRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  href?: string;
  title: string;
  relatedTo: string;
  time: string;
  priority: string;
  status: string;
  note: string;
  section: "today" | "previous" | "completed";
};

export type FollowUpRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  taskNotes?: string | null;
  taskReminder?: string | null;
  taskProductId?: string | null;
  taskProductName?: string | null;
  taskPriorityKey?: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  taskDateIso?: string | null;
  href?: string;
  customer: string;
  phone: string;
  lead: string;
  method: string;
  note: string;
  lastCommunicationType: string;
  nextDiscussionPlan: string;
  status: string;
  bucket: "Overdue" | "Due Today" | "Upcoming" | "Completed";
  followUpDate: string;
  followUpDateIso: string;
  assignedTo: string;
  priority: string;
  createdBy: string;
  createdAt: string;
  completedAt: string;
};

export type TodayWorkItem = {
  id: string;
  sourceId: string;
  source: "Follow-up" | "Task" | "Plan";
  queueType?: "TASK" | "DUE_FOLLOW_UP" | "OVERDUE" | "CARRY_FORWARD";
  queueLabel?: "Task" | "Follow-up" | "Overdue" | "Carry Forward";
  companyId?: string | null;
  leadId?: string | null;
  assignedToId?: string | null;
  href?: string;
  title: string;
  method: string;
  relatedTo: string;
  date: string;
  dateTimeValue: string;
  time: string;
  priority: string;
  status: string;
  note: string;
  assignedTo: string;
  overdue: boolean;
};

export type FollowUpDateFilter = "all" | "today" | "tomorrow" | "week" | "month" | "custom" | "overdue" | "completed";

export type FollowUpQuery = {
  search?: string;
  dateFilter?: FollowUpDateFilter;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type FollowUpPageData = {
  rows: FollowUpRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: Required<Pick<FollowUpQuery, "dateFilter">> & Pick<FollowUpQuery, "search" | "from" | "to">;
  summary: {
    overdue: number;
    today: number;
    upcoming: number;
    completed: number;
    actionable: number;
  };
};

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  imageUrl: string;
  description: string;
  specification: string;
  status: string;
  interestedCustomers: number;
  communicationCount: number;
  followUpCount: number;
  quotationCount: number;
  salesCount: number;
  conversionRate: number;
  assignedCount: number;
  assignedMarketers: string[];
  targetCompanies: number;
  contactedCompanies: number;
  remainingCompanies: number;
};

export type ProductEngagementRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  companyName: string;
  leadName: string;
  communicationType: string;
  summary: string;
  discussionTopic: string;
  nextFollowUpDate: string;
  lastContactDate: string;
  status: string;
  assignedMarketer: string;
  communicationCount: number;
  followUpCount: number;
  quotationCount: number;
};

export type ProductEngagementData = {
  summary: {
    totalCompaniesContacted: number;
    totalLeadsInterested: number;
    totalCommunicationCount: number;
    totalShortlistedCompanies: number;
    contactedCompanies: number;
    notContactedCompanies: number;
    totalCallCount: number;
    totalWhatsAppCount: number;
    totalEmailCount: number;
    totalMeetingCount: number;
    followUpCount: number;
    quotationSentCount: number;
    salesCount: number;
    conversionRate: number;
  };
  rows: ProductEngagementRow[];
  filters: {
    from?: string;
    to?: string;
    status?: string;
    communicationType?: string;
    assignedUserId?: string;
  };
  filterOptions: {
    communicationTypes: string[];
    assignedUsers: { id: string; name: string }[];
  };
};

export type ProductIntelligenceItem = {
  id: string;
  name: string;
  category: string;
  communicationCount: number;
  followUpCount: number;
  leadCount: number;
  quotationCount: number;
  salesCount: number;
  conversionRate: number;
  engagementScore: number;
};

export type QuotationRow = {
  id: string;
  companyId?: string | null;
  leadId?: string | null;
  quoteNumber: string;
  customer: string;
  product: string;
  amount: number;
  status: string;
  createdBy: string;
  date: string;
};

export type ActivityRow = {
  id: string;
  href?: string;
  title: string;
  detail: string;
  time: string;
  createdAtValue?: string;
  dateLabel?: string;
  timeLabel?: string;
  category?: "CALL" | "WHATSAPP" | "EMAIL" | "MEETING" | "FOLLOW_UP" | "QUOTATION" | "LEAD" | "TASK" | "PLAN" | "USER" | "SYSTEM" | "OTHER";
  badgeLabel?: string;
  customerName?: string;
  customerHref?: string;
  employeeName?: string;
  employeeId?: string;
  entity?: string;
  rawAction?: string;
  discussionSummary?: string;
  notes?: string;
  rating?: string;
  contactMethod?: string;
  phoneOrEmailUsed?: string;
  nextFollowUpDate?: string;
  quotationReference?: string;
  meetingDateTime?: string;
  createdBy?: string;
  relatedCustomerHref?: string;
  entityId?: string;
  taskId?: string;
  followUpId?: string;
};

function inferActivityPipelineBadge(...values: Array<string | null | undefined>) {
  const normalized = values
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())
    .join(" ");

  if (!normalized) return undefined;
  if (/\b(call|phone|dial)\b/.test(normalized)) return "CALL";
  if (/\b(demo|presentation|demo send)\b/.test(normalized)) return "DEMO";
  if (/\bfollow[\s-]?up\b/.test(normalized)) return "FOLLOW-UP";
  if (/\b(quotation|quote|quatation)\b/.test(normalized)) return "QUOTATION";
  if (/\b(sale won|won sale|closed won|lead converted|win|won|conversion)\b/.test(normalized)) return "WIN";
  if (/\b(lead lost|deal lost|closed lost|lost|failed|rejected)\b/.test(normalized)) return "LOST";
  return undefined;
}

function toTaskPriorityKey(priority: string | null | undefined) {
  if (priority === "URGENT") return "IMPORTANT" as const;
  if (priority === "HIGH") return "HIGH" as const;
  if (priority === "LOW") return "LOW" as const;
  return "MEDIUM" as const;
}

export type CommunicationHistoryRow = {
  id: string;
  href?: string;
  method: string;
  summary: string;
  subject: string;
  fromEmail: string;
  toEmail: string;
  discussionTopic: string;
  productDiscussed: string;
  outcome: string;
  rating: string;
  nextFollowUpDate: string;
  notes: string;
  createdBy: string;
  time: string;
};

export type CustomerHistory = {
  tasks: TaskRow[];
  followUps: FollowUpRow[];
  activities: ActivityRow[];
  communications: CommunicationHistoryRow[];
};

export type CustomerJourneyStageKey =
  | "task_created"
  | "contacted"
  | "follow_up"
  | "demo"
  | "quotation"
  | "sales_won"
  | "sales_failed";

export type CustomerJourneyStepState = "completed" | "current" | "pending" | "success" | "failed";

export type CustomerJourneyStep = {
  key: CustomerJourneyStageKey;
  label: string;
  helper: string;
  reached: boolean;
  current: boolean;
  state: CustomerJourneyStepState;
  date: string;
};

export type CustomerJourneySignals = {
  customer?: {
    assignedTo?: string | null;
  };
  tasks: Array<{
    title?: string | null;
    description?: string | null;
    notes?: string | null;
    priority?: string | null;
    status?: string | null;
    assignedTo?: string | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    taskDate?: Date | null;
  }>;
  followUps: Array<{
    method?: string | null;
    note?: string | null;
    nextDiscussionPlan?: string | null;
    status?: string | null;
    priority?: string | null;
    assignedTo?: string | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    completedAt?: Date | null;
    followUpDate?: Date | null;
  }>;
  communications: Array<{
    method?: string | null;
    note?: string | null;
    discussionTopic?: string | null;
    productDiscussed?: string | null;
    outcome?: string | null;
    followUpNote?: string | null;
    createdBy?: string | null;
    createdAt?: Date | null;
    communicationAt?: Date | null;
    nextFollowUpDate?: Date | null;
  }>;
  activities: Array<{
    title?: string | null;
    description?: string | null;
    entity?: string | null;
    createdAt?: Date | null;
  }>;
  leads: Array<{
    title?: string | null;
    notes?: string | null;
    status?: string | null;
    priority?: string | null;
    assignedTo?: string | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    followUpDate?: Date | null;
  }>;
  quotations: Array<{
    quoteNumber?: string | null;
    notes?: string | null;
    status?: string | null;
    createdBy?: string | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  }>;
};

export type CustomerJourneySummary = {
  steps: CustomerJourneyStep[];
  currentStageKey: CustomerJourneyStageKey | null;
  currentStage: string;
  stageSummary: string;
  lastActivity: string;
  lastActivityTime: string;
  nextFollowUp: string;
  nextFollowUpStatus: string;
  assignedMarketer: string;
  priority: string;
  status: string;
};

export type NotificationRow = {
  id: string;
  href?: string;
  title: string;
  message: string;
  type: string;
  time: string;
  read: boolean;
};

export type EmployeeRow = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  roleKey: Role;
  status: string;
  statusKey: "ACTIVE" | "INACTIVE";
  designation: string;
  supervisorId?: string | null;
  supervisorIds: string[];
  leads: number;
  calls: number;
  whatsapp: number;
  emails: number;
  meetings: number;
  followUps: number;
  pendingTasks: number;
  overdueFollowUps: number;
  sales: number;
  rewardPoints: number;
  conversionRate: string;
};

export type RewardRuleRow = {
  id: string;
  name: string;
  trigger: string;
  points: number;
  active: boolean;
  createdAt: string;
};

export type ImportExportRow = {
  id: string;
  type: string;
  module: string;
  format: string;
  fileName: string;
  status: string;
  processedRows: number;
  failedRows: number;
  createdAt: string;
};

export type PermissionMatrixRow = {
  module: string;
  permissions: Record<string, boolean>;
};

export type CrmWorkspace = {
  user: ShellUser;
  unreadCount: number;
  stats: CrmStat[];
  teamPerformance?: {
    rows: EmployeeRow[];
    period: TeamPerformancePeriod;
    from: string;
    to: string;
  };
  leads: LeadRow[];
  companies: CompanyRow[];
  tasks: TaskRow[];
  todayPlans: TodayPlanRow[];
  todayWorkItems: TodayWorkItem[];
  followUps: FollowUpRow[];
  products: ProductRow[];
  quotations: QuotationRow[];
  activities: ActivityRow[];
  callActivities?: ActivityRow[];
  notifications: NotificationRow[];
  employees: EmployeeRow[];
  rewardRules: RewardRuleRow[];
  importExportLogs: ImportExportRow[];
  reportLogs: ImportExportRow[];
  permissions: PermissionMatrixRow[];
  pipeline: { label: string; value: number; color: string }[];
  productOpportunities: ProductRow[];
  productIntelligence: {
    topEngaged: ProductIntelligenceItem[];
    highestConversion: ProductIntelligenceItem[];
    mostDiscussed: ProductIntelligenceItem[];
  };
  productCompanyContactSummary: {
    totalTargetCompanies: number;
    contactedCompanies: number;
    remainingCompanies: number;
  };
  systemSummary: { label: string; value: string }[];
  communicationCenterSummary: {
    todayCalls: number;
    todayWhatsApp: number;
    todayEmails: number;
    todayMeetings: number;
    todayFollowUps: number;
    totalCalls: number;
  };
  followUpSummary: {
    overdue: number;
    today: number;
    upcoming: number;
    completed: number;
    actionable: number;
  };
  sidebarCounts: {
    followUps: number;
    leads: number;
    customers: number;
    tasks: number;
    todaysPlan: number;
    products: number;
    rewards: number;
  };
};

const leadStatusLabels: Record<string, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  FOLLOW_UP_REQUIRED: "Follow-up Required",
  QUOTATION_SENT: "Quotation Sent",
  NEGOTIATION: "Negotiation",
  WON_SALE: "Won Sale",
  LOST_SALE: "Lost Sale",
  ON_HOLD: "On Hold",
};

const pipelineColors: Record<string, string> = {
  "New Lead": "bg-blue-500",
  Contacted: "bg-cyan-500",
  Interested: "bg-emerald-500",
  "Follow-up Required": "bg-amber-500",
  "Quotation Sent": "bg-indigo-500",
  Negotiation: "bg-violet-500",
  "Won Sale": "bg-green-500",
  "Lost Sale": "bg-red-500",
  "On Hold": "bg-slate-400",
};

function labelize(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(date: Date | null | undefined, pattern = "dd/MM/yyyy") {
  return formatCrmDate(date, pattern as Parameters<typeof formatCrmDate>[1]);
}

function money(value: number) {
  return `? ${new Intl.NumberFormat("en-US").format(Math.round(value))}`;
}

function followUpBucket(status: string, date: Date) {
  if (status === "COMPLETED") return "Completed";
  if (status === "OVERDUE") return "Overdue";
  if (isBeforeCrmDay(date, new Date())) return "Overdue";
  if (isSameCrmDay(date, new Date())) return "Due Today";
  return "Upcoming";
}

function progressFromLead(status: string) {
  const order = ["NEW_LEAD", "CONTACTED", "INTERESTED", "FOLLOW_UP_REQUIRED", "QUOTATION_SENT", "NEGOTIATION", "WON_SALE"];
  const index = order.indexOf(status);
  return `${Math.max(12, Math.round(((index + 1) / order.length) * 100))}%`;
}

const customerJourneyLabels: Record<CustomerJourneyStageKey, string> = {
  task_created: "Task Created",
  contacted: "Contacted / Call",
  follow_up: "Follow-up",
  demo: "Demo",
  quotation: "Quotation",
  sales_won: "Sales Won",
  sales_failed: "Sales Failed",
};

const CUSTOMER_JOURNEY_STAGE_ORDER: CustomerJourneyStageKey[] = [
  "task_created",
  "contacted",
  "follow_up",
  "demo",
  "quotation",
  "sales_won",
  "sales_failed",
];

const demoStageMatchers = [
  /\bdemo\b/i,
  /\bdemo send\b/i,
  /\bdemo session\b/i,
  /\bproduct demo\b/i,
  /\bpresentation\b/i,
];

const quotationStageMatchers = [
  /\bquotation\b/i,
  /\bquote\b/i,
  /\bquatation\b/i,
  /\bproposal\b/i,
];

const wonStageMatchers = [
  /\bwon sale\b/i,
  /\bsale won\b/i,
  /\bdeal won\b/i,
  /\bclosed won\b/i,
  /\bconverted to sale\b/i,
];

const failedStageMatchers = [
  /\blost sale\b/i,
  /\bsales failed\b/i,
  /\bdeal lost\b/i,
  /\bfailed\b/i,
  /\brejected\b/i,
  /\blost\b/i,
];

function latestJourneyDate(...dates: Array<Date | null | undefined>) {
  const validDates = dates.filter((date): date is Date => Boolean(date));
  if (!validDates.length) return undefined;
  return new Date(Math.max(...validDates.map((date) => date.getTime())));
}

function maxJourneyDate(dates: Array<Date | null | undefined>) {
  return latestJourneyDate(...dates);
}

function textMatchesJourneyKeyword(
  values: Array<string | null | undefined>,
  matchers: RegExp[],
) {
  return values.some((value) => typeof value === "string" && value.trim() && matchers.some((matcher) => matcher.test(value)));
}

function followUpBucketFromRecord(followUp: {
  status?: string | null;
  followUpDate?: Date | null;
}) {
  if (!followUp.followUpDate) return "-";
  return followUpBucket(followUp.status ?? "UPCOMING", followUp.followUpDate);
}

function customerJourneyStageSummary(stageKey: CustomerJourneyStageKey | null) {
  if (stageKey === "sales_won") return "Customer successfully reached the final sales-won stage.";
  if (stageKey === "sales_failed") return "Customer has been closed as failed/lost in real CRM activity.";
  if (stageKey === "quotation") return "Quotation activity is already recorded for this customer.";
  if (stageKey === "demo") return "Demo-related activity was found in the customer journey.";
  if (stageKey === "follow_up") return "Follow-up exists and is currently driving the next action.";
  if (stageKey === "contacted") return "Communication was logged, but no later pipeline step is confirmed yet.";
  if (stageKey === "task_created") return "Task exists, but the journey has not moved beyond task creation yet.";
  return "No real activity has been recorded for this customer yet.";
}

function customerJourneyStepHelper(
  key: CustomerJourneyStageKey,
  reached: boolean,
  signals: {
    communications: number;
    followUps: number;
    quotations: number;
    leadsWon: number;
    leadsLost: number;
  },
) {
  if (!reached) {
    if (key === "sales_failed") return "Shows only when the customer is lost/failed.";
    if (key === "sales_won") return "Shows only after the deal is won.";
    return "Waiting for real CRM activity.";
  }

  if (key === "task_created") return "Task record found in the CRM database.";
  if (key === "contacted") return `${signals.communications} communication log${signals.communications === 1 ? "" : "s"} recorded.`;
  if (key === "follow_up") return `${signals.followUps} follow-up item${signals.followUps === 1 ? "" : "s"} found.`;
  if (key === "demo") return "Demo keyword/activity matched from task, note, follow-up, or communication.";
  if (key === "quotation") return signals.quotations > 0 ? `${signals.quotations} quotation record${signals.quotations === 1 ? "" : "s"} found.` : "Quotation intent detected from CRM activity.";
  if (key === "sales_won") return signals.leadsWon > 0 ? `${signals.leadsWon} won lead status found.` : "Sales win activity detected from quotation conversion.";
  if (key === "sales_failed") return signals.leadsLost > 0 ? `${signals.leadsLost} lost lead status found.` : "Customer has a failed/lost sales outcome.";
  return "Stage detected from CRM data.";
}

export function getCustomerPipelineStage(journey: CustomerJourneySummary) {
  return journey.currentStageKey;
}

export function buildCustomerJourneyTimeline(signals: CustomerJourneySignals): CustomerJourneySummary {
  const taskCreatedAt = maxJourneyDate(signals.tasks.map((task) => latestJourneyDate(task.updatedAt, task.taskDate, task.createdAt)));
  const contactedAt = maxJourneyDate(signals.communications.map((communication) => latestJourneyDate(communication.communicationAt, communication.createdAt)));
  const followUpAt = maxJourneyDate(
    signals.followUps.map((followUp) => latestJourneyDate(followUp.completedAt, followUp.followUpDate, followUp.updatedAt, followUp.createdAt)),
  );

  const demoAt = maxJourneyDate([
    ...signals.tasks
      .filter((task) => textMatchesJourneyKeyword([task.title, task.description, task.notes], demoStageMatchers))
      .map((task) => latestJourneyDate(task.updatedAt, task.taskDate, task.createdAt)),
    ...signals.followUps
      .filter((followUp) => textMatchesJourneyKeyword([followUp.method, followUp.note, followUp.nextDiscussionPlan], demoStageMatchers))
      .map((followUp) => latestJourneyDate(followUp.completedAt, followUp.followUpDate, followUp.updatedAt, followUp.createdAt)),
    ...signals.communications
      .filter((communication) => textMatchesJourneyKeyword([communication.method, communication.note, communication.discussionTopic, communication.outcome, communication.followUpNote], demoStageMatchers))
      .map((communication) => latestJourneyDate(communication.communicationAt, communication.createdAt)),
    ...signals.activities
      .filter((activity) => textMatchesJourneyKeyword([activity.title, activity.description, activity.entity], demoStageMatchers))
      .map((activity) => activity.createdAt),
  ]);

  const quotationAt = maxJourneyDate([
    ...signals.quotations.map((quotation) => latestJourneyDate(quotation.updatedAt, quotation.createdAt)),
    ...signals.leads
      .filter((lead) => lead.status === "QUOTATION_SENT" || lead.status === "NEGOTIATION")
      .map((lead) => latestJourneyDate(lead.updatedAt, lead.followUpDate, lead.createdAt)),
    ...signals.tasks
      .filter((task) => textMatchesJourneyKeyword([task.title, task.description, task.notes], quotationStageMatchers))
      .map((task) => latestJourneyDate(task.updatedAt, task.taskDate, task.createdAt)),
    ...signals.followUps
      .filter((followUp) => textMatchesJourneyKeyword([followUp.method, followUp.note, followUp.nextDiscussionPlan], quotationStageMatchers))
      .map((followUp) => latestJourneyDate(followUp.completedAt, followUp.followUpDate, followUp.updatedAt, followUp.createdAt)),
    ...signals.communications
      .filter((communication) => textMatchesJourneyKeyword([communication.method, communication.note, communication.discussionTopic, communication.outcome, communication.followUpNote], quotationStageMatchers))
      .map((communication) => latestJourneyDate(communication.communicationAt, communication.createdAt)),
    ...signals.activities
      .filter((activity) => textMatchesJourneyKeyword([activity.title, activity.description, activity.entity], quotationStageMatchers))
      .map((activity) => activity.createdAt),
  ]);

  const salesWonAt = maxJourneyDate([
    ...signals.leads
      .filter((lead) => lead.status === "WON_SALE")
      .map((lead) => latestJourneyDate(lead.updatedAt, lead.followUpDate, lead.createdAt)),
    ...signals.quotations
      .filter((quotation) => quotation.status === "CONVERTED_TO_SALE")
      .map((quotation) => latestJourneyDate(quotation.updatedAt, quotation.createdAt)),
    ...signals.communications
      .filter((communication) => textMatchesJourneyKeyword([communication.note, communication.outcome, communication.followUpNote], wonStageMatchers))
      .map((communication) => latestJourneyDate(communication.communicationAt, communication.createdAt)),
    ...signals.activities
      .filter((activity) => textMatchesJourneyKeyword([activity.title, activity.description], wonStageMatchers))
      .map((activity) => activity.createdAt),
  ]);

  const salesFailedAt = maxJourneyDate([
    ...signals.leads
      .filter((lead) => lead.status === "LOST_SALE")
      .map((lead) => latestJourneyDate(lead.updatedAt, lead.followUpDate, lead.createdAt)),
    ...signals.quotations
      .filter((quotation) => quotation.status === "REJECTED")
      .map((quotation) => latestJourneyDate(quotation.updatedAt, quotation.createdAt)),
    ...signals.communications
      .filter((communication) => textMatchesJourneyKeyword([communication.note, communication.outcome, communication.followUpNote], failedStageMatchers))
      .map((communication) => latestJourneyDate(communication.communicationAt, communication.createdAt)),
    ...signals.activities
      .filter((activity) => textMatchesJourneyKeyword([activity.title, activity.description], failedStageMatchers))
      .map((activity) => activity.createdAt),
  ]);

  const stageDates: Partial<Record<CustomerJourneyStageKey, Date | undefined>> = {
    task_created: taskCreatedAt,
    contacted: contactedAt,
    follow_up: followUpAt,
    demo: demoAt,
    quotation: quotationAt,
    sales_won: salesWonAt,
    sales_failed: salesFailedAt,
  };

  const finalCandidates = (["sales_won", "sales_failed"] as const)
    .filter((key) => stageDates[key])
    .sort((left, right) => {
      const leftTime = stageDates[left]?.getTime() ?? 0;
      const rightTime = stageDates[right]?.getTime() ?? 0;
      return rightTime - leftTime;
    });

  const currentStageKey = finalCandidates[0]
    ?? [...CUSTOMER_JOURNEY_STAGE_ORDER]
      .filter((key) => !["sales_won", "sales_failed"].includes(key) && stageDates[key])
      .pop()
    ?? null;

  const actionableFollowUps = signals.followUps
    .filter((followUp) => followUp.followUpDate && followUp.status !== "COMPLETED")
    .sort((left, right) => (left.followUpDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.followUpDate?.getTime() ?? Number.MAX_SAFE_INTEGER));

  const nextFollowUpRecord = actionableFollowUps[0];
  const lastPrioritySource = nextFollowUpRecord
    ?? [...signals.tasks].sort((left, right) => (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0))[0]
    ?? [...signals.leads].sort((left, right) => (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0))[0];

  const events = [
    ...signals.tasks.map((task) => ({
      at: latestJourneyDate(task.updatedAt, task.taskDate, task.createdAt),
      label: firstMeaningfulText(task.title, "Task Created") ?? "Task Created",
      detail: firstMeaningfulText(task.description, task.notes),
    })),
    ...signals.followUps.map((followUp) => ({
      at: latestJourneyDate(followUp.completedAt, followUp.followUpDate, followUp.updatedAt, followUp.createdAt),
      label: `${labelize(followUp.method ?? "Follow-up")} Follow-up`,
      detail: firstMeaningfulText(followUp.note, followUp.nextDiscussionPlan, followUp.assignedTo),
    })),
    ...signals.communications.map((communication) => ({
      at: latestJourneyDate(communication.communicationAt, communication.createdAt),
      label: `${labelize(communication.method ?? "Communication")} Communication`,
      detail: firstMeaningfulText(communication.note, communication.discussionTopic, communication.outcome, communication.followUpNote),
    })),
    ...signals.activities.map((activity) => ({
      at: activity.createdAt,
      label: firstMeaningfulText(activity.title, "CRM Activity") ?? "CRM Activity",
      detail: firstMeaningfulText(activity.description, activity.entity),
    })),
    ...signals.quotations.map((quotation) => ({
      at: latestJourneyDate(quotation.updatedAt, quotation.createdAt),
      label: firstMeaningfulText(quotation.quoteNumber ? `Quotation ${quotation.quoteNumber}` : undefined, "Quotation") ?? "Quotation",
      detail: firstMeaningfulText(quotation.notes, labelize(quotation.status)),
    })),
    ...signals.leads
      .filter((lead) => Boolean(lead.status))
      .map((lead) => ({
        at: latestJourneyDate(lead.updatedAt, lead.followUpDate, lead.createdAt),
        label: `Lead ${leadStatusLabels[lead.status ?? ""] ?? labelize(lead.status)}`,
        detail: firstMeaningfulText(lead.title, lead.notes),
      })),
  ]
    .filter((event) => event.at)
    .sort((left, right) => (right.at?.getTime() ?? 0) - (left.at?.getTime() ?? 0));

  const lastActivity = events[0];
  const leadsWonCount = signals.leads.filter((lead) => lead.status === "WON_SALE").length;
  const leadsLostCount = signals.leads.filter((lead) => lead.status === "LOST_SALE").length;

  return {
    steps: CUSTOMER_JOURNEY_STAGE_ORDER.map((key) => {
      const reached = Boolean(stageDates[key]);
      const current = currentStageKey === key;
      const state: CustomerJourneyStepState = key === "sales_failed" && current
        ? "failed"
        : key === "sales_won" && current
          ? "success"
          : current
            ? "current"
            : key === "sales_failed" && reached
              ? "failed"
              : key === "sales_won" && reached
                ? "success"
                : reached
                  ? "completed"
                  : "pending";

      return {
        key,
        label: customerJourneyLabels[key],
        helper: customerJourneyStepHelper(key, reached, {
          communications: signals.communications.length,
          followUps: signals.followUps.length,
          quotations: signals.quotations.length,
          leadsWon: leadsWonCount,
          leadsLost: leadsLostCount,
        }),
        reached,
        current,
        state,
        date: stageDates[key] ? dateLabel(stageDates[key], "dd/MM/yyyy hh:mm a") : "-",
      };
    }),
    currentStageKey,
    currentStage: currentStageKey ? customerJourneyLabels[currentStageKey] : "No activity yet",
    stageSummary: customerJourneyStageSummary(currentStageKey),
    lastActivity: lastActivity ? firstMeaningfulText(lastActivity.label, lastActivity.detail) ?? "No activity yet" : "No activity yet",
    lastActivityTime: lastActivity?.at ? dateLabel(lastActivity.at, "dd/MM/yyyy hh:mm a") : "-",
    nextFollowUp: nextFollowUpRecord?.followUpDate ? dateLabel(nextFollowUpRecord.followUpDate, "dd/MM/yyyy hh:mm a") : "No upcoming follow-up",
    nextFollowUpStatus: nextFollowUpRecord ? followUpBucketFromRecord(nextFollowUpRecord) : "No upcoming follow-up",
    assignedMarketer: firstMeaningfulText(
      signals.customer?.assignedTo,
      nextFollowUpRecord?.assignedTo,
      signals.leads.find((lead) => lead.assignedTo)?.assignedTo,
      signals.communications.find((communication) => communication.createdBy)?.createdBy,
    ) ?? "-",
    priority: firstMeaningfulText(labelize(lastPrioritySource?.priority), "-") ?? "-",
    status: currentStageKey === "sales_won"
      ? "Won Sale"
      : currentStageKey === "sales_failed"
        ? "Sales Failed"
        : nextFollowUpRecord
          ? followUpBucketFromRecord(nextFollowUpRecord)
          : currentStageKey
            ? customerJourneyLabels[currentStageKey]
            : "No activity",
  };
}

const taskInclude = {
  assignedTo: true,
  assignedBy: true,
  completedBy: true,
  company: {
    select: {
      id: true,
      name: true,
    },
  },
  lead: {
    select: {
      id: true,
      title: true,
      customerName: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.Prisma.TaskInclude;

type TaskRecord = Prisma.Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

const followUpInclude = {
  company: {
    select: {
      id: true,
      name: true,
      phone: true,
      contacts: {
        select: {
          id: true,
          name: true,
          mobile: true,
          whatsapp: true,
          email: true,
          isPrimary: true,
        },
      },
      phoneNumbers: {
        select: {
          id: true,
          number: true,
          whatsapp: true,
        },
      },
      communications: {
        select: {
          id: true,
          method: true,
          communicationAt: true,
        },
        orderBy: { communicationAt: "desc" },
        take: 1,
      },
    },
  },
  lead: {
    select: {
      id: true,
      title: true,
      customerName: true,
      phone: true,
      communications: {
        select: {
          id: true,
          method: true,
          communicationAt: true,
        },
        orderBy: { communicationAt: "desc" },
        take: 1,
      },
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
    },
  },
  task: {
    select: {
      id: true,
      title: true,
      notes: true,
      reminder: true,
      priority: true,
      productId: true,
      taskDate: true,
      taskTime: true,
      product: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  timelineItems: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 1,
  },
} satisfies Prisma.Prisma.FollowUpInclude;

type FollowUpRecord = Prisma.Prisma.FollowUpGetPayload<{ include: typeof followUpInclude }>;

const communicationHistoryInclude = {
  user: true,
  company: {
    select: {
      id: true,
      name: true,
    },
  },
  lead: {
    select: {
      id: true,
      title: true,
      customerName: true,
    },
  },
  task: true,
} satisfies Prisma.Prisma.CommunicationLogInclude;

type CommunicationHistoryRecord = Prisma.Prisma.CommunicationLogGetPayload<{ include: typeof communicationHistoryInclude }>;

const activityTimelineInclude = {
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  company: {
    select: {
      id: true,
      name: true,
    },
  },
  lead: {
    select: {
      id: true,
      title: true,
      customerName: true,
    },
  },
  task: {
    select: {
      id: true,
      title: true,
      description: true,
      notes: true,
      dueDate: true,
      taskTime: true,
    },
  },
  followUp: {
    select: {
      id: true,
      method: true,
      note: true,
      nextDiscussionPlan: true,
      followUpDate: true,
      completedAt: true,
      rating: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  communicationLog: {
    select: {
      id: true,
      method: true,
      note: true,
      discussionTopic: true,
      productDiscussed: true,
      outcome: true,
      rating: true,
      nextFollowUpDate: true,
      followUpNote: true,
      communicationAt: true,
    },
  },
} satisfies Prisma.Prisma.ActivityTimelineInclude;

type ActivityTimelineRecord = Prisma.Prisma.ActivityTimelineGetPayload<{ include: typeof activityTimelineInclude }>;

const activityLogInclude = {
  user: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.Prisma.ActivityLogInclude;

type ActivityLogRecord = Prisma.Prisma.ActivityLogGetPayload<{ include: typeof activityLogInclude }>;

const workspaceCompanySelect = {
  id: true,
  name: true,
  createdAt: true,
  industry: true,
  contactPerson: true,
  phone: true,
  totalLeads: true,
  lastCommunication: true,
  city: true,
  address: true,
  website: true,
  notes: true,
  status: true,
  rawData: true,
  assignedTo: {
    select: {
      id: true,
      name: true,
    },
  },
  contacts: {
    select: {
      id: true,
      name: true,
      designation: true,
      mobile: true,
      whatsapp: true,
      email: true,
      isPrimary: true,
    },
  },
  phoneNumbers: {
    select: {
      id: true,
      label: true,
      number: true,
      whatsapp: true,
    },
  },
  leads: {
    select: {
      id: true,
      title: true,
      status: true,
      followUpDate: true,
    },
  },
  followUps: {
    select: {
      id: true,
      status: true,
      followUpDate: true,
      completedAt: true,
    },
    orderBy: { followUpDate: "asc" },
    take: 5,
  },
  communications: {
    select: {
      id: true,
      createdAt: true,
      leadId: true,
      method: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
  assignedToId: true,
} satisfies Prisma.Prisma.CustomerCompanySelect;

type ExistingCustomerRecord = Prisma.Prisma.CustomerCompanyGetPayload<{ select: typeof workspaceCompanySelect }>;

const customerJourneyLeadSelect = {
  id: true,
  title: true,
  notes: true,
  status: true,
  priority: true,
  followUpDate: true,
  createdAt: true,
  updatedAt: true,
  assignedTo: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.Prisma.LeadSelect;

type CustomerJourneyLeadRecord = Prisma.Prisma.LeadGetPayload<{ select: typeof customerJourneyLeadSelect }>;

const customerJourneyQuotationSelect = {
  id: true,
  quoteNumber: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      name: true,
    },
  },
  lead: {
    select: {
      assignedToId: true,
      createdById: true,
    },
  },
  createdById: true,
} satisfies Prisma.Prisma.QuotationSelect;

type CustomerJourneyQuotationRecord = Prisma.Prisma.QuotationGetPayload<{ select: typeof customerJourneyQuotationSelect }>;

const productInclude = {
  interests: {
    include: {
      user: true,
      company: {
        select: {
          id: true,
          name: true,
          assignedToId: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
          communications: {
            select: {
              id: true,
              leadId: true,
              method: true,
              note: true,
              discussionTopic: true,
              productDiscussed: true,
              followUpNote: true,
              nextFollowUpDate: true,
              communicationAt: true,
              userId: true,
            },
            orderBy: { communicationAt: "desc" },
          },
        },
      },
      lead: {
        include: {
          assignedTo: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          communications: {
            select: {
              id: true,
              leadId: true,
              method: true,
              communicationAt: true,
              userId: true,
            },
            orderBy: { communicationAt: "desc" },
          },
          followUps: true,
          quotations: true,
        },
      },
    },
  },
  leads: {
    include: {
      assignedTo: true,
      company: {
        select: {
          id: true,
          name: true,
          communications: {
            select: {
              id: true,
              leadId: true,
              method: true,
              note: true,
              discussionTopic: true,
              productDiscussed: true,
              followUpNote: true,
              nextFollowUpDate: true,
              communicationAt: true,
              userId: true,
            },
            orderBy: { communicationAt: "desc" },
          },
        },
      },
      communications: {
        select: {
          id: true,
          leadId: true,
          method: true,
          note: true,
          discussionTopic: true,
          productDiscussed: true,
          followUpNote: true,
          nextFollowUpDate: true,
          communicationAt: true,
          userId: true,
        },
        orderBy: { communicationAt: "desc" },
      },
      followUps: true,
      quotations: { include: { items: true, createdBy: true } },
    },
  },
  quoteItems: {
    include: {
      quotation: {
        include: {
          company: { select: { id: true, name: true } },
          createdBy: true,
          lead: { include: { assignedTo: true, createdBy: true } },
        },
      },
    },
  },
  tasks: {
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
          assignedToId: true,
        },
      },
      lead: {
        select: {
          id: true,
          companyId: true,
          customerName: true,
          title: true,
          assignedToId: true,
          createdById: true,
          communications: {
            select: {
              id: true,
              leadId: true,
              method: true,
              note: true,
              discussionTopic: true,
              productDiscussed: true,
              followUpNote: true,
              nextFollowUpDate: true,
              communicationAt: true,
              userId: true,
            },
            orderBy: { communicationAt: "desc" },
          },
        },
      },
      communications: {
        select: {
          id: true,
          leadId: true,
          method: true,
          note: true,
          discussionTopic: true,
          productDiscussed: true,
          followUpNote: true,
          nextFollowUpDate: true,
          communicationAt: true,
          userId: true,
        },
        orderBy: { communicationAt: "desc" },
      },
      followUps: {
        select: {
          id: true,
          status: true,
          assignedToId: true,
          followUpDate: true,
        },
      },
    },
  },
} satisfies Prisma.Prisma.ProductServiceInclude;

const dashboardLeadSelect = {
  id: true,
  companyId: true,
  title: true,
  customerName: true,
  phone: true,
  email: true,
  productInterestId: true,
  interestedProduct: {
    select: {
      name: true,
    },
  },
  status: true,
  score: true,
  priority: true,
  assignedToId: true,
  assignedTo: {
    select: {
      name: true,
    },
  },
  followUpDate: true,
  purchaseProbability: true,
  notes: true,
  createdAt: true,
  company: {
    select: {
      name: true,
    },
  },
  _count: {
    select: {
      communications: true,
      followUps: true,
    },
  },
} satisfies Prisma.Prisma.LeadSelect;

const dashboardCompanySelect = {
  id: true,
  name: true,
  createdAt: true,
  contactPerson: true,
  phone: true,
  city: true,
  address: true,
  website: true,
  status: true,
  assignedToId: true,
  assignedTo: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.Prisma.CustomerCompanySelect;

const dashboardProductSelect = {
  id: true,
  name: true,
  category: true,
  brand: true,
  price: true,
  imageUrl: true,
  description: true,
  specification: true,
  status: true,
} satisfies Prisma.Prisma.ProductServiceSelect;

const dashboardQuotationSelect = {
  id: true,
  companyId: true,
  leadId: true,
  quoteNumber: true,
  totalAmount: true,
  status: true,
  createdAt: true,
  company: {
    select: {
      name: true,
    },
  },
  lead: {
    select: {
      customerName: true,
    },
  },
  createdBy: {
    select: {
      name: true,
    },
  },
  items: {
    select: {
      description: true,
    },
    take: 1,
  },
} satisfies Prisma.Prisma.QuotationSelect;

const dashboardEmployeeSelect = {
  id: true,
  name: true,
  email: true,
  mobile: true,
  role: true,
  status: true,
  designation: true,
  supervisorId: true,
  supervisorAssignmentsAsMarketer: { select: { supervisorId: true } },
} satisfies Prisma.Prisma.UserSelect;

type ProductRecord = Prisma.Prisma.ProductServiceGetPayload<{ include: typeof productInclude }>;
type ProductLeadRecord = ProductRecord["leads"][number];
type ProductCommunicationRecord = ProductLeadRecord["communications"][number];
type ProductQuoteRecord = ProductRecord["quoteItems"][number]["quotation"];
type ProductTaskRecord = ProductRecord["tasks"][number];

function linkedEntityHref({ entity, entityId, leadId, companyId, quotationId }: { entity?: string | null; entityId?: string | null; leadId?: string | null; companyId?: string | null; quotationId?: string | null }) {
  if (leadId) return `/leads/${leadId}`;
  if (companyId) return `/customers/${companyId}`;
  if (quotationId) return `/quotations/${quotationId}`;
  if (!entity || !entityId) return undefined;

  const normalized = entity.replace(/[_\s-]/g, "").toUpperCase();
  if (normalized.includes("LEAD")) return `/leads/${entityId}`;
  if (normalized.includes("CUSTOMER") || normalized.includes("COMPANY")) return `/customers/${entityId}`;
  if (normalized.includes("QUOTATION") || normalized.includes("QUOTE")) return `/quotations/${entityId}`;
  if (normalized.includes("PRODUCT")) return `/products/${entityId}`;
  return undefined;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function isValidEmail(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase()));
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim().toLowerCase() ?? "")
        .filter((value) => isValidEmail(value)),
    ),
  );
}

function splitLeadContacts(value?: string | null) {
  if (!value) return [];
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function primaryLeadContact(value?: string | null) {
  return splitLeadContacts(value)[0] ?? "-";
}

function lastCommunicationType(followUp: FollowUpRecord) {
  const leadCommunication = followUp.lead?.communications[0];
  const companyCommunication = followUp.company?.communications[0];

  if (leadCommunication && companyCommunication) {
    return leadCommunication.communicationAt > companyCommunication.communicationAt ? leadCommunication.method : companyCommunication.method;
  }

  return leadCommunication?.method ?? companyCommunication?.method ?? "-";
}

function mapTaskRow(task: TaskRecord): TaskRow {
  const taskDate = (task as { taskDate?: Date | null }).taskDate ?? task.dueDate ?? task.createdAt;
  const previous = task.status !== "COMPLETED" && ((((task as { isPrevious?: boolean | null }).isPrevious) ?? false) || isBeforeCrmDay(taskDate, new Date()));

  return {
    id: task.id,
    companyId: task.companyId,
    leadId: task.leadId,
    companyName: (task as { companyName?: string | null }).companyName,
    leadName: (task as { leadName?: string | null }).leadName,
    productId: task.productId,
    href: linkedEntityHref({ leadId: task.leadId, companyId: task.companyId }),
    title: task.title,
    description: task.description ?? "-",
    assignedToId: task.assignedToId,
    assignedTo: task.assignedTo?.name ?? "-",
    assignedBy: task.assignedBy?.name ?? "-",
    relatedTo: task.company?.name ?? task.lead?.title ?? (task as { companyName?: string | null }).companyName ?? (task as { leadName?: string | null }).leadName ?? "-",
    product: task.product?.name ?? "-",
    taskDate: dateLabel(taskDate),
    taskDateIso: taskDate.toISOString(),
    dueDate: dateLabel(task.dueDate ?? taskDate),
    time: dateLabel(task.taskTime ?? taskDate, "hh:mm a"),
    priority: labelize(task.priority),
    priorityKey: task.priority,
    status: task.status,
    statusKey: task.status,
    isPrevious: previous,
    completedAt: dateLabel(task.completedAt, "dd/MM/yyyy hh:mm a"),
    completedBy: task.completedBy?.name ?? "-",
    reminder: task.reminder ?? "-",
    notes: task.notes ?? "-",
  };
}

function mapFollowUpRow(followUp: FollowUpRecord): FollowUpRow {
  const bucket = followUpBucket(followUp.status, followUp.followUpDate);
  const followUpPriority = (followUp as { priority?: string }).priority;
  const primaryContact = followUp.company?.contacts.find((contact) => contact.isPrimary) ?? followUp.company?.contacts[0];
  const whatsappNumber = followUp.company?.phoneNumbers.find((phone) => phone.whatsapp);
  const regularPhone = followUp.company?.phoneNumbers[0];

  return {
    id: followUp.id,
    companyId: followUp.companyId,
    leadId: followUp.leadId,
    taskId: followUp.task?.id ?? null,
    taskTitle: followUp.task?.title ?? null,
    taskNotes: followUp.task?.notes ?? null,
    taskReminder: followUp.task?.reminder ?? null,
    taskProductId: followUp.task?.productId ?? null,
    taskProductName: followUp.task?.product?.name ?? null,
    taskPriorityKey: followUp.task?.priority ? toTaskPriorityKey(followUp.task.priority) : undefined,
    taskDateIso: (followUp.task?.taskTime ?? followUp.task?.taskDate)?.toISOString() ?? null,
    href: linkedEntityHref({ leadId: followUp.leadId, companyId: followUp.companyId }),
    customer: followUp.company?.name ?? followUp.lead?.customerName ?? "-",
    phone:
      primaryContact?.mobile ??
      primaryContact?.whatsapp ??
      whatsappNumber?.number ??
      regularPhone?.number ??
      followUp.company?.phone ??
      followUp.lead?.phone ??
      "-",
    lead: followUp.lead?.title ?? "-",
    method: followUp.method,
    note: followUp.note ?? "-",
    lastCommunicationType: lastCommunicationType(followUp),
    nextDiscussionPlan: followUp.nextDiscussionPlan ?? "-",
    status: bucket,
    bucket,
    followUpDate: dateLabel(followUp.followUpDate, "dd/MM/yyyy hh:mm a"),
    followUpDateIso: followUp.followUpDate.toISOString(),
    assignedTo: followUp.assignedTo?.name ?? "-",
    priority: labelize(followUpPriority ?? "MEDIUM"),
    createdBy: followUp.timelineItems[0]?.user?.name ?? "-",
    createdAt: dateLabel(followUp.createdAt, "dd/MM/yyyy hh:mm a"),
    completedAt: dateLabel(followUp.completedAt, "dd/MM/yyyy hh:mm a"),
  };
}

function mapCommunicationHistoryRow(log: CommunicationHistoryRecord): CommunicationHistoryRow {
  const fromEmail = (log as { productDiscussed?: string | null }).productDiscussed ?? "-";
  const toEmail = log.followUpNote ?? "-";
  const subject = (log as { discussionTopic?: string | null }).discussionTopic ?? "-";

  return {
    id: log.id,
    href: linkedEntityHref({ leadId: log.leadId, companyId: log.companyId }),
    method: log.method,
    summary: log.note,
    subject,
    fromEmail,
    toEmail,
    discussionTopic: subject,
    productDiscussed: fromEmail,
    outcome: log.outcome ?? "-",
    rating: typeof log.rating === "number" ? String(log.rating) : "-",
    nextFollowUpDate: dateLabel(log.nextFollowUpDate, "dd/MM/yyyy hh:mm a"),
    notes: toEmail,
    createdBy: log.user?.name ?? "-",
    time: dateLabel(log.communicationAt, "dd/MM/yyyy hh:mm a"),
  };
}

function buildCallActivityRowFromCommunication(log: CommunicationHistoryRecord): ActivityRow {
  const activityAt = log.communicationAt ?? log.createdAt;
  const customerName = log.company?.name ?? log.lead?.customerName ?? "-";
  const customerHref = linkedEntityHref({ leadId: log.leadId, companyId: log.companyId });
  const discussionSummary = firstMeaningfulText(log.note, log.discussionTopic, log.outcome);
  const notes = firstMeaningfulText(log.followUpNote, log.productDiscussed);

  return {
    id: `communication-${log.id}`,
    href: customerHref,
    title: humanizeActivityTitle({ title: log.method, rawAction: log.method, category: "CALL" }),
    detail: firstMeaningfulText(
      customerName !== "-" && log.user?.name ? `${customerName} · ${log.user.name}` : undefined,
      customerName,
      log.user?.name ? `By ${log.user.name}` : undefined,
      "Phone call",
    ) ?? "Phone call",
    time: dateLabel(activityAt, "dd/MM/yyyy hh:mm a"),
    createdAtValue: activityAt.toISOString(),
    dateLabel: dateLabel(activityAt, "dd MMM yyyy"),
    timeLabel: dateLabel(activityAt, "hh:mm a"),
    category: "CALL",
    badgeLabel: "CALL",
    customerName,
    customerHref,
    employeeName: log.user?.name ?? "-",
    employeeId: log.user?.id ?? undefined,
    entity: "CommunicationLog",
    entityId: log.id,
    rawAction: log.method,
    discussionSummary,
    notes,
    rating: typeof log.rating === "number" ? String(log.rating) : undefined,
    contactMethod: log.method,
    nextFollowUpDate: log.nextFollowUpDate ? dateLabel(log.nextFollowUpDate, "dd MMM yyyy hh:mm a") : undefined,
    createdBy: log.user?.name ?? "-",
    relatedCustomerHref: customerHref,
  };
}

function buildProductCompanyContactSummary(products: ProductRecord[], scopedUserIds?: string[]) {
  const scope = scopedUserIds ? new Set(scopedUserIds) : undefined;
  const targetCompanyIds = new Set<string>();
  const contactedCompanyIds = new Set<string>();

  for (const product of products) {
    for (const lead of product.leads) {
      if (!leadInScope(lead, scope) || !lead.companyId) continue;
      targetCompanyIds.add(lead.companyId);
      if (collectLeadCommunications(lead).length > 0) {
        contactedCompanyIds.add(lead.companyId);
      }
    }

    for (const interest of product.interests) {
      if (!interest.companyId || !interest.company) continue;
      const linkedLeadAllowed = interest.leadId ? product.leads.some((lead) => lead.id === interest.leadId && leadInScope(lead, scope)) : false;
      const standaloneAllowed = !interest.leadId && (userInScope(scope, interest.userId) || userInScope(scope, interest.company.assignedToId));
      if (!linkedLeadAllowed && !standaloneAllowed) continue;

      targetCompanyIds.add(interest.companyId);
      const standaloneCommunications = (interest.company.communications ?? []).filter((communication) => !communication.leadId);
      if (standaloneCommunications.length > 0) {
        contactedCompanyIds.add(interest.companyId);
      }
    }

    for (const task of product.tasks) {
      if (!taskInScope(task, scope)) continue;
      const companyId = task.companyId ?? task.lead?.companyId ?? null;
      if (!companyId) continue;
      targetCompanyIds.add(companyId);
      if (task.communications.length > 0 || task.lead?.communications.length) {
        contactedCompanyIds.add(companyId);
      }
    }
  }

  const totalTargetCompanies = targetCompanyIds.size;
  const contactedCompanies = Array.from(contactedCompanyIds).filter((id) => targetCompanyIds.has(id)).length;
  return {
    totalTargetCompanies,
    contactedCompanies,
    remainingCompanies: Math.max(0, totalTargetCompanies - contactedCompanies),
  };
}

function normalizeRawJson(value: Prisma.Prisma.JsonValue): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readJsonText(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
  }

  return undefined;
}

function firstMeaningfulText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() && value.trim() !== "-") return value.trim();
  }

  return undefined;
}

function normalizeActivityToken(value?: string | null) {
  if (!value?.trim()) return "";
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

function activityCategoryLabel(category?: ActivityRow["category"]) {
  switch (category) {
    case "CALL":
      return "CALL";
    case "WHATSAPP":
      return "WHATSAPP";
    case "EMAIL":
      return "EMAIL";
    case "MEETING":
      return "MEETING";
    case "FOLLOW_UP":
      return "FOLLOW-UP";
    case "QUOTATION":
      return "QUOTATION";
    case "LEAD":
      return "LEAD";
    case "TASK":
      return "TASK";
    case "PLAN":
      return "PLAN";
    case "USER":
      return "USER";
    case "SYSTEM":
      return "SYSTEM";
    default:
      return "ACTIVITY";
  }
}

function inferActivityCategory(input: {
  title?: string | null;
  rawAction?: string | null;
  entity?: string | null;
  description?: string | null;
  method?: string | null;
}): NonNullable<ActivityRow["category"]> {
  const values = [input.method, input.rawAction, input.title, input.description, input.entity]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  if (values.some((value) => value.includes("meeting"))) return "MEETING";
  if (values.some((value) => value.includes("whatsapp"))) return "WHATSAPP";
  if (values.some((value) => value.includes("email") || value.includes("gmail"))) return "EMAIL";
  if (values.some((value) => value.includes("phone") || value.includes("call"))) return "CALL";
  if (values.some((value) => value.includes("lead converted") || value.includes("won sale") || value.includes("converted lead"))) return "LEAD";
  if (values.some((value) => value.includes("quotation") || value.includes("quote"))) return "QUOTATION";
  if (values.some((value) => value.includes("follow-up") || value.includes("follow up"))) return "FOLLOW_UP";
  if (values.some((value) => value.includes("task"))) return "TASK";
  if (values.some((value) => value.includes("plan"))) return "PLAN";
  if (values.some((value) => value.includes("user"))) return "USER";
  if (values.some((value) => value.includes("system") || value.includes("setting"))) return "SYSTEM";
  return "OTHER";
}

function humanizeActivityTitle(input: {
  title: string;
  rawAction?: string | null;
  category?: ActivityRow["category"];
}) {
  const normalizedValues = [input.rawAction, input.title].map(normalizeActivityToken).filter(Boolean);
  if (normalizedValues.some((value) => value === "EMAIL_COMPOSE_OPENED" || value === "EMAIL_OPENED")) return "Opened Gmail Compose";
  if (normalizedValues.some((value) => value === "WHATSAPP_OPENED" || value === "WHATSAPP_CHAT_OPENED")) return "Opened WhatsApp";
  if (normalizedValues.some((value) => value === "CALL_INITIATED" || value === "PHONE_CALL_OPENED" || value === "CALL_OPENED")) return "Phone Call Initiated";
  if (normalizedValues.some((value) => value === "FOLLOW_UP_COMPLETED")) return "Completed Follow-up";
  if (normalizedValues.some((value) => value === "MEETING_SCHEDULED")) return "Meeting Scheduled";
  if (normalizedValues.some((value) => value === "QUOTATION_CREATED")) return "Quotation Created";
  if (normalizedValues.some((value) => value === "LEAD_CONVERTED" || value === "WON_SALE")) return "Lead Converted";

  const rawText = firstMeaningfulText(input.rawAction, input.title);
  if (!rawText) return "CRM Activity";
  const lower = rawText.toLowerCase();

  if (input.category === "EMAIL" && (lower.includes("open") || lower.includes("compose"))) return "Opened Gmail Compose";
  if (input.category === "WHATSAPP" && lower.includes("open")) return "Opened WhatsApp";
  if (input.category === "CALL" && (lower.includes("open") || lower.includes("initiat"))) return "Phone Call Initiated";
  if (input.category === "FOLLOW_UP" && lower.includes("complete")) return "Completed Follow-up";
  if (input.category === "MEETING" && (lower.includes("schedule") || lower.includes("meeting"))) return "Meeting Scheduled";
  if (input.category === "QUOTATION" && lower.includes("create")) return "Quotation Created";
  if (input.category === "LEAD" && (lower.includes("convert") || lower.includes("won"))) return "Lead Converted";

  return labelize(rawText.replace(/[_-]+/g, " "));
}

function normalizeActivityEntityKey(entity?: string | null, entityId?: string | null) {
  if (!entityId) return "";
  return `${normalizeActivityToken(entity)}:${entityId}`;
}

function buildActivityRowFromTimeline(item: ActivityTimelineRecord): ActivityRow {
  const metadata = normalizeRawJson(item.metadata ?? {});
  const rawAction = firstMeaningfulText(readJsonText(metadata, ["action"]), item.title) ?? item.title;
  const contactMethod = firstMeaningfulText(item.communicationLog?.method, item.followUp?.method, readJsonText(metadata, ["method"]));
  const customerName = firstMeaningfulText(item.company?.name, item.lead?.customerName, readJsonText(metadata, ["customerName", "companyName"]));
  const customerHref = item.companyId ? `/customers/${item.companyId}` : item.leadId ? `/leads/${item.leadId}` : undefined;
  const employeeName = firstMeaningfulText(item.user?.name, readJsonText(metadata, ["userName"]), item.followUp?.assignedTo?.name);
  const category = inferActivityCategory({
    title: item.title,
    rawAction,
    entity: item.entity,
    description: item.description,
    method: contactMethod,
  });
  const title = humanizeActivityTitle({ title: item.title, rawAction, category });
  const discussionSummary = firstMeaningfulText(item.communicationLog?.note, item.description, item.followUp?.note, item.task?.description);
  const notes = firstMeaningfulText(item.communicationLog?.followUpNote, item.followUp?.nextDiscussionPlan, item.task?.notes);
  const phoneOrEmailUsed = firstMeaningfulText(
    readJsonText(metadata, ["phone", "phoneNumber", "customerPhone", "mobile", "whatsapp", "email"]),
  );
  const taskId =
    item.taskId
    ?? item.task?.id
    ?? readJsonText(metadata, ["taskId", "linkedTaskId", "sourceTaskId"])
    ?? (item.entity?.toLowerCase().includes("task") ? item.entityId ?? undefined : undefined);
  const followUpId =
    item.followUpId
    ?? item.followUp?.id
    ?? readJsonText(metadata, ["followUpId", "linkedFollowUpId", "sourceFollowUpId"])
    ?? (item.entity?.toLowerCase().includes("follow") ? item.entityId ?? undefined : undefined);
  const pipelineBadge = inferActivityPipelineBadge(
    item.task?.title,
    item.title,
    rawAction,
    item.description,
    discussionSummary,
    notes,
    contactMethod,
    item.communicationLog?.discussionTopic,
    item.communicationLog?.outcome,
    readJsonText(metadata, ["taskTitle", "taskStep", "stage", "status", "outcome"]),
  );

  return {
    id: item.id,
    href: linkedEntityHref({ entity: item.entity, entityId: item.entityId, leadId: item.leadId, companyId: item.companyId }),
    title,
    detail: firstMeaningfulText(
      customerName && employeeName ? `${customerName} · ${employeeName}` : undefined,
      customerName,
      employeeName ? `By ${employeeName}` : undefined,
      item.description,
      `${labelize(item.entity)} activity`,
    ) ?? "CRM activity",
    time: dateLabel(item.createdAt, "dd/MM/yyyy hh:mm a"),
    createdAtValue: item.createdAt.toISOString(),
    dateLabel: dateLabel(item.createdAt, "dd MMM yyyy"),
    timeLabel: dateLabel(item.createdAt, "hh:mm a"),
    category,
    badgeLabel: pipelineBadge ?? activityCategoryLabel(category),
    customerName,
    customerHref,
    employeeName,
    employeeId: item.user?.id ?? undefined,
    entity: item.entity,
    entityId: item.entityId ?? undefined,
    rawAction,
    discussionSummary,
    notes,
    phoneOrEmailUsed,
    rating:
      typeof item.communicationLog?.rating === "number"
        ? String(item.communicationLog.rating)
        : typeof item.followUp?.rating === "number"
          ? String(item.followUp.rating)
          : undefined,
    contactMethod,
    nextFollowUpDate: item.communicationLog?.nextFollowUpDate ? dateLabel(item.communicationLog.nextFollowUpDate, "dd MMM yyyy hh:mm a") : undefined,
    quotationReference: category === "QUOTATION" ? firstMeaningfulText(item.description, title) : undefined,
    meetingDateTime:
      category === "MEETING"
        ? firstMeaningfulText(
          item.followUp?.followUpDate ? dateLabel(item.followUp.followUpDate, "dd MMM yyyy hh:mm a") : undefined,
          item.task?.taskTime ? dateLabel(item.task.taskTime, "dd MMM yyyy hh:mm a") : undefined,
          item.task?.dueDate ? dateLabel(item.task.dueDate, "dd MMM yyyy hh:mm a") : undefined,
          item.communicationLog?.communicationAt ? dateLabel(item.communicationLog.communicationAt, "dd MMM yyyy hh:mm a") : undefined,
        )
        : undefined,
    createdBy: employeeName,
    relatedCustomerHref: customerHref,
    taskId,
    followUpId,
  };
}

function buildActivityRowFromLog(item: ActivityLogRecord): ActivityRow {
  const metadata = normalizeRawJson(item.metadata ?? {});
  const customerId = readJsonText(metadata, ["customerId", "companyId"]);
  const customerName = readJsonText(metadata, ["customerName", "companyName"]);
  const employeeName = firstMeaningfulText(item.user?.name, readJsonText(metadata, ["userName"]));
  const rawAction = firstMeaningfulText(readJsonText(metadata, ["action"]), item.action) ?? item.action;
  const contactMethod = firstMeaningfulText(readJsonText(metadata, ["method"]));
  const phoneOrEmailUsed = firstMeaningfulText(
    readJsonText(metadata, ["phone", "phoneNumber", "customerPhone", "mobile", "whatsapp", "email"]),
  );
  const category = inferActivityCategory({
    title: item.action,
    rawAction,
    entity: item.entity,
    description: item.action,
    method: contactMethod,
  });
  const title = humanizeActivityTitle({ title: item.action, rawAction, category });
  const customerHref = customerId ? `/customers/${customerId}` : undefined;
  const taskId =
    readJsonText(metadata, ["taskId", "linkedTaskId", "sourceTaskId"])
    ?? (item.entity?.toLowerCase().includes("task") ? item.entityId ?? undefined : undefined);
  const followUpId =
    readJsonText(metadata, ["followUpId", "linkedFollowUpId", "sourceFollowUpId"])
    ?? (item.entity?.toLowerCase().includes("follow") ? item.entityId ?? undefined : undefined);
  const pipelineBadge = inferActivityPipelineBadge(
    readJsonText(metadata, ["taskTitle", "taskStep", "stage", "status", "discussionTopic", "outcome"]),
    item.action,
    rawAction,
    contactMethod,
  );

  return {
    id: item.id,
    href: customerHref ?? linkedEntityHref({ entity: item.entity, entityId: item.entityId, companyId: customerId ?? undefined }),
    title,
    detail: firstMeaningfulText(
      customerName && employeeName ? `${customerName} · ${employeeName}` : undefined,
      customerName,
      employeeName ? `By ${employeeName}` : undefined,
      item.entity,
    ) ?? "CRM activity",
    time: dateLabel(item.createdAt, "dd/MM/yyyy hh:mm a"),
    createdAtValue: item.createdAt.toISOString(),
    dateLabel: dateLabel(item.createdAt, "dd MMM yyyy"),
    timeLabel: dateLabel(item.createdAt, "hh:mm a"),
    category,
    badgeLabel: pipelineBadge ?? activityCategoryLabel(category),
    customerName: customerName ?? undefined,
    customerHref,
    employeeName,
    employeeId: item.user?.id ?? readJsonText(metadata, ["userId"]),
    entity: item.entity,
    entityId: item.entityId ?? undefined,
    rawAction,
    discussionSummary: rawAction !== title ? rawAction : undefined,
    contactMethod,
    phoneOrEmailUsed,
    createdBy: employeeName,
    relatedCustomerHref: customerHref,
    taskId,
    followUpId,
  };
}

function normalizeCityLookupKey(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .toLowerCase();
}

function inferCityFromAddress(address?: string | null) {
  if (!address) return "";
  const [lastSegment] = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(-1);
  return lastSegment ?? "";
}

function readRawField(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const found = raw[key];
    if (typeof found === "string" && found.trim()) return found.trim();
    if (typeof found === "number" || typeof found === "boolean") return String(found);
    if (found instanceof Date && !Number.isNaN(found.getTime())) return found.toISOString();
  }

  const normalized = new Map<string, unknown>();
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    normalized.set(normalizeCityLookupKey(rawKey), rawValue);
  }

  for (const key of keys) {
    const found = normalized.get(normalizeCityLookupKey(key));
    if (typeof found === "string" && found.trim()) return found.trim();
    if (typeof found === "number" || typeof found === "boolean") return String(found);
    if (found instanceof Date && !Number.isNaN(found.getTime())) return found.toISOString();
  }

  return undefined;
}

function readRawCsvField(raw: Record<string, unknown>, keys: string[]) {
  const value = readRawField(raw, keys);
  return value === undefined ? "-" : value;
}

function deriveCompanyActivity(company: ExistingCustomerRecord): {
  label: string;
  tone: "blue" | "green" | "amber" | "slate";
} | undefined {
  const pendingFollowUp = company.followUps.find((followUp) => followUp.status !== "COMPLETED");
  if (pendingFollowUp) {
    return {
      label: pendingFollowUp.status === "OVERDUE" ? "OVERDUE FOLLOW-UP" : "FOLLOW-UP",
      tone: "blue",
    };
  }

  if (company.leads.some((lead) => lead.status === "WON_SALE")) {
    return { label: "DONE", tone: "green" };
  }

  if (company.leads.some((lead) => ["CONTACTED", "INTERESTED", "FOLLOW_UP_REQUIRED", "QUOTATION_SENT", "NEGOTIATION"].includes(lead.status))) {
    return { label: "IN PROGRESS", tone: "amber" };
  }

  if (company.lastCommunication ?? company.communications[0]?.createdAt) {
    return { label: "DONE", tone: "green" };
  }

  return { label: "NEW", tone: "blue" };
}

function mapCompanyRow(company: ExistingCustomerRecord): CompanyRow {
  const primaryContact = company.contacts.find((contact) => contact.isPrimary) ?? company.contacts[0];
  const whatsapp = company.phoneNumbers.find((phone) => phone.whatsapp);
  const regular = company.phoneNumbers[0];
  const companyCity = (company as { city?: string | null }).city;
  const raw = normalizeRawJson((company as { rawData?: Prisma.Prisma.JsonValue }).rawData ?? {});
  const rawPrimaryEmail = readRawField(raw, ["Primary Email", "Email 1", "Email"]);
  const rawPrimaryPhone = readRawField(raw, ["Primary Phone", "Phone", "Phone 1", "phone"]);
  const rawPhone2 = readRawField(raw, ["Phone 2", "Contact Person 1 Phone 2", "Phone2", "Phone 2 (Contact 1)", "Secondary Phone"]);
  const rawIndustry = readRawField(raw, ["Industry"]);
  const rawCity = readRawField(raw, ["City / Zilla", "City/Zilla", "City", "Zilla"]);
  const rawAddress = readRawField(raw, ["Address"]);
  const rawCreatedBy = readRawField(raw, ["Created By", "createdBy", "Added By", "addedBy"]);
  const rawCreatedByRole = readRawField(raw, ["Created By Role", "createdByRole", "Added By Role", "addedByRole"]);
  const activity = deriveCompanyActivity(company);
  const addressCity = inferCityFromAddress(company.address);
  const emailOptions = uniqueEmails([
    primaryContact?.email,
    rawPrimaryEmail,
    readRawField(raw, ["Email 2", "Contact Person 1 Email 2"]),
    readRawField(raw, ["Contact Person 1 Email 1", "Contact Person 1 Mail", "Email 1"]),
    readRawField(raw, ["Contact Person 2 Email 1", "Contact Person 2 Mail"]),
    readRawField(raw, ["Contact Person 2 Email 2"]),
    ...company.contacts.map((contact) => contact.email),
  ]);

  return {
    id: company.id,
    name: company.name,
    activityLabel: activity?.label,
    activityTone: activity?.tone,
    contactPerson: company.contactPerson ?? primaryContact?.name ?? "-",
    email: primaryContact?.email ?? rawPrimaryEmail ?? "-",
    emailOptions,
    phone: company.phone || primaryContact?.mobile || regular?.number || rawPrimaryPhone || "-",
    phone2: rawPhone2 || (company.phoneNumbers[1]?.number ? company.phoneNumbers[1].number : "-"),
    whatsapp: primaryContact?.whatsapp ?? whatsapp?.number ?? "-",
    cityOrZilla: companyCity || rawCity || addressCity || "-",
    industry: company.industry || rawIndustry || "General",
    address: company.address ?? rawAddress ?? "-",
    website: company.website ?? "-",
    assignedToId: company.assignedToId,
    assignedTo: company.assignedTo?.name ?? "-",
    createdBy: rawCreatedBy ?? company.assignedTo?.name ?? "-",
    createdByRole: rawCreatedByRole ?? undefined,
    createdAtLabel: dateLabel(company.createdAt, "dd/MM/yyyy hh:mm a"),
    status: labelize(company.status),
    totalLeads: Math.max(company.totalLeads, company.leads.length),
    lastCommunication: dateLabel(company.lastCommunication ?? company.communications[0]?.createdAt),
    notes: company.notes ?? "-",
    rawData: (company as { rawData?: Prisma.Prisma.JsonValue }).rawData ?? {},
  };
}

function combineWhere<T extends object>(...conditions: (T | undefined)[]): T {
  const active = conditions.filter(Boolean) as T[];
  return (active.length ? { AND: active } : {}) as T;
}

function followUpScopeWhere(scopedUserIds: string[] | undefined): Prisma.Prisma.FollowUpWhereInput {
  if (!scopedUserIds) return {};

  return {
    OR: [
      { assignedToId: { in: scopedUserIds } },
      { assignedToId: null, task: { is: { assignedToId: { in: scopedUserIds } } } },
      { assignedToId: null, lead: { is: { assignedToId: { in: scopedUserIds } } } },
      { assignedToId: null, company: { is: { assignedToId: { in: scopedUserIds } } } },
    ],
  };
}

function followUpSearchWhere(search?: string): Prisma.Prisma.FollowUpWhereInput | undefined {
  const query = search?.trim();
  if (!query) return undefined;
  const text = { contains: query, mode: "insensitive" } as const;

  return {
    OR: [
      { company: { is: { name: text } } },
      { company: { is: { contacts: { some: { OR: [{ name: text }, { email: text }, { mobile: { contains: query } }, { whatsapp: { contains: query } }] } } } } },
      { company: { is: { phoneNumbers: { some: { number: { contains: query } } } } } },
      { lead: { is: { OR: [{ title: text }, { customerName: text }, { phone: { contains: query } }, { email: text }] } } },
    ],
  };
}

function dateRangeWhere(from?: Date, to?: Date): Prisma.Prisma.FollowUpWhereInput | undefined {
  if (!from && !to) return undefined;
  return {
    followUpDate: {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: to } : {}),
    },
  };
}

function parseDateStart(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEnd(value?: string) {
  const date = parseDateStart(value);
  return date ? addDays(date, 1) : undefined;
}

function productQueryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function normalizeProductEngagementQuery(query: Record<string, unknown> = {}) {
  const status = productQueryValue(query.status)?.trim() || undefined;
  const communicationType = productQueryValue(query.communicationType)?.trim() || undefined;
  const assignedUserId = productQueryValue(query.assignedUserId)?.trim() || undefined;
  return {
    from: productQueryValue(query.from) || undefined,
    to: productQueryValue(query.to) || undefined,
    status: status && status !== "all" ? status : undefined,
    communicationType: communicationType && communicationType !== "all" ? communicationType : undefined,
    assignedUserId: assignedUserId && assignedUserId !== "all" ? assignedUserId : undefined,
  };
}

function userInScope(scopedUserIds: Set<string> | undefined, userId: string | null | undefined) {
  return !scopedUserIds || Boolean(userId && scopedUserIds.has(userId));
}

function leadInScope(lead: ProductLeadRecord, scopedUserIds: Set<string> | undefined) {
  return userInScope(scopedUserIds, lead.assignedToId) || userInScope(scopedUserIds, lead.createdById);
}

function taskInScope(task: ProductTaskRecord, scopedUserIds: Set<string> | undefined) {
  return (
    userInScope(scopedUserIds, task.assignedToId) ||
    userInScope(scopedUserIds, task.lead?.assignedToId) ||
    userInScope(scopedUserIds, task.lead?.createdById) ||
    userInScope(scopedUserIds, task.company?.assignedToId)
  );
}

function followUpInScope(followUp: ProductLeadRecord["followUps"][number], scopedUserIds: Set<string> | undefined) {
  return userInScope(scopedUserIds, followUp.assignedToId);
}

function taskFollowUpInScope(followUp: ProductTaskRecord["followUps"][number], scopedUserIds: Set<string> | undefined) {
  return userInScope(scopedUserIds, followUp.assignedToId);
}

function quotationInScope(quotation: ProductQuoteRecord, scopedUserIds: Set<string> | undefined) {
  return (
    userInScope(scopedUserIds, quotation.createdById) ||
    userInScope(scopedUserIds, quotation.lead?.assignedToId) ||
    userInScope(scopedUserIds, quotation.lead?.createdById)
  );
}

function leadStatusGroup(status: string) {
  if (status === "WON_SALE") return "Won";
  if (status === "LOST_SALE") return "Lost";
  if (status === "NEGOTIATION") return "Negotiation";
  if (["INTERESTED", "FOLLOW_UP_REQUIRED", "QUOTATION_SENT"].includes(status)) return "Interested";
  return labelize(status);
}

function collectLeadCommunications(lead: ProductLeadRecord) {
  const items = new Map<string, ProductCommunicationRecord>();

  for (const communication of lead.communications) {
    items.set(communication.id, communication);
  }

  for (const communication of lead.company?.communications ?? []) {
    if (!communication.leadId || communication.leadId === lead.id) {
      items.set(communication.id, communication);
    }
  }

  return Array.from(items.values()).sort((a, b) => b.communicationAt.getTime() - a.communicationAt.getTime());
}

function communicationMatchesFilters(communication: ProductCommunicationRecord, filters: ReturnType<typeof normalizeProductEngagementQuery>) {
  const from = parseDateStart(filters.from);
  const to = parseDateEnd(filters.to);
  if (filters.communicationType && communication.method !== filters.communicationType) return false;
  if (from && communication.communicationAt < from) return false;
  if (to && communication.communicationAt >= to) return false;
  return true;
}

function communicationMethodBucket(method: string) {
  const normalized = method.trim().toLowerCase();
  if (normalized.includes("whatsapp")) return "whatsapp" as const;
  if (normalized.includes("email")) return "email" as const;
  if (normalized.includes("meeting") || normalized.includes("visit")) return "meeting" as const;
  return "call" as const;
}

function buildProductEngagement(product: ProductRecord, scopedUserIds?: string[], rawQuery?: Record<string, unknown>): ProductEngagementData {
  const filters = normalizeProductEngagementQuery(rawQuery);
  const scope = scopedUserIds ? new Set(scopedUserIds) : undefined;
  const scopedLeads = product.leads.filter((lead) => leadInScope(lead, scope));
  const scopedLeadIds = new Set(scopedLeads.map((lead) => lead.id));
  const scopedTasks = product.tasks.filter((task) => taskInScope(task, scope));
  const scopedQuoteItems = product.quoteItems.filter((item) => quotationInScope(item.quotation, scope));
  const communicationIds = new Set<string>();
  const companyIds = new Set<string>();
  const contactedCompanyIds = new Set<string>();
  const assignedUsers = new Map<string, string>();
  const communicationTypes = new Set<string>();
  const convertedLeadIds = new Set<string>();
  const pendingFollowUpIds = new Set<string>();
  const communicationMethodCounts = {
    call: 0,
    whatsapp: 0,
    email: 0,
    meeting: 0,
  };

  for (const lead of scopedLeads) {
    if (lead.companyId) companyIds.add(lead.companyId);
    if (lead.assignedToId && lead.assignedTo) assignedUsers.set(lead.assignedToId, lead.assignedTo.name);
    if (lead.status === "WON_SALE") convertedLeadIds.add(lead.id);
    for (const communication of collectLeadCommunications(lead)) {
      if (!communicationIds.has(communication.id)) {
        communicationMethodCounts[communicationMethodBucket(communication.method)] += 1;
      }
      communicationIds.add(communication.id);
      communicationTypes.add(communication.method);
      if (lead.companyId) contactedCompanyIds.add(lead.companyId);
    }
  }

  for (const interest of product.interests) {
    const linkedLeadAllowed = interest.leadId ? scopedLeadIds.has(interest.leadId) : false;
    const standaloneAllowed = !interest.leadId && (userInScope(scope, interest.userId) || userInScope(scope, interest.company?.assignedToId));
    if (!linkedLeadAllowed && !standaloneAllowed) continue;
    if (interest.companyId) companyIds.add(interest.companyId);
    if (interest.userId && interest.user) assignedUsers.set(interest.userId, interest.user.name);
    if (interest.company?.assignedToId && interest.company.assignedTo) assignedUsers.set(interest.company.assignedToId, interest.company.assignedTo.name);
    for (const communication of interest.company?.communications ?? []) {
      if (!interest.leadId && !communication.leadId) {
        if (!communicationIds.has(communication.id)) {
          communicationMethodCounts[communicationMethodBucket(communication.method)] += 1;
        }
        communicationIds.add(communication.id);
        communicationTypes.add(communication.method);
        if (interest.companyId) contactedCompanyIds.add(interest.companyId);
      }
    }
  }

  for (const task of scopedTasks) {
    const companyId = task.companyId ?? task.lead?.companyId ?? null;
    if (companyId) companyIds.add(companyId);
    if (task.assignedToId && task.assignedTo) assignedUsers.set(task.assignedToId, task.assignedTo.name);

    for (const communication of task.communications) {
      if (!communicationIds.has(communication.id)) {
        communicationMethodCounts[communicationMethodBucket(communication.method)] += 1;
      }
      communicationIds.add(communication.id);
      communicationTypes.add(communication.method);
      if (companyId) contactedCompanyIds.add(companyId);
    }

    for (const followUp of task.followUps) {
      if (taskFollowUpInScope(followUp, scope) && followUp.status !== "COMPLETED") {
        pendingFollowUpIds.add(followUp.id);
      }
    }
  }

  for (const item of scopedQuoteItems) {
    if (item.quotation.status === "CONVERTED_TO_SALE" && item.quotation.leadId && scopedLeadIds.has(item.quotation.leadId)) {
      convertedLeadIds.add(item.quotation.leadId);
    }
  }

  for (const lead of scopedLeads) {
    for (const followUp of lead.followUps) {
      if (followUpInScope(followUp, scope) && followUp.status !== "COMPLETED") {
        pendingFollowUpIds.add(followUp.id);
      }
    }
  }

  const followUpCount = pendingFollowUpIds.size;
  const quotationSentCount = new Set(
    scopedQuoteItems
      .filter((item) => item.quotation.status !== "DRAFT")
      .map((item) => item.quotation.id),
  ).size;
  const rowsWithSort = scopedLeads
    .filter((lead) => !filters.status || leadStatusGroup(lead.status) === filters.status)
    .filter((lead) => !filters.assignedUserId || lead.assignedToId === filters.assignedUserId)
    .map((lead) => {
      const communications = collectLeadCommunications(lead);
      const filteredCommunications = communications.filter((communication) => communicationMatchesFilters(communication, filters));
      const communicationFilterActive = Boolean(filters.from || filters.to || filters.communicationType);
      if (communicationFilterActive && filteredCommunications.length === 0) return undefined;

      const lastContact = filteredCommunications[0] ?? communications[0];
      const leadQuotations = new Set(scopedQuoteItems.filter((item) => item.quotation.leadId === lead.id).map((item) => item.quotation.id));

      return {
        id: `lead-${lead.id}`,
        companyId: lead.companyId,
        leadId: lead.id,
        companyName: lead.company?.name ?? lead.customerName,
        leadName: lead.title,
        communicationType: lastContact?.method ?? "-",
        summary: lastContact?.note ?? "-",
        discussionTopic: lastContact?.discussionTopic ?? lastContact?.productDiscussed ?? "-",
        nextFollowUpDate: dateLabel(lastContact?.nextFollowUpDate, "dd/MM/yyyy hh:mm a"),
        lastContactDate: dateLabel(lastContact?.communicationAt),
        status: leadStatusGroup(lead.status),
        assignedMarketer: lead.assignedTo?.name ?? "-",
        communicationCount: communications.length,
        followUpCount: lead.followUps.filter((followUp) => followUpInScope(followUp, scope)).length,
        quotationCount: leadQuotations.size,
        lastContactAt: lastContact?.communicationAt ?? new Date(0),
      };
    })
    .filter(Boolean) as (ProductEngagementRow & { lastContactAt: Date })[];

  const standaloneInterestRows = product.interests
    .filter((interest) => !interest.leadId && interest.company)
    .filter(() => !filters.status || filters.status === "Interested")
    .filter((interest) => !filters.assignedUserId || interest.userId === filters.assignedUserId || interest.company?.assignedToId === filters.assignedUserId)
    .filter((interest) => userInScope(scope, interest.userId) || userInScope(scope, interest.company?.assignedToId))
    .map((interest) => {
      const communications = (interest.company?.communications ?? []).filter((communication) => !communication.leadId);
      const filteredCommunications = communications.filter((communication) => communicationMatchesFilters(communication, filters));
      const communicationFilterActive = Boolean(filters.from || filters.to || filters.communicationType);
      if (communicationFilterActive && filteredCommunications.length === 0) return undefined;
      const lastContact = filteredCommunications[0] ?? communications[0];

      return {
        id: `interest-${interest.id}`,
        companyId: interest.companyId,
        leadId: null,
        companyName: interest.company?.name ?? "-",
        leadName: "-",
        communicationType: lastContact?.method ?? "-",
        summary: lastContact?.note ?? "-",
        discussionTopic: lastContact?.discussionTopic ?? lastContact?.productDiscussed ?? "-",
        nextFollowUpDate: dateLabel(lastContact?.nextFollowUpDate, "dd/MM/yyyy hh:mm a"),
        lastContactDate: dateLabel(lastContact?.communicationAt),
        status: "Interested",
        assignedMarketer: interest.user?.name ?? interest.company?.assignedTo?.name ?? "-",
        communicationCount: communications.length,
        followUpCount: 0,
        quotationCount: 0,
        lastContactAt: lastContact?.communicationAt ?? new Date(0),
      };
    })
    .filter(Boolean) as (ProductEngagementRow & { lastContactAt: Date })[];

  const existingRowKeys = new Set(
    [...rowsWithSort, ...standaloneInterestRows].map((item) => `${item.companyId ?? "none"}::${item.leadId ?? "none"}`),
  );
  const taskRows = scopedTasks
    .filter((task) => !filters.assignedUserId || task.assignedToId === filters.assignedUserId)
    .map((task) => {
      const companyId = task.companyId ?? task.lead?.companyId ?? null;
      const rowKey = `${companyId ?? "none"}::${task.leadId ?? "none"}`;
      if (existingRowKeys.has(rowKey)) return undefined;

      const communicationFilterActive = Boolean(filters.from || filters.to || filters.communicationType);
      const filteredCommunications = task.communications.filter((communication) => communicationMatchesFilters(communication, filters));
      if (communicationFilterActive && filteredCommunications.length === 0) return undefined;

      const visibleCommunications = communicationFilterActive ? filteredCommunications : task.communications;
      const lastContact = visibleCommunications[0];
      const visibleTaskFollowUps = task.followUps.filter((followUp) => taskFollowUpInScope(followUp, scope));
      const pendingTaskFollowUps = visibleTaskFollowUps.filter((followUp) => followUp.status !== "COMPLETED");

      return {
        id: `task-${task.id}`,
        companyId,
        leadId: task.leadId,
        companyName: task.company?.name ?? task.lead?.customerName ?? task.companyName ?? "-",
        leadName: task.lead?.title ?? "-",
        communicationType: lastContact?.method ?? "-",
        summary: lastContact?.note ?? task.notes ?? task.description ?? task.title,
        discussionTopic: lastContact?.discussionTopic ?? lastContact?.productDiscussed ?? product.name,
        nextFollowUpDate: dateLabel(lastContact?.nextFollowUpDate ?? pendingTaskFollowUps[0]?.followUpDate, "dd/MM/yyyy hh:mm a"),
        lastContactDate: dateLabel(lastContact?.communicationAt),
        status: labelize(task.status),
        assignedMarketer: task.assignedTo?.name ?? "-",
        communicationCount: task.communications.length,
        followUpCount: visibleTaskFollowUps.length,
        quotationCount: 0,
        lastContactAt: lastContact?.communicationAt ?? new Date(0),
      };
    })
    .filter(Boolean) as (ProductEngagementRow & { lastContactAt: Date })[];

  const rows = [...rowsWithSort, ...standaloneInterestRows, ...taskRows]
    .sort((a, b) => b.lastContactAt.getTime() - a.lastContactAt.getTime())
    .map((item) => ({
      id: item.id,
      companyId: item.companyId,
      leadId: item.leadId,
      companyName: item.companyName,
      leadName: item.leadName,
      communicationType: item.communicationType,
      summary: item.summary,
      discussionTopic: item.discussionTopic,
      nextFollowUpDate: item.nextFollowUpDate,
      lastContactDate: item.lastContactDate,
      status: item.status,
      assignedMarketer: item.assignedMarketer,
      communicationCount: item.communicationCount,
      followUpCount: item.followUpCount,
      quotationCount: item.quotationCount,
    }));

  return {
    summary: {
      totalCompaniesContacted: companyIds.size,
      totalLeadsInterested: scopedLeads.length,
      totalCommunicationCount: communicationIds.size,
      totalShortlistedCompanies: companyIds.size,
      contactedCompanies: contactedCompanyIds.size,
      notContactedCompanies: Math.max(companyIds.size - contactedCompanyIds.size, 0),
      totalCallCount: communicationMethodCounts.call,
      totalWhatsAppCount: communicationMethodCounts.whatsapp,
      totalEmailCount: communicationMethodCounts.email,
      totalMeetingCount: communicationMethodCounts.meeting,
      followUpCount,
      quotationSentCount,
      salesCount: convertedLeadIds.size,
      conversionRate: scopedLeads.length ? Math.round((convertedLeadIds.size / scopedLeads.length) * 100) : 0,
    },
    rows,
    filters,
    filterOptions: {
      communicationTypes: Array.from(communicationTypes).sort(),
      assignedUsers: Array.from(assignedUsers.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

function followUpSummaryWhere(baseWhere: Prisma.Prisma.FollowUpWhereInput, now = new Date()) {
  const { from: today, to: tomorrow } = getCrmDayWindow(now);
  return {
    overdue: combineWhere(baseWhere, { status: { not: "COMPLETED" }, OR: [{ status: "OVERDUE" }, { followUpDate: { lt: today } }] }),
    today: combineWhere(baseWhere, { status: { notIn: ["COMPLETED", "OVERDUE"] }, followUpDate: { gte: today, lt: tomorrow } }),
    upcoming: combineWhere(baseWhere, { status: { notIn: ["COMPLETED", "OVERDUE"] }, followUpDate: { gte: tomorrow } }),
    completed: combineWhere(baseWhere, { status: "COMPLETED" }),
  };
}

async function countFollowUpSummary(prisma: ReturnType<typeof getPrisma>, baseWhere: Prisma.Prisma.FollowUpWhereInput) {
  const where = followUpSummaryWhere(baseWhere);
  const [overdue, today, upcoming, completed] = await Promise.all([
    prisma.followUp.count({ where: where.overdue }),
    prisma.followUp.count({ where: where.today }),
    prisma.followUp.count({ where: where.upcoming }),
    prisma.followUp.count({ where: where.completed }),
  ]);

  return { overdue, today, upcoming, completed, actionable: overdue + today + upcoming };
}

function isPermissionFoundationUnavailable(error: unknown) {
  const message = String((error as { message?: string })?.message ?? "");
  const code = String((error as { code?: string })?.code ?? "");
  return (
    code === "P2021" ||
    code === "P2022" ||
    message.includes("does not exist") ||
    message.includes("no such table") ||
    message.includes("relation") && message.includes("missing")
  );
}

async function safePermissionCount(prisma: ReturnType<typeof getPrisma>) {
  try {
    return await prisma.permission.count();
  } catch (error) {
    if (isPermissionFoundationUnavailable(error)) {
      console.warn("Permission foundation unavailable during startup; defaulting permission count to 0.");
      return 0;
    }
    throw error;
  }
}

async function safeSeedPermissions(prisma: ReturnType<typeof getPrisma>) {
  const modules = [
    "DASHBOARD",
    "LEADS",
    "CUSTOMERS",
    "TASKS",
    "FOLLOW_UPS",
    "COMMUNICATIONS",
    "PRODUCTS",
    "QUOTATIONS",
    "REWARDS",
    "REPORTS",
    "TEAM",
    "USERS",
    "SETTINGS",
    "IMPORT_EXPORT",
    "NOTIFICATIONS",
  ] as const;
  const actions = ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "REASSIGN", "IMPORT", "EXPORT", "DOWNLOAD_REPORT"] as const;

  await prisma.permission.createMany({
    data: modules.flatMap((module) => actions.map((action) => ({ module, action, label: `${labelize(module)} ${labelize(action)}` }))),
    skipDuplicates: true,
  });

  const permissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: permissions.flatMap((permission) => [
      { role: "ADMIN", permissionId: permission.id, enabled: true },
      { role: "SUPERVISOR", permissionId: permission.id, enabled: !["USERS", "SETTINGS"].includes(permission.module) || permission.action === "VIEW" },
      {
        role: "MARKETER",
        permissionId: permission.id,
        enabled:
          ["DASHBOARD", "LEADS", "CUSTOMERS", "TASKS", "FOLLOW_UPS", "COMMUNICATIONS", "PRODUCTS", "QUOTATIONS", "REWARDS", "REPORTS", "NOTIFICATIONS"].includes(permission.module) &&
          !["DELETE", "REASSIGN", "IMPORT", "EXPORT", "DOWNLOAD_REPORT"].includes(permission.action),
      },
    ]),
    skipDuplicates: true,
  });
}

async function ensureCrmFoundation() {
  const prisma = getPrisma();
  const permissionCount = await safePermissionCount(prisma);

  if (permissionCount === 0) {
    try {
      await safeSeedPermissions(prisma);
    } catch (error) {
      if (!isPermissionFoundationUnavailable(error)) {
        throw error;
      }
      console.warn("Permission foundation seeding skipped because permission tables are not yet synced.");
    }
  }

  const rewardRuleCount = await prisma.rewardRule.count();
  if (rewardRuleCount === 0) {
    await prisma.rewardRule.createMany({
      data: [
        { name: "Lead Added", trigger: "LEAD_CREATED", points: 10 },
        { name: "Follow-up Completed", trigger: "FOLLOW_UP_COMPLETED", points: 20 },
        { name: "Meeting Scheduled", trigger: "MEETING_SCHEDULED", points: 15 },
        { name: "Sale Won", trigger: "WON_SALE", points: 100 },
      ],
      skipDuplicates: true,
    });
  }
}

async function getScopedUserIds(role: Role, user: ShellUser) {
  if (role === "ADMIN") return undefined;
  if (!user.id) return [];
  if (role === "MARKETER") return [user.id];

  const prisma = getPrisma();
  return getMarketerScopeUserIds(prisma, { id: user.id, role });
}

function normalizeActivitySearchText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeActivitySearchQuery(query: string) {
  return normalizeActivitySearchText(query)
    .replace(/\bfollow up\b/g, "followup")
    .replace(/\bfollow ups\b/g, "followup")
    .replace(/\bfollowup\b/g, "followup")
    .replace(/\bfollowed up\b/g, "followup")
    .replace(/\bphone call\b/g, "call")
    .replace(/\bquatation\b/g, "quotation")
    .replace(/\bquote\b/g, "quotation")
    .replace(/\bquoted\b/g, "quotation")
    .replace(/\bdemo send\b/g, "demo")
    .replace(/\bproduct demo\b/g, "demo")
    .replace(/\bdemo session\b/g, "demo")
    .replace(/\bsales won\b/g, "won")
    .replace(/\bsale won\b/g, "won")
    .replace(/\bclosed won\b/g, "won")
    .replace(/\blead converted\b/g, "won")
    .replace(/\bconverted to sale\b/g, "won")
    .replace(/\bsale completed\b/g, "won")
    .replace(/\bsales failed\b/g, "lost")
    .replace(/\bsale failed\b/g, "lost")
    .replace(/\bclosed lost\b/g, "lost")
    .replace(/\blead lost\b/g, "lost")
    .replace(/\bdeal lost\b/g, "lost");
}

function normalizePhoneSearchValue(value?: string | null) {
  return (value ?? "").replace(/\D+/g, "");
}

function normalizeActivitySearchToken(token: string) {
  const normalized = normalizeActivitySearchText(token);
  if (!normalized) return "";
  if (normalized === "phone" || normalized === "dial" || normalized === "calling") return "call";
  if (normalized === "followup" || normalized === "follow") return "followup";
  if (normalized === "quatation" || normalized === "quote" || normalized === "quoted") return "quotation";
  if (normalized === "win" || normalized === "won" || normalized === "converted") return "won";
  if (normalized === "lose" || normalized === "lost" || normalized === "failed" || normalized === "rejected") return "lost";
  return normalized;
}

function activitySearchKeywords(activity: ActivityRow) {
  const base = normalizeActivitySearchText([
    activity.title,
    activity.detail,
    activity.badgeLabel,
    activity.customerName,
    activity.employeeName,
    activity.entity,
    activity.rawAction,
    activity.discussionSummary,
    activity.notes,
    activity.contactMethod,
    activity.phoneOrEmailUsed,
    activity.quotationReference,
    activity.createdBy,
  ].filter(Boolean).join(" "));

  const keywords = new Set<string>();

  if (activity.category === "CALL" || /\b(call|phone|dial)\b/.test(base)) keywords.add("call");
  if (activity.category === "FOLLOW_UP" || /\bfollow up\b|\bfollowup\b/.test(base)) keywords.add("followup");
  if (/\bdemo\b/.test(base)) keywords.add("demo");
  if (activity.category === "QUOTATION" || /\b(quotation|quote|quatation)\b/.test(base)) keywords.add("quotation");
  if (/\b(won|win|converted)\b/.test(base) || base.includes("sale completed") || base.includes("closed won")) keywords.add("won");
  if (/\b(lost|failed|rejected)\b/.test(base) || base.includes("deal lost") || base.includes("closed lost")) keywords.add("lost");

  return `${base} ${Array.from(keywords).join(" ")}`.trim();
}

function extractCustomerIdFromHref(href?: string | null) {
  if (!href) return undefined;
  const match = href.match(/\/customers\/([^/?#]+)/i);
  return match?.[1];
}

function matchesActivityCustomerSearch(
  activity: ActivityRow,
  matchedCustomerIds: Set<string>,
  matchedCustomerNames: Set<string>,
) {
  if (!matchedCustomerIds.size && !matchedCustomerNames.size) return false;

  const customerIds = [
    extractCustomerIdFromHref(activity.customerHref),
    extractCustomerIdFromHref(activity.relatedCustomerHref),
    extractCustomerIdFromHref(activity.href),
  ].filter((value): value is string => Boolean(value));

  if (customerIds.some((customerId) => matchedCustomerIds.has(customerId))) {
    return true;
  }

  const normalizedCustomerName = normalizeActivitySearchText(activity.customerName ?? "");
  return normalizedCustomerName ? matchedCustomerNames.has(normalizedCustomerName) : false;
}

function matchesActivitySearch(activity: ActivityRow, query: string) {
  const normalizedQuery = normalizeActivitySearchQuery(query);
  if (!normalizedQuery) return true;

  const haystack = activitySearchKeywords(activity);
  const tokens = normalizedQuery
    .split(" ")
    .map(normalizeActivitySearchToken)
    .filter(Boolean);

  if (!tokens.length) return true;

  return tokens.every((token) => haystack.includes(token));
}

function buildActivityRowFromWorkItem(item: TodayWorkQueueItem | CompletedWorkItem): ActivityRow {
  const sourceCategory = item.sourceType === "FOLLOW_UP"
    ? "FOLLOW_UP"
    : inferActivityCategory({
        title: item.title,
        rawAction: item.statusKey === "COMPLETED" ? "Task Completed" : "Task Pending",
        entity: item.sourceType,
        description: [item.description, item.notes, item.method, item.productName].filter(Boolean).join(" "),
        method: item.method,
      });

  const pipelineBadge = inferActivityPipelineBadge(item.title, item.description, item.notes, item.method, item.productName);
  const primaryTime =
    item.statusKey === "COMPLETED"
      ? item.completedAtIso
      : item.taskDateIso;
  const primaryDate = new Date(primaryTime);
  const employeeName = firstMeaningfulText(item.assignedTo, item.assignedBy, item.completedBy) ?? "-";
  const taskId = item.sourceType === "TASK" ? item.sourceId : ("taskId" in item ? item.taskId ?? undefined : undefined);
  const followUpId = item.sourceType === "FOLLOW_UP" ? item.sourceId : undefined;
  const phoneOrEmailUsed = "companyPrimaryPhone" in item ? item.companyPrimaryPhone : undefined;

  return {
    id: item.id,
    href: item.companyHref ?? undefined,
    title:
      item.sourceType === "FOLLOW_UP"
        ? item.statusKey === "COMPLETED" ? "Follow-up Completed" : "Pending Follow-up"
        : item.statusKey === "COMPLETED" ? "Task Completed" : "Open Task",
    detail: firstMeaningfulText(
      item.companyName && employeeName ? `${item.companyName} · ${employeeName}` : undefined,
      item.companyName,
      employeeName !== "-" ? `By ${employeeName}` : undefined,
      item.description,
      item.notes,
    ) ?? "CRM task",
    time: dateLabel(primaryDate, "dd/MM/yyyy hh:mm a"),
    createdAtValue: primaryDate.toISOString(),
    dateLabel: dateLabel(primaryDate, "dd MMM yyyy"),
    timeLabel: dateLabel(primaryDate, "hh:mm a"),
    category: sourceCategory,
    badgeLabel: pipelineBadge ?? activityCategoryLabel(sourceCategory),
    customerName: item.companyName,
    customerHref: item.companyHref ?? undefined,
    employeeName,
    rawAction: item.title,
    discussionSummary: firstMeaningfulText(item.description, item.notes, item.method),
    notes: item.notes,
    contactMethod: item.method,
    phoneOrEmailUsed,
    createdBy: firstMeaningfulText(item.assignedBy, item.completedBy, item.assignedTo),
    relatedCustomerHref: item.companyHref ?? undefined,
    entity: item.sourceType === "FOLLOW_UP" ? "FollowUp" : "Task",
    entityId: item.sourceId,
    taskId,
    followUpId,
  };
}

function normalizeActivitySearchRowKey(activity: ActivityRow) {
  if (activity.followUpId) return `follow-up:${activity.followUpId}`;
  if (activity.taskId) return `task:${activity.taskId}`;
  if (activity.entityId) return `entity:${normalizeActivityToken(activity.entity)}:${activity.entityId}`;
  return `row:${activity.id}`;
}

type CustomerSearchRecord = Prisma.Prisma.CustomerCompanyGetPayload<{
  select: {
    id: true;
    name: true;
    createdAt: true;
    contactPerson: true;
    phone: true;
    phone2: true;
    contacts: {
      select: {
        name: true;
        mobile: true;
        whatsapp: true;
        email: true;
      };
    };
    phoneNumbers: {
      select: {
        number: true;
      };
    };
  };
}>;

function buildActivityRowFromCustomerSearch(item: CustomerSearchRecord): ActivityRow {
  const primaryContact = item.contacts[0];
  const contactBits = [
    item.contactPerson,
    primaryContact?.name,
  ].filter((value): value is string => Boolean(value && value.trim()));
  const phoneBits = [
    item.phone,
    item.phone2,
    ...item.phoneNumbers.map((phone) => phone.number),
    ...item.contacts.flatMap((contact) => [contact.mobile, contact.whatsapp]),
  ].filter((value): value is string => Boolean(value && value.trim()));
  const emailBits = item.contacts
    .map((contact) => contact.email)
    .filter((value): value is string => Boolean(value && value.trim()));

  return {
    id: `customer-search:${item.id}`,
    href: `/customers/${item.id}`,
    title: "Customer Profile",
    detail: firstMeaningfulText(
      contactBits.length ? `${item.name} - ${contactBits[0]}` : item.name,
      item.name,
    ) ?? item.name,
    time: dateLabel(item.createdAt, "dd/MM/yyyy hh:mm a"),
    createdAtValue: item.createdAt.toISOString(),
    dateLabel: dateLabel(item.createdAt, "dd MMM yyyy"),
    timeLabel: dateLabel(item.createdAt, "hh:mm a"),
    category: "OTHER",
    badgeLabel: "PROFILE",
    customerName: item.name,
    customerHref: `/customers/${item.id}`,
    discussionSummary: "Open customer profile to see full history, notes, steps, calls, and follow-ups.",
    phoneOrEmailUsed: [...phoneBits, ...emailBits].join(" "),
    relatedCustomerHref: `/customers/${item.id}`,
  };
}

export async function searchCrmActivities({
  role,
  user,
  query,
  limit = 8,
}: {
  role: Role;
  user: ShellUser;
  query: string;
  limit?: number;
}) {
  const normalizedQuery = normalizeActivitySearchQuery(query);
  if (!normalizedQuery) return [] satisfies ActivityRow[];

  const prisma = getPrisma();
  await ensureCrmFoundation();

  const scopedUserIds = await getScopedUserIds(role, user);
  const cappedLimit = Math.max(1, Math.min(limit, 24));
  const actor = { id: user.id ?? "", role, name: user.name };
  const companyWhere: Prisma.Prisma.CustomerCompanyWhereInput = await buildCustomerScopeWhere(
    prisma,
    { id: user.id ?? "", role },
  );
  const text = { contains: query.trim(), mode: "insensitive" } as const;
  const phoneQuery = query.trim();
  const normalizedPhoneQuery = normalizePhoneSearchValue(phoneQuery);
  const phoneNeedles = Array.from(new Set([
    phoneQuery,
    normalizedPhoneQuery,
    normalizedPhoneQuery.length >= 8 ? normalizedPhoneQuery.slice(-8) : "",
  ].filter(Boolean)));
  const customerSearchConditions: Prisma.Prisma.CustomerCompanyWhereInput[] = [
    { name: text },
    { contactPerson: text },
    { notes: text },
    ...phoneNeedles.map((needle) => ({ phone: { contains: needle } })),
    ...phoneNeedles.map((needle) => ({ phone2: { contains: needle } })),
    {
      contacts: {
        some: {
          OR: [
            { name: text },
            { email: text },
            ...phoneNeedles.map((needle) => ({ mobile: { contains: needle } })),
            ...phoneNeedles.map((needle) => ({ whatsapp: { contains: needle } })),
          ],
        },
      },
    },
    {
      phoneNumbers: {
        some: {
          OR: phoneNeedles.map((needle) => ({ number: { contains: needle } })),
        },
      },
    },
    {
      leads: {
        some: {
          OR: [
            { title: text },
            { customerName: text },
            { email: text },
            ...phoneNeedles.map((needle) => ({ phone: { contains: needle } })),
          ],
        },
      },
    },
  ];

  const [timeline, activities, queueItems, completedItems, matchingCustomers] = await Promise.all([
    prisma.activityTimeline.findMany({
      where: scopedUserIds ? { userId: { in: scopedUserIds } } : undefined,
      include: activityTimelineInclude,
      orderBy: { createdAt: "desc" },
      take: 280,
    }),
    prisma.activityLog.findMany({
      where: scopedUserIds ? { userId: { in: scopedUserIds } } : undefined,
      include: activityLogInclude,
      orderBy: { createdAt: "desc" },
      take: 180,
    }),
    getTodayWorkQueue(actor),
    getCompletedWorkItems(actor),
    prisma.customerCompany.findMany({
      where: combineWhere(companyWhere, { OR: customerSearchConditions }),
      select: {
        id: true,
        name: true,
        createdAt: true,
        contactPerson: true,
        phone: true,
        phone2: true,
        contacts: {
          select: {
            name: true,
            mobile: true,
            whatsapp: true,
            email: true,
          },
          take: 4,
        },
        phoneNumbers: {
          select: {
            number: true,
          },
          take: 4,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
  ]);

  const matchedCustomerIds = new Set(matchingCustomers.map((item) => item.id));
  const matchedCustomerNames = new Set(
    matchingCustomers
      .map((item) => normalizeActivitySearchText(item.name))
      .filter(Boolean),
  );

  const timelineEntityKeys = new Set(
    timeline
      .map((item) => normalizeActivityEntityKey(item.entity, item.entityId))
      .filter(Boolean),
  );

  const directRows = [...queueItems, ...completedItems]
    .map(buildActivityRowFromWorkItem)
    .filter((activity) => (
      matchesActivitySearch(activity, normalizedQuery)
      || matchesActivityCustomerSearch(activity, matchedCustomerIds, matchedCustomerNames)
    ));

  const activityRows = [
    ...timeline.map(buildActivityRowFromTimeline),
    ...activities
      .filter((item) => {
        const key = normalizeActivityEntityKey(item.entity, item.entityId);
        return !key || !timelineEntityKeys.has(key);
      })
      .map(buildActivityRowFromLog),
  ]
    .sort((left, right) => new Date(right.createdAtValue ?? 0).getTime() - new Date(left.createdAtValue ?? 0).getTime())
    .filter((activity) => (
      matchesActivitySearch(activity, normalizedQuery)
      || matchesActivityCustomerSearch(activity, matchedCustomerIds, matchedCustomerNames)
    ));

  const customerRows = matchingCustomers
    .map(buildActivityRowFromCustomerSearch)
    .filter((activity) => matchesActivitySearch(activity, normalizedQuery));

  const seen = new Set<string>();
  const merged: ActivityRow[] = [];
  for (const row of [...customerRows, ...directRows, ...activityRows]) {
    const key = normalizeActivitySearchRowKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
    if (merged.length >= cappedLimit) break;
  }

  return merged;
}

export async function getCrmWorkspace(role: Role, user: ShellUser, options?: TeamPerformanceOptions): Promise<CrmWorkspace> {
  const prisma = getPrisma();
  await ensureCrmFoundation();
  const scopedUserIds = await getScopedUserIds(role, user);
  const scopedLeadUserIds = await getScopedLeadUserIds(prisma, { id: user.id ?? "", role });
  const { from: today, to: tomorrow } = getCrmDayWindow(new Date());
  const callActivityWindow = getCrmPeriodWindow(new Date(), { period: "month" });
  const teamPerformanceWindow = role === "SUPERVISOR"
    ? getCrmPeriodWindow(new Date(), options)
    : role === "ADMIN"
      ? getCrmPeriodWindow(new Date(), options ?? { period: "today" })
      : undefined;

  const leadWhere = scopedLeadUserIds
    ? {
        OR: [
          { assignedToId: { in: scopedLeadUserIds } },
          {
            AND: [
              { assignedToId: null },
              { createdById: { in: scopedLeadUserIds } },
            ],
          },
        ],
      }
    : {};

  const companyWhere: Prisma.Prisma.CustomerCompanyWhereInput = await buildCustomerScopeWhere(
    prisma,
    { id: user.id ?? "", role },
  );

  const taskWhere: Prisma.Prisma.TaskWhereInput = scopedUserIds
    ? {
        OR: [
          { assignedToId: { in: scopedUserIds } },
          { assignedById: { in: scopedUserIds } },
        ],
      }
    : {};

  const planWhere = scopedUserIds ? { userId: { in: scopedUserIds } } : {};
  const followUpWhere = followUpScopeWhere(scopedUserIds);
  const quotationWhere = scopedUserIds
    ? {
        OR: [
          { createdById: { in: scopedUserIds } },
          { lead: { assignedToId: { in: scopedUserIds } } },
        ],
      }
    : {};
  const communicationWhere: Prisma.Prisma.CommunicationLogWhereInput = scopedUserIds ? { userId: { in: scopedUserIds } } : {};
  const dashboardCallWhere = combineWhere(communicationWhere, {
    communicationAt: { gte: callActivityWindow.from, lt: callActivityWindow.to },
    OR: [
      { method: { contains: "phone", mode: "insensitive" as const } },
      { method: { contains: "call", mode: "insensitive" as const } },
    ],
  });
  const activityWhere = scopedUserIds ? { userId: { in: scopedUserIds } } : {};
  const planWidgetWhere = (planWhere
    ? { ...planWhere, status: { not: "COMPLETED" }, plannedAt: { lt: tomorrow } }
    : { status: { not: "COMPLETED" }, plannedAt: { lt: tomorrow } }) as Prisma.Prisma.TodayPlanWhereInput;
  const todayTaskBadgeWhere = combineWhere(taskWhere, { status: { not: "COMPLETED" }, taskDate: { lt: tomorrow } });
  const followUpBadgeWhere = combineWhere(followUpWhere, {
    status: { not: "COMPLETED" },
    OR: [
      { status: { in: ["DUE", "TODAY", "OVERDUE"] } },
      { followUpDate: { lt: tomorrow } },
    ],
  });
  const rewardWhere = scopedUserIds ? { userId: { in: scopedUserIds } } : {};

  const [
    leads,
    companies,
    tasks,
    todayPlans,
    followUps,
    products,
    quotations,
    activities,
    timeline,
    notifications,
    employees,
    rewardRules,
    importLogs,
    reportLogs,
    leadCount,
    customerCount,
    todaysPlanCount,
    todayTaskBadgeCount,
    followUpBadgeCount,
    activeProductCount,
    rewardAggregate,
    permissions,
    rolePermissions,
    rewardSums,
    followUpSummaryCounts,
    todayCallCount,
    todayWhatsAppCount,
    todayEmailCount,
    totalCallCount,
    callActivityLogs,
  ] = await Promise.all([
    prisma.lead.findMany({
      where: leadWhere,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            contacts: {
              select: {
                id: true,
                name: true,
                mobile: true,
                email: true,
                isPrimary: true,
                whatsapp: true,
              },
            },
          },
        },
        interestedProduct: true,
        assignedTo: true,
        communications: true,
        followUps: true,
        quotations: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.customerCompany.findMany({
      where: companyWhere,
      select: workspaceCompanySelect,
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.task.findMany({
      where: taskWhere,
      include: taskInclude,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.todayPlan.findMany({
      where: planWhere,
      include: {
        user: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        lead: { select: { id: true, title: true, customerName: true } },
        product: { select: { id: true, name: true } },
      },
      orderBy: { plannedAt: "asc" },
      take: 200,
    }),
    prisma.followUp.findMany({
      where: followUpWhere,
      include: followUpInclude,
      orderBy: { followUpDate: "asc" },
      take: 200,
    }),
    prisma.productService.findMany({
      include: productInclude,
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.quotation.findMany({
      where: quotationWhere,
      include: { company: true, lead: true, createdBy: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.activityLog.findMany({
      where: activityWhere,
      include: activityLogInclude,
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.activityTimeline.findMany({
      where: activityWhere,
      include: activityTimelineInclude,
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.notification.findMany({
      where: scopedUserIds ? { recipientId: { in: scopedUserIds } } : {},
      include: { followUp: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      where: role === "ADMIN" ? {} : scopedUserIds ? { id: { in: scopedUserIds } } : {},
      include: {
        assignedLeads: true,
        followUps: true,
        rewards: true,
        communications: { select: { method: true } },
        tasksAssigned: { select: { status: true } },
        supervisorAssignmentsAsMarketer: { select: { supervisorId: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.rewardRule.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.importExportLog.findMany({
      where: scopedUserIds ? { requestedById: { in: scopedUserIds } } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.reportLog.findMany({
      where: scopedUserIds ? { requestedById: { in: scopedUserIds } } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.lead.count({ where: leadWhere }),
    prisma.customerCompany.count({ where: companyWhere }),
    prisma.todayPlan.count({ where: planWidgetWhere }),
    prisma.task.count({ where: todayTaskBadgeWhere }),
    prisma.followUp.count({ where: followUpBadgeWhere }),
    prisma.productService.count({ where: { status: "ACTIVE" } }),
    prisma.reward.aggregate({ where: rewardWhere, _sum: { points: true } }),
    (async () => {
      try {
        return await prisma.permission.findMany({ orderBy: [{ module: "asc" }, { action: "asc" }] });
      } catch (error) {
        if (isPermissionFoundationUnavailable(error)) {
          console.warn("Permission data unavailable during dashboard load; defaulting to no permissions.");
          return [];
        }
        throw error;
      }
    })(),
    (async () => {
      try {
        return await prisma.rolePermission.findMany({ where: { role }, include: { permission: true } });
      } catch (error) {
        if (isPermissionFoundationUnavailable(error)) {
          console.warn("Role permission data unavailable during dashboard load; defaulting to empty permission grants.");
          return [];
        }
        throw error;
      }
    })(),
    prisma.reward.groupBy({ by: ["userId"], _sum: { points: true } }),
    countFollowUpSummary(prisma, followUpWhere),
    prisma.communicationLog.count({
      where: combineWhere(communicationWhere, {
        communicationAt: { gte: today, lt: tomorrow },
        OR: [
          { method: { contains: "phone", mode: "insensitive" as const } },
          { method: { contains: "call", mode: "insensitive" as const } },
        ],
      }),
    }),
    prisma.communicationLog.count({
      where: combineWhere(communicationWhere, {
        communicationAt: { gte: today, lt: tomorrow },
        method: { contains: "whatsapp", mode: "insensitive" as const },
      }),
    }),
    prisma.communicationLog.count({
      where: combineWhere(communicationWhere, {
        communicationAt: { gte: today, lt: tomorrow },
        method: { contains: "email", mode: "insensitive" as const },
      }),
    }),
    prisma.communicationLog.count({
      where: combineWhere(communicationWhere, {
        OR: [
          { method: { contains: "phone", mode: "insensitive" as const } },
          { method: { contains: "call", mode: "insensitive" as const } },
        ],
      }),
    }),
    prisma.communicationLog.findMany({
      where: dashboardCallWhere,
      include: communicationHistoryInclude,
      orderBy: { communicationAt: "desc" },
      take: role === "ADMIN" ? 320 : 240,
    }),
  ]);

  const rewardByUser = new Map(rewardSums.map((item) => [item.userId, item._sum.points ?? 0]));

  const leadRows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    companyId: lead.companyId,
    title: lead.title || lead.customerName,
    customerName: lead.customerName,
    company: lead.company?.name ?? lead.customerName,
    phone: primaryLeadContact(lead.phone),
    phones: splitLeadContacts(lead.phone),
    email: primaryLeadContact(lead.email),
    emails: splitLeadContacts(lead.email),
    productInterestId: lead.productInterestId,
    productInterest: lead.interestedProduct?.name ?? "-",
    status: leadStatusLabels[lead.status] ?? labelize(lead.status),
    score: lead.score,
    priority: labelize(lead.priority),
    assignedToId: lead.assignedToId,
    assignedTo: lead.assignedTo?.name ?? "-",
    followUpDate: dateLabel(lead.followUpDate),
    followUpDateValue: lead.followUpDate?.toISOString() ?? "",
    purchaseProbability: lead.purchaseProbability,
    communicationCount: lead.communications.length,
    followUpCount: lead.followUps.length,
    salesProgress: progressFromLead(lead.status),
    notes: lead.notes ?? "-",
    createdAt: dateLabel(lead.createdAt, "dd/MM/yyyy hh:mm a"),
  }));

  const companyRows: CompanyRow[] = companies.map(mapCompanyRow);

  const taskRows: TaskRow[] = tasks.map(mapTaskRow);

  const planRows: TodayPlanRow[] = todayPlans.map((plan) => {
    const completed = plan.status === "COMPLETED";
    const previous = isBeforeCrmDay(plan.plannedAt, new Date()) && !completed;

    return {
      id: plan.id,
      companyId: plan.companyId,
      leadId: plan.leadId,
      href: linkedEntityHref({ leadId: plan.leadId, companyId: plan.companyId }),
      title: plan.title,
      relatedTo: plan.company?.name ?? plan.lead?.title ?? plan.product?.name ?? "-",
      time: dateLabel(plan.plannedAt, "hh:mm a"),
      priority: labelize(plan.priority),
      status: plan.status,
      note: plan.note ?? "-",
      section: completed ? "completed" : previous || plan.carryForward ? "previous" : "today",
    };
  });

  const followUpRows: FollowUpRow[] = followUps.map(mapFollowUpRow);
  const todayWorkQueue = user.id
    ? await getTodayWorkQueue({ id: user.id, role, name: user.name })
    : [];
  const todayWorkItems: TodayWorkItem[] = todayWorkQueue.map((item) => ({
    id: item.id,
    sourceId: item.sourceId,
    source: item.sourceType === "FOLLOW_UP" ? "Follow-up" : "Task",
    queueType: item.queueType,
    queueLabel: item.queueLabel,
    companyId: item.companyId,
    leadId: item.leadId,
    assignedToId: item.assignedToId,
    href: item.companyHref ?? (item.leadId ? `/leads/${item.leadId}` : undefined),
    title: item.title,
    method: item.method,
    relatedTo: item.companyName,
    date: item.taskDateLabel,
    dateTimeValue: item.taskDateIso,
    time: item.timeLabel,
    priority: item.priority,
    status: item.queueLabel,
    note: item.description,
    assignedTo: item.assignedTo,
    overdue: item.isOverdue,
  }));

  const quotationRows: QuotationRow[] = quotations.map((quotation) => ({
    id: quotation.id,
    companyId: quotation.companyId,
    leadId: quotation.leadId,
    quoteNumber: quotation.quoteNumber,
    customer: quotation.company?.name ?? quotation.lead?.customerName ?? "-",
    product: quotation.items[0]?.description ?? "-",
    amount: Number(quotation.totalAmount),
    status: labelize(quotation.status),
    createdBy: quotation.createdBy?.name ?? "-",
    date: dateLabel(quotation.createdAt),
  }));

  const productMetrics = products.map((product) => ({ product, engagement: buildProductEngagement(product, scopedUserIds) }));
  const productCompanyContactSummary = buildProductCompanyContactSummary(products, scopedUserIds);
  const productRows: ProductRow[] = productMetrics.map(({ product, engagement }) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    brand: product.brand ?? "-",
    price: Number(product.price),
    imageUrl: product.imageUrl ?? "",
    description: product.description ?? "-",
    specification: product.specification ?? "-",
    status: labelize(product.status),
    interestedCustomers: engagement.summary.totalCompaniesContacted,
    communicationCount: engagement.summary.totalCommunicationCount,
    followUpCount: engagement.summary.followUpCount,
    quotationCount: engagement.summary.quotationSentCount,
    salesCount: engagement.summary.salesCount,
    conversionRate: engagement.summary.conversionRate,
    assignedCount: engagement.filterOptions.assignedUsers.length,
    assignedMarketers: engagement.filterOptions.assignedUsers.map((user) => user.name),
    targetCompanies: engagement.summary.totalShortlistedCompanies,
    contactedCompanies: engagement.summary.contactedCompanies,
    remainingCompanies: Math.max(engagement.summary.totalShortlistedCompanies - engagement.summary.contactedCompanies, 0),
  }));
  const productIntelligenceItems: ProductIntelligenceItem[] = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    communicationCount: product.communicationCount,
    followUpCount: product.followUpCount,
    leadCount: product.interestedCustomers,
    quotationCount: product.quotationCount,
    salesCount: product.salesCount,
    conversionRate: product.conversionRate,
    engagementScore: product.communicationCount + product.followUpCount + product.quotationCount + product.interestedCustomers,
  }));
  const productIntelligence = {
    topEngaged: [...productIntelligenceItems].sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 5),
    highestConversion: [...productIntelligenceItems].filter((item) => item.leadCount > 0).sort((a, b) => b.conversionRate - a.conversionRate || b.salesCount - a.salesCount).slice(0, 5),
    mostDiscussed: [...productIntelligenceItems].sort((a, b) => b.communicationCount - a.communicationCount).slice(0, 5),
  };
  const timelineEntityKeys = new Set(
    timeline
      .map((item) => normalizeActivityEntityKey(item.entity, item.entityId))
      .filter(Boolean),
  );
  const mergedActivities: ActivityRow[] = [
    ...timeline.map(buildActivityRowFromTimeline),
    ...activities
      .filter((item) => {
        const key = normalizeActivityEntityKey(item.entity, item.entityId);
        return !key || !timelineEntityKeys.has(key);
      })
      .map(buildActivityRowFromLog),
  ]
    .sort((left, right) => new Date(right.createdAtValue ?? 0).getTime() - new Date(left.createdAtValue ?? 0).getTime())
    .slice(0, 120);
  const callActivities = callActivityLogs.map(buildCallActivityRowFromCommunication);

  const notificationRows: NotificationRow[] = notifications.map((item) => ({
    id: item.id,
    href: linkedEntityHref({ entity: item.entity, entityId: item.entityId, leadId: item.followUp?.leadId, companyId: item.followUp?.companyId }),
    title: item.title,
    message: item.message,
    type: labelize(item.type),
    time: dateLabel(item.createdAt, "dd/MM/yyyy hh:mm a"),
    read: Boolean(item.readAt),
  }));

  const employeeRows: EmployeeRow[] = employees.map((employee) => {
    const won = employee.assignedLeads.filter((lead) => lead.status === "WON_SALE").length;
    const total = employee.assignedLeads.length;
    const calls = employee.communications.filter((log) => containsAnyMethod(log.method, ["phone", "call"])).length;
    const whatsapp = employee.communications.filter((log) => containsAnyMethod(log.method, ["whatsapp"])).length;
    const emails = employee.communications.filter((log) => containsAnyMethod(log.method, ["email", "gmail"])).length;
    const meetings = employee.communications.filter((log) => containsAnyMethod(log.method, ["meeting"])).length;
    const pendingTasks = employee.tasksAssigned.filter((task) => task.status !== "COMPLETED").length;
    const overdueFollowUps = employee.followUps.filter((followUp) => followUp.status !== "COMPLETED" && followUp.followUpDate < today).length;
    const supervisorIds = Array.from(
      new Set([
        ...(employee.supervisorAssignmentsAsMarketer?.map((assignment) => assignment.supervisorId) ?? []),
        ...(employee.supervisorId ? [employee.supervisorId] : []),
      ]),
    );

    return {
      id: employee.id,
      name: employee.name,
      email: employee.email ?? "-",
      mobile: employee.mobile.startsWith("email:") ? "-" : employee.mobile,
      role: labelize(employee.role),
      roleKey: employee.role,
      status: labelize(employee.status),
      statusKey: employee.status,
      designation: employee.designation ?? "-",
      supervisorId: employee.supervisorId ?? null,
      supervisorIds,
      leads: total,
      calls,
      whatsapp,
      emails,
      meetings,
      followUps: employee.followUps.length,
      pendingTasks,
      overdueFollowUps,
      sales: won,
      rewardPoints: rewardByUser.get(employee.id) ?? employee.rewards.reduce((sum, reward) => sum + reward.points, 0),
      conversionRate: total ? `${Math.round((won / total) * 100)}%` : "0%",
    };
  });

  let teamPerformanceRows: EmployeeRow[] | undefined;
  if ((role === "SUPERVISOR" || role === "ADMIN") && teamPerformanceWindow) {
    const performanceMembers =
      role === "SUPERVISOR"
        ? employeeRows.filter((item) => item.role === "Marketer")
        : employeeRows.filter((item) => item.statusKey === "ACTIVE");
    const memberIds = performanceMembers.map((employee) => employee.id);
    const followUpOverdueTo = isBefore(teamPerformanceWindow.to, today) ? teamPerformanceWindow.to : today;
    const performanceRangeFrom = teamPerformanceWindow.from;
    const performanceRangeTo = teamPerformanceWindow.to;

    if (memberIds.length > 0) {
      const [
        leadStats,
        wonLeadStats,
        communicationMethodStats,
        followUpStats,
        overdueFollowUpStats,
        taskStats,
      ] = await Promise.all([
        prisma.lead.groupBy({
          by: ["assignedToId"],
          where: {
            assignedToId: { in: memberIds },
            createdAt: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
        prisma.lead.groupBy({
          by: ["assignedToId"],
          where: {
            assignedToId: { in: memberIds },
            status: "WON_SALE",
            updatedAt: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
        prisma.communicationLog.groupBy({
          by: ["userId", "method"],
          where: {
            userId: { in: memberIds },
            communicationAt: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
        prisma.followUp.groupBy({
          by: ["assignedToId"],
          where: {
            assignedToId: { in: memberIds },
            followUpDate: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
        followUpOverdueTo > performanceRangeFrom
          ? prisma.followUp.groupBy({
            by: ["assignedToId"],
            where: {
              assignedToId: { in: memberIds },
              status: { not: "COMPLETED" },
              followUpDate: { gte: performanceRangeFrom, lt: followUpOverdueTo },
            },
            _count: { _all: true },
          })
          : Promise.resolve([] as Array<Prisma.Prisma.FollowUpGroupByOutputType>),
        prisma.task.groupBy({
          by: ["assignedToId"],
          where: {
            assignedToId: { in: memberIds },
            status: { not: "COMPLETED" },
            dueDate: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
      ]);

      const leadCounts = new Map<string, number>();
      for (const row of leadStats) {
        if (row.assignedToId) {
          leadCounts.set(row.assignedToId, row._count._all);
        }
      }
      const wonLeadCounts = new Map<string, number>();
      for (const row of wonLeadStats) {
        if (row.assignedToId) {
          wonLeadCounts.set(row.assignedToId, row._count._all);
        }
      }
      const taskCounts = new Map<string, number>();
      for (const row of taskStats) {
        if (row.assignedToId) {
          taskCounts.set(row.assignedToId, row._count._all);
        }
      }
      const followUpCounts = new Map<string, number>();
      for (const row of followUpStats) {
        if (row.assignedToId) {
          followUpCounts.set(row.assignedToId, row._count._all);
        }
      }
      const overdueFollowUpCounts = new Map<string, number>();
      for (const row of overdueFollowUpStats) {
        if (row.assignedToId) {
          overdueFollowUpCounts.set(row.assignedToId, row._count?._all ?? 0);
        }
      }
      const communicationChannels = new Map<
        string,
        { calls: number; whatsapp: number; emails: number; meetings: number }
      >();
      for (const row of communicationMethodStats) {
        if (!row.userId) continue;
        const current = communicationChannels.get(row.userId) ?? { calls: 0, whatsapp: 0, emails: 0, meetings: 0 };
        if (containsAnyMethod(row.method, ["phone", "call"])) current.calls += row._count._all;
        if (containsAnyMethod(row.method, ["whatsapp"])) current.whatsapp += row._count._all;
        if (containsAnyMethod(row.method, ["email", "gmail"])) current.emails += row._count._all;
        if (containsAnyMethod(row.method, ["meeting"])) current.meetings += row._count._all;
        communicationChannels.set(row.userId, current);
      }
      teamPerformanceRows = performanceMembers.map((row) => {
        const leadCount = leadCounts.get(row.id) ?? 0;
        const wonCount = wonLeadCounts.get(row.id) ?? 0;
        const channels = communicationChannels.get(row.id) ?? { calls: 0, whatsapp: 0, emails: 0, meetings: 0 };
        const followUpCount = followUpCounts.get(row.id) ?? 0;

        return {
          ...row,
          leads: leadCount,
          calls: channels.calls,
          whatsapp: channels.whatsapp,
          emails: channels.emails,
          meetings: channels.meetings,
          followUps: followUpCount,
          pendingTasks: taskCounts.get(row.id) ?? 0,
          overdueFollowUps: overdueFollowUpCounts.get(row.id) ?? 0,
          sales: wonCount,
          conversionRate: leadCount ? `${Math.round((wonCount / leadCount) * 100)}%` : "0%",
        };
      });
    }
  }

  const pipeline = Object.values(leadStatusLabels).map((label) => ({
    label,
    value: leadRows.filter((lead) => lead.status === label).length,
    color: pipelineColors[label] ?? "bg-slate-400",
  }));

  const followUpSummary = followUpSummaryCounts;

  const teamPerformance = teamPerformanceRows
    ? {
        rows: teamPerformanceRows,
        period: teamPerformanceWindow?.period ?? "month",
        from: formatCrmDate(teamPerformanceWindow?.from ?? today, "yyyy-MM-dd"),
        to: formatCrmDate(new Date((teamPerformanceWindow?.to ?? tomorrow).getTime() - 1), "yyyy-MM-dd"),
      }
    : undefined;

  const pendingTasks = taskRows.filter((task) => task.status !== "COMPLETED").length;
  const wonSales = leadRows.filter((lead) => lead.status === "Won Sale").length;
  const conversion = leadRows.length ? Math.round((wonSales / leadRows.length) * 100) : 0;
  const totalRevenue = quotationRows.reduce((sum, quotation) => sum + quotation.amount, 0);
  const rewardPoints = role === "MARKETER" && user.id ? rewardByUser.get(user.id) ?? 0 : employeeRows.reduce((sum, row) => sum + row.rewardPoints, 0);
  const includesMeeting = (...values: (string | null | undefined)[]) => values.some((value) => value?.toLowerCase().includes("meeting"));
  const meetingsToday =
    followUps.filter((followUp) => followUp.status !== "COMPLETED" && isSameCrmDay(followUp.followUpDate, today) && includesMeeting(followUp.method, followUp.note, followUp.nextDiscussionPlan)).length +
    tasks.filter((task) => task.status !== "COMPLETED" && task.dueDate && isSameCrmDay(task.dueDate, today) && includesMeeting(task.title, task.description, task.notes)).length +
    todayPlans.filter((plan) => plan.status !== "COMPLETED" && isSameCrmDay(plan.plannedAt, today) && includesMeeting(plan.title, plan.note)).length;
  const communicationCenterSummary = {
    todayCalls: todayCallCount,
    todayWhatsApp: todayWhatsAppCount,
    todayEmails: todayEmailCount,
    todayMeetings: meetingsToday,
    todayFollowUps: followUpSummary.today,
    totalCalls: totalCallCount,
  };

  const stats =
    role === "MARKETER"
      ? [
          { title: "Today's Tasks", value: String(todayWorkItems.length), helper: "Unified work queue", tone: "bg-blue-100 text-blue-700" },
          { title: "Pending Tasks", value: String(pendingTasks), helper: "Need completion", tone: "bg-red-100 text-red-700" },
          { title: "Follow-ups Due", value: String(followUpSummary.overdue + followUpSummary.today), helper: "Overdue and today", tone: "bg-indigo-100 text-indigo-700" },
          { title: "New Leads", value: String(leadRows.filter((lead) => lead.status === "New Lead").length), helper: "Assigned leads", tone: "bg-emerald-100 text-emerald-700" },
          { title: "Meetings Today", value: String(meetingsToday), helper: "Scheduled meetings", tone: "bg-orange-100 text-orange-700" },
          { title: "Reward Points", value: String(rewardPoints), helper: "This month", tone: "bg-amber-100 text-amber-700" },
        ]
      : role === "SUPERVISOR"
        ? [
            { title: "Total Marketers", value: String(employeeRows.filter((row) => row.role === "Marketer").length), helper: "Under supervision", tone: "bg-blue-100 text-blue-700" },
            { title: "Total Leads", value: String(leadRows.length), helper: "Team pipeline", tone: "bg-indigo-100 text-indigo-700" },
            { title: "Follow-up Due", value: String(followUpSummary.today), helper: "Due today", tone: "bg-amber-100 text-amber-700" },
            { title: "Overdue Follow-ups", value: String(followUpSummary.overdue), helper: "Needs attention", tone: "bg-red-100 text-red-700" },
            { title: "Sales This Month", value: money(totalRevenue), helper: "Quotation value", tone: "bg-emerald-100 text-emerald-700" },
            { title: "Conversion Rate", value: `${conversion}%`, helper: "Won vs leads", tone: "bg-violet-100 text-violet-700" },
          ]
        : [
            { title: "Total Users", value: String(employeeRows.length), helper: "System users", tone: "bg-blue-100 text-blue-700" },
            { title: "Total Customers", value: String(companyRows.length), helper: "Active companies", tone: "bg-emerald-100 text-emerald-700" },
            { title: "Total Leads", value: String(leadRows.length), helper: "All pipeline", tone: "bg-indigo-100 text-indigo-700" },
            { title: "Revenue", value: money(totalRevenue), helper: "Quotation value", tone: "bg-amber-100 text-amber-700" },
            { title: "Lead Conversion", value: `${conversion}%`, helper: "Won vs leads", tone: "bg-violet-100 text-violet-700" },
            { title: "Reward Points", value: String(rewardPoints), helper: "Distributed", tone: "bg-red-100 text-red-700" },
          ];

  const rolePermissionIds = new Set(rolePermissions.filter((item) => item.enabled).map((item) => item.permissionId));
  const permissionRows = Array.from(new Set(permissions.map((item) => item.module))).map((module) => ({
    module: labelize(module),
    permissions: permissions
      .filter((permission) => permission.module === module)
      .reduce<Record<string, boolean>>((acc, permission) => {
        acc[labelize(permission.action)] = rolePermissionIds.has(permission.id);
        return acc;
      }, {}),
  }));

  return {
    user,
    unreadCount: notificationRows.filter((item) => !item.read).length,
    stats,
    teamPerformance,
    leads: leadRows,
    companies: companyRows,
    tasks: taskRows,
    todayPlans: planRows,
    todayWorkItems,
    followUps: followUpRows,
    products: productRows,
    quotations: quotationRows,
    activities: mergedActivities,
    callActivities,
    notifications: notificationRows,
    employees: employeeRows,
    rewardRules: rewardRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      trigger: rule.trigger,
      points: rule.points,
      active: rule.active,
      createdAt: dateLabel(rule.createdAt),
    })),
    importExportLogs: importLogs.map((item) => ({
      id: item.id,
      type: labelize(item.type),
      module: labelize(item.module),
      format: labelize(item.format),
      fileName: item.fileName ?? "-",
      status: labelize(item.status),
      processedRows: item.processedRows,
      failedRows: item.failedRows,
      createdAt: dateLabel(item.createdAt),
    })),
    reportLogs: reportLogs.map((item) => ({
      id: item.id,
      type: "Export",
      module: labelize(item.reportType),
      format: labelize(item.format),
      fileName: item.fileUrl ?? "-",
      status: labelize(item.status),
      processedRows: 0,
      failedRows: 0,
      createdAt: dateLabel(item.createdAt),
    })),
    permissions: permissionRows,
    pipeline,
    productOpportunities: [...productRows].sort((a, b) => b.interestedCustomers - a.interestedCustomers).slice(0, 8),
    productIntelligence,
    productCompanyContactSummary,
    systemSummary: [
      { label: "Active Users", value: String(employeeRows.filter((row) => row.status === "Active").length) },
      { label: "Open Tasks", value: String(pendingTasks) },
      { label: "Unread Notifications", value: String(notificationRows.filter((item) => !item.read).length) },
      { label: "Report Logs", value: String(reportLogs.length) },
    ],
    communicationCenterSummary,
    followUpSummary,
    sidebarCounts: {
      followUps: role === "MARKETER" ? followUpSummary.today : followUpSummary.actionable,
      leads: leadCount,
      customers: customerCount,
      tasks: todayWorkItems.length,
      todaysPlan: todaysPlanCount + todayTaskBadgeCount + followUpBadgeCount,
      products: activeProductCount,
      rewards: rewardAggregate._sum.points ?? 0,
    },
  };
}

export async function getDashboardWorkspace(role: Role, user: ShellUser, options?: TeamPerformanceOptions): Promise<CrmWorkspace> {
  if (role === "ADMIN") {
    return getCrmWorkspace(role, user, options);
  }

  const prisma = getPrisma();
  await ensureCrmFoundation();
  const scopedUserIds = await getScopedUserIds(role, user);
  const scopedLeadUserIds = await getScopedLeadUserIds(prisma, { id: user.id ?? "", role });
  const { from: today, to: tomorrow } = getCrmDayWindow(new Date());
  const callActivityWindow = getCrmPeriodWindow(new Date(), { period: "month" });
  const teamPerformanceWindow = role === "SUPERVISOR" ? getCrmPeriodWindow(new Date(), options) : undefined;
  const isSupervisor = role === "SUPERVISOR";

  const leadWhere = scopedLeadUserIds
    ? {
        OR: [
          { assignedToId: { in: scopedLeadUserIds } },
          {
            AND: [
              { assignedToId: null },
              { createdById: { in: scopedLeadUserIds } },
            ],
          },
        ],
      }
    : {};

  const companyWhere: Prisma.Prisma.CustomerCompanyWhereInput = await buildCustomerScopeWhere(
    prisma,
    { id: user.id ?? "", role },
  );

  const taskWhere: Prisma.Prisma.TaskWhereInput = scopedUserIds
    ? {
        OR: [
          { assignedToId: { in: scopedUserIds } },
          { assignedById: { in: scopedUserIds } },
        ],
      }
    : {};

  const planWhere = scopedUserIds ? { userId: { in: scopedUserIds } } : {};
  const followUpWhere = followUpScopeWhere(scopedUserIds);
  const quotationWhere = scopedUserIds
    ? {
        OR: [
          { createdById: { in: scopedUserIds } },
          { lead: { assignedToId: { in: scopedUserIds } } },
        ],
      }
    : {};
  const communicationWhere: Prisma.Prisma.CommunicationLogWhereInput = scopedUserIds ? { userId: { in: scopedUserIds } } : {};
  const dashboardCallWhere = combineWhere(communicationWhere, {
    communicationAt: { gte: callActivityWindow.from, lt: callActivityWindow.to },
    OR: [
      { method: { contains: "phone", mode: "insensitive" as const } },
      { method: { contains: "call", mode: "insensitive" as const } },
    ],
  });
  const activityWhere = scopedUserIds ? { userId: { in: scopedUserIds } } : {};
  const planWidgetWhere = (planWhere
    ? { ...planWhere, status: { not: "COMPLETED" }, plannedAt: { lt: tomorrow } }
    : { status: { not: "COMPLETED" }, plannedAt: { lt: tomorrow } }) as Prisma.Prisma.TodayPlanWhereInput;
  const todayTaskBadgeWhere = combineWhere(taskWhere, { status: { not: "COMPLETED" }, taskDate: { lt: tomorrow } });
  const followUpBadgeWhere = combineWhere(followUpWhere, {
    status: { not: "COMPLETED" },
    OR: [
      { status: { in: ["DUE", "TODAY", "OVERDUE"] } },
      { followUpDate: { lt: tomorrow } },
    ],
  });
  const rewardWhere = scopedUserIds ? { userId: { in: scopedUserIds } } : {};

  const meetingTaskWhere: Prisma.Prisma.TaskWhereInput = combineWhere(taskWhere, {
    status: { not: "COMPLETED" },
    dueDate: { gte: today, lt: tomorrow },
    OR: [
      { title: { contains: "meeting", mode: "insensitive" as const } },
      { description: { contains: "meeting", mode: "insensitive" as const } },
      { notes: { contains: "meeting", mode: "insensitive" as const } },
    ],
  });
  const meetingFollowUpWhere: Prisma.Prisma.FollowUpWhereInput = combineWhere(followUpWhere, {
    status: { not: "COMPLETED" },
    followUpDate: { gte: today, lt: tomorrow },
    OR: [
      { method: { contains: "meeting", mode: "insensitive" as const } },
      { note: { contains: "meeting", mode: "insensitive" as const } },
      { nextDiscussionPlan: { contains: "meeting", mode: "insensitive" as const } },
    ],
  });
  const meetingPlanWhere = (planWhere
    ? {
      ...planWhere,
      status: { not: "COMPLETED" },
      plannedAt: { gte: today, lt: tomorrow },
      OR: [
        { title: { contains: "meeting", mode: "insensitive" as const } },
        { note: { contains: "meeting", mode: "insensitive" as const } },
      ],
    }
    : {
      status: { not: "COMPLETED" },
      plannedAt: { gte: today, lt: tomorrow },
      OR: [
        { title: { contains: "meeting", mode: "insensitive" as const } },
        { note: { contains: "meeting", mode: "insensitive" as const } },
      ],
    }) as Prisma.Prisma.TodayPlanWhereInput;

  const [
    leadRecords,
    companyRecords,
    followUpRecords,
    todayQueueRows,
    productRecords,
    quotationRecords,
    activityLogs,
    activityTimeline,
    employeeRecords,
    leadCount,
    customerCount,
    todaysPlanCount,
    todayTaskBadgeCount,
    followUpBadgeCount,
    activeProductCount,
    rewardAggregate,
    rewardSums,
    followUpSummaryCounts,
    todayCallCount,
    todayWhatsAppCount,
    todayEmailCount,
    totalCallCount,
    callActivityLogs,
    unreadCount,
    pendingTaskCount,
    meetingTaskCount,
    meetingFollowUpCount,
    meetingPlanCount,
    quotationRevenue,
  ] = await Promise.all([
    prisma.lead.findMany({
      where: leadWhere,
      select: dashboardLeadSelect,
      orderBy: { updatedAt: "desc" },
      take: isSupervisor ? 160 : 80,
    }),
    isSupervisor
      ? prisma.customerCompany.findMany({
        where: companyWhere,
        select: dashboardCompanySelect,
        orderBy: { updatedAt: "desc" },
        take: 80,
      })
      : Promise.resolve([] as Array<Record<string, unknown>>),
    isSupervisor
      ? prisma.followUp.findMany({
        where: followUpWhere,
        include: followUpInclude,
        orderBy: { followUpDate: "asc" },
        take: 60,
      })
      : Promise.resolve([] as Array<Record<string, unknown>>),
    user.id
      ? getTodayWorkQueue({ id: user.id, role, name: user.name })
      : Promise.resolve([]),
    isSupervisor
      ? prisma.productService.findMany({
        include: productInclude,
        orderBy: { updatedAt: "desc" },
        take: 80,
      })
      : prisma.productService.findMany({
        select: dashboardProductSelect,
        orderBy: { updatedAt: "desc" },
        take: 120,
      }),
    isSupervisor
      ? prisma.quotation.findMany({
        where: quotationWhere,
        select: dashboardQuotationSelect,
        orderBy: { createdAt: "desc" },
        take: 24,
      })
      : Promise.resolve([] as Array<Record<string, unknown>>),
    prisma.activityLog.findMany({
      where: activityWhere,
      include: activityLogInclude,
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.activityTimeline.findMany({
      where: activityWhere,
      include: activityTimelineInclude,
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.user.findMany({
      where: scopedUserIds ? { id: { in: scopedUserIds } } : {},
      select: dashboardEmployeeSelect,
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.lead.count({ where: leadWhere }),
    prisma.customerCompany.count({ where: companyWhere }),
    prisma.todayPlan.count({ where: planWidgetWhere }),
    prisma.task.count({ where: todayTaskBadgeWhere }),
    prisma.followUp.count({ where: followUpBadgeWhere }),
    prisma.productService.count({ where: { status: "ACTIVE" } }),
    prisma.reward.aggregate({ where: rewardWhere, _sum: { points: true } }),
    prisma.reward.groupBy({ by: ["userId"], _sum: { points: true } }),
    countFollowUpSummary(prisma, followUpWhere),
    prisma.communicationLog.count({
      where: combineWhere(communicationWhere, {
        communicationAt: { gte: today, lt: tomorrow },
        OR: [
          { method: { contains: "phone", mode: "insensitive" as const } },
          { method: { contains: "call", mode: "insensitive" as const } },
        ],
      }),
    }),
    prisma.communicationLog.count({
      where: combineWhere(communicationWhere, {
        communicationAt: { gte: today, lt: tomorrow },
        method: { contains: "whatsapp", mode: "insensitive" as const },
      }),
    }),
    prisma.communicationLog.count({
      where: combineWhere(communicationWhere, {
        communicationAt: { gte: today, lt: tomorrow },
        method: { contains: "email", mode: "insensitive" as const },
      }),
    }),
    prisma.communicationLog.count({
      where: combineWhere(communicationWhere, {
        OR: [
          { method: { contains: "phone", mode: "insensitive" as const } },
          { method: { contains: "call", mode: "insensitive" as const } },
        ],
      }),
    }),
    prisma.communicationLog.findMany({
      where: dashboardCallWhere,
      include: communicationHistoryInclude,
      orderBy: { communicationAt: "desc" },
      take: 240,
    }),
    prisma.notification.count({ where: scopedUserIds ? { recipientId: { in: scopedUserIds }, readAt: null } : { readAt: null } }),
    role === "MARKETER"
      ? prisma.task.count({
        where: combineWhere(taskWhere, { status: { not: "COMPLETED" } }),
      })
      : Promise.resolve(0),
    prisma.task.count({ where: meetingTaskWhere }),
    prisma.followUp.count({ where: meetingFollowUpWhere }),
    prisma.todayPlan.count({ where: meetingPlanWhere }),
    isSupervisor
      ? prisma.quotation.aggregate({
        where: quotationWhere,
        _sum: { totalAmount: true },
      })
      : Promise.resolve({ _sum: { totalAmount: 0 } }),
  ]);

  const rewardByUser = new Map(rewardSums.map((item) => [item.userId, item._sum.points ?? 0]));

  const leadRows: LeadRow[] = (leadRecords as Array<Record<string, any>>).map((lead) => ({
    id: lead.id,
    companyId: lead.companyId,
    title: lead.title || lead.customerName,
    customerName: lead.customerName,
    company: lead.company?.name ?? lead.customerName,
    phone: primaryLeadContact(lead.phone),
    phones: splitLeadContacts(lead.phone),
    email: primaryLeadContact(lead.email),
    emails: splitLeadContacts(lead.email),
    productInterestId: lead.productInterestId,
    productInterest: lead.interestedProduct?.name ?? "-",
    status: leadStatusLabels[lead.status] ?? labelize(lead.status),
    score: lead.score,
    priority: labelize(lead.priority),
    assignedToId: lead.assignedToId,
    assignedTo: lead.assignedTo?.name ?? "-",
    followUpDate: dateLabel(lead.followUpDate),
    followUpDateValue: lead.followUpDate?.toISOString() ?? "",
    purchaseProbability: lead.purchaseProbability,
    communicationCount: lead._count?.communications ?? 0,
    followUpCount: lead._count?.followUps ?? 0,
    salesProgress: progressFromLead(lead.status),
    notes: lead.notes ?? "-",
    createdAt: dateLabel(lead.createdAt, "dd/MM/yyyy hh:mm a"),
  }));

  const companyRows: CompanyRow[] = (companyRecords as Array<Record<string, any>>).map((company) => ({
    id: String(company.id),
    name: String(company.name ?? "-"),
    contactPerson: typeof company.contactPerson === "string" && company.contactPerson.trim() ? company.contactPerson : "-",
    email: "-",
    emailOptions: [],
    phone: typeof company.phone === "string" && company.phone.trim() ? company.phone : "-",
    phone2: "-",
    whatsapp: "-",
    cityOrZilla: typeof company.city === "string" && company.city.trim() ? company.city : "-",
    industry: "-",
    address: typeof company.address === "string" && company.address.trim() ? company.address : "-",
    website: typeof company.website === "string" && company.website.trim() ? company.website : "-",
    assignedToId: (company.assignedToId as string | null | undefined) ?? null,
    assignedTo: company.assignedTo?.name ?? "-",
    createdBy: "-",
    createdByRole: "-",
    createdAtLabel: company.createdAt ? dateLabel(company.createdAt as Date, "dd/MM/yyyy hh:mm a") : "-",
    status: labelize(company.status as string | null | undefined),
    totalLeads: 0,
    lastCommunication: "-",
    notes: "-",
    rawData: {},
  }));

  const followUpRows: FollowUpRow[] = isSupervisor
    ? (followUpRecords as FollowUpRecord[]).map(mapFollowUpRow)
    : [];

  const quotationRows: QuotationRow[] = (quotationRecords as Array<Record<string, any>>).map((quotation) => ({
    id: String(quotation.id),
    companyId: (quotation.companyId as string | null | undefined) ?? null,
    leadId: (quotation.leadId as string | null | undefined) ?? null,
    quoteNumber: String(quotation.quoteNumber ?? "-"),
    customer: quotation.company?.name ?? quotation.lead?.customerName ?? "-",
    product: quotation.items?.[0]?.description ?? "-",
    amount: Number(quotation.totalAmount ?? 0),
    status: labelize(quotation.status as string | null | undefined),
    createdBy: quotation.createdBy?.name ?? "-",
    date: dateLabel(quotation.createdAt as Date | null | undefined),
  }));

  const productRows: ProductRow[] = isSupervisor
    ? (productRecords as ProductRecord[]).map((product) => ({ product, engagement: buildProductEngagement(product, scopedUserIds) }))
      .map(({ product, engagement }) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        brand: product.brand ?? "-",
        price: Number(product.price),
        imageUrl: product.imageUrl ?? "",
        description: product.description ?? "-",
        specification: product.specification ?? "-",
        status: labelize(product.status),
        interestedCustomers: engagement.summary.totalCompaniesContacted,
        communicationCount: engagement.summary.totalCommunicationCount,
        followUpCount: engagement.summary.followUpCount,
        quotationCount: engagement.summary.quotationSentCount,
        salesCount: engagement.summary.salesCount,
        conversionRate: engagement.summary.conversionRate,
        assignedCount: engagement.filterOptions.assignedUsers.length,
        assignedMarketers: engagement.filterOptions.assignedUsers.map((member) => member.name),
        targetCompanies: engagement.summary.totalShortlistedCompanies,
        contactedCompanies: engagement.summary.contactedCompanies,
        remainingCompanies: Math.max(engagement.summary.totalShortlistedCompanies - engagement.summary.contactedCompanies, 0),
      }))
    : (productRecords as Array<Record<string, any>>).map((product) => ({
      id: String(product.id),
      name: String(product.name ?? "-"),
      category: String(product.category ?? "-"),
      brand: typeof product.brand === "string" && product.brand.trim() ? product.brand : "-",
      price: Number(product.price ?? 0),
      imageUrl: typeof product.imageUrl === "string" ? product.imageUrl : "",
      description: typeof product.description === "string" && product.description.trim() ? product.description : "-",
      specification: typeof product.specification === "string" && product.specification.trim() ? product.specification : "-",
      status: labelize(product.status as string | null | undefined),
      interestedCustomers: 0,
      communicationCount: 0,
      followUpCount: 0,
      quotationCount: 0,
      salesCount: 0,
      conversionRate: 0,
      assignedCount: 0,
      assignedMarketers: [],
      targetCompanies: 0,
      contactedCompanies: 0,
      remainingCompanies: 0,
    }));

  const productIntelligenceItems: ProductIntelligenceItem[] = productRows.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    communicationCount: product.communicationCount,
    followUpCount: product.followUpCount,
    leadCount: product.interestedCustomers,
    quotationCount: product.quotationCount,
    salesCount: product.salesCount,
    conversionRate: product.conversionRate,
    engagementScore: product.communicationCount + product.followUpCount + product.quotationCount + product.interestedCustomers,
  }));
  const productIntelligence = {
    topEngaged: [...productIntelligenceItems].sort((left, right) => right.engagementScore - left.engagementScore).slice(0, 5),
    highestConversion: [...productIntelligenceItems].filter((item) => item.leadCount > 0).sort((left, right) => right.conversionRate - left.conversionRate || right.salesCount - left.salesCount).slice(0, 5),
    mostDiscussed: [...productIntelligenceItems].sort((left, right) => right.communicationCount - left.communicationCount).slice(0, 5),
  };

  const timelineEntityKeys = new Set(
    activityTimeline
      .map((item) => normalizeActivityEntityKey(item.entity, item.entityId))
      .filter(Boolean),
  );
  const mergedActivities: ActivityRow[] = [
    ...activityTimeline.map(buildActivityRowFromTimeline),
    ...activityLogs
      .filter((item) => {
        const key = normalizeActivityEntityKey(item.entity, item.entityId);
        return !key || !timelineEntityKeys.has(key);
      })
      .map(buildActivityRowFromLog),
  ]
    .sort((left, right) => new Date(right.createdAtValue ?? 0).getTime() - new Date(left.createdAtValue ?? 0).getTime())
    .slice(0, 60);
  const callActivities = callActivityLogs.map(buildCallActivityRowFromCommunication);

  const employeeRows: EmployeeRow[] = (employeeRecords as Array<Record<string, any>>).map((employee) => {
    const mobile = typeof employee.mobile === "string" ? employee.mobile : "";
    const supervisorIds = Array.from(
      new Set([
        ...(Array.isArray(employee.supervisorAssignmentsAsMarketer)
          ? employee.supervisorAssignmentsAsMarketer
            .map((assignment: any) => typeof assignment?.supervisorId === "string" ? assignment.supervisorId : "")
            .filter(Boolean)
          : []),
        ...(typeof employee.supervisorId === "string" && employee.supervisorId.trim() ? [employee.supervisorId] : []),
      ]),
    );
    return {
      id: String(employee.id),
      name: String(employee.name ?? "-"),
      email: typeof employee.email === "string" && employee.email.trim() ? employee.email : "-",
      mobile: mobile.startsWith("email:") ? "-" : (mobile || "-"),
      role: labelize(employee.role as string | null | undefined),
      roleKey: employee.role as Role,
      status: labelize(employee.status as string | null | undefined),
      statusKey: employee.status as "ACTIVE" | "INACTIVE",
      designation: typeof employee.designation === "string" && employee.designation.trim() ? employee.designation : "-",
      supervisorId: (employee.supervisorId as string | null | undefined) ?? null,
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
      rewardPoints: rewardByUser.get(String(employee.id)) ?? 0,
      conversionRate: "0%",
    };
  });

  let teamPerformanceRows: EmployeeRow[] | undefined;
  if (isSupervisor && teamPerformanceWindow) {
    const performanceMembers = employeeRows.filter((item) => item.role === "Marketer");
    const memberIds = performanceMembers.map((employee) => employee.id);
    const followUpOverdueTo = isBefore(teamPerformanceWindow.to, today) ? teamPerformanceWindow.to : today;
    const performanceRangeFrom = teamPerformanceWindow.from;
    const performanceRangeTo = teamPerformanceWindow.to;

    if (memberIds.length) {
      const [
        leadStats,
        wonLeadStats,
        communicationMethodStats,
        followUpStats,
        overdueFollowUpStats,
        taskStats,
      ] = await Promise.all([
        prisma.lead.groupBy({
          by: ["assignedToId"],
          where: {
            assignedToId: { in: memberIds },
            updatedAt: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
        prisma.lead.groupBy({
          by: ["assignedToId"],
          where: {
            assignedToId: { in: memberIds },
            status: "WON_SALE",
            updatedAt: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
        prisma.communicationLog.groupBy({
          by: ["userId", "method"],
          where: {
            userId: { in: memberIds },
            communicationAt: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
        prisma.followUp.groupBy({
          by: ["assignedToId"],
          where: {
            assignedToId: { in: memberIds },
            followUpDate: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
        followUpOverdueTo > performanceRangeFrom
          ? prisma.followUp.groupBy({
            by: ["assignedToId"],
            where: {
              assignedToId: { in: memberIds },
              status: { not: "COMPLETED" },
              followUpDate: { gte: performanceRangeFrom, lt: followUpOverdueTo },
            },
            _count: { _all: true },
          })
          : Promise.resolve([] as Array<Prisma.Prisma.FollowUpGroupByOutputType>),
        prisma.task.groupBy({
          by: ["assignedToId"],
          where: {
            assignedToId: { in: memberIds },
            status: { not: "COMPLETED" },
            dueDate: { gte: performanceRangeFrom, lt: performanceRangeTo },
          },
          _count: { _all: true },
        }),
      ]);

      const leadCounts = new Map<string, number>();
      for (const row of leadStats) {
        if (row.assignedToId) leadCounts.set(row.assignedToId, row._count._all);
      }
      const wonLeadCounts = new Map<string, number>();
      for (const row of wonLeadStats) {
        if (row.assignedToId) wonLeadCounts.set(row.assignedToId, row._count._all);
      }
      const taskCounts = new Map<string, number>();
      for (const row of taskStats) {
        if (row.assignedToId) taskCounts.set(row.assignedToId, row._count._all);
      }
      const followUpCounts = new Map<string, number>();
      for (const row of followUpStats) {
        if (row.assignedToId) followUpCounts.set(row.assignedToId, row._count._all);
      }
      const overdueFollowUpCounts = new Map<string, number>();
      for (const row of overdueFollowUpStats) {
        if (row.assignedToId) overdueFollowUpCounts.set(row.assignedToId, row._count?._all ?? 0);
      }
      const communicationChannels = new Map<string, { calls: number; whatsapp: number; emails: number; meetings: number }>();
      for (const row of communicationMethodStats) {
        if (!row.userId) continue;
        const current = communicationChannels.get(row.userId) ?? { calls: 0, whatsapp: 0, emails: 0, meetings: 0 };
        if (containsAnyMethod(row.method, ["phone", "call"])) current.calls += row._count._all;
        if (containsAnyMethod(row.method, ["whatsapp"])) current.whatsapp += row._count._all;
        if (containsAnyMethod(row.method, ["email", "gmail"])) current.emails += row._count._all;
        if (containsAnyMethod(row.method, ["meeting"])) current.meetings += row._count._all;
        communicationChannels.set(row.userId, current);
      }
      teamPerformanceRows = performanceMembers.map((row) => {
        const leadTotal = leadCounts.get(row.id) ?? 0;
        const wonCount = wonLeadCounts.get(row.id) ?? 0;
        const channels = communicationChannels.get(row.id) ?? { calls: 0, whatsapp: 0, emails: 0, meetings: 0 };
        const followUpCount = followUpCounts.get(row.id) ?? 0;

        return {
          ...row,
          leads: leadTotal,
          calls: channels.calls,
          whatsapp: channels.whatsapp,
          emails: channels.emails,
          meetings: channels.meetings,
          followUps: followUpCount,
          pendingTasks: taskCounts.get(row.id) ?? 0,
          overdueFollowUps: overdueFollowUpCounts.get(row.id) ?? 0,
          sales: wonCount,
          conversionRate: leadTotal ? `${Math.round((wonCount / leadTotal) * 100)}%` : "0%",
          rewardPoints: rewardByUser.get(row.id) ?? row.rewardPoints,
        };
      });
    }
  }

  const pipeline = Object.values(leadStatusLabels).map((label) => ({
    label,
    value: leadRows.filter((lead) => lead.status === label).length,
    color: pipelineColors[label] ?? "bg-slate-400",
  }));

  const followUpSummary = followUpSummaryCounts;
  const teamPerformance = teamPerformanceRows
    ? {
      rows: teamPerformanceRows,
      period: teamPerformanceWindow?.period ?? "month",
      from: formatCrmDate(teamPerformanceWindow?.from ?? today, "yyyy-MM-dd"),
      to: formatCrmDate(new Date((teamPerformanceWindow?.to ?? tomorrow).getTime() - 1), "yyyy-MM-dd"),
    }
    : undefined;

  const activeTodayWorkCount = todayQueueRows.length;
  const unifiedTodayWorkCount = todayTaskBadgeCount + followUpBadgeCount;
  const pendingTasks = role === "MARKETER" ? pendingTaskCount : todayTaskBadgeCount;
  const wonSales = leadRows.filter((lead) => lead.status === "Won Sale").length;
  const conversion = leadRows.length ? Math.round((wonSales / leadRows.length) * 100) : 0;
  const totalRevenue = Number(quotationRevenue._sum.totalAmount ?? 0);
  const rewardPoints = role === "MARKETER" && user.id ? rewardByUser.get(user.id) ?? 0 : employeeRows.reduce((sum, row) => sum + row.rewardPoints, 0);
  const meetingsToday = meetingTaskCount + meetingFollowUpCount + meetingPlanCount;
  const communicationCenterSummary = {
    todayCalls: todayCallCount,
    todayWhatsApp: todayWhatsAppCount,
    todayEmails: todayEmailCount,
    todayMeetings: meetingsToday,
    todayFollowUps: followUpSummary.today,
    totalCalls: totalCallCount,
  };

  const stats =
    role === "MARKETER"
      ? [
        { title: "Today's Tasks", value: String(activeTodayWorkCount), helper: "Unified work queue", tone: "bg-blue-100 text-blue-700" },
        { title: "Pending Tasks", value: String(pendingTasks), helper: "Need completion", tone: "bg-red-100 text-red-700" },
        { title: "Follow-ups Due", value: String(followUpSummary.overdue + followUpSummary.today), helper: "Overdue and today", tone: "bg-indigo-100 text-indigo-700" },
        { title: "New Leads", value: String(leadRows.filter((lead) => lead.status === "New Lead").length), helper: "Assigned leads", tone: "bg-emerald-100 text-emerald-700" },
        { title: "Meetings Today", value: String(meetingsToday), helper: "Scheduled meetings", tone: "bg-orange-100 text-orange-700" },
        { title: "Reward Points", value: String(rewardPoints), helper: "This month", tone: "bg-amber-100 text-amber-700" },
      ]
      : [
        { title: "Total Marketers", value: String(employeeRows.filter((row) => row.role === "Marketer").length), helper: "Under supervision", tone: "bg-blue-100 text-blue-700" },
        { title: "Total Leads", value: String(leadCount), helper: "Team pipeline", tone: "bg-indigo-100 text-indigo-700" },
        { title: "Follow-up Due", value: String(followUpSummary.today), helper: "Due today", tone: "bg-amber-100 text-amber-700" },
        { title: "Overdue Follow-ups", value: String(followUpSummary.overdue), helper: "Needs attention", tone: "bg-red-100 text-red-700" },
        { title: "Sales This Month", value: money(totalRevenue), helper: "Quotation value", tone: "bg-emerald-100 text-emerald-700" },
        { title: "Conversion Rate", value: `${conversion}%`, helper: "Won vs leads", tone: "bg-violet-100 text-violet-700" },
      ];

  const productCompanyContactSummary = isSupervisor
    ? buildProductCompanyContactSummary(productRecords as ProductRecord[], scopedUserIds)
    : {
      totalTargetCompanies: 0,
      contactedCompanies: 0,
      remainingCompanies: 0,
    };

  return {
    user,
    unreadCount,
    stats,
    teamPerformance,
    leads: leadRows,
    companies: companyRows,
    tasks: [],
    todayPlans: [],
    todayWorkItems: [],
    followUps: followUpRows,
    products: productRows,
    quotations: quotationRows,
    activities: mergedActivities,
    callActivities,
    notifications: [],
    employees: employeeRows,
    rewardRules: [],
    importExportLogs: [],
    reportLogs: [],
    permissions: [],
    pipeline,
    productOpportunities: [...productRows].sort((left, right) => right.interestedCustomers - left.interestedCustomers).slice(0, 8),
    productIntelligence,
    productCompanyContactSummary,
    systemSummary: [
      { label: "Active Users", value: String(employeeRows.filter((row) => row.status === "Active").length) },
      { label: "Open Tasks", value: String(pendingTasks) },
      { label: "Unread Notifications", value: String(unreadCount) },
      { label: "Report Logs", value: "0" },
    ],
    communicationCenterSummary,
    followUpSummary,
    sidebarCounts: {
      followUps: role === "MARKETER" ? followUpSummary.today : followUpSummary.actionable,
      leads: leadCount,
      customers: customerCount,
      tasks: activeTodayWorkCount,
      todaysPlan: todaysPlanCount + unifiedTodayWorkCount,
      products: activeProductCount,
      rewards: rewardAggregate._sum.points ?? 0,
    },
  };
}

const followUpDateFilters: FollowUpDateFilter[] = ["all", "today", "tomorrow", "week", "month", "custom", "overdue", "completed"];

function queryValue(value: unknown) {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function containsAnyMethod(value: string | null | undefined, needles: string[]) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  return needles.some((needle) => normalized.includes(needle));
}

function inferTaskMethod(...values: (string | null | undefined)[]) {
  if (values.some((value) => containsAnyMethod(value, ["whatsapp"]))) return "WhatsApp";
  if (values.some((value) => containsAnyMethod(value, ["meeting"]))) return "Meeting";
  if (values.some((value) => containsAnyMethod(value, ["phone", "call"]))) return "Phone Call";
  return "Task";
}

function normalizeFollowUpQuery(query: FollowUpQuery | Record<string, unknown> = {}) {
  const rawDateFilter = queryValue(query.dateFilter);
  const dateFilter = rawDateFilter && followUpDateFilters.includes(rawDateFilter as FollowUpDateFilter) ? rawDateFilter as FollowUpDateFilter : "all";
  const page = Math.max(1, Number(queryValue(query.page)) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(queryValue(query.pageSize)) || 10));
  const search = queryValue(query.search)?.trim() || undefined;

  return {
    search,
    dateFilter,
    from: queryValue(query.from) || undefined,
    to: queryValue(query.to) || undefined,
    page,
    pageSize,
  };
}

function followUpSections(baseWhere: Prisma.Prisma.FollowUpWhereInput, query: ReturnType<typeof normalizeFollowUpQuery>) {
  const { from: today, to: tomorrow } = getCrmDayWindow(new Date());
  const weekWindow = getCrmPeriodWindow(new Date(), { period: "week" });
  const monthWindow = getCrmPeriodWindow(new Date(), { period: "month" });
  const commonOrder: Prisma.Prisma.FollowUpOrderByWithRelationInput[] = [{ followUpDate: "asc" }, { createdAt: "desc" }];
  const completedOrder: Prisma.Prisma.FollowUpOrderByWithRelationInput[] = [{ completedAt: "desc" }, { followUpDate: "desc" }];
  const pending = { status: { not: "COMPLETED" } } satisfies Prisma.Prisma.FollowUpWhereInput;

  if (query.dateFilter === "today") {
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(today, tomorrow)), orderBy: commonOrder }];
  }

  if (query.dateFilter === "tomorrow") {
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(tomorrow, addDays(tomorrow, 1))), orderBy: commonOrder }];
  }

  if (query.dateFilter === "week") {
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(weekWindow.from, weekWindow.to)), orderBy: commonOrder }];
  }

  if (query.dateFilter === "month") {
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(monthWindow.from, monthWindow.to)), orderBy: commonOrder }];
  }

  if (query.dateFilter === "custom") {
    return [{ where: combineWhere(baseWhere, pending, dateRangeWhere(parseDateStart(query.from), parseDateEnd(query.to))), orderBy: commonOrder }];
  }

  if (query.dateFilter === "overdue") {
    return [{ where: combineWhere(baseWhere, pending, { OR: [{ status: "OVERDUE" }, { followUpDate: { lt: today } }] }), orderBy: commonOrder }];
  }

  if (query.dateFilter === "completed") {
    return [{ where: combineWhere(baseWhere, { status: "COMPLETED" }), orderBy: completedOrder }];
  }

  return [
    { where: combineWhere(baseWhere, pending, { OR: [{ status: "OVERDUE" }, { followUpDate: { lt: today } }] }), orderBy: commonOrder },
    { where: combineWhere(baseWhere, { status: { notIn: ["COMPLETED", "OVERDUE"] } }, dateRangeWhere(today, tomorrow)), orderBy: commonOrder },
    { where: combineWhere(baseWhere, { status: { notIn: ["COMPLETED", "OVERDUE"] } }, { followUpDate: { gte: tomorrow } }), orderBy: commonOrder },
    { where: combineWhere(baseWhere, { status: "COMPLETED" }), orderBy: completedOrder },
  ];
}

export async function getFollowUpPageData(role: Role, user: ShellUser, query?: FollowUpQuery | Record<string, unknown>): Promise<FollowUpPageData> {
  const prisma = getPrisma();
  await ensureCrmFoundation();
  const normalized = normalizeFollowUpQuery(query);
  const scopedUserIds = await getScopedUserIds(role, user);
  const scopedWhere = followUpScopeWhere(scopedUserIds);
  const listWhere = combineWhere(scopedWhere, followUpSearchWhere(normalized.search));
  const sections = followUpSections(listWhere, normalized);
  const sectionCounts = await Promise.all(sections.map((section) => prisma.followUp.count({ where: section.where })));
  const total = sectionCounts.reduce((sum, count) => sum + count, 0);
  const rows: FollowUpRow[] = [];
  let offset = (normalized.page - 1) * normalized.pageSize;
  let remaining = normalized.pageSize;

  for (let index = 0; index < sections.length && remaining > 0; index += 1) {
    const count = sectionCounts[index] ?? 0;
    if (offset >= count) {
      offset -= count;
      continue;
    }

    const records = await prisma.followUp.findMany({
      where: sections[index].where,
      include: followUpInclude,
      orderBy: sections[index].orderBy,
      skip: offset,
      take: remaining,
    });

    rows.push(...records.map(mapFollowUpRow));
    remaining -= records.length;
    offset = 0;
  }

  return {
    rows,
    total,
    page: normalized.page,
    pageSize: normalized.pageSize,
    totalPages: Math.max(1, Math.ceil(total / normalized.pageSize)),
    filters: {
      search: normalized.search,
      dateFilter: normalized.dateFilter,
      from: normalized.from,
      to: normalized.to,
    },
    summary: await countFollowUpSummary(prisma, scopedWhere),
  };
}

export async function getLeadDetail(id: string, role: Role, user: ShellUser) {
  const prisma = getPrisma();
  const workspace = await getCrmWorkspace(role, user);
  const scopedUserIds = await getScopedUserIds(role, user);
  const lookup = decodeURIComponent(id);
  const lookupSlug = slugify(lookup);
  const scopedLead = workspace.leads.find((item) => item.id === lookup || slugify(item.title) === lookupSlug || slugify(item.customerName) === lookupSlug);
  const allowedLeadIds = new Set(workspace.leads.map((item) => item.id));
  const record = scopedLead
    ? await prisma.lead.findFirst({
        where: { id: scopedLead.id },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              contacts: {
                select: {
                  id: true,
                  name: true,
                  mobile: true,
                  email: true,
                  isPrimary: true,
                  whatsapp: true,
                },
              },
            },
          },
          interestedProduct: true,
          assignedTo: true,
          communications: scopedUserIds ? { where: { userId: { in: scopedUserIds } } } : true,
          followUps: scopedUserIds ? { where: { assignedToId: { in: scopedUserIds } } } : true,
          quotations: scopedUserIds
            ? {
                where: {
                  OR: [
                    { createdById: { in: scopedUserIds } },
                    { lead: { assignedToId: { in: scopedUserIds } } },
                  ],
                },
              }
            : true,
        },
      })
    : await prisma.lead.findFirst({
    where: {
      OR: [
        { id: lookup },
        { title: { equals: lookup, mode: "insensitive" } },
        { customerName: { equals: lookup, mode: "insensitive" } },
      ],
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          contacts: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true,
              isPrimary: true,
              whatsapp: true,
            },
          },
        },
      },
      interestedProduct: true,
      assignedTo: true,
      communications: scopedUserIds ? { where: { userId: { in: scopedUserIds } } } : true,
      followUps: scopedUserIds ? { where: { assignedToId: { in: scopedUserIds } } } : true,
      quotations: scopedUserIds
        ? {
            where: {
              OR: [
                { createdById: { in: scopedUserIds } },
                { lead: { assignedToId: { in: scopedUserIds } } },
              ],
            },
          }
        : true,
    },
  });
  const lead = record && allowedLeadIds.has(record.id) ? {
    id: record.id,
    companyId: record.companyId,
    title: record.title || record.customerName,
    customerName: record.customerName,
    company: record.company?.name ?? record.customerName,
    phone: primaryLeadContact(record.phone),
    phones: splitLeadContacts(record.phone),
    email: primaryLeadContact(record.email),
    emails: splitLeadContacts(record.email),
    productInterestId: record.productInterestId,
    productInterest: record.interestedProduct?.name ?? "-",
    status: leadStatusLabels[record.status] ?? labelize(record.status),
    score: record.score,
    priority: labelize(record.priority),
    assignedToId: record.assignedToId,
    assignedTo: record.assignedTo?.name ?? "-",
    followUpDate: dateLabel(record.followUpDate),
    followUpDateValue: record.followUpDate?.toISOString() ?? "",
    purchaseProbability: record.purchaseProbability,
    communicationCount: record.communications.length,
    followUpCount: record.followUps.length,
    salesProgress: progressFromLead(record.status),
    notes: record.notes ?? "-",
    createdAt: dateLabel(record.createdAt, "dd/MM/yyyy hh:mm a"),
  } satisfies LeadRow : scopedLead;
  return {
    workspace,
    lead,
    company: lead?.companyId ? workspace.companies.find((item) => item.id === lead.companyId) : undefined,
  };
}

export async function getCustomerQuickContext(id: string, role: Role, user: ShellUser) {
  const prisma = getPrisma();
  const scopedUserIds = await getScopedUserIds(role, user);
  const companyWhere: Prisma.Prisma.CustomerCompanyWhereInput = await buildCustomerScopeWhere(
    prisma,
    { id: user.id ?? "", role },
  );

  const record = await prisma.customerCompany.findFirst({
    where: combineWhere(companyWhere, { id }),
    select: workspaceCompanySelect,
  });

  if (!record) {
    return {
      customer: undefined,
      history: {
        tasks: [],
        followUps: [],
        activities: [],
        communications: [],
      } satisfies CustomerHistory,
      journey: buildCustomerJourneyTimeline({
        customer: undefined,
        tasks: [],
        followUps: [],
        communications: [],
        activities: [],
        leads: [],
        quotations: [],
      }),
      counts: {
        tasks: 0,
        followUps: 0,
        communications: 0,
      },
    };
  }

  const customer = mapCompanyRow(record);
  const customerTaskWhere = combineWhere(
    scopedUserIds
      ? {
          OR: [
            { assignedToId: { in: scopedUserIds } },
            { assignedById: { in: scopedUserIds } },
          ],
        }
      : undefined,
    {
      OR: [
        { companyId: customer.id },
        { companyName: { equals: customer.name, mode: "insensitive" as const } },
      ],
    },
  );
  const customerFollowUpWhere = combineWhere(
    scopedUserIds ? { assignedToId: { in: scopedUserIds } } : undefined,
    { companyId: customer.id },
  );
  const customerCommunicationWhere = combineWhere(
    scopedUserIds ? { userId: { in: scopedUserIds } } : undefined,
    { companyId: customer.id },
  );
  const customerTimelineWhere = combineWhere(
    scopedUserIds ? { userId: { in: scopedUserIds } } : undefined,
    { companyId: customer.id },
  );
  const customerLeadWhere = combineWhere(
    scopedUserIds
      ? {
          OR: [
            { assignedToId: { in: scopedUserIds } },
            { createdById: { in: scopedUserIds } },
          ],
        }
      : undefined,
    {
      OR: [
        { companyId: customer.id },
        { customerName: { equals: customer.name, mode: "insensitive" as const } },
      ],
    },
  );
  const customerQuotationWhere = combineWhere(
    scopedUserIds
      ? {
          OR: [
            { createdById: { in: scopedUserIds } },
            { lead: { assignedToId: { in: scopedUserIds } } },
            { lead: { createdById: { in: scopedUserIds } } },
          ],
        }
      : undefined,
    {
      OR: [
        { companyId: customer.id },
        { lead: { companyId: customer.id } },
      ],
    },
  );

  const [
    tasks,
    followUps,
    communications,
    timeline,
    leads,
    quotations,
    taskCount,
    followUpCount,
    communicationCount,
  ] = await Promise.all([
    prisma.task.findMany({
      where: customerTaskWhere,
      include: taskInclude,
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.followUp.findMany({
      where: customerFollowUpWhere,
      include: followUpInclude,
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.communicationLog.findMany({
      where: customerCommunicationWhere,
      include: communicationHistoryInclude,
      orderBy: { communicationAt: "desc" },
      take: 6,
    }),
    prisma.activityTimeline.findMany({
      where: customerTimelineWhere,
      include: activityTimelineInclude,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.lead.findMany({
      where: customerLeadWhere,
      select: customerJourneyLeadSelect,
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.quotation.findMany({
      where: customerQuotationWhere,
      select: customerJourneyQuotationSelect,
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.task.count({ where: customerTaskWhere }),
    prisma.followUp.count({ where: customerFollowUpWhere }),
    prisma.communicationLog.count({ where: customerCommunicationWhere }),
  ]);

  const history = {
    tasks: tasks.map(mapTaskRow),
    followUps: followUps.map(mapFollowUpRow),
    communications: communications.map(mapCommunicationHistoryRow),
    activities: timeline.map(buildActivityRowFromTimeline),
  } satisfies CustomerHistory;

  const journey = buildCustomerJourneyTimeline({
    customer: {
      assignedTo: customer.assignedTo,
    },
    tasks: tasks.map((task) => ({
      title: task.title,
      description: task.description,
      notes: task.notes,
      priority: task.priority,
      status: task.status,
      assignedTo: task.assignedTo?.name,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      taskDate: task.taskTime ?? task.dueDate ?? task.createdAt,
    })),
    followUps: followUps.map((followUp) => ({
      method: followUp.method,
      note: followUp.note,
      nextDiscussionPlan: followUp.nextDiscussionPlan,
      status: followUp.status,
      priority: followUp.priority,
      assignedTo: followUp.assignedTo?.name,
      createdAt: followUp.createdAt,
      updatedAt: followUp.updatedAt,
      completedAt: followUp.completedAt,
      followUpDate: followUp.followUpDate,
    })),
    communications: communications.map((communication) => ({
      method: communication.method,
      note: communication.note,
      discussionTopic: communication.discussionTopic,
      productDiscussed: communication.productDiscussed,
      outcome: communication.outcome,
      followUpNote: communication.followUpNote,
      createdBy: communication.user?.name,
      createdAt: communication.createdAt,
      communicationAt: communication.communicationAt,
      nextFollowUpDate: communication.nextFollowUpDate,
    })),
    activities: timeline.map((item) => ({
      title: item.title,
      description: item.description,
      entity: item.entity,
      createdAt: item.createdAt,
    })),
    leads: leads.map((lead) => ({
      title: lead.title,
      notes: lead.notes,
      status: lead.status,
      priority: lead.priority,
      assignedTo: lead.assignedTo?.name,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      followUpDate: lead.followUpDate,
    })),
    quotations: quotations.map((quotation) => ({
      quoteNumber: quotation.quoteNumber,
      notes: quotation.notes,
      status: quotation.status,
      createdBy: quotation.createdBy?.name,
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
    })),
  });

  return {
    customer,
    history,
    journey,
    counts: {
      tasks: taskCount,
      followUps: followUpCount,
      communications: communicationCount,
    },
  };
}

export async function getCustomerDetail(id: string, role: Role, user: ShellUser) {
  const prisma = getPrisma();
  const workspace = await getCrmWorkspace(role, user);
  const scopedUserIds = await getScopedUserIds(role, user);
  const lookup = decodeURIComponent(id);
  const lookupSlug = slugify(lookup);
  const scopeCustomer = workspace.companies.find((item) => item.id === lookup || slugify(item.name) === lookupSlug);
  const companyWhere: Prisma.Prisma.CustomerCompanyWhereInput = await buildCustomerScopeWhere(
    prisma,
    { id: user.id ?? "", role },
  );

  const record = scopeCustomer
    ? await prisma.customerCompany.findUnique({
      where: { id: scopeCustomer.id },
      select: workspaceCompanySelect,
    })
    : await prisma.customerCompany.findFirst({
      where: combineWhere(
        companyWhere,
        {
          OR: [
            { id: lookup },
            { name: { equals: lookup, mode: "insensitive" } },
          ],
        },
      ),
      select: workspaceCompanySelect,
    });

  const scopedCustomer = record ? mapCompanyRow(record) : undefined;

  if (!scopedCustomer) {
    return {
      workspace,
      customer: undefined,
      history: {
        tasks: [],
        followUps: [],
        activities: [],
        communications: [],
      } satisfies CustomerHistory,
      journey: buildCustomerJourneyTimeline({
        customer: undefined,
        tasks: [],
        followUps: [],
        communications: [],
        activities: [],
        leads: [],
        quotations: [],
      }),
    };
  }

  const [tasks, followUps, communications, timeline, leads, quotations] = await Promise.all([
    prisma.task.findMany({
      where: combineWhere(
        scopedUserIds
          ? {
              OR: [
                { assignedToId: { in: scopedUserIds } },
                { assignedById: { in: scopedUserIds } },
              ],
            }
          : undefined,
        {
          OR: [
            { companyId: scopedCustomer.id },
            { companyName: { equals: scopedCustomer.name, mode: "insensitive" as const } },
          ],
        },
      ),
      include: taskInclude,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.followUp.findMany({
      where: combineWhere(
        scopedUserIds ? { assignedToId: { in: scopedUserIds } } : undefined,
        { companyId: scopedCustomer.id },
      ),
      include: followUpInclude,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.communicationLog.findMany({
      where: combineWhere(
        scopedUserIds ? { userId: { in: scopedUserIds } } : undefined,
        { companyId: scopedCustomer.id },
      ),
      include: communicationHistoryInclude,
      orderBy: { communicationAt: "desc" },
    }),
    prisma.activityTimeline.findMany({
      where: combineWhere(
        scopedUserIds ? { userId: { in: scopedUserIds } } : undefined,
        { companyId: scopedCustomer.id },
      ),
      include: activityTimelineInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.findMany({
      where: combineWhere(
        scopedUserIds
          ? {
              OR: [
                { assignedToId: { in: scopedUserIds } },
                { createdById: { in: scopedUserIds } },
              ],
            }
          : undefined,
        {
          OR: [
            { companyId: scopedCustomer.id },
            { customerName: { equals: scopedCustomer.name, mode: "insensitive" as const } },
          ],
        },
      ),
      select: customerJourneyLeadSelect,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.quotation.findMany({
      where: combineWhere(
        scopedUserIds
          ? {
              OR: [
                { createdById: { in: scopedUserIds } },
                { lead: { assignedToId: { in: scopedUserIds } } },
                { lead: { createdById: { in: scopedUserIds } } },
              ],
            }
          : undefined,
        {
          OR: [
            { companyId: scopedCustomer.id },
            { lead: { companyId: scopedCustomer.id } },
          ],
        },
      ),
      select: customerJourneyQuotationSelect,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const history = {
    tasks: tasks.map(mapTaskRow),
    followUps: followUps.map(mapFollowUpRow),
    communications: communications.map(mapCommunicationHistoryRow),
    activities: timeline.map(buildActivityRowFromTimeline),
  } satisfies CustomerHistory;

  const journey = buildCustomerJourneyTimeline({
    customer: {
      assignedTo: scopedCustomer.assignedTo,
    },
    tasks: tasks.map((task) => ({
      title: task.title,
      description: task.description,
      notes: task.notes,
      priority: task.priority,
      status: task.status,
      assignedTo: task.assignedTo?.name,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      taskDate: task.taskTime ?? task.dueDate ?? task.createdAt,
    })),
    followUps: followUps.map((followUp) => ({
      method: followUp.method,
      note: followUp.note,
      nextDiscussionPlan: followUp.nextDiscussionPlan,
      status: followUp.status,
      priority: followUp.priority,
      assignedTo: followUp.assignedTo?.name,
      createdAt: followUp.createdAt,
      updatedAt: followUp.updatedAt,
      completedAt: followUp.completedAt,
      followUpDate: followUp.followUpDate,
    })),
    communications: communications.map((communication) => ({
      method: communication.method,
      note: communication.note,
      discussionTopic: communication.discussionTopic,
      productDiscussed: communication.productDiscussed,
      outcome: communication.outcome,
      followUpNote: communication.followUpNote,
      createdBy: communication.user?.name,
      createdAt: communication.createdAt,
      communicationAt: communication.communicationAt,
      nextFollowUpDate: communication.nextFollowUpDate,
    })),
    activities: timeline.map((item) => ({
      title: item.title,
      description: item.description,
      entity: item.entity,
      createdAt: item.createdAt,
    })),
    leads: leads.map((lead: CustomerJourneyLeadRecord) => ({
      title: lead.title,
      notes: lead.notes,
      status: lead.status,
      priority: lead.priority,
      assignedTo: lead.assignedTo?.name,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      followUpDate: lead.followUpDate,
    })),
    quotations: quotations.map((quotation: CustomerJourneyQuotationRecord) => ({
      quoteNumber: quotation.quoteNumber,
      notes: quotation.notes,
      status: quotation.status,
      createdBy: quotation.createdBy?.name,
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
    })),
  });

  return {
    workspace,
    customer: scopedCustomer,
    history,
    journey,
  };
}

export async function getProductDetail(id: string, role: Role, user: ShellUser, query?: Record<string, unknown>) {
  const prisma = getPrisma();
  const workspace = await getCrmWorkspace(role, user);
  const scopedUserIds = await getScopedUserIds(role, user);
  const lookup = decodeURIComponent(id);
  const lookupSlug = slugify(lookup);
  const productRecord = await prisma.productService.findFirst({
    where: {
      OR: [
        { id: lookup },
        { name: { equals: lookup, mode: "insensitive" } },
      ],
    },
    include: productInclude,
  }) ?? (lookup === lookupSlug
    ? await prisma.productService.findFirst({
        where: {
          name: {
            in: workspace.products.filter((item) => slugify(item.name) === lookupSlug).map((item) => item.name),
          },
        },
        include: productInclude,
      })
    : null);
  const productEngagement = productRecord ? buildProductEngagement(productRecord, scopedUserIds, query) : undefined;
  const mappedProduct = productRecord && productEngagement
    ? {
        id: productRecord.id,
        name: productRecord.name,
        category: productRecord.category,
        brand: productRecord.brand ?? "-",
        price: Number(productRecord.price),
        imageUrl: productRecord.imageUrl ?? "",
        description: productRecord.description ?? "-",
        specification: productRecord.specification ?? "-",
        status: labelize(productRecord.status),
        interestedCustomers: productEngagement.summary.totalCompaniesContacted,
        communicationCount: productEngagement.summary.totalCommunicationCount,
        followUpCount: productEngagement.summary.followUpCount,
        quotationCount: productEngagement.summary.quotationSentCount,
        salesCount: productEngagement.summary.salesCount,
        conversionRate: productEngagement.summary.conversionRate,
        assignedCount: productEngagement.filterOptions.assignedUsers.length,
        assignedMarketers: productEngagement.filterOptions.assignedUsers.map((item) => item.name),
        targetCompanies: productEngagement.summary.totalShortlistedCompanies,
        contactedCompanies: productEngagement.summary.contactedCompanies,
        remainingCompanies: Math.max(productEngagement.summary.totalShortlistedCompanies - productEngagement.summary.contactedCompanies, 0),
      }
    : undefined;

  return {
    workspace,
    product: workspace.products.find((item) => item.id === lookup || slugify(item.name) === lookupSlug) ?? mappedProduct,
    productEngagement,
  };
}

export async function getQuotationDetail(id: string, role: Role, user: ShellUser) {
  const workspace = await getCrmWorkspace(role, user);
  const lookup = decodeURIComponent(id);
  const lookupSlug = slugify(lookup);
  return {
    workspace,
    quotation: workspace.quotations.find((item) => item.id === lookup || item.quoteNumber === lookup || slugify(item.quoteNumber) === lookupSlug),
  };
}

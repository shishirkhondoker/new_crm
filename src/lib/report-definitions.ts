export const REPORT_FILTER_KEYS = [
  "dateRange",
  "employee",
  "customer",
  "communicationType",
  "followUpStatus",
  "taskStatus",
  "leadStatus",
  "product",
] as const;

export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number];

export const REPORT_DEFINITIONS = [
  {
    type: "CUSTOMER_COMMUNICATION",
    slug: "customer-communication-report",
    title: "Customer Communication Report",
    description: "Call, email, meeting, and WhatsApp history with customers and leads.",
    filters: ["dateRange", "customer", "employee", "communicationType"],
  },
  {
    type: "FOLLOW_UP",
    slug: "follow-up-report",
    title: "Follow-up Report",
    description: "Due, overdue, upcoming, and completed follow-up records.",
    filters: ["dateRange", "employee", "followUpStatus"],
  },
  {
    type: "TASK",
    slug: "task-report",
    title: "Task Report",
    description: "Assigned work, carry-forward tasks, completion status, and ownership.",
    filters: ["dateRange", "employee", "taskStatus"],
  },
  {
    type: "EMPLOYEE_PERFORMANCE",
    slug: "employee-performance-report",
    title: "Employee Performance Report",
    description: "Lead, communication, follow-up, task, sales, and conversion performance.",
    filters: ["dateRange", "employee"],
  },
  {
    type: "LEAD_CONVERSION",
    slug: "lead-conversion-report",
    title: "Lead Conversion Report",
    description: "Lead pipeline movement, score, probability, and conversion readiness.",
    filters: ["dateRange", "employee", "leadStatus", "product"],
  },
  {
    type: "SALES",
    slug: "sales-report",
    title: "Sales Report",
    description: "Quotation totals, converted sales, value tracking, and ownership.",
    filters: ["dateRange", "employee", "customer", "product"],
  },
  {
    type: "QUOTATION",
    slug: "quotation-report",
    title: "Quotation Report",
    description: "Quotation status, items, validity, totals, and customer mapping.",
    filters: ["dateRange", "employee", "customer", "product"],
  },
  {
    type: "PRODUCT_INTEREST",
    slug: "product-interest-report",
    title: "Product Interest Report",
    description: "Product demand, engagement, lead interest, and customer coverage.",
    filters: ["dateRange", "employee", "customer", "product"],
  },
  {
    type: "CUSTOMER_GROWTH",
    slug: "customer-growth-report",
    title: "Customer Growth Report",
    description: "New customer growth with assigned ownership and engagement context.",
    filters: ["dateRange", "employee"],
  },
  {
    type: "REWARD",
    slug: "reward-report",
    title: "Reward Report",
    description: "Reward points, rule-driven incentives, and manual reward entries.",
    filters: ["dateRange", "employee"],
  },
  {
    type: "DAILY_WORK_SUMMARY",
    slug: "daily-work-summary-report",
    title: "Daily Work Summary Report",
    description: "Daily task, follow-up, communication, and lead activity summary.",
    filters: ["dateRange", "employee"],
  },
  {
    type: "ACTIVITY_LOG",
    slug: "activity-log-report",
    title: "Activity Log Report",
    description: "Operational audit log for work performed within the allowed CRM scope.",
    filters: ["dateRange", "employee"],
  },
] as const;

export type ReportTypeKey = (typeof REPORT_DEFINITIONS)[number]["type"];

export type ReportFormat = "pdf" | "xlsx" | "csv" | "print";

export const DATE_PRESET_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
] as const;

export type ReportDatePreset = (typeof DATE_PRESET_OPTIONS)[number]["value"];

export function getReportDefinition(reportType: string) {
  return REPORT_DEFINITIONS.find((item) => item.type === reportType);
}

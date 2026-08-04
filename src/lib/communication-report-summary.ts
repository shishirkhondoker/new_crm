export type CommunicationReportSummaryInput = {
  id: string;
  customerKey?: string | null;
  customerName?: string | null;
  marketerName?: string | null;
  occurredAt?: Date | string | null;
  method?: string | null;
  note?: string | null;
  outcome?: string | null;
  nextFollowUpAt?: Date | string | null;
};

export type CommunicationReportSummaryRow = {
  customerKey: string;
  customerName: string;
  marketerNames: string[];
  totalContacts: number;
  followUpCount: number;
  latestContactAt: Date | null;
  latestMethod: string;
  latestNote: string;
  latestOutcome: string;
  nextFollowUpAt: Date | null;
};

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function normalizeDate(value?: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildCustomerKey(item: CommunicationReportSummaryInput) {
  const explicitKey = normalizeText(item.customerKey);
  if (explicitKey) return explicitKey;

  const customerName = normalizeText(item.customerName);
  if (customerName) return `name:${customerName.toLowerCase()}`;

  return `unknown:${item.id}`;
}

export function summarizeCommunicationReport(items: CommunicationReportSummaryInput[]) {
  const grouped = new Map<string, CommunicationReportSummaryRow & { marketerSet: Set<string> }>();

  for (const item of items) {
    const customerKey = buildCustomerKey(item);
    const customerName = normalizeText(item.customerName) || "Unknown company";
    const marketerName = normalizeText(item.marketerName);
    const occurredAt = normalizeDate(item.occurredAt);
    const nextFollowUpAt = normalizeDate(item.nextFollowUpAt);
    const latestMethod = normalizeText(item.method) || "-";
    const latestNote = normalizeText(item.note) || "-";
    const latestOutcome = normalizeText(item.outcome) || "-";

    const existing = grouped.get(customerKey);
    if (!existing) {
      grouped.set(customerKey, {
        customerKey,
        customerName,
        marketerNames: marketerName ? [marketerName] : [],
        marketerSet: marketerName ? new Set([marketerName]) : new Set<string>(),
        totalContacts: 1,
        followUpCount: 0,
        latestContactAt: occurredAt,
        latestMethod,
        latestNote,
        latestOutcome,
        nextFollowUpAt,
      });
      continue;
    }

    existing.totalContacts += 1;
    existing.followUpCount += 1;

    if (marketerName && !existing.marketerSet.has(marketerName)) {
      existing.marketerSet.add(marketerName);
      existing.marketerNames.push(marketerName);
    }

    const existingLatestTime = existing.latestContactAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const currentTime = occurredAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (currentTime >= existingLatestTime) {
      existing.latestContactAt = occurredAt;
      existing.latestMethod = latestMethod;
      existing.latestNote = latestNote;
      existing.latestOutcome = latestOutcome;
    }

    const existingNextFollowUpTime = existing.nextFollowUpAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const currentNextFollowUpTime = nextFollowUpAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (currentNextFollowUpTime >= existingNextFollowUpTime) {
      existing.nextFollowUpAt = nextFollowUpAt;
    }
  }

  const rows: CommunicationReportSummaryRow[] = [];

  for (const row of grouped.values()) {
    rows.push({
      customerKey: row.customerKey,
      customerName: row.customerName,
      marketerNames: row.marketerNames,
      totalContacts: row.totalContacts,
      followUpCount: row.followUpCount,
      latestContactAt: row.latestContactAt,
      latestMethod: row.latestMethod,
      latestNote: row.latestNote,
      latestOutcome: row.latestOutcome,
      nextFollowUpAt: row.nextFollowUpAt,
    });
  }

  return rows.sort((left, right) => (right.latestContactAt?.getTime() ?? 0) - (left.latestContactAt?.getTime() ?? 0));
}

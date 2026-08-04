export const CRM_TIME_ZONE = "Asia/Dhaka";

const CRM_UTC_OFFSET_MINUTES = 6 * 60;
const CRM_UTC_OFFSET_MS = CRM_UTC_OFFSET_MINUTES * 60 * 1000;
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type CrmPeriod = "today" | "yesterday" | "week" | "month" | "year" | "custom";

export type CrmPeriodWindow = {
  period: CrmPeriod;
  from: Date;
  to: Date;
};

type CrmDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type CrmPlainDate = Pick<CrmDateParts, "year" | "month" | "day">;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function shiftToCrm(date: Date) {
  return new Date(date.getTime() + CRM_UTC_OFFSET_MS);
}

function crmDateFromParts(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - CRM_UTC_OFFSET_MS);
}

function getCrmDateParts(date: Date): CrmDateParts {
  const shifted = shiftToCrm(date);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function shiftCrmPlainDate(parts: CrmPlainDate, days: number): CrmPlainDate {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function parseCrmDateKey(value?: string) {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  return { year, month, day };
}

function compareCrmPlainDates(left: CrmPlainDate, right: CrmPlainDate) {
  return Date.UTC(left.year, left.month - 1, left.day) - Date.UTC(right.year, right.month - 1, right.day);
}

function crmPlainDateKey(parts: CrmPlainDate) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatCrmDate(
  date: Date | null | undefined,
  pattern: "dd/MM/yyyy" | "dd/MM/yyyy hh:mm a" | "hh:mm a" | "dd MMM yyyy" | "dd MMM yyyy hh:mm a" | "yyyy-MM-dd" = "dd/MM/yyyy",
) {
  if (!date) return "-";

  const parts = getCrmDateParts(date);
  const hour12 = parts.hour % 12 || 12;
  const meridiem = parts.hour >= 12 ? "PM" : "AM";
  const dateSlash = `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
  const dateShort = `${pad(parts.day)} ${SHORT_MONTHS[parts.month - 1]} ${parts.year}`;
  const timeLabel = `${pad(hour12)}:${pad(parts.minute)} ${meridiem}`;

  switch (pattern) {
    case "dd/MM/yyyy":
      return dateSlash;
    case "dd/MM/yyyy hh:mm a":
      return `${dateSlash} ${timeLabel}`;
    case "hh:mm a":
      return timeLabel;
    case "dd MMM yyyy":
      return dateShort;
    case "dd MMM yyyy hh:mm a":
      return `${dateShort} ${timeLabel}`;
    case "yyyy-MM-dd":
      return crmPlainDateKey(parts);
    default:
      return dateSlash;
  }
}

export function startOfCrmDay(base = new Date()) {
  const parts = getCrmDateParts(base);
  return crmDateFromParts(parts.year, parts.month, parts.day);
}

export function getCrmDayWindow(base = new Date()) {
  const parts = getCrmDateParts(base);
  const from = crmDateFromParts(parts.year, parts.month, parts.day);
  const nextDay = shiftCrmPlainDate(parts, 1);
  const to = crmDateFromParts(nextDay.year, nextDay.month, nextDay.day);
  return { from, to };
}

export function isSameCrmDay(left: Date, right: Date) {
  return formatCrmDate(left, "yyyy-MM-dd") === formatCrmDate(right, "yyyy-MM-dd");
}

export function isBeforeCrmDay(left: Date, right: Date) {
  return startOfCrmDay(left).getTime() < startOfCrmDay(right).getTime();
}

export function getCrmPeriodWindow(
  now: Date,
  options?: { period?: CrmPeriod; from?: string; to?: string },
): CrmPeriodWindow {
  const period = options?.period ?? "month";
  const todayParts = getCrmDateParts(now);
  let fromParts: CrmPlainDate = todayParts;
  let toExclusiveParts = shiftCrmPlainDate(todayParts, 1);

  if (period === "yesterday") {
    fromParts = shiftCrmPlainDate(todayParts, -1);
    toExclusiveParts = todayParts;
  } else if (period === "week") {
    const dayIndex = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day)).getUTCDay();
    const daysFromMonday = (dayIndex + 6) % 7;
    fromParts = shiftCrmPlainDate(todayParts, -daysFromMonday);
    toExclusiveParts = shiftCrmPlainDate(fromParts, 7);
  } else if (period === "month") {
    fromParts = { year: todayParts.year, month: todayParts.month, day: 1 };
    const nextMonth = new Date(Date.UTC(todayParts.year, todayParts.month, 1));
    toExclusiveParts = {
      year: nextMonth.getUTCFullYear(),
      month: nextMonth.getUTCMonth() + 1,
      day: nextMonth.getUTCDate(),
    };
  } else if (period === "year") {
    fromParts = { year: todayParts.year, month: 1, day: 1 };
    toExclusiveParts = { year: todayParts.year + 1, month: 1, day: 1 };
  } else if (period === "custom") {
    const customFrom = parseCrmDateKey(options?.from);
    const customTo = parseCrmDateKey(options?.to);
    const candidateFrom = customFrom ?? todayParts;
    const candidateTo = customTo ?? candidateFrom;

    if (compareCrmPlainDates(candidateTo, candidateFrom) < 0) {
      fromParts = candidateTo;
      toExclusiveParts = shiftCrmPlainDate(candidateFrom, 1);
    } else {
      fromParts = candidateFrom;
      toExclusiveParts = shiftCrmPlainDate(candidateTo, 1);
    }
  }

  return {
    period,
    from: crmDateFromParts(fromParts.year, fromParts.month, fromParts.day),
    to: crmDateFromParts(toExclusiveParts.year, toExclusiveParts.month, toExclusiveParts.day),
  };
}

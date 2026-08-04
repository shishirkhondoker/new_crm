export const TASK_REMINDER_OPTIONS = [
  { value: "", label: "No reminder" },
  { value: "AT_TIME", label: "At task time" },
  { value: "15_MIN_BEFORE", label: "15 minutes before" },
  { value: "30_MIN_BEFORE", label: "30 minutes before" },
  { value: "60_MIN_BEFORE", label: "1 hour before" },
] as const;

export type TaskReminderValue = typeof TASK_REMINDER_OPTIONS[number]["value"];

const TASK_REMINDER_LABEL_MAP: Record<Exclude<TaskReminderValue, "">, string> = {
  AT_TIME: "At task time",
  "15_MIN_BEFORE": "15 minutes before",
  "30_MIN_BEFORE": "30 minutes before",
  "60_MIN_BEFORE": "1 hour before",
};

const TASK_REMINDER_OFFSET_MAP: Record<Exclude<TaskReminderValue, "">, number> = {
  AT_TIME: 0,
  "15_MIN_BEFORE": 15 * 60 * 1000,
  "30_MIN_BEFORE": 30 * 60 * 1000,
  "60_MIN_BEFORE": 60 * 60 * 1000,
};

export function normalizeTaskReminderValue(value?: string | null): TaskReminderValue {
  const normalized = value?.trim().toUpperCase().replace(/\s+/g, "_") ?? "";
  if (!normalized || normalized === "-" || normalized === "NONE" || normalized === "NO_REMINDER") return "";
  if (normalized === "AT_TIME" || normalized === "AT_TASK_TIME") return "AT_TIME";
  if (normalized === "15_MIN_BEFORE" || normalized === "15_MINUTES_BEFORE") return "15_MIN_BEFORE";
  if (normalized === "30_MIN_BEFORE" || normalized === "30_MINUTES_BEFORE") return "30_MIN_BEFORE";
  if (normalized === "60_MIN_BEFORE" || normalized === "1_HOUR_BEFORE") return "60_MIN_BEFORE";
  return "";
}

export function taskReminderLabel(value?: string | null) {
  const normalized = normalizeTaskReminderValue(value);
  if (!normalized) {
    const fallback = value?.trim();
    return fallback && fallback !== "-" ? fallback : "-";
  }
  return TASK_REMINDER_LABEL_MAP[normalized];
}

export function taskReminderOffsetMs(value?: string | null) {
  const normalized = normalizeTaskReminderValue(value);
  if (!normalized) return null;
  return TASK_REMINDER_OFFSET_MAP[normalized];
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Check,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  XCircle,
  Download,
  Edit,
  Eye,
  FileDown,
  FileText,
  Mail,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Building2,
  Clock3,
  Phone,
  PhoneCall,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Snowflake,
  Target,
  Star,
  Upload,
  UserPlus,
  WalletCards,
  Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { LeadStatusDonut, ProductBarChart, SalesLineChart } from "@/components/charts/crm-charts";
import { FollowUpEditModal, type EditableFollowUpModalItem } from "@/components/crm/follow-up-edit-modal";
import { ChartCard } from "@/components/shared/chart-card";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { DataTable } from "@/components/shared/data-table";
import { DetailsDrawer } from "@/components/shared/details-drawer";
import { EmptyState } from "@/components/shared/empty-state";
import { FormModal } from "@/components/shared/form-modal";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { CRM_LIVE_SYNC_EVENT, useTaskCounterContext } from "@/components/app/app-shell";
import {
  assignProductCompaniesAction,
  completeFollowUpWithCommunicationAction,
  completeTaskWithFollowUpAction,
  createCommunicationAction,
  createCustomerAction,
  createFollowUpAction,
  createImportExportLogAction,
  createLeadAction,
  createTaskAction,
  createUserAction,
  deleteUserAction,
  giveManualRewardAction,
  logCustomerCommunicationShortcutAction,
  markNotificationReadAction,
  saveSettingsAction,
  updateUserAction,
  updateFollowUpStatusAction,
} from "@/lib/crm-actions";
import type {
  CompanyRow,
  CrmWorkspace,
  CustomerHistory,
  CustomerJourneySummary,
  CommunicationHistoryRow,
  FollowUpPageData,
  FollowUpRow,
  LeadRow,
  ProductEngagementData,
  ProductRow,
  QuotationRow,
  TaskRow,
} from "@/lib/crm-data";
import type { CompletedWorkItem, TodayWorkQueueItem, WorkStepNote } from "@/lib/task-center";
import { TASK_REMINDER_OPTIONS, normalizeTaskReminderValue, taskReminderLabel, type TaskReminderValue } from "@/lib/task-reminders";
import { getCrmDayWindow, getCrmPeriodWindow } from "@/lib/crm-time";
import { type ReportFormat } from "@/lib/report-definitions";
import { cn, formatCurrency, initials, rolePath, type Role, type ShellUser } from "@/lib/utils";

export { FollowUpEditModal, type EditableFollowUpModalItem } from "@/components/crm/follow-up-edit-modal";

type ActionResult = { ok?: boolean; message?: string; [key: string]: unknown } | unknown;

type ServerAction = (formData: FormData) => Promise<ActionResult>;

type TaskWorkspaceUser = Pick<ShellUser, "id" | "name" | "email" | "mobile" | "role" | "designation">;

type TaskWorkspaceEmployee = {
  id: string;
  name: string;
  role: string;
  roleKey: Role;
  status: string;
  statusKey: "ACTIVE" | "INACTIVE";
  designation: string;
  supervisorId?: string | null;
  supervisorIds: string[];
};

type TaskWorkspaceProduct = {
  id: string;
  name: string;
};

type TaskWorkspaceData = {
  user: TaskWorkspaceUser;
  employees: TaskWorkspaceEmployee[];
  products: TaskWorkspaceProduct[];
  companies?: CompanyRow[];
};

function normalizeInitialTodayWorkRows(rows?: TodayWorkQueueItem[]) {
  return sortTodayWorkQueue(dedupeRowsById(rows ?? []));
}

export function sortCompletedWorkRows(rows: CompletedWorkItem[]) {
  return [...rows].sort((left, right) => {
    const completedDiff = new Date(right.completedAtIso).getTime() - new Date(left.completedAtIso).getTime();
    if (completedDiff !== 0) return completedDiff;

    const scheduledDiff = new Date(right.taskDateIso).getTime() - new Date(left.taskDateIso).getTime();
    if (scheduledDiff !== 0) return scheduledDiff;

    return right.id.localeCompare(left.id);
  });
}

function normalizeInitialCompletedWorkRows(rows?: CompletedWorkItem[]) {
  return sortCompletedWorkRows(dedupeRowsById(rows ?? []));
}

function pageActions(items: { label: string; icon: typeof Plus; variant?: "default" | "outline"; onClick?: () => void; href?: string }[]) {
  return items.map(({ label, icon: Icon, variant = "outline", onClick, href }) => {
    const className = cn(
      "inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
      variant === "default" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
    );

    return href ? (
      <Link key={label} href={href} className={className}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    ) : (
      <Button key={label} type="button" size="sm" variant={variant} onClick={onClick}>
        <Icon className="h-4 w-4" />
        {label}
      </Button>
    );
  });
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">{children}</div>;
}

function SelectBox({ label, name, children, defaultValue, compact = false }: { label: string; name?: string; children: React.ReactNode; defaultValue?: string; compact?: boolean }) {
  return (
    <label className={cn("space-y-1.5", compact && "space-y-1")}>
      <span className={cn("text-xs font-bold uppercase text-slate-500", compact && "text-[11px] leading-4")}>{label}</span>
      <select name={name} defaultValue={defaultValue} className={cn("h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100", compact && "h-9 px-2.5 text-[13px]")}>
        {children}
      </select>
    </label>
  );
}

type SearchableOption = {
  value: string;
  label: string;
};

type SearchableScope = "companies" | "leads";

type SearchableRow = { value?: string; label?: string; id?: string } & Record<string, unknown>;

type CompanyListRow = {
  id: string;
  companyName: string;
  contactPerson?: string | null;
  phone?: string | null;
};

type LeadListRow = {
  id: string;
  name: string;
  phone?: string | null;
  companyName?: string | null;
};

function buildSearchLabel(scope: SearchableScope, raw: SearchableRow) {
  const fallbackLabel = "name" in raw && typeof raw.name === "string" ? raw.name.trim() : "";
  if (scope === "companies") {
    const name =
      typeof raw.companyName === "string" && raw.companyName.trim()
        ? raw.companyName
        : typeof raw.name === "string" && raw.name.trim()
          ? raw.name
          : "";
    const industry = typeof raw.industry === "string" && raw.industry.trim() ? raw.industry.trim() : "";
    const city = typeof raw.city === "string" && raw.city.trim() ? raw.city.trim() : "";
    const phone = typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : "";
    const meta = [industry, city, phone].filter(Boolean).join(" • ");
    return meta ? `${name || fallbackLabel || "Unnamed company"} (${meta})` : name || fallbackLabel || "Unnamed company";
  }

  const base = typeof raw.name === "string" && raw.name.trim() ? raw.name : fallbackLabel || "";
  const company = typeof raw.companyName === "string" && raw.companyName.trim() ? raw.companyName : "";
  return base && company ? `${base} (${company})` : base || company || "Unnamed lead";
}

function mapSearchRows(scope: SearchableScope, rows: unknown[]) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows
    .map((raw) => {
      const row = raw as SearchableRow & CompanyListRow & LeadListRow;
      const value = typeof row.value === "string" && row.value.trim() ? row.value : typeof row.id === "string" && row.id.trim() ? row.id : "";
      if (!value) return null;

      return { value, label: buildSearchLabel(scope, row) };
    })
    .filter((item): item is SearchableOption => Boolean(item));
}

function optionInputLabel(scope: SearchableScope | undefined, label: string) {
  if (scope !== "companies") return label;
  return label.replace(/\s+\([^)]*\)\s*$/, "").trim() || label;
}

function SearchableEntitySelect({
  label,
  name,
  options,
  defaultValue = "",
  defaultLabel,
  value,
  onValueChange,
  searchScope,
  searchParams,
  required = false,
  placeholder,
  compact = false,
}: {
  label: string;
  name?: string;
  options: SearchableOption[];
  defaultValue?: string;
  defaultLabel?: string;
  value?: string;
  onValueChange?: (value: string, label: string) => void;
  searchScope?: SearchableScope;
  searchParams?: Record<string, string>;
  required?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const isControlled = onValueChange !== undefined;
  const normalizedSearchScope = searchScope ?? "";
  const [query, setQuery] = React.useState("");
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const selectedValue = isControlled ? (value ?? "") : internalValue;
  const [remoteOptions, setRemoteOptions] = React.useState<SearchableOption[]>([]);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  const sourceOptions = React.useMemo(
    () => (searchScope ? remoteOptions : options).filter((item) => item.label.trim()),
    [options, remoteOptions, searchScope],
  );

  const normalizedQuery = query.trim();
  const filteredOptions = React.useMemo(() => {
    if (searchScope) return sourceOptions;
    const keyword = normalizedQuery.toLowerCase();
    return sourceOptions.filter((item) => item.label.toLowerCase().includes(keyword));
  }, [normalizedQuery, searchScope, sourceOptions]);

  React.useEffect(() => {
    if (isControlled) {
      const baseLabel = sourceOptions.find((item) => item.value === selectedValue)?.label ?? defaultLabel ?? "";
      if (open) return;
      if (selectedValue) {
        setQuery(optionInputLabel(searchScope, baseLabel));
      } else if (typeof defaultLabel === "string") {
        setQuery(optionInputLabel(searchScope, defaultLabel));
      } else if (!open) {
        setQuery("");
      }
      return;
    }

    if (defaultValue) {
      const baseLabel = sourceOptions.find((item) => item.value === defaultValue)?.label ?? defaultLabel ?? "";
      setInternalValue(defaultValue);
      if (!open) {
        setQuery(optionInputLabel(searchScope, baseLabel));
      }
      return;
    }

    setInternalValue("");
    setQuery("");
  }, [defaultValue, defaultLabel, isControlled, open, normalizedSearchScope, selectedValue, sourceOptions]);

  const companyCreateOption = React.useMemo(() => {
    if (searchScope !== "companies") return null;
    const trimmed = normalizedQuery.trim();
    if (!trimmed) return null;
    const exists = sourceOptions.some((option) => option.label.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) return null;
    return { value: "__create_company__", label: `Add "${trimmed}" as a new company` } satisfies SearchableOption;
  }, [normalizedQuery, searchScope, sourceOptions]);

  const renderedOptions = React.useMemo(() => {
    if (!companyCreateOption) return filteredOptions;
    return [companyCreateOption, ...filteredOptions];
  }, [companyCreateOption, filteredOptions]);

  React.useEffect(() => {
    if (!searchScope) {
      setRemoteOptions([]);
      setIsLoading(false);
      return;
    }

    if (!open && !defaultValue && !selectedValue) return;

    const endpoint = searchScope === "companies" ? "/api/companies" : "/api/leads/list";
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (normalizedQuery) {
        params.set(searchScope === "companies" ? "q" : "search", normalizedQuery);
      }
      for (const [key, rawValue] of Object.entries(searchParams ?? {})) {
        const value = rawValue.trim();
        if (value) {
          params.set(key, value);
        }
      }
      params.set("limit", searchScope === "companies" ? "1000" : "100");

      try {
        const response = await fetch(`${endpoint}?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load matches.");
        }

        const payload = await response.json();
        const rows = mapSearchRows(searchScope, Array.isArray(payload?.rows) ? payload.rows : []);
        if (!controller.signal.aborted) {
          setRemoteOptions(rows);
        }
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
          console.error(error);
          setRemoteOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [defaultValue, normalizedQuery, open, searchParams, searchScope, selectedValue]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [open, filteredOptions.length, query]);

  React.useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!wrapperRef.current || !(event.target instanceof Node)) return;
      if (!wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectOption = React.useCallback((option: SearchableOption) => {
    if (option.value === "__create_company__" && searchScope === "companies") {
      const valueLabel = normalizedQuery.trim();
      if (isControlled) {
        onValueChange?.("", valueLabel);
      } else {
        setInternalValue("");
      }
      setQuery(valueLabel);
      setOpen(false);
      return;
    }
    if (isControlled) {
      onValueChange?.(option.value, option.label);
    } else {
      setInternalValue(option.value);
    }
    setQuery(optionInputLabel(searchScope, option.label));
    setOpen(false);
  }, [isControlled, normalizedQuery, onValueChange, searchScope]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setOpen(true);

    const exactMatch = sourceOptions.find((option) => option.label.toLowerCase() === nextQuery.trim().toLowerCase());
    const nextValue = exactMatch ? exactMatch.value : "";
    if (isControlled) {
      onValueChange?.(nextValue, exactMatch?.label ?? nextQuery);
    } else {
      setInternalValue(nextValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!renderedOptions.length && event.key !== "Escape") return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => Math.min(renderedOptions.length - 1, prev + 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(0, prev - 1));
    }

    if (event.key === "Enter" && open && renderedOptions.length) {
      event.preventDefault();
      selectOption(renderedOptions[activeIndex] ?? renderedOptions[0]!);
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <label className={cn("block space-y-1.5", compact && "space-y-1")}>
      <span className={cn("text-sm font-semibold text-slate-700", compact && "text-xs leading-4")}>{label}</span>
      <div className="relative" ref={wrapperRef}>
        <input
          required={required}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Search..."}
          className={cn("h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100", compact && "h-9 px-2.5 text-[13px]")}
        />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((prev) => !prev)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-500"
          aria-label="Toggle options"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        {open ? (
          <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {isLoading ? (
              <p className="px-3 py-2 text-sm font-semibold text-slate-500">Searching...</p>
            ) : renderedOptions.length ? (
              renderedOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 transition",
                    index === activeIndex ? "bg-blue-600 text-white" : "hover:bg-slate-100",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-slate-500">No results found</p>
            )}
          </div>
        ) : null}
      </div>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
    </label>
  );
}

function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required = false,
  readOnly = false,
  disabled = false,
  compact = false,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <label className={cn("block space-y-1.5", compact && "space-y-1")}>
      <span className={cn("text-sm font-semibold text-slate-700", compact && "text-xs leading-4")}>{label}</span>
      <Input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        className={cn(
          compact ? "h-9 px-2.5 text-[13px]" : undefined,
          (readOnly || disabled) ? "bg-slate-100 text-slate-500" : undefined,
        )}
      />
    </label>
  );
}

function TextAreaField({ label, name, placeholder, required = false, compact = false, defaultValue }: { label: string; name: string; placeholder?: string; required?: boolean; compact?: boolean; defaultValue?: string }) {
  return (
    <label className={cn("block space-y-1.5", compact && "space-y-1")}>
      <span className={cn("text-sm font-semibold text-slate-700", compact && "text-xs leading-4")}>{label}</span>
      <textarea
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={cn("min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100", compact && "min-h-16 px-2.5 py-1.5 text-[13px]")}
      />
    </label>
  );
}

function ActionForm({
  action,
  children,
  onDone,
  onSuccess,
  onFailure,
  submitLabel = "Save",
  className,
  bodyClassName,
  footerClassName,
  refreshOnSuccess = true,
  resetOnSuccess = true,
}: {
  action: ServerAction;
  children: React.ReactNode;
  onDone?: () => void;
  onSuccess?: (result: ActionResult, formData: FormData) => void;
  onFailure?: (message: string) => void;
  submitLabel?: string;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
  refreshOnSuccess?: boolean;
  resetOnSuccess?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");
  const router = useRouter();

  return (
    <form
      className={cn("space-y-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          try {
            const result = await action(formData);
            if (typeof result === "object" && result && "ok" in result && result.ok === false) {
              const nextMessage = "message" in result && typeof result.message === "string" ? result.message : "Action failed.";
              setMessage(nextMessage);
              onFailure?.(nextMessage);
              return;
            }
            if (resetOnSuccess) {
              form.reset();
            }
            setMessage("");
            onSuccess?.(result, formData);
            if (refreshOnSuccess) {
              router.refresh();
            }
            onDone?.();
          } catch (error) {
            const nextMessage = error instanceof Error ? error.message : "Action failed.";
            setMessage(nextMessage);
            onFailure?.(nextMessage);
          }
        });
      }}
    >
      <div className={cn("space-y-4", bodyClassName)}>{children}</div>
      {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
      <div className={footerClassName}>
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function RowActions({ detailHref }: { detailHref?: string }) {
  return (
    <div className="flex items-center gap-1">
      {detailHref ? (
        <Link href={detailHref} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="View">
          <Eye className="h-4 w-4" />
        </Link>
      ) : null}
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit">
        <Edit className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="More">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

type UserFeedback = { type: "success" | "error"; message: string } | null;

function FloatingFeedback({ feedback }: { feedback: UserFeedback }) {
  return (
    <AnimatePresence>
      {feedback ? (
        <motion.div
          key={`${feedback.type}-${feedback.message}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18 }}
          className="fixed right-4 top-4 z-[80] max-w-sm rounded-2xl border px-4 py-3 shadow-xl"
        >
          <div
            className={cn(
              "rounded-xl px-4 py-3 text-sm font-semibold",
              feedback.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-700",
            )}
          >
            {feedback.message}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function UserRowActions({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      {canEdit ? (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-500 transition duration-150 hover:scale-110 hover:bg-slate-100 hover:text-slate-900" onClick={onEdit} aria-label="Edit user">
          <Edit className="h-4 w-4" />
        </Button>
      ) : null}
      {canDelete ? (
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600 transition duration-150 hover:scale-110 hover:bg-red-50 hover:text-red-700" onClick={onDelete} aria-label="Delete user">
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
      {!canEdit && !canDelete ? <span className="text-xs font-semibold text-slate-400">No actions</span> : null}
    </div>
  );
}

function UserForm({
  employees,
  viewerRole,
  mode,
  user,
  onDone,
  onSuccess,
  onFailure,
  forcedRole,
}: {
  employees: CrmWorkspace["employees"];
  viewerRole: Role;
  mode: "create" | "edit";
  user?: CrmWorkspace["employees"][number] | null;
  onDone: () => void;
  onSuccess: (row: CrmWorkspace["employees"][number], mode: "create" | "edit") => void;
  onFailure: (message: string) => void;
  forcedRole?: Role;
}) {
  const defaultRole = forcedRole ?? user?.roleKey ?? "MARKETER";
  const [roleValue, setRoleValue] = React.useState<Role>(defaultRole);

  React.useEffect(() => {
    setRoleValue(forcedRole ?? user?.roleKey ?? "MARKETER");
  }, [forcedRole, user]);

  const supervisorOptions = React.useMemo(
    () => employees.filter((item) => item.roleKey === "SUPERVISOR"),
    [employees],
  );

  const roleOptions = React.useMemo(() => {
    if (viewerRole === "SUPERVISOR") {
      return [{ value: "MARKETER" as Role, label: "Marketer" }];
    }

    if (mode === "edit" && user?.roleKey === "ADMIN") {
      return [
        { value: "ADMIN" as Role, label: "Admin" },
        { value: "SUPERVISOR" as Role, label: "Supervisor" },
        { value: "MARKETER" as Role, label: "Marketer" },
      ];
    }

    return [
      { value: "MARKETER" as Role, label: "Marketer" },
      { value: "SUPERVISOR" as Role, label: "Supervisor" },
    ];
  }, [mode, user, viewerRole]);

  return (
    <ActionForm
      action={mode === "create" ? createUserAction : updateUserAction}
      submitLabel={mode === "create" ? (forcedRole === "MARKETER" ? "Create Marketer" : "Create User") : "Update User"}
      onDone={onDone}
      refreshOnSuccess={false}
      onFailure={onFailure}
      onSuccess={(result) => {
        if (typeof result === "object" && result && "row" in result && result.row) {
          onSuccess(result.row as CrmWorkspace["employees"][number], mode);
        }
      }}
    >
      {mode === "edit" && user ? <input type="hidden" name="userId" value={user.id} /> : null}
      <TextField label="Full Name" name="name" required defaultValue={user?.name ?? ""} />
      <TextField label="Email" name="email" type="email" required defaultValue={user?.email === "-" ? "" : user?.email ?? ""} />
      <TextField label="Mobile Number (Optional)" name="mobile" defaultValue={user?.mobile === "-" ? "" : user?.mobile ?? ""} />
      <TextField label="Designation" name="designation" defaultValue={user?.designation === "-" ? "" : user?.designation ?? (forcedRole === "MARKETER" ? "Sales Marketer" : "")} />
      <div className={cn("grid gap-3", mode === "edit" ? "md:grid-cols-2" : undefined)}>
        {viewerRole === "SUPERVISOR" ? (
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Role</span>
            <Input value="Marketer" readOnly className="bg-slate-100 text-slate-500" />
            <input type="hidden" name="role" value="MARKETER" />
          </label>
        ) : (
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Role</span>
            <select
              name="role"
              value={roleValue}
              onChange={(event) => setRoleValue(event.target.value as Role)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}
        {mode === "edit" ? (
          <SelectBox label="Status" name="status" defaultValue={user?.statusKey ?? "ACTIVE"}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectBox>
        ) : (
          <input type="hidden" name="status" value="ACTIVE" />
        )}
      </div>
      {viewerRole === "ADMIN" && roleValue === "MARKETER" ? (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase text-slate-500">Supervisors</div>
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
            {supervisorOptions.map((item) => {
              const selectedSupervisorIds = user?.supervisorIds?.length
                ? user.supervisorIds
                : user?.supervisorId
                  ? [user.supervisorId]
                  : [];
              const checked = selectedSupervisorIds.includes(item.id);

              return (
                <label key={item.id} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    name="supervisorIds"
                    value={item.id}
                    defaultChecked={checked}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                  <span>{item.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </ActionForm>
  );
}

function DeleteUserPanel({
  user,
  onDone,
  onSuccess,
  onFailure,
}: {
  user: CrmWorkspace["employees"][number];
  onDone: () => void;
  onSuccess: (id: string) => void;
  onFailure: (message: string) => void;
}) {
  return (
    <ActionForm
      action={deleteUserAction}
      submitLabel="Delete User"
      onDone={onDone}
      onFailure={onFailure}
      onSuccess={(result) => {
        if (typeof result === "object" && result && "id" in result && typeof result.id === "string") {
          onSuccess(result.id);
        }
      }}
      refreshOnSuccess={false}
      resetOnSuccess={false}
      className="space-y-4"
    >
      <input type="hidden" name="userId" value={user.id} />
      <p className="text-sm text-slate-700">
        Are you sure you want to delete <span className="font-black">{user.name}</span>?
      </p>
    </ActionForm>
  );
}

function EntityLink({
  href,
  children,
  className,
  stopPropagation = false,
  onNavigate,
}: {
  href?: string | null;
  children: React.ReactNode;
  className?: string;
  stopPropagation?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  if (!href || children === "-") return <span className={className}>{children}</span>;

  return (
    <Link
      href={href}
      className={cn("text-blue-700 underline-offset-2 transition hover:underline", className)}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        onNavigate?.();
        router.push(href);
      }}
    >
      {children}
    </Link>
  );
}

function EntityOptions({ workspace, type }: { workspace: CrmWorkspace; type: "users" | "marketers" | "supervisors" | "companies" | "leads" | "products" }) {
  const rows =
    type === "users" ? workspace.employees.map((item) => [item.id, item.name])
      : type === "marketers" ? workspace.employees.filter((item) => item.role === "Marketer").map((item) => [item.id, item.name])
        : type === "supervisors" ? workspace.employees.filter((item) => item.role === "Supervisor").map((item) => [item.id, item.name])
          : type === "companies" ? workspace.companies.map((item) => [item.id, item.name])
            : type === "leads" ? workspace.leads.map((item) => [item.id, item.title])
              : workspace.products.map((item) => [item.id, item.name]);

  return (
    <div className="space-y-5">
      <option value="">Select</option>
      {rows.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </div>
  );
}

type AssigneeOption = {
  id: string;
  label: string;
};

function getAssignableUserOptions(workspace: CrmWorkspace, role: Role, mode: "task" | "follow-up"): AssigneeOption[] {
  const options = new Map<string, AssigneeOption>();
  const addOption = (id: string | undefined, label: string | undefined) => {
    const normalizedId = id?.trim();
    const normalizedLabel = label?.trim();
    if (!normalizedId || !normalizedLabel || options.has(normalizedId)) return;
    options.set(normalizedId, { id: normalizedId, label: normalizedLabel });
  };

  const selfId = workspace.user.id?.trim();
  const selfLabel = workspace.user.name?.trim();

  if (mode === "follow-up" && role === "MARKETER") {
    addOption(selfId, selfLabel ? `${selfLabel} (Me)` : undefined);
    return Array.from(options.values());
  }

  if (role === "SUPERVISOR") {
    addOption(selfId, selfLabel ? `${selfLabel} (Me)` : undefined);
  }

  for (const employee of workspace.employees) {
    const employeeRole = employee.role.trim().toUpperCase();
    if (role === "SUPERVISOR" && employeeRole !== "MARKETER") continue;
    if (role === "ADMIN" && !["SUPERVISOR", "MARKETER"].includes(employeeRole)) continue;
    if (role === "MARKETER") continue;
    addOption(employee.id, `${employee.name} (${employee.role})`);
  }

  return Array.from(options.values());
}

function getCustomerOwnerOptions(workspace: CrmWorkspace, role: Role): AssigneeOption[] {
  const options = new Map<string, AssigneeOption>();
  const addOption = (id: string | undefined, label: string | undefined) => {
    const normalizedId = id?.trim();
    const normalizedLabel = label?.trim();
    if (!normalizedId || !normalizedLabel || options.has(normalizedId)) return;
    options.set(normalizedId, { id: normalizedId, label: normalizedLabel });
  };

  if (role === "MARKETER") {
    addOption(workspace.user.id, workspace.user.name ? `${workspace.user.name} (Me)` : undefined);
    return Array.from(options.values());
  }

  for (const employee of workspace.employees) {
    if (employee.roleKey === "MARKETER") {
      addOption(employee.id, `${employee.name} (${employee.role})`);
    }
  }

  if (role === "SUPERVISOR" && options.size === 0) {
    addOption(workspace.user.id, workspace.user.name ? `${workspace.user.name} (Me)` : undefined);
  }

  return Array.from(options.values());
}

function InfoLine({ label, value, progress }: { label: string; value: React.ReactNode; progress?: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
      {typeof progress === "number" ? (
        <div className="mt-3 h-2 rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function StepNotesHistoryPanel({
  entries,
  title = "Step Notes",
  emptyMessage = "No step note saved yet.",
  compact = false,
}: {
  entries?: WorkStepNote[];
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
}) {
  const noteEntries = React.useMemo(
    () => (entries ?? []).filter((entry) => entry.note && entry.note !== "-"),
    [entries],
  );
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!compact) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [compact, noteEntries.length]);

  return (
    <div className="min-w-0 self-start rounded-[18px] border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.94))] px-4 py-4 shadow-[0_14px_34px_rgba(16,185,129,0.08)]">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
          <ListChecks className="h-3.5 w-3.5" />
        </span>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">{title}</p>
      </div>
      {noteEntries.length ? (
        <div ref={scrollRef} className={cn("mt-3 space-y-0 overflow-y-auto pr-1", compact ? "max-h-[126px]" : "max-h-44")}>
          {noteEntries.map((entry, index) => (
            <div key={entry.id} className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-3 pb-3 last:pb-0">
              <div className="relative flex justify-center">
                <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                {index !== noteEntries.length - 1 ? <span className="absolute top-5 bottom-0 w-px bg-emerald-200" /> : null}
              </div>
              <div className="rounded-xl border border-white/90 bg-white/88 px-3 py-2.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">{entry.stepLabel}</p>
                  <p className="text-[10px] font-semibold text-emerald-800/80">{entry.createdAtLabel}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700">{entry.note}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] leading-5 text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );
}

function TaskNoteHistoryPanel({
  note,
  entries,
  compact = false,
}: {
  note?: string | null;
  entries?: WorkStepNote[];
  compact?: boolean;
}) {
  const taskNote = meaningfulTaskText(note);
  const noteEntries = (entries ?? []).filter((entry) => entry.note && entry.note !== "-");
  const combinedEntries = [
    ...(taskNote ? [{
      id: "task-note",
      stepLabel: "Task Note",
      note: taskNote,
      createdAtLabel: "Saved note",
      actorName: null,
      source: "TASK" as const,
    }] : []),
    ...noteEntries,
  ];

  if (!combinedEntries.length) return null;

  return (
    <div className="min-w-0 self-start rounded-[18px] border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.92))] px-4 py-4 shadow-[0_10px_28px_rgba(16,185,129,0.08)]">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Notes History</p>
      <div className={cn("mt-2 space-y-1.5", compact ? "max-h-36 overflow-y-auto pr-1" : "max-h-44 overflow-y-auto pr-1")}>
        {combinedEntries.map((entry, index) => (
          <div key={`${entry.id}-${index}`} className="rounded-xl border border-white/90 bg-white/85 px-3 py-2.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">{entry.stepLabel}</p>
              <p className="text-[10px] font-semibold text-emerald-800/80">{entry.createdAtLabel}</p>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700">{entry.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-4">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="break-words text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function CustomerOverviewItem({
  title,
  meta,
  note,
  badge,
}: {
  title: string;
  meta: string;
  note: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-black text-slate-900">{title}</p>
          {badge}
        </div>
        <p className="text-xs font-bold text-slate-500">{meta}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  );
}

function CustomerOverviewEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-center">
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function customerJourneyStepTone(step: CustomerJourneySummary["steps"][number]) {
  if (step.state === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_12px_30px_rgba(16,185,129,0.12)]";
  if (step.state === "failed") return "border-red-200 bg-red-50 text-red-700 shadow-[0_12px_30px_rgba(239,68,68,0.10)]";
  if (step.state === "current") return "border-blue-200 bg-blue-50 text-blue-700 shadow-[0_12px_30px_rgba(59,130,246,0.12)]";
  if (step.state === "completed") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  return "border-slate-200 bg-white text-slate-500";
}

function customerJourneyStepBadgeVariant(step: CustomerJourneySummary["steps"][number]) {
  if (step.state === "success") return "success" as const;
  if (step.state === "failed") return "danger" as const;
  if (step.state === "current") return "default" as const;
  if (step.state === "completed") return "violet" as const;
  return "neutral" as const;
}

function customerJourneyStatusVariant(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("won") || normalized.includes("completed")) return "success" as const;
  if (normalized.includes("failed") || normalized.includes("lost") || normalized.includes("overdue")) return "danger" as const;
  if (normalized.includes("follow-up") || normalized.includes("due") || normalized.includes("upcoming")) return "warning" as const;
  if (normalized.includes("no activity")) return "neutral" as const;
  return "default" as const;
}

function CustomerJourneyStepIcon({ stageKey }: { stageKey: CustomerJourneySummary["steps"][number]["key"] }) {
  if (stageKey === "task_created") return <CheckCircle2 className="h-4 w-4" />;
  if (stageKey === "contacted") return <PhoneCall className="h-4 w-4" />;
  if (stageKey === "follow_up") return <RefreshCw className="h-4 w-4" />;
  if (stageKey === "demo") return <Eye className="h-4 w-4" />;
  if (stageKey === "quotation") return <FileText className="h-4 w-4" />;
  if (stageKey === "sales_won") return <Award className="h-4 w-4" />;
  return <XCircle className="h-4 w-4" />;
}

function CustomerOverviewSummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className={cn("mt-1 text-sm font-semibold text-slate-900", muted && "text-slate-500")}>{value}</div>
    </div>
  );
}

function readRawValue(raw: Record<string, unknown>, candidates: string[]) {
  for (const key of candidates) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text && text !== "-") return text;
  }

  const normalizeKey = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\s*\/\s*/g, " / ").toLowerCase();
  const normalized = new Map<string, unknown>();
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    normalized.set(normalizeKey(rawKey), rawValue);
  }

  for (const key of candidates) {
    const found = normalized.get(normalizeKey(key));
    if (found === undefined || found === null) continue;
    const text = String(found).trim();
    if (text && text !== "-") return text;
  }

  return undefined;
}

function readTemplateField(raw: Record<string, unknown>, candidates: string[]) {
  return readRawValue(raw, candidates) || "";
}

function toDisplayValue(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized && normalized !== "-" ? normalized : "";
}

function parseTemplateRawData(rawData: CompanyRow["rawData"] | string | unknown) {
  if (!rawData) return {};
  if (typeof rawData === "string") {
    try {
      const parsed = JSON.parse(rawData) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  if (typeof rawData === "object" && !Array.isArray(rawData)) {
    return rawData as Record<string, unknown>;
  }

  return {};
}

type CustomerCommunicationShortcutMethod = "CALL" | "WHATSAPP" | "EMAIL";

function cleanCustomerContactValue(value?: string | null) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized && normalized !== "-" ? normalized : "";
}

function normalizeDialPhone(value?: string | null) {
  const raw = cleanCustomerContactValue(value);
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;

  if (raw.startsWith("+") || digits.startsWith("880")) {
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `+88${digits}`;
  }

  return digits;
}

function normalizeWhatsAppPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("880")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `88${digits}`;
  return digits;
}

function normalizeEmailAddress(value?: string | null) {
  const email = cleanCustomerContactValue(value).toLowerCase();
  if (!email) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M19.1 4.9A9.86 9.86 0 0 0 12.05 2C6.56 2 2.1 6.46 2.1 11.95c0 1.76.46 3.48 1.33 5L2 22l5.2-1.37a9.9 9.9 0 0 0 4.75 1.21h.01c5.49 0 9.95-4.46 9.95-9.95a9.88 9.88 0 0 0-2.81-6.99Zm-7.14 15.27h-.01a8.23 8.23 0 0 1-4.18-1.14l-.3-.18-3.09.81.83-3.01-.2-.31a8.23 8.23 0 0 1-1.27-4.39c0-4.55 3.7-8.25 8.25-8.25 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.42 5.83c0 4.55-3.7 8.25-8.24 8.25Zm4.53-6.18c-.25-.12-1.49-.73-1.72-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.28.19-.53.07-.25-.12-1.04-.38-1.99-1.22-.74-.66-1.24-1.47-1.39-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.28.37-.42.12-.14.16-.25.25-.42.08-.16.04-.31-.02-.43-.07-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.68 2.56 4.08 3.59.57.25 1.02.39 1.37.5.58.18 1.1.15 1.52.09.46-.07 1.49-.61 1.7-1.2.21-.59.21-1.1.14-1.2-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

export function InlineContactShortcuts({
  phone,
  whatsapp,
  compact = false,
  className,
}: {
  phone?: string | null;
  whatsapp?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const callPhone = normalizeDialPhone(phone);
  const whatsappPhone = normalizeWhatsAppPhone(whatsapp || phone);
  const callHref = callPhone ? `tel:${callPhone}` : undefined;
  const whatsappHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent("Hello, this is Mugnee CRM regarding your inquiry.")}`
    : undefined;
  const size = compact ? "sm" : "md";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <a
        href={callHref ?? "#"}
        aria-disabled={!callHref}
        onClick={(event) => {
          event.stopPropagation();
          if (!callHref) event.preventDefault();
        }}
        className={cn(
          buttonVariants({ variant: "outline", size }),
          compact ? "h-8 px-2.5 text-xs" : "",
          callHref && "border-blue-200 bg-blue-50/70 text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800",
          !callHref && "cursor-not-allowed border-slate-200 bg-white text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-400",
        )}
        title={callHref ? "Call" : "Valid phone not found"}
      >
        <PhoneCall className="h-4 w-4" />
        {!compact ? "Call" : null}
      </a>
      <a
        href={whatsappHref ?? "#"}
        target={whatsappHref ? "_blank" : undefined}
        rel={whatsappHref ? "noopener noreferrer" : undefined}
        aria-disabled={!whatsappHref}
        onClick={(event) => {
          event.stopPropagation();
          if (!whatsappHref) event.preventDefault();
        }}
        className={cn(
          buttonVariants({ variant: "outline", size }),
          compact ? "h-8 px-2.5 text-xs" : "",
          whatsappHref && "border-emerald-200 bg-emerald-50/80 text-emerald-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800",
          !whatsappHref && "cursor-not-allowed border-slate-200 bg-white text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-400",
        )}
        title={whatsappHref ? "WhatsApp" : "Valid WhatsApp number not found"}
      >
        <WhatsAppIcon className="h-4 w-4" />
        {!compact ? "WhatsApp" : null}
      </a>
    </div>
  );
}

function prependUniqueById<T extends { id: string }>(rows: T[], nextRow: T) {
  return rows.some((row) => row.id === nextRow.id) ? rows : [nextRow, ...rows];
}

function Timeline({ rows }: { rows: CrmWorkspace["activities"] }) {
  const visibleRows = rows.slice(0, 10);

  return (
    <div className="space-y-4">
      {visibleRows.length ? visibleRows.map((item, index) => (
        <div key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700">{index + 1}</span>
            {index < visibleRows.length - 1 ? <span className="h-10 w-px bg-slate-200" /> : null}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              <EntityLink href={item.href} className="font-bold">{item.title}</EntityLink>
            </p>
            <p className="text-xs text-slate-500">{item.detail} - {item.time}</p>
          </div>
        </div>
      )) : <EmptyState title="No timeline yet" description="Customer communication and CRM activities will appear here." />}
    </div>
  );
}

function TaskHistoryList({ rows }: { rows: TaskRow[] }) {
  return rows.length ? (
    <div className="space-y-3">
      {rows.map((task) => (
        <div key={task.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <EntityLink href={task.href} className="text-sm font-black text-slate-900">{task.title}</EntityLink>
            <StatusBadge value={task.status} />
            <StatusBadge value={task.priority} />
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{task.dueDate} {task.time} - Assigned by {task.assignedBy}</p>
          {task.description !== "-" ? <p className="mt-1 text-xs text-slate-500">{task.description}</p> : null}
        </div>
      ))}
    </div>
  ) : <EmptyState title="No task history" description="Customer-related task history will appear here." />;
}

function FollowUpHistoryList({ rows }: { rows: FollowUpRow[] }) {
  return rows.length ? (
    <div className="space-y-3">
      {rows.map((followUp) => (
        <div key={followUp.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <EntityLink href={followUp.href} className="text-sm font-black text-slate-900">{followUp.customer}</EntityLink>
            <StatusBadge value={followUp.status} />
            <StatusBadge value={followUp.priority} />
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{followUp.followUpDate} - {followUp.method} - {followUp.assignedTo}</p>
          {followUp.note !== "-" ? <p className="mt-1 text-xs text-slate-500">{followUp.note}</p> : null}
          {followUp.nextDiscussionPlan !== "-" ? <p className="mt-1 text-[11px] font-semibold text-slate-500">Next: {followUp.nextDiscussionPlan}</p> : null}
        </div>
      ))}
    </div>
  ) : <EmptyState title="No follow-up history" description="Customer follow-up records will appear here." />;
}

function CommunicationHistoryList({ rows }: { rows: CommunicationHistoryRow[] }) {
  return rows.length ? (
    <div className="space-y-3">
      {rows.map((item) => {
        const isEmail = item.method.toLowerCase() === "email";

        return (
          <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <EntityLink href={item.href} className="text-sm font-black text-slate-900">{item.method}</EntityLink>
              <StatusBadge value={item.outcome} />
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">{item.time} - {item.createdBy}</p>
            {isEmail ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                  {item.fromEmail !== "-" ? <span>From: {item.fromEmail}</span> : null}
                  {item.toEmail !== "-" ? <span>To: {item.toEmail}</span> : null}
                </div>
                {item.subject !== "-" ? <p className="mt-1 text-xs font-semibold text-slate-600">Subject: {item.subject}</p> : null}
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.summary}</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-500">{item.summary}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
              {!isEmail && item.discussionTopic !== "-" ? <span>Topic: {item.discussionTopic}</span> : null}
              {!isEmail && item.productDiscussed !== "-" ? <span>Product: {item.productDiscussed}</span> : null}
              {item.rating !== "-" ? <span>Rating: {item.rating}</span> : null}
              {item.nextFollowUpDate !== "-" ? <span>Next Follow-up: {item.nextFollowUpDate}</span> : null}
            </div>
            {!isEmail && item.notes !== "-" ? <p className="mt-2 text-[11px] text-slate-500">Notes: {item.notes}</p> : null}
          </div>
        );
      })}
    </div>
  ) : <EmptyState title="No communication history" description="Task and customer conversation logs will appear here." />;
}

function CommunicationSummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
  accentColor,
  tooltip,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof Phone;
  iconBg: string;
  iconColor: string;
  valueColor: string;
  accentColor: string;
  tooltip?: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18, ease: "easeOut" }} className="h-full">
      <Card
        className="relative h-full overflow-hidden rounded-[16px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
        title={tooltip ?? subtitle}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1.5", accentColor)} />
        <div className="flex items-start gap-4">
          <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", iconBg, iconColor)}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <p className={cn("text-sm font-bold", valueColor)}>{title}</p>
            <p className={cn("mt-3 text-4xl font-black leading-none", valueColor)}>{value}</p>
            {subtitle ? <p className="mt-2 text-xs font-medium text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

type CommunicationDateRange = "today" | "thisWeek" | "thisMonth" | "custom";
type CommunicationActivityFilter = "ALL" | "CALL" | "WHATSAPP" | "EMAIL" | "MEETING" | "FOLLOW_UP" | "QUOTATION" | "LEAD";

const COMMUNICATION_DATE_RANGE_OPTIONS: Array<{ value: CommunicationDateRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "thisWeek", label: "This Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "custom", label: "Custom" },
];

const COMMUNICATION_ACTIVITY_FILTER_OPTIONS: Array<{ value: CommunicationActivityFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "QUOTATION", label: "Quotation" },
  { value: "LEAD", label: "Lead Converted" },
];

function hasActivityText(value?: string | null) {
  return Boolean(value && value.trim() && value.trim() !== "-");
}

function matchesCommunicationDateRange({
  createdAtValue,
  preset,
  customStart,
  customEnd,
}: {
  createdAtValue?: string;
  preset: CommunicationDateRange;
  customStart: string;
  customEnd: string;
}) {
  if (!createdAtValue) return preset !== "custom" || (!customStart && !customEnd);
  const createdAt = new Date(createdAtValue);
  if (Number.isNaN(createdAt.getTime())) return false;

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  if (preset === "today") {
    return createdAt >= startOfToday && createdAt < endOfToday;
  }

  if (preset === "thisWeek") {
    const day = startOfToday.getDay();
    const offset = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - offset);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    return createdAt >= startOfWeek && createdAt < endOfWeek;
  }

  if (preset === "thisMonth") {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return createdAt >= startOfMonth && createdAt < endOfMonth;
  }

  const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
  const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;

  if (start && Number.isNaN(start.getTime())) return false;
  if (end && Number.isNaN(end.getTime())) return false;
  if (start && createdAt < start) return false;
  if (end && createdAt > end) return false;
  return true;
}

function communicationActivityVisual(activity: CrmWorkspace["activities"][number]) {
  switch (activity.category) {
    case "EMAIL":
      return { icon: Mail, iconWrap: "bg-blue-100", iconColor: "text-blue-700", badge: "border-blue-200 bg-blue-50 text-blue-700" };
    case "WHATSAPP":
      return { icon: MessageSquare, iconWrap: "bg-green-100", iconColor: "text-green-700", badge: "border-green-200 bg-green-50 text-green-700" };
    case "CALL":
      return { icon: Phone, iconWrap: "bg-violet-100", iconColor: "text-violet-700", badge: "border-violet-200 bg-violet-50 text-violet-700" };
    case "FOLLOW_UP":
      return { icon: Check, iconWrap: "bg-orange-100", iconColor: "text-orange-700", badge: "border-orange-200 bg-orange-50 text-orange-700" };
    case "MEETING":
      return { icon: CalendarClock, iconWrap: "bg-indigo-100", iconColor: "text-indigo-700", badge: "border-indigo-200 bg-indigo-50 text-indigo-700" };
    case "QUOTATION":
      return { icon: FileText, iconWrap: "bg-teal-100", iconColor: "text-teal-700", badge: "border-teal-200 bg-teal-50 text-teal-700" };
    case "LEAD":
      return { icon: Target, iconWrap: "bg-cyan-100", iconColor: "text-cyan-700", badge: "border-cyan-200 bg-cyan-50 text-cyan-700" };
    default:
      return { icon: SlidersHorizontal, iconWrap: "bg-slate-100", iconColor: "text-slate-700", badge: "border-slate-200 bg-slate-50 text-slate-700" };
  }
}

function CommunicationActivityDetail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function CommunicationActivityTimelineItem({
  activity,
  expanded,
  onToggle,
  index,
}: {
  activity: CrmWorkspace["activities"][number];
  expanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const visual = communicationActivityVisual(activity);
  const Icon = visual.icon;
  const discussionSummary = hasActivityText(activity.discussionSummary)
    ? activity.discussionSummary
    : hasActivityText(activity.notes)
      ? activity.notes
      : "";

  const detailRows: Array<{ label: string; value: React.ReactNode }> = [];

  if (hasActivityText(activity.rating)) detailRows.push({ label: "Rating", value: activity.rating });
  if (hasActivityText(activity.contactMethod)) detailRows.push({ label: "Contact Method", value: activity.contactMethod });
  if (hasActivityText(activity.phoneOrEmailUsed)) detailRows.push({ label: "Phone / Email Used", value: activity.phoneOrEmailUsed });
  if (hasActivityText(activity.nextFollowUpDate)) detailRows.push({ label: "Next Follow-up Date", value: activity.nextFollowUpDate });
  if (hasActivityText(activity.quotationReference)) detailRows.push({ label: "Quotation Reference", value: activity.quotationReference });
  if (hasActivityText(activity.meetingDateTime)) detailRows.push({ label: "Meeting Date / Time", value: activity.meetingDateTime });
  if (hasActivityText(activity.createdBy)) detailRows.push({ label: "Created By", value: activity.createdBy });
  if (hasActivityText(activity.customerName)) {
    detailRows.push({
      label: "Related Customer",
      value: <EntityLink href={activity.relatedCustomerHref ?? activity.customerHref} className="font-semibold" stopPropagation>{activity.customerName}</EntityLink>,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.18), ease: "easeOut" }}
      className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition hover:border-slate-300 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)]"
    >
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", visual.iconWrap, visual.iconColor)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-black text-slate-950">
                  <EntityLink href={activity.href} className="font-black" stopPropagation>{activity.title}</EntityLink>
                </p>
                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[0.12em]", visual.badge)}>
                  {activity.badgeLabel ?? "ACTIVITY"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                <span>
                  <span className="font-semibold text-slate-500">Customer:</span>{" "}
                  <EntityLink href={activity.customerHref ?? activity.relatedCustomerHref} className="font-semibold" stopPropagation>{activity.customerName ?? "-"}</EntityLink>
                </span>
                <span>
                  <span className="font-semibold text-slate-500">Employee:</span> {activity.employeeName ?? "-"}
                </span>
              </div>
              {hasActivityText(activity.detail) && activity.detail !== activity.customerName && activity.detail !== `${activity.customerName} · ${activity.employeeName}` ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">{activity.detail}</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 lg:justify-end">
            <div className="text-left lg:text-right">
              <p className="text-sm font-semibold text-slate-700">{activity.dateLabel ?? "-"}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">{activity.timeLabel ?? activity.time}</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
            </span>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="space-y-4 p-5 pt-4">
              {discussionSummary ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Notes / Discussion Summary</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{discussionSummary}</p>
                </div>
              ) : null}
              {detailRows.length ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {detailRows.map((detail) => <CommunicationActivityDetail key={detail.label} label={detail.label} value={detail.value} />)}
                </div>
              ) : !discussionSummary ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-500">
                  No additional details available.
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

type LeadFormValues = {
  customerName: string;
  companyId: string;
  phoneNumbers: string[];
  emails: string[];
  productInterestId: string;
  assignedToId: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  score: string;
  purchaseProbability: string;
  followUpDate: string;
  notes: string;
};

const EMPTY_LEAD_FORM_VALUES: LeadFormValues = {
  customerName: "",
  companyId: "",
  phoneNumbers: [""],
  emails: [""],
  productInterestId: "",
  assignedToId: "",
  priority: "MEDIUM",
  score: "10",
  purchaseProbability: "10",
  followUpDate: "",
  notes: "",
};

function toDateTimeLocalValue(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function toLeadFormValues(lead?: LeadRow | null): LeadFormValues {
  if (!lead) return EMPTY_LEAD_FORM_VALUES;

  return {
    customerName: lead.customerName ?? lead.title ?? "",
    companyId: lead.companyId ?? "",
    phoneNumbers: lead.phones.length ? lead.phones : [lead.phone !== "-" ? lead.phone : ""],
    emails: lead.emails.length ? lead.emails : [lead.email !== "-" ? lead.email : ""],
    productInterestId: lead.productInterestId ?? "",
    assignedToId: lead.assignedToId ?? "",
    priority: lead.priority.toUpperCase() === "LOW" || lead.priority.toUpperCase() === "HIGH" || lead.priority.toUpperCase() === "URGENT" ? lead.priority.toUpperCase() as LeadFormValues["priority"] : "MEDIUM",
    score: String(lead.score ?? 0),
    purchaseProbability: String(lead.purchaseProbability ?? 0),
    followUpDate: toDateTimeLocalValue(lead.followUpDateValue),
    notes: lead.notes !== "-" ? lead.notes : "",
  };
}

function LeadForm({
  workspace,
  lead,
  onSuccess,
  onDone,
}: {
  workspace: CrmWorkspace;
  lead?: LeadRow | null;
  onSuccess?: (row: LeadRow) => void;
  onDone: () => void;
}) {
  const viewerRole = workspace.user.role;
  const [values, setValues] = React.useState<LeadFormValues>(() => toLeadFormValues(lead));
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    setValues(toLeadFormValues(lead));
    setMessage("");
  }, [lead]);

  const updateValue = React.useCallback((field: keyof LeadFormValues, nextValue: string) => {
    setValues((current) => ({ ...current, [field]: nextValue }));
  }, []);

  const updateListValue = React.useCallback((field: "phoneNumbers" | "emails", index: number, nextValue: string) => {
    setValues((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => (itemIndex === index ? nextValue : item)),
    }));
  }, []);

  const addListValue = React.useCallback((field: "phoneNumbers" | "emails") => {
    setValues((current) => ({ ...current, [field]: [...current[field], ""] }));
  }, []);

  const removeListValue = React.useCallback((field: "phoneNumbers" | "emails", index: number) => {
    setValues((current) => {
      const next = current[field].filter((_, itemIndex) => itemIndex !== index);
      return { ...current, [field]: next.length ? next : [""] };
    });
  }, []);

  const companyOptions = React.useMemo(() => workspace.companies.map((item) => ({ value: item.id, label: item.name })), [workspace.companies]);
  const marketers = React.useMemo(() => workspace.employees.filter((item) => item.role === "Marketer"), [workspace.employees]);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setMessage("");
          try {
            const payload = {
              customerName: values.customerName,
              companyId: values.companyId,
              phoneNumbers: values.phoneNumbers,
              emails: values.emails,
              productInterestId: values.productInterestId,
              assignedToId: viewerRole === "MARKETER" ? workspace.user.id : (values.assignedToId || undefined),
              priority: values.priority,
              score: Number(values.score),
              purchaseProbability: Number(values.purchaseProbability),
              followUpDate: values.followUpDate ? new Date(values.followUpDate).toISOString() : null,
              notes: values.notes,
            };

            const response = await fetch(lead ? `/api/leads/${lead.id}` : "/api/leads", {
              method: lead ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok || !result.success || !result.row) {
              setMessage(result.message ?? "Lead save failed.");
              return;
            }

            onSuccess?.(result.row as LeadRow);
            onDone();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Lead save failed.");
          }
        });
      }}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-black text-slate-900">Customer Information</h3>
        <p className="text-xs text-slate-500">Use company and product interest to build the lead record.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Customer Name</span>
          <Input value={values.customerName} onChange={(event) => updateValue("customerName", event.target.value)} required className="h-10" />
        </label>
        <div>
          <SearchableEntitySelect
            label="Company"
            options={companyOptions}
            value={values.companyId}
            onValueChange={(nextValue) => updateValue("companyId", nextValue)}
            placeholder="Search company"
          />
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-black text-slate-900">Contact Information</h3>
        <p className="text-xs text-slate-500">Add one or more phone numbers and email addresses.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Phone Numbers</span>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => addListValue("phoneNumbers")}>
              <Plus className="h-3.5 w-3.5" />
              Add Number
            </Button>
          </div>
          {values.phoneNumbers.map((phone, index) => (
            <div key={`lead-phone-${index}`} className="flex items-center gap-2">
              <Input value={phone} onChange={(event) => updateListValue("phoneNumbers", index, event.target.value)} placeholder={index === 0 ? "Primary phone" : "Additional phone"} className="h-10" />
              {values.phoneNumbers.length > 1 ? (
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeListValue("phoneNumbers", index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Email Addresses</span>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => addListValue("emails")}>
              <Plus className="h-3.5 w-3.5" />
              Add Email
            </Button>
          </div>
          {values.emails.map((email, index) => (
            <div key={`lead-email-${index}`} className="flex items-center gap-2">
              <Input value={email} onChange={(event) => updateListValue("emails", index, event.target.value)} placeholder={index === 0 ? "Primary email" : "Additional email"} className="h-10" />
              {values.emails.length > 1 ? (
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => removeListValue("emails", index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-black text-slate-900">Lead Details</h3>
        <p className="text-xs text-slate-500">Capture ownership, product interest, and scoring.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Interested Product</span>
          <select value={values.productInterestId} onChange={(event) => updateValue("productInterestId", event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
            <EntityOptions workspace={workspace} type="products" />
          </select>
        </label>
        {viewerRole !== "MARKETER" ? (
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Assigned Marketer</span>
            <select value={values.assignedToId} onChange={(event) => updateValue("assignedToId", event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
              <option value="">Select marketer</option>
              {marketers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Priority</span>
          <select value={values.priority} onChange={(event) => updateValue("priority", event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Important</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Lead Score</span>
          <Input value={values.score} type="number" onChange={(event) => updateValue("score", event.target.value)} className="h-10" />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Probability %</span>
          <Input value={values.purchaseProbability} type="number" onChange={(event) => updateValue("purchaseProbability", event.target.value)} className="h-10" />
        </label>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-black text-slate-900">Follow-up & Notes</h3>
        <p className="text-xs text-slate-500">Add optional follow-up timing and context.</p>
      </div>
      <label className="space-y-1.5">
        <span className="text-sm font-semibold text-slate-700">Follow-up Date</span>
        <Input value={values.followUpDate} type="datetime-local" onChange={(event) => updateValue("followUpDate", event.target.value)} className="h-10" />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-semibold text-slate-700">Notes</span>
        <textarea value={values.notes} onChange={(event) => updateValue("notes", event.target.value)} className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100" />
      </label>
      {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
      <div className="flex gap-2">
        <Button className="flex-1" disabled={pending} type="submit">
          {pending ? "Saving..." : lead ? "Update Lead" : "Save Lead"}
        </Button>
        <Button type="button" variant="outline" className="flex-1" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TaskForm({ workspace, onDone }: { workspace: CrmWorkspace; onDone: () => void }) {
  const role = workspace.user.role;
  const assigneeOptions = React.useMemo(() => getAssignableUserOptions(workspace, role, "task"), [role, workspace]);
  const defaultAssigneeId = role === "SUPERVISOR" ? (workspace.user.id ?? "") : "";

  return (
    <ActionForm
      action={createTaskAction}
      onDone={onDone}
      submitLabel="Save Task"
      className="flex h-full flex-col"
      bodyClassName="space-y-3"
      footerClassName="mt-auto border-t border-slate-100 pt-3"
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextField label="Task Title" name="title" compact />
        <SelectBox label="Assign To" name="assignedToId" compact defaultValue={defaultAssigneeId}>
          <option value="">Select assignee</option>
          {assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </SelectBox>
        <TextField label="Company Name" name="companyName" compact />
        <TextField label="Lead Name" name="leadName" compact />
        <SelectBox label="Related Product" name="productId" compact><EntityOptions workspace={workspace} type="products" /></SelectBox>
        <SelectBox label="Priority" name="priority" compact><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></SelectBox>
        <TextField label="Due Date" name="dueDate" type="date" compact />
        <SelectBox label="Status" name="status" compact><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option></SelectBox>
        <TextField label="Time" name="taskTime" type="datetime-local" compact />
        <TextField label="Reminder" name="reminder" placeholder="1 hour before" compact />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextAreaField label="Task Description" name="description" compact />
        <TextAreaField label="Notes" name="notes" compact />
      </div>
    </ActionForm>
  );
}

function CommunicationForm({ workspace, onDone }: { workspace: CrmWorkspace; onDone: () => void }) {
  return (
    <ActionForm action={createCommunicationAction} onDone={onDone} submitLabel="Save Communication">
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectBox label="Customer / Company" name="companyId"><EntityOptions workspace={workspace} type="companies" /></SelectBox>
        <SelectBox label="Lead" name="leadId"><EntityOptions workspace={workspace} type="leads" /></SelectBox>
        <SelectBox label="Communication Type" name="method"><option>Phone Call</option><option>WhatsApp</option><option>Email</option><option>Physical Visit</option><option>Meeting</option></SelectBox>
        <TextField label="Date & Time" name="communicationAt" type="datetime-local" />
        <input type="hidden" name="communicationAtTzOffset" value={new Date().getTimezoneOffset().toString()} />
      </div>
      <TextAreaField label="Notes / Discussion" name="note" />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Outcome" name="outcome" />
        <TextField label="Rating / Lead Score" name="rating" type="number" />
        <TextField label="Next Follow-up Date" name="nextFollowUpDate" type="date" />
        <TextField label="Next Follow-up Time" name="nextFollowUpTime" type="time" />
        <input type="hidden" name="nextFollowUpDateTzOffset" value={new Date().getTimezoneOffset().toString()} />
      </div>
      <TextAreaField label="Next Follow-up Note" name="followUpNote" />
    </ActionForm>
  );
}

function FollowUpForm({ workspace, onDone }: { workspace: CrmWorkspace; onDone: () => void }) {
  return (
    <ActionForm action={createFollowUpAction} onDone={onDone} submitLabel="Save Follow-up">
      <div className="grid gap-3 sm:grid-cols-2">
        <SearchableEntitySelect
          label="Customer / Company"
          name="companyId"
          options={[]}
          searchScope="companies"
          placeholder="Search customer"
        />
        <SelectBox label="Method" name="method"><option>Phone Call</option><option>WhatsApp</option><option>Email</option><option>Physical Visit</option><option>Meeting</option></SelectBox>
      </div>
      <TextField label="Follow-up Date" name="followUpDate" type="date" defaultValue={dateTimeLocalValue().slice(0, 10)} />
      <TextField label="Follow-up Time" name="followUpTime" type="time" defaultValue="10:00" />
      <input type="hidden" name="followUpDateTzOffset" value={new Date().getTimezoneOffset().toString()} />
      <TextAreaField label="Follow-up Note" name="note" />
    </ActionForm>
  );
}

const BANGLADESH_DISTRICTS = [
  "Bagerhat",
  "Bandarban",
  "Barguna",
  "Barishal",
  "Bhola",
  "Bogura",
  "Brahmanbaria",
  "Chandpur",
  "Chattogram",
  "Chuadanga",
  "Cox's Bazar",
  "Cumilla",
  "Dhaka",
  "Dinajpur",
  "Faridpur",
  "Feni",
  "Gaibandha",
  "Gazipur",
  "Gopalganj",
  "Habiganj",
  "Jamalpur",
  "Jashore",
  "Jhalokati",
  "Jhenaidah",
  "Joypurhat",
  "Khagrachhari",
  "Khulna",
  "Kishoreganj",
  "Kurigram",
  "Kushtia",
  "Lakshmipur",
  "Lalmonirhat",
  "Madaripur",
  "Magura",
  "Manikganj",
  "Meherpur",
  "Moulvibazar",
  "Munshiganj",
  "Mymensingh",
  "Naogaon",
  "Narail",
  "Narayanganj",
  "Narsingdi",
  "Natore",
  "Nawabganj",
  "Netrakona",
  "Nilphamari",
  "Noakhali",
  "Pabna",
  "Panchagarh",
  "Patuakhali",
  "Pirojpur",
  "Rajbari",
  "Rajshahi",
  "Rangamati",
  "Rangpur",
  "Satkhira",
  "Shariatpur",
  "Sherpur",
  "Sirajganj",
  "Sunamganj",
  "Sylhet",
  "Tangail",
  "Thakurgaon",
] as const;

const DEFAULT_CUSTOMER_INDUSTRIES = [
  "Education",
  "Madrasha",
  "School",
  "College",
  "University",
  "Software",
  "IT Services",
  "Retail",
  "Wholesale",
  "Manufacturing",
  "Trading",
  "Healthcare",
  "Hospital",
  "Pharmacy",
  "Banking",
  "NGO",
  "Government",
  "Real Estate",
  "Construction",
  "Logistics",
  "Telecom",
] as const;

type CustomerContactDraft = {
  name: string;
  designation: string;
  department: string;
  phones: string[];
  emails: string[];
};

function createEmptyCustomerContact(): CustomerContactDraft {
  return {
    name: "",
    designation: "",
    department: "",
    phones: [""],
    emails: [""],
  };
}

function CustomerForm({
  workspace,
  onDone,
  productId,
  submitLabel = "Save Customer",
}: {
  workspace: CrmWorkspace;
  onDone: () => void;
  productId?: string;
  submitLabel?: string;
}) {
  const ownerOptions = React.useMemo(() => getCustomerOwnerOptions(workspace, workspace.user.role), [workspace]);
  const industryListId = React.useId();
  const industryOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];

    for (const option of DEFAULT_CUSTOMER_INDUSTRIES) {
      const normalized = cleanCustomerContactValue(option);
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) continue;
      seen.add(key);
      options.push(normalized);
    }

    const workspaceIndustries = workspace.companies
      .map((company) => cleanCustomerContactValue(company.industry))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    for (const option of workspaceIndustries) {
      const key = option.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(option);
    }

    return options;
  }, [workspace.companies]);
  const [phones, setPhones] = React.useState<string[]>([""]);
  const [emails, setEmails] = React.useState<string[]>([""]);
  const [contacts, setContacts] = React.useState<CustomerContactDraft[]>([createEmptyCustomerContact()]);
  const [showContacts, setShowContacts] = React.useState(false);

  const resetDynamic = React.useCallback(() => {
    setPhones([""]);
    setEmails([""]);
    setContacts([createEmptyCustomerContact()]);
    setShowContacts(false);
  }, []);

  const updateListValue = React.useCallback((list: string[], index: number, value: string) => {
    const next = [...list];
    next[index] = value;
    return next;
  }, []);
  const removeContactAt = React.useCallback((index: number) => {
    setContacts((current) => {
      if (current.length <= 1) {
        setShowContacts(false);
        return [createEmptyCustomerContact()];
      }
      return current.filter((_, idx) => idx !== index);
    });
  }, []);
  const hasContactDetails = React.useMemo(
    () => contacts.some((contact) => (
      Boolean(contact.name.trim())
      || Boolean(contact.designation.trim())
      || Boolean(contact.department.trim())
      || contact.phones.some((phone) => Boolean(phone.trim()))
      || contact.emails.some((email) => Boolean(email.trim()))
    )),
    [contacts],
  );

  const primaryContact = contacts[0] ?? createEmptyCustomerContact();
  const secondaryContact = contacts[1] ?? null;

  return (
    <ActionForm
      action={createCustomerAction}
      onDone={() => {
        resetDynamic();
        onDone();
      }}
      submitLabel={submitLabel}
    >
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Industry</span>
          <Input
            name="industry"
            list={industryListId}
            placeholder="Type or choose industry"
            className="h-10 px-3 text-[13px]"
          />
        </label>
        <TextField label="Company Name" name="companyName" required />
        <SelectBox label="City / Zilla" name="cityOrZilla">
          <option value="">Select district</option>
          {BANGLADESH_DISTRICTS.map((district) => (
            <option key={district} value={district}>{district}</option>
          ))}
        </SelectBox>
        <TextAreaField label="Address" name="address" />

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Phone Numbers</p>
          <div className="space-y-2">
            {phones.map((value, index) => (
              <div key={`phone-${index}`} className="flex items-center gap-2">
                <Input
                  name="phoneNumbers"
                  value={value}
                  onChange={(event) => setPhones((current) => updateListValue(current, index, event.target.value))}
                  placeholder={index === 0 ? "Primary phone" : `Phone ${index + 1}`}
                  className="h-10 px-3 text-[13px]"
                />
                {phones.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPhones((current) => current.filter((_, idx) => idx !== index))}
                    aria-label="Remove phone"
                    className="h-10 w-10 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPhones((current) => [...current, ""])}>
            <Plus className="h-4 w-4" />
            Add phone
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Email Addresses</p>
          <div className="space-y-2">
            {emails.map((value, index) => (
              <div key={`email-${index}`} className="flex items-center gap-2">
                <Input
                  name="emailAddresses"
                  value={value}
                  onChange={(event) => setEmails((current) => updateListValue(current, index, event.target.value))}
                  placeholder={index === 0 ? "Primary email" : `Email ${index + 1}`}
                  className="h-10 px-3 text-[13px]"
                />
                {emails.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEmails((current) => current.filter((_, idx) => idx !== index))}
                    aria-label="Remove email"
                    className="h-10 w-10 text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setEmails((current) => [...current, ""])}>
            <Plus className="h-4 w-4" />
            Add email
          </Button>
        </div>

        <TextField label="Website" name="website" />
        <TextAreaField label="Note" name="note" />
      </div>
      <datalist id={industryListId}>
        {industryOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-sm font-black text-slate-950">Contact Person</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Optional. Add contact details only when needed.</p>
          </div>
          <Button
            type="button"
            variant={showContacts ? "outline" : "default"}
            size="sm"
            onClick={() => setShowContacts((current) => !current)}
          >
            <UserPlus className="h-4 w-4" />
            {showContacts ? "Hide Contact Persons" : hasContactDetails ? "Edit Contact Persons" : "Add Contact Person"}
          </Button>
        </div>

        <input type="hidden" name="contactsJson" value={JSON.stringify(contacts)} />

        {showContacts ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-950">Contact Persons</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setContacts((current) => [...current, createEmptyCustomerContact()])}
              >
                <Plus className="h-4 w-4" />
                Add contact
              </Button>
            </div>

            {contacts.map((contact, index) => (
              <div key={`contact-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-950">{index === 0 ? "Primary Contact" : `Contact ${index + 1}`}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeContactAt(index)}
                    className="text-slate-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    {contacts.length <= 1 ? "Clear" : "Delete"}
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">Name</span>
                    <Input
                      value={contact.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        setContacts((current) => current.map((item, idx) => idx === index ? { ...item, name: value } : item));
                      }}
                      className="h-10 px-3 text-[13px]"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">Designation</span>
                    <Input
                      value={contact.designation}
                      onChange={(event) => {
                        const value = event.target.value;
                        setContacts((current) => current.map((item, idx) => idx === index ? { ...item, designation: value } : item));
                      }}
                      className="h-10 px-3 text-[13px]"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">Department</span>
                    <Input
                      value={contact.department}
                      onChange={(event) => {
                        const value = event.target.value;
                        setContacts((current) => current.map((item, idx) => idx === index ? { ...item, department: value } : item));
                      }}
                      className="h-10 px-3 text-[13px]"
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">Phones</p>
                    <div className="space-y-2">
                      {contact.phones.map((phone, phoneIndex) => (
                        <div key={`contact-${index}-phone-${phoneIndex}`} className="flex items-center gap-2">
                          <Input
                            value={phone}
                            onChange={(event) => {
                              const value = event.target.value;
                              setContacts((current) => current.map((item, idx) => idx === index ? { ...item, phones: updateListValue(item.phones, phoneIndex, value) } : item));
                            }}
                            placeholder={phoneIndex === 0 ? "Primary phone" : `Phone ${phoneIndex + 1}`}
                            className="h-10 px-3 text-[13px]"
                          />
                          {contact.phones.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setContacts((current) => current.map((item, idx) => idx === index ? { ...item, phones: item.phones.filter((_, pIdx) => pIdx !== phoneIndex) } : item))}
                              aria-label="Remove contact phone"
                              className="h-10 w-10 text-slate-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setContacts((current) => current.map((item, idx) => idx === index ? { ...item, phones: [...item.phones, ""] } : item))}
                    >
                      <Plus className="h-4 w-4" />
                      Add phone
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">Emails</p>
                    <div className="space-y-2">
                      {contact.emails.map((email, emailIndex) => (
                        <div key={`contact-${index}-email-${emailIndex}`} className="flex items-center gap-2">
                          <Input
                            value={email}
                            onChange={(event) => {
                              const value = event.target.value;
                              setContacts((current) => current.map((item, idx) => idx === index ? { ...item, emails: updateListValue(item.emails, emailIndex, value) } : item));
                            }}
                            placeholder={emailIndex === 0 ? "Primary email" : `Email ${emailIndex + 1}`}
                            className="h-10 px-3 text-[13px]"
                          />
                          {contact.emails.length > 1 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setContacts((current) => current.map((item, idx) => idx === index ? { ...item, emails: item.emails.filter((_, eIdx) => eIdx !== emailIndex) } : item))}
                              aria-label="Remove contact email"
                              className="h-10 w-10 text-slate-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setContacts((current) => current.map((item, idx) => idx === index ? { ...item, emails: [...item.emails, ""] } : item))}
                    >
                      <Plus className="h-4 w-4" />
                      Add email
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Lead Source" name="leadSource" />
      </div>

      <input type="hidden" name="primaryPhone" value={phones[0] ?? ""} />
      <input type="hidden" name="phone2" value={phones[1] ?? ""} />
      <input type="hidden" name="phone3" value={phones[2] ?? ""} />
      <input type="hidden" name="primaryEmail" value={emails[0] ?? ""} />
      <input type="hidden" name="email2" value={emails[1] ?? ""} />

      <input type="hidden" name="contactPerson1Name" value={primaryContact.name} />
      <input type="hidden" name="designation1" value={primaryContact.designation} />
      <input type="hidden" name="department1" value={primaryContact.department} />
      <input type="hidden" name="cp1Phone1" value={primaryContact.phones[0] ?? ""} />
      <input type="hidden" name="cp1Phone2" value={primaryContact.phones[1] ?? ""} />
      <input type="hidden" name="cp1Email1" value={primaryContact.emails[0] ?? ""} />
      <input type="hidden" name="cp1Email2" value={primaryContact.emails[1] ?? ""} />

      <input type="hidden" name="contactPerson2Name" value={secondaryContact?.name ?? ""} />
      <input type="hidden" name="designation2" value={secondaryContact?.designation ?? ""} />
      <input type="hidden" name="department2" value={secondaryContact?.department ?? ""} />
      <input type="hidden" name="cp2Phone1" value={secondaryContact?.phones?.[0] ?? ""} />
      <input type="hidden" name="cp2Phone2" value={secondaryContact?.phones?.[1] ?? ""} />
      <input type="hidden" name="cp2Email1" value={secondaryContact?.emails?.[0] ?? ""} />
      <input type="hidden" name="cp2Email2" value={secondaryContact?.emails?.[1] ?? ""} />

      {workspace.user.role === "MARKETER" ? (
        <input type="hidden" name="assignedToId" value={workspace.user.id ?? ""} />
      ) : (
        <SelectBox label="Assigned Marketer" name="assignedToId">
          <option value="">Select marketer</option>
          {ownerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </SelectBox>
      )}
    </ActionForm>
  );
}

type CustomerTemplateEditValues = {
  industry: string;
  companyName: string;
  cityOrZilla: string;
  address: string;
  primaryPhone: string;
  phone2: string;
  phone3: string;
  primaryEmail: string;
  email2: string;
  website: string;
  note: string;
  contactPerson1Name: string;
  designation1: string;
  department1: string;
  cp1Phone1: string;
  cp1Phone2: string;
  cp1Email1: string;
  cp1Email2: string;
  contactPerson2Name: string;
  designation2: string;
  department2: string;
  cp2Phone1: string;
  cp2Phone2: string;
  cp2Email1: string;
  cp2Email2: string;
  leadSource: string;
  assignedToId: string;
};

const EMPTY_CUSTOMER_TEMPLATE_VALUES: CustomerTemplateEditValues = {
  industry: "",
  companyName: "",
  cityOrZilla: "",
  address: "",
  primaryPhone: "",
  phone2: "",
  phone3: "",
  primaryEmail: "",
  email2: "",
  website: "",
  note: "",
  contactPerson1Name: "",
  designation1: "",
  department1: "",
  cp1Phone1: "",
  cp1Phone2: "",
  cp1Email1: "",
  cp1Email2: "",
  contactPerson2Name: "",
  designation2: "",
  department2: "",
  cp2Phone1: "",
  cp2Phone2: "",
  cp2Email1: "",
  cp2Email2: "",
  leadSource: "",
  assignedToId: "",
};

function buildCustomerTemplateValues(customer: CompanyRow): CustomerTemplateEditValues {
  const raw = parseTemplateRawData(customer.rawData) as Record<string, unknown>;

  return {
    industry: toDisplayValue(readTemplateField(raw, ["Industry", "Business Type", "Sector"])) || toDisplayValue(customer.industry),
    companyName: customer.name || "",
    cityOrZilla: toDisplayValue(readTemplateField(raw, ["City / Zilla", "City/Zilla", "City", "Zilla"])) || toDisplayValue(customer.cityOrZilla),
    address: toDisplayValue(readTemplateField(raw, ["Address", "Company Address"])) || toDisplayValue(customer.address),
    primaryPhone: toDisplayValue(readTemplateField(raw, ["Primary Phone", "Phone", "Phone 1", "Main Phone", "Mobile"])) || toDisplayValue(customer.phone),
    phone2: toDisplayValue(readTemplateField(raw, ["Phone 2", "Secondary Phone", "Phone 2 ", "Second Phone"])) || toDisplayValue(customer.phone2),
    phone3: toDisplayValue(readTemplateField(raw, ["Phone 3", "Phone 3 ", "Tertiary Phone"])),
    primaryEmail: toDisplayValue(readTemplateField(raw, ["Primary Email", "Email", "Email 1", "Primary Email Address", "Email Address"])) || toDisplayValue(customer.email),
    email2: toDisplayValue(readTemplateField(raw, ["Email 2", "Secondary Email", "Email 2 Address"])),
    website: toDisplayValue(readTemplateField(raw, ["Website", "Web", "Web Site"])) || toDisplayValue(customer.website),
    note: toDisplayValue(readTemplateField(raw, ["Note", "Notes", "Remarks"])) || toDisplayValue(customer.notes),
    contactPerson1Name: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Name", "Contact Person Name", "Primary Contact", "Contact Person"])) || toDisplayValue(customer.contactPerson),
    designation1: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Designation", "Designation", "Contact Person Designation", "Designation 1"])),
    department1: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Department", "Department", "Department 1", "Contact Person Department"])),
    cp1Phone1: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Phone 1", "Contact Person 1 Phone", "Contact Person 1 Mobile", "Contact Person 1 Tel", "Phone 1"])),
    cp1Phone2: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Phone 2", "Contact Person 1 Mobile 2", "Phone 2"])),
    cp1Email1: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Email 1", "Contact Person 1 Email", "Email 1", "Email"])),
    cp1Email2: toDisplayValue(readTemplateField(raw, ["Contact Person 1 Email 2", "Contact Person 1 Mail", "Email 2"])),
    contactPerson2Name: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Name", "Contact Person 2"])),
    designation2: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Designation", "Designation 2"])),
    department2: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Department", "Department 2"])),
    cp2Phone1: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Phone 1", "Contact Person 2 Phone", "Contact Person 2 Mobile", "Phone 1 (2)", "Secondary Phone 1"])),
    cp2Phone2: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Phone 2", "Secondary Phone 2", "Phone 2 (2)"])),
    cp2Email1: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Email 1", "Contact Person 2 Email", "Email 1 (2)", "Secondary Email 1"])),
    cp2Email2: toDisplayValue(readTemplateField(raw, ["Contact Person 2 Email 2", "Contact Person 2 Mail", "Email 2 (2)", "Secondary Email 2"])),
    leadSource: toDisplayValue(readTemplateField(raw, ["Lead Source", "Source"])),
    assignedToId: customer.assignedToId ?? "",
  };
}

function CustomerRowActions({
  customer,
  onEdit,
  onDelete,
}: {
  customer: CompanyRow;
  onEdit: (customer: CompanyRow) => void;
  onDelete: (customer: CompanyRow) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(event) => {
          event.stopPropagation();
          onEdit(customer);
        }}
        title="Edit"
        aria-label="Edit"
        className="h-8 w-8 text-slate-500 transition duration-150 hover:scale-110 hover:bg-slate-100 hover:text-slate-900"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(customer);
        }}
        title="Delete"
        aria-label="Delete"
        className="h-8 w-8 text-red-600 transition duration-150 hover:scale-110 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function customerActivityToneClasses(tone?: CompanyRow["activityTone"]) {
  if (tone === "blue") return "text-blue-600";
  if (tone === "green") return "text-emerald-600";
  if (tone === "amber") return "text-amber-600";
  return "text-slate-500";
}

function customerActivityBadgeClasses(tone?: CompanyRow["activityTone"]) {
  if (tone === "blue") return "border-blue-200 bg-blue-50 text-blue-700";
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function customerActivityTooltip(customer: CompanyRow) {
  const rows = [
    customer.activityLabel ? `Status: ${customer.activityLabel}` : null,
    `Added by: ${customer.createdBy || customer.assignedTo || "-"}`,
    `Owner: ${customer.assignedTo || "-"}`,
    `Last contact: ${customer.lastCommunication || "-"}`,
  ].filter(Boolean);

  return rows.join("\n");
}

type CustomerQuickContextPayload = {
  success?: boolean;
  message?: string;
  profileCustomer?: CompanyRow;
  history?: CustomerHistory;
  journey?: CustomerJourneySummary;
  counts?: {
    tasks: number;
    followUps: number;
    communications: number;
  };
};

const customerQuickContextCache = new Map<string, CustomerQuickContextPayload>();

function firstCustomerValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized && normalized !== "-") return normalized;
  }
  return "-";
}

function readableCustomerValue(value: string, emptyLabel: string) {
  return value !== "-" ? value : emptyLabel;
}

function cleanCustomerSnapshotValue(value?: string | null, emptyLabel = "-") {
  const normalized = value?.trim();
  if (!normalized || normalized === "No phone number") return emptyLabel;
  return normalized;
}

function buildCustomerQuickStub(input: {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  cityOrZilla?: string | null;
}): CompanyRow | null {
  const name = input.name?.trim();
  const phone = cleanCustomerSnapshotValue(input.phone);
  const cityOrZilla = cleanCustomerSnapshotValue(input.cityOrZilla);
  const resolvedId = input.id?.trim() ?? "";

  if (!resolvedId && !name) return null;

  return {
    id: resolvedId,
    name: name || "Customer",
    contactPerson: "-",
    email: "-",
    emailOptions: [],
    phone,
    phone2: "-",
    whatsapp: phone,
    cityOrZilla,
    industry: "-",
    address: cityOrZilla,
    website: "-",
    assignedToId: null,
    assignedTo: "-",
    createdBy: "-",
    createdByRole: "-",
    createdAtLabel: "-",
    status: "-",
    totalLeads: 0,
    lastCommunication: "-",
    notes: "-",
    rawData: {},
  };
}

function buildCustomerReturnHref(pathname: string, searchParams: ReturnType<typeof useSearchParams>) {
  const query = searchParams.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

function useCustomerQuickContext(customerId: string | null | undefined, open: boolean, refreshKey = 0) {
  const [payload, setPayload] = React.useState<CustomerQuickContextPayload | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open || !customerId) {
      setLoading(false);
      setError("");
      return;
    }

    const cached = refreshKey === 0 ? customerQuickContextCache.get(customerId) : undefined;
    if (cached) {
      setPayload(cached);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      setPayload(null);
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/customers/${customerId}?includeHistory=1`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json() as CustomerQuickContextPayload;

        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "Failed to load customer context.");
        }

        customerQuickContextCache.set(customerId, result);
        setPayload(result);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPayload(null);
        setError(error instanceof Error ? error.message : "Failed to load customer context.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [customerId, open, refreshKey]);

  return {
    payload,
    loading,
    error,
  };
}

function toEditableFollowUpModalItem(followUp: FollowUpRow): EditableFollowUpModalItem {
  return {
    sourceId: followUp.id,
    sourceType: "FOLLOW_UP",
    taskId: followUp.taskId ?? null,
    linkedTaskTitle: followUp.taskTitle ?? null,
    linkedTaskNotes: followUp.taskNotes ?? null,
    linkedTaskReminder: followUp.taskReminder ?? null,
    linkedTaskProductId: followUp.taskProductId ?? null,
    linkedTaskProductName: followUp.taskProductName ?? null,
    linkedTaskPriorityKey: followUp.taskPriorityKey,
    linkedTaskDateIso: followUp.taskDateIso ?? null,
    title: followUp.taskTitle ?? (followUp.lead !== "-" ? followUp.lead : "Follow-up"),
    companyName: followUp.customer,
    companyPrimaryPhone: "No phone number",
    companyId: followUp.companyId ?? null,
    method: followUp.method,
    taskDateIso: followUp.followUpDateIso,
    description: followUp.note,
    notes: followUp.nextDiscussionPlan,
    productId: null,
    productName: "-",
    priority: "Medium",
    priorityKey: "MEDIUM",
    statusKey: "PENDING",
  };
}

function toEditablePendingFollowUpItem(task: TodayWorkQueueItem): EditableFollowUpModalItem {
  return {
    sourceId: task.sourceId,
    sourceType: "FOLLOW_UP",
    taskId: task.taskId ?? null,
    linkedTaskTitle: task.linkedTaskTitle ?? null,
    linkedTaskNotes: task.linkedTaskNotes ?? null,
    linkedTaskReminder: task.linkedTaskReminder ?? null,
    linkedTaskProductId: task.linkedTaskProductId ?? null,
    linkedTaskProductName: task.linkedTaskProductName ?? null,
    linkedTaskPriorityKey: task.linkedTaskPriorityKey,
    linkedTaskDateIso: task.linkedTaskDateIso ?? null,
    title: task.linkedTaskTitle ?? task.title,
    companyName: task.companyName,
    companyPrimaryPhone: task.companyPrimaryPhone,
    companyId: task.companyId ?? null,
    method: task.method,
    taskDateIso: task.taskDateIso,
    description: task.description !== "-" ? task.description : "",
    notes: task.notes !== "-" ? task.notes : "",
    productId: task.linkedTaskProductId ?? task.productId ?? null,
    productName: task.linkedTaskProductName ?? task.productName,
    priority: task.priority,
    priorityKey: task.priorityKey,
    statusKey: "PENDING",
  };
}

export function toEditableCompletedFollowUpItem(task: CompletedWorkItem): EditableFollowUpModalItem {
  return {
    sourceId: task.sourceId,
    sourceType: "FOLLOW_UP",
    taskId: task.taskId ?? null,
    linkedTaskTitle: task.linkedTaskTitle ?? null,
    linkedTaskNotes: task.linkedTaskNotes ?? null,
    linkedTaskReminder: task.linkedTaskReminder ?? null,
    linkedTaskProductId: task.linkedTaskProductId ?? null,
    linkedTaskProductName: task.linkedTaskProductName ?? null,
    linkedTaskPriorityKey: task.linkedTaskPriorityKey,
    linkedTaskDateIso: task.linkedTaskDateIso ?? null,
    title: task.title,
    companyName: task.companyName,
    companyPrimaryPhone: task.companyPrimaryPhone,
    companyId: task.companyId ?? null,
    method: task.method,
    taskDateIso: task.taskDateIso,
    description: task.description !== "-" ? task.description : task.method,
    notes: task.notes !== "-" ? task.notes : "",
    productId: task.productId ?? null,
    productName: task.productName,
    priority: task.priority,
    priorityKey: task.priorityKey,
    statusKey: task.statusKey,
  };
}

type EditableTaskModalItem = {
  id?: string;
  title: string;
  companyId?: string | null;
  companyName: string;
  customerAddress?: string;
  description: string;
  notes: string;
  productId?: string | null;
  assignedToId?: string | null;
  priorityKey: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  taskDateIso: string;
  reminder: string;
  statusKey: "PENDING" | "COMPLETED";
  stepNotes?: WorkStepNote[];
};

function normalizeEditableTaskPriorityKey(priority: TaskRow["priorityKey"] | undefined): EditableTaskModalItem["priorityKey"] {
  if (priority === "URGENT") return "IMPORTANT";
  return priority ?? "MEDIUM";
}

function normalizeEditableTaskStatusKey(status: TaskRow["statusKey"] | undefined): EditableTaskModalItem["statusKey"] {
  if (status === "COMPLETED") return "COMPLETED";
  return "PENDING";
}

function toEditableTaskModalItem(task: TaskRow): EditableTaskModalItem {
  return {
    id: task.id,
    title: task.title,
    companyId: task.companyId,
    companyName: task.companyName || task.relatedTo || "-",
    customerAddress: "",
    description: task.description !== "-" ? task.description : "",
    notes: task.notes !== "-" ? task.notes : "",
    productId: task.productId,
    assignedToId: task.assignedToId,
    priorityKey: normalizeEditableTaskPriorityKey(task.priorityKey),
    taskDateIso: task.taskDateIso,
    reminder: task.reminder !== "-" ? task.reminder : "",
    statusKey: normalizeEditableTaskStatusKey(task.statusKey),
    stepNotes: [],
  };
}

function buildCustomerTaskDraft(customer: CompanyRow): EditableTaskModalItem {
  return {
    title: "Call",
    companyId: customer.id,
    companyName: customer.name,
    customerAddress: customer.address !== "-" ? customer.address : "",
    description: "",
    notes: "",
    productId: "",
    assignedToId: customer.assignedToId ?? "",
    priorityKey: "MEDIUM",
    taskDateIso: new Date().toISOString(),
    reminder: "",
    statusKey: "PENDING",
    stepNotes: [],
  };
}

function editableTaskStepKey(value?: string | null) {
  return normalizeCrmPipelineStep(value === "Sale" ? "Sale Won" : value);
}

function buildStepNoteDraftMap(item?: EditableTaskModalItem | null) {
  return new Map<CrmPipelineStep, string>();
}

function CustomerQuickSummaryPanel({
  customer,
  open,
  role,
  compact = false,
  refreshKey = 0,
  onEditFollowUp,
  onAddTask,
  onEditTask,
  onParked,
}: {
  customer: CompanyRow | null;
  open: boolean;
  role: Role;
  compact?: boolean;
  refreshKey?: number;
  onEditFollowUp?: (item: EditableFollowUpModalItem) => void;
  onAddTask?: (item: EditableTaskModalItem) => void;
  onEditTask?: (item: EditableTaskModalItem) => void;
  onParked?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { payload, loading, error } = useCustomerQuickContext(customer?.id, open, refreshKey);
  const { refreshCustomerCount, refreshColdCustomerCount } = useTaskCounterContext();
  const [parkModalOpen, setParkModalOpen] = React.useState(false);
  const [parkUntil, setParkUntil] = React.useState("");
  const [parkNote, setParkNote] = React.useState("");
  const [parkPending, setParkPending] = React.useState(false);
  const [parkError, setParkError] = React.useState("");

  if (!customer) return null;

  const profileCustomer = payload?.profileCustomer ?? customer;
  const history = payload?.history;
  const journey = payload?.journey;
  const latestTask = history?.tasks[0];
  const latestFollowUp = history?.followUps[0];
  const latestCommunication = history?.communications[0];
  const latestActivity = history?.activities[0];
  const latestTaskNote = firstCustomerValue(latestTask?.notes, latestTask?.description);
  const latestFollowUpNote = firstCustomerValue(latestFollowUp?.note, latestFollowUp?.nextDiscussionPlan);
  const latestCommunicationNote = firstCustomerValue(
    latestCommunication?.summary,
    latestCommunication?.notes,
    latestCommunication?.discussionTopic,
    latestActivity?.discussionSummary,
    latestActivity?.notes,
  );
  const customerRaw = parseTemplateRawData(profileCustomer.rawData) as Record<string, unknown>;
  const customerNote = toDisplayValue(readTemplateField(customerRaw, ["Note", "Notes", "Remarks"])) || toDisplayValue(profileCustomer.notes);
  const stageTitle = journey?.currentStage && journey.currentStage !== "No activity yet"
    ? journey.currentStage
    : profileCustomer.activityLabel || "No CRM activity yet";
  const stageDetail = journey?.stageSummary && journey.stageSummary !== "Waiting for real CRM activity."
    ? journey.stageSummary
    : "No call, follow-up, quotation, or task has been saved for this customer yet.";
  const lastActivityTitle = journey?.lastActivity && journey.lastActivity !== "No activity yet"
    ? journey.lastActivity
    : latestActivity?.title || "No CRM activity yet";
  const lastActivityMeta = journey?.lastActivityTime && journey.lastActivityTime !== "-"
    ? journey.lastActivityTime
    : "No call, follow-up, or task time recorded yet.";
  const lastActivityDetail = readableCustomerValue(
    latestCommunicationNote,
    "No communication note, discussion topic, or activity detail has been saved yet.",
  );
  const nextFollowUpTitle = journey?.nextFollowUp && journey.nextFollowUp !== "No upcoming follow-up"
    ? journey.nextFollowUp
    : latestFollowUp?.followUpDate || "No follow-up scheduled yet";
  const nextFollowUpMeta = journey?.nextFollowUpStatus && journey.nextFollowUpStatus !== "No upcoming follow-up"
    ? journey.nextFollowUpStatus
    : latestFollowUp?.status || "No pending follow-up found.";
  const nextFollowUpDetail = readableCustomerValue(
    latestFollowUpNote,
    "No next discussion plan or follow-up note has been saved yet.",
  );
  const latestTaskTitle = latestTask?.title || "No task created yet";
  const latestTaskMeta = readableCustomerValue(
    firstCustomerValue(latestTask?.dueDate, latestTask?.taskDate, latestTask?.time),
    "No task date or reminder is available yet.",
  );
  const latestTaskDetail = readableCustomerValue(
    latestTaskNote,
    "No task detail or task note has been saved yet.",
  );
  const returnTo = buildCustomerReturnHref(pathname, searchParams);
  const hasCustomerProfile = Boolean(profileCustomer.id?.trim());
  const profileHref = hasCustomerProfile
    ? `/customers/${profileCustomer.id}?returnTo=${encodeURIComponent(returnTo)}`
    : "";
  const communicationHref = `${rolePath(role, "communication")}?activity=${encodeURIComponent(profileCustomer.name)}`;
  const latestTaskHref = latestTask ? `${rolePath(role, "tasks")}?editTaskId=${encodeURIComponent(latestTask.id)}` : "";
  const latestFollowUpHref = latestFollowUp ? `${rolePath(role, "tasks")}?editFollowUpId=${encodeURIComponent(latestFollowUp.id)}` : "";
  const latestFollowUpItem = latestFollowUp ? toEditableFollowUpModalItem(latestFollowUp) : null;
  const addTaskItem = buildCustomerTaskDraft(profileCustomer);
  const latestTaskItem = latestTask ? toEditableTaskModalItem(latestTask) : null;
  const countTasks = payload?.counts?.tasks ?? history?.tasks.length ?? 0;
  const countFollowUps = payload?.counts?.followUps ?? history?.followUps.length ?? 0;
  const countCommunications = payload?.counts?.communications ?? history?.communications.length ?? 0;
  const contactPerson = cleanCustomerSnapshotValue(profileCustomer.contactPerson);
  const phone = cleanCustomerSnapshotValue(profileCustomer.phone);
  const email = cleanCustomerSnapshotValue(profileCustomer.email);
  const address = cleanCustomerSnapshotValue(
    profileCustomer.address,
    cleanCustomerSnapshotValue(profileCustomer.cityOrZilla),
  );

  const submitParkCustomer = async () => {
    if (!parkUntil) {
      setParkError("Select the date to park this customer until.");
      return;
    }

    setParkPending(true);
    setParkError("");
    try {
      const response = await fetch(`/api/customers/${profileCustomer.id}/park`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ until: parkUntil, note: parkNote }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setParkError(typeof result.message === "string" ? result.message : "Failed to park customer.");
        return;
      }

      setParkModalOpen(false);
      void refreshCustomerCount();
      void refreshColdCustomerCount();
      onParked?.();
    } catch (error) {
      setParkError(error instanceof Error ? error.message : "Failed to park customer.");
    } finally {
      setParkPending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Quick CRM Context</p>
          <h3 className="mt-1 text-base font-black text-slate-950">
            {stageTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {stageDetail}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAddTask ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onAddTask(addTaskItem)}>
              <CalendarClock className="h-4 w-4" />
              Add Task
            </Button>
          ) : null}
          {latestTaskItem && onEditTask ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onEditTask(latestTaskItem)}>
              <Edit className="h-4 w-4" />
              Edit Task
            </Button>
          ) : latestTaskHref ? (
            <Link href={latestTaskHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Edit className="h-4 w-4" />
              Edit Task
            </Link>
          ) : null}
          {profileHref ? (
            <Link href={profileHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Eye className="h-4 w-4" />
              Full Profile
            </Link>
          ) : null}
          <Link href={communicationHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MessageSquare className="h-4 w-4" />
            Activity Log
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setParkError("");
              setParkUntil("");
              setParkNote("");
              setParkModalOpen(true);
            }}
          >
            <Snowflake className="h-4 w-4" />
            Move to Cold Customers
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading previous call, follow-up, ar step history...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Contact Snapshot</p>
        <div className={cn("mt-3 grid gap-3", compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4")}>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Contact Person</p>
            <p className="mt-1.5 text-sm font-bold text-slate-800">{contactPerson}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Phone</p>
            <p className="mt-1.5 text-sm font-bold text-slate-800">{phone}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Email</p>
            <p className="mt-1.5 break-all text-sm font-bold text-slate-800">{email}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Address</p>
            <p className="mt-1.5 text-sm font-bold text-slate-800">{address}</p>
          </div>
        </div>
      </div>

      <div className={cn("grid gap-3", compact ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
        <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Last Activity</p>
          <p className="mt-2 text-sm font-black text-slate-950">{lastActivityTitle}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{lastActivityMeta}</p>
          <p className="mt-3 text-xs leading-5 text-slate-600">{lastActivityDetail}</p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Next Follow-up</p>
          <p className="mt-2 text-sm font-black text-slate-950">{nextFollowUpTitle}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{nextFollowUpMeta}</p>
          <p className="mt-3 text-xs leading-5 text-slate-600">{nextFollowUpDetail}</p>
          {latestFollowUpItem ? (
            <div className="mt-3">
              {onEditFollowUp ? (
                <Button type="button" variant="outline" size="sm" onClick={() => onEditFollowUp(latestFollowUpItem)}>
                  <Edit className="h-4 w-4" />
                  Edit Follow-up
                </Button>
              ) : latestFollowUpHref ? (
                <Link href={latestFollowUpHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Edit className="h-4 w-4" />
                  Edit Follow-up
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        {!compact ? (
          <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Latest Task</p>
            <p className="mt-2 text-sm font-black text-slate-950">{latestTaskTitle}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{latestTaskMeta}</p>
            <p className="mt-3 text-xs leading-5 text-slate-600">{latestTaskDetail}</p>
            {latestTaskItem && onEditTask ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onEditTask(latestTaskItem)}>
                  <Edit className="h-4 w-4" />
                  Edit Task
                </Button>
              </div>
            ) : latestTaskHref ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={latestTaskHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Edit className="h-4 w-4" />
                  Edit Task
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={cn("grid gap-3", compact ? "lg:grid-cols-2" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]")}>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Customer Notes</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{customerNote || "No customer note saved yet."}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Assigned / Priority</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{journey?.assignedMarketer || profileCustomer.assignedTo || "-"}</Badge>
            <Badge variant={customerJourneyStatusVariant(journey?.status || "No activity")}>{journey?.status || "No activity"}</Badge>
            <Badge variant={journey?.priority && journey.priority !== "-" ? "warning" : "neutral"}>
              {journey?.priority && journey.priority !== "-" ? `${journey.priority} Priority` : "No priority"}
            </Badge>
          </div>
        </div>
        {!compact ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Counts</p>
            <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
              <div className="flex items-center justify-between gap-3"><span>Calls / Logs</span><span className="font-black text-slate-950">{countCommunications}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Follow-ups</span><span className="font-black text-slate-950">{countFollowUps}</span></div>
              <div className="flex items-center justify-between gap-3"><span>Tasks</span><span className="font-black text-slate-950">{countTasks}</span></div>
            </div>
          </div>
        ) : null}
      </div>

      <FormModal
        title="Move to Cold Customers"
        open={parkModalOpen}
        onClose={() => !parkPending && setParkModalOpen(false)}
        panelClassName="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {profileCustomer.name} will be hidden from the main Customers list until the date below. You and your supervisor/admin will get a reminder when it&apos;s due — nothing is deleted, and you can bring it back any time from Cold Customers.
          </p>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Follow-up again on</span>
            <Input
              type="date"
              value={parkUntil}
              onChange={(event) => setParkUntil(event.target.value)}
              className="h-10 bg-white text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Note / Reason (optional)</span>
            <textarea
              value={parkNote}
              onChange={(event) => setParkNote(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
              placeholder="e.g. No budget right now, revisit next year."
            />
          </label>
          {parkError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{parkError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={parkPending} onClick={() => setParkModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="min-w-32" disabled={parkPending} onClick={submitParkCustomer}>
              {parkPending ? "Saving..." : "Move to Cold Customers"}
            </Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

function CustomerViewModal({
  role,
  workspace,
  customer,
  open,
  onClose,
  onParked,
}: {
  role: Role;
  workspace: CrmWorkspace;
  customer: CompanyRow | null;
  open: boolean;
  onClose: () => void;
  onParked?: () => void;
}) {
  const [editingFollowUp, setEditingFollowUp] = React.useState<EditableFollowUpModalItem | null>(null);
  const [editingTask, setEditingTask] = React.useState<EditableTaskModalItem | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const taskWorkspace = React.useMemo<TaskWorkspaceData>(() => ({
    user: {
      id: workspace.user.id ?? "",
      name: workspace.user.name,
      email: workspace.user.email ?? "",
      mobile: workspace.user.mobile ?? "",
      role: workspace.user.role,
      designation: workspace.user.designation ?? "",
    },
    employees: workspace.employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      roleKey: employee.roleKey,
      status: employee.status,
      statusKey: employee.statusKey,
      designation: employee.designation,
      supervisorId: employee.supervisorId,
      supervisorIds: employee.supervisorIds,
    })),
    products: workspace.products.map((product) => ({
      id: product.id,
      name: product.name,
    })),
  }), [workspace]);

  React.useEffect(() => {
    if (!open) {
      setEditingFollowUp(null);
      setEditingTask(null);
      setRefreshKey(0);
      return;
    }

    setEditingFollowUp(null);
    setEditingTask(null);
  }, [customer?.id, open]);

  if (!customer) return null;

  return (
    <>
      <FormModal open={open} title={customer.name || "Customer"} onClose={onClose} panelClassName="max-w-4xl">
        <div className="space-y-4">
          <CustomerQuickSummaryPanel
            customer={customer}
            open={open}
            role={role}
            refreshKey={refreshKey}
            onEditFollowUp={setEditingFollowUp}
            onAddTask={setEditingTask}
            onEditTask={setEditingTask}
            onParked={onParked}
          />
          <dl className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <DetailRow label="Added By" value={customer.createdBy || customer.assignedTo || "-"} />
            <DetailRow label="Added On" value={customer.createdAtLabel || "-"} />
            <DetailRow label="Contact Person" value={customer.contactPerson || "-"} />
            <DetailRow label="Phone" value={customer.phone || "-"} />
            <DetailRow label="WhatsApp" value={customer.whatsapp || "-"} />
            <DetailRow label="Email" value={customer.email || "-"} />
            <DetailRow label="Website" value={customer.website || "-"} />
            <DetailRow label="Industry" value={customer.industry || "-"} />
            <DetailRow label="Address" value={customer.address || "-"} />
            <DetailRow label="Assigned User" value={customer.assignedTo || "-"} />
            <DetailRow label="Lead Count" value={String(customer.totalLeads ?? 0)} />
            <DetailRow label="Last Communication" value={customer.lastCommunication || "-"} />
            <DetailRow label="Status" value={customer.status || "-"} />
          </dl>
        </div>
      </FormModal>
      <FollowUpEditModal
        item={editingFollowUp}
        workspace={taskWorkspace}
        onClose={() => setEditingFollowUp(null)}
        onSaved={() => {
          customerQuickContextCache.delete(customer.id);
          setRefreshKey((current) => current + 1);
        }}
        onDeleted={() => {
          customerQuickContextCache.delete(customer.id);
          setRefreshKey((current) => current + 1);
        }}
      />
      <TaskCreateModal
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onCreated={() => {
          customerQuickContextCache.delete(customer.id);
          setRefreshKey((current) => current + 1);
          setEditingTask(null);
        }}
        onDeleted={() => {
          customerQuickContextCache.delete(customer.id);
          setRefreshKey((current) => current + 1);
          setEditingTask(null);
        }}
        role={role}
        workspace={taskWorkspace}
        initialTask={editingTask}
      />
    </>
  );
}

function CustomerEditModal({
  workspace,
  customer,
  open,
  onDone,
  onClose,
}: {
  workspace: CrmWorkspace;
  customer: CompanyRow | null;
  open: boolean;
  onDone: (customer: CompanyRow | null) => void;
  onClose: () => void;
}) {
  const [values, setValues] = React.useState<CustomerTemplateEditValues>(EMPTY_CUSTOMER_TEMPLATE_VALUES);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [pendingMessage, setPendingMessage] = React.useState("");
  const ownerOptions = React.useMemo(() => getCustomerOwnerOptions(workspace, workspace.user.role), [workspace]);

  React.useEffect(() => {
    setValues(customer ? buildCustomerTemplateValues(customer) : EMPTY_CUSTOMER_TEMPLATE_VALUES);
    setMessage("");
    setPendingMessage("");
    setPending(false);
  }, [customer]);

  const updateField = React.useCallback((field: keyof CustomerTemplateEditValues, nextValue: string) => {
    setValues((state) => ({ ...state, [field]: nextValue }));
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;

    const normalizedName = values.companyName.trim();
    if (!normalizedName) {
      setMessage("Company Name is required.");
      return;
    }

    setPending(true);
    setMessage("");
    setPendingMessage("Saving...");

    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: normalizedName,
          industry: values.industry.trim(),
          cityOrZilla: values.cityOrZilla.trim(),
          address: values.address.trim(),
          primaryPhone: values.primaryPhone.trim(),
          phone2: values.phone2.trim(),
          phone3: values.phone3.trim(),
          primaryEmail: values.primaryEmail.trim(),
          email2: values.email2.trim(),
          website: values.website.trim(),
          note: values.note.trim(),
          contactPerson: values.contactPerson1Name.trim(),
          contactPerson1Name: values.contactPerson1Name.trim(),
          designation1: values.designation1.trim(),
          department1: values.department1.trim(),
          cp1Phone1: values.cp1Phone1.trim(),
          cp1Phone2: values.cp1Phone2.trim(),
          cp1Email1: values.cp1Email1.trim(),
          cp1Email2: values.cp1Email2.trim(),
          contactPerson2Name: values.contactPerson2Name.trim(),
          designation2: values.designation2.trim(),
          department2: values.department2.trim(),
          cp2Phone1: values.cp2Phone1.trim(),
          cp2Phone2: values.cp2Phone2.trim(),
          cp2Email1: values.cp2Email1.trim(),
          cp2Email2: values.cp2Email2.trim(),
          leadSource: values.leadSource.trim(),
          ...(workspace.user.role !== "MARKETER" ? { assignedToId: values.assignedToId } : {}),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Customer update failed.");
      }

      const payload = result.customer as Partial<CompanyRow> | undefined;
      onDone({
        ...customer,
        ...payload,
      });
      setPendingMessage("");
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Customer update failed.");
      setPendingMessage("");
    } finally {
      setPending(false);
    }
  };

  if (!customer) return null;

  return (
    <FormModal open={open} title="Edit Customer" onClose={onClose} panelClassName="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <CustomerQuickSummaryPanel customer={customer} open={open} role={workspace.user.role} compact />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Industry</span>
            <Input
              name="industry"
              value={values.industry}
              onChange={(event) => updateField("industry", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Company Name</span>
            <Input
              name="companyName"
              required
              value={values.companyName}
              onChange={(event) => updateField("companyName", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">City / Zilla</span>
            <Input
              name="cityOrZilla"
              value={values.cityOrZilla}
              onChange={(event) => updateField("cityOrZilla", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Address</span>
            <Input
              name="address"
              value={values.address}
              onChange={(event) => updateField("address", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Primary Phone</span>
            <Input
              name="primaryPhone"
              value={values.primaryPhone}
              onChange={(event) => updateField("primaryPhone", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 2</span>
            <Input
              name="phone2"
              value={values.phone2}
              onChange={(event) => updateField("phone2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 3</span>
            <Input
              name="phone3"
              value={values.phone3}
              onChange={(event) => updateField("phone3", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Primary Email</span>
            <Input
              type="email"
              name="primaryEmail"
              value={values.primaryEmail}
              onChange={(event) => updateField("primaryEmail", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 2</span>
            <Input
              name="email2"
              value={values.email2}
              onChange={(event) => updateField("email2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Website</span>
            <Input
              name="website"
              value={values.website}
              onChange={(event) => updateField("website", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700">Note</span>
            <textarea
              name="note"
              value={values.note}
              onChange={(event) => updateField("note", event.target.value)}
              className="min-h-16 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Contact Person 1 Name</span>
            <Input
              name="contactPerson1Name"
              value={values.contactPerson1Name}
              onChange={(event) => updateField("contactPerson1Name", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Designation</span>
            <Input
              name="designation1"
              value={values.designation1}
              onChange={(event) => updateField("designation1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Department</span>
            <Input
              name="department1"
              value={values.department1}
              onChange={(event) => updateField("department1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 1</span>
            <Input
              name="cp1Phone1"
              value={values.cp1Phone1}
              onChange={(event) => updateField("cp1Phone1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 2</span>
            <Input
              name="cp1Phone2"
              value={values.cp1Phone2}
              onChange={(event) => updateField("cp1Phone2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 1</span>
            <Input
              name="cp1Email1"
              value={values.cp1Email1}
              onChange={(event) => updateField("cp1Email1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 2</span>
            <Input
              name="cp1Email2"
              value={values.cp1Email2}
              onChange={(event) => updateField("cp1Email2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-slate-700">Contact Person 2 Name</span>
            <Input
              name="contactPerson2Name"
              value={values.contactPerson2Name}
              onChange={(event) => updateField("contactPerson2Name", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Designation</span>
            <Input
              name="designation2"
              value={values.designation2}
              onChange={(event) => updateField("designation2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Department</span>
            <Input
              name="department2"
              value={values.department2}
              onChange={(event) => updateField("department2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 1</span>
            <Input
              name="cp2Phone1"
              value={values.cp2Phone1}
              onChange={(event) => updateField("cp2Phone1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Phone 2</span>
            <Input
              name="cp2Phone2"
              value={values.cp2Phone2}
              onChange={(event) => updateField("cp2Phone2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 1</span>
            <Input
              name="cp2Email1"
              value={values.cp2Email1}
              onChange={(event) => updateField("cp2Email1", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Email 2</span>
            <Input
              name="cp2Email2"
              value={values.cp2Email2}
              onChange={(event) => updateField("cp2Email2", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Lead Source</span>
            <Input
              name="leadSource"
              value={values.leadSource}
              onChange={(event) => updateField("leadSource", event.target.value)}
              className="h-10 px-3 text-[13px]"
            />
          </label>
          {workspace.user.role !== "MARKETER" ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-700">Assigned Marketer</span>
              <select
                name="assignedToId"
                value={values.assignedToId}
                onChange={(event) => updateField("assignedToId", event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Select marketer</option>
                {ownerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
        {pendingMessage ? <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">{pendingMessage}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

function ProductForm({
  onDone,
  product,
  onSuccess,
}: {
  onDone: () => void;
  product?: ProductRow | null;
  onSuccess?: (row: ProductRow) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = new FormData(form);
        payload.set("category", product?.category || "General");
        payload.set("brand", product && product.brand !== "-" ? product.brand : "");
        payload.set("existingImageUrl", product?.imageUrl ?? "");

        startTransition(async () => {
          setMessage("");
          try {
            const response = await fetch(product ? `/api/products/${product.id}` : "/api/products", {
              method: product ? "PATCH" : "POST",
              body: payload,
            });
            const result = await response.json();
            if (!response.ok || !result.success || !result.row) {
              setMessage(result.message ?? "Product save failed.");
              return;
            }

            if (!product) {
              form.reset();
            }
            onSuccess?.(result.row as ProductRow);
            onDone();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Product save failed.");
          }
        });
      }}
    >
      <TextField label="Product / Service Name" name="name" required defaultValue={product?.name ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Price" name="price" type="number" defaultValue={product ? product.price : 0} required />
        <label className="space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Product Image</span>
          <Input type="file" name="image" accept="image/*" className="h-10 bg-white text-sm" />
          {product?.imageUrl ? <p className="truncate text-xs font-semibold text-blue-700">Current: {product.imageUrl}</p> : null}
        </label>
      </div>
      <TextAreaField label="Specification" name="specification" defaultValue={product && product.specification !== "-" ? product.specification : ""} />
      {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
      <div className="flex justify-end">
        <Button className="min-w-36 rounded-xl px-5" disabled={pending} type="submit">
          {pending ? "Saving..." : product ? "Update Product" : "Save Product"}
        </Button>
      </div>
    </form>
  );
}

type LeadColumnKey =
  | "customerName"
  | "company"
  | "phone"
  | "email"
  | "productInterest"
  | "status"
  | "score"
  | "purchaseProbability"
  | "assignedTo"
  | "priority"
  | "followUpDate"
  | "createdAt"
  | "action";

const LEAD_COLUMN_OPTIONS: Array<{ key: LeadColumnKey; label: string }> = [
  { key: "customerName", label: "Lead Name / Customer Name" },
  { key: "company", label: "Company" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "productInterest", label: "Product Interest" },
  { key: "status", label: "Status" },
  { key: "score", label: "Lead Score" },
  { key: "purchaseProbability", label: "Probability" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "priority", label: "Priority" },
  { key: "followUpDate", label: "Follow-up Date" },
  { key: "createdAt", label: "Created At" },
  { key: "action", label: "Action" },
];

function LeadRowActions({
  lead,
  onEdit,
  onDelete,
}: {
  lead: LeadRow;
  onEdit: (lead: LeadRow) => void;
  onDelete: (lead: LeadRow) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={`/leads/${lead.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:scale-110 hover:bg-blue-50 hover:text-blue-700" aria-label="View lead">
        <Eye className="h-4 w-4" />
      </Link>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-500 transition duration-150 hover:scale-110 hover:bg-slate-100 hover:text-slate-900" onClick={() => onEdit(lead)} aria-label="Edit lead">
        <Edit className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-600 transition duration-150 hover:scale-110 hover:bg-red-50 hover:text-red-700" onClick={() => onDelete(lead)} aria-label="Delete lead">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function LeadsPage({ workspace, previewMarketerId }: { role: Role; workspace: CrmWorkspace; previewMarketerId?: string }) {
  const viewerRole = workspace.user.role;
  const { refreshLeadCount } = useTaskCounterContext();
  const [open, setOpen] = React.useState(false);
  const [editLead, setEditLead] = React.useState<LeadRow | null>(null);
  const [deleteLead, setDeleteLead] = React.useState<LeadRow | null>(null);
  const [leads, setLeads] = React.useState<LeadRow[]>(() => workspace.leads);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [assignedToId, setAssignedToId] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(workspace.leads.length);
  const [columnMenuOpen, setColumnMenuOpen] = React.useState(false);
  const [visibleColumns, setVisibleColumns] = React.useState<Record<LeadColumnKey, boolean>>({
    customerName: true,
    company: true,
    phone: true,
    email: true,
    productInterest: true,
    status: true,
    score: true,
    purchaseProbability: true,
    assignedTo: viewerRole !== "MARKETER",
    priority: true,
    followUpDate: true,
    createdAt: true,
    action: true,
  });
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const columnMenuRef = React.useRef<HTMLDivElement>(null);
  const marketers = React.useMemo(() => workspace.employees.filter((item) => item.role === "Marketer"), [workspace.employees]);

  const refreshLeads = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "10",
      });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (assignedToId !== "all") params.set("assignedToId", assignedToId);
      if (previewMarketerId) params.set("previewMarketerId", previewMarketerId);

      const response = await fetch(`/api/leads?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(typeof result.message === "string" ? result.message : "Failed to load leads.");
      }

      setLeads(Array.isArray(result.rows) ? (result.rows as LeadRow[]) : []);
      setPage(Number(result.page ?? 1));
      setTotalPages(Number(result.totalPages ?? 1));
      setTotal(Number(result.total ?? 0));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [assignedToId, page, previewMarketerId, priorityFilter, search, statusFilter]);

  React.useEffect(() => {
    void refreshLeads();
  }, [refreshLeads]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!columnMenuRef.current?.contains(event.target as Node)) {
        setColumnMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const visibleKeys = React.useMemo(
    () => LEAD_COLUMN_OPTIONS
      .filter((item) => item.key !== "assignedTo" || viewerRole !== "MARKETER")
      .filter((item) => visibleColumns[item.key])
      .map((item) => item.key),
    [viewerRole, visibleColumns],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        format: "xlsx",
        columns: visibleKeys.join(","),
      });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (viewerRole !== "MARKETER" && assignedToId !== "all") params.set("assignedToId", assignedToId);
      const response = await fetch(`/api/leads/export?${params.toString()}`);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message ?? "Lead export failed.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setFeedback({ type: "success", message: "Leads exported successfully." });
    } catch (nextError) {
      setFeedback({ type: "error", message: nextError instanceof Error ? nextError.message : "Lead export failed." });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const importOwnerId = viewerRole === "MARKETER"
        ? workspace.user.id ?? ""
        : assignedToId !== "all"
          ? assignedToId
          : marketers.length === 1
            ? marketers[0].id
            : "";

      if (viewerRole !== "MARKETER" && !importOwnerId) {
        throw new Error("Select a marketer before importing leads.");
      }

      const formData = new FormData();
      formData.set("file", file);
      if (importOwnerId) {
        formData.set("assignedToId", importOwnerId);
      }
      const response = await fetch("/api/leads/import", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(typeof result.message === "string" ? result.message : "Lead import failed.");
      }

      await refreshLeads();
      await refreshLeadCount();
      setFeedback({
        type: "success",
        message: `${result.inserted} inserted, ${result.updated} updated, ${result.failed.length} failed.${result.failed.length ? ` First issue: row ${result.failed[0].row} - ${result.failed[0].reason}` : ""}`,
      });
    } catch (nextError) {
      setFeedback({ type: "error", message: nextError instanceof Error ? nextError.message : "Lead import failed." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        description="Manage opportunities with score, priority, ownership, communication count, and follow-up tracking."
        actions={pageActions([
          { label: "Add Lead", icon: Plus, variant: "default", onClick: () => { setEditLead(null); setOpen(true); } },
          { label: importing ? "Importing..." : "Import CSV", icon: Upload, variant: "outline", onClick: () => fileInputRef.current?.click() },
          { label: exporting ? "Exporting..." : "Export", icon: Download, variant: "outline", onClick: () => void handleExport() },
        ])}
      />
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportFile} />
      {feedback ? <div className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>{feedback.message}</div> : null}
      <FilterBar>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase text-slate-500">Status</span>
          <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
            <option value="all">All Status</option>
            <option value="NEW_LEAD">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="INTERESTED">Interested</option>
            <option value="QUOTATION_SENT">Quotation Sent</option>
            <option value="NEGOTIATION">Negotiation</option>
            <option value="WON_SALE">Won</option>
            <option value="LOST">Lost</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase text-slate-500">Priority</span>
          <select value={priorityFilter} onChange={(event) => { setPage(1); setPriorityFilter(event.target.value); }} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
            <option value="all">All Priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Important</option>
          </select>
        </label>
        {viewerRole !== "MARKETER" ? (
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Assigned To</span>
            <select value={assignedToId} onChange={(event) => { setPage(1); setAssignedToId(event.target.value); }} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
              <option value="all">All Marketers</option>
              {marketers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="space-y-1.5">
          <span className="text-xs font-bold uppercase text-slate-500">Search</span>
          <Input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search lead, company, phone, email..." />
        </label>
        <div className="relative" ref={columnMenuRef}>
          <span className="text-xs font-bold uppercase text-slate-500">Columns</span>
          <Button type="button" variant="outline" className="mt-1 h-10 w-full justify-between" onClick={() => setColumnMenuOpen((current) => !current)}>
            <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Columns</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
          {columnMenuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {LEAD_COLUMN_OPTIONS.filter((column) => column.key !== "assignedTo" || viewerRole !== "MARKETER").map((column) => (
                <label key={column.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.key]}
                    onChange={() => setVisibleColumns((current) => ({ ...current, [column.key]: !current[column.key] }))}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </FilterBar>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {visibleColumns.customerName ? <th className="px-4 py-3 font-bold">Lead Name / Customer Name</th> : null}
                {visibleColumns.company ? <th className="px-4 py-3 font-bold">Company</th> : null}
                {visibleColumns.phone ? <th className="px-4 py-3 font-bold">Phone</th> : null}
                {visibleColumns.email ? <th className="px-4 py-3 font-bold">Email</th> : null}
                {visibleColumns.productInterest ? <th className="px-4 py-3 font-bold">Product Interest</th> : null}
                {visibleColumns.status ? <th className="px-4 py-3 font-bold">Status</th> : null}
                {visibleColumns.score ? <th className="px-4 py-3 font-bold">Lead Score</th> : null}
                {visibleColumns.purchaseProbability ? <th className="px-4 py-3 font-bold">Probability</th> : null}
                {viewerRole !== "MARKETER" && visibleColumns.assignedTo ? <th className="px-4 py-3 font-bold">Assigned To</th> : null}
                {visibleColumns.priority ? <th className="px-4 py-3 font-bold">Priority</th> : null}
                {visibleColumns.followUpDate ? <th className="px-4 py-3 font-bold">Follow-up Date</th> : null}
                {visibleColumns.createdAt ? <th className="px-4 py-3 font-bold">Created At</th> : null}
                {visibleColumns.action ? <th className="px-4 py-3 text-right font-bold">Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={visibleKeys.length || 1} className="px-4 py-8 text-center font-semibold text-slate-500">Loading leads...</td></tr>
              ) : error ? (
                <tr><td colSpan={visibleKeys.length || 1} className="px-4 py-8 text-center font-semibold text-red-600">{error}</td></tr>
              ) : leads.length ? leads.map((lead) => (
                <tr key={lead.id} className="transition hover:bg-slate-50">
                  {visibleColumns.customerName ? <td className="px-4 py-3"><EntityLink href={`/leads/${lead.id}`} className="font-bold">{lead.customerName}</EntityLink></td> : null}
                  {visibleColumns.company ? <td className="px-4 py-3"><EntityLink href={lead.companyId ? `/customers/${lead.companyId}` : undefined} className="font-semibold">{lead.company}</EntityLink></td> : null}
                  {visibleColumns.phone ? <td className="px-4 py-3 text-slate-700">{lead.phone}</td> : null}
                  {visibleColumns.email ? <td className="px-4 py-3 text-slate-700">{lead.email}</td> : null}
                  {visibleColumns.productInterest ? <td className="px-4 py-3 text-slate-700">{lead.productInterest}</td> : null}
                  {visibleColumns.status ? <td className="px-4 py-3"><StatusBadge value={lead.status} /></td> : null}
                  {visibleColumns.score ? <td className="px-4 py-3 font-semibold text-slate-700">{lead.score}</td> : null}
                  {visibleColumns.purchaseProbability ? <td className="px-4 py-3 font-semibold text-slate-700">{lead.purchaseProbability}%</td> : null}
                  {viewerRole !== "MARKETER" && visibleColumns.assignedTo ? <td className="px-4 py-3 text-slate-700">{lead.assignedTo}</td> : null}
                  {visibleColumns.priority ? <td className="px-4 py-3"><StatusBadge value={lead.priority} /></td> : null}
                  {visibleColumns.followUpDate ? <td className="px-4 py-3 text-slate-700">{lead.followUpDate}</td> : null}
                  {visibleColumns.createdAt ? <td className="px-4 py-3 text-slate-700">{lead.createdAt}</td> : null}
                  {visibleColumns.action ? <td className="px-4 py-3"><LeadRowActions lead={lead} onEdit={(row) => { setEditLead(row); setOpen(true); }} onDelete={(row) => { setDeleteError(""); setDeleteLead(row); }} /></td> : null}
                </tr>
              )) : (
                <tr><td colSpan={visibleKeys.length || 1} className="px-4 py-8 text-center font-semibold text-slate-500">No leads found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <span>Showing {leads.length} of {total} leads</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Previous</Button>
          <span className="font-semibold text-slate-700">Page {page} of {totalPages}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>Next</Button>
        </div>
      </div>

      <FormModal open={open} title={editLead ? "Edit Lead" : "Create Lead"} onClose={() => { setOpen(false); setEditLead(null); }}>
        <LeadForm
          workspace={workspace}
          lead={editLead}
          onSuccess={async () => {
            await refreshLeads();
            await refreshLeadCount();
            setFeedback({ type: "success", message: editLead ? "Lead updated successfully." : "Lead created successfully." });
          }}
          onDone={() => {
            setOpen(false);
            setEditLead(null);
          }}
        />
      </FormModal>

      <FormModal open={Boolean(deleteLead)} title="Delete Lead" onClose={() => setDeleteLead(null)} panelClassName="max-w-md">
        {deleteLead ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">Are you sure you want to delete <span className="font-black">{deleteLead.customerName}</span>?</p>
            {deleteError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{deleteError}</p> : null}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true);
                  setDeleteError("");
                  try {
                    const response = await fetch(`/api/leads/${deleteLead.id}`, { method: "DELETE" });
                    const result = await response.json();
                    if (!response.ok || !result.success) {
                      throw new Error(typeof result.message === "string" ? result.message : "Lead delete failed.");
                    }
                    setDeleteLead(null);
                    await refreshLeads();
                    await refreshLeadCount();
                    setFeedback({ type: "success", message: "Lead deleted successfully." });
                  } catch (nextError) {
                    setDeleteError(nextError instanceof Error ? nextError.message : "Lead delete failed.");
                  } finally {
                    setDeletePending(false);
                  }
                }}
              >
                {deletePending ? "Deleting..." : "Delete Lead"}
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={deletePending} onClick={() => setDeleteLead(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </FormModal>
    </div>
  );
}

export function LeadDetailsPage({ role, workspace, lead }: { role: Role; workspace: CrmWorkspace; lead?: LeadRow }) {
  const [activeLead, setActiveLead] = React.useState(lead);
  const companySummary = activeLead?.companyId ? workspace.companies.find((item) => item.id === activeLead.companyId) : undefined;
  const [communicationOpen, setCommunicationOpen] = React.useState(false);
  const [followUpOpen, setFollowUpOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  if (!activeLead) return <EmptyState title="Lead not found" description="The requested lead is not available in your CRM scope." />;

  return (
    <>
      <Link href={rolePath(role, "leads")} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>
      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-black text-blue-700">
              {activeLead.company.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-950">
                  <EntityLink href={activeLead.companyId ? `/customers/${activeLead.companyId}` : undefined} className="font-black">{activeLead.customerName}</EntityLink>
                </h1>
                <StatusBadge value={activeLead.status} />
              </div>
              <p className="mt-1 text-sm font-bold text-slate-700">
                Company: <EntityLink href={activeLead.companyId ? `/customers/${activeLead.companyId}` : undefined} className="font-bold">{activeLead.company}</EntityLink>
              </p>
              <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                <span>Lead Score: <b className="text-slate-800">{activeLead.score}</b></span>
                <span>Priority: <b className="text-slate-800">{activeLead.priority}</b></span>
                <span>Assigned: <b className="text-slate-800">{activeLead.assignedTo}</b></span>
                <span>Follow-up: <b className="text-slate-800">{activeLead.followUpDate}</b></span>
              </div>
            </div>
          </div>
          <Button type="button" onClick={() => setEditOpen(true)}>Edit Lead</Button>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <Card className="p-5">
          <Tabs
            defaultValue="overview"
            tabs={[
              { label: "Overview", value: "overview" },
              { label: "Timeline", value: "timeline" },
              { label: "Communication", value: "communication" },
              { label: "Follow-ups", value: "followups" },
              { label: "Quotation", value: "quotation" },
              { label: "Products", value: "products" },
            ]}
          >
            {(value) => (
              value === "overview" ? (
                <div className="grid gap-4">
                  {companySummary ? (
                    <DashboardCard title="Connected Company">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InfoLine label="Company" value={<EntityLink href={`/customers/${companySummary.id}`} className="font-bold">{companySummary.name}</EntityLink>} />
                        <InfoLine label="Contact Person" value={companySummary.contactPerson} />
                        <InfoLine label="Phone" value={companySummary.phone} />
                        <InfoLine label="Industry" value={companySummary.industry} />
                      </div>
                    </DashboardCard>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoLine label="Interested Product" value={activeLead.productInterest} />
                    <InfoLine label="Purchase Probability" value={`${activeLead.purchaseProbability}%`} progress={activeLead.purchaseProbability} />
                    <InfoLine label="Communication Count" value={activeLead.communicationCount} />
                    <InfoLine label="Follow-up Count" value={activeLead.followUpCount} />
                    <InfoLine label="Phone Numbers" value={activeLead.phones.length ? activeLead.phones.join(", ") : "-"} />
                    <InfoLine label="Email Addresses" value={activeLead.emails.length ? activeLead.emails.join(", ") : "-"} />
                    <InfoLine label="Notes" value={activeLead.notes} />
                    <InfoLine label="Created At" value={activeLead.createdAt} />
                  </div>
                  <ChartCard title="Lead Status Movement">
                    <SalesLineChart data={workspace.quotations.slice(0, 6).map((item) => ({ month: item.date, sales: item.amount }))} />
                  </ChartCard>
                </div>
              ) : <Timeline rows={workspace.activities} />
            )}
          </Tabs>
        </Card>
        <DashboardCard title="Quick Actions">
          <div className="grid gap-2">
            <Button type="button" onClick={() => setFollowUpOpen(true)}>Add Follow-up</Button>
            <Button variant="outline" type="button" onClick={() => setCommunicationOpen(true)}>Log Communication</Button>
            <Link className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-blue-50" href={rolePath(role, "quotations")}>Create Quotation</Link>
            <Button variant="outline" type="button">Change Status</Button>
          </div>
        </DashboardCard>
      </div>
      <FormModal open={communicationOpen} title="Add Communication / Activity Log" onClose={() => setCommunicationOpen(false)}>
        <CommunicationForm workspace={workspace} onDone={() => setCommunicationOpen(false)} />
      </FormModal>
      <FormModal open={followUpOpen} title="Add Follow-up" onClose={() => setFollowUpOpen(false)}>
        <FollowUpForm workspace={workspace} onDone={() => setFollowUpOpen(false)} />
      </FormModal>
      <FormModal open={editOpen} title="Edit Lead" onClose={() => setEditOpen(false)}>
        <LeadForm
          workspace={workspace}
          lead={activeLead}
          onSuccess={(row) => setActiveLead(row)}
          onDone={() => setEditOpen(false)}
        />
      </FormModal>
    </>
  );
}

type CustomerImportApiResult = {
  inserted: number;
  updated: number;
  failed: Array<{ row: number; reason: string }>;
  distribution?: Array<{ assignedToId: string; requestedCount: number; inserted: number; updated: number; failed: number }>;
  heldForLaterCount?: number;
};

type CustomerPdfAssignmentDraft = {
  id: string;
  assignedToId: string;
  count: string;
};

function createCustomerPdfAssignmentDraft(assignedToId = "", count = ""): CustomerPdfAssignmentDraft {
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, assignedToId, count };
}

function CustomerSpreadsheetImportModal({
  open,
  role,
  currentUserId,
  ownerOptions,
  defaultAssignedToId,
  onClose,
  onImported,
}: {
  open: boolean;
  role: Role;
  currentUserId?: string;
  ownerOptions: AssigneeOption[];
  defaultAssignedToId: string;
  onClose: () => void;
  onImported: (result: CustomerImportApiResult) => Promise<void> | void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<{
    totalRows: number;
    failed: Array<{ row: number; reason: string }>;
    previewRows: Array<{ companyName: string; primaryPhone: string; city?: string; address?: string; industry?: string }>;
  } | null>(null);
  const [assignments, setAssignments] = React.useState<CustomerPdfAssignmentDraft[]>([]);
  const [assignLater, setAssignLater] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [previewing, startPreview] = React.useTransition();
  const [importing, startImport] = React.useTransition();
  const assignedTotal = assignments.reduce((sum, assignment) => sum + Math.max(0, Number(assignment.count) || 0), 0);
  const overflowRows = preview ? Math.max(assignedTotal - preview.totalRows, 0) : 0;
  const remainingRows = preview ? Math.max(preview.totalRows - assignedTotal, 0) : 0;

  const loadPreviewForFile = React.useCallback((sourceFile: File | null) => {
    if (!sourceFile) {
      setMessage("Choose an Excel or CSV file first.");
      return;
    }

    const lowerName = sourceFile.name.toLowerCase();
    if (!(lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv"))) {
      setMessage("Only .xlsx, .xls, and .csv files are supported here.");
      return;
    }

    startPreview(async () => {
      setMessage("");
      setPreview(null);
      try {
        const formData = new FormData();
        formData.append("file", sourceFile);
        formData.append("mode", "preview");

        const response = await fetch("/api/customers/import", {
          method: "POST",
          body: formData,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(typeof result.message === "string" ? result.message : "Spreadsheet preview failed.");
        }

        const nextPreview = result as {
          totalRows: number;
          failed: Array<{ row: number; reason: string }>;
          previewRows: Array<{ companyName: string; primaryPhone: string; city?: string; address?: string; industry?: string }>;
        };
        setPreview(nextPreview);

        const starterOwnerId = role === "MARKETER"
          ? (currentUserId ?? "")
          : (defaultAssignedToId || ownerOptions[0]?.id || "");
        setAssignments(nextPreview.totalRows
          ? [createCustomerPdfAssignmentDraft(starterOwnerId, String(nextPreview.totalRows))]
          : []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Spreadsheet preview failed.");
      }
    });
  }, [currentUserId, defaultAssignedToId, ownerOptions, role]);

  const loadPreview = React.useCallback(() => {
    loadPreviewForFile(file);
  }, [file, loadPreviewForFile]);

  return (
    <FormModal open={open} title="Import Excel / CSV Customers" onClose={onClose} panelClassName="max-w-3xl">
      <div className="space-y-4">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">Excel / CSV File</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">File choose korlei marketer select ar row count section niche automatically chole ashbe.</p>
            </div>
            <Button type="button" variant="outline" onClick={loadPreview} disabled={previewing || importing}>
              <FileText className="h-4 w-4" />
              {previewing ? "Reading File..." : "Refresh Preview"}
            </Button>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              setPreview(null);
              setAssignments([]);
              setMessage("");
              if (nextFile) {
                loadPreviewForFile(nextFile);
              }
            }}
            className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
          />
          {file ? <p className="text-xs font-semibold text-slate-600">Selected: {file.name}</p> : null}
        </div>

        {file && previewing ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            File pora hocche. Tarpor marketer ar quantity section automatically show korbe.
          </div>
        ) : null}

        {role !== "MARKETER" ? (
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={assignLater}
              onChange={(event) => setAssignLater(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Optional: import first, assign later</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">Eta tick korle direct marketer assignment off hoye jabe, ar data age apnar list-e ashbe.</span>
            </span>
          </label>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-bold uppercase text-blue-600">Rows Ready</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{preview.totalRows}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-bold uppercase text-slate-500">File Type</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{file?.name.toLowerCase().endsWith(".csv") ? "CSV" : "Excel"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-bold uppercase text-slate-500">Preview Rows</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{preview.previewRows.length}</p>
              </div>
            </div>

            {preview.previewRows.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">File Preview</p>
                  <span className="text-xs font-semibold text-slate-500">First {preview.previewRows.length} rows</span>
                </div>
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Company</th>
                        <th className="px-3 py-2">Phone</th>
                        <th className="px-3 py-2">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {preview.previewRows.map((row, index) => (
                        <tr key={`${row.companyName}-${index}`}>
                          <td className="px-3 py-2 font-semibold text-slate-900">{row.companyName}</td>
                          <td className="px-3 py-2 text-slate-700">{row.primaryPhone}</td>
                          <td className="px-3 py-2 text-slate-600">{row.address || row.city || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {role !== "MARKETER" && !assignLater ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">Direct Marketer Assignment</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Ekhanei marketer select korun ar ke koto company/data pabe seta number diye din. Import dile oi marketer-er customer list-e direct chole jabe.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignments((current) => [...current, createCustomerPdfAssignmentDraft("", "")])}
                    disabled={importing}
                  >
                    <Plus className="h-4 w-4" />
                    Add marketer split
                  </Button>
                </div>

                <div className="mt-3 space-y-3">
                  {assignments.map((assignment, index) => (
                    <div key={assignment.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                      <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase text-slate-500">Marketer {index + 1}</span>
                        <select
                          value={assignment.assignedToId}
                          onChange={(event) => setAssignments((current) => current.map((item) => item.id === assignment.id ? { ...item, assignedToId: event.target.value } : item))}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                        >
                          <option value="">Select marketer</option>
                          {ownerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase text-slate-500">Row Count</span>
                        <Input
                          type="number"
                          min={1}
                          value={assignment.count}
                          onChange={(event) => setAssignments((current) => current.map((item) => item.id === assignment.id ? { ...item, count: event.target.value } : item))}
                          className="h-10 px-3 text-sm"
                        />
                      </label>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAssignments((current) => current.filter((item) => item.id !== assignment.id))}
                          disabled={assignments.length === 1}
                          className="text-slate-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={cn(
                  "mt-3 rounded-2xl px-4 py-3 text-sm font-semibold",
                  overflowRows > 0 ? "bg-red-50 text-red-800" : remainingRows === 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
                )}>
                  {overflowRows > 0
                    ? `Assigned ${assignedTotal} rows, but only ${preview.totalRows} rows are available. Reduce ${overflowRows} rows.`
                    : remainingRows > 0
                      ? `Assigned ${assignedTotal} of ${preview.totalRows} rows. The remaining ${remainingRows} rows will stay in your list for later assignment.`
                      : `Assigned all ${preview.totalRows} rows.`}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {role === "MARKETER"
                  ? "Imported spreadsheet rows will stay under your own marketer account."
                  : "Imported spreadsheet rows will stay under your admin/supervisor list first. After that, select exact customers with checkboxes and assign them to marketers."}
              </div>
            )}

            {preview.failed.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {preview.failed.length} rows could not be prepared. First issue: row {preview.failed[0].row} - {preview.failed[0].reason}
              </div>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!preview || importing || previewing || preview.totalRows === 0}
            onClick={() => {
              if (!file || !preview) {
                setMessage("Preview the spreadsheet before importing.");
                return;
              }

              if (role !== "MARKETER" && !assignLater) {
                const validAssignments = assignments.filter((assignment) => assignment.assignedToId.trim() && Number(assignment.count) > 0);
                const partialAssignments = assignments.filter((assignment) => assignment.assignedToId.trim() || Number(assignment.count) > 0);
                if (!validAssignments.length) {
                  setMessage("Add at least one marketer split before importing.");
                  return;
                }
                if (overflowRows > 0) {
                  setMessage(`Assigned quantity is ${overflowRows} rows more than the spreadsheet allows.`);
                  return;
                }
                if (partialAssignments.some((assignment) => !assignment.assignedToId.trim() || Number(assignment.count) <= 0)) {
                  setMessage("Each used marketer split needs both a marketer and a positive row count.");
                  return;
                }
              }

              startImport(async () => {
                setMessage("");
                try {
                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("mode", "assigned-import");
                  if (assignLater) {
                    formData.append("assignLater", "true");
                  }
                  if (role === "MARKETER" && currentUserId) {
                    formData.append("assignedToId", currentUserId);
                  } else if (!assignLater) {
                    formData.append("assignmentsJson", JSON.stringify(assignments
                      .filter((assignment) => assignment.assignedToId.trim() && Number(assignment.count) > 0)
                      .map((assignment) => ({
                      assignedToId: assignment.assignedToId.trim(),
                      count: Number(assignment.count) || 0,
                    }))));
                  }

                  const response = await fetch("/api/customers/import", {
                    method: "POST",
                    body: formData,
                  });
                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(typeof result.message === "string" ? result.message : "Customer spreadsheet import failed.");
                  }

                  await onImported(result as CustomerImportApiResult);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Customer spreadsheet import failed.");
                }
              });
            }}
          >
            <Upload className="h-4 w-4" />
            {importing ? "Importing..." : role !== "MARKETER" && !assignLater ? "Import Excel / CSV + Assign" : "Import Excel / CSV"}
          </Button>
          <Button type="button" variant="outline" disabled={importing || previewing} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </FormModal>
  );
}

function CustomerPdfImportModal({
  open,
  role,
  currentUserId,
  ownerOptions,
  defaultAssignedToId,
  onClose,
  onImported,
}: {
  open: boolean;
  role: Role;
  currentUserId?: string;
  ownerOptions: AssigneeOption[];
  defaultAssignedToId: string;
  onClose: () => void;
  onImported: (result: CustomerImportApiResult) => Promise<void> | void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<{
    totalRows: number;
    failed: Array<{ row: number; reason: string }>;
    previewRows: Array<{ companyName: string; primaryPhone: string; city?: string; address?: string; industry?: string }>;
    context?: { division?: string; district?: string; thana?: string; industry?: string };
  } | null>(null);
  const [assignments, setAssignments] = React.useState<CustomerPdfAssignmentDraft[]>([]);
  const [assignLater, setAssignLater] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [previewing, startPreview] = React.useTransition();
  const [importing, startImport] = React.useTransition();

  const assignedTotal = assignments.reduce((sum, assignment) => sum + Math.max(0, Number(assignment.count) || 0), 0);
  const overflowRows = preview ? Math.max(assignedTotal - preview.totalRows, 0) : 0;
  const remainingRows = preview ? Math.max(preview.totalRows - assignedTotal, 0) : 0;

  const loadPreviewForFile = React.useCallback((sourceFile: File | null) => {
    if (!sourceFile) {
      setMessage("Choose a PDF file first.");
      return;
    }

    if (!sourceFile.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Only .pdf files are supported in PDF import.");
      return;
    }

    startPreview(async () => {
      setMessage("");
      setPreview(null);
      try {
        const formData = new FormData();
        formData.append("file", sourceFile);
        formData.append("mode", "pdf-preview");

        const response = await fetch("/api/customers/import", {
          method: "POST",
          body: formData,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(typeof result.message === "string" ? result.message : "PDF preview failed.");
        }

        const nextPreview = result as {
          totalRows: number;
          failed: Array<{ row: number; reason: string }>;
          previewRows: Array<{ companyName: string; primaryPhone: string; city?: string; address?: string; industry?: string }>;
          context?: { division?: string; district?: string; thana?: string; industry?: string };
        };
        setPreview(nextPreview);

        const starterOwnerId = role === "MARKETER"
          ? (currentUserId ?? "")
          : (defaultAssignedToId || ownerOptions[0]?.id || "");
        setAssignments(nextPreview.totalRows
          ? [createCustomerPdfAssignmentDraft(starterOwnerId, String(nextPreview.totalRows))]
          : []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "PDF preview failed.");
      }
    });
  }, [currentUserId, defaultAssignedToId, ownerOptions, role]);

  const loadPreview = React.useCallback(() => {
    loadPreviewForFile(file);
  }, [file, loadPreviewForFile]);

  return (
    <FormModal open={open} title="Import PDF Customers" onClose={onClose} panelClassName="max-w-3xl">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">PDF Source File</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">PDF choose korlei marketer select ar quantity section niche automatically chole ashbe.</p>
            </div>
            <Button type="button" variant="outline" onClick={loadPreview} disabled={previewing || importing}>
              <FileText className="h-4 w-4" />
              {previewing ? "Reading PDF..." : "Refresh Preview"}
            </Button>
          </div>
          <input
            type="file"
            accept=".pdf"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setFile(nextFile);
              setPreview(null);
              setAssignments([]);
              setMessage("");
              if (nextFile) {
                loadPreviewForFile(nextFile);
              }
            }}
            className="mt-3 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700"
          />
          {file ? <p className="mt-2 text-xs font-semibold text-slate-600">Selected: {file.name}</p> : null}
        </div>

        {file && previewing ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
            PDF pora hocche. Tarpor marketer ar quantity section automatically show korbe.
          </div>
        ) : null}

        {role !== "MARKETER" ? (
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              checked={assignLater}
              onChange={(event) => setAssignLater(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Optional: import first, assign later</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">Eta tick korle direct marketer assignment off hoye jabe, ar data age apnar list-e ashbe.</span>
            </span>
          </label>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold uppercase text-blue-600">Rows Ready</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{preview.totalRows}</p>
            </div>

            {role !== "MARKETER" && !assignLater ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">Direct Marketer Assignment</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Ekhanei marketer select korun ar ke koto company/data pabe seta number diye din. Import dile oi marketer-er customer list-e direct chole jabe.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignments((current) => [...current, createCustomerPdfAssignmentDraft("", "")])}
                    disabled={importing}
                  >
                    <Plus className="h-4 w-4" />
                    Add marketer split
                  </Button>
                </div>

                <div className="mt-3 space-y-3">
                  {assignments.map((assignment, index) => (
                    <div key={assignment.id} className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                      <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase text-slate-500">Marketer {index + 1}</span>
                        <select
                          value={assignment.assignedToId}
                          onChange={(event) => setAssignments((current) => current.map((item) => item.id === assignment.id ? { ...item, assignedToId: event.target.value } : item))}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                        >
                          <option value="">Select marketer</option>
                          {ownerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-xs font-bold uppercase text-slate-500">Row Count</span>
                        <Input
                          type="number"
                          min={1}
                          value={assignment.count}
                          onChange={(event) => setAssignments((current) => current.map((item) => item.id === assignment.id ? { ...item, count: event.target.value } : item))}
                          className="h-10 px-3 text-sm"
                        />
                      </label>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setAssignments((current) => current.filter((item) => item.id !== assignment.id))}
                          disabled={assignments.length === 1}
                          className="text-slate-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={cn(
                  "mt-3 rounded-2xl px-4 py-3 text-sm font-semibold",
                  overflowRows > 0 ? "bg-red-50 text-red-800" : remainingRows === 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800",
                )}>
                  {overflowRows > 0
                    ? `Assigned ${assignedTotal} rows, but only ${preview.totalRows} rows are available. Reduce ${overflowRows} rows.`
                    : remainingRows > 0
                      ? `Assigned ${assignedTotal} of ${preview.totalRows} rows. The remaining ${remainingRows} rows will stay in your list for later assignment.`
                      : `Assigned all ${preview.totalRows} rows.`}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {role === "MARKETER"
                  ? "All parsed PDF rows will stay under your own marketer account."
                  : "All parsed PDF rows will stay under your admin/supervisor list first. After import, use checkboxes to assign exact customers to marketers."}
              </div>
            )}

            {preview.failed.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {preview.failed.length} rows could not be prepared. First issue: row {preview.failed[0].row} - {preview.failed[0].reason}
              </div>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!preview || importing || previewing || preview.totalRows === 0}
            onClick={() => {
              if (!file || !preview) {
                setMessage("Preview the PDF before importing.");
                return;
              }

              if (role !== "MARKETER" && !assignLater) {
                const validAssignments = assignments.filter((assignment) => assignment.assignedToId.trim() && Number(assignment.count) > 0);
                const partialAssignments = assignments.filter((assignment) => assignment.assignedToId.trim() || Number(assignment.count) > 0);
                if (!validAssignments.length) {
                  setMessage("Add at least one marketer split before importing.");
                  return;
                }
                if (overflowRows > 0) {
                  setMessage(`Assigned quantity is ${overflowRows} rows more than the PDF allows.`);
                  return;
                }
                if (partialAssignments.some((assignment) => !assignment.assignedToId.trim() || Number(assignment.count) <= 0)) {
                  setMessage("Each used marketer split needs both a marketer and a positive row count.");
                  return;
                }
              }

              startImport(async () => {
                setMessage("");
                try {
                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("mode", "pdf-import");
                  if (assignLater) {
                    formData.append("assignLater", "true");
                  }
                  if (role === "MARKETER" && currentUserId) {
                    formData.append("assignedToId", currentUserId);
                  } else if (!assignLater) {
                    formData.append("assignmentsJson", JSON.stringify(assignments
                      .filter((assignment) => assignment.assignedToId.trim() && Number(assignment.count) > 0)
                      .map((assignment) => ({
                      assignedToId: assignment.assignedToId.trim(),
                      count: Number(assignment.count) || 0,
                    }))));
                  }

                  const response = await fetch("/api/customers/import", {
                    method: "POST",
                    body: formData,
                  });
                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(typeof result.message === "string" ? result.message : "PDF import failed.");
                  }

                  await onImported(result as CustomerImportApiResult);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "PDF import failed.");
                }
              });
            }}
          >
            <Upload className="h-4 w-4" />
            {importing ? "Importing PDF..." : role !== "MARKETER" && !assignLater ? "Import PDF + Assign" : "Import PDF Data"}
          </Button>
          <Button type="button" variant="outline" disabled={importing || previewing} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </FormModal>
  );
}

function BulkCustomerAssignModal({
  open,
  ownerOptions,
  selectedCount,
  customerIds,
  onClose,
  onAssigned,
}: {
  open: boolean;
  ownerOptions: AssigneeOption[];
  selectedCount: number;
  customerIds: string[];
  onClose: () => void;
  onAssigned: (assignedToId: string, updatedCount: number) => Promise<void> | void;
}) {
  const [assignedToId, setAssignedToId] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setAssignedToId(ownerOptions[0]?.id ?? "");
    setMessage("");
  }, [open, ownerOptions]);

  return (
    <FormModal open={open} title="Assign Selected Customers" onClose={onClose} panelClassName="max-w-lg">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedCount) {
            setMessage("Select customers first.");
            return;
          }
          if (!assignedToId.trim()) {
            setMessage("Select a marketer.");
            return;
          }

          startTransition(async () => {
            setMessage("");
            try {
              const response = await fetch("/api/customers/assign", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  customerIds,
                  assignedToId,
                }),
              });
              const result = await response.json();

              if (!response.ok) {
                throw new Error(typeof result.message === "string" ? result.message : "Bulk assignment failed.");
              }

              await onAssigned(assignedToId, typeof result.updatedCount === "number" ? result.updatedCount : customerIds.length);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Bulk assignment failed.");
            }
          });
        }}
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-black text-slate-950">{selectedCount} customer{selectedCount === 1 ? "" : "s"} selected</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">These selected customers will move only to the marketer you choose here.</p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">Assign To Marketer</span>
          <select
            value={assignedToId}
            onChange={(event) => setAssignedToId(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          >
            <option value="">Select marketer</option>
            {ownerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            <UserPlus className="h-4 w-4" />
            {pending ? "Assigning..." : "Assign Selected"}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function CustomersPage({ role, workspace, previewMarketerId }: { role: Role; workspace: CrmWorkspace; previewMarketerId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const skippedInitialRefreshRef = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const [spreadsheetImportOpen, setSpreadsheetImportOpen] = React.useState(false);
  const [pdfImportOpen, setPdfImportOpen] = React.useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = React.useState(false);
  const [customers, setCustomers] = React.useState<CompanyRow[]>(() => workspace.companies);
  const [filteredCount, setFilteredCount] = React.useState(workspace.companies.length);
  const [viewCustomer, setViewCustomer] = React.useState<CompanyRow | null>(null);
  const [editCustomer, setEditCustomer] = React.useState<CompanyRow | null>(null);
  const [deleteCustomer, setDeleteCustomer] = React.useState<CompanyRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");
  const exportMenuRef = React.useRef<HTMLDivElement>(null);
  const [exportingFormat, setExportingFormat] = React.useState<"xlsx" | "csv" | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; title: string; message: string } | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = React.useState<string[]>([]);
  const [tableSearch, setTableSearch] = React.useState("");
  const [visibleCustomers, setVisibleCustomers] = React.useState<CompanyRow[]>(() => workspace.companies);
  const [pageCustomers, setPageCustomers] = React.useState<CompanyRow[]>(() => workspace.companies.slice(0, 10));
  const [bulkAction, setBulkAction] = React.useState<"delete" | "park" | null>(null);
  const [bulkProcessing, setBulkProcessing] = React.useState(false);
  const [bulkError, setBulkError] = React.useState("");
  const [filters, setFilters] = React.useState({
    search: "",
    city: "",
    industry: "",
    assignedToId: "all",
  });
  const ownerOptions = React.useMemo(() => getCustomerOwnerOptions(workspace, role), [role, workspace]);
  const selectedCount = selectedCustomerIds.length;
  const pageCustomerIds = React.useMemo(() => pageCustomers.map((customer) => customer.id), [pageCustomers]);
  const allPageCustomersSelected = pageCustomerIds.length > 0 && pageCustomerIds.every((id) => selectedCustomerIds.includes(id));
  const selectedCustomers = React.useMemo(
    () => customers.filter((customer) => selectedCustomerIds.includes(customer.id)),
    [customers, selectedCustomerIds],
  );
  const defaultImportOwnerId = role === "MARKETER"
    ? (workspace.user.id ?? "")
    : filters.assignedToId !== "all"
      ? filters.assignedToId
      : ownerOptions.length === 1
        ? ownerOptions[0].id
        : "";

  const refreshCustomers = React.useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.city.trim()) params.set("city", filters.city.trim());
    if (filters.industry.trim()) params.set("industry", filters.industry.trim());
    if (filters.assignedToId && filters.assignedToId !== "all") params.set("assignedToId", filters.assignedToId);
    if (previewMarketerId) params.set("previewMarketerId", previewMarketerId);

    const response = await fetch(`/api/customers?${params.toString()}`, { cache: "no-store" });
    const result = await response.json();

    if (!response.ok || !result.success || !Array.isArray(result.rows)) {
      throw new Error(typeof result.message === "string" ? result.message : "Failed to load customers.");
    }

    const rows = result.rows as CompanyRow[];
    setCustomers(rows);
    setSelectedCustomerIds((current) => current.filter((id) => rows.some((row) => row.id === id)));
    setFilteredCount(typeof result.summary?.count === "number" ? result.summary.count : rows.length);
    setViewCustomer((current) => current ? rows.find((item) => item.id === current.id) ?? null : null);
    setEditCustomer((current) => current ? rows.find((item) => item.id === current.id) ?? null : null);
    setDeleteCustomer((current) => current ? rows.find((item) => item.id === current.id) ?? null : null);
  }, [filters.assignedToId, filters.city, filters.industry, filters.search, previewMarketerId]);

  const handleViewCustomer = React.useCallback((customer: CompanyRow) => {
    setViewCustomer(customer);
  }, []);

  const handleEditCustomer = React.useCallback((customer: CompanyRow) => {
    setEditCustomer(customer);
  }, []);

  const clearCustomerModalParams = React.useCallback((paramKey: "editCustomerId") => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has(paramKey)) return;
    params.delete(paramKey);
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleDeleteCustomer = React.useCallback((customer: CompanyRow) => {
    setDeleteError("");
    setDeleteCustomer(customer);
  }, []);

  const toggleCustomerSelection = React.useCallback((customerId: string, checked: boolean) => {
    setSelectedCustomerIds((current) => {
      if (checked) {
        return current.includes(customerId) ? current : [...current, customerId];
      }
      return current.filter((id) => id !== customerId);
    });
  }, []);

  const columns = React.useMemo<ColumnDef<CompanyRow>[]>(
    () => {
      const baseColumns: ColumnDef<CompanyRow>[] = [
        {
          id: "serial",
          header: "No.",
          enableSorting: false,
          cell: ({ row }) => {
            const serial = customers.findIndex((customer) => customer.id === row.original.id) + 1;
            return (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedCustomerIds.includes(row.original.id)}
                  onChange={(event) => toggleCustomerSelection(row.original.id, event.target.checked)}
                  onClick={(event) => event.stopPropagation()}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  aria-label={`Select ${row.original.name}`}
                />
                <span className="min-w-6 text-sm font-black text-slate-700">{serial || "-"}</span>
              </div>
            );
          },
        },
        {
          accessorKey: "name",
          header: "Company Name",
          cell: ({ row }) => (
            <div className="space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleViewCustomer(row.original);
                  }}
                  className="text-left font-bold text-blue-700 transition hover:underline"
                >
                  {row.original.name}
                </button>
                {row.original.activityLabel ? (
                  <span
                    title={customerActivityTooltip(row.original)}
                    className={cn(
                      "inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]",
                      customerActivityBadgeClasses(row.original.activityTone),
                    )}
                  >
                    {row.original.activityLabel}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                Added by {row.original.createdBy || row.original.assignedTo || "-"}
              </p>
            </div>
          ),
        },
        {
          accessorKey: "phone",
          header: "Primary Phone",
          cell: ({ row }) => (
            <div className="space-y-2">
              <div className="font-semibold text-slate-700">{row.original.phone}</div>
              <InlineContactShortcuts phone={row.original.phone} whatsapp={row.original.whatsapp} compact />
            </div>
          ),
        },
        { accessorKey: "cityOrZilla", header: "City / Zilla" },
        { accessorKey: "address", header: "Address" },
        { accessorKey: "industry", header: "Industry" },
      ];

      if (role !== "MARKETER") {
        baseColumns.push({ accessorKey: "assignedTo", header: "Owner / Marketer" });
      }

      baseColumns.push({
        id: "Action",
        header: "Action",
        cell: ({ row }) => (
          <CustomerRowActions
            customer={row.original}
            onEdit={handleEditCustomer}
            onDelete={handleDeleteCustomer}
          />
        ),
      });

      return baseColumns;
    },
    [customers, handleViewCustomer, handleDeleteCustomer, handleEditCustomer, role, selectedCustomerIds, toggleCustomerSelection],
  );

  React.useEffect(() => {
    setCustomers(workspace.companies);
    setFilteredCount(workspace.companies.length);
    setVisibleCustomers(workspace.companies);
    setPageCustomers(workspace.companies.slice(0, 10));
  }, [workspace.companies]);

  React.useEffect(() => {
    const isDefaultFilterState =
      !filters.search.trim()
      && !filters.city.trim()
      && !filters.industry.trim()
      && filters.assignedToId === "all";
    const needsInitialSync = workspace.sidebarCounts?.customers !== undefined
      && workspace.companies.length !== workspace.sidebarCounts.customers;

    if (!skippedInitialRefreshRef.current && isDefaultFilterState && !needsInitialSync) {
      skippedInitialRefreshRef.current = true;
      return;
    }

    skippedInitialRefreshRef.current = true;
    void refreshCustomers().catch(() => {
      // Keep the server-rendered workspace snapshot if the live refresh fails.
    });
  }, [filters.assignedToId, filters.city, filters.industry, filters.search, refreshCustomers, workspace.companies.length, workspace.sidebarCounts?.customers]);

  React.useEffect(() => {
    if (!feedback) return undefined;

    const timeout = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  React.useEffect(() => {
    setSelectedCustomerIds((current) => current.filter((id) => visibleCustomers.some((customer) => customer.id === id)));
  }, [visibleCustomers]);

  const toggleSelectAllPageCustomers = React.useCallback(() => {
    setSelectedCustomerIds((current) => {
      if (allPageCustomersSelected) {
        return current.filter((id) => !pageCustomerIds.includes(id));
      }

      const next = new Set(current);
      for (const id of pageCustomerIds) {
        next.add(id);
      }
      return Array.from(next);
    });
  }, [allPageCustomersSelected, pageCustomerIds]);

  React.useEffect(() => {
    const editCustomerId = searchParams.get("editCustomerId")?.trim();
    if (!editCustomerId) return;

    const matchedCustomer = customers.find((customer) => customer.id === editCustomerId);
    if (!matchedCustomer) return;

    setEditCustomer(matchedCustomer);
    clearCustomerModalParams("editCustomerId");
  }, [clearCustomerModalParams, customers, searchParams]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleCustomerImportDone = React.useCallback(async (result: CustomerImportApiResult) => {
    const distributionNote = Array.isArray(result.distribution) && result.distribution.length
      ? ` Assigned across ${result.distribution.length} marketer${result.distribution.length > 1 ? "s" : ""}.`
      : "";
    const holdNote = typeof result.heldForLaterCount === "number" && result.heldForLaterCount > 0
      ? ` ${result.heldForLaterCount} row${result.heldForLaterCount === 1 ? "" : "s"} stayed in your list for later assignment.`
      : "";
    const assignmentModeNote = !distributionNote && role !== "MARKETER"
      ? " Imported rows are now under your list until you assign them."
      : "";
    setFeedback({
      type: "success",
      title: "Import complete",
      message: `${result.inserted} inserted, ${result.updated} updated, ${result.failed.length} failed.${distributionNote}${holdNote}${assignmentModeNote}${result.failed.length ? ` First issue: row ${result.failed[0].row} - ${result.failed[0].reason}` : ""}`,
    });
    await refreshCustomers();
    router.refresh();
  }, [refreshCustomers, role, router]);

  const handleExport = async (format: "xlsx" | "csv") => {
    setExportMenuOpen(false);
    setExportingFormat(format);
    setFeedback(null);

    try {
      const params = new URLSearchParams();
      if (format === "csv") params.set("format", "csv");
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.city.trim()) params.set("city", filters.city.trim());
      if (filters.industry.trim()) params.set("industry", filters.industry.trim());
      if (filters.assignedToId && filters.assignedToId !== "all") params.set("assignedToId", filters.assignedToId);

      const response = await fetch(`/api/customers/export?${params.toString()}`);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message ?? "Customer export failed.");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const fallbackFileName = `crm_full_export_${new Date().toISOString().slice(0, 10)}.${format === "csv" ? "csv" : "xlsx"}`;
      const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
      const fileName = match?.[1] || fallbackFileName;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setFeedback({
        type: "success",
        title: "Export ready",
        message: `Customer ${format.toUpperCase()} export downloaded successfully.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        title: "Export failed",
        message: error instanceof Error ? error.message : "Customer export failed.",
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCustomer) return;

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/customers/${deleteCustomer.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Customer delete failed.");
      }

      setCustomers((prev) => prev.filter((customer) => customer.id !== deleteCustomer.id));
      setSelectedCustomerIds((current) => current.filter((id) => id !== deleteCustomer.id));
      setDeleteCustomer(null);
      setFeedback({
        type: "success",
        title: "Customer removed",
        message: "Customer deleted successfully.",
      });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Customer delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (!selectedCustomerIds.length) return;

    setBulkProcessing(true);
    setBulkError("");

    try {
      const failed: string[] = [];
      for (const customer of selectedCustomers) {
        const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          failed.push(typeof result.message === "string" ? `${customer.name}: ${result.message}` : customer.name);
        }
      }

      if (failed.length) {
        throw new Error(failed.slice(0, 2).join(" | "));
      }

      setCustomers((prev) => prev.filter((customer) => !selectedCustomerIds.includes(customer.id)));
      setSelectedCustomerIds([]);
      setBulkAction(null);
      setFeedback({
        type: "success",
        title: "Customers deleted",
        message: `${selectedCustomers.length} customer${selectedCustomers.length === 1 ? "" : "s"} deleted successfully.`,
      });
      await refreshCustomers();
      router.refresh();
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Selected customers delete failed.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkParkConfirm = async () => {
    if (!selectedCustomerIds.length) return;

    setBulkProcessing(true);
    setBulkError("");

    try {
      const until = new Date();
      until.setFullYear(until.getFullYear() + 1);
      const failed: string[] = [];

      for (const customer of selectedCustomers) {
        const response = await fetch(`/api/customers/${customer.id}/park`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            until: until.toISOString(),
            note: "Moved to Cold Customers from bulk selection.",
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          failed.push(typeof result.message === "string" ? `${customer.name}: ${result.message}` : customer.name);
        }
      }

      if (failed.length) {
        throw new Error(failed.slice(0, 2).join(" | "));
      }

      setCustomers((prev) => prev.filter((customer) => !selectedCustomerIds.includes(customer.id)));
      setSelectedCustomerIds([]);
      setBulkAction(null);
      setFeedback({
        type: "success",
        title: "Moved to Cold Customers",
        message: `${selectedCustomers.length} customer${selectedCustomers.length === 1 ? "" : "s"} moved successfully.`,
      });
      await refreshCustomers();
      router.refresh();
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Selected customers move failed.");
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleEditDone = (updatedCustomer: CompanyRow | null) => {
    setEditCustomer(null);
    void refreshCustomers().catch(() => {
      // Fallback to local optimistic state below if live refresh fails.
    });
    router.refresh();
    if (updatedCustomer?.id) {
      setCustomers((prev) => prev.map((customer) => customer.id === updatedCustomer.id ? updatedCustomer : customer));
    }
    setFeedback({
      type: "success",
      title: "Customer updated",
      message: "Customer details updated successfully.",
    });
  };

  const handleCreateDone = () => {
    setOpen(false);
    void refreshCustomers().catch(() => {
      // The router refresh keeps the page consistent if the live fetch fails.
    });
    router.refresh();
  };

  return (
    <>
      <PageHeader
        title="Customer / Companies"
        description="Central customer records, contacts, industries, assignment, and communication history."
        actions={(
          <>
            <Button type="button" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPdfImportOpen(true)}>
              <FileText className="h-4 w-4" />
              Import PDF
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSpreadsheetImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import Excel / CSV
            </Button>
            <div ref={exportMenuRef} className="relative">
              <Button type="button" size="sm" variant="outline" disabled={Boolean(exportingFormat)} onClick={() => setExportMenuOpen((open) => !open)}>
                <Download className="h-4 w-4" />
                {exportingFormat ? `Exporting ${exportingFormat.toUpperCase()}...` : "Export"}
                <ChevronDown className="h-4 w-4" />
              </Button>
              {exportMenuOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  <button type="button" className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" onClick={() => handleExport("xlsx")}>
                    Excel (.xlsx)
                  </button>
                  <button type="button" className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900" onClick={() => handleExport("csv")}>
                    CSV
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}
      />
      <AnimatePresence>
        {feedback ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "fixed right-6 top-24 z-40 max-w-sm rounded-2xl border px-4 py-3 shadow-xl",
              feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900",
            )}
          >
            <p className="text-sm font-black">{feedback.title}</p>
            <p className="mt-1 text-xs font-semibold">{feedback.message}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Search</span>
            <Input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search company, phone, call, follow-up, quotation..."
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">City / Zilla</span>
            <Input
              list="bd-districts"
              value={filters.city}
              onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))}
              placeholder="Filter by city"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Industry</span>
            <Input
              value={filters.industry}
              onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value }))}
              placeholder="Filter by industry"
            />
          </label>
          {role !== "MARKETER" ? (
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Marketer</span>
              <select
                value={filters.assignedToId}
                onChange={(event) => setFilters((current) => ({ ...current, assignedToId: event.target.value }))}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">All Marketers</option>
                {ownerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        <datalist id="bd-districts">
          {BANGLADESH_DISTRICTS.map((district) => (
            <option key={district} value={district} />
          ))}
        </datalist>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-semibold text-slate-600">
            Showing <span className="font-black text-slate-900">{filteredCount}</span> visible customers
            {role !== "MARKETER" && filters.assignedToId !== "all"
              ? <span className="text-slate-500"> for the selected marketer</span>
              : null}
          </p>
          {(filters.search || filters.city || filters.industry || (role !== "MARKETER" && filters.assignedToId !== "all")) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilters({ search: "", city: "", industry: "", assignedToId: "all" })}
            >
              Reset Filters
            </Button>
          ) : null}
        </div>
      </div>
      <div
        className={cn(
          "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-colors",
          selectedCount ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white",
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            selectedCount ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500",
          )}>
            <ListChecks className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-black text-slate-950">
              {selectedCount ? `${selectedCount} customer${selectedCount === 1 ? "" : "s"} selected` : "Select customers"}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              Use "Select All" to pick every customer on this page, then delete or move them to Cold Customers together.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!pageCustomers.length}
            onClick={toggleSelectAllPageCustomers}
          >
            <ListChecks className="h-4 w-4" />
            {allPageCustomersSelected ? "Unselect Page" : "Select All"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectedCount}
            onClick={() => setSelectedCustomerIds([])}
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectedCount}
            onClick={() => {
              setBulkError("");
              setBulkAction("park");
            }}
          >
            <Snowflake className="h-4 w-4" />
            Move to Cold Customers
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={!selectedCount}
            onClick={() => {
              setBulkError("");
              setBulkAction("delete");
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
      {role !== "MARKETER" ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-black text-slate-950">Manual marketer assignment</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              District, industry, marketer, and search filter use kore visible customer select kore marketer-er kache pathate parben.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {selectedCount} selected
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!visibleCustomers.length}
              onClick={() => setSelectedCustomerIds(visibleCustomers.map((customer) => customer.id))}
            >
              Select Visible Results
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedCount || ownerOptions.length === 0}
              onClick={() => setBulkAssignOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              Assign Selected
            </Button>
          </div>
        </div>
      ) : null}
      <DataTable
        data={customers}
        columns={columns}
        searchPlaceholder="Refine visible customers..."
        globalFilterValue={tableSearch}
        onGlobalFilterValueChange={setTableSearch}
        onVisibleRowsChange={setVisibleCustomers}
        onPageRowsChange={setPageCustomers}
        onRowClick={handleViewCustomer}
      />
      <FormModal open={open} title="Create Customer / Company" onClose={() => setOpen(false)}>
        <CustomerForm workspace={workspace} onDone={handleCreateDone} />
      </FormModal>
      <CustomerSpreadsheetImportModal
        key={spreadsheetImportOpen ? "customer-spreadsheet-import-open" : "customer-spreadsheet-import-closed"}
        open={spreadsheetImportOpen}
        role={role}
        currentUserId={workspace.user.id}
        ownerOptions={ownerOptions}
        defaultAssignedToId={defaultImportOwnerId}
        onClose={() => setSpreadsheetImportOpen(false)}
        onImported={async (result) => {
          setSpreadsheetImportOpen(false);
          await handleCustomerImportDone(result);
        }}
      />
      <CustomerPdfImportModal
        key={pdfImportOpen ? "customer-pdf-import-open" : "customer-pdf-import-closed"}
        open={pdfImportOpen}
        role={role}
        currentUserId={workspace.user.id}
        ownerOptions={ownerOptions}
        defaultAssignedToId={defaultImportOwnerId}
        onClose={() => setPdfImportOpen(false)}
        onImported={async (result) => {
          setPdfImportOpen(false);
          await handleCustomerImportDone(result);
        }}
      />
      <BulkCustomerAssignModal
        open={bulkAssignOpen}
        ownerOptions={ownerOptions}
        selectedCount={selectedCount}
        customerIds={selectedCustomerIds}
        onClose={() => setBulkAssignOpen(false)}
        onAssigned={async (assignedToId, updatedCount) => {
          const ownerLabel = ownerOptions.find((option) => option.id === assignedToId)?.label ?? "the selected marketer";
          setBulkAssignOpen(false);
          setSelectedCustomerIds([]);
          await refreshCustomers();
          router.refresh();
          setFeedback({
            type: "success",
            title: "Customers assigned",
            message: `${updatedCount} customer${updatedCount === 1 ? "" : "s"} assigned to ${ownerLabel}.`,
          });
        }}
      />
      <CustomerViewModal
        role={role}
        workspace={workspace}
        open={Boolean(viewCustomer)}
        customer={viewCustomer}
        onClose={() => setViewCustomer(null)}
        onParked={() => {
          setViewCustomer(null);
          void refreshCustomers().catch(() => {});
        }}
      />
      <CustomerEditModal workspace={workspace} customer={editCustomer} open={Boolean(editCustomer)} onDone={handleEditDone} onClose={() => setEditCustomer(null)} />
      <FormModal open={Boolean(deleteCustomer)} title="Delete Customer" onClose={() => !deleting && setDeleteCustomer(null)} panelClassName="max-w-md">
        {deleteCustomer ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete this customer?
            </p>
            <p className="text-sm font-black text-slate-900">{deleteCustomer.name}</p>
            {deleteError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{deleteError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteCustomer(null)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </FormModal>
      <FormModal
        open={bulkAction === "delete"}
        title="Delete Selected Customers"
        onClose={() => !bulkProcessing && setBulkAction(null)}
        panelClassName="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to delete {selectedCount} selected customer{selectedCount === 1 ? "" : "s"}?
          </p>
          {bulkError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{bulkError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" onClick={handleBulkDeleteConfirm} disabled={bulkProcessing || !selectedCount}>
              {bulkProcessing ? "Deleting..." : "Delete Selected"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setBulkAction(null)} disabled={bulkProcessing}>
              Cancel
            </Button>
          </div>
        </div>
      </FormModal>
      <FormModal
        open={bulkAction === "park"}
        title="Move Selected to Cold Customers"
        onClose={() => !bulkProcessing && setBulkAction(null)}
        panelClassName="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Move {selectedCount} selected customer{selectedCount === 1 ? "" : "s"} to Cold Customers? They will be hidden from the main list.
          </p>
          {bulkError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{bulkError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleBulkParkConfirm} disabled={bulkProcessing || !selectedCount}>
              {bulkProcessing ? "Moving..." : "Move Selected"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setBulkAction(null)} disabled={bulkProcessing}>
              Cancel
            </Button>
          </div>
        </div>
      </FormModal>
    </>
  );
}

type ColdCustomerRow = {
  id: string;
  name: string;
  industry: string;
  city: string | null;
  phone: string;
  assignedToId: string | null;
  assignedTo: string;
  parkedUntil: string | null;
  parkedNote: string;
  parkedAt: string | null;
  parkedById: string | null;
  parkedBy: string;
};

export function ColdCustomersPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  const { refreshCustomerCount, refreshColdCustomerCount } = useTaskCounterContext();
  const [rows, setRows] = React.useState<ColdCustomerRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [bringingBackId, setBringingBackId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const refreshColdCustomers = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/customers/cold", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.rows)) {
        throw new Error(typeof result.message === "string" ? result.message : "Failed to load cold customers.");
      }
      setRows(result.rows as ColdCustomerRow[]);
      void refreshColdCustomerCount();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load cold customers.");
    } finally {
      setLoading(false);
    }
  }, [refreshColdCustomerCount]);

  React.useEffect(() => {
    void refreshColdCustomers();
  }, [refreshColdCustomers]);

  const handleBringBack = async (row: ColdCustomerRow) => {
    setBringingBackId(row.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/customers/${row.id}/unpark`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(typeof result.message === "string" ? result.message : "Failed to bring back customer.");
      }
      setRows((current) => current.filter((item) => item.id !== row.id));
      void refreshCustomerCount();
      void refreshColdCustomerCount();
      setFeedback({ type: "success", message: `${row.name} is back in the active Customers list.` });
    } catch (bringBackError) {
      setFeedback({ type: "error", message: bringBackError instanceof Error ? bringBackError.message : "Failed to bring back customer." });
    } finally {
      setBringingBackId(null);
    }
  };

  const columns = React.useMemo<ColumnDef<ColdCustomerRow>[]>(() => [
    {
      accessorKey: "name",
      header: "Customer",
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/customers/${row.original.id}`} className="font-bold text-slate-950 hover:text-blue-700">
            {row.original.name}
          </Link>
          <p className="text-xs text-slate-500">{row.original.industry || "-"} • {row.original.city || "-"}</p>
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.phone || "-",
    },
    {
      accessorKey: "assignedTo",
      header: "Assigned",
      cell: ({ row }) => <Badge variant="neutral">{row.original.assignedTo}</Badge>,
    },
    {
      accessorKey: "parkedUntil",
      header: "Follow-up again on",
      cell: ({ row }) => (
        <span className="font-black text-slate-950">
          {row.original.parkedUntil ? new Date(row.original.parkedUntil).toLocaleDateString() : "-"}
        </span>
      ),
    },
    {
      accessorKey: "parkedBy",
      header: "Parked by",
    },
    {
      accessorKey: "parkedNote",
      header: "Note",
      cell: ({ row }) => <span className="text-sm text-slate-600">{row.original.parkedNote || "-"}</span>,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bringingBackId === row.original.id}
          onClick={(event) => {
            event.stopPropagation();
            void handleBringBack(row.original);
          }}
        >
          {bringingBackId === row.original.id ? "Bringing back..." : "Bring Back"}
        </Button>
      ),
    },
  ], [bringingBackId]);

  return (
    <>
      <PageHeader
        title="Cold Customers"
        description="Customers parked for a long-term follow-up. Nothing is deleted — bring any of them back to the active list whenever you're ready."
      />
      {feedback ? (
        <div className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
          {feedback.message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm font-semibold text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading cold customers...
        </div>
      ) : rows.length ? (
        <DataTable data={rows} columns={columns} searchPlaceholder="Search cold customers..." />
      ) : (
        <EmptyState title="No cold customers" description="Customers you park for a long-term follow-up will show up here." />
      )}
    </>
  );
}

type MarketerSuggestionSentRow = {
  id: string;
  message: string;
  senderName: string;
  createdAt: string;
};

export function MarketerDashboardPreviewPanel({
  role,
  marketerId,
  marketerName,
  workspace,
  initialActiveTasks,
  initialCompletedTasks,
  followUpPage,
  dashboardContent,
}: {
  role: Role;
  marketerId: string;
  marketerName: string;
  workspace: CrmWorkspace;
  initialActiveTasks: TodayWorkQueueItem[];
  initialCompletedTasks: CompletedWorkItem[];
  followUpPage: FollowUpPageData;
  dashboardContent: React.ReactNode;
}) {
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [sentSuggestions, setSentSuggestions] = React.useState<MarketerSuggestionSentRow[]>([]);
  const [loadingSent, setLoadingSent] = React.useState(true);

  const refreshSentSuggestions = React.useCallback(async () => {
    setLoadingSent(true);
    try {
      const response = await fetch(`/api/team/${marketerId}/suggestions`, { cache: "no-store" });
      const result = await response.json();
      if (response.ok && result.success && Array.isArray(result.rows)) {
        setSentSuggestions(result.rows as MarketerSuggestionSentRow[]);
      }
    } catch {
      // keep previous state on temporary failure
    } finally {
      setLoadingSent(false);
    }
  }, [marketerId]);

  React.useEffect(() => {
    void refreshSentSuggestions();
  }, [refreshSentSuggestions]);

  const handleSend = async () => {
    if (!message.trim()) {
      setFeedback({ type: "error", message: "Write a suggestion before sending." });
      return;
    }

    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/team/${marketerId}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(typeof result.message === "string" ? result.message : "Failed to send suggestion.");
      }

      setMessage("");
      setFeedback({ type: "success", message: `Suggestion sent to ${marketerName}.` });
      void refreshSentSuggestions();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Failed to send suggestion." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link
        href={role === "ADMIN" ? "/admin/dashboard" : "/supervisor/dashboard"}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </Link>
      <PageHeader
        title={`${marketerName}'s Workspace`}
        description="Read-only preview — actions here won't affect real data. Use it to review work and send a suggestion below."
      />
      <Tabs
        tabs={[
          { label: "Dashboard", value: "dashboard" },
          { label: "Tasks", value: "tasks" },
          { label: "Follow-ups", value: "followups" },
          { label: "Customers", value: "customers" },
          { label: "Leads", value: "leads" },
          { label: "Communication", value: "communication" },
          { label: "Reports", value: "reports" },
          { label: "Rewards", value: "rewards" },
        ]}
        defaultValue="dashboard"
      >
        {(tab) => (
          <div className="pointer-events-none select-none">
            {tab === "dashboard" ? dashboardContent : null}
            {tab === "tasks" ? (
              <TasksPage
                role="MARKETER"
                workspace={workspace}
                initialActiveTasks={initialActiveTasks}
                initialCompletedTasks={initialCompletedTasks}
                previewMarketerId={marketerId}
              />
            ) : null}
            {tab === "followups" ? <FollowUpsPage workspace={workspace} followUpPage={followUpPage} /> : null}
            {tab === "customers" ? <CustomersPage role="MARKETER" workspace={workspace} previewMarketerId={marketerId} /> : null}
            {tab === "leads" ? <LeadsPage role="MARKETER" workspace={workspace} previewMarketerId={marketerId} /> : null}
            {tab === "communication" ? <CommunicationPage workspace={workspace} initialActivityQuery="" initialCustomerQuery="" /> : null}
            {tab === "reports" ? <ReportsPage workspace={workspace} /> : null}
            {tab === "rewards" ? <RewardsPage role="MARKETER" workspace={workspace} /> : null}
          </div>
        )}
      </Tabs>
      <DashboardCard title="Send Suggestion">
        <div className="space-y-3">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
            placeholder={`Write a suggestion for ${marketerName}...`}
          />
          {feedback ? (
            <p className={cn("rounded-lg px-3 py-2 text-xs font-semibold", feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
              {feedback.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" className="min-w-32" disabled={sending} onClick={() => void handleSend()}>
              {sending ? "Sending..." : "Send Suggestion"}
            </Button>
          </div>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Recently Sent</p>
          {loadingSent ? (
            <p className="mt-2 text-sm text-slate-500">Loading...</p>
          ) : sentSuggestions.length ? (
            <div className="mt-3 space-y-2">
              {sentSuggestions.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-sm text-slate-700">{item.message}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {item.senderName} • {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No suggestions sent to {marketerName} yet.</p>
          )}
        </div>
      </DashboardCard>
    </div>
  );
}

export function CustomerProfilePage({
  role,
  workspace,
  customer,
  history,
  journey,
  backHref,
}: {
  role: Role;
  workspace: CrmWorkspace;
  customer?: CompanyRow;
  history: CustomerHistory;
  journey: CustomerJourneySummary;
  backHref?: string;
}) {
  const active = customer;
  const [historyState, setHistoryState] = React.useState(history);
  const [followUpOpen, setFollowUpOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<UserFeedback>(null);
  const [pendingShortcut, setPendingShortcut] = React.useState<CustomerCommunicationShortcutMethod | null>(null);

  React.useEffect(() => {
    setHistoryState(history);
  }, [history]);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 2800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  if (!active) return <EmptyState title="Customer not found" description="The requested customer is not available in your CRM scope." />;

  const callPhone = normalizeDialPhone(active.phone);
  const whatsappPhone = normalizeWhatsAppPhone(active.whatsapp || active.phone);
  const shortcutPending = pendingShortcut !== null;

  const callHref = callPhone ? `tel:${callPhone}` : "";
  const whatsappHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent("Hello, this is Mugnee CRM regarding your inquiry.")}`
    : undefined;
  const customerEmail = normalizeEmailAddress(active.emailOptions[0] ?? active.email);
  const gmailComposeHref = customerEmail
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(customerEmail)}`
    : undefined;
  const phoneDetails = [active.phone, active.whatsapp].filter((value) => value && value !== "-").join(", ") || "-";
  const latestCommunications = historyState.communications.slice(0, 6);
  const latestFollowUps = historyState.followUps.slice(0, 6);
  const primaryAssignedTo = active.assignedTo || latestFollowUps.find((item) => item.assignedTo && item.assignedTo !== "-")?.assignedTo || "-";
  const overviewAssignedTo = journey.assignedMarketer !== "-" ? journey.assignedMarketer : primaryAssignedTo;

  const appendCommunicationHistory = React.useCallback((result: Awaited<ReturnType<typeof logCustomerCommunicationShortcutAction>>) => {
    if (!result?.ok || !result.communication || !result.activity) return;

    setHistoryState((current) => ({
      ...current,
      communications: prependUniqueById(current.communications, result.communication),
      activities: prependUniqueById(current.activities, result.activity),
    }));
  }, []);

  const logCommunication = React.useCallback((method: CustomerCommunicationShortcutMethod, action: string) => {
    void logCustomerCommunicationShortcutAction({
      customerId: active.id,
      customerName: active.name,
      method,
      action,
    })
      .then((result) => {
        if (result?.ok) {
          appendCommunicationHistory(result);
          return;
        }

        if (typeof result?.message === "string") {
          setFeedback({ type: "error", message: result.message });
        }
      })
      .catch(() => {
        setFeedback({ type: "error", message: "Failed to save communication history." });
      });
  }, [active.id, active.name, appendCommunicationHistory]);

  const handleCommunicationShortcut = React.useCallback(async ({
    method,
    href,
    action,
  }: {
    method: CustomerCommunicationShortcutMethod;
    href: string;
    action: string;
  }) => {
    if (!href || shortcutPending) return;
    setPendingShortcut(method);

    try {
      const result = await logCustomerCommunicationShortcutAction({
        customerId: active.id,
        customerName: active.name,
        method,
        action,
      });

      if (result?.ok) {
        appendCommunicationHistory(result);
      } else if (typeof result?.message === "string") {
        setFeedback({ type: "error", message: result.message });
        return;
      }
    } catch (error) {
      console.error("Failed to log customer communication shortcut.", error);
      setFeedback({ type: "error", message: "Failed to save communication history." });
      return;
    } finally {
      setPendingShortcut(null);
    }

    window.location.href = href;
  }, [active.id, active.name, appendCommunicationHistory, shortcutPending]);

  const scheduleWhatsappLog = React.useCallback(() => {
    window.setTimeout(() => {
      logCommunication("WHATSAPP", "WhatsApp chat opened from customer details page.");
    }, 0);
  }, [logCommunication]);

  const handleInvalidWhatsappClick = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setFeedback({ type: "error", message: "Valid WhatsApp number not found" });
  }, []);

  const scheduleEmailComposeLog = React.useCallback(() => {
    window.setTimeout(() => {
      logCommunication("EMAIL", "EMAIL_COMPOSE_OPENED");
    }, 0);
  }, [logCommunication]);

  const handleInvalidEmailClick = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setFeedback({ type: "error", message: "Valid customer email not found" });
  }, []);

  const customerAddress =
    (typeof active.address === "string" ? active.address.trim() : "") ||
    (typeof active.cityOrZilla === "string" ? active.cityOrZilla.trim() : "") ||
    "-";

  return (
    <>
      <FloatingFeedback feedback={feedback} />
      <Link href={backHref || rolePath(role, "customers")} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-slate-950">{active.name}</h1>
              <StatusBadge value={active.status} />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500">Company details ar recent CRM update shudhu compact vabe dekhanor jonno ei page-ta short kora holo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={!callHref || shortcutPending}
              onClick={() => void handleCommunicationShortcut({
                method: "CALL",
                href: callHref,
                action: "Call initiated from customer details page.",
              })}
            >
              <Phone className="h-4 w-4" />
              Call
            </Button>
            <motion.span
              whileHover={whatsappHref && !shortcutPending ? { y: -1 } : undefined}
              whileTap={whatsappHref && !shortcutPending ? { scale: 0.98 } : undefined}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="inline-flex"
            >
              <a
                href={whatsappHref ?? "#"}
                target={whatsappHref ? "_blank" : undefined}
                rel={whatsappHref ? "noopener noreferrer" : undefined}
                aria-disabled={!whatsappHref}
                onClick={whatsappHref ? scheduleWhatsappLog : handleInvalidWhatsappClick}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  !whatsappHref && "cursor-not-allowed border-slate-200 bg-white text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-400",
                  shortcutPending && "pointer-events-none opacity-50",
                )}
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </a>
            </motion.span>
            <motion.span
              whileHover={gmailComposeHref ? { y: -1 } : undefined}
              whileTap={gmailComposeHref ? { scale: 0.98 } : undefined}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="inline-flex"
            >
              <a
                href={gmailComposeHref ?? "#"}
                target={gmailComposeHref ? "_blank" : undefined}
                rel={gmailComposeHref ? "noopener noreferrer" : undefined}
                aria-disabled={!gmailComposeHref}
                onClick={gmailComposeHref ? scheduleEmailComposeLog : handleInvalidEmailClick}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  !gmailComposeHref && "cursor-not-allowed border-slate-200 bg-white text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-400",
                )}
              >
                <Mail className="h-4 w-4" />
                Email
              </a>
            </motion.span>
            <Button variant="outline" size="sm" type="button" onClick={() => setFollowUpOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              Add Follow-up
            </Button>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <dl className="divide-y divide-slate-100">
            <DetailRow label="Contact Person" value={active.contactPerson || "-"} />
            <DetailRow label="Phone" value={phoneDetails} />
            <DetailRow label="Email" value={active.email || "-"} />
            <DetailRow label="Industry" value={active.industry || "-"} />
            <DetailRow label="Address" value={customerAddress} />
            <DetailRow label="Website" value={active.website || "-"} />
            <DetailRow label="Assigned Marketer" value={primaryAssignedTo} />
            <DetailRow label="Customer Note" value={active.notes || "-"} />
          </dl>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">Overview</h2>
            <p className="text-sm text-slate-500">Admin ar supervisor jeno ek nojore customer journey, recent touchpoint, ar next step bujhte pare, oi jonno real CRM activity diye overview-ta sajano hoyeche.</p>
          </div>
          <Badge variant="neutral" className="rounded-full px-3 py-1 text-xs font-bold">{overviewAssignedTo}</Badge>
        </div>
        <div className="mt-5 space-y-5">
          <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">Customer Journey</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">Pipeline Progress</h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">Task, communication, follow-up, demo, quotation, ar sales outcome theke current stage auto-detect hocche. Kono fake timeline use kora hocche na.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={customerJourneyStatusVariant(journey.status)} className="rounded-full px-3 py-1 text-xs font-bold">{journey.currentStage}</Badge>
                <Badge variant="neutral" className="rounded-full px-3 py-1 text-xs font-bold">{historyState.communications.length} Communications</Badge>
                <Badge variant="neutral" className="rounded-full px-3 py-1 text-xs font-bold">{historyState.followUps.length} Follow-ups</Badge>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto pb-1">
              <div className="flex min-w-max items-stretch gap-3">
                {journey.steps.map((step, index) => (
                  <React.Fragment key={step.key}>
                    <div className={cn("flex min-h-[164px] w-[220px] shrink-0 flex-col rounded-[24px] border p-4 transition", customerJourneyStepTone(step))}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-2xl border", step.state === "pending" ? "border-slate-200 bg-slate-50 text-slate-400" : "border-white/60 bg-white/80")}>
                          {step.state === "pending" ? <CircleDashed className="h-4 w-4" /> : step.current ? <CircleDot className="h-4 w-4" /> : <CustomerJourneyStepIcon stageKey={step.key} />}
                        </span>
                        <Badge variant={customerJourneyStepBadgeVariant(step)} className="rounded-full px-2.5 py-1 text-[11px] font-black">
                          {step.current ? "Current" : step.reached ? "Done" : "Pending"}
                        </Badge>
                      </div>
                      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em]">{step.label}</p>
                      <p className="mt-2 text-sm font-semibold leading-6">{step.helper}</p>
                      <p className={cn("mt-auto pt-4 text-xs font-bold", step.date === "-" ? "text-slate-400" : "text-current/80")}>
                        {step.date === "-" ? "No timestamp yet" : step.date}
                      </p>
                    </div>
                    {index < journey.steps.length - 1 ? (
                      <div className={cn("mt-20 h-1 w-10 shrink-0 rounded-full", step.reached ? "bg-blue-200" : "bg-slate-200")} />
                    ) : null}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_320px]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Recent Calls / Communication</h3>
                  <p className="mt-1 text-sm text-slate-500">Newest customer communication first.</p>
                </div>
                <span className="text-xs font-bold text-slate-400">{historyState.communications.length} total</span>
              </div>
              <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {latestCommunications.length ? latestCommunications.map((item) => (
                  <CustomerOverviewItem
                    key={item.id}
                    title={`${item.method} by ${item.createdBy || "-"}`}
                    meta={item.time || "-"}
                    badge={<StatusBadge value={item.method} />}
                    note={[item.summary, item.notes !== "-" ? `Note: ${item.notes}` : "", item.nextFollowUpDate !== "-" ? `Next Follow-up: ${item.nextFollowUpDate}` : ""].filter(Boolean).join(" | ")}
                  />
                )) : (
                  <CustomerOverviewEmpty title="No communication yet" description="Ei customer-er jonno ekhono kono call, WhatsApp, ba email activity save hoyni." />
                )}
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Follow-up Status</h3>
                  <p className="mt-1 text-sm text-slate-500">Upcoming, due, completed, ar assigned owner ekhane thakbe.</p>
                </div>
                <span className="text-xs font-bold text-slate-400">{historyState.followUps.length} total</span>
              </div>
              <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {latestFollowUps.length ? latestFollowUps.map((item) => (
                  <CustomerOverviewItem
                    key={item.id}
                    title={`${item.method} • Assigned to ${item.assignedTo || "-"}`}
                    meta={item.followUpDate || "-"}
                    badge={<StatusBadge value={item.status} />}
                    note={[item.note, item.nextDiscussionPlan !== "-" ? `Next: ${item.nextDiscussionPlan}` : "", `Status: ${item.status}`].filter(Boolean).join(" | ")}
                  />
                )) : (
                  <CustomerOverviewEmpty title="No follow-up yet" description="Ei customer-er jonno ekhono kono follow-up schedule hoyni." />
                )}
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Next Action Summary</h3>
                  <p className="mt-1 text-sm text-slate-500">Current stage ar next follow-up snapshot.</p>
                </div>
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div className="mt-4 rounded-[22px] border border-blue-100 bg-blue-50/70 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600">Current Stage</p>
                <p className="mt-2 text-lg font-black text-slate-950">{journey.currentStage}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{journey.stageSummary}</p>
              </div>
              <div className="mt-4 space-y-3">
                <CustomerOverviewSummaryRow
                  label="Last Activity"
                  muted={journey.lastActivity === "No activity yet"}
                  value={
                    <>
                      <div>{journey.lastActivity}</div>
                      <div className="mt-1 text-xs font-bold text-slate-500">{journey.lastActivityTime !== "-" ? journey.lastActivityTime : "No activity yet"}</div>
                    </>
                  }
                />
                <CustomerOverviewSummaryRow
                  label="Next Follow-up"
                  muted={journey.nextFollowUp === "No upcoming follow-up"}
                  value={
                    <>
                      <div>{journey.nextFollowUp}</div>
                      <div className="mt-1 text-xs font-bold text-slate-500">{journey.nextFollowUpStatus}</div>
                    </>
                  }
                />
                <CustomerOverviewSummaryRow label="Assigned Marketer" muted={overviewAssignedTo === "-"} value={overviewAssignedTo} />
                <CustomerOverviewSummaryRow
                  label="Priority / Status"
                  value={
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={journey.priority === "-" ? "neutral" : "warning"}>{journey.priority === "-" ? "No priority" : `${journey.priority} Priority`}</Badge>
                      <Badge variant={customerJourneyStatusVariant(journey.status)}>{journey.status}</Badge>
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
      <FormModal open={followUpOpen} title="Add Follow-up" onClose={() => setFollowUpOpen(false)}>
        <FollowUpForm workspace={workspace} onDone={() => setFollowUpOpen(false)} />
      </FormModal>
    </>
  );
}

export function TodaysPlanPage({ workspace }: { workspace: TaskWorkspaceData }) {
  return <TodayTasksExecutionView role="MARKETER" workspace={workspace} />;
}

type TodayTaskPriorityFilter = "ALL" | "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
export type TodayWorkFilter = "all" | "tasks" | "due-follow-ups" | "overdue" | "carry-forward";

export type TodayTaskApiRow = {
  id: string;
  title: string;
  companyName: string;
  companyId?: string | null;
  productId?: string | null;
  companyHref?: string | null;
  description: string;
  notes: string;
  reminder: string;
  productName: string;
  assignedToId: string;
  assignedTo: string;
  assignedById: string;
  assignedBy: string;
  assignedByRole: string;
  assignedAtIso: string;
  assignedAtLabel: string;
  priority: "Important" | "High" | "Medium" | "Low";
  priorityKey: "IMPORTANT" | "HIGH" | "MEDIUM" | "LOW";
  status: "Pending" | "Completed";
  statusKey: "PENDING" | "COMPLETED";
  taskDateIso: string;
  taskDateLabel: string;
  timeLabel: string;
  stepNotes?: WorkStepNote[];
  isPrevious: boolean;
  completedAtIso?: string | null;
  completedAtLabel: string;
  completedBy: string;
};

export function sortTodayWorkQueue(rows: TodayWorkQueueItem[]) {
  return [...rows].sort((left, right) => {
    const queueRank = (item: TodayWorkQueueItem) => {
      if (item.queueType === "OVERDUE" || item.queueType === "CARRY_FORWARD") return 3;
      if (item.queueType === "DUE_FOLLOW_UP") return 2;
      return 1;
    };
    const priorityRank = (item: TodayWorkQueueItem) => {
      if (item.priorityKey === "IMPORTANT") return 4;
      if (item.priorityKey === "HIGH") return 3;
      if (item.priorityKey === "MEDIUM") return 2;
      return 1;
    };
    const queueDiff = queueRank(right) - queueRank(left);
    if (queueDiff !== 0) return queueDiff;

    const priorityDiff = priorityRank(right) - priorityRank(left);
    if (priorityDiff !== 0) return priorityDiff;

    const leftTime = new Date(left.taskDateIso).getTime();
    const rightTime = new Date(right.taskDateIso).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;

    const leftAssigned = new Date(left.assignedAtIso).getTime();
    const rightAssigned = new Date(right.assignedAtIso).getTime();
    if (leftAssigned !== rightAssigned) return leftAssigned - rightAssigned;

    return left.title.localeCompare(right.title);
  });
}

function toEditableTaskRow(task: TodayWorkQueueItem): TodayTaskApiRow {
  return {
    ...task,
    id: task.sourceId,
  } as TodayTaskApiRow;
}

export function toEditableCompletedTaskRow(task: CompletedWorkItem): TodayTaskApiRow {
  const linkedPriorityKey = task.linkedTaskPriorityKey;
  const linkedPriority = linkedPriorityKey === "IMPORTANT"
    ? "Important"
    : linkedPriorityKey === "HIGH"
      ? "High"
      : linkedPriorityKey === "LOW"
        ? "Low"
        : "Medium";

  return {
    ...task,
    id: task.taskId ?? task.sourceId,
    title: task.sourceType === "FOLLOW_UP" ? task.linkedTaskTitle ?? task.title : task.title,
    description: task.sourceType === "FOLLOW_UP" ? task.linkedTaskDescription ?? task.description : task.description,
    notes: task.sourceType === "FOLLOW_UP" ? task.linkedTaskNotes ?? task.notes : task.notes,
    reminder: task.sourceType === "FOLLOW_UP" ? task.linkedTaskReminder ?? task.reminder : task.reminder,
    productId: task.sourceType === "FOLLOW_UP" ? task.linkedTaskProductId ?? task.productId : task.productId,
    productName: task.sourceType === "FOLLOW_UP" ? task.linkedTaskProductName ?? task.productName : task.productName,
    assignedToId: task.sourceType === "FOLLOW_UP" ? task.linkedTaskAssignedToId ?? task.assignedToId : task.assignedToId,
    assignedTo: task.sourceType === "FOLLOW_UP" ? task.linkedTaskAssignedTo ?? task.assignedTo : task.assignedTo,
    priorityKey: task.sourceType === "FOLLOW_UP" ? linkedPriorityKey ?? task.priorityKey : task.priorityKey,
    priority: task.sourceType === "FOLLOW_UP" ? (linkedPriorityKey ? linkedPriority : task.priority) : task.priority,
    taskDateIso: task.sourceType === "FOLLOW_UP" ? task.linkedTaskDateIso ?? task.taskDateIso : task.taskDateIso,
    status: "Completed",
    statusKey: "COMPLETED",
    isPrevious: false,
  } as TodayTaskApiRow;
}

export function todayWorkCounts(rows: TodayWorkQueueItem[]) {
  return {
    all: rows.length,
    tasks: rows.filter((row) => row.queueType === "TASK").length,
    "due-follow-ups": rows.filter((row) => row.queueType === "DUE_FOLLOW_UP").length,
    overdue: rows.filter((row) => row.queueType === "OVERDUE").length,
    "carry-forward": rows.filter((row) => row.queueType === "CARRY_FORWARD").length,
  } satisfies Record<TodayWorkFilter, number>;
}

export function matchesTodayWorkFilter(row: TodayWorkQueueItem, filter: TodayWorkFilter) {
  if (filter === "all") return true;
  if (filter === "tasks") return row.queueType === "TASK";
  if (filter === "due-follow-ups") return row.queueType === "DUE_FOLLOW_UP";
  if (filter === "overdue") return row.queueType === "OVERDUE";
  return row.queueType === "CARRY_FORWARD";
}

function dateTimeLocalValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function defaultTaskDateTimeValue(now = new Date()) {
  const base = new Date(now);
  base.setHours(10, 0, 0, 0);
  return dateTimeLocalValue(base);
}

function meaningfulTaskText(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized || normalized === "-") return null;
  return normalized;
}

function resolveTaskContentSnapshot(input: {
  sourceType?: "TASK" | "FOLLOW_UP";
  description?: string | null;
  notes?: string | null;
  method?: string | null;
  linkedTaskDescription?: string | null;
  linkedTaskNotes?: string | null;
  linkedTaskTitle?: string | null;
}) {
  const details = input.sourceType === "FOLLOW_UP"
    ? meaningfulTaskText(input.linkedTaskDescription)
    : meaningfulTaskText(input.description) ?? meaningfulTaskText(input.method);
  const note = input.sourceType === "FOLLOW_UP"
    ? meaningfulTaskText(input.linkedTaskNotes) ?? meaningfulTaskText(input.notes)
    : meaningfulTaskText(input.notes);

  return {
    details: details ?? (input.sourceType === "FOLLOW_UP" ? "No task detail saved yet." : "-"),
    note,
  };
}

function filterDuplicateStepNotes(entries: WorkStepNote[] | undefined, taskNote?: string | null) {
  const normalizedTaskNote = meaningfulTaskText(taskNote)?.toLowerCase();
  if (!normalizedTaskNote) return entries ?? [];

  return (entries ?? []).filter((entry) => {
    const entryNote = meaningfulTaskText(entry.note)?.toLowerCase();
    return entryNote !== normalizedTaskNote;
  });
}

function splitDateTimeLocalValue(value?: string | null) {
  const fallback = defaultTaskDateTimeValue();
  const normalized = value && value.includes("T") ? value : fallback;
  const [date, rawTime = ""] = normalized.split("T");
  return {
    date: date || fallback.slice(0, 10),
    time: rawTime.slice(0, 5) || fallback.slice(11, 16),
  };
}

function combineDateAndTime(date: string, time: string) {
  if (!date || !time) return "";
  return `${date}T${time}`;
}

function taskPriorityTone(priority: TodayTaskApiRow["priorityKey"]) {
  if (priority === "IMPORTANT") return "border-orange-200 bg-orange-50 text-orange-700";
  if (priority === "HIGH") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "LOW") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-orange-200 bg-orange-50 text-orange-700";
}

function TaskPriorityBadge({ priority }: { priority: TodayTaskApiRow["priorityKey"] }) {
  const label = priority === "IMPORTANT" ? "Important" : priority === "HIGH" ? "High" : priority === "LOW" ? "Low" : "Medium";
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black", taskPriorityTone(priority))}>{label}</span>;
}

type CrmPipelineStep = "Call" | "Follow-up" | "Demo Send" | "Quotation" | "Sale Won" | "Lead Lost";

const CRM_PIPELINE_STEPS: CrmPipelineStep[] = ["Call", "Follow-up", "Demo Send", "Quotation", "Sale Won"];

function normalizeCrmPipelineStep(value?: string | null): CrmPipelineStep | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("lead lost") || normalized.includes("lost")) return "Lead Lost";
  if (normalized.includes("sale won") || normalized.includes("won sale") || normalized.includes("conversion") || normalized.includes("win")) return "Sale Won";
  if (normalized.includes("quotation") || normalized.includes("quote") || normalized.includes("quatation")) return "Quotation";
  if (normalized.includes("demo send") || normalized.includes("demo")) return "Demo Send";
  if (normalized.includes("follow-up") || normalized.includes("follow up") || normalized.includes("followup")) return "Follow-up";
  if (normalized.includes("phone call") || normalized.includes("call")) return "Call";
  return null;
}

function shouldHidePipelineTitle(title?: string | null, currentStep?: CrmPipelineStep | null) {
  if (!title || !currentStep) return false;
  return normalizeCrmPipelineStep(title) === currentStep;
}

function resolveWorkQueuePipelineStep(task: TodayWorkQueueItem): CrmPipelineStep | null {
  const latestStepNote = task.stepNotes.find((entry) => normalizeCrmPipelineStep(entry.stepLabel));

  return (
    normalizeCrmPipelineStep(latestStepNote?.stepLabel) ??
    normalizeCrmPipelineStep(task.title) ??
    normalizeCrmPipelineStep(task.method) ??
    (task.sourceType === "FOLLOW_UP" ? "Follow-up" : null)
  );
}

function defaultNextCrmPipelineStep(value?: string | null): CrmPipelineStep {
  const currentStep = normalizeCrmPipelineStep(value);
  if (currentStep === "Call") return "Follow-up";
  if (currentStep === "Follow-up") return "Demo Send";
  if (currentStep === "Demo Send") return "Quotation";
  if (currentStep === "Quotation") return "Sale Won";
  if (currentStep === "Lead Lost") return "Lead Lost";
  if (currentStep === "Sale Won") return "Sale Won";
  return "Follow-up";
}

function suggestedCrmPipelineStep(rating: number): CrmPipelineStep {
  if (rating <= 1) return "Lead Lost";
  return "Follow-up";
}

function CrmPipelineStrip({
  activeStep,
  highlight = false,
}: {
  activeStep?: CrmPipelineStep | null;
  highlight?: boolean;
}) {
  const isLost = activeStep === "Lead Lost";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {CRM_PIPELINE_STEPS.map((step, index) => {
          const isCurrent = !isLost && activeStep === step;
          return (
            <span
              key={step}
              className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold transition",
                isCurrent
                  ? highlight
                    ? "border-blue-300 bg-blue-100 text-blue-800 shadow-sm"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500",
              )}
            >
              {step}
            </span>
          );
        })}
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold transition",
            isLost ? "border-red-300 bg-red-100 text-red-700 shadow-sm" : "border-slate-200 bg-white text-slate-400",
          )}
        >
          Lead Lost
        </span>
      </div>
    </div>
  );
}

function avatarTone(seed: string) {
  const tones = [
    "bg-blue-50 text-blue-700 ring-blue-100",
    "bg-emerald-50 text-emerald-700 ring-emerald-100",
    "bg-violet-50 text-violet-700 ring-violet-100",
    "bg-amber-50 text-amber-700 ring-amber-100",
    "bg-rose-50 text-rose-700 ring-rose-100",
    "bg-cyan-50 text-cyan-700 ring-cyan-100",
  ];

  const base = seed.trim() || "A";
  const index = Array.from(base).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % tones.length;
  return tones[index];
}

function MiniAvatar({ label }: { label: string }) {
  return (
    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black ring-1", avatarTone(label))}>
      {initials(label || "CRM")}
    </span>
  );
}

function dedupeRowsById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function TaskCreateModal({
  open,
  onClose,
  onCreated,
  onDeleted,
  role,
  workspace,
  initialTask,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (row: TodayTaskApiRow) => void;
  onDeleted?: (taskId: string) => void;
  role: Role;
  workspace: TaskWorkspaceData;
  initialTask?: EditableTaskModalItem | null;
}) {
  const [title, setTitle] = React.useState("Call");
  const [companyId, setCompanyId] = React.useState("");
  const [companyLabel, setCompanyLabel] = React.useState("");
  const [customerContactPerson, setCustomerContactPerson] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [customerCity, setCustomerCity] = React.useState("");
  const [customerAddress, setCustomerAddress] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [stepNoteDrafts, setStepNoteDrafts] = React.useState<Map<CrmPipelineStep, string>>(() => new Map());
  const [productId, setProductId] = React.useState("");
  const [assignedToId, setAssignedToId] = React.useState("");
  const [priority, setPriority] = React.useState<Exclude<TodayTaskPriorityFilter, "ALL">>("MEDIUM");
  const [taskDate, setTaskDate] = React.useState(() => splitDateTimeLocalValue().date);
  const [taskTime, setTaskTime] = React.useState(() => splitDateTimeLocalValue().time);
  const [reminder, setReminder] = React.useState<TaskReminderValue>("");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const isEditing = Boolean(initialTask?.id);
  const isCompletedEdit = isEditing && initialTask?.statusKey === "COMPLETED";
  const taskTitleOptions = ["Call", "Follow-up", "Demo Send", "Quotation", "Sale"];
  const assignableMembers = React.useMemo(() => {
    if (role === "MARKETER") return [];

    const activeEmployees = workspace.employees.filter((employee) => employee.statusKey === "ACTIVE");
    const ownId = workspace.user.id ?? "";

    if (role === "SUPERVISOR") {
      return activeEmployees.filter(
        (employee) => employee.id === ownId || (employee.roleKey === "MARKETER" && employee.supervisorIds.includes(ownId)),
      );
    }

    return activeEmployees.filter((employee) => employee.roleKey === "SUPERVISOR" || employee.roleKey === "MARKETER");
  }, [role, workspace.employees, workspace.user.id]);
  const assigneeOptions = React.useMemo(() => {
    const currentAssignee = initialTask?.assignedToId
      ? workspace.employees.find((employee) => employee.id === initialTask.assignedToId) ?? null
      : null;

    if (!currentAssignee || assignableMembers.some((employee) => employee.id === currentAssignee.id)) {
      return assignableMembers;
    }

    return [currentAssignee, ...assignableMembers];
  }, [assignableMembers, initialTask?.assignedToId, workspace.employees]);
  const defaultAssigneeId = React.useMemo(() => {
    if (role === "MARKETER") return workspace.user.id ?? "";
    if (role === "SUPERVISOR") return workspace.user.id ?? assigneeOptions[0]?.id ?? "";
    return assigneeOptions[0]?.id ?? "";
  }, [assigneeOptions, role, workspace.user.id]);
  const trimmedCompanyLabel = companyLabel.trim();
  const showCustomerHelper = !isEditing;
  const selectedStepKey = editableTaskStepKey(title);
  const visibleStepNotes = React.useMemo(() => {
    const savedEntries: WorkStepNote[] = [];
    const draftEntries: WorkStepNote[] = [];

    for (const entry of initialTask?.stepNotes ?? []) {
      const stepKey = editableTaskStepKey(entry.stepLabel);
      if (!stepKey) continue;
      const note = entry.note.trim();
      if (!note) continue;
      savedEntries.push({ ...entry, note });
    }

    const currentKey = editableTaskStepKey(initialTask?.title);
    const currentNote = initialTask?.notes?.trim();
    if (currentKey && currentNote && !savedEntries.some((entry) => entry.source === "TASK" && editableTaskStepKey(entry.stepLabel) === currentKey && entry.note === currentNote)) {
      savedEntries.push({
        id: `task-note-${initialTask?.id ?? currentKey}`,
        stepLabel: currentKey,
        note: currentNote,
        createdAtIso: initialTask?.taskDateIso ?? new Date().toISOString(),
        createdAtLabel: "Saved note",
        source: "TASK",
      });
    }

    for (const [stepKey, draft] of stepNoteDrafts) {
      const note = draft.trim();
      if (!note) continue;
      draftEntries.push({
        id: `draft-${stepKey}`,
        stepLabel: stepKey,
        note,
        createdAtIso: initialTask?.taskDateIso ?? new Date().toISOString(),
        createdAtLabel: "Current draft",
        source: "TASK",
      });
    }

    return CRM_PIPELINE_STEPS
      .flatMap((stepKey) => {
        const matchingSavedEntries = savedEntries.filter((entry) => editableTaskStepKey(entry.stepLabel) === stepKey);
        const matchingDraftEntries = draftEntries.filter((entry) => editableTaskStepKey(entry.stepLabel) === stepKey);
        return [...matchingSavedEntries, ...matchingDraftEntries];
      });
  }, [initialTask?.stepNotes, initialTask?.taskDateIso, stepNoteDrafts]);
  const completedTaskDetails = React.useMemo(
    () => meaningfulTaskText(initialTask?.description) ?? "-",
    [initialTask?.description],
  );

  React.useEffect(() => {
    if (!open) return;
    const nextDrafts = buildStepNoteDraftMap(initialTask);
    setTitle(initialTask?.title || "Call");
    setCompanyId(initialTask?.companyId ?? "");
    setCompanyLabel(initialTask?.companyName ?? "");
    setCustomerContactPerson("");
    setCustomerPhone("");
    setCustomerCity("");
    setCustomerAddress(initialTask?.customerAddress ?? "");
    setDescription(initialTask?.description && initialTask.description !== "-" ? initialTask.description : "");
    setNotes("");
    setStepNoteDrafts(nextDrafts);
    setProductId(initialTask?.productId ?? "");
    setAssignedToId(initialTask?.assignedToId ?? defaultAssigneeId);
    setPriority(initialTask?.priorityKey ?? "MEDIUM");
    const scheduledDateTime = splitDateTimeLocalValue(
      initialTask?.taskDateIso ? dateTimeLocalValue(new Date(initialTask.taskDateIso)) : defaultTaskDateTimeValue(),
    );
    setTaskDate(scheduledDateTime.date);
    setTaskTime(scheduledDateTime.time);
    setReminder(normalizeTaskReminderValue(initialTask?.reminder));
    setMessage("");
  }, [defaultAssigneeId, initialTask, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");

    if (!companyId && !trimmedCompanyLabel) {
      setMessage("Please select or type a company name.");
      setPending(false);
      return;
    }

    if (role !== "MARKETER" && !assignedToId) {
      setMessage(assigneeOptions.length ? "Please select who will handle this task." : "No active teammate is available for this assignment.");
      setPending(false);
      return;
    }

    if (!taskDate || !taskTime) {
      setMessage("Task er jonno date and time select korte hobe.");
      setPending(false);
      return;
    }

    const effectiveTaskDateTime = combineDateAndTime(taskDate, taskTime);

    try {
      const trimmedNote = notes.trim();
      const existingSavedNote = initialTask?.notes?.trim();
      const submittedNote = isCompletedEdit
        ? (trimmedNote ? [existingSavedNote, trimmedNote].filter(Boolean).join("\n\n") : existingSavedNote ?? "")
        : notes;
      const response = await fetch(isEditing ? `/api/tasks/${initialTask?.id}` : "/api/tasks", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          companyId,
          companyName: trimmedCompanyLabel,
          description,
          notes: submittedNote,
          productId,
          assignedToId,
          priority,
          taskDateTime: effectiveTaskDateTime,
          taskDateTimeTzOffset: new Date().getTimezoneOffset(),
          reminder: role === "MARKETER" ? "" : reminder,
          customerContactPerson,
          customerPhone,
          customerCity,
          customerAddress,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : isEditing ? "Task update failed." : "Task creation failed.");
      }

      onCreated(result.row as TodayTaskApiRow);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isEditing ? "Task update failed." : "Task creation failed.");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async () => {
    if (!initialTask?.id) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/tasks/${initialTask.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Task delete failed.");
      }
      onDeleted?.(initialTask.id);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Task delete failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <FormModal
      open={open}
      title={isEditing ? "Edit Task" : "Add Task"}
      onClose={onClose}
      panelClassName={isEditing ? "max-w-xl" : "max-w-2xl"}
      contentClassName={isEditing ? "p-4 sm:p-4" : undefined}
    >
      <form onSubmit={handleSubmit} className={cn("space-y-4", isEditing && "space-y-3")}>
        <div className={cn("grid gap-3", role === "MARKETER" ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3")}>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Task Title</span>
            <select
              value={title}
              onChange={(event) => {
                const nextTitle = event.target.value;
                if (!isCompletedEdit) {
                  setTitle(nextTitle);
                  return;
                }

                const previousStepKey = editableTaskStepKey(title);
                const nextStepKey = editableTaskStepKey(nextTitle);

                setStepNoteDrafts((currentDrafts) => {
                  const nextDrafts = new Map(currentDrafts);
                  if (previousStepKey) {
                    nextDrafts.set(previousStepKey, notes);
                  }
                  const nextStepNote = nextStepKey ? (nextDrafts.get(nextStepKey) ?? "") : "";
                  setNotes(nextStepNote);
                  return nextDrafts;
                });
                setTitle(nextTitle);
              }}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              required
            >
              {taskTitleOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Product</span>
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select product</option>
              {workspace.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </label>
          {role !== "MARKETER" ? (
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Assign To</span>
              <select
                value={assignedToId}
                onChange={(event) => setAssignedToId(event.target.value)}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                disabled={!assigneeOptions.length}
                required
              >
                {assigneeOptions.length ? null : <option value="">No active teammate available</option>}
                {assigneeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.role})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                {role === "SUPERVISOR"
                  ? "Assign to yourself or any active marketer in your team."
                  : "Assign to any active supervisor or marketer."}
              </p>
            </label>
          ) : null}
        </div>
        <SearchableEntitySelect
          label="Company Name"
          options={[]}
          searchScope="companies"
          value={companyId}
          defaultLabel={companyLabel}
          onValueChange={(value, label) => {
            setCompanyId(value);
            setCompanyLabel(label);
          }}
          placeholder="Search or type company"
        />
        {showCustomerHelper ? (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/80 p-4">
          <p className="text-sm font-semibold text-slate-700">
            If the customer does not exist yet, simply type a new company name here.
          </p>
          <p className="hidden">
            Existing customer না থাকলে নতুন company name type করলেই save হবে.
          </p>
          <p className="hidden">
            Task save করার সময় নতুন company automatically customer list-এ add হয়ে যাবে. নিচের fields গুলো দিলে record আরও complete হবে.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Contact Person</span>
              <Input
                value={customerContactPerson}
                onChange={(event) => setCustomerContactPerson(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Phone</span>
              <Input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">City / Area</span>
              <Input
                value={customerCity}
                onChange={(event) => setCustomerCity(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2 xl:col-span-1">
              <span className="text-sm font-semibold text-slate-700">Address</span>
              <Input
                value={customerAddress}
                onChange={(event) => setCustomerAddress(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
        </div>
        ) : null}
        {isCompletedEdit ? (
          <div className="space-y-2">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Task Details</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700">{completedTaskDetails}</p>
            </div>
            {visibleStepNotes.length ? (
              <div className="rounded-[18px] border border-emerald-200/80 bg-emerald-50/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Saved Step Notes</p>
                  {selectedStepKey ? <p className="text-[10px] font-semibold text-emerald-800/80">Selected step: {selectedStepKey}</p> : null}
                </div>
                <div className="mt-1.5 flex max-h-24 flex-col gap-1.5 overflow-y-auto pr-1">
                  {visibleStepNotes.map((entry) => {
                    const active = editableTaskStepKey(entry.stepLabel) === selectedStepKey;
                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 transition",
                          active ? "border-emerald-300 bg-white text-slate-800" : "border-white/80 bg-white/70 text-slate-700",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">{entry.stepLabel}</p>
                          <p className="text-[10px] font-semibold text-slate-500">{entry.createdAtLabel}</p>
                        </div>
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[13px] leading-5">{entry.note}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Task Note</span>
              <textarea
                value={notes}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setNotes(nextValue);
                  setStepNoteDrafts((currentDrafts) => {
                    const nextDrafts = new Map(currentDrafts);
                    if (selectedStepKey) {
                      nextDrafts.set(selectedStepKey, nextValue);
                    }
                    return nextDrafts;
                  });
                }}
                placeholder={selectedStepKey ? `${selectedStepKey} step er note ekhane likhun` : "Customer callback, update, ba special context ekhane likhun"}
                className="min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>
        ) : (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Task Details</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What should the marketer do?"
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </label>
        )}
        <div className={cn("rounded-2xl border border-blue-200 bg-blue-50/80", isEditing ? "p-3" : "p-4")}>
          <div>
            <p className="text-sm font-black text-slate-900">Task Schedule</p>
          </div>
          <div className={cn("grid sm:grid-cols-2", isEditing ? "mt-2 gap-2.5" : "mt-3 gap-3")}>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Scheduled Date</span>
              <Input
                type="date"
                value={taskDate}
                onChange={(event) => setTaskDate(event.target.value)}
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Scheduled Time</span>
              <Input
                type="time"
                value={taskTime}
                onChange={(event) => setTaskTime(event.target.value)}
                required
              />
            </label>
          </div>
        </div>
        <div className={cn("grid gap-3", role === "MARKETER" ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3")}>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as Exclude<TodayTaskPriorityFilter, "ALL">)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="IMPORTANT">Important</option>
            </select>
          </label>
          {role !== "MARKETER" ? (
            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Reminder</span>
              <select
                value={reminder}
                onChange={(event) => setReminder(event.target.value as TaskReminderValue)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {TASK_REMINDER_OPTIONS.map((option) => (
                  <option key={option.value || "none"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending} className={cn(isEditing && "h-9 px-4")}>
            {pending ? "Saving..." : isEditing ? "Update Task" : "Save Task"}
          </Button>
          {isEditing ? (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={pending} className="h-9 px-4">
              Delete
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose} disabled={pending} className={cn(isEditing && "h-9 px-4")}>
            Cancel
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function TaskCompleteConfirmModal({
  task,
  pending,
  message,
  onClose,
  onConfirm,
}: {
  task: TodayTaskApiRow | null;
  pending: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <FormModal open={Boolean(task)} title="Complete Task" onClose={onClose} panelClassName="max-w-md">
      {task ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-900">{task.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{task.companyName}</p>
          </div>
          <p className="text-sm text-slate-600">Are you sure to complete this task?</p>
          {message ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onConfirm} disabled={pending}>
              {pending ? <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Completing...</span> : "Complete Task"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </FormModal>
  );
}

export function TaskFollowUpModal({
  task,
  onClose,
  onSaved,
}: {
  task: {
    id: string;
    title: string;
    companyId?: string | null;
    companyName: string;
    leadId?: string | null;
    leadName?: string | null;
    taskId?: string | null;
    defaultStep?: CrmPipelineStep;
    defaultMethod?: string;
  } | null;
  onClose: () => void;
  onSaved: (result?: ActionResult) => void;
}) {
  const followUpMethods = ["Phone Call", "WhatsApp", "Email", "Physical Visit", "Meeting"] as const;
  const initialTaskTitle = task?.defaultStep ?? "Follow-up";
  const initialMethod = task?.defaultMethod && followUpMethods.includes(task.defaultMethod as (typeof followUpMethods)[number]) ? task.defaultMethod : "Phone Call";
  const [taskTitle, setTaskTitle] = React.useState<CrmPipelineStep>(initialTaskTitle);
  const [method, setMethod] = React.useState(initialMethod);

  return (
    <FormModal open={Boolean(task)} title="Add Follow-up" onClose={onClose} panelClassName="max-w-xl">
      {task ? (
        <ActionForm action={createFollowUpAction} onSuccess={(result) => onSaved(result)} submitLabel="Save Follow-up">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-sm font-black text-slate-900">{task.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{task.companyName}</p>
          </div>
          {task.taskId ? <input type="hidden" name="taskId" value={task.taskId} /> : null}
          <input type="hidden" name="followUpDateTzOffset" value={new Date().getTimezoneOffset().toString()} />
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">Continue From Step</p>
              <span className="text-xs font-semibold text-slate-500">Auto-selected from last completed stage</span>
            </div>
            <div className="mt-3 space-y-3">
              <select
                name="taskTitle"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value as CrmPipelineStep)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option>Call</option>
                <option>Follow-up</option>
                <option>Demo Send</option>
                <option>Quotation</option>
                <option>Sale Won</option>
                <option>Lead Lost</option>
              </select>
              <CrmPipelineStrip activeStep={taskTitle} highlight />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SearchableEntitySelect
              label="Customer / Company"
              name="companyId"
              options={[]}
              searchScope="companies"
              defaultValue={task.companyId ?? ""}
              defaultLabel={task.companyName}
              placeholder="Search customer"
            />
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Method</span>
              <select
                name="method"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {followUpMethods.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
          <TextField label="Follow-up Date" name="followUpDate" type="date" defaultValue={dateTimeLocalValue().slice(0, 10)} />
          <TextField label="Follow-up Time" name="followUpTime" type="time" defaultValue="10:00" />
          <TextAreaField label="Follow-up Note" name="note" />
        </ActionForm>
      ) : null}
    </FormModal>
  );
}

export function WorkCompletionModal({
  item,
  onClose,
  onSaved,
}: {
  item: TodayWorkQueueItem | null;
  onClose: () => void;
  onSaved: (result?: ActionResult) => void;
}) {
  const action = item?.sourceType === "FOLLOW_UP" ? completeFollowUpWithCommunicationAction : completeTaskWithFollowUpAction;
  const title = item?.sourceType === "FOLLOW_UP" ? "Complete Follow-up" : "Complete Task";
  const defaultMethod = item && ["Phone Call", "WhatsApp", "Email", "Physical Visit", "Meeting"].includes(item.method) ? item.method : "Phone Call";
  const [rating, setRating] = React.useState(0);
  const initialNextStep = React.useMemo<CrmPipelineStep>(
    () => defaultNextCrmPipelineStep(item?.title ?? (item?.sourceType === "FOLLOW_UP" ? "Follow-up" : "Call")),
    [item],
  );
  const [nextStep, setNextStep] = React.useState<CrmPipelineStep>("Follow-up");
  const [nextStepDirty, setNextStepDirty] = React.useState(false);
  const [nextFollowUpDate, setNextFollowUpDate] = React.useState("");
  const [nextFollowUpTime, setNextFollowUpTime] = React.useState("");
  const suggestedStep = rating > 0 ? suggestedCrmPipelineStep(rating) : initialNextStep;
  const showNextFollowUpSchedule = nextStep === "Follow-up";
  const taskDetails = item?.sourceType === "FOLLOW_UP"
    ? item.linkedTaskDescription && item.linkedTaskDescription !== "-"
      ? item.linkedTaskDescription
      : "No task detail saved yet."
    : item?.description && item.description !== "-"
      ? item.description
      : item?.method && item.method !== "-"
        ? item.method
        : "No task detail saved yet.";
  const stepNotes = item?.stepNotes ?? [];
  const hasStepNotes = stepNotes.length > 0;

  React.useEffect(() => {
    if (!item) {
      setRating(0);
      setNextStep("Follow-up");
      setNextStepDirty(false);
      setNextFollowUpDate("");
      setNextFollowUpTime("");
      return;
    }
    setRating(0);
    setNextStep(initialNextStep);
    setNextStepDirty(false);
    setNextFollowUpDate("");
    setNextFollowUpTime("");
  }, [initialNextStep, item]);

  React.useEffect(() => {
    if (!item || nextStepDirty || rating <= 0) return;
    setNextStep(suggestedStep);
  }, [item, nextStepDirty, rating, suggestedStep]);

  React.useEffect(() => {
    if (showNextFollowUpSchedule) return;
    setNextFollowUpDate("");
    setNextFollowUpTime("");
  }, [showNextFollowUpSchedule]);

  React.useEffect(() => {
    if (!showNextFollowUpSchedule || nextFollowUpTime) return;
    setNextFollowUpTime("10:00");
  }, [nextFollowUpTime, showNextFollowUpSchedule]);

  return (
    <FormModal open={Boolean(item)} title={title} onClose={onClose} panelClassName="max-w-2xl">
      {item ? (
        <ActionForm
          action={action}
          onSuccess={(result) => onSaved(result)}
          submitLabel={item.sourceType === "FOLLOW_UP" ? "Save & Complete Follow-up" : "Save & Complete Task"}
          refreshOnSuccess={false}
          resetOnSuccess={false}
        >
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-sm font-black text-slate-900">{item.title}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{item.companyName}</p>
          </div>
          <div className={cn("grid items-start gap-3", hasStepNotes ? "md:grid-cols-2" : "grid-cols-1")}>
            <div className="min-w-0 self-start rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Task Details</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-700">{taskDetails}</p>
            </div>
            {hasStepNotes ? (
              <StepNotesHistoryPanel
                entries={stepNotes}
                title="Step Notes History"
                emptyMessage="No step note saved yet."
              />
            ) : null}
          </div>
          <input type="hidden" name="id" value={item.sourceId} />
          <input type="hidden" name="rating" value={rating > 0 ? String(rating) : ""} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectBox label="Communication Method" name="method" defaultValue={defaultMethod}>
              <option>Phone Call</option>
              <option>WhatsApp</option>
              <option>Email</option>
              <option>Physical Visit</option>
              <option>Meeting</option>
            </SelectBox>
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Next Step</span>
              <select
                name="discussionTopic"
                value={nextStep}
                onChange={(event) => {
                  setNextStep(event.target.value as CrmPipelineStep);
                  setNextStepDirty(true);
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option>Call</option>
                <option>Follow-up</option>
                <option>Demo Send</option>
                <option>Quotation</option>
                <option>Sale Won</option>
                <option>Lead Lost</option>
              </select>
            </label>
            {showNextFollowUpSchedule ? (
              <>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase text-slate-500">Follow-up Date</span>
                  <Input
                    name="nextFollowUpDate"
                    type="date"
                    value={nextFollowUpDate}
                    onChange={(event) => setNextFollowUpDate(event.target.value)}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase text-slate-500">Follow-up Time</span>
                  <Input
                    name="nextFollowUpTime"
                    type="time"
                    value={nextFollowUpTime}
                    onChange={(event) => setNextFollowUpTime(event.target.value)}
                  />
                </label>
                <input type="hidden" name="nextFollowUpDateTzOffset" value={new Date().getTimezoneOffset().toString()} />
              </>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">Rating</p>
            <div className="mt-2 flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} aria-label={`Rate ${star} star`} className="transition">
                  <Star className={cn("h-5 w-5", rating >= star ? "fill-amber-400 text-amber-500" : "text-slate-300")} />
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Suggested next step: <span className="text-slate-700">{suggestedStep}</span>
            </p>
            <div className="mt-3">
              <CrmPipelineStrip activeStep={nextStep} highlight />
            </div>
          </div>
          <TextAreaField
            label="Task Note"
            name="notes"
            defaultValue=""
          />
        </ActionForm>
      ) : null}
    </FormModal>
  );
}

function TodayWorkFilterChips({
  counts,
  activeFilter,
  onChange,
}: {
  counts: Record<TodayWorkFilter, number>;
  activeFilter: TodayWorkFilter;
  onChange: (filter: TodayWorkFilter) => void;
}) {
  const filterChips: { key: TodayWorkFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "tasks", label: "Tasks" },
    { key: "due-follow-ups", label: "Follow-ups" },
    { key: "overdue", label: "Overdue" },
    { key: "carry-forward", label: "Carry Forward" },
  ];

  return (
    <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:mb-4 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
      {filterChips.map((chip) => {
        const active = activeFilter === chip.key;

        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition-all duration-300",
              active ? "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]" : "border-slate-200 bg-slate-50 text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-blue-100 hover:bg-white hover:text-blue-700 hover:shadow-md",
            )}
          >
            {chip.label}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-white/95 text-blue-700" : "bg-white text-slate-600")}>
              {counts[chip.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TodayWorkQueueList({
  rows,
  loading,
  viewerRole,
  readOnly = false,
  emptyMessage,
  activeItemId,
  onComplete,
  onOpen,
  onEdit,
  onDelete,
  onEditFollowUp,
  onDeleteFollowUp,
  maxHeightClassName = "max-h-[520px]",
}: {
  rows: TodayWorkQueueItem[];
  loading: boolean;
  viewerRole: Role;
  readOnly?: boolean;
  emptyMessage: string;
  activeItemId?: string | null;
  onComplete: (item: TodayWorkQueueItem) => void;
  onOpen?: (item: TodayWorkQueueItem) => void;
  onEdit?: (item: TodayTaskApiRow) => void;
  onDelete?: (item: TodayTaskApiRow) => void;
  onEditFollowUp?: (item: TodayWorkQueueItem) => void;
  onDeleteFollowUp?: (item: TodayWorkQueueItem) => void;
  maxHeightClassName?: string;
}) {
  const scrollKey = "crm:return-scroll:today-work-queue";
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(scrollKey);
    if (!raw) return;
    window.sessionStorage.removeItem(scrollKey);

    try {
      const payload = JSON.parse(raw) as { scrollTop?: number; itemId?: string };
      window.requestAnimationFrame(() => {
        if (payload.scrollTop != null && Number.isFinite(payload.scrollTop) && listRef.current) {
          listRef.current.scrollTop = payload.scrollTop;
        }
        if (payload.itemId) {
          const el = document.getElementById(`today-work-item-${payload.itemId}`);
          if (el) {
            el.scrollIntoView({ block: "center" });
          }
        }
      });
    } catch {
      return;
    }
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        Loading tasks...
      </p>
    );
  }

  if (!rows.length) {
    return <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div ref={listRef} className={cn("space-y-4 overflow-x-hidden overflow-y-auto pr-1", maxHeightClassName)}>
      <AnimatePresence initial={false}>
        {rows.map((task) => {
          const crmStep = resolveWorkQueuePipelineStep(task);
          const hideTaskTitle = shouldHidePipelineTitle(task.title, crmStep);
          const taskTimestamp = new Date(task.taskDateIso).getTime();
          const isLiveFollowUp = task.sourceType === "FOLLOW_UP" && task.queueType === "DUE_FOLLOW_UP" && Number.isFinite(taskTimestamp) && taskTimestamp <= Date.now();
          const isUpcomingFollowUp = task.sourceType === "FOLLOW_UP" && task.queueType === "DUE_FOLLOW_UP" && Number.isFinite(taskTimestamp) && taskTimestamp > Date.now();
          const communicationStepNotes = task.stepNotes.filter((entry) => entry.source === "COMMUNICATION");
          return (
          <motion.div
            key={task.id}
            id={`today-work-item-${task.id}`}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.18 }}
            role={onOpen ? "button" : undefined}
            tabIndex={onOpen ? 0 : undefined}
            onClick={() => onOpen?.(task)}
            onKeyDown={(event) => {
              if (!onOpen) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(task);
              }
            }}
            className={cn(
              "relative overflow-hidden rounded-[18px] border px-4 py-4 shadow-[0_14px_36px_rgba(15,23,42,0.055)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(15,23,42,0.095)] sm:px-5 sm:py-5",
              onOpen && "cursor-pointer",
              task.queueType === "OVERDUE" || task.queueType === "CARRY_FORWARD"
                ? "border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white ring-1 ring-rose-100"
                : isLiveFollowUp
                  ? "border-orange-300 bg-gradient-to-br from-orange-50 via-amber-50 to-white ring-2 ring-orange-100"
                : task.queueType === "DUE_FOLLOW_UP"
                  ? "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white ring-1 ring-amber-100"
                  : task.priorityKey === "IMPORTANT"
                    ? "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50/50 ring-1 ring-sky-100"
                    : "border-blue-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96)_0%,rgba(255,255,255,0.98)_48%,rgba(240,253,250,0.82)_100%)] ring-1 ring-blue-100/80",
            )}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-400 via-blue-500 to-emerald-400" />
            <div className="min-w-0 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(max-content,1fr)_auto] xl:items-start">
                <div className="flex min-w-0 items-start gap-3">
                  {!readOnly ? (
                    <input
                      type="checkbox"
                      checked={false}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => onComplete(task)}
                      className="mt-2 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Complete ${task.title}`}
                    />
                  ) : null}
                  <MiniAvatar label={task.companyName || task.title} />
                  <div className="min-w-0">
                    <button type="button" onClick={(event) => {
                      event.stopPropagation();
                      onOpen?.(task);
                    }} className="block max-w-full whitespace-nowrap text-left text-[15px] font-black leading-tight text-slate-950 transition hover:text-blue-700 sm:text-base">
                      {task.companyName}
                    </button>
                    {task.productName !== "-" ? (
                      <p className="mt-1 whitespace-nowrap text-[12px] font-semibold text-blue-700">Product: {task.productName}</p>
                    ) : null}
                    {!hideTaskTitle ? (
                      <p className="mt-1 truncate text-[12px] font-semibold text-slate-600">{task.title}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 xl:hidden">
                      <p className="text-[11px] font-medium text-slate-500">Added: {task.assignedAtLabel}</p>
                      {isLiveFollowUp ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black text-orange-700 shadow-sm">
                          <Clock3 className="h-3 w-3" />
                          Due follow-up now
                        </span>
                      ) : null}
                      {isUpcomingFollowUp ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-black text-amber-700 shadow-sm">
                          <Clock3 className="h-3 w-3" />
                          Upcoming follow-up
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap xl:justify-end">
                  <TaskPriorityBadge priority={task.priorityKey} />
                  {!readOnly ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-xl px-3 text-[11px] shadow-sm"
                        disabled={Boolean(activeItemId && activeItemId === task.id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          onComplete(task);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Complete
                      </Button>
                      {task.sourceType === "TASK" ? (
                        <>
                          <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl px-3 text-[11px]" onClick={(event) => {
                            event.stopPropagation();
                            onEdit?.(toEditableTaskRow(task));
                          }}>
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl px-3 text-[11px] text-red-600" onClick={(event) => {
                            event.stopPropagation();
                            onDelete?.(toEditableTaskRow(task));
                          }}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </>
                      ) : task.sourceType === "FOLLOW_UP" ? (
                        <>
                          <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl px-3 text-[11px]" onClick={(event) => {
                            event.stopPropagation();
                            onEditFollowUp?.(task);
                          }}>
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl px-3 text-[11px] text-red-600" onClick={(event) => {
                            event.stopPropagation();
                            onDeleteFollowUp?.(task);
                          }}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <InlineContactShortcuts
                    phone={task.companyPrimaryPhone}
                    whatsapp={task.companyPrimaryPhone}
                    className="contents sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-start xl:flex-nowrap [&>a]:h-8 [&>a]:rounded-xl [&>a]:px-3 [&>a]:text-[11px]"
                  />
                  <div className="hidden w-full flex-wrap items-center justify-end gap-2 xl:flex">
                    <p className="text-[11px] font-medium text-slate-500">Added: {task.assignedAtLabel}</p>
                    {isLiveFollowUp ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black text-orange-700 shadow-sm">
                        <Clock3 className="h-3 w-3" />
                        Due follow-up now
                      </span>
                    ) : null}
                    {isUpcomingFollowUp ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-black text-amber-700 shadow-sm">
                        <Clock3 className="h-3 w-3" />
                        Upcoming follow-up
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                {crmStep ? (
                  <div className="min-w-0">
                    <CrmPipelineStrip
                      activeStep={crmStep}
                      highlight={task.queueType === "DUE_FOLLOW_UP" || task.queueType === "OVERDUE" || task.priorityKey === "IMPORTANT"}
                    />
                  </div>
                ) : null}
              </div>

              <div className={cn("grid items-start gap-4", communicationStepNotes.length ? "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" : "grid-cols-1")}>
                  {task.description !== "-" ? (
                    <div className="self-start rounded-[18px] border border-slate-200/80 bg-white/90 px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">Task Details</p>
                      <p className="mt-2.5 max-h-28 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-[15px] font-medium leading-6 text-slate-700">{task.description}</p>
                    </div>
                  ) : (
                    <div className="self-start rounded-[18px] border border-slate-200/80 bg-white/90 px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-600">Task Details</p>
                      <p className="mt-2.5 max-h-20 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-[15px] font-medium leading-6 text-slate-700">{task.method}</p>
                    </div>
                  )}
                  {communicationStepNotes.length ? (
                    <StepNotesHistoryPanel entries={communicationStepNotes} title="Short Notes" compact />
                  ) : null}
                </div>
            </div>
          </motion.div>
        )})}
      </AnimatePresence>
    </div>
  );
}

export function CompletedWorkList({
  rows,
  loading,
  viewerRole,
  readOnly = false,
  emptyMessage,
  onEditCompletedTask,
  onOpen,
  previewCount,
}: {
  rows: CompletedWorkItem[];
  loading: boolean;
  viewerRole: Role;
  readOnly?: boolean;
  emptyMessage: string;
  onEditCompletedTask?: (task: CompletedWorkItem) => void;
  onOpen?: (task: CompletedWorkItem) => void;
  previewCount?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const scrollKey = "crm:return-scroll:completed-work";
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const hiddenCount = previewCount ? Math.max(rows.length - previewCount, 0) : 0;
  const compactHeightClassName = previewCount === 5
    ? "max-h-[400px]"
    : previewCount === 6
      ? "max-h-[560px]"
      : "max-h-[420px]";

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(scrollKey);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as { scrollTop?: number; itemId?: string };
      if (!payload.itemId) return;

      window.requestAnimationFrame(() => {
        const el = document.getElementById(`completed-work-item-${payload.itemId}`);
        if (!el) return;

        window.sessionStorage.removeItem(scrollKey);
        if (payload.scrollTop != null && Number.isFinite(payload.scrollTop) && listRef.current) {
          listRef.current.scrollTop = payload.scrollTop;
        }
        el.scrollIntoView({ block: "center" });
      });
    } catch {
      return;
    }
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        Loading completed tasks...
      </p>
    );
  }

  if (!rows.length) {
    return <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        className={cn(
          "min-h-0 flex-1 space-y-2 overflow-x-hidden pr-1",
          previewCount ? (expanded ? "max-h-none overflow-visible" : `${compactHeightClassName} overflow-y-auto`) : "",
        )}
      >
        {rows.map((task, index) => {
          const isLatest = index === 0;
          const crmStep = resolveWorkQueuePipelineStep(task);
          const hideTaskTitle = shouldHidePipelineTitle(task.title, crmStep);
          const scheduledLabel = `${task.taskDateLabel}${task.timeLabel ? ` ${task.timeLabel}` : ""}`;
          const taskContent = resolveTaskContentSnapshot(task);
          const communicationStepNotes = filterDuplicateStepNotes(task.stepNotes, taskContent.note).filter((entry) => entry.source === "COMMUNICATION");
          const hasRightColumn = communicationStepNotes.length > 0;
          return (
          <div
            key={task.id}
            id={`completed-work-item-${task.id}`}
            role={onOpen ? "button" : undefined}
            tabIndex={onOpen ? 0 : undefined}
            onClick={() => onOpen?.(task)}
            onKeyDown={(event) => {
              if (!onOpen) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(task);
              }
            }}
            className={cn(
              "overflow-hidden rounded-[14px] border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/65 px-3 py-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.04)]",
              isLatest && "border-emerald-200 bg-gradient-to-br from-emerald-100/80 via-emerald-50 to-teal-50 ring-1 ring-emerald-100",
              onOpen && "cursor-pointer transition hover:border-emerald-200 hover:bg-gradient-to-br hover:from-emerald-50 hover:via-white hover:to-teal-50",
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2.5">
              <MiniAvatar label={task.companyName || task.title} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    {isLatest ? <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Latest completed</p> : null}
                    {!hideTaskTitle ? (
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        onOpen?.(task);
                      }} className="mt-0.5 truncate text-left text-base font-black text-slate-900 hover:text-blue-700">
                        {task.title}
                      </button>
                    ) : null}
                    <p className="mt-0.5 min-w-0 text-[15px] font-bold text-slate-700 sm:truncate">
                      <EntityLink
                        href={task.companyHref}
                        className="text-[15px] font-bold text-slate-800"
                        stopPropagation
                        onNavigate={() => {
                          if (typeof window === "undefined") return;
                          const scrollTop = listRef.current?.scrollTop ?? 0;
                          window.sessionStorage.setItem(scrollKey, JSON.stringify({ scrollTop, itemId: task.id }));
                        }}
                      >
                        {task.companyName}
                      </EntityLink>
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">Completed: {task.completedAtLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen?.(task);
                    }}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition hover:bg-emerald-200"
                    aria-label={`Open completed details for ${task.title}`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
                {crmStep ? (
                  <div className="mt-2">
                    <CrmPipelineStrip activeStep={crmStep} />
                  </div>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                  {task.method !== "Task" && task.method !== "-" ? <span>{task.method}</span> : null}
                  {task.productName !== "-" ? <span className="text-blue-700">Product: {task.productName}</span> : null}
                  {task.reminder !== "-" ? <span className="text-violet-700">Reminder: {taskReminderLabel(task.reminder)}</span> : null}
                  {viewerRole !== "MARKETER" ? <span>Assigned: {task.assignedTo}</span> : null}
                  <span>Completed by {task.completedBy}</span>
                </div>
                <div className={cn("mt-2 grid items-start gap-2", hasRightColumn ? "md:grid-cols-2" : "grid-cols-1")}>
                  <div className="min-w-0 self-start rounded-[20px] border border-slate-200/80 bg-white/80 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Task Details</p>
                    <p className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-[13px] leading-5 text-slate-700">{taskContent.details}</p>
                  </div>
                  {hasRightColumn ? (
                    <StepNotesHistoryPanel entries={communicationStepNotes} title="Short Notes" compact />
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-500">Scheduled: {scheduledLabel}</p>
                  {!readOnly && onEditCompletedTask ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-lg gap-1 px-2.5 text-[11px]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditCompletedTask(task);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
        })}
      </div>
      {previewCount && hiddenCount > 0 ? (
        <div className="mt-auto flex justify-center pt-1">
          <Button type="button" variant="outline" size="sm" className="rounded-xl px-4 text-xs" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Show Less" : `View All (${hiddenCount} more)`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function MarketerTaskBoards({
  employees,
  pendingRows,
  completedRows,
  loading,
  viewerRole,
  activeItemId,
  onComplete,
  onOpen,
  onEdit,
  onDelete,
  onEditFollowUp,
  onDeleteFollowUp,
  onEditCompletedTask,
}: {
  employees: TaskWorkspaceEmployee[];
  pendingRows: TodayWorkQueueItem[];
  completedRows: CompletedWorkItem[];
  loading: boolean;
  viewerRole: Role;
  activeItemId?: string | null;
  onComplete: (item: TodayWorkQueueItem) => void;
  onOpen?: (item: TodayWorkQueueItem | CompletedWorkItem) => void;
  onEdit?: (item: TodayTaskApiRow) => void;
  onDelete?: (item: TodayTaskApiRow) => void;
  onEditFollowUp?: (item: TodayWorkQueueItem) => void;
  onDeleteFollowUp?: (item: TodayWorkQueueItem) => void;
  onEditCompletedTask?: (task: CompletedWorkItem) => void;
}) {
  const marketerBoards = React.useMemo(() => {
    return employees
      .filter((employee) => employee.roleKey === "MARKETER")
      .map((employee) => ({
        employee,
        pending: pendingRows.filter((task) => task.assignedToId === employee.id),
        completed: completedRows.filter((task) => task.assignedToId === employee.id),
      }))
      .filter((entry) => entry.pending.length || entry.completed.length);
  }, [completedRows, employees, pendingRows]);

  if (!marketerBoards.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-900">Marketer Wise Overview</h3>
          <p className="text-sm text-slate-500">Jar jar task, follow-up, priority ar recent update alada kore dekhanor jonno.</p>
        </div>
        <Badge variant="neutral" className="rounded-full px-3 py-1 text-xs font-bold">{marketerBoards.length} Marketer</Badge>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {marketerBoards.map(({ employee, pending, completed }) => (
          <DashboardCard
            key={employee.id}
            title={employee.name}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={pending.some((item) => item.queueType === "OVERDUE") ? "warning" : "neutral"}>{pending.length} Pending</Badge>
                <Badge variant="neutral">{completed.length} Completed</Badge>
              </div>
            }
            className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-base font-black text-slate-900">{employee.name}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{employee.designation || employee.role}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-800">Pending Work</p>
                  <Badge variant={pending.some((item) => item.queueType === "OVERDUE") ? "warning" : "neutral"}>{pending.length}</Badge>
                </div>
                <TodayWorkQueueList
                  rows={pending}
                  loading={loading}
                  viewerRole={viewerRole}
                  readOnly
                  emptyMessage="No pending work for this marketer."
                  activeItemId={activeItemId}
                  onOpen={(item) => onOpen?.(item)}
                  onComplete={onComplete}
                  maxHeightClassName="max-h-[360px]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-800">Completed Work</p>
                  <Badge variant="neutral">{completed.length}</Badge>
                </div>
                <CompletedWorkList
                  rows={completed}
                  loading={loading}
                  viewerRole={viewerRole}
                  readOnly
                  emptyMessage="No completed work for this marketer yet."
                  onOpen={(item) => onOpen?.(item)}
                  previewCount={3}
                />
              </div>
            </div>
          </DashboardCard>
        ))}
      </div>
    </div>
  );
}

function TodayTasksExecutionView({
  role,
  workspace,
  initialActiveTasks,
  initialCompletedTasks,
  previewMarketerId,
  mode = "all",
}: {
  role: Role;
  workspace: TaskWorkspaceData;
  initialActiveTasks?: TodayWorkQueueItem[];
  initialCompletedTasks?: CompletedWorkItem[];
  previewMarketerId?: string;
  mode?: "all" | "active" | "completed";
}) {
  const hasInitialRows = initialActiveTasks !== undefined && initialCompletedTasks !== undefined;
  const [open, setOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<EditableTaskModalItem | null>(null);
  const [editingFollowUp, setEditingFollowUp] = React.useState<EditableFollowUpModalItem | null>(null);
  const [detailItem, setDetailItem] = React.useState<(TodayWorkQueueItem | CompletedWorkItem) | null>(null);
  const [loading, setLoading] = React.useState(!hasInitialRows);
  const [error, setError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [activeTasks, setActiveTasks] = React.useState<TodayWorkQueueItem[]>(() => normalizeInitialTodayWorkRows(initialActiveTasks));
  const [completedTasks, setCompletedTasks] = React.useState<CompletedWorkItem[]>(() => normalizeInitialCompletedWorkRows(initialCompletedTasks));
  const [completionItem, setCompletionItem] = React.useState<TodayWorkQueueItem | null>(null);
  const [confirmTask, setConfirmTask] = React.useState<TodayTaskApiRow | null>(null);
  const [confirmPending, setConfirmPending] = React.useState(false);
  const [confirmMessage, setConfirmMessage] = React.useState("");
  const [followUpTask, setFollowUpTask] = React.useState<{
    id: string;
    title: string;
    companyId?: string | null;
    companyName: string;
    leadId?: string | null;
    leadName?: string | null;
    taskId?: string | null;
    defaultStep?: CrmPipelineStep;
    defaultMethod?: string;
  } | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<TodayWorkFilter>("all");
  const { refreshTaskCount, refreshCompletedTaskCount } = useTaskCounterContext();
  const scheduledRefreshTimers = React.useRef<number[]>([]);
  const crmDayRefreshTimer = React.useRef<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailCustomer = React.useMemo(
    () => buildCustomerQuickStub({
      id: detailItem?.companyId,
      name: detailItem?.companyName,
      phone: detailItem?.companyPrimaryPhone,
      cityOrZilla: detailItem?.companyCity,
    }),
    [detailItem],
  );

  React.useEffect(() => {
    if (!hasInitialRows) return;
    setActiveTasks(normalizeInitialTodayWorkRows(initialActiveTasks));
    setCompletedTasks(normalizeInitialCompletedWorkRows(initialCompletedTasks));
    setLoading(false);
  }, [hasInitialRows, initialActiveTasks, initialCompletedTasks]);

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const previewSuffix = previewMarketerId ? `?previewMarketerId=${encodeURIComponent(previewMarketerId)}` : "";
      const [todayResponse, completedResponse] = await Promise.all([
        fetch(`/api/tasks/today${previewSuffix}`, { cache: "no-store" }),
        fetch(`/api/tasks/completed${previewSuffix}`, { cache: "no-store" }),
      ]);

      const [todayResult, completedResult] = await Promise.all([
        todayResponse.json(),
        completedResponse.json(),
      ]);

      if (!todayResponse.ok) {
        throw new Error(typeof todayResult.message === "string" ? todayResult.message : "Failed to load today tasks.");
      }

      if (!completedResponse.ok) {
        throw new Error(typeof completedResult.message === "string" ? completedResult.message : "Failed to load completed tasks.");
      }

      setActiveTasks(sortTodayWorkQueue(dedupeRowsById(todayResult.rows as TodayWorkQueueItem[])));
      setCompletedTasks(sortCompletedWorkRows(dedupeRowsById(completedResult.rows as CompletedWorkItem[])));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [previewMarketerId]);

  React.useEffect(() => {
    if (hasInitialRows) return;
    void loadTasks();
  }, [hasInitialRows, loadTasks]);

  React.useEffect(() => {
    if (role !== "MARKETER") return;

    const handleLiveSync = () => {
      void loadTasks();
    };

    window.addEventListener(CRM_LIVE_SYNC_EVENT, handleLiveSync);
    return () => {
      window.removeEventListener(CRM_LIVE_SYNC_EVENT, handleLiveSync);
    };
  }, [loadTasks, role]);

  React.useEffect(() => {
    return () => {
      for (const timer of scheduledRefreshTimers.current) {
        window.clearTimeout(timer);
      }
      scheduledRefreshTimers.current = [];
      if (crmDayRefreshTimer.current !== null) {
        window.clearTimeout(crmDayRefreshTimer.current);
        crmDayRefreshTimer.current = null;
      }
    };
  }, []);

  const scheduleNextCrmDayRefresh = React.useCallback(() => {
    if (role !== "MARKETER") return;
    if (crmDayRefreshTimer.current !== null) {
      window.clearTimeout(crmDayRefreshTimer.current);
    }

    const nextCrmDayStart = getCrmDayWindow(new Date()).to;
    const delay = Math.max(0, nextCrmDayStart.getTime() - Date.now());

    crmDayRefreshTimer.current = window.setTimeout(() => {
      crmDayRefreshTimer.current = null;
      void loadTasks();
      void refreshTaskCount();
      void refreshCompletedTaskCount();
      scheduleNextCrmDayRefresh();
    }, delay + 250);
  }, [loadTasks, refreshCompletedTaskCount, refreshTaskCount, role]);

  React.useEffect(() => {
    if (role !== "MARKETER") return;
    scheduleNextCrmDayRefresh();

    return () => {
      if (crmDayRefreshTimer.current !== null) {
        window.clearTimeout(crmDayRefreshTimer.current);
        crmDayRefreshTimer.current = null;
      }
    };
  }, [role, scheduleNextCrmDayRefresh]);

  const scheduleQueueRefreshAt = React.useCallback((isoDate?: string | null) => {
    if (role !== "MARKETER") return;
    if (!isoDate) return;

    const triggerAt = new Date(isoDate).getTime();
    if (!Number.isFinite(triggerAt)) return;

    const delay = triggerAt - Date.now();
    if (delay <= 0) {
      void loadTasks();
      void refreshTaskCount();
      void refreshCompletedTaskCount();
      return;
    }

    const timer = window.setTimeout(() => {
      void loadTasks();
      void refreshTaskCount();
      void refreshCompletedTaskCount();
      scheduledRefreshTimers.current = scheduledRefreshTimers.current.filter((value) => value !== timer);
    }, delay + 250);

    scheduledRefreshTimers.current.push(timer);
  }, [loadTasks, refreshCompletedTaskCount, refreshTaskCount, role]);

  const handleCreated = (row: TodayTaskApiRow) => {
    setEditingTask(null);
    void loadTasks();
    void refreshTaskCount();
    scheduleQueueRefreshAt(row.taskDateIso);
  };

  const handleCompletionSaved = (result?: ActionResult) => {
    setCompletionItem(null);
    const scheduledDate =
      typeof result === "object" && result !== null && "nextFollowUpDate" in result && typeof result.nextFollowUpDate === "string"
        ? result.nextFollowUpDate
        : undefined;
    void loadTasks();
    void refreshTaskCount();
    void refreshCompletedTaskCount();
    scheduleQueueRefreshAt(scheduledDate);
  };

  const handleFollowUpSaved = (result?: ActionResult) => {
    setFollowUpTask(null);
    const scheduledDate =
      typeof result === "object" && result !== null && "followUpDate" in result && typeof result.followUpDate === "string"
        ? result.followUpDate
        : undefined;
    void loadTasks();
    void refreshTaskCount();
    void refreshCompletedTaskCount();
    scheduleQueueRefreshAt(scheduledDate);
  };

  const counts = React.useMemo(() => todayWorkCounts(activeTasks), [activeTasks]);
  const visibleTasks = React.useMemo(
    () => activeTasks.filter((task) => matchesTodayWorkFilter(task, activeFilter)),
    [activeFilter, activeTasks],
  );
  const myVisibleTasks = React.useMemo(
    () => visibleTasks.filter((task) => task.assignedToId === workspace.user.id),
    [visibleTasks, workspace.user.id],
  );
  const marketerVisibleTasks = React.useMemo(
    () => visibleTasks.filter((task) => task.assignedToId !== workspace.user.id),
    [visibleTasks, workspace.user.id],
  );
  const pendingCount = counts.all;
  const completedCount = completedTasks.length;
  const myCompletedTasks = React.useMemo(
    () => completedTasks.filter((task) => task.assignedToId === workspace.user.id),
    [completedTasks, workspace.user.id],
  );
  const marketerCompletedTasks = React.useMemo(
    () => completedTasks.filter((task) => task.assignedToId !== workspace.user.id),
    [completedTasks, workspace.user.id],
  );
  const marketerScopedVisibleTasks = React.useMemo(
    () => visibleTasks.filter((task) => workspace.employees.some((employee) => employee.roleKey === "MARKETER" && employee.id === task.assignedToId)),
    [visibleTasks, workspace.employees],
  );
  const marketerScopedCompletedTasks = React.useMemo(
    () => completedTasks.filter((task) => workspace.employees.some((employee) => employee.roleKey === "MARKETER" && employee.id === task.assignedToId)),
    [completedTasks, workspace.employees],
  );
  const adminManagedVisibleTasks = React.useMemo(
    () => visibleTasks.filter((task) => task.assignedToId === workspace.user.id || task.assignedById === workspace.user.id),
    [visibleTasks, workspace.user.id],
  );
  const adminManagedCompletedTasks = React.useMemo(
    () => completedTasks.filter((task) => task.assignedToId === workspace.user.id || task.assignedById === workspace.user.id),
    [completedTasks, workspace.user.id],
  );
  const canManageAssignedItem = React.useCallback(
    (item: { assignedToId: string }) => role === "MARKETER" || item.assignedToId === workspace.user.id,
    [role, workspace.user.id],
  );

  const handleEditCompletedTask = React.useCallback((task: CompletedWorkItem) => {
    if (task.sourceType === "TASK") {
      setEditingTask(toEditableCompletedTaskRow(task));
      setDetailItem(null);
      setOpen(true);
      return;
    }

    if (task.sourceType === "FOLLOW_UP") {
      if (task.taskId) {
        setEditingTask(toEditableCompletedTaskRow(task));
        setEditingFollowUp(null);
        setDetailItem(null);
        setOpen(true);
        return;
      }
      setEditingFollowUp(toEditableCompletedFollowUpItem(task));
      setDetailItem(null);
    }
  }, []);

  const handleTaskEdit = React.useCallback((task: TodayTaskApiRow) => {
    setEditingTask(task);
    setDetailItem(null);
    setOpen(true);
  }, []);

  const handleAddFollowUp = React.useCallback((task: CompletedWorkItem) => {
    setFollowUpTask({
      id: task.sourceId,
      title: task.title,
      companyId: task.companyId,
      companyName: task.companyName,
      leadId: task.leadId,
      leadName: task.leadName,
      taskId: task.taskId ?? (task.sourceType === "TASK" ? task.sourceId : null),
      defaultStep: normalizeCrmPipelineStep(task.title) ?? "Follow-up",
      defaultMethod: task.method,
    });
  }, []);

  const handleTaskDelete = React.useCallback(async (task: TodayTaskApiRow) => {
    setActionError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Task delete failed.");
      }
      setDetailItem(null);
      setEditingTask(null);
      void loadTasks();
      void refreshTaskCount();
      void refreshCompletedTaskCount();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Task delete failed.");
    }
  }, [loadTasks, refreshCompletedTaskCount, refreshTaskCount]);

  const handleFollowUpDelete = React.useCallback(async (item: TodayWorkQueueItem) => {
    if (item.sourceType !== "FOLLOW_UP") return;
    setActionError("");
    try {
      const response = await fetch(`/api/follow-ups/${item.sourceId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Follow-up delete failed.");
      }
      setDetailItem(null);
      setEditingFollowUp(null);
      void loadTasks();
      void refreshTaskCount();
      void refreshCompletedTaskCount();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Follow-up delete failed.");
    }
  }, [loadTasks, refreshCompletedTaskCount, refreshTaskCount]);

  const handleSimpleTaskComplete = React.useCallback(async () => {
    if (!confirmTask?.id) return;
    setConfirmPending(true);
    setConfirmMessage("");
    try {
      const response = await fetch(`/api/tasks/complete/${confirmTask.id}`, { method: "PATCH" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Task completion failed.");
      }
      setConfirmTask(null);
      void loadTasks();
      void refreshTaskCount();
      void refreshCompletedTaskCount();
    } catch (error) {
      setConfirmMessage(error instanceof Error ? error.message : "Task completion failed.");
    } finally {
      setConfirmPending(false);
    }
  }, [confirmTask, loadTasks, refreshCompletedTaskCount, refreshTaskCount]);

  const handleCompleteRequest = React.useCallback((task: TodayWorkQueueItem) => {
    setActionError("");
    if (role !== "MARKETER" && task.sourceType === "TASK" && task.assignedToId === workspace.user.id) {
      setConfirmMessage("");
      setConfirmTask(toEditableTaskRow(task));
      return;
    }
    setCompletionItem(task);
  }, [role, workspace.user.id]);

  React.useEffect(() => {
    if (loading) return;

    const editTaskId = searchParams.get("editTaskId")?.trim();
    const editFollowUpId = searchParams.get("editFollowUpId")?.trim();
    if (!editTaskId && !editFollowUpId) return;

    let handled = false;

    if (editTaskId) {
      const pendingTask = activeTasks.find((item) => item.sourceType === "TASK" && item.sourceId === editTaskId);
      if (pendingTask) {
        setEditingTask(toEditableTaskRow(pendingTask));
        setDetailItem(null);
        setOpen(true);
        handled = true;
      } else {
        const completedTask = completedTasks.find((item) => item.sourceType === "TASK" && item.sourceId === editTaskId);
        if (completedTask) {
          setDetailItem(completedTask);
          handled = true;
        }
      }
    }

    if (!handled && editFollowUpId) {
      const pendingFollowUp = activeTasks.find((item) => item.sourceType === "FOLLOW_UP" && item.sourceId === editFollowUpId);
      if (pendingFollowUp) {
        setEditingFollowUp(toEditablePendingFollowUpItem(pendingFollowUp));
        setDetailItem(null);
        handled = true;
      } else {
        const completedFollowUp = completedTasks.find((item) => item.sourceType === "FOLLOW_UP" && item.sourceId === editFollowUpId);
        if (completedFollowUp) {
          setDetailItem(null);
          if (completedFollowUp.taskId) {
            setEditingTask(toEditableCompletedTaskRow(completedFollowUp));
            setEditingFollowUp(null);
            setOpen(true);
          } else {
            setEditingFollowUp(toEditableCompletedFollowUpItem(completedFollowUp));
          }
          handled = true;
        }
      }
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("editTaskId");
    params.delete("editFollowUpId");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [activeTasks, completedTasks, loading, pathname, router, searchParams]);

  return (
    <>
      <div className="space-y-5">
        <PageHeader
          title={mode === "completed" ? "Completed Tasks" : "Today's Tasks"}
          description={mode === "completed" ? "Finished customer work and task history." : "All assigned tasks, follow-ups and overdue work in one view."}
          actions={mode === "completed" ? null : pageActions([{ label: "Add Task", icon: Plus, variant: "default", onClick: () => {
            setEditingTask(null);
            setOpen(true);
          } }])}
        />

        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {actionError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{actionError}</p> : null}

        {mode !== "completed" ? <Card className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 p-4">
            <TodayWorkFilterChips counts={counts} activeFilter={activeFilter} onChange={setActiveFilter} />
          </div>
        </Card> : null}

        {role === "SUPERVISOR" ? (
          <>
            <div className="grid gap-5 xl:grid-cols-2">
              <DashboardCard
                title="My Today's Tasks"
                action={<Badge variant={counts.overdue ? "warning" : "neutral"}>{myVisibleTasks.length} Pending</Badge>}
                className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
              >
                <TodayWorkQueueList
                  rows={myVisibleTasks}
                  loading={loading}
                  viewerRole={role}
                  emptyMessage="No personal tasks due right now."
                  activeItemId={completionItem?.id ?? null}
                  onOpen={setDetailItem}
                  onEdit={handleTaskEdit}
                  onDelete={(task) => void handleTaskDelete(task)}
                  onEditFollowUp={setEditingFollowUp}
                  onDeleteFollowUp={(task) => void handleFollowUpDelete(task)}
                  onComplete={handleCompleteRequest}
                />
              </DashboardCard>

              <DashboardCard
                title="My Completed Tasks"
                action={<Badge variant="neutral">{myCompletedTasks.length} Completed</Badge>}
                className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
              >
                <CompletedWorkList
                  rows={myCompletedTasks}
                  loading={loading}
                  viewerRole={role}
                  emptyMessage="No completed personal work yet."
                  onEditCompletedTask={handleEditCompletedTask}
                  onOpen={setDetailItem}
                  previewCount={5}
                />
              </DashboardCard>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <DashboardCard
                title="Marketer Tasks"
                action={<Badge variant={counts.overdue ? "warning" : "neutral"}>{marketerVisibleTasks.length} Pending</Badge>}
                className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
              >
                <TodayWorkQueueList
                  rows={marketerVisibleTasks}
                  loading={loading}
                  viewerRole={role}
                  readOnly
                  emptyMessage="No marketer tasks due right now."
                  activeItemId={completionItem?.id ?? null}
                  onOpen={setDetailItem}
                  onComplete={handleCompleteRequest}
                />
              </DashboardCard>

              <DashboardCard
                title="Marketer Completed Tasks"
                action={<Badge variant="neutral">{marketerCompletedTasks.length} Completed</Badge>}
                className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
              >
                <CompletedWorkList
                  rows={marketerCompletedTasks}
                  loading={loading}
                  viewerRole={role}
                  readOnly
                  emptyMessage="No completed marketer work yet."
                  onOpen={setDetailItem}
                  previewCount={6}
                />
              </DashboardCard>
            </div>
            <MarketerTaskBoards
              employees={workspace.employees}
              pendingRows={marketerScopedVisibleTasks}
              completedRows={marketerScopedCompletedTasks}
              loading={loading}
              viewerRole={role}
              activeItemId={completionItem?.id ?? null}
              onOpen={(item) => setDetailItem(item)}
              onComplete={handleCompleteRequest}
            />
          </>
        ) : mode === "completed" ? (
          <DashboardCard
            title="Completed Tasks"
            action={<Badge variant="neutral">{completedCount} Completed</Badge>}
            className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
          >
            <CompletedWorkList
              rows={completedTasks}
              loading={loading}
              viewerRole={role}
              emptyMessage="No completed work yet."
              onEditCompletedTask={handleEditCompletedTask}
              onOpen={setDetailItem}
            />
          </DashboardCard>
        ) : (
          <>
            <div className={cn("grid gap-5", role === "MARKETER" || mode === "active" ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]")}>
              <DashboardCard
                title={role === "ADMIN" ? "My Work Log" : "Today's Tasks"}
                action={
                  role === "MARKETER" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={rolePath(role, "completed-tasks")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                      >
                        Completed Tasks
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <Badge variant={counts.overdue ? "warning" : "neutral"}>{role === "ADMIN" ? adminManagedVisibleTasks.length : pendingCount} Pending</Badge>
                  )
                }
                className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
              >
                <TodayWorkQueueList
                  rows={role === "ADMIN" ? adminManagedVisibleTasks : visibleTasks}
                  loading={loading}
                  viewerRole={role}
                  emptyMessage={role === "ADMIN" ? "No assigned or created work log is pending right now." : "No pending work items match this view."}
                  activeItemId={completionItem?.id ?? null}
                  onOpen={setDetailItem}
                  onEdit={handleTaskEdit}
                  onDelete={(task) => void handleTaskDelete(task)}
                  onEditFollowUp={setEditingFollowUp}
                  onDeleteFollowUp={(task) => void handleFollowUpDelete(task)}
                  onComplete={handleCompleteRequest}
                  maxHeightClassName="max-h-[640px]"
                />
              </DashboardCard>

              {mode === "active" || role === "MARKETER" ? null : <DashboardCard
                title={role === "ADMIN" ? "My Completed Work" : "Completed Tasks"}
                action={<Badge variant="neutral">{role === "ADMIN" ? adminManagedCompletedTasks.length : completedCount} Completed</Badge>}
                className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
              >
                <CompletedWorkList
                  rows={role === "ADMIN" ? adminManagedCompletedTasks : completedTasks}
                  loading={loading}
                  viewerRole={role}
                  emptyMessage={role === "ADMIN" ? "No completed assigned or created work yet." : "No completed work yet."}
                  onEditCompletedTask={handleEditCompletedTask}
                  onOpen={setDetailItem}
                  previewCount={6}
                />
              </DashboardCard>}
            </div>
            {role === "MARKETER" && mode === "active" ? (
              <DashboardCard
                title="Completed Tasks"
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{completedCount} Completed</Badge>
                    <Link
                      href={rolePath(role, "completed-tasks")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      View All
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                }
                className="rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
              >
                <CompletedWorkList
                  rows={completedTasks}
                  loading={loading}
                  viewerRole={role}
                  emptyMessage="No completed work yet."
                  onEditCompletedTask={handleEditCompletedTask}
                  onOpen={setDetailItem}
                  previewCount={6}
                />
              </DashboardCard>
            ) : null}
            {role !== "MARKETER" ? (
              <MarketerTaskBoards
                employees={workspace.employees}
                pendingRows={marketerScopedVisibleTasks}
                completedRows={marketerScopedCompletedTasks}
                loading={loading}
                viewerRole={role}
                activeItemId={completionItem?.id ?? null}
                onOpen={(item) => setDetailItem(item)}
                onComplete={handleCompleteRequest}
              />
            ) : null}
          </>
        )}
      </div>

      <TaskCreateModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingTask(null);
        }}
        onCreated={handleCreated}
        onDeleted={() => {
          setOpen(false);
          setEditingTask(null);
          void loadTasks();
          void refreshTaskCount();
          void refreshCompletedTaskCount();
        }}
        role={role}
        workspace={workspace}
        initialTask={editingTask}
      />
      <FollowUpEditModal
        item={editingFollowUp}
        workspace={workspace}
        onClose={() => setEditingFollowUp(null)}
        onSaved={(result) => {
          setEditingFollowUp(null);
          handleFollowUpSaved(result);
        }}
        onDeleted={() => {
          setEditingFollowUp(null);
          void loadTasks();
          void refreshTaskCount();
          void refreshCompletedTaskCount();
        }}
      />
      <TaskCompleteConfirmModal
        task={confirmTask}
        pending={confirmPending}
        message={confirmMessage}
        onClose={() => {
          setConfirmTask(null);
          setConfirmMessage("");
        }}
        onConfirm={() => void handleSimpleTaskComplete()}
      />
      <WorkCompletionModal
        item={completionItem}
        onClose={() => {
          setCompletionItem(null);
          setActionError("");
        }}
        onSaved={handleCompletionSaved}
      />
      <TaskFollowUpModal
        key={followUpTask ? `${followUpTask.id}:${followUpTask.defaultStep ?? "Follow-up"}:${followUpTask.defaultMethod ?? "Phone Call"}` : "follow-up-empty"}
        task={followUpTask}
        onClose={() => setFollowUpTask(null)}
        onSaved={handleFollowUpSaved}
      />
      <DetailsDrawer
        open={Boolean(detailItem)}
        title={detailItem ? detailItem.title : "Task Detail"}
        onClose={() => setDetailItem(null)}
        variant="modal"
        panelClassName="max-w-5xl"
      >
        {detailItem ? (
          <div className="space-y-4">
            {detailCustomer ? (
              <CustomerQuickSummaryPanel
                customer={detailCustomer}
                open={Boolean(detailItem)}
                role={role}
                compact
                onAddTask={(item) => {
                  setDetailItem(null);
                  setEditingTask(item);
                  setOpen(true);
                }}
                onEditTask={(item) => {
                  setDetailItem(null);
                  setEditingTask(item);
                  setOpen(true);
                }}
                onEditFollowUp={(item) => {
                  setDetailItem(null);
                  setEditingFollowUp(item);
                }}
              />
            ) : null}
            {(() => {
              const crmStep = normalizeCrmPipelineStep(detailItem.title) ?? (detailItem.sourceType === "FOLLOW_UP" ? "Follow-up" : null);
              return crmStep ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">CRM Step</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{crmStep}</p>
                  <div className="mt-3">
                    <CrmPipelineStrip activeStep={crmStep} highlight />
                  </div>
                </div>
              ) : null;
            })()}
            {(() => {
              const detailContent = resolveTaskContentSnapshot(detailItem);
              const communicationStepNotes = filterDuplicateStepNotes(detailItem.stepNotes, detailContent.note).filter((entry) => entry.source === "COMMUNICATION");
              return (
                <>
                  <div className="grid gap-3">
                    <InfoLine label="Company" value={<EntityLink href={detailItem.companyHref} className="font-bold" stopPropagation onNavigate={() => setDetailItem(null)}>{detailItem.companyName}</EntityLink>} />
                    <InfoLine label="Product" value={detailItem.productName || "-"} />
                    <InfoLine label="Priority" value={detailItem.priority} />
                    <InfoLine label="Date & Time" value={`${detailItem.taskDateLabel} ${detailItem.timeLabel}`} />
                    {detailItem.reminder !== "-" ? <InfoLine label="Reminder" value={taskReminderLabel(detailItem.reminder)} /> : null}
                    <InfoLine label="Assigned At" value={detailItem.assignedAtLabel} />
                    {role !== "MARKETER" ? <InfoLine label="Assigned To" value={detailItem.assignedTo} /> : null}
                    {detailItem.statusKey === "COMPLETED" ? <InfoLine label="Completed At" value={detailItem.completedAtLabel} /> : null}
                    {detailItem.statusKey === "COMPLETED" ? <InfoLine label="Completed By" value={detailItem.completedBy} /> : null}
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase text-slate-500">Task Details</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{detailContent.details}</p>
                  </div>
                  <StepNotesHistoryPanel entries={communicationStepNotes} title="Short Notes" />
                </>
              );
            })()}
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={detailItem.priority} />
              {"queueLabel" in detailItem ? <StatusBadge value={detailItem.queueLabel} /> : <StatusBadge value={detailItem.status} />}
            </div>
            {"sourceType" in detailItem && detailItem.sourceType === "TASK" && detailItem.statusKey === "PENDING" && canManageAssignedItem(detailItem) ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setEditingTask(toEditableTaskRow(detailItem as TodayWorkQueueItem));
                    setDetailItem(null);
                    setOpen(true);
                  }}
                >
                  Edit Task
                </Button>
                <Button type="button" variant="destructive" onClick={() => void handleTaskDelete(toEditableTaskRow(detailItem as TodayWorkQueueItem))}>
                  Delete Task
                </Button>
              </div>
            ) : "sourceType" in detailItem && detailItem.sourceType === "FOLLOW_UP" && detailItem.statusKey === "PENDING" && canManageAssignedItem(detailItem) ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setEditingFollowUp(toEditablePendingFollowUpItem(detailItem as TodayWorkQueueItem));
                    setDetailItem(null);
                  }}
                >
                  Edit Follow-up
                </Button>
                <Button type="button" variant="destructive" onClick={() => void handleFollowUpDelete(detailItem as TodayWorkQueueItem)}>
                  Delete Follow-up
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DetailsDrawer>
    </>
  );
}

export function TasksPage({
  role,
  workspace,
  initialActiveTasks,
  initialCompletedTasks,
  previewMarketerId,
}: {
  role: Role;
  workspace: CrmWorkspace;
  initialActiveTasks?: TodayWorkQueueItem[];
  initialCompletedTasks?: CompletedWorkItem[];
  previewMarketerId?: string;
}) {
  return <TodayTasksExecutionView role={role} workspace={workspace} initialActiveTasks={initialActiveTasks} initialCompletedTasks={initialCompletedTasks} previewMarketerId={previewMarketerId} mode={role === "MARKETER" ? "active" : "all"} />;
}

export function CompletedTasksPage({
  role,
  workspace,
  initialCompletedTasks,
}: {
  role: Role;
  workspace: CrmWorkspace;
  initialCompletedTasks?: CompletedWorkItem[];
}) {
  return <TodayTasksExecutionView role={role} workspace={workspace} initialActiveTasks={[]} initialCompletedTasks={initialCompletedTasks} mode="completed" />;
}

function fallbackFollowUpPageData(workspace: CrmWorkspace): FollowUpPageData {
  const pageSize = 10;
  const total = workspace.followUps.length;

  return {
    rows: workspace.followUps.slice(0, pageSize),
    total,
    page: 1,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters: {
      search: undefined,
      dateFilter: "all",
      from: undefined,
      to: undefined,
    },
    summary: workspace.followUpSummary,
  };
}

export function FollowUpsPage({ workspace, followUpPage }: { workspace: CrmWorkspace; followUpPage: FollowUpPageData }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<FollowUpRow | null>(null);
  const [editingFollowUp, setEditingFollowUp] = React.useState<EditableFollowUpModalItem | null>(null);
  const resolvedFollowUpPage = followUpPage ?? fallbackFollowUpPageData(workspace);
  const filters = resolvedFollowUpPage.filters;
  const [dateFilterValue, setDateFilterValue] = React.useState(filters.dateFilter);
  const filterFormRef = React.useRef<HTMLFormElement | null>(null);

  React.useEffect(() => {
    setDateFilterValue(filters.dateFilter);
  }, [filters.dateFilter]);

  const isCustomDateRange = dateFilterValue === "custom";
  const selectedCustomer = React.useMemo(() => {
    if (!selected) return null;
    const selectedCustomerName = selected.customer.trim().toLowerCase();
    const matchedCustomer = workspace.companies.find((customer) => {
      if (selected.companyId && customer.id === selected.companyId) return true;
      return selectedCustomerName.length > 0 && customer.name.trim().toLowerCase() === selectedCustomerName;
    });

    return matchedCustomer ?? (
      selected.companyId
        ? buildCustomerQuickStub({
            id: selected.companyId,
            name: selected.customer,
          })
        : null
    );
  }, [selected, workspace.companies]);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.dateFilter !== "all") params.set("dateFilter", filters.dateFilter);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("page", String(page));
    params.set("pageSize", String(resolvedFollowUpPage.pageSize));
    return `?${params.toString()}`;
  };
  const columns = ["Follow-up Date", "Company / Customer", "Phone", "Lead", "Assigned Marketer", "Follow-up Note", "Last Communication", "Priority", "Status", "Next Action", "Created By", "Action"];

  return (
    <>
      <PageHeader title="Follow-up Center" description="Due today, overdue, upcoming, and completed follow-ups." actions={pageActions([{ label: "Add Follow-up", icon: Plus, variant: "default", onClick: () => setOpen(true) }])} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Due Today" value={String(workspace.followUpSummary.today)} helper="Need action" icon={CalendarClock} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Overdue" value={String(workspace.followUpSummary.overdue)} helper="Priority queue" icon={Phone} tone="bg-red-100 text-red-700" />
        <StatCard title="Upcoming" value={String(workspace.followUpSummary.upcoming)} helper="Scheduled" icon={CalendarClock} tone="bg-emerald-100 text-emerald-700" />
        <StatCard title="Completed" value={String(workspace.followUpSummary.completed)} helper="Finished" icon={Check} tone="bg-slate-100 text-slate-700" />
      </div>
      <Card className="p-4">
        <form ref={filterFormRef} method="get" className="grid gap-3 lg:grid-cols-[1.25fr_180px_160px_160px_auto] lg:items-end">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Search</span>
            <Input name="search" defaultValue={filters.search ?? ""} placeholder="Company, lead, phone, email..." />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Date Filter</span>
            <select
              name="dateFilter"
              value={dateFilterValue}
              onChange={(event) => {
                const nextValue = event.target.value as typeof filters.dateFilter;
                setDateFilterValue(nextValue);
                if (nextValue !== "custom") {
                  filterFormRef.current?.requestSubmit();
                }
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All Follow-ups</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <TextField label="From" name="from" type="date" defaultValue={filters.from} readOnly={!isCustomDateRange} disabled={!isCustomDateRange} />
          <TextField label="To" name="to" type="date" defaultValue={filters.to} readOnly={!isCustomDateRange} disabled={!isCustomDateRange} />
          <div className="flex flex-wrap gap-2">
            <input type="hidden" name="page" value="1" />
            <input type="hidden" name="pageSize" value={resolvedFollowUpPage.pageSize} />
            <Button type="submit" className="h-10">Apply</Button>
            <Link href="?" className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Reset</Link>
          </div>
        </form>
      </Card>

      <Card className="hidden overflow-hidden 2xl:block">
        <div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>{columns.map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resolvedFollowUpPage.rows.length ? resolvedFollowUpPage.rows.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer transition hover:bg-blue-50/50"
                  tabIndex={0}
                  onClick={() => setSelected(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setSelected(item);
                  }}
                >
                  <td className="px-4 py-3 font-bold text-slate-900">{item.followUpDate}</td>
                  <td className="px-4 py-3">
                    <EntityLink href={item.companyId ? `/customers/${item.companyId}` : item.href} className="font-bold" stopPropagation>{item.customer}</EntityLink>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{item.phone}</td>
                  <td className="px-4 py-3">
                    <EntityLink href={item.leadId ? `/leads/${item.leadId}` : undefined} className="font-semibold" stopPropagation>{item.lead}</EntityLink>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.assignedTo}</td>
                  <td className="max-w-[220px] px-4 py-3 text-slate-600"><p className="line-clamp-2">{item.note}</p></td>
                  <td className="px-4 py-3"><StatusBadge value={item.lastCommunicationType} /></td>
                  <td className="px-4 py-3"><StatusBadge value={item.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge value={item.bucket} /></td>
                  <td className="max-w-[220px] px-4 py-3 text-slate-600"><p className="line-clamp-2">{item.nextDiscussionPlan}</p></td>
                  <td className="px-4 py-3 text-slate-600">{item.createdBy}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingFollowUp(toEditableFollowUpModalItem(item))}>Edit</Button>
                      {item.bucket !== "Completed" ? (
                        <form action={updateFollowUpStatusAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="COMPLETED" />
                          <Button type="submit" size="sm" variant="outline">Complete</Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={columns.length} className="px-4 py-10 text-center font-semibold text-slate-500">No follow-ups match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-3 2xl:hidden">
        {resolvedFollowUpPage.rows.length ? resolvedFollowUpPage.rows.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setSelected(item);
            }}
            className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">
                  <EntityLink href={item.companyId ? `/customers/${item.companyId}` : item.href} className="font-black" stopPropagation>{item.customer}</EntityLink>
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Lead: <EntityLink href={item.leadId ? `/leads/${item.leadId}` : undefined} className="text-xs font-semibold" stopPropagation>{item.lead}</EntityLink>
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Phone: {item.phone}</p>
              </div>
              <StatusBadge value={item.bucket} />
            </div>
            <p className="mt-3 text-sm text-slate-600">{item.note}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span><b>Date:</b> {item.followUpDate}</span>
              <span><b>By:</b> {item.assignedTo}</span>
              <span><b>Type:</b> {item.lastCommunicationType}</span>
              <span><b>Priority:</b> {item.priority}</span>
            </div>
          </div>
        )) : <EmptyState title="No follow-ups found" description="Try a different search or date filter." />}
      </div>

      <div className="flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <span>Showing {resolvedFollowUpPage.rows.length} of {resolvedFollowUpPage.total} follow-ups</span>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={resolvedFollowUpPage.page <= 1}
            className={cn("inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 font-semibold transition", resolvedFollowUpPage.page <= 1 ? "pointer-events-none bg-slate-100 text-slate-400" : "bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700")}
            href={pageHref(Math.max(1, resolvedFollowUpPage.page - 1))}
          >
            Previous
          </Link>
          <span className="font-semibold text-slate-700">Page {resolvedFollowUpPage.page} of {resolvedFollowUpPage.totalPages}</span>
          <Link
            aria-disabled={resolvedFollowUpPage.page >= resolvedFollowUpPage.totalPages}
            className={cn("inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 font-semibold transition", resolvedFollowUpPage.page >= resolvedFollowUpPage.totalPages ? "pointer-events-none bg-slate-100 text-slate-400" : "bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700")}
            href={pageHref(Math.min(resolvedFollowUpPage.totalPages, resolvedFollowUpPage.page + 1))}
          >
            Next
          </Link>
        </div>
      </div>

      <FormModal
        open={Boolean(selected)}
        title={selected ? `${selected.customer} Follow-up` : "Follow-up detail"}
        onClose={() => setSelected(null)}
        panelClassName="max-w-5xl"
      >
        {selected ? (
          <div className="space-y-4">
            {selectedCustomer ? (
              <CustomerQuickSummaryPanel customer={selectedCustomer} open={Boolean(selected)} role={workspace.user.role} compact />
            ) : (
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Quick CRM Context</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">Ei follow-up er sathe kono linked customer profile paoa jayni, tai full activity snapshot dekhano gelo na.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge value={selected.lastCommunicationType} />
                  <StatusBadge value={selected.priority} />
                  <StatusBadge value={selected.bucket} />
                </div>
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Follow-up Note</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{selected.note}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Next Action / Plan</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{selected.nextDiscussionPlan}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Linked CRM Records</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Company / Customer</p>
                      <div className="mt-1.5 text-sm font-bold text-slate-800">
                        <EntityLink href={selected.companyId ? `/customers/${selected.companyId}` : selected.href} className="font-bold">{selected.customer}</EntityLink>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Phone</p>
                      <div className="mt-1.5 text-sm font-bold text-slate-800">{selected.phone}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Lead</p>
                      <div className="mt-1.5 text-sm font-bold text-slate-800">
                        <EntityLink href={selected.leadId ? `/leads/${selected.leadId}` : undefined} className="font-bold">{selected.lead}</EntityLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Timeline Snapshot</p>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Follow-up Date</p>
                      <p className="mt-1.5 text-sm font-bold text-slate-800">{selected.followUpDate}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Assigned Marketer</p>
                      <p className="mt-1.5 text-sm font-bold text-slate-800">{selected.assignedTo}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Created</p>
                      <p className="mt-1.5 text-sm font-bold text-slate-800">{selected.createdAt}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">By {selected.createdBy}</p>
                    </div>
                    {selected.completedAt !== "-" ? (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-xs font-bold uppercase text-emerald-700">Completed At</p>
                        <p className="mt-1.5 text-sm font-bold text-emerald-800">{selected.completedAt}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Status Overview</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge value={selected.lastCommunicationType} />
                    <StatusBadge value={selected.priority} />
                    <StatusBadge value={selected.bucket} />
                  </div>
                </div>

                {selected.bucket !== "Completed" ? (
                  <form action={updateFollowUpStatusAction} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <input type="hidden" name="id" value={selected.id} />
                    <input type="hidden" name="status" value="COMPLETED" />
                    <Button type="submit" className="w-full">Mark Completed</Button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </FormModal>
      <FollowUpEditModal
        item={editingFollowUp}
        workspace={workspace}
        onClose={() => setEditingFollowUp(null)}
        onSaved={() => {
          setEditingFollowUp(null);
          router.refresh();
        }}
        onDeleted={() => {
          setEditingFollowUp(null);
          if (selected?.id === editingFollowUp?.sourceId) {
            setSelected(null);
          }
          router.refresh();
        }}
      />
      <FormModal open={open} title="Add Follow-up" onClose={() => setOpen(false)}>
        <FollowUpForm workspace={workspace} onDone={() => setOpen(false)} />
      </FormModal>
    </>
  );
}

function productAccentTone(seed: string) {
  const tones = [
    { avatar: "from-blue-600 to-indigo-600", surface: "from-blue-700 via-indigo-600 to-cyan-500" },
    { avatar: "from-emerald-600 to-teal-600", surface: "from-emerald-700 via-teal-600 to-cyan-500" },
    { avatar: "from-fuchsia-600 to-violet-600", surface: "from-fuchsia-700 via-violet-600 to-indigo-500" },
    { avatar: "from-orange-500 to-amber-500", surface: "from-orange-600 via-amber-500 to-yellow-400" },
  ];
  const source = seed.trim() || "A";
  const index = Array.from(source).reduce((sum, character) => sum + character.charCodeAt(0), 0) % tones.length;
  return tones[index];
}

function normalizeProductLookup(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function matchesProductLead(product: ProductRow, lead: LeadRow) {
  if (lead.productInterestId && lead.productInterestId === product.id) return true;
  return normalizeProductLookup(lead.productInterest) === normalizeProductLookup(product.name);
}

function productRatingFromScore(score?: number | null) {
  if (typeof score !== "number" || !Number.isFinite(score) || score <= 0) {
    return { label: "No rating yet", stars: 0, tone: "text-slate-400" };
  }

  if (score >= 80) return { label: "Hot", stars: 5, tone: "text-emerald-600" };
  if (score >= 60) return { label: "Strong", stars: 4, tone: "text-blue-600" };
  if (score >= 40) return { label: "Warm", stars: 3, tone: "text-amber-600" };
  if (score >= 20) return { label: "Early", stars: 2, tone: "text-orange-500" };
  return { label: "Cold", stars: 1, tone: "text-rose-500" };
}

function productStageBadgeVariant(stage?: string | null): "default" | "success" | "warning" | "danger" | "neutral" | "violet" {
  const normalized = stage?.trim().toLowerCase() ?? "";
  if (!normalized) return "neutral";
  if (normalized.includes("won") || normalized.includes("sale")) return "success";
  if (normalized.includes("lost") || normalized.includes("failed")) return "danger";
  if (normalized.includes("quotation") || normalized.includes("demo") || normalized.includes("negotiation")) return "violet";
  if (normalized.includes("follow")) return "warning";
  return "default";
}

function ProductVisual({ product }: { product: ProductRow }) {
  const tone = productAccentTone(product.name);

  return (
    <div className={cn("relative overflow-hidden rounded-[28px] bg-gradient-to-br p-6 text-white shadow-[0_20px_44px_rgba(15,23,42,0.16)]", tone.surface)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_42%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">{product.category || "Product"}</p>
          <h2 className="mt-2 truncate text-2xl font-black">{product.name}</h2>
          <p className="mt-2 text-sm font-medium text-white/80">{product.brand || "No brand"} / {product.status}</p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-black shadow-lg backdrop-blur">
          {formatCurrency(product.price)}
        </span>
      </div>
      <div className="relative mt-8 flex flex-wrap gap-2.5 text-xs font-bold text-white/90">
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">{product.interestedCustomers} interested</span>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">{product.communicationCount} communications</span>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">{product.followUpCount} follow-ups</span>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">{product.conversionRate}% conversion</span>
      </div>
    </div>
  );
}

export function ProductsPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  const router = useRouter();
  const [, startRefresh] = React.useTransition();
  const canManageProducts = true;
  const [open, setOpen] = React.useState(false);
  const [products, setProducts] = React.useState(workspace.products);
  const [editingProductId, setEditingProductId] = React.useState<string | null>(null);
  const [deleteProductId, setDeleteProductId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteMessage, setDeleteMessage] = React.useState("");

  const editingProduct = editingProductId ? products.find((item) => item.id === editingProductId) ?? null : null;
  const deletingProduct = deleteProductId ? products.find((item) => item.id === deleteProductId) ?? null : null;

  React.useEffect(() => {
    setProducts(workspace.products);
  }, [workspace.products]);

  return (
    <>
      <PageHeader
        title="Product / Services"
        description="Products and opportunity analytics by interested customers, follow-ups, sales, and conversion."
        actions={canManageProducts ? pageActions([{
          label: "Add Product",
          icon: Plus,
          variant: "default",
          onClick: () => {
            setEditingProductId(null);
            setOpen(true);
          },
        }]) : undefined}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Target Companies"
          value={String(workspace.productCompanyContactSummary.totalTargetCompanies)}
          helper={role === "MARKETER" ? "Your companies to contact" : "All marketers combined"}
          icon={Building2}
          tone="bg-slate-100 text-slate-700"
        />
        <StatCard
          title="Contacted Companies"
          value={String(workspace.productCompanyContactSummary.contactedCompanies)}
          helper={role === "MARKETER" ? "You already contacted" : "Team already contacted"}
          icon={PhoneCall}
          tone="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          title="Remaining Companies"
          value={String(workspace.productCompanyContactSummary.remainingCompanies)}
          helper={role === "MARKETER" ? "Still left for you" : "Still left for the team"}
          icon={Clock3}
          tone="bg-amber-100 text-amber-700"
        />
      </div>
      {feedback ? (
        <div className={cn("rounded-xl border px-4 py-3 text-sm font-semibold", feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")}>
          {feedback.message}
        </div>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {products.map((product) => {
          const tone = productAccentTone(product.name);
          const previewAssignees = product.assignedMarketers.slice(0, 3);
          const hiddenAssigneeCount = product.assignedCount - previewAssignees.length;

          return (
            <div key={product.id} className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_38px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_24px_48px_rgba(37,99,235,0.14)]">
              <Link href={`/products/${product.id}`} className="mb-4 block">
                <div className={cn("relative overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br shadow-sm", tone.surface)}>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center">
                      <span className={cn("inline-flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br text-2xl font-black text-white shadow-lg", tone.avatar)}>
                        {initials(product.name || "PR")}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/products/${product.id}`} className="min-w-0 flex-1">
                  <div className="flex items-start gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{product.category || "Product"}</p>
                      <h3 className="truncate text-lg font-black text-slate-950">{product.name}</h3>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {product.brand || "No brand"} • {formatCurrency(product.price)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {previewAssignees.length ? (
                          previewAssignees.map((name) => (
                            <span key={`${product.id}-${name}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ring-1", avatarTone(name))}>
                                {initials(name)}
                              </span>
                              <span className="max-w-24 truncate">{name}</span>
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                            No assignee yet
                          </span>
                        )}
                        {hiddenAssigneeCount > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                            +{hiddenAssigneeCount} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/products/${product.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700" aria-label="View product">
                    <Eye className="h-4 w-4" />
                  </Link>
                  {canManageProducts ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Edit product"
                        onClick={() => {
                          setFeedback(null);
                          setEditingProductId(product.id);
                          setOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete product"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          setFeedback(null);
                          setDeleteProductId(product.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    <Target className="h-3.5 w-3.5 text-blue-600" />
                    Target Companies
                  </span>
                  <span className="text-sm font-black text-slate-950">{product.targetCompanies}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    <UserPlus className="h-3.5 w-3.5 text-violet-600" />
                    Assigned
                  </span>
                  <span className="text-sm font-black text-slate-950">{product.assignedCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                    Contacted
                  </span>
                  <span className="text-sm font-black text-slate-950">{product.contactedCompanies}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5 text-amber-600" />
                    Remaining
                  </span>
                  <span className="text-sm font-black text-slate-950">{product.remainingCompanies}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Quotations</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{product.quotationCount}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Sales</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{product.salesCount}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Conversion</p>
                  <p className="mt-1 text-lg font-black text-blue-700">{product.conversionRate}%</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {product.interestedCustomers} live product record{product.interestedCustomers === 1 ? "" : "s"}
                </span>
                <Link href={`/products/${product.id}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 transition hover:text-blue-800">
                  Open product
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      {!products.length ? <EmptyState title="No products yet" description="Create your real product or service catalog to start tracking opportunities." /> : null}
      {canManageProducts ? (
        <>
          <FormModal title={editingProduct ? "Update Product / Service" : "Create Product / Service"} open={open} onClose={() => {
            setOpen(false);
            setEditingProductId(null);
          }}>
            <ProductForm
              product={editingProduct}
              onSuccess={(row) => {
                setProducts((current) => {
                  if (editingProduct) {
                    return current.map((item) => (
                      item.id === row.id
                        ? {
                            ...item,
                            name: row.name,
                            category: row.category,
                            brand: row.brand,
                            price: row.price,
                            imageUrl: row.imageUrl,
                            description: row.description,
                            specification: row.specification,
                            status: row.status,
                          }
                        : item
                    ));
                  }

                  return [row, ...current];
                });
                setFeedback({ type: "success", message: editingProduct ? "Product updated successfully." : "Product created successfully." });
                startRefresh(() => router.refresh());
              }}
              onDone={() => {
                setOpen(false);
                setEditingProductId(null);
              }}
            />
          </FormModal>
          <FormModal title="Delete Product" open={Boolean(deletingProduct)} onClose={() => setDeleteProductId(null)} panelClassName="max-w-md">
            {deletingProduct ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-700">
                  Are you sure you want to delete <span className="font-black">{deletingProduct.name}</span>?
                </p>
                {deleteMessage ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{deleteMessage}</p> : null}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    disabled={deletePending}
                    onClick={async () => {
                      setDeletePending(true);
                      setDeleteMessage("");
                      try {
                        const response = await fetch(`/api/products/${deletingProduct.id}`, { method: "DELETE" });
                        const result = await response.json();
                        if (!response.ok || !result.success || typeof result.id !== "string") {
                          setDeleteMessage(result.message ?? "Product delete failed.");
                          return;
                        }

                        setProducts((current) => current.filter((item) => item.id !== result.id));
                        setFeedback({ type: "success", message: "Product deleted successfully." });
                        setDeleteProductId(null);
                        startRefresh(() => router.refresh());
                      } catch (error) {
                        setDeleteMessage(error instanceof Error ? error.message : "Product delete failed.");
                      } finally {
                        setDeletePending(false);
                      }
                    }}
                  >
                    {deletePending ? "Deleting..." : "Delete Product"}
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setDeleteProductId(null)} disabled={deletePending}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </FormModal>
        </>
      ) : null}
    </>
  );
}

type ProductCompanyBucket = "total" | "shortlist" | "contacted" | "not-contacted" | "rest";

type ProductCompanyDeskQuery = {
  bucket?: ProductCompanyBucket;
  assignedUserId?: string;
  search?: string;
};

type ProductCompanyDeskRow = {
  id: string;
  name: string;
  marketer: string;
  marketerId?: string;
  stage: string;
  communications: number;
  followUps: number;
  quotations: number;
  lastContact: string;
  nextFollowUp: string;
  city: string;
  phone: string;
};

const PRODUCT_COMPANY_BUCKET_OPTIONS: { key: ProductCompanyBucket; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "shortlist", label: "Shortlist" },
  { key: "contacted", label: "Contacted" },
  { key: "not-contacted", label: "Not Contacted" },
  { key: "rest", label: "Rest" },
];

function normalizeProductCompanyBucket(value?: string | null): ProductCompanyBucket {
  if (value === "total" || value === "shortlist" || value === "contacted" || value === "not-contacted" || value === "rest") return value;
  return "shortlist";
}

function buildProductCompanyDeskPath(productId: string, query?: ProductCompanyDeskQuery) {
  const params = new URLSearchParams();
  const bucket = normalizeProductCompanyBucket(query?.bucket);
  if (bucket !== "shortlist") params.set("bucket", bucket);
  if (query?.assignedUserId && query.assignedUserId !== "all") params.set("assignedUserId", query.assignedUserId);
  if (query?.search?.trim()) params.set("search", query.search.trim());
  const queryString = params.toString();
  return `/products/${encodeURIComponent(productId)}/companies${queryString ? `?${queryString}` : ""}`;
}

function matchesProductCompanyDeskSearch(row: ProductCompanyDeskRow, search: string) {
  const keyword = search.trim().toLowerCase();
  if (!keyword) return true;
  return [row.name, row.marketer, row.stage, row.city, row.phone, row.lastContact]
    .some((value) => value?.toLowerCase().includes(keyword));
}

export function ProductDetailsPage({ role, workspace, product, productEngagement }: { role: Role; workspace: CrmWorkspace; product?: ProductRow; productEngagement?: ProductEngagementData }) {
  const router = useRouter();
  const [feedback, setFeedback] = React.useState<UserFeedback>(null);
  const [selectedMarketerName, setSelectedMarketerName] = React.useState<string | null>(null);
  const [selectedCompanyBucket, setSelectedCompanyBucket] = React.useState<ProductCompanyBucket>("shortlist");
  const [selectedCompanyIds, setSelectedCompanyIds] = React.useState<string[]>([]);
  const [assignModalOpen, setAssignModalOpen] = React.useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = React.useState(false);
  const [assignMarketerId, setAssignMarketerId] = React.useState("");
  const [assignMessage, setAssignMessage] = React.useState("");
  const [assignPending, startAssign] = React.useTransition();
  const active = product;
  if (!active) return <EmptyState title="Product not found" description="The requested product is not available." />;
  const engagement = productEngagement ?? {
    summary: {
      totalCompaniesContacted: 0,
      totalLeadsInterested: 0,
      totalCommunicationCount: 0,
      totalShortlistedCompanies: 0,
      contactedCompanies: 0,
      notContactedCompanies: 0,
      totalCallCount: 0,
      totalWhatsAppCount: 0,
      totalEmailCount: 0,
      totalMeetingCount: 0,
      followUpCount: 0,
      quotationSentCount: 0,
      salesCount: 0,
      conversionRate: 0,
    },
    rows: [],
    filters: {},
    filterOptions: { communicationTypes: [], assignedUsers: [] },
  };
  const productLeads = workspace.leads.filter((lead) => matchesProductLead(active, lead));
  const productLeadMap = new Map(productLeads.map((lead) => [lead.id, lead]));
  const fallbackEngagementRows = productLeads
    .map((lead) => ({
      id: `fallback-${lead.id}`,
      companyId: lead.companyId ?? null,
      leadId: lead.id,
      companyName: lead.company || lead.customerName || "-",
      leadName: lead.title || "-",
      communicationType: "-",
      summary: lead.notes || "-",
      discussionTopic: active.name,
      nextFollowUpDate: lead.followUpDate || "-",
      lastContactDate: lead.createdAt || "-",
      status: lead.status || "Interested",
      assignedMarketer: lead.assignedTo || "-",
      communicationCount: lead.communicationCount,
      followUpCount: lead.followUpCount,
      quotationCount: 0,
      probability: lead.purchaseProbability,
    }))
    .sort((left, right) => right.communicationCount - left.communicationCount || right.probability - left.probability);
  const insightSourceRows = engagement.rows.length ? engagement.rows : fallbackEngagementRows;
  const customerInsightRows = insightSourceRows.map((row) => {
    const relatedLead =
      (row.leadId ? productLeadMap.get(row.leadId) : undefined) ??
      productLeads.find((lead) => {
        if (row.companyId && lead.companyId === row.companyId) return true;
        return row.companyName !== "-" && row.companyName === lead.company;
      });
    const rating = productRatingFromScore(relatedLead?.score);

    return {
      ...row,
      customerName: row.companyName !== "-" ? row.companyName : relatedLead?.company || relatedLead?.customerName || "-",
      leadDisplayName: row.leadName !== "-" ? row.leadName : relatedLead?.title || "-",
      stage: row.status !== "-" ? row.status : relatedLead?.status || "Interested",
      assignedOwner: row.assignedMarketer !== "-" ? row.assignedMarketer : relatedLead?.assignedTo || "-",
      assignedOwnerId: relatedLead?.assignedToId ?? undefined,
      probability: relatedLead?.purchaseProbability ?? 0,
      ratingLabel: rating.label,
      ratingTone: rating.tone,
      ratingStars: rating.stars,
      ratingScore: relatedLead?.score ?? 0,
      nextFollowUpDisplay: row.nextFollowUpDate !== "-" ? row.nextFollowUpDate : relatedLead?.followUpDate || "-",
      lastContactDisplay: row.lastContactDate !== "-" ? row.lastContactDate : relatedLead?.createdAt || "-",
    };
  });
  const productLeadIds = new Set(productLeads.map((lead) => lead.id));
  const productCompanyIds = new Set(
    [
      ...productLeads.map((lead) => lead.companyId),
      ...customerInsightRows.map((row) => row.companyId),
    ].filter((value): value is string => Boolean(value)),
  );
  const hasKeyword = (keyword: string, ...values: (string | null | undefined)[]) => values.some((value) => value?.toLowerCase().includes(keyword.toLowerCase()));
  const isDemoActivityRow = (row: (typeof customerInsightRows)[number]) => hasKeyword("demo", row.stage, row.discussionTopic, row.summary);
  const isMeetingActivityRow = (row: (typeof customerInsightRows)[number]) => hasKeyword("meeting", row.communicationType, row.discussionTopic, row.summary);
  const productFollowUps = workspace.followUps.filter((item) => (item.leadId && productLeadIds.has(item.leadId)) || (item.companyId && productCompanyIds.has(item.companyId)));
  const productQuotations = workspace.quotations.filter((item) => {
    const normalizedProduct = item.product.trim().toLowerCase();
    const normalizedActive = active.name.trim().toLowerCase();
    return (item.leadId && productLeadIds.has(item.leadId)) || (item.companyId && productCompanyIds.has(item.companyId)) || normalizedProduct.includes(normalizedActive);
  });
  const demoActivityCount = customerInsightRows.filter((row) => isDemoActivityRow(row) || isMeetingActivityRow(row)).length;
  const recentConversations = customerInsightRows.slice(0, 4);
  const visibleCustomerRows = customerInsightRows.slice(0, 6);
  const descriptionText = active.description && active.description !== "-" ? active.description : "No product summary saved yet.";
  const specificationText = active.specification && active.specification !== "-" ? active.specification : "No specification saved yet.";
  const marketerOptions = React.useMemo(
    () => workspace.employees.filter((employee) => employee.roleKey === "MARKETER").map((employee) => ({ id: employee.id, name: employee.name })),
    [workspace.employees],
  );
  const averageProbability = productLeads.length
    ? Math.round(productLeads.reduce((sum, lead) => sum + lead.purchaseProbability, 0) / productLeads.length)
    : 0;
  const stageOrder = ["Interested", "Follow-up", "Demo", "Quotation", "Negotiation", "Won", "Lost"];
  const stageSummaryMap = new Map<string, number>();
  for (const row of customerInsightRows) {
    const key = row.stage || "Interested";
    stageSummaryMap.set(key, (stageSummaryMap.get(key) ?? 0) + 1);
  }
  const stageSummary = Array.from(stageSummaryMap.entries())
    .map(([name, leads]) => ({ name, leads }))
    .sort((left, right) => {
      const leftIndex = stageOrder.indexOf(left.name);
      const rightIndex = stageOrder.indexOf(right.name);
      const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return safeLeft - safeRight || right.leads - left.leads;
    });
  const assignedTeam = Array.from(
    customerInsightRows.reduce((map, row) => {
      if (!row.assignedOwner || row.assignedOwner === "-") return map;
      const entry = map.get(row.assignedOwner) ?? {
        name: row.assignedOwner,
        customers: new Set<string>(),
        leadCount: 0,
        communicationCount: 0,
        followUpCount: 0,
        demoCount: 0,
        quotationCount: 0,
      };
      entry.customers.add(row.customerName);
      entry.leadCount += row.leadId ? 1 : 0;
      entry.communicationCount += row.communicationCount;
      entry.followUpCount += row.followUpCount;
      entry.demoCount += isDemoActivityRow(row) || isMeetingActivityRow(row) ? 1 : 0;
      entry.quotationCount += row.quotationCount;
      map.set(row.assignedOwner, entry);
      return map;
    }, new Map<string, { name: string; customers: Set<string>; leadCount: number; communicationCount: number; followUpCount: number; demoCount: number; quotationCount: number }>()),
  )
    .map(([name, entry]) => ({
      name,
      customerCount: entry.customers.size,
      leadCount: entry.leadCount,
      communicationCount: entry.communicationCount,
      followUpCount: entry.followUpCount,
      demoCount: entry.demoCount,
      quotationCount: entry.quotationCount,
    }))
    .sort((left, right) => right.communicationCount - left.communicationCount || right.customerCount - left.customerCount);
  const marketerDetails = assignedTeam.map((member) => {
    const rows = customerInsightRows.filter((row) => row.assignedOwner === member.name);
    const followUps = productFollowUps.filter((item) => item.assignedTo === member.name);
    const quotations = productQuotations.filter((item) => item.createdBy === member.name);

    return {
      ...member,
      rows,
      followUps,
      quotations,
      latestNotes: rows
        .map((row) => ({
          id: row.id,
          companyName: row.customerName,
          leadName: row.leadDisplayName,
          stage: row.stage,
          summary: row.summary,
          discussionTopic: row.discussionTopic,
          lastContact: row.lastContactDisplay,
          nextFollowUp: row.nextFollowUpDisplay,
          calls: row.communicationCount,
          followUps: row.followUpCount,
        }))
        .slice(0, 6),
    };
  });
  const selectedMarketer = selectedMarketerName ? marketerDetails.find((member) => member.name === selectedMarketerName) ?? null : null;
  const workspaceCompanyById = React.useMemo(() => new Map(workspace.companies.map((company) => [company.id, company])), [workspace.companies]);
  const workspaceCompanyByName = React.useMemo(
    () => new Map(workspace.companies.map((company) => [company.name.trim().toLowerCase(), company])),
    [workspace.companies],
  );
  const shortlistCompanyRows = React.useMemo(() => {
    const rows = new Map<string, ProductCompanyDeskRow>();

    for (const row of customerInsightRows) {
      const baseCompany = row.companyId
        ? workspaceCompanyById.get(row.companyId)
        : workspaceCompanyByName.get(row.customerName.trim().toLowerCase());
      const key = row.companyId ?? baseCompany?.id ?? row.customerName.trim().toLowerCase();
      const existing = rows.get(key) ?? {
        id: baseCompany?.id ?? row.companyId ?? key,
        name: row.customerName,
        marketer: row.assignedOwner !== "-" ? row.assignedOwner : baseCompany?.assignedTo || "-",
        marketerId: row.assignedOwnerId ?? baseCompany?.assignedToId ?? undefined,
        stage: row.stage,
        communications: 0,
        followUps: 0,
        quotations: 0,
        lastContact: row.lastContactDisplay,
        nextFollowUp: row.nextFollowUpDisplay,
        city: baseCompany?.cityOrZilla ?? "-",
        phone: baseCompany?.phone ?? "-",
      };

      existing.communications += row.communicationCount;
      existing.followUps += row.followUpCount;
      existing.quotations += row.quotationCount;
      if (existing.stage === "-" || existing.stage === "Interested") {
        existing.stage = row.stage;
      }
      if (existing.lastContact === "-" || row.lastContactDisplay !== "-") {
        existing.lastContact = row.lastContactDisplay;
      }
      if (existing.nextFollowUp === "-" || row.nextFollowUpDisplay !== "-") {
        existing.nextFollowUp = row.nextFollowUpDisplay;
      }
      rows.set(key, existing);
    }

    return Array.from(rows.values()).sort((left, right) => right.communications - left.communications || left.name.localeCompare(right.name));
  }, [customerInsightRows, workspaceCompanyById, workspaceCompanyByName]);
  const shortlistedIds = new Set(shortlistCompanyRows.map((row) => row.id));
  const restCompanyRows = React.useMemo(
    () => workspace.companies
      .filter((company) => !shortlistedIds.has(company.id))
      .map((company) => ({
        id: company.id,
        name: company.name,
        marketer: company.assignedTo || "-",
        marketerId: company.assignedToId ?? undefined,
        stage: "Not Contacted Yet",
        communications: 0,
        followUps: 0,
        quotations: 0,
        lastContact: company.lastCommunication || "-",
        nextFollowUp: "-",
        city: company.cityOrZilla,
        phone: company.phone,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    [shortlistedIds, workspace.companies],
  );
  const totalCompanyRows = React.useMemo(() => [...shortlistCompanyRows, ...restCompanyRows], [restCompanyRows, shortlistCompanyRows]);
  const contactedCompanyRows = React.useMemo(() => shortlistCompanyRows.filter((row) => row.communications > 0), [shortlistCompanyRows]);
  const notContactedCompanyRows = React.useMemo(() => shortlistCompanyRows.filter((row) => row.communications === 0), [shortlistCompanyRows]);
  const bucketedCompanyRows = selectedCompanyBucket === "total"
    ? totalCompanyRows
    : selectedCompanyBucket === "contacted"
      ? contactedCompanyRows
      : selectedCompanyBucket === "not-contacted"
        ? notContactedCompanyRows
        : selectedCompanyBucket === "rest"
          ? restCompanyRows
          : shortlistCompanyRows;
  const selectedCompanyRows = React.useMemo(
    () => totalCompanyRows.filter((row) => selectedCompanyIds.includes(row.id)),
    [selectedCompanyIds, totalCompanyRows],
  );
  const totalCompaniesCount = workspace.companies.length;
  const shortlistedCount = engagement.summary.totalShortlistedCompanies || shortlistCompanyRows.length;
  const contactedCount = engagement.summary.contactedCompanies || contactedCompanyRows.length;
  const notContactedCount = engagement.summary.notContactedCompanies || notContactedCompanyRows.length;
  const restCount = Math.max(totalCompaniesCount - shortlistedCount, 0);
  const productCommandTitle = role === "MARKETER" ? "Your product activity summary" : "Product activity summary";
  const productCommandDescription =
    role === "MARKETER"
      ? "See your companies, latest calls, follow-ups, and current stages for this product in one clean view."
      : "See which marketer is working on this product, how many calls and follow-ups happened, and which stage each company is in.";
  const assignmentCardTitle = role === "MARKETER" ? "Your visible ownership" : "Who is handling this product";
  const openCompanyDeskPage = React.useCallback((bucket: ProductCompanyBucket) => {
    router.push(buildProductCompanyDeskPath(active.id, { bucket }));
  }, [active.id, router]);

  const openSelectedCompanyDeskPage = React.useCallback(() => {
    router.push(buildProductCompanyDeskPath(active.id, { bucket: selectedCompanyBucket }));
  }, [active.id, router, selectedCompanyBucket]);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  React.useEffect(() => {
    setSelectedCompanyIds((current) => {
      const next = current.filter((id) => bucketedCompanyRows.some((row) => row.id === id));
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [bucketedCompanyRows]);

  React.useEffect(() => {
    if (!assignModalOpen) return;
    setAssignMarketerId((current) => current || marketerOptions[0]?.id || "");
    setAssignMessage("");
  }, [assignModalOpen, marketerOptions]);

  const handleAssignSelectedCompanies = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignMarketerId) {
      setAssignMessage("Select a marketer first.");
      return;
    }
    if (!selectedCompanyIds.length) {
      setAssignMessage("Select at least one company.");
      return;
    }

    const formData = new FormData();
    formData.set("productId", active.id);
    formData.set("assignedToId", assignMarketerId);
    formData.set("companyIdsJson", JSON.stringify(selectedCompanyIds));

    startAssign(async () => {
      try {
        const result = await assignProductCompaniesAction(formData);
        if (typeof result === "object" && result && "ok" in result && result.ok === false) {
          const message = "message" in result && typeof result.message === "string" ? result.message : "Assignment failed.";
          setAssignMessage(message);
          return;
        }

        const successMessage =
          typeof result === "object" && result && "message" in result && typeof result.message === "string"
            ? result.message
            : "Selected companies have been assigned.";
        setFeedback({ type: "success", message: successMessage });
        setAssignModalOpen(false);
        setAssignMessage("");
        setSelectedCompanyIds([]);
        router.refresh();
      } catch (error) {
        setAssignMessage(error instanceof Error ? error.message : "Assignment failed.");
      }
    });
  }, [active.id, assignMarketerId, router, selectedCompanyIds]);

  return (
    <div className="space-y-5">
      <FloatingFeedback feedback={feedback} />
      <Link href={rolePath(role, "products")} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back to products
      </Link>
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="p-5">
            <ProductVisual product={active} />
            <div className="mt-5 space-y-4">
              <div>
                <h1 className="text-2xl font-black text-slate-950">{active.name}</h1>
                <p className="mt-1 text-sm text-slate-500">{active.category || "Product"} / {active.brand || "No brand"}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Price & Positioning</p>
                <p className="mt-3 text-2xl font-black text-blue-700">{formatCurrency(active.price)}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{descriptionText}</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Specification</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{specificationText}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Sales Snapshot</p>
                    <p className="mt-2 text-lg font-black text-slate-950">{engagement.summary.quotationSentCount} Quotations / {engagement.summary.salesCount} Sales</p>
                    <p className="mt-1 text-sm text-slate-500">Actual quotation and converted sale count from CRM records.</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Average Probability</p>
                    <p className="mt-2 text-lg font-black text-slate-950">{averageProbability}%</p>
                    <p className="mt-1 text-sm text-slate-500">{averageProbability ? "Based on linked lead pipeline probability." : "No lead probability saved yet."}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Assigned Team</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">{assignmentCardTitle}</h2>
              </div>
              <Badge variant="neutral">{assignedTeam.length} marketers</Badge>
            </div>
            <div className="mt-4 space-y-3">
              {assignedTeam.length ? assignedTeam.map((member) => (
                <div key={member.name} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" className="text-left font-black text-blue-700 transition hover:text-blue-800 hover:underline" onClick={() => setSelectedMarketerName(member.name)}>
                      {member.name}
                    </button>
                    <Badge variant="default">{member.customerCount} customers</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                    <span>{member.leadCount} leads</span>
                    <span>{member.communicationCount} communications</span>
                    <span>{member.followUpCount} follow-ups</span>
                    <span>{member.demoCount} demo activity</span>
                    <span>{member.quotationCount} quotations</span>
                  </div>
                </div>
              )) : (
                <p className="text-sm font-semibold text-slate-500">No marketer or supervisor has been linked to this product yet.</p>
              )}
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card className="overflow-hidden border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">Product Activity</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{productCommandTitle}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{productCommandDescription}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">{active.category || "Product"}</Badge>
                {active.brand && active.brand !== "-" ? <Badge variant="neutral">{active.brand}</Badge> : null}
                <Badge variant={active.status === "Active" ? "success" : "neutral"}>{active.status}</Badge>
                <Badge variant={engagement.summary.conversionRate > 0 ? "success" : "warning"}>{engagement.summary.conversionRate}% conversion</Badge>
              </div>
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              { key: "total" as const, title: "Total Companies", value: totalCompaniesCount, helper: "All visible companies", tone: "bg-slate-100 text-slate-700" },
              { key: "shortlist" as const, title: "Shortlist", value: shortlistedCount, helper: "Already linked to this product", tone: "bg-blue-100 text-blue-700" },
              { key: "contacted" as const, title: "Contacted", value: contactedCount, helper: "At least one communication done", tone: "bg-emerald-100 text-emerald-700" },
              { key: "not-contacted" as const, title: "Not Contacted Yet", value: notContactedCount, helper: "Shortlisted but no communication", tone: "bg-amber-100 text-amber-700" },
              { key: "rest" as const, title: "Rest Companies", value: restCount, helper: "Available to assign for this product", tone: "bg-violet-100 text-violet-700" },
            ].map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => openCompanyDeskPage(card.key)}
                className={cn(
                  "rounded-[22px] border p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_30px_rgba(37,99,235,0.10)]",
                  selectedCompanyBucket === card.key ? "border-blue-300 bg-blue-50/70" : "border-slate-200 bg-white",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{card.title}</p>
                    <p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{card.helper}</p>
                  </div>
                  <div className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl", card.tone)}>
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Assigned Marketers" value={String(assignedTeam.length)} helper={assignedTeam[0] ? `${assignedTeam[0].name} currently leading` : "No owner assigned yet"} icon={UserPlus} tone="bg-emerald-100 text-emerald-700" />
            <StatCard title="Phone Calls" value={String(engagement.summary.totalCallCount)} helper="Call activity count" icon={PhoneCall} tone="bg-indigo-100 text-indigo-700" />
            <StatCard title="WhatsApp / Email" value={String(engagement.summary.totalWhatsAppCount + engagement.summary.totalEmailCount)} helper={`${engagement.summary.totalWhatsAppCount} WhatsApp, ${engagement.summary.totalEmailCount} Email`} icon={MessageSquare} tone="bg-cyan-100 text-cyan-700" />
            <StatCard title="Meetings / Follow-ups" value={String(engagement.summary.totalMeetingCount + engagement.summary.followUpCount)} helper={`${engagement.summary.totalMeetingCount} meetings, ${engagement.summary.followUpCount} open follow-ups`} icon={CalendarClock} tone="bg-amber-100 text-amber-700" />
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <DashboardCard title="Company Desk">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_COMPANY_BUCKET_OPTIONS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSelectedCompanyBucket(item.key)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition",
                          selectedCompanyBucket === item.key
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {role !== "MARKETER" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{selectedCompanyIds.length} selected</Badge>
                      <Button type="button" size="sm" variant="outline" onClick={() => setCreateCompanyOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Add Company
                      </Button>
                      <Button type="button" size="sm" onClick={() => setAssignModalOpen(true)} disabled={!selectedCompanyIds.length || !marketerOptions.length}>
                        <UserPlus className="h-4 w-4" />
                        Assign Selected
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={openSelectedCompanyDeskPage}>
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  Product-wise company list, current contact stage, and remaining companies are shown here first.
                </p>
                {role !== "MARKETER" ? (
                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={openSelectedCompanyDeskPage}>
                      <Eye className="h-4 w-4" />
                      Open Detailed List
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-3">
                {bucketedCompanyRows.length ? bucketedCompanyRows.map((row) => {
                  const hasCustomerRecord = workspaceCompanyById.has(row.id);

                  return (
                    <div key={`company-desk-${row.id}`} className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {role !== "MARKETER" && hasCustomerRecord ? (
                            <input
                              type="checkbox"
                              checked={selectedCompanyIds.includes(row.id)}
                              onChange={(event) => setSelectedCompanyIds((current) => event.target.checked ? Array.from(new Set([...current, row.id])) : current.filter((item) => item !== row.id))}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              aria-label={`Select ${row.name}`}
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-950">
                              <EntityLink href={hasCustomerRecord ? `/customers/${row.id}` : undefined} className="font-black">{row.name}</EntityLink>
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{row.city} / {row.phone}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {row.stage ? <Badge variant={productStageBadgeVariant(row.stage)}>{row.stage}</Badge> : null}
                          {row.marketer !== "-" ? <Badge variant="neutral">{row.marketer}</Badge> : null}
                          {!hasCustomerRecord ? <Badge variant="warning">Lead Only</Badge> : null}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
                        <span>Calls / touches: {row.communications}</span>
                        <span>Follow-ups: {row.followUps}</span>
                        <span>Quotations: {row.quotations}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                        <span>Last contact: {row.lastContact}</span>
                        {row.nextFollowUp !== "-" ? <span>Next follow-up: {row.nextFollowUp}</span> : null}
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-sm font-semibold text-slate-500">No company record matched this bucket yet.</p>
                )}
              </div>
            </DashboardCard>
            <div className="space-y-5">
              <DashboardCard title="Latest Product Conversations">
                <div className="space-y-3">
                  {visibleCustomerRows.length ? visibleCustomerRows.map((row) => (
                    <div key={`customer-activity-${row.id}`} className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950">
                            <EntityLink href={row.companyId ? `/customers/${row.companyId}` : undefined} className="font-black">{row.customerName}</EntityLink>
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {row.leadId ? <EntityLink href={`/leads/${row.leadId}`} className="font-semibold">{row.leadDisplayName}</EntityLink> : row.leadDisplayName}
                          </p>
                        </div>
                        <Badge variant={productStageBadgeVariant(row.stage)}>{row.stage}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
                        <span>
                          Marketer:{" "}
                          {row.assignedOwner !== "-" ? (
                            <button type="button" className="text-blue-700 transition hover:text-blue-800 hover:underline" onClick={() => setSelectedMarketerName(row.assignedOwner)}>
                              {row.assignedOwner}
                            </button>
                          ) : (
                            "Unassigned"
                          )}
                        </span>
                        <span>Calls: {row.communicationCount}</span>
                        <span>Follow-ups: {row.followUpCount}</span>
                        <span>Quotations: {row.quotationCount}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{row.summary !== "-" ? row.summary : "No discussion note saved yet."}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                        <span>Last contact: {row.lastContactDisplay}</span>
                        {row.nextFollowUpDisplay !== "-" ? <span>Next follow-up: {row.nextFollowUpDisplay}</span> : null}
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm font-semibold text-slate-500">No customer activity has been saved for this product yet.</p>
                  )}
                </div>
              </DashboardCard>
              <DashboardCard title="Stage Overview">
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-blue-100 bg-blue-50/70 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Current picture</p>
                    <p className="mt-2 text-lg font-black text-slate-950">{stageSummary.length ? `${stageSummary[0]?.name} has the most activity` : "No stage activity yet"}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {stageSummary.length ? `${stageSummary[0]?.leads ?? 0} company records are currently in this stage.` : "Once calls or follow-ups are saved, the stage summary will appear here."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stageSummary.length ? stageSummary.map((stage) => (
                      <div key={stage.name} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                        <Badge variant={productStageBadgeVariant(stage.name)}>{stage.name}</Badge>
                        <span>{stage.leads}</span>
                      </div>
                    )) : (
                      <p className="text-sm font-semibold text-slate-500">No stage distribution available yet.</p>
                    )}
                  </div>
                </div>
              </DashboardCard>
              <DashboardCard title="Recent Updates">
                <div className="space-y-3">
                  {recentConversations.length ? recentConversations.map((row) => (
                    <div key={`conversation-${row.id}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950">
                            <EntityLink href={row.companyId ? `/customers/${row.companyId}` : undefined} className="font-black">{row.customerName}</EntityLink>
                          </p>
                          <p className="text-xs font-semibold text-slate-500">
                            {row.assignedOwner !== "-" ? (
                              <button type="button" className="text-blue-700 transition hover:text-blue-800 hover:underline" onClick={() => setSelectedMarketerName(row.assignedOwner)}>
                                {row.assignedOwner}
                              </button>
                            ) : (
                              "No marketer assigned"
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge value={row.communicationType} />
                          <Badge variant={productStageBadgeVariant(row.stage)}>{row.stage}</Badge>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{row.summary !== "-" ? row.summary : "No discussion summary recorded yet."}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                        <span>{row.lastContactDisplay}</span>
                        <span>Calls: {row.communicationCount}</span>
                        <span>Follow-ups: {row.followUpCount}</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm font-semibold text-slate-500">No recent updates are available for this product yet.</p>
                  )}
                </div>
              </DashboardCard>
            </div>
          </div>
          <FormModal
            open={createCompanyOpen}
            onClose={() => setCreateCompanyOpen(false)}
            title="Add Company For This Product"
            panelClassName="max-w-3xl"
          >
            <CustomerForm
              workspace={workspace}
              productId={active.id}
              submitLabel="Save Company"
              onDone={() => {
                setCreateCompanyOpen(false);
                router.refresh();
              }}
            />
          </FormModal>
          <FormModal
            open={assignModalOpen}
            onClose={() => {
              setAssignModalOpen(false);
              setAssignMessage("");
            }}
            title="Assign Product Contact Companies"
            panelClassName="max-w-[640px]"
          >
            <form className="space-y-4" onSubmit={handleAssignSelectedCompanies}>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Product</p>
                <p className="mt-2 text-lg font-black text-slate-950">{active.name}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedCompanyRows.length} selected compan{selectedCompanyRows.length === 1 ? "y" : "ies"} will be linked to this product and assigned for contact.
                </p>
                {selectedCompanyRows.length ? (
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {selectedCompanyRows.slice(0, 4).map((row) => row.name).join(", ")}
                    {selectedCompanyRows.length > 4 ? ` +${selectedCompanyRows.length - 4} more` : ""}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500" htmlFor="assign-product-marketer">
                  Marketer
                </label>
                <select
                  id="assign-product-marketer"
                  value={assignMarketerId}
                  onChange={(event) => setAssignMarketerId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Select marketer</option>
                  {marketerOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name}</option>
                  ))}
                </select>
              </div>
              {assignMessage ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  {assignMessage}
                </div>
              ) : null}
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setAssignModalOpen(false)} disabled={assignPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={assignPending || !selectedCompanyIds.length || !assignMarketerId}>
                  <UserPlus className="h-4 w-4" />
                  {assignPending ? "Assigning..." : "Assign Companies"}
                </Button>
              </div>
            </form>
          </FormModal>
          <FormModal
            open={Boolean(selectedMarketer)}
            onClose={() => setSelectedMarketerName(null)}
            title={selectedMarketer ? `${selectedMarketer.name} - Product Activity` : "Product Activity"}
            panelClassName="max-w-[860px]"
          >
            {selectedMarketer ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Companies</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{selectedMarketer.customerCount}</p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Calls</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{selectedMarketer.communicationCount}</p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Follow-ups</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{selectedMarketer.followUpCount}</p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Demo Activity</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{selectedMarketer.demoCount}</p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Quotations</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{selectedMarketer.quotations.length || selectedMarketer.quotationCount}</p>
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Handled Companies</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedMarketer.rows.length ? selectedMarketer.rows.map((row) => (
                      <div key={`${selectedMarketer.name}-${row.id}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                        <EntityLink href={row.companyId ? `/customers/${row.companyId}` : undefined} className="font-semibold">{row.customerName}</EntityLink>
                        <Badge variant={productStageBadgeVariant(row.stage)}>{row.stage}</Badge>
                      </div>
                    )) : <p className="text-sm font-semibold text-slate-500">No company has been assigned under this product yet.</p>}
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Latest Notes</p>
                      <p className="mt-1 text-sm text-slate-500">Notes, calls, and next steps for this marketer on this product.</p>
                    </div>
                    <Badge variant="neutral">{selectedMarketer.latestNotes.length} records</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedMarketer.latestNotes.length ? selectedMarketer.latestNotes.map((item) => (
                      <div key={`${selectedMarketer.name}-note-${item.id}`} className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-950">{item.companyName}</p>
                            <p className="text-xs font-semibold text-slate-500">{item.leadName}</p>
                          </div>
                          <Badge variant={productStageBadgeVariant(item.stage)}>{item.stage}</Badge>
                        </div>
                        {item.discussionTopic !== "-" ? <p className="mt-3 text-xs font-bold uppercase text-slate-500">Topic: <span className="normal-case text-slate-700">{item.discussionTopic}</span></p> : null}
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary !== "-" ? item.summary : "No saved note for this activity."}</p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                          <span>Last contact: {item.lastContact}</span>
                          <span>Calls: {item.calls}</span>
                          <span>Follow-ups: {item.followUps}</span>
                          {item.nextFollowUp !== "-" ? <span>Next follow-up: {item.nextFollowUp}</span> : null}
                        </div>
                      </div>
                    )) : <p className="text-sm font-semibold text-slate-500">No note or communication summary is available for this marketer on this product yet.</p>}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Follow-up Records</p>
                      <Badge variant="neutral">{selectedMarketer.followUps.length}</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedMarketer.followUps.slice(0, 5).length ? selectedMarketer.followUps.slice(0, 5).map((item) => (
                        <div key={`${selectedMarketer.name}-followup-${item.id}`} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-3">
                          <p className="font-semibold text-slate-900">{item.customer}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.note !== "-" ? item.note : item.nextDiscussionPlan}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                            <span>{item.method}</span>
                            <span>{item.status}</span>
                            <span>{item.followUpDate}</span>
                          </div>
                        </div>
                      )) : <p className="text-sm font-semibold text-slate-500">No follow-up record found for this marketer under this product.</p>}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Quotation Records</p>
                      <Badge variant="neutral">{selectedMarketer.quotations.length || selectedMarketer.quotationCount}</Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedMarketer.quotations.slice(0, 5).length ? selectedMarketer.quotations.slice(0, 5).map((item) => (
                        <div key={`${selectedMarketer.name}-quotation-${item.id}`} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-3">
                          <p className="font-semibold text-slate-900">{item.customer}</p>
                          <p className="mt-1 text-sm text-slate-600">{item.quoteNumber} / {item.product}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                            <span>{formatCurrency(item.amount)}</span>
                            <span>{item.status}</span>
                            <span>{item.date}</span>
                          </div>
                        </div>
                      )) : <p className="text-sm font-semibold text-slate-500">No quotation record found for this marketer under this product.</p>}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </FormModal>
        </div>
      </div>
    </div>
  );
}

export function ProductCompanyDeskPage({
  role,
  workspace,
  product,
  productEngagement,
  initialQuery,
}: {
  role: Role;
  workspace: CrmWorkspace;
  product?: ProductRow;
  productEngagement?: ProductEngagementData;
  initialQuery?: ProductCompanyDeskQuery;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = React.useState<UserFeedback>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = React.useState<string[]>([]);
  const [assignModalOpen, setAssignModalOpen] = React.useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = React.useState(false);
  const [assignMarketerId, setAssignMarketerId] = React.useState("");
  const [assignMessage, setAssignMessage] = React.useState("");
  const [assignPending, startAssign] = React.useTransition();
  const active = product;

  const initialBucket = normalizeProductCompanyBucket(initialQuery?.bucket);
  const [selectedCompanyBucket, setSelectedCompanyBucket] = React.useState<ProductCompanyBucket>(initialBucket);
  const [selectedAssignedUserId, setSelectedAssignedUserId] = React.useState(initialQuery?.assignedUserId ?? "all");
  const [searchValue, setSearchValue] = React.useState(initialQuery?.search ?? "");

  React.useEffect(() => {
    setSelectedCompanyBucket(normalizeProductCompanyBucket(initialQuery?.bucket));
    setSelectedAssignedUserId(initialQuery?.assignedUserId ?? "all");
    setSearchValue(initialQuery?.search ?? "");
  }, [initialQuery?.assignedUserId, initialQuery?.bucket, initialQuery?.search]);

  if (!active) return <EmptyState title="Product not found" description="The requested product is not available." />;

  const engagement = productEngagement ?? {
    summary: {
      totalCompaniesContacted: 0,
      totalLeadsInterested: 0,
      totalCommunicationCount: 0,
      totalShortlistedCompanies: 0,
      contactedCompanies: 0,
      notContactedCompanies: 0,
      totalCallCount: 0,
      totalWhatsAppCount: 0,
      totalEmailCount: 0,
      totalMeetingCount: 0,
      followUpCount: 0,
      quotationSentCount: 0,
      salesCount: 0,
      conversionRate: 0,
    },
    rows: [],
    filters: {},
    filterOptions: { communicationTypes: [], assignedUsers: [] },
  };

  const marketerOptions = React.useMemo(
    () => workspace.employees
      .filter((employee) => employee.roleKey === "MARKETER")
      .map((employee) => ({ id: employee.id, name: employee.name })),
    [workspace.employees],
  );
  const workspaceCompanyById = React.useMemo(() => new Map(workspace.companies.map((company) => [company.id, company])), [workspace.companies]);
  const workspaceCompanyByName = React.useMemo(
    () => new Map(workspace.companies.map((company) => [company.name.trim().toLowerCase(), company])),
    [workspace.companies],
  );
  const productLeads = workspace.leads.filter((lead) => matchesProductLead(active, lead));
  const productLeadMap = new Map(productLeads.map((lead) => [lead.id, lead]));
  const fallbackEngagementRows = productLeads
    .map((lead) => ({
      id: `fallback-${lead.id}`,
      companyId: lead.companyId ?? null,
      leadId: lead.id,
      companyName: lead.company || lead.customerName || "-",
      leadName: lead.title || "-",
      communicationType: "-",
      summary: lead.notes || "-",
      discussionTopic: active.name,
      nextFollowUpDate: lead.followUpDate || "-",
      lastContactDate: lead.createdAt || "-",
      status: lead.status || "Interested",
      assignedMarketer: lead.assignedTo || "-",
      communicationCount: lead.communicationCount,
      followUpCount: lead.followUpCount,
      quotationCount: 0,
      probability: lead.purchaseProbability,
    }))
    .sort((left, right) => right.communicationCount - left.communicationCount || right.probability - left.probability);

  const insightSourceRows = engagement.rows.length ? engagement.rows : fallbackEngagementRows;
  const customerInsightRows = insightSourceRows.map((row) => {
    const relatedLead =
      (row.leadId ? productLeadMap.get(row.leadId) : undefined) ??
      productLeads.find((lead) => {
        if (row.companyId && lead.companyId === row.companyId) return true;
        return row.companyName !== "-" && row.companyName === lead.company;
      });

    return {
      ...row,
      customerName: row.companyName !== "-" ? row.companyName : relatedLead?.company || relatedLead?.customerName || "-",
      leadDisplayName: row.leadName !== "-" ? row.leadName : relatedLead?.title || "-",
      stage: row.status !== "-" ? row.status : relatedLead?.status || "Interested",
      assignedOwner: row.assignedMarketer !== "-" ? row.assignedMarketer : relatedLead?.assignedTo || "-",
      assignedOwnerId: relatedLead?.assignedToId ?? undefined,
      nextFollowUpDisplay: row.nextFollowUpDate !== "-" ? row.nextFollowUpDate : relatedLead?.followUpDate || "-",
      lastContactDisplay: row.lastContactDate !== "-" ? row.lastContactDate : relatedLead?.createdAt || "-",
    };
  });

  const shortlistCompanyRows = React.useMemo(() => {
    const rows = new Map<string, ProductCompanyDeskRow>();

    for (const row of customerInsightRows) {
      const baseCompany = row.companyId
        ? workspaceCompanyById.get(row.companyId)
        : workspaceCompanyByName.get(row.customerName.trim().toLowerCase());
      const key = row.companyId ?? baseCompany?.id ?? row.customerName.trim().toLowerCase();
      const existing = rows.get(key) ?? {
        id: baseCompany?.id ?? row.companyId ?? key,
        name: row.customerName,
        marketer: row.assignedOwner !== "-" ? row.assignedOwner : baseCompany?.assignedTo || "-",
        marketerId: row.assignedOwnerId ?? baseCompany?.assignedToId ?? undefined,
        stage: row.stage,
        communications: 0,
        followUps: 0,
        quotations: 0,
        lastContact: row.lastContactDisplay,
        nextFollowUp: row.nextFollowUpDisplay,
        city: baseCompany?.cityOrZilla ?? "-",
        phone: baseCompany?.phone ?? "-",
      };

      existing.communications += row.communicationCount;
      existing.followUps += row.followUpCount;
      existing.quotations += row.quotationCount;
      if (existing.stage === "-" || existing.stage === "Interested") existing.stage = row.stage;
      if (existing.lastContact === "-" || row.lastContactDisplay !== "-") existing.lastContact = row.lastContactDisplay;
      if (existing.nextFollowUp === "-" || row.nextFollowUpDisplay !== "-") existing.nextFollowUp = row.nextFollowUpDisplay;
      rows.set(key, existing);
    }

    return Array.from(rows.values()).sort((left, right) => right.communications - left.communications || left.name.localeCompare(right.name));
  }, [customerInsightRows, workspaceCompanyById, workspaceCompanyByName]);

  const shortlistedIds = new Set(shortlistCompanyRows.map((row) => row.id));
  const restCompanyRows = React.useMemo(
    () => workspace.companies
      .filter((company) => !shortlistedIds.has(company.id))
      .map((company) => ({
        id: company.id,
        name: company.name,
        marketer: company.assignedTo || "-",
        marketerId: company.assignedToId ?? undefined,
        stage: "Not Contacted Yet",
        communications: 0,
        followUps: 0,
        quotations: 0,
        lastContact: company.lastCommunication || "-",
        nextFollowUp: "-",
        city: company.cityOrZilla,
        phone: company.phone,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    [shortlistedIds, workspace.companies],
  );

  const filterByMarketer = React.useCallback((rows: ProductCompanyDeskRow[]) => {
    if (selectedAssignedUserId === "all") return rows;
    return rows.filter((row) => row.marketerId === selectedAssignedUserId);
  }, [selectedAssignedUserId]);

  const scopedShortlistRows = React.useMemo(() => filterByMarketer(shortlistCompanyRows), [filterByMarketer, shortlistCompanyRows]);
  const scopedContactedRows = React.useMemo(() => scopedShortlistRows.filter((row) => row.communications > 0), [scopedShortlistRows]);
  const scopedNotContactedRows = React.useMemo(() => scopedShortlistRows.filter((row) => row.communications === 0), [scopedShortlistRows]);
  const scopedRestRows = React.useMemo(() => filterByMarketer(restCompanyRows), [filterByMarketer, restCompanyRows]);
  const scopedTotalRows = React.useMemo(() => [...scopedShortlistRows, ...scopedRestRows], [scopedRestRows, scopedShortlistRows]);

  const bucketedCompanyRows = selectedCompanyBucket === "total"
    ? scopedTotalRows
    : selectedCompanyBucket === "contacted"
      ? scopedContactedRows
      : selectedCompanyBucket === "not-contacted"
        ? scopedNotContactedRows
        : selectedCompanyBucket === "rest"
          ? scopedRestRows
          : scopedShortlistRows;

  const visibleRows = React.useMemo(
    () => bucketedCompanyRows.filter((row) => matchesProductCompanyDeskSearch(row, searchValue)),
    [bucketedCompanyRows, searchValue],
  );

  const selectedCompanyRows = React.useMemo(
    () => scopedTotalRows.filter((row) => selectedCompanyIds.includes(row.id)),
    [scopedTotalRows, selectedCompanyIds],
  );

  React.useEffect(() => {
    setSelectedCompanyIds((current) => current.filter((id) => bucketedCompanyRows.some((row) => row.id === id)));
  }, [bucketedCompanyRows]);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 4500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  React.useEffect(() => {
    if (!assignModalOpen) return;
    setAssignMarketerId((current) => current || marketerOptions[0]?.id || "");
    setAssignMessage("");
  }, [assignModalOpen, marketerOptions]);

  const pushFilters = React.useCallback((next: ProductCompanyDeskQuery) => {
    router.push(buildProductCompanyDeskPath(active.id, next));
  }, [active.id, router]);

  const handleBucketChange = React.useCallback((bucket: ProductCompanyBucket) => {
    setSelectedCompanyBucket(bucket);
    pushFilters({ bucket, assignedUserId: selectedAssignedUserId === "all" ? undefined : selectedAssignedUserId, search: searchValue });
  }, [pushFilters, searchValue, selectedAssignedUserId]);

  const handleMarketerChange = React.useCallback((assignedUserId: string) => {
    setSelectedAssignedUserId(assignedUserId);
    pushFilters({ bucket: selectedCompanyBucket, assignedUserId: assignedUserId === "all" ? undefined : assignedUserId, search: searchValue });
  }, [pushFilters, searchValue, selectedCompanyBucket]);

  const handleSearchSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushFilters({ bucket: selectedCompanyBucket, assignedUserId: selectedAssignedUserId === "all" ? undefined : selectedAssignedUserId, search: searchValue });
  }, [pushFilters, searchValue, selectedAssignedUserId, selectedCompanyBucket]);

  const handleResetFilters = React.useCallback(() => {
    setSelectedCompanyBucket("shortlist");
    setSelectedAssignedUserId("all");
    setSearchValue("");
    pushFilters({ bucket: "shortlist" });
  }, [pushFilters]);

  const handleAssignSelectedCompanies = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!assignMarketerId) {
      setAssignMessage("Select a marketer first.");
      return;
    }
    if (!selectedCompanyIds.length) {
      setAssignMessage("Select at least one company.");
      return;
    }

    const formData = new FormData();
    formData.set("productId", active.id);
    formData.set("assignedToId", assignMarketerId);
    formData.set("companyIdsJson", JSON.stringify(selectedCompanyIds));

    startAssign(async () => {
      try {
        const result = await assignProductCompaniesAction(formData);
        if (typeof result === "object" && result && "ok" in result && result.ok === false) {
          const message = "message" in result && typeof result.message === "string" ? result.message : "Assignment failed.";
          setAssignMessage(message);
          return;
        }

        const successMessage =
          typeof result === "object" && result && "message" in result && typeof result.message === "string"
            ? result.message
            : "Selected companies have been assigned.";
        setFeedback({ type: "success", message: successMessage });
        setAssignModalOpen(false);
        setAssignMessage("");
        setSelectedCompanyIds([]);
        router.refresh();
      } catch (error) {
        setAssignMessage(error instanceof Error ? error.message : "Assignment failed.");
      }
    });
  }, [active.id, assignMarketerId, router, selectedCompanyIds]);

  return (
    <div className="space-y-5">
      <FloatingFeedback feedback={feedback} />
      <Link href={`/products/${active.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back to product overview
      </Link>

      <Card className="overflow-hidden border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/60 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">Product Company Desk</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{active.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Shortlist, contacted, not contacted, and remaining companies are shown here with marketer-wise filtering.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{active.category || "Product"}</Badge>
            <Badge variant={active.status === "Active" ? "success" : "neutral"}>{active.status}</Badge>
            <Badge variant="neutral">{visibleRows.length} visible</Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { key: "total" as const, title: "Total Companies", value: scopedTotalRows.length, helper: "Visible after marketer filter", tone: "bg-slate-100 text-slate-700" },
          { key: "shortlist" as const, title: "Shortlist", value: scopedShortlistRows.length, helper: "Linked with this product", tone: "bg-blue-100 text-blue-700" },
          { key: "contacted" as const, title: "Contacted", value: scopedContactedRows.length, helper: "At least one communication done", tone: "bg-emerald-100 text-emerald-700" },
          { key: "not-contacted" as const, title: "Not Contacted Yet", value: scopedNotContactedRows.length, helper: "Assigned but untouched", tone: "bg-amber-100 text-amber-700" },
          { key: "rest" as const, title: "Rest Companies", value: scopedRestRows.length, helper: "Not yet linked to this product", tone: "bg-violet-100 text-violet-700" },
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => handleBucketChange(card.key)}
            className={cn(
              "rounded-[22px] border p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_14px_30px_rgba(37,99,235,0.10)]",
              selectedCompanyBucket === card.key ? "border-blue-300 bg-blue-50/70" : "border-slate-200 bg-white",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{card.title}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{card.value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{card.helper}</p>
              </div>
              <div className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl", card.tone)}>
                <Building2 className="h-5 w-5" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Company Details</h2>
              <p className="text-sm text-slate-500">Filter by marketer, search by company, and review who still has pending contact work.</p>
            </div>
            {role !== "MARKETER" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">{selectedCompanyIds.length} selected</Badge>
                <Button type="button" size="sm" variant="outline" onClick={() => setCreateCompanyOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Company
                </Button>
                <Button type="button" size="sm" onClick={() => setAssignModalOpen(true)} disabled={!selectedCompanyIds.length || !marketerOptions.length}>
                  <UserPlus className="h-4 w-4" />
                  Assign Selected
                </Button>
              </div>
            ) : null}
          </div>

          <form className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_220px_auto] xl:grid-cols-[minmax(0,1.6fr)_260px_auto_auto]" onSubmit={handleSearchSubmit}>
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search company, phone, city, marketer..."
              className="h-10"
            />
            {role !== "MARKETER" ? (
              <select
                value={selectedAssignedUserId}
                onChange={(event) => handleMarketerChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">All marketers</option>
                {marketerOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            ) : null}
            <Button type="submit" size="sm">
              <Search className="h-4 w-4" />
              Apply
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleResetFilters}>
              Reset
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {PRODUCT_COMPANY_BUCKET_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleBucketChange(item.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition",
                  selectedCompanyBucket === item.key
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="text-sm text-slate-500">
            Showing <span className="font-bold text-slate-700">{visibleRows.length}</span> compan{visibleRows.length === 1 ? "y" : "ies"} in <span className="font-bold text-slate-700">{PRODUCT_COMPANY_BUCKET_OPTIONS.find((item) => item.key === selectedCompanyBucket)?.label ?? "Shortlist"}</span>.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {visibleRows.length ? visibleRows.map((row) => {
            const hasCustomerRecord = workspaceCompanyById.has(row.id);

            return (
              <div key={`product-company-detail-${row.id}`} className="rounded-[22px] border border-slate-200 bg-slate-50/85 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {role !== "MARKETER" && hasCustomerRecord ? (
                      <input
                        type="checkbox"
                        checked={selectedCompanyIds.includes(row.id)}
                        onChange={(event) => setSelectedCompanyIds((current) => event.target.checked ? Array.from(new Set([...current, row.id])) : current.filter((item) => item !== row.id))}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        aria-label={`Select ${row.name}`}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">
                        <EntityLink href={hasCustomerRecord ? `/customers/${row.id}` : undefined} className="font-black">{row.name}</EntityLink>
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{row.city} / {row.phone}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.stage ? <Badge variant={productStageBadgeVariant(row.stage)}>{row.stage}</Badge> : null}
                    {row.marketer !== "-" ? <Badge variant="neutral">{row.marketer}</Badge> : null}
                    {!hasCustomerRecord ? <Badge variant="warning">Lead Only</Badge> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
                  <span>Calls / touches: {row.communications}</span>
                  <span>Follow-ups: {row.followUps}</span>
                  <span>Quotations: {row.quotations}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                  <span>Last contact: {row.lastContact}</span>
                  {row.nextFollowUp !== "-" ? <span>Next follow-up: {row.nextFollowUp}</span> : null}
                </div>
              </div>
            );
          }) : (
            <p className="text-sm font-semibold text-slate-500">No company record matched this filter yet.</p>
          )}
        </div>
      </Card>

      <FormModal
        open={createCompanyOpen}
        onClose={() => setCreateCompanyOpen(false)}
        title="Add Company For This Product"
        panelClassName="max-w-3xl"
      >
        <CustomerForm
          workspace={workspace}
          productId={active.id}
          submitLabel="Save Company"
          onDone={() => {
            setCreateCompanyOpen(false);
            router.refresh();
          }}
        />
      </FormModal>

      <FormModal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setAssignMessage("");
        }}
        title="Assign Product Contact Companies"
        panelClassName="max-w-[640px]"
      >
        <form className="space-y-4" onSubmit={handleAssignSelectedCompanies}>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Product</p>
            <p className="mt-2 text-lg font-black text-slate-950">{active.name}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {selectedCompanyRows.length} selected compan{selectedCompanyRows.length === 1 ? "y" : "ies"} will be linked to this product and assigned for contact.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500" htmlFor="assign-product-detail-marketer">
              Marketer
            </label>
            <select
              id="assign-product-detail-marketer"
              value={assignMarketerId}
              onChange={(event) => setAssignMarketerId(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select marketer</option>
              {marketerOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </div>
          {assignMessage ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{assignMessage}</div> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setAssignModalOpen(false)} disabled={assignPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={assignPending || !selectedCompanyIds.length || !assignMarketerId}>
              <UserPlus className="h-4 w-4" />
              {assignPending ? "Assigning..." : "Assign Companies"}
            </Button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}

export function QuotationsPage({ workspace }: { workspace: CrmWorkspace }) {
  const columns = React.useMemo<ColumnDef<QuotationRow>[]>(
    () => [
      { accessorKey: "quoteNumber", header: "Quotation ID", cell: ({ row }) => <span className="font-mono font-black text-blue-700">{row.original.quoteNumber}</span> },
      { accessorKey: "customer", header: "Customer", cell: ({ row }) => <EntityLink href={row.original.companyId ? `/customers/${row.original.companyId}` : row.original.leadId ? `/leads/${row.original.leadId}` : undefined} className="font-semibold">{row.original.customer}</EntityLink> },
      { accessorKey: "product", header: "Product / Service" },
      { accessorKey: "amount", header: "Amount", cell: ({ row }) => formatCurrency(row.original.amount) },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      { accessorKey: "createdBy", header: "Created By" },
      { accessorKey: "date", header: "Date" },
      { id: "Action", header: "Action", cell: ({ row }) => <RowActions detailHref={`/quotations/${row.original.id}`} /> },
    ],
    [],
  );

  return (
    <>
      <PageHeader title="Quotations" description="Create and manage quotation workflow from draft to sale conversion." actions={pageActions([{ label: "Create Quotation", icon: Plus, variant: "default" }])} />
      <DataTable data={workspace.quotations} columns={columns} searchPlaceholder="Search quotations..." />
    </>
  );
}

export function QuotationDetailsPage({ role, quotation }: { role: Role; quotation?: QuotationRow }) {
  const active = quotation;
  if (!active) return <EmptyState title="Quotation not found" description="The requested quotation is not available." />;

  return (
    <>
      <Link href={rolePath(role, "quotations")} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
        <ArrowLeft className="h-4 w-4" />
        Back to quotations
      </Link>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-100">Professional quotation preview</p>
              <h1 className="mt-2 text-3xl font-black">{active.quoteNumber}</h1>
              <p className="mt-1 text-blue-100">
                <EntityLink href={active.companyId ? `/customers/${active.companyId}` : active.leadId ? `/leads/${active.leadId}` : undefined} className="font-semibold text-white">{active.customer}</EntityLink>
              </p>
            </div>
            <StatusBadge value={active.status} />
          </div>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <InfoLine label="Customer" value={<EntityLink href={active.companyId ? `/customers/${active.companyId}` : active.leadId ? `/leads/${active.leadId}` : undefined} className="font-bold">{active.customer}</EntityLink>} />
            <InfoLine label="Created By" value={active.createdBy} />
            <InfoLine label="Date" value={active.date} />
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>{["Product / Service", "Quantity", "Amount"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
              </thead>
              <tbody><tr><td className="px-4 py-4 font-bold text-slate-900">{active.product}</td><td className="px-4 py-4">1</td><td className="px-4 py-4 font-black text-slate-950">{formatCurrency(active.amount)}</td></tr></tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {(["Generate PDF", "Send Email", "Mark as Sent", "Convert to Sale"] as const).map((label) => (
              <Button key={label} type="button" variant={label === "Convert to Sale" ? "default" : "outline"}>
                {label === "Send Email" ? <Send className="h-4 w-4" /> : label === "Generate PDF" ? <FileDown className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}

export function CommunicationPage({
  workspace,
  initialCustomerQuery = "",
  initialActivityQuery = "",
}: {
  workspace: CrmWorkspace;
  initialCustomerQuery?: string;
  initialActivityQuery?: string;
}) {
  const router = useRouter();
  const role = workspace.user.role;
  const isMarketerView = role === "MARKETER";
  const [open, setOpen] = React.useState(false);
  const [refreshPending, startRefresh] = React.useTransition();
  const [dateRange, setDateRange] = React.useState<CommunicationDateRange>("thisMonth");
  const [activityType, setActivityType] = React.useState<CommunicationActivityFilter>("ALL");
  const [employeeFilter, setEmployeeFilter] = React.useState("ALL");
  const [customerQuery, setCustomerQuery] = React.useState(initialCustomerQuery);
  const [activityQuery, setActivityQuery] = React.useState(initialActivityQuery);
  const [customStartDate, setCustomStartDate] = React.useState("");
  const [customEndDate, setCustomEndDate] = React.useState("");
  const [pageSize, setPageSize] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [expandedActivityId, setExpandedActivityId] = React.useState<string | null>(null);
  const deferredCustomerQuery = React.useDeferredValue(customerQuery);
  const deferredActivityQuery = React.useDeferredValue(activityQuery);
  const todayCallRows = React.useMemo(() => {
    const { from, to } = getCrmDayWindow(new Date());
    const fromTime = from.getTime();
    const toTime = to.getTime();

    return (workspace.callActivities ?? [])
      .filter((row) => {
        if (!row.createdAtValue) return false;
        const ts = new Date(row.createdAtValue).getTime();
        return Number.isFinite(ts) && ts >= fromTime && ts < toTime;
      })
      .sort((left, right) => new Date(right.createdAtValue ?? 0).getTime() - new Date(left.createdAtValue ?? 0).getTime());
  }, [workspace.callActivities]);
  const summaryCards = [
    {
      title: "Today's Calls",
      value: String(todayCallRows.length),
      subtitle: "Call activities today",
      tooltip: isMarketerView
        ? "Counts only your phone/call communication logs created today."
        : "Counts Communication logs (method contains phone/call) created today.",
      icon: Phone,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-600",
      accentColor: "bg-emerald-500",
    },
    {
      title: "Total Calls",
      value: String(workspace.communicationCenterSummary.totalCalls),
      subtitle: "Total call logs",
      tooltip: isMarketerView
        ? "Counts all of your Communication logs where the method contains phone/call."
        : "Counts all Communication logs (method contains phone/call) in your visible scope.",
      icon: PhoneCall,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
      valueColor: "text-slate-700",
      accentColor: "bg-slate-500",
    },
    {
      title: "Today's WhatsApp",
      value: String(workspace.communicationCenterSummary.todayWhatsApp),
      subtitle: "WhatsApp activities today",
      tooltip: "Counts Communication logs (method contains whatsapp) created today.",
      icon: MessageSquare,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      valueColor: "text-green-600",
      accentColor: "bg-green-500",
    },
    {
      title: "Today's Emails",
      value: String(workspace.communicationCenterSummary.todayEmails),
      subtitle: "Email activities today",
      tooltip: "Counts Communication logs (method contains email) created today.",
      icon: Mail,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      valueColor: "text-blue-600",
      accentColor: "bg-blue-500",
    },
    {
      title: "Today's Meetings",
      value: String(workspace.communicationCenterSummary.todayMeetings),
      subtitle: "Meeting activities today",
      tooltip: "Counts meetings from due tasks + follow-ups + today plans (keyword contains meeting).",
      icon: CalendarClock,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
      valueColor: "text-violet-600",
      accentColor: "bg-violet-500",
    },
    {
      title: "Follow-ups Pending",
      value: String(workspace.followUpSummary.actionable),
      subtitle: `Overdue ${workspace.followUpSummary.overdue} · Today ${workspace.followUpSummary.today} · Upcoming ${workspace.followUpSummary.upcoming}`,
      tooltip: "Pending follow-ups (not completed): Overdue + Today + Upcoming.",
      icon: Check,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      valueColor: "text-orange-600",
      accentColor: "bg-orange-500",
    },
  ] as const;
  const employeeOptions = React.useMemo(
    () => workspace.employees
      .map((employee) => ({ id: employee.id, name: employee.name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    [workspace.employees],
  );
  const filteredActivities = React.useMemo(() => {
    const customerNeedle = deferredCustomerQuery.trim().toLowerCase();
    const activityNeedle = deferredActivityQuery.trim().toLowerCase();

    return workspace.activities.filter((activity) => {
      if (!matchesCommunicationDateRange({
        createdAtValue: activity.createdAtValue,
        preset: dateRange,
        customStart: customStartDate,
        customEnd: customEndDate,
      })) {
        return false;
      }

      if (activityType !== "ALL" && activity.category !== activityType) {
        return false;
      }

      if (employeeFilter !== "ALL" && activity.employeeId !== employeeFilter) {
        return false;
      }

      if (customerNeedle) {
        const customerHaystack = [activity.customerName, activity.detail]
          .filter(hasActivityText)
          .join(" ")
          .toLowerCase();
        if (!customerHaystack.includes(customerNeedle)) {
          return false;
        }
      }

      if (!activityNeedle) {
        return true;
      }

      const activityHaystack = [
        activity.title,
        activity.detail,
        activity.discussionSummary,
        activity.notes,
        activity.rawAction,
        activity.contactMethod,
        activity.badgeLabel,
        activity.customerName,
        activity.employeeName,
      ]
        .filter(hasActivityText)
        .join(" ")
        .toLowerCase();

      return activityHaystack.includes(activityNeedle);
    });
  }, [
    workspace.activities,
    dateRange,
    customStartDate,
    customEndDate,
    activityType,
    employeeFilter,
    deferredCustomerQuery,
    deferredActivityQuery,
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedActivities = React.useMemo(
    () => filteredActivities.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredActivities, pageSize, safePage],
  );
  const pageNumbers = React.useMemo(() => {
    const start = Math.max(1, safePage - 2);
    const end = Math.min(totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }, [safePage, totalPages]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, activityType, employeeFilter, deferredCustomerQuery, deferredActivityQuery, customStartDate, customEndDate, pageSize]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    if (expandedActivityId && !pagedActivities.some((activity) => activity.id === expandedActivityId)) {
      setExpandedActivityId(null);
    }
  }, [expandedActivityId, pagedActivities]);

  const resetFilters = React.useCallback(() => {
    setDateRange("thisMonth");
    setActivityType("ALL");
    setEmployeeFilter("ALL");
    setCustomerQuery("");
    setActivityQuery("");
    setCustomStartDate("");
    setCustomEndDate("");
    setPageSize(25);
    setCurrentPage(1);
    setExpandedActivityId(null);
  }, []);

  return (
    <>
      <PageHeader
        title="Communication / Activity Log"
        description={isMarketerView ? "Track your exact communication and activity logs in real time." : "Track all communication and activities across your team in real time."}
        actions={pageActions([{ label: "Log Communication", icon: Plus, variant: "default", onClick: () => setOpen(true) }])}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => <CommunicationSummaryCard key={card.title} {...card} />)}
      </div>

      <Card className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Today's Calls (Exact)</h2>
            <p className="mt-1 text-sm text-slate-500">Today's phone call logs only.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {todayCallRows.length} {todayCallRows.length === 1 ? "call" : "calls"}
          </span>
        </div>

        <div className="mt-5">
          {todayCallRows.length ? (
            <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {todayCallRows.map((row) => (
                <div key={row.id} className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{row.badgeLabel ?? "CALL"}</p>
                      <p className="mt-1 min-w-0 truncate text-base font-black text-slate-950">
                        <EntityLink href={row.customerHref ?? row.href} className="text-slate-950" stopPropagation={false}>
                          {row.customerName ?? "-"}
                        </EntityLink>
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-600">
                        {row.employeeName && row.employeeName !== "-" ? `By ${row.employeeName}` : row.detail}
                      </p>
                    </div>
                    <div className="shrink-0 text-left text-xs font-bold text-slate-500 sm:text-right">
                      <p>{row.dateLabel ?? ""}</p>
                      <p className="mt-0.5 text-slate-700">{row.timeLabel ?? ""}</p>
                    </div>
                  </div>
                  {row.discussionSummary ? (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{row.discussionSummary}</p>
                  ) : null}
                  {row.nextFollowUpDate ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Next Follow-up</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{row.nextFollowUpDate}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <EmptyState title="No calls today" description="Today's call logs will show up here after you log communications." />
            </div>
          )}
        </div>
      </Card>

      <Card className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter Toolbar
            </div>
            <h2 className="mt-3 text-lg font-black text-slate-950">Refine activity feed</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isMarketerView
                ? "Filter your own activities by date, type, customer, and keywords."
                : "Filter role-scoped activities by date, type, employee, customer, and keywords."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>

        <div className={cn("mt-5 grid gap-3 md:grid-cols-2", isMarketerView ? "xl:grid-cols-4" : "xl:grid-cols-5")}>
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Date Range</span>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value as CommunicationDateRange)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
              {COMMUNICATION_DATE_RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Activity Type</span>
            <select value={activityType} onChange={(event) => setActivityType(event.target.value as CommunicationActivityFilter)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
              {COMMUNICATION_ACTIVITY_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          {!isMarketerView ? (
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Employee</span>
              <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
                <option value="ALL">All Employees</option>
                {employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </label>
          ) : null}

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Customer / Company</span>
            <Input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Search customer or company" className="h-10 rounded-xl border-slate-200 text-sm font-medium" />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-slate-500">Search Activities</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={activityQuery} onChange={(event) => setActivityQuery(event.target.value)} placeholder="Search titles, notes or actions" className="h-10 rounded-xl border-slate-200 pl-9 text-sm font-medium" />
            </div>
          </label>
        </div>

        {dateRange === "custom" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:max-w-[420px]">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Start Date</span>
              <Input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} className="h-10 rounded-xl border-slate-200 text-sm font-medium" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">End Date</span>
              <Input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} className="h-10 rounded-xl border-slate-200 text-sm font-medium" />
            </label>
          </div>
        ) : null}
      </Card>

      <Card className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Activity Timeline</h2>
            <p className="mt-1 text-sm text-slate-500">Clean, human-readable CRM activity across calls, WhatsApp, emails, follow-ups, meetings, quotations, and lead updates.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {filteredActivities.length} {filteredActivities.length === 1 ? "activity" : "activities"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => startRefresh(() => router.refresh())}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", refreshPending && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {pagedActivities.length ? pagedActivities.map((activity, index) => (
            <CommunicationActivityTimelineItem
              key={activity.id}
              activity={activity}
              expanded={expandedActivityId === activity.id}
              onToggle={() => setExpandedActivityId((current) => (current === activity.id ? null : activity.id))}
              index={index}
            />
          )) : (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <EmptyState title="No activities found" description="Try a different date range, employee, customer, or keyword filter." />
              <div className="mt-4">
                <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                  Reset Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 text-sm text-slate-500 md:flex-row md:items-center md:gap-4">
            <span>Showing {pagedActivities.length ? (safePage - 1) * pageSize + 1 : 0} - {Math.min(safePage * pageSize, filteredActivities.length)} of {filteredActivities.length} activities</span>
            <label className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Page size</span>
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100">
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
              Previous
            </Button>
            {pageNumbers.map((pageNumber) => (
              <Button
                key={pageNumber}
                type="button"
                size="sm"
                variant={pageNumber === safePage ? "default" : "outline"}
                onClick={() => setCurrentPage(pageNumber)}
              >
                {pageNumber}
              </Button>
            ))}
            <Button type="button" variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
              Next
            </Button>
          </div>
        </div>
      </Card>

      <FormModal open={open} title="Add Communication / Activity Log" onClose={() => setOpen(false)}>
        <CommunicationForm workspace={workspace} onDone={() => setOpen(false)} />
      </FormModal>
    </>
  );
}

export function NotificationsPage({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <>
      <PageHeader title="Notifications Center" description="Follow-up reminders, task assignments, overdue alerts, rewards, target alerts, and system notices." />
      <Card className="p-5">
        <div className="space-y-3">
          {workspace.notifications.map((item) => (
            <div key={item.id} className={cn("flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between", item.read ? "border-slate-100 bg-slate-50" : "border-blue-100 bg-blue-50/70")}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-slate-950">
                    <EntityLink href={item.href} className="font-black">{item.title}</EntityLink>
                  </h3>
                  <StatusBadge value={item.type} />
                  {!item.read ? <Badge variant="danger">Unread</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">{item.time}</p>
              </div>
              {!item.read ? (
                <form action={markNotificationReadAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button type="submit" variant="outline" size="sm">Mark Read</Button>
                </form>
              ) : null}
            </div>
          ))}
          {!workspace.notifications.length ? <EmptyState title="No notifications" description="System reminders and CRM updates will appear here." /> : null}
        </div>
      </Card>
    </>
  );
}

type MarketerSuggestionRow = {
  id: string;
  message: string;
  senderName: string;
  senderRole: string;
  read: boolean;
  createdAt: string;
};

export function MarketerSuggestionsPage() {
  const { refreshSuggestionCount } = useTaskCounterContext();
  const [rows, setRows] = React.useState<MarketerSuggestionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [markingId, setMarkingId] = React.useState<string | null>(null);

  const refreshSuggestions = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/suggestions", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.rows)) {
        throw new Error(typeof result.message === "string" ? result.message : "Failed to load suggestions.");
      }
      setRows(result.rows as MarketerSuggestionRow[]);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load suggestions.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshSuggestions();
  }, [refreshSuggestions]);

  const handleMarkRead = async (id: string) => {
    setMarkingId(id);
    try {
      const response = await fetch(`/api/suggestions/${id}/read`, { method: "POST" });
      if (response.ok) {
        setRows((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
        void refreshSuggestionCount();
      }
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <>
      <PageHeader title="Suggestions" description="Feedback and suggestions from your admin/supervisor after reviewing your dashboard." />
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>
      ) : null}
      <Card className="p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading suggestions...
          </div>
        ) : rows.length ? (
          <div className="space-y-3">
            {rows.map((item) => (
              <div key={item.id} className={cn("flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-start md:justify-between", item.read ? "border-slate-100 bg-slate-50" : "border-blue-100 bg-blue-50/70")}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-950">{item.senderName}</h3>
                    <Badge variant="neutral">{item.senderRole}</Badge>
                    {!item.read ? <Badge variant="danger">New</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                {!item.read ? (
                  <Button type="button" variant="outline" size="sm" disabled={markingId === item.id} onClick={() => void handleMarkRead(item.id)}>
                    {markingId === item.id ? "Marking..." : "Mark Read"}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No suggestions yet" description="Suggestions from your admin/supervisor will show up here." />
        )}
      </Card>
    </>
  );
}

export function RewardsPage({ role, workspace }: { role: Role; workspace: CrmWorkspace }) {
  const [rewardOpen, setRewardOpen] = React.useState(false);
  const [ruleOpen, setRuleOpen] = React.useState(false);
  const [rewardRules, setRewardRules] = React.useState(workspace.rewardRules);
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null);
  const [deleteRule, setDeleteRule] = React.useState<(typeof workspace.rewardRules)[number] | null>(null);
  const [ruleSearch, setRuleSearch] = React.useState("");
  const [ruleStatus, setRuleStatus] = React.useState<"all" | "active" | "inactive">("all");
  const [togglingRuleId, setTogglingRuleId] = React.useState<string | null>(null);
  const [ruleMessage, setRuleMessage] = React.useState("");
  const [ruleSaving, setRuleSaving] = React.useState(false);
  const [ruleDeleting, setRuleDeleting] = React.useState(false);

  const isAdmin = role === "ADMIN";
  const editingRule = editingRuleId ? rewardRules.find((rule) => rule.id === editingRuleId) ?? null : null;

  const triggerOptions = [
    ["LEAD_CREATED", "Lead Added"],
    ["FOLLOW_UP_COMPLETED", "Follow-up Completed"],
    ["MEETING_SCHEDULED", "Meeting Scheduled"],
    ["WON_SALE", "Deal Won"],
    ["TASK_COMPLETED", "Task Completed"],
    ["MANUAL_ADJUSTMENT", "Manual Adjustment"],
  ] as const;

  const rewardRuleTriggerLabel = (trigger: string) => {
    const match = triggerOptions.find(([value]) => value === trigger);
    return match ? match[1] : trigger;
  };

  const filteredRules = React.useMemo(() => {
    const keyword = ruleSearch.trim().toLowerCase();
    return rewardRules.filter((rule) => {
      if (ruleStatus !== "all") {
        const isActive = rule.active;
        if (ruleStatus === "active" && !isActive) return false;
        if (ruleStatus === "inactive" && isActive) return false;
      }
      if (!keyword) return true;
      return [rule.name, rewardRuleTriggerLabel(rule.trigger)].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [rewardRules, ruleSearch, ruleStatus]);

  React.useEffect(() => {
    setRewardRules(workspace.rewardRules);
  }, [workspace.rewardRules]);

  const toggleRuleStatus = async (rule: (typeof rewardRules)[number]) => {
    setTogglingRuleId(rule.id);
    setRuleMessage("");
    try {
      const response = await fetch(`/api/reward-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rule.active }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.row) {
        setRuleMessage(result.message ?? "Action failed.");
        return;
      }

      const nextRule = result.row as (typeof rewardRules)[number];
      setRewardRules((current) => current.map((item) => (item.id === nextRule.id ? nextRule : item)));
    } catch (error) {
      setRuleMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setTogglingRuleId(null);
    }
  };

  return (
    <>
      <PageHeader title="Rewards & Incentives" description="Manage reward rules, manual incentives, reward history, and automation log." actions={isAdmin ? pageActions([{ label: "Manual Reward", icon: Plus, variant: "default", onClick: () => setRewardOpen(true) }]) : undefined} />
      <div className="grid gap-5 lg:grid-cols-3">
        <StatCard title="Total Reward Given" value={String(workspace.employees.reduce((sum, row) => sum + row.rewardPoints, 0))} helper="Visible users" icon={WalletCards} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Best Performer" value={workspace.employees[0]?.name ?? "-"} helper={`${workspace.employees[0]?.rewardPoints ?? 0} points`} icon={UserPlus} tone="bg-amber-100 text-amber-700" />
        <StatCard title="Rules Active" value={String(rewardRules.filter((rule) => rule.active).length)} helper="Automation rules" icon={Check} tone="bg-emerald-100 text-emerald-700" />
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Reward Rules</h2>
            <p className="text-sm text-slate-500">Create and manage rules to automatically reward employees for specific actions.</p>
          </div>
          {isAdmin ? (
            <Button type="button" size="sm" onClick={() => {
              setEditingRuleId(null);
              setRuleOpen(true);
            }} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_220px]">
          <Input placeholder="Search rules..." value={ruleSearch} onChange={(event) => setRuleSearch(event.target.value)} />
          <select
            value={ruleStatus}
            onChange={(event) => setRuleStatus(event.target.value as "all" | "active" | "inactive")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="mt-4 hidden lg:block">
          {ruleMessage ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{ruleMessage}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3 font-bold">Rule Name</th>
                  <th className="px-4 py-3 font-bold">Trigger / Event</th>
                  <th className="px-4 py-3 font-bold">Points</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Created At</th>
                  <th className="px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.length ? filteredRules.map((rule) => (
                  <tr key={rule.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{rule.name}</td>
                    <td className="px-4 py-3 text-slate-600">{rewardRuleTriggerLabel(rule.trigger)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{rule.points}</td>
                    <td className="px-4 py-3"><StatusBadge value={rule.active ? "Active" : "Inactive"} /></td>
                    <td className="px-4 py-3 text-slate-600">{rule.createdAt}</td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingRuleId(rule.id);
                              setRuleOpen(true);
                            }}
                            className="scale-95 transition hover:scale-105 hover:bg-slate-100"
                            aria-label="Edit rule"
                          >
                            <Edit className="h-4 w-4 text-slate-600" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="transition hover:scale-105"
                            disabled={togglingRuleId === rule.id}
                            onClick={() => void toggleRuleStatus(rule)}
                          >
                            {togglingRuleId === rule.id ? "Updating..." : rule.active ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="transition hover:scale-105"
                            onClick={() => setDeleteRule(rule)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No reward rules found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

            <div className="mt-4 space-y-3 lg:hidden">
          {ruleMessage ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{ruleMessage}</p> : null}
          {filteredRules.length ? filteredRules.map((rule) => (
            <div key={rule.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{rule.name}</p>
                  <p className="text-xs text-slate-500">{rewardRuleTriggerLabel(rule.trigger)}</p>
                </div>
                <StatusBadge value={rule.active ? "Active" : "Inactive"} />
              </div>
              <div className="mt-3 grid gap-1 text-xs text-slate-600">
                <p><span className="font-bold text-slate-700">Points:</span> {rule.points}</p>
                <p><span className="font-bold text-slate-700">Created:</span> {rule.createdAt}</p>
              </div>
              {isAdmin ? (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setEditingRuleId(rule.id);
                      setRuleOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={togglingRuleId === rule.id}
                    onClick={() => void toggleRuleStatus(rule)}
                  >
                    {togglingRuleId === rule.id ? "Updating..." : rule.active ? "Disable" : "Enable"}
                  </Button>
                  <Button type="button" size="sm" variant="destructive" className="h-8" onClick={() => setDeleteRule(rule)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>
          )) : <EmptyState title="No reward rules found" description="Try adjusting your search or status filter." />}
        </div>
      </Card>

      <div className="mt-5">
        <TeamManagementTable workspace={workspace} rows={workspace.employees} viewerRole={role} />
      </div>

      <FormModal title="Manual Reward" open={rewardOpen} onClose={() => setRewardOpen(false)}>
        <ActionForm action={giveManualRewardAction} onDone={() => setRewardOpen(false)} submitLabel="Give Reward">
          <SelectBox label="Employee" name="userId"><EntityOptions workspace={workspace} type="users" /></SelectBox>
          <TextField label="Points" name="points" type="number" defaultValue="0" />
          <TextAreaField label="Reason" name="reason" />
        </ActionForm>
      </FormModal>
      <FormModal title={editingRule ? "Update Reward Rule" : "Add Reward Rule"} open={ruleOpen} onClose={() => setRuleOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const payload = {
              name: String(formData.get("name") ?? "").trim(),
              trigger: String(formData.get("trigger") ?? "").trim(),
              points: Number(formData.get("points")),
              active: String(formData.get("active") ?? "true") === "true",
            };

            void (async () => {
              setRuleSaving(true);
              setRuleMessage("");
              try {
                const response = await fetch(editingRule ? `/api/reward-rules/${editingRule.id}` : "/api/reward-rules", {
                  method: editingRule ? "PATCH" : "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const result = await response.json();
                if (!response.ok || !result.success || !result.row) {
                  setRuleMessage(result.message ?? "Reward rule save failed.");
                  return;
                }

                const nextRule = result.row as (typeof rewardRules)[number];
                setRewardRules((current) => {
                  if (editingRule) {
                    return current.map((item) => (item.id === nextRule.id ? nextRule : item));
                  }
                  return [...current, nextRule];
                });

                if (!editingRule) {
                  form.reset();
                }
                setRuleOpen(false);
                setEditingRuleId(null);
              } catch (error) {
                setRuleMessage(error instanceof Error ? error.message : "Reward rule save failed.");
              } finally {
                setRuleSaving(false);
              }
            })();
          }}
        >
          <TextField label="Rule Name" name="name" required defaultValue={editingRule?.name ?? ""} />
          <SelectBox label="Trigger / Event" name="trigger" defaultValue={editingRule?.trigger ?? "LEAD_CREATED"}>
            {triggerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectBox>
          <TextField label="Points" name="points" type="number" required defaultValue={editingRule ? String(editingRule.points) : ""} />
          <SelectBox label="Status" name="active" defaultValue={editingRule ? (editingRule.active ? "true" : "false") : "true"}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </SelectBox>
          {ruleMessage ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{ruleMessage}</p> : null}
          <div className="flex flex-col gap-2">
            <Button className="w-full" disabled={ruleSaving} type="submit">
              {ruleSaving ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={ruleSaving}
              onClick={() => {
                setRuleOpen(false);
                setEditingRuleId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </FormModal>
      <FormModal title="Delete Reward Rule" open={Boolean(deleteRule)} onClose={() => setDeleteRule(null)}>
        {deleteRule ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete <span className="font-black">{deleteRule.name}</span>? This action cannot be undone.
            </p>
            {ruleMessage ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{ruleMessage}</p> : null}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={ruleDeleting}
                onClick={async () => {
                  setRuleDeleting(true);
                  setRuleMessage("");
                  try {
                    const response = await fetch(`/api/reward-rules/${deleteRule.id}`, { method: "DELETE" });
                    const result = await response.json();
                    if (!response.ok || !result.success || typeof result.id !== "string") {
                      setRuleMessage(result.message ?? "Reward rule delete failed.");
                      return;
                    }

                    setRewardRules((current) => current.filter((item) => item.id !== result.id));
                    setDeleteRule(null);
                  } catch (error) {
                    setRuleMessage(error instanceof Error ? error.message : "Reward rule delete failed.");
                  } finally {
                    setRuleDeleting(false);
                  }
                }}
              >
                {ruleDeleting ? "Deleting..." : "Delete Rule"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDeleteRule(null)} className="w-full bg-slate-50" disabled={ruleDeleting}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </FormModal>
    </>
  );
}

const REPORT_LEAD_STATUS_OPTIONS = [
  "NEW_LEAD",
  "CONTACTED",
  "INTERESTED",
  "FOLLOW_UP_REQUIRED",
  "QUOTATION_SENT",
  "NEGOTIATION",
  "WON_SALE",
  "LOST_SALE",
  "ON_HOLD",
] as const;

function reportFormatLabel(format: ReportFormat) {
  return format === "xlsx" ? "XLSX" : format === "csv" ? "CSV" : format === "print" ? "Print" : "PDF";
}

const reportPeriodOptions = [
  { value: "today", label: "Today" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
] as const;

function reportPeriodLabel(period: (typeof reportPeriodOptions)[number]["value"]) {
  return reportPeriodOptions.find((option) => option.value === period)?.label ?? "Today";
}

export function ReportsPage({ workspace }: { workspace: CrmWorkspace }) {
  const [feedback, setFeedback] = React.useState<UserFeedback>(null);
  const [activeExport, setActiveExport] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<"today" | "week" | "month">("today");
  const [userId, setUserId] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [customerLabel, setCustomerLabel] = React.useState("");
  const viewerRole = workspace.user.role;
  const isMarketerViewer = viewerRole === "MARKETER";

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const marketerRows = React.useMemo(
    () => workspace.employees.filter((employee) => employee.roleKey === "MARKETER" && employee.statusKey === "ACTIVE"),
    [workspace.employees],
  );
  const effectiveUserId = isMarketerViewer ? workspace.user.id ?? "" : userId;
  const companyOptions = React.useMemo(
    () => workspace.companies.map((company) => ({ value: company.id, label: company.name })),
    [workspace.companies],
  );
  const selectedMarketer = React.useMemo(
    () => {
      if (isMarketerViewer) {
        return marketerRows.find((employee) => employee.id === workspace.user.id) ?? null;
      }

      return marketerRows.find((employee) => employee.id === userId) ?? null;
    },
    [isMarketerViewer, marketerRows, userId, workspace.user.id],
  );
  const selectedCompany = React.useMemo(
    () => workspace.companies.find((company) => company.id === customerId) ?? null,
    [customerId, workspace.companies],
  );

  const parseFileName = React.useCallback((response: Response, fallback: string) => {
    const disposition = response.headers.get("content-disposition");
    const match = disposition?.match(/filename=\"?([^\"]+)\"?/i);
    return match?.[1] ?? fallback;
  }, []);

  const buildParams = React.useCallback((format: ReportFormat) => {
    const params = new URLSearchParams();
    params.set("reportType", "CUSTOMER_COMMUNICATION");
    params.set("format", format);
    params.set("datePreset", period);
    if (effectiveUserId) params.set("userId", effectiveUserId);
    if (customerId) params.set("customerId", customerId);
    return params;
  }, [customerId, effectiveUserId, period]);

  const handleExport = React.useCallback(async (format: ReportFormat) => {
    const exportKey = `customer-communication-${format}`;
    setActiveExport(exportKey);
    setFeedback(null);

    try {
      const response = await fetch(`/api/reports/export?${buildParams(format).toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Report export failed.");
      }

      const fallbackName = `marketer-communication-report.${format === "print" ? "html" : format}`;
      const fileName = parseFileName(response, fallbackName);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      if (format === "print") {
        const popup = window.open(url, "_blank", "noopener,noreferrer");
        if (!popup) {
          window.location.href = url;
        }
        window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 5_000);
      }

      setFeedback({
        type: "success",
        message: format === "print" ? "Printable report opened successfully." : "Report download is ready.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Report export failed.",
      });
    } finally {
      setActiveExport(null);
    }
  }, [buildParams, parseFileName]);

  const pageDescription = isMarketerViewer
    ? "Download your own communication report for today, weekly activity, or monthly activity."
    : "Download clean marketer communication reports for today, weekly activity, or monthly activity.";
  const selectionMarketerLabel = isMarketerViewer
    ? (selectedMarketer?.name ?? workspace.user.name)
    : (selectedMarketer?.name ?? "All Marketers");
  const accessScopeLabel = isMarketerViewer
    ? "Only your own report data will be downloaded."
    : "You can download all marketers or choose one marketer.";

  return (
    <>
      <FloatingFeedback feedback={feedback} />
      <PageHeader title="Reports" description={pageDescription} />

      <Card className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
            <FileText className="h-3.5 w-3.5" />
            Communication Report
          </div>
          <h2 className="mt-3 text-xl font-black text-slate-950">
            {isMarketerViewer ? "Download your own communication report" : "Download marketer communication reports"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isMarketerViewer
              ? "Choose a period and optional company filter. Your report will download in a clean format."
              : "Choose a period, optional marketer, and optional company filter. Then download the report in your preferred format."}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {reportPeriodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-4 text-sm font-bold transition",
                period === option.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={cn("mt-5 grid gap-4", isMarketerViewer ? "md:grid-cols-1" : "md:grid-cols-2")}>
          {isMarketerViewer ? null : (
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-slate-500">Marketer</span>
              <select
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">All Marketers</option>
                {marketerRows.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <SearchableEntitySelect
            label="Company Search"
            options={companyOptions}
            value={customerId}
            defaultLabel={customerLabel}
            onValueChange={(value, label) => {
              setCustomerId(value);
              setCustomerLabel(label);
            }}
            placeholder="Search company name"
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(["pdf", "xlsx", "csv", "print"] as const).map((format) => (
            <Button
              key={format}
              type="button"
              variant={format === "pdf" ? "default" : "outline"}
              className="w-full"
              disabled={Boolean(activeExport)}
              onClick={() => void handleExport(format)}
            >
              {format === "print" ? <Printer className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {activeExport === `customer-communication-${format}` ? "Preparing..." : reportFormatLabel(format)}
            </Button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-600">
          <p className="font-bold text-slate-900">Current selection</p>
          <p className="mt-2">
            <span className="font-semibold text-slate-700">Period:</span> {reportPeriodLabel(period)}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Marketer:</span> {selectionMarketerLabel}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Company:</span> {selectedCompany?.name ?? "All Companies"}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Access:</span> {accessScopeLabel}
          </p>
        </div>
      </Card>
    </>
  );
}

function TeamManagementTable({
  workspace,
  rows,
  viewerRole,
  currentUserId,
  onEdit,
  onViewDetails,
}: {
  workspace: CrmWorkspace;
  rows: CrmWorkspace["employees"];
  viewerRole: Role;
  currentUserId?: string;
  onEdit?: (row: CrmWorkspace["employees"][number]) => void;
  onViewDetails?: (row: CrmWorkspace["employees"][number]) => void;
}) {
  const columns = React.useMemo<ColumnDef<(typeof workspace.employees)[number]>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Employee Name",
        cell: ({ row }) => (
          onViewDetails ? (
            <button
              type="button"
              onClick={() => onViewDetails(row.original)}
              className="font-bold text-slate-900 transition hover:text-blue-700 hover:underline"
            >
              {row.original.name}
            </button>
          ) : (
            <span className="font-bold text-slate-900">{row.original.name}</span>
          )
        ),
      },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "leads", header: "Leads" },
      { accessorKey: "followUps", header: "Follow-ups" },
      { accessorKey: "sales", header: "Sales" },
      { accessorKey: "rewardPoints", header: "Reward Points" },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      {
        id: "Action",
        header: "Action",
        cell: ({ row }) => {
          const canEdit = viewerRole === "ADMIN"
            ? true
            : row.original.roleKey === "MARKETER" && Boolean(currentUserId) && row.original.supervisorIds.includes(currentUserId ?? "");

          return <UserRowActions canEdit={canEdit && Boolean(onEdit)} canDelete={false} onEdit={onEdit ? () => onEdit(row.original) : undefined} />;
        },
      },
    ],
    [currentUserId, onEdit, onViewDetails, viewerRole],
  );

  return <DataTable data={rows} columns={columns} searchPlaceholder="Search employee..." />;
}

export function TeamPage({ role, workspace, currentUserId }: { role: Role; workspace: CrmWorkspace; currentUserId?: string }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<CrmWorkspace["employees"][number] | null>(null);
  const [selectedEmployee, setSelectedEmployee] = React.useState<CrmWorkspace["employees"][number] | null>(null);
  const [feedback, setFeedback] = React.useState<UserFeedback>(null);
  const [employees, setEmployees] = React.useState<CrmWorkspace["employees"]>(() => workspace.employees);
  const headerActions = role === "ADMIN"
    ? pageActions([{ label: "Add Employee", icon: Plus, variant: "default", href: "/admin/users" }])
    : role === "SUPERVISOR"
      ? pageActions([{ label: "Create Marketer", icon: Plus, variant: "default", onClick: () => setCreateOpen(true) }])
      : undefined;

  React.useEffect(() => {
    setEmployees(workspace.employees);
  }, [workspace.employees]);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  return (
    <>
      <FloatingFeedback feedback={feedback} />
      <PageHeader title="Team Management" description="Monitor employees, activity level, sales, and reward performance." actions={headerActions} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Employees" value={String(employees.length)} helper="Team users" icon={UserPlus} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Active Employees" value={String(employees.filter((item) => item.statusKey === "ACTIVE").length)} helper="Currently active" icon={Check} tone="bg-emerald-100 text-emerald-700" />
        <StatCard title="Best Performer" value={employees[0]?.name ?? "-"} helper={`${employees[0]?.rewardPoints ?? 0} reward points`} icon={WalletCards} tone="bg-amber-100 text-amber-700" />
        <StatCard title="Low Activity" value={String(employees.filter((item) => item.leads === 0).length)} helper="Needs coaching" icon={Settings} tone="bg-red-100 text-red-700" />
      </div>
      <Card className="p-5">
        <TeamManagementTable
          workspace={workspace}
          rows={employees}
          viewerRole={role}
          currentUserId={currentUserId}
          onEdit={(row) => setEditUser(row)}
          onViewDetails={(row) => {
            setSelectedEmployee(row);
            setDrawerOpen(true);
          }}
        />
      </Card>
      <DetailsDrawer
        title={selectedEmployee ? `${selectedEmployee.name} Profile` : "Employee Profile"}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedEmployee(null);
        }}
      >
        {selectedEmployee ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                  {initials(selectedEmployee.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-slate-950">{selectedEmployee.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={selectedEmployee.roleKey === "ADMIN" ? "danger" : selectedEmployee.roleKey === "SUPERVISOR" ? "violet" : "default"}>
                      {selectedEmployee.role}
                    </Badge>
                    <StatusBadge value={selectedEmployee.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    {selectedEmployee.designation !== "-" ? selectedEmployee.designation : selectedEmployee.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["Leads", selectedEmployee.leads],
                ["Calls", selectedEmployee.calls],
                ["WhatsApp", selectedEmployee.whatsapp],
                ["Emails", selectedEmployee.emails],
                ["Meetings", selectedEmployee.meetings],
                ["Follow-ups", selectedEmployee.followUps],
                ["Pending Tasks", selectedEmployee.pendingTasks],
                ["Overdue", selectedEmployee.overdueFollowUps],
                ["Sales", selectedEmployee.sales],
                ["Reward Points", selectedEmployee.rewardPoints],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Contact</p>
              <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                <p>Email: {selectedEmployee.email || "-"}</p>
                <p>Mobile: {selectedEmployee.mobile || "-"}</p>
                <p>Conversion: {selectedEmployee.conversionRate || "-"}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Employee detail will appear here.</p>
        )}
      </DetailsDrawer>
      <FormModal title="Create Marketer" open={createOpen} onClose={() => setCreateOpen(false)}>
        <UserForm
          employees={employees}
          viewerRole="SUPERVISOR"
          mode="create"
          forcedRole="MARKETER"
          onDone={() => setCreateOpen(false)}
          onFailure={(message) => setFeedback({ type: "error", message })}
          onSuccess={(row) => {
            setEmployees((current) => [row, ...current]);
            setFeedback({ type: "success", message: "Marketer created successfully." });
          }}
        />
      </FormModal>
      <FormModal title="Edit User" open={Boolean(editUser)} onClose={() => setEditUser(null)}>
        {editUser ? (
          <UserForm
            employees={employees}
            viewerRole={role}
            mode="edit"
            user={editUser}
            onDone={() => setEditUser(null)}
            onFailure={(message) => setFeedback({ type: "error", message })}
            onSuccess={(row) => {
              setEmployees((current) => current.map((item) => (item.id === row.id ? { ...item, ...row } : item)));
              setFeedback({ type: "success", message: "User updated successfully." });
            }}
          />
        ) : null}
      </FormModal>
    </>
  );
}

export function UsersPage({ workspace, currentUserId }: { workspace: CrmWorkspace; currentUserId?: string }) {
  const [open, setOpen] = React.useState(false);
  const [editUser, setEditUser] = React.useState<CrmWorkspace["employees"][number] | null>(null);
  const [deleteUser, setDeleteUser] = React.useState<CrmWorkspace["employees"][number] | null>(null);
  const [feedback, setFeedback] = React.useState<UserFeedback>(null);
  const [users, setUsers] = React.useState<CrmWorkspace["employees"]>(() => workspace.employees);

  React.useEffect(() => {
    setUsers(workspace.employees);
  }, [workspace.employees]);

  React.useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const columns = React.useMemo<ColumnDef<(typeof workspace.employees)[number]>[]>(
    () => [
      { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-bold text-slate-900">{row.original.name}</span> },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "mobile", header: "Mobile" },
      { accessorKey: "role", header: "Role", cell: ({ row }) => <StatusBadge value={row.original.role} /> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      {
        id: "Action",
        header: "Action",
        cell: ({ row }) => (
          <UserRowActions
            canEdit
            canDelete={row.original.id !== currentUserId}
            onEdit={() => setEditUser(row.original)}
            onDelete={() => setDeleteUser(row.original)}
          />
        ),
      },
    ],
    [currentUserId],
  );

  return (
    <>
      <FloatingFeedback feedback={feedback} />
      <PageHeader title="Users & Roles" description="Create users, assign roles, and manage permission controls." actions={pageActions([{ label: "Create User", icon: Plus, variant: "default", onClick: () => setOpen(true) }])} />
      <Card className="p-5">
        <Tabs defaultValue="users" tabs={[{ label: "Users", value: "users" }, { label: "Roles", value: "roles" }, { label: "Permissions", value: "permissions" }]}>
          {(value) => value === "users" ? <DataTable data={users} columns={columns} searchPlaceholder="Search user..." /> : <PermissionsPage workspace={workspace} embedded />}
        </Tabs>
      </Card>
      <FormModal title="Create User" open={open} onClose={() => setOpen(false)}>
        <UserForm
          employees={users}
          viewerRole="ADMIN"
          mode="create"
          onDone={() => setOpen(false)}
          onFailure={(message) => setFeedback({ type: "error", message })}
          onSuccess={(row) => {
            setUsers((current) => [row, ...current]);
            setFeedback({ type: "success", message: "User created successfully." });
          }}
        />
      </FormModal>
      <FormModal title="Edit User" open={Boolean(editUser)} onClose={() => setEditUser(null)}>
        {editUser ? (
          <UserForm
            employees={users}
            viewerRole="ADMIN"
            mode="edit"
            user={editUser}
            onDone={() => setEditUser(null)}
            onFailure={(message) => setFeedback({ type: "error", message })}
            onSuccess={(row) => {
              setUsers((current) => current.map((item) => (item.id === row.id ? { ...item, ...row } : item)));
              setFeedback({ type: "success", message: "User updated successfully." });
            }}
          />
        ) : null}
      </FormModal>
      <FormModal title="Delete User" open={Boolean(deleteUser)} onClose={() => setDeleteUser(null)} panelClassName="max-w-md">
        {deleteUser ? (
          <DeleteUserPanel
            user={deleteUser}
            onDone={() => setDeleteUser(null)}
            onFailure={(message) => setFeedback({ type: "error", message })}
            onSuccess={(id) => {
              setUsers((current) => current.filter((item) => item.id !== id));
              setFeedback({ type: "success", message: "User deleted successfully." });
            }}
          />
        ) : null}
      </FormModal>
    </>
  );
}

export function PermissionsPage({ workspace, embedded = false }: { workspace: CrmWorkspace; embedded?: boolean }) {
  const content = (
    <Card className={embedded ? "border-0 shadow-none" : "p-5"}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Module</th>{["View", "Create", "Edit", "Delete", "Assign", "Reassign", "Import", "Export", "Download Report"].map((action) => <th key={action} className="px-4 py-3">{action}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {workspace.permissions.map((row) => (
              <tr key={row.module}><td className="px-4 py-3 font-bold text-slate-900">{row.module}</td>{["View", "Create", "Edit", "Delete", "Assign", "Reassign", "Import", "Export", "Download Report"].map((action) => <td key={action} className="px-4 py-3"><input type="checkbox" checked={Boolean(row.permissions[action])} readOnly className="h-4 w-4" /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
  if (embedded) return content;
  return <><PageHeader title="Role & Permission Management" description="Module and action-based permission matrix for CRM roles." />{content}</>;
}

export function ImportExportPage({ workspace }: { workspace: CrmWorkspace }) {
  const columns = React.useMemo<ColumnDef<(typeof workspace.importExportLogs)[number]>[]>(() => [
    { accessorKey: "type", header: "Type" },
    { accessorKey: "module", header: "Module" },
    { accessorKey: "format", header: "Format" },
    { accessorKey: "fileName", header: "File" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
    { accessorKey: "processedRows", header: "Processed" },
    { accessorKey: "failedRows", header: "Failed" },
    { accessorKey: "createdAt", header: "Created" },
  ], []);

  return (
    <>
      <PageHeader title="Import / Export" description="CSV and Excel customer, company, lead, and report movement log." />
      <Card className="p-5">
        <ActionForm action={createImportExportLogAction} submitLabel="Record Import / Export">
          <div className="grid gap-3 md:grid-cols-5">
            <SelectBox label="Type" name="type"><option value="IMPORT">Import</option><option value="EXPORT">Export</option></SelectBox>
            <SelectBox label="Module" name="module"><option value="CUSTOMERS">Customers</option><option value="LEADS">Leads</option><option value="PRODUCTS">Products</option><option value="REPORTS">Reports</option></SelectBox>
            <SelectBox label="Format" name="format"><option value="CSV">CSV</option><option value="EXCEL">Excel</option><option value="PDF">PDF</option></SelectBox>
            <TextField label="File Name" name="fileName" />
            <TextField label="Processed Rows" name="processedRows" type="number" defaultValue={0} />
          </div>
        </ActionForm>
      </Card>
      {workspace.leads.length || workspace.companies.length ? (
        <DashboardCard title="Saved Data Preview">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-black text-slate-900">Saved Leads</h3>
              <div className="mt-3 space-y-2">
                {workspace.leads.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between gap-3 text-sm">
                    <EntityLink href={`/leads/${lead.id}`} className="truncate font-bold">{lead.title}</EntityLink>
                    <EntityLink href={lead.companyId ? `/customers/${lead.companyId}` : undefined} className="truncate text-xs font-semibold">{lead.company}</EntityLink>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-sm font-black text-slate-900">Saved Customers</h3>
              <div className="mt-3 space-y-2">
                {workspace.companies.slice(0, 5).map((company) => (
                  <div key={company.id} className="flex items-center justify-between gap-3 text-sm">
                    <EntityLink href={`/customers/${company.id}`} className="truncate font-bold">{company.name}</EntityLink>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">{company.totalLeads} leads</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DashboardCard>
      ) : null}
      <DataTable data={workspace.importExportLogs} columns={columns} searchPlaceholder="Search import/export logs..." />
    </>
  );
}

export function MyPerformancePage({ workspace }: { workspace: CrmWorkspace }) {
  const me = workspace.employees.find((item) => item.id === workspace.user.id) ?? workspace.employees[0];
  return (
    <>
      <PageHeader title="My Performance" description="Personal sales execution, points, conversion, and activity score." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Leads Added" value={String(me?.leads ?? 0)} helper="Assigned pipeline" icon={Target} tone="bg-blue-100 text-blue-700" />
        <StatCard title="Follow-ups" value={String(me?.followUps ?? 0)} helper="Open and complete" icon={CalendarClock} tone="bg-amber-100 text-amber-700" />
        <StatCard title="Sales" value={String(me?.sales ?? 0)} helper="Won leads" icon={Check} tone="bg-emerald-100 text-emerald-700" />
        <StatCard title="Reward Points" value={String(me?.rewardPoints ?? 0)} helper={me?.conversionRate ?? "0%"} icon={Award} tone="bg-violet-100 text-violet-700" />
      </div>
      <DashboardCard title="Recent Activity"><Timeline rows={workspace.activities} /></DashboardCard>
    </>
  );
}

export function CalendarPage({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <>
      <PageHeader title="Calendar" description="Daily task, plan, and follow-up schedule." />
      <div className="grid gap-5 xl:grid-cols-3">
        <DashboardCard title="Plans"><CompactSchedule rows={workspace.todayPlans.map((item) => ({ id: item.id, href: item.href, title: item.title, meta: `${item.time} - ${item.status}` }))} /></DashboardCard>
        <DashboardCard title="Tasks"><CompactSchedule rows={workspace.tasks.map((item) => ({ id: item.id, href: item.href, title: item.title, meta: `${item.dueDate} - ${item.status}` }))} /></DashboardCard>
        <DashboardCard title="Follow-ups"><CompactSchedule rows={workspace.followUps.map((item) => ({ id: item.id, href: item.href, title: item.customer, meta: `${item.followUpDate} - ${item.bucket}` }))} /></DashboardCard>
      </div>
    </>
  );
}

function CompactSchedule({ rows }: { rows: { id: string; title: string; meta: string; href?: string | null }[] }) {
  return <div className="space-y-2">{rows.slice(0, 10).map((row) => <div key={row.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold text-slate-900"><EntityLink href={row.href} className="font-bold">{row.title}</EntityLink></p><p className="text-xs text-slate-500">{row.meta}</p></div>)}</div>;
}

export function SettingsPage({
  initialSettings,
}: {
  initialSettings: {
    company: string;
    email: string;
    phone: string;
    address: string;
  };
}) {
  return (
    <>
      <PageHeader title="Settings" description="Company settings, lead status, reward rules, targets, notifications, and import/export configuration." />
      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <Card className="p-3">
          <nav className="space-y-1">{["Company Settings", "Lead Status Settings", "Product Category", "Reward Rules", "Target Rules", "Notification Settings", "Import / Export Settings", "System Configuration"].map((item, index) => <button key={item} className={cn("w-full rounded-xl px-3 py-2 text-left text-sm font-bold transition", index === 0 ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50")} type="button">{item}</button>)}</nav>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-black text-slate-950">Company Settings</h2>
          <ActionForm action={saveSettingsAction} submitLabel="Save Changes">
            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                <TextField label="Company Name" name="company" defaultValue={initialSettings.company} />
                <TextField label="Email" name="email" defaultValue={initialSettings.email} />
                <TextField label="Phone" name="phone" defaultValue={initialSettings.phone} />
                <TextField label="Address" name="address" defaultValue={initialSettings.address} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center"><div className="mx-auto flex h-24 w-32 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm"><span className="text-lg font-black">MUGNEE</span></div><Button className="mt-4" type="button" variant="outline">Change Logo</Button></div>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}

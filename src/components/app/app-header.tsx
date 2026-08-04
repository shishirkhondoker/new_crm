"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ArrowRight, Bell, CalendarClock, CheckCheck, Eye, LogOut, Menu, MessageSquare, RefreshCw, Search, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationCenterContext } from "@/components/app/app-shell";
import { TaskCreateModal } from "@/components/crm/resource-pages";
import { FormModal } from "@/components/shared/form-modal";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCrmDate } from "@/lib/crm-time";
import type { CompanyRow, CustomerHistory, CustomerJourneySummary, FollowUpRow, TaskRow } from "@/lib/crm-data";
import { cn, initials, roleLabels, rolePath, type Role, type ShellUser } from "@/lib/utils";

function notificationPageHref(role: Role) {
  return role === "ADMIN" ? "/admin/notifications" : role === "SUPERVISOR" ? "/supervisor/communication" : "/marketer/communication";
}

type ActivitySearchResultRow = {
  id: string;
  customerId?: string;
  href?: string;
  actionHref?: string;
  title: string;
  detail: string;
  badgeLabel: string;
  category: string;
  customerName: string;
  employeeName: string;
  discussionSummary: string;
  time: string;
  taskId?: string;
  followUpId?: string;
};

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

type CustomerLookupRow = {
  id: string;
  companyName?: string;
  contactPerson?: string | null;
  phone?: string | null;
  cityOrZilla?: string | null;
  address?: string | null;
};

function normalizeCustomerSearchText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pickBestCustomerMatch(query: string, rows: CustomerLookupRow[]) {
  const normalizedQuery = normalizeCustomerSearchText(query);
  if (!normalizedQuery) return rows[0] ?? null;

  const exactMatch = rows.find((row) => normalizeCustomerSearchText(row.companyName) === normalizedQuery);
  if (exactMatch) return exactMatch;

  const startsWithMatch = rows.find((row) => normalizeCustomerSearchText(row.companyName).startsWith(normalizedQuery));
  if (startsWithMatch) return startsWithMatch;

  return rows[0] ?? null;
}

type HeaderQuickEditTaskItem = NonNullable<React.ComponentProps<typeof TaskCreateModal>["initialTask"]>;

type CustomerQuickViewIntent = {
  mode: "snapshot" | "direct-edit";
  taskId?: string;
  followUpId?: string;
};

function priorityKeyFromLabel(priority?: string | null): HeaderQuickEditTaskItem["priorityKey"] {
  const normalized = priority?.trim().toUpperCase();
  if (normalized === "LOW") return "LOW";
  if (normalized === "HIGH") return "HIGH";
  if (normalized === "IMPORTANT") return "IMPORTANT";
  return "MEDIUM";
}

function normalizeTaskPriorityKey(priority?: TaskRow["priorityKey"] | null): HeaderQuickEditTaskItem["priorityKey"] {
  if (priority === "URGENT" || priority === "IMPORTANT") return "IMPORTANT";
  if (priority === "HIGH") return "HIGH";
  if (priority === "LOW") return "LOW";
  return "MEDIUM";
}

function normalizeTaskStatusKey(status?: TaskRow["statusKey"] | null): HeaderQuickEditTaskItem["statusKey"] {
  if (status === "COMPLETED") return "COMPLETED";
  return "PENDING";
}

function buildEditableTaskItemFromTask(
  task: TaskRow | undefined,
  customer: CompanyRow | undefined,
): HeaderQuickEditTaskItem | null {
  if (!task?.id) return null;

  return {
    id: task.id,
    title: task.title,
    companyName: task.companyName || task.relatedTo || customer?.name || "-",
    companyId: task.companyId ?? customer?.id ?? null,
    description: task.description !== "-" ? task.description : "",
    notes: task.notes !== "-" ? task.notes : "",
    productId: task.productId ?? null,
    assignedToId: undefined,
    priorityKey: normalizeTaskPriorityKey(task.priorityKey),
    taskDateIso: task.taskDateIso,
    reminder: task.reminder !== "-" ? task.reminder : "",
    statusKey: normalizeTaskStatusKey(task.statusKey),
  };
}

function buildEditableTaskItemFromFollowUp(
  followUp: FollowUpRow | undefined,
  customer: CompanyRow | undefined,
): HeaderQuickEditTaskItem | null {
  if (!followUp?.taskId) return null;

  return {
    id: followUp.taskId,
    title: followUp.taskTitle ?? (followUp.lead !== "-" ? followUp.lead : "Follow-up"),
    companyName: followUp.customer,
    companyId: followUp.companyId ?? customer?.id ?? null,
    description: "",
    notes: followUp.taskNotes ?? "",
    productId: followUp.taskProductId ?? null,
    assignedToId: undefined,
    priorityKey: followUp.taskPriorityKey ?? priorityKeyFromLabel(followUp.priority),
    taskDateIso: followUp.taskDateIso ?? followUp.followUpDateIso,
    reminder: followUp.taskReminder ?? "",
    statusKey: "COMPLETED",
  };
}

function buildEditableQuickViewTaskItem(
  payload: CustomerQuickContextPayload | null,
  intent: CustomerQuickViewIntent | null,
): HeaderQuickEditTaskItem | null {
  const customer = payload?.profileCustomer;
  const history = payload?.history;
  if (!history) return null;

  const matchedTask = intent?.taskId
    ? history.tasks.find((task) => task.id === intent.taskId)
    : undefined;
  const matchedFollowUp = intent?.followUpId
    ? history.followUps.find((followUp) => followUp.id === intent.followUpId)
    : undefined;
  const linkedFollowUp = matchedTask
    ? history.followUps.find((followUp) => followUp.taskId === matchedTask.id)
    : undefined;

  return (
    buildEditableTaskItemFromFollowUp(matchedFollowUp, customer) ??
    buildEditableTaskItemFromFollowUp(linkedFollowUp, customer) ??
    buildEditableTaskItemFromTask(matchedTask, customer) ??
    buildEditableTaskItemFromFollowUp(history.followUps[0], customer) ??
    buildEditableTaskItemFromTask(history.tasks[0], customer)
  );
}

function CustomerQuickSearchModal({
  role,
  customerId,
  payload,
  latestTaskItem,
  loading,
  error,
  onEditTask,
  onNavigate,
  onClose,
}: {
  role: Role;
  customerId: string | null;
  payload: CustomerQuickContextPayload | null;
  latestTaskItem: HeaderQuickEditTaskItem | null;
  loading: boolean;
  error: string | null;
  onEditTask: (item: HeaderQuickEditTaskItem) => void;
  onNavigate: (href: string) => void;
  onClose: () => void;
}) {
  const customer = payload?.profileCustomer;
  const fullProfileHref = customerId ? `/customers/${customerId}` : "";
  const activityHref = customer?.name
    ? `${rolePath(role, "communication")}?activity=${encodeURIComponent(customer.name)}`
    : rolePath(role, "communication");
  const customerAddress = customer?.address && customer.address !== "-"
    ? customer.address
    : customer?.cityOrZilla && customer.cityOrZilla !== "-"
      ? customer.cityOrZilla
      : "-";
  const latestTaskId = payload?.history?.tasks[0]?.id;
  const latestFollowUpId = payload?.history?.followUps[0]?.id;
  const latestTaskHref = latestTaskId ? `${rolePath(role, "tasks")}?editTaskId=${encodeURIComponent(latestTaskId)}` : "";
  const latestFollowUpHref = latestFollowUpId ? `${rolePath(role, "tasks")}?editFollowUpId=${encodeURIComponent(latestFollowUpId)}` : "";

  return (
    <FormModal
      open={Boolean(customerId)}
      title={customer?.name || "Customer quick view"}
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading customer CRM context...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : customer ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Customer Snapshot</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">{customer.name}</h3>
                <p className="mt-2 text-sm font-semibold text-slate-600">{customerAddress}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {payload?.journey?.stageSummary || "Recent communication, follow-up, ar task snapshot ekhane dekhano hocche."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">{payload?.journey?.currentStage || "Profile"}</Badge>
                {payload?.journey?.status ? <StatusBadge value={payload.journey.status} /> : null}
                {payload?.journey?.priority && payload.journey.priority !== "-" ? <Badge variant="warning">{payload.journey.priority} Priority</Badge> : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Last Activity</p>
                <p className="mt-2 text-sm font-black text-slate-950">{payload?.journey?.lastActivity || "No activity yet"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{payload?.journey?.lastActivityTime || "-"}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Next Follow-up</p>
                <p className="mt-2 text-sm font-black text-slate-950">{payload?.journey?.nextFollowUp || "No upcoming follow-up"}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{payload?.journey?.nextFollowUpStatus || "-"}</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Counts</p>
                <div className="mt-2 space-y-2 text-sm font-semibold text-slate-600">
                  <div className="flex items-center justify-between gap-3"><span>Calls / Logs</span><span className="font-black text-slate-950">{payload?.counts?.communications ?? payload?.history?.communications.length ?? 0}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Follow-ups</span><span className="font-black text-slate-950">{payload?.counts?.followUps ?? payload?.history?.followUps.length ?? 0}</span></div>
                  <div className="flex items-center justify-between gap-3"><span>Tasks</span><span className="font-black text-slate-950">{payload?.counts?.tasks ?? payload?.history?.tasks.length ?? 0}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Recent Notes</p>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">Latest communication</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{payload?.history?.communications[0]?.summary || payload?.history?.communications[0]?.notes || "No communication note saved yet."}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">Latest follow-up</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{payload?.history?.followUps[0]?.note || payload?.history?.followUps[0]?.nextDiscussionPlan || "No follow-up note saved yet."}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-500">Latest task</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{payload?.history?.tasks[0]?.notes || payload?.history?.tasks[0]?.description || payload?.history?.tasks[0]?.title || "No task note saved yet."}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Quick Actions</p>
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => onNavigate(`${rolePath(role, "customers")}?editCustomerId=${encodeURIComponent(customerId ?? "")}`)}
                  disabled={!customerId}
                >
                  <CalendarClock className="h-4 w-4" />
                  Edit Customer
                </Button>
                <Button type="button" variant="outline" className="w-full justify-start" onClick={() => onNavigate(fullProfileHref)} disabled={!fullProfileHref}>
                  <Eye className="h-4 w-4" />
                  Full Profile
                </Button>
                <Button type="button" variant="outline" className="w-full justify-start" onClick={() => onNavigate(activityHref)} disabled={!activityHref}>
                  <MessageSquare className="h-4 w-4" />
                  Activity Log
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    if (latestTaskItem) {
                      onEditTask(latestTaskItem);
                      return;
                    }
                    onNavigate(latestFollowUpHref);
                  }}
                  disabled={!latestTaskItem && !latestFollowUpHref}
                >
                  <CalendarClock className="h-4 w-4" />
                  Edit Follow-up
                </Button>
                <Button type="button" variant="outline" className="w-full justify-start" onClick={() => onNavigate(latestTaskHref)} disabled={!latestTaskHref}>
                  <CalendarClock className="h-4 w-4" />
                  Edit Task
                </Button>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <p><span className="font-bold text-slate-900">Phone:</span> {customer.phone || "-"}</p>
                <p className="mt-1"><span className="font-bold text-slate-900">Email:</span> {customer.email || "-"}</p>
                <p className="mt-1"><span className="font-bold text-slate-900">Address:</span> {customerAddress}</p>
                <p className="mt-1"><span className="font-bold text-slate-900">Assigned:</span> {customer.assignedTo || "-"}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
          Customer details are not available right now.
        </div>
      )}
    </FormModal>
  );
}

const activitySearchSuggestions = ["Call", "Demo", "Follow-up", "Quotation", "Win", "Lost"] as const;

function activitySearchBadgeVariant(category?: string) {
  if (category === "CALL") return "warning" as const;
  if (category === "FOLLOW_UP") return "violet" as const;
  if (category === "QUOTATION") return "success" as const;
  if (category === "LEAD") return "default" as const;
  return "neutral" as const;
}

function activitySearchBadgeVariantFromItem(item: Pick<ActivitySearchResultRow, "category" | "badgeLabel">) {
  const badge = item.badgeLabel?.toUpperCase() ?? "";

  if (badge === "CALL") return "warning" as const;
  if (badge === "DEMO") return "violet" as const;
  if (badge === "FOLLOW-UP") return "violet" as const;
  if (badge === "QUOTATION") return "success" as const;
  if (badge === "WIN") return "success" as const;
  if (badge === "LOST") return "danger" as const;

  return activitySearchBadgeVariant(item.category);
}

export function AppHeader({
  role,
  user,
  unreadCount = 0,
  onOpenSidebar,
}: {
  role: Role;
  user: ShellUser;
  unreadCount?: number;
  onOpenSidebar: () => void;
}) {
  const router = useRouter();
  const {
    notifications,
    loading,
    markNotificationRead,
    markAllNotificationsRead,
  } = useNotificationCenterContext();
  const [open, setOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [searchResults, setSearchResults] = React.useState<ActivitySearchResultRow[]>([]);
  const [customerSearchMatches, setCustomerSearchMatches] = React.useState<CustomerLookupRow[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [customerQuickViewId, setCustomerQuickViewId] = React.useState<string | null>(null);
  const [customerQuickView, setCustomerQuickView] = React.useState<CustomerQuickContextPayload | null>(null);
  const [customerQuickViewLoading, setCustomerQuickViewLoading] = React.useState(false);
  const [customerQuickViewError, setCustomerQuickViewError] = React.useState<string | null>(null);
  const [customerQuickViewRefreshKey, setCustomerQuickViewRefreshKey] = React.useState(0);
  const [customerQuickViewIntent, setCustomerQuickViewIntent] = React.useState<CustomerQuickViewIntent | null>(null);
  const [editingTask, setEditingTask] = React.useState<HeaderQuickEditTaskItem | null>(null);
  const [quickEditProducts, setQuickEditProducts] = React.useState<Array<{ id: string; name: string }>>([]);
  const searchRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const notificationRef = React.useRef<HTMLDivElement | null>(null);
  const dropdownPanelRef = React.useRef<HTMLDivElement | null>(null);
  const profileRef = React.useRef<HTMLDivElement | null>(null);
  const profileButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const profilePanelRef = React.useRef<HTMLDivElement | null>(null);
  const [profilePanelStyle, setProfilePanelStyle] = React.useState({
    top: 0,
    left: 0,
    width: 296,
    maxHeight: 320,
  });

  function handleLogout() {
    document.cookie = "crm_role=; path=/; max-age=0";
    document.cookie = "crm_mobile=; path=/; max-age=0";
    window.location.assign("/login");
  }

  const trimmedSearchQuery = searchQuery.trim();
  const communicationSearchHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (trimmedSearchQuery) params.set("activity", trimmedSearchQuery);
    const queryString = params.toString();
    return `${rolePath(role, "communication")}${queryString ? `?${queryString}` : ""}`;
  }, [role, trimmedSearchQuery]);

  const resetCustomerQuickViewState = React.useCallback(() => {
    setCustomerQuickViewId(null);
    setCustomerQuickView(null);
    setCustomerQuickViewLoading(false);
    setCustomerQuickViewError(null);
    setCustomerQuickViewRefreshKey(0);
    setCustomerQuickViewIntent(null);
  }, []);

  const openCustomerQuickView = React.useCallback((customerId: string, intent: CustomerQuickViewIntent = { mode: "snapshot" }) => {
    setSearchOpen(false);
    setOpen(false);
    setProfileOpen(false);
    setEditingTask(null);
    setCustomerQuickView(null);
    setCustomerQuickViewError(null);
    setCustomerQuickViewIntent(intent);
    setCustomerQuickViewRefreshKey(0);
    setCustomerQuickViewId(customerId);
  }, []);

  const closeCustomerQuickView = React.useCallback(() => {
    setEditingTask(null);
    resetCustomerQuickViewState();
  }, [resetCustomerQuickViewState]);

  const navigateFromQuickView = React.useCallback((href: string) => {
    if (!href) return;
    closeCustomerQuickView();
    router.push(href);
  }, [closeCustomerQuickView, router]);

  const openCustomerQuickViewFromQuery = React.useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return false;

    try {
      const params = new URLSearchParams({
        search: trimmedQuery,
        limit: "8",
      });
      const response = await fetch(`/api/customers/list?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json() as {
        success?: boolean;
        rows?: CustomerLookupRow[];
        message?: string;
      };

      if (!response.ok || !payload.success || !Array.isArray(payload.rows)) {
        return false;
      }

      const match = pickBestCustomerMatch(trimmedQuery, payload.rows);
      if (!match?.id) return false;

      openCustomerQuickView(match.id, { mode: "direct-edit" });
      return true;
    } catch {
      return false;
    }
  }, [openCustomerQuickView]);

  const updateProfilePanelPosition = React.useCallback(() => {
    if (!profileButtonRef.current || typeof window === "undefined") return;

    const viewportPadding = 12;
    const gap = 10;
    const triggerRect = profileButtonRef.current.getBoundingClientRect();
    const preferredWidth = Math.min(320, window.innerWidth - viewportPadding * 2);
    const measuredHeight = profilePanelRef.current?.offsetHeight ?? 240;
    const availableBelow = window.innerHeight - triggerRect.bottom - gap - viewportPadding;
    const availableAbove = triggerRect.top - gap - viewportPadding;
    const placeAbove = availableBelow < Math.min(measuredHeight, 220) && availableAbove > availableBelow;
    const maxHeight = Math.max(180, Math.min(360, placeAbove ? availableAbove : availableBelow));
    const resolvedHeight = Math.min(measuredHeight, maxHeight);
    const top = placeAbove
      ? Math.max(viewportPadding, triggerRect.top - gap - resolvedHeight)
      : Math.min(window.innerHeight - viewportPadding - resolvedHeight, triggerRect.bottom + gap);
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.right - preferredWidth),
      window.innerWidth - preferredWidth - viewportPadding,
    );

    setProfilePanelStyle({
      top,
      left,
      width: preferredWidth,
      maxHeight,
    });
  }, []);

  React.useEffect(() => {
    if (!open || !dropdownPanelRef.current) return;

    gsap.fromTo(
      dropdownPanelRef.current,
      { y: -8, autoAlpha: 0, scale: 0.98 },
      { y: 0, autoAlpha: 1, scale: 1, duration: 0.2, ease: "power2.out", clearProps: "transform,opacity,visibility" },
    );
  }, [open]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node) &&
        !(profilePanelRef.current?.contains(event.target as Node) ?? false)
      ) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setOpen(false);
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  React.useEffect(() => {
    if (!profileOpen) return;

    const frame = window.requestAnimationFrame(() => {
      updateProfilePanelPosition();
    });
    const handleViewportChange = () => {
      updateProfilePanelPosition();
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [profileOpen, updateProfilePanelPosition]);

  React.useEffect(() => {
    const query = deferredSearchQuery.trim();

    if (!searchOpen || !query) {
      const frame = window.requestAnimationFrame(() => {
        setSearchResults([]);
        setCustomerSearchMatches([]);
        setSearchLoading(false);
        setSearchError(null);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError(null);
        const activityParams = new URLSearchParams({
          q: query,
          limit: "8",
        });
        const customerParams = new URLSearchParams({
          search: query,
          limit: "6",
        });

        const [activityResult, customerResult] = await Promise.allSettled([
          fetch(`/api/search/activities?${activityParams.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/api/customers/list?${customerParams.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        let activityRows: ActivitySearchResultRow[] = [];
        let customerRows: CustomerLookupRow[] = [];
        let activityError: string | null = null;
        let customerError: string | null = null;

        if (activityResult.status === "fulfilled") {
          const payload = await activityResult.value.json() as {
            success?: boolean;
            message?: string;
            rows?: ActivitySearchResultRow[];
          };

          if (!activityResult.value.ok || !payload.success) {
            activityError = payload.message ?? "Activity search failed.";
          } else {
            activityRows = Array.isArray(payload.rows) ? payload.rows : [];
          }
        } else if (!controller.signal.aborted) {
          activityError = "Activity search failed.";
        }

        if (customerResult.status === "fulfilled") {
          const payload = await customerResult.value.json() as {
            success?: boolean;
            message?: string;
            rows?: CustomerLookupRow[];
          };

          if (!customerResult.value.ok || !payload.success) {
            customerError = payload.message ?? "Customer search failed.";
          } else {
            customerRows = Array.isArray(payload.rows) ? payload.rows : [];
          }
        } else if (!controller.signal.aborted) {
          customerError = "Customer search failed.";
        }

        React.startTransition(() => {
          setSearchResults(activityRows);
          setCustomerSearchMatches(customerRows);
        });

        if (activityError && customerError) {
          setSearchError(activityError);
        } else {
          setSearchError(null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setCustomerSearchMatches([]);
        setSearchError(error instanceof Error ? error.message : "Activity search failed.");
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredSearchQuery, searchOpen]);

  React.useEffect(() => {
    if (!customerQuickViewId) return;

    const controller = new AbortController();
    const load = async () => {
      try {
        setCustomerQuickViewLoading(true);
        setCustomerQuickViewError(null);
        const response = await fetch(`/api/customers/${customerQuickViewId}?includeHistory=1`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as CustomerQuickContextPayload;

        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? "Failed to load customer details.");
        }

        setCustomerQuickView(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCustomerQuickView(null);
        setCustomerQuickViewError(error instanceof Error ? error.message : "Failed to load customer details.");
      } finally {
        if (!controller.signal.aborted) {
          setCustomerQuickViewLoading(false);
        }
      }
    };

    void load();
    return () => controller.abort();
  }, [customerQuickViewId, customerQuickViewRefreshKey]);

  React.useEffect(() => {
    if (!editingTask) return;

    const controller = new AbortController();
    const loadProducts = async () => {
      try {
        const response = await fetch("/api/products", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as {
          success?: boolean;
          rows?: Array<{ id?: string; name?: string }>;
        };
        if (!response.ok || !payload.success || !Array.isArray(payload.rows)) return;
        setQuickEditProducts(payload.rows
          .filter((row): row is { id: string; name: string } => typeof row.id === "string" && typeof row.name === "string")
          .map((row) => ({ id: row.id, name: row.name })));
      } catch {
        // keep previous product choices if the quick lookup temporarily fails
      }
    };

    void loadProducts();
    return () => controller.abort();
  }, [editingTask]);

  const quickViewTaskItem = React.useMemo(
    () => buildEditableQuickViewTaskItem(customerQuickView, customerQuickViewIntent),
    [customerQuickView, customerQuickViewIntent],
  );
  const showCustomerQuickViewModal = Boolean(customerQuickViewId)
    && (
      customerQuickViewIntent?.mode !== "direct-edit"
      || Boolean(customerQuickViewError)
      || (!customerQuickViewLoading && !quickViewTaskItem)
    );

  React.useEffect(() => {
    if (customerQuickViewIntent?.mode !== "direct-edit") return;
    if (customerQuickViewLoading || customerQuickViewError || !quickViewTaskItem) return;

    const frame = window.requestAnimationFrame(() => {
      setEditingTask(quickViewTaskItem);
      resetCustomerQuickViewState();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    customerQuickViewError,
    customerQuickViewIntent,
    customerQuickViewLoading,
    quickViewTaskItem,
    resetCustomerQuickViewState,
  ]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="flex min-h-14 items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:min-h-16 lg:px-6">
        <Button type="button" variant="outline" size="icon" className="lg:hidden" onClick={onOpenSidebar} aria-label="Open sidebar">
          <Menu className="h-4 w-4" />
        </Button>

        <div ref={searchRef} className="relative hidden flex-1 md:block">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setSearchQuery(nextQuery);
                if (!nextQuery.trim()) {
                  setSearchResults([]);
                  setSearchLoading(false);
                  setSearchError(null);
                }
                setSearchOpen(true);
              }}
              onFocus={() => {
                setOpen(false);
                setProfileOpen(false);
                setSearchOpen(true);
              }}
              onKeyDown={async (event) => {
                if (event.key === "Escape") {
                  setSearchOpen(false);
                  return;
                }

                if (event.key === "Enter" && trimmedSearchQuery) {
                  event.preventDefault();
                  const bestCustomerMatch = pickBestCustomerMatch(trimmedSearchQuery, customerSearchMatches);
                  if (bestCustomerMatch?.id) {
                    openCustomerQuickView(bestCustomerMatch.id, { mode: "direct-edit" });
                    return;
                  }
                  const topCustomerMatch = searchResults.find((item) => item.customerId);
                  if (topCustomerMatch?.customerId) {
                    openCustomerQuickView(topCustomerMatch.customerId, {
                      mode: "direct-edit",
                      taskId: topCustomerMatch.taskId,
                      followUpId: topCustomerMatch.followUpId,
                    });
                    return;
                  }
                  const openedFromQuery = await openCustomerQuickViewFromQuery(trimmedSearchQuery);
                  if (openedFromQuery) {
                    return;
                  }
                  setSearchOpen(false);
                  router.push(communicationSearchHref);
                }
              }}
              className="pl-9 pr-10"
              placeholder="Search company, phone number, call, follow-up, quotation..."
            />
            {searchQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSearchLoading(false);
                  setSearchError(null);
                  setSearchOpen(true);
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <AnimatePresence>
            {searchOpen ? (
              <motion.div
                key="activity-search-dropdown"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(92vw,640px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.14)]"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">Live Activity Search</p>
                      <p className="text-xs text-slate-500">Search by company, phone, call, follow-up, quotation, win, or lost and jump into history or edit.</p>
                    </div>
                    <Badge variant="neutral" className="shrink-0">
                      {trimmedSearchQuery ? "Live" : "Keywords"}
                    </Badge>
                  </div>
                </div>

                {!trimmedSearchQuery ? (
                  <div className="p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Quick Search</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activitySearchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setSearchQuery(suggestion);
                            setSearchOpen(true);
                            searchInputRef.current?.focus();
                          }}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <p className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-xs font-medium text-slate-500">
                      Type a company name, phone number, or keywords like <span className="font-bold text-slate-700">call</span>, <span className="font-bold text-slate-700">follow-up</span>, <span className="font-bold text-slate-700">quotation</span>, <span className="font-bold text-slate-700">win</span>, or <span className="font-bold text-slate-700">lost</span>.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {searchLoading ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">Searching live CRM activities...</div>
                    ) : searchError ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm font-semibold text-red-700">{searchError}</div>
                    ) : searchResults.length || customerSearchMatches.length ? (
                      <div className="space-y-1.5">
                        {customerSearchMatches.length ? (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-2">
                            <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
                              Matching Companies
                            </p>
                            <div className="space-y-1.5">
                              {customerSearchMatches.map((item) => {
                                const searchMatchAddress = item.address?.trim() || item.cityOrZilla?.trim() || "";

                                return (
                                  <button
                                    key={`customer-match:${item.id}`}
                                    type="button"
                                    onClick={() => openCustomerQuickView(item.id, { mode: "direct-edit" })}
                                    className="block w-full rounded-2xl border border-transparent bg-white px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="truncate text-sm font-bold text-slate-900">{item.companyName}</p>
                                          <Badge variant="default">Quick View</Badge>
                                        </div>
                                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                          {[item.contactPerson, item.phone].filter(Boolean).join(" • ") || "Open customer popup with history, task, and follow-up context"}
                                        </p>
                                        {searchMatchAddress ? (
                                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                                            {searchMatchAddress}
                                          </p>
                                        ) : null}
                                      </div>
                                      <span className="shrink-0 text-xs font-bold text-blue-600">Open popup</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {searchResults.map((item) => (
                          item.customerId ? (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openCustomerQuickView(item.customerId!, {
                                mode: "direct-edit",
                                taskId: item.taskId,
                                followUpId: item.followUpId,
                              })}
                              className="block w-full rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                                    <Badge variant={activitySearchBadgeVariantFromItem(item)}>{item.badgeLabel}</Badge>
                                  </div>
                                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                    {item.customerName} • Quick customer view
                                  </p>
                                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                                    {item.discussionSummary || item.detail}
                                  </p>
                                </div>
                                <span className="shrink-0 text-[11px] font-semibold text-slate-400">{item.time}</span>
                              </div>
                            </button>
                          ) : (
                            <Link
                            key={item.id}
                            href={item.actionHref ?? item.href ?? communicationSearchHref}
                            onClick={() => setSearchOpen(false)}
                            className="block rounded-2xl border border-transparent px-3 py-3 transition hover:border-blue-200 hover:bg-blue-50/60"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                                  <Badge variant={activitySearchBadgeVariantFromItem(item)}>{item.badgeLabel}</Badge>
                                </div>
                                <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                  {item.customerName} • {item.employeeName}
                                </p>
                                <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                                  {item.discussionSummary || item.detail}
                                </p>
                              </div>
                              <span className="shrink-0 text-[11px] font-semibold text-slate-400">{item.time}</span>
                            </div>
                            </Link>
                          )
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
                        <p className="text-sm font-bold text-slate-700">No matching activity found</p>
                        <p className="mt-1 text-xs text-slate-500">Try a company name, phone number, or another keyword like call, quotation, win, or lost.</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-slate-100 px-4 py-3">
                  <Link
                    href={communicationSearchHref}
                    onClick={() => setSearchOpen(false)}
                    className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-800 hover:underline"
                  >
                    View all matching activities
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Badge variant="neutral" className="hidden sm:inline-flex">
            {formatCrmDate(new Date(), "dd MMM yyyy")}
          </Badge>
          <Badge variant="default" className="hidden md:inline-flex">
            {roleLabels[role]}
          </Badge>

          <div ref={notificationRef} className="relative">
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Notifications"
                onClick={() => {
                  setSearchOpen(false);
                  setOpen((value) => !value);
                }}
                className={cn(open ? "border-blue-200 bg-blue-50 text-blue-700" : "")}
              >
                <Bell className="h-4 w-4" />
              </Button>
            </motion.div>
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}

            <AnimatePresence>
              {open ? (
                <motion.div
                  key="notification-dropdown"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16 }}
                  ref={dropdownPanelRef}
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,360px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.14)]"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">Notifications</p>
                      <p className="text-xs text-slate-500">{unreadCount ? `${unreadCount} unread updates` : "No new notifications"}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-xl px-2.5 text-xs"
                      onClick={async () => {
                        await markAllNotificationsRead();
                      }}
                      disabled={!unreadCount}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark all as read
                    </Button>
                  </div>

                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {loading && !notifications.length ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">Loading notifications...</div>
                    ) : notifications.length ? (
                      <div className="space-y-1.5">
                        {notifications.map((item) => (
                          <motion.div key={item.id} layout whileHover={{ y: -1 }}>
                            <Link
                              href={item.href}
                              onClick={async () => {
                                if (!item.read) {
                                  await markNotificationRead(item.id);
                                }
                                setOpen(false);
                              }}
                              className={cn(
                                "flex gap-3 rounded-2xl border px-3 py-3 transition",
                                item.read ? "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50" : "border-blue-100 bg-blue-50/70 hover:border-blue-200 hover:bg-blue-50",
                              )}
                            >
                              <span className={cn(
                                "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
                                item.read ? "bg-slate-100 text-slate-500" : "bg-white text-blue-700 shadow-sm",
                              )}>
                                <Bell className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.message}</p>
                                  </div>
                                  {!item.read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" /> : null}
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <span className="text-[11px] font-semibold text-slate-500">{item.type}</span>
                                  <span className="text-[11px] font-semibold text-slate-400">{item.createdAt}</span>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
                        <p className="text-sm font-bold text-slate-700">No new notifications</p>
                        <p className="mt-1 text-xs text-slate-500">Task, follow-up, and completion alerts will show here.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
            <Link href={notificationPageHref(role)}>
              <Button type="button" variant="outline" size="icon" aria-label="Messages" className="relative">
                <MessageSquare className="h-4 w-4" />
                {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" /> : null}
              </Button>
            </Link>
          </motion.div>

          <div ref={profileRef} className="relative">
            <motion.button
              ref={profileButtonRef}
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 shadow-sm sm:h-10"
              aria-expanded={profileOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setOpen(false);
                setSearchOpen(false);
                setProfileOpen((value) => !value);
              }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                {initials(user.name)}
              </span>
              <span className="hidden max-w-28 truncate lg:block">{user.name}</span>
            </motion.button>
            <AnimatePresence>
              {profileOpen ? (
                <motion.div
                  ref={profilePanelRef}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.14 }}
                  style={profilePanelStyle}
                  className="fixed z-[70] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.16)]"
                >
                  <div className="max-h-full overflow-y-auto p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">{user.name}</p>
                        <p className="truncate text-xs text-slate-500">{user.email ?? user.mobile ?? roleLabels[role]}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                      Signed in as {roleLabels[role]}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={handleLogout} className="h-9 gap-2 px-2.5 sm:h-10 sm:px-3" aria-label="Logout">
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Logout</span>
          </Button>
        </div>
      </div>
      {showCustomerQuickViewModal ? (
        <CustomerQuickSearchModal
          role={role}
          customerId={customerQuickViewId}
          payload={customerQuickView}
          latestTaskItem={quickViewTaskItem}
          loading={customerQuickViewLoading}
          error={customerQuickViewError}
          onEditTask={setEditingTask}
          onNavigate={navigateFromQuickView}
          onClose={closeCustomerQuickView}
        />
      ) : null}
      <TaskCreateModal
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onCreated={() => {
          setCustomerQuickViewRefreshKey((current) => current + 1);
        }}
        onDeleted={() => {
          setCustomerQuickViewRefreshKey((current) => current + 1);
        }}
        role="MARKETER"
        workspace={{
          user: {
            id: user.id ?? "",
            name: user.name,
            email: user.email ?? "",
            mobile: user.mobile ?? "",
            role: user.role,
            designation: user.designation ?? "",
          },
          employees: [],
          products: quickEditProducts,
        }}
        initialTask={editingTask}
      />
    </header>
  );
}

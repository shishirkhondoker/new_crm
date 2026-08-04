"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";
import { cn, roleLabels, type Role, type ShellUser } from "@/lib/utils";
import type { CrmWorkspace } from "@/lib/crm-data";

type SidebarCounts = Pick<CrmWorkspace, "sidebarCounts">["sidebarCounts"];

type TaskCounterContextValue = {
  taskCount: number;
  leadCount: number;
  customerCount: number;
  coldCustomerCount: number;
  refreshTaskCount: () => Promise<void>;
  refreshLeadCount: () => Promise<void>;
  refreshCustomerCount: () => Promise<void>;
  refreshColdCustomerCount: () => Promise<void>;
};

const TaskCounterContext = React.createContext<TaskCounterContextValue | null>(null);

export type HeaderNotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  href: string;
  read: boolean;
  createdAt: string;
};

type NotificationCenterContextValue = {
  notifications: HeaderNotificationItem[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
};

const NotificationCenterContext = React.createContext<NotificationCenterContextValue | null>(null);

export const CRM_LIVE_SYNC_EVENT = "crm:live-sync";

function parseTaskCount(payload: unknown) {
  const rows = typeof payload === "object" && payload !== null ? (payload as { rows?: unknown }).rows : undefined;
  if (!Array.isArray(rows)) return 0;
  return rows.length;
}

function parseLeadCount(payload: unknown) {
  const total = typeof payload === "object" && payload !== null ? (payload as { total?: unknown }).total : undefined;
  const parsed = Number(total);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

function parseColdCustomerCount(payload: unknown) {
  const rows = typeof payload === "object" && payload !== null ? (payload as { rows?: unknown }).rows : undefined;
  if (!Array.isArray(rows)) return 0;
  return rows.length;
}

function parseCustomerCount(payload: unknown) {
  const summary = typeof payload === "object" && payload !== null ? (payload as { summary?: unknown }).summary : undefined;
  const count = typeof summary === "object" && summary !== null ? (summary as { count?: unknown }).count : undefined;
  const parsed = Number(count);
  if (Number.isFinite(parsed) && parsed >= 0) return Math.trunc(parsed);

  const rows = typeof payload === "object" && payload !== null ? (payload as { rows?: unknown }).rows : undefined;
  return Array.isArray(rows) ? rows.length : 0;
}

function useSidebarCounterSync(
  sidebarTaskCount: number | undefined,
  sidebarLeadCount: number | undefined,
  sidebarCustomerCount: number | undefined,
  sidebarColdCustomerCount: number | undefined,
) {
  const [taskCount, setTaskCount] = React.useState(sidebarTaskCount ?? 0);
  const [leadCount, setLeadCount] = React.useState(sidebarLeadCount ?? 0);
  const [customerCount, setCustomerCount] = React.useState(sidebarCustomerCount ?? 0);
  const [coldCustomerCount, setColdCustomerCount] = React.useState(sidebarColdCustomerCount ?? 0);

  const refreshTaskCount = React.useCallback(async () => {
    try {
      const response = await fetch("/api/tasks/today", { cache: "no-store" });
      if (!response.ok) return;

      const payload = await response.json();
      setTaskCount(parseTaskCount(payload));
    } catch {
      // keep the previous count if the endpoint temporarily fails
    }
  }, []);

  const refreshLeadCount = React.useCallback(async () => {
    try {
      const response = await fetch("/api/leads?page=1&pageSize=1", { cache: "no-store" });
      if (!response.ok) return;

      const payload = await response.json();
      setLeadCount(parseLeadCount(payload));
    } catch {
      // keep the previous count if the endpoint temporarily fails
    }
  }, []);

  const refreshCustomerCount = React.useCallback(async () => {
    try {
      const response = await fetch("/api/customers", { cache: "no-store" });
      if (!response.ok) return;

      const payload = await response.json();
      setCustomerCount(parseCustomerCount(payload));
    } catch {
      // keep the previous count if the endpoint temporarily fails
    }
  }, []);

  const refreshColdCustomerCount = React.useCallback(async () => {
    try {
      const response = await fetch("/api/customers/cold", { cache: "no-store" });
      if (!response.ok) return;

      const payload = await response.json();
      setColdCustomerCount(parseColdCustomerCount(payload));
    } catch {
      // keep the previous count if the endpoint temporarily fails
    }
  }, []);

  React.useEffect(() => {
    setTaskCount(sidebarTaskCount ?? 0);
  }, [sidebarTaskCount]);

  React.useEffect(() => {
    setLeadCount(sidebarLeadCount ?? 0);
  }, [sidebarLeadCount]);

  React.useEffect(() => {
    setCustomerCount(sidebarCustomerCount ?? 0);
  }, [sidebarCustomerCount]);

  React.useEffect(() => {
    setColdCustomerCount(sidebarColdCustomerCount ?? 0);
  }, [sidebarColdCustomerCount]);

  React.useEffect(() => {
    if (sidebarTaskCount === undefined) {
      void refreshTaskCount();
    }
    if (sidebarLeadCount === undefined) {
      void refreshLeadCount();
    }
    if (sidebarCustomerCount === undefined) {
      void refreshCustomerCount();
    }
    if (sidebarColdCustomerCount === undefined) {
      void refreshColdCustomerCount();
    }
  }, [refreshColdCustomerCount, refreshCustomerCount, refreshLeadCount, refreshTaskCount, sidebarColdCustomerCount, sidebarCustomerCount, sidebarLeadCount, sidebarTaskCount]);

  return {
    taskCount,
    leadCount,
    customerCount,
    coldCustomerCount,
    refreshTaskCount,
    refreshLeadCount,
    refreshCustomerCount,
    refreshColdCustomerCount,
  };
}

function useNotificationCenter(initialUnreadCount: number) {
  const [notifications, setNotifications] = React.useState<HeaderNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
  const [loading, setLoading] = React.useState(false);

  const refreshNotifications = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as {
        success?: boolean;
        rows?: HeaderNotificationItem[];
        unreadCount?: number;
      };

      setNotifications(Array.isArray(payload.rows) ? payload.rows : []);
      setUnreadCount(typeof payload.unreadCount === "number" ? payload.unreadCount : 0);
    } catch {
      // keep current state on temporary failure
    } finally {
      setLoading(false);
    }
  }, []);

  const markNotificationRead = React.useCallback(async (id: string) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        await refreshNotifications();
      }
    } catch {
      await refreshNotifications();
    }
  }, [refreshNotifications]);

  const markAllNotificationsRead = React.useCallback(async () => {
    const previous = notifications;
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });
      if (!response.ok) {
        setNotifications(previous);
        setUnreadCount(previous.filter((item) => !item.read).length);
      }
    } catch {
      setNotifications(previous);
      setUnreadCount(previous.filter((item) => !item.read).length);
    }
  }, [notifications]);

  React.useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  React.useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  };
}

export function useTaskCounterContext() {
  const context = React.useContext(TaskCounterContext);
  if (!context) {
    return {
      taskCount: 0,
      leadCount: 0,
      customerCount: 0,
      coldCustomerCount: 0,
      refreshTaskCount: async () => {},
      refreshLeadCount: async () => {},
      refreshCustomerCount: async () => {},
      refreshColdCustomerCount: async () => {},
    } as TaskCounterContextValue;
  }

  return context;
}

export function useNotificationCenterContext() {
  const context = React.useContext(NotificationCenterContext);
  if (!context) {
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      refreshNotifications: async () => {},
      markNotificationRead: async () => {},
      markAllNotificationsRead: async () => {},
    } satisfies NotificationCenterContextValue;
  }

  return context;
}

function fallbackUser(role: Role): ShellUser {
  return {
    name: roleLabels[role],
    role,
    designation: roleLabels[role],
  };
}

export function AppShell({
  role,
  user,
  unreadCount = 0,
  followUpCount = 0,
  sidebarCounts,
  children,
}: {
  role: Role;
  user?: ShellUser;
  unreadCount?: number;
  followUpCount?: number;
  sidebarCounts?: SidebarCounts;
  children: ReactNode;
}) {
  const {
    taskCount,
    leadCount,
    customerCount,
    coldCustomerCount,
    refreshTaskCount,
    refreshLeadCount,
    refreshCustomerCount,
    refreshColdCustomerCount,
  } = useSidebarCounterSync(
    sidebarCounts?.tasks,
    sidebarCounts?.leads,
    sidebarCounts?.customers,
    sidebarCounts?.coldCustomers,
  );
  const notificationCenter = useNotificationCenter(unreadCount);
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const shellUser = user ?? fallbackUser(role);
  const liveSyncEnabled = role !== "MARKETER";
  const refreshNotifications = notificationCenter.refreshNotifications;
  const counts = React.useMemo(() => {
    if (!sidebarCounts) {
      return {
        followUps: 0,
        leads: leadCount,
        customers: customerCount,
        coldCustomers: coldCustomerCount,
        tasks: taskCount,
        todaysPlan: 0,
        products: 0,
        rewards: 0,
      };
    }

    return {
      ...sidebarCounts,
      leads: leadCount,
      tasks: taskCount,
      customers: customerCount,
      coldCustomers: coldCustomerCount,
    };
  }, [coldCustomerCount, customerCount, leadCount, sidebarCounts, taskCount]);

  const performLiveSync = React.useCallback((reason: "focus" | "visible") => {
    window.dispatchEvent(new CustomEvent(CRM_LIVE_SYNC_EVENT, { detail: { reason, at: Date.now() } }));
    void refreshTaskCount();
    void refreshLeadCount();
    void refreshCustomerCount();
    void refreshColdCustomerCount();
    void refreshNotifications();
  }, [refreshColdCustomerCount, refreshCustomerCount, refreshLeadCount, refreshNotifications, refreshTaskCount]);

  React.useEffect(() => {
    if (!liveSyncEnabled) return;

    const syncIfVisible = (reason: "focus" | "visible") => {
      if (document.visibilityState !== "visible") return;
      window.setTimeout(() => performLiveSync(reason), 0);
    };

    const handleFocus = () => syncIfVisible("focus");
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncIfVisible("visible");
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [liveSyncEnabled, performLiveSync]);

  return (
    <TaskCounterContext.Provider
      value={{
        taskCount,
        leadCount,
        customerCount,
        coldCustomerCount,
        refreshTaskCount,
        refreshLeadCount,
        refreshCustomerCount,
        refreshColdCustomerCount,
      }}
    >
      <NotificationCenterContext.Provider value={notificationCenter}>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
          <AppSidebar
            role={role}
            collapsed={collapsed}
            followUpCount={followUpCount}
            sidebarCounts={counts}
          />
        </div>

        <button
          type="button"
          className={cn(
            "fixed top-1/2 z-50 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-[#0d2a6d] text-white shadow-lg transition-[left,background-color] duration-300 hover:bg-[#16398d] lg:inline-flex",
            "items-center justify-center",
            collapsed ? "left-[82px]" : "left-[248px]",
          )}
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        <AnimatePresence>
          {mobileOpen ? (
          <motion.div
            key="mobile-sidebar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ x: -24, opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0.9 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="h-full w-[min(84vw,280px)]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#0d2a6d] text-white shadow-lg hover:bg-[#16398d]"
                onClick={() => setMobileOpen(false)}
                aria-label="Close sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <AppSidebar
                role={role}
                collapsed={false}
                followUpCount={followUpCount}
                sidebarCounts={counts}
                onNavigate={() => setMobileOpen(false)}
              />
            </motion.div>
          </motion.div>
          ) : null}
        </AnimatePresence>

        <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[82px]" : "lg:pl-[248px]")}>
          <AppHeader role={role} user={shellUser} unreadCount={notificationCenter.unreadCount} onOpenSidebar={() => setMobileOpen(true)} />
          <main
            className="w-full min-w-0 max-w-none space-y-4 px-3 py-4 sm:px-4 sm:py-5 md:space-y-5 md:px-5 lg:px-6 lg:py-6 xl:px-8 2xl:px-10"
          >
            {children}
          </main>
        </div>
      </div>
      </NotificationCenterContext.Provider>
    </TaskCounterContext.Provider>
  );
}

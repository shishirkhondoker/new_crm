"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { isActiveRoute, sidebarMenus } from "@/lib/navigation";
import { cn, type Role } from "@/lib/utils";
import type { CrmWorkspace } from "@/lib/crm-data";

type SidebarCounts = Pick<CrmWorkspace, "sidebarCounts">["sidebarCounts"];
type SidebarMenuItem = (typeof sidebarMenus)[Role][number];

const sidebarGroupOrder = [
  { title: "", labels: ["Dashboard"] },
  { title: "CORE WORKFLOW", labels: ["Today's Task", "Completed Tasks", "Follow-ups"] },
  { title: "SALES CRM", labels: ["Products", "Customers", "Cold Customers", "Leads"] },
  { title: "COMMUNICATION", labels: ["Communication", "Suggestions"] },
  { title: "TEAM", labels: ["Team"] },
  { title: "ANALYTICS", labels: ["Reports"] },
  { title: "ADMIN", labels: ["Users", "Roles & Permissions"] },
  { title: "INCENTIVE", labels: ["Rewards"] },
];

function groupSidebarItems(items: SidebarMenuItem[]) {
  const groupedLabels = new Set(sidebarGroupOrder.flatMap((group) => group.labels));
  const groups = sidebarGroupOrder
    .map((group) => ({
      title: group.title,
      items: group.labels
        .map((label) => items.find((item) => item.label === label))
        .filter((item): item is SidebarMenuItem => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0);

  const extraItems = items.filter((item) => !groupedLabels.has(item.label));
  if (!extraItems.length) return groups;

  const incentiveIndex = groups.findIndex((group) => group.title === "INCENTIVE");
  const extraGroup = { title: "MORE", items: extraItems };

  if (incentiveIndex === -1) return [...groups, extraGroup];
  return [...groups.slice(0, incentiveIndex), extraGroup, ...groups.slice(incentiveIndex)];
}

export function AppSidebar({
  role,
  collapsed,
  followUpCount = 0,
  onNavigate,
  sidebarCounts,
}: {
  role: Role;
  collapsed: boolean;
  followUpCount?: number;
  onNavigate?: () => void;
  sidebarCounts?: SidebarCounts;
}) {
  const pathname = usePathname();
  const counts = sidebarCounts ?? {
    followUps: followUpCount,
    leads: 0,
    customers: 0,
    coldCustomers: 0,
    tasks: 0,
    completedTasks: 0,
    todaysPlan: 0,
    products: 0,
    rewards: 0,
    suggestions: 0,
  };

  const badgeValue = (label: string) => {
    if (label === "Follow-ups") return counts.followUps;
    if (label === "Leads") return counts.leads;
    if (label === "Customers" || label === "Customers/Companies") return counts.customers;
    if (label === "Cold Customers") return counts.coldCustomers;
    if (label === "Today's Task" || label === "Tasks") return counts.tasks;
    if (label === "Completed Tasks") return counts.completedTasks;
    if (label === "Products" || label === "Products/Services") return counts.products;
    if (label === "Rewards") return counts.rewards;
    if (label === "Suggestions") return counts.suggestions;
    return undefined;
  };

  const shouldShowBadge = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && !Number.isNaN(value) && value > 0;

  const formatCount = (value: number | null | undefined) => {
    if (!shouldShowBadge(value)) return undefined;
    const normalizedValue = Math.trunc(value);
    return String(normalizedValue);
  };
  const navGroups = groupSidebarItems(sidebarMenus[role]);

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col overflow-visible bg-[linear-gradient(180deg,#071433_0%,#0A1B47_46%,#071024_100%)] text-white shadow-[18px_0_50px_rgba(15,23,42,0.22)] transition-[width] duration-300",
        collapsed ? "w-[82px]" : "w-[248px]",
      )}
    >
      <div className="flex h-[88px] items-center gap-2 px-4">
        <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.16 }}>
        <Link href={sidebarMenus[role][0].href} className="flex min-w-0 items-center gap-3" onClick={onNavigate}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-white text-blue-700 shadow-[0_14px_30px_rgba(37,99,235,0.25)]">
            <span className="text-sm font-black">M</span>
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-black">Mugnee CRM</p>
              <p className="truncate text-[12px] font-medium text-blue-100">Smart sales suite</p>
            </div>
          ) : null}
        </Link>
        </motion.div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-h-full flex-col gap-4">
          {navGroups.map((group) => (
            <div
              key={group.title || "PRIMARY"}
              className={cn(group.title === "INCENTIVE" ? "mt-auto pt-2" : "space-y-1")}
            >
              {group.title && !collapsed ? (
                <p
                  className={cn(
                    "px-3 pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100/60",
                    group.title === "INCENTIVE" ? "text-amber-200/80" : "",
                  )}
                >
                  {group.title}
                </p>
              ) : null}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  const Icon = item.icon;
                  const currentCount = badgeValue(item.label);
                  const badgeText = formatCount(currentCount);
                  const showBadge = shouldShowBadge(currentCount);
                  const tooltip = badgeText ? `${item.label} (${badgeText})` : item.label;
                  const isRewards = item.label === "Rewards";

                  return (
                    <motion.div key={item.href} whileHover={{ x: 3 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.16 }}>
                      <Link
                        href={item.href}
                        title={tooltip}
                        onClick={onNavigate}
                        className={cn(
                          "group relative flex items-center gap-3 overflow-hidden rounded-[16px] border border-transparent px-3 py-3 text-[14px] font-semibold text-blue-100 transition-all duration-300",
                          active && !isRewards
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/30"
                            : "",
                          active && isRewards
                            ? "border-amber-200/30 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-950/30"
                            : "",
                          !active && !isRewards ? "hover:translate-x-0.5 hover:bg-white/10 hover:text-white" : "",
                          !active && isRewards
                            ? "border-amber-300/20 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20 hover:text-amber-50"
                            : "",
                          collapsed ? "justify-center px-2" : "",
                        )}
                      >
                        {active ? (
                          <motion.span
                            layoutId={`sidebar-indicator-${role}`}
                            className={cn(
                              "absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full",
                              isRewards ? "bg-amber-100" : "bg-white",
                            )}
                          />
                        ) : null}

                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            !active && isRewards ? "text-amber-200" : "",
                          )}
                        />
                        {!collapsed ? (
                          <>
                            <span className="truncate">{item.label}</span>
                            {showBadge ? (
                              <span
                                className={cn(
                                  "ml-auto inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-black",
                                  active && !isRewards ? "bg-white text-blue-700" : "",
                                  active && isRewards ? "bg-white text-orange-700" : "",
                                  !active && !isRewards ? "bg-blue-500/95 text-white" : "",
                                  !active && isRewards ? "bg-amber-300 text-slate-950" : "",
                                )}
                              >
                                {badgeText}
                              </span>
                            ) : null}
                          </>
                        ) : showBadge ? (
                          <span
                            className={cn(
                              "absolute right-1 top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black",
                              active && !isRewards ? "bg-white/90 text-blue-700" : "",
                              active && isRewards ? "bg-white/90 text-orange-700" : "",
                              !active && !isRewards ? "bg-blue-500/95 text-white" : "",
                              !active && isRewards ? "bg-amber-300 text-slate-950" : "",
                            )}
                          >
                            <span className="inline-flex min-w-5 items-center justify-center">{badgeText}</span>
                          </span>
                        ) : null}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

    </aside>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import {
  ArrowRight,
  AlertTriangle,
  Award,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  LayoutDashboard,
  Mail,
  MessageCircleMore,
  MessageSquarePlus,
  Pencil,
  PhoneCall,
  PhoneForwarded,
  Plus,
  Search,
  Sparkles,
  Target,
  Trophy,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProductBarChart, SalesLineChart } from "@/components/charts/crm-charts";
import { AnimatedPanel } from "@/components/shared/animated-panel";
import { DashboardCard } from "@/components/shared/dashboard-card";
import { PageHeader } from "@/components/shared/page-header";
import { DashboardMetricCard, StatCard } from "@/components/shared/stat-card";
import { useTaskCounterContext } from "@/components/app/app-shell";
import type { CrmWorkspace, FollowUpRow } from "@/lib/crm-data";
import { formatCrmDate, getCrmDayWindow, getCrmPeriodWindow } from "@/lib/crm-time";
import { cn, initials, rolePath, type Role } from "@/lib/utils";
import { CompletedWorkList, FollowUpEditModal, InlineContactShortcuts, sortCompletedWorkRows, toEditableCompletedFollowUpItem, toEditableCompletedTaskRow, type EditableFollowUpModalItem, type TodayTaskApiRow, TaskCreateModal, TodayWorkQueueList, todayWorkCounts, matchesTodayWorkFilter, sortTodayWorkQueue, WorkCompletionModal, type TodayWorkFilter } from "@/components/crm/resource-pages";
import type { CompletedWorkItem, TodayWorkQueueItem } from "@/lib/task-center";
import { updateFollowUpStatusAction, updateTaskStatusAction } from "@/lib/crm-actions";
import { FormModal } from "@/components/shared/form-modal";

const statIcons = [CalendarClock, ClipboardCheck, PhoneForwarded, Target, Trophy, Users, BriefcaseBusiness, WalletCards, Award, Bell];
const chartColors = ["#2563EB", "#06B6D4", "#16A34A", "#F59E0B", "#4F46E5", "#8B5CF6", "#22C55E", "#DC2626", "#94A3B8"];

function getPreferredDashboardName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function dedupeRowsById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function bucketUpcomingTasks(rows: TodayTaskApiRow[]) {
  const { to: tomorrowStart } = getCrmDayWindow(new Date());
  const { to: dayAfterTomorrowStart } = getCrmDayWindow(tomorrowStart);
  const tomorrowTasks: TodayTaskApiRow[] = [];
  const laterTasks: TodayTaskApiRow[] = [];

  for (const task of rows) {
    const taskTime = new Date(task.taskDateIso).getTime();
    if (!Number.isFinite(taskTime)) continue;
    if (taskTime < dayAfterTomorrowStart.getTime()) {
      tomorrowTasks.push(task);
    } else {
      laterTasks.push(task);
    }
  }

  return {
    tomorrowTasks,
    laterTasks,
    tomorrowLabel: formatCrmDate(tomorrowStart, "dd MMM yyyy"),
    total: rows.length,
  };
}

function useDashboardGreeting(name: string, _role: Role) {
  const weekdayMessages = [
    "Plan clearly, follow up warmly, and make the next week easier.",
    "Start strong. Every follow-up today can open a new opportunity.",
    "Consistency wins deals. Keep the conversations moving.",
    "Midweek momentum matters. One quality call can change the week.",
    "Stay sharp. The best customers often need one more follow-up.",
    "Finish the week with focus. Close loops and create next steps.",
    "Small progress today builds a stronger pipeline tomorrow.",
  ];
  const message = weekdayMessages[new Date().getDay()] ?? weekdayMessages[0];

  return {
    title: `Hello, ${getPreferredDashboardName(name)}`,
    message,
  };
}

function dashboardMetricHref(role: Role, title: string) {
  if (role === "ADMIN") {
    if (title === "Total Users") return rolePath(role, "users");
    if (title === "Total Customers") return rolePath(role, "customers");
    if (title === "Total Leads") return rolePath(role, "leads");
    if (title === "Total Products") return rolePath(role, "products");
    if (title === "Follow-ups Due") return `${rolePath(role, "follow-ups")}?dateFilter=today`;
    if (title === "Lead Conversion Rate") return rolePath(role, "reports");
    if (title === "Total Rewards") return rolePath(role, "rewards");
    return undefined;
  }

  if (role === "SUPERVISOR") {
    if (title === "Total Marketers") return rolePath(role, "team");
    if (title === "Total Leads") return rolePath(role, "leads");
    if (title === "Follow-up Due") return `${rolePath(role, "follow-ups")}?dateFilter=today`;
    if (title === "Overdue Follow-ups") return `${rolePath(role, "follow-ups")}?dateFilter=overdue`;
    if (title === "Sales This Month") return rolePath(role, "quotations");
    if (title === "Conversion Rate") return rolePath(role, "reports");
    return undefined;
  }

  if (title === "Today's Tasks") return rolePath(role, "tasks");
  if (title === "Pending Tasks") return rolePath(role, "tasks");
  if (title === "Follow-ups Due") return rolePath(role, "follow-ups");
  if (title === "New Leads") return rolePath(role, "leads");
  if (title === "Meetings Today") return rolePath(role, "communication");
  if (title === "Reward Points") return rolePath(role, "rewards");
  return undefined;
}

function StatsGrid({ items }: { items: CrmWorkspace["stats"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
      {items.map((item, index) => {
        const Icon = statIcons[index % statIcons.length];
        return (
          <AnimatedPanel key={item.title} delay={index * 0.03}>
            <StatCard title={item.title} value={item.value} helper={item.helper} icon={Icon} tone={item.tone} />
          </AnimatedPanel>
        );
      })}
    </div>
  );
}

function CreateTodayTaskButton({
  workspace,
  label = "Create Today's Task",
  size = "sm",
  className,
  refreshOnCreate = false,
  onCreated,
}: {
  workspace: CrmWorkspace;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  refreshOnCreate?: boolean;
  onCreated?: (row: TodayTaskApiRow) => void;
}) {
  const router = useRouter();
  const { refreshTaskCount, refreshCompletedTaskCount } = useTaskCounterContext();
  const [open, setOpen] = React.useState(false);

  const handleCreated = React.useCallback((row: TodayTaskApiRow) => {
    onCreated?.(row);
    void refreshTaskCount();
    setOpen(false);
    if (refreshOnCreate) {
      router.refresh();
    }
  }, [onCreated, refreshOnCreate, refreshTaskCount, router]);

  return (
    <>
      <Button
        type="button"
        size={size}
        onClick={() => setOpen(true)}
        className={cn("gap-2", className)}
      >
        <Plus className="h-4 w-4" />
        {label}
      </Button>

      <TaskCreateModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={handleCreated}
        role={workspace.user.role}
        workspace={workspace}
      />
    </>
  );
}

function EntityLink({ href, children, className }: { href?: string | null; children: string; className?: string }) {
  if (!href || children === "-") return <span className={className}>{children}</span>;

  return (
    <Link href={href} className={cn("text-blue-700 underline-offset-2 transition hover:underline", className)}>
      {children}
    </Link>
  );
}

function CompactList({ rows }: { rows: { title: string; meta: string; status?: string; href?: string | null }[] }) {
  return (
    <div className="space-y-3">
      {rows.length ? rows.map((row, index) => (
        <div key={`${row.href ?? row.title}-${row.meta}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">
              <EntityLink href={row.href} className="font-bold">{row.title}</EntityLink>
            </p>
            <p className="truncate text-xs text-slate-500">{row.meta}</p>
          </div>
          {row.status ? <Badge variant={row.status === "Completed" ? "success" : row.status.includes("Overdue") ? "danger" : row.status.includes("Pending") ? "warning" : "default"}>{row.status}</Badge> : null}
        </div>
      )) : (
        <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No records yet.</p>
      )}
    </div>
  );
}

function chartData(workspace: CrmWorkspace) {
  const leadStatus = workspace.pipeline
    .filter((item) => item.value > 0)
    .map((item, index) => ({ name: item.label, value: item.value, color: chartColors[index % chartColors.length] }));
  const sales = workspace.quotations.slice(0, 8).reverse().map((item) => ({ month: item.date, sales: item.amount }));
  const products = workspace.productOpportunities.slice(0, 6).map((item) => ({ name: item.name, leads: item.interestedCustomers }));
  const max = Math.max(1, ...workspace.pipeline.map((item) => item.value));
  const funnel = workspace.pipeline
    .filter((item) => item.value > 0)
    .slice(0, 6)
    .map((item, index) => ({ name: item.label, value: Math.max(16, Math.round((item.value / max) * 100)), color: chartColors[index % chartColors.length] }));

  return { leadStatus, sales, products, funnel };
}

function PendingFromPreviousDay({ workspace }: { workspace: CrmWorkspace }) {
  const pending = workspace.todayWorkItems.filter((item) => item.overdue).slice(0, 6);

  return (
    <Card className="overflow-hidden border-amber-200 bg-amber-50/80">
      <div className="flex flex-col gap-3 border-b border-amber-200/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950">Pending from Yesterday / Auto Carry Forward</h2>
            <p className="text-xs font-semibold text-amber-700">Incomplete plans, tasks, and follow-ups that need attention first.</p>
          </div>
        </div>
        <Badge variant="warning">{pending.length} Pending</Badge>
      </div>
      <div className="grid gap-3 p-3.5 sm:p-5 lg:grid-cols-3">
        {pending.length ? pending.map((item) => (
          <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">
                  <EntityLink href={item.href} className="font-black">{item.title}</EntityLink>
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{item.source} - {item.date} {item.time}</p>
              </div>
              <Badge variant="warning">Pending</Badge>
            </div>
          </div>
        )) : (
          <p className="rounded-xl border border-amber-200 bg-white p-4 text-sm font-semibold text-slate-500 lg:col-span-3">No carried-forward work. Nice clean start.</p>
        )}
      </div>
    </Card>
  );
}

function WorkSourceBadge({ item }: { item: CrmWorkspace["todayWorkItems"][number] }) {
  const variant = item.source === "Follow-up" ? "warning" : item.source === "Task" ? "default" : "neutral";
  return <Badge variant={variant}>{item.source}</Badge>;
}

function WorkCompleteAction({ item, role }: { item: CrmWorkspace["todayWorkItems"][number]; role: Role }) {
  if (item.source === "Follow-up") {
    return (
      <form action={updateFollowUpStatusAction}>
        <input type="hidden" name="id" value={item.sourceId} />
        <input type="hidden" name="status" value="COMPLETED" />
        <Button type="submit" variant="outline" size="sm" className="h-8 gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Done
        </Button>
      </form>
    );
  }

  if (item.source === "Task") {
    return (
      <form action={updateTaskStatusAction}>
        <input type="hidden" name="id" value={item.sourceId} />
        <input type="hidden" name="status" value="COMPLETED" />
        <Button type="submit" variant="outline" size="sm" className="h-8 gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Done
        </Button>
      </form>
    );
  }

  return (
    <Link href={rolePath(role, "todays-plan")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </Link>
  );
}

function TodaysTasksCard({ workspace, role }: { workspace: CrmWorkspace; role: Role }) {
  const todaysWork = workspace.todayWorkItems.slice(0, 8);
  const companyById = React.useMemo(
    () => new Map(workspace.companies.map((company) => [company.id, company])),
    [workspace.companies],
  );
  const leadById = React.useMemo(
    () => new Map(workspace.leads.map((lead) => [lead.id, lead])),
    [workspace.leads],
  );

  return (
    <DashboardCard title="Today's Tasks" action={<Link href={rolePath(role, "todays-plan")} className="inline-flex h-8 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add Plan</Link>}>
      <div className="space-y-3">
        {todaysWork.length ? todaysWork.map((item) => {
          const relatedLead = item.leadId ? leadById.get(item.leadId) : undefined;
          const relatedCompany = item.companyId
            ? companyById.get(item.companyId)
            : relatedLead?.companyId
              ? companyById.get(relatedLead.companyId)
              : undefined;
          const contactPhone = relatedCompany?.phone && relatedCompany.phone !== "-"
            ? relatedCompany.phone
            : relatedLead?.phone;
          const contactWhatsapp = relatedCompany?.whatsapp && relatedCompany.whatsapp !== "-"
            ? relatedCompany.whatsapp
            : contactPhone;

          return (
            <div key={item.id} className={cn("grid grid-cols-[auto_1fr] gap-3 rounded-xl border px-3 py-2.5 sm:grid-cols-[auto_1fr_auto] sm:items-center", item.overdue ? "border-red-100 bg-red-50/70" : "border-slate-100 bg-slate-50")}>
              <span className={cn("mt-1 flex h-4 w-4 items-center justify-center rounded border", item.overdue ? "border-red-300 bg-white text-red-600" : "border-slate-300 bg-white text-blue-600")}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                    <EntityLink href={item.href} className="font-bold">{item.title}</EntityLink>
                  </p>
                  <WorkSourceBadge item={item} />
                  {item.overdue ? <Badge variant="danger">Overdue</Badge> : null}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {item.date} {item.time}
                  {item.relatedTo !== "-" ? (
                    <>
                      <span>-</span>
                      <EntityLink href={item.href} className="text-xs font-semibold">{item.relatedTo}</EntityLink>
                    </>
                  ) : null}
                </p>
                <InlineContactShortcuts phone={contactPhone} whatsapp={contactWhatsapp} compact className="mt-2" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={item.priority === "High" || item.priority === "Urgent" ? "danger" : item.priority === "Medium" ? "warning" : "neutral"}>{item.priority}</Badge>
                  <Badge variant={item.status === "Overdue" ? "danger" : item.status === "Due Today" ? "warning" : "neutral"}>{item.status}</Badge>
                  {role !== "MARKETER" && item.assignedTo !== "-" ? <Badge variant="neutral">{item.assignedTo}</Badge> : null}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <WorkCompleteAction item={item} role={role} />
              </div>
            </div>
          );
        }) : <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No active work for today.</p>}
      </div>
    </DashboardCard>
  );
}

function TodaysPlanCard({ workspace, role }: { workspace: CrmWorkspace; role: Role }) {
  const todaysPlans = workspace.todayPlans.filter((plan) => plan.section === "today").slice(0, 6);

  return (
    <DashboardCard title="Today's Plan" action={<Link href={rolePath(role, "todays-plan")} className="inline-flex h-8 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add Plan</Link>}>
      <div className="space-y-3">
        {todaysPlans.length ? todaysPlans.map((plan) => (
          <div key={plan.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 bg-white">
              <input type="checkbox" className="h-3.5 w-3.5 accent-blue-600" checked={plan.status === "COMPLETED"} readOnly />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                  <EntityLink href={plan.href} className="font-bold">{plan.title}</EntityLink>
                </p>
                <Badge variant={plan.status === "COMPLETED" ? "success" : plan.status === "OVERDUE" ? "danger" : "warning"}>{plan.status}</Badge>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
                <CalendarClock className="h-3.5 w-3.5" />
                {plan.time}
                {plan.relatedTo !== "-" ? (
                  <>
                    <span>-</span>
                    <EntityLink href={plan.href} className="text-xs font-semibold">{plan.relatedTo}</EntityLink>
                  </>
                ) : null}
              </p>
            </div>
            <Link href={rolePath(role, "todays-plan")} className="col-span-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:col-span-1">
              <Pencil className="h-3.5 w-3.5" />
              Quick Edit
            </Link>
          </div>
        )) : <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No plans for today yet.</p>}
      </div>
    </DashboardCard>
  );
}

function MyTasksCard({ workspace, role }: { workspace: CrmWorkspace; role: Role }) {
  return (
    <DashboardCard title={role === "MARKETER" ? "My Tasks" : "Pending Team Tasks"}>
      <div className="space-y-3">
        {workspace.tasks.slice(0, 5).map((task) => (
          <div key={task.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{task.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Assigned by {task.assignedBy} - Due {task.dueDate}</p>
              </div>
              <Badge variant={task.status === "OVERDUE" ? "danger" : task.status === "COMPLETED" ? "success" : "default"}>
                {task.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {task.relatedTo !== "-" ? (
                <Badge variant="neutral" className="bg-blue-50">
                  <EntityLink href={task.href} className="text-xs font-bold">{task.relatedTo}</EntityLink>
                </Badge>
              ) : null}
              <Badge variant={task.priority === "Urgent" || task.priority === "High" ? "danger" : task.priority === "Medium" ? "warning" : "neutral"}>
                {task.priority}
              </Badge>
            </div>
          </div>
        ))}
        {!workspace.tasks.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No tasks yet.</p> : null}
      </div>
    </DashboardCard>
  );
}

function FollowUpSummary({ workspace }: { workspace: CrmWorkspace }) {
  const summary = [
    ["Overdue", workspace.followUpSummary.overdue, "border-red-200 bg-red-50 text-red-700"],
    ["Due Today", workspace.followUpSummary.today, "border-blue-200 bg-blue-50 text-blue-700"],
    ["Upcoming", workspace.followUpSummary.upcoming, "border-emerald-200 bg-emerald-50 text-emerald-700"],
    ["Completed", workspace.followUpSummary.completed, "border-slate-200 bg-slate-50 text-slate-700"],
  ] as const;

  return (
    <DashboardCard title="Follow-up Summary">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(([label, count, className]) => (
          <div key={label} className={cn("rounded-xl border p-3", className)}>
            <p className="text-2xl font-black">{count}</p>
            <p className="mt-1 text-xs font-bold">{label} Follow-ups</p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function FollowUpRemindersCard({ workspace }: { workspace: CrmWorkspace }) {
  const groups = [
    ["Overdue", workspace.followUps.filter((item) => item.bucket === "Overdue"), "border-red-200 bg-red-50"],
    ["Due Today", workspace.followUps.filter((item) => item.bucket === "Due Today"), "border-blue-100 bg-blue-50/60"],
    ["Upcoming", workspace.followUps.filter((item) => item.bucket === "Upcoming"), "border-slate-100 bg-slate-50"],
    ["Completed", workspace.followUps.filter((item) => item.bucket === "Completed"), "border-emerald-100 bg-emerald-50"],
  ] as const;

  return (
    <DashboardCard title="Follow-up Center">
      <div className="grid gap-3 lg:grid-cols-4">
        {groups.map(([label, rows, className]) => (
          <div key={label} className={cn("rounded-xl border p-3", className)}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className={cn("text-sm font-black", label === "Overdue" ? "text-red-700" : "text-slate-900")}>{label}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-600">{rows.length}</span>
            </div>
            <div className="space-y-2">
              {rows.slice(0, 4).map((item) => (
                <div key={`${label}-${item.id}`} className="rounded-lg bg-white px-3 py-2 shadow-sm">
                  <p className="truncate text-sm font-bold text-slate-900">
                    <EntityLink href={item.href} className="font-bold">{item.customer}</EntityLink>
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{item.method} - {item.followUpDate}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.note}</p>
                </div>
              ))}
              {!rows.length ? <p className="text-xs font-semibold text-slate-400">No items</p> : null}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function ProductIntelligenceWidget({ workspace }: { workspace: CrmWorkspace }) {
  const panels = [
    { title: "Top 5 Most Engaged Products", rows: workspace.productIntelligence.topEngaged, metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.engagementScore} score` },
    { title: "Highest Conversion Products", rows: workspace.productIntelligence.highestConversion, metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.conversionRate}% conversion` },
    { title: "Most Discussed Products", rows: workspace.productIntelligence.mostDiscussed, metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.communicationCount} communications` },
  ];

  return (
    <DashboardCard title="Product Intelligence">
      <div className="grid gap-4 xl:grid-cols-3">
        {panels.map((panel) => (
          <div key={panel.title} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">{panel.title}</h3>
            <div className="mt-3 space-y-2">
              {panel.rows.length ? panel.rows.map((item, index) => (
                <Link key={`${panel.title}-${item.id}`} href={`/products/${item.id}`} className="group flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-blue-700 underline-offset-2 group-hover:underline">{index + 1}. {item.name}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{item.leadCount} companies - {item.followUpCount} follow-ups - {item.quotationCount} quotes</p>
                  </div>
                  <Badge variant={panel.title.includes("Conversion") ? "success" : panel.title.includes("Discussed") ? "warning" : "default"}>{panel.metric(item)}</Badge>
                </Link>
              )) : <p className="rounded-lg bg-white p-3 text-xs font-semibold text-slate-500">No product engagement yet.</p>}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function CompactActivityFeed({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <DashboardCard title="Recent Activities" className="xl:max-w-3xl">
      <div className="space-y-2">
        {workspace.activities.slice(0, 5).map((item, index) => (
          <div key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              {index < Math.min(4, workspace.activities.length - 1) ? <span className="h-5 w-px bg-slate-200" /> : null}
            </div>
            <div className="min-w-0 pb-1">
              <p className="truncate text-xs font-black text-slate-900">
                <EntityLink href={item.href} className="font-black">{item.title}</EntityLink>
              </p>
              <p className="truncate text-xs text-slate-500">{item.detail}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{item.time}</p>
            </div>
          </div>
        ))}
        {!workspace.activities.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No activities recorded yet.</p> : null}
      </div>
    </DashboardCard>
  );
}

function TeamPerformanceTable({ workspace }: { workspace: CrmWorkspace }) {
  const teamRows = workspace.employees.filter((row) => row.role === "Marketer");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            {["Employee", "Leads", "Calls", "WhatsApp", "Meetings", "Follow-ups", "Pending Tasks", "Overdue Follow-ups", "Sales", "Conversion"].map((heading) => (
              <th className="px-3 py-2 font-bold" key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {teamRows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-3 font-semibold text-slate-800">{row.name}</td>
              <td className="px-3 py-3">{row.leads}</td>
              <td className="px-3 py-3">{row.calls}</td>
              <td className="px-3 py-3">{row.whatsapp}</td>
              <td className="px-3 py-3">{row.meetings}</td>
              <td className="px-3 py-3">{row.followUps}</td>
              <td className="px-3 py-3">{row.pendingTasks}</td>
              <td className="px-3 py-3">{row.overdueFollowUps}</td>
              <td className="px-3 py-3">{row.sales}</td>
              <td className="px-3 py-3">{row.conversionRate}</td>
            </tr>
          ))}
          {!teamRows.length ? (
            <tr>
              <td colSpan={10} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">No team members found.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

type SupervisorPerformanceRow = CrmWorkspace["employees"][number] & {
  performanceScore: number;
  performanceScoreRaw: number;
  hasPerformanceActivity: boolean;
};
type TeamPerformanceMetricKey = "overview" | "leads" | "calls" | "whatsapp" | "meetings" | "followUps" | "pendingTasks" | "overdueFollowUps" | "sales" | "conversion" | "score";

type TeamPerformanceDrilldownPayload = {
  marketerId: string;
  marketerName: string;
  metric: TeamPerformanceMetricKey;
  metricLabel: string;
};

type ActivityOverviewFocus = DrilldownActivityFilter;

type DrilldownStepNote = {
  id: string;
  stepLabel: string;
  note: string;
  createdAtIso: string;
  createdAtLabel: string;
  source: "TASK" | "FOLLOW_UP" | "COMMUNICATION";
  actorName?: string | null;
};

type TeamPerformanceDrilldownRow = {
  id: string;
  type: string;
  customerOrCompany: string;
  companyId?: string | null;
  companyHref?: string | null;
  leadId?: string | null;
  taskId?: string | null;
  leadName: string;
  contactPerson: string;
  phone: string;
  method: string;
  title: string;
  dateTime: string;
  sortDateValue?: string | null;
  status: string;
  note: string;
  taskDetail?: string;
  latestNote?: string;
  stepNotes?: DrilldownStepNote[];
};
type TeamPerformancePeriod = "today" | "yesterday" | "week" | "month";
type TeamPerformanceSource = "table" | "mobile";
const teamPerformancePeriods = ["today", "yesterday", "week", "month"] as const;
const isTeamPerformancePeriod = (value?: string | null): value is TeamPerformancePeriod => (
  value === "today" || value === "yesterday" || value === "week" || value === "month"
);
const performancePeriodLabels: Record<TeamPerformancePeriod, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Weekly",
  month: "Monthly",
};

const teamPerformanceMetricLabels: Record<TeamPerformanceMetricKey, string> = {
  overview: "Activity Overview",
  leads: "Leads",
  calls: "Calls",
  whatsapp: "WhatsApp",
  meetings: "Meetings",
  followUps: "Follow-ups",
  pendingTasks: "Pending Tasks",
  overdueFollowUps: "Overdue Follow-ups",
  sales: "Sales",
  conversion: "Conversion",
  score: "Score",
};

const teamPerformanceMetricValue = (row: SupervisorPerformanceRow, metric: TeamPerformanceMetricKey): string | number => {
  switch (metric) {
    case "overview":
      return row.leads + row.calls + row.whatsapp + row.meetings + row.followUps + row.pendingTasks + row.overdueFollowUps + row.sales;
    case "leads":
      return row.leads;
    case "calls":
      return row.calls;
    case "whatsapp":
      return row.whatsapp;
    case "meetings":
      return row.meetings;
    case "followUps":
      return row.followUps;
    case "pendingTasks":
      return row.pendingTasks;
    case "overdueFollowUps":
      return row.overdueFollowUps;
    case "sales":
      return row.sales;
    case "conversion":
      return row.conversionRate;
    case "score":
      return row.performanceScore;
  }
};

const teamPerformanceMetricValueNumber = (value: string | number) => {
  if (typeof value === "number") return value;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
};

function hasPerformanceActivity(
  row: Pick<SupervisorPerformanceRow, "leads" | "calls" | "whatsapp" | "emails" | "meetings" | "followUps" | "pendingTasks" | "overdueFollowUps" | "sales">,
) {
  return (
    row.leads +
    row.calls +
    row.whatsapp +
    row.emails +
    row.meetings +
    row.followUps +
    row.pendingTasks +
    row.overdueFollowUps +
    row.sales
  ) > 0;
}

function buildPerformanceScore(
  row: Pick<SupervisorPerformanceRow, "leads" | "calls" | "whatsapp" | "emails" | "meetings" | "followUps" | "pendingTasks" | "overdueFollowUps" | "sales" | "conversionRate">,
) {
  const numericConversion = Number.parseInt(row.conversionRate.replace(/\D/g, ""), 10) || 0;
  const rawScore =
    row.sales * 24 +
    row.leads * 8 +
    row.followUps * 5 +
    row.calls * 3 +
    row.whatsapp * 3 +
    row.emails * 2 +
    row.meetings * 4 +
    Math.round(numericConversion * 0.6) -
    row.pendingTasks * 2 -
    row.overdueFollowUps * 6;
  const active = hasPerformanceActivity(row);

  return {
    performanceScoreRaw: active ? rawScore : 0,
    performanceScore: active ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0,
    hasPerformanceActivity: active,
  };
}

function performanceScoreLabel(row: Pick<SupervisorPerformanceRow, "performanceScore" | "hasPerformanceActivity">) {
  return row.hasPerformanceActivity ? `${row.performanceScore}%` : "No activity";
}

const isTeamPerformanceMetricClickable = (
  metric: TeamPerformanceMetricKey,
  value: string | number,
): boolean => {
  if (metric === "overview") return true;
  if (metric === "score") return teamPerformanceMetricValueNumber(value) > 0;
  return teamPerformanceMetricValueNumber(value) > 0;
};

function normalizeDrilldownLookup(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function drilldownSortTime(row: TeamPerformanceDrilldownRow) {
  const isoTime = row.sortDateValue ? Date.parse(row.sortDateValue) : Number.NaN;
  if (!Number.isNaN(isoTime)) return isoTime;
  const fallbackTime = Date.parse(row.dateTime);
  return Number.isNaN(fallbackTime) ? 0 : fallbackTime;
}

function drilldownRowKey(row: TeamPerformanceDrilldownRow) {
  return `${row.type}:${row.id}:${row.sortDateValue ?? row.dateTime}`;
}

function readDrilldownText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized && normalized !== "-") {
      return normalized;
    }
  }

  return "";
}

function drilldownStatusVariant(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized.includes("COMPLETED") || normalized.includes("WON")) return "success" as const;
  if (normalized.includes("OVERDUE") || normalized.includes("LOST")) return "danger" as const;
  if (normalized.includes("TODAY") || normalized.includes("PENDING")) return "warning" as const;
  if (normalized.includes("FOLLOW")) return "violet" as const;
  return "neutral" as const;
}

function activityCategoryLabel(activity: CrmWorkspace["activities"][number]) {
  switch (activity.category) {
    case "CALL":
      return "Phone call";
    case "WHATSAPP":
      return "WhatsApp";
    case "EMAIL":
      return "Email";
    case "MEETING":
      return "Meeting";
    case "FOLLOW_UP":
      return "Follow-up";
    case "TASK":
      return "Task";
    case "LEAD":
      return "Lead";
    case "QUOTATION":
      return "Quotation";
    default:
      return "Activity";
  }
}

type DrilldownActivityFilter = "all" | "call" | "followUp" | "demo" | "quotation";

function drilldownActivityCategory(row: TeamPerformanceDrilldownRow): Exclude<DrilldownActivityFilter, "all"> | null {
  const type = row.type.trim().toLowerCase();
  const haystack = [row.method, row.title, row.note].join(" ").toLowerCase();

  if (type === "quotation") return "quotation";
  if (type === "follow-up") return "followUp";

  if (type === "communication") {
    if (haystack.includes("quotation") || haystack.includes("quatation") || haystack.includes("quote")) return "quotation";
    if (haystack.includes("demo")) return "demo";
    if (haystack.includes("follow")) return "followUp";
    if (haystack.includes("call") || haystack.includes("phone")) return "call";
    return null;
  }

  if (type === "task") {
    if (haystack.includes("quotation") || haystack.includes("quatation") || haystack.includes("quote")) return "quotation";
    if (haystack.includes("demo")) return "demo";
    if (haystack.includes("follow")) return "followUp";
    return null;
  }

  if (haystack.includes("quotation") || haystack.includes("quatation") || haystack.includes("quote")) return "quotation";
  if (haystack.includes("demo")) return "demo";
  if (haystack.includes("follow")) return "followUp";
  return null;
}

function drilldownNoteCategoryLabel(row: TeamPerformanceDrilldownRow) {
  const category = drilldownActivityCategory(row);

  if (category === "call") return "Call";
  if (category === "followUp") return "Follow-up";
  if (category === "demo") return "Demo";
  if (category === "quotation") return "Quotation";
  return row.type;
}

function drilldownTimelineBadgeVariant(label?: string | null) {
  const normalized = label?.trim().toLowerCase() ?? "";

  if (normalized.includes("call") || normalized.includes("phone")) return "default" as const;
  if (normalized.includes("follow")) return "warning" as const;
  if (normalized.includes("demo")) return "violet" as const;
  if (normalized.includes("quotation") || normalized.includes("quote")) return "success" as const;
  if (normalized.includes("meeting")) return "neutral" as const;
  return "neutral" as const;
}

function drilldownTimelineAction(status?: string | null, fallback?: string | null) {
  const normalizedStatus = status?.trim();
  const normalizedFallback = fallback?.trim();
  if (normalizedStatus && normalizedFallback) return `${normalizedStatus} - ${normalizedFallback}`;
  return normalizedStatus || normalizedFallback || "Activity update";
}

function drilldownParseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function drilldownDateMeta(date?: Date | null) {
  if (!date) {
    return {
      groupLabel: "Older",
      groupDateLabel: "",
      timeLabel: "-",
    };
  }

  const todayStart = getCrmDayWindow(new Date()).from;
  const todayKey = formatCrmDate(todayStart, "yyyy-MM-dd");
  const yesterdayKey = formatCrmDate(new Date(todayStart.getTime() - 1000), "yyyy-MM-dd");
  const rowKey = formatCrmDate(date, "yyyy-MM-dd");
  const dateLabel = formatCrmDate(date, "dd MMM yyyy");
  const timeLabel = formatCrmDate(date, "hh:mm a");

  if (rowKey === todayKey) {
    return {
      groupLabel: "Today",
      groupDateLabel: dateLabel,
      timeLabel,
    };
  }

  if (rowKey === yesterdayKey) {
    return {
      groupLabel: "Yesterday",
      groupDateLabel: dateLabel,
      timeLabel,
    };
  }

  return {
    groupLabel: dateLabel,
    groupDateLabel: dateLabel,
    timeLabel: `${formatCrmDate(date, "dd MMM yyyy")} · ${timeLabel}`,
  };
}

function drilldownNoteCardClasses(row: TeamPerformanceDrilldownRow) {
  const category = drilldownActivityCategory(row);

  if (category === "call") {
    return {
      row: "border-blue-100 border-l-4 border-l-blue-500 bg-white shadow-[0_6px_16px_rgba(37,99,235,0.06)]",
      badge: "border border-blue-200 bg-blue-50 text-blue-700",
      timePill: "border border-blue-100 bg-blue-50 text-blue-700",
      noteLabel: "text-blue-700",
    };
  }

  if (category === "followUp") {
    return {
      row: "border-amber-100 border-l-4 border-l-amber-500 bg-white shadow-[0_6px_16px_rgba(245,158,11,0.06)]",
      badge: "border border-amber-200 bg-amber-50 text-amber-700",
      timePill: "border border-amber-100 bg-amber-50 text-amber-700",
      noteLabel: "text-amber-700",
    };
  }

  if (category === "demo") {
    return {
      row: "border-violet-100 border-l-4 border-l-violet-500 bg-white shadow-[0_6px_16px_rgba(124,58,237,0.06)]",
      badge: "border border-violet-200 bg-violet-50 text-violet-700",
      timePill: "border border-violet-100 bg-violet-50 text-violet-700",
      noteLabel: "text-violet-700",
    };
  }

  if (category === "quotation") {
    return {
      row: "border-emerald-100 border-l-4 border-l-emerald-500 bg-white shadow-[0_6px_16px_rgba(16,185,129,0.06)]",
      badge: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      timePill: "border border-emerald-100 bg-emerald-50 text-emerald-700",
      noteLabel: "text-emerald-700",
    };
  }

  return {
    row: "border-slate-200 border-l-4 border-l-slate-400 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.05)]",
    badge: "border border-slate-200 bg-slate-100 text-slate-700",
    timePill: "border border-slate-200 bg-slate-100 text-slate-600",
    noteLabel: "text-slate-700",
  };
}

function buildActivityOverviewHref(
  role: Role,
  marketerId: string,
  marketerName: string,
  period: TeamPerformancePeriod,
  focus: ActivityOverviewFocus,
) {
  const params = new URLSearchParams({
    marketerId,
    marketerName,
    period,
    focus,
  });
  return `${rolePath(role, "activity-overview")}?${params.toString()}`;
}

function TeamPerformanceDrilldownTable({
  rows,
  workspace,
  marketerId,
  marketerName,
  initialActivityFilter,
  onSummaryCardClick,
  currentPeriod,
  onPeriodChange,
}: {
  rows: TeamPerformanceDrilldownRow[];
  workspace: CrmWorkspace;
  marketerId: string;
  marketerName: string;
  initialActivityFilter?: DrilldownActivityFilter;
  onSummaryCardClick?: (filter: Exclude<DrilldownActivityFilter, "all">) => void;
  currentPeriod?: TeamPerformancePeriod;
  onPeriodChange?: (period: TeamPerformancePeriod) => void;
}) {
  const [selectedRecordKey, setSelectedRecordKey] = React.useState<string | null>(null);
  const [activityFilter, setActivityFilter] = React.useState<DrilldownActivityFilter>(initialActivityFilter ?? "all");
  const recordsSectionRef = React.useRef<HTMLDivElement | null>(null);
  const orderedRows = React.useMemo(() => (
    [...rows].sort((left, right) => drilldownSortTime(right) - drilldownSortTime(left))
  ), [rows]);
  const filteredRows = React.useMemo(() => {
    if (activityFilter === "all") return orderedRows;
    return orderedRows.filter((row) => drilldownActivityCategory(row) === activityFilter);
  }, [activityFilter, orderedRows]);
  const selectedRecord = React.useMemo(() => (
    filteredRows.find((row) => drilldownRowKey(row) === selectedRecordKey) ?? null
  ), [filteredRows, selectedRecordKey]);

  const filterCounts = React.useMemo(() => {
    return orderedRows.reduce((summary, row) => {
      const category = drilldownActivityCategory(row);
      summary.all += 1;
      if (category) summary[category] += 1;
      return summary;
    }, { all: 0, call: 0, followUp: 0, demo: 0, quotation: 0 });
  }, [orderedRows]);

  React.useEffect(() => {
    setSelectedRecordKey(null);
  }, [activityFilter]);

  React.useEffect(() => {
    setActivityFilter(initialActivityFilter ?? "all");
  }, [initialActivityFilter]);

  const latestNotes = React.useMemo(() => (
    filteredRows
      .filter((row) => row.note && row.note !== "-")
  ), [filteredRows]);

  const groupedLatestNotes = React.useMemo(() => {
    const groups: Array<{ label: string; dateLabel: string; rows: TeamPerformanceDrilldownRow[] }> = [];

    latestNotes.forEach((row) => {
      const meta = drilldownDateMeta(drilldownParseDate(row.sortDateValue ?? row.dateTime));
      const existingGroup = groups[groups.length - 1];

      if (existingGroup && existingGroup.label === meta.groupLabel) {
        existingGroup.rows.push(row);
        return;
      }

      groups.push({
        label: meta.groupLabel,
        dateLabel: meta.groupDateLabel,
        rows: [row],
      });
    });

    return groups;
  }, [latestNotes]);

  const selectedCompany = React.useMemo(() => {
    if (!selectedRecord) return null;
    const fallbackName = normalizeDrilldownLookup(selectedRecord.customerOrCompany);
    return workspace.companies.find((company) => (
      (selectedRecord.companyId && company.id === selectedRecord.companyId)
      || normalizeDrilldownLookup(company.name) === fallbackName
    )) ?? null;
  }, [selectedRecord, workspace.companies]);

  const relatedRows = React.useMemo(() => {
    if (!selectedRecord) return [];
    const selectedKey = normalizeDrilldownLookup(selectedRecord.customerOrCompany);
    return orderedRows
      .filter((row) => (
        (selectedRecord.companyId && row.companyId && selectedRecord.companyId === row.companyId)
        || normalizeDrilldownLookup(row.customerOrCompany) === selectedKey
      ))
      .slice(0, 8);
  }, [orderedRows, selectedRecord]);

  const relatedActivities = React.useMemo(() => {
    if (!selectedRecord) return [];
    const customerHref = selectedRecord.companyHref ?? (selectedRecord.companyId ? `/customers/${selectedRecord.companyId}` : null);
    const customerKey = normalizeDrilldownLookup(selectedRecord.customerOrCompany);
    const marketerKey = normalizeDrilldownLookup(marketerName);

    return workspace.activities
      .filter((activity) => {
        const matchesMarketer = (
          activity.employeeId === marketerId
          || normalizeDrilldownLookup(activity.employeeName) === marketerKey
          || normalizeDrilldownLookup(activity.createdBy) === marketerKey
        );

        if (!matchesMarketer) return false;
        if (customerHref && (activity.customerHref === customerHref || activity.relatedCustomerHref === customerHref)) return true;
        return normalizeDrilldownLookup(activity.customerName) === customerKey;
      })
      .sort((left, right) => new Date(right.createdAtValue ?? 0).getTime() - new Date(left.createdAtValue ?? 0).getTime())
      .slice(0, 10);
  }, [marketerId, marketerName, selectedRecord, workspace.activities]);

  const activitySummary = React.useMemo(() => {
    return relatedActivities.reduce((summary, activity) => {
      switch (activity.category) {
        case "CALL":
          summary.calls += 1;
          break;
        case "WHATSAPP":
          summary.whatsapp += 1;
          break;
        case "MEETING":
          summary.meetings += 1;
          break;
        case "FOLLOW_UP":
          summary.followUps += 1;
          break;
        case "TASK":
          summary.tasks += 1;
          break;
        default:
          summary.other += 1;
          break;
      }

      return summary;
    }, { calls: 0, whatsapp: 0, meetings: 0, followUps: 0, tasks: 0, other: 0 });
  }, [relatedActivities]);

  const rowSummary = React.useMemo(() => {
    return relatedRows.reduce((summary, row) => {
      const method = row.method.toLowerCase();
      if (method.includes("call") || method.includes("phone")) summary.calls += 1;
      if (method.includes("follow")) summary.followUps += 1;
      if (method.includes("meeting")) summary.meetings += 1;
      if (method.includes("whatsapp")) summary.whatsapp += 1;
      return summary;
    }, { calls: 0, followUps: 0, meetings: 0, whatsapp: 0 });
  }, [relatedRows]);

  const timelineSummary = relatedActivities.length
    ? activitySummary
    : { calls: rowSummary.calls, followUps: rowSummary.followUps, meetings: rowSummary.meetings };

  const selectedDetailText = React.useMemo(() => (
    readDrilldownText(selectedRecord?.taskDetail)
  ), [selectedRecord?.taskDetail]);

  const selectedNoteText = React.useMemo(() => (
    readDrilldownText(selectedRecord?.latestNote, selectedRecord?.note)
  ), [selectedRecord?.latestNote, selectedRecord?.note]);

  const companyNoteText = React.useMemo(() => (
    readDrilldownText(selectedCompany?.notes)
  ), [selectedCompany?.notes]);

  const timelineItems = React.useMemo(() => {
    if (relatedActivities.length) {
      return relatedActivities.slice(0, 8).map((activity) => {
        const label = activityCategoryLabel(activity);
        const dateMeta = drilldownDateMeta(drilldownParseDate(activity.createdAtValue ?? activity.time));

        return {
          id: `${activity.id}-${activity.createdAtValue ?? activity.time}`,
          badgeLabel: label,
          badgeVariant: drilldownTimelineBadgeVariant(label),
          action: drilldownTimelineAction(activity.title, activityCategoryLabel(activity)),
          meta: activity.category === "FOLLOW_UP" ? "Follow-up update" : label,
          note: readDrilldownText(activity.discussionSummary, activity.notes, activity.detail) || "No details added.",
          time: dateMeta.timeLabel,
          dayLabel: dateMeta.groupLabel,
        };
      });
    }

    return relatedRows.slice(0, 8).map((row) => {
      const label = drilldownNoteCategoryLabel(row);
      const dateMeta = drilldownDateMeta(drilldownParseDate(row.sortDateValue ?? row.dateTime));

      return {
        id: `${row.id}-${row.dateTime}`,
        badgeLabel: label,
        badgeVariant: drilldownTimelineBadgeVariant(label),
        action: drilldownTimelineAction(row.status, row.title || row.method),
        meta: row.method,
        note: readDrilldownText(row.latestNote, row.note, row.taskDetail) || "No details added.",
        time: dateMeta.timeLabel,
        dayLabel: dateMeta.groupLabel,
      };
    });
  }, [relatedActivities, relatedRows]);

  const summaryCards = [
    {
      key: "call" as const,
      label: "Calls",
      value: filterCounts.call,
      helper: filterCounts.call ? `${filterCounts.call} real call records` : "No calls found",
      activeClassName: "border-blue-600 bg-blue-600 text-white shadow-[0_18px_36px_rgba(37,99,235,0.28)]",
      idleClassName: "border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-300 hover:bg-blue-100",
      pillClassName: "bg-white/20 text-white",
      idlePillClassName: "bg-blue-600 text-white",
    },
    {
      key: "followUp" as const,
      label: "Follow-ups",
      value: filterCounts.followUp,
      helper: filterCounts.followUp ? `${filterCounts.followUp} follow-up updates` : "No follow-up records",
      activeClassName: "border-amber-500 bg-amber-500 text-white shadow-[0_18px_36px_rgba(245,158,11,0.28)]",
      idleClassName: "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100",
      pillClassName: "bg-white/20 text-white",
      idlePillClassName: "bg-amber-500 text-white",
    },
    {
      key: "demo" as const,
      label: "Demo",
      value: filterCounts.demo,
      helper: filterCounts.demo ? `${filterCounts.demo} demo discussions` : "No demo records",
      activeClassName: "border-violet-600 bg-violet-600 text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)]",
      idleClassName: "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100",
      pillClassName: "bg-white/20 text-white",
      idlePillClassName: "bg-violet-600 text-white",
    },
    {
      key: "quotation" as const,
      label: "Quotation",
      value: filterCounts.quotation,
      helper: filterCounts.quotation ? `${filterCounts.quotation} quotation records` : "No quotation records",
      activeClassName: "border-emerald-600 bg-emerald-600 text-white shadow-[0_18px_36px_rgba(5,150,105,0.28)]",
      idleClassName: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100",
      pillClassName: "bg-white/20 text-white",
      idlePillClassName: "bg-emerald-600 text-white",
    },
  ];

  const handleSummaryCardClick = (key: Exclude<DrilldownActivityFilter, "all">) => {
    if (onSummaryCardClick) {
      onSummaryCardClick(key);
      return;
    }
    setActivityFilter(key);
    recordsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
        <div className="mt-2 grid gap-2 md:grid-cols-4">
          {summaryCards.map((card) => {
            const active = activityFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => handleSummaryCardClick(card.key)}
                className={cn(
                  "rounded-2xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
                  active ? card.activeClassName : card.idleClassName,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={cn(
                      "text-[11px] font-black uppercase tracking-[0.14em]",
                      active ? "text-white/80" : "text-current/75",
                    )}>
                      {card.label}
                    </p>
                    <p className="mt-1 text-[28px] font-black leading-none">{card.value}</p>
                  </div>
                  <span className={cn(
                    "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]",
                    active ? card.pillClassName : card.idlePillClassName,
                  )}>
                    Clickable
                  </span>
                </div>
                <p className={cn("mt-1.5 text-[11px] font-semibold leading-5", active ? "text-white/90" : "text-current/80")}>
                  {card.helper}
                </p>
                <p className={cn("mt-0.5 text-[10px] font-bold", active ? "text-white/80" : "text-current/70")}>
                  Click kore niche details dekhen
                </p>
              </button>
            );
          })}
        </div>
        <div ref={recordsSectionRef}>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950">Overall Details / Notes</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {filteredRows.length ? `${filteredRows.length} of ${filterCounts.all} records` : "No records found for this filter."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {currentPeriod && onPeriodChange ? teamPerformancePeriods.map((period) => {
                  const active = currentPeriod === period;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => onPeriodChange(period)}
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition",
                        active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-100 hover:text-slate-900",
                      )}
                    >
                      {performancePeriodLabels[period]}
                    </button>
                  );
                }) : null}
                <Badge variant="neutral">{latestNotes.length} notes</Badge>
              </div>
            </div>
            {latestNotes.length ? (
              <div className="mt-2.5 max-h-[min(34vh,22rem)] space-y-2 overflow-y-auto pr-1.5 [scrollbar-gutter:stable]">
                {groupedLatestNotes.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <div className="sticky top-0 z-[1] flex items-center gap-2 bg-white/95 py-1 backdrop-blur-sm">
                      <Badge variant={group.label === "Today" ? "default" : group.label === "Yesterday" ? "warning" : "neutral"}>
                        {group.label}
                      </Badge>
                      {group.dateLabel && group.dateLabel !== group.label ? (
                        <span className="text-[11px] font-semibold text-slate-500">{group.dateLabel}</span>
                      ) : null}
                    </div>
                    {group.rows.map((row) => {
                      const detailText = readDrilldownText(row.taskDetail);
                      const noteText = readDrilldownText(row.latestNote, row.note);
                      const cardClasses = drilldownNoteCardClasses(row);
                      const categoryLabel = drilldownNoteCategoryLabel(row);
                      const dateMeta = drilldownDateMeta(drilldownParseDate(row.sortDateValue ?? row.dateTime));

                      return (
                        <div
                          key={`${drilldownRowKey(row)}:note`}
                          className={cn("rounded-xl border px-3 py-2", cardClasses.row)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]", cardClasses.badge)}>
                                  {categoryLabel}
                                </span>
                                <Badge variant={drilldownStatusVariant(row.status)}>{row.status}</Badge>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecordKey(drilldownRowKey(row))}
                                  className="truncate text-left text-sm font-black text-slate-950 transition hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                >
                                  {row.customerOrCompany}
                                </button>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                                <span className="font-semibold">{row.title}</span>
                                <span>{row.method}</span>
                              </div>
                            </div>
                            <div className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", cardClasses.timePill)}>
                              {dateMeta.timeLabel}
                            </div>
                          </div>
                          <div className="mt-1.5 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Task Details</p>
                              <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-700">
                                {detailText || "-"}
                              </p>
                            </div>
                            <div className="min-w-0 border-t border-slate-100 pt-1.5 md:border-l md:border-t-0 md:pl-3 md:pt-0">
                              <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", cardClasses.noteLabel)}>
                                {detailText ? "Latest Note" : "Latest Note"}
                              </p>
                              <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-800">
                                {noteText || "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-sm font-semibold text-slate-500">
                No note or detail found for this period and filter.
              </p>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedRecord ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedRecordKey(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="flex max-h-[calc(100vh-1.5rem)] w-[96vw] max-w-[1120px] min-h-0 flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:max-h-[calc(100vh-3rem)]"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Company Activity Detail</p>
                  <h3 className="mt-2 truncate text-xl font-black text-slate-950">
                    {selectedCompany?.name ?? selectedRecord.customerOrCompany}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {marketerName} er kaj, kotha, status, ar timeline ekshathe dekhen.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedRecordKey(null)} aria-label="Close company detail">
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_#eff6ff_0%,_#ffffff_42%,_#f8fafc_100%)] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="neutral">{selectedRecord.type}</Badge>
                          <Badge variant={drilldownStatusVariant(selectedRecord.status)}>{selectedRecord.status}</Badge>
                        </div>
                        <p className="mt-3 text-lg font-black text-slate-950">{selectedRecord.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{selectedRecord.method} - {selectedRecord.dateTime}</p>
                      </div>
                      {selectedRecord.companyHref ? (
                        <Link
                          href={selectedRecord.companyHref}
                          className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                        >
                          Open Customer
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      ) : null}
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Company Info</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{selectedCompany?.name ?? selectedRecord.customerOrCompany}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {selectedCompany?.contactPerson || selectedRecord.contactPerson || "-"} - {selectedCompany?.phone || selectedRecord.phone || "-"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {[selectedCompany?.industry, selectedCompany?.cityOrZilla].filter(Boolean).join(", ") || "Basic company info"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Marketer Update</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{marketerName}</p>
                          <p className="mt-1 text-sm text-slate-600">Current stage: {selectedRecord.status}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Calls {rowSummary.calls} | Follow-ups {rowSummary.followUps} | Records {relatedRows.length}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Last touch: {relatedActivities[0]?.time || selectedCompany?.lastCommunication || selectedRecord.dateTime}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-950">Latest Update</p>
                        <Badge variant="neutral">Current</Badge>
                      </div>
                      <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                        {selectedNoteText || "No detailed note added for this record."}
                      </p>
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                          <p><span className="font-semibold text-slate-900">Method:</span> {selectedRecord.method}</p>
                          <p><span className="font-semibold text-slate-900">Status:</span> {selectedRecord.status}</p>
                          <p><span className="font-semibold text-slate-900">Lead:</span> {selectedRecord.leadName || "-"}</p>
                          <p><span className="font-semibold text-slate-900">Time:</span> {selectedRecord.dateTime}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Task Details</p>
                          <p className="mt-1 text-sm leading-6 text-slate-700">{selectedDetailText || "-"}</p>
                        </div>
                        {companyNoteText ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Company Note</p>
                            <p className="mt-1 text-sm leading-6 text-slate-700">{companyNoteText}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-950">Recent Timeline</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="default">{timelineSummary.calls} Calls</Badge>
                          <Badge variant="warning">{timelineSummary.followUps} Follow-ups</Badge>
                          <Badge variant="neutral">{timelineSummary.meetings} Meetings</Badge>
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">Newest update first. Each row shows what happened, when it happened, and the short note.</p>
                      {timelineItems.length ? (
                        <div className="mt-4 space-y-3">
                          {timelineItems.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={item.badgeVariant}>{item.badgeLabel}</Badge>
                                  <p className="text-sm font-bold text-slate-900">{item.action}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={item.dayLabel === "Today" ? "default" : item.dayLabel === "Yesterday" ? "warning" : "neutral"}>
                                    {item.dayLabel}
                                  </Badge>
                                  <p className="text-xs font-semibold text-slate-500">{item.time}</p>
                                </div>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-slate-500">{item.meta}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{item.note}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                          Ei company ar marketer pair-er kono recent activity summary khuje paoa jayni.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function ActivityOverviewDetailsPage({
  role,
  workspace,
}: {
  role: Role;
  workspace: CrmWorkspace;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const marketerId = searchParams.get("marketerId")?.trim() ?? "";
  const rawMarketerName = searchParams.get("marketerName")?.trim() ?? "";
  const rawPeriod = searchParams.get("period")?.trim() ?? "";
  const rawFocus = searchParams.get("focus")?.trim() ?? "";
  const period: TeamPerformancePeriod = isTeamPerformancePeriod(rawPeriod) ? rawPeriod : "today";
  const focus: DrilldownActivityFilter = rawFocus === "call" || rawFocus === "followUp" || rawFocus === "demo" || rawFocus === "quotation" || rawFocus === "all"
    ? rawFocus
    : "all";
  const marketerName = React.useMemo(() => {
    if (rawMarketerName) return rawMarketerName;
    return workspace.employees.find((employee) => employee.id === marketerId)?.name || "Marketer";
  }, [marketerId, rawMarketerName, workspace.employees]);
  const [rows, setRows] = React.useState<TeamPerformanceDrilldownRow[]>([]);
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const updateRoute = React.useCallback((next: { period?: TeamPerformancePeriod; focus?: DrilldownActivityFilter }) => {
    if (!marketerId) return;
    const href = buildActivityOverviewHref(
      role,
      marketerId,
      marketerName,
      next.period ?? period,
      next.focus ?? focus,
    );
    router.push(href, { scroll: false });
  }, [focus, marketerId, marketerName, period, role, router]);

  React.useEffect(() => {
    if (!marketerId) return;

    let cancelled = false;
    const loadRows = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          marketerId,
          metricType: "overview",
          period,
        });
        const response = await fetch(`/api/supervisor/team-performance/drilldown?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await response.json();

        if (!response.ok || !json?.success) {
          throw new Error(json?.message || "Failed to load activity overview.");
        }

        if (cancelled) return;
        setRows(Array.isArray(json.rows) ? json.rows : []);
        setCount(typeof json.count === "number" ? json.count : 0);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "Failed to load activity overview.");
        setRows([]);
        setCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [marketerId, period]);

  if (!marketerId) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Activity Overview"
          title="Missing marketer"
          description="Open this page from dashboard cards so the selected marketer details load correctly."
          actions={<Link href={rolePath(role, "dashboard")} className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">Back to dashboard</Link>}
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-600">
          No marketer was selected for this activity details page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Activity Overview"
        title={`${marketerName} Details`}
        description="Full page view for calls, follow-ups, demo, quotation, notes, and company-wise activity records."
        actions={<Link href={rolePath(role, "dashboard")} className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Back to dashboard</Link>}
      />

      <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {teamPerformancePeriods.map((item) => {
              const active = period === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => updateRoute({ period: item })}
                  className={cn(
                    "inline-flex items-center rounded-full border px-4 py-2 text-sm font-bold transition",
                    active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-100 hover:text-slate-900",
                  )}
                >
                  {performancePeriodLabels[item]}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
            <Badge variant="neutral">{marketerName}</Badge>
            <Badge variant="neutral">{count} records</Badge>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {loading && !rows.length ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Loading activity details...</div>
        ) : rows.length ? (
          <div className="mt-4">
            <TeamPerformanceDrilldownTable
              rows={rows}
              workspace={workspace}
              marketerId={marketerId}
              marketerName={marketerName}
              initialActivityFilter={focus}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
            No activity records found for this marketer in the selected period.
          </div>
        )}
      </div>
    </div>
  );
}

const supervisorKpiConfig = {
  "Total Marketers": {
    icon: Users,
    tone: "#2563eb",
    helper: "Active marketers under your supervision",
  },
  "Total Leads": {
    icon: Target,
    tone: "#4f46e5",
    helper: "Total team pipeline opportunities",
  },
  "Follow-up Due": {
    icon: CalendarClock,
    tone: "#f59e0b",
    helper: "Due today across your active team",
  },
  "Overdue Follow-ups": {
    icon: AlertTriangle,
    tone: "#dc2626",
    helper: "Urgent items needing escalation",
  },
  "Sales This Month": {
    icon: WalletCards,
    tone: "#059669",
    helper: "Closed quotation value this month",
  },
  "Conversion Rate": {
    icon: Award,
    tone: "#7c3aed",
    helper: "Won deals versus total team leads",
  },
} as const;

function SupervisorSurfaceCard({
  title,
  subtitle,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18, ease: "easeOut" }} className="h-full">
      <Card className={cn("h-full rounded-[20px] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]", className)}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-3.5 py-3.5 sm:px-5 sm:py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-950">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {action ? <div className="w-full min-w-0 lg:w-auto lg:shrink-0">{action}</div> : null}
        </div>
        <div className={cn("p-3.5 sm:p-5", contentClassName)}>{children}</div>
      </Card>
    </motion.div>
  );
}

function SupervisorEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: typeof Trophy;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[260px] flex-col items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-6 py-8 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-black text-slate-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function SupervisorHeaderAction({
  children,
  href,
  onClick,
  className,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const classes = cn(
    "inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700",
    className,
  );

  if (href) return <Link href={href} className={classes}>{children}</Link>;
  return <button type="button" onClick={onClick} className={classes}>{children}</button>;
}

function SupervisorKpiGrid({ items }: { items: CrmWorkspace["stats"] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((item, index) => {
        const config = supervisorKpiConfig[item.title as keyof typeof supervisorKpiConfig];

        return (
          <motion.div
            key={item.title}
            data-supervisor-kpi
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.04, ease: "easeOut" }}
            whileHover={{ y: -3 }}
            className="h-full"
          >
            <DashboardMetricCard
              title={item.title}
              value={item.value}
              helper={config.helper || item.helper}
              icon={config.icon}
              tone={config.tone}
              href={dashboardMetricHref("SUPERVISOR", item.title)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function performanceScoreVariant(score: number) {
  if (score <= 0) return "bg-slate-300";
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-blue-500";
  if (score >= 35) return "bg-amber-500";
  return "bg-rose-500";
}

function followUpMethodVisual(method: string) {
  const normalized = method.toLowerCase();
  if (normalized.includes("whatsapp")) return { icon: MessageCircleMore, badge: "success" as const, label: "WhatsApp" };
  if (normalized.includes("email")) return { icon: Mail, badge: "default" as const, label: "Email" };
  if (normalized.includes("meeting")) return { icon: CalendarClock, badge: "violet" as const, label: "Meeting" };
  return { icon: PhoneCall, badge: "warning" as const, label: normalized.includes("call") || normalized.includes("phone") ? "Phone Call" : method };
}

function followUpBucketVariant(bucket: string) {
  if (bucket === "Overdue") return "danger" as const;
  if (bucket === "Due Today") return "warning" as const;
  if (bucket === "Upcoming") return "default" as const;
  return "neutral" as const;
}

function buildSupervisorLeadStatusData(workspace: CrmWorkspace) {
  const pipelineMap = new Map(workspace.pipeline.map((item) => [item.label, item.value]));
  const count = (...labels: string[]) => labels.reduce((sum, label) => sum + (pipelineMap.get(label) ?? 0), 0);

  return [
    { name: `New Leads Â· ${count("New Lead")}`, value: count("New Lead"), color: "#2563EB" },
    { name: `Qualified Â· ${count("Contacted", "Interested", "Negotiation")}`, value: count("Contacted", "Interested", "Negotiation"), color: "#4F46E5" },
    { name: `Follow-up Â· ${count("Follow-up Required")}`, value: count("Follow-up Required"), color: "#F59E0B" },
    { name: `Quotation Â· ${count("Quotation Sent")}`, value: count("Quotation Sent"), color: "#0EA5E9" },
    { name: `Customer Â· ${count("Won Sale")}`, value: count("Won Sale"), color: "#16A34A" },
    { name: `Lost Â· ${count("Lost Sale", "On Hold")}`, value: count("Lost Sale", "On Hold"), color: "#DC2626" },
  ].filter((item) => item.value > 0);
}

function SupervisorTeamPerformancePanel({ rows }: { rows: SupervisorPerformanceRow[] }) {
  return (
    <SupervisorSurfaceCard
      title="Team Performance"
      subtitle="A live view of marketer execution, communication load, and conversion progress."
      action={<Badge variant="neutral">{rows.length} Marketers</Badge>}
    >
      {rows.length ? (
        <>
          <div className="hidden xl:block overflow-x-auto">
            <table className="min-w-[1180px] w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  {["Employee", "Leads", "Calls", "WhatsApp", "Meetings", "Follow-ups", "Pending Tasks", "Overdue Follow-ups", "Sales", "Conversion", "Performance Score"].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-bold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/80">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-black text-white shadow-sm">
                          {initials(row.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">{row.name}</p>
                          <p className="truncate text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.leads}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.calls}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.whatsapp}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.meetings}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.followUps}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.pendingTasks}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.overdueFollowUps}</td>
                    <td className="px-3 py-4 font-semibold text-slate-700">{row.sales}</td>
                    <td className="px-3 py-4"><Badge variant={row.sales > 0 ? "success" : "neutral"}>{row.conversionRate}</Badge></td>
                    <td className="px-3 py-4">
                      <div className="min-w-[170px]">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                          <span>Performance</span>
                          <span>{performanceScoreLabel(row)}</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 xl:hidden">
            {rows.map((row) => (
              <div key={row.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-black text-white shadow-sm">
                    {initials(row.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="truncate text-sm font-black text-slate-950">{row.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                      </div>
                      <Badge variant={row.sales > 0 ? "success" : "neutral"}>{row.conversionRate}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                      {[
                        ["Leads", row.leads],
                        ["Calls", row.calls],
                        ["WhatsApp", row.whatsapp],
                        ["Meetings", row.meetings],
                        ["Follow-ups", row.followUps],
                        ["Pending", row.pendingTasks],
                        ["Overdue", row.overdueFollowUps],
                        ["Sales", row.sales],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="mt-1 text-base font-black text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                        <span>Performance Score</span>
                        <span>{performanceScoreLabel(row)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-white">
                        <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <SupervisorEmptyState
          icon={Users}
          title="No marketer performance data available"
          description="Assign marketers to leads and team activities to view performance analytics here."
          className="min-h-[360px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorSalesTrendPanel({ data }: { data: Array<{ month: string; sales: number }> }) {
  return (
    <SupervisorSurfaceCard
      title="Sales Trends"
      subtitle="Quotation momentum and closed-value movement over time."
      className="h-full"
      contentClassName="min-h-[340px] p-5"
    >
      {data.length ? (
        <div className="h-[280px]">
          <SalesLineChart data={data} />
        </div>
      ) : (
        <SupervisorEmptyState
          icon={WalletCards}
          title="No sales activity available"
          description="Create quotations and close deals to view analytics."
          className="min-h-[280px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorTopPerformerPanel({ performer }: { performer?: SupervisorPerformanceRow }) {
  return (
    <SupervisorSurfaceCard title="Top Performer" subtitle="Best-performing marketer in the current team snapshot." className="h-full">
      {performer ? (
        <div className="flex h-full flex-col rounded-[18px] bg-[radial-gradient(circle_at_top,#fff6db_0%,#fff7ed_40%,#eff6ff_100%)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-sm">
              <Trophy className="h-7 w-7" />
            </div>
            <Badge variant="warning">{performer.hasPerformanceActivity ? `Top Score ${performer.performanceScore}%` : "No activity"}</Badge>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-950 to-slate-700 text-lg font-black text-white shadow-lg">
              {initials(performer.name)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-black text-slate-950">{performer.name}</h3>
              <p className="truncate text-sm font-semibold text-slate-500">{performer.designation !== "-" ? performer.designation : performer.role}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Leads", performer.leads],
              ["Follow-ups", performer.followUps],
              ["Sales", performer.sales],
              ["Conversion", performer.conversionRate],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/90 bg-white/90 px-3 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
              <span>Performance Score</span>
              <span>{performanceScoreLabel(performer)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/90">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" style={{ width: `${performer.performanceScore}%` }} />
            </div>
          </div>
          <Link href="/supervisor/rewards" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800">
            <Award className="h-4 w-4" />
            Give Reward
          </Link>
        </div>
      ) : (
        <SupervisorEmptyState
          icon={Trophy}
          title="No top performer yet"
          description="Team activity will spotlight your highest-performing marketer automatically."
          className="min-h-[320px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorPendingFollowUpsPanel({ rows }: { rows: CrmWorkspace["followUps"] }) {
  return (
    <SupervisorSurfaceCard
      title="Pending Follow-ups"
      subtitle="Outstanding customer actions sorted by urgency."
      action={<Badge variant="neutral">{rows.length} Open</Badge>}
      className="h-full"
    >
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((item, index) => {
            const methodVisual = followUpMethodVisual(item.method);
            const MethodIcon = methodVisual.icon;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.18), ease: "easeOut" }}
                className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm", methodVisual.badge === "success" ? "text-emerald-600" : methodVisual.badge === "default" ? "text-blue-600" : methodVisual.badge === "violet" ? "text-violet-600" : "text-amber-600")}>
                    <MethodIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-black text-slate-950">
                        <EntityLink href={item.href} className="font-black">{item.customer}</EntityLink>
                      </p>
                      <Badge variant={methodVisual.badge}>{methodVisual.label}</Badge>
                      <Badge variant={followUpBucketVariant(item.bucket)}>{item.bucket}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {item.assignedTo}</span>
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {item.followUpDate}</span>
                    </div>
                    {item.note !== "-" ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.note}</p> : null}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <SupervisorEmptyState
          icon={CalendarClock}
          title="No pending follow-ups"
          description="Your team is clear for now. New reminders will appear here automatically."
          className="min-h-[320px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorProductInterestPanel({ data }: { data: Array<{ name: string; leads: number }> }) {
  return (
    <SupervisorSurfaceCard
      title="Product-wise Interest"
      subtitle="Top products attracting the highest customer demand."
      className="h-full"
      contentClassName="min-h-[320px] p-5"
    >
      {data.length ? (
        <div className="h-[250px]">
          <ProductBarChart data={data} />
        </div>
      ) : (
        <SupervisorEmptyState
          icon={BriefcaseBusiness}
          title="No product interest available"
          description="As marketers discuss products with leads and customers, demand insights will appear here."
          className="min-h-[250px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorProductIntelligencePanel({ workspace }: { workspace: CrmWorkspace }) {
  const panels = [
    {
      title: "Top 5 Most Engaged Products",
      rows: workspace.productIntelligence.topEngaged,
      badgeVariant: "default" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.engagementScore} score`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} interested companies Â· ${item.followUpCount} follow-ups`,
    },
    {
      title: "Highest Conversion Products",
      rows: workspace.productIntelligence.highestConversion,
      badgeVariant: "success" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.conversionRate}% conversion`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.salesCount} sales Â· ${item.quotationCount} quotations`,
    },
    {
      title: "Most Discussed Products",
      rows: workspace.productIntelligence.mostDiscussed,
      badgeVariant: "warning" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.communicationCount} discussions`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} companies Â· ${item.followUpCount} follow-ups`,
    },
  ] as const;

  return (
    <div className="grid gap-6 xl:grid-cols-3" data-supervisor-section>
      {panels.map((panel) => (
        <SupervisorSurfaceCard key={panel.title} title={panel.title} className="h-full">
          {panel.rows.length ? (
            <div className="space-y-3">
              {panel.rows.map((item, index) => (
                <Link key={`${panel.title}-${item.id}`} href={`/products/${item.id}`} className="flex items-start justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-slate-700 shadow-sm">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{item.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{panel.description(item)}</p>
                    </div>
                  </div>
                  <Badge variant={panel.badgeVariant}>{panel.metric(item)}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <SupervisorEmptyState
              icon={BriefcaseBusiness}
              title="No product intelligence yet"
              description="Once team conversations, follow-ups, and quotations increase, product intelligence rankings will show here."
              className="min-h-[260px]"
            />
          )}
        </SupervisorSurfaceCard>
      ))}
    </div>
  );
}

function buildSupervisorLeadStatusDataV2(workspace: CrmWorkspace) {
  const pipelineMap = new Map(workspace.pipeline.map((item) => [item.label, item.value]));
  const count = (...labels: string[]) => labels.reduce((sum, label) => sum + (pipelineMap.get(label) ?? 0), 0);

  return [
    { name: "New Leads", value: count("New Lead"), color: "#2563EB" },
    { name: "Qualified", value: count("Contacted", "Interested", "Negotiation"), color: "#22C55E" },
    { name: "Follow-up", value: count("Follow-up Required"), color: "#F59E0B" },
    { name: "Quotation", value: count("Quotation Sent"), color: "#FB923C" },
    { name: "Customer", value: count("Won Sale"), color: "#06B6D4" },
    { name: "Lost", value: count("Lost Sale", "On Hold"), color: "#EF4444" },
  ].filter((item) => item.value > 0);
}

function SupervisorTeamPerformancePanelV2({
  rows,
  toolbar,
  onMetricClick,
}: {
  rows: SupervisorPerformanceRow[];
  toolbar?: React.ReactNode;
  onMetricClick?: (payload: TeamPerformanceDrilldownPayload) => void;
}) {
  const action = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {toolbar}
      <SupervisorHeaderAction href={rolePath("SUPERVISOR", "team")}>View All</SupervisorHeaderAction>
    </div>
  );

  return (
    <SupervisorSurfaceCard title="Team Performance" action={action}>
      {rows.length ? (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[1180px] w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  {["Employee", "Leads", "Calls", "WhatsApp", "Meetings", "Follow-ups", "Pending Tasks", "Overdue Follow-ups", "Sales", "Conversion", "Score"].map((heading) => (
                    <th key={heading} className="px-3 py-3 font-black">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/60">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-sm">
                          {initials(row.name)}
                        </div>
                        {onMetricClick ? (
                          <button
                            type="button"
                            onClick={() => onMetricClick({
                              marketerId: row.id,
                              marketerName: row.name,
                              metric: "overview",
                              metricLabel: teamPerformanceMetricLabels.overview,
                            })}
                            className="min-w-0 cursor-pointer text-left transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                          >
                            <p className="truncate font-black text-slate-950">{row.name}</p>
                            <p className="truncate text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                          </button>
                        ) : (
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-950">{row.name}</p>
                            <p className="truncate text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                          </div>
                        )}
                        <Link
                          href={`${rolePath("SUPERVISOR", "team")}/${row.id}/dashboard`}
                          title="View Dashboard"
                          className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                    {(["leads", "calls", "whatsapp", "meetings", "followUps", "pendingTasks", "overdueFollowUps", "sales", "conversion"] as TeamPerformanceMetricKey[]).map((metric) => {
                      const value = teamPerformanceMetricValue(row, metric);
                      const clickable = isTeamPerformanceMetricClickable(metric, value);
                      const textValue = typeof value === "number" ? value : value;
                      return (
                        <td key={metric} className="px-3 py-4 font-semibold text-slate-700">
                          {clickable && onMetricClick ? (
                            <button
                              type="button"
                              onClick={() => onMetricClick({
                                marketerId: row.id,
                                marketerName: row.name,
                                metric,
                                metricLabel: teamPerformanceMetricLabels[metric],
                              })}
                              className="cursor-pointer rounded-md text-left text-slate-700 transition hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                              {textValue}
                            </button>
                          ) : (
                            <span>{textValue}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-4">
                      <div className="min-w-[152px]">
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                          <span>Score</span>
                          {row.performanceScore > 0 && onMetricClick ? (
                            <button
                              type="button"
                              onClick={() => onMetricClick({
                                marketerId: row.id,
                                marketerName: row.name,
                                metric: "score",
                                metricLabel: teamPerformanceMetricLabels.score,
                              })}
                              className="cursor-pointer rounded-md text-left transition hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                              {row.performanceScore}%
                            </button>
                          ) : (
                            <span>{performanceScoreLabel(row)}</span>
                          )}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 xl:hidden">
            {rows.map((row) => (
              <div key={row.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white shadow-sm">
                    {initials(row.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {onMetricClick ? (
                        <button
                          type="button"
                          onClick={() => onMetricClick({
                            marketerId: row.id,
                            marketerName: row.name,
                            metric: "overview",
                            metricLabel: teamPerformanceMetricLabels.overview,
                          })}
                          className="min-w-0 cursor-pointer text-left transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          <p className="truncate text-sm font-black text-slate-950">{row.name}</p>
                          <p className="text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                        </button>
                      ) : (
                        <div>
                          <p className="truncate text-sm font-black text-slate-950">{row.name}</p>
                          <p className="text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.role}</p>
                        </div>
                      )}
                      <span className="text-sm font-bold text-slate-700">{row.conversionRate}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                      {(["leads", "calls", "whatsapp", "meetings", "followUps", "pendingTasks", "overdueFollowUps", "sales", "conversion", "score"] as TeamPerformanceMetricKey[]).map((metric) => {
                        const value = metric === "score" ? performanceScoreLabel(row) : teamPerformanceMetricValue(row, metric);
                        const label = metric === "whatsapp" ? "WhatsApp" : metric === "followUps" ? "Follow-ups" : metric === "pendingTasks" ? "Pending" : metric === "overdueFollowUps" ? "Overdue" : teamPerformanceMetricLabels[metric];
                        const clickable = isTeamPerformanceMetricClickable(metric, value);

                        return (
                          <div key={`${metric}-${row.id}`} className="rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                            {clickable && onMetricClick ? (
                              <button
                                type="button"
                                onClick={() => onMetricClick({
                                  marketerId: row.id,
                                  marketerName: row.name,
                                  metric,
                                  metricLabel: teamPerformanceMetricLabels[metric],
                                })}
                                className="mt-1 inline-block cursor-pointer text-base font-black leading-tight text-slate-900 underline decoration-transparent transition hover:decoration-slate-400"
                              >
                                {value}
                              </button>
                            ) : (
                              <p className="mt-1 text-base font-black leading-tight text-slate-900">{value}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                        <span>Performance Score</span>
                        <span>{performanceScoreLabel(row)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                      </div>
                    </div>
                    <Link
                      href={`${rolePath("SUPERVISOR", "team")}/${row.id}/dashboard`}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" />
                      View Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <SupervisorEmptyState
          icon={Users}
          title="No marketer performance data available"
          description="Assign marketers to leads and team activities to view performance analytics here."
          className="min-h-[360px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorSalesTrendPanelV2({ data }: { data: Array<{ month: string; sales: number }> }) {
  return (
    <SupervisorSurfaceCard
      title="Sales Trends"
      action={<SupervisorHeaderAction>This Month</SupervisorHeaderAction>}
      className="h-full"
      contentClassName="min-h-[340px] p-5"
    >
      {data.length ? (
        <div className="h-[280px]">
          <SalesLineChart data={data} />
        </div>
      ) : (
        <SupervisorEmptyState
          icon={WalletCards}
          title="No sales activity available"
          description="Create quotations and close deals to view analytics."
          className="min-h-[280px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorTopPerformerPanelV2({ performer }: { performer?: SupervisorPerformanceRow }) {
  return (
    <SupervisorSurfaceCard title="Top Performer" className="h-full">
      {performer ? (
        <div className="flex h-full flex-col rounded-[20px] bg-[radial-gradient(circle_at_top,#fff9e9_0%,#fff5de_36%,#f8fbff_100%)] p-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-500 shadow-sm">
            <Trophy className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-[1.5rem] font-black text-slate-950">{performer.name}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{performer.designation !== "-" ? performer.designation : performer.role}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Leads", performer.leads],
              ["Follow-ups", performer.followUps],
              ["Sales", performer.sales],
              ["Conversion", performer.conversionRate],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <Badge variant="warning" className="mx-auto mt-5">{performer.hasPerformanceActivity ? `Top Score ${performer.performanceScore}%` : "No activity"}</Badge>
          <Link href="/supervisor/rewards" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700">
            <Award className="h-4 w-4" />
            Give Reward
          </Link>
        </div>
      ) : (
        <SupervisorEmptyState
          icon={Trophy}
          title="No top performer yet"
          description="Team activity will spotlight your highest-performing marketer automatically."
          className="min-h-[320px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorPendingFollowUpsPanelV2({ rows }: { rows: CrmWorkspace["followUps"] }) {
  return (
    <SupervisorSurfaceCard
      title="Pending Follow-ups"
      action={<SupervisorHeaderAction href={rolePath("SUPERVISOR", "follow-ups")}>View All</SupervisorHeaderAction>}
      className="h-full"
    >
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((item, index) => {
            const methodVisual = followUpMethodVisual(item.method);
            const MethodIcon = methodVisual.icon;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.18), ease: "easeOut" }}
                className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm", methodVisual.badge === "success" ? "text-emerald-600" : methodVisual.badge === "default" ? "text-blue-600" : methodVisual.badge === "violet" ? "text-violet-600" : "text-amber-600")}>
                    <MethodIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-black text-slate-950">
                        <EntityLink href={item.href} className="font-black">{item.customer}</EntityLink>
                      </p>
                      <Badge variant={followUpBucketVariant(item.bucket)}>{item.bucket}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">{methodVisual.label} - {item.note !== "-" ? item.note : item.assignedTo}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.bucket === "Overdue" ? `Overdue follow-up - ${item.followUpDate}` : `Follow-up date - ${item.followUpDate}`}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <SupervisorEmptyState
          icon={CalendarClock}
          title="No pending follow-ups"
          description="Your team is clear for now. New reminders will appear here automatically."
          className="min-h-[320px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorProductInterestPanelV2({ data }: { data: Array<{ name: string; leads: number }> }) {
  const maxLeads = Math.max(1, ...data.map((item) => item.leads));

  return (
    <SupervisorSurfaceCard
      title="Product-wise Interest"
      action={<SupervisorHeaderAction href={rolePath("SUPERVISOR", "reports")}>View Report</SupervisorHeaderAction>}
      className="h-full"
      contentClassName="min-h-[320px] p-5"
    >
      {data.length ? (
        <div className="space-y-5">
          {data.slice(0, 5).map((item) => (
            <div key={item.name} className="grid gap-2 sm:grid-cols-[170px_minmax(0,1fr)_28px] sm:items-center">
              <p className="truncate text-sm font-semibold text-slate-700">{item.name}</p>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500" style={{ width: `${item.leads === 0 ? 0 : Math.max(10, (item.leads / maxLeads) * 100)}%` }} />
              </div>
              <span className="text-right text-sm font-black text-slate-700">{item.leads}</span>
            </div>
          ))}
        </div>
      ) : (
        <SupervisorEmptyState
          icon={BriefcaseBusiness}
          title="No product interest available"
          description="As marketers discuss products with leads and customers, demand insights will appear here."
          className="min-h-[250px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function SupervisorProductIntelligencePanelV2({ workspace }: { workspace: CrmWorkspace }) {
  const panels = [
    {
      title: "Top 5 Most Engaged Products",
      rows: workspace.productIntelligence.topEngaged,
      badgeVariant: "default" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.engagementScore} score`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} leads - ${item.followUpCount} follow-ups - ${item.quotationCount} quotes`,
    },
    {
      title: "Highest Conversion Products",
      rows: workspace.productIntelligence.highestConversion,
      badgeVariant: "success" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.conversionRate}% conversion`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.salesCount} sales - ${item.quotationCount} quotations`,
    },
    {
      title: "Most Discussed Products",
      rows: workspace.productIntelligence.mostDiscussed,
      badgeVariant: "warning" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.communicationCount} discussions`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} companies - ${item.followUpCount} follow-ups`,
    },
  ] as const;

  return (
    <div data-supervisor-section>
      <SupervisorSurfaceCard title="Product Intelligence" className="h-full">
        <div className="grid gap-5 xl:grid-cols-3">
          {panels.map((panel) => (
            <div key={panel.title} className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
              <h3 className="text-sm font-black text-slate-950">{panel.title}</h3>
              {panel.rows.length ? (
                <div className="mt-4 space-y-3">
                  {panel.rows.map((item, index) => (
                    <Link key={`${panel.title}-${item.id}`} href={`/products/${item.id}`} className="flex items-start justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-blue-700">{index + 1}. {item.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{panel.description(item)}</p>
                      </div>
                      <Badge variant={panel.badgeVariant} className="shrink-0">{panel.metric(item)}</Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <SupervisorEmptyState
                  icon={BriefcaseBusiness}
                  title="No product intelligence yet"
                  description="Once team conversations, follow-ups, and quotations increase, product intelligence rankings will show here."
                  className="mt-4 min-h-[260px]"
                />
              )}
            </div>
          ))}
        </div>
      </SupervisorSurfaceCard>
    </div>
  );
}

type MarketerTaskFilter = TodayWorkFilter;

const marketerKpiConfig = {
  "Today's Tasks": { icon: ClipboardCheck, tone: "linear-gradient(135deg,#2563EB 0%,#1D4ED8 52%,#4F46E5 100%)", helper: "Unified work queue" },
  "Pending Tasks": { icon: AlertTriangle, tone: "linear-gradient(135deg,#F59E0B 0%,#F97316 52%,#EA580C 100%)", helper: "Need your action" },
  "Follow-ups Due": { icon: PhoneForwarded, tone: "linear-gradient(135deg,#4F46E5 0%,#7C3AED 56%,#4338CA 100%)", helper: "Overdue & today" },
  "New Leads": { icon: Target, tone: "linear-gradient(135deg,#10B981 0%,#059669 56%,#047857 100%)", helper: "Assigned leads" },
  "Meetings Today": { icon: CalendarClock, tone: "linear-gradient(135deg,#06B6D4 0%,#0891B2 54%,#0E7490 100%)", helper: "Scheduled meeting" },
  "Reward Points": { icon: Award, tone: "linear-gradient(135deg,#F43F5E 0%,#E11D48 56%,#BE123C 100%)", helper: "This month" },
} as const;

function marketerActivityIcon(title: string, detail: string) {
  const haystack = `${title} ${detail}`.toLowerCase();
  if (haystack.includes("follow-up")) return { icon: PhoneForwarded, tone: "bg-emerald-50 text-emerald-700" };
  if (haystack.includes("task")) return { icon: ClipboardCheck, tone: "bg-blue-50 text-blue-700" };
  if (haystack.includes("meeting")) return { icon: CalendarClock, tone: "bg-amber-50 text-amber-700" };
  if (haystack.includes("lead")) return { icon: Target, tone: "bg-violet-50 text-violet-700" };
  return { icon: CheckCircle2, tone: "bg-slate-100 text-slate-700" };
}

type MarketerDashboardTaskSnapshot = {
  activeTasks: TodayWorkQueueItem[];
  upcomingTasks: TodayTaskApiRow[];
  completedTasks: CompletedWorkItem[];
};

function MarketerTaskPanel({
  icon: Icon,
  iconTone,
  panelId,
  title,
  subtitle,
  accentClassName,
  action,
  footer,
  children,
  hideTitleOnMobile = false,
  hideSubtitleOnMobile = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconTone: string;
  panelId?: string;
  title: string;
  subtitle?: string;
  accentClassName: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  hideTitleOnMobile?: boolean;
  hideSubtitleOnMobile?: boolean;
}) {
  return (
    <section id={panelId} className="scroll-mt-24 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_28px_72px_rgba(15,23,42,0.11)]">
      <div className={cn("h-3 w-full", accentClassName)} />
      <div className="px-4 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] shadow-[0_14px_28px_rgba(37,99,235,0.22)]", iconTone)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className={cn("text-[24px] font-bold leading-tight tracking-[-0.03em] text-slate-950", hideTitleOnMobile && "hidden sm:block")}>
                {title}
              </h3>
              {subtitle ? (
                <p className={cn("mt-1 text-[15px] font-medium leading-6 text-slate-600", hideSubtitleOnMobile && "hidden sm:block")}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {action ? <div className="w-full lg:w-auto">{action}</div> : null}
        </div>

        <div className="pt-5">{children}</div>

        {footer ? <div className="mt-5 border-t border-slate-100 pt-5">{footer}</div> : null}
      </div>
    </section>
  );
}

function MarketerKpiGrid({ workspace }: { workspace: CrmWorkspace }) {
  const todaysTasks = Number(workspace.stats.find((item) => item.title === "Today's Tasks")?.value ?? 0);
  const pendingTasks = Number(workspace.stats.find((item) => item.title === "Pending Tasks")?.value ?? 0);
  const newLeads = Number(workspace.stats.find((item) => item.title === "New Leads")?.value ?? 0);
  const meetingsToday = Number(workspace.stats.find((item) => item.title === "Meetings Today")?.value ?? 0);
  const rewardPoints = Number(workspace.stats.find((item) => item.title === "Reward Points")?.value ?? 0);
  const cards = [
    { title: "Today's Tasks", value: String(todaysTasks), helper: "Unified work queue" },
    { title: "Pending Tasks", value: String(pendingTasks), helper: "Need your action" },
    { title: "Follow-ups Due", value: String(workspace.followUpSummary.overdue + workspace.followUpSummary.today), helper: "Overdue & today" },
    { title: "New Leads", value: String(newLeads), helper: "Assigned leads" },
    { title: "Meetings Today", value: String(meetingsToday), helper: "Scheduled meeting" },
    { title: "Reward Points", value: String(rewardPoints), helper: "This month" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 2xl:gap-4">
      {cards.map((item) => {
        const config = marketerKpiConfig[item.title as keyof typeof marketerKpiConfig];
        return (
          <DashboardMetricCard
            key={item.title}
            title={item.title}
            value={item.value}
            helper={item.helper || config.helper}
            icon={config.icon}
            tone={config.tone}
            href={dashboardMetricHref("MARKETER", item.title)}
          />
        );
      })}
    </div>
  );
}

function MarketerTodayTaskSection({
  workspace,
  initialTaskSnapshot,
}: {
  workspace: CrmWorkspace;
  initialTaskSnapshot?: MarketerDashboardTaskSnapshot;
}) {
  const [loading, setLoading] = React.useState(() => !initialTaskSnapshot);
  const [error, setError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<MarketerTaskFilter>("all");
  const [activeTasks, setActiveTasks] = React.useState<TodayWorkQueueItem[]>(() => sortTodayWorkQueue(dedupeRowsById(initialTaskSnapshot?.activeTasks ?? [])));
  const [upcomingTasks, setUpcomingTasks] = React.useState<TodayTaskApiRow[]>(() => dedupeRowsById(initialTaskSnapshot?.upcomingTasks ?? []));
  const [completedTasks, setCompletedTasks] = React.useState<CompletedWorkItem[]>(() => sortCompletedWorkRows(dedupeRowsById(initialTaskSnapshot?.completedTasks ?? [])));
  const [activeSearchQuery, setActiveSearchQuery] = React.useState("");
  const [completedSearchQuery, setCompletedSearchQuery] = React.useState("");
  const [completedFilter, setCompletedFilter] = React.useState<"all" | "call" | "follow-up" | "demo-send" | "quotation" | "sale-won" | "lead-lost">("all");
  const [completionItem, setCompletionItem] = React.useState<TodayWorkQueueItem | null>(null);
  const [editingTask, setEditingTask] = React.useState<TodayTaskApiRow | null>(null);
  const [editingFollowUp, setEditingFollowUp] = React.useState<EditableFollowUpModalItem | null>(null);
  const [dueReminderItem, setDueReminderItem] = React.useState<TodayWorkQueueItem | null>(null);
  const [followUpSummaryOpen, setFollowUpSummaryOpen] = React.useState(false);
  const [followUpSummaryLoading, setFollowUpSummaryLoading] = React.useState(false);
  const [followUpSummaryError, setFollowUpSummaryError] = React.useState("");
  const [followUpSummaryRows, setFollowUpSummaryRows] = React.useState<FollowUpRow[]>(() => (
    [...workspace.followUps]
      .filter((item) => item.bucket !== "Completed")
      .sort((left, right) => new Date(left.followUpDateIso).getTime() - new Date(right.followUpDateIso).getTime())
  ));
  const [followUpSummaryCounts, setFollowUpSummaryCounts] = React.useState(() => workspace.followUpSummary);
  const { refreshTaskCount, refreshCompletedTaskCount } = useTaskCounterContext();
  const scheduledRefreshTimers = React.useRef<number[]>([]);
  const crmDayRefreshTimer = React.useRef<number | null>(null);
  const shownReminderKeys = React.useRef<Set<string>>(new Set());
  const reminderMutedUntil = React.useRef<number>(0);
  const role = workspace.user.role;

  const reminderStorageKey = React.useMemo(() => `crm_followup_reminders_dismissed_v4:${workspace.user.id}`, [workspace.user.id]);

  const persistDismissedReminderState = React.useCallback((nextKeys: Set<string>, mutedUntil = 0) => {
    try {
      window.localStorage.setItem(reminderStorageKey, JSON.stringify({
        dismissedKeys: [...nextKeys],
        mutedUntil,
      }));
    } catch {}
  }, [reminderStorageKey]);

  const reminderKey = React.useCallback(
    (item: TodayWorkQueueItem) => `${item.sourceType}:${item.sourceId}:${item.taskDateIso}`,
    [],
  );

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(reminderStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        shownReminderKeys.current = new Set(parsed.filter((value) => typeof value === "string"));
        reminderMutedUntil.current = 0;
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const storedKeys = "dismissedKeys" in parsed && Array.isArray(parsed.dismissedKeys)
        ? parsed.dismissedKeys.filter((value): value is string => typeof value === "string")
        : [];
      const storedMutedUntil = "mutedUntil" in parsed
        ? Number((parsed as { mutedUntil?: number | string }).mutedUntil)
        : 0;
      shownReminderKeys.current = new Set(storedKeys);
      reminderMutedUntil.current = Number.isFinite(storedMutedUntil) && storedMutedUntil > Date.now()
        ? storedMutedUntil
        : 0;
    } catch {}
  }, [reminderStorageKey]);

  const maybeOpenDueReminder = React.useCallback((rows: TodayWorkQueueItem[], preferredIso?: string | null) => {
    const now = Date.now();
    if (reminderMutedUntil.current > now) return;
    const preferredTime = preferredIso ? new Date(preferredIso).getTime() : Number.NaN;
    const dueRows = rows
      .filter((item) => (
        item.queueType === "DUE_FOLLOW_UP"
        && new Date(item.taskDateIso).getTime() <= now
        && !shownReminderKeys.current.has(reminderKey(item))
      ))
      .sort((left, right) => new Date(left.taskDateIso).getTime() - new Date(right.taskDateIso).getTime());

    if (!dueRows.length) return;

    const matched = Number.isFinite(preferredTime)
      ? dueRows.find((item) => Math.abs(new Date(item.taskDateIso).getTime() - preferredTime) < 60_000)
      : undefined;
    const nextItem = matched ?? dueRows[0];
    if (!nextItem) return;

    setDueReminderItem(nextItem);
  }, [reminderKey]);

  const dismissDueReminder = React.useCallback((item: TodayWorkQueueItem | null, mode: "item" | "day" = "day") => {
    if (item) {
      shownReminderKeys.current.add(reminderKey(item));
      const nextMutedUntil = mode === "day"
        ? getCrmDayWindow(new Date()).to.getTime()
        : reminderMutedUntil.current > Date.now()
          ? reminderMutedUntil.current
          : 0;
      reminderMutedUntil.current = nextMutedUntil;
      persistDismissedReminderState(shownReminderKeys.current, nextMutedUntil);
    }
    setDueReminderItem(null);
  }, [persistDismissedReminderState, reminderKey]);

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [todayResponse, upcomingResponse, completedResponse] = await Promise.all([
        fetch("/api/tasks/today", { cache: "no-store" }),
        fetch("/api/tasks/upcoming", { cache: "no-store" }),
        fetch("/api/tasks/completed", { cache: "no-store" }),
      ]);

      const [todayResult, upcomingResult, completedResult] = await Promise.all([
        todayResponse.json(),
        upcomingResponse.json(),
        completedResponse.json(),
      ]);

      if (!todayResponse.ok) {
        throw new Error(typeof todayResult.message === "string" ? todayResult.message : "Failed to load today's tasks.");
      }

      if (!upcomingResponse.ok) {
        throw new Error(typeof upcomingResult.message === "string" ? upcomingResult.message : "Failed to load upcoming tasks.");
      }

      if (!completedResponse.ok) {
        throw new Error(typeof completedResult.message === "string" ? completedResult.message : "Failed to load completed tasks.");
      }

      const sortedRows = sortTodayWorkQueue(dedupeRowsById(todayResult.rows as TodayWorkQueueItem[]));
      setActiveTasks(sortedRows);
      setUpcomingTasks(dedupeRowsById(upcomingResult.rows as TodayTaskApiRow[]));
      setCompletedTasks(sortCompletedWorkRows(dedupeRowsById(completedResult.rows as CompletedWorkItem[])));
      return sortedRows;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
      return [] as TodayWorkQueueItem[];
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialTaskSnapshot) return;
    const timer = window.setTimeout(() => {
      void loadTasks();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [initialTaskSnapshot, loadTasks]);

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
  }, [loadTasks, refreshCompletedTaskCount, refreshTaskCount]);

  React.useEffect(() => {
    scheduleNextCrmDayRefresh();

    return () => {
      if (crmDayRefreshTimer.current !== null) {
        window.clearTimeout(crmDayRefreshTimer.current);
        crmDayRefreshTimer.current = null;
      }
    };
  }, [scheduleNextCrmDayRefresh]);

  const scheduleQueueRefreshAt = React.useCallback((isoDate?: string | null) => {
    if (!isoDate) return;

    const triggerAt = new Date(isoDate).getTime();
    if (!Number.isFinite(triggerAt)) return;

    const delay = triggerAt - Date.now();
    if (delay <= 0) {
      void loadTasks().then((rows) => {
        maybeOpenDueReminder(rows, isoDate);
      });
      void refreshTaskCount();
      void refreshCompletedTaskCount();
      return;
    }

    const timer = window.setTimeout(() => {
      void loadTasks().then((rows) => {
        maybeOpenDueReminder(rows, isoDate);
      });
      void refreshTaskCount();
      void refreshCompletedTaskCount();
      scheduledRefreshTimers.current = scheduledRefreshTimers.current.filter((value) => value !== timer);
    }, delay + 250);

    scheduledRefreshTimers.current.push(timer);
  }, [loadTasks, maybeOpenDueReminder, refreshCompletedTaskCount, refreshTaskCount]);

  React.useEffect(() => {
    maybeOpenDueReminder(activeTasks);
  }, [activeTasks, maybeOpenDueReminder]);

  React.useEffect(() => {
    for (const timer of scheduledRefreshTimers.current) {
      window.clearTimeout(timer);
    }
    scheduledRefreshTimers.current = [];

    const bootstrapTimer = window.setTimeout(() => {
      for (const item of activeTasks) {
        const triggerAt = new Date(item.taskDateIso).getTime();
        if (Number.isFinite(triggerAt) && triggerAt > Date.now()) {
          scheduleQueueRefreshAt(item.taskDateIso);
        }
      }
    }, 0);

    return () => {
      window.clearTimeout(bootstrapTimer);
    };
  }, [activeTasks, scheduleQueueRefreshAt]);

  const handleCreated = (row: TodayTaskApiRow) => {
    setEditingTask(null);
    void loadTasks();
    void refreshTaskCount();
    scheduleQueueRefreshAt(row.taskDateIso);
  };

  const extractDate = (result: unknown, key: "nextFollowUpDate" | "followUpDate") => {
    if (!result || typeof result !== "object") return undefined;
    if (!(key in result)) return undefined;

    const value = (result as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
  };

  const handleCompletionSaved = (result?: unknown) => {
    setCompletionItem(null);
    const scheduledDate = extractDate(result, "nextFollowUpDate");
    void loadTasks().then((rows) => {
      maybeOpenDueReminder(rows, scheduledDate);
    });
    void refreshTaskCount();
    void refreshCompletedTaskCount();
    void loadFollowUpSummary();
    scheduleQueueRefreshAt(scheduledDate);
  };

  const handleFollowUpSaved = (result?: unknown) => {
    const scheduledDate = extractDate(result, "followUpDate");
    void loadTasks().then((rows) => {
      maybeOpenDueReminder(rows, scheduledDate);
    });
    void refreshTaskCount();
    void refreshCompletedTaskCount();
    void loadFollowUpSummary();
    scheduleQueueRefreshAt(scheduledDate);
  };

  const counts = React.useMemo(() => todayWorkCounts(activeTasks), [activeTasks]);
  const filteredItems = React.useMemo(
    () => {
      const normalizedQuery = activeSearchQuery.trim().toLowerCase();

      return activeTasks.filter((item) => {
        if (!matchesTodayWorkFilter(item, activeFilter)) return false;
        if (!normalizedQuery) return true;

        const haystack = [
          item.title,
          item.companyName,
          item.companyPrimaryPhone,
          item.companyCity ?? "",
          item.description,
          item.notes,
          item.method,
          item.productName,
          item.leadName ?? "",
          item.assignedAtLabel,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      });
    },
    [activeFilter, activeSearchQuery, activeTasks],
  );

  const exactCompletedTasks = React.useMemo(() => {
    return completedTasks.filter((task) => task.sourceType === "TASK");
  }, [completedTasks]);

  const actionableFollowUps = React.useMemo(
    () => followUpSummaryRows
      .filter((item) => item.bucket !== "Completed")
      .sort((left, right) => new Date(left.followUpDateIso).getTime() - new Date(right.followUpDateIso).getTime()),
    [followUpSummaryRows],
  );

  const loadFollowUpSummary = React.useCallback(async () => {
    setFollowUpSummaryLoading(true);
    setFollowUpSummaryError("");

    try {
      const response = await fetch("/api/follow-ups?dateFilter=all&page=1&pageSize=1000&pendingOnly=true", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok || !result.success || !Array.isArray(result.rows)) {
        throw new Error(typeof result.message === "string" ? result.message : "Failed to load pending follow-ups.");
      }

      const rows = result.rows as FollowUpRow[];
      setFollowUpSummaryRows(rows);
      if (result.summary && typeof result.summary === "object") {
        setFollowUpSummaryCounts({
          overdue: Number(result.summary.overdue ?? 0),
          today: Number(result.summary.today ?? 0),
          upcoming: Number(result.summary.upcoming ?? 0),
          completed: Number(result.summary.completed ?? 0),
          actionable: Number(result.summary.actionable ?? rows.length),
        });
      }
    } catch (err) {
      setFollowUpSummaryError(err instanceof Error ? err.message : "Failed to load pending follow-ups.");
    } finally {
      setFollowUpSummaryLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!followUpSummaryOpen) return;
    void loadFollowUpSummary();
  }, [followUpSummaryOpen, loadFollowUpSummary]);

  React.useEffect(() => {
    setFollowUpSummaryRows(
      [...workspace.followUps]
        .filter((item) => item.bucket !== "Completed")
        .sort((left, right) => new Date(left.followUpDateIso).getTime() - new Date(right.followUpDateIso).getTime()),
    );
    setFollowUpSummaryCounts(workspace.followUpSummary);
  }, [workspace.followUps, workspace.followUpSummary]);

  const completedCategoryKey = React.useCallback((task: CompletedWorkItem) => {
    const normalized = task.title.trim().toLowerCase();

    if (task.sourceType === "FOLLOW_UP" || normalized.includes("follow")) return "follow-up";
    if (normalized.includes("call") || normalized.includes("phone")) return "call";
    if (normalized.includes("demo")) return "demo-send";
    if (normalized.includes("quotation") || normalized.includes("quote") || normalized.includes("quatation")) return "quotation";
    if (normalized.includes("sale won") || normalized.includes("won sale") || normalized.includes("win")) return "sale-won";
    if (normalized.includes("lead lost") || normalized.includes("lost")) return "lead-lost";

    return "all";
  }, []);

  const completedCounts = React.useMemo(() => {
    const counts = {
      all: exactCompletedTasks.length,
      call: 0,
      "follow-up": 0,
      "demo-send": 0,
      quotation: 0,
      "sale-won": 0,
      "lead-lost": 0,
    };

    for (const task of exactCompletedTasks) {
      const key = completedCategoryKey(task) as keyof typeof counts;
      if (key in counts && key !== "all") counts[key] += 1;
    }

    return counts;
  }, [completedCategoryKey, exactCompletedTasks]);

  const filteredCompletedTasks = React.useMemo(() => {
    const normalizedQuery = completedSearchQuery.trim().toLowerCase();

    return exactCompletedTasks.filter((task) => {
      if (completedFilter !== "all" && completedCategoryKey(task) !== completedFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        task.title,
        task.companyName,
        task.companyPrimaryPhone,
        task.companyCity ?? "",
        task.description,
        task.notes,
        task.method,
        task.productName,
        task.leadName ?? "",
        task.completedBy,
        task.assignedTo,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [completedCategoryKey, completedFilter, completedSearchQuery, exactCompletedTasks]);
  const withDashboardReturnTo = React.useCallback(
    function withDashboardReturnTo<T extends { companyHref?: string | null }>(rows: T[], anchor: string) {
      return rows.map((row) => {
        if (!row.companyHref?.startsWith("/customers/")) return row;

        const [pathname, ...queryParts] = row.companyHref.split("?");
        const params = new URLSearchParams(queryParts.join("?"));
        params.set("returnTo", `${rolePath(role, "dashboard")}#${anchor}`);
        const companyHref = `${pathname}?${params.toString()}`;

        return companyHref === row.companyHref ? row : { ...row, companyHref };
      });
    },
    [role],
  );
  const dashboardTaskRows = React.useMemo(
    () => withDashboardReturnTo(filteredItems, "today-tasks"),
    [filteredItems, withDashboardReturnTo],
  );
  const dashboardCompletedRows = React.useMemo(
    () => withDashboardReturnTo(filteredCompletedTasks, "completed-tasks"),
    [filteredCompletedTasks, withDashboardReturnTo],
  );
  const upcomingTaskSummary = React.useMemo(() => {
    const { tomorrowTasks, laterTasks } = bucketUpcomingTasks(upcomingTasks);
    return {
      all: upcomingTasks.length,
      tomorrow: tomorrowTasks.length,
      later: laterTasks.length,
    };
  }, [upcomingTasks]);
  const upcomingTaskBuckets = React.useMemo(() => bucketUpcomingTasks(upcomingTasks), [upcomingTasks]);
  const chips: { key: MarketerTaskFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "tasks", label: "Tasks" },
    { key: "due-follow-ups", label: "Follow-ups" },
    { key: "overdue", label: "Overdue" },
    { key: "carry-forward", label: "Carry Forward" },
  ];

  const handleEditCompletedTask = React.useCallback((task: CompletedWorkItem) => {
    if (task.sourceType === "TASK") {
      setEditingTask(toEditableCompletedTaskRow(task));
      return;
    }

    if (task.sourceType === "FOLLOW_UP") {
      if (task.taskId) {
        setEditingTask(toEditableCompletedTaskRow(task));
        setEditingFollowUp(null);
        return;
      }
      setEditingFollowUp(toEditableCompletedFollowUpItem(task));
    }
  }, []);

  const handleTaskDelete = React.useCallback(async (task: TodayTaskApiRow) => {
    setActionError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Task delete failed.");
      }
      setEditingTask(null);
      void loadTasks();
      void refreshTaskCount();
      void refreshCompletedTaskCount();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Task delete failed.");
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
      setEditingFollowUp(null);
      void loadTasks();
      void refreshTaskCount();
      void refreshCompletedTaskCount();
      void loadFollowUpSummary();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Follow-up delete failed.");
    }
  }, [loadTasks, loadFollowUpSummary, refreshCompletedTaskCount, refreshTaskCount]);

  return (
    <>
      <div className="space-y-5">
        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {actionError ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{actionError}</p> : null}

        <div className="space-y-5">
            <MarketerTaskPanel
              icon={ClipboardCheck}
              iconTone="bg-[linear-gradient(135deg,#2563eb,#3b82f6)] text-white"
              panelId="today-tasks"
              title="Today's Tasks"
              accentClassName="bg-[linear-gradient(90deg,rgba(37,99,235,0.14),rgba(59,130,246,0.04),transparent)]"
              action={
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <div className="relative w-full sm:w-[230px] sm:min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={activeSearchQuery}
                      onChange={(event) => setActiveSearchQuery(event.target.value)}
                      placeholder="Search task, phone, jila..."
                      className="h-10 rounded-2xl border-slate-200 bg-slate-50/80 pl-9 text-sm font-medium shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)]"
                    />
                  </div>
                  <CreateTodayTaskButton
                    workspace={workspace}
                    label="Add Task"
                    size="sm"
                    className="h-10 w-full rounded-2xl bg-[linear-gradient(135deg,#2563eb,#3b82f6)] px-4 text-sm font-bold shadow-[0_12px_24px_rgba(37,99,235,0.2)] hover:opacity-95 sm:w-auto"
                    onCreated={handleCreated}
                  />
                </div>
              }
              footer={(
                <div className="flex justify-center">
                  <Link
                    href={rolePath(role, "tasks")}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)] transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_18px_36px_rgba(37,99,235,0.3)]"
                  >
                    View All Tasks
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            >
              {upcomingTaskSummary.all ? (
                <div className="mb-4 rounded-[22px] border border-sky-200/80 bg-[linear-gradient(135deg,rgba(224,242,254,0.9),rgba(239,246,255,0.9),rgba(255,255,255,0.9))] p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">Saved For Tomorrow</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {upcomingTaskBuckets.tomorrowTasks.length
                          ? `${upcomingTaskBuckets.tomorrowTasks.length} ta task ${upcomingTaskBuckets.tomorrowLabel} er jonno already save ache.`
                          : `${upcomingTaskBuckets.laterTasks.length} ta future task already save kora ache.`}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(upcomingTaskBuckets.tomorrowTasks.length ? upcomingTaskBuckets.tomorrowTasks : upcomingTaskBuckets.laterTasks).slice(0, 2).map((task) => (
                          <span key={`upcoming-chip-${task.id}`} className="inline-flex max-w-full items-center rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            <span className="truncate">{task.companyName}</span>
                            <span className="ml-2 shrink-0 text-slate-500">{task.timeLabel || task.taskDateLabel}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link
                      href={rolePath(role, "tasks")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      Open Queue
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ) : null}

              <div className="mb-5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                {chips.map((chip) => {
                  const active = activeFilter === chip.key;

                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setActiveFilter(chip.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm transition",
                        active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:border-blue-100 hover:text-slate-700",
                      )}
                    >
                      {chip.label}
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-white text-blue-700" : "bg-slate-100 text-slate-500")}>{counts[chip.key]}</span>
                    </button>
                  );
                })}
              </div>

              <TodayWorkQueueList
                rows={dashboardTaskRows.slice(0, 3)}
                loading={loading}
                viewerRole={role}
                emptyMessage={activeSearchQuery.trim() ? "No matching work item found." : "No work items in this view."}
                activeItemId={completionItem?.id ?? null}
                maxHeightClassName="max-h-none"
                onEdit={setEditingTask}
                onDelete={(task) => void handleTaskDelete(task)}
                onEditFollowUp={setEditingFollowUp}
                onDeleteFollowUp={(item) => void handleFollowUpDelete(item)}
                onComplete={(item) => {
                  setActionError("");
                  setCompletionItem(item);
                }}
              />
            </MarketerTaskPanel>
        </div>
      </div>

      <TaskCreateModal
        open={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onCreated={handleCreated}
        onDeleted={() => {
          setEditingTask(null);
          void loadTasks();
          void refreshTaskCount();
          void refreshCompletedTaskCount();
        }}
        role={workspace.user.role}
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
          void loadFollowUpSummary();
        }}
      />

      <WorkCompletionModal
        item={completionItem}
        onClose={() => {
          setCompletionItem(null);
          setActionError("");
        }}
        onSaved={handleCompletionSaved}
      />

      <FormModal
        open={followUpSummaryOpen}
        title="Overall Pending Follow-ups"
        onClose={() => setFollowUpSummaryOpen(false)}
        panelClassName="w-[96vw] max-w-4xl"
        contentClassName="space-y-4"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={followUpSummaryCounts.overdue ? "danger" : "neutral"} className="rounded-full px-3 py-1 text-xs font-bold">
              Overdue {followUpSummaryCounts.overdue}
            </Badge>
            <Badge variant={followUpSummaryCounts.today ? "warning" : "neutral"} className="rounded-full px-3 py-1 text-xs font-bold">
              Today {followUpSummaryCounts.today}
            </Badge>
            <Badge variant={followUpSummaryCounts.upcoming ? "default" : "neutral"} className="rounded-full px-3 py-1 text-xs font-bold">
              Upcoming {followUpSummaryCounts.upcoming}
            </Badge>
            <Badge variant="neutral" className="rounded-full px-3 py-1 text-xs font-bold">
              Total Pending {followUpSummaryCounts.actionable}
            </Badge>
          </div>

          {followUpSummaryError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm font-semibold text-red-700">
              {followUpSummaryError}
            </div>
          ) : followUpSummaryLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm font-semibold text-slate-500">
              Loading pending follow-ups...
            </div>
          ) : actionableFollowUps.length ? (
            <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
              {actionableFollowUps.map((item) => {
                const methodVisual = followUpMethodVisual(item.method);
                const MethodIcon = methodVisual.icon;

                return (
                  <div
                    key={item.id}
                    className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm", methodVisual.badge === "success" ? "text-emerald-600" : methodVisual.badge === "default" ? "text-blue-600" : methodVisual.badge === "violet" ? "text-violet-600" : "text-amber-600")}>
                        <MethodIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">
                              <Link href={item.href ?? rolePath(role, "follow-ups")} className="transition hover:text-blue-700 hover:underline">
                                {item.customer}
                              </Link>
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {item.phone !== "-" ? item.phone : item.assignedTo}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={methodVisual.badge}>{methodVisual.label}</Badge>
                            <Badge variant={followUpBucketVariant(item.bucket)}>{item.bucket}</Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
                          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {item.assignedTo}</span>
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {item.followUpDate}</span>
                        </div>
                        {item.note !== "-" ? <p className="mt-2 text-sm text-slate-600">{item.note}</p> : null}
                        {item.nextDiscussionPlan !== "-" ? <p className="mt-1 text-xs text-slate-500">Next: {item.nextDiscussionPlan}</p> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm font-semibold text-slate-500">
              No pending follow-up found right now.
            </div>
          )}
        </div>
      </FormModal>

      <FormModal
        open={Boolean(dueReminderItem)}
        title="Follow-up Reminder"
        onClose={() => dismissDueReminder(dueReminderItem, "day")}
        panelClassName="w-[95vw] max-w-[520px]"
        contentClassName="space-y-4"
      >
        {dueReminderItem ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">Live now</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">{dueReminderItem.title}</h3>
              <p className="mt-2 text-base font-bold text-slate-800">{dueReminderItem.companyName}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">{dueReminderItem.timeLabel} â€¢ {dueReminderItem.taskDateLabel}</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">{dueReminderItem.description !== "-" ? dueReminderItem.description : dueReminderItem.method}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setCompletionItem(dueReminderItem);
                  dismissDueReminder(dueReminderItem, "item");
                }}
              >
                Complete
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEditingFollowUp(dueReminderItem);
                  dismissDueReminder(dueReminderItem, "item");
                }}
              >
                Edit Follow-up
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => dismissDueReminder(dueReminderItem, "day")}
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </FormModal>
    </>
  );
}

function MarketerFollowUpCenter({
  workspace,
  initialRows,
}: {
  workspace: CrmWorkspace;
  initialRows?: TodayTaskApiRow[];
}) {
  const hasInitialRows = initialRows !== undefined;
  const [loading, setLoading] = React.useState(() => !hasInitialRows);
  const [error, setError] = React.useState("");
  const [rows, setRows] = React.useState<TodayTaskApiRow[]>(() => dedupeRowsById(initialRows ?? []));
  const crmDayRefreshTimer = React.useRef<number | null>(null);

  const loadUpcoming = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/tasks/upcoming", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.message === "string" ? result.message : "Failed to load scheduled tasks.");
      }
      setRows(dedupeRowsById(result.rows as TodayTaskApiRow[]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scheduled tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (hasInitialRows) return;
    void loadUpcoming();
  }, [hasInitialRows, loadUpcoming]);

  const scheduleNextCrmDayRefresh = React.useCallback(() => {
    if (crmDayRefreshTimer.current !== null) {
      window.clearTimeout(crmDayRefreshTimer.current);
    }

    const nextCrmDayStart = getCrmDayWindow(new Date()).to;
    const delay = Math.max(0, nextCrmDayStart.getTime() - Date.now());

    crmDayRefreshTimer.current = window.setTimeout(() => {
      crmDayRefreshTimer.current = null;
      void loadUpcoming();
      scheduleNextCrmDayRefresh();
    }, delay + 250);
  }, [loadUpcoming]);

  React.useEffect(() => {
    scheduleNextCrmDayRefresh();

    return () => {
      if (crmDayRefreshTimer.current !== null) {
        window.clearTimeout(crmDayRefreshTimer.current);
        crmDayRefreshTimer.current = null;
      }
    };
  }, [scheduleNextCrmDayRefresh]);

  const buckets = React.useMemo(() => {
    const { tomorrowTasks, laterTasks, tomorrowLabel, total } = bucketUpcomingTasks(rows);
    return {
      tomorrow: tomorrowTasks,
      later: laterTasks,
      tomorrowLabel,
      total,
    };
  }, [rows]);

  const panels = [
    {
      title: "Tomorrow",
      tone: "text-blue-600",
      badgeVariant: "default" as const,
      count: buckets.tomorrow.length,
      rows: buckets.tomorrow,
      empty: "Kal er jonno kono task save kora hoyni.",
      helper: buckets.tomorrow.length ? buckets.tomorrowLabel : "No task scheduled",
    },
    {
      title: "Next",
      tone: "text-slate-700",
      badgeVariant: "neutral" as const,
      count: buckets.later.length,
      rows: buckets.later,
      empty: "Next day-r jonno kono task nai.",
      helper: buckets.later.length ? "Porer scheduled task gulo" : "No next task",
    },
  ] as const;

  return (
    <DashboardCard
      title="Scheduled For Tomorrow"
      action={<Link href={rolePath("MARKETER", "tasks")} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md">View All <ArrowRight className="h-4 w-4" /></Link>}
    >
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="rounded-[20px] border border-sky-200 bg-gradient-to-r from-sky-50 via-blue-50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="rounded-full px-3 py-1 text-xs font-bold">Tomorrow {buckets.tomorrow.length}</Badge>
          <Badge variant="neutral" className="rounded-full px-3 py-1 text-xs font-bold">Next {buckets.later.length}</Badge>
          <Badge variant="neutral" className="rounded-full px-3 py-1 text-xs font-bold">Total {buckets.total}</Badge>
        </div>
        <p className="mt-4 text-[15px] font-medium leading-6 text-slate-700">
          {buckets.tomorrow.length
            ? `${buckets.tomorrowLabel} er jonno ${buckets.tomorrow.length} ta task ready ache.`
            : buckets.later.length
              ? `${buckets.later.length} ta next scheduled task niche list akare dekhano hocche.`
              : "Agamikal ba next diner jonno ekhono kono task save kora hoyni."}
        </p>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {panels.map((panel) => (
          <div key={panel.title} className="rounded-[20px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50/80 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className={cn("text-[15px] font-bold", panel.tone)}>{panel.title}</h3>
                <p className="mt-1 text-[13px] font-medium text-slate-600">{panel.helper}</p>
              </div>
              <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-700 shadow-sm">{panel.count}</span>
            </div>
            <div className="h-[280px] space-y-3 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
              {loading ? (
                <p className="rounded-xl bg-white p-3 text-xs font-semibold text-slate-400">Loading scheduled tasks...</p>
              ) : panel.rows.map((task) => (
                <div key={`${panel.title}-${task.id}`} className="rounded-[18px] border border-slate-100 bg-white px-4 py-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-slate-950">{task.title}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-blue-700">
                        {task.companyHref ? <Link href={task.companyHref} className="hover:text-blue-800">{task.companyName}</Link> : task.companyName}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {task.taskDateLabel}{task.timeLabel ? ` at ${task.timeLabel}` : ""}
                      </p>
                    </div>
                    <Badge variant={panel.badgeVariant} className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold">
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              ))}
              {!loading && !panel.rows.length ? <p className="rounded-[18px] border border-slate-100 bg-white p-4 text-sm font-medium text-slate-600 shadow-sm">{panel.empty}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function MarketerRecentActivities({ workspace }: { workspace: CrmWorkspace }) {
  return (
    <DashboardCard
      title="Recent Activities"
      action={<Link href={rolePath("MARKETER", "communication")} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md">View All <Eye className="h-4 w-4" /></Link>}
    >
      <div className="relative space-y-3 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-slate-200">
        {workspace.activities.slice(0, 5).map((item) => {
          const activity = marketerActivityIcon(item.title, item.detail);
          const Icon = activity.icon;

          return (
            <div key={item.id} className="relative flex items-start justify-between gap-4 rounded-[18px] border border-slate-100 bg-white px-4 py-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-100 hover:bg-blue-50/30 hover:shadow-md">
              <div className="flex min-w-0 items-start gap-3">
                <div className={cn("relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white shadow-sm", activity.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-slate-950">
                    <EntityLink href={item.href} className="font-semibold">{item.title}</EntityLink>
                  </p>
                  <p className="mt-1 truncate text-[13px] font-medium text-slate-600">{item.detail}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-slate-600">{item.time}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">by You</p>
              </div>
            </div>
          );
        })}
        {!workspace.activities.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No recent activities yet.</p> : null}
      </div>
    </DashboardCard>
  );
}

export function MarketerDashboard({
  workspace,
  initialTaskSnapshot,
}: {
  workspace: CrmWorkspace;
  initialTaskSnapshot?: MarketerDashboardTaskSnapshot;
}) {
  const greeting = useDashboardGreeting(workspace.user.name, "MARKETER");

  return (
    <div className="premium-dashboard-shell space-y-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <h1 className="text-[1.6rem] font-black tracking-normal text-slate-950 sm:text-2xl md:text-3xl">
            {greeting.title}
          </h1>
          <p className="inline-flex w-fit max-w-full items-center gap-2.5 rounded-xl border border-dashed border-violet-300 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,243,255,0.92))] px-5 py-2.5 text-[15px] font-black leading-6 text-violet-700 shadow-[0_12px_28px_rgba(124,58,237,0.12)] ring-4 ring-violet-100/70 sm:text-base">
            <Sparkles className="h-5 w-5 shrink-0 text-amber-400" />
            {greeting.message}
          </p>
        </div>
      </div>

      <MarketerKpiGrid workspace={workspace} />

      <MarketerTodayTaskSection workspace={workspace} initialTaskSnapshot={initialTaskSnapshot} />

      <MarketerFollowUpCenter workspace={workspace} initialRows={initialTaskSnapshot?.upcomingTasks} />
      <MarketerRecentActivities workspace={workspace} />
    </div>
  );
}

export function SupervisorDashboard({ workspace }: { workspace: CrmWorkspace }) {
  const dashboardRef = React.useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const greeting = useDashboardGreeting(workspace.user.name, "SUPERVISOR");
  const charts = chartData(workspace);
  const periodOptions: TeamPerformancePeriod[] = ["today", "week", "month"];
  const teamPerformanceRows = workspace.teamPerformance?.rows;
  const workspacePeriod = workspace.teamPerformance?.period ?? null;
  const initialPeriod: TeamPerformancePeriod = isTeamPerformancePeriod(workspacePeriod) ? workspacePeriod : "today";
  const [performancePeriod, setPerformancePeriod] = React.useState<TeamPerformancePeriod>(initialPeriod);
  const supervisorStats = React.useMemo(() => {
    const requestedTitles = [
      "Total Marketers",
      "Total Leads",
      "Follow-up Due",
      "Overdue Follow-ups",
      "Sales This Month",
      "Conversion Rate",
    ] as const;
    const statMap = new Map(workspace.stats.map((item) => [item.title, item]));
    return requestedTitles
      .map((title) => statMap.get(title))
      .filter((item): item is CrmWorkspace["stats"][number] => Boolean(item));
  }, [workspace.stats]);
  const performanceRows = React.useMemo<SupervisorPerformanceRow[]>(() => {
    const teamRows = (teamPerformanceRows ?? []).filter((row) => row.roleKey === "MARKETER");
    return teamRows
      .map((row) => ({
        ...row,
        ...buildPerformanceScore(row),
      }))
      .sort((left, right) => (
        right.performanceScoreRaw - left.performanceScoreRaw ||
        right.sales - left.sales ||
        right.leads - left.leads ||
        right.followUps - left.followUps
      ));
  }, [teamPerformanceRows]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPerformancePeriod(initialPeriod);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [initialPeriod]);

  const updatePerformancePeriod = React.useCallback((period: TeamPerformancePeriod) => {
    if (!pathname) return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("performancePeriod") === period) return;
    params.set("performancePeriod", period);

    const nextQuery = params.toString();
    const href = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    React.startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }, [pathname, router, searchParams]);

  const handlePeriodChange = React.useCallback((period: TeamPerformancePeriod) => {
    if (period === performancePeriod) return;
    setPerformancePeriod(period);
    updatePerformancePeriod(period);
  }, [performancePeriod, updatePerformancePeriod]);

  const performanceFilterToolbar = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
        {periodOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handlePeriodChange(option)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold",
              performancePeriod === option
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            {performancePeriodLabels[option]}
          </button>
        ))}
      </div>
    </div>
  );

  const pendingFollowUps = React.useMemo(() => {
    const bucketRank: Record<string, number> = {
      Overdue: 0,
      "Due Today": 1,
      Upcoming: 2,
      Completed: 3,
    };

    return workspace.followUps
      .filter((item) => item.bucket !== "Completed")
      .sort((left, right) => (bucketRank[left.bucket] ?? 99) - (bucketRank[right.bucket] ?? 99))
      .slice(0, 6);
  }, [workspace.followUps]);

  const [drilldownOpen, setDrilldownOpen] = React.useState(false);
  const [drilldownPayload, setDrilldownPayload] = React.useState<TeamPerformanceDrilldownPayload | null>(null);
  const [drilldownRows, setDrilldownRows] = React.useState<TeamPerformanceDrilldownRow[]>([]);
  const [drilldownCount, setDrilldownCount] = React.useState(0);
  const [drilldownLoading, setDrilldownLoading] = React.useState(false);
  const [drilldownError, setDrilldownError] = React.useState("");
  const [drilldownPeriod, setDrilldownPeriod] = React.useState<TeamPerformancePeriod>(performancePeriod);

  const metricPeriodLabel = React.useCallback((period: TeamPerformancePeriod) => performancePeriodLabels[period], []);

  const loadDrilldown = React.useCallback(async (
    payload: TeamPerformanceDrilldownPayload,
    selectedPeriod: TeamPerformancePeriod,
    options?: { preserveExisting?: boolean },
  ) => {
    const preserveExisting = options?.preserveExisting ?? false;
    setDrilldownLoading(true);
    setDrilldownError("");
    if (!preserveExisting) {
      setDrilldownRows([]);
      setDrilldownCount(0);
    }

    try {
      const params = new URLSearchParams({
        marketerId: payload.marketerId,
        metricType: payload.metric,
        period: selectedPeriod,
      });

      const response = await fetch(`/api/supervisor/team-performance/drilldown?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json();

      if (!response.ok || !json?.success) {
        throw new Error(json?.message || "Failed to load drill-down records.");
      }

      setDrilldownRows(json.rows || []);
      setDrilldownCount(json.count || 0);
    } catch (error) {
      setDrilldownError(error instanceof Error ? error.message : "Failed to load drill-down records.");
    } finally {
      setDrilldownLoading(false);
    }
  }, []);

  const handlePerformanceMetricClick = React.useCallback(async (payload: TeamPerformanceDrilldownPayload) => {
    setDrilldownPayload(payload);
    setDrilldownPeriod(performancePeriod);
    setDrilldownOpen(true);
    await loadDrilldown(payload, performancePeriod);
  }, [loadDrilldown, performancePeriod]);

  const handleDrilldownPeriodChange = React.useCallback(async (nextPeriod: TeamPerformancePeriod) => {
    if (!drilldownPayload || nextPeriod === drilldownPeriod) return;
    setDrilldownPeriod(nextPeriod);
    await loadDrilldown(drilldownPayload, nextPeriod, { preserveExisting: true });
  }, [drilldownPayload, drilldownPeriod, loadDrilldown]);

  const closeDrilldown = React.useCallback(() => {
    setDrilldownOpen(false);
    setDrilldownPeriod(performancePeriod);
    setDrilldownPayload(null);
    setDrilldownRows([]);
    setDrilldownCount(0);
    setDrilldownError("");
  }, [performancePeriod]);

  React.useEffect(() => {
    if (!dashboardRef.current) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-supervisor-kpi]",
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out" },
      );
      gsap.fromTo(
        "[data-supervisor-section]",
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.1, delay: 0.14, ease: "power2.out" },
      );
    }, dashboardRef);

    return () => context.revert();
  }, []);

  return (
    <div ref={dashboardRef} className="space-y-6">
      <PageHeader
        title={greeting.title}
        actions={
          <>
            <CreateTodayTaskButton
              workspace={workspace}
              label="Create Today's Task"
              size="sm"
              className="h-9 rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700"
              refreshOnCreate
            />
            <SupervisorHeaderAction>{performancePeriodLabels[performancePeriod]}</SupervisorHeaderAction>
          </>
        }
      />

      <SupervisorKpiGrid items={supervisorStats} />

      <div data-supervisor-section>
        <SupervisorTeamPerformancePanelV2
          rows={performanceRows}
          toolbar={performanceFilterToolbar}
          onMetricClick={handlePerformanceMetricClick}
        />
      </div>

      <div data-supervisor-section>
        <AdminCallTrackingPanel workspace={workspace} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.88fr_1fr]" data-supervisor-section>
        <SupervisorSalesTrendPanelV2 data={charts.sales} />
        <SupervisorTopPerformerPanelV2 performer={performanceRows.find((row) => row.hasPerformanceActivity)} />
        <SupervisorPendingFollowUpsPanelV2 rows={pendingFollowUps} />
      </div>

      <div data-supervisor-section>
        <SupervisorProductInterestPanelV2 data={charts.products} />
      </div>

      <SupervisorProductIntelligencePanelV2 workspace={workspace} />

      <FormModal
        open={drilldownOpen}
        title={drilldownPayload
          ? `${drilldownPayload.marketerName} - ${drilldownPayload.metricLabel} - ${metricPeriodLabel(drilldownPeriod)}`
          : "Team performance drill-down"}
        onClose={closeDrilldown}
        panelClassName="w-[95vw] max-w-[1120px] max-h-[calc(100vh-2.5rem)] sm:max-h-[calc(100vh-4rem)]"
        contentClassName="min-h-0 p-3 sm:p-4"
      >
        <div className="space-y-3">
          {drilldownError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {drilldownError}
            </div>
          ) : null}

          {drilldownLoading && !drilldownRows.length ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Loading records...</div>
          ) : (
            <div className="relative min-h-[220px]">
              <div className={cn("transition-opacity duration-200", drilldownLoading ? "opacity-60" : "opacity-100")}>
                {drilldownRows.length ? (
                  <TeamPerformanceDrilldownTable
                    rows={drilldownRows}
                    workspace={workspace}
                    marketerId={drilldownPayload?.marketerId ?? ""}
                    marketerName={drilldownPayload?.marketerName ?? "Marketer"}
                    currentPeriod={drilldownPeriod}
                    onPeriodChange={(period) => {
                      void handleDrilldownPeriodChange(period);
                    }}
                    onSummaryCardClick={(focus) => {
                      if (!drilldownPayload?.marketerId) return;
                      router.push(
                        buildActivityOverviewHref(
                          workspace.user.role,
                          drilldownPayload.marketerId,
                          drilldownPayload.marketerName,
                          drilldownPeriod,
                          focus,
                        ),
                        { scroll: false },
                      );
                    }}
                  />
                ) : (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    No records found for this metric in selected period.
                  </p>
                )}
              </div>
              {drilldownLoading ? (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-end rounded-xl bg-white/35 px-3 py-2 backdrop-blur-[1px]">
                  <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm">
                    Refreshing...
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </FormModal>
    </div>
  );
}

type AdminPerformanceRow = CrmWorkspace["employees"][number] & {
  performanceScore: number;
  performanceScoreRaw: number;
  hasPerformanceActivity: boolean;
};

const adminKpiConfig = {
  "Total Users": {
    icon: Users,
    tone: "#2563eb",
    helper: "System users",
  },
  "Total Customers": {
    icon: BriefcaseBusiness,
    tone: "#059669",
    helper: "Active customer companies",
  },
  "Total Leads": {
    icon: Target,
    tone: "#4f46e5",
    helper: "Live pipeline opportunities",
  },
  "Total Products": {
    icon: BriefcaseBusiness,
    tone: "#0891b2",
    helper: "Products in CRM catalog",
  },
  "Follow-ups Due": {
    icon: CalendarClock,
    tone: "#f59e0b",
    helper: "Overdue and due today",
  },
  "Lead Conversion Rate": {
    icon: Award,
    tone: "#7c3aed",
    helper: "Won vs total leads",
  },
  "Total Rewards": {
    icon: Trophy,
    tone: "#e11d48",
    helper: "Distributed reward points",
  },
} as const;

function adminActivityVisual(category?: CrmWorkspace["activities"][number]["category"]) {
  switch (category) {
    case "CALL":
      return { icon: PhoneCall, badge: "warning" as const, tone: "bg-amber-100 text-amber-700" };
    case "WHATSAPP":
      return { icon: MessageCircleMore, badge: "success" as const, tone: "bg-emerald-100 text-emerald-700" };
    case "EMAIL":
      return { icon: Mail, badge: "default" as const, tone: "bg-blue-100 text-blue-700" };
    case "MEETING":
      return { icon: CalendarClock, badge: "violet" as const, tone: "bg-violet-100 text-violet-700" };
    case "FOLLOW_UP":
      return { icon: PhoneForwarded, badge: "warning" as const, tone: "bg-orange-100 text-orange-700" };
    case "LEAD":
      return { icon: Target, badge: "default" as const, tone: "bg-cyan-100 text-cyan-700" };
    case "QUOTATION":
      return { icon: WalletCards, badge: "neutral" as const, tone: "bg-slate-100 text-slate-700" };
    default:
      return { icon: CheckCircle2, badge: "neutral" as const, tone: "bg-slate-100 text-slate-700" };
  }
}

function AdminKpiGrid({ items }: { items: { title: keyof typeof adminKpiConfig; value: string; helper: string }[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {items.map((item, index) => {
        const config = adminKpiConfig[item.title];

        return (
          <motion.div
            key={item.title}
            data-admin-kpi
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: index * 0.03, ease: "easeOut" }}
            whileHover={{ y: -2 }}
            className="h-full"
          >
            <DashboardMetricCard
              title={item.title}
              value={item.value}
              helper={item.helper || config.helper}
              icon={config.icon}
              tone={config.tone}
              href={dashboardMetricHref("ADMIN", item.title)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function isRealCallActivity(item: CrmWorkspace["activities"][number]) {
  if (item.category !== "CALL") return false;

  const combined = [
    item.title,
    item.rawAction,
    item.discussionSummary,
    item.notes,
    item.contactMethod,
    item.entity,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (combined.includes("assigned to")) return false;
  if (item.entity === "CommunicationLog") return true;
  if ((item.contactMethod ?? "").toLowerCase().includes("call")) return true;
  if ((item.title ?? "").toLowerCase().includes("phone call")) return true;
  if ((item.rawAction ?? "").toLowerCase().includes("call opened")) return true;
  return false;
}

function AdminSalesPanel({ data }: { data: Array<{ month: string; sales: number }> }) {
  const hasData = data.some((item) => item.sales > 0);

  return (
    <SupervisorSurfaceCard
      title="Sales Performance"
      subtitle="Quotation value and sales momentum across the current period."
      action={<SupervisorHeaderAction>Current Month</SupervisorHeaderAction>}
      className="h-full"
      contentClassName="min-h-[360px] p-5"
    >
      {hasData ? (
        <div className="h-[300px]">
          <SalesLineChart data={data} />
        </div>
      ) : (
        <SupervisorEmptyState
          icon={WalletCards}
          title="No sales trend data available"
          description="Create quotations and close deals to view analytics."
          className="min-h-[300px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

function AdminCallTrackingPanel({ workspace }: { workspace: CrmWorkspace }) {
  const router = useRouter();
  const periodOptions: TeamPerformancePeriod[] = ["today", "week", "month"];
  const [callPeriod, setCallPeriod] = React.useState<TeamPerformancePeriod>("today");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailCustomerHref, setDetailCustomerHref] = React.useState<string | null>(null);
  const [detailCustomerName, setDetailCustomerName] = React.useState<string>("");
  const callActivities = React.useMemo(
    () => workspace.callActivities ?? workspace.activities.filter(isRealCallActivity),
    [workspace.activities, workspace.callActivities],
  );
  const detailCustomerId = React.useMemo(() => {
    const match = detailCustomerHref?.match(/^\/customers\/([^/?#]+)/);
    return match?.[1] ?? "";
  }, [detailCustomerHref]);

  const periodWindow = React.useMemo(() => getCrmPeriodWindow(new Date(), { period: callPeriod }), [callPeriod]);
  const rows = React.useMemo(() => {
    const filtered = callActivities
      .filter((item) => {
        if (!item.createdAtValue) return false;
        const createdAt = new Date(item.createdAtValue);
        return createdAt >= periodWindow.from && createdAt < periodWindow.to;
      })
      .sort((left, right) => {
        const leftTime = left.createdAtValue ? new Date(left.createdAtValue).getTime() : 0;
        const rightTime = right.createdAtValue ? new Date(right.createdAtValue).getTime() : 0;
        return rightTime - leftTime;
      });
    return filtered;
  }, [callActivities, periodWindow.from, periodWindow.to]);

  const totalCallsInPeriod = React.useMemo(() => {
    return callActivities
      .filter((item) => {
        if (!item.createdAtValue) return false;
        const createdAt = new Date(item.createdAtValue);
        return createdAt >= periodWindow.from && createdAt < periodWindow.to;
      }).length;
  }, [callActivities, periodWindow.from, periodWindow.to]);

  const company = React.useMemo(() => {
    if (!detailCustomerId) return null;
    return workspace.companies.find((item) => item.id === detailCustomerId) ?? null;
  }, [detailCustomerId, workspace.companies]);

  const companyCalls = React.useMemo(() => {
    if (!detailCustomerHref) return [];
    return callActivities
      .filter((item) => item.customerHref === detailCustomerHref)
      .sort((left, right) => {
        const leftTime = left.createdAtValue ? new Date(left.createdAtValue).getTime() : 0;
        const rightTime = right.createdAtValue ? new Date(right.createdAtValue).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 24);
  }, [callActivities, detailCustomerHref]);

  const callPeriodToolbar = (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
      {periodOptions.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setCallPeriod(option)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold",
            callPeriod === option
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50",
          )}
        >
          {performancePeriodLabels[option]}
        </button>
      ))}
    </div>
  );

  const openCallActivityPage = React.useCallback(() => {
    router.push(rolePath(workspace.user.role, "communication"), { scroll: false });
  }, [router, workspace.user.role]);

  return (
    <SupervisorSurfaceCard
      title="Call Activity Center"
      subtitle="Recent call logs with who called, when, and what was discussed."
      action={
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {callPeriodToolbar}
          <SupervisorHeaderAction onClick={openCallActivityPage}>{totalCallsInPeriod} Calls</SupervisorHeaderAction>
        </div>
      }
      className="h-full"
      contentClassName="p-3.5 sm:p-5"
    >
      {rows.length ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p className="text-sm font-semibold text-slate-600">
              Showing <span className="font-black text-slate-950">{rows.length}</span> call logs for {performancePeriodLabels[callPeriod].toLowerCase()}.
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Scroll inside this panel to browse older call notes.
            </p>
          </div>
          <div className="hidden max-h-[720px] min-h-[360px] overflow-auto rounded-2xl border border-slate-100 pr-1 [scrollbar-gutter:stable] lg:block">
          <table className="min-w-[1120px] w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-white text-left text-[10px] uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-3 py-3 font-black">Company</th>
                <th className="px-3 py-3 font-black">Marketer</th>
                <th className="px-3 py-3 font-black">Method</th>
                <th className="px-3 py-3 font-black">Note</th>
                <th className="px-3 py-3 font-black">Next Step</th>
                <th className="px-3 py-3 font-black">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((item) => (
                <tr key={item.id} className="align-top transition hover:bg-slate-50/70">
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    <button
                      type="button"
                      className={cn(
                        "text-left font-semibold leading-6",
                        item.customerHref ? "text-blue-700 hover:underline" : "text-slate-900",
                      )}
                      onClick={() => {
                        setDetailCustomerHref(item.customerHref ?? null);
                        setDetailCustomerName(item.customerName ?? "-");
                        setDetailOpen(true);
                      }}
                      disabled={!item.customerHref}
                    >
                      {item.customerName ?? "-"}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{item.employeeName ?? item.createdBy ?? "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{item.contactMethod ?? item.badgeLabel ?? "-"}</td>
                  <td className="max-w-[480px] px-3 py-3 text-slate-700">
                    <p className="whitespace-normal break-words leading-6">
                      {item.discussionSummary ?? item.notes ?? "-"}
                    </p>
                    {item.notes && item.notes !== "-" && item.notes !== item.discussionSummary ? (
                      <p className="mt-1 whitespace-normal break-words text-xs font-semibold text-slate-500">
                        Next note: {item.notes}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-[240px] px-3 py-3 text-slate-600">
                    <p className="whitespace-normal break-words leading-6">
                      {item.nextFollowUpDate ?? "-"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{item.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="space-y-3 lg:hidden">
            {rows.map((item) => (
              <div key={item.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    className={cn(
                      "min-w-0 text-left text-sm font-black leading-6",
                      item.customerHref ? "text-blue-700 hover:underline" : "text-slate-900",
                    )}
                    onClick={() => {
                      setDetailCustomerHref(item.customerHref ?? null);
                      setDetailCustomerName(item.customerName ?? "-");
                      setDetailOpen(true);
                    }}
                    disabled={!item.customerHref}
                  >
                    {item.customerName ?? "-"}
                  </button>
                  <Badge variant="neutral">{item.time}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>{item.employeeName ?? item.createdBy ?? "-"}</span>
                  <span>{item.contactMethod ?? item.badgeLabel ?? "-"}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                  {item.discussionSummary ?? item.notes ?? "-"}
                </p>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Next Step</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{item.nextFollowUpDate ?? "-"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <SupervisorEmptyState
          icon={PhoneCall}
          title="No call activity yet"
          description="When marketers initiate calls from CRM and log notes, they will appear here."
          className="min-h-[300px]"
        />
      )}

      <FormModal
        open={detailOpen}
        title={detailCustomerName ? `${detailCustomerName} - Call Details` : "Call Details"}
        onClose={() => setDetailOpen(false)}
        panelClassName="w-[96vw] max-w-[920px]"
        contentClassName="min-h-0 p-4 sm:p-5"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-950">{company?.name ?? detailCustomerName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {[company?.industry, company?.cityOrZilla].filter((value) => value && value !== "-").join(" â€¢ ") || "Company details"}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {company?.status && company.status !== "-" ? <Badge variant="neutral">{company.status}</Badge> : null}
                {detailCustomerHref ? (
                  <Link href={detailCustomerHref} className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700">
                    Open Customer
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Contact</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{company?.contactPerson || "-"}</p>
                <p className="mt-1 text-xs text-slate-600">{company?.phone || "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Assigned</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{company?.assignedTo || "-"}</p>
                <p className="mt-1 text-xs text-slate-600">{company?.lastCommunication || "-"}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-950">Company Notes</p>
              {company?.notes && company.notes !== "-" ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{company.notes}</p>
              ) : (
                <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No notes saved yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-950">Recent Call Notes</p>
              {companyCalls.length ? (
                <div className="mt-3 space-y-2">
                  {companyCalls.map((call) => (
                    <div key={call.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-600">{call.employeeName ?? call.createdBy ?? "-"}</p>
                        <p className="text-xs font-semibold text-slate-500">{call.time}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{call.discussionSummary ?? call.notes ?? "-"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No call notes found for this company.</p>
              )}
            </div>
          </div>
        </div>
      </FormModal>
    </SupervisorSurfaceCard>
  );
}

function AdminTeamPerformancePanel({
  workspace,
  rows,
  period,
  toolbar,
}: {
  workspace: CrmWorkspace;
  rows: AdminPerformanceRow[];
  period: TeamPerformancePeriod;
  toolbar?: React.ReactNode;
}) {
  const router = useRouter();
  const [drilldownOpen, setDrilldownOpen] = React.useState(false);
  const [drilldownPayload, setDrilldownPayload] = React.useState<TeamPerformanceDrilldownPayload | null>(null);
  const [drilldownRows, setDrilldownRows] = React.useState<TeamPerformanceDrilldownRow[]>([]);
  const [drilldownCount, setDrilldownCount] = React.useState(0);
  const [drilldownLoading, setDrilldownLoading] = React.useState(false);
  const [drilldownError, setDrilldownError] = React.useState("");
  const [drilldownPeriod, setDrilldownPeriod] = React.useState<TeamPerformancePeriod>(period);

  const closeDrilldown = React.useCallback(() => {
    setDrilldownOpen(false);
    setDrilldownPeriod(period);
    setDrilldownPayload(null);
    setDrilldownRows([]);
    setDrilldownCount(0);
    setDrilldownError("");
    setDrilldownLoading(false);
  }, [period]);

  const loadDrilldown = React.useCallback(async (
    payload: TeamPerformanceDrilldownPayload,
    selectedPeriod: TeamPerformancePeriod,
    options?: { preserveExisting?: boolean },
  ) => {
    const preserveExisting = options?.preserveExisting ?? false;
    setDrilldownLoading(true);
    setDrilldownError("");
    if (!preserveExisting) {
      setDrilldownRows([]);
      setDrilldownCount(0);
    }

    try {
      const params = new URLSearchParams({
        marketerId: payload.marketerId,
        metricType: payload.metric,
        period: selectedPeriod,
      });
      const response = await fetch(`/api/supervisor/team-performance/drilldown?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await response.json();

      if (!response.ok || !json?.success) {
        throw new Error(json?.message || "Failed to load drill-down records.");
      }

      setDrilldownRows(Array.isArray(json.rows) ? json.rows : []);
      setDrilldownCount(typeof json.count === "number" ? json.count : 0);
    } catch (error) {
      setDrilldownError(error instanceof Error ? error.message : "Failed to load drill-down records.");
    } finally {
      setDrilldownLoading(false);
    }
  }, []);

  const handleMetricClick = React.useCallback(async (employee: AdminPerformanceRow, metric: TeamPerformanceMetricKey) => {
    const metricLabel = teamPerformanceMetricLabels[metric] ?? metric;
    const payload = {
      marketerId: employee.id,
      marketerName: employee.name,
      metric,
      metricLabel,
    } satisfies TeamPerformanceDrilldownPayload;

    setDrilldownPayload(payload);
    setDrilldownPeriod(period);
    setDrilldownOpen(true);
    await loadDrilldown(payload, period);
  }, [loadDrilldown, period]);

  const handleDrilldownPeriodChange = React.useCallback(async (nextPeriod: TeamPerformancePeriod) => {
    if (!drilldownPayload || nextPeriod === drilldownPeriod) return;
    setDrilldownPeriod(nextPeriod);
    await loadDrilldown(drilldownPayload, nextPeriod, { preserveExisting: true });
  }, [drilldownPayload, drilldownPeriod, loadDrilldown]);

  const openMarketersPage = React.useCallback(() => {
    router.push(rolePath(workspace.user.role, "users"), { scroll: false });
  }, [router, workspace.user.role]);

  return (
    <SupervisorSurfaceCard
      title="Team Performance"
      subtitle="Monitor execution quality across roles without forcing extra scrolling."
      action={toolbar ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {toolbar}
          <SupervisorHeaderAction onClick={openMarketersPage}>{rows.length} Marketers</SupervisorHeaderAction>
        </div>
      ) : (
        <SupervisorHeaderAction onClick={openMarketersPage}>{rows.length} Marketers</SupervisorHeaderAction>
      )}
      className="h-full"
    >
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[1180px] w-full text-sm">
          <thead className="text-left text-[10px] uppercase tracking-[0.12em] text-slate-400">
            <tr>
              {["Employee", "Role", "Leads", "Calls", "WhatsApp", "Emails", "Follow-ups", "Pending Tasks", "Overdue Follow-ups", "Conversion", "Performance Score"].map((heading) => (
                <th key={heading} className="px-3 py-3 font-black">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-slate-50/70">
                <td className="px-3 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                      {initials(row.name)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMetricClick(row, "overview")}
                      className="min-w-0 cursor-pointer text-left transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <p className="truncate font-black text-slate-950">{row.name}</p>
                      <p className="truncate text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.email}</p>
                    </button>
                    {row.roleKey === "MARKETER" ? (
                      <Link
                        href={`${rolePath("ADMIN", "team")}/${row.id}/dashboard`}
                        title="View Dashboard"
                        className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-700"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-4">
                  <Badge variant={row.roleKey === "ADMIN" ? "danger" : row.roleKey === "SUPERVISOR" ? "violet" : "default"}>{row.role}</Badge>
                </td>
                <td className="px-3 py-4">
                  <button type="button" className="cursor-pointer font-black text-blue-700 hover:underline" onClick={() => handleMetricClick(row, "leads")}>
                    {row.leads}
                  </button>
                </td>
                <td className="px-3 py-4">
                  <button type="button" className="cursor-pointer font-black text-blue-700 hover:underline" onClick={() => handleMetricClick(row, "calls")}>
                    {row.calls}
                  </button>
                </td>
                <td className="px-3 py-4">
                  <button type="button" className="cursor-pointer font-black text-blue-700 hover:underline" onClick={() => handleMetricClick(row, "whatsapp")}>
                    {row.whatsapp}
                  </button>
                </td>
                <td className="px-3 py-4 font-semibold text-slate-700">{row.emails}</td>
                <td className="px-3 py-4">
                  <button type="button" className="cursor-pointer font-black text-blue-700 hover:underline" onClick={() => handleMetricClick(row, "followUps")}>
                    {row.followUps}
                  </button>
                </td>
                <td className="px-3 py-4">
                  <button type="button" className="cursor-pointer font-black text-blue-700 hover:underline" onClick={() => handleMetricClick(row, "pendingTasks")}>
                    {row.pendingTasks}
                  </button>
                </td>
                <td className="px-3 py-4">
                  <button type="button" className="cursor-pointer font-black text-blue-700 hover:underline" onClick={() => handleMetricClick(row, "overdueFollowUps")}>
                    {row.overdueFollowUps}
                  </button>
                </td>
                <td className="px-3 py-4 font-semibold text-slate-700">{row.conversionRate}</td>
                <td className="px-3 py-4">
                    <div className="min-w-[156px]">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                        <span>Score</span>
                        <span>{performanceScoreLabel(row)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={11} className="px-3 py-10">
                  <SupervisorEmptyState
                    icon={Users}
                    title="No team members available"
                    description="User activity and productivity metrics will appear here when your CRM team starts using the system."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 lg:hidden">
        {rows.length ? rows.map((row) => (
          <div key={row.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                {initials(row.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleMetricClick(row, "overview")}
                    className="min-w-0 text-left transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <p className="truncate text-sm font-black text-slate-950">{row.name}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{row.designation !== "-" ? row.designation : row.email}</p>
                  </button>
                  <Badge variant={row.roleKey === "ADMIN" ? "danger" : row.roleKey === "SUPERVISOR" ? "violet" : "default"}>{row.role}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Leads", row.leads],
                    ["Calls", row.calls],
                    ["WhatsApp", row.whatsapp],
                    ["Emails", row.emails],
                    ["Follow-ups", row.followUps],
                    ["Pending", row.pendingTasks],
                    ["Overdue", row.overdueFollowUps],
                    ["Conversion", row.conversionRate],
                  ].map(([label, value]) => (
                    <button
                      key={String(label)}
                      type="button"
                      onClick={() => {
                        if (label === "Leads") void handleMetricClick(row, "leads");
                        else if (label === "Calls") void handleMetricClick(row, "calls");
                        else if (label === "WhatsApp") void handleMetricClick(row, "whatsapp");
                        else if (label === "Follow-ups") void handleMetricClick(row, "followUps");
                        else if (label === "Pending") void handleMetricClick(row, "pendingTasks");
                        else if (label === "Overdue") void handleMetricClick(row, "overdueFollowUps");
                      }}
                      className="rounded-xl bg-white px-3 py-2 text-left shadow-sm"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-1 text-base font-black text-slate-900">{value}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
                    <span>Performance Score</span>
                    <span>{performanceScoreLabel(row)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div className={cn("h-full rounded-full", performanceScoreVariant(row.performanceScore))} style={{ width: `${row.performanceScore}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )) : null}
      </div>

      <FormModal
        open={drilldownOpen}
        title={drilldownPayload ? `${drilldownPayload.marketerName} - ${drilldownPayload.metricLabel} - ${performancePeriodLabels[drilldownPeriod]}` : "Team performance drill-down"}
        onClose={closeDrilldown}
        panelClassName="w-[95vw] max-w-[1120px] max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)]"
        contentClassName="min-h-0 p-3 sm:p-4"
      >
        <div className="space-y-3">
          {drilldownError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {drilldownError}
            </div>
          ) : null}

          {drilldownLoading && !drilldownRows.length ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Loading records...</div>
          ) : (
            <div className="relative min-h-[220px]">
              <div className={cn("transition-opacity duration-200", drilldownLoading ? "opacity-60" : "opacity-100")}>
                {drilldownRows.length ? (
                  <TeamPerformanceDrilldownTable
                    rows={drilldownRows}
                    workspace={workspace}
                    marketerId={drilldownPayload?.marketerId ?? ""}
                    marketerName={drilldownPayload?.marketerName ?? "Marketer"}
                    currentPeriod={drilldownPeriod}
                    onPeriodChange={(period) => {
                      void handleDrilldownPeriodChange(period);
                    }}
                    onSummaryCardClick={(focus) => {
                      if (!drilldownPayload?.marketerId) return;
                      router.push(
                        buildActivityOverviewHref(
                          workspace.user.role,
                          drilldownPayload.marketerId,
                          drilldownPayload.marketerName,
                          drilldownPeriod,
                          focus,
                        ),
                        { scroll: false },
                      );
                    }}
                  />
                ) : (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    No records found for this metric in selected period.
                  </p>
                )}
              </div>
              {drilldownLoading ? (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-end rounded-xl bg-white/35 px-3 py-2 backdrop-blur-[1px]">
                  <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm">
                    Refreshing...
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </FormModal>
    </SupervisorSurfaceCard>
  );
}

function AdminProductIntelligencePanel({ workspace }: { workspace: CrmWorkspace }) {
  const panels = [
    {
      title: "Top 5 Most Engaged Products",
      rows: workspace.productIntelligence.topEngaged,
      badgeVariant: "default" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.engagementScore} score`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} leads - ${item.followUpCount} follow-ups - ${item.quotationCount} quotes`,
    },
    {
      title: "Highest Conversion Products",
      rows: workspace.productIntelligence.highestConversion,
      badgeVariant: "success" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.conversionRate}% conversion`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.salesCount} sales - ${item.quotationCount} quotations`,
    },
    {
      title: "Most Discussed Products",
      rows: workspace.productIntelligence.mostDiscussed,
      badgeVariant: "warning" as const,
      metric: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.communicationCount} discussions`,
      description: (item: CrmWorkspace["productIntelligence"]["topEngaged"][number]) => `${item.leadCount} companies - ${item.followUpCount} follow-ups`,
    },
  ] as const;

  return (
    <SupervisorSurfaceCard title="Product Intelligence" subtitle="The most valuable product signals from communication, quotation, and sales activity.">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {panels.map((panel) => (
          <div key={panel.title} className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-950">{panel.title}</h3>
            {panel.rows.length ? (
              <div className="mt-4 space-y-3">
                {panel.rows.slice(0, 5).map((item, index) => (
                  <Link key={`${panel.title}-${item.id}`} href={`/products/${item.id}`} className="flex items-start justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-blue-700">{index + 1}. {item.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{panel.description(item)}</p>
                    </div>
                    <Badge variant={panel.badgeVariant} className="shrink-0">{panel.metric(item)}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <SupervisorEmptyState
                icon={BriefcaseBusiness}
                title="No product intelligence yet"
                description="Product engagement rankings will appear once your CRM has enough activity data."
                className="mt-4 min-h-[240px]"
              />
            )}
          </div>
        ))}
      </div>
    </SupervisorSurfaceCard>
  );
}

function AdminRecentActivitiesPanel({ rows }: { rows: CrmWorkspace["activities"] }) {
  const recentRows = rows.slice(0, 10);

  return (
    <SupervisorSurfaceCard
      title="Recent Activities"
      subtitle="Only the latest 10 records are shown here to keep the dashboard focused."
      action={<SupervisorHeaderAction href={rolePath("ADMIN", "communication")}>View All Activities</SupervisorHeaderAction>}
      className="h-full"
    >
      {recentRows.length ? (
        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {recentRows.map((item) => {
            const visual = adminActivityVisual(item.category);
            const Icon = visual.icon;
            const customerLabel = item.customerName ?? item.detail.split("Â·")[0]?.trim() ?? "CRM record";
            const employeeLabel = item.employeeName ?? item.createdBy ?? item.detail.split("Â·")[1]?.trim() ?? "System";

            return (
              <div key={item.id} className="rounded-[18px] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", visual.tone)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-black text-slate-950">
                        <EntityLink href={item.href} className="font-black">{item.title}</EntityLink>
                      </p>
                      <Badge variant={visual.badge}>{item.badgeLabel ?? item.category ?? "Activity"}</Badge>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-500">
                      <p className="truncate"><span className="font-semibold text-slate-700">Customer:</span> {customerLabel}</p>
                      <p className="truncate"><span className="font-semibold text-slate-700">User:</span> {employeeLabel}</p>
                      <p className="truncate"><span className="font-semibold text-slate-700">Date/Time:</span> {item.dateLabel ?? item.time} {item.timeLabel ?? ""}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <SupervisorEmptyState
          icon={Clock3}
          title="No recent activity available"
          description="Communication, follow-up, and operational events will appear here automatically."
          className="min-h-[320px]"
        />
      )}
    </SupervisorSurfaceCard>
  );
}

export function AdminDashboard({ workspace }: { workspace: CrmWorkspace }) {
  const dashboardRef = React.useRef<HTMLDivElement | null>(null);
  const greeting = useDashboardGreeting(workspace.user.name, "ADMIN");
  const workspacePeriod = workspace.teamPerformance?.period ?? null;
  const initialPeriod: TeamPerformancePeriod = isTeamPerformancePeriod(workspacePeriod) ? workspacePeriod : "today";
  const [performancePeriod, setPerformancePeriod] = React.useState<TeamPerformancePeriod>(initialPeriod);
  const adminStats = React.useMemo(() => {
    const statMap = new Map(workspace.stats.map((item) => [item.title, item]));
    const rewardTotal = statMap.get("Reward Points")?.value ?? String(workspace.employees.reduce((sum, row) => sum + row.rewardPoints, 0));
    const conversionRate = statMap.get("Lead Conversion")?.value ?? `${workspace.leads.length ? Math.round((workspace.leads.filter((lead) => lead.status === "Won Sale").length / workspace.leads.length) * 100) : 0}%`;

    return [
      { title: "Total Users" as const, value: statMap.get("Total Users")?.value ?? String(workspace.employees.length), helper: "System users" },
      { title: "Total Customers" as const, value: statMap.get("Total Customers")?.value ?? String(workspace.companies.length), helper: "Active companies" },
      { title: "Total Leads" as const, value: statMap.get("Total Leads")?.value ?? String(workspace.leads.length), helper: "All pipeline" },
      { title: "Total Products" as const, value: String(workspace.products.length), helper: "Available products" },
      { title: "Follow-ups Due" as const, value: String(workspace.followUpSummary.overdue + workspace.followUpSummary.today), helper: "Today and overdue" },
      { title: "Lead Conversion Rate" as const, value: conversionRate, helper: "Won vs leads" },
      { title: "Total Rewards" as const, value: rewardTotal, helper: "Distributed rewards" },
    ];
  }, [workspace]);
  const adminTeamRows = React.useMemo<AdminPerformanceRow[]>(() => {
    const baseRows = (workspace.teamPerformance?.rows ?? [])
      .filter((row) => row.statusKey === "ACTIVE" && row.roleKey === "MARKETER");

    return baseRows
      .map((row) => ({
        ...row,
        ...buildPerformanceScore(row),
      }))
      .sort((left, right) => right.performanceScoreRaw - left.performanceScoreRaw || right.sales - left.sales || right.leads - left.leads);
  }, [workspace.teamPerformance?.rows]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPerformancePeriod(initialPeriod);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [initialPeriod]);

  React.useEffect(() => {
    if (!dashboardRef.current) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-admin-kpi]",
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.05, ease: "power2.out" },
      );
      gsap.fromTo(
        "[data-admin-section]",
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.08, delay: 0.12, ease: "power2.out" },
      );
    }, dashboardRef);

    return () => context.revert();
  }, []);

  return (
    <div ref={dashboardRef} className="space-y-6">
      <PageHeader
        title={greeting.title}
        actions={
          <>
            <CreateTodayTaskButton
              workspace={workspace}
              label="Create Today's Task"
              size="sm"
              className="h-9 rounded-full bg-blue-600 px-4 text-white hover:bg-blue-700"
              refreshOnCreate
            />
            <SupervisorHeaderAction>{performancePeriodLabels[performancePeriod]}</SupervisorHeaderAction>
          </>
        }
      />

      <AdminKpiGrid items={adminStats} />

      <div data-admin-section>
        <AdminTeamPerformancePanel workspace={workspace} rows={adminTeamRows} period={performancePeriod} />
      </div>

      <div data-admin-section>
        <AdminCallTrackingPanel workspace={workspace} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]" data-admin-section>
        <AdminProductIntelligencePanel workspace={workspace} />
        <AdminRecentActivitiesPanel rows={workspace.activities} />
      </div>
    </div>
  );
}


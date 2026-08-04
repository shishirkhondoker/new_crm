import { AppShell } from "@/components/app/app-shell";
import { AdminDashboard } from "@/components/crm/dashboard-pages";
import { requireCurrentUser } from "@/lib/auth";
import { getCrmWorkspace } from "@/lib/crm-data";

type TeamPerformancePeriod = "today" | "yesterday" | "week" | "month";

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const rawPeriod = params.performancePeriod;
  const isValidPeriod = (value: string | string[] | undefined): value is TeamPerformancePeriod => {
    const period = Array.isArray(value) ? value[0] : value;
    return period === "today" || period === "yesterday" || period === "week" || period === "month";
  };
  const period = isValidPeriod(rawPeriod) ? (Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod) : "today";

  const user = await requireCurrentUser("ADMIN");
  const workspace = await getCrmWorkspace("ADMIN", user, { period });

  return (
    <AppShell role="ADMIN" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}>
      <AdminDashboard workspace={workspace} />
    </AppShell>
  );
}

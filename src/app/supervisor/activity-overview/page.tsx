import { AppShell } from "@/components/app/app-shell";
import { ActivityOverviewDetailsPage } from "@/components/crm/dashboard-pages";
import { requireCurrentUser } from "@/lib/auth";
import { getCrmWorkspace } from "@/lib/crm-data";

type TeamPerformancePeriod = "today" | "yesterday" | "week" | "month";

export default async function SupervisorActivityOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawPeriod = params.period;
  const isValidPeriod = (value: string | string[] | undefined): value is TeamPerformancePeriod => {
    const period = Array.isArray(value) ? value[0] : value;
    return period === "today" || period === "yesterday" || period === "week" || period === "month";
  };
  const period = isValidPeriod(rawPeriod) ? (Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod) : "today";

  const user = await requireCurrentUser("SUPERVISOR");
  const workspace = await getCrmWorkspace("SUPERVISOR", user, { period });

  return (
    <AppShell role="SUPERVISOR" user={user} unreadCount={workspace.unreadCount} followUpCount={workspace.followUpSummary.actionable} sidebarCounts={workspace.sidebarCounts}>
      <ActivityOverviewDetailsPage role="SUPERVISOR" workspace={workspace} />
    </AppShell>
  );
}
